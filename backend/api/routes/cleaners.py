"""
Cleaner Tracking API Routes
GPS check-in, photo checklists, performance scoring
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class CleanerBase(BaseModel):
    name: str
    phone: str
    email: str

class Cleaner(CleanerBase):
    id: int
    active: bool = True
    avg_score: float
    completed_jobs: int
    missed_jobs: int
    on_time_rate: float

class CleaningJob(BaseModel):
    id: int
    property_id: int
    cleaner_id: int
    scheduled_time: datetime
    status: str  # scheduled, in_progress, completed, missed
    gps_checkin: Optional[dict]
    gps_checkout: Optional[dict]
    photos: List[str]
    quality_score: Optional[float]

# Mock cleaner data
CLEANERS = [
    {"id": 1, "name": "Maria Garcia", "phone": "555-1001", "email": "maria@clean.com", "active": True, "avg_score": 9.2, "completed_jobs": 156, "missed_jobs": 2, "on_time_rate": 0.98},
    {"id": 2, "name": "James Wilson", "phone": "555-1002", "email": "james@clean.com", "active": True, "avg_score": 8.7, "completed_jobs": 98, "missed_jobs": 5, "on_time_rate": 0.94},
    {"id": 3, "name": "Rosa Martinez", "phone": "555-1003", "email": "rosa@clean.com", "active": True, "avg_score": 9.5, "completed_jobs": 203, "missed_jobs": 1, "on_time_rate": 0.99},
]

ACTIVE_JOBS = [
    {"id": 1, "property_id": 1, "property_name": "Castleford Estate", "cleaner_id": 1, "cleaner_name": "Maria Garcia", "scheduled_time": "2025-01-13T14:00:00", "status": "in_progress", "gps_checkin": {"lat": 31.9973, "lng": -102.0779, "time": "2025-01-13T14:05:00"}, "photos": ["kitchen.jpg", "bedroom1.jpg"], "quality_score": None},
    {"id": 2, "property_id": 3, "property_name": "Basin View Cottage", "cleaner_id": 3, "cleaner_name": "Rosa Martinez", "scheduled_time": "2025-01-13T15:00:00", "status": "scheduled", "gps_checkin": None, "photos": [], "quality_score": None},
]

@router.get("/")
async def list_cleaners():
    """Get all cleaners"""
    return CLEANERS

@router.get("/leaderboard")
async def get_leaderboard():
    """Get cleaner performance leaderboard"""
    sorted_cleaners = sorted(CLEANERS, key=lambda x: x["avg_score"], reverse=True)
    return [
        {
            "rank": i + 1,
            "name": c["name"],
            "score": c["avg_score"],
            "jobs": c["completed_jobs"],
            "on_time": f"{c['on_time_rate']*100:.0f}%"
        }
        for i, c in enumerate(sorted_cleaners)
    ]

@router.get("/jobs/active")
async def get_active_jobs():
    """Get currently active cleaning jobs"""
    return ACTIVE_JOBS

@router.post("/jobs/{job_id}/checkin")
async def cleaner_checkin(job_id: int, lat: float, lng: float):
    """GPS check-in for cleaner"""
    for job in ACTIVE_JOBS:
        if job["id"] == job_id:
            job["gps_checkin"] = {
                "lat": lat,
                "lng": lng,
                "time": datetime.now().isoformat()
            }
            job["status"] = "in_progress"
            return {"status": "checked_in", "job": job}
    raise HTTPException(status_code=404, detail="Job not found")

@router.post("/jobs/{job_id}/photo")
async def upload_job_photo(job_id: int, photo: UploadFile = File(...)):
    """Upload cleaning photo"""
    for job in ACTIVE_JOBS:
        if job["id"] == job_id:
            filename = f"job_{job_id}_{datetime.now().strftime('%H%M%S')}_{photo.filename}"
            job["photos"].append(filename)
            return {"status": "uploaded", "filename": filename, "total_photos": len(job["photos"])}
    raise HTTPException(status_code=404, detail="Job not found")

@router.post("/jobs/{job_id}/complete")
async def complete_job(job_id: int, notes: Optional[str] = None):
    """Mark job as complete"""
    for job in ACTIVE_JOBS:
        if job["id"] == job_id:
            if len(job["photos"]) < 5:
                raise HTTPException(status_code=400, detail="Minimum 5 photos required")
            job["status"] = "completed"
            job["gps_checkout"] = {
                "lat": job["gps_checkin"]["lat"],
                "lng": job["gps_checkin"]["lng"],
                "time": datetime.now().isoformat()
            }
            # AI would score quality here
            job["quality_score"] = 9.0
            return {"status": "completed", "job": job}
    raise HTTPException(status_code=404, detail="Job not found")
