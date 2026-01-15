"""
Right at Home BnB - Smart Lock API Routes
Complete API endpoints for lock management, access codes, and activity logs
@author ECHO OMEGA PRIME
"""

from typing import Optional, List
from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field, validator
from loguru import logger

from services.smart_locks import (
    unified_lock_service,
    LockProviderType,
    CodeType,
)

router = APIRouter(prefix="/locks", tags=["Smart Locks"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class GenerateCodeRequest(BaseModel):
    """Request to generate a guest access code."""
    guest_name: str = Field(..., min_length=1, max_length=100)
    check_in: datetime
    check_out: datetime
    guest_phone: Optional[str] = Field(None, pattern=r"^\+?[1-9]\d{9,14}$")
    reservation_id: Optional[str] = None
    code_length: int = Field(default=6, ge=4, le=8)
    send_sms: bool = True

    @validator("check_out")
    def check_out_after_check_in(cls, v, values):
        if "check_in" in values and v <= values["check_in"]:
            raise ValueError("check_out must be after check_in")
        return v


class RevokeCodeRequest(BaseModel):
    """Request to revoke an access code."""
    reason: Optional[str] = None


class LockActionRequest(BaseModel):
    """Request for lock/unlock actions."""
    duration_seconds: int = Field(default=30, ge=5, le=300)


class GuestAccessRequest(BaseModel):
    """Request to create guest access across multiple locks."""
    lock_ids: List[str]
    guest_name: str
    check_in: datetime
    check_out: datetime
    guest_phone: Optional[str] = None
    reservation_id: Optional[str] = None
    send_sms: bool = True


class CleanerAccessRequest(BaseModel):
    """Request to create cleaner access."""
    lock_ids: List[str]
    cleaner_name: str
    access_date: date
    start_time: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(default="17:00", pattern=r"^\d{2}:\d{2}$")


class BatchLockRequest(BaseModel):
    """Request to lock multiple locks."""
    lock_ids: List[str]


# =============================================================================
# LOCK MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/")
async def list_locks(
    property_id: Optional[str] = None,
    provider: Optional[str] = None,
    online_only: bool = False,
):
    """
    List all smart locks.

    - **property_id**: Filter by property
    - **provider**: Filter by provider (schlage, yale, august, kwikset)
    - **online_only**: Only return online locks
    """
    result = await unified_lock_service.list_all_locks(property_id=property_id)

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to list locks"))

    locks = result["locks"]

    # Filter by provider
    if provider:
        locks = [l for l in locks if l["provider"].lower() == provider.lower()]

    # Filter by online status
    if online_only:
        locks = [l for l in locks if l.get("is_online", True)]

    result["locks"] = locks
    result["count"] = len(locks)

    return result


@router.get("/{lock_id}")
async def get_lock_status(lock_id: str):
    """
    Get detailed status of a specific lock.

    Returns battery level, lock state, connectivity, and current code info.
    """
    result = await unified_lock_service.get_lock_status(lock_id)

    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Lock not found"))

    return result


@router.get("/{lock_id}/status")
async def get_lock_full_status(lock_id: str):
    """
    Get comprehensive status including battery, connectivity, and codes.
    """
    status = await unified_lock_service.get_lock_status(lock_id)
    battery = await unified_lock_service.get_battery_status(lock_id)
    codes = await unified_lock_service.list_access_codes(lock_id)

    return {
        "success": True,
        "lock": status,
        "battery": battery,
        "active_codes_count": codes.get("count", 0),
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# LOCK CONTROL ENDPOINTS
# =============================================================================

@router.post("/{lock_id}/lock")
async def lock_door(lock_id: str):
    """
    Lock the door remotely.
    """
    result = await unified_lock_service.lock(lock_id)

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to lock"))

    logger.info(f"Lock {lock_id} locked remotely via API")
    return result


@router.post("/{lock_id}/unlock")
async def unlock_door(lock_id: str, request: LockActionRequest = None):
    """
    Unlock the door remotely.

    Auto-locks after duration_seconds (default 30s, max 5 min).
    """
    duration = request.duration_seconds if request else 30

    result = await unified_lock_service.unlock(lock_id, duration_seconds=duration)

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to unlock"))

    logger.info(f"Lock {lock_id} unlocked remotely for {duration}s via API")
    return result


# =============================================================================
# ACCESS CODE ENDPOINTS
# =============================================================================

@router.post("/{lock_id}/generate-code")
async def generate_guest_code(lock_id: str, request: GenerateCodeRequest):
    """
    Generate a unique guest access code.

    - Creates a secure 4-8 digit code (default 6)
    - Code activates at check-in time
    - Code expires 30 minutes after checkout
    - Optionally sends SMS to guest with code
    - Prevents duplicate codes across all locks
    """
    result = await unified_lock_service.generate_guest_code(
        lock_id=lock_id,
        guest_name=request.guest_name,
        check_in=request.check_in,
        check_out=request.check_out,
        guest_phone=request.guest_phone,
        reservation_id=request.reservation_id,
        code_length=request.code_length,
        send_sms=request.send_sms,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate code"))

    logger.info(f"Generated code for {request.guest_name} on lock {lock_id}")
    return result


@router.get("/{lock_id}/codes")
async def list_access_codes(
    lock_id: str,
    include_expired: bool = False,
):
    """
    List all access codes for a lock.

    - **include_expired**: Include expired codes in results
    """
    result = await unified_lock_service.list_access_codes(
        lock_id=lock_id,
        include_expired=include_expired,
    )

    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Lock not found"))

    return result


@router.delete("/{lock_id}/codes/{code_id}")
async def revoke_access_code(lock_id: str, code_id: str, request: RevokeCodeRequest = None):
    """
    Revoke an access code immediately.

    Use for early checkouts, security concerns, or guest issues.
    """
    result = await unified_lock_service.revoke_code(lock_id, code_id)

    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Code not found"))

    reason = request.reason if request else "No reason provided"
    logger.warning(f"Access code {code_id} revoked for lock {lock_id}. Reason: {reason}")

    return result


# =============================================================================
# ACTIVITY LOG ENDPOINTS
# =============================================================================

@router.get("/{lock_id}/logs")
async def get_lock_activity(
    lock_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(default=50, le=200),
):
    """
    Get activity log for a lock.

    Shows all lock/unlock events, code uses, and failed attempts.

    - **start_date**: Filter from date
    - **end_date**: Filter to date
    - **limit**: Maximum entries (max 200)
    """
    start_dt = datetime.combine(start_date, datetime.min.time()) if start_date else None
    end_dt = datetime.combine(end_date, datetime.max.time()) if end_date else None

    result = await unified_lock_service.get_activity_log(
        lock_id=lock_id,
        start_date=start_dt,
        end_date=end_dt,
        limit=limit,
    )

    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Lock not found"))

    return result


# =============================================================================
# BATCH OPERATIONS
# =============================================================================

@router.post("/access/guest")
async def create_multi_lock_guest_access(request: GuestAccessRequest):
    """
    Create access codes for a guest across multiple locks.

    Generates a single code that works on all specified locks.
    Useful for properties with multiple entry points.
    """
    if request.check_out <= request.check_in:
        raise HTTPException(status_code=400, detail="Check-out must be after check-in")

    results = []
    code = None

    for lock_id in request.lock_ids:
        result = await unified_lock_service.generate_guest_code(
            lock_id=lock_id,
            guest_name=request.guest_name,
            check_in=request.check_in,
            check_out=request.check_out,
            guest_phone=request.guest_phone if not code else None,  # Only SMS first lock
            reservation_id=request.reservation_id,
            send_sms=request.send_sms if not code else False,
        )

        if result["success"]:
            if not code:
                code = result["code"]
            results.append({
                "lock_id": lock_id,
                "success": True,
                "code_id": result["code_id"],
            })
        else:
            results.append({
                "lock_id": lock_id,
                "success": False,
                "error": result.get("error"),
            })

    success_count = sum(1 for r in results if r["success"])

    logger.info(f"Created guest access for {request.guest_name}: {success_count}/{len(request.lock_ids)} locks")

    return {
        "success": success_count > 0,
        "guest_name": request.guest_name,
        "access_code": code,
        "valid_from": request.check_in.isoformat(),
        "valid_until": (request.check_out + timedelta(minutes=30)).isoformat(),
        "locks": results,
        "success_count": success_count,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/access/cleaner")
async def create_cleaner_access(request: CleanerAccessRequest):
    """
    Create time-limited access for cleaning staff.

    Access is restricted to the specified time window on the access date.
    """
    try:
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

    results = []

    for lock_id in request.lock_ids:
        result = await unified_lock_service.generate_guest_code(
            lock_id=lock_id,
            guest_name=f"Cleaner: {request.cleaner_name}",
            check_in=start_dt,
            check_out=end_dt,
            send_sms=False,
        )

        results.append({
            "lock_id": lock_id,
            "success": result["success"],
            "code": result.get("code"),
            "code_id": result.get("code_id"),
        })

    logger.info(f"Created cleaner access for {request.cleaner_name}: {request.access_date}")

    return {
        "success": True,
        "cleaner_name": request.cleaner_name,
        "access_date": request.access_date.isoformat(),
        "time_window": f"{request.start_time} - {request.end_time}",
        "locks": results,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/batch/lock")
async def lock_multiple(request: BatchLockRequest):
    """
    Lock multiple doors at once.

    Useful for end-of-day security or checkout verification.
    """
    results = []

    for lock_id in request.lock_ids:
        result = await unified_lock_service.lock(lock_id)
        results.append({
            "lock_id": lock_id,
            "success": result["success"],
        })

    success_count = sum(1 for r in results if r["success"])

    logger.info(f"Batch lock: {success_count}/{len(request.lock_ids)} locks secured")

    return {
        "success": success_count == len(request.lock_ids),
        "results": results,
        "success_count": success_count,
        "total": len(request.lock_ids),
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# MONITORING & MAINTENANCE
# =============================================================================

@router.get("/battery/alerts")
async def get_battery_alerts(threshold: int = Query(default=20, ge=5, le=50)):
    """
    Get all locks with low battery.

    - **threshold**: Battery percentage threshold (default 20%)
    """
    result = await unified_lock_service.get_low_battery_alerts(threshold=threshold)
    return result


@router.get("/health")
async def check_locks_health():
    """
    Health check for all registered locks.

    Returns connectivity status, battery levels, and any issues.
    """
    result = await unified_lock_service.health_check()
    return result


@router.post("/maintenance/cleanup-expired")
async def cleanup_expired_codes(background_tasks: BackgroundTasks):
    """
    Clean up expired access codes from all locks.

    Runs in background to avoid timeout on large code counts.
    """
    background_tasks.add_task(unified_lock_service.cleanup_expired_codes)

    return {
        "success": True,
        "message": "Expired code cleanup started in background",
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# UTILITY ENDPOINTS
# =============================================================================

@router.get("/generate-code-preview")
async def preview_generate_code(
    length: int = Query(default=6, ge=4, le=8),
    exclude_patterns: bool = True,
):
    """
    Preview a generated access code without creating it.

    Useful for testing code generation settings.
    """
    from services.smart_locks.base import SmartLockProvider

    code = SmartLockProvider.generate_access_code(
        length=length,
        exclude_patterns=exclude_patterns,
    )

    return {
        "success": True,
        "preview_code": code,
        "length": length,
        "pattern_safe": exclude_patterns,
        "note": "This is a preview only - code not saved to any lock",
    }


@router.get("/providers")
async def list_providers():
    """
    List all supported lock providers.
    """
    return {
        "success": True,
        "providers": [
            {
                "id": "SCHLAGE",
                "name": "Schlage",
                "models": ["Encode WiFi", "Encode Plus WiFi"],
                "max_codes": 100,
            },
            {
                "id": "YALE",
                "name": "Yale",
                "models": ["Assure Lock", "Assure Lock 2", "Assure Lock SL"],
                "max_codes": 250,
            },
            {
                "id": "AUGUST",
                "name": "August",
                "models": ["Smart Lock Pro", "WiFi Smart Lock", "Smart Lock Pro 2nd Gen"],
                "max_codes": 200,
            },
            {
                "id": "KWIKSET",
                "name": "Kwikset",
                "models": ["Halo WiFi", "Halo Touch", "Halo Select", "Aura"],
                "max_codes": 250,
            },
        ],
    }
