"""
Sentiment Analysis Service for Right at Home BnB
AI-powered message sentiment detection and prioritization
@author ECHO OMEGA PRIME
"""

import os
import json
import re
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
from loguru import logger
from openai import AsyncOpenAI


class Sentiment(str, Enum):
    """Overall sentiment classification"""
    VERY_POSITIVE = "very_positive"
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    VERY_NEGATIVE = "very_negative"


class Urgency(str, Enum):
    """Message urgency level"""
    CRITICAL = "critical"    # Requires immediate action
    HIGH = "high"           # Should address within 1 hour
    NORMAL = "normal"       # Standard response time
    LOW = "low"             # Can wait / informational


class Intent(str, Enum):
    """Detected message intent"""
    QUESTION = "question"
    COMPLAINT = "complaint"
    PRAISE = "praise"
    REQUEST = "request"
    EMERGENCY = "emergency"
    FEEDBACK = "feedback"
    BOOKING_INQUIRY = "booking_inquiry"
    CHECK_IN_ISSUE = "check_in_issue"
    MAINTENANCE = "maintenance"
    LATE_CHECKOUT = "late_checkout"
    GENERAL = "general"


class Topic(str, Enum):
    """Message topic classification"""
    CLEANLINESS = "cleanliness"
    AMENITIES = "amenities"
    LOCATION = "location"
    VALUE = "value"
    COMMUNICATION = "communication"
    CHECK_IN = "check_in"
    NOISE = "noise"
    SAFETY = "safety"
    WIFI = "wifi"
    TEMPERATURE = "temperature"
    PARKING = "parking"
    OTHER = "other"


@dataclass
class SentimentResult:
    """Sentiment analysis result"""
    success: bool
    sentiment: Optional[Sentiment] = None
    sentiment_score: float = 0.0  # -1.0 to 1.0
    urgency: Urgency = Urgency.NORMAL
    intent: Intent = Intent.GENERAL
    topics: List[Topic] = field(default_factory=list)
    emotions: List[str] = field(default_factory=list)
    key_phrases: List[str] = field(default_factory=list)
    requires_human: bool = False
    escalation_reason: Optional[str] = None
    suggested_response: Optional[str] = None
    confidence: float = 0.0
    error: Optional[str] = None
    analyzed_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ReviewAnalysisResult:
    """Review sentiment analysis result"""
    success: bool
    sentiment: Optional[Sentiment] = None
    sentiment_score: float = 0.0
    rating_prediction: Optional[int] = None
    key_positives: List[str] = field(default_factory=list)
    key_negatives: List[str] = field(default_factory=list)
    topics_mentioned: List[Topic] = field(default_factory=list)
    actionable_feedback: List[str] = field(default_factory=list)
    suggested_response: Optional[str] = None
    response_priority: str = "normal"
    error: Optional[str] = None


# Keywords that trigger escalation
ESCALATION_KEYWORDS = {
    "critical": [
        "emergency", "fire", "flood", "break in", "intruder", "gas leak",
        "carbon monoxide", "injury", "hurt", "bleeding", "ambulance",
        "police", "911", "dangerous"
    ],
    "high": [
        "locked out", "no power", "no water", "no heat", "no ac", "no wifi",
        "broken", "flood", "leak", "smoke", "smell gas", "refund",
        "leaving early", "terrible", "disgusting", "unacceptable",
        "lawyer", "health department", "sue"
    ],
    "normal": [
        "not working", "problem", "issue", "complaint", "disappointed",
        "unhappy", "dirty", "noise", "loud"
    ]
}

# Positive indicators
POSITIVE_KEYWORDS = [
    "amazing", "wonderful", "fantastic", "excellent", "perfect", "love",
    "beautiful", "clean", "comfortable", "spacious", "great", "best",
    "recommend", "return", "thank you", "appreciate", "helpful"
]

# Negative indicators
NEGATIVE_KEYWORDS = [
    "terrible", "awful", "horrible", "dirty", "filthy", "broken",
    "disappointed", "complaint", "refund", "never", "worst", "disgusting",
    "unacceptable", "rude", "ignore", "lied"
]


