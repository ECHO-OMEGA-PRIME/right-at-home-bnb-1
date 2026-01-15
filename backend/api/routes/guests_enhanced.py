"""
Enhanced Guest CRM API Routes for Right at Home BnB
Full database integration with VIP tracking and history
@author ECHO OMEGA PRIME
"""

import uuid
from typing import Optional, List
from datetime import datetime, date, timedelta
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Query, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from loguru import logger

from database.connection import get_db
from database.models import Guest, Booking, Property, Message, ConciergeQuery, Platform, VipTier, BookingStatus
from schemas.guest import (
    GuestCreate, GuestUpdate, GuestResponse, GuestListResponse,
    GuestSearchParams, GuestStatsResponse, GuestHistory, GuestDossier,
    GuestPreferences, GuestStaySummary, GuestReviewSummary
)
from schemas.base import PaginatedResponse, APIResponse

router = APIRouter()


# ============================================
# UTILITY FUNCTIONS
# ============================================

def calculate_vip_tier(guest: Guest) -> Optional[VipTier]:
    """Determine VIP tier based on stays and spending."""
    stays = guest.total_stays or 0
    spent = float(guest.total_spent or 0)

    if stays >= 10 or spent >= 10000:
        return VipTier.DIAMOND
    elif stays >= 6 or spent >= 5000:
        return VipTier.PLATINUM
    elif stays >= 4 or spent >= 2500:
        return VipTier.GOLD
    elif stays >= 2 or spent >= 1000:
        return VipTier.SILVER
    return None


def update_guest_vip_status(guest: Guest) -> bool:
    """Update guest VIP status based on history."""
    new_tier = calculate_vip_tier(guest)

    if new_tier:
        guest.is_vip = True
        guest.vip_tier = new_tier
        return True
    else:
        guest.is_vip = False
        guest.vip_tier = None
        return False


# ============================================
# GUEST CRUD
# ============================================

@router.post("/", response_model=GuestResponse)
async def create_guest(
    guest_data: GuestCreate,
    db: Session = Depends(get_db)
):
    """Create a new guest profile."""
    # Check for duplicate email
    existing = db.query(Guest).filter(Guest.email == guest_data.email).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Guest with email {guest_data.email} already exists"
        )

    guest = Guest(
        id=str(uuid.uuid4()),
        email=guest_data.email,
        name=guest_data.name,
        phone=guest_data.phone,
        platform=guest_data.platform,
        platform_id=guest_data.platform_id,
        tags=guest_data.tags or [],
        notes=guest_data.notes,
        preferences=guest_data.preferences.dict() if guest_data.preferences else None,
        birthday=guest_data.birthday,
        anniversary=guest_data.anniversary,
        total_stays=0,
        total_spent=Decimal("0")
    )

    db.add(guest)
    db.commit()
    db.refresh(guest)

    logger.info(f"Guest created: {guest.name} ({guest.email})")

    return _build_guest_response(guest)


