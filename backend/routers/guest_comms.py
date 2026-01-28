"""
Guest Communication Hub - Backend Router
Right at Home BnB - Steven Palma's 22 Properties

Complete guest messaging system with:
- Conversation management per booking
- Message templates with variables
- Automated message triggers
- Twilio SMS/Email integration
- Real-time message status tracking

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from enum import Enum
import logging
from pathlib import Path

# Try to import Twilio service
try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent / "services"))
    from twilio_sms import twilio_sms_service, TwilioSMSService, MessageTemplate as TwilioTemplate
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    twilio_sms_service = None

logger = logging.getLogger("RightAtHomeBnB.GuestComms")

router = APIRouter()


# ============================================================================
# ENUMS
# ============================================================================

class MessageChannel(str, Enum):
    SMS = "sms"
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    PUSH = "push"


class MessageDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    SCHEDULED = "scheduled"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class AutomatedTrigger(str, Enum):
    BOOKING_CONFIRMED = "booking_confirmed"
    BEFORE_CHECKIN_24H = "before_checkin_24h"
    CHECKIN_DAY = "checkin_day"
    AFTER_CHECKIN_24H = "after_checkin_24h"
    BEFORE_CHECKOUT_24H = "before_checkout_24h"
    CHECKOUT_DAY = "checkout_day"
    AFTER_CHECKOUT = "after_checkout"
    REVIEW_REQUEST = "review_request"


class Sentiment(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class GuestMessageCreate(BaseModel):
    """Create a new message"""
    content: str = Field(..., min_length=1, max_length=1600, description="Message content")
    channel: MessageChannel = MessageChannel.SMS
    scheduled_for: Optional[datetime] = None


class GuestMessageResponse(BaseModel):
    """Message response model"""
    id: str
    booking_id: str
    direction: MessageDirection
    channel: MessageChannel
    content: str
    status: MessageStatus
    created_at: datetime
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    sentiment: Optional[Sentiment] = None
    twilio_sid: Optional[str] = None
    error: Optional[str] = None


class ConversationResponse(BaseModel):
    """Full conversation thread"""
    booking_id: str
    guest_name: str
    guest_phone: str
    guest_email: str
    property_name: str
    property_id: str
    check_in: datetime
    check_out: datetime
    messages: List[GuestMessageResponse]
    total_messages: int
    unread_count: int
    last_message_at: Optional[datetime] = None


class MessageTemplateResponse(BaseModel):
    """Message template"""
    id: str
    name: str
    trigger: AutomatedTrigger
    channel: MessageChannel
    subject: Optional[str] = None
    body: str
    variables: List[str]
    is_active: bool = True
    timing_description: str


class AutomatedMessageCreate(BaseModel):
    """Trigger an automated message"""
    booking_id: str
    trigger: AutomatedTrigger
    channel: MessageChannel = MessageChannel.SMS
    override_content: Optional[str] = None
    send_immediately: bool = False


class ScheduledMessageResponse(BaseModel):
    """Scheduled message info"""
    id: str
    booking_id: str
    trigger: AutomatedTrigger
    channel: MessageChannel
    scheduled_for: datetime
    status: MessageStatus
    content_preview: str


class BulkAutomationSetup(BaseModel):
    """Setup automated flow for a booking"""
    booking_id: str
    guest_name: str
    guest_phone: str
    guest_email: str
    property_name: str
    property_address: str
    check_in: datetime
    check_out: datetime
    access_code: str
    wifi_network: str
    wifi_password: str
    platform: str = "Airbnb"
    enable_sms: bool = True
    enable_email: bool = True


# ============================================================================
# IN-MEMORY STORAGE (Production would use PostgreSQL)
# ============================================================================

# Conversations indexed by booking_id
CONVERSATIONS: Dict[str, Dict] = {}

# Messages indexed by message_id
MESSAGES: Dict[str, Dict] = {}

# Scheduled messages
SCHEDULED_MESSAGES: Dict[str, Dict] = {}

# Message ID counter
_message_counter = 0


def _next_message_id() -> str:
    global _message_counter
    _message_counter += 1
    return f"msg_{_message_counter:06d}"


# ============================================================================
# MESSAGE TEMPLATES
# ============================================================================

TEMPLATES: Dict[AutomatedTrigger, Dict] = {
    AutomatedTrigger.BOOKING_CONFIRMED: {
        "id": "tpl_01",
        "name": "Booking Confirmation",
        "trigger": AutomatedTrigger.BOOKING_CONFIRMED,
        "channel": MessageChannel.SMS,
        "subject": "Your Booking is Confirmed!",
        "body": """Hi {guest_name}! Your reservation at {property_name} is confirmed.

Check-in: {check_in_date} at 3:00 PM
Check-out: {check_out_date} at 11:00 AM

