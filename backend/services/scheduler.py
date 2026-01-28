"""
Right At Home BnB - Background Job Scheduler
=============================================
APScheduler-based scheduler for automated tasks:
- Friday 5 PM: Weekly payout report generation and email delivery
- Daily 8 AM: Morning briefing generation
- Daily 11 PM: Calendar sync from Airbnb/VRBO

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
import asyncio
from datetime import datetime
from loguru import logger
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor

# Timezone for Midland, TX
from pytz import timezone
MIDLAND_TZ = timezone("America/Chicago")  # CST/CDT


class BackgroundScheduler:
    """
    Background job scheduler for automated tasks.
    Uses APScheduler with async support.
    """

    def __init__(self):
        self.scheduler: AsyncIOScheduler = None
        self.is_running = False

        # Job configuration
        self.jobs = {
            "friday_payout": {
                "func": self._run_friday_payout,
                "trigger": CronTrigger(
                    day_of_week="fri",
                    hour=17,  # 5 PM
                    minute=0,
                    timezone=MIDLAND_TZ
                ),
                "description": "Weekly payout report generation and email"
            },
            "morning_briefing": {
                "func": self._run_morning_briefing,
                "trigger": CronTrigger(
                    hour=8,
                    minute=0,
                    timezone=MIDLAND_TZ
                ),
                "description": "Daily morning briefing for Steven"
            },
            "calendar_sync": {
                "func": self._run_calendar_sync,
                "trigger": CronTrigger(
                    hour=23,
                    minute=0,
                    timezone=MIDLAND_TZ
                ),
                "description": "Daily calendar sync from Airbnb/VRBO"
            },
            "nightly_analytics": {
                "func": self._run_nightly_analytics,
                "trigger": CronTrigger(
                    hour=2,  # 2 AM
                    minute=0,
                    timezone=MIDLAND_TZ
                ),
                "description": "Nightly analytics calculations"
            }
        }

        logger.info("BackgroundScheduler initialized")

    def start(self):
        """Start the scheduler."""
        if self.is_running:
            logger.warning("Scheduler already running")
            return

        # Configure job stores and executors
        jobstores = {
            'default': MemoryJobStore()
        }
        executors = {
            'default': AsyncIOExecutor()
        }
        job_defaults = {
            'coalesce': True,  # Combine multiple missed executions
            'max_instances': 1,  # Only one instance of each job at a time
            'misfire_grace_time': 3600  # 1 hour grace time for missed jobs
        }

        self.scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            timezone=MIDLAND_TZ
        )

        # Add all jobs
        for job_id, job_config in self.jobs.items():
            self.scheduler.add_job(
                job_config["func"],
                trigger=job_config["trigger"],
                id=job_id,
                name=job_config["description"],
                replace_existing=True
            )
            logger.info(f"Scheduled job: {job_id} - {job_config['description']}")

        self.scheduler.start()
        self.is_running = True
        logger.info("Background scheduler started")

    def stop(self):
        """Stop the scheduler."""
        if self.scheduler and self.is_running:
            self.scheduler.shutdown(wait=False)
            self.is_running = False
            logger.info("Background scheduler stopped")

    def get_jobs(self):
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

    def trigger_job(self, job_id: str):
        """Manually trigger a job immediately."""
        if not self.scheduler:
            raise RuntimeError("Scheduler not started")

        job = self.scheduler.get_job(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        # Run job immediately in background
        self.scheduler.modify_job(job_id, next_run_time=datetime.now(MIDLAND_TZ))
        logger.info(f"Manually triggered job: {job_id}")
        return True

    # ==========================================================================
    # JOB IMPLEMENTATIONS
    # ==========================================================================

    async def _run_friday_payout(self):
        """Friday payout report job."""
        logger.info("Running Friday payout job...")

        try:
            from services.payout_service import payout_service
            result = await payout_service.friday_payout_job()

            if result.get("success"):
                logger.info(
                    f"Friday payout job completed: "
                    f"Report {result.get('report_id')}, "
                    f"Net Profit: ${result.get('report_summary', {}).get('net_profit', 0):,.2f}"
                )
            else:
                logger.error(f"Friday payout job failed: {result.get('error')}")

        except Exception as e:
            logger.exception(f"Friday payout job error: {e}")

    async def _run_morning_briefing(self):
        """Morning briefing job."""
        logger.info("Running morning briefing job...")

        try:
            # Import briefing service if available
            try:
                from services.daily_briefing import briefing_service
                result = await briefing_service.generate_daily_briefing()
                logger.info(f"Morning briefing generated: {result.get('id', 'unknown')}")
            except ImportError:
                logger.debug("Briefing service not available")

        except Exception as e:
            logger.exception(f"Morning briefing job error: {e}")

    async def _run_calendar_sync(self):
        """Calendar sync job."""
        logger.info("Running calendar sync job...")

        try:
            # Import calendar sync service if available
            try:
                from services.calendar_sync import calendar_sync_service
                result = await calendar_sync_service.sync_all_properties()
                logger.info(f"Calendar sync completed: {result.get('synced_count', 0)} bookings")
            except ImportError:
                logger.debug("Calendar sync service not available")

        except Exception as e:
            logger.exception(f"Calendar sync job error: {e}")

    async def _run_nightly_analytics(self):
        """Nightly analytics calculation job."""
        logger.info("Running nightly analytics job...")

        try:
            # Calculate monthly financials
            try:
                from services.finance import financial_service
                from datetime import date

                today = date.today()
                overview = await financial_service.get_financial_overview(
                    year=today.year,
                    month=today.month
                )
                logger.info(
                    f"Nightly analytics completed: "
                    f"MTD Revenue ${overview.get('summary', {}).get('total_revenue', 0):,.2f}"
                )
            except ImportError:
                logger.debug("Financial service not available")

        except Exception as e:
            logger.exception(f"Nightly analytics job error: {e}")


# ==============================================================================
# SINGLETON INSTANCE
# ==============================================================================

background_scheduler = BackgroundScheduler()


# ==============================================================================
# STARTUP/SHUTDOWN HELPERS
# ==============================================================================

def start_scheduler():
    """Start the background scheduler."""
    background_scheduler.start()


def stop_scheduler():
    """Stop the background scheduler."""
    background_scheduler.stop()
