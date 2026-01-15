"""
Smart Lock schemas for Right at Home BnB
Schlage, Yale, August, Kwikset integration
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, date, time
from enum import Enum
from .base import BaseSchema, TimestampMixin, IDMixin


class LockBrand(str, Enum):
    """Smart lock brand"""
    SCHLAGE = "SCHLAGE"
    YALE = "YALE"
    AUGUST = "AUGUST"
    KWIKSET = "KWIKSET"
    LEVEL = "LEVEL"
    ULTRALOQ = "ULTRALOQ"
    OTHER = "OTHER"


class LockStatus(str, Enum):
    """Lock status"""
    LOCKED = "LOCKED"
    UNLOCKED = "UNLOCKED"
    UNKNOWN = "UNKNOWN"
    OFFLINE = "OFFLINE"
    JAMMED = "JAMMED"


class CodeType(str, Enum):
    """Access code type"""
    PERMANENT = "PERMANENT"
    TEMPORARY = "TEMPORARY"
    ONE_TIME = "ONE_TIME"
    SCHEDULED = "SCHEDULED"
    CLEANER = "CLEANER"
    EMERGENCY = "EMERGENCY"


class AccessMethod(str, Enum):
    """How the lock was accessed"""
    CODE = "CODE"
    APP = "APP"
    MANUAL = "MANUAL"
    AUTO = "AUTO"
    KEY = "KEY"
    REMOTE = "REMOTE"


class DayOfWeek(str, Enum):
    """Days of week for scheduled access"""
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"
    SUNDAY = "SUNDAY"


class ScheduledAccessWindow(BaseModel):
    """Time window for scheduled access codes"""
    days: List[DayOfWeek]
    start_time: time
    end_time: time


class AccessCode(BaseModel):
    """Access code details"""
    code_id: str
    code: str = Field(..., min_length=4, max_length=10)
    name: str = Field(..., max_length=100, description="Label for the code")
    code_type: CodeType
    is_active: bool = Field(default=True)

    # Validity
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None

    # Usage limits
    max_uses: Optional[int] = Field(default=None, ge=1)
    uses_remaining: Optional[int] = None
    total_uses: int = Field(default=0)
    last_used: Optional[datetime] = None

    # Schedule
    schedule: Optional[ScheduledAccessWindow] = None

    # Metadata
    created_at: datetime
    created_by: Optional[str] = None
    notes: Optional[str] = None


class LockActivity(BaseModel):
    """Lock activity log entry"""
    timestamp: datetime
    action: str = Field(..., description="locked, unlocked, jammed, etc.")
    method: AccessMethod
    code_name: Optional[str] = None
    user: Optional[str] = None
    success: bool = Field(default=True)
    error_message: Optional[str] = None


class LockBatteryAlert(BaseModel):
    """Battery level alert"""
    lock_id: str
    lock_name: str
    property_id: str
    battery_level: int = Field(..., ge=0, le=100)
    is_critical: bool = Field(default=False)
    estimated_days_remaining: Optional[int] = None


# ============================================
# CRUD SCHEMAS
# ============================================

class SmartLockBase(BaseSchema):
    """Base smart lock schema"""
    property_id: str
    brand: LockBrand
    model: Optional[str] = Field(default=None, max_length=100)
    name: str = Field(..., min_length=1, max_length=255, description="Lock name/location")
    device_id: str = Field(..., min_length=1, max_length=255)
    serial_number: Optional[str] = Field(default=None, max_length=100)


class SmartLockCreate(SmartLockBase):
    """Schema for adding a new smart lock"""
    api_token: Optional[str] = Field(default=None, description="Provider API token")
    master_code: Optional[str] = Field(default=None, min_length=4, max_length=10)


class SmartLockUpdate(BaseSchema):
    """Schema for updating a smart lock (all fields optional)"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    model: Optional[str] = Field(default=None, max_length=100)
    api_token: Optional[str] = None
    is_active: Optional[bool] = None


class SmartLockResponse(SmartLockBase, IDMixin, TimestampMixin):
    """Full smart lock response schema"""
    # Status
    status: LockStatus = LockStatus.UNKNOWN
    is_online: bool = Field(default=False)
    last_seen: Optional[datetime] = None

    # Battery
    battery_level: Optional[int] = Field(default=None, ge=0, le=100)
    battery_low: bool = Field(default=False)

    # Current code
    current_guest_code: Optional[str] = None
    guest_code_expires: Optional[datetime] = None

    # Stats
    total_codes: int = Field(default=0)
    active_codes: int = Field(default=0)

    # Property info
    property_name: Optional[str] = None
    property_address: Optional[str] = None


class SmartLockListResponse(BaseSchema):
    """Simplified lock for list views"""
    id: str
    property_id: str
    property_name: str
    name: str
    brand: LockBrand
    status: LockStatus
    battery_level: Optional[int] = None
    is_online: bool
    active_codes: int


# ============================================
# CODE MANAGEMENT SCHEMAS
# ============================================

