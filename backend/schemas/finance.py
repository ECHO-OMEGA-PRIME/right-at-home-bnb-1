"""
Finance schemas for Right at Home BnB
Revenue, expenses, P&L, tax reporting
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from .base import BaseSchema, TimestampMixin, IDMixin, DateRange


class ExpenseCategory(str, Enum):
    """Expense categories for tax purposes"""
    CLEANING = "CLEANING"
    MAINTENANCE = "MAINTENANCE"
    REPAIRS = "REPAIRS"
    UTILITIES = "UTILITIES"
    SUPPLIES = "SUPPLIES"
    FURNITURE = "FURNITURE"
    APPLIANCES = "APPLIANCES"
    INSURANCE = "INSURANCE"
    PROPERTY_TAX = "PROPERTY_TAX"
    HOA = "HOA"
    MORTGAGE_INTEREST = "MORTGAGE_INTEREST"
    MARKETING = "MARKETING"
    SOFTWARE = "SOFTWARE"
    PROFESSIONAL_FEES = "PROFESSIONAL_FEES"
    TRAVEL = "TRAVEL"
    OFFICE = "OFFICE"
    LICENSES = "LICENSES"
    DEPRECIATION = "DEPRECIATION"
    OTHER = "OTHER"


class ExpenseStatus(str, Enum):
    """Expense approval status"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PAID = "PAID"
    REIMBURSED = "REIMBURSED"


class PaymentMethod(str, Enum):
    """Payment method"""
    CASH = "CASH"
    CHECK = "CHECK"
    CREDIT_CARD = "CREDIT_CARD"
    DEBIT_CARD = "DEBIT_CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    VENMO = "VENMO"
    PAYPAL = "PAYPAL"
    OTHER = "OTHER"


class RevenueSource(str, Enum):
    """Revenue sources"""
    AIRBNB = "AIRBNB"
    VRBO = "VRBO"
    BOOKING = "BOOKING"
    DIRECT = "DIRECT"
    CLEANING_FEE = "CLEANING_FEE"
    LATE_CHECKOUT = "LATE_CHECKOUT"
    PET_FEE = "PET_FEE"
    DAMAGE_DEPOSIT = "DAMAGE_DEPOSIT"
    OTHER = "OTHER"


class TaxCategory(str, Enum):
    """IRS tax categories for deductions"""
    SCHEDULE_E = "SCHEDULE_E"  # Rental income
    SCHEDULE_C = "SCHEDULE_C"  # Business income
    NOT_DEDUCTIBLE = "NOT_DEDUCTIBLE"
    CAPITAL_EXPENSE = "CAPITAL_EXPENSE"
    PERSONAL = "PERSONAL"


class ReportPeriod(str, Enum):
    """Report period type"""
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"
    CUSTOM = "CUSTOM"


# ============================================
# EXPENSE SCHEMAS
# ============================================

class ExpenseBase(BaseSchema):
    """Base expense schema"""
    property_id: str
    category: ExpenseCategory
    subcategory: Optional[str] = Field(default=None, max_length=100)
    amount: Decimal = Field(..., ge=0, decimal_places=2)
    description: str = Field(..., min_length=1, max_length=500)
    vendor: Optional[str] = Field(default=None, max_length=255)
    expense_date: date


class ExpenseCreate(ExpenseBase):
    """Schema for creating an expense"""
    payment_method: PaymentMethod = PaymentMethod.CREDIT_CARD
    receipt_url: Optional[str] = None
    is_tax_deductible: bool = Field(default=True)
    tax_category: TaxCategory = TaxCategory.SCHEDULE_E
    notes: Optional[str] = Field(default=None, max_length=1000)
    tags: List[str] = Field(default_factory=list)


class ExpenseUpdate(BaseSchema):
    """Schema for updating an expense"""
    category: Optional[ExpenseCategory] = None
    subcategory: Optional[str] = Field(default=None, max_length=100)
    amount: Optional[Decimal] = Field(default=None, ge=0)
    description: Optional[str] = Field(default=None, max_length=500)
    vendor: Optional[str] = Field(default=None, max_length=255)
    expense_date: Optional[date] = None
    payment_method: Optional[PaymentMethod] = None
    receipt_url: Optional[str] = None
    is_tax_deductible: Optional[bool] = None
    tax_category: Optional[TaxCategory] = None
    status: Optional[ExpenseStatus] = None
    notes: Optional[str] = Field(default=None, max_length=1000)


