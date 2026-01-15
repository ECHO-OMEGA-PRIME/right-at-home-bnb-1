"""
Property schemas for Right at Home BnB
Comprehensive property management schemas
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from .base import BaseSchema, TimestampMixin, IDMixin, Address, GeoLocation


class PropertyType(str, Enum):
    """Property type enum"""
    HOUSE = "HOUSE"
    APARTMENT = "APARTMENT"
    CONDO = "CONDO"
    TOWNHOUSE = "TOWNHOUSE"
    CABIN = "CABIN"
    STUDIO = "STUDIO"
    VILLA = "VILLA"


class PropertyStatus(str, Enum):
    """Property status enum"""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MAINTENANCE = "MAINTENANCE"
    COMING_SOON = "COMING_SOON"
    ARCHIVED = "ARCHIVED"


class AmenityCategory(str, Enum):
    """Amenity categories"""
    ESSENTIALS = "ESSENTIALS"
    ENTERTAINMENT = "ENTERTAINMENT"
    OUTDOOR = "OUTDOOR"
    KITCHEN = "KITCHEN"
    SAFETY = "SAFETY"
    ACCESSIBILITY = "ACCESSIBILITY"
    WORKSPACE = "WORKSPACE"


class Amenity(BaseModel):
    """Individual amenity"""
    name: str
    category: AmenityCategory
    icon: Optional[str] = None
    description: Optional[str] = None


class PropertyAmenities(BaseModel):
    """Property amenities grouped by category"""
    essentials: List[str] = Field(default_factory=list, description="WiFi, AC, Heating, etc.")
    entertainment: List[str] = Field(default_factory=list, description="TV, Game console, Pool table, etc.")
    outdoor: List[str] = Field(default_factory=list, description="Pool, Hot tub, BBQ, Patio, etc.")
    kitchen: List[str] = Field(default_factory=list, description="Full kitchen, Coffee maker, etc.")
    safety: List[str] = Field(default_factory=list, description="Smoke detector, Fire extinguisher, etc.")
    accessibility: List[str] = Field(default_factory=list, description="Wheelchair accessible, etc.")
    workspace: List[str] = Field(default_factory=list, description="Dedicated workspace, High-speed internet, etc.")


class WiFiCredentials(BaseModel):
    """WiFi credentials"""
    network_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=100)
    network_type: str = Field(default="WPA2")
    speed_mbps: Optional[int] = None


class CheckInInstructions(BaseModel):
    """Check-in instructions"""
    time: str = Field(default="3:00 PM", description="Standard check-in time")
    early_check_in_available: bool = Field(default=False)
    early_check_in_fee: Optional[Decimal] = None
    lock_type: str = Field(default="smart_lock", description="smart_lock, lockbox, in_person")
    lock_code: Optional[str] = None
    instructions: str = Field(..., min_length=1)
    video_url: Optional[str] = None
    parking_instructions: Optional[str] = None


class CheckOutInstructions(BaseModel):
    """Check-out instructions"""
    time: str = Field(default="11:00 AM", description="Standard check-out time")
    late_check_out_available: bool = Field(default=True)
    late_check_out_fee: Optional[Decimal] = None
    tasks: List[str] = Field(default_factory=lambda: [
        "Strip beds and leave linens in laundry area",
        "Load dishwasher or wash dishes",
        "Take out trash",
        "Turn off all lights and AC/heat",
        "Lock all doors"
    ])
    additional_notes: Optional[str] = None


class CleaningChecklistItem(BaseModel):
    """Individual cleaning checklist item"""
    id: str
    area: str = Field(..., description="Room/area name")
    task: str = Field(..., description="Task description")
    required: bool = Field(default=True)
    photo_required: bool = Field(default=False)
    notes: Optional[str] = None


class PropertyPricing(BaseModel):
    """Property pricing configuration"""
    nightly_rate: Decimal = Field(..., ge=0, description="Base nightly rate")
    weekly_discount: Optional[float] = Field(default=None, ge=0, le=100, description="Weekly discount %")
    monthly_discount: Optional[float] = Field(default=None, ge=0, le=100, description="Monthly discount %")
    cleaning_fee: Decimal = Field(default=Decimal("0"), ge=0)
    security_deposit: Optional[Decimal] = Field(default=None, ge=0)
    extra_guest_fee: Optional[Decimal] = Field(default=None, ge=0, description="Fee per extra guest over base")
    extra_guest_threshold: int = Field(default=2, ge=1, description="Guests before extra fee applies")
    pet_fee: Optional[Decimal] = Field(default=None, ge=0)
    minimum_nights: int = Field(default=1, ge=1)
    maximum_nights: Optional[int] = Field(default=None, ge=1)
    currency: str = Field(default="USD")


class ExternalListing(BaseModel):
    """External platform listing info"""
    platform: str = Field(..., description="airbnb, vrbo, booking, etc.")
    listing_id: str
    listing_url: Optional[str] = None
    ical_url: Optional[str] = None
    sync_enabled: bool = Field(default=True)
    last_synced: Optional[datetime] = None


class PropertyImages(BaseModel):
    """Property images"""
    primary: str = Field(..., description="Primary listing image URL")
    gallery: List[str] = Field(default_factory=list, description="Additional image URLs")
    floor_plan: Optional[str] = None
    virtual_tour_url: Optional[str] = None


# ============================================
# CRUD SCHEMAS
# ============================================

class PropertyBase(BaseSchema):
    """Base property schema with common fields"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    property_type: PropertyType = Field(default=PropertyType.HOUSE)

    # Location
    address: str = Field(..., min_length=1, max_length=255)
    city: str = Field(default="Midland", max_length=100)
    state: str = Field(default="TX", max_length=50)
    zip_code: str = Field(..., pattern=r"^\d{5}(-\d{4})?$")
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    # Capacity
    bedrooms: int = Field(..., ge=0, le=50)
    bathrooms: float = Field(..., ge=0, le=50)
    max_guests: int = Field(..., ge=1, le=100)
    square_feet: Optional[int] = Field(default=None, ge=0)

    # WiFi
    wifi_network: Optional[str] = Field(default=None, max_length=100)
    wifi_password: Optional[str] = Field(default=None, max_length=100)

    # Parking
    parking_info: Optional[str] = Field(default=None, max_length=500)
    parking_spots: int = Field(default=0, ge=0)

    # Instructions
    check_in_instructions: Optional[str] = Field(default=None, max_length=2000)
    check_out_instructions: Optional[str] = Field(default=None, max_length=2000)
    house_rules: Optional[str] = Field(default=None, max_length=3000)

    # Pricing
    nightly_rate: Decimal = Field(..., ge=0)
    cleaning_fee: Optional[Decimal] = Field(default=None, ge=0)
    security_deposit: Optional[Decimal] = Field(default=None, ge=0)

    # External IDs
    airbnb_id: Optional[str] = Field(default=None, max_length=100)
    vrbo_id: Optional[str] = Field(default=None, max_length=100)
    airbnb_ical_url: Optional[str] = None
    vrbo_ical_url: Optional[str] = None


