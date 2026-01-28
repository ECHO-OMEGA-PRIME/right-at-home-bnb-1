"""
Right At Home BnB - Guest Portal API Routes
=============================================
Magic link access for guests - no login required.
Provides booking info, check-in details, AI concierge, and waiver signing.

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Request
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time, timedelta
from loguru import logger
import hashlib
import secrets
import hmac
from enum import Enum

router = APIRouter()


# ============================================================================
# CONFIGURATION
# ============================================================================

# Secret key for magic links (should be in env vars in production)
MAGIC_LINK_SECRET = "rightathomebnb_magic_link_2025_secure_key"
MAGIC_LINK_EXPIRY_DAYS = 30


# ============================================================================
# MODELS
# ============================================================================

class IssueCategory(str, Enum):
    """Issue categories for guest reports"""
    MAINTENANCE = "maintenance"
    CLEANING = "cleaning"
    AMENITIES = "amenities"
    NOISE = "noise"
    SAFETY = "safety"
    LOCK_ACCESS = "lock_access"
    WIFI = "wifi"
    HVAC = "hvac"
    APPLIANCE = "appliance"
    OTHER = "other"


class IssuePriority(str, Enum):
    """Issue priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class WaiverType(str, Enum):
    """Waiver types"""
    LIABILITY = "liability"
    PET = "pet"
    POOL = "pool"
    HOT_TUB = "hot_tub"
    DAMAGE_DEPOSIT = "damage_deposit"


class GuestBookingResponse(BaseModel):
    """Full booking details for guest portal"""
    booking_id: str
    confirmation_code: str
    status: str

    # Property details
    property_id: str
    property_name: str
    property_address: str
    property_city: str = "Midland"
    property_state: str = "TX"
    property_zip: str
    property_photos: List[str] = []
    property_amenities: List[str] = []
    property_bedrooms: int
    property_bathrooms: float
    property_max_guests: int

    # Booking dates
    check_in_date: date
    check_out_date: date
    check_in_time: str = "3:00 PM"
    check_out_time: str = "11:00 AM"
    total_nights: int
    guest_count: int

    # House rules
    house_rules: List[str] = []
    quiet_hours: str = "10:00 PM - 8:00 AM"
    no_parties: bool = True
    no_smoking: bool = True
    pets_allowed: bool = False

    # Emergency contacts
    emergency_contacts: Dict[str, str] = {}

    # Local recommendations
    local_recommendations: Dict[str, List[Dict[str, str]]] = {}

    # Status flags
    can_view_codes: bool = False
    has_signed_waiver: bool = False
    waivers_required: List[str] = []


class AccessCodesResponse(BaseModel):
    """Access codes response - only revealed on check-in day"""
    booking_id: str
    can_view: bool
    reason: Optional[str] = None

    # Access codes (only populated if can_view is True)
    door_code: Optional[str] = None
    gate_code: Optional[str] = None
    garage_code: Optional[str] = None
    lockbox_code: Optional[str] = None
    wifi_network: Optional[str] = None
    wifi_password: Optional[str] = None

    # Access instructions
    access_instructions: Optional[str] = None
    parking_instructions: Optional[str] = None

    # Code expiry
    codes_valid_from: Optional[datetime] = None
    codes_valid_until: Optional[datetime] = None


class GuestIssueRequest(BaseModel):
    """Request to report an issue"""
    booking_id: str
    category: IssueCategory
    priority: IssuePriority = IssuePriority.MEDIUM
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    photos: List[str] = Field(default_factory=list)
    preferred_contact: str = "phone"
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None


class GuestIssueResponse(BaseModel):
    """Response after reporting an issue"""
    issue_id: str
    booking_id: str
    status: str = "submitted"
    category: str
    priority: str
    title: str
    created_at: datetime
    estimated_response: str = "Within 2 hours"
    message: str


class WaiverSignRequest(BaseModel):
    """Request to sign a waiver"""
    booking_id: str
    waiver_type: WaiverType
    guest_name: str
    guest_email: EmailStr
    signature_data: str = Field(..., description="Base64 encoded signature image or text signature")
    agreed_to_terms: bool = True
    ip_address: Optional[str] = None


class WaiverResponse(BaseModel):
    """Waiver response"""
    waiver_id: str
    booking_id: str
    waiver_type: str
    status: str = "signed"
    signed_at: datetime
    guest_name: str


