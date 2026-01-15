"""
Enhanced Finance API Routes for Right at Home BnB
Full database integration with P&L, tax reports, forecasting, and analytics
@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, or_, case
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, date, timedelta
from decimal import Decimal
from enum import Enum
import io
import csv
import json
import uuid
from loguru import logger

from database.connection import get_db
from database.models import (
    Property, Booking, Expense, CleaningJob, Guest,
    ExpenseCategory, ExpenseStatus, BookingStatus
)


router = APIRouter()


# ==============================================================================
# SCHEMAS
# ==============================================================================

class ExpenseCreate(BaseModel):
    """Create expense request"""
    property_id: str
    category: ExpenseCategory
    amount: float = Field(..., gt=0)
    description: str = Field(..., min_length=1, max_length=500)
    vendor: Optional[str] = None
    expense_date: Optional[date] = None
    receipt_url: Optional[str] = None
    tax_deductible: bool = True
    tax_category: Optional[str] = None
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    """Update expense request"""
    category: Optional[ExpenseCategory] = None
    amount: Optional[float] = Field(None, gt=0)
    description: Optional[str] = None
    vendor: Optional[str] = None
    expense_date: Optional[date] = None
    receipt_url: Optional[str] = None
    status: Optional[ExpenseStatus] = None
    tax_deductible: Optional[bool] = None
    tax_category: Optional[str] = None
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    """Expense response"""
    id: str
    property_id: str
    property_name: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    amount: float
    description: str
    vendor: Optional[str]
    expense_date: date
    receipt_url: Optional[str]
    status: str
    tax_deductible: bool
    tax_category: Optional[str] = None
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class RevenueRecord(BaseModel):
    """Revenue entry from booking"""
    booking_id: str
    property_id: str
    property_name: str
    guest_name: str
    platform: str
    check_in: date
    check_out: date
    nights: int
    total_price: float
    cleaning_fee: float
    service_fee: float
    net_revenue: float


class PropertyPnL(BaseModel):
    """Profit & Loss for a single property"""
    property_id: str
    property_name: str
    address: str
    total_revenue: float
    total_expenses: float
    net_profit: float
    profit_margin: float
    occupancy_rate: float
    avg_nightly_rate: float
    total_nights_booked: int
    expenses_by_category: Dict[str, float]
    revenue_by_platform: Dict[str, float]
    month_over_month_growth: Optional[float] = None


class FinancialSummary(BaseModel):
    """Overall financial summary"""
    period_start: date
    period_end: date
    total_revenue: float
    total_expenses: float
    net_profit: float
    profit_margin: float
    total_properties: int
    active_properties: int
    total_bookings: int
    total_nights_booked: int
    avg_daily_rate: float
    occupancy_rate: float
    revenue_by_property: List[Dict[str, Any]]
    expenses_by_category: Dict[str, float]
    top_performers: List[Dict[str, Any]]
    underperformers: List[Dict[str, Any]]


class TaxReport(BaseModel):
    """Annual tax report"""
    year: int
    total_income: float
    total_deductible_expenses: float
    net_taxable_income: float
    expenses_by_category: Dict[str, float]
    capex_items: List[Dict[str, Any]]
    depreciation_total: float
    properties_summary: List[Dict[str, Any]]
    quarterly_breakdown: List[Dict[str, float]]


class ForecastResult(BaseModel):
    """Revenue/expense forecast"""
    forecast_period: str
    projected_revenue: float
    projected_expenses: float
    projected_profit: float
    confidence_level: float
    assumptions: List[str]
    monthly_projections: List[Dict[str, float]]


# ==============================================================================
# EXPENSE MANAGEMENT
# ==============================================================================

@router.post("/expenses", response_model=ExpenseResponse)
async def create_expense(
    expense: ExpenseCreate,
    db: Session = Depends(get_db)
):
    """Create a new expense record."""
    # Verify property exists
    property_obj = db.query(Property).filter(Property.id == expense.property_id).first()
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    db_expense = Expense(
        id=str(uuid.uuid4()),
        property_id=expense.property_id,
        category=expense.category,
        amount=expense.amount,
        description=expense.description,
        vendor=expense.vendor,
        date=datetime.combine(expense.expense_date or date.today(), datetime.min.time()),
        receipt_url=expense.receipt_url,
        status=ExpenseStatus.PENDING,
        is_tax_deductible=expense.tax_deductible,
        tax_category=expense.tax_category,
        notes=expense.notes
    )

    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)

    logger.info(f"Expense created: {expense.category.value} ${expense.amount} for property {expense.property_id}")

    return ExpenseResponse(
        id=db_expense.id,
        property_id=db_expense.property_id,
        property_name=property_obj.name,
        category=db_expense.category.value,
        subcategory=db_expense.subcategory,
        amount=float(db_expense.amount),
        description=db_expense.description,
        vendor=db_expense.vendor,
        expense_date=db_expense.date.date() if db_expense.date else date.today(),
        receipt_url=db_expense.receipt_url,
        status=db_expense.status.value,
        tax_deductible=db_expense.is_tax_deductible,
        tax_category=db_expense.tax_category,
        notes=db_expense.notes,
        created_at=db_expense.created_at
    )


@router.get("/expenses", response_model=List[ExpenseResponse])
async def list_expenses(
    property_id: Optional[str] = None,
    category: Optional[ExpenseCategory] = None,
    status: Optional[ExpenseStatus] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    tax_deductible_only: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List expenses with filters."""
    query = db.query(Expense).join(Property)

    if property_id:
        query = query.filter(Expense.property_id == property_id)
    if category:
        query = query.filter(Expense.category == category)
    if status:
        query = query.filter(Expense.status == status)
    if start_date:
        query = query.filter(Expense.date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(Expense.date <= datetime.combine(end_date, datetime.max.time()))
    if min_amount:
        query = query.filter(Expense.amount >= min_amount)
    if max_amount:
        query = query.filter(Expense.amount <= max_amount)
    if tax_deductible_only:
        query = query.filter(Expense.is_tax_deductible == True)

    expenses = query.order_by(Expense.date.desc()).offset(skip).limit(limit).all()

    results = []
    for exp in expenses:
        results.append(ExpenseResponse(
            id=exp.id,
            property_id=exp.property_id,
            property_name=exp.property.name if exp.property else None,
            category=exp.category.value,
            subcategory=exp.subcategory,
            amount=float(exp.amount),
            description=exp.description,
            vendor=exp.vendor,
            expense_date=exp.date.date() if exp.date else date.today(),
            receipt_url=exp.receipt_url,
            status=exp.status.value,
            tax_deductible=exp.is_tax_deductible,
            tax_category=exp.tax_category,
            notes=exp.notes,
            created_at=exp.created_at
        ))

    return results


@router.get("/expenses/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: str,
    db: Session = Depends(get_db)
):
    """Get a single expense by ID."""
    db_expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    return ExpenseResponse(
        id=db_expense.id,
        property_id=db_expense.property_id,
        property_name=db_expense.property.name if db_expense.property else None,
        category=db_expense.category.value,
        subcategory=db_expense.subcategory,
        amount=float(db_expense.amount),
        description=db_expense.description,
        vendor=db_expense.vendor,
        expense_date=db_expense.date.date() if db_expense.date else date.today(),
        receipt_url=db_expense.receipt_url,
        status=db_expense.status.value,
        tax_deductible=db_expense.is_tax_deductible,
        tax_category=db_expense.tax_category,
        notes=db_expense.notes,
        created_at=db_expense.created_at
    )


@router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    expense: ExpenseUpdate,
    db: Session = Depends(get_db)
):
    """Update an expense record."""
    db_expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    update_data = expense.model_dump(exclude_unset=True)

    # Map schema fields to model fields
    field_mapping = {
        "expense_date": "date",
        "tax_deductible": "is_tax_deductible"
    }

    for field, value in update_data.items():
        model_field = field_mapping.get(field, field)
        if model_field == "date" and value:
            value = datetime.combine(value, datetime.min.time())
        setattr(db_expense, model_field, value)

    db.commit()
    db.refresh(db_expense)

    return ExpenseResponse(
        id=db_expense.id,
        property_id=db_expense.property_id,
        property_name=db_expense.property.name if db_expense.property else None,
        category=db_expense.category.value,
        subcategory=db_expense.subcategory,
        amount=float(db_expense.amount),
        description=db_expense.description,
        vendor=db_expense.vendor,
        expense_date=db_expense.date.date() if db_expense.date else date.today(),
        receipt_url=db_expense.receipt_url,
        status=db_expense.status.value,
        tax_deductible=db_expense.is_tax_deductible,
        tax_category=db_expense.tax_category,
        notes=db_expense.notes,
        created_at=db_expense.created_at
    )