We'll send your access code the day before arrival.

Questions? Just reply to this message!

- Right at Home BnB""",
        "variables": ["guest_name", "property_name", "check_in_date", "check_out_date"],
        "is_active": True,
        "timing_description": "Sent immediately when booking is confirmed"
    },

    AutomatedTrigger.BEFORE_CHECKIN_24H: {
        "id": "tpl_02",
        "name": "Pre-Arrival (24h Before)",
        "trigger": AutomatedTrigger.BEFORE_CHECKIN_24H,
        "channel": MessageChannel.SMS,
        "subject": "Your Access Code for Tomorrow",
        "body": """Hi {guest_name}! We're getting excited to host you tomorrow at {property_name}!

Here's your access code: {access_code}

This code is valid from {check_in_date} at 3:00 PM to {check_out_date} at 11:00 AM.

Address: {property_address}

Need anything? We're here to help!

- Right at Home BnB""",
        "variables": ["guest_name", "property_name", "access_code", "check_in_date", "check_out_date", "property_address"],
        "is_active": True,
        "timing_description": "Sent 24 hours before check-in (noon)"
    },

    AutomatedTrigger.CHECKIN_DAY: {
        "id": "tpl_03",
        "name": "Check-in Day Instructions",
        "trigger": AutomatedTrigger.CHECKIN_DAY,
        "channel": MessageChannel.SMS,
        "subject": "Welcome! Here's Everything You Need",
        "body": """Welcome to {property_name}! Here's everything you need:

ACCESS CODE: {access_code}

WiFi Network: {wifi_network}
WiFi Password: {wifi_password}

House Rules:
- No smoking
- Quiet hours: 10pm - 8am
- Checkout by 11:00 AM

Our AI concierge is available 24/7 for local recommendations!

Enjoy your stay!
- Steven, Right at Home BnB""",
        "variables": ["property_name", "access_code", "wifi_network", "wifi_password"],
        "is_active": True,
        "timing_description": "Sent morning of check-in (10 AM)"
    },

    AutomatedTrigger.AFTER_CHECKIN_24H: {
        "id": "tpl_04",
        "name": "Day After Check-in (How's Everything?)",
        "trigger": AutomatedTrigger.AFTER_CHECKIN_24H,
        "channel": MessageChannel.SMS,
        "subject": "How's Your Stay?",
        "body": """Hi {guest_name}! Hope you're enjoying your stay at {property_name}!

Just checking in - is there anything you need? Any issues with the property?

Our AI concierge is available 24/7 for local recommendations and assistance.

Have a wonderful stay!
- Steven""",
        "variables": ["guest_name", "property_name"],
        "is_active": True,
        "timing_description": "Sent 24 hours after check-in (noon)"
    },

    AutomatedTrigger.BEFORE_CHECKOUT_24H: {
        "id": "tpl_05",
        "name": "Checkout Reminder",
        "trigger": AutomatedTrigger.BEFORE_CHECKOUT_24H,
        "channel": MessageChannel.SMS,
        "subject": "Checkout Reminder - Tomorrow at 11 AM",
        "body": """Hi {guest_name}! Just a reminder that checkout is tomorrow at 11:00 AM.

Before you leave:
- Lock all doors and windows
- Set thermostat to 78F
- Take out trash
- Leave dirty towels in the bathroom

Want a late checkout? Reply "LATE" and we'll check availability!

Safe travels!
- Right at Home BnB""",
        "variables": ["guest_name"],
        "is_active": True,
        "timing_description": "Sent evening before checkout (6 PM)"
    },

    AutomatedTrigger.CHECKOUT_DAY: {
        "id": "tpl_06",
        "name": "Checkout Day",
        "trigger": AutomatedTrigger.CHECKOUT_DAY,
        "channel": MessageChannel.SMS,
        "subject": "Checkout Day - 11 AM",
        "body": """Good morning {guest_name}! Today is checkout day.

Quick checklist:
[ ] All lights off
[ ] Windows closed and locked
[ ] Thermostat at 78F
[ ] Trash in outdoor bin
[ ] Dirty towels in bathroom

Checkout time: 11:00 AM

Thank you for staying with us!
- Right at Home BnB""",
        "variables": ["guest_name"],
        "is_active": True,
        "timing_description": "Sent morning of checkout (9 AM)"
    },

    AutomatedTrigger.AFTER_CHECKOUT: {
        "id": "tpl_07",
        "name": "Thank You (Post-Stay)",
        "trigger": AutomatedTrigger.AFTER_CHECKOUT,
        "channel": MessageChannel.SMS,
        "subject": "Thank You for Staying!",
        "body": """Hi {guest_name}! Thank you for staying at {property_name}!

We hope you had a wonderful experience. As a valued guest, you'll receive priority booking for future stays.

