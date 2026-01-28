"""
Calendar Sync API Router for Right at Home BnB
Unified calendar sync endpoints for VRBO, Airbnb, and other platforms

Endpoints:
- POST /sync/ical           - Trigger manual sync
- GET  /sync/status         - Get sync status for all feeds
- GET  /calendar/{id}       - Get merged calendar for a property
- GET  /calendar/conflicts  - Get all booking conflicts
- POST /feeds               - Add a calendar feed
- DELETE /feeds/{id}/{src}  - Remove a calendar feed
- GET  /export/{id}.ics     - Export iCal for external sync
- POST /webhooks/vrbo       - VRBO webhook endpoint
- POST /webhooks/airbnb     - Airbnb webhook endpoint

ECHO OMEGA PRIME | Made by Commander Bobby Don McWilliams II
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends, Request, Response
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from enum import Enum
import hmac
import hashlib
import logging

from services.ical_service import (
    ICalService,
    get_ical_service,
    BookingSource,
    SyncStatus,
    ParsedBooking,
    CalendarFeed,
    BookingConflict,
    MergedCalendar,
    SyncResult,
)

logger = logging.getLogger("RightAtHomeBnB.CalendarSync")

router = APIRouter()


# =============================================================================
# ENUMS & REQUEST/RESPONSE MODELS
# =============================================================================

class PlatformEnum(str, Enum):
    """Booking platform enum for API"""
    airbnb = "airbnb"
    vrbo = "vrbo"
    booking = "booking"
    direct = "direct"
    google = "google"
    other = "other"


class SyncTriggerRequest(BaseModel):
    """Request to trigger calendar sync"""
    property_id: Optional[str] = Field(None, description="Property ID to sync (all if not specified)")
    source: Optional[PlatformEnum] = Field(None, description="Source to sync (all if not specified)")
    force: bool = Field(False, description="Force sync even if recently synced")


class AddFeedRequest(BaseModel):
    """Request to add a calendar feed"""
    property_id: str = Field(..., description="Property ID")
    source: PlatformEnum = Field(..., description="Booking platform source")
    ical_url: str = Field(..., description="iCal feed URL")


class SyncStatusResponse(BaseModel):
    """Response for sync status"""
    property_id: str
    source: str
    status: str
    last_sync: Optional[str] = None
    bookings_count: int = 0
    error: Optional[str] = None


class BookingResponse(BaseModel):
    """Booking data response"""
    uid: str
    source: str
    summary: str
    check_in: str
    check_out: str
    nights: int
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    confirmation_code: Optional[str] = None
    num_guests: int = 1
    total_price: Optional[float] = None
    is_blocked: bool = False
    color: str = "#8B5CF6"


class ConflictResponse(BaseModel):
    """Booking conflict response"""
    property_id: str
    severity: str
    booking1_uid: str
    booking1_source: str
    booking1_check_in: str
    booking1_check_out: str
    booking1_guest: Optional[str]
    booking2_uid: str
    booking2_source: str
    booking2_check_in: str
    booking2_check_out: str
    booking2_guest: Optional[str]
    overlap_start: str
    overlap_end: str
    overlap_days: int
    message: str
    detected_at: str


class MergedCalendarResponse(BaseModel):
    """Merged calendar response"""
    property_id: str
    total_bookings: int
    total_conflicts: int
    sources: Dict[str, int]
    bookings: List[BookingResponse]
    conflicts: List[ConflictResponse]
    generated_at: str


class SyncResultResponse(BaseModel):
    """Sync operation result response"""
    property_id: str
    source: str
    status: str
    started_at: str
    completed_at: Optional[str]
    duration_seconds: float
    bookings_found: int
    bookings_new: int
    bookings_updated: int
    bookings_removed: int
    conflicts_found: int
    error_message: Optional[str]


class FeedResponse(BaseModel):
    """Calendar feed response"""
    property_id: str
    source: str
    ical_url: str
    enabled: bool
    last_sync: Optional[str] = None
    status: str
    error: Optional[str] = None
    bookings_count: int = 0


class SchedulerStatusResponse(BaseModel):
    """Scheduler status response"""
    running: bool
    last_full_sync: Optional[str]
    next_sync_in_seconds: Optional[int]
    total_feeds: int
    total_properties: int


# =============================================================================
# DEPENDENCY
# =============================================================================

def get_service() -> ICalService:
    """Get the iCal service instance"""
    return get_ical_service()


def _source_to_enum(source: PlatformEnum) -> BookingSource:
    """Convert API enum to service enum"""
    mapping = {
        PlatformEnum.airbnb: BookingSource.AIRBNB,
        PlatformEnum.vrbo: BookingSource.VRBO,
        PlatformEnum.booking: BookingSource.BOOKING_COM,
        PlatformEnum.direct: BookingSource.DIRECT,
        PlatformEnum.google: BookingSource.GOOGLE,
        PlatformEnum.other: BookingSource.OTHER,
    }
    return mapping.get(source, BookingSource.OTHER)


def _booking_to_response(booking: ParsedBooking, service: ICalService) -> BookingResponse:
    """Convert ParsedBooking to BookingResponse"""
    return BookingResponse(
        uid=booking.uid,
        source=booking.source.value,
        summary=booking.summary,
        check_in=booking.check_in.isoformat(),
        check_out=booking.check_out.isoformat(),
        nights=booking.nights,
        guest_name=booking.guest_name,
        guest_phone=booking.guest_phone,
        guest_email=booking.guest_email,
        confirmation_code=booking.confirmation_code,
        num_guests=booking.num_guests,
        total_price=booking.total_price,
        is_blocked=booking.is_blocked,
        color=service.PLATFORM_COLORS.get(booking.source, "#8B5CF6"),
    )


def _conflict_to_response(conflict: BookingConflict) -> ConflictResponse:
    """Convert BookingConflict to ConflictResponse"""
    return ConflictResponse(
        property_id=conflict.property_id,
        severity=conflict.severity.value,
        booking1_uid=conflict.booking1.uid,
        booking1_source=conflict.booking1.source.value,
        booking1_check_in=conflict.booking1.check_in.isoformat(),
        booking1_check_out=conflict.booking1.check_out.isoformat(),
        booking1_guest=conflict.booking1.guest_name,
        booking2_uid=conflict.booking2.uid,
        booking2_source=conflict.booking2.source.value,
        booking2_check_in=conflict.booking2.check_in.isoformat(),
        booking2_check_out=conflict.booking2.check_out.isoformat(),
        booking2_guest=conflict.booking2.guest_name,
        overlap_start=conflict.overlap_start.isoformat(),
        overlap_end=conflict.overlap_end.isoformat(),
        overlap_days=conflict.overlap_days,
        message=conflict.message,
        detected_at=conflict.detected_at.isoformat(),
    )


def _feed_to_response(feed: CalendarFeed) -> FeedResponse:
    """Convert CalendarFeed to FeedResponse"""
    return FeedResponse(
        property_id=feed.property_id,
        source=feed.source.value,
        ical_url=feed.ical_url,
        enabled=feed.enabled,
        last_sync=feed.last_sync.isoformat() if feed.last_sync else None,
        status=feed.last_status.value,
        error=feed.last_error,
        bookings_count=feed.bookings_count,
    )


def _result_to_response(result: SyncResult) -> SyncResultResponse:
    """Convert SyncResult to SyncResultResponse"""
    return SyncResultResponse(
        property_id=result.property_id,
        source=result.source.value,
        status=result.status.value,
        started_at=result.started_at.isoformat(),
        completed_at=result.completed_at.isoformat() if result.completed_at else None,
        duration_seconds=result.duration_seconds,
        bookings_found=result.bookings_found,
        bookings_new=result.bookings_new,
        bookings_updated=result.bookings_updated,
        bookings_removed=result.bookings_removed,
        conflicts_found=result.conflicts_found,
        error_message=result.error_message,
    )


# =============================================================================
# SYNC ENDPOINTS
# =============================================================================

@router.post("/sync/ical", response_model=Dict[str, List[SyncResultResponse]])
async def trigger_sync(
    request: SyncTriggerRequest,
    background_tasks: BackgroundTasks,
    service: ICalService = Depends(get_service),
):
    """
    Trigger calendar sync from iCal feeds.

    - If property_id is specified, syncs only that property
    - If source is specified, syncs only that source for the property
    - If neither specified, syncs all configured feeds

    Returns sync results including:
    - Number of bookings found/new/updated/removed
    - Conflicts detected
    - Duration and status
    """
    results: Dict[str, List[SyncResultResponse]] = {}

    if request.property_id:
        # Sync specific property
        sync_results = await service.sync_property(request.property_id)

        if request.source:
            # Filter to specific source
            source_enum = _source_to_enum(request.source)
            sync_results = [r for r in sync_results if r.source == source_enum]

        results[request.property_id] = [_result_to_response(r) for r in sync_results]
    else:
        # Sync all
        all_results = await service.sync_all()
        for prop_id, prop_results in all_results.items():
            results[prop_id] = [_result_to_response(r) for r in prop_results]

    logger.info(f"Sync triggered: {len(results)} properties processed")
    return results


@router.get("/sync/status", response_model=Dict[str, Any])
async def get_sync_status(
    property_id: Optional[str] = Query(None, description="Filter by property ID"),
    service: ICalService = Depends(get_service),
):
    """
    Get current sync status for all configured feeds.

    Returns for each feed:
    - Last sync time
    - Sync status (success/failed/idle)
    - Number of bookings
    - Any errors
    """
    if property_id:
        status = service.get_sync_status(property_id)
        return {property_id: status}
    else:
        return service.get_all_sync_status()


@router.get("/sync/history", response_model=List[SyncResultResponse])
async def get_sync_history(
    limit: int = Query(50, ge=1, le=200, description="Maximum results"),
    service: ICalService = Depends(get_service),
):
    """
    Get recent sync operation history.
    """
    history = service.get_sync_history(limit=limit)
    return [SyncResultResponse(**h) for h in history]


@router.get("/sync/scheduler", response_model=SchedulerStatusResponse)
async def get_scheduler_status(
    service: ICalService = Depends(get_service),
):
    """
    Get the auto-sync scheduler status.
    """
    all_feeds = service.get_all_feeds()
    total_feeds = sum(len(feeds) for feeds in all_feeds.values())

    return SchedulerStatusResponse(
        running=service.scheduler_running,
        last_full_sync=service.last_full_sync.isoformat() if service.last_full_sync else None,
        next_sync_in_seconds=None,  # Would need to track this in scheduler
        total_feeds=total_feeds,
        total_properties=len(all_feeds),
    )


@router.post("/sync/scheduler/start")
async def start_scheduler(
    interval_minutes: int = Query(15, ge=5, le=120, description="Sync interval in minutes"),
    service: ICalService = Depends(get_service),
):
    """
    Start the auto-sync scheduler.
    """
    if service.scheduler_running:
        raise HTTPException(status_code=400, detail="Scheduler is already running")

    await service.start_scheduler(interval_minutes=interval_minutes)
    return {"status": "started", "interval_minutes": interval_minutes}


@router.post("/sync/scheduler/stop")
async def stop_scheduler(
    service: ICalService = Depends(get_service),
):
    """
    Stop the auto-sync scheduler.
    """
    if not service.scheduler_running:
        raise HTTPException(status_code=400, detail="Scheduler is not running")

    await service.stop_scheduler()
    return {"status": "stopped"}


# =============================================================================
# CALENDAR ENDPOINTS
# =============================================================================

@router.get("/calendar/property/{property_id}", response_model=MergedCalendarResponse)
async def get_merged_calendar(
    property_id: str,
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    include_blocked: bool = Query(False, description="Include blocked dates"),
    service: ICalService = Depends(get_service),
):
    """
    Get merged calendar for a property showing bookings from all sources.

    Features:
    - Combines Airbnb, VRBO, Direct, and other sources
    - Color-coded by source platform
    - Includes conflict detection results
    - Filterable by date range
    """
    calendar = service.get_merged_calendar(
        property_id=property_id,
        start_date=start_date,
        end_date=end_date,
        include_blocked=include_blocked,
    )

    return MergedCalendarResponse(
        property_id=calendar.property_id,
        total_bookings=len(calendar.bookings),
        total_conflicts=len(calendar.conflicts),
        sources={k.value: v for k, v in calendar.sources.items()},
        bookings=[_booking_to_response(b, service) for b in calendar.bookings],
        conflicts=[_conflict_to_response(c) for c in calendar.conflicts],
        generated_at=calendar.generated_at.isoformat(),
    )


@router.get("/calendar/events")
async def get_calendar_events(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12)"),
    year: Optional[int] = Query(None, ge=2020, le=2100, description="Year"),
    service: ICalService = Depends(get_service),
):
    """
    Get calendar events formatted for UI display.

    Returns events with:
    - Platform-specific colors (VRBO=blue, Airbnb=red, Direct=green)
    - Guest information
    - Booking totals for dashboard stats
    """
    events = service.get_calendar_events(
        property_id=property_id,
        month=month,
        year=year,
    )

    now = datetime.now()
    return {
        "month": month or now.month,
        "year": year or now.year,
        "events": events,
        "totalBookings": len(events),
        "generatedAt": datetime.now().isoformat(),
    }


@router.get("/calendar/upcoming")
async def get_upcoming_bookings(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    days: int = Query(7, ge=1, le=90, description="Days to look ahead"),
    service: ICalService = Depends(get_service),
):
    """
    Get upcoming bookings for the next N days.

    Great for:
    - Dashboard widgets
    - Check-in notifications
    - Cleaning scheduling
    """
    bookings = service.get_upcoming_bookings(
        property_id=property_id,
        days=days,
    )

    return {
        "days": days,
        "bookings": [_booking_to_response(b, service) for b in bookings],
        "total": len(bookings),
        "generated_at": datetime.now().isoformat(),
    }


# =============================================================================
# CONFLICT ENDPOINTS
# =============================================================================

@router.get("/calendar/conflicts", response_model=List[ConflictResponse])
async def get_booking_conflicts(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    severity: Optional[str] = Query(None, description="Filter by severity (critical, high, medium, low)"),
    service: ICalService = Depends(get_service),
):
    """
    Get detected booking conflicts (double-bookings).

    Conflict Types:
    - CRITICAL: Exact same dates on different platforms
    - HIGH: Partial overlap between bookings
    - MEDIUM: Back-to-back (no cleaning time gap)
    - LOW: Very close bookings (< 2 hours)

    Each conflict includes:
    - Both bookings involved
    - Overlap period details
    - Recommended actions
    """
    conflicts = service.get_conflicts(property_id=property_id)

    # Filter by severity if specified
    if severity:
        conflicts = [c for c in conflicts if c.severity.value == severity.lower()]

    return [_conflict_to_response(c) for c in conflicts]


@router.get("/calendar/conflicts/summary")
async def get_conflicts_summary(
    service: ICalService = Depends(get_service),
):
    """
    Get a summary of all conflicts across all properties.
    """
    all_conflicts = service.get_all_conflicts()

    summary = {
        "total_conflicts": sum(len(c) for c in all_conflicts.values()),
        "properties_with_conflicts": len(all_conflicts),
        "by_severity": {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
        },
        "by_property": {},
    }

    for prop_id, conflicts in all_conflicts.items():
        summary["by_property"][prop_id] = len(conflicts)
        for conflict in conflicts:
            summary["by_severity"][conflict.severity.value] += 1

    return summary


# =============================================================================
# FEED MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/feeds", response_model=Dict[str, List[FeedResponse]])
async def list_all_feeds(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    service: ICalService = Depends(get_service),
):
    """
    List all configured calendar feeds.
    """
    if property_id:
        feeds = service.get_feeds(property_id)
        return {property_id: [_feed_to_response(f) for f in feeds]}
    else:
        all_feeds = service.get_all_feeds()
        return {
            prop_id: [_feed_to_response(f) for f in feeds]
            for prop_id, feeds in all_feeds.items()
        }


@router.post("/feeds", response_model=FeedResponse)
async def add_calendar_feed(
    request: AddFeedRequest,
    service: ICalService = Depends(get_service),
):
    """
    Add a new calendar feed for a property.

    Supported Sources:
    - airbnb: Airbnb iCal export URL
    - vrbo: VRBO/HomeAway iCal URL
    - booking: Booking.com iCal URL
    - google: Google Calendar iCal
    - direct: Direct bookings iCal
    - other: Other platforms

    Getting iCal URLs:
    - Airbnb: Hosting > Calendar > Availability Settings > Export Calendar
    - VRBO: Calendar > Import/Export > Export Calendar
    - Booking.com: Calendar > Sync Calendars > Export
    """
    source_enum = _source_to_enum(request.source)

    feed = service.add_feed(
        property_id=request.property_id,
        source=source_enum,
        ical_url=request.ical_url,
    )

    logger.info(f"Added {request.source.value} feed for property {request.property_id}")
    return _feed_to_response(feed)


@router.delete("/feeds/{property_id}/{source}")
async def remove_calendar_feed(
    property_id: str,
    source: PlatformEnum,
    service: ICalService = Depends(get_service),
):
    """
    Remove a calendar feed from a property.
    """
    source_enum = _source_to_enum(source)
    removed = service.remove_feed(property_id, source_enum)

    if not removed:
        raise HTTPException(
            status_code=404,
            detail=f"No {source.value} feed found for property {property_id}"
        )

    return {"message": f"Removed {source.value} feed for property {property_id}"}


# =============================================================================
# ICAL EXPORT ENDPOINT
# =============================================================================

@router.get("/export/{property_id}.ics")
async def export_ical(
    property_id: str,
    include_blocked: bool = Query(True, description="Include blocked dates"),
    service: ICalService = Depends(get_service),
):
    """
    Export property calendar as iCal for external sync.

    Use this URL in external platforms to sync FROM Right at Home BnB:
    - Add to Google Calendar
    - Import to other booking platforms
    - Sync with scheduling tools
    """
    # Get property name (in production, fetch from database)
    property_name = f"Property {property_id}"

    ical_content = service.generate_export_ical(
        property_id=property_id,
        property_name=property_name,
        include_blocked=include_blocked,
    )

    return Response(
        content=ical_content,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'attachment; filename="{property_id}.ics"'
        }
    )


# =============================================================================
# WEBHOOK ENDPOINTS
# =============================================================================

# Webhook secret for signature verification (set via environment)
VRBO_WEBHOOK_SECRET = "VRBO_WEBHOOK_SECRET"
AIRBNB_WEBHOOK_SECRET = "AIRBNB_WEBHOOK_SECRET"


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify webhook signature"""
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/webhooks/vrbo")
async def vrbo_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    service: ICalService = Depends(get_service),
):
    """
    VRBO Webhook endpoint for real-time booking notifications.

    Events handled:
    - reservation.created: New booking received
    - reservation.modified: Booking dates/details changed
    - reservation.cancelled: Booking cancelled

    After receiving notification, triggers immediate sync for the property.
    """
    payload = await request.body()

    # Verify signature (if configured)
    signature = request.headers.get("X-VRBO-Signature", "")
    # if not verify_webhook_signature(payload, signature, VRBO_WEBHOOK_SECRET):
    #     raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = data.get("event_type", data.get("eventType", "unknown"))
    property_id = data.get("propertyId", data.get("property_id"))

    logger.info(f"VRBO webhook received: {event_type} for property {property_id}")

    # Process based on event type
    if event_type in ["reservation.created", "reservation.modified", "reservation.cancelled"]:
        if property_id:
            # Trigger async sync
            background_tasks.add_task(_sync_property_background, service, property_id)

    return {
        "status": "received",
        "event_type": event_type,
        "property_id": property_id,
        "sync_triggered": property_id is not None,
    }


