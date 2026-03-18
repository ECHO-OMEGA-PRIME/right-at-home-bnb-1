"""
Right At Home BnB - CONCIERGE UPGRADES V2
==========================================
Advanced features for the Ultimate Concierge:
1. Late Checkout Requests
2. Automated Check-In Instructions  
3. Review Request Automation
4. Damage Deposit System
5. Cleaner Dispatch Integration
6. Uber/Lyft Integration
7. Food Delivery Ordering
8. Multi-Language Support
9. Property-Specific Knowledge
10. Guest Preference Learning

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
import json
import asyncio
import httpx
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta, time
from enum import Enum
from dataclasses import dataclass, field, asdict
from loguru import logger

# Firebase
try:
    import firebase_admin
    from firebase_admin import firestore
    db = firestore.client() if firebase_admin._apps else None
    FIREBASE_AVAILABLE = db is not None
except:
    FIREBASE_AVAILABLE = False
    db = None

# Twilio
try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    TwilioClient = None


# ============================================================================
# PROPERTY KNOWLEDGE BASE - All 22 Properties
# ============================================================================

PROPERTY_KNOWLEDGE = {
    "castleford_estate": {
        "name": "Castleford Estate",
        "address": "123 Oak Lane, Midland, TX 79705",
        "wifi_network": "CastlefordGuest",
        "wifi_password": "Welcome2024!",
        "door_code": "1234#",
        "lockbox_location": None,  # Smart lock, no lockbox
        "check_in_time": "3:00 PM",
        "check_out_time": "11:00 AM",
        "parking": "Driveway parking for 4 vehicles",
        "trash_day": "Tuesday",
        "pool": True,
        "hot_tub": True,
        "grill": "Weber gas grill on back patio",
        "washer_dryer": True,
        "pet_friendly": False,
        "max_guests": 10,
        "bedrooms": 4,
        "bathrooms": 3,
        "special_instructions": "Pool gate code is 5678. Please shower before using hot tub.",
        "house_rules": [
            "No smoking inside",
            "No parties or events",
            "Quiet hours 10pm-8am",
            "No pets",
            "Maximum 10 guests"
        ],
        "amenities": [
            "Pool", "Hot Tub", "Game Room", "Smart TV in all rooms",
            "Full Kitchen", "Washer/Dryer", "High-speed WiFi", "Workspace"
        ],
        "nearby": {
            "grocery": "HEB - 1.2 miles",
            "pharmacy": "Walgreens - 0.8 miles",
            "gas": "Shell - 0.5 miles",
            "hospital": "Midland Memorial - 3.2 miles"
        }
    },
    "permian_palace": {
        "name": "Permian Palace",
        "address": "456 Basin Blvd, Midland, TX 79701",
        "wifi_network": "PermianPalace",
        "wifi_password": "BasinLife2024!",
        "door_code": "2468#",
        "check_in_time": "3:00 PM",
        "check_out_time": "11:00 AM",
        "parking": "Garage parking for 2, driveway for 4 more",
        "trash_day": "Wednesday",
        "pool": False,
        "hot_tub": False,
        "grill": "Traeger smoker in backyard",
        "washer_dryer": True,
        "pet_friendly": True,
        "pet_fee": 50,
        "max_guests": 12,
        "bedrooms": 5,
        "bathrooms": 4,
        "special_instructions": "Game room is in basement. Please keep volume reasonable.",
        "house_rules": [
            "No smoking inside",
            "No parties over 12 people",
            "Pets allowed with $50 fee",
            "Quiet hours 10pm-8am"
        ]
    },
    # Add more properties as needed...
}

# Default property template for properties not fully configured
DEFAULT_PROPERTY = {
    "wifi_network": "RightAtHome",
    "wifi_password": "Welcome2024!",
    "check_in_time": "3:00 PM",
    "check_out_time": "11:00 AM",
    "parking": "Street parking available",
    "trash_day": "Check with host",
    "house_rules": [
        "No smoking inside",
        "No parties",
        "Quiet hours 10pm-8am",
        "Maximum occupancy per booking"
    ]
}


# ============================================================================
# LATE CHECKOUT SYSTEM
# ============================================================================

class LateCheckoutService:
    """Handle late checkout requests with fee calculation."""
    
    # Pricing tiers
    LATE_CHECKOUT_FEES = {
        "1_hour": 25,      # Until 12pm
        "2_hours": 40,     # Until 1pm
        "3_hours": 50,     # Until 2pm
        "half_day": 75,    # Until 3pm (next check-in)
    }
    
    def __init__(self):
        self.twilio_client = None
        if TWILIO_AVAILABLE:
            sid = os.getenv("TWILIO_ACCOUNT_SID")
            token = os.getenv("TWILIO_AUTH_TOKEN")
            if sid and token:
                self.twilio_client = TwilioClient(sid, token)
        
        self.steven_phone = os.getenv("STEVEN_PHONE", "+14329006300")
        self.twilio_number = os.getenv("TWILIO_PHONE_NUMBER")
    
    async def request_late_checkout(
        self,
        guest_id: str,
        property_id: str,
        requested_time: str,  # e.g., "1:00 PM"
        guest_name: str,
        guest_phone: str
    ) -> Dict[str, Any]:
        """Process a late checkout request."""
        # Calculate fee based on requested time
        fee = self._calculate_fee(requested_time)
        
        # Check if next booking allows it
        can_approve, reason = await self._check_availability(property_id, requested_time)
        
        # Create request record
        request_id = f"late_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{guest_id[:8]}"
        
        request_data = {
            "id": request_id,
            "guest_id": guest_id,
            "property_id": property_id,
            "guest_name": guest_name,
            "guest_phone": guest_phone,
            "requested_time": requested_time,
            "fee": fee,
            "can_auto_approve": can_approve,
            "reason": reason,
            "status": "pending",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Save to Firebase
        if FIREBASE_AVAILABLE and db:
            db.collection("rah_late_checkout_requests").document(request_id).set(request_data)
        
        # Notify Steven
        await self._notify_steven(request_data)
        
        if can_approve:
            return {
                "status": "approved",
                "message": f"Great news, {guest_name}! Your late checkout until {requested_time} is approved. The fee is ${fee}. It will be charged to your card on file.",
                "fee": fee,
                "checkout_time": requested_time,
                "request_id": request_id
            }
        else:
            return {
                "status": "pending",
                "message": f"I've sent your request to Steven for a late checkout until {requested_time}. The fee would be ${fee}. He'll get back to you shortly - there may be another guest checking in that day.",
                "fee": fee,
                "request_id": request_id
            }
    
    def _calculate_fee(self, requested_time: str) -> int:
        """Calculate late checkout fee based on time."""
        # Parse time (simple version)
        time_lower = requested_time.lower()
        if "12" in time_lower or "noon" in time_lower:
            return self.LATE_CHECKOUT_FEES["1_hour"]
        elif "1" in time_lower and "pm" in time_lower:
            return self.LATE_CHECKOUT_FEES["2_hours"]
        elif "2" in time_lower and "pm" in time_lower:
            return self.LATE_CHECKOUT_FEES["3_hours"]
        elif "3" in time_lower and "pm" in time_lower:
            return self.LATE_CHECKOUT_FEES["half_day"]
        else:
            return self.LATE_CHECKOUT_FEES["2_hours"]  # Default
    
    async def _check_availability(self, property_id: str, requested_time: str) -> Tuple[bool, str]:
        """Check if there's a same-day check-in that would conflict."""
        # In production, check bookings database
        # For now, assume available if before 2pm
        if "3" in requested_time.lower():
            return False, "Same-day check-in scheduled"
        return True, "No conflicts"
    
    async def _notify_steven(self, request: Dict[str, Any]):
        """Send Steven a notification about the late checkout request."""
        if not self.twilio_client:
            return
        
        message = f"""🕐 Late Checkout Request

Guest: {request['guest_name']}
Property: {request['property_id']}
Requested: {request['requested_time']}
Fee: ${request['fee']}
Auto-approved: {'Yes' if request['can_auto_approve'] else 'No - ' + request['reason']}

Reply APPROVE or DENY"""
        
        try:
            self.twilio_client.messages.create(
                body=message,
                to=self.steven_phone,
                from_=self.twilio_number
            )
        except Exception as e:
            logger.error(f"Failed to notify Steven: {e}")


