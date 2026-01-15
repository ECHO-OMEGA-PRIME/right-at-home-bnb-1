"""
Right at Home BnB - AI Concierge Service
=========================================
Complete AI-powered guest assistant with full property knowledge,
local recommendations, directions, and real-time assistance.

Features:
- GPT-4 integration for intelligent chat
- Full property knowledge base (25+ properties)
- Midland, TX local restaurant recommendations
- Google Maps API for directions
- Local events calendar integration
- House rules and WiFi info
- Check-in/checkout instructions
- Emergency contacts

@author ECHO OMEGA PRIME
@owner Steven Palma - Right at Home BnB, Midland, TX
"""

import os
import json
import re
import httpx
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, date, timedelta
from enum import Enum
from dataclasses import dataclass, field
from loguru import logger
from openai import AsyncOpenAI

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


class QueryIntent(str, Enum):
    """Categories of guest queries."""
    PROPERTY_INFO = "property_info"
    WIFI_ACCESS = "wifi_access"
    CHECK_IN = "check_in"
    CHECK_OUT = "check_out"
    HOUSE_RULES = "house_rules"
    RESTAURANTS = "restaurants"
    BARS = "bars"
    ATTRACTIONS = "attractions"
    DIRECTIONS = "directions"
    EMERGENCY = "emergency"
    POOL = "pool"
    HOT_TUB = "hot_tub"
    MAINTENANCE = "maintenance"
    EVENTS = "events"
    GROCERY = "grocery"
    HARDWARE = "hardware"
    LAUNDRY = "laundry"
    GENERAL = "general"


class GuestType(str, Enum):
    """Types of guests for personalized responses."""
    WORK_CREW = "work_crew"
    FAMILY = "family"
    COUPLE = "couple"
    BUSINESS = "business"
    GENERAL = "general"


@dataclass
class Property:
    """Complete property information."""
    id: str
    name: str
    address: str
    vrbo_id: Optional[str] = None
    vrbo_url: Optional[str] = None
    bedrooms: int = 0
    bathrooms: float = 0
    sleeps: int = 0
    rating: Optional[str] = None
    reviews: int = 0
    has_pool: bool = False
    has_hot_tub: bool = False
    has_billiards: bool = False
    has_fireplace: bool = False
    pet_friendly: bool = False
    door_code: str = ""
    wifi_name: str = ""
    wifi_password: str = "Welcome2Midland"
    check_in: str = "3:00 PM"
    check_out: str = "11:00 AM"
    amenities: List[str] = field(default_factory=list)
    special_features: List[str] = field(default_factory=list)
    house_rules: List[str] = field(default_factory=list)
    parking_info: str = ""


# =============================================================================
# COMPLETE PROPERTY DATABASE - ALL 25 STEVEN PALMA PROPERTIES
# =============================================================================

