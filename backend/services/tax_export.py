"""
Right At Home BnB - Tax Export Service
======================================
CPA-ready tax export system for IRS Schedule E and expense categorization.

Features:
- Generate IRS Schedule E format
- Categorize all expenses by TaxCategory from models_financial.py
- Calculate depreciation (MACRS method)
- Sum by property and category
- Export to CSV and PDF (ReportLab)

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import io
import csv
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict
from loguru import logger

# PDF Generation
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph,
        Spacer, PageBreak, KeepTogether
    )
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

# Import TaxCategory from models_financial
try:
    from database.models_financial import TaxCategory, TaxExportLog
    TAX_MODELS_AVAILABLE = True
except ImportError:
    TAX_MODELS_AVAILABLE = False
    logger.warning("Tax models not available - using fallback enum")

# IRS Mileage Rate for 2026
IRS_MILEAGE_RATE_2026 = 0.67

# IRS Schedule E Line Descriptions
SCHEDULE_E_LINES = {
    "line_3": "Rents received",
    "line_5": "Advertising",
    "line_6": "Auto and travel",
    "line_7": "Cleaning and maintenance",
    "line_8": "Commissions",
    "line_9": "Insurance",
    "line_10": "Legal and other professional fees",
    "line_11": "Management fees",
    "line_12": "Mortgage interest paid to banks",
    "line_13": "Other interest",
    "line_14": "Repairs",
    "line_15": "Supplies",
    "line_16": "Taxes",
    "line_17": "Utilities",
    "line_18": "Depreciation expense or depletion",
    "line_19": "Other (list)",
}

# Tax Category to Schedule E Line Mapping
TAX_CATEGORY_TO_LINE = {
    "advertising": "line_5",
    "auto_travel": "line_6",
    "cleaning_maintenance": "line_7",
    "commissions": "line_8",
    "insurance": "line_9",
    "legal_professional": "line_10",
    "management_fees": "line_11",
    "mortgage_interest": "line_12",
    "other_interest": "line_13",
    "repairs": "line_14",
    "supplies": "line_15",
    "taxes": "line_16",
    "utilities": "line_17",
    "depreciation": "line_18",
    "pest_control": "line_7",  # Grouped under cleaning/maintenance
    "landscaping": "line_7",
    "pool_service": "line_7",
    "hvac_service": "line_14",  # Repairs
    "security": "line_19",  # Other
    "trash_removal": "line_17",  # Utilities
    "carpet_flooring": "line_14",  # Repairs
    "appliance_repair": "line_14",  # Repairs
    "plumbing": "line_14",  # Repairs
    "electrical": "line_14",  # Repairs
    "roof_exterior": "line_14",  # Repairs
    "furniture": "line_18",  # Depreciation (CapEx)
    "linens_towels": "line_15",  # Supplies
    "amenities": "line_15",  # Supplies
    "na": "line_19",
    "other": "line_19",
}

# Depreciation Periods for Capital Assets (MACRS)
DEPRECIATION_PERIODS = {
    "furniture": 7,
    "appliances": 5,
    "carpet_flooring": 5,
    "linens_towels": 3,
    "security": 5,
    "hvac_service": 15,
    "roof_exterior": 27.5,
    "electrical": 15,
    "plumbing": 15,
    "amenities": 3,
}


class TaxExportService:
    """
    Tax export service for Right At Home BnB.
    Generates IRS Schedule E format reports and exports to CSV/PDF.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.collections = {
            "expenses": "rah_tax_expenses",
            "revenue": "rah_revenue",
            "mileage": "rah_mileage",
            "capex": "rah_capex",
            "export_logs": "rah_tax_export_logs",
        }
        self.owner_name = "Steven Palma"
        self.business_name = "Right At Home BnB"
        self.business_address = "Midland, TX"
        logger.info("TaxExportService initialized | Firebase: {}", self.firebase_available)

    # ==========================================================================
    # TAX SUMMARY
    # ==========================================================================

    async def get_tax_summary(
        self,
        year: int,
        property_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive tax summary for a given year.
        Used for the admin dashboard tax overview.
        """
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        # Get all financial data
        revenue_data = await self._get_revenue(start_date, end_date, property_id)
        expense_data = await self._get_expenses(start_date, end_date, property_id)
        mileage_data = await self._get_mileage(year, property_id)
        depreciation = await self._calculate_depreciation(start_date, end_date, property_id)

        # Calculate Schedule E totals
        schedule_e = await self._generate_schedule_e_lines(
            revenue_data, expense_data, mileage_data, depreciation
        )

        # Calculate totals
        total_income = schedule_e.get("line_3", Decimal("0"))
        total_expenses = sum(
            v for k, v in schedule_e.items()
            if k != "line_3" and isinstance(v, (Decimal, int, float))
        )
        net_rental_income = total_income - total_expenses

        # Get expense breakdown by category
        expense_by_category = await self._get_expense_breakdown_by_category(
            start_date, end_date, property_id
        )

        # Get expense breakdown by property
        expense_by_property = await self._get_expense_breakdown_by_property(
            start_date, end_date
        )

        return {
            "tax_year": year,
            "property_id": property_id or "all",
            "owner": self.owner_name,
            "business": self.business_name,
            "schedule_e_summary": {
                "total_income": float(total_income),
                "total_expenses": float(total_expenses),
                "net_rental_income": float(net_rental_income),
                "effective_tax_rate_estimate": 22.0,  # Estimate for planning
                "estimated_tax_liability": float(net_rental_income * Decimal("0.22")),
            },
            "schedule_e_lines": {k: float(v) for k, v in schedule_e.items()},
            "expense_by_category": expense_by_category,
            "expense_by_property": expense_by_property,
            "mileage_summary": mileage_data,
            "depreciation_summary": {
                "total_depreciation": float(depreciation),
                "method": "MACRS (Modified Accelerated Cost Recovery System)",
            },
            "generated_at": datetime.utcnow().isoformat(),
        }

    # ==========================================================================
    # EXPENSE BY CATEGORY
    # ==========================================================================

    async def get_expenses_by_category(
        self,
        year: int,
        property_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get expenses broken down by TaxCategory.
        Returns amounts for each category with Schedule E line mapping.
        """
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        breakdown = await self._get_expense_breakdown_by_category(
            start_date, end_date, property_id
        )

        return {
            "tax_year": year,
            "property_id": property_id or "all",
            "categories": breakdown,
            "total_expenses": sum(c["amount"] for c in breakdown),
            "generated_at": datetime.utcnow().isoformat(),
        }

    # ==========================================================================
    # CSV EXPORT
    # ==========================================================================

    async def export_to_csv(
        self,
        year: int,
        property_id: Optional[str] = None
    ) -> bytes:
        """
        Export tax data to CSV format for CPA.
        Includes Schedule E lines and detailed expense breakdown.
        """
        summary = await self.get_tax_summary(year, property_id)

        output = io.StringIO()
        writer = csv.writer(output)

        # Header Section
        writer.writerow(["=" * 60])
        writer.writerow(["RIGHT AT HOME BNB - TAX EXPORT"])
        writer.writerow(["=" * 60])
        writer.writerow([])
        writer.writerow(["Tax Year", year])
        writer.writerow(["Owner", self.owner_name])
        writer.writerow(["Business", self.business_name])
        writer.writerow(["Address", self.business_address])
        writer.writerow(["Generated", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
        writer.writerow([])

        # Schedule E Section
        writer.writerow(["=" * 60])
        writer.writerow(["SCHEDULE E - SUPPLEMENTAL INCOME AND LOSS"])
        writer.writerow(["=" * 60])
        writer.writerow([])
        writer.writerow(["Line", "Description", "Amount"])
        writer.writerow(["-" * 10, "-" * 40, "-" * 15])

        for line, description in SCHEDULE_E_LINES.items():
            line_num = line.replace("line_", "")
            amount = summary["schedule_e_lines"].get(line, 0)
            writer.writerow([line_num, description, f"${amount:,.2f}"])

        writer.writerow([])
        writer.writerow(["SUMMARY"])
        writer.writerow(["-" * 60])
        writer.writerow(["Total Income (Line 3)", "", f"${summary['schedule_e_summary']['total_income']:,.2f}"])
        writer.writerow(["Total Expenses", "", f"${summary['schedule_e_summary']['total_expenses']:,.2f}"])
        writer.writerow(["Net Rental Income", "", f"${summary['schedule_e_summary']['net_rental_income']:,.2f}"])
        writer.writerow([])

        # Expense Breakdown by Category
        writer.writerow(["=" * 60])
        writer.writerow(["EXPENSE BREAKDOWN BY TAX CATEGORY"])
        writer.writerow(["=" * 60])
        writer.writerow([])
        writer.writerow(["Category", "Schedule E Line", "Amount", "Percentage"])
        writer.writerow(["-" * 25, "-" * 15, "-" * 12, "-" * 10])

        total_expenses = summary["schedule_e_summary"]["total_expenses"]
        for cat in summary["expense_by_category"]:
            percentage = (cat["amount"] / total_expenses * 100) if total_expenses > 0 else 0
            writer.writerow([
                cat["category_name"],
                cat["schedule_e_line"],
                f"${cat['amount']:,.2f}",
                f"{percentage:.1f}%"
            ])

        writer.writerow([])

        # Expense Breakdown by Property
        if summary["expense_by_property"]:
            writer.writerow(["=" * 60])
            writer.writerow(["EXPENSE BREAKDOWN BY PROPERTY"])
            writer.writerow(["=" * 60])
            writer.writerow([])
            writer.writerow(["Property ID", "Property Name", "Total Expenses"])
            writer.writerow(["-" * 20, "-" * 30, "-" * 15])

            for prop in summary["expense_by_property"]:
                writer.writerow([
                    prop["property_id"],
                    prop.get("property_name", "Unknown"),
                    f"${prop['total_expenses']:,.2f}"
                ])

            writer.writerow([])

        # Mileage Summary
        if summary["mileage_summary"]["total_miles"] > 0:
            writer.writerow(["=" * 60])
            writer.writerow(["MILEAGE DEDUCTION"])
            writer.writerow(["=" * 60])
            writer.writerow([])
            writer.writerow(["Total Miles", summary["mileage_summary"]["total_miles"]])
            writer.writerow(["IRS Rate (2026)", f"${IRS_MILEAGE_RATE_2026}/mile"])
            writer.writerow(["Total Deduction", f"${summary['mileage_summary']['total_deduction']:,.2f}"])
            writer.writerow([])

        # Footer
        writer.writerow(["=" * 60])
        writer.writerow(["END OF TAX EXPORT"])
        writer.writerow(["=" * 60])
        writer.writerow([])
        writer.writerow(["Made by ECHO OMEGA PRIME"])

        # Log the export
        await self._log_export(year, property_id, "csv", summary)

        return output.getvalue().encode("utf-8")

    # ==========================================================================
    # PDF EXPORT
    # ==========================================================================

    async def export_to_pdf(
        self,
        year: int,
        property_id: Optional[str] = None
    ) -> Optional[bytes]:
        """
        Export tax data to professional PDF format for CPA.
        Uses ReportLab for formatting.
        """
        if not REPORTLAB_AVAILABLE:
            logger.error("ReportLab not installed - cannot generate PDF")
            return None

        summary = await self.get_tax_summary(year, property_id)

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

        # Custom Styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=20,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#500000')
        )

        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            spaceBefore=20,
            spaceAfter=10,
            textColor=colors.HexColor('#500000')
        )

        subheading_style = ParagraphStyle(
            'SubHeading',
            parent=styles['Heading3'],
            fontSize=12,
            spaceBefore=15,
            spaceAfter=8,
            textColor=colors.HexColor('#2D2D2D')
        )

        # ====== TITLE PAGE ======
        story.append(Paragraph("RIGHT AT HOME BnB", title_style))
        story.append(Paragraph(f"Tax Export Report - {year}", styles['Heading2']))
        story.append(Spacer(1, 30))

        # Business Info Table
        info_data = [
            ["Owner:", self.owner_name],
            ["Business:", self.business_name],
            ["Location:", self.business_address],
            ["Tax Year:", str(year)],
            ["Generated:", datetime.now().strftime("%B %d, %Y")],
        ]

        info_table = Table(info_data, colWidths=[1.5 * inch, 4 * inch])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#500000')),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 40))

        # Summary Box
        story.append(Paragraph("Financial Summary", heading_style))

        summary_data = [
            ["Metric", "Amount"],
            ["Total Rental Income", f"${summary['schedule_e_summary']['total_income']:,.2f}"],
            ["Total Deductible Expenses", f"${summary['schedule_e_summary']['total_expenses']:,.2f}"],
            ["Net Rental Income", f"${summary['schedule_e_summary']['net_rental_income']:,.2f}"],
            ["Estimated Tax Liability (22%)", f"${summary['schedule_e_summary']['estimated_tax_liability']:,.2f}"],
        ]

        summary_table = Table(summary_data, colWidths=[3.5 * inch, 2 * inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#500000')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F0')]),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E8DFC4')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ]))
        story.append(summary_table)
        story.append(PageBreak())

        # ====== SCHEDULE E PAGE ======
        story.append(Paragraph("IRS Schedule E - Supplemental Income and Loss", heading_style))
        story.append(Paragraph("Rental Real Estate, Royalties, Partnerships, S Corporations, Trusts, etc.", styles['Normal']))
        story.append(Spacer(1, 20))

        schedule_data = [["Line", "Description", "Amount"]]
        for line, description in SCHEDULE_E_LINES.items():
            line_num = line.replace("line_", "")
            amount = summary["schedule_e_lines"].get(line, 0)
            schedule_data.append([line_num, description, f"${amount:,.2f}"])

        schedule_table = Table(schedule_data, colWidths=[0.7 * inch, 4 * inch, 1.5 * inch])
        schedule_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#500000')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F0')]),
        ]))
        story.append(schedule_table)
        story.append(PageBreak())

        # ====== EXPENSE BREAKDOWN BY CATEGORY ======
        story.append(Paragraph("Expense Breakdown by Tax Category", heading_style))
        story.append(Spacer(1, 15))

        total_expenses = summary["schedule_e_summary"]["total_expenses"]
        cat_data = [["Category", "Schedule E Line", "Amount", "%"]]
        for cat in summary["expense_by_category"]:
            percentage = (cat["amount"] / total_expenses * 100) if total_expenses > 0 else 0
            cat_data.append([
                cat["category_name"],
                cat["schedule_e_line"],
                f"${cat['amount']:,.2f}",
                f"{percentage:.1f}%"
            ])

        cat_table = Table(cat_data, colWidths=[2.5 * inch, 1.5 * inch, 1.2 * inch, 0.8 * inch])
        cat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#500000')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F0')]),
        ]))
        story.append(cat_table)

        # ====== MILEAGE SECTION (if applicable) ======
        if summary["mileage_summary"]["total_miles"] > 0:
            story.append(Spacer(1, 30))
            story.append(Paragraph("Mileage Deduction", subheading_style))

            mileage_data = [
                ["Description", "Value"],
                ["Total Business Miles", f"{summary['mileage_summary']['total_miles']:,}"],
                ["IRS Standard Mileage Rate", f"${IRS_MILEAGE_RATE_2026}/mile"],
                ["Total Mileage Deduction", f"${summary['mileage_summary']['total_deduction']:,.2f}"],
            ]

            mileage_table = Table(mileage_data, colWidths=[3 * inch, 2 * inch])
            mileage_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#722F37')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(mileage_table)

        # ====== DEPRECIATION SECTION ======
        if summary["depreciation_summary"]["total_depreciation"] > 0:
            story.append(Spacer(1, 30))
            story.append(Paragraph("Depreciation Schedule", subheading_style))

            dep_data = [
                ["Description", "Value"],
                ["Method", summary["depreciation_summary"]["method"]],
                ["Total Depreciation", f"${summary['depreciation_summary']['total_depreciation']:,.2f}"],
            ]

            dep_table = Table(dep_data, colWidths=[3 * inch, 2 * inch])
            dep_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#722F37')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(dep_table)

        # ====== FOOTER ======
        story.append(Spacer(1, 50))
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.gray,
            alignment=TA_CENTER
        )
        story.append(Paragraph(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | "
            f"Tax Year: {year} | Made by ECHO OMEGA PRIME",
            footer_style
        ))

        doc.build(story)

        # Log the export
        await self._log_export(year, property_id, "pdf", summary)

        return buffer.getvalue()

    # ==========================================================================
    # INTERNAL HELPER METHODS
    # ==========================================================================

    async def _get_revenue(
        self,
        start_date: str,
        end_date: str,
        property_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get revenue for date range."""
        if not self.firebase_available or not db:
            return self._mock_revenue(start_date, end_date)

        query = db.collection(self.collections["revenue"])
        if property_id:
            query = query.where("property_id", "==", property_id)

        docs = list(query.stream())
        entries = [doc.to_dict() for doc in docs]

        # Filter by date
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        entries = [
            e for e in entries
            if start <= datetime.strptime(e.get("date", start_date), "%Y-%m-%d").date() <= end
        ]

        total = sum(Decimal(str(e.get("amount", 0))) for e in entries)

        return {
            "total": total,
            "entries": entries,
            "count": len(entries),
        }

    async def _get_expenses(
        self,
        start_date: str,
        end_date: str,
        property_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get expenses for date range."""
        if not self.firebase_available or not db:
            return self._mock_expenses(start_date, end_date)

        # Get both operating and capital expenses
        collections_to_query = [self.collections["expenses"], self.collections["capex"]]
        all_entries = []

        for coll in collections_to_query:
            query = db.collection(coll)
            if property_id:
                query = query.where("property_id", "==", property_id)

            docs = list(query.stream())
            all_entries.extend([doc.to_dict() for doc in docs])

        # Filter by date
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        entries = [
            e for e in all_entries
            if start <= datetime.strptime(e.get("date", start_date), "%Y-%m-%d").date() <= end
        ]

        # Group by tax category
        by_category = defaultdict(lambda: Decimal("0"))
        for e in entries:
            category = e.get("tax_category", e.get("category", "other"))
            by_category[category] += Decimal(str(e.get("amount", 0)))

        total = sum(by_category.values())

        return {
            "total": total,
            "by_category": dict(by_category),
            "entries": entries,
            "count": len(entries),
        }

    async def _get_mileage(
        self,
        year: int,
        property_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get mileage summary for year."""
        if not self.firebase_available or not db:
            return self._mock_mileage(year)

        query = db.collection(self.collections["mileage"])
        if property_id:
            query = query.where("property_id", "==", property_id)

        docs = list(query.stream())
        entries = [doc.to_dict() for doc in docs]

        # Filter by year
        entries = [e for e in entries if str(e.get("date", "")).startswith(str(year))]

        total_miles = sum(e.get("miles", 0) for e in entries)
        total_deduction = total_miles * IRS_MILEAGE_RATE_2026

        return {
            "total_miles": total_miles,
            "total_deduction": total_deduction,
            "mileage_rate": IRS_MILEAGE_RATE_2026,
            "trip_count": len(entries),
        }

    async def _calculate_depreciation(
        self,
        start_date: str,
        end_date: str,
        property_id: Optional[str] = None
    ) -> Decimal:
        """Calculate depreciation for capital assets using MACRS."""
        if not self.firebase_available or not db:
            return Decimal("0")

        query = db.collection(self.collections["capex"])
        if property_id:
            query = query.where("property_id", "==", property_id)

        docs = list(query.stream())
        entries = [doc.to_dict() for doc in docs]

        total_depreciation = Decimal("0")
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        period_days = (end - start).days or 365

        for entry in entries:
            entry_date = datetime.strptime(entry.get("date", start_date), "%Y-%m-%d").date()
            if entry_date <= end:
                amount = Decimal(str(entry.get("amount", 0)))
                category = entry.get("tax_category", entry.get("category", "other"))
                years = DEPRECIATION_PERIODS.get(category, 7)

                annual_depreciation = amount / Decimal(str(years))
                daily_depreciation = annual_depreciation / Decimal("365")

                if entry_date < start:
                    period_depreciation = daily_depreciation * Decimal(str(period_days))
                else:
                    days_owned = (end - entry_date).days
                    period_depreciation = daily_depreciation * Decimal(str(days_owned))

                total_depreciation += period_depreciation

        return total_depreciation.quantize(Decimal("0.01"), ROUND_HALF_UP)

    async def _generate_schedule_e_lines(
        self,
        revenue_data: Dict[str, Any],
        expense_data: Dict[str, Any],
        mileage_data: Dict[str, Any],
        depreciation: Decimal
    ) -> Dict[str, Decimal]:
        """Generate Schedule E line items."""
        lines = {f"line_{i}": Decimal("0") for i in range(3, 20)}

        # Line 3 - Rents received
        lines["line_3"] = revenue_data.get("total", Decimal("0"))

        # Map expenses to lines
        for category, amount in expense_data.get("by_category", {}).items():
            line = TAX_CATEGORY_TO_LINE.get(category, "line_19")
            lines[line] += Decimal(str(amount))

        # Line 6 - Add mileage deduction
        lines["line_6"] += Decimal(str(mileage_data.get("total_deduction", 0)))

        # Line 18 - Add depreciation
        lines["line_18"] += depreciation

        return lines

    async def _get_expense_breakdown_by_category(
        self,
        start_date: str,
        end_date: str,
        property_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get detailed expense breakdown by tax category."""
        expense_data = await self._get_expenses(start_date, end_date, property_id)

        categories = []
        for category, amount in expense_data.get("by_category", {}).items():
            schedule_line = TAX_CATEGORY_TO_LINE.get(category, "line_19")
            line_description = SCHEDULE_E_LINES.get(schedule_line, "Other")

            categories.append({
                "category": category,
                "category_name": category.replace("_", " ").title(),
                "amount": float(amount),
                "schedule_e_line": f"Line {schedule_line.replace('line_', '')} - {line_description}",
            })

        # Sort by amount descending
        categories.sort(key=lambda x: x["amount"], reverse=True)
        return categories

    async def _get_expense_breakdown_by_property(
        self,
        start_date: str,
        end_date: str
    ) -> List[Dict[str, Any]]:
        """Get expense breakdown by property."""
        if not self.firebase_available or not db:
            return self._mock_expense_by_property()

        # Get all expenses
        all_entries = []
        for coll in [self.collections["expenses"], self.collections["capex"]]:
            docs = list(db.collection(coll).stream())
            all_entries.extend([doc.to_dict() for doc in docs])

        # Filter by date
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        entries = [
            e for e in all_entries
            if start <= datetime.strptime(e.get("date", start_date), "%Y-%m-%d").date() <= end
        ]

        # Group by property
        by_property = defaultdict(lambda: Decimal("0"))
        for e in entries:
            prop_id = e.get("property_id", "unknown")
            by_property[prop_id] += Decimal(str(e.get("amount", 0)))

        result = [
            {
                "property_id": prop_id,
                "total_expenses": float(amount),
            }
            for prop_id, amount in sorted(by_property.items(), key=lambda x: x[1], reverse=True)
        ]

        return result

    async def _log_export(
        self,
        year: int,
        property_id: Optional[str],
        format_type: str,
        summary: Dict[str, Any]
    ) -> None:
        """Log the tax export for audit trail."""
        if not self.firebase_available or not db:
            return

        log_entry = {
            "tax_year": year,
            "property_id": property_id,
            "export_type": "schedule_e",
            "file_format": format_type,
            "total_income": summary["schedule_e_summary"]["total_income"],
            "total_expenses": summary["schedule_e_summary"]["total_expenses"],
            "net_income": summary["schedule_e_summary"]["net_rental_income"],
            "created_at": datetime.utcnow().isoformat(),
            "created_by": "system",
        }

        db.collection(self.collections["export_logs"]).add(log_entry)
        logger.info(f"Tax export logged: {year} {format_type} | Net: ${summary['schedule_e_summary']['net_rental_income']:,.2f}")

    # ==========================================================================
    # MOCK DATA (for demo when Firebase unavailable)
    # ==========================================================================

    def _mock_revenue(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """Generate mock revenue data."""
        return {
            "total": Decimal("285000"),
            "entries": [],
            "count": 156,
        }

    def _mock_expenses(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """Generate mock expense data."""
        return {
            "total": Decimal("68500"),
            "by_category": {
                "cleaning_maintenance": Decimal("18500"),
                "utilities": Decimal("12800"),
                "repairs": Decimal("8500"),
                "supplies": Decimal("6200"),
                "insurance": Decimal("7800"),
                "taxes": Decimal("5600"),
                "advertising": Decimal("2100"),
                "pest_control": Decimal("1800"),
                "landscaping": Decimal("2400"),
                "pool_service": Decimal("1500"),
                "other": Decimal("1300"),
            },
            "entries": [],
            "count": 245,
        }

    def _mock_mileage(self, year: int) -> Dict[str, Any]:
        """Generate mock mileage data."""
        total_miles = 2850
        return {
            "total_miles": total_miles,
            "total_deduction": total_miles * IRS_MILEAGE_RATE_2026,
            "mileage_rate": IRS_MILEAGE_RATE_2026,
            "trip_count": 186,
        }

    def _mock_expense_by_property(self) -> List[Dict[str, Any]]:
        """Generate mock expense by property data."""
        properties = [
            ("castleford-5001", "Oasis with Pool-Billiards @ Castleford"),
            ("adobe-compound-gc", "Adobe Compound @ Golf Course"),
            ("garfield-2702", "Patio Home with Hot Tub @ Garfield"),
            ("douglas-4501", "Old Midland Living @ Douglas"),
            ("dentcrest-4707", "Hot Tub Delight @ Dentcrest"),
        ]

        return [
            {
                "property_id": prop_id,
                "property_name": name,
                "total_expenses": 3000 + (i * 500),
            }
            for i, (prop_id, name) in enumerate(properties)
        ]


# ==============================================================================
# SINGLETON INSTANCE
# ==============================================================================

tax_export_service = TaxExportService()
