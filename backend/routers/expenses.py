"""
Right At Home BnB - Expense Management API Routes
==================================================
Full expense management with tax categorization for CPA export.

Endpoints:
- GET  /admin/expenses              - List all expenses with filters
- POST /admin/expenses              - Add manual expense
- GET  /admin/expenses/property/{id} - Expenses by property
- GET  /admin/expenses/categories   - Expense by tax category
- PUT  /admin/expenses/{id}         - Update expense category
- DELETE /admin/expenses/{id}       - Delete expense
- GET  /admin/expenses/worker-jobs  - List auto-logged worker expenses
- POST /admin/expenses/worker-jobs/sync - Sync worker expenses to tax export

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
import uuid
import logging

from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_, extract

from database.connection import get_db
from database.models_financial import (
    TaxCategory, TaxCategorizedExpense, WorkerJobExpense,
    PropertyServiceFees, WorkerJobType, WORKER_JOB_TAX_CATEGORY_MAP
)
from database.models import Property

logger = logging.getLogger("RightAtHomeBnB.Expenses")

router = APIRouter()


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class ExpenseCreate(BaseModel):
    """Request model for creating a manual expense."""
    property_id: str = Field(..., description="Property ID")
    description: str = Field(..., min_length=3, max_length=500, description="Expense description")
    amount: float = Field(..., gt=0, description="Expense amount in dollars")
    expense_date: str = Field(..., description="Date in YYYY-MM-DD format")
    tax_category: str = Field(..., description="Tax category from TaxCategory enum")
    subcategory: Optional[str] = Field(None, max_length=100, description="Optional subcategory")
    vendor_name: Optional[str] = Field(None, max_length=200, description="Vendor/supplier name")
    vendor_ein: Optional[str] = Field(None, max_length=20, description="Vendor EIN for 1099")
    invoice_number: Optional[str] = Field(None, max_length=100, description="Invoice number")
    receipt_url: Optional[str] = Field(None, max_length=500, description="URL to receipt image")
    payment_method: Optional[str] = Field(None, max_length=50, description="Payment method")
    check_number: Optional[str] = Field(None, max_length=20, description="Check number if applicable")
    is_paid: bool = Field(default=True, description="Whether expense is paid")
    is_deductible: bool = Field(default=True, description="Whether expense is tax deductible")
    deduction_percentage: float = Field(default=100.0, ge=0, le=100, description="Deduction percentage")
    notes: Optional[str] = Field(None, description="Additional notes")


class ExpenseUpdate(BaseModel):
    """Request model for updating an expense."""
    description: Optional[str] = Field(None, min_length=3, max_length=500)
    amount: Optional[float] = Field(None, gt=0)
    expense_date: Optional[str] = None
    tax_category: Optional[str] = None
    subcategory: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_ein: Optional[str] = None
    invoice_number: Optional[str] = None
    receipt_url: Optional[str] = None
    payment_method: Optional[str] = None
    check_number: Optional[str] = None
    is_paid: Optional[bool] = None
    is_deductible: Optional[bool] = None
    deduction_percentage: Optional[float] = Field(None, ge=0, le=100)
    notes: Optional[str] = None


class PropertyServiceFeeCreate(BaseModel):
    """Request model for setting property service fees."""
    property_id: str = Field(..., description="Property ID")
    service_type: str = Field(..., description="Service type from WorkerJobType enum")
    base_fee: float = Field(..., gt=0, description="Base fee amount")
    deep_clean_fee: Optional[float] = Field(None, gt=0, description="Deep clean fee")
    emergency_fee: Optional[float] = Field(None, gt=0, description="Emergency/rush fee")
    per_bedroom_fee: float = Field(default=0, ge=0, description="Additional per bedroom")
    per_bathroom_fee: float = Field(default=0, ge=0, description="Additional per bathroom")
    service_frequency: Optional[str] = Field(None, description="weekly, biweekly, monthly")
    notes: Optional[str] = None


# ============================================================================
# EXPENSE MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/admin/expenses")
async def list_expenses(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    tax_category: Optional[str] = Query(None, description="Filter by tax category"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    is_paid: Optional[bool] = Query(None, description="Filter by payment status"),
    is_auto_logged: Optional[bool] = Query(None, description="Filter auto-logged expenses"),
    min_amount: Optional[float] = Query(None, description="Minimum amount"),
    max_amount: Optional[float] = Query(None, description="Maximum amount"),
    limit: int = Query(100, ge=1, le=500, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db)
):
    """
    List all expenses with comprehensive filters.
    Returns expenses sorted by date descending.
    """
    query = db.query(TaxCategorizedExpense)

    # Apply filters
    if property_id:
        query = query.filter(TaxCategorizedExpense.property_id == property_id)

    if tax_category:
        try:
            cat = TaxCategory(tax_category)
            query = query.filter(TaxCategorizedExpense.tax_category == cat)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid tax category: {tax_category}")

    if start_date:
        query = query.filter(TaxCategorizedExpense.expense_date >= datetime.strptime(start_date, "%Y-%m-%d").date())

    if end_date:
        query = query.filter(TaxCategorizedExpense.expense_date <= datetime.strptime(end_date, "%Y-%m-%d").date())

    if is_paid is not None:
        query = query.filter(TaxCategorizedExpense.is_paid == is_paid)

    if is_auto_logged is not None:
        query = query.filter(TaxCategorizedExpense.is_auto_logged == is_auto_logged)

    if min_amount is not None:
        query = query.filter(TaxCategorizedExpense.amount >= min_amount)

    if max_amount is not None:
        query = query.filter(TaxCategorizedExpense.amount <= max_amount)

    # Get total count
    total_count = query.count()

    # Get expenses with pagination
    expenses = query.order_by(desc(TaxCategorizedExpense.expense_date)).offset(offset).limit(limit).all()

    # Calculate summary
    summary_query = db.query(
        func.sum(TaxCategorizedExpense.amount).label('total'),
        func.count(TaxCategorizedExpense.id).label('count')
    )

    # Apply same filters for summary
    if property_id:
        summary_query = summary_query.filter(TaxCategorizedExpense.property_id == property_id)
    if start_date:
        summary_query = summary_query.filter(TaxCategorizedExpense.expense_date >= datetime.strptime(start_date, "%Y-%m-%d").date())
    if end_date:
        summary_query = summary_query.filter(TaxCategorizedExpense.expense_date <= datetime.strptime(end_date, "%Y-%m-%d").date())

    summary = summary_query.first()

    return {
        "expenses": [
            {
                "id": exp.id,
                "property_id": exp.property_id,
                "description": exp.description,
                "amount": float(exp.amount),
                "expense_date": exp.expense_date.isoformat() if exp.expense_date else None,
                "tax_category": exp.tax_category.value if exp.tax_category else None,
                "subcategory": exp.subcategory,
                "vendor_name": exp.vendor_name,
                "vendor_ein": exp.vendor_ein,
                "invoice_number": exp.invoice_number,
                "receipt_url": exp.receipt_url,
                "payment_method": exp.payment_method,
                "check_number": exp.check_number,
                "is_paid": exp.is_paid,
                "is_deductible": exp.is_deductible,
                "deduction_percentage": exp.deduction_percentage,
                "is_auto_logged": exp.is_auto_logged,
                "worker_job_id": exp.worker_job_id,
                "worker_job_type": exp.worker_job_type,
                "notes": exp.notes,
                "created_at": exp.created_at.isoformat() if exp.created_at else None
            }
            for exp in expenses
        ],
        "pagination": {
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total_count
        },
        "summary": {
            "total_amount": float(summary.total or 0),
            "expense_count": summary.count or 0
        }
    }


@router.post("/admin/expenses")
async def create_expense(
    expense: ExpenseCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new manual expense entry.
    Returns the created expense with ID.
    """
    # Validate tax category
    try:
        tax_cat = TaxCategory(expense.tax_category)
    except ValueError:
        valid_categories = [c.value for c in TaxCategory]
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tax category. Valid options: {valid_categories}"
        )

    # Validate property exists
    property_exists = db.query(Property).filter(Property.id == expense.property_id).first()
    if not property_exists:
        raise HTTPException(status_code=404, detail=f"Property {expense.property_id} not found")

    # Parse date
    try:
        exp_date = datetime.strptime(expense.expense_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Create expense record
    new_expense = TaxCategorizedExpense(
        property_id=expense.property_id,
        description=expense.description,
        amount=Decimal(str(expense.amount)),
        expense_date=exp_date,
        tax_category=tax_cat,
        subcategory=expense.subcategory,
        vendor_name=expense.vendor_name,
        vendor_ein=expense.vendor_ein,
        invoice_number=expense.invoice_number,
        receipt_url=expense.receipt_url,
        payment_method=expense.payment_method,
        check_number=expense.check_number,
        is_paid=expense.is_paid,
        is_deductible=expense.is_deductible,
        deduction_percentage=expense.deduction_percentage,
        notes=expense.notes,
        is_auto_logged=False,
        tax_year=exp_date.year
    )

    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)

    logger.info(f"Created expense {new_expense.id} for property {expense.property_id}: ${expense.amount}")

    return {
        "success": True,
        "expense": {
            "id": new_expense.id,
            "property_id": new_expense.property_id,
            "description": new_expense.description,
            "amount": float(new_expense.amount),
            "expense_date": new_expense.expense_date.isoformat(),
            "tax_category": new_expense.tax_category.value,
            "created_at": new_expense.created_at.isoformat() if new_expense.created_at else None
        }
    }


