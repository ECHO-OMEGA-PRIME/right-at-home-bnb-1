"""
Right at Home BnB - Concierge API Routes
Steven AI's endpoints for local recommendations, weather, and appointments

Author: ECHO PRIME
Authority: 11.0
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from loguru import logger

from services.concierge_service import (
    get_concierge,
    WeatherData,
    LocalBusiness,
    LocalEvent,
    AppointmentSlot,
    AppointmentBooking,
    BusinessCategory
)

router = APIRouter(prefix="/api/concierge", tags=["Concierge"])

# ============ REQUEST MODELS ============

class RecommendationRequest(BaseModel):
    """Request for recommendations"""
    intent: str = Field(..., description="What the guest is looking for")
    preferences: Optional[Dict[str, Any]] = Field(None, description="Additional preferences")

class AppointmentRequest(BaseModel):
    """Request to book an appointment"""
    guest_name: str = Field(..., description="Guest's full name")
    guest_phone: str = Field(..., description="Guest's phone number")
    guest_email: Optional[str] = Field(None, description="Guest's email")
    business_id: str = Field(..., description="Business ID to book at")
    date: str = Field(..., description="Appointment date (YYYY-MM-DD)")
    time: str = Field(..., description="Appointment time (HH:MM)")
    service: str = Field(..., description="Service to book")
    notes: Optional[str] = Field(None, description="Additional notes")

class StevenContextRequest(BaseModel):
    """Request for Steven AI context"""
    guest_query: str = Field(..., description="Guest's question or request")
    guest_context: Optional[Dict[str, Any]] = Field(None, description="Guest's context info")

# ============ RESPONSE MODELS ============

class WeatherResponse(BaseModel):
    """Weather response"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class RecommendationsResponse(BaseModel):
    """Recommendations response"""
    success: bool
    intent: str
    recommendations: List[Dict[str, Any]]
    message: str
    count: int

class BusinessListResponse(BaseModel):
    """Business list response"""
    success: bool
    businesses: List[Dict[str, Any]]
    count: int
    category: Optional[str] = None

class EventsResponse(BaseModel):
    """Events response"""
    success: bool
    events: List[Dict[str, Any]]
    count: int

class AppointmentSlotsResponse(BaseModel):
    """Available slots response"""
    success: bool
    business_id: str
    date: str
    slots: List[Dict[str, Any]]
    count: int

class AppointmentBookingResponse(BaseModel):
    """Booking response"""
    success: bool
    booking: Optional[Dict[str, Any]] = None
    confirmation_code: Optional[str] = None
    message: str

class StevenContextResponse(BaseModel):
    """Steven AI context response"""
    success: bool
    context: str
    query: str

# ============ WEATHER ENDPOINTS ============

@router.get("/weather", response_model=WeatherResponse)
async def get_weather():
    """
    Get current weather and forecast for Midland, TX
    
    Uses Open-Meteo API (free, no key required)
    Cached for 30 minutes
    """
    try:
        concierge = get_concierge()
        weather = await concierge.get_weather()
        
        if not weather:
            return WeatherResponse(
                success=False,
                error="Failed to fetch weather data"
            )
        
        # Convert to dict for response
        weather_dict = weather.model_dump()
        
        # Add simplified current for frontend
        weather_dict["temp"] = weather.current.temperature
        weather_dict["condition"] = weather.current.condition
        weather_dict["emoji"] = weather.current.icon
        
        return WeatherResponse(success=True, data=weather_dict)
        
    except Exception as e:
        logger.error(f"Weather endpoint error: {e}")
        return WeatherResponse(success=False, error=str(e))


@router.get("/weather/summary")
async def get_weather_summary():
    """Get weather summary for voice/AI"""
    try:
        concierge = get_concierge()
        weather = await concierge.get_weather()
        
        if not weather:
            return {"success": False, "summary": "Weather data unavailable"}
        
        return {
            "success": True,
            "summary": weather.summary,
            "alerts": weather.alerts
        }
        
    except Exception as e:
        logger.error(f"Weather summary error: {e}")
        return {"success": False, "summary": str(e)}


# ============ RECOMMENDATIONS ENDPOINTS ============

@router.post("/recommendations", response_model=RecommendationsResponse)
async def get_recommendations(request: RecommendationRequest):
    """
    Get recommendations based on guest intent
    
    Examples:
    - "I'm hungry" -> restaurants
    - "Where can I get a drink?" -> bars
    - "I need a haircut" -> salons
    - "What's there to do here?" -> attractions
    """
    try:
        concierge = get_concierge()
        result = await concierge.get_recommendations(
            intent=request.intent,
            preferences=request.preferences
        )
        
        return RecommendationsResponse(
            success=True,
            intent=result["intent"],
            recommendations=result["recommendations"],
            message=result["message"],
            count=len(result["recommendations"])
        )
        
    except Exception as e:
        logger.error(f"Recommendations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/restaurants", response_model=BusinessListResponse)
async def get_restaurants(
    cuisine: Optional[str] = Query(None, description="Filter by cuisine type"),
    limit: int = Query(5, ge=1, le=20)
):
    """Get restaurant recommendations"""
    try:
        concierge = get_concierge()
        restaurants = await concierge.businesses.get_restaurants(cuisine=cuisine, limit=limit)
        
        return BusinessListResponse(
            success=True,
            businesses=[r.model_dump() for r in restaurants],
            count=len(restaurants),
            category="restaurant"
        )
        
    except Exception as e:
        logger.error(f"Restaurants error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bars", response_model=BusinessListResponse)
