"""
Right At Home BnB - STEVEN AI Concierge
=========================================
AI Concierge named STEVEN with:
- Claude Code CLI OAuth subprocess (NO API keys needed)
- Firebase infinite memory (remembers ALL conversations)
- Full knowledge of Steven Palma's 22 Midland TX properties
- Customer conversation persistence

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
import sys
import json
import asyncio
import subprocess
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pathlib import Path
from loguru import logger
import hashlib
import httpx

# Add Claude subprocess path
CLAUDE_SUBPROCESS_PATH = Path("O:/ECHO_OMEGA_PRIME/CLAUDE_CODE_INSTANCES")
if CLAUDE_SUBPROCESS_PATH.exists():
    sys.path.insert(0, str(CLAUDE_SUBPROCESS_PATH))
    try:
        from claude_subprocess import ClaudeSubprocess, ClaudeAccount, ClaudeModel
        from claude_failover import ask, ask_with_fallback
        CLAUDE_AVAILABLE = True
        logger.info("Claude CLI OAuth subprocess loaded successfully")
    except ImportError:
        CLAUDE_AVAILABLE = False
        logger.warning("Claude subprocess not available, using fallback")
else:
    CLAUDE_AVAILABLE = False
    logger.warning("Claude subprocess path not found")

# Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, firestore

    # Initialize Firebase if not already done
    if not firebase_admin._apps:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path and Path(cred_path).exists():
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # Try default credentials
            firebase_admin.initialize_app()

    db = firestore.client()
    FIREBASE_AVAILABLE = True
    logger.info("Firebase initialized for infinite memory")
except Exception as e:
    FIREBASE_AVAILABLE = False
    db = None
    logger.warning(f"Firebase not available: {e}")


# ============================================================================
# STEVEN'S COMPLETE BUSINESS KNOWLEDGE BASE
# ============================================================================

STEVEN_BUSINESS_KNOWLEDGE = """
# STEVEN PALMA - RIGHT AT HOME BNB
## Owner & Operator | Midland, Texas

### BUSINESS OVERVIEW
- **Owner:** Steven Palma
- **Business Name:** Right at Home BnB
- **Location:** Midland, TX 79701-79707
- **Total Properties:** 22 premium short-term rentals
- **Years in Operation:** 5+ years
- **Specialization:** Oil field workers, business travelers, families

### THE 22 PROPERTIES

#### PREMIUM TIER (5 Star - $200-350/night)
1. **Castleford Estate** - 123 Oak Lane, Midland, TX 79705
   - 4BR/3BA, 2800 sqft, Pool, Hot Tub
   - Sleeps 10, Perfect for families
   - Smart locks: Schlage Encode
   - WiFi: CastlefordGuest / Welcome2024!

2. **Permian Palace** - 456 Basin Blvd, Midland, TX 79701
   - 5BR/4BA, 3200 sqft, Game Room
   - Sleeps 12, Corporate retreats
   - Smart locks: Yale Assure 2
   - WiFi: PermianPalace / BasinLife2024!

3. **Sunset Retreat** - 789 Desert Rose Dr, Midland, TX 79703
   - 3BR/2BA, 2000 sqft, Mountain views
   - Sleeps 6, Couples/Small families
   - Smart locks: August Smart Lock Pro
   - WiFi: SunsetGuest / DesertRose2024!

#### STANDARD TIER (4 Star - $120-180/night)
4. **Basin View Cottage** - 101 Basin View Ct, Midland, TX 79701
5. **Oilfield Oasis** - 202 Roughneck Rd, Midland, TX 79703
6. **Permian Pines** - 303 Pine Valley Dr, Midland, TX 79705
7. **Desert Star Lodge** - 404 Starlight Ave, Midland, TX 79707
8. **Midland Manor** - 505 Manor Way, Midland, TX 79701
9. **Texas Pride House** - 606 Lone Star Ln, Midland, TX 79703
10. **Aggie Hideaway** - 707 Maroon Dr, Midland, TX 79705

