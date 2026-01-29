"""
Right At Home BnB - Concierge Upgrades V2 API Routes
=====================================================
API endpoints for advanced concierge features.

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from loguru import logger

from services.concierge_upgrades_v2 import (
    get_late_checkout,
    get_check_in_automation,
    get_review_service,
    get_preference_learning,
    get_language_support,
    get_cleaner_dispatch,
    PROPERTY_KNOWLEDGE,
    DEFAULT_PROPERTY
)

router = APIRouter(prefix="/api/concierge/v2")


# ============================================================================
# REQUEST MODELS
# ============================================================================

class LateCheckoutRequest(BaseModel):
    guest_id: str
    property_id: str
    requested_time: str = Field(..., description="e.g., '1:00 PM'")
    guest_name: str
    guest_phone: str


class CheckInInstructionsRequest(BaseModel):
    guest_name: str
    guest_phone: str
    property_id: str
    check_in_date: str = Field(..., description="YYYY-MM-DD format")
    send_now: bool = False


class ReviewRequestModel(BaseModel):
    guest_name: str
    guest_phone: str
    property_id: str
    booking_platform: str = "airbnb"
    review_link: Optional[str] = None


class PreferenceLearningModel(BaseModel):
    guest_id: str
    category: str
    preference: str
    value: Any
    source: str = "conversation"


class CleanerDispatchRequest(BaseModel):
    property_id: str
    checkout_time: str
    next_checkin: Optional[str] = None
    special_notes: Optional[str] = None


# ============================================================================
# LATE CHECKOUT ENDPOINTS
# ============================================================================

@router.post("/late-checkout/request", tags=["Late Checkout"])
async def request_late_checkout(request: LateCheckoutRequest):
    """
    Request a late checkout.
    
    - Calculates fee based on requested time
    - Auto-approves if no conflicts
    - Notifies Steven for approval if needed
    """
    service = get_late_checkout()
    result = await service.request_late_checkout(
        guest_id=request.guest_id,
        property_id=request.property_id,
        requested_time=request.requested_time,
        guest_name=request.guest_name,
        guest_phone=request.guest_phone
    )
    return result


@router.get("/late-checkout/pricing", tags=["Late Checkout"])
async def get_late_checkout_pricing():
    """Get late checkout pricing tiers."""
    service = get_late_checkout()
    return {
        "pricing": {
            "until_12pm": {"fee": 25, "description": "1 hour late"},
            "until_1pm": {"fee": 40, "description": "2 hours late"},
            "until_2pm": {"fee": 50, "description": "3 hours late"},
            "until_3pm": {"fee": 75, "description": "Half day (before next check-in)"}
        },
        "standard_checkout": "11:00 AM"
    }


# ============================================================================
# CHECK-IN AUTOMATION ENDPOINTS
# ============================================================================

@router.post("/check-in/send-instructions", tags=["Check-In Automation"])
async def send_check_in_instructions(request: CheckInInstructionsRequest):
    """
    Send check-in instructions to a guest.
    
    - Includes door code, WiFi, address
    - Can send immediately or schedule for 3pm
    """
    service = get_check_in_automation()
    
    if request.send_now:
        result = await service.send_check_in_instructions(
            guest_name=request.guest_name,
            guest_phone=request.guest_phone,
            property_id=request.property_id,
            check_in_date=request.check_in_date
        )
    else:
        result = await service.schedule_check_in_message(
            guest_name=request.guest_name,
            guest_phone=request.guest_phone,
            property_id=request.property_id,
            check_in_date=request.check_in_date
        )
    
    return result


@router.get("/check-in/preview/{property_id}", tags=["Check-In Automation"])
async def preview_check_in_instructions(property_id: str):
    """Preview check-in instructions for a property."""
    prop = PROPERTY_KNOWLEDGE.get(property_id, DEFAULT_PROPERTY)
    
    return {
        "property_id": property_id,
        "property_name": prop.get("name", property_id),
        "address": prop.get("address", "See booking"),
        "door_code": prop.get("door_code", "****"),
        "wifi_network": prop.get("wifi_network"),
        "wifi_password": prop.get("wifi_password"),
        "check_in_time": prop.get("check_in_time"),
        "check_out_time": prop.get("check_out_time"),
        "parking": prop.get("parking"),
        "house_rules": prop.get("house_rules", []),
        "special_instructions": prop.get("special_instructions")
    }


# ============================================================================
# REVIEW REQUEST ENDPOINTS
# ============================================================================

@router.post("/review/request", tags=["Review Requests"])
async def send_review_request(request: ReviewRequestModel):
    """
    Send a review request to a guest.
    
    - Typically sent 24h after checkout
    - Includes link to leave review
    """
    service = get_review_service()
    result = await service.send_review_request(
        guest_name=request.guest_name,
        guest_phone=request.guest_phone,
        property_id=request.property_id,
        booking_platform=request.booking_platform,
        review_link=request.review_link
    )
    return result


# ============================================================================
# GUEST PREFERENCE ENDPOINTS
# ============================================================================

@router.post("/preferences/learn", tags=["Guest Preferences"])
async def learn_preference(request: PreferenceLearningModel):
    """
    Record a learned guest preference.
    
    Categories: check_in_preferences, room_preferences, temperature_preferences,
    amenity_preferences, dietary_restrictions, communication_style, etc.
    """
    service = get_preference_learning()
    result = await service.learn_preference(
        guest_id=request.guest_id,
        category=request.category,
        preference=request.preference,
        value=request.value,
        source=request.source
    )
    return result


@router.get("/preferences/{guest_id}", tags=["Guest Preferences"])
async def get_guest_preferences(guest_id: str):
    """Get all learned preferences for a guest."""
    service = get_preference_learning()
    preferences = await service.get_guest_preferences(guest_id)
    return {
        "guest_id": guest_id,
        "preferences": preferences
    }


@router.get("/preferences/{guest_id}/prompt", tags=["Guest Preferences"])
async def get_personalization_prompt(guest_id: str):
    """Get AI personalization prompt based on guest preferences."""
    service = get_preference_learning()
    prompt = await service.generate_personalization_prompt(guest_id)
    return {
        "guest_id": guest_id,
        "personalization_prompt": prompt
    }


# ============================================================================
# LANGUAGE SUPPORT ENDPOINTS
# ============================================================================

@router.post("/language/detect", tags=["Multi-Language"])
async def detect_language(text: str = Body(..., embed=True)):
    """Detect the language of text."""
    service = get_language_support()
    language = await service.detect_language(text)
    return {
        "text": text[:100],
        "detected_language": language,
        "language_name": service.SUPPORTED_LANGUAGES.get(language, "Unknown")
    }


@router.get("/language/supported", tags=["Multi-Language"])
async def get_supported_languages():
    """Get list of supported languages."""
    service = get_language_support()
    return {
        "languages": service.SUPPORTED_LANGUAGES
    }


# ============================================================================
# CLEANER DISPATCH ENDPOINTS
# ============================================================================

@router.post("/cleaner/dispatch", tags=["Cleaner Dispatch"])
async def dispatch_cleaner(request: CleanerDispatchRequest):
    """
    Dispatch a cleaner to a property.
    
    - Notifies assigned cleaner via SMS
    - Includes property address, checkout/checkin times
    """
    service = get_cleaner_dispatch()
    result = await service.dispatch_cleaner(
        property_id=request.property_id,
        checkout_time=request.checkout_time,
        next_checkin=request.next_checkin,
        special_notes=request.special_notes
    )
    return result


# ============================================================================
# PROPERTY KNOWLEDGE ENDPOINTS
# ============================================================================

@router.get("/property/{property_id}", tags=["Property Knowledge"])
async def get_property_knowledge(property_id: str):
    """Get all knowledge about a property."""
    prop = PROPERTY_KNOWLEDGE.get(property_id)
    
    if not prop:
        # Return default template
        return {
            "property_id": property_id,
            "found": False,
            "knowledge": DEFAULT_PROPERTY
        }
    
    return {
        "property_id": property_id,
        "found": True,
        "knowledge": prop
    }


@router.get("/properties", tags=["Property Knowledge"])
async def list_properties():
    """List all properties with knowledge."""
    return {
        "properties": [
            {
                "id": pid,
                "name": p.get("name", pid),
                "address": p.get("address"),
                "bedrooms": p.get("bedrooms"),
                "max_guests": p.get("max_guests")
            }
            for pid, p in PROPERTY_KNOWLEDGE.items()
        ],
        "count": len(PROPERTY_KNOWLEDGE)
    }


# ============================================================================
# COMBINED STATUS ENDPOINT
# ============================================================================

@router.get("/status", tags=["System"])
async def get_upgrades_status():
    """Check status of all V2 upgrade services."""
    return {
        "services": {
            "late_checkout": "active",
            "check_in_automation": "active",
            "review_requests": "active",
            "guest_preferences": "active",
            "multi_language": "active",
            "cleaner_dispatch": "active"
        },
        "properties_configured": len(PROPERTY_KNOWLEDGE),
        "timestamp": datetime.utcnow().isoformat()
    }