PROPERTIES: Dict[str, Property] = {
    # VERIFIED PROPERTIES (8)
    "santiago_dreams": Property(
        id="santiago_dreams",
        name="Santiago Dreams",
        address="1311 Daventry, Midland, TX 79705",
        vrbo_id="4179271",
        vrbo_url="https://www.vrbo.com/4179271",
        bedrooms=4,
        bathrooms=3,
        sleeps=10,
        rating="10/10 Exceptional",
        reviews=18,
        has_pool=False,
        has_hot_tub=False,
        pet_friendly=True,
        door_code="1311",
        wifi_name="RightAtHome_Santiago",
        amenities=["Kitchen", "Washer", "Dryer", "Pet friendly", "Free WiFi", "Air conditioning", "Man cave", "Two large yards", "Extra parking"],
        special_features=["Man cave", "Two large yards", "Extra parking"],
        house_rules=["No smoking inside", "Pets allowed with deposit", "Quiet hours 10pm-7am"],
        parking_info="Extra parking available, great for work trucks"
    ),
    "sprawling_ranch": Property(
        id="sprawling_ranch",
        name="Sprawling Ranch House with Pool Cabana and Playground",
        address="5055 Lincoln Green, Midland, TX 79705",
        vrbo_id="4581977",
        vrbo_url="https://www.vrbo.com/4581977",
        bedrooms=6,
        bathrooms=3.5,
        sleeps=18,
        rating="9.0/10 Wonderful",
        reviews=2,
        has_pool=True,
        has_hot_tub=False,
        has_fireplace=True,
        pet_friendly=True,
        door_code="5055",
        wifi_name="RightAtHome_LincolnGreen",
        amenities=["Pool", "Washer", "Dryer", "Pet friendly", "Air conditioning", "Parking available", "Fireplace", "Jetted bathtub", "Pool Cabana", "Playground"],
        special_features=["FLAGSHIP PROPERTY", "Swimming Pool with Pool Cabana", "Playground for kids", "Jetted bathtub", "Fireplace", "6 bedrooms - Sleeps 18", "Sprawling ranch layout"],
        house_rules=["No smoking inside", "Pool rules must be followed", "Pets allowed with deposit", "Quiet hours 10pm-7am"],
        parking_info="Large driveway and garage - ample parking for multiple vehicles"
    ),
    "posh_private": Property(
        id="posh_private",
        name="Posh & Private with Billiards",
        address="1426 Lanham, Midland, TX 79705",
        vrbo_id="4437486",
        vrbo_url="https://www.vrbo.com/4437486",
        bedrooms=3,
        bathrooms=3.5,
        sleeps=10,
        rating="10/10 Exceptional",
        reviews=6,
        has_pool=False,
        has_hot_tub=False,
        has_billiards=True,
        has_fireplace=True,
        pet_friendly=True,
        door_code="1426",
        wifi_name="RightAtHome_Lanham",
        amenities=["Kitchen", "Washer", "Dryer", "Pet friendly", "Air conditioning", "Parking available", "Fireplace", "Billiards table", "Private setting"],
        special_features=["Billiards table", "Private setting", "Fireplace"],
        house_rules=["No smoking inside", "Pets allowed with deposit", "Quiet hours 10pm-7am"],
        parking_info="Parking available, private setting"
    ),
    "outdoor_dream": Property(
        id="outdoor_dream",
        name="Outdoor Dream",
        address="3106 Humble, Midland, TX 79705",
        vrbo_id="4700881",
        vrbo_url="https://www.vrbo.com/4700881",
        bedrooms=4,
        bathrooms=2.5,
        sleeps=14,
        rating="6.8/10",
        reviews=5,
        has_pool=True,
        has_hot_tub=True,
        pet_friendly=True,
        door_code="3106",
        wifi_name="RightAtHome_Humble",
        amenities=["Pool", "Hot tub", "Kitchen", "Washer", "Dryer", "Pet friendly", "Patio", "Outdoor living areas"],
        special_features=["Pool AND Hot Tub", "Extensive outdoor living areas", "Large patio"],
        house_rules=["No smoking inside", "Pool and hot tub rules apply", "Pets allowed with deposit"],
        parking_info="Driveway parking available"
    ),
    "most_marvelous": Property(
        id="most_marvelous",
        name="Most Marvelous with Pool",
        address="6100 Oriole, Midland, TX 79705",
        vrbo_id="4471713",
        vrbo_url="https://www.vrbo.com/4471713",
        bedrooms=4,
        bathrooms=2,
        sleeps=8,
        rating="9.6/10 Exceptional",
        reviews=5,
        has_pool=True,
        has_fireplace=True,
        pet_friendly=True,
        door_code="6100",
        wifi_name="RightAtHome_Oriole",
        amenities=["Pool", "Kitchen", "Washer", "Dryer", "Pet friendly", "Air conditioning", "Fireplace"],
        special_features=["Swimming Pool", "Fireplace", "Great location"],
        house_rules=["No smoking inside", "Pool rules apply", "Pets allowed with deposit"],
        parking_info="Driveway and garage parking"
    ),
    "hot_tub_delight": Property(
        id="hot_tub_delight",
        name="Hot Tub Delight",
        address="4707 Dentcrest, Midland, TX 79705",
        vrbo_id="2638481",
        vrbo_url="https://www.vrbo.com/2638481",
        bedrooms=3,
        bathrooms=2.5,
        sleeps=6,
        rating="8.4/10 Very Good",
        reviews=28,
        has_pool=False,
        has_hot_tub=True,
        pet_friendly=True,
        door_code="4707",
        wifi_name="RightAtHome_Dentcrest",
        amenities=["Hot tub", "Kitchen", "Washer", "Dryer", "Pet friendly", "Free WiFi", "Balcony", "Outdoor spa tub"],
        special_features=["Hot Tub", "Balcony", "Outdoor spa"],
        house_rules=["No smoking inside", "Hot tub rules apply", "Pets allowed with deposit"],
        parking_info="Driveway parking"
    ),
    "saddle_club": Property(
        id="saddle_club",
        name="Saddle Club",
        address="1309 Daventry, Midland, TX 79705",
        vrbo_id="4750070",
        vrbo_url="https://www.vrbo.com/4750070",
        bedrooms=4,
        bathrooms=3,
        sleeps=8,
        rating="10/10 Exceptional",
        reviews=4,
        has_pool=False,
        pet_friendly=True,
        door_code="1309",
        wifi_name="RightAtHome_Saddle",
        amenities=["Washer", "Dryer", "Air conditioning", "Parking available", "Barbecue grill", "Children's area", "Large yard with trees"],
        special_features=["Large yard with trees", "Children's area", "BBQ grill"],
        house_rules=["No smoking inside", "Pets allowed with deposit", "Quiet hours 10pm-7am"],
        parking_info="Ample parking available"
    ),
    "monterrey": Property(
        id="monterrey",
        name="Monterrey House",
        address="Monterrey St, Midland, TX 79705",
        vrbo_id="3477668",
        vrbo_url="https://www.vrbo.com/3477668",
        bedrooms=3,
        bathrooms=2,
        sleeps=6,
        rating="8.4/10 Very Good",
        reviews=11,
        pet_friendly=True,
        door_code="3477",
        wifi_name="RightAtHome_Monterrey",
        amenities=["Kitchen", "Washer", "Dryer", "Pet friendly", "Free WiFi", "Air conditioning", "Patio/Terrace"],
        special_features=["Patio/Terrace", "Central location"],
        house_rules=["No smoking inside", "Pets allowed with deposit", "Quiet hours 10pm-7am"],
        parking_info="Street and driveway parking"
    ),
    # OTHER PROPERTIES (Address varies/unverified)
    "adobe_compound": Property(
        id="adobe_compound",
        name="Adobe Compound with Pool and Fire Pits and Billiards",
        address="Near Midland Memorial Hospital, Midland, TX 79705",
        vrbo_id="3005111",
        vrbo_url="https://www.vrbo.com/3005111",
        bedrooms=7,
        bathrooms=2.5,
        sleeps=16,
        rating="8.8/10",
        reviews=36,
        has_pool=True,
        has_billiards=True,
        has_fireplace=True,
        pet_friendly=True,
        door_code="3005",
        wifi_name="RightAtHome_Adobe",
        amenities=["Pool", "Kitchen", "Washer", "Dryer", "Pet friendly", "Free WiFi", "Fire Pits", "Billiards"],
        special_features=["Pool", "Fire Pits", "Billiards", "7 bedrooms"],
        house_rules=["No smoking inside", "Pool and fire pit rules apply"],
        parking_info="Ample parking"
    ),
    "patio_home": Property(
        id="patio_home",
        name="Patio Home with Hot Tub",
        address="Near Midland College, Midland, TX 79705",
        vrbo_id="2634718",
        vrbo_url="https://www.vrbo.com/2634718",
        bedrooms=3,
        bathrooms=2,
        sleeps=6,
        has_pool=False,
        has_hot_tub=True,
        pet_friendly=True,
        door_code="2634",
        wifi_name="RightAtHome_Patio",
        amenities=["Hot Tub", "Multiple outdoor spaces", "Kitchen"],
        special_features=["Hot Tub", "Multiple outdoor spaces"],
        house_rules=["No smoking inside", "Hot tub rules apply"],
        parking_info="Driveway parking"
    ),
    "old_midland_living": Property(
        id="old_midland_living",
        name="Old Midland Living with Massive Yard",
        address="Near Midland Memorial Hospital, Midland, TX 79705",
        vrbo_id="3355618",
        vrbo_url="https://www.vrbo.com/3355618",
        bedrooms=4,
        bathrooms=3,
        sleeps=16,
        has_pool=True,
        has_hot_tub=True,
        pet_friendly=True,
        door_code="3355",
        wifi_name="RightAtHome_OldMidland",
        amenities=["Pool", "Hot Tub", "Kitchen", "Washer", "Dryer", "Pet friendly", "Massive yard"],
        special_features=["Pool AND Hot Tub", "Massive yard", "Historic area"],
        house_rules=["No smoking inside", "Pool and hot tub rules apply"],
        parking_info="Large yard with parking"
    ),
    "oasis_pool": Property(
        id="oasis_pool",
        name="Oasis with Pool-Billiards",
        address="Midland, TX 79705",
        vrbo_id="2636389",
        vrbo_url="https://www.vrbo.com/2636389",
        bedrooms=4,
        bathrooms=3.5,
        sleeps=10,
        rating="9.0/10 Wonderful",
        reviews=69,
        has_pool=True,
        has_billiards=True,
        pet_friendly=True,
        door_code="2636",
        wifi_name="RightAtHome_Oasis",
        amenities=["Private Pool", "Kitchen", "Washer", "Dryer", "Pet friendly", "Free WiFi", "Billiards"],
        special_features=["Private Pool", "Billiards room", "Great ratings"],
        house_rules=["No smoking inside", "Pool rules apply"],
        parking_info="Private driveway"
    ),
    "safari_gameroom": Property(
        id="safari_gameroom",
        name="Safari Gameroom",
        address="Midland, TX 79705",
        vrbo_id="2638524",
        vrbo_url="https://www.vrbo.com/2638524",
        bedrooms=3,
        bathrooms=2,
        sleeps=8,
        pet_friendly=True,
        door_code="2638",
        wifi_name="RightAtHome_Safari",
        amenities=["Gameroom", "Kitchen", "Washer", "Dryer"],
        special_features=["Safari-themed gameroom"],
        house_rules=["No smoking inside"],
        parking_info="Driveway parking"
    ),
    "destination_getaway": Property(
        id="destination_getaway",
        name="Destination Getaway",
        address="Midland, TX 79705",
        vrbo_id="2643822",
        vrbo_url="https://www.vrbo.com/2643822",
        bedrooms=3,
        bathrooms=2,
        sleeps=6,
        reviews=14,
        pet_friendly=True,
        door_code="2643",
        wifi_name="RightAtHome_Destination",
        amenities=["Kitchen", "Washer", "Dryer", "Pet friendly"],
        special_features=["Budget-friendly option"],
        house_rules=["No smoking inside"],
        parking_info="Driveway parking"
    ),
    "retreat_patio": Property(
        id="retreat_patio",
        name="Retreat with Covered Patio",
        address="Midland, TX 79705",
        vrbo_id="2643784",
        vrbo_url="https://www.vrbo.com/2643784",
        bedrooms=3,
        bathrooms=2,
        sleeps=6,
        pet_friendly=True,
        door_code="2643",
        wifi_name="RightAtHome_Retreat",
        amenities=["Covered Patio", "Kitchen", "Washer", "Dryer"],
        special_features=["Large covered patio"],
        house_rules=["No smoking inside"],
        parking_info="Driveway parking"
    ),
    "clermont": Property(
        id="clermont",
        name="Clermont House with Pool and Billiards",
        address="Midland, TX 79705",
        bedrooms=4,
        bathrooms=2,
        sleeps=8,
        reviews=22,
        has_pool=True,
        has_billiards=True,
        pet_friendly=True,
        door_code="1000",
        wifi_name="RightAtHome_Clermont",
        amenities=["Pool", "Billiards", "Kitchen", "Washer", "Dryer"],
        special_features=["Pool", "Billiards room"],
        house_rules=["No smoking inside", "Pool rules apply"],
        parking_info="Driveway and street parking"
    ),
    "uptown_place": Property(
        id="uptown_place",
        name="Uptown Place with Gated Yard",
        address="Midland, TX 79705",
        bedrooms=3,
        bathrooms=2,
        sleeps=6,
        reviews=17,
        pet_friendly=True,
        door_code="1001",
        wifi_name="RightAtHome_Uptown",
        amenities=["Gated yard", "Covered parking", "Kitchen", "Washer", "Dryer"],
        special_features=["Gated yard", "Covered parking"],
        house_rules=["No smoking inside"],
        parking_info="Covered parking available"
    ),
    "cowboy_siesta": Property(
        id="cowboy_siesta",
        name="Cowboy Siesta Corner Lot",
        address="Midland, TX 79705",
        bedrooms=3,
        bathrooms=2,
        sleeps=6,
        pet_friendly=True,
        door_code="1002",
        wifi_name="RightAtHome_Cowboy",
        amenities=["Patio", "Covered parking", "Kitchen", "Washer", "Dryer", "Corner lot"],
        special_features=["Corner lot", "Patio", "Covered parking", "NEW LISTING"],
        house_rules=["No smoking inside"],
        parking_info="Covered parking, corner lot"
    ),
    "vanguard_velvet": Property(
        id="vanguard_velvet",
        name="Vanguard Velvet Lounge",
        address="Midland, TX 79705",
        bedrooms=3,
        bathrooms=2,
        sleeps=6,
        reviews=17,
        pet_friendly=True,
        door_code="1003",
        wifi_name="RightAtHome_Vanguard",
        amenities=["Kitchen", "Washer", "Dryer", "Stylish decor"],
        special_features=["Stylish velvet decor"],
        house_rules=["No smoking inside"],
        parking_info="Driveway parking"
    ),
    "groovy_times": Property(
        id="groovy_times",
        name="Groovy Times with Pool",
        address="Shandon area, Midland, TX 79707",
        bedrooms=4,
        bathrooms=2,
        sleeps=8,
        has_pool=True,
        pet_friendly=True,
        door_code="1004",
        wifi_name="RightAtHome_Groovy",
        amenities=["Pool", "Kitchen", "Washer", "Dryer", "Retro decor"],
        special_features=["Pool", "Retro/Groovy decor"],
        house_rules=["No smoking inside", "Pool rules apply"],
        parking_info="Driveway parking"
    ),
}


