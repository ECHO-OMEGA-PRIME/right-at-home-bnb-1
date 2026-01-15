"""
VRBO API Routes for Right at Home BnB
"""

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional

from ..services.integrations.vrbo import VRBOiCalSync

router = APIRouter(prefix="/vrbo", tags=["VRBO Integration"])

# Global sync instance
vrbo_sync = VRBOiCalSync()

class VRBOPropertyConfig(BaseModel):
    property_id: int
    vrbo_listing_id: str
    ical_url: str

@router.post("/register")
async def register_vrbo_property(config: VRBOPropertyConfig):
    """
    Register a property for VRBO iCal sync
    
    To get your VRBO iCal URL:
    1. Log into VRBO dashboard
    2. Go to Calendar > Import & Export
    3. Click "Export calendar"
    4. Copy the .ics URL
    """
    prop = vrbo_sync.register_property(
        property_id=config.property_id,
        vrbo_listing_id=config.vrbo_listing_id,
        ical_import_url=config.ical_url
    )
    
    return {
        "status": "registered",
        "property_id": prop.property_id,
        "vrbo_listing_id": prop.vrbo_listing_id,
        "our_export_url": prop.ical_export_url,
        "instructions": {
            "step1": "Copy our export URL above",
            "step2": "Go to VRBO > Calendar > Import & Export",
            "step3": "Click 'Import a calendar'",
            "step4": "Paste our URL and save",
            "note": "Calendars sync every 60 minutes"
        }
    }

@router.get("/sync/{property_id}")
async def sync_vrbo_property(property_id: int):
    """Sync bookings from VRBO for a property"""
    result = await vrbo_sync.sync_property(property_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result

@router.get("/bookings/{property_id}")
async def get_vrbo_bookings(property_id: int):
    """Get imported VRBO bookings for a property"""
    if property_id not in vrbo_sync.properties:
        raise HTTPException(status_code=404, detail="Property not registered for VRBO")
    
    prop = vrbo_sync.properties[property_id]
    bookings = await vrbo_sync.fetch_vrbo_calendar(prop.ical_import_url)
    
    return {
        "property_id": property_id,
        "vrbo_listing_id": prop.vrbo_listing_id,
        "bookings": [
            {
                "uid": b.uid,
                "guest_name": b.guest_name,
                "check_in": b.start_date.isoformat() if b.start_date else None,
                "check_out": b.end_date.isoformat() if b.end_date else None,
                "confirmation": b.confirmation_code
            }
            for b in bookings
        ]
    }

@router.get("/ical/{property_id}/vrbo.ics")
async def export_ical_for_vrbo(property_id: int):
    """
    Export our calendar as iCal for VRBO to import
    VRBO will poll this URL every 60 minutes
    """
    # In production, fetch from database
    sample_bookings = [
        {
            "id": 1,
            "check_in": datetime.now() + timedelta(days=5),
            "check_out": datetime.now() + timedelta(days=8),
            "guest_name": "Direct Booking Guest"
        },
        {
            "id": 2,
            "check_in": datetime.now() + timedelta(days=15),
            "check_out": datetime.now() + timedelta(days=18),
            "guest_name": "Airbnb Guest"
        }
    ]
    
    ical_content = vrbo_sync.generate_ical_export(sample_bookings)
    
    return Response(
        content=ical_content,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f"attachment; filename=property_{property_id}_vrbo.ics"
        }
    )

@router.get("/status")
async def vrbo_integration_status():
    """Check VRBO integration status and provide setup instructions"""
    return {
        "integration_type": "iCal Sync (Free)",
        "sync_frequency": "Every 60 minutes",
        "registered_properties": len(vrbo_sync.properties),
        "api_access": {
            "status": "Not configured - Requires VRBO Partner Agreement",
            "how_to_apply": "https://integration-central.vrbo.com",
            "contact": "pmsalesinquiry@expediagroup.com",
            "benefits": [
                "Real-time booking sync (vs 60-min iCal delay)",
                "Guest messaging integration",
                "Dynamic pricing management",
                "Content sync (photos, descriptions)",
                "Instant availability updates"
            ]
        },
        "ical_setup_guide": {
            "step1": "Get VRBO iCal URL: VRBO Dashboard > Calendar > Export",
            "step2": "Register property: POST /api/vrbo/register",
            "step3": "Copy our export URL to VRBO: VRBO > Calendar > Import",
            "step4": "Calendars sync automatically every 60 minutes"
        }
    }


# =====================================================
# VRBO API Integration (Requires Partner Credentials)
# =====================================================
# To get full API access:
# 1. Visit: https://integration-central.vrbo.com
# 2. Email: pmsalesinquiry@expediagroup.com
# 3. Sign content API contract with Expedia Group
# 4. Complete onboarding with VRBO implementation specialist
#
# Full API provides:
# - Real-time reservation sync
# - Guest communication
# - Pricing & availability management  
# - Listing content management
# - Payment processing
# =====================================================