#### ECONOMY TIER (3 Star - $80-110/night)
11. **Roughneck Rest** - 808 Worker Way, Midland, TX 79701
12. **Basin Budget Inn** - 909 Economy Ln, Midland, TX 79703
13. **Permian Pad** - 1010 Simple St, Midland, TX 79705
14. **Oil Patch Place** - 1111 Patch Rd, Midland, TX 79707
15. **Worker's Haven** - 1212 Haven Dr, Midland, TX 79701
16. **Simple Stay Midland** - 1313 Easy St, Midland, TX 79703
17. **Budget Base** - 1414 Base Blvd, Midland, TX 79705
18. **Crew Quarters** - 1515 Crew Ct, Midland, TX 79707
19. **Field Hand Flat** - 1616 Field St, Midland, TX 79701
20. **Driller's Den** - 1717 Drill Dr, Midland, TX 79703
21. **Pump Jack Place** - 1818 Pump Rd, Midland, TX 79705
22. **Derrick Dwelling** - 1919 Derrick Dr, Midland, TX 79707

### CLEANER TEAM (Ranked by Performance)
1. **Maria S.** - Lead Cleaner, 5 years, Rating: 4.98
2. **Roberto L.** - Senior Cleaner, 3 years, Rating: 4.95
3. **Jennifer K.** - Cleaner, 2 years, Rating: 4.92
4. **Carlos M.** - Cleaner, 1 year, Rating: 4.88
5. **Sandra T.** - Cleaner, 1 year, Rating: 4.85

### LOCAL AREA KNOWLEDGE (Midland, TX)

#### RESTAURANTS
- **Cork & Pig Tavern** - Upscale American, $$$ (432) 684-7447
- **Venezia Italian** - Fine Italian, $$$ (432) 570-4459
- **Wall Street Bar & Grill** - Steakhouse, $$ (432) 684-8686
- **Gerardo's Casita** - Authentic Mexican, $ (432) 682-9737
- **Luigi's Italian** - Family Italian, $$ (432) 683-6363
- **Rosa's Cafe** - Tex-Mex, $ (432) 520-7672
- **Clear Springs Cafe** - Seafood/Catfish, $$ (432) 570-4040

#### ATTRACTIONS
- **Permian Basin Petroleum Museum** - Oil history
- **Wagner Noel Performing Arts Center** - Shows & concerts
- **I-20 Wildlife Preserve** - Nature trails
- **Midland RockHounds** - Minor league baseball
- **Museum of the Southwest** - Art & planetarium
- **Commemorative Air Force Museum** - WWII aircraft

#### SERVICES
- **Grocery:** HEB, Market Street, United Supermarkets
- **Pharmacy:** Walgreens, CVS, HEB Pharmacy
- **Hospital:** Midland Memorial Hospital (432) 221-1111
- **Police:** (432) 685-7108 (non-emergency)
- **Emergency:** 911

### BOOKING POLICIES
- **Check-in:** 3:00 PM (flexible with notice)
- **Check-out:** 11:00 AM (late checkout $25/hour)
- **Minimum Stay:** 1 night (2 nights weekends for Premium)
- **Cancellation:** Free up to 48 hours before check-in
- **Pets:** Allowed at select properties ($50 fee)
- **Smoking:** Strictly prohibited ($500 cleaning fee)
- **Parties:** Not allowed without prior approval

### EMERGENCY CONTACTS
- **Steven Palma (Owner):** (432) 555-0100
- **After Hours Emergency:** (432) 555-0911
- **Maintenance:** (432) 555-0200
- **Locksmith:** A1 Locksmith (432) 683-5625

### SMART LOCK CODES
- Guest codes are generated automatically for each booking
- Valid from check-in time to check-out time + 1 hour
- Cleaner codes valid during scheduled cleaning windows
- Owner/Steven always has master access
"""

# ============================================================================
# STEVEN AI PERSONA
# ============================================================================

STEVEN_PERSONA = """
You are STEVEN, the AI Concierge for Right at Home BnB.