@router.get("/admin/expenses/property/{property_id}")
async def get_expenses_by_property(
    property_id: str,
    year: Optional[int] = Query(None, description="Filter by year"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Filter by month"),
    db: Session = Depends(get_db)
):
    """
    Get all expenses for a specific property with optional year/month filter.
    Includes summary by tax category.
    """
    query = db.query(TaxCategorizedExpense).filter(
        TaxCategorizedExpense.property_id == property_id
    )

    if year:
        query = query.filter(extract('year', TaxCategorizedExpense.expense_date) == year)

    if month:
        query = query.filter(extract('month', TaxCategorizedExpense.expense_date) == month)

    expenses = query.order_by(desc(TaxCategorizedExpense.expense_date)).all()

    # Calculate by category
    category_totals = {}
    for exp in expenses:
        cat = exp.tax_category.value if exp.tax_category else "uncategorized"
        if cat not in category_totals:
            category_totals[cat] = {"total": 0, "count": 0}
        category_totals[cat]["total"] += float(exp.amount)
        category_totals[cat]["count"] += 1

    total_amount = sum(float(exp.amount) for exp in expenses)

    return {
        "property_id": property_id,
        "filters": {
            "year": year,
            "month": month
        },
        "summary": {
            "total_amount": total_amount,
            "expense_count": len(expenses),
            "by_category": category_totals
        },
        "expenses": [
            {
                "id": exp.id,
                "description": exp.description,
                "amount": float(exp.amount),
                "expense_date": exp.expense_date.isoformat() if exp.expense_date else None,
                "tax_category": exp.tax_category.value if exp.tax_category else None,
                "vendor_name": exp.vendor_name,
                "is_auto_logged": exp.is_auto_logged,
                "is_paid": exp.is_paid
            }
            for exp in expenses
        ]
    }


@router.get("/admin/expenses/categories")
async def get_expenses_by_category(
    year: Optional[int] = Query(None, description="Filter by year"),
    property_id: Optional[str] = Query(None, description="Filter by property"),
    db: Session = Depends(get_db)
):
    """
    Get expense totals grouped by tax category.
    Perfect for CPA tax preparation and Schedule E filling.
    """
    query = db.query(
        TaxCategorizedExpense.tax_category,
        func.sum(TaxCategorizedExpense.amount).label('total'),
        func.count(TaxCategorizedExpense.id).label('count')
    )

    if year:
        query = query.filter(extract('year', TaxCategorizedExpense.expense_date) == year)

    if property_id:
        query = query.filter(TaxCategorizedExpense.property_id == property_id)

    results = query.group_by(TaxCategorizedExpense.tax_category).all()

    # Build category breakdown with descriptions
    category_descriptions = {
        TaxCategory.ADVERTISING: "Advertising costs for property listings",
        TaxCategory.AUTO_TRAVEL: "Auto and travel expenses for property visits",
        TaxCategory.CLEANING_MAINTENANCE: "Cleaning and routine maintenance",
        TaxCategory.COMMISSIONS: "Booking platform commissions",
        TaxCategory.INSURANCE: "Property insurance premiums",
        TaxCategory.LEGAL_PROFESSIONAL: "Legal and professional fees",
        TaxCategory.MANAGEMENT_FEES: "Property management fees",
        TaxCategory.MORTGAGE_INTEREST: "Mortgage interest payments",
        TaxCategory.OTHER_INTEREST: "Other interest expenses",
        TaxCategory.REPAIRS: "Repairs and fixes",
        TaxCategory.SUPPLIES: "Supplies and consumables",
        TaxCategory.TAXES: "Property taxes",
        TaxCategory.UTILITIES: "Utility bills",
        TaxCategory.DEPRECIATION: "Depreciation (calculated)",
        TaxCategory.PEST_CONTROL: "Pest control services",
        TaxCategory.LANDSCAPING: "Lawn and landscaping",
        TaxCategory.POOL_SERVICE: "Pool maintenance",
        TaxCategory.HVAC_SERVICE: "HVAC service and repairs",
        TaxCategory.SECURITY: "Security systems and services",
        TaxCategory.TRASH_REMOVAL: "Trash and waste removal",
        TaxCategory.CARPET_FLOORING: "Carpet and flooring",
        TaxCategory.APPLIANCE_REPAIR: "Appliance repairs",
        TaxCategory.PLUMBING: "Plumbing services",
        TaxCategory.ELECTRICAL: "Electrical services",
        TaxCategory.ROOF_EXTERIOR: "Roof and exterior",
        TaxCategory.FURNITURE: "Furniture purchases",
        TaxCategory.LINENS_TOWELS: "Linens and towels",
        TaxCategory.AMENITIES: "Guest amenities",
        TaxCategory.NA: "Not applicable / Uncategorized",
        TaxCategory.OTHER: "Other expenses"
    }

    categories = []
    grand_total = 0

    for cat, total, count in results:
        cat_value = cat.value if cat else "uncategorized"
        cat_total = float(total or 0)
        grand_total += cat_total

        categories.append({
            "category": cat_value,
            "display_name": cat_value.replace("_", " ").title(),
            "description": category_descriptions.get(cat, ""),
            "total": cat_total,
            "count": count,
            "schedule_e_line": get_schedule_e_line(cat) if cat else None
        })

    # Sort by total descending
    categories.sort(key=lambda x: x["total"], reverse=True)

    return {
        "year": year or "all years",
        "property_id": property_id or "all properties",
        "grand_total": grand_total,
        "category_count": len(categories),
        "categories": categories,
        "tax_categories": [c.value for c in TaxCategory]
    }


@router.put("/admin/expenses/{expense_id}")
async def update_expense(
    expense_id: int,
    expense: ExpenseUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing expense.
    Can update category, amount, description, payment status, etc.
    """
    existing = db.query(TaxCategorizedExpense).filter(
        TaxCategorizedExpense.id == expense_id
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail=f"Expense {expense_id} not found")

    # Update fields if provided
    update_data = expense.dict(exclude_unset=True)

    if "tax_category" in update_data and update_data["tax_category"]:
        try:
            update_data["tax_category"] = TaxCategory(update_data["tax_category"])
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid tax category")

    if "expense_date" in update_data and update_data["expense_date"]:
        try:
            update_data["expense_date"] = datetime.strptime(update_data["expense_date"], "%Y-%m-%d").date()
            update_data["tax_year"] = update_data["expense_date"].year
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")

    if "amount" in update_data and update_data["amount"]:
        update_data["amount"] = Decimal(str(update_data["amount"]))

    for key, value in update_data.items():
        if value is not None:
            setattr(existing, key, value)

    db.commit()
    db.refresh(existing)

    logger.info(f"Updated expense {expense_id}")

    return {
        "success": True,
        "expense": {
            "id": existing.id,
            "property_id": existing.property_id,
            "description": existing.description,
            "amount": float(existing.amount),
            "expense_date": existing.expense_date.isoformat() if existing.expense_date else None,
            "tax_category": existing.tax_category.value if existing.tax_category else None,
            "updated_at": existing.updated_at.isoformat() if existing.updated_at else None
        }
    }


@router.delete("/admin/expenses/{expense_id}")
async def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete an expense.
    Cannot delete exported expenses unless forced.
    """
    existing = db.query(TaxCategorizedExpense).filter(
        TaxCategorizedExpense.id == expense_id
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail=f"Expense {expense_id} not found")

    if existing.exported_to_cpa:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete expense that has been exported to CPA. Mark as void instead."
        )

    db.delete(existing)
    db.commit()

    logger.info(f"Deleted expense {expense_id}")

    return {
        "success": True,
        "message": f"Expense {expense_id} deleted"
    }


# ============================================================================
# WORKER JOB EXPENSES (Auto-logged)
# ============================================================================

@router.get("/admin/expenses/worker-jobs")
async def list_worker_job_expenses(
    job_type: Optional[str] = Query(None, description="Filter by job type"),
    property_id: Optional[str] = Query(None, description="Filter by property"),
    is_paid: Optional[bool] = Query(None, description="Filter by payment status"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    List auto-logged expenses from worker jobs (cleaners, pool techs, etc).
    """
    query = db.query(WorkerJobExpense)

    if job_type:
        try:
            jt = WorkerJobType(job_type)
            query = query.filter(WorkerJobExpense.job_type == jt)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid job type: {job_type}")

    if property_id:
        query = query.filter(WorkerJobExpense.property_id == property_id)

    if is_paid is not None:
        query = query.filter(WorkerJobExpense.is_paid == is_paid)

    if start_date:
        query = query.filter(WorkerJobExpense.expense_date >= datetime.strptime(start_date, "%Y-%m-%d").date())

    if end_date:
        query = query.filter(WorkerJobExpense.expense_date <= datetime.strptime(end_date, "%Y-%m-%d").date())

    total = query.count()
    expenses = query.order_by(desc(WorkerJobExpense.expense_date)).offset(offset).limit(limit).all()

    # Calculate summary by job type
    type_summary = {}
    for exp in expenses:
        jt = exp.job_type.value if exp.job_type else "other"
        if jt not in type_summary:
            type_summary[jt] = {"total": 0, "count": 0, "paid": 0, "unpaid": 0}
        type_summary[jt]["total"] += float(exp.amount)
        type_summary[jt]["count"] += 1
        if exp.is_paid:
            type_summary[jt]["paid"] += 1
        else:
            type_summary[jt]["unpaid"] += 1

    return {
        "expenses": [
            {
                "id": exp.id,
                "property_id": exp.property_id,
                "worker_job_id": exp.worker_job_id,
                "job_type": exp.job_type.value if exp.job_type else None,
                "worker_id": exp.worker_id,
                "worker_name": exp.worker_name,
                "amount": float(exp.amount),
                "description": exp.description,
                "expense_date": exp.expense_date.isoformat() if exp.expense_date else None,
                "tax_category": exp.tax_category.value if exp.tax_category else None,
                "job_duration_mins": exp.job_duration_mins,
                "job_score": exp.job_score,
                "is_paid": exp.is_paid,
                "paid_date": exp.paid_date.isoformat() if exp.paid_date else None,
                "payment_method": exp.payment_method,
                "synced_to_expense_id": exp.synced_to_expense_id,
                "booking_id": exp.booking_id,
                "notes": exp.notes,
                "created_at": exp.created_at.isoformat() if exp.created_at else None
            }
            for exp in expenses
        ],
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total
        },
        "summary": {
            "by_job_type": type_summary,
            "total_amount": sum(float(exp.amount) for exp in expenses),
            "total_paid": sum(1 for exp in expenses if exp.is_paid),
            "total_unpaid": sum(1 for exp in expenses if not exp.is_paid)
        }
    }


@router.put("/admin/expenses/worker-jobs/{expense_id}/pay")
async def mark_worker_expense_paid(
    expense_id: int,
    payment_method: str = Query(..., description="Payment method: cash, check, venmo, zelle, etc"),
    payment_reference: Optional[str] = Query(None, description="Check number, Venmo ID, etc"),
    db: Session = Depends(get_db)
):
    """
    Mark a worker job expense as paid.
    """
    expense = db.query(WorkerJobExpense).filter(WorkerJobExpense.id == expense_id).first()

    if not expense:
        raise HTTPException(status_code=404, detail=f"Worker expense {expense_id} not found")

    expense.is_paid = True
    expense.paid_date = date.today()
    expense.payment_method = payment_method
    expense.payment_reference = payment_reference

    db.commit()

    logger.info(f"Marked worker expense {expense_id} as paid via {payment_method}")

    return {
        "success": True,
        "expense_id": expense_id,
        "paid_date": expense.paid_date.isoformat(),
        "payment_method": payment_method
    }


# ============================================================================
# PROPERTY SERVICE FEES
# ============================================================================

@router.get("/admin/service-fees")
async def list_service_fees(
    property_id: Optional[str] = Query(None, description="Filter by property"),
    service_type: Optional[str] = Query(None, description="Filter by service type"),
    db: Session = Depends(get_db)
):
    """
    List configured service fees for properties.
    """
    query = db.query(PropertyServiceFees).filter(PropertyServiceFees.is_active == True)

    if property_id:
        query = query.filter(PropertyServiceFees.property_id == property_id)

    if service_type:
        try:
            st = WorkerJobType(service_type)
            query = query.filter(PropertyServiceFees.service_type == st)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid service type")

    fees = query.all()

    return {
        "service_fees": [
            {
                "id": fee.id,
                "property_id": fee.property_id,
                "service_type": fee.service_type.value if fee.service_type else None,
                "base_fee": float(fee.base_fee),
                "deep_clean_fee": float(fee.deep_clean_fee) if fee.deep_clean_fee else None,
                "emergency_fee": float(fee.emergency_fee) if fee.emergency_fee else None,
                "per_bedroom_fee": float(fee.per_bedroom_fee) if fee.per_bedroom_fee else 0,
                "per_bathroom_fee": float(fee.per_bathroom_fee) if fee.per_bathroom_fee else 0,
                "service_frequency": fee.service_frequency,
                "tax_category_override": fee.tax_category_override.value if fee.tax_category_override else None,
                "notes": fee.notes
            }
            for fee in fees
        ],
        "service_types": [t.value for t in WorkerJobType]
    }


@router.post("/admin/service-fees")
async def create_service_fee(
    fee: PropertyServiceFeeCreate,
    db: Session = Depends(get_db)
):
    """
    Create or update a service fee for a property.
    """
    try:
        service_type = WorkerJobType(fee.service_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid service type: {fee.service_type}")

    # Check if fee already exists
    existing = db.query(PropertyServiceFees).filter(
        PropertyServiceFees.property_id == fee.property_id,
        PropertyServiceFees.service_type == service_type
    ).first()

    if existing:
        # Update existing
        existing.base_fee = Decimal(str(fee.base_fee))
        existing.deep_clean_fee = Decimal(str(fee.deep_clean_fee)) if fee.deep_clean_fee else None
        existing.emergency_fee = Decimal(str(fee.emergency_fee)) if fee.emergency_fee else None
        existing.per_bedroom_fee = Decimal(str(fee.per_bedroom_fee))
        existing.per_bathroom_fee = Decimal(str(fee.per_bathroom_fee))
        existing.service_frequency = fee.service_frequency
        existing.notes = fee.notes
        existing.is_active = True
        db.commit()

        return {
            "success": True,
            "action": "updated",
            "service_fee_id": existing.id
        }
    else:
        # Create new
        new_fee = PropertyServiceFees(
            property_id=fee.property_id,
            service_type=service_type,
            base_fee=Decimal(str(fee.base_fee)),
            deep_clean_fee=Decimal(str(fee.deep_clean_fee)) if fee.deep_clean_fee else None,
            emergency_fee=Decimal(str(fee.emergency_fee)) if fee.emergency_fee else None,
            per_bedroom_fee=Decimal(str(fee.per_bedroom_fee)),
            per_bathroom_fee=Decimal(str(fee.per_bathroom_fee)),
            service_frequency=fee.service_frequency,
            notes=fee.notes
        )
        db.add(new_fee)
        db.commit()
        db.refresh(new_fee)

        return {
            "success": True,
            "action": "created",
            "service_fee_id": new_fee.id
        }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_schedule_e_line(tax_category: TaxCategory) -> Optional[str]:
    """
    Map tax category to IRS Schedule E line number.
    """
    schedule_e_mapping = {
        TaxCategory.ADVERTISING: "Line 5 - Advertising",
        TaxCategory.AUTO_TRAVEL: "Line 6 - Auto and travel",
        TaxCategory.CLEANING_MAINTENANCE: "Line 7 - Cleaning and maintenance",
        TaxCategory.COMMISSIONS: "Line 8 - Commissions",
        TaxCategory.INSURANCE: "Line 9 - Insurance",
        TaxCategory.LEGAL_PROFESSIONAL: "Line 10 - Legal and other professional fees",
        TaxCategory.MANAGEMENT_FEES: "Line 11 - Management fees",
        TaxCategory.MORTGAGE_INTEREST: "Line 12 - Mortgage interest paid",
        TaxCategory.OTHER_INTEREST: "Line 13 - Other interest",
        TaxCategory.REPAIRS: "Line 14 - Repairs",
        TaxCategory.SUPPLIES: "Line 15 - Supplies",
        TaxCategory.TAXES: "Line 16 - Taxes",
        TaxCategory.UTILITIES: "Line 17 - Utilities",
        TaxCategory.DEPRECIATION: "Line 18 - Depreciation",
        TaxCategory.OTHER: "Line 19 - Other"
    }
    return schedule_e_mapping.get(tax_category)
