"""
Digital Liability Waiver Routes - Right at Home BnB
FastAPI routes for waiver generation, signing, and management.

Part of the ECHO OMEGA PRIME system build.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import hashlib
import logging

from database.connection import get_db
from database.models import Property, Guest, Booking
from database.models_waiver import (
    GuestWaiver, PropertyWaiverTemplate, WaiverType, WaiverStatus,
    DEFAULT_WAIVER_TEMPLATES
)

logger = logging.getLogger("RightAtHomeBnB.Waivers")

router = APIRouter()


# ============================================
# PYDANTIC SCHEMAS
# ============================================

class WaiverRisk(BaseModel):
    """Individual risk item in a waiver."""
    id: int
    description: str
    acknowledged: bool = False


class WaiverResponse(BaseModel):
    """Response model for waiver data."""
    id: int
    booking_id: str
    guest_id: str
    property_id: str
    waiver_type: str
    waiver_version: str
    title: str
    content: str
    risks: List[WaiverRisk]
    status: str
    signed_at: Optional[datetime] = None
    created_at: datetime
    expires_at: Optional[datetime] = None

    # Property info for display
    property_name: str
    property_address: str

    # Guest info
    guest_name: str
    guest_email: str

    # Booking info
    check_in: datetime
    check_out: datetime

    class Config:
        from_attributes = True


class WaiverSignRequest(BaseModel):
    """Request model for signing a waiver."""
    acknowledged_risks: List[int] = Field(..., description="List of acknowledged risk IDs")
    signature_data: str = Field(..., description="Base64 encoded signature image")
    guest_initials: str = Field(..., min_length=2, max_length=10)
    emergency_contact_name: str = Field(..., min_length=2, max_length=200)
    emergency_contact_phone: str = Field(..., min_length=10, max_length=20)
    emergency_contact_relationship: str = Field(default="", max_length=100)
    minor_guests_acknowledged: bool = False
    number_of_minors: int = Field(default=0, ge=0, le=20)


class WaiverSignResponse(BaseModel):
    """Response model after signing a waiver."""
    success: bool
    message: str
    waiver_id: int
    signed_at: datetime
    confirmation_code: str


class WaiverTemplateCreate(BaseModel):
    """Request model for creating a waiver template."""
    property_id: Optional[str] = None  # None for global template
    waiver_type: WaiverType
    title: str = Field(..., min_length=5, max_length=200)
    content: str = Field(..., min_length=100)
    risks: List[str] = Field(..., min_items=1)
    trigger_amenities: List[str] = []
    is_required: bool = True
    is_global: bool = False


class WaiverTemplateResponse(BaseModel):
    """Response model for waiver template."""
    id: int
    property_id: Optional[str]
    waiver_type: str
    title: str
    risks: List[str]
    trigger_amenities: List[str]
    is_required: bool
    is_active: bool
    is_global: bool
    version: str
    created_at: datetime

    class Config:
        from_attributes = True


class BookingWaiversStatus(BaseModel):
    """Status of all waivers for a booking."""
    booking_id: str
    total_waivers: int
    signed_waivers: int
    pending_waivers: int
    all_signed: bool
    waivers: List[dict]


# ============================================
# HELPER FUNCTIONS
# ============================================

def get_property_amenities(property_obj: Property) -> List[str]:
    """Extract amenity list from property."""
    if property_obj.amenities:
        if isinstance(property_obj.amenities, list):
            return property_obj.amenities
        elif isinstance(property_obj.amenities, dict):
            return list(property_obj.amenities.keys())
    return []


def determine_required_waivers(amenities: List[str]) -> List[WaiverType]:
    """Determine which waivers are required based on amenities."""
    required = [WaiverType.GENERAL]  # Always required

    amenity_lower = [a.lower() for a in amenities]

    # Check for pool
    pool_keywords = ["pool", "swimming pool", "swimming"]
    if any(kw in ' '.join(amenity_lower) for kw in pool_keywords):
        required.append(WaiverType.POOL)

    # Check for hot tub
    hot_tub_keywords = ["hot tub", "hottub", "spa", "jacuzzi"]
    if any(kw in ' '.join(amenity_lower) for kw in hot_tub_keywords):
        required.append(WaiverType.HOT_TUB)

    # Check for fire pit
    fire_keywords = ["fire pit", "firepit", "fire", "outdoor fireplace"]
    if any(kw in ' '.join(amenity_lower) for kw in fire_keywords):
        required.append(WaiverType.FIRE_PIT)

    # Check for grill
    grill_keywords = ["grill", "bbq", "barbecue", "outdoor grill"]
    if any(kw in ' '.join(amenity_lower) for kw in grill_keywords):
        required.append(WaiverType.OUTDOOR_GRILL)

    # Check for pets
    pet_keywords = ["pet friendly", "pets allowed", "dog friendly", "pet"]
    if any(kw in ' '.join(amenity_lower) for kw in pet_keywords):
        required.append(WaiverType.PET)

    return required


def generate_waiver_content(template: dict, property_obj: Property,
                           guest: Guest, booking: Booking) -> str:
    """Generate waiver content with filled placeholders."""
    content = template["content"]

    # Replace placeholders
    replacements = {
        "{property_name}": property_obj.name,
        "{property_address}": f"{property_obj.address}, {property_obj.city}, {property_obj.state} {property_obj.zip_code}",
        "{guest_name}": guest.name,
        "{check_in}": booking.check_in.strftime("%B %d, %Y"),
        "{check_out}": booking.check_out.strftime("%B %d, %Y"),
        "{nearest_hospital}": "Midland Memorial Hospital, 400 Rosalind Redfern Grover Pkwy",
    }

    for key, value in replacements.items():
        content = content.replace(key, str(value))

    return content


def get_or_create_template(db: Session, waiver_type: WaiverType,
                          property_id: Optional[str] = None) -> dict:
    """Get template from DB or return default."""
    # Try to find property-specific template
    if property_id:
        template = db.query(PropertyWaiverTemplate).filter(
            and_(
                PropertyWaiverTemplate.property_id == property_id,
                PropertyWaiverTemplate.waiver_type == waiver_type,
                PropertyWaiverTemplate.is_active == True
            )
        ).first()
        if template:
            return {
                "waiver_type": template.waiver_type,
                "title": template.title,
                "content": template.content,
                "risks": template.risks,
                "trigger_amenities": template.trigger_amenities or []
            }

    # Try global template
    template = db.query(PropertyWaiverTemplate).filter(
        and_(
            PropertyWaiverTemplate.is_global == True,
            PropertyWaiverTemplate.waiver_type == waiver_type,
            PropertyWaiverTemplate.is_active == True
        )
    ).first()
    if template:
        return {
            "waiver_type": template.waiver_type,
            "title": template.title,
            "content": template.content,
            "risks": template.risks,
            "trigger_amenities": template.trigger_amenities or []
        }

    # Return default template
    for default in DEFAULT_WAIVER_TEMPLATES:
        if default["waiver_type"] == waiver_type:
            return default

    # Fallback to general
    return DEFAULT_WAIVER_TEMPLATES[-1]


def generate_confirmation_code(waiver_id: int, signed_at: datetime) -> str:
    """Generate a unique confirmation code for signed waiver."""
    data = f"{waiver_id}-{signed_at.isoformat()}"
    return hashlib.sha256(data.encode()).hexdigest()[:12].upper()


# ============================================
# ROUTES
# ============================================

@router.get("/waiver/{booking_id}", response_model=List[WaiverResponse])
async def get_waivers_for_booking(
    booking_id: str,
    db: Session = Depends(get_db)
):
    """
    Generate or retrieve waivers for a booking.
    Auto-creates waivers based on property amenities if they don't exist.
    """
    # Get booking with property and guest
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    property_obj = db.query(Property).filter(Property.id == booking.property_id).first()
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    guest = db.query(Guest).filter(Guest.id == booking.guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    # Check for existing waivers
    existing_waivers = db.query(GuestWaiver).filter(
        GuestWaiver.booking_id == booking_id
    ).all()

    # If waivers exist, return them
    if existing_waivers:
        result = []
        for waiver in existing_waivers:
            template = get_or_create_template(db, waiver.waiver_type, property_obj.id)
            risks = [
                WaiverRisk(
                    id=i,
                    description=risk,
                    acknowledged=(waiver.acknowledged_risks and i in waiver.acknowledged_risks)
                )
                for i, risk in enumerate(template["risks"])
            ]

            result.append(WaiverResponse(
                id=waiver.id,
                booking_id=waiver.booking_id,
                guest_id=waiver.guest_id,
                property_id=waiver.property_id,
                waiver_type=waiver.waiver_type.value,
                waiver_version=waiver.waiver_version,
                title=template["title"],
                content=waiver.waiver_content,
                risks=risks,
                status=waiver.status.value,
                signed_at=waiver.signed_at,
                created_at=waiver.created_at,
                expires_at=waiver.expires_at,
                property_name=property_obj.name,
                property_address=f"{property_obj.address}, {property_obj.city}, {property_obj.state}",
                guest_name=guest.name,
                guest_email=guest.email,
                check_in=booking.check_in,
                check_out=booking.check_out
            ))
        return result

    # Generate new waivers based on amenities
    amenities = get_property_amenities(property_obj)
    required_types = determine_required_waivers(amenities)

    result = []
    for waiver_type in required_types:
        template = get_or_create_template(db, waiver_type, property_obj.id)
        content = generate_waiver_content(template, property_obj, guest, booking)

        # Create waiver record
        waiver = GuestWaiver(
            booking_id=booking_id,
            guest_id=guest.id,
            property_id=property_obj.id,
            waiver_type=waiver_type,
            waiver_version="1.0",
            waiver_content=content,
            status=WaiverStatus.PENDING,
            expires_at=booking.check_out + timedelta(days=1)
        )
        db.add(waiver)
        db.flush()  # Get the ID

        risks = [
            WaiverRisk(id=i, description=risk, acknowledged=False)
            for i, risk in enumerate(template["risks"])
        ]

        result.append(WaiverResponse(
            id=waiver.id,
            booking_id=waiver.booking_id,
            guest_id=waiver.guest_id,
            property_id=waiver.property_id,
            waiver_type=waiver_type.value,
            waiver_version=waiver.waiver_version,
            title=template["title"],
            content=content,
            risks=risks,
            status=WaiverStatus.PENDING.value,
            signed_at=None,
            created_at=waiver.created_at,
            expires_at=waiver.expires_at,
            property_name=property_obj.name,
            property_address=f"{property_obj.address}, {property_obj.city}, {property_obj.state}",
            guest_name=guest.name,
            guest_email=guest.email,
            check_in=booking.check_in,
            check_out=booking.check_out
        ))

    db.commit()
    logger.info(f"Generated {len(result)} waivers for booking {booking_id}")

    return result


@router.post("/waiver/{booking_id}/sign", response_model=WaiverSignResponse)
async def sign_waiver(
    booking_id: str,
    waiver_id: int,
    sign_request: WaiverSignRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Sign a waiver with signature and risk acknowledgments.
    """
    # Get the waiver
    waiver = db.query(GuestWaiver).filter(
        and_(
            GuestWaiver.id == waiver_id,
            GuestWaiver.booking_id == booking_id
        )
    ).first()

    if not waiver:
        raise HTTPException(status_code=404, detail="Waiver not found")

    if waiver.status == WaiverStatus.SIGNED:
        raise HTTPException(status_code=400, detail="Waiver already signed")

    if waiver.status == WaiverStatus.EXPIRED:
        raise HTTPException(status_code=400, detail="Waiver has expired")

    # Get template to validate risks
    template = get_or_create_template(db, waiver.waiver_type, waiver.property_id)
    total_risks = len(template["risks"])

    # Validate all risks are acknowledged
    if len(sign_request.acknowledged_risks) < total_risks:
        raise HTTPException(
            status_code=400,
            detail=f"All {total_risks} risks must be acknowledged"
        )

    # Generate signature hash
    signature_hash = hashlib.sha256(sign_request.signature_data.encode()).hexdigest()

    # Get client info
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent", "")

    # Update waiver
    waiver.status = WaiverStatus.SIGNED
    waiver.signed_at = datetime.utcnow()
    waiver.signature_hash = signature_hash
    waiver.signature_data = sign_request.signature_data
    waiver.ip_address = client_ip
    waiver.user_agent = user_agent[:500] if user_agent else None
    waiver.acknowledged_risks = sign_request.acknowledged_risks
    waiver.guest_initials = sign_request.guest_initials
    waiver.emergency_contact_name = sign_request.emergency_contact_name
    waiver.emergency_contact_phone = sign_request.emergency_contact_phone
    waiver.emergency_contact_relationship = sign_request.emergency_contact_relationship
    waiver.minor_guests_acknowledged = sign_request.minor_guests_acknowledged
    waiver.number_of_minors = sign_request.number_of_minors

    db.commit()

    confirmation_code = generate_confirmation_code(waiver.id, waiver.signed_at)

    logger.info(f"Waiver {waiver_id} signed for booking {booking_id}")

    return WaiverSignResponse(
        success=True,
        message="Waiver signed successfully",
        waiver_id=waiver.id,
        signed_at=waiver.signed_at,
        confirmation_code=confirmation_code
    )


