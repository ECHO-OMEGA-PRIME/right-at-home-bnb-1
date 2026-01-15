"""
Right at Home BnB - AI Services Module
======================================
Complete AI integration for the AI Concierge system.

Components:
- AIConcierge: Main chat service with GPT-4
- VoiceService: ElevenLabs TTS + Whisper STT
- PhotoAnalysisService: GPT-4 Vision cleaning verification
- SentimentAnalysisService: Guest mood detection

@author ECHO OMEGA PRIME
@owner Steven Palma - Right at Home BnB, Midland, TX
"""

from .concierge import (
    AIConcierge,
    ai_concierge,
    QueryIntent,
    GuestType,
    PROPERTIES,
    RESTAURANTS,
    BARS,
    ATTRACTIONS,
    EMERGENCY_INFO,
)

from .voice import (
    VoiceService,
    voice_service,
    speak,
    transcribe,
    welcome_audio,
    VOICE_CONFIG,
    VOICE_PRESETS,
)

from .photo_analysis import (
    PhotoAnalysisService,
    photo_analysis_service,
    RoomType,
    IssueType,
    IssueSeverity,
    CleaningIssue,
)

from .sentiment import (
    SentimentAnalysisService,
    sentiment_service,
    Sentiment,
    Urgency,
    EscalationLevel,
    SentimentResult,
)

__all__ = [
    # Concierge
    "AIConcierge",
    "ai_concierge",
    "QueryIntent",
    "GuestType",
    "PROPERTIES",
    "RESTAURANTS",
    "BARS",
    "ATTRACTIONS",
    "EMERGENCY_INFO",
    # Voice
    "VoiceService",
    "voice_service",
    "speak",
    "transcribe",
    "welcome_audio",
    "VOICE_CONFIG",
    "VOICE_PRESETS",
    # Photo Analysis
    "PhotoAnalysisService",
    "photo_analysis_service",
    "RoomType",
    "IssueType",
    "IssueSeverity",
    "CleaningIssue",
    # Sentiment
    "SentimentAnalysisService",
    "sentiment_service",
    "Sentiment",
    "Urgency",
    "EscalationLevel",
    "SentimentResult",
]

__version__ = "1.0.0"
