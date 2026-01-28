"""
Gap-Filler Discount Engine API Routes
=====================================
REST API endpoints for the Gap-Filler system.

Endpoints:
- GET  /admin/gaps - List all booking gaps
- GET  /admin/gaps/property/{id} - Gaps for specific property
- GET  /admin/gaps/scan - Trigger gap detection scan
- POST /admin/gaps/{id}/offer - Create special offer from gap
- GET  /admin/offers - List active special offers
- PUT  /admin/offers/{id}/activate - Publish offer
- PUT  /admin/offers/{id}/deactivate - Unpublish offer
- DELETE /admin/offers/{id} - Cancel offer
- POST /admin/offers/{id}/booked - Mark offer as booked
- GET  /admin/gaps/summary - Get gap analysis summary
- POST /admin/gaps/run-daily - Manually trigger daily scan

ECHO OMEGA PRIME | Made for Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
import logging

from database.connection import get_db
from database.models import Property
from database.models_financial import BookingGap, SpecialOffer, SpecialOfferType
from services.gap_filler import (
    get_gap_filler_service,
    GapFillerService,
    GapAnalysis,
    DiscountTier,
    run_daily_gap_scan
)

logger = logging.getLogger("RightAtHomeBnB.GapFillerAPI")

router = APIRouter()


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class GapResponse(BaseModel):
    """Response model for a booking gap."""
    id: int
    property_id: str
    property_name: Optional[str] = None
    gap_start: date
    gap_end: date
    gap_nights: int
    checkout_booking_id: Optional[str] = None
    checkin_booking_id: Optional[str] = None
    is_gap_filler_eligible: bool
    was_filled: bool
    special_offer_id: Optional[int] = None
    potential_revenue: Optional[float] = None
    suggested_discount: float = 0.0
    days_until_gap: int = 0
    status: str = "pending"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OfferResponse(BaseModel):
    """Response model for a special offer."""
    id: int
    property_id: str
    property_name: Optional[str] = None
    offer_type: str
    title: str
    description: Optional[str] = None
    start_date: date
    end_date: date
    nights_available: int
    original_nightly_rate: float
    discounted_rate: float
    discount_percentage: float
    total_savings: float
    is_active: bool
    is_booked: bool
    booking_id: Optional[str] = None
    is_auto_generated: bool
    generation_reason: Optional[str] = None
    pushed_to_website: bool
    push_date: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CreateOfferRequest(BaseModel):
    """Request body for creating an offer from a gap."""
    min_nights: int = Field(default=2, ge=1, description="Minimum nights required")
    valid_days: int = Field(default=7, ge=1, le=30, description="Days until offer expires")
    custom_discount: Optional[float] = Field(
        default=None, ge=5, le=50,
        description="Custom discount percentage (overrides auto calculation)"
    )
    auto_publish: bool = Field(default=False, description="Immediately activate the offer")


class MarkBookedRequest(BaseModel):
    """Request body for marking an offer as booked."""
    booking_id: str = Field(..., description="ID of the booking that filled this offer")


class GapSummaryResponse(BaseModel):
    """Summary statistics for gap analysis."""
    total_gaps: int
    total_nights_available: int
    total_potential_revenue: float
    gaps_by_tier: Dict[str, int]
    gaps_by_property: Dict[str, int]
    offers_pending: int
    offers_active: int
    offers_booked: int
    avg_discount: float
    scan_date: date


class ScanResponse(BaseModel):
    """Response for a gap scan operation."""
    scan_date: str
    properties_scanned: int
    gaps_found: int
    gaps_saved: int
    offers_generated: int
    alerts_created: int
    errors: List[str]
    duration_seconds: float


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_gap_service() -> GapFillerService:
    """Get gap filler service instance."""
    return get_gap_filler_service()


def gap_to_response(gap: BookingGap, db: Session) -> GapResponse:
    """Convert a BookingGap to GapResponse with additional computed fields."""
    # Get property name
    prop = db.query(Property).filter(Property.id == gap.property_id).first()
    property_name = prop.name if prop else None

    # Calculate suggested discount
    suggested_discount = DiscountTier.get_discount(gap.gap_nights)

    # Calculate days until gap
    days_until = (gap.gap_start - date.today()).days
    if days_until < 0:
        days_until = 0

    # Determine status
    if gap.was_filled:
        status = "filled"
    elif gap.gap_end < date.today():
        status = "expired"
    elif gap.special_offer_id:
        # Check if offer is active
        offer = db.query(SpecialOffer).filter(
            SpecialOffer.id == gap.special_offer_id
        ).first()
        if offer and offer.is_active:
            status = "active"
        else:
            status = "offer_created"
    else:
        status = "pending"

    return GapResponse(
        id=gap.id,
        property_id=gap.property_id,
        property_name=property_name,
        gap_start=gap.gap_start,
        gap_end=gap.gap_end,
        gap_nights=gap.gap_nights,
        checkout_booking_id=gap.checkout_booking_id,
        checkin_booking_id=gap.checkin_booking_id,
        is_gap_filler_eligible=gap.is_gap_filler_eligible,
        was_filled=gap.was_filled,
        special_offer_id=gap.special_offer_id,
        potential_revenue=float(gap.potential_revenue) if gap.potential_revenue else None,
        suggested_discount=suggested_discount,
        days_until_gap=days_until,
        status=status,
        created_at=gap.created_at
    )


def offer_to_response(offer: SpecialOffer, db: Session) -> OfferResponse:
    """Convert a SpecialOffer to OfferResponse with property name."""
    prop = db.query(Property).filter(Property.id == offer.property_id).first()
    property_name = prop.name if prop else None

    return OfferResponse(
        id=offer.id,
        property_id=offer.property_id,
        property_name=property_name,
        offer_type=offer.offer_type.value if offer.offer_type else "gap_filler",
        title=offer.title,
        description=offer.description,
        start_date=offer.start_date,
        end_date=offer.end_date,
        nights_available=offer.nights_available,
        original_nightly_rate=float(offer.original_nightly_rate),
        discounted_rate=float(offer.discounted_rate),
        discount_percentage=offer.discount_percentage,
        total_savings=float(offer.total_savings),
        is_active=offer.is_active,
        is_booked=offer.is_booked,
        booking_id=offer.booking_id,
        is_auto_generated=offer.is_auto_generated,
        generation_reason=offer.generation_reason,
        pushed_to_website=offer.pushed_to_website,
        push_date=offer.push_date,
        expires_at=offer.expires_at,
        created_at=offer.created_at
    )


# =============================================================================
# GAP ENDPOINTS
# =============================================================================

@router.get("/admin/gaps", response_model=List[GapResponse], tags=["Gap Filler"])
async def list_all_gaps(
    include_filled: bool = Query(False, description="Include filled gaps"),
    future_only: bool = Query(True, description="Only show future gaps"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    List all booking gaps across all properties.

    Returns gaps sorted by start date, with additional computed fields
    like suggested discount and days until gap.
    """
    service = get_gap_service()
    gaps = service.get_gaps(
        include_filled=include_filled,
        future_only=future_only,
        db=db
    )

    # Apply pagination
    paginated_gaps = gaps[offset:offset + limit]

    return [gap_to_response(g, db) for g in paginated_gaps]


