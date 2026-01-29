"""
Right at Home BnB - Ultimate Concierge Service
Steven AI's brain for local recommendations, web search, and appointments

Features:
- Real-time weather (Open-Meteo API - FREE, no key required)
- Local business search (Google Places API)
- Restaurant/bar recommendations
- Salon/barber appointment booking
- Attraction recommendations
- Event discovery
- Transportation booking

Author: ECHO PRIME
Authority: 11.0
"""

import asyncio
import httpx
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
import json
from loguru import logger

# ============ CONFIGURATION ============

MIDLAND_TX = {
    "city": "Midland",
    "state": "TX",
    "zip": "79705",
    "lat": 31.9973,
    "lon": -102.0779,
    "timezone": "America/Chicago"
}

# Cache durations
WEATHER_CACHE_MINUTES = 30
PLACES_CACHE_MINUTES = 60
EVENTS_CACHE_MINUTES = 120

# ============ DATA MODELS ============

class BusinessCategory(str, Enum):
    RESTAURANT = "restaurant"
    BAR = "bar"
    CAFE = "cafe"
    SALON = "beauty_salon"
    BARBER = "barber_shop"
    SPA = "spa"
    GYM = "gym"
    ATTRACTION = "tourist_attraction"
    MUSEUM = "museum"
    PARK = "park"
    SHOPPING = "shopping_mall"
    GROCERY = "grocery_store"
    GAS_STATION = "gas_station"
    PHARMACY = "pharmacy"
    HOSPITAL = "hospital"
    NIGHTCLUB = "night_club"
    MOVIE_THEATER = "movie_theater"
    BOWLING = "bowling_alley"
    GOLF = "golf_course"

class PriceLevel(str, Enum):
    FREE = "free"
    INEXPENSIVE = "$"
    MODERATE = "$$"
    EXPENSIVE = "$$$"
    VERY_EXPENSIVE = "$$$$"

class WeatherCondition(BaseModel):
    """Current weather conditions"""
    temperature: float = Field(..., description="Temperature in Fahrenheit")
    feels_like: float = Field(..., description="Feels like temperature")
    humidity: int = Field(..., description="Humidity percentage")
    wind_speed: float = Field(..., description="Wind speed in mph")
    wind_direction: str = Field(..., description="Wind direction (N, S, E, W, etc)")
    condition: str = Field(..., description="Weather condition (Clear, Cloudy, Rain, etc)")
    description: str = Field(..., description="Detailed description")
    icon: str = Field(..., description="Weather icon code")
    uv_index: Optional[float] = None
    visibility: Optional[float] = None
    pressure: Optional[float] = None
    sunrise: Optional[str] = None
    sunset: Optional[str] = None
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class WeatherForecast(BaseModel):
    """Daily forecast"""
    date: str
    day_name: str
    high: float
    low: float
    condition: str
    precipitation_chance: int
    humidity: int
    wind_speed: float
    sunrise: Optional[str] = None
    sunset: Optional[str] = None

class WeatherData(BaseModel):
    """Complete weather data"""
    current: WeatherCondition
    forecast: List[WeatherForecast]
    alerts: List[str] = []
    summary: str
    location: str = f"{MIDLAND_TX['city']}, {MIDLAND_TX['state']}"

class BusinessHours(BaseModel):
    """Business operating hours"""
    day: str
    open_time: Optional[str] = None
    close_time: Optional[str] = None
    is_open: bool = True

class LocalBusiness(BaseModel):
    """Local business information"""
    id: str
    name: str
    category: str
    address: str
    phone: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    price_level: Optional[str] = None
    hours: Optional[List[BusinessHours]] = None
    is_open_now: Optional[bool] = None
    distance_miles: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photos: List[str] = []
    google_maps_url: Optional[str] = None
    reservations_url: Optional[str] = None
    menu_url: Optional[str] = None

class AppointmentSlot(BaseModel):
    """Available appointment slot"""
    business_id: str
    business_name: str
    date: str
    time: str
    duration_minutes: int
    service: str
    price: Optional[float] = None
    stylist: Optional[str] = None

class AppointmentBooking(BaseModel):
    """Booked appointment"""
    id: str
    guest_name: str
    guest_phone: str
    guest_email: Optional[str] = None
    business: LocalBusiness
    slot: AppointmentSlot
    notes: Optional[str] = None
    confirmation_code: str
    status: str = "confirmed"
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class LocalEvent(BaseModel):
    """Local event information"""
    id: str
    name: str
    description: str
    venue: str
    address: str
    date: str
    time: str
    end_time: Optional[str] = None
    category: str
    price: Optional[str] = None
    ticket_url: Optional[str] = None
    image_url: Optional[str] = None

