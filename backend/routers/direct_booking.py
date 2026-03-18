"""
Direct Booking API Routes for Right at Home BnB
================================================
Enables direct booking flow bypassing OTA fees (15-20% savings).

Endpoints:
- POST /book/check-availability - Check dates availability
- POST /book/calculate - Calculate price breakdown
- POST /book/create - Create booking
- POST /book/payment - Process payment
- GET /book/{id}/confirmation - Get booking confirmation

ECHO OMEGA PRIME | Made by Commander Bobby Don McWilliams II
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
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
from services.stripe_payments import StripePaymentService, PaymentType

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
    STRIPE = "stripe"
    SQUARE = "square"


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class AvailabilityCheckRequest(BaseModel):
    """Request to check property availability"""
    property_id: str = Field(..., description="Property ID to check")
    check_in: date = Field(..., description="Check-in date")
    check_out: date = Field(..., description="Check-out date")


class AvailabilityCheckResponse(BaseModel):
    """Availability check result"""
    property_id: str
    check_in: date
    check_out: date
    available: bool
    conflicting_dates: List[str] = []
    min_nights: int = 1
    max_guests: int = 1
    message: str = ""


class PriceCalculationRequest(BaseModel):
    """Request to calculate booking price"""
    property_id: str = Field(..., description="Property ID")
    check_in: date = Field(..., description="Check-in date")
    check_out: date = Field(..., description="Check-out date")
    guest_count: int = Field(1, ge=1, le=16, description="Number of guests")
    apply_promo_code: Optional[str] = Field(None, description="Promo code")


class PriceBreakdown(BaseModel):
    """Detailed price breakdown"""
    nightly_rate: float
    num_nights: int
    subtotal: float
    cleaning_fee: float
    service_fee: float
    taxes: float
    security_deposit: float
    discount: float = 0.0
    discount_reason: Optional[str] = None
    ota_comparison: float  # What it would cost on Airbnb/VRBO
    savings: float  # Amount saved by booking direct
    savings_percentage: float
    total: float
    total_with_deposit: float


class PriceCalculationResponse(BaseModel):
    """Price calculation result"""
    property_id: str
    check_in: date
    check_out: date
    guest_count: int
    breakdown: PriceBreakdown
    currency: str = "USD"
    valid_until: datetime
    quote_id: str


class GuestInfo(BaseModel):
    """Guest information for booking"""
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
    """Request to create a booking"""
    property_id: str
    check_in: date
    check_out: date
    guest_count: int = Field(1, ge=1, le=16)
    guest_info: GuestInfo
    quote_id: Optional[str] = None
    promo_code: Optional[str] = None


class DirectBooking(BaseModel):
    """Direct booking record"""
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
    payment_intent_id: Optional[str] = None
    payment_status: str = "pending"
    created_at: datetime
    updated_at: datetime


class ProcessPaymentRequest(BaseModel):
    """Request to process payment"""
    booking_id: str
    payment_method: PaymentMethod = PaymentMethod.STRIPE
    payment_method_id: Optional[str] = None  # Stripe payment method ID
    nonce: Optional[str] = None  # Square nonce
    include_security_deposit: bool = True


class PaymentResponse(BaseModel):
    """Payment processing result"""
    success: bool
    booking_id: str
    payment_intent_id: Optional[str] = None
    client_secret: Optional[str] = None
    amount: float
    status: str
    message: str


class BookingConfirmation(BaseModel):
    """Full booking confirmation"""
    booking: DirectBooking
    property: Dict[str, Any]
    waiver_links: Dict[str, str]
    check_in_instructions: str
    house_rules: str
    contact_info: Dict[str, str]
    cancellation_policy: str


# =============================================================================
# IN-MEMORY STORAGE (Use database in production)
# =============================================================================

_direct_bookings: Dict[str, DirectBooking] = {}
_price_quotes: Dict[str, Dict[str, Any]] = {}

# Property pricing data (would come from database)
PROPERTY_PRICING = {
    "prop_001": {
        "name": "Desert Oasis",
        "nightly_rate": 175.00,
        "cleaning_fee": 125.00,
        "max_guests": 6,
        "min_nights": 2,
        "extra_guest_fee": 25.00,
        "base_guests": 4,
    },
    "prop_002": {
        "name": "Midland Manor",
        "nightly_rate": 225.00,
        "cleaning_fee": 150.00,
        "max_guests": 10,
        "min_nights": 2,
        "extra_guest_fee": 30.00,
        "base_guests": 6,
    },
    "default": {
        "name": "Property",
        "nightly_rate": 150.00,
        "cleaning_fee": 100.00,
        "max_guests": 8,
        "min_nights": 1,
        "extra_guest_fee": 20.00,
        "base_guests": 4,
    }
}

# OTA fee rates for comparison
OTA_FEES = {
    "airbnb_guest": 0.14,    # 14% guest service fee
    "airbnb_host": 0.03,     # 3% host fee
    "vrbo_guest": 0.12,      # 12% guest service fee
    "vrbo_host": 0.05,       # 5% host fee
}

# Tax rate for Midland, TX
TAX_RATE = 0.13  # 13% hotel occupancy tax

# Security deposit
SECURITY_DEPOSIT = 250.00


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_property_pricing(property_id: str) -> Dict[str, Any]:
    """Get pricing configuration for a property"""
    return PROPERTY_PRICING.get(property_id, PROPERTY_PRICING["default"])


def generate_confirmation_code() -> str:
    """Generate unique confirmation code"""
    import random
    import string
    return "RAH" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def calculate_ota_price(subtotal: float, cleaning_fee: float, nights: int) -> float:
    """Calculate what guest would pay on Airbnb/VRBO"""
    base = subtotal + cleaning_fee
    guest_fee = base * OTA_FEES["airbnb_guest"]  # Use Airbnb as comparison
    taxes = (base + guest_fee) * TAX_RATE
    return base + guest_fee + taxes


# =============================================================================
# DEPENDENCIES
# =============================================================================

def get_sync_service() -> CalendarSyncService:
    """Get calendar sync service"""
    return get_calendar_sync_service()


def get_payment_service() -> StripePaymentService:
    """Get Stripe payment service"""
    return StripePaymentService()


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/check-availability", response_model=AvailabilityCheckResponse)
async def check_availability(
    request: AvailabilityCheckRequest,
    sync_service: CalendarSyncService = Depends(get_sync_service),
):
    """
    Check if property is available for the requested dates.

    Returns availability status and any conflicting bookings.
    """
    property_pricing = get_property_pricing(request.property_id)

    # Validate dates
    if request.check_in >= request.check_out:
        raise HTTPException(status_code=400, detail="Check-out must be after check-in")

    if request.check_in < date.today():
        raise HTTPException(status_code=400, detail="Check-in cannot be in the past")

    nights = (request.check_out - request.check_in).days
    if nights < property_pricing["min_nights"]:
        return AvailabilityCheckResponse(
            property_id=request.property_id,
            check_in=request.check_in,
            check_out=request.check_out,
            available=False,
            min_nights=property_pricing["min_nights"],
            max_guests=property_pricing["max_guests"],
            message=f"Minimum stay is {property_pricing['min_nights']} nights"
        )

    # Check existing bookings from calendar sync
    start_dt = datetime.combine(request.check_in, datetime.min.time())
    end_dt = datetime.combine(request.check_out, datetime.min.time())

    existing_bookings = sync_service.get_bookings(
        property_id=request.property_id,
        start_date=start_dt - timedelta(days=1),
        end_date=end_dt + timedelta(days=1),
    )

    # Check for overlaps
    conflicting_dates = []
    for booking in existing_bookings:
        booking_start = booking.start_date.date() if isinstance(booking.start_date, datetime) else booking.start_date
        booking_end = booking.end_date.date() if isinstance(booking.end_date, datetime) else booking.end_date

        # Check if dates overlap
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
        min_nights=property_pricing["min_nights"],
        max_guests=property_pricing["max_guests"],
        message="Available!" if available else f"Property not available for {len(conflicting_dates)} of your requested nights"
    )


@router.post("/calculate", response_model=PriceCalculationResponse)
async def calculate_price(request: PriceCalculationRequest):
    """
    Calculate detailed price breakdown for a booking.

    Shows comparison with OTA pricing to highlight direct booking savings.
    """
    # Validate dates
    if request.check_in >= request.check_out:
        raise HTTPException(status_code=400, detail="Check-out must be after check-in")

    property_pricing = get_property_pricing(request.property_id)

    # Validate guest count
    if request.guest_count > property_pricing["max_guests"]:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {property_pricing['max_guests']} guests allowed"
        )

    # Calculate nights
    num_nights = (request.check_out - request.check_in).days

    if num_nights < property_pricing["min_nights"]:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum stay is {property_pricing['min_nights']} nights"
        )

    # Calculate base price
    nightly_rate = property_pricing["nightly_rate"]

    # Extra guest fees
    extra_guests = max(0, request.guest_count - property_pricing["base_guests"])
    extra_guest_total = extra_guests * property_pricing["extra_guest_fee"] * num_nights

    subtotal = (nightly_rate * num_nights) + extra_guest_total
    cleaning_fee = property_pricing["cleaning_fee"]

    # Direct booking service fee (much lower than OTA!)
    # We charge 3% service fee vs 14% on Airbnb
    service_fee = subtotal * 0.03

    # Taxes (hotel occupancy tax)
    taxable_amount = subtotal + cleaning_fee + service_fee
    taxes = taxable_amount * TAX_RATE

    # Security deposit (refundable)
    security_deposit = SECURITY_DEPOSIT

    # Apply promo code discount
    discount = 0.0
    discount_reason = None
    if request.apply_promo_code:
        promo_code = request.apply_promo_code.upper()
        if promo_code == "DIRECT10":
            discount = subtotal * 0.10
            discount_reason = "10% direct booking discount"
        elif promo_code == "REPEAT15":
            discount = subtotal * 0.15
            discount_reason = "15% repeat guest discount"
        elif promo_code == "STEVEN20":
            discount = subtotal * 0.20
            discount_reason = "20% owner special discount"

    # Calculate total
    total = subtotal + cleaning_fee + service_fee + taxes - discount
    total_with_deposit = total + security_deposit

    # Calculate OTA comparison (what it would cost on Airbnb)
    ota_comparison = calculate_ota_price(subtotal, cleaning_fee, num_nights)
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

    # Generate quote ID and store for validation
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

    logger.info(f"Price calculated for {request.property_id}: ${total:.2f} (saves ${savings:.2f} vs OTA)")

    return PriceCalculationResponse(
        property_id=request.property_id,
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

    Books the property and returns booking details.
    Payment must be processed separately via /book/payment.
    """
    # Verify quote if provided
    if request.quote_id:
        quote = _price_quotes.get(request.quote_id)
        if not quote:
            logger.warning(f"Invalid quote ID: {request.quote_id}")
        elif datetime.fromisoformat(quote["valid_until"]) < datetime.now():
            logger.warning(f"Expired quote: {request.quote_id}")
            raise HTTPException(status_code=400, detail="Price quote has expired. Please recalculate.")

    # Check availability again (double-booking prevention)
    avail_check = await check_availability(
        AvailabilityCheckRequest(
            property_id=request.property_id,
            check_in=request.check_in,
            check_out=request.check_out,
        ),
        sync_service,
    )

    if not avail_check.available:
        raise HTTPException(
            status_code=409,
            detail=f"Property is no longer available for these dates. {avail_check.message}"
        )

    # Calculate price (or use quote)
    price_request = PriceCalculationRequest(
        property_id=request.property_id,
        check_in=request.check_in,
        check_out=request.check_out,
        guest_count=request.guest_count,
        apply_promo_code=request.promo_code,
    )
    price_response = await calculate_price(price_request)

    # Generate booking
    booking_id = str(uuid.uuid4())
    confirmation_code = generate_confirmation_code()
    property_pricing = get_property_pricing(request.property_id)

    now = datetime.now()

    booking = DirectBooking(
        id=booking_id,
        property_id=request.property_id,
        property_name=property_pricing["name"],
        check_in=request.check_in,
        check_out=request.check_out,
        guest_count=request.guest_count,
        guest_info=request.guest_info,
        status=BookingStatus.AWAITING_PAYMENT,
        confirmation_code=confirmation_code,
        price_breakdown=price_response.breakdown,
        payment_intent_id=None,
        payment_status="pending",
        created_at=now,
        updated_at=now,
    )

    # Store booking
    _direct_bookings[booking_id] = booking

    logger.info(f"Created booking {confirmation_code} for {request.guest_info.email}")

    return booking