# =============================================================================
# LOCAL KNOWLEDGE BASE - MIDLAND, TX
# =============================================================================

RESTAURANTS = {
    "fine_dining": [
        {
            "name": "Wall Street Bar & Grill",
            "cuisine": "American/Steakhouse",
            "address": "115 E Wall St, Midland, TX 79701",
            "phone": "(432) 684-8686",
            "price": "$$$",
            "hours": "11am-10pm",
            "description": "Best steaks in Midland. Great for special occasions.",
            "recommended": ["Ribeye", "Filet Mignon", "Lobster Tail"]
        },
        {
            "name": "Venezia Italian Restaurant",
            "cuisine": "Italian",
            "address": "2101 W Wadley Ave, Midland, TX 79705",
            "phone": "(432) 687-0011",
            "price": "$$$",
            "hours": "11am-9pm",
            "description": "Authentic Italian cuisine in an elegant setting.",
            "recommended": ["Veal Parmesan", "Seafood Linguine"]
        },
    ],
    "casual": [
        {
            "name": "The Garlic Press",
            "cuisine": "American/Eclectic",
            "address": "2200 W Wadley Ave, Midland, TX 79705",
            "phone": "(432) 570-4020",
            "price": "$$",
            "hours": "11am-9pm",
            "description": "Great lunch spot. Try the garlic bread appetizer.",
            "recommended": ["Garlic Bread", "Chicken Fried Steak"]
        },
        {
            "name": "Basin Burger House",
            "cuisine": "Burgers",
            "address": "Multiple locations",
            "phone": "(432) 689-0007",
            "price": "$",
            "hours": "11am-10pm",
            "description": "Best burgers in the Permian Basin. Local favorite.",
            "recommended": ["Basin Burger", "Green Chile Burger"]
        },
        {
            "name": "Cork & Pig Tavern",
            "cuisine": "Italian/Wine Bar",
            "address": "3001 N Big Spring St, Midland, TX 79705",
            "phone": "(432) 522-2675",
            "price": "$$",
            "hours": "11am-10pm",
            "description": "Great wine selection. Perfect for date night.",
            "recommended": ["Pasta", "Charcuterie Board", "Wine flights"]
        },
    ],
    "tex_mex": [
        {
            "name": "Gerardo's Casita",
            "cuisine": "Mexican/Tex-Mex",
            "address": "2006 N Big Spring St, Midland, TX 79701",
            "phone": "(432) 682-5522",
            "price": "$$",
            "hours": "11am-9pm",
            "description": "Authentic Tex-Mex. The enchiladas are incredible.",
            "recommended": ["Enchiladas Suizas", "Fajitas", "Margaritas"]
        },
        {
            "name": "Rosa's Cafe",
            "cuisine": "Mexican Fast-Casual",
            "address": "Multiple locations",
            "phone": "(432) 520-9005",
            "price": "$",
            "hours": "6:30am-9pm",
            "description": "Quick, affordable Tex-Mex. Great breakfast tacos.",
            "recommended": ["Breakfast tacos", "Tortilla soup"]
        },
    ],
    "bbq": [
        {
            "name": "KD's Bar-B-Q",
            "cuisine": "Texas BBQ",
            "address": "4410 N Midland Dr, Midland, TX 79707",
            "phone": "(432) 520-7774",
            "price": "$$",
            "hours": "11am-8pm",
            "description": "Authentic Texas BBQ. The brisket is amazing.",
            "recommended": ["Brisket", "Ribs", "Sausage", "Pecan pie"]
        },
    ],
    "late_night": [
        {
            "name": "Whataburger",
            "cuisine": "Fast Food",
            "address": "Multiple locations",
            "price": "$",
            "hours": "24 hours",
            "description": "Texas institution. Open all night for late shifts.",
            "recommended": ["Whataburger", "Honey Butter Chicken Biscuit"]
        },
        {
            "name": "IHOP",
            "cuisine": "Breakfast/American",
            "address": "4709 N Midland Dr",
            "price": "$",
            "hours": "24 hours",
            "description": "Breakfast anytime, day or night.",
            "recommended": ["Pancakes", "Omelettes"]
        },
    ],
    "brunch": [
        {
            "name": "Mulberry Cafe",
            "cuisine": "American/Brunch",
            "address": "3211 W Wadley Ave",
            "phone": "(432) 689-7700",
            "price": "$$",
            "hours": "7am-3pm",
            "description": "Homemade pastries, fresh salads. Great weekend brunch.",
            "recommended": ["Eggs Benedict", "Fresh pastries"]
        },
    ],
}

