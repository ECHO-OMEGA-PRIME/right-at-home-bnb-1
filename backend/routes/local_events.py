"""
Right At Home BnB - Local Events API Routes
============================================
VRBO integration and local Midland events.

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, Query
from typing import Optional
from datetime import date

from services.local_events import local_events_service

router = APIRouter()


@router.get("/events")
async def get_upcoming_events(
    days_ahead: int = Query(default=30, ge=1, le=90),
    category: Optional[str] = None
):
    """Get upcoming local events in Midland area."""
    return await local_events_service.get_upcoming_events(days_ahead, category)


@router.get("/attractions")
async def get_local_attractions(category: Optional[str] = None):
    """Get local attractions and things to do."""
    return await local_events_service.get_local_attractions(category)


@router.get("/stevens-picks")
async def get_stevens_picks(category: Optional[str] = None):
    """Get Steven's personal recommendations."""
    return await local_events_service.get_stevens_picks(category)


@router.get("/vrbo/sync")
async def sync_vrbo_bookings():
    """Sync bookings from VRBO Partner API."""
    return await local_events_service.sync_vrbo_bookings()


@router.get("/vrbo/calendar")
async def get_vrbo_calendar(
    property_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get VRBO availability calendar for a property."""
    return await local_events_service.get_vrbo_calendar(
        property_id, start_date, end_date
    )


@router.get("/demand-forecast")
async def get_demand_forecast(days_ahead: int = Query(default=30, ge=7, le=90)):
    """Get demand forecast with pricing recommendations."""
    return await local_events_service.get_demand_forecast(days_ahead)


@router.get("/guest-guide")
async def get_guest_guide(check_in: str, check_out: str):
    """Generate personalized guest guide with events during their stay."""
    return await local_events_service.generate_guest_guide(check_in, check_out)


@router.post("/vrbo/push-rates")
async def push_dynamic_rates(property_id: str):
    """Push dynamic pricing rates to VRBO."""
    return await local_events_service.push_dynamic_rates(property_id)
