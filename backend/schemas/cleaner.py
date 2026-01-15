"""
Cleaner schemas for Right at Home BnB
GPS tracking, photo verification, performance scoring
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, EmailStr
from datetime import datetime, date, time
from decimal import Decimal
from enum import Enum
from .base import BaseSchema, TimestampMixin, IDMixin, GeoLocation, FileUpload


class CleanerStatus(str, Enum):
    """Cleaner status"""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ON_LEAVE = "ON_LEAVE"
    TERMINATED = "TERMINATED"


class CleaningType(str, Enum):
    """Type of cleaning job"""
    TURNOVER = "TURNOVER"
    DEEP_CLEAN = "DEEP_CLEAN"
    INSPECTION = "INSPECTION"
    MAINTENANCE = "MAINTENANCE"
    TOUCH_UP = "TOUCH_UP"
    EMERGENCY = "EMERGENCY"


class CleaningJobStatus(str, Enum):
    """Cleaning job status"""
    SCHEDULED = "SCHEDULED"
    ASSIGNED = "ASSIGNED"
    EN_ROUTE = "EN_ROUTE"
    ARRIVED = "ARRIVED"
    IN_PROGRESS = "IN_PROGRESS"
    PHOTO_REVIEW = "PHOTO_REVIEW"
    COMPLETED = "COMPLETED"
    VERIFIED = "VERIFIED"
    ISSUE_REPORTED = "ISSUE_REPORTED"
    CANCELLED = "CANCELLED"


class CleaningPriority(str, Enum):
    """Job priority"""
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class ChecklistItemStatus(str, Enum):
    """Checklist item status"""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"
    ISSUE = "ISSUE"


class CleanerPaymentType(str, Enum):
    """Payment type"""
    PER_JOB = "PER_JOB"
    HOURLY = "HOURLY"
    SALARY = "SALARY"


class PhotoVerificationResult(BaseModel):
    """Result of AI photo verification"""
    photo_url: str
    area: str
    is_clean: bool
    confidence: float = Field(..., ge=0, le=1)
    issues_detected: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    timestamp: datetime


class ChecklistItem(BaseModel):
    """Individual checklist item"""
    id: str
    area: str = Field(..., description="Kitchen, Bedroom 1, etc.")
    task: str = Field(..., description="Task description")
    status: ChecklistItemStatus = ChecklistItemStatus.PENDING
    required: bool = Field(default=True)
    photo_required: bool = Field(default=False)
    photo_url: Optional[str] = None
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None


class ChecklistProgress(BaseModel):
    """Checklist completion progress"""
    total_items: int
    completed_items: int
    in_progress_items: int
    pending_items: int
    skipped_items: int
    issue_items: int
    completion_percentage: float = Field(..., ge=0, le=100)
    photos_required: int
    photos_uploaded: int


class CleanerPerformanceMetrics(BaseModel):
    """Cleaner performance metrics"""
    total_jobs: int = Field(default=0)
    completed_jobs: int = Field(default=0)
    cancelled_jobs: int = Field(default=0)
    missed_jobs: int = Field(default=0)

    avg_quality_score: float = Field(default=0, ge=0, le=10)
    avg_time_score: float = Field(default=0, ge=0, le=10)
    overall_score: float = Field(default=0, ge=0, le=10)

    on_time_rate: float = Field(default=0, ge=0, le=1)
    completion_rate: float = Field(default=0, ge=0, le=1)
    photo_compliance_rate: float = Field(default=0, ge=0, le=1)

    avg_job_duration_minutes: Optional[float] = None
    total_earnings: Decimal = Field(default=Decimal("0"))

    streak_current: int = Field(default=0, description="Current perfect job streak")
    streak_best: int = Field(default=0, description="Best perfect job streak")

    reviews_positive: int = Field(default=0)
    reviews_negative: int = Field(default=0)


class GPSCheckIn(BaseModel):
    """GPS check-in data"""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = Field(default=None, ge=0)
    timestamp: datetime
    is_within_geofence: bool = Field(default=False)
    distance_from_property: Optional[float] = Field(default=None, description="Meters from property")


# ============================================
# CRUD SCHEMAS
# ============================================

class CleanerBase(BaseSchema):
    """Base cleaner schema"""
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    phone: str = Field(..., pattern=r"^\+?1?\d{10,14}$")

    # Address
    address: Optional[str] = Field(default=None, max_length=255)
    city: str = Field(default="Midland", max_length=100)
    state: str = Field(default="TX", max_length=50)

    # Emergency contact
    emergency_contact_name: Optional[str] = Field(default=None, max_length=255)
    emergency_contact_phone: Optional[str] = Field(default=None, pattern=r"^\+?1?\d{10,14}$")


class CleanerCreate(CleanerBase):
    """Schema for creating a new cleaner"""
    payment_type: CleanerPaymentType = CleanerPaymentType.PER_JOB
    base_rate: Decimal = Field(default=Decimal("50"), ge=0, description="Base rate per job or hourly")
    notes: Optional[str] = Field(default=None, max_length=2000)
    assigned_properties: List[str] = Field(default_factory=list, description="Default assigned property IDs")
    availability: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Weekly availability")


class CleanerUpdate(BaseSchema):
    """Schema for updating a cleaner (all fields optional)"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, pattern=r"^\+?1?\d{10,14}$")
    address: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=50)
    emergency_contact_name: Optional[str] = Field(default=None, max_length=255)
    emergency_contact_phone: Optional[str] = Field(default=None, pattern=r"^\+?1?\d{10,14}$")
    status: Optional[CleanerStatus] = None
    payment_type: Optional[CleanerPaymentType] = None
    base_rate: Optional[Decimal] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=2000)
    assigned_properties: Optional[List[str]] = None
    availability: Optional[Dict[str, Any]] = None