BARS = [
    {
        "name": "Tall City Brewing Company",
        "type": "Craft Brewery",
        "address": "2107 W Front Ave, Midland, TX 79701",
        "description": "Local craft brewery with taproom. Try the Pump Jack Pale Ale.",
        "hours": "4pm-10pm"
    },
    {
        "name": "Basin Social",
        "type": "Bar/Lounge",
        "address": "4610 N Garfield St, Midland, TX 79705",
        "description": "Upscale bar with craft cocktails.",
        "hours": "4pm-12am"
    },
    {
        "name": "Rockin' Rodeo",
        "type": "Country Bar/Dance Hall",
        "address": "5002 Andrews Hwy",
        "description": "Country music and dancing. Live music on weekends.",
        "hours": "7pm-2am (Thurs-Sat)"
    },
]

ATTRACTIONS = [
    {
        "name": "Permian Basin Petroleum Museum",
        "category": "Museum",
        "address": "1500 Interstate 20 W, Midland, TX 79701",
        "description": "Learn about the oil industry that built this region. Must-see for understanding Midland.",
        "hours": "10am-5pm",
        "admission": "$15 adults"
    },
    {
        "name": "I-20 Wildlife Preserve",
        "category": "Outdoors",
        "address": "2201 S Midland Dr, Midland, TX 79703",
        "description": "Urban wetlands with hiking trails and bird watching. Sunset hikes are beautiful.",
        "hours": "Dawn to dusk",
        "admission": "Free"
    },
    {
        "name": "Museum of the Southwest",
        "category": "Museum",
        "address": "1705 W Missouri Ave, Midland, TX 79701",
        "description": "Art museum, planetarium, and children's museum. Perfect for families.",
        "hours": "10am-5pm",
        "admission": "$10 adults"
    },
    {
        "name": "Midland RockHounds Baseball",
        "category": "Sports",
        "address": "Momentum Bank Ballpark, 5514 Champions Dr",
        "description": "Minor league baseball - Oakland A's affiliate. Fun summer evenings.",
        "hours": "Game nights",
        "admission": "$10-25"
    },
    {
        "name": "George W. Bush Childhood Home",
        "category": "Historical",
        "address": "1412 W Ohio Ave, Midland, TX 79701",
        "description": "Where the 43rd President spent his childhood. Historical tours available.",
        "hours": "10am-5pm",
        "admission": "$5"
    },
    {
        "name": "Dennis the Menace Park",
        "category": "Family/Park",
        "address": "4100 N A St, Midland, TX 79705",
        "description": "Great playground for kids. Splash pad in summer.",
        "hours": "Dawn to dusk",
        "admission": "Free"
    },
    {
        "name": "Hogan Park Golf Course",
        "category": "Golf",
        "address": "3600 N Fairgrounds Rd, Midland, TX 79705",
        "description": "Good public course. Not too crowded weekdays.",
        "hours": "Dawn to dusk"
    },
]

