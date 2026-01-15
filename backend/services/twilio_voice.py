"""
Right At Home BnB - Twilio Voice Service
=========================================
Voice call integration for guest support and operations:
- Guests call Steven AI for support
- AI determines if escalation to Steven is needed
- AI can call Steven for urgent issues
- AI can call cleaners with reminders
- Daily briefing delivery via voice

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum
from loguru import logger

# Twilio
try:
    from twilio.rest import Client
    from twilio.twiml.voice_response import VoiceResponse, Gather, Say
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    VoiceResponse = None
    Gather = None
    Say = None

# Firebase
try:
    import firebase_admin
    from firebase_admin import firestore
    db = firestore.client() if firebase_admin._apps else None
    FIREBASE_AVAILABLE = db is not None
except:
    FIREBASE_AVAILABLE = False
    db = None


class CallType(str, Enum):
    GUEST_SUPPORT = "guest_support"
    STEVEN_ESCALATION = "steven_escalation"
    CLEANER_REMINDER = "cleaner_reminder"
    DAILY_BRIEFING = "daily_briefing"
    MAINTENANCE_ALERT = "maintenance_alert"
    EMERGENCY = "emergency"


class EscalationLevel(str, Enum):
    LOW = "low"           # AI can handle
    MEDIUM = "medium"     # Might need Steven
    HIGH = "high"         # Should notify Steven
    URGENT = "urgent"     # Call Steven immediately
    EMERGENCY = "emergency"  # 911 + Steven


# Issue patterns that trigger escalation
ESCALATION_TRIGGERS = {
    "emergency": [
        "fire", "flood", "break in", "intruder", "gas leak", "carbon monoxide",
        "injury", "hurt", "bleeding", "ambulance", "police", "911"
    ],
    "urgent": [
        "no power", "no water", "no heat", "no ac", "locked out", "can't get in",
        "broken pipe", "sewage", "smoke", "smell gas"
    ],
    "high": [
        "broken", "not working", "major issue", "unhappy", "refund", "leaving early",
        "complaint", "dangerous", "unsafe"
    ],
    "medium": [
        "question about", "need help with", "where is", "how do i",
        "minor issue", "small problem"
    ]
}


class TwilioVoiceService:
    """
    Voice call management using Twilio.
    Handles inbound guest calls and outbound operational calls.
    """

    def __init__(self):
        self.twilio_available = TWILIO_AVAILABLE
        self.firebase_available = FIREBASE_AVAILABLE

        # Twilio credentials
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.phone_number = os.getenv("TWILIO_PHONE_NUMBER", "+14325550100")

        # Steven's phone
        self.steven_phone = os.getenv("STEVEN_PHONE", "+14329006300")
        self.steven_backup_phone = os.getenv("STEVEN_BACKUP_PHONE")

        # Initialize Twilio client
        if self.twilio_available and self.account_sid and self.auth_token:
            self.client = Client(self.account_sid, self.auth_token)
        else:
            self.client = None

        self.calls_collection = "rah_voice_calls"

        # AI greeting for inbound calls
        self.ai_greeting = """
        Hello and welcome to Right At Home B and B.
        This is Steven, your AI concierge, powered by ECHO OMEGA PRIME.
        How can I help you today?
        """

    # =========================================================================
    # INBOUND CALL HANDLING (Guests calling in)
    # =========================================================================

    def generate_inbound_twiml(self, caller_id: str = None) -> str:
        """Generate TwiML for handling inbound guest calls."""
        if not TWILIO_AVAILABLE:
            return "<Response><Say>Voice service unavailable</Say></Response>"

        response = VoiceResponse()

        # Greeting
        response.say(
            self.ai_greeting,
            voice="Polly.Matthew",  # Natural male voice
            language="en-US"
        )

        # Gather speech input
        gather = Gather(
            input="speech",
            action="/api/voice/process-speech",
            language="en-US",
            speech_timeout="auto",
            hints="check in, check out, problem, issue, help, locked out, broken, emergency"
        )
        gather.say(
            "Please describe what you need help with, or press 0 to speak with Steven directly.",
            voice="Polly.Matthew"
        )
        response.append(gather)

        # If no input, prompt again
        response.redirect("/api/voice/no-input")

        return str(response)

    async def process_guest_speech(
        self,
        speech_result: str,
        caller_id: str,
        call_sid: str
    ) -> Dict[str, Any]:
        """Process what the guest said and determine response."""
        speech_lower = speech_result.lower()

        # Determine escalation level
        escalation = self._determine_escalation(speech_lower)

        # Log the call
        call_log = {
            "call_sid": call_sid,
            "caller_id": caller_id,
            "speech_text": speech_result,
            "escalation_level": escalation.value,
            "timestamp": datetime.utcnow().isoformat(),
            "resolved": False
        }

        if self.firebase_available and db:
            db.collection(self.calls_collection).document(call_sid).set(call_log)

        # Generate appropriate response
        if escalation == EscalationLevel.EMERGENCY:
            return await self._handle_emergency(speech_result, caller_id, call_sid)
        elif escalation == EscalationLevel.URGENT:
            return await self._handle_urgent(speech_result, caller_id, call_sid)
        elif escalation == EscalationLevel.HIGH:
            return await self._handle_high_priority(speech_result, caller_id, call_sid)
        else:
            return await self._handle_standard(speech_result, caller_id, call_sid)

    def _determine_escalation(self, speech_text: str) -> EscalationLevel:
        """Determine escalation level based on speech content."""
        for level, triggers in ESCALATION_TRIGGERS.items():
            for trigger in triggers:
                if trigger in speech_text:
                    return EscalationLevel(level)
        return EscalationLevel.LOW

    async def _handle_emergency(
        self,
        speech: str,
        caller_id: str,
        call_sid: str
    ) -> Dict[str, Any]:
        """Handle emergency situation."""
        response_text = """
        I understand this is an emergency situation.
        If you are in immediate danger, please hang up and call 911.
        I am connecting you to Steven right now and sending him an emergency alert.
        Please stay on the line.
        """

        # Immediately call Steven
        await self.call_steven(
            message=f"EMERGENCY from guest at {caller_id}: {speech}",
            call_type=CallType.EMERGENCY,
            connect_to_call=call_sid
        )

        return {
            "action": "transfer",
            "escalation": "emergency",
            "response_text": response_text,
            "transfer_to": self.steven_phone
        }

    async def _handle_urgent(
        self,
        speech: str,
        caller_id: str,
        call_sid: str
    ) -> Dict[str, Any]:
        """Handle urgent issues."""
        response_text = """
        I understand this is urgent. Let me get Steven on the line right away.
        In the meantime, can you tell me which property you're staying at?
        """

        # Notify Steven via SMS + call if no answer
        await self.call_steven(
            message=f"URGENT issue from guest: {speech}",
            call_type=CallType.STEVEN_ESCALATION
        )

        return {
            "action": "escalate",
            "escalation": "urgent",
            "response_text": response_text,
            "notify_steven": True
        }

    async def _handle_high_priority(
        self,
        speech: str,
        caller_id: str,
        call_sid: str
    ) -> Dict[str, Any]:
        """Handle high priority issues."""
        response_text = """
        I understand you have an issue that needs attention.
        Let me see if I can help resolve this for you.
        If you need to speak with Steven directly, just say 'speak to Steven'.
        """

        # Send Steven a notification but don't interrupt
        await self._send_steven_notification(
            f"Guest issue (high priority): {speech}",
            caller_id
        )

        return {
            "action": "assist",
            "escalation": "high",
            "response_text": response_text,
            "ai_can_handle": True,
            "steven_notified": True
        }

    async def _handle_standard(
        self,
        speech: str,
        caller_id: str,
        call_sid: str
    ) -> Dict[str, Any]:
        """Handle standard inquiries that AI can resolve."""
        # AI generates response based on inquiry
        ai_response = await self._generate_ai_response(speech)

        return {
            "action": "respond",
            "escalation": "low",
            "response_text": ai_response,
            "ai_handled": True
        }

    async def _generate_ai_response(self, inquiry: str) -> str:
        """Generate AI response for common inquiries."""
        inquiry_lower = inquiry.lower()

        # Common Q&A
        if "check in" in inquiry_lower or "check-in" in inquiry_lower:
            return "Check-in time is at 3 PM. You'll receive a door code via text message on the day of your arrival. Is there anything else I can help with?"

        if "check out" in inquiry_lower or "check-out" in inquiry_lower:
            return "Check-out time is 11 AM. Please ensure all dishes are in the dishwasher, trash is in the outside bins, and the thermostat is set to 78 degrees. Thank you!"

        if "wifi" in inquiry_lower or "internet" in inquiry_lower:
            return "The WiFi network name and password are posted on the refrigerator and in the welcome book on the coffee table. Would you like me to text it to you?"

        if "parking" in inquiry_lower:
            return "You can park in the driveway or on the street. There's no permit required. Is there anything else?"

        if "late" in inquiry_lower and "check" in inquiry_lower:
            return "For late check-in or check-out requests, let me check availability. May I have your reservation name?"

        if "pool" in inquiry_lower:
            return "Pool hours are from 8 AM to 10 PM. Towels are provided in the pool cabinet. Please shower before entering and no glass containers near the pool."

        # Default helpful response
        return "I'd be happy to help with that. Could you provide a bit more detail so I can assist you better? Or say 'speak to Steven' if you'd prefer to talk to him directly."

    # =========================================================================
    # OUTBOUND CALLS
    # =========================================================================

    async def call_steven(
        self,
        message: str,
        call_type: CallType = CallType.STEVEN_ESCALATION,
        connect_to_call: str = None
    ) -> Dict[str, Any]:
        """Call Steven for urgent matters."""
        logger.info(f"Calling Steven: {message[:50]}...")

        if not self.client:
            return {"success": False, "error": "Twilio client not configured"}

        # Create the call
        twiml = f"""
        <Response>
            <Say voice="Polly.Matthew">
                Steven, this is an alert from Right At Home B and B.
                {message}
                Press 1 to be connected to the guest.
                Press 2 to acknowledge this alert.
                Press 9 to repeat.
            </Say>
            <Gather numDigits="1" action="/api/voice/steven-response">
                <Say>Press 1 for guest, 2 to acknowledge, or 9 to repeat.</Say>
            </Gather>
        </Response>
        """

        try:
            call = self.client.calls.create(
                twiml=twiml,
                to=self.steven_phone,
                from_=self.phone_number,
                status_callback="/api/voice/call-status"
            )

            # Log the call
            if self.firebase_available and db:
                db.collection(self.calls_collection).document(call.sid).set({
                    "call_sid": call.sid,
                    "call_type": call_type.value,
                    "to": self.steven_phone,
                    "message": message,
                    "timestamp": datetime.utcnow().isoformat(),
                    "status": "initiated"
                })

            return {"success": True, "call_sid": call.sid}

        except Exception as e:
            logger.error(f"Failed to call Steven: {e}")
            return {"success": False, "error": str(e)}

    async def call_cleaner(
        self,
        cleaner_phone: str,
        cleaner_name: str,
        message: str,
        property_address: str = None
    ) -> Dict[str, Any]:
        """Call a cleaner with a reminder or update."""
        logger.info(f"Calling cleaner {cleaner_name}: {message[:50]}...")

        if not self.client:
            return {"success": False, "error": "Twilio client not configured"}

        twiml = f"""
        <Response>
            <Say voice="Polly.Matthew">
                Hello {cleaner_name}. This is an automated message from Right At Home B and B.
                {message}
                {"The property address is: " + property_address if property_address else ""}
                Press 1 to confirm you received this message.
                Press 2 if you need to speak with Steven.
            </Say>
            <Gather numDigits="1" action="/api/voice/cleaner-response">
                <Say>Press 1 to confirm or 2 for Steven.</Say>
            </Gather>
        </Response>
        """

        try:
            call = self.client.calls.create(
                twiml=twiml,
                to=cleaner_phone,
                from_=self.phone_number
            )

            # Log
            if self.firebase_available and db:
                db.collection(self.calls_collection).document(call.sid).set({
                    "call_sid": call.sid,
                    "call_type": CallType.CLEANER_REMINDER.value,
                    "to": cleaner_phone,
                    "cleaner_name": cleaner_name,
                    "message": message,
                    "timestamp": datetime.utcnow().isoformat(),
                    "status": "initiated"
                })

            return {"success": True, "call_sid": call.sid}

        except Exception as e:
            logger.error(f"Failed to call cleaner: {e}")
            return {"success": False, "error": str(e)}

    async def deliver_daily_briefing_call(self, briefing_script: str) -> Dict[str, Any]:
        """Deliver daily briefing to Steven via voice call."""
        logger.info("Delivering daily briefing via voice call...")

        if not self.client:
            return {"success": False, "error": "Twilio client not configured"}

        # Prepare TwiML for briefing
        twiml = f"""
        <Response>
            <Say voice="Polly.Matthew">
                Good morning Steven! Here's your daily briefing from Right At Home B and B.
            </Say>
            <Pause length="1"/>
            <Say voice="Polly.Matthew">
                {briefing_script}
            </Say>
            <Pause length="1"/>
            <Say voice="Polly.Matthew">
                Press 1 to repeat the briefing.
                Press 2 to hear more details.
                Or simply hang up when you're ready.
                Have a great day!
            </Say>
            <Gather numDigits="1" action="/api/voice/briefing-response" timeout="10">
            </Gather>
        </Response>
        """

        try:
            call = self.client.calls.create(
                twiml=twiml,
                to=self.steven_phone,
                from_=self.phone_number
            )

            return {"success": True, "call_sid": call.sid, "delivered_at": datetime.utcnow().isoformat()}

        except Exception as e:
            logger.error(f"Failed to deliver briefing: {e}")
            return {"success": False, "error": str(e)}

    # =========================================================================
    # SMS NOTIFICATIONS
    # =========================================================================

    async def send_sms(
        self,
        to_phone: str,
        message: str
    ) -> Dict[str, Any]:
        """Send SMS message."""
        if not self.client:
            return {"success": False, "error": "Twilio client not configured"}

        try:
            msg = self.client.messages.create(
                body=message,
                to=to_phone,
                from_=self.phone_number
            )
            return {"success": True, "message_sid": msg.sid}
        except Exception as e:
            logger.error(f"Failed to send SMS: {e}")
            return {"success": False, "error": str(e)}

    async def _send_steven_notification(self, message: str, caller_id: str = None) -> None:
        """Send Steven a notification via SMS."""
        notification = f"RAH Alert: {message}"
        if caller_id:
            notification += f"\nFrom: {caller_id}"

        await self.send_sms(self.steven_phone, notification)

    # =========================================================================
    # CALL HISTORY
    # =========================================================================

    async def get_call_history(
        self,
        call_type: CallType = None,
        limit: int = 50
    ) -> List[Dict]:
        """Get call history."""
        if not self.firebase_available or not db:
            return []

        query = db.collection(self.calls_collection).order_by(
            "timestamp", direction=firestore.Query.DESCENDING
        ).limit(limit)

        if call_type:
            query = query.where("call_type", "==", call_type.value)

        return [doc.to_dict() for doc in query.stream()]

    async def get_unresolved_calls(self) -> List[Dict]:
        """Get calls that haven't been resolved."""
        if not self.firebase_available or not db:
            return []

        docs = db.collection(self.calls_collection).where(
            "resolved", "==", False
        ).order_by("timestamp", direction=firestore.Query.DESCENDING).stream()

        return [doc.to_dict() for doc in docs]


# Singleton instance
twilio_voice_service = TwilioVoiceService()
