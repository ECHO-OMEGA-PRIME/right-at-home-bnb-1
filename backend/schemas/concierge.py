"""
AI Concierge schemas for Right at Home BnB
Guest assistance, recommendations, voice interactions
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
from .base import BaseSchema, TimestampMixin, IDMixin


class ConciergeCategory(str, Enum):
    """Query category classification"""
    PROPERTY_INFO = "PROPERTY_INFO"
    CHECK_IN = "CHECK_IN"
    CHECK_OUT = "CHECK_OUT"
    LATE_CHECKOUT = "LATE_CHECKOUT"
    WIFI = "WIFI"
    AMENITIES = "AMENITIES"
    DIRECTIONS = "DIRECTIONS"
    RESTAURANTS = "RESTAURANTS"
    ACTIVITIES = "ACTIVITIES"
    SHOPPING = "SHOPPING"
    EMERGENCY = "EMERGENCY"
    MAINTENANCE = "MAINTENANCE"
    COMPLAINT = "COMPLAINT"
    FEEDBACK = "FEEDBACK"
    BOOKING = "BOOKING"
    PAYMENT = "PAYMENT"
    EXTENSION = "EXTENSION"
    TRANSPORTATION = "TRANSPORTATION"
    LOCAL_EVENTS = "LOCAL_EVENTS"
    WEATHER = "WEATHER"
    GENERAL = "GENERAL"


class ConciergeIntent(str, Enum):
    """Detected user intent"""
    QUESTION = "QUESTION"
    REQUEST = "REQUEST"
    COMPLAINT = "COMPLAINT"
    FEEDBACK = "FEEDBACK"
    EMERGENCY = "EMERGENCY"
    BOOKING_CHANGE = "BOOKING_CHANGE"
    SMALL_TALK = "SMALL_TALK"


class ConciergePriority(str, Enum):
    """Response priority"""
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"
    EMERGENCY = "EMERGENCY"


class ResponseChannel(str, Enum):
    """Response channel"""
    TEXT = "TEXT"
    VOICE = "VOICE"
    BOTH = "BOTH"


class IntentClassification(BaseModel):
    """Intent classification result"""
    primary_intent: ConciergeIntent
    confidence: float = Field(..., ge=0, le=1)
    category: ConciergeCategory
    priority: ConciergePriority
    requires_human: bool = Field(default=False)
    escalation_reason: Optional[str] = None


class EntityExtraction(BaseModel):
    """Extracted entities from query"""
    property_name: Optional[str] = None
    date_mentioned: Optional[datetime] = None
    time_mentioned: Optional[str] = None
    location_mentioned: Optional[str] = None
    amount_mentioned: Optional[float] = None
    person_mentioned: Optional[str] = None
    other_entities: Dict[str, str] = Field(default_factory=dict)


class LocalRecommendation(BaseModel):
    """Local business/activity recommendation"""
    name: str
    category: str
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = Field(default=None, ge=1, le=5)
    price_level: Optional[str] = None
    distance_miles: Optional[float] = None
    description: Optional[str] = None
    reason: Optional[str] = Field(default=None, description="Why recommended")


class ConciergeSuggestion(BaseModel):
    """Suggested follow-up or action"""
    suggestion_type: str
    description: str
    action_url: Optional[str] = None
    priority: str = Field(default="normal")


# ============================================
# QUERY SCHEMAS
# ============================================

class ConciergeQueryBase(BaseSchema):
    """Base concierge query schema"""
    query: str = Field(..., min_length=1, max_length=2000)


class ConciergeQueryCreate(ConciergeQueryBase):
    """Create a concierge query"""
    guest_id: Optional[str] = None
    booking_id: Optional[str] = None
    property_id: Optional[str] = None
    channel: ResponseChannel = ResponseChannel.TEXT
    voice_input: bool = Field(default=False)
    audio_url: Optional[str] = None
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ConciergeQueryResponse(BaseSchema):
    """Concierge response to query"""
    query_id: str
    query: str
    response: str

    # Classification
    classification: IntentClassification
    entities: EntityExtraction

    # Response metadata
    response_generated_at: datetime
    response_time_ms: int
    model_used: str

    # Voice
    voice_response_url: Optional[str] = None
    voice_duration_seconds: Optional[float] = None

    # Quality
    confidence: float = Field(..., ge=0, le=1)
    was_helpful: Optional[bool] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)

    # Suggestions and recommendations
    suggestions: List[ConciergeSuggestion] = Field(default_factory=list)
    recommendations: List[LocalRecommendation] = Field(default_factory=list)

    # Escalation
    requires_human: bool = Field(default=False)
    escalated_to: Optional[str] = None

    # Context
    property_name: Optional[str] = None
    guest_name: Optional[str] = None


class ConciergeQueryListResponse(BaseSchema):
    """Simplified query for list views"""
    id: str
    query_preview: str
    response_preview: str
    category: ConciergeCategory
    intent: ConciergeIntent
    guest_name: Optional[str] = None
    property_name: Optional[str] = None
    was_helpful: Optional[bool] = None
    created_at: datetime


class ConciergeQuerySearchParams(BaseSchema):
    """Query search/filter parameters"""
    guest_id: Optional[str] = None
    property_id: Optional[str] = None
    booking_id: Optional[str] = None
    category: Optional[ConciergeCategory] = None
    intent: Optional[ConciergeIntent] = None
    priority: Optional[ConciergePriority] = None
    was_helpful: Optional[bool] = None
    requires_human: Optional[bool] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    q: Optional[str] = Field(default=None, description="Search in query/response")


# ============================================
# CHAT SESSION
# ============================================

class ChatMessage(BaseModel):
    """Single chat message"""
    role: str = Field(..., description="user, assistant, system")
    content: str
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None


class ChatSession(BaseSchema):
    """Concierge chat session"""
    session_id: str
    guest_id: Optional[str] = None
    booking_id: Optional[str] = None
    property_id: Optional[str] = None

    messages: List[ChatMessage]
    message_count: int

    started_at: datetime
    last_activity: datetime

    categories_discussed: List[ConciergeCategory] = Field(default_factory=list)
    issues_raised: List[str] = Field(default_factory=list)
    actions_taken: List[str] = Field(default_factory=list)

    overall_sentiment: Optional[str] = None
    satisfaction_score: Optional[int] = Field(default=None, ge=1, le=5)


class StartChatRequest(BaseSchema):
    """Start a new chat session"""
    guest_id: Optional[str] = None
    booking_id: Optional[str] = None
    property_id: Optional[str] = None
    initial_message: Optional[str] = None
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ChatMessageRequest(BaseSchema):
    """Send message in chat session"""
    session_id: str
    message: str = Field(..., min_length=1, max_length=2000)
    voice_input: bool = Field(default=False)
    audio_url: Optional[str] = None


class ChatMessageResponse(BaseSchema):
    """Response to chat message"""
    session_id: str
    message_id: str
    user_message: str
    assistant_response: str

    classification: IntentClassification
    suggestions: List[ConciergeSuggestion] = Field(default_factory=list)
    recommendations: List[LocalRecommendation] = Field(default_factory=list)

    voice_response_url: Optional[str] = None
    response_time_ms: int


# ============================================
# KNOWLEDGE BASE
# ============================================

class KnowledgeBaseEntry(BaseModel):
    """Entry in concierge knowledge base"""
    id: str
    category: ConciergeCategory
    question: str
    answer: str
    keywords: List[str] = Field(default_factory=list)
    property_specific: Optional[str] = Field(default=None, description="Property ID if specific")
    priority: int = Field(default=0)
    created_at: datetime
    updated_at: datetime


class KnowledgeBaseCreate(BaseSchema):
    """Create knowledge base entry"""
    category: ConciergeCategory
    question: str = Field(..., min_length=5, max_length=500)
    answer: str = Field(..., min_length=10, max_length=5000)
    keywords: List[str] = Field(default_factory=list)
    property_id: Optional[str] = None


class KnowledgeBaseUpdate(BaseSchema):
    """Update knowledge base entry"""
    question: Optional[str] = Field(default=None, max_length=500)
    answer: Optional[str] = Field(default=None, max_length=5000)
    keywords: Optional[List[str]] = None
    category: Optional[ConciergeCategory] = None


# ============================================
# ANALYTICS
# ============================================

class ConciergeStats(BaseSchema):
    """Concierge usage statistics"""
    period_start: datetime
    period_end: datetime

    total_queries: int
    unique_guests: int

    queries_by_category: Dict[str, int] = Field(default_factory=dict)
    queries_by_intent: Dict[str, int] = Field(default_factory=dict)

    avg_response_time_ms: float
    escalation_rate: float = Field(..., ge=0, le=1)

    helpful_rate: Optional[float] = Field(default=None, ge=0, le=1)
    avg_satisfaction: Optional[float] = Field(default=None, ge=1, le=5)

    top_questions: List[str] = Field(default_factory=list)
    common_issues: List[str] = Field(default_factory=list)

    voice_queries: int = Field(default=0)
    voice_percentage: float = Field(default=0, ge=0, le=1)


class ConciergePerformance(BaseSchema):
    """Concierge performance metrics"""
    accuracy_score: float = Field(..., ge=0, le=1)
    relevance_score: float = Field(..., ge=0, le=1)
    helpfulness_score: float = Field(..., ge=0, le=1)
    response_quality_score: float = Field(..., ge=0, le=1)

    improvement_suggestions: List[str] = Field(default_factory=list)
    training_recommendations: List[str] = Field(default_factory=list)


# ============================================
# FEEDBACK
# ============================================

class ConciergeFeeback(BaseSchema):
    """Feedback on concierge response"""
    query_id: str
    was_helpful: bool
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    feedback_text: Optional[str] = Field(default=None, max_length=1000)
    issue_category: Optional[str] = None


# Export all
__all__ = [
    'ConciergeCategory',
    'ConciergeIntent',
    'ConciergePriority',
    'ResponseChannel',
    'IntentClassification',
    'EntityExtraction',
    'LocalRecommendation',
    'ConciergeSuggestion',
    'ConciergeQueryBase',
    'ConciergeQueryCreate',
    'ConciergeQueryResponse',
    'ConciergeQueryListResponse',
    'ConciergeQuerySearchParams',
    'ChatMessage',
    'ChatSession',
    'StartChatRequest',
    'ChatMessageRequest',
    'ChatMessageResponse',
    'KnowledgeBaseEntry',
    'KnowledgeBaseCreate',
    'KnowledgeBaseUpdate',
    'ConciergeStats',
    'ConciergePerformance',
    'ConciergeFeeback',
]