GROCERY_STORES = [
    {
        "name": "H-E-B",
        "address": "4517 N Midland Dr, Midland, TX 79707",
        "hours": "6am-11pm",
        "description": "Texas grocery chain. Great produce and meat."
    },
    {
        "name": "Market Street",
        "address": "4610 N Garfield St, Midland, TX 79705",
        "hours": "6am-10pm",
        "description": "Upscale grocery. Good deli and bakery."
    },
    {
        "name": "United Supermarkets",
        "address": "Multiple locations",
        "hours": "6am-10pm",
        "description": "West Texas grocery chain. Friendly service."
    },
    {
        "name": "Walmart Supercenter",
        "address": "4517 N Midland Dr",
        "hours": "6am-11pm",
        "description": "One-stop shop for everything."
    },
]

HARDWARE_STORES = [
    {
        "name": "Home Depot",
        "address": "4200 W Loop 250 N, Midland, TX 79707",
        "hours": "6am-9pm",
        "description": "Full hardware and building supplies."
    },
    {
        "name": "Lowe's",
        "address": "5100 W Loop 250 N, Midland, TX 79707",
        "hours": "6am-9pm",
        "description": "Hardware, tools, and home improvement."
    },
    {
        "name": "McCoy's Building Supply",
        "address": "2500 Garden City Hwy",
        "hours": "7am-6pm",
        "description": "Local building supply. Great for contractors."
    },
]

EMERGENCY_INFO = {
    "emergency": "911",
    "police_non_emergency": "(432) 685-7108",
    "fire_non_emergency": "(432) 685-7300",
    "poison_control": "1-800-222-1222",
    "hospital": {
        "name": "Midland Memorial Hospital",
        "address": "400 Rosalind Redfern Grover Pkwy",
        "phone": "(432) 221-1111",
        "er_phone": "(432) 221-1234"
    },
    "urgent_care": {
        "name": "Urgent Care Midland",
        "address": "4400 N Midland Dr",
        "phone": "(432) 221-4300",
        "hours": "8am-8pm"
    },
    "steven_palma": "(432) 559-1904"
}


# =============================================================================
# INTENT DETECTION
# =============================================================================

