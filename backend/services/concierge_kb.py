"""
Right At Home BnB - Concierge Knowledge Base Service
=====================================================
Comprehensive knowledge base for AI Steven Concierge including:
- Property-specific FAQs
- House rules per property
- Appliance instructions
- Local emergency numbers
- Nearby services
- Weather-aware recommendations
- Seasonal information

@author ECHO OMEGA PRIME
@owner Steven Palma - Right at Home BnB, Midland, TX
"""

import os
import json
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, date, timedelta
from enum import Enum
from dataclasses import dataclass, field
from loguru import logger
import httpx

# Weather API (OpenWeather)
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
MIDLAND_LAT = 31.9973
MIDLAND_LON = -102.0779


class KBCategory(str, Enum):
    """Knowledge base categories."""
    PROPERTY_INFO = "property_info"
    CHECK_IN = "check_in"
    CHECK_OUT = "check_out"
    WIFI = "wifi"
    APPLIANCES = "appliances"
    POOL_HOT_TUB = "pool_hot_tub"
    HOUSE_RULES = "house_rules"
    EMERGENCY = "emergency"
    LOCAL_SERVICES = "local_services"
    RESTAURANTS = "restaurants"
    ATTRACTIONS = "attractions"
    TRANSPORTATION = "transportation"
    WEATHER = "weather"
    MAINTENANCE = "maintenance"
    PARKING = "parking"
    TRASH = "trash"
    LAUNDRY = "laundry"
    CLIMATE = "climate"


@dataclass
class FAQEntry:
    """Single FAQ entry."""
    question: str
    answer: str
    category: KBCategory
    keywords: List[str] = field(default_factory=list)
    property_specific: bool = False
    priority: int = 0  # Higher = more important


@dataclass
class ApplianceInstruction:
    """Appliance usage instructions."""
    name: str
    location: str
    instructions: List[str]
    troubleshooting: List[Dict[str, str]]  # {problem: solution}
    manual_location: Optional[str] = None


@dataclass
class EmergencyContact:
    """Emergency contact information."""
    name: str
    phone: str
    category: str
    available_24_7: bool = False
    notes: Optional[str] = None


# =============================================================================
# GLOBAL KNOWLEDGE BASE - Applies to ALL Properties
# =============================================================================

