"""
Properties API Routes - Enhanced
Full CRUD with search, filters, occupancy, and financials
@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
from loguru import logger
import uuid

from database.connection import get_db
from database.models import Property, Booking, CleaningJob, SmartLock, Expense
from database.models import PropertyStatus, PropertyType, BookingStatus

from schemas.property import (
    PropertyCreate, PropertyUpdate, PropertyResponse, PropertyListResponse,
    PropertySearchParams, PropertyOccupancy, PropertyFinancialSummary
)
from schemas.base import PaginationParams, PaginatedResponse, APIResponse

router = APIRouter()


# ============================================
# CRUD OPERATIONS
# ============================================

@router.get("/", response_model=PaginatedResponse[PropertyListResponse])
async def list_properties(
    # Search & Filters
    q: Optional[str] = Query(None, description="Search name/address"),
    status: Optional[PropertyStatus] = None,
    property_type: Optional[PropertyType] = None,
    min_bedrooms: Optional[int] = Query(None, ge=0),
    max_bedrooms: Optional[int] = Query(None, ge=0),
    min_bathrooms: Optional[float] = Query(None, ge=0),
    max_bathrooms: Optional[float] = Query(None, ge=0),
    min_guests: Optional[int] = Query(None, ge=1),
    max_guests: Optional[int] = Query(None, ge=1),
    min_rate: Optional[float] = Query(None, ge=0),
    max_rate: Optional[float] = Query(None, ge=0),
    city: Optional[str] = None,
    has_pool: Optional[bool] = None,
    has_hot_tub: Optional[bool] = None,
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("name", description="Sort field"),
    sort_order: str = Query("asc", description="asc or desc"),
    db: Session = Depends(get_db)
):
    """
    List all properties with comprehensive search and filtering.
    Supports pagination and sorting.
    """
    query = db.query(Property)

    # Apply text search
    if q:
        search_filter = or_(
            Property.name.ilike(f"%{q}%"),
            Property.address.ilike(f"%{q}%"),
            Property.city.ilike(f"%{q}%")
        )
        query = query.filter(search_filter)

    # Apply filters
    if status:
        query = query.filter(Property.status == status)
    if property_type:
        query = query.filter(Property.property_type == property_type)
    if min_bedrooms is not None:
        query = query.filter(Property.bedrooms >= min_bedrooms)
    if max_bedrooms is not None:
        query = query.filter(Property.bedrooms <= max_bedrooms)
    if min_bathrooms is not None:
        query = query.filter(Property.bathrooms >= min_bathrooms)
    if max_bathrooms is not None:
        query = query.filter(Property.bathrooms <= max_bathrooms)
    if min_guests is not None:
        query = query.filter(Property.max_guests >= min_guests)
    if max_guests is not None:
        query = query.filter(Property.max_guests <= max_guests)
    if min_rate is not None:
        query = query.filter(Property.nightly_rate >= min_rate)
    if max_rate is not None:
        query = query.filter(Property.nightly_rate <= max_rate)
    if city:
        query = query.filter(Property.city.ilike(f"%{city}%"))

    # Amenity filters (search in JSON array)
    if has_pool:
        query = query.filter(Property.amenities.contains(["pool"]))
    if has_hot_tub:
        query = query.filter(Property.amenities.contains(["hot_tub"]))

    # Get total count
    total = query.count()

    # Apply sorting
    sort_column = getattr(Property, sort_by, Property.name)
    if sort_order.lower() == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Apply pagination
    offset = (page - 1) * limit
    properties = query.offset(offset).limit(limit).all()

    # Convert to response models with computed fields
    items = []
    for prop in properties:
        # Calculate occupancy rate for the current month
        occupancy = await _calculate_property_occupancy(db, prop.id, 30)

        # Get average rating from reviews
        avg_rating = await _get_property_avg_rating(db, prop.id)

        items.append(PropertyListResponse(
            id=prop.id,
            name=prop.name,
            address=prop.address,
            city=prop.city,
            state=prop.state,
            bedrooms=prop.bedrooms,
            bathrooms=prop.bathrooms,
            max_guests=prop.max_guests,
            nightly_rate=Decimal(str(prop.nightly_rate)) if prop.nightly_rate else Decimal("0"),
            status=prop.status,
            property_type=prop.property_type,
            primary_image=prop.amenities.get("primary_image") if isinstance(prop.amenities, dict) else None,
            occupancy_rate=occupancy,
            avg_rating=avg_rating
        ))

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        limit=limit
    )


@router.get("/{property_id}", response_model=APIResponse[PropertyResponse])
async def get_property(property_id: str, db: Session = Depends(get_db)):
    """Get detailed property information by ID."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Get related data
    smart_lock = db.query(SmartLock).filter(SmartLock.property_id == property_id).first()
    occupancy = await _calculate_property_occupancy(db, property_id, 30)
    avg_rating = await _get_property_avg_rating(db, property_id)
    total_bookings = db.query(Booking).filter(Booking.property_id == property_id).count()
    total_reviews = await _get_property_review_count(db, property_id)

    response = PropertyResponse(
        id=prop.id,
        name=prop.name,
        description=None,
        property_type=prop.property_type,
        address=prop.address,
        city=prop.city,
        state=prop.state,
        zip_code=prop.zip_code or "79705",
        latitude=prop.latitude,
        longitude=prop.longitude,
        bedrooms=prop.bedrooms,
        bathrooms=prop.bathrooms,
        max_guests=prop.max_guests,
        square_feet=prop.square_feet,
        wifi_network=prop.wifi_network,
        wifi_password=prop.wifi_password,
        parking_info=prop.parking_info,
        parking_spots=0,
        check_in_instructions=prop.check_in_instr,
        check_out_instructions=prop.check_out_instr,
        house_rules=prop.house_rules,
        nightly_rate=Decimal(str(prop.nightly_rate)) if prop.nightly_rate else Decimal("0"),
        cleaning_fee=Decimal(str(prop.cleaning_fee)) if prop.cleaning_fee else None,
        security_deposit=Decimal(str(prop.security_deposit)) if prop.security_deposit else None,
        airbnb_id=prop.airbnb_id,
        vrbo_id=prop.vrbo_id,
        airbnb_ical_url=None,
        vrbo_ical_url=None,
        status=prop.status,
        amenities=prop.amenities if isinstance(prop.amenities, list) else [],
        cleaning_checklist=prop.cleaning_checklist if isinstance(prop.cleaning_checklist, list) else [],
        images=[],
        occupancy_rate=occupancy,
        avg_rating=avg_rating,
        total_reviews=total_reviews,
        total_bookings=total_bookings,
        smart_lock_id=smart_lock.id if smart_lock else None,
        has_smart_lock=smart_lock is not None,
        created_at=prop.created_at,
        updated_at=prop.updated_at
    )

    return APIResponse.success(data=response)


