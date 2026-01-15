"""
Right At Home BnB - Smart Home API Routes
==========================================
API endpoints for:
- Google Nest thermostat control
- Smart lock management
- Energy monitoring
- Device health

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from services.smart_home import smart_home_service

router = APIRouter()


# ============================================================================
# REQUEST MODELS
# ============================================================================

class DeviceRegistrationRequest(BaseModel):
    property_id: int
    device_type: str = Field(..., description="thermostat, lock, camera, plug, switch, sensor")
    brand: str = Field(..., description="Google Nest, Schlage, Yale, August, Ring, etc.")
    model: Optional[str] = None
    device_id: Optional[str] = None
    room: Optional[str] = None
    location_description: Optional[str] = None
    integration_type: Optional[str] = None
    api_endpoint: Optional[str] = None


class ThermostatRequest(BaseModel):
    property_id: int
    target_temp: int = Field(..., ge=50, le=90)
    mode: Optional[str] = None  # heat, cool, heat-cool, off


class GuestCodeRequest(BaseModel):
    property_id: int
    guest_name: str
    check_in: str
    check_out: str


# ============================================================================
# DEVICE MANAGEMENT
# ============================================================================

@router.post("/devices")
async def register_device(request: DeviceRegistrationRequest):
    """Register a smart home device for a property."""
    return await smart_home_service.register_device(**request.dict())


@router.get("/devices/{property_id}")
async def get_property_devices(property_id: int):
    """Get all smart home devices for a property."""
    return await smart_home_service.get_property_devices(property_id)


@router.get("/devices")
async def get_all_devices():
    """Get all smart home devices across all properties."""
    return await smart_home_service.get_all_devices()


@router.get("/health")
async def check_devices_health():
    """Check health status of all smart home devices."""
    return await smart_home_service.check_all_devices_health()


# ============================================================================
# THERMOSTAT CONTROL
# ============================================================================

@router.get("/thermostat/{property_id}")
async def get_thermostat_status(property_id: int, device_id: Optional[str] = None):
    """Get thermostat status."""
    return await smart_home_service.get_thermostat_status(property_id, device_id)


@router.post("/thermostat/set")
async def set_thermostat(request: ThermostatRequest):
    """Set thermostat temperature."""
    return await smart_home_service.set_thermostat_temp(
        property_id=request.property_id,
        target_temp=request.target_temp,
        mode=request.mode
    )


@router.post("/thermostat/checkin/{property_id}")
async def schedule_for_checkin(property_id: int, checkin_time: str, preferred_temp: int = 72):
    """Schedule thermostat for guest check-in."""
    return await smart_home_service.set_thermostat_for_checkin(
        property_id=property_id,
        checkin_time=checkin_time,
        preferred_temp=preferred_temp
    )


@router.post("/thermostat/checkout/{property_id}")
async def set_eco_mode(property_id: int, eco_temp: int = 78):
    """Set thermostat to eco mode after checkout."""
    return await smart_home_service.set_thermostat_for_checkout(property_id, eco_temp)


# ============================================================================
# LOCK CONTROL
# ============================================================================

@router.get("/lock/{property_id}")
async def get_lock_status(property_id: int, device_id: Optional[str] = None):
    """Get smart lock status."""
    return await smart_home_service.get_lock_status(property_id, device_id)


@router.post("/lock/{property_id}/lock")
async def lock_door(property_id: int, device_id: Optional[str] = None):
    """Lock the door."""
    return await smart_home_service.lock_door(property_id, device_id)


@router.post("/lock/{property_id}/unlock")
async def unlock_door(property_id: int, device_id: Optional[str] = None):
    """Unlock the door."""
    return await smart_home_service.unlock_door(property_id, device_id)


@router.post("/lock/guest-code")
async def generate_guest_code(request: GuestCodeRequest):
    """Generate temporary guest access code."""
    return await smart_home_service.generate_guest_code(**request.dict())


# ============================================================================
# ENERGY MONITORING
# ============================================================================

@router.get("/energy/{property_id}")
async def get_energy_usage(property_id: int, period: str = "day"):
    """Get energy usage data for a property."""
    return await smart_home_service.get_energy_usage(property_id, period)


# ============================================================================
# ACTIVITY LOG
# ============================================================================

@router.get("/activity")
async def get_device_activity(property_id: Optional[int] = None, limit: int = 50):
    """Get recent smart home device activity."""
    return await smart_home_service.get_device_activity(property_id, limit)
