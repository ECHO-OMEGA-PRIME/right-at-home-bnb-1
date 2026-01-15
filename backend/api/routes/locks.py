"""
Smart Lock API Routes
Integrates with Schlage, Yale, August APIs for real lock control
@author ECHO OMEGA PRIME
"""

from typing import Optional, List
from datetime import datetime, date
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from loguru import logger

# Import the smart lock service
import sys
sys.path.insert(0, "P:/SOVEREIGN_APPS/RightAtHomeBnB/backend")
from services.smart_locks import smart_lock_service, SmartLockService, LockProvider

router = APIRouter()


# Request/Response Models
class RegisterLockRequest(BaseModel):
    lock_id: str
    name: str
    property_id: str
    provider: str = Field(..., pattern="^(schlage|yale|august)$")
    api_key: str
    model: Optional[str] = None
    location: Optional[str] = None


class GuestAccessRequest(BaseModel):
    lock_ids: List[str]
    guest_name: str
    check_in: datetime
    check_out: datetime
    reservation_id: Optional[str] = None


class CleanerAccessRequest(BaseModel):
    lock_ids: List[str]
    cleaner_name: str
    access_date: date
    start_time: str = "09:00"
    end_time: str = "17:00"


class UnlockRequest(BaseModel):
    duration_seconds: int = Field(default=30, ge=5, le=300)


class AccessCodeRequest(BaseModel):
    code_name: str
    access_code: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


# Lock Registration & Status
@router.post("/register")
async def register_lock(request: RegisterLockRequest):
    """Register a new smart lock with the system"""
    try:
        provider = LockProvider(request.provider)
        result = await smart_lock_service.register_lock(
            lock_id=request.lock_id,
            provider=provider,
            api_key=request.api_key,
            name=request.name,
            property_id=request.property_id,
            model=request.model,
            location=request.location,
        )
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error"))
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
async def list_locks(property_id: Optional[str] = None):
    """List all registered locks"""
    result = await smart_lock_service.list_locks(property_id=property_id)
    return result


@router.get("/{lock_id}")
async def get_lock_status(lock_id: str):
    """Get detailed lock status including battery and recent activity"""
    result = await smart_lock_service.get_lock_status(lock_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@router.delete("/{lock_id}")
async def unregister_lock(lock_id: str):
    """Remove a lock from the system"""
    result = await smart_lock_service.unregister_lock(lock_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


# Lock Control
@router.post("/{lock_id}/lock")
async def lock_door(lock_id: str):
    """Lock the door remotely"""
    result = await smart_lock_service.lock(lock_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error"))
    logger.info(f"Lock {lock_id} locked remotely")
    return result


@router.post("/{lock_id}/unlock")
async def unlock_door(lock_id: str, request: UnlockRequest = None):
    """Unlock the door remotely (auto-locks after duration)"""
    duration = request.duration_seconds if request else 30
    result = await smart_lock_service.unlock(lock_id, duration_seconds=duration)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error"))
    logger.info(f"Lock {lock_id} unlocked for {duration}s")
    return result


# Access Code Management
@router.post("/access/guest")
async def create_guest_access(request: GuestAccessRequest):
    """Create time-limited access codes for guest stay"""
    if request.check_out <= request.check_in:
        raise HTTPException(status_code=400, detail="Check-out must be after check-in")

    result = await smart_lock_service.create_guest_access(
        lock_ids=request.lock_ids,
        guest_name=request.guest_name,
        check_in=request.check_in,
        check_out=request.check_out,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error"))

    logger.info(f"Guest access created for {request.guest_name}: {len(request.lock_ids)} locks")
    return result


@router.post("/access/cleaner")
async def create_cleaner_access(request: CleanerAccessRequest):
    """Create time-windowed access for cleaning staff"""
    try:
        start_hour, start_min = map(int, request.start_time.split(":"))
        end_hour, end_min = map(int, request.end_time.split(":"))
        start_dt = datetime.combine(request.access_date, datetime.min.time().replace(hour=start_hour, minute=start_min))
        end_dt = datetime.combine(request.access_date, datetime.min.time().replace(hour=end_hour, minute=end_min))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

    result = await smart_lock_service.create_cleaner_access(
        lock_ids=request.lock_ids,
        cleaner_name=request.cleaner_name,
        start_time=start_dt,
        end_time=end_dt,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error"))

    logger.info(f"Cleaner access created for {request.cleaner_name}: {request.access_date}")
    return result


@router.post("/{lock_id}/codes")
async def add_access_code(lock_id: str, request: AccessCodeRequest):
    """Add a custom access code to a lock"""
    result = await smart_lock_service.add_access_code(
        lock_id=lock_id,
        code_name=request.code_name,
        access_code=request.access_code,
        start_time=request.start_time,
        end_time=request.end_time,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result


@router.get("/{lock_id}/codes")
async def list_access_codes(lock_id: str, active_only: bool = True):
    """List all access codes for a lock"""
    result = await smart_lock_service.list_access_codes(lock_id, active_only=active_only)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@router.delete("/{lock_id}/codes/{code_id}")
async def revoke_access_code(lock_id: str, code_id: str):
    """Revoke an access code immediately"""
    result = await smart_lock_service.revoke_access_code(lock_id, code_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error"))
    logger.warning(f"Access code {code_id} revoked for lock {lock_id}")
    return result


# Activity & Monitoring
@router.get("/{lock_id}/activity")
async def get_lock_activity(
    lock_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(default=50, le=200),
):
    """Get access history for a lock"""
    result = await smart_lock_service.get_activity_log(
        lock_id=lock_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@router.get("/property/{property_id}/activity")
async def get_property_activity(
    property_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(default=100, le=500),
):
    """Get combined activity for all locks at a property"""
    result = await smart_lock_service.get_property_activity(
        property_id=property_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@router.get("/battery/alerts")
async def get_battery_alerts(threshold: int = Query(default=20, ge=5, le=50)):
    """Get locks with low battery"""
    result = await smart_lock_service.get_low_battery_locks(threshold=threshold)
    return result


@router.get("/health")
async def check_locks_health():
    """Health check for all registered locks"""
    result = await smart_lock_service.health_check()
    return result


# Batch Operations
@router.post("/property/{property_id}/lock-all")
async def lock_all_property_doors(property_id: str):
    """Lock all doors at a property"""
    result = await smart_lock_service.lock_all_property(property_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error"))
    logger.info(f"All locks secured at property {property_id}")
    return result


@router.post("/checkout/{reservation_id}")
async def process_checkout(reservation_id: str):
    """Process guest checkout: revoke codes and lock all doors"""
    result = await smart_lock_service.process_checkout(reservation_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error"))
    logger.info(f"Checkout processed for reservation {reservation_id}")
    return result


# Code Generation Utility
@router.get("/generate-code")
async def generate_access_code(
    length: int = Query(default=6, ge=4, le=8),
    exclude_patterns: bool = True,
):
    """Generate a secure random access code"""
    code = SmartLockService.generate_access_code(
        length=length,
        exclude_patterns=exclude_patterns,
    )
    return {
        "success": True,
        "code": code,
        "length": length,
        "pattern_safe": exclude_patterns,
    }
