"""
Enhanced Cleaner Tracking API Routes for Right at Home BnB
GPS check-in, photo verification, performance scoring
@author ECHO OMEGA PRIME
"""

import uuid
import math
from typing import Optional, List
from datetime import datetime, date, timedelta
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from loguru import logger

from database.connection import get_db
from database.models import (
    User, CleaningJob, Property, Booking,
    UserRole, CleaningType, CleaningStatus
)
from schemas.cleaner import (
    CleanerCreate, CleanerUpdate, CleanerResponse, CleanerListResponse,
    CleaningJobCreate, CleaningJobUpdate, CleaningJobResponse, CleaningJobListResponse,
    GPSCheckInRequest, PhotoUploadRequest, CompleteJobRequest, ScoreJobRequest,
    CleanerPerformanceMetrics, ChecklistItem, ChecklistProgress,
    CleanerStatus, CleaningPriority
)
from schemas.base import PaginatedResponse
from services.photo_analysis import photo_analysis_service
from services.twilio_sms import twilio_sms_service

router = APIRouter()


# ============================================
# CONSTANTS
# ============================================

# GPS tolerance in meters for check-in verification
GPS_TOLERANCE_METERS = 100

# Default cleaning checklist
DEFAULT_CHECKLIST = [
    {"id": "bathroom_toilet", "category": "Bathroom", "item": "Clean and sanitize toilet", "required": True},
    {"id": "bathroom_shower", "category": "Bathroom", "item": "Clean shower/tub", "required": True},
    {"id": "bathroom_sink", "category": "Bathroom", "item": "Clean sink and counter", "required": True},
    {"id": "bathroom_mirror", "category": "Bathroom", "item": "Clean mirror", "required": True},
    {"id": "bathroom_floor", "category": "Bathroom", "item": "Mop floor", "required": True},
    {"id": "bathroom_towels", "category": "Bathroom", "item": "Replace towels", "required": True},
    {"id": "bedroom_bed", "category": "Bedroom", "item": "Make bed with fresh linens", "required": True},
    {"id": "bedroom_dust", "category": "Bedroom", "item": "Dust all surfaces", "required": True},
    {"id": "bedroom_vacuum", "category": "Bedroom", "item": "Vacuum floor", "required": True},
    {"id": "kitchen_counters", "category": "Kitchen", "item": "Clean counters", "required": True},
    {"id": "kitchen_appliances", "category": "Kitchen", "item": "Clean appliances exterior", "required": True},
    {"id": "kitchen_sink", "category": "Kitchen", "item": "Clean sink", "required": True},
    {"id": "kitchen_fridge", "category": "Kitchen", "item": "Check and clean fridge", "required": True},
    {"id": "kitchen_floor", "category": "Kitchen", "item": "Mop floor", "required": True},
    {"id": "living_dust", "category": "Living Room", "item": "Dust all surfaces", "required": True},
    {"id": "living_vacuum", "category": "Living Room", "item": "Vacuum floor/carpet", "required": True},
    {"id": "living_cushions", "category": "Living Room", "item": "Fluff and arrange cushions", "required": False},
    {"id": "general_trash", "category": "General", "item": "Empty all trash cans", "required": True},
    {"id": "general_windows", "category": "General", "item": "Clean windows (interior)", "required": False},
    {"id": "general_doors", "category": "General", "item": "Wipe door handles", "required": True},
]


# ============================================
# UTILITY FUNCTIONS
# ============================================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS coordinates in meters."""
    R = 6371000  # Earth's radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c


def verify_gps_location(
    check_lat: float,
    check_lng: float,
    property_lat: float,
    property_lng: float,
    tolerance_meters: float = GPS_TOLERANCE_METERS
) -> tuple[bool, float]:
    """Verify if GPS coordinates are within tolerance of property."""
    distance = haversine_distance(check_lat, check_lng, property_lat, property_lng)
    return distance <= tolerance_meters, distance


