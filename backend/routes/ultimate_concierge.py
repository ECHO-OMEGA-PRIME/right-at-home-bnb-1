"""
Right At Home BnB - Ultimate Concierge API Routes
==================================================
API endpoints for the complete concierge system.

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from loguru import logger

# Import the ultimate concierge
from services.ultimate_concierge import (
    get_concierge,
    handle_guest_message,
    search_local_businesses,
    book_appointment,
    get_weather,
    RequestCategory,
    UrgencyLevel,
    MIDLAND_BUSINESSES
)

router = APIRouter(prefix="/api/concierge")


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class GuestMessageRequest(BaseModel):
    """Request from a guest."""
    guest_id: str = Field(..., description="Guest identifier")
    property_id: str = Field(..., description="Property identifier")
    message: str = Field(..., description="Guest's message")
    guest_name: Optional[str] = Field(None, description="Guest's name if known")


class GuestMessageResponse(BaseModel):
    """Response to guest request."""
    request_id: str
    category: str
    urgency: str
    response: Dict[str, Any]
    steven_notified: bool
    steven_called: bool


class LocalSearchRequest(BaseModel):
    """Search for local businesses."""
    query: str = Field(..., description="Search query")
    category: Optional[str] = Field(None, description="Category filter")


class AppointmentRequest(BaseModel):
    """Book an appointment."""
    guest_id: str
    business_name: str
    service: str
    preferred_date: str = Field(..., description="YYYY-MM-DD format")
    preferred_time: str = Field(..., description="HH:MM AM/PM format")
    guest_name: str
    guest_phone: str


class QuickRequestModel(BaseModel):
    """Quick request for common needs."""
    guest_id: str
    property_id: str
    request_type: str = Field(..., description="towels, toilet_paper, maintenance, etc.")
    details: Optional[str] = None
    guest_name: Optional[str] = None


# ============================================================================
# MAIN CHAT ENDPOINT
# ============================================================================

@router.post("/message", response_model=GuestMessageResponse, tags=["Ultimate Concierge"])
async def handle_message(request: GuestMessageRequest):
    """
    Handle any guest message.
    
    The AI will:
    1. Classify the request (supplies, dining, emergency, etc.)
    2. Determine urgency level
    3. Generate appropriate response
    4. Notify/call Steven if needed
    5. Log everything in Firebase
    """
    try:
        result = await handle_guest_message(
            guest_id=request.guest_id,
            property_id=request.property_id,
            message=request.message,
            guest_name=request.guest_name
        )
        return result
    except Exception as e:
        logger.error(f"Error handling guest message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# QUICK REQUEST ENDPOINTS
# ============================================================================

@router.post("/quick/supplies", tags=["Quick Requests"])
async def request_supplies(request: QuickRequestModel):
    """
    Quick request for supplies (towels, toiletries, etc.).
    Automatically notifies Steven via text.
    """
    message = f"I need {request.request_type}"
    if request.details:
        message += f" - {request.details}"
    
    result = await handle_guest_message(
        guest_id=request.guest_id,
        property_id=request.property_id,
        message=message,
        guest_name=request.guest_name
    )
    return result


@router.post("/quick/maintenance", tags=["Quick Requests"])
async def report_maintenance(request: QuickRequestModel):
    """
    Report a maintenance issue.
    Notifies Steven and may call depending on urgency.
    """
    message = f"Maintenance issue: {request.request_type}"
    if request.details:
        message += f" - {request.details}"
    
    result = await handle_guest_message(
        guest_id=request.guest_id,
        property_id=request.property_id,
        message=message,
        guest_name=request.guest_name
    )
    return result


@router.post("/quick/emergency", tags=["Quick Requests"])
async def report_emergency(request: QuickRequestModel):
    """
    Report an emergency.
    IMMEDIATELY calls Steven and sends text.
    """
    message = f"EMERGENCY: {request.request_type}"
    if request.details:
        message += f" - {request.details}"
    
    result = await handle_guest_message(
        guest_id=request.guest_id,
        property_id=request.property_id,
        message=message,
        guest_name=request.guest_name
    )
    return result


# ============================================================================
# LOCAL SEARCH & RECOMMENDATIONS
# ============================================================================

@router.get("/search", tags=["Local Search"])
async def search_local(
    query: str = Query(..., description="Search query"),
    category: Optional[str] = Query(None, description="Category filter")
):
    """
    Search for local businesses in Midland, TX.
    
    Categories: dining, nightlife, wellness, entertainment, shopping
    """
    results = await search_local_businesses(query, category)
    return {
        "query": query,
        "category": category,
        "results": results,
        "count": len(results)
    }


@router.get("/recommendations/{category}", tags=["Local Search"])
async def get_recommendations(
    category: str,
    limit: int = Query(5, ge=1, le=20)
):
    """
    Get top recommendations for a category.
    
    Valid categories: dining, nightlife, wellness, entertainment, shopping
    """
    if category not in MIDLAND_BUSINESSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Choose from: {', '.join(MIDLAND_BUSINESSES.keys())}"
        )
    
    concierge = get_concierge()
    recommendations = concierge._get_recommendations(category, limit)
    
    return {
        "category": category,
        "recommendations": [
            {
                "name": r.name,
                "category": r.category,
                "address": r.address,
                "phone": r.phone,
                "rating": r.rating,
                "price_range": r.price_range,
                "description": r.description,
                "hours": r.hours,
                "booking_url": r.booking_url
            }
            for r in recommendations
        ],
        "count": len(recommendations)
    }


@router.get("/restaurants", tags=["Local Search"])
async def get_restaurants(
    cuisine: Optional[str] = Query(None, description="Cuisine type"),
    price: Optional[str] = Query(None, description="Price range: $, $$, $$$")
):
    """Get restaurant recommendations."""
    results = MIDLAND_BUSINESSES.get("dining", [])
    
    # Filter by cuisine if specified
    if cuisine:
        results = [r for r in results if cuisine.lower() in r.category.lower()]
    
    # Filter by price if specified
    if price:
        results = [r for r in results if r.price_range == price]
    
    return {
        "restaurants": [
            {
                "name": r.name,
                "cuisine": r.category,
                "address": r.address,
                "phone": r.phone,
                "rating": r.rating,
                "price_range": r.price_range,
                "description": r.description
            }
            for r in sorted(results, key=lambda x: x.rating or 0, reverse=True)
        ]
    }


@router.get("/bars", tags=["Local Search"])
async def get_bars():
    """Get bar and nightlife recommendations."""
    results = MIDLAND_BUSINESSES.get("nightlife", [])
    return {
        "bars": [
            {
                "name": r.name,
                "type": r.category,
                "address": r.address,
                "phone": r.phone,
                "hours": r.hours,
                "rating": r.rating,
                "description": r.description
            }
            for r in sorted(results, key=lambda x: x.rating or 0, reverse=True)
        ]
    }


@router.get("/salons", tags=["Local Search"])
async def get_salons(
    service_type: Optional[str] = Query(None, description="barber, salon, spa, massage")
):
    """Get salon, barber, and spa recommendations."""
    results = MIDLAND_BUSINESSES.get("wellness", [])
    
    if service_type:
        results = [r for r in results if service_type.lower() in r.category.lower()]
    
    return {
        "wellness": [
            {
                "name": r.name,
                "type": r.category,
                "address": r.address,
                "phone": r.phone,
                "hours": r.hours,
                "rating": r.rating,
                "price_range": r.price_range,
                "description": r.description,
                "booking_url": r.booking_url
            }
            for r in sorted(results, key=lambda x: x.rating or 0, reverse=True)
        ]
    }


@router.get("/things-to-do", tags=["Local Search"])
async def get_things_to_do(
    activity_type: Optional[str] = Query(None, description="museum, sports, outdoors, etc.")
):
    """Get entertainment and activity recommendations."""
    results = MIDLAND_BUSINESSES.get("entertainment", [])
    
    if activity_type:
        results = [
            r for r in results 
            if activity_type.lower() in r.category.lower() or 
               (r.description and activity_type.lower() in r.description.lower())
        ]
    
    return {
        "activities": [
            {
                "name": r.name,
                "type": r.category,
                "address": r.address,
                "phone": r.phone,
                "hours": r.hours,
                "price_range": r.price_range,
                "rating": r.rating,
                "description": r.description,
                "website": r.website
            }
            for r in results
        ]
    }


# ============================================================================
# APPOINTMENT BOOKING
# ============================================================================

@router.post("/book-appointment", tags=["Appointments"])
async def book_appt(request: AppointmentRequest):
    """
    Book an appointment at a local business.
    
    Steven will be notified to call and confirm the booking.
    Guest will receive a text when confirmed.
    """
    result = await book_appointment(
        guest_id=request.guest_id,
        business=request.business_name,
        service=request.service,
        date=request.preferred_date,
        time=request.preferred_time,
        name=request.guest_name,
        phone=request.guest_phone
    )
    return result


# ============================================================================
# WEATHER
# ============================================================================

@router.get("/weather", tags=["Weather"])
async def get_current_weather():
    """
    Get current weather for Midland, TX.
    Used by the website header and AI responses.
    """
    weather = await get_weather()
    return weather


# ============================================================================
# CATEGORIES & INFO
# ============================================================================

@router.get("/categories", tags=["Info"])
async def get_categories():
    """Get all available request categories."""
    return {
        "categories": [cat.value for cat in RequestCategory],
        "urgency_levels": [level.value for level in UrgencyLevel],
        "business_categories": list(MIDLAND_BUSINESSES.keys())
    }


@router.get("/status", tags=["Info"])
async def get_concierge_status():
    """Check concierge service status."""
    concierge = get_concierge()
    return {
        "status": "online",
        "firebase_connected": concierge.firebase_available,
        "twilio_connected": concierge.twilio_client is not None,
        "weather_api_configured": concierge.weather_api_key is not None,
        "google_places_configured": concierge.google_api_key is not None,
        "steven_phone_configured": bool(concierge.steven_phone),
        "timestamp": datetime.utcnow().isoformat()
    }