@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: str,
    db: Session = Depends(get_db)
):
    """Delete an expense record."""
    db_expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    db.delete(db_expense)
    db.commit()

    return {"status": "deleted", "expense_id": expense_id}


@router.post("/expenses/{expense_id}/approve")
async def approve_expense(
    expense_id: str,
    db: Session = Depends(get_db)
):
    """Approve an expense for payment."""
    db_expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    db_expense.status = ExpenseStatus.APPROVED
    db.commit()

    return {"status": "approved", "expense_id": expense_id}


@router.post("/expenses/{expense_id}/pay")
async def mark_expense_paid(
    expense_id: str,
    payment_reference: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Mark an expense as paid."""
    db_expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    db_expense.status = ExpenseStatus.PAID
    if payment_reference:
        db_expense.notes = f"{db_expense.notes or ''}\nPayment ref: {payment_reference}".strip()

    db.commit()

    return {"status": "paid", "expense_id": expense_id, "payment_reference": payment_reference}


# ==============================================================================
# REVENUE TRACKING
# ==============================================================================

@router.get("/revenue")
async def get_revenue(
    property_id: Optional[str] = None,
    platform: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
) -> List[RevenueRecord]:
    """Get revenue records from bookings."""
    query = db.query(Booking).join(Property).join(Guest)

    # Only completed bookings count as revenue
    query = query.filter(Booking.status.in_([
        BookingStatus.CONFIRMED,
        BookingStatus.CHECKED_IN,
        BookingStatus.CHECKED_OUT
    ]))

    if property_id:
        query = query.filter(Booking.property_id == property_id)
    if platform:
        query = query.filter(Booking.platform == platform)
    if start_date:
        query = query.filter(Booking.check_in >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(Booking.check_out <= datetime.combine(end_date, datetime.max.time()))

    bookings = query.order_by(Booking.check_in.desc()).all()

    results = []
    for booking in bookings:
        check_in_date = booking.check_in.date() if isinstance(booking.check_in, datetime) else booking.check_in
        check_out_date = booking.check_out.date() if isinstance(booking.check_out, datetime) else booking.check_out
        nights = (check_out_date - check_in_date).days
        cleaning_fee = float(booking.cleaning_fee or 0)
        service_fee = float(booking.service_fee or 0)
        total = float(booking.total_price or 0)
        net_revenue = total - service_fee  # Service fees go to platform

        results.append(RevenueRecord(
            booking_id=booking.id,
            property_id=booking.property_id,
            property_name=booking.property.name,
            guest_name=f"{booking.guest.name}",
            platform=booking.platform.value if booking.platform else "direct",
            check_in=check_in_date,
            check_out=check_out_date,
            nights=nights,
            total_price=total,
            cleaning_fee=cleaning_fee,
            service_fee=service_fee,
            net_revenue=net_revenue
        ))

    return results


# ==============================================================================
# PROFIT & LOSS REPORTS
# ==============================================================================

@router.get("/pnl/summary", response_model=FinancialSummary)
async def get_pnl_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get overall P&L summary across all properties."""
    # Default to current year
    if not start_date:
        start_date = date(date.today().year, 1, 1)
    if not end_date:
        end_date = date.today()

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Get all properties
    properties = db.query(Property).all()
    total_properties = len(properties)
    active_properties = sum(1 for p in properties if p.status and p.status.value == "ACTIVE")

    # Calculate total revenue from bookings
    bookings = db.query(Booking).filter(
        Booking.check_in >= start_dt,
        Booking.check_out <= end_dt,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT])
    ).all()

    total_revenue = sum(float(b.total_price or 0) for b in bookings)
    total_bookings = len(bookings)
    total_nights = sum(
        ((b.check_out.date() if isinstance(b.check_out, datetime) else b.check_out) -
         (b.check_in.date() if isinstance(b.check_in, datetime) else b.check_in)).days
        for b in bookings
    )

    # Calculate total expenses
    expenses = db.query(Expense).filter(
        Expense.date >= start_dt,
        Expense.date <= end_dt
    ).all()

    total_expenses = sum(float(e.amount or 0) for e in expenses)

    # Net profit
    net_profit = total_revenue - total_expenses
    profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0

    # Average daily rate
    avg_daily_rate = (total_revenue / total_nights) if total_nights > 0 else 0

    # Occupancy rate (nights booked / total available nights)
    days_in_period = (end_date - start_date).days + 1
    total_available_nights = active_properties * days_in_period if active_properties > 0 else days_in_period
    occupancy_rate = (total_nights / total_available_nights * 100) if total_available_nights > 0 else 0

    # Revenue by property
    revenue_by_property_dict = {}
    for booking in bookings:
        prop_id = booking.property_id
        if prop_id not in revenue_by_property_dict:
            revenue_by_property_dict[prop_id] = {
                "property_id": prop_id,
                "name": booking.property.name if booking.property else "Unknown",
                "revenue": 0
            }
        revenue_by_property_dict[prop_id]["revenue"] += float(booking.total_price or 0)

    revenue_by_property = list(revenue_by_property_dict.values())

    # Expenses by category
    expenses_by_category = {}
    for expense in expenses:
        cat = expense.category.value
        expenses_by_category[cat] = expenses_by_category.get(cat, 0) + float(expense.amount or 0)

    # Top performers (highest revenue)
    top_performers = sorted(revenue_by_property, key=lambda x: x["revenue"], reverse=True)[:5]

    # Underperformers (lowest revenue with at least 1 booking)
    underperformers = [p for p in revenue_by_property if p["revenue"] > 0]
    underperformers = sorted(underperformers, key=lambda x: x["revenue"])[:5]

    return FinancialSummary(
        period_start=start_date,
        period_end=end_date,
        total_revenue=round(total_revenue, 2),
        total_expenses=round(total_expenses, 2),
        net_profit=round(net_profit, 2),
        profit_margin=round(profit_margin, 2),
        total_properties=total_properties,
        active_properties=active_properties,
        total_bookings=total_bookings,
        total_nights_booked=total_nights,
        avg_daily_rate=round(avg_daily_rate, 2),
        occupancy_rate=round(occupancy_rate, 2),
        revenue_by_property=revenue_by_property,
        expenses_by_category=expenses_by_category,
        top_performers=top_performers,
        underperformers=underperformers
    )