def calculate_cleaner_score(
    checklist_completion: float,
    photo_quality_score: float,
    on_time: bool,
    duration_vs_expected: float,
    issues_reported: int
) -> int:
    """Calculate overall job score (1-10)."""
    # Base score from checklist completion (40%)
    checklist_score = checklist_completion * 4

    # Photo quality (30%)
    photo_score = (photo_quality_score / 10) * 3

    # On-time bonus (15%)
    time_score = 1.5 if on_time else 0.5

    # Duration efficiency (10%)
    if 0.8 <= duration_vs_expected <= 1.2:
        duration_score = 1.0
    elif duration_vs_expected < 0.8:
        duration_score = 0.5  # Too fast might mean incomplete
    else:
        duration_score = max(0, 1.0 - (duration_vs_expected - 1.2) * 0.5)

    # Issue penalty (5%)
    issue_penalty = min(issues_reported * 0.25, 0.5)

    total = checklist_score + photo_score + time_score + duration_score - issue_penalty
    return max(1, min(10, round(total)))


# ============================================
# CLEANER MANAGEMENT
# ============================================

@router.post("/", response_model=CleanerResponse)
async def create_cleaner(
    cleaner_data: CleanerCreate,
    db: Session = Depends(get_db)
):
    """Register a new cleaner."""
    # Check for existing user with this email
    existing = db.query(User).filter(User.email == cleaner_data.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    cleaner = User(
        id=str(uuid.uuid4()),
        email=cleaner_data.email,
        name=cleaner_data.name,
        phone=cleaner_data.phone,
        role=UserRole.CLEANER,
        is_active=True
    )

    db.add(cleaner)
    db.commit()
    db.refresh(cleaner)

    logger.info(f"Cleaner registered: {cleaner.name}")

    return _build_cleaner_response(cleaner, db)


@router.get("/", response_model=List[CleanerListResponse])
async def list_cleaners(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """List all cleaners."""
    query = db.query(User).filter(User.role == UserRole.CLEANER)

    if active_only:
        query = query.filter(User.is_active == True)

    cleaners = query.order_by(User.name).all()

    return [_build_cleaner_list_response(c, db) for c in cleaners]


@router.get("/leaderboard")
async def get_cleaner_leaderboard(
    period: str = Query("month", regex="^(week|month|quarter|year|all)$"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Get cleaner performance leaderboard."""
    # Calculate date range
    today = date.today()
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    elif period == "quarter":
        start_date = today - timedelta(days=90)
    elif period == "year":
        start_date = today - timedelta(days=365)
    else:
        start_date = None

    # Get all cleaners
    cleaners = db.query(User).filter(
        User.role == UserRole.CLEANER,
        User.is_active == True
    ).all()

    leaderboard = []

    for cleaner in cleaners:
        # Get completed jobs in period
        job_query = db.query(CleaningJob).filter(
            CleaningJob.cleaner_id == cleaner.id,
            CleaningJob.status == CleaningStatus.COMPLETED
        )

        if start_date:
            job_query = job_query.filter(
                CleaningJob.completed_at >= datetime.combine(start_date, datetime.min.time())
            )

        jobs = job_query.all()

        if not jobs:
            continue

        avg_score = sum(j.score or 0 for j in jobs) / len(jobs)
        on_time_count = sum(
            1 for j in jobs
            if j.started_at and j.scheduled_at and j.started_at <= j.scheduled_at + timedelta(minutes=15)
        )
        on_time_rate = on_time_count / len(jobs) if jobs else 0

        leaderboard.append({
            "cleaner_id": cleaner.id,
            "name": cleaner.name,
            "completed_jobs": len(jobs),
            "avg_score": round(avg_score, 1),
            "on_time_rate": round(on_time_rate * 100, 1),
            "total_hours": sum(j.duration_mins or 0 for j in jobs) / 60
        })

    # Sort by avg_score descending
    leaderboard.sort(key=lambda x: (-x["avg_score"], -x["completed_jobs"]))

    # Add rank
    for i, entry in enumerate(leaderboard[:limit]):
        entry["rank"] = i + 1

    return {
        "period": period,
        "leaderboard": leaderboard[:limit]
    }


@router.get("/{cleaner_id}", response_model=CleanerResponse)
async def get_cleaner(cleaner_id: str, db: Session = Depends(get_db)):
    """Get cleaner profile with performance metrics."""
    cleaner = db.query(User).filter(
        User.id == cleaner_id,
        User.role == UserRole.CLEANER
    ).first()

    if not cleaner:
        raise HTTPException(status_code=404, detail="Cleaner not found")

    return _build_cleaner_response(cleaner, db)


@router.get("/{cleaner_id}/performance", response_model=CleanerPerformanceMetrics)
async def get_cleaner_performance(
    cleaner_id: str,
    period_days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db)
):
    """Get detailed performance metrics for a cleaner."""
    cleaner = db.query(User).filter(
        User.id == cleaner_id,
        User.role == UserRole.CLEANER
    ).first()

    if not cleaner:
        raise HTTPException(status_code=404, detail="Cleaner not found")

    start_date = datetime.utcnow() - timedelta(days=period_days)

    jobs = db.query(CleaningJob).filter(
        CleaningJob.cleaner_id == cleaner_id,
        CleaningJob.status == CleaningStatus.COMPLETED,
        CleaningJob.completed_at >= start_date
    ).all()

    if not jobs:
        return CleanerPerformanceMetrics(
            cleaner_id=cleaner_id,
            period_days=period_days,
            total_jobs=0,
            avg_score=0,
            on_time_rate=0,
            avg_duration_mins=0,
            issues_reported=0
        )

    avg_score = sum(j.score or 0 for j in jobs) / len(jobs)
    on_time_count = sum(
        1 for j in jobs
        if j.started_at and j.scheduled_at and j.started_at <= j.scheduled_at + timedelta(minutes=15)
    )
    avg_duration = sum(j.duration_mins or 0 for j in jobs) / len(jobs)
    issues = sum(1 for j in jobs if j.issues)

    # Score distribution
    score_distribution = {i: 0 for i in range(1, 11)}
    for j in jobs:
        if j.score:
            score_distribution[j.score] = score_distribution.get(j.score, 0) + 1

    return CleanerPerformanceMetrics(
        cleaner_id=cleaner_id,
        period_days=period_days,
        total_jobs=len(jobs),
        avg_score=round(avg_score, 1),
        on_time_rate=round(on_time_count / len(jobs) * 100, 1),
        avg_duration_mins=round(avg_duration),
        issues_reported=issues,
        score_distribution=score_distribution
    )


@router.put("/{cleaner_id}")
async def update_cleaner(
    cleaner_id: str,
    update_data: CleanerUpdate,
    db: Session = Depends(get_db)
):
    """Update cleaner profile."""
    cleaner = db.query(User).filter(
        User.id == cleaner_id,
        User.role == UserRole.CLEANER
    ).first()

    if not cleaner:
        raise HTTPException(status_code=404, detail="Cleaner not found")

    update_dict = update_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        if hasattr(cleaner, field):
            setattr(cleaner, field, value)

    db.commit()
    db.refresh(cleaner)

    return _build_cleaner_response(cleaner, db)


# ============================================
# CLEANING JOBS
# ============================================

@router.get("/jobs/active", response_model=List[CleaningJobListResponse])
async def get_active_jobs(db: Session = Depends(get_db)):
    """Get all active (scheduled or in-progress) cleaning jobs."""
    jobs = db.query(CleaningJob).filter(
        CleaningJob.status.in_([CleaningStatus.SCHEDULED, CleaningStatus.ASSIGNED, CleaningStatus.IN_PROGRESS])
    ).order_by(CleaningJob.scheduled_at).all()

    return [_build_job_list_response(j) for j in jobs]


@router.get("/jobs/today", response_model=List[CleaningJobListResponse])
async def get_todays_jobs(db: Session = Depends(get_db)):
    """Get all cleaning jobs scheduled for today."""
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    jobs = db.query(CleaningJob).filter(
        CleaningJob.scheduled_at >= today_start,
        CleaningJob.scheduled_at <= today_end
    ).order_by(CleaningJob.scheduled_at).all()

    return [_build_job_list_response(j) for j in jobs]


@router.get("/jobs/cleaner/{cleaner_id}", response_model=List[CleaningJobListResponse])
async def get_cleaner_jobs(
    cleaner_id: str,
    status: Optional[CleaningStatus] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get jobs assigned to a specific cleaner."""
    query = db.query(CleaningJob).filter(CleaningJob.cleaner_id == cleaner_id)

    if status:
        query = query.filter(CleaningJob.status == status)
    if date_from:
        query = query.filter(CleaningJob.scheduled_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(CleaningJob.scheduled_at <= datetime.combine(date_to, datetime.max.time()))

    jobs = query.order_by(CleaningJob.scheduled_at.desc()).all()

    return [_build_job_list_response(j) for j in jobs]


@router.post("/jobs", response_model=CleaningJobResponse)
async def create_cleaning_job(
    job_data: CleaningJobCreate,
    db: Session = Depends(get_db)
):
    """Create a new cleaning job."""
    # Verify property exists
    property_obj = db.query(Property).filter(Property.id == job_data.property_id).first()
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")

    # Verify cleaner if assigned
    if job_data.cleaner_id:
        cleaner = db.query(User).filter(
            User.id == job_data.cleaner_id,
            User.role == UserRole.CLEANER
        ).first()
        if not cleaner:
            raise HTTPException(status_code=404, detail="Cleaner not found")

    # Get checklist from property or use default
    checklist = property_obj.cleaning_checklist or DEFAULT_CHECKLIST

    job = CleaningJob(
        id=str(uuid.uuid4()),
        property_id=job_data.property_id,
        cleaner_id=job_data.cleaner_id,
        booking_id=job_data.booking_id,
        scheduled_at=job_data.scheduled_at,
        job_type=job_data.job_type,
        status=CleaningStatus.ASSIGNED if job_data.cleaner_id else CleaningStatus.SCHEDULED,
        checklist_progress={"items": checklist, "completed": []},
        photos=[],
        notes=job_data.notes
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    # Notify cleaner
    if job.cleaner_id and job.cleaner and job.cleaner.phone:
        await twilio_sms_service.send_sms(
            job.cleaner.phone,
            f"New cleaning job assigned: {property_obj.name} on {job.scheduled_at.strftime('%b %d at %I:%M %p')}. Open app to view details."
        )

    logger.info(f"Cleaning job created: {job.id} at {property_obj.name}")

    return _build_job_response(job)


@router.get("/jobs/{job_id}", response_model=CleaningJobResponse)
async def get_cleaning_job(job_id: str, db: Session = Depends(get_db)):
    """Get cleaning job details."""
    job = db.query(CleaningJob).filter(CleaningJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return _build_job_response(job)


@router.post("/jobs/{job_id}/assign")
async def assign_cleaner_to_job(
    job_id: str,
    cleaner_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Assign a cleaner to a job."""
    job = db.query(CleaningJob).filter(CleaningJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    cleaner = db.query(User).filter(
        User.id == cleaner_id,
        User.role == UserRole.CLEANER,
        User.is_active == True
    ).first()
    if not cleaner:
        raise HTTPException(status_code=404, detail="Cleaner not found or inactive")

    job.cleaner_id = cleaner_id
    job.status = CleaningStatus.ASSIGNED
    db.commit()

    # Notify cleaner
    if cleaner.phone:
        property_name = job.property.name if job.property else "Unknown"
        background_tasks.add_task(
            twilio_sms_service.send_sms,
            cleaner.phone,
            f"You've been assigned to clean {property_name} on {job.scheduled_at.strftime('%b %d at %I:%M %p')}."
        )

    return {"success": True, "job_id": job_id, "cleaner_id": cleaner_id, "status": "ASSIGNED"}


@router.post("/jobs/{job_id}/checkin")
async def cleaner_gps_checkin(
    job_id: str,
    checkin_data: GPSCheckInRequest,
    db: Session = Depends(get_db)
):
    """GPS check-in for cleaner at property."""
    job = db.query(CleaningJob).filter(CleaningJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status not in [CleaningStatus.SCHEDULED, CleaningStatus.ASSIGNED]:
        raise HTTPException(status_code=400, detail=f"Cannot check in - job status is {job.status.value}")

    # Verify GPS location
    property_obj = job.property
    if property_obj and property_obj.latitude and property_obj.longitude:
        is_valid, distance = verify_gps_location(
            checkin_data.latitude,
            checkin_data.longitude,
            property_obj.latitude,
            property_obj.longitude
        )

        if not is_valid:
            return {
                "success": False,
                "error": "GPS location too far from property",
                "distance_meters": round(distance),
                "tolerance_meters": GPS_TOLERANCE_METERS
            }

    # Record check-in
    job.check_in_lat = checkin_data.latitude
    job.check_in_lng = checkin_data.longitude
    job.started_at = datetime.utcnow()
    job.status = CleaningStatus.IN_PROGRESS

    db.commit()

    # Check if on time
    on_time = job.started_at <= job.scheduled_at + timedelta(minutes=15)

    logger.info(f"Cleaner checked in to job {job_id}")

    return {
        "success": True,
        "job_id": job_id,
        "status": "IN_PROGRESS",
        "checked_in_at": job.started_at.isoformat(),
        "on_time": on_time
    }


@router.post("/jobs/{job_id}/photo")
async def upload_cleaning_photo(
    job_id: str,
    photo: UploadFile = File(...),
    category: str = Form(default="other"),
    description: str = Form(default=""),
    db: Session = Depends(get_db)
):
    """Upload a cleaning verification photo."""
    job = db.query(CleaningJob).filter(CleaningJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != CleaningStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Can only upload photos for in-progress jobs")

    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"job_{job_id}_{category}_{timestamp}_{photo.filename}"

    # In production, upload to cloud storage (S3, GCS, etc.)
    # For now, we'll store the reference
    photo_url = f"/uploads/cleaning/{filename}"

    # Read photo content for analysis
    photo_content = await photo.read()

    # Analyze photo with AI
    # In production, save to temp file or use bytes directly
    # analysis = await photo_analysis_service.analyze_cleaning_photo(photo_url, room_hint=category)

    # Add to job photos
    photos = job.photos or []
    photos.append({
        "filename": filename,
        "url": photo_url,
        "category": category,
        "description": description,
        "uploaded_at": datetime.utcnow().isoformat(),
        # "analysis": analysis.dict() if analysis.success else None
    })
    job.photos = photos

    db.commit()

    return {
        "success": True,
        "job_id": job_id,
        "filename": filename,
        "url": photo_url,
        "total_photos": len(photos),
        "category": category
    }


@router.post("/jobs/{job_id}/checklist/{item_id}")
async def complete_checklist_item(
    job_id: str,
    item_id: str,
    completed: bool = True,
    db: Session = Depends(get_db)
):
    """Mark a checklist item as complete/incomplete."""
    job = db.query(CleaningJob).filter(CleaningJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != CleaningStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Can only update checklist for in-progress jobs")

    progress = job.checklist_progress or {"items": DEFAULT_CHECKLIST, "completed": []}
    completed_items = progress.get("completed", [])

    if completed and item_id not in completed_items:
        completed_items.append(item_id)
    elif not completed and item_id in completed_items:
        completed_items.remove(item_id)

    progress["completed"] = completed_items
    job.checklist_progress = progress

    db.commit()

    # Calculate completion percentage
    total_items = len(progress.get("items", []))
    completed_count = len(completed_items)
    completion_rate = (completed_count / total_items * 100) if total_items > 0 else 0

    return {
        "success": True,
        "job_id": job_id,
        "item_id": item_id,
        "completed": completed,
        "completion_rate": round(completion_rate, 1),
        "items_completed": completed_count,
        "items_total": total_items
    }


@router.post("/jobs/{job_id}/complete")
async def complete_cleaning_job(
    job_id: str,
    complete_data: CompleteJobRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Complete a cleaning job with checkout."""
    job = db.query(CleaningJob).filter(CleaningJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != CleaningStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Can only complete in-progress jobs")

    # Verify minimum photos
    photos = job.photos or []
    min_photos = 5
    if len(photos) < min_photos:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum {min_photos} photos required. Current: {len(photos)}"
        )

    # Verify checklist completion
    progress = job.checklist_progress or {}
    items = progress.get("items", [])
    completed = progress.get("completed", [])
    required_items = [i["id"] for i in items if i.get("required", True)]
    missing_required = [i for i in required_items if i not in completed]

    if missing_required:
        raise HTTPException(
            status_code=400,
            detail=f"Required checklist items not completed: {missing_required}"
        )

    # GPS checkout
    if complete_data.latitude and complete_data.longitude:
        job.check_out_lat = complete_data.latitude
        job.check_out_lng = complete_data.longitude

    # Calculate duration
    if job.started_at:
        duration = datetime.utcnow() - job.started_at
        job.duration_mins = int(duration.total_seconds() / 60)

    # Record notes/issues
    if complete_data.notes:
        job.notes = (job.notes or "") + f"\n[Completion notes]: {complete_data.notes}"
    if complete_data.issues:
        job.issues = complete_data.issues

    # Mark complete
    job.status = CleaningStatus.COMPLETED
    job.completed_at = datetime.utcnow()

    db.commit()

    # Schedule AI photo analysis for scoring
    # background_tasks.add_task(analyze_and_score_job, job_id, db)

    logger.info(f"Cleaning job completed: {job_id}")

    return {
        "success": True,
        "job_id": job_id,
        "status": "COMPLETED",
        "completed_at": job.completed_at.isoformat(),
        "duration_mins": job.duration_mins,
        "photos_submitted": len(photos),
        "awaiting_score": True
    }


@router.post("/jobs/{job_id}/score")
async def score_cleaning_job(
    job_id: str,
    score_data: ScoreJobRequest,
    db: Session = Depends(get_db)
):
    """Score a completed cleaning job."""
    job = db.query(CleaningJob).filter(CleaningJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != CleaningStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Can only score completed jobs")

    # Validate score
    if not 1 <= score_data.score <= 10:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 10")

    job.score = score_data.score
    job.score_feedback = score_data.feedback

    db.commit()

    # Notify cleaner of score
    if job.cleaner and job.cleaner.phone:
        emoji = "🌟" if score_data.score >= 8 else "👍" if score_data.score >= 6 else "📝"
        await twilio_sms_service.send_sms(
            job.cleaner.phone,
            f"{emoji} Your cleaning job at {job.property.name if job.property else 'property'} has been scored: {score_data.score}/10. {score_data.feedback or ''}"
        )

    return {
        "success": True,
        "job_id": job_id,
        "score": score_data.score,
        "feedback": score_data.feedback
    }


@router.post("/jobs/{job_id}/issue")
async def report_issue(
    job_id: str,
    issue_description: str,
    severity: str = Query("medium", regex="^(low|medium|high|critical)$"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """Report an issue during cleaning."""
    job = db.query(CleaningJob).filter(CleaningJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = CleaningStatus.ISSUE_REPORTED
    job.issues = (job.issues or "") + f"\n[{severity.upper()}]: {issue_description}"

    db.commit()

    # Alert Steven for high/critical issues
    if severity in ["high", "critical"]:
        property_name = job.property.name if job.property else "Unknown property"
        background_tasks.add_task(
            twilio_sms_service.alert_steven,
            f"Cleaning issue at {property_name}: {issue_description}"
        )

    return {
        "success": True,
        "job_id": job_id,
        "status": "ISSUE_REPORTED",
        "severity": severity,
        "steven_alerted": severity in ["high", "critical"]
    }


# ============================================
# HELPER FUNCTIONS
# ============================================

def _build_cleaner_response(cleaner: User, db: Session) -> CleanerResponse:
    """Build CleanerResponse from User model."""
    # Get job stats
    jobs = db.query(CleaningJob).filter(CleaningJob.cleaner_id == cleaner.id).all()
    completed_jobs = [j for j in jobs if j.status == CleaningStatus.COMPLETED]

    avg_score = (
        sum(j.score or 0 for j in completed_jobs) / len(completed_jobs)
        if completed_jobs else 0
    )

    on_time_count = sum(
        1 for j in completed_jobs
        if j.started_at and j.scheduled_at and j.started_at <= j.scheduled_at + timedelta(minutes=15)
    )
    on_time_rate = on_time_count / len(completed_jobs) if completed_jobs else 0

    missed_jobs = len([j for j in jobs if j.status == CleaningStatus.CANCELLED and j.cleaner_id])

    return CleanerResponse(
        id=cleaner.id,
        name=cleaner.name,
        email=cleaner.email,
        phone=cleaner.phone,
        is_active=cleaner.is_active,
        avg_score=round(avg_score, 1),
        completed_jobs=len(completed_jobs),
        missed_jobs=missed_jobs,
        on_time_rate=round(on_time_rate * 100, 1),
        created_at=cleaner.created_at,
        updated_at=cleaner.updated_at
    )


def _build_cleaner_list_response(cleaner: User, db: Session) -> CleanerListResponse:
    """Build CleanerListResponse from User model."""
    completed_count = db.query(CleaningJob).filter(
        CleaningJob.cleaner_id == cleaner.id,
        CleaningJob.status == CleaningStatus.COMPLETED
    ).count()

    avg_score_result = db.query(func.avg(CleaningJob.score)).filter(
        CleaningJob.cleaner_id == cleaner.id,
        CleaningJob.status == CleaningStatus.COMPLETED,
        CleaningJob.score.isnot(None)
    ).scalar()

    return CleanerListResponse(
        id=cleaner.id,
        name=cleaner.name,
        phone=cleaner.phone,
        is_active=cleaner.is_active,
        avg_score=round(avg_score_result or 0, 1),
        completed_jobs=completed_count
    )


def _build_job_response(job: CleaningJob) -> CleaningJobResponse:
    """Build CleaningJobResponse from CleaningJob model."""
    return CleaningJobResponse(
        id=job.id,
        property_id=job.property_id,
        property_name=job.property.name if job.property else None,
        property_address=job.property.address if job.property else None,
        cleaner_id=job.cleaner_id,
        cleaner_name=job.cleaner.name if job.cleaner else None,
        booking_id=job.booking_id,
        scheduled_at=job.scheduled_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        job_type=job.job_type,
        status=job.status,
        gps_checkin={
            "lat": job.check_in_lat,
            "lng": job.check_in_lng,
            "time": job.started_at.isoformat() if job.started_at else None
        } if job.check_in_lat else None,
        gps_checkout={
            "lat": job.check_out_lat,
            "lng": job.check_out_lng,
            "time": job.completed_at.isoformat() if job.completed_at else None
        } if job.check_out_lat else None,
        checklist_progress=job.checklist_progress,
        photos=job.photos or [],
        score=job.score,
        score_feedback=job.score_feedback,
        duration_mins=job.duration_mins,
        notes=job.notes,
        issues=job.issues,
        created_at=job.created_at,
        updated_at=job.updated_at
    )


def _build_job_list_response(job: CleaningJob) -> CleaningJobListResponse:
    """Build CleaningJobListResponse from CleaningJob model."""
    return CleaningJobListResponse(
        id=job.id,
        property_id=job.property_id,
        property_name=job.property.name if job.property else "Unknown",
        cleaner_name=job.cleaner.name if job.cleaner else "Unassigned",
        scheduled_at=job.scheduled_at,
        job_type=job.job_type,
        status=job.status,
        score=job.score,
        has_issues=bool(job.issues)
    )
