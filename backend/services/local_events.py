"""
Right At Home BnB - Local Events & VRBO Integration
====================================================
Integrate local attractions and events for guest experience:
- VRBO booking sync
- City of Midland events
- Permian Basin concerts and shows
- Local restaurants and attractions
- Oilfield industry events
- University events (UTPB, Midland College)

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from enum import Enum
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


class EventCategory(str, Enum):
    CONCERT = "concert"
    FESTIVAL = "festival"
    SPORTS = "sports"
    THEATER = "theater"
    COMMUNITY = "community"
    OILFIELD = "oilfield"
    FOOD_DRINK = "food_drink"
    FAMILY = "family"
    OUTDOOR = "outdoor"
    EDUCATION = "education"


class AttractionCategory(str, Enum):
    RESTAURANT = "restaurant"
    BAR = "bar"
    MUSEUM = "museum"
    PARK = "park"
    SHOPPING = "shopping"
    ENTERTAINMENT = "entertainment"
    OUTDOORS = "outdoors"
    FAMILY = "family"
    HISTORICAL = "historical"


# Steven's curated local favorites
STEVENS_PICKS = {
    "restaurants": [
        {
            "name": "Wall Street Bar & Grill",
            "category": "restaurant",
            "cuisine": "American/Steakhouse",
            "address": "115 E Wall St, Midland, TX 79701",
            "phone": "(432) 684-8686",
            "price_range": "$$$",
            "steven_notes": "Best steaks in Midland. Great for special occasions.",
            "recommended_dishes": ["Ribeye", "Filet Mignon", "Lobster Tail"]
        },
        {
            "name": "The Garlic Press",
            "category": "restaurant",
            "cuisine": "American/Eclectic",
            "address": "2200 W Wadley Ave, Midland, TX 79705",
            "phone": "(432) 570-4020",
            "price_range": "$$",
            "steven_notes": "Great lunch spot. Try the garlic bread appetizer.",
            "recommended_dishes": ["Garlic Bread", "Chicken Fried Steak"]
        },
        {
            "name": "Basin Burger House",
            "category": "restaurant",
            "cuisine": "Burgers",
            "address": "Multiple locations",
            "phone": "(432) 689-0007",
            "price_range": "$",
            "steven_notes": "Best burgers in the Permian Basin. Local favorite.",
            "recommended_dishes": ["Basin Burger", "Green Chile Burger"]
        },
        {
            "name": "Gerardo's Casita",
            "category": "restaurant",
            "cuisine": "Mexican",
            "address": "2006 N Big Spring St, Midland, TX 79701",
            "phone": "(432) 682-5522",
            "price_range": "$$",
            "steven_notes": "Authentic Tex-Mex. The enchiladas are incredible.",
            "recommended_dishes": ["Enchiladas Suizas", "Fajitas", "Margaritas"]
        },
        {
            "name": "Cork & Pig Tavern",
            "category": "restaurant",
            "cuisine": "Italian/Wine Bar",
            "address": "3001 N Big Spring St, Midland, TX 79705",
            "phone": "(432) 522-2675",
            "price_range": "$$",
            "steven_notes": "Great wine selection. Perfect for date night.",
            "recommended_dishes": ["Pasta", "Charcuterie Board"]
        }
    ],
    "attractions": [
        {
            "name": "Permian Basin Petroleum Museum",
            "category": "museum",
            "address": "1500 Interstate 20 W, Midland, TX 79701",
            "description": "Learn about the oil industry that built this region.",
            "steven_notes": "Must-see for understanding Midland. Great for all ages."
        },
        {
            "name": "I-20 Wildlife Preserve",
            "category": "outdoors",
            "address": "2201 S Midland Dr, Midland, TX 79703",
            "description": "Urban wetlands with hiking trails and bird watching.",
            "steven_notes": "Peaceful escape. Sunset hikes are beautiful."
        },
        {
            "name": "Museum of the Southwest",
            "category": "museum",
            "address": "1705 W Missouri Ave, Midland, TX 79701",
            "description": "Art museum, planetarium, and children's museum.",
            "steven_notes": "Perfect for families. The planetarium shows are great."
        },
        {
            "name": "Midland RockHounds Baseball",
            "category": "sports",
            "address": "Momentum Bank Ballpark, 5514 Champions Dr",
            "description": "Minor league baseball - Oakland A's affiliate.",
            "steven_notes": "Fun summer evenings. Cheap tickets, great family outing."
        },
        {
            "name": "Tall City Brewing Company",
            "category": "bar",
            "address": "2107 W Front Ave, Midland, TX 79701",
            "description": "Local craft brewery with taproom.",
            "steven_notes": "Best local beer. Try the Pump Jack Pale Ale."
        }
    ],
    "outdoor_activities": [
        {
            "name": "Hogan Park Golf Course",
            "category": "golf",
            "address": "3600 N Fairgrounds Rd, Midland, TX 79705",
            "steven_notes": "Good public course. Not too crowded weekdays."
        },
        {
            "name": "Dennis the Menace Park",
            "category": "park",
            "address": "4100 N A St, Midland, TX 79705",
            "steven_notes": "Great playground for kids. Splash pad in summer."
        }
    ]
}

# Recurring local events
RECURRING_EVENTS = [
    {
        "name": "First Friday Art Trail",
        "category": "community",
        "frequency": "first_friday",
        "location": "Downtown Midland",
        "description": "Monthly art walk with local galleries and live music.",
        "time": "5:00 PM - 9:00 PM"
    },
    {
        "name": "Midland Farmers Market",
        "category": "community",
        "frequency": "saturday",
        "location": "Museum of the Southwest",
        "description": "Fresh local produce and artisan goods.",
        "time": "8:00 AM - 12:00 PM",
        "season": "year_round"
    },
    {
        "name": "Food Truck Friday",
        "category": "food_drink",
        "frequency": "friday",
        "location": "Centennial Plaza, Downtown",
        "description": "Rotating food trucks every Friday.",
        "time": "11:00 AM - 2:00 PM"
    }
]


class LocalEventsService:
    """
    Local events and attractions integration for guest experience.
    Integrates with VRBO, local event calendars, and curated recommendations.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.events_collection = "rah_local_events"
        self.vrbo_bookings_collection = "rah_vrbo_bookings"
        self.guest_recommendations_collection = "rah_guest_recommendations"

        # VRBO API credentials
        self.vrbo_partner_id = os.getenv("VRBO_PARTNER_ID")
        self.vrbo_api_key = os.getenv("VRBO_API_KEY")

        # Local event APIs
        self.eventbrite_token = os.getenv("EVENTBRITE_TOKEN")
        self.ticketmaster_key = os.getenv("TICKETMASTER_API_KEY")

    # =========================================================================
    # VRBO INTEGRATION
    # =========================================================================

    async def sync_vrbo_bookings(self, property_id: int = None) -> Dict[str, Any]:
        """Sync bookings from VRBO."""
        # In production, would call VRBO Partner API
        # https://partner.vrbo.com/documentation

        logger.info(f"Syncing VRBO bookings for property {property_id or 'all'}")

        # Demo response
        synced_bookings = [
            {
                "vrbo_reservation_id": "VRB123456",
                "property_id": property_id or 1,
                "guest_name": "Michael Thompson",
                "check_in": (date.today() + timedelta(days=5)).isoformat(),
                "check_out": (date.today() + timedelta(days=8)).isoformat(),
                "guests": 4,
                "total_amount": 850.00,
                "status": "confirmed",
                "source": "vrbo"
            },
            {
                "vrbo_reservation_id": "VRB789012",
                "property_id": property_id or 2,
                "guest_name": "Sarah Williams",
                "check_in": (date.today() + timedelta(days=10)).isoformat(),
                "check_out": (date.today() + timedelta(days=12)).isoformat(),
                "guests": 2,
                "total_amount": 420.00,
                "status": "confirmed",
                "source": "vrbo"
            }
        ]

        if self.firebase_available and db:
            for booking in synced_bookings:
                db.collection(self.vrbo_bookings_collection).document(
                    booking["vrbo_reservation_id"]
                ).set(booking, merge=True)

        return {
            "success": True,
            "synced_count": len(synced_bookings),
            "bookings": synced_bookings
        }

    async def get_vrbo_calendar(self, property_id: int, month: int = None, year: int = None) -> Dict[str, Any]:
        """Get VRBO calendar/availability."""
        today = date.today()
        month = month or today.month
        year = year or today.year

        # Demo calendar data
        calendar_data = {
            "property_id": property_id,
            "month": month,
            "year": year,
            "booked_dates": [
                (today + timedelta(days=5)).isoformat(),
                (today + timedelta(days=6)).isoformat(),
                (today + timedelta(days=7)).isoformat(),
                (today + timedelta(days=15)).isoformat(),
                (today + timedelta(days=16)).isoformat(),
            ],
            "blocked_dates": [],
            "pricing": {
                "base_rate": 145.00,
                "weekend_rate": 175.00,
                "cleaning_fee": 100.00
            }
        }

        return calendar_data

    async def update_vrbo_pricing(
        self,
        property_id: int,
        base_rate: float,
        weekend_rate: float = None,
        special_dates: Dict[str, float] = None
    ) -> Dict[str, Any]:
        """Update VRBO listing pricing."""
        # Would call VRBO API to update pricing
        logger.info(f"Updating VRBO pricing for property {property_id}: ${base_rate}/night")

        return {
            "success": True,
            "property_id": property_id,
            "new_base_rate": base_rate,
            "new_weekend_rate": weekend_rate or base_rate * 1.2
        }

    # =========================================================================
    # LOCAL EVENTS
    # =========================================================================

    async def get_upcoming_events(
        self,
        start_date: str = None,
        end_date: str = None,
        category: EventCategory = None,
        limit: int = 20
    ) -> List[Dict]:
        """Get upcoming local events."""
        start = date.fromisoformat(start_date) if start_date else date.today()
        end = date.fromisoformat(end_date) if end_date else start + timedelta(days=30)

        # Would aggregate from multiple sources (Eventbrite, Ticketmaster, local calendars)
        events = [
            {
                "id": "evt_001",
                "name": "Permian Basin Oil Show",
                "category": "oilfield",
                "date": (start + timedelta(days=15)).isoformat(),
                "time": "9:00 AM - 5:00 PM",
                "location": "Ector County Coliseum, Odessa",
                "description": "Largest oil and gas expo in the Permian Basin. 1,200+ exhibitors.",
                "price": "Free",
                "url": "https://pbofs.com",
                "relevance": "Major regional event - expect high hotel/BnB demand"
            },
            {
                "id": "evt_002",
                "name": "RockHounds vs. Amarillo Sod Poodles",
                "category": "sports",
                "date": (start + timedelta(days=3)).isoformat(),
                "time": "7:00 PM",
                "location": "Momentum Bank Ballpark",
                "description": "Minor league baseball game. Fireworks Friday!",
                "price": "$10-25",
                "url": "https://milb.com/midland"
            },
            {
                "id": "evt_003",
                "name": "First Friday Art Trail",
                "category": "community",
                "date": self._get_next_first_friday(start).isoformat(),
                "time": "5:00 PM - 9:00 PM",
                "location": "Downtown Midland",
                "description": "Monthly art walk with galleries, live music, and food vendors.",
                "price": "Free"
            },
            {
                "id": "evt_004",
                "name": "Tall City Blues Fest",
                "category": "concert",
                "date": (start + timedelta(days=20)).isoformat(),
                "time": "4:00 PM - 11:00 PM",
                "location": "Centennial Plaza",
                "description": "Annual blues music festival featuring national and regional acts.",
                "price": "$25-50"
            },
            {
                "id": "evt_005",
                "name": "Midland Farmers Market",
                "category": "community",
                "date": self._get_next_saturday(start).isoformat(),
                "time": "8:00 AM - 12:00 PM",
                "location": "Museum of the Southwest",
                "description": "Fresh produce, baked goods, and artisan crafts.",
                "price": "Free entry"
            },
            {
                "id": "evt_006",
                "name": "Bush Family Ranch Rodeo",
                "category": "community",
                "date": (start + timedelta(days=25)).isoformat(),
                "time": "6:00 PM",
                "location": "Bush Family Ranch, Midland",
                "description": "Traditional ranch rodeo with authentic West Texas hospitality.",
                "price": "$30-75"
            },
            {
                "id": "evt_007",
                "name": "Midland Symphony Orchestra",
                "category": "theater",
                "date": (start + timedelta(days=12)).isoformat(),
                "time": "7:30 PM",
                "location": "Wagner Noel Performing Arts Center",
                "description": "Classical concert featuring works by Beethoven and Tchaikovsky.",
                "price": "$25-65"
            }
        ]

        # Filter by category if specified
        if category:
            events = [e for e in events if e.get("category") == category.value]

        return events[:limit]

    def _get_next_first_friday(self, start_date: date) -> date:
        """Get the next first Friday of a month."""
        if start_date.day <= 7:
            # Check if first Friday is this week
            first_of_month = start_date.replace(day=1)
            days_until_friday = (4 - first_of_month.weekday()) % 7
            first_friday = first_of_month + timedelta(days=days_until_friday)
            if first_friday >= start_date:
                return first_friday

        # Get first Friday of next month
        if start_date.month == 12:
            next_month = start_date.replace(year=start_date.year + 1, month=1, day=1)
        else:
            next_month = start_date.replace(month=start_date.month + 1, day=1)

        days_until_friday = (4 - next_month.weekday()) % 7
        return next_month + timedelta(days=days_until_friday)

    def _get_next_saturday(self, start_date: date) -> date:
        """Get the next Saturday."""
        days_until_saturday = (5 - start_date.weekday()) % 7
        if days_until_saturday == 0:
            days_until_saturday = 7
        return start_date + timedelta(days=days_until_saturday)

    async def get_concerts(self, days_ahead: int = 60) -> List[Dict]:
        """Get upcoming concerts in the area."""
        # Would use Ticketmaster Discovery API
        concerts = [
            {
                "name": "George Strait",
                "venue": "Permian Basin Arena",
                "date": (date.today() + timedelta(days=45)).isoformat(),
                "price_range": "$75 - $250",
                "genre": "Country",
                "note": "Major event - book properties ASAP!"
            },
            {
                "name": "Pat Green",
                "venue": "The Blue Light Live",
                "date": (date.today() + timedelta(days=20)).isoformat(),
                "price_range": "$35 - $60",
                "genre": "Texas Country"
            },
            {
                "name": "Whiskey Myers",
                "venue": "Odessa Marriott Hotel & Conference Center",
                "date": (date.today() + timedelta(days=30)).isoformat(),
                "price_range": "$45 - $100",
                "genre": "Southern Rock/Country"
            }
        ]

        return concerts

    # =========================================================================
    # STEVEN'S RECOMMENDATIONS
    # =========================================================================

    async def get_stevens_picks(
        self,
        category: str = None
    ) -> Dict[str, Any]:
        """Get Steven's personally curated recommendations."""
        picks = STEVENS_PICKS.copy()

        if category:
            return {category: picks.get(category, [])}

        return picks

    async def get_guest_recommendations(
        self,
        guest_preferences: Dict = None,
        stay_length: int = 2,
        has_kids: bool = False,
        budget: str = "moderate"
    ) -> Dict[str, Any]:
        """Generate personalized recommendations for a guest."""
        recommendations = {
            "dining": [],
            "attractions": [],
            "events": [],
            "tips": []
        }

        # Always include some favorites
        recommendations["dining"] = STEVENS_PICKS["restaurants"][:3]
        recommendations["attractions"] = STEVENS_PICKS["attractions"][:3]

        # Adjust for families
        if has_kids:
            recommendations["tips"].append(
                "Check out Dennis the Menace Park - great playground and splash pad!"
            )
            recommendations["tips"].append(
                "Museum of the Southwest has excellent kids' exhibits and a planetarium."
            )
            family_attractions = [a for a in STEVENS_PICKS["attractions"] if "family" in a.get("steven_notes", "").lower()]
            recommendations["attractions"].extend(family_attractions)

        # Get upcoming events during stay
        events = await self.get_upcoming_events(limit=5)
        recommendations["events"] = events

        # General tips
        recommendations["tips"].extend([
            "Midland is in the Central Time Zone.",
            "Summer temps can reach 100°F+ - stay hydrated!",
            "Best BBQ is at KD's in Midland - don't miss it.",
            "For authentic Tex-Mex, Gerardo's Casita is the local favorite."
        ])

        return recommendations

    async def get_area_info(self) -> Dict[str, Any]:
        """Get general Midland/Permian Basin area information."""
        return {
            "region": "Permian Basin",
            "city": "Midland",
            "state": "Texas",
            "population": "150,000+ (metro area 350,000+)",
            "known_for": [
                "Oil and Gas Industry Hub",
                "George H.W. Bush childhood home",
                "Gateway to Big Bend National Park",
                "West Texas hospitality"
            ],
            "weather": {
                "summer": "Hot and dry (95-105°F)",
                "winter": "Mild (40-60°F, occasional freezes)",
                "rainfall": "Low (12-14 inches/year)"
            },
            "airports": [
                {"code": "MAF", "name": "Midland International Air & Space Port", "distance": "10 miles"},
                {"code": "ODS", "name": "Odessa-Schlemeyer Field", "distance": "25 miles"}
            ],
            "major_employers": [
                "Chevron", "Pioneer Natural Resources", "Apache Corporation",
                "Diamondback Energy", "Midland Memorial Hospital"
            ],
            "nearby_attractions": [
                {"name": "Big Bend National Park", "distance": "200 miles", "drive_time": "3.5 hours"},
                {"name": "Carlsbad Caverns", "distance": "140 miles", "drive_time": "2.5 hours"},
                {"name": "Guadalupe Mountains", "distance": "175 miles", "drive_time": "3 hours"},
                {"name": "Monahans Sandhills State Park", "distance": "40 miles", "drive_time": "45 minutes"}
            ]
        }

    async def get_demand_forecast(self, days_ahead: int = 30) -> Dict[str, Any]:
        """Forecast demand based on local events."""
        today = date.today()
        events = await self.get_upcoming_events(limit=50)
        concerts = await self.get_concerts(days_ahead)

        high_demand_dates = []

        # Flag major events
        for event in events:
            if "oil show" in event.get("name", "").lower():
                high_demand_dates.append({
                    "date": event["date"],
                    "event": event["name"],
                    "demand": "VERY_HIGH",
                    "recommendation": "Increase prices 30-50%"
                })
            elif event.get("category") == "oilfield":
                high_demand_dates.append({
                    "date": event["date"],
                    "event": event["name"],
                    "demand": "HIGH",
                    "recommendation": "Increase prices 20-30%"
                })

        for concert in concerts:
            if any(x in concert.get("name", "").lower() for x in ["george strait", "garth brooks", "luke combs"]):
                high_demand_dates.append({
                    "date": concert["date"],
                    "event": concert["name"],
                    "demand": "VERY_HIGH",
                    "recommendation": "Increase prices 40-60%"
                })

        return {
            "forecast_period": f"{today.isoformat()} to {(today + timedelta(days=days_ahead)).isoformat()}",
            "high_demand_dates": high_demand_dates,
            "base_demand": "MODERATE",
            "notes": "Oilfield industry events typically drive highest demand in Midland area."
        }


# Singleton instance
local_events_service = LocalEventsService()