@router.get("/admin/gaps/property/{property_id}", response_model=List[GapResponse], tags=["Gap Filler"])
async def list_property_gaps(
    property_id: str,
    include_filled: bool = Query(False),
    future_only: bool = Query(True),
    db: Session = Depends(get_db)
):
    """
    List booking gaps for a specific property.
    """
    service = get_gap_service()
    gaps = service.get_gaps(
        property_id=property_id,
        include_filled=include_filled,
        future_only=future_only,
        db=db
    )

    return [gap_to_response(g, db) for g in gaps]


@router.get("/admin/gaps/scan", response_model=List[GapResponse], tags=["Gap Filler"])
async def scan_for_gaps(
    property_id: Optional[str] = Query(None, description="Optional: scan specific property"),
    days_ahead: int = Query(90, ge=7, le=365),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """
    Trigger a gap detection scan.

    Scans all properties (or specific property) for booking gaps
    and saves them to the database.
    """
    service = get_gap_service()

    try:
        if property_id:
            # Scan single property
            prop = db.query(Property).filter(Property.id == property_id).first()
            if not prop:
                raise HTTPException(status_code=404, detail=f"Property {property_id} not found")

            gaps = await service.scan_property(
                property_id=property_id,
                property_name=prop.name,
                nightly_rate=Decimal(str(prop.nightly_rate or 100)),
                days_ahead=days_ahead,
                db=db
            )
        else:
            # Scan all properties
            gaps = await service.scan_all_properties(days_ahead=days_ahead)

        # Save gaps to database
        if gaps:
            await service.save_gaps_to_db(gaps)

        # Refresh from database to get IDs
        db_gaps = service.get_gaps(property_id=property_id, db=db)

        return [gap_to_response(g, db) for g in db_gaps]

    except Exception as e:
        logger.error(f"Gap scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/gaps/{gap_id}/offer", response_model=OfferResponse, tags=["Gap Filler"])
async def create_offer_from_gap(
    gap_id: int,
    request: CreateOfferRequest,
    db: Session = Depends(get_db)
):
    """
    Create a special offer from a booking gap.

    The offer will use the gap's dates and property, with discount
    calculated based on gap length (or custom discount if provided).
    """
    service = get_gap_service()

    try:
        offer = await service.create_offer_from_gap(
            gap_id=gap_id,
            min_nights=request.min_nights,
            valid_days=request.valid_days,
            custom_discount=request.custom_discount,
            auto_publish=request.auto_publish,
            db=db
        )

        return offer_to_response(offer, db)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create offer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/gaps/summary", response_model=GapSummaryResponse, tags=["Gap Filler"])
async def get_gap_summary(
    db: Session = Depends(get_db)
):
    """
    Get summary statistics for gap analysis.

    Returns aggregate data useful for dashboards and reporting.
    """
    service = get_gap_service()
    gaps = service.get_gaps(include_filled=False, future_only=True, db=db)
    offers = service.get_offers(active_only=False, db=db)

    # Calculate statistics
    total_nights = sum(g.gap_nights for g in gaps)
    total_revenue = sum(float(g.potential_revenue or 0) for g in gaps)

    # Group by tier
    gaps_by_tier = {"Short Stay (3-4)": 0, "Week Stay (5-7)": 0, "Extended (8-14)": 0, "Long (15+)": 0}
    for g in gaps:
        tier_name = DiscountTier.get_tier_name(g.gap_nights)
        if "Short" in tier_name:
            gaps_by_tier["Short Stay (3-4)"] += 1
        elif "Week" in tier_name:
            gaps_by_tier["Week Stay (5-7)"] += 1
        elif "Extended" in tier_name:
            gaps_by_tier["Extended (8-14)"] += 1
        else:
            gaps_by_tier["Long (15+)"] += 1

    # Group by property
    gaps_by_property = {}
    for g in gaps:
        prop = db.query(Property).filter(Property.id == g.property_id).first()
        name = prop.name if prop else g.property_id
        gaps_by_property[name] = gaps_by_property.get(name, 0) + 1

    # Offer statistics
    offers_pending = sum(1 for o in offers if not o.is_active and not o.is_booked)
    offers_active = sum(1 for o in offers if o.is_active and not o.is_booked)
    offers_booked = sum(1 for o in offers if o.is_booked)

    # Average discount
    discounts = [g.discount_percentage for g in gaps]
    avg_discount = sum(discounts) / len(discounts) if discounts else 0

    return GapSummaryResponse(
        total_gaps=len(gaps),
        total_nights_available=total_nights,
        total_potential_revenue=total_revenue,
        gaps_by_tier=gaps_by_tier,
        gaps_by_property=gaps_by_property,
        offers_pending=offers_pending,
        offers_active=offers_active,
        offers_booked=offers_booked,
        avg_discount=avg_discount,
        scan_date=date.today()
    )


# =============================================================================
# OFFER ENDPOINTS
# =============================================================================

@router.get("/admin/offers", response_model=List[OfferResponse], tags=["Gap Filler"])
async def list_offers(
    property_id: Optional[str] = Query(None),
    active_only: bool = Query(False),
    offer_type: Optional[str] = Query(None, description="Filter by offer type"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    List special offers with optional filters.
    """
    service = get_gap_service()

    # Convert offer_type string to enum if provided
    offer_type_enum = None
    if offer_type:
        try:
            offer_type_enum = SpecialOfferType(offer_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid offer type. Must be one of: {[t.value for t in SpecialOfferType]}"
            )

    offers = service.get_offers(
        property_id=property_id,
        active_only=active_only,
        offer_type=offer_type_enum,
        db=db
    )

    # Apply pagination
    paginated_offers = offers[offset:offset + limit]

    return [offer_to_response(o, db) for o in paginated_offers]


@router.put("/admin/offers/{offer_id}/activate", response_model=OfferResponse, tags=["Gap Filler"])
async def activate_offer(
    offer_id: int,
    db: Session = Depends(get_db)
):
    """
    Activate/publish a special offer.

    Makes the offer visible to guests and marks it as pushed to website.
    """
    service = get_gap_service()

    try:
        offer = service.activate_offer(offer_id, db)
        return offer_to_response(offer, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/admin/offers/{offer_id}/deactivate", response_model=OfferResponse, tags=["Gap Filler"])
async def deactivate_offer(
    offer_id: int,
    db: Session = Depends(get_db)
):
    """
    Deactivate/unpublish a special offer.

    Removes the offer from public visibility but keeps the record.
    """
    service = get_gap_service()

    try:
        offer = service.deactivate_offer(offer_id, db)
        return offer_to_response(offer, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/admin/offers/{offer_id}", tags=["Gap Filler"])
async def delete_offer(
    offer_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete/cancel a special offer.

    Removes the offer from the database. Use with caution.
    """
    offer = db.query(SpecialOffer).filter(SpecialOffer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail=f"Offer {offer_id} not found")

    # Update linked gap to remove offer reference
    gap = db.query(BookingGap).filter(BookingGap.special_offer_id == offer_id).first()
    if gap:
        gap.special_offer_id = None

    db.delete(offer)
    db.commit()

    return {"status": "deleted", "offer_id": offer_id}


@router.post("/admin/offers/{offer_id}/booked", response_model=OfferResponse, tags=["Gap Filler"])
async def mark_offer_booked(
    offer_id: int,
    request: MarkBookedRequest,
    db: Session = Depends(get_db)
):
    """
    Mark a special offer as booked.

    Updates the offer status and marks the associated gap as filled.
    """
    service = get_gap_service()

    try:
        offer = service.mark_offer_booked(offer_id, request.booking_id, db)
        return offer_to_response(offer, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# =============================================================================
# CRON/SCHEDULED ENDPOINTS
# =============================================================================

@router.post("/admin/gaps/run-daily", response_model=ScanResponse, tags=["Gap Filler"])
async def run_daily_scan(
    background_tasks: BackgroundTasks,
    run_async: bool = Query(False, description="Run in background"),
    db: Session = Depends(get_db)
):
    """
    Manually trigger the daily gap detection scan.

    This is normally run by the cron scheduler, but can be triggered
    manually for testing or immediate updates.
    """
    if run_async:
        # Run in background
        background_tasks.add_task(run_daily_gap_scan)
        return ScanResponse(
            scan_date=date.today().isoformat(),
            properties_scanned=0,
            gaps_found=0,
            gaps_saved=0,
            offers_generated=0,
            alerts_created=0,
            errors=[],
            duration_seconds=0
        )

    # Run synchronously
    try:
        result = await run_daily_gap_scan()
        return ScanResponse(**result)
    except Exception as e:
        logger.error(f"Daily scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# DISCOUNT TIER REFERENCE
# =============================================================================

@router.get("/admin/gaps/discount-tiers", tags=["Gap Filler"])
async def get_discount_tiers():
    """
    Get the discount tier configuration.

    Returns the discount percentages for different gap lengths.
    """
    return {
        "tiers": [
            {"min_nights": 3, "max_nights": 4, "discount_pct": 10, "label": "Short Stay"},
            {"min_nights": 5, "max_nights": 7, "discount_pct": 15, "label": "Week Stay"},
            {"min_nights": 8, "max_nights": 14, "discount_pct": 20, "label": "Extended Stay"},
            {"min_nights": 15, "max_nights": None, "discount_pct": 25, "label": "Long Stay"}
        ],
        "min_gap_nights": 3,
        "max_discount": 25,
        "description": "Discounts automatically calculated based on gap length"
    }
