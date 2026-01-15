"""
Right At Home BnB - Wine Cellar API Routes
===========================================
Steven's private wine collection with invitation-based access.

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel

from services.wine_cellar import wine_cellar_service, WineAccessLevel

router = APIRouter()


class InviteRequest(BaseModel):
    admin_code: str
    guest_name: str
    guest_email: Optional[str] = None
    access_level: str = "VIEW_ONLY"
    expires_days: int = 30


class WineAddRequest(BaseModel):
    admin_code: str
    name: str
    vintage: int
    wine_type: str
    region: str
    purchase_price: float
    quantity: int = 1
    rating: Optional[float] = None
    tasting_notes: Optional[str] = None
    drinking_window_start: Optional[int] = None
    drinking_window_end: Optional[int] = None


@router.get("/")
async def get_wine_cellar(
    invite_code: str,
    wine_type: Optional[str] = None,
    drinking_now: bool = False
):
    """Access Steven's wine cellar with invite code."""
    result = await wine_cellar_service.get_cellar(invite_code, wine_type, drinking_now)
    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])
    return result


@router.get("/stats")
async def get_cellar_stats(invite_code: str):
    """Get wine cellar statistics."""
    result = await wine_cellar_service.get_cellar_stats(invite_code)
    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])
    return result


@router.post("/invite")
async def create_invite(request: InviteRequest):
    """Create invitation for guest access (admin only)."""
    try:
        access_level = WineAccessLevel(request.access_level)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid access level")

    result = await wine_cellar_service.create_invite(
        admin_code=request.admin_code,
        guest_name=request.guest_name,
        guest_email=request.guest_email,
        access_level=access_level,
        expires_days=request.expires_days
    )

    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])
    return result


@router.post("/add")
async def add_wine(request: WineAddRequest):
    """Add wine to cellar (admin only)."""
    result = await wine_cellar_service.add_wine(
        admin_code=request.admin_code,
        name=request.name,
        vintage=request.vintage,
        wine_type=request.wine_type,
        region=request.region,
        purchase_price=request.purchase_price,
        quantity=request.quantity,
        rating=request.rating,
        tasting_notes=request.tasting_notes,
        drinking_window_start=request.drinking_window_start,
        drinking_window_end=request.drinking_window_end
    )

    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])
    return result


@router.get("/recommendations")
async def get_recommendations(
    invite_code: str,
    occasion: Optional[str] = None,
    food_pairing: Optional[str] = None
):
    """Get wine recommendations for an occasion or food pairing."""
    result = await wine_cellar_service.get_recommendations(
        invite_code, occasion, food_pairing
    )
    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])
    return result
