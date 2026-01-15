"""
Guest CRM schemas for Right at Home BnB
VIP tracking, preferences, and guest history
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, EmailStr
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from .base import BaseSchema, TimestampMixin, IDMixin, ContactInfo


class Platform(str, Enum):
    """Booking platform enum"""
    AIRBNB = "AIRBNB"
    VRBO = "VRBO"
    BOOKING = "BOOKING"
    DIRECT = "DIRECT"
    REFERRAL = "REFERRAL"
    OTHER = "OTHER"


class VIPTier(str, Enum):
    """VIP tier levels"""
    NONE = "NONE"
    SILVER = "SILVER"
    GOLD = "GOLD"
    PLATINUM = "PLATINUM"
    DIAMOND = "DIAMOND"


class GuestTag(str, Enum):
    """Predefined guest tags"""
    VIP = "VIP"
    REPEAT = "REPEAT"
    BUSINESS = "BUSINESS"
    FAMILY = "FAMILY"
    COUPLE = "COUPLE"
    LONG_STAY = "LONG_STAY"
    WINE_LOVER = "WINE_LOVER"
    EARLY_BOOKER = "EARLY_BOOKER"
    LAST_MINUTE = "LAST_MINUTE"
    HIGH_SPENDER = "HIGH_SPENDER"
    PROBLEM_GUEST = "PROBLEM_GUEST"
    DO_NOT_RENT = "DO_NOT_RENT"
    OIL_INDUSTRY = "OIL_INDUSTRY"
    LOCAL = "LOCAL"
    INTERNATIONAL = "INTERNATIONAL"


class GuestPreferences(BaseModel):
    """Guest preferences and notes"""
    room_temperature: Optional[str] = Field(default=None, description="Preferred room temp")
    bed_firmness: Optional[str] = None
    pillow_preference: Optional[str] = None
    dietary_restrictions: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    early_check_in: bool = Field(default=False)
    late_check_out: bool = Field(default=False)
    favorite_properties: List[str] = Field(default_factory=list)
    communication_preference: str = Field(default="email", description="email, sms, phone")
    special_occasions: Optional[str] = None
    welcome_amenities: List[str] = Field(default_factory=list, description="Preferred welcome items")
    notes: Optional[str] = None


class GuestStaySummary(BaseModel):
    """Summary of a guest's stay"""
    booking_id: str
    property_id: str
    property_name: str
    check_in: date
    check_out: date
    nights: int
    total_paid: Decimal
    platform: Platform
    rating_given: Optional[float] = Field(default=None, ge=1, le=5)
    review_text: Optional[str] = None
    issues_reported: List[str] = Field(default_factory=list)
    special_requests: Optional[str] = None


class GuestReviewSummary(BaseModel):
    """Guest review information"""
    total_reviews: int = Field(default=0)
    avg_rating: Optional[float] = Field(default=None, ge=1, le=5)
    positive_reviews: int = Field(default=0)
    neutral_reviews: int = Field(default=0)
    negative_reviews: int = Field(default=0)
    common_praise: List[str] = Field(default_factory=list)
    common_complaints: List[str] = Field(default_factory=list)


# ============================================
# CRUD SCHEMAS
# ============================================

class GuestBase(BaseSchema):
    """Base guest schema"""
    email: EmailStr = Field(..., description="Primary email address")
    name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, pattern=r"^\+?1?\d{10,14}$")

    # Source
    platform: Platform = Field(default=Platform.DIRECT)
    platform_id: Optional[str] = Field(default=None, max_length=100)

    # Special dates
    birthday: Optional[date] = None
    anniversary: Optional[date] = None

    # Address
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=50)
    country: Optional[str] = Field(default="USA", max_length=100)

    # Notes
    notes: Optional[str] = Field(default=None, max_length=5000)


class GuestCreate(GuestBase):
    """Schema for creating a new guest"""
    tags: List[str] = Field(default_factory=list)
    preferences: Optional[Dict[str, Any]] = Field(default_factory=dict)
    is_vip: bool = Field(default=False)
    vip_tier: VIPTier = Field(default=VIPTier.NONE)


class GuestUpdate(BaseSchema):
    """Schema for updating a guest (all fields optional)"""
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, pattern=r"^\+?1?\d{10,14}$")

    platform: Optional[Platform] = None
    platform_id: Optional[str] = Field(default=None, max_length=100)

    birthday: Optional[date] = None
    anniversary: Optional[date] = None

    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=50)
    country: Optional[str] = Field(default=None, max_length=100)

    notes: Optional[str] = Field(default=None, max_length=5000)
    tags: Optional[List[str]] = None
    preferences: Optional[Dict[str, Any]] = None
    is_vip: Optional[bool] = None
    vip_tier: Optional[VIPTier] = None


