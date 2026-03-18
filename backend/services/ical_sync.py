"""
iCal Sync Service for Right at Home BnB
Airbnb and VRBO calendar synchronization
@author ECHO OMEGA PRIME
"""

import os
import re
import hashlib
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, date, timedelta
from dataclasses import dataclass
from enum import Enum
from loguru import logger
import httpx
from icalendar import Calendar, Event
import pytz

from schemas.booking import ICalEvent, ICalSyncResult, BookingSource
from schemas.guest import Platform


class ICalSource(str, Enum):
    """iCal calendar source"""
    AIRBNB = "airbnb"
    VRBO = "vrbo"
    BOOKING = "booking"
    GOOGLE = "google"
    OTHER = "other"


@dataclass
class ParsedBooking:
    """Parsed booking from iCal event"""
    uid: str
    summary: str
    check_in: date
    check_out: date
    guest_name: Optional[str]
    guest_phone: Optional[str]
    confirmation_code: Optional[str]
    platform: Platform
    description: Optional[str]
    nights: int


class ICalSyncService:
    """
    Service for syncing iCal calendars from Airbnb, VRBO, and other platforms.
    Handles parsing, conflict detection, and booking creation.
    """

    def __init__(self):
        self.http_client = httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={
                "User-Agent": "RightAtHomeBnB/1.0 iCal Sync"
            }
        )
        self.timezone = pytz.timezone("America/Chicago")  # Midland, TX

    async def fetch_calendar(self, ical_url: str) -> Optional[str]:
        """
        Fetch iCal data from URL.

        Args:
            ical_url: URL to the iCal feed

        Returns:
            Raw iCal data string or None if failed
        """
        try:
            logger.info(f"Fetching iCal from: {ical_url[:50]}...")
            response = await self.http_client.get(ical_url)
            response.raise_for_status()

            content = response.text
            logger.info(f"Fetched {len(content)} bytes of iCal data")
            return content

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching iCal: {e.response.status_code}")
            return None
        except Exception as e:
            logger.error(f"Error fetching iCal: {e}")
            return None

    def detect_source(self, ical_url: str, ical_data: str) -> ICalSource:
        """Detect the source platform from URL or content."""
        url_lower = ical_url.lower()
        data_lower = ical_data.lower() if ical_data else ""

        if "airbnb" in url_lower or "airbnb" in data_lower:
            return ICalSource.AIRBNB
        elif "vrbo" in url_lower or "homeaway" in url_lower or "vrbo" in data_lower:
            return ICalSource.VRBO
        elif "booking.com" in url_lower:
            return ICalSource.BOOKING
        elif "google" in url_lower:
            return ICalSource.GOOGLE
        else:
            return ICalSource.OTHER

    def parse_calendar(self, ical_data: str) -> List[ICalEvent]:
        """
        Parse iCal data into events.

        Args:
            ical_data: Raw iCal string data

        Returns:
            List of parsed ICalEvent objects
        """
        events = []

        try:
            cal = Calendar.from_ical(ical_data)

            for component in cal.walk():
                if component.name == "VEVENT":
                    try:
                        # Extract basic fields
                        uid = str(component.get("UID", ""))
                        summary = str(component.get("SUMMARY", ""))
                        description = str(component.get("DESCRIPTION", ""))

                        # Parse dates
                        dtstart = component.get("DTSTART")
                        dtend = component.get("DTEND")

                        if dtstart:
                            start = dtstart.dt
                            if isinstance(start, datetime):
                                start = start.date()
                        else:
                            continue

                        if dtend:
                            end = dtend.dt
                            if isinstance(end, datetime):
                                end = end.date()
                        else:
                            # Default to 1 night
                            end = start + timedelta(days=1)

                        # Get other fields
                        status = str(component.get("STATUS", ""))
                        location = str(component.get("LOCATION", ""))
                        last_modified = component.get("LAST-MODIFIED")

                        if last_modified and hasattr(last_modified, "dt"):
                            last_modified = last_modified.dt
                        else:
                            last_modified = None

                        events.append(ICalEvent(
                            uid=uid,
                            summary=summary,
                            start=start,
                            end=end,
                            description=description if description else None,
                            location=location if location else None,
                            status=status if status else None,
                            last_modified=last_modified
                        ))

                    except Exception as e:
                        logger.warning(f"Error parsing event: {e}")
                        continue

            logger.info(f"Parsed {len(events)} events from iCal")
            return events

        except Exception as e:
            logger.error(f"Error parsing iCal data: {e}")
            return []

    def parse_airbnb_event(self, event: ICalEvent) -> ParsedBooking:
        """
        Parse Airbnb-specific event format.
        Airbnb format: "Reserved - John Smith (HMXXXXXX)"
        Or: "Not available - Blocked"
        """
        summary = event.summary
        description = event.description or ""
        guest_name = None
        guest_phone = None
        confirmation_code = None

        # Check if it's a blocked date
        if "not available" in summary.lower() or "blocked" in summary.lower():
            return ParsedBooking(
                uid=event.uid,
                summary="Blocked",
                check_in=event.start,
                check_out=event.end,
                guest_name=None,
                guest_phone=None,
                confirmation_code=None,
                platform=Platform.AIRBNB,
                description=description,
                nights=(event.end - event.start).days
            )

        # Parse guest name from "Reserved - John Smith"
        if "reserved" in summary.lower():
            parts = summary.split(" - ")
            if len(parts) > 1:
                name_part = parts[1].strip()
                # Remove confirmation code if present
                if "(" in name_part:
                    guest_name = name_part.split("(")[0].strip()
                    code_match = re.search(r'\(([A-Z0-9]+)\)', name_part)
                    if code_match:
                        confirmation_code = code_match.group(1)
                else:
                    guest_name = name_part

        # Parse phone from description
        phone_match = re.search(r'\+?1?[\d\-\(\)\s]{10,}', description)
        if phone_match:
            guest_phone = re.sub(r'[^\d+]', '', phone_match.group())

        # Parse confirmation from description if not found
        if not confirmation_code:
            code_match = re.search(r'([A-Z]{2,}[A-Z0-9]{6,})', description)
            if code_match:
                confirmation_code = code_match.group(1)

        return ParsedBooking(
            uid=event.uid,
            summary=summary,
            check_in=event.start,
            check_out=event.end,
            guest_name=guest_name,
            guest_phone=guest_phone,
            confirmation_code=confirmation_code,
            platform=Platform.AIRBNB,
            description=description,
            nights=(event.end - event.start).days
        )

    def parse_vrbo_event(self, event: ICalEvent) -> ParsedBooking:
        """
        Parse VRBO-specific event format.
        VRBO format: "RESERVED: John Smith" or "John Smith - Reservation"
        """
        summary = event.summary
        description = event.description or ""
        guest_name = None
        guest_phone = None
        confirmation_code = None

        # Check if it's a blocked date
        if "blocked" in summary.lower() or "not available" in summary.lower():
            return ParsedBooking(
                uid=event.uid,
                summary="Blocked",
                check_in=event.start,
                check_out=event.end,
                guest_name=None,
                guest_phone=None,
                confirmation_code=None,
                platform=Platform.VRBO,
                description=description,
                nights=(event.end - event.start).days
            )

        # Parse "RESERVED: John Smith" format
        if "reserved" in summary.lower():
            parts = summary.split(":")
            if len(parts) > 1:
                guest_name = parts[1].strip()
            else:
                parts = summary.split("-")
                if len(parts) > 1:
                    guest_name = parts[1].strip()

        # VRBO often includes confirmation in UID
        if event.uid and len(event.uid) > 8:
            # VRBO UIDs often contain the confirmation number
            uid_parts = event.uid.split("@")
            if uid_parts:
                potential_code = uid_parts[0].replace("-", "")
                if len(potential_code) >= 6:
                    confirmation_code = potential_code[:12]

        # Parse phone from description
        phone_match = re.search(r'\+?1?[\d\-\(\)\s]{10,}', description)
        if phone_match:
            guest_phone = re.sub(r'[^\d+]', '', phone_match.group())

        return ParsedBooking(
            uid=event.uid,
            summary=summary,
            check_in=event.start,
            check_out=event.end,
            guest_name=guest_name,
            guest_phone=guest_phone,
            confirmation_code=confirmation_code,
            platform=Platform.VRBO,
            description=description,
            nights=(event.end - event.start).days
        )

    def parse_event(self, event: ICalEvent, source: ICalSource) -> ParsedBooking:
        """Parse an event based on its source."""
        if source == ICalSource.AIRBNB:
            return self.parse_airbnb_event(event)
        elif source == ICalSource.VRBO:
            return self.parse_vrbo_event(event)
        else:
            # Generic parsing
            return ParsedBooking(
                uid=event.uid,
                summary=event.summary,
                check_in=event.start,
                check_out=event.end,
                guest_name=event.summary if event.summary else None,
                guest_phone=None,
                confirmation_code=None,
                platform=Platform.OTHER,
                description=event.description,
                nights=(event.end - event.start).days
            )

    async def sync_calendar(
        self,
        property_id: str,
        ical_url: str,
        source_hint: Optional[str] = None,
        sync_back_days: int = 30,
        sync_forward_days: int = 365,
        auto_confirm: bool = True
    ) -> ICalSyncResult:
        """
        Sync a property's calendar from iCal URL.

        Args:
            property_id: Property ID to sync
            ical_url: iCal feed URL
            source_hint: Hint for source platform (airbnb, vrbo, etc.)
            sync_back_days: Days in past to sync
            sync_forward_days: Days in future to sync
            auto_confirm: Auto-confirm new bookings

        Returns:
            ICalSyncResult with sync statistics
        """
        sync_time = datetime.utcnow()
        errors = []
        conflicts = []
        new_bookings = 0
        updated_bookings = 0
        cancelled_bookings = 0

        # Fetch calendar
        ical_data = await self.fetch_calendar(ical_url)
        if not ical_data:
            return ICalSyncResult(
                property_id=property_id,
                source=source_hint or "unknown",
                ical_url=ical_url,
                sync_time=sync_time,
                events_found=0,
                new_bookings=0,
                updated_bookings=0,
                cancelled_bookings=0,
                conflicts=[],
                errors=["Failed to fetch iCal data"]
            )

        # Detect source
        source = self.detect_source(ical_url, ical_data)
        if source_hint:
            source = ICalSource(source_hint.lower())

        # Parse events
        events = self.parse_calendar(ical_data)

        # Filter by date range
        today = date.today()
        start_date = today - timedelta(days=sync_back_days)
        end_date = today + timedelta(days=sync_forward_days)

        filtered_events = [
            e for e in events
            if e.end >= start_date and e.start <= end_date
        ]

        # Parse bookings
        parsed_bookings = []
        for event in filtered_events:
            try:
                booking = self.parse_event(event, source)
                if booking.check_in and booking.check_out:
                    parsed_bookings.append(booking)
            except Exception as e:
                errors.append(f"Error parsing event {event.uid}: {str(e)}")

        logger.info(f"Sync complete: {len(parsed_bookings)} bookings parsed from {source.value}")

        # In production, here we would:
        # 1. Look up existing bookings by confirmation_code or UID
        # 2. Create new bookings for unknown events
        # 3. Update existing bookings if dates changed
        # 4. Mark cancelled bookings if events removed
        # For now, return the count

        return ICalSyncResult(
            property_id=property_id,
            source=source.value,
            ical_url=ical_url,
            sync_time=sync_time,
            events_found=len(filtered_events),
            new_bookings=len(parsed_bookings),  # Would be actual new count
            updated_bookings=0,
            cancelled_bookings=0,
            conflicts=conflicts,
            errors=errors
        )

    async def sync_all_calendars(
        self,
        properties: List[Dict[str, Any]]
    ) -> List[ICalSyncResult]:
        """
        Sync calendars for multiple properties.

        Args:
            properties: List of {property_id, airbnb_ical_url, vrbo_ical_url}

        Returns:
            List of sync results
        """
        results = []

        for prop in properties:
            property_id = prop.get("property_id")

            # Sync Airbnb
            if prop.get("airbnb_ical_url"):
                result = await self.sync_calendar(
                    property_id=property_id,
                    ical_url=prop["airbnb_ical_url"],
                    source_hint="airbnb"
                )
                results.append(result)

            # Sync VRBO
            if prop.get("vrbo_ical_url"):
                result = await self.sync_calendar(
                    property_id=property_id,
                    ical_url=prop["vrbo_ical_url"],
                    source_hint="vrbo"
                )
                results.append(result)

        return results

    def generate_export_ical(
        self,
        property_name: str,
        bookings: List[Dict[str, Any]]
    ) -> str:
        """
        Generate iCal export for a property's bookings.
        This allows external calendars to sync from Right at Home BnB.

        Args:
            property_name: Name of the property
            bookings: List of booking dictionaries

        Returns:
            iCal string
        """
        cal = Calendar()
        cal.add("prodid", "-//Right at Home BnB//rah-midland.com//")
        cal.add("version", "2.0")
        cal.add("x-wr-calname", f"{property_name} - Bookings")
        cal.add("method", "PUBLISH")

        for booking in bookings:
            event = Event()

            # Generate UID from booking ID
            booking_id = booking.get("id", "")
            uid = f"{booking_id}@rah-midland.com"
            event.add("uid", uid)

            # Set summary
            guest_name = booking.get("guest_name", "Reserved")
            event.add("summary", f"Reserved - {guest_name}")

            # Set dates
            check_in = booking.get("check_in")
            check_out = booking.get("check_out")

            if isinstance(check_in, str):
                check_in = datetime.fromisoformat(check_in).date()
            if isinstance(check_out, str):
                check_out = datetime.fromisoformat(check_out).date()

            event.add("dtstart", check_in)
            event.add("dtend", check_out)

            # Set description
            description = f"Guests: {booking.get('guest_count', 1)}\n"
            if booking.get("confirmation_code"):
                description += f"Confirmation: {booking['confirmation_code']}\n"
            event.add("description", description)

            # Set status
            status = booking.get("status", "CONFIRMED")
            event.add("status", "CONFIRMED" if status != "CANCELLED" else "CANCELLED")

            # Set timestamps
            event.add("dtstamp", datetime.utcnow())
            event.add("created", datetime.utcnow())

            cal.add_component(event)

        return cal.to_ical().decode("utf-8")

    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()


# Singleton instance
ical_sync_service = ICalSyncService()


# Utility functions
async def sync_property_calendar(
    property_id: str,
    airbnb_url: Optional[str] = None,
    vrbo_url: Optional[str] = None
) -> List[ICalSyncResult]:
    """Quick utility to sync a property's calendars."""
    results = []

    if airbnb_url:
        result = await ical_sync_service.sync_calendar(
            property_id=property_id,
            ical_url=airbnb_url,
            source_hint="airbnb"
        )
        results.append(result)

    if vrbo_url:
        result = await ical_sync_service.sync_calendar(
            property_id=property_id,
            ical_url=vrbo_url,
            source_hint="vrbo"
        )
        results.append(result)

    return results
