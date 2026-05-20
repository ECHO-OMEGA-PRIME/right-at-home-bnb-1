"""
Airbnb Integration Module for Right at Home BnB
Supports iCal sync (public) and prepares for future API integration

Airbnb API requires Partner status - apply at:
https://www.airbnb.com/partner
"""

import httpx
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from icalendar import Calendar, Event
from loguru import logger


@dataclass
class AirbnbBooking:
    """Parsed booking from Airbnb iCal"""
    uid: str
    summary: str
    start_date: datetime
    end_date: datetime
    description: Optional[str] = None
    guest_name: Optional[str] = None
    confirmation_code: Optional[str] = None


@dataclass
class AirbnbProperty:
    """Airbnb property configuration"""
    property_id: int
    airbnb_listing_id: str
    ical_import_url: str
    ical_export_url: str
    last_sync: Optional[datetime] = None


class AirbnbiCalSync:
    """
    Airbnb iCal Calendar Synchronization
    
    Airbnb iCal URL format:
    https://www.airbnb.com/calendar/ical/[LISTING_ID].ics?s=[SECRET_KEY]
    
    To get your Airbnb iCal URL:
    1. Go to Airbnb Host Dashboard
    2. Select Calendar
    3. Click "Availability settings"
    4. Under "Connect calendars" click "Connect to another website"
    5. Copy the iCal link
    
    Sync frequency: Airbnb updates approximately every 3 hours
    """
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.properties: Dict[int, AirbnbProperty] = {}
        
    async def fetch_airbnb_calendar(self, ical_url: str) -> List[AirbnbBooking]:
        """Fetch and parse Airbnb iCal calendar"""
        try:
            response = await self.client.get(ical_url)
            response.raise_for_status()
            
            cal = Calendar.from_ical(response.text)
            bookings = []
            
            for component in cal.walk():
                if component.name == "VEVENT":
                    start = component.get('dtstart')
                    end = component.get('dtend')
                    
                    booking = AirbnbBooking(
                        uid=str(component.get('uid', '')),
                        summary=str(component.get('summary', 'Airbnb Booking')),
                        start_date=start.dt if start else None,
                        end_date=end.dt if end else None,
                        description=str(component.get('description', ''))
                    )
                    
                    # Parse guest info from Airbnb format
                    # Airbnb summary format: "Reserved" or "Not available"
                    if 'Reserved' in booking.summary:
                        booking.guest_name = self._extract_guest_name(booking.description)
                        booking.confirmation_code = self._extract_confirmation(booking.uid)
                    
                    bookings.append(booking)
                    
            logger.info(f"Fetched {len(bookings)} events from Airbnb iCal")
            return bookings
            
        except Exception as e:
            logger.error(f"Failed to fetch Airbnb calendar: {e}")
            return []
    
    def _extract_guest_name(self, description: str) -> Optional[str]:
        """Extract guest name from description"""
        if not description:
            return None
        # Airbnb includes guest phone in description sometimes
        lines = description.split('\n')
        if lines:
            return lines[0].strip()
        return None
    
    def _extract_confirmation(self, uid: str) -> Optional[str]:
        """Extract confirmation code from UID"""
        # Airbnb UIDs contain the confirmation code
        # Format varies but often: XXXXX@airbnb.com
        if '@' in uid:
            return uid.split('@')[0][-10:]  # Last 10 chars before @
        return uid[:10] if uid else None
    
    def generate_ical_export(self, bookings: List[Dict]) -> str:
        """Generate iCal content to export TO Airbnb"""
        cal = Calendar()
        cal.add('prodid', '-//Right at Home BnB//EN')
        cal.add('version', '2.0')
        cal.add('calscale', 'GREGORIAN')
        cal.add('method', 'PUBLISH')
        
        for booking in bookings:
            event = Event()
            event.add('uid', f"rah-{booking['id']}@rah-midland.com")
            event.add('dtstart', booking['check_in'])
            event.add('dtend', booking['check_out'])
            event.add('summary', 'Not available')  # Airbnb standard
            event.add('description', f"Blocked by Right at Home BnB")
            event.add('dtstamp', datetime.now())
            cal.add_component(event)
        
        return cal.to_ical().decode('utf-8')
    
    async def sync_property(self, property_id: int) -> Dict[str, Any]:
        """Full sync for a property"""
        if property_id not in self.properties:
            return {"error": "Property not configured for Airbnb sync"}
        
        prop = self.properties[property_id]
        airbnb_bookings = await self.fetch_airbnb_calendar(prop.ical_import_url)
        prop.last_sync = datetime.now()
        
        return {
            "property_id": property_id,
            "airbnb_listing_id": prop.airbnb_listing_id,
            "bookings_imported": len(airbnb_bookings),
            "bookings": [
                {
                    "uid": b.uid,
                    "guest_name": b.guest_name,
                    "check_in": b.start_date.isoformat() if b.start_date else None,
                    "check_out": b.end_date.isoformat() if b.end_date else None,
                    "confirmation": b.confirmation_code
                }
                for b in airbnb_bookings
            ],
            "last_sync": prop.last_sync.isoformat()
        }
    
    def register_property(
        self, 
        property_id: int, 
        airbnb_listing_id: str,
        ical_import_url: str
    ) -> AirbnbProperty:
        """Register a property for Airbnb sync"""
        ical_export_url = f"https://api.rah-midland.com/ical/{property_id}/airbnb.ics"
        
        prop = AirbnbProperty(
            property_id=property_id,
            airbnb_listing_id=airbnb_listing_id,
            ical_import_url=ical_import_url,
            ical_export_url=ical_export_url
        )
        
        self.properties[property_id] = prop
        logger.info(f"Registered property {property_id} for Airbnb sync")
        return prop


# =====================================================
# AIRBNB API Integration (Requires Partner Status)
# =====================================================
# Airbnb's official API is restricted to approved partners
# Apply at: https://www.airbnb.com/partner
#
# For most property managers, iCal sync is sufficient
# iCal provides:
# - Availability sync (blocked dates)
# - Basic booking info
#
# Full API (partner only) provides:
# - Real-time reservations
# - Guest details
# - Messaging
# - Pricing management
# - Review management
# =====================================================
