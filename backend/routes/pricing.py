"""
Dynamic Pricing API Routes for Right at Home BnB
================================================
REST API endpoints for pricing suggestions, rules, and analytics.

@author ECHO OMEGA PRIME
@location Midland, TX
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime, timedelta
from pydantic import BaseModel, Field
import logging
from enum import Enum

from database.connection import get_db
from database.models_pricing import (
    PricingRule, PriceHistory, PropertyPricingConfig,
    CompetitorPrice, RevenueAnalyticsSnapshot, MidlandEvent,
    RuleTypeEnum, SeasonTypeEnum
)
from services.pricing_service import (
    pricing_engine, get_suggested_price, analyze_revenue,
    PriceSuggestion, RevenueAnalysis, MidlandSeasonalCalendar
)

logger = logging.getLogger("RightAtHomeBnB.Pricing")

router = APIRouter()


# =============================================================================
# PYDANTIC SCHEMAS
# =============================================================================

class PriceSuggestionRequest(BaseModel):
    """Request for price suggestion."""
    property_id: str
    check_in: date
    check_out: date
    base_price: float
    bedrooms: int = 2
    current_occupancy: float = Field(default=0.70, ge=0.0, le=1.0)
    include_competitors: bool = False


class PriceSuggestionResponse(BaseModel):
    """Price suggestion response."""
    base_price: float
    suggested_price: float
    adjustments: List[dict]
    confidence: float
    reasoning: List[str]
    competitor_prices: Optional[List[dict]] = None
    historical_occupancy: Optional[float] = None
    market_demand: Optional[str] = None
    total_adjustment_percent: float


class PricingRuleCreate(BaseModel):
    """Create a new pricing rule."""
    id: str = Field(..., min_length=3, max_length=50)
    name: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    rule_type: str  # RuleTypeEnum value
    adjustment_percent: float = Field(..., ge=-100.0, le=200.0)
    priority: int = Field(default=0, ge=0, le=100)
    conditions: List[dict] = []
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    property_ids: Optional[List[str]] = None
    active: bool = True
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class PricingRuleUpdate(BaseModel):
    """Update a pricing rule."""
    name: Optional[str] = None
    description: Optional[str] = None
    adjustment_percent: Optional[float] = None
    priority: Optional[int] = None
    conditions: Optional[List[dict]] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    property_ids: Optional[List[str]] = None
    active: Optional[bool] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class PropertyPricingConfigCreate(BaseModel):
    """Create property pricing configuration."""
    property_id: str
    base_nightly_rate: float
    weekend_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    min_nightly_rate: Optional[float] = None
    max_nightly_rate: Optional[float] = None
    auto_pricing_enabled: bool = True
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    sleeps: Optional[int] = None
    property_type: Optional[str] = None


class RevenueAnalysisRequest(BaseModel):
    """Request for revenue analysis."""
    property_id: str
    period_start: date
    period_end: date
    base_price: float
    bookings: List[dict] = []


class CalendarRequest(BaseModel):
    """Request for price calendar."""
    property_id: str
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2024, le=2030)
    base_price: float
    current_occupancy: float = Field(default=0.70, ge=0.0, le=1.0)


class MidlandEventCreate(BaseModel):
    """Create a Midland event."""
    name: str
    description: Optional[str] = None
    start_date: date
    end_date: date
    event_type: Optional[str] = None
    price_multiplier: float = Field(default=1.0, ge=0.5, le=3.0)
    expected_demand: str = "normal"
    venue: Optional[str] = None
    address: Optional[str] = None
    source_url: Optional[str] = None


# =============================================================================
# PRICE SUGGESTION ENDPOINTS
# =============================================================================

@router.get("/property/{property_id}/suggest")
async def get_price_suggestion(
    property_id: str,
    check_in: date,
    check_out: date,
    base_price: Optional[float] = None,
    include_competitors: bool = False,
    db: Session = Depends(get_db)
):
    """
    Get suggested price for a property and date range.

    Considers:
    - Seasonal patterns (oil field busy seasons)
    - Weekend premiums
    - Last-minute availability
    - Current occupancy
    - Local events
    - Competitor pricing (if enabled)
    """
    # Get base price from config if not provided
    if base_price is None:
        config = db.query(PropertyPricingConfig).filter(
            PropertyPricingConfig.property_id == property_id
        ).first()
        if config:
            base_price = config.base_nightly_rate
        else:
            raise HTTPException(
                status_code=400,
                detail="base_price required - no property config found"
            )

    # Get property config for additional parameters
    config = db.query(PropertyPricingConfig).filter(
        PropertyPricingConfig.property_id == property_id
    ).first()

    bedrooms = config.bedrooms if config else 2
    current_occupancy = 0.70  # TODO: Calculate from actual bookings

    try:
        suggestion = await get_suggested_price(
            property_id=property_id,
            check_in=check_in,
            check_out=check_out,
            base_price=base_price,
            bedrooms=bedrooms,
            current_occupancy=current_occupancy,
            include_competitors=include_competitors
        )

        # Log to history
        history = PriceHistory(
            property_id=property_id,
            date=check_in,
            base_price=base_price,
            suggested_price=suggestion.suggested_price,
            season_type=SeasonTypeEnum(suggestion.market_demand) if suggestion.market_demand else None,
            occupancy_rate=current_occupancy,
            days_until_checkin=(check_in - date.today()).days,
            adjustments_applied=suggestion.adjustments,
            confidence_score=suggestion.confidence,
            source="dynamic_engine"
        )

        if suggestion.competitor_prices:
            prices = [c["price"] for c in suggestion.competitor_prices]
            history.competitor_avg = sum(prices) / len(prices)
            history.competitor_min = min(prices)
            history.competitor_max = max(prices)

        db.add(history)
        db.commit()

        return suggestion.to_dict()

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Price suggestion error: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate price")


@router.post("/suggest/batch")
async def get_batch_suggestions(
    requests: List[PriceSuggestionRequest],
    db: Session = Depends(get_db)
):
    """Get price suggestions for multiple properties/dates at once."""
    results = []
    for req in requests:
        try:
            suggestion = await get_suggested_price(
                property_id=req.property_id,
                check_in=req.check_in,
                check_out=req.check_out,
                base_price=req.base_price,
                bedrooms=req.bedrooms,
                current_occupancy=req.current_occupancy,
                include_competitors=req.include_competitors
            )
            results.append({
                "property_id": req.property_id,
                "check_in": req.check_in.isoformat(),
                "success": True,
                "suggestion": suggestion.to_dict()
            })
        except Exception as e:
            results.append({
                "property_id": req.property_id,
                "check_in": req.check_in.isoformat(),
                "success": False,
                "error": str(e)
            })

    return {"results": results, "total": len(results)}


# =============================================================================
# PRICE CALENDAR ENDPOINTS
# =============================================================================

@router.get("/property/{property_id}/calendar")
async def get_price_calendar(
    property_id: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2024, le=2030),
    base_price: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """
    Get a full month price calendar with suggested prices.

    Returns daily prices with highlighting for:
    - Peak oil field seasons
    - Holidays
    - Local events
    - Weekends
    """
    # Get base price from config if not provided
    if base_price is None:
        config = db.query(PropertyPricingConfig).filter(
            PropertyPricingConfig.property_id == property_id
        ).first()
        if config:
            base_price = config.base_nightly_rate
        else:
            raise HTTPException(
                status_code=400,
                detail="base_price required - no property config found"
            )

    try:
        calendar = await pricing_engine.generate_price_calendar(
            property_id=property_id,
            month=month,
            year=year,
            base_price=base_price
        )

        # Add any local events from database
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)

        events = db.query(MidlandEvent).filter(
            MidlandEvent.start_date <= last_day,
            MidlandEvent.end_date >= first_day
        ).all()

        calendar["events"] = [e.to_dict() for e in events]

        return calendar

    except Exception as e:
        logger.error(f"Calendar generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate calendar")


# =============================================================================
# PRICING RULES ENDPOINTS
# =============================================================================

@router.get("/rules")
async def list_pricing_rules(
    rule_type: Optional[str] = None,
    active_only: bool = True,
    property_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all pricing rules with optional filtering."""
    query = db.query(PricingRule)

    if active_only:
        query = query.filter(PricingRule.active == True)

    if rule_type:
        try:
            rule_type_enum = RuleTypeEnum(rule_type)
            query = query.filter(PricingRule.rule_type == rule_type_enum)
        except ValueError:
            pass

    rules = query.order_by(PricingRule.priority.desc()).all()

    # Filter by property if specified
    if property_id:
        rules = [
            r for r in rules
            if r.property_ids is None or property_id in r.property_ids
        ]

    return {
        "rules": [r.to_dict() for r in rules],
        "total": len(rules)
    }


