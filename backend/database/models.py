"""
SQLAlchemy Models for Right at Home BnB
Mirrors Prisma schema for Python backend
"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    Text, Numeric, ForeignKey, Enum, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum
from .connection import Base


# ============================================
# ENUMS
# ============================================

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    CLEANER = "CLEANER"
    GUEST = "GUEST"


class PropertyType(str, enum.Enum):
    HOUSE = "HOUSE"
    APARTMENT = "APARTMENT"
    CONDO = "CONDO"
    TOWNHOUSE = "TOWNHOUSE"
    CABIN = "CABIN"


class PropertyStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MAINTENANCE = "MAINTENANCE"


class Platform(str, enum.Enum):
    AIRBNB = "AIRBNB"
    VRBO = "VRBO"
    BOOKING = "BOOKING"
    DIRECT = "DIRECT"
    OTHER = "OTHER"


class VipTier(str, enum.Enum):
    SILVER = "SILVER"
    GOLD = "GOLD"
    PLATINUM = "PLATINUM"
    DIAMOND = "DIAMOND"


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    CHECKED_OUT = "CHECKED_OUT"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class CleaningType(str, enum.Enum):
    TURNOVER = "TURNOVER"
    DEEP_CLEAN = "DEEP_CLEAN"
    INSPECTION = "INSPECTION"
    MAINTENANCE = "MAINTENANCE"


class CleaningStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    ISSUE_REPORTED = "ISSUE_REPORTED"


class LockBrand(str, enum.Enum):
    SCHLAGE = "SCHLAGE"
    YALE = "YALE"
    AUGUST = "AUGUST"
    KWIKSET = "KWIKSET"
    OTHER = "OTHER"


class MessageType(str, enum.Enum):
    BOOKING_CONFIRM = "BOOKING_CONFIRM"
    PRE_ARRIVAL = "PRE_ARRIVAL"
    CHECK_IN = "CHECK_IN"
    DURING_STAY = "DURING_STAY"
    CHECK_OUT = "CHECK_OUT"
    POST_STAY = "POST_STAY"
    REVIEW_REQUEST = "REVIEW_REQUEST"
    CUSTOM = "CUSTOM"


class MessageChannel(str, enum.Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"
    WHATSAPP = "WHATSAPP"
    APP_NOTIFICATION = "APP_NOTIFICATION"


class MessageStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    SCHEDULED = "SCHEDULED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


class Sentiment(str, enum.Enum):
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"


class ExpenseCategory(str, enum.Enum):
    CLEANING = "CLEANING"
    MAINTENANCE = "MAINTENANCE"
    UTILITIES = "UTILITIES"
    SUPPLIES = "SUPPLIES"
    FURNITURE = "FURNITURE"
    APPLIANCES = "APPLIANCES"
    INSURANCE = "INSURANCE"
    TAXES = "TAXES"
    MARKETING = "MARKETING"
    SOFTWARE = "SOFTWARE"
    PROFESSIONAL_FEES = "PROFESSIONAL_FEES"
    MORTGAGE = "MORTGAGE"
    HOA = "HOA"
    OTHER = "OTHER"


class ExpenseStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PAID = "PAID"


class ConciergeCategory(str, enum.Enum):
    PROPERTY_INFO = "PROPERTY_INFO"
    DIRECTIONS = "DIRECTIONS"
    RESTAURANTS = "RESTAURANTS"
    ACTIVITIES = "ACTIVITIES"
    EMERGENCY = "EMERGENCY"
    CHECKOUT = "CHECKOUT"
    LATE_CHECKOUT = "LATE_CHECKOUT"
    WIFI = "WIFI"
    AMENITIES = "AMENITIES"
    LOCAL_EVENTS = "LOCAL_EVENTS"
    TRANSPORTATION = "TRANSPORTATION"
    OTHER = "OTHER"


# ============================================
# MODELS
# ============================================

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    phone = Column(String)
    avatar_url = Column(String)
    role = Column(Enum(UserRole), default=UserRole.GUEST, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    cleaning_jobs = relationship("CleaningJob", back_populates="cleaner")
    expenses = relationship("Expense", back_populates="created_by")


class Property(Base):
    __tablename__ = "properties"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    city = Column(String, default="Midland")
    state = Column(String, default="TX")
    zip_code = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)

    # Property Details
    bedrooms = Column(Integer, nullable=False)
    bathrooms = Column(Float, nullable=False)
    max_guests = Column(Integer, nullable=False)
    square_feet = Column(Integer)
    property_type = Column(Enum(PropertyType), default=PropertyType.HOUSE)

    # Amenities & Info
    amenities = Column(JSON)
    wifi_network = Column(String)
    wifi_password = Column(String)
    parking_info = Column(String)
    check_in_instr = Column(Text)
    check_out_instr = Column(Text)
    house_rules = Column(Text)

    # Cleaning
    cleaning_checklist = Column(JSON)

    # Pricing
    nightly_rate = Column(Numeric(10, 2), nullable=False)
    cleaning_fee = Column(Numeric(10, 2))
    security_deposit = Column(Numeric(10, 2))

    # External IDs
    airbnb_id = Column(String)
    vrbo_id = Column(String)

    # Status
    status = Column(Enum(PropertyStatus), default=PropertyStatus.ACTIVE, index=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    bookings = relationship("Booking", back_populates="property")
    cleaning_jobs = relationship("CleaningJob", back_populates="property")
    smart_lock = relationship("SmartLock", back_populates="property", uselist=False)
    expenses = relationship("Expense", back_populates="property")


class Guest(Base):
    __tablename__ = "guests"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    phone = Column(String)

    # Source
    platform = Column(Enum(Platform), default=Platform.DIRECT)
    platform_id = Column(String)

    # CRM Data
    first_stay = Column(DateTime)
    last_stay = Column(DateTime)
    total_stays = Column(Integer, default=0)
    total_spent = Column(Numeric(10, 2), default=0)
    avg_rating = Column(Float)

    # Tags & Preferences
    tags = Column(JSON)
    notes = Column(Text)
    preferences = Column(JSON)

    # VIP Status
    is_vip = Column(Boolean, default=False, index=True)
    vip_tier = Column(Enum(VipTier))

    # Special Dates
    birthday = Column(DateTime)
    anniversary = Column(DateTime)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    bookings = relationship("Booking", back_populates="guest")
    messages = relationship("Message", back_populates="guest")
    concierge_queries = relationship("ConciergeQuery", back_populates="guest")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String, primary_key=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    guest_id = Column(String, ForeignKey("guests.id"), nullable=False, index=True)

    # Dates
    check_in = Column(DateTime, nullable=False, index=True)
    check_out = Column(DateTime, nullable=False, index=True)

    # Details
    guest_count = Column(Integer, default=1)
    platform = Column(Enum(Platform), default=Platform.DIRECT)
    confirm_code = Column(String)

    # Pricing
    nightly_rate = Column(Numeric(10, 2), nullable=False)
    total_nights = Column(Integer, nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False)
    cleaning_fee = Column(Numeric(10, 2))
    service_fee = Column(Numeric(10, 2))
    taxes = Column(Numeric(10, 2))
    total_price = Column(Numeric(10, 2), nullable=False)

    # Access
    access_code = Column(String)
    code_expires_at = Column(DateTime)

    # Status
    status = Column(Enum(BookingStatus), default=BookingStatus.CONFIRMED, index=True)
    special_reqs = Column(Text)
    internal_notes = Column(Text)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    property = relationship("Property", back_populates="bookings")
    guest = relationship("Guest", back_populates="bookings")
    cleaning_job = relationship("CleaningJob", back_populates="booking", uselist=False)
    messages = relationship("Message", back_populates="booking")


class CleaningJob(Base):
    __tablename__ = "cleaning_jobs"

    id = Column(String, primary_key=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    cleaner_id = Column(String, ForeignKey("users.id"), index=True)
    booking_id = Column(String, ForeignKey("bookings.id"), unique=True)

    # Scheduling
    scheduled_at = Column(DateTime, nullable=False, index=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Type
    job_type = Column(Enum(CleaningType), default=CleaningType.TURNOVER)

    # Status
    status = Column(Enum(CleaningStatus), default=CleaningStatus.SCHEDULED, index=True)

    # GPS Verification
    check_in_lat = Column(Float)
    check_in_lng = Column(Float)
    check_out_lat = Column(Float)
    check_out_lng = Column(Float)

    # Checklist & Photos
    checklist_progress = Column(JSON)
    photos = Column(JSON)

    # Quality
    score = Column(Integer)
    score_feedback = Column(Text)

    # Notes
    notes = Column(Text)
    issues = Column(Text)

    # Duration
    duration_mins = Column(Integer)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    property = relationship("Property", back_populates="cleaning_jobs")
    cleaner = relationship("User", back_populates="cleaning_jobs")
    booking = relationship("Booking", back_populates="cleaning_job")


class SmartLock(Base):
    __tablename__ = "smart_locks"

    id = Column(String, primary_key=True)
    property_id = Column(String, ForeignKey("properties.id"), unique=True, nullable=False)

    # Device Info
    brand = Column(Enum(LockBrand), nullable=False)
    model = Column(String)
    device_id = Column(String, nullable=False)
    serial_number = Column(String)

    # Current State
    current_code = Column(String)
    code_expires_at = Column(DateTime)
    battery_level = Column(Integer)
    last_activity = Column(DateTime)
    is_online = Column(Boolean, default=True)

    # Access Log
    access_log = Column(JSON)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    property = relationship("Property", back_populates="smart_lock")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True)
    guest_id = Column(String, ForeignKey("guests.id"), nullable=False, index=True)
    booking_id = Column(String, ForeignKey("bookings.id"), index=True)

    # Message Details
    type = Column(Enum(MessageType), nullable=False, index=True)
    channel = Column(Enum(MessageChannel), default=MessageChannel.EMAIL)
    subject = Column(String)
    body = Column(Text, nullable=False)

    # Status
    status = Column(Enum(MessageStatus), default=MessageStatus.DRAFT, index=True)

    # Scheduling
    scheduled_for = Column(DateTime)
    sent_at = Column(DateTime)

    # Approval
    approved_by = Column(String)
    approved_at = Column(DateTime)

    # AI Analysis
    sentiment = Column(Enum(Sentiment))
    sentiment_score = Column(Float)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    guest = relationship("Guest", back_populates="messages")
    booking = relationship("Booking", back_populates="messages")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String, primary_key=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    created_by_id = Column(String, ForeignKey("users.id"))

    # Expense Details
    category = Column(Enum(ExpenseCategory), nullable=False, index=True)
    subcategory = Column(String)
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(String, nullable=False)
    vendor = Column(String)

    # Date
    date = Column(DateTime, nullable=False, index=True)

    # Receipt
    receipt_url = Column(String)

    # Tax
    is_tax_deductible = Column(Boolean, default=True)
    tax_category = Column(String)

    # Status
    status = Column(Enum(ExpenseStatus), default=ExpenseStatus.PENDING)

    # Notes
    notes = Column(Text)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    property = relationship("Property", back_populates="expenses")
    created_by = relationship("User", back_populates="expenses")


class ConciergeQuery(Base):
    __tablename__ = "concierge_queries"

    id = Column(String, primary_key=True)
    guest_id = Column(String, ForeignKey("guests.id"), index=True)
    property_id = Column(String)

    # Query & Response
    query = Column(Text, nullable=False)
    response = Column(Text, nullable=False)

    # Classification
    category = Column(Enum(ConciergeCategory), index=True)
    intent = Column(String)

    # Quality
    was_helpful = Column(Boolean)
    rating = Column(Integer)

    # Voice
    voice_used = Column(Boolean, default=False)
    audio_url = Column(String)

    created_at = Column(DateTime, default=func.now(), index=True)

    # Relations
    guest = relationship("Guest", back_populates="concierge_queries")