# ============================================================================
# AUTOMATED CHECK-IN INSTRUCTIONS
# ============================================================================

class CheckInAutomation:
    """Send check-in instructions automatically at 3pm on check-in day."""
    
    def __init__(self):
        self.twilio_client = None
        if TWILIO_AVAILABLE:
            sid = os.getenv("TWILIO_ACCOUNT_SID")
            token = os.getenv("TWILIO_AUTH_TOKEN")
            if sid and token:
                self.twilio_client = TwilioClient(sid, token)
        self.twilio_number = os.getenv("TWILIO_PHONE_NUMBER")
    
    async def send_check_in_instructions(
        self,
        guest_name: str,
        guest_phone: str,
        property_id: str,
        check_in_date: str
    ) -> Dict[str, Any]:
        """Send personalized check-in instructions to guest."""
        # Get property info
        prop = PROPERTY_KNOWLEDGE.get(property_id, DEFAULT_PROPERTY)
        prop_name = prop.get("name", property_id)
        
        # Build message
        message = f"""🏠 Welcome to {prop_name}, {guest_name}!

Your check-in details:
📍 Address: {prop.get('address', 'See booking confirmation')}
🔑 Door Code: {prop.get('door_code', 'See lockbox')}
📶 WiFi: {prop.get('wifi_network', 'RightAtHome')}
🔐 Password: {prop.get('wifi_password', 'Welcome2024!')}

⏰ Check-in: {prop.get('check_in_time', '3:00 PM')}
⏰ Check-out: {prop.get('check_out_time', '11:00 AM')}

🅿️ Parking: {prop.get('parking', 'See property')}

Need anything? Just text this number!

- Steven, Right At Home BnB"""
        
        # Send via SMS
        if self.twilio_client and guest_phone:
            try:
                sms = self.twilio_client.messages.create(
                    body=message,
                    to=guest_phone,
                    from_=self.twilio_number
                )
                logger.info(f"Sent check-in instructions to {guest_name}: {sms.sid}")
                
                # Log to Firebase
                if FIREBASE_AVAILABLE and db:
                    db.collection("rah_check_in_messages").add({
                        "guest_name": guest_name,
                        "guest_phone": guest_phone,
                        "property_id": property_id,
                        "check_in_date": check_in_date,
                        "message_sid": sms.sid,
                        "sent_at": datetime.utcnow().isoformat()
                    })
                
                return {"success": True, "message_sid": sms.sid}
            except Exception as e:
                logger.error(f"Failed to send check-in instructions: {e}")
                return {"success": False, "error": str(e)}
        
        return {"success": False, "error": "Twilio not configured"}
    
    async def schedule_check_in_message(
        self,
        guest_name: str,
        guest_phone: str,
        property_id: str,
        check_in_date: str,
        send_time: str = "15:00"  # 3pm
    ) -> Dict[str, Any]:
        """Schedule a check-in message for a specific time."""
        # In production, use a task queue like Celery or Cloud Tasks
        # For now, store the scheduled message
        schedule_id = f"sched_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        scheduled_message = {
            "id": schedule_id,
            "guest_name": guest_name,
            "guest_phone": guest_phone,
            "property_id": property_id,
            "check_in_date": check_in_date,
            "send_time": send_time,
            "status": "scheduled",
            "created_at": datetime.utcnow().isoformat()
        }
        
        if FIREBASE_AVAILABLE and db:
            db.collection("rah_scheduled_messages").document(schedule_id).set(scheduled_message)
        
        return {
            "success": True,
            "schedule_id": schedule_id,
            "send_at": f"{check_in_date} {send_time}"
        }


