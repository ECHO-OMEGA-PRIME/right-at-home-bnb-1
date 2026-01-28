"""
Review Sentiment Analysis Service for Right at Home BnB
========================================================
NLP-based sentiment analysis for guest reviews using VADER and TextBlob.
Zero API costs - runs entirely locally.

Features:
- Sentiment scoring (-1 to 1)
- Topic extraction (cleanliness, location, amenities, communication)
- Issue detection
- Sentiment drift tracking over time
- Alert generation for negative reviews

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, date, timedelta
from dataclasses import dataclass, field
from enum import Enum
import re
from loguru import logger

# Use VADER for sentiment (specialized for social media/reviews)
try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    VADER_AVAILABLE = True
except ImportError:
    VADER_AVAILABLE = False
    logger.warning("vaderSentiment not installed. Install with: pip install vaderSentiment")

# Use TextBlob as fallback
try:
    from textblob import TextBlob
    TEXTBLOB_AVAILABLE = True
except ImportError:
    TEXTBLOB_AVAILABLE = False
    logger.warning("textblob not installed. Install with: pip install textblob")

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc


class SentimentLabel(str, Enum):
    """Sentiment classification labels."""
    VERY_POSITIVE = "very_positive"
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    VERY_NEGATIVE = "very_negative"


class ReviewTopic(str, Enum):
    """Key topics that can be mentioned in reviews."""
    CLEANLINESS = "cleanliness"
    LOCATION = "location"
    AMENITIES = "amenities"
    COMMUNICATION = "communication"
    CHECK_IN = "check_in"
    VALUE = "value"
    ACCURACY = "accuracy"
    COMFORT = "comfort"
    WIFI = "wifi"
    PARKING = "parking"
    NOISE = "noise"
    SAFETY = "safety"
    TEMPERATURE = "temperature"
    KITCHEN = "kitchen"
    BATHROOM = "bathroom"
    BEDS = "beds"
    HOST = "host"
    NEIGHBORHOOD = "neighborhood"


# Topic keyword mappings for extraction
TOPIC_KEYWORDS = {
    ReviewTopic.CLEANLINESS: [
        "clean", "dirty", "spotless", "dust", "stain", "filthy", "immaculate",
        "sanitary", "hygiene", "tidy", "mess", "pristine", "grimy", "fresh"
    ],
    ReviewTopic.LOCATION: [
        "location", "neighborhood", "area", "close", "nearby", "walking distance",
        "convenient", "central", "quiet street", "accessible", "downtown"
    ],
    ReviewTopic.AMENITIES: [
        "amenities", "pool", "hot tub", "gym", "washer", "dryer", "kitchen",
        "appliances", "tv", "netflix", "coffee", "essentials", "equipped"
    ],
    ReviewTopic.COMMUNICATION: [
        "communication", "responsive", "response", "message", "contact", "host",
        "reply", "available", "helpful", "quick", "answer", "reach"
    ],
    ReviewTopic.CHECK_IN: [
        "check-in", "check in", "checkin", "arrival", "key", "code", "lockbox",
        "instructions", "access", "enter", "door", "late check-in"
    ],
    ReviewTopic.VALUE: [
        "value", "price", "worth", "expensive", "cheap", "affordable", "deal",
        "money", "cost", "bargain", "overpriced"
    ],
    ReviewTopic.ACCURACY: [
        "accurate", "photos", "description", "expected", "advertised",
        "as shown", "misleading", "exactly", "pictures"
    ],
    ReviewTopic.COMFORT: [
        "comfortable", "cozy", "spacious", "cramped", "room", "space",
        "relaxing", "homey", "welcoming"
    ],
    ReviewTopic.WIFI: [
        "wifi", "wi-fi", "internet", "connection", "speed", "streaming",
        "work from home", "remote work"
    ],
    ReviewTopic.PARKING: [
        "parking", "garage", "driveway", "street parking", "car"
    ],
    ReviewTopic.NOISE: [
        "noise", "quiet", "loud", "peaceful", "noisy", "sound", "neighbor"
    ],
    ReviewTopic.SAFETY: [
        "safe", "security", "secure", "alarm", "lock", "neighborhood safety"
    ],
    ReviewTopic.TEMPERATURE: [
        "temperature", "ac", "air conditioning", "heat", "heating", "thermostat",
        "cold", "hot", "hvac", "warm"
    ],
    ReviewTopic.KITCHEN: [
        "kitchen", "cooking", "stove", "oven", "microwave", "refrigerator",
        "utensils", "pots", "pans", "dishes"
    ],
    ReviewTopic.BATHROOM: [
        "bathroom", "shower", "toilet", "towels", "water pressure",
        "hot water", "bath"
    ],
    ReviewTopic.BEDS: [
        "bed", "mattress", "sleep", "pillow", "sheets", "linens",
        "comfortable bed", "bedroom"
    ],
    ReviewTopic.HOST: [
        "host", "steven", "owner", "helpful", "accommodating", "friendly",
        "responsive host", "hospitality"
    ],
    ReviewTopic.NEIGHBORHOOD: [
        "neighborhood", "area", "restaurants", "shops", "stores", "walkable",
        "safe area", "residential"
    ]
}

# Positive and negative keywords for quick extraction
POSITIVE_KEYWORDS = [
    "amazing", "wonderful", "fantastic", "excellent", "perfect", "love", "loved",
    "beautiful", "clean", "comfortable", "spacious", "great", "best", "awesome",
    "recommend", "return", "thank you", "appreciate", "helpful", "spotless",
    "cozy", "friendly", "responsive", "convenient", "value", "exceeded",
    "immaculate", "pristine", "stellar", "outstanding", "superb", "delightful"
]

NEGATIVE_KEYWORDS = [
    "terrible", "awful", "horrible", "dirty", "filthy", "broken", "disappointed",
    "complaint", "refund", "never", "worst", "disgusting", "unacceptable",
    "rude", "ignore", "lied", "misleading", "noise", "loud", "uncomfortable",
    "cramped", "smell", "bug", "roach", "mold", "stain", "overpriced",
    "not as described", "false", "problems", "issues", "not working"
]

# Issue patterns for automatic detection
ISSUE_PATTERNS = [
    (r"(not|didn't|doesn't|wasn't|weren't)\s+work(ing)?", "equipment_not_working"),
    (r"(dirty|filthy|stain|mess)", "cleanliness_issue"),
    (r"(loud|noise|noisy)", "noise_issue"),
    (r"(bug|roach|pest|insect|ant)", "pest_issue"),
    (r"(smell|odor|stink)", "odor_issue"),
    (r"(broken|damaged|not working)", "maintenance_issue"),
    (r"(mold|mildew)", "mold_issue"),
    (r"(no hot water|cold water only)", "water_heater_issue"),
    (r"(ac|air conditioning).*(not|broken|didn't)", "hvac_issue"),
    (r"(heat|heating).*(not|broken|didn't)", "hvac_issue"),
    (r"(wifi|internet).*(slow|not|down)", "wifi_issue"),
    (r"(lock|door).*(not|broken|stuck)", "lock_issue"),
    (r"(wrong|inaccurate|misleading)\s+(photo|picture|description)", "accuracy_issue"),
]


@dataclass
class SentimentResult:
    """Result of sentiment analysis for a review."""
    sentiment_score: float  # -1.0 to 1.0
    sentiment_label: SentimentLabel
    topics: List[ReviewTopic]
    positive_keywords: List[str]
    negative_keywords: List[str]
    issues_detected: List[str]
    confidence: float
    analyzed_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sentiment_score": self.sentiment_score,
            "sentiment_label": self.sentiment_label.value,
            "topics": [t.value for t in self.topics],
            "positive_keywords": self.positive_keywords,
            "negative_keywords": self.negative_keywords,
            "issues_detected": self.issues_detected,
            "confidence": self.confidence,
            "analyzed_at": self.analyzed_at.isoformat()
        }


@dataclass
class SentimentTrend:
    """Sentiment trend over a time period."""
    property_id: str
    period_start: date
    period_end: date
    avg_sentiment: float
    review_count: int
    positive_count: int
    neutral_count: int
    negative_count: int
    top_topics: List[Tuple[str, int]]
    common_issues: List[Tuple[str, int]]
    drift_from_90d: Optional[float] = None


class ReviewSentimentService:
    """
    Service for analyzing guest review sentiment using local NLP.
    Uses VADER (preferred) or TextBlob for sentiment analysis.
    No external API calls - runs entirely locally.
    """

    def __init__(self):
        """Initialize sentiment analyzers."""
        self.vader = None
        if VADER_AVAILABLE:
            self.vader = SentimentIntensityAnalyzer()
            logger.info("VADER sentiment analyzer initialized")
        elif TEXTBLOB_AVAILABLE:
            logger.info("Using TextBlob for sentiment analysis (VADER not available)")
        else:
            logger.error("No sentiment analyzer available! Install vaderSentiment or textblob")

    def analyze_review(self, review_text: str, star_rating: Optional[int] = None) -> SentimentResult:
        """
        Analyze sentiment of a single review.

        Args:
            review_text: The review content to analyze
            star_rating: Optional star rating (1-5) to weight the analysis

        Returns:
            SentimentResult with full analysis
        """
        if not review_text or not review_text.strip():
            return SentimentResult(
                sentiment_score=0.0,
                sentiment_label=SentimentLabel.NEUTRAL,
                topics=[],
                positive_keywords=[],
                negative_keywords=[],
                issues_detected=[],
                confidence=0.0
            )

        text_lower = review_text.lower()

        # Get sentiment score
        sentiment_score, confidence = self._calculate_sentiment(review_text, star_rating)

        # Determine label from score
        sentiment_label = self._score_to_label(sentiment_score)

        # Extract topics mentioned
        topics = self._extract_topics(text_lower)

        # Extract positive/negative keywords found
        pos_found = [kw for kw in POSITIVE_KEYWORDS if kw in text_lower]
        neg_found = [kw for kw in NEGATIVE_KEYWORDS if kw in text_lower]

        # Detect issues
        issues = self._detect_issues(text_lower)

        return SentimentResult(
            sentiment_score=sentiment_score,
            sentiment_label=sentiment_label,
            topics=topics,
            positive_keywords=pos_found[:10],  # Limit to top 10
            negative_keywords=neg_found[:10],
            issues_detected=issues,
            confidence=confidence
        )

    def _calculate_sentiment(
        self,
        text: str,
        star_rating: Optional[int] = None
    ) -> Tuple[float, float]:
        """
        Calculate sentiment score using VADER or TextBlob.

        Returns:
            Tuple of (sentiment_score, confidence)
        """
        score = 0.0
        confidence = 0.5

        if self.vader:
            # VADER returns compound score from -1 to 1
            scores = self.vader.polarity_scores(text)
            score = scores['compound']

            # Confidence based on neutrality - more extreme = more confident
            confidence = min(0.95, 0.5 + abs(score) * 0.5)

        elif TEXTBLOB_AVAILABLE:
            # TextBlob returns polarity from -1 to 1
            blob = TextBlob(text)
            score = blob.sentiment.polarity
            # TextBlob also gives subjectivity
            confidence = min(0.9, 0.4 + blob.sentiment.subjectivity * 0.5)
        else:
            # Fallback: keyword counting
            text_lower = text.lower()
            pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in text_lower)
            neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text_lower)

            total = pos_count + neg_count
            if total > 0:
                score = (pos_count - neg_count) / total
                confidence = min(0.8, 0.3 + (total * 0.05))

        # Weight with star rating if provided
        if star_rating is not None:
            # Convert 1-5 stars to -1 to 1
            star_score = (star_rating - 3) / 2.0
            # Blend: 70% NLP, 30% stars
            score = score * 0.7 + star_score * 0.3
            confidence = min(0.95, confidence + 0.1)

        return round(score, 3), round(confidence, 3)

    def _score_to_label(self, score: float) -> SentimentLabel:
        """Convert numeric score to sentiment label."""
        if score >= 0.6:
            return SentimentLabel.VERY_POSITIVE
        elif score >= 0.2:
            return SentimentLabel.POSITIVE
        elif score <= -0.6:
            return SentimentLabel.VERY_NEGATIVE
        elif score <= -0.2:
            return SentimentLabel.NEGATIVE
        else:
            return SentimentLabel.NEUTRAL

    def _extract_topics(self, text_lower: str) -> List[ReviewTopic]:
        """Extract topics mentioned in the review."""
        topics = []
        for topic, keywords in TOPIC_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    if topic not in topics:
                        topics.append(topic)
                    break
        return topics

    def _detect_issues(self, text_lower: str) -> List[str]:
        """Detect specific issues mentioned in negative context."""
        issues = []
        for pattern, issue_type in ISSUE_PATTERNS:
            if re.search(pattern, text_lower, re.IGNORECASE):
                if issue_type not in issues:
                    issues.append(issue_type)
        return issues

    def batch_analyze(self, reviews: List[Dict[str, Any]]) -> List[SentimentResult]:
        """
        Analyze multiple reviews in batch.

        Args:
            reviews: List of dicts with 'text' and optional 'star_rating'

        Returns:
            List of SentimentResults
        """
        results = []
        for review in reviews:
            result = self.analyze_review(
                review.get('text', ''),
                review.get('star_rating')
            )
            results.append(result)
        return results

    def calculate_sentiment_drift(
        self,
        db: Session,
        property_id: str,
        current_score: float,
        days_for_baseline: int = 90
    ) -> Tuple[float, bool]:
        """
        Calculate sentiment drift from historical baseline.

        Args:
            db: Database session
            property_id: Property to check
            current_score: Current review's sentiment score
            days_for_baseline: Days to look back for baseline

        Returns:
            Tuple of (drift_amount, is_alert_worthy)
        """
        from database.models_financial import ReviewSentimentAnalysis

        baseline_date = date.today() - timedelta(days=days_for_baseline)

        # Get baseline average
        result = db.query(
            func.avg(ReviewSentimentAnalysis.overall_sentiment)
        ).filter(
            ReviewSentimentAnalysis.property_id == property_id,
            ReviewSentimentAnalysis.review_date >= baseline_date
        ).scalar()

        if result is None:
            return 0.0, False

        baseline_avg = float(result)
        drift = current_score - baseline_avg

        # Alert if current is significantly worse than baseline
        is_alert = drift < -0.3  # More than 0.3 worse than average

        return round(drift, 3), is_alert

    def get_sentiment_trend(
        self,
        db: Session,
        property_id: Optional[str] = None,
        days: int = 90
    ) -> List[Dict[str, Any]]:
        """
        Get sentiment trend over time, grouped by week.

        Args:
            db: Database session
            property_id: Optional property filter
            days: Number of days to analyze

        Returns:
            List of weekly sentiment summaries
        """
        from database.models_financial import ReviewSentimentAnalysis

        start_date = date.today() - timedelta(days=days)

        query = db.query(
            func.date_trunc('week', ReviewSentimentAnalysis.review_date).label('week'),
            func.avg(ReviewSentimentAnalysis.overall_sentiment).label('avg_sentiment'),
            func.count(ReviewSentimentAnalysis.id).label('review_count'),
            func.sum(
                func.cast(ReviewSentimentAnalysis.sentiment_label == 'positive', Integer)
            ).label('positive_count'),
            func.sum(
                func.cast(ReviewSentimentAnalysis.sentiment_label == 'negative', Integer)
            ).label('negative_count')
        ).filter(
            ReviewSentimentAnalysis.review_date >= start_date
        )

        if property_id:
            query = query.filter(ReviewSentimentAnalysis.property_id == property_id)

        results = query.group_by('week').order_by('week').all()

        return [
            {
                "week": r.week.isoformat() if r.week else None,
                "avg_sentiment": round(float(r.avg_sentiment), 3) if r.avg_sentiment else 0,
                "review_count": r.review_count,
                "positive_count": r.positive_count or 0,
                "negative_count": r.negative_count or 0
            }
            for r in results
        ]

    def get_topic_breakdown(
        self,
        db: Session,
        property_id: Optional[str] = None,
        days: int = 90
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get sentiment breakdown by topic.

        Returns sentiment statistics for each topic mentioned in reviews.
        """
        from database.models_financial import ReviewSentimentAnalysis

        start_date = date.today() - timedelta(days=days)

        query = db.query(ReviewSentimentAnalysis).filter(
            ReviewSentimentAnalysis.review_date >= start_date,
            ReviewSentimentAnalysis.topics.isnot(None)
        )

        if property_id:
            query = query.filter(ReviewSentimentAnalysis.property_id == property_id)

        reviews = query.all()

        # Aggregate by topic
        topic_stats: Dict[str, Dict[str, Any]] = {}

        for review in reviews:
            topics = review.topics or []
            for topic in topics:
                if topic not in topic_stats:
                    topic_stats[topic] = {
                        "mention_count": 0,
                        "total_sentiment": 0.0,
                        "positive_mentions": 0,
                        "negative_mentions": 0
                    }

                topic_stats[topic]["mention_count"] += 1
                topic_stats[topic]["total_sentiment"] += review.overall_sentiment or 0

                if review.overall_sentiment and review.overall_sentiment > 0.2:
                    topic_stats[topic]["positive_mentions"] += 1
                elif review.overall_sentiment and review.overall_sentiment < -0.2:
                    topic_stats[topic]["negative_mentions"] += 1

        # Calculate averages
        for topic in topic_stats:
            count = topic_stats[topic]["mention_count"]
            if count > 0:
                topic_stats[topic]["avg_sentiment"] = round(
                    topic_stats[topic]["total_sentiment"] / count, 3
                )
            else:
                topic_stats[topic]["avg_sentiment"] = 0
            del topic_stats[topic]["total_sentiment"]

        return topic_stats

    def should_create_alert(
        self,
        sentiment_score: float,
        issues: List[str]
    ) -> Tuple[bool, str, str]:
        """
        Determine if a review should trigger an operational alert.

        Args:
            sentiment_score: The review's sentiment score
            issues: List of detected issues

        Returns:
            Tuple of (should_alert, severity, reason)
        """
        # Very negative review
        if sentiment_score < -0.6:
            return True, "critical", "Very negative review requires immediate attention"

        # Moderately negative with specific issues
        if sentiment_score < -0.3 and issues:
            issue_str = ", ".join(issues[:3])
            return True, "warning", f"Negative review mentioning: {issue_str}"

        # Specific critical issues regardless of overall sentiment
        critical_issues = ["pest_issue", "mold_issue", "safety_issue"]
        for issue in issues:
            if issue in critical_issues:
                return True, "critical", f"Critical issue detected: {issue}"

        return False, "", ""


# Global service instance
sentiment_service = ReviewSentimentService()


# Convenience functions
def analyze_review(text: str, star_rating: Optional[int] = None) -> SentimentResult:
    """Quick sentiment analysis of a review."""
    return sentiment_service.analyze_review(text, star_rating)


def batch_analyze_reviews(reviews: List[Dict]) -> List[SentimentResult]:
    """Batch analyze multiple reviews."""
    return sentiment_service.batch_analyze(reviews)


def get_sentiment_label(score: float) -> str:
    """Get sentiment label from score."""
    return sentiment_service._score_to_label(score).value


# Export all
__all__ = [
    'ReviewSentimentService',
    'SentimentResult',
    'SentimentTrend',
    'SentimentLabel',
    'ReviewTopic',
    'sentiment_service',
    'analyze_review',
    'batch_analyze_reviews',
    'get_sentiment_label',
    'POSITIVE_KEYWORDS',
    'NEGATIVE_KEYWORDS',
    'TOPIC_KEYWORDS'
]
