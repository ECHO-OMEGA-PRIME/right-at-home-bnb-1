"""
Right At Home BnB - Weather API Routes
=======================================
API endpoints for weather monitoring and dust storm alerts.

Endpoints:
- GET  /api/weather/current     - Get current Midland weather
- GET  /api/weather/alerts      - Get active weather alerts
- GET  /api/weather/history     - Get weather history
- POST /api/weather/check       - Manual weather check trigger
- GET  /api/weather/pool-jobs   - Get weather-elevated pool jobs
- GET  /api/weather/summary     - Full weather summary for dashboard

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import logging
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models_weather import (
    WeatherAlert, WeatherAlertSeverity, PoolServiceJob,
    TaskPriority, PoolJobStatus
)
from database.models_financial import OperationalAlert, AlertType
from services.weather_service import (
    WeatherService, check_weather_and_elevate, get_weather_summary,
    DUST_STORM_WIND_THRESHOLD
)

logger = logging.getLogger("WeatherAPI")

router = APIRouter()


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class WeatherConditions(BaseModel):
    """Current weather conditions response."""
    temperature_f: Optional[float] = None
    feels_like_f: Optional[float] = None
    humidity_percent: Optional[float] = None
    wind_speed_mph: float
    wind_gust_mph: Optional[float] = None
    wind_direction: Optional[str] = None
    conditions: Optional[str] = None
    visibility_miles: Optional[float] = None
    recorded_at: datetime
    is_dust_storm: bool = False
    dust_storm_severity: Optional[str] = None

    class Config:
        from_attributes = True


class WeatherAlertResponse(BaseModel):
    """Weather alert response."""
    id: int
    recorded_at: datetime
    wind_speed_mph: float
    is_dust_storm: bool
    dust_storm_severity: Optional[str] = None
    temperature_f: Optional[float] = None
    conditions: Optional[str] = None
    pool_jobs_elevated: int = 0
    alert_sent: bool = False

    class Config:
        from_attributes = True


class OperationalAlertResponse(BaseModel):
    """Operational alert response."""
    id: int
    alert_type: str
    severity: str
    title: str
    description: Optional[str] = None
    is_active: bool
    is_acknowledged: bool
    created_at: datetime
    trigger_data: Optional[dict] = None

    class Config:
        from_attributes = True


class PoolJobResponse(BaseModel):
    """Pool service job response."""
    id: int
    property_id: str
    status: str
    priority: str
    weather_elevated: bool
    scheduled_at: datetime
    original_priority: Optional[str] = None

    class Config:
        from_attributes = True


class WeatherSummaryResponse(BaseModel):
    """Full weather summary for dashboard widget."""
    current_conditions: Optional[WeatherConditions] = None
    dust_storm: dict
    pool_jobs: dict
    alerts: dict
    last_check: Optional[datetime] = None
    next_check: Optional[datetime] = None


class WeatherCheckRequest(BaseModel):
    """Request body for manual weather check."""
    force: bool = Field(default=False, description="Force check even if recent data exists")


class WeatherCheckResponse(BaseModel):
    """Response from weather check."""
    status: str
    timestamp: datetime
    weather: Optional[dict] = None
    actions: Optional[dict] = None
    message: Optional[str] = None


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/current", response_model=WeatherConditions, tags=["Weather"])
async def get_current_weather(db: Session = Depends(get_db)):
    """
    Get current weather conditions for Midland, TX.

    Returns the most recent weather data stored in the database.
    Weather is automatically fetched every hour via cron job.
    """
    service = WeatherService(db)
    current = service.get_current_weather()

    if not current:
        raise HTTPException(
            status_code=404,
            detail="No weather data available. Please trigger a manual check."
        )

    return WeatherConditions(
        temperature_f=current.temperature_f,
        feels_like_f=current.feels_like_f,
        humidity_percent=current.humidity_percent,
        wind_speed_mph=current.wind_speed_mph,
        wind_gust_mph=current.wind_gust_mph,
        wind_direction=current.wind_direction,
        conditions=current.conditions,
        visibility_miles=current.visibility_miles,
        recorded_at=current.recorded_at,
        is_dust_storm=current.is_dust_storm,
        dust_storm_severity=current.dust_storm_severity.value if current.dust_storm_severity else None
    )


@router.get("/alerts", response_model=List[OperationalAlertResponse], tags=["Weather"])
async def get_active_alerts(db: Session = Depends(get_db)):
    """
    Get all active weather-related operational alerts.

    Returns alerts for:
    - Dust storms
    - Extreme heat
    - Freeze warnings
    """
    service = WeatherService(db)
    alerts = service.get_active_weather_alerts()

    return [
        OperationalAlertResponse(
            id=alert.id,
            alert_type=alert.alert_type.value,
            severity=alert.severity.value,
            title=alert.title,
            description=alert.description,
            is_active=alert.is_active,
            is_acknowledged=alert.is_acknowledged,
            created_at=alert.created_at,
            trigger_data=alert.trigger_data
        )
        for alert in alerts
    ]


@router.get("/history", response_model=List[WeatherAlertResponse], tags=["Weather"])
async def get_weather_history(
    hours: int = Query(default=24, ge=1, le=168, description="Hours of history (max 7 days)"),
    limit: int = Query(default=50, ge=1, le=200, description="Max records"),
    db: Session = Depends(get_db)
):
    """
    Get weather history for the specified time period.

    Default: Last 24 hours
    Max: 7 days (168 hours)
    """
    service = WeatherService(db)
    history = service.get_weather_history(hours=hours, limit=limit)

    return [
        WeatherAlertResponse(
            id=w.id,
            recorded_at=w.recorded_at,
            wind_speed_mph=w.wind_speed_mph,
            is_dust_storm=w.is_dust_storm,
            dust_storm_severity=w.dust_storm_severity.value if w.dust_storm_severity else None,
            temperature_f=w.temperature_f,
            conditions=w.conditions,
            pool_jobs_elevated=w.pool_jobs_elevated,
            alert_sent=w.alert_sent
        )
        for w in history
    ]


@router.post("/check", response_model=WeatherCheckResponse, tags=["Weather"])
async def trigger_weather_check(
    background_tasks: BackgroundTasks,
    request: WeatherCheckRequest = WeatherCheckRequest(),
    db: Session = Depends(get_db)
):
    """
    Manually trigger a weather check.

    This will:
    1. Fetch current weather from OpenWeatherMap
    2. Store weather data in database
    3. If dust storm detected:
       - Elevate all pool service jobs to URGENT
       - Create operational alert for dashboard

    Note: Weather is automatically checked every hour via cron job.
    Manual checks are for immediate updates.
    """
    try:
        result = await check_weather_and_elevate(db)

        return WeatherCheckResponse(
            status=result.get("status", "success"),
            timestamp=datetime.utcnow(),
            weather=result.get("weather"),
            actions=result.get("actions"),
            message=result.get("message")
        )

    except Exception as e:
        logger.error(f"Weather check failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Weather check failed: {str(e)}"
        )


@router.get("/pool-jobs", response_model=List[PoolJobResponse], tags=["Weather"])
async def get_weather_elevated_pool_jobs(db: Session = Depends(get_db)):
    """
    Get all pool service jobs currently elevated due to weather.

    These are jobs that have been automatically elevated to URGENT
    priority due to dust storm conditions.
    """
    service = WeatherService(db)
    jobs = service.get_elevated_pool_jobs()

    return [
        PoolJobResponse(
            id=job.id,
            property_id=job.property_id,
            status=job.status.value,
            priority=job.priority.value,
            weather_elevated=job.weather_elevated,
            scheduled_at=job.scheduled_at,
            original_priority=job.original_priority.value if job.original_priority else None
        )
        for job in jobs
    ]


@router.get("/summary", response_model=WeatherSummaryResponse, tags=["Weather"])
async def get_weather_dashboard_summary(db: Session = Depends(get_db)):
    """
    Get full weather summary for dashboard widget.

    Returns:
    - Current weather conditions
    - Active dust storm info
    - Weather-elevated pool jobs count
    - Active weather alerts
    """
    summary = get_weather_summary(db)

    current = summary.get("current_conditions")
    current_model = None
    if current:
        current_model = WeatherConditions(
            temperature_f=current.get("temperature_f"),
            wind_speed_mph=current.get("wind_speed_mph", 0),
            conditions=current.get("conditions"),
            recorded_at=datetime.fromisoformat(current["recorded_at"]) if current.get("recorded_at") else datetime.utcnow(),
            is_dust_storm=summary.get("dust_storm", {}).get("active", False)
        )

    return WeatherSummaryResponse(
        current_conditions=current_model,
        dust_storm=summary.get("dust_storm", {}),
        pool_jobs=summary.get("pool_jobs", {}),
        alerts=summary.get("alerts", {}),
        last_check=datetime.fromisoformat(current["recorded_at"]) if current and current.get("recorded_at") else None
    )


@router.post("/reset-priorities", tags=["Weather"])
async def reset_pool_job_priorities(db: Session = Depends(get_db)):
    """
    Reset pool job priorities after dust storm has passed.

    Jobs will only be reset if:
    - No dust storm alerts in the last 4 hours
    - Jobs were previously elevated due to weather

    This is automatically called by the cron job, but can be
    triggered manually if needed.
    """
    service = WeatherService(db)

    # Check for active storm
    active_storm = service.get_active_dust_storm()
    if active_storm:
        return {
            "status": "skipped",
            "message": "Dust storm still active, not resetting priorities",
            "active_storm": {
                "wind_speed_mph": active_storm.wind_speed_mph,
                "recorded_at": active_storm.recorded_at.isoformat()
            }
        }

    reset_count = await service.reset_job_priorities_after_storm()

    return {
        "status": "success",
        "jobs_reset": reset_count,
        "message": f"Reset {reset_count} pool job priorities to normal"
    }


@router.post("/acknowledge/{alert_id}", tags=["Weather"])
async def acknowledge_weather_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):
    """
    Acknowledge a weather alert.

    This marks the alert as acknowledged by the admin,
    but does not deactivate it.
    """
    alert = db.query(OperationalAlert).filter(
        OperationalAlert.id == alert_id,
        OperationalAlert.alert_type == AlertType.WEATHER
    ).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Weather alert not found")

    alert.is_acknowledged = True
    alert.acknowledged_at = datetime.utcnow()
    db.commit()

    return {
        "status": "success",
        "alert_id": alert_id,
        "acknowledged_at": alert.acknowledged_at.isoformat()
    }


@router.post("/resolve/{alert_id}", tags=["Weather"])
async def resolve_weather_alert(
    alert_id: int,
    resolution: str = Query(description="Resolution notes"),
    db: Session = Depends(get_db)
):
    """
    Resolve and deactivate a weather alert.

    This should be done when the weather conditions have
    returned to normal and no further action is needed.
    """
    alert = db.query(OperationalAlert).filter(
        OperationalAlert.id == alert_id,
        OperationalAlert.alert_type == AlertType.WEATHER
    ).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Weather alert not found")

    alert.is_active = False
    alert.manual_resolution = resolution
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = "admin"  # Would be actual user in production
    db.commit()

    return {
        "status": "success",
        "alert_id": alert_id,
        "resolved_at": alert.resolved_at.isoformat()
    }


@router.get("/threshold", tags=["Weather"])
async def get_dust_storm_threshold():
    """
    Get the current dust storm detection threshold.

    Default is 30 mph wind speed.
    """
    return {
        "dust_storm_threshold_mph": DUST_STORM_WIND_THRESHOLD,
        "description": "Wind speed threshold for dust storm detection",
        "location": {
            "name": "Midland, TX",
            "lat": 31.9973,
            "lon": -102.0779
        }
    }
