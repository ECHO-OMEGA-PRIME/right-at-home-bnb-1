"""
Right At Home BnB - Guest Intelligence API Routes
=================================================
REST API endpoints for the Guest Intelligence system.

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from loguru import logger

from services.guest_intelligence import (
    guest_intel,
    GuestProfile,
    StayRecord,
    ReviewRecord,
    ComplaintRecord,
    DamageRecord,
    get_guest_context,
    check_guest_risk,
)

router = APIRouter(prefix="/api/guest-intel", tags=["Guest Intelligence"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class GuestIdentifier(BaseModel):
    """Identify guest by any means"""
    identifier: str = Field(..., description="Phone, email, or guest ID")
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class StayInput(BaseModel):
    """Input for recording a stay"""
    identifier: str
    property_id: str
    property_name: str
    property_address: str
    check_in: str
    check_out: str
    total_paid: float
    guests_count: int = 1
    booking_platform: str = "direct"
    booking_id: str = ""
    cleaning_fee: float = 0.0
    pet_fee: float = 0.0
    damage_deposit: float = 0.0
    special_requests: List[str] = []
    notes: str = ""


class ReviewInput(BaseModel):
    """Input for recording a review"""
    identifier: str
    stay_id: str
    property_id: str
    property_name: str
    platform: str
    rating: int = Field(..., ge=1, le=5)
    review_text: str
    review_date: str
    public_response: Optional[str] = None


class ComplaintInput(BaseModel):
    """Input for recording a complaint"""
    identifier: str
    property_id: str
    property_name: str
    category: str
    severity: str = Field(..., pattern="^(low|medium|high|critical)$")
    description: str
    stay_id: Optional[str] = None
    notes: str = ""


class ComplaintResolution(BaseModel):
    """Input for resolving a complaint"""
    complaint_id: str
    resolution: str
    resolved_by: str
    compensation_given: float = 0.0
    compensation_type: Optional[str] = None
    guest_satisfied: bool = True


class DamageInput(BaseModel):
    """Input for recording damage"""
    identifier: str
    stay_id: str
    property_id: str
    property_name: str
    damage_type: str
    description: str
    repair_cost: float = 0.0
    charged_to_guest: float = 0.0
    photos: List[str] = []
    notes: str = ""


class ConversationInput(BaseModel):
    """Input for storing conversation"""
    identifier: str
    message: str
    response: str
    property_context: Optional[str] = None
    emotion: Optional[str] = None
    topic: Optional[str] = None


class GuestSearchParams(BaseModel):
    """Search parameters"""
    query: str = ""
    vip_tier: Optional[str] = None
    has_complaints: Optional[bool] = None
    has_damages: Optional[bool] = None
    min_stays: int = 0
    limit: int = 50


class BanInput(BaseModel):
    """Input for banning a guest"""
    identifier: str
    reason: str
    banned_by: str = "system"


# ============================================================================
# ENDPOINTS - PROFILE MANAGEMENT
# ============================================================================

@router.post("/profile")
async def get_or_create_profile(data: GuestIdentifier):
    """Get or create a guest profile"""
    try:
        profile = await guest_intel.get_or_create_profile(
            identifier=data.identifier,
            name=data.name,
            email=data.email,
            phone=data.phone
        )
        return {"success": True, "profile": profile.__dict__}
    except Exception as e:
        logger.error(f"Profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile/{guest_id}")
async def get_profile(guest_id: str):
    """Get a guest profile by ID"""
    profile = await guest_intel.get_profile(guest_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Guest not found")
    return {"success": True, "profile": profile.__dict__}


@router.post("/search")
async def search_guests(params: GuestSearchParams):
    """Search guests with filters"""
    try:
        results = await guest_intel.search_guests(
            query=params.query,
            vip_tier=params.vip_tier,
            has_complaints=params.has_complaints,
            has_damages=params.has_damages,
            min_stays=params.min_stays,
            limit=params.limit
        )
        return {
            "success": True,
            "count": len(results),
            "guests": [g.__dict__ for g in results]
        }
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINTS - CONTEXT & INTELLIGENCE
# ============================================================================

@router.get("/context/{identifier}")
async def get_full_context(identifier: str):
    """Get full guest intelligence context for AI"""
    try:
        context = await get_guest_context(identifier)
        guest_id = guest_intel._get_guest_id(identifier)
        quick = await guest_intel.get_quick_context(guest_id)
        risk = await check_guest_risk(identifier)
        
        return {
            "success": True,
            "guest_id": guest_id,
            "full_context": context,
            "quick_context": quick,
            "risk_assessment": risk
        }
    except Exception as e:
        logger.error(f"Context error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/risk/{identifier}")
async def check_risk(identifier: str):
    """Check guest risk level"""
    try:
        risk = await check_guest_risk(identifier)
        return {"success": True, **risk}
    except Exception as e:
        logger.error(f"Risk check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINTS - STAY TRACKING
# ============================================================================

@router.post("/stay")
async def record_stay(data: StayInput):
    """Record a guest stay"""
    try:
        guest_id = guest_intel._get_guest_id(data.identifier)
        
        # Ensure profile exists
        await guest_intel.get_or_create_profile(data.identifier)
        
        stay = await guest_intel.record_stay(
            guest_id=guest_id,
            property_id=data.property_id,
            property_name=data.property_name,
            property_address=data.property_address,
            check_in=data.check_in,
            check_out=data.check_out,
            total_paid=data.total_paid,
            guests_count=data.guests_count,
            booking_platform=data.booking_platform,
            booking_id=data.booking_id,
            cleaning_fee=data.cleaning_fee,
            pet_fee=data.pet_fee,
            damage_deposit=data.damage_deposit,
            special_requests=data.special_requests,
            notes=data.notes
        )
        
        return {"success": True, "stay": stay.__dict__}
    except Exception as e:
        logger.error(f"Stay recording error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stays/{identifier}")
async def get_stays(identifier: str):
    """Get all stays for a guest"""
    try:
        guest_id = guest_intel._get_guest_id(identifier)
        stays = await guest_intel.get_stay_history(guest_id)
        return {
            "success": True,
            "count": len(stays),
            "stays": [s.__dict__ for s in stays]
        }
    except Exception as e:
        logger.error(f"Stay retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/property-stays/{property_id}")
async def get_property_stays(property_id: str, limit: int = 100):
    """Get all stays at a property"""
    try:
        stays = await guest_intel.get_stays_at_property(property_id, limit)
        return {
            "success": True,
            "count": len(stays),
            "stays": stays
        }
    except Exception as e:
        logger.error(f"Property stays error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINTS - REVIEW TRACKING
# ============================================================================

@router.post("/review")
async def record_review(data: ReviewInput):
    """Record a guest review"""
    try:
        guest_id = guest_intel._get_guest_id(data.identifier)
        
        review = await guest_intel.record_review(
            guest_id=guest_id,
            stay_id=data.stay_id,
            property_id=data.property_id,
            property_name=data.property_name,
            platform=data.platform,
            rating=data.rating,
            review_text=data.review_text,
            review_date=data.review_date,
            public_response=data.public_response
        )
        
        return {"success": True, "review": review.__dict__}
    except Exception as e:
        logger.error(f"Review recording error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reviews/{identifier}")
async def get_reviews(identifier: str):
    """Get all reviews from a guest"""
    try:
        guest_id = guest_intel._get_guest_id(identifier)
        reviews = await guest_intel.get_reviews_by_guest(guest_id)
        return {
            "success": True,
            "count": len(reviews),
            "reviews": [r.__dict__ for r in reviews]
        }
    except Exception as e:
        logger.error(f"Review retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/property-reviews/{property_id}")
async def get_property_reviews(property_id: str, limit: int = 100):
    """Get all reviews for a property"""
    try:
        reviews = await guest_intel.get_reviews_for_property(property_id, limit)
        return {
            "success": True,
            "count": len(reviews),
            "reviews": [r.__dict__ for r in reviews]
        }
    except Exception as e:
        logger.error(f"Property reviews error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINTS - COMPLAINT TRACKING
# ============================================================================

@router.post("/complaint")
async def record_complaint(data: ComplaintInput):
    """Record a guest complaint"""
    try:
        guest_id = guest_intel._get_guest_id(data.identifier)
        
        complaint = await guest_intel.record_complaint(
            guest_id=guest_id,
            property_id=data.property_id,
            property_name=data.property_name,
            category=data.category,
            severity=data.severity,
            description=data.description,
            stay_id=data.stay_id,
            notes=data.notes
        )
        
        return {"success": True, "complaint": complaint.__dict__}
    except Exception as e:
        logger.error(f"Complaint recording error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complaint/resolve")
async def resolve_complaint(data: ComplaintResolution):
    """Resolve a complaint"""
    try:
        success = await guest_intel.resolve_complaint(
            complaint_id=data.complaint_id,
            resolution=data.resolution,
            resolved_by=data.resolved_by,
            compensation_given=data.compensation_given,
            compensation_type=data.compensation_type,
            guest_satisfied=data.guest_satisfied
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Complaint not found")
        
        return {"success": True, "message": "Complaint resolved"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Complaint resolution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/complaints/{identifier}")
async def get_complaints(identifier: str):
    """Get all complaints from a guest"""
    try:
        guest_id = guest_intel._get_guest_id(identifier)
        complaints = await guest_intel.get_complaints_by_guest(guest_id)
        return {
            "success": True,
            "count": len(complaints),
            "complaints": [c.__dict__ for c in complaints]
        }
    except Exception as e:
        logger.error(f"Complaint retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINTS - DAMAGE TRACKING
# ============================================================================

@router.post("/damage")
async def record_damage(data: DamageInput):
    """Record property damage"""
    try:
        guest_id = guest_intel._get_guest_id(data.identifier)
        
        damage = await guest_intel.record_damage(
            guest_id=guest_id,
            stay_id=data.stay_id,
            property_id=data.property_id,
            property_name=data.property_name,
            damage_type=data.damage_type,
            description=data.description,
            repair_cost=data.repair_cost,
            charged_to_guest=data.charged_to_guest,
            photos=data.photos,
            notes=data.notes
        )
        
        return {"success": True, "damage": damage.__dict__}
    except Exception as e:
        logger.error(f"Damage recording error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/damage/{damage_id}/paid")
async def mark_damage_paid(damage_id: str):
    """Mark damage as paid"""
    try:
        success = await guest_intel.mark_damage_paid(damage_id)
        if not success:
            raise HTTPException(status_code=404, detail="Damage record not found")
        return {"success": True, "message": "Damage marked as paid"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Damage paid error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/damage/{damage_id}/repaired")
async def mark_damage_repaired(damage_id: str):
    """Mark damage as repaired"""
    try:
        success = await guest_intel.mark_damage_repaired(damage_id)
        if not success:
            raise HTTPException(status_code=404, detail="Damage record not found")
        return {"success": True, "message": "Damage marked as repaired"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Damage repaired error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/damages/{identifier}")
async def get_damages(identifier: str):
    """Get all damages from a guest"""
    try:
        guest_id = guest_intel._get_guest_id(identifier)
        damages = await guest_intel.get_damages_by_guest(guest_id)
        return {
            "success": True,
            "count": len(damages),
            "damages": [d.__dict__ for d in damages]
        }
    except Exception as e:
        logger.error(f"Damage retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINTS - CONVERSATION TRACKING
# ============================================================================

@router.post("/conversation")
async def store_conversation(data: ConversationInput):
    """Store a conversation exchange"""
    try:
        guest_id = guest_intel._get_guest_id(data.identifier)
        
        # Ensure profile exists
        await guest_intel.get_or_create_profile(data.identifier)
        
        success = await guest_intel.store_conversation(
            guest_id=guest_id,
            message=data.message,
            response=data.response,
            property_context=data.property_context,
            emotion=data.emotion,
            topic=data.topic
        )
        
        return {"success": success}
    except Exception as e:
        logger.error(f"Conversation storage error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{identifier}")
async def get_conversations(identifier: str, limit: int = 50):
    """Get conversation history for a guest"""
    try:
        guest_id = guest_intel._get_guest_id(identifier)
        history = await guest_intel.get_conversation_history(guest_id, limit)
        return {
            "success": True,
            "count": len(history),
            "conversations": history
        }
    except Exception as e:
        logger.error(f"Conversation retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINTS - BAN/UNBAN
# ============================================================================

@router.post("/ban")
async def ban_guest(data: BanInput):
    """Ban a guest"""
    try:
        guest_id = guest_intel._get_guest_id(data.identifier)
        success = await guest_intel.ban_guest(guest_id, data.reason, data.banned_by)
        
        if not success:
            raise HTTPException(status_code=404, detail="Guest not found")
        
        return {"success": True, "message": f"Guest {data.identifier} banned"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ban error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Guest Intelligence",
        "firebase_available": guest_intel.firebase_available,
        "timestamp": datetime.utcnow().isoformat()
    }