class GuestResponse(GuestBase, IDMixin, TimestampMixin):
    """Full guest response schema"""
    # CRM Data
    first_stay: Optional[date] = None
    last_stay: Optional[date] = None
    total_stays: int = Field(default=0)
    total_spent: Decimal = Field(default=Decimal("0"))
    avg_stay_length: Optional[float] = None
    avg_spend_per_stay: Optional[Decimal] = None

    # Rating
    avg_rating: Optional[float] = Field(default=None, ge=1, le=5)
    total_reviews: int = Field(default=0)

    # Tags & Preferences
    tags: List[str] = Field(default_factory=list)
    preferences: Dict[str, Any] = Field(default_factory=dict)

    # VIP Status
    is_vip: bool = Field(default=False)
    vip_tier: VIPTier = Field(default=VIPTier.NONE)
    vip_since: Optional[date] = None

    # Lifetime value
    lifetime_value: Decimal = Field(default=Decimal("0"))
    predicted_annual_value: Optional[Decimal] = None

    # Flags
    has_upcoming_booking: bool = Field(default=False)
    days_since_last_stay: Optional[int] = None


class GuestListResponse(BaseSchema):
    """Simplified guest for list views"""
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    platform: Platform
    total_stays: int
    total_spent: Decimal
    avg_rating: Optional[float] = None
    is_vip: bool
    vip_tier: VIPTier
    last_stay: Optional[date] = None
    tags: List[str] = Field(default_factory=list)


class GuestSearchParams(BaseSchema):
    """Guest search/filter parameters"""
    q: Optional[str] = Field(default=None, description="Search query for name/email")
    platform: Optional[Platform] = None
    is_vip: Optional[bool] = None
    vip_tier: Optional[VIPTier] = None
    min_stays: Optional[int] = Field(default=None, ge=0)
    max_stays: Optional[int] = Field(default=None, ge=0)
    min_spent: Optional[Decimal] = Field(default=None, ge=0)
    max_spent: Optional[Decimal] = Field(default=None, ge=0)
    tag: Optional[str] = Field(default=None, description="Filter by tag")
    has_upcoming_booking: Optional[bool] = None
    stayed_at_property: Optional[str] = Field(default=None, description="Property ID filter")
    last_stay_after: Optional[date] = None
    last_stay_before: Optional[date] = None
    birthday_month: Optional[int] = Field(default=None, ge=1, le=12)


class GuestStatsResponse(BaseSchema):
    """Guest CRM statistics"""
    total_guests: int
    new_guests_this_month: int
    repeat_guests: int
    repeat_rate: float = Field(..., ge=0, le=1)
    vip_guests: int
    vip_by_tier: Dict[str, int] = Field(default_factory=dict)
    avg_guest_rating: float
    total_lifetime_value: Decimal
    avg_lifetime_value: Decimal
    top_spenders: List[Dict[str, Any]] = Field(default_factory=list)
    guests_by_platform: Dict[str, int] = Field(default_factory=dict)
    upcoming_birthdays: List[Dict[str, Any]] = Field(default_factory=list)
    at_risk_guests: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Guests who haven't stayed in 6+ months"
    )


class GuestTagOperation(BaseSchema):
    """Add/remove tag operation"""
    tag: str = Field(..., min_length=1, max_length=50)


class GuestVIPUpdate(BaseSchema):
    """Update VIP status"""
    is_vip: bool
    vip_tier: Optional[VIPTier] = None
    reason: Optional[str] = None


class GuestMerge(BaseSchema):
    """Merge duplicate guest profiles"""
    source_guest_id: str
    target_guest_id: str
    merge_strategy: str = Field(default="keep_target", description="keep_target, keep_source, combine")


class GuestHistory(BaseSchema):
    """Complete guest history"""
    guest_id: str
    guest: GuestResponse
    stays: List[GuestStaySummary] = Field(default_factory=list)
    reviews: GuestReviewSummary
    messages_count: int = Field(default=0)
    concierge_queries: int = Field(default=0)
    special_requests_history: List[str] = Field(default_factory=list)
    lifetime_timeline: List[Dict[str, Any]] = Field(default_factory=list)


class GuestDossier(BaseSchema):
    """Complete guest dossier for AI/concierge use"""
    guest_id: str
    name: str
    vip_status: str
    total_stays: int
    favorite_properties: List[str]
    preferences_summary: str
    communication_notes: List[str]
    special_dates: Dict[str, date]
    recent_feedback: List[str]
    recommended_actions: List[str]


# Export all
__all__ = [
    'Platform',
    'VIPTier',
    'GuestTag',
    'GuestPreferences',
    'GuestStaySummary',
    'GuestReviewSummary',
    'GuestBase',
    'GuestCreate',
    'GuestUpdate',
    'GuestResponse',
    'GuestListResponse',
    'GuestSearchParams',
    'GuestStatsResponse',
    'GuestTagOperation',
    'GuestVIPUpdate',
    'GuestMerge',
    'GuestHistory',
    'GuestDossier',
]
