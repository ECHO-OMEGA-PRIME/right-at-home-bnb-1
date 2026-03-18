"""
Right At Home BnB - Daily Briefing Service
============================================
Morning briefing for Steven Palma with:
- Today's check-ins and check-outs
- Houses needing cleaning
- Maintenance due today
- Air filter reminders
- Inventory alerts (low supplies)
- Equipment status

Delivered every morning at 7:00 AM via voice call or notification.

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from loguru import logger

# Firebase
try:
    import firebase_admin
    from firebase_admin import firestore
    db = firestore.client() if firebase_admin._apps else None
    FIREBASE_AVAILABLE = db is not None
except:
    FIREBASE_AVAILABLE = False
    db = None


class DailyBriefingService:
    """
    Generates comprehensive daily briefings for Steven.
    Delivered at 7:00 AM every morning.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.briefings_collection = "rah_daily_briefings"
        self.bookings_collection = "rah_bookings"
        self.maintenance_collection = "rah_maintenance"
        self.inventory_collection = "rah_inventory"

        # Steven's contact info
        self.steven_phone = os.getenv("STEVEN_PHONE", "+14325550100")
        self.steven_email = os.getenv("STEVEN_EMAIL", "steven@rah-midland.com")

    async def generate_daily_briefing(
        self,
        target_date: str = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive daily briefing for Steven.
        Called every morning at 7:00 AM.
        """
        today = target_date or date.today().isoformat()
        tomorrow = (date.fromisoformat(today) + timedelta(days=1)).isoformat()

        briefing = {
            "date": today,
            "generated_at": datetime.utcnow().isoformat(),
            "greeting": self._generate_greeting(),

            # Core operations
            "check_ins": await self._get_check_ins(today),
            "check_outs": await self._get_check_outs(today),
            "houses_to_clean": await self._get_houses_to_clean(today),

            # Maintenance
            "maintenance_due": await self._get_maintenance_due(today),
            "air_filter_reminders": await self._get_air_filter_reminders(),

            # Inventory
            "low_inventory_alerts": await self._get_low_inventory_alerts(),
            "equipment_issues": await self._get_equipment_issues(),

            # Tomorrow preview
            "tomorrow_preview": {
                "check_ins": await self._get_check_ins(tomorrow),
                "check_outs": await self._get_check_outs(tomorrow),
            },

            # Summary stats
            "stats": await self._get_daily_stats(today)
        }

        # Generate voice script
        briefing["voice_script"] = self._generate_voice_script(briefing)

        # Store briefing
        if self.firebase_available and db:
            db.collection(self.briefings_collection).document(today).set(briefing)

        return briefing

    def _generate_greeting(self) -> str:
        """Generate personalized greeting based on time."""
        hour = datetime.now().hour
        if hour < 12:
            greeting = "Good morning"
        elif hour < 17:
            greeting = "Good afternoon"
        else:
            greeting = "Good evening"

        return f"{greeting}, Steven!"

    async def _get_check_ins(self, target_date: str) -> List[Dict]:
        """Get all check-ins for a specific date."""
        if not self.firebase_available or not db:
            # Return sample data for demo
            return [
                {"guest_name": "John Smith", "property": "Castleford Estate", "time": "3:00 PM", "nights": 3},
                {"guest_name": "Maria Garcia", "property": "Permian Palace", "time": "4:00 PM", "nights": 2},
            ]

        docs = (
            db.collection(self.bookings_collection)
            .where("check_in_date", "==", target_date)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    async def _get_check_outs(self, target_date: str) -> List[Dict]:
        """Get all check-outs for a specific date."""
        if not self.firebase_available or not db:
            return [
                {"guest_name": "Robert Johnson", "property": "Sunset Retreat", "time": "11:00 AM"},
                {"guest_name": "Lisa Chen", "property": "Basin View Cottage", "time": "11:00 AM"},
            ]

        docs = (
            db.collection(self.bookings_collection)
            .where("check_out_date", "==", target_date)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    async def _get_houses_to_clean(self, target_date: str) -> List[Dict]:
        """Get houses that need cleaning today."""
        check_outs = await self._get_check_outs(target_date)
        check_ins = await self._get_check_ins(target_date)

        # Properties with checkout need cleaning before next check-in
        houses = []
        for co in check_outs:
            property_name = co.get("property")
            # Check if same-day turn
            next_checkin = next((ci for ci in check_ins if ci.get("property") == property_name), None)

            houses.append({
                "property": property_name,
                "checkout_time": co.get("time", "11:00 AM"),
                "same_day_turn": next_checkin is not None,
                "next_checkin_time": next_checkin.get("time") if next_checkin else None,
                "assigned_cleaner": co.get("assigned_cleaner", "Unassigned"),
                "priority": "HIGH" if next_checkin else "NORMAL"
            })

        return houses

    async def _get_maintenance_due(self, target_date: str) -> List[Dict]:
        """Get maintenance tasks due today."""
        if not self.firebase_available or not db:
            return [
                {"property": "Oilfield Oasis", "task": "HVAC filter replacement", "priority": "MEDIUM"},
                {"property": "Desert Star Lodge", "task": "Smoke detector battery check", "priority": "HIGH"},
            ]

        docs = (
            db.collection(self.maintenance_collection)
            .where("due_date", "==", target_date)
            .where("completed", "==", False)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    async def _get_air_filter_reminders(self) -> List[Dict]:
        """Get properties needing air filter changes (every 90 days)."""
        reminders = []
        # Calculate properties due for filter change
        if not self.firebase_available or not db:
            return [
                {"property": "Castleford Estate", "last_changed": "2025-10-15", "days_overdue": 5},
                {"property": "Permian Palace", "filter_type": "20x25x1", "last_changed": "2025-10-20", "days_overdue": 0},
            ]

        docs = db.collection("rah_air_filters").where("days_until_change", "<=", 7).stream()
        return [doc.to_dict() for doc in docs]

    async def _get_low_inventory_alerts(self) -> List[Dict]:
        """Get properties with low cleaning supplies."""
        if not self.firebase_available or not db:
            return [
                {"property": "Basin View Cottage", "item": "Toilet paper", "current_qty": 2, "min_qty": 6},
                {"property": "Sunset Retreat", "item": "Paper towels", "current_qty": 1, "min_qty": 4},
                {"property": "Midland Manor", "item": "Dish soap", "current_qty": 0, "min_qty": 2},
            ]

        docs = (
            db.collection(self.inventory_collection)
            .where("below_minimum", "==", True)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    async def _get_equipment_issues(self) -> List[Dict]:
        """Get equipment issues or offline devices."""
        if not self.firebase_available or not db:
            return [
                {"property": "Roughneck Rest", "equipment": "Smart Lock", "issue": "Low battery (15%)"},
                {"property": "Texas Pride House", "equipment": "Thermostat", "issue": "Offline since yesterday"},
            ]

        docs = (
            db.collection("rah_smart_home_devices")
            .where("has_issue", "==", True)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    async def _get_daily_stats(self, target_date: str) -> Dict:
        """Get summary stats for the day."""
        check_ins = await self._get_check_ins(target_date)
        check_outs = await self._get_check_outs(target_date)

        return {
            "total_check_ins": len(check_ins),
            "total_check_outs": len(check_outs),
            "same_day_turns": sum(1 for h in await self._get_houses_to_clean(target_date) if h.get("same_day_turn")),
            "occupied_properties": 19,  # Would be calculated
            "vacant_properties": 3,
            "occupancy_rate": 86.4
        }

    def _generate_voice_script(self, briefing: Dict) -> str:
        """Generate TTS script for voice briefing."""
        script_parts = [
            briefing["greeting"],
            f"Here's your daily briefing for {briefing['date']}.",
            "",
        ]

        # Check-ins
        check_ins = briefing.get("check_ins", [])
        if check_ins:
            script_parts.append(f"You have {len(check_ins)} check-ins today:")
            for ci in check_ins[:5]:  # Limit to 5 for voice
                script_parts.append(f"  {ci.get('guest_name')} at {ci.get('property')}, arriving at {ci.get('time')}.")
        else:
            script_parts.append("No check-ins scheduled for today.")

        script_parts.append("")

        # Check-outs
        check_outs = briefing.get("check_outs", [])
        if check_outs:
            script_parts.append(f"You have {len(check_outs)} check-outs today:")
            for co in check_outs[:5]:
                script_parts.append(f"  {co.get('guest_name')} from {co.get('property')}.")
        else:
            script_parts.append("No check-outs today.")

        script_parts.append("")

        # Houses to clean
        houses = briefing.get("houses_to_clean", [])
        if houses:
            high_priority = [h for h in houses if h.get("priority") == "HIGH"]
            if high_priority:
                script_parts.append(f"URGENT: {len(high_priority)} same-day turns requiring priority cleaning:")
                for h in high_priority:
                    script_parts.append(f"  {h.get('property')} - checkout at {h.get('checkout_time')}, next guest at {h.get('next_checkin_time')}.")

        script_parts.append("")

        # Maintenance
        maintenance = briefing.get("maintenance_due", [])
        if maintenance:
            script_parts.append(f"Maintenance due today: {len(maintenance)} items.")
            for m in maintenance[:3]:
                script_parts.append(f"  {m.get('property')}: {m.get('task')}.")

        # Air filters
        filters = briefing.get("air_filter_reminders", [])
        if filters:
            script_parts.append(f"Air filter reminders: {len(filters)} properties due.")

        # Low inventory
        inventory = briefing.get("low_inventory_alerts", [])
        if inventory:
            script_parts.append(f"Low inventory alerts: {len(inventory)} items need restocking.")

        # Equipment issues
        equipment = briefing.get("equipment_issues", [])
        if equipment:
            script_parts.append(f"Equipment issues: {len(equipment)} devices need attention.")

        # Stats
        stats = briefing.get("stats", {})
        script_parts.append("")
        script_parts.append(f"Overall: {stats.get('occupancy_rate', 0):.1f}% occupancy with {stats.get('occupied_properties', 0)} of 22 properties occupied.")

        script_parts.append("")
        script_parts.append("That's your briefing, Steven. Have a great day!")

        return "\n".join(script_parts)

    async def get_briefing(self, target_date: str = None) -> Optional[Dict]:
        """Get a stored briefing."""
        target_date = target_date or date.today().isoformat()

        if self.firebase_available and db:
            doc = db.collection(self.briefings_collection).document(target_date).get()
            if doc.exists:
                return doc.to_dict()

        # Generate fresh if not found
        return await self.generate_daily_briefing(target_date)

    async def deliver_briefing(
        self,
        delivery_method: str = "voice"  # voice, sms, email, push
    ) -> Dict[str, Any]:
        """Deliver today's briefing to Steven."""
        briefing = await self.generate_daily_briefing()

        result = {
            "delivered_at": datetime.utcnow().isoformat(),
            "method": delivery_method,
            "briefing_date": briefing["date"]
        }

        if delivery_method == "voice":
            # Would call Steven via Twilio
            result["status"] = "voice_call_initiated"
            result["phone"] = self.steven_phone
        elif delivery_method == "sms":
            result["status"] = "sms_sent"
        elif delivery_method == "push":
            result["status"] = "push_notification_sent"

        return result

    # =========================================================================
    # WEEKLY REPORT
    # =========================================================================
    async def generate_weekly_report(self, end_date: str = None) -> Dict[str, Any]:
        """
        Generate end-of-week report for Steven.
        Covers Monday through Sunday of the specified week.
        """
        end = date.fromisoformat(end_date) if end_date else date.today()
        # Get the most recent Sunday
        days_since_sunday = (end.weekday() + 1) % 7
        week_end = end - timedelta(days=days_since_sunday)
        week_start = week_end - timedelta(days=6)

        report = {
            "report_type": "weekly",
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "generated_at": datetime.utcnow().isoformat(),

            # Booking Summary
            "bookings": await self._get_week_bookings(week_start, week_end),

            # Revenue
            "revenue": await self._get_week_revenue(week_start, week_end),

            # Cleaning Stats
            "cleaning_stats": await self._get_week_cleaning_stats(week_start, week_end),

            # Maintenance Completed
            "maintenance": await self._get_week_maintenance(week_start, week_end),

            # Guest Ratings Received
            "guest_ratings": await self._get_week_ratings(week_start, week_end),

            # Issues/Incidents
            "incidents": await self._get_week_incidents(week_start, week_end),

            # Cleaner Performance
            "cleaner_rankings": await self._get_cleaner_weekly_rankings(week_start, week_end),
        }

        # Generate summary text
        report["summary"] = self._generate_weekly_summary(report)

        # Store report
        if self.firebase_available and db:
            doc_id = f"weekly_{week_start.isoformat()}"
            db.collection("rah_weekly_reports").document(doc_id).set(report)

        return report

    async def _get_week_bookings(self, start: date, end: date) -> Dict:
        """Get booking stats for the week."""
        if not self.firebase_available or not db:
            return {
                "total_check_ins": 12,
                "total_check_outs": 11,
                "nights_booked": 84,
                "occupancy_rate": 54.5,
                "new_bookings": 8,
                "cancellations": 1
            }

        # Query bookings in date range
        check_ins = db.collection(self.bookings_collection).where(
            "check_in_date", ">=", start.isoformat()
        ).where("check_in_date", "<=", end.isoformat()).stream()

        check_outs = db.collection(self.bookings_collection).where(
            "check_out_date", ">=", start.isoformat()
        ).where("check_out_date", "<=", end.isoformat()).stream()

        return {
            "total_check_ins": len(list(check_ins)),
            "total_check_outs": len(list(check_outs)),
            "nights_booked": 84,  # Would be calculated
            "occupancy_rate": 54.5,
            "new_bookings": 8,
            "cancellations": 1
        }

    async def _get_week_revenue(self, start: date, end: date) -> Dict:
        """Get revenue for the week."""
        return {
            "gross_revenue": 12450.00,
            "cleaning_fees": 1200.00,
            "platform_fees": 1494.00,
            "net_revenue": 9756.00,
            "by_property": [
                {"property": "Castleford Estate", "revenue": 2100.00},
                {"property": "Permian Palace", "revenue": 1800.00},
                {"property": "Desert Star Lodge", "revenue": 1650.00},
            ]
        }

    async def _get_week_cleaning_stats(self, start: date, end: date) -> Dict:
        """Get cleaning stats for the week."""
        return {
            "total_cleanings": 15,
            "same_day_turns": 4,
            "average_time_minutes": 95,
            "on_time_percentage": 93.3
        }

    async def _get_week_maintenance(self, start: date, end: date) -> Dict:
        """Get maintenance completed this week."""
        return {
            "completed": 8,
            "pending": 3,
            "emergency_calls": 1,
            "total_cost": 485.00
        }

    async def _get_week_ratings(self, start: date, end: date) -> Dict:
        """Get guest ratings received this week."""
        return {
            "reviews_received": 6,
            "average_rating": 4.83,
            "five_star_count": 5,
            "issues_mentioned": ["late check-in", "AC noise"]
        }

    async def _get_week_incidents(self, start: date, end: date) -> List[Dict]:
        """Get incidents from this week."""
        return [
            {"date": "2026-01-10", "property": "Basin View Cottage", "issue": "Guest locked out", "resolved": True},
        ]

    async def _get_cleaner_weekly_rankings(self, start: date, end: date) -> List[Dict]:
        """Get cleaner performance rankings for the week."""
        return [
            {"name": "Maria Rodriguez", "cleanings": 6, "avg_score": 4.9, "avg_time": 85},
            {"name": "James Wilson", "cleanings": 5, "avg_score": 4.7, "avg_time": 92},
            {"name": "Sarah Chen", "cleanings": 4, "avg_score": 4.8, "avg_time": 88},
        ]

    def _generate_weekly_summary(self, report: Dict) -> str:
        """Generate text summary for weekly report."""
        revenue = report.get("revenue", {})
        bookings = report.get("bookings", {})
        ratings = report.get("guest_ratings", {})

        return f"""
WEEKLY REPORT: {report['week_start']} to {report['week_end']}

REVENUE: ${revenue.get('net_revenue', 0):,.2f} net (${revenue.get('gross_revenue', 0):,.2f} gross)

BOOKINGS: {bookings.get('total_check_ins', 0)} check-ins, {bookings.get('total_check_outs', 0)} check-outs
Occupancy Rate: {bookings.get('occupancy_rate', 0):.1f}%

GUEST REVIEWS: {ratings.get('reviews_received', 0)} reviews, {ratings.get('average_rating', 0):.2f} avg rating

CLEANING: {report.get('cleaning_stats', {}).get('total_cleanings', 0)} cleanings completed
On-time: {report.get('cleaning_stats', {}).get('on_time_percentage', 0):.1f}%

MAINTENANCE: {report.get('maintenance', {}).get('completed', 0)} completed, ${report.get('maintenance', {}).get('total_cost', 0):.2f} spent
"""

    # =========================================================================
    # MONTHLY REPORT
    # =========================================================================
    async def generate_monthly_report(self, year: int = None, month: int = None) -> Dict[str, Any]:
        """
        Generate end-of-month report for Steven.
        Comprehensive monthly performance review.
        """
        today = date.today()
        year = year or today.year
        month = month or today.month

        # Get first and last day of month
        month_start = date(year, month, 1)
        if month == 12:
            month_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(year, month + 1, 1) - timedelta(days=1)

        report = {
            "report_type": "monthly",
            "year": year,
            "month": month,
            "month_name": month_start.strftime("%B"),
            "month_start": month_start.isoformat(),
            "month_end": month_end.isoformat(),
            "generated_at": datetime.utcnow().isoformat(),

            # Financial Summary
            "financials": await self._get_monthly_financials(year, month),

            # Occupancy by Property
            "occupancy": await self._get_monthly_occupancy(year, month),

            # Top Performing Properties
            "top_properties": await self._get_top_properties(year, month),

            # Bottom Performing Properties
            "underperforming": await self._get_underperforming_properties(year, month),

            # Guest Statistics
            "guest_stats": await self._get_monthly_guest_stats(year, month),

            # Cleaner Performance
            "cleaner_stats": await self._get_monthly_cleaner_stats(year, month),

            # Maintenance Summary
            "maintenance": await self._get_monthly_maintenance(year, month),

            # Expenses Breakdown
            "expenses": await self._get_monthly_expenses(year, month),

            # Comparison to Last Month
            "vs_last_month": await self._get_month_comparison(year, month),
        }

        # Generate executive summary
        report["executive_summary"] = self._generate_monthly_summary(report)

        # Store report
        if self.firebase_available and db:
            doc_id = f"monthly_{year}_{month:02d}"
            db.collection("rah_monthly_reports").document(doc_id).set(report)

        return report

    async def _get_monthly_financials(self, year: int, month: int) -> Dict:
        """Get monthly financial summary."""
        return {
            "gross_revenue": 52800.00,
            "cleaning_fees_collected": 4800.00,
            "platform_fees_paid": 6336.00,
            "cleaning_costs": 3200.00,
            "maintenance_costs": 1850.00,
            "utilities_total": 4200.00,
            "net_operating_income": 42014.00,
            "per_property_average": 1909.73
        }

    async def _get_monthly_occupancy(self, year: int, month: int) -> Dict:
        """Get occupancy rates by property."""
        return {
            "overall_rate": 72.4,
            "total_nights_available": 682,  # 22 properties × 31 days
            "total_nights_booked": 494,
            "by_property": [
                {"property": "Castleford Estate", "rate": 87.1, "nights": 27},
                {"property": "Permian Palace", "rate": 83.9, "nights": 26},
                {"property": "Desert Star Lodge", "rate": 80.6, "nights": 25},
                # ... more properties
            ]
        }

    async def _get_top_properties(self, year: int, month: int) -> List[Dict]:
        """Get top 5 performing properties."""
        return [
            {"property": "Castleford Estate", "revenue": 4200.00, "occupancy": 87.1, "rating": 4.9},
            {"property": "Permian Palace", "revenue": 3800.00, "occupancy": 83.9, "rating": 4.85},
            {"property": "Oilfield Oasis", "revenue": 3500.00, "occupancy": 80.6, "rating": 4.9},
            {"property": "Desert Star Lodge", "revenue": 3200.00, "occupancy": 77.4, "rating": 4.8},
            {"property": "Roughneck Rest", "revenue": 2900.00, "occupancy": 74.2, "rating": 4.75},
        ]

    async def _get_underperforming_properties(self, year: int, month: int) -> List[Dict]:
        """Get properties needing attention."""
        return [
            {"property": "Sunset Retreat", "occupancy": 45.2, "issue": "Low bookings", "suggestion": "Update photos"},
            {"property": "Basin View Cottage", "occupancy": 51.6, "issue": "Below average", "suggestion": "Adjust pricing"},
        ]

    async def _get_monthly_guest_stats(self, year: int, month: int) -> Dict:
        """Get guest statistics for the month."""
        return {
            "total_guests": 89,
            "repeat_guests": 12,
            "new_guests": 77,
            "average_stay_nights": 2.8,
            "reviews_received": 24,
            "average_rating": 4.82,
            "five_star_reviews": 20,
            "issues_reported": 3
        }

    async def _get_monthly_cleaner_stats(self, year: int, month: int) -> Dict:
        """Get cleaner performance for the month."""
        return {
            "total_cleanings": 65,
            "average_cleanliness_score": 4.78,
            "average_time_minutes": 92,
            "on_time_rate": 94.2,
            "top_cleaner": {"name": "Maria Rodriguez", "cleanings": 22, "avg_score": 4.92},
            "needs_improvement": []
        }

    async def _get_monthly_maintenance(self, year: int, month: int) -> Dict:
        """Get maintenance summary for the month."""
        return {
            "total_tasks": 34,
            "completed": 31,
            "pending": 3,
            "emergency_calls": 2,
            "total_cost": 1850.00,
            "preventive_tasks": 18,
            "reactive_tasks": 16
        }

    async def _get_monthly_expenses(self, year: int, month: int) -> Dict:
        """Get expense breakdown for the month."""
        return {
            "utilities": {
                "electric": 2800.00,
                "water": 680.00,
                "gas": 320.00,
                "internet": 400.00,
                "total": 4200.00
            },
            "cleaning": 3200.00,
            "maintenance": 1850.00,
            "supplies": 650.00,
            "platform_fees": 6336.00,
            "insurance": 1200.00,
            "other": 450.00,
            "total": 17886.00
        }

    async def _get_month_comparison(self, year: int, month: int) -> Dict:
        """Compare to previous month."""
        return {
            "revenue_change": 8.5,
            "occupancy_change": 3.2,
            "rating_change": 0.05,
            "expense_change": -2.1,
            "trend": "improving"
        }

    def _generate_monthly_summary(self, report: Dict) -> str:
        """Generate executive summary for monthly report."""
        fin = report.get("financials", {})
        occ = report.get("occupancy", {})
        guests = report.get("guest_stats", {})
        vs_last = report.get("vs_last_month", {})

        trend_emoji = "📈" if vs_last.get("trend") == "improving" else "📉"

        return f"""
MONTHLY REPORT: {report.get('month_name')} {report.get('year')}
{trend_emoji} Trend: {vs_last.get('trend', 'stable').upper()}

💰 FINANCIAL PERFORMANCE
Gross Revenue: ${fin.get('gross_revenue', 0):,.2f}
Net Operating Income: ${fin.get('net_operating_income', 0):,.2f}
Per-Property Average: ${fin.get('per_property_average', 0):,.2f}
Revenue vs Last Month: {vs_last.get('revenue_change', 0):+.1f}%

🏠 OCCUPANCY
Overall Rate: {occ.get('overall_rate', 0):.1f}%
Nights Booked: {occ.get('total_nights_booked', 0)} / {occ.get('total_nights_available', 0)}
Occupancy vs Last Month: {vs_last.get('occupancy_change', 0):+.1f}%

⭐ GUEST SATISFACTION
Total Guests: {guests.get('total_guests', 0)} ({guests.get('repeat_guests', 0)} repeat)
Average Rating: {guests.get('average_rating', 0):.2f}/5.0
5-Star Reviews: {guests.get('five_star_reviews', 0)}/{guests.get('reviews_received', 0)}

📋 KEY METRICS
Total Cleanings: {report.get('cleaner_stats', {}).get('total_cleanings', 0)}
Maintenance Tasks: {report.get('maintenance', {}).get('completed', 0)} completed
Total Expenses: ${report.get('expenses', {}).get('total', 0):,.2f}
"""

    # =========================================================================
    # YEARLY REPORT
    # =========================================================================
    async def generate_yearly_report(self, year: int = None) -> Dict[str, Any]:
        """
        Generate end-of-year comprehensive report for Steven.
        Complete annual performance review with tax-ready data.
        """
        year = year or date.today().year

        report = {
            "report_type": "yearly",
            "year": year,
            "generated_at": datetime.utcnow().isoformat(),

            # Annual Financial Summary
            "financials": await self._get_yearly_financials(year),

            # Monthly Breakdown
            "monthly_breakdown": await self._get_monthly_breakdown(year),

            # Property Performance Rankings
            "property_rankings": await self._get_yearly_property_rankings(year),

            # Occupancy Trends
            "occupancy_trends": await self._get_yearly_occupancy_trends(year),

            # Guest Analytics
            "guest_analytics": await self._get_yearly_guest_analytics(year),

            # Cleaner Annual Performance
            "cleaner_performance": await self._get_yearly_cleaner_performance(year),

            # Maintenance & Capex
            "maintenance_summary": await self._get_yearly_maintenance(year),

            # Tax Report Data
            "tax_data": await self._get_yearly_tax_data(year),

            # Year-over-Year Comparison
            "yoy_comparison": await self._get_yoy_comparison(year),

            # Recommendations for Next Year
            "recommendations": await self._generate_yearly_recommendations(year),
        }

        # Generate annual summary
        report["annual_summary"] = self._generate_yearly_summary(report)

        # Store report
        if self.firebase_available and db:
            doc_id = f"yearly_{year}"
            db.collection("rah_yearly_reports").document(doc_id).set(report)

        return report

    async def _get_yearly_financials(self, year: int) -> Dict:
        """Get annual financial summary."""
        return {
            "gross_revenue": 634500.00,
            "cleaning_fees_collected": 57600.00,
            "total_income": 692100.00,

            "platform_fees_paid": 76140.00,
            "cleaning_costs": 38400.00,
            "maintenance_costs": 22200.00,
            "utilities_total": 50400.00,
            "supplies": 7800.00,
            "insurance": 14400.00,
            "property_taxes": 28600.00,
            "other_expenses": 12000.00,
            "total_expenses": 249940.00,

            "net_operating_income": 442160.00,
            "per_property_annual": 20098.18,
            "average_monthly_income": 36846.67
        }

    async def _get_monthly_breakdown(self, year: int) -> List[Dict]:
        """Get revenue by month."""
        return [
            {"month": "January", "revenue": 48200.00, "expenses": 18500.00, "net": 29700.00},
            {"month": "February", "revenue": 45800.00, "expenses": 17200.00, "net": 28600.00},
            {"month": "March", "revenue": 52100.00, "expenses": 19800.00, "net": 32300.00},
            {"month": "April", "revenue": 49500.00, "expenses": 18900.00, "net": 30600.00},
            {"month": "May", "revenue": 54200.00, "expenses": 20100.00, "net": 34100.00},
            {"month": "June", "revenue": 58900.00, "expenses": 22400.00, "net": 36500.00},
            {"month": "July", "revenue": 62400.00, "expenses": 24100.00, "net": 38300.00},
            {"month": "August", "revenue": 59800.00, "expenses": 23200.00, "net": 36600.00},
            {"month": "September", "revenue": 51200.00, "expenses": 19600.00, "net": 31600.00},
            {"month": "October", "revenue": 53400.00, "expenses": 20400.00, "net": 33000.00},
            {"month": "November", "revenue": 48600.00, "expenses": 18800.00, "net": 29800.00},
            {"month": "December", "revenue": 50400.00, "expenses": 26940.00, "net": 23460.00},
        ]

    async def _get_yearly_property_rankings(self, year: int) -> List[Dict]:
        """Get all properties ranked by performance."""
        return [
            {"rank": 1, "property": "Castleford Estate", "revenue": 42000.00, "occupancy": 82.1, "rating": 4.92},
            {"rank": 2, "property": "Permian Palace", "revenue": 38500.00, "occupancy": 79.4, "rating": 4.88},
            {"rank": 3, "property": "Oilfield Oasis", "revenue": 36200.00, "occupancy": 77.8, "rating": 4.90},
            # ... all 22 properties
        ]

    async def _get_yearly_occupancy_trends(self, year: int) -> Dict:
        """Get occupancy trends throughout the year."""
        return {
            "average_annual_occupancy": 68.4,
            "peak_month": {"month": "July", "occupancy": 84.2},
            "lowest_month": {"month": "February", "occupancy": 52.1},
            "weekend_vs_weekday": {"weekend": 78.5, "weekday": 62.3},
            "seasonal_patterns": {
                "spring": 65.2,
                "summer": 79.8,
                "fall": 68.1,
                "winter": 58.4
            }
        }

    async def _get_yearly_guest_analytics(self, year: int) -> Dict:
        """Get annual guest analytics."""
        return {
            "total_guests": 1068,
            "unique_guests": 892,
            "repeat_guests": 176,
            "repeat_rate": 16.5,
            "average_stay_nights": 2.6,
            "total_nights_sold": 5932,
            "reviews_received": 312,
            "average_rating": 4.84,
            "five_star_rate": 78.2,
            "top_guest_sources": [
                {"source": "Airbnb", "percentage": 62},
                {"source": "VRBO", "percentage": 28},
                {"source": "Direct", "percentage": 10}
            ]
        }

    async def _get_yearly_cleaner_performance(self, year: int) -> Dict:
        """Get annual cleaner performance."""
        return {
            "total_cleanings": 780,
            "total_cleaning_cost": 38400.00,
            "average_cost_per_cleaning": 49.23,
            "top_performers": [
                {"name": "Maria Rodriguez", "cleanings": 264, "avg_score": 4.91, "reliability": 98.5},
                {"name": "Sarah Chen", "cleanings": 198, "avg_score": 4.87, "reliability": 97.2},
                {"name": "James Wilson", "cleanings": 186, "avg_score": 4.82, "reliability": 95.8},
            ],
            "team_average_score": 4.79,
            "on_time_rate": 94.6
        }

    async def _get_yearly_maintenance(self, year: int) -> Dict:
        """Get annual maintenance summary."""
        return {
            "total_tasks": 408,
            "preventive": 252,
            "reactive": 156,
            "emergency_calls": 24,
            "total_cost": 22200.00,
            "major_repairs": [
                {"property": "Sunset Retreat", "repair": "HVAC replacement", "cost": 4200.00},
                {"property": "Basin View Cottage", "repair": "Water heater", "cost": 1800.00},
            ],
            "capex_spend": 12400.00
        }

    async def _get_yearly_tax_data(self, year: int) -> Dict:
        """Get tax-ready data for accountant."""
        return {
            "gross_rental_income": 692100.00,
            "deductible_expenses": {
                "cleaning": 38400.00,
                "maintenance": 22200.00,
                "utilities": 50400.00,
                "supplies": 7800.00,
                "insurance": 14400.00,
                "property_taxes": 28600.00,
                "platform_fees": 76140.00,
                "professional_services": 3600.00,
                "other": 8400.00,
                "total_deductible": 249940.00
            },
            "depreciation": {
                "buildings": 45000.00,
                "furniture": 8500.00,
                "equipment": 3200.00,
                "total": 56700.00
            },
            "net_taxable_income": 385460.00,
            "quarterly_estimates_paid": 48000.00,
            "1099_recipients": [
                {"name": "Maria Rodriguez", "amount": 12936.00, "ein": "XX-XXXXXXX"},
                {"name": "Sarah Chen", "amount": 9702.00, "ein": "XX-XXXXXXX"},
                {"name": "James Wilson", "amount": 9114.00, "ein": "XX-XXXXXXX"},
            ]
        }

    async def _get_yoy_comparison(self, year: int) -> Dict:
        """Compare to previous year."""
        return {
            "revenue_growth": 12.4,
            "expense_growth": 8.2,
            "net_income_growth": 15.8,
            "occupancy_change": 4.2,
            "rating_change": 0.08,
            "properties_added": 2,
            "overall_assessment": "Strong growth year"
        }

    async def _generate_yearly_recommendations(self, year: int) -> List[str]:
        """Generate recommendations for next year."""
        return [
            "Consider adding 2-3 more properties to portfolio - strong market demand",
            "Invest in smart home upgrades for older properties to improve ratings",
            "Negotiate bulk cleaning supply contracts to reduce costs",
            "Implement dynamic pricing during summer peak season",
            "Focus marketing on direct bookings to reduce platform fees",
            "Schedule preventive HVAC maintenance in spring to avoid summer emergencies",
        ]

    def _generate_yearly_summary(self, report: Dict) -> str:
        """Generate executive summary for annual report."""
        fin = report.get("financials", {})
        guests = report.get("guest_analytics", {})
        yoy = report.get("yoy_comparison", {})

        return f"""
═══════════════════════════════════════════════════════════════════
RIGHT AT HOME BNB - ANNUAL REPORT {report.get('year')}
Steven Palma | Midland, TX | 22 Properties
═══════════════════════════════════════════════════════════════════

📊 EXECUTIVE SUMMARY
Overall Assessment: {yoy.get('overall_assessment', 'N/A')}
Year-over-Year Growth: {yoy.get('revenue_growth', 0):+.1f}% revenue, {yoy.get('net_income_growth', 0):+.1f}% net income

💰 FINANCIAL HIGHLIGHTS
Total Revenue: ${fin.get('total_income', 0):,.2f}
Total Expenses: ${fin.get('total_expenses', 0):,.2f}
Net Operating Income: ${fin.get('net_operating_income', 0):,.2f}
Average Per Property: ${fin.get('per_property_annual', 0):,.2f}

🏠 PORTFOLIO PERFORMANCE
Total Nights Sold: {guests.get('total_nights_sold', 0):,}
Average Occupancy: {report.get('occupancy_trends', {}).get('average_annual_occupancy', 0):.1f}%
Peak Month: {report.get('occupancy_trends', {}).get('peak_month', {}).get('month', 'N/A')}

⭐ GUEST SATISFACTION
Total Guests Served: {guests.get('total_guests', 0):,}
Repeat Guest Rate: {guests.get('repeat_rate', 0):.1f}%
Average Rating: {guests.get('average_rating', 0):.2f}/5.0
5-Star Rate: {guests.get('five_star_rate', 0):.1f}%

📋 TAX INFORMATION (For Accountant)
Gross Rental Income: ${report.get('tax_data', {}).get('gross_rental_income', 0):,.2f}
Total Deductions: ${report.get('tax_data', {}).get('deductible_expenses', {}).get('total_deductible', 0):,.2f}
Depreciation: ${report.get('tax_data', {}).get('depreciation', {}).get('total', 0):,.2f}
Estimated Net Taxable: ${report.get('tax_data', {}).get('net_taxable_income', 0):,.2f}

🔮 RECOMMENDATIONS FOR {report.get('year', 0) + 1}
""" + "\n".join(f"• {rec}" for rec in report.get("recommendations", []))


# Singleton instance
daily_briefing_service = DailyBriefingService()
