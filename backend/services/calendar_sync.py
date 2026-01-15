"""
Calendar Sync Service for Right at Home BnB
Syncs bookings from Airbnb, VRBO, and other iCal sources.

Features:
- iCal parsing for Airbnb and VRBO calendar feeds
- Booking extraction with guest info
- Conflict detection between platforms
- Auto-sync scheduler (every 15 minutes)
- Manual sync triggers
- Sync status tracking per property

ECHO OMEGA PRIME | Made by Commander Bobby Don McWilliams II
"""

import asyncio
import logging
import re
import hashlib
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import httpx
from icalendar import Calendar, Event
from dateutil.parser import parse as parse_date
from dateutil.rrule import rrulestr
import pytz
from sqlalchemy.orm import Session

logger = logging.getLogger("RightAtHomeBnB.CalendarSync")


class BookingPlatform(str, Enum):
    """Supported booking platforms"""
    AIRBNB = "airbnb"
    VRBO = "vrbo"
    BOOKING = "booking"
    DIRECT = "direct"
    OTHER = "other"


class SyncStatus(str, Enum):
    """Sync operation status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


@dataclass
class ParsedBooking:
    """Represents a parsed booking from iCal"""
    uid: str
    summary: str
    description: str
    start_date: datetime
    end_date: datetime
    platform: BookingPlatform
    confirmation_code: Optional[str] = None
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    num_guests: int = 1
    total_price: Optional[float] = None
    currency: str = "USD"
    special_requests: Optional[str] = None
    raw_event: Optional[Dict[str, Any]] = None


@dataclass
class CalendarFeed:
    """Represents an iCal feed configuration"""
    property_id: str
    platform: BookingPlatform
    url: str
    enabled: bool = True
    last_sync: Optional[datetime] = None
    last_status: SyncStatus = SyncStatus.PENDING
    last_error: Optional[str] = None
    sync_interval_minutes: int = 15


@dataclass
class SyncResult:
    """Result of a sync operation"""
    property_id: str
    platform: BookingPlatform
    status: SyncStatus
    bookings_found: int = 0
    bookings_new: int = 0
    bookings_updated: int = 0
    bookings_removed: int = 0
    conflicts_detected: int = 0
    error_message: Optional[str] = None
    sync_duration_seconds: float = 0.0
    synced_at: datetime = field(default_factory=datetime.now)


@dataclass
class BookingConflict:
    """Represents a booking conflict between platforms"""
    property_id: str
    booking1_uid: str
    booking1_platform: BookingPlatform
    booking1_dates: Tuple[datetime, datetime]
    booking2_uid: str
    booking2_platform: BookingPlatform
    booking2_dates: Tuple[datetime, datetime]
    overlap_start: datetime
    overlap_end: datetime
    detected_at: datetime = field(default_factory=datetime.now)


class ICalParser:
    """
    Parses iCal feeds from various booking platforms.
    Handles platform-specific formats for Airbnb, VRBO, etc.
    """

    # Airbnb summary patterns
    AIRBNB_RESERVED_PATTERN = re.compile(r"Reserved|Airbnb \(Not available\)", re.IGNORECASE)
    AIRBNB_BLOCKED_PATTERN = re.compile(r"Blocked|Not available", re.IGNORECASE)

    # VRBO summary patterns
    VRBO_RESERVED_PATTERN = re.compile(r"Reserved|VRBO|HomeAway", re.IGNORECASE)
    VRBO_BLOCKED_PATTERN = re.compile(r"Blocked|Owner Block|Maintenance", re.IGNORECASE)

    # Guest name extraction patterns
    GUEST_NAME_PATTERNS = [
        re.compile(r"(?:Guest|Reserved by|Booked by|Name)[:\s]+([A-Za-z\s\-']+)", re.IGNORECASE),
        re.compile(r"^([A-Za-z\-']+(?:\s+[A-Za-z\-']+)+)$", re.MULTILINE),
    ]

    # Phone extraction
    PHONE_PATTERN = re.compile(r"(?:Phone|Tel|Mobile)[:\s]*([\+\d\s\-\(\)]+)", re.IGNORECASE)

    # Email extraction
    EMAIL_PATTERN = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+")

    # Confirmation code patterns
    CONFIRMATION_PATTERNS = [
        re.compile(r"(?:Confirmation|Conf|Code|Reservation)[#:\s]*([A-Z0-9]{6,})", re.IGNORECASE),
        re.compile(r"HM[A-Z0-9]{6,}", re.IGNORECASE),  # Airbnb format
        re.compile(r"HA-[A-Z0-9]+", re.IGNORECASE),  # VRBO format
    ]

    # Guest count patterns
    GUEST_COUNT_PATTERN = re.compile(r"(\d+)\s*(?:guests?|adults?|people)", re.IGNORECASE)

    # Price patterns
    PRICE_PATTERN = re.compile(r"(?:Total|Price|Amount)[:\s]*\$?([\d,]+\.?\d*)", re.IGNORECASE)

    def __init__(self, timezone: str = "America/Chicago"):
        self.timezone = pytz.timezone(timezone)

    def parse_ical_content(self, content: str, platform: BookingPlatform) -> List[ParsedBooking]:
        """
        Parse iCal content string and extract bookings.

        Args:
            content: Raw iCal content string
            platform: The booking platform this feed is from

        Returns:
            List of ParsedBooking objects
        """
        try:
            calendar = Calendar.from_ical(content)
        except Exception as e:
            logger.error(f"Failed to parse iCal content: {e}")
            return []

        bookings = []

        for component in calendar.walk():
            if component.name == "VEVENT":
                booking = self._parse_event(component, platform)
                if booking and not self._is_blocked_time(booking):
                    bookings.append(booking)

        logger.info(f"Parsed {len(bookings)} bookings from {platform.value} calendar")
        return bookings

    def _parse_event(self, event: Event, platform: BookingPlatform) -> Optional[ParsedBooking]:
        """Parse a single VEVENT component into a ParsedBooking"""
        try:
            # Get basic event properties
            uid = str(event.get("UID", ""))
            summary = str(event.get("SUMMARY", ""))
            description = str(event.get("DESCRIPTION", ""))

            # Parse dates
            dtstart = event.get("DTSTART")
            dtend = event.get("DTEND")

            if not dtstart:
                return None

            start_date = self._normalize_datetime(dtstart.dt)
            end_date = self._normalize_datetime(dtend.dt) if dtend else start_date + timedelta(days=1)

            # Skip events in the past (more than 30 days ago)
            if end_date < datetime.now(self.timezone) - timedelta(days=30):
                return None

            # Create booking object
            booking = ParsedBooking(
                uid=uid or self._generate_uid(summary, start_date),
                summary=summary,
                description=description,
                start_date=start_date,
                end_date=end_date,
                platform=platform,
            )

            # Extract platform-specific details
            if platform == BookingPlatform.AIRBNB:
                self._extract_airbnb_details(booking, summary, description)
            elif platform == BookingPlatform.VRBO:
                self._extract_vrbo_details(booking, summary, description)
            else:
                self._extract_generic_details(booking, summary, description)

            # Store raw event data
            booking.raw_event = {
                "uid": uid,
                "summary": summary,
                "description": description,
                "dtstart": start_date.isoformat(),
                "dtend": end_date.isoformat(),
            }

            return booking

        except Exception as e:
            logger.error(f"Failed to parse event: {e}")
            return None

    def _normalize_datetime(self, dt) -> datetime:
        """Normalize a datetime object to the configured timezone"""
        if isinstance(dt, date) and not isinstance(dt, datetime):
            dt = datetime.combine(dt, datetime.min.time())

        if dt.tzinfo is None:
            dt = self.timezone.localize(dt)
        else:
            dt = dt.astimezone(self.timezone)

        return dt

    def _generate_uid(self, summary: str, start_date: datetime) -> str:
        """Generate a unique ID for events without one"""
        content = f"{summary}{start_date.isoformat()}"
        return hashlib.md5(content.encode()).hexdigest()

    def _is_blocked_time(self, booking: ParsedBooking) -> bool:
        """Check if this is a blocked time slot rather than a real booking"""
        summary_lower = booking.summary.lower()
        blocked_keywords = ["blocked", "not available", "maintenance", "owner", "hold"]
        return any(keyword in summary_lower for keyword in blocked_keywords)

    def _extract_airbnb_details(self, booking: ParsedBooking, summary: str, description: str) -> None:
        """Extract Airbnb-specific booking details"""
        combined_text = f"{summary}\n{description}"

        # Guest name from Airbnb format: "Reserved - Guest Name"
        if " - " in summary:
            parts = summary.split(" - ", 1)
            if len(parts) > 1:
                potential_name = parts[1].strip()
                if not any(word in potential_name.lower() for word in ["blocked", "not available"]):
                    booking.guest_name = potential_name

        # Try description patterns if no name found
        if not booking.guest_name:
            booking.guest_name = self._extract_guest_name(combined_text)

        # Extract confirmation code (Airbnb uses HM prefix)
        for pattern in self.CONFIRMATION_PATTERNS:
            match = pattern.search(combined_text)
            if match:
                booking.confirmation_code = match.group(1) if match.lastindex else match.group(0)
                break

        # Extract other details
        booking.guest_phone = self._extract_phone(combined_text)
        booking.guest_email = self._extract_email(combined_text)
        booking.num_guests = self._extract_guest_count(combined_text) or 1
        booking.total_price = self._extract_price(combined_text)
        booking.special_requests = self._extract_special_requests(description)

    def _extract_vrbo_details(self, booking: ParsedBooking, summary: str, description: str) -> None:
        """Extract VRBO-specific booking details"""
        combined_text = f"{summary}\n{description}"

        # VRBO format varies, try multiple approaches
        booking.guest_name = self._extract_guest_name(combined_text)

        # VRBO confirmation codes often have HA- prefix
        for pattern in self.CONFIRMATION_PATTERNS:
            match = pattern.search(combined_text)
            if match:
                booking.confirmation_code = match.group(1) if match.lastindex else match.group(0)
                break

        # Extract other details
        booking.guest_phone = self._extract_phone(combined_text)
        booking.guest_email = self._extract_email(combined_text)
        booking.num_guests = self._extract_guest_count(combined_text) or 1
        booking.total_price = self._extract_price(combined_text)
        booking.special_requests = self._extract_special_requests(description)

    def _extract_generic_details(self, booking: ParsedBooking, summary: str, description: str) -> None:
        """Extract booking details from generic iCal format"""
        combined_text = f"{summary}\n{description}"

        booking.guest_name = self._extract_guest_name(combined_text)
        booking.guest_phone = self._extract_phone(combined_text)
        booking.guest_email = self._extract_email(combined_text)
        booking.num_guests = self._extract_guest_count(combined_text) or 1
        booking.total_price = self._extract_price(combined_text)
        booking.special_requests = self._extract_special_requests(description)

    def _extract_guest_name(self, text: str) -> Optional[str]:
        """Extract guest name from text"""
        for pattern in self.GUEST_NAME_PATTERNS:
            match = pattern.search(text)
            if match:
                name = match.group(1).strip()
                # Validate it looks like a name
                if len(name) > 2 and " " in name or len(name) > 5:
                    return name
        return None

    def _extract_phone(self, text: str) -> Optional[str]:
        """Extract phone number from text"""
        match = self.PHONE_PATTERN.search(text)
        if match:
            phone = re.sub(r"[^\d\+]", "", match.group(1))
            if len(phone) >= 10:
                return phone
        return None

    def _extract_email(self, text: str) -> Optional[str]:
        """Extract email from text"""
        match = self.EMAIL_PATTERN.search(text)
        return match.group(0) if match else None

    def _extract_guest_count(self, text: str) -> Optional[int]:
        """Extract number of guests from text"""
        match = self.GUEST_COUNT_PATTERN.search(text)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass
        return None

    def _extract_price(self, text: str) -> Optional[float]:
        """Extract total price from text"""
        match = self.PRICE_PATTERN.search(text)
        if match:
            try:
                return float(match.group(1).replace(",", ""))
            except ValueError:
                pass
        return None

    def _extract_special_requests(self, description: str) -> Optional[str]:
        """Extract special requests or notes from description"""
        if not description:
            return None

        # Look for common request indicators
        request_patterns = [
            re.compile(r"(?:Notes?|Special Requests?|Comments?)[:\s]*(.+)", re.IGNORECASE | re.DOTALL),
        ]

        for pattern in request_patterns:
            match = pattern.search(description)
            if match:
                return match.group(1).strip()[:500]  # Limit length

        return None


class CalendarSyncService:
    """
    Main service for syncing calendars from multiple booking platforms.
    Handles fetching, parsing, conflict detection, and database updates.
    """

    # In-memory storage for sync state (would use Redis in production)
    _feeds: Dict[str, List[CalendarFeed]] = {}
    _sync_results: Dict[str, SyncResult] = {}
    _conflicts: List[BookingConflict] = []
    _bookings: Dict[str, Dict[str, ParsedBooking]] = {}  # property_id -> {uid -> booking}
    _scheduler_running: bool = False
    _scheduler_task: Optional[asyncio.Task] = None

    HTTP_TIMEOUT = 30.0
    MAX_RETRIES = 3
    RETRY_DELAY = 5.0

    def __init__(self, db_session: Optional[Session] = None):
        self.db = db_session
        self.parser = ICalParser()
        self.http_client = httpx.AsyncClient(timeout=self.HTTP_TIMEOUT)

    async def close(self):
        """Close HTTP client"""
        await self.http_client.aclose()

    # =========================================================================
    # FEED MANAGEMENT
    # =========================================================================

    def add_feed(self, property_id: str, platform: BookingPlatform, url: str) -> CalendarFeed:
        """Add a calendar feed for a property"""
        feed = CalendarFeed(
            property_id=property_id,
            platform=platform,
            url=url,
        )

        if property_id not in self._feeds:
            self._feeds[property_id] = []

        # Remove existing feed for same platform
        self._feeds[property_id] = [f for f in self._feeds[property_id] if f.platform != platform]
        self._feeds[property_id].append(feed)

        logger.info(f"Added {platform.value} feed for property {property_id}")
        return feed

    def remove_feed(self, property_id: str, platform: BookingPlatform) -> bool:
        """Remove a calendar feed"""
        if property_id in self._feeds:
            original_count = len(self._feeds[property_id])
            self._feeds[property_id] = [f for f in self._feeds[property_id] if f.platform != platform]
            removed = original_count != len(self._feeds[property_id])
            if removed:
                logger.info(f"Removed {platform.value} feed for property {property_id}")
            return removed
        return False

    def get_feeds(self, property_id: str) -> List[CalendarFeed]:
        """Get all feeds for a property"""
        return self._feeds.get(property_id, [])

    def get_all_feeds(self) -> Dict[str, List[CalendarFeed]]:
        """Get all configured feeds"""
        return self._feeds.copy()

    # =========================================================================
    # SYNC OPERATIONS
    # =========================================================================

    async def sync_feed(self, feed: CalendarFeed) -> SyncResult:
        """
        Sync a single calendar feed.
        Fetches the iCal, parses it, and updates the booking store.
        """
        start_time = datetime.now()
        result = SyncResult(
            property_id=feed.property_id,
            platform=feed.platform,
            status=SyncStatus.IN_PROGRESS,
        )

        try:
            # Fetch iCal content
            content = await self._fetch_ical(feed.url)
            if not content:
                raise Exception("Empty calendar response")

            # Parse bookings
            bookings = self.parser.parse_ical_content(content, feed.platform)
            result.bookings_found = len(bookings)

            # Initialize property booking store
            if feed.property_id not in self._bookings:
                self._bookings[feed.property_id] = {}

            # Track existing UIDs for this platform
            existing_uids = {
                uid for uid, b in self._bookings[feed.property_id].items()
                if b.platform == feed.platform
            }
            new_uids = set()

            # Process bookings
            for booking in bookings:
                new_uids.add(booking.uid)
                if booking.uid in self._bookings[feed.property_id]:
                    # Update existing
                    old_booking = self._bookings[feed.property_id][booking.uid]
                    if self._booking_changed(old_booking, booking):
                        self._bookings[feed.property_id][booking.uid] = booking
                        result.bookings_updated += 1
                else:
                    # New booking
                    self._bookings[feed.property_id][booking.uid] = booking
                    result.bookings_new += 1

            # Remove bookings no longer in feed
            removed_uids = existing_uids - new_uids
            for uid in removed_uids:
                del self._bookings[feed.property_id][uid]
                result.bookings_removed += 1

            # Update feed status
            feed.last_sync = datetime.now()
            feed.last_status = SyncStatus.SUCCESS
            feed.last_error = None

            result.status = SyncStatus.SUCCESS

        except Exception as e:
            logger.error(f"Sync failed for {feed.platform.value} feed on property {feed.property_id}: {e}")
            feed.last_status = SyncStatus.FAILED
            feed.last_error = str(e)
            result.status = SyncStatus.FAILED
            result.error_message = str(e)

        result.sync_duration_seconds = (datetime.now() - start_time).total_seconds()
        result.synced_at = datetime.now()

        # Store result
        self._sync_results[f"{feed.property_id}:{feed.platform.value}"] = result

        return result

    async def sync_property(self, property_id: str) -> List[SyncResult]:
        """Sync all feeds for a property"""
        feeds = self.get_feeds(property_id)
        if not feeds:
            logger.warning(f"No feeds configured for property {property_id}")
            return []

        results = []
        for feed in feeds:
            if feed.enabled:
                result = await self.sync_feed(feed)
                results.append(result)

        # Detect conflicts after syncing all feeds
        conflicts = self.detect_conflicts(property_id)
        for result in results:
            result.conflicts_detected = len(conflicts)

        return results

    async def sync_all(self) -> Dict[str, List[SyncResult]]:
        """Sync all configured feeds"""
        all_results = {}

        for property_id in self._feeds.keys():
            results = await self.sync_property(property_id)
            all_results[property_id] = results

        logger.info(f"Synced {len(all_results)} properties")
        return all_results

    async def _fetch_ical(self, url: str) -> str:
        """Fetch iCal content from URL with retries"""
        last_error = None

        for attempt in range(self.MAX_RETRIES):
            try:
                response = await self.http_client.get(url)
                response.raise_for_status()
                return response.text
            except Exception as e:
                last_error = e
                logger.warning(f"iCal fetch attempt {attempt + 1} failed: {e}")
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(self.RETRY_DELAY)

        raise Exception(f"Failed to fetch iCal after {self.MAX_RETRIES} attempts: {last_error}")

    def _booking_changed(self, old: ParsedBooking, new: ParsedBooking) -> bool:
        """Check if a booking has been updated"""
        return (
            old.start_date != new.start_date or
            old.end_date != new.end_date or
            old.guest_name != new.guest_name or
            old.num_guests != new.num_guests or
            old.total_price != new.total_price
        )

    # =========================================================================
    # CONFLICT DETECTION
    # =========================================================================

    def detect_conflicts(self, property_id: str) -> List[BookingConflict]:
        """
        Detect overlapping bookings across different platforms.
        Returns list of conflicts found.
        """
        if property_id not in self._bookings:
            return []

        bookings = list(self._bookings[property_id].values())
        conflicts = []

        # Check each pair of bookings
        for i, b1 in enumerate(bookings):
            for b2 in bookings[i + 1:]:
                # Skip if same platform (same source should not conflict)
                if b1.platform == b2.platform:
                    continue

                # Check for date overlap
                overlap = self._get_date_overlap(
                    b1.start_date, b1.end_date,
                    b2.start_date, b2.end_date
                )

                if overlap:
                    conflict = BookingConflict(
                        property_id=property_id,
                        booking1_uid=b1.uid,
                        booking1_platform=b1.platform,
                        booking1_dates=(b1.start_date, b1.end_date),
                        booking2_uid=b2.uid,
                        booking2_platform=b2.platform,
                        booking2_dates=(b2.start_date, b2.end_date),
                        overlap_start=overlap[0],
                        overlap_end=overlap[1],
                    )
                    conflicts.append(conflict)

        # Update stored conflicts for this property
        self._conflicts = [c for c in self._conflicts if c.property_id != property_id]
        self._conflicts.extend(conflicts)

        if conflicts:
            logger.warning(f"Found {len(conflicts)} booking conflicts for property {property_id}")

        return conflicts

    def get_conflicts(self, property_id: Optional[str] = None) -> List[BookingConflict]:
        """Get all detected conflicts, optionally filtered by property"""
        if property_id:
            return [c for c in self._conflicts if c.property_id == property_id]
        return self._conflicts.copy()

    def _get_date_overlap(
        self,
        start1: datetime, end1: datetime,
        start2: datetime, end2: datetime
    ) -> Optional[Tuple[datetime, datetime]]:
        """Check if two date ranges overlap and return the overlap period"""
        overlap_start = max(start1, start2)
        overlap_end = min(end1, end2)

        if overlap_start < overlap_end:
            return (overlap_start, overlap_end)
        return None

    # =========================================================================
    # BOOKING RETRIEVAL
    # =========================================================================

    def get_bookings(
        self,
        property_id: Optional[str] = None,
        platform: Optional[BookingPlatform] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[ParsedBooking]:
        """
        Get bookings with optional filters.

        Args:
            property_id: Filter by property
            platform: Filter by booking platform
            start_date: Only bookings starting on or after this date
            end_date: Only bookings ending on or before this date
        """
        all_bookings = []

        properties = [property_id] if property_id else list(self._bookings.keys())

        for prop_id in properties:
            if prop_id not in self._bookings:
                continue

            for booking in self._bookings[prop_id].values():
                # Platform filter
                if platform and booking.platform != platform:
                    continue

                # Date filters
                if start_date and booking.end_date < start_date:
                    continue
                if end_date and booking.start_date > end_date:
                    continue

                all_bookings.append(booking)

        # Sort by check-in date
        all_bookings.sort(key=lambda b: b.start_date)
        return all_bookings

    def get_upcoming_bookings(self, property_id: Optional[str] = None, days: int = 7) -> List[ParsedBooking]:
        """Get bookings for the next N days"""
        now = datetime.now(pytz.timezone("America/Chicago"))
        end = now + timedelta(days=days)
        return self.get_bookings(property_id=property_id, start_date=now, end_date=end)

    def get_booking_by_uid(self, property_id: str, uid: str) -> Optional[ParsedBooking]:
        """Get a specific booking by UID"""
        if property_id in self._bookings:
            return self._bookings[property_id].get(uid)
        return None

    def get_calendar_data(
        self,
        property_id: Optional[str] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Get calendar view data for a month.
        Returns bookings formatted for calendar display.
        """
        now = datetime.now()
        target_month = month or now.month
        target_year = year or now.year

        # Calculate month boundaries
        start_date = datetime(target_year, target_month, 1, tzinfo=pytz.UTC)
        if target_month == 12:
            end_date = datetime(target_year + 1, 1, 1, tzinfo=pytz.UTC)
        else:
            end_date = datetime(target_year, target_month + 1, 1, tzinfo=pytz.UTC)

        bookings = self.get_bookings(
            property_id=property_id,
            start_date=start_date,
            end_date=end_date,
        )

        # Format for calendar
        events = []
        for booking in bookings:
            events.append({
                "id": booking.uid,
                "title": booking.guest_name or f"{booking.platform.value.title()} Booking",
                "start": booking.start_date.isoformat(),
                "end": booking.end_date.isoformat(),
                "platform": booking.platform.value,
                "guestName": booking.guest_name,
                "guestCount": booking.num_guests,
                "confirmationCode": booking.confirmation_code,
                "totalPrice": booking.total_price,
                "color": self._get_platform_color(booking.platform),
            })

        return {
            "month": target_month,
            "year": target_year,
            "events": events,
            "totalBookings": len(events),
            "generatedAt": datetime.now().isoformat(),
        }

    def _get_platform_color(self, platform: BookingPlatform) -> str:
        """Get display color for a platform"""
        colors = {
            BookingPlatform.AIRBNB: "#FF5A5F",     # Airbnb red
            BookingPlatform.VRBO: "#3B5998",       # VRBO blue
            BookingPlatform.BOOKING: "#003580",    # Booking.com blue
            BookingPlatform.DIRECT: "#10B981",     # Green for direct
            BookingPlatform.OTHER: "#8B5CF6",      # Purple for other
        }
        return colors.get(platform, "#6B7280")

    # =========================================================================
    # SYNC STATUS
    # =========================================================================

    def get_sync_status(self, property_id: str) -> Dict[str, SyncResult]:
        """Get sync status for all feeds of a property"""
        results = {}
        for feed in self.get_feeds(property_id):
            key = f"{property_id}:{feed.platform.value}"
            if key in self._sync_results:
                results[feed.platform.value] = self._sync_results[key]
            else:
                results[feed.platform.value] = SyncResult(
                    property_id=property_id,
                    platform=feed.platform,
                    status=SyncStatus.PENDING,
                )
        return results

    def get_all_sync_status(self) -> Dict[str, Dict[str, SyncResult]]:
        """Get sync status for all properties"""
        all_status = {}
        for property_id in self._feeds.keys():
            all_status[property_id] = self.get_sync_status(property_id)
        return all_status

    # =========================================================================
    # AUTO-SYNC SCHEDULER
    # =========================================================================

    async def start_scheduler(self, interval_minutes: int = 15):
        """Start the auto-sync scheduler"""
        if self._scheduler_running:
            logger.warning("Scheduler is already running")
            return

        self._scheduler_running = True
        self._scheduler_task = asyncio.create_task(self._scheduler_loop(interval_minutes))
        logger.info(f"Started calendar sync scheduler (interval: {interval_minutes} minutes)")

    async def stop_scheduler(self):
        """Stop the auto-sync scheduler"""
        self._scheduler_running = False
        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped calendar sync scheduler")

    async def _scheduler_loop(self, interval_minutes: int):
        """Main scheduler loop"""
        while self._scheduler_running:
            try:
                logger.info("Running scheduled calendar sync...")
                await self.sync_all()
                logger.info("Scheduled sync complete")
            except Exception as e:
                logger.error(f"Scheduled sync error: {e}")

            await asyncio.sleep(interval_minutes * 60)


# =========================================================================
# SINGLETON INSTANCE
# =========================================================================

_sync_service: Optional[CalendarSyncService] = None


def get_calendar_sync_service() -> CalendarSyncService:
    """Get the singleton CalendarSyncService instance"""
    global _sync_service
    if _sync_service is None:
        _sync_service = CalendarSyncService()
    return _sync_service


async def init_calendar_sync():
    """Initialize the calendar sync service and start scheduler"""
    service = get_calendar_sync_service()
    await service.start_scheduler()
    return service
