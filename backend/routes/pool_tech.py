"""
Right At Home BnB - Pool Tech Worker Portal API Routes
=======================================================
API endpoints for pool technician operations:
- Job listing and details
- Job start/complete workflow
- Chemical readings submission
- Photo uploads
- Weekly schedule

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import logging

from database.connection import get_db
from database.models_workers import (
    Worker, PoolServiceJob, WeatherAlert, WorkerJobExpense,
    WorkerType, TaskPriority, PoolStatus, JobStatus, EquipmentStatus
)

logger = logging.getLogger("RightAtHomeBnB.PoolTech")

router = APIRouter()


# ============================================================================
# REQUEST/RESPONSE MODELS (Pydantic)
# ============================================================================

class ChemicalReadings(BaseModel):
    """Chemical readings from pool service."""
    ph_level: float = Field(..., ge=0, le=14, description="pH level (target: 7.2-7.6)")
    chlorine_level: float = Field(..., ge=0, le=20, description="Chlorine in ppm (target: 1-3)")
    alkalinity_level: float = Field(..., ge=0, le=500, description="Alkalinity in ppm (target: 80-120)")
    calcium_hardness: Optional[float] = Field(None, ge=0, le=1000, description="Calcium in ppm (target: 200-400)")
    cyanuric_acid: Optional[float] = Field(None, ge=0, le=200, description="CYA in ppm (target: 30-50)")
    water_temp: Optional[float] = Field(None, ge=32, le=120, description="Water temperature in Fahrenheit")

    @validator('ph_level')
    def validate_ph(cls, v):
        if v < 6.0 or v > 8.5:
            raise ValueError(f"pH {v} is dangerously out of range. Expected 6.0-8.5")
        return v

    @validator('chlorine_level')
    def validate_chlorine(cls, v):
        if v < 0 or v > 10:
            raise ValueError(f"Chlorine {v} ppm is out of expected range. Expected 0-10")
        return v


class EquipmentChecks(BaseModel):
    """Equipment status checks."""
    skimmer_status: Optional[str] = Field(None, description="Skimmer condition")
    pump_status: Optional[str] = Field(None, description="Pump condition")
    filter_status: Optional[str] = Field(None, description="Filter condition")
    heater_status: Optional[str] = Field(None, description="Heater condition")


class StartJobRequest(BaseModel):
    """Request to start a pool service job."""
    latitude: Optional[float] = Field(None, description="GPS latitude for check-in verification")
    longitude: Optional[float] = Field(None, description="GPS longitude for check-in verification")


class CompleteJobRequest(BaseModel):
    """Request to complete a pool service job with all required data."""
    # Chemical readings (REQUIRED)
    chemical_readings: ChemicalReadings

    # Pool status
    pool_status: PoolStatus

    # Equipment checks
    equipment_checks: Optional[EquipmentChecks] = None

    # Photos
    blue_water_photo_url: str = Field(..., description="REQUIRED: URL of blue water photo")
    before_photo_urls: Optional[List[str]] = None
    after_photo_urls: Optional[List[str]] = None

    # Chemicals added
    chemicals_added: Optional[Dict[str, str]] = Field(
        None,
        description="Chemicals added, e.g., {'chlorine': '2 lbs', 'acid': '1 qt'}"
    )

    # Tasks completed
    tasks_completed: Optional[List[str]] = Field(
        None,
        description="List of tasks completed, e.g., ['brushed walls', 'vacuumed']"
    )

    # Issues and notes
    issues_found: Optional[str] = None
    notes: Optional[str] = None

    # GPS check-out
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class JobResponse(BaseModel):
    """Response model for pool service job."""
    id: int
    property_id: str
    property_name: Optional[str] = None
    property_address: Optional[str] = None
    worker_id: Optional[int] = None
    worker_name: Optional[str] = None

    scheduled_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    status: str
    priority: str
    weather_elevated: bool

    # Chemical readings
    ph_level: Optional[float] = None
    chlorine_level: Optional[float] = None
    alkalinity_level: Optional[float] = None
    calcium_hardness: Optional[float] = None
    cyanuric_acid: Optional[float] = None
    water_temp: Optional[float] = None

    pool_status: Optional[str] = None

    # Photos
    blue_water_photo: Optional[str] = None
    before_photos: Optional[List[str]] = None
    after_photos: Optional[List[str]] = None

    # Service details
    chemicals_added: Optional[Dict[str, str]] = None
    tasks_completed: Optional[List[str]] = None
    issues_found: Optional[str] = None
    notes: Optional[str] = None
    special_instructions: Optional[str] = None

    # Billing
    service_fee: Optional[float] = None
    chemicals_cost: Optional[float] = None
    total_cost: Optional[float] = None

    # Computed
    duration_minutes: Optional[int] = None
    guest_checkin_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScheduleDay(BaseModel):
    """A day's schedule with jobs."""
    date: date
    day_name: str
    job_count: int
    jobs: List[JobResponse]