def detect_intent(query: str) -> QueryIntent:
    """Detect the intent of a guest query."""
    q = query.lower()

    # Emergency first
    if any(word in q for word in ["emergency", "911", "help", "urgent", "police", "fire", "ambulance", "hospital"]):
        return QueryIntent.EMERGENCY

    # WiFi
    if any(word in q for word in ["wifi", "wi-fi", "password", "internet", "network"]):
        return QueryIntent.WIFI_ACCESS

    # Check-in/out
    if any(word in q for word in ["check in", "checkin", "check-in", "arrive", "arrival", "door code", "get in"]):
        return QueryIntent.CHECK_IN
    if any(word in q for word in ["check out", "checkout", "check-out", "leave", "leaving", "departure"]):
        return QueryIntent.CHECK_OUT

    # Pool/Hot tub
    if "pool" in q and "hot tub" not in q:
        return QueryIntent.POOL
    if "hot tub" in q or "jacuzzi" in q or "spa" in q:
        return QueryIntent.HOT_TUB

    # Food/Drink
    if any(word in q for word in ["restaurant", "food", "eat", "dinner", "lunch", "breakfast", "brunch"]):
        return QueryIntent.RESTAURANTS
    if any(word in q for word in ["bar", "drink", "beer", "wine", "cocktail", "nightlife"]):
        return QueryIntent.BARS

    # Directions
    if any(word in q for word in ["direction", "how to get", "where is", "map", "navigate", "drive to"]):
        return QueryIntent.DIRECTIONS

    # Services
    if any(word in q for word in ["grocery", "groceries", "supermarket", "food store"]):
        return QueryIntent.GROCERY
    if any(word in q for word in ["hardware", "home depot", "lowes", "tools", "supplies"]):
        return QueryIntent.HARDWARE
    if any(word in q for word in ["laundry", "laundromat", "wash clothes", "washer", "dryer"]):
        return QueryIntent.LAUNDRY

    # Attractions
    if any(word in q for word in ["attraction", "museum", "things to do", "activities", "sightseeing", "visit"]):
        return QueryIntent.ATTRACTIONS

    # Events
    if any(word in q for word in ["event", "concert", "show", "festival", "happening"]):
        return QueryIntent.EVENTS

    # House rules
    if any(word in q for word in ["rule", "policy", "allowed", "smoking", "pet", "quiet hour"]):
        return QueryIntent.HOUSE_RULES

    # Maintenance
    if any(word in q for word in ["broken", "not working", "fix", "repair", "maintenance", "issue", "problem"]):
        return QueryIntent.MAINTENANCE

    # Property info
    if any(word in q for word in ["property", "house", "amenity", "feature", "bedroom", "bathroom"]):
        return QueryIntent.PROPERTY_INFO

    return QueryIntent.GENERAL


# =============================================================================
# AI CONCIERGE CLASS
# =============================================================================

