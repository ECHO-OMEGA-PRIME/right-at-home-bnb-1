"""
Gap-Filler Discount Engine for Right At Home BnB
=================================================
Automatically detects booking gaps and generates special offers
to maximize occupancy and revenue.

Features:
- Scan all properties for booking gaps (3+ consecutive days)
- Calculate suggested discounts based on gap length
- Auto-generate SpecialOffer suggestions
- Integration with calendar sync for real-time gap detection
- Daily cron job support

Discount Tiers:
- 3-4 days: 10% off
- 5-7 days: 15% off
- 8-14 days: 20% off
- 15+ days: 25% off

ECHO OMEGA PRIME | Made for Steven Palma - Midland, TX
"""

import asyncio
import logging
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import Session

from database.connection import SessionLocal, get_db
from database.models import Property, Booking, BookingStatus
from database.models_financial import (
    BookingGap, SpecialOffer, SpecialOfferType,
    OperationalAlert, AlertType, AlertSeverity
)
from services.calendar_sync import (
    CalendarSyncService, get_calendar_sync_service, ParsedBooking
)

logger = logging.getLogger("RightAtHomeBnB.GapFiller")


class GapStatus(str, Enum):
    """Status of a booking gap."""
    PENDING = "pending"           # Gap detected, no offer created
    OFFER_CREATED = "offer_created"  # Offer generated, not published
    ACTIVE = "active"             # Offer published/active
    FILLED = "filled"             # Gap was booked
    EXPIRED = "expired"           # Gap date passed without booking


@dataclass
class GapAnalysis:
    """Analysis result for a detected gap."""
    property_id: str
    property_name: str
    gap_start: date
    gap_end: date
    gap_nights: int
    checkout_booking_id: Optional[str] = None
    checkin_booking_id: Optional[str] = None
    checkout_guest_name: Optional[str] = None
    checkin_guest_name: Optional[str] = None
    suggested_discount_pct: float = 10.0
    original_nightly_rate: Decimal = Decimal("0")
    discounted_rate: Decimal = Decimal("0")
    potential_revenue: Decimal = Decimal("0")
    days_until_gap: int = 0
    status: GapStatus = GapStatus.PENDING
    special_offer_id: Optional[int] = None


class DiscountTier:
    """Discount tier configuration."""

    # Discount rates based on gap length
    TIERS = [
        (3, 4, 10),    # 3-4 nights: 10% off
        (5, 7, 15),    # 5-7 nights: 15% off
        (8, 14, 20),   # 8-14 nights: 20% off
        (15, 999, 25), # 15+ nights: 25% off
    ]

    @classmethod
    def get_discount(cls, nights: int) -> float:
        """Get discount percentage for given number of nights."""
        for min_nights, max_nights, discount in cls.TIERS:
            if min_nights <= nights <= max_nights:
                return discount
        return 0

    @classmethod
    def get_tier_name(cls, nights: int) -> str:
        """Get human-readable tier name."""
        if nights <= 4:
            return "Short Stay"
        elif nights <= 7:
            return "Week Stay"
        elif nights <= 14:
            return "Extended Stay"
        else:
            return "Long Stay"