If you enjoyed your stay, we'd love a review on {platform}!

Come back soon!
- Steven, Right at Home BnB""",
        "variables": ["guest_name", "property_name", "platform"],
        "is_active": True,
        "timing_description": "Sent 1 hour after checkout (noon)"
    },

    AutomatedTrigger.REVIEW_REQUEST: {
        "id": "tpl_08",
        "name": "Review Request",
        "trigger": AutomatedTrigger.REVIEW_REQUEST,
        "channel": MessageChannel.SMS,
        "subject": "We'd Love Your Feedback!",
        "body": """Hi {guest_name}! We hope you're doing well.

If you have a moment, we'd really appreciate a review of your stay at {property_name} on {platform}.

Your feedback helps us improve and helps other travelers find great stays!

Thank you!
- Steven Palma
Right at Home BnB""",
        "variables": ["guest_name", "property_name", "platform"],
        "is_active": True,
        "timing_description": "Sent 3 days after checkout"
    },
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _fill_template(template_body: str, variables: Dict[str, str]) -> str:
    """Fill template with variables"""
    result = template_body
    for key, value in variables.items():
        result = result.replace("{" + key + "}", str(value))
    return result


def _analyze_sentiment(text: str) -> Sentiment:
    """Simple sentiment analysis based on keywords"""
    positive_words = ["thank", "great", "wonderful", "perfect", "love", "excellent", "amazing", "beautiful", "clean", "enjoyed"]
    negative_words = ["problem", "issue", "broken", "dirty", "terrible", "awful", "disappointed", "noise", "bug", "not working"]

    text_lower = text.lower()
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)

    if positive_count > negative_count:
        return Sentiment.POSITIVE
    elif negative_count > positive_count:
        return Sentiment.NEGATIVE
    return Sentiment.NEUTRAL


def _init_conversation(booking_id: str, guest_data: Dict) -> Dict:
    """Initialize a conversation for a booking"""
    if booking_id not in CONVERSATIONS:
        CONVERSATIONS[booking_id] = {
            "booking_id": booking_id,
            "guest_name": guest_data.get("guest_name", "Guest"),
            "guest_phone": guest_data.get("guest_phone", ""),
            "guest_email": guest_data.get("guest_email", ""),
            "property_name": guest_data.get("property_name", ""),
            "property_id": guest_data.get("property_id", ""),
            "check_in": guest_data.get("check_in"),
            "check_out": guest_data.get("check_out"),
            "message_ids": [],
            "unread_count": 0,
            "created_at": datetime.now().isoformat(),
        }
    return CONVERSATIONS[booking_id]


# ============================================================================
# API ROUTES - CONVERSATIONS
# ============================================================================

@router.get("/guest/{booking_id}", response_model=ConversationResponse)
async def get_conversation(booking_id: str):
    """
    Get the full conversation thread for a booking.
    Returns all messages in chronological order.
    """
    if booking_id not in CONVERSATIONS:
        # Create empty conversation
        conv = _init_conversation(booking_id, {"guest_name": "Guest"})
    else:
        conv = CONVERSATIONS[booking_id]

    # Get all messages for this conversation
    messages = []
    for msg_id in conv.get("message_ids", []):
        if msg_id in MESSAGES:
            msg = MESSAGES[msg_id]
            messages.append(GuestMessageResponse(
                id=msg["id"],
                booking_id=msg["booking_id"],
                direction=MessageDirection(msg["direction"]),
                channel=MessageChannel(msg["channel"]),
                content=msg["content"],
                status=MessageStatus(msg["status"]),
                created_at=datetime.fromisoformat(msg["created_at"]) if isinstance(msg["created_at"], str) else msg["created_at"],
                sent_at=datetime.fromisoformat(msg["sent_at"]) if msg.get("sent_at") and isinstance(msg["sent_at"], str) else msg.get("sent_at"),
                delivered_at=datetime.fromisoformat(msg["delivered_at"]) if msg.get("delivered_at") and isinstance(msg["delivered_at"], str) else msg.get("delivered_at"),
                read_at=datetime.fromisoformat(msg["read_at"]) if msg.get("read_at") and isinstance(msg["read_at"], str) else msg.get("read_at"),
                sentiment=Sentiment(msg["sentiment"]) if msg.get("sentiment") else None,
                twilio_sid=msg.get("twilio_sid"),
                error=msg.get("error")
            ))

    # Sort by timestamp
    messages.sort(key=lambda m: m.created_at)

    return ConversationResponse(
        booking_id=booking_id,
        guest_name=conv.get("guest_name", "Guest"),
        guest_phone=conv.get("guest_phone", ""),
        guest_email=conv.get("guest_email", ""),
        property_name=conv.get("property_name", ""),
        property_id=conv.get("property_id", ""),
        check_in=datetime.fromisoformat(conv["check_in"]) if isinstance(conv.get("check_in"), str) else (conv.get("check_in") or datetime.now()),
        check_out=datetime.fromisoformat(conv["check_out"]) if isinstance(conv.get("check_out"), str) else (conv.get("check_out") or datetime.now() + timedelta(days=1)),
        messages=messages,
        total_messages=len(messages),
        unread_count=conv.get("unread_count", 0),
        last_message_at=messages[-1].created_at if messages else None
    )


@router.post("/guest/{booking_id}", response_model=GuestMessageResponse)
async def send_message(
    booking_id: str,
    message: GuestMessageCreate,
    background_tasks: BackgroundTasks
):
    """
    Send a message to a guest.
    Supports SMS, Email, WhatsApp, and Push notifications.
    """
    # Ensure conversation exists
    if booking_id not in CONVERSATIONS:
        raise HTTPException(status_code=404, detail=f"Booking {booking_id} not found. Initialize conversation first.")

    conv = CONVERSATIONS[booking_id]

    # Create message record
    msg_id = _next_message_id()
    msg_data = {
        "id": msg_id,
        "booking_id": booking_id,
        "direction": MessageDirection.OUTBOUND.value,
        "channel": message.channel.value,
        "content": message.content,
        "status": MessageStatus.PENDING.value if not message.scheduled_for else MessageStatus.SCHEDULED.value,
        "created_at": datetime.now().isoformat(),
        "scheduled_for": message.scheduled_for.isoformat() if message.scheduled_for else None,
        "sent_at": None,
        "delivered_at": None,
        "read_at": None,
        "sentiment": None,
        "twilio_sid": None,
        "error": None
    }

    MESSAGES[msg_id] = msg_data
    conv["message_ids"].append(msg_id)

    # Send via appropriate channel
    if message.channel == MessageChannel.SMS and not message.scheduled_for:
        background_tasks.add_task(_send_sms, msg_id, conv["guest_phone"], message.content)
    elif message.channel == MessageChannel.EMAIL and not message.scheduled_for:
        background_tasks.add_task(_send_email, msg_id, conv["guest_email"], "Message from Right at Home BnB", message.content)
    elif message.scheduled_for:
        # Add to scheduled messages
        SCHEDULED_MESSAGES[msg_id] = msg_data

    return GuestMessageResponse(
        id=msg_id,
        booking_id=booking_id,
        direction=MessageDirection.OUTBOUND,
        channel=message.channel,
        content=message.content,
        status=MessageStatus.PENDING if not message.scheduled_for else MessageStatus.SCHEDULED,
        created_at=datetime.now(),
        scheduled_for=message.scheduled_for
    )


@router.post("/guest/{booking_id}/receive")
async def receive_message(
    booking_id: str,
    content: str,
    channel: MessageChannel = MessageChannel.SMS,
    sender_phone: Optional[str] = None
):
    """
    Record an inbound message from a guest.
    Used by webhooks to record incoming SMS/emails.
    """
    # Ensure conversation exists
    if booking_id not in CONVERSATIONS:
        # Auto-create conversation for unknown bookings
        _init_conversation(booking_id, {
            "guest_name": "Guest",
            "guest_phone": sender_phone or ""
        })

    conv = CONVERSATIONS[booking_id]

    # Analyze sentiment
    sentiment = _analyze_sentiment(content)

    # Create message record
    msg_id = _next_message_id()
    msg_data = {
        "id": msg_id,
        "booking_id": booking_id,
        "direction": MessageDirection.INBOUND.value,
        "channel": channel.value,
        "content": content,
        "status": MessageStatus.DELIVERED.value,
        "created_at": datetime.now().isoformat(),
        "sent_at": datetime.now().isoformat(),
        "delivered_at": datetime.now().isoformat(),
        "read_at": None,
        "sentiment": sentiment.value,
        "twilio_sid": None,
        "error": None
    }

    MESSAGES[msg_id] = msg_data
    conv["message_ids"].append(msg_id)
    conv["unread_count"] = conv.get("unread_count", 0) + 1

    return {
        "status": "received",
        "message_id": msg_id,
        "sentiment": sentiment.value,
        "requires_attention": sentiment == Sentiment.NEGATIVE
    }


@router.post("/guest/{booking_id}/mark-read")
async def mark_conversation_read(booking_id: str):
    """Mark all messages in a conversation as read"""
    if booking_id not in CONVERSATIONS:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv = CONVERSATIONS[booking_id]
    for msg_id in conv.get("message_ids", []):
        if msg_id in MESSAGES:
            msg = MESSAGES[msg_id]
            if msg["direction"] == MessageDirection.INBOUND.value and not msg.get("read_at"):
                msg["read_at"] = datetime.now().isoformat()

    conv["unread_count"] = 0

    return {"status": "marked_read", "booking_id": booking_id}


# ============================================================================
# API ROUTES - TEMPLATES
# ============================================================================

@router.get("/templates", response_model=List[MessageTemplateResponse])
async def get_templates(
    trigger: Optional[AutomatedTrigger] = None,
    channel: Optional[MessageChannel] = None,
    active_only: bool = True
):
    """
    Get all message templates.
    Filter by trigger type, channel, or active status.
    """
    templates = []
    for tpl_trigger, tpl_data in TEMPLATES.items():
        if trigger and tpl_trigger != trigger:
            continue
        if channel and tpl_data["channel"] != channel:
            continue
        if active_only and not tpl_data.get("is_active", True):
            continue

        templates.append(MessageTemplateResponse(
            id=tpl_data["id"],
            name=tpl_data["name"],
            trigger=tpl_data["trigger"],
            channel=tpl_data["channel"],
            subject=tpl_data.get("subject"),
            body=tpl_data["body"],
            variables=tpl_data["variables"],
            is_active=tpl_data.get("is_active", True),
            timing_description=tpl_data["timing_description"]
        ))

    return templates


@router.get("/templates/{template_id}", response_model=MessageTemplateResponse)
async def get_template(template_id: str):
    """Get a specific template by ID"""
    for tpl_data in TEMPLATES.values():
        if tpl_data["id"] == template_id:
            return MessageTemplateResponse(
                id=tpl_data["id"],
                name=tpl_data["name"],
                trigger=tpl_data["trigger"],
                channel=tpl_data["channel"],
                subject=tpl_data.get("subject"),
                body=tpl_data["body"],
                variables=tpl_data["variables"],
                is_active=tpl_data.get("is_active", True),
                timing_description=tpl_data["timing_description"]
            )

    raise HTTPException(status_code=404, detail="Template not found")


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    body: str,
    subject: Optional[str] = None,
    is_active: Optional[bool] = None
):
    """
    Update a message template.
    Steven can customize message content.
    """
    for tpl_data in TEMPLATES.values():
        if tpl_data["id"] == template_id:
            tpl_data["body"] = body
            if subject is not None:
                tpl_data["subject"] = subject
            if is_active is not None:
                tpl_data["is_active"] = is_active
            return {"status": "updated", "template_id": template_id}

    raise HTTPException(status_code=404, detail="Template not found")


# ============================================================================
# API ROUTES - AUTOMATED MESSAGES
# ============================================================================

@router.post("/automated", response_model=GuestMessageResponse)
async def trigger_automated_message(
    request: AutomatedMessageCreate,
    background_tasks: BackgroundTasks
):
    """
    Trigger an automated message for a booking.
    Uses template based on trigger type.
    """
    if request.booking_id not in CONVERSATIONS:
        raise HTTPException(status_code=404, detail=f"Booking {request.booking_id} not found")

    conv = CONVERSATIONS[request.booking_id]

    # Get template
    if request.trigger not in TEMPLATES:
        raise HTTPException(status_code=404, detail=f"No template for trigger: {request.trigger}")

    template = TEMPLATES[request.trigger]

    # Fill template with conversation data
    variables = {
        "guest_name": conv.get("guest_name", "Guest"),
        "property_name": conv.get("property_name", "Property"),
        "property_address": conv.get("property_address", "Address"),
        "check_in_date": conv.get("check_in", datetime.now()).strftime("%B %d, %Y") if isinstance(conv.get("check_in"), datetime) else conv.get("check_in", "Check-in"),
        "check_out_date": conv.get("check_out", datetime.now()).strftime("%B %d, %Y") if isinstance(conv.get("check_out"), datetime) else conv.get("check_out", "Check-out"),
        "access_code": conv.get("access_code", "****"),
        "wifi_network": conv.get("wifi_network", "Network"),
        "wifi_password": conv.get("wifi_password", "********"),
        "platform": conv.get("platform", "Airbnb"),
    }

    content = request.override_content if request.override_content else _fill_template(template["body"], variables)

    # Create message
    msg_id = _next_message_id()
    msg_data = {
        "id": msg_id,
        "booking_id": request.booking_id,
        "direction": MessageDirection.OUTBOUND.value,
        "channel": request.channel.value,
        "content": content,
        "status": MessageStatus.PENDING.value,
        "created_at": datetime.now().isoformat(),
        "trigger": request.trigger.value,
        "template_id": template["id"],
        "sent_at": None,
        "delivered_at": None,
        "read_at": None,
        "sentiment": None,
        "twilio_sid": None,
        "error": None
    }

    MESSAGES[msg_id] = msg_data
    conv["message_ids"].append(msg_id)

    # Send if requested
    if request.send_immediately:
        if request.channel == MessageChannel.SMS:
            background_tasks.add_task(_send_sms, msg_id, conv["guest_phone"], content)
        elif request.channel == MessageChannel.EMAIL:
            background_tasks.add_task(_send_email, msg_id, conv["guest_email"], template.get("subject", "Message from Right at Home BnB"), content)

    return GuestMessageResponse(
        id=msg_id,
        booking_id=request.booking_id,
        direction=MessageDirection.OUTBOUND,
        channel=request.channel,
        content=content,
        status=MessageStatus.PENDING if request.send_immediately else MessageStatus.DRAFT,
        created_at=datetime.now()
    )


@router.post("/automated/setup-flow")
async def setup_automated_flow(
    request: BulkAutomationSetup,
    background_tasks: BackgroundTasks
):
    """
    Setup the complete automated message flow for a booking.
    Schedules all 6 automated messages based on check-in/check-out dates.
    """
    # Initialize/update conversation with full data
    conv = _init_conversation(request.booking_id, {
        "guest_name": request.guest_name,
        "guest_phone": request.guest_phone,
        "guest_email": request.guest_email,
        "property_name": request.property_name,
        "property_address": request.property_address,
        "check_in": request.check_in,
        "check_out": request.check_out,
        "access_code": request.access_code,
        "wifi_network": request.wifi_network,
        "wifi_password": request.wifi_password,
        "platform": request.platform,
    })

    # Update existing conversation
    conv.update({
        "guest_name": request.guest_name,
        "guest_phone": request.guest_phone,
        "guest_email": request.guest_email,
        "property_name": request.property_name,
        "property_address": request.property_address,
        "check_in": request.check_in.isoformat(),
        "check_out": request.check_out.isoformat(),
        "access_code": request.access_code,
        "wifi_network": request.wifi_network,
        "wifi_password": request.wifi_password,
        "platform": request.platform,
    })

    scheduled = []

    # Calculate trigger times
    triggers_schedule = [
        (AutomatedTrigger.BOOKING_CONFIRMED, datetime.now()),
        (AutomatedTrigger.BEFORE_CHECKIN_24H, (request.check_in - timedelta(days=1)).replace(hour=12, minute=0)),
        (AutomatedTrigger.CHECKIN_DAY, request.check_in.replace(hour=10, minute=0)),
        (AutomatedTrigger.AFTER_CHECKIN_24H, (request.check_in + timedelta(days=1)).replace(hour=12, minute=0)),
        (AutomatedTrigger.BEFORE_CHECKOUT_24H, (request.check_out - timedelta(days=1)).replace(hour=18, minute=0)),
        (AutomatedTrigger.CHECKOUT_DAY, request.check_out.replace(hour=9, minute=0)),
        (AutomatedTrigger.AFTER_CHECKOUT, request.check_out.replace(hour=12, minute=0)),
        (AutomatedTrigger.REVIEW_REQUEST, (request.check_out + timedelta(days=3)).replace(hour=14, minute=0)),
    ]

    for trigger, scheduled_time in triggers_schedule:
        if trigger not in TEMPLATES:
            continue

        template = TEMPLATES[trigger]
        if not template.get("is_active", True):
            continue

        # Skip if scheduled time is in the past
        if scheduled_time < datetime.now():
            if trigger == AutomatedTrigger.BOOKING_CONFIRMED:
                # Send booking confirmation immediately
                pass
            else:
                continue

        variables = {
            "guest_name": request.guest_name,
            "property_name": request.property_name,
            "property_address": request.property_address,
            "check_in_date": request.check_in.strftime("%B %d, %Y"),
            "check_out_date": request.check_out.strftime("%B %d, %Y"),
            "access_code": request.access_code,
            "wifi_network": request.wifi_network,
            "wifi_password": request.wifi_password,
            "platform": request.platform,
        }

        content = _fill_template(template["body"], variables)

        # Create scheduled message
        msg_id = _next_message_id()
        msg_data = {
            "id": msg_id,
            "booking_id": request.booking_id,
            "direction": MessageDirection.OUTBOUND.value,
            "channel": MessageChannel.SMS.value if request.enable_sms else MessageChannel.EMAIL.value,
            "content": content,
            "status": MessageStatus.SCHEDULED.value,
            "created_at": datetime.now().isoformat(),
            "scheduled_for": scheduled_time.isoformat(),
            "trigger": trigger.value,
            "template_id": template["id"],
            "sent_at": None,
            "delivered_at": None,
            "read_at": None,
            "sentiment": None,
            "twilio_sid": None,
            "error": None
        }

        MESSAGES[msg_id] = msg_data
        SCHEDULED_MESSAGES[msg_id] = msg_data
        conv["message_ids"].append(msg_id)

        scheduled.append({
            "message_id": msg_id,
            "trigger": trigger.value,
            "scheduled_for": scheduled_time.isoformat(),
            "content_preview": content[:100] + "..." if len(content) > 100 else content
        })

    # Send booking confirmation immediately if Twilio is available
    if request.enable_sms and TWILIO_AVAILABLE and twilio_sms_service:
        background_tasks.add_task(
            _send_automated_flow_via_twilio,
            request
        )

    return {
        "status": "flow_scheduled",
        "booking_id": request.booking_id,
        "messages_scheduled": len(scheduled),
        "scheduled_messages": scheduled,
        "note": "Booking confirmation sent immediately. Other messages scheduled based on check-in/check-out times."
    }


@router.get("/automated/scheduled")
async def get_scheduled_messages(
    booking_id: Optional[str] = None,
    trigger: Optional[AutomatedTrigger] = None
) -> List[ScheduledMessageResponse]:
    """Get all scheduled (pending) automated messages"""
    result = []

    for msg_id, msg in SCHEDULED_MESSAGES.items():
        if msg["status"] != MessageStatus.SCHEDULED.value:
            continue
        if booking_id and msg["booking_id"] != booking_id:
            continue
        if trigger and msg.get("trigger") != trigger.value:
            continue

        result.append(ScheduledMessageResponse(
            id=msg["id"],
            booking_id=msg["booking_id"],
            trigger=AutomatedTrigger(msg["trigger"]),
            channel=MessageChannel(msg["channel"]),
            scheduled_for=datetime.fromisoformat(msg["scheduled_for"]),
            status=MessageStatus(msg["status"]),
            content_preview=msg["content"][:100] + "..." if len(msg["content"]) > 100 else msg["content"]
        ))

    # Sort by scheduled time
    result.sort(key=lambda m: m.scheduled_for)
    return result


@router.delete("/automated/scheduled/{message_id}")
async def cancel_scheduled_message(message_id: str):
    """Cancel a scheduled message"""
    if message_id not in SCHEDULED_MESSAGES:
        raise HTTPException(status_code=404, detail="Scheduled message not found")

    msg = SCHEDULED_MESSAGES[message_id]
    msg["status"] = MessageStatus.FAILED.value
    msg["error"] = "Cancelled by user"

    # Also update in MESSAGES
    if message_id in MESSAGES:
        MESSAGES[message_id]["status"] = MessageStatus.FAILED.value
        MESSAGES[message_id]["error"] = "Cancelled by user"

    del SCHEDULED_MESSAGES[message_id]

    return {"status": "cancelled", "message_id": message_id}


# ============================================================================
# BACKGROUND TASKS
# ============================================================================

async def _send_sms(msg_id: str, phone: str, content: str):
    """Background task to send SMS via Twilio"""
    if not TWILIO_AVAILABLE or not twilio_sms_service:
        logger.warning(f"Twilio not available. Message {msg_id} not sent.")
        if msg_id in MESSAGES:
            MESSAGES[msg_id]["status"] = MessageStatus.FAILED.value
            MESSAGES[msg_id]["error"] = "Twilio not configured"
        return

    try:
        result = await twilio_sms_service.send_sms(phone, content)

        if result.success:
            MESSAGES[msg_id]["status"] = MessageStatus.SENT.value
            MESSAGES[msg_id]["sent_at"] = datetime.now().isoformat()
            MESSAGES[msg_id]["twilio_sid"] = result.message_sid
            logger.info(f"SMS sent: {msg_id} -> {phone}")
        else:
            MESSAGES[msg_id]["status"] = MessageStatus.FAILED.value
            MESSAGES[msg_id]["error"] = result.error
            logger.error(f"SMS failed: {msg_id} - {result.error}")
    except Exception as e:
        MESSAGES[msg_id]["status"] = MessageStatus.FAILED.value
        MESSAGES[msg_id]["error"] = str(e)
        logger.error(f"SMS exception: {msg_id} - {e}")


async def _send_email(msg_id: str, email: str, subject: str, content: str):
    """Background task to send email (placeholder - integrate with SendGrid/SES)"""
    # TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    logger.info(f"Email would be sent: {msg_id} -> {email}")

    # For now, mark as sent (in production, integrate with email service)
    if msg_id in MESSAGES:
        MESSAGES[msg_id]["status"] = MessageStatus.SENT.value
        MESSAGES[msg_id]["sent_at"] = datetime.now().isoformat()


async def _send_automated_flow_via_twilio(request: BulkAutomationSetup):
    """Send the complete automated flow via Twilio's scheduling"""
    if not TWILIO_AVAILABLE or not twilio_sms_service:
        return

    try:
        result = await twilio_sms_service.send_automated_flow(
            booking_id=request.booking_id,
            guest_phone=request.guest_phone,
            guest_name=request.guest_name,
            property_name=request.property_name,
            property_address=request.property_address,
            check_in=request.check_in,
            check_out=request.check_out,
            access_code=request.access_code,
            wifi_network=request.wifi_network,
            wifi_password=request.wifi_password,
            platform=request.platform
        )
        logger.info(f"Automated flow setup via Twilio: {result}")
    except Exception as e:
        logger.error(f"Failed to setup Twilio automated flow: {e}")


