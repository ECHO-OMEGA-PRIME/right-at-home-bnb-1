"""
Review Sentiment Analysis Routes for Right at Home BnB
======================================================
Admin endpoints for review management, sentiment analysis,
and trend tracking.

Endpoints:
- GET /admin/reviews - List reviews with sentiment
- GET /admin/reviews/property/{id} - Property reviews
- GET /admin/reviews/sentiment/trend - Sentiment trend over time
- POST /admin/reviews/analyze - Trigger analysis for new review
- GET /admin/reviews/topics - Topic breakdown
- GET /admin/reviews/alerts - Negative review alerts

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
from loguru import logger

from database.connection import get_db
from database.models_financial import (
    ReviewSentimentAnalysis, OperationalAlert,
    AlertType, AlertSeverity
)
from database.models import Property, Guest, Booking
from services.sentiment_service import (
    sentiment_service, analyze_review, SentimentLabel, ReviewTopic
)
from services.review_import_service import (
    review_import_service, ImportResult
)

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class ReviewAnalyzeRequest(BaseModel):
    """Request to analyze a new review."""
    property_id: str
    review_text: str
    star_rating: Optional[int] = Field(None, ge=1, le=5)
    platform: Optional[str] = Field(None, description="airbnb, vrbo, direct, google")
    guest_name: Optional[str] = None
    review_date: Optional[date] = None
    external_review_id: Optional[str] = None


class ReviewAnalyzeResponse(BaseModel):
    """Response with analysis results."""
    id: int
    property_id: str
    sentiment_score: float
    sentiment_label: str
    topics: List[str]
    positive_keywords: List[str]
    negative_keywords: List[str]
    issues_detected: List[str]
    alert_created: bool
    alert_severity: Optional[str] = None


class ReviewListItem(BaseModel):
    """Review item for list views."""
    id: int
    property_id: str
    property_name: Optional[str] = None
    review_date: date
    platform: Optional[str] = None
    star_rating: Optional[int] = None
    sentiment_score: Optional[float] = None
    sentiment_label: Optional[str] = None
    topics: Optional[List[str]] = None
    issues: Optional[List[str]] = None
    review_text: Optional[str] = None
    has_alert: bool = False


class SentimentTrendItem(BaseModel):
    """Sentiment trend data point."""
    period: str  # YYYY-MM or YYYY-WW
    avg_sentiment: float
    review_count: int
    positive_count: int
    neutral_count: int
    negative_count: int


class TopicStats(BaseModel):
    """Statistics for a review topic."""
    topic: str
    mention_count: int
    avg_sentiment: float
    positive_mentions: int
    negative_mentions: int


class PortfolioSentimentStats(BaseModel):
    """Portfolio-wide sentiment statistics."""
    total_reviews: int
    avg_sentiment: float
    positive_percentage: float
    neutral_percentage: float
    negative_percentage: float
    reviews_this_month: int
    sentiment_vs_last_month: Optional[float] = None
    top_topics: List[TopicStats]
    common_issues: List[Dict[str, Any]]
    recent_negative_reviews: List[ReviewListItem]


class ReviewBulkAnalyzeRequest(BaseModel):
    """Request for bulk review analysis."""
    reviews: List[ReviewAnalyzeRequest]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_property_name(db: Session, property_id: str) -> Optional[str]:
    """Get property name by ID."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    return prop.name if prop else None


