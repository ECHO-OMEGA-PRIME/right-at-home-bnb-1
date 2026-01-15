"""
AI Concierge API Routes
Voice-enabled guest assistant for Midland TX
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class ConciergeQuery(BaseModel):
    guest_id: int
    property_id: int
    query: str
    voice: bool = False

class ConciergeResponse(BaseModel):
    response: str
    category: str
    voice_url: Optional[str] = None

# Midland TX local knowledge base
MIDLAND_KNOWLEDGE = {
    "restaurants": [
        {"name": "Venezia Italian Restaurant", "cuisine": "Italian", "price": "$$", "rating": 4.5, "address": "2101 W Wadley Ave"},
        {"name": "The Garlic Press", "cuisine": "American", "price": "$$$", "rating": 4.7, "address": "2200 W Texas Ave"},
        {"name": "Cork & Pig Tavern", "cuisine": "American/Wine Bar", "price": "$$", "rating": 4.6, "address": "3301 N Big Spring St"},
        {"name": "Cancun Mexican Restaurant", "cuisine": "Mexican", "price": "$", "rating": 4.4, "address": "4401 N Midland Dr"},
    ],
    "bars": [
        {"name": "The Blue Door", "type": "Wine Bar", "vibe": "Upscale", "address": "306 N Main St"},
        {"name": "Tall City Brewing Co", "type": "Brewery", "vibe": "Casual", "address": "501 N Marienfeld St"},
        {"name": "Sip Patio Bar", "type": "Cocktail Bar", "vibe": "Trendy", "address": "309 N Main St"},
    ],
    "attractions": [
        {"name": "Petroleum Museum", "type": "Museum", "hours": "10am-5pm"},
        {"name": "Museum of the Southwest", "type": "Art/Science", "hours": "10am-5pm"},
        {"name": "I-20 Wildlife Preserve", "type": "Nature", "hours": "Sunrise-Sunset"},
    ],
    "services": [
        {"name": "Midland International Airport", "code": "MAF", "distance": "10 miles"},
        {"name": "Medical Center Hospital", "type": "Hospital", "distance": "5 miles"},
        {"name": "HEB Grocery", "type": "Grocery", "distance": "2 miles"},
    ]
}

@router.post("/ask")
async def ask_concierge(query: ConciergeQuery):
    """Ask the AI concierge a question"""
    q = query.query.lower()
    
    # Restaurant recommendations
    if any(word in q for word in ["restaurant", "eat", "food", "dinner", "lunch"]):
        recs = MIDLAND_KNOWLEDGE["restaurants"][:3]
        response = "Here are my top restaurant picks in Midland:\n\n"
        for r in recs:
            response += f"• {r['name']} - {r['cuisine']}, {r['price']}, ⭐ {r['rating']}\n"
        return {"response": response, "category": "dining", "data": recs}
    
    # Bar/wine recommendations
    if any(word in q for word in ["bar", "wine", "drink", "cocktail", "beer"]):
        bars = MIDLAND_KNOWLEDGE["bars"]
        response = "Great wine and cocktail spots in Midland:\n\n"
        for b in bars:
            response += f"• {b['name']} - {b['type']}, {b['vibe']}\n"
        return {"response": response, "category": "nightlife", "data": bars}
    
    # Directions
    if any(word in q for word in ["directions", "how to get", "address", "where is"]):
        return {
            "response": "I can help with directions! Your property address has been sent to your phone via Google Maps. Would you like me to find directions to a specific location?",
            "category": "navigation",
            "maps_link": "https://maps.google.com"
        }
    
    # WiFi
    if "wifi" in q or "internet" in q or "password" in q:
        return {
            "response": "Your WiFi details:\n\nNetwork: RightAtHome_Guest\nPassword: Welcome2024\n\nThe router is located near the living room TV.",
            "category": "property_info"
        }
    
    # Checkout
    if "checkout" in q:
        return {
            "response": "Checkout time is 11:00 AM. Please:\n• Leave keys on the kitchen counter\n• Ensure all windows are closed\n• Take out any trash\n\nWould you like a late checkout? I can check availability for you.",
            "category": "checkout"
        }
    
    # Default response
    return {
        "response": "I'm here to help! I can assist with:\n• Restaurant & bar recommendations\n• Local attractions & events\n• Directions & maps\n• Property info (WiFi, checkout, etc.)\n• Late checkout requests\n\nWhat would you like to know?",
        "category": "general"
    }

@router.get("/local/restaurants")
async def get_restaurants():
    """Get local restaurant recommendations"""
    return MIDLAND_KNOWLEDGE["restaurants"]

@router.get("/local/bars")
async def get_bars():
    """Get local bar recommendations"""
    return MIDLAND_KNOWLEDGE["bars"]

@router.get("/local/attractions")
async def get_attractions():
    """Get local attractions"""
    return MIDLAND_KNOWLEDGE["attractions"]

@router.get("/events")
async def get_local_events():
    """Get upcoming Midland TX events"""
    return {
        "events": [
            {"name": "Tall City Blues Fest", "date": "2025-02-15", "venue": "Downtown Midland", "type": "Music"},
            {"name": "Permian Basin Fair", "date": "2025-03-01", "venue": "Midland County Horseshoe", "type": "Fair"},
            {"name": "First Friday Art Walk", "date": "2025-02-07", "venue": "Downtown Arts District", "type": "Art"},
        ]
    }

@router.post("/late-checkout")
async def request_late_checkout(guest_id: int, property_id: int, requested_time: str):
    """Request late checkout"""
    return {
        "status": "pending",
        "message": "Your late checkout request for 2:00 PM has been submitted. Steven will review and confirm shortly.",
        "current_checkout": "11:00 AM",
        "requested_checkout": requested_time
    }