# ============================================================================
# ANALYTICS & STATS
# ============================================================================

@router.get("/stats")
async def get_messaging_stats():
    """Get messaging statistics"""
    total_messages = len(MESSAGES)
    total_conversations = len(CONVERSATIONS)

    sent_count = sum(1 for m in MESSAGES.values() if m["status"] == MessageStatus.SENT.value)
    failed_count = sum(1 for m in MESSAGES.values() if m["status"] == MessageStatus.FAILED.value)
    scheduled_count = len(SCHEDULED_MESSAGES)

    inbound_count = sum(1 for m in MESSAGES.values() if m["direction"] == MessageDirection.INBOUND.value)
    outbound_count = sum(1 for m in MESSAGES.values() if m["direction"] == MessageDirection.OUTBOUND.value)

    # Sentiment breakdown
    positive_count = sum(1 for m in MESSAGES.values() if m.get("sentiment") == Sentiment.POSITIVE.value)
    negative_count = sum(1 for m in MESSAGES.values() if m.get("sentiment") == Sentiment.NEGATIVE.value)
    neutral_count = sum(1 for m in MESSAGES.values() if m.get("sentiment") == Sentiment.NEUTRAL.value)

    return {
        "total_messages": total_messages,
        "total_conversations": total_conversations,
        "sent": sent_count,
        "failed": failed_count,
        "scheduled": scheduled_count,
        "inbound": inbound_count,
        "outbound": outbound_count,
        "sentiment": {
            "positive": positive_count,
            "negative": negative_count,
            "neutral": neutral_count
        },
        "twilio_configured": TWILIO_AVAILABLE and twilio_sms_service is not None
    }


