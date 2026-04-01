"""
Direct Booking API Routes for Right at Home BnB
================================================
Enables direct booking flow bypassing OTA fees (15-20% savings).
Uses PayPal for payment processing (Steven's preferred payment method).

Endpoints:
- POST /book/check-availability - Check dates availability
- POST /book/calculate - Calculate price breakdown
- POST /book/create - Create booking
- POST /book/payment - Process PayPal payment
- POST /book/payment/capture - Capture after guest approves
- GET /book/{id}/confirmation - Get booking confirmation
- GET /book/properties - List all properties with pricing
- POST /book/{id}/cancel - Cancel booking

ECHO OMEGA PRIME | Made by Commander Bobby Don McWilliams II
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from enum import Enum
import logging
import uuid
import os

from services.calendar_sync import (
    CalendarSyncService,
    get_calendar_sync_service,
    BookingPlatform,
)
from services.paypal_payments import PayPalPaymentService, get_paypal_service, PaymentType

logger = logging.getLogger("RightAtHomeBnB.DirectBooking")

router = APIRouter()


# =============================================================================
# ENUMS
# =============================================================================

class BookingStatus(str, Enum):
    PENDING = "pending"
    AWAITING_PAYMENT = "awaiting_payment"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class PaymentMethod(str, Enum):
    PAYPAL = "paypal"


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class AvailabilityCheckRequest(BaseModel):
    property_id: str = Field(..., description="Property ID to check")
    check_in: date = Field(..., description="Check-in date")
    check_out: date = Field(..., description="Check-out date")


class AvailabilityCheckResponse(BaseModel):
    property_id: str
    check_in: date
    check_out: date
    available: bool
    conflicting_dates: List[str] = []
    min_nights: int = 1
    max_guests: int = 1
    message: str = ""


class PriceCalculationRequest(BaseModel):
    property_id: str = Field(..., description="Property ID")
    check_in: date = Field(..., description="Check-in date")
    check_out: date = Field(..., description="Check-out date")
    guest_count: int = Field(1, ge=1, le=20, description="Number of guests")
    apply_promo_code: Optional[str] = Field(None, description="Promo code")


class PriceBreakdown(BaseModel):
    nightly_rate: float
    num_nights: int
    subtotal: float
    cleaning_fee: float
    service_fee: float
    taxes: float
    security_deposit: float
    discount: float = 0.0
    discount_reason: Optional[str] = None
    ota_comparison: float
    savings: float
    savings_percentage: float
    total: float
    total_with_deposit: float


class PriceCalculationResponse(BaseModel):
    property_id: str
    property_name: str
    check_in: date
    check_out: date
    guest_count: int
    breakdown: PriceBreakdown
    currency: str = "USD"
    valid_until: datetime
    quote_id: str


class GuestInfo(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: str = "USA"
    special_requests: Optional[str] = None
    arrival_time: Optional[str] = None
    marketing_consent: bool = False


class CreateBookingRequest(BaseModel):
    property_id: str
    check_in: date
    check_out: date
    guest_count: int = Field(1, ge=1, le=20)
    guest_info: GuestInfo
    quote_id: Optional[str] = None
    promo_code: Optional[str] = None


class DirectBooking(BaseModel):
    id: str
    property_id: str
    property_name: str
    check_in: date
    check_out: date
    guest_count: int
    guest_info: GuestInfo
    status: BookingStatus
    confirmation_code: str
    price_breakdown: PriceBreakdown
    paypal_order_id: Optional[str] = None
    paypal_capture_id: Optional[str] = None
    payment_status: str = "pending"
    created_at: datetime
    updated_at: datetime


class ProcessPaymentRequest(BaseModel):
    booking_id: str
    include_security_deposit: bool = True
    return_url: Optional[str] = None
    cancel_url: Optional[str] = None


class PaymentResponse(BaseModel):
    success: bool
    booking_id: str
    paypal_order_id: Optional[str] = None
    approve_url: Optional[str] = None
    amount: float
    status: str
    message: str


class BookingConfirmation(BaseModel):
    booking: DirectBooking
    property: Dict[str, Any]
    waiver_links: Dict[str, str]
    check_in_instructions: str
    house_rules: str
    contact_info: Dict[str, str]
    cancellation_policy: str


class PropertyListItem(BaseModel):
    id: str
    name: str
    address: str
    city: str = "Midland"
    state: str = "TX"
    bedrooms: int
    bathrooms: float
    sleeps: int
    nightly_rate: float
    cleaning_fee: float
    min_nights: int
    vrbo_id: Optional[str] = None
    vrbo_url: Optional[str] = None
    amenities: List[str] = []
    rating: Optional[str] = None
    reviews: Optional[int] = None
    photos: int = 0


# =============================================================================
# PROPERTY DATABASE — ALL 25 Steven Palma Properties
# =============================================================================

PROPERTIES: Dict[str, Dict[str, Any]] = {
    # ── VERIFIED ADDRESS PROPERTIES (8) ──────────────────────────────────
    "prop_18": {
        "name": "Santiago Dreams",
        "address": "1311 Daventry, Midland, TX 79705",
        "bedrooms": 4, "bathrooms": 3, "sleeps": 10,
        "nightly_rate": 225.00, "cleaning_fee": 150.00,
        "min_nights": 2, "max_guests": 10, "base_guests": 6,
        "extra_guest_fee": 25.00, "security_deposit": 300.00,
        "vrbo_id": "4179271", "rating": "10/10", "reviews": 18, "photos": 63,
        "amenities": ["Kitchen", "Washer", "Dryer", "Pet Friendly", "Free WiFi",
                       "AC", "Man Cave", "Two Large Yards", "Extra Parking"],
    },
    "prop_19": {
        "name": "Sprawling Ranch House with Pool Cabana & Playground",
        "address": "5055 Lincoln Green, Midland, TX 79705",
        "bedrooms": 6, "bathrooms": 3.5, "sleeps": 18,
        "nightly_rate": 350.00, "cleaning_fee": 200.00,
        "min_nights": 2, "max_guests": 18, "base_guests": 8,
        "extra_guest_fee": 30.00, "security_deposit": 500.00,
        "vrbo_id": "4581977", "rating": "9.0/10", "reviews": 2, "photos": 83,
        "amenities": ["Pool", "Washer", "Dryer", "Pet Friendly", "AC",
                       "Parking", "Fireplace", "Jetted Bathtub", "Pool Cabana", "Playground"],
    },
    "prop_20": {
        "name": "Posh & Private with Billiards",
        "address": "1426 Lanham, Midland, TX 79705",
        "bedrooms": 3, "bathrooms": 3.5, "sleeps": 10,
        "nightly_rate": 225.00, "cleaning_fee": 150.00,
        "min_nights": 2, "max_guests": 10, "base_guests": 6,
        "extra_guest_fee": 25.00, "security_deposit": 300.00,
        "vrbo_id": "4437486", "rating": "10/10", "reviews": 6, "photos": 46,
        "amenities": ["Kitchen", "Washer", "Dryer", "Pet Friendly", "AC",
                       "Parking", "Fireplace", "Billiards Table", "Private Setting"],
    },
    "prop_21": {
        "name": "Outdoor Dream",
        "address": "3106 Humble, Midland, TX 79705",
        "bedrooms": 4, "bathrooms": 2.5, "sleeps": 14,
        "nightly_rate": 275.00, "cleaning_fee": 175.00,
        "min_nights": 2, "max_guests": 14, "base_guests": 8,
        "extra_guest_fee": 25.00, "security_deposit": 350.00,
        "vrbo_id": "4700881", "rating": "6.8/10", "reviews": 5, "photos": 48,
        "amenities": ["Pool", "Hot Tub", "Kitchen", "Washer", "Dryer",
                       "Pet Friendly", "Patio", "Outdoor Living"],
    },
    "prop_22": {
        "name": "Most Marvelous with Pool",
        "address": "6100 Oriole, Midland, TX 79705",
        "bedrooms": 4, "bathrooms": 2, "sleeps": 8,
        "nightly_rate": 225.00, "cleaning_fee": 150.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 6,
        "extra_guest_fee": 25.00, "security_deposit": 300.00,
        "vrbo_id": "4471713", "rating": "9.6/10", "reviews": 5, "photos": 33,
        "amenities": ["Pool", "Kitchen", "Washer", "Dryer", "Pet Friendly",
                       "AC", "Fireplace"],
    },
    "prop_23": {
        "name": "Hot Tub Delight",
        "address": "4707 Dentcrest, Midland, TX 79705",
        "bedrooms": 3, "bathrooms": 2.5, "sleeps": 6,
        "nightly_rate": 175.00, "cleaning_fee": 125.00,
        "min_nights": 2, "max_guests": 6, "base_guests": 4,
        "extra_guest_fee": 25.00, "security_deposit": 250.00,
        "vrbo_id": "2638481", "rating": "8.4/10", "reviews": 28, "photos": 36,
        "amenities": ["Hot Tub", "Kitchen", "Washer", "Dryer", "Pet Friendly",
                       "Free WiFi", "Balcony", "Outdoor Spa Tub"],
    },
    "prop_24": {
        "name": "Saddle Club",
        "address": "1309 Daventry, Midland, TX 79705",
        "bedrooms": 4, "bathrooms": 3, "sleeps": 8,
        "nightly_rate": 225.00, "cleaning_fee": 150.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 6,
        "extra_guest_fee": 25.00, "security_deposit": 300.00,
        "vrbo_id": "4750070", "rating": "10/10", "reviews": 4, "photos": 49,
        "amenities": ["Washer", "Dryer", "AC", "Parking", "BBQ Grill",
                       "Children's Area", "Large Yard with Trees"],
    },
    "prop_25": {
        "name": "Monterrey House",
        "address": "Monterrey St, Midland, TX 79705",
        "bedrooms": 3, "bathrooms": 2, "sleeps": 6,
        "nightly_rate": 165.00, "cleaning_fee": 100.00,
        "min_nights": 2, "max_guests": 6, "base_guests": 4,
        "extra_guest_fee": 20.00, "security_deposit": 250.00,
        "vrbo_id": "3477668", "rating": "8.4/10", "reviews": 11, "photos": 26,
        "amenities": ["Kitchen", "Washer", "Dryer", "Pet Friendly", "Free WiFi",
                       "AC", "Patio/Terrace"],
    },

    # ── OTHER VRBO LISTINGS (Address Unverified) ────────────────────────
    "prop_01": {
        "name": "Oasis with Pool & Billiards",
        "address": "Castleford Area, Midland, TX",
        "bedrooms": 4, "bathrooms": 3.5, "sleeps": 10,
        "nightly_rate": 225.00, "cleaning_fee": 150.00,
        "min_nights": 2, "max_guests": 10, "base_guests": 6,
        "extra_guest_fee": 25.00, "security_deposit": 300.00,
        "vrbo_id": "2636389", "rating": "9.0/10", "reviews": 69, "photos": 50,
        "amenities": ["Pool", "Kitchen", "Washer", "Dryer", "Pet Friendly",
                       "Free WiFi", "Billiards"],
    },
    "prop_02": {
        "name": "Adobe Compound with Pool, Fire Pits & Billiards",
        "address": "Near Midland Memorial Hospital, Midland, TX",
        "bedrooms": 7, "bathrooms": 2.5, "sleeps": 16,
        "nightly_rate": 375.00, "cleaning_fee": 225.00,
        "min_nights": 2, "max_guests": 16, "base_guests": 8,
        "extra_guest_fee": 30.00, "security_deposit": 500.00,
        "vrbo_id": "3005111", "rating": "8.8/10", "reviews": 36, "photos": 75,
        "amenities": ["Pool", "Kitchen", "Washer", "Dryer", "Pet Friendly",
                       "Free WiFi", "Fire Pits", "Billiards"],
    },
    "prop_03": {
        "name": "Patio Home with Hot Tub",
        "address": "Near Midland College, Midland, TX",
        "bedrooms": 3, "bathrooms": 2, "sleeps": 8,
        "nightly_rate": 185.00, "cleaning_fee": 125.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 4,
        "extra_guest_fee": 25.00, "security_deposit": 250.00,
        "vrbo_id": "2634718", "rating": None, "reviews": 0, "photos": 30,
        "amenities": ["Hot Tub", "Multiple Outdoor Spaces", "Kitchen",
                       "Washer", "Dryer"],
    },
    "prop_04": {
        "name": "Old Midland Living with Massive Yard",
        "address": "Near George W. Bush Home, Midland, TX",
        "bedrooms": 4, "bathrooms": 3, "sleeps": 16,
        "nightly_rate": 325.00, "cleaning_fee": 200.00,
        "min_nights": 2, "max_guests": 16, "base_guests": 8,
        "extra_guest_fee": 30.00, "security_deposit": 400.00,
        "vrbo_id": "3355618", "rating": None, "reviews": 0, "photos": 40,
        "amenities": ["Pool", "Hot Tub", "Kitchen", "Washer", "Dryer",
                       "Pet Friendly", "Massive Yard"],
    },
    "prop_05": {
        "name": "Hot Tub Delight (Garfield)",
        "address": "Garfield Area, Midland, TX",
        "bedrooms": 3, "bathrooms": 2, "sleeps": 6,
        "nightly_rate": 175.00, "cleaning_fee": 125.00,
        "min_nights": 2, "max_guests": 6, "base_guests": 4,
        "extra_guest_fee": 25.00, "security_deposit": 250.00,
        "vrbo_id": None, "rating": None, "reviews": 0, "photos": 0,
        "amenities": ["Hot Tub", "Kitchen", "AC"],
    },
    "prop_06": {
        "name": "Safari Gameroom",
        "address": "Midland, TX",
        "bedrooms": 3, "bathrooms": 2, "sleeps": 8,
        "nightly_rate": 195.00, "cleaning_fee": 125.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 4,
        "extra_guest_fee": 25.00, "security_deposit": 250.00,
        "vrbo_id": "2638524", "rating": None, "reviews": 0, "photos": 30,
        "amenities": ["Game Room", "Safari Decor", "Kitchen", "AC"],
    },
    "prop_07": {
        "name": "Destination Getaway",
        "address": "Storey Area, Midland, TX",
        "bedrooms": 3, "bathrooms": 2, "sleeps": 8,
        "nightly_rate": 185.00, "cleaning_fee": 125.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 4,
        "extra_guest_fee": 25.00, "security_deposit": 250.00,
        "vrbo_id": "2643822", "rating": None, "reviews": 14, "photos": 30,
        "amenities": ["Kitchen", "Washer", "Dryer", "AC"],
    },
    "prop_08": {
        "name": "Retreat with Covered Patio",
        "address": "Chelsea Area, Midland, TX",
        "bedrooms": 3, "bathrooms": 2, "sleeps": 8,
        "nightly_rate": 185.00, "cleaning_fee": 125.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 4,
        "extra_guest_fee": 25.00, "security_deposit": 250.00,
        "vrbo_id": "2643784", "rating": None, "reviews": 0, "photos": 30,
        "amenities": ["Covered Patio", "Kitchen", "Washer", "Dryer", "AC"],
    },
    "prop_09": {
        "name": "Clermont House with Pool & Billiards",
        "address": "Midland, TX",
        "bedrooms": 4, "bathrooms": 3, "sleeps": 10,
        "nightly_rate": 250.00, "cleaning_fee": 150.00,
        "min_nights": 2, "max_guests": 10, "base_guests": 6,
        "extra_guest_fee": 25.00, "security_deposit": 300.00,
        "vrbo_id": None, "rating": None, "reviews": 22, "photos": 40,
        "amenities": ["Pool", "Billiards", "Kitchen", "Washer", "Dryer", "AC"],
    },
    "prop_10": {
        "name": "Uptown Place with Gated Yard",
        "address": "Midland, TX",
        "bedrooms": 3, "bathrooms": 2, "sleeps": 8,
        "nightly_rate": 195.00, "cleaning_fee": 125.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 4,
        "extra_guest_fee": 25.00, "security_deposit": 250.00,
        "vrbo_id": None, "rating": None, "reviews": 17, "photos": 30,
        "amenities": ["Gated Yard", "Covered Parking", "Kitchen", "AC"],
    },
    "prop_11": {
        "name": "Sprawling Ranch",
        "address": "Midland, TX",
        "bedrooms": 5, "bathrooms": 3, "sleeps": 14,
        "nightly_rate": 300.00, "cleaning_fee": 175.00,
        "min_nights": 2, "max_guests": 14, "base_guests": 8,
        "extra_guest_fee": 25.00, "security_deposit": 400.00,
        "vrbo_id": None, "rating": None, "reviews": 0, "photos": 0,
        "amenities": ["Large Property", "Kitchen", "AC"],
    },
    "prop_12": {
        "name": "Most Marvelous",
        "address": "Midland, TX",
        "bedrooms": 4, "bathrooms": 2, "sleeps": 8,
        "nightly_rate": 225.00, "cleaning_fee": 150.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 6,
        "extra_guest_fee": 25.00, "security_deposit": 300.00,
        "vrbo_id": None, "rating": None, "reviews": 0, "photos": 0,
        "amenities": ["Kitchen", "AC"],
    },
    "prop_13": {
        "name": "Posh Private",
        "address": "Midland, TX",
        "bedrooms": 3, "bathrooms": 2, "sleeps": 8,
        "nightly_rate": 195.00, "cleaning_fee": 125.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 4,
        "extra_guest_fee": 25.00, "security_deposit": 250.00,
        "vrbo_id": None, "rating": None, "reviews": 0, "photos": 0,
        "amenities": ["Private Setting", "Kitchen", "AC"],
    },
    "prop_14": {
        "name": "Cowboy Siesta Corner Lot",
        "address": "Midland, TX",
        "bedrooms": 3, "bathrooms": 2, "sleeps": 8,
        "nightly_rate": 185.00, "cleaning_fee": 125.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 4,
        "extra_guest_fee": 25.00, "security_deposit": 250.00,
        "vrbo_id": None, "rating": None, "reviews": 0, "photos": 0,
        "amenities": ["Corner Lot", "Patio", "Covered Parking", "Kitchen", "AC"],
    },
    "prop_15": {
        "name": "Outdoor Dream (Original)",
        "address": "Midland, TX",
        "bedrooms": 4, "bathrooms": 2, "sleeps": 10,
        "nightly_rate": 225.00, "cleaning_fee": 150.00,
        "min_nights": 2, "max_guests": 10, "base_guests": 6,
        "extra_guest_fee": 25.00, "security_deposit": 300.00,
        "vrbo_id": None, "rating": None, "reviews": 0, "photos": 0,
        "amenities": ["Outdoor Living", "Kitchen", "AC"],
    },
    "prop_16": {
        "name": "Vanguard Velvet Lounge",
        "address": "Vanguard Area, Midland, TX",
        "bedrooms": 3, "bathrooms": 2, "sleeps": 8,
        "nightly_rate": 195.00, "cleaning_fee": 125.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 4,
        "extra_guest_fee": 25.00, "security_deposit": 250.00,
        "vrbo_id": None, "rating": None, "reviews": 17, "photos": 30,
        "amenities": ["Lounge", "Kitchen", "Washer", "Dryer", "AC"],
    },
    "prop_17": {
        "name": "Groovy Times with Pool",
        "address": "Shandon Area, Midland, TX",
        "bedrooms": 3, "bathrooms": 2, "sleeps": 8,
        "nightly_rate": 210.00, "cleaning_fee": 150.00,
        "min_nights": 2, "max_guests": 8, "base_guests": 4,
        "extra_guest_fee": 25.00, "security_deposit": 300.00,
        "vrbo_id": None, "rating": None, "reviews": 0, "photos": 30,
        "amenities": ["Pool", "Kitchen", "Washer", "Dryer", "AC"],
    },
}

# OTA fee rates for savings comparison
OTA_FEES = {
    "airbnb_guest": 0.14,    # 14% guest service fee
    "airbnb_host": 0.03,     # 3% host fee
    "vrbo_guest": 0.12,      # 12% guest service fee
    "vrbo_host": 0.05,       # 5% host fee
}

# Midland TX hotel occupancy tax
TAX_RATE = 0.13


# =============================================================================
# IN-MEMORY STORAGE (Firebase in production)
# =============================================================================

_direct_bookings: Dict[str, DirectBooking] = {}
_price_quotes: Dict[str, Dict[str, Any]] = {}


# =============================================================================
# HELPERS
# =============================================================================

def get_property(property_id: str) -> Dict[str, Any]:
    """Get property data by ID."""
    prop = PROPERTIES.get(property_id)
    if not prop:
        raise HTTPException(status_code=404, detail=f"Property {property_id} not found")
    return prop


def generate_confirmation_code() -> str:
    """Generate unique confirmation code."""
    import random
    import string
    return "RAH" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def calculate_ota_price(subtotal: float, cleaning_fee: float) -> float:
    """Calculate what guest would pay on Airbnb/VRBO for comparison."""
    base = subtotal + cleaning_fee
    guest_fee = base * OTA_FEES["airbnb_guest"]
    taxes = (base + guest_fee) * TAX_RATE
    return base + guest_fee + taxes


# =============================================================================
# DEPENDENCIES
# =============================================================================

def get_sync_service() -> CalendarSyncService:
    return get_calendar_sync_service()


def get_payment_service() -> PayPalPaymentService:
    return get_paypal_service()


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/properties", response_model=List[PropertyListItem])
async def list_properties():
    """
    List all available properties with pricing.

    Returns all 25 Right At Home BnB properties in Midland, TX.
    """
    result = []
    for prop_id, prop in PROPERTIES.items():
        vrbo_url = f"https://www.vrbo.com/{prop['vrbo_id']}" if prop.get("vrbo_id") else None
        result.append(PropertyListItem(
            id=prop_id,
            name=prop["name"],
            address=prop["address"],
            bedrooms=prop["bedrooms"],
            bathrooms=prop["bathrooms"],
            sleeps=prop["sleeps"],
            nightly_rate=prop["nightly_rate"],
            cleaning_fee=prop["cleaning_fee"],
            min_nights=prop["min_nights"],
            vrbo_id=prop.get("vrbo_id"),
            vrbo_url=vrbo_url,
            amenities=prop.get("amenities", []),
            rating=prop.get("rating"),
            reviews=prop.get("reviews", 0),
            photos=prop.get("photos", 0),
        ))
    return result


@router.get("/properties/{property_id}")
async def get_property_detail(property_id: str):
    """Get full property details."""
    prop = get_property(property_id)
    vrbo_url = f"https://www.vrbo.com/{prop['vrbo_id']}" if prop.get("vrbo_id") else None
    return {
        "id": property_id,
        **prop,
        "vrbo_url": vrbo_url,
        "ical_url": f"https://www.vrbo.com/icalendar/{prop['vrbo_id']}.ics" if prop.get("vrbo_id") else None,
        "direct_booking_url": f"https://rah-midland.com/book/{property_id}",
    }


@router.post("/check-availability", response_model=AvailabilityCheckResponse)
async def check_availability(
    request: AvailabilityCheckRequest,
    sync_service: CalendarSyncService = Depends(get_sync_service),
):
    """Check if property is available for the requested dates."""
    prop = get_property(request.property_id)

    if request.check_in >= request.check_out:
        raise HTTPException(status_code=400, detail="Check-out must be after check-in")

    if request.check_in < date.today():
        raise HTTPException(status_code=400, detail="Check-in cannot be in the past")

    nights = (request.check_out - request.check_in).days
    if nights < prop["min_nights"]:
        return AvailabilityCheckResponse(
            property_id=request.property_id,
            check_in=request.check_in,
            check_out=request.check_out,
            available=False,
            min_nights=prop["min_nights"],
            max_guests=prop["max_guests"],
            message=f"Minimum stay is {prop['min_nights']} nights"
        )

    # Check iCal sync for existing bookings
    start_dt = datetime.combine(request.check_in, datetime.min.time())
    end_dt = datetime.combine(request.check_out, datetime.min.time())

    existing_bookings = sync_service.get_bookings(
        property_id=request.property_id,
        start_date=start_dt - timedelta(days=1),
        end_date=end_dt + timedelta(days=1),
    )

    conflicting_dates = []
    for booking in existing_bookings:
        booking_start = booking.start_date.date() if isinstance(booking.start_date, datetime) else booking.start_date
        booking_end = booking.end_date.date() if isinstance(booking.end_date, datetime) else booking.end_date

        if not (request.check_out <= booking_start or request.check_in >= booking_end):
            current = max(request.check_in, booking_start)
            while current < min(request.check_out, booking_end):
                conflicting_dates.append(current.isoformat())
                current += timedelta(days=1)

    available = len(conflicting_dates) == 0

    return AvailabilityCheckResponse(
        property_id=request.property_id,
        check_in=request.check_in,
        check_out=request.check_out,
        available=available,
        conflicting_dates=conflicting_dates,
        min_nights=prop["min_nights"],
        max_guests=prop["max_guests"],
        message="Available! Book direct and save 10-15%!" if available else f"Not available for {len(conflicting_dates)} of your requested nights"
    )


@router.post("/calculate", response_model=PriceCalculationResponse)
async def calculate_price(request: PriceCalculationRequest):
    """
    Calculate detailed price breakdown.

    Shows savings vs OTA (VRBO/Airbnb) to encourage direct booking.
    """
    prop = get_property(request.property_id)

    if request.check_in >= request.check_out:
        raise HTTPException(status_code=400, detail="Check-out must be after check-in")

    if request.guest_count > prop["max_guests"]:
        raise HTTPException(status_code=400, detail=f"Maximum {prop['max_guests']} guests allowed")

    num_nights = (request.check_out - request.check_in).days
    if num_nights < prop["min_nights"]:
        raise HTTPException(status_code=400, detail=f"Minimum stay is {prop['min_nights']} nights")

    nightly_rate = prop["nightly_rate"]
    extra_guests = max(0, request.guest_count - prop["base_guests"])
    extra_guest_total = extra_guests * prop["extra_guest_fee"] * num_nights

    subtotal = (nightly_rate * num_nights) + extra_guest_total
    cleaning_fee = prop["cleaning_fee"]

    # Direct booking: 3% service fee vs 12-14% on OTAs
    service_fee = subtotal * 0.03

    taxable_amount = subtotal + cleaning_fee + service_fee
    taxes = taxable_amount * TAX_RATE

    security_deposit = prop.get("security_deposit", 250.00)

    # Promo codes
    discount = 0.0
    discount_reason = None
    if request.apply_promo_code:
        code = request.apply_promo_code.upper()
        if code == "DIRECT10":
            discount = subtotal * 0.10
            discount_reason = "10% direct booking discount"
        elif code == "REPEAT15":
            discount = subtotal * 0.15
            discount_reason = "15% repeat guest discount"
        elif code == "STEVEN20":
            discount = subtotal * 0.20
            discount_reason = "20% owner special discount"
        elif code == "OILFIELD10":
            discount = subtotal * 0.10
            discount_reason = "10% oilfield worker discount"
        elif code == "WEEKLY25":
            if num_nights >= 7:
                discount = subtotal * 0.25
                discount_reason = "25% weekly stay discount"
        elif code == "MONTHLY40":
            if num_nights >= 28:
                discount = subtotal * 0.40
                discount_reason = "40% monthly stay discount"

    total = subtotal + cleaning_fee + service_fee + taxes - discount
    total_with_deposit = total + security_deposit

    ota_comparison = calculate_ota_price(subtotal, cleaning_fee)
    savings = ota_comparison - total
    savings_percentage = (savings / ota_comparison) * 100 if ota_comparison > 0 else 0

    breakdown = PriceBreakdown(
        nightly_rate=nightly_rate,
        num_nights=num_nights,
        subtotal=round(subtotal, 2),
        cleaning_fee=round(cleaning_fee, 2),
        service_fee=round(service_fee, 2),
        taxes=round(taxes, 2),
        security_deposit=round(security_deposit, 2),
        discount=round(discount, 2),
        discount_reason=discount_reason,
        ota_comparison=round(ota_comparison, 2),
        savings=round(savings, 2),
        savings_percentage=round(savings_percentage, 1),
        total=round(total, 2),
        total_with_deposit=round(total_with_deposit, 2),
    )

    quote_id = str(uuid.uuid4())
    _price_quotes[quote_id] = {
        "property_id": request.property_id,
        "check_in": request.check_in.isoformat(),
        "check_out": request.check_out.isoformat(),
        "guest_count": request.guest_count,
        "breakdown": breakdown.model_dump(),
        "created_at": datetime.now().isoformat(),
        "valid_until": (datetime.now() + timedelta(hours=24)).isoformat(),
    }

    logger.info(f"Price: {prop['name']} | ${total:.2f} (save ${savings:.2f} vs OTA)")

    return PriceCalculationResponse(
        property_id=request.property_id,
        property_name=prop["name"],
        check_in=request.check_in,
        check_out=request.check_out,
        guest_count=request.guest_count,
        breakdown=breakdown,
        currency="USD",
        valid_until=datetime.now() + timedelta(hours=24),
        quote_id=quote_id,
    )


@router.post("/create", response_model=DirectBooking)
async def create_booking(
    request: CreateBookingRequest,
    sync_service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Create a new direct booking.

    Payment processed separately via /book/payment (PayPal).
    """
    prop = get_property(request.property_id)

    if request.quote_id:
        quote = _price_quotes.get(request.quote_id)
        if quote and datetime.fromisoformat(quote["valid_until"]) < datetime.now():
            raise HTTPException(status_code=400, detail="Price quote expired. Please recalculate.")

    # Double-booking prevention
    avail = await check_availability(
        AvailabilityCheckRequest(
            property_id=request.property_id,
            check_in=request.check_in,
            check_out=request.check_out,
        ),
        sync_service,
    )

    if not avail.available:
        raise HTTPException(status_code=409, detail=f"Property no longer available. {avail.message}")

    # Calculate price
    price_response = await calculate_price(PriceCalculationRequest(
        property_id=request.property_id,
        check_in=request.check_in,
        check_out=request.check_out,
        guest_count=request.guest_count,
        apply_promo_code=request.promo_code,
    ))

    booking_id = str(uuid.uuid4())
    confirmation_code = generate_confirmation_code()
    now = datetime.now()

    booking = DirectBooking(
        id=booking_id,
        property_id=request.property_id,
        property_name=prop["name"],
        check_in=request.check_in,
        check_out=request.check_out,
        guest_count=request.guest_count,
        guest_info=request.guest_info,
        status=BookingStatus.AWAITING_PAYMENT,
        confirmation_code=confirmation_code,
        price_breakdown=price_response.breakdown,
        payment_status="pending",
        created_at=now,
        updated_at=now,
    )

    _direct_bookings[booking_id] = booking
    logger.info(f"Booking created: {confirmation_code} | {prop['name']} | {request.guest_info.email}")

    return booking