class CleanerResponse(CleanerBase, IDMixin, TimestampMixin):
    """Full cleaner response schema"""
    status: CleanerStatus = CleanerStatus.ACTIVE
    payment_type: CleanerPaymentType = CleanerPaymentType.PER_JOB
    base_rate: Decimal = Field(default=Decimal("50"))
    notes: Optional[str] = None
    assigned_properties: List[str] = Field(default_factory=list)
    availability: Dict[str, Any] = Field(default_factory=dict)

    # Performance
    metrics: CleanerPerformanceMetrics = Field(default_factory=CleanerPerformanceMetrics)

    # Current status
    current_job_id: Optional[str] = None
    is_working: bool = Field(default=False)
    last_seen_location: Optional[GeoLocation] = None


class CleanerListResponse(BaseSchema):
    """Simplified cleaner for list views"""
    id: str
    name: str
    phone: str
    email: str
    status: CleanerStatus
    overall_score: float
    completed_jobs: int
    on_time_rate: float
    is_working: bool


# ============================================
# CLEANING JOB SCHEMAS
# ============================================

class CleaningJobBase(BaseSchema):
    """Base cleaning job schema"""
    property_id: str
    job_type: CleaningType = CleaningType.TURNOVER
    scheduled_date: date
    scheduled_time: time = Field(default=time(12, 0))
    estimated_duration_minutes: int = Field(default=120, ge=15, le=480)
    priority: CleaningPriority = CleaningPriority.NORMAL
    notes: Optional[str] = Field(default=None, max_length=2000)


class CleaningJobCreate(CleaningJobBase):
    """Schema for creating a cleaning job"""
    cleaner_id: Optional[str] = Field(default=None, description="Auto-assign if None")
    booking_id: Optional[str] = Field(default=None, description="Associated booking")
    base_pay: Optional[Decimal] = Field(default=None, ge=0, description="Override cleaner base rate")


class CleaningJobUpdate(BaseSchema):
    """Schema for updating a cleaning job (all fields optional)"""
    cleaner_id: Optional[str] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    estimated_duration_minutes: Optional[int] = Field(default=None, ge=15, le=480)
    priority: Optional[CleaningPriority] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    base_pay: Optional[Decimal] = Field(default=None, ge=0)


class CleaningJobResponse(CleaningJobBase, IDMixin, TimestampMixin):
    """Full cleaning job response schema"""
    cleaner_id: Optional[str] = None
    booking_id: Optional[str] = None
    status: CleaningJobStatus = CleaningJobStatus.SCHEDULED

    # Property info
    property_name: Optional[str] = None
    property_address: Optional[str] = None

    # Cleaner info
    cleaner_name: Optional[str] = None
    cleaner_phone: Optional[str] = None

    # Timestamps
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None

    # GPS
    gps_check_in: Optional[GPSCheckIn] = None
    gps_check_out: Optional[GPSCheckIn] = None

    # Checklist
    checklist_progress: Optional[ChecklistProgress] = None

    # Photos
    photos: List[str] = Field(default_factory=list)
    photo_count: int = Field(default=0)
    photos_verified: bool = Field(default=False)

    # Quality
    quality_score: Optional[float] = Field(default=None, ge=0, le=10)
    time_score: Optional[float] = Field(default=None, ge=0, le=10)
    overall_score: Optional[float] = Field(default=None, ge=0, le=10)
    score_feedback: Optional[str] = None

    # Issues
    issues_reported: List[str] = Field(default_factory=list)
    maintenance_needed: bool = Field(default=False)

    # Duration
    actual_duration_minutes: Optional[int] = None

    # Payment
    base_pay: Optional[Decimal] = None
    bonus_pay: Optional[Decimal] = None
    total_pay: Optional[Decimal] = None
    payment_status: str = Field(default="pending")


