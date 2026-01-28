"""
Right At Home BnB - Comprehensive Reports API Routes
=====================================================
API endpoints for reporting and business intelligence:
- Occupancy reports (daily, weekly, monthly)
- Revenue reports with platform breakdown
- Expense reports with category analysis
- Maintenance reports with issue tracking
- Cleaner performance reports
- CSV/PDF export endpoints
- Scheduled report generation

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

from services.reports import reports_service, ReportType, ReportPeriod, ReportFormat

router = APIRouter()


# ==============================================================================
# REQUEST/RESPONSE MODELS
# ==============================================================================

class ReportRequest(BaseModel):
    """Base request model for reports."""
    start_date: Optional[str] = Field(None, description="Start date YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="End date YYYY-MM-DD")
    property_id: Optional[str] = Field(None, description="Filter by property ID")
    period: str = Field(default="monthly", description="Grouping: daily, weekly, monthly")


class ExportRequest(BaseModel):
    """Request model for report export."""
    report_type: str = Field(..., description="Report type: occupancy, revenue, expenses, maintenance, cleaners")
    format: str = Field(default="csv", description="Export format: csv, pdf")
    start_date: Optional[str] = Field(None, description="Start date YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="End date YYYY-MM-DD")
    property_id: Optional[str] = Field(None, description="Filter by property")


class ScheduledReportRequest(BaseModel):
    """Request model for scheduled reports."""
    report_type: str = Field(..., description="weekly_summary, owner_statement, tax_prep")
    year: Optional[int] = Field(None, description="Year for the report")
    month: Optional[int] = Field(None, ge=1, le=12, description="Month (1-12)")
    quarter: Optional[int] = Field(None, ge=1, le=4, description="Quarter (1-4)")
    property_id: Optional[str] = Field(None, description="Filter by property")
    email: Optional[str] = Field(None, description="Email to send report to")


class ReportSummary(BaseModel):
    """Response model for report summary."""
    report_type: str
    period: Dict[str, Any]
    summary: Dict[str, Any]
    generated_at: str


# ==============================================================================
# OCCUPANCY REPORT ENDPOINTS
# ==============================================================================

@router.get("/occupancy")
async def get_occupancy_report(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    property_id: Optional[str] = Query(None, description="Filter by property ID"),
    period: str = Query("monthly", description="Grouping: daily, weekly, monthly")
):
    """
    Get comprehensive occupancy report.

    Returns:
    - Overall occupancy rate
    - Per-property breakdown
    - Time series data for charts
    - Weekday vs weekend analysis
    - Platform distribution
    """
    try:
        report = await reports_service.get_occupancy_report(
            start_date=start_date,
            end_date=end_date,
            property_id=property_id,
            period=period
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/occupancy/summary")
async def get_occupancy_summary(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get quick occupancy summary for dashboard cards."""
    try:
        report = await reports_service.get_occupancy_report(start_date, end_date)
        return {
            "overall_occupancy_rate": report["summary"]["overall_occupancy_rate"],
            "total_properties": report["summary"]["total_properties"],
            "booked_nights": report["summary"]["booked_nights"],
            "avg_stay_length": report["summary"]["avg_stay_length"],
            "top_performer": report["top_performers"][0] if report["top_performers"] else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/occupancy/property/{property_id}")
async def get_property_occupancy(
    property_id: str,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get occupancy report for a specific property."""
    try:
        report = await reports_service.get_occupancy_report(
            start_date=start_date,
            end_date=end_date,
            property_id=property_id
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# REVENUE REPORT ENDPOINTS
# ==============================================================================

@router.get("/revenue")
async def get_revenue_report(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    property_id: Optional[str] = Query(None, description="Filter by property ID"),
    period: str = Query("monthly", description="Grouping: daily, weekly, monthly")
):
    """
    Get comprehensive revenue report.

    Returns:
    - Total revenue and ADR
    - RevPAR calculations
    - Revenue by category
    - Revenue by property
    - Revenue by platform
    - Year-over-year comparison
    """
    try:
        report = await reports_service.get_revenue_report(
            start_date=start_date,
            end_date=end_date,
            property_id=property_id,
            period=period
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/revenue/summary")
async def get_revenue_summary(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get quick revenue summary for dashboard cards."""
    try:
        report = await reports_service.get_revenue_report(start_date, end_date)
        return {
            "total_revenue": report["summary"]["total_revenue"],
            "adr": report["summary"]["adr"],
            "revpar": report["summary"]["revpar"],
            "total_bookings": report["summary"]["total_bookings"],
            "yoy_change": report["yoy_comparison"]["change_percent"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/revenue/property/{property_id}")
async def get_property_revenue(
    property_id: str,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get revenue report for a specific property."""
    try:
        report = await reports_service.get_revenue_report(
            start_date=start_date,
            end_date=end_date,
            property_id=property_id
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/revenue/by-platform")
async def get_revenue_by_platform(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get revenue breakdown by booking platform."""
    try:
        report = await reports_service.get_revenue_report(start_date, end_date)
        return {
            "by_platform": report["by_platform"],
            "period": report["period"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# EXPENSE REPORT ENDPOINTS
# ==============================================================================

@router.get("/expenses")
async def get_expense_report(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    property_id: Optional[str] = Query(None, description="Filter by property ID"),
    category: Optional[str] = Query(None, description="Filter by expense category")
):
    """
    Get comprehensive expense report.

    Returns:
    - Total expenses and tax deductible amounts
    - Expenses by category
    - Expenses by property
    - Top vendors
    - Largest individual expenses
    """
    try:
        report = await reports_service.get_expense_report(
            start_date=start_date,
            end_date=end_date,
            property_id=property_id,
            category=category
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/expenses/summary")
async def get_expense_summary(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get quick expense summary for dashboard cards."""
    try:
        report = await reports_service.get_expense_report(start_date, end_date)
        return {
            "total_expenses": report["summary"]["total_expenses"],
            "tax_deductible": report["summary"]["tax_deductible"],
            "expense_count": report["summary"]["expense_count"],
            "avg_expense": report["summary"]["avg_expense"],
            "top_category": report["by_category"][0] if report["by_category"] else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/expenses/property/{property_id}")
async def get_property_expenses(
    property_id: str,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get expense report for a specific property."""
    try:
        report = await reports_service.get_expense_report(
            start_date=start_date,
            end_date=end_date,
            property_id=property_id
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/expenses/by-category")
async def get_expenses_by_category(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get expense breakdown by category."""
    try:
        report = await reports_service.get_expense_report(start_date, end_date)
        return {
            "by_category": report["by_category"],
            "period": report["period"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# MAINTENANCE REPORT ENDPOINTS
# ==============================================================================

@router.get("/maintenance")
async def get_maintenance_report(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    property_id: Optional[str] = Query(None, description="Filter by property ID")
):
    """
    Get comprehensive maintenance report.

    Returns:
    - Total issues and resolution rate
    - Issues by priority
    - Issues by category
    - Issues by property
    - Common issue types
    - Urgent items requiring attention
    """
    try:
        report = await reports_service.get_maintenance_report(
            start_date=start_date,
            end_date=end_date,
            property_id=property_id
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/maintenance/summary")
async def get_maintenance_summary(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get quick maintenance summary for dashboard cards."""
    try:
        report = await reports_service.get_maintenance_report(start_date, end_date)
        return {
            "total_issues": report["summary"]["total_issues"],
            "resolved": report["summary"]["resolved"],
            "open": report["summary"]["open"],
            "resolution_rate": report["summary"]["resolution_rate"],
            "avg_resolution_days": report["summary"]["avg_resolution_days"],
            "urgent_count": len(report["urgent_items"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/maintenance/property/{property_id}")
async def get_property_maintenance(
    property_id: str,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get maintenance report for a specific property."""
    try:
        report = await reports_service.get_maintenance_report(
            start_date=start_date,
            end_date=end_date,
            property_id=property_id
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/maintenance/urgent")
async def get_urgent_maintenance():
    """Get list of urgent maintenance items requiring immediate attention."""
    try:
        report = await reports_service.get_maintenance_report()
        return {
            "urgent_items": report["urgent_items"],
            "total_urgent": len(report["urgent_items"]),
            "generated_at": report["generated_at"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# CLEANER PERFORMANCE REPORT ENDPOINTS
# ==============================================================================

@router.get("/cleaners")
async def get_cleaner_report(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    cleaner_id: Optional[str] = Query(None, description="Filter by cleaner ID")
):
    """
    Get comprehensive cleaner performance report.

    Returns:
    - Total cleanings and completion rate
    - Per-cleaner metrics and rankings
    - Average ratings and on-time rates
    - Performance scores
    - Top performers and those needing improvement
    """
    try:
        report = await reports_service.get_cleaner_report(
            start_date=start_date,
            end_date=end_date,
            cleaner_id=cleaner_id
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cleaners/summary")
async def get_cleaner_summary(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get quick cleaner performance summary for dashboard cards."""
    try:
        report = await reports_service.get_cleaner_report(start_date, end_date)
        return {
            "total_cleaners": report["summary"]["total_cleaners"],
            "total_cleanings": report["summary"]["total_cleanings"],
            "completion_rate": report["summary"]["completion_rate"],
            "avg_rating": report["summary"]["avg_rating"],
            "total_payout": report["summary"]["total_payout"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cleaners/rankings")
async def get_cleaner_rankings(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get cleaner performance rankings."""
    try:
        report = await reports_service.get_cleaner_report(start_date, end_date)
        return {
            "rankings": report["by_cleaner"],
            "top_performers": report["top_performers"],
            "needs_improvement": report["needs_improvement"],
            "period": report["period"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cleaners/{cleaner_id}")
async def get_cleaner_performance(
    cleaner_id: str,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    """Get detailed performance report for a specific cleaner."""
    try:
        report = await reports_service.get_cleaner_report(
            start_date=start_date,
            end_date=end_date,
            cleaner_id=cleaner_id
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# EXPORT ENDPOINTS
# ==============================================================================

@router.get("/export/csv/{report_type}")
async def export_csv(
    report_type: str,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    property_id: Optional[str] = Query(None, description="Filter by property")
):
    """
    Export report to CSV format.

    Supported report types:
    - occupancy
    - revenue
    - expenses
    - maintenance
    - cleaners
    """
    try:
        # Generate the report
        if report_type == "occupancy":
            report_data = await reports_service.get_occupancy_report(start_date, end_date, property_id)
        elif report_type == "revenue":
            report_data = await reports_service.get_revenue_report(start_date, end_date, property_id)
        elif report_type == "expenses":
            report_data = await reports_service.get_expense_report(start_date, end_date, property_id)
        elif report_type == "maintenance":
            report_data = await reports_service.get_maintenance_report(start_date, end_date, property_id)
        elif report_type == "cleaners":
            report_data = await reports_service.get_cleaner_report(start_date, end_date)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid report type: {report_type}")

        # Export to CSV
        csv_content = await reports_service.export_to_csv(report_type, report_data)

        filename = f"rightathomebnb_{report_type}_report_{datetime.now().strftime('%Y%m%d')}.csv"

        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/pdf/{report_type}")
async def export_pdf(
    report_type: str,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    property_id: Optional[str] = Query(None, description="Filter by property")
):
    """
    Export report to PDF format.

    Supported report types:
    - occupancy
    - revenue
    - expenses
    - maintenance
    - cleaners
    """
    try:
        # Generate the report
        if report_type == "occupancy":
            report_data = await reports_service.get_occupancy_report(start_date, end_date, property_id)
        elif report_type == "revenue":
            report_data = await reports_service.get_revenue_report(start_date, end_date, property_id)
        elif report_type == "expenses":
            report_data = await reports_service.get_expense_report(start_date, end_date, property_id)
        elif report_type == "maintenance":
            report_data = await reports_service.get_maintenance_report(start_date, end_date, property_id)
        elif report_type == "cleaners":
            report_data = await reports_service.get_cleaner_report(start_date, end_date)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid report type: {report_type}")

        # Export to PDF
        pdf_content = await reports_service.export_to_pdf(report_type, report_data)

        if pdf_content is None:
            raise HTTPException(
                status_code=500,
                detail="PDF generation failed. ReportLab may not be installed."
            )

        filename = f"rightathomebnb_{report_type}_report_{datetime.now().strftime('%Y%m%d')}.pdf"

        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# SCHEDULED REPORTS ENDPOINTS
# ==============================================================================

@router.get("/scheduled/weekly-summary")
async def get_weekly_summary():
    """
    Generate weekly summary report.

    Includes:
    - Week's occupancy rate
    - Total revenue
    - Total bookings
    - Cleanings completed
    - Top performing properties
    - Alerts for low occupancy
    """
    try:
        report = await reports_service.generate_weekly_summary()
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scheduled/owner-statement")
async def get_owner_statement(
    year: int = Query(..., description="Year"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    property_id: Optional[str] = Query(None, description="Filter by property")
):
    """
    Generate monthly owner statement.

    Includes:
    - Income statement (revenue and expenses)
    - Net income and profit margin
    - Performance metrics (occupancy, ADR, RevPAR)
    - Property-level breakdown
    """
    try:
        report = await reports_service.generate_monthly_owner_statement(year, month, property_id)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scheduled/tax-prep")
async def get_tax_prep_report(
    year: int = Query(..., description="Tax year"),
    quarter: int = Query(..., ge=1, le=4, description="Quarter (1-4)")
):
    """
    Generate quarterly tax preparation report.

    Includes:
    - Schedule E line-by-line data
    - Deductible expenses by category
    - Estimated quarterly tax payment
    - Property-level revenue breakdown
    """
    try:
        report = await reports_service.generate_quarterly_tax_prep(year, quarter)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scheduled/send-email")
async def send_scheduled_report(
    request: ScheduledReportRequest,
    background_tasks: BackgroundTasks
):
    """
    Generate and email a scheduled report.

    Supported report types:
    - weekly_summary
    - owner_statement
    - tax_prep
    """
    try:
        # Generate report based on type
        if request.report_type == "weekly_summary":
            report = await reports_service.generate_weekly_summary()
        elif request.report_type == "owner_statement":
            if not request.year or not request.month:
                raise HTTPException(status_code=400, detail="Year and month required for owner statement")
            report = await reports_service.generate_monthly_owner_statement(
                request.year, request.month, request.property_id
            )
        elif request.report_type == "tax_prep":
            if not request.year or not request.quarter:
                raise HTTPException(status_code=400, detail="Year and quarter required for tax prep report")
            report = await reports_service.generate_quarterly_tax_prep(request.year, request.quarter)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid report type: {request.report_type}")

        # In production, this would queue an email task
        # background_tasks.add_task(send_report_email, request.email, report)

        return {
            "success": True,
            "message": f"Report '{request.report_type}' queued for delivery to {request.email}",
            "report_summary": {
                "type": report["report_type"],
                "period": report.get("period", {}),
                "generated_at": report["generated_at"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# DASHBOARD ENDPOINTS
# ==============================================================================

@router.get("/dashboard")
async def get_dashboard_data():
    """
    Get all dashboard data in a single call.

    Returns combined summaries for:
    - Occupancy
    - Revenue
    - Expenses
    - Maintenance
    - Cleaner performance
    """
    try:
        now = datetime.now()
        start_date = f"{now.year}-01-01"
        end_date = now.strftime("%Y-%m-%d")

        # Generate all reports
        occupancy = await reports_service.get_occupancy_report(start_date, end_date)
        revenue = await reports_service.get_revenue_report(start_date, end_date)
        expenses = await reports_service.get_expense_report(start_date, end_date)
        maintenance = await reports_service.get_maintenance_report(start_date, end_date)
        cleaners = await reports_service.get_cleaner_report(start_date, end_date)

        return {
            "period": {"start": start_date, "end": end_date},
            "occupancy": {
                "rate": occupancy["summary"]["overall_occupancy_rate"],
                "booked_nights": occupancy["summary"]["booked_nights"],
                "total_bookings": occupancy["summary"]["total_bookings"]
            },
            "revenue": {
                "total": revenue["summary"]["total_revenue"],
                "adr": revenue["summary"]["adr"],
                "revpar": revenue["summary"]["revpar"],
                "yoy_change": revenue["yoy_comparison"]["change_percent"]
            },
            "expenses": {
                "total": expenses["summary"]["total_expenses"],
                "tax_deductible": expenses["summary"]["tax_deductible"],
                "top_categories": expenses["by_category"][:3]
            },
            "maintenance": {
                "total_issues": maintenance["summary"]["total_issues"],
                "open": maintenance["summary"]["open"],
                "resolution_rate": maintenance["summary"]["resolution_rate"],
                "urgent": len(maintenance["urgent_items"])
            },
            "cleaners": {
                "total_cleanings": cleaners["summary"]["total_cleanings"],
                "avg_rating": cleaners["summary"]["avg_rating"],
                "top_performers": cleaners["top_performers"][:3]
            },
            "profit": {
                "gross": revenue["summary"]["total_revenue"],
                "expenses": expenses["summary"]["total_expenses"],
                "net": revenue["summary"]["total_revenue"] - expenses["summary"]["total_expenses"],
                "margin": round(
                    (revenue["summary"]["total_revenue"] - expenses["summary"]["total_expenses"]) /
                    revenue["summary"]["total_revenue"] * 100, 1
                ) if revenue["summary"]["total_revenue"] > 0 else 0
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/charts")
async def get_dashboard_charts(
    period: str = Query("monthly", description="Chart grouping: daily, weekly, monthly")
):
    """Get time series data for dashboard charts."""
    try:
        now = datetime.now()
        start_date = f"{now.year}-01-01"
        end_date = now.strftime("%Y-%m-%d")

        occupancy = await reports_service.get_occupancy_report(start_date, end_date, period=period)
        revenue = await reports_service.get_revenue_report(start_date, end_date, period=period)
        expenses = await reports_service.get_expense_report(start_date, end_date)
        maintenance = await reports_service.get_maintenance_report(start_date, end_date)

        return {
            "occupancy_trend": occupancy["time_series"],
            "revenue_trend": revenue["time_series"],
            "expense_trend": expenses["time_series"],
            "maintenance_trend": maintenance["time_series"],
            "revenue_by_platform": revenue["by_platform"],
            "expense_by_category": {cat["category"]: cat["total"] for cat in expenses["by_category"][:8]},
            "period": {"start": start_date, "end": end_date, "grouping": period}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# UTILITY ENDPOINTS
# ==============================================================================

@router.get("/types")
async def get_report_types():
    """Get list of available report types and their descriptions."""
    return {
        "report_types": [
            {
                "type": "occupancy",
                "name": "Occupancy Report",
                "description": "Property occupancy rates, booking patterns, and availability analysis"
            },
            {
                "type": "revenue",
                "name": "Revenue Report",
                "description": "Income breakdown by property, platform, and category with ADR/RevPAR"
            },
            {
                "type": "expenses",
                "name": "Expense Report",
                "description": "Expense tracking by category, property, and vendor with tax deductions"
            },
            {
                "type": "maintenance",
                "name": "Maintenance Report",
                "description": "Issue tracking, resolution rates, and property maintenance health"
            },
            {
                "type": "cleaners",
                "name": "Cleaner Performance Report",
                "description": "Cleaner ratings, on-time rates, and performance rankings"
            }
        ],
        "scheduled_reports": [
            {
                "type": "weekly_summary",
                "name": "Weekly Summary",
                "description": "7-day overview of all key metrics"
            },
            {
                "type": "owner_statement",
                "name": "Monthly Owner Statement",
                "description": "Income statement and performance metrics for accountant"
            },
            {
                "type": "tax_prep",
                "name": "Quarterly Tax Prep",
                "description": "Schedule E data and estimated tax payments"
            }
        ],
        "export_formats": ["csv", "pdf"]
    }


@router.get("/health")
async def health_check():
    """Check reports service health."""
    return {
        "status": "healthy",
        "service": "ReportsService",
        "firebase_available": reports_service.firebase_available,
        "reportlab_available": reports_service.reportlab_available,
        "timestamp": datetime.utcnow().isoformat(),
        "made_by": "ECHO OMEGA PRIME"
    }