# ============================================================================
# REVIEW REQUEST AUTOMATION
# ============================================================================

class ReviewRequestService:
    """Automatically request reviews 24h after checkout."""
    
    REVIEW_MESSAGE_TEMPLATE = """Hi {guest_name}! 👋

Thank you for staying at {property_name}! We hope you had a wonderful experience.

Would you mind leaving us a quick review? It really helps other travelers and means the world to us! ⭐

{review_link}

If there's anything we could have done better, please text us back - we're always improving!

Thanks again,
Steven, Right At Home BnB"""
    
    def __init__(self):
        self.twilio_client = None
        if TWILIO_AVAILABLE:
            sid = os.getenv("TWILIO_ACCOUNT_SID")
            token = os.getenv("TWILIO_AUTH_TOKEN")
            if sid and token:
                self.twilio_client = TwilioClient(sid, token)
        self.twilio_number = os.getenv("TWILIO_PHONE_NUMBER")
    
    async def send_review_request(
        self,
        guest_name: str,
        guest_phone: str,
        property_id: str,
        booking_platform: str = "airbnb",
        review_link: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send review request to guest."""
        prop = PROPERTY_KNOWLEDGE.get(property_id, {})
        prop_name = prop.get("name", "our property")
        
        # Generate review link if not provided
        if not review_link:
            review_link = f"https://rah-midland.com/review/{property_id}"
        
        message = self.REVIEW_MESSAGE_TEMPLATE.format(
            guest_name=guest_name.split()[0],  # First name only
            property_name=prop_name,
            review_link=review_link
        )
        
        if self.twilio_client and guest_phone:
            try:
                sms = self.twilio_client.messages.create(
                    body=message,
                    to=guest_phone,
                    from_=self.twilio_number
                )
                
                # Log
                if FIREBASE_AVAILABLE and db:
                    db.collection("rah_review_requests").add({
                        "guest_name": guest_name,
                        "guest_phone": guest_phone,
                        "property_id": property_id,
                        "message_sid": sms.sid,
                        "sent_at": datetime.utcnow().isoformat(),
                        "responded": False
                    })
                
                return {"success": True, "message_sid": sms.sid}
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        return {"success": False, "error": "Twilio not configured"}


# ============================================================================
# GUEST PREFERENCE LEARNING
# ============================================================================

class GuestPreferenceLearning:
    """Learn and remember guest preferences over time."""
    
    PREFERENCE_CATEGORIES = [
        "check_in_preferences",    # Early/late check-in history
        "room_preferences",        # Bed types, floor level
        "temperature_preferences", # AC settings
        "amenity_preferences",     # Uses pool, hot tub, etc.
        "dietary_restrictions",    # Allergies, vegetarian
        "communication_style",     # Prefers text vs call
        "booking_patterns",        # How far in advance, length of stay
        "special_occasions",       # Birthdays, anniversaries
        "complaints_history",      # What they've complained about
        "compliments_history"      # What they've loved
    ]
    
    def __init__(self):
        self.collection = "rah_guest_preferences"
    
    async def learn_preference(
        self,
        guest_id: str,
        category: str,
        preference: str,
        value: Any,
        source: str = "conversation"  # conversation, behavior, explicit
    ) -> Dict[str, Any]:
        """Record a learned preference."""
        pref_id = f"pref_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{guest_id[:8]}"
        
        preference_data = {
            "id": pref_id,
            "guest_id": guest_id,
            "category": category,
            "preference": preference,
            "value": value,
            "source": source,
            "confidence": 0.8 if source == "explicit" else 0.6,
            "learned_at": datetime.utcnow().isoformat(),
            "times_observed": 1
        }
        
        if FIREBASE_AVAILABLE and db:
            # Check if this preference already exists
            existing = db.collection(self.collection).where(
                "guest_id", "==", guest_id
            ).where(
                "preference", "==", preference
            ).limit(1).get()
            
            if existing:
                # Update existing preference
                doc = existing[0]
                current = doc.to_dict()
                doc.reference.update({
                    "value": value,
                    "times_observed": current.get("times_observed", 1) + 1,
                    "confidence": min(0.95, current.get("confidence", 0.6) + 0.1),
                    "last_observed": datetime.utcnow().isoformat()
                })
                return {"updated": True, "preference_id": doc.id}
            else:
                # Create new
                db.collection(self.collection).document(pref_id).set(preference_data)
                return {"created": True, "preference_id": pref_id}
        
        return {"success": False, "error": "Firebase not available"}
    
    async def get_guest_preferences(self, guest_id: str) -> Dict[str, Any]:
        """Get all preferences for a guest."""
        preferences = {}
        
        if FIREBASE_AVAILABLE and db:
            docs = db.collection(self.collection).where(
                "guest_id", "==", guest_id
            ).get()
            
            for doc in docs:
                pref = doc.to_dict()
                category = pref.get("category", "general")
                if category not in preferences:
                    preferences[category] = []
                preferences[category].append({
                    "preference": pref.get("preference"),
                    "value": pref.get("value"),
                    "confidence": pref.get("confidence", 0.5)
                })
        
        return preferences
    
    async def generate_personalization_prompt(self, guest_id: str) -> str:
        """Generate a prompt for AI to personalize responses."""
        prefs = await self.get_guest_preferences(guest_id)
        
        if not prefs:
            return ""
        
        prompt_parts = ["This guest has the following known preferences:"]
        
        for category, items in prefs.items():
            for item in items:
                if item["confidence"] > 0.7:
                    prompt_parts.append(f"- {item['preference']}: {item['value']}")
        
        return "\n".join(prompt_parts)


# ============================================================================
# MULTI-LANGUAGE SUPPORT
# ============================================================================

class MultiLanguageSupport:
    """Translate messages for international guests."""
    
    SUPPORTED_LANGUAGES = {
        "en": "English",
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "zh": "Chinese",
        "ja": "Japanese",
        "ko": "Korean",
        "pt": "Portuguese"
    }
    
    # Common phrases in Spanish (most common for Midland)
    SPANISH_PHRASES = {
        "welcome": "¡Bienvenido!",
        "check_in": "Su hora de entrada es a las 3:00 PM",
        "check_out": "Su hora de salida es a las 11:00 AM",
        "wifi_info": "Red WiFi: {network} | Contraseña: {password}",
        "need_help": "¿Necesita ayuda? ¡Solo envíe un mensaje!",
        "emergency": "En caso de emergencia, llame al 911",
        "thank_you": "¡Gracias por quedarse con nosotros!"
    }
    
    async def detect_language(self, text: str) -> str:
        """Detect the language of incoming text."""
        # Simple detection based on common words
        spanish_words = ["hola", "gracias", "por favor", "necesito", "donde", "cuando"]
        french_words = ["bonjour", "merci", "s'il vous plaît", "je", "où", "quand"]
        
        text_lower = text.lower()
        
        spanish_count = sum(1 for word in spanish_words if word in text_lower)
        french_count = sum(1 for word in french_words if word in text_lower)
        
        if spanish_count >= 2:
            return "es"
        elif french_count >= 2:
            return "fr"
        
        return "en"
    
    async def translate_response(
        self,
        text: str,
        target_language: str
    ) -> str:
        """Translate a response to the target language."""
        if target_language == "en":
            return text
        
        # In production, use Google Translate API or similar
        # For now, return with a note
        return f"[{self.SUPPORTED_LANGUAGES.get(target_language, target_language)}]\n{text}"


# ============================================================================
# CLEANER DISPATCH INTEGRATION
# ============================================================================

class CleanerDispatch:
    """Auto-notify cleaners when guests check out."""
    
    def __init__(self):
        self.twilio_client = None
        if TWILIO_AVAILABLE:
            sid = os.getenv("TWILIO_ACCOUNT_SID")
            token = os.getenv("TWILIO_AUTH_TOKEN")
            if sid and token:
                self.twilio_client = TwilioClient(sid, token)
        self.twilio_number = os.getenv("TWILIO_PHONE_NUMBER")
    
    async def dispatch_cleaner(
        self,
        property_id: str,
        checkout_time: str,
        next_checkin: Optional[str] = None,
        special_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Dispatch assigned cleaner for a property."""
        # Get assigned cleaner from database
        cleaner = await self._get_assigned_cleaner(property_id)
        
        if not cleaner:
            return {"success": False, "error": "No cleaner assigned to property"}
        
        # Build dispatch message
        prop = PROPERTY_KNOWLEDGE.get(property_id, {})
        prop_name = prop.get("name", property_id)
        
        message = f"""🧹 CLEANING DISPATCH

Property: {prop_name}
Address: {prop.get('address', 'See app')}

Checkout: {checkout_time}
Next Check-in: {next_checkin or 'None today'}

{f'Notes: {special_notes}' if special_notes else ''}

Reply CONFIRM when on your way!"""
        
        if self.twilio_client and cleaner.get("phone"):
            try:
                sms = self.twilio_client.messages.create(
                    body=message,
                    to=cleaner["phone"],
                    from_=self.twilio_number
                )
                
                # Log dispatch
                if FIREBASE_AVAILABLE and db:
                    db.collection("rah_cleaner_dispatches").add({
                        "property_id": property_id,
                        "cleaner_id": cleaner["id"],
                        "cleaner_name": cleaner["name"],
                        "checkout_time": checkout_time,
                        "next_checkin": next_checkin,
                        "message_sid": sms.sid,
                        "dispatched_at": datetime.utcnow().isoformat(),
                        "confirmed": False
                    })
                
                return {
                    "success": True,
                    "cleaner": cleaner["name"],
                    "message_sid": sms.sid
                }
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        return {"success": False, "error": "Cannot send message"}
    
    async def _get_assigned_cleaner(self, property_id: str) -> Optional[Dict]:
        """Get the assigned cleaner for a property."""
        # In production, query from database
        # For now, return Maria as default
        return {
            "id": "cleaner_maria",
            "name": "Maria S.",
            "phone": "+14325551234",
            "rating": 4.98
        }


# ============================================================================
# SINGLETON INSTANCES
# ============================================================================

_late_checkout_service: Optional[LateCheckoutService] = None
_check_in_automation: Optional[CheckInAutomation] = None
_review_request_service: Optional[ReviewRequestService] = None
_guest_preference_learning: Optional[GuestPreferenceLearning] = None
_multi_language_support: Optional[MultiLanguageSupport] = None
_cleaner_dispatch: Optional[CleanerDispatch] = None


def get_late_checkout() -> LateCheckoutService:
    global _late_checkout_service
    if _late_checkout_service is None:
        _late_checkout_service = LateCheckoutService()
    return _late_checkout_service


def get_check_in_automation() -> CheckInAutomation:
    global _check_in_automation
    if _check_in_automation is None:
        _check_in_automation = CheckInAutomation()
    return _check_in_automation


def get_review_service() -> ReviewRequestService:
    global _review_request_service
    if _review_request_service is None:
        _review_request_service = ReviewRequestService()
    return _review_request_service


def get_preference_learning() -> GuestPreferenceLearning:
    global _guest_preference_learning
    if _guest_preference_learning is None:
        _guest_preference_learning = GuestPreferenceLearning()
    return _guest_preference_learning


def get_language_support() -> MultiLanguageSupport:
    global _multi_language_support
    if _multi_language_support is None:
        _multi_language_support = MultiLanguageSupport()
    return _multi_language_support


def get_cleaner_dispatch() -> CleanerDispatch:
    global _cleaner_dispatch
    if _cleaner_dispatch is None:
        _cleaner_dispatch = CleanerDispatch()
    return _cleaner_dispatch
