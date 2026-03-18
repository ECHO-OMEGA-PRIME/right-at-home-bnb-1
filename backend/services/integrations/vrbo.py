"""
VRBO Integration Module for Right at Home BnB
Supports iCal sync and prepares for future API integration

For full API access, apply at: https://integration-central.vrbo.com
Contact: pmsalesinquiry@expediagroup.com
"""

import httpx
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum
import asyncio
from icalendar import Calendar
from loguru import logger

class BookingPlatform(str, Enum):
    VRBO = "vrbo"
    AIRBNB = "airbnb"
    DIRECT = "direct"

@dataclass
class VRBOBooking:
    """Parsed booking from VRBO iCal"""
    uid: str
    summary: str
    start_date: datetime
    end_date: datetime
    description: Optional[str] = None
    location: Optional[str] = None
    guest_name: Optional[str] = None
    confirmation_code: Optional[str] = None

@dataclass
class VRBOProperty:
    """VRBO property configuration"""
    property_id: int
    vrbo_listing_id: str
    ical_import_url: str  # URL to import FROM VRBO
    ical_export_url: str  # URL to export TO VRBO
    last_sync: Optional[datetime] = None

class VRBOiCalSync:
    """
    VRBO iCal Calendar Synchronization
    
    VRBO iCal URLs format:
    Export (from VRBO): https://www.vrbo.com/icalendar/[listing_id].ics
    
    Sync frequency: VRBO updates every 60 minutes
    """
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.properties: Dict[int, VRBOProperty] = {}
        
    async def fetch_vrbo_calendar(self, ical_url: str) -> List[VRBOBooking]:
        """
        Fetch and parse VRBO iCal calendar
        
        Args:
            ical_url: VRBO iCal export URL (ends with .ics)
            
        Returns:
            List of parsed bookings
        """
        try:
            response = await self.client.get(ical_url)
            response.raise_for_status()
            
            cal = Calendar.from_ical(response.text)
            bookings = []
            
            for component in cal.walk():
                if component.name == "VEVENT":
                    booking = VRBOBooking(
                        uid=str(component.get('uid', '')),
                        summary=str(component.get('summary', 'VRBO Booking')),
                        start_date=component.get('dtstart').dt,
                        end_date=component.get('dtend').dt,
                        description=str(component.get('description', '')),
                        location=str(component.get('location', ''))
                    )
                    
                    # Parse guest name from summary/description if available
                    if 'Reserved' in booking.summary or 'Booked' in booking.summary:
                        booking.guest_name = self._extract_guest_name(booking.summary)
                    
                    # Extract confirmation code
                    booking.confirmation_code = self._extract_confirmation(booking.description)
                    
                    bookings.append(booking)
                    
            logger.info(f"Fetched {len(bookings)} bookings from VRBO iCal")
            return bookings
            
        except Exception as e:
            logger.error(f"Failed to fetch VRBO calendar: {e}")
            return []
    
    def _extract_guest_name(self, summary: str) -> Optional[str]:
        """Extract guest name from booking summary"""
        for sep in [' - ', ': ', ' by ']:
            if sep in summary:
                return summary.split(sep)[-1].strip()
        return None
    
    def _extract_confirmation(self, description: str) -> Optional[str]:
        """Extract confirmation code from description"""
        if not description:
            return None
        import re
        match = re.search(r'(?:Confirmation|Code|Booking)[:\s]*([A-Z0-9]+)', description, re.I)
        return match.group(1) if match else None
    
    def generate_ical_export(self, bookings: List[Dict]) -> str:
        """Generate iCal content to export TO VRBO"""
        cal = Calendar()
        cal.add('prodid', '-//Right at Home BnB//EN')
        cal.add('version', '2.0')
        cal.add('calscale', 'GREGORIAN')
        cal.add('method', 'PUBLISH')
        
        from icalendar import Event
        
        for booking in bookings:
            event = Event()
            event.add('uid', f"rah-{booking['id']}@rah-midland.com")
            event.add('dtstart', booking['check_in'])
            event.add('dtend', booking['check_out'])
            event.add('summary', f"Blocked - {booking.get('guest_name', 'Reserved')}")
            event.add('description', f"Booking from Right at Home BnB")
            event.add('dtstamp', datetime.now())
            cal.add_component(event)
        
        return cal.to_ical().decode('utf-8')
    
    async def sync_property(self, property_id: int) -> Dict[str, Any]:
        """Full sync for a property"""
        if property_id not in self.properties:
            return {"error": "Property not configured for VRBO sync"}
        
        prop = self.properties[property_id]
        vrbo_bookings = await self.fetch_vrbo_calendar(prop.ical_import_url)
        prop.last_sync = datetime.now()
        
        return {
            "property_id": property_id,
            "vrbo_listing_id": prop.vrbo_listing_id,
            "bookings_imported": len(vrbo_bookings),
            "bookings": [
                {
                    "uid": b.uid,
                    "guest_name": b.guest_name,
                    "check_in": b.start_date.isoformat(),
                    "check_out": b.end_date.isoformat(),
                    "confirmation": b.confirmation_code
                }
                for b in vrbo_bookings
            ],
            "last_sync": prop.last_sync.isoformat()
        }
    
    def register_property(
        self, 
        property_id: int, 
        vrbo_listing_id: str,
        ical_import_url: str
    ) -> VRBOProperty:
        """Register a property for VRBO sync"""
        ical_export_url = f"https://api.rah-midland.com/ical/{property_id}/vrbo.ics"
        
        prop = VRBOProperty(
            property_id=property_id,
            vrbo_listing_id=vrbo_listing_id,
            ical_import_url=ical_import_url,
            ical_export_url=ical_export_url
        )
        
        self.properties[property_id] = prop
        logger.info(f"Registered property {property_id} for VRBO sync")
        return prop
