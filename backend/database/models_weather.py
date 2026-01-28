"""
Right At Home BnB - Weather & Pool Service Models
===================================================
Weather-triggered pool service priority elevation for West Texas dust storms.
Integrates with OpenWeatherMap API for Midland, TX monitoring.

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
@location Midland, TX (lat: 31.9973, lon: -102.0779)
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
# ENUMS - Pool Service & Weather
# ============================================================================

class TaskPriority(str, enum.Enum):
    """Priority levels for service jobs."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class PoolStatus(str, enum.Enum):
    """Pool condition status."""
    EXCELLENT = "excellent"
    GOOD = "good"
    NEEDS_ATTENTION = "needs_attention"
    UNSAFE = "unsafe"


class PoolJobStatus(str, enum.Enum):
    """Pool service job status."""
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class WorkerType(str, enum.Enum):
    """Worker specialization types."""
    CLEANER = "cleaner"
    POOL_TECH = "pool_tech"
    LAWN_SERVICE = "lawn_service"
    MAINTENANCE = "maintenance"
    HVAC = "hvac"


class WeatherAlertSeverity(str, enum.Enum):
    """Weather alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


# ============================================================================
# WEATHER ALERT MODEL
# ============================================================================

class WeatherAlert(Base):
    """
    Track West Texas weather for pool service priority elevation.

    West Texas dust storms (haboobs) can occur when:
    - Wind speed > 30 mph
    - Low humidity
    - Dry conditions

    When dust storm detected:
    - All pool service jobs elevated to URGENT priority
    - weather_elevated flag set on affected jobs
    - Operational alert created for dashboard
    """
    __tablename__ = "weather_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Weather data timestamp
    recorded_at = Column(DateTime, nullable=False, index=True)

    # Core weather metrics
    wind_speed_mph = Column(Float, nullable=False)
    wind_gust_mph = Column(Float, nullable=True)
    wind_direction = Column(String(10), nullable=True)  # N, NE, E, SE, S, SW, W, NW

    # Dust storm detection
    is_dust_storm = Column(Boolean, default=False, index=True)  # wind > 30 mph
    dust_storm_severity = Column(Enum(WeatherAlertSeverity), nullable=True)

    # Temperature
    temperature_f = Column(Float, nullable=True)
    feels_like_f = Column(Float, nullable=True)
    humidity_percent = Column(Float, nullable=True)

    # Conditions
    conditions = Column(String(100), nullable=True)  # "Clear", "Cloudy", "Dust"
    visibility_miles = Column(Float, nullable=True)

    # Precipitation
    precipitation_mm = Column(Float, default=0)
    precipitation_type = Column(String(50), nullable=True)  # "rain", "snow", None

    # UV and Air Quality
    uv_index = Column(Float, nullable=True)
    air_quality_index = Column(Integer, nullable=True)

    # Source tracking
    source = Column(String(50), default="openweathermap")
    api_response_code = Column(Integer, nullable=True)
    raw_data = Column(JSON, nullable=True)  # Full API response for debugging

    # Location (Midland, TX)
    latitude = Column(Float, default=31.9973)
    longitude = Column(Float, default=-102.0779)
    location_name = Column(String(100), default="Midland, TX")

    # Alert actions taken
    pool_jobs_elevated = Column(Integer, default=0)  # Count of jobs elevated
    alert_sent = Column(Boolean, default=False)
    alert_sent_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self) -> str:
        dust_status = "DUST STORM" if self.is_dust_storm else "Normal"
        return f"<WeatherAlert {self.recorded_at}: {self.wind_speed_mph}mph, {dust_status}>"


# ============================================================================
# POOL SERVICE WORKER MODEL
# ============================================================================

class PoolTechnician(Base):
    """Pool technician profile with certifications and rates."""
    __tablename__ = "pool_technicians"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)

    # Basic info
    name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False, unique=True, index=True)
    phone = Column(String(20), nullable=True)

    # Worker type (always pool_tech for this table)
    worker_type = Column(Enum(WorkerType), default=WorkerType.POOL_TECH)

    # Rates
    hourly_rate = Column(Numeric(10, 2), nullable=True)
    per_job_rate = Column(Numeric(10, 2), default=50.00)  # $50 per pool service

    # Status
    is_active = Column(Boolean, default=True, index=True)
    is_verified = Column(Boolean, default=False)

    # Certifications
    certifications = Column(JSON, nullable=True)  # ["CPO", "NSPF", "AFO"]
    certification_expiry = Column(Date, nullable=True)
    insurance_expiry = Column(Date, nullable=True)

    # Performance metrics
    total_jobs_completed = Column(Integer, default=0)
    avg_rating = Column(Float, default=5.0)
    on_time_percentage = Column(Float, default=100.0)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    service_jobs = relationship("PoolServiceJob", back_populates="technician")


# ============================================================================
# POOL SERVICE JOB MODEL
# ============================================================================

class PoolServiceJob(Base):
    """
    Pool service job with chemical readings, photos, and weather-triggered priority.

    Key features:
    - Chemical level tracking (pH, chlorine, alkalinity, etc.)
    - Blue water photo REQUIRED for job completion
    - Weather-elevated priority for dust storms
    - Equipment status tracking
    """
    __tablename__ = "pool_service_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    technician_id = Column(Integer, ForeignKey("pool_technicians.id"), nullable=True, index=True)

    # Scheduling
    scheduled_at = Column(DateTime, nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Status
    status = Column(Enum(PoolJobStatus), default=PoolJobStatus.SCHEDULED, index=True)

    # Priority (auto-elevated by weather)
    priority = Column(Enum(TaskPriority), default=TaskPriority.NORMAL, index=True)
    weather_elevated = Column(Boolean, default=False, index=True)  # True if elevated due to dust storm
    weather_alert_id = Column(Integer, ForeignKey("weather_alerts.id"), nullable=True)
    original_priority = Column(Enum(TaskPriority), nullable=True)  # Priority before elevation

    # Chemical readings (REQUIRED for completion)
    ph_level = Column(Float, nullable=True)  # Target: 7.2-7.6
    chlorine_level = Column(Float, nullable=True)  # Target: 1-3 ppm
    alkalinity_level = Column(Float, nullable=True)  # Target: 80-120 ppm
    calcium_hardness = Column(Float, nullable=True)  # Target: 200-400 ppm
    cyanuric_acid = Column(Float, nullable=True)  # Target: 30-50 ppm

    # Pool status
    pool_status = Column(Enum(PoolStatus), nullable=True)
    water_temp_f = Column(Float, nullable=True)  # Fahrenheit
    water_clarity = Column(String(50), nullable=True)  # "crystal", "hazy", "cloudy", "green"

    # Equipment checks
    skimmer_status = Column(String(50), nullable=True)  # "clean", "clogged", "damaged"
    pump_status = Column(String(50), nullable=True)  # "running", "off", "needs_repair"
    filter_status = Column(String(50), nullable=True)  # "clean", "needs_backwash", "replace"
    heater_status = Column(String(50), nullable=True)  # "working", "off", "needs_repair"
    timer_status = Column(String(50), nullable=True)

    # Surface conditions (important for dust storms)
    surface_debris = Column(String(50), nullable=True)  # "none", "light", "moderate", "heavy"
    leaves_removed = Column(Boolean, default=False)
    dust_accumulation = Column(String(50), nullable=True)  # For post-dust storm checks

    # Photos (REQUIRED: blue_water_photo)
    blue_water_photo = Column(String(500), nullable=True)  # MANDATORY for completion
    before_photos = Column(JSON, nullable=True)  # List of photo URLs
    after_photos = Column(JSON, nullable=True)
    chemical_reading_photo = Column(String(500), nullable=True)  # Photo of test strip
    equipment_photos = Column(JSON, nullable=True)

    # Service performed
    chemicals_added = Column(JSON, nullable=True)  # {"chlorine_shock": "2lbs", "muriatic_acid": "1qt"}
    tasks_completed = Column(JSON, nullable=True)  # ["brushed walls", "vacuumed", "backwashed filter"]
    issues_found = Column(Text, nullable=True)
    issues_resolved = Column(Text, nullable=True)

    # Billing
    service_fee = Column(Numeric(10, 2), default=50.00)  # Base $50 per service
    chemicals_cost = Column(Numeric(10, 2), default=0)
    emergency_fee = Column(Numeric(10, 2), default=0)  # Extra for urgent/weather calls
    total_cost = Column(Numeric(10, 2), nullable=True)
    is_billed = Column(Boolean, default=False)
    billed_at = Column(DateTime, nullable=True)

    # Weather context
    weather_at_service = Column(JSON, nullable=True)  # Weather conditions during service
    post_dust_storm_service = Column(Boolean, default=False)  # True if scheduled due to dust storm

    # Notes
    tech_notes = Column(Text, nullable=True)
    customer_notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    technician = relationship("PoolTechnician", back_populates="service_jobs")

    def calculate_total_cost(self) -> float:
        """Calculate total cost including service fee, chemicals, and emergency fee."""
        base = float(self.service_fee or 50)
        chemicals = float(self.chemicals_cost or 0)
        emergency = float(self.emergency_fee or 0)
        return base + chemicals + emergency

    def is_chemical_balanced(self) -> bool:
        """Check if all chemical readings are within target ranges."""
        if not all([self.ph_level, self.chlorine_level]):
            return False

        ph_ok = 7.2 <= self.ph_level <= 7.6
        chlorine_ok = 1.0 <= self.chlorine_level <= 3.0
        alkalinity_ok = (not self.alkalinity_level or
                        80 <= self.alkalinity_level <= 120)

        return ph_ok and chlorine_ok and alkalinity_ok

    def __repr__(self) -> str:
        status = "URGENT" if self.weather_elevated else self.priority.value
        return f"<PoolServiceJob {self.id}: {self.property_id} [{status}]>"


# ============================================================================
# POOL SERVICE PROPERTY SETTINGS
# ============================================================================

class PropertyPoolSettings(Base):
    """Pool-specific settings for each property."""
    __tablename__ = "property_pool_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, unique=True)

    # Pool characteristics
    has_pool = Column(Boolean, default=True)
    pool_type = Column(String(50), nullable=True)  # "inground", "above_ground", "infinity"
    pool_size_gallons = Column(Integer, nullable=True)
    pool_surface = Column(String(50), nullable=True)  # "plaster", "pebble", "vinyl", "fiberglass"

    # Hot tub
    has_hot_tub = Column(Boolean, default=False)
    hot_tub_gallons = Column(Integer, nullable=True)

    # Service preferences
    service_frequency = Column(String(50), default="weekly")  # "weekly", "bi-weekly", "monthly"
    preferred_day = Column(String(20), nullable=True)  # "monday", "tuesday", etc.
    preferred_technician_id = Column(Integer, ForeignKey("pool_technicians.id"), nullable=True)

    # Service fees for this property
    base_service_fee = Column(Numeric(10, 2), default=50.00)
    deep_clean_fee = Column(Numeric(10, 2), default=150.00)

    # Weather-triggered settings
    auto_elevate_dust_storms = Column(Boolean, default=True)
    auto_schedule_post_storm = Column(Boolean, default=True)  # Auto-schedule service after dust storm

    # Target chemical levels (can customize per property)
    target_ph_min = Column(Float, default=7.2)
    target_ph_max = Column(Float, default=7.6)
    target_chlorine_min = Column(Float, default=1.0)
    target_chlorine_max = Column(Float, default=3.0)

    # Equipment info
    pump_brand = Column(String(100), nullable=True)
    filter_type = Column(String(50), nullable=True)  # "sand", "cartridge", "DE"
    heater_type = Column(String(50), nullable=True)  # "gas", "electric", "solar", "heat_pump"
    automation_system = Column(String(100), nullable=True)  # "Pentair", "Hayward", etc.

    # Notes
    special_instructions = Column(Text, nullable=True)
    access_notes = Column(Text, nullable=True)  # Gate code, key location, etc.

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
