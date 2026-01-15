"""
Right At Home BnB - Customer Dossier API Routes
================================================
API endpoints for:
- Customer profile management
- Review tracking
- Guest ratings (good/bad guests)
- AI notes from Steven

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from services.customer_dossier import customer_dossier_service, GuestRating

router = APIRouter()


# ============================================================================
# REQUEST MODELS
# ============================================================================

class DossierLookupRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None


class ReviewRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    property_id: Optional[int] = None
    star_rating: int = Field(..., ge=1, le=5)
    review_text: Optional[str] = None
    platform: Optional[str] = None
    booking_id: Optional[str] = None


class GuestRatingRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    rating: Optional[str] = None  # excellent, good, average, poor, bad, banned
    our_rating: Optional[float] = Field(None, ge=1, le=5)
    is_clean: Optional[bool] = None
    is_quiet: Optional[bool] = None
    follows_rules: Optional[bool] = None
    good_communication: Optional[bool] = None
    pays_on_time: Optional[bool] = None
    owner_notes: Optional[str] = None


class StayRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    property_id: int
    check_in: str
    check_out: str
    nights: int
    total_paid: float
    booking_id: Optional[str] = None


class IncidentRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    incident_type: str = Field(..., description="damage, noise, rule_violation, late_payment")
    description: str


class AINodeRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    note: str
    note_type: str = "observation"


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/lookup")
async def get_or_create_dossier(request: DossierLookupRequest):
    """Get or create a customer dossier."""
    return await customer_dossier_service.get_or_create_dossier(**request.dict())


@router.get("/get")
async def get_dossier(email: Optional[str] = None, phone: Optional[str] = None):
    """Get full customer dossier with all reviews and stays."""
    dossier = await customer_dossier_service.get_dossier(email=email, phone=phone)
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier not found")
    return dossier


@router.post("/reviews")
async def add_review(request: ReviewRequest):
    """Add a customer review to their dossier."""
    return await customer_dossier_service.add_review(**request.dict())


@router.post("/stays")
async def add_stay(request: StayRequest):
    """Record a guest stay."""
    return await customer_dossier_service.add_stay(**request.dict())


@router.post("/rate")
async def rate_guest(request: GuestRatingRequest):
    """Rate a guest (Steven's rating of the guest)."""
    rating_enum = None
    if request.rating:
        try:
            rating_enum = GuestRating(request.rating)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid rating: {request.rating}")

    return await customer_dossier_service.rate_guest(
        email=request.email,
        phone=request.phone,
        rating=rating_enum,
        our_rating=request.our_rating,
        is_clean=request.is_clean,
        is_quiet=request.is_quiet,
        follows_rules=request.follows_rules,
        good_communication=request.good_communication,
        pays_on_time=request.pays_on_time,
        owner_notes=request.owner_notes
    )


@router.post("/ai-note")
async def add_ai_note(request: AINodeRequest):
    """Add an AI-generated note to customer dossier."""
    return await customer_dossier_service.add_ai_note(**request.dict())


@router.post("/incident")
async def record_incident(request: IncidentRequest):
    """Record an incident for a guest."""
    return await customer_dossier_service.record_incident(**request.dict())


@router.post("/ban")
async def flag_do_not_rent(email: Optional[str] = None, phone: Optional[str] = None, reason: str = None):
    """Flag a guest as do-not-rent."""
    return await customer_dossier_service.flag_do_not_rent(email=email, phone=phone, reason=reason)


@router.get("/problem-guests")
async def get_problem_guests():
    """Get all guests flagged as poor, bad, or banned."""
    return await customer_dossier_service.get_problem_guests()


@router.get("/vip-guests")
async def get_vip_guests():
    """Get all excellent (VIP) guests."""
    return await customer_dossier_service.get_vip_guests()
