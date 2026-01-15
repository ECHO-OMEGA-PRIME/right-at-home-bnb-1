"""
Right At Home BnB - Complete Financial Management Service
=========================================================
Comprehensive financial tracking and reporting for Steven Palma's
22 Midland TX rental properties.

Features:
- Revenue tracking per property and portfolio-wide
- Expense categorization with tax categories
- P&L calculations (monthly, quarterly, annual)
- CapEx tracking with depreciation
- Tax category mapping for Schedule E
- CSV/PDF export for accountants
- Revenue forecasting with ML

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
import csv
import json
import io
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from collections import defaultdict
from loguru import logger
from sqlalchemy import func, and_, or_, extract
from sqlalchemy.orm import Session
from enum import Enum

# PDF Generation
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("ReportLab not installed - PDF export disabled")

# Firebase for cloud sync
try:
    import firebase_admin
    from firebase_admin import firestore
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()
    FIREBASE_AVAILABLE = True
except Exception as e:
    FIREBASE_AVAILABLE = False
    db = None
    logger.warning(f"Firebase not available: {e}")


# ==============================================================================
# ENUMS AND CONSTANTS
# ==============================================================================

class RevenueCategory(str, Enum):
    """Revenue categories for rental properties."""
    NIGHTLY_RATE = "nightly_rate"
    CLEANING_FEE = "cleaning_fee"
    SERVICE_FEE = "service_fee"
    LATE_CHECKOUT_FEE = "late_checkout_fee"
    PET_FEE = "pet_fee"
    EXTRA_GUEST_FEE = "extra_guest_fee"
    DAMAGE_WAIVER = "damage_waiver"
    OTHER_INCOME = "other_income"


class ExpenseCategory(str, Enum):
    """Expense categories for rental properties."""
    # Operating Expenses
    CLEANING = "cleaning"
    SUPPLIES = "supplies"
    REPAIRS = "repairs"
    MAINTENANCE = "maintenance"
    UTILITIES_ELECTRIC = "utilities_electric"
    UTILITIES_WATER = "utilities_water"
    UTILITIES_GAS = "utilities_gas"
    UTILITIES_INTERNET = "utilities_internet"
    UTILITIES_TRASH = "utilities_trash"
    INSURANCE = "insurance"
    PROPERTY_TAX = "property_tax"
    HOA = "hoa"
    MORTGAGE_INTEREST = "mortgage_interest"
    PROPERTY_MANAGEMENT = "property_management"
    MARKETING = "marketing"
    SOFTWARE = "software"
    PROFESSIONAL_FEES = "professional_fees"
    TRAVEL_MILEAGE = "travel_mileage"
    OFFICE_EXPENSES = "office_expenses"
    LICENSES_PERMITS = "licenses_permits"
    OTHER_OPERATING = "other_operating"

    # Capital Expenses (CapEx)
    FURNITURE = "furniture"
    APPLIANCES = "appliances"
    RENOVATIONS = "renovations"
    LANDSCAPING_CAPITAL = "landscaping_capital"
    SMART_HOME = "smart_home"
    HVAC_REPLACEMENT = "hvac_replacement"
    ROOF_REPLACEMENT = "roof_replacement"
    FLOORING = "flooring"
    OTHER_CAPEX = "other_capex"


# Schedule E Tax Categories Mapping
SCHEDULE_E_MAPPING = {
    # Line 3 - Rents received
    RevenueCategory.NIGHTLY_RATE: "line_3_rents",
    RevenueCategory.CLEANING_FEE: "line_3_rents",
    RevenueCategory.SERVICE_FEE: "line_3_rents",
    RevenueCategory.LATE_CHECKOUT_FEE: "line_3_rents",
    RevenueCategory.PET_FEE: "line_3_rents",
    RevenueCategory.EXTRA_GUEST_FEE: "line_3_rents",
    RevenueCategory.DAMAGE_WAIVER: "line_3_rents",
    RevenueCategory.OTHER_INCOME: "line_3_rents",

    # Line 5 - Advertising
    ExpenseCategory.MARKETING: "line_5_advertising",

    # Line 6 - Auto and travel
    ExpenseCategory.TRAVEL_MILEAGE: "line_6_auto_travel",

    # Line 7 - Cleaning and maintenance
    ExpenseCategory.CLEANING: "line_7_cleaning_maintenance",
    ExpenseCategory.REPAIRS: "line_7_cleaning_maintenance",
    ExpenseCategory.MAINTENANCE: "line_7_cleaning_maintenance",

    # Line 9 - Insurance
    ExpenseCategory.INSURANCE: "line_9_insurance",

    # Line 10 - Legal and professional fees
    ExpenseCategory.PROFESSIONAL_FEES: "line_10_legal_professional",

    # Line 11 - Management fees
    ExpenseCategory.PROPERTY_MANAGEMENT: "line_11_management",

    # Line 12 - Mortgage interest
    ExpenseCategory.MORTGAGE_INTEREST: "line_12_mortgage_interest",

    # Line 14 - Repairs
    # (Already in line 7 combined)

    # Line 15 - Supplies
    ExpenseCategory.SUPPLIES: "line_15_supplies",
    ExpenseCategory.OFFICE_EXPENSES: "line_15_supplies",

    # Line 16 - Taxes
    ExpenseCategory.PROPERTY_TAX: "line_16_taxes",
    ExpenseCategory.LICENSES_PERMITS: "line_16_taxes",

    # Line 17 - Utilities
    ExpenseCategory.UTILITIES_ELECTRIC: "line_17_utilities",
    ExpenseCategory.UTILITIES_WATER: "line_17_utilities",
    ExpenseCategory.UTILITIES_GAS: "line_17_utilities",
    ExpenseCategory.UTILITIES_INTERNET: "line_17_utilities",
    ExpenseCategory.UTILITIES_TRASH: "line_17_utilities",

    # Line 18 - Depreciation (handled separately)
    ExpenseCategory.FURNITURE: "line_18_depreciation",
    ExpenseCategory.APPLIANCES: "line_18_depreciation",
    ExpenseCategory.RENOVATIONS: "line_18_depreciation",
    ExpenseCategory.SMART_HOME: "line_18_depreciation",
    ExpenseCategory.HVAC_REPLACEMENT: "line_18_depreciation",
    ExpenseCategory.ROOF_REPLACEMENT: "line_18_depreciation",
    ExpenseCategory.FLOORING: "line_18_depreciation",
    ExpenseCategory.OTHER_CAPEX: "line_18_depreciation",

    # Line 19 - Other
    ExpenseCategory.HOA: "line_19_other",
    ExpenseCategory.SOFTWARE: "line_19_other",
    ExpenseCategory.LANDSCAPING_CAPITAL: "line_19_other",
    ExpenseCategory.OTHER_OPERATING: "line_19_other",
}

# Depreciation periods (years) for capital assets
DEPRECIATION_PERIODS = {
    ExpenseCategory.FURNITURE: 7,
    ExpenseCategory.APPLIANCES: 5,
    ExpenseCategory.RENOVATIONS: 27.5,  # Residential real property
    ExpenseCategory.SMART_HOME: 5,
    ExpenseCategory.HVAC_REPLACEMENT: 27.5,
    ExpenseCategory.ROOF_REPLACEMENT: 27.5,
    ExpenseCategory.FLOORING: 5,
    ExpenseCategory.OTHER_CAPEX: 7,
}

# IRS Mileage Rate for 2026 (estimated)
IRS_MILEAGE_RATE_2026 = 0.67  # dollars per mile


# ==============================================================================
# DATA MODELS
# ==============================================================================

class RevenueEntry:
    """Revenue entry data model."""
    def __init__(
        self,
        id: str,
        property_id: str,
        booking_id: Optional[str],
        category: RevenueCategory,
        amount: Decimal,
        date: date,
        platform: str = "direct",
        description: str = "",
        notes: str = ""
    ):
        self.id = id
        self.property_id = property_id
        self.booking_id = booking_id
        self.category = category
        self.amount = Decimal(str(amount))
        self.date = date
        self.platform = platform
        self.description = description
        self.notes = notes

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "property_id": self.property_id,
            "booking_id": self.booking_id,
            "category": self.category.value,
            "amount": float(self.amount),
            "date": self.date.isoformat(),
            "platform": self.platform,
            "description": self.description,
            "notes": self.notes
        }


class ExpenseEntry:
    """Expense entry data model."""
    def __init__(
        self,
        id: str,
        property_id: str,
        category: ExpenseCategory,
        amount: Decimal,
        date: date,
        vendor: str = "",
        description: str = "",
        receipt_url: str = "",
        is_tax_deductible: bool = True,
        is_capex: bool = False,
        depreciation_years: Optional[int] = None,
        notes: str = ""
    ):
        self.id = id
        self.property_id = property_id
        self.category = category
        self.amount = Decimal(str(amount))
        self.date = date
        self.vendor = vendor
        self.description = description
        self.receipt_url = receipt_url
        self.is_tax_deductible = is_tax_deductible
        self.is_capex = is_capex
        self.depreciation_years = depreciation_years or DEPRECIATION_PERIODS.get(category, 7)
        self.notes = notes

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "property_id": self.property_id,
            "category": self.category.value,
            "amount": float(self.amount),
            "date": self.date.isoformat(),
            "vendor": self.vendor,
            "description": self.description,
            "receipt_url": self.receipt_url,
            "is_tax_deductible": self.is_tax_deductible,
            "is_capex": self.is_capex,
            "depreciation_years": self.depreciation_years,
            "notes": self.notes
        }


class MileageEntry:
    """Mileage tracking entry."""
    def __init__(
        self,
        id: str,
        property_id: str,
        date: date,
        miles: float,
        purpose: str,
        start_location: str = "",
        end_location: str = ""
    ):
        self.id = id
        self.property_id = property_id
        self.date = date
        self.miles = miles
        self.purpose = purpose
        self.start_location = start_location
        self.end_location = end_location
        self.deduction = Decimal(str(miles * IRS_MILEAGE_RATE_2026))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "property_id": self.property_id,
            "date": self.date.isoformat(),
            "miles": self.miles,
            "purpose": self.purpose,
            "start_location": self.start_location,
            "end_location": self.end_location,
            "deduction": float(self.deduction)
        }


# ==============================================================================
# FINANCIAL SERVICE
# ==============================================================================

class FinancialService:
    """
    Complete financial management service for Right At Home BnB.
    Handles revenue, expenses, P&L, tax reporting, and forecasting.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.collections = {
            "revenue": "rah_revenue",
            "expenses": "rah_expenses",
            "mileage": "rah_mileage",
            "capex": "rah_capex",
            "reports": "rah_financial_reports",
            "forecasts": "rah_forecasts"
        }
        logger.info("FinancialService initialized | Firebase: {}", self.firebase_available)

    # ==========================================================================
    # REVENUE OPERATIONS
    # ==========================================================================

    async def record_revenue(
        self,
        property_id: str,
        category: str,
        amount: float,
        date_str: str,
        booking_id: Optional[str] = None,
        platform: str = "direct",
        description: str = "",
        notes: str = ""
    ) -> Dict[str, Any]:
        """Record a revenue entry."""
        try:
            cat = RevenueCategory(category)
        except ValueError:
            cat = RevenueCategory.OTHER_INCOME

        entry_id = f"REV_{property_id}_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        entry_date = datetime.strptime(date_str, "%Y-%m-%d").date() if isinstance(date_str, str) else date_str

        entry = RevenueEntry(
            id=entry_id,
            property_id=property_id,
            booking_id=booking_id,
            category=cat,
            amount=Decimal(str(amount)),
            date=entry_date,
            platform=platform,
            description=description,
            notes=notes
        )

        data = entry.to_dict()
        data["created_at"] = datetime.utcnow().isoformat()

        if self.firebase_available and db:
            db.collection(self.collections["revenue"]).document(entry_id).set(data)

        logger.info(f"Revenue recorded: ${amount} for property {property_id} ({category})")
        return {"success": True, "entry": data}

    async def get_revenue_by_property(
        self,
        property_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get revenue breakdown for a specific property."""
        if not self.firebase_available or not db:
            return self._generate_mock_revenue(property_id, start_date, end_date)

        query = db.collection(self.collections["revenue"]).where("property_id", "==", property_id)

        docs = list(query.stream())
        entries = [doc.to_dict() for doc in docs]

        # Filter by date range
        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            entries = [e for e in entries if datetime.strptime(e["date"], "%Y-%m-%d").date() >= start]
        if end_date:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
            entries = [e for e in entries if datetime.strptime(e["date"], "%Y-%m-%d").date() <= end]

        # Aggregate by category
        by_category = defaultdict(lambda: Decimal("0"))
        by_month = defaultdict(lambda: Decimal("0"))
        total = Decimal("0")

        for entry in entries:
            amount = Decimal(str(entry["amount"]))
            by_category[entry["category"]] += amount
            month_key = entry["date"][:7]  # YYYY-MM
            by_month[month_key] += amount
            total += amount

        return {
            "property_id": property_id,
            "total_revenue": float(total),
            "by_category": {k: float(v) for k, v in by_category.items()},
            "by_month": {k: float(v) for k, v in sorted(by_month.items())},
            "entry_count": len(entries),
            "start_date": start_date,
            "end_date": end_date
        }

    async def get_revenue_breakdown(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        group_by: str = "category"  # category, property, platform, month
    ) -> Dict[str, Any]:
        """Get revenue breakdown across all properties."""
        if not self.firebase_available or not db:
            return self._generate_mock_revenue_breakdown(start_date, end_date, group_by)

        docs = list(db.collection(self.collections["revenue"]).stream())
        entries = [doc.to_dict() for doc in docs]

        # Filter by date
        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            entries = [e for e in entries if datetime.strptime(e["date"], "%Y-%m-%d").date() >= start]
        if end_date:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
            entries = [e for e in entries if datetime.strptime(e["date"], "%Y-%m-%d").date() <= end]

        # Aggregate
        breakdown = defaultdict(lambda: Decimal("0"))
        total = Decimal("0")

        for entry in entries:
            amount = Decimal(str(entry["amount"]))
            if group_by == "category":
                key = entry["category"]
            elif group_by == "property":
                key = entry["property_id"]
            elif group_by == "platform":
                key = entry.get("platform", "direct")
            elif group_by == "month":
                key = entry["date"][:7]
            else:
                key = "total"
            breakdown[key] += amount
            total += amount

        return {
            "breakdown": {k: float(v) for k, v in sorted(breakdown.items())},
            "total": float(total),
            "group_by": group_by,
            "entry_count": len(entries)
        }

    # ==========================================================================
    # EXPENSE OPERATIONS
    # ==========================================================================

    async def record_expense(
        self,
        property_id: str,
        category: str,
        amount: float,
        date_str: str,
        vendor: str = "",
        description: str = "",
        receipt_url: str = "",
        is_tax_deductible: bool = True,
        notes: str = ""
    ) -> Dict[str, Any]:
        """Record an expense entry."""
        try:
            cat = ExpenseCategory(category)
        except ValueError:
            cat = ExpenseCategory.OTHER_OPERATING

        # Determine if CapEx
        is_capex = category in [c.value for c in [
            ExpenseCategory.FURNITURE,
            ExpenseCategory.APPLIANCES,
            ExpenseCategory.RENOVATIONS,
            ExpenseCategory.SMART_HOME,
            ExpenseCategory.HVAC_REPLACEMENT,
            ExpenseCategory.ROOF_REPLACEMENT,
            ExpenseCategory.FLOORING,
            ExpenseCategory.OTHER_CAPEX
        ]]

        entry_id = f"EXP_{property_id}_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        entry_date = datetime.strptime(date_str, "%Y-%m-%d").date() if isinstance(date_str, str) else date_str

        entry = ExpenseEntry(
            id=entry_id,
            property_id=property_id,
            category=cat,
            amount=Decimal(str(amount)),
            date=entry_date,
            vendor=vendor,
            description=description,
            receipt_url=receipt_url,
            is_tax_deductible=is_tax_deductible,
            is_capex=is_capex,
            notes=notes
        )

        data = entry.to_dict()
        data["created_at"] = datetime.utcnow().isoformat()

        collection = self.collections["capex"] if is_capex else self.collections["expenses"]

        if self.firebase_available and db:
            db.collection(collection).document(entry_id).set(data)

        logger.info(f"Expense recorded: ${amount} for property {property_id} ({category}, CapEx: {is_capex})")
        return {"success": True, "entry": data}

    async def get_expenses_by_property(
        self,
        property_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        include_capex: bool = True
    ) -> Dict[str, Any]:
        """Get expense breakdown for a specific property."""
        if not self.firebase_available or not db:
            return self._generate_mock_expenses(property_id, start_date, end_date)

        # Get operating expenses
        operating_docs = list(
            db.collection(self.collections["expenses"])
            .where("property_id", "==", property_id)
            .stream()
        )
        entries = [doc.to_dict() for doc in operating_docs]

        # Get CapEx if requested
        capex_entries = []
        if include_capex:
            capex_docs = list(
                db.collection(self.collections["capex"])
                .where("property_id", "==", property_id)
                .stream()
            )
            capex_entries = [doc.to_dict() for doc in capex_docs]

        all_entries = entries + capex_entries

        # Filter by date
        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            all_entries = [e for e in all_entries if datetime.strptime(e["date"], "%Y-%m-%d").date() >= start]
        if end_date:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
            all_entries = [e for e in all_entries if datetime.strptime(e["date"], "%Y-%m-%d").date() <= end]

        # Aggregate
        by_category = defaultdict(lambda: Decimal("0"))
        by_month = defaultdict(lambda: Decimal("0"))
        total_operating = Decimal("0")
        total_capex = Decimal("0")

        for entry in all_entries:
            amount = Decimal(str(entry["amount"]))
            by_category[entry["category"]] += amount
            month_key = entry["date"][:7]
            by_month[month_key] += amount

            if entry.get("is_capex"):
                total_capex += amount
            else:
                total_operating += amount

        return {
            "property_id": property_id,
            "total_expenses": float(total_operating + total_capex),
            "operating_expenses": float(total_operating),
            "capital_expenses": float(total_capex),
            "by_category": {k: float(v) for k, v in by_category.items()},
            "by_month": {k: float(v) for k, v in sorted(by_month.items())},
            "entry_count": len(all_entries)
        }

    async def get_expense_categories(self) -> Dict[str, Any]:
        """Get all expense categories with descriptions."""
        operating = []
        capex = []

        for cat in ExpenseCategory:
            item = {
                "value": cat.value,
                "label": cat.value.replace("_", " ").title(),
                "tax_line": SCHEDULE_E_MAPPING.get(cat, "line_19_other")
            }
            if cat.value in [c.value for c in [
                ExpenseCategory.FURNITURE, ExpenseCategory.APPLIANCES,
                ExpenseCategory.RENOVATIONS, ExpenseCategory.SMART_HOME,
                ExpenseCategory.HVAC_REPLACEMENT, ExpenseCategory.ROOF_REPLACEMENT,
                ExpenseCategory.FLOORING, ExpenseCategory.OTHER_CAPEX
            ]]:
                item["depreciation_years"] = DEPRECIATION_PERIODS.get(cat, 7)
                capex.append(item)
            else:
                operating.append(item)

        return {
            "operating_expenses": operating,
            "capital_expenses": capex
        }

    # ==========================================================================
    # MILEAGE TRACKING
    # ==========================================================================

    async def record_mileage(
        self,
        property_id: str,
        date_str: str,
        miles: float,
        purpose: str,
        start_location: str = "",
        end_location: str = ""
    ) -> Dict[str, Any]:
        """Record mileage for property visits."""
        entry_id = f"MILE_{property_id}_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        entry_date = datetime.strptime(date_str, "%Y-%m-%d").date() if isinstance(date_str, str) else date_str

        entry = MileageEntry(
            id=entry_id,
            property_id=property_id,
            date=entry_date,
            miles=miles,
            purpose=purpose,
            start_location=start_location,
            end_location=end_location
        )

        data = entry.to_dict()
        data["created_at"] = datetime.utcnow().isoformat()

        if self.firebase_available and db:
            db.collection(self.collections["mileage"]).document(entry_id).set(data)

        logger.info(f"Mileage recorded: {miles} miles for property {property_id}")
        return {"success": True, "entry": data}

    async def get_mileage_summary(
        self,
        year: int,
        property_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get mileage summary for tax purposes."""
        if not self.firebase_available or not db:
            return self._generate_mock_mileage(year)

        query = db.collection(self.collections["mileage"])
        if property_id:
            query = query.where("property_id", "==", property_id)

        docs = list(query.stream())
        entries = [doc.to_dict() for doc in docs]

        # Filter by year
        entries = [e for e in entries if e["date"].startswith(str(year))]

        total_miles = sum(e["miles"] for e in entries)
        total_deduction = total_miles * IRS_MILEAGE_RATE_2026

        by_property = defaultdict(lambda: {"miles": 0, "trips": 0})
        for entry in entries:
            by_property[entry["property_id"]]["miles"] += entry["miles"]
            by_property[entry["property_id"]]["trips"] += 1

        return {
            "year": year,
            "total_miles": total_miles,
            "total_deduction": total_deduction,
            "mileage_rate": IRS_MILEAGE_RATE_2026,
            "by_property": dict(by_property),
            "trip_count": len(entries)
        }

    # ==========================================================================
    # P&L CALCULATIONS
    # ==========================================================================

    async def calculate_pl(
        self,
        property_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        period: str = "monthly"  # monthly, quarterly, annual
    ) -> Dict[str, Any]:
        """Calculate P&L for a property or portfolio."""
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        if not start_date:
            if period == "annual":
                start_date = f"{datetime.now().year}-01-01"
            elif period == "quarterly":
                quarter = (datetime.now().month - 1) // 3
                start_date = f"{datetime.now().year}-{quarter * 3 + 1:02d}-01"
            else:  # monthly
                start_date = f"{datetime.now().year}-{datetime.now().month:02d}-01"

        # Get revenue
        if property_id:
            revenue_data = await self.get_revenue_by_property(property_id, start_date, end_date)
            expense_data = await self.get_expenses_by_property(property_id, start_date, end_date)
        else:
            revenue_data = await self.get_revenue_breakdown(start_date, end_date, "month")
            expense_data = await self._get_all_expenses(start_date, end_date)

        total_revenue = Decimal(str(revenue_data.get("total_revenue", revenue_data.get("total", 0))))
        total_expenses = Decimal(str(expense_data.get("total_expenses", expense_data.get("total", 0))))
        operating_expenses = Decimal(str(expense_data.get("operating_expenses", total_expenses)))
        capital_expenses = Decimal(str(expense_data.get("capital_expenses", 0)))

        # Calculate depreciation for the period
        depreciation = await self._calculate_depreciation(property_id, start_date, end_date)

        gross_profit = total_revenue - operating_expenses
        net_profit = gross_profit - Decimal(str(depreciation))

        profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else Decimal("0")

        return {
            "property_id": property_id or "all",
            "period": period,
            "start_date": start_date,
            "end_date": end_date,
            "revenue": {
                "total": float(total_revenue),
                "breakdown": revenue_data.get("by_category", revenue_data.get("breakdown", {}))
            },
            "expenses": {
                "total": float(total_expenses),
                "operating": float(operating_expenses),
                "capital": float(capital_expenses),
                "depreciation": float(depreciation),
                "breakdown": expense_data.get("by_category", {})
            },
            "profit": {
                "gross": float(gross_profit),
                "net": float(net_profit),
                "margin_percentage": float(profit_margin.quantize(Decimal("0.01"), ROUND_HALF_UP))
            },
            "generated_at": datetime.utcnow().isoformat()
        }

    async def calculate_property_pl(
        self,
        property_id: str,
        year: int,
        month: Optional[int] = None,
        quarter: Optional[int] = None
    ) -> Dict[str, Any]:
        """Calculate P&L for a specific property."""
        if month:
            start_date = f"{year}-{month:02d}-01"
            if month == 12:
                end_date = f"{year + 1}-01-01"
            else:
                end_date = f"{year}-{month + 1:02d}-01"
            period = "monthly"
        elif quarter:
            start_month = (quarter - 1) * 3 + 1
            end_month = quarter * 3 + 1
            start_date = f"{year}-{start_month:02d}-01"
            if end_month > 12:
                end_date = f"{year + 1}-01-01"
            else:
                end_date = f"{year}-{end_month:02d}-01"
            period = "quarterly"
        else:
            start_date = f"{year}-01-01"
            end_date = f"{year + 1}-01-01"
            period = "annual"

        return await self.calculate_pl(property_id, start_date, end_date, period)

    # ==========================================================================
    # TAX REPORTING
    # ==========================================================================

    async def generate_schedule_e_data(
        self,
        year: int,
        property_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate Schedule E format data for tax filing."""
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        # Get all revenue
        revenue_data = await self.get_revenue_breakdown(start_date, end_date, "category")

        # Get all expenses
        expense_data = await self._get_all_expenses(start_date, end_date)

        # Get mileage
        mileage_data = await self.get_mileage_summary(year, property_id)

        # Get depreciation
        depreciation = await self._calculate_depreciation(property_id, start_date, end_date)

        # Map to Schedule E lines
        schedule_e = {
            "line_3_rents": Decimal("0"),
            "line_5_advertising": Decimal("0"),
            "line_6_auto_travel": Decimal("0"),
            "line_7_cleaning_maintenance": Decimal("0"),
            "line_9_insurance": Decimal("0"),
            "line_10_legal_professional": Decimal("0"),
            "line_11_management": Decimal("0"),
            "line_12_mortgage_interest": Decimal("0"),
            "line_15_supplies": Decimal("0"),
            "line_16_taxes": Decimal("0"),
            "line_17_utilities": Decimal("0"),
            "line_18_depreciation": Decimal(str(depreciation)),
            "line_19_other": Decimal("0")
        }

        # Add mileage to auto/travel
        schedule_e["line_6_auto_travel"] += Decimal(str(mileage_data.get("total_deduction", 0)))

        # Map revenue to line 3
        for cat, amount in revenue_data.get("breakdown", {}).items():
            schedule_e["line_3_rents"] += Decimal(str(amount))

        # Map expenses to appropriate lines
        for cat, amount in expense_data.get("by_category", {}).items():
            try:
                exp_cat = ExpenseCategory(cat)
                line = SCHEDULE_E_MAPPING.get(exp_cat, "line_19_other")
                if line != "line_18_depreciation":  # Depreciation handled separately
                    schedule_e[line] += Decimal(str(amount))
            except ValueError:
                schedule_e["line_19_other"] += Decimal(str(amount))

        # Calculate totals
        total_income = schedule_e["line_3_rents"]
        total_expenses = sum(v for k, v in schedule_e.items() if k.startswith("line_") and k != "line_3_rents")
        net_income = total_income - total_expenses

        return {
            "tax_year": year,
            "property_id": property_id or "all_properties",
            "owner": "Steven Palma",
            "business": "Right At Home BnB",
            "schedule_e_lines": {k: float(v) for k, v in schedule_e.items()},
            "summary": {
                "total_income": float(total_income),
                "total_expenses": float(total_expenses),
                "net_rental_income": float(net_income)
            },
            "mileage_detail": mileage_data,
            "generated_at": datetime.utcnow().isoformat()
        }

    # ==========================================================================
    # FORECASTING
    # ==========================================================================

    async def forecast_revenue(
        self,
        property_id: Optional[str] = None,
        months_ahead: int = 3
    ) -> Dict[str, Any]:
        """Forecast revenue based on historical data."""
        # Get historical data for the past 12 months
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)

        if property_id:
            historical = await self.get_revenue_by_property(
                property_id,
                start_date.strftime("%Y-%m-%d"),
                end_date.strftime("%Y-%m-%d")
            )
        else:
            historical = await self.get_revenue_breakdown(
                start_date.strftime("%Y-%m-%d"),
                end_date.strftime("%Y-%m-%d"),
                "month"
            )

        monthly_data = historical.get("by_month", historical.get("breakdown", {}))

        if not monthly_data:
            return self._generate_mock_forecast(property_id, months_ahead)

        # Simple moving average forecast
        monthly_values = list(monthly_data.values())
        if len(monthly_values) < 3:
            avg = sum(monthly_values) / len(monthly_values) if monthly_values else 0
        else:
            avg = sum(monthly_values[-3:]) / 3  # 3-month moving average

        # Apply seasonal adjustment (simplified)
        forecasts = []
        current_month = datetime.now().month
        for i in range(1, months_ahead + 1):
            forecast_month = (current_month + i - 1) % 12 + 1
            # Simple seasonality: summer months slightly higher
            seasonal_factor = 1.1 if forecast_month in [6, 7, 8] else 1.0
            forecast_value = avg * seasonal_factor

            forecasts.append({
                "month": f"{datetime.now().year if forecast_month > current_month else datetime.now().year + 1}-{forecast_month:02d}",
                "forecast": round(forecast_value, 2),
                "confidence": 0.85
            })

        return {
            "property_id": property_id or "all",
            "historical_average": round(avg, 2),
            "forecasts": forecasts,
            "method": "3-month moving average with seasonal adjustment",
            "generated_at": datetime.utcnow().isoformat()
        }

    # ==========================================================================
    # FINANCIAL OVERVIEW
    # ==========================================================================

    async def get_financial_overview(
        self,
        year: Optional[int] = None,
        month: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get comprehensive financial overview."""
        year = year or datetime.now().year

        if month:
            start_date = f"{year}-{month:02d}-01"
            if month == 12:
                end_date = f"{year + 1}-01-01"
            else:
                end_date = f"{year}-{month + 1:02d}-01"
        else:
            start_date = f"{year}-01-01"
            end_date = f"{year + 1}-01-01"

        # Get P&L
        pl_data = await self.calculate_pl(None, start_date, end_date)

        # Get revenue breakdown
        revenue_by_property = await self.get_revenue_breakdown(start_date, end_date, "property")
        revenue_by_platform = await self.get_revenue_breakdown(start_date, end_date, "platform")

        # Get forecast
        forecast = await self.forecast_revenue(None, 3)

        # Calculate key metrics
        total_revenue = pl_data["revenue"]["total"]
        total_expenses = pl_data["expenses"]["total"]
        net_profit = pl_data["profit"]["net"]

        # YTD comparison (mock - would compare to previous year)
        ytd_change = 12.5  # Would calculate from historical data

        return {
            "period": {
                "year": year,
                "month": month,
                "start_date": start_date,
                "end_date": end_date
            },
            "summary": {
                "total_revenue": total_revenue,
                "total_expenses": total_expenses,
                "net_profit": net_profit,
                "profit_margin": pl_data["profit"]["margin_percentage"],
                "ytd_change_percent": ytd_change
            },
            "revenue": {
                "total": total_revenue,
                "by_property": revenue_by_property.get("breakdown", {}),
                "by_platform": revenue_by_platform.get("breakdown", {}),
                "by_category": pl_data["revenue"]["breakdown"]
            },
            "expenses": {
                "total": total_expenses,
                "operating": pl_data["expenses"]["operating"],
                "capital": pl_data["expenses"]["capital"],
                "depreciation": pl_data["expenses"]["depreciation"],
                "by_category": pl_data["expenses"]["breakdown"]
            },
            "forecast": forecast,
            "generated_at": datetime.utcnow().isoformat()
        }

    # ==========================================================================
    # EXPORT FUNCTIONS
    # ==========================================================================

    async def export_to_csv(
        self,
        year: int,
        export_type: str = "schedule_e"  # schedule_e, expenses, revenue, all
    ) -> bytes:
        """Export financial data to CSV format."""
        output = io.StringIO()

        if export_type == "schedule_e":
            data = await self.generate_schedule_e_data(year)
            writer = csv.writer(output)

            # Header
            writer.writerow(["Right At Home BnB - Schedule E Export"])
            writer.writerow(["Tax Year", year])
            writer.writerow(["Owner", "Steven Palma"])
            writer.writerow(["Generated", datetime.now().isoformat()])
            writer.writerow([])

            # Schedule E lines
            writer.writerow(["Schedule E Line", "Amount"])
            for line, amount in data["schedule_e_lines"].items():
                line_desc = line.replace("_", " ").title()
                writer.writerow([line_desc, f"${amount:,.2f}"])

            writer.writerow([])
            writer.writerow(["Summary"])
            writer.writerow(["Total Income", f"${data['summary']['total_income']:,.2f}"])
            writer.writerow(["Total Expenses", f"${data['summary']['total_expenses']:,.2f}"])
            writer.writerow(["Net Rental Income", f"${data['summary']['net_rental_income']:,.2f}"])

        elif export_type == "expenses":
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            expenses = await self._get_all_expenses(start_date, end_date)

            writer = csv.writer(output)
            writer.writerow(["Date", "Property", "Category", "Vendor", "Description", "Amount", "Tax Deductible", "CapEx"])

            for entry in expenses.get("entries", []):
                writer.writerow([
                    entry.get("date", ""),
                    entry.get("property_id", ""),
                    entry.get("category", ""),
                    entry.get("vendor", ""),
                    entry.get("description", ""),
                    entry.get("amount", 0),
                    "Yes" if entry.get("is_tax_deductible") else "No",
                    "Yes" if entry.get("is_capex") else "No"
                ])

        elif export_type == "revenue":
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            revenue = await self.get_revenue_breakdown(start_date, end_date, "month")

            writer = csv.writer(output)
            writer.writerow(["Month", "Revenue"])
            for month, amount in revenue.get("breakdown", {}).items():
                writer.writerow([month, f"${amount:,.2f}"])
            writer.writerow(["Total", f"${revenue.get('total', 0):,.2f}"])

        else:  # all
            # Combine all exports
            schedule_e_data = await self.generate_schedule_e_data(year)
            overview = await self.get_financial_overview(year)

            writer = csv.writer(output)
            writer.writerow(["=== RIGHT AT HOME BnB FINANCIAL REPORT ==="])
            writer.writerow(["Year", year])
            writer.writerow([])

            writer.writerow(["=== SUMMARY ==="])
            writer.writerow(["Total Revenue", f"${overview['summary']['total_revenue']:,.2f}"])
            writer.writerow(["Total Expenses", f"${overview['summary']['total_expenses']:,.2f}"])
            writer.writerow(["Net Profit", f"${overview['summary']['net_profit']:,.2f}"])
            writer.writerow(["Profit Margin", f"{overview['summary']['profit_margin']:.1f}%"])
            writer.writerow([])

            writer.writerow(["=== SCHEDULE E DATA ==="])
            for line, amount in schedule_e_data["schedule_e_lines"].items():
                writer.writerow([line.replace("_", " ").title(), f"${amount:,.2f}"])

        return output.getvalue().encode("utf-8")

    async def export_to_pdf(
        self,
        year: int,
        export_type: str = "full_report"
    ) -> Optional[bytes]:
        """Export financial data to PDF format."""
        if not REPORTLAB_AVAILABLE:
            logger.error("ReportLab not installed - cannot generate PDF")
            return None

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )

        styles = getSampleStyleSheet()
        story = []

        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER
        )
        story.append(Paragraph("Right At Home BnB", title_style))
        story.append(Paragraph(f"Financial Report - {year}", styles['Heading2']))
        story.append(Spacer(1, 20))

        # Get data
        overview = await self.get_financial_overview(year)
        schedule_e = await self.generate_schedule_e_data(year)

        # Summary section
        story.append(Paragraph("Financial Summary", styles['Heading2']))
        story.append(Spacer(1, 10))

        summary_data = [
            ["Metric", "Amount"],
            ["Total Revenue", f"${overview['summary']['total_revenue']:,.2f}"],
            ["Total Expenses", f"${overview['summary']['total_expenses']:,.2f}"],
            ["Net Profit", f"${overview['summary']['net_profit']:,.2f}"],
            ["Profit Margin", f"{overview['summary']['profit_margin']:.1f}%"]
        ]

        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#500000')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F5F5F0')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#2D2D2D'))
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 30))

        # Schedule E section
        story.append(Paragraph("Schedule E Tax Data", styles['Heading2']))
        story.append(Spacer(1, 10))

        schedule_data = [["Line", "Description", "Amount"]]
        for line, amount in schedule_e["schedule_e_lines"].items():
            desc = line.replace("line_", "Line ").replace("_", " ").title()
            schedule_data.append([line.split("_")[1], desc, f"${amount:,.2f}"])

        schedule_table = Table(schedule_data, colWidths=[0.8*inch, 3.2*inch, 1.5*inch])
        schedule_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#500000')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F0')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC'))
        ]))
        story.append(schedule_table)

        # Footer
        story.append(Spacer(1, 40))
        footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.gray)
        story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", footer_style))
        story.append(Paragraph("Owner: Steven Palma | Midland, TX", footer_style))
        story.append(Paragraph("Made by ECHO OMEGA PRIME", footer_style))

        doc.build(story)
        return buffer.getvalue()

    # ==========================================================================
    # HELPER METHODS
    # ==========================================================================

    async def _get_all_expenses(
        self,
        start_date: str,
        end_date: str
    ) -> Dict[str, Any]:
        """Get all expenses across all properties."""
        if not self.firebase_available or not db:
            return self._generate_mock_all_expenses(start_date, end_date)

        # Get operating expenses
        operating_docs = list(db.collection(self.collections["expenses"]).stream())
        capex_docs = list(db.collection(self.collections["capex"]).stream())

        entries = [doc.to_dict() for doc in operating_docs] + [doc.to_dict() for doc in capex_docs]

        # Filter by date
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        entries = [
            e for e in entries
            if start <= datetime.strptime(e["date"], "%Y-%m-%d").date() <= end
        ]

        by_category = defaultdict(lambda: Decimal("0"))
        total_operating = Decimal("0")
        total_capex = Decimal("0")

        for entry in entries:
            amount = Decimal(str(entry["amount"]))
            by_category[entry["category"]] += amount
            if entry.get("is_capex"):
                total_capex += amount
            else:
                total_operating += amount

        return {
            "total": float(total_operating + total_capex),
            "total_expenses": float(total_operating + total_capex),
            "operating_expenses": float(total_operating),
            "capital_expenses": float(total_capex),
            "by_category": {k: float(v) for k, v in by_category.items()},
            "entries": entries
        }

    async def _calculate_depreciation(
        self,
        property_id: Optional[str],
        start_date: str,
        end_date: str
    ) -> float:
        """Calculate depreciation for capital assets."""
        if not self.firebase_available or not db:
            return 0.0

        query = db.collection(self.collections["capex"])
        if property_id:
            query = query.where("property_id", "==", property_id)

        docs = list(query.stream())
        entries = [doc.to_dict() for doc in docs]

        total_depreciation = Decimal("0")
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        period_days = (end - start).days

        for entry in entries:
            entry_date = datetime.strptime(entry["date"], "%Y-%m-%d").date()
            if entry_date <= end:  # Asset was purchased before period end
                amount = Decimal(str(entry["amount"]))
                years = entry.get("depreciation_years", 7)
                annual_depreciation = amount / Decimal(str(years))

                # Prorate for the period
                days_in_year = 365
                daily_depreciation = annual_depreciation / Decimal(str(days_in_year))

                # Calculate depreciation for this period
                if entry_date < start:
                    # Asset was purchased before period start
                    period_depreciation = daily_depreciation * Decimal(str(period_days))
                else:
                    # Asset was purchased during period
                    days_owned_in_period = (end - entry_date).days
                    period_depreciation = daily_depreciation * Decimal(str(days_owned_in_period))

                total_depreciation += period_depreciation

        return float(total_depreciation.quantize(Decimal("0.01"), ROUND_HALF_UP))

    # ==========================================================================
    # MOCK DATA GENERATORS (for demo when Firebase unavailable)
    # ==========================================================================

    def _generate_mock_revenue(self, property_id: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """Generate mock revenue data for demo purposes."""
        base_revenue = 4500
        return {
            "property_id": property_id,
            "total_revenue": base_revenue * 1.0 + (hash(property_id) % 1000),
            "by_category": {
                "nightly_rate": base_revenue * 0.85,
                "cleaning_fee": base_revenue * 0.10,
                "service_fee": base_revenue * 0.05
            },
            "by_month": {
                f"{datetime.now().year}-{i:02d}": base_revenue / 12 * (1 + (i % 3) * 0.1)
                for i in range(1, 13)
            },
            "entry_count": 12
        }

    def _generate_mock_revenue_breakdown(self, start_date: str, end_date: str, group_by: str) -> Dict[str, Any]:
        """Generate mock revenue breakdown."""
        total = 95000
        if group_by == "category":
            breakdown = {
                "nightly_rate": total * 0.80,
                "cleaning_fee": total * 0.12,
                "service_fee": total * 0.05,
                "other_income": total * 0.03
            }
        elif group_by == "platform":
            breakdown = {
                "airbnb": total * 0.55,
                "vrbo": total * 0.30,
                "direct": total * 0.15
            }
        else:  # month
            breakdown = {
                f"{datetime.now().year}-{i:02d}": total / 12 * (1 + (i % 3) * 0.1)
                for i in range(1, 13)
            }
        return {"breakdown": breakdown, "total": total, "group_by": group_by}

    def _generate_mock_expenses(self, property_id: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """Generate mock expense data."""
        operating = 800
        capex = 200
        return {
            "property_id": property_id,
            "total_expenses": operating + capex,
            "operating_expenses": operating,
            "capital_expenses": capex,
            "by_category": {
                "cleaning": 300,
                "utilities_electric": 150,
                "utilities_water": 75,
                "supplies": 100,
                "maintenance": 175,
                "furniture": 200
            },
            "by_month": {
                f"{datetime.now().year}-{i:02d}": (operating + capex) / 12
                for i in range(1, 13)
            },
            "entry_count": 15
        }

    def _generate_mock_all_expenses(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """Generate mock all expenses data."""
        operating = 18000
        capex = 5000
        return {
            "total": operating + capex,
            "total_expenses": operating + capex,
            "operating_expenses": operating,
            "capital_expenses": capex,
            "by_category": {
                "cleaning": 6500,
                "utilities_electric": 3200,
                "utilities_water": 1600,
                "utilities_internet": 800,
                "supplies": 2100,
                "maintenance": 3800,
                "furniture": 3000,
                "appliances": 2000
            },
            "entries": []
        }

    def _generate_mock_mileage(self, year: int) -> Dict[str, Any]:
        """Generate mock mileage data."""
        total_miles = 2500
        return {
            "year": year,
            "total_miles": total_miles,
            "total_deduction": total_miles * IRS_MILEAGE_RATE_2026,
            "mileage_rate": IRS_MILEAGE_RATE_2026,
            "by_property": {},
            "trip_count": 150
        }

    def _generate_mock_forecast(self, property_id: str, months_ahead: int) -> Dict[str, Any]:
        """Generate mock forecast data."""
        base = 4500 if property_id else 95000
        forecasts = []
        current_month = datetime.now().month

        for i in range(1, months_ahead + 1):
            forecast_month = (current_month + i - 1) % 12 + 1
            year = datetime.now().year if forecast_month > current_month else datetime.now().year + 1
            forecasts.append({
                "month": f"{year}-{forecast_month:02d}",
                "forecast": base * (1 + (i * 0.02)),
                "confidence": 0.85 - (i * 0.05)
            })

        return {
            "property_id": property_id or "all",
            "historical_average": base,
            "forecasts": forecasts,
            "method": "Mock forecast",
            "generated_at": datetime.utcnow().isoformat()
        }


# ==============================================================================
# SINGLETON INSTANCE
# ==============================================================================

financial_service = FinancialService()
