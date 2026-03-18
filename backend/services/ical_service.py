"""
iCal Service for Right at Home BnB
Unified calendar parsing, merging, and conflict detection for VRBO and Airbnb

Features:
- Parse VRBO iCal feeds (60-min refresh on VRBO side)
- Parse Airbnb iCal feeds (3-hour refresh on Airbnb side)
- Merge calendars from multiple sources
- Detect conflicts/double-bookings
- Generate iCal exports for external calendars
- Background cron job for 15-minute auto-sync

ECHO OMEGA PRIME | Made by Commander Bobby Don McWilliams II
"""

import asyncio
import hashlib
import re
from datetime import datetime, date, timedelta, time
from typing import Optional, List, Dict, Any, Tuple, Set
from dataclasses import dataclass, field, asdict
from enum import Enum
import httpx
from icalendar import Calendar, Event
from dateutil.parser import parse as parse_date
import pytz
from loguru import logger


# =============================================================================
# ENUMS & DATA CLASSES
# =============================================================================

class BookingSource(str, Enum):
    """Booking source platforms"""
    AIRBNB = "airbnb"
    VRBO = "vrbo"
    BOOKING_COM = "booking"
    DIRECT = "direct"
    GOOGLE = "google"
    OTHER = "other"


class SyncStatus(str, Enum):
    """Sync operation status"""
    IDLE = "idle"
    SYNCING = "syncing"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class ConflictSeverity(str, Enum):
    """Conflict severity levels"""
    CRITICAL = "critical"    # Same dates on different platforms
    HIGH = "high"            # Partial overlap
    MEDIUM = "medium"        # Back-to-back (no cleaning time)
    LOW = "low"              # Close bookings (< 2 hours gap)


@dataclass
class ParsedBooking:
    """Represents a parsed booking from iCal"""
    uid: str
    source: BookingSource
    summary: str
    description: Optional[str]
    check_in: date
    check_out: date
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    confirmation_code: Optional[str] = None
    num_guests: int = 1
    total_price: Optional[float] = None
    currency: str = "USD"
    is_blocked: bool = False
    raw_data: Optional[Dict[str, Any]] = None

    @property
    def nights(self) -> int:
        return (self.check_out - self.check_in).days

    def to_dict(self) -> Dict[str, Any]:
        return {
            "uid": self.uid,
            "source": self.source.value,
            "summary": self.summary,
            "description": self.description,
            "check_in": self.check_in.isoformat(),
            "check_out": self.check_out.isoformat(),
            "guest_name": self.guest_name,
            "guest_phone": self.guest_phone,
            "guest_email": self.guest_email,
            "confirmation_code": self.confirmation_code,
            "num_guests": self.num_guests,
            "total_price": self.total_price,
            "currency": self.currency,
            "is_blocked": self.is_blocked,
            "nights": self.nights,
        }


@dataclass
class CalendarFeed:
    """Configuration for a calendar feed"""
    property_id: str
    source: BookingSource
    ical_url: str
    enabled: bool = True
    last_sync: Optional[datetime] = None
    last_status: SyncStatus = SyncStatus.IDLE
    last_error: Optional[str] = None
    bookings_count: int = 0


@dataclass
class BookingConflict:
    """Represents a booking conflict between platforms"""
    property_id: str
    severity: ConflictSeverity
    booking1: ParsedBooking
    booking2: ParsedBooking
    overlap_start: date
    overlap_end: date
    overlap_days: int
    message: str
    detected_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "property_id": self.property_id,
            "severity": self.severity.value,
            "booking1_uid": self.booking1.uid,
            "booking1_source": self.booking1.source.value,
            "booking1_check_in": self.booking1.check_in.isoformat(),
            "booking1_check_out": self.booking1.check_out.isoformat(),
            "booking1_guest": self.booking1.guest_name,
            "booking2_uid": self.booking2.uid,
            "booking2_source": self.booking2.source.value,
            "booking2_check_in": self.booking2.check_in.isoformat(),
            "booking2_check_out": self.booking2.check_out.isoformat(),
            "booking2_guest": self.booking2.guest_name,
            "overlap_start": self.overlap_start.isoformat(),
            "overlap_end": self.overlap_end.isoformat(),
            "overlap_days": self.overlap_days,
            "message": self.message,
            "detected_at": self.detected_at.isoformat(),
        }


