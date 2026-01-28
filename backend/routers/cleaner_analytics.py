"""
Right At Home BnB - Cleaner Performance Analytics API
======================================================
Comprehensive cleaner performance dashboard endpoints:
- Performance metrics (jobs, time, scores)
- Individual cleaner stats
- Leaderboard/rankings
- Bonus calculations based on performance

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case, desc
from loguru import logger
from pydantic import BaseModel, Field
from enum import Enum

from database.connection import get_db
from database.models import (
    User, CleaningJob, Property, Booking, Guest,
    UserRole, CleaningType, CleaningStatus, Message, Sentiment
)

router = APIRouter()


# ============================================
# PYDANTIC SCHEMAS
# ============================================

class PerformanceGrade(str, Enum):
    """Performance grade based on overall score."""
    A_PLUS = "A+"
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    F = "F"


class CleanerMetrics(BaseModel):
    """Individual cleaner performance metrics."""
    cleaner_id: str
    name: str
    email: str
    phone: Optional[str]
    is_active: bool

    # Job counts
    jobs_completed: int = 0
    jobs_scheduled: int = 0
    jobs_cancelled: int = 0
    jobs_with_issues: int = 0

    # Time metrics
    avg_time_per_clean_mins: Optional[float] = None
    total_hours_worked: float = 0
    fastest_clean_mins: Optional[int] = None
    slowest_clean_mins: Optional[int] = None

    # Quality metrics
    on_time_percentage: float = 0
    avg_score: float = 0
    total_score_points: int = 0

    # Review metrics
    positive_reviews: int = 0
    negative_reviews: int = 0
    callbacks_required: int = 0

    # Calculated
    overall_grade: PerformanceGrade = PerformanceGrade.C
    performance_score: float = 0  # 0-100
    bonus_eligible: bool = False
    bonus_amount: Optional[Decimal] = None

    # Trends
    trend_direction: str = "stable"  # up, down, stable
    month_over_month_change: float = 0


class LeaderboardEntry(BaseModel):
    """Leaderboard ranking entry."""
    rank: int
    cleaner_id: str
    name: str
    avatar_initials: str

    # Core metrics
    jobs_completed: int
    avg_score: float
    on_time_percentage: float

    # Points & Grade
    performance_score: float
    grade: PerformanceGrade

    # Bonus
    bonus_eligible: bool
    bonus_amount: Optional[Decimal]

    # Trend indicator
    rank_change: int = 0  # positive = moved up, negative = moved down


class PerformanceSummary(BaseModel):
    """Overall performance summary for all cleaners."""
    total_cleaners: int
    active_cleaners: int
    total_jobs_completed: int
    avg_team_score: float
    avg_on_time_rate: float
    total_hours_cleaned: float

    # Grade distribution
    grade_distribution: Dict[str, int]

    # Issues
    total_issues_reported: int
    total_callbacks: int

    # Bonuses
    total_bonus_pool: Decimal
    cleaners_with_bonus: int


class CleanerDetailStats(BaseModel):
    """Detailed stats for individual cleaner."""
    basic: CleanerMetrics

    # Job breakdown by type
    jobs_by_type: Dict[str, int]

    # Properties worked
    properties_worked: List[Dict[str, Any]]
    top_properties: List[Dict[str, Any]]

    # Time analysis
    time_by_day_of_week: Dict[str, float]
    busiest_day: str

    # Score history
    score_history: List[Dict[str, Any]]  # [{date, score}]
    score_trend: List[float]  # Last 12 data points

    # Recent jobs
    recent_jobs: List[Dict[str, Any]]

    # Issues breakdown
    issues_breakdown: Dict[str, int]


class BonusCalculation(BaseModel):
    """Bonus calculation details."""
    cleaner_id: str
    name: str
    period_start: date
    period_end: date

    # Metrics used
    jobs_completed: int
    avg_score: float
    on_time_percentage: float
    issues_reported: int
    callbacks: int

    # Calculation breakdown
    base_bonus: Decimal
    score_multiplier: float
    on_time_bonus: Decimal
    issue_penalty: Decimal
    callback_penalty: Decimal

    # Final
    total_bonus: Decimal
    is_eligible: bool
    eligibility_reason: str


# ============================================
# HELPER FUNCTIONS
# ============================================

def calculate_grade(score: float) -> PerformanceGrade:
    """Calculate letter grade from performance score (0-100)."""
    if score >= 95:
        return PerformanceGrade.A_PLUS
    elif score >= 90:
        return PerformanceGrade.A
    elif score >= 80:
        return PerformanceGrade.B
    elif score >= 70:
        return PerformanceGrade.C
    elif score >= 60:
        return PerformanceGrade.D
    else:
        return PerformanceGrade.F


def calculate_performance_score(
    jobs_completed: int,
    avg_score: float,
    on_time_percentage: float,
    issues_reported: int,
    callbacks: int
) -> float:
    """
    Calculate overall performance score (0-100).

    Weights:
    - Quality (avg_score): 40%
    - On-time rate: 25%
    - Volume (jobs): 15%
    - Issues penalty: 10%
    - Callbacks penalty: 10%
    """
    # Normalize avg_score from 1-10 to 0-100
    quality_score = (avg_score / 10) * 100 if avg_score > 0 else 50

    # On-time is already 0-100
    time_score = on_time_percentage

    # Volume score (max 50 jobs = 100%)
    volume_score = min(100, (jobs_completed / 50) * 100)

    # Issue penalty (each issue reduces score)
    issue_penalty = min(50, issues_reported * 5)

    # Callback penalty (each callback is worse)
    callback_penalty = min(50, callbacks * 10)

    # Calculate weighted score
    score = (
        (quality_score * 0.40) +
        (time_score * 0.25) +
        (volume_score * 0.15) -
        (issue_penalty * 0.10) -
        (callback_penalty * 0.10)
    )

    return max(0, min(100, score))


def calculate_bonus(
    performance_score: float,
    jobs_completed: int,
    on_time_percentage: float,
    issues_reported: int,
    callbacks: int,
    base_rate: Decimal = Decimal("50")
) -> tuple[bool, Decimal, str]:
    """
    Calculate bonus based on performance.

    Returns: (eligible, amount, reason)
    """
    # Must meet minimum requirements
    if jobs_completed < 10:
        return False, Decimal("0"), "Minimum 10 jobs required for bonus eligibility"

    if performance_score < 70:
        return False, Decimal("0"), f"Performance score {performance_score:.1f} below 70 threshold"

    if on_time_percentage < 85:
        return False, Decimal("0"), f"On-time rate {on_time_percentage:.1f}% below 85% threshold"

    if callbacks > 2:
        return False, Decimal("0"), f"Too many callbacks ({callbacks}) - max 2 allowed"

    # Calculate base bonus (5% of estimated earnings)
    estimated_earnings = base_rate * jobs_completed
    base_bonus = estimated_earnings * Decimal("0.05")

    # Score multiplier (1.0x to 1.5x based on score)
    if performance_score >= 95:
        multiplier = Decimal("1.5")
    elif performance_score >= 90:
        multiplier = Decimal("1.3")
    elif performance_score >= 85:
        multiplier = Decimal("1.15")
    elif performance_score >= 80:
        multiplier = Decimal("1.05")
    else:
        multiplier = Decimal("1.0")

    # On-time bonus
    on_time_bonus = Decimal("0")
    if on_time_percentage >= 98:
        on_time_bonus = Decimal("50")
    elif on_time_percentage >= 95:
        on_time_bonus = Decimal("25")

    # Penalties
    issue_penalty = Decimal(str(issues_reported * 5))
    callback_penalty = Decimal(str(callbacks * 25))

    # Final calculation
    total = (base_bonus * multiplier) + on_time_bonus - issue_penalty - callback_penalty
    total = max(Decimal("0"), total)

    return True, total.quantize(Decimal("0.01")), "Bonus earned based on excellent performance"


def get_cleaner_metrics(
    cleaner: User,
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> CleanerMetrics:
    """Get comprehensive metrics for a single cleaner."""

    # Build base query
    job_query = db.query(CleaningJob).filter(CleaningJob.cleaner_id == cleaner.id)

    if start_date:
        job_query = job_query.filter(CleaningJob.scheduled_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        job_query = job_query.filter(CleaningJob.scheduled_at <= datetime.combine(end_date, datetime.max.time()))

    all_jobs = job_query.all()

    # Basic counts
    completed_jobs = [j for j in all_jobs if j.status == CleaningStatus.COMPLETED]
    scheduled_jobs = [j for j in all_jobs if j.status == CleaningStatus.SCHEDULED]
    cancelled_jobs = [j for j in all_jobs if j.status == CleaningStatus.CANCELLED]
    issue_jobs = [j for j in all_jobs if j.issues]

    # Time metrics
    durations = [j.duration_mins for j in completed_jobs if j.duration_mins]
    avg_time = sum(durations) / len(durations) if durations else None
    total_hours = sum(durations) / 60 if durations else 0
    fastest = min(durations) if durations else None
    slowest = max(durations) if durations else None

    # On-time calculation
    on_time_count = 0
    for job in completed_jobs:
        if job.started_at and job.scheduled_at:
            grace_period = timedelta(minutes=15)
            if job.started_at <= job.scheduled_at + grace_period:
                on_time_count += 1

    on_time_pct = (on_time_count / len(completed_jobs) * 100) if completed_jobs else 100

    # Score metrics
    scored_jobs = [j for j in completed_jobs if j.score is not None]
    avg_score = sum(j.score for j in scored_jobs) / len(scored_jobs) if scored_jobs else 0
    total_points = sum(j.score for j in scored_jobs) if scored_jobs else 0

    # Review metrics (from guest messages/feedback)
    # Count callbacks (jobs that were redone or had issues requiring return)
    callbacks = len([j for j in all_jobs if j.issues and "callback" in (j.issues or "").lower()])

    # Calculate performance score
    perf_score = calculate_performance_score(
        len(completed_jobs),
        avg_score,
        on_time_pct,
        len(issue_jobs),
        callbacks
    )

    # Calculate bonus
    eligible, bonus_amount, _ = calculate_bonus(
        perf_score,
        len(completed_jobs),
        on_time_pct,
        len(issue_jobs),
        callbacks
    )

    return CleanerMetrics(
        cleaner_id=cleaner.id,
        name=cleaner.name,
        email=cleaner.email,
        phone=cleaner.phone,
        is_active=cleaner.is_active,
        jobs_completed=len(completed_jobs),
        jobs_scheduled=len(scheduled_jobs),
        jobs_cancelled=len(cancelled_jobs),
        jobs_with_issues=len(issue_jobs),
        avg_time_per_clean_mins=round(avg_time, 1) if avg_time else None,
        total_hours_worked=round(total_hours, 1),
        fastest_clean_mins=fastest,
        slowest_clean_mins=slowest,
        on_time_percentage=round(on_time_pct, 1),
        avg_score=round(avg_score, 2),
        total_score_points=total_points,
        callbacks_required=callbacks,
        overall_grade=calculate_grade(perf_score),
        performance_score=round(perf_score, 1),
        bonus_eligible=eligible,
        bonus_amount=bonus_amount if eligible else None
    )


# ============================================
# API ENDPOINTS
# ============================================

@router.get("/performance", response_model=PerformanceSummary)
async def get_performance_summary(
    start_date: Optional[date] = Query(None, description="Start date for metrics"),
    end_date: Optional[date] = Query(None, description="End date for metrics"),
    db: Session = Depends(get_db)
):
    """
    Get overall performance summary for all cleaners.

    Returns aggregate metrics across the cleaning team.
    """
    # Default to last 30 days
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    # Get all cleaners
    cleaners = db.query(User).filter(User.role == UserRole.CLEANER).all()
    active_cleaners = [c for c in cleaners if c.is_active]

    # Calculate metrics for each cleaner
    all_metrics = [get_cleaner_metrics(c, db, start_date, end_date) for c in cleaners]
    active_metrics = [m for m in all_metrics if m.is_active]

    # Aggregate totals
    total_completed = sum(m.jobs_completed for m in all_metrics)
    total_hours = sum(m.total_hours_worked for m in all_metrics)
    total_issues = sum(m.jobs_with_issues for m in all_metrics)
    total_callbacks = sum(m.callbacks_required for m in all_metrics)

    # Averages (only from active cleaners with data)
    active_with_jobs = [m for m in active_metrics if m.jobs_completed > 0]
    avg_score = sum(m.avg_score for m in active_with_jobs) / len(active_with_jobs) if active_with_jobs else 0
    avg_on_time = sum(m.on_time_percentage for m in active_with_jobs) / len(active_with_jobs) if active_with_jobs else 0

    # Grade distribution
    grade_dist = {g.value: 0 for g in PerformanceGrade}
    for m in all_metrics:
        grade_dist[m.overall_grade.value] += 1

    # Bonus calculations
    bonus_cleaners = [m for m in all_metrics if m.bonus_eligible]
    total_bonus = sum(m.bonus_amount for m in bonus_cleaners if m.bonus_amount) or Decimal("0")

    return PerformanceSummary(
        total_cleaners=len(cleaners),
        active_cleaners=len(active_cleaners),
        total_jobs_completed=total_completed,
        avg_team_score=round(avg_score, 2),
        avg_on_time_rate=round(avg_on_time, 1),
        total_hours_cleaned=round(total_hours, 1),
        grade_distribution=grade_dist,
        total_issues_reported=total_issues,
        total_callbacks=total_callbacks,
        total_bonus_pool=total_bonus,
        cleaners_with_bonus=len(bonus_cleaners)
    )


@router.get("/{cleaner_id}/stats", response_model=CleanerDetailStats)
async def get_cleaner_stats(
    cleaner_id: str,
    period_days: int = Query(30, ge=7, le=365, description="Period in days"),
    db: Session = Depends(get_db)
):
    """
    Get detailed performance stats for a specific cleaner.

    Includes breakdown by property, time analysis, and trend data.
    """
    cleaner = db.query(User).filter(
        User.id == cleaner_id,
        User.role == UserRole.CLEANER
    ).first()

    if not cleaner:
        raise HTTPException(status_code=404, detail="Cleaner not found")

    end_date = date.today()
    start_date = end_date - timedelta(days=period_days)

    # Get basic metrics
    basic_metrics = get_cleaner_metrics(cleaner, db, start_date, end_date)

    # Get all jobs in period
    jobs = db.query(CleaningJob).filter(
        CleaningJob.cleaner_id == cleaner_id,
        CleaningJob.scheduled_at >= datetime.combine(start_date, datetime.min.time()),
        CleaningJob.scheduled_at <= datetime.combine(end_date, datetime.max.time())
    ).all()

    # Jobs by type
    jobs_by_type = {}
    for job in jobs:
        job_type = job.job_type.value if job.job_type else "UNKNOWN"
        jobs_by_type[job_type] = jobs_by_type.get(job_type, 0) + 1

    # Properties worked
    property_counts = {}
    for job in jobs:
        if job.property_id:
            if job.property_id not in property_counts:
                property_counts[job.property_id] = {
                    "id": job.property_id,
                    "name": job.property.name if job.property else "Unknown",
                    "count": 0,
                    "avg_score": []
                }
            property_counts[job.property_id]["count"] += 1
            if job.score:
                property_counts[job.property_id]["avg_score"].append(job.score)

    properties_worked = []
    for prop_id, data in property_counts.items():
        avg_score = sum(data["avg_score"]) / len(data["avg_score"]) if data["avg_score"] else 0
        properties_worked.append({
            "id": data["id"],
            "name": data["name"],
            "jobs_count": data["count"],
            "avg_score": round(avg_score, 1)
        })

    # Sort by jobs count for top properties
    top_properties = sorted(properties_worked, key=lambda x: x["jobs_count"], reverse=True)[:5]

    # Time by day of week
    day_hours = {day: 0 for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}
    for job in jobs:
        if job.duration_mins and job.scheduled_at:
            day_name = job.scheduled_at.strftime("%A")
            day_hours[day_name] += job.duration_mins / 60

    busiest_day = max(day_hours, key=day_hours.get) if any(day_hours.values()) else "N/A"

    # Score history (last 12 weeks)
    score_history = []
    score_trend = []
    for i in range(12):
        week_end = end_date - timedelta(weeks=i)
        week_start = week_end - timedelta(days=7)

        week_jobs = [j for j in jobs if j.completed_at and
                     week_start <= j.completed_at.date() <= week_end]
        week_scores = [j.score for j in week_jobs if j.score]

        if week_scores:
            avg = sum(week_scores) / len(week_scores)
            score_history.append({
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "avg_score": round(avg, 1),
                "jobs_count": len(week_jobs)
            })
            score_trend.insert(0, round(avg, 1))

    score_history.reverse()

    # Recent jobs (last 10)
    recent_jobs = []
    completed_jobs = sorted(
        [j for j in jobs if j.status == CleaningStatus.COMPLETED],
        key=lambda x: x.completed_at or datetime.min,
        reverse=True
    )[:10]

    for job in completed_jobs:
        recent_jobs.append({
            "id": job.id,
            "property_name": job.property.name if job.property else "Unknown",
            "date": job.completed_at.isoformat() if job.completed_at else None,
            "duration_mins": job.duration_mins,
            "score": job.score,
            "has_issues": bool(job.issues),
            "job_type": job.job_type.value if job.job_type else None
        })

    # Issues breakdown
    issues_breakdown = {
        "cleanliness": 0,
        "timing": 0,
        "missing_items": 0,
        "callback_required": 0,
        "other": 0
    }
    for job in jobs:
        if job.issues:
            issues_lower = job.issues.lower()
            if "clean" in issues_lower or "dirt" in issues_lower:
                issues_breakdown["cleanliness"] += 1
            elif "late" in issues_lower or "time" in issues_lower:
                issues_breakdown["timing"] += 1
            elif "missing" in issues_lower or "forgot" in issues_lower:
                issues_breakdown["missing_items"] += 1
            elif "callback" in issues_lower or "return" in issues_lower:
                issues_breakdown["callback_required"] += 1
            else:
                issues_breakdown["other"] += 1

    return CleanerDetailStats(
        basic=basic_metrics,
        jobs_by_type=jobs_by_type,
        properties_worked=properties_worked,
        top_properties=top_properties,
        time_by_day_of_week={k: round(v, 1) for k, v in day_hours.items()},
        busiest_day=busiest_day,
        score_history=score_history,
        score_trend=score_trend,
        recent_jobs=recent_jobs,
        issues_breakdown=issues_breakdown
    )


@router.get("/rankings", response_model=List[LeaderboardEntry])
async def get_cleaner_rankings(
    period: str = Query("month", regex="^(week|month|quarter|year|all)$"),
    limit: int = Query(20, ge=1, le=100),
    active_only: bool = Query(True, description="Only show active cleaners"),
    db: Session = Depends(get_db)
):
    """
    Get cleaner leaderboard/rankings.

    Ranks cleaners by performance score with optional period filtering.
    """
    # Calculate date range
    end_date = date.today()
    if period == "week":
        start_date = end_date - timedelta(days=7)
    elif period == "month":
        start_date = end_date - timedelta(days=30)
    elif period == "quarter":
        start_date = end_date - timedelta(days=90)
    elif period == "year":
        start_date = end_date - timedelta(days=365)
    else:
        start_date = None

    # Get cleaners
    cleaner_query = db.query(User).filter(User.role == UserRole.CLEANER)
    if active_only:
        cleaner_query = cleaner_query.filter(User.is_active == True)

    cleaners = cleaner_query.all()

    # Calculate metrics and build leaderboard
    leaderboard_data = []
    for cleaner in cleaners:
        metrics = get_cleaner_metrics(cleaner, db, start_date, end_date)

        # Skip cleaners with no completed jobs
        if metrics.jobs_completed == 0:
            continue

        leaderboard_data.append({
            "cleaner": cleaner,
            "metrics": metrics
        })

    # Sort by performance score (descending)
    leaderboard_data.sort(key=lambda x: x["metrics"].performance_score, reverse=True)

    # Build response with ranks
    leaderboard = []
    for rank, data in enumerate(leaderboard_data[:limit], 1):
        cleaner = data["cleaner"]
        metrics = data["metrics"]

        # Generate initials
        name_parts = cleaner.name.split()
        initials = "".join(p[0].upper() for p in name_parts[:2])

        leaderboard.append(LeaderboardEntry(
            rank=rank,
            cleaner_id=cleaner.id,
            name=cleaner.name,
            avatar_initials=initials,
            jobs_completed=metrics.jobs_completed,
            avg_score=metrics.avg_score,
            on_time_percentage=metrics.on_time_percentage,
            performance_score=metrics.performance_score,
            grade=metrics.overall_grade,
            bonus_eligible=metrics.bonus_eligible,
            bonus_amount=metrics.bonus_amount,
            rank_change=0  # TODO: Calculate from previous period
        ))

    return leaderboard


@router.get("/{cleaner_id}/bonus", response_model=BonusCalculation)
async def calculate_cleaner_bonus(
    cleaner_id: str,
    period_days: int = Query(30, ge=7, le=90, description="Period for bonus calculation"),
    db: Session = Depends(get_db)
):
    """
    Calculate bonus for a specific cleaner.

    Returns detailed breakdown of bonus calculation.
    """
    cleaner = db.query(User).filter(
        User.id == cleaner_id,
        User.role == UserRole.CLEANER
    ).first()

    if not cleaner:
        raise HTTPException(status_code=404, detail="Cleaner not found")

    end_date = date.today()
    start_date = end_date - timedelta(days=period_days)

    metrics = get_cleaner_metrics(cleaner, db, start_date, end_date)

    # Calculate bonus details
    base_rate = Decimal("50")  # TODO: Get from cleaner profile
    estimated_earnings = base_rate * metrics.jobs_completed
    base_bonus = estimated_earnings * Decimal("0.05")

    # Score multiplier
    if metrics.performance_score >= 95:
        multiplier = 1.5
    elif metrics.performance_score >= 90:
        multiplier = 1.3
    elif metrics.performance_score >= 85:
        multiplier = 1.15
    elif metrics.performance_score >= 80:
        multiplier = 1.05
    else:
        multiplier = 1.0

    # On-time bonus
    on_time_bonus = Decimal("0")
    if metrics.on_time_percentage >= 98:
        on_time_bonus = Decimal("50")
    elif metrics.on_time_percentage >= 95:
        on_time_bonus = Decimal("25")

    # Penalties
    issue_penalty = Decimal(str(metrics.jobs_with_issues * 5))
    callback_penalty = Decimal(str(metrics.callbacks_required * 25))

    # Calculate eligibility
    eligible, total, reason = calculate_bonus(
        metrics.performance_score,
        metrics.jobs_completed,
        metrics.on_time_percentage,
        metrics.jobs_with_issues,
        metrics.callbacks_required
    )

    return BonusCalculation(
        cleaner_id=cleaner_id,
        name=cleaner.name,
        period_start=start_date,
        period_end=end_date,
        jobs_completed=metrics.jobs_completed,
        avg_score=metrics.avg_score,
        on_time_percentage=metrics.on_time_percentage,
        issues_reported=metrics.jobs_with_issues,
        callbacks=metrics.callbacks_required,
        base_bonus=base_bonus,
        score_multiplier=multiplier,
        on_time_bonus=on_time_bonus,
        issue_penalty=issue_penalty,
        callback_penalty=callback_penalty,
        total_bonus=total,
        is_eligible=eligible,
        eligibility_reason=reason
    )


@router.get("/underperformers", response_model=List[CleanerMetrics])
async def get_underperforming_cleaners(
    threshold: float = Query(70, ge=0, le=100, description="Performance score threshold"),
    period_days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db)
):
    """
    Get cleaners with performance below threshold.

    Useful for identifying cleaners needing attention or training.
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=period_days)

    cleaners = db.query(User).filter(
        User.role == UserRole.CLEANER,
        User.is_active == True
    ).all()

    underperformers = []
    for cleaner in cleaners:
        metrics = get_cleaner_metrics(cleaner, db, start_date, end_date)

        # Must have some jobs to evaluate
        if metrics.jobs_completed >= 3 and metrics.performance_score < threshold:
            underperformers.append(metrics)

    # Sort by performance score ascending (worst first)
    underperformers.sort(key=lambda x: x.performance_score)

    return underperformers


@router.get("/top-performers", response_model=List[CleanerMetrics])
async def get_top_performing_cleaners(
    limit: int = Query(5, ge=1, le=20),
    period_days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db)
):
    """
    Get top performing cleaners.

    Returns cleaners with highest performance scores.
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=period_days)

    cleaners = db.query(User).filter(
        User.role == UserRole.CLEANER,
        User.is_active == True
    ).all()

    all_metrics = []
    for cleaner in cleaners:
        metrics = get_cleaner_metrics(cleaner, db, start_date, end_date)

        # Must have minimum jobs
        if metrics.jobs_completed >= 5:
            all_metrics.append(metrics)

    # Sort by performance score descending
    all_metrics.sort(key=lambda x: x.performance_score, reverse=True)

    return all_metrics[:limit]


logger.info("Cleaner Analytics API router initialized")