@router.post("/payment", response_model=PaymentResponse)
async def process_payment(
    request: ProcessPaymentRequest,
    paypal: PayPalPaymentService = Depends(get_payment_service),
):
    """
    Create PayPal payment order for a booking.

    Returns approve_url — redirect the guest there to complete payment.
    After guest pays, PayPal redirects to return_url, then call /payment/capture.
    """
    booking = _direct_bookings.get(request.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == BookingStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Booking already paid")

    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Booking cancelled")

    prop = get_property(booking.property_id)

    result = await paypal.create_order(
        amount=booking.price_breakdown.total,
        booking_id=request.booking_id,
        confirmation_code=booking.confirmation_code,
        property_name=prop["name"],
        check_in=booking.check_in.isoformat(),
        check_out=booking.check_out.isoformat(),
        guest_name=f"{booking.guest_info.first_name} {booking.guest_info.last_name}",
        guest_email=booking.guest_info.email,
        include_deposit=request.include_security_deposit,
        deposit_amount=booking.price_breakdown.security_deposit,
        return_url=request.return_url or "",
        cancel_url=request.cancel_url or "",
    )

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    # Store PayPal order ID on booking
    booking.paypal_order_id = result["order_id"]
    booking.payment_status = "awaiting_approval"
    booking.updated_at = datetime.now()
    _direct_bookings[request.booking_id] = booking

    return PaymentResponse(
        success=True,
        booking_id=request.booking_id,
        paypal_order_id=result["order_id"],
        approve_url=result.get("approve_url"),
        amount=result["amount"],
        status="CREATED",
        message="Redirect guest to approve_url to complete PayPal payment.",
    )


@router.post("/payment/capture/{booking_id}")
async def capture_payment(
    booking_id: str,
    paypal: PayPalPaymentService = Depends(get_payment_service),
):
    """
    Capture PayPal payment after guest approves.

    Call this when guest returns from PayPal (return_url redirect).
    """
    booking = _direct_bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if not booking.paypal_order_id:
        raise HTTPException(status_code=400, detail="No PayPal order found for this booking")

    result = await paypal.capture_order(booking.paypal_order_id)

    if result.get("success"):
        booking.status = BookingStatus.CONFIRMED
        booking.paypal_capture_id = result.get("capture_id")
        booking.payment_status = "paid"
        booking.updated_at = datetime.now()
        _direct_bookings[booking_id] = booking

        logger.info(f"Payment captured: {booking.confirmation_code} | PayPal: {result['capture_id']}")

        return {
            "success": True,
            "booking_id": booking_id,
            "confirmation_code": booking.confirmation_code,
            "status": "confirmed",
            "capture_id": result["capture_id"],
            "message": "Payment successful! Your booking is confirmed.",
        }

    return {
        "success": False,
        "booking_id": booking_id,
        "status": result.get("status", "unknown"),
        "message": "Payment not yet complete. Guest may need to complete PayPal checkout.",
    }


@router.post("/webhook/paypal")
async def paypal_webhook(
    request: Request,
    paypal: PayPalPaymentService = Depends(get_payment_service),
):
    """
    PayPal webhook handler for async payment events.

    Events handled:
    - CHECKOUT.ORDER.APPROVED — Guest approved, auto-capture
    - PAYMENT.CAPTURE.COMPLETED — Payment confirmed
    - PAYMENT.CAPTURE.REFUNDED — Refund processed
    """
    body = await request.body()
    headers = dict(request.headers)

    # Verify webhook signature
    verified = await paypal.verify_webhook(headers, body)
    if not verified:
        logger.warning("PayPal webhook signature verification failed")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json
    event = json.loads(body)
    event_type = event.get("event_type", "")
    resource = event.get("resource", {})

    logger.info(f"PayPal webhook: {event_type}")

    if event_type == "CHECKOUT.ORDER.APPROVED":
        order_id = resource.get("id")
        # Find booking by PayPal order ID
        for bid, booking in _direct_bookings.items():
            if booking.paypal_order_id == order_id:
                # Auto-capture
                result = await paypal.capture_order(order_id)
                if result.get("success"):
                    booking.status = BookingStatus.CONFIRMED
                    booking.paypal_capture_id = result.get("capture_id")
                    booking.payment_status = "paid"
                    booking.updated_at = datetime.now()
                    _direct_bookings[bid] = booking
                    logger.info(f"Auto-captured: {booking.confirmation_code}")
                break

    elif event_type == "PAYMENT.CAPTURE.COMPLETED":
        capture_id = resource.get("id")
        logger.info(f"Payment capture completed: {capture_id}")

    elif event_type == "PAYMENT.CAPTURE.REFUNDED":
        capture_id = resource.get("id")
        logger.info(f"Refund processed for capture: {capture_id}")

    return {"status": "ok"}


@router.get("/{booking_id}/confirmation", response_model=BookingConfirmation)
async def get_booking_confirmation(booking_id: str):
    """Get complete booking confirmation with check-in instructions."""
    booking = _direct_bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    prop = get_property(booking.property_id)

    property_info = {
        "id": booking.property_id,
        "name": prop["name"],
        "address": prop["address"],
        "bedrooms": prop["bedrooms"],
        "bathrooms": prop["bathrooms"],
        "max_guests": prop["max_guests"],
        "amenities": prop.get("amenities", []),
    }

    base_url = os.getenv("APP_BASE_URL", "https://rah-midland.com")
    waiver_links = {
        "liability_waiver": f"{base_url}/waivers/liability?booking={booking_id}",
        "pet_waiver": f"{base_url}/waivers/pet?booking={booking_id}",
        "rental_agreement": f"{base_url}/waivers/agreement?booking={booking_id}",
    }

    check_in_instructions = f"""
Welcome to {prop['name']}!

CHECK-IN: 3:00 PM on {booking.check_in.strftime('%B %d, %Y')}
CHECK-OUT: 11:00 AM on {booking.check_out.strftime('%B %d, %Y')}

ENTRY CODE: You will receive your unique door code via text 24 hours before check-in.

PARKING: Free parking available in the driveway.

WIFI: Network and password provided at check-in.

BEFORE ARRIVAL:
1. Complete all waivers linked in your confirmation email
2. Confirm your arrival time
3. Save Steven's contact info for emergencies

We're excited to host you!
"""

    house_rules = """
HOUSE RULES:

1. NO SMOKING - Smoke-free property. $500 cleaning fee for violations.
2. NO PARTIES/EVENTS - Maximum occupancy strictly enforced.
3. QUIET HOURS - 10 PM to 8 AM.
4. PETS - Allowed with prior approval and pet waiver. $50 pet fee.
5. CHECK-OUT: Start dishwasher, place towels in bathtub, take out trash, lock doors.
6. DAMAGE - Security deposit covers normal wear. Excessive damage billed separately.
7. LOST KEYS/LOCKOUTS - $75 lockout fee. Door codes provided.

Thank you for being a great guest!
"""

    contact_info = {
        "owner_name": "Steven Palma",
        "emergency_phone": "(432) 555-0123",
        "email": "bookings@rightathomebnb.com",
        "response_time": "Usually within 1 hour",
    }

    cancellation_policy = """
CANCELLATION POLICY - FLEXIBLE:

- Full refund if cancelled 48+ hours before check-in
- 50% refund if cancelled 24-48 hours before check-in
- No refund if cancelled less than 24 hours before check-in

Security deposit fully refundable within 7 days of checkout.
"""

    return BookingConfirmation(
        booking=booking,
        property=property_info,
        waiver_links=waiver_links,
        check_in_instructions=check_in_instructions,
        house_rules=house_rules,
        contact_info=contact_info,
        cancellation_policy=cancellation_policy,
    )


@router.get("/{booking_id}")
async def get_booking(booking_id: str):
    """Get booking by ID."""
    booking = _direct_bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.get("/lookup/{confirmation_code}")
async def lookup_by_confirmation_code(confirmation_code: str):
    """Look up booking by confirmation code."""
    for booking in _direct_bookings.values():
        if booking.confirmation_code.upper() == confirmation_code.upper():
            return booking
    raise HTTPException(status_code=404, detail="Booking not found")


@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    reason: Optional[str] = None,
    paypal: PayPalPaymentService = Depends(get_payment_service),
):
    """
    Cancel a booking with refund per cancellation policy.

    Refund processed via PayPal automatically.
    """
    booking = _direct_bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Already cancelled")

    if booking.status == BookingStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot cancel completed booking")

    # Calculate refund
    now = datetime.now()
    check_in_dt = datetime.combine(booking.check_in, datetime.min.time())
    hours_until = (check_in_dt - now).total_seconds() / 3600

    if hours_until >= 48:
        refund_pct = 100
    elif hours_until >= 24:
        refund_pct = 50
    else:
        refund_pct = 0

    refund_amount = booking.price_breakdown.total * (refund_pct / 100)

    # Process PayPal refund
    if booking.paypal_capture_id and booking.payment_status == "paid" and refund_amount > 0:
        refund_result = await paypal.refund_payment(
            capture_id=booking.paypal_capture_id,
            amount=refund_amount if refund_pct < 100 else None,
            reason=f"Cancellation: {reason or 'Guest requested'}",
        )
        if "error" in refund_result:
            logger.error(f"Refund failed: {booking_id}: {refund_result['error']}")

    booking.status = BookingStatus.CANCELLED
    booking.updated_at = datetime.now()
    _direct_bookings[booking_id] = booking

    logger.info(f"Cancelled {booking.confirmation_code} | Refund: ${refund_amount:.2f} ({refund_pct}%)")

    return {
        "success": True,
        "booking_id": booking_id,
        "confirmation_code": booking.confirmation_code,
        "status": "cancelled",
        "refund_percentage": refund_pct,
        "refund_amount": refund_amount,
        "message": f"Booking cancelled. {refund_pct}% refund of ${refund_amount:.2f} processing via PayPal.",
    }


