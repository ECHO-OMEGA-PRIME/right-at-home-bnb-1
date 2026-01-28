"""
Right at Home BnB - Property Inventory Management Models
=========================================================
Track supplies, linens, toiletries, and cleaning items per property.
Integrates with cleaner check-out to flag low stock items.

@author ECHO OMEGA PRIME
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
import uuid


# ============================================================================
# ENUMS
# ============================================================================

class InventoryCategory(str, enum.Enum):
    """Categories for inventory items."""
    LINENS = "LINENS"              # Bed sheets, towels, blankets
    TOILETRIES = "TOILETRIES"      # Soap, shampoo, toilet paper
    CLEANING = "CLEANING"          # Cleaning supplies, chemicals
    KITCHEN = "KITCHEN"            # Dishes, utensils, appliances
    OUTDOOR = "OUTDOOR"            # Patio furniture, BBQ supplies
    ELECTRONICS = "ELECTRONICS"    # Remotes, batteries, chargers
    SAFETY = "SAFETY"              # First aid, fire extinguishers
    MAINTENANCE = "MAINTENANCE"    # Tools, spare parts, bulbs


class InventoryLogReason(str, enum.Enum):
    """Reasons for inventory changes."""
    RESTOCK = "RESTOCK"            # Items added via restocking
    USED = "USED"                  # Items consumed/used
    DAMAGED = "DAMAGED"            # Items damaged/disposed
    TRANSFERRED = "TRANSFERRED"    # Items moved between properties
    ADJUSTMENT = "ADJUSTMENT"      # Manual count adjustment
    INITIAL = "INITIAL"            # Initial inventory setup
    CLEANER_REPORT = "CLEANER_REPORT"  # Reported by cleaner checkout


class ItemUnit(str, enum.Enum):
    """Units of measurement for inventory items."""
    EACH = "EACH"
    SET = "SET"
    ROLL = "ROLL"
    BOTTLE = "BOTTLE"
    BOX = "BOX"
    PACK = "PACK"
    BAG = "BAG"
    GALLON = "GALLON"
    OUNCE = "OUNCE"
    POUND = "POUND"


class StockStatus(str, enum.Enum):
    """Current stock status for an item."""
    IN_STOCK = "IN_STOCK"
    LOW_STOCK = "LOW_STOCK"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    OVERSTOCKED = "OVERSTOCKED"


# ============================================================================
# MODELS
# ============================================================================

class InventoryItem(Base):
    """
    Represents a trackable inventory item at a property.
    Examples: Bed sheets (queen), Hand towels, Toilet paper, Dish soap
    """
    __tablename__ = "inventory_items"

    id = Column(String, primary_key=True, default=lambda: f"inv-{uuid.uuid4().hex[:12]}")
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)

    # Item Details
    name = Column(String, nullable=False, index=True)
    description = Column(Text)
    category = Column(Enum(InventoryCategory), nullable=False, index=True)
    subcategory = Column(String)  # e.g., "Bath Towels" under LINENS

    # SKU / Identification
    sku = Column(String, index=True)
    barcode = Column(String)
    brand = Column(String)
    supplier = Column(String)

    # Quantity Tracking
    quantity = Column(Integer, nullable=False, default=0)
    unit = Column(Enum(ItemUnit), default=ItemUnit.EACH)
    reorder_level = Column(Integer, nullable=False, default=5)
    reorder_quantity = Column(Integer, default=10)  # How many to order when restocking
    max_quantity = Column(Integer)  # For overstocking alerts

    # Pricing
    unit_cost = Column(Numeric(10, 2))
    total_value = Column(Numeric(10, 2))  # Calculated: quantity * unit_cost

    # Location within property
    storage_location = Column(String)  # e.g., "Laundry closet", "Kitchen cabinet"

    # Status
    is_active = Column(Boolean, default=True)
    last_counted = Column(DateTime)
    last_restocked = Column(DateTime)

    # Notes
    notes = Column(Text)
    image_url = Column(String)

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relations
    logs = relationship("InventoryLog", back_populates="item", cascade="all, delete-orphan")

    @property
    def stock_status(self) -> StockStatus:
        """Calculate current stock status based on quantity and reorder level."""
        if self.quantity <= 0:
            return StockStatus.OUT_OF_STOCK
        elif self.quantity <= self.reorder_level:
            return StockStatus.LOW_STOCK
        elif self.max_quantity and self.quantity > self.max_quantity:
            return StockStatus.OVERSTOCKED
        return StockStatus.IN_STOCK

    @property
    def needs_reorder(self) -> bool:
        """Check if item needs to be reordered."""
        return self.quantity <= self.reorder_level


class InventoryLog(Base):
    """
    Tracks all inventory changes for audit and history.
    Every add, remove, or adjustment is logged here.
    """
    __tablename__ = "inventory_logs"

    id = Column(String, primary_key=True, default=lambda: f"invlog-{uuid.uuid4().hex[:12]}")
    item_id = Column(String, ForeignKey("inventory_items.id"), nullable=False, index=True)

    # Change Details
    quantity_change = Column(Integer, nullable=False)  # Positive for add, negative for remove
    previous_quantity = Column(Integer, nullable=False)
    new_quantity = Column(Integer, nullable=False)

    # Reason & Context
    reason = Column(Enum(InventoryLogReason), nullable=False, index=True)
    reason_detail = Column(String)  # Additional context

    # Related Records
    cleaning_job_id = Column(String, ForeignKey("cleaning_jobs.id"))
    user_id = Column(String, ForeignKey("users.id"))  # Who made the change

    # Cost Tracking
    unit_cost_at_time = Column(Numeric(10, 2))
    total_cost = Column(Numeric(10, 2))

    # Notes
    notes = Column(Text)

    # Timestamp
    created_at = Column(DateTime, default=func.now(), index=True)

    # Relations
    item = relationship("InventoryItem", back_populates="logs")


class InventoryTemplate(Base):
    """
    Standard inventory templates for different property types.
    Makes it easy to set up new properties with default items.
    """
    __tablename__ = "inventory_templates"

    id = Column(String, primary_key=True, default=lambda: f"invtpl-{uuid.uuid4().hex[:12]}")
    name = Column(String, nullable=False, unique=True)
    description = Column(Text)

    # Template Type
    property_type = Column(String)  # e.g., "1BR Apartment", "3BR House"
    max_guests = Column(Integer)

    # Standard Items (JSON array of item templates)
    # Format: [{"name": "Bath Towel", "category": "LINENS", "default_qty": 8, ...}, ...]
    items = Column(JSON, nullable=False)

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class ShoppingList(Base):
    """
    Generated shopping lists for inventory restocking.
    Can be created manually or auto-generated from low-stock items.
    """
    __tablename__ = "shopping_lists"

    id = Column(String, primary_key=True, default=lambda: f"shop-{uuid.uuid4().hex[:12]}")
    name = Column(String, nullable=False)
    description = Column(Text)

    # Scope
    property_id = Column(String, ForeignKey("properties.id"))  # NULL = all properties
    is_multi_property = Column(Boolean, default=False)

    # Items (JSON array)
    # Format: [{"item_id": "...", "item_name": "...", "quantity": 10, "unit_cost": 5.99, ...}, ...]
    items = Column(JSON, nullable=False)

    # Totals
    total_items = Column(Integer, default=0)
    estimated_total = Column(Numeric(10, 2), default=0)

    # Status
    status = Column(String, default="pending")  # pending, purchased, partial, cancelled
    purchased_at = Column(DateTime)
    purchased_by_id = Column(String, ForeignKey("users.id"))

    # Notes
    notes = Column(Text)
    store_preference = Column(String)  # Preferred store for purchase

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class CleanerInventoryReport(Base):
    """
    Links cleaner checkout reports to inventory issues flagged.
    When a cleaner completes a job, they can report low/missing items.
    """
    __tablename__ = "cleaner_inventory_reports"

    id = Column(String, primary_key=True, default=lambda: f"cinvrpt-{uuid.uuid4().hex[:12]}")
    cleaning_job_id = Column(String, ForeignKey("cleaning_jobs.id"), nullable=False, index=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    cleaner_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)

    # Reported Items (JSON array)
    # Format: [{"item_name": "...", "category": "...", "issue": "low|out|damaged", "notes": "..."}, ...]
    reported_items = Column(JSON, nullable=False)

    # Summary
    total_items_flagged = Column(Integer, default=0)
    requires_urgent_restock = Column(Boolean, default=False)

    # Resolution
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    resolved_by_id = Column(String, ForeignKey("users.id"))
    resolution_notes = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=func.now(), index=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


# ============================================================================
# DEFAULT INVENTORY TEMPLATES
# ============================================================================

DEFAULT_INVENTORY_ITEMS = {
    "LINENS": [
        {"name": "Queen Bed Sheet Set", "default_qty": 4, "reorder_level": 2, "unit": "SET"},
        {"name": "King Bed Sheet Set", "default_qty": 2, "reorder_level": 1, "unit": "SET"},
        {"name": "Bath Towel", "default_qty": 8, "reorder_level": 4, "unit": "EACH"},
        {"name": "Hand Towel", "default_qty": 8, "reorder_level": 4, "unit": "EACH"},
        {"name": "Washcloth", "default_qty": 12, "reorder_level": 6, "unit": "EACH"},
        {"name": "Kitchen Towel", "default_qty": 6, "reorder_level": 3, "unit": "EACH"},
        {"name": "Pillow", "default_qty": 6, "reorder_level": 4, "unit": "EACH"},
        {"name": "Blanket/Throw", "default_qty": 4, "reorder_level": 2, "unit": "EACH"},
    ],
    "TOILETRIES": [
        {"name": "Toilet Paper Roll", "default_qty": 24, "reorder_level": 12, "unit": "ROLL"},
        {"name": "Hand Soap", "default_qty": 4, "reorder_level": 2, "unit": "BOTTLE"},
        {"name": "Shampoo", "default_qty": 4, "reorder_level": 2, "unit": "BOTTLE"},
        {"name": "Conditioner", "default_qty": 4, "reorder_level": 2, "unit": "BOTTLE"},
        {"name": "Body Wash", "default_qty": 4, "reorder_level": 2, "unit": "BOTTLE"},
        {"name": "Facial Tissue Box", "default_qty": 6, "reorder_level": 3, "unit": "BOX"},
        {"name": "Paper Towel Roll", "default_qty": 8, "reorder_level": 4, "unit": "ROLL"},
    ],
    "CLEANING": [
        {"name": "All-Purpose Cleaner", "default_qty": 3, "reorder_level": 1, "unit": "BOTTLE"},
        {"name": "Glass Cleaner", "default_qty": 2, "reorder_level": 1, "unit": "BOTTLE"},
        {"name": "Bathroom Cleaner", "default_qty": 2, "reorder_level": 1, "unit": "BOTTLE"},
        {"name": "Dish Soap", "default_qty": 3, "reorder_level": 1, "unit": "BOTTLE"},
        {"name": "Dishwasher Pods", "default_qty": 1, "reorder_level": 1, "unit": "BOX"},
        {"name": "Laundry Detergent", "default_qty": 2, "reorder_level": 1, "unit": "BOTTLE"},
        {"name": "Trash Bags (Large)", "default_qty": 2, "reorder_level": 1, "unit": "BOX"},
        {"name": "Trash Bags (Small)", "default_qty": 2, "reorder_level": 1, "unit": "BOX"},
        {"name": "Sponges", "default_qty": 8, "reorder_level": 4, "unit": "EACH"},
    ],
    "KITCHEN": [
        {"name": "Coffee Pods/Filters", "default_qty": 2, "reorder_level": 1, "unit": "BOX"},
        {"name": "Coffee (Ground)", "default_qty": 2, "reorder_level": 1, "unit": "BAG"},
        {"name": "Tea Bags", "default_qty": 1, "reorder_level": 1, "unit": "BOX"},
        {"name": "Sugar Packets", "default_qty": 1, "reorder_level": 1, "unit": "BOX"},
        {"name": "Creamer", "default_qty": 2, "reorder_level": 1, "unit": "EACH"},
        {"name": "Salt/Pepper Set", "default_qty": 1, "reorder_level": 0, "unit": "SET"},
        {"name": "Cooking Oil", "default_qty": 1, "reorder_level": 1, "unit": "BOTTLE"},
    ],
    "OUTDOOR": [
        {"name": "BBQ Propane Tank", "default_qty": 2, "reorder_level": 1, "unit": "EACH"},
        {"name": "Grill Cleaning Brush", "default_qty": 1, "reorder_level": 0, "unit": "EACH"},
        {"name": "Patio Cushion", "default_qty": 4, "reorder_level": 2, "unit": "EACH"},
        {"name": "Pool Towel", "default_qty": 6, "reorder_level": 3, "unit": "EACH"},
    ],
    "SAFETY": [
        {"name": "First Aid Kit", "default_qty": 1, "reorder_level": 0, "unit": "EACH"},
        {"name": "Fire Extinguisher", "default_qty": 1, "reorder_level": 0, "unit": "EACH"},
        {"name": "Smoke Detector Battery", "default_qty": 4, "reorder_level": 2, "unit": "EACH"},
        {"name": "Flashlight", "default_qty": 2, "reorder_level": 1, "unit": "EACH"},
    ],
    "ELECTRONICS": [
        {"name": "AA Battery", "default_qty": 1, "reorder_level": 1, "unit": "PACK"},
        {"name": "AAA Battery", "default_qty": 1, "reorder_level": 1, "unit": "PACK"},
        {"name": "TV Remote Battery", "default_qty": 4, "reorder_level": 2, "unit": "EACH"},
        {"name": "Phone Charger Cable", "default_qty": 2, "reorder_level": 1, "unit": "EACH"},
        {"name": "Light Bulb (Standard)", "default_qty": 4, "reorder_level": 2, "unit": "EACH"},
        {"name": "Light Bulb (Specialty)", "default_qty": 2, "reorder_level": 1, "unit": "EACH"},
    ],
}
