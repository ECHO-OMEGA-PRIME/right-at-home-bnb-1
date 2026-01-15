"""
Finance API Routes
P&L tracking, expense categorization, tax reports
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date
from enum import Enum
import io
import csv

router = APIRouter()

class ExpenseCategory(str, Enum):
    CLEANING = "cleaning"
    UTILITIES = "utilities"
    SUPPLIES = "supplies"
    MAINTENANCE = "maintenance"
    REPAIRS = "repairs"
    CAPEX = "capex"
    SOFTWARE = "software"
    INSURANCE = "insurance"
    TAXES = "taxes"

class Transaction(BaseModel):
    id: int
    property_id: int
    date: date
    type: str  # income, expense
    category: Optional[str]
    amount: float
    description: str
    receipt_url: Optional[str]

@router.get("/summary")
async def get_financial_summary(month: Optional[int] = None, year: Optional[int] = None):
    """Get financial summary across all properties"""
    return {
        "period": f"{year or 2025}-{month or 1:02d}",
        "total_revenue": 47500,
        "total_expenses": 12300,
        "net_profit": 35200,
        "expenses_breakdown": {
            "cleaning": 4800,
            "utilities": 3200,
            "supplies": 1500,
            "maintenance": 1800,
            "software": 500,
            "insurance": 500
        },
        "occupancy_rate": 0.82,
        "avg_daily_rate": 185
    }

@router.get("/by-property")
async def get_financials_by_property():
    """Get P&L for each property"""
    return [
        {"property_id": 1, "name": "Castleford Estate", "revenue": 6200, "expenses": 1450, "profit": 4750},
        {"property_id": 2, "name": "Petroleum Plaza Suite", "revenue": 4100, "expenses": 980, "profit": 3120},
        {"property_id": 3, "name": "Basin View Cottage", "revenue": 5300, "expenses": 1100, "profit": 4200},
    ]

@router.post("/expense")
async def add_expense(
    property_id: int,
    category: ExpenseCategory,
    amount: float,
    description: str,
    date: date = None,
    receipt_url: Optional[str] = None
):
    """Add expense record"""
    expense = {
        "id": 1001,
        "property_id": property_id,
        "date": (date or datetime.now().date()).isoformat(),
        "type": "expense",
        "category": category.value,
        "amount": amount,
        "description": description,
        "receipt_url": receipt_url
    }
    return {"status": "recorded", "expense": expense}

@router.get("/tax-report/{year}")
async def get_tax_report(year: int):
    """Get tax-ready expense report"""
    return {
        "year": year,
        "total_income": 285000,
        "total_deductible_expenses": 98500,
        "net_taxable_income": 186500,
        "expense_categories": {
            "cleaning_labor": 28800,
            "utilities": 19200,
            "supplies": 9000,
            "maintenance_repairs": 18600,
            "insurance": 6000,
            "software_subscriptions": 2400,
            "depreciation": 14500
        },
        "capex_items": [
            {"description": "HVAC Replacement - Unit 5", "amount": 8500, "date": "2024-07-15"},
            {"description": "New Mattresses x4", "amount": 2400, "date": "2024-09-01"}
        ]
    }

@router.get("/export/{format}")
async def export_financials(format: str, year: int = 2024):
    """Export financial data as CSV or PDF"""
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Property", "Type", "Category", "Amount", "Description"])
        writer.writerow(["2024-12-01", "Castleford Estate", "income", "booking", 1200, "Airbnb reservation"])
        writer.writerow(["2024-12-05", "Castleford Estate", "expense", "cleaning", 120, "Post-checkout clean"])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=rightathome_financials_{year}.csv"}
        )
    raise HTTPException(status_code=400, detail="Format not supported")
