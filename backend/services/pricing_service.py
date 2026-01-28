"""
Dynamic Pricing Engine for Right at Home BnB
=============================================
Intelligent pricing system optimized for Midland, TX oil field market.

Features:
- Base rate calculation with property-specific factors
- Seasonal adjustments (oil field busy seasons)
- Weekend/holiday premiums
- Last-minute discounts
- High-demand surcharges
- Competitor price checking
- Revenue optimization analysis

@author ECHO OMEGA PRIME
@location Midland, TX
"""

from datetime import datetime, date, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from loguru import logger
import httpx
import asyncio
from statistics import mean, stdev


class SeasonType(str, Enum):
    """Midland TX oil field seasonal patterns."""
    PEAK_OIL = "peak_oil"           # High drilling activity
    MODERATE_OIL = "moderate_oil"   # Normal activity
    LOW_OIL = "low_oil"             # Reduced activity
    HOLIDAY = "holiday"             # Major holidays
    EVENT = "event"                 # Local events (rodeos, conferences)


class RuleType(str, Enum):
    """Types of pricing rules."""
    SEASONAL = "seasonal"
    WEEKEND = "weekend"
    HOLIDAY = "holiday"
    LAST_MINUTE = "last_minute"
    LONG_STAY = "long_stay"
    HIGH_DEMAND = "high_demand"
    LOW_DEMAND = "low_demand"
    COMPETITOR = "competitor"
    OCCUPANCY = "occupancy"
    EVENT = "event"
    CUSTOM = "custom"


class DayOfWeek(str, Enum):
    """Days of the week."""
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


@dataclass
class PricingCondition:
    """Condition for when a pricing rule applies."""
    field: str  # date_range, day_of_week, days_until_checkin, occupancy_rate, etc.
    operator: str  # eq, ne, gt, gte, lt, lte, in, between
    value: Any

    def evaluate(self, context: Dict[str, Any]) -> bool:
        """Evaluate if condition is met given context."""
        actual = context.get(self.field)
        if actual is None:
            return False

        if self.operator == "eq":
            return actual == self.value
        elif self.operator == "ne":
            return actual != self.value
        elif self.operator == "gt":
            return actual > self.value
        elif self.operator == "gte":
            return actual >= self.value
        elif self.operator == "lt":
            return actual < self.value
        elif self.operator == "lte":
            return actual <= self.value
        elif self.operator == "in":
            return actual in self.value
        elif self.operator == "between":
            return self.value[0] <= actual <= self.value[1]
        return False


@dataclass
class PricingRule:
    """A single pricing rule with conditions and adjustment."""
    id: str
    name: str
    rule_type: RuleType
    adjustment_percent: float  # -20.0 for 20% discount, +30.0 for 30% surcharge
    priority: int = 0  # Higher priority rules override lower
    conditions: List[PricingCondition] = field(default_factory=list)
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    property_ids: Optional[List[str]] = None  # None = applies to all
    active: bool = True

    def applies_to(self, property_id: str, context: Dict[str, Any]) -> bool:
        """Check if rule applies to this property and context."""
        if not self.active:
            return False
        if self.property_ids and property_id not in self.property_ids:
            return False
        return all(cond.evaluate(context) for cond in self.conditions)


@dataclass
class PriceSuggestion:
    """A suggested price with breakdown."""
    base_price: float
    suggested_price: float
    adjustments: List[Dict[str, Any]]
    confidence: float  # 0.0 - 1.0
    reasoning: List[str]
    competitor_prices: Optional[List[Dict[str, float]]] = None
    historical_occupancy: Optional[float] = None
    market_demand: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "base_price": self.base_price,
            "suggested_price": round(self.suggested_price, 2),
            "adjustments": self.adjustments,
            "confidence": round(self.confidence, 2),
            "reasoning": self.reasoning,
            "competitor_prices": self.competitor_prices,
            "historical_occupancy": self.historical_occupancy,
            "market_demand": self.market_demand,
            "total_adjustment_percent": round(
                ((self.suggested_price - self.base_price) / self.base_price) * 100, 1
            ) if self.base_price > 0 else 0
        }


@dataclass
class RevenueAnalysis:
    """Revenue optimization analysis."""
    property_id: str
    period_start: date
    period_end: date
    current_revenue: float
    projected_revenue: float
    projected_increase: float
    recommendations: List[Dict[str, Any]]
    occupancy_current: float
    occupancy_projected: float
    price_elasticity: float


