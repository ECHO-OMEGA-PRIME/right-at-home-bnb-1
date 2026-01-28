"""
Right At Home BnB - Weather Service
====================================
OpenWeatherMap integration for Midland, TX weather monitoring.
Detects dust storms and auto-elevates pool service job priorities.

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX

MIDLAND, TX COORDINATES:
- Latitude: 31.9973
- Longitude: -102.0779

DUST STORM DETECTION:
- Wind speed > 30 mph triggers dust storm alert
- All pool service jobs auto-elevated to URGENT priority
- Operational alert created for dashboard
"""

import os
import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from database.models_weather import (
    WeatherAlert, WeatherAlertSeverity,
    PoolServiceJob, TaskPriority, PoolJobStatus
)
from database.models_financial import OperationalAlert, AlertType, AlertSeverity

logger = logging.getLogger("WeatherService")


# ============================================================================
# CONFIGURATION
# ============================================================================

MIDLAND_TX = {
    "lat": 31.9973,
    "lon": -102.0779,
    "name": "Midland, TX"
}

# Dust storm threshold (mph)
DUST_STORM_WIND_THRESHOLD = 30.0

# OpenWeatherMap API
OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")
OPENWEATHERMAP_BASE_URL = "https://api.openweathermap.org/data/2.5"


# ============================================================================
# WEATHER SERVICE CLASS
# ============================================================================

