"""
Right at Home BnB - Sentiment Analysis Service
===============================================
AI-powered sentiment analysis for guest communications.

Features:
- Guest message mood detection
- Urgency level assessment
- Auto-escalation rules
- Topic extraction
- Response recommendations
- Trend analysis

@author ECHO OMEGA PRIME
@owner Steven Palma - Right at Home BnB, Midland, TX
"""

import os
import json
import re
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from loguru import logger
from openai import AsyncOpenAI

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class Sentiment(str, Enum):
    """Sentiment categories."""
    VERY_POSITIVE = "very_positive"
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    VERY_NEGATIVE = "very_negative"


class Urgency(str, Enum):
    """Urgency levels for messages."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Topic(str, Enum):
    """Common message topics."""
    CHECKIN = "check_in"
    CHECKOUT = "checkout"
    AMENITIES = "amenities"
    WIFI = "wifi"
    CLEANLINESS = "cleanliness"
    MAINTENANCE = "maintenance"
    NOISE = "noise"
    NEIGHBORS = "neighbors"
    BILLING = "billing"
    CANCELLATION = "cancellation"
    EXTENSION = "extension"
    EMERGENCY = "emergency"
    COMPLIMENT = "compliment"
    COMPLAINT = "complaint"
    QUESTION = "question"
    BOOKING = "booking"
    RECOMMENDATION = "recommendation"
    OTHER = "other"


class EscalationLevel(str, Enum):
    """Escalation levels."""
    NONE = "none"
    NOTIFY = "notify"
    PRIORITY = "priority"
    URGENT = "urgent"
    IMMEDIATE = "immediate"


@dataclass
class SentimentResult:
    """Result of sentiment analysis."""
    sentiment: Sentiment
    sentiment_score: float  # -1.0 to 1.0
    urgency: Urgency
    topics: List[Topic]
    key_phrases: List[str]
    emotions: Dict[str, float]
    escalation_level: EscalationLevel
    recommended_response_tone: str
    auto_response_suggestion: str
    needs_human_review: bool
    confidence: float


# =============================================================================
# ESCALATION RULES
# =============================================================================

ESCALATION_RULES = {
    # Keywords that trigger immediate escalation
    "immediate": [
        "emergency", "911", "fire", "flood", "gas leak", "carbon monoxide",
        "break in", "intruder", "theft", "police", "ambulance", "hurt", "injured",
        "hospital", "danger", "unsafe", "locked out"
    ],
    # Keywords that trigger urgent escalation
    "urgent": [
        "broken", "not working", "no power", "no water", "no heat", "no ac",
        "air conditioning", "hot water", "leak", "flood", "bug", "pest",
        "roach", "mouse", "bed bug", "smell", "odor", "mold"
    ],
    # Keywords that trigger priority escalation
    "priority": [
        "dirty", "unclean", "disgusting", "horrible", "terrible", "worst",
        "refund", "compensation", "lawyer", "attorney", "sue", "bbb",
        "review", "one star", "never again", "scam"
    ],
    # Keywords that trigger notification
    "notify": [
        "problem", "issue", "concern", "disappointed", "unhappy", "frustrated",
        "confused", "late", "early", "change", "modify", "cancel"
    ]
}

# Auto-response templates by sentiment
AUTO_RESPONSES = {
    Sentiment.VERY_POSITIVE: "Thank you so much for your kind words! We're thrilled you're enjoying your stay at Right at Home. Please let us know if there's anything we can do to make your experience even better!",
    Sentiment.POSITIVE: "Thank you for reaching out! We're glad to hear things are going well. If you need anything at all, don't hesitate to ask.",
    Sentiment.NEUTRAL: "Thank you for your message. We're here to help with any questions or needs you may have. How can we assist you?",
    Sentiment.NEGATIVE: "We're sorry to hear about your experience. Your comfort is our priority, and we'd like to address this right away. Steven will be in touch shortly.",
    Sentiment.VERY_NEGATIVE: "We sincerely apologize for this situation. This is not the experience we want for our guests. Steven is being notified immediately and will contact you directly to resolve this."
}


class SentimentAnalysisService:
    """
    AI-powered sentiment analysis for guest communications.
    """

    def __init__(self):
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.temperature = 0.3
        self.max_tokens = 1000

    async def analyze(
        self,
        text: str,
        guest_name: Optional[str] = None,
        property_id: Optional[str] = None,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze the sentiment of a guest message.

        Args:
            text: Message text to analyze
            guest_name: Optional guest name for context
            property_id: Optional property for context
            context: Optional additional context

        Returns:
            Dict with sentiment analysis results
        """
        try:
            # Quick rule-based check for emergencies
            escalation = self._check_escalation_rules(text)
            if escalation == EscalationLevel.IMMEDIATE:
                return self._emergency_response(text, guest_name)

            # Build analysis prompt
            prompt = self._build_analysis_prompt(text, guest_name, context)

            # Call GPT for analysis
            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._system_prompt()},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )

            analysis_text = response.choices[0].message.content

            # Parse the analysis
            result = self._parse_analysis(analysis_text, text)

            # Determine if human review needed
            needs_review = (
                result.sentiment in [Sentiment.NEGATIVE, Sentiment.VERY_NEGATIVE] or
                result.urgency in [Urgency.HIGH, Urgency.CRITICAL] or
                result.escalation_level in [EscalationLevel.PRIORITY, EscalationLevel.URGENT, EscalationLevel.IMMEDIATE]
            )

            # Generate auto-response suggestion
            auto_response = self._generate_auto_response(result, guest_name)

            return {
                "success": True,
                "sentiment": result.sentiment.value,
                "sentiment_score": result.sentiment_score,
                "urgency": result.urgency.value,
                "topics": [t.value for t in result.topics],
                "key_phrases": result.key_phrases,
                "emotions": result.emotions,
                "escalation_level": result.escalation_level.value,
                "recommended_tone": result.recommended_response_tone,
                "auto_response": auto_response,
                "needs_human_review": needs_review,
                "confidence": result.confidence,
                "guest_name": guest_name,
                "property_id": property_id,
                "original_message": text,
                "tokens_used": {
                    "prompt": response.usage.prompt_tokens,
                    "completion": response.usage.completion_tokens,
                    "total": response.usage.total_tokens
                },
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Sentiment analysis error: {e}")
            # Fallback to rule-based analysis
            return self._fallback_analysis(text, guest_name)

    def _system_prompt(self) -> str:
        """System prompt for sentiment analysis."""
        return """You are a sentiment analysis expert for Right at Home BnB, a vacation rental company in Midland, Texas.

Analyze guest messages to determine:
1. SENTIMENT: very_positive, positive, neutral, negative, very_negative
2. SENTIMENT_SCORE: -1.0 (very negative) to 1.0 (very positive)
3. URGENCY: low, medium, high, critical
4. TOPICS: List relevant topics (check_in, checkout, amenities, wifi, cleanliness, maintenance, noise, neighbors, billing, cancellation, extension, emergency, compliment, complaint, question, booking, recommendation, other)
5. KEY_PHRASES: Important phrases from the message
6. EMOTIONS: Detected emotions with scores (happy, satisfied, frustrated, angry, confused, worried, grateful, disappointed)
7. RESPONSE_TONE: Recommended tone for response (warm, empathetic, apologetic, professional, urgent)
8. CONFIDENCE: Your confidence in this analysis (0.0-1.0)

Format your response as JSON:
{
    "sentiment": "string",
    "sentiment_score": number,
    "urgency": "string",
    "topics": ["string"],
    "key_phrases": ["string"],
    "emotions": {"emotion": score},
    "response_tone": "string",
    "confidence": number
}

Consider context like:
- Time sensitivity (early/late, deadlines)
- Safety concerns
- Guest satisfaction impact
- Potential for escalation
"""

    def _build_analysis_prompt(
        self,
        text: str,
        guest_name: Optional[str],
        context: Optional[str]
    ) -> str:
        """Build the analysis prompt."""
        parts = [f"Analyze this guest message:\n\n\"{text}\""]

        if guest_name:
            parts.append(f"\nGuest: {guest_name}")

        if context:
            parts.append(f"\nContext: {context}")

        return "\n".join(parts)

    def _check_escalation_rules(self, text: str) -> EscalationLevel:
        """Check text against escalation rules."""
        text_lower = text.lower()

        for word in ESCALATION_RULES["immediate"]:
            if word in text_lower:
                return EscalationLevel.IMMEDIATE

        for word in ESCALATION_RULES["urgent"]:
            if word in text_lower:
                return EscalationLevel.URGENT

        for word in ESCALATION_RULES["priority"]:
            if word in text_lower:
                return EscalationLevel.PRIORITY

        for word in ESCALATION_RULES["notify"]:
            if word in text_lower:
                return EscalationLevel.NOTIFY

        return EscalationLevel.NONE

    def _emergency_response(self, text: str, guest_name: Optional[str]) -> Dict[str, Any]:
        """Generate emergency response without waiting for AI."""
        return {
            "success": True,
            "sentiment": Sentiment.VERY_NEGATIVE.value,
            "sentiment_score": -1.0,
            "urgency": Urgency.CRITICAL.value,
            "topics": [Topic.EMERGENCY.value],
            "key_phrases": [],
            "emotions": {"worried": 1.0, "urgent": 1.0},
            "escalation_level": EscalationLevel.IMMEDIATE.value,
            "recommended_tone": "urgent",
            "auto_response": f"{'Hi ' + guest_name + ', ' if guest_name else ''}This appears to be an emergency. For immediate emergencies, please call 911. Steven has been notified and will contact you immediately. His direct number is (432) 559-1904.",
            "needs_human_review": True,
            "confidence": 1.0,
            "guest_name": guest_name,
            "original_message": text,
            "is_emergency": True,
            "timestamp": datetime.utcnow().isoformat()
        }

    def _parse_analysis(self, text: str, original_message: str) -> SentimentResult:
        """Parse GPT analysis into structured result."""
        try:
            # Try to parse as JSON
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found")

            # Map sentiment string to enum
            sentiment_map = {
                "very_positive": Sentiment.VERY_POSITIVE,
                "positive": Sentiment.POSITIVE,
                "neutral": Sentiment.NEUTRAL,
                "negative": Sentiment.NEGATIVE,
                "very_negative": Sentiment.VERY_NEGATIVE
            }

            # Map urgency string to enum
            urgency_map = {
                "low": Urgency.LOW,
                "medium": Urgency.MEDIUM,
                "high": Urgency.HIGH,
                "critical": Urgency.CRITICAL
            }

            # Map topics
            topic_map = {t.value: t for t in Topic}

            sentiment = sentiment_map.get(data.get("sentiment", "neutral"), Sentiment.NEUTRAL)
            urgency = urgency_map.get(data.get("urgency", "medium"), Urgency.MEDIUM)

            # Determine escalation based on sentiment and urgency
            escalation = self._check_escalation_rules(original_message)
            if escalation == EscalationLevel.NONE:
                if sentiment == Sentiment.VERY_NEGATIVE or urgency == Urgency.CRITICAL:
                    escalation = EscalationLevel.URGENT
                elif sentiment == Sentiment.NEGATIVE or urgency == Urgency.HIGH:
                    escalation = EscalationLevel.PRIORITY
                elif urgency == Urgency.MEDIUM:
                    escalation = EscalationLevel.NOTIFY

            return SentimentResult(
                sentiment=sentiment,
                sentiment_score=data.get("sentiment_score", 0.0),
                urgency=urgency,
                topics=[topic_map.get(t, Topic.OTHER) for t in data.get("topics", [])],
                key_phrases=data.get("key_phrases", []),
                emotions=data.get("emotions", {}),
                escalation_level=escalation,
                recommended_response_tone=data.get("response_tone", "professional"),
                auto_response_suggestion="",
                needs_human_review=False,
                confidence=data.get("confidence", 0.8)
            )

        except Exception as e:
            logger.warning(f"Failed to parse analysis: {e}")
            # Fallback to basic analysis
            return self._basic_sentiment(original_message)

    def _basic_sentiment(self, text: str) -> SentimentResult:
        """Basic sentiment analysis without AI."""
        text_lower = text.lower()

        # Positive indicators
        positive_words = ["thank", "great", "amazing", "wonderful", "love", "perfect",
                        "excellent", "awesome", "fantastic", "happy", "pleased"]
        # Negative indicators
        negative_words = ["bad", "terrible", "horrible", "hate", "awful", "worst",
                        "disappointed", "angry", "frustrated", "upset", "problem"]

        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)

        if positive_count > negative_count * 2:
            sentiment = Sentiment.VERY_POSITIVE
            score = 0.8
        elif positive_count > negative_count:
            sentiment = Sentiment.POSITIVE
            score = 0.4
        elif negative_count > positive_count * 2:
            sentiment = Sentiment.VERY_NEGATIVE
            score = -0.8
        elif negative_count > positive_count:
            sentiment = Sentiment.NEGATIVE
            score = -0.4
        else:
            sentiment = Sentiment.NEUTRAL
            score = 0.0

        return SentimentResult(
            sentiment=sentiment,
            sentiment_score=score,
            urgency=Urgency.MEDIUM,
            topics=[Topic.OTHER],
            key_phrases=[],
            emotions={},
            escalation_level=self._check_escalation_rules(text),
            recommended_response_tone="professional",
            auto_response_suggestion="",
            needs_human_review=sentiment in [Sentiment.NEGATIVE, Sentiment.VERY_NEGATIVE],
            confidence=0.5
        )

    def _generate_auto_response(
        self,
        result: SentimentResult,
        guest_name: Optional[str]
    ) -> str:
        """Generate auto-response suggestion."""
        base_response = AUTO_RESPONSES.get(result.sentiment, AUTO_RESPONSES[Sentiment.NEUTRAL])

        if guest_name:
            return f"Hi {guest_name}, {base_response}"

        return base_response

    def _fallback_analysis(self, text: str, guest_name: Optional[str]) -> Dict[str, Any]:
        """Fallback analysis when AI fails."""
        result = self._basic_sentiment(text)

        return {
            "success": True,
            "sentiment": result.sentiment.value,
            "sentiment_score": result.sentiment_score,
            "urgency": result.urgency.value,
            "topics": [t.value for t in result.topics],
            "key_phrases": [],
            "emotions": {},
            "escalation_level": result.escalation_level.value,
            "recommended_tone": "professional",
            "auto_response": self._generate_auto_response(result, guest_name),
            "needs_human_review": result.needs_human_review,
            "confidence": 0.5,
            "guest_name": guest_name,
            "original_message": text,
            "fallback_used": True,
            "timestamp": datetime.utcnow().isoformat()
        }

    async def analyze_conversation(
        self,
        messages: List[Dict[str, str]],
        guest_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze sentiment trend across a conversation.

        Args:
            messages: List of messages with 'role' and 'content'
            guest_name: Optional guest name

        Returns:
            Dict with conversation analysis
        """
        results = []
        sentiment_scores = []

        for msg in messages:
            if msg.get("role") == "guest":
                analysis = await self.analyze(msg.get("content", ""), guest_name)
                results.append(analysis)
                sentiment_scores.append(analysis.get("sentiment_score", 0))

        # Calculate trend
        if len(sentiment_scores) >= 2:
            trend = sentiment_scores[-1] - sentiment_scores[0]
            if trend > 0.3:
                trend_direction = "improving"
            elif trend < -0.3:
                trend_direction = "declining"
            else:
                trend_direction = "stable"
        else:
            trend_direction = "insufficient_data"

        # Overall sentiment
        avg_score = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0

        return {
            "success": True,
            "message_count": len(results),
            "average_sentiment_score": avg_score,
            "trend": trend_direction,
            "individual_analyses": results,
            "needs_attention": avg_score < -0.2 or trend_direction == "declining",
            "timestamp": datetime.utcnow().isoformat()
        }

    async def should_escalate(
        self,
        text: str,
        guest_history: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[bool, EscalationLevel, str]:
        """
        Determine if a message should be escalated.

        Args:
            text: Message text
            guest_history: Optional history of guest interactions

        Returns:
            Tuple of (should_escalate, level, reason)
        """
        analysis = await self.analyze(text)

        level = EscalationLevel(analysis.get("escalation_level", "none"))
        should_escalate = level in [
            EscalationLevel.PRIORITY,
            EscalationLevel.URGENT,
            EscalationLevel.IMMEDIATE
        ]

        reasons = []
        if analysis.get("urgency") in ["high", "critical"]:
            reasons.append(f"High urgency: {analysis.get('urgency')}")
        if analysis.get("sentiment") in ["negative", "very_negative"]:
            reasons.append(f"Negative sentiment: {analysis.get('sentiment')}")
        if analysis.get("is_emergency"):
            reasons.append("Emergency detected")

        reason = "; ".join(reasons) if reasons else "No escalation needed"

        return should_escalate, level, reason


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

sentiment_service = SentimentAnalysisService()


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

async def analyze_message(text: str, guest_name: Optional[str] = None) -> Dict[str, Any]:
    """Quick helper to analyze a message."""
    return await sentiment_service.analyze(text, guest_name)


async def get_sentiment(text: str) -> str:
    """Get just the sentiment of a message."""
    result = await sentiment_service.analyze(text)
    return result.get("sentiment", "neutral")


async def is_negative(text: str) -> bool:
    """Check if a message is negative."""
    result = await sentiment_service.analyze(text)
    return result.get("sentiment") in ["negative", "very_negative"]


async def needs_escalation(text: str) -> Tuple[bool, str]:
    """Check if a message needs escalation."""
    should_escalate, level, reason = await sentiment_service.should_escalate(text)
    return should_escalate, reason


async def get_auto_response(text: str, guest_name: Optional[str] = None) -> str:
    """Get an auto-response suggestion for a message."""
    result = await sentiment_service.analyze(text, guest_name)
    return result.get("auto_response", "")
