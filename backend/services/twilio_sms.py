"""
Twilio SMS Service for Right at Home BnB
Automated guest messaging with sentiment analysis
@author ECHO OMEGA PRIME
"""

import os
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass
from loguru import logger

# Twilio
try:
    from twilio.rest import Client
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    Client = None


class MessagePriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class MessageTemplate(str, Enum):
    BOOKING_CONFIRMED = "booking_confirmed"
    PRE_ARRIVAL = "pre_arrival"
    CHECK_IN_INSTRUCTIONS = "check_in_instructions"
    DURING_STAY = "during_stay"
    CHECKOUT_REMINDER = "checkout_reminder"
    POST_STAY = "post_stay"
    REVIEW_REQUEST = "review_request"
    CODE_DELIVERY = "code_delivery"
    MAINTENANCE_ALERT = "maintenance_alert"
    CUSTOM = "custom"


@dataclass
class SMSMessage:
    """SMS message data"""
    to: str
    body: str
    template: Optional[MessageTemplate] = None
    priority: MessagePriority = MessagePriority.NORMAL
    guest_id: Optional[str] = None
    booking_id: Optional[str] = None
    property_id: Optional[str] = None
    scheduled_for: Optional[datetime] = None


@dataclass
class SMSResult:
    """SMS send result"""
    success: bool
    message_sid: Optional[str] = None
    error: Optional[str] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


# Message templates with placeholders
MESSAGE_TEMPLATES = {
    MessageTemplate.BOOKING_CONFIRMED: """
Hi {guest_name}! Your reservation at {property_name} is confirmed.

Check-in: {check_in_date} at {check_in_time}
Check-out: {check_out_date} at {check_out_time}

We'll send your access code the day before arrival.

Questions? Just reply to this message!

- Right at Home BnB
""".strip(),

    MessageTemplate.PRE_ARRIVAL: """
Hi {guest_name}! We're getting excited to host you tomorrow at {property_name}!

Here's your access code: {access_code}

This code is valid from {code_start} to {code_end}.

Address: {property_address}

Need anything? We're here to help!

- Right at Home BnB
""".strip(),

    MessageTemplate.CHECK_IN_INSTRUCTIONS: """
Welcome to {property_name}! Here's everything you need:

ACCESS CODE: {access_code}

WiFi: {wifi_network}
Password: {wifi_password}

{special_instructions}

Enjoy your stay!
- Right at Home BnB
""".strip(),

    MessageTemplate.DURING_STAY: """
Hi {guest_name}! Hope you're enjoying your stay at {property_name}!

Just checking in - is there anything you need?

Our AI concierge is available 24/7 for local recommendations and assistance.

- Right at Home BnB
""".strip(),

    MessageTemplate.CHECKOUT_REMINDER: """
Hi {guest_name}! Just a reminder that checkout is tomorrow at {check_out_time}.

Before you leave:
- Lock all doors and windows
- Set thermostat to 78F
- Take out trash
- Leave dirty towels in the bathroom

Want a late checkout? Reply "LATE" and we'll check availability!

Safe travels!
- Right at Home BnB
""".strip(),

    MessageTemplate.POST_STAY: """
Hi {guest_name}! Thank you for staying at {property_name}!

We hope you had a wonderful experience. As a valued guest, you'll receive priority booking for future stays.

If you enjoyed your stay, we'd love a review on {platform}!

Come back soon!
- Steven, Right at Home BnB
""".strip(),

    MessageTemplate.REVIEW_REQUEST: """
Hi {guest_name}! We hope you're doing well.

If you have a moment, we'd really appreciate a review of your stay at {property_name} on {platform}.

Your feedback helps us improve and helps other travelers find great stays!

Thank you!
- Right at Home BnB
""".strip(),

    MessageTemplate.CODE_DELIVERY: """
Your access code for {property_name}:

{access_code}

Valid: {code_start} - {code_end}
Address: {property_address}

See you soon!
""".strip(),

    MessageTemplate.MAINTENANCE_ALERT: """
ALERT: Maintenance issue reported at {property_name}

Issue: {issue_description}
Reported by: {reported_by}
Time: {reported_at}

Please respond or call {callback_number} ASAP.
""".strip(),
}