# =============================================================================
# ICAL SYNC ENDPOINTS — VRBO Calendar Integration
# =============================================================================

@router.get("/ical/{property_id}.ics")
async def export_ical(property_id: str):
    """
    Export property calendar as iCal for VRBO import.

    Add this URL to VRBO's "Import calendar" to sync direct bookings
    back to VRBO and prevent double-booking.
    """
    prop = get_property(property_id)

    # Build iCal from direct bookings
    events = []
    for booking in _direct_bookings.values():
        if booking.property_id == property_id and booking.status in (BookingStatus.CONFIRMED, BookingStatus.AWAITING_PAYMENT):
            events.append(
                f"BEGIN:VEVENT\r\n"
                f"DTSTART;VALUE=DATE:{booking.check_in.strftime('%Y%m%d')}\r\n"
                f"DTEND;VALUE=DATE:{booking.check_out.strftime('%Y%m%d')}\r\n"
                f"SUMMARY:Direct Booking - {booking.confirmation_code}\r\n"
                f"DESCRIPTION:Guest: {booking.guest_info.first_name} {booking.guest_info.last_name}\\nBooked on rah-midland.com\r\n"
                f"UID:{booking.id}@rah-midland.com\r\n"
                f"STATUS:CONFIRMED\r\n"
                f"END:VEVENT\r\n"
            )

    ical = (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//Right At Home BnB//Direct Bookings//EN\r\n"
        f"X-WR-CALNAME:{prop['name']} - Direct Bookings\r\n"
        + "".join(events)
        + "END:VCALENDAR\r\n"
    )

    from fastapi.responses import Response
    return Response(content=ical, media_type="text/calendar")