class MidlandSeasonalCalendar:
    """
    Midland, TX Oil Field Seasonal Calendar
    =======================================
    Tracks oil industry cycles and local events affecting rental demand.
    """

    # Oil field busy seasons (typical high-activity months)
    OIL_PEAK_MONTHS = [3, 4, 5, 9, 10, 11]  # Mar-May, Sep-Nov
    OIL_LOW_MONTHS = [12, 1, 2, 7, 8]  # Dec-Feb (weather), Jul-Aug (hot)

    # Midland events that spike demand
    MIDLAND_EVENTS = {
        # Permian Basin International Oil Show (bi-annual, October)
        "permian_oil_show": {
            "month": 10,
            "week": 3,  # Third week
            "multiplier": 1.50,
            "duration_days": 5
        },
        # Midland Rodeo (CAF Airsho weekend typically)
        "caf_airsho": {
            "month": 9,
            "week": 2,
            "multiplier": 1.30,
            "duration_days": 3
        },
        # West Texas Fair & Rodeo
        "west_texas_fair": {
            "month": 9,
            "week": 1,
            "multiplier": 1.25,
            "duration_days": 9
        }
    }

    # Major US holidays with Midland-specific impacts
    HOLIDAYS = {
        "new_years": {"month": 1, "day": 1, "multiplier": 1.15},
        "mlk_day": {"month": 1, "week": 3, "weekday": 0, "multiplier": 1.10},
        "presidents_day": {"month": 2, "week": 3, "weekday": 0, "multiplier": 1.10},
        "memorial_day": {"month": 5, "week": -1, "weekday": 0, "multiplier": 1.20},
        "independence_day": {"month": 7, "day": 4, "multiplier": 1.25},
        "labor_day": {"month": 9, "week": 1, "weekday": 0, "multiplier": 1.20},
        "thanksgiving": {"month": 11, "week": 4, "weekday": 3, "multiplier": 1.20},
        "christmas": {"month": 12, "day": 25, "multiplier": 1.30},
        "new_years_eve": {"month": 12, "day": 31, "multiplier": 1.25}
    }

    @classmethod
    def get_season(cls, check_date: date) -> Tuple[SeasonType, float]:
        """Get season type and base multiplier for a date."""
        month = check_date.month

        # Check for holidays first
        for name, holiday in cls.HOLIDAYS.items():
            if cls._is_holiday(check_date, holiday):
                return SeasonType.HOLIDAY, holiday["multiplier"]

        # Check for local events
        for name, event in cls.MIDLAND_EVENTS.items():
            if cls._is_event(check_date, event):
                return SeasonType.EVENT, event["multiplier"]

        # Seasonal oil field patterns
        if month in cls.OIL_PEAK_MONTHS:
            return SeasonType.PEAK_OIL, 1.25
        elif month in cls.OIL_LOW_MONTHS:
            return SeasonType.LOW_OIL, 0.90
        else:
            return SeasonType.MODERATE_OIL, 1.00

    @classmethod
    def _is_holiday(cls, check_date: date, holiday: Dict) -> bool:
        """Check if date matches a holiday."""
        if check_date.month != holiday["month"]:
            return False
        if "day" in holiday:
            return check_date.day == holiday["day"]
        if "week" in holiday and "weekday" in holiday:
            # Calculate nth weekday of month
            first_day = date(check_date.year, check_date.month, 1)
            target_weekday = holiday["weekday"]
            week_num = holiday["week"]

            # Find first occurrence of weekday
            days_until = (target_weekday - first_day.weekday()) % 7
            first_occurrence = first_day + timedelta(days=days_until)

            if week_num > 0:
                target_date = first_occurrence + timedelta(weeks=week_num - 1)
            else:  # -1 = last occurrence
                # Find last occurrence
                target_date = first_occurrence
                while (target_date + timedelta(weeks=1)).month == check_date.month:
                    target_date += timedelta(weeks=1)

            return check_date == target_date
        return False

    @classmethod
    def _is_event(cls, check_date: date, event: Dict) -> bool:
        """Check if date falls within an event period."""
        if check_date.month != event["month"]:
            return False

        # Find nth week start
        first_day = date(check_date.year, check_date.month, 1)
        week_start = first_day + timedelta(weeks=event["week"] - 1)
        # Adjust to Monday
        week_start = week_start - timedelta(days=week_start.weekday())
        event_end = week_start + timedelta(days=event["duration_days"])

        return week_start <= check_date <= event_end