def create_alert_for_review(
    db: Session,
    review: ReviewSentimentAnalysis,
    severity: str,
    reason: str
) -> OperationalAlert:
    """Create an operational alert for a negative review."""
    alert = OperationalAlert(
        property_id=review.property_id,
        alert_type=AlertType.SENTIMENT_DRIFT,
        severity=AlertSeverity(severity.upper()) if severity in ['info', 'warning', 'critical', 'emergency'] else AlertSeverity.WARNING,
        title=f"Negative Review Alert - {review.platform or 'Unknown Platform'}",
        description=reason,
        trigger_data={
            "review_id": review.id,
            "sentiment_score": review.overall_sentiment,
            "sentiment_label": review.sentiment_label,
            "topics": review.topics,
            "issues": review.negative_keywords or [],
            "review_date": review.review_date.isoformat() if review.review_date else None
        },
        threshold_value=-0.3,
        actual_value=review.overall_sentiment,
        is_active=True
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


# ============================================================================
# ROUTES
# ============================================================================

@router.get("/admin/reviews", response_model=Dict[str, Any])
async def list_reviews(
    db: Session = Depends(get_db),
    property_id: Optional[str] = Query(None, description="Filter by property"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    sentiment: Optional[str] = Query(None, description="Filter by sentiment label"),
    min_score: Optional[float] = Query(None, ge=-1, le=1),
    max_score: Optional[float] = Query(None, ge=-1, le=1),
    has_issues: Optional[bool] = Query(None, description="Filter reviews with detected issues"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("date", regex="^(date|sentiment|rating)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$")
):
    """
    List reviews with sentiment analysis.

    Supports filtering by property, platform, sentiment, score range,
    issues detected, and date range. Results include full analysis data.
    """
    query = db.query(ReviewSentimentAnalysis)

    # Apply filters
    if property_id:
        query = query.filter(ReviewSentimentAnalysis.property_id == property_id)
    if platform:
        query = query.filter(ReviewSentimentAnalysis.platform == platform)
    if sentiment:
        query = query.filter(ReviewSentimentAnalysis.sentiment_label == sentiment)
    if min_score is not None:
        query = query.filter(ReviewSentimentAnalysis.overall_sentiment >= min_score)
    if max_score is not None:
        query = query.filter(ReviewSentimentAnalysis.overall_sentiment <= max_score)
    if has_issues:
        query = query.filter(
            ReviewSentimentAnalysis.negative_keywords.isnot(None),
            func.json_array_length(ReviewSentimentAnalysis.negative_keywords) > 0
        )
    if start_date:
        query = query.filter(ReviewSentimentAnalysis.review_date >= start_date)
    if end_date:
        query = query.filter(ReviewSentimentAnalysis.review_date <= end_date)

    # Get total count
    total = query.count()

    # Apply sorting
    if sort_by == "date":
        order_col = ReviewSentimentAnalysis.review_date
    elif sort_by == "sentiment":
        order_col = ReviewSentimentAnalysis.overall_sentiment
    else:
        order_col = ReviewSentimentAnalysis.star_rating

    if sort_order == "desc":
        query = query.order_by(desc(order_col))
    else:
        query = query.order_by(order_col)

    # Apply pagination
    reviews = query.offset(offset).limit(limit).all()

    # Build response
    items = []
    for r in reviews:
        items.append(ReviewListItem(
            id=r.id,
            property_id=r.property_id,
            property_name=get_property_name(db, r.property_id),
            review_date=r.review_date,
            platform=r.platform,
            star_rating=r.star_rating,
            sentiment_score=r.overall_sentiment,
            sentiment_label=r.sentiment_label,
            topics=r.topics,
            issues=r.negative_keywords,
            review_text=r.review_text[:200] + "..." if r.review_text and len(r.review_text) > 200 else r.review_text,
            has_alert=r.is_drift_alert or False
        ))

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "reviews": items
    }


@router.get("/admin/reviews/property/{property_id}", response_model=Dict[str, Any])
async def get_property_reviews(
    property_id: str,
    db: Session = Depends(get_db),
    days: int = Query(90, ge=1, le=365),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get reviews and sentiment statistics for a specific property.

    Returns recent reviews plus aggregated statistics including
    average sentiment, topic breakdown, and trend data.
    """
    start_date = date.today() - timedelta(days=days)

    # Get property info
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Get reviews
    reviews = db.query(ReviewSentimentAnalysis).filter(
        ReviewSentimentAnalysis.property_id == property_id,
        ReviewSentimentAnalysis.review_date >= start_date
    ).order_by(desc(ReviewSentimentAnalysis.review_date)).limit(limit).all()

    # Calculate statistics
    if reviews:
        avg_sentiment = sum(r.overall_sentiment or 0 for r in reviews) / len(reviews)
        avg_rating = sum(r.star_rating or 0 for r in reviews if r.star_rating) / max(1, sum(1 for r in reviews if r.star_rating))

        # Count by sentiment
        positive = sum(1 for r in reviews if r.overall_sentiment and r.overall_sentiment > 0.2)
        neutral = sum(1 for r in reviews if r.overall_sentiment and -0.2 <= r.overall_sentiment <= 0.2)
        negative = sum(1 for r in reviews if r.overall_sentiment and r.overall_sentiment < -0.2)
    else:
        avg_sentiment = 0
        avg_rating = 0
        positive = neutral = negative = 0

    # Get topic breakdown
    topic_breakdown = sentiment_service.get_topic_breakdown(db, property_id, days)

    # Get sentiment trend
    trend = sentiment_service.get_sentiment_trend(db, property_id, days)

    # Build review items
    review_items = [
        ReviewListItem(
            id=r.id,
            property_id=r.property_id,
            property_name=prop.name,
            review_date=r.review_date,
            platform=r.platform,
            star_rating=r.star_rating,
            sentiment_score=r.overall_sentiment,
            sentiment_label=r.sentiment_label,
            topics=r.topics,
            issues=r.negative_keywords,
            review_text=r.review_text,
            has_alert=r.is_drift_alert or False
        )
        for r in reviews
    ]

    return {
        "property_id": property_id,
        "property_name": prop.name,
        "period_days": days,
        "statistics": {
            "total_reviews": len(reviews),
            "avg_sentiment": round(avg_sentiment, 3),
            "avg_rating": round(avg_rating, 2),
            "positive_count": positive,
            "neutral_count": neutral,
            "negative_count": negative,
            "positive_percentage": round(positive / max(1, len(reviews)) * 100, 1),
            "negative_percentage": round(negative / max(1, len(reviews)) * 100, 1)
        },
        "topic_breakdown": topic_breakdown,
        "trend": trend,
        "reviews": review_items
    }


@router.get("/admin/reviews/sentiment/trend", response_model=Dict[str, Any])
async def get_sentiment_trend(
    db: Session = Depends(get_db),
    property_id: Optional[str] = Query(None),
    days: int = Query(90, ge=7, le=365),
    group_by: str = Query("week", regex="^(week|month)$")
):
    """
    Get sentiment trend over time.

    Returns sentiment data aggregated by week or month,
    showing average sentiment, review counts, and distribution.
    """
    start_date = date.today() - timedelta(days=days)

    # Base query
    if group_by == "week":
        period_col = func.date_trunc('week', ReviewSentimentAnalysis.review_date)
    else:
        period_col = func.date_trunc('month', ReviewSentimentAnalysis.review_date)

    query = db.query(
        period_col.label('period'),
        func.avg(ReviewSentimentAnalysis.overall_sentiment).label('avg_sentiment'),
        func.count(ReviewSentimentAnalysis.id).label('review_count'),
        func.avg(ReviewSentimentAnalysis.star_rating).label('avg_rating')
    ).filter(
        ReviewSentimentAnalysis.review_date >= start_date
    )

    if property_id:
        query = query.filter(ReviewSentimentAnalysis.property_id == property_id)

    results = query.group_by('period').order_by('period').all()

    trend_data = []
    for r in results:
        # Count sentiment distribution for this period
        period_start = r.period
        if group_by == "week":
            period_end = period_start + timedelta(days=7)
        else:
            period_end = period_start + timedelta(days=30)

        dist_query = db.query(
            func.count(ReviewSentimentAnalysis.id).label('count'),
            ReviewSentimentAnalysis.sentiment_label
        ).filter(
            ReviewSentimentAnalysis.review_date >= period_start,
            ReviewSentimentAnalysis.review_date < period_end
        )
        if property_id:
            dist_query = dist_query.filter(ReviewSentimentAnalysis.property_id == property_id)

        dist = {d.sentiment_label: d.count for d in dist_query.group_by(ReviewSentimentAnalysis.sentiment_label).all()}

        trend_data.append({
            "period": r.period.strftime("%Y-%m-%d") if r.period else None,
            "avg_sentiment": round(float(r.avg_sentiment), 3) if r.avg_sentiment else 0,
            "avg_rating": round(float(r.avg_rating), 2) if r.avg_rating else 0,
            "review_count": r.review_count,
            "positive_count": dist.get("positive", 0) + dist.get("very_positive", 0),
            "neutral_count": dist.get("neutral", 0),
            "negative_count": dist.get("negative", 0) + dist.get("very_negative", 0)
        })

    # Calculate overall trend (first vs last period)
    overall_trend = None
    if len(trend_data) >= 2:
        first_sentiment = trend_data[0]["avg_sentiment"]
        last_sentiment = trend_data[-1]["avg_sentiment"]
        overall_trend = round(last_sentiment - first_sentiment, 3)

    return {
        "property_id": property_id,
        "days": days,
        "group_by": group_by,
        "overall_trend": overall_trend,
        "trend_direction": "improving" if overall_trend and overall_trend > 0.1 else "declining" if overall_trend and overall_trend < -0.1 else "stable",
        "data": trend_data
    }


@router.post("/admin/reviews/analyze", response_model=ReviewAnalyzeResponse)
async def analyze_new_review(
    request: ReviewAnalyzeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Analyze a new review and store results.

    Performs NLP sentiment analysis, extracts topics and issues,
    calculates sentiment drift, and creates alerts if needed.
    """
    # Verify property exists
    prop = db.query(Property).filter(Property.id == request.property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Perform sentiment analysis
    result = analyze_review(request.review_text, request.star_rating)

    # Calculate drift
    drift, is_drift_alert = sentiment_service.calculate_sentiment_drift(
        db, request.property_id, result.sentiment_score
    )

    # Create database record
    review_analysis = ReviewSentimentAnalysis(
        property_id=request.property_id,
        review_date=request.review_date or date.today(),
        platform=request.platform,
        star_rating=request.star_rating,
        overall_sentiment=result.sentiment_score,
        sentiment_label=result.sentiment_label.value,
        topics=[t.value for t in result.topics],
        positive_keywords=result.positive_keywords,
        negative_keywords=result.negative_keywords,
        rolling_sentiment_90d=None,  # Will be calculated in background
        sentiment_drift=drift,
        is_drift_alert=is_drift_alert,
        review_text=request.review_text,
        ai_summary=None  # Could add AI summary later
    )
    db.add(review_analysis)
    db.commit()
    db.refresh(review_analysis)

    # Check if we need to create an alert
    alert_created = False
    alert_severity = None

    should_alert, severity, reason = sentiment_service.should_create_alert(
        result.sentiment_score, result.issues_detected
    )

    if should_alert or is_drift_alert:
        alert = create_alert_for_review(
            db, review_analysis,
            severity or "warning",
            reason or "Sentiment drift detected"
        )
        alert_created = True
        alert_severity = severity or "warning"
        logger.info(f"Created alert for review {review_analysis.id}: {reason}")

    return ReviewAnalyzeResponse(
        id=review_analysis.id,
        property_id=review_analysis.property_id,
        sentiment_score=result.sentiment_score,
        sentiment_label=result.sentiment_label.value,
        topics=[t.value for t in result.topics],
        positive_keywords=result.positive_keywords,
        negative_keywords=result.negative_keywords,
        issues_detected=result.issues_detected,
        alert_created=alert_created,
        alert_severity=alert_severity
    )


@router.post("/admin/reviews/analyze/bulk", response_model=Dict[str, Any])
async def bulk_analyze_reviews(
    request: ReviewBulkAnalyzeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Analyze multiple reviews in bulk.

    Useful for importing historical reviews from platforms.
    Returns summary of analysis results.
    """
    results = {
        "total": len(request.reviews),
        "analyzed": 0,
        "alerts_created": 0,
        "errors": []
    }

    for review_req in request.reviews:
        try:
            # Verify property
            prop = db.query(Property).filter(Property.id == review_req.property_id).first()
            if not prop:
                results["errors"].append({
                    "property_id": review_req.property_id,
                    "error": "Property not found"
                })
                continue

            # Analyze
            result = analyze_review(review_req.review_text, review_req.star_rating)

            # Calculate drift
            drift, is_drift_alert = sentiment_service.calculate_sentiment_drift(
                db, review_req.property_id, result.sentiment_score
            )

            # Create record
            review_analysis = ReviewSentimentAnalysis(
                property_id=review_req.property_id,
                review_date=review_req.review_date or date.today(),
                platform=review_req.platform,
                star_rating=review_req.star_rating,
                overall_sentiment=result.sentiment_score,
                sentiment_label=result.sentiment_label.value,
                topics=[t.value for t in result.topics],
                positive_keywords=result.positive_keywords,
                negative_keywords=result.negative_keywords,
                sentiment_drift=drift,
                is_drift_alert=is_drift_alert,
                review_text=review_req.review_text
            )
            db.add(review_analysis)

            # Check for alerts
            should_alert, severity, reason = sentiment_service.should_create_alert(
                result.sentiment_score, result.issues_detected
            )
            if should_alert or is_drift_alert:
                db.commit()
                db.refresh(review_analysis)
                create_alert_for_review(db, review_analysis, severity or "warning", reason or "Sentiment drift")
                results["alerts_created"] += 1

            results["analyzed"] += 1

        except Exception as e:
            logger.error(f"Error analyzing review: {e}")
            results["errors"].append({
                "property_id": review_req.property_id,
                "error": str(e)
            })

    db.commit()
    return results


@router.get("/admin/reviews/topics", response_model=Dict[str, Any])
async def get_topic_breakdown(
    db: Session = Depends(get_db),
    property_id: Optional[str] = Query(None),
    days: int = Query(90, ge=7, le=365)
):
    """
    Get sentiment breakdown by topic.

    Shows which topics are mentioned most frequently and
    their associated sentiment scores.
    """
    topic_stats = sentiment_service.get_topic_breakdown(db, property_id, days)

    # Sort by mention count
    sorted_topics = sorted(
        topic_stats.items(),
        key=lambda x: x[1]["mention_count"],
        reverse=True
    )

    return {
        "property_id": property_id,
        "days": days,
        "topics": [
            TopicStats(
                topic=topic,
                mention_count=stats["mention_count"],
                avg_sentiment=stats["avg_sentiment"],
                positive_mentions=stats["positive_mentions"],
                negative_mentions=stats["negative_mentions"]
            )
            for topic, stats in sorted_topics
        ]
    }


@router.get("/admin/reviews/alerts", response_model=Dict[str, Any])
async def get_review_alerts(
    db: Session = Depends(get_db),
    property_id: Optional[str] = Query(None),
    include_resolved: bool = Query(False),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Get operational alerts triggered by negative reviews.

    Returns active alerts sorted by severity and creation date.
    """
    query = db.query(OperationalAlert).filter(
        OperationalAlert.alert_type == AlertType.SENTIMENT_DRIFT
    )

    if property_id:
        query = query.filter(OperationalAlert.property_id == property_id)

    if not include_resolved:
        query = query.filter(OperationalAlert.is_active == True)

    # Sort by severity (critical first) then date
    alerts = query.order_by(
        desc(OperationalAlert.severity),
        desc(OperationalAlert.created_at)
    ).limit(limit).all()

    return {
        "total": len(alerts),
        "alerts": [
            {
                "id": a.id,
                "property_id": a.property_id,
                "property_name": get_property_name(db, a.property_id) if a.property_id else None,
                "severity": a.severity.value if a.severity else None,
                "title": a.title,
                "description": a.description,
                "trigger_data": a.trigger_data,
                "is_active": a.is_active,
                "is_acknowledged": a.is_acknowledged,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None
            }
            for a in alerts
        ]
    }


@router.post("/admin/reviews/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):
    """Acknowledge a review alert."""
    alert = db.query(OperationalAlert).filter(OperationalAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_acknowledged = True
    alert.acknowledged_at = datetime.utcnow()
    db.commit()

    return {"status": "acknowledged", "alert_id": alert_id}


@router.post("/admin/reviews/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    resolution: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Resolve a review alert."""
    alert = db.query(OperationalAlert).filter(OperationalAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_active = False
    alert.resolved_at = datetime.utcnow()
    if resolution:
        alert.manual_resolution = resolution
    db.commit()

    return {"status": "resolved", "alert_id": alert_id}


@router.get("/admin/reviews/portfolio/stats", response_model=PortfolioSentimentStats)
async def get_portfolio_sentiment_stats(
    db: Session = Depends(get_db),
    days: int = Query(30, ge=7, le=365)
):
    """
    Get portfolio-wide sentiment statistics.

    Returns aggregate sentiment data across all properties including
    distribution, trends, top topics, and recent negative reviews.
    """
    start_date = date.today() - timedelta(days=days)
    last_month_start = date.today() - timedelta(days=days * 2)

    # Get current period stats
    current_reviews = db.query(ReviewSentimentAnalysis).filter(
        ReviewSentimentAnalysis.review_date >= start_date
    ).all()

    # Get last period for comparison
    last_period_reviews = db.query(ReviewSentimentAnalysis).filter(
        ReviewSentimentAnalysis.review_date >= last_month_start,
        ReviewSentimentAnalysis.review_date < start_date
    ).all()

    if not current_reviews:
        return PortfolioSentimentStats(
            total_reviews=0,
            avg_sentiment=0,
            positive_percentage=0,
            neutral_percentage=0,
            negative_percentage=0,
            reviews_this_month=0,
            sentiment_vs_last_month=None,
            top_topics=[],
            common_issues=[],
            recent_negative_reviews=[]
        )

    # Calculate current stats
    total = len(current_reviews)
    avg_sentiment = sum(r.overall_sentiment or 0 for r in current_reviews) / total

    positive = sum(1 for r in current_reviews if r.overall_sentiment and r.overall_sentiment > 0.2)
    neutral = sum(1 for r in current_reviews if r.overall_sentiment and -0.2 <= (r.overall_sentiment or 0) <= 0.2)
    negative = sum(1 for r in current_reviews if r.overall_sentiment and r.overall_sentiment < -0.2)

    # Comparison with last period
    sentiment_vs_last = None
    if last_period_reviews:
        last_avg = sum(r.overall_sentiment or 0 for r in last_period_reviews) / len(last_period_reviews)
        sentiment_vs_last = round(avg_sentiment - last_avg, 3)

    # Get topic breakdown
    topic_stats = sentiment_service.get_topic_breakdown(db, None, days)
    top_topics = sorted(
        topic_stats.items(),
        key=lambda x: x[1]["mention_count"],
        reverse=True
    )[:10]

    # Get common issues from negative reviews
    issue_counts: Dict[str, int] = {}
    for r in current_reviews:
        if r.negative_keywords:
            for issue in r.negative_keywords:
                issue_counts[issue] = issue_counts.get(issue, 0) + 1

    common_issues = sorted(
        [{"issue": k, "count": v} for k, v in issue_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:10]

    # Get recent negative reviews
    negative_reviews = db.query(ReviewSentimentAnalysis).filter(
        ReviewSentimentAnalysis.review_date >= start_date,
        ReviewSentimentAnalysis.overall_sentiment < -0.2
    ).order_by(desc(ReviewSentimentAnalysis.review_date)).limit(10).all()

    recent_negative = [
        ReviewListItem(
            id=r.id,
            property_id=r.property_id,
            property_name=get_property_name(db, r.property_id),
            review_date=r.review_date,
            platform=r.platform,
            star_rating=r.star_rating,
            sentiment_score=r.overall_sentiment,
            sentiment_label=r.sentiment_label,
            topics=r.topics,
            issues=r.negative_keywords,
            review_text=r.review_text[:150] + "..." if r.review_text and len(r.review_text) > 150 else r.review_text,
            has_alert=r.is_drift_alert or False
        )
        for r in negative_reviews
    ]

    return PortfolioSentimentStats(
        total_reviews=total,
        avg_sentiment=round(avg_sentiment, 3),
        positive_percentage=round(positive / total * 100, 1),
        neutral_percentage=round(neutral / total * 100, 1),
        negative_percentage=round(negative / total * 100, 1),
        reviews_this_month=total,
        sentiment_vs_last_month=sentiment_vs_last,
        top_topics=[
            TopicStats(
                topic=topic,
                mention_count=stats["mention_count"],
                avg_sentiment=stats["avg_sentiment"],
                positive_mentions=stats["positive_mentions"],
                negative_mentions=stats["negative_mentions"]
            )
            for topic, stats in top_topics
        ],
        common_issues=common_issues,
        recent_negative_reviews=recent_negative
    )


# Export router
__all__ = ['router']
