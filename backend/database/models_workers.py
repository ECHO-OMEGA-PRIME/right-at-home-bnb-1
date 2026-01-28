"""
SQLAlchemy Models for Workers and Pool Tech Services
Right at Home BnB - Pool Tech Worker Portal

Models:
- Worker (base model for all service providers)
- PoolServiceJob (pool service with chemical readings and photos)
- WeatherAlert (for auto-priority elevation)

@author ECHO OMEGA PRIME
"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date,
    Text, Numeric, ForeignKey, Enum, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum
from .connection import Base


# ============================================
# ENUMS
# ============================================

class WorkerType(str, enum.Enum):
    """Types of workers in the system."""
    CLEANER = "cleaner"
    POOL_TECH = "pool_tech"
    LAWN_SERVICE = "lawn_service"
    MAINTENANCE = "maintenance"
    HVAC = "hvac"


class TaskPriority(str, enum.Enum):
    """Priority levels for service jobs."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class PoolStatus(str, enum.Enum):
    """Pool condition status after inspection."""
    EXCELLENT = "excellent"
    GOOD = "good"
    NEEDS_ATTENTION = "needs_attention"
    UNSAFE = "unsafe"


class JobStatus(str, enum.Enum):
    """Status of a service job."""
    SCHEDULED = "scheduled"
    ASSIGNED = "assigned"
    EN_ROUTE = "en_route"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ISSUE_REPORTED = "issue_reported"


class EquipmentStatus(str, enum.Enum):
    """Status of pool equipment."""
    GOOD = "good"
    NEEDS_SERVICE = "needs_service"
    DAMAGED = "damaged"
    NOT_APPLICABLE = "n/a"


# ============================================
# MODELS
# ============================================

class Worker(Base):
    """Base worker table for all service providers."""
    __tablename__ = "workers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)

    # Basic info
    name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False, unique=True, index=True)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(String(500), nullable=True)

    # Worker type
    worker_type = Column(Enum(WorkerType), nullable=False, index=True)

    # Rates
    hourly_rate = Column(Numeric(10, 2), nullable=True)
    per_job_rate = Column(Numeric(10, 2), nullable=True)

    # Status
    is_active = Column(Boolean, default=True, index=True)
    is_verified = Column(Boolean, default=False)

    # Location (for routing/GPS)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    last_location_update = Column(DateTime, nullable=True)

    # Certifications (for pool techs, HVAC, etc.)
    certifications = Column(JSON, nullable=True)  # ["CPO", "NSPF", etc.]
    certification_expiry = Column(Date, nullable=True)

    # Performance metrics
    total_jobs = Column(Integer, default=0)
    completed_jobs = Column(Integer, default=0)
    avg_rating = Column(Float, nullable=True)
    avg_job_duration_minutes = Column(Integer, nullable=True)

    # Notes
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relations
    pool_service_jobs = relationship("PoolServiceJob", back_populates="worker")
    lawn_service_jobs = relationship("LawnServiceJob", back_populates="worker")

    def __repr__(self):
        return f"<Worker {self.name} ({self.worker_type.value})>"


