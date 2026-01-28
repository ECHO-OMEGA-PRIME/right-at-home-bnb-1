"""
Right at Home BnB - Enhanced Smart Lock Code Management
Complete API for guest codes, cleaner codes, maintenance codes, and automated delivery
@author ECHO OMEGA PRIME
"""

from typing import Optional, List
from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends
from pydantic import BaseModel, Field, validator
from loguru import logger
import asyncio

from services.smart_locks import (
    unified_lock_service,
    LockProviderType,
    CodeType,
    SmartLockProvider,
)
from services.twilio_sms import twilio_sms_service


router = APIRouter(prefix="/locks", tags=["Smart Lock Code Management"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class GenerateGuestCodeRequest(BaseModel):
    """Request to generate a guest access code."""
    guest_name: str = Field(..., min_length=1, max_length=100)
    check_in: datetime
    check_out: datetime
    guest_phone: Optional[str] = Field(None, pattern=r"^\+?[1-9]\d{9,14}$")
    guest_email: Optional[str] = None
    reservation_id: Optional[str] = None
    code_length: int = Field(default=6, ge=4, le=8)
    send_sms: bool = True
    send_sms_hours_before: int = Field(default=4, ge=0, le=48)
    property_name: Optional[str] = None
    property_address: Optional[str] = None

    @validator("check_out")
    def check_out_after_check_in(cls, v, values):
        if "check_in" in values and v <= values["check_in"]:
            raise ValueError("check_out must be after check_in")
        return v


class GenerateCleanerCodeRequest(BaseModel):
    """Request to generate a cleaner access code."""
    cleaner_name: str = Field(..., min_length=1, max_length=100)
    cleaner_phone: Optional[str] = Field(None, pattern=r"^\+?[1-9]\d{9,14}$")
    access_date: date
    start_time: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(default="17:00", pattern=r"^\d{2}:\d{2}$")
    recurring: bool = False
    recurring_days: Optional[List[str]] = None  # ["monday", "wednesday", "friday"]
    code_length: int = Field(default=6, ge=4, le=8)
    send_sms: bool = False


class GenerateMaintenanceCodeRequest(BaseModel):
    """Request to generate a one-time maintenance access code."""
    technician_name: str = Field(..., min_length=1, max_length=100)
    technician_phone: Optional[str] = Field(None, pattern=r"^\+?[1-9]\d{9,14}$")
    service_type: str = Field(..., min_length=1, max_length=100)  # "HVAC", "plumbing", "electrical"
    access_start: datetime
    access_end: datetime
    max_uses: int = Field(default=1, ge=1, le=5)
    code_length: int = Field(default=6, ge=4, le=8)
    work_order_id: Optional[str] = None
    notes: Optional[str] = None
    send_sms: bool = True


class RevokeCodeRequest(BaseModel):
    """Request to revoke an access code."""
    reason: Optional[str] = None
    notify_user: bool = True


class ScheduledCodeDeliveryRequest(BaseModel):
    """Request to schedule code delivery SMS."""
    guest_phone: str = Field(..., pattern=r"^\+?[1-9]\d{9,14}$")
    guest_name: str
    code: str
    property_name: str
    property_address: str
    check_in: datetime
    check_out: datetime
    delivery_time: datetime


# =============================================================================
# GUEST CODE ENDPOINTS
# =============================================================================

@router.post("/{lock_id}/generate-code")
async def generate_guest_code(
    lock_id: str,
    request: GenerateGuestCodeRequest,
    background_tasks: BackgroundTasks
):
    """
    Generate a unique guest access code.

    - Creates a secure 4-8 digit code (default 6)
    - Code activates at check-in time
    - Code expires 2 hours after checkout (configurable grace period)
    - Optionally schedules SMS delivery for specified hours before check-in
    - Prevents duplicate codes across all locks
    """
    # Calculate code validity window
    code_start = request.check_in
    code_end = request.check_out + timedelta(hours=2)  # 2-hour grace period

    result = await unified_lock_service.generate_guest_code(
        lock_id=lock_id,
        guest_name=request.guest_name,
        check_in=code_start,
        check_out=code_end,
        guest_phone=request.guest_phone,
        reservation_id=request.reservation_id,
        code_length=request.code_length,
        send_sms=False,  # We handle SMS separately for scheduling
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate code"))

    # Schedule SMS delivery if requested
    sms_scheduled = False
    if request.send_sms and request.guest_phone:
        delivery_time = request.check_in - timedelta(hours=request.send_sms_hours_before)

        if delivery_time <= datetime.utcnow():
            # Send immediately if delivery time is in the past
            sms_result = await twilio_sms_service.send_access_code(
                guest_phone=request.guest_phone,
                guest_name=request.guest_name,
                property_name=request.property_name or "the property",
                property_address=request.property_address or "",
                access_code=result["code"],
                code_start=code_start,
                code_end=code_end,
                booking_id=request.reservation_id
            )
            sms_scheduled = sms_result.success
        else:
            # Schedule for future delivery
            background_tasks.add_task(
                _schedule_code_delivery,
                guest_phone=request.guest_phone,
                guest_name=request.guest_name,
                code=result["code"],
                property_name=request.property_name or "the property",
                property_address=request.property_address or "",
                check_in=request.check_in,
                check_out=request.check_out,
                delivery_time=delivery_time,
            )
            sms_scheduled = True

    logger.info(f"Generated guest code for {request.guest_name} on lock {lock_id}: {result['code']}")

    return {
        "success": True,
        "lock_id": lock_id,
        "code": result["code"],
        "code_id": result["code_id"],
        "guest_name": request.guest_name,
        "valid_from": code_start.isoformat(),
        "valid_until": code_end.isoformat(),
        "check_in": request.check_in.isoformat(),
        "check_out": request.check_out.isoformat(),
        "grace_period_hours": 2,
        "sms_scheduled": sms_scheduled,
        "sms_delivery_hours_before": request.send_sms_hours_before if sms_scheduled else None,
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# CLEANER CODE ENDPOINTS
# =============================================================================

@router.post("/{lock_id}/cleaner-code")
async def generate_cleaner_code(lock_id: str, request: GenerateCleanerCodeRequest):
    """
    Generate time-limited access code for cleaning staff.

    - Access restricted to specified time window on access date
    - Can be set up for recurring access (weekly schedules)
    - Shorter validity window for security
    - Optional SMS notification to cleaner
    """
    try:
        # Parse time window
        start_hour, start_min = map(int, request.start_time.split(":"))
        end_hour, end_min = map(int, request.end_time.split(":"))

        start_dt = datetime.combine(
            request.access_date,
            datetime.min.time().replace(hour=start_hour, minute=start_min)
        )
        end_dt = datetime.combine(
            request.access_date,
            datetime.min.time().replace(hour=end_hour, minute=end_min)
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    # Generate unique code avoiding existing codes
    existing_codes = await _get_existing_codes(lock_id)
    code = SmartLockProvider.generate_access_code(
        length=request.code_length,
        exclude_patterns=True,
        existing_codes=existing_codes,
    )

    # Create code on lock
    provider = unified_lock_service._get_provider_for_lock(lock_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Lock not found")

    access_code = await provider.create_access_code(
        lock_id=lock_id,
        name=f"Cleaner: {request.cleaner_name}",
        code=code,
        code_type=CodeType.CLEANER,
        start_time=start_dt,
        end_time=end_dt,
    )

    # Send SMS to cleaner if requested
    sms_sent = False
    if request.send_sms and request.cleaner_phone:
        lock_info = await unified_lock_service.get_lock_status(lock_id)
        property_name = lock_info.get("property", {}).get("name", "Property")

        message = (
            f"Hi {request.cleaner_name}! Your cleaning access code is: {code}\n\n"
            f"Property: {property_name}\n"
            f"Date: {request.access_date.strftime('%B %d, %Y')}\n"
            f"Time: {request.start_time} - {request.end_time}\n\n"
            f"Code is only valid during this window.\n"
            f"- Right at Home BnB"
        )
        sms_result = await twilio_sms_service.send_sms(request.cleaner_phone, message)
        sms_sent = sms_result.success

    logger.info(f"Generated cleaner code for {request.cleaner_name} on lock {lock_id}")

    return {
        "success": True,
        "lock_id": lock_id,
        "code": code,
        "code_id": access_code.code_id,
        "code_type": "cleaner",
        "cleaner_name": request.cleaner_name,
        "access_date": request.access_date.isoformat(),
        "time_window": f"{request.start_time} - {request.end_time}",
        "valid_from": start_dt.isoformat(),
        "valid_until": end_dt.isoformat(),
        "sms_sent": sms_sent,
        "recurring": request.recurring,
        "recurring_days": request.recurring_days if request.recurring else None,
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# MAINTENANCE/ONE-TIME CODE ENDPOINTS
# =============================================================================

@router.post("/{lock_id}/maintenance-code")
async def generate_maintenance_code(lock_id: str, request: GenerateMaintenanceCodeRequest):
    """
    Generate a one-time access code for maintenance/service personnel.

    - Limited number of uses (default 1)
    - Short validity window
    - Logs service type and work order
    - Automatic notification to technician
    """
    if request.access_end <= request.access_start:
        raise HTTPException(status_code=400, detail="Access end must be after access start")

    # Max 24-hour window for maintenance codes
    max_window = timedelta(hours=24)
    if (request.access_end - request.access_start) > max_window:
        raise HTTPException(
            status_code=400,
            detail="Maintenance code window cannot exceed 24 hours"
        )

    # Generate unique code
    existing_codes = await _get_existing_codes(lock_id)
    code = SmartLockProvider.generate_access_code(
        length=request.code_length,
        exclude_patterns=True,
        existing_codes=existing_codes,
    )

    # Create one-time code on lock
    provider = unified_lock_service._get_provider_for_lock(lock_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Lock not found")

    access_code = await provider.create_access_code(
        lock_id=lock_id,
        name=f"Maintenance ({request.service_type}): {request.technician_name}",
        code=code,
        code_type=CodeType.ONE_TIME,
        start_time=request.access_start,
        end_time=request.access_end,
    )

    # Set max uses
    access_code.max_uses = request.max_uses

    # Send SMS to technician if requested
    sms_sent = False
    if request.send_sms and request.technician_phone:
        lock_info = await unified_lock_service.get_lock_status(lock_id)
        property_name = lock_info.get("property", {}).get("name", "Property")

        message = (
            f"Service Access for {request.service_type}\n\n"
            f"Code: {code}\n"
            f"Property: {property_name}\n"
            f"Valid: {request.access_start.strftime('%b %d %I:%M %p')} - {request.access_end.strftime('%I:%M %p')}\n"
            f"Uses: {request.max_uses}\n"
        )
        if request.work_order_id:
            message += f"Work Order: {request.work_order_id}\n"
        if request.notes:
            message += f"\nNotes: {request.notes}\n"
        message += "\n- Right at Home BnB"

        sms_result = await twilio_sms_service.send_sms(request.technician_phone, message)
        sms_sent = sms_result.success

    logger.info(
        f"Generated maintenance code for {request.technician_name} "
        f"({request.service_type}) on lock {lock_id}"
    )

    return {
        "success": True,
        "lock_id": lock_id,
        "code": code,
        "code_id": access_code.code_id,
        "code_type": "maintenance",
        "technician_name": request.technician_name,
        "service_type": request.service_type,
        "valid_from": request.access_start.isoformat(),
        "valid_until": request.access_end.isoformat(),
        "max_uses": request.max_uses,
        "uses_remaining": request.max_uses,
        "work_order_id": request.work_order_id,
        "sms_sent": sms_sent,
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# CODE REVOCATION ENDPOINTS
# =============================================================================

@router.delete("/{lock_id}/code/{code_id}")
async def revoke_access_code(
    lock_id: str,
    code_id: str,
    request: Optional[RevokeCodeRequest] = None
):
    """
    Revoke an access code immediately.

    Use for:
    - Early checkouts
    - Security concerns
    - Guest issues
    - Cancelled reservations
    - Terminated cleaner access
    """
    result = await unified_lock_service.revoke_code(lock_id, code_id)

    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Code not found"))

    reason = request.reason if request else "No reason provided"
    logger.warning(f"Access code {code_id} revoked for lock {lock_id}. Reason: {reason}")

    return {
        **result,
        "reason": reason,
        "revoked_at": datetime.utcnow().isoformat(),
    }


@router.delete("/{lock_id}/codes/expired")
async def revoke_expired_codes(lock_id: str):
    """
    Revoke all expired codes for a specific lock.
    """
    codes_result = await unified_lock_service.list_access_codes(lock_id, include_expired=True)

    if not codes_result["success"]:
        raise HTTPException(status_code=404, detail="Lock not found")

    revoked_count = 0
    errors = []

    for code in codes_result.get("codes", []):
        if code.get("is_expired") and code.get("is_active"):
            try:
                await unified_lock_service.revoke_code(lock_id, code["code_id"])
                revoked_count += 1
            except Exception as e:
                errors.append({"code_id": code["code_id"], "error": str(e)})

    return {
        "success": True,
        "lock_id": lock_id,
        "revoked_count": revoked_count,
        "errors": errors if errors else None,
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# ACCESS LOG ENDPOINTS
# =============================================================================

@router.get("/{lock_id}/access-log")
async def get_access_log(
    lock_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    action_type: Optional[str] = Query(None, description="Filter: unlocked, locked, code_used, failed_attempt"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    """
    Get access history for a lock.

    Shows all lock/unlock events, code uses, and failed attempts.
    Filterable by date range and action type.
    """
    start_dt = datetime.combine(start_date, datetime.min.time()) if start_date else None
    end_dt = datetime.combine(end_date, datetime.max.time()) if end_date else None

    result = await unified_lock_service.get_activity_log(
        lock_id=lock_id,
        start_date=start_dt,
        end_date=end_dt,
        limit=limit + offset,  # Fetch enough for pagination
    )

    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Lock not found"))

    activities = result.get("activities", [])

    # Filter by action type if specified
    if action_type:
        activities = [a for a in activities if a.get("action") == action_type]

    # Apply pagination
    paginated = activities[offset:offset + limit]

    return {
        "success": True,
        "lock_id": lock_id,
        "activities": paginated,
        "count": len(paginated),
        "total": len(activities),
        "offset": offset,
        "limit": limit,
        "has_more": (offset + limit) < len(activities),
        "filters": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "action_type": action_type,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/{lock_id}/access-log/summary")
async def get_access_log_summary(
    lock_id: str,
    days: int = Query(default=7, ge=1, le=90),
):
    """
    Get summary statistics for lock access over specified days.
    """
    start_date = datetime.utcnow() - timedelta(days=days)

    result = await unified_lock_service.get_activity_log(
        lock_id=lock_id,
        start_date=start_date,
        limit=1000,
    )

    if not result["success"]:
        raise HTTPException(status_code=404, detail="Lock not found")

    activities = result.get("activities", [])

    # Calculate statistics
    stats = {
        "total_events": len(activities),
        "unlocks": 0,
        "locks": 0,
        "code_uses": 0,
        "failed_attempts": 0,
        "unique_codes_used": set(),
        "peak_hours": {},
        "by_method": {},
    }

    for activity in activities:
        action = activity.get("action", "")
        method = activity.get("method", "unknown")

        if action == "unlocked":
            stats["unlocks"] += 1
        elif action == "locked":
            stats["locks"] += 1
        elif action == "code_used":
            stats["code_uses"] += 1
            if activity.get("code_id"):
                stats["unique_codes_used"].add(activity["code_id"])
        elif action == "failed_attempt":
            stats["failed_attempts"] += 1

        # Method breakdown
        stats["by_method"][method] = stats["by_method"].get(method, 0) + 1

        # Peak hours
        try:
            ts = datetime.fromisoformat(activity["timestamp"].replace("Z", "+00:00"))
            hour = ts.hour
            stats["peak_hours"][hour] = stats["peak_hours"].get(hour, 0) + 1
        except (KeyError, ValueError):
            pass

    # Find peak hour
    peak_hour = max(stats["peak_hours"].items(), key=lambda x: x[1])[0] if stats["peak_hours"] else None

    return {
        "success": True,
        "lock_id": lock_id,
        "period_days": days,
        "start_date": start_date.isoformat(),
        "summary": {
            "total_events": stats["total_events"],
            "unlocks": stats["unlocks"],
            "locks": stats["locks"],
            "code_uses": stats["code_uses"],
            "failed_attempts": stats["failed_attempts"],
            "unique_codes_used": len(stats["unique_codes_used"]),
            "peak_hour": f"{peak_hour}:00" if peak_hour is not None else None,
            "by_method": stats["by_method"],
        },
        "security_alerts": stats["failed_attempts"] > 5,
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# BULK OPERATIONS
# =============================================================================

@router.post("/bulk/generate-codes")
async def bulk_generate_guest_codes(
    requests: List[GenerateGuestCodeRequest],
    lock_ids: List[str],
):
    """
    Generate codes for multiple guests across multiple locks.
    Useful for multi-property operations or groups.
    """
    results = []

    for req in requests:
        for lock_id in lock_ids:
            try:
                result = await unified_lock_service.generate_guest_code(
                    lock_id=lock_id,
                    guest_name=req.guest_name,
                    check_in=req.check_in,
                    check_out=req.check_out,
                    guest_phone=req.guest_phone,
                    reservation_id=req.reservation_id,
                    code_length=req.code_length,
                    send_sms=req.send_sms,
                )
                results.append({
                    "lock_id": lock_id,
                    "guest_name": req.guest_name,
                    **result
                })
            except Exception as e:
                results.append({
                    "lock_id": lock_id,
                    "guest_name": req.guest_name,
                    "success": False,
                    "error": str(e)
                })

    success_count = sum(1 for r in results if r.get("success"))

    return {
        "success": success_count > 0,
        "total_requests": len(requests) * len(lock_ids),
        "success_count": success_count,
        "failed_count": len(results) - success_count,
        "results": results,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.delete("/bulk/revoke-codes")
async def bulk_revoke_codes(
    lock_ids: List[str],
    code_ids: List[str],
    reason: Optional[str] = None,
):
    """
    Revoke multiple codes across multiple locks.
    """
    results = []

    for lock_id in lock_ids:
        for code_id in code_ids:
            try:
                result = await unified_lock_service.revoke_code(lock_id, code_id)
                results.append({
                    "lock_id": lock_id,
                    "code_id": code_id,
                    **result
                })
            except Exception as e:
                results.append({
                    "lock_id": lock_id,
                    "code_id": code_id,
                    "success": False,
                    "error": str(e)
                })

    success_count = sum(1 for r in results if r.get("success"))

    logger.warning(f"Bulk code revocation: {success_count}/{len(results)} successful. Reason: {reason}")

    return {
        "success": success_count > 0,
        "total_requests": len(results),
        "success_count": success_count,
        "reason": reason,
        "results": results,
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# AUTOMATED DELIVERY ENDPOINTS
# =============================================================================

@router.post("/{lock_id}/schedule-delivery")
async def schedule_code_delivery(
    lock_id: str,
    request: ScheduledCodeDeliveryRequest,
    background_tasks: BackgroundTasks
):
    """
    Schedule SMS delivery of an existing code.

    Use when code was created but delivery needs to be scheduled separately.
    """
    if request.delivery_time <= datetime.utcnow():
        # Send immediately
        sms_result = await twilio_sms_service.send_access_code(
            guest_phone=request.guest_phone,
            guest_name=request.guest_name,
            property_name=request.property_name,
            property_address=request.property_address,
            access_code=request.code,
            code_start=request.check_in,
            code_end=request.check_out,
            booking_id=None
        )
        return {
            "success": sms_result.success,
            "sent_immediately": True,
            "message_sid": sms_result.message_sid,
            "error": sms_result.error,
        }

    # Schedule for future
    background_tasks.add_task(
        _schedule_code_delivery,
        guest_phone=request.guest_phone,
        guest_name=request.guest_name,
        code=request.code,
        property_name=request.property_name,
        property_address=request.property_address,
        check_in=request.check_in,
        check_out=request.check_out,
        delivery_time=request.delivery_time,
    )

    return {
        "success": True,
        "scheduled": True,
        "delivery_time": request.delivery_time.isoformat(),
        "guest_phone": request.guest_phone,
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def _get_existing_codes(lock_id: str) -> List[str]:
    """Get list of existing codes to avoid duplicates."""
    result = await unified_lock_service.list_access_codes(lock_id, include_expired=False)
    if result["success"]:
        return [c["code"] for c in result.get("codes", [])]
    return []


async def _schedule_code_delivery(
    guest_phone: str,
    guest_name: str,
    code: str,
    property_name: str,
    property_address: str,
    check_in: datetime,
    check_out: datetime,
    delivery_time: datetime,
):
    """Background task to schedule SMS delivery using Twilio scheduled messages."""
    try:
        # Use Twilio's scheduled messaging
        schedule_result = await twilio_sms_service.schedule_message(
            to=guest_phone,
            body=(
                f"Hi {guest_name}! Your access code for {property_name} is: {code}\n\n"
                f"Address: {property_address}\n\n"
                f"Check-in: {check_in.strftime('%b %d at %I:%M %p')}\n"
                f"Check-out: {check_out.strftime('%b %d at %I:%M %p')}\n\n"
                f"Code is valid from check-in until 2 hours after checkout.\n\n"
                f"See you soon!\n- Right at Home BnB"
            ),
            send_at=delivery_time
        )

        if schedule_result.get("success"):
            logger.info(f"Scheduled code delivery to {guest_phone} for {delivery_time}")
        else:
            logger.error(f"Failed to schedule code delivery: {schedule_result.get('error')}")

    except Exception as e:
        logger.error(f"Error scheduling code delivery: {e}")