class ExpenseResponse(ExpenseBase, IDMixin, TimestampMixin):
    """Full expense response"""
    payment_method: PaymentMethod
    receipt_url: Optional[str] = None
    is_tax_deductible: bool = Field(default=True)
    tax_category: TaxCategory
    status: ExpenseStatus = ExpenseStatus.PENDING
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    # Property info
    property_name: Optional[str] = None

    # Approval
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

    # Created by
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None


class ExpenseListResponse(BaseSchema):
    """Simplified expense for list views"""
    id: str
    property_id: str
    property_name: str
    category: ExpenseCategory
    amount: Decimal
    description: str
    expense_date: date
    status: ExpenseStatus
    has_receipt: bool


class ExpenseSearchParams(BaseSchema):
    """Expense search/filter parameters"""
    property_id: Optional[str] = None
    category: Optional[ExpenseCategory] = None
    status: Optional[ExpenseStatus] = None
    tax_category: Optional[TaxCategory] = None
    min_amount: Optional[Decimal] = Field(default=None, ge=0)
    max_amount: Optional[Decimal] = Field(default=None, ge=0)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    vendor: Optional[str] = None
    has_receipt: Optional[bool] = None
    is_tax_deductible: Optional[bool] = None
    q: Optional[str] = Field(default=None, description="Search in description/vendor")


# ============================================
# REVENUE SCHEMAS
# ============================================

class RevenueEntry(BaseSchema):
    """Individual revenue entry"""
    id: str
    property_id: str
    property_name: str
    booking_id: Optional[str] = None
    source: RevenueSource
    amount: Decimal = Field(..., ge=0)
    description: str
    date: date
    is_taxable: bool = Field(default=True)
    platform_fee: Decimal = Field(default=Decimal("0"), ge=0)
    net_amount: Decimal = Field(..., ge=0)


class RevenueBreakdown(BaseSchema):
    """Revenue breakdown by category"""
    gross_revenue: Decimal = Field(default=Decimal("0"))
    cleaning_fees: Decimal = Field(default=Decimal("0"))
    platform_fees: Decimal = Field(default=Decimal("0"))
    service_fees: Decimal = Field(default=Decimal("0"))
    refunds: Decimal = Field(default=Decimal("0"))
    net_revenue: Decimal = Field(default=Decimal("0"))

    by_source: Dict[str, Decimal] = Field(default_factory=dict)
    by_property: Dict[str, Decimal] = Field(default_factory=dict)


# ============================================
# P&L REPORTS
# ============================================

class PropertyPnL(BaseSchema):
    """Profit & Loss for a single property"""
    property_id: str
    property_name: str
    period_start: date
    period_end: date

    # Revenue
    gross_revenue: Decimal = Field(default=Decimal("0"))
    cleaning_fees_collected: Decimal = Field(default=Decimal("0"))
    other_revenue: Decimal = Field(default=Decimal("0"))
    total_revenue: Decimal = Field(default=Decimal("0"))

    # Platform fees
    airbnb_fees: Decimal = Field(default=Decimal("0"))
    vrbo_fees: Decimal = Field(default=Decimal("0"))
    other_fees: Decimal = Field(default=Decimal("0"))
    total_platform_fees: Decimal = Field(default=Decimal("0"))

    net_revenue: Decimal = Field(default=Decimal("0"))

    # Expenses by category
    expenses_by_category: Dict[str, Decimal] = Field(default_factory=dict)
    total_expenses: Decimal = Field(default=Decimal("0"))

    # Profit
    net_operating_income: Decimal = Field(default=Decimal("0"))
    profit_margin: float = Field(default=0, ge=-100, le=100)

    # Occupancy
    nights_booked: int = Field(default=0)
    nights_available: int = Field(default=0)
    occupancy_rate: float = Field(default=0, ge=0, le=1)
    avg_daily_rate: Decimal = Field(default=Decimal("0"))
    revenue_per_available_night: Decimal = Field(default=Decimal("0"))


