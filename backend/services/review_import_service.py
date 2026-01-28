"""
Review Import Service for Right at Home BnB
============================================
Import guest reviews from external platforms (VRBO, Airbnb)
and trigger sentiment analysis.

Supports:
- Manual CSV/JSON import
- VRBO API integration (when available)
- Airbnb API integration (when available)
- Scheduled sync for new reviews

Note: Full API access to Airbnb/VRBO requires partner status.
For most users, manual import via CSV export is the primary method.

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import csv
import json
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from dataclasses import dataclass, field
from io import StringIO
from loguru import logger

from sqlalchemy.orm import Session
from sqlalchemy import and_

from database.models_financial import ReviewSentimentAnalysis
from database.models import Property
from services.sentiment_service import sentiment_service, SentimentResult


@dataclass
class ImportedReview:
    """Standardized review structure for import."""
    property_id: str
    review_text: str
    star_rating: Optional[int] = None
    review_date: Optional[date] = None
    platform: str = "unknown"
    guest_name: Optional[str] = None
    external_id: Optional[str] = None
    booking_id: Optional[str] = None


@dataclass
class ImportResult:
    """Result of a review import operation."""
    total_records: int
    imported: int
    skipped: int
    errors: List[Dict[str, Any]]
    reviews_with_alerts: int


class ReviewImportService:
    """
    Service for importing reviews from external platforms.
    """

    def __init__(self):
        self.sentiment_service = sentiment_service

    # =========================================================================
    # CSV IMPORT
    # =========================================================================

    def import_from_csv(
        self,
        db: Session,
        csv_content: str,
        platform: str,
        default_property_id: Optional[str] = None,
        column_mapping: Optional[Dict[str, str]] = None
    ) -> ImportResult:
        """
        Import reviews from CSV content.

        Args:
            db: Database session
            csv_content: Raw CSV string
            platform: Source platform (airbnb, vrbo, etc.)
            default_property_id: Default property if not in CSV
            column_mapping: Custom column name mappings

        Returns:
            ImportResult with statistics
        """
        result = ImportResult(
            total_records=0,
            imported=0,
            skipped=0,
            errors=[],
            reviews_with_alerts=0
        )

        # Default column mappings for common formats
        default_mapping = {
            "review_text": ["review", "text", "content", "review_text", "comments"],
            "star_rating": ["rating", "stars", "star_rating", "overall_rating"],
            "review_date": ["date", "review_date", "created_at", "posted_date"],
            "guest_name": ["guest", "reviewer", "guest_name", "reviewer_name", "name"],
            "property_id": ["property", "property_id", "listing_id", "listing"],
            "external_id": ["id", "review_id", "external_id"]
        }

        if column_mapping:
            for key, value in column_mapping.items():
                default_mapping[key] = [value]

        try:
            reader = csv.DictReader(StringIO(csv_content))
            headers = [h.lower().strip() for h in reader.fieldnames or []]

            # Find matching columns
            column_map = {}
            for field, possible_names in default_mapping.items():
                for name in possible_names:
                    if name.lower() in headers:
                        column_map[field] = name.lower()
                        break

            # Process rows
            for row_num, row in enumerate(reader, start=2):
                result.total_records += 1

                try:
                    # Normalize row keys to lowercase
                    row = {k.lower().strip(): v for k, v in row.items()}

                    # Extract fields
                    review_text = row.get(column_map.get("review_text", ""), "").strip()
                    if not review_text:
                        result.skipped += 1
                        continue

                    # Parse star rating
                    star_str = row.get(column_map.get("star_rating", ""), "")
                    star_rating = None
                    if star_str:
                        try:
                            star_rating = int(float(star_str))
                            star_rating = max(1, min(5, star_rating))  # Clamp to 1-5
                        except ValueError:
                            pass

                    # Parse date
                    date_str = row.get(column_map.get("review_date", ""), "")
                    review_date = self._parse_date(date_str) or date.today()

                    # Get property ID
                    property_id = row.get(column_map.get("property_id", ""), "").strip()
                    if not property_id:
                        property_id = default_property_id
                    if not property_id:
                        result.errors.append({
                            "row": row_num,
                            "error": "No property ID found"
                        })
                        result.skipped += 1
                        continue

                    # Verify property exists
                    prop = db.query(Property).filter(Property.id == property_id).first()
                    if not prop:
                        result.errors.append({
                            "row": row_num,
                            "error": f"Property {property_id} not found"
                        })
                        result.skipped += 1
                        continue

                    # Check for duplicate
                    external_id = row.get(column_map.get("external_id", ""), "").strip()
                    if external_id:
                        existing = db.query(ReviewSentimentAnalysis).filter(
                            ReviewSentimentAnalysis.review_id == external_id,
                            ReviewSentimentAnalysis.platform == platform
                        ).first()
                        if existing:
                            result.skipped += 1
                            continue

                    # Create imported review
                    imported = ImportedReview(
                        property_id=property_id,
                        review_text=review_text,
                        star_rating=star_rating,
                        review_date=review_date,
                        platform=platform,
                        guest_name=row.get(column_map.get("guest_name", ""), "").strip() or None,
                        external_id=external_id or None
                    )

                    # Process and store
                    has_alert = self._process_and_store_review(db, imported)
                    result.imported += 1
                    if has_alert:
                        result.reviews_with_alerts += 1

                except Exception as e:
                    result.errors.append({
                        "row": row_num,
                        "error": str(e)
                    })
                    result.skipped += 1

            db.commit()

        except Exception as e:
            logger.error(f"CSV import failed: {e}")
            result.errors.append({"error": str(e)})

        return result

    def import_from_json(
        self,
        db: Session,
        json_content: str,
        platform: str,
        default_property_id: Optional[str] = None
    ) -> ImportResult:
        """
        Import reviews from JSON content.

        Expects array of review objects with fields:
        - review_text or text
        - rating or star_rating
        - date or review_date
        - property_id (optional)
        - guest_name (optional)
        - id or external_id (optional)
        """
        result = ImportResult(
            total_records=0,
            imported=0,
            skipped=0,
            errors=[],
            reviews_with_alerts=0
        )

        try:
            data = json.loads(json_content)
            if not isinstance(data, list):
                data = [data]

            for idx, item in enumerate(data):
                result.total_records += 1

                try:
                    # Extract review text
                    review_text = (
                        item.get("review_text") or
                        item.get("text") or
                        item.get("content") or
                        item.get("comments") or ""
                    ).strip()

                    if not review_text:
                        result.skipped += 1
                        continue

                    # Extract rating
                    star_rating = item.get("rating") or item.get("star_rating") or item.get("stars")
                    if star_rating is not None:
                        star_rating = max(1, min(5, int(float(star_rating))))

                    # Extract date
                    date_str = item.get("date") or item.get("review_date") or item.get("created_at")
                    review_date = self._parse_date(date_str) if date_str else date.today()

                    # Extract property ID
                    property_id = (
                        item.get("property_id") or
                        item.get("listing_id") or
                        default_property_id
                    )

                    if not property_id:
                        result.errors.append({
                            "index": idx,
                            "error": "No property ID"
                        })
                        result.skipped += 1
                        continue

                    # Verify property
                    prop = db.query(Property).filter(Property.id == property_id).first()
                    if not prop:
                        result.errors.append({
                            "index": idx,
                            "error": f"Property {property_id} not found"
                        })
                        result.skipped += 1
                        continue

                    # Check duplicate
                    external_id = item.get("id") or item.get("external_id") or item.get("review_id")
                    if external_id:
                        existing = db.query(ReviewSentimentAnalysis).filter(
                            ReviewSentimentAnalysis.review_id == str(external_id),
                            ReviewSentimentAnalysis.platform == platform
                        ).first()
                        if existing:
                            result.skipped += 1
                            continue

                    # Create review
                    imported = ImportedReview(
                        property_id=property_id,
                        review_text=review_text,
                        star_rating=star_rating,
                        review_date=review_date,
                        platform=platform,
                        guest_name=item.get("guest_name") or item.get("reviewer") or item.get("name"),
                        external_id=str(external_id) if external_id else None
                    )

                    has_alert = self._process_and_store_review(db, imported)
                    result.imported += 1
                    if has_alert:
                        result.reviews_with_alerts += 1

                except Exception as e:
                    result.errors.append({
                        "index": idx,
                        "error": str(e)
                    })
                    result.skipped += 1

            db.commit()

        except json.JSONDecodeError as e:
            result.errors.append({"error": f"Invalid JSON: {e}"})
        except Exception as e:
            logger.error(f"JSON import failed: {e}")
            result.errors.append({"error": str(e)})

        return result

    # =========================================================================
    # VRBO IMPORT
    # =========================================================================

    async def import_from_vrbo_export(
        self,
        db: Session,
        vrbo_data: Dict[str, Any],
        property_id: str
    ) -> ImportResult:
        """
        Import reviews from VRBO export data.

        VRBO exports reviews in a specific format when downloaded from
        the host dashboard.
        """
        result = ImportResult(
            total_records=0,
            imported=0,
            skipped=0,
            errors=[],
            reviews_with_alerts=0
        )

        reviews = vrbo_data.get("reviews", [])
        result.total_records = len(reviews)

        for review in reviews:
            try:
                # VRBO format
                review_text = review.get("publicReview", {}).get("text", "")
                if not review_text:
                    result.skipped += 1
                    continue

                # VRBO uses overall rating out of 5
                overall = review.get("ratings", {}).get("overall")
                star_rating = int(overall) if overall else None

                # Parse date
                date_str = review.get("submittedAt") or review.get("createdAt")
                review_date = self._parse_date(date_str) if date_str else date.today()

                # Guest info
                guest_info = review.get("reviewer", {})
                guest_name = guest_info.get("displayName") or guest_info.get("firstName")

                # External ID
                external_id = review.get("id") or review.get("reviewId")

                # Check duplicate
                if external_id:
                    existing = db.query(ReviewSentimentAnalysis).filter(
                        ReviewSentimentAnalysis.review_id == str(external_id),
                        ReviewSentimentAnalysis.platform == "vrbo"
                    ).first()
                    if existing:
                        result.skipped += 1
                        continue

                imported = ImportedReview(
                    property_id=property_id,
                    review_text=review_text,
                    star_rating=star_rating,
                    review_date=review_date,
                    platform="vrbo",
                    guest_name=guest_name,
                    external_id=str(external_id) if external_id else None
                )

                has_alert = self._process_and_store_review(db, imported)
                result.imported += 1
                if has_alert:
                    result.reviews_with_alerts += 1

            except Exception as e:
                result.errors.append({
                    "review_id": review.get("id"),
                    "error": str(e)
                })
                result.skipped += 1

        db.commit()
        return result

    # =========================================================================
    # AIRBNB IMPORT
    # =========================================================================

    async def import_from_airbnb_export(
        self,
        db: Session,
        airbnb_data: Dict[str, Any],
        property_id: str
    ) -> ImportResult:
        """
        Import reviews from Airbnb export data.

        Airbnb provides review exports in CSV or JSON format
        from the host dashboard.
        """
        result = ImportResult(
            total_records=0,
            imported=0,
            skipped=0,
            errors=[],
            reviews_with_alerts=0
        )

        reviews = airbnb_data.get("reviews", [])
        result.total_records = len(reviews)

        for review in reviews:
            try:
                # Airbnb format
                review_text = (
                    review.get("comments") or
                    review.get("public_review") or
                    review.get("review")
                )
                if not review_text:
                    result.skipped += 1
                    continue

                # Airbnb uses overall rating out of 5
                star_rating = review.get("rating") or review.get("overall_rating")
                if star_rating:
                    star_rating = int(star_rating)

                # Parse date
                date_str = (
                    review.get("created_at") or
                    review.get("date") or
                    review.get("review_date")
                )
                review_date = self._parse_date(date_str) if date_str else date.today()

                # Guest info
                guest_name = (
                    review.get("reviewer_name") or
                    review.get("guest_name") or
                    review.get("reviewer", {}).get("first_name")
                )

                # External ID
                external_id = review.get("id") or review.get("review_id")

                # Check duplicate
                if external_id:
                    existing = db.query(ReviewSentimentAnalysis).filter(
                        ReviewSentimentAnalysis.review_id == str(external_id),
                        ReviewSentimentAnalysis.platform == "airbnb"
                    ).first()
                    if existing:
                        result.skipped += 1
                        continue

                imported = ImportedReview(
                    property_id=property_id,
                    review_text=review_text,
                    star_rating=star_rating,
                    review_date=review_date,
                    platform="airbnb",
                    guest_name=guest_name,
                    external_id=str(external_id) if external_id else None
                )

                has_alert = self._process_and_store_review(db, imported)
                result.imported += 1
                if has_alert:
                    result.reviews_with_alerts += 1

            except Exception as e:
                result.errors.append({
                    "review_id": review.get("id"),
                    "error": str(e)
                })
                result.skipped += 1

        db.commit()
        return result

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def _process_and_store_review(
        self,
        db: Session,
        review: ImportedReview
    ) -> bool:
        """
        Process a review through sentiment analysis and store it.

        Returns:
            True if an alert was created
        """
        # Analyze sentiment
        analysis = self.sentiment_service.analyze_review(
            review.review_text,
            review.star_rating
        )

        # Calculate drift
        drift, is_drift_alert = self.sentiment_service.calculate_sentiment_drift(
            db, review.property_id, analysis.sentiment_score
        )

        # Create database record
        review_record = ReviewSentimentAnalysis(
            property_id=review.property_id,
            review_id=hash(f"{review.external_id or review.review_text[:50]}"),  # Use hash if no ID
            review_date=review.review_date or date.today(),
            platform=review.platform,
            star_rating=review.star_rating,
            overall_sentiment=analysis.sentiment_score,
            sentiment_label=analysis.sentiment_label.value,
            topics=[t.value for t in analysis.topics],
            positive_keywords=analysis.positive_keywords,
            negative_keywords=analysis.negative_keywords,
            rolling_sentiment_90d=None,
            sentiment_drift=drift,
            is_drift_alert=is_drift_alert,
            review_text=review.review_text
        )

        db.add(review_record)

        # Check if alert needed
        should_alert, severity, reason = self.sentiment_service.should_create_alert(
            analysis.sentiment_score,
            analysis.issues_detected
        )

        return should_alert or is_drift_alert

    def _parse_date(self, date_str: str) -> Optional[date]:
        """Parse date from various formats."""
        if not date_str:
            return None

        # Common formats
        formats = [
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%B %d, %Y",
            "%b %d, %Y",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue

        # Try to extract date with regex
        match = re.search(r'(\d{4})-(\d{2})-(\d{2})', date_str)
        if match:
            try:
                return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            except ValueError:
                pass

        logger.warning(f"Could not parse date: {date_str}")
        return None


# Global service instance
review_import_service = ReviewImportService()


# Convenience functions
def import_reviews_csv(
    db: Session,
    csv_content: str,
    platform: str,
    property_id: Optional[str] = None
) -> ImportResult:
    """Import reviews from CSV."""
    return review_import_service.import_from_csv(db, csv_content, platform, property_id)


def import_reviews_json(
    db: Session,
    json_content: str,
    platform: str,
    property_id: Optional[str] = None
) -> ImportResult:
    """Import reviews from JSON."""
    return review_import_service.import_from_json(db, json_content, platform, property_id)


# Export all
__all__ = [
    'ReviewImportService',
    'ImportedReview',
    'ImportResult',
    'review_import_service',
    'import_reviews_csv',
    'import_reviews_json'
]