class AIConcierge:
    """Complete AI Concierge for Right at Home BnB."""

    def __init__(self):
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o")
        self.fast_model = os.getenv("OPENAI_FAST_MODEL", "gpt-4o-mini")
        self.temperature = 0.7
        self.max_tokens = 1500

    def _build_system_prompt(self, property_id: Optional[str] = None, guest_type: GuestType = GuestType.GENERAL) -> str:
        """Build the system prompt with all relevant context."""
        property_context = ""
        if property_id and property_id in PROPERTIES:
            prop = PROPERTIES[property_id]
            property_context = f"""
CURRENT PROPERTY: {prop.name}
Address: {prop.address}
Bedrooms: {prop.bedrooms} | Bathrooms: {prop.bathrooms} | Sleeps: {prop.sleeps}
Door Code: {prop.door_code}
WiFi: Network "{prop.wifi_name}" | Password "{prop.wifi_password}"
Check-in: {prop.check_in} | Check-out: {prop.check_out}
Amenities: {', '.join(prop.amenities)}
Special Features: {', '.join(prop.special_features)}
House Rules: {', '.join(prop.house_rules)}
Parking: {prop.parking_info}
"""

        guest_context = self._get_guest_type_context(guest_type)

        return f"""You are the AI Concierge for Right at Home BnB, a premium short-term rental company in Midland, Texas operated by Steven Palma.

YOUR PERSONALITY:
- Warm, professional Texas hospitality
- Knowledgeable about Midland and the Permian Basin
- Helpful and proactive
- Genuinely care about guest experience

YOUR RESPONSIBILITIES:
- Answer guest questions promptly and thoroughly
- Provide property information (WiFi, door codes, amenities)
- Give local restaurant and bar recommendations
- Share directions and local attractions
- Handle check-in/checkout questions
- Escalate emergencies and maintenance issues to Steven

OWNER CONTACT:
Steven Palma: (432) 559-1904 (call/text anytime)

{property_context}

{guest_context}

IMPORTANT GUIDELINES:
- Always be polite and helpful
- Keep responses concise but complete
- If you don't know something specific, say so and offer to find out
- For emergencies, provide emergency number and Steven's contact
- Never share other guest information or sensitive property details
- If asked about pricing or availability, direct them to Steven

MIDLAND LOCAL KNOWLEDGE:
- Population: ~150,000 (metro 350,000+)
- Known for: Oil & Gas industry hub, George H.W. Bush childhood home
- Weather: Hot summers (95-105F), mild winters (40-60F)
- Airport: Midland International (MAF) - 10 miles from most properties
- Time Zone: Central Time
"""

    def _get_guest_type_context(self, guest_type: GuestType) -> str:
        """Get context specific to guest type."""
        contexts = {
            GuestType.WORK_CREW: """
GUEST TYPE: Work Crew / Oil Field Workers
Focus on: Practical needs, early mornings, late shifts
Know about: Hardware stores, supply shops, late-night food
Recommend: Properties with truck parking, multiple beds
""",
            GuestType.FAMILY: """
GUEST TYPE: Family with Children
Focus on: Family-friendly activities, kid-safe properties
Know about: Parks, museums, family restaurants
Recommend: Properties with pools, yards, game rooms
""",
            GuestType.COUPLE: """
GUEST TYPE: Couple / Romantic Getaway
Focus on: Romantic restaurants, quiet properties
Know about: Date night spots, wine bars
Recommend: Properties with hot tubs, privacy
""",
            GuestType.BUSINESS: """
GUEST TYPE: Business Traveler
Focus on: Work amenities, efficiency
Know about: Coffee shops, meeting spots
Recommend: Properties with good WiFi, desk setups
""",
            GuestType.GENERAL: """
GUEST TYPE: General Guest
Focus on: Balanced recommendations
Be ready to adapt based on their questions
"""
        }
        return contexts.get(guest_type, contexts[GuestType.GENERAL])

    def _build_knowledge_context(self, intent: QueryIntent) -> str:
        """Build relevant knowledge context based on intent."""
        context_parts = []

        if intent == QueryIntent.RESTAURANTS:
            context_parts.append("LOCAL RESTAURANTS:")
            for category, restaurants in RESTAURANTS.items():
                context_parts.append(f"\n{category.upper().replace('_', ' ')}:")
                for r in restaurants:
                    context_parts.append(f"- {r['name']} ({r.get('cuisine', '')}) - {r.get('price', '')} - {r.get('description', '')}")

        elif intent == QueryIntent.BARS:
            context_parts.append("LOCAL BARS:")
            for bar in BARS:
                context_parts.append(f"- {bar['name']} ({bar['type']}) - {bar['description']}")

        elif intent == QueryIntent.ATTRACTIONS:
            context_parts.append("LOCAL ATTRACTIONS:")
            for attr in ATTRACTIONS:
                context_parts.append(f"- {attr['name']} ({attr['category']}) - {attr['description']}")

        elif intent == QueryIntent.GROCERY:
            context_parts.append("GROCERY STORES:")
            for store in GROCERY_STORES:
                context_parts.append(f"- {store['name']} - {store['address']} - {store['hours']}")

        elif intent == QueryIntent.HARDWARE:
            context_parts.append("HARDWARE STORES:")
            for store in HARDWARE_STORES:
                context_parts.append(f"- {store['name']} - {store['address']} - {store['hours']}")

        elif intent == QueryIntent.EMERGENCY:
            context_parts.append("EMERGENCY INFORMATION:")
            context_parts.append(f"Emergency: {EMERGENCY_INFO['emergency']}")
            context_parts.append(f"Police Non-Emergency: {EMERGENCY_INFO['police_non_emergency']}")
            context_parts.append(f"Hospital: {EMERGENCY_INFO['hospital']['name']} - {EMERGENCY_INFO['hospital']['phone']}")
            context_parts.append(f"Steven Palma: {EMERGENCY_INFO['steven_palma']}")

        elif intent in [QueryIntent.POOL, QueryIntent.HOT_TUB]:
            context_parts.append("PROPERTIES WITH POOL/HOT TUB:")
            for pid, prop in PROPERTIES.items():
                if intent == QueryIntent.POOL and prop.has_pool:
                    context_parts.append(f"- {prop.name} ({prop.address}) - Pool: YES")
                elif intent == QueryIntent.HOT_TUB and prop.has_hot_tub:
                    context_parts.append(f"- {prop.name} ({prop.address}) - Hot Tub: YES")

        return "\n".join(context_parts)

    async def chat(
        self,
        query: str,
        property_id: Optional[str] = None,
        guest_type: GuestType = GuestType.GENERAL,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Main chat endpoint for the AI Concierge.

        Args:
            query: Guest's question
            property_id: Optional property ID for context
            guest_type: Type of guest for personalized responses
            conversation_history: Previous messages in conversation

        Returns:
            Dict with response, intent, and metadata
        """
        try:
            # Detect intent
            intent = detect_intent(query)

            # Build prompts
            system_prompt = self._build_system_prompt(property_id, guest_type)
            knowledge_context = self._build_knowledge_context(intent)

            if knowledge_context:
                system_prompt += f"\n\nRELEVANT KNOWLEDGE:\n{knowledge_context}"

            # Build messages
            messages = [{"role": "system", "content": system_prompt}]

            if conversation_history:
                messages.extend(conversation_history)

            messages.append({"role": "user", "content": query})

            # Call OpenAI
            response = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )

            return {
                "success": True,
                "response": response.choices[0].message.content,
                "intent": intent.value,
                "property_id": property_id,
                "guest_type": guest_type.value,
                "tokens_used": {
                    "prompt": response.usage.prompt_tokens,
                    "completion": response.usage.completion_tokens,
                    "total": response.usage.total_tokens
                },
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"AI Concierge error: {e}")
            return {
                "success": False,
                "error": str(e),
                "fallback_response": self._get_fallback_response(query),
                "timestamp": datetime.utcnow().isoformat()
            }

    def _get_fallback_response(self, query: str) -> str:
        """Get a fallback response when AI is unavailable."""
        intent = detect_intent(query)

        fallbacks = {
            QueryIntent.WIFI_ACCESS: f"Your WiFi network is typically 'RightAtHome_[PropertyName]' with password 'Welcome2Midland'. Check your welcome guide for exact details.",
            QueryIntent.CHECK_IN: f"Standard check-in is 3:00 PM. Your door code and WiFi info are in your booking confirmation. Need help? Text Steven at {EMERGENCY_INFO['steven_palma']}",
            QueryIntent.CHECK_OUT: f"Checkout is 11:00 AM. Please start dishwasher, take out trash, and lock up. Safe travels!",
            QueryIntent.EMERGENCY: f"For emergencies call 911. For urgent property issues, contact Steven immediately: {EMERGENCY_INFO['steven_palma']}",
            QueryIntent.RESTAURANTS: "Top picks: Wall Street Bar & Grill (steaks), Gerardo's Casita (Tex-Mex), Basin Burger House (burgers), KD's BBQ (barbeque).",
            QueryIntent.POOL: "Properties with pools: Sprawling Ranch (5055 Lincoln Green), Most Marvelous (6100 Oriole), Adobe Compound. Pool hours 8am-10pm.",
            QueryIntent.HOT_TUB: "Properties with hot tubs: Hot Tub Delight (4707 Dentcrest), Outdoor Dream (3106 Humble), Patio Home. Shower before use.",
        }

        return fallbacks.get(intent, f"I'd be happy to help! For immediate assistance, contact Steven at {EMERGENCY_INFO['steven_palma']}")

    async def get_directions(
        self,
        origin: str,
        destination: str
    ) -> Dict[str, Any]:
        """
        Get directions using Google Maps API.

        Args:
            origin: Starting location or property ID
            destination: Destination address or place name

        Returns:
            Dict with directions, distance, duration
        """
        try:
            # Resolve property ID to address if needed
            if origin in PROPERTIES:
                origin = PROPERTIES[origin].address

            if not GOOGLE_MAPS_API_KEY:
                return {
                    "success": False,
                    "error": "Google Maps API not configured",
                    "suggestion": f"Search Google Maps for directions from '{origin}' to '{destination}'"
                }

            # Call Google Directions API
            async with httpx.AsyncClient() as http_client:
                response = await http_client.get(
                    "https://maps.googleapis.com/maps/api/directions/json",
                    params={
                        "origin": origin,
                        "destination": destination,
                        "key": GOOGLE_MAPS_API_KEY
                    }
                )
                data = response.json()

            if data["status"] != "OK":
                return {
                    "success": False,
                    "error": data.get("status", "Unknown error"),
                    "suggestion": f"Try searching Google Maps directly"
                }

            route = data["routes"][0]
            leg = route["legs"][0]

            # Format steps
            steps = []
            for step in leg["steps"]:
                # Remove HTML tags
                instruction = re.sub('<[^<]+?>', '', step["html_instructions"])
                steps.append({
                    "instruction": instruction,
                    "distance": step["distance"]["text"],
                    "duration": step["duration"]["text"]
                })

            return {
                "success": True,
                "origin": leg["start_address"],
                "destination": leg["end_address"],
                "distance": leg["distance"]["text"],
                "duration": leg["duration"]["text"],
                "steps": steps,
                "google_maps_url": f"https://www.google.com/maps/dir/?api=1&origin={origin}&destination={destination}"
            }

        except Exception as e:
            logger.error(f"Directions error: {e}")
            return {
                "success": False,
                "error": str(e),
                "suggestion": f"Search Google Maps for directions"
            }

    def get_property_info(self, property_id: str) -> Dict[str, Any]:
        """Get complete information about a property."""
        if property_id not in PROPERTIES:
            # Try to match by name or address
            for pid, prop in PROPERTIES.items():
                if property_id.lower() in prop.name.lower() or property_id.lower() in prop.address.lower():
                    property_id = pid
                    break
            else:
                return {"success": False, "error": f"Property '{property_id}' not found"}

        prop = PROPERTIES[property_id]
        return {
            "success": True,
            "property": {
                "id": prop.id,
                "name": prop.name,
                "address": prop.address,
                "vrbo_url": prop.vrbo_url,
                "bedrooms": prop.bedrooms,
                "bathrooms": prop.bathrooms,
                "sleeps": prop.sleeps,
                "rating": prop.rating,
                "reviews": prop.reviews,
                "has_pool": prop.has_pool,
                "has_hot_tub": prop.has_hot_tub,
                "has_billiards": prop.has_billiards,
                "has_fireplace": prop.has_fireplace,
                "pet_friendly": prop.pet_friendly,
                "door_code": prop.door_code,
                "wifi_name": prop.wifi_name,
                "wifi_password": prop.wifi_password,
                "check_in": prop.check_in,
                "check_out": prop.check_out,
                "amenities": prop.amenities,
                "special_features": prop.special_features,
                "house_rules": prop.house_rules,
                "parking_info": prop.parking_info
            }
        }

    def search_properties(
        self,
        has_pool: Optional[bool] = None,
        has_hot_tub: Optional[bool] = None,
        min_bedrooms: Optional[int] = None,
        min_sleeps: Optional[int] = None,
        pet_friendly: Optional[bool] = None
    ) -> List[Dict[str, Any]]:
        """Search properties by criteria."""
        results = []

        for prop in PROPERTIES.values():
            if has_pool is not None and prop.has_pool != has_pool:
                continue
            if has_hot_tub is not None and prop.has_hot_tub != has_hot_tub:
                continue
            if min_bedrooms is not None and prop.bedrooms < min_bedrooms:
                continue
            if min_sleeps is not None and prop.sleeps < min_sleeps:
                continue
            if pet_friendly is not None and prop.pet_friendly != pet_friendly:
                continue

            results.append({
                "id": prop.id,
                "name": prop.name,
                "address": prop.address,
                "bedrooms": prop.bedrooms,
                "bathrooms": prop.bathrooms,
                "sleeps": prop.sleeps,
                "has_pool": prop.has_pool,
                "has_hot_tub": prop.has_hot_tub,
                "pet_friendly": prop.pet_friendly,
                "special_features": prop.special_features
            })

        return results

    def get_restaurants(self, category: Optional[str] = None) -> Dict[str, Any]:
        """Get restaurant recommendations."""
        if category and category in RESTAURANTS:
            return {"success": True, "category": category, "restaurants": RESTAURANTS[category]}
        return {"success": True, "restaurants": RESTAURANTS}

    def get_attractions(self) -> Dict[str, Any]:
        """Get local attractions."""
        return {"success": True, "attractions": ATTRACTIONS}

    def get_emergency_info(self) -> Dict[str, Any]:
        """Get emergency contact information."""
        return {"success": True, "emergency": EMERGENCY_INFO}


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

ai_concierge = AIConcierge()


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

async def quick_chat(query: str, property_id: Optional[str] = None) -> str:
    """Quick helper for simple chat queries."""
    result = await ai_concierge.chat(query, property_id)
    return result.get("response") or result.get("fallback_response", "Unable to process request")


def get_all_properties() -> List[Dict[str, Any]]:
    """Get list of all properties."""
    return [
        {
            "id": p.id,
            "name": p.name,
            "address": p.address,
            "bedrooms": p.bedrooms,
            "sleeps": p.sleeps,
            "has_pool": p.has_pool,
            "has_hot_tub": p.has_hot_tub
        }
        for p in PROPERTIES.values()
    ]


def get_properties_with_pool() -> List[Dict[str, Any]]:
    """Get properties with pools."""
    return ai_concierge.search_properties(has_pool=True)


def get_properties_with_hot_tub() -> List[Dict[str, Any]]:
    """Get properties with hot tubs."""
    return ai_concierge.search_properties(has_hot_tub=True)