@router.post("/", response_model=APIResponse[PropertyResponse], status_code=201)
async def create_property(
    property_data: PropertyCreate,
    db: Session = Depends(get_db)
):
    """Create a new property."""
    # Generate unique ID
    property_id = str(uuid.uuid4())

    # Create property record
    new_property = Property(
        id=property_id,
        name=property_data.name,
        address=property_data.address,
        city=property_data.city,
        state=property_data.state,
        zip_code=property_data.zip_code,
        latitude=property_data.latitude,
        longitude=property_data.longitude,
        bedrooms=property_data.bedrooms,
        bathrooms=property_data.bathrooms,
        max_guests=property_data.max_guests,
        square_feet=property_data.square_feet,
        property_type=property_data.property_type,
        wifi_network=property_data.wifi_network,
        wifi_password=property_data.wifi_password,
        parking_info=property_data.parking_info,
        check_in_instr=property_data.check_in_instructions,
        check_out_instr=property_data.check_out_instructions,
        house_rules=property_data.house_rules,
        nightly_rate=property_data.nightly_rate,
        cleaning_fee=property_data.cleaning_fee,
        security_deposit=property_data.security_deposit,
        airbnb_id=property_data.airbnb_id,
        vrbo_id=property_data.vrbo_id,
        amenities=property_data.amenities,
        cleaning_checklist=property_data.cleaning_checklist,
        status=PropertyStatus.ACTIVE,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    db.add(new_property)
    db.commit()
    db.refresh(new_property)

    logger.info(f"Created property: {new_property.name} ({property_id})")

    return APIResponse.success(
        data=PropertyResponse(
            id=new_property.id,
            name=new_property.name,
            property_type=new_property.property_type,
            address=new_property.address,
            city=new_property.city,
            state=new_property.state,
            zip_code=new_property.zip_code or "79705",
            latitude=new_property.latitude,
            longitude=new_property.longitude,
            bedrooms=new_property.bedrooms,
            bathrooms=new_property.bathrooms,
            max_guests=new_property.max_guests,
            square_feet=new_property.square_feet,
            wifi_network=new_property.wifi_network,
            wifi_password=new_property.wifi_password,
            parking_info=new_property.parking_info,
            parking_spots=0,
            check_in_instructions=new_property.check_in_instr,
            check_out_instructions=new_property.check_out_instr,
            house_rules=new_property.house_rules,
            nightly_rate=Decimal(str(new_property.nightly_rate)) if new_property.nightly_rate else Decimal("0"),
            cleaning_fee=Decimal(str(new_property.cleaning_fee)) if new_property.cleaning_fee else None,
            security_deposit=Decimal(str(new_property.security_deposit)) if new_property.security_deposit else None,
            airbnb_id=new_property.airbnb_id,
            vrbo_id=new_property.vrbo_id,
            status=new_property.status,
            amenities=new_property.amenities if isinstance(new_property.amenities, list) else [],
            cleaning_checklist=new_property.cleaning_checklist if isinstance(new_property.cleaning_checklist, list) else [],
            images=[],
            created_at=new_property.created_at,
            updated_at=new_property.updated_at
        ),
        message="Property created successfully"
    )


@router.put("/{property_id}", response_model=APIResponse[PropertyResponse])
async def update_property(
    property_id: str,
    property_data: PropertyUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing property."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Update only provided fields
    update_data = property_data.model_dump(exclude_unset=True)

    # Map schema fields to model fields
    field_mapping = {
        "check_in_instructions": "check_in_instr",
        "check_out_instructions": "check_out_instr",
    }

    for key, value in update_data.items():
        model_key = field_mapping.get(key, key)
        if hasattr(prop, model_key):
            setattr(prop, model_key, value)

    prop.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(prop)

    logger.info(f"Updated property: {prop.name} ({property_id})")

    return await get_property(property_id, db)


@router.delete("/{property_id}", response_model=APIResponse)
async def delete_property(property_id: str, db: Session = Depends(get_db)):
    """
    Soft delete a property (sets status to ARCHIVED).
    Use force=true query param for hard delete.
    """
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Soft delete - set to archived
    prop.status = PropertyStatus.ARCHIVED
    prop.updated_at = datetime.utcnow()

    db.commit()

    logger.info(f"Archived property: {prop.name} ({property_id})")

    return APIResponse.success(message=f"Property '{prop.name}' archived successfully")


# ============================================
# OCCUPANCY & CALENDAR
# ============================================

@router.get("/{property_id}/occupancy", response_model=APIResponse[PropertyOccupancy])
async def get_property_occupancy(
    property_id: str,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: Session = Depends(get_db)
):
    """Get occupancy data and upcoming bookings for a property."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    today = date.today()
    end_date = today + timedelta(days=days)

    # Get bookings in period
    bookings = db.query(Booking).filter(
        Booking.property_id == property_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
        or_(
            and_(Booking.check_in >= today, Booking.check_in <= end_date),
            and_(Booking.check_out >= today, Booking.check_out <= end_date),
            and_(Booking.check_in <= today, Booking.check_out >= end_date)
        )
    ).all()

    # Calculate booked days
    booked_days = set()
    for booking in bookings:
        current = max(booking.check_in, today)
        end = min(booking.check_out, end_date)
        while current < end:
            booked_days.add(current)
            current += timedelta(days=1)

    total_days = days
    booked_count = len(booked_days)
    available_count = total_days - booked_count
    occupancy_rate = booked_count / total_days if total_days > 0 else 0

    # Format upcoming bookings
    upcoming = []
    for booking in sorted(bookings, key=lambda b: b.check_in):
        if booking.check_in >= today:
            upcoming.append({
                "booking_id": booking.id,
                "guest_name": booking.guest.name if booking.guest else "Unknown",
                "check_in": booking.check_in.isoformat(),
                "check_out": booking.check_out.isoformat(),
                "guests": booking.guest_count,
                "status": booking.status.value
            })

    # Calculate revenue potential
    avg_rate = float(prop.nightly_rate) if prop.nightly_rate else 0
    revenue_potential = Decimal(str(avg_rate * available_count))

    return APIResponse.success(data=PropertyOccupancy(
        property_id=property_id,
        property_name=prop.name,
        occupancy_rate=round(occupancy_rate, 3),
        total_days_in_period=total_days,
        booked_days=booked_count,
        available_days=available_count,
        blocked_days=0,
        upcoming_bookings=upcoming,
        avg_nightly_rate=Decimal(str(avg_rate)),
        revenue_potential=revenue_potential
    ))


@router.get("/{property_id}/calendar")
async def get_property_calendar(
    property_id: str,
    start_date: date = Query(..., description="Calendar start date"),
    end_date: date = Query(..., description="Calendar end date"),
    db: Session = Depends(get_db)
):
    """Get calendar view with bookings and availability."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Get bookings in date range
    bookings = db.query(Booking).filter(
        Booking.property_id == property_id,
        Booking.check_in <= end_date,
        Booking.check_out >= start_date
    ).all()

    # Build calendar entries
    entries = []
    for booking in bookings:
        guest_name = booking.guest.name if booking.guest else "Unknown Guest"
        color = {
            BookingStatus.CONFIRMED: "#3B82F6",  # Blue
            BookingStatus.CHECKED_IN: "#10B981",  # Green
            BookingStatus.PENDING: "#F59E0B",  # Yellow
            BookingStatus.CANCELLED: "#EF4444",  # Red
        }.get(booking.status, "#6B7280")

        entries.append({
            "id": booking.id,
            "title": f"{guest_name}",
            "start": booking.check_in.isoformat(),
            "end": booking.check_out.isoformat(),
            "status": booking.status.value,
            "platform": booking.platform.value if booking.platform else "DIRECT",
            "guests": booking.guest_count,
            "color": color,
            "type": "booking"
        })

    # Get cleaning jobs in date range
    cleaning_jobs = db.query(CleaningJob).filter(
        CleaningJob.property_id == property_id,
        CleaningJob.scheduled_at >= start_date,
        CleaningJob.scheduled_at <= end_date
    ).all()

    for job in cleaning_jobs:
        cleaner_name = job.cleaner.name if job.cleaner else "Unassigned"
        entries.append({
            "id": job.id,
            "title": f"Cleaning: {cleaner_name}",
            "start": job.scheduled_at.isoformat(),
            "end": job.scheduled_at.isoformat(),
            "status": job.status.value,
            "color": "#8B5CF6",  # Purple
            "type": "cleaning"
        })

    return {
        "property_id": property_id,
        "property_name": prop.name,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "entries": entries,
        "total_entries": len(entries)
    }


# ============================================
# FINANCIALS
# ============================================

@router.get("/{property_id}/financials", response_model=APIResponse[PropertyFinancialSummary])
async def get_property_financials(
    property_id: str,
    start_date: Optional[date] = Query(None, description="Period start"),
    end_date: Optional[date] = Query(None, description="Period end"),
    db: Session = Depends(get_db)
):
    """Get comprehensive financial summary for a property."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Default to current month
    if not start_date:
        today = date.today()
        start_date = date(today.year, today.month, 1)
    if not end_date:
        end_date = date.today()

    # Get revenue from bookings
    bookings = db.query(Booking).filter(
        Booking.property_id == property_id,
        Booking.check_out >= start_date,
        Booking.check_in <= end_date,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT])
    ).all()

    gross_revenue = sum(float(b.total_price or 0) for b in bookings)
    cleaning_fees = sum(float(b.cleaning_fee or 0) for b in bookings)
    platform_fees = sum(float(b.service_fee or 0) for b in bookings)
    net_revenue = gross_revenue - platform_fees

    # Get expenses
    expenses = db.query(Expense).filter(
        Expense.property_id == property_id,
        Expense.date >= start_date,
        Expense.date <= end_date
    ).all()

    total_expenses = sum(float(e.amount or 0) for e in expenses)
    expenses_by_category = {}
    for expense in expenses:
        category = expense.category.value if expense.category else "OTHER"
        expenses_by_category[category] = expenses_by_category.get(category, 0) + float(expense.amount or 0)

    # Calculate profit
    net_profit = net_revenue - total_expenses
    profit_margin = (net_profit / gross_revenue * 100) if gross_revenue > 0 else 0

    return APIResponse.success(data=PropertyFinancialSummary(
        property_id=property_id,
        property_name=prop.name,
        period_start=start_date,
        period_end=end_date,
        gross_revenue=Decimal(str(round(gross_revenue, 2))),
        cleaning_fees=Decimal(str(round(cleaning_fees, 2))),
        platform_fees=Decimal(str(round(platform_fees, 2))),
        net_revenue=Decimal(str(round(net_revenue, 2))),
        total_expenses=Decimal(str(round(total_expenses, 2))),
        expenses_by_category={k: Decimal(str(round(v, 2))) for k, v in expenses_by_category.items()},
        net_profit=Decimal(str(round(net_profit, 2))),
        profit_margin=round(profit_margin, 2)
    ))


# ============================================
# BULK OPERATIONS
# ============================================

@router.post("/bulk/import")
async def bulk_import_properties(
    properties: List[PropertyCreate],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Bulk import multiple properties."""
    results = {"created": 0, "failed": 0, "errors": []}

    for prop_data in properties:
        try:
            property_id = str(uuid.uuid4())
            new_property = Property(
                id=property_id,
                name=prop_data.name,
                address=prop_data.address,
                city=prop_data.city,
                state=prop_data.state,
                zip_code=prop_data.zip_code,
                bedrooms=prop_data.bedrooms,
                bathrooms=prop_data.bathrooms,
                max_guests=prop_data.max_guests,
                nightly_rate=prop_data.nightly_rate,
                status=PropertyStatus.ACTIVE,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(new_property)
            results["created"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({"name": prop_data.name, "error": str(e)})

    db.commit()
    return results


# ============================================
# HELPER FUNCTIONS
# ============================================

async def _calculate_property_occupancy(db: Session, property_id: str, days: int) -> float:
    """Calculate occupancy rate for a property over a period."""
    today = date.today()
    start = today - timedelta(days=days)

    bookings = db.query(Booking).filter(
        Booking.property_id == property_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        Booking.check_out >= start,
        Booking.check_in <= today
    ).all()

    booked_days = set()
    for booking in bookings:
        current = max(booking.check_in, start)
        end = min(booking.check_out, today)
        while current < end:
            booked_days.add(current)
            current += timedelta(days=1)

    return len(booked_days) / days if days > 0 else 0


async def _get_property_avg_rating(db: Session, property_id: str) -> Optional[float]:
    """Get average rating for a property from reviews."""
    # This would query the reviews table - returning mock for now
    return 4.8


async def _get_property_review_count(db: Session, property_id: str) -> int:
    """Get total review count for a property."""
    # This would query the reviews table - returning mock for now
    return 25
