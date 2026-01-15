"""
Right At Home BnB - Financial API Routes
=========================================
API endpoints for:
- Property utility tracking
- Expense management
- Tax reporting for Steven and accountant

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from services.property_financials import property_financial_service

router = APIRouter()


# ============================================================================
# REQUEST MODELS
# ============================================================================

class UtilityBillRequest(BaseModel):
    property_id: int
    utility_type: str = Field(..., description="electric, water, gas, internet, trash, hoa, insurance, property_tax")
    amount: float
    billing_month: int = Field(..., ge=1, le=12)
    billing_year: int
    usage_units: Optional[float] = None
    unit_type: Optional[str] = None
    invoice_number: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None


class ExpenseRequest(BaseModel):
    property_id: int
    category: str = Field(..., description="furniture, appliance, repair, maintenance, supplies, cleaning, landscaping, security, smart_home, other")
    description: str
    amount: float
    expense_date: str
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    receipt_url: Optional[str] = None
    is_capital_expense: bool = False
    useful_life_years: Optional[int] = None
    tax_deductible: bool = True
    notes: Optional[str] = None


# ============================================================================
# UTILITY ENDPOINTS
# ============================================================================

@router.post("/utilities")
async def add_utility_bill(request: UtilityBillRequest):
    """Add a utility bill for a property."""
    return await property_financial_service.add_utility_bill(**request.dict())


@router.put("/utilities/{bill_id}/paid")
async def mark_bill_paid(bill_id: str, paid_date: Optional[str] = None):
    """Mark a utility bill as paid."""
    return await property_financial_service.mark_bill_paid(bill_id, paid_date)


@router.get("/utilities/summary/{property_id}")
async def get_utility_summary(property_id: int, year: Optional[int] = None):
    """Get utility summary for a property."""
    return await property_financial_service.get_utility_summary(property_id, year)


# ============================================================================
# EXPENSE ENDPOINTS
# ============================================================================

@router.post("/expenses")
async def add_expense(request: ExpenseRequest):
    """Add an expense for a property."""
    return await property_financial_service.add_expense(**request.dict())


@router.get("/expenses/summary/{property_id}")
async def get_expense_summary(property_id: int, year: Optional[int] = None):
    """Get expense summary for a property."""
    return await property_financial_service.get_expense_summary(property_id, year)


# ============================================================================
# TAX REPORTING ENDPOINTS
# ============================================================================

@router.get("/tax-report/{property_id}/{year}")
async def get_tax_report(property_id: int, year: int):
    """Generate tax report for a single property."""
    return await property_financial_service.generate_tax_report(property_id, year)


@router.get("/tax-report/all/{year}")
async def get_all_properties_tax_report(year: int):
    """Generate tax report for ALL 22 properties."""
    return await property_financial_service.generate_all_properties_tax_report(year)


@router.post("/tax-report/export/{year}")
async def export_to_accountant(year: int, accountant_email: str):
    """Export tax report to accountant."""
    return await property_financial_service.export_to_accountant(year, accountant_email)
