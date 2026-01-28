"""
Right At Home BnB - Comprehensive Reporting Service
====================================================
Business intelligence and reporting service for Steven Palma's
22 Midland TX rental properties.

Features:
- Occupancy reports (daily, weekly, monthly, annual)
- Revenue reports with platform breakdown
- Expense reports with category analysis
- Maintenance reports with cost trends
- Cleaner performance reports with metrics
- CSV and PDF export support
- Scheduled report generation

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
from enum import Enum
from loguru import logger

# PDF Generation
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph,
        Spacer, Image, PageBreak
    )
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics.charts.piecharts import Pie
    from reportlab.graphics.shapes import Drawing
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("ReportLab not installed - PDF export disabled")

# Firebase for cloud data
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


class ReportType(str, Enum):
    """Report type enumeration."""
    OCCUPANCY = "occupancy"
    REVENUE = "revenue"
    EXPENSES = "expenses"
    MAINTENANCE = "maintenance"
    CLEANERS = "cleaners"
    EXECUTIVE_SUMMARY = "executive_summary"
    OWNER_STATEMENT = "owner_statement"
    TAX_PREP = "tax_prep"


class ReportPeriod(str, Enum):
    """Report period enumeration."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class ReportFormat(str, Enum):
    """Export format enumeration."""
    JSON = "json"
    CSV = "csv"
    PDF = "pdf"


