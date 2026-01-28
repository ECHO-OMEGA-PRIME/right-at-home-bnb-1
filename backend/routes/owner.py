"""
Right At Home BnB - Property Owner Portal API Routes
====================================================
API endpoints for property owners to view their financial data,
earnings statements, reports, and property performance.

Features:
- Dashboard overview with earnings summary
- Detailed earnings breakdown (gross, fees, expenses, net)
- Monthly/quarterly statements
- PDF export for statements
- Role-based access (owner sees only their properties)

@author ECHO OMEGA PRIME
@owner Right at Home BnB - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Query, Depends, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from enum import Enum
import io
import json

router = APIRouter(prefix="/owner", tags=["Owner Portal"])


# ==============================================================================
# REQUEST/RESPONSE MODELS
# ==============================================================================

class TimeRange(str, Enum):
    """Time range options for reports."""
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"
    CUSTOM = "custom"


class OwnerDashboardResponse(BaseModel):
    """Owner dashboard overview data."""
    owner_id: str
    owner_name: str
    properties_count: int
    total_properties: List[Dict[str, Any]]

    # Monthly summary
    monthly_earnings: float
    monthly_expenses: float
    monthly_net_payout: float

    # YTD summary
    ytd_revenue: float
    ytd_expenses: float
    ytd_net_payout: float

    # Performance metrics
    avg_occupancy_rate: float
    avg_nightly_rate: float
    avg_guest_rating: float

    # Upcoming bookings
    upcoming_bookings: List[Dict[str, Any]]

    # Recent expenses
    recent_expenses: List[Dict[str, Any]]

    # Maintenance requests
    pending_maintenance: List[Dict[str, Any]]

    # Month over month changes
    revenue_change_percent: float
    occupancy_change_percent: float


class EarningsBreakdownResponse(BaseModel):
    """Detailed earnings breakdown for a property or all properties."""
    period: str
    start_date: str
    end_date: str
    properties: List[Dict[str, Any]]

    # Revenue breakdown
    gross_revenue: float
    nightly_revenue: float
    cleaning_fees_collected: float
    other_income: float

    # Platform fees
    airbnb_fees: float
    vrbo_fees: float
    direct_booking_fees: float
    total_platform_fees: float

    # Operating expenses
    cleaning_costs: float
    maintenance_costs: float
    supplies_costs: float
    utilities_costs: float
    insurance_costs: float
    property_tax: float
    management_fee: float
    other_expenses: float
    total_expenses: float

    # Net calculations
    net_before_management: float
    net_payout: float

    # Per-property breakdown
    property_breakdown: List[Dict[str, Any]]


class MonthlyStatementResponse(BaseModel):
    """Monthly owner statement."""
    statement_id: str
    owner_id: str
    owner_name: str
    statement_period: str
    generated_at: str

    # Summary
    total_gross_revenue: float
    total_fees: float
    total_expenses: float
    net_payout: float

    # Payment info
    payment_status: str
    payment_date: Optional[str]
    payment_method: str

    # Line items
    revenue_items: List[Dict[str, Any]]
    fee_items: List[Dict[str, Any]]
    expense_items: List[Dict[str, Any]]

    # Notes
    notes: Optional[str]


# ==============================================================================
# MOCK DATA GENERATORS (Replace with actual database queries)
# ==============================================================================

def get_mock_owner_properties(owner_id: str) -> List[Dict[str, Any]]:
    """Get properties owned by this owner."""
    # In production, this queries the database for properties where owner_id matches
    mock_properties = [
        {
            "id": "prop_1",
            "name": "Castleford Estate",
            "address": "123 Castle Dr, Midland, TX 79705",
            "bedrooms": 4,
            "bathrooms": 3,
            "status": "ACTIVE",
            "current_booking": {"guest": "John Smith", "check_out": "2026-01-20"},
        },
        {
            "id": "prop_2",
            "name": "Basin View Cottage",
            "address": "456 Basin Rd, Midland, TX 79701",
            "bedrooms": 3,
            "bathrooms": 2,
            "status": "ACTIVE",
            "current_booking": None,
        },
        {
            "id": "prop_3",
            "name": "Desert Rose Villa",
            "address": "789 Rose Ln, Midland, TX 79703",
            "bedrooms": 5,
            "bathrooms": 4,
            "status": "MAINTENANCE",
            "current_booking": None,
        },
    ]
    return mock_properties


def get_mock_earnings_data(owner_id: str, year: int, month: int) -> Dict[str, Any]:
    """Get mock earnings data for owner."""
    base_revenue = 15000 + (month * 500)  # Simulate seasonal variation
    return {
        "gross_revenue": base_revenue,
        "nightly_revenue": base_revenue * 0.85,
        "cleaning_fees_collected": base_revenue * 0.10,
        "other_income": base_revenue * 0.05,
        "airbnb_fees": base_revenue * 0.03,
        "vrbo_fees": base_revenue * 0.025,
        "direct_booking_fees": 0,
        "cleaning_costs": 1200,
        "maintenance_costs": 450,
        "supplies_costs": 180,
        "utilities_costs": 850,
        "insurance_costs": 400,
        "property_tax": 500,
        "management_fee": base_revenue * 0.15,
        "other_expenses": 120,
    }


# ==============================================================================
# OWNER DASHBOARD ENDPOINT
# ==============================================================================

@router.get("/dashboard", response_model=OwnerDashboardResponse)
async def get_owner_dashboard(
    owner_id: str = Query(..., description="Owner's user ID"),
    year: Optional[int] = Query(None, description="Year (defaults to current)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12)"),
):
    """
    Get owner dashboard overview with:
    - Monthly earnings summary
    - Upcoming bookings
    - Recent expenses
    - Occupancy rates
    - Maintenance requests
    """
    now = datetime.now()
    year = year or now.year
    month = month or now.month

    # Get owner's properties (role-based filtering)
    properties = get_mock_owner_properties(owner_id)

    if not properties:
        raise HTTPException(status_code=404, detail="No properties found for this owner")

    # Get earnings data
    earnings = get_mock_earnings_data(owner_id, year, month)
    total_expenses = (
        earnings["cleaning_costs"] +
        earnings["maintenance_costs"] +
        earnings["supplies_costs"] +
        earnings["utilities_costs"] +
        earnings["insurance_costs"] +
        earnings["property_tax"] +
        earnings["management_fee"] +
        earnings["other_expenses"]
    )
    total_fees = earnings["airbnb_fees"] + earnings["vrbo_fees"]
    net_payout = earnings["gross_revenue"] - total_fees - total_expenses

    # YTD calculations (sum up months)
    ytd_revenue = earnings["gross_revenue"] * month
    ytd_expenses = total_expenses * month
    ytd_net = net_payout * month

    # Mock upcoming bookings
    upcoming_bookings = [
        {
            "id": "book_1",
            "property": "Castleford Estate",
            "guest_name": "Sarah Johnson",
            "check_in": "2026-01-22",
            "check_out": "2026-01-25",
            "total": 1250.00,
            "platform": "VRBO",
        },
        {
            "id": "book_2",
            "property": "Basin View Cottage",
            "guest_name": "Michael Chen",
            "check_in": "2026-01-24",
            "check_out": "2026-01-27",
            "total": 980.00,
            "platform": "Airbnb",
        },
        {
            "id": "book_3",
            "property": "Castleford Estate",
            "guest_name": "Emily Davis",
            "check_in": "2026-01-28",
            "check_out": "2026-02-02",
            "total": 2100.00,
            "platform": "Direct",
        },
    ]

    # Mock recent expenses
    recent_expenses = [
        {
            "id": "exp_1",
            "property": "Castleford Estate",
            "category": "Cleaning",
            "amount": 150.00,
            "date": "2026-01-17",
            "vendor": "Maria's Cleaning",
        },
        {
            "id": "exp_2",
            "property": "Basin View Cottage",
            "category": "Maintenance",
            "amount": 275.00,
            "date": "2026-01-15",
            "vendor": "ABC Plumbing",
        },
        {
            "id": "exp_3",
            "property": "Desert Rose Villa",
            "category": "Supplies",
            "amount": 89.50,
            "date": "2026-01-14",
            "vendor": "Costco",
        },
    ]

    # Mock maintenance requests
    pending_maintenance = [
        {
            "id": "maint_1",
            "property": "Desert Rose Villa",
            "issue": "HVAC not cooling properly",
            "priority": "HIGH",
            "reported_at": "2026-01-16",
            "status": "SCHEDULED",
        },
        {
            "id": "maint_2",
            "property": "Castleford Estate",
            "issue": "Garbage disposal making noise",
            "priority": "MEDIUM",
            "reported_at": "2026-01-17",
            "status": "PENDING",
        },
    ]

    return OwnerDashboardResponse(
        owner_id=owner_id,
        owner_name="Property Owner",
        properties_count=len(properties),
        total_properties=properties,
        monthly_earnings=earnings["gross_revenue"],
        monthly_expenses=total_expenses,
        monthly_net_payout=net_payout,
        ytd_revenue=ytd_revenue,
        ytd_expenses=ytd_expenses,
        ytd_net_payout=ytd_net,
        avg_occupancy_rate=0.78,
        avg_nightly_rate=245.00,
        avg_guest_rating=4.85,
        upcoming_bookings=upcoming_bookings,
        recent_expenses=recent_expenses,
        pending_maintenance=pending_maintenance,
        revenue_change_percent=8.5,
        occupancy_change_percent=3.2,
    )


# ==============================================================================
# EARNINGS BREAKDOWN ENDPOINT
# ==============================================================================

@router.get("/earnings", response_model=EarningsBreakdownResponse)
async def get_owner_earnings(
    owner_id: str = Query(..., description="Owner's user ID"),
    property_id: Optional[str] = Query(None, description="Filter by property ID"),
    year: int = Query(..., description="Year"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12)"),
    quarter: Optional[int] = Query(None, ge=1, le=4, description="Quarter (1-4)"),
    time_range: TimeRange = Query(TimeRange.MONTHLY, description="Time range"),
):
    """
    Get detailed earnings breakdown with:
    - Gross revenue by source
    - Platform fees (VRBO, Airbnb)
    - Operating expenses by category
    - Net payout calculations
    - Per-property breakdown
    """
    now = datetime.now()

    # Determine date range
    if time_range == TimeRange.MONTHLY:
        month = month or now.month
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        period = f"{start_date.strftime('%B %Y')}"
    elif time_range == TimeRange.QUARTERLY:
        quarter = quarter or ((now.month - 1) // 3 + 1)
        start_month = (quarter - 1) * 3 + 1
        end_month = quarter * 3
        start_date = date(year, start_month, 1)
        if end_month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, end_month + 1, 1) - timedelta(days=1)
        period = f"Q{quarter} {year}"
    else:  # Annual
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        period = str(year)

    # Get properties (filtered if property_id provided)
    all_properties = get_mock_owner_properties(owner_id)
    if property_id:
        all_properties = [p for p in all_properties if p["id"] == property_id]

    if not all_properties:
        raise HTTPException(status_code=404, detail="No properties found")

    # Aggregate earnings across properties
    total_gross = 0
    total_nightly = 0
    total_cleaning_collected = 0
    total_other = 0
    total_airbnb_fees = 0
    total_vrbo_fees = 0
    total_cleaning_costs = 0
    total_maintenance = 0
    total_supplies = 0
    total_utilities = 0
    total_insurance = 0
    total_property_tax = 0
    total_management = 0
    total_other_exp = 0

    property_breakdown = []

    # Calculate months in period
    if time_range == TimeRange.MONTHLY:
        months_count = 1
    elif time_range == TimeRange.QUARTERLY:
        months_count = 3
    else:
        months_count = 12

    for prop in all_properties:
        # Get earnings for each property
        earnings = get_mock_earnings_data(owner_id, year, month or now.month)

        # Scale by months if needed
        multiplier = months_count

        prop_gross = earnings["gross_revenue"] * multiplier
        prop_nightly = earnings["nightly_revenue"] * multiplier
        prop_cleaning_collected = earnings["cleaning_fees_collected"] * multiplier
        prop_other = earnings["other_income"] * multiplier
        prop_airbnb = earnings["airbnb_fees"] * multiplier
        prop_vrbo = earnings["vrbo_fees"] * multiplier
        prop_cleaning_cost = earnings["cleaning_costs"] * multiplier
        prop_maintenance = earnings["maintenance_costs"] * multiplier
        prop_supplies = earnings["supplies_costs"] * multiplier
        prop_utilities = earnings["utilities_costs"] * multiplier
        prop_insurance = earnings["insurance_costs"] * multiplier
        prop_tax = earnings["property_tax"] * multiplier
        prop_management = earnings["management_fee"] * multiplier
        prop_other_exp = earnings["other_expenses"] * multiplier

        prop_total_fees = prop_airbnb + prop_vrbo
        prop_total_expenses = (
            prop_cleaning_cost + prop_maintenance + prop_supplies +
            prop_utilities + prop_insurance + prop_tax +
            prop_management + prop_other_exp
        )
        prop_net = prop_gross - prop_total_fees - prop_total_expenses

        property_breakdown.append({
            "property_id": prop["id"],
            "property_name": prop["name"],
            "gross_revenue": prop_gross,
            "platform_fees": prop_total_fees,
            "expenses": prop_total_expenses,
            "net_payout": prop_net,
            "occupancy_rate": 0.75 + (0.1 * (int(prop["id"][-1]) % 3)),
        })

        # Aggregate totals
        total_gross += prop_gross
        total_nightly += prop_nightly
        total_cleaning_collected += prop_cleaning_collected
        total_other += prop_other
        total_airbnb_fees += prop_airbnb
        total_vrbo_fees += prop_vrbo
        total_cleaning_costs += prop_cleaning_cost
        total_maintenance += prop_maintenance
        total_supplies += prop_supplies
        total_utilities += prop_utilities
        total_insurance += prop_insurance
        total_property_tax += prop_tax
        total_management += prop_management
        total_other_exp += prop_other_exp

    total_fees = total_airbnb_fees + total_vrbo_fees
    total_expenses = (
        total_cleaning_costs + total_maintenance + total_supplies +
        total_utilities + total_insurance + total_property_tax +
        total_management + total_other_exp
    )
    net_before_management = total_gross - total_fees - (total_expenses - total_management)
    net_payout = total_gross - total_fees - total_expenses

    return EarningsBreakdownResponse(
        period=period,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        properties=[{"id": p["id"], "name": p["name"]} for p in all_properties],
        gross_revenue=total_gross,
        nightly_revenue=total_nightly,
        cleaning_fees_collected=total_cleaning_collected,
        other_income=total_other,
        airbnb_fees=total_airbnb_fees,
        vrbo_fees=total_vrbo_fees,
        direct_booking_fees=0,
        total_platform_fees=total_fees,
        cleaning_costs=total_cleaning_costs,
        maintenance_costs=total_maintenance,
        supplies_costs=total_supplies,
        utilities_costs=total_utilities,
        insurance_costs=total_insurance,
        property_tax=total_property_tax,
        management_fee=total_management,
        other_expenses=total_other_exp,
        total_expenses=total_expenses,
        net_before_management=net_before_management,
        net_payout=net_payout,
        property_breakdown=property_breakdown,
    )


# ==============================================================================
# MONTHLY STATEMENTS ENDPOINT
# ==============================================================================

@router.get("/statements")
async def list_owner_statements(
    owner_id: str = Query(..., description="Owner's user ID"),
    year: Optional[int] = Query(None, description="Filter by year"),
    limit: int = Query(12, ge=1, le=24, description="Number of statements"),
):
    """
    List all monthly statements for an owner.
    Returns summary list with links to detailed views.
    """
    now = datetime.now()
    year = year or now.year

    statements = []
    for m in range(now.month if year == now.year else 12, 0, -1):
        if len(statements) >= limit:
            break

        earnings = get_mock_earnings_data(owner_id, year, m)
        total_fees = earnings["airbnb_fees"] + earnings["vrbo_fees"]
        total_expenses = (
            earnings["cleaning_costs"] + earnings["maintenance_costs"] +
            earnings["supplies_costs"] + earnings["utilities_costs"] +
            earnings["insurance_costs"] + earnings["property_tax"] +
            earnings["management_fee"] + earnings["other_expenses"]
        )
        net = earnings["gross_revenue"] - total_fees - total_expenses

        statement_date = date(year, m, 1)
        statements.append({
            "id": f"stmt_{year}_{m:02d}_{owner_id[:8]}",
            "period": statement_date.strftime("%B %Y"),
            "year": year,
            "month": m,
            "gross_revenue": earnings["gross_revenue"],
            "total_fees": total_fees,
            "total_expenses": total_expenses,
            "net_payout": net,
            "status": "PAID" if m < now.month else "PENDING",
            "payment_date": f"{year}-{m+1:02d}-05" if m < now.month else None,
        })

    return {
        "owner_id": owner_id,
        "year": year,
        "statements": statements,
        "total_count": len(statements),
    }


@router.get("/statements/{statement_id}")
async def get_statement_detail(
    statement_id: str,
    owner_id: str = Query(..., description="Owner's user ID"),
):
    """
    Get detailed monthly statement with full line-item breakdown.
    """
    # Parse statement ID
    parts = statement_id.split("_")
    if len(parts) < 3:
        raise HTTPException(status_code=400, detail="Invalid statement ID format")

    year = int(parts[1])
    month = int(parts[2])

    # Get properties
    properties = get_mock_owner_properties(owner_id)

    # Get earnings
    earnings = get_mock_earnings_data(owner_id, year, month)
    total_fees = earnings["airbnb_fees"] + earnings["vrbo_fees"]
    total_expenses = (
        earnings["cleaning_costs"] + earnings["maintenance_costs"] +
        earnings["supplies_costs"] + earnings["utilities_costs"] +
        earnings["insurance_costs"] + earnings["property_tax"] +
        earnings["management_fee"] + earnings["other_expenses"]
    )
    net = earnings["gross_revenue"] - total_fees - total_expenses

    statement_date = date(year, month, 1)

    # Build line items
    revenue_items = [
        {"description": "Nightly Rate Revenue", "amount": earnings["nightly_revenue"], "category": "revenue"},
        {"description": "Cleaning Fees Collected", "amount": earnings["cleaning_fees_collected"], "category": "revenue"},
        {"description": "Other Income", "amount": earnings["other_income"], "category": "revenue"},
    ]

    fee_items = [
        {"description": "Airbnb Service Fees", "amount": -earnings["airbnb_fees"], "category": "fee"},
        {"description": "VRBO Service Fees", "amount": -earnings["vrbo_fees"], "category": "fee"},
    ]

    expense_items = [
        {"description": "Cleaning Services", "amount": -earnings["cleaning_costs"], "category": "expense", "vendor": "Various Cleaners"},
        {"description": "Maintenance & Repairs", "amount": -earnings["maintenance_costs"], "category": "expense", "vendor": "Various"},
        {"description": "Guest Supplies", "amount": -earnings["supplies_costs"], "category": "expense", "vendor": "Costco/HEB"},
        {"description": "Utilities (Electric, Water, Gas)", "amount": -earnings["utilities_costs"], "category": "expense", "vendor": "Various"},
        {"description": "Property Insurance", "amount": -earnings["insurance_costs"], "category": "expense", "vendor": "State Farm"},
        {"description": "Property Tax (Monthly)", "amount": -earnings["property_tax"], "category": "expense", "vendor": "Midland County"},
        {"description": "Management Fee (15%)", "amount": -earnings["management_fee"], "category": "expense", "vendor": "Right at Home BnB"},
        {"description": "Other Operating Expenses", "amount": -earnings["other_expenses"], "category": "expense", "vendor": "Various"},
    ]

    return MonthlyStatementResponse(
        statement_id=statement_id,
        owner_id=owner_id,
        owner_name="Property Owner",
        statement_period=statement_date.strftime("%B %Y"),
        generated_at=datetime.now().isoformat(),
        total_gross_revenue=earnings["gross_revenue"],
        total_fees=total_fees,
        total_expenses=total_expenses,
        net_payout=net,
        payment_status="PAID" if month < datetime.now().month else "PENDING",
        payment_date=f"{year}-{month+1:02d}-05" if month < datetime.now().month else None,
        payment_method="ACH Direct Deposit",
        revenue_items=revenue_items,
        fee_items=fee_items,
        expense_items=expense_items,
        notes="Thank you for partnering with Right at Home BnB!",
    )


# ==============================================================================
# PDF EXPORT ENDPOINT
# ==============================================================================

@router.get("/statements/{statement_id}/pdf")
async def download_statement_pdf(
    statement_id: str,
    owner_id: str = Query(..., description="Owner's user ID"),
):
    """
    Download monthly statement as PDF.
    Returns a downloadable PDF file.
    """
    # In production, use a PDF library like ReportLab or WeasyPrint
    # For now, return a placeholder response

    # Parse statement ID
    parts = statement_id.split("_")
    if len(parts) < 3:
        raise HTTPException(status_code=400, detail="Invalid statement ID format")

    year = int(parts[1])
    month = int(parts[2])

    statement_date = date(year, month, 1)
    filename = f"Statement_{statement_date.strftime('%Y-%m')}.pdf"

    # Create a simple text representation (replace with actual PDF generation)
    content = f"""