@router.get("/vrbo-sync-urls")
async def get_vrbo_sync_urls():
    """
    Get all VRBO iCal import/export URLs for calendar sync setup.

    For each property:
    - import_url: VRBO's calendar to import INTO our system (already in vrbo-integration.ts)
    - export_url: Our calendar to import INTO VRBO (prevents double-booking)
    """
    base_url = os.getenv("APP_BASE_URL", "https://rah-midland.com")
    sync_urls = []

    for prop_id, prop in PROPERTIES.items():
        if prop.get("vrbo_id"):
            sync_urls.append({
                "property_id": prop_id,
                "name": prop["name"],
                "vrbo_id": prop["vrbo_id"],
                "vrbo_ical_import": f"https://www.vrbo.com/icalendar/{prop['vrbo_id']}.ics",
                "direct_booking_ical_export": f"{base_url}/api/book/ical/{prop_id}.ics",
                "vrbo_listing_url": f"https://www.vrbo.com/{prop['vrbo_id']}",
            })

    return {
        "total_properties": len(PROPERTIES),
        "vrbo_linked": len(sync_urls),
        "sync_urls": sync_urls,
        "instructions": {
            "step_1": "Import VRBO calendars: Use vrbo_ical_import URLs in our calendar sync service",
            "step_2": "Export to VRBO: Add direct_booking_ical_export URLs to VRBO's 'Import a calendar' feature",
            "step_3": "This creates 2-way sync preventing double bookings across platforms",
        },
    }


# =============================================================================
# HEALTH
# =============================================================================

@router.get("/health")
async def direct_booking_health():
    return {
        "status": "healthy",
        "payment_provider": "paypal",
        "total_properties": len(PROPERTIES),
        "active_bookings": len([b for b in _direct_bookings.values() if b.status == BookingStatus.CONFIRMED]),
        "pending_bookings": len([b for b in _direct_bookings.values() if b.status == BookingStatus.AWAITING_PAYMENT]),
        "timestamp": datetime.now().isoformat(),
    }