class DynamicPricingEngine:
    """
    Dynamic Pricing Engine for Right at Home BnB
    ============================================
    Optimized for Midland, TX oil field rental market.
    """

    def __init__(self, db_session=None):
        """Initialize the pricing engine."""
        self.db = db_session
        self.rules: List[PricingRule] = []
        self.calendar = MidlandSeasonalCalendar()
        self._load_default_rules()
        logger.info("Dynamic Pricing Engine initialized for Midland, TX market")

    def _load_default_rules(self):
        """Load default pricing rules for Midland market."""
        # Weekend premium (Fri-Sat nights)
        self.rules.append(PricingRule(
            id="weekend_premium",
            name="Weekend Premium",
            rule_type=RuleType.WEEKEND,
            adjustment_percent=15.0,
            priority=10,
            conditions=[
                PricingCondition("day_of_week", "in", [DayOfWeek.FRIDAY.value, DayOfWeek.SATURDAY.value])
            ]
        ))

        # Last-minute discount (< 3 days out, vacancy)
        self.rules.append(PricingRule(
            id="last_minute_discount",
            name="Last-Minute Discount",
            rule_type=RuleType.LAST_MINUTE,
            adjustment_percent=-15.0,
            priority=5,
            conditions=[
                PricingCondition("days_until_checkin", "lte", 3),
                PricingCondition("is_vacant", "eq", True)
            ]
        ))

        # Long stay discount (7+ nights)
        self.rules.append(PricingRule(
            id="long_stay_discount",
            name="Weekly Stay Discount",
            rule_type=RuleType.LONG_STAY,
            adjustment_percent=-10.0,
            priority=15,
            conditions=[
                PricingCondition("stay_length", "gte", 7)
            ]
        ))

        # Extended stay discount (30+ nights) - Oil field workers often need monthly
        self.rules.append(PricingRule(
            id="monthly_stay_discount",
            name="Monthly Stay Discount",
            rule_type=RuleType.LONG_STAY,
            adjustment_percent=-25.0,
            priority=20,
            conditions=[
                PricingCondition("stay_length", "gte", 30)
            ]
        ))

        # High occupancy surcharge (property 85%+ occupied this month)
        self.rules.append(PricingRule(
            id="high_demand_surcharge",
            name="High Demand Surcharge",
            rule_type=RuleType.HIGH_DEMAND,
            adjustment_percent=20.0,
            priority=25,
            conditions=[
                PricingCondition("monthly_occupancy", "gte", 0.85)
            ]
        ))

        # Low occupancy incentive
        self.rules.append(PricingRule(
            id="low_demand_discount",
            name="Low Demand Incentive",
            rule_type=RuleType.LOW_DEMAND,
            adjustment_percent=-10.0,
            priority=8,
            conditions=[
                PricingCondition("monthly_occupancy", "lt", 0.50)
            ]
        ))

        # Oil field peak season
        self.rules.append(PricingRule(
            id="oil_peak_season",
            name="Oil Field Peak Season",
            rule_type=RuleType.SEASONAL,
            adjustment_percent=25.0,
            priority=30,
            conditions=[
                PricingCondition("season_type", "eq", SeasonType.PEAK_OIL.value)
            ]
        ))

        # Oil field slow season
        self.rules.append(PricingRule(
            id="oil_slow_season",
            name="Oil Field Slow Season",
            rule_type=RuleType.SEASONAL,
            adjustment_percent=-10.0,
            priority=30,
            conditions=[
                PricingCondition("season_type", "eq", SeasonType.LOW_OIL.value)
            ]
        ))

        logger.info(f"Loaded {len(self.rules)} default pricing rules")

    async def get_suggested_price(
        self,
        property_id: str,
        check_in: date,
        check_out: date,
        base_price: float,
        bedrooms: int = 2,
        current_occupancy: float = 0.70,
        include_competitors: bool = False
    ) -> PriceSuggestion:
        """
        Calculate suggested price for a property and date range.

        Args:
            property_id: Unique property identifier
            check_in: Check-in date
            check_out: Check-out date
            base_price: Base nightly rate for property
            bedrooms: Number of bedrooms (affects comp search)
            current_occupancy: Current monthly occupancy rate (0.0-1.0)
            include_competitors: Whether to fetch competitor prices

        Returns:
            PriceSuggestion with price breakdown and reasoning
        """
        stay_length = (check_out - check_in).days
        if stay_length <= 0:
            raise ValueError("Check-out must be after check-in")

        adjustments = []
        reasoning = []
        total_multiplier = 1.0

        # Get seasonal context
        season_type, season_multiplier = self.calendar.get_season(check_in)
        days_until = (check_in - date.today()).days
        day_of_week = check_in.strftime("%A").lower()

        # Build evaluation context
        context = {
            "property_id": property_id,
            "check_in": check_in,
            "check_out": check_out,
            "stay_length": stay_length,
            "days_until_checkin": days_until,
            "day_of_week": day_of_week,
            "season_type": season_type.value,
            "monthly_occupancy": current_occupancy,
            "is_vacant": days_until <= 3 and current_occupancy < 0.7,  # Simplified vacancy check
            "bedrooms": bedrooms
        }

        # Apply seasonal adjustment directly
        if season_type in [SeasonType.HOLIDAY, SeasonType.EVENT]:
            adj_percent = (season_multiplier - 1.0) * 100
            total_multiplier *= season_multiplier
            adjustments.append({
                "rule": f"{season_type.value}_adjustment",
                "percent": round(adj_percent, 1),
                "reason": f"{season_type.value.replace('_', ' ').title()} pricing"
            })
            reasoning.append(f"Applied {season_type.value} premium of {adj_percent:.0f}%")

        # Evaluate all rules
        applicable_rules = [r for r in self.rules if r.applies_to(property_id, context)]
        applicable_rules.sort(key=lambda r: r.priority, reverse=True)

        # Apply rules (higher priority can override)
        applied_types = set()
        for rule in applicable_rules:
            if rule.rule_type not in applied_types or rule.priority > 20:
                adj = rule.adjustment_percent / 100.0
                total_multiplier *= (1.0 + adj)
                adjustments.append({
                    "rule": rule.id,
                    "name": rule.name,
                    "percent": rule.adjustment_percent,
                    "priority": rule.priority
                })
                reasoning.append(f"Applied {rule.name}: {rule.adjustment_percent:+.0f}%")
                applied_types.add(rule.rule_type)

        # Calculate suggested price
        suggested_price = base_price * total_multiplier

        # Apply min/max bounds if any rule specifies them
        for rule in applicable_rules:
            if rule.min_price and suggested_price < rule.min_price:
                suggested_price = rule.min_price
                reasoning.append(f"Adjusted to minimum price ${rule.min_price:.2f}")
            if rule.max_price and suggested_price > rule.max_price:
                suggested_price = rule.max_price
                reasoning.append(f"Adjusted to maximum price ${rule.max_price:.2f}")

        # Fetch competitor prices if requested
        competitor_prices = None
        if include_competitors:
            competitor_prices = await self._get_competitor_prices(
                check_in, check_out, bedrooms
            )
            if competitor_prices:
                avg_comp = mean([c["price"] for c in competitor_prices])
                if suggested_price > avg_comp * 1.3:
                    reasoning.append(f"Warning: Price 30%+ above competitor avg (${avg_comp:.0f})")
                elif suggested_price < avg_comp * 0.7:
                    reasoning.append(f"Opportunity: Price 30%+ below competitor avg (${avg_comp:.0f})")

        # Calculate confidence based on data quality
        confidence = self._calculate_confidence(
            adjustments, competitor_prices, current_occupancy
        )

        return PriceSuggestion(
            base_price=base_price,
            suggested_price=suggested_price,
            adjustments=adjustments,
            confidence=confidence,
            reasoning=reasoning,
            competitor_prices=competitor_prices,
            historical_occupancy=current_occupancy,
            market_demand=season_type.value
        )

    async def _get_competitor_prices(
        self,
        check_in: date,
        check_out: date,
        bedrooms: int
    ) -> Optional[List[Dict[str, float]]]:
        """
        Fetch competitor prices from Airbnb/VRBO (via scraping or API).

        Note: In production, this would use official APIs or approved data sources.
        For now, returns simulated market data based on Midland patterns.
        """
        # Simulated competitor data - in production, integrate with:
        # - AirDNA API
        # - PriceLabs
        # - Wheelhouse
        # - Direct Airbnb/VRBO APIs (if available)

        season_type, multiplier = self.calendar.get_season(check_in)

        # Base Midland market rates by bedroom count (2024 data patterns)
        base_rates = {
            1: 95,
            2: 135,
            3: 175,
            4: 225,
            5: 295
        }

        base = base_rates.get(bedrooms, 150)

        # Simulate competitor variance
        import random
        competitors = []
        for i in range(5):
            variance = random.uniform(0.85, 1.25)
            price = base * multiplier * variance
            competitors.append({
                "source": f"competitor_{i+1}",
                "price": round(price, 2),
                "bedrooms": bedrooms
            })

        return competitors

    def _calculate_confidence(
        self,
        adjustments: List[Dict],
        competitor_prices: Optional[List[Dict]],
        occupancy: float
    ) -> float:
        """Calculate confidence score for price suggestion."""
        confidence = 0.7  # Base confidence

        # More adjustments = more refined (up to a point)
        if 1 <= len(adjustments) <= 4:
            confidence += 0.1
        elif len(adjustments) > 4:
            confidence -= 0.05  # Too many adjustments may conflict

        # Competitor data increases confidence
        if competitor_prices and len(competitor_prices) >= 3:
            confidence += 0.15

        # Good occupancy data
        if 0.3 <= occupancy <= 0.9:
            confidence += 0.05

        return min(0.95, max(0.3, confidence))

    async def analyze_revenue_optimization(
        self,
        property_id: str,
        period_start: date,
        period_end: date,
        current_bookings: List[Dict],
        base_price: float
    ) -> RevenueAnalysis:
        """
        Analyze revenue optimization opportunities for a property.

        Provides recommendations for:
        - Gap nights that could be filled
        - Underpriced periods
        - Overpriced periods hurting bookings
        """
        recommendations = []

        total_days = (period_end - period_start).days
        booked_days = sum(
            (b["check_out"] - b["check_in"]).days
            for b in current_bookings
            if isinstance(b.get("check_in"), date)
        )

        current_occupancy = booked_days / total_days if total_days > 0 else 0
        current_revenue = sum(b.get("total", 0) for b in current_bookings)

        # Identify gaps
        gaps = self._find_booking_gaps(period_start, period_end, current_bookings)

        for gap in gaps:
            gap_length = (gap["end"] - gap["start"]).days
            if 1 <= gap_length <= 3:
                # Short gap - last minute discount recommended
                recommendations.append({
                    "type": "gap_fill",
                    "dates": f"{gap['start']} to {gap['end']}",
                    "action": "Apply 20% last-minute discount",
                    "potential_revenue": base_price * gap_length * 0.80,
                    "priority": "high"
                })
            elif gap_length > 7:
                # Long gap - consider weekly discount
                recommendations.append({
                    "type": "long_vacancy",
                    "dates": f"{gap['start']} to {gap['end']}",
                    "action": "Promote weekly stay discount",
                    "potential_revenue": base_price * gap_length * 0.90,
                    "priority": "medium"
                })

        # Check for underpriced peak periods
        for booking in current_bookings:
            if isinstance(booking.get("check_in"), date):
                season, mult = self.calendar.get_season(booking["check_in"])
                if season in [SeasonType.PEAK_OIL, SeasonType.HOLIDAY, SeasonType.EVENT]:
                    actual_rate = booking.get("nightly_rate", 0)
                    optimal_rate = base_price * mult
                    if actual_rate < optimal_rate * 0.85:
                        recommendations.append({
                            "type": "underpriced",
                            "dates": str(booking["check_in"]),
                            "action": f"Consider raising rate for {season.value}",
                            "current_rate": actual_rate,
                            "suggested_rate": optimal_rate,
                            "priority": "low"
                        })

        # Project improved revenue
        projected_occupancy = min(0.90, current_occupancy + 0.10)
        projected_revenue = current_revenue * (projected_occupancy / current_occupancy) if current_occupancy > 0 else 0

        return RevenueAnalysis(
            property_id=property_id,
            period_start=period_start,
            period_end=period_end,
            current_revenue=current_revenue,
            projected_revenue=projected_revenue,
            projected_increase=projected_revenue - current_revenue,
            recommendations=recommendations,
            occupancy_current=current_occupancy,
            occupancy_projected=projected_occupancy,
            price_elasticity=-1.2  # Estimated for Midland market
        )

    def _find_booking_gaps(
        self,
        period_start: date,
        period_end: date,
        bookings: List[Dict]
    ) -> List[Dict[str, date]]:
        """Find gaps between bookings."""
        if not bookings:
            return [{"start": period_start, "end": period_end}]

        # Sort bookings by check-in
        sorted_bookings = sorted(
            [b for b in bookings if isinstance(b.get("check_in"), date)],
            key=lambda b: b["check_in"]
        )

        gaps = []
        current_date = period_start

        for booking in sorted_bookings:
            if booking["check_in"] > current_date:
                gaps.append({
                    "start": current_date,
                    "end": booking["check_in"]
                })
            current_date = max(current_date, booking.get("check_out", current_date))

        if current_date < period_end:
            gaps.append({
                "start": current_date,
                "end": period_end
            })

        return gaps

    def add_rule(self, rule: PricingRule) -> None:
        """Add a custom pricing rule."""
        self.rules.append(rule)
        logger.info(f"Added pricing rule: {rule.name}")

    def remove_rule(self, rule_id: str) -> bool:
        """Remove a pricing rule by ID."""
        for i, rule in enumerate(self.rules):
            if rule.id == rule_id:
                self.rules.pop(i)
                logger.info(f"Removed pricing rule: {rule_id}")
                return True
        return False

    def get_rules(self, rule_type: Optional[RuleType] = None) -> List[PricingRule]:
        """Get all pricing rules, optionally filtered by type."""
        if rule_type:
            return [r for r in self.rules if r.rule_type == rule_type]
        return self.rules

    async def generate_price_calendar(
        self,
        property_id: str,
        month: int,
        year: int,
        base_price: float,
        current_occupancy: float = 0.70
    ) -> Dict[str, Any]:
        """
        Generate a full month price calendar with suggested prices.

        Returns a calendar structure with daily prices and highlights.
        """
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)

        calendar_data = {
            "property_id": property_id,
            "month": month,
            "year": year,
            "base_price": base_price,
            "days": []
        }

        current = first_day
        while current <= last_day:
            suggestion = await self.get_suggested_price(
                property_id=property_id,
                check_in=current,
                check_out=current + timedelta(days=1),
                base_price=base_price,
                current_occupancy=current_occupancy
            )

            season, _ = self.calendar.get_season(current)

            calendar_data["days"].append({
                "date": current.isoformat(),
                "day_of_week": current.strftime("%A"),
                "base_price": base_price,
                "suggested_price": round(suggestion.suggested_price, 2),
                "adjustment_percent": round(
                    ((suggestion.suggested_price - base_price) / base_price) * 100, 1
                ),
                "season": season.value,
                "is_weekend": current.weekday() >= 4,  # Fri-Sat
                "is_peak": season in [SeasonType.PEAK_OIL, SeasonType.HOLIDAY, SeasonType.EVENT]
            })

            current += timedelta(days=1)

        # Calculate month summary
        prices = [d["suggested_price"] for d in calendar_data["days"]]
        calendar_data["summary"] = {
            "min_price": min(prices),
            "max_price": max(prices),
            "avg_price": round(mean(prices), 2),
            "peak_days": sum(1 for d in calendar_data["days"] if d["is_peak"]),
            "weekend_days": sum(1 for d in calendar_data["days"] if d["is_weekend"])
        }

        return calendar_data


# Global instance
pricing_engine = DynamicPricingEngine()


# Convenience functions
async def get_suggested_price(
    property_id: str,
    check_in: date,
    check_out: date,
    base_price: float,
    **kwargs
) -> PriceSuggestion:
    """Get suggested price for a stay."""
    return await pricing_engine.get_suggested_price(
        property_id, check_in, check_out, base_price, **kwargs
    )


async def analyze_revenue(
    property_id: str,
    period_start: date,
    period_end: date,
    bookings: List[Dict],
    base_price: float
) -> RevenueAnalysis:
    """Analyze revenue optimization opportunities."""
    return await pricing_engine.analyze_revenue_optimization(
        property_id, period_start, period_end, bookings, base_price
    )


def get_pricing_rules(rule_type: Optional[RuleType] = None) -> List[PricingRule]:
    """Get pricing rules."""
    return pricing_engine.get_rules(rule_type)


__all__ = [
    "DynamicPricingEngine",
    "pricing_engine",
    "PricingRule",
    "PriceSuggestion",
    "RevenueAnalysis",
    "RuleType",
    "SeasonType",
    "MidlandSeasonalCalendar",
    "get_suggested_price",
    "analyze_revenue",
    "get_pricing_rules"
]