RIGHT AT HOME BNB
Property Owner Statement
========================

Period: {statement_date.strftime('%B %Y')}
Owner ID: {owner_id}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}

This is a placeholder PDF. In production, this would contain:
- Detailed revenue breakdown
- Platform fee itemization
- Expense line items
- Net payout calculation
- Payment information

For the full statement, please visit the owner portal.
    """

    # Return as downloadable file
    return Response(
        content=content.encode('utf-8'),
        media_type="text/plain",  # Change to "application/pdf" when using actual PDF
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        }
    )


# ==============================================================================
# REPORTS ENDPOINT
# ==============================================================================

@router.get("/reports")
async def get_owner_reports(
    owner_id: str = Query(..., description="Owner's user ID"),
    report_type: str = Query("performance", description="Report type: performance, tax, comparison"),
    year: int = Query(..., description="Report year"),
    quarter: Optional[int] = Query(None, ge=1, le=4, description="Quarter for quarterly reports"),
):
    """
    Generate various reports for property owners:
    - Performance: Occupancy, revenue trends, guest ratings
    - Tax: Schedule E summary, deductible expenses
    - Comparison: Property-to-property performance comparison
    """
    properties = get_mock_owner_properties(owner_id)

    if report_type == "performance":
        # Performance report
        monthly_data = []
        for m in range(1, 13):
            earnings = get_mock_earnings_data(owner_id, year, m)
            monthly_data.append({
                "month": date(year, m, 1).strftime("%B"),
                "revenue": earnings["gross_revenue"] * len(properties),
                "occupancy": 0.65 + (m % 4) * 0.05,
                "avg_nightly_rate": 195 + (m % 3) * 25,
                "bookings_count": 8 + (m % 3),
            })

        return {
            "report_type": "performance",
            "year": year,
            "properties_count": len(properties),
            "total_revenue": sum(d["revenue"] for d in monthly_data),
            "avg_occupancy": sum(d["occupancy"] for d in monthly_data) / 12,
            "avg_nightly_rate": sum(d["avg_nightly_rate"] for d in monthly_data) / 12,
            "total_bookings": sum(d["bookings_count"] for d in monthly_data),
            "monthly_data": monthly_data,
        }

    elif report_type == "tax":
        # Tax report (Schedule E format)
        total_gross = 0
        total_expenses_by_category = {
            "advertising": 0,
            "auto_travel": 0,
            "cleaning_maintenance": 0,
            "commissions": 0,
            "insurance": 0,
            "legal_professional": 0,
            "management_fees": 0,
            "mortgage_interest": 0,
            "other_interest": 0,
            "repairs": 0,
            "supplies": 0,
            "taxes": 0,
            "utilities": 0,
            "depreciation": 0,
            "other": 0,
        }

        for m in range(1, 13):
            earnings = get_mock_earnings_data(owner_id, year, m)
            total_gross += earnings["gross_revenue"] * len(properties)
            total_expenses_by_category["cleaning_maintenance"] += earnings["cleaning_costs"] * len(properties)
            total_expenses_by_category["repairs"] += earnings["maintenance_costs"] * len(properties)
            total_expenses_by_category["supplies"] += earnings["supplies_costs"] * len(properties)
            total_expenses_by_category["utilities"] += earnings["utilities_costs"] * len(properties)
            total_expenses_by_category["insurance"] += earnings["insurance_costs"] * len(properties)
            total_expenses_by_category["taxes"] += earnings["property_tax"] * len(properties)
            total_expenses_by_category["management_fees"] += earnings["management_fee"] * len(properties)
            total_expenses_by_category["other"] += earnings["other_expenses"] * len(properties)

        total_expenses = sum(total_expenses_by_category.values())

        return {
            "report_type": "tax",
            "year": year,
            "schedule_e_summary": {
                "gross_rents": total_gross,
                "total_expenses": total_expenses,
                "net_profit_loss": total_gross - total_expenses,
            },
            "expense_categories": total_expenses_by_category,
            "properties": [{"id": p["id"], "name": p["name"], "address": p["address"]} for p in properties],
            "note": "This is a summary only. Consult your tax professional for official Schedule E preparation.",
        }

    elif report_type == "comparison":
        # Property comparison report
        comparison = []
        for prop in properties:
            # Simulated property-specific metrics
            prop_revenue = 0
            prop_expenses = 0
            for m in range(1, 13):
                earnings = get_mock_earnings_data(owner_id, year, m)
                multiplier = 1.0 + (int(prop["id"][-1]) % 3) * 0.1
                prop_revenue += earnings["gross_revenue"] * multiplier
                prop_expenses += (earnings["cleaning_costs"] + earnings["maintenance_costs"]) * multiplier

            comparison.append({
                "property_id": prop["id"],
                "property_name": prop["name"],
                "total_revenue": prop_revenue,
                "total_expenses": prop_expenses,
                "net_profit": prop_revenue - prop_expenses,
                "profit_margin": (prop_revenue - prop_expenses) / prop_revenue * 100 if prop_revenue > 0 else 0,
                "occupancy_rate": 0.70 + (int(prop["id"][-1]) % 3) * 0.08,
                "avg_nightly_rate": 185 + (int(prop["id"][-1]) % 4) * 30,
                "avg_rating": 4.5 + (int(prop["id"][-1]) % 5) * 0.1,
            })

        # Sort by profit
        comparison.sort(key=lambda x: x["net_profit"], reverse=True)

        return {
            "report_type": "comparison",
            "year": year,
            "properties": comparison,
            "top_performer": comparison[0]["property_name"] if comparison else None,
            "total_portfolio_revenue": sum(p["total_revenue"] for p in comparison),
            "total_portfolio_profit": sum(p["net_profit"] for p in comparison),
        }

    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {report_type}")


# ==============================================================================
# OWNER PROPERTIES ENDPOINT
# ==============================================================================

@router.get("/properties")
async def list_owner_properties(
    owner_id: str = Query(..., description="Owner's user ID"),
    include_stats: bool = Query(True, description="Include performance statistics"),
):
    """
    List all properties owned by this owner with optional stats.
    Role-based filtering ensures owners only see their own properties.
    """
    properties = get_mock_owner_properties(owner_id)

    result = []
    for prop in properties:
        prop_data = {
            "id": prop["id"],
            "name": prop["name"],
            "address": prop["address"],
            "bedrooms": prop["bedrooms"],
            "bathrooms": prop["bathrooms"],
            "status": prop["status"],
            "current_booking": prop.get("current_booking"),
        }

        if include_stats:
            # Add performance stats
            now = datetime.now()
            earnings = get_mock_earnings_data(owner_id, now.year, now.month)
            prop_data["stats"] = {
                "monthly_revenue": earnings["gross_revenue"],
                "monthly_occupancy": 0.75 + (int(prop["id"][-1]) % 3) * 0.08,
                "ytd_revenue": earnings["gross_revenue"] * now.month,
                "avg_rating": 4.7 + (int(prop["id"][-1]) % 3) * 0.1,
                "total_bookings_ytd": 45 + (int(prop["id"][-1]) % 10),
            }

        result.append(prop_data)

    return {
        "owner_id": owner_id,
        "properties_count": len(result),
        "properties": result,
    }
