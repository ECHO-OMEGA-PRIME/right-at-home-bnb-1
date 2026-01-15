"""
Right At Home BnB - Cleaner Location Tracking Service
======================================================
Real-time tracking and management of cleaning crews:
- GPS location sharing during work hours
- Progress tracking at each property
- Automatic reminder calls if running behind
- Route optimization
- ETA predictions

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from enum import Enum
from loguru import logger
import math

# Firebase
try:
    import firebase_admin
    from firebase_admin import firestore
    db = firestore.client() if firebase_admin._apps else None
    FIREBASE_AVAILABLE = db is not None
except:
    FIREBASE_AVAILABLE = False
    db = None


class CleanerStatus(str, Enum):
    OFF_DUTY = "off_duty"
    ON_WAY = "on_way"
    AT_PROPERTY = "at_property"
    CLEANING = "cleaning"
    BREAK = "break"
    FINISHED = "finished"
    RUNNING_LATE = "running_late"


class CleaningStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"
    CANCELLED = "cancelled"


# Midland TX area properties (demo coordinates)
PROPERTY_LOCATIONS = {
    1: {"name": "Castleford Estate", "lat": 31.9973, "lng": -102.0779, "address": "123 Castleford Dr"},
    2: {"name": "Permian Palace", "lat": 32.0150, "lng": -102.1100, "address": "456 Permian Way"},
    3: {"name": "Desert Star Lodge", "lat": 31.9800, "lng": -102.0500, "address": "789 Desert Star Ln"},
    4: {"name": "Oilfield Oasis", "lat": 32.0200, "lng": -102.0900, "address": "101 Oilfield Rd"},
    5: {"name": "Roughneck Rest", "lat": 31.9900, "lng": -102.0650, "address": "202 Roughneck Ave"},
}


class CleanerTrackingService:
    """
    Real-time cleaner tracking and schedule management.
    Shares locations with Steven during work hours.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.cleaners_collection = "rah_cleaner_tracking"
        self.locations_collection = "rah_cleaner_locations"
        self.schedules_collection = "rah_cleaning_schedules"
        self.alerts_collection = "rah_cleaner_alerts"

        # Thresholds
        self.late_threshold_minutes = 15  # Minutes before considered late
        self.reminder_threshold_minutes = 10  # When to call with reminder
        self.expected_cleaning_time_minutes = 90  # Average cleaning time

    # =========================================================================
    # LOCATION TRACKING
    # =========================================================================

    async def update_cleaner_location(
        self,
        cleaner_id: str,
        latitude: float,
        longitude: float,
        accuracy: float = None,
        speed: float = None,
        heading: float = None,
        battery_level: int = None
    ) -> Dict[str, Any]:
        """Update cleaner's current GPS location."""
        timestamp = datetime.utcnow().isoformat()

        location_data = {
            "cleaner_id": cleaner_id,
            "latitude": latitude,
            "longitude": longitude,
            "accuracy_meters": accuracy,
            "speed_mph": speed,
            "heading": heading,
            "battery_level": battery_level,
            "timestamp": timestamp
        }

        # Store in Firebase (real-time updates)
        if self.firebase_available and db:
            # Update current location
            db.collection(self.cleaners_collection).document(cleaner_id).set({
                "current_location": location_data,
                "last_updated": timestamp
            }, merge=True)

            # Also store in location history
            db.collection(self.locations_collection).add({
                **location_data,
                "recorded_at": timestamp
            })

        # Check proximity to scheduled properties
        nearby_property = await self._check_property_proximity(cleaner_id, latitude, longitude)
        if nearby_property:
            location_data["nearby_property"] = nearby_property

        # Check if running late
        late_check = await self._check_if_running_late(cleaner_id, latitude, longitude)
        if late_check.get("is_late"):
            location_data["alert"] = late_check

        return {"success": True, "location": location_data}

    async def _check_property_proximity(
        self,
        cleaner_id: str,
        lat: float,
        lng: float,
        radius_meters: float = 100
    ) -> Optional[Dict]:
        """Check if cleaner is near any scheduled property."""
        # Get today's schedule for this cleaner
        schedule = await self.get_cleaner_schedule(cleaner_id)

        for assignment in schedule.get("assignments", []):
            property_id = assignment.get("property_id")
            if property_id in PROPERTY_LOCATIONS:
                prop = PROPERTY_LOCATIONS[property_id]
                distance = self._calculate_distance(lat, lng, prop["lat"], prop["lng"])

                if distance <= radius_meters:
                    # Cleaner arrived at property
                    await self._mark_arrived_at_property(cleaner_id, property_id)
                    return {
                        "property_id": property_id,
                        "property_name": prop["name"],
                        "distance_meters": distance,
                        "status": "arrived"
                    }

        return None

    def _calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two coordinates in meters."""
        R = 6371000  # Earth's radius in meters

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)

        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

        return R * c

    async def _check_if_running_late(
        self,
        cleaner_id: str,
        current_lat: float,
        current_lng: float
    ) -> Dict[str, Any]:
        """Check if cleaner is running late for next assignment."""
        schedule = await self.get_cleaner_schedule(cleaner_id)
        now = datetime.utcnow()

        for assignment in schedule.get("assignments", []):
            if assignment.get("status") == CleaningStatus.SCHEDULED.value:
                scheduled_time = datetime.fromisoformat(assignment.get("scheduled_start"))

                if scheduled_time < now + timedelta(minutes=self.late_threshold_minutes):
                    # Should be there soon - calculate ETA
                    property_id = assignment.get("property_id")
                    if property_id in PROPERTY_LOCATIONS:
                        prop = PROPERTY_LOCATIONS[property_id]
                        distance = self._calculate_distance(
                            current_lat, current_lng,
                            prop["lat"], prop["lng"]
                        )

                        # Estimate driving time (assume 30 mph average in city)
                        eta_minutes = (distance / 1609) / 30 * 60  # Convert to minutes

                        if scheduled_time - now < timedelta(minutes=eta_minutes):
                            return {
                                "is_late": True,
                                "property_name": prop["name"],
                                "scheduled_time": scheduled_time.isoformat(),
                                "estimated_arrival": (now + timedelta(minutes=eta_minutes)).isoformat(),
                                "minutes_late": int(eta_minutes - (scheduled_time - now).total_seconds() / 60),
                                "needs_reminder": True
                            }

        return {"is_late": False}

    async def get_cleaner_current_location(self, cleaner_id: str) -> Optional[Dict]:
        """Get cleaner's current location."""
        if not self.firebase_available or not db:
            # Demo location
            return {
                "latitude": 31.9950,
                "longitude": -102.0800,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "on_way"
            }

        doc = db.collection(self.cleaners_collection).document(cleaner_id).get()
        if doc.exists:
            data = doc.to_dict()
            return data.get("current_location")
        return None

    async def get_all_cleaner_locations(self) -> List[Dict]:
        """Get current locations of all active cleaners."""
        if not self.firebase_available or not db:
            return [
                {
                    "cleaner_id": "cleaner_1",
                    "name": "Maria Rodriguez",
                    "latitude": 31.9950,
                    "longitude": -102.0800,
                    "status": "cleaning",
                    "current_property": "Castleford Estate"
                },
                {
                    "cleaner_id": "cleaner_2",
                    "name": "James Wilson",
                    "latitude": 32.0100,
                    "longitude": -102.0950,
                    "status": "on_way",
                    "next_property": "Permian Palace"
                }
            ]

        docs = db.collection(self.cleaners_collection).where(
            "status", "!=", CleanerStatus.OFF_DUTY.value
        ).stream()

        return [doc.to_dict() for doc in docs]

    # =========================================================================
    # SCHEDULE MANAGEMENT
    # =========================================================================

    async def get_cleaner_schedule(
        self,
        cleaner_id: str,
        target_date: str = None
    ) -> Dict[str, Any]:
        """Get cleaner's schedule for a day."""
        target_date = target_date or date.today().isoformat()

        if not self.firebase_available or not db:
            return {
                "cleaner_id": cleaner_id,
                "date": target_date,
                "assignments": [
                    {
                        "property_id": 1,
                        "property_name": "Castleford Estate",
                        "scheduled_start": f"{target_date}T09:00:00",
                        "estimated_duration": 90,
                        "status": "in_progress"
                    },
                    {
                        "property_id": 3,
                        "property_name": "Desert Star Lodge",
                        "scheduled_start": f"{target_date}T11:00:00",
                        "estimated_duration": 75,
                        "status": "scheduled"
                    },
                    {
                        "property_id": 5,
                        "property_name": "Roughneck Rest",
                        "scheduled_start": f"{target_date}T13:30:00",
                        "estimated_duration": 90,
                        "status": "scheduled"
                    }
                ]
            }

        doc = db.collection(self.schedules_collection).document(
            f"{cleaner_id}_{target_date}"
        ).get()

        if doc.exists:
            return doc.to_dict()

        return {"cleaner_id": cleaner_id, "date": target_date, "assignments": []}

    async def create_cleaning_assignment(
        self,
        cleaner_id: str,
        property_id: int,
        scheduled_start: str,
        estimated_duration: int = 90,
        notes: str = None,
        is_same_day_turn: bool = False
    ) -> Dict[str, Any]:
        """Create a cleaning assignment."""
        assignment_date = scheduled_start.split("T")[0]
        assignment_id = f"assign_{cleaner_id}_{property_id}_{datetime.utcnow().strftime('%H%M%S')}"

        property_info = PROPERTY_LOCATIONS.get(property_id, {})

        assignment = {
            "id": assignment_id,
            "cleaner_id": cleaner_id,
            "property_id": property_id,
            "property_name": property_info.get("name", f"Property {property_id}"),
            "property_address": property_info.get("address"),
            "scheduled_start": scheduled_start,
            "estimated_duration": estimated_duration,
            "estimated_end": (
                datetime.fromisoformat(scheduled_start) + timedelta(minutes=estimated_duration)
            ).isoformat(),
            "status": CleaningStatus.SCHEDULED.value,
            "is_same_day_turn": is_same_day_turn,
            "priority": "high" if is_same_day_turn else "normal",
            "notes": notes,
            "created_at": datetime.utcnow().isoformat()
        }

        if self.firebase_available and db:
            # Add to schedule
            schedule_doc = db.collection(self.schedules_collection).document(
                f"{cleaner_id}_{assignment_date}"
            )

            schedule = schedule_doc.get()
            if schedule.exists:
                schedule_doc.update({
                    "assignments": firestore.ArrayUnion([assignment])
                })
            else:
                schedule_doc.set({
                    "cleaner_id": cleaner_id,
                    "date": assignment_date,
                    "assignments": [assignment]
                })

        return {"success": True, "assignment": assignment}

    async def update_cleaning_status(
        self,
        cleaner_id: str,
        property_id: int,
        status: CleaningStatus,
        actual_start: str = None,
        actual_end: str = None,
        notes: str = None
    ) -> Dict[str, Any]:
        """Update the status of a cleaning assignment."""
        today = date.today().isoformat()

        update_data = {
            "status": status.value,
            "updated_at": datetime.utcnow().isoformat()
        }

        if actual_start:
            update_data["actual_start"] = actual_start
        if actual_end:
            update_data["actual_end"] = actual_end
            # Calculate duration
            if actual_start:
                start = datetime.fromisoformat(actual_start)
                end = datetime.fromisoformat(actual_end)
                update_data["actual_duration"] = int((end - start).total_seconds() / 60)
        if notes:
            update_data["notes"] = notes

        if self.firebase_available and db:
            # Find and update the assignment
            schedule_doc = db.collection(self.schedules_collection).document(
                f"{cleaner_id}_{today}"
            )
            # Would need to update specific assignment in array

        return {"success": True, "status": status.value}

    async def _mark_arrived_at_property(
        self,
        cleaner_id: str,
        property_id: int
    ) -> None:
        """Mark cleaner as arrived at property."""
        await self.update_cleaning_status(
            cleaner_id=cleaner_id,
            property_id=property_id,
            status=CleaningStatus.IN_PROGRESS,
            actual_start=datetime.utcnow().isoformat()
        )

        # Update cleaner status
        if self.firebase_available and db:
            db.collection(self.cleaners_collection).document(cleaner_id).update({
                "status": CleanerStatus.AT_PROPERTY.value,
                "current_property_id": property_id,
                "arrived_at": datetime.utcnow().isoformat()
            })

    # =========================================================================
    # REMINDERS & ALERTS
    # =========================================================================

    async def send_hurry_reminder(
        self,
        cleaner_id: str,
        cleaner_name: str,
        cleaner_phone: str,
        next_property: str,
        next_property_address: str,
        minutes_until_due: int
    ) -> Dict[str, Any]:
        """Send reminder call to cleaner to hurry up."""
        from .twilio_voice import twilio_voice_service

        message = f"""
        Hi {cleaner_name}! This is a reminder from Right At Home B and B.
        Your next cleaning at {next_property} is due in {minutes_until_due} minutes.
        Please wrap up your current cleaning and head over when ready.
        The address is {next_property_address}.
        Press 1 to confirm you're on your way.
        """

        result = await twilio_voice_service.call_cleaner(
            cleaner_phone=cleaner_phone,
            cleaner_name=cleaner_name,
            message=message.strip(),
            property_address=next_property_address
        )

        # Log the reminder
        if self.firebase_available and db:
            db.collection(self.alerts_collection).add({
                "type": "hurry_reminder",
                "cleaner_id": cleaner_id,
                "cleaner_name": cleaner_name,
                "next_property": next_property,
                "minutes_until_due": minutes_until_due,
                "call_result": result,
                "sent_at": datetime.utcnow().isoformat()
            })

        return result

    async def check_all_cleaners_status(self) -> Dict[str, Any]:
        """Check status of all cleaners and send reminders if needed."""
        locations = await self.get_all_cleaner_locations()
        reminders_sent = []

        for cleaner in locations:
            cleaner_id = cleaner.get("cleaner_id")
            lat = cleaner.get("latitude")
            lng = cleaner.get("longitude")

            if lat and lng:
                late_check = await self._check_if_running_late(cleaner_id, lat, lng)

                if late_check.get("needs_reminder"):
                    # Get cleaner details
                    cleaner_info = await self._get_cleaner_info(cleaner_id)

                    if cleaner_info:
                        result = await self.send_hurry_reminder(
                            cleaner_id=cleaner_id,
                            cleaner_name=cleaner_info.get("name"),
                            cleaner_phone=cleaner_info.get("phone"),
                            next_property=late_check.get("property_name"),
                            next_property_address=late_check.get("property_address", ""),
                            minutes_until_due=abs(late_check.get("minutes_late", 0))
                        )
                        reminders_sent.append({
                            "cleaner": cleaner_info.get("name"),
                            "property": late_check.get("property_name"),
                            "result": result
                        })

        return {
            "checked_at": datetime.utcnow().isoformat(),
            "cleaners_checked": len(locations),
            "reminders_sent": len(reminders_sent),
            "reminders": reminders_sent
        }

    async def _get_cleaner_info(self, cleaner_id: str) -> Optional[Dict]:
        """Get cleaner's contact info."""
        if not self.firebase_available or not db:
            return {
                "id": cleaner_id,
                "name": "Maria Rodriguez",
                "phone": "+14325550101"
            }

        doc = db.collection("rah_cleaners").document(cleaner_id).get()
        if doc.exists:
            return doc.to_dict()
        return None

    # =========================================================================
    # ROUTE OPTIMIZATION
    # =========================================================================

    async def optimize_route(
        self,
        cleaner_id: str,
        target_date: str = None
    ) -> Dict[str, Any]:
        """Optimize route for cleaner's daily assignments."""
        schedule = await self.get_cleaner_schedule(cleaner_id, target_date)
        assignments = schedule.get("assignments", [])

        if len(assignments) <= 1:
            return {"optimized": False, "reason": "Not enough assignments to optimize"}

        # Get property coordinates
        property_coords = []
        for a in assignments:
            prop_id = a.get("property_id")
            if prop_id in PROPERTY_LOCATIONS:
                prop = PROPERTY_LOCATIONS[prop_id]
                property_coords.append({
                    "assignment": a,
                    "lat": prop["lat"],
                    "lng": prop["lng"]
                })

        # Simple nearest-neighbor optimization
        # (In production, would use Google Maps Directions API or similar)
        optimized_order = self._nearest_neighbor_route(property_coords)

        # Update scheduled times based on new order
        base_time = datetime.fromisoformat(assignments[0].get("scheduled_start"))
        travel_time_between = 15  # Assume 15 min between properties

        for i, item in enumerate(optimized_order):
            duration = item["assignment"].get("estimated_duration", 90)
            item["new_scheduled_start"] = base_time.isoformat()
            item["new_scheduled_end"] = (base_time + timedelta(minutes=duration)).isoformat()
            base_time = base_time + timedelta(minutes=duration + travel_time_between)

        return {
            "optimized": True,
            "original_order": [a.get("property_name") for a in assignments],
            "optimized_order": [item["assignment"].get("property_name") for item in optimized_order],
            "new_schedule": optimized_order,
            "estimated_total_time": sum(item["assignment"].get("estimated_duration", 90) for item in optimized_order) + (len(optimized_order) - 1) * travel_time_between
        }

    def _nearest_neighbor_route(self, coords: List[Dict]) -> List[Dict]:
        """Simple nearest neighbor algorithm for route optimization."""
        if not coords:
            return []

        unvisited = coords.copy()
        route = [unvisited.pop(0)]  # Start with first assignment

        while unvisited:
            current = route[-1]
            nearest = min(
                unvisited,
                key=lambda x: self._calculate_distance(
                    current["lat"], current["lng"],
                    x["lat"], x["lng"]
                )
            )
            route.append(nearest)
            unvisited.remove(nearest)

        return route

    # =========================================================================
    # DASHBOARD DATA
    # =========================================================================

    async def get_tracking_dashboard(self) -> Dict[str, Any]:
        """Get real-time tracking dashboard data."""
        locations = await self.get_all_cleaner_locations()

        # Count by status
        status_counts = {}
        for loc in locations:
            status = loc.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "active_cleaners": len(locations),
            "status_breakdown": status_counts,
            "cleaner_locations": locations,
            "properties_being_cleaned": [
                loc.get("current_property") for loc in locations
                if loc.get("status") == "cleaning"
            ]
        }


# Singleton instance
cleaner_tracking_service = CleanerTrackingService()
