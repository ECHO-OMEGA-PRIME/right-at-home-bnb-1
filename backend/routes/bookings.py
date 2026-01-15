"""
Bookings API Routes for Right at Home BnB
Calendar sync and booking management endpoints.

Endpoints:
- GET /bookings - List all bookings with filters
- GET /bookings/property/{id} - Bookings for a specific property
- POST /bookings/sync - Manual sync trigger
- GET /bookings/calendar - Calendar view data
- GET /bookings/upcoming - Next 7 days of bookings
- GET /bookings/conflicts - Overlapping booking detection

ECHO OMEGA PRIME | Made by Commander Bobby Don McWilliams II
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import logging

from services.calendar_sync import (
    CalendarSyncService,
    get_calendar_sync_service,
    BookingPlatform,
    SyncStatus,
    ParsedBooking,
    CalendarFeed,
    SyncResult,
    BookingConflict,
)

logger = logging.getLogger("RightAtHomeBnB.Bookings")

router = APIRouter()


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class PlatformEnum(str, Enum):
    airbnb = "airbnb"
    vrbo = "vrbo"
    booking = "booking"
    direct = "direct"
    other = "other"


class AddFeedRequest(BaseModel):
    """Request to add a calendar feed"""
    property_id: str = Field(..., description="Property ID to sync")
    platform: PlatformEnum = Field(..., description="Booking platform")
    url: str = Field(..., description="iCal feed URL")


class SyncRequest(BaseModel):
    """Request to trigger a sync"""
    property_id: Optional[str] = Field(None, description="Property ID to sync (all if not specified)")
    platform: Optional[PlatformEnum] = Field(None, description="Platform to sync (all if not specified)")


class BookingResponse(BaseModel):
    """Booking data response"""
    uid: str
    summary: str
    start_date: datetime
    end_date: datetime
    platform: str
    confirmation_code: Optional[str] = None
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    num_guests: int = 1
    total_price: Optional[float] = None
    nights: int = 0
    special_requests: Optional[str] = None

    @classmethod
    def from_parsed(cls, booking: ParsedBooking) -> "BookingResponse":
        nights = (booking.end_date - booking.start_date).days
        return cls(
            uid=booking.uid,
            summary=booking.summary,
            start_date=booking.start_date,
            end_date=booking.end_date,
            platform=booking.platform.value,
            confirmation_code=booking.confirmation_code,
            guest_name=booking.guest_name,
            guest_phone=booking.guest_phone,
            guest_email=booking.guest_email,
            num_guests=booking.num_guests,
            total_price=booking.total_price,
            nights=nights,
            special_requests=booking.special_requests,
        )


class FeedResponse(BaseModel):
    """Calendar feed configuration response"""
    property_id: str
    platform: str
    url: str
    enabled: bool
    last_sync: Optional[datetime]
    last_status: str
    last_error: Optional[str]

    @classmethod
    def from_feed(cls, feed: CalendarFeed) -> "FeedResponse":
        return cls(
            property_id=feed.property_id,
            platform=feed.platform.value,
            url=feed.url,
            enabled=feed.enabled,
            last_sync=feed.last_sync,
            last_status=feed.last_status.value,
            last_error=feed.last_error,
        )


class SyncResultResponse(BaseModel):
    """Sync operation result"""
    property_id: str
    platform: str
    status: str
    bookings_found: int
    bookings_new: int
    bookings_updated: int
    bookings_removed: int
    conflicts_detected: int
    error_message: Optional[str]
    sync_duration_seconds: float
    synced_at: datetime

    @classmethod
    def from_result(cls, result: SyncResult) -> "SyncResultResponse":
        return cls(
            property_id=result.property_id,
            platform=result.platform.value,
            status=result.status.value,
            bookings_found=result.bookings_found,
            bookings_new=result.bookings_new,
            bookings_updated=result.bookings_updated,
            bookings_removed=result.bookings_removed,
            conflicts_detected=result.conflicts_detected,
            error_message=result.error_message,
            sync_duration_seconds=result.sync_duration_seconds,
            synced_at=result.synced_at,
        )


class ConflictResponse(BaseModel):
    """Booking conflict response"""
    property_id: str
    booking1_uid: str
    booking1_platform: str
    booking1_start: datetime
    booking1_end: datetime
    booking2_uid: str
    booking2_platform: str
    booking2_start: datetime
    booking2_end: datetime
    overlap_start: datetime
    overlap_end: datetime
    overlap_days: int
    detected_at: datetime

    @classmethod
    def from_conflict(cls, conflict: BookingConflict) -> "ConflictResponse":
        overlap_days = (conflict.overlap_end - conflict.overlap_start).days
        return cls(
            property_id=conflict.property_id,
            booking1_uid=conflict.booking1_uid,
            booking1_platform=conflict.booking1_platform.value,
            booking1_start=conflict.booking1_dates[0],
            booking1_end=conflict.booking1_dates[1],
            booking2_uid=conflict.booking2_uid,
            booking2_platform=conflict.booking2_platform.value,
            booking2_start=conflict.booking2_dates[0],
            booking2_end=conflict.booking2_dates[1],
            overlap_start=conflict.overlap_start,
            overlap_end=conflict.overlap_end,
            overlap_days=overlap_days,
            detected_at=conflict.detected_at,
        )


class CalendarEventResponse(BaseModel):
    """Calendar event for UI display"""
    id: str
    title: str
    start: str
    end: str
    platform: str
    guestName: Optional[str]
    guestCount: int
    confirmationCode: Optional[str]
    totalPrice: Optional[float]
    color: str


class CalendarDataResponse(BaseModel):
    """Calendar view data response"""
    month: int
    year: int
    events: List[CalendarEventResponse]
    totalBookings: int
    generatedAt: str


# =============================================================================
# DEPENDENCY
# =============================================================================

def get_sync_service() -> CalendarSyncService:
    """Get the calendar sync service"""
    return get_calendar_sync_service()


# =============================================================================
# BOOKING ENDPOINTS
# =============================================================================

@router.get("", response_model=List[BookingResponse])
async def list_bookings(
    property_id: Optional[str] = Query(None, description="Filter by property ID"),
    platform: Optional[PlatformEnum] = Query(None, description="Filter by platform"),
    start_date: Optional[datetime] = Query(None, description="Bookings starting after this date"),
    end_date: Optional[datetime] = Query(None, description="Bookings ending before this date"),
    limit: int = Query(100, ge=1, le=500, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Skip first N results"),
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    List all bookings with optional filters.

    Filter by property, platform, or date range.
    Returns bookings sorted by check-in date.
    """
    platform_enum = BookingPlatform(platform.value) if platform else None

    bookings = service.get_bookings(
        property_id=property_id,
        platform=platform_enum,
        start_date=start_date,
        end_date=end_date,
    )

    # Apply pagination
    paginated = bookings[offset:offset + limit]

    return [BookingResponse.from_parsed(b) for b in paginated]


