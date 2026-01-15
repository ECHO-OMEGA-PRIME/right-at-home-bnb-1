"""
Right At Home BnB - Cleaner Grading Service
=============================================
Comprehensive cleaner tracking and grading:
- Quickness scores (how fast they clean)
- Cleanliness scores (quality of cleaning)
- Guest review integration
- Performance rankings
- Grade calculation (A+ to F)

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
from loguru import logger
from enum import Enum

# Firebase
try:
    import firebase_admin
    from firebase_admin import firestore
    db = firestore.client() if firebase_admin._apps else None
    FIREBASE_AVAILABLE = db is not None
except:
    FIREBASE_AVAILABLE = False
    db = None


class CleanerGrade(str, Enum):
    A_PLUS = "A+"
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    F = "F"


class CleanerGradingService:
    """
    Grades cleaners based on quickness, cleanliness, and reviews.
    Steven can see rankings and performance metrics.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.reviews_collection = "rah_cleaning_reviews"
        self.profiles_collection = "rah_cleaner_profiles"

    def _calculate_grade(self, avg_score: float) -> CleanerGrade:
        """Calculate letter grade from average score (1-5 scale)."""
        if avg_score >= 4.9:
            return CleanerGrade.A_PLUS
        elif avg_score >= 4.5:
            return CleanerGrade.A
        elif avg_score >= 4.0:
            return CleanerGrade.B
        elif avg_score >= 3.0:
            return CleanerGrade.C
        elif avg_score >= 2.0:
            return CleanerGrade.D
        else:
            return CleanerGrade.F

    async def add_cleaning_review(
        self,
        cleaner_id: int,
        property_id: int,
        cleanliness_score: int,  # 1-5
        quickness_score: int,    # 1-5
        thoroughness_score: int = None,
        communication_score: int = None,
        scheduled_start: str = None,
        actual_start: str = None,
        actual_end: str = None,
        guest_comment: str = None,
        owner_notes: str = None,
        issues_found: List[str] = None,
        photos_taken: List[str] = None,
        reviewed_by: str = "system"
    ) -> Dict[str, Any]:
        """Add a cleaning review for a cleaner."""

        # Calculate timing metrics
        was_on_time = True
        cleaning_duration = None

        if scheduled_start and actual_start:
            sched = datetime.fromisoformat(scheduled_start)
            actual = datetime.fromisoformat(actual_start)
            was_on_time = actual <= sched + timedelta(minutes=15)

        if actual_start and actual_end:
            start = datetime.fromisoformat(actual_start)
            end = datetime.fromisoformat(actual_end)
            cleaning_duration = int((end - start).total_seconds() / 60)

        review_data = {
            "cleaner_id": cleaner_id,
            "property_id": property_id,
            "cleaning_date": datetime.utcnow().date().isoformat(),
            "reviewed_by": reviewed_by,

            # Scores
            "cleanliness_score": cleanliness_score,
            "quickness_score": quickness_score,
            "thoroughness_score": thoroughness_score or cleanliness_score,
            "communication_score": communication_score or 5,

            # Timing
            "scheduled_start": scheduled_start,
            "actual_start": actual_start,
            "actual_end": actual_end,
            "was_on_time": was_on_time,
            "cleaning_duration_minutes": cleaning_duration,

            # Details
            "guest_comment": guest_comment,
            "owner_notes": owner_notes,
            "issues_found": issues_found or [],
            "photos_taken": photos_taken or [],

            # Metadata
            "created_at": datetime.utcnow().isoformat()
        }

        if self.firebase_available and db:
            doc_ref = db.collection(self.reviews_collection).document()
            doc_ref.set(review_data)
            review_data["id"] = doc_ref.id

        # Update cleaner profile
        await self.update_cleaner_profile(cleaner_id)

        logger.info(f"Added cleaning review for cleaner {cleaner_id}: "
                   f"cleanliness={cleanliness_score}, quickness={quickness_score}")

        return {"success": True, "review": review_data}

    async def update_cleaner_profile(self, cleaner_id: int) -> Dict[str, Any]:
        """Recalculate cleaner's aggregate scores and grade."""
        if not self.firebase_available or not db:
            return {"error": "Firebase not available"}

        # Get all reviews for this cleaner
        docs = (
            db.collection(self.reviews_collection)
            .where("cleaner_id", "==", cleaner_id)
            .stream()
        )

        reviews = [doc.to_dict() for doc in docs]

        if not reviews:
            return {"error": "No reviews found"}

        # Calculate averages
        total = len(reviews)
        cleanliness_sum = sum(r.get("cleanliness_score", 0) for r in reviews)
        quickness_sum = sum(r.get("quickness_score", 0) for r in reviews)
        thoroughness_sum = sum(r.get("thoroughness_score", 0) for r in reviews)
        communication_sum = sum(r.get("communication_score", 0) for r in reviews)

        on_time_count = sum(1 for r in reviews if r.get("was_on_time", True))
        complaints = sum(1 for r in reviews if r.get("issues_found"))
        compliments = sum(1 for r in reviews if r.get("guest_comment") and
                         any(word in r.get("guest_comment", "").lower()
                             for word in ["great", "excellent", "amazing", "perfect", "best"]))

        # Durations
        durations = [r["cleaning_duration_minutes"] for r in reviews
                    if r.get("cleaning_duration_minutes")]
        avg_duration = sum(durations) / len(durations) if durations else None

        # Calculate overall average
        avg_cleanliness = cleanliness_sum / total
        avg_quickness = quickness_sum / total
        avg_thoroughness = thoroughness_sum / total
        avg_communication = communication_sum / total
        overall_avg = (avg_cleanliness + avg_quickness + avg_thoroughness + avg_communication) / 4

        profile = {
            "cleaner_id": cleaner_id,
            "avg_cleanliness_score": round(avg_cleanliness, 2),
            "avg_quickness_score": round(avg_quickness, 2),
            "avg_thoroughness_score": round(avg_thoroughness, 2),
            "avg_communication_score": round(avg_communication, 2),
            "overall_average": round(overall_avg, 2),
            "overall_grade": self._calculate_grade(overall_avg).value,
            "total_cleanings": total,
            "total_complaints": complaints,
            "total_compliments": compliments,
            "on_time_percentage": round((on_time_count / total) * 100, 1),
            "avg_cleaning_time_minutes": avg_duration,
            "updated_at": datetime.utcnow().isoformat()
        }

        # Store profile
        if self.firebase_available and db:
            doc_ref = db.collection(self.profiles_collection).document(str(cleaner_id))
            doc_ref.set(profile, merge=True)

        return {"success": True, "profile": profile}

    async def get_cleaner_profile(self, cleaner_id: int) -> Optional[Dict[str, Any]]:
        """Get a cleaner's profile."""
        if not self.firebase_available or not db:
            return None

        doc = db.collection(self.profiles_collection).document(str(cleaner_id)).get()
        return doc.to_dict() if doc.exists else None

    async def get_all_cleaner_rankings(self) -> List[Dict[str, Any]]:
        """Get all cleaners ranked by performance."""
        if not self.firebase_available or not db:
            return []

        docs = db.collection(self.profiles_collection).stream()
        profiles = [doc.to_dict() for doc in docs]

        # Sort by overall average
        profiles.sort(key=lambda x: x.get("overall_average", 0), reverse=True)

        # Add rank
        for i, profile in enumerate(profiles):
            profile["rank"] = i + 1

        return profiles

    async def get_cleaner_reviews(
        self,
        cleaner_id: int,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get recent reviews for a cleaner."""
        if not self.firebase_available or not db:
            return []

        docs = (
            db.collection(self.reviews_collection)
            .where("cleaner_id", "==", cleaner_id)
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )

        return [doc.to_dict() for doc in docs]

    async def get_cleaners_by_grade(self, grade: CleanerGrade) -> List[Dict[str, Any]]:
        """Get all cleaners with a specific grade."""
        if not self.firebase_available or not db:
            return []

        docs = (
            db.collection(self.profiles_collection)
            .where("overall_grade", "==", grade.value)
            .stream()
        )

        return [doc.to_dict() for doc in docs]


# Singleton instance
cleaner_grading_service = CleanerGradingService()
