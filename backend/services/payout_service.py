"""
Right At Home BnB - Weekly Payout Report Service
=================================================
Generates Friday payout reports for Steven Palma's 22 properties:
- Calculate weekly earnings per property
- Deduct expenses (cleaners, pool, maintenance)
- Calculate owner distributions
- Generate professional PDF reports
- Email delivery to owners

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
import io
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from collections import defaultdict
from loguru import logger
from sqlalchemy import func, and_, or_, extract
from sqlalchemy.orm import Session

# PDF Generation
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
        Image, PageBreak, HRFlowable
    )
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    from reportlab.graphics.shapes import Drawing, Rect, String
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics.charts.piecharts import Pie
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
# ECHO OMEGA PRIME BRAND COLORS
# ==============================================================================
ECHO_COLORS = {
    "cobalt": colors.HexColor("#0047AB"),
    "orange": colors.HexColor("#FF6B35"),
    "dark_magenta": colors.HexColor("#8B008B"),
    "dark_bg": colors.HexColor("#1a1a2e"),
    "light_text": colors.HexColor("#E0E0E0"),
    "success_green": colors.HexColor("#28a745"),
    "warning_yellow": colors.HexColor("#ffc107"),
    "danger_red": colors.HexColor("#dc3545"),
}


# ==============================================================================
# DATA CLASSES
# ==============================================================================

class PropertyWeeklyEarnings:
    """Weekly earnings breakdown for a single property."""

    def __init__(
        self,
        property_id: str,
        property_name: str,
        week_start: date,
        week_end: date
    ):
        self.property_id = property_id
        self.property_name = property_name
        self.week_start = week_start
        self.week_end = week_end

        # Revenue
        self.vrbo_revenue = Decimal("0")
        self.airbnb_revenue = Decimal("0")
        self.direct_revenue = Decimal("0")
        self.cleaning_fees_collected = Decimal("0")
        self.other_income = Decimal("0")

        # Expenses
        self.cleaner_costs = Decimal("0")
        self.pool_tech_costs = Decimal("0")
        self.lawn_costs = Decimal("0")
        self.maintenance_costs = Decimal("0")
        self.utility_estimates = Decimal("0")
        self.other_expenses = Decimal("0")

        # Bookings
        self.total_bookings = 0
        self.guest_nights = 0

    @property
    def total_revenue(self) -> Decimal:
        return (
            self.vrbo_revenue + self.airbnb_revenue +
            self.direct_revenue + self.cleaning_fees_collected +
            self.other_income
        )

    @property
    def total_expenses(self) -> Decimal:
        return (
            self.cleaner_costs + self.pool_tech_costs +
            self.lawn_costs + self.maintenance_costs +
            self.utility_estimates + self.other_expenses
        )

    @property
    def net_profit(self) -> Decimal:
        return self.total_revenue - self.total_expenses

    def to_dict(self) -> Dict[str, Any]:
        return {
            "property_id": self.property_id,
            "property_name": self.property_name,
            "week_start": self.week_start.isoformat(),
            "week_end": self.week_end.isoformat(),
            "revenue": {
                "vrbo": float(self.vrbo_revenue),
                "airbnb": float(self.airbnb_revenue),
                "direct": float(self.direct_revenue),
                "cleaning_fees": float(self.cleaning_fees_collected),
                "other": float(self.other_income),
                "total": float(self.total_revenue)
            },
            "expenses": {
                "cleaners": float(self.cleaner_costs),
                "pool": float(self.pool_tech_costs),
                "lawn": float(self.lawn_costs),
                "maintenance": float(self.maintenance_costs),
                "utilities": float(self.utility_estimates),
                "other": float(self.other_expenses),
                "total": float(self.total_expenses)
            },
            "net_profit": float(self.net_profit),
            "bookings": self.total_bookings,
            "guest_nights": self.guest_nights
        }


class WeeklyPayoutReport:
    """Complete weekly payout report for all properties."""

    def __init__(self, week_start: date, week_end: date):
        self.id: Optional[str] = None
        self.week_start = week_start
        self.week_end = week_end
        self.generated_at = datetime.utcnow()

        # Property-level data
        self.property_earnings: List[PropertyWeeklyEarnings] = []

        # Portfolio totals
        self.total_gross_revenue = Decimal("0")
        self.vrbo_revenue = Decimal("0")
        self.airbnb_revenue = Decimal("0")
        self.direct_revenue = Decimal("0")

        self.total_cleaner_costs = Decimal("0")
        self.total_pool_tech_costs = Decimal("0")
        self.total_lawn_costs = Decimal("0")
        self.total_utility_estimates = Decimal("0")
        self.total_other_expenses = Decimal("0")
        self.total_expenses = Decimal("0")

        self.net_profit = Decimal("0")

        # Top performer
        self.top_property_id: Optional[str] = None
        self.top_property_name: Optional[str] = None
        self.top_property_revenue = Decimal("0")
        self.top_property_profit = Decimal("0")

        # Stats
        self.total_bookings = 0
        self.total_guest_nights = 0
        self.avg_occupancy = 0.0
        self.direct_booking_count = 0
        self.ota_fees_saved = Decimal("0")

        # Delivery
        self.is_sent = False
        self.sent_at: Optional[datetime] = None
        self.sent_to: List[str] = []

    def add_property_earnings(self, earnings: PropertyWeeklyEarnings):
        """Add a property's earnings to the report."""
        self.property_earnings.append(earnings)

        # Update totals
        self.vrbo_revenue += earnings.vrbo_revenue
        self.airbnb_revenue += earnings.airbnb_revenue
        self.direct_revenue += earnings.direct_revenue

        self.total_cleaner_costs += earnings.cleaner_costs
        self.total_pool_tech_costs += earnings.pool_tech_costs
        self.total_lawn_costs += earnings.lawn_costs
        self.total_utility_estimates += earnings.utility_estimates
        self.total_other_expenses += earnings.other_expenses

        self.total_bookings += earnings.total_bookings
        self.total_guest_nights += earnings.guest_nights

        # Track top performer
        if earnings.net_profit > self.top_property_profit:
            self.top_property_id = earnings.property_id
            self.top_property_name = earnings.property_name
            self.top_property_revenue = earnings.total_revenue
            self.top_property_profit = earnings.net_profit

    def finalize(self):
        """Calculate final totals after all properties added."""
        self.total_gross_revenue = (
            self.vrbo_revenue + self.airbnb_revenue + self.direct_revenue
        )
        self.total_expenses = (
            self.total_cleaner_costs + self.total_pool_tech_costs +
            self.total_lawn_costs + self.total_utility_estimates +
            self.total_other_expenses
        )
        self.net_profit = self.total_gross_revenue - self.total_expenses

        # Calculate occupancy (22 properties * 7 nights = 154 max nights)
        max_nights = len(self.property_earnings) * 7
        self.avg_occupancy = (self.total_guest_nights / max_nights * 100) if max_nights > 0 else 0.0

        # Estimate OTA fees saved on direct bookings (assume 15% OTA fee)
        self.ota_fees_saved = self.direct_revenue * Decimal("0.15")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "week_start": self.week_start.isoformat(),
            "week_end": self.week_end.isoformat(),
            "generated_at": self.generated_at.isoformat(),
            "totals": {
                "gross_revenue": float(self.total_gross_revenue),
                "vrbo_revenue": float(self.vrbo_revenue),
                "airbnb_revenue": float(self.airbnb_revenue),
                "direct_revenue": float(self.direct_revenue),
                "total_expenses": float(self.total_expenses),
                "cleaner_costs": float(self.total_cleaner_costs),
                "pool_costs": float(self.total_pool_tech_costs),
                "lawn_costs": float(self.total_lawn_costs),
                "utility_estimates": float(self.total_utility_estimates),
                "other_expenses": float(self.total_other_expenses),
                "net_profit": float(self.net_profit)
            },
            "top_performer": {
                "property_id": self.top_property_id,
                "property_name": self.top_property_name,
                "revenue": float(self.top_property_revenue),
                "profit": float(self.top_property_profit)
            },
            "stats": {
                "total_bookings": self.total_bookings,
                "guest_nights": self.total_guest_nights,
                "occupancy_percent": round(self.avg_occupancy, 1),
                "direct_bookings": self.direct_booking_count,
                "ota_fees_saved": float(self.ota_fees_saved)
            },
            "properties": [p.to_dict() for p in self.property_earnings],
            "delivery": {
                "is_sent": self.is_sent,
                "sent_at": self.sent_at.isoformat() if self.sent_at else None,
                "sent_to": self.sent_to
            }
        }


