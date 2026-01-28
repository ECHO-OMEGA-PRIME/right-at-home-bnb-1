"""
Right at Home BnB - Property Inventory Management API Routes
============================================================
Manage property supplies, track stock levels, generate shopping lists.

Endpoints:
- GET /inventory/property/{id} - Get all inventory for a property
- POST /inventory/item - Add new inventory item
- PUT /inventory/item/{id}/adjust - Adjust item quantity
- GET /inventory/low-stock - Get all items below reorder level
- GET /inventory/shopping-list - Generate shopping list
- POST /inventory/shopping-list - Create shopping list
- PUT /inventory/shopping-list/{id}/purchase - Mark as purchased
- POST /inventory/cleaner-report - Submit cleaner inventory report
- POST /inventory/bulk-restock - Bulk update after restocking

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, date
from decimal import Decimal
import uuid
import logging

from database.connection import get_db
from sqlalchemy.orm import Session
from database.models_inventory import (
    InventoryItem, InventoryLog, InventoryTemplate, ShoppingList,
    CleanerInventoryReport, InventoryCategory, InventoryLogReason,
    ItemUnit, StockStatus, DEFAULT_INVENTORY_ITEMS
)

logger = logging.getLogger("RightAtHomeBnB.Inventory")
router = APIRouter()


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class InventoryItemCreate(BaseModel):
    """Create a new inventory item."""
    property_id: str
    name: str
    description: Optional[str] = None
    category: InventoryCategory
    subcategory: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    brand: Optional[str] = None
    supplier: Optional[str] = None
    quantity: int = 0
    unit: ItemUnit = ItemUnit.EACH
    reorder_level: int = 5
    reorder_quantity: int = 10
    max_quantity: Optional[int] = None
    unit_cost: Optional[float] = None
    storage_location: Optional[str] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None


class InventoryItemUpdate(BaseModel):
    """Update an existing inventory item."""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[InventoryCategory] = None
    subcategory: Optional[str] = None
    sku: Optional[str] = None
    brand: Optional[str] = None
    supplier: Optional[str] = None
    unit: Optional[ItemUnit] = None
    reorder_level: Optional[int] = None
    reorder_quantity: Optional[int] = None
    max_quantity: Optional[int] = None
    unit_cost: Optional[float] = None
    storage_location: Optional[str] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None


class QuantityAdjustment(BaseModel):
    """Adjust item quantity (add or remove)."""
    quantity_change: int = Field(..., description="Positive to add, negative to remove")
    reason: InventoryLogReason
    reason_detail: Optional[str] = None
    cleaning_job_id: Optional[str] = None
    user_id: Optional[str] = None
    notes: Optional[str] = None


class BulkRestockItem(BaseModel):
    """Single item in a bulk restock operation."""
    item_id: str
    quantity_added: int
    unit_cost: Optional[float] = None


class BulkRestockRequest(BaseModel):
    """Bulk restock multiple items at once."""
    items: List[BulkRestockItem]
    user_id: Optional[str] = None
    notes: Optional[str] = None


class CleanerReportItem(BaseModel):
    """Single item in a cleaner's inventory report."""
    item_name: str
    category: InventoryCategory
    issue: str  # "low", "out", "damaged"
    current_quantity: Optional[int] = None
    notes: Optional[str] = None


class CleanerReportCreate(BaseModel):
    """Cleaner submits inventory issues during checkout."""
    cleaning_job_id: str
    property_id: str
    cleaner_id: str
    reported_items: List[CleanerReportItem]
    requires_urgent_restock: bool = False


class ShoppingListCreate(BaseModel):
    """Create a new shopping list."""
    name: str
    description: Optional[str] = None
    property_id: Optional[str] = None  # Null for all properties
    notes: Optional[str] = None
    store_preference: Optional[str] = None


class ShoppingListItem(BaseModel):
    """Item to add to shopping list."""
    item_id: str
    item_name: str
    quantity: int
    unit: str
    unit_cost: Optional[float] = None
    property_id: Optional[str] = None


