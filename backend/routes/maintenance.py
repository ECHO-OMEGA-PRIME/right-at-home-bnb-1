"""
Right At Home BnB - Maintenance Request API Routes
===================================================
Complete CRUD operations for maintenance requests with:
- Request creation and listing
- Worker assignment
- Status updates
- Photo uploads
- Completion with auto-expense creation
- History tracking

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Query, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum
from decimal import Decimal
import logging

from database.connection import get_db, SessionLocal
from database.models_maintenance import (
    MaintenanceRequest, MaintenanceHistory, MaintenanceChecklist,
    MaintenanceCategory, MaintenancePriority, MaintenanceStatus, ReportedBy
)
from database.models_workers import Worker, WorkerType, WorkerJobExpense
from database.models_financial import TaxCategorizedExpense, TaxCategory

logger = logging.getLogger("RightAtHomeBnB.Maintenance")
router = APIRouter()


# ==============================================================================
# REQUEST/RESPONSE MODELS
# ==============================================================================

class MaintenanceCreateRequest(BaseModel):
    """Create a new maintenance request."""
    property_id: str = Field(..., description="Property ID")
    title: str = Field(..., min_length=3, max_length=200, description="Brief title of the issue")
    description: str = Field(..., min_length=10, description="Detailed description of the issue")
    category: str = Field(..., description="Category: plumbing, electrical, hvac, appliance, structural, other")
    priority: str = Field(default="normal", description="Priority: low, normal, high, urgent, emergency")
    location: Optional[str] = Field(None, max_length=200, description="Location within property")

    # Reporter info
    reported_by: str = Field(default="owner", description="Who reported: owner, guest, cleaner, inspection")
    reporter_name: Optional[str] = Field(None, description="Name of reporter")
    reporter_phone: Optional[str] = Field(None, description="Phone of reporter")
    reporter_email: Optional[str] = Field(None, description="Email of reporter")

    # Optional booking reference
    booking_id: Optional[str] = Field(None, description="Related booking ID if guest reported")

    # Photos
    photos: Optional[List[str]] = Field(None, description="List of photo URLs showing the issue")

    # Initial estimate
    estimated_cost: Optional[float] = Field(None, ge=0, description="Estimated repair cost")

    # Notes
    internal_notes: Optional[str] = Field(None, description="Internal notes")


class MaintenanceUpdateRequest(BaseModel):
    """Update an existing maintenance request."""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, min_length=10)
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None

    # Scheduling
    scheduled_date: Optional[str] = Field(None, description="Date in YYYY-MM-DD format")
    scheduled_time_start: Optional[str] = Field(None, description="Start time HH:MM")
    scheduled_time_end: Optional[str] = Field(None, description="End time HH:MM")

    # Cost
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    materials_cost: Optional[float] = None
    labor_cost: Optional[float] = None

    # Notes
    internal_notes: Optional[str] = None
    worker_notes: Optional[str] = None

    # Vendor
    vendor_name: Optional[str] = None
    vendor_phone: Optional[str] = None


class AssignWorkerRequest(BaseModel):
    """Assign a worker to a maintenance request."""
    worker_id: int = Field(..., description="Worker ID to assign")
    scheduled_date: Optional[str] = Field(None, description="Date in YYYY-MM-DD format")
    scheduled_time_start: Optional[str] = Field(None, description="Start time HH:MM")
    scheduled_time_end: Optional[str] = Field(None, description="End time HH:MM")
    notes: Optional[str] = Field(None, description="Assignment notes for worker")


class CompleteMaintenanceRequest(BaseModel):
    """Mark maintenance as complete with work details."""
    work_description: str = Field(..., min_length=10, description="Description of work performed")
    photos_completed: Optional[List[str]] = Field(None, description="After photos showing completed work")

    # Costs
    materials_cost: Optional[float] = Field(None, ge=0, description="Cost of materials used")
    labor_cost: Optional[float] = Field(None, ge=0, description="Labor cost")

    # Parts used
    parts_used: Optional[List[dict]] = Field(None, description="List of parts: [{'name': str, 'cost': float}]")

    # Worker notes
    worker_notes: Optional[str] = Field(None, description="Worker notes on completion")

    # Receipt
    receipt_urls: Optional[List[str]] = Field(None, description="Receipt/invoice URLs")
    invoice_number: Optional[str] = Field(None, description="Invoice number")

    # Vendor info (if external)
    vendor_name: Optional[str] = None
    vendor_invoice: Optional[str] = None


class MaintenanceResponse(BaseModel):
    """Full maintenance request response."""
    id: int
    property_id: str
    title: str
    description: str
    category: str
    priority: str
    status: str
    location: Optional[str]

    reported_by: str
    reporter_name: Optional[str]

    assigned_worker_id: Optional[int]
    assigned_worker_name: Optional[str]
    assigned_at: Optional[datetime]

    scheduled_date: Optional[date]
    scheduled_time_start: Optional[str]
    scheduled_time_end: Optional[str]

    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    photos_reported: Optional[List[str]]
    photos_completed: Optional[List[str]]

    estimated_cost: Optional[float]
    actual_cost: Optional[float]
    materials_cost: Optional[float]
    labor_cost: Optional[float]
    total_cost: Optional[float]

    work_description: Optional[str]
    internal_notes: Optional[str]
    worker_notes: Optional[str]

    is_overdue: bool
    expense_auto_created: bool

    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def _parse_category(category_str: str) -> MaintenanceCategory:
    """Parse category string to enum."""
    try:
        return MaintenanceCategory(category_str.lower())
    except ValueError:
        return MaintenanceCategory.OTHER


def _parse_priority(priority_str: str) -> MaintenancePriority:
    """Parse priority string to enum."""
    try:
        return MaintenancePriority(priority_str.lower())
    except ValueError:
        return MaintenancePriority.NORMAL


def _parse_status(status_str: str) -> MaintenanceStatus:
    """Parse status string to enum."""
    try:
        return MaintenanceStatus(status_str.lower())
    except ValueError:
        return MaintenanceStatus.OPEN


def _parse_reported_by(reported_by_str: str) -> ReportedBy:
    """Parse reported_by string to enum."""
    try:
        return ReportedBy(reported_by_str.lower())
    except ValueError:
        return ReportedBy.OWNER


def _add_history(
    db,
    request_id: int,
    action: str,
    old_value: str = None,
    new_value: str = None,
    changed_by: str = None,
    changed_by_type: str = "system",
    notes: str = None
):
    """Add history entry for a maintenance request."""
    history = MaintenanceHistory(
        maintenance_request_id=request_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
        changed_by=changed_by,
        changed_by_type=changed_by_type,
        notes=notes
    )
    db.add(history)


def _to_response(request: MaintenanceRequest, worker_name: str = None) -> dict:
    """Convert MaintenanceRequest to response dict."""
    return {
        "id": request.id,
        "property_id": request.property_id,
        "title": request.title,
        "description": request.description,
        "category": request.category.value if request.category else "other",
        "priority": request.priority.value if request.priority else "normal",
        "status": request.status.value if request.status else "open",
        "location": request.location,

        "reported_by": request.reported_by.value if request.reported_by else "owner",
        "reporter_name": request.reporter_name,

        "assigned_worker_id": request.assigned_worker_id,
        "assigned_worker_name": worker_name,
        "assigned_at": request.assigned_at,

        "scheduled_date": request.scheduled_date,
        "scheduled_time_start": request.scheduled_time_start,
        "scheduled_time_end": request.scheduled_time_end,

        "started_at": request.started_at,
        "completed_at": request.completed_at,

        "photos_reported": request.photos_reported or [],
        "photos_completed": request.photos_completed or [],

        "estimated_cost": float(request.estimated_cost) if request.estimated_cost else None,
        "actual_cost": float(request.actual_cost) if request.actual_cost else None,
        "materials_cost": float(request.materials_cost) if request.materials_cost else 0,
        "labor_cost": float(request.labor_cost) if request.labor_cost else 0,
        "total_cost": request.total_cost,

        "work_description": request.work_description,
        "internal_notes": request.internal_notes,
        "worker_notes": request.worker_notes,

        "is_overdue": request.is_overdue,
        "expense_auto_created": request.expense_auto_created,

        "created_at": request.created_at,
        "updated_at": request.updated_at,
    }


def _auto_create_expense(db, request: MaintenanceRequest):
    """
    Auto-create a tax-categorized expense when maintenance is completed.
    """
    if request.expense_auto_created:
        return None

    total_cost = request.total_cost
    if not total_cost or total_cost <= 0:
        return None

    # Map maintenance category to tax category
    tax_category_map = {
        MaintenanceCategory.PLUMBING: TaxCategory.PLUMBING,
        MaintenanceCategory.ELECTRICAL: TaxCategory.ELECTRICAL,
        MaintenanceCategory.HVAC: TaxCategory.HVAC_SERVICE,
        MaintenanceCategory.APPLIANCE: TaxCategory.APPLIANCE_REPAIR,
        MaintenanceCategory.STRUCTURAL: TaxCategory.REPAIRS,
        MaintenanceCategory.DOOR_WINDOW: TaxCategory.REPAIRS,
        MaintenanceCategory.FLOORING: TaxCategory.CARPET_FLOORING,
        MaintenanceCategory.PAINTING: TaxCategory.REPAIRS,
        MaintenanceCategory.PEST_CONTROL: TaxCategory.PEST_CONTROL,
        MaintenanceCategory.LANDSCAPING: TaxCategory.LANDSCAPING,
        MaintenanceCategory.POOL_SPA: TaxCategory.POOL_SERVICE,
        MaintenanceCategory.SECURITY: TaxCategory.SECURITY,
        MaintenanceCategory.SMART_HOME: TaxCategory.REPAIRS,
        MaintenanceCategory.CLEANING: TaxCategory.CLEANING_MAINTENANCE,
        MaintenanceCategory.OTHER: TaxCategory.REPAIRS,
    }

    tax_cat = tax_category_map.get(request.category, TaxCategory.REPAIRS)

    expense = TaxCategorizedExpense(
        property_id=request.property_id,
        description=f"Maintenance: {request.title}",
        amount=Decimal(str(total_cost)),
        expense_date=request.completed_at.date() if request.completed_at else date.today(),
        tax_category=tax_cat,
        subcategory=request.category.value if request.category else "repairs",
        vendor_name=request.vendor_name,
        invoice_number=request.invoice_number,
        is_auto_logged=True,
        worker_job_type="maintenance",
        notes=f"Auto-created from Maintenance Request #{request.id}",
        is_deductible=True,
        tax_year=datetime.now().year,
    )

    db.add(expense)
    db.flush()  # Get the expense ID

    request.expense_id = expense.id
    request.expense_auto_created = True

    return expense


# ==============================================================================
# API ENDPOINTS
# ==============================================================================

@router.get("")
async def list_maintenance_requests(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    assigned_worker_id: Optional[int] = Query(None, description="Filter by assigned worker"),
    include_completed: bool = Query(False, description="Include completed/verified requests"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    """
    List maintenance requests with optional filters.
    By default excludes completed/verified/cancelled requests.
    """
    db = SessionLocal()
    try:
        query = db.query(MaintenanceRequest)

        # Apply filters
        if property_id:
            query = query.filter(MaintenanceRequest.property_id == property_id)

        if status:
            query = query.filter(MaintenanceRequest.status == _parse_status(status))
        elif not include_completed:
            # Exclude completed/verified/cancelled by default
            query = query.filter(MaintenanceRequest.status.notin_([
                MaintenanceStatus.COMPLETED,
                MaintenanceStatus.VERIFIED,
                MaintenanceStatus.CANCELLED
            ]))

        if category:
            query = query.filter(MaintenanceRequest.category == _parse_category(category))

        if priority:
            query = query.filter(MaintenanceRequest.priority == _parse_priority(priority))

        if assigned_worker_id:
            query = query.filter(MaintenanceRequest.assigned_worker_id == assigned_worker_id)

        # Get total count
        total = query.count()

        # Order by priority (emergency first), then by created date
        priority_order = [
            MaintenancePriority.EMERGENCY,
            MaintenancePriority.URGENT,
            MaintenancePriority.HIGH,
            MaintenancePriority.NORMAL,
            MaintenancePriority.LOW
        ]

        query = query.order_by(
            MaintenanceRequest.priority.desc(),
            MaintenanceRequest.created_at.desc()
        )

        # Apply pagination
        requests = query.offset(offset).limit(limit).all()

        # Get worker names
        worker_ids = [r.assigned_worker_id for r in requests if r.assigned_worker_id]
        workers = {}
        if worker_ids:
            worker_records = db.query(Worker).filter(Worker.id.in_(worker_ids)).all()
            workers = {w.id: w.name for w in worker_records}

        # Build response
        items = []
        for req in requests:
            worker_name = workers.get(req.assigned_worker_id) if req.assigned_worker_id else None
            items.append(_to_response(req, worker_name))

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total
        }
    finally:
        db.close()


@router.get("/stats")
async def get_maintenance_stats(
    property_id: Optional[str] = Query(None, description="Filter by property")
):
    """Get maintenance statistics for dashboard."""
    db = SessionLocal()
    try:
        base_query = db.query(MaintenanceRequest)

        if property_id:
            base_query = base_query.filter(MaintenanceRequest.property_id == property_id)

        # Count by status
        open_count = base_query.filter(MaintenanceRequest.status == MaintenanceStatus.OPEN).count()
        assigned_count = base_query.filter(MaintenanceRequest.status == MaintenanceStatus.ASSIGNED).count()
        in_progress_count = base_query.filter(MaintenanceRequest.status == MaintenanceStatus.IN_PROGRESS).count()
        scheduled_count = base_query.filter(MaintenanceRequest.status == MaintenanceStatus.SCHEDULED).count()
        pending_parts_count = base_query.filter(MaintenanceRequest.status == MaintenanceStatus.PENDING_PARTS).count()
        completed_count = base_query.filter(MaintenanceRequest.status.in_([
            MaintenanceStatus.COMPLETED,
            MaintenanceStatus.VERIFIED
        ])).count()

        # Emergency/urgent counts
        emergency_count = base_query.filter(
            MaintenanceRequest.priority == MaintenancePriority.EMERGENCY,
            MaintenanceRequest.status.notin_([
                MaintenanceStatus.COMPLETED,
                MaintenanceStatus.VERIFIED,
                MaintenanceStatus.CANCELLED
            ])
        ).count()

        urgent_count = base_query.filter(
            MaintenanceRequest.priority == MaintenancePriority.URGENT,
            MaintenanceStatus.status.notin_([
                MaintenanceStatus.COMPLETED,
                MaintenanceStatus.VERIFIED,
                MaintenanceStatus.CANCELLED
            ])
        ).count()

        # Overdue count (scheduled date passed but not completed)
        from datetime import date as date_type
        overdue_count = base_query.filter(
            MaintenanceRequest.scheduled_date < date_type.today(),
            MaintenanceRequest.status.notin_([
                MaintenanceStatus.COMPLETED,
                MaintenanceStatus.VERIFIED,
                MaintenanceStatus.CANCELLED
            ])
        ).count()

        return {
            "open": open_count,
            "assigned": assigned_count,
            "scheduled": scheduled_count,
            "in_progress": in_progress_count,
            "pending_parts": pending_parts_count,
            "completed": completed_count,
            "emergency": emergency_count,
            "urgent": urgent_count,
            "overdue": overdue_count,
            "active_total": open_count + assigned_count + scheduled_count + in_progress_count + pending_parts_count,
        }
    finally:
        db.close()


@router.get("/{request_id}")
async def get_maintenance_request(request_id: int):
    """Get a single maintenance request with full details."""
    db = SessionLocal()
    try:
        request = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()

        if not request:
            raise HTTPException(status_code=404, detail="Maintenance request not found")

        # Get worker name
        worker_name = None
        if request.assigned_worker_id:
            worker = db.query(Worker).filter(Worker.id == request.assigned_worker_id).first()
            worker_name = worker.name if worker else None

        response = _to_response(request, worker_name)

        # Add history
        history = db.query(MaintenanceHistory).filter(
            MaintenanceHistory.maintenance_request_id == request_id
        ).order_by(MaintenanceHistory.created_at.desc()).all()

        response["history"] = [
            {
                "id": h.id,
                "action": h.action,
                "old_value": h.old_value,
                "new_value": h.new_value,
                "changed_by": h.changed_by,
                "changed_by_type": h.changed_by_type,
                "notes": h.notes,
                "created_at": h.created_at,
            }
            for h in history
        ]

        # Add checklists
        checklists = db.query(MaintenanceChecklist).filter(
            MaintenanceChecklist.maintenance_request_id == request_id
        ).order_by(MaintenanceChecklist.sort_order).all()

        response["checklists"] = [
            {
                "id": c.id,
                "item_description": c.item_description,
                "is_required": c.is_required,
                "is_completed": c.is_completed,
                "completed_at": c.completed_at,
                "completed_by": c.completed_by,
                "requires_photo": c.requires_photo,
                "photo_url": c.photo_url,
            }
            for c in checklists
        ]

        return response
    finally:
        db.close()


@router.post("")
async def create_maintenance_request(request: MaintenanceCreateRequest):
    """Create a new maintenance request."""
    db = SessionLocal()
    try:
        maintenance = MaintenanceRequest(
            property_id=request.property_id,
            title=request.title,
            description=request.description,
            category=_parse_category(request.category),
            priority=_parse_priority(request.priority),
            status=MaintenanceStatus.OPEN,
            location=request.location,
            reported_by=_parse_reported_by(request.reported_by),
            reporter_name=request.reporter_name,
            reporter_phone=request.reporter_phone,
            reporter_email=request.reporter_email,
            booking_id=request.booking_id,
            photos_reported=request.photos,
            estimated_cost=Decimal(str(request.estimated_cost)) if request.estimated_cost else None,
            internal_notes=request.internal_notes,
        )

        db.add(maintenance)
        db.flush()  # Get the ID

        # Add creation history
        _add_history(
            db,
            maintenance.id,
            "created",
            new_value=f"Created with priority: {request.priority}",
            changed_by=request.reporter_name or "system",
            changed_by_type=request.reported_by,
        )

        db.commit()

        logger.info(f"Created maintenance request #{maintenance.id}: {maintenance.title}")

        return _to_response(maintenance)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create maintenance request: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.put("/{request_id}")
async def update_maintenance_request(request_id: int, request: MaintenanceUpdateRequest):
    """Update an existing maintenance request."""
    db = SessionLocal()
    try:
        maintenance = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()

        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance request not found")

        # Track changes
        changes = []

        if request.title is not None and request.title != maintenance.title:
            changes.append(("title", maintenance.title, request.title))
            maintenance.title = request.title

        if request.description is not None:
            maintenance.description = request.description

        if request.category is not None:
            new_cat = _parse_category(request.category)
            if new_cat != maintenance.category:
                changes.append(("category", maintenance.category.value, new_cat.value))
                maintenance.category = new_cat

        if request.priority is not None:
            new_priority = _parse_priority(request.priority)
            if new_priority != maintenance.priority:
                changes.append(("priority", maintenance.priority.value, new_priority.value))
                maintenance.priority = new_priority

        if request.status is not None:
            new_status = _parse_status(request.status)
            if new_status != maintenance.status:
                changes.append(("status", maintenance.status.value, new_status.value))
                maintenance.status = new_status

                # Update timestamps
                if new_status == MaintenanceStatus.IN_PROGRESS and not maintenance.started_at:
                    maintenance.started_at = datetime.utcnow()

        if request.location is not None:
            maintenance.location = request.location

        if request.scheduled_date is not None:
            maintenance.scheduled_date = datetime.strptime(request.scheduled_date, "%Y-%m-%d").date()

        if request.scheduled_time_start is not None:
            maintenance.scheduled_time_start = request.scheduled_time_start

        if request.scheduled_time_end is not None:
            maintenance.scheduled_time_end = request.scheduled_time_end

        if request.estimated_cost is not None:
            maintenance.estimated_cost = Decimal(str(request.estimated_cost))

        if request.actual_cost is not None:
            maintenance.actual_cost = Decimal(str(request.actual_cost))

        if request.materials_cost is not None:
            maintenance.materials_cost = Decimal(str(request.materials_cost))

        if request.labor_cost is not None:
            maintenance.labor_cost = Decimal(str(request.labor_cost))

        if request.internal_notes is not None:
            maintenance.internal_notes = request.internal_notes

        if request.worker_notes is not None:
            maintenance.worker_notes = request.worker_notes

        if request.vendor_name is not None:
            maintenance.vendor_name = request.vendor_name

        if request.vendor_phone is not None:
            maintenance.vendor_phone = request.vendor_phone

        # Add history for significant changes
        for field, old_val, new_val in changes:
            _add_history(db, request_id, f"{field}_changed", old_val, new_val, changed_by_type="system")

        db.commit()

        # Get worker name for response
        worker_name = None
        if maintenance.assigned_worker_id:
            worker = db.query(Worker).filter(Worker.id == maintenance.assigned_worker_id).first()
            worker_name = worker.name if worker else None

        return _to_response(maintenance, worker_name)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update maintenance request: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.post("/{request_id}/assign")
async def assign_worker(request_id: int, request: AssignWorkerRequest):
    """Assign a worker to a maintenance request."""
    db = SessionLocal()
    try:
        maintenance = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()

        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance request not found")

        # Verify worker exists
        worker = db.query(Worker).filter(Worker.id == request.worker_id).first()

        if not worker:
            raise HTTPException(status_code=404, detail="Worker not found")

        if not worker.is_active:
            raise HTTPException(status_code=400, detail="Worker is not active")

        # Record previous assignment
        old_worker_id = maintenance.assigned_worker_id

        # Assign worker
        maintenance.assigned_worker_id = request.worker_id
        maintenance.assigned_at = datetime.utcnow()
        maintenance.status = MaintenanceStatus.ASSIGNED

        # Update scheduling if provided
        if request.scheduled_date:
            maintenance.scheduled_date = datetime.strptime(request.scheduled_date, "%Y-%m-%d").date()
            maintenance.status = MaintenanceStatus.SCHEDULED

        if request.scheduled_time_start:
            maintenance.scheduled_time_start = request.scheduled_time_start

        if request.scheduled_time_end:
            maintenance.scheduled_time_end = request.scheduled_time_end

        # Add history
        _add_history(
            db,
            request_id,
            "assigned",
            old_value=str(old_worker_id) if old_worker_id else None,
            new_value=f"{worker.name} (ID: {worker.id})",
            changed_by="system",
            changed_by_type="system",
            notes=request.notes
        )

        db.commit()

        logger.info(f"Assigned worker {worker.name} to maintenance request #{request_id}")

        return _to_response(maintenance, worker.name)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to assign worker: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.post("/{request_id}/complete")
async def complete_maintenance(request_id: int, request: CompleteMaintenanceRequest):
    """
    Mark maintenance as complete with work details.
    Automatically creates an expense entry.
    """
    db = SessionLocal()
    try:
        maintenance = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()

        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance request not found")

        if maintenance.status in [MaintenanceStatus.COMPLETED, MaintenanceStatus.VERIFIED]:
            raise HTTPException(status_code=400, detail="Maintenance request already completed")

        # Update maintenance record
        maintenance.status = MaintenanceStatus.COMPLETED
        maintenance.completed_at = datetime.utcnow()
        maintenance.work_description = request.work_description
        maintenance.photos_completed = request.photos_completed
        maintenance.worker_notes = request.worker_notes
        maintenance.receipt_urls = request.receipt_urls
        maintenance.invoice_number = request.invoice_number
        maintenance.vendor_name = request.vendor_name or maintenance.vendor_name
        maintenance.vendor_invoice = request.vendor_invoice
        maintenance.parts_used = request.parts_used

        # Update costs
        if request.materials_cost is not None:
            maintenance.materials_cost = Decimal(str(request.materials_cost))

        if request.labor_cost is not None:
            maintenance.labor_cost = Decimal(str(request.labor_cost))

        # Calculate actual cost
        maintenance.actual_cost = Decimal(str(maintenance.total_cost))

        # Calculate duration
        if maintenance.started_at:
            duration = maintenance.completed_at - maintenance.started_at
            maintenance.actual_duration_minutes = int(duration.total_seconds() / 60)

        # Auto-create expense
        expense = _auto_create_expense(db, maintenance)

        # Add history
        _add_history(
            db,
            request_id,
            "completed",
            old_value=MaintenanceStatus.IN_PROGRESS.value,
            new_value=MaintenanceStatus.COMPLETED.value,
            changed_by_type="worker",
            notes=f"Work completed. Total cost: ${maintenance.total_cost}. Expense auto-created: {expense is not None}"
        )

        db.commit()

        logger.info(f"Completed maintenance request #{request_id}. Expense created: {expense is not None}")

        # Get worker name
        worker_name = None
        if maintenance.assigned_worker_id:
            worker = db.query(Worker).filter(Worker.id == maintenance.assigned_worker_id).first()
            worker_name = worker.name if worker else None

        response = _to_response(maintenance, worker_name)
        response["expense_created"] = expense is not None
        response["expense_id"] = expense.id if expense else None

        return response
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to complete maintenance: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.delete("/{request_id}")
async def cancel_maintenance_request(request_id: int, reason: Optional[str] = Query(None)):
    """Cancel a maintenance request."""
    db = SessionLocal()
    try:
        maintenance = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()

        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance request not found")

        if maintenance.status in [MaintenanceStatus.COMPLETED, MaintenanceStatus.VERIFIED]:
            raise HTTPException(status_code=400, detail="Cannot cancel completed maintenance request")

        old_status = maintenance.status.value
        maintenance.status = MaintenanceStatus.CANCELLED

        _add_history(
            db,
            request_id,
            "cancelled",
            old_value=old_status,
            new_value=MaintenanceStatus.CANCELLED.value,
            notes=reason
        )

        db.commit()

        return {"success": True, "message": f"Maintenance request #{request_id} cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to cancel maintenance: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.get("/workers/available")
async def get_available_workers(
    category: Optional[str] = Query(None, description="Filter by specialization")
):
    """Get list of available maintenance workers."""
    db = SessionLocal()
    try:
        query = db.query(Worker).filter(
            Worker.is_active == True,
            Worker.worker_type == WorkerType.MAINTENANCE
        )

        workers = query.all()

        return {
            "workers": [
                {
                    "id": w.id,
                    "name": w.name,
                    "phone": w.phone,
                    "email": w.email,
                    "hourly_rate": float(w.hourly_rate) if w.hourly_rate else None,
                    "avg_rating": w.avg_rating,
                    "total_jobs": w.total_jobs,
                    "completed_jobs": w.completed_jobs,
                    "certifications": w.certifications,
                }
                for w in workers
            ],
            "total": len(workers)
        }
    finally:
        db.close()


@router.get("/categories")
async def get_maintenance_categories():
    """Get all maintenance categories with labels."""
    return {
        "categories": [
            {"value": cat.value, "label": cat.value.replace("_", " ").title()}
            for cat in MaintenanceCategory
        ]
    }


@router.get("/priorities")
async def get_maintenance_priorities():
    """Get all priority levels with descriptions."""
    descriptions = {
        "low": "Can wait, minor cosmetic issue",
        "normal": "Standard repair needed",
        "high": "Affects guest experience",
        "urgent": "Property not fully usable",
        "emergency": "Safety issue, immediate response required"
    }

    return {
        "priorities": [
            {
                "value": p.value,
                "label": p.value.upper(),
                "description": descriptions.get(p.value, "")
            }
            for p in MaintenancePriority
        ]
    }


@router.get("/statuses")
async def get_maintenance_statuses():
    """Get all maintenance statuses with descriptions."""
    descriptions = {
        "open": "New request, not yet assigned",
        "assigned": "Worker assigned",
        "scheduled": "Date and time scheduled",
        "in_progress": "Worker on-site",
        "pending_parts": "Waiting for parts/materials",
        "completed": "Work done, awaiting verification",
        "verified": "Owner verified completion",
        "cancelled": "Request cancelled",
        "on_hold": "Temporarily paused"
    }

    return {
        "statuses": [
            {
                "value": s.value,
                "label": s.value.replace("_", " ").title(),
                "description": descriptions.get(s.value, "")
            }
            for s in MaintenanceStatus
        ]
    }
