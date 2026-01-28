"""
Right At Home BnB - Weekly Payout Report API Routes
====================================================
Admin endpoints for managing weekly payout reports:
- GET /admin/payouts - List payout reports
- GET /admin/payouts/generate - Generate current week report
- GET /admin/payouts/{id} - Get specific report
- GET /admin/payouts/{id}/pdf - Download PDF
- POST /admin/payouts/{id}/send - Send report via email
- POST /admin/payouts/cron - Trigger Friday cron job

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Query, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from loguru import logger
import io

from services.payout_service import payout_service

router = APIRouter()


# ==============================================================================
# REQUEST/RESPONSE MODELS
# ==============================================================================

class GenerateReportRequest(BaseModel):
    """Request model for generating a report for a specific date range."""
    week_start: Optional[str] = Field(
        None,
        description="Start date (YYYY-MM-DD). If not provided, uses current week."
    )
    week_end: Optional[str] = Field(
        None,
        description="End date (YYYY-MM-DD). If not provided, uses current week."
    )


class SendReportRequest(BaseModel):
    """Request model for sending a report via email."""
    recipients: Optional[List[str]] = Field(
        None,
        description="List of email addresses. If not provided, uses default owner emails."
    )


class PayoutReportSummary(BaseModel):
    """Summary response for a payout report."""
    id: str
    week_start: str
    week_end: str
    generated_at: str
    gross_revenue: float
    total_expenses: float
    net_profit: float
    total_bookings: int
    is_sent: bool


# ==============================================================================
# LIST REPORTS
# ==============================================================================

@router.get("", response_model=List[PayoutReportSummary])
async def list_payout_reports(
    limit: int = Query(10, ge=1, le=100, description="Number of reports to return"),
    offset: int = Query(0, ge=0, description="Number of reports to skip")
):
    """
    List weekly payout reports, most recent first.

    Returns a summary of each report including week dates, revenue, expenses, and profit.
    """
    reports = await payout_service.list_reports(limit=limit, offset=offset)

    # Transform to summary format
    summaries = []
    for report in reports:
        totals = report.get("totals", {})
        delivery = report.get("delivery", {})
        summaries.append(PayoutReportSummary(
            id=report.get("id", ""),
            week_start=report.get("week_start", ""),
            week_end=report.get("week_end", ""),
            generated_at=report.get("generated_at", ""),
            gross_revenue=totals.get("gross_revenue", 0),
            total_expenses=totals.get("total_expenses", 0),
            net_profit=totals.get("net_profit", 0),
            total_bookings=report.get("stats", {}).get("total_bookings", 0),
            is_sent=delivery.get("is_sent", False)
        ))

    return summaries


# ==============================================================================
# GENERATE REPORT
# ==============================================================================

@router.get("/generate")
async def generate_current_week_report():
    """
    Generate payout report for the current week.

    The week runs Saturday to Friday. Returns the full report data.
    """
    logger.info("Generating current week payout report...")

    report = await payout_service.generate_weekly_report()

    return {
        "success": True,
        "message": f"Report generated for {report.week_start} to {report.week_end}",
        "report": report.to_dict()
    }


@router.post("/generate")
async def generate_custom_report(request: GenerateReportRequest):
    """
    Generate payout report for a specific date range.

    Provide week_start and week_end dates in YYYY-MM-DD format.
    """
    week_start = None
    week_end = None

    if request.week_start:
        try:
            week_start = datetime.strptime(request.week_start, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid week_start format. Use YYYY-MM-DD")

    if request.week_end:
        try:
            week_end = datetime.strptime(request.week_end, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid week_end format. Use YYYY-MM-DD")

    # Validate date range
    if week_start and week_end and week_start > week_end:
        raise HTTPException(status_code=400, detail="week_start must be before week_end")

    logger.info(f"Generating custom payout report: {week_start} to {week_end}")

    report = await payout_service.generate_weekly_report(week_start, week_end)

    return {
        "success": True,
        "message": f"Report generated for {report.week_start} to {report.week_end}",
        "report": report.to_dict()
    }


# ==============================================================================
# GET SPECIFIC REPORT
# ==============================================================================

@router.get("/{report_id}")
async def get_payout_report(report_id: str):
    """
    Get a specific payout report by ID.

    The report ID follows the format: PAYOUT_YYYYMMDD_YYYYMMDD
    """
    report = await payout_service.get_report_by_id(report_id)

    if not report:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")

    return report


# ==============================================================================
# DOWNLOAD PDF
# ==============================================================================

@router.get("/{report_id}/pdf")
async def download_payout_pdf(report_id: str):
    """
    Download the PDF version of a payout report.

    Returns a downloadable PDF file with the complete report.
    """
    # Get the report data
    report_data = await payout_service.get_report_by_id(report_id)

    if not report_data:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")

    # Reconstruct report object for PDF generation
    from services.payout_service import WeeklyPayoutReport, PropertyWeeklyEarnings
    from decimal import Decimal

    week_start = datetime.strptime(report_data["week_start"], "%Y-%m-%d").date()
    week_end = datetime.strptime(report_data["week_end"], "%Y-%m-%d").date()

    report = WeeklyPayoutReport(week_start, week_end)
    report.id = report_id
    report.generated_at = datetime.fromisoformat(report_data["generated_at"])

    # Populate totals
    totals = report_data.get("totals", {})
    report.vrbo_revenue = Decimal(str(totals.get("vrbo_revenue", 0)))
    report.airbnb_revenue = Decimal(str(totals.get("airbnb_revenue", 0)))
    report.direct_revenue = Decimal(str(totals.get("direct_revenue", 0)))
    report.total_cleaner_costs = Decimal(str(totals.get("cleaner_costs", 0)))
    report.total_pool_tech_costs = Decimal(str(totals.get("pool_costs", 0)))
    report.total_lawn_costs = Decimal(str(totals.get("lawn_costs", 0)))
    report.total_utility_estimates = Decimal(str(totals.get("utility_estimates", 0)))
    report.total_other_expenses = Decimal(str(totals.get("other_expenses", 0)))

    # Populate stats
    stats = report_data.get("stats", {})
    report.total_bookings = stats.get("total_bookings", 0)
    report.total_guest_nights = stats.get("guest_nights", 0)
    report.avg_occupancy = stats.get("occupancy_percent", 0)
    report.direct_booking_count = stats.get("direct_bookings", 0)
    report.ota_fees_saved = Decimal(str(stats.get("ota_fees_saved", 0)))

    # Populate top performer
    top = report_data.get("top_performer", {})
    report.top_property_id = top.get("property_id")
    report.top_property_name = top.get("property_name")
    report.top_property_revenue = Decimal(str(top.get("revenue", 0)))
    report.top_property_profit = Decimal(str(top.get("profit", 0)))

    # Populate property earnings
    for prop_data in report_data.get("properties", []):
        earnings = PropertyWeeklyEarnings(
            prop_data["property_id"],
            prop_data["property_name"],
            week_start,
            week_end
        )

        rev = prop_data.get("revenue", {})
        earnings.vrbo_revenue = Decimal(str(rev.get("vrbo", 0)))
        earnings.airbnb_revenue = Decimal(str(rev.get("airbnb", 0)))
        earnings.direct_revenue = Decimal(str(rev.get("direct", 0)))
        earnings.cleaning_fees_collected = Decimal(str(rev.get("cleaning_fees", 0)))
        earnings.other_income = Decimal(str(rev.get("other", 0)))

        exp = prop_data.get("expenses", {})
        earnings.cleaner_costs = Decimal(str(exp.get("cleaners", 0)))
        earnings.pool_tech_costs = Decimal(str(exp.get("pool", 0)))
        earnings.lawn_costs = Decimal(str(exp.get("lawn", 0)))
        earnings.maintenance_costs = Decimal(str(exp.get("maintenance", 0)))
        earnings.utility_estimates = Decimal(str(exp.get("utilities", 0)))
        earnings.other_expenses = Decimal(str(exp.get("other", 0)))

        earnings.total_bookings = prop_data.get("bookings", 0)
        earnings.guest_nights = prop_data.get("guest_nights", 0)

        report.property_earnings.append(earnings)

    # Finalize calculated fields
    report.total_gross_revenue = Decimal(str(totals.get("gross_revenue", 0)))
    report.total_expenses = Decimal(str(totals.get("total_expenses", 0)))
    report.net_profit = Decimal(str(totals.get("net_profit", 0)))

    # Generate PDF
    pdf_bytes = await payout_service.generate_pdf_report(report)

    if not pdf_bytes:
        raise HTTPException(
            status_code=500,
            detail="PDF generation failed. ReportLab may not be installed."
        )

    filename = f"RAH_Payout_{report.week_end.strftime('%Y%m%d')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==============================================================================
# SEND REPORT EMAIL
# ==============================================================================

@router.post("/{report_id}/send")
async def send_payout_report(
    report_id: str,
    request: SendReportRequest,
    background_tasks: BackgroundTasks
):
    """
    Send a payout report via email.

    If recipients are not specified, sends to the configured owner email addresses.
    """
    # Get the report
    report_data = await payout_service.get_report_by_id(report_id)

    if not report_data:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")

    # Reconstruct report object (same as PDF endpoint)
    from services.payout_service import WeeklyPayoutReport, PropertyWeeklyEarnings
    from decimal import Decimal

    week_start = datetime.strptime(report_data["week_start"], "%Y-%m-%d").date()
    week_end = datetime.strptime(report_data["week_end"], "%Y-%m-%d").date()

    report = WeeklyPayoutReport(week_start, week_end)
    report.id = report_id
    report.generated_at = datetime.fromisoformat(report_data["generated_at"])

    # Populate totals
    totals = report_data.get("totals", {})
    report.vrbo_revenue = Decimal(str(totals.get("vrbo_revenue", 0)))
    report.airbnb_revenue = Decimal(str(totals.get("airbnb_revenue", 0)))
    report.direct_revenue = Decimal(str(totals.get("direct_revenue", 0)))
    report.total_cleaner_costs = Decimal(str(totals.get("cleaner_costs", 0)))
    report.total_pool_tech_costs = Decimal(str(totals.get("pool_costs", 0)))
    report.total_lawn_costs = Decimal(str(totals.get("lawn_costs", 0)))
    report.total_utility_estimates = Decimal(str(totals.get("utility_estimates", 0)))
    report.total_other_expenses = Decimal(str(totals.get("other_expenses", 0)))

    # Populate stats
    stats = report_data.get("stats", {})
    report.total_bookings = stats.get("total_bookings", 0)
    report.total_guest_nights = stats.get("guest_nights", 0)
    report.avg_occupancy = stats.get("occupancy_percent", 0)
    report.direct_booking_count = stats.get("direct_bookings", 0)
    report.ota_fees_saved = Decimal(str(stats.get("ota_fees_saved", 0)))

    # Populate top performer
    top = report_data.get("top_performer", {})
    report.top_property_id = top.get("property_id")
    report.top_property_name = top.get("property_name")
    report.top_property_revenue = Decimal(str(top.get("revenue", 0)))
    report.top_property_profit = Decimal(str(top.get("profit", 0)))

    # Finalize
    report.total_gross_revenue = Decimal(str(totals.get("gross_revenue", 0)))
    report.total_expenses = Decimal(str(totals.get("total_expenses", 0)))
    report.net_profit = Decimal(str(totals.get("net_profit", 0)))

    # Populate properties for PDF
    for prop_data in report_data.get("properties", []):
        earnings = PropertyWeeklyEarnings(
            prop_data["property_id"],
            prop_data["property_name"],
            week_start,
            week_end
        )

        rev = prop_data.get("revenue", {})
        earnings.vrbo_revenue = Decimal(str(rev.get("vrbo", 0)))
        earnings.airbnb_revenue = Decimal(str(rev.get("airbnb", 0)))
        earnings.direct_revenue = Decimal(str(rev.get("direct", 0)))
        earnings.cleaning_fees_collected = Decimal(str(rev.get("cleaning_fees", 0)))
        earnings.other_income = Decimal(str(rev.get("other", 0)))

        exp = prop_data.get("expenses", {})
        earnings.cleaner_costs = Decimal(str(exp.get("cleaners", 0)))
        earnings.pool_tech_costs = Decimal(str(exp.get("pool", 0)))
        earnings.lawn_costs = Decimal(str(exp.get("lawn", 0)))
        earnings.maintenance_costs = Decimal(str(exp.get("maintenance", 0)))
        earnings.utility_estimates = Decimal(str(exp.get("utilities", 0)))
        earnings.other_expenses = Decimal(str(exp.get("other", 0)))

        earnings.total_bookings = prop_data.get("bookings", 0)
        earnings.guest_nights = prop_data.get("guest_nights", 0)

        report.property_earnings.append(earnings)

    # Generate PDF
    pdf_bytes = await payout_service.generate_pdf_report(report)

    if not pdf_bytes:
        raise HTTPException(
            status_code=500,
            detail="PDF generation failed"
        )

    # Send email
    result = await payout_service.send_report_email(
        report,
        pdf_bytes,
        request.recipients
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=f"Email send failed: {result.get('error', 'Unknown error')}"
        )

    return {
        "success": True,
        "message": f"Report sent successfully",
        "recipients": result.get("recipients", []),
        "sent_at": result.get("sent_at")
    }


# ==============================================================================
# CRON JOB TRIGGER
# ==============================================================================

@router.post("/cron")
async def trigger_friday_cron():
    """
    Manually trigger the Friday payout cron job.

    This is the same job that runs automatically every Friday at 5 PM.
    It generates the report for the week, creates a PDF, and emails it to owners.
    """
    logger.info("Manually triggering Friday payout cron job...")

    result = await payout_service.friday_payout_job()

    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=f"Cron job failed: {result.get('error', 'Unknown error')}"
        )

    return {
        "success": True,
        "message": "Friday payout job completed successfully",
        "report_id": result.get("report_id"),
        "summary": result.get("report_summary"),
        "email_result": result.get("email_result")
    }


# ==============================================================================
# HEALTH CHECK
# ==============================================================================

@router.get("/health")
async def health_check():
    """Check payout service health."""
    return {
        "status": "healthy",
        "service": "PayoutService",
        "firebase_available": payout_service.firebase_available,
        "smtp_configured": bool(payout_service.smtp_user and payout_service.smtp_password),
        "owner_emails": len([e for e in payout_service.owner_emails if e]),
        "timestamp": datetime.utcnow().isoformat()
    }