class CreateAccessCodeRequest(BaseSchema):
    """Request to create an access code"""
    lock_id: str
    name: str = Field(..., min_length=1, max_length=100)
    code: Optional[str] = Field(
        default=None,
        min_length=4,
        max_length=10,
        pattern=r"^\d{4,10}$",
        description="Custom code or auto-generate"
    )
    code_type: CodeType = CodeType.TEMPORARY

    # Validity
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None

    # Usage limits
    max_uses: Optional[int] = Field(default=None, ge=1)

    # Schedule (for SCHEDULED type)
    schedule: Optional[ScheduledAccessWindow] = None

    notes: Optional[str] = Field(default=None, max_length=500)


class CreateGuestAccessRequest(BaseSchema):
    """Request to create guest access codes for a booking"""
    booking_id: str
    lock_ids: List[str] = Field(..., min_length=1)
    guest_name: str
    check_in: datetime
    check_out: datetime
    custom_code: Optional[str] = Field(
        default=None,
        min_length=4,
        max_length=10,
        pattern=r"^\d{4,10}$"
    )


class CreateCleanerAccessRequest(BaseSchema):
    """Request to create cleaner access code"""
    cleaner_id: str
    lock_ids: List[str] = Field(..., min_length=1)
    schedule: ScheduledAccessWindow


class UpdateAccessCodeRequest(BaseSchema):
    """Request to update an access code"""
    lock_id: str
    code_id: str
    name: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None
    valid_until: Optional[datetime] = None
    max_uses: Optional[int] = Field(default=None, ge=1)
    schedule: Optional[ScheduledAccessWindow] = None


class DeleteAccessCodeRequest(BaseSchema):
    """Request to delete an access code"""
    lock_id: str
    code_id: str


class BulkCodeOperation(BaseSchema):
    """Bulk code operation (activate/deactivate/delete)"""
    lock_id: str
    code_ids: List[str]
    operation: str = Field(..., description="activate, deactivate, delete")


# ============================================
# LOCK OPERATIONS
# ============================================

class LockOperationRequest(BaseSchema):
    """Request to lock/unlock"""
    lock_id: str
    duration_seconds: Optional[int] = Field(
        default=30,
        ge=5,
        le=300,
        description="For unlock: auto-relock after seconds"
    )


class LockOperationResponse(BaseSchema):
    """Response from lock operation"""
    lock_id: str
    lock_name: str
    action: str
    status: LockStatus
    success: bool
    error_message: Optional[str] = None
    timestamp: datetime


class LockStatusResponse(BaseSchema):
    """Detailed lock status"""
    lock_id: str
    lock_name: str
    property_name: str
    status: LockStatus
    is_online: bool
    battery_level: Optional[int] = None
    battery_low: bool = Field(default=False)
    last_activity: Optional[LockActivity] = None
    last_locked: Optional[datetime] = None
    last_unlocked: Optional[datetime] = None
    active_codes: int
    timestamp: datetime


class LockActivityRequest(BaseSchema):
    """Request for lock activity log"""
    lock_id: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    limit: int = Field(default=50, ge=1, le=500)
    actions: Optional[List[str]] = Field(default=None, description="Filter by action types")


class LockActivityResponse(BaseSchema):
    """Lock activity log response"""
    lock_id: str
    lock_name: str
    activities: List[LockActivity]
    total_count: int
    timestamp: datetime


# ============================================
# ANALYTICS & REPORTS
# ============================================

class LockAnalytics(BaseSchema):
    """Lock usage analytics"""
    lock_id: str
    lock_name: str
    property_name: str
    period_start: datetime
    period_end: datetime

    total_locks: int
    total_unlocks: int
    total_code_uses: int
    unique_codes_used: int
    failed_attempts: int

    most_used_code: Optional[str] = None
    busiest_hour: Optional[int] = Field(default=None, ge=0, le=23)
    busiest_day: Optional[str] = None

    avg_battery_drain_per_day: Optional[float] = None


class AllLocksStatus(BaseSchema):
    """Status of all locks"""
    total_locks: int
    online_locks: int
    offline_locks: int
    low_battery_locks: int
    locks: List[SmartLockListResponse]
    alerts: List[LockBatteryAlert] = Field(default_factory=list)


class LockCodeReport(BaseSchema):
    """Report of all active codes across locks"""
    generated_at: datetime
    total_locks: int
    total_active_codes: int
    codes_expiring_soon: int = Field(description="Expiring in 24 hours")
    expired_codes: int

    codes_by_type: Dict[str, int] = Field(default_factory=dict)
    codes_by_property: List[Dict[str, Any]] = Field(default_factory=list)


# Export all
__all__ = [
    'LockBrand',
    'LockStatus',
    'CodeType',
    'AccessMethod',
    'DayOfWeek',
    'ScheduledAccessWindow',
    'AccessCode',
    'LockActivity',
    'LockBatteryAlert',
    'SmartLockBase',
    'SmartLockCreate',
    'SmartLockUpdate',
    'SmartLockResponse',
    'SmartLockListResponse',
    'CreateAccessCodeRequest',
    'CreateGuestAccessRequest',
    'CreateCleanerAccessRequest',
    'UpdateAccessCodeRequest',
    'DeleteAccessCodeRequest',
    'BulkCodeOperation',
    'LockOperationRequest',
    'LockOperationResponse',
    'LockStatusResponse',
    'LockActivityRequest',
    'LockActivityResponse',
    'LockAnalytics',
    'AllLocksStatus',
    'LockCodeReport',
]
