"""
Right At Home BnB - Alerts API Routes
=====================================
Admin endpoints for operational alerts management:
- GET /admin/alerts - List active alerts
- POST /admin/alerts/{id}/acknowledge - Acknowledge alert
- POST /admin/alerts/{id}/resolve - Resolve alert
- GET /admin/alerts/history - Alert history
- GET /admin/alerts/counts - Alert counts by priority/category
- POST /admin/alerts/process - Process auto-acknowledgments and escalations

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from pydantic import BaseModel, Field
from loguru import logger

from services.alert_service import (
    alert_service,
    AlertCategory,
    AlertPriority,
    Alert
)

router = APIRouter()


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class AlertResponse(BaseModel):
    """Alert response schema."""
    id: str
    category: str
    priority: str
    title: str
    description: str
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    trigger_data: Dict[str, Any] = {}
    is_active: bool = True
    is_acknowledged: bool = False
    acknowledged_at: Optional[str] = None
    acknowledged_by: Optional[str] = None
    auto_actions_taken: List[str] = []
    escalated: bool = False
    escalated_at: Optional[str] = None
    resolved: bool = False
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    created_at: str
    expires_at: Optional[str] = None

    @classmethod
    def from_alert(cls, alert: Alert) -> "AlertResponse":
        """Convert Alert object to response."""
        return cls(
            id=alert.id,
            category=alert.category.value,
            priority=alert.priority.value,
            title=alert.title,
            description=alert.description,
            property_id=alert.property_id,
            property_name=alert.property_name,
            trigger_data=alert.trigger_data,
            is_active=alert.is_active,
            is_acknowledged=alert.is_acknowledged,
            acknowledged_at=alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
            acknowledged_by=alert.acknowledged_by,
            auto_actions_taken=alert.auto_actions_taken,
            escalated=alert.escalated,
            escalated_at=alert.escalated_at.isoformat() if alert.escalated_at else None,
            resolved=alert.resolved,
            resolved_at=alert.resolved_at.isoformat() if alert.resolved_at else None,
            resolved_by=alert.resolved_by,
            resolution_notes=alert.resolution_notes,
            created_at=alert.created_at.isoformat(),
            expires_at=alert.expires_at.isoformat() if alert.expires_at else None
        )


class AlertListResponse(BaseModel):
    """List of alerts response."""
    success: bool = True
    alerts: List[AlertResponse]
    total: int
    timestamp: str


class AlertCountsResponse(BaseModel):
    """Alert counts response."""
    success: bool = True
    total: int
    critical_count: int
    high_count: int
    unacknowledged: int
    by_priority: Dict[str, int]
    by_category: Dict[str, int]
    timestamp: str


class AcknowledgeRequest(BaseModel):
    """Acknowledge alert request."""
    acknowledged_by: str = Field(default="admin", description="User acknowledging the alert")


class ResolveRequest(BaseModel):
    """Resolve alert request."""
    resolved_by: str = Field(default="admin", description="User resolving the alert")
    resolution_notes: Optional[str] = Field(None, description="Notes about the resolution")


class CreateAlertRequest(BaseModel):
    """Create alert request."""
    category: str = Field(..., description="Alert category")
    title: str = Field(..., description="Alert title")
    description: str = Field(..., description="Alert description")
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    priority: Optional[str] = None
    trigger_data: Optional[Dict[str, Any]] = None


class ProcessResponse(BaseModel):
    """Background process response."""
    success: bool = True
    auto_acknowledged: int = 0
    escalations: List[Dict[str, Any]] = []
    timestamp: str


# ============================================================================
# ROUTES
# ============================================================================

@router.get("/admin/alerts", response_model=AlertListResponse)
async def list_active_alerts(
    property_id: Optional[str] = Query(None, description="Filter by property ID"),
    category: Optional[str] = Query(None, description="Filter by category"),
    priority: Optional[str] = Query(None, description="Filter by priority (low, medium, high, critical)"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of alerts to return")
):
    """
    List all active (unresolved) alerts.

    Filters:
    - property_id: Filter to specific property
    - category: Filter by alert type (cleaner_late, pool_unsafe, etc.)
    - priority: Filter by priority level
    """
    try:
        # Convert string params to enums if provided
        category_enum = AlertCategory(category) if category else None
        priority_enum = AlertPriority(priority) if priority else None

        alerts = await alert_service.get_active_alerts(
            property_id=property_id,
            category=category_enum,
            priority=priority_enum,
            limit=limit
        )

        return AlertListResponse(
            success=True,
            alerts=[AlertResponse.from_alert(a) for a in alerts],
            total=len(alerts),
            timestamp=datetime.utcnow().isoformat()
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {str(e)}")
    except Exception as e:
        logger.error(f"Error listing alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/alerts/counts", response_model=AlertCountsResponse)
async def get_alert_counts():
    """
    Get counts of active alerts by priority and category.

    Returns aggregated counts useful for dashboard badges and summaries.
    """
    try:
        counts = await alert_service.get_alert_counts()

        return AlertCountsResponse(
            success=True,
            total=counts["total"],
            critical_count=counts["critical_count"],
            high_count=counts["high_count"],
            unacknowledged=counts["unacknowledged"],
            by_priority=counts["by_priority"],
            by_category=counts["by_category"],
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(f"Error getting alert counts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/alerts/history", response_model=AlertListResponse)
async def get_alert_history(
    property_id: Optional[str] = Query(None, description="Filter by property ID"),
    category: Optional[str] = Query(None, description="Filter by category"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of alerts to return")
):
    """
    Get resolved alert history.

    Useful for reviewing past alerts and response times.
    """
    try:
        category_enum = AlertCategory(category) if category else None
        start = date.fromisoformat(start_date) if start_date else None
        end = date.fromisoformat(end_date) if end_date else None

        alerts = await alert_service.get_alert_history(
            property_id=property_id,
            category=category_enum,
            start_date=start,
            end_date=end,
            limit=limit
        )

        return AlertListResponse(
            success=True,
            alerts=[AlertResponse.from_alert(a) for a in alerts],
            total=len(alerts),
            timestamp=datetime.utcnow().isoformat()
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {str(e)}")
    except Exception as e:
        logger.error(f"Error getting alert history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/alerts/{alert_id}", response_model=AlertResponse)
async def get_alert(alert_id: str):
    """Get a specific alert by ID."""
    try:
        alert = await alert_service.get_alert_by_id(alert_id)

        if not alert:
            raise HTTPException(status_code=404, detail=f"Alert not found: {alert_id}")

        return AlertResponse.from_alert(alert)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/alerts/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: str,
    request: AcknowledgeRequest = AcknowledgeRequest()
):
    """
    Acknowledge an alert.

    Acknowledging stops automatic escalation but keeps the alert active
    until it is resolved.
    """
    try:
        alert = await alert_service.acknowledge_alert(
            alert_id=alert_id,
            acknowledged_by=request.acknowledged_by
        )

        if not alert:
            raise HTTPException(status_code=404, detail=f"Alert not found: {alert_id}")

        logger.info(f"Alert {alert_id} acknowledged by {request.acknowledged_by}")

        return AlertResponse.from_alert(alert)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error acknowledging alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/alerts/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: str,
    request: ResolveRequest = ResolveRequest()
):
    """
    Resolve and close an alert.

    This marks the alert as inactive and moves it to history.
    """
    try:
        alert = await alert_service.resolve_alert(
            alert_id=alert_id,
            resolved_by=request.resolved_by,
            resolution_notes=request.resolution_notes
        )

        if not alert:
            raise HTTPException(status_code=404, detail=f"Alert not found: {alert_id}")

        logger.info(f"Alert {alert_id} resolved by {request.resolved_by}")

        return AlertResponse.from_alert(alert)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/alerts", response_model=AlertResponse)
async def create_alert(request: CreateAlertRequest):
    """
    Manually create a new alert.

    Most alerts are created automatically by triggers, but this endpoint
    allows manual alert creation for ad-hoc situations.
    """
    try:
        category_enum = AlertCategory(request.category)
        priority_enum = AlertPriority(request.priority) if request.priority else None

        alert = await alert_service.create_alert(
            category=category_enum,
            title=request.title,
            description=request.description,
            property_id=request.property_id,
            property_name=request.property_name,
            trigger_data=request.trigger_data,
            priority_override=priority_enum
        )

        logger.info(f"Manual alert created: {alert.id}")

        return AlertResponse.from_alert(alert)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid category: {str(e)}")
    except Exception as e:
        logger.error(f"Error creating alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/alerts/process", response_model=ProcessResponse)
async def process_alerts(background_tasks: BackgroundTasks):
    """
    Process auto-acknowledgments and escalations.

    This should be called periodically (e.g., every 5 minutes via cron)
    to handle:
    1. Auto-acknowledge alerts that have passed their time limit
    2. Escalate alerts that haven't been acknowledged in time
    """
    try:
        # Process auto-acknowledgments
        auto_ack_count = await alert_service.process_auto_acknowledgments()

        # Process escalations
        escalations = await alert_service.process_escalations()

        logger.info(f"Alert processing complete: {auto_ack_count} auto-acked, {len(escalations)} escalated")

        return ProcessResponse(
            success=True,
            auto_acknowledged=auto_ack_count,
            escalations=escalations,
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(f"Error processing alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# WEBHOOK ENDPOINTS FOR TRIGGERS
# ============================================================================

@router.post("/webhooks/cleaner-late")
async def webhook_cleaner_late(
    cleaner_id: str,
    cleaner_name: str,
    property_id: str,
    property_name: str,
    scheduled_time: str
):
    """
    Webhook endpoint for cleaner tracking service to report late cleaners.
    """
    try:
        scheduled = datetime.fromisoformat(scheduled_time)

        alert = await alert_service.create_cleaner_late_alert(
            cleaner_id=cleaner_id,
            cleaner_name=cleaner_name,
            property_id=property_id,
            property_name=property_name,
            scheduled_time=scheduled
        )

        if alert:
            return {"success": True, "alert_id": alert.id, "message": "Alert created"}
        return {"success": True, "alert_id": None, "message": "Cleaner not late enough for alert"}

    except Exception as e:
        logger.error(f"Cleaner late webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhooks/pool-status")
async def webhook_pool_status(
    property_id: str,
    property_name: str,
    metric: str,
    value: float,
    threshold: str,
    is_unsafe: bool = True
):
    """
    Webhook endpoint for pool monitoring to report unsafe conditions.
    """
    try:
        if not is_unsafe:
            return {"success": True, "alert_id": None, "message": "Pool status is safe"}

        alert = await alert_service.create_pool_unsafe_alert(
            property_id=property_id,
            property_name=property_name,
            metric=metric,
            value=value,
            threshold=threshold
        )

        return {"success": True, "alert_id": alert.id, "message": "Pool unsafe alert created"}

    except Exception as e:
        logger.error(f"Pool status webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhooks/review")
async def webhook_review(
    property_id: str,
    property_name: str,
    rating: int,
    review_text: str,
    platform: str = "unknown",
    guest_name: Optional[str] = None
):
    """
    Webhook endpoint for review monitoring to detect negative reviews.
    """
    try:
        alert = await alert_service.create_negative_review_alert(
            property_id=property_id,
            property_name=property_name,
            rating=rating,
            review_text=review_text,
            platform=platform,
            guest_name=guest_name
        )

        if alert:
            return {"success": True, "alert_id": alert.id, "message": "Negative review alert created"}
        return {"success": True, "alert_id": None, "message": "Review rating not negative"}

    except Exception as e:
        logger.error(f"Review webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhooks/weather")
async def webhook_weather(
    alert_type: str,
    description: str,
    severity: str,
    affected_properties: Optional[List[str]] = None
):
    """
    Webhook endpoint for weather service to report emergencies.
    """
    try:
        alert = await alert_service.create_weather_alert(
            alert_type=alert_type,
            description=description,
            severity=severity,
            affected_properties=affected_properties
        )

        return {"success": True, "alert_id": alert.id, "message": "Weather alert created"}

    except Exception as e:
        logger.error(f"Weather webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhooks/utility-spike")
async def webhook_utility_spike(
    property_id: str,
    property_name: str,
    utility_type: str,
    current_cost: float,
    average_cost: float,
    month: str
):
    """
    Webhook endpoint for utility monitoring to report cost spikes.
    """
    try:
        alert = await alert_service.create_utility_spike_alert(
            property_id=property_id,
            property_name=property_name,
            utility_type=utility_type,
            current_cost=current_cost,
            average_cost=average_cost,
            month=month
        )

        if alert:
            return {"success": True, "alert_id": alert.id, "message": "Utility spike alert created"}
        return {"success": True, "alert_id": None, "message": "Utility increase not significant"}

    except Exception as e:
        logger.error(f"Utility spike webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