SENTIMENT_ANALYSIS_PROMPT = """You are an expert in customer sentiment analysis for a short-term rental business.
Analyze the following message and provide a detailed assessment.

Message: {message}

Context: {context}

Respond in JSON format:
{{
    "sentiment": "very_positive|positive|neutral|negative|very_negative",
    "sentiment_score": -1.0 to 1.0,
    "urgency": "critical|high|normal|low",
    "intent": "question|complaint|praise|request|emergency|feedback|booking_inquiry|check_in_issue|maintenance|late_checkout|general",
    "topics": ["cleanliness", "amenities", "location", "value", "communication", "check_in", "noise", "safety", "wifi", "temperature", "parking", "other"],
    "emotions": ["list of detected emotions"],
    "key_phrases": ["important phrases from the message"],
    "requires_human": true/false,
    "escalation_reason": "reason if requires human",
    "suggested_response": "brief suggested response approach",
    "confidence": 0.0 to 1.0
}}
"""

REVIEW_ANALYSIS_PROMPT = """You are an expert in analyzing guest reviews for short-term rentals.
Analyze this review and extract actionable insights.

Review text: {review}
Rating: {rating}/5

Respond in JSON format:
{{
    "sentiment": "very_positive|positive|neutral|negative|very_negative",
    "sentiment_score": -1.0 to 1.0,
    "key_positives": ["list of positive aspects mentioned"],
    "key_negatives": ["list of negative aspects mentioned"],
    "topics_mentioned": ["cleanliness", "amenities", "location", "value", "communication", "check_in", "other"],
    "actionable_feedback": ["specific improvements suggested or implied"],
    "response_tone": "grateful|apologetic|professional|defensive_appropriate",
    "response_priority": "high|normal|low",
    "suggested_response": "brief response to this review"
}}
"""


