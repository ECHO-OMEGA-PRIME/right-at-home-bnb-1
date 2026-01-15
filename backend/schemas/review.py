"""
Review schemas for Right at Home BnB
Guest reviews, host responses, reputation management
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, date
from enum import Enum
from .base import BaseSchema, TimestampMixin, IDMixin
from .guest import Platform


class ReviewSource(str, Enum):
    """Review source platform"""
    AIRBNB = "AIRBNB"
    VRBO = "VRBO"
    BOOKING = "BOOKING"
    GOOGLE = "GOOGLE"
    DIRECT = "DIRECT"
    INTERNAL = "INTERNAL"


class ReviewStatus(str, Enum):
    """Review status"""
    PENDING = "PENDING"
    PUBLISHED = "PUBLISHED"
    RESPONDED = "RESPONDED"
    FLAGGED = "FLAGGED"
    HIDDEN = "HIDDEN"


class ReviewType(str, Enum):
    """Review type"""
    GUEST_TO_HOST = "GUEST_TO_HOST"
    HOST_TO_GUEST = "HOST_TO_GUEST"


class ReviewSentiment(str, Enum):
    """Review sentiment"""
    VERY_POSITIVE = "VERY_POSITIVE"
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"
    VERY_NEGATIVE = "VERY_NEGATIVE"


class ReviewCategory(str, Enum):
    """Review feedback categories"""
    CLEANLINESS = "CLEANLINESS"
    COMMUNICATION = "COMMUNICATION"
    CHECK_IN = "CHECK_IN"
    ACCURACY = "ACCURACY"
    LOCATION = "LOCATION"
    VALUE = "VALUE"
    AMENITIES = "AMENITIES"
    OVERALL = "OVERALL"


class CategoryRating(BaseModel):
    """Individual category rating"""
    category: ReviewCategory
    rating: float = Field(..., ge=1, le=5)


class ReviewAnalysis(BaseModel):
    """AI analysis of review"""
    sentiment: ReviewSentiment
    sentiment_score: float = Field(..., ge=-1, le=1)
    key_positives: List[str] = Field(default_factory=list)
    key_negatives: List[str] = Field(default_factory=list)
    topics_mentioned: List[str] = Field(default_factory=list)
    actionable_feedback: List[str] = Field(default_factory=list)
    suggested_improvements: List[str] = Field(default_factory=list)
    response_priority: str = Field(default="normal", description="low, normal, high, urgent")


class ReviewResponse(BaseModel):
    """Host response to review"""
    response_id: str
    response_text: str
    responded_at: datetime
    responded_by: Optional[str] = None
    is_public: bool = Field(default=True)
    ai_generated: bool = Field(default=False)


# ============================================
# CRUD SCHEMAS
# ============================================

class ReviewBase(BaseSchema):
    """Base review schema"""
    property_id: str
    booking_id: Optional[str] = None
    guest_id: str

    source: ReviewSource
    review_type: ReviewType = ReviewType.GUEST_TO_HOST

    overall_rating: float = Field(..., ge=1, le=5)
    review_text: Optional[str] = Field(default=None, max_length=5000)


class ReviewCreate(ReviewBase):
    """Schema for creating/importing a review"""
    external_id: Optional[str] = Field(default=None, description="Platform review ID")
    reviewer_name: Optional[str] = None
    review_date: date

    category_ratings: Optional[List[CategoryRating]] = Field(default_factory=list)

    # For internal/direct reviews
    would_recommend: Optional[bool] = None
    would_stay_again: Optional[bool] = None


class ReviewUpdate(BaseSchema):
    """Schema for updating a review"""
    status: Optional[ReviewStatus] = None
    review_text: Optional[str] = Field(default=None, max_length=5000)
    overall_rating: Optional[float] = Field(default=None, ge=1, le=5)


class ReviewFullResponse(ReviewBase, IDMixin, TimestampMixin):
    """Full review response"""
    external_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    review_date: date
    status: ReviewStatus = ReviewStatus.PUBLISHED

    # Property/Guest info
    property_name: Optional[str] = None
    guest_name: Optional[str] = None

    # Category ratings
    category_ratings: List[CategoryRating] = Field(default_factory=list)

    # Analysis
    analysis: Optional[ReviewAnalysis] = None

    # Response
    host_response: Optional[ReviewResponse] = None
    needs_response: bool = Field(default=False)

    # Extra fields
    would_recommend: Optional[bool] = None
    would_stay_again: Optional[bool] = None
    helpful_votes: int = Field(default=0)


class ReviewListResponse(BaseSchema):
    """Simplified review for list views"""
    id: str
    property_id: str
    property_name: str
    guest_name: str
    source: ReviewSource
    overall_rating: float
    review_date: date
    status: ReviewStatus
    sentiment: Optional[ReviewSentiment] = None
    has_response: bool
    review_preview: str = Field(default="", description="First 150 chars")


class ReviewSearchParams(BaseSchema):
    """Review search/filter parameters"""
    property_id: Optional[str] = None
    guest_id: Optional[str] = None
    booking_id: Optional[str] = None
    source: Optional[ReviewSource] = None
    status: Optional[ReviewStatus] = None
    sentiment: Optional[ReviewSentiment] = None
    min_rating: Optional[float] = Field(default=None, ge=1, le=5)
    max_rating: Optional[float] = Field(default=None, ge=1, le=5)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    needs_response: Optional[bool] = None
    q: Optional[str] = Field(default=None, description="Search in review text")


# ============================================
# RESPONSE GENERATION
# ============================================

class GenerateResponseRequest(BaseSchema):
    """Request to generate AI response to review"""
    review_id: str
    tone: str = Field(default="professional", description="professional, friendly, apologetic")
    include_specifics: bool = Field(default=True)
    max_length: int = Field(default=500, ge=50, le=2000)


class GenerateResponseResponse(BaseSchema):
    """Generated review response"""
    review_id: str
    generated_response: str
    tone_used: str
    confidence: float = Field(..., ge=0, le=1)
    alternative_responses: List[str] = Field(default_factory=list)


class PostResponseRequest(BaseSchema):
    """Post response to a review"""
    review_id: str
    response_text: str = Field(..., min_length=10, max_length=2000)
    post_to_platform: bool = Field(default=False, description="Post to Airbnb/VRBO if possible")


# ============================================
# ANALYTICS
# ============================================

class PropertyReviewStats(BaseSchema):
    """Review statistics for a property"""
    property_id: str
    property_name: str

    total_reviews: int
    avg_rating: float = Field(..., ge=1, le=5)

    rating_distribution: Dict[int, int] = Field(default_factory=dict, description="1-5 star counts")
    category_averages: Dict[str, float] = Field(default_factory=dict)

    sentiment_distribution: Dict[str, int] = Field(default_factory=dict)
    response_rate: float = Field(default=0, ge=0, le=1)
    avg_response_time_hours: Optional[float] = None

    trending: str = Field(default="stable", description="improving, stable, declining")
    trend_vs_last_period: Optional[float] = None

    top_positive_topics: List[str] = Field(default_factory=list)
    top_negative_topics: List[str] = Field(default_factory=list)

    reviews_by_source: Dict[str, int] = Field(default_factory=dict)


class PortfolioReviewStats(BaseSchema):
    """Review statistics for entire portfolio"""
    as_of: datetime

    total_reviews: int
    avg_rating: float
    reviews_this_month: int
    reviews_last_month: int

    rating_distribution: Dict[int, int] = Field(default_factory=dict)
    sentiment_distribution: Dict[str, int] = Field(default_factory=dict)

    pending_responses: int
    flagged_reviews: int

    best_rated_property: Optional[Dict[str, Any]] = None
    worst_rated_property: Optional[Dict[str, Any]] = None

    recent_negative_reviews: List[ReviewListResponse] = Field(default_factory=list)

    improvement_areas: List[str] = Field(default_factory=list)


class ReviewTrend(BaseSchema):
    """Review trend over time"""
    period: str = Field(..., description="YYYY-MM")
    review_count: int
    avg_rating: float
    sentiment_positive: int
    sentiment_neutral: int
    sentiment_negative: int


class ReviewReportRequest(BaseSchema):
    """Request review report"""
    property_ids: Optional[List[str]] = None
    date_from: date
    date_to: date
    include_text: bool = Field(default=True)
    include_responses: bool = Field(default=True)
    format: str = Field(default="json", description="json, csv, pdf")


# Export all
__all__ = [
    'ReviewSource',
    'ReviewStatus',
    'ReviewType',
    'ReviewSentiment',
    'ReviewCategory',
    'CategoryRating',
    'ReviewAnalysis',
    'ReviewResponse',
    'ReviewBase',
    'ReviewCreate',
    'ReviewUpdate',
    'ReviewFullResponse',
    'ReviewListResponse',
    'ReviewSearchParams',
    'GenerateResponseRequest',
    'GenerateResponseResponse',
    'PostResponseRequest',
    'PropertyReviewStats',
    'PortfolioReviewStats',
    'ReviewTrend',
    'ReviewReportRequest',
]
