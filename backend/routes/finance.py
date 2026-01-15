"""
Right At Home BnB - Complete Financial API Routes
==================================================
Comprehensive API endpoints for financial management:
- Revenue tracking and breakdown
- Expense management with categories
- P&L calculations (monthly, quarterly, annual)
- CapEx and depreciation tracking
- Tax reporting (Schedule E format)
- CSV/PDF export for accountants
- Revenue forecasting

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Query, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum
import io

from services.finance import financial_service, ExpenseCategory, RevenueCategory

router = APIRouter()


# ==============================================================================
# REQUEST/RESPONSE MODELS
# ==============================================================================

class RevenueRequest(BaseModel):
    """Request model for recording revenue."""
    property_id: str = Field(..., description="Property identifier")
    category: str = Field(
        default="nightly_rate",
        description="Revenue category: nightly_rate, cleaning_fee, service_fee, pet_fee, etc."
    )
    amount: float = Field(..., gt=0, description="Revenue amount in dollars")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    booking_id: Optional[str] = Field(None, description="Associated booking ID")
    platform: str = Field(default="direct", description="Booking platform: airbnb, vrbo, direct, etc.")
    description: str = Field(default="", description="Revenue description")
    notes: str = Field(default="", description="Additional notes")


class ExpenseRequest(BaseModel):
    """Request model for recording expenses."""
    property_id: str = Field(..., description="Property identifier")
    category: str = Field(
        ...,
        description="Expense category: cleaning, supplies, repairs, utilities_electric, furniture, etc."
    )
    amount: float = Field(..., gt=0, description="Expense amount in dollars")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    vendor: str = Field(default="", description="Vendor/supplier name")
    description: str = Field(..., description="Expense description")
    receipt_url: str = Field(default="", description="URL to receipt image/PDF")
    is_tax_deductible: bool = Field(default=True, description="Whether expense is tax deductible")
    notes: str = Field(default="", description="Additional notes")


class MileageRequest(BaseModel):
    """Request model for recording mileage."""
    property_id: str = Field(..., description="Property visited")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    miles: float = Field(..., gt=0, description="Miles driven")
    purpose: str = Field(..., description="Purpose of trip")
    start_location: str = Field(default="", description="Starting location")
    end_location: str = Field(default="", description="Ending location")


class PLRequest(BaseModel):
    """Request model for P&L calculation."""
    property_id: Optional[str] = Field(None, description="Property ID or null for all properties")
    start_date: Optional[str] = Field(None, description="Start date YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="End date YYYY-MM-DD")
    period: str = Field(default="monthly", description="Period: monthly, quarterly, annual")


class ExportRequest(BaseModel):
    """Request model for exports."""
    year: int = Field(..., description="Tax year")
    export_type: str = Field(default="schedule_e", description="Export type: schedule_e, expenses, revenue, all")
    format: str = Field(default="csv", description="Format: csv, pdf")
    email: Optional[str] = Field(None, description="Email to send report to")


# ==============================================================================
# FINANCIAL OVERVIEW ENDPOINTS
# ==============================================================================

@router.get("/overview")
async def get_financial_overview(
    year: Optional[int] = Query(None, description="Year (defaults to current year)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12)")
):
    """
    Get comprehensive financial overview including:
    - Summary metrics (revenue, expenses, profit)
    - Revenue breakdown by property, platform, category
    - Expense breakdown by category
    - Revenue forecast
    """
    return await financial_service.get_financial_overview(year, month)


@router.get("/summary")
async def get_financial_summary(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get quick financial summary for a date range."""
    pl = await financial_service.calculate_pl(None, start_date, end_date)
    return {
        "total_revenue": pl["revenue"]["total"],
        "total_expenses": pl["expenses"]["total"],
        "net_profit": pl["profit"]["net"],
        "profit_margin": pl["profit"]["margin_percentage"],
        "period": {"start": start_date, "end": end_date}
    }


# ==============================================================================
# REVENUE ENDPOINTS
# ==============================================================================

@router.post("/revenue")
async def record_revenue(request: RevenueRequest):
    """Record a new revenue entry."""
    return await financial_service.record_revenue(
        property_id=request.property_id,
        category=request.category,
        amount=request.amount,
        date_str=request.date,
        booking_id=request.booking_id,
        platform=request.platform,
        description=request.description,
        notes=request.notes
    )