GLOBAL_FAQ: List[FAQEntry] = [
    # Check-in/out
    FAQEntry(
        question="What time is check-in?",
        answer="Standard check-in time is 3:00 PM. Early check-in may be available if the property is ready - just ask Steven!",
        category=KBCategory.CHECK_IN,
        keywords=["check in", "check-in", "arrive", "arrival", "what time"],
        priority=10
    ),
    FAQEntry(
        question="What time is check-out?",
        answer="Check-out is at 11:00 AM. Please start the dishwasher, take trash to the outside bins, and set thermostat to 78F before leaving. Need late checkout? Ask Steven - it's $25/hour if available.",
        category=KBCategory.CHECK_OUT,
        keywords=["check out", "check-out", "leave", "leaving", "departure"],
        priority=10
    ),
    FAQEntry(
        question="How do I get into the property?",
        answer="You'll receive a unique door code via text 2 hours before check-in. The code is valid from check-in time until 1 hour after checkout. Simply enter the code on the keypad lock.",
        category=KBCategory.CHECK_IN,
        keywords=["door", "code", "key", "keypad", "enter", "get in", "lock"],
        priority=9
    ),
    FAQEntry(
        question="Can I request late checkout?",
        answer="Late checkout is $25 per hour and subject to availability. Text Steven to request - he'll check if the next guest arrival allows it.",
        category=KBCategory.CHECK_OUT,
        keywords=["late checkout", "late check-out", "extend", "stay longer"],
        priority=7
    ),

    # WiFi
    FAQEntry(
        question="What's the WiFi password?",
        answer="WiFi credentials are posted on the refrigerator and in the welcome book on the coffee table. Each property has its own network name. Can't find it? Text Steven with your property address.",
        category=KBCategory.WIFI,
        keywords=["wifi", "wi-fi", "internet", "password", "network"],
        priority=10
    ),

    # House Rules
    FAQEntry(
        question="Are pets allowed?",
        answer="Pets are allowed at most properties with a $50 pet fee. Please keep pets off furniture and clean up after them. Let Steven know you're bringing a pet when booking.",
        category=KBCategory.HOUSE_RULES,
        keywords=["pet", "pets", "dog", "cat", "animal"],
        priority=8
    ),
    FAQEntry(
        question="Is smoking allowed?",
        answer="Smoking is strictly prohibited inside all properties. There's a $500 cleaning fee for smoking violations. Outdoor smoking areas are available at properties with patios.",
        category=KBCategory.HOUSE_RULES,
        keywords=["smoke", "smoking", "cigarette", "vape"],
        priority=9
    ),
    FAQEntry(
        question="Can I have parties or events?",
        answer="Parties and events require prior approval from Steven. Unauthorized gatherings may result in immediate eviction. For approved events, there may be additional fees and deposit requirements.",
        category=KBCategory.HOUSE_RULES,
        keywords=["party", "parties", "event", "gathering", "guests"],
        priority=8
    ),
    FAQEntry(
        question="What are the quiet hours?",
        answer="Quiet hours are 10:00 PM to 7:00 AM. Please be respectful of neighbors during these times.",
        category=KBCategory.HOUSE_RULES,
        keywords=["quiet", "noise", "loud", "music", "volume"],
        priority=7
    ),

    # Parking
    FAQEntry(
        question="Where can I park?",
        answer="Each property has dedicated parking in the driveway. Street parking is also available and free (no permits required in Midland residential areas). Work trucks and trailers welcome at most properties.",
        category=KBCategory.PARKING,
        keywords=["park", "parking", "car", "vehicle", "truck", "trailer"],
        priority=7
    ),

    # Trash
    FAQEntry(
        question="Where do I put the trash?",
        answer="Trash bins are located on the side of the house or in the garage. Blue bin is recycling, black/gray is trash. Trash pickup varies by neighborhood - check the posted schedule.",
        category=KBCategory.TRASH,
        keywords=["trash", "garbage", "recycling", "waste", "bins"],
        priority=6
    ),

    # Laundry
    FAQEntry(
        question="How do I use the washer and dryer?",
        answer="All properties have full-size washer and dryer. Detergent pods are provided in the laundry area. For work clothes, we recommend normal cycle with warm water. Lint trap is in the dryer door.",
        category=KBCategory.LAUNDRY,
        keywords=["washer", "dryer", "laundry", "wash", "clothes", "detergent"],
        priority=6
    ),

    # Climate/HVAC
    FAQEntry(
        question="How do I adjust the thermostat?",
        answer="Most properties have Nest or Honeywell thermostats. They're preset to 72F for comfort. Please don't set below 68F in summer or above 74F in winter to protect the HVAC system. When leaving for the day, set to 78F to save energy.",
        category=KBCategory.CLIMATE,
        keywords=["thermostat", "ac", "heat", "temperature", "cold", "hot", "hvac", "nest"],
        priority=7
    ),
]

EMERGENCY_CONTACTS: List[EmergencyContact] = [
    EmergencyContact(
        name="Emergency Services",
        phone="911",
        category="emergency",
        available_24_7=True,
        notes="Police, Fire, Medical emergencies"
    ),
    EmergencyContact(
        name="Steven Palma (Owner)",
        phone="(432) 559-1904",
        category="owner",
        available_24_7=True,
        notes="Property owner - call/text anytime for urgent issues"
    ),
    EmergencyContact(
        name="After Hours Emergency",
        phone="(432) 555-0911",
        category="property_emergency",
        available_24_7=True,
        notes="24/7 property emergency line"
    ),
    EmergencyContact(
        name="Maintenance",
        phone="(432) 555-0200",
        category="maintenance",
        available_24_7=False,
        notes="Non-emergency repairs, 8am-6pm"
    ),
    EmergencyContact(
        name="Poison Control",
        phone="1-800-222-1222",
        category="medical",
        available_24_7=True
    ),
    EmergencyContact(
        name="Midland Memorial Hospital",
        phone="(432) 221-1111",
        category="hospital",
        available_24_7=True,
        notes="400 Rosalind Redfern Grover Pkwy, 24/7 ER"
    ),
    EmergencyContact(
        name="Medical Center Hospital",
        phone="(432) 640-4000",
        category="hospital",
        available_24_7=True,
        notes="500 W 4th St, 24/7 ER"
    ),
    EmergencyContact(
        name="Midland Police (Non-Emergency)",
        phone="(432) 685-7108",
        category="police",
        available_24_7=True
    ),
    EmergencyContact(
        name="A1 Locksmith",
        phone="(432) 683-5625",
        category="locksmith",
        available_24_7=True,
        notes="If smart lock fails - bill to Right at Home BnB"
    ),
    EmergencyContact(
        name="Roto-Rooter Plumbing",
        phone="(432) 520-5555",
        category="plumbing",
        available_24_7=True,
        notes="Emergency plumbing - bill to Right at Home BnB"
    ),
]