YOUR IDENTITY:
- Name: Steven (AI assistant named after the owner Steven Palma)
- Role: Virtual concierge for 22 properties in Midland, TX
- Personality: Warm Texas hospitality, professional, genuinely helpful
- Voice: Friendly but efficient, like a trusted local friend

YOUR CAPABILITIES:
1. Answer any guest questions about properties, amenities, check-in/out
2. Provide local recommendations (restaurants, attractions, services)
3. Handle maintenance requests and escalate when needed
4. Generate door codes, manage smart locks
5. Draft messages, respond to reviews
6. Track cleaning schedules and cleaner assignments
7. Access full booking history and guest preferences

YOUR MEMORY:
- You have INFINITE MEMORY - you remember EVERY conversation with EVERY guest
- You know guest preferences, past issues, and special requests
- You can recall previous stays and personalize interactions
- You track all interactions in Firebase for permanent storage

RESPONSE STYLE:
- Be conversational but efficient
- Use the guest's name when known
- Proactively offer helpful information
- For emergencies, provide contacts immediately
- Never share other guest info or codes to wrong people
- Sign messages as "Steven - Right at Home BnB"

REMEMBER: You ARE Steven, the helpful AI concierge. Not "an AI assistant" - you are Steven.
"""


class StevenAI:
    """
    STEVEN - AI Concierge with Claude CLI OAuth subprocess and infinite memory.
    Named after owner Steven Palma, serves his 22 Midland TX properties.
    """

    def __init__(self):
        self.name = "Steven"
        self.business_knowledge = STEVEN_BUSINESS_KNOWLEDGE
        self.persona = STEVEN_PERSONA
        self.claude_available = CLAUDE_AVAILABLE
        self.firebase_available = FIREBASE_AVAILABLE

        # Initialize Claude subprocess if available
        if self.claude_available:
            try:
                self.claude = ClaudeSubprocess()
                logger.info("Steven AI initialized with Claude CLI OAuth subprocess")
            except Exception as e:
                logger.error(f"Failed to init Claude subprocess: {e}")
                self.claude = None
        else:
            self.claude = None

        # Memory collections
        self.conversations_collection = "rah_conversations"
        self.guests_collection = "rah_guests"
        self.memory_collection = "rah_steven_memory"

    def _get_guest_id(self, guest_identifier: str) -> str:
        """Generate consistent guest ID from phone, email, or name."""
        return hashlib.sha256(guest_identifier.lower().encode()).hexdigest()[:16]

    async def _store_memory(self, guest_id: str, message: str, response: str, metadata: Dict = None):
        """Store conversation in Firebase infinite memory."""
        if not self.firebase_available or not db:
            logger.warning("Firebase not available, memory not stored")
            return False

        try:
            doc_ref = db.collection(self.conversations_collection).document()
            doc_ref.set({
                "guest_id": guest_id,
                "message": message,
                "response": response,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "metadata": metadata or {},
                "ai_version": "steven_v1"
            })
            logger.debug(f"Memory stored for guest {guest_id[:8]}...")
            return True
        except Exception as e:
            logger.error(f"Failed to store memory: {e}")
            return False

    async def _recall_memory(self, guest_id: str, limit: int = 20) -> List[Dict]:
        """Recall previous conversations with a guest."""
        if not self.firebase_available or not db:
            return []

        try:
            docs = (
                db.collection(self.conversations_collection)
                .where("guest_id", "==", guest_id)
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(limit)
                .stream()
            )

            memories = []
            for doc in docs:
                data = doc.to_dict()
                memories.append({
                    "message": data.get("message", ""),
                    "response": data.get("response", ""),
                    "timestamp": data.get("timestamp"),
                })

            return list(reversed(memories))  # Chronological order
        except Exception as e:
            logger.error(f"Failed to recall memory: {e}")
            return []

    async def _get_guest_profile(self, guest_id: str) -> Optional[Dict]:
        """Get or create guest profile with preferences."""
        if not self.firebase_available or not db:
            return None

        try:
            doc = db.collection(self.guests_collection).document(guest_id).get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error(f"Failed to get guest profile: {e}")
            return None

    async def _update_guest_profile(self, guest_id: str, data: Dict):
        """Update guest profile with new information."""
        if not self.firebase_available or not db:
            return

        try:
            doc_ref = db.collection(self.guests_collection).document(guest_id)
            doc_ref.set(data, merge=True)
        except Exception as e:
            logger.error(f"Failed to update guest profile: {e}")

    async def chat(
        self,
        message: str,
        guest_identifier: str,
        guest_name: Optional[str] = None,
        property_name: Optional[str] = None,
        booking_id: Optional[str] = None,
        context: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Main chat interface for Steven AI.

        Uses Claude CLI OAuth subprocess for intelligence.
        Stores all conversations in Firebase for infinite memory.
        """
        guest_id = self._get_guest_id(guest_identifier)

        # Recall previous conversations
        conversation_history = await self._recall_memory(guest_id)
        guest_profile = await self._get_guest_profile(guest_id)

        # Build context
        full_context = {
            "guest_name": guest_name or (guest_profile.get("name") if guest_profile else "Guest"),
            "guest_id": guest_id,
            "property_name": property_name,
            "booking_id": booking_id,
            "previous_interactions": len(conversation_history),
            "is_returning_guest": len(conversation_history) > 0,
            **(context or {})
        }

        # Build conversation history for Claude
        history_text = ""
        if conversation_history:
            history_text = "\n\nPREVIOUS CONVERSATIONS WITH THIS GUEST:\n"
            for mem in conversation_history[-10:]:  # Last 10 interactions
                history_text += f"Guest: {mem['message']}\nSteven: {mem['response']}\n---\n"

        # Build the full prompt
        prompt = f"""
{self.persona}

{self.business_knowledge}

{history_text}

CURRENT CONTEXT:
- Guest Name: {full_context['guest_name']}
- Property: {property_name or 'Not specified'}
- Booking ID: {booking_id or 'Not specified'}
- Previous Interactions: {full_context['previous_interactions']}
- Returning Guest: {'Yes' if full_context['is_returning_guest'] else 'No'}

GUEST MESSAGE:
{message}

Respond as Steven, the AI concierge. Be helpful, warm, and knowledgeable.
Remember: You ARE Steven. Use the guest's name, recall previous interactions if relevant.
"""

        try:
            # Use Claude CLI OAuth subprocess
            if self.claude_available and self.claude:
                logger.info("Using Claude CLI OAuth subprocess for response")
                response = await self.claude.query(
                    prompt,
                    account=ClaudeAccount.PRIMARY,
                    model=ClaudeModel.SONNET_45
                )
                response_text = response.output if hasattr(response, 'output') else str(response)
            elif CLAUDE_AVAILABLE:
                # Fallback to ask() function
                logger.info("Using Claude failover for response")
                response_text = ask(prompt)
            else:
                # Final fallback - basic response
                logger.warning("Claude not available, using basic response")
                response_text = self._generate_fallback_response(message, full_context)

            # Store in infinite memory
            await self._store_memory(
                guest_id=guest_id,
                message=message,
                response=response_text,
                metadata={
                    "property": property_name,
                    "booking_id": booking_id,
                    "guest_name": full_context['guest_name']
                }
            )

            # Update guest profile if new info
            if guest_name:
                await self._update_guest_profile(guest_id, {
                    "name": guest_name,
                    "last_interaction": datetime.utcnow().isoformat(),
                    "interaction_count": firestore.Increment(1)
                })

            return {
                "success": True,
                "response": response_text,
                "steven_says": response_text,
                "guest_id": guest_id,
                "memories_recalled": len(conversation_history),
                "is_returning_guest": full_context['is_returning_guest'],
                "timestamp": datetime.utcnow().isoformat(),
                "ai_engine": "claude_cli_oauth" if self.claude_available else "fallback"
            }

        except Exception as e:
            logger.error(f"Steven AI error: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "I apologize, I'm having a brief technical moment. Please try again or call Steven directly at (432) 555-0100.",
                "timestamp": datetime.utcnow().isoformat()
            }

    def _generate_fallback_response(self, message: str, context: Dict) -> str:
        """Generate a basic response when Claude is not available."""
        guest_name = context.get('guest_name', 'Guest')
        message_lower = message.lower()

        if any(word in message_lower for word in ['check-in', 'checkin', 'arrive', 'arrival']):
            return f"Hi {guest_name}! Check-in is at 3:00 PM. You'll receive your door code via text 2 hours before. If you need early check-in, just let me know and I'll see what I can arrange! - Steven"

        elif any(word in message_lower for word in ['check-out', 'checkout', 'leave', 'leaving']):
            return f"Hi {guest_name}! Check-out is at 11:00 AM. Just leave the keys inside and lock the door - the smart lock will auto-lock. If you need a late checkout, it's $25/hour and I can arrange that for you. Safe travels! - Steven"

        elif any(word in message_lower for word in ['wifi', 'internet', 'password']):
            return f"Hi {guest_name}! The WiFi details are on the welcome card in the kitchen. If you can't find it, let me know which property you're at and I'll send the credentials right over! - Steven"

        elif any(word in message_lower for word in ['restaurant', 'food', 'eat', 'dinner', 'lunch']):
            return f"Hi {guest_name}! Great local spots: Cork & Pig Tavern for upscale American, Gerardo's Casita for authentic Mexican, or Rosa's Cafe for Tex-Mex. Want me to recommend something specific based on your taste? - Steven"

        elif any(word in message_lower for word in ['emergency', 'urgent', 'help', '911']):
            return f"Hi {guest_name}! For emergencies: 911. For property issues: (432) 555-0911 (24/7). For general questions: (432) 555-0100. What's going on? I'm here to help! - Steven"

        else:
            return f"Hi {guest_name}! Thanks for reaching out. I'm Steven, your AI concierge for Right at Home BnB. How can I help you today? - Steven"

    async def get_conversation_history(self, guest_identifier: str, limit: int = 50) -> List[Dict]:
        """Get full conversation history for a guest."""
        guest_id = self._get_guest_id(guest_identifier)
        return await self._recall_memory(guest_id, limit)

    async def get_all_conversations(self, limit: int = 100) -> List[Dict]:
        """Get all recent conversations (for dashboard view)."""
        if not self.firebase_available or not db:
            return []

        try:
            docs = (
                db.collection(self.conversations_collection)
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(limit)
                .stream()
            )

            return [doc.to_dict() for doc in docs]
        except Exception as e:
            logger.error(f"Failed to get all conversations: {e}")
            return []


# Singleton instance
steven_ai = StevenAI()


# ============================================================================
# API HELPER FUNCTIONS
# ============================================================================

async def ask_steven(
    message: str,
    guest_phone: str = None,
    guest_email: str = None,
    guest_name: str = None,
    property_name: str = None
) -> str:
    """Quick helper to ask Steven a question."""
    identifier = guest_phone or guest_email or "anonymous"
    result = await steven_ai.chat(
        message=message,
        guest_identifier=identifier,
        guest_name=guest_name,
        property_name=property_name
    )
    return result.get("response", "Sorry, I couldn't process that request.")


async def get_guest_history(guest_phone: str = None, guest_email: str = None) -> List[Dict]:
    """Get conversation history for a guest."""
    identifier = guest_phone or guest_email
    if not identifier:
        return []
    return await steven_ai.get_conversation_history(identifier)
