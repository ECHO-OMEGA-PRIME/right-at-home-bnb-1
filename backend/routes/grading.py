"""
Right At Home BnB - Cleaner Grading API Routes
===============================================
API endpoints for:
- Cleaner performance tracking
- Review management
- Rankings and grades

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from services.cleaner_grading import cleaner_grading_service, CleanerGrade

router = APIRouter()


# ============================================================================
# REQUEST MODELS
# ============================================================================

class CleaningReviewRequest(BaseModel):
    cleaner_id: int
    property_id: int
    cleanliness_score: int = Field(..., ge=1, le=5)
    quickness_score: int = Field(..., ge=1, le=5)
    thoroughness_score: Optional[int] = Field(None, ge=1, le=5)
    communication_score: Optional[int] = Field(None, ge=1, le=5)
    scheduled_start: Optional[str] = None
    actual_start: Optional[str] = None
    actual_end: Optional[str] = None
    guest_comment: Optional[str] = None
    owner_notes: Optional[str] = None
    issues_found: Optional[List[str]] = None
    photos_taken: Optional[List[str]] = None
    reviewed_by: str = "system"


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/reviews")
async def add_cleaning_review(request: CleaningReviewRequest):
    """Add a cleaning review for a cleaner."""
    return await cleaner_grading_service.add_cleaning_review(**request.dict())


@router.get("/profile/{cleaner_id}")
async def get_cleaner_profile(cleaner_id: int):
    """Get a cleaner's performance profile."""
    profile = await cleaner_grading_service.get_cleaner_profile(cleaner_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Cleaner profile not found")
    return profile


@router.get("/rankings")
async def get_all_rankings():
    """Get all cleaners ranked by performance."""
    return await cleaner_grading_service.get_all_cleaner_rankings()


@router.get("/reviews/{cleaner_id}")
async def get_cleaner_reviews(cleaner_id: int, limit: int = 50):
    """Get recent reviews for a cleaner."""
    return await cleaner_grading_service.get_cleaner_reviews(cleaner_id, limit)


@router.get("/by-grade/{grade}")
async def get_cleaners_by_grade(grade: str):
    """Get all cleaners with a specific grade."""
    try:
        grade_enum = CleanerGrade(grade)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid grade: {grade}")
    return await cleaner_grading_service.get_cleaners_by_grade(grade_enum)


@router.post("/recalculate/{cleaner_id}")
async def recalculate_profile(cleaner_id: int):
    """Manually recalculate a cleaner's profile."""
    return await cleaner_grading_service.update_cleaner_profile(cleaner_id)
