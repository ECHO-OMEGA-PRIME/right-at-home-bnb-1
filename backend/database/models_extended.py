"""
Right At Home BnB - Extended Database Models
=============================================
Comprehensive models for:
- Property utility tracking (electric, water, gas, internet)
- Property expense tracking (furniture, repairs, supplies)
- Cleaner grading system (quickness, cleanliness, ratings)
- Customer dossiers (reviews, notes, good/bad guest ratings)
- Tax reporting data aggregation

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Enum, Date, Numeric
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from .connection import Base


# ============================================================================
# ENUMS
# ============================================================================

class UtilityType(str, enum.Enum):
    ELECTRIC = "electric"
    WATER = "water"
    GAS = "gas"
    INTERNET = "internet"
    TRASH = "trash"
    HOA = "hoa"
    INSURANCE = "insurance"
    PROPERTY_TAX = "property_tax"


class ExpenseCategory(str, enum.Enum):
    FURNITURE = "furniture"
    APPLIANCE = "appliance"
    REPAIR = "repair"
    MAINTENANCE = "maintenance"
    SUPPLIES = "supplies"
    CLEANING = "cleaning"
    LANDSCAPING = "landscaping"
    SECURITY = "security"
    SMART_HOME = "smart_home"
    OTHER = "other"


class GuestRating(str, enum.Enum):
    EXCELLENT = "excellent"  # 5 stars, great guest
    GOOD = "good"           # 4 stars, no issues
    AVERAGE = "average"     # 3 stars, some issues
    POOR = "poor"           # 2 stars, problems
    BAD = "bad"             # 1 star, do not rent again
    BANNED = "banned"       # Never rent to this guest


class CleanerGrade(str, enum.Enum):
    A_PLUS = "A+"
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    F = "F"


# ============================================================================
# PROPERTY UTILITY TRACKING
# ============================================================================

class PropertyUtility(Base):
    """Track utility costs per property per month."""
    __tablename__ = "property_utilities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    utility_type = Column(Enum(UtilityType), nullable=False)

    # Billing period
    billing_month = Column(Integer, nullable=False)  # 1-12
    billing_year = Column(Integer, nullable=False)

    # Costs
    amount = Column(Numeric(10, 2), nullable=False)
    usage_units = Column(Float, nullable=True)  # kWh, gallons, therms, etc.
    unit_type = Column(String(20), nullable=True)  # "kWh", "gallons", etc.

    # Invoice details
    invoice_number = Column(String(100), nullable=True)
    due_date = Column(Date, nullable=True)
    paid_date = Column(Date, nullable=True)
    paid = Column(Boolean, default=False)

    # Notes
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class PropertyExpense(Base):
    """Track additional expenses per property."""
    __tablename__ = "property_expenses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)

    # Expense details
    category = Column(Enum(ExpenseCategory), nullable=False)
    description = Column(String(500), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    expense_date = Column(Date, nullable=False)

    # Vendor info
    vendor_name = Column(String(200), nullable=True)
    invoice_number = Column(String(100), nullable=True)
    receipt_url = Column(String(500), nullable=True)  # Cloud storage link

    # Depreciation (for furniture/appliances)
    is_capital_expense = Column(Boolean, default=False)
    useful_life_years = Column(Integer, nullable=True)
    depreciation_method = Column(String(50), nullable=True)

    # Tax deductible
    tax_deductible = Column(Boolean, default=True)
    tax_category = Column(String(100), nullable=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


# ============================================================================
# CLEANER GRADING SYSTEM
# ============================================================================

class CleanerProfile(Base):
    """Extended cleaner profile with grading data."""
    __tablename__ = "cleaner_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cleaner_id = Column(Integer, ForeignKey("cleaners.id"), unique=True)

    # Aggregate scores (calculated from CleaningReview)
    avg_cleanliness_score = Column(Float, default=5.0)  # 1-5 scale
    avg_quickness_score = Column(Float, default=5.0)    # 1-5 scale
    avg_thoroughness_score = Column(Float, default=5.0) # 1-5 scale
    avg_communication_score = Column(Float, default=5.0) # 1-5 scale

    # Overall grade
    overall_grade = Column(Enum(CleanerGrade), default=CleanerGrade.A)
    total_cleanings = Column(Integer, default=0)
    total_complaints = Column(Integer, default=0)
    total_compliments = Column(Integer, default=0)

    # Performance metrics
    on_time_percentage = Column(Float, default=100.0)
    avg_cleaning_time_minutes = Column(Integer, nullable=True)
    rehires_count = Column(Integer, default=0)  # Times rehired by same property

    # Rank among all cleaners
    rank = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class CleaningReview(Base):
    """Individual cleaning job review."""
    __tablename__ = "cleaning_reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cleaner_id = Column(Integer, ForeignKey("cleaners.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    booking_id = Column(Integer, nullable=True)

    # Review date
    cleaning_date = Column(Date, nullable=False)
    reviewed_by = Column(String(100), nullable=True)  # Guest, Owner, or System

    # Scores (1-5)
    cleanliness_score = Column(Integer, nullable=False)
    quickness_score = Column(Integer, nullable=False)
    thoroughness_score = Column(Integer, nullable=True)
    communication_score = Column(Integer, nullable=True)

    # Timing
    scheduled_start = Column(DateTime, nullable=True)
    actual_start = Column(DateTime, nullable=True)
    actual_end = Column(DateTime, nullable=True)
    was_on_time = Column(Boolean, default=True)

    # Issues
    issues_found = Column(JSON, nullable=True)  # List of issues
    photos_taken = Column(JSON, nullable=True)  # Photo URLs

    # Comments
    guest_comment = Column(Text, nullable=True)
    owner_notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())


# ============================================================================
# CUSTOMER DOSSIER SYSTEM
# ============================================================================

class CustomerDossier(Base):
    """Comprehensive customer profile with AI memory."""
    __tablename__ = "customer_dossiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), unique=True)

    # Identification (hashed for privacy)
    email_hash = Column(String(64), nullable=True)
    phone_hash = Column(String(64), nullable=True)

    # Guest rating
    overall_rating = Column(Enum(GuestRating), default=GuestRating.GOOD)
    avg_star_rating = Column(Float, nullable=True)  # Their reviews of us
    our_rating_of_them = Column(Float, nullable=True)  # Our rating of them (1-5)

    # Behavior flags
    is_clean_guest = Column(Boolean, default=True)
    is_quiet_guest = Column(Boolean, default=True)
    follows_rules = Column(Boolean, default=True)
    good_communication = Column(Boolean, default=True)
    pays_on_time = Column(Boolean, default=True)

    # Stay history
    total_stays = Column(Integer, default=0)
    total_nights = Column(Integer, default=0)
    total_revenue = Column(Numeric(10, 2), default=0)
    last_stay_date = Column(Date, nullable=True)

    # Issues history
    damage_incidents = Column(Integer, default=0)
    noise_complaints = Column(Integer, default=0)
    rule_violations = Column(Integer, default=0)
    late_payments = Column(Integer, default=0)

    # AI Notes (from Steven AI conversations)
    ai_notes = Column(JSON, nullable=True)  # List of notes
    preferences = Column(JSON, nullable=True)  # Learned preferences
    special_requests_history = Column(JSON, nullable=True)

    # Reviews they've left
    reviews_given = Column(JSON, nullable=True)  # All reviews this guest has left

    # Staff notes
    owner_notes = Column(Text, nullable=True)
    do_not_rent = Column(Boolean, default=False)
    do_not_rent_reason = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class CustomerReview(Base):
    """Reviews left by customers."""
    __tablename__ = "customer_reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dossier_id = Column(Integer, ForeignKey("customer_dossiers.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    booking_id = Column(Integer, nullable=True)

    # Review details
    review_date = Column(Date, nullable=False)
    platform = Column(String(50), nullable=True)  # Airbnb, VRBO, Direct, Google
    star_rating = Column(Integer, nullable=False)  # 1-5
    review_text = Column(Text, nullable=True)

    # AI analysis
    sentiment = Column(String(20), nullable=True)  # positive, neutral, negative
    key_topics = Column(JSON, nullable=True)  # Extracted topics
    ai_summary = Column(Text, nullable=True)

    # Our response
    response_text = Column(Text, nullable=True)
    responded_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())


# ============================================================================
# SMART HOME INTEGRATION
# ============================================================================

class SmartHomeDevice(Base):
    """Track all smart home devices per property."""
    __tablename__ = "smart_home_devices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)

    # Device info
    device_type = Column(String(50), nullable=False)  # thermostat, lock, camera, etc.
    brand = Column(String(50), nullable=False)  # Google Nest, Schlage, Ring, etc.
    model = Column(String(100), nullable=True)
    device_id = Column(String(200), nullable=True)  # External device ID

    # Location within property
    room = Column(String(100), nullable=True)
    location_description = Column(String(200), nullable=True)

    # Integration
    integration_type = Column(String(50), nullable=True)  # google_home, alexa, homekit
    api_endpoint = Column(String(500), nullable=True)
    last_synced = Column(DateTime, nullable=True)

    # Status
    is_online = Column(Boolean, default=True)
    last_status = Column(JSON, nullable=True)  # Last known state
    battery_level = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


# ============================================================================
# TAX REPORTING
# ============================================================================

class TaxReportData(Base):
    """Aggregated tax data per property per year."""
    __tablename__ = "tax_report_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    tax_year = Column(Integer, nullable=False)

    # Income
    total_rental_income = Column(Numeric(12, 2), default=0)
    total_cleaning_fees = Column(Numeric(10, 2), default=0)
    total_other_income = Column(Numeric(10, 2), default=0)

    # Expenses (aggregated from PropertyExpense and PropertyUtility)
    total_utilities = Column(Numeric(10, 2), default=0)
    total_repairs = Column(Numeric(10, 2), default=0)
    total_supplies = Column(Numeric(10, 2), default=0)
    total_insurance = Column(Numeric(10, 2), default=0)
    total_property_tax = Column(Numeric(10, 2), default=0)
    total_depreciation = Column(Numeric(10, 2), default=0)
    total_other_expenses = Column(Numeric(10, 2), default=0)

    # Net income
    net_rental_income = Column(Numeric(12, 2), default=0)

    # Occupancy stats
    days_rented = Column(Integer, default=0)
    days_vacant = Column(Integer, default=0)
    occupancy_rate = Column(Float, default=0)

    # Generated report
    report_generated_at = Column(DateTime, nullable=True)
    report_url = Column(String(500), nullable=True)

    # Accountant export
    exported_to_accountant = Column(Boolean, default=False)
    exported_at = Column(DateTime, nullable=True)
    accountant_email = Column(String(200), nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
