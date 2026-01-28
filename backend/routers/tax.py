"""
Right At Home BnB - Tax Export API Routes
=========================================
Admin-only endpoints for tax reporting and CPA exports.

Endpoints:
- GET /admin/tax/summary - Tax summary by year
- GET /admin/tax/export/csv - Download CSV
- GET /admin/tax/export/pdf - Download PDF
- GET /admin/tax/categories - Expense by category

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Query, Response, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from loguru import logger
import io

from services.tax_export import tax_export_service

router = APIRouter(tags=["Tax Export"])


# ==============================================================================
# REQUEST/RESPONSE MODELS
# ==============================================================================

class TaxSummaryResponse(BaseModel):
    """Response model for tax summary."""
    tax_year: int
    property_id: str
    owner: str
    business: str
    schedule_e_summary: Dict[str, float]
    schedule_e_lines: Dict[str, float]
    expense_by_category: List[Dict[str, Any]]
    expense_by_property: List[Dict[str, Any]]
    mileage_summary: Dict[str, Any]
    depreciation_summary: Dict[str, Any]
    generated_at: str


class ExpenseByCategoryResponse(BaseModel):
    """Response model for expenses by category."""
    tax_year: int
    property_id: str
    categories: List[Dict[str, Any]]
    total_expenses: float
    generated_at: str


# ==============================================================================
# ADMIN TAX ENDPOINTS
# ==============================================================================

@router.get("/summary", response_model=TaxSummaryResponse)
async def get_tax_summary(
    year: int = Query(..., ge=2020, le=2030, description="Tax year"),
    property_id: Optional[str] = Query(None, description="Filter by property ID (optional)")
):
    """
    Get comprehensive tax summary for the admin dashboard.

    Includes:
    - Schedule E line items
    - Total income, expenses, and net rental income
    - Expense breakdown by category and property
    - Mileage deduction summary
    - Depreciation summary

    Args:
        year: Tax year (2020-2030)
        property_id: Optional property filter

    Returns:
        TaxSummaryResponse with complete tax data
    """
    try:
        summary = await tax_export_service.get_tax_summary(year, property_id)
        return summary
    except Exception as e:
        logger.error(f"Error getting tax summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/csv")
async def export_tax_csv(
    year: int = Query(..., ge=2020, le=2030, description="Tax year"),
    property_id: Optional[str] = Query(None, description="Filter by property ID (optional)")
):
    """
    Export tax data to CSV format for CPA.

    Generates a comprehensive CSV file containing:
    - Schedule E line items with amounts
    - Expense breakdown by tax category
    - Expense breakdown by property
    - Mileage deduction details
    - Summary totals

    Args:
        year: Tax year (2020-2030)
        property_id: Optional property filter

    Returns:
        Downloadable CSV file
    """
    try:
        csv_data = await tax_export_service.export_to_csv(year, property_id)

        property_suffix = f"_{property_id}" if property_id else ""
        filename = f"right_at_home_bnb_tax_export_{year}{property_suffix}.csv"

        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "text/csv; charset=utf-8"
            }
        )
    except Exception as e:
        logger.error(f"Error exporting CSV: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/pdf")
async def export_tax_pdf(
    year: int = Query(..., ge=2020, le=2030, description="Tax year"),
    property_id: Optional[str] = Query(None, description="Filter by property ID (optional)")
):
    """
    Export tax data to professional PDF format for CPA.

    Generates a multi-page PDF report containing:
    - Title page with business information
    - Financial summary
    - Complete Schedule E data
    - Expense breakdown by category
    - Mileage and depreciation schedules

    Requires ReportLab to be installed.

    Args:
        year: Tax year (2020-2030)
        property_id: Optional property filter

    Returns:
        Downloadable PDF file
    """
    try:
        pdf_data = await tax_export_service.export_to_pdf(year, property_id)

        if pdf_data is None:
            raise HTTPException(
                status_code=500,
                detail="PDF generation failed. ReportLab may not be installed."
            )

        property_suffix = f"_{property_id}" if property_id else ""
        filename = f"right_at_home_bnb_tax_export_{year}{property_suffix}.pdf"

        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/pdf"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/categories", response_model=ExpenseByCategoryResponse)
async def get_expenses_by_category(
    year: int = Query(..., ge=2020, le=2030, description="Tax year"),
    property_id: Optional[str] = Query(None, description="Filter by property ID (optional)")
):
    """
    Get expenses broken down by IRS tax category.

    Returns each expense category with:
    - Category name (human-readable)
    - Corresponding Schedule E line
    - Total amount
    - Percentage of total expenses

    Args:
        year: Tax year (2020-2030)
        property_id: Optional property filter

    Returns:
        ExpenseByCategoryResponse with category breakdown
    """
    try:
        breakdown = await tax_export_service.get_expenses_by_category(year, property_id)
        return breakdown
    except Exception as e:
        logger.error(f"Error getting expense categories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schedule-e")
async def get_schedule_e_data(
    year: int = Query(..., ge=2020, le=2030, description="Tax year"),
    property_id: Optional[str] = Query(None, description="Filter by property ID (optional)")
):
    """
    Get IRS Schedule E formatted data.

    Returns data structured exactly like IRS Schedule E form:
    - Line 3: Rents received
    - Line 5: Advertising
    - Line 6: Auto and travel
    - Line 7: Cleaning and maintenance
    - Line 8: Commissions
    - Line 9: Insurance
    - Line 10: Legal and professional fees
    - Line 11: Management fees
    - Line 12: Mortgage interest
    - Line 13: Other interest
    - Line 14: Repairs
    - Line 15: Supplies
    - Line 16: Taxes
    - Line 17: Utilities
    - Line 18: Depreciation
    - Line 19: Other

    Args:
        year: Tax year (2020-2030)
        property_id: Optional property filter

    Returns:
        Schedule E formatted data
    """
    try:
        summary = await tax_export_service.get_tax_summary(year, property_id)

        return {
            "tax_year": year,
            "property_id": property_id or "all",
            "owner": summary["owner"],
            "business": summary["business"],
            "schedule_e_lines": summary["schedule_e_lines"],
            "summary": summary["schedule_e_summary"],
            "generated_at": summary["generated_at"],
        }
    except Exception as e:
        logger.error(f"Error getting Schedule E data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mileage")
async def get_mileage_summary(
    year: int = Query(..., ge=2020, le=2030, description="Tax year"),
    property_id: Optional[str] = Query(None, description="Filter by property ID (optional)")
):
    """
    Get mileage deduction summary for tax year.

    Returns:
    - Total business miles driven
    - IRS standard mileage rate
    - Total mileage deduction
    - Number of trips logged

    Args:
        year: Tax year (2020-2030)
        property_id: Optional property filter

    Returns:
        Mileage summary data
    """
    try:
        summary = await tax_export_service.get_tax_summary(year, property_id)

        return {
            "tax_year": year,
            "property_id": property_id or "all",
            "mileage_summary": summary["mileage_summary"],
            "generated_at": summary["generated_at"],
        }
    except Exception as e:
        logger.error(f"Error getting mileage summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/depreciation")
async def get_depreciation_summary(
    year: int = Query(..., ge=2020, le=2030, description="Tax year"),
    property_id: Optional[str] = Query(None, description="Filter by property ID (optional)")
):
    """
    Get depreciation summary for capital assets.

    Uses MACRS (Modified Accelerated Cost Recovery System) method.

    Returns:
    - Total depreciation for the year
    - Depreciation method used
    - Asset categories and their depreciation periods

    Args:
        year: Tax year (2020-2030)
        property_id: Optional property filter

    Returns:
        Depreciation summary data
    """
    try:
        summary = await tax_export_service.get_tax_summary(year, property_id)

        return {
            "tax_year": year,
            "property_id": property_id or "all",
            "depreciation_summary": summary["depreciation_summary"],
            "depreciation_periods": {
                "furniture": "7 years",
                "appliances": "5 years",
                "carpet_flooring": "5 years",
                "linens_towels": "3 years",
                "security": "5 years",
                "hvac_service": "15 years",
                "roof_exterior": "27.5 years",
                "electrical": "15 years",
                "plumbing": "15 years",
            },
            "generated_at": summary["generated_at"],
        }
    except Exception as e:
        logger.error(f"Error getting depreciation summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Check tax export service health."""
    return {
        "status": "healthy",
        "service": "TaxExportService",
        "firebase_available": tax_export_service.firebase_available,
        "reportlab_available": True,  # Checked at import
        "timestamp": datetime.utcnow().isoformat(),
    }
