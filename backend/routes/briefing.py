"""
Right At Home BnB - Daily Briefing API Routes
==============================================
API endpoints for Steven's daily, weekly, monthly, yearly briefings.

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, Query
from typing import Optional

from services.daily_briefing import daily_briefing_service

router = APIRouter()


@router.get("/daily")
async def get_daily_briefing(target_date: Optional[str] = None):
    """Get daily briefing for Steven."""
    return await daily_briefing_service.generate_daily_briefing(target_date)


@router.get("/weekly")
async def get_weekly_report(end_date: Optional[str] = None):
    """Get weekly report."""
    return await daily_briefing_service.generate_weekly_report(end_date)


@router.get("/monthly")
async def get_monthly_report(
    year: Optional[int] = None,
    month: Optional[int] = None
):
    """Get monthly report."""
    return await daily_briefing_service.generate_monthly_report(year, month)


@router.get("/yearly")
async def get_yearly_report(year: Optional[int] = None):
    """Get yearly report with tax data."""
    return await daily_briefing_service.generate_yearly_report(year)


@router.post("/deliver")
async def deliver_briefing(method: str = "voice"):
    """Deliver today's briefing via voice, SMS, or push."""
    return await daily_briefing_service.deliver_briefing(method)