@router.get("/waivers/status/{booking_id}", response_model=BookingWaiversStatus)
async def get_waiver_status(
    booking_id: str,
    db: Session = Depends(get_db)
):
    """
    Get the status of all waivers for a booking.
    Useful for checking if guest has completed all required waivers.
    """
    waivers = db.query(GuestWaiver).filter(
        GuestWaiver.booking_id == booking_id
    ).all()

    if not waivers:
        # Generate waivers first if they don't exist
        await get_waivers_for_booking(booking_id, db)
        waivers = db.query(GuestWaiver).filter(
            GuestWaiver.booking_id == booking_id
        ).all()

    signed = [w for w in waivers if w.status == WaiverStatus.SIGNED]
    pending = [w for w in waivers if w.status == WaiverStatus.PENDING]

    waiver_list = [
        {
            "id": w.id,
            "type": w.waiver_type.value,
            "status": w.status.value,
            "signed_at": w.signed_at.isoformat() if w.signed_at else None
        }
        for w in waivers
    ]

    return BookingWaiversStatus(
        booking_id=booking_id,
        total_waivers=len(waivers),
        signed_waivers=len(signed),
        pending_waivers=len(pending),
        all_signed=len(pending) == 0 and len(waivers) > 0,
        waivers=waiver_list
    )


