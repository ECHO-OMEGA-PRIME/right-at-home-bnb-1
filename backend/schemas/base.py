"""
Base schemas and common types for Right at Home BnB
"""

from typing import Optional, List, Dict, Any, Generic, TypeVar
from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime, date
from enum import Enum
import uuid


# Generic type for paginated responses
T = TypeVar('T')


class ResponseStatus(str, Enum):
    """API response status"""
    SUCCESS = "success"
    ERROR = "error"
    PARTIAL = "partial"


class SortOrder(str, Enum):
    """Sort order options"""
    ASC = "asc"
    DESC = "desc"


class BaseSchema(BaseModel):
    """Base schema with common configuration"""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
    )


class TimestampMixin(BaseModel):
    """Mixin for created_at and updated_at timestamps"""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class IDMixin(BaseModel):
    """Mixin for ID field"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = Field(default=1, ge=1, description="Page number")
    limit: int = Field(default=20, ge=1, le=100, description="Items per page")
    sort_by: Optional[str] = Field(default=None, description="Field to sort by")
    sort_order: SortOrder = Field(default=SortOrder.DESC, description="Sort order")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper"""
    items: List[T]
    total: int
    page: int
    limit: int
    pages: int
    has_next: bool
    has_prev: bool

    @classmethod
    def create(cls, items: List[T], total: int, page: int, limit: int):
        pages = (total + limit - 1) // limit
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
            has_next=page < pages,
            has_prev=page > 1
        )


class APIResponse(BaseModel, Generic[T]):
    """Standard API response wrapper"""
    status: ResponseStatus = ResponseStatus.SUCCESS
    message: Optional[str] = None
    data: Optional[T] = None
    errors: Optional[List[str]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @classmethod
    def success(cls, data: T = None, message: str = None):
        return cls(status=ResponseStatus.SUCCESS, data=data, message=message)

    @classmethod
    def error(cls, message: str, errors: List[str] = None):
        return cls(status=ResponseStatus.ERROR, message=message, errors=errors)


class GeoLocation(BaseModel):
    """Geographic coordinates"""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = Field(default=None, ge=0, description="Accuracy in meters")
    timestamp: Optional[datetime] = None


class Address(BaseModel):
    """Full address schema"""
    street: str = Field(..., min_length=1, max_length=255)
    city: str = Field(default="Midland", min_length=1, max_length=100)
    state: str = Field(default="TX", min_length=2, max_length=50)
    zip_code: str = Field(..., pattern=r"^\d{5}(-\d{4})?$")
    country: str = Field(default="USA")
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @property
    def full_address(self) -> str:
        return f"{self.street}, {self.city}, {self.state} {self.zip_code}"


class DateRange(BaseModel):
    """Date range filter"""
    start_date: date
    end_date: date

    @field_validator('end_date')
    @classmethod
    def end_after_start(cls, v, info):
        if 'start_date' in info.data and v < info.data['start_date']:
            raise ValueError('end_date must be after start_date')
        return v


class DateTimeRange(BaseModel):
    """DateTime range filter"""
    start: datetime
    end: datetime

    @field_validator('end')
    @classmethod
    def end_after_start(cls, v, info):
        if 'start' in info.data and v < info.data['start']:
            raise ValueError('end must be after start')
        return v


class MoneyAmount(BaseModel):
    """Money amount with currency"""
    amount: float = Field(..., ge=0)
    currency: str = Field(default="USD", max_length=3)


class ContactInfo(BaseModel):
    """Contact information"""
    email: Optional[str] = Field(default=None, pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    phone: Optional[str] = Field(default=None, pattern=r"^\+?1?\d{10,14}$")
    whatsapp: Optional[str] = None


class FileUpload(BaseModel):
    """File upload metadata"""
    filename: str
    content_type: str
    size: int = Field(..., gt=0)
    url: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class BulkOperationResult(BaseModel):
    """Result of bulk operations"""
    total: int
    succeeded: int
    failed: int
    errors: List[Dict[str, Any]] = []


# Export all
__all__ = [
    'ResponseStatus',
    'SortOrder',
    'BaseSchema',
    'TimestampMixin',
    'IDMixin',
    'PaginationParams',
    'PaginatedResponse',
    'APIResponse',
    'GeoLocation',
    'Address',
    'DateRange',
    'DateTimeRange',
    'MoneyAmount',
    'ContactInfo',
    'FileUpload',
    'BulkOperationResult',
]
