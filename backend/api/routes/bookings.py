"""
Bookings API Routes for Right at Home BnB
CRUD operations with Airbnb/VRBO iCal synchronization
@author ECHO OMEGA PRIME
"""

import uuid
from typing import Optional, List
from datetime import datetime, date, timedelta
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Query, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from loguru import logger

from database.connection import get_db
from database.models import (
    Booking, Property, Guest, CleaningJob,
    BookingStatus, Platform, CleaningType, CleaningStatus
)
from schemas.booking import (
    BookingCreate, BookingUpdate, BookingResponse, BookingListResponse,
    BookingSearchParams, BookingCalendarEntry, BookingAvailability,
    BookingConflict, ICalSyncRequest, ICalSyncResult
)
from schemas.base import PaginatedResponse, APIResponse
from services.ical_sync import ical_sync_service, sync_property_calendar
from services.twilio_sms import twilio_sms_service
from services.smart_locks import smart_lock_service

router = APIRouter()


# ============================================
# UTILITY FUNCTIONS
# ============================================

def calculate_booking_pricing(
    nightly_rate: Decimal,
    nights: int,
    cleaning_fee: Decimal = Decimal("0"),
    platform: Platform = Platform.DIRECT
) -> dict:
    """Calculate booking pricing with platform fees."""
    subtotal = nightly_rate * nights

    # Platform service fees (approximate)
    service_fee_rates = {
        Platform.AIRBNB: Decimal("0.03"),  # 3% host fee
        Platform.VRBO: Decimal("0.05"),    # 5% host fee
        Platform.BOOKING: Decimal("0.15"), # 15% commission
        Platform.DIRECT: Decimal("0"),
        Platform.OTHER: Decimal("0.05")
    }

    service_fee = subtotal * service_fee_rates.get(platform, Decimal("0"))

    # Occupancy tax (approximate 13% for Midland, TX)
    tax_rate = Decimal("0.13")
    taxes = (subtotal + cleaning_fee) * tax_rate

    total = subtotal + cleaning_fee + taxes - service_fee

    return {
        "nightly_rate": nightly_rate,
        "total_nights": nights,
        "subtotal": subtotal,
        "cleaning_fee": cleaning_fee,
        "service_fee": service_fee,
        "taxes": taxes,
        "total_price": total
    }


def check_availability(
    db: Session,
    property_id: str,
    check_in: date,
    check_out: date,
    exclude_booking_id: str = None
) -> BookingAvailability:
    """Check if dates are available for a property."""
    query = db.query(Booking).filter(
        Booking.property_id == property_id,
        Booking.status.notin_([BookingStatus.CANCELLED]),
        or_(
            and_(Booking.check_in <= check_in, Booking.check_out > check_in),
            and_(Booking.check_in < check_out, Booking.check_out >= check_out),
            and_(Booking.check_in >= check_in, Booking.check_out <= check_out)
        )
    )

    if exclude_booking_id:
        query = query.filter(Booking.id != exclude_booking_id)

    conflicting = query.all()

    conflicts = [
        BookingConflict(
            booking_id=b.id,
            check_in=b.check_in.date() if isinstance(b.check_in, datetime) else b.check_in,
            check_out=b.check_out.date() if isinstance(b.check_out, datetime) else b.check_out,
            guest_name=b.guest.name if b.guest else None,
            platform=b.platform
        )
        for b in conflicting
    ]

    return BookingAvailability(
        property_id=property_id,
        check_in=check_in,
        check_out=check_out,
        is_available=len(conflicts) == 0,
        conflicts=conflicts
    )