class ReportsService:
    """
    Comprehensive reporting service for RightAtHomeBnB.
    Provides occupancy, revenue, expense, maintenance, and cleaner reports.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.reportlab_available = REPORTLAB_AVAILABLE

        # ECHO OMEGA PRIME branding
        self.branding = {
            "company": "Right At Home BnB",
            "owner": "Steven Palma",
            "location": "Midland, TX",
            "total_properties": 22,
            "made_by": "ECHO OMEGA PRIME",
            "colors": {
                "primary": "#0047AB",  # Cobalt Blue
                "secondary": "#FF6B35",  # Orange
                "accent": "#8B008B",  # Dark Magenta
            }
        }

        logger.info("ReportsService initialized | ECHO OMEGA PRIME")

    # ==========================================================================
    # OCCUPANCY REPORTS
    # ==========================================================================

    async def get_occupancy_report(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        property_id: Optional[str] = None,
        period: str = "monthly"
    ) -> Dict[str, Any]:
        """
        Generate comprehensive occupancy report.

        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            property_id: Filter by property
            period: Grouping period (daily, weekly, monthly)

        Returns:
            Occupancy report with metrics and trends
        """
        now = datetime.now()

        if not start_date:
            start_date = f"{now.year}-01-01"
        if not end_date:
            end_date = now.strftime("%Y-%m-%d")

        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        total_days = (end_dt - start_dt).days + 1

        # Calculate occupancy metrics
        bookings = await self._get_bookings(start_date, end_date, property_id)
        properties = await self._get_properties(property_id)

        total_property_nights = total_days * len(properties)
        booked_nights = sum(b.get("nights", 0) for b in bookings)

        overall_occupancy = (booked_nights / total_property_nights * 100) if total_property_nights > 0 else 0

        # Per-property breakdown
        property_occupancy = []
        for prop in properties:
            prop_id = prop.get("id")
            prop_bookings = [b for b in bookings if b.get("property_id") == prop_id]
            prop_nights = sum(b.get("nights", 0) for b in prop_bookings)
            prop_occupancy = (prop_nights / total_days * 100) if total_days > 0 else 0

            property_occupancy.append({
                "property_id": prop_id,
                "property_name": prop.get("name", f"Property {prop_id}"),
                "address": prop.get("address", ""),
                "booked_nights": prop_nights,
                "available_nights": total_days,
                "occupancy_rate": round(prop_occupancy, 2),
                "total_bookings": len(prop_bookings),
                "avg_stay_length": round(prop_nights / len(prop_bookings), 1) if prop_bookings else 0
            })

        # Sort by occupancy rate
        property_occupancy.sort(key=lambda x: x["occupancy_rate"], reverse=True)

        # Time-series data for charts
        time_series = await self._generate_occupancy_time_series(
            bookings, properties, start_dt, end_dt, period
        )

        # Weekday vs Weekend analysis
        weekday_weekend = await self._analyze_weekday_weekend_occupancy(bookings, start_dt, end_dt)

        # Platform breakdown
        platform_breakdown = self._calculate_platform_breakdown(bookings)

        return {
            "report_type": "occupancy",
            "period": {
                "start": start_date,
                "end": end_date,
                "total_days": total_days,
                "grouping": period
            },
            "summary": {
                "total_properties": len(properties),
                "total_property_nights": total_property_nights,
                "booked_nights": booked_nights,
                "available_nights": total_property_nights - booked_nights,
                "overall_occupancy_rate": round(overall_occupancy, 2),
                "total_bookings": len(bookings),
                "avg_stay_length": round(booked_nights / len(bookings), 1) if bookings else 0
            },
            "by_property": property_occupancy,
            "time_series": time_series,
            "weekday_weekend": weekday_weekend,
            "by_platform": platform_breakdown,
            "top_performers": property_occupancy[:5],
            "needs_attention": [p for p in property_occupancy if p["occupancy_rate"] < 50],
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": self.branding["made_by"]
        }

    # ==========================================================================
    # REVENUE REPORTS
    # ==========================================================================

    async def get_revenue_report(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        property_id: Optional[str] = None,
        period: str = "monthly"
    ) -> Dict[str, Any]:
        """
        Generate comprehensive revenue report.

        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            property_id: Filter by property
            period: Grouping period

        Returns:
            Revenue report with breakdown and trends
        """
        now = datetime.now()

        if not start_date:
            start_date = f"{now.year}-01-01"
        if not end_date:
            end_date = now.strftime("%Y-%m-%d")

        # Get revenue data
        revenues = await self._get_revenue_entries(start_date, end_date, property_id)
        properties = await self._get_properties(property_id)

        # Calculate totals
        total_revenue = sum(r.get("amount", 0) for r in revenues)

        # Revenue by category
        by_category = defaultdict(float)
        for r in revenues:
            category = r.get("category", "other")
            by_category[category] += r.get("amount", 0)

        # Revenue by property
        by_property = []
        for prop in properties:
            prop_id = prop.get("id")
            prop_revenues = [r for r in revenues if r.get("property_id") == prop_id]
            prop_total = sum(r.get("amount", 0) for r in prop_revenues)

            by_property.append({
                "property_id": prop_id,
                "property_name": prop.get("name", f"Property {prop_id}"),
                "total_revenue": round(prop_total, 2),
                "booking_count": len(set(r.get("booking_id") for r in prop_revenues if r.get("booking_id"))),
                "avg_per_booking": round(prop_total / len(prop_revenues), 2) if prop_revenues else 0,
                "percentage_of_total": round(prop_total / total_revenue * 100, 1) if total_revenue > 0 else 0
            })

        by_property.sort(key=lambda x: x["total_revenue"], reverse=True)

        # Revenue by platform
        by_platform = defaultdict(float)
        for r in revenues:
            platform = r.get("platform", "direct")
            by_platform[platform] += r.get("amount", 0)

        # Time series
        time_series = await self._generate_revenue_time_series(revenues, start_date, end_date, period)

        # Year-over-year comparison
        yoy_comparison = await self._calculate_yoy_revenue(start_date, end_date, property_id)

        # ADR and RevPAR calculations
        bookings = await self._get_bookings(start_date, end_date, property_id)
        total_nights = sum(b.get("nights", 0) for b in bookings)
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        total_days = (end_dt - start_dt).days + 1
        available_nights = total_days * len(properties)

        adr = total_revenue / total_nights if total_nights > 0 else 0
        revpar = total_revenue / available_nights if available_nights > 0 else 0

        return {
            "report_type": "revenue",
            "period": {
                "start": start_date,
                "end": end_date,
                "grouping": period
            },
            "summary": {
                "total_revenue": round(total_revenue, 2),
                "total_properties": len(properties),
                "total_bookings": len(bookings),
                "total_booked_nights": total_nights,
                "adr": round(adr, 2),  # Average Daily Rate
                "revpar": round(revpar, 2),  # Revenue Per Available Room
                "avg_revenue_per_property": round(total_revenue / len(properties), 2) if properties else 0
            },
            "by_category": dict(by_category),
            "by_property": by_property,
            "by_platform": dict(by_platform),
            "time_series": time_series,
            "yoy_comparison": yoy_comparison,
            "top_performers": by_property[:5],
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": self.branding["made_by"]
        }

    # ==========================================================================
    # EXPENSE REPORTS
    # ==========================================================================

    async def get_expense_report(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        property_id: Optional[str] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive expense report.

        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            property_id: Filter by property
            category: Filter by expense category

        Returns:
            Expense report with breakdown and analysis
        """
        now = datetime.now()

        if not start_date:
            start_date = f"{now.year}-01-01"
        if not end_date:
            end_date = now.strftime("%Y-%m-%d")

        # Get expense data
        expenses = await self._get_expenses(start_date, end_date, property_id, category)
        properties = await self._get_properties(property_id)

        # Calculate totals
        total_expenses = sum(e.get("amount", 0) for e in expenses)
        tax_deductible = sum(e.get("amount", 0) for e in expenses if e.get("is_tax_deductible", True))

        # By category
        by_category = defaultdict(lambda: {"total": 0, "count": 0, "items": []})
        for e in expenses:
            cat = e.get("category", "other")
            by_category[cat]["total"] += e.get("amount", 0)
            by_category[cat]["count"] += 1
            by_category[cat]["items"].append({
                "date": e.get("date"),
                "amount": e.get("amount"),
                "description": e.get("description"),
                "vendor": e.get("vendor")
            })

        # Summarize categories
        category_summary = []
        for cat, data in by_category.items():
            category_summary.append({
                "category": cat,
                "total": round(data["total"], 2),
                "count": data["count"],
                "percentage": round(data["total"] / total_expenses * 100, 1) if total_expenses > 0 else 0,
                "avg_per_expense": round(data["total"] / data["count"], 2) if data["count"] > 0 else 0
            })
        category_summary.sort(key=lambda x: x["total"], reverse=True)

        # By property
        by_property = []
        for prop in properties:
            prop_id = prop.get("id")
            prop_expenses = [e for e in expenses if e.get("property_id") == prop_id]
            prop_total = sum(e.get("amount", 0) for e in prop_expenses)

            by_property.append({
                "property_id": prop_id,
                "property_name": prop.get("name", f"Property {prop_id}"),
                "total_expenses": round(prop_total, 2),
                "expense_count": len(prop_expenses),
                "percentage_of_total": round(prop_total / total_expenses * 100, 1) if total_expenses > 0 else 0
            })

        by_property.sort(key=lambda x: x["total_expenses"], reverse=True)

        # Time series
        time_series = await self._generate_expense_time_series(expenses, start_date, end_date)

        # Top vendors
        by_vendor = defaultdict(float)
        for e in expenses:
            vendor = e.get("vendor", "Unknown")
            if vendor:
                by_vendor[vendor] += e.get("amount", 0)
        top_vendors = sorted(
            [{"vendor": k, "total": round(v, 2)} for k, v in by_vendor.items()],
            key=lambda x: x["total"],
            reverse=True
        )[:10]

        return {
            "report_type": "expenses",
            "period": {
                "start": start_date,
                "end": end_date
            },
            "summary": {
                "total_expenses": round(total_expenses, 2),
                "tax_deductible": round(tax_deductible, 2),
                "non_deductible": round(total_expenses - tax_deductible, 2),
                "expense_count": len(expenses),
                "avg_expense": round(total_expenses / len(expenses), 2) if expenses else 0,
                "properties_count": len(properties),
                "avg_per_property": round(total_expenses / len(properties), 2) if properties else 0
            },
            "by_category": category_summary,
            "by_property": by_property,
            "by_vendor": top_vendors,
            "time_series": time_series,
            "largest_expenses": sorted(expenses, key=lambda x: x.get("amount", 0), reverse=True)[:10],
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": self.branding["made_by"]
        }

    # ==========================================================================
    # MAINTENANCE REPORTS
    # ==========================================================================

    async def get_maintenance_report(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        property_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate maintenance report with issue tracking.

        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            property_id: Filter by property

        Returns:
            Maintenance report with issues, costs, and trends
        """
        now = datetime.now()

        if not start_date:
            start_date = f"{now.year}-01-01"
        if not end_date:
            end_date = now.strftime("%Y-%m-%d")

        # Get maintenance data
        maintenance_items = await self._get_maintenance_items(start_date, end_date, property_id)
        properties = await self._get_properties(property_id)

        # Calculate totals
        total_cost = sum(m.get("cost", 0) for m in maintenance_items)
        resolved_items = [m for m in maintenance_items if m.get("status") == "completed"]
        open_items = [m for m in maintenance_items if m.get("status") in ["pending", "in_progress"]]

        # By priority
        by_priority = defaultdict(list)
        for m in maintenance_items:
            priority = m.get("priority", "medium")
            by_priority[priority].append(m)

        priority_summary = {
            priority: {
                "count": len(items),
                "total_cost": sum(i.get("cost", 0) for i in items),
                "avg_resolution_days": self._calculate_avg_resolution_days(items)
            }
            for priority, items in by_priority.items()
        }

        # By category
        by_category = defaultdict(lambda: {"count": 0, "cost": 0})
        for m in maintenance_items:
            cat = m.get("category", "general")
            by_category[cat]["count"] += 1
            by_category[cat]["cost"] += m.get("cost", 0)

        # By property
        by_property = []
        for prop in properties:
            prop_id = prop.get("id")
            prop_items = [m for m in maintenance_items if m.get("property_id") == prop_id]
            prop_cost = sum(m.get("cost", 0) for m in prop_items)

            by_property.append({
                "property_id": prop_id,
                "property_name": prop.get("name", f"Property {prop_id}"),
                "total_issues": len(prop_items),
                "resolved": len([m for m in prop_items if m.get("status") == "completed"]),
                "open": len([m for m in prop_items if m.get("status") != "completed"]),
                "total_cost": round(prop_cost, 2),
                "maintenance_score": self._calculate_maintenance_score(prop_items)
            })

        by_property.sort(key=lambda x: x["total_issues"], reverse=True)

        # Time series
        time_series = await self._generate_maintenance_time_series(maintenance_items, start_date, end_date)

        # Common issues
        issue_types = defaultdict(int)
        for m in maintenance_items:
            issue_type = m.get("type", "general")
            issue_types[issue_type] += 1

        common_issues = sorted(
            [{"type": k, "count": v} for k, v in issue_types.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:10]

        return {
            "report_type": "maintenance",
            "period": {
                "start": start_date,
                "end": end_date
            },
            "summary": {
                "total_issues": len(maintenance_items),
                "resolved": len(resolved_items),
                "open": len(open_items),
                "resolution_rate": round(len(resolved_items) / len(maintenance_items) * 100, 1) if maintenance_items else 0,
                "total_cost": round(total_cost, 2),
                "avg_cost_per_issue": round(total_cost / len(maintenance_items), 2) if maintenance_items else 0,
                "avg_resolution_days": self._calculate_avg_resolution_days(resolved_items)
            },
            "by_priority": priority_summary,
            "by_category": dict(by_category),
            "by_property": by_property,
            "common_issues": common_issues,
            "time_series": time_series,
            "urgent_items": [m for m in open_items if m.get("priority") == "high"],
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": self.branding["made_by"]
        }

    # ==========================================================================
    # CLEANER PERFORMANCE REPORTS
    # ==========================================================================

    async def get_cleaner_report(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        cleaner_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate cleaner performance report.

        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            cleaner_id: Filter by cleaner

        Returns:
            Cleaner performance report with metrics and rankings
        """
        now = datetime.now()

        if not start_date:
            start_date = f"{now.year}-01-01"
        if not end_date:
            end_date = now.strftime("%Y-%m-%d")

        # Get cleaning data
        cleanings = await self._get_cleanings(start_date, end_date, cleaner_id)
        cleaners = await self._get_cleaners(cleaner_id)

        # Calculate totals
        total_cleanings = len(cleanings)
        completed_cleanings = [c for c in cleanings if c.get("status") == "completed"]
        total_payout = sum(c.get("payout", 0) for c in completed_cleanings)

        # Per-cleaner breakdown
        cleaner_metrics = []
        for cleaner in cleaners:
            c_id = cleaner.get("id")
            c_cleanings = [c for c in cleanings if c.get("cleaner_id") == c_id]
            c_completed = [c for c in c_cleanings if c.get("status") == "completed"]
            c_payout = sum(c.get("payout", 0) for c in c_completed)

            # Calculate metrics
            avg_time = self._calculate_avg_cleaning_time(c_completed)
            avg_rating = self._calculate_avg_rating(c_completed)
            on_time_rate = self._calculate_on_time_rate(c_completed)
            quality_score = cleaner.get("quality_score", 0)

            cleaner_metrics.append({
                "cleaner_id": c_id,
                "cleaner_name": cleaner.get("name", f"Cleaner {c_id}"),
                "phone": cleaner.get("phone", ""),
                "total_cleanings": len(c_cleanings),
                "completed": len(c_completed),
                "cancelled": len([c for c in c_cleanings if c.get("status") == "cancelled"]),
                "issues_reported": len([c for c in c_cleanings if c.get("status") == "issue_reported"]),
                "total_payout": round(c_payout, 2),
                "avg_payout": round(c_payout / len(c_completed), 2) if c_completed else 0,
                "avg_cleaning_time_minutes": avg_time,
                "avg_rating": avg_rating,
                "on_time_rate": on_time_rate,
                "quality_score": quality_score,
                "overall_score": self._calculate_cleaner_overall_score(
                    avg_rating, on_time_rate, quality_score, len(c_completed)
                )
            })

        # Rank cleaners by overall score
        cleaner_metrics.sort(key=lambda x: x["overall_score"], reverse=True)
        for i, c in enumerate(cleaner_metrics):
            c["rank"] = i + 1

        # Time series
        time_series = await self._generate_cleaning_time_series(cleanings, start_date, end_date)

        # Cleaning type breakdown
        by_type = defaultdict(lambda: {"count": 0, "total_payout": 0})
        for c in cleanings:
            c_type = c.get("type", "turnover")
            by_type[c_type]["count"] += 1
            by_type[c_type]["total_payout"] += c.get("payout", 0)

        return {
            "report_type": "cleaners",
            "period": {
                "start": start_date,
                "end": end_date
            },
            "summary": {
                "total_cleaners": len(cleaners),
                "total_cleanings": total_cleanings,
                "completed_cleanings": len(completed_cleanings),
                "completion_rate": round(len(completed_cleanings) / total_cleanings * 100, 1) if total_cleanings > 0 else 0,
                "total_payout": round(total_payout, 2),
                "avg_payout_per_cleaning": round(total_payout / len(completed_cleanings), 2) if completed_cleanings else 0,
                "avg_rating": self._calculate_avg_rating(completed_cleanings),
                "avg_cleaning_time": self._calculate_avg_cleaning_time(completed_cleanings)
            },
            "by_cleaner": cleaner_metrics,
            "by_type": dict(by_type),
            "time_series": time_series,
            "top_performers": cleaner_metrics[:3],
            "needs_improvement": [c for c in cleaner_metrics if c["overall_score"] < 70],
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": self.branding["made_by"]
        }

    # ==========================================================================
    # EXPORT FUNCTIONS
    # ==========================================================================

    async def export_to_csv(
        self,
        report_type: str,
        report_data: Dict[str, Any]
    ) -> str:
        """
        Export report to CSV format.

        Args:
            report_type: Type of report
            report_data: Report data dictionary

        Returns:
            CSV string content
        """
        output = io.StringIO()

        if report_type == "occupancy":
            writer = csv.writer(output)
            writer.writerow(["Property ID", "Property Name", "Address", "Booked Nights",
                           "Available Nights", "Occupancy Rate", "Total Bookings", "Avg Stay Length"])
            for prop in report_data.get("by_property", []):
                writer.writerow([
                    prop["property_id"],
                    prop["property_name"],
                    prop.get("address", ""),
                    prop["booked_nights"],
                    prop["available_nights"],
                    f"{prop['occupancy_rate']}%",
                    prop["total_bookings"],
                    prop["avg_stay_length"]
                ])

        elif report_type == "revenue":
            writer = csv.writer(output)
            writer.writerow(["Property ID", "Property Name", "Total Revenue",
                           "Booking Count", "Avg Per Booking", "% of Total"])
            for prop in report_data.get("by_property", []):
                writer.writerow([
                    prop["property_id"],
                    prop["property_name"],
                    f"${prop['total_revenue']:.2f}",
                    prop["booking_count"],
                    f"${prop['avg_per_booking']:.2f}",
                    f"{prop['percentage_of_total']}%"
                ])

        elif report_type == "expenses":
            writer = csv.writer(output)
            writer.writerow(["Category", "Total", "Count", "% of Total", "Avg Per Expense"])
            for cat in report_data.get("by_category", []):
                writer.writerow([
                    cat["category"],
                    f"${cat['total']:.2f}",
                    cat["count"],
                    f"{cat['percentage']}%",
                    f"${cat['avg_per_expense']:.2f}"
                ])

        elif report_type == "maintenance":
            writer = csv.writer(output)
            writer.writerow(["Property ID", "Property Name", "Total Issues",
                           "Resolved", "Open", "Total Cost", "Maintenance Score"])
            for prop in report_data.get("by_property", []):
                writer.writerow([
                    prop["property_id"],
                    prop["property_name"],
                    prop["total_issues"],
                    prop["resolved"],
                    prop["open"],
                    f"${prop['total_cost']:.2f}",
                    prop["maintenance_score"]
                ])

        elif report_type == "cleaners":
            writer = csv.writer(output)
            writer.writerow(["Rank", "Cleaner ID", "Name", "Total Cleanings",
                           "Completed", "Total Payout", "Avg Rating", "On-Time Rate", "Overall Score"])
            for cleaner in report_data.get("by_cleaner", []):
                writer.writerow([
                    cleaner["rank"],
                    cleaner["cleaner_id"],
                    cleaner["cleaner_name"],
                    cleaner["total_cleanings"],
                    cleaner["completed"],
                    f"${cleaner['total_payout']:.2f}",
                    cleaner["avg_rating"],
                    f"{cleaner['on_time_rate']}%",
                    cleaner["overall_score"]
                ])

        return output.getvalue()

    async def export_to_pdf(
        self,
        report_type: str,
        report_data: Dict[str, Any]
    ) -> Optional[bytes]:
        """
        Export report to PDF format.

        Args:
            report_type: Type of report
            report_data: Report data dictionary

        Returns:
            PDF bytes or None if ReportLab not available
        """
        if not REPORTLAB_AVAILABLE:
            logger.error("ReportLab not installed - cannot generate PDF")
            return None

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor(self.branding["colors"]["primary"]),
            spaceAfter=20
        )

        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor(self.branding["colors"]["secondary"]),
            spaceAfter=12
        )

        elements = []

        # Title
        title_map = {
            "occupancy": "Occupancy Report",
            "revenue": "Revenue Report",
            "expenses": "Expense Report",
            "maintenance": "Maintenance Report",
            "cleaners": "Cleaner Performance Report"
        }

        elements.append(Paragraph(f"Right At Home BnB - {title_map.get(report_type, 'Report')}", title_style))
        elements.append(Paragraph(f"Generated: {report_data.get('generated_at', 'N/A')}", styles['Normal']))
        elements.append(Spacer(1, 20))

        # Summary section
        elements.append(Paragraph("Summary", subtitle_style))
        summary = report_data.get("summary", {})
        summary_data = [[k.replace("_", " ").title(), str(v)] for k, v in summary.items()]

        if summary_data:
            summary_table = Table(summary_data, colWidths=[3*inch, 3*inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#f0f0f0")),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(summary_table)

        elements.append(Spacer(1, 20))

        # Data table based on report type
        if report_type == "occupancy":
            elements.append(Paragraph("Property Occupancy Breakdown", subtitle_style))
            table_data = [["Property", "Occupancy", "Booked Nights", "Bookings"]]
            for prop in report_data.get("by_property", [])[:15]:
                table_data.append([
                    prop["property_name"][:25],
                    f"{prop['occupancy_rate']}%",
                    str(prop["booked_nights"]),
                    str(prop["total_bookings"])
                ])

        elif report_type == "revenue":
            elements.append(Paragraph("Revenue by Property", subtitle_style))
            table_data = [["Property", "Revenue", "Bookings", "% of Total"]]
            for prop in report_data.get("by_property", [])[:15]:
                table_data.append([
                    prop["property_name"][:25],
                    f"${prop['total_revenue']:,.2f}",
                    str(prop["booking_count"]),
                    f"{prop['percentage_of_total']}%"
                ])

        elif report_type == "expenses":
            elements.append(Paragraph("Expenses by Category", subtitle_style))
            table_data = [["Category", "Total", "Count", "% of Total"]]
            for cat in report_data.get("by_category", [])[:15]:
                table_data.append([
                    cat["category"].replace("_", " ").title(),
                    f"${cat['total']:,.2f}",
                    str(cat["count"]),
                    f"{cat['percentage']}%"
                ])

        elif report_type == "maintenance":
            elements.append(Paragraph("Maintenance by Property", subtitle_style))
            table_data = [["Property", "Issues", "Resolved", "Cost"]]
            for prop in report_data.get("by_property", [])[:15]:
                table_data.append([
                    prop["property_name"][:25],
                    str(prop["total_issues"]),
                    str(prop["resolved"]),
                    f"${prop['total_cost']:,.2f}"
                ])

        elif report_type == "cleaners":
            elements.append(Paragraph("Cleaner Performance Rankings", subtitle_style))
            table_data = [["Rank", "Cleaner", "Cleanings", "Rating", "Score"]]
            for cleaner in report_data.get("by_cleaner", [])[:15]:
                table_data.append([
                    str(cleaner["rank"]),
                    cleaner["cleaner_name"][:20],
                    str(cleaner["completed"]),
                    str(cleaner["avg_rating"]),
                    str(cleaner["overall_score"])
                ])

        if len(table_data) > 1:
            data_table = Table(table_data)
            data_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(self.branding["colors"]["primary"])),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f8f8")])
            ]))
            elements.append(data_table)

        # Footer
        elements.append(Spacer(1, 40))
        elements.append(Paragraph(
            f"Generated by {self.branding['made_by']} | {self.branding['company']}",
            styles['Normal']
        ))

        doc.build(elements)
        return buffer.getvalue()

    # ==========================================================================
    # SCHEDULED REPORTS
    # ==========================================================================

    async def generate_weekly_summary(self) -> Dict[str, Any]:
        """Generate weekly summary report for email."""
        now = datetime.now()
        start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        end_date = now.strftime("%Y-%m-%d")

        occupancy = await self.get_occupancy_report(start_date, end_date)
        revenue = await self.get_revenue_report(start_date, end_date)
        cleanings = await self.get_cleaner_report(start_date, end_date)

        return {
            "report_type": "weekly_summary",
            "period": {"start": start_date, "end": end_date},
            "highlights": {
                "occupancy_rate": occupancy["summary"]["overall_occupancy_rate"],
                "total_revenue": revenue["summary"]["total_revenue"],
                "total_bookings": revenue["summary"]["total_bookings"],
                "cleanings_completed": cleanings["summary"]["completed_cleanings"],
                "avg_cleaner_rating": cleanings["summary"]["avg_rating"]
            },
            "top_properties": occupancy["top_performers"][:3],
            "alerts": {
                "low_occupancy_properties": occupancy["needs_attention"],
                "cleaners_needing_improvement": cleanings["needs_improvement"]
            },
            "generated_at": datetime.utcnow().isoformat()
        }

    async def generate_monthly_owner_statement(
        self,
        year: int,
        month: int,
        property_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate monthly owner statement."""
        start_date = f"{year}-{month:02d}-01"

        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"

        end_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=1)
        end_date = end_dt.strftime("%Y-%m-%d")

        revenue = await self.get_revenue_report(start_date, end_date, property_id)
        expenses = await self.get_expense_report(start_date, end_date, property_id)
        occupancy = await self.get_occupancy_report(start_date, end_date, property_id)

        gross_revenue = revenue["summary"]["total_revenue"]
        total_expenses = expenses["summary"]["total_expenses"]
        net_income = gross_revenue - total_expenses

        return {
            "report_type": "owner_statement",
            "period": {"year": year, "month": month},
            "property_id": property_id or "all",
            "income_statement": {
                "gross_revenue": gross_revenue,
                "revenue_breakdown": revenue["by_category"],
                "total_expenses": total_expenses,
                "expense_breakdown": {cat["category"]: cat["total"] for cat in expenses["by_category"]},
                "net_income": net_income,
                "profit_margin": round(net_income / gross_revenue * 100, 1) if gross_revenue > 0 else 0
            },
            "performance_metrics": {
                "occupancy_rate": occupancy["summary"]["overall_occupancy_rate"],
                "adr": revenue["summary"]["adr"],
                "revpar": revenue["summary"]["revpar"],
                "total_bookings": revenue["summary"]["total_bookings"]
            },
            "generated_at": datetime.utcnow().isoformat()
        }

    async def generate_quarterly_tax_prep(
        self,
        year: int,
        quarter: int
    ) -> Dict[str, Any]:
        """Generate quarterly tax preparation report."""
        quarter_months = {
            1: ("01", "03"),
            2: ("04", "06"),
            3: ("07", "09"),
            4: ("10", "12")
        }

        start_month, end_month = quarter_months[quarter]
        start_date = f"{year}-{start_month}-01"

        if quarter == 4:
            end_date = f"{year}-12-31"
        else:
            end_dt = datetime.strptime(f"{year}-{end_month}-01", "%Y-%m-%d")
            import calendar
            last_day = calendar.monthrange(year, int(end_month))[1]
            end_date = f"{year}-{end_month}-{last_day:02d}"

        revenue = await self.get_revenue_report(start_date, end_date)
        expenses = await self.get_expense_report(start_date, end_date)

        # Map expenses to Schedule E categories
        schedule_e_categories = {}
        for cat_data in expenses["by_category"]:
            cat = cat_data["category"]
            amount = cat_data["total"]
            # Simplified mapping
            if cat in ["cleaning", "repairs", "maintenance"]:
                schedule_e_categories.setdefault("line_7_cleaning_maintenance", 0)
                schedule_e_categories["line_7_cleaning_maintenance"] += amount
            elif cat in ["utilities_electric", "utilities_water", "utilities_gas", "utilities_internet"]:
                schedule_e_categories.setdefault("line_17_utilities", 0)
                schedule_e_categories["line_17_utilities"] += amount
            elif cat == "insurance":
                schedule_e_categories["line_9_insurance"] = amount
            elif cat == "property_tax":
                schedule_e_categories["line_16_taxes"] = amount
            elif cat == "marketing":
                schedule_e_categories["line_5_advertising"] = amount
            elif cat == "mortgage_interest":
                schedule_e_categories["line_12_mortgage_interest"] = amount
            else:
                schedule_e_categories.setdefault("line_19_other", 0)
                schedule_e_categories["line_19_other"] += amount

        return {
            "report_type": "tax_prep",
            "period": {"year": year, "quarter": quarter},
            "schedule_e_data": {
                "line_3_gross_rents": revenue["summary"]["total_revenue"],
                **schedule_e_categories,
                "total_expenses": expenses["summary"]["total_expenses"],
                "net_rental_income": revenue["summary"]["total_revenue"] - expenses["summary"]["total_expenses"]
            },
            "estimated_quarterly_tax": self._estimate_quarterly_tax(
                revenue["summary"]["total_revenue"],
                expenses["summary"]["total_expenses"]
            ),
            "deductible_expenses": expenses["summary"]["tax_deductible"],
            "by_property": revenue["by_property"],
            "generated_at": datetime.utcnow().isoformat()
        }

    # ==========================================================================
    # HELPER METHODS
    # ==========================================================================

    async def _get_bookings(
        self,
        start_date: str,
        end_date: str,
        property_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get bookings from database or Firebase."""
        # Sample data for demonstration
        sample_bookings = []
        properties = await self._get_properties(property_id)

        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")

        import random
        random.seed(42)  # For consistent demo data

        for prop in properties:
            num_bookings = random.randint(8, 25)
            for i in range(num_bookings):
                check_in = start_dt + timedelta(days=random.randint(0, (end_dt - start_dt).days - 7))
                nights = random.randint(2, 7)

                sample_bookings.append({
                    "id": f"booking_{prop['id']}_{i}",
                    "property_id": prop["id"],
                    "check_in": check_in.strftime("%Y-%m-%d"),
                    "check_out": (check_in + timedelta(days=nights)).strftime("%Y-%m-%d"),
                    "nights": nights,
                    "platform": random.choice(["airbnb", "vrbo", "direct"]),
                    "status": "completed",
                    "total_amount": nights * random.randint(120, 250)
                })

        return sample_bookings

    async def _get_properties(self, property_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get properties list."""
        # Sample 22 Midland TX properties
        properties = [
            {"id": f"prop_{i}", "name": f"Midland Property {i}", "address": f"{100 + i} Main St, Midland, TX"}
            for i in range(1, 23)
        ]

        if property_id:
            return [p for p in properties if p["id"] == property_id]
        return properties

    async def _get_revenue_entries(
        self,
        start_date: str,
        end_date: str,
        property_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get revenue entries."""
        bookings = await self._get_bookings(start_date, end_date, property_id)
        revenues = []

        for b in bookings:
            base_rate = b["total_amount"]
            revenues.append({
                "id": f"rev_{b['id']}",
                "booking_id": b["id"],
                "property_id": b["property_id"],
                "category": "nightly_rate",
                "amount": base_rate * 0.85,
                "date": b["check_in"],
                "platform": b["platform"]
            })
            revenues.append({
                "id": f"rev_{b['id']}_clean",
                "booking_id": b["id"],
                "property_id": b["property_id"],
                "category": "cleaning_fee",
                "amount": base_rate * 0.15,
                "date": b["check_in"],
                "platform": b["platform"]
            })

        return revenues

    async def _get_expenses(
        self,
        start_date: str,
        end_date: str,
        property_id: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get expense entries."""
        import random
        random.seed(43)

        properties = await self._get_properties(property_id)
        categories = ["cleaning", "supplies", "repairs", "utilities_electric",
                     "utilities_water", "insurance", "maintenance"]

        expenses = []
        for prop in properties:
            num_expenses = random.randint(10, 30)
            for i in range(num_expenses):
                exp_cat = random.choice(categories)
                if category and exp_cat != category:
                    continue

                expenses.append({
                    "id": f"exp_{prop['id']}_{i}",
                    "property_id": prop["id"],
                    "category": exp_cat,
                    "amount": random.uniform(25, 500),
                    "date": start_date,
                    "vendor": random.choice(["Home Depot", "Lowes", "Local Contractor", "Amazon"]),
                    "description": f"{exp_cat.title()} expense",
                    "is_tax_deductible": True
                })

        return expenses

    async def _get_maintenance_items(
        self,
        start_date: str,
        end_date: str,
        property_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get maintenance items."""
        import random
        random.seed(44)

        properties = await self._get_properties(property_id)
        items = []

        for prop in properties:
            num_items = random.randint(2, 8)
            for i in range(num_items):
                items.append({
                    "id": f"maint_{prop['id']}_{i}",
                    "property_id": prop["id"],
                    "type": random.choice(["plumbing", "electrical", "hvac", "appliance", "general"]),
                    "category": random.choice(["repair", "replacement", "inspection"]),
                    "priority": random.choice(["low", "medium", "high"]),
                    "status": random.choice(["completed", "pending", "in_progress"]),
                    "cost": random.uniform(50, 1000),
                    "created_at": start_date,
                    "resolved_at": end_date if random.random() > 0.3 else None
                })

        return items

    async def _get_cleanings(
        self,
        start_date: str,
        end_date: str,
        cleaner_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get cleaning records."""
        import random
        random.seed(45)

        cleaners = await self._get_cleaners(cleaner_id)
        bookings = await self._get_bookings(start_date, end_date)

        cleanings = []
        for b in bookings:
            cleaner = random.choice(cleaners)
            cleanings.append({
                "id": f"clean_{b['id']}",
                "booking_id": b["id"],
                "property_id": b["property_id"],
                "cleaner_id": cleaner["id"],
                "type": "turnover",
                "status": "completed",
                "scheduled_at": b["check_out"],
                "completed_at": b["check_out"],
                "duration_minutes": random.randint(60, 180),
                "payout": random.uniform(50, 150),
                "rating": random.randint(3, 5),
                "on_time": random.random() > 0.1
            })

        return cleanings

    async def _get_cleaners(self, cleaner_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get cleaners list."""
        cleaners = [
            {"id": "cleaner_1", "name": "Maria Garcia", "phone": "+1432555001", "quality_score": 95},
            {"id": "cleaner_2", "name": "John Smith", "phone": "+1432555002", "quality_score": 88},
            {"id": "cleaner_3", "name": "Rosa Martinez", "phone": "+1432555003", "quality_score": 92},
            {"id": "cleaner_4", "name": "David Johnson", "phone": "+1432555004", "quality_score": 85},
            {"id": "cleaner_5", "name": "Lisa Williams", "phone": "+1432555005", "quality_score": 90},
        ]

        if cleaner_id:
            return [c for c in cleaners if c["id"] == cleaner_id]
        return cleaners

    async def _generate_occupancy_time_series(
        self,
        bookings: List[Dict],
        properties: List[Dict],
        start_dt: datetime,
        end_dt: datetime,
        period: str
    ) -> List[Dict[str, Any]]:
        """Generate time series data for occupancy charts."""
        series = []
        current = start_dt

        while current <= end_dt:
            if period == "daily":
                period_end = current
                label = current.strftime("%Y-%m-%d")
            elif period == "weekly":
                period_end = current + timedelta(days=6)
                label = f"Week of {current.strftime('%m/%d')}"
            else:  # monthly
                import calendar
                _, last_day = calendar.monthrange(current.year, current.month)
                period_end = current.replace(day=last_day)
                label = current.strftime("%Y-%m")

            # Count occupied nights in period
            occupied = 0
            for b in bookings:
                b_start = datetime.strptime(b["check_in"], "%Y-%m-%d")
                b_end = datetime.strptime(b["check_out"], "%Y-%m-%d")
                overlap_start = max(current, b_start)
                overlap_end = min(period_end, b_end)
                if overlap_start < overlap_end:
                    occupied += (overlap_end - overlap_start).days

            total_nights = (min(period_end, end_dt) - current).days + 1
            total_nights *= len(properties)

            series.append({
                "period": label,
                "occupied": occupied,
                "available": total_nights - occupied,
                "occupancy_rate": round(occupied / total_nights * 100, 1) if total_nights > 0 else 0
            })

            if period == "daily":
                current += timedelta(days=1)
            elif period == "weekly":
                current += timedelta(days=7)
            else:
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1, day=1)
                else:
                    current = current.replace(month=current.month + 1, day=1)

        return series

    async def _generate_revenue_time_series(
        self,
        revenues: List[Dict],
        start_date: str,
        end_date: str,
        period: str
    ) -> List[Dict[str, Any]]:
        """Generate time series data for revenue charts."""
        from collections import defaultdict

        by_period = defaultdict(float)

        for r in revenues:
            r_date = datetime.strptime(r["date"], "%Y-%m-%d")
            if period == "monthly":
                key = r_date.strftime("%Y-%m")
            elif period == "weekly":
                key = f"Week {r_date.isocalendar()[1]}"
            else:
                key = r_date.strftime("%Y-%m-%d")

            by_period[key] += r["amount"]

        return [{"period": k, "revenue": round(v, 2)} for k, v in sorted(by_period.items())]

    async def _generate_expense_time_series(
        self,
        expenses: List[Dict],
        start_date: str,
        end_date: str
    ) -> List[Dict[str, Any]]:
        """Generate time series data for expense charts."""
        from collections import defaultdict

        by_month = defaultdict(float)

        for e in expenses:
            e_date = datetime.strptime(e["date"], "%Y-%m-%d")
            key = e_date.strftime("%Y-%m")
            by_month[key] += e["amount"]

        return [{"period": k, "expenses": round(v, 2)} for k, v in sorted(by_month.items())]

    async def _generate_maintenance_time_series(
        self,
        items: List[Dict],
        start_date: str,
        end_date: str
    ) -> List[Dict[str, Any]]:
        """Generate time series data for maintenance charts."""
        from collections import defaultdict

        by_month = defaultdict(lambda: {"count": 0, "cost": 0})

        for m in items:
            m_date = datetime.strptime(m["created_at"], "%Y-%m-%d")
            key = m_date.strftime("%Y-%m")
            by_month[key]["count"] += 1
            by_month[key]["cost"] += m.get("cost", 0)

        return [{"period": k, "issues": v["count"], "cost": round(v["cost"], 2)}
                for k, v in sorted(by_month.items())]

    async def _generate_cleaning_time_series(
        self,
        cleanings: List[Dict],
        start_date: str,
        end_date: str
    ) -> List[Dict[str, Any]]:
        """Generate time series data for cleaning charts."""
        from collections import defaultdict

        by_month = defaultdict(lambda: {"count": 0, "payout": 0})

        for c in cleanings:
            c_date = datetime.strptime(c["scheduled_at"], "%Y-%m-%d")
            key = c_date.strftime("%Y-%m")
            by_month[key]["count"] += 1
            by_month[key]["payout"] += c.get("payout", 0)

        return [{"period": k, "cleanings": v["count"], "payout": round(v["payout"], 2)}
                for k, v in sorted(by_month.items())]

    async def _analyze_weekday_weekend_occupancy(
        self,
        bookings: List[Dict],
        start_dt: datetime,
        end_dt: datetime
    ) -> Dict[str, Any]:
        """Analyze weekday vs weekend occupancy patterns."""
        weekday_nights = 0
        weekend_nights = 0

        for b in bookings:
            b_start = datetime.strptime(b["check_in"], "%Y-%m-%d")
            b_end = datetime.strptime(b["check_out"], "%Y-%m-%d")

            current = b_start
            while current < b_end:
                if current.weekday() < 5:
                    weekday_nights += 1
                else:
                    weekend_nights += 1
                current += timedelta(days=1)

        total = weekday_nights + weekend_nights

        return {
            "weekday_nights": weekday_nights,
            "weekend_nights": weekend_nights,
            "weekday_percentage": round(weekday_nights / total * 100, 1) if total > 0 else 0,
            "weekend_percentage": round(weekend_nights / total * 100, 1) if total > 0 else 0
        }

    def _calculate_platform_breakdown(self, bookings: List[Dict]) -> Dict[str, Any]:
        """Calculate booking distribution by platform."""
        from collections import defaultdict

        by_platform = defaultdict(lambda: {"count": 0, "revenue": 0})

        for b in bookings:
            platform = b.get("platform", "direct")
            by_platform[platform]["count"] += 1
            by_platform[platform]["revenue"] += b.get("total_amount", 0)

        return dict(by_platform)

    async def _calculate_yoy_revenue(
        self,
        start_date: str,
        end_date: str,
        property_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calculate year-over-year revenue comparison."""
        # Current period
        current_revenues = await self._get_revenue_entries(start_date, end_date, property_id)
        current_total = sum(r["amount"] for r in current_revenues)

        # Previous year period
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        prev_start = (start_dt - timedelta(days=365)).strftime("%Y-%m-%d")
        prev_end = (end_dt - timedelta(days=365)).strftime("%Y-%m-%d")

        prev_revenues = await self._get_revenue_entries(prev_start, prev_end, property_id)
        prev_total = sum(r["amount"] for r in prev_revenues)

        change = current_total - prev_total
        change_percent = (change / prev_total * 100) if prev_total > 0 else 0

        return {
            "current_period": round(current_total, 2),
            "previous_period": round(prev_total, 2),
            "change": round(change, 2),
            "change_percent": round(change_percent, 1)
        }

    def _calculate_avg_resolution_days(self, items: List[Dict]) -> float:
        """Calculate average maintenance resolution time."""
        resolved = [m for m in items if m.get("resolved_at")]
        if not resolved:
            return 0

        total_days = 0
        for m in resolved:
            created = datetime.strptime(m["created_at"], "%Y-%m-%d")
            resolved_dt = datetime.strptime(m["resolved_at"], "%Y-%m-%d")
            total_days += (resolved_dt - created).days

        return round(total_days / len(resolved), 1)

    def _calculate_maintenance_score(self, items: List[Dict]) -> int:
        """Calculate maintenance health score for a property (0-100)."""
        if not items:
            return 100

        resolved = len([m for m in items if m.get("status") == "completed"])
        high_priority_open = len([m for m in items if m.get("status") != "completed" and m.get("priority") == "high"])

        base_score = 100
        base_score -= (len(items) - resolved) * 5  # Penalty for open issues
        base_score -= high_priority_open * 15  # Extra penalty for high priority open

        return max(0, min(100, base_score))

    def _calculate_avg_cleaning_time(self, cleanings: List[Dict]) -> int:
        """Calculate average cleaning time in minutes."""
        if not cleanings:
            return 0

        total_time = sum(c.get("duration_minutes", 0) for c in cleanings)
        return round(total_time / len(cleanings))

    def _calculate_avg_rating(self, cleanings: List[Dict]) -> float:
        """Calculate average cleaner rating."""
        rated = [c for c in cleanings if c.get("rating")]
        if not rated:
            return 0

        return round(sum(c["rating"] for c in rated) / len(rated), 2)

    def _calculate_on_time_rate(self, cleanings: List[Dict]) -> float:
        """Calculate on-time completion rate."""
        if not cleanings:
            return 0

        on_time = len([c for c in cleanings if c.get("on_time", True)])
        return round(on_time / len(cleanings) * 100, 1)

    def _calculate_cleaner_overall_score(
        self,
        avg_rating: float,
        on_time_rate: float,
        quality_score: int,
        completed: int
    ) -> int:
        """Calculate cleaner overall performance score (0-100)."""
        # Weights: Rating 40%, On-Time 25%, Quality 25%, Volume 10%
        rating_score = (avg_rating / 5) * 40
        on_time_score = (on_time_rate / 100) * 25
        quality_normalized = (quality_score / 100) * 25
        volume_score = min(10, completed / 5)  # Cap at 10 points

        return round(rating_score + on_time_score + quality_normalized + volume_score)

    def _estimate_quarterly_tax(self, revenue: float, expenses: float) -> Dict[str, Any]:
        """Estimate quarterly tax payment."""
        net_income = revenue - expenses

        # Simplified tax calculation (self-employment)
        se_tax = net_income * 0.153  # 15.3% SE tax
        income_tax = net_income * 0.22  # Estimated 22% bracket

        return {
            "net_rental_income": round(net_income, 2),
            "estimated_se_tax": round(se_tax, 2),
            "estimated_income_tax": round(income_tax, 2),
            "total_estimated_tax": round(se_tax + income_tax, 2),
            "quarterly_payment": round((se_tax + income_tax) / 4, 2)
        }


# Singleton instance
reports_service = ReportsService()
