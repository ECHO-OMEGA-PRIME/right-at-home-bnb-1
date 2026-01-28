"""
SQLAlchemy Models for Maintenance Request System
Right at Home BnB - Property Maintenance Tracking

Models:
- MaintenanceRequest (property maintenance issues with photos and status tracking)
- MaintenanceCategory enum (PLUMBING, ELECTRICAL, HVAC, etc.)

@author ECHO OMEGA PRIME
"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date,
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

class MaintenanceCategory(str, enum.Enum):
    """Categories for maintenance requests."""
    PLUMBING = "plumbing"
    ELECTRICAL = "electrical"
    HVAC = "hvac"
    APPLIANCE = "appliance"
    STRUCTURAL = "structural"
    DOOR_WINDOW = "door_window"
    FLOORING = "flooring"
    PAINTING = "painting"
    PEST_CONTROL = "pest_control"
    LANDSCAPING = "landscaping"
    POOL_SPA = "pool_spa"
    SECURITY = "security"
    SMART_HOME = "smart_home"
    CLEANING = "cleaning"
    OTHER = "other"


class MaintenancePriority(str, enum.Enum):
    """Priority levels for maintenance requests."""
    LOW = "low"           # Can wait, minor cosmetic
    NORMAL = "normal"     # Standard repair needed
    HIGH = "high"         # Affects guest experience
    URGENT = "urgent"     # Property not usable
    EMERGENCY = "emergency"  # Safety issue, immediate response


class MaintenanceStatus(str, enum.Enum):
    """Status of a maintenance request."""
    OPEN = "open"                   # New request, not assigned
    ASSIGNED = "assigned"           # Worker assigned
    SCHEDULED = "scheduled"         # Date/time set
    IN_PROGRESS = "in_progress"     # Worker is on-site
    PENDING_PARTS = "pending_parts" # Waiting for parts/materials
    COMPLETED = "completed"         # Work done, awaiting verification
    VERIFIED = "verified"           # Owner verified completion
    CANCELLED = "cancelled"         # Request cancelled
    ON_HOLD = "on_hold"             # Temporarily paused


class ReportedBy(str, enum.Enum):
    """Who reported the maintenance issue."""
    OWNER = "owner"
    GUEST = "guest"
    CLEANER = "cleaner"
    POOL_TECH = "pool_tech"
    INSPECTION = "inspection"
    STEVEN_AI = "steven_ai"
    SMART_DEVICE = "smart_device"


# ============================================
# MODELS
# ============================================

class MaintenanceRequest(Base):
    """
    Maintenance request for property issues.
    Tracks full lifecycle from report to completion.
    """
    __tablename__ = "maintenance_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)

    # Issue details
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(Enum(MaintenanceCategory), nullable=False, index=True)
    priority = Column(Enum(MaintenancePriority), default=MaintenancePriority.NORMAL, index=True)
    status = Column(Enum(MaintenanceStatus), default=MaintenanceStatus.OPEN, index=True)

    # Location within property
    location = Column(String(200), nullable=True)  # e.g., "Master bathroom", "Kitchen"

    # Reporter info
    reported_by = Column(Enum(ReportedBy), default=ReportedBy.OWNER, index=True)
    reporter_name = Column(String(200), nullable=True)
    reporter_phone = Column(String(20), nullable=True)
    reporter_email = Column(String(200), nullable=True)

    # Related booking (if guest reported)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=True, index=True)

    # Worker assignment
    assigned_worker_id = Column(Integer, ForeignKey("workers.id"), nullable=True, index=True)
    assigned_at = Column(DateTime, nullable=True)

    # Scheduling
    scheduled_date = Column(Date, nullable=True)
    scheduled_time_start = Column(String(10), nullable=True)  # "09:00"
    scheduled_time_end = Column(String(10), nullable=True)    # "11:00"

    # Work tracking
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    actual_duration_minutes = Column(Integer, nullable=True)

    # Photos - stored as JSON arrays of URLs
    photos_reported = Column(JSON, nullable=True)     # Photos showing the issue
    photos_in_progress = Column(JSON, nullable=True)  # Photos during repair
    photos_completed = Column(JSON, nullable=True)    # After photos

    # Cost tracking
    estimated_cost = Column(Numeric(10, 2), nullable=True)
    actual_cost = Column(Numeric(10, 2), nullable=True)
    materials_cost = Column(Numeric(10, 2), default=0)
    labor_cost = Column(Numeric(10, 2), default=0)

    # Receipt/invoice
    receipt_urls = Column(JSON, nullable=True)  # List of receipt image URLs
    invoice_number = Column(String(100), nullable=True)

    # Vendor info (if external)
    vendor_name = Column(String(200), nullable=True)
    vendor_phone = Column(String(20), nullable=True)
    vendor_invoice = Column(String(100), nullable=True)

    # Work performed
    work_description = Column(Text, nullable=True)
    parts_used = Column(JSON, nullable=True)  # [{"name": "Faucet", "cost": 45.00}]

    # Recurring issue tracking
    is_recurring = Column(Boolean, default=False)
    recurrence_count = Column(Integer, default=1)
    previous_request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=True)

    # Guest impact
    guest_notified = Column(Boolean, default=False)
    affects_booking = Column(Boolean, default=False)
    temporary_fix_applied = Column(Boolean, default=False)

    # Notes
    internal_notes = Column(Text, nullable=True)  # Owner/admin notes
    worker_notes = Column(Text, nullable=True)    # Worker notes
    steven_ai_notes = Column(Text, nullable=True) # AI observations

    # Verification
    verified_by = Column(String(200), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(Text, nullable=True)

    # Auto-logged expense reference
    expense_id = Column(Integer, nullable=True)  # Reference to auto-created expense
    expense_auto_created = Column(Boolean, default=False)

    # Tax category for expense
    tax_category = Column(String(100), default="repairs")

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, onupdate=func.now())

    # Relations
    assigned_worker = relationship("Worker", foreign_keys=[assigned_worker_id])
    previous_request = relationship("MaintenanceRequest", remote_side=[id], foreign_keys=[previous_request_id])
    history = relationship("MaintenanceHistory", back_populates="maintenance_request", order_by="MaintenanceHistory.created_at")

    def __repr__(self):
        return f"<MaintenanceRequest {self.id}: {self.title} ({self.status.value})>"

    @property
    def is_overdue(self) -> bool:
        """Check if the request is past its scheduled date."""
        if self.scheduled_date and self.status not in [
            MaintenanceStatus.COMPLETED,
            MaintenanceStatus.VERIFIED,
            MaintenanceStatus.CANCELLED
        ]:
            from datetime import date
            return date.today() > self.scheduled_date
        return False

    @property
    def total_cost(self) -> float:
        """Calculate total cost (materials + labor)."""
        materials = float(self.materials_cost or 0)
        labor = float(self.labor_cost or 0)
        return materials + labor


class MaintenanceHistory(Base):
    """
    Audit trail for maintenance request changes.
    Tracks all status changes and updates.
    """
    __tablename__ = "maintenance_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    maintenance_request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False, index=True)

    # Change tracking
    action = Column(String(100), nullable=False)  # "status_change", "assigned", "note_added", etc.
    old_value = Column(String(500), nullable=True)
    new_value = Column(String(500), nullable=True)

    # Who made the change
    changed_by = Column(String(200), nullable=True)
    changed_by_type = Column(String(50), nullable=True)  # "owner", "worker", "system", "steven_ai"

    # Notes
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    # Relations
    maintenance_request = relationship("MaintenanceRequest", back_populates="history")

    def __repr__(self):
        return f"<MaintenanceHistory {self.action}: {self.old_value} -> {self.new_value}>"


class MaintenanceChecklist(Base):
    """
    Checklist items for maintenance completion verification.
    """
    __tablename__ = "maintenance_checklists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    maintenance_request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False, index=True)

    # Checklist item
    item_description = Column(String(500), nullable=False)
    is_required = Column(Boolean, default=True)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    completed_by = Column(String(200), nullable=True)

    # Photo requirement
    requires_photo = Column(Boolean, default=False)
    photo_url = Column(String(500), nullable=True)

    # Order
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<MaintenanceChecklist: {self.item_description[:50]}>"