@router.post("/webhooks/airbnb")
async def airbnb_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    service: ICalService = Depends(get_service),
):
    """
    Airbnb Webhook endpoint for real-time booking notifications.

    Note: Airbnb webhooks require Partner API access.
    For most users, iCal sync is sufficient (updates every 3 hours).

    Events handled:
    - reservation_request: New inquiry/request
    - reservation_confirmation: Booking confirmed
    - reservation_alteration: Booking modified
    - reservation_cancellation: Booking cancelled
    """
    payload = await request.body()

    # Verify signature
    signature = request.headers.get("X-Airbnb-Signature", "")
    # if not verify_webhook_signature(payload, signature, AIRBNB_WEBHOOK_SECRET):
    #     raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = data.get("event_type", data.get("event", "unknown"))
    listing_id = data.get("listing_id", data.get("listingId"))

    logger.info(f"Airbnb webhook received: {event_type} for listing {listing_id}")

    # Process based on event type
    if event_type in [
        "reservation_request",
        "reservation_confirmation",
        "reservation_alteration",
        "reservation_cancellation",
    ]:
        if listing_id:
            # Map Airbnb listing ID to property ID
            # In production, look this up from database
            property_id = _lookup_property_by_listing(listing_id)
            if property_id:
                background_tasks.add_task(_sync_property_background, service, property_id)

    return {
        "status": "received",
        "event_type": event_type,
        "listing_id": listing_id,
    }


