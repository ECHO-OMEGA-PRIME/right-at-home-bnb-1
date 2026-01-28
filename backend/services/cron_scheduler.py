"""
Cron Job Scheduler for Right At Home BnB
=========================================
Background task scheduler for recurring operations.

Scheduled Jobs:
- Daily gap detection (3 AM CDT)
- Calendar sync (every 15 minutes)
- Expired offer cleanup (daily at 2 AM)
- Weekly analytics summary (Fridays at 6 AM)

Uses APScheduler for reliable job scheduling with:
- Persistent job store (SQLite)
- Missed job handling
- Job coalescing to prevent duplicate runs

ECHO OMEGA PRIME | Made for Steven Palma - Midland, TX
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Callable
from contextlib import asynccontextmanager
import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED

from database.connection import DATABASE_URL

logger = logging.getLogger("RightAtHomeBnB.CronScheduler")


class CronScheduler:
    """
    Central scheduler for all background jobs.
    Uses APScheduler with async support for FastAPI integration.
    """

    def __init__(self, use_persistent_store: bool = True):
        """
        Initialize the scheduler.

        Args:
            use_persistent_store: Use SQLite to persist job state across restarts
        """
        self.scheduler: Optional[AsyncIOScheduler] = None
        self.use_persistent_store = use_persistent_store
        self._job_results: Dict[str, Any] = {}
        self._initialized = False

    def _create_scheduler(self) -> AsyncIOScheduler:
        """Create and configure the scheduler."""
        jobstores = {}
        if self.use_persistent_store:
            # Use SQLite file for job persistence
            job_store_url = os.getenv(
                "SCHEDULER_DB_URL",
                "sqlite:///./scheduler_jobs.db"
            )
            jobstores["default"] = SQLAlchemyJobStore(url=job_store_url)

        executors = {
            "default": AsyncIOExecutor()
        }

        job_defaults = {
            "coalesce": True,  # Combine missed runs into one
            "max_instances": 1,  # Only one instance of each job at a time
            "misfire_grace_time": 3600  # Allow 1 hour of grace for missed jobs
        }

        scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            timezone="America/Chicago"  # Midland, TX timezone
        )

        # Add event listeners for logging
        scheduler.add_listener(self._job_executed, EVENT_JOB_EXECUTED)
        scheduler.add_listener(self._job_error, EVENT_JOB_ERROR)

        return scheduler

    def _job_executed(self, event):
        """Log successful job execution."""
        job_id = event.job_id
        logger.info(f"Job '{job_id}' executed successfully")

    def _job_error(self, event):
        """Log job execution errors."""
        job_id = event.job_id
        exception = event.exception
        logger.error(f"Job '{job_id}' failed with error: {exception}")

    async def start(self):
        """Start the scheduler."""
        if self._initialized:
            logger.warning("Scheduler already started")
            return

        self.scheduler = self._create_scheduler()
        self._register_jobs()
        self.scheduler.start()
        self._initialized = True

        logger.info("Cron scheduler started successfully")

    async def shutdown(self):
        """Shutdown the scheduler gracefully."""
        if self.scheduler:
            self.scheduler.shutdown(wait=True)
            self._initialized = False
            logger.info("Cron scheduler stopped")

    def _register_jobs(self):
        """Register all scheduled jobs."""
        if not self.scheduler:
            return

        # =====================================================================
        # DAILY GAP DETECTION - 3:00 AM CDT
        # =====================================================================
        self.scheduler.add_job(
            self._run_gap_detection,
            CronTrigger(hour=3, minute=0),
            id="daily_gap_detection",
            name="Daily Gap Detection Scan",
            replace_existing=True
        )

        # =====================================================================
        # CALENDAR SYNC - Every 15 minutes
        # =====================================================================
        self.scheduler.add_job(
            self._run_calendar_sync,
            IntervalTrigger(minutes=15),
            id="calendar_sync",
            name="Airbnb/VRBO Calendar Sync",
            replace_existing=True
        )

        # =====================================================================
        # EXPIRED OFFER CLEANUP - 2:00 AM CDT
        # =====================================================================
        self.scheduler.add_job(
            self._cleanup_expired_offers,
            CronTrigger(hour=2, minute=0),
            id="expired_offer_cleanup",
            name="Expired Offer Cleanup",
            replace_existing=True
        )

        # =====================================================================
        # WEEKLY ANALYTICS - Fridays at 6:00 AM CDT
        # =====================================================================
        self.scheduler.add_job(
            self._run_weekly_analytics,
            CronTrigger(day_of_week="fri", hour=6, minute=0),
            id="weekly_analytics",
            name="Weekly Analytics Summary",
            replace_existing=True
        )

        logger.info(f"Registered {len(self.scheduler.get_jobs())} scheduled jobs")

    # =========================================================================
    # JOB IMPLEMENTATIONS
    # =========================================================================

    async def _run_gap_detection(self) -> Dict[str, Any]:
        """
        Run the daily gap detection scan.
        Scans all properties for booking gaps and generates offers.
        """
        logger.info("Starting scheduled gap detection scan...")
        start_time = datetime.now()

        try:
            from services.gap_filler import run_daily_gap_scan
            result = await run_daily_gap_scan()

            self._job_results["daily_gap_detection"] = {
                "last_run": datetime.now().isoformat(),
                "status": "success",
                "result": result
            }

            logger.info(
                f"Gap detection complete: {result.get('gaps_found', 0)} gaps found, "
                f"{result.get('offers_generated', 0)} offers generated"
            )
            return result

        except Exception as e:
            logger.error(f"Gap detection failed: {e}")
            self._job_results["daily_gap_detection"] = {
                "last_run": datetime.now().isoformat(),
                "status": "error",
                "error": str(e)
            }
            raise

    async def _run_calendar_sync(self) -> Dict[str, Any]:
        """
        Sync calendars from Airbnb and VRBO.
        Fetches latest booking data from iCal feeds.
        """
        logger.info("Starting calendar sync...")

        try:
            from services.calendar_sync import get_calendar_sync_service

            service = get_calendar_sync_service()
            results = await service.sync_all()

            total_synced = sum(len(r) for r in results.values())

            self._job_results["calendar_sync"] = {
                "last_run": datetime.now().isoformat(),
                "status": "success",
                "properties_synced": len(results),
                "feeds_synced": total_synced
            }

            logger.info(f"Calendar sync complete: {total_synced} feeds synced")
            return results

        except Exception as e:
            logger.error(f"Calendar sync failed: {e}")
            self._job_results["calendar_sync"] = {
                "last_run": datetime.now().isoformat(),
                "status": "error",
                "error": str(e)
            }
            raise

    async def _cleanup_expired_offers(self) -> Dict[str, Any]:
        """
        Clean up expired special offers.
        Deactivates offers past their expiration date.
        """
        logger.info("Cleaning up expired offers...")

        try:
            from database.connection import SessionLocal
            from database.models_financial import SpecialOffer
            from datetime import date

            db = SessionLocal()
            try:
                # Find expired offers
                expired = db.query(SpecialOffer).filter(
                    SpecialOffer.is_active == True,
                    SpecialOffer.end_date < date.today()
                ).all()

                count = 0
                for offer in expired:
                    offer.is_active = False
                    count += 1

                db.commit()

                self._job_results["expired_offer_cleanup"] = {
                    "last_run": datetime.now().isoformat(),
                    "status": "success",
                    "offers_deactivated": count
                }

                logger.info(f"Deactivated {count} expired offers")
                return {"offers_deactivated": count}

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Offer cleanup failed: {e}")
            self._job_results["expired_offer_cleanup"] = {
                "last_run": datetime.now().isoformat(),
                "status": "error",
                "error": str(e)
            }
            raise

    async def _run_weekly_analytics(self) -> Dict[str, Any]:
        """
        Generate weekly analytics summary.
        Creates reports for Steven's review.
        """
        logger.info("Generating weekly analytics...")

        try:
            from database.connection import SessionLocal
            from database.models_financial import BookingGap, SpecialOffer, WeeklyPayoutReport
            from datetime import date, timedelta
            from sqlalchemy import func

            db = SessionLocal()
            try:
                week_end = date.today()
                week_start = week_end - timedelta(days=7)

                # Count gaps this week
                gaps_found = db.query(BookingGap).filter(
                    BookingGap.created_at >= week_start
                ).count()

                # Count offers created
                offers_created = db.query(SpecialOffer).filter(
                    SpecialOffer.created_at >= week_start
                ).count()

                # Count gaps filled
                gaps_filled = db.query(BookingGap).filter(
                    BookingGap.was_filled == True,
                    BookingGap.updated_at >= week_start
                ).count()

                summary = {
                    "week_start": week_start.isoformat(),
                    "week_end": week_end.isoformat(),
                    "gaps_found": gaps_found,
                    "offers_created": offers_created,
                    "gaps_filled": gaps_filled,
                    "fill_rate": (gaps_filled / gaps_found * 100) if gaps_found > 0 else 0
                }

                self._job_results["weekly_analytics"] = {
                    "last_run": datetime.now().isoformat(),
                    "status": "success",
                    "summary": summary
                }

                logger.info(f"Weekly analytics: {gaps_found} gaps, {gaps_filled} filled")
                return summary

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Weekly analytics failed: {e}")
            self._job_results["weekly_analytics"] = {
                "last_run": datetime.now().isoformat(),
                "status": "error",
                "error": str(e)
            }
            raise

    # =========================================================================
    # MANAGEMENT METHODS
    # =========================================================================

    def get_jobs(self) -> list:
        """Get list of all scheduled jobs."""
        if not self.scheduler:
            return []

        jobs = []
        for job in self.scheduler.get_jobs():
            next_run = job.next_run_time
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": next_run.isoformat() if next_run else None,
                "trigger": str(job.trigger)
            })
        return jobs

    def get_job_results(self) -> Dict[str, Any]:
        """Get results from last job executions."""
        return self._job_results.copy()

    async def run_job_now(self, job_id: str) -> Dict[str, Any]:
        """Manually trigger a job to run immediately."""
        job_map = {
            "daily_gap_detection": self._run_gap_detection,
            "calendar_sync": self._run_calendar_sync,
            "expired_offer_cleanup": self._cleanup_expired_offers,
            "weekly_analytics": self._run_weekly_analytics
        }

        if job_id not in job_map:
            raise ValueError(f"Unknown job: {job_id}")

        logger.info(f"Manually running job: {job_id}")
        return await job_map[job_id]()

    def pause_job(self, job_id: str):
        """Pause a scheduled job."""
        if self.scheduler:
            self.scheduler.pause_job(job_id)
            logger.info(f"Paused job: {job_id}")

    def resume_job(self, job_id: str):
        """Resume a paused job."""
        if self.scheduler:
            self.scheduler.resume_job(job_id)
            logger.info(f"Resumed job: {job_id}")


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_scheduler: Optional[CronScheduler] = None


def get_cron_scheduler() -> CronScheduler:
    """Get the singleton CronScheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = CronScheduler()
    return _scheduler


async def init_cron_scheduler():
    """Initialize and start the cron scheduler."""
    scheduler = get_cron_scheduler()
    await scheduler.start()
    return scheduler


async def shutdown_cron_scheduler():
    """Shutdown the cron scheduler."""
    scheduler = get_cron_scheduler()
    await scheduler.shutdown()


# =============================================================================
# FASTAPI INTEGRATION
# =============================================================================

@asynccontextmanager
async def lifespan_scheduler(app):
    """
    FastAPI lifespan context manager for scheduler.
    Use in your FastAPI app like:

    @asynccontextmanager
    async def lifespan(app):
        async with lifespan_scheduler(app):
            yield

    app = FastAPI(lifespan=lifespan)
    """
    # Startup
    await init_cron_scheduler()
    logger.info("Cron scheduler initialized")

    yield

    # Shutdown
    await shutdown_cron_scheduler()
    logger.info("Cron scheduler shutdown complete")
