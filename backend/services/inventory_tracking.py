"""
Right At Home BnB - Inventory Tracking Service
===============================================
Track cleaning supplies and equipment at each property:
- Cleaning supplies (toilet paper, paper towels, soap, etc.)
- Equipment (vacuum, mops, linens, etc.)
- Minimum quantity alerts
- Reorder notifications
- Per-property inventory

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from loguru import logger

# Firebase
try:
    import firebase_admin
    from firebase_admin import firestore
    db = firestore.client() if firebase_admin._apps else None
    FIREBASE_AVAILABLE = db is not None
except:
    FIREBASE_AVAILABLE = False
    db = None


# Default inventory items for each property
DEFAULT_INVENTORY_ITEMS = [
    # Bathroom supplies
    {"category": "bathroom", "item": "Toilet paper", "unit": "rolls", "min_qty": 6, "reorder_qty": 12},
    {"category": "bathroom", "item": "Paper towels", "unit": "rolls", "min_qty": 4, "reorder_qty": 8},
    {"category": "bathroom", "item": "Hand soap", "unit": "bottles", "min_qty": 2, "reorder_qty": 4},
    {"category": "bathroom", "item": "Shampoo", "unit": "bottles", "min_qty": 2, "reorder_qty": 4},
    {"category": "bathroom", "item": "Conditioner", "unit": "bottles", "min_qty": 2, "reorder_qty": 4},
    {"category": "bathroom", "item": "Body wash", "unit": "bottles", "min_qty": 2, "reorder_qty": 4},

    # Kitchen supplies
    {"category": "kitchen", "item": "Dish soap", "unit": "bottles", "min_qty": 2, "reorder_qty": 4},
    {"category": "kitchen", "item": "Sponges", "unit": "pack", "min_qty": 1, "reorder_qty": 2},
    {"category": "kitchen", "item": "Trash bags (kitchen)", "unit": "box", "min_qty": 1, "reorder_qty": 2},
    {"category": "kitchen", "item": "Dishwasher pods", "unit": "pack", "min_qty": 1, "reorder_qty": 2},
    {"category": "kitchen", "item": "Coffee pods", "unit": "box", "min_qty": 1, "reorder_qty": 2},
    {"category": "kitchen", "item": "Coffee filters", "unit": "pack", "min_qty": 1, "reorder_qty": 2},

    # Cleaning supplies
    {"category": "cleaning", "item": "All-purpose cleaner", "unit": "bottles", "min_qty": 2, "reorder_qty": 4},
    {"category": "cleaning", "item": "Glass cleaner", "unit": "bottles", "min_qty": 1, "reorder_qty": 2},
    {"category": "cleaning", "item": "Toilet bowl cleaner", "unit": "bottles", "min_qty": 2, "reorder_qty": 4},
    {"category": "cleaning", "item": "Laundry detergent", "unit": "bottles", "min_qty": 1, "reorder_qty": 2},
    {"category": "cleaning", "item": "Fabric softener", "unit": "bottles", "min_qty": 1, "reorder_qty": 2},
    {"category": "cleaning", "item": "Dryer sheets", "unit": "box", "min_qty": 1, "reorder_qty": 2},

    # Linens
    {"category": "linens", "item": "Bath towels", "unit": "sets", "min_qty": 4, "reorder_qty": 6},
    {"category": "linens", "item": "Hand towels", "unit": "sets", "min_qty": 4, "reorder_qty": 6},
    {"category": "linens", "item": "Washcloths", "unit": "sets", "min_qty": 6, "reorder_qty": 12},
    {"category": "linens", "item": "Bed sheets (queen)", "unit": "sets", "min_qty": 2, "reorder_qty": 3},
    {"category": "linens", "item": "Bed sheets (king)", "unit": "sets", "min_qty": 2, "reorder_qty": 3},
    {"category": "linens", "item": "Pillowcases", "unit": "sets", "min_qty": 4, "reorder_qty": 6},
]

DEFAULT_EQUIPMENT = [
    {"category": "cleaning", "item": "Vacuum cleaner", "condition": "good", "last_service": None},
    {"category": "cleaning", "item": "Mop & bucket", "condition": "good", "last_service": None},
    {"category": "cleaning", "item": "Broom & dustpan", "condition": "good", "last_service": None},
    {"category": "appliance", "item": "Iron & ironing board", "condition": "good", "last_service": None},
    {"category": "appliance", "item": "Hair dryer", "condition": "good", "last_service": None},
    {"category": "outdoor", "item": "BBQ grill", "condition": "good", "last_service": None},
    {"category": "outdoor", "item": "Patio furniture", "condition": "good", "last_service": None},
    {"category": "safety", "item": "Fire extinguisher", "condition": "good", "expiry_date": None},
    {"category": "safety", "item": "First aid kit", "condition": "good", "expiry_date": None},
    {"category": "safety", "item": "Smoke detectors", "condition": "good", "battery_replaced": None},
    {"category": "safety", "item": "CO detector", "condition": "good", "battery_replaced": None},
]


class InventoryTrackingService:
    """
    Track supplies and equipment at each of Steven's 22 properties.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.inventory_collection = "rah_inventory"
        self.equipment_collection = "rah_equipment"

    async def initialize_property_inventory(self, property_id: int) -> Dict[str, Any]:
        """Initialize inventory for a new property with defaults."""
        items_created = 0

        for item in DEFAULT_INVENTORY_ITEMS:
            await self.update_inventory_item(
                property_id=property_id,
                item_name=item["item"],
                category=item["category"],
                current_qty=item["min_qty"],  # Start at minimum
                min_qty=item["min_qty"],
                reorder_qty=item["reorder_qty"],
                unit=item["unit"]
            )
            items_created += 1

        for equip in DEFAULT_EQUIPMENT:
            await self.add_equipment(
                property_id=property_id,
                item_name=equip["item"],
                category=equip["category"],
                condition=equip["condition"]
            )
            items_created += 1

        return {"success": True, "items_initialized": items_created}

    async def update_inventory_item(
        self,
        property_id: int,
        item_name: str,
        category: str = None,
        current_qty: int = None,
        min_qty: int = None,
        reorder_qty: int = None,
        unit: str = None,
        notes: str = None
    ) -> Dict[str, Any]:
        """Update inventory item for a property."""
        doc_id = f"{property_id}_{item_name.replace(' ', '_').lower()}"

        item_data = {
            "property_id": property_id,
            "item_name": item_name,
            "updated_at": datetime.utcnow().isoformat()
        }

        if category:
            item_data["category"] = category
        if current_qty is not None:
            item_data["current_qty"] = current_qty
        if min_qty is not None:
            item_data["min_qty"] = min_qty
        if reorder_qty is not None:
            item_data["reorder_qty"] = reorder_qty
        if unit:
            item_data["unit"] = unit
        if notes:
            item_data["notes"] = notes

        # Check if below minimum
        if current_qty is not None and min_qty is not None:
            item_data["below_minimum"] = current_qty < min_qty

        if self.firebase_available and db:
            db.collection(self.inventory_collection).document(doc_id).set(item_data, merge=True)

        return {"success": True, "item": item_data}

    async def add_equipment(
        self,
        property_id: int,
        item_name: str,
        category: str,
        condition: str = "good",
        serial_number: str = None,
        purchase_date: str = None,
        warranty_expiry: str = None,
        notes: str = None
    ) -> Dict[str, Any]:
        """Add equipment to a property."""
        doc_id = f"{property_id}_{item_name.replace(' ', '_').lower()}"

        equip_data = {
            "property_id": property_id,
            "item_name": item_name,
            "category": category,
            "condition": condition,
            "serial_number": serial_number,
            "purchase_date": purchase_date,
            "warranty_expiry": warranty_expiry,
            "notes": notes,
            "created_at": datetime.utcnow().isoformat()
        }

        if self.firebase_available and db:
            db.collection(self.equipment_collection).document(doc_id).set(equip_data)

        return {"success": True, "equipment": equip_data}

    async def update_equipment_condition(
        self,
        property_id: int,
        item_name: str,
        condition: str,  # good, fair, poor, needs_replacement
        issue_description: str = None
    ) -> Dict[str, Any]:
        """Update equipment condition."""
        doc_id = f"{property_id}_{item_name.replace(' ', '_').lower()}"

        updates = {
            "condition": condition,
            "has_issue": condition in ["poor", "needs_replacement"],
            "issue_description": issue_description,
            "updated_at": datetime.utcnow().isoformat()
        }

        if self.firebase_available and db:
            db.collection(self.equipment_collection).document(doc_id).update(updates)

        return {"success": True, "updates": updates}

    async def get_property_inventory(self, property_id: int) -> Dict[str, Any]:
        """Get full inventory for a property."""
        if not self.firebase_available or not db:
            return {"supplies": [], "equipment": []}

        # Get supplies
        supplies_docs = (
            db.collection(self.inventory_collection)
            .where("property_id", "==", property_id)
            .stream()
        )
        supplies = [doc.to_dict() for doc in supplies_docs]

        # Get equipment
        equip_docs = (
            db.collection(self.equipment_collection)
            .where("property_id", "==", property_id)
            .stream()
        )
        equipment = [doc.to_dict() for doc in equip_docs]

        return {
            "property_id": property_id,
            "supplies": supplies,
            "equipment": equipment,
            "low_stock_count": sum(1 for s in supplies if s.get("below_minimum")),
            "equipment_issues": sum(1 for e in equipment if e.get("has_issue"))
        }

    async def get_all_low_stock(self) -> List[Dict]:
        """Get all items below minimum across all properties."""
        if not self.firebase_available or not db:
            return []

        docs = (
            db.collection(self.inventory_collection)
            .where("below_minimum", "==", True)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    async def get_all_equipment_issues(self) -> List[Dict]:
        """Get all equipment with issues across all properties."""
        if not self.firebase_available or not db:
            return []

        docs = (
            db.collection(self.equipment_collection)
            .where("has_issue", "==", True)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    async def generate_reorder_list(self) -> Dict[str, Any]:
        """Generate a combined reorder list for all properties."""
        low_stock = await self.get_all_low_stock()

        # Group by item
        by_item = {}
        for item in low_stock:
            name = item.get("item_name")
            if name not in by_item:
                by_item[name] = {
                    "item": name,
                    "unit": item.get("unit"),
                    "properties": [],
                    "total_needed": 0
                }

            needed = item.get("reorder_qty", 0) - item.get("current_qty", 0)
            by_item[name]["properties"].append(item.get("property_id"))
            by_item[name]["total_needed"] += max(0, needed)

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "items_to_reorder": list(by_item.values()),
            "total_items": len(by_item)
        }


# Singleton instance
inventory_tracking_service = InventoryTrackingService()