class SentimentAnalysisService:
    """
    AI-powered sentiment analysis for guest communications.
    Uses OpenAI for nuanced understanding and keyword matching for speed.
    """

    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = os.getenv("OPENAI_MODEL", "gpt-4-turbo-preview")

    def _quick_sentiment_check(self, text: str) -> Tuple[Sentiment, float, Urgency]:
        """Quick keyword-based sentiment check (no API call)."""
        text_lower = text.lower()

        # Check for escalation keywords first
        for level, keywords in ESCALATION_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    if level == "critical":
                        return Sentiment.VERY_NEGATIVE, -0.9, Urgency.CRITICAL
                    elif level == "high":
                        return Sentiment.NEGATIVE, -0.6, Urgency.HIGH
                    else:
                        return Sentiment.NEGATIVE, -0.3, Urgency.NORMAL

        # Count positive/negative keywords
        pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in text_lower)
        neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text_lower)

        # Calculate score
        total = pos_count + neg_count
        if total == 0:
            return Sentiment.NEUTRAL, 0.0, Urgency.NORMAL

        score = (pos_count - neg_count) / total

        if score >= 0.6:
            return Sentiment.VERY_POSITIVE, score, Urgency.LOW
        elif score >= 0.2:
            return Sentiment.POSITIVE, score, Urgency.LOW
        elif score <= -0.6:
            return Sentiment.VERY_NEGATIVE, score, Urgency.HIGH
        elif score <= -0.2:
            return Sentiment.NEGATIVE, score, Urgency.NORMAL
        else:
            return Sentiment.NEUTRAL, score, Urgency.NORMAL

    def _detect_intent(self, text: str) -> Intent:
        """Detect message intent from content."""
        text_lower = text.lower()

        # Check patterns
        if any(kw in text_lower for kw in ["emergency", "911", "fire", "flood"]):
            return Intent.EMERGENCY

        if "?" in text:
            if any(kw in text_lower for kw in ["available", "book", "price", "rate"]):
                return Intent.BOOKING_INQUIRY
            return Intent.QUESTION

        if any(kw in text_lower for kw in ["locked out", "can't get in", "code not working", "door won't open"]):
            return Intent.CHECK_IN_ISSUE

        if any(kw in text_lower for kw in ["broken", "not working", "leak", "repair", "fix"]):
            return Intent.MAINTENANCE

        if any(kw in text_lower for kw in ["late checkout", "late check out", "leave later"]):
            return Intent.LATE_CHECKOUT

        if any(kw in text_lower for kw in ["complaint", "unhappy", "disappointed", "refund"]):
            return Intent.COMPLAINT

        if any(kw in text_lower for kw in ["thank", "amazing", "wonderful", "great stay"]):
            return Intent.PRAISE

        if any(kw in text_lower for kw in ["could you", "please", "would you", "can you"]):
            return Intent.REQUEST

        return Intent.GENERAL

    def _detect_topics(self, text: str) -> List[Topic]:
        """Detect topics mentioned in message."""
        text_lower = text.lower()
        topics = []

        topic_keywords = {
            Topic.CLEANLINESS: ["clean", "dirty", "dust", "stain", "mess"],
            Topic.AMENITIES: ["pool", "hot tub", "gym", "amenity", "feature"],
            Topic.LOCATION: ["location", "area", "neighborhood", "nearby"],
            Topic.VALUE: ["price", "value", "expensive", "cheap", "worth"],
            Topic.COMMUNICATION: ["respond", "message", "contact", "reply"],
            Topic.CHECK_IN: ["check in", "check-in", "arrival", "key", "code"],
            Topic.NOISE: ["noise", "loud", "quiet", "neighbor"],
            Topic.SAFETY: ["safe", "security", "lock", "alarm"],
            Topic.WIFI: ["wifi", "wi-fi", "internet", "connection"],
            Topic.TEMPERATURE: ["hot", "cold", "ac", "heat", "thermostat"],
            Topic.PARKING: ["parking", "park", "garage", "driveway"]
        }

        for topic, keywords in topic_keywords.items():
            if any(kw in text_lower for kw in keywords):
                topics.append(topic)

        return topics if topics else [Topic.OTHER]

    async def analyze_message(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
        use_ai: bool = True
    ) -> SentimentResult:
        """
        Analyze sentiment and intent of a guest message.

        Args:
            message: The message text to analyze
            context: Optional context (guest info, booking info, etc.)
            use_ai: Whether to use AI for deep analysis

        Returns:
            SentimentResult with full analysis
        """
        # Quick check first (always)
        quick_sentiment, quick_score, quick_urgency = self._quick_sentiment_check(message)
        quick_intent = self._detect_intent(message)
        quick_topics = self._detect_topics(message)

        # For critical/high urgency or if AI disabled, return quick result
        if quick_urgency in [Urgency.CRITICAL, Urgency.HIGH] or not use_ai:
            return SentimentResult(
                success=True,
                sentiment=quick_sentiment,
                sentiment_score=quick_score,
                urgency=quick_urgency,
                intent=quick_intent,
                topics=quick_topics,
                requires_human=quick_urgency in [Urgency.CRITICAL, Urgency.HIGH],
                escalation_reason="Urgent keywords detected" if quick_urgency != Urgency.NORMAL else None,
                confidence=0.7
            )

        # Use AI for deeper analysis
        try:
            prompt = SENTIMENT_ANALYSIS_PROMPT.format(
                message=message,
                context=json.dumps(context) if context else "No additional context"
            )

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=800,
                temperature=0.3,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            return SentimentResult(
                success=True,
                sentiment=Sentiment(result.get("sentiment", "neutral")),
                sentiment_score=result.get("sentiment_score", 0.0),
                urgency=Urgency(result.get("urgency", "normal")),
                intent=Intent(result.get("intent", "general")),
                topics=[Topic(t) for t in result.get("topics", ["other"]) if t in [e.value for e in Topic]],
                emotions=result.get("emotions", []),
                key_phrases=result.get("key_phrases", []),
                requires_human=result.get("requires_human", False),
                escalation_reason=result.get("escalation_reason"),
                suggested_response=result.get("suggested_response"),
                confidence=result.get("confidence", 0.85)
            )

        except Exception as e:
            logger.error(f"AI sentiment analysis failed: {e}")
            # Fall back to quick analysis
            return SentimentResult(
                success=True,
                sentiment=quick_sentiment,
                sentiment_score=quick_score,
                urgency=quick_urgency,
                intent=quick_intent,
                topics=quick_topics,
                confidence=0.6,
                error=f"AI analysis failed, using keyword analysis: {str(e)}"
            )

    async def analyze_review(
        self,
        review_text: str,
        rating: Optional[int] = None
    ) -> ReviewAnalysisResult:
        """
        Analyze a guest review for insights and suggested response.

        Args:
            review_text: The review content
            rating: Optional star rating (1-5)

        Returns:
            ReviewAnalysisResult with insights
        """
        try:
            prompt = REVIEW_ANALYSIS_PROMPT.format(
                review=review_text,
                rating=rating if rating else "Not provided"
            )

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.3,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            return ReviewAnalysisResult(
                success=True,
                sentiment=Sentiment(result.get("sentiment", "neutral")),
                sentiment_score=result.get("sentiment_score", 0.0),
                rating_prediction=result.get("rating_prediction"),
                key_positives=result.get("key_positives", []),
                key_negatives=result.get("key_negatives", []),
                topics_mentioned=[Topic(t) for t in result.get("topics_mentioned", ["other"]) if t in [e.value for e in Topic]],
                actionable_feedback=result.get("actionable_feedback", []),
                suggested_response=result.get("suggested_response"),
                response_priority=result.get("response_priority", "normal")
            )

        except Exception as e:
            logger.error(f"Review analysis failed: {e}")
            return ReviewAnalysisResult(
                success=False,
                error=str(e)
            )

    async def batch_analyze(
        self,
        messages: List[Dict[str, str]],
        use_ai: bool = False
    ) -> List[SentimentResult]:
        """
        Analyze multiple messages (uses quick analysis for speed).

        Args:
            messages: List of {"text": "message", "id": "optional_id"}
            use_ai: Whether to use AI (slower but more accurate)

        Returns:
            List of SentimentResults
        """
        results = []
        for msg in messages:
            result = await self.analyze_message(
                message=msg.get("text", ""),
                use_ai=use_ai
            )
            result.message_id = msg.get("id")
            results.append(result)

        return results

    def should_escalate(self, result: SentimentResult) -> Tuple[bool, str]:
        """Determine if a message should be escalated to human."""
        if result.urgency == Urgency.CRITICAL:
            return True, "Critical urgency detected"

        if result.urgency == Urgency.HIGH:
            return True, "High urgency issue"

        if result.intent == Intent.EMERGENCY:
            return True, "Emergency situation"

        if result.intent == Intent.COMPLAINT and result.sentiment in [Sentiment.NEGATIVE, Sentiment.VERY_NEGATIVE]:
            return True, "Negative complaint requires attention"

        if result.requires_human:
            return True, result.escalation_reason or "AI flagged for human review"

        return False, ""

    def prioritize_messages(
        self,
        results: List[SentimentResult]
    ) -> List[SentimentResult]:
        """Sort messages by priority (most urgent first)."""
        urgency_order = {
            Urgency.CRITICAL: 0,
            Urgency.HIGH: 1,
            Urgency.NORMAL: 2,
            Urgency.LOW: 3
        }

        return sorted(results, key=lambda r: (
            urgency_order.get(r.urgency, 2),
            -r.sentiment_score  # More negative first
        ))


# Singleton instance
sentiment_service = SentimentAnalysisService()


# Quick helper functions
async def analyze_sentiment(text: str) -> SentimentResult:
    """Quick sentiment analysis."""
    return await sentiment_service.analyze_message(text, use_ai=False)


async def analyze_with_ai(text: str, context: Dict = None) -> SentimentResult:
    """Full AI sentiment analysis."""
    return await sentiment_service.analyze_message(text, context=context, use_ai=True)


async def analyze_review(review: str, rating: int = None) -> ReviewAnalysisResult:
    """Analyze a guest review."""
    return await sentiment_service.analyze_review(review, rating)


def quick_check(text: str) -> Tuple[str, float, str]:
    """Very fast keyword-based check. Returns (sentiment, score, urgency)."""
    sentiment, score, urgency = sentiment_service._quick_sentiment_check(text)
    return sentiment.value, score, urgency.value