async def get_bars(limit: int = Query(5, ge=1, le=20)):
    """Get bar recommendations"""
    try:
        concierge = get_concierge()
        bars = await concierge.businesses.get_bars(limit=limit)
        
        return BusinessListResponse(
            success=True,
            businesses=[b.model_dump() for b in bars],
            count=len(bars),
            category="bar"
        )
        
    except Exception as e:
        logger.error(f"Bars error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/attractions", response_model=BusinessListResponse)
async def get_attractions(limit: int = Query(5, ge=1, le=20)):
    """Get attraction recommendations"""
    try:
        concierge = get_concierge()
        attractions = await concierge.businesses.get_attractions(limit=limit)
        
        return BusinessListResponse(
            success=True,
            businesses=[a.model_dump() for a in attractions],
            count=len(attractions),
            category="attraction"
        )
        
    except Exception as e:
        logger.error(f"Attractions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/salons", response_model=BusinessListResponse)
async def get_salons(limit: int = Query(5, ge=1, le=20)):
    """Get salon/barber recommendations"""
    try:
        concierge = get_concierge()
        salons = await concierge.businesses.get_salons(limit=limit)
        
        return BusinessListResponse(
            success=True,
            businesses=[s.model_dump() for s in salons],
            count=len(salons),
            category="salon"
        )
        
    except Exception as e:
        logger.error(f"Salons error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=BusinessListResponse)
async def search_businesses(
    q: Optional[str] = Query(None, description="Search query"),
    category: Optional[str] = Query(None, description="Business category"),
    limit: int = Query(10, ge=1, le=50)
):
    """Search for local businesses"""
    try:
        concierge = get_concierge()
        
        # Convert category string to enum if provided
        cat_enum = None
        if category:
            try:
                cat_enum = BusinessCategory(category)
            except ValueError:
                pass
        
        results = await concierge.businesses.search_businesses(
            category=cat_enum,
            query=q,
            limit=limit
        )
        
        return BusinessListResponse(
            success=True,
            businesses=[r.model_dump() for r in results],
            count=len(results),
            category=category
        )
        
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ EVENTS ENDPOINTS ============

@router.get("/events", response_model=EventsResponse)
async def get_events(
    q: Optional[str] = Query(None, description="Search query"),
    category: Optional[str] = Query(None, description="Event category"),
    date: Optional[str] = Query(None, description="Event date (YYYY-MM-DD)")
):
    """Get local events"""
    try:
        concierge = get_concierge()
        events = await concierge.search.search_local_events(
            query=q,
            category=category,
            date=date
        )
        
        return EventsResponse(
            success=True,
            events=[e.model_dump() for e in events],
            count=len(events)
        )
        
    except Exception as e:
        logger.error(f"Events error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ APPOINTMENT ENDPOINTS ============

@router.get("/appointments/slots", response_model=AppointmentSlotsResponse)
async def get_appointment_slots(
    business_id: str = Query(..., description="Business ID"),
    date: str = Query(..., description="Date (YYYY-MM-DD)"),
    service: Optional[str] = Query(None, description="Service filter")
):
    """Get available appointment slots for a business"""
    try:
        concierge = get_concierge()
        slots = await concierge.appointments.get_available_slots(
            business_id=business_id,
            date=date,
            service=service
        )
        
        return AppointmentSlotsResponse(
            success=True,
            business_id=business_id,
            date=date,
            slots=[s.model_dump() for s in slots],
            count=len(slots)
        )
        
    except Exception as e:
        logger.error(f"Slots error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/appointments/book", response_model=AppointmentBookingResponse)
async def book_appointment(request: AppointmentRequest):
    """
    Book an appointment at a salon/barber/spa
    
    Returns confirmation code for the booking
    """
    try:
        concierge = get_concierge()
        booking = await concierge.book_salon_appointment(
            guest_name=request.guest_name,
            guest_phone=request.guest_phone,
            guest_email=request.guest_email,
            business_id=request.business_id,
            date=request.date,
            time=request.time,
            service=request.service,
            notes=request.notes
        )
        
        if not booking:
            return AppointmentBookingResponse(
                success=False,
                message="Failed to book appointment. Business not found."
            )
        
        return AppointmentBookingResponse(
            success=True,
            booking=booking.model_dump(),
            confirmation_code=booking.confirmation_code,
            message=f"Appointment confirmed! Your confirmation code is {booking.confirmation_code}"
        )
        
    except Exception as e:
        logger.error(f"Booking error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ STEVEN AI CONTEXT ENDPOINT ============

@router.post("/steven/context", response_model=StevenContextResponse)
async def get_steven_context(request: StevenContextRequest):
    """
    Get context for Steven AI to respond to guest queries
    
    Analyzes query and provides relevant context:
    - Weather if asking about conditions
    - Local recommendations if asking about places
    - Guest info if available
    """
    try:
        concierge = get_concierge()
        context = await concierge.get_steven_context(
            guest_query=request.guest_query,
            guest_context=request.guest_context
        )
        
        return StevenContextResponse(
            success=True,
            context=context,
            query=request.guest_query
        )
        
    except Exception as e:
        logger.error(f"Steven context error: {e}")
        return StevenContextResponse(
            success=False,
            context="",
            query=request.guest_query
        )


# ============ HEALTH CHECK ============

@router.get("/health")
async def health_check():
    """Concierge service health check"""
    return {
        "status": "healthy",
        "service": "concierge",
        "timestamp": datetime.utcnow().isoformat(),
        "features": [
            "weather",
            "restaurants",
            "bars", 
            "salons",
            "attractions",
            "events",
            "appointments"
        ]
    }