@dataclass
class SyncResult:
    """Result of a sync operation"""
    property_id: str
    source: BookingSource
    status: SyncStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    bookings_found: int = 0
    bookings_new: int = 0
    bookings_updated: int = 0
    bookings_removed: int = 0
    conflicts_found: int = 0
    error_message: Optional[str] = None

    @property
    def duration_seconds(self) -> float:
        if self.completed_at and self.started_at:
            return (self.completed_at - self.started_at).total_seconds()
        return 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "property_id": self.property_id,
            "source": self.source.value,
            "status": self.status.value,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_seconds": self.duration_seconds,
            "bookings_found": self.bookings_found,
            "bookings_new": self.bookings_new,
            "bookings_updated": self.bookings_updated,
            "bookings_removed": self.bookings_removed,
            "conflicts_found": self.conflicts_found,
            "error_message": self.error_message,
        }


@dataclass
class MergedCalendar:
    """Merged calendar from multiple sources"""
    property_id: str
    bookings: List[ParsedBooking]
    conflicts: List[BookingConflict]
    sources: Dict[BookingSource, int]  # source -> booking count
    generated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "property_id": self.property_id,
            "total_bookings": len(self.bookings),
            "total_conflicts": len(self.conflicts),
            "sources": {k.value: v for k, v in self.sources.items()},
            "bookings": [b.to_dict() for b in self.bookings],
            "conflicts": [c.to_dict() for c in self.conflicts],
            "generated_at": self.generated_at.isoformat(),
        }


# =============================================================================
# ICAL PARSER
# =============================================================================