@router.post("/payment", response_model=PaymentResponse)
async def process_payment(
    request: ProcessPaymentRequest,
    payment_service: StripePaymentService = Depends(get_payment_service),
):
    """
    Process payment for a booking.

    Creates Stripe PaymentIntent for client-side payment completion.
    Returns client_secret for Stripe Elements integration.
    """
    # Get booking
    booking = _direct_bookings.get(request.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == BookingStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Booking is already paid")

    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Booking has been cancelled")

    # Calculate payment amount
    amount = booking.price_breakdown.total
    if request.include_security_deposit:
        amount = booking.price_breakdown.total_with_deposit

    if request.payment_method == PaymentMethod.STRIPE:
        # Create Stripe customer if needed
        customer_result = await payment_service.get_or_create_customer(
            email=booking.guest_info.email,
            name=f"{booking.guest_info.first_name} {booking.guest_info.last_name}",
            phone=booking.guest_info.phone,
        )

        if "error" in customer_result:
            raise HTTPException(status_code=500, detail=customer_result["error"])

        customer_id = customer_result["customer_id"]

        # Create payment intent
        intent_result = await payment_service.create_payment_intent(
            amount_cents=int(amount * 100),
            customer_id=customer_id,
            payment_type=PaymentType.BOOKING,
            property_id=None,  # Would use actual property ID from database
            booking_id=request.booking_id,
            description=f"Right At Home BnB - Booking {booking.confirmation_code}",
            metadata={
                "confirmation_code": booking.confirmation_code,
                "check_in": booking.check_in.isoformat(),
                "check_out": booking.check_out.isoformat(),
                "guest_name": f"{booking.guest_info.first_name} {booking.guest_info.last_name}",
                "guest_email": booking.guest_info.email,
                "includes_deposit": str(request.include_security_deposit),
            }
        )

        if "error" in intent_result:
            raise HTTPException(status_code=500, detail=intent_result["error"])

        # Update booking with payment intent
        booking.payment_intent_id = intent_result["payment_intent_id"]
        booking.payment_status = intent_result["status"]
        booking.updated_at = datetime.now()
        _direct_bookings[request.booking_id] = booking

        return PaymentResponse(
            success=True,
            booking_id=request.booking_id,
            payment_intent_id=intent_result["payment_intent_id"],
            client_secret=intent_result["client_secret"],
            amount=amount,
            status=intent_result["status"],
            message="Payment intent created. Complete payment with client_secret.",
        )

    elif request.payment_method == PaymentMethod.SQUARE:
        # Square integration would go here
        raise HTTPException(
            status_code=501,
            detail="Square payments coming soon. Please use Stripe."
        )

    raise HTTPException(status_code=400, detail="Invalid payment method")


@router.post("/payment/confirm/{booking_id}")
async def confirm_payment(
    booking_id: str,
    payment_service: StripePaymentService = Depends(get_payment_service),
):
    """
    Confirm payment completion (called after client-side payment success).

    Updates booking status to CONFIRMED.
    """
    booking = _direct_bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if not booking.payment_intent_id:
        raise HTTPException(status_code=400, detail="No payment intent found")

    # Verify payment with Stripe
    result = await payment_service.confirm_payment(booking.payment_intent_id)

    if result.get("success") and result.get("status") == "succeeded":
        booking.status = BookingStatus.CONFIRMED
        booking.payment_status = "paid"
        booking.updated_at = datetime.now()
        _direct_bookings[booking_id] = booking

        logger.info(f"Payment confirmed for booking {booking.confirmation_code}")

        return {
            "success": True,
            "booking_id": booking_id,
            "confirmation_code": booking.confirmation_code,
            "status": "confirmed",
            "message": "Payment successful! Your booking is confirmed.",
        }

    return {
        "success": False,
        "booking_id": booking_id,
        "status": result.get("status", "unknown"),
        "message": "Payment not yet complete. Please try again.",
    }


@router.get("/{booking_id}/confirmation", response_model=BookingConfirmation)
async def get_booking_confirmation(booking_id: str):
    """
    Get complete booking confirmation details.

    Includes:
    - Full booking details
    - Property information
    - Waiver links
    - Check-in instructions
    - House rules
    - Contact information
    """
    booking = _direct_bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    property_pricing = get_property_pricing(booking.property_id)

    # Build property info
    property_info = {
        "id": booking.property_id,
        "name": property_pricing["name"],
        "address": "123 Main St, Midland, TX 79701",  # Would come from database
        "bedrooms": 3,
        "bathrooms": 2,
        "max_guests": property_pricing["max_guests"],
        "amenities": ["WiFi", "Kitchen", "Washer/Dryer", "Parking", "AC"],
    }

    # Waiver links
    base_url = os.getenv("APP_BASE_URL", "https://rah-midland.com")
    waiver_links = {
        "liability_waiver": f"{base_url}/waivers/liability?booking={booking_id}",
        "pet_waiver": f"{base_url}/waivers/pet?booking={booking_id}",
        "rental_agreement": f"{base_url}/waivers/agreement?booking={booking_id}",
    }

    # Check-in instructions
    check_in_instructions = f"""
Welcome to {property_pricing['name']}!

CHECK-IN: 3:00 PM on {booking.check_in.strftime('%B %d, %Y')}
CHECK-OUT: 11:00 AM on {booking.check_out.strftime('%B %d, %Y')}

ENTRY CODE: You will receive your unique door code via text message 24 hours before check-in.

PARKING: Free parking available in the driveway. Please do not park on the street.

WIFI:
- Network: RightAtHome_Guest
- Password: Will be provided at check-in

BEFORE ARRIVAL:
1. Please complete all waivers linked above
2. Confirm your arrival time
3. Save Steven's contact info for emergencies

UPON ARRIVAL:
1. Use your unique door code to enter
2. Make yourself at home!
3. Text us if you have any questions

We're excited to host you!
"""

    # House rules
    house_rules = """
HOUSE RULES:

1. NO SMOKING - This is a smoke-free property. $500 cleaning fee for violations.

2. NO PARTIES/EVENTS - Maximum occupancy is strictly enforced.

3. QUIET HOURS - 10 PM to 8 AM. Please be respectful of neighbors.

4. PETS - Allowed with prior approval and pet waiver. $50 pet fee applies.

5. CHECK-OUT:
   - Start dishwasher if dirty dishes
   - Place all towels in bathtub
   - Take out trash
   - Lock all doors

6. DAMAGE - Security deposit covers normal wear. Excessive damage billed separately.

7. LOST KEYS/LOCKOUTS - $75 lockout fee. Door codes provided - no physical keys needed.

Thank you for being a great guest!
"""

    # Contact info
    contact_info = {
        "owner_name": "Steven Palma",
        "emergency_phone": "(432) 555-0123",
        "email": "bookings@rah-midland.com",
        "response_time": "Usually within 1 hour during business hours",
    }

    # Cancellation policy
    cancellation_policy = """
CANCELLATION POLICY - FLEXIBLE:

- Full refund if cancelled 48+ hours before check-in
- 50% refund if cancelled 24-48 hours before check-in
- No refund if cancelled less than 24 hours before check-in

Security deposit is fully refundable within 7 days of checkout,
minus any deductions for damages or violations.

To request cancellation, please contact us immediately.
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
    """Get booking by ID"""
    booking = _direct_bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.get("/lookup/{confirmation_code}")
async def lookup_by_confirmation_code(confirmation_code: str):
    """Look up booking by confirmation code"""
    for booking in _direct_bookings.values():
        if booking.confirmation_code.upper() == confirmation_code.upper():
            return booking
    raise HTTPException(status_code=404, detail="Booking not found")


@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    reason: Optional[str] = None,
    payment_service: StripePaymentService = Depends(get_payment_service),
):
    """
    Cancel a booking.

    Processes refund according to cancellation policy.
    """
    booking = _direct_bookings.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Booking is already cancelled")

    if booking.status == BookingStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot cancel completed booking")

    # Calculate refund based on cancellation policy
    now = datetime.now()
    check_in_datetime = datetime.combine(booking.check_in, datetime.min.time())
    hours_until_checkin = (check_in_datetime - now).total_seconds() / 3600

    refund_percentage = 0
    if hours_until_checkin >= 48:
        refund_percentage = 100
    elif hours_until_checkin >= 24:
        refund_percentage = 50
    else:
        refund_percentage = 0

    refund_amount = booking.price_breakdown.total * (refund_percentage / 100)

    # Process refund if payment was made
    if booking.payment_intent_id and booking.payment_status == "paid" and refund_amount > 0:
        refund_result = await payment_service.refund_payment(
            payment_intent_id=booking.payment_intent_id,
            amount_cents=int(refund_amount * 100) if refund_percentage < 100 else None,
            reason=f"Cancellation: {reason or 'Guest requested'}"
        )

        if "error" in refund_result:
            logger.error(f"Refund failed for booking {booking_id}: {refund_result['error']}")

    # Update booking status
    booking.status = BookingStatus.CANCELLED
    booking.updated_at = datetime.now()
    _direct_bookings[booking_id] = booking

    logger.info(f"Cancelled booking {booking.confirmation_code}, refund: ${refund_amount:.2f} ({refund_percentage}%)")

    return {
        "success": True,
        "booking_id": booking_id,
        "confirmation_code": booking.confirmation_code,
        "status": "cancelled",
        "refund_percentage": refund_percentage,
        "refund_amount": refund_amount,
        "message": f"Booking cancelled. {refund_percentage}% refund of ${refund_amount:.2f} will be processed.",
    }


# =============================================================================
# HEALTH CHECK
# =============================================================================

@router.get("/health")
async def direct_booking_health():
    """Health check for direct booking system"""
    return {
        "status": "healthy",
        "active_bookings": len([b for b in _direct_bookings.values() if b.status == BookingStatus.CONFIRMED]),
        "pending_bookings": len([b for b in _direct_bookings.values() if b.status == BookingStatus.AWAITING_PAYMENT]),
        "timestamp": datetime.now().isoformat(),
    }