class PoolServiceJob(Base):
    """Pool service job with chemical readings and photos."""
    __tablename__ = "pool_service_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=True, index=True)

    # Scheduling
    scheduled_at = Column(DateTime, nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Status
    status = Column(Enum(JobStatus), default=JobStatus.SCHEDULED, index=True)

    # Priority (auto-elevated by weather or guest check-in proximity)
    priority = Column(Enum(TaskPriority), default=TaskPriority.NORMAL, index=True)
    weather_elevated = Column(Boolean, default=False)
    guest_checkin_at = Column(DateTime, nullable=True)

    # Chemical readings (REQUIRED for completion)
    # pH Target: 7.2-7.6
    ph_level = Column(Float, nullable=True)
    # Chlorine Target: 1-3 ppm
    chlorine_level = Column(Float, nullable=True)
    # Alkalinity Target: 80-120 ppm
    alkalinity_level = Column(Float, nullable=True)
    # Calcium Hardness Target: 200-400 ppm
    calcium_hardness = Column(Float, nullable=True)
    # Cyanuric Acid Target: 30-50 ppm
    cyanuric_acid = Column(Float, nullable=True)

    # Pool status
    pool_status = Column(Enum(PoolStatus), nullable=True)
    water_temp = Column(Float, nullable=True)  # Fahrenheit

    # Equipment checks
    skimmer_status = Column(Enum(EquipmentStatus), nullable=True)
    pump_status = Column(Enum(EquipmentStatus), nullable=True)
    filter_status = Column(Enum(EquipmentStatus), nullable=True)
    heater_status = Column(Enum(EquipmentStatus), nullable=True)

    # Photos (REQUIRED: blue_water_photo)
    blue_water_photo = Column(String(500), nullable=True)
    before_photos = Column(JSON, nullable=True)  # List of URLs
    after_photos = Column(JSON, nullable=True)   # List of URLs

    # Service performed
    chemicals_added = Column(JSON, nullable=True)  # {"chlorine": "2lbs", "acid": "1qt"}
    tasks_completed = Column(JSON, nullable=True)  # ["brushed walls", "vacuumed", etc.]
    issues_found = Column(Text, nullable=True)

    # Billing
    service_fee = Column(Numeric(10, 2), nullable=True, default=50)
    chemicals_cost = Column(Numeric(10, 2), default=0)
    total_cost = Column(Numeric(10, 2), nullable=True)
    is_billed = Column(Boolean, default=False)

    # Notes
    notes = Column(Text, nullable=True)
    special_instructions = Column(Text, nullable=True)

    # GPS verification
    check_in_lat = Column(Float, nullable=True)
    check_in_lng = Column(Float, nullable=True)
    check_out_lat = Column(Float, nullable=True)
    check_out_lng = Column(Float, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relations
    worker = relationship("Worker", back_populates="pool_service_jobs")

    def __repr__(self):
        return f"<PoolServiceJob {self.id} - {self.status.value}>"

    @property
    def duration_minutes(self) -> int | None:
        """Calculate job duration in minutes."""
        if self.started_at and self.completed_at:
            delta = self.completed_at - self.started_at
            return int(delta.total_seconds() / 60)
        return None

    @property
    def is_readings_complete(self) -> bool:
        """Check if all required chemical readings are provided."""
        return all([
            self.ph_level is not None,
            self.chlorine_level is not None,
            self.alkalinity_level is not None,
        ])

    @property
    def is_photo_required_complete(self) -> bool:
        """Check if required blue water photo is provided."""
        return self.blue_water_photo is not None

    def validate_readings(self) -> dict:
        """
        Validate chemical readings against safe ranges.
        Returns dict with status and any warnings.
        """
        warnings = []
        critical = []

        # pH: 7.2-7.6 (safe), 7.0-7.8 (acceptable)
        if self.ph_level is not None:
            if self.ph_level < 7.0 or self.ph_level > 7.8:
                critical.append(f"pH {self.ph_level} is outside safe range (7.0-7.8)")
            elif self.ph_level < 7.2 or self.ph_level > 7.6:
                warnings.append(f"pH {self.ph_level} is outside ideal range (7.2-7.6)")

        # Chlorine: 1-3 ppm (safe), 0.5-5 ppm (acceptable)
        if self.chlorine_level is not None:
            if self.chlorine_level < 0.5 or self.chlorine_level > 5:
                critical.append(f"Chlorine {self.chlorine_level} ppm is outside safe range (0.5-5)")
            elif self.chlorine_level < 1 or self.chlorine_level > 3:
                warnings.append(f"Chlorine {self.chlorine_level} ppm is outside ideal range (1-3)")

        # Alkalinity: 80-120 ppm (ideal), 60-180 ppm (acceptable)
        if self.alkalinity_level is not None:
            if self.alkalinity_level < 60 or self.alkalinity_level > 180:
                critical.append(f"Alkalinity {self.alkalinity_level} ppm is outside safe range (60-180)")
            elif self.alkalinity_level < 80 or self.alkalinity_level > 120:
                warnings.append(f"Alkalinity {self.alkalinity_level} ppm is outside ideal range (80-120)")

        # Calcium Hardness: 200-400 ppm (ideal), 150-500 ppm (acceptable)
        if self.calcium_hardness is not None:
            if self.calcium_hardness < 150 or self.calcium_hardness > 500:
                warnings.append(f"Calcium hardness {self.calcium_hardness} ppm is outside range (150-500)")
            elif self.calcium_hardness < 200 or self.calcium_hardness > 400:
                warnings.append(f"Calcium hardness {self.calcium_hardness} ppm is outside ideal (200-400)")

        # Cyanuric Acid: 30-50 ppm (ideal), 20-100 ppm (acceptable)
        if self.cyanuric_acid is not None:
            if self.cyanuric_acid < 20 or self.cyanuric_acid > 100:
                warnings.append(f"Cyanuric acid {self.cyanuric_acid} ppm is outside range (20-100)")
            elif self.cyanuric_acid < 30 or self.cyanuric_acid > 50:
                warnings.append(f"Cyanuric acid {self.cyanuric_acid} ppm is outside ideal (30-50)")

        return {
            "valid": len(critical) == 0,
            "critical": critical,
            "warnings": warnings,
            "pool_status_recommendation": (
                PoolStatus.UNSAFE if critical else
                PoolStatus.NEEDS_ATTENTION if warnings else
                PoolStatus.GOOD
            )
        }


class WeatherAlert(Base):
    """Track West Texas weather for pool service priority."""
    __tablename__ = "weather_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Location
    zip_code = Column(String(10), nullable=True, default="79705")  # Midland, TX

    # Weather data
    recorded_at = Column(DateTime, nullable=False, index=True)
    wind_speed_mph = Column(Float, nullable=False)
    is_dust_storm = Column(Boolean, default=False)  # wind > 30 mph
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    conditions = Column(String(100), nullable=True)

    # Source
    source = Column(String(50), default="openweathermap")
    raw_data = Column(JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<WeatherAlert {self.recorded_at} - Wind: {self.wind_speed_mph}mph>"

    @property
    def should_elevate_priority(self) -> bool:
        """Determine if pool jobs should be elevated priority."""
        return (
            self.is_dust_storm or
            self.wind_speed_mph > 30 or
            (self.temperature and self.temperature > 105)
        )


# ============================================
# LAWN SERVICE MODELS
# ============================================

class LawnTaskType(str, enum.Enum):
    """Types of lawn service tasks."""
    MOWING = "mowing"
    EDGING = "edging"
    TRIMMING = "trimming"
    LEAF_REMOVAL = "leaf_removal"
    WEED_CONTROL = "weed_control"
    FERTILIZING = "fertilizing"
    AERATION = "aeration"
    SPRINKLER_CHECK = "sprinkler_check"
    TREE_TRIMMING = "tree_trimming"
    HEDGE_TRIMMING = "hedge_trimming"
    DEBRIS_REMOVAL = "debris_removal"
    MULCHING = "mulching"


class YardCondition(str, enum.Enum):
    """Overall yard condition after service."""
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    NEEDS_ATTENTION = "needs_attention"
    POOR = "poor"


class LawnEquipmentIssue(str, enum.Enum):
    """Equipment issues discovered during service."""
    NONE = "none"
    SPRINKLER_BROKEN = "sprinkler_broken"
    SPRINKLER_MISALIGNED = "sprinkler_misaligned"
    FENCE_DAMAGED = "fence_damaged"
    GATE_ISSUE = "gate_issue"
    DEAD_SPOTS = "dead_spots"
    PEST_DAMAGE = "pest_damage"
    DRAINAGE_ISSUE = "drainage_issue"
    TREE_DAMAGE = "tree_damage"
    OTHER = "other"


class LawnServiceJob(Base):
    """Lawn service job with tasks, photos, and equipment checks."""
    __tablename__ = "lawn_service_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=True, index=True)

    # Scheduling
    scheduled_at = Column(DateTime, nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Status
    status = Column(Enum(JobStatus), default=JobStatus.SCHEDULED, index=True)

    # Priority (auto-elevated by weather or guest check-in proximity)
    priority = Column(Enum(TaskPriority), default=TaskPriority.NORMAL, index=True)
    weather_elevated = Column(Boolean, default=False)
    guest_checkin_at = Column(DateTime, nullable=True)

    # Job type/description
    job_type = Column(String(100), default="Weekly Maintenance")  # Weekly Maintenance, Post-Guest, One-Time, etc.
    job_description = Column(Text, nullable=True)

    # Tasks completed (checkbox-style tracking)
    tasks_completed = Column(JSON, nullable=True)  # ["mowing", "edging", "trimming", etc.]

    # Yard condition
    yard_condition = Column(Enum(YardCondition), nullable=True)
    front_yard_condition = Column(Enum(YardCondition), nullable=True)
    back_yard_condition = Column(Enum(YardCondition), nullable=True)

    # Equipment/Property issues found
    equipment_issues = Column(JSON, nullable=True)  # List of LawnEquipmentIssue values
    issues_description = Column(Text, nullable=True)
    issues_require_maintenance = Column(Boolean, default=False)
    maintenance_request_id = Column(Integer, nullable=True)  # Link to created maintenance request

    # Photos (mobile-friendly upload)
    before_photos = Column(JSON, nullable=True)  # List of URLs
    after_photos = Column(JSON, nullable=True)   # List of URLs - REQUIRED for completion
    issue_photos = Column(JSON, nullable=True)   # Photos of any issues found

    # Sprinkler/Irrigation check
    sprinkler_checked = Column(Boolean, default=False)
    sprinkler_all_zones_working = Column(Boolean, nullable=True)
    sprinkler_notes = Column(Text, nullable=True)

    # Materials used
    materials_used = Column(JSON, nullable=True)  # {"fertilizer": "2lbs", "weed_killer": "1gal", etc.}

    # Billing
    service_fee = Column(Numeric(10, 2), nullable=True, default=75)
    materials_cost = Column(Numeric(10, 2), default=0)
    total_cost = Column(Numeric(10, 2), nullable=True)
    is_billed = Column(Boolean, default=False)

    # Worker notes
    notes = Column(Text, nullable=True)
    special_instructions = Column(Text, nullable=True)

    # GPS verification
    check_in_lat = Column(Float, nullable=True)
    check_in_lng = Column(Float, nullable=True)
    check_out_lat = Column(Float, nullable=True)
    check_out_lng = Column(Float, nullable=True)

    # Time tracking
    estimated_duration_minutes = Column(Integer, default=60)
    actual_duration_minutes = Column(Integer, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relations
    worker = relationship("Worker", back_populates="lawn_service_jobs")

    def __repr__(self):
        return f"<LawnServiceJob {self.id} - {self.status.value}>"

    @property
    def duration_minutes(self) -> int | None:
        """Calculate job duration in minutes."""
        if self.started_at and self.completed_at:
            delta = self.completed_at - self.started_at
            return int(delta.total_seconds() / 60)
        return None

    @property
    def has_required_photos(self) -> bool:
        """Check if at least one after photo is provided."""
        return bool(self.after_photos and len(self.after_photos) > 0)

    @property
    def has_completed_tasks(self) -> bool:
        """Check if at least one task was marked complete."""
        return bool(self.tasks_completed and len(self.tasks_completed) > 0)

    def calculate_total_cost(self) -> float:
        """Calculate total cost (service fee + materials)."""
        service = float(self.service_fee or 0)
        materials = float(self.materials_cost or 0)
        return service + materials


class WorkerJobExpense(Base):
    """Auto-logged expense when worker completes a job."""
    __tablename__ = "worker_job_expenses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False, index=True)

    # Job reference
    job_type = Column(Enum(WorkerType), nullable=False)
    job_id = Column(Integer, nullable=True)  # Reference to pool_service_jobs

    # Expense details
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(String(500), nullable=False)
    expense_date = Column(Date, nullable=False)

    # Auto vs manual
    is_auto_logged = Column(Boolean, default=True)

    # Tax
    is_tax_deductible = Column(Boolean, default=True)
    tax_category = Column(String(100), default="Contractor Services")

    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<WorkerJobExpense ${self.amount} - {self.job_type.value}>"