class CleaningJobListResponse(BaseSchema):
    """Simplified cleaning job for list views"""
    id: str
    property_id: str
    property_name: str
    cleaner_id: Optional[str] = None
    cleaner_name: Optional[str] = None
    job_type: CleaningType
    scheduled_date: date
    scheduled_time: time
    status: CleaningJobStatus
    priority: CleaningPriority
    overall_score: Optional[float] = None


class CleaningJobSearchParams(BaseSchema):
    """Search/filter parameters for cleaning jobs"""
    property_id: Optional[str] = None
    cleaner_id: Optional[str] = None
    booking_id: Optional[str] = None
    status: Optional[CleaningJobStatus] = None
    job_type: Optional[CleaningType] = None
    priority: Optional[CleaningPriority] = None
    scheduled_after: Optional[date] = None
    scheduled_before: Optional[date] = None
    unassigned: Optional[bool] = None


# ============================================
# OPERATION SCHEMAS
# ============================================

class GPSCheckInRequest(BaseSchema):
    """Request to check in via GPS"""
    job_id: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = Field(default=None, ge=0)


class PhotoUploadRequest(BaseSchema):
    """Request to upload job photo"""
    job_id: str
    area: str = Field(..., description="Area name (Kitchen, Bedroom 1, etc.)")
    checklist_item_id: Optional[str] = None


class PhotoVerificationRequest(BaseSchema):
    """Request to verify photos with AI"""
    job_id: str
    verify_all: bool = Field(default=True)
    photo_urls: Optional[List[str]] = None


class CompleteJobRequest(BaseSchema):
    """Request to complete a cleaning job"""
    job_id: str
    notes: Optional[str] = Field(default=None, max_length=2000)
    issues: Optional[List[str]] = Field(default_factory=list)
    maintenance_needed: bool = Field(default=False)
    final_checklist: Optional[List[Dict[str, Any]]] = None


class ScoreJobRequest(BaseSchema):
    """Request to score a completed job"""
    job_id: str
    quality_score: float = Field(..., ge=0, le=10)
    time_score: float = Field(..., ge=0, le=10)
    feedback: Optional[str] = Field(default=None, max_length=1000)
    bonus_amount: Optional[Decimal] = Field(default=None, ge=0)


class CleanerLeaderboard(BaseSchema):
    """Cleaner leaderboard entry"""
    rank: int
    cleaner_id: str
    name: str
    overall_score: float
    completed_jobs: int
    on_time_rate: float
    streak_current: int
    total_earnings_month: Decimal


class CleanerSchedule(BaseSchema):
    """Cleaner's schedule for a date range"""
    cleaner_id: str
    cleaner_name: str
    start_date: date
    end_date: date
    jobs: List[CleaningJobListResponse]
    total_jobs: int
    total_hours: float
    availability_gaps: List[Dict[str, Any]] = Field(default_factory=list)


# Export all
__all__ = [
    'CleanerStatus',
    'CleaningType',
    'CleaningJobStatus',
    'CleaningPriority',
    'ChecklistItemStatus',
    'CleanerPaymentType',
    'PhotoVerificationResult',
    'ChecklistItem',
    'ChecklistProgress',
    'CleanerPerformanceMetrics',
    'GPSCheckIn',
    'CleanerBase',
    'CleanerCreate',
    'CleanerUpdate',
    'CleanerResponse',
    'CleanerListResponse',
    'CleaningJobBase',
    'CleaningJobCreate',
    'CleaningJobUpdate',
    'CleaningJobResponse',
    'CleaningJobListResponse',
    'CleaningJobSearchParams',
    'GPSCheckInRequest',
    'PhotoUploadRequest',
    'PhotoVerificationRequest',
    'CompleteJobRequest',
    'ScoreJobRequest',
    'CleanerLeaderboard',
    'CleanerSchedule',
]