LOCAL_SERVICES: Dict[str, List[Dict[str, Any]]] = {
    "grocery": [
        {
            "name": "H-E-B",
            "address": "4517 N Midland Dr, Midland, TX 79707",
            "hours": "6:00 AM - 11:00 PM",
            "phone": "(432) 699-0070",
            "notes": "Best Texas grocery chain, great produce and meat"
        },
        {
            "name": "Market Street",
            "address": "4610 N Garfield St, Midland, TX 79705",
            "hours": "6:00 AM - 10:00 PM",
            "phone": "(432) 699-4700",
            "notes": "Upscale grocery, excellent deli and prepared foods"
        },
        {
            "name": "United Supermarkets",
            "address": "Multiple locations",
            "hours": "6:00 AM - 10:00 PM",
            "notes": "West Texas chain, friendly service"
        },
        {
            "name": "Walmart Supercenter",
            "address": "4517 N Midland Dr",
            "hours": "6:00 AM - 11:00 PM",
            "notes": "24-hour pharmacy, one-stop shopping"
        },
    ],
    "pharmacy": [
        {
            "name": "Walgreens",
            "address": "Multiple locations",
            "hours": "8:00 AM - 10:00 PM",
            "notes": "Drive-thru pharmacy available"
        },
        {
            "name": "CVS Pharmacy",
            "address": "Multiple locations",
            "hours": "8:00 AM - 10:00 PM"
        },
        {
            "name": "H-E-B Pharmacy",
            "address": "4517 N Midland Dr",
            "hours": "8:00 AM - 9:00 PM",
            "notes": "Often has shorter wait times"
        },
    ],
    "urgent_care": [
        {
            "name": "Urgent Care Midland",
            "address": "4400 N Midland Dr",
            "hours": "8:00 AM - 8:00 PM",
            "phone": "(432) 221-4300",
            "notes": "No appointment needed, faster than ER"
        },
        {
            "name": "CareNow Urgent Care",
            "address": "4610 N Garfield St Suite 100",
            "hours": "8:00 AM - 9:00 PM",
            "phone": "(432) 695-6500"
        },
    ],
    "gas_station": [
        {
            "name": "Stripes (Laredo Taco)",
            "address": "Multiple locations",
            "hours": "24 hours",
            "notes": "Has diesel, great breakfast tacos"
        },
        {
            "name": "Love's Travel Stop",
            "address": "2601 W I-20",
            "hours": "24 hours",
            "notes": "Diesel, truck parking, showers"
        },
        {
            "name": "Pilot Flying J",
            "address": "4901 W Hwy 80",
            "hours": "24 hours",
            "notes": "Diesel, truck services"
        },
    ],
    "hardware": [
        {
            "name": "Home Depot",
            "address": "4200 W Loop 250 N",
            "hours": "6:00 AM - 9:00 PM",
            "phone": "(432) 697-0980",
            "notes": "Opens 6AM for work crews, Pro desk available"
        },
        {
            "name": "Lowe's",
            "address": "5100 W Loop 250 N",
            "hours": "6:00 AM - 9:00 PM",
            "phone": "(432) 699-1750",
            "notes": "Pro services, tool rental"
        },
        {
            "name": "Ace Hardware",
            "address": "3200 N Big Spring St",
            "hours": "7:00 AM - 7:00 PM",
            "phone": "(432) 682-6541",
            "notes": "Locally owned, helpful staff"
        },
    ],
    "laundromat": [
        {
            "name": "Wash Tub Laundry",
            "address": "2907 Garden City Hwy",
            "hours": "6:00 AM - 10:00 PM",
            "notes": "Large industrial machines for work clothes, drop-off service"
        },
        {
            "name": "Speed Queen Laundry",
            "address": "4201 W Wadley Ave",
            "hours": "7:00 AM - 9:00 PM",
            "notes": "Commercial machines, good for heavy loads"
        },
    ],
}