class PortfolioPnL(BaseSchema):
    """P&L for entire portfolio"""
    period_start: date
    period_end: date
    period_type: ReportPeriod

    # Summary
    total_properties: int = Field(default=0)
    active_properties: int = Field(default=0)

    # Revenue
    total_revenue: Decimal = Field(default=Decimal("0"))
    total_platform_fees: Decimal = Field(default=Decimal("0"))
    net_revenue: Decimal = Field(default=Decimal("0"))

    # Expenses
    total_expenses: Decimal = Field(default=Decimal("0"))
    expenses_by_category: Dict[str, Decimal] = Field(default_factory=dict)

    # Profit
    net_operating_income: Decimal = Field(default=Decimal("0"))
    profit_margin: float = Field(default=0)

    # Performance
    total_bookings: int = Field(default=0)
    total_nights_booked: int = Field(default=0)
    avg_occupancy_rate: float = Field(default=0, ge=0, le=1)
    avg_daily_rate: Decimal = Field(default=Decimal("0"))

    # Per property breakdown
    properties: List[PropertyPnL] = Field(default_factory=list)

    # Comparisons
    revenue_vs_prior_period: Optional[float] = None
    profit_vs_prior_period: Optional[float] = None


class MonthlyFinancialSummary(BaseSchema):
    """Monthly financial summary"""
    year: int
    month: int
    month_name: str

    revenue: Decimal
    expenses: Decimal
    net_income: Decimal

    bookings: int
    occupancy_rate: float
    avg_nightly_rate: Decimal

    top_performing_property: Optional[str] = None
    lowest_performing_property: Optional[str] = None


# ============================================
# TAX REPORTS
# ============================================

class TaxSummary(BaseSchema):
    """Tax summary for year"""
    tax_year: int
    property_id: Optional[str] = Field(default=None, description="None for portfolio-wide")
    property_name: Optional[str] = None

    # Income
    gross_rental_income: Decimal = Field(default=Decimal("0"))
    other_income: Decimal = Field(default=Decimal("0"))
    total_income: Decimal = Field(default=Decimal("0"))

    # Deductions by category
    deductions: Dict[str, Decimal] = Field(default_factory=dict)
    total_deductions: Decimal = Field(default=Decimal("0"))

    # Net
    net_rental_income: Decimal = Field(default=Decimal("0"))

    # Depreciation (calculated)
    depreciation: Decimal = Field(default=Decimal("0"))

    # Estimated tax
    estimated_tax: Optional[Decimal] = None


class TaxExportRequest(BaseSchema):
    """Request tax export"""
    tax_year: int
    property_ids: Optional[List[str]] = Field(default=None, description="None for all")
    format: str = Field(default="csv", description="csv, pdf, xlsx")
    include_receipts: bool = Field(default=False)


class TaxExportResponse(BaseSchema):
    """Tax export result"""
    tax_year: int
    properties_included: int
    file_url: str
    format: str
    generated_at: datetime
    summary: TaxSummary


# ============================================
# DASHBOARD/ANALYTICS
# ============================================

class FinancialDashboard(BaseSchema):
    """Financial dashboard data"""
    as_of: datetime

    # This month
    mtd_revenue: Decimal
    mtd_expenses: Decimal
    mtd_profit: Decimal

    # Year to date
    ytd_revenue: Decimal
    ytd_expenses: Decimal
    ytd_profit: Decimal

    # Last 12 months trend
    monthly_data: List[MonthlyFinancialSummary]

    # Comparisons
    revenue_vs_last_month: float
    revenue_vs_last_year: float

    # Alerts
    pending_expenses: int
    expenses_missing_receipts: int
    upcoming_payments: List[Dict[str, Any]] = Field(default_factory=list)


class FinancialReportRequest(BaseSchema):
    """Request for financial report"""
    report_type: str = Field(..., description="pnl, tax_summary, revenue, expenses")
    period_type: ReportPeriod
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    property_ids: Optional[List[str]] = None
    format: str = Field(default="json", description="json, csv, pdf, xlsx")
    include_details: bool = Field(default=True)


# Export all
__all__ = [
    'ExpenseCategory',
    'ExpenseStatus',
    'PaymentMethod',
    'RevenueSource',
    'TaxCategory',
    'ReportPeriod',
    'ExpenseBase',
    'ExpenseCreate',
    'ExpenseUpdate',
    'ExpenseResponse',
    'ExpenseListResponse',
    'ExpenseSearchParams',
    'RevenueEntry',
    'RevenueBreakdown',
    'PropertyPnL',
    'PortfolioPnL',
    'MonthlyFinancialSummary',
    'TaxSummary',
    'TaxExportRequest',
    'TaxExportResponse',
    'FinancialDashboard',
    'FinancialReportRequest',
]