class WeatherService:
    """
    Service for fetching weather data and managing pool service priorities.

    Features:
    - Fetch current weather from OpenWeatherMap
    - Detect dust storm conditions (wind > 30 mph)
    - Auto-elevate pool service job priorities
    - Create operational alerts for dashboard
    - Store weather history for analysis
    """

    def __init__(self, db: Session):
        self.db = db
        self.api_key = OPENWEATHERMAP_API_KEY
        self.location = MIDLAND_TX

    async def fetch_current_weather(self) -> Optional[Dict[str, Any]]:
        """
        Fetch current weather from OpenWeatherMap API.

        Returns:
            Weather data dict or None if API call fails
        """
        if not self.api_key:
            logger.warning("OpenWeatherMap API key not configured")
            return None

        url = f"{OPENWEATHERMAP_BASE_URL}/weather"
        params = {
            "lat": self.location["lat"],
            "lon": self.location["lon"],
            "appid": self.api_key,
            "units": "imperial"  # Fahrenheit
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                logger.info(
                    f"Weather fetched: {data.get('main', {}).get('temp')}F, "
                    f"Wind: {data.get('wind', {}).get('speed')}mph"
                )
                return data

        except httpx.HTTPStatusError as e:
            logger.error(f"OpenWeatherMap API error: {e.response.status_code}")
            return None
        except httpx.RequestError as e:
            logger.error(f"Weather request failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching weather: {e}")
            return None

    def parse_weather_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse OpenWeatherMap response into standardized format.

        Args:
            raw_data: Raw API response

        Returns:
            Parsed weather data dict
        """
        main = raw_data.get("main", {})
        wind = raw_data.get("wind", {})
        weather = raw_data.get("weather", [{}])[0]
        visibility = raw_data.get("visibility", 10000)  # meters

        wind_speed = wind.get("speed", 0)
        is_dust_storm = wind_speed >= DUST_STORM_WIND_THRESHOLD

        # Determine dust storm severity
        dust_severity = None
        if is_dust_storm:
            if wind_speed >= 50:
                dust_severity = WeatherAlertSeverity.CRITICAL
            elif wind_speed >= 40:
                dust_severity = WeatherAlertSeverity.WARNING
            else:
                dust_severity = WeatherAlertSeverity.INFO

        return {
            "recorded_at": datetime.utcnow(),
            "wind_speed_mph": wind_speed,
            "wind_gust_mph": wind.get("gust"),
            "wind_direction": self._degrees_to_direction(wind.get("deg", 0)),
            "is_dust_storm": is_dust_storm,
            "dust_storm_severity": dust_severity,
            "temperature_f": main.get("temp"),
            "feels_like_f": main.get("feels_like"),
            "humidity_percent": main.get("humidity"),
            "conditions": weather.get("description", "").title(),
            "visibility_miles": round(visibility / 1609.34, 1),  # Convert meters to miles
            "source": "openweathermap",
            "api_response_code": raw_data.get("cod"),
            "raw_data": raw_data
        }

    def _degrees_to_direction(self, degrees: int) -> str:
        """Convert wind degrees to cardinal direction."""
        directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        idx = round(degrees / 45) % 8
        return directions[idx]

    async def check_and_store_weather(self) -> Optional[WeatherAlert]:
        """
        Fetch weather, store in database, and check for dust storms.

        Returns:
            WeatherAlert record if created
        """
        raw_data = await self.fetch_current_weather()
        if not raw_data:
            return None

        parsed = self.parse_weather_data(raw_data)

        # Create weather alert record
        weather_alert = WeatherAlert(
            recorded_at=parsed["recorded_at"],
            wind_speed_mph=parsed["wind_speed_mph"],
            wind_gust_mph=parsed.get("wind_gust_mph"),
            wind_direction=parsed.get("wind_direction"),
            is_dust_storm=parsed["is_dust_storm"],
            dust_storm_severity=parsed.get("dust_storm_severity"),
            temperature_f=parsed.get("temperature_f"),
            feels_like_f=parsed.get("feels_like_f"),
            humidity_percent=parsed.get("humidity_percent"),
            conditions=parsed.get("conditions"),
            visibility_miles=parsed.get("visibility_miles"),
            source=parsed["source"],
            api_response_code=parsed.get("api_response_code"),
            raw_data=parsed.get("raw_data"),
            latitude=self.location["lat"],
            longitude=self.location["lon"],
            location_name=self.location["name"]
        )

        self.db.add(weather_alert)
        self.db.commit()
        self.db.refresh(weather_alert)

        logger.info(f"Weather recorded: ID={weather_alert.id}, DustStorm={weather_alert.is_dust_storm}")

        # If dust storm detected, elevate pool jobs
        if weather_alert.is_dust_storm:
            elevated_count = await self.elevate_pool_jobs_for_dust_storm(weather_alert)
            weather_alert.pool_jobs_elevated = elevated_count

            # Create operational alert
            await self.create_dust_storm_alert(weather_alert)

            weather_alert.alert_sent = True
            weather_alert.alert_sent_at = datetime.utcnow()
            self.db.commit()

        return weather_alert

    async def elevate_pool_jobs_for_dust_storm(
        self,
        weather_alert: WeatherAlert
    ) -> int:
        """
        Elevate all pending/scheduled pool service jobs to URGENT priority.

        Args:
            weather_alert: The dust storm weather alert

        Returns:
            Number of jobs elevated
        """
        # Find all pool jobs that are scheduled or in progress
        jobs_to_elevate = self.db.query(PoolServiceJob).filter(
            and_(
                PoolServiceJob.status.in_([
                    PoolJobStatus.SCHEDULED,
                    PoolJobStatus.IN_PROGRESS
                ]),
                PoolServiceJob.weather_elevated == False,
                PoolServiceJob.priority != TaskPriority.URGENT
            )
        ).all()

        elevated_count = 0
        for job in jobs_to_elevate:
            # Store original priority
            job.original_priority = job.priority

            # Elevate to URGENT
            job.priority = TaskPriority.URGENT
            job.weather_elevated = True
            job.weather_alert_id = weather_alert.id

            elevated_count += 1
            logger.info(f"Pool job {job.id} elevated to URGENT (was {job.original_priority.value})")

        self.db.commit()
        logger.info(f"Elevated {elevated_count} pool jobs due to dust storm")

        return elevated_count

    async def create_dust_storm_alert(self, weather_alert: WeatherAlert) -> OperationalAlert:
        """
        Create an operational alert for the dashboard.

        Args:
            weather_alert: The dust storm weather alert

        Returns:
            Created OperationalAlert
        """
        severity = AlertSeverity.CRITICAL if weather_alert.wind_speed_mph >= 40 else AlertSeverity.WARNING

        alert = OperationalAlert(
            property_id=None,  # Portfolio-wide alert
            alert_type=AlertType.WEATHER,
            severity=severity,
            title=f"Dust Storm Alert - {weather_alert.wind_speed_mph:.0f} mph winds",
            description=(
                f"Dust storm conditions detected in Midland, TX. "
                f"Wind speed: {weather_alert.wind_speed_mph:.0f} mph. "
                f"All pool service jobs have been elevated to URGENT priority. "
                f"Post-storm pool cleaning may be required."
            ),
            trigger_data={
                "weather_alert_id": weather_alert.id,
                "wind_speed_mph": weather_alert.wind_speed_mph,
                "wind_gust_mph": weather_alert.wind_gust_mph,
                "conditions": weather_alert.conditions,
                "visibility_miles": weather_alert.visibility_miles
            },
            threshold_value=DUST_STORM_WIND_THRESHOLD,
            actual_value=weather_alert.wind_speed_mph,
            auto_actions_taken={
                "pool_jobs_elevated": weather_alert.pool_jobs_elevated,
                "action": "Elevated all pool service jobs to URGENT priority"
            },
            is_active=True,
            is_acknowledged=False
        )

        self.db.add(alert)
        self.db.commit()
        self.db.refresh(alert)

        logger.info(f"Dust storm operational alert created: ID={alert.id}")
        return alert

    def get_current_weather(self) -> Optional[WeatherAlert]:
        """
        Get the most recent weather record.

        Returns:
            Most recent WeatherAlert or None
        """
        return self.db.query(WeatherAlert).order_by(
            WeatherAlert.recorded_at.desc()
        ).first()

    def get_active_dust_storm(self) -> Optional[WeatherAlert]:
        """
        Check if there's an active dust storm (within last 2 hours).

        Returns:
            Active dust storm WeatherAlert or None
        """
        two_hours_ago = datetime.utcnow() - timedelta(hours=2)

        return self.db.query(WeatherAlert).filter(
            and_(
                WeatherAlert.is_dust_storm == True,
                WeatherAlert.recorded_at >= two_hours_ago
            )
        ).order_by(WeatherAlert.recorded_at.desc()).first()

    def get_weather_history(
        self,
        hours: int = 24,
        limit: int = 100
    ) -> List[WeatherAlert]:
        """
        Get weather history for the specified time period.

        Args:
            hours: Number of hours to look back
            limit: Maximum records to return

        Returns:
            List of WeatherAlert records
        """
        cutoff = datetime.utcnow() - timedelta(hours=hours)

        return self.db.query(WeatherAlert).filter(
            WeatherAlert.recorded_at >= cutoff
        ).order_by(
            WeatherAlert.recorded_at.desc()
        ).limit(limit).all()

    def get_active_weather_alerts(self) -> List[OperationalAlert]:
        """
        Get all active weather-related operational alerts.

        Returns:
            List of active weather OperationalAlerts
        """
        return self.db.query(OperationalAlert).filter(
            and_(
                OperationalAlert.alert_type == AlertType.WEATHER,
                OperationalAlert.is_active == True
            )
        ).order_by(OperationalAlert.created_at.desc()).all()

    def get_elevated_pool_jobs(self) -> List[PoolServiceJob]:
        """
        Get all pool service jobs currently elevated due to weather.

        Returns:
            List of weather-elevated PoolServiceJobs
        """
        return self.db.query(PoolServiceJob).filter(
            and_(
                PoolServiceJob.weather_elevated == True,
                PoolServiceJob.status.in_([
                    PoolJobStatus.SCHEDULED,
                    PoolJobStatus.IN_PROGRESS
                ])
            )
        ).order_by(PoolServiceJob.scheduled_at).all()

    async def reset_job_priorities_after_storm(self) -> int:
        """
        Reset pool job priorities after dust storm has passed (no alerts in 4 hours).

        Returns:
            Number of jobs reset
        """
        # Check if storm has passed (no dust storm alerts in 4 hours)
        four_hours_ago = datetime.utcnow() - timedelta(hours=4)
        recent_storm = self.db.query(WeatherAlert).filter(
            and_(
                WeatherAlert.is_dust_storm == True,
                WeatherAlert.recorded_at >= four_hours_ago
            )
        ).first()

        if recent_storm:
            logger.info("Storm still active, not resetting priorities")
            return 0

        # Reset elevated jobs to original priority
        jobs_to_reset = self.db.query(PoolServiceJob).filter(
            and_(
                PoolServiceJob.weather_elevated == True,
                PoolServiceJob.status.in_([
                    PoolJobStatus.SCHEDULED,
                    PoolJobStatus.IN_PROGRESS
                ])
            )
        ).all()

        reset_count = 0
        for job in jobs_to_reset:
            if job.original_priority:
                job.priority = job.original_priority
            else:
                job.priority = TaskPriority.NORMAL

            job.weather_elevated = False
            reset_count += 1
            logger.info(f"Pool job {job.id} priority reset to {job.priority.value}")

        self.db.commit()
        logger.info(f"Reset {reset_count} pool job priorities after storm")

        return reset_count


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

async def check_weather_and_elevate(db: Session) -> Dict[str, Any]:
    """
    Convenience function for cron job - checks weather and elevates jobs if needed.

    Args:
        db: Database session

    Returns:
        Status dict with weather info and actions taken
    """
    service = WeatherService(db)
    weather_alert = await service.check_and_store_weather()

    if not weather_alert:
        return {
            "status": "error",
            "message": "Failed to fetch weather data",
            "timestamp": datetime.utcnow().isoformat()
        }

    return {
        "status": "success",
        "timestamp": datetime.utcnow().isoformat(),
        "weather": {
            "temperature_f": weather_alert.temperature_f,
            "wind_speed_mph": weather_alert.wind_speed_mph,
            "conditions": weather_alert.conditions,
            "is_dust_storm": weather_alert.is_dust_storm
        },
        "actions": {
            "dust_storm_detected": weather_alert.is_dust_storm,
            "pool_jobs_elevated": weather_alert.pool_jobs_elevated,
            "alert_created": weather_alert.alert_sent
        }
    }


def get_weather_summary(db: Session) -> Dict[str, Any]:
    """
    Get a summary of current weather conditions and affected pool jobs.

    Args:
        db: Database session

    Returns:
        Weather summary dict
    """
    service = WeatherService(db)

    current = service.get_current_weather()
    active_storm = service.get_active_dust_storm()
    elevated_jobs = service.get_elevated_pool_jobs()
    active_alerts = service.get_active_weather_alerts()

    return {
        "current_conditions": {
            "temperature_f": current.temperature_f if current else None,
            "wind_speed_mph": current.wind_speed_mph if current else None,
            "conditions": current.conditions if current else None,
            "recorded_at": current.recorded_at.isoformat() if current else None
        } if current else None,
        "dust_storm": {
            "active": active_storm is not None,
            "wind_speed_mph": active_storm.wind_speed_mph if active_storm else None,
            "severity": active_storm.dust_storm_severity.value if active_storm and active_storm.dust_storm_severity else None,
            "started_at": active_storm.recorded_at.isoformat() if active_storm else None
        },
        "pool_jobs": {
            "elevated_count": len(elevated_jobs),
            "elevated_job_ids": [job.id for job in elevated_jobs]
        },
        "alerts": {
            "active_count": len(active_alerts),
            "alerts": [
                {
                    "id": alert.id,
                    "title": alert.title,
                    "severity": alert.severity.value
                }
                for alert in active_alerts
            ]
        }
    }