# =============================================================================
# PROPERTY-SPECIFIC KNOWLEDGE BASE
# =============================================================================

PROPERTY_KB: Dict[str, Dict[str, Any]] = {
    "santiago_dreams": {
        "property_id": "santiago_dreams",
        "name": "Santiago Dreams",
        "address": "1311 Daventry, Midland, TX 79705",
        "wifi_name": "RightAtHome_Santiago",
        "wifi_password": "Welcome2Midland",
        "door_code": "1311",
        "check_in": "3:00 PM",
        "check_out": "11:00 AM",
        "special_features": ["Man cave", "Two large yards", "Extra parking for work trucks"],
        "faqs": [
            FAQEntry(
                question="Where is the man cave?",
                answer="The man cave is in the converted garage at the back of the house. It has a TV, mini fridge, and comfortable seating - perfect for relaxing after a long shift!",
                category=KBCategory.PROPERTY_INFO,
                keywords=["man cave", "garage", "game room"],
                property_specific=True
            ),
            FAQEntry(
                question="Is there parking for work trucks?",
                answer="Yes! Santiago Dreams has extra parking space and two large yards that can accommodate work trucks and trailers. The driveway fits 4+ vehicles.",
                category=KBCategory.PARKING,
                keywords=["truck", "trailer", "parking", "work vehicle"],
                property_specific=True
            ),
        ],
        "appliances": [
            ApplianceInstruction(
                name="Samsung Smart TV",
                location="Living room",
                instructions=[
                    "Remote is on the coffee table",
                    "Press the Home button to access streaming apps",
                    "WiFi is already connected",
                    "Netflix, Hulu, and YouTube are pre-installed"
                ],
                troubleshooting=[
                    {"problem": "TV won't turn on", "solution": "Check if it's plugged in. Try pressing the power button on the TV itself (bottom right)."},
                    {"problem": "No sound", "solution": "Check volume isn't muted. Verify correct input is selected."},
                ]
            ),
        ],
        "house_rules_specific": [
            "No smoking anywhere on property",
            "Pets allowed with $50 fee - keep off furniture",
            "Quiet hours 10pm-7am",
            "Work boots should be left at the door"
        ],
    },
    "sprawling_ranch": {
        "property_id": "sprawling_ranch",
        "name": "Sprawling Ranch House with Pool Cabana and Playground",
        "address": "5055 Lincoln Green, Midland, TX 79705",
        "wifi_name": "RightAtHome_LincolnGreen",
        "wifi_password": "Welcome2Midland",
        "door_code": "5055",
        "has_pool": True,
        "has_playground": True,
        "special_features": ["Swimming Pool", "Pool Cabana", "Playground", "Jetted bathtub", "Fireplace"],
        "faqs": [
            FAQEntry(
                question="What are the pool hours?",
                answer="Pool is available 8:00 AM to 10:00 PM. Please shower before entering. No glass containers near the pool. Pool towels are in the cabana. The pool is heated but may take a few hours to warm up in cooler weather.",
                category=KBCategory.POOL_HOT_TUB,
                keywords=["pool", "swim", "swimming", "cabana"],
                property_specific=True,
                priority=9
            ),
            FAQEntry(
                question="Is the pool heated?",
                answer="Yes! The pool has a heater. It's set to 82F by default. If you need it warmer, text Steven. Note: It may take 4-6 hours to heat up significantly.",
                category=KBCategory.POOL_HOT_TUB,
                keywords=["pool", "heated", "temperature", "warm"],
                property_specific=True
            ),
            FAQEntry(
                question="Where is the playground?",
                answer="The playground is in the backyard, visible from the kitchen window. It includes swings, a slide, and a climbing structure. Please supervise children at all times.",
                category=KBCategory.PROPERTY_INFO,
                keywords=["playground", "kids", "children", "play", "swing"],
                property_specific=True
            ),
            FAQEntry(
                question="How do I use the fireplace?",
                answer="The fireplace is gas-operated. The switch is on the wall to the right of the fireplace. Simply flip it on. The flame height can be adjusted with the knob below the switch.",
                category=KBCategory.APPLIANCES,
                keywords=["fireplace", "fire", "gas"],
                property_specific=True
            ),
        ],
        "appliances": [
            ApplianceInstruction(
                name="Pool Heater Control",
                location="Pool equipment shed (side of house)",
                instructions=[
                    "The pool heater is usually pre-set",
                    "To adjust: Use the Pentair app or keypad on the unit",
                    "Default setting: 82F",
                    "Maximum: 90F"
                ],
                troubleshooting=[
                    {"problem": "Pool feels cold", "solution": "Check heater is on in the app. May take 4-6 hours to heat. Text Steven if issues persist."},
                    {"problem": "Pool pump making noise", "solution": "Check basket for debris. If continues, text Steven."},
                ]
            ),
            ApplianceInstruction(
                name="Jetted Bathtub",
                location="Master bathroom",
                instructions=[
                    "Fill tub to at least 2 inches above jets before turning on",
                    "Press the button on the tub wall to start jets",
                    "Jets run for 20 minutes then auto-shutoff",
                    "Clean jets monthly (already done by cleaners)"
                ],
                troubleshooting=[
                    {"problem": "Jets won't turn on", "solution": "Make sure water level is above jets. Check GFCI outlet in bathroom hasn't tripped."},
                ]
            ),
        ],
        "pool_rules": [
            "Pool hours: 8:00 AM - 10:00 PM",
            "Shower before entering pool",
            "No glass containers near pool",
            "No diving - pool is not deep enough",
            "Children under 12 must be supervised",
            "Pool towels are in the cabana"
        ],
        "house_rules_specific": [
            "All pool rules must be followed",
            "No smoking anywhere on property",
            "Pets allowed with $50 fee",
            "Quiet hours 10pm-7am"
        ],
    },
    "outdoor_dream": {
        "property_id": "outdoor_dream",
        "name": "Outdoor Dream",
        "address": "3106 Humble, Midland, TX 79705",
        "wifi_name": "RightAtHome_Humble",
        "wifi_password": "Welcome2Midland",
        "door_code": "3106",
        "has_pool": True,
        "has_hot_tub": True,
        "special_features": ["Pool AND Hot Tub", "Large patio", "Outdoor living areas"],
        "faqs": [
            FAQEntry(
                question="What are the hot tub rules?",
                answer="Hot tub is available 8AM-10PM. Maximum 4 people at a time. Shower before use. Limit sessions to 15-20 minutes. No food or glass near the hot tub. The cover should remain on when not in use.",
                category=KBCategory.POOL_HOT_TUB,
                keywords=["hot tub", "spa", "jacuzzi"],
                property_specific=True,
                priority=9
            ),
            FAQEntry(
                question="How do I turn on the hot tub?",
                answer="The hot tub control panel is on the equipment pad next to the tub. Press the 'Jets' button to start. Temperature can be adjusted with the +/- buttons. Default is 102F.",
                category=KBCategory.POOL_HOT_TUB,
                keywords=["hot tub", "turn on", "jets", "temperature"],
                property_specific=True
            ),
        ],
        "hot_tub_rules": [
            "Hot tub hours: 8:00 AM - 10:00 PM",
            "Maximum 4 people at a time",
            "Shower before entering",
            "Limit sessions to 15-20 minutes",
            "No food or glass near hot tub",
            "Replace cover when not in use",
            "No children under 5 in hot tub"
        ],
        "house_rules_specific": [
            "Pool and hot tub rules must be followed",
            "No smoking anywhere on property",
            "Pets allowed with $50 fee"
        ],
    },
    "hot_tub_delight": {
        "property_id": "hot_tub_delight",
        "name": "Hot Tub Delight",
        "address": "4707 Dentcrest, Midland, TX 79705",
        "wifi_name": "RightAtHome_Dentcrest",
        "wifi_password": "Welcome2Midland",
        "door_code": "4707",
        "has_hot_tub": True,
        "special_features": ["Hot Tub", "Balcony", "Outdoor spa"],
        "faqs": [
            FAQEntry(
                question="Where is the hot tub?",
                answer="The hot tub is on the back patio, accessible through the sliding door in the living room. It's a 4-person spa with jets and LED lighting for evening relaxation.",
                category=KBCategory.POOL_HOT_TUB,
                keywords=["hot tub", "where", "location", "patio"],
                property_specific=True
            ),
        ],
        "hot_tub_rules": [
            "Hot tub hours: 8:00 AM - 10:00 PM",
            "Maximum 4 people at a time",
            "Shower before entering",
            "Limit sessions to 15-20 minutes",
            "Replace cover when not in use"
        ],
    },
    "posh_private": {
        "property_id": "posh_private",
        "name": "Posh & Private with Billiards",
        "address": "1426 Lanham, Midland, TX 79705",
        "wifi_name": "RightAtHome_Lanham",
        "wifi_password": "Welcome2Midland",
        "door_code": "1426",
        "has_billiards": True,
        "has_fireplace": True,
        "special_features": ["Billiards table", "Private setting", "Fireplace"],
        "faqs": [
            FAQEntry(
                question="Where is the billiards table?",
                answer="The billiards table is in the game room off the main living area. Cues, balls, and chalk are in the rack on the wall. Please use the brush to clean the felt after playing.",
                category=KBCategory.PROPERTY_INFO,
                keywords=["pool table", "billiards", "game room"],
                property_specific=True
            ),
        ],
    },
}


