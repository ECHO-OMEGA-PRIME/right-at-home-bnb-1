"""
Right At Home BnB - Utility Tracking API Routes
================================================
Complete utility tracking system with:
- Bill entry and management
- Cost per guest-night analysis
- Anomaly detection for usage spikes
- Monthly comparison and trends
- Integration with PropertyExpense for auto-categorization

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from sqlalchemy import func, and_, or_, extract
from sqlalchemy.orm import Session
from loguru import logger

from database.connection import get_db
from database.models_financial import (
    UtilityIntensityMetric,
    TaxCategorizedExpense,
    TaxCategory,
    AlertType,
    AlertSeverity,
    OperationalAlert,
    MonthlyPropertyFinancials
)
from database.models import Property, Booking, Expense, ExpenseCategory

router = APIRouter()


# ============================================================================
# ENUMS & SCHEMAS
# ============================================================================

class UtilityType(str, Enum):
    """Types of utility bills."""
    ELECTRIC = "electric"
    GAS = "gas"
    WATER = "water"
    INTERNET = "internet"
    TRASH = "trash"
    SEWER = "sewer"
    HOA = "hoa"
    PEST_CONTROL = "pest_control"


class UtilityBillCreate(BaseModel):
    """Schema for creating a utility bill."""
    property_id: str = Field(..., description="Property ID")
    utility_type: UtilityType
    amount: float = Field(..., gt=0, description="Bill amount")
    billing_period_start: date
    billing_period_end: date
    due_date: Optional[date] = None

    # Usage metrics for kWh/gallon tracking
    usage_amount: Optional[float] = Field(None, description="Usage in kWh, gallons, etc.")
    usage_unit: Optional[str] = Field(None, description="kWh, gallons, CCF, therms")

    # Bill details
    account_number: Optional[str] = None
    invoice_number: Optional[str] = None
    provider_name: Optional[str] = None

    is_paid: bool = False
    paid_date: Optional[date] = None
    notes: Optional[str] = None


class UtilityBillUpdate(BaseModel):
    """Schema for updating a utility bill."""
    amount: Optional[float] = Field(None, gt=0)
    due_date: Optional[date] = None
    usage_amount: Optional[float] = None
    usage_unit: Optional[str] = None
    is_paid: Optional[bool] = None
    paid_date: Optional[date] = None
    notes: Optional[str] = None


class UtilityBillResponse(BaseModel):
    """Response schema for utility bill."""
    id: int
    property_id: str
    property_name: Optional[str] = None
    utility_type: str
    amount: float
    billing_period_start: date
    billing_period_end: date
    due_date: Optional[date] = None
    usage_amount: Optional[float] = None
    usage_unit: Optional[str] = None
    account_number: Optional[str] = None
    invoice_number: Optional[str] = None
    provider_name: Optional[str] = None
    is_paid: bool
    paid_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime

    # Calculated fields
    cost_per_day: Optional[float] = None
    days_in_period: Optional[int] = None

    class Config:
        from_attributes = True


class UtilitySummary(BaseModel):
    """Monthly utility summary."""
    property_id: str
    property_name: str
    year: int
    month: int

    # Costs by type
    electric_cost: float = 0
    gas_cost: float = 0
    water_cost: float = 0
    internet_cost: float = 0
    trash_cost: float = 0
    other_cost: float = 0
    total_cost: float = 0

    # Usage metrics
    electric_kwh: Optional[float] = None
    water_gallons: Optional[float] = None
    gas_therms: Optional[float] = None

    # Occupancy data
    guest_nights: int = 0
    total_guests: int = 0
    bookings_count: int = 0

    # Intensity metrics
    cost_per_guest_night: Optional[float] = None
    cost_per_guest: Optional[float] = None
    kwh_per_guest_night: Optional[float] = None

    # Comparison
    portfolio_avg_cost_per_guest_night: Optional[float] = None
    deviation_percentage: Optional[float] = None
    is_anomaly: bool = False
    anomaly_reason: Optional[str] = None


class CostAnalysis(BaseModel):
    """Cost per guest-night analysis."""
    property_id: str
    property_name: str
    period_start: date
    period_end: date

    total_utility_cost: float
    total_guest_nights: int
    total_guests: int

    cost_per_guest_night: float
    cost_per_guest: float

    breakdown_by_type: Dict[str, float]

    # Trends
    monthly_trend: List[Dict[str, Any]]

    # Comparison to portfolio
    portfolio_average: float
    deviation_from_average: float
    percentile_rank: int  # 1-100, where 100 is most expensive


class AnomalyAlert(BaseModel):
    """Utility anomaly alert."""
    id: int
    property_id: str
    property_name: str
    alert_type: str
    severity: str
    title: str
    description: str

    expected_value: float
    actual_value: float
    deviation_percentage: float

    utility_type: Optional[str] = None
    billing_period: Optional[str] = None

    is_acknowledged: bool = False
    created_at: datetime


# ============================================================================
# CRUD OPERATIONS
# ============================================================================

@router.get("", response_model=List[UtilityBillResponse])
async def list_utility_bills(
    property_id: Optional[str] = None,
    utility_type: Optional[UtilityType] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    is_paid: Optional[bool] = None,
    limit: int = Query(50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List all utility bills with optional filters."""
    try:
        query = db.query(TaxCategorizedExpense).filter(
            TaxCategorizedExpense.tax_category == TaxCategory.UTILITIES
        )

        if property_id:
            query = query.filter(TaxCategorizedExpense.property_id == property_id)

        if utility_type:
            query = query.filter(TaxCategorizedExpense.subcategory == utility_type.value)

        if year:
            query = query.filter(extract('year', TaxCategorizedExpense.expense_date) == year)

        if month:
            query = query.filter(extract('month', TaxCategorizedExpense.expense_date) == month)

        if is_paid is not None:
            query = query.filter(TaxCategorizedExpense.is_paid == is_paid)

        # Order by date descending
        query = query.order_by(TaxCategorizedExpense.expense_date.desc())

        bills = query.offset(offset).limit(limit).all()

        # Get property names
        property_ids = list(set(b.property_id for b in bills))
        properties = {p.id: p.name for p in db.query(Property).filter(Property.id.in_(property_ids)).all()}

        result = []
        for bill in bills:
            # Calculate days in period and cost per day from notes if available
            days_in_period = 30  # Default
            notes = bill.notes or ""

            result.append(UtilityBillResponse(
                id=bill.id,
                property_id=bill.property_id,
                property_name=properties.get(bill.property_id),
                utility_type=bill.subcategory or "other",
                amount=float(bill.amount),
                billing_period_start=bill.expense_date,
                billing_period_end=bill.expense_date,
                due_date=None,
                usage_amount=None,
                usage_unit=None,
                account_number=None,
                invoice_number=bill.invoice_number,
                provider_name=bill.vendor_name,
                is_paid=bill.is_paid,
                paid_date=None,
                notes=bill.notes,
                created_at=bill.created_at,
                cost_per_day=float(bill.amount) / days_in_period,
                days_in_period=days_in_period
            ))

        return result

    except Exception as e:
        logger.error(f"Failed to list utility bills: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=UtilityBillResponse)
async def add_utility_bill(
    bill: UtilityBillCreate,
    db: Session = Depends(get_db)
):
    """Add a new utility bill and auto-categorize as expense."""
    try:
        # Verify property exists
        property_obj = db.query(Property).filter(Property.id == bill.property_id).first()
        if not property_obj:
            raise HTTPException(status_code=404, detail=f"Property {bill.property_id} not found")

        # Calculate billing period days
        days_in_period = (bill.billing_period_end - bill.billing_period_start).days + 1

        # Build notes with usage data
        notes_parts = []
        if bill.usage_amount and bill.usage_unit:
            notes_parts.append(f"Usage: {bill.usage_amount} {bill.usage_unit}")
        if bill.notes:
            notes_parts.append(bill.notes)
        notes_parts.append(f"Period: {bill.billing_period_start} to {bill.billing_period_end} ({days_in_period} days)")

        # Create TaxCategorizedExpense entry
        expense = TaxCategorizedExpense(
            property_id=bill.property_id,
            description=f"{bill.utility_type.value.title()} bill",
            amount=Decimal(str(bill.amount)),
            expense_date=bill.billing_period_end,  # Use end date as expense date
            tax_category=TaxCategory.UTILITIES,
            subcategory=bill.utility_type.value,
            vendor_name=bill.provider_name,
            invoice_number=bill.invoice_number,
            is_paid=bill.is_paid,
            is_deductible=True,
            deduction_percentage=100.0,
            notes="; ".join(notes_parts),
            tax_year=bill.billing_period_end.year
        )

        db.add(expense)
        db.commit()
        db.refresh(expense)

        logger.info(f"Added {bill.utility_type.value} bill ${bill.amount} for property {bill.property_id}")

        # Check for anomaly
        await _check_utility_anomaly(db, bill.property_id, bill.utility_type.value, bill.amount, bill.billing_period_end)

        return UtilityBillResponse(
            id=expense.id,
            property_id=expense.property_id,
            property_name=property_obj.name,
            utility_type=bill.utility_type.value,
            amount=float(expense.amount),
            billing_period_start=bill.billing_period_start,
            billing_period_end=bill.billing_period_end,
            due_date=bill.due_date,
            usage_amount=bill.usage_amount,
            usage_unit=bill.usage_unit,
            account_number=bill.account_number,
            invoice_number=bill.invoice_number,
            provider_name=bill.provider_name,
            is_paid=bill.is_paid,
            paid_date=bill.paid_date,
            notes=bill.notes,
            created_at=expense.created_at,
            cost_per_day=float(expense.amount) / days_in_period if days_in_period > 0 else None,
            days_in_period=days_in_period
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to add utility bill: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/property/{property_id}", response_model=List[UtilityBillResponse])
async def get_property_utilities(
    property_id: str,
    year: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all utility bills for a specific property."""
    return await list_utility_bills(
        property_id=property_id,
        year=year,
        db=db
    )


@router.put("/{bill_id}")
async def update_utility_bill(
    bill_id: int,
    update: UtilityBillUpdate,
    db: Session = Depends(get_db)
):
    """Update a utility bill."""
    try:
        expense = db.query(TaxCategorizedExpense).filter(
            TaxCategorizedExpense.id == bill_id,
            TaxCategorizedExpense.tax_category == TaxCategory.UTILITIES
        ).first()

        if not expense:
            raise HTTPException(status_code=404, detail="Utility bill not found")

        if update.amount is not None:
            expense.amount = Decimal(str(update.amount))

        if update.is_paid is not None:
            expense.is_paid = update.is_paid

        if update.notes is not None:
            expense.notes = update.notes

        db.commit()

        return {"success": True, "message": "Utility bill updated"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update utility bill: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{bill_id}")
async def delete_utility_bill(
    bill_id: int,
    db: Session = Depends(get_db)
):
    """Delete a utility bill."""
    try:
        expense = db.query(TaxCategorizedExpense).filter(
            TaxCategorizedExpense.id == bill_id,
            TaxCategorizedExpense.tax_category == TaxCategory.UTILITIES
        ).first()

        if not expense:
            raise HTTPException(status_code=404, detail="Utility bill not found")

        db.delete(expense)
        db.commit()

        return {"success": True, "message": "Utility bill deleted"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete utility bill: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ANALYSIS ENDPOINTS
# ============================================================================

@router.get("/analysis", response_model=List[CostAnalysis])
async def get_utility_analysis(
    year: int = Query(..., description="Year for analysis"),
    month: Optional[int] = Query(None, ge=1, le=12),
    property_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get cost per guest-night analysis for utilities."""
    try:
        # Build query for utility expenses
        utility_query = db.query(TaxCategorizedExpense).filter(
            TaxCategorizedExpense.tax_category == TaxCategory.UTILITIES,
            extract('year', TaxCategorizedExpense.expense_date) == year
        )

        if month:
            utility_query = utility_query.filter(
                extract('month', TaxCategorizedExpense.expense_date) == month
            )

        if property_id:
            utility_query = utility_query.filter(
                TaxCategorizedExpense.property_id == property_id
            )

        utilities = utility_query.all()

        # Group by property
        property_utilities: Dict[str, List] = {}
        for u in utilities:
            if u.property_id not in property_utilities:
                property_utilities[u.property_id] = []
            property_utilities[u.property_id].append(u)

        # Get properties
        property_ids = list(property_utilities.keys())
        if not property_ids:
            return []

        properties = {p.id: p for p in db.query(Property).filter(Property.id.in_(property_ids)).all()}

        # Get bookings for guest night calculation
        booking_query = db.query(Booking).filter(
            Booking.property_id.in_(property_ids),
            extract('year', Booking.check_in) == year
        )
        if month:
            booking_query = booking_query.filter(
                extract('month', Booking.check_in) == month
            )

        bookings = booking_query.all()

        # Calculate guest nights per property
        property_guest_nights: Dict[str, int] = {}
        property_guests: Dict[str, int] = {}

        for booking in bookings:
            nights = booking.total_nights or 1
            guests = booking.guest_count or 1

            if booking.property_id not in property_guest_nights:
                property_guest_nights[booking.property_id] = 0
                property_guests[booking.property_id] = 0

            property_guest_nights[booking.property_id] += nights
            property_guests[booking.property_id] += guests

        # Calculate analysis per property
        results = []
        all_costs_per_guest_night = []

        for prop_id, utils in property_utilities.items():
            prop = properties.get(prop_id)
            if not prop:
                continue

            # Sum costs by type
            total_cost = 0
            breakdown: Dict[str, float] = {}

            for u in utils:
                amount = float(u.amount)
                total_cost += amount
                utility_type = u.subcategory or "other"
                breakdown[utility_type] = breakdown.get(utility_type, 0) + amount

            guest_nights = property_guest_nights.get(prop_id, 0)
            guests = property_guests.get(prop_id, 0)

            cost_per_guest_night = total_cost / guest_nights if guest_nights > 0 else 0
            cost_per_guest = total_cost / guests if guests > 0 else 0

            if guest_nights > 0:
                all_costs_per_guest_night.append(cost_per_guest_night)

            # Get monthly trend
            monthly_trend = []
            for m in range(1, 13):
                month_utils = [u for u in utils if u.expense_date.month == m]
                month_cost = sum(float(u.amount) for u in month_utils)
                if month_cost > 0:
                    monthly_trend.append({
                        "month": m,
                        "cost": month_cost,
                        "types": {u.subcategory: float(u.amount) for u in month_utils}
                    })

            # Determine period
            if month:
                period_start = date(year, month, 1)
                period_end = date(year, month, 28)  # Simplified
            else:
                period_start = date(year, 1, 1)
                period_end = date(year, 12, 31)

            results.append(CostAnalysis(
                property_id=prop_id,
                property_name=prop.name,
                period_start=period_start,
                period_end=period_end,
                total_utility_cost=total_cost,
                total_guest_nights=guest_nights,
                total_guests=guests,
                cost_per_guest_night=round(cost_per_guest_night, 2),
                cost_per_guest=round(cost_per_guest, 2),
                breakdown_by_type=breakdown,
                monthly_trend=monthly_trend,
                portfolio_average=0,  # Calculated below
                deviation_from_average=0,
                percentile_rank=50
            ))

        # Calculate portfolio average and rankings
        if all_costs_per_guest_night:
            portfolio_avg = sum(all_costs_per_guest_night) / len(all_costs_per_guest_night)
            sorted_costs = sorted(all_costs_per_guest_night)

            for result in results:
                result.portfolio_average = round(portfolio_avg, 2)
                if portfolio_avg > 0:
                    result.deviation_from_average = round(
                        ((result.cost_per_guest_night - portfolio_avg) / portfolio_avg) * 100, 1
                    )

                # Calculate percentile rank
                if result.cost_per_guest_night > 0:
                    rank = sorted_costs.index(result.cost_per_guest_night) + 1
                    result.percentile_rank = int((rank / len(sorted_costs)) * 100)

        # Sort by cost per guest night descending (most expensive first)
        results.sort(key=lambda x: x.cost_per_guest_night, reverse=True)

        return results

    except Exception as e:
        logger.error(f"Failed to get utility analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/{property_id}", response_model=UtilitySummary)
async def get_property_utility_summary(
    property_id: str,
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """Get utility summary for a specific property and month."""
    try:
        # Get property
        prop = db.query(Property).filter(Property.id == property_id).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")

        # Get utility expenses for this month
        utilities = db.query(TaxCategorizedExpense).filter(
            TaxCategorizedExpense.property_id == property_id,
            TaxCategorizedExpense.tax_category == TaxCategory.UTILITIES,
            extract('year', TaxCategorizedExpense.expense_date) == year,
            extract('month', TaxCategorizedExpense.expense_date) == month
        ).all()

        # Calculate costs by type
        electric_cost = sum(float(u.amount) for u in utilities if u.subcategory == "electric")
        gas_cost = sum(float(u.amount) for u in utilities if u.subcategory == "gas")
        water_cost = sum(float(u.amount) for u in utilities if u.subcategory == "water")
        internet_cost = sum(float(u.amount) for u in utilities if u.subcategory == "internet")
        trash_cost = sum(float(u.amount) for u in utilities if u.subcategory == "trash")
        other_cost = sum(float(u.amount) for u in utilities if u.subcategory not in ["electric", "gas", "water", "internet", "trash"])
        total_cost = electric_cost + gas_cost + water_cost + internet_cost + trash_cost + other_cost

        # Get bookings for this month
        bookings = db.query(Booking).filter(
            Booking.property_id == property_id,
            or_(
                and_(
                    extract('year', Booking.check_in) == year,
                    extract('month', Booking.check_in) == month
                ),
                and_(
                    extract('year', Booking.check_out) == year,
                    extract('month', Booking.check_out) == month
                )
            )
        ).all()

        guest_nights = sum(b.total_nights or 1 for b in bookings)
        total_guests = sum(b.guest_count or 1 for b in bookings)

        # Calculate intensity metrics
        cost_per_guest_night = total_cost / guest_nights if guest_nights > 0 else None
        cost_per_guest = total_cost / total_guests if total_guests > 0 else None

        # Get portfolio average for comparison
        portfolio_data = db.query(
            func.sum(TaxCategorizedExpense.amount).label('total_cost')
        ).filter(
            TaxCategorizedExpense.tax_category == TaxCategory.UTILITIES,
            extract('year', TaxCategorizedExpense.expense_date) == year,
            extract('month', TaxCategorizedExpense.expense_date) == month
        ).first()

        portfolio_bookings = db.query(
            func.sum(Booking.total_nights).label('total_nights')
        ).filter(
            extract('year', Booking.check_in) == year,
            extract('month', Booking.check_in) == month
        ).first()

        portfolio_avg = None
        deviation = None
        is_anomaly = False
        anomaly_reason = None

        if portfolio_data.total_cost and portfolio_bookings.total_nights:
            portfolio_avg = float(portfolio_data.total_cost) / float(portfolio_bookings.total_nights)

            if cost_per_guest_night:
                deviation = ((cost_per_guest_night - portfolio_avg) / portfolio_avg) * 100

                # Flag anomaly if > 25% above average
                if deviation > 25:
                    is_anomaly = True
                    anomaly_reason = f"Utility cost {deviation:.1f}% above portfolio average"

        return UtilitySummary(
            property_id=property_id,
            property_name=prop.name,
            year=year,
            month=month,
            electric_cost=electric_cost,
            gas_cost=gas_cost,
            water_cost=water_cost,
            internet_cost=internet_cost,
            trash_cost=trash_cost,
            other_cost=other_cost,
            total_cost=total_cost,
            guest_nights=guest_nights,
            total_guests=total_guests,
            bookings_count=len(bookings),
            cost_per_guest_night=round(cost_per_guest_night, 2) if cost_per_guest_night else None,
            cost_per_guest=round(cost_per_guest, 2) if cost_per_guest else None,
            portfolio_avg_cost_per_guest_night=round(portfolio_avg, 2) if portfolio_avg else None,
            deviation_percentage=round(deviation, 1) if deviation else None,
            is_anomaly=is_anomaly,
            anomaly_reason=anomaly_reason
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get utility summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/comparison")
async def get_utility_comparison(
    year: int,
    property_ids: Optional[str] = Query(None, description="Comma-separated property IDs"),
    db: Session = Depends(get_db)
):
    """Get monthly utility comparison across properties."""
    try:
        # Parse property IDs
        filter_property_ids = None
        if property_ids:
            filter_property_ids = [p.strip() for p in property_ids.split(",")]

        # Get all utility expenses for the year
        query = db.query(TaxCategorizedExpense).filter(
            TaxCategorizedExpense.tax_category == TaxCategory.UTILITIES,
            extract('year', TaxCategorizedExpense.expense_date) == year
        )

        if filter_property_ids:
            query = query.filter(TaxCategorizedExpense.property_id.in_(filter_property_ids))

        utilities = query.all()

        # Get properties
        property_ids_set = list(set(u.property_id for u in utilities))
        properties = {p.id: p.name for p in db.query(Property).filter(Property.id.in_(property_ids_set)).all()}

        # Build comparison data
        monthly_data = {m: {} for m in range(1, 13)}

        for u in utilities:
            month = u.expense_date.month
            prop_id = u.property_id

            if prop_id not in monthly_data[month]:
                monthly_data[month][prop_id] = {
                    "property_name": properties.get(prop_id, prop_id),
                    "total": 0,
                    "by_type": {}
                }

            amount = float(u.amount)
            monthly_data[month][prop_id]["total"] += amount

            utility_type = u.subcategory or "other"
            monthly_data[month][prop_id]["by_type"][utility_type] = (
                monthly_data[month][prop_id]["by_type"].get(utility_type, 0) + amount
            )

        # Calculate monthly totals and averages
        result = {
            "year": year,
            "properties": list(properties.values()),
            "monthly_comparison": [],
            "annual_totals": {}
        }

        for month in range(1, 13):
            month_entry = {
                "month": month,
                "month_name": datetime(year, month, 1).strftime("%B"),
                "properties": monthly_data[month],
                "total": sum(p["total"] for p in monthly_data[month].values())
            }
            result["monthly_comparison"].append(month_entry)

        # Calculate annual totals per property
        for prop_id in properties:
            annual_total = sum(
                monthly_data[m].get(prop_id, {}).get("total", 0)
                for m in range(1, 13)
            )
            result["annual_totals"][properties[prop_id]] = round(annual_total, 2)

        return result

    except Exception as e:
        logger.error(f"Failed to get utility comparison: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anomalies", response_model=List[AnomalyAlert])
async def get_utility_anomalies(
    acknowledged: Optional[bool] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    """Get utility anomaly alerts."""
    try:
        query = db.query(OperationalAlert).filter(
            OperationalAlert.alert_type == AlertType.UTILITY_ANOMALY
        )

        if acknowledged is not None:
            query = query.filter(OperationalAlert.is_acknowledged == acknowledged)

        query = query.order_by(OperationalAlert.created_at.desc())
        alerts = query.limit(limit).all()

        # Get property names
        property_ids = list(set(a.property_id for a in alerts if a.property_id))
        properties = {p.id: p.name for p in db.query(Property).filter(Property.id.in_(property_ids)).all()}

        result = []
        for alert in alerts:
            trigger_data = alert.trigger_data or {}

            result.append(AnomalyAlert(
                id=alert.id,
                property_id=alert.property_id or "",
                property_name=properties.get(alert.property_id, "Unknown"),
                alert_type=alert.alert_type.value,
                severity=alert.severity.value,
                title=alert.title,
                description=alert.description or "",
                expected_value=alert.threshold_value or 0,
                actual_value=alert.actual_value or 0,
                deviation_percentage=trigger_data.get("deviation_percentage", 0),
                utility_type=trigger_data.get("utility_type"),
                billing_period=trigger_data.get("billing_period"),
                is_acknowledged=alert.is_acknowledged,
                created_at=alert.created_at
            ))

        return result

    except Exception as e:
        logger.error(f"Failed to get utility anomalies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/anomalies/{alert_id}/acknowledge")
async def acknowledge_anomaly(
    alert_id: int,
    db: Session = Depends(get_db)
):
    """Acknowledge a utility anomaly alert."""
    try:
        alert = db.query(OperationalAlert).filter(
            OperationalAlert.id == alert_id,
            OperationalAlert.alert_type == AlertType.UTILITY_ANOMALY
        ).first()

        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert.is_acknowledged = True
        alert.acknowledged_at = datetime.utcnow()
        db.commit()

        return {"success": True, "message": "Alert acknowledged"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to acknowledge alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# INTENSITY METRICS
# ============================================================================

@router.get("/intensity/{property_id}", response_model=Dict[str, Any])
async def get_utility_intensity_metrics(
    property_id: str,
    year: int,
    db: Session = Depends(get_db)
):
    """Get utility intensity metrics (kWh per guest-night, etc.) for a property."""
    try:
        # Get stored intensity metrics
        metrics = db.query(UtilityIntensityMetric).filter(
            UtilityIntensityMetric.property_id == property_id,
            UtilityIntensityMetric.year == year
        ).order_by(UtilityIntensityMetric.month).all()

        if not metrics:
            # Calculate on the fly
            result = []
            for month in range(1, 13):
                summary = await get_property_utility_summary(property_id, year, month, db)
                if summary.total_cost > 0:
                    result.append({
                        "month": month,
                        "total_utility_cost": summary.total_cost,
                        "electric_cost": summary.electric_cost,
                        "water_cost": summary.water_cost,
                        "gas_cost": summary.gas_cost,
                        "guest_nights": summary.guest_nights,
                        "cost_per_guest_night": summary.cost_per_guest_night,
                        "is_anomaly": summary.is_anomaly,
                        "anomaly_reason": summary.anomaly_reason
                    })

            return {
                "property_id": property_id,
                "year": year,
                "monthly_metrics": result,
                "annual_summary": {
                    "total_cost": sum(m["total_utility_cost"] for m in result),
                    "total_guest_nights": sum(m["guest_nights"] for m in result),
                    "avg_cost_per_guest_night": (
                        sum(m["total_utility_cost"] for m in result) /
                        sum(m["guest_nights"] for m in result)
                    ) if sum(m["guest_nights"] for m in result) > 0 else 0,
                    "anomaly_count": sum(1 for m in result if m["is_anomaly"])
                }
            }

        # Use stored metrics
        result = []
        for m in metrics:
            result.append({
                "month": m.month,
                "total_utility_cost": float(m.total_utility_cost),
                "electric_cost": float(m.electric_cost),
                "water_cost": float(m.water_cost),
                "gas_cost": float(m.gas_cost),
                "guest_nights": m.guest_nights,
                "cost_per_guest_night": float(m.cost_per_guest_night) if m.cost_per_guest_night else None,
                "cost_per_guest": float(m.cost_per_guest) if m.cost_per_guest else None,
                "portfolio_avg": float(m.portfolio_avg_cost_per_guest) if m.portfolio_avg_cost_per_guest else None,
                "deviation_percentage": m.deviation_percentage,
                "is_anomaly": m.is_anomaly,
                "anomaly_reason": m.anomaly_reason
            })

        return {
            "property_id": property_id,
            "year": year,
            "monthly_metrics": result,
            "annual_summary": {
                "total_cost": sum(m["total_utility_cost"] for m in result),
                "total_guest_nights": sum(m["guest_nights"] for m in result),
                "avg_cost_per_guest_night": (
                    sum(m["total_utility_cost"] for m in result) /
                    sum(m["guest_nights"] for m in result)
                ) if sum(m["guest_nights"] for m in result) > 0 else 0,
                "anomaly_count": sum(1 for m in result if m["is_anomaly"])
            }
        }

    except Exception as e:
        logger.error(f"Failed to get intensity metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/intensity/calculate")
async def calculate_intensity_metrics(
    year: int,
    month: int,
    property_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Calculate and store utility intensity metrics."""
    try:
        # Get properties to process
        if property_id:
            properties = [db.query(Property).filter(Property.id == property_id).first()]
            if not properties[0]:
                raise HTTPException(status_code=404, detail="Property not found")
        else:
            properties = db.query(Property).all()

        processed = 0
        anomalies_found = 0

        for prop in properties:
            summary = await get_property_utility_summary(prop.id, year, month, db)

            # Check if metric already exists
            existing = db.query(UtilityIntensityMetric).filter(
                UtilityIntensityMetric.property_id == prop.id,
                UtilityIntensityMetric.year == year,
                UtilityIntensityMetric.month == month
            ).first()

            if existing:
                # Update existing
                existing.total_utility_cost = Decimal(str(summary.total_cost))
                existing.electric_cost = Decimal(str(summary.electric_cost))
                existing.water_cost = Decimal(str(summary.water_cost))
                existing.gas_cost = Decimal(str(summary.gas_cost))
                existing.guest_nights = summary.guest_nights
                existing.total_guests = summary.total_guests
                existing.cost_per_guest_night = Decimal(str(summary.cost_per_guest_night)) if summary.cost_per_guest_night else None
                existing.cost_per_guest = Decimal(str(summary.cost_per_guest)) if summary.cost_per_guest else None
                existing.portfolio_avg_cost_per_guest = Decimal(str(summary.portfolio_avg_cost_per_guest_night)) if summary.portfolio_avg_cost_per_guest_night else None
                existing.deviation_percentage = summary.deviation_percentage or 0
                existing.is_anomaly = summary.is_anomaly
                existing.anomaly_reason = summary.anomaly_reason
            else:
                # Create new
                metric = UtilityIntensityMetric(
                    property_id=prop.id,
                    year=year,
                    month=month,
                    total_utility_cost=Decimal(str(summary.total_cost)),
                    electric_cost=Decimal(str(summary.electric_cost)),
                    water_cost=Decimal(str(summary.water_cost)),
                    gas_cost=Decimal(str(summary.gas_cost)),
                    guest_nights=summary.guest_nights,
                    total_guests=summary.total_guests,
                    cost_per_guest_night=Decimal(str(summary.cost_per_guest_night)) if summary.cost_per_guest_night else None,
                    cost_per_guest=Decimal(str(summary.cost_per_guest)) if summary.cost_per_guest else None,
                    portfolio_avg_cost_per_guest=Decimal(str(summary.portfolio_avg_cost_per_guest_night)) if summary.portfolio_avg_cost_per_guest_night else None,
                    deviation_percentage=summary.deviation_percentage or 0,
                    is_anomaly=summary.is_anomaly,
                    anomaly_reason=summary.anomaly_reason
                )
                db.add(metric)

            processed += 1
            if summary.is_anomaly:
                anomalies_found += 1

        db.commit()

        return {
            "success": True,
            "processed": processed,
            "anomalies_found": anomalies_found,
            "period": f"{year}-{month:02d}"
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to calculate intensity metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def _check_utility_anomaly(
    db: Session,
    property_id: str,
    utility_type: str,
    amount: float,
    bill_date: date
):
    """Check if a utility bill is an anomaly and create alert if so."""
    try:
        # Get average for this utility type over last 6 months
        six_months_ago = date(bill_date.year, bill_date.month, 1)
        if bill_date.month <= 6:
            six_months_ago = date(bill_date.year - 1, bill_date.month + 6, 1)
        else:
            six_months_ago = date(bill_date.year, bill_date.month - 6, 1)

        avg_result = db.query(
            func.avg(TaxCategorizedExpense.amount).label('avg_amount')
        ).filter(
            TaxCategorizedExpense.property_id == property_id,
            TaxCategorizedExpense.subcategory == utility_type,
            TaxCategorizedExpense.expense_date >= six_months_ago,
            TaxCategorizedExpense.expense_date < bill_date
        ).first()

        if not avg_result or not avg_result.avg_amount:
            return

        avg_amount = float(avg_result.avg_amount)
        if avg_amount == 0:
            return

        deviation = ((amount - avg_amount) / avg_amount) * 100

        # Flag as anomaly if > 30% above average
        if deviation > 30:
            # Get property name
            prop = db.query(Property).filter(Property.id == property_id).first()

            # Create alert
            alert = OperationalAlert(
                property_id=property_id,
                alert_type=AlertType.UTILITY_ANOMALY,
                severity=AlertSeverity.WARNING if deviation < 50 else AlertSeverity.CRITICAL,
                title=f"High {utility_type.title()} Bill - {prop.name if prop else property_id}",
                description=f"${amount:.2f} is {deviation:.1f}% above the 6-month average of ${avg_amount:.2f}",
                trigger_data={
                    "utility_type": utility_type,
                    "amount": amount,
                    "average": avg_amount,
                    "deviation_percentage": deviation,
                    "billing_period": bill_date.isoformat()
                },
                threshold_value=avg_amount,
                actual_value=amount,
                is_active=True
            )

            db.add(alert)
            db.commit()

            logger.warning(f"Utility anomaly detected: {utility_type} ${amount} for {property_id} ({deviation:.1f}% above avg)")

    except Exception as e:
        logger.error(f"Failed to check utility anomaly: {e}")
