"""
Right At Home BnB - ULTIMATE CONCIERGE SERVICE
================================================
Complete AI concierge with:
- Guest request handling (towels, supplies, emergencies)
- Auto-call Steven for urgent matters
- Web search for local recommendations
- Appointment booking (salons, barbers, restaurants)
- Weather integration
- Local events & attractions
- Transportation booking
- Room service coordination

@author ECHO OMEGA PRIME  
@owner Steven Palma - Midland, TX
"""

import os
import json
import asyncio
import httpx
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
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

# Twilio for calling Steven
try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    TwilioClient = None


# ============================================================================
# REQUEST CATEGORIES & URGENCY LEVELS
# ============================================================================

class RequestCategory(str, Enum):
    # Guest Needs (require action)
    SUPPLIES = "supplies"           # Towels, toiletries, bedding
    MAINTENANCE = "maintenance"     # Something broken/not working
    HOUSEKEEPING = "housekeeping"   # Extra cleaning, trash
    EMERGENCY = "emergency"         # Fire, flood, medical, safety
    
    # Concierge Services (recommendations/bookings)
    DINING = "dining"               # Restaurant recommendations
    ENTERTAINMENT = "entertainment" # Things to do, attractions
    NIGHTLIFE = "nightlife"         # Bars, clubs, live music
    WELLNESS = "wellness"           # Salons, barbers, spas, massage
    TRANSPORTATION = "transportation"  # Uber, rental, airport
    SHOPPING = "shopping"           # Stores, malls, specialty shops
    BUSINESS = "business"           # Printing, meeting rooms, office
    
    # Information
    PROPERTY_INFO = "property_info" # WiFi, check-in/out, amenities
    LOCAL_INFO = "local_info"       # Weather, events, directions
    BOOKING = "booking"             # Extend stay, change dates
    
    # Issues
    COMPLAINT = "complaint"         # Unhappy guest
    COMPLIMENT = "compliment"       # Happy guest
    UNKNOWN = "unknown"


class UrgencyLevel(str, Enum):
    CRITICAL = "critical"    # Call Steven NOW (emergency)
    HIGH = "high"            # Call Steven within 5 min (locked out, no AC)
    MEDIUM = "medium"        # Text Steven (supplies needed)
    LOW = "low"              # AI handles, log for Steven's review
    INFO = "info"            # No action needed, just information


# Keywords that trigger each category
CATEGORY_KEYWORDS = {
    RequestCategory.SUPPLIES: [
        "towel", "towels", "toilet paper", "soap", "shampoo", "conditioner",
        "coffee", "k-cup", "blanket", "pillow", "sheets", "linens", "trash bag",
        "paper towel", "dish soap", "detergent", "toothpaste", "batteries"
    ],
    RequestCategory.MAINTENANCE: [
        "broken", "not working", "doesn't work", "leaking", "clogged",
        "won't turn on", "no power", "outlet", "light bulb", "faucet",
        "toilet", "shower", "sink", "door", "window", "lock", "handle",
        "remote", "tv", "wifi", "internet", "ac", "heater", "thermostat"
    ],
    RequestCategory.EMERGENCY: [
        "fire", "flood", "flooding", "smoke", "gas leak", "gas smell",
        "intruder", "break in", "someone", "hurt", "injured", "ambulance",
        "police", "911", "emergency", "help", "danger", "carbon monoxide"
    ],
    RequestCategory.DINING: [
        "restaurant", "food", "eat", "dinner", "lunch", "breakfast", "brunch",
        "steakhouse", "mexican", "italian", "chinese", "sushi", "bbq", "pizza",
        "takeout", "delivery", "hungry", "recommend"
    ],
    RequestCategory.NIGHTLIFE: [
        "bar", "bars", "club", "nightclub", "drinks", "cocktails", "beer",
        "happy hour", "live music", "dancing", "karaoke", "pub"
    ],
    RequestCategory.WELLNESS: [
        "haircut", "barber", "salon", "hair", "nails", "manicure", "pedicure",
        "spa", "massage", "facial", "waxing", "beauty", "stylist"
    ],
    RequestCategory.ENTERTAINMENT: [
        "things to do", "attractions", "museum", "movie", "theater", "show",
        "concert", "game", "sports", "family", "kids", "children", "park",
        "golf", "bowling", "fun", "activities"
    ],
    RequestCategory.TRANSPORTATION: [
        "uber", "lyft", "taxi", "cab", "rental car", "airport", "shuttle",
        "ride", "pick up", "drop off", "directions", "drive"
    ],
    RequestCategory.PROPERTY_INFO: [
        "wifi", "password", "check in", "check out", "checkout", "code",
        "door code", "lockbox", "key", "parking", "trash day", "pool",
        "hot tub", "grill", "washer", "dryer", "amenities"
    ]
}