class ICalParser:
    """
    Parses iCal feeds from various booking platforms.
    Handles platform-specific formats for Airbnb, VRBO, etc.
    """

    # Regex patterns
    BLOCKED_PATTERNS = [
        re.compile(r"blocked", re.IGNORECASE),
        re.compile(r"not available", re.IGNORECASE),
        re.compile(r"owner", re.IGNORECASE),
        re.compile(r"maintenance", re.IGNORECASE),
        re.compile(r"hold", re.IGNORECASE),
    ]

    GUEST_NAME_PATTERNS = [
        re.compile(r"Reserved\s*-\s*(.+?)(?:\s*\(|$)", re.IGNORECASE),
        re.compile(r"Reserved:\s*(.+?)$", re.IGNORECASE),
        re.compile(r"Booked\s+by\s+(.+?)$", re.IGNORECASE),
        re.compile(r"Guest:\s*(.+?)$", re.IGNORECASE),
    ]

    PHONE_PATTERN = re.compile(r"(?:Phone|Tel|Mobile)[:\s]*([\+\d\s\-\(\)]{10,})", re.IGNORECASE)
    EMAIL_PATTERN = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+")

    CONFIRMATION_PATTERNS = [
        re.compile(r"(?:Confirmation|Conf|Code|Booking)[#:\s]*([A-Z0-9]{6,})", re.IGNORECASE),
        re.compile(r"HM[A-Z0-9]{6,}", re.IGNORECASE),  # Airbnb format
        re.compile(r"HA-[A-Z0-9]+", re.IGNORECASE),    # VRBO format
    ]

    GUEST_COUNT_PATTERN = re.compile(r"(\d+)\s*(?:guests?|adults?|people)", re.IGNORECASE)
    PRICE_PATTERN = re.compile(r"(?:Total|Price|Amount)[:\s]*\$?([\d,]+\.?\d*)", re.IGNORECASE)

    def __init__(self, timezone: str = "America/Chicago"):
        self.timezone = pytz.timezone(timezone)

    def parse(self, ical_content: str, source: BookingSource) -> List[ParsedBooking]:
        """
        Parse iCal content into a list of bookings.

        Args:
            ical_content: Raw iCal string
            source: The booking platform source

        Returns:
            List of ParsedBooking objects
        """
        try:
            cal = Calendar.from_ical(ical_content)
        except Exception as e:
            logger.error(f"Failed to parse iCal: {e}")
            return []

        bookings = []

        for component in cal.walk():
            if component.name == "VEVENT":
                try:
                    booking = self._parse_event(component, source)
                    if booking:
                        bookings.append(booking)
                except Exception as e:
                    logger.warning(f"Failed to parse event: {e}")
                    continue

        logger.info(f"Parsed {len(bookings)} bookings from {source.value} iCal")
        return bookings

    def _parse_event(self, event: Event, source: BookingSource) -> Optional[ParsedBooking]:
        """Parse a single VEVENT component"""
        uid = str(event.get("UID", ""))
        summary = str(event.get("SUMMARY", ""))
        description = str(event.get("DESCRIPTION", ""))

        # Parse dates
        dtstart = event.get("DTSTART")
        dtend = event.get("DTEND")

        if not dtstart:
            return None

        check_in = self._to_date(dtstart.dt)
        check_out = self._to_date(dtend.dt) if dtend else check_in + timedelta(days=1)

        # Skip events too far in the past
        if check_out < date.today() - timedelta(days=30):
            return None

        # Check if blocked
        is_blocked = self._is_blocked(summary, description)

        # Generate UID if missing
        if not uid:
            uid = hashlib.md5(f"{summary}{check_in}".encode()).hexdigest()

        booking = ParsedBooking(
            uid=uid,
            source=source,
            summary=summary,
            description=description if description else None,
            check_in=check_in,
            check_out=check_out,
            is_blocked=is_blocked,
        )

        # Extract details based on source
        if not is_blocked:
            self._extract_details(booking, summary, description, source)

        # Store raw data
        booking.raw_data = {
            "uid": uid,
            "summary": summary,
            "description": description,
            "dtstart": check_in.isoformat(),
            "dtend": check_out.isoformat(),
        }

        return booking

    def _to_date(self, dt) -> date:
        """Convert datetime or date to date"""
        if isinstance(dt, datetime):
            return dt.date()
        return dt

    def _is_blocked(self, summary: str, description: str) -> bool:
        """Check if this is a blocked time slot"""
        combined = f"{summary} {description}"
        return any(p.search(combined) for p in self.BLOCKED_PATTERNS)

    def _extract_details(
        self,
        booking: ParsedBooking,
        summary: str,
        description: str,
        source: BookingSource
    ) -> None:
        """Extract guest details from event data"""
        combined = f"{summary}\n{description}"

        # Guest name
        if source == BookingSource.AIRBNB:
            # Airbnb: "Reserved - John Smith" or "Reserved - John Smith (HMXXXXXX)"
            for pattern in self.GUEST_NAME_PATTERNS:
                match = pattern.search(summary)
                if match:
                    booking.guest_name = match.group(1).strip()
                    break
        elif source == BookingSource.VRBO:
            # VRBO: "RESERVED: John Smith" or various formats
            for pattern in self.GUEST_NAME_PATTERNS:
                match = pattern.search(combined)
                if match:
                    booking.guest_name = match.group(1).strip()
                    break
        else:
            # Generic
            for pattern in self.GUEST_NAME_PATTERNS:
                match = pattern.search(combined)
                if match:
                    booking.guest_name = match.group(1).strip()
                    break

        # Phone
        match = self.PHONE_PATTERN.search(combined)
        if match:
            phone = re.sub(r"[^\d+]", "", match.group(1))
            if len(phone) >= 10:
                booking.guest_phone = phone

        # Email
        match = self.EMAIL_PATTERN.search(combined)
        if match:
            booking.guest_email = match.group(0)

        # Confirmation code
        for pattern in self.CONFIRMATION_PATTERNS:
            match = pattern.search(combined)
            if match:
                code = match.group(1) if match.lastindex else match.group(0)
                booking.confirmation_code = code
                break

        # Guest count
        match = self.GUEST_COUNT_PATTERN.search(combined)
        if match:
            try:
                booking.num_guests = int(match.group(1))
            except ValueError:
                pass

        # Price
        match = self.PRICE_PATTERN.search(combined)
        if match:
            try:
                booking.total_price = float(match.group(1).replace(",", ""))
            except ValueError:
                pass


# =============================================================================
# ICAL SERVICE
# =============================================================================