# =============================================================================
# WEATHER SERVICE
# =============================================================================

class WeatherService:
    """Get current weather and forecasts for Midland, TX."""

    def __init__(self):
        self.api_key = OPENWEATHER_API_KEY
        self.lat = MIDLAND_LAT
        self.lon = MIDLAND_LON
        self.cache: Dict[str, Any] = {}
        self.cache_time: Optional[datetime] = None
        self.cache_duration = timedelta(minutes=30)

    async def get_current_weather(self) -> Dict[str, Any]:
        """Get current weather conditions."""
        if not self.api_key:
            return self._get_fallback_weather()

        # Check cache
        if self.cache and self.cache_time and datetime.now() - self.cache_time < self.cache_duration:
            return self.cache

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.openweathermap.org/data/2.5/weather",
                    params={
                        "lat": self.lat,
                        "lon": self.lon,
                        "appid": self.api_key,
                        "units": "imperial"
                    },
                    timeout=10.0
                )

                if response.status_code == 200:
                    data = response.json()
                    weather = {
                        "temperature": round(data["main"]["temp"]),
                        "feels_like": round(data["main"]["feels_like"]),
                        "humidity": data["main"]["humidity"],
                        "description": data["weather"][0]["description"],
                        "wind_speed": round(data["wind"]["speed"]),
                        "conditions": data["weather"][0]["main"],
                        "timestamp": datetime.now().isoformat()
                    }
                    self.cache = weather
                    self.cache_time = datetime.now()
                    return weather
        except Exception as e:
            logger.error(f"Weather API error: {e}")

        return self._get_fallback_weather()

    def _get_fallback_weather(self) -> Dict[str, Any]:
        """Fallback weather when API is unavailable."""
        month = datetime.now().month

        # Midland TX typical temperatures by season
        if month in [12, 1, 2]:  # Winter
            return {
                "temperature": 52,
                "feels_like": 48,
                "description": "typical winter day",
                "conditions": "Clear",
                "note": "Weather data unavailable - showing typical conditions"
            }
        elif month in [3, 4, 5]:  # Spring
            return {
                "temperature": 72,
                "feels_like": 70,
                "description": "pleasant spring weather",
                "conditions": "Clear",
                "note": "Weather data unavailable - showing typical conditions"
            }
        elif month in [6, 7, 8]:  # Summer
            return {
                "temperature": 98,
                "feels_like": 102,
                "description": "hot and sunny",
                "conditions": "Clear",
                "note": "Weather data unavailable - showing typical conditions"
            }
        else:  # Fall
            return {
                "temperature": 68,
                "feels_like": 66,
                "description": "nice fall weather",
                "conditions": "Clear",
                "note": "Weather data unavailable - showing typical conditions"
            }

    def get_weather_recommendations(self, weather: Dict[str, Any]) -> List[str]:
        """Get activity recommendations based on weather."""
        temp = weather.get("temperature", 75)
        conditions = weather.get("conditions", "Clear").lower()

        recommendations = []

        if temp > 95:
            recommendations.append("It's hot outside! Great day for pool properties. Stay hydrated.")
            recommendations.append("Consider indoor attractions like the Petroleum Museum.")
            recommendations.append("If you're working outside, take frequent breaks in the AC.")
        elif temp > 80:
            recommendations.append("Warm day - perfect for outdoor activities before noon.")
            recommendations.append("The pool at your property would be refreshing!")
        elif temp < 50:
            recommendations.append("Cool day - great for exploring downtown Midland.")
            recommendations.append("The Museum of the Southwest is a great indoor option.")
        elif 65 < temp < 85:
            recommendations.append("Beautiful weather! Perfect for I-20 Wildlife Preserve trails.")
            recommendations.append("Great day for a patio lunch at Cork & Pig.")

        if "rain" in conditions or "storm" in conditions:
            recommendations.append("Rain expected - plan for indoor activities.")
            recommendations.append("Check out the Petroleum Museum or catch a movie.")

        if "wind" in conditions:
            recommendations.append("Windy conditions - common in West Texas. Secure loose items.")

        return recommendations