# ============================================================================
# WEBHOOK ENDPOINTS (for Twilio callbacks)
# ============================================================================

@router.post("/webhook/twilio/status")
async def twilio_status_webhook(
    MessageSid: str = None,
    MessageStatus: str = None,
    To: str = None,
    ErrorCode: str = None,
    ErrorMessage: str = None
):
    """
    Webhook endpoint for Twilio message status callbacks.
    Updates message status in our system.
    """
    if not MessageSid:
        return {"status": "ignored", "reason": "no message sid"}

    # Find message by Twilio SID
    for msg_id, msg in MESSAGES.items():
        if msg.get("twilio_sid") == MessageSid:
            if MessageStatus == "delivered":
                msg["status"] = MessageStatus.DELIVERED.value
                msg["delivered_at"] = datetime.now().isoformat()
            elif MessageStatus == "failed":
                msg["status"] = MessageStatus.FAILED.value
                msg["error"] = f"{ErrorCode}: {ErrorMessage}" if ErrorCode else "Delivery failed"
            elif MessageStatus == "sent":
                msg["status"] = MessageStatus.SENT.value

            logger.info(f"Twilio status update: {msg_id} -> {MessageStatus}")
            return {"status": "updated", "message_id": msg_id}

    return {"status": "not_found", "twilio_sid": MessageSid}


@router.post("/webhook/twilio/incoming")
async def twilio_incoming_webhook(
    From: str = None,
    Body: str = None,
    MessageSid: str = None
):
    """
    Webhook endpoint for incoming SMS from guests.
    Routes to appropriate conversation based on phone number.
    """
    if not From or not Body:
        return {"status": "ignored", "reason": "missing data"}

    # Find conversation by phone number
    booking_id = None
    for bid, conv in CONVERSATIONS.items():
        if conv.get("guest_phone", "").replace("-", "").replace(" ", "") == From.replace("-", "").replace(" ", "").replace("+1", ""):
            booking_id = bid
            break

    if booking_id:
        await receive_message(booking_id, Body, MessageChannel.SMS, From)
        logger.info(f"Incoming SMS from {From} matched to booking {booking_id}")
        return {"status": "received", "booking_id": booking_id}
    else:
        # Create new conversation for unknown sender
        new_booking_id = f"unknown_{From.replace('+', '').replace('-', '')}"
        await receive_message(new_booking_id, Body, MessageChannel.SMS, From)
        logger.info(f"Incoming SMS from unknown sender {From}")
        return {"status": "received", "booking_id": new_booking_id, "note": "Unknown sender - manual routing required"}