class ICalService:
    """
    Main iCal service for fetching, parsing, merging calendars and detecting conflicts.
    """

    HTTP_TIMEOUT = 30.0
    MAX_RETRIES = 3
    RETRY_DELAY = 2.0

    # Platform-specific colors for UI
    PLATFORM_COLORS = {
        BookingSource.AIRBNB: "#FF5A5F",      # Airbnb red
        BookingSource.VRBO: "#3B5998",         # VRBO blue
        BookingSource.BOOKING_COM: "#003580",  # Booking.com blue
        BookingSource.DIRECT: "#10B981",       # Green
        BookingSource.GOOGLE: "#4285F4",       # Google blue
        BookingSource.OTHER: "#8B5CF6",        # Purple
    }

    def __init__(self, timezone: str = "America/Chicago"):
        self.parser = ICalParser(timezone)
        self.http_client: Optional[httpx.AsyncClient] = None

        # In-memory storage (replace with database in production)
        self._feeds: Dict[str, Dict[BookingSource, CalendarFeed]] = {}  # property_id -> {source -> feed}
        self._bookings: Dict[str, Dict[str, ParsedBooking]] = {}  # property_id -> {uid -> booking}
        self._conflicts: Dict[str, List[BookingConflict]] = {}  # property_id -> conflicts
        self._sync_history: List[SyncResult] = []

        # Scheduler state
        self._scheduler_running = False
        self._scheduler_task: Optional[asyncio.Task] = None
        self._last_full_sync: Optional[datetime] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self.http_client is None or self.http_client.is_closed:
            self.http_client = httpx.AsyncClient(
                timeout=self.HTTP_TIMEOUT,
                follow_redirects=True,
                headers={"User-Agent": "RightAtHomeBnB/2.0 iCal Sync"}
            )
        return self.http_client

    async def close(self):
        """Close HTTP client"""
        if self.http_client:
            await self.http_client.aclose()
            self.http_client = None

    # =========================================================================
    # FEED MANAGEMENT
    # =========================================================================

    def add_feed(
        self,
        property_id: str,
        source: BookingSource,
        ical_url: str
    ) -> CalendarFeed:
        """Register a calendar feed for a property"""
        feed = CalendarFeed(
            property_id=property_id,
            source=source,
            ical_url=ical_url,
        )

        if property_id not in self._feeds:
            self._feeds[property_id] = {}

        self._feeds[property_id][source] = feed
        logger.info(f"Added {source.value} feed for property {property_id}")
        return feed

    def remove_feed(self, property_id: str, source: BookingSource) -> bool:
        """Remove a calendar feed"""
        if property_id in self._feeds and source in self._feeds[property_id]:
            del self._feeds[property_id][source]
            logger.info(f"Removed {source.value} feed for property {property_id}")
            return True
        return False

    def get_feeds(self, property_id: str) -> List[CalendarFeed]:
        """Get all feeds for a property"""
        if property_id in self._feeds:
            return list(self._feeds[property_id].values())
        return []

    def get_all_feeds(self) -> Dict[str, List[CalendarFeed]]:
        """Get all configured feeds"""
        return {
            prop_id: list(feeds.values())
            for prop_id, feeds in self._feeds.items()
        }

    # =========================================================================
    # ICAL FETCHING
    # =========================================================================

    async def fetch_ical(self, url: str) -> Optional[str]:
        """Fetch iCal content from URL with retries"""
        client = await self._get_client()
        last_error = None

        for attempt in range(self.MAX_RETRIES):
            try:
                response = await client.get(url)
                response.raise_for_status()

                content = response.text
                logger.debug(f"Fetched {len(content)} bytes from iCal URL")
                return content

            except Exception as e:
                last_error = e
                logger.warning(f"iCal fetch attempt {attempt + 1} failed: {e}")
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(self.RETRY_DELAY * (attempt + 1))

        logger.error(f"Failed to fetch iCal after {self.MAX_RETRIES} attempts: {last_error}")
        return None

    # =========================================================================
    # SYNC OPERATIONS
    # =========================================================================

    async def sync_feed(self, feed: CalendarFeed) -> SyncResult:
        """Sync a single calendar feed"""
        result = SyncResult(
            property_id=feed.property_id,
            source=feed.source,
            status=SyncStatus.SYNCING,
            started_at=datetime.now(),
        )

        feed.last_status = SyncStatus.SYNCING

        try:
            # Fetch iCal
            content = await self.fetch_ical(feed.ical_url)
            if not content:
                raise Exception("Failed to fetch iCal content")

            # Parse bookings
            bookings = self.parser.parse(content, feed.source)
            result.bookings_found = len(bookings)

            # Initialize property storage
            if feed.property_id not in self._bookings:
                self._bookings[feed.property_id] = {}

            # Track existing UIDs for this source
            existing_uids = {
                uid for uid, b in self._bookings[feed.property_id].items()
                if b.source == feed.source
            }
            new_uids = set()

            # Process bookings
            for booking in bookings:
                new_uids.add(booking.uid)

                if booking.uid in self._bookings[feed.property_id]:
                    # Update existing
                    old = self._bookings[feed.property_id][booking.uid]
                    if self._booking_changed(old, booking):
                        self._bookings[feed.property_id][booking.uid] = booking
                        result.bookings_updated += 1
                else:
                    # New booking
                    self._bookings[feed.property_id][booking.uid] = booking
                    result.bookings_new += 1

            # Remove bookings no longer in feed
            for uid in existing_uids - new_uids:
                del self._bookings[feed.property_id][uid]
                result.bookings_removed += 1

            # Update feed status
            feed.last_sync = datetime.now()
            feed.last_status = SyncStatus.SUCCESS
            feed.last_error = None
            feed.bookings_count = len(bookings)

            result.status = SyncStatus.SUCCESS

        except Exception as e:
            logger.error(f"Sync failed for {feed.source.value} on {feed.property_id}: {e}")
            feed.last_status = SyncStatus.FAILED
            feed.last_error = str(e)
            result.status = SyncStatus.FAILED
            result.error_message = str(e)

        result.completed_at = datetime.now()
        self._sync_history.append(result)

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
            result.conflicts_found = len(conflicts)

        return results

    async def sync_all(self) -> Dict[str, List[SyncResult]]:
        """Sync all configured feeds"""
        all_results = {}

        for property_id in self._feeds.keys():
            results = await self.sync_property(property_id)
            all_results[property_id] = results

        self._last_full_sync = datetime.now()
        logger.info(f"Full sync complete for {len(all_results)} properties")

        return all_results

    def _booking_changed(self, old: ParsedBooking, new: ParsedBooking) -> bool:
        """Check if a booking has been modified"""
        return (
            old.check_in != new.check_in or
            old.check_out != new.check_out or
            old.guest_name != new.guest_name or
            old.num_guests != new.num_guests or
            old.total_price != new.total_price or
            old.is_blocked != new.is_blocked
        )

    # =========================================================================
    # CONFLICT DETECTION
    # =========================================================================

    def detect_conflicts(self, property_id: str) -> List[BookingConflict]:
        """
        Detect booking conflicts for a property.
        Checks for overlapping dates between different sources.
        """
        if property_id not in self._bookings:
            return []

        bookings = [b for b in self._bookings[property_id].values() if not b.is_blocked]
        conflicts = []

        # Check each pair
        for i, b1 in enumerate(bookings):
            for b2 in bookings[i + 1:]:
                # Skip same source (handled by platform)
                if b1.source == b2.source:
                    continue

                # Check overlap
                conflict = self._check_overlap(property_id, b1, b2)
                if conflict:
                    conflicts.append(conflict)

        # Store conflicts
        self._conflicts[property_id] = conflicts

        if conflicts:
            logger.warning(f"Found {len(conflicts)} conflicts for property {property_id}")

        return conflicts

    def _check_overlap(
        self,
        property_id: str,
        b1: ParsedBooking,
        b2: ParsedBooking
    ) -> Optional[BookingConflict]:
        """Check if two bookings overlap and create conflict if they do"""
        # Calculate overlap
        overlap_start = max(b1.check_in, b2.check_in)
        overlap_end = min(b1.check_out, b2.check_out)

        if overlap_start >= overlap_end:
            # No overlap, but check for back-to-back (no cleaning gap)
            if b1.check_out == b2.check_in or b2.check_out == b1.check_in:
                # Back-to-back - might not have cleaning time
                earlier = b1 if b1.check_out <= b2.check_in else b2
                later = b2 if b1.check_out <= b2.check_in else b1
                return BookingConflict(
                    property_id=property_id,
                    severity=ConflictSeverity.MEDIUM,
                    booking1=earlier,
                    booking2=later,
                    overlap_start=earlier.check_out,
                    overlap_end=earlier.check_out,
                    overlap_days=0,
                    message=f"Back-to-back bookings: No cleaning time between {earlier.source.value} checkout and {later.source.value} check-in",
                )
            return None

        overlap_days = (overlap_end - overlap_start).days

        # Determine severity
        if b1.check_in == b2.check_in and b1.check_out == b2.check_out:
            severity = ConflictSeverity.CRITICAL
            message = f"Exact date conflict: Same dates on {b1.source.value} and {b2.source.value}"
        elif overlap_days >= 2:
            severity = ConflictSeverity.CRITICAL
            message = f"Major overlap: {overlap_days} days conflict between {b1.source.value} and {b2.source.value}"
        else:
            severity = ConflictSeverity.HIGH
            message = f"Partial overlap: {overlap_days} day(s) conflict between {b1.source.value} and {b2.source.value}"

        return BookingConflict(
            property_id=property_id,
            severity=severity,
            booking1=b1,
            booking2=b2,
            overlap_start=overlap_start,
            overlap_end=overlap_end,
            overlap_days=overlap_days,
            message=message,
        )

    def get_conflicts(self, property_id: Optional[str] = None) -> List[BookingConflict]:
        """Get conflicts, optionally filtered by property"""
        if property_id:
            return self._conflicts.get(property_id, [])

        all_conflicts = []
        for conflicts in self._conflicts.values():
            all_conflicts.extend(conflicts)
        return all_conflicts

    def get_all_conflicts(self) -> Dict[str, List[BookingConflict]]:
        """Get all conflicts grouped by property"""
        return {
            prop_id: conflicts
            for prop_id, conflicts in self._conflicts.items()
            if conflicts
        }

    # =========================================================================
    # MERGED CALENDAR
    # =========================================================================

    def get_merged_calendar(
        self,
        property_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        include_blocked: bool = False,
    ) -> MergedCalendar:
        """
        Get merged calendar for a property with bookings from all sources.
        """
        if property_id not in self._bookings:
            return MergedCalendar(
                property_id=property_id,
                bookings=[],
                conflicts=[],
                sources={},
            )

        # Filter bookings
        bookings = []
        sources: Dict[BookingSource, int] = {}

        for booking in self._bookings[property_id].values():
            # Skip blocked if not requested
            if booking.is_blocked and not include_blocked:
                continue

            # Date filter
            if start_date and booking.check_out < start_date:
                continue
            if end_date and booking.check_in > end_date:
                continue

            bookings.append(booking)
            sources[booking.source] = sources.get(booking.source, 0) + 1

        # Sort by check-in date
        bookings.sort(key=lambda b: b.check_in)

        # Get conflicts
        conflicts = self._conflicts.get(property_id, [])

        return MergedCalendar(
            property_id=property_id,
            bookings=bookings,
            conflicts=conflicts,
            sources=sources,
        )

    def get_calendar_events(
        self,
        property_id: Optional[str] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get calendar events formatted for UI display.
        """
        now = datetime.now()
        target_month = month or now.month
        target_year = year or now.year

        # Calculate month boundaries
        start_date = date(target_year, target_month, 1)
        if target_month == 12:
            end_date = date(target_year + 1, 1, 1)
        else:
            end_date = date(target_year, target_month + 1, 1)

        events = []

        # Get properties to process
        property_ids = [property_id] if property_id else list(self._bookings.keys())

        for prop_id in property_ids:
            calendar = self.get_merged_calendar(prop_id, start_date, end_date)

            for booking in calendar.bookings:
                events.append({
                    "id": booking.uid,
                    "title": booking.guest_name or f"{booking.source.value.title()} Booking",
                    "start": booking.check_in.isoformat(),
                    "end": booking.check_out.isoformat(),
                    "platform": booking.source.value,
                    "propertyId": prop_id,
                    "guestName": booking.guest_name,
                    "guestCount": booking.num_guests,
                    "confirmationCode": booking.confirmation_code,
                    "totalPrice": booking.total_price,
                    "nights": booking.nights,
                    "color": self.PLATFORM_COLORS.get(booking.source, "#8B5CF6"),
                    "isBlocked": booking.is_blocked,
                })

        return events

    # =========================================================================
    # BOOKING RETRIEVAL
    # =========================================================================

    def get_bookings(
        self,
        property_id: Optional[str] = None,
        source: Optional[BookingSource] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        include_blocked: bool = False,
    ) -> List[ParsedBooking]:
        """Get bookings with optional filters"""
        all_bookings = []

        properties = [property_id] if property_id else list(self._bookings.keys())

        for prop_id in properties:
            if prop_id not in self._bookings:
                continue

            for booking in self._bookings[prop_id].values():
                # Source filter
                if source and booking.source != source:
                    continue

                # Blocked filter
                if booking.is_blocked and not include_blocked:
                    continue

                # Date filters
                if start_date and booking.check_out < start_date:
                    continue
                if end_date and booking.check_in > end_date:
                    continue

                all_bookings.append(booking)

        # Sort by check-in
        all_bookings.sort(key=lambda b: b.check_in)
        return all_bookings

    def get_upcoming_bookings(
        self,
        property_id: Optional[str] = None,
        days: int = 7
    ) -> List[ParsedBooking]:
        """Get bookings for the next N days"""
        today = date.today()
        end_date = today + timedelta(days=days)
        return self.get_bookings(
            property_id=property_id,
            start_date=today,
            end_date=end_date,
        )

    def get_booking_by_uid(self, property_id: str, uid: str) -> Optional[ParsedBooking]:
        """Get a specific booking by UID"""
        if property_id in self._bookings:
            return self._bookings[property_id].get(uid)
        return None

    # =========================================================================
    # SYNC STATUS
    # =========================================================================

    def get_sync_status(self, property_id: str) -> Dict[str, Any]:
        """Get sync status for a property"""
        feeds = self.get_feeds(property_id)
        status = {}

        for feed in feeds:
            status[feed.source.value] = {
                "enabled": feed.enabled,
                "last_sync": feed.last_sync.isoformat() if feed.last_sync else None,
                "status": feed.last_status.value,
                "error": feed.last_error,
                "bookings_count": feed.bookings_count,
            }

        return {
            "property_id": property_id,
            "feeds": status,
            "total_bookings": len(self._bookings.get(property_id, {})),
            "conflicts": len(self._conflicts.get(property_id, [])),
        }

    def get_all_sync_status(self) -> Dict[str, Any]:
        """Get sync status for all properties"""
        return {
            prop_id: self.get_sync_status(prop_id)
            for prop_id in self._feeds.keys()
        }

    def get_sync_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent sync history"""
        history = sorted(
            self._sync_history,
            key=lambda r: r.started_at,
            reverse=True
        )[:limit]
        return [r.to_dict() for r in history]

    # =========================================================================
    # ICAL EXPORT
    # =========================================================================

    def generate_export_ical(
        self,
        property_id: str,
        property_name: str,
        include_blocked: bool = True,
    ) -> str:
        """
        Generate iCal export for external calendars.
        This allows other platforms to sync from Right at Home BnB.
        """
        cal = Calendar()
        cal.add("prodid", "-//Right at Home BnB//rah-midland.com//")
        cal.add("version", "2.0")
        cal.add("x-wr-calname", f"{property_name} - Bookings")
        cal.add("method", "PUBLISH")

        bookings = self.get_bookings(property_id=property_id, include_blocked=include_blocked)

        for booking in bookings:
            event = Event()
            event.add("uid", f"{booking.uid}@rah-midland.com")
            event.add("dtstart", booking.check_in)
            event.add("dtend", booking.check_out)

            if booking.is_blocked:
                event.add("summary", "Not available")
                event.add("description", "Blocked by Right at Home BnB")
            else:
                summary = f"Reserved - {booking.guest_name}" if booking.guest_name else "Reserved"
                event.add("summary", summary)

                desc_parts = [f"Source: {booking.source.value.title()}"]
                if booking.confirmation_code:
                    desc_parts.append(f"Confirmation: {booking.confirmation_code}")
                if booking.num_guests:
                    desc_parts.append(f"Guests: {booking.num_guests}")
                event.add("description", "\n".join(desc_parts))

            event.add("dtstamp", datetime.now())
            event.add("created", datetime.now())

            cal.add_component(event)

        return cal.to_ical().decode("utf-8")

    # =========================================================================
    # CRON SCHEDULER
    # =========================================================================

    async def start_scheduler(self, interval_minutes: int = 15):
        """Start the auto-sync scheduler"""
        if self._scheduler_running:
            logger.warning("Scheduler is already running")
            return

        self._scheduler_running = True
        self._scheduler_task = asyncio.create_task(
            self._scheduler_loop(interval_minutes)
        )
        logger.info(f"Started calendar sync scheduler (interval: {interval_minutes} min)")

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

    @property
    def scheduler_running(self) -> bool:
        return self._scheduler_running

    @property
    def last_full_sync(self) -> Optional[datetime]:
        return self._last_full_sync


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_ical_service: Optional[ICalService] = None


def get_ical_service() -> ICalService:
    """Get the singleton ICalService instance"""
    global _ical_service
    if _ical_service is None:
        _ical_service = ICalService()
    return _ical_service


async def init_ical_service(auto_start_scheduler: bool = True) -> ICalService:
    """Initialize the iCal service and optionally start scheduler"""
    service = get_ical_service()
    if auto_start_scheduler:
        await service.start_scheduler(interval_minutes=15)
    return service
