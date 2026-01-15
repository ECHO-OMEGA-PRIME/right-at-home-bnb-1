"""
Booking schemas for Right at Home BnB
iCal sync, booking management, calendar operations
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date, time
from decimal import Decimal
from enum import Enum
from .base import BaseSchema, TimestampMixin, IDMixin, DateRange
from .guest import Platform


class BookingStatus(str, Enum):
    """Booking status enum"""
    INQUIRY = "INQUIRY"
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    CHECKED_OUT = "CHECKED_OUT"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"
    REFUNDED = "REFUNDED"


class BookingSource(str, Enum):
    """How the booking was created"""
    ICAL_SYNC = "ICAL_SYNC"
    API_SYNC = "API_SYNC"
    MANUAL = "MANUAL"
    DIRECT_BOOKING = "DIRECT_BOOKING"
    PHONE = "PHONE"


class CancellationPolicy(str, Enum):
    """Cancellation policy types"""
    FLEXIBLE = "FLEXIBLE"
    MODERATE = "MODERATE"
    STRICT = "STRICT"
    SUPER_STRICT = "SUPER_STRICT"
    CUSTOM = "CUSTOM"


class PaymentStatus(str, Enum):
    """Payment status"""
    PENDING = "PENDING"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    REFUNDED = "REFUNDED"
    DISPUTED = "DISPUTED"


class BookingPricing(BaseModel):
    """Detailed booking pricing breakdown"""
    nightly_rate: Decimal = Field(..., ge=0)
    total_nights: int = Field(..., ge=1)
    subtotal: Decimal = Field(..., ge=0)
    cleaning_fee: Decimal = Field(default=Decimal("0"), ge=0)
    service_fee: Decimal = Field(default=Decimal("0"), ge=0)
    pet_fee: Optional[Decimal] = Field(default=None, ge=0)
    extra_guest_fee: Optional[Decimal] = Field(default=None, ge=0)
    taxes: Decimal = Field(default=Decimal("0"), ge=0)
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    discount_type: Optional[str] = None
    total_price: Decimal = Field(..., ge=0)
    host_payout: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = Field(default="USD")


class BookingGuest(BaseModel):
    """Guest info for booking"""
    guest_id: Optional[str] = None
    name: str = Field(..., min_length=1)
    email: str
    phone: Optional[str] = None
    is_new_guest: bool = Field(default=False)


class ICalEvent(BaseModel):
    """Parsed iCal event"""
    uid: str
    summary: str
    start: date
    end: date
    description: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    organizer: Optional[str] = None
    last_modified: Optional[datetime] = None


class ICalSyncResult(BaseModel):
    """Result of iCal sync operation"""
    property_id: str
    source: str = Field(..., description="airbnb, vrbo, etc.")
    ical_url: str
    sync_time: datetime
    events_found: int
    new_bookings: int
    updated_bookings: int
    cancelled_bookings: int
    conflicts: List[Dict[str, Any]] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


# ============================================
# CRUD SCHEMAS
# ============================================

class BookingBase(BaseSchema):
    """Base booking schema"""
    property_id: str = Field(..., description="Property ID")
    guest_id: Optional[str] = Field(default=None, description="Guest ID if known")

    # Dates
    check_in: date = Field(..., description="Check-in date")
    check_out: date = Field(..., description="Check-out date")
    check_in_time: time = Field(default=time(15, 0), description="Check-in time")
    check_out_time: time = Field(default=time(11, 0), description="Check-out time")

    # Details
    guest_count: int = Field(default=1, ge=1, le=100)
    platform: Platform = Field(default=Platform.DIRECT)
    confirmation_code: Optional[str] = Field(default=None, max_length=50)

    # Special requests
    special_requests: Optional[str] = Field(default=None, max_length=2000)
    internal_notes: Optional[str] = Field(default=None, max_length=2000)

    @field_validator('check_out')
    @classmethod
    def check_out_after_check_in(cls, v, info):
        if 'check_in' in info.data and v <= info.data['check_in']:
            raise ValueError('check_out must be after check_in')
        return v


class BookingCreate(BookingBase):
    """Schema for creating a new booking"""
    # Guest info if new guest
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None

    # Pricing
    nightly_rate: Decimal = Field(..., ge=0)
    cleaning_fee: Optional[Decimal] = Field(default=None, ge=0)
    service_fee: Optional[Decimal] = Field(default=None, ge=0)
    taxes: Optional[Decimal] = Field(default=None, ge=0)
    total_price: Optional[Decimal] = Field(default=None, ge=0)

    # Source
    source: BookingSource = Field(default=BookingSource.MANUAL)
    external_id: Optional[str] = None

    # Generate access code
    generate_access_code: bool = Field(default=True)


class BookingUpdate(BaseSchema):
    """Schema for updating a booking (all fields optional)"""
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    guest_count: Optional[int] = Field(default=None, ge=1, le=100)
    status: Optional[BookingStatus] = None
    special_requests: Optional[str] = Field(default=None, max_length=2000)
    internal_notes: Optional[str] = Field(default=None, max_length=2000)

    # Pricing updates
    nightly_rate: Optional[Decimal] = Field(default=None, ge=0)
    cleaning_fee: Optional[Decimal] = Field(default=None, ge=0)
    total_price: Optional[Decimal] = Field(default=None, ge=0)

    # Access code
    access_code: Optional[str] = None
    code_expires_at: Optional[datetime] = None


class BookingResponse(BookingBase, IDMixin, TimestampMixin):
    """Full booking response schema"""
    status: BookingStatus = BookingStatus.CONFIRMED

    # Property info
    property_name: Optional[str] = None
    property_address: Optional[str] = None

    # Guest info
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None

    # Pricing
    nightly_rate: Decimal
    total_nights: int
    subtotal: Decimal
    cleaning_fee: Optional[Decimal] = None
    service_fee: Optional[Decimal] = None
    taxes: Optional[Decimal] = None
    total_price: Decimal

    # Access
    access_code: Optional[str] = None
    code_expires_at: Optional[datetime] = None

    # Source
    source: BookingSource = BookingSource.MANUAL
    external_id: Optional[str] = None

    # Related
    cleaning_job_id: Optional[str] = None
    cleaning_job_status: Optional[str] = None

    # Computed
    is_current: bool = Field(default=False, description="Is current stay")
    days_until_check_in: Optional[int] = None
    is_past: bool = Field(default=False)


class BookingListResponse(BaseSchema):
    """Simplified booking for list views"""
    id: str
    property_id: str
    property_name: str
    guest_name: str
    check_in: date
    check_out: date
    nights: int
    guest_count: int
    total_price: Decimal
    status: BookingStatus
    platform: Platform
    has_access_code: bool


class BookingSearchParams(BaseSchema):
    """Booking search/filter parameters"""
    property_id: Optional[str] = None
    guest_id: Optional[str] = None
    status: Optional[BookingStatus] = None
    platform: Optional[Platform] = None
    check_in_after: Optional[date] = None
    check_in_before: Optional[date] = None
    check_out_after: Optional[date] = None
    check_out_before: Optional[date] = None
    min_price: Optional[Decimal] = Field(default=None, ge=0)
    max_price: Optional[Decimal] = Field(default=None, ge=0)
    has_access_code: Optional[bool] = None
    is_upcoming: Optional[bool] = None
    is_past: Optional[bool] = None
    is_current: Optional[bool] = None


class BookingCalendarEntry(BaseSchema):
    """Calendar entry for property calendar view"""
    id: str
    property_id: str
    start: date
    end: date
    title: str
    guest_name: Optional[str] = None
    status: BookingStatus
    platform: Platform
    color: str = Field(default="#3B82F6", description="Calendar color code")
    is_blocked: bool = Field(default=False, description="Blocked date, not a booking")


class BookingConflict(BaseSchema):
    """Booking date conflict"""
    property_id: str
    property_name: str
    existing_booking_id: str
    existing_guest: str
    existing_dates: DateRange
    new_dates: DateRange
    overlap_days: int
    resolution_options: List[str]


class BookingAvailability(BaseSchema):
    """Check booking availability response"""
    property_id: str
    check_in: date
    check_out: date
    is_available: bool
    conflicts: List[BookingConflict] = Field(default_factory=list)
    pricing: Optional[BookingPricing] = None
    minimum_nights: int = Field(default=1)
    notes: List[str] = Field(default_factory=list)


class BookingStatsResponse(BaseSchema):
    """Booking statistics"""
    total_bookings: int
    bookings_this_month: int
    revenue_this_month: Decimal
    avg_booking_value: Decimal
    avg_stay_length: float
    occupancy_rate: float
    bookings_by_status: Dict[str, int]
    bookings_by_platform: Dict[str, int]
    upcoming_check_ins: int
    upcoming_check_outs: int
    cancellation_rate: float


class ICalSyncRequest(BaseSchema):
    """Request to sync iCal calendar"""
    property_id: str
    ical_url: str
    source: str = Field(..., description="airbnb, vrbo, booking, other")
    sync_back_days: int = Field(default=30, ge=0, le=365)
    sync_forward_days: int = Field(default=365, ge=0, le=730)
    auto_confirm: bool = Field(default=True, description="Auto-confirm synced bookings")


class BulkICalSync(BaseSchema):
    """Bulk sync all iCal calendars"""
    properties: Optional[List[str]] = Field(default=None, description="Property IDs or all if None")
    sources: Optional[List[str]] = Field(default=None, description="Sources to sync or all")


class QuickBooking(BaseSchema):
    """Quick booking creation for phone/manual bookings"""
    property_id: str
    guest_name: str
    guest_phone: str
    guest_email: Optional[str] = None
    check_in: date
    check_out: date
    guest_count: int = Field(default=2, ge=1)
    total_price: Decimal
    notes: Optional[str] = None


# Export all
__all__ = [
    'BookingStatus',
    'BookingSource',
    'CancellationPolicy',
    'PaymentStatus',
    'BookingPricing',
    'BookingGuest',
    'ICalEvent',
    'ICalSyncResult',
    'BookingBase',
    'BookingCreate',
    'BookingUpdate',
    'BookingResponse',
    'BookingListResponse',
    'BookingSearchParams',
    'BookingCalendarEntry',
    'BookingConflict',
    'BookingAvailability',
    'BookingStatsResponse',
    'ICalSyncRequest',
    'BulkICalSync',
    'QuickBooking',
]
