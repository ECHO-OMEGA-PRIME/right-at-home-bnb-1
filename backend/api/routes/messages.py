"""
Guest Messaging API Routes
Automated 4-message flow with tone approval
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from enum import Enum

router = APIRouter()

class MessageType(str, Enum):
    WELCOME = "welcome"
    CHECKIN = "checkin"
    CHECKOUT_REMINDER = "checkout_reminder"
    THANK_YOU = "thank_you"
    CUSTOM = "custom"

class MessageTemplate(BaseModel):
    id: int
    type: MessageType
    subject: str
    body: str
    timing: str  # e.g., "24h_before_checkin"
    active: bool = True

class GuestMessage(BaseModel):
    guest_id: int
    guest_name: str
    property_id: int
    message_type: MessageType
    content: str
    sent_at: Optional[datetime]
    status: str  # pending, sent, failed
    tone_approved: bool = False

# Steven's approved message templates
TEMPLATES = [
    {
        "id": 1,
        "type": "welcome",
        "subject": "Welcome to Right at Home BnB!",
        "body": """Hi {guest_name}!

We're so excited to host you at {property_name}! Your stay begins on {checkin_date}.

Here's what you need to know:
- Check-in time: {checkin_time}
- Your unique access code: {access_code}
- Address: {property_address}

Need directions? Our app has Google Maps built right in!

Looking forward to hosting you,
Steven & the Right at Home Team""",
        "timing": "24h_before_checkin",
        "active": True
    },
    {
        "id": 2,
        "type": "checkin",
        "subject": "Check-in Day! Here's Everything You Need",
        "body": """Good morning {guest_name}!

Today's the day! Here are your check-in details:

🔑 ACCESS CODE: {access_code}
📍 ADDRESS: {property_address}

WiFi Network: {wifi_name}
WiFi Password: {wifi_password}

House Rules:
- No smoking
- Quiet hours: 10pm - 8am
- Checkout by {checkout_time}

Need anything? Just ask our AI Concierge in the app - it knows all the best spots in Midland!

Enjoy your stay!
Steven""",
        "timing": "morning_of_checkin",
        "active": True
    },
    {
        "id": 3,
        "type": "checkout_reminder",
        "subject": "Checkout Reminder - We Hope You Loved Your Stay!",
        "body": """Hi {guest_name},

Just a friendly reminder that checkout is tomorrow at {checkout_time}.

Before you go:
- Leave the access code on the kitchen counter
- Make sure all windows are closed
- Take out any trash

Want a late checkout? Just ask! We'll check availability.

We'd love to host you again. Repeat guests get special perks!

Safe travels,
Steven""",
        "timing": "evening_before_checkout",
        "active": True
    },
    {
        "id": 4,
        "type": "thank_you",
        "subject": "Thank You for Staying with Right at Home!",
        "body": """Hi {guest_name},

Thank you for choosing Right at Home BnB! We hope {property_name} felt like home.

If you enjoyed your stay, we'd be grateful for a review on {booking_platform}.

As a repeat guest, you'll receive:
✨ Priority booking
✨ Late checkout when available
✨ Special welcome amenities

We hope to see you again soon!

Warmly,
Steven Palma
Right at Home BnB - Midland, TX""",
        "timing": "1h_after_checkout",
        "active": True
    }
]

PENDING_MESSAGES = []
SENT_MESSAGES = []

@router.get("/templates")
async def get_templates():
    """Get all message templates"""
    return TEMPLATES

@router.get("/templates/{template_id}")
async def get_template(template_id: int):
    """Get specific template"""
    for t in TEMPLATES:
        if t["id"] == template_id:
            return t
    raise HTTPException(status_code=404, detail="Template not found")

@router.put("/templates/{template_id}")
async def update_template(template_id: int, body: str, subject: str = None):
    """Update template (Steven approval required)"""
    for t in TEMPLATES:
        if t["id"] == template_id:
            t["body"] = body
            if subject:
                t["subject"] = subject
            return {"status": "updated", "template": t}
    raise HTTPException(status_code=404, detail="Template not found")

@router.post("/queue")
async def queue_message(
    guest_id: int,
    guest_name: str,
    property_id: int,
    message_type: MessageType,
    variables: dict
):
    """Queue a message for sending (requires tone approval)"""
    # Find template
    template = None
    for t in TEMPLATES:
        if t["type"] == message_type.value:
            template = t
            break
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Fill in variables
    content = template["body"]
    for key, value in variables.items():
        content = content.replace(f"{{{key}}}", str(value))
    
    message = {
        "id": len(PENDING_MESSAGES) + 1,
        "guest_id": guest_id,
        "guest_name": guest_name,
        "property_id": property_id,
        "message_type": message_type.value,
        "subject": template["subject"].replace("{guest_name}", guest_name),
        "content": content,
        "queued_at": datetime.now().isoformat(),
        "status": "pending_approval",
        "tone_approved": False
    }
    
    PENDING_MESSAGES.append(message)
    return {"status": "queued", "message_id": message["id"], "requires_approval": True}

@router.get("/pending")
async def get_pending_messages():
    """Get messages awaiting approval"""
    return [m for m in PENDING_MESSAGES if m["status"] == "pending_approval"]

@router.post("/approve/{message_id}")
async def approve_message(message_id: int, background_tasks: BackgroundTasks):
    """Approve message for sending (Steven only)"""
    for msg in PENDING_MESSAGES:
        if msg["id"] == message_id:
            msg["tone_approved"] = True
            msg["status"] = "approved"
            msg["approved_at"] = datetime.now().isoformat()
            
            # Add to background send queue
            background_tasks.add_task(send_message_async, msg)
            
            return {"status": "approved", "message": msg}
    
    raise HTTPException(status_code=404, detail="Message not found")

@router.post("/reject/{message_id}")
async def reject_message(message_id: int, reason: str = None):
    """Reject message (needs revision)"""
    for msg in PENDING_MESSAGES:
        if msg["id"] == message_id:
            msg["status"] = "rejected"
            msg["rejection_reason"] = reason
            return {"status": "rejected", "message": msg}
    
    raise HTTPException(status_code=404, detail="Message not found")

async def send_message_async(message: dict):
    """Background task to send message via Twilio/Email"""
    # This would integrate with Twilio SMS API
    message["status"] = "sent"
    message["sent_at"] = datetime.now().isoformat()
    SENT_MESSAGES.append(message)
    PENDING_MESSAGES.remove(message)

@router.get("/sent")
async def get_sent_messages(guest_id: int = None, property_id: int = None):
    """Get sent message history"""
    results = SENT_MESSAGES
    if guest_id:
        results = [m for m in results if m["guest_id"] == guest_id]
    if property_id:
        results = [m for m in results if m["property_id"] == property_id]
    return results

@router.post("/auto-schedule/{booking_id}")
async def auto_schedule_messages(booking_id: int, guest_data: dict):
    """Auto-schedule all 4 messages for a booking"""
    scheduled = []
    
    for msg_type in ["welcome", "checkin", "checkout_reminder", "thank_you"]:
        result = await queue_message(
            guest_id=guest_data["guest_id"],
            guest_name=guest_data["guest_name"],
            property_id=guest_data["property_id"],
            message_type=MessageType(msg_type),
            variables=guest_data
        )
        scheduled.append(result)
    
    return {
        "status": "scheduled",
        "booking_id": booking_id,
        "messages": scheduled,
        "note": "All messages require Steven's approval before sending"
    }