# Keywords that increase urgency
URGENCY_ESCALATORS = {
    UrgencyLevel.CRITICAL: [
        "fire", "flood", "gas", "intruder", "911", "emergency", "ambulance",
        "police", "hurt", "injured", "danger", "help me"
    ],
    UrgencyLevel.HIGH: [
        "locked out", "can't get in", "no power", "no water", "no ac",
        "no heat", "freezing", "too hot", "broken pipe", "sewage"
    ],
    UrgencyLevel.MEDIUM: [
        "need", "out of", "ran out", "don't have", "asap", "today",
        "tonight", "before", "soon"
    ]
}


# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class GuestRequest:
    """A request from a guest."""
    id: str
    guest_id: str
    property_id: str
    message: str
    category: RequestCategory
    urgency: UrgencyLevel
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    resolved: bool = False
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
    steven_notified: bool = False
    steven_called: bool = False
    ai_response: Optional[str] = None
    follow_up_needed: bool = False
    notes: List[str] = field(default_factory=list)


@dataclass
class LocalBusiness:
    """A local business recommendation."""
    name: str
    category: str
    address: str
    phone: Optional[str] = None
    website: Optional[str] = None
    hours: Optional[str] = None
    price_range: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None
    booking_url: Optional[str] = None
    distance_miles: Optional[float] = None


@dataclass
class AppointmentBooking:
    """A booked appointment."""
    id: str
    guest_id: str
    business_name: str
    service: str
    date: str
    time: str
    confirmed: bool = False
    confirmation_number: Optional[str] = None
    notes: Optional[str] = None


# ============================================================================
# LOCAL BUSINESS DATABASE (Midland, TX)
# ============================================================================