class PropertyCreate(PropertyBase):
    """Schema for creating a new property"""
    amenities: Optional[List[str]] = Field(default_factory=list)
    cleaning_checklist: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    images: Optional[List[str]] = Field(default_factory=list)


class PropertyUpdate(BaseSchema):
    """Schema for updating a property (all fields optional)"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    property_type: Optional[PropertyType] = None
    status: Optional[PropertyStatus] = None

    # Location
    address: Optional[str] = Field(default=None, min_length=1, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=50)
    zip_code: Optional[str] = Field(default=None, pattern=r"^\d{5}(-\d{4})?$")
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    # Capacity
    bedrooms: Optional[int] = Field(default=None, ge=0, le=50)
    bathrooms: Optional[float] = Field(default=None, ge=0, le=50)
    max_guests: Optional[int] = Field(default=None, ge=1, le=100)
    square_feet: Optional[int] = Field(default=None, ge=0)

    # WiFi
    wifi_network: Optional[str] = Field(default=None, max_length=100)
    wifi_password: Optional[str] = Field(default=None, max_length=100)

    # Parking
    parking_info: Optional[str] = Field(default=None, max_length=500)
    parking_spots: Optional[int] = Field(default=None, ge=0)

    # Instructions
    check_in_instructions: Optional[str] = Field(default=None, max_length=2000)
    check_out_instructions: Optional[str] = Field(default=None, max_length=2000)
    house_rules: Optional[str] = Field(default=None, max_length=3000)

    # Pricing
    nightly_rate: Optional[Decimal] = Field(default=None, ge=0)
    cleaning_fee: Optional[Decimal] = Field(default=None, ge=0)
    security_deposit: Optional[Decimal] = Field(default=None, ge=0)

    # External IDs
    airbnb_id: Optional[str] = Field(default=None, max_length=100)
    vrbo_id: Optional[str] = Field(default=None, max_length=100)
    airbnb_ical_url: Optional[str] = None
    vrbo_ical_url: Optional[str] = None

    # Arrays
    amenities: Optional[List[str]] = None
    cleaning_checklist: Optional[List[Dict[str, Any]]] = None
    images: Optional[List[str]] = None


class PropertyResponse(PropertyBase, IDMixin, TimestampMixin):
    """Full property response schema"""
    status: PropertyStatus = PropertyStatus.ACTIVE
    amenities: List[str] = Field(default_factory=list)
    cleaning_checklist: List[Dict[str, Any]] = Field(default_factory=list)
    images: List[str] = Field(default_factory=list)

    # Computed fields
    occupancy_rate: Optional[float] = Field(default=None, ge=0, le=1)
    avg_rating: Optional[float] = Field(default=None, ge=0, le=5)
    total_reviews: int = Field(default=0)
    total_bookings: int = Field(default=0)

    # Smart lock info
    smart_lock_id: Optional[str] = None
    has_smart_lock: bool = Field(default=False)


class PropertyListResponse(BaseSchema):
    """Simplified property for list views"""
    id: str
    name: str
    address: str
    city: str
    state: str
    bedrooms: int
    bathrooms: float
    max_guests: int
    nightly_rate: Decimal
    status: PropertyStatus
    property_type: PropertyType
    primary_image: Optional[str] = None
    occupancy_rate: Optional[float] = None
    avg_rating: Optional[float] = None


class PropertySearchParams(BaseSchema):
    """Property search/filter parameters"""
    q: Optional[str] = Field(default=None, description="Search query for name/address")
    status: Optional[PropertyStatus] = None
    property_type: Optional[PropertyType] = None
    min_bedrooms: Optional[int] = Field(default=None, ge=0)
    max_bedrooms: Optional[int] = Field(default=None, ge=0)
    min_bathrooms: Optional[float] = Field(default=None, ge=0)
    max_bathrooms: Optional[float] = Field(default=None, ge=0)
    min_guests: Optional[int] = Field(default=None, ge=1)
    max_guests: Optional[int] = Field(default=None, ge=1)
    min_rate: Optional[Decimal] = Field(default=None, ge=0)
    max_rate: Optional[Decimal] = Field(default=None, ge=0)
    city: Optional[str] = None
    has_pool: Optional[bool] = None
    has_hot_tub: Optional[bool] = None
    pet_friendly: Optional[bool] = None
    available_from: Optional[date] = None
    available_to: Optional[date] = None


class PropertyOccupancy(BaseSchema):
    """Property occupancy details"""
    property_id: str
    property_name: str
    occupancy_rate: float = Field(..., ge=0, le=1)
    total_days_in_period: int
    booked_days: int
    available_days: int
    blocked_days: int
    upcoming_bookings: List[Dict[str, Any]] = Field(default_factory=list)
    avg_nightly_rate: Optional[Decimal] = None
    revenue_potential: Optional[Decimal] = None


class PropertyFinancialSummary(BaseSchema):
    """Property financial summary"""
    property_id: str
    property_name: str
    period_start: date
    period_end: date

    # Revenue
    gross_revenue: Decimal
    cleaning_fees: Decimal
    platform_fees: Decimal
    net_revenue: Decimal

    # Expenses
    total_expenses: Decimal
    expenses_by_category: Dict[str, Decimal] = Field(default_factory=dict)

    # Profit
    net_profit: Decimal
    profit_margin: float = Field(..., ge=-100, le=100)

    # Comparisons
    revenue_vs_last_period: Optional[float] = None
    occupancy_vs_last_period: Optional[float] = None


# Export all
__all__ = [
    'PropertyType',
    'PropertyStatus',
    'AmenityCategory',
    'Amenity',
    'PropertyAmenities',
    'WiFiCredentials',
    'CheckInInstructions',
    'CheckOutInstructions',
    'CleaningChecklistItem',
    'PropertyPricing',
    'ExternalListing',
    'PropertyImages',
    'PropertyBase',
    'PropertyCreate',
    'PropertyUpdate',
    'PropertyResponse',
    'PropertyListResponse',
    'PropertySearchParams',
    'PropertyOccupancy',
    'PropertyFinancialSummary',
]