# ==============================================================================
# PAYOUT SERVICE
# ==============================================================================

class PayoutService:
    """
    Weekly payout report generation service.
    Calculates earnings, deducts expenses, generates PDF reports.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.collections = {
            "payout_reports": "rah_payout_reports",
            "revenue": "rah_revenue",
            "expenses": "rah_expenses",
            "bookings": "rah_bookings",
            "cleaning_jobs": "rah_cleaning_jobs",
            "properties": "rah_properties"
        }

        # Email configuration
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("FROM_EMAIL", "reports@rightathomebnb.com")

        # Owner emails
        self.owner_emails = [
            os.getenv("OWNER_EMAIL_1", "steven@rightathomebnb.com"),
            os.getenv("OWNER_EMAIL_2", "")  # Optional second recipient
        ]

        logger.info("PayoutService initialized | Firebase: {}", self.firebase_available)

    # ==========================================================================
    # WEEK CALCULATION
    # ==========================================================================

    def get_current_week_range(self) -> Tuple[date, date]:
        """Get the current week's date range (Saturday to Friday)."""
        today = date.today()
        # Friday is weekday 4
        days_since_friday = (today.weekday() - 4) % 7
        week_end = today - timedelta(days=days_since_friday)
        week_start = week_end - timedelta(days=6)
        return week_start, week_end

    def get_previous_week_range(self) -> Tuple[date, date]:
        """Get the previous week's date range."""
        week_start, week_end = self.get_current_week_range()
        return week_start - timedelta(days=7), week_end - timedelta(days=7)

    def get_week_range_for_date(self, target_date: date) -> Tuple[date, date]:
        """Get the week range containing a specific date."""
        days_since_friday = (target_date.weekday() - 4) % 7
        week_end = target_date - timedelta(days=days_since_friday) if days_since_friday > 0 else target_date
        week_start = week_end - timedelta(days=6)
        return week_start, week_end

    # ==========================================================================
    # PROPERTY LIST
    # ==========================================================================

    async def get_all_properties(self) -> List[Dict[str, Any]]:
        """Get list of all properties."""
        if self.firebase_available and db:
            docs = list(db.collection(self.collections["properties"]).stream())
            return [{"id": doc.id, **doc.to_dict()} for doc in docs]

        # Mock data for 22 Midland TX properties
        return [
            {"id": f"prop_{i}", "name": f"Midland Property {i}", "address": f"{1000 + i * 10} Main St, Midland, TX"}
            for i in range(1, 23)
        ]

    # ==========================================================================
    # REVENUE CALCULATION
    # ==========================================================================

    async def get_property_revenue(
        self,
        property_id: str,
        week_start: date,
        week_end: date
    ) -> Dict[str, Decimal]:
        """Get revenue breakdown for a property for the week."""
        if self.firebase_available and db:
            docs = list(
                db.collection(self.collections["revenue"])
                .where("property_id", "==", property_id)
                .stream()
            )

            revenue = {
                "vrbo": Decimal("0"),
                "airbnb": Decimal("0"),
                "direct": Decimal("0"),
                "cleaning_fees": Decimal("0"),
                "other": Decimal("0")
            }

            for doc in docs:
                data = doc.to_dict()
                entry_date = datetime.strptime(data["date"], "%Y-%m-%d").date()
                if week_start <= entry_date <= week_end:
                    amount = Decimal(str(data.get("amount", 0)))
                    platform = data.get("platform", "direct").lower()
                    category = data.get("category", "nightly_rate").lower()

                    if "cleaning" in category:
                        revenue["cleaning_fees"] += amount
                    elif platform == "vrbo":
                        revenue["vrbo"] += amount
                    elif platform == "airbnb":
                        revenue["airbnb"] += amount
                    elif platform == "direct":
                        revenue["direct"] += amount
                    else:
                        revenue["other"] += amount

            return revenue

        # Mock revenue data
        import random
        base = random.randint(800, 2500)
        return {
            "vrbo": Decimal(str(base * 0.45)),
            "airbnb": Decimal(str(base * 0.35)),
            "direct": Decimal(str(base * 0.15)),
            "cleaning_fees": Decimal(str(random.randint(100, 250))),
            "other": Decimal(str(random.randint(0, 100)))
        }

    # ==========================================================================
    # EXPENSE CALCULATION
    # ==========================================================================

    async def get_property_expenses(
        self,
        property_id: str,
        week_start: date,
        week_end: date
    ) -> Dict[str, Decimal]:
        """Get expense breakdown for a property for the week."""
        if self.firebase_available and db:
            docs = list(
                db.collection(self.collections["expenses"])
                .where("property_id", "==", property_id)
                .stream()
            )

            expenses = {
                "cleaners": Decimal("0"),
                "pool": Decimal("0"),
                "lawn": Decimal("0"),
                "maintenance": Decimal("0"),
                "utilities": Decimal("0"),
                "other": Decimal("0")
            }

            for doc in docs:
                data = doc.to_dict()
                entry_date = datetime.strptime(data["date"], "%Y-%m-%d").date()
                if week_start <= entry_date <= week_end:
                    amount = Decimal(str(data.get("amount", 0)))
                    category = data.get("category", "other").lower()

                    if "clean" in category:
                        expenses["cleaners"] += amount
                    elif "pool" in category:
                        expenses["pool"] += amount
                    elif "lawn" in category or "landscape" in category:
                        expenses["lawn"] += amount
                    elif "maintenance" in category or "repair" in category:
                        expenses["maintenance"] += amount
                    elif "utilit" in category:
                        expenses["utilities"] += amount
                    else:
                        expenses["other"] += amount

            return expenses

        # Mock expense data
        import random
        return {
            "cleaners": Decimal(str(random.randint(100, 300))),
            "pool": Decimal(str(random.randint(0, 100))),
            "lawn": Decimal(str(random.randint(0, 75))),
            "maintenance": Decimal(str(random.randint(0, 200))),
            "utilities": Decimal(str(random.randint(50, 150))),
            "other": Decimal(str(random.randint(0, 50)))
        }

    # ==========================================================================
    # BOOKING STATS
    # ==========================================================================

    async def get_property_booking_stats(
        self,
        property_id: str,
        week_start: date,
        week_end: date
    ) -> Dict[str, int]:
        """Get booking statistics for a property for the week."""
        if self.firebase_available and db:
            docs = list(
                db.collection(self.collections["bookings"])
                .where("property_id", "==", property_id)
                .stream()
            )

            bookings = 0
            guest_nights = 0

            for doc in docs:
                data = doc.to_dict()
                check_in = datetime.strptime(data["check_in"], "%Y-%m-%d").date() if isinstance(data["check_in"], str) else data["check_in"].date()
                check_out = datetime.strptime(data["check_out"], "%Y-%m-%d").date() if isinstance(data["check_out"], str) else data["check_out"].date()

                # Check if booking overlaps with the week
                if check_in <= week_end and check_out >= week_start:
                    bookings += 1
                    # Calculate nights within the week
                    overlap_start = max(check_in, week_start)
                    overlap_end = min(check_out, week_end)
                    nights = (overlap_end - overlap_start).days
                    guest_nights += max(0, nights)

            return {"bookings": bookings, "guest_nights": guest_nights}

        # Mock data
        import random
        nights = random.randint(0, 7)
        return {"bookings": 1 if nights > 0 else 0, "guest_nights": nights}

    # ==========================================================================
    # REPORT GENERATION
    # ==========================================================================

    async def generate_weekly_report(
        self,
        week_start: Optional[date] = None,
        week_end: Optional[date] = None
    ) -> WeeklyPayoutReport:
        """Generate a complete weekly payout report."""
        if not week_start or not week_end:
            week_start, week_end = self.get_current_week_range()

        report = WeeklyPayoutReport(week_start, week_end)
        report.id = f"PAYOUT_{week_start.strftime('%Y%m%d')}_{week_end.strftime('%Y%m%d')}"

        # Get all properties
        properties = await self.get_all_properties()

        for prop in properties:
            prop_id = prop.get("id", prop.get("property_id", "unknown"))
            prop_name = prop.get("name", f"Property {prop_id}")

            earnings = PropertyWeeklyEarnings(prop_id, prop_name, week_start, week_end)

            # Get revenue
            revenue = await self.get_property_revenue(prop_id, week_start, week_end)
            earnings.vrbo_revenue = revenue.get("vrbo", Decimal("0"))
            earnings.airbnb_revenue = revenue.get("airbnb", Decimal("0"))
            earnings.direct_revenue = revenue.get("direct", Decimal("0"))
            earnings.cleaning_fees_collected = revenue.get("cleaning_fees", Decimal("0"))
            earnings.other_income = revenue.get("other", Decimal("0"))

            # Get expenses
            expenses = await self.get_property_expenses(prop_id, week_start, week_end)
            earnings.cleaner_costs = expenses.get("cleaners", Decimal("0"))
            earnings.pool_tech_costs = expenses.get("pool", Decimal("0"))
            earnings.lawn_costs = expenses.get("lawn", Decimal("0"))
            earnings.maintenance_costs = expenses.get("maintenance", Decimal("0"))
            earnings.utility_estimates = expenses.get("utilities", Decimal("0"))
            earnings.other_expenses = expenses.get("other", Decimal("0"))

            # Get booking stats
            stats = await self.get_property_booking_stats(prop_id, week_start, week_end)
            earnings.total_bookings = stats.get("bookings", 0)
            earnings.guest_nights = stats.get("guest_nights", 0)

            # Track direct bookings
            if earnings.direct_revenue > 0:
                report.direct_booking_count += 1

            report.add_property_earnings(earnings)

        report.finalize()

        # Save to Firebase
        if self.firebase_available and db:
            db.collection(self.collections["payout_reports"]).document(report.id).set(report.to_dict())

        logger.info(
            f"Generated payout report {report.id}: "
            f"Revenue=${report.total_gross_revenue:.2f}, "
            f"Expenses=${report.total_expenses:.2f}, "
            f"Net=${report.net_profit:.2f}"
        )

        return report

    # ==========================================================================
    # REPORT RETRIEVAL
    # ==========================================================================

    async def get_report_by_id(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific payout report by ID."""
        if self.firebase_available and db:
            doc = db.collection(self.collections["payout_reports"]).document(report_id).get()
            if doc.exists:
                return {"id": doc.id, **doc.to_dict()}
        return None

    async def list_reports(
        self,
        limit: int = 10,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List payout reports, most recent first."""
        if self.firebase_available and db:
            docs = list(
                db.collection(self.collections["payout_reports"])
                .order_by("week_end", direction=firestore.Query.DESCENDING)
                .limit(limit)
                .offset(offset)
                .stream()
            )
            return [{"id": doc.id, **doc.to_dict()} for doc in docs]

        # Return empty list for mock
        return []

    # ==========================================================================
    # PDF GENERATION
    # ==========================================================================

    async def generate_pdf_report(self, report: WeeklyPayoutReport) -> Optional[bytes]:
        """Generate a professional PDF payout report."""
        if not REPORTLAB_AVAILABLE:
            logger.error("ReportLab not installed - cannot generate PDF")
            return None

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=50,
            leftMargin=50,
            topMargin=50,
            bottomMargin=50
        )

        styles = getSampleStyleSheet()
        story = []

        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=28,
            spaceAfter=5,
            alignment=TA_CENTER,
            textColor=ECHO_COLORS["cobalt"]
        )

        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=14,
            spaceAfter=20,
            alignment=TA_CENTER,
            textColor=colors.gray
        )

        section_header = ParagraphStyle(
            'SectionHeader',
            parent=styles['Heading2'],
            fontSize=16,
            spaceBefore=20,
            spaceAfter=10,
            textColor=ECHO_COLORS["dark_magenta"]
        )

        # ==========================================================================
        # HEADER
        # ==========================================================================
        story.append(Paragraph("RIGHT AT HOME BnB", title_style))
        story.append(Paragraph("Weekly Payout Report", subtitle_style))
        story.append(Paragraph(
            f"Week of {report.week_start.strftime('%B %d')} - {report.week_end.strftime('%B %d, %Y')}",
            subtitle_style
        ))

        # Decorative line
        story.append(HRFlowable(
            width="100%",
            thickness=2,
            color=ECHO_COLORS["orange"],
            spaceBefore=10,
            spaceAfter=20
        ))

        # ==========================================================================
        # EXECUTIVE SUMMARY
        # ==========================================================================
        story.append(Paragraph("Executive Summary", section_header))

        # Key metrics table
        summary_data = [
            ["Metric", "Amount"],
            ["Total Gross Revenue", f"${report.total_gross_revenue:,.2f}"],
            ["Total Expenses", f"${report.total_expenses:,.2f}"],
            ["NET PROFIT", f"${report.net_profit:,.2f}"],
            ["", ""],
            ["VRBO Revenue", f"${report.vrbo_revenue:,.2f}"],
            ["Airbnb Revenue", f"${report.airbnb_revenue:,.2f}"],
            ["Direct Booking Revenue", f"${report.direct_revenue:,.2f}"],
            ["", ""],
            ["Cleaner Costs", f"${report.total_cleaner_costs:,.2f}"],
            ["Pool/Lawn/Maintenance", f"${report.total_pool_tech_costs + report.total_lawn_costs:,.2f}"],
            ["Utilities (Est.)", f"${report.total_utility_estimates:,.2f}"],
            ["Other Expenses", f"${report.total_other_expenses:,.2f}"],
        ]

        summary_table = Table(summary_data, colWidths=[3.5*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), ECHO_COLORS["cobalt"]),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('FONTSIZE', (0, 3), (-1, 3), 13),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 3), (-1, 3), ECHO_COLORS["success_green"]),
            ('TEXTCOLOR', (0, 3), (-1, 3), colors.white),
            ('ROWBACKGROUNDS', (0, 1), (-1, 2), [colors.white, colors.HexColor('#F5F5F5')]),
            ('ROWBACKGROUNDS', (0, 5), (-1, 7), [colors.white, colors.HexColor('#F5F5F5')]),
            ('ROWBACKGROUNDS', (0, 9), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC'))
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 20))

        # ==========================================================================
        # PERFORMANCE HIGHLIGHTS
        # ==========================================================================
        story.append(Paragraph("Performance Highlights", section_header))

        highlights_data = [
            ["Metric", "Value"],
            ["Total Bookings", str(report.total_bookings)],
            ["Total Guest Nights", str(report.total_guest_nights)],
            ["Portfolio Occupancy", f"{report.avg_occupancy:.1f}%"],
            ["Direct Bookings", str(report.direct_booking_count)],
            ["OTA Fees Saved", f"${report.ota_fees_saved:,.2f}"],
        ]

        highlights_table = Table(highlights_data, colWidths=[3.5*inch, 2*inch])
        highlights_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), ECHO_COLORS["dark_magenta"]),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC'))
        ]))
        story.append(highlights_table)
        story.append(Spacer(1, 20))

        # ==========================================================================
        # TOP PERFORMER
        # ==========================================================================
        if report.top_property_name:
            story.append(Paragraph("Top Performing Property", section_header))

            top_data = [
                ["", ""],
                ["Property", report.top_property_name],
                ["Revenue", f"${report.top_property_revenue:,.2f}"],
                ["Net Profit", f"${report.top_property_profit:,.2f}"],
            ]

            top_table = Table(top_data, colWidths=[2*inch, 3.5*inch])
            top_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), ECHO_COLORS["orange"]),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 11),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FFF5F0')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC'))
            ]))
            story.append(top_table)

        # ==========================================================================
        # PROPERTY BREAKDOWN (Page 2)
        # ==========================================================================
        story.append(PageBreak())
        story.append(Paragraph("Property-by-Property Breakdown", section_header))

        # Sort by net profit descending
        sorted_properties = sorted(
            report.property_earnings,
            key=lambda x: x.net_profit,
            reverse=True
        )

        # Property table
        prop_data = [["Property", "Revenue", "Expenses", "Net Profit", "Nights"]]

        for earnings in sorted_properties:
            profit_color = "green" if earnings.net_profit >= 0 else "red"
            prop_data.append([
                earnings.property_name[:25] + "..." if len(earnings.property_name) > 25 else earnings.property_name,
                f"${earnings.total_revenue:,.2f}",
                f"${earnings.total_expenses:,.2f}",
                f"${earnings.net_profit:,.2f}",
                str(earnings.guest_nights)
            ])

        prop_table = Table(prop_data, colWidths=[2.2*inch, 1.2*inch, 1.2*inch, 1.2*inch, 0.7*inch])

        # Build table style with conditional coloring for profit
        table_style = [
            ('BACKGROUND', (0, 0), (-1, 0), ECHO_COLORS["cobalt"]),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC'))
        ]

        # Add green/red coloring for profit column
        for i, earnings in enumerate(sorted_properties, start=1):
            if earnings.net_profit >= 0:
                table_style.append(('TEXTCOLOR', (3, i), (3, i), ECHO_COLORS["success_green"]))
            else:
                table_style.append(('TEXTCOLOR', (3, i), (3, i), ECHO_COLORS["danger_red"]))

        prop_table.setStyle(TableStyle(table_style))
        story.append(prop_table)

        # ==========================================================================
        # FOOTER
        # ==========================================================================
        story.append(Spacer(1, 40))

        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.gray,
            alignment=TA_CENTER
        )

        story.append(HRFlowable(
            width="100%",
            thickness=1,
            color=colors.gray,
            spaceBefore=10,
            spaceAfter=10
        ))

        story.append(Paragraph(
            f"Generated: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}",
            footer_style
        ))
        story.append(Paragraph(
            "Right At Home BnB | Steven Palma | Midland, TX",
            footer_style
        ))
        story.append(Paragraph(
            "Made by ECHO OMEGA PRIME",
            footer_style
        ))

        doc.build(story)
        pdf_bytes = buffer.getvalue()

        logger.info(f"Generated PDF report: {len(pdf_bytes)} bytes")
        return pdf_bytes

    # ==========================================================================
    # EMAIL DELIVERY
    # ==========================================================================

    async def send_report_email(
        self,
        report: WeeklyPayoutReport,
        pdf_bytes: bytes,
        recipients: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Send the payout report via email."""
        if not recipients:
            recipients = [e for e in self.owner_emails if e]

        if not recipients:
            return {"success": False, "error": "No recipients configured"}

        if not self.smtp_user or not self.smtp_password:
            logger.warning("SMTP credentials not configured - email delivery disabled")
            return {"success": False, "error": "SMTP not configured"}

        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = ", ".join(recipients)
            msg['Subject'] = f"Weekly Payout Report - {report.week_start.strftime('%b %d')} to {report.week_end.strftime('%b %d, %Y')}"

            # Email body
            body = f"""
Hello Steven,

Your weekly payout report is ready!

SUMMARY
-------
Week: {report.week_start.strftime('%B %d')} - {report.week_end.strftime('%B %d, %Y')}

Total Revenue: ${report.total_gross_revenue:,.2f}
Total Expenses: ${report.total_expenses:,.2f}
NET PROFIT: ${report.net_profit:,.2f}

BREAKDOWN
---------
VRBO Revenue: ${report.vrbo_revenue:,.2f}
Airbnb Revenue: ${report.airbnb_revenue:,.2f}
Direct Bookings: ${report.direct_revenue:,.2f}

Cleaner Costs: ${report.total_cleaner_costs:,.2f}
Pool/Lawn: ${report.total_pool_tech_costs + report.total_lawn_costs:,.2f}
Utilities: ${report.total_utility_estimates:,.2f}
Other: ${report.total_other_expenses:,.2f}

STATS
-----
Total Bookings: {report.total_bookings}
Guest Nights: {report.total_guest_nights}
Occupancy: {report.avg_occupancy:.1f}%
OTA Fees Saved: ${report.ota_fees_saved:,.2f}

TOP PERFORMER: {report.top_property_name}
  Revenue: ${report.top_property_revenue:,.2f}
  Profit: ${report.top_property_profit:,.2f}

Please see the attached PDF for the full detailed report.

---
Right At Home BnB
Made by ECHO OMEGA PRIME
"""

            msg.attach(MIMEText(body, 'plain'))

            # Attach PDF
            pdf_attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
            pdf_filename = f"RAH_Payout_{report.week_end.strftime('%Y%m%d')}.pdf"
            pdf_attachment.add_header('Content-Disposition', 'attachment', filename=pdf_filename)
            msg.attach(pdf_attachment)

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            # Update report delivery status
            report.is_sent = True
            report.sent_at = datetime.utcnow()
            report.sent_to = recipients

            # Update in Firebase
            if self.firebase_available and db and report.id:
                db.collection(self.collections["payout_reports"]).document(report.id).update({
                    "delivery.is_sent": True,
                    "delivery.sent_at": report.sent_at.isoformat(),
                    "delivery.sent_to": recipients
                })

            logger.info(f"Payout report emailed to: {recipients}")
            return {
                "success": True,
                "recipients": recipients,
                "sent_at": report.sent_at.isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return {"success": False, "error": str(e)}

    # ==========================================================================
    # CRON JOB HANDLER
    # ==========================================================================

    async def friday_payout_job(self) -> Dict[str, Any]:
        """
        Main job to run every Friday.
        Generates report, creates PDF, and emails to owners.
        """
        logger.info("Starting Friday payout job...")

        # Generate report for the week ending today (Friday)
        today = date.today()
        week_end = today
        week_start = today - timedelta(days=6)

        # Generate report
        report = await self.generate_weekly_report(week_start, week_end)

        # Generate PDF
        pdf_bytes = await self.generate_pdf_report(report)

        if not pdf_bytes:
            return {
                "success": False,
                "error": "PDF generation failed",
                "report_id": report.id
            }

        # Send email
        email_result = await self.send_report_email(report, pdf_bytes)

        return {
            "success": email_result.get("success", False),
            "report_id": report.id,
            "report_summary": {
                "gross_revenue": float(report.total_gross_revenue),
                "expenses": float(report.total_expenses),
                "net_profit": float(report.net_profit)
            },
            "email_result": email_result
        }


# ==============================================================================
# SINGLETON INSTANCE
# ==============================================================================

payout_service = PayoutService()
