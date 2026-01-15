"""
Right At Home BnB - Marketing API Routes
========================================
Social media advertising for property acquisition.

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel, EmailStr

from services.social_marketing import (
    social_marketing_service, SocialPlatform, LeadStatus
)

router = APIRouter()


class CampaignCreateRequest(BaseModel):
    name: str
    platforms: List[str]
    template_key: str
    budget_daily: float = 50.0
    target_zip_codes: List[str] = []
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class LeadAddRequest(BaseModel):
    source_platform: str
    owner_name: str
    email: EmailStr
    phone: str
    property_address: str
    property_details: Optional[str] = None
    notes: Optional[str] = None


class LeadUpdateRequest(BaseModel):
    new_status: str
    notes: Optional[str] = None
    follow_up_date: Optional[str] = None


class ContentGenerateRequest(BaseModel):
    template_key: str
    platform: str
    custom_values: dict = {}


# =========================================================================
# CAMPAIGNS
# =========================================================================

@router.post("/campaigns/create")
async def create_campaign(request: CampaignCreateRequest):
    """Create a new social media marketing campaign."""
    platforms = []
    for p in request.platforms:
        try:
            platforms.append(SocialPlatform(p))
        except ValueError:
            pass

    if not platforms:
        raise HTTPException(status_code=400, detail="No valid platforms specified")

    return await social_marketing_service.create_campaign(
        name=request.name,
        platforms=platforms,
        template_key=request.template_key,
        budget_daily=request.budget_daily,
        target_zip_codes=request.target_zip_codes,
        start_date=request.start_date,
        end_date=request.end_date
    )


@router.get("/campaigns")
async def list_campaigns(active_only: bool = True):
    """List all marketing campaigns."""
    return await social_marketing_service.list_campaigns(active_only)


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str):
    """Get campaign details."""
    return await social_marketing_service.get_campaign(campaign_id)


@router.put("/campaigns/{campaign_id}/pause")
async def pause_campaign(campaign_id: str):
    """Pause a campaign."""
    return await social_marketing_service.pause_campaign(campaign_id)


@router.put("/campaigns/{campaign_id}/resume")
async def resume_campaign(campaign_id: str):
    """Resume a paused campaign."""
    return await social_marketing_service.resume_campaign(campaign_id)


@router.get("/campaigns/{campaign_id}/performance")
async def get_campaign_performance(campaign_id: str):
    """Get campaign performance metrics."""
    return await social_marketing_service.get_campaign_performance(campaign_id)


# =========================================================================
# LEADS
# =========================================================================

@router.post("/leads/add")
async def add_lead(request: LeadAddRequest):
    """Add a new property owner lead."""
    return await social_marketing_service.add_lead(
        source_platform=request.source_platform,
        owner_name=request.owner_name,
        email=request.email,
        phone=request.phone,
        property_address=request.property_address,
        property_details=request.property_details,
        notes=request.notes
    )


@router.get("/leads")
async def list_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 50
):
    """List property owner leads."""
    status_filter = LeadStatus(status) if status else None
    return await social_marketing_service.list_leads(status_filter, source, limit)


@router.get("/leads/{lead_id}")
async def get_lead(lead_id: str):
    """Get lead details."""
    return await social_marketing_service.get_lead(lead_id)


@router.put("/leads/{lead_id}/status")
async def update_lead_status(lead_id: str, request: LeadUpdateRequest):
    """Update lead status."""
    try:
        new_status = LeadStatus(request.new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")

    return await social_marketing_service.update_lead_status(
        lead_id=lead_id,
        new_status=new_status,
        notes=request.notes,
        follow_up_date=request.follow_up_date
    )


@router.get("/leads/pipeline")
async def get_lead_pipeline():
    """Get lead pipeline summary."""
    return await social_marketing_service.get_lead_pipeline()


@router.get("/leads/follow-ups")
async def get_follow_ups_due():
    """Get leads with follow-ups due today or overdue."""
    return await social_marketing_service.get_follow_ups_due()


# =========================================================================
# CONTENT & TEMPLATES
# =========================================================================

@router.get("/templates")
async def list_templates():
    """List available ad templates."""
    return await social_marketing_service.list_templates()


@router.post("/content/generate")
async def generate_content(request: ContentGenerateRequest):
    """Generate social media content from template."""
    return await social_marketing_service.generate_content(
        template_key=request.template_key,
        platform=request.platform,
        custom_values=request.custom_values
    )


@router.post("/content/schedule")
async def schedule_post(
    platform: str,
    content: str,
    schedule_time: str,
    campaign_id: Optional[str] = None
):
    """Schedule a social media post."""
    return await social_marketing_service.schedule_post(
        platform=platform,
        content=content,
        schedule_time=schedule_time,
        campaign_id=campaign_id
    )


# =========================================================================
# ANALYTICS
# =========================================================================

@router.get("/analytics/overview")
async def get_marketing_overview():
    """Get overall marketing analytics."""
    return await social_marketing_service.get_marketing_overview()


@router.get("/analytics/roi")
async def get_roi_analysis(period_days: int = 30):
    """Get ROI analysis for marketing spend."""
    return await social_marketing_service.get_roi_analysis(period_days)


@router.get("/analytics/platform/{platform}")
async def get_platform_analytics(platform: str, period_days: int = 30):
    """Get analytics for a specific platform."""
    return await social_marketing_service.get_platform_analytics(platform, period_days)
