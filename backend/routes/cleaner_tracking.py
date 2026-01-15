"""
Right At Home BnB - Cleaner Tracking API Routes
===============================================
GPS tracking, route optimization, and reminder calls.

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
from datetime import date

from services.cleaner_tracking import cleaner_tracking_service, CleanerStatus

router = APIRouter()


class LocationUpdateRequest(BaseModel):
    cleaner_id: str
    latitude: float
    longitude: float
    accuracy: float = 10.0
    speed: float = 0.0


class CleanerRegisterRequest(BaseModel):
    name: str
    email: str
    phone: str
    default_zone: Optional[str] = None


class ScheduleAssignmentRequest(BaseModel):
    cleaner_id: str
    property_id: str
    scheduled_time: str
    estimated_duration: int = 90
    special_instructions: Optional[str] = None


class StatusUpdateRequest(BaseModel):
    cleaner_id: str
    new_status: str
    property_id: Optional[str] = None


class BulkScheduleRequest(BaseModel):
    date: str
    assignments: List[dict]


# =========================================================================
# LOCATION TRACKING
# =========================================================================

@router.post("/location/update")
async def update_location(request: LocationUpdateRequest):
    """Update cleaner's current location."""
    return await cleaner_tracking_service.update_cleaner_location(
        cleaner_id=request.cleaner_id,
        latitude=request.latitude,
        longitude=request.longitude,
        accuracy=request.accuracy,
        speed=request.speed
    )


@router.get("/location/{cleaner_id}")
async def get_cleaner_location(cleaner_id: str):
    """Get cleaner's current location."""
    return await cleaner_tracking_service.get_cleaner_location(cleaner_id)


@router.get("/locations/all")
async def get_all_locations():
    """Get all active cleaner locations."""
    return await cleaner_tracking_service.get_all_active_locations()


@router.get("/location/{cleaner_id}/history")
async def get_location_history(
    cleaner_id: str,
    target_date: Optional[str] = None,
    limit: int = 100
):
    """Get cleaner's location history for a date."""
    return await cleaner_tracking_service.get_location_history(
        cleaner_id, target_date, limit
    )


# =========================================================================
# CLEANER MANAGEMENT
# =========================================================================

@router.post("/cleaners/register")
async def register_cleaner(request: CleanerRegisterRequest):
    """Register a new cleaner."""
    return await cleaner_tracking_service.register_cleaner(
        name=request.name,
        email=request.email,
        phone=request.phone,
        default_zone=request.default_zone
    )


@router.get("/cleaners")
async def list_cleaners(
    status: Optional[str] = None,
    zone: Optional[str] = None
):
    """List all cleaners."""
    status_filter = CleanerStatus(status) if status else None
    return await cleaner_tracking_service.list_cleaners(status_filter, zone)


@router.get("/cleaners/{cleaner_id}")
async def get_cleaner(cleaner_id: str):
    """Get cleaner details."""
    return await cleaner_tracking_service.get_cleaner(cleaner_id)


@router.put("/cleaners/{cleaner_id}/status")
async def update_cleaner_status(cleaner_id: str, request: StatusUpdateRequest):
    """Update cleaner status."""
    try:
        new_status = CleanerStatus(request.new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")

    return await cleaner_tracking_service.update_cleaner_status(
        cleaner_id=cleaner_id,
        new_status=new_status,
        property_id=request.property_id
    )


@router.get("/cleaners/{cleaner_id}/performance")
async def get_cleaner_performance(cleaner_id: str, period_days: int = 30):
    """Get cleaner performance metrics."""
    return await cleaner_tracking_service.get_cleaner_performance(
        cleaner_id, period_days
    )


# =========================================================================
# SCHEDULING
# =========================================================================

@router.post("/schedule/assign")
async def assign_cleaning(request: ScheduleAssignmentRequest):
    """Assign a cleaning task to a cleaner."""
    return await cleaner_tracking_service.assign_cleaning(
        cleaner_id=request.cleaner_id,
        property_id=request.property_id,
        scheduled_time=request.scheduled_time,
        estimated_duration=request.estimated_duration,
        special_instructions=request.special_instructions
    )


@router.get("/schedule/{cleaner_id}")
async def get_cleaner_schedule(
    cleaner_id: str,
    target_date: Optional[str] = None
):
    """Get cleaner's schedule for a date."""
    return await cleaner_tracking_service.get_cleaner_schedule(
        cleaner_id, target_date
    )


@router.get("/schedule/date/{target_date}")
async def get_all_schedules_for_date(target_date: str):
    """Get all cleaning schedules for a specific date."""
    return await cleaner_tracking_service.get_all_schedules(target_date)


@router.post("/schedule/bulk")
async def bulk_schedule_cleanings(request: BulkScheduleRequest):
    """Bulk assign cleanings for a date."""
    return await cleaner_tracking_service.bulk_schedule(
        date=request.date,
        assignments=request.assignments
    )


@router.delete("/schedule/{assignment_id}")
async def cancel_cleaning(assignment_id: str, reason: Optional[str] = None):
    """Cancel a scheduled cleaning."""
    return await cleaner_tracking_service.cancel_cleaning(assignment_id, reason)


# =========================================================================
# ROUTE OPTIMIZATION
# =========================================================================

@router.get("/route/optimize/{cleaner_id}")
async def optimize_route(cleaner_id: str, target_date: Optional[str] = None):
    """Get optimized route for cleaner's daily schedule."""
    return await cleaner_tracking_service.optimize_route(cleaner_id, target_date)


@router.get("/route/eta/{cleaner_id}/{property_id}")
async def get_eta(cleaner_id: str, property_id: str):
    """Get ETA for cleaner to reach a property."""
    return await cleaner_tracking_service.get_eta(cleaner_id, property_id)


# =========================================================================
# REMINDERS & NOTIFICATIONS
# =========================================================================

@router.post("/reminder/send/{cleaner_id}")
async def send_reminder(cleaner_id: str, message: Optional[str] = None):
    """Send reminder to cleaner."""
    return await cleaner_tracking_service.send_reminder(cleaner_id, message)


@router.post("/reminder/late-check")
async def check_late_cleaners():
    """Check for late cleaners and send reminders."""
    return await cleaner_tracking_service.check_and_remind_late_cleaners()


@router.get("/alerts/late")
async def get_late_alerts():
    """Get current late cleaner alerts."""
    return await cleaner_tracking_service.get_late_alerts()


# =========================================================================
# ARRIVALS & COMPLETIONS
# =========================================================================

@router.post("/arrive/{cleaner_id}/{property_id}")
async def mark_arrival(cleaner_id: str, property_id: str):
    """Mark cleaner arrival at property."""
    return await cleaner_tracking_service.mark_arrival(cleaner_id, property_id)


@router.post("/complete/{cleaner_id}/{property_id}")
async def mark_completion(
    cleaner_id: str,
    property_id: str,
    photo_urls: List[str] = [],
    notes: Optional[str] = None
):
    """Mark cleaning as complete."""
    return await cleaner_tracking_service.mark_completion(
        cleaner_id=cleaner_id,
        property_id=property_id,
        photo_urls=photo_urls,
        notes=notes
    )


# =========================================================================
# REPORTING
# =========================================================================

@router.get("/report/daily")
async def get_daily_report(target_date: Optional[str] = None):
    """Get daily cleaning operations report."""
    return await cleaner_tracking_service.get_daily_report(target_date)


@router.get("/report/weekly")
async def get_weekly_report(end_date: Optional[str] = None):
    """Get weekly cleaning operations report."""
    return await cleaner_tracking_service.get_weekly_report(end_date)
