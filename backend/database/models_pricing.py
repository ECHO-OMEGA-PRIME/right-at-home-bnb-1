"""
Dynamic Pricing Models for Right at Home BnB
============================================
SQLAlchemy models for pricing rules, history, and analytics.

@author ECHO OMEGA PRIME
@location Midland, TX
"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Date, DateTime,
    ForeignKey, Text, JSON, Enum, Index, CheckConstraint, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum
from .connection import Base


class RuleTypeEnum(enum.Enum):
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


class SeasonTypeEnum(enum.Enum):
    """Midland TX oil field seasonal patterns."""
    PEAK_OIL = "peak_oil"
    MODERATE_OIL = "moderate_oil"
    LOW_OIL = "low_oil"
    HOLIDAY = "holiday"
    EVENT = "event"


class PricingRule(Base):
    """
    Pricing rules for dynamic rate adjustments.

    Rules can apply globally or to specific properties.
    Multiple conditions can be combined with AND logic.
    """
    __tablename__ = "pricing_rules"

    id = Column(String(50), primary_key=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)

    # Rule configuration
    rule_type = Column(Enum(RuleTypeEnum), nullable=False, index=True)
    adjustment_percent = Column(Float, nullable=False)  # -20.0 = 20% discount, +30.0 = 30% surcharge
    priority = Column(Integer, default=0)  # Higher = applied later, can override

    # Conditions (JSON array of condition objects)
    # Format: [{"field": "day_of_week", "operator": "in", "value": ["friday", "saturday"]}]
    conditions = Column(JSON, default=list)

    # Price bounds
    min_price = Column(Float)  # Minimum price when rule applies
    max_price = Column(Float)  # Maximum price when rule applies

    # Scope - null means global
    property_ids = Column(JSON)  # List of property IDs this rule applies to

    # Status
    active = Column(Boolean, default=True, index=True)
    start_date = Column(Date)  # Rule active from (optional)
    end_date = Column(Date)    # Rule active until (optional)

    # Metadata
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(String(100))

    # Relationships
    history = relationship("PriceHistory", back_populates="rule_applied", lazy="dynamic")

    # Indexes
    __table_args__ = (
        Index('ix_pricing_rules_active_type', 'active', 'rule_type'),
        Index('ix_pricing_rules_dates', 'start_date', 'end_date'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "rule_type": self.rule_type.value if self.rule_type else None,
            "adjustment_percent": self.adjustment_percent,
            "priority": self.priority,
            "conditions": self.conditions or [],
            "min_price": self.min_price,
            "max_price": self.max_price,
            "property_ids": self.property_ids,
            "active": self.active,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by
        }


class PriceHistory(Base):
    """
    Historical record of suggested and actual prices.

    Tracks pricing decisions over time for analytics and optimization.
    """
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Property and date
    property_id = Column(String(50), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)

    # Pricing data
    base_price = Column(Float, nullable=False)
    suggested_price = Column(Float, nullable=False)
    actual_price = Column(Float)  # What was actually set/booked
    booked = Column(Boolean, default=False)  # Was this date booked?

    # Context
    season_type = Column(Enum(SeasonTypeEnum))
    occupancy_rate = Column(Float)  # Monthly occupancy at time of pricing
    days_until_checkin = Column(Integer)  # How far in advance

    # Rule tracking
    rule_applied_id = Column(String(50), ForeignKey("pricing_rules.id"))
    rule_applied = relationship("PricingRule", back_populates="history")
    adjustments_applied = Column(JSON)  # Full breakdown of all adjustments

    # Competitor data (if fetched)
    competitor_avg = Column(Float)
    competitor_min = Column(Float)
    competitor_max = Column(Float)

    # Performance metrics
    confidence_score = Column(Float)  # Algorithm confidence 0.0-1.0
    revenue_impact = Column(Float)  # Calculated revenue vs base rate

    # Metadata
    created_at = Column(DateTime, server_default=func.now())
    source = Column(String(50), default="dynamic_engine")  # dynamic_engine, manual, competitor

    # Indexes for analytics
    __table_args__ = (
        Index('ix_price_history_property_date', 'property_id', 'date'),
        Index('ix_price_history_booked', 'booked', 'date'),
        Index('ix_price_history_season', 'season_type', 'date'),
        UniqueConstraint('property_id', 'date', name='uq_price_history_property_date'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "property_id": self.property_id,
            "date": self.date.isoformat() if self.date else None,
            "base_price": self.base_price,
            "suggested_price": self.suggested_price,
            "actual_price": self.actual_price,
            "booked": self.booked,
            "season_type": self.season_type.value if self.season_type else None,
            "occupancy_rate": self.occupancy_rate,
            "days_until_checkin": self.days_until_checkin,
            "rule_applied_id": self.rule_applied_id,
            "adjustments_applied": self.adjustments_applied,
            "competitor_avg": self.competitor_avg,
            "competitor_min": self.competitor_min,
            "competitor_max": self.competitor_max,
            "confidence_score": self.confidence_score,
            "revenue_impact": self.revenue_impact,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "source": self.source
        }


class PropertyPricingConfig(Base):
    """
    Per-property pricing configuration.

    Stores base rates, seasonal multipliers, and property-specific settings.
    """
    __tablename__ = "property_pricing_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String(50), nullable=False, unique=True, index=True)

    # Base rates
    base_nightly_rate = Column(Float, nullable=False)
    weekend_rate = Column(Float)  # Override for Fri-Sat, null = use rules
    weekly_rate = Column(Float)   # 7+ nights
    monthly_rate = Column(Float)  # 30+ nights

    # Rate bounds
    min_nightly_rate = Column(Float)  # Never go below
    max_nightly_rate = Column(Float)  # Never exceed

    # Seasonal multipliers (override defaults)
    peak_oil_multiplier = Column(Float, default=1.25)
    low_oil_multiplier = Column(Float, default=0.90)
    holiday_multiplier = Column(Float, default=1.20)
    event_multiplier = Column(Float, default=1.30)

    # Automation settings
    auto_pricing_enabled = Column(Boolean, default=True)
    auto_pricing_aggressiveness = Column(Float, default=0.5)  # 0.0 = conservative, 1.0 = aggressive
    competitor_tracking_enabled = Column(Boolean, default=True)

    # Last-minute settings
    last_minute_discount_enabled = Column(Boolean, default=True)
    last_minute_discount_percent = Column(Float, default=15.0)
    last_minute_days_threshold = Column(Integer, default=3)

    # Long-stay settings
    weekly_discount_percent = Column(Float, default=10.0)
    monthly_discount_percent = Column(Float, default=25.0)

    # Property characteristics affecting pricing
    bedrooms = Column(Integer)
    bathrooms = Column(Float)
    sleeps = Column(Integer)
    property_type = Column(String(50))  # house, apartment, condo

    # Metadata
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "property_id": self.property_id,
            "base_nightly_rate": self.base_nightly_rate,
            "weekend_rate": self.weekend_rate,
            "weekly_rate": self.weekly_rate,
            "monthly_rate": self.monthly_rate,
            "min_nightly_rate": self.min_nightly_rate,
            "max_nightly_rate": self.max_nightly_rate,
            "peak_oil_multiplier": self.peak_oil_multiplier,
            "low_oil_multiplier": self.low_oil_multiplier,
            "holiday_multiplier": self.holiday_multiplier,
            "event_multiplier": self.event_multiplier,
            "auto_pricing_enabled": self.auto_pricing_enabled,
            "auto_pricing_aggressiveness": self.auto_pricing_aggressiveness,
            "competitor_tracking_enabled": self.competitor_tracking_enabled,
            "last_minute_discount_enabled": self.last_minute_discount_enabled,
            "last_minute_discount_percent": self.last_minute_discount_percent,
            "last_minute_days_threshold": self.last_minute_days_threshold,
            "weekly_discount_percent": self.weekly_discount_percent,
            "monthly_discount_percent": self.monthly_discount_percent,
            "bedrooms": self.bedrooms,
            "bathrooms": self.bathrooms,
            "sleeps": self.sleeps,
            "property_type": self.property_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class CompetitorPrice(Base):
    """
    Competitor pricing data for market analysis.

    Tracks prices from Airbnb, VRBO, and other platforms.
    """
    __tablename__ = "competitor_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Reference property (ours, for comparison)
    property_id = Column(String(50), index=True)

    # Competitor info
    competitor_source = Column(String(50), nullable=False)  # airbnb, vrbo, booking
    competitor_listing_id = Column(String(100))
    competitor_name = Column(String(200))

    # Pricing
    date = Column(Date, nullable=False, index=True)
    nightly_price = Column(Float, nullable=False)
    cleaning_fee = Column(Float)
    service_fee = Column(Float)
    total_price = Column(Float)  # For a typical stay

    # Listing details
    bedrooms = Column(Integer)
    bathrooms = Column(Float)
    sleeps = Column(Integer)
    distance_miles = Column(Float)  # Distance from our property

    # Availability
    available = Column(Boolean, default=True)
    minimum_nights = Column(Integer)

    # Metadata
    fetched_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('ix_competitor_prices_property_date', 'property_id', 'date'),
        Index('ix_competitor_prices_source_date', 'competitor_source', 'date'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "property_id": self.property_id,
            "competitor_source": self.competitor_source,
            "competitor_listing_id": self.competitor_listing_id,
            "competitor_name": self.competitor_name,
            "date": self.date.isoformat() if self.date else None,
            "nightly_price": self.nightly_price,
            "cleaning_fee": self.cleaning_fee,
            "service_fee": self.service_fee,
            "total_price": self.total_price,
            "bedrooms": self.bedrooms,
            "bathrooms": self.bathrooms,
            "sleeps": self.sleeps,
            "distance_miles": self.distance_miles,
            "available": self.available,
            "minimum_nights": self.minimum_nights,
            "fetched_at": self.fetched_at.isoformat() if self.fetched_at else None
        }


class RevenueAnalyticsSnapshot(Base):
    """
    Periodic snapshots of revenue analytics.

    Used for reporting and trend analysis.
    """
    __tablename__ = "revenue_analytics_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Scope
    property_id = Column(String(50), index=True)  # Null = portfolio-wide
    period_type = Column(String(20), nullable=False)  # daily, weekly, monthly, yearly
    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False)

    # Revenue metrics
    total_revenue = Column(Float, default=0)
    booking_revenue = Column(Float, default=0)
    cleaning_fee_revenue = Column(Float, default=0)
    other_revenue = Column(Float, default=0)

    # Occupancy metrics
    total_nights = Column(Integer)
    booked_nights = Column(Integer)
    occupancy_rate = Column(Float)

    # Pricing metrics
    avg_nightly_rate = Column(Float)
    avg_booked_rate = Column(Float)  # Only for booked nights
    revpar = Column(Float)  # Revenue per available night

    # Dynamic pricing performance
    suggested_vs_actual_variance = Column(Float)  # Avg difference
    auto_priced_bookings = Column(Integer)
    manual_priced_bookings = Column(Integer)
    pricing_confidence_avg = Column(Float)

    # Competitor comparison
    avg_competitor_price = Column(Float)
    price_position = Column(String(20))  # below_market, at_market, above_market

    # Forecasts
    projected_revenue_next_period = Column(Float)
    projected_occupancy_next_period = Column(Float)

    # Recommendations count
    recommendations_count = Column(Integer, default=0)
    recommendations_implemented = Column(Integer, default=0)

    # Metadata
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('ix_revenue_analytics_property_period', 'property_id', 'period_type', 'period_start'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "property_id": self.property_id,
            "period_type": self.period_type,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "total_revenue": self.total_revenue,
            "booking_revenue": self.booking_revenue,
            "cleaning_fee_revenue": self.cleaning_fee_revenue,
            "other_revenue": self.other_revenue,
            "total_nights": self.total_nights,
            "booked_nights": self.booked_nights,
            "occupancy_rate": self.occupancy_rate,
            "avg_nightly_rate": self.avg_nightly_rate,
            "avg_booked_rate": self.avg_booked_rate,
            "revpar": self.revpar,
            "suggested_vs_actual_variance": self.suggested_vs_actual_variance,
            "auto_priced_bookings": self.auto_priced_bookings,
            "manual_priced_bookings": self.manual_priced_bookings,
            "pricing_confidence_avg": self.pricing_confidence_avg,
            "avg_competitor_price": self.avg_competitor_price,
            "price_position": self.price_position,
            "projected_revenue_next_period": self.projected_revenue_next_period,
            "projected_occupancy_next_period": self.projected_occupancy_next_period,
            "recommendations_count": self.recommendations_count,
            "recommendations_implemented": self.recommendations_implemented,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class MidlandEvent(Base):
    """
    Local Midland, TX events that affect pricing.

    Tracks oil industry events, rodeos, conferences, etc.
    """
    __tablename__ = "midland_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)

    # Dates
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False)

    # Event type
    event_type = Column(String(50))  # oil_show, rodeo, conference, festival, sports

    # Pricing impact
    price_multiplier = Column(Float, default=1.0)
    expected_demand = Column(String(20))  # low, normal, high, very_high

    # Location
    venue = Column(String(200))
    address = Column(String(500))

    # Source
    source_url = Column(String(500))
    verified = Column(Boolean, default=False)

    # Metadata
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('ix_midland_events_dates', 'start_date', 'end_date'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "event_type": self.event_type,
            "price_multiplier": self.price_multiplier,
            "expected_demand": self.expected_demand,
            "venue": self.venue,
            "address": self.address,
            "source_url": self.source_url,
            "verified": self.verified,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


# Export all models
__all__ = [
    "PricingRule",
    "PriceHistory",
    "PropertyPricingConfig",
    "CompetitorPrice",
    "RevenueAnalyticsSnapshot",
    "MidlandEvent",
    "RuleTypeEnum",
    "SeasonTypeEnum"
]