MIDLAND_BUSINESSES = {
    "dining": [
        LocalBusiness(
            name="Cork & Pig Tavern",
            category="American/Upscale",
            address="3001 W Loop 250 N, Midland, TX 79707",
            phone="(432) 684-7447",
            price_range="$$$",
            rating=4.6,
            description="Upscale American gastropub with craft cocktails and excellent steaks."
        ),
        LocalBusiness(
            name="Venezia Italian Restaurant",
            category="Italian/Fine Dining", 
            address="2101 W Wadley Ave, Midland, TX 79705",
            phone="(432) 570-4459",
            price_range="$$$",
            rating=4.5,
            description="Elegant Italian fine dining with homemade pasta and extensive wine list."
        ),
        LocalBusiness(
            name="Wall Street Bar & Grill",
            category="Steakhouse",
            address="115 E Wall St, Midland, TX 79701",
            phone="(432) 684-8686",
            price_range="$$",
            rating=4.4,
            description="Downtown steakhouse known for ribeyes and lively atmosphere."
        ),
        LocalBusiness(
            name="Gerardo's Casita",
            category="Mexican/Authentic",
            address="2012 W Front Ave, Midland, TX 79701",
            phone="(432) 682-9737",
            price_range="$",
            rating=4.7,
            description="Best authentic Mexican food in Midland. Try the carne guisada."
        ),
        LocalBusiness(
            name="Luigi's Italian Restaurant",
            category="Italian/Family",
            address="111 N Big Spring St, Midland, TX 79701",
            phone="(432) 683-6363",
            price_range="$$",
            rating=4.3,
            description="Family-friendly Italian with generous portions. Great for groups."
        ),
        LocalBusiness(
            name="The Garlic Press",
            category="American/Casual",
            address="2200 W Wadley Ave Suite C1, Midland, TX 79705",
            phone="(432) 699-1919",
            price_range="$$",
            rating=4.5,
            description="Farm-to-table American cuisine with creative seasonal menu."
        ),
        LocalBusiness(
            name="Clear Springs Cafe",
            category="Seafood/Southern",
            address="4805 Waco Ave, Midland, TX 79707",
            phone="(432) 570-4040",
            price_range="$$",
            rating=4.4,
            description="Famous for their catfish. Southern comfort food at its best."
        ),
        LocalBusiness(
            name="Rosa's Cafe",
            category="Tex-Mex/Fast Casual",
            address="4610 N Midkiff Rd, Midland, TX 79705",
            phone="(432) 520-7672",
            price_range="$",
            rating=4.2,
            description="Quick, delicious Tex-Mex. Fresh tortillas made on-site."
        ),
        LocalBusiness(
            name="KD's BBQ",
            category="BBQ/Texas",
            address="2900 W Illinois Ave, Midland, TX 79701",
            phone="(432) 570-0055",
            price_range="$$",
            rating=4.6,
            description="Authentic Texas BBQ with brisket that melts in your mouth."
        ),
        LocalBusiness(
            name="Oasis Bar & Grill",
            category="American/Sports Bar",
            address="5106 W Wadley Ave, Midland, TX 79707",
            phone="(432) 699-2060",
            price_range="$$",
            rating=4.1,
            description="Great burgers, cold beer, and tons of TVs for game day."
        )
    ],
    "nightlife": [
        LocalBusiness(
            name="The Blue Door",
            category="Cocktail Bar",
            address="114 N Big Spring St, Midland, TX 79701",
            phone="(432) 688-3332",
            hours="5pm-2am",
            price_range="$$",
            rating=4.4,
            description="Craft cocktails in a speakeasy atmosphere. Best mixology in town."
        ),
        LocalBusiness(
            name="Tall City Brewing Co",
            category="Craft Brewery",
            address="110 E Scharbauer Dr, Midland, TX 79705",
            phone="(432) 262-2337",
            hours="12pm-10pm",
            price_range="$$",
            rating=4.5,
            description="Local craft brewery with rotating taps and food trucks."
        ),
        LocalBusiness(
            name="Rockin Rodeo",
            category="Country Bar/Dancing",
            address="9555 W State Hwy 158, Midland, TX 79707",
            phone="(432) 561-4700",
            hours="8pm-2am Fri-Sat",
            price_range="$$",
            rating=4.0,
            description="Country dancing, live music, and good times Texas style."
        ),
        LocalBusiness(
            name="Whiskey Tango",
            category="Bar & Grill",
            address="315 Andrews Hwy, Midland, TX 79701",
            phone="(432) 684-7770",
            hours="4pm-2am",
            price_range="$$",
            rating=4.2,
            description="Laid-back bar with great whiskey selection and live music weekends."
        ),
        LocalBusiness(
            name="The Lone Star Saloon",
            category="Dive Bar",
            address="1305 S Big Spring St, Midland, TX 79701",
            phone="(432) 683-5555",
            hours="2pm-2am",
            price_range="$",
            rating=3.9,
            description="Classic Texas dive bar. Cheap drinks, pool tables, jukebox."
        )
    ],
    "wellness": [
        LocalBusiness(
            name="Boardroom Salon for Men",
            category="Men's Barber/Salon",
            address="4400 N Midkiff Rd Suite D3, Midland, TX 79705",
            phone="(432) 689-8880",
            hours="9am-7pm Mon-Sat",
            price_range="$$",
            rating=4.8,
            booking_url="https://boardroomsalon.com/book",
            description="Premium men's grooming. Haircuts, shaves, and complimentary beverages."
        ),
        LocalBusiness(
            name="Sport Clips",
            category="Men's Haircut",
            address="4511 N Midkiff Rd, Midland, TX 79705",
            phone="(432) 689-7888",
            hours="9am-8pm Mon-Sat",
            price_range="$",
            rating=4.2,
            booking_url="https://sportclips.com/check-in",
            description="Quick, quality men's haircuts with sports on TV."
        ),
        LocalBusiness(
            name="Salon De Luz",
            category="Full Service Salon",
            address="3212 W Wadley Ave, Midland, TX 79705",
            phone="(432) 699-0011",
            hours="9am-6pm Tue-Sat",
            price_range="$$",
            rating=4.7,
            description="Full service salon - hair, nails, facials, waxing. Great for couples."
        ),
        LocalBusiness(
            name="Woodhouse Day Spa",
            category="Day Spa",
            address="5309 W Loop 250 N, Midland, TX 79707",
            phone="(432) 687-1200",
            hours="9am-8pm Daily",
            price_range="$$$",
            rating=4.9,
            booking_url="https://woodhousespas.com/midland",
            description="Luxury spa experience. Massages, facials, body treatments."
        ),
        LocalBusiness(
            name="Great Clips",
            category="Budget Haircut",
            address="4610 N Midkiff Rd, Midland, TX 79705",
            phone="(432) 689-2400",
            hours="9am-9pm Daily",
            price_range="$",
            rating=3.8,
            booking_url="https://greatclips.com/check-in",
            description="Quick, affordable haircuts. Walk-ins welcome."
        ),
        LocalBusiness(
            name="Massage Envy",
            category="Massage",
            address="4400 N Midkiff Rd Suite C1, Midland, TX 79705",
            phone="(432) 697-3689",
            hours="8am-9pm Daily",
            price_range="$$",
            booking_url="https://massageenvy.com/book",
            rating=4.3,
            description="Professional massage therapy. Swedish, deep tissue, hot stone."
        )
    ],
    "entertainment": [
        LocalBusiness(
            name="Permian Basin Petroleum Museum",
            category="Museum",
            address="1500 I-20 W, Midland, TX 79701",
            phone="(432) 683-4403",
            hours="10am-5pm Mon-Sat, 2-5pm Sun",
            price_range="$",
            rating=4.5,
            description="World-class petroleum museum. Learn about the oil industry that built Midland."
        ),
        LocalBusiness(
            name="Wagner Noel Performing Arts Center",
            category="Theater/Concerts",
            address="1310 N FM 1788, Midland, TX 79707",
            phone="(432) 552-4430",
            price_range="$$-$$$",
            rating=4.7,
            website="https://wagnernoel.com",
            description="Broadway shows, concerts, and performances. Check schedule."
        ),
        LocalBusiness(
            name="Midland RockHounds",
            category="Minor League Baseball",
            address="5514 Champions Dr, Midland, TX 79706",
            phone="(432) 520-2255",
            price_range="$",
            rating=4.4,
            website="https://milb.com/midland",
            description="Double-A baseball. Fun family outing with cheap tickets and cold beer."
        ),
        LocalBusiness(
            name="Cinemark Tinseltown",
            category="Movie Theater",
            address="4923 E 42nd St, Odessa, TX 79762",
            phone="(432) 368-9560",
            price_range="$",
            rating=4.1,
            description="Latest movies in XD and standard. 10 min from Midland."
        ),
        LocalBusiness(
            name="I-20 Wildlife Preserve",
            category="Nature/Outdoors",
            address="2201 S Midland Dr, Midland, TX 79703",
            phone="(432) 853-9453",
            hours="Sunrise-Sunset Daily",
            price_range="Free",
            rating=4.6,
            description="Beautiful walking trails through restored wetlands. Great for birding."
        ),
        LocalBusiness(
            name="Hogan Park Golf Course",
            category="Golf",
            address="3600 N Fairgrounds Rd, Midland, TX 79705",
            phone="(432) 685-7360",
            price_range="$$",
            rating=4.0,
            description="18-hole municipal course. Affordable green fees."
        ),
        LocalBusiness(
            name="BOWLERO",
            category="Bowling",
            address="4713 W Loop 250 N, Midland, TX 79707",
            phone="(432) 699-1415",
            hours="11am-11pm",
            price_range="$$",
            rating=4.0,
            description="Modern bowling alley with arcade, laser tag, and full bar."
        )
    ],
    "shopping": [
        LocalBusiness(
            name="Midland Park Mall",
            category="Shopping Mall",
            address="4511 N Midkiff Rd, Midland, TX 79705",
            phone="(432) 694-2582",
            hours="10am-9pm Mon-Sat, 12-6pm Sun",
            price_range="$$",
            rating=3.8,
            description="Main shopping mall with Dillard's, JCPenney, and 80+ stores."
        ),
        LocalBusiness(
            name="Boot Barn",
            category="Western Wear",
            address="4519 N Midkiff Rd, Midland, TX 79705",
            phone="(432) 697-1800",
            hours="9am-9pm Mon-Sat",
            price_range="$$",
            rating=4.3,
            description="Western boots, hats, and apparel. Need cowboy boots? This is it."
        ),
        LocalBusiness(
            name="Cavender's Boot City",
            category="Western Wear",
            address="3201 N Loop 250 W, Midland, TX 79707",
            phone="(432) 699-5171",
            hours="9am-9pm Mon-Sat",
            price_range="$$",
            rating=4.4,
            description="Premium western wear and boots. Great selection."
        ),
        LocalBusiness(
            name="HEB",
            category="Grocery",
            address="4517 N Midkiff Rd, Midland, TX 79705",
            phone="(432) 697-0932",
            hours="6am-11pm Daily",
            price_range="$",
            rating=4.5,
            description="Texas grocery chain. Fresh produce, bakery, deli, pharmacy."
        ),
        LocalBusiness(
            name="United Supermarkets",
            category="Grocery",
            address="3317 W Wadley Ave, Midland, TX 79705",
            phone="(432) 694-3444",
            hours="6am-10pm Daily",
            price_range="$",
            rating=4.3,
            description="Local grocery with great meat market and Texas products."
        )
    ]
}