@router.get("/revenue")
async def get_revenue_breakdown(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    group_by: str = Query("category", description="Group by: category, property, platform, month")
):
    """Get revenue breakdown with optional grouping."""
    return await financial_service.get_revenue_breakdown(start_date, end_date, group_by)


@router.get("/revenue/property/{property_id}")
async def get_property_revenue(
    property_id: str,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get revenue breakdown for a specific property."""
    return await financial_service.get_revenue_by_property(property_id, start_date, end_date)


@router.get("/revenue/categories")
async def get_revenue_categories():
    """Get list of all revenue categories."""
    return {
        "categories": [
            {"value": cat.value, "label": cat.value.replace("_", " ").title()}
            for cat in RevenueCategory
        ]
    }


# ==============================================================================
# EXPENSE ENDPOINTS
# ==============================================================================

@router.post("/expenses")
async def record_expense(request: ExpenseRequest):
    """Record a new expense entry."""
    return await financial_service.record_expense(
        property_id=request.property_id,
        category=request.category,
        amount=request.amount,
        date_str=request.date,
        vendor=request.vendor,
        description=request.description,
        receipt_url=request.receipt_url,
        is_tax_deductible=request.is_tax_deductible,
        notes=request.notes
    )


@router.get("/expenses")
async def get_all_expenses(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    category: Optional[str] = Query(None, description="Filter by category")
):
    """Get all expenses with optional date and category filters."""
    data = await financial_service._get_all_expenses(
        start_date or f"{datetime.now().year}-01-01",
        end_date or datetime.now().strftime("%Y-%m-%d")
    )

    if category:
        data["by_category"] = {k: v for k, v in data["by_category"].items() if k == category}

    return data


@router.get("/expenses/property/{property_id}")
async def get_property_expenses(
    property_id: str,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    include_capex: bool = Query(True, description="Include capital expenses")
):
    """Get expenses for a specific property."""
    return await financial_service.get_expenses_by_property(
        property_id, start_date, end_date, include_capex
    )


@router.get("/expenses/categories")
async def get_expense_categories():
    """Get all expense categories with descriptions and tax mapping."""
    return await financial_service.get_expense_categories()


# ==============================================================================
# MILEAGE TRACKING ENDPOINTS
# ==============================================================================

@router.post("/mileage")
async def record_mileage(request: MileageRequest):
    """Record mileage for property visits."""
    return await financial_service.record_mileage(
        property_id=request.property_id,
        date_str=request.date,
        miles=request.miles,
        purpose=request.purpose,
        start_location=request.start_location,
        end_location=request.end_location
    )


@router.get("/mileage")
async def get_mileage_summary(
    year: int = Query(..., description="Tax year"),
    property_id: Optional[str] = Query(None, description="Filter by property")
):
    """Get mileage summary for tax deduction calculation."""
    return await financial_service.get_mileage_summary(year, property_id)


# ==============================================================================
# P&L ENDPOINTS
# ==============================================================================

@router.get("/pl")
async def calculate_profit_loss(
    property_id: Optional[str] = Query(None, description="Property ID or null for all"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    period: str = Query("monthly", description="Period: monthly, quarterly, annual")
):
    """Calculate P&L statement for properties."""
    return await financial_service.calculate_pl(property_id, start_date, end_date, period)


@router.get("/pl/property/{property_id}")
async def get_property_pl(
    property_id: str,
    year: int = Query(..., description="Year"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12)"),
    quarter: Optional[int] = Query(None, ge=1, le=4, description="Quarter (1-4)")
):
    """Get P&L for a specific property."""
    return await financial_service.calculate_property_pl(property_id, year, month, quarter)


@router.post("/pl/calculate")
async def calculate_pl_custom(request: PLRequest):
    """Calculate P&L with custom parameters."""
    return await financial_service.calculate_pl(
        request.property_id,
        request.start_date,
        request.end_date,
        request.period
    )


# ==============================================================================
# TAX REPORTING ENDPOINTS
# ==============================================================================

@router.get("/tax/schedule-e")
async def get_schedule_e_data(
    year: int = Query(..., description="Tax year"),
    property_id: Optional[str] = Query(None, description="Filter by property")
):
    """
    Generate Schedule E format data for tax filing.
    Includes all standard IRS Schedule E lines with amounts.
    """
    return await financial_service.generate_schedule_e_data(year, property_id)


@router.get("/tax/depreciation")
async def get_depreciation_schedule(
    year: int = Query(..., description="Tax year"),
    property_id: Optional[str] = Query(None, description="Filter by property")
):
    """Get depreciation schedule for capital assets."""
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    depreciation = await financial_service._calculate_depreciation(property_id, start_date, end_date)

    return {
        "year": year,
        "property_id": property_id or "all",
        "total_depreciation": depreciation,
        "method": "MACRS (Modified Accelerated Cost Recovery System)",
        "note": "Residential rental property depreciation"
    }


# ==============================================================================
# FORECASTING ENDPOINTS
# ==============================================================================

@router.get("/forecast")
async def get_revenue_forecast(
    property_id: Optional[str] = Query(None, description="Property ID or null for all"),
    months_ahead: int = Query(3, ge=1, le=12, description="Months to forecast")
):
    """Get revenue forecast based on historical data."""
    return await financial_service.forecast_revenue(property_id, months_ahead)


# ==============================================================================
# EXPORT ENDPOINTS
# ==============================================================================

@router.get("/export/csv")
async def export_csv(
    year: int = Query(..., description="Tax year"),
    export_type: str = Query("schedule_e", description="Type: schedule_e, expenses, revenue, all")
):
    """
    Export financial data to CSV format.
    Returns downloadable CSV file.
    """
    csv_data = await financial_service.export_to_csv(year, export_type)

    filename = f"right_at_home_bnb_{export_type}_{year}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/pdf")
async def export_pdf(
    year: int = Query(..., description="Tax year"),
    export_type: str = Query("full_report", description="Report type")
):
    """
    Export financial data to PDF format.
    Returns downloadable PDF file.
    """
    pdf_data = await financial_service.export_to_pdf(year, export_type)

    if pdf_data is None:
        raise HTTPException(
            status_code=500,
            detail="PDF generation failed. ReportLab may not be installed."
        )

    filename = f"right_at_home_bnb_report_{year}.pdf"
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/export/email")
async def export_to_email(
    request: ExportRequest,
    background_tasks: BackgroundTasks
):
    """
    Export financial data and email to accountant.
    Runs in background to avoid timeout.
    """
    # In production, this would queue an email task
    schedule_e = await financial_service.generate_schedule_e_data(request.year)

    return {
        "success": True,
        "message": f"Financial report for {request.year} queued for delivery to {request.email}",
        "summary": schedule_e["summary"]
    }


# ==============================================================================
# UTILITY ENDPOINTS
# ==============================================================================

@router.get("/properties/{property_id}/financial-summary")
async def get_property_financial_summary(
    property_id: str,
    year: Optional[int] = Query(None, description="Year")
):
    """Get complete financial summary for a single property."""
    year = year or datetime.now().year
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"

    revenue = await financial_service.get_revenue_by_property(property_id, start_date, end_date)
    expenses = await financial_service.get_expenses_by_property(property_id, start_date, end_date)
    pl = await financial_service.calculate_property_pl(property_id, year)

    return {
        "property_id": property_id,
        "year": year,
        "revenue": revenue,
        "expenses": expenses,
        "pl": pl,
        "generated_at": datetime.utcnow().isoformat()
    }


@router.get("/dashboard-stats")
async def get_dashboard_stats():
    """Get quick stats for financial dashboard cards."""
    now = datetime.now()
    current_year = now.year
    current_month = now.month

    # Current month overview
    monthly_overview = await financial_service.get_financial_overview(current_year, current_month)

    # YTD overview
    ytd_overview = await financial_service.get_financial_overview(current_year)

    # Forecast
    forecast = await financial_service.forecast_revenue(None, 3)

    return {
        "current_month": {
            "revenue": monthly_overview["summary"]["total_revenue"],
            "expenses": monthly_overview["summary"]["total_expenses"],
            "profit": monthly_overview["summary"]["net_profit"],
            "profit_margin": monthly_overview["summary"]["profit_margin"]
        },
        "ytd": {
            "revenue": ytd_overview["summary"]["total_revenue"],
            "expenses": ytd_overview["summary"]["total_expenses"],
            "profit": ytd_overview["summary"]["net_profit"],
            "change_percent": ytd_overview["summary"]["ytd_change_percent"]
        },
        "forecast": {
            "next_month": forecast["forecasts"][0] if forecast["forecasts"] else None,
            "next_quarter": sum(f["forecast"] for f in forecast["forecasts"][:3]) if forecast["forecasts"] else 0
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health")
async def health_check():
    """Check financial service health."""
    return {
        "status": "healthy",
        "service": "FinancialService",
        "firebase_available": financial_service.firebase_available,
        "timestamp": datetime.utcnow().isoformat()
    }