# =============================================================================
# CONCIERGE KNOWLEDGE BASE SERVICE
# =============================================================================

class ConciergeKnowledgeBase:
    """
    Complete knowledge base for the AI Steven Concierge.
    Provides property-specific and general information.
    """

    def __init__(self):
        self.weather_service = WeatherService()
        self.global_faq = GLOBAL_FAQ
        self.property_kb = PROPERTY_KB
        self.emergency_contacts = EMERGENCY_CONTACTS
        self.local_services = LOCAL_SERVICES

    def get_property_kb(self, property_id: str) -> Optional[Dict[str, Any]]:
        """Get knowledge base for a specific property."""
        return self.property_kb.get(property_id)

    def get_property_faqs(self, property_id: str) -> List[FAQEntry]:
        """Get FAQs for a specific property (global + property-specific)."""
        faqs = list(self.global_faq)

        if property_id in self.property_kb:
            prop_kb = self.property_kb[property_id]
            if "faqs" in prop_kb:
                faqs.extend(prop_kb["faqs"])

        # Sort by priority (highest first)
        faqs.sort(key=lambda x: x.priority, reverse=True)
        return faqs

    def search_faq(
        self,
        query: str,
        property_id: Optional[str] = None,
        category: Optional[KBCategory] = None
    ) -> List[Tuple[FAQEntry, float]]:
        """
        Search FAQs by query with relevance scoring.
        Returns list of (FAQEntry, score) tuples.
        """
        query_lower = query.lower()
        query_words = set(query_lower.split())

        # Get relevant FAQs
        if property_id:
            faqs = self.get_property_faqs(property_id)
        else:
            faqs = list(self.global_faq)

        # Filter by category if specified
        if category:
            faqs = [f for f in faqs if f.category == category]

        results = []
        for faq in faqs:
            score = 0.0

            # Check keywords
            for keyword in faq.keywords:
                if keyword in query_lower:
                    score += 2.0
                elif any(kw in query_lower for kw in keyword.split()):
                    score += 1.0

            # Check question similarity
            question_words = set(faq.question.lower().split())
            overlap = len(query_words & question_words)
            score += overlap * 0.5

            # Boost by priority
            score += faq.priority * 0.1

            if score > 0:
                results.append((faq, score))

        # Sort by score
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def get_house_rules(self, property_id: str) -> List[str]:
        """Get house rules for a property."""
        rules = [
            "No smoking inside any property",
            "Quiet hours: 10:00 PM - 7:00 AM",
            "No parties without prior approval",
            "Report any damage or maintenance issues immediately",
            "Lock doors when leaving"
        ]

        if property_id in self.property_kb:
            prop_kb = self.property_kb[property_id]
            if "house_rules_specific" in prop_kb:
                rules.extend(prop_kb["house_rules_specific"])
            if "pool_rules" in prop_kb:
                rules.extend(prop_kb["pool_rules"])
            if "hot_tub_rules" in prop_kb:
                rules.extend(prop_kb["hot_tub_rules"])

        return list(set(rules))  # Remove duplicates

    def get_appliance_instructions(self, property_id: str, appliance_name: Optional[str] = None) -> List[ApplianceInstruction]:
        """Get appliance instructions for a property."""
        if property_id not in self.property_kb:
            return []

        prop_kb = self.property_kb[property_id]
        appliances = prop_kb.get("appliances", [])

        if appliance_name:
            return [a for a in appliances if appliance_name.lower() in a.name.lower()]

        return appliances

    def get_emergency_contacts(self, category: Optional[str] = None) -> List[EmergencyContact]:
        """Get emergency contacts, optionally filtered by category."""
        if category:
            return [c for c in self.emergency_contacts if c.category == category]
        return self.emergency_contacts

    def get_local_services(self, service_type: Optional[str] = None) -> Dict[str, List[Dict]]:
        """Get local services, optionally filtered by type."""
        if service_type and service_type in self.local_services:
            return {service_type: self.local_services[service_type]}
        return self.local_services

    async def get_weather_context(self) -> Dict[str, Any]:
        """Get current weather with recommendations."""
        weather = await self.weather_service.get_current_weather()
        recommendations = self.weather_service.get_weather_recommendations(weather)

        return {
            "current": weather,
            "recommendations": recommendations
        }

    def build_context_for_query(
        self,
        query: str,
        property_id: Optional[str] = None,
        booking_id: Optional[str] = None,
        guest_name: Optional[str] = None
    ) -> str:
        """
        Build comprehensive context for AI response generation.
        """
        context_parts = []

        # Add property-specific context
        if property_id and property_id in self.property_kb:
            prop = self.property_kb[property_id]
            context_parts.append(f"""
CURRENT PROPERTY: {prop.get('name')}
Address: {prop.get('address')}
WiFi: {prop.get('wifi_name')} / {prop.get('wifi_password')}
Door Code: {prop.get('door_code')}
Check-in: {prop.get('check_in', '3:00 PM')}
Check-out: {prop.get('check_out', '11:00 AM')}
Special Features: {', '.join(prop.get('special_features', []))}
""")

        # Search for relevant FAQs
        faq_results = self.search_faq(query, property_id)
        if faq_results:
            context_parts.append("\nRELEVANT KNOWLEDGE:")
            for faq, score in faq_results[:3]:  # Top 3 most relevant
                context_parts.append(f"Q: {faq.question}")
                context_parts.append(f"A: {faq.answer}")

        # Add emergency contacts for safety queries
        query_lower = query.lower()
        if any(word in query_lower for word in ["emergency", "help", "urgent", "hospital", "police", "911"]):
            context_parts.append("\nEMERGENCY CONTACTS:")
            for contact in self.emergency_contacts[:5]:
                context_parts.append(f"- {contact.name}: {contact.phone}")

        # Add local services for service queries
        service_keywords = {
            "grocery": ["grocery", "groceries", "food", "supermarket"],
            "pharmacy": ["pharmacy", "medicine", "prescription", "drug store"],
            "hardware": ["hardware", "tools", "home depot", "lowes"],
            "gas_station": ["gas", "fuel", "diesel"],
            "laundromat": ["laundry", "laundromat", "wash clothes"]
        }

        for service_type, keywords in service_keywords.items():
            if any(kw in query_lower for kw in keywords):
                services = self.local_services.get(service_type, [])
                if services:
                    context_parts.append(f"\nNEARBY {service_type.upper().replace('_', ' ')}:")
                    for s in services[:3]:
                        context_parts.append(f"- {s['name']}: {s.get('address', '')} ({s.get('hours', '')})")

        return "\n".join(context_parts)


# Singleton instance
concierge_kb = ConciergeKnowledgeBase()


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def get_property_info(property_id: str) -> Optional[Dict[str, Any]]:
    """Quick helper to get property information."""
    return concierge_kb.get_property_kb(property_id)


def search_knowledge(query: str, property_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Quick helper to search knowledge base."""
    results = concierge_kb.search_faq(query, property_id)
    return [
        {
            "question": faq.question,
            "answer": faq.answer,
            "category": faq.category.value,
            "score": score
        }
        for faq, score in results
    ]


def get_emergency_info() -> List[Dict[str, Any]]:
    """Quick helper to get emergency contacts."""
    return [
        {
            "name": c.name,
            "phone": c.phone,
            "category": c.category,
            "24_7": c.available_24_7
        }
        for c in concierge_kb.emergency_contacts
    ]


async def get_weather() -> Dict[str, Any]:
    """Quick helper to get current weather."""
    return await concierge_kb.get_weather_context()