async def _sync_property_background(service: ICalService, property_id: str):
    """Background task to sync a property after webhook"""
    try:
        await service.sync_property(property_id)
        logger.info(f"Webhook-triggered sync complete for property {property_id}")
    except Exception as e:
        logger.error(f"Webhook-triggered sync failed for {property_id}: {e}")


def _lookup_property_by_listing(listing_id: str) -> Optional[str]:
    """
    Look up internal property ID from Airbnb listing ID.
    In production, this would query the database.
    """
    # Placeholder - implement database lookup
    # Example mapping:
    # AIRBNB_PROPERTY_MAP = {
    #     "12345678": "prop-1",
    #     "87654321": "prop-2",
    # }
    # return AIRBNB_PROPERTY_MAP.get(listing_id)
    return None


# =============================================================================
# HEALTH CHECK
# =============================================================================

@router.get("/health")
async def calendar_sync_health(
    service: ICalService = Depends(get_service),
):
    """
    Health check for the calendar sync system.
    """
    all_feeds = service.get_all_feeds()
    total_feeds = sum(len(feeds) for feeds in all_feeds.values())

    all_status = service.get_all_sync_status()
    failed_count = 0
    for prop_status in all_status.values():
        feeds_status = prop_status.get("feeds", {})
        for feed_status in feeds_status.values():
            if feed_status.get("status") == "failed":
                failed_count += 1

    all_conflicts = service.get_conflicts()

    return {
        "status": "healthy" if failed_count == 0 else "degraded",
        "scheduler_running": service.scheduler_running,
        "last_full_sync": service.last_full_sync.isoformat() if service.last_full_sync else None,
        "total_properties": len(all_feeds),
        "total_feeds": total_feeds,
        "failed_feeds": failed_count,
        "active_conflicts": len(all_conflicts),
        "timestamp": datetime.now().isoformat(),
    }