@router.get("/rules/{rule_id}")
async def get_pricing_rule(rule_id: str, db: Session = Depends(get_db)):
    """Get a specific pricing rule by ID."""
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule.to_dict()


@router.post("/rules")
async def create_pricing_rule(rule: PricingRuleCreate, db: Session = Depends(get_db)):
    """Create a new pricing rule."""
    # Check for duplicate ID
    existing = db.query(PricingRule).filter(PricingRule.id == rule.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Rule ID already exists")

    try:
        rule_type_enum = RuleTypeEnum(rule.rule_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid rule_type. Valid values: {[e.value for e in RuleTypeEnum]}"
        )

    db_rule = PricingRule(
        id=rule.id,
        name=rule.name,
        description=rule.description,
        rule_type=rule_type_enum,
        adjustment_percent=rule.adjustment_percent,
        priority=rule.priority,
        conditions=rule.conditions,
        min_price=rule.min_price,
        max_price=rule.max_price,
        property_ids=rule.property_ids,
        active=rule.active,
        start_date=rule.start_date,
        end_date=rule.end_date,
        created_by="api"
    )

    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)

    # Add to in-memory engine
    from services.pricing_service import PricingRule as EngineRule, PricingCondition, RuleType
    engine_rule = EngineRule(
        id=rule.id,
        name=rule.name,
        rule_type=RuleType(rule.rule_type),
        adjustment_percent=rule.adjustment_percent,
        priority=rule.priority,
        conditions=[
            PricingCondition(c["field"], c["operator"], c["value"])
            for c in rule.conditions
        ],
        min_price=rule.min_price,
        max_price=rule.max_price,
        property_ids=rule.property_ids,
        active=rule.active
    )
    pricing_engine.add_rule(engine_rule)

    logger.info(f"Created pricing rule: {rule.id}")
    return db_rule.to_dict()