@router.get("/waivers/templates", response_model=List[WaiverTemplateResponse])
async def list_waiver_templates(
    property_id: Optional[str] = Query(None, description="Filter by property ID"),
    waiver_type: Optional[WaiverType] = Query(None, description="Filter by waiver type"),
    include_global: bool = Query(True, description="Include global templates"),
    db: Session = Depends(get_db)
):
    """
    List waiver templates with optional filtering.
    """
    query = db.query(PropertyWaiverTemplate).filter(
        PropertyWaiverTemplate.is_active == True
    )

    if property_id:
        if include_global:
            query = query.filter(
                or_(
                    PropertyWaiverTemplate.property_id == property_id,
                    PropertyWaiverTemplate.is_global == True
                )
            )
        else:
            query = query.filter(PropertyWaiverTemplate.property_id == property_id)
    elif include_global:
        query = query.filter(PropertyWaiverTemplate.is_global == True)

    if waiver_type:
        query = query.filter(PropertyWaiverTemplate.waiver_type == waiver_type)

    templates = query.all()

    return [
        WaiverTemplateResponse(
            id=t.id,
            property_id=t.property_id,
            waiver_type=t.waiver_type.value,
            title=t.title,
            risks=t.risks or [],
            trigger_amenities=t.trigger_amenities or [],
            is_required=t.is_required,
            is_active=t.is_active,
            is_global=t.is_global,
            version=t.version,
            created_at=t.created_at
        )
        for t in templates
    ]


