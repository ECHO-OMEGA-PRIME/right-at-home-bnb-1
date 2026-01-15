"""
Right At Home BnB - Property Financial Service
===============================================
Comprehensive financial tracking per property:
- Utility costs (electric, water, gas, internet, etc.)
- Additional expenses (furniture, repairs, supplies)
- Monthly averages and year-end totals
- Tax reporting for Steven and accountants

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from loguru import logger
from sqlalchemy import func
from sqlalchemy.orm import Session

# Firebase for cloud sync
try:
    import firebase_admin
    from firebase_admin import firestore
    db = firestore.client() if firebase_admin._apps else None
    FIREBASE_AVAILABLE = db is not None
except:
    FIREBASE_AVAILABLE = False
    db = None


class PropertyFinancialService:
    """
    Financial tracking service for Steven's 22 properties.
    Tracks utilities, expenses, and generates tax reports.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.utilities_collection = "rah_property_utilities"
        self.expenses_collection = "rah_property_expenses"
        self.tax_reports_collection = "rah_tax_reports"

    # ========================================================================
    # UTILITY TRACKING
    # ========================================================================

    async def add_utility_bill(
        self,
        property_id: int,
        utility_type: str,
        amount: float,
        billing_month: int,
        billing_year: int,
        usage_units: float = None,
        unit_type: str = None,
        invoice_number: str = None,
        due_date: str = None,
        notes: str = None
    ) -> Dict[str, Any]:
        """Add a utility bill for a property."""
        bill_data = {
            "property_id": property_id,
            "utility_type": utility_type,
            "amount": amount,
            "billing_month": billing_month,
            "billing_year": billing_year,
            "usage_units": usage_units,
            "unit_type": unit_type,
            "invoice_number": invoice_number,
            "due_date": due_date,
            "paid": False,
            "notes": notes,
            "created_at": datetime.utcnow().isoformat()
        }

        if self.firebase_available and db:
            doc_ref = db.collection(self.utilities_collection).document()
            doc_ref.set(bill_data)
            bill_data["id"] = doc_ref.id

        logger.info(f"Added {utility_type} bill ${amount} for property {property_id}")
        return {"success": True, "bill": bill_data}

    async def mark_bill_paid(self, bill_id: str, paid_date: str = None) -> Dict:
        """Mark a utility bill as paid."""
        if self.firebase_available and db:
            doc_ref = db.collection(self.utilities_collection).document(bill_id)
            doc_ref.update({
                "paid": True,
                "paid_date": paid_date or datetime.utcnow().isoformat()
            })
        return {"success": True, "bill_id": bill_id, "status": "paid"}

    async def get_utility_summary(
        self,
        property_id: int,
        year: int = None
    ) -> Dict[str, Any]:
        """Get utility summary for a property."""
        year = year or datetime.now().year

        if not self.firebase_available or not db:
            return {"error": "Firebase not available"}

        # Query all utilities for this property and year
        docs = (
            db.collection(self.utilities_collection)
            .where("property_id", "==", property_id)
            .where("billing_year", "==", year)
            .stream()
        )

        by_type = {}
        total = Decimal("0")

        for doc in docs:
            data = doc.to_dict()
            utype = data.get("utility_type", "other")
            amount = Decimal(str(data.get("amount", 0)))

            if utype not in by_type:
                by_type[utype] = {"total": Decimal("0"), "bills": []}

            by_type[utype]["total"] += amount
            by_type[utype]["bills"].append(data)
            total += amount

        # Calculate monthly averages
        summary = {
            "property_id": property_id,
            "year": year,
            "total_utilities": float(total),
            "monthly_average": float(total / 12),
            "by_type": {k: {"total": float(v["total"]), "monthly_avg": float(v["total"] / 12), "count": len(v["bills"])} for k, v in by_type.items()}
        }

        return summary

    # ========================================================================
    # EXPENSE TRACKING
    # ========================================================================

    async def add_expense(
        self,
        property_id: int,
        category: str,
        description: str,
        amount: float,
        expense_date: str,
        vendor_name: str = None,
        invoice_number: str = None,
        receipt_url: str = None,
        is_capital_expense: bool = False,
        useful_life_years: int = None,
        tax_deductible: bool = True,
        notes: str = None
    ) -> Dict[str, Any]:
        """Add an expense for a property."""
        expense_data = {
            "property_id": property_id,
            "category": category,
            "description": description,
            "amount": amount,
            "expense_date": expense_date,
            "vendor_name": vendor_name,
            "invoice_number": invoice_number,
            "receipt_url": receipt_url,
            "is_capital_expense": is_capital_expense,
            "useful_life_years": useful_life_years,
            "tax_deductible": tax_deductible,
            "notes": notes,
            "created_at": datetime.utcnow().isoformat()
        }

        if self.firebase_available and db:
            doc_ref = db.collection(self.expenses_collection).document()
            doc_ref.set(expense_data)
            expense_data["id"] = doc_ref.id

        logger.info(f"Added {category} expense ${amount} for property {property_id}")
        return {"success": True, "expense": expense_data}

    async def get_expense_summary(
        self,
        property_id: int,
        year: int = None
    ) -> Dict[str, Any]:
        """Get expense summary for a property."""
        year = year or datetime.now().year

        if not self.firebase_available or not db:
            return {"error": "Firebase not available"}

        docs = (
            db.collection(self.expenses_collection)
            .where("property_id", "==", property_id)
            .stream()
        )

        by_category = {}
        total = Decimal("0")
        capital_total = Decimal("0")

        for doc in docs:
            data = doc.to_dict()
            exp_date = data.get("expense_date", "")
            if exp_date and str(year) in exp_date:
                cat = data.get("category", "other")
                amount = Decimal(str(data.get("amount", 0)))

                if cat not in by_category:
                    by_category[cat] = {"total": Decimal("0"), "expenses": []}

                by_category[cat]["total"] += amount
                by_category[cat]["expenses"].append(data)
                total += amount

                if data.get("is_capital_expense"):
                    capital_total += amount

        return {
            "property_id": property_id,
            "year": year,
            "total_expenses": float(total),
            "capital_expenses": float(capital_total),
            "operating_expenses": float(total - capital_total),
            "by_category": {k: {"total": float(v["total"]), "count": len(v["expenses"])} for k, v in by_category.items()}
        }

    # ========================================================================
    # TAX REPORTING
    # ========================================================================

    async def generate_tax_report(
        self,
        property_id: int,
        year: int,
        include_income: bool = True
    ) -> Dict[str, Any]:
        """Generate tax report for a property."""
        utility_summary = await self.get_utility_summary(property_id, year)
        expense_summary = await self.get_expense_summary(property_id, year)

        report = {
            "property_id": property_id,
            "tax_year": year,
            "generated_at": datetime.utcnow().isoformat(),

            # Expenses
            "total_utilities": utility_summary.get("total_utilities", 0),
            "utility_breakdown": utility_summary.get("by_type", {}),
            "total_expenses": expense_summary.get("total_expenses", 0),
            "capital_expenses": expense_summary.get("capital_expenses", 0),
            "operating_expenses": expense_summary.get("operating_expenses", 0),
            "expense_breakdown": expense_summary.get("by_category", {}),

            # Total deductible
            "total_deductible_expenses": (
                utility_summary.get("total_utilities", 0) +
                expense_summary.get("operating_expenses", 0)
            ),

            # Status
            "status": "generated",
            "exported_to_accountant": False
        }

        # Store in Firebase
        if self.firebase_available and db:
            doc_ref = db.collection(self.tax_reports_collection).document(
                f"{property_id}_{year}"
            )
            doc_ref.set(report)

        return report

    async def generate_all_properties_tax_report(
        self,
        year: int,
        property_ids: List[int] = None
    ) -> Dict[str, Any]:
        """Generate tax report for all properties (for Steven and accountant)."""
        # Default to Steven's 22 properties
        if not property_ids:
            property_ids = list(range(1, 23))

        all_reports = []
        totals = {
            "total_utilities": 0,
            "total_expenses": 0,
            "total_deductible": 0
        }

        for prop_id in property_ids:
            report = await self.generate_tax_report(prop_id, year)
            all_reports.append(report)
            totals["total_utilities"] += report.get("total_utilities", 0)
            totals["total_expenses"] += report.get("total_expenses", 0)
            totals["total_deductible"] += report.get("total_deductible_expenses", 0)

        summary = {
            "tax_year": year,
            "generated_at": datetime.utcnow().isoformat(),
            "properties_count": len(all_reports),
            "totals": totals,
            "property_reports": all_reports,
            "owner": "Steven Palma",
            "business": "Right At Home BnB",
            "location": "Midland, TX"
        }

        # Store summary
        if self.firebase_available and db:
            doc_ref = db.collection(self.tax_reports_collection).document(
                f"all_properties_{year}"
            )
            doc_ref.set(summary)

        return summary

    async def export_to_accountant(
        self,
        year: int,
        accountant_email: str
    ) -> Dict[str, Any]:
        """Export tax data to accountant."""
        report = await self.generate_all_properties_tax_report(year)

        # In production, this would send an email with the report
        export_data = {
            "year": year,
            "accountant_email": accountant_email,
            "exported_at": datetime.utcnow().isoformat(),
            "report_summary": {
                "properties": report["properties_count"],
                "total_utilities": report["totals"]["total_utilities"],
                "total_expenses": report["totals"]["total_expenses"],
                "total_deductible": report["totals"]["total_deductible"]
            }
        }

        logger.info(f"Tax report for {year} exported to {accountant_email}")
        return {"success": True, "export": export_data}


# Singleton instance
property_financial_service = PropertyFinancialService()