@router.put("/rules/{rule_id}")
async def update_pricing_rule(
    rule_id: str,
    update: PricingRuleUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing pricing rule."""
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    update_data = update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    db.commit()
    db.refresh(rule)

    logger.info(f"Updated pricing rule: {rule_id}")
    return rule.to_dict()


@router.delete("/rules/{rule_id}")
async def delete_pricing_rule(rule_id: str, db: Session = Depends(get_db)):
    """Delete a pricing rule."""
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db.delete(rule)
    db.commit()

    # Remove from in-memory engine
    pricing_engine.remove_rule(rule_id)

    logger.info(f"Deleted pricing rule: {rule_id}")
    return {"message": f"Rule {rule_id} deleted"}


# =============================================================================
# PROPERTY PRICING CONFIG ENDPOINTS
# =============================================================================

@router.get("/config/{property_id}")
async def get_property_config(property_id: str, db: Session = Depends(get_db)):
    """Get pricing configuration for a property."""
    config = db.query(PropertyPricingConfig).filter(
        PropertyPricingConfig.property_id == property_id
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="Property config not found")

    return config.to_dict()


@router.post("/config")
async def create_property_config(
    config: PropertyPricingConfigCreate,
    db: Session = Depends(get_db)
):
    """Create pricing configuration for a property."""
    existing = db.query(PropertyPricingConfig).filter(
        PropertyPricingConfig.property_id == config.property_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Config already exists. Use PUT to update."
        )

    db_config = PropertyPricingConfig(**config.dict())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)

    logger.info(f"Created pricing config for property: {config.property_id}")
    return db_config.to_dict()


@router.put("/config/{property_id}")
async def update_property_config(
    property_id: str,
    config: PropertyPricingConfigCreate,
    db: Session = Depends(get_db)
):
    """Update pricing configuration for a property."""
    existing = db.query(PropertyPricingConfig).filter(
        PropertyPricingConfig.property_id == property_id
    ).first()

    if not existing:
        # Create if doesn't exist
        db_config = PropertyPricingConfig(**config.dict())
        db.add(db_config)
    else:
        for field, value in config.dict().items():
            setattr(existing, field, value)
        db_config = existing

    db.commit()
    db.refresh(db_config)

    return db_config.to_dict()


# =============================================================================
# REVENUE ANALYSIS ENDPOINTS
# =============================================================================

@router.get("/analysis")
async def get_revenue_analysis(
    property_id: str,
    period_start: date,
    period_end: date,
    db: Session = Depends(get_db)
):
    """
    Get revenue optimization analysis for a property.

    Analyzes:
    - Gap nights that could be filled
    - Underpriced periods
    - Overpriced periods hurting bookings
    - Competitor positioning
    """
    # Get property config
    config = db.query(PropertyPricingConfig).filter(
        PropertyPricingConfig.property_id == property_id
    ).first()

    if not config:
        raise HTTPException(
            status_code=404,
            detail="Property config not found"
        )

    # Get price history for period
    history = db.query(PriceHistory).filter(
        PriceHistory.property_id == property_id,
        PriceHistory.date >= period_start,
        PriceHistory.date <= period_end
    ).all()

    # Build bookings from history
    bookings = [
        {
            "check_in": h.date,
            "check_out": h.date + timedelta(days=1),
            "nightly_rate": h.actual_price or h.suggested_price,
            "total": h.actual_price or h.suggested_price
        }
        for h in history if h.booked
    ]

    try:
        analysis = await analyze_revenue(
            property_id=property_id,
            period_start=period_start,
            period_end=period_end,
            bookings=bookings,
            base_price=config.base_nightly_rate
        )

        return {
            "property_id": analysis.property_id,
            "period": {
                "start": analysis.period_start.isoformat(),
                "end": analysis.period_end.isoformat()
            },
            "revenue": {
                "current": analysis.current_revenue,
                "projected": analysis.projected_revenue,
                "increase": analysis.projected_increase
            },
            "occupancy": {
                "current": analysis.occupancy_current,
                "projected": analysis.occupancy_projected
            },
            "price_elasticity": analysis.price_elasticity,
            "recommendations": analysis.recommendations
        }

    except Exception as e:
        logger.error(f"Revenue analysis error: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze revenue")


@router.get("/analysis/portfolio")
async def get_portfolio_analysis(
    period_start: date,
    period_end: date,
    db: Session = Depends(get_db)
):
    """Get revenue analysis for entire portfolio."""
    configs = db.query(PropertyPricingConfig).all()

    if not configs:
        return {
            "message": "No properties configured",
            "properties": []
        }

    results = []
    for config in configs:
        try:
            history = db.query(PriceHistory).filter(
                PriceHistory.property_id == config.property_id,
                PriceHistory.date >= period_start,
                PriceHistory.date <= period_end
            ).all()

            booked_count = sum(1 for h in history if h.booked)
            total_revenue = sum(
                h.actual_price or h.suggested_price
                for h in history if h.booked
            )

            results.append({
                "property_id": config.property_id,
                "base_rate": config.base_nightly_rate,
                "total_nights": len(history),
                "booked_nights": booked_count,
                "occupancy": booked_count / len(history) if history else 0,
                "revenue": total_revenue
            })
        except Exception as e:
            logger.error(f"Error analyzing {config.property_id}: {e}")

    total_revenue = sum(r["revenue"] for r in results)
    avg_occupancy = (
        sum(r["occupancy"] for r in results) / len(results)
        if results else 0
    )

    return {
        "period": {
            "start": period_start.isoformat(),
            "end": period_end.isoformat()
        },
        "portfolio_summary": {
            "total_properties": len(results),
            "total_revenue": total_revenue,
            "average_occupancy": round(avg_occupancy, 2)
        },
        "properties": results
    }


# =============================================================================
# PRICE HISTORY ENDPOINTS
# =============================================================================

@router.get("/history/{property_id}")
async def get_price_history(
    property_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db)
):
    """Get price history for a property."""
    query = db.query(PriceHistory).filter(
        PriceHistory.property_id == property_id
    )

    if start_date:
        query = query.filter(PriceHistory.date >= start_date)
    if end_date:
        query = query.filter(PriceHistory.date <= end_date)

    history = query.order_by(PriceHistory.date.desc()).limit(limit).all()

    return {
        "property_id": property_id,
        "history": [h.to_dict() for h in history],
        "total": len(history)
    }


@router.post("/history/{property_id}/actual")
async def record_actual_price(
    property_id: str,
    date_: date,
    actual_price: float,
    booked: bool = False,
    db: Session = Depends(get_db)
):
    """Record the actual price set/booked for a date."""
    history = db.query(PriceHistory).filter(
        PriceHistory.property_id == property_id,
        PriceHistory.date == date_
    ).first()

    if history:
        history.actual_price = actual_price
        history.booked = booked
        history.revenue_impact = actual_price - history.suggested_price
    else:
        history = PriceHistory(
            property_id=property_id,
            date=date_,
            base_price=actual_price,  # Assume actual is base if no suggestion
            suggested_price=actual_price,
            actual_price=actual_price,
            booked=booked,
            source="manual"
        )
        db.add(history)

    db.commit()

    return {"message": "Actual price recorded", "date": date_.isoformat()}


# =============================================================================
# MIDLAND EVENTS ENDPOINTS
# =============================================================================

@router.get("/events")
async def list_midland_events(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    event_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List Midland events affecting pricing."""
    query = db.query(MidlandEvent)

    if start_date:
        query = query.filter(MidlandEvent.end_date >= start_date)
    if end_date:
        query = query.filter(MidlandEvent.start_date <= end_date)
    if event_type:
        query = query.filter(MidlandEvent.event_type == event_type)

    events = query.order_by(MidlandEvent.start_date).all()

    return {
        "events": [e.to_dict() for e in events],
        "total": len(events)
    }


@router.post("/events")
async def create_midland_event(event: MidlandEventCreate, db: Session = Depends(get_db)):
    """Create a new Midland event."""
    db_event = MidlandEvent(**event.dict())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    logger.info(f"Created Midland event: {event.name}")
    return db_event.to_dict()


@router.get("/events/{event_id}")
async def get_midland_event(event_id: int, db: Session = Depends(get_db)):
    """Get a specific Midland event."""
    event = db.query(MidlandEvent).filter(MidlandEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event.to_dict()


@router.delete("/events/{event_id}")
async def delete_midland_event(event_id: int, db: Session = Depends(get_db)):
    """Delete a Midland event."""
    event = db.query(MidlandEvent).filter(MidlandEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()

    return {"message": f"Event {event_id} deleted"}


# =============================================================================
# COMPETITOR PRICING ENDPOINTS
# =============================================================================

@router.get("/competitors/{property_id}")
async def get_competitor_prices(
    property_id: str,
    date_: Optional[date] = None,
    days: int = Query(default=30, le=90),
    db: Session = Depends(get_db)
):
    """Get competitor pricing data for a property."""
    start_date = date_ or date.today()
    end_date = start_date + timedelta(days=days)

    prices = db.query(CompetitorPrice).filter(
        CompetitorPrice.property_id == property_id,
        CompetitorPrice.date >= start_date,
        CompetitorPrice.date <= end_date
    ).order_by(CompetitorPrice.date).all()

    if not prices:
        return {
            "property_id": property_id,
            "message": "No competitor data available",
            "data": []
        }

    # Aggregate by date
    by_date = {}
    for p in prices:
        d = p.date.isoformat()
        if d not in by_date:
            by_date[d] = []
        by_date[d].append(p.to_dict())

    return {
        "property_id": property_id,
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        },
        "data": by_date
    }


@router.post("/competitors/fetch")
async def fetch_competitor_prices(
    property_id: str,
    check_in: date,
    check_out: date,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Trigger a competitor price fetch (runs in background).

    Note: In production, this would use official APIs or approved data sources.
    """
    # Get property config for bedrooms
    config = db.query(PropertyPricingConfig).filter(
        PropertyPricingConfig.property_id == property_id
    ).first()

    bedrooms = config.bedrooms if config else 2

    # This would be the actual competitor scraping/API call
    # For now, just log that it was requested
    logger.info(f"Competitor fetch requested: {property_id}, {check_in} to {check_out}")

    return {
        "message": "Competitor price fetch queued",
        "property_id": property_id,
        "check_in": check_in.isoformat(),
        "check_out": check_out.isoformat()
    }


# =============================================================================
# SEASONAL DATA ENDPOINTS
# =============================================================================

@router.get("/seasons/{year}")
async def get_seasonal_calendar(year: int = Query(..., ge=2024, le=2030)):
    """
    Get the seasonal calendar for Midland, TX oil field patterns.

    Returns daily season types for the entire year.
    """
    calendar = MidlandSeasonalCalendar()
    result = []

    current = date(year, 1, 1)
    end = date(year, 12, 31)

    while current <= end:
        season_type, multiplier = calendar.get_season(current)
        result.append({
            "date": current.isoformat(),
            "season": season_type.value,
            "multiplier": multiplier
        })
        current += timedelta(days=1)

    # Summarize
    season_counts = {}
    for r in result:
        s = r["season"]
        season_counts[s] = season_counts.get(s, 0) + 1

    return {
        "year": year,
        "summary": season_counts,
        "calendar": result
    }


@router.get("/seasons/current")
async def get_current_season():
    """Get the current season and pricing context."""
    calendar = MidlandSeasonalCalendar()
    today = date.today()
    season_type, multiplier = calendar.get_season(today)

    # Get next 7 days
    upcoming = []
    for i in range(7):
        d = today + timedelta(days=i)
        s, m = calendar.get_season(d)
        upcoming.append({
            "date": d.isoformat(),
            "day": d.strftime("%A"),
            "season": s.value,
            "multiplier": m
        })

    return {
        "today": today.isoformat(),
        "current_season": season_type.value,
        "current_multiplier": multiplier,
        "is_weekend": today.weekday() >= 4,
        "upcoming": upcoming
    }
