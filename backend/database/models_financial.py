"""
Right At Home BnB - Financial Intelligence Models
==================================================
Enhanced models for:
- Tax-categorized expenses (CPA-ready)
- Gap-Filler special offers
- RevPAR analytics
- Weather-triggered operations
- Sovereignty metrics (OTA savings)

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Enum, Date, Numeric, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from .connection import Base


# ============================================================================
# ENUMS - Financial & Operations
# ============================================================================

class TaxCategory(str, enum.Enum):
    """IRS Schedule E tax categories for rental properties."""
    ADVERTISING = "advertising"
    AUTO_TRAVEL = "auto_travel"
    CLEANING_MAINTENANCE = "cleaning_maintenance"
    COMMISSIONS = "commissions"
    INSURANCE = "insurance"
    LEGAL_PROFESSIONAL = "legal_professional"
    MANAGEMENT_FEES = "management_fees"
    MORTGAGE_INTEREST = "mortgage_interest"
    OTHER_INTEREST = "other_interest"
    REPAIRS = "repairs"
    SUPPLIES = "supplies"
    TAXES = "taxes"
    UTILITIES = "utilities"
    DEPRECIATION = "depreciation"
    PEST_CONTROL = "pest_control"  # Bug spray, exterminator, insect removal
    LANDSCAPING = "landscaping"  # Lawn care, tree trimming
    POOL_SERVICE = "pool_service"  # Pool maintenance, chemicals
    HVAC_SERVICE = "hvac_service"  # AC repair, filter replacement
    SECURITY = "security"  # Cameras, locks, alarm service
    TRASH_REMOVAL = "trash_removal"  # Dumpster, waste service
    CARPET_FLOORING = "carpet_flooring"  # Carpet cleaning, floor repairs
    APPLIANCE_REPAIR = "appliance_repair"  # Washer, dryer, dishwasher
    PLUMBING = "plumbing"  # Pipe repair, water heater
    ELECTRICAL = "electrical"  # Wiring, outlets, lighting
    ROOF_EXTERIOR = "roof_exterior"  # Roof repair, siding, paint
    FURNITURE = "furniture"  # Replacement furniture, mattresses
    LINENS_TOWELS = "linens_towels"  # Bedding, towels, pillows
    AMENITIES = "amenities"  # Coffee, toiletries, consumables
    NA = "na"  # Not applicable / None
    OTHER = "other"


class SpecialOfferType(str, enum.Enum):
    """Types of special pricing offers."""
    GAP_FILLER = "gap_filler"  # Auto-generated for 2-3 day gaps
    LAST_MINUTE = "last_minute"  # Within 48 hours
    EXTENDED_STAY = "extended_stay"  # 7+ night discount
    SEASONAL = "seasonal"  # Holiday/event pricing
    LOYALTY = "loyalty"  # Repeat guest discount
    MANUAL = "manual"  # Owner-set discount


class AlertSeverity(str, enum.Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class AlertType(str, enum.Enum):
    """Types of system alerts."""
    WEATHER = "weather"
    REINVESTMENT = "reinvestment"
    UTILITY_ANOMALY = "utility_anomaly"
    BOOKING_GAP = "booking_gap"
    SENTIMENT_DRIFT = "sentiment_drift"
    MAINTENANCE = "maintenance"


# ============================================================================
# TAX-CATEGORIZED EXPENSES
# ============================================================================

class TaxCategorizedExpense(Base):
    """Expenses with IRS Schedule E tax categories."""
    __tablename__ = "tax_categorized_expenses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)

    # Expense details
    description = Column(String(500), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    expense_date = Column(Date, nullable=False, index=True)

    # TAX CATEGORY (Required for CPA export)
    tax_category = Column(Enum(TaxCategory), nullable=False, index=True)
    subcategory = Column(String(100), nullable=True)

    # Vendor
    vendor_name = Column(String(200), nullable=True)
    vendor_ein = Column(String(20), nullable=True)  # For 1099 tracking
    invoice_number = Column(String(100), nullable=True)
    receipt_url = Column(String(500), nullable=True)

    # Payment
    payment_method = Column(String(50), nullable=True)
    check_number = Column(String(20), nullable=True)
    is_paid = Column(Boolean, default=True)

    # Auto-logging from worker jobs
    worker_job_id = Column(Integer, nullable=True)
    worker_job_type = Column(String(50), nullable=True)  # "cleaning", "pool", etc.
    is_auto_logged = Column(Boolean, default=False)

    # Tax info
    is_deductible = Column(Boolean, default=True)
    deduction_percentage = Column(Float, default=100.0)  # For mixed-use

    # Notes
    notes = Column(Text, nullable=True)

    # CPA Export tracking
    exported_to_cpa = Column(Boolean, default=False)
    export_date = Column(DateTime, nullable=True)
    tax_year = Column(Integer, nullable=True, index=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


# ============================================================================
# GAP-FILLER SPECIAL OFFERS
# ============================================================================

class SpecialOffer(Base):
    """Special pricing offers including Gap-Filler discounts."""
    __tablename__ = "special_offers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)

    # Offer type
    offer_type = Column(Enum(SpecialOfferType), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Date range
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    nights_available = Column(Integer, nullable=False)

    # Pricing
    original_nightly_rate = Column(Numeric(10, 2), nullable=False)
    discounted_rate = Column(Numeric(10, 2), nullable=False)
    discount_percentage = Column(Float, nullable=False)
    total_savings = Column(Numeric(10, 2), nullable=False)

    # Status
    is_active = Column(Boolean, default=True, index=True)
    is_booked = Column(Boolean, default=False)
    booking_id = Column(String, nullable=True)

    # Auto-generation metadata
    is_auto_generated = Column(Boolean, default=False)
    generation_reason = Column(String(200), nullable=True)  # "Gap between bookings"
    gap_before_booking_id = Column(String, nullable=True)
    gap_after_booking_id = Column(String, nullable=True)

    # Push notifications
    pushed_to_website = Column(Boolean, default=False)
    push_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    expires_at = Column(DateTime, nullable=True)


class BookingGap(Base):
    """Track gaps between bookings for Gap-Filler analysis."""
    __tablename__ = "booking_gaps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)

    # Gap dates
    gap_start = Column(Date, nullable=False, index=True)
    gap_end = Column(Date, nullable=False, index=True)
    gap_nights = Column(Integer, nullable=False)

    # Surrounding bookings
    checkout_booking_id = Column(String, nullable=True)  # Guest checking out before gap
    checkin_booking_id = Column(String, nullable=True)  # Guest checking in after gap

    # Status
    is_gap_filler_eligible = Column(Boolean, default=True)  # 2-3 night gaps
    special_offer_id = Column(Integer, ForeignKey("special_offers.id"), nullable=True)
    was_filled = Column(Boolean, default=False)

    # Revenue analysis
    potential_revenue = Column(Numeric(10, 2), nullable=True)
    lost_revenue = Column(Numeric(10, 2), nullable=True)  # If not filled

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


# ============================================================================
# FINANCIAL ANALYTICS
# ============================================================================

class MonthlyPropertyFinancials(Base):
    """Pre-calculated monthly financials per property for Net Profit view."""
    __tablename__ = "monthly_property_financials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)

    # GROSS REVENUE
    vrbo_revenue = Column(Numeric(12, 2), default=0)
    airbnb_revenue = Column(Numeric(12, 2), default=0)
    direct_revenue = Column(Numeric(12, 2), default=0)
    cleaning_fees_collected = Column(Numeric(10, 2), default=0)
    other_income = Column(Numeric(10, 2), default=0)
    total_gross = Column(Numeric(12, 2), default=0)

    # EXPENSES BY TAX CATEGORY
    expense_cleaning = Column(Numeric(10, 2), default=0)
    expense_repairs = Column(Numeric(10, 2), default=0)
    expense_supplies = Column(Numeric(10, 2), default=0)
    expense_utilities = Column(Numeric(10, 2), default=0)
    expense_insurance = Column(Numeric(10, 2), default=0)
    expense_taxes = Column(Numeric(10, 2), default=0)
    expense_professional = Column(Numeric(10, 2), default=0)
    expense_other = Column(Numeric(10, 2), default=0)
    total_expenses = Column(Numeric(12, 2), default=0)

    # NET PROFIT
    net_profit = Column(Numeric(12, 2), default=0)
    profit_margin = Column(Float, default=0)

    # REVPAR (Revenue Per Available Room)
    available_nights = Column(Integer, default=30)
    occupied_nights = Column(Integer, default=0)
    occupancy_rate = Column(Float, default=0)
    revpar = Column(Numeric(10, 2), default=0)  # Gross / Available Nights
    adr = Column(Numeric(10, 2), default=0)  # Average Daily Rate

    # SOVEREIGNTY METRIC (OTA fee savings)
    ota_fees_paid = Column(Numeric(10, 2), default=0)  # VRBO/Airbnb commissions
    direct_booking_savings = Column(Numeric(10, 2), default=0)  # Saved by direct bookings

    # Calculation metadata
    calculated_at = Column(DateTime, nullable=True)
    is_finalized = Column(Boolean, default=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('property_id', 'year', 'month', name='uq_property_year_month'),
    )


class PortfolioAnalytics(Base):
    """Portfolio-wide analytics for the Admin dashboard."""
    __tablename__ = "portfolio_analytics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, unique=True, index=True)

    # PORTFOLIO TOTALS
    total_properties = Column(Integer, default=22)
    total_gross_revenue = Column(Numeric(12, 2), default=0)
    total_expenses = Column(Numeric(12, 2), default=0)
    total_net_profit = Column(Numeric(12, 2), default=0)

    # PORTFOLIO REVPAR
    total_available_nights = Column(Integer, default=0)
    total_occupied_nights = Column(Integer, default=0)
    portfolio_occupancy = Column(Float, default=0)
    portfolio_revpar = Column(Numeric(10, 2), default=0)

    # TOP PERFORMERS
    top_property_id = Column(String, nullable=True)
    top_property_revenue = Column(Numeric(10, 2), default=0)
    top_property_revpar = Column(Numeric(10, 2), default=0)

    # SOVEREIGNTY METRICS
    total_direct_bookings = Column(Integer, default=0)
    total_ota_bookings = Column(Integer, default=0)
    total_ota_fees_saved = Column(Numeric(10, 2), default=0)
    sovereignty_percentage = Column(Float, default=0)  # Direct / Total

    calculated_at = Column(DateTime, server_default=func.now())


# ============================================================================
# WEATHER & OPERATIONS ALERTS
# ============================================================================

class WeatherData(Base):
    """Track Midland, TX weather for operations."""
    __tablename__ = "weather_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    recorded_at = Column(DateTime, nullable=False, index=True)

    # Conditions
    temperature_f = Column(Float, nullable=True)
    feels_like_f = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    wind_speed_mph = Column(Float, nullable=True)
    wind_gust_mph = Column(Float, nullable=True)
    wind_direction = Column(String(10), nullable=True)
    conditions = Column(String(100), nullable=True)

    # Alerts
    is_dust_storm = Column(Boolean, default=False)  # wind > 30 mph
    is_freeze_warning = Column(Boolean, default=False)  # temp < 32°F
    is_extreme_heat = Column(Boolean, default=False)  # temp > 105°F

    # Source
    source = Column(String(50), default="openweathermap")
    raw_data = Column(JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now())


class OperationalAlert(Base):
    """System alerts for Admin dashboard."""
    __tablename__ = "operational_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, nullable=True, index=True)

    # Alert info
    alert_type = Column(Enum(AlertType), nullable=False, index=True)
    severity = Column(Enum(AlertSeverity), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Trigger data
    trigger_data = Column(JSON, nullable=True)  # Weather data, sentiment scores, etc.
    threshold_value = Column(Float, nullable=True)
    actual_value = Column(Float, nullable=True)

    # Actions taken
    auto_actions_taken = Column(JSON, nullable=True)  # Tasks escalated, etc.
    manual_resolution = Column(Text, nullable=True)
    resolved_by = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    # Status
    is_active = Column(Boolean, default=True, index=True)
    is_acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)


# ============================================================================
# SENTIMENT ANALYSIS
# ============================================================================

class ReviewSentimentAnalysis(Base):
    """NLP analysis of guest reviews for sentiment drift detection."""
    __tablename__ = "review_sentiment_analysis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    review_id = Column(Integer, nullable=True)

    # Review metadata
    review_date = Column(Date, nullable=False, index=True)
    platform = Column(String(50), nullable=True)
    star_rating = Column(Integer, nullable=True)

    # Sentiment scores
    overall_sentiment = Column(Float, nullable=True)  # -1 to 1
    sentiment_label = Column(String(20), nullable=True)  # positive, neutral, negative

    # Key topic extraction
    topics = Column(JSON, nullable=True)  # ["cleanliness", "location", "amenities"]
    positive_keywords = Column(JSON, nullable=True)  # ["pristine", "spotless"]
    negative_keywords = Column(JSON, nullable=True)  # ["tired", "dated"]

    # Drift detection
    rolling_sentiment_30d = Column(Float, nullable=True)
    rolling_sentiment_90d = Column(Float, nullable=True)
    sentiment_drift = Column(Float, nullable=True)  # Current vs 90-day avg
    is_drift_alert = Column(Boolean, default=False)  # Significant negative drift

    # Raw text
    review_text = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())


# ============================================================================
# UTILITY INTENSITY TRACKING
# ============================================================================

class UtilityIntensityMetric(Base):
    """Track utility costs per guest night for anomaly detection."""
    __tablename__ = "utility_intensity_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)

    # Utility costs
    total_utility_cost = Column(Numeric(10, 2), default=0)
    electric_cost = Column(Numeric(10, 2), default=0)
    water_cost = Column(Numeric(10, 2), default=0)
    gas_cost = Column(Numeric(10, 2), default=0)

    # Occupancy
    guest_nights = Column(Integer, default=0)
    total_guests = Column(Integer, default=0)

    # Cost per guest
    cost_per_guest_night = Column(Numeric(10, 2), default=0)
    cost_per_guest = Column(Numeric(10, 2), default=0)

    # Anomaly detection
    portfolio_avg_cost_per_guest = Column(Numeric(10, 2), nullable=True)
    deviation_percentage = Column(Float, default=0)  # How far from average
    is_anomaly = Column(Boolean, default=False)  # > 20% above average
    anomaly_reason = Column(String(200), nullable=True)  # "High AC usage", etc.

    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('property_id', 'year', 'month', name='uq_utility_property_month'),
    )


# ============================================================================
# FRIDAY PAYOUT REPORT
# ============================================================================

class WeeklyPayoutReport(Base):
    """Weekly financial summary report (Friday Payout)."""
    __tablename__ = "weekly_payout_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    week_start = Column(Date, nullable=False, index=True)
    week_end = Column(Date, nullable=False)
    generated_at = Column(DateTime, server_default=func.now())

    # REVENUE
    total_gross_revenue = Column(Numeric(12, 2), default=0)
    vrbo_revenue = Column(Numeric(12, 2), default=0)
    airbnb_revenue = Column(Numeric(12, 2), default=0)
    direct_revenue = Column(Numeric(12, 2), default=0)

    # EXPENSES
    total_cleaner_costs = Column(Numeric(10, 2), default=0)
    total_pool_tech_costs = Column(Numeric(10, 2), default=0)
    total_lawn_costs = Column(Numeric(10, 2), default=0)
    total_utility_estimates = Column(Numeric(10, 2), default=0)
    total_other_expenses = Column(Numeric(10, 2), default=0)
    total_expenses = Column(Numeric(12, 2), default=0)

    # NET PROFIT
    net_profit = Column(Numeric(12, 2), default=0)

    # TOP PERFORMER
    top_property_id = Column(String, nullable=True)
    top_property_name = Column(String(200), nullable=True)
    top_property_revenue = Column(Numeric(10, 2), default=0)
    top_property_profit = Column(Numeric(10, 2), default=0)

    # PORTFOLIO STATS
    total_bookings = Column(Integer, default=0)
    total_guest_nights = Column(Integer, default=0)
    avg_occupancy = Column(Float, default=0)

    # SOVEREIGNTY
    direct_booking_count = Column(Integer, default=0)
    ota_fees_saved = Column(Numeric(10, 2), default=0)

    # Report delivery
    report_json = Column(JSON, nullable=True)
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime, nullable=True)
    sent_to = Column(JSON, nullable=True)  # List of emails


# ============================================================================
# CPA TAX EXPORT LOG
# ============================================================================

class TaxExportLog(Base):
    """Track CPA export history."""
    __tablename__ = "tax_export_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tax_year = Column(Integer, nullable=False, index=True)
    property_id = Column(String, nullable=True)  # Null = all properties

    # Export details
    export_type = Column(String(50), nullable=False)  # "schedule_e", "1099", "full"
    file_format = Column(String(10), nullable=False)  # "csv", "pdf", "json"
    file_url = Column(String(500), nullable=True)

    # Summary
    total_income = Column(Numeric(12, 2), default=0)
    total_expenses = Column(Numeric(12, 2), default=0)
    net_income = Column(Numeric(12, 2), default=0)
    expense_count = Column(Integer, default=0)

    # Delivery
    sent_to_email = Column(String(200), nullable=True)
    sent_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(String, nullable=True)


# ============================================================================
# WORKER JOB EXPENSE (Auto-logged from cleaner/pool tech jobs)
# ============================================================================

class WorkerJobType(str, enum.Enum):
    """Types of worker jobs that auto-create expenses."""
    CLEANING = "cleaning"
    POOL_SERVICE = "pool_service"
    LAWN_SERVICE = "lawn_service"
    PEST_CONTROL = "pest_control"
    HVAC_SERVICE = "hvac_service"
    PLUMBING = "plumbing"
    ELECTRICAL = "electrical"
    HANDYMAN = "handyman"
    OTHER = "other"


# Map worker job types to tax categories
WORKER_JOB_TAX_CATEGORY_MAP = {
    WorkerJobType.CLEANING: TaxCategory.CLEANING_MAINTENANCE,
    WorkerJobType.POOL_SERVICE: TaxCategory.POOL_SERVICE,
    WorkerJobType.LAWN_SERVICE: TaxCategory.LANDSCAPING,
    WorkerJobType.PEST_CONTROL: TaxCategory.PEST_CONTROL,
    WorkerJobType.HVAC_SERVICE: TaxCategory.HVAC_SERVICE,
    WorkerJobType.PLUMBING: TaxCategory.PLUMBING,
    WorkerJobType.ELECTRICAL: TaxCategory.ELECTRICAL,
    WorkerJobType.HANDYMAN: TaxCategory.REPAIRS,
    WorkerJobType.OTHER: TaxCategory.OTHER,
}


class WorkerJobExpense(Base):
    """
    Auto-logged expenses from completed worker jobs.
    When a cleaner marks a job complete, this creates an expense automatically.
    When a pool tech completes service, this creates an expense automatically.
    """
    __tablename__ = "worker_job_expenses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)

    # Link to worker job
    worker_job_id = Column(String, nullable=False, index=True)  # CleaningJob.id or other job ID
    job_type = Column(Enum(WorkerJobType), nullable=False, index=True)

    # Worker info
    worker_id = Column(String, ForeignKey("users.id"), nullable=True)
    worker_name = Column(String(200), nullable=True)

    # Expense details (auto-calculated from PropertyServiceFees)
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(String(500), nullable=False)
    expense_date = Column(Date, nullable=False, index=True)

    # Auto-assigned tax category
    tax_category = Column(Enum(TaxCategory), nullable=False, index=True)

    # Job completion details
    job_started_at = Column(DateTime, nullable=True)
    job_completed_at = Column(DateTime, nullable=True)
    job_duration_mins = Column(Integer, nullable=True)

    # Quality score (for cleaners)
    job_score = Column(Integer, nullable=True)  # 1-100

    # Payment tracking
    is_paid = Column(Boolean, default=False)
    paid_date = Column(Date, nullable=True)
    payment_method = Column(String(50), nullable=True)  # cash, check, venmo, etc.
    payment_reference = Column(String(100), nullable=True)  # Check #, Venmo ID

    # Link to TaxCategorizedExpense (when synced)
    synced_to_expense_id = Column(Integer, ForeignKey("tax_categorized_expenses.id"), nullable=True)

    # Booking association (for turnover cleanings)
    booking_id = Column(String, nullable=True)

    # Notes
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class PropertyServiceFees(Base):
    """
    Preset service fees per property for auto-expense calculation.
    Steven sets these rates for each property and worker type.
    When a job completes, the expense amount is pulled from here.
    """
    __tablename__ = "property_service_fees"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)

    # Service type
    service_type = Column(Enum(WorkerJobType), nullable=False, index=True)

    # Pricing
    base_fee = Column(Numeric(10, 2), nullable=False)  # Standard rate
    deep_clean_fee = Column(Numeric(10, 2), nullable=True)  # Deep clean rate (for cleaning)
    emergency_fee = Column(Numeric(10, 2), nullable=True)  # Rush/emergency rate

    # Fee modifiers
    per_bedroom_fee = Column(Numeric(8, 2), default=0)  # Additional per bedroom
    per_bathroom_fee = Column(Numeric(8, 2), default=0)  # Additional per bathroom
    large_property_fee = Column(Numeric(8, 2), default=0)  # For 4+ bedroom

    # Frequency (for recurring services like pool)
    service_frequency = Column(String(50), nullable=True)  # weekly, biweekly, monthly

    # Preferred workers (JSON list of worker IDs)
    preferred_workers = Column(JSON, nullable=True)

    # Tax category override (if different from default mapping)
    tax_category_override = Column(Enum(TaxCategory), nullable=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('property_id', 'service_type', name='uq_property_service_type'),
    )


# ============================================================================
# HELPER FUNCTION: Get expense amount for a job
# ============================================================================

def get_service_fee_for_property(
    property_id: str,
    service_type: WorkerJobType,
    job_type: str = "standard"  # standard, deep_clean, emergency
) -> dict:
    """
    Get the service fee for a property and service type.
    Returns dict with amount and tax_category.

    Usage:
        fee_info = get_service_fee_for_property("prop_123", WorkerJobType.CLEANING, "standard")
        amount = fee_info["amount"]  # e.g., 85.00
        tax_cat = fee_info["tax_category"]  # TaxCategory.CLEANING_MAINTENANCE
    """
    from .connection import SessionLocal

    db = SessionLocal()
    try:
        fee_record = db.query(PropertyServiceFees).filter(
            PropertyServiceFees.property_id == property_id,
            PropertyServiceFees.service_type == service_type,
            PropertyServiceFees.is_active == True
        ).first()

        if fee_record:
            # Determine amount based on job type
            if job_type == "deep_clean" and fee_record.deep_clean_fee:
                amount = fee_record.deep_clean_fee
            elif job_type == "emergency" and fee_record.emergency_fee:
                amount = fee_record.emergency_fee
            else:
                amount = fee_record.base_fee

            # Determine tax category
            tax_category = fee_record.tax_category_override or WORKER_JOB_TAX_CATEGORY_MAP.get(
                service_type, TaxCategory.OTHER
            )

            return {
                "amount": float(amount),
                "tax_category": tax_category,
                "fee_record_id": fee_record.id
            }
        else:
            # Return default tax category without amount (fee not configured)
            return {
                "amount": None,
                "tax_category": WORKER_JOB_TAX_CATEGORY_MAP.get(service_type, TaxCategory.OTHER),
                "fee_record_id": None
            }
    finally:
        db.close()