@router.get("/pnl/by-property/{property_id}", response_model=PropertyPnL)
async def get_property_pnl(
    property_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get detailed P&L for a specific property."""
    property_obj = db.query(Property).filter(Property.id == property_id).first()
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    if not start_date:
        start_date = date(date.today().year, 1, 1)
    if not end_date:
        end_date = date.today()

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Revenue from bookings
    bookings = db.query(Booking).filter(
        Booking.property_id == property_id,
        Booking.check_in >= start_dt,
        Booking.check_out <= end_dt,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT])
    ).all()

    total_revenue = sum(float(b.total_price or 0) for b in bookings)
    total_nights = sum(
        ((b.check_out.date() if isinstance(b.check_out, datetime) else b.check_out) -
         (b.check_in.date() if isinstance(b.check_in, datetime) else b.check_in)).days
        for b in bookings
    )

    # Revenue by platform
    revenue_by_platform = {}
    for booking in bookings:
        platform = booking.platform.value if booking.platform else "DIRECT"
        revenue_by_platform[platform] = revenue_by_platform.get(platform, 0) + float(booking.total_price or 0)

    # Expenses
    expenses = db.query(Expense).filter(
        Expense.property_id == property_id,
        Expense.date >= start_dt,
        Expense.date <= end_dt
    ).all()

    total_expenses = sum(float(e.amount or 0) for e in expenses)

    # Expenses by category
    expenses_by_category = {}
    for expense in expenses:
        cat = expense.category.value
        expenses_by_category[cat] = expenses_by_category.get(cat, 0) + float(expense.amount or 0)

    # Calculate metrics
    net_profit = total_revenue - total_expenses
    profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    avg_nightly_rate = (total_revenue / total_nights) if total_nights > 0 else 0

    # Occupancy rate
    days_in_period = (end_date - start_date).days + 1
    occupancy_rate = (total_nights / days_in_period * 100) if days_in_period > 0 else 0

    return PropertyPnL(
        property_id=property_obj.id,
        property_name=property_obj.name,
        address=property_obj.address or "",
        total_revenue=round(total_revenue, 2),
        total_expenses=round(total_expenses, 2),
        net_profit=round(net_profit, 2),
        profit_margin=round(profit_margin, 2),
        occupancy_rate=round(occupancy_rate, 2),
        avg_nightly_rate=round(avg_nightly_rate, 2),
        total_nights_booked=total_nights,
        expenses_by_category=expenses_by_category,
        revenue_by_platform=revenue_by_platform
    )


@router.get("/pnl/all-properties")
async def get_all_properties_pnl(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
) -> List[PropertyPnL]:
    """Get P&L for all properties."""
    properties = db.query(Property).all()
    results = []

    for prop in properties:
        try:
            pnl = await get_property_pnl(prop.id, start_date, end_date, db)
            results.append(pnl)
        except Exception as e:
            logger.warning(f"Error calculating P&L for property {prop.id}: {e}")
            continue

    # Sort by net profit descending
    results.sort(key=lambda x: x.net_profit, reverse=True)
    return results


# ==============================================================================
# TAX REPORTS
# ==============================================================================

@router.get("/tax-report/{year}", response_model=TaxReport)
async def get_tax_report(
    year: int,
    db: Session = Depends(get_db)
):
    """Generate annual tax report with deductible expenses."""
    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31, 23, 59, 59)

    # Total income from bookings
    bookings = db.query(Booking).filter(
        Booking.check_in >= start_date,
        Booking.check_out <= end_date,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT])
    ).all()

    total_income = sum(float(b.total_price or 0) for b in bookings)

    # Deductible expenses
    expenses = db.query(Expense).filter(
        Expense.date >= start_date,
        Expense.date <= end_date,
        Expense.is_tax_deductible == True
    ).all()

    # Group by category
    expenses_by_category = {}
    capex_items = []
    depreciation_total = 0

    # CAPEX categories that should be depreciated
    capex_categories = [ExpenseCategory.FURNITURE, ExpenseCategory.APPLIANCES]

    for expense in expenses:
        cat = expense.category.value
        amount = float(expense.amount or 0)

        if expense.category in capex_categories:
            capex_items.append({
                "description": expense.description,
                "amount": amount,
                "date": expense.date.date().isoformat() if expense.date else "",
                "vendor": expense.vendor
            })
            # CAPEX is depreciated, not fully deducted (5-year depreciation)
            depreciation_total += amount * 0.2
        else:
            expenses_by_category[cat] = expenses_by_category.get(cat, 0) + amount

    total_deductible = sum(expenses_by_category.values()) + depreciation_total
    net_taxable = total_income - total_deductible

    # Quarterly breakdown
    quarterly = []
    for quarter in range(1, 5):
        q_start = datetime(year, (quarter - 1) * 3 + 1, 1)
        if quarter == 4:
            q_end = datetime(year, 12, 31, 23, 59, 59)
        else:
            next_quarter_month = quarter * 3 + 1
            q_end = datetime(year, next_quarter_month, 1) - timedelta(seconds=1)

        q_bookings = [b for b in bookings if q_start <= b.check_in <= q_end]
        q_expenses_list = [e for e in expenses if e.date and q_start <= e.date <= q_end]

        q_income = sum(float(b.total_price or 0) for b in q_bookings)
        q_expenses = sum(float(e.amount or 0) for e in q_expenses_list)

        quarterly.append({
            "quarter": f"Q{quarter}",
            "income": round(q_income, 2),
            "expenses": round(q_expenses, 2),
            "net": round(q_income - q_expenses, 2)
        })

    # Properties summary
    properties = db.query(Property).all()
    properties_summary = []
    for prop in properties:
        p_bookings = [b for b in bookings if b.property_id == prop.id]
        p_expenses_list = [e for e in expenses if e.property_id == prop.id]

        p_income = sum(float(b.total_price or 0) for b in p_bookings)
        p_expenses = sum(float(e.amount or 0) for e in p_expenses_list)

        properties_summary.append({
            "property_id": prop.id,
            "name": prop.name,
            "address": prop.address,
            "income": round(p_income, 2),
            "expenses": round(p_expenses, 2),
            "net": round(p_income - p_expenses, 2)
        })

    return TaxReport(
        year=year,
        total_income=round(total_income, 2),
        total_deductible_expenses=round(total_deductible, 2),
        net_taxable_income=round(net_taxable, 2),
        expenses_by_category=expenses_by_category,
        capex_items=capex_items,
        depreciation_total=round(depreciation_total, 2),
        properties_summary=properties_summary,
        quarterly_breakdown=quarterly
    )


# ==============================================================================
# FORECASTING
# ==============================================================================

@router.get("/forecast", response_model=ForecastResult)
async def get_financial_forecast(
    months_ahead: int = Query(default=3, ge=1, le=12),
    db: Session = Depends(get_db)
):
    """Generate revenue and expense forecast based on historical data."""
    # Get last 12 months of data for trend analysis
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)

    # Historical bookings
    bookings = db.query(Booking).filter(
        Booking.check_in >= start_date,
        Booking.check_out <= end_date,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT])
    ).all()

    # Historical expenses
    expenses = db.query(Expense).filter(
        Expense.date >= start_date,
        Expense.date <= end_date
    ).all()

    # Group by month
    revenue_by_month = {}
    for booking in bookings:
        month_key = booking.check_in.month
        revenue_by_month[month_key] = revenue_by_month.get(month_key, 0) + float(booking.total_price or 0)

    expense_by_month = {}
    for expense in expenses:
        if expense.date:
            month_key = expense.date.month
            expense_by_month[month_key] = expense_by_month.get(month_key, 0) + float(expense.amount or 0)

    # Calculate averages
    avg_monthly_revenue = sum(revenue_by_month.values()) / max(len(revenue_by_month), 1)
    avg_monthly_expenses = sum(expense_by_month.values()) / max(len(expense_by_month), 1)

    # Simple growth rate (compare last 6 months to first 6 months)
    recent_revenue = sum(revenue_by_month.get(m, 0) for m in range(7, 13))
    earlier_revenue = sum(revenue_by_month.get(m, 0) for m in range(1, 7))
    growth_rate = ((recent_revenue - earlier_revenue) / earlier_revenue) if earlier_revenue > 0 else 0

    # Generate forecast
    monthly_projections = []
    current_month = end_date.month

    for i in range(1, months_ahead + 1):
        forecast_month = (current_month + i - 1) % 12 + 1

        # Seasonal adjustment based on historical data for this month
        historical_for_month = revenue_by_month.get(forecast_month, avg_monthly_revenue)
        seasonal_factor = historical_for_month / avg_monthly_revenue if avg_monthly_revenue > 0 else 1

        projected_rev = avg_monthly_revenue * seasonal_factor * (1 + growth_rate / 12 * i)
        projected_exp = avg_monthly_expenses * (1 + 0.02 * i)  # Assume 2% monthly expense growth

        monthly_projections.append({
            "month": forecast_month,
            "projected_revenue": round(projected_rev, 2),
            "projected_expenses": round(projected_exp, 2),
            "projected_profit": round(projected_rev - projected_exp, 2)
        })

    total_projected_revenue = sum(m["projected_revenue"] for m in monthly_projections)
    total_projected_expenses = sum(m["projected_expenses"] for m in monthly_projections)
    total_projected_profit = total_projected_revenue - total_projected_expenses

    # Confidence level based on data quality
    data_points = len(revenue_by_month)
    confidence = min(0.9, 0.5 + data_points * 0.04)

    return ForecastResult(
        forecast_period=f"{months_ahead} months",
        projected_revenue=round(total_projected_revenue, 2),
        projected_expenses=round(total_projected_expenses, 2),
        projected_profit=round(total_projected_profit, 2),
        confidence_level=round(confidence, 2),
        assumptions=[
            f"Based on {data_points} months of historical data",
            f"Assumed growth rate: {round(growth_rate * 100, 1)}%",
            f"Seasonal patterns from previous year applied",
            "Expense growth assumed at 2% monthly"
        ],
        monthly_projections=monthly_projections
    )


# ==============================================================================
# EXPORTS
# ==============================================================================

@router.get("/export/csv")
async def export_financials_csv(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_revenue: bool = True,
    include_expenses: bool = True,
    db: Session = Depends(get_db)
):
    """Export financial data as CSV."""
    if not start_date:
        start_date = date(date.today().year, 1, 1)
    if not end_date:
        end_date = date.today()

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Type", "Property", "Category", "Description",
        "Amount", "Vendor", "Tax Deductible", "Status"
    ])

    if include_revenue:
        bookings = db.query(Booking).join(Property).filter(
            Booking.check_in >= start_dt,
            Booking.check_out <= end_dt,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT])
        ).all()

        for booking in bookings:
            check_in_date = booking.check_in.date() if isinstance(booking.check_in, datetime) else booking.check_in
            writer.writerow([
                check_in_date.isoformat(),
                "Revenue",
                booking.property.name if booking.property else "Unknown",
                booking.platform.value if booking.platform else "Direct",
                f"Booking #{booking.id}",
                float(booking.total_price or 0),
                "",
                "Yes",
                "Received"
            ])

    if include_expenses:
        expenses = db.query(Expense).join(Property).filter(
            Expense.date >= start_dt,
            Expense.date <= end_dt
        ).all()

        for expense in expenses:
            expense_date = expense.date.date() if isinstance(expense.date, datetime) else expense.date
            writer.writerow([
                expense_date.isoformat() if expense_date else "",
                "Expense",
                expense.property.name if expense.property else "",
                expense.category.value,
                expense.description,
                float(expense.amount or 0),
                expense.vendor or "",
                "Yes" if expense.is_tax_deductible else "No",
                expense.status.value
            ])

    output.seek(0)
    filename = f"rightathomebnb_financials_{start_date.isoformat()}_to_{end_date.isoformat()}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/tax-csv/{year}")
async def export_tax_report_csv(
    year: int,
    db: Session = Depends(get_db)
):
    """Export tax report as CSV for accountant."""
    tax_report = await get_tax_report(year, db)

    output = io.StringIO()
    writer = csv.writer(output)

    # Summary section
    writer.writerow(["Right at Home BnB - Tax Report", str(year)])
    writer.writerow([])
    writer.writerow(["SUMMARY"])
    writer.writerow(["Total Income", tax_report.total_income])
    writer.writerow(["Total Deductible Expenses", tax_report.total_deductible_expenses])
    writer.writerow(["Depreciation", tax_report.depreciation_total])
    writer.writerow(["Net Taxable Income", tax_report.net_taxable_income])
    writer.writerow([])

    # Expenses by category
    writer.writerow(["EXPENSES BY CATEGORY"])
    for category, amount in tax_report.expenses_by_category.items():
        writer.writerow([category.replace("_", " ").title(), amount])
    writer.writerow([])

    # Capital expenditures
    writer.writerow(["CAPITAL EXPENDITURES (DEPRECIATED)"])
    writer.writerow(["Description", "Amount", "Date", "Vendor"])
    for item in tax_report.capex_items:
        writer.writerow([item["description"], item["amount"], item["date"], item.get("vendor", "")])
    writer.writerow([])

    # Quarterly breakdown
    writer.writerow(["QUARTERLY BREAKDOWN"])
    writer.writerow(["Quarter", "Income", "Expenses", "Net"])
    for q in tax_report.quarterly_breakdown:
        writer.writerow([q["quarter"], q["income"], q["expenses"], q["net"]])
    writer.writerow([])

    # By property
    writer.writerow(["BY PROPERTY"])
    writer.writerow(["Property", "Address", "Income", "Expenses", "Net"])
    for prop in tax_report.properties_summary:
        writer.writerow([prop["name"], prop.get("address", ""), prop["income"], prop["expenses"], prop["net"]])

    output.seek(0)
    filename = f"rightathomebnb_tax_report_{year}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==============================================================================
# ANALYTICS
# ==============================================================================

@router.get("/analytics/trends")
async def get_financial_trends(
    period: str = Query(default="monthly", pattern="^(daily|weekly|monthly)$"),
    months_back: int = Query(default=12, ge=1, le=24),
    db: Session = Depends(get_db)
):
    """Get financial trends over time."""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=months_back * 30)

    # Get all bookings in period
    bookings = db.query(Booking).filter(
        Booking.check_in >= start_date,
        Booking.check_out <= end_date,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT])
    ).all()

    # Get all expenses in period
    expenses = db.query(Expense).filter(
        Expense.date >= start_date,
        Expense.date <= end_date
    ).all()

    if period == "monthly":
        # Group by year-month
        revenue_by_period = {}
        for booking in bookings:
            key = (booking.check_in.year, booking.check_in.month)
            if key not in revenue_by_period:
                revenue_by_period[key] = {"revenue": 0, "bookings": 0}
            revenue_by_period[key]["revenue"] += float(booking.total_price or 0)
            revenue_by_period[key]["bookings"] += 1

        expense_by_period = {}
        for expense in expenses:
            if expense.date:
                key = (expense.date.year, expense.date.month)
                expense_by_period[key] = expense_by_period.get(key, 0) + float(expense.amount or 0)

        trends = []
        for (year, month), data in sorted(revenue_by_period.items()):
            exp = expense_by_period.get((year, month), 0)
            trends.append({
                "period": f"{year}-{month:02d}",
                "revenue": round(data["revenue"], 2),
                "expenses": round(exp, 2),
                "profit": round(data["revenue"] - exp, 2),
                "bookings": data["bookings"]
            })

        return {
            "period_type": period,
            "start_date": start_date.date().isoformat(),
            "end_date": end_date.date().isoformat(),
            "trends": trends
        }

    return {"error": "Period type not yet implemented"}


@router.get("/analytics/expense-breakdown")
async def get_expense_breakdown(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    property_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get detailed expense breakdown by category."""
    if not start_date:
        start_date = date(date.today().year, 1, 1)
    if not end_date:
        end_date = date.today()

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    query = db.query(Expense).filter(
        Expense.date >= start_dt,
        Expense.date <= end_dt
    )

    if property_id:
        query = query.filter(Expense.property_id == property_id)

    expenses = query.all()

    # Group by category
    category_data = {}
    for expense in expenses:
        cat = expense.category.value
        if cat not in category_data:
            category_data[cat] = {"total": 0, "count": 0, "amounts": []}
        category_data[cat]["total"] += float(expense.amount or 0)
        category_data[cat]["count"] += 1
        category_data[cat]["amounts"].append(float(expense.amount or 0))

    total_expenses = sum(d["total"] for d in category_data.values())

    breakdown = []
    for cat, data in category_data.items():
        avg = sum(data["amounts"]) / len(data["amounts"]) if data["amounts"] else 0
        breakdown.append({
            "category": cat,
            "total": round(data["total"], 2),
            "count": data["count"],
            "average": round(avg, 2),
            "percentage": round((data["total"] / total_expenses * 100) if total_expenses > 0 else 0, 2)
        })

    # Sort by total descending
    breakdown.sort(key=lambda x: x["total"], reverse=True)

    return {
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "total_expenses": round(total_expenses, 2),
        "breakdown": breakdown
    }


@router.get("/analytics/revenue-by-platform")
async def get_revenue_by_platform(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get revenue breakdown by booking platform."""
    if not start_date:
        start_date = date(date.today().year, 1, 1)
    if not end_date:
        end_date = date.today()

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    bookings = db.query(Booking).filter(
        Booking.check_in >= start_dt,
        Booking.check_out <= end_dt,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT])
    ).all()

    # Group by platform
    platform_data = {}
    for booking in bookings:
        platform = booking.platform.value if booking.platform else "DIRECT"
        if platform not in platform_data:
            platform_data[platform] = {"revenue": 0, "bookings": 0, "amounts": []}
        amount = float(booking.total_price or 0)
        platform_data[platform]["revenue"] += amount
        platform_data[platform]["bookings"] += 1
        platform_data[platform]["amounts"].append(amount)

    total_revenue = sum(d["revenue"] for d in platform_data.values())

    platforms = []
    for platform, data in platform_data.items():
        avg = sum(data["amounts"]) / len(data["amounts"]) if data["amounts"] else 0
        platforms.append({
            "platform": platform,
            "revenue": round(data["revenue"], 2),
            "bookings": data["bookings"],
            "avg_booking_value": round(avg, 2),
            "percentage": round((data["revenue"] / total_revenue * 100) if total_revenue > 0 else 0, 2)
        })

    # Sort by revenue descending
    platforms.sort(key=lambda x: x["revenue"], reverse=True)

    return {
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "total_revenue": round(total_revenue, 2),
        "platforms": platforms
    }