class WeeklyScheduleResponse(BaseModel):
    """Weekly schedule response."""
    week_start: date
    week_end: date
    total_jobs: int
    days: List[ScheduleDay]


class ReadingsValidationResponse(BaseModel):
    """Response for chemical readings validation."""
    valid: bool
    critical: List[str]
    warnings: List[str]
    pool_status_recommendation: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def job_to_response(job: PoolServiceJob, db: Session) -> JobResponse:
    """Convert SQLAlchemy model to Pydantic response."""
    # Get property info (would come from Property model in real implementation)
    property_name = f"Property {job.property_id}"
    property_address = "Midland, TX"

    # Get worker info
    worker_name = None
    if job.worker:
        worker_name = job.worker.name

    return JobResponse(
        id=job.id,
        property_id=job.property_id,
        property_name=property_name,
        property_address=property_address,
        worker_id=job.worker_id,
        worker_name=worker_name,
        scheduled_at=job.scheduled_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        status=job.status.value if job.status else "scheduled",
        priority=job.priority.value if job.priority else "normal",
        weather_elevated=job.weather_elevated or False,
        ph_level=job.ph_level,
        chlorine_level=job.chlorine_level,
        alkalinity_level=job.alkalinity_level,
        calcium_hardness=job.calcium_hardness,
        cyanuric_acid=job.cyanuric_acid,
        water_temp=job.water_temp,
        pool_status=job.pool_status.value if job.pool_status else None,
        blue_water_photo=job.blue_water_photo,
        before_photos=job.before_photos,
        after_photos=job.after_photos,
        chemicals_added=job.chemicals_added,
        tasks_completed=job.tasks_completed,
        issues_found=job.issues_found,
        notes=job.notes,
        special_instructions=job.special_instructions,
        service_fee=float(job.service_fee) if job.service_fee else None,
        chemicals_cost=float(job.chemicals_cost) if job.chemicals_cost else 0,
        total_cost=float(job.total_cost) if job.total_cost else None,
        duration_minutes=job.duration_minutes,
        guest_checkin_at=job.guest_checkin_at
    )