class TwilioSMSService:
    """
    SMS messaging service using Twilio.
    Handles guest communications, access code delivery, and automated flows.
    """

    def __init__(self):
        self.twilio_available = TWILIO_AVAILABLE

        # Twilio credentials
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.phone_number = os.getenv("TWILIO_PHONE_NUMBER", "+14325550100")
        self.messaging_service_sid = os.getenv("TWILIO_MESSAGING_SERVICE_SID")

        # Initialize client
        if self.twilio_available and self.account_sid and self.auth_token:
            self.client = Client(self.account_sid, self.auth_token)
        else:
            self.client = None

        # Steven's phone for alerts
        self.steven_phone = os.getenv("STEVEN_PHONE", "+14329006300")

        # Sent messages cache (in production use database)
        self._sent_messages: List[Dict] = []

    def _normalize_phone(self, phone: str) -> str:
        """Normalize phone number to E.164 format."""
        # Remove all non-digits
        digits = re.sub(r'\D', '', phone)

        # Add country code if missing
        if len(digits) == 10:
            return f"+1{digits}"
        elif len(digits) == 11 and digits.startswith('1'):
            return f"+{digits}"
        elif not digits.startswith('+'):
            return f"+{digits}"

        return phone

    def _fill_template(
        self,
        template: MessageTemplate,
        variables: Dict[str, Any]
    ) -> str:
        """Fill template with variables."""
        template_text = MESSAGE_TEMPLATES.get(template, "{message}")

        for key, value in variables.items():
            placeholder = "{" + key + "}"
            template_text = template_text.replace(placeholder, str(value))

        return template_text

    async def send_sms(
        self,
        to: str,
        body: str,
        media_urls: Optional[List[str]] = None,
        status_callback: Optional[str] = None
    ) -> SMSResult:
        """
        Send SMS message.

        Args:
            to: Recipient phone number
            body: Message body
            media_urls: Optional MMS media URLs
            status_callback: Webhook URL for delivery status

        Returns:
            SMSResult with success status and message SID
        """
        if not self.client:
            return SMSResult(
                success=False,
                error="Twilio client not configured"
            )

        to_normalized = self._normalize_phone(to)

        try:
            # Build message params
            params = {
                "body": body,
                "to": to_normalized,
            }

            # Use messaging service if available, else use phone number
            if self.messaging_service_sid:
                params["messaging_service_sid"] = self.messaging_service_sid
            else:
                params["from_"] = self.phone_number

            # Add media URLs for MMS
            if media_urls:
                params["media_url"] = media_urls

            # Add status callback
            if status_callback:
                params["status_callback"] = status_callback

            # Send message
            message = self.client.messages.create(**params)

            logger.info(f"SMS sent to {to_normalized}: {message.sid}")

            # Track sent message
            self._sent_messages.append({
                "sid": message.sid,
                "to": to_normalized,
                "body_preview": body[:50] + "..." if len(body) > 50 else body,
                "timestamp": datetime.utcnow().isoformat(),
                "status": message.status
            })

            return SMSResult(
                success=True,
                message_sid=message.sid
            )

        except Exception as e:
            logger.error(f"SMS send failed: {e}")
            return SMSResult(
                success=False,
                error=str(e)
            )

    async def send_template(
        self,
        to: str,
        template: MessageTemplate,
        variables: Dict[str, Any],
        guest_id: Optional[str] = None,
        booking_id: Optional[str] = None
    ) -> SMSResult:
        """Send message using template."""
        body = self._fill_template(template, variables)

        result = await self.send_sms(to, body)

        # Add metadata
        if result.success:
            result.template = template
            result.guest_id = guest_id
            result.booking_id = booking_id

        return result

    async def send_booking_confirmation(
        self,
        guest_phone: str,
        guest_name: str,
        property_name: str,
        check_in: datetime,
        check_out: datetime,
        booking_id: str
    ) -> SMSResult:
        """Send booking confirmation SMS."""
        variables = {
            "guest_name": guest_name,
            "property_name": property_name,
            "check_in_date": check_in.strftime("%B %d, %Y"),
            "check_in_time": "3:00 PM",
            "check_out_date": check_out.strftime("%B %d, %Y"),
            "check_out_time": "11:00 AM"
        }

        return await self.send_template(
            to=guest_phone,
            template=MessageTemplate.BOOKING_CONFIRMED,
            variables=variables,
            booking_id=booking_id
        )

    async def send_access_code(
        self,
        guest_phone: str,
        guest_name: str,
        property_name: str,
        property_address: str,
        access_code: str,
        code_start: datetime,
        code_end: datetime,
        booking_id: str
    ) -> SMSResult:
        """Send access code to guest."""
        variables = {
            "guest_name": guest_name,
            "property_name": property_name,
            "property_address": property_address,
            "access_code": access_code,
            "code_start": code_start.strftime("%b %d at %I:%M %p"),
            "code_end": code_end.strftime("%b %d at %I:%M %p")
        }

        return await self.send_template(
            to=guest_phone,
            template=MessageTemplate.PRE_ARRIVAL,
            variables=variables,
            booking_id=booking_id
        )

    async def send_check_in_instructions(
        self,
        guest_phone: str,
        property_name: str,
        access_code: str,
        wifi_network: str,
        wifi_password: str,
        special_instructions: str = "",
        booking_id: str = None
    ) -> SMSResult:
        """Send check-in instructions."""
        variables = {
            "property_name": property_name,
            "access_code": access_code,
            "wifi_network": wifi_network,
            "wifi_password": wifi_password,
            "special_instructions": special_instructions
        }

        return await self.send_template(
            to=guest_phone,
            template=MessageTemplate.CHECK_IN_INSTRUCTIONS,
            variables=variables,
            booking_id=booking_id
        )

    async def send_checkout_reminder(
        self,
        guest_phone: str,
        guest_name: str,
        check_out_time: str = "11:00 AM",
        booking_id: str = None
    ) -> SMSResult:
        """Send checkout reminder."""
        variables = {
            "guest_name": guest_name,
            "check_out_time": check_out_time
        }

        return await self.send_template(
            to=guest_phone,
            template=MessageTemplate.CHECKOUT_REMINDER,
            variables=variables,
            booking_id=booking_id
        )

    async def send_review_request(
        self,
        guest_phone: str,
        guest_name: str,
        property_name: str,
        platform: str = "Airbnb",
        booking_id: str = None
    ) -> SMSResult:
        """Send review request."""
        variables = {
            "guest_name": guest_name,
            "property_name": property_name,
            "platform": platform
        }

        return await self.send_template(
            to=guest_phone,
            template=MessageTemplate.REVIEW_REQUEST,
            variables=variables,
            booking_id=booking_id
        )

    async def send_maintenance_alert(
        self,
        recipient_phone: str,
        property_name: str,
        issue_description: str,
        reported_by: str = "Guest",
        callback_number: str = None
    ) -> SMSResult:
        """Send maintenance alert to staff/Steven."""
        variables = {
            "property_name": property_name,
            "issue_description": issue_description,
            "reported_by": reported_by,
            "reported_at": datetime.now().strftime("%I:%M %p"),
            "callback_number": callback_number or self.steven_phone
        }

        return await self.send_template(
            to=recipient_phone,
            template=MessageTemplate.MAINTENANCE_ALERT,
            variables=variables
        )

    async def alert_steven(self, message: str, priority: MessagePriority = MessagePriority.HIGH) -> SMSResult:
        """Send alert to Steven."""
        prefix = ""
        if priority == MessagePriority.URGENT:
            prefix = "URGENT: "
        elif priority == MessagePriority.HIGH:
            prefix = "ALERT: "

        full_message = f"{prefix}{message}\n\n- RAH AI System"

        return await self.send_sms(self.steven_phone, full_message)

    async def schedule_message(
        self,
        to: str,
        body: str,
        send_at: datetime
    ) -> Dict[str, Any]:
        """
        Schedule a message for future delivery.
        Uses Twilio's scheduled messaging feature.
        """
        if not self.client:
            return {"success": False, "error": "Twilio client not configured"}

        to_normalized = self._normalize_phone(to)

        try:
            message = self.client.messages.create(
                body=body,
                to=to_normalized,
                messaging_service_sid=self.messaging_service_sid,
                schedule_type="fixed",
                send_at=send_at.isoformat()
            )

            return {
                "success": True,
                "message_sid": message.sid,
                "scheduled_for": send_at.isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to schedule message: {e}")
            return {"success": False, "error": str(e)}

    async def cancel_scheduled_message(self, message_sid: str) -> Dict[str, Any]:
        """Cancel a scheduled message."""
        if not self.client:
            return {"success": False, "error": "Twilio client not configured"}

        try:
            self.client.messages(message_sid).update(status="canceled")
            return {"success": True, "message_sid": message_sid, "status": "canceled"}
        except Exception as e:
            logger.error(f"Failed to cancel message: {e}")
            return {"success": False, "error": str(e)}

    async def get_message_status(self, message_sid: str) -> Dict[str, Any]:
        """Get status of a sent message."""
        if not self.client:
            return {"success": False, "error": "Twilio client not configured"}

        try:
            message = self.client.messages(message_sid).fetch()
            return {
                "success": True,
                "message_sid": message.sid,
                "status": message.status,
                "to": message.to,
                "from": message.from_,
                "sent_at": message.date_sent.isoformat() if message.date_sent else None,
                "error_code": message.error_code,
                "error_message": message.error_message
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_sent_messages(
        self,
        limit: int = 50,
        to_phone: str = None,
        date_from: datetime = None,
        date_to: datetime = None
    ) -> List[Dict]:
        """Get sent message history from Twilio."""
        if not self.client:
            return []

        try:
            params = {"limit": limit}

            if to_phone:
                params["to"] = self._normalize_phone(to_phone)
            if date_from:
                params["date_sent_after"] = date_from
            if date_to:
                params["date_sent_before"] = date_to

            messages = self.client.messages.list(**params)

            return [
                {
                    "sid": m.sid,
                    "to": m.to,
                    "from": m.from_,
                    "body_preview": m.body[:50] + "..." if len(m.body) > 50 else m.body,
                    "status": m.status,
                    "sent_at": m.date_sent.isoformat() if m.date_sent else None,
                    "direction": m.direction
                }
                for m in messages
            ]

        except Exception as e:
            logger.error(f"Failed to get messages: {e}")
            return []

    async def handle_incoming_webhook(self, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle incoming SMS webhook from Twilio.
        Returns action to take based on message content.
        """
        from_number = webhook_data.get("From", "")
        body = webhook_data.get("Body", "").strip().upper()
        message_sid = webhook_data.get("MessageSid", "")

        logger.info(f"Incoming SMS from {from_number}: {body[:30]}...")

        # Handle keywords
        if body == "LATE":
            return {
                "action": "late_checkout_request",
                "from": from_number,
                "response": "We'll check late checkout availability and get back to you within 15 minutes!",
                "escalate": True
            }

        elif body == "HELP":
            return {
                "action": "help_request",
                "from": from_number,
                "response": "Our AI concierge is here to help! Reply with your question or call us at (432) 900-6300.",
                "escalate": False
            }

        elif body == "STOP":
            return {
                "action": "opt_out",
                "from": from_number,
                "response": "You've been unsubscribed from Right at Home BnB messages. Reply START to resubscribe.",
                "escalate": False
            }

        elif body == "START":
            return {
                "action": "opt_in",
                "from": from_number,
                "response": "Welcome back! You'll now receive updates from Right at Home BnB.",
                "escalate": False
            }

        else:
            # Needs AI processing or human review
            return {
                "action": "process",
                "from": from_number,
                "body": webhook_data.get("Body", ""),
                "response": None,
                "escalate": True
            }

    async def send_automated_flow(
        self,
        booking_id: str,
        guest_phone: str,
        guest_name: str,
        property_name: str,
        property_address: str,
        check_in: datetime,
        check_out: datetime,
        access_code: str,
        wifi_network: str,
        wifi_password: str,
        platform: str = "Airbnb"
    ) -> Dict[str, Any]:
        """
        Schedule the complete 4-message automated flow for a booking.
        """
        results = []

        # 1. Booking confirmation (immediate)
        result1 = await self.send_booking_confirmation(
            guest_phone, guest_name, property_name, check_in, check_out, booking_id
        )
        results.append({"type": "confirmation", "result": result1})

        # 2. Access code (day before check-in at noon)
        pre_arrival_time = (check_in - timedelta(days=1)).replace(hour=12, minute=0)
        result2 = await self.schedule_message(
            to=guest_phone,
            body=self._fill_template(MessageTemplate.PRE_ARRIVAL, {
                "guest_name": guest_name,
                "property_name": property_name,
                "property_address": property_address,
                "access_code": access_code,
                "code_start": check_in.strftime("%b %d at 3:00 PM"),
                "code_end": check_out.strftime("%b %d at 11:00 AM")
            }),
            send_at=pre_arrival_time
        )
        results.append({"type": "pre_arrival", "result": result2, "scheduled_for": pre_arrival_time.isoformat()})

        # 3. Check-in instructions (morning of check-in at 10am)
        checkin_time = check_in.replace(hour=10, minute=0)
        result3 = await self.schedule_message(
            to=guest_phone,
            body=self._fill_template(MessageTemplate.CHECK_IN_INSTRUCTIONS, {
                "property_name": property_name,
                "access_code": access_code,
                "wifi_network": wifi_network,
                "wifi_password": wifi_password,
                "special_instructions": ""
            }),
            send_at=checkin_time
        )
        results.append({"type": "check_in", "result": result3, "scheduled_for": checkin_time.isoformat()})

        # 4. Checkout reminder (evening before checkout at 6pm)
        checkout_reminder_time = (check_out - timedelta(days=1)).replace(hour=18, minute=0)
        result4 = await self.schedule_message(
            to=guest_phone,
            body=self._fill_template(MessageTemplate.CHECKOUT_REMINDER, {
                "guest_name": guest_name,
                "check_out_time": "11:00 AM"
            }),
            send_at=checkout_reminder_time
        )
        results.append({"type": "checkout_reminder", "result": result4, "scheduled_for": checkout_reminder_time.isoformat()})

        # 5. Post-stay thank you (1 hour after checkout)
        post_stay_time = check_out.replace(hour=12, minute=0)
        result5 = await self.schedule_message(
            to=guest_phone,
            body=self._fill_template(MessageTemplate.POST_STAY, {
                "guest_name": guest_name,
                "property_name": property_name,
                "platform": platform
            }),
            send_at=post_stay_time
        )
        results.append({"type": "post_stay", "result": result5, "scheduled_for": post_stay_time.isoformat()})

        return {
            "success": True,
            "booking_id": booking_id,
            "messages_scheduled": len(results),
            "results": results
        }


# Singleton instance
twilio_sms_service = TwilioSMSService()


# Quick helper functions
async def send_sms(to: str, message: str) -> SMSResult:
    """Quick helper to send an SMS."""
    return await twilio_sms_service.send_sms(to, message)


async def send_access_code(
    guest_phone: str,
    guest_name: str,
    property_name: str,
    property_address: str,
    access_code: str
) -> SMSResult:
    """Quick helper to send access code."""
    return await twilio_sms_service.send_access_code(
        guest_phone=guest_phone,
        guest_name=guest_name,
        property_name=property_name,
        property_address=property_address,
        access_code=access_code,
        code_start=datetime.now(),
        code_end=datetime.now() + timedelta(days=7),
        booking_id=None
    )