async def create_cleaning_job_for_booking(
    db: Session,
    booking: Booking
) -> CleaningJob:
    """Auto-create cleaning job after checkout."""
    checkout_datetime = booking.check_out if isinstance(booking.check_out, datetime) else datetime.combine(booking.check_out, datetime.min.time().replace(hour=11))

    # Schedule cleaning 2 hours after checkout
    scheduled_time = checkout_datetime + timedelta(hours=2)

    job = CleaningJob(
        id=str(uuid.uuid4()),
        property_id=booking.property_id,
        booking_id=booking.id,
        scheduled_at=scheduled_time,
        job_type=CleaningType.TURNOVER,
        status=CleaningStatus.SCHEDULED
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return job


# ============================================
# BOOKING CRUD
# ============================================

@router.post("/", response_model=BookingResponse)
async def create_booking(
    booking_data: BookingCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create a new booking."""
    # Verify property exists
    property_obj = db.query(Property).filter(Property.id == booking_data.property_id).first()
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    # Check availability
    check_in_date = booking_data.check_in.date() if isinstance(booking_data.check_in, datetime) else booking_data.check_in
    check_out_date = booking_data.check_out.date() if isinstance(booking_data.check_out, datetime) else booking_data.check_out

    availability = check_availability(db, booking_data.property_id, check_in_date, check_out_date)
    if not availability.is_available:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Property not available for selected dates",
                "conflicts": [c.dict() for c in availability.conflicts]
            }
        )

    # Get or create guest
    guest = None
    if booking_data.guest_id:
        guest = db.query(Guest).filter(Guest.id == booking_data.guest_id).first()
        if not guest:
            raise HTTPException(status_code=404, detail="Guest not found")
    elif booking_data.guest_email:
        guest = db.query(Guest).filter(Guest.email == booking_data.guest_email).first()
        if not guest:
            # Create new guest
            guest = Guest(
                id=str(uuid.uuid4()),
                email=booking_data.guest_email,
                name=booking_data.guest_name or "Guest",
                phone=booking_data.guest_phone,
                platform=booking_data.platform,
                first_stay=datetime.utcnow()
            )
            db.add(guest)

    # Calculate nights
    nights = (check_out_date - check_in_date).days
    if nights < 1:
        raise HTTPException(status_code=400, detail="Minimum stay is 1 night")

    # Calculate pricing
    nightly_rate = booking_data.nightly_rate or property_obj.nightly_rate
    cleaning_fee = booking_data.cleaning_fee or property_obj.cleaning_fee or Decimal("0")
    pricing = calculate_booking_pricing(nightly_rate, nights, cleaning_fee, booking_data.platform)

    # Generate access code
    access_code = smart_lock_service.generate_access_code()
    code_start = datetime.combine(check_in_date, datetime.min.time().replace(hour=15))  # 3 PM check-in
    code_end = datetime.combine(check_out_date, datetime.min.time().replace(hour=11))   # 11 AM checkout

    # Create booking
    booking = Booking(
        id=str(uuid.uuid4()),
        property_id=booking_data.property_id,
        guest_id=guest.id if guest else None,
        check_in=datetime.combine(check_in_date, datetime.min.time().replace(hour=15)),
        check_out=datetime.combine(check_out_date, datetime.min.time().replace(hour=11)),
        guest_count=booking_data.guest_count,
        platform=booking_data.platform,
        confirm_code=booking_data.confirmation_code or f"RAH{datetime.now().strftime('%Y%m%d%H%M%S')}",
        nightly_rate=nightly_rate,
        total_nights=nights,
        subtotal=pricing["subtotal"],
        cleaning_fee=pricing["cleaning_fee"],
        service_fee=pricing["service_fee"],
        taxes=pricing["taxes"],
        total_price=pricing["total_price"],
        access_code=access_code,
        code_expires_at=code_end,
        status=BookingStatus.CONFIRMED,
        special_reqs=booking_data.special_requests,
        internal_notes=booking_data.internal_notes
    )
    db.add(booking)

    # Update guest stats
    if guest:
        guest.total_stays = (guest.total_stays or 0) + 1
        guest.total_spent = (guest.total_spent or Decimal("0")) + pricing["total_price"]
        guest.last_stay = booking.check_out

    db.commit()
    db.refresh(booking)

    # Background tasks
    background_tasks.add_task(create_cleaning_job_for_booking, db, booking)

    # Send booking confirmation SMS
    if guest and guest.phone:
        background_tasks.add_task(
            twilio_sms_service.send_booking_confirmation,
            guest.phone, guest.name, property_obj.name,
            booking.check_in, booking.check_out, booking.id
        )

    logger.info(f"Booking created: {booking.id} at {property_obj.name}")

    return BookingResponse(
        id=booking.id,
        property_id=booking.property_id,
        property_name=property_obj.name,
        guest_id=booking.guest_id,
        guest_name=guest.name if guest else None,
        guest_email=guest.email if guest else None,
        guest_phone=guest.phone if guest else None,
        check_in=booking.check_in,
        check_out=booking.check_out,
        nights=nights,
        guest_count=booking.guest_count,
        platform=booking.platform,
        confirmation_code=booking.confirm_code,
        nightly_rate=booking.nightly_rate,
        subtotal=booking.subtotal,
        cleaning_fee=booking.cleaning_fee,
        service_fee=booking.service_fee,
        taxes=booking.taxes,
        total_price=booking.total_price,
        access_code=booking.access_code,
        code_expires_at=booking.code_expires_at,
        status=booking.status,
        special_requests=booking.special_reqs,
        created_at=booking.created_at,
        updated_at=booking.updated_at
    )


@router.get("/", response_model=PaginatedResponse)
async def list_bookings(
    property_id: Optional[str] = None,
    guest_id: Optional[str] = None,
    status: Optional[BookingStatus] = None,
    platform: Optional[Platform] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    upcoming_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """List bookings with filters."""
    query = db.query(Booking).join(Property).outerjoin(Guest)

    # Apply filters
    if property_id:
        query = query.filter(Booking.property_id == property_id)
    if guest_id:
        query = query.filter(Booking.guest_id == guest_id)
    if status:
        query = query.filter(Booking.status == status)
    if platform:
        query = query.filter(Booking.platform == platform)
    if date_from:
        query = query.filter(Booking.check_in >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Booking.check_out <= datetime.combine(date_to, datetime.max.time()))
    if upcoming_only:
        query = query.filter(Booking.check_in >= datetime.utcnow())

    # Get total count
    total = query.count()

    # Paginate
    bookings = query.order_by(Booking.check_in.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = [
        BookingListResponse(
            id=b.id,
            property_id=b.property_id,
            property_name=b.property.name,
            guest_name=b.guest.name if b.guest else "Unknown",
            check_in=b.check_in,
            check_out=b.check_out,
            nights=b.total_nights,
            guest_count=b.guest_count,
            platform=b.platform,
            status=b.status,
            total_price=b.total_price
        )
        for b in bookings
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@router.get("/calendar")
async def get_bookings_calendar(
    property_id: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get calendar view of bookings."""
    today = date.today()
    year = year or today.year
    month = month or today.month

    # Calculate date range
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    query = db.query(Booking).filter(
        Booking.status.notin_([BookingStatus.CANCELLED]),
        or_(
            and_(func.date(Booking.check_in) >= start_date, func.date(Booking.check_in) < end_date),
            and_(func.date(Booking.check_out) >= start_date, func.date(Booking.check_out) < end_date),
            and_(func.date(Booking.check_in) < start_date, func.date(Booking.check_out) >= end_date)
        )
    )

    if property_id:
        query = query.filter(Booking.property_id == property_id)

    bookings = query.all()

    calendar_entries = [
        BookingCalendarEntry(
            booking_id=b.id,
            property_id=b.property_id,
            property_name=b.property.name if b.property else "",
            guest_name=b.guest.name if b.guest else "Guest",
            check_in=b.check_in.date() if isinstance(b.check_in, datetime) else b.check_in,
            check_out=b.check_out.date() if isinstance(b.check_out, datetime) else b.check_out,
            status=b.status,
            platform=b.platform,
            color=_get_platform_color(b.platform)
        )
        for b in bookings
    ]

    return {
        "year": year,
        "month": month,
        "entries": calendar_entries,
        "total_bookings": len(calendar_entries)
    }


def _get_platform_color(platform: Platform) -> str:
    """Get color for platform in calendar."""
    colors = {
        Platform.AIRBNB: "#FF5A5F",
        Platform.VRBO: "#3D7EDB",
        Platform.BOOKING: "#003580",
        Platform.DIRECT: "#28A745",
        Platform.OTHER: "#6C757D"
    }
    return colors.get(platform, "#6C757D")


@router.get("/availability")
async def check_dates_availability(
    property_id: str,
    check_in: date,
    check_out: date,
    db: Session = Depends(get_db)
):
    """Check if dates are available."""
    availability = check_availability(db, property_id, check_in, check_out)
    return availability


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(booking_id: str, db: Session = Depends(get_db)):
    """Get booking details."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    nights = booking.total_nights or (booking.check_out - booking.check_in).days

    return BookingResponse(
        id=booking.id,
        property_id=booking.property_id,
        property_name=booking.property.name if booking.property else None,
        guest_id=booking.guest_id,
        guest_name=booking.guest.name if booking.guest else None,
        guest_email=booking.guest.email if booking.guest else None,
        guest_phone=booking.guest.phone if booking.guest else None,
        check_in=booking.check_in,
        check_out=booking.check_out,
        nights=nights,
        guest_count=booking.guest_count,
        platform=booking.platform,
        confirmation_code=booking.confirm_code,
        nightly_rate=booking.nightly_rate,
        subtotal=booking.subtotal,
        cleaning_fee=booking.cleaning_fee,
        service_fee=booking.service_fee,
        taxes=booking.taxes,
        total_price=booking.total_price,
        access_code=booking.access_code,
        code_expires_at=booking.code_expires_at,
        status=booking.status,
        special_requests=booking.special_reqs,
        internal_notes=booking.internal_notes,
        created_at=booking.created_at,
        updated_at=booking.updated_at
    )


@router.put("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: str,
    update_data: BookingUpdate,
    db: Session = Depends(get_db)
):
    """Update booking details."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check if dates are being changed
    if update_data.check_in or update_data.check_out:
        new_check_in = update_data.check_in or booking.check_in
        new_check_out = update_data.check_out or booking.check_out

        check_in_date = new_check_in.date() if isinstance(new_check_in, datetime) else new_check_in
        check_out_date = new_check_out.date() if isinstance(new_check_out, datetime) else new_check_out

        availability = check_availability(
            db, booking.property_id, check_in_date, check_out_date,
            exclude_booking_id=booking_id
        )
        if not availability.is_available:
            raise HTTPException(
                status_code=409,
                detail="New dates conflict with existing bookings"
            )

        booking.check_in = new_check_in if isinstance(new_check_in, datetime) else datetime.combine(new_check_in, datetime.min.time().replace(hour=15))
        booking.check_out = new_check_out if isinstance(new_check_out, datetime) else datetime.combine(new_check_out, datetime.min.time().replace(hour=11))
        booking.total_nights = (check_out_date - check_in_date).days

    # Update other fields
    update_fields = update_data.dict(exclude_unset=True, exclude={"check_in", "check_out"})
    for field, value in update_fields.items():
        if hasattr(booking, field) and value is not None:
            setattr(booking, field, value)

    db.commit()
    db.refresh(booking)

    return await get_booking(booking_id, db)


@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    reason: Optional[str] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """Cancel a booking."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Booking already cancelled")

    booking.status = BookingStatus.CANCELLED
    if reason:
        booking.internal_notes = (booking.internal_notes or "") + f"\n[Cancelled: {reason}]"

    # Cancel associated cleaning job
    if booking.cleaning_job:
        booking.cleaning_job.status = CleaningStatus.CANCELLED

    # Revoke access code
    if booking.access_code and booking.property and booking.property.smart_lock:
        background_tasks.add_task(
            smart_lock_service.revoke_access_code,
            booking.property.smart_lock.id,
            booking.access_code
        )

    db.commit()

    logger.info(f"Booking cancelled: {booking_id}")

    return {
        "success": True,
        "booking_id": booking_id,
        "status": "CANCELLED",
        "message": f"Booking cancelled. Reason: {reason}" if reason else "Booking cancelled."
    }


@router.post("/{booking_id}/check-in")
async def guest_check_in(
    booking_id: str,
    db: Session = Depends(get_db)
):
    """Mark guest as checked in."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status != BookingStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail=f"Cannot check in - booking status is {booking.status.value}")

    booking.status = BookingStatus.CHECKED_IN
    db.commit()

    return {
        "success": True,
        "booking_id": booking_id,
        "status": "CHECKED_IN",
        "check_in_time": datetime.utcnow().isoformat()
    }


@router.post("/{booking_id}/check-out")
async def guest_check_out(
    booking_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Mark guest as checked out."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.status = BookingStatus.CHECKED_OUT
    db.commit()

    # Trigger review request SMS after delay
    if booking.guest and booking.guest.phone:
        background_tasks.add_task(
            twilio_sms_service.send_review_request,
            booking.guest.phone, booking.guest.name,
            booking.property.name if booking.property else "the property",
            booking.platform.value if booking.platform else "the platform",
            booking.id
        )

    return {
        "success": True,
        "booking_id": booking_id,
        "status": "CHECKED_OUT",
        "check_out_time": datetime.utcnow().isoformat()
    }


# ============================================
# ICAL SYNC
# ============================================

@router.post("/sync/ical", response_model=ICalSyncResult)
async def sync_ical_calendar(
    sync_request: ICalSyncRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Sync bookings from Airbnb/VRBO iCal feed."""
    # Verify property exists
    property_obj = db.query(Property).filter(Property.id == sync_request.property_id).first()
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    # Perform sync
    result = await ical_sync_service.sync_calendar(
        property_id=sync_request.property_id,
        ical_url=sync_request.ical_url,
        source_hint=sync_request.source,
        auto_confirm=sync_request.auto_confirm
    )

    logger.info(f"iCal sync for {property_obj.name}: {result.events_found} events found")

    return result


@router.post("/sync/property/{property_id}")
async def sync_property_calendars(
    property_id: str,
    db: Session = Depends(get_db)
):
    """Sync all calendars for a property (Airbnb + VRBO)."""
    property_obj = db.query(Property).filter(Property.id == property_id).first()
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    results = []

    # Sync Airbnb if URL exists
    # In production, these URLs would be stored in the property record
    airbnb_url = getattr(property_obj, 'airbnb_ical_url', None)
    vrbo_url = getattr(property_obj, 'vrbo_ical_url', None)

    if airbnb_url:
        result = await ical_sync_service.sync_calendar(
            property_id=property_id,
            ical_url=airbnb_url,
            source_hint="airbnb"
        )
        results.append({"source": "airbnb", "result": result})

    if vrbo_url:
        result = await ical_sync_service.sync_calendar(
            property_id=property_id,
            ical_url=vrbo_url,
            source_hint="vrbo"
        )
        results.append({"source": "vrbo", "result": result})

    return {
        "property_id": property_id,
        "property_name": property_obj.name,
        "syncs_performed": len(results),
        "results": results
    }


@router.get("/export/ical/{property_id}")
async def export_property_ical(
    property_id: str,
    db: Session = Depends(get_db)
):
    """Export property bookings as iCal feed."""
    from fastapi.responses import Response

    property_obj = db.query(Property).filter(Property.id == property_id).first()
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    # Get upcoming bookings
    bookings = db.query(Booking).filter(
        Booking.property_id == property_id,
        Booking.status.notin_([BookingStatus.CANCELLED]),
        Booking.check_out >= datetime.utcnow()
    ).all()

    booking_dicts = [
        {
            "id": b.id,
            "guest_name": b.guest.name if b.guest else "Reserved",
            "check_in": b.check_in.isoformat() if b.check_in else None,
            "check_out": b.check_out.isoformat() if b.check_out else None,
            "guest_count": b.guest_count,
            "confirmation_code": b.confirm_code,
            "status": b.status.value if b.status else "CONFIRMED"
        }
        for b in bookings
    ]

    ical_content = ical_sync_service.generate_export_ical(
        property_name=property_obj.name,
        bookings=booking_dicts
    )

    return Response(
        content=ical_content,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'attachment; filename="{property_obj.name.replace(" ", "_")}_calendar.ics"'
        }
    )


# ============================================
# STATISTICS
# ============================================

@router.get("/stats/summary")
async def get_booking_stats(
    property_id: Optional[str] = None,
    period: str = Query("month", regex="^(week|month|quarter|year)$"),
    db: Session = Depends(get_db)
):
    """Get booking statistics."""
    today = date.today()

    # Calculate date range
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    elif period == "quarter":
        start_date = today - timedelta(days=90)
    else:  # year
        start_date = today - timedelta(days=365)

    query = db.query(Booking).filter(
        Booking.check_in >= datetime.combine(start_date, datetime.min.time())
    )

    if property_id:
        query = query.filter(Booking.property_id == property_id)

    bookings = query.all()

    total_bookings = len(bookings)
    confirmed = len([b for b in bookings if b.status == BookingStatus.CONFIRMED])
    completed = len([b for b in bookings if b.status == BookingStatus.CHECKED_OUT])
    cancelled = len([b for b in bookings if b.status == BookingStatus.CANCELLED])

    total_revenue = sum(float(b.total_price or 0) for b in bookings if b.status != BookingStatus.CANCELLED)
    total_nights = sum(b.total_nights or 0 for b in bookings if b.status != BookingStatus.CANCELLED)
    avg_stay_length = total_nights / total_bookings if total_bookings > 0 else 0

    platform_breakdown = {}
    for b in bookings:
        platform = b.platform.value if b.platform else "UNKNOWN"
        platform_breakdown[platform] = platform_breakdown.get(platform, 0) + 1

    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": today.isoformat(),
        "total_bookings": total_bookings,
        "confirmed": confirmed,
        "completed": completed,
        "cancelled": cancelled,
        "cancellation_rate": cancelled / total_bookings if total_bookings > 0 else 0,
        "total_revenue": round(total_revenue, 2),
        "total_nights": total_nights,
        "avg_stay_length": round(avg_stay_length, 1),
        "platform_breakdown": platform_breakdown
    }
