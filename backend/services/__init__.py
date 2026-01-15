"""
Right At Home BnB - Backend Services
=====================================
Comprehensive property management services for Steven Palma's 22 Midland TX rentals.

@author ECHO OMEGA PRIME
"""

# Core Services
from .ai_concierge import ai_concierge, AIConcierge
from .voice_service import voice_service, VoiceService
from .smart_locks import smart_lock_service, SmartLockService, LockProvider

# Steven AI - Primary AI Concierge (Claude CLI OAuth + Infinite Memory)
from .steven_ai import steven_ai, StevenAI, ask_steven, get_guest_history

# Enhanced Services
from .property_financials import property_financial_service, PropertyFinancialService
from .cleaner_grading import cleaner_grading_service, CleanerGradingService, CleanerGrade
from .customer_dossier import customer_dossier_service, CustomerDossierService, GuestRating
from .smart_home import smart_home_service, SmartHomeService

# New Services (Phase 8+)
from .ical_sync import ICalSyncService, ical_sync_service
from .twilio_sms import TwilioSMSService, twilio_sms_service, MessageTemplate
from .photo_analysis import PhotoAnalysisService, photo_analysis_service, PhotoCategory, CleanlinessLevel
from .sentiment_analysis import SentimentAnalysisService, sentiment_analysis_service, Sentiment, Urgency

__all__ = [
    # ========================================================================
    # CORE SERVICES
    # ========================================================================
    # Legacy AI Concierge (OpenAI)
    "ai_concierge",
    "AIConcierge",

    # Voice Service (ElevenLabs)
    "voice_service",
    "VoiceService",

    # Smart Locks (Schlage, Yale, August)
    "smart_lock_service",
    "SmartLockService",
    "LockProvider",

    # ========================================================================
    # STEVEN AI - PRIMARY AI CONCIERGE
    # Uses Claude CLI OAuth subprocess for intelligence
    # Firebase for infinite memory across all conversations
    # ========================================================================
    "steven_ai",
    "StevenAI",
    "ask_steven",
    "get_guest_history",

    # ========================================================================
    # PROPERTY FINANCIAL MANAGEMENT
    # Utilities, expenses, tax reporting for Steven & accountant
    # ========================================================================
    "property_financial_service",
    "PropertyFinancialService",

    # ========================================================================
    # CLEANER GRADING SYSTEM
    # Quickness, cleanliness scores, rankings, grades (A+ to F)
    # ========================================================================
    "cleaner_grading_service",
    "CleanerGradingService",
    "CleanerGrade",

    # ========================================================================
    # CUSTOMER DOSSIER SYSTEM
    # Every review, good/bad guest tracking, AI notes
    # ========================================================================
    "customer_dossier_service",
    "CustomerDossierService",
    "GuestRating",

    # ========================================================================
    # SMART HOME INTEGRATION
    # Google Nest, thermostats, locks, energy monitoring
    # ========================================================================
    "smart_home_service",
    "SmartHomeService",

    # ========================================================================
    # ICAL SYNC SERVICE
    # Airbnb, VRBO, Booking.com calendar synchronization
    # ========================================================================
    "ical_sync_service",
    "ICalSyncService",

    # ========================================================================
    # TWILIO SMS SERVICE
    # Guest messaging, booking confirmations, access code delivery
    # ========================================================================
    "twilio_sms_service",
    "TwilioSMSService",
    "MessageTemplate",

    # ========================================================================
    # PHOTO ANALYSIS SERVICE
    # GPT-4 Vision for cleaning verification, property inspection
    # ========================================================================
    "photo_analysis_service",
    "PhotoAnalysisService",
    "PhotoCategory",
    "CleanlinessLevel",

    # ========================================================================
    # SENTIMENT ANALYSIS SERVICE
    # AI-powered message sentiment detection, urgency classification
    # ========================================================================
    "sentiment_analysis_service",
    "SentimentAnalysisService",
    "Sentiment",
    "Urgency",
]