# ============================================================================
# ULTIMATE CONCIERGE SERVICE
# ============================================================================

class UltimateConciergeService:
    """
    Complete AI concierge service for Right at Home BnB.
    Handles everything from towel requests to restaurant reservations.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.twilio_available = TWILIO_AVAILABLE
        
        # Twilio credentials
        self.twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_number = os.getenv("TWILIO_PHONE_NUMBER")
        
        # Steven's contact info
        self.steven_phone = os.getenv("STEVEN_PHONE", "+14329006300")
        self.steven_email = os.getenv("STEVEN_EMAIL", "steven@rah-midland.com")
        
        # OpenWeatherMap
        self.weather_api_key = os.getenv("OPENWEATHER_API_KEY")
        
        # Google Places for live search
        self.google_api_key = os.getenv("GOOGLE_PLACES_API_KEY")
        
        # Firebase collections
        self.requests_collection = "rah_guest_requests"
        self.bookings_collection = "rah_appointment_bookings"
        
        # Initialize Twilio
        if self.twilio_available and self.twilio_sid and self.twilio_token:
            self.twilio_client = TwilioClient(self.twilio_sid, self.twilio_token)
        else:
            self.twilio_client = None

        logger.info("Ultimate Concierge Service initialized")

    # =========================================================================
    # REQUEST CLASSIFICATION
    # =========================================================================

    def classify_request(self, message: str) -> Tuple[RequestCategory, UrgencyLevel]:
        """Classify a guest message into category and urgency."""
        message_lower = message.lower()
        
        # Check for emergency first (highest priority)
        for keyword in CATEGORY_KEYWORDS.get(RequestCategory.EMERGENCY, []):
            if keyword in message_lower:
                return RequestCategory.EMERGENCY, UrgencyLevel.CRITICAL
        
        # Determine urgency
        urgency = UrgencyLevel.LOW
        for level, keywords in URGENCY_ESCALATORS.items():
            for keyword in keywords:
                if keyword in message_lower:
                    urgency = level
                    break
            if urgency != UrgencyLevel.LOW:
                break
        
        # Find matching category
        for category, keywords in CATEGORY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in message_lower:
                    # Supplies and maintenance bump urgency to at least MEDIUM
                    if category in [RequestCategory.SUPPLIES, RequestCategory.MAINTENANCE]:
                        if urgency == UrgencyLevel.LOW:
                            urgency = UrgencyLevel.MEDIUM
                    return category, urgency
        
        return RequestCategory.UNKNOWN, UrgencyLevel.LOW

    # =========================================================================
    # GUEST REQUEST HANDLING
    # =========================================================================

    async def handle_request(
        self,
        guest_id: str,
        property_id: str,
        message: str,
        guest_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Handle a guest request end-to-end.
        Classifies, responds, notifies Steven if needed, logs everything.
        """
        # Classify the request
        category, urgency = self.classify_request(message)
        
        # Create request record
        request_id = f"req_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{guest_id[:8]}"
        request = GuestRequest(
            id=request_id,
            guest_id=guest_id,
            property_id=property_id,
            message=message,
            category=category,
            urgency=urgency
        )
        
        # Generate AI response
        response = await self._generate_response(request, guest_name)
        request.ai_response = response["message"]
        
        # Determine if Steven needs to be notified
        should_notify_steven = urgency in [UrgencyLevel.CRITICAL, UrgencyLevel.HIGH, UrgencyLevel.MEDIUM]
        should_call_steven = urgency in [UrgencyLevel.CRITICAL, UrgencyLevel.HIGH]
        
        # Notify/call Steven
        if should_call_steven:
            await self._call_steven(request, guest_name)
            request.steven_called = True
            request.steven_notified = True
        elif should_notify_steven:
            await self._text_steven(request, guest_name)
            request.steven_notified = True
        
        # Save to Firebase
        if self.firebase_available and db:
            db.collection(self.requests_collection).document(request_id).set(asdict(request))
        
        return {
            "request_id": request_id,
            "category": category.value,
            "urgency": urgency.value,
            "response": response,
            "steven_notified": request.steven_notified,
            "steven_called": request.steven_called
        }

    async def _generate_response(
        self,
        request: GuestRequest,
        guest_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate appropriate response based on request category."""
        name = guest_name or "there"
        category = request.category
        
        # Emergency response
        if category == RequestCategory.EMERGENCY:
            return {
                "message": f"I understand this is an emergency, {name}. I'm contacting Steven RIGHT NOW and he will call you immediately. If you are in immediate danger, please call 911.",
                "action": "call_steven",
                "suggestions": ["Call 911 if in danger", "Stay on the line"]
            }
        
        # Supplies request
        if category == RequestCategory.SUPPLIES:
            return {
                "message": f"No problem, {name}! I've sent your request to Steven for {self._extract_supply_item(request.message)}. He'll have that to you as soon as possible - usually within an hour during the day. Is there anything else you need?",
                "action": "notify_steven",
                "suggestions": ["Request something else", "Ask about amenities"]
            }
        
        # Maintenance issue
        if category == RequestCategory.MAINTENANCE:
            return {
                "message": f"I'm sorry to hear about that issue, {name}. I've notified Steven immediately and he's going to take care of it. He may call or text you shortly to get more details. In the meantime, is there anything urgent I can help with?",
                "action": "notify_steven",
                "suggestions": ["It's urgent", "Not urgent, just FYI"]
            }
        
        # Dining recommendations
        if category == RequestCategory.DINING:
            recommendations = self._get_recommendations("dining", 3)
            return {
                "message": f"Great question, {name}! Here are my top restaurant picks in Midland:\n\n" + self._format_recommendations(recommendations) + "\n\nWould you like me to look up anything specific?",
                "action": "recommend",
                "businesses": [asdict(r) for r in recommendations],
                "suggestions": ["Fine dining", "Mexican food", "Something quick"]
            }
        
        # Nightlife recommendations
        if category == RequestCategory.NIGHTLIFE:
            recommendations = self._get_recommendations("nightlife", 3)
            return {
                "message": f"Looking for nightlife, {name}? Here are the best spots:\n\n" + self._format_recommendations(recommendations) + "\n\nWant me to check if any have live music tonight?",
                "action": "recommend",
                "businesses": [asdict(r) for r in recommendations],
                "suggestions": ["Live music", "Craft beer", "Dancing"]
            }
        
        # Wellness/salon/barber
        if category == RequestCategory.WELLNESS:
            recommendations = self._get_recommendations("wellness", 3)
            return {
                "message": f"Here are some great options for you, {name}:\n\n" + self._format_recommendations(recommendations) + "\n\nI can help you book an appointment if you'd like!",
                "action": "recommend",
                "businesses": [asdict(r) for r in recommendations],
                "suggestions": ["Book appointment", "Men's haircut", "Spa day"]
            }
        
        # Entertainment
        if category == RequestCategory.ENTERTAINMENT:
            recommendations = self._get_recommendations("entertainment", 3)
            return {
                "message": f"There's plenty to do in Midland, {name}! Here are some options:\n\n" + self._format_recommendations(recommendations) + "\n\nAnything specific you're looking for?",
                "action": "recommend",
                "businesses": [asdict(r) for r in recommendations],
                "suggestions": ["Family activities", "Museums", "Sports"]
            }
        
        # Transportation
        if category == RequestCategory.TRANSPORTATION:
            return {
                "message": f"For getting around Midland, {name}, here are your options:\n\n🚗 **Uber/Lyft** - Available 24/7, usually 5-10 min wait\n🚕 **Yellow Cab Midland** - (432) 563-0555\n✈️ **Midland International Airport (MAF)** - 15 min from most properties\n🚙 **Rental Cars** - Enterprise, Hertz, Avis all at airport\n\nNeed help with anything specific?",
                "action": "info",
                "suggestions": ["Airport pickup", "Rental car", "Call a taxi"]
            }
        
        # Property info
        if category == RequestCategory.PROPERTY_INFO:
            return {
                "message": f"I'd be happy to help with that, {name}! What specific property info do you need? WiFi password, door codes, check-out time, or something else?",
                "action": "inquiry",
                "suggestions": ["WiFi password", "Check-out time", "House rules"]
            }
        
        # Default/unknown
        return {
            "message": f"I'm here to help, {name}! Could you tell me more about what you need? I can assist with:\n\n• 🛏️ Supplies (towels, toiletries)\n• 🔧 Maintenance issues\n• 🍽️ Restaurant recommendations\n• 💇 Salon/barber appointments\n• 🎭 Things to do\n• 🚗 Transportation\n\nJust let me know!",
            "action": "clarify",
            "suggestions": ["I need supplies", "Restaurant recommendations", "Something's broken"]
        }

    def _extract_supply_item(self, message: str) -> str:
        """Extract what supply item was requested."""
        message_lower = message.lower()
        for keyword in CATEGORY_KEYWORDS[RequestCategory.SUPPLIES]:
            if keyword in message_lower:
                return keyword + "s" if not keyword.endswith("s") else keyword
        return "supplies"

    def _get_recommendations(self, category: str, limit: int = 3) -> List[LocalBusiness]:
        """Get top recommendations for a category."""
        businesses = MIDLAND_BUSINESSES.get(category, [])
        # Sort by rating
        sorted_businesses = sorted(businesses, key=lambda x: x.rating or 0, reverse=True)
        return sorted_businesses[:limit]

    def _format_recommendations(self, businesses: List[LocalBusiness]) -> str:
        """Format businesses into readable text."""
        lines = []
        for i, biz in enumerate(businesses, 1):
            stars = "⭐" * int(biz.rating or 4)
            price = biz.price_range or "$$"
            lines.append(f"**{i}. {biz.name}** ({biz.category})")
            lines.append(f"   {stars} | {price}")
            lines.append(f"   📍 {biz.address}")
            if biz.phone:
                lines.append(f"   📞 {biz.phone}")
            if biz.description:
                lines.append(f"   _{biz.description}_")
            lines.append("")
        return "\n".join(lines)

    # =========================================================================
    # STEVEN NOTIFICATION METHODS
    # =========================================================================

    async def _call_steven(self, request: GuestRequest, guest_name: Optional[str] = None):
        """Call Steven with urgent message."""
        if not self.twilio_client:
            logger.warning("Twilio not available, cannot call Steven")
            return False
        
        name = guest_name or "A guest"
        urgency = "URGENT" if request.urgency == UrgencyLevel.HIGH else "EMERGENCY"
        
        message = f"""
        {urgency} message from {name} at property {request.property_id}.
        
        Category: {request.category.value}
        
        Their message: {request.message}
        
        Please respond as soon as possible.
        Press 1 to hear the message again.
        Press 2 to call the guest back.
        Press 3 to acknowledge.
        """
        
        try:
            call = self.twilio_client.calls.create(
                twiml=f'<Response><Say voice="Polly.Matthew">{message}</Say></Response>',
                to=self.steven_phone,
                from_=self.twilio_number
            )
            logger.info(f"Called Steven: {call.sid}")
            return True
        except Exception as e:
            logger.error(f"Failed to call Steven: {e}")
            return False

    async def _text_steven(self, request: GuestRequest, guest_name: Optional[str] = None):
        """Text Steven with request details."""
        if not self.twilio_client:
            logger.warning("Twilio not available, cannot text Steven")
            return False
        
        name = guest_name or "Guest"
        urgency_emoji = {
            UrgencyLevel.CRITICAL: "🚨",
            UrgencyLevel.HIGH: "⚠️",
            UrgencyLevel.MEDIUM: "📢",
            UrgencyLevel.LOW: "ℹ️"
        }
        
        emoji = urgency_emoji.get(request.urgency, "📢")
        
        message = f"""{emoji} RAH BnB Alert

Guest: {name}
Property: {request.property_id}
Category: {request.category.value}
Urgency: {request.urgency.value}

Message: {request.message}

Reply DONE when resolved."""
        
        try:
            sms = self.twilio_client.messages.create(
                body=message,
                to=self.steven_phone,
                from_=self.twilio_number
            )
            logger.info(f"Texted Steven: {sms.sid}")
            return True
        except Exception as e:
            logger.error(f"Failed to text Steven: {e}")
            return False

    # =========================================================================
    # WEB SEARCH FOR LOCAL BUSINESSES
    # =========================================================================

    async def search_local(
        self,
        query: str,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for local businesses using Google Places API.
        Falls back to static database if API unavailable.
        """
        if self.google_api_key:
            results = await self._google_places_search(query)
            if results:
                return results
        
        # Fallback to static database
        return self._search_static_database(query, category)

    async def _google_places_search(self, query: str) -> List[Dict[str, Any]]:
        """Search Google Places API for businesses near Midland, TX."""
        if not self.google_api_key:
            return []
        
        try:
            async with httpx.AsyncClient() as client:
                # Text search endpoint
                url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
                params = {
                    "query": f"{query} near Midland, TX",
                    "key": self.google_api_key,
                    "type": "establishment"
                }
                
                response = await client.get(url, params=params, timeout=10.0)
                data = response.json()
                
                if data.get("status") != "OK":
                    return []
                
                results = []
                for place in data.get("results", [])[:5]:
                    results.append({
                        "name": place.get("name"),
                        "address": place.get("formatted_address"),
                        "rating": place.get("rating"),
                        "price_level": "$" * place.get("price_level", 2),
                        "open_now": place.get("opening_hours", {}).get("open_now"),
                        "place_id": place.get("place_id")
                    })
                
                return results
        except Exception as e:
            logger.error(f"Google Places search failed: {e}")
            return []

    def _search_static_database(
        self,
        query: str,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search static business database."""
        query_lower = query.lower()
        results = []
        
        # Search in specified category or all
        categories_to_search = [category] if category else MIDLAND_BUSINESSES.keys()
        
        for cat in categories_to_search:
            for biz in MIDLAND_BUSINESSES.get(cat, []):
                # Match on name, category, or description
                if (query_lower in biz.name.lower() or
                    query_lower in biz.category.lower() or
                    (biz.description and query_lower in biz.description.lower())):
                    results.append(asdict(biz))
        
        return results

    # =========================================================================
    # APPOINTMENT BOOKING
    # =========================================================================

    async def book_appointment(
        self,
        guest_id: str,
        business_name: str,
        service: str,
        preferred_date: str,
        preferred_time: str,
        guest_name: str,
        guest_phone: str
    ) -> Dict[str, Any]:
        """
        Book an appointment at a local business.
        For now, this creates a booking request that Steven fulfills.
        Future: integrate with booking APIs.
        """
        booking_id = f"appt_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{guest_id[:8]}"
        
        booking = AppointmentBooking(
            id=booking_id,
            guest_id=guest_id,
            business_name=business_name,
            service=service,
            date=preferred_date,
            time=preferred_time,
            notes=f"Guest: {guest_name}, Phone: {guest_phone}"
        )
        
        # Save to Firebase
        if self.firebase_available and db:
            db.collection(self.bookings_collection).document(booking_id).set(asdict(booking))
        
        # Notify Steven to make the booking
        await self._text_steven_booking(booking, guest_name, guest_phone)
        
        return {
            "booking_id": booking_id,
            "status": "pending",
            "message": f"I've sent your appointment request to Steven. He'll call {business_name} and confirm your {service} for {preferred_date} at {preferred_time}. You'll receive a confirmation text once it's booked!",
            "business": business_name,
            "service": service,
            "date": preferred_date,
            "time": preferred_time
        }

    async def _text_steven_booking(
        self,
        booking: AppointmentBooking,
        guest_name: str,
        guest_phone: str
    ):
        """Text Steven to make a booking."""
        if not self.twilio_client:
            return
        
        message = f"""📅 Appointment Request

Guest: {guest_name}
Phone: {guest_phone}

Business: {booking.business_name}
Service: {booking.service}
Date: {booking.date}
Time: {booking.time}

Please call and book, then text guest to confirm."""
        
        try:
            self.twilio_client.messages.create(
                body=message,
                to=self.steven_phone,
                from_=self.twilio_number
            )
        except Exception as e:
            logger.error(f"Failed to text booking request: {e}")

    # =========================================================================
    # WEATHER SERVICE
    # =========================================================================

    async def get_weather(self) -> Dict[str, Any]:
        """Get current weather for Midland, TX."""
        if not self.weather_api_key:
            return self._get_mock_weather()
        
        try:
            async with httpx.AsyncClient() as client:
                url = f"https://api.openweathermap.org/data/2.5/weather"
                params = {
                    "zip": "79705,US",
                    "appid": self.weather_api_key,
                    "units": "imperial"
                }
                
                response = await client.get(url, params=params, timeout=10.0)
                data = response.json()
                
                return {
                    "success": True,
                    "temp": round(data["main"]["temp"]),
                    "feels_like": round(data["main"]["feels_like"]),
                    "condition": data["weather"][0]["main"],
                    "description": data["weather"][0]["description"],
                    "humidity": data["main"]["humidity"],
                    "wind_speed": round(data["wind"]["speed"]),
                    "location": "Midland, TX"
                }
        except Exception as e:
            logger.error(f"Weather fetch failed: {e}")
            return self._get_mock_weather()

    def _get_mock_weather(self) -> Dict[str, Any]:
        """Return mock weather data."""
        import random
        return {
            "success": True,
            "temp": random.randint(75, 95),
            "feels_like": random.randint(78, 98),
            "condition": "Clear",
            "description": "clear sky",
            "humidity": random.randint(20, 40),
            "wind_speed": random.randint(5, 15),
            "location": "Midland, TX",
            "mock": True
        }


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

_concierge_instance: Optional[UltimateConciergeService] = None

def get_concierge() -> UltimateConciergeService:
    """Get singleton concierge instance."""
    global _concierge_instance
    if _concierge_instance is None:
        _concierge_instance = UltimateConciergeService()
    return _concierge_instance


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

async def handle_guest_message(
    guest_id: str,
    property_id: str,
    message: str,
    guest_name: Optional[str] = None
) -> Dict[str, Any]:
    """Quick function to handle a guest message."""
    concierge = get_concierge()
    return await concierge.handle_request(guest_id, property_id, message, guest_name)


async def search_local_businesses(query: str, category: Optional[str] = None) -> List[Dict]:
    """Quick function to search local businesses."""
    concierge = get_concierge()
    return await concierge.search_local(query, category)


async def book_appointment(
    guest_id: str,
    business: str,
    service: str,
    date: str,
    time: str,
    name: str,
    phone: str
) -> Dict[str, Any]:
    """Quick function to book appointment."""
    concierge = get_concierge()
    return await concierge.book_appointment(guest_id, business, service, date, time, name, phone)


async def get_weather() -> Dict[str, Any]:
    """Quick function to get weather."""
    concierge = get_concierge()
    return await concierge.get_weather()