@router.post("/waivers/templates", response_model=WaiverTemplateResponse)
async def create_waiver_template(
    template: WaiverTemplateCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new waiver template.
    Set is_global=true for system-wide templates.
    """
    # Check for existing template
    existing = db.query(PropertyWaiverTemplate).filter(
        and_(
            PropertyWaiverTemplate.property_id == template.property_id,
            PropertyWaiverTemplate.waiver_type == template.waiver_type,
            PropertyWaiverTemplate.is_active == True
        )
    ).first()

    if existing:
        # Deactivate existing template
        existing.is_active = False
        existing.version = f"{float(existing.version) + 0.1:.1f}"

    # Create new template
    new_template = PropertyWaiverTemplate(
        property_id=template.property_id,
        waiver_type=template.waiver_type,
        title=template.title,
        content=template.content,
        risks=template.risks,
        trigger_amenities=template.trigger_amenities,
        is_required=template.is_required,
        is_global=template.is_global,
        version="1.0" if not existing else f"{float(existing.version) + 1:.1f}"
    )

    db.add(new_template)
    db.commit()
    db.refresh(new_template)

    logger.info(f"Created waiver template: {new_template.title} (ID: {new_template.id})")

    return WaiverTemplateResponse(
        id=new_template.id,
        property_id=new_template.property_id,
        waiver_type=new_template.waiver_type.value,
        title=new_template.title,
        risks=new_template.risks,
        trigger_amenities=new_template.trigger_amenities or [],
        is_required=new_template.is_required,
        is_active=new_template.is_active,
        is_global=new_template.is_global,
        version=new_template.version,
        created_at=new_template.created_at
    )


@router.post("/waivers/templates/seed")
async def seed_default_templates(
    db: Session = Depends(get_db)
):
    """
    Seed the database with default waiver templates.
    Creates global templates for all waiver types.
    """
    created = []

    for template_data in DEFAULT_WAIVER_TEMPLATES:
        # Check if exists
        existing = db.query(PropertyWaiverTemplate).filter(
            and_(
                PropertyWaiverTemplate.is_global == True,
                PropertyWaiverTemplate.waiver_type == template_data["waiver_type"],
                PropertyWaiverTemplate.is_active == True
            )
        ).first()

        if not existing:
            template = PropertyWaiverTemplate(
                property_id=None,
                waiver_type=template_data["waiver_type"],
                title=template_data["title"],
                content=template_data["content"],
                risks=template_data["risks"],
                trigger_amenities=template_data["trigger_amenities"],
                is_required=True,
                is_global=True,
                version="1.0"
            )
            db.add(template)
            created.append(template_data["waiver_type"].value)

    db.commit()

    logger.info(f"Seeded {len(created)} default waiver templates")

    return {
        "success": True,
        "message": f"Created {len(created)} templates",
        "created": created
    }


@router.get("/waiver/{booking_id}/{waiver_id}/pdf")
async def get_waiver_pdf(
    booking_id: str,
    waiver_id: int,
    db: Session = Depends(get_db)
):
    """
    Generate PDF of signed waiver for records.
    Returns PDF download URL or generates on-demand.
    """
    waiver = db.query(GuestWaiver).filter(
        and_(
            GuestWaiver.id == waiver_id,
            GuestWaiver.booking_id == booking_id,
            GuestWaiver.status == WaiverStatus.SIGNED
        )
    ).first()

    if not waiver:
        raise HTTPException(status_code=404, detail="Signed waiver not found")

    # For now, return waiver data that can be used to generate PDF client-side
    # In production, this would generate a proper PDF
    return {
        "waiver_id": waiver.id,
        "booking_id": waiver.booking_id,
        "waiver_type": waiver.waiver_type.value,
        "content": waiver.waiver_content,
        "signed_at": waiver.signed_at.isoformat() if waiver.signed_at else None,
        "signature_hash": waiver.signature_hash,
        "guest_initials": waiver.guest_initials,
        "emergency_contact": {
            "name": waiver.emergency_contact_name,
            "phone": waiver.emergency_contact_phone,
            "relationship": waiver.emergency_contact_relationship
        },
        "ip_address": waiver.ip_address,
        "confirmation_code": generate_confirmation_code(waiver.id, waiver.signed_at)
    }