@router.get("/property/{property_id}", response_model=List[BookingResponse])
async def get_property_bookings(
    property_id: str,
    platform: Optional[PlatformEnum] = Query(None, description="Filter by platform"),
    include_past: bool = Query(False, description="Include past bookings"),
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Get all bookings for a specific property.

    By default, only returns current and future bookings.
    Set include_past=true to include historical bookings.
    """
    platform_enum = BookingPlatform(platform.value) if platform else None

    start_date = None if include_past else datetime.now() - timedelta(days=1)

    bookings = service.get_bookings(
        property_id=property_id,
        platform=platform_enum,
        start_date=start_date,
    )

    return [BookingResponse.from_parsed(b) for b in bookings]


@router.get("/booking/{property_id}/{uid}", response_model=BookingResponse)
async def get_booking_detail(
    property_id: str,
    uid: str,
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Get detailed information for a specific booking.
    """
    booking = service.get_booking_by_uid(property_id, uid)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    return BookingResponse.from_parsed(booking)


@router.get("/upcoming", response_model=List[BookingResponse])
async def get_upcoming_bookings(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    days: int = Query(7, ge=1, le=90, description="Number of days to look ahead"),
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Get bookings for the next N days.

    Great for dashboard widgets and notifications.
    Default is 7 days ahead.
    """
    bookings = service.get_upcoming_bookings(property_id=property_id, days=days)
    return [BookingResponse.from_parsed(b) for b in bookings]


# =============================================================================
# CALENDAR ENDPOINTS
# =============================================================================

@router.get("/calendar", response_model=CalendarDataResponse)
async def get_calendar_data(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12)"),
    year: Optional[int] = Query(None, ge=2020, le=2100, description="Year"),
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Get calendar view data for a specific month.

    Returns events formatted for calendar UI display with:
    - Event dates and times
    - Platform-specific colors
    - Guest information
    - Booking totals

    Defaults to current month if not specified.
    """
    data = service.get_calendar_data(
        property_id=property_id,
        month=month,
        year=year,
    )

    events = [
        CalendarEventResponse(
            id=e["id"],
            title=e["title"],
            start=e["start"],
            end=e["end"],
            platform=e["platform"],
            guestName=e["guestName"],
            guestCount=e["guestCount"],
            confirmationCode=e["confirmationCode"],
            totalPrice=e["totalPrice"],
            color=e["color"],
        )
        for e in data["events"]
    ]

    return CalendarDataResponse(
        month=data["month"],
        year=data["year"],
        events=events,
        totalBookings=data["totalBookings"],
        generatedAt=data["generatedAt"],
    )


# =============================================================================
# SYNC ENDPOINTS
# =============================================================================

@router.post("/sync", response_model=Dict[str, List[SyncResultResponse]])
async def trigger_sync(
    request: SyncRequest,
    background_tasks: BackgroundTasks,
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Manually trigger a calendar sync.

    Can sync:
    - All properties and platforms (no parameters)
    - A specific property (property_id)
    - A specific platform for a property (property_id + platform)

    Returns sync results including:
    - Number of bookings found/new/updated/removed
    - Conflicts detected
    - Any errors encountered
    """
    results = {}

    if request.property_id:
        # Sync specific property
        sync_results = await service.sync_property(request.property_id)

        if request.platform:
            # Filter to specific platform
            platform_enum = BookingPlatform(request.platform.value)
            sync_results = [r for r in sync_results if r.platform == platform_enum]

        results[request.property_id] = [SyncResultResponse.from_result(r) for r in sync_results]
    else:
        # Sync all
        all_results = await service.sync_all()
        for prop_id, prop_results in all_results.items():
            results[prop_id] = [SyncResultResponse.from_result(r) for r in prop_results]

    return results


@router.get("/sync/status", response_model=Dict[str, Dict[str, SyncResultResponse]])
async def get_sync_status(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Get the current sync status for all configured feeds.

    Shows:
    - Last sync time
    - Sync status (success/failed/pending)
    - Number of bookings synced
    - Any errors
    """
    if property_id:
        status = service.get_sync_status(property_id)
        return {
            property_id: {
                platform: SyncResultResponse.from_result(result)
                for platform, result in status.items()
            }
        }
    else:
        all_status = service.get_all_sync_status()
        return {
            prop_id: {
                platform: SyncResultResponse.from_result(result)
                for platform, result in prop_status.items()
            }
            for prop_id, prop_status in all_status.items()
        }


# =============================================================================
# CONFLICT ENDPOINTS
# =============================================================================

@router.get("/conflicts", response_model=List[ConflictResponse])
async def get_conflicts(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Get detected booking conflicts (double-bookings).

    Conflicts occur when bookings from different platforms
    overlap for the same property.

    Returns conflict details including:
    - Both bookings involved
    - Overlap period
    - Days of conflict
    """
    conflicts = service.get_conflicts(property_id=property_id)
    return [ConflictResponse.from_conflict(c) for c in conflicts]


# =============================================================================
# FEED MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/feeds", response_model=Dict[str, List[FeedResponse]])
async def list_feeds(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    List all configured calendar feeds.

    Shows iCal URLs and sync status for each property/platform.
    """
    if property_id:
        feeds = service.get_feeds(property_id)
        return {property_id: [FeedResponse.from_feed(f) for f in feeds]}
    else:
        all_feeds = service.get_all_feeds()
        return {
            prop_id: [FeedResponse.from_feed(f) for f in feeds]
            for prop_id, feeds in all_feeds.items()
        }


@router.post("/feeds", response_model=FeedResponse)
async def add_feed(
    request: AddFeedRequest,
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Add a new calendar feed for a property.

    Provide:
    - property_id: The property to sync
    - platform: airbnb, vrbo, booking, direct, or other
    - url: The iCal feed URL from the platform

    To get iCal URLs:
    - Airbnb: Hosting > Calendar > Availability Settings > Export Calendar
    - VRBO: Calendar > Import/Export > Export Calendar
    """
    platform_enum = BookingPlatform(request.platform.value)

    feed = service.add_feed(
        property_id=request.property_id,
        platform=platform_enum,
        url=request.url,
    )

    logger.info(f"Added {request.platform.value} feed for property {request.property_id}")

    return FeedResponse.from_feed(feed)


@router.delete("/feeds/{property_id}/{platform}")
async def remove_feed(
    property_id: str,
    platform: PlatformEnum,
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Remove a calendar feed for a property.
    """
    platform_enum = BookingPlatform(platform.value)
    removed = service.remove_feed(property_id, platform_enum)

    if not removed:
        raise HTTPException(
            status_code=404,
            detail=f"No {platform.value} feed found for property {property_id}"
        )

    return {"message": f"Removed {platform.value} feed for property {property_id}"}


# =============================================================================
# STATISTICS ENDPOINTS
# =============================================================================

@router.get("/stats")
async def get_booking_stats(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    days: int = Query(30, ge=1, le=365, description="Days to analyze"),
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Get booking statistics for dashboard display.

    Returns:
    - Total bookings in period
    - Bookings by platform
    - Average booking length
    - Occupancy rate
    - Revenue totals
    """
    now = datetime.now()
    start_date = now - timedelta(days=days)

    bookings = service.get_bookings(
        property_id=property_id,
        start_date=start_date,
    )

    # Calculate stats
    total_bookings = len(bookings)

    # By platform
    by_platform = {}
    for booking in bookings:
        platform = booking.platform.value
        by_platform[platform] = by_platform.get(platform, 0) + 1

    # Average stay length
    total_nights = sum(
        (b.end_date - b.start_date).days for b in bookings
    )
    avg_nights = total_nights / total_bookings if total_bookings > 0 else 0

    # Total revenue
    total_revenue = sum(
        b.total_price or 0 for b in bookings
    )

    # Upcoming (next 7 days)
    upcoming = service.get_upcoming_bookings(property_id=property_id, days=7)

    # Conflicts
    conflicts = service.get_conflicts(property_id=property_id)

    return {
        "period_days": days,
        "total_bookings": total_bookings,
        "by_platform": by_platform,
        "total_nights": total_nights,
        "average_nights": round(avg_nights, 1),
        "total_revenue": total_revenue,
        "upcoming_count": len(upcoming),
        "conflicts_count": len(conflicts),
        "generated_at": datetime.now().isoformat(),
    }


# =============================================================================
# HEALTH CHECK
# =============================================================================

@router.get("/health")
async def bookings_health(
    service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Health check for the bookings/calendar sync system.
    """
    all_feeds = service.get_all_feeds()
    total_feeds = sum(len(feeds) for feeds in all_feeds.values())

    all_status = service.get_all_sync_status()
    failed_syncs = 0
    for prop_status in all_status.values():
        for result in prop_status.values():
            if result.status == SyncStatus.FAILED:
                failed_syncs += 1

    all_conflicts = service.get_conflicts()

    return {
        "status": "healthy" if failed_syncs == 0 else "degraded",
        "total_properties": len(all_feeds),
        "total_feeds": total_feeds,
        "failed_syncs": failed_syncs,
        "active_conflicts": len(all_conflicts),
        "scheduler_running": service._scheduler_running,
        "timestamp": datetime.now().isoformat(),
    }