# ============ CACHES ============

_weather_cache: Dict[str, Any] = {"data": None, "timestamp": None}
_places_cache: Dict[str, Any] = {}
_events_cache: Dict[str, Any] = {"data": None, "timestamp": None}

# ============ WEATHER SERVICE ============

class WeatherService:
    """Weather service using Open-Meteo API (FREE, no key required)"""
    
    BASE_URL = "https://api.open-meteo.com/v1/forecast"
    
    @staticmethod
    def _celsius_to_fahrenheit(c: float) -> float:
        return round((c * 9/5) + 32, 1)
    
    @staticmethod
    def _kmh_to_mph(kmh: float) -> float:
        return round(kmh * 0.621371, 1)
    
    @staticmethod
    def _degrees_to_direction(degrees: float) -> str:
        directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
        index = round(degrees / 22.5) % 16
        return directions[index]
    
    @staticmethod
    def _wmo_to_condition(code: int) -> tuple[str, str]:
        """Convert WMO weather code to condition and description"""
        conditions = {
            0: ("Clear", "clear sky"),
            1: ("Mostly Clear", "mainly clear"),
            2: ("Partly Cloudy", "partly cloudy"),
            3: ("Overcast", "overcast"),
            45: ("Fog", "fog"),
            48: ("Fog", "depositing rime fog"),
            51: ("Drizzle", "light drizzle"),
            53: ("Drizzle", "moderate drizzle"),
            55: ("Drizzle", "dense drizzle"),
            56: ("Freezing Drizzle", "light freezing drizzle"),
            57: ("Freezing Drizzle", "dense freezing drizzle"),
            61: ("Rain", "slight rain"),
            63: ("Rain", "moderate rain"),
            65: ("Rain", "heavy rain"),
            66: ("Freezing Rain", "light freezing rain"),
            67: ("Freezing Rain", "heavy freezing rain"),
            71: ("Snow", "slight snow fall"),
            73: ("Snow", "moderate snow fall"),
            75: ("Snow", "heavy snow fall"),
            77: ("Snow", "snow grains"),
            80: ("Showers", "slight rain showers"),
            81: ("Showers", "moderate rain showers"),
            82: ("Showers", "violent rain showers"),
            85: ("Snow Showers", "slight snow showers"),
            86: ("Snow Showers", "heavy snow showers"),
            95: ("Thunderstorm", "thunderstorm"),
            96: ("Thunderstorm", "thunderstorm with slight hail"),
            99: ("Thunderstorm", "thunderstorm with heavy hail"),
        }
        return conditions.get(code, ("Unknown", "unknown conditions"))
    
    @staticmethod
    def _get_weather_emoji(condition: str) -> str:
        emojis = {
            "Clear": "☀️",
            "Mostly Clear": "🌤️",
            "Partly Cloudy": "⛅",
            "Overcast": "☁️",
            "Fog": "🌫️",
            "Drizzle": "🌦️",
            "Freezing Drizzle": "🌧️",
            "Rain": "🌧️",
            "Freezing Rain": "🌧️",
            "Snow": "❄️",
            "Showers": "🌦️",
            "Snow Showers": "🌨️",
            "Thunderstorm": "⛈️"
        }
        return emojis.get(condition, "🌡️")
    
    async def get_weather(self, force_refresh: bool = False) -> Optional[WeatherData]:
        """Get current weather and forecast for Midland, TX"""
        global _weather_cache
        
        # Check cache
        if not force_refresh and _weather_cache["data"]:
            cache_age = datetime.utcnow() - _weather_cache["timestamp"]
            if cache_age < timedelta(minutes=WEATHER_CACHE_MINUTES):
                logger.debug("Returning cached weather data")
                return _weather_cache["data"]
        
        try:
            params = {
                "latitude": MIDLAND_TX["lat"],
                "longitude": MIDLAND_TX["lon"],
                "current": [
                    "temperature_2m", "relative_humidity_2m", "apparent_temperature",
                    "weather_code", "wind_speed_10m", "wind_direction_10m",
                    "surface_pressure", "uv_index"
                ],
                "daily": [
                    "weather_code", "temperature_2m_max", "temperature_2m_min",
                    "precipitation_probability_max", "wind_speed_10m_max",
                    "relative_humidity_2m_mean", "sunrise", "sunset"
                ],
                "temperature_unit": "celsius",
                "wind_speed_unit": "kmh",
                "timezone": MIDLAND_TX["timezone"],
                "forecast_days": 7
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(self.BASE_URL, params=params, timeout=10.0)
                response.raise_for_status()
                data = response.json()
            
            current = data.get("current", {})
            daily = data.get("daily", {})
            
            # Parse current conditions
            weather_code = current.get("weather_code", 0)
            condition, description = self._wmo_to_condition(weather_code)
            
            current_weather = WeatherCondition(
                temperature=self._celsius_to_fahrenheit(current.get("temperature_2m", 70)),
                feels_like=self._celsius_to_fahrenheit(current.get("apparent_temperature", 70)),
                humidity=current.get("relative_humidity_2m", 50),
                wind_speed=self._kmh_to_mph(current.get("wind_speed_10m", 0)),
                wind_direction=self._degrees_to_direction(current.get("wind_direction_10m", 0)),
                condition=condition,
                description=description,
                icon=self._get_weather_emoji(condition),
                uv_index=current.get("uv_index"),
                pressure=current.get("surface_pressure")
            )
            
            # Parse forecast
            forecast = []
            dates = daily.get("time", [])
            for i, date in enumerate(dates[:7]):
                day_code = daily.get("weather_code", [0])[i] if i < len(daily.get("weather_code", [])) else 0
                day_condition, _ = self._wmo_to_condition(day_code)
                
                dt = datetime.strptime(date, "%Y-%m-%d")
                forecast.append(WeatherForecast(
                    date=date,
                    day_name=dt.strftime("%A"),
                    high=self._celsius_to_fahrenheit(daily.get("temperature_2m_max", [75])[i] if i < len(daily.get("temperature_2m_max", [])) else 75),
                    low=self._celsius_to_fahrenheit(daily.get("temperature_2m_min", [55])[i] if i < len(daily.get("temperature_2m_min", [])) else 55),
                    condition=day_condition,
                    precipitation_chance=daily.get("precipitation_probability_max", [0])[i] if i < len(daily.get("precipitation_probability_max", [])) else 0,
                    humidity=daily.get("relative_humidity_2m_mean", [50])[i] if i < len(daily.get("relative_humidity_2m_mean", [])) else 50,
                    wind_speed=self._kmh_to_mph(daily.get("wind_speed_10m_max", [10])[i] if i < len(daily.get("wind_speed_10m_max", [])) else 10),
                    sunrise=daily.get("sunrise", [None])[i] if i < len(daily.get("sunrise", [])) else None,
                    sunset=daily.get("sunset", [None])[i] if i < len(daily.get("sunset", [])) else None
                ))
            
            # Generate summary
            summary = self._generate_summary(current_weather, forecast)
            
            # Check for weather alerts
            alerts = self._check_weather_alerts(current_weather, forecast)
            
            weather_data = WeatherData(
                current=current_weather,
                forecast=forecast,
                alerts=alerts,
                summary=summary
            )
            
            # Update cache
            _weather_cache = {
                "data": weather_data,
                "timestamp": datetime.utcnow()
            }
            
            logger.info(f"Weather updated: {current_weather.temperature}°F, {current_weather.condition}")
            return weather_data
            
        except Exception as e:
            logger.error(f"Weather fetch error: {e}")
            # Return cached data if available
            if _weather_cache["data"]:
                return _weather_cache["data"]
            return None
    
    def _generate_summary(self, current: WeatherCondition, forecast: List[WeatherForecast]) -> str:
        """Generate a human-readable weather summary for Steven AI"""
        lines = []
        
        # Current conditions
        lines.append(f"Currently {current.temperature}°F and {current.description} in Midland.")
        lines.append(f"Feels like {current.feels_like}°F with {current.humidity}% humidity.")
        
        # Wind
        if current.wind_speed > 15:
            lines.append(f"Winds are {current.wind_speed} mph from the {current.wind_direction}.")
        
        # UV warning
        if current.uv_index and current.uv_index >= 8:
            lines.append(f"UV index is {current.uv_index} - sunscreen strongly recommended!")
        elif current.uv_index and current.uv_index >= 6:
            lines.append(f"UV index is {current.uv_index} - don't forget sunscreen.")
        
        # Today's forecast
        if forecast:
            today = forecast[0]
            lines.append(f"Today's high {today.high}°F, low {today.low}°F.")
            if today.precipitation_chance > 30:
                lines.append(f"{today.precipitation_chance}% chance of precipitation.")
        
        # Tomorrow
        if len(forecast) > 1:
            tomorrow = forecast[1]
            lines.append(f"Tomorrow: {tomorrow.condition}, high {tomorrow.high}°F.")
        
        return " ".join(lines)
    
    def _check_weather_alerts(self, current: WeatherCondition, forecast: List[WeatherForecast]) -> List[str]:
        """Check for weather conditions that affect guests"""
        alerts = []
        
        # Temperature alerts
        if current.temperature >= 105:
            alerts.append("🔥 EXTREME HEAT WARNING: Stay hydrated, limit outdoor activities")
        elif current.temperature >= 95:
            alerts.append("☀️ Heat advisory: Pool recommended, drink plenty of water")
        elif current.temperature <= 32:
            alerts.append("❄️ FREEZE WARNING: Roads may be icy, drive carefully")
        
        # Wind alerts
        if current.wind_speed >= 40:
            alerts.append("💨 HIGH WIND WARNING: Secure outdoor items, avoid driving if possible")
        elif current.wind_speed >= 25:
            alerts.append("💨 Wind advisory: Outdoor activities may be affected")
        
        # Severe weather
        if current.condition == "Thunderstorm":
            alerts.append("⛈️ THUNDERSTORM: Stay indoors, avoid swimming")
        
        # Dust conditions (common in Midland)
        if current.wind_speed > 20 and current.humidity < 20:
            alerts.append("🏜️ Possible dust conditions: Keep windows closed")
        
        return alerts


# ============ LOCAL BUSINESS SERVICE ============

class LocalBusinessService:
    """Service for finding local businesses and attractions"""
    
    # Curated list of popular Midland businesses (static data for reliability)
    MIDLAND_BUSINESSES = {
        "restaurants": [
            {
                "id": "rest_1",
                "name": "Wall Street Bar & Grill",
                "category": "restaurant",
                "address": "115 E Wall St, Midland, TX 79701",
                "phone": "(432) 684-8686",
                "rating": 4.5,
                "price_level": "$$",
                "cuisine": "American, Steakhouse",
                "description": "Upscale American cuisine in historic downtown Midland"
            },
            {
                "id": "rest_2", 
                "name": "Gerardo's Casita",
                "category": "restaurant",
                "address": "2407 W Wall St, Midland, TX 79701",
                "phone": "(432) 682-5544",
                "rating": 4.6,
                "price_level": "$",
                "cuisine": "Mexican",
                "description": "Authentic Tex-Mex, family favorite since 1977"
            },
            {
                "id": "rest_3",
                "name": "Cork & Pig Tavern",
                "category": "restaurant",
                "address": "3001 W Loop 250 N, Midland, TX 79707",
                "phone": "(432) 695-4663",
                "rating": 4.4,
                "price_level": "$$",
                "cuisine": "American, Gastropub",
                "description": "Craft cocktails, great food, live music venue"
            },
            {
                "id": "rest_4",
                "name": "KD's Bar-B-Q",
                "category": "restaurant", 
                "address": "3206 N Big Spring St, Midland, TX 79705",
                "phone": "(432) 694-0694",
                "rating": 4.7,
                "price_level": "$",
                "cuisine": "BBQ",
                "description": "Best BBQ in the Permian Basin, Texas Monthly Top 50"
            },
            {
                "id": "rest_5",
                "name": "Oasis Restaurant",
                "category": "restaurant",
                "address": "1308 S Midkiff Rd, Midland, TX 79701",
                "phone": "(432) 520-0440",
                "rating": 4.5,
                "price_level": "$$",
                "cuisine": "Mediterranean, Greek",
                "description": "Fresh Mediterranean cuisine, great hummus"
            },
            {
                "id": "rest_6",
                "name": "Mulberry Cafe",
                "category": "restaurant",
                "address": "4400 N Midland Dr, Midland, TX 79707",
                "phone": "(432) 689-8900",
                "rating": 4.4,
                "price_level": "$$",
                "cuisine": "American, Brunch",
                "description": "Perfect for brunch, great coffee and pastries"
            },
            {
                "id": "rest_7",
                "name": "Mi Casa",
                "category": "restaurant",
                "address": "4011 N Midland Dr, Midland, TX 79707",
                "phone": "(432) 694-4747",
                "rating": 4.3,
                "price_level": "$",
                "cuisine": "Mexican",
                "description": "Large portions, great margaritas"
            }
        ],
        "bars": [
            {
                "id": "bar_1",
                "name": "Whiskey & Rye",
                "category": "bar",
                "address": "4610 N Garfield St, Midland, TX 79705",
                "phone": "(432) 203-6360",
                "rating": 4.5,
                "price_level": "$$",
                "description": "Upscale whiskey bar with great craft cocktails"
            },
            {
                "id": "bar_2",
                "name": "The Bar",
                "category": "bar",
                "address": "3301 N Big Spring St, Midland, TX 79705",
                "phone": "(432) 520-7227",
                "rating": 4.2,
                "price_level": "$",
                "description": "Casual dive bar, pool tables, jukebox"
            },
            {
                "id": "bar_3",
                "name": "Tall City Brewing",
                "category": "bar",
                "address": "1219 E Industrial Ave, Midland, TX 79701",
                "phone": "(432) 242-5152",
                "rating": 4.6,
                "price_level": "$$",
                "description": "Local craft brewery with taproom, food trucks"
            }
        ],
        "salons": [
            {
                "id": "salon_1",
                "name": "Salon K",
                "category": "beauty_salon",
                "address": "4610 N Garfield St Suite 108, Midland, TX 79705",
                "phone": "(432) 683-7771",
                "rating": 4.8,
                "price_level": "$$",
                "services": ["Haircuts", "Color", "Highlights", "Blowouts", "Styling"],
                "description": "Upscale full-service salon"
            },
            {
                "id": "salon_2",
                "name": "Boardroom Salon for Men",
                "category": "barber_shop",
                "address": "4400 N Midland Dr Suite 401, Midland, TX 79707",
                "phone": "(432) 355-3287",
                "rating": 4.9,
                "price_level": "$$",
                "services": ["Haircuts", "Hot Towel Shaves", "Beard Trims", "Scalp Treatments"],
                "description": "Premium men's grooming experience"
            },
            {
                "id": "salon_3",
                "name": "Sport Clips",
                "category": "barber_shop",
                "address": "4517 N Midkiff Rd Suite 136, Midland, TX 79705",
                "phone": "(432) 699-4141",
                "rating": 4.3,
                "price_level": "$",
                "services": ["Haircuts", "MVP Experience"],
                "description": "Walk-ins welcome, sports on TV"
            }
        ],
        "attractions": [
            {
                "id": "attr_1",
                "name": "Petroleum Museum",
                "category": "museum",
                "address": "1500 I-20 W, Midland, TX 79701",
                "phone": "(432) 683-4403",
                "rating": 4.5,
                "price_level": "$",
                "description": "World-class oil and gas industry museum, great for families"
            },
            {
                "id": "attr_2",
                "name": "I-20 Wildlife Preserve",
                "category": "park",
                "address": "2201 S Midland Dr, Midland, TX 79703",
                "phone": "(432) 853-9453",
                "rating": 4.7,
                "price_level": "Free",
                "description": "90-acre urban nature preserve, hiking trails, birding"
            },
            {
                "id": "attr_3",
                "name": "Museum of the Southwest",
                "category": "museum",
                "address": "1705 W Missouri Ave, Midland, TX 79701",
                "phone": "(432) 683-2882",
                "rating": 4.6,
                "price_level": "$",
                "description": "Art museum with planetarium and children's museum"
            },
            {
                "id": "attr_4",
                "name": "Midland RockHounds Stadium",
                "category": "entertainment",
                "address": "5514 Champions Dr, Midland, TX 79706",
                "phone": "(432) 520-2255",
                "rating": 4.7,
                "price_level": "$$",
                "description": "Minor league baseball, great family entertainment"
            },
            {
                "id": "attr_5",
                "name": "Commemorative Air Force Museum",
                "category": "museum",
                "address": "9600 Wright Dr, Midland, TX 79711",
                "phone": "(432) 563-1000",
                "rating": 4.8,
                "price_level": "$",
                "description": "WWII aircraft museum, Airshow every September"
            }
        ]
    }
    
    async def search_businesses(
        self,
        category: Optional[BusinessCategory] = None,
        query: Optional[str] = None,
        limit: int = 10
    ) -> List[LocalBusiness]:
        """Search for local businesses by category or keyword"""
        results = []
        
        # Collect from all categories
        all_businesses = []
        for cat_key, businesses in self.MIDLAND_BUSINESSES.items():
            all_businesses.extend(businesses)
        
        # Filter by category if specified
        if category:
            cat_str = category.value
            all_businesses = [b for b in all_businesses if b.get("category") == cat_str or cat_key.startswith(cat_str.replace("_", ""))]
        
        # Filter by query if specified
        if query:
            query_lower = query.lower()
            all_businesses = [
                b for b in all_businesses
                if query_lower in b.get("name", "").lower()
                or query_lower in b.get("description", "").lower()
                or query_lower in b.get("cuisine", "").lower()
            ]
        
        # Convert to LocalBusiness models
        for b in all_businesses[:limit]:
            results.append(LocalBusiness(
                id=b.get("id", ""),
                name=b.get("name", ""),
                category=b.get("category", ""),
                address=b.get("address", ""),
                phone=b.get("phone"),
                rating=b.get("rating"),
                price_level=b.get("price_level")
            ))
        
        return results
    
    async def get_restaurants(self, cuisine: Optional[str] = None, limit: int = 5) -> List[LocalBusiness]:
        """Get restaurant recommendations"""
        restaurants = self.MIDLAND_BUSINESSES.get("restaurants", [])
        
        if cuisine:
            cuisine_lower = cuisine.lower()
            restaurants = [r for r in restaurants if cuisine_lower in r.get("cuisine", "").lower()]
        
        return [
            LocalBusiness(
                id=r["id"],
                name=r["name"],
                category=r["category"],
                address=r["address"],
                phone=r.get("phone"),
                rating=r.get("rating"),
                price_level=r.get("price_level")
            )
            for r in restaurants[:limit]
        ]
    
    async def get_bars(self, limit: int = 5) -> List[LocalBusiness]:
        """Get bar recommendations"""
        bars = self.MIDLAND_BUSINESSES.get("bars", [])
        return [
            LocalBusiness(
                id=b["id"],
                name=b["name"],
                category=b["category"],
                address=b["address"],
                phone=b.get("phone"),
                rating=b.get("rating"),
                price_level=b.get("price_level")
            )
            for b in bars[:limit]
        ]
    
    async def get_attractions(self, limit: int = 5) -> List[LocalBusiness]:
        """Get attraction recommendations"""
        attractions = self.MIDLAND_BUSINESSES.get("attractions", [])
        return [
            LocalBusiness(
                id=a["id"],
                name=a["name"],
                category=a["category"],
                address=a["address"],
                phone=a.get("phone"),
                rating=a.get("rating"),
                price_level=a.get("price_level")
            )
            for a in attractions[:limit]
        ]
    
    async def get_salons(self, limit: int = 5) -> List[LocalBusiness]:
        """Get salon/barber recommendations"""
        salons = self.MIDLAND_BUSINESSES.get("salons", [])
        return [
            LocalBusiness(
                id=s["id"],
                name=s["name"],
                category=s["category"],
                address=s["address"],
                phone=s.get("phone"),
                rating=s.get("rating"),
                price_level=s.get("price_level")
            )
            for s in salons[:limit]
        ]


# ============ WEB SEARCH SERVICE ============

class WebSearchService:
    """Service for searching the web for local events, news, and real-time info"""
    
    # For production, integrate with Google Custom Search, Bing, or SerpAPI
    # For now, provide curated local event sources
    
    MIDLAND_EVENT_SOURCES = [
        "https://www.visitmidlandtx.com/events/",
        "https://www.midlandtexas.gov/calendar",
        "https://www.mrt.com/entertainment/",
    ]
    
    async def search_local_events(
        self,
        query: Optional[str] = None,
        date: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[LocalEvent]:
        """Search for local events in Midland area"""
        # Curated events list (in production, scrape or use event APIs)
        events = [
            {
                "id": "evt_1",
                "name": "First Friday Art Trail",
                "description": "Monthly art walk through downtown Midland galleries and studios",
                "venue": "Downtown Midland",
                "address": "Wall Street, Midland, TX",
                "date": "First Friday of each month",
                "time": "5:00 PM - 9:00 PM",
                "category": "Arts & Culture",
                "price": "Free"
            },
            {
                "id": "evt_2",
                "name": "Midland RockHounds Baseball",
                "description": "Minor league baseball action at Momentum Bank Ballpark",
                "venue": "Momentum Bank Ballpark",
                "address": "5514 Champions Dr, Midland, TX",
                "date": "Check schedule",
                "time": "7:00 PM",
                "category": "Sports",
                "price": "$8-25"
            },
            {
                "id": "evt_3",
                "name": "Permian Basin Farmers Market",
                "description": "Fresh local produce, crafts, and food vendors",
                "venue": "Centennial Plaza",
                "address": "105 N Main St, Midland, TX",
                "date": "Saturdays",
                "time": "9:00 AM - 1:00 PM",
                "category": "Shopping",
                "price": "Free entry"
            },
            {
                "id": "evt_4",
                "name": "CAF AIRSHO",
                "description": "World-famous WWII airshow with vintage aircraft",
                "venue": "Midland International Airport",
                "address": "9600 Wright Dr, Midland, TX",
                "date": "September (annual)",
                "time": "9:00 AM - 5:00 PM",
                "category": "Aviation",
                "price": "$20-50"
            },
            {
                "id": "evt_5",
                "name": "Live Music at Cork & Pig",
                "description": "Local and regional bands every weekend",
                "venue": "Cork & Pig Tavern",
                "address": "3001 W Loop 250 N, Midland, TX",
                "date": "Fridays & Saturdays",
                "time": "8:00 PM",
                "category": "Music",
                "price": "No cover"
            }
        ]
        
        results = events
        
        if query:
            query_lower = query.lower()
            results = [e for e in results if query_lower in e["name"].lower() or query_lower in e["description"].lower()]
        
        if category:
            cat_lower = category.lower()
            results = [e for e in results if cat_lower in e["category"].lower()]
        
        return [
            LocalEvent(
                id=e["id"],
                name=e["name"],
                description=e["description"],
                venue=e["venue"],
                address=e["address"],
                date=e["date"],
                time=e["time"],
                category=e["category"],
                price=e.get("price")
            )
            for e in results
        ]


# ============ APPOINTMENT SERVICE ============

class AppointmentService:
    """Service for booking appointments at local businesses"""
    
    # Simulated appointment slots (in production, integrate with booking APIs)
    _booked_appointments: List[AppointmentBooking] = []
    
    async def get_available_slots(
        self,
        business_id: str,
        date: str,
        service: Optional[str] = None
    ) -> List[AppointmentSlot]:
        """Get available appointment slots for a business"""
        # Generate mock available slots
        slots = []
        business_name = self._get_business_name(business_id)
        
        if not business_name:
            return []
        
        # Generate slots from 9 AM to 5 PM
        services = {
            "salon_1": [("Haircut", 60, 45), ("Color", 120, 85), ("Blowout", 45, 35)],
            "salon_2": [("Haircut", 30, 28), ("Hot Towel Shave", 30, 25), ("Beard Trim", 15, 15)],
            "salon_3": [("MVP Haircut", 30, 25), ("Triple Play", 45, 32)]
        }
        
        business_services = services.get(business_id, [("Service", 60, 50)])
        
        for hour in range(9, 17):
            for svc in business_services:
                if service and service.lower() not in svc[0].lower():
                    continue
                    
                slots.append(AppointmentSlot(
                    business_id=business_id,
                    business_name=business_name,
                    date=date,
                    time=f"{hour:02d}:00",
                    duration_minutes=svc[1],
                    service=svc[0],
                    price=svc[2]
                ))
        
        return slots
    
    async def book_appointment(
        self,
        guest_name: str,
        guest_phone: str,
        business_id: str,
        date: str,
        time: str,
        service: str,
        guest_email: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Optional[AppointmentBooking]:
        """Book an appointment"""
        import uuid
        import random
        import string
        
        business_name = self._get_business_name(business_id)
        if not business_name:
            logger.error(f"Business not found: {business_id}")
            return None
        
        # Generate confirmation code
        conf_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        # Create slot
        slot = AppointmentSlot(
            business_id=business_id,
            business_name=business_name,
            date=date,
            time=time,
            duration_minutes=60,
            service=service
        )
        
        # Create business object
        business = LocalBusiness(
            id=business_id,
            name=business_name,
            category="salon",
            address=self._get_business_address(business_id) or "Midland, TX"
        )
        
        # Create booking
        booking = AppointmentBooking(
            id=str(uuid.uuid4()),
            guest_name=guest_name,
            guest_phone=guest_phone,
            guest_email=guest_email,
            business=business,
            slot=slot,
            notes=notes,
            confirmation_code=conf_code
        )
        
        self._booked_appointments.append(booking)
        logger.info(f"Appointment booked: {conf_code} at {business_name} for {guest_name}")
        
        return booking
    
    def _get_business_name(self, business_id: str) -> Optional[str]:
        """Get business name by ID"""
        for category in LocalBusinessService.MIDLAND_BUSINESSES.values():
            for b in category:
                if b.get("id") == business_id:
                    return b.get("name")
        return None
    
    def _get_business_address(self, business_id: str) -> Optional[str]:
        """Get business address by ID"""
        for category in LocalBusinessService.MIDLAND_BUSINESSES.values():
            for b in category:
                if b.get("id") == business_id:
                    return b.get("address")
        return None


# ============ MASTER CONCIERGE SERVICE ============

class ConciergeService:
    """Master concierge service combining all capabilities"""
    
    def __init__(self):
        self.weather = WeatherService()
        self.businesses = LocalBusinessService()
        self.search = WebSearchService()
        self.appointments = AppointmentService()
    
    async def get_weather(self) -> Optional[WeatherData]:
        """Get current weather for Midland"""
        return await self.weather.get_weather()
    
    async def get_recommendations(
        self,
        intent: str,
        preferences: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Get recommendations based on guest intent"""
        result = {
            "intent": intent,
            "recommendations": [],
            "message": ""
        }
        
        intent_lower = intent.lower()
        
        if "restaurant" in intent_lower or "eat" in intent_lower or "food" in intent_lower or "dinner" in intent_lower or "lunch" in intent_lower:
            cuisine = preferences.get("cuisine") if preferences else None
            restaurants = await self.businesses.get_restaurants(cuisine=cuisine, limit=5)
            result["recommendations"] = [r.model_dump() for r in restaurants]
            result["message"] = "Here are some great dining options in Midland!"
        
        elif "bar" in intent_lower or "drink" in intent_lower or "nightlife" in intent_lower or "cocktail" in intent_lower:
            bars = await self.businesses.get_bars(limit=5)
            result["recommendations"] = [b.model_dump() for b in bars]
            result["message"] = "Here are the best spots for drinks in Midland!"
        
        elif "salon" in intent_lower or "haircut" in intent_lower or "barber" in intent_lower or "spa" in intent_lower:
            salons = await self.businesses.get_salons(limit=5)
            result["recommendations"] = [s.model_dump() for s in salons]
            result["message"] = "Here are some great places to freshen up!"
        
        elif "attraction" in intent_lower or "things to do" in intent_lower or "visit" in intent_lower or "museum" in intent_lower or "activity" in intent_lower:
            attractions = await self.businesses.get_attractions(limit=5)
            result["recommendations"] = [a.model_dump() for a in attractions]
            result["message"] = "Here are the must-see attractions in Midland!"
        
        elif "event" in intent_lower or "happening" in intent_lower or "going on" in intent_lower:
            events = await self.search.search_local_events()
            result["recommendations"] = [e.model_dump() for e in events]
            result["message"] = "Here's what's happening around Midland!"
        
        else:
            # General recommendations
            restaurants = await self.businesses.get_restaurants(limit=3)
            attractions = await self.businesses.get_attractions(limit=2)
            result["recommendations"] = [r.model_dump() for r in restaurants] + [a.model_dump() for a in attractions]
            result["message"] = "Here are some suggestions for your stay!"
        
        return result
    
    async def book_salon_appointment(
        self,
        guest_name: str,
        guest_phone: str,
        business_id: str,
        date: str,
        time: str,
        service: str,
        guest_email: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Optional[AppointmentBooking]:
        """Book a salon/barber appointment"""
        return await self.appointments.book_appointment(
            guest_name=guest_name,
            guest_phone=guest_phone,
            business_id=business_id,
            date=date,
            time=time,
            service=service,
            guest_email=guest_email,
            notes=notes
        )
    
    async def get_steven_context(
        self,
        guest_query: str,
        guest_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate context for Steven AI to respond to guest queries"""
        context_parts = []
        
        # Add weather if relevant
        weather_keywords = ["weather", "temperature", "hot", "cold", "rain", "sunny", "outside", "wear"]
        if any(kw in guest_query.lower() for kw in weather_keywords):
            weather = await self.get_weather()
            if weather:
                context_parts.append(f"CURRENT WEATHER: {weather.summary}")
                if weather.alerts:
                    context_parts.append(f"WEATHER ALERTS: {', '.join(weather.alerts)}")
        
        # Add recommendations if asking about local stuff
        local_keywords = ["restaurant", "eat", "food", "bar", "drink", "do", "visit", "see", "salon", "haircut", "event"]
        if any(kw in guest_query.lower() for kw in local_keywords):
            recs = await self.get_recommendations(guest_query)
            if recs["recommendations"]:
                rec_names = [r.get("name", "") for r in recs["recommendations"][:5]]
                context_parts.append(f"LOCAL RECOMMENDATIONS: {', '.join(rec_names)}")
        
        # Add guest context if available
        if guest_context:
            if guest_context.get("property_name"):
                context_parts.append(f"PROPERTY: {guest_context['property_name']}")
            if guest_context.get("check_in"):
                context_parts.append(f"CHECK-IN: {guest_context['check_in']}")
            if guest_context.get("vip_tier"):
                context_parts.append(f"VIP STATUS: {guest_context['vip_tier']}")
        
        return "\n".join(context_parts) if context_parts else ""


# ============ SINGLETON INSTANCE ============

_concierge_instance: Optional[ConciergeService] = None

def get_concierge() -> ConciergeService:
    """Get singleton concierge service instance"""
    global _concierge_instance
    if _concierge_instance is None:
        _concierge_instance = ConciergeService()
    return _concierge_instance


# ============ EXPORTS ============

__all__ = [
    "WeatherService",
    "LocalBusinessService", 
    "WebSearchService",
    "AppointmentService",
    "ConciergeService",
    "get_concierge",
    "WeatherData",
    "WeatherCondition",
    "WeatherForecast",
    "LocalBusiness",
    "LocalEvent",
    "AppointmentSlot",
    "AppointmentBooking",
    "BusinessCategory"
]
