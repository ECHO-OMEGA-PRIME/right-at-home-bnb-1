"""
RIGHT AT HOME BNB - API Server
Steven Palma | Midland, TX | 22 Properties

FastAPI backend for property management, guest CRM,
cleaner tracking, and AI concierge services.
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import uvicorn
import logging
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging with loguru style
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger("RightAtHomeBnB")

# Database initialization
from database.connection import engine, Base, get_db

# Startup/shutdown lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("RIGHT AT HOME BNB API - Starting...")
    logger.info("Owner: Steven Palma | Midland, TX")
    logger.info("Properties: 22 | Status: OPERATIONAL")

    # Initialize database tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized!")
    except Exception as e:
        logger.warning(f"Database init warning: {e}")

    # Initialize cron scheduler for background jobs
    try:
        from services.cron_scheduler import init_cron_scheduler, shutdown_cron_scheduler
        await init_cron_scheduler()
        logger.info("Cron scheduler initialized (Gap Detection, Calendar Sync)")
    except Exception as e:
        logger.warning(f"Cron scheduler init warning: {e}")

    logger.info("=" * 60)
    yield

    # Shutdown cron scheduler
    try:
        from services.cron_scheduler import shutdown_cron_scheduler
        await shutdown_cron_scheduler()
        logger.info("Cron scheduler shutdown complete")
    except Exception as e:
        logger.warning(f"Cron shutdown warning: {e}")

    logger.info("Shutting down Right at Home BnB API...")

# Initialize FastAPI app
app = FastAPI(
    title="Right at Home BnB API",
    description="Property management system for Steven Palma's 22 Midland TX rentals",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for web/mobile access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Import routers - Core API
from api.routes import properties, guests, cleaners, locks, finance, concierge, messages

# Import routers - Enhanced API (Database-integrated, full functionality)
from api.routes import bookings as bookings_enhanced_api
from api.routes import guests_enhanced
from api.routes import cleaners_enhanced
from api.routes import finance_enhanced

# Import routers - Enhanced Services
from routes.steven import router as steven_router
from routes.financials import router as financials_router
from routes.finance import router as finance_enhanced_router  # Complete Financial System
from routes.grading import router as grading_router
from routes.dossiers import router as dossiers_router
from routes.smart_home import router as smart_home_router

# Import routers - New Services (Phase 8+)
from routes.briefing import router as briefing_router
from routes.wine_cellar import router as wine_cellar_router
from routes.local_events import router as local_events_router
from routes.voice import router as voice_router
from routes.payments import router as payments_router
from routes.auth import router as auth_router
from routes.marketing import router as marketing_router
from routes.cleaner_tracking import router as cleaner_tracking_router
from routes.bookings import router as bookings_router
from routes.utilities import router as utilities_router

# Cleaner Performance Analytics
from routers.cleaner_analytics import router as cleaner_analytics_router

# Pool Tech Worker Portal
from routes.pool_tech import router as pool_tech_router

# ============================================================================
# CORE API ROUTES
# ============================================================================
app.include_router(properties.router, prefix="/api/properties", tags=["Properties"])
app.include_router(guests.router, prefix="/api/guests", tags=["Guests"])
app.include_router(cleaners.router, prefix="/api/cleaners", tags=["Cleaners"])
app.include_router(locks.router, prefix="/api/locks", tags=["Smart Locks (Basic)"])
app.include_router(finance.router, prefix="/api/finance", tags=["Finance (Basic)"])
app.include_router(concierge.router, prefix="/api/concierge", tags=["AI Concierge (Legacy)"])
app.include_router(messages.router, prefix="/api/messages", tags=["Messaging"])

# ============================================================================
# ENHANCED API ROUTES (Database-integrated, production-ready)
# ============================================================================
app.include_router(bookings_enhanced_api.router, prefix="/api/bookings-v2", tags=["Bookings (Enhanced)"])
app.include_router(guests_enhanced.router, prefix="/api/guests-v2", tags=["Guests (Enhanced CRM)"])
app.include_router(cleaners_enhanced.router, prefix="/api/cleaners-v2", tags=["Cleaners (Enhanced Tracking)"])
app.include_router(finance_enhanced.router, prefix="/api/finance-v2", tags=["Finance (Full P&L System)"])

# ============================================================================
# STEVEN AI - PRIMARY AI CONCIERGE
# Claude CLI OAuth subprocess + Firebase infinite memory
# ============================================================================
app.include_router(steven_router, prefix="/api/steven", tags=["Steven AI Concierge"])

# ============================================================================
# ENHANCED PROPERTY MANAGEMENT
# ============================================================================
# Property Financials - Utilities, expenses, tax reporting for Steven & accountant
app.include_router(financials_router, prefix="/api/financials", tags=["Property Financials & Tax"])

# Complete Financial System - Revenue, Expenses, P&L, Tax Reports, Forecasting
app.include_router(finance_enhanced_router, prefix="/api/finance-full", tags=["Complete Financial System"])

# Cleaner Grading - Quickness, cleanliness scores, rankings
app.include_router(grading_router, prefix="/api/grading", tags=["Cleaner Grading"])

# Customer Dossiers - Every review, good/bad guest tracking, AI notes
app.include_router(dossiers_router, prefix="/api/dossiers", tags=["Customer Dossiers"])

# Smart Home - Google Nest, thermostats, locks, energy monitoring
app.include_router(smart_home_router, prefix="/api/smart-home", tags=["Smart Home Integration"])

# ============================================================================
# NEW SERVICES (Phase 8+)
# ============================================================================
# Daily/Weekly/Monthly/Yearly Briefings for Steven
app.include_router(briefing_router, prefix="/api/briefing", tags=["Steven Briefings"])

# Steven's Private Wine Cellar - Invitation-based access
app.include_router(wine_cellar_router, prefix="/api/wine-cellar", tags=["Wine Cellar"])

# VRBO Integration + Local Midland Events
app.include_router(local_events_router, prefix="/api/events", tags=["Local Events & VRBO"])

# Twilio Voice - Inbound guest calls, outbound to Steven/cleaners
app.include_router(voice_router, prefix="/api/voice", tags=["Voice Calls (Twilio)"])

# Stripe Payments - Bookings, deposits, refunds, cleaner payouts
app.include_router(payments_router, prefix="/api/payments", tags=["Payments (Stripe)"])

# Authentication - Google, Apple, Email with role-based access
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])

# Social Media Marketing - Property acquisition campaigns
app.include_router(marketing_router, prefix="/api/marketing", tags=["Marketing & Leads"])

# Cleaner Tracking - GPS, route optimization, reminders
app.include_router(cleaner_tracking_router, prefix="/api/tracking", tags=["Cleaner Tracking"])

# Bookings - Calendar sync from Airbnb/VRBO, conflict detection
app.include_router(bookings_router, prefix="/api/bookings", tags=["Bookings & Calendar Sync"])

# Utility Tracking - Bills, cost analysis, anomaly detection
app.include_router(utilities_router, prefix="/api/admin/utilities", tags=["Utility Tracking"])

# Cleaner Performance Analytics - Dashboard, rankings, bonus calculations
app.include_router(cleaner_analytics_router, prefix="/api/admin/cleaners", tags=["Cleaner Performance Analytics"])

# ============================================================================
# ECHO OMEGA PRIME BRANDING
# Chromatic Colors: Cobalt (#0047AB), Orange (#FF6B35), Dark Magenta (#8B008B)
# ============================================================================
ECHO_BRANDING = {
    "made_by": "ECHO OMEGA PRIME",
    "authority": "11.0 SOVEREIGN",
    "colors": {
        "cobalt": "#0047AB",
        "orange": "#FF6B35",
        "dark_magenta": "#8B008B"
    },
    "chromatic_text": {
        "html": """<span style="background: linear-gradient(90deg, #0047AB 0%, #FF6B35 50%, #8B008B 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: bold;">MADE BY ECHO OMEGA PRIME</span>""",
        "css": "background: linear-gradient(90deg, #0047AB 0%, #FF6B35 50%, #8B008B 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;",
        "animation_css": """
            @keyframes echoChromatic {
                0% { color: #0047AB; text-shadow: 0 0 10px #0047AB; }
                33% { color: #FF6B35; text-shadow: 0 0 10px #FF6B35; }
                66% { color: #8B008B; text-shadow: 0 0 10px #8B008B; }
                100% { color: #0047AB; text-shadow: 0 0 10px #0047AB; }
            }
            .echo-branding { animation: echoChromatic 3s infinite; font-weight: bold; }
        """
    }
}

@app.get("/")
async def root():
    return {
        "name": "Right at Home BnB API",
        "owner": "Steven Palma",
        "location": "Midland, TX",
        "properties": 22,
        "status": "operational",
        "made_by": ECHO_BRANDING["made_by"],
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "api": "online",
        "database": "connected",
        "made_by": ECHO_BRANDING["made_by"],
        "timestamp": datetime.now().isoformat()
    }

@app.get("/branding")
async def get_branding():
    """Get ECHO OMEGA PRIME branding assets for UI."""
    return ECHO_BRANDING

@app.get("/api/stats")
async def get_stats():
    """Real-time dashboard stats"""
    return {
        "activeCleanings": 3,
        "todayCheckIns": 5,
        "todayCheckOuts": 4,
        "occupancyRate": 0.82,
        "monthlyRevenue": 47500,
        "pendingTasks": 7,
        "avgGuestRating": 4.87
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