class InventoryItemResponse(BaseModel):
    """Response model for inventory item."""
    id: str
    property_id: str
    name: str
    description: Optional[str]
    category: str
    subcategory: Optional[str]
    sku: Optional[str]
    brand: Optional[str]
    supplier: Optional[str]
    quantity: int
    unit: str
    reorder_level: int
    reorder_quantity: int
    max_quantity: Optional[int]
    unit_cost: Optional[float]
    storage_location: Optional[str]
    notes: Optional[str]
    image_url: Optional[str]
    is_active: bool
    last_counted: Optional[datetime]
    last_restocked: Optional[datetime]
    stock_status: str
    needs_reorder: bool
    created_at: datetime
    updated_at: datetime


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def item_to_response(item: InventoryItem) -> dict:
    """Convert InventoryItem model to response dict."""
    return {
        "id": item.id,
        "property_id": item.property_id,
        "name": item.name,
        "description": item.description,
        "category": item.category.value if item.category else None,
        "subcategory": item.subcategory,
        "sku": item.sku,
        "brand": item.brand,
        "supplier": item.supplier,
        "quantity": item.quantity,
        "unit": item.unit.value if item.unit else "EACH",
        "reorder_level": item.reorder_level,
        "reorder_quantity": item.reorder_quantity,
        "max_quantity": item.max_quantity,
        "unit_cost": float(item.unit_cost) if item.unit_cost else None,
        "storage_location": item.storage_location,
        "notes": item.notes,
        "image_url": item.image_url,
        "is_active": item.is_active,
        "last_counted": item.last_counted,
        "last_restocked": item.last_restocked,
        "stock_status": item.stock_status.value,
        "needs_reorder": item.needs_reorder,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def create_log_entry(
    db: Session,
    item_id: str,
    quantity_change: int,
    previous_quantity: int,
    new_quantity: int,
    reason: InventoryLogReason,
    reason_detail: str = None,
    cleaning_job_id: str = None,
    user_id: str = None,
    notes: str = None,
    unit_cost: float = None
) -> InventoryLog:
    """Create an inventory log entry."""
    log = InventoryLog(
        id=f"invlog-{uuid.uuid4().hex[:12]}",
        item_id=item_id,
        quantity_change=quantity_change,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        reason=reason,
        reason_detail=reason_detail,
        cleaning_job_id=cleaning_job_id,
        user_id=user_id,
        notes=notes,
        unit_cost_at_time=unit_cost,
        total_cost=abs(quantity_change * unit_cost) if unit_cost else None
    )
    db.add(log)
    return log


# ============================================================================
# INVENTORY ITEM ENDPOINTS
# ============================================================================

@router.get("/property/{property_id}")
async def get_property_inventory(
    property_id: str,
    category: Optional[InventoryCategory] = None,
    status: Optional[StockStatus] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """Get all inventory items for a property."""
    logger.info(f"Fetching inventory for property: {property_id}")

    query = db.query(InventoryItem).filter(InventoryItem.property_id == property_id)

    if not include_inactive:
        query = query.filter(InventoryItem.is_active == True)

    if category:
        query = query.filter(InventoryItem.category == category)

    items = query.order_by(InventoryItem.category, InventoryItem.name).all()

    # Filter by status if specified (done in Python since it's a property)
    if status:
        items = [item for item in items if item.stock_status == status]

    # Group by category
    grouped = {}
    for item in items:
        cat = item.category.value
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(item_to_response(item))

    # Calculate summary
    total_items = len(items)
    low_stock_count = sum(1 for item in items if item.stock_status == StockStatus.LOW_STOCK)
    out_of_stock_count = sum(1 for item in items if item.stock_status == StockStatus.OUT_OF_STOCK)
    total_value = sum(float(item.quantity * item.unit_cost) if item.unit_cost else 0 for item in items)

    return {
        "success": True,
        "property_id": property_id,
        "summary": {
            "total_items": total_items,
            "low_stock": low_stock_count,
            "out_of_stock": out_of_stock_count,
            "total_value": round(total_value, 2),
            "needs_attention": low_stock_count + out_of_stock_count
        },
        "items_by_category": grouped,
        "items": [item_to_response(item) for item in items]
    }


@router.post("/item")
async def create_inventory_item(
    request: InventoryItemCreate,
    db: Session = Depends(get_db)
):
    """Add a new inventory item."""
    logger.info(f"Creating inventory item: {request.name} for property {request.property_id}")

    item = InventoryItem(
        id=f"inv-{uuid.uuid4().hex[:12]}",
        property_id=request.property_id,
        name=request.name,
        description=request.description,
        category=request.category,
        subcategory=request.subcategory,
        sku=request.sku,
        barcode=request.barcode,
        brand=request.brand,
        supplier=request.supplier,
        quantity=request.quantity,
        unit=request.unit,
        reorder_level=request.reorder_level,
        reorder_quantity=request.reorder_quantity,
        max_quantity=request.max_quantity,
        unit_cost=request.unit_cost,
        storage_location=request.storage_location,
        notes=request.notes,
        image_url=request.image_url,
        total_value=request.quantity * request.unit_cost if request.unit_cost else None
    )

    db.add(item)

    # Log initial inventory
    if request.quantity > 0:
        create_log_entry(
            db=db,
            item_id=item.id,
            quantity_change=request.quantity,
            previous_quantity=0,
            new_quantity=request.quantity,
            reason=InventoryLogReason.INITIAL,
            reason_detail="Initial inventory setup",
            unit_cost=request.unit_cost
        )

    db.commit()
    db.refresh(item)

    return {
        "success": True,
        "message": f"Inventory item '{request.name}' created",
        "item": item_to_response(item)
    }


@router.get("/item/{item_id}")
async def get_inventory_item(
    item_id: str,
    include_history: bool = False,
    history_limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get a single inventory item with optional history."""
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    response = {
        "success": True,
        "item": item_to_response(item)
    }

    if include_history:
        logs = db.query(InventoryLog).filter(
            InventoryLog.item_id == item_id
        ).order_by(InventoryLog.created_at.desc()).limit(history_limit).all()

        response["history"] = [{
            "id": log.id,
            "quantity_change": log.quantity_change,
            "previous_quantity": log.previous_quantity,
            "new_quantity": log.new_quantity,
            "reason": log.reason.value,
            "reason_detail": log.reason_detail,
            "notes": log.notes,
            "created_at": log.created_at
        } for log in logs]

    return response


@router.put("/item/{item_id}")
async def update_inventory_item(
    item_id: str,
    request: InventoryItemUpdate,
    db: Session = Depends(get_db)
):
    """Update inventory item details (not quantity)."""
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    # Update fields if provided
    update_data = request.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(item, field):
            setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return {
        "success": True,
        "message": f"Inventory item '{item.name}' updated",
        "item": item_to_response(item)
    }


@router.put("/item/{item_id}/adjust")
async def adjust_item_quantity(
    item_id: str,
    request: QuantityAdjustment,
    db: Session = Depends(get_db)
):
    """Adjust item quantity (add or remove stock)."""
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    previous_quantity = item.quantity
    new_quantity = previous_quantity + request.quantity_change

    if new_quantity < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reduce quantity below 0. Current: {previous_quantity}, Change: {request.quantity_change}"
        )

    # Update quantity
    item.quantity = new_quantity
    item.total_value = new_quantity * float(item.unit_cost) if item.unit_cost else None

    # Update timestamps based on action
    if request.quantity_change > 0 and request.reason == InventoryLogReason.RESTOCK:
        item.last_restocked = datetime.utcnow()

    if request.reason == InventoryLogReason.ADJUSTMENT:
        item.last_counted = datetime.utcnow()

    # Create log entry
    create_log_entry(
        db=db,
        item_id=item_id,
        quantity_change=request.quantity_change,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        reason=request.reason,
        reason_detail=request.reason_detail,
        cleaning_job_id=request.cleaning_job_id,
        user_id=request.user_id,
        notes=request.notes,
        unit_cost=float(item.unit_cost) if item.unit_cost else None
    )

    db.commit()
    db.refresh(item)

    action = "added" if request.quantity_change > 0 else "removed"
    logger.info(f"Inventory adjusted: {abs(request.quantity_change)} {action} from {item.name}")

    return {
        "success": True,
        "message": f"{abs(request.quantity_change)} {item.unit.value}(s) {action}",
        "item": item_to_response(item),
        "previous_quantity": previous_quantity,
        "new_quantity": new_quantity,
        "change": request.quantity_change
    }


@router.delete("/item/{item_id}")
async def delete_inventory_item(
    item_id: str,
    hard_delete: bool = False,
    db: Session = Depends(get_db)
):
    """Delete (deactivate) an inventory item."""
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    if hard_delete:
        db.delete(item)
        message = f"Inventory item '{item.name}' permanently deleted"
    else:
        item.is_active = False
        message = f"Inventory item '{item.name}' deactivated"

    db.commit()

    return {"success": True, "message": message}


# ============================================================================
# LOW STOCK & SHOPPING LIST ENDPOINTS
# ============================================================================

@router.get("/low-stock")
async def get_low_stock_items(
    property_id: Optional[str] = None,
    category: Optional[InventoryCategory] = None,
    include_out_of_stock: bool = True,
    db: Session = Depends(get_db)
):
    """Get all items below their reorder level."""
    logger.info(f"Checking low stock items for property: {property_id or 'ALL'}")

    query = db.query(InventoryItem).filter(
        InventoryItem.is_active == True,
        InventoryItem.quantity <= InventoryItem.reorder_level
    )

    if property_id:
        query = query.filter(InventoryItem.property_id == property_id)

    if category:
        query = query.filter(InventoryItem.category == category)

    items = query.order_by(InventoryItem.quantity).all()

    # Separate out of stock vs low stock
    out_of_stock = [item for item in items if item.quantity == 0]
    low_stock = [item for item in items if item.quantity > 0]

    response_items = []
    if include_out_of_stock:
        response_items.extend([{**item_to_response(item), "urgency": "critical"} for item in out_of_stock])
    response_items.extend([{**item_to_response(item), "urgency": "warning"} for item in low_stock])

    # Group by property for multi-property view
    by_property = {}
    for item in items:
        pid = item.property_id
        if pid not in by_property:
            by_property[pid] = {"out_of_stock": 0, "low_stock": 0, "items": []}
        if item.quantity == 0:
            by_property[pid]["out_of_stock"] += 1
        else:
            by_property[pid]["low_stock"] += 1
        by_property[pid]["items"].append(item_to_response(item))

    return {
        "success": True,
        "summary": {
            "total_items_needing_attention": len(items),
            "out_of_stock_count": len(out_of_stock),
            "low_stock_count": len(low_stock),
            "properties_affected": len(by_property)
        },
        "items": response_items,
        "by_property": by_property
    }


@router.get("/shopping-list")
async def generate_shopping_list(
    property_id: Optional[str] = None,
    category: Optional[InventoryCategory] = None,
    include_buffer: bool = True,
    db: Session = Depends(get_db)
):
    """Generate a shopping list from low stock items."""
    query = db.query(InventoryItem).filter(
        InventoryItem.is_active == True,
        InventoryItem.quantity <= InventoryItem.reorder_level
    )

    if property_id:
        query = query.filter(InventoryItem.property_id == property_id)

    if category:
        query = query.filter(InventoryItem.category == category)

    items = query.all()

    shopping_items = []
    total_cost = 0

    for item in items:
        # Calculate quantity to order
        qty_needed = item.reorder_quantity if include_buffer else (item.reorder_level - item.quantity + 1)
        if qty_needed <= 0:
            qty_needed = item.reorder_quantity or 5

        item_cost = qty_needed * float(item.unit_cost) if item.unit_cost else 0
        total_cost += item_cost

        shopping_items.append({
            "item_id": item.id,
            "item_name": item.name,
            "category": item.category.value,
            "property_id": item.property_id,
            "current_quantity": item.quantity,
            "reorder_level": item.reorder_level,
            "quantity_to_order": qty_needed,
            "unit": item.unit.value,
            "unit_cost": float(item.unit_cost) if item.unit_cost else None,
            "estimated_cost": round(item_cost, 2),
            "brand": item.brand,
            "supplier": item.supplier,
            "urgency": "critical" if item.quantity == 0 else "normal"
        })

    # Sort by urgency then category
    shopping_items.sort(key=lambda x: (0 if x["urgency"] == "critical" else 1, x["category"]))

    return {
        "success": True,
        "generated_at": datetime.utcnow().isoformat(),
        "filter": {
            "property_id": property_id,
            "category": category.value if category else None
        },
        "summary": {
            "total_items": len(shopping_items),
            "estimated_total": round(total_cost, 2),
            "critical_items": sum(1 for i in shopping_items if i["urgency"] == "critical")
        },
        "items": shopping_items
    }


@router.post("/shopping-list")
async def create_shopping_list(
    request: ShoppingListCreate,
    auto_populate: bool = True,
    db: Session = Depends(get_db)
):
    """Create a new shopping list, optionally auto-populated from low stock."""
    items = []

    if auto_populate:
        query = db.query(InventoryItem).filter(
            InventoryItem.is_active == True,
            InventoryItem.quantity <= InventoryItem.reorder_level
        )
        if request.property_id:
            query = query.filter(InventoryItem.property_id == request.property_id)

        low_stock_items = query.all()

        for item in low_stock_items:
            qty_needed = item.reorder_quantity or (item.reorder_level - item.quantity + 5)
            items.append({
                "item_id": item.id,
                "item_name": item.name,
                "quantity": qty_needed,
                "unit": item.unit.value,
                "unit_cost": float(item.unit_cost) if item.unit_cost else None,
                "property_id": item.property_id
            })

    total_cost = sum(i.get("quantity", 0) * (i.get("unit_cost") or 0) for i in items)

    shopping_list = ShoppingList(
        id=f"shop-{uuid.uuid4().hex[:12]}",
        name=request.name,
        description=request.description,
        property_id=request.property_id,
        is_multi_property=request.property_id is None,
        items=items,
        total_items=len(items),
        estimated_total=total_cost,
        notes=request.notes,
        store_preference=request.store_preference
    )

    db.add(shopping_list)
    db.commit()
    db.refresh(shopping_list)

    return {
        "success": True,
        "message": f"Shopping list '{request.name}' created with {len(items)} items",
        "shopping_list": {
            "id": shopping_list.id,
            "name": shopping_list.name,
            "description": shopping_list.description,
            "property_id": shopping_list.property_id,
            "total_items": shopping_list.total_items,
            "estimated_total": float(shopping_list.estimated_total),
            "items": shopping_list.items,
            "status": shopping_list.status,
            "created_at": shopping_list.created_at
        }
    }


@router.get("/shopping-lists")
async def list_shopping_lists(
    status: Optional[str] = None,
    property_id: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """List all shopping lists."""
    query = db.query(ShoppingList)

    if status:
        query = query.filter(ShoppingList.status == status)
    if property_id:
        query = query.filter(ShoppingList.property_id == property_id)

    lists = query.order_by(ShoppingList.created_at.desc()).limit(limit).all()

    return {
        "success": True,
        "count": len(lists),
        "shopping_lists": [{
            "id": sl.id,
            "name": sl.name,
            "property_id": sl.property_id,
            "total_items": sl.total_items,
            "estimated_total": float(sl.estimated_total) if sl.estimated_total else 0,
            "status": sl.status,
            "created_at": sl.created_at,
            "purchased_at": sl.purchased_at
        } for sl in lists]
    }


@router.put("/shopping-list/{list_id}/purchase")
async def mark_shopping_list_purchased(
    list_id: str,
    user_id: Optional[str] = None,
    update_inventory: bool = True,
    db: Session = Depends(get_db)
):
    """Mark shopping list as purchased and optionally update inventory."""
    shopping_list = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()

    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")

    shopping_list.status = "purchased"
    shopping_list.purchased_at = datetime.utcnow()
    shopping_list.purchased_by_id = user_id

    # Update inventory quantities
    if update_inventory and shopping_list.items:
        for item_data in shopping_list.items:
            item_id = item_data.get("item_id")
            quantity = item_data.get("quantity", 0)

            if item_id and quantity > 0:
                item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
                if item:
                    prev_qty = item.quantity
                    item.quantity += quantity
                    item.last_restocked = datetime.utcnow()

                    create_log_entry(
                        db=db,
                        item_id=item_id,
                        quantity_change=quantity,
                        previous_quantity=prev_qty,
                        new_quantity=item.quantity,
                        reason=InventoryLogReason.RESTOCK,
                        reason_detail=f"From shopping list: {shopping_list.name}",
                        user_id=user_id,
                        unit_cost=float(item.unit_cost) if item.unit_cost else None
                    )

    db.commit()

    return {
        "success": True,
        "message": f"Shopping list '{shopping_list.name}' marked as purchased",
        "inventory_updated": update_inventory,
        "items_restocked": len(shopping_list.items) if update_inventory else 0
    }


# ============================================================================
# BULK OPERATIONS
# ============================================================================

@router.post("/bulk-restock")
async def bulk_restock_items(
    request: BulkRestockRequest,
    db: Session = Depends(get_db)
):
    """Bulk restock multiple items at once (after shopping trip)."""
    results = []
    success_count = 0
    error_count = 0

    for item_data in request.items:
        item = db.query(InventoryItem).filter(InventoryItem.id == item_data.item_id).first()

        if not item:
            results.append({
                "item_id": item_data.item_id,
                "success": False,
                "error": "Item not found"
            })
            error_count += 1
            continue

        prev_qty = item.quantity
        item.quantity += item_data.quantity_added
        item.last_restocked = datetime.utcnow()

        if item_data.unit_cost:
            item.unit_cost = item_data.unit_cost

        create_log_entry(
            db=db,
            item_id=item.id,
            quantity_change=item_data.quantity_added,
            previous_quantity=prev_qty,
            new_quantity=item.quantity,
            reason=InventoryLogReason.RESTOCK,
            reason_detail="Bulk restock",
            user_id=request.user_id,
            notes=request.notes,
            unit_cost=item_data.unit_cost
        )

        results.append({
            "item_id": item.id,
            "item_name": item.name,
            "success": True,
            "previous_quantity": prev_qty,
            "quantity_added": item_data.quantity_added,
            "new_quantity": item.quantity
        })
        success_count += 1

    db.commit()

    return {
        "success": error_count == 0,
        "message": f"Restocked {success_count} items" + (f", {error_count} errors" if error_count else ""),
        "summary": {
            "total_items": len(request.items),
            "success_count": success_count,
            "error_count": error_count
        },
        "results": results
    }


@router.post("/property/{property_id}/initialize")
async def initialize_property_inventory(
    property_id: str,
    template_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Initialize inventory for a new property with default items."""
    # Check if property already has inventory
    existing = db.query(InventoryItem).filter(
        InventoryItem.property_id == property_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Property already has inventory items. Use bulk-add for additional items."
        )

    # Use default items
    items_created = 0
    for category, items in DEFAULT_INVENTORY_ITEMS.items():
        for item_template in items:
            item = InventoryItem(
                id=f"inv-{uuid.uuid4().hex[:12]}",
                property_id=property_id,
                name=item_template["name"],
                category=InventoryCategory(category),
                quantity=item_template["default_qty"],
                unit=ItemUnit(item_template.get("unit", "EACH")),
                reorder_level=item_template["reorder_level"],
                reorder_quantity=item_template.get("default_qty", 10)
            )
            db.add(item)

            # Log initial inventory
            create_log_entry(
                db=db,
                item_id=item.id,
                quantity_change=item_template["default_qty"],
                previous_quantity=0,
                new_quantity=item_template["default_qty"],
                reason=InventoryLogReason.INITIAL,
                reason_detail="Property inventory initialization"
            )

            items_created += 1

    db.commit()

    return {
        "success": True,
        "message": f"Initialized inventory for property {property_id}",
        "items_created": items_created,
        "categories": list(DEFAULT_INVENTORY_ITEMS.keys())
    }


# ============================================================================
# CLEANER INTEGRATION
# ============================================================================

@router.post("/cleaner-report")
async def submit_cleaner_inventory_report(
    request: CleanerReportCreate,
    db: Session = Depends(get_db)
):
    """
    Submit inventory issues reported by cleaner during checkout.
    This creates a report and optionally adjusts inventory.
    """
    logger.info(f"Cleaner {request.cleaner_id} submitting inventory report for {request.property_id}")

    # Create the report
    report = CleanerInventoryReport(
        id=f"cinvrpt-{uuid.uuid4().hex[:12]}",
        cleaning_job_id=request.cleaning_job_id,
        property_id=request.property_id,
        cleaner_id=request.cleaner_id,
        reported_items=[item.dict() for item in request.reported_items],
        total_items_flagged=len(request.reported_items),
        requires_urgent_restock=request.requires_urgent_restock
    )

    db.add(report)

    # Try to match reported items to inventory and create logs
    items_matched = 0
    for reported in request.reported_items:
        # Try to find matching inventory item
        item = db.query(InventoryItem).filter(
            InventoryItem.property_id == request.property_id,
            InventoryItem.name.ilike(f"%{reported.item_name}%"),
            InventoryItem.category == reported.category
        ).first()

        if item and reported.issue in ["out", "low"]:
            # Create a log entry for cleaner-reported issue
            create_log_entry(
                db=db,
                item_id=item.id,
                quantity_change=0,  # Just a note, not an adjustment
                previous_quantity=item.quantity,
                new_quantity=item.quantity,
                reason=InventoryLogReason.CLEANER_REPORT,
                reason_detail=f"Cleaner reported: {reported.issue}",
                cleaning_job_id=request.cleaning_job_id,
                user_id=request.cleaner_id,
                notes=reported.notes
            )
            items_matched += 1

    db.commit()
    db.refresh(report)

    return {
        "success": True,
        "message": f"Inventory report submitted with {len(request.reported_items)} items flagged",
        "report_id": report.id,
        "items_matched_to_inventory": items_matched,
        "requires_urgent_restock": request.requires_urgent_restock
    }


@router.get("/cleaner-reports")
async def list_cleaner_reports(
    property_id: Optional[str] = None,
    resolved: Optional[bool] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """List cleaner inventory reports."""
    query = db.query(CleanerInventoryReport)

    if property_id:
        query = query.filter(CleanerInventoryReport.property_id == property_id)

    if resolved is not None:
        query = query.filter(CleanerInventoryReport.is_resolved == resolved)

    reports = query.order_by(CleanerInventoryReport.created_at.desc()).limit(limit).all()

    return {
        "success": True,
        "count": len(reports),
        "reports": [{
            "id": r.id,
            "cleaning_job_id": r.cleaning_job_id,
            "property_id": r.property_id,
            "cleaner_id": r.cleaner_id,
            "total_items_flagged": r.total_items_flagged,
            "requires_urgent_restock": r.requires_urgent_restock,
            "is_resolved": r.is_resolved,
            "reported_items": r.reported_items,
            "created_at": r.created_at
        } for r in reports]
    }


@router.put("/cleaner-report/{report_id}/resolve")
async def resolve_cleaner_report(
    report_id: str,
    user_id: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Mark a cleaner inventory report as resolved."""
    report = db.query(CleanerInventoryReport).filter(
        CleanerInventoryReport.id == report_id
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.is_resolved = True
    report.resolved_at = datetime.utcnow()
    report.resolved_by_id = user_id
    report.resolution_notes = notes

    db.commit()

    return {
        "success": True,
        "message": "Report marked as resolved"
    }


# ============================================================================
# STATISTICS & REPORTING
# ============================================================================

@router.get("/stats")
async def get_inventory_stats(
    property_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get inventory statistics across all properties or for a specific property."""
    query = db.query(InventoryItem).filter(InventoryItem.is_active == True)

    if property_id:
        query = query.filter(InventoryItem.property_id == property_id)

    items = query.all()

    # Calculate stats
    total_items = len(items)
    total_value = sum(float(i.quantity * i.unit_cost) if i.unit_cost else 0 for i in items)
    low_stock = sum(1 for i in items if i.stock_status == StockStatus.LOW_STOCK)
    out_of_stock = sum(1 for i in items if i.stock_status == StockStatus.OUT_OF_STOCK)

    # By category
    by_category = {}
    for item in items:
        cat = item.category.value
        if cat not in by_category:
            by_category[cat] = {"count": 0, "value": 0, "low_stock": 0}
        by_category[cat]["count"] += 1
        by_category[cat]["value"] += float(item.quantity * item.unit_cost) if item.unit_cost else 0
        if item.needs_reorder:
            by_category[cat]["low_stock"] += 1

    # Recent activity
    recent_logs = db.query(InventoryLog).order_by(
        InventoryLog.created_at.desc()
    ).limit(10).all()

    return {
        "success": True,
        "stats": {
            "total_items": total_items,
            "total_value": round(total_value, 2),
            "low_stock_items": low_stock,
            "out_of_stock_items": out_of_stock,
            "items_needing_attention": low_stock + out_of_stock,
            "health_score": round(100 - ((low_stock + out_of_stock) / max(total_items, 1) * 100), 1)
        },
        "by_category": by_category,
        "recent_activity": [{
            "id": log.id,
            "item_id": log.item_id,
            "change": log.quantity_change,
            "reason": log.reason.value,
            "created_at": log.created_at
        } for log in recent_logs]
    }