class ConciergeMessage(BaseModel):
    """Message to AI concierge"""
    booking_id: str
    message: str = Field(..., min_length=1, max_length=2000)
    guest_name: Optional[str] = None


class ConciergeResponse(BaseModel):
    """Response from AI concierge"""
    message: str
    from_steven: str
    suggestions: List[str] = []
    timestamp: datetime


class MagicLinkRequest(BaseModel):
    """Request to generate magic link"""
    booking_id: str
    guest_email: EmailStr


class MagicLinkResponse(BaseModel):
    """Magic link response"""
    success: bool
    message: str
    magic_link: Optional[str] = None
    expires_at: Optional[datetime] = None


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def generate_magic_token(booking_id: str) -> str:
    """Generate a secure magic link token for a booking"""
    timestamp = datetime.utcnow().isoformat()
    random_bytes = secrets.token_hex(16)
    data = f"{booking_id}:{timestamp}:{random_bytes}"
    signature = hmac.new(
        MAGIC_LINK_SECRET.encode(),
        data.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"{booking_id}_{signature[:32]}"


def verify_magic_token(token: str, booking_id: str) -> bool:
    """Verify a magic link token"""
    if not token or '_' not in token:
        return False

    parts = token.split('_')
    if len(parts) != 2:
        return False

    token_booking_id, signature = parts
    return token_booking_id == booking_id


def can_view_access_codes(check_in_date: date, check_out_date: date) -> tuple[bool, str]:
    """Check if guest can view access codes based on booking dates"""
    today = date.today()

    if today < check_in_date - timedelta(days=1):
        days_until = (check_in_date - today).days
        return False, f"Access codes will be available starting the day before check-in ({days_until} days)"

    if today > check_out_date:
        return False, "Your stay has ended. Access codes are no longer available."

    return True, "Access codes available"


# ============================================================================
# MOCK DATA (Replace with database queries in production)
# ============================================================================

def get_booking_data(booking_id: str) -> Optional[Dict[str, Any]]:
    """Get booking data from database (mock implementation)"""
    # This would be replaced with actual database queries
    mock_bookings = {
        "BK001": {
            "booking_id": "BK001",
            "confirmation_code": "RAHB-2025-001",
            "status": "confirmed",
            "property_id": "PROP001",
            "property_name": "Midland Oasis - Premium Suite",
            "property_address": "1234 Oil Patch Lane",
            "property_city": "Midland",
            "property_state": "TX",
            "property_zip": "79701",
            "property_photos": [
                "/images/properties/prop001/living.jpg",
                "/images/properties/prop001/bedroom.jpg",
                "/images/properties/prop001/kitchen.jpg"
            ],
            "property_amenities": [
                "Free WiFi",
                "Smart TV",
                "Full Kitchen",
                "Washer/Dryer",
                "Central AC/Heat",
                "Free Parking",
                "Security System"
            ],
            "property_bedrooms": 3,
            "property_bathrooms": 2.5,
            "property_max_guests": 8,
            "check_in_date": date.today() - timedelta(days=1),
            "check_out_date": date.today() + timedelta(days=3),
            "check_in_time": "3:00 PM",
            "check_out_time": "11:00 AM",
            "total_nights": 4,
            "guest_count": 4,
            "house_rules": [
                "No smoking inside the property",
                "No parties or events without prior approval",
                "Quiet hours: 10 PM - 8 AM",
                "Maximum occupancy: 8 guests",
                "No pets unless pre-approved",
                "Please remove shoes at entry",
                "Take out trash before checkout"
            ],
            "quiet_hours": "10:00 PM - 8:00 AM",
            "no_parties": True,
            "no_smoking": True,
            "pets_allowed": False,
            "emergency_contacts": {
                "Property Manager": "(432) 555-0100",
                "After Hours Emergency": "(432) 555-0911",
                "Police Non-Emergency": "(432) 685-7108",
                "Medical Emergency": "911"
            },
            "local_recommendations": {
                "restaurants": [
                    {"name": "The Garlic Press", "type": "American", "distance": "2 miles"},
                    {"name": "Gerardo's Casita", "type": "Mexican", "distance": "1.5 miles"},
                    {"name": "Blue Door", "type": "Fine Dining", "distance": "3 miles"}
                ],
                "grocery": [
                    {"name": "HEB", "distance": "1 mile"},
                    {"name": "Market Street", "distance": "2 miles"}
                ],
                "attractions": [
                    {"name": "Petroleum Museum", "distance": "4 miles"},
                    {"name": "I-20 Wildlife Preserve", "distance": "6 miles"},
                    {"name": "Wagner Noel Performing Arts Center", "distance": "5 miles"}
                ]
            },
            "door_code": "4521",
            "gate_code": "1234#",
            "wifi_network": "RAHB-Guest-001",
            "wifi_password": "Welcome2Midland!",
            "access_instructions": "Enter the 4-digit code on the front door keypad, then turn the handle. The door unlocks automatically at 3 PM on check-in day.",
            "parking_instructions": "Park in the driveway or on the street. Do not block the neighbor's driveway.",
            "waivers_required": ["liability"],
            "has_signed_waiver": False
        }
    }

    return mock_bookings.get(booking_id)


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/{booking_id}", response_model=GuestBookingResponse)
async def get_guest_booking(
    booking_id: str,
    token: str = Query(..., description="Magic link token for authentication")
):
    """
    Get booking details for guest portal.

    Requires valid magic link token for authentication.
    No login required - guests access via magic link sent to their email.
    """
    # Verify magic token
    if not verify_magic_token(token, booking_id):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    # Get booking data
    booking = get_booking_data(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check if codes can be viewed
    can_view, reason = can_view_access_codes(
        booking["check_in_date"],
        booking["check_out_date"]
    )

    return GuestBookingResponse(
        booking_id=booking["booking_id"],
        confirmation_code=booking["confirmation_code"],
        status=booking["status"],
        property_id=booking["property_id"],
        property_name=booking["property_name"],
        property_address=booking["property_address"],
        property_city=booking["property_city"],
        property_state=booking["property_state"],
        property_zip=booking["property_zip"],
        property_photos=booking["property_photos"],
        property_amenities=booking["property_amenities"],
        property_bedrooms=booking["property_bedrooms"],
        property_bathrooms=booking["property_bathrooms"],
        property_max_guests=booking["property_max_guests"],
        check_in_date=booking["check_in_date"],
        check_out_date=booking["check_out_date"],
        check_in_time=booking["check_in_time"],
        check_out_time=booking["check_out_time"],
        total_nights=booking["total_nights"],
        guest_count=booking["guest_count"],
        house_rules=booking["house_rules"],
        quiet_hours=booking["quiet_hours"],
        no_parties=booking["no_parties"],
        no_smoking=booking["no_smoking"],
        pets_allowed=booking["pets_allowed"],
        emergency_contacts=booking["emergency_contacts"],
        local_recommendations=booking["local_recommendations"],
        can_view_codes=can_view,
        has_signed_waiver=booking.get("has_signed_waiver", False),
        waivers_required=booking.get("waivers_required", [])
    )


@router.get("/{booking_id}/codes", response_model=AccessCodesResponse)
async def get_access_codes(
    booking_id: str,
    token: str = Query(..., description="Magic link token for authentication")
):
    """
    Get access codes for the property.

    Codes are only revealed starting the day before check-in until check-out.
    This prevents guests from arriving early or sharing codes.
    """
    # Verify magic token
    if not verify_magic_token(token, booking_id):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    # Get booking data
    booking = get_booking_data(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check if codes can be viewed
    can_view, reason = can_view_access_codes(
        booking["check_in_date"],
        booking["check_out_date"]
    )

    if not can_view:
        return AccessCodesResponse(
            booking_id=booking_id,
            can_view=False,
            reason=reason
        )

    # Return codes with validity period
    check_in_datetime = datetime.combine(
        booking["check_in_date"],
        time(15, 0)  # 3 PM
    )
    check_out_datetime = datetime.combine(
        booking["check_out_date"],
        time(11, 0)  # 11 AM
    )

    return AccessCodesResponse(
        booking_id=booking_id,
        can_view=True,
        door_code=booking.get("door_code"),
        gate_code=booking.get("gate_code"),
        garage_code=booking.get("garage_code"),
        lockbox_code=booking.get("lockbox_code"),
        wifi_network=booking.get("wifi_network"),
        wifi_password=booking.get("wifi_password"),
        access_instructions=booking.get("access_instructions"),
        parking_instructions=booking.get("parking_instructions"),
        codes_valid_from=check_in_datetime,
        codes_valid_until=check_out_datetime
    )


@router.post("/{booking_id}/issue", response_model=GuestIssueResponse)
async def report_issue(
    booking_id: str,
    request: GuestIssueRequest,
    background_tasks: BackgroundTasks,
    token: str = Query(..., description="Magic link token for authentication")
):
    """
    Report an issue during the stay.

    Issues are automatically routed to the appropriate team:
    - URGENT: Immediate notification to Steven
    - HIGH: Notification within 30 minutes
    - MEDIUM/LOW: Added to maintenance queue
    """
    # Verify magic token
    if not verify_magic_token(token, booking_id):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    # Get booking to verify it exists
    booking = get_booking_data(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Generate issue ID
    issue_id = f"ISS-{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4)}"

    # Determine estimated response based on priority
    response_times = {
        IssuePriority.URGENT: "Immediately (within 15 minutes)",
        IssuePriority.HIGH: "Within 1 hour",
        IssuePriority.MEDIUM: "Within 4 hours",
        IssuePriority.LOW: "Within 24 hours"
    }

    # Log the issue (would save to database in production)
    logger.info(f"Issue reported: {issue_id} - {request.category} - {request.priority} - {request.title}")

    # Background task to notify appropriate teams
    async def notify_team():
        if request.priority == IssuePriority.URGENT:
            logger.warning(f"URGENT ISSUE: {issue_id} - Notifying Steven immediately")
            # Would send SMS/call to Steven here
        elif request.priority == IssuePriority.HIGH:
            logger.info(f"HIGH PRIORITY ISSUE: {issue_id} - Adding to urgent queue")

    background_tasks.add_task(notify_team)

    return GuestIssueResponse(
        issue_id=issue_id,
        booking_id=booking_id,
        status="submitted",
        category=request.category.value,
        priority=request.priority.value,
        title=request.title,
        created_at=datetime.utcnow(),
        estimated_response=response_times[request.priority],
        message=f"Your issue has been reported. We'll respond {response_times[request.priority].lower()}. Thank you for letting us know!"
    )


@router.post("/{booking_id}/concierge", response_model=ConciergeResponse)
async def chat_with_concierge(
    booking_id: str,
    message: ConciergeMessage,
    token: str = Query(..., description="Magic link token for authentication")
):
    """
    Chat with Steven AI Concierge.

    Steven knows everything about:
    - Your property and booking
    - Midland, TX local area
    - Restaurants, attractions, services
    - House amenities and instructions
    """
    # Verify magic token
    if not verify_magic_token(token, booking_id):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    # Get booking for context
    booking = get_booking_data(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Import Steven AI service
    try:
        from services.steven_ai import steven_ai

        # Chat with Steven, providing booking context
        result = await steven_ai.chat(
            message=message.message,
            guest_identifier=f"guest_{booking_id}",
            guest_name=message.guest_name,
            property_name=booking["property_name"],
            booking_id=booking_id
        )

        response_text = result.get("response", "I apologize, I'm having trouble responding right now. Please try again or call our support line.")

    except Exception as e:
        logger.error(f"Steven AI error: {e}")
        # Fallback response
        response_text = generate_fallback_response(message.message, booking)

    # Generate contextual suggestions
    suggestions = generate_suggestions(message.message, booking)

    return ConciergeResponse(
        message=response_text,
        from_steven="Steven (AI Concierge)",
        suggestions=suggestions,
        timestamp=datetime.utcnow()
    )


@router.get("/{booking_id}/waiver")
async def get_waivers(
    booking_id: str,
    token: str = Query(..., description="Magic link token for authentication")
):
    """
    Get required waivers for the booking.

    Returns list of waivers that need to be signed before check-in.
    """
    # Verify magic token
    if not verify_magic_token(token, booking_id):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    # Get booking data
    booking = get_booking_data(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    waivers = []

    if "liability" in booking.get("waivers_required", []):
        waivers.append({
            "type": "liability",
            "title": "Liability Waiver",
            "description": "Standard liability waiver for your stay",
            "required": True,
            "signed": booking.get("has_signed_waiver", False),
            "content": get_waiver_content("liability")
        })

    if "pet" in booking.get("waivers_required", []):
        waivers.append({
            "type": "pet",
            "title": "Pet Policy Agreement",
            "description": "Agreement for bringing pets to the property",
            "required": True,
            "signed": False,
            "content": get_waiver_content("pet")
        })

    if "pool" in booking.get("waivers_required", []):
        waivers.append({
            "type": "pool",
            "title": "Pool Safety Waiver",
            "description": "Pool and spa safety acknowledgment",
            "required": True,
            "signed": False,
            "content": get_waiver_content("pool")
        })

    return {
        "booking_id": booking_id,
        "waivers": waivers,
        "all_signed": all(w["signed"] for w in waivers) if waivers else True
    }


@router.post("/{booking_id}/waiver/sign", response_model=WaiverResponse)
async def sign_waiver(
    booking_id: str,
    request: WaiverSignRequest,
    http_request: Request,
    token: str = Query(..., description="Magic link token for authentication")
):
    """
    Sign a waiver for the booking.

    Captures signature, timestamp, and IP address for legal records.
    """
    # Verify magic token
    if not verify_magic_token(token, booking_id):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    # Get booking data
    booking = get_booking_data(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if not request.agreed_to_terms:
        raise HTTPException(status_code=400, detail="You must agree to the terms to sign the waiver")

    # Generate waiver ID
    waiver_id = f"WVR-{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4)}"

    # Get client IP
    client_ip = request.ip_address or http_request.client.host if http_request.client else "unknown"

    # Log waiver signing (would save to database in production)
    logger.info(f"Waiver signed: {waiver_id} - {request.waiver_type} - {request.guest_name} - IP: {client_ip}")

    return WaiverResponse(
        waiver_id=waiver_id,
        booking_id=booking_id,
        waiver_type=request.waiver_type.value,
        status="signed",
        signed_at=datetime.utcnow(),
        guest_name=request.guest_name
    )


@router.post("/generate-magic-link", response_model=MagicLinkResponse)
async def generate_magic_link(
    request: MagicLinkRequest,
    background_tasks: BackgroundTasks
):
    """
    Generate and send magic link to guest email.

    This is called when:
    - A new booking is confirmed
    - Guest requests a new link
    - Admin sends guest portal access
    """
    # Verify booking exists
    booking = get_booking_data(request.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Generate magic token
    token = generate_magic_token(request.booking_id)

    # Create magic link
    base_url = "https://rightathomebnb.com"  # Would use env var in production
    magic_link = f"{base_url}/guest/{request.booking_id}?token={token}"

    # Calculate expiry
    expires_at = datetime.utcnow() + timedelta(days=MAGIC_LINK_EXPIRY_DAYS)

    # Background task to send email
    async def send_magic_link_email():
        logger.info(f"Sending magic link to {request.guest_email} for booking {request.booking_id}")
        # Would send actual email here using SendGrid, Mailgun, etc.

    background_tasks.add_task(send_magic_link_email)

    return MagicLinkResponse(
        success=True,
        message=f"Magic link sent to {request.guest_email}",
        magic_link=magic_link,
        expires_at=expires_at
    )


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_fallback_response(message: str, booking: Dict[str, Any]) -> str:
    """Generate a fallback response when AI is unavailable"""
    message_lower = message.lower()

    if any(word in message_lower for word in ["wifi", "internet", "password"]):
        return f"Your WiFi network is: {booking.get('wifi_network', 'See check-in instructions')}\nPassword: {booking.get('wifi_password', 'See check-in instructions')}"

    if any(word in message_lower for word in ["code", "door", "lock", "access"]):
        return "Your access codes are available in the Check-In tab of this portal. Codes become available the day before your check-in."

    if any(word in message_lower for word in ["checkout", "check out", "leave"]):
        return f"Check-out time is {booking.get('check_out_time', '11:00 AM')}. Please ensure all dishes are clean, trash is taken out, and towels are in the bathroom."

    if any(word in message_lower for word in ["food", "restaurant", "eat", "dinner", "lunch"]):
        restaurants = booking.get("local_recommendations", {}).get("restaurants", [])
        if restaurants:
            recs = "\n".join([f"- {r['name']} ({r['type']}) - {r['distance']}" for r in restaurants[:3]])
            return f"Here are some nearby restaurants:\n{recs}"

    if any(word in message_lower for word in ["emergency", "urgent", "help"]):
        contacts = booking.get("emergency_contacts", {})
        return f"For emergencies:\n- Property Manager: {contacts.get('Property Manager', '(432) 555-0100')}\n- Medical Emergency: 911"

    return "I'm here to help! For immediate assistance, please call our support line at (432) 555-0100. You can also check the House Rules and Local Guide sections for helpful information."


def generate_suggestions(message: str, booking: Dict[str, Any]) -> List[str]:
    """Generate contextual suggestions based on the message"""
    suggestions = []
    message_lower = message.lower()

    if any(word in message_lower for word in ["restaurant", "food", "eat"]):
        suggestions.extend([
            "Show me more restaurants",
            "What's the best Mexican food nearby?",
            "Are there any late-night options?"
        ])
    elif any(word in message_lower for word in ["do", "activity", "attraction"]):
        suggestions.extend([
            "What are the top attractions?",
            "Any outdoor activities?",
            "What's good for kids?"
        ])
    elif any(word in message_lower for word in ["issue", "problem", "broken"]):
        suggestions.extend([
            "How do I report an issue?",
            "Is this an emergency?",
            "When will someone respond?"
        ])
    else:
        suggestions = [
            "What's the WiFi password?",
            "Where can I eat nearby?",
            "What time is checkout?"
        ]

    return suggestions[:3]


def get_waiver_content(waiver_type: str) -> str:
    """Get waiver content by type"""
    waivers = {
        "liability": """
RIGHT AT HOME BNB - LIABILITY WAIVER AND RELEASE

By signing this waiver, I acknowledge and agree to the following:

1. ASSUMPTION OF RISK: I understand that staying at this short-term rental property involves certain risks, including but not limited to slips, trips, falls, and other accidents.

2. RELEASE OF LIABILITY: I, on behalf of myself and my guests, hereby release and hold harmless Right At Home BnB, Steven Palma, and their agents from any and all liability for injuries, damages, or losses that may occur during our stay.

3. PROPERTY CARE: I agree to treat the property with care and respect, and to report any damages or issues immediately.

4. HOUSE RULES: I have read and agree to abide by all house rules provided.

5. INDEMNIFICATION: I agree to indemnify and hold harmless the property owner from any claims arising from my actions or the actions of my guests.

This waiver is valid for the duration of my stay.
        """,
        "pet": """
RIGHT AT HOME BNB - PET POLICY AGREEMENT

By signing this agreement, I acknowledge and agree to the following:

1. PET APPROVAL: My pet(s) have been pre-approved for this stay.

2. SUPERVISION: I will supervise my pet(s) at all times and not leave them unattended in the property.

3. DAMAGES: I accept full responsibility for any damages caused by my pet(s) and agree to pay for repairs or cleaning.

4. NOISE: I will ensure my pet(s) do not create excessive noise that disturbs neighbors.

5. WASTE: I will properly dispose of all pet waste.

6. RESTRICTED AREAS: My pet(s) will not be allowed on beds or furniture unless otherwise specified.

7. CLEANING FEE: I understand an additional pet cleaning fee applies to this booking.
        """,
        "pool": """
RIGHT AT HOME BNB - POOL AND SPA SAFETY WAIVER

By signing this waiver, I acknowledge and agree to the following:

1. SUPERVISION: Children under 14 must be supervised by an adult at all times when using the pool or spa.

2. NO LIFEGUARD: There is no lifeguard on duty. Swimming and spa use is at your own risk.

3. HEALTH RISKS: I understand the health risks associated with pool and spa use, including drowning, slipping, and waterborne illnesses.

4. RULES: I agree to follow all posted pool rules and guidelines.

5. GLASS: No glass containers are allowed in the pool area.

6. HOURS: Pool and spa hours are 8 AM to 10 PM.

7. EMERGENCY: I know the location of emergency equipment and how to call for help.
        """
    }

    return waivers.get(waiver_type, "Waiver content not found.")


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "router",
    "GuestBookingResponse",
    "AccessCodesResponse",
    "GuestIssueRequest",
    "GuestIssueResponse",
    "WaiverSignRequest",
    "WaiverResponse",
    "ConciergeMessage",
    "ConciergeResponse",
    "MagicLinkRequest",
    "MagicLinkResponse"
]