class GapFillerService:
    """
    Core service for gap detection and special offer generation.
    Scans bookings to find gaps and creates targeted discounts.
    """

    MIN_GAP_NIGHTS = 3  # Minimum gap to be considered for offers
    MAX_FUTURE_DAYS = 90  # How far ahead to scan for gaps
    DEFAULT_OFFER_VALID_DAYS = 7  # How long offers remain valid

    def __init__(self, db: Optional[Session] = None):
        self.db = db
        self._calendar_service: Optional[CalendarSyncService] = None

    def _get_db(self) -> Session:
        """Get database session."""
        if self.db:
            return self.db
        return SessionLocal()

    def _get_calendar_service(self) -> CalendarSyncService:
        """Get calendar sync service instance."""
        if self._calendar_service is None:
            self._calendar_service = get_calendar_sync_service()
        return self._calendar_service

    # =========================================================================
    # GAP DETECTION
    # =========================================================================

    async def scan_all_properties(self, days_ahead: int = 90) -> List[GapAnalysis]:
        """
        Scan all active properties for booking gaps.

        Args:
            days_ahead: How many days into the future to scan

        Returns:
            List of GapAnalysis objects for all detected gaps
        """
        db = self._get_db()
        all_gaps: List[GapAnalysis] = []

        try:
            # Get all active properties
            properties = db.query(Property).filter(
                Property.status == "ACTIVE"
            ).all()

            logger.info(f"Scanning {len(properties)} properties for booking gaps...")

            for prop in properties:
                gaps = await self.scan_property(
                    property_id=prop.id,
                    property_name=prop.name,
                    nightly_rate=Decimal(str(prop.nightly_rate or 100)),
                    days_ahead=days_ahead,
                    db=db
                )
                all_gaps.extend(gaps)

            logger.info(f"Found {len(all_gaps)} booking gaps across all properties")
            return all_gaps

        finally:
            if not self.db:
                db.close()

    async def scan_property(
        self,
        property_id: str,
        property_name: str = "",
        nightly_rate: Decimal = Decimal("100"),
        days_ahead: int = 90,
        db: Optional[Session] = None
    ) -> List[GapAnalysis]:
        """
        Scan a single property for booking gaps.

        Combines data from:
        1. Database bookings
        2. Calendar sync (Airbnb/VRBO iCal feeds)
        """
        db = db or self._get_db()
        gaps: List[GapAnalysis] = []

        today = date.today()
        scan_end = today + timedelta(days=days_ahead)

        # Get bookings from database
        db_bookings = self._get_db_bookings(property_id, today, scan_end, db)

        # Get bookings from calendar sync (if available)
        calendar_bookings = await self._get_calendar_bookings(property_id, today, scan_end)

        # Merge and deduplicate bookings
        all_bookings = self._merge_bookings(db_bookings, calendar_bookings)

        if not all_bookings:
            # If no bookings, the entire period is a gap
            if days_ahead >= self.MIN_GAP_NIGHTS:
                gap = GapAnalysis(
                    property_id=property_id,
                    property_name=property_name,
                    gap_start=today,
                    gap_end=scan_end,
                    gap_nights=(scan_end - today).days,
                    original_nightly_rate=nightly_rate,
                    days_until_gap=0
                )
                self._calculate_gap_pricing(gap)
                gaps.append(gap)
            return gaps

        # Sort bookings by check-in date
        all_bookings.sort(key=lambda b: b['check_in'])

        # Find gaps between bookings
        previous_checkout: Optional[date] = today
        previous_booking_id: Optional[str] = None
        previous_guest: Optional[str] = None

        for booking in all_bookings:
            check_in = booking['check_in']
            check_out = booking['check_out']
            booking_id = booking.get('id', '')
            guest_name = booking.get('guest_name', '')

            # Skip bookings that ended before today
            if check_out <= today:
                continue

            # Check for gap between previous checkout and this check-in
            if previous_checkout and check_in > previous_checkout:
                gap_nights = (check_in - previous_checkout).days

                if gap_nights >= self.MIN_GAP_NIGHTS:
                    gap = GapAnalysis(
                        property_id=property_id,
                        property_name=property_name,
                        gap_start=previous_checkout,
                        gap_end=check_in,
                        gap_nights=gap_nights,
                        checkout_booking_id=previous_booking_id,
                        checkin_booking_id=booking_id,
                        checkout_guest_name=previous_guest,
                        checkin_guest_name=guest_name,
                        original_nightly_rate=nightly_rate,
                        days_until_gap=(previous_checkout - today).days
                    )
                    self._calculate_gap_pricing(gap)
                    gaps.append(gap)

            previous_checkout = check_out
            previous_booking_id = booking_id
            previous_guest = guest_name

        # Check for gap after last booking
        if previous_checkout and previous_checkout < scan_end:
            gap_nights = (scan_end - previous_checkout).days

            if gap_nights >= self.MIN_GAP_NIGHTS:
                gap = GapAnalysis(
                    property_id=property_id,
                    property_name=property_name,
                    gap_start=previous_checkout,
                    gap_end=scan_end,
                    gap_nights=gap_nights,
                    checkout_booking_id=previous_booking_id,
                    checkout_guest_name=previous_guest,
                    original_nightly_rate=nightly_rate,
                    days_until_gap=(previous_checkout - today).days
                )
                self._calculate_gap_pricing(gap)
                gaps.append(gap)

        return gaps

    def _get_db_bookings(
        self,
        property_id: str,
        start_date: date,
        end_date: date,
        db: Session
    ) -> List[Dict[str, Any]]:
        """Get bookings from database."""
        bookings = db.query(Booking).filter(
            and_(
                Booking.property_id == property_id,
                Booking.status.in_([
                    BookingStatus.CONFIRMED,
                    BookingStatus.CHECKED_IN,
                    BookingStatus.PENDING
                ]),
                Booking.check_out > start_date,
                Booking.check_in < end_date
            )
        ).all()

        result = []
        for b in bookings:
            result.append({
                'id': b.id,
                'check_in': b.check_in.date() if isinstance(b.check_in, datetime) else b.check_in,
                'check_out': b.check_out.date() if isinstance(b.check_out, datetime) else b.check_out,
                'guest_name': b.guest.name if b.guest else None,
                'source': 'database'
            })

        return result

    async def _get_calendar_bookings(
        self,
        property_id: str,
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """Get bookings from calendar sync service."""
        try:
            calendar_service = self._get_calendar_service()

            # Convert dates to datetime for calendar service
            start_dt = datetime.combine(start_date, datetime.min.time())
            end_dt = datetime.combine(end_date, datetime.max.time())

            parsed_bookings = calendar_service.get_bookings(
                property_id=property_id,
                start_date=start_dt,
                end_date=end_dt
            )

            result = []
            for b in parsed_bookings:
                result.append({
                    'id': b.uid,
                    'check_in': b.start_date.date() if isinstance(b.start_date, datetime) else b.start_date,
                    'check_out': b.end_date.date() if isinstance(b.end_date, datetime) else b.end_date,
                    'guest_name': b.guest_name,
                    'source': 'calendar',
                    'platform': b.platform.value
                })

            return result

        except Exception as e:
            logger.warning(f"Could not get calendar bookings for {property_id}: {e}")
            return []

    def _merge_bookings(
        self,
        db_bookings: List[Dict[str, Any]],
        calendar_bookings: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Merge and deduplicate bookings from multiple sources."""
        # Use date ranges as keys for deduplication
        seen_ranges: Dict[Tuple[date, date], Dict[str, Any]] = {}

        # DB bookings take precedence
        for b in db_bookings:
            key = (b['check_in'], b['check_out'])
            seen_ranges[key] = b

        # Add calendar bookings if not overlapping with DB bookings
        for b in calendar_bookings:
            key = (b['check_in'], b['check_out'])
            if key not in seen_ranges:
                # Check for partial overlaps
                overlap = False
                for existing_key in seen_ranges.keys():
                    if self._dates_overlap(key, existing_key):
                        overlap = True
                        break

                if not overlap:
                    seen_ranges[key] = b

        return list(seen_ranges.values())

    def _dates_overlap(
        self,
        range1: Tuple[date, date],
        range2: Tuple[date, date]
    ) -> bool:
        """Check if two date ranges overlap."""
        start1, end1 = range1
        start2, end2 = range2
        return start1 < end2 and start2 < end1

    def _calculate_gap_pricing(self, gap: GapAnalysis) -> None:
        """Calculate pricing details for a gap."""
        discount_pct = DiscountTier.get_discount(gap.gap_nights)
        gap.suggested_discount_pct = discount_pct

        discount_multiplier = Decimal(str(1 - discount_pct / 100))
        gap.discounted_rate = gap.original_nightly_rate * discount_multiplier
        gap.potential_revenue = gap.discounted_rate * Decimal(str(gap.gap_nights))

    # =========================================================================
    # BOOKING GAP RECORDS
    # =========================================================================

    async def save_gaps_to_db(self, gaps: List[GapAnalysis]) -> List[BookingGap]:
        """Save detected gaps to database."""
        db = self._get_db()
        saved_gaps: List[BookingGap] = []

        try:
            for gap in gaps:
                # Check if gap already exists
                existing = db.query(BookingGap).filter(
                    and_(
                        BookingGap.property_id == gap.property_id,
                        BookingGap.gap_start == gap.gap_start,
                        BookingGap.gap_end == gap.gap_end
                    )
                ).first()

                if existing:
                    # Update existing gap
                    existing.gap_nights = gap.gap_nights
                    existing.checkout_booking_id = gap.checkout_booking_id
                    existing.checkin_booking_id = gap.checkin_booking_id
                    existing.potential_revenue = gap.potential_revenue
                    existing.is_gap_filler_eligible = gap.gap_nights >= self.MIN_GAP_NIGHTS
                    existing.updated_at = datetime.now()
                    saved_gaps.append(existing)
                else:
                    # Create new gap record
                    db_gap = BookingGap(
                        property_id=gap.property_id,
                        gap_start=gap.gap_start,
                        gap_end=gap.gap_end,
                        gap_nights=gap.gap_nights,
                        checkout_booking_id=gap.checkout_booking_id,
                        checkin_booking_id=gap.checkin_booking_id,
                        is_gap_filler_eligible=gap.gap_nights >= self.MIN_GAP_NIGHTS,
                        potential_revenue=gap.potential_revenue
                    )
                    db.add(db_gap)
                    saved_gaps.append(db_gap)

            db.commit()
            logger.info(f"Saved {len(saved_gaps)} gaps to database")
            return saved_gaps

        except Exception as e:
            db.rollback()
            logger.error(f"Error saving gaps to database: {e}")
            raise
        finally:
            if not self.db:
                db.close()

    def get_gaps(
        self,
        property_id: Optional[str] = None,
        include_filled: bool = False,
        future_only: bool = True,
        db: Optional[Session] = None
    ) -> List[BookingGap]:
        """Get booking gaps from database."""
        db = db or self._get_db()

        try:
            query = db.query(BookingGap)

            if property_id:
                query = query.filter(BookingGap.property_id == property_id)

            if not include_filled:
                query = query.filter(BookingGap.was_filled == False)

            if future_only:
                query = query.filter(BookingGap.gap_start >= date.today())

            query = query.order_by(BookingGap.gap_start.asc())

            return query.all()

        finally:
            if not self.db and db:
                db.close()

    # =========================================================================
    # SPECIAL OFFER GENERATION
    # =========================================================================

    async def create_offer_from_gap(
        self,
        gap_id: int,
        min_nights: int = 2,
        valid_days: int = 7,
        custom_discount: Optional[float] = None,
        auto_publish: bool = False,
        db: Optional[Session] = None
    ) -> SpecialOffer:
        """
        Create a SpecialOffer from a BookingGap.

        Args:
            gap_id: ID of the BookingGap record
            min_nights: Minimum nights required to book
            valid_days: How many days the offer is valid
            custom_discount: Override the suggested discount percentage
            auto_publish: Immediately activate the offer
        """
        db = db or self._get_db()

        try:
            # Get the gap
            gap = db.query(BookingGap).filter(BookingGap.id == gap_id).first()
            if not gap:
                raise ValueError(f"Gap {gap_id} not found")

            # Get property details
            prop = db.query(Property).filter(Property.id == gap.property_id).first()
            if not prop:
                raise ValueError(f"Property {gap.property_id} not found")

            # Calculate pricing
            nightly_rate = Decimal(str(prop.nightly_rate or 100))
            discount_pct = custom_discount or DiscountTier.get_discount(gap.gap_nights)
            discount_multiplier = Decimal(str(1 - discount_pct / 100))
            discounted_rate = nightly_rate * discount_multiplier
            total_savings = (nightly_rate - discounted_rate) * Decimal(str(gap.gap_nights))

            # Create the offer
            tier_name = DiscountTier.get_tier_name(gap.gap_nights)
            offer = SpecialOffer(
                property_id=gap.property_id,
                offer_type=SpecialOfferType.GAP_FILLER,
                title=f"{tier_name} Deal - {int(discount_pct)}% Off",
                description=(
                    f"Fill this {gap.gap_nights}-night gap and save {int(discount_pct)}%! "
                    f"Book now and pay only ${discounted_rate:.2f}/night instead of ${nightly_rate:.2f}/night."
                ),
                start_date=gap.gap_start,
                end_date=gap.gap_end,
                nights_available=gap.gap_nights,
                original_nightly_rate=nightly_rate,
                discounted_rate=discounted_rate,
                discount_percentage=discount_pct,
                total_savings=total_savings,
                is_active=auto_publish,
                is_auto_generated=True,
                generation_reason=f"Gap-Filler: {gap.gap_nights} nights between bookings",
                gap_before_booking_id=gap.checkout_booking_id,
                gap_after_booking_id=gap.checkin_booking_id,
                expires_at=datetime.now() + timedelta(days=valid_days)
            )

            db.add(offer)
            db.flush()  # Get the offer ID

            # Link the gap to the offer
            gap.special_offer_id = offer.id

            db.commit()
            logger.info(f"Created special offer {offer.id} for gap {gap_id}")

            return offer

        except Exception as e:
            db.rollback()
            logger.error(f"Error creating offer from gap: {e}")
            raise
        finally:
            if not self.db and db:
                db.close()

    async def generate_all_offers(
        self,
        min_nights: int = 2,
        valid_days: int = 7,
        auto_publish: bool = False
    ) -> List[SpecialOffer]:
        """Generate offers for all eligible gaps without offers."""
        db = self._get_db()
        offers: List[SpecialOffer] = []

        try:
            # Find gaps without offers
            gaps = db.query(BookingGap).filter(
                and_(
                    BookingGap.is_gap_filler_eligible == True,
                    BookingGap.special_offer_id == None,
                    BookingGap.was_filled == False,
                    BookingGap.gap_start > date.today()
                )
            ).all()

            for gap in gaps:
                try:
                    offer = await self.create_offer_from_gap(
                        gap_id=gap.id,
                        min_nights=min_nights,
                        valid_days=valid_days,
                        auto_publish=auto_publish,
                        db=db
                    )
                    offers.append(offer)
                except Exception as e:
                    logger.error(f"Failed to create offer for gap {gap.id}: {e}")

            logger.info(f"Generated {len(offers)} new special offers")
            return offers

        finally:
            if not self.db:
                db.close()

    # =========================================================================
    # OFFER MANAGEMENT
    # =========================================================================

    def get_offers(
        self,
        property_id: Optional[str] = None,
        active_only: bool = True,
        offer_type: Optional[SpecialOfferType] = None,
        db: Optional[Session] = None
    ) -> List[SpecialOffer]:
        """Get special offers from database."""
        db = db or self._get_db()

        try:
            query = db.query(SpecialOffer)

            if property_id:
                query = query.filter(SpecialOffer.property_id == property_id)

            if active_only:
                query = query.filter(
                    and_(
                        SpecialOffer.is_active == True,
                        SpecialOffer.is_booked == False,
                        SpecialOffer.end_date >= date.today()
                    )
                )

            if offer_type:
                query = query.filter(SpecialOffer.offer_type == offer_type)

            query = query.order_by(SpecialOffer.start_date.asc())

            return query.all()

        finally:
            if not self.db and db:
                db.close()

    def activate_offer(self, offer_id: int, db: Optional[Session] = None) -> SpecialOffer:
        """Activate/publish a special offer."""
        db = db or self._get_db()

        try:
            offer = db.query(SpecialOffer).filter(SpecialOffer.id == offer_id).first()
            if not offer:
                raise ValueError(f"Offer {offer_id} not found")

            offer.is_active = True
            offer.pushed_to_website = True
            offer.push_date = datetime.now()

            db.commit()
            logger.info(f"Activated offer {offer_id}")
            return offer

        except Exception as e:
            db.rollback()
            raise
        finally:
            if not self.db and db:
                db.close()

    def deactivate_offer(self, offer_id: int, db: Optional[Session] = None) -> SpecialOffer:
        """Deactivate/cancel a special offer."""
        db = db or self._get_db()

        try:
            offer = db.query(SpecialOffer).filter(SpecialOffer.id == offer_id).first()
            if not offer:
                raise ValueError(f"Offer {offer_id} not found")

            offer.is_active = False

            db.commit()
            logger.info(f"Deactivated offer {offer_id}")
            return offer

        except Exception as e:
            db.rollback()
            raise
        finally:
            if not self.db and db:
                db.close()

    def mark_offer_booked(
        self,
        offer_id: int,
        booking_id: str,
        db: Optional[Session] = None
    ) -> SpecialOffer:
        """Mark an offer as booked and update the gap status."""
        db = db or self._get_db()

        try:
            offer = db.query(SpecialOffer).filter(SpecialOffer.id == offer_id).first()
            if not offer:
                raise ValueError(f"Offer {offer_id} not found")

            offer.is_booked = True
            offer.is_active = False
            offer.booking_id = booking_id

            # Update the linked gap
            gap = db.query(BookingGap).filter(
                BookingGap.special_offer_id == offer_id
            ).first()

            if gap:
                gap.was_filled = True

            db.commit()
            logger.info(f"Marked offer {offer_id} as booked with booking {booking_id}")
            return offer

        except Exception as e:
            db.rollback()
            raise
        finally:
            if not self.db and db:
                db.close()

    # =========================================================================
    # ALERTS
    # =========================================================================

    async def create_gap_alert(
        self,
        gap: GapAnalysis,
        db: Optional[Session] = None
    ) -> OperationalAlert:
        """Create an operational alert for a significant gap."""
        db = db or self._get_db()

        try:
            # Determine severity based on gap size and urgency
            if gap.days_until_gap <= 7:
                severity = AlertSeverity.WARNING
            elif gap.gap_nights >= 7:
                severity = AlertSeverity.WARNING
            else:
                severity = AlertSeverity.INFO

            alert = OperationalAlert(
                property_id=gap.property_id,
                alert_type=AlertType.BOOKING_GAP,
                severity=severity,
                title=f"{gap.gap_nights}-Night Gap at {gap.property_name}",
                description=(
                    f"Booking gap detected from {gap.gap_start} to {gap.gap_end}. "
                    f"Suggested discount: {gap.suggested_discount_pct}%. "
                    f"Potential revenue: ${gap.potential_revenue:.2f}."
                ),
                trigger_data={
                    "property_id": gap.property_id,
                    "property_name": gap.property_name,
                    "gap_start": gap.gap_start.isoformat(),
                    "gap_end": gap.gap_end.isoformat(),
                    "gap_nights": gap.gap_nights,
                    "discount_pct": gap.suggested_discount_pct,
                    "potential_revenue": float(gap.potential_revenue)
                },
                threshold_value=self.MIN_GAP_NIGHTS,
                actual_value=gap.gap_nights
            )

            db.add(alert)
            db.commit()

            return alert

        except Exception as e:
            db.rollback()
            logger.error(f"Error creating gap alert: {e}")
            raise
        finally:
            if not self.db and db:
                db.close()

    # =========================================================================
    # DAILY CRON JOB
    # =========================================================================

    async def run_daily_scan(self) -> Dict[str, Any]:
        """
        Run the daily gap detection scan.
        Called by the cron job scheduler.

        Returns summary of findings and actions taken.
        """
        logger.info("Starting daily gap scan...")
        start_time = datetime.now()

        summary = {
            "scan_date": date.today().isoformat(),
            "properties_scanned": 0,
            "gaps_found": 0,
            "gaps_saved": 0,
            "offers_generated": 0,
            "alerts_created": 0,
            "errors": [],
            "duration_seconds": 0
        }

        try:
            # Scan all properties
            gaps = await self.scan_all_properties(days_ahead=self.MAX_FUTURE_DAYS)
            summary["gaps_found"] = len(gaps)

            # Save gaps to database
            if gaps:
                saved_gaps = await self.save_gaps_to_db(gaps)
                summary["gaps_saved"] = len(saved_gaps)

                # Generate offers for new gaps
                offers = await self.generate_all_offers(auto_publish=False)
                summary["offers_generated"] = len(offers)

                # Create alerts for urgent gaps (within 7 days)
                for gap in gaps:
                    if gap.days_until_gap <= 7 and gap.gap_nights >= self.MIN_GAP_NIGHTS:
                        try:
                            await self.create_gap_alert(gap)
                            summary["alerts_created"] += 1
                        except Exception as e:
                            summary["errors"].append(f"Alert creation failed: {e}")

        except Exception as e:
            logger.error(f"Daily gap scan error: {e}")
            summary["errors"].append(str(e))

        summary["duration_seconds"] = (datetime.now() - start_time).total_seconds()

        logger.info(
            f"Daily gap scan complete: {summary['gaps_found']} gaps found, "
            f"{summary['offers_generated']} offers generated"
        )

        return summary


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_gap_filler_service: Optional[GapFillerService] = None


def get_gap_filler_service() -> GapFillerService:
    """Get the singleton GapFillerService instance."""
    global _gap_filler_service
    if _gap_filler_service is None:
        _gap_filler_service = GapFillerService()
    return _gap_filler_service


async def run_daily_gap_scan() -> Dict[str, Any]:
    """Entry point for cron job."""
    service = get_gap_filler_service()
    return await service.run_daily_scan()
