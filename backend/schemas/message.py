"""
Messaging schemas for Right at Home BnB
SMS, Email, WhatsApp with sentiment analysis
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from enum import Enum
from .base import BaseSchema, TimestampMixin, IDMixin


class MessageType(str, Enum):
    """Message type/purpose"""
    BOOKING_CONFIRM = "BOOKING_CONFIRM"
    PRE_ARRIVAL = "PRE_ARRIVAL"
    CHECK_IN = "CHECK_IN"
    DURING_STAY = "DURING_STAY"
    CHECK_OUT = "CHECK_OUT"
    POST_STAY = "POST_STAY"
    REVIEW_REQUEST = "REVIEW_REQUEST"
    REMINDER = "REMINDER"
    ALERT = "ALERT"
    MARKETING = "MARKETING"
    CUSTOM = "CUSTOM"


class MessageChannel(str, Enum):
    """Communication channel"""
    EMAIL = "EMAIL"
    SMS = "SMS"
    WHATSAPP = "WHATSAPP"
    APP_NOTIFICATION = "APP_NOTIFICATION"
    VOICE = "VOICE"


class MessageStatus(str, Enum):
    """Message status"""
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    SCHEDULED = "SCHEDULED"
    QUEUED = "QUEUED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"
    BOUNCED = "BOUNCED"


class MessageDirection(str, Enum):
    """Message direction"""
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"


class Sentiment(str, Enum):
    """Message sentiment"""
    VERY_POSITIVE = "VERY_POSITIVE"
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"
    VERY_NEGATIVE = "VERY_NEGATIVE"


class MessagePriority(str, Enum):
    """Message priority"""
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class SentimentAnalysis(BaseModel):
    """Sentiment analysis result"""
    sentiment: Sentiment
    confidence: float = Field(..., ge=0, le=1)
    score: float = Field(..., ge=-1, le=1, description="-1 to 1 scale")
    keywords: List[str] = Field(default_factory=list)
    concerns: List[str] = Field(default_factory=list)
    positive_points: List[str] = Field(default_factory=list)
    suggested_response_tone: Optional[str] = None
    requires_attention: bool = Field(default=False)


class MessageTemplate(BaseModel):
    """Message template"""
    id: str
    name: str
    type: MessageType
    channel: MessageChannel
    subject: Optional[str] = None
    body: str
    variables: List[str] = Field(default_factory=list, description="Template variables like {{guest_name}}")
    is_active: bool = Field(default=True)
    auto_send: bool = Field(default=False, description="Auto-send based on triggers")
    trigger_event: Optional[str] = None


class MessageAttachment(BaseModel):
    """Message attachment"""
    filename: str
    content_type: str
    size: int
    url: str


# ============================================
# CRUD SCHEMAS
# ============================================

class MessageBase(BaseSchema):
    """Base message schema"""
    type: MessageType
    channel: MessageChannel = MessageChannel.EMAIL
    direction: MessageDirection = MessageDirection.OUTBOUND
    priority: MessagePriority = MessagePriority.NORMAL

    subject: Optional[str] = Field(default=None, max_length=500)
    body: str = Field(..., min_length=1, max_length=10000)


class MessageCreate(MessageBase):
    """Schema for creating a new message"""
    guest_id: str
    booking_id: Optional[str] = None
    property_id: Optional[str] = None

    # Recipient override (if not using guest's contact info)
    to_email: Optional[EmailStr] = None
    to_phone: Optional[str] = Field(default=None, pattern=r"^\+?1?\d{10,14}$")

    # Scheduling
    scheduled_for: Optional[datetime] = None
    send_immediately: bool = Field(default=False)

    # Template
    template_id: Optional[str] = None
    template_variables: Optional[Dict[str, str]] = None

    # Attachments
    attachments: Optional[List[str]] = Field(default_factory=list, description="Attachment URLs")

    # Approval
    requires_approval: bool = Field(default=False)


class MessageUpdate(BaseSchema):
    """Schema for updating a message (all fields optional)"""
    subject: Optional[str] = Field(default=None, max_length=500)
    body: Optional[str] = Field(default=None, max_length=10000)
    status: Optional[MessageStatus] = None
    scheduled_for: Optional[datetime] = None
    priority: Optional[MessagePriority] = None


class MessageResponse(MessageBase, IDMixin, TimestampMixin):
    """Full message response schema"""
    guest_id: str
    booking_id: Optional[str] = None
    property_id: Optional[str] = None

    # Recipient
    to_email: Optional[str] = None
    to_phone: Optional[str] = None

    # Guest info
    guest_name: Optional[str] = None

    # Status
    status: MessageStatus = MessageStatus.DRAFT

    # Scheduling/Delivery
    scheduled_for: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None

    # Approval
    requires_approval: bool = Field(default=False)
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

    # Sentiment (for inbound messages)
    sentiment_analysis: Optional[SentimentAnalysis] = None

    # Provider info
    external_id: Optional[str] = Field(default=None, description="Twilio SID, etc.")

    # Attachments
    attachments: List[MessageAttachment] = Field(default_factory=list)

    # Thread
    thread_id: Optional[str] = None
    reply_to_id: Optional[str] = None


class MessageListResponse(BaseSchema):
    """Simplified message for list views"""
    id: str
    guest_id: str
    guest_name: str
    type: MessageType
    channel: MessageChannel
    direction: MessageDirection
    subject: Optional[str] = None
    body_preview: str = Field(..., description="First 100 chars")
    status: MessageStatus
    sentiment: Optional[Sentiment] = None
    created_at: datetime
    sent_at: Optional[datetime] = None


class MessageSearchParams(BaseSchema):
    """Message search/filter parameters"""
    guest_id: Optional[str] = None
    booking_id: Optional[str] = None
    property_id: Optional[str] = None
    type: Optional[MessageType] = None
    channel: Optional[MessageChannel] = None
    direction: Optional[MessageDirection] = None
    status: Optional[MessageStatus] = None
    sentiment: Optional[Sentiment] = None
    priority: Optional[MessagePriority] = None
    requires_attention: Optional[bool] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    q: Optional[str] = Field(default=None, description="Search in subject/body")


# ============================================
# SMS SPECIFIC
# ============================================

class SMSSendRequest(BaseSchema):
    """Request to send SMS"""
    to_phone: str = Field(..., pattern=r"^\+?1?\d{10,14}$")
    body: str = Field(..., min_length=1, max_length=1600)
    guest_id: Optional[str] = None
    booking_id: Optional[str] = None

    # Options
    schedule_for: Optional[datetime] = None
    media_urls: Optional[List[str]] = Field(default_factory=list, description="MMS media")


class SMSReceiveWebhook(BaseSchema):
    """Twilio SMS webhook payload"""
    MessageSid: str
    AccountSid: str
    From: str
    To: str
    Body: str
    NumMedia: int = Field(default=0)
    MediaUrl0: Optional[str] = None


class SMSStatusWebhook(BaseSchema):
    """Twilio SMS status webhook"""
    MessageSid: str
    MessageStatus: str
    ErrorCode: Optional[str] = None
    ErrorMessage: Optional[str] = None


# ============================================
# CONVERSATION/THREAD
# ============================================

class ConversationThread(BaseSchema):
    """Conversation thread with guest"""
    thread_id: str
    guest_id: str
    guest_name: str
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    booking_id: Optional[str] = None

    last_message_at: datetime
    last_message_preview: str
    unread_count: int = Field(default=0)
    total_messages: int

    overall_sentiment: Optional[Sentiment] = None
    requires_attention: bool = Field(default=False)


class ConversationMessages(BaseSchema):
    """Full conversation with messages"""
    thread: ConversationThread
    messages: List[MessageResponse]


# ============================================
# TEMPLATES
# ============================================

class MessageTemplateCreate(BaseSchema):
    """Create message template"""
    name: str = Field(..., min_length=1, max_length=100)
    type: MessageType
    channel: MessageChannel
    subject: Optional[str] = Field(default=None, max_length=500)
    body: str = Field(..., min_length=1, max_length=10000)
    auto_send: bool = Field(default=False)
    trigger_event: Optional[str] = None


class MessageTemplateUpdate(BaseSchema):
    """Update message template"""
    name: Optional[str] = Field(default=None, max_length=100)
    subject: Optional[str] = Field(default=None, max_length=500)
    body: Optional[str] = Field(default=None, max_length=10000)
    is_active: Optional[bool] = None
    auto_send: Optional[bool] = None
    trigger_event: Optional[str] = None


# ============================================
# ANALYTICS
# ============================================

class MessageStats(BaseSchema):
    """Messaging statistics"""
    period_start: datetime
    period_end: datetime

    total_sent: int
    total_received: int

    by_channel: Dict[str, int]
    by_type: Dict[str, int]
    by_status: Dict[str, int]

    delivery_rate: float = Field(..., ge=0, le=1)
    read_rate: float = Field(..., ge=0, le=1)
    response_rate: float = Field(..., ge=0, le=1)

    avg_response_time_hours: Optional[float] = None

    sentiment_breakdown: Dict[str, int] = Field(default_factory=dict)
    messages_requiring_attention: int = Field(default=0)


class BulkMessageRequest(BaseSchema):
    """Send bulk messages"""
    guest_ids: List[str]
    template_id: Optional[str] = None
    type: MessageType
    channel: MessageChannel
    subject: Optional[str] = None
    body: str
    schedule_for: Optional[datetime] = None


class BulkMessageResult(BaseSchema):
    """Result of bulk message operation"""
    total_recipients: int
    sent: int
    failed: int
    errors: List[Dict[str, str]] = Field(default_factory=list)


# Export all
__all__ = [
    'MessageType',
    'MessageChannel',
    'MessageStatus',
    'MessageDirection',
    'Sentiment',
    'MessagePriority',
    'SentimentAnalysis',
    'MessageTemplate',
    'MessageAttachment',
    'MessageBase',
    'MessageCreate',
    'MessageUpdate',
    'MessageResponse',
    'MessageListResponse',
    'MessageSearchParams',
    'SMSSendRequest',
    'SMSReceiveWebhook',
    'SMSStatusWebhook',
    'ConversationThread',
    'ConversationMessages',
    'MessageTemplateCreate',
    'MessageTemplateUpdate',
    'MessageStats',
    'BulkMessageRequest',
    'BulkMessageResult',
]