def get_current_worker(db: Session, worker_id: int = None) -> Worker:
    """
    Get current worker. In production, this would use JWT auth.
    For now, accepts worker_id as parameter or returns first pool tech.
    """
    if worker_id:
        worker = db.query(Worker).filter(Worker.id == worker_id).first()
        if worker:
            return worker

    # Default: get first active pool tech
    worker = db.query(Worker).filter(
        Worker.worker_type == WorkerType.POOL_TECH,
        Worker.is_active == True
    ).first()

    if not worker:
        raise HTTPException(status_code=401, detail="No authorized pool tech worker found")

    return worker


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/jobs", response_model=List[JobResponse])
async def list_assigned_jobs(
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    date_from: Optional[date] = Query(None, description="Start date filter"),
    date_to: Optional[date] = Query(None, description="End date filter"),
    worker_id: Optional[int] = Query(None, description="Worker ID (for auth)"),
    db: Session = Depends(get_db)
):
    """
    List assigned pool service jobs for the current worker.
    Returns jobs filtered by status, priority, and date range.
    """
    try:
        worker = get_current_worker(db, worker_id)
    except HTTPException:
        # If no worker auth, return unassigned jobs for demo
        worker = None

    query = db.query(PoolServiceJob)

    # Filter by worker if authenticated
    if worker:
        query = query.filter(PoolServiceJob.worker_id == worker.id)

    # Status filter
    if status:
        try:
            status_enum = JobStatus(status)
            query = query.filter(PoolServiceJob.status == status_enum)
        except ValueError:
            pass

    # Priority filter
    if priority:
        try:
            priority_enum = TaskPriority(priority)
            query = query.filter(PoolServiceJob.priority == priority_enum)
        except ValueError:
            pass

    # Date filters
    if date_from:
        query = query.filter(PoolServiceJob.scheduled_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(PoolServiceJob.scheduled_at <= datetime.combine(date_to, datetime.max.time()))

    # Order by scheduled time
    jobs = query.order_by(PoolServiceJob.scheduled_at).all()

    return [job_to_response(job, db) for job in jobs]


@router.get("/jobs/today", response_model=List[JobResponse])
async def list_today_jobs(
    worker_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get all jobs scheduled for today."""
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    query = db.query(PoolServiceJob).filter(
        PoolServiceJob.scheduled_at >= today_start,
        PoolServiceJob.scheduled_at <= today_end
    )

    if worker_id:
        query = query.filter(PoolServiceJob.worker_id == worker_id)

    jobs = query.order_by(PoolServiceJob.scheduled_at).all()
    return [job_to_response(job, db) for job in jobs]


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job_details(
    job_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific job."""
    job = db.query(PoolServiceJob).filter(PoolServiceJob.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return job_to_response(job, db)


@router.post("/jobs/{job_id}/start", response_model=JobResponse)
async def start_job(
    job_id: int,
    request: StartJobRequest,
    worker_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Start a pool service job.
    Records GPS check-in location and updates status to IN_PROGRESS.
    """
    job = db.query(PoolServiceJob).filter(PoolServiceJob.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.status not in [JobStatus.SCHEDULED, JobStatus.ASSIGNED, JobStatus.EN_ROUTE]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start job with status '{job.status.value}'"
        )

    # Assign worker if not already assigned
    if not job.worker_id and worker_id:
        job.worker_id = worker_id

    # Update job status
    job.status = JobStatus.IN_PROGRESS
    job.started_at = datetime.utcnow()

    # Record GPS check-in
    if request.latitude and request.longitude:
        job.check_in_lat = request.latitude
        job.check_in_lng = request.longitude

    db.commit()
    db.refresh(job)

    logger.info(f"Job {job_id} started by worker {job.worker_id}")

    return job_to_response(job, db)


@router.post("/jobs/{job_id}/complete", response_model=JobResponse)
async def complete_job(
    job_id: int,
    request: CompleteJobRequest,
    db: Session = Depends(get_db)
):
    """
    Complete a pool service job with chemical readings and photos.

    REQUIRED:
    - All chemical readings (pH, chlorine, alkalinity)
    - Blue water photo
    - Pool status assessment
    """
    job = db.query(PoolServiceJob).filter(PoolServiceJob.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.status != JobStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete job with status '{job.status.value}'. Job must be IN_PROGRESS."
        )

    # Update chemical readings
    readings = request.chemical_readings
    job.ph_level = readings.ph_level
    job.chlorine_level = readings.chlorine_level
    job.alkalinity_level = readings.alkalinity_level
    job.calcium_hardness = readings.calcium_hardness
    job.cyanuric_acid = readings.cyanuric_acid
    job.water_temp = readings.water_temp

    # Pool status
    job.pool_status = request.pool_status

    # Equipment checks
    if request.equipment_checks:
        equipment = request.equipment_checks
        if equipment.skimmer_status:
            job.skimmer_status = EquipmentStatus(equipment.skimmer_status) if equipment.skimmer_status in [e.value for e in EquipmentStatus] else None
        if equipment.pump_status:
            job.pump_status = EquipmentStatus(equipment.pump_status) if equipment.pump_status in [e.value for e in EquipmentStatus] else None
        if equipment.filter_status:
            job.filter_status = EquipmentStatus(equipment.filter_status) if equipment.filter_status in [e.value for e in EquipmentStatus] else None
        if equipment.heater_status:
            job.heater_status = EquipmentStatus(equipment.heater_status) if equipment.heater_status in [e.value for e in EquipmentStatus] else None

    # Photos
    job.blue_water_photo = request.blue_water_photo_url
    job.before_photos = request.before_photo_urls
    job.after_photos = request.after_photo_urls

    # Service details
    job.chemicals_added = request.chemicals_added
    job.tasks_completed = request.tasks_completed
    job.issues_found = request.issues_found
    job.notes = request.notes

    # GPS check-out
    if request.latitude and request.longitude:
        job.check_out_lat = request.latitude
        job.check_out_lng = request.longitude

    # Complete the job
    job.status = JobStatus.COMPLETED
    job.completed_at = datetime.utcnow()

    # Calculate total cost
    if job.service_fee:
        job.total_cost = job.service_fee + (job.chemicals_cost or Decimal('0'))

    # Validate readings and warn if needed
    validation = job.validate_readings()
    if not validation["valid"]:
        logger.warning(f"Job {job_id} completed with critical reading issues: {validation['critical']}")

    db.commit()
    db.refresh(job)

    # Auto-log expense
    if job.total_cost and job.worker_id:
        expense = WorkerJobExpense(
            property_id=job.property_id,
            worker_id=job.worker_id,
            job_type=WorkerType.POOL_TECH,
            job_id=job.id,
            amount=job.total_cost,
            description=f"Pool service - Job #{job.id}",
            expense_date=date.today(),
            is_auto_logged=True
        )
        db.add(expense)
        db.commit()

    logger.info(f"Job {job_id} completed. Pool status: {job.pool_status.value}")

    return job_to_response(job, db)


@router.get("/jobs/{job_id}/validate-readings", response_model=ReadingsValidationResponse)
async def validate_job_readings(
    job_id: int,
    db: Session = Depends(get_db)
):
    """Validate chemical readings for a job and get recommendations."""
    job = db.query(PoolServiceJob).filter(PoolServiceJob.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    validation = job.validate_readings()

    return ReadingsValidationResponse(
        valid=validation["valid"],
        critical=validation["critical"],
        warnings=validation["warnings"],
        pool_status_recommendation=validation["pool_status_recommendation"].value
    )


@router.post("/readings/validate", response_model=ReadingsValidationResponse)
async def validate_readings_preview(
    readings: ChemicalReadings
):
    """
    Preview validation of chemical readings before submitting.
    Useful for real-time validation in the mobile app.
    """
    warnings = []
    critical = []

    # pH validation
    if readings.ph_level < 7.0 or readings.ph_level > 7.8:
        critical.append(f"pH {readings.ph_level} is outside safe range (7.0-7.8)")
    elif readings.ph_level < 7.2 or readings.ph_level > 7.6:
        warnings.append(f"pH {readings.ph_level} is outside ideal range (7.2-7.6)")

    # Chlorine validation
    if readings.chlorine_level < 0.5 or readings.chlorine_level > 5:
        critical.append(f"Chlorine {readings.chlorine_level} ppm is outside safe range (0.5-5)")
    elif readings.chlorine_level < 1 or readings.chlorine_level > 3:
        warnings.append(f"Chlorine {readings.chlorine_level} ppm is outside ideal range (1-3)")

    # Alkalinity validation
    if readings.alkalinity_level < 60 or readings.alkalinity_level > 180:
        critical.append(f"Alkalinity {readings.alkalinity_level} ppm is outside safe range (60-180)")
    elif readings.alkalinity_level < 80 or readings.alkalinity_level > 120:
        warnings.append(f"Alkalinity {readings.alkalinity_level} ppm is outside ideal range (80-120)")

    # Calcium Hardness validation (optional)
    if readings.calcium_hardness is not None:
        if readings.calcium_hardness < 150 or readings.calcium_hardness > 500:
            warnings.append(f"Calcium hardness {readings.calcium_hardness} ppm is outside range (150-500)")

    # Cyanuric Acid validation (optional)
    if readings.cyanuric_acid is not None:
        if readings.cyanuric_acid < 20 or readings.cyanuric_acid > 100:
            warnings.append(f"Cyanuric acid {readings.cyanuric_acid} ppm is outside range (20-100)")

    recommendation = (
        PoolStatus.UNSAFE if critical else
        PoolStatus.NEEDS_ATTENTION if warnings else
        PoolStatus.GOOD
    )

    return ReadingsValidationResponse(
        valid=len(critical) == 0,
        critical=critical,
        warnings=warnings,
        pool_status_recommendation=recommendation.value
    )


@router.get("/schedule", response_model=WeeklyScheduleResponse)
async def get_weekly_schedule(
    week_offset: int = Query(0, description="Week offset from current (0=this week, 1=next week, -1=last week)"),
    worker_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get weekly schedule for the pool tech.
    Shows all jobs organized by day for the week.
    """
    # Calculate week boundaries
    today = date.today()
    week_start = today - timedelta(days=today.weekday()) + timedelta(weeks=week_offset)
    week_end = week_start + timedelta(days=6)

    # Query jobs for the week
    query = db.query(PoolServiceJob).filter(
        PoolServiceJob.scheduled_at >= datetime.combine(week_start, datetime.min.time()),
        PoolServiceJob.scheduled_at <= datetime.combine(week_end, datetime.max.time())
    )

    if worker_id:
        query = query.filter(PoolServiceJob.worker_id == worker_id)

    jobs = query.order_by(PoolServiceJob.scheduled_at).all()

    # Organize by day
    days = []
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    for i in range(7):
        current_date = week_start + timedelta(days=i)
        day_jobs = [j for j in jobs if j.scheduled_at.date() == current_date]

        days.append(ScheduleDay(
            date=current_date,
            day_name=day_names[i],
            job_count=len(day_jobs),
            jobs=[job_to_response(j, db) for j in day_jobs]
        ))

    return WeeklyScheduleResponse(
        week_start=week_start,
        week_end=week_end,
        total_jobs=len(jobs),
        days=days
    )


@router.get("/stats")
async def get_worker_stats(
    worker_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get statistics for the pool tech worker."""
    try:
        worker = get_current_worker(db, worker_id)
    except HTTPException:
        worker = None

    # Today's stats
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    query = db.query(PoolServiceJob)
    if worker:
        query = query.filter(PoolServiceJob.worker_id == worker.id)

    today_jobs = query.filter(
        PoolServiceJob.scheduled_at >= today_start,
        PoolServiceJob.scheduled_at <= today_end
    ).all()

    completed_today = len([j for j in today_jobs if j.status == JobStatus.COMPLETED])
    pending_today = len([j for j in today_jobs if j.status in [JobStatus.SCHEDULED, JobStatus.ASSIGNED]])
    in_progress = len([j for j in today_jobs if j.status == JobStatus.IN_PROGRESS])

    # Week stats
    week_start = date.today() - timedelta(days=date.today().weekday())
    week_query = db.query(PoolServiceJob).filter(
        PoolServiceJob.scheduled_at >= datetime.combine(week_start, datetime.min.time()),
        PoolServiceJob.status == JobStatus.COMPLETED
    )
    if worker:
        week_query = week_query.filter(PoolServiceJob.worker_id == worker.id)

    week_completed = week_query.count()

    return {
        "worker_id": worker.id if worker else None,
        "worker_name": worker.name if worker else "All Workers",
        "today": {
            "total": len(today_jobs),
            "completed": completed_today,
            "pending": pending_today,
            "in_progress": in_progress
        },
        "week": {
            "completed": week_completed
        },
        "performance": {
            "total_jobs": worker.total_jobs if worker else None,
            "avg_rating": worker.avg_rating if worker else None,
            "avg_job_duration_minutes": worker.avg_job_duration_minutes if worker else None
        }
    }


@router.post("/photo/upload")
async def upload_photo(
    file: UploadFile = File(...),
    photo_type: str = Query(..., description="Type: blue_water, before, after"),
    job_id: Optional[int] = Query(None)
):
    """
    Upload a photo for a pool service job.
    Returns the URL of the uploaded photo.

    In production, this would upload to cloud storage (S3, GCS, etc.)
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {allowed_types}"
        )

    # Validate photo type
    valid_types = ["blue_water", "before", "after"]
    if photo_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid photo type. Allowed: {valid_types}"
        )

    # In production, upload to cloud storage
    # For now, return a placeholder URL
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"pool_{photo_type}_{job_id or 'new'}_{timestamp}.{file.filename.split('.')[-1]}"
    placeholder_url = f"https://storage.rightathomebnb.com/pool-photos/{filename}"

    logger.info(f"Photo uploaded: {filename} (type: {photo_type}, job: {job_id})")

    return {
        "success": True,
        "url": placeholder_url,
        "filename": filename,
        "photo_type": photo_type,
        "job_id": job_id
    }