@router.get("/", response_model=PaginatedResponse)
async def list_guests(
    vip_only: bool = False,
    repeat_only: bool = False,
    platform: Optional[Platform] = None,
    q: Optional[str] = None,
    tag: Optional[str] = None,
    min_stays: Optional[int] = None,
    sort_by: str = Query("last_stay", regex="^(name|last_stay|total_stays|total_spent|created_at)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """List guests with filtering and pagination."""
    query = db.query(Guest)

    # Apply filters
    if vip_only:
        query = query.filter(Guest.is_vip == True)
    if repeat_only:
        query = query.filter(Guest.total_stays >= 2)
    if platform:
        query = query.filter(Guest.platform == platform)
    if min_stays:
        query = query.filter(Guest.total_stays >= min_stays)
    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                Guest.name.ilike(search),
                Guest.email.ilike(search),
                Guest.phone.ilike(search)
            )
        )
    if tag:
        query = query.filter(Guest.tags.contains([tag]))

    # Get total count
    total = query.count()

    # Apply sorting
    sort_column = getattr(Guest, sort_by, Guest.last_stay)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc().nullslast())
    else:
        query = query.order_by(sort_column.asc().nullsfirst())

    # Paginate
    guests = query.offset((page - 1) * page_size).limit(page_size).all()

    items = [
        GuestListResponse(
            id=g.id,
            name=g.name,
            email=g.email,
            phone=g.phone,
            platform=g.platform,
            total_stays=g.total_stays or 0,
            total_spent=g.total_spent or Decimal("0"),
            is_vip=g.is_vip,
            vip_tier=g.vip_tier,
            tags=g.tags or [],
            first_stay=g.first_stay,
            last_stay=g.last_stay,
            avg_rating=g.avg_rating
        )
        for g in guests
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@router.get("/stats", response_model=GuestStatsResponse)
async def get_guest_stats(db: Session = Depends(get_db)):
    """Get overall guest CRM statistics."""
    total_guests = db.query(Guest).count()
    vip_guests = db.query(Guest).filter(Guest.is_vip == True).count()
    repeat_guests = db.query(Guest).filter(Guest.total_stays >= 2).count()

    # Platform breakdown
    platform_stats = db.query(
        Guest.platform,
        func.count(Guest.id)
    ).group_by(Guest.platform).all()

    by_platform = {
        (p.value if p else "UNKNOWN"): count
        for p, count in platform_stats
    }

    # VIP tier breakdown
    tier_stats = db.query(
        Guest.vip_tier,
        func.count(Guest.id)
    ).filter(Guest.is_vip == True).group_by(Guest.vip_tier).all()

    by_vip_tier = {
        (t.value if t else "NONE"): count
        for t, count in tier_stats
    }

    # Averages
    avg_result = db.query(
        func.avg(Guest.total_stays),
        func.avg(Guest.total_spent),
        func.avg(Guest.avg_rating)
    ).first()

    # Recent guests
    recent_new = db.query(Guest).filter(
        Guest.created_at >= datetime.utcnow() - timedelta(days=30)
    ).count()

    return GuestStatsResponse(
        total_guests=total_guests,
        vip_guests=vip_guests,
        repeat_guests=repeat_guests,
        repeat_rate=repeat_guests / total_guests if total_guests > 0 else 0,
        avg_stays_per_guest=round(avg_result[0] or 0, 1),
        avg_lifetime_value=round(float(avg_result[1] or 0), 2),
        avg_guest_rating=round(avg_result[2] or 0, 2),
        by_platform=by_platform,
        by_vip_tier=by_vip_tier,
        new_guests_this_month=recent_new
    )


@router.get("/vip", response_model=List[GuestListResponse])
async def list_vip_guests(
    tier: Optional[VipTier] = None,
    db: Session = Depends(get_db)
):
    """List all VIP guests."""
    query = db.query(Guest).filter(Guest.is_vip == True)

    if tier:
        query = query.filter(Guest.vip_tier == tier)

    guests = query.order_by(Guest.total_spent.desc()).all()

    return [
        GuestListResponse(
            id=g.id,
            name=g.name,
            email=g.email,
            phone=g.phone,
            platform=g.platform,
            total_stays=g.total_stays or 0,
            total_spent=g.total_spent or Decimal("0"),
            is_vip=g.is_vip,
            vip_tier=g.vip_tier,
            tags=g.tags or [],
            first_stay=g.first_stay,
            last_stay=g.last_stay,
            avg_rating=g.avg_rating
        )
        for g in guests
    ]


@router.get("/search")
async def search_guests(
    q: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Quick search for guests by name, email, or phone."""
    search = f"%{q}%"
    guests = db.query(Guest).filter(
        or_(
            Guest.name.ilike(search),
            Guest.email.ilike(search),
            Guest.phone.ilike(search)
        )
    ).limit(limit).all()

    return [
        {
            "id": g.id,
            "name": g.name,
            "email": g.email,
            "phone": g.phone,
            "is_vip": g.is_vip,
            "total_stays": g.total_stays
        }
        for g in guests
    ]


@router.get("/{guest_id}", response_model=GuestResponse)
async def get_guest(guest_id: str, db: Session = Depends(get_db)):
    """Get full guest profile."""
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    return _build_guest_response(guest)


@router.get("/{guest_id}/dossier", response_model=GuestDossier)
async def get_guest_dossier(guest_id: str, db: Session = Depends(get_db)):
    """Get comprehensive guest dossier with full history."""
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    # Get all bookings
    bookings = db.query(Booking).filter(
        Booking.guest_id == guest_id
    ).order_by(Booking.check_in.desc()).all()

    stay_history = [
        GuestStaySummary(
            booking_id=b.id,
            property_id=b.property_id,
            property_name=b.property.name if b.property else "Unknown",
            check_in=b.check_in,
            check_out=b.check_out,
            nights=b.total_nights or 0,
            total_paid=b.total_price,
            platform=b.platform,
            status=b.status
        )
        for b in bookings
    ]

    # Get messages
    messages = db.query(Message).filter(
        Message.guest_id == guest_id
    ).order_by(Message.created_at.desc()).limit(20).all()

    message_history = [
        {
            "id": m.id,
            "type": m.type.value if m.type else None,
            "channel": m.channel.value if m.channel else None,
            "subject": m.subject,
            "sent_at": m.sent_at,
            "sentiment": m.sentiment.value if m.sentiment else None
        }
        for m in messages
    ]

    # Get concierge queries
    queries = db.query(ConciergeQuery).filter(
        ConciergeQuery.guest_id == guest_id
    ).order_by(ConciergeQuery.created_at.desc()).limit(10).all()

    concierge_history = [
        {
            "id": q.id,
            "query": q.query[:100] + "..." if len(q.query) > 100 else q.query,
            "category": q.category.value if q.category else None,
            "was_helpful": q.was_helpful,
            "created_at": q.created_at
        }
        for q in queries
    ]

    # Calculate insights
    properties_stayed = list(set(b.property_id for b in bookings))
    favorite_property = None
    if bookings:
        property_counts = {}
        for b in bookings:
            property_counts[b.property_id] = property_counts.get(b.property_id, 0) + 1
        favorite_id = max(property_counts, key=property_counts.get)
        favorite_property = db.query(Property).filter(Property.id == favorite_id).first()

    avg_stay_length = (
        sum(b.total_nights or 0 for b in bookings) / len(bookings)
        if bookings else 0
    )

    return GuestDossier(
        id=guest.id,
        name=guest.name,
        email=guest.email,
        phone=guest.phone,
        platform=guest.platform,
        is_vip=guest.is_vip,
        vip_tier=guest.vip_tier,
        tags=guest.tags or [],
        preferences=GuestPreferences(**guest.preferences) if guest.preferences else None,
        notes=guest.notes,
        birthday=guest.birthday,
        anniversary=guest.anniversary,
        first_stay=guest.first_stay,
        last_stay=guest.last_stay,
        total_stays=guest.total_stays or 0,
        total_spent=guest.total_spent or Decimal("0"),
        avg_rating=guest.avg_rating,
        stay_history=stay_history,
        message_history=message_history,
        concierge_history=concierge_history,
        properties_stayed=properties_stayed,
        favorite_property=favorite_property.name if favorite_property else None,
        avg_stay_length=round(avg_stay_length, 1),
        created_at=guest.created_at,
        updated_at=guest.updated_at
    )


@router.get("/{guest_id}/stays", response_model=List[GuestStaySummary])
async def get_guest_stays(
    guest_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get guest's stay history."""
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    bookings = db.query(Booking).filter(
        Booking.guest_id == guest_id
    ).order_by(Booking.check_in.desc()).limit(limit).all()

    return [
        GuestStaySummary(
            booking_id=b.id,
            property_id=b.property_id,
            property_name=b.property.name if b.property else "Unknown",
            check_in=b.check_in,
            check_out=b.check_out,
            nights=b.total_nights or 0,
            total_paid=b.total_price,
            platform=b.platform,
            status=b.status
        )
        for b in bookings
    ]


@router.put("/{guest_id}", response_model=GuestResponse)
async def update_guest(
    guest_id: str,
    update_data: GuestUpdate,
    db: Session = Depends(get_db)
):
    """Update guest profile."""
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    # Update fields
    update_dict = update_data.dict(exclude_unset=True)

    # Handle preferences separately
    if "preferences" in update_dict and update_dict["preferences"]:
        existing_prefs = guest.preferences or {}
        existing_prefs.update(update_dict["preferences"])
        guest.preferences = existing_prefs
        del update_dict["preferences"]

    for field, value in update_dict.items():
        if hasattr(guest, field) and value is not None:
            setattr(guest, field, value)

    # Recalculate VIP status
    update_guest_vip_status(guest)

    db.commit()
    db.refresh(guest)

    return _build_guest_response(guest)


@router.post("/{guest_id}/tags")
async def add_guest_tag(
    guest_id: str,
    tag: str = Query(..., min_length=1, max_length=50),
    db: Session = Depends(get_db)
):
    """Add a tag to guest profile."""
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    tags = guest.tags or []
    if tag not in tags:
        tags.append(tag)
        guest.tags = tags
        db.commit()

    return {"success": True, "tags": guest.tags}


@router.delete("/{guest_id}/tags/{tag}")
async def remove_guest_tag(
    guest_id: str,
    tag: str,
    db: Session = Depends(get_db)
):
    """Remove a tag from guest profile."""
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    tags = guest.tags or []
    if tag in tags:
        tags.remove(tag)
        guest.tags = tags
        db.commit()

    return {"success": True, "tags": guest.tags}


@router.put("/{guest_id}/vip")
async def set_vip_status(
    guest_id: str,
    is_vip: bool,
    tier: Optional[VipTier] = None,
    db: Session = Depends(get_db)
):
    """Manually set VIP status."""
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    guest.is_vip = is_vip
    if is_vip and tier:
        guest.vip_tier = tier
    elif not is_vip:
        guest.vip_tier = None

    db.commit()

    return {
        "success": True,
        "guest_id": guest_id,
        "is_vip": guest.is_vip,
        "vip_tier": guest.vip_tier.value if guest.vip_tier else None
    }


@router.post("/{guest_id}/merge/{other_guest_id}")
async def merge_guests(
    guest_id: str,
    other_guest_id: str,
    db: Session = Depends(get_db)
):
    """Merge two guest profiles (keeps primary, transfers data from secondary)."""
    primary = db.query(Guest).filter(Guest.id == guest_id).first()
    secondary = db.query(Guest).filter(Guest.id == other_guest_id).first()

    if not primary or not secondary:
        raise HTTPException(status_code=404, detail="One or both guests not found")

    if primary.id == secondary.id:
        raise HTTPException(status_code=400, detail="Cannot merge guest with itself")

    # Transfer bookings
    db.query(Booking).filter(Booking.guest_id == secondary.id).update(
        {"guest_id": primary.id}
    )

    # Transfer messages
    db.query(Message).filter(Message.guest_id == secondary.id).update(
        {"guest_id": primary.id}
    )

    # Transfer concierge queries
    db.query(ConciergeQuery).filter(ConciergeQuery.guest_id == secondary.id).update(
        {"guest_id": primary.id}
    )

    # Merge stats
    primary.total_stays = (primary.total_stays or 0) + (secondary.total_stays or 0)
    primary.total_spent = (primary.total_spent or Decimal("0")) + (secondary.total_spent or Decimal("0"))

    # Merge tags
    primary_tags = set(primary.tags or [])
    secondary_tags = set(secondary.tags or [])
    primary.tags = list(primary_tags.union(secondary_tags))

    # Keep earliest first_stay
    if secondary.first_stay and (not primary.first_stay or secondary.first_stay < primary.first_stay):
        primary.first_stay = secondary.first_stay

    # Keep latest last_stay
    if secondary.last_stay and (not primary.last_stay or secondary.last_stay > primary.last_stay):
        primary.last_stay = secondary.last_stay

    # Append notes
    if secondary.notes:
        primary.notes = (primary.notes or "") + f"\n[Merged from {secondary.email}]: {secondary.notes}"

    # Recalculate VIP
    update_guest_vip_status(primary)

    # Delete secondary
    db.delete(secondary)
    db.commit()

    logger.info(f"Merged guest {secondary.email} into {primary.email}")

    return {
        "success": True,
        "primary_guest_id": primary.id,
        "merged_guest_email": secondary.email,
        "new_total_stays": primary.total_stays,
        "new_total_spent": float(primary.total_spent)
    }


@router.delete("/{guest_id}")
async def delete_guest(
    guest_id: str,
    db: Session = Depends(get_db)
):
    """Delete guest profile (anonymizes bookings)."""
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    # Check for active bookings
    active_bookings = db.query(Booking).filter(
        Booking.guest_id == guest_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN])
    ).count()

    if active_bookings > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete guest with {active_bookings} active booking(s)"
        )

    # Anonymize historical bookings
    db.query(Booking).filter(Booking.guest_id == guest_id).update({
        "guest_id": None
    })

    # Delete messages and queries
    db.query(Message).filter(Message.guest_id == guest_id).delete()
    db.query(ConciergeQuery).filter(ConciergeQuery.guest_id == guest_id).delete()

    # Delete guest
    db.delete(guest)
    db.commit()

    logger.info(f"Deleted guest: {guest.email}")

    return {"success": True, "message": f"Guest {guest.email} deleted"}


# ============================================
# HELPER FUNCTIONS
# ============================================

def _build_guest_response(guest: Guest) -> GuestResponse:
    """Build GuestResponse from database model."""
    return GuestResponse(
        id=guest.id,
        email=guest.email,
        name=guest.name,
        phone=guest.phone,
        platform=guest.platform,
        platform_id=guest.platform_id,
        first_stay=guest.first_stay,
        last_stay=guest.last_stay,
        total_stays=guest.total_stays or 0,
        total_spent=guest.total_spent or Decimal("0"),
        avg_rating=guest.avg_rating,
        tags=guest.tags or [],
        notes=guest.notes,
        preferences=GuestPreferences(**guest.preferences) if guest.preferences else None,
        is_vip=guest.is_vip,
        vip_tier=guest.vip_tier,
        birthday=guest.birthday,
        anniversary=guest.anniversary,
        created_at=guest.created_at,
        updated_at=guest.updated_at
    )
