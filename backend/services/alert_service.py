"""
Right At Home BnB - Operational Alerts Service
===============================================
Centralized alert management system for:
- Cleaner late alerts (1+ hours behind schedule)
- Pool unsafe status detection
- Negative review detection
- Booking gap approaching
- Weather emergency alerts
- Utility spike detection

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from enum import Enum
from dataclasses import dataclass, field
from loguru import logger
from sqlalchemy.orm import Session

# Firebase (optional)
try:
    import firebase_admin
    from firebase_admin import firestore
    db = firestore.client() if firebase_admin._apps else None
    FIREBASE_AVAILABLE = db is not None
except Exception:
    FIREBASE_AVAILABLE = False
    db = None


class AlertPriority(str, Enum):
    """Alert priority levels for escalation."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertCategory(str, Enum):
    """Categories mapping to AlertType in models."""
    CLEANER_LATE = "cleaner_late"
    POOL_UNSAFE = "pool_unsafe"
    NEGATIVE_REVIEW = "negative_review"
    BOOKING_GAP = "booking_gap"
    WEATHER_EMERGENCY = "weather_emergency"
    UTILITY_SPIKE = "utility_spike"
    MAINTENANCE_DUE = "maintenance_due"
    INVENTORY_LOW = "inventory_low"
    SMART_LOCK_ISSUE = "smart_lock_issue"
    GUEST_COMPLAINT = "guest_complaint"


@dataclass
class AlertConfig:
    """Configuration for alert auto-acknowledgment and escalation."""
    category: AlertCategory
    priority: AlertPriority
    auto_acknowledge_hours: Optional[int] = None
    escalate_after_minutes: Optional[int] = None
    notify_channels: List[str] = field(default_factory=lambda: ["app"])
    description_template: str = ""


# Alert configurations
ALERT_CONFIGS: Dict[AlertCategory, AlertConfig] = {
    AlertCategory.CLEANER_LATE: AlertConfig(
        category=AlertCategory.CLEANER_LATE,
        priority=AlertPriority.HIGH,
        auto_acknowledge_hours=None,  # Must be manually acknowledged
        escalate_after_minutes=30,
        notify_channels=["app", "sms"],
        description_template="Cleaner {cleaner_name} is {minutes_late} minutes late for {property_name}"
    ),
    AlertCategory.POOL_UNSAFE: AlertConfig(
        category=AlertCategory.POOL_UNSAFE,
        priority=AlertPriority.CRITICAL,
        auto_acknowledge_hours=None,
        escalate_after_minutes=15,
        notify_channels=["app", "sms", "call"],
        description_template="Pool at {property_name} has unsafe {metric}: {value} (normal: {threshold})"
    ),
    AlertCategory.NEGATIVE_REVIEW: AlertConfig(
        category=AlertCategory.NEGATIVE_REVIEW,
        priority=AlertPriority.HIGH,
        auto_acknowledge_hours=48,
        escalate_after_minutes=120,
        notify_channels=["app", "email"],
        description_template="New {rating}-star review for {property_name}: \"{preview}\""
    ),
    AlertCategory.BOOKING_GAP: AlertConfig(
        category=AlertCategory.BOOKING_GAP,
        priority=AlertPriority.MEDIUM,
        auto_acknowledge_hours=72,
        escalate_after_minutes=None,
        notify_channels=["app"],
        description_template="{nights}-night gap at {property_name} from {start_date} to {end_date}"
    ),
    AlertCategory.WEATHER_EMERGENCY: AlertConfig(
        category=AlertCategory.WEATHER_EMERGENCY,
        priority=AlertPriority.CRITICAL,
        auto_acknowledge_hours=24,
        escalate_after_minutes=10,
        notify_channels=["app", "sms", "call"],
        description_template="Weather alert for Midland: {alert_type} - {description}"
    ),
    AlertCategory.UTILITY_SPIKE: AlertConfig(
        category=AlertCategory.UTILITY_SPIKE,
        priority=AlertPriority.MEDIUM,
        auto_acknowledge_hours=168,  # 1 week
        escalate_after_minutes=None,
        notify_channels=["app"],
        description_template="{property_name} utility spike: {utility_type} up {percentage}% vs average"
    ),
    AlertCategory.MAINTENANCE_DUE: AlertConfig(
        category=AlertCategory.MAINTENANCE_DUE,
        priority=AlertPriority.LOW,
        auto_acknowledge_hours=336,  # 2 weeks
        escalate_after_minutes=None,
        notify_channels=["app"],
        description_template="Maintenance due at {property_name}: {task_name}"
    ),
    AlertCategory.INVENTORY_LOW: AlertConfig(
        category=AlertCategory.INVENTORY_LOW,
        priority=AlertPriority.LOW,
        auto_acknowledge_hours=168,
        escalate_after_minutes=None,
        notify_channels=["app"],
        description_template="Low inventory at {property_name}: {item_name} ({current_qty}/{min_qty})"
    ),
    AlertCategory.SMART_LOCK_ISSUE: AlertConfig(
        category=AlertCategory.SMART_LOCK_ISSUE,
        priority=AlertPriority.HIGH,
        auto_acknowledge_hours=None,
        escalate_after_minutes=30,
        notify_channels=["app", "sms"],
        description_template="Smart lock issue at {property_name}: {issue_type}"
    ),
    AlertCategory.GUEST_COMPLAINT: AlertConfig(
        category=AlertCategory.GUEST_COMPLAINT,
        priority=AlertPriority.HIGH,
        auto_acknowledge_hours=None,
        escalate_after_minutes=60,
        notify_channels=["app", "sms"],
        description_template="Guest complaint at {property_name}: {summary}"
    ),
}


@dataclass
class Alert:
    """Alert data structure."""
    id: Optional[str] = None
    category: AlertCategory = AlertCategory.MAINTENANCE_DUE
    priority: AlertPriority = AlertPriority.LOW
    title: str = ""
    description: str = ""
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    trigger_data: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True
    is_acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    auto_actions_taken: List[str] = field(default_factory=list)
    escalated: bool = False
    escalated_at: Optional[datetime] = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None


class AlertService:
    """
    Operational alerts management service.
    Creates, tracks, and manages alerts across all properties.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.alerts_collection = "rah_operational_alerts"
        self.history_collection = "rah_alert_history"

    # =========================================================================
    # ALERT CREATION
    # =========================================================================

    async def create_alert(
        self,
        category: AlertCategory,
        title: str,
        description: str,
        property_id: Optional[str] = None,
        property_name: Optional[str] = None,
        trigger_data: Optional[Dict[str, Any]] = None,
        priority_override: Optional[AlertPriority] = None
    ) -> Alert:
        """
        Create a new operational alert.

        Args:
            category: Alert category (determines default priority and handling)
            title: Short alert title
            description: Detailed description
            property_id: Property ID if property-specific
            property_name: Property name for display
            trigger_data: Additional data about the trigger
            priority_override: Override the default priority for this category

        Returns:
            Created Alert object
        """
        config = ALERT_CONFIGS.get(category, ALERT_CONFIGS[AlertCategory.MAINTENANCE_DUE])

        alert = Alert(
            id=f"alert_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{category.value}",
            category=category,
            priority=priority_override or config.priority,
            title=title,
            description=description,
            property_id=property_id,
            property_name=property_name,
            trigger_data=trigger_data or {},
            created_at=datetime.utcnow(),
            expires_at=self._calculate_expiry(config)
        )

        # Store in Firebase
        if self.firebase_available and db:
            alert_data = self._alert_to_dict(alert)
            db.collection(self.alerts_collection).document(alert.id).set(alert_data)
            logger.info(f"Alert created: {alert.id} - {alert.title}")

        # Send notifications based on priority
        await self._send_notifications(alert, config)

        return alert

    async def create_cleaner_late_alert(
        self,
        cleaner_id: str,
        cleaner_name: str,
        property_id: str,
        property_name: str,
        scheduled_time: datetime,
        current_time: Optional[datetime] = None
    ) -> Optional[Alert]:
        """Create alert when cleaner is 1+ hours late."""
        current = current_time or datetime.utcnow()
        minutes_late = int((current - scheduled_time).total_seconds() / 60)

        if minutes_late < 60:
            return None  # Not late enough

        return await self.create_alert(
            category=AlertCategory.CLEANER_LATE,
            title=f"Cleaner Late: {property_name}",
            description=ALERT_CONFIGS[AlertCategory.CLEANER_LATE].description_template.format(
                cleaner_name=cleaner_name,
                minutes_late=minutes_late,
                property_name=property_name
            ),
            property_id=property_id,
            property_name=property_name,
            trigger_data={
                "cleaner_id": cleaner_id,
                "cleaner_name": cleaner_name,
                "scheduled_time": scheduled_time.isoformat(),
                "minutes_late": minutes_late
            }
        )

    async def create_pool_unsafe_alert(
        self,
        property_id: str,
        property_name: str,
        metric: str,
        value: float,
        threshold: str,
        reading_time: Optional[datetime] = None
    ) -> Alert:
        """Create alert for unsafe pool conditions."""
        return await self.create_alert(
            category=AlertCategory.POOL_UNSAFE,
            title=f"Pool Unsafe: {property_name}",
            description=ALERT_CONFIGS[AlertCategory.POOL_UNSAFE].description_template.format(
                property_name=property_name,
                metric=metric,
                value=value,
                threshold=threshold
            ),
            property_id=property_id,
            property_name=property_name,
            trigger_data={
                "metric": metric,
                "value": value,
                "threshold": threshold,
                "reading_time": (reading_time or datetime.utcnow()).isoformat()
            }
        )

    async def create_negative_review_alert(
        self,
        property_id: str,
        property_name: str,
        rating: int,
        review_text: str,
        platform: str = "unknown",
        guest_name: Optional[str] = None
    ) -> Optional[Alert]:
        """Create alert for negative reviews (3 stars or below)."""
        if rating > 3:
            return None  # Not a negative review

        preview = review_text[:100] + "..." if len(review_text) > 100 else review_text

        return await self.create_alert(
            category=AlertCategory.NEGATIVE_REVIEW,
            title=f"{rating}-Star Review: {property_name}",
            description=ALERT_CONFIGS[AlertCategory.NEGATIVE_REVIEW].description_template.format(
                rating=rating,
                property_name=property_name,
                preview=preview
            ),
            property_id=property_id,
            property_name=property_name,
            trigger_data={
                "rating": rating,
                "review_text": review_text,
                "platform": platform,
                "guest_name": guest_name
            },
            priority_override=AlertPriority.CRITICAL if rating <= 2 else AlertPriority.HIGH
        )

    async def create_booking_gap_alert(
        self,
        property_id: str,
        property_name: str,
        gap_start: date,
        gap_end: date,
        days_until_gap: int
    ) -> Optional[Alert]:
        """Create alert for approaching booking gaps (within 7 days)."""
        if days_until_gap > 7:
            return None  # Gap too far away

        nights = (gap_end - gap_start).days

        return await self.create_alert(
            category=AlertCategory.BOOKING_GAP,
            title=f"{nights}-Night Gap: {property_name}",
            description=ALERT_CONFIGS[AlertCategory.BOOKING_GAP].description_template.format(
                nights=nights,
                property_name=property_name,
                start_date=gap_start.strftime("%b %d"),
                end_date=gap_end.strftime("%b %d")
            ),
            property_id=property_id,
            property_name=property_name,
            trigger_data={
                "gap_start": gap_start.isoformat(),
                "gap_end": gap_end.isoformat(),
                "nights": nights,
                "days_until_gap": days_until_gap
            },
            priority_override=AlertPriority.HIGH if days_until_gap <= 3 else AlertPriority.MEDIUM
        )

    async def create_weather_alert(
        self,
        alert_type: str,
        description: str,
        severity: str,
        affected_properties: Optional[List[str]] = None,
        weather_data: Optional[Dict[str, Any]] = None
    ) -> Alert:
        """Create weather emergency alert."""
        priority = AlertPriority.CRITICAL
        if severity.lower() in ["moderate", "minor"]:
            priority = AlertPriority.HIGH

        return await self.create_alert(
            category=AlertCategory.WEATHER_EMERGENCY,
            title=f"Weather Alert: {alert_type}",
            description=ALERT_CONFIGS[AlertCategory.WEATHER_EMERGENCY].description_template.format(
                alert_type=alert_type,
                description=description
            ),
            property_id=None,  # Portfolio-wide
            property_name="All Properties",
            trigger_data={
                "alert_type": alert_type,
                "severity": severity,
                "affected_properties": affected_properties or [],
                "weather_data": weather_data or {}
            },
            priority_override=priority
        )

    async def create_utility_spike_alert(
        self,
        property_id: str,
        property_name: str,
        utility_type: str,
        current_cost: float,
        average_cost: float,
        month: str
    ) -> Optional[Alert]:
        """Create alert for utility cost spikes (20%+ above average)."""
        if average_cost <= 0:
            return None

        percentage = ((current_cost - average_cost) / average_cost) * 100

        if percentage < 20:
            return None  # Not a significant spike

        return await self.create_alert(
            category=AlertCategory.UTILITY_SPIKE,
            title=f"Utility Spike: {property_name}",
            description=ALERT_CONFIGS[AlertCategory.UTILITY_SPIKE].description_template.format(
                property_name=property_name,
                utility_type=utility_type,
                percentage=f"{percentage:.0f}"
            ),
            property_id=property_id,
            property_name=property_name,
            trigger_data={
                "utility_type": utility_type,
                "current_cost": current_cost,
                "average_cost": average_cost,
                "percentage_increase": percentage,
                "month": month
            },
            priority_override=AlertPriority.HIGH if percentage >= 50 else AlertPriority.MEDIUM
        )

    # =========================================================================
    # ALERT MANAGEMENT
    # =========================================================================

    async def get_active_alerts(
        self,
        property_id: Optional[str] = None,
        category: Optional[AlertCategory] = None,
        priority: Optional[AlertPriority] = None,
        limit: int = 50
    ) -> List[Alert]:
        """Get all active (unresolved) alerts."""
        if not self.firebase_available or not db:
            return self._get_demo_alerts()

        query = db.collection(self.alerts_collection).where("is_active", "==", True)

        if property_id:
            query = query.where("property_id", "==", property_id)
        if category:
            query = query.where("category", "==", category.value)
        if priority:
            query = query.where("priority", "==", priority.value)

        query = query.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)

        docs = query.stream()
        alerts = []
        for doc in docs:
            alert_data = doc.to_dict()
            alerts.append(self._dict_to_alert(alert_data))

        return alerts

    async def get_alert_by_id(self, alert_id: str) -> Optional[Alert]:
        """Get a specific alert by ID."""
        if not self.firebase_available or not db:
            return None

        doc = db.collection(self.alerts_collection).document(alert_id).get()
        if doc.exists:
            return self._dict_to_alert(doc.to_dict())
        return None

    async def acknowledge_alert(
        self,
        alert_id: str,
        acknowledged_by: str = "admin"
    ) -> Optional[Alert]:
        """Acknowledge an alert (stops escalation)."""
        if not self.firebase_available or not db:
            return None

        now = datetime.utcnow()

        db.collection(self.alerts_collection).document(alert_id).update({
            "is_acknowledged": True,
            "acknowledged_at": now.isoformat(),
            "acknowledged_by": acknowledged_by
        })

        logger.info(f"Alert acknowledged: {alert_id} by {acknowledged_by}")

        return await self.get_alert_by_id(alert_id)

    async def resolve_alert(
        self,
        alert_id: str,
        resolved_by: str = "admin",
        resolution_notes: Optional[str] = None
    ) -> Optional[Alert]:
        """Resolve and close an alert."""
        if not self.firebase_available or not db:
            return None

        now = datetime.utcnow()
        alert_data = {
            "is_active": False,
            "resolved": True,
            "resolved_at": now.isoformat(),
            "resolved_by": resolved_by,
            "resolution_notes": resolution_notes
        }

        if not (await self.get_alert_by_id(alert_id)).is_acknowledged:
            alert_data["is_acknowledged"] = True
            alert_data["acknowledged_at"] = now.isoformat()
            alert_data["acknowledged_by"] = resolved_by

        db.collection(self.alerts_collection).document(alert_id).update(alert_data)

        # Move to history
        alert = await self.get_alert_by_id(alert_id)
        if alert:
            db.collection(self.history_collection).add(self._alert_to_dict(alert))

        logger.info(f"Alert resolved: {alert_id} by {resolved_by}")

        return alert

    async def get_alert_history(
        self,
        property_id: Optional[str] = None,
        category: Optional[AlertCategory] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 100
    ) -> List[Alert]:
        """Get alert history (resolved alerts)."""
        if not self.firebase_available or not db:
            return []

        query = db.collection(self.history_collection)

        if property_id:
            query = query.where("property_id", "==", property_id)
        if category:
            query = query.where("category", "==", category.value)
        if start_date:
            query = query.where("created_at", ">=", start_date.isoformat())
        if end_date:
            query = query.where("created_at", "<=", end_date.isoformat())

        query = query.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)

        docs = query.stream()
        return [self._dict_to_alert(doc.to_dict()) for doc in docs]

    async def get_alert_counts(self) -> Dict[str, Any]:
        """Get counts of active alerts by priority and category."""
        alerts = await self.get_active_alerts(limit=500)

        by_priority = {p.value: 0 for p in AlertPriority}
        by_category = {c.value: 0 for c in AlertCategory}

        for alert in alerts:
            by_priority[alert.priority.value] += 1
            by_category[alert.category.value] += 1

        return {
            "total": len(alerts),
            "by_priority": by_priority,
            "by_category": by_category,
            "critical_count": by_priority.get("critical", 0),
            "high_count": by_priority.get("high", 0),
            "unacknowledged": sum(1 for a in alerts if not a.is_acknowledged)
        }

    # =========================================================================
    # AUTO-ACKNOWLEDGMENT & ESCALATION
    # =========================================================================

    async def process_auto_acknowledgments(self) -> int:
        """Auto-acknowledge alerts that have passed their time limit."""
        alerts = await self.get_active_alerts(limit=500)
        acknowledged_count = 0
        now = datetime.utcnow()

        for alert in alerts:
            if alert.is_acknowledged:
                continue

            config = ALERT_CONFIGS.get(alert.category)
            if not config or not config.auto_acknowledge_hours:
                continue

            hours_since_creation = (now - alert.created_at).total_seconds() / 3600

            if hours_since_creation >= config.auto_acknowledge_hours:
                await self.acknowledge_alert(
                    alert.id,
                    acknowledged_by="system_auto"
                )
                acknowledged_count += 1
                logger.info(f"Auto-acknowledged alert: {alert.id}")

        return acknowledged_count

    async def process_escalations(self) -> List[Dict[str, Any]]:
        """Check for alerts that need escalation."""
        alerts = await self.get_active_alerts(limit=500)
        escalations = []
        now = datetime.utcnow()

        for alert in alerts:
            if alert.is_acknowledged or alert.escalated:
                continue

            config = ALERT_CONFIGS.get(alert.category)
            if not config or not config.escalate_after_minutes:
                continue

            minutes_since_creation = (now - alert.created_at).total_seconds() / 60

            if minutes_since_creation >= config.escalate_after_minutes:
                # Mark as escalated
                if self.firebase_available and db:
                    db.collection(self.alerts_collection).document(alert.id).update({
                        "escalated": True,
                        "escalated_at": now.isoformat()
                    })

                # Trigger escalation actions
                escalation_result = await self._escalate_alert(alert, config)
                escalations.append({
                    "alert_id": alert.id,
                    "title": alert.title,
                    "escalation_actions": escalation_result
                })

                logger.warning(f"Alert escalated: {alert.id} - {alert.title}")

        return escalations

    async def _escalate_alert(
        self,
        alert: Alert,
        config: AlertConfig
    ) -> List[str]:
        """Perform escalation actions for an alert."""
        actions_taken = []

        # Send additional notifications
        if "sms" in config.notify_channels and "sms" not in alert.auto_actions_taken:
            # Would integrate with Twilio here
            actions_taken.append("sms_sent")

        if "call" in config.notify_channels and "call" not in alert.auto_actions_taken:
            # Would integrate with Twilio voice here
            actions_taken.append("call_initiated")

        # Update alert with actions taken
        if self.firebase_available and db:
            db.collection(self.alerts_collection).document(alert.id).update({
                "auto_actions_taken": firestore.ArrayUnion(actions_taken)
            })

        return actions_taken

    # =========================================================================
    # NOTIFICATIONS
    # =========================================================================

    async def _send_notifications(self, alert: Alert, config: AlertConfig) -> None:
        """Send notifications for a new alert."""
        actions_taken = []

        # Always send app notification
        if "app" in config.notify_channels:
            # Would integrate with push notification service
            actions_taken.append("app_notification")

        # For critical/high priority, also send SMS immediately
        if alert.priority in [AlertPriority.CRITICAL, AlertPriority.HIGH]:
            if "sms" in config.notify_channels:
                # Would integrate with Twilio
                actions_taken.append("sms_sent")

        # Update alert with initial actions
        if self.firebase_available and db and actions_taken:
            db.collection(self.alerts_collection).document(alert.id).update({
                "auto_actions_taken": actions_taken
            })

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def _calculate_expiry(self, config: AlertConfig) -> Optional[datetime]:
        """Calculate alert expiry time based on auto-acknowledge setting."""
        if config.auto_acknowledge_hours:
            return datetime.utcnow() + timedelta(hours=config.auto_acknowledge_hours * 2)
        return None

    def _alert_to_dict(self, alert: Alert) -> Dict[str, Any]:
        """Convert Alert to dictionary for storage."""
        return {
            "id": alert.id,
            "category": alert.category.value,
            "priority": alert.priority.value,
            "title": alert.title,
            "description": alert.description,
            "property_id": alert.property_id,
            "property_name": alert.property_name,
            "trigger_data": alert.trigger_data,
            "is_active": alert.is_active,
            "is_acknowledged": alert.is_acknowledged,
            "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
            "acknowledged_by": alert.acknowledged_by,
            "auto_actions_taken": alert.auto_actions_taken,
            "escalated": alert.escalated,
            "escalated_at": alert.escalated_at.isoformat() if alert.escalated_at else None,
            "resolved": alert.resolved,
            "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
            "resolved_by": alert.resolved_by,
            "resolution_notes": alert.resolution_notes,
            "created_at": alert.created_at.isoformat(),
            "expires_at": alert.expires_at.isoformat() if alert.expires_at else None
        }

    def _dict_to_alert(self, data: Dict[str, Any]) -> Alert:
        """Convert dictionary to Alert object."""
        return Alert(
            id=data.get("id"),
            category=AlertCategory(data.get("category", "maintenance_due")),
            priority=AlertPriority(data.get("priority", "low")),
            title=data.get("title", ""),
            description=data.get("description", ""),
            property_id=data.get("property_id"),
            property_name=data.get("property_name"),
            trigger_data=data.get("trigger_data", {}),
            is_active=data.get("is_active", True),
            is_acknowledged=data.get("is_acknowledged", False),
            acknowledged_at=datetime.fromisoformat(data["acknowledged_at"]) if data.get("acknowledged_at") else None,
            acknowledged_by=data.get("acknowledged_by"),
            auto_actions_taken=data.get("auto_actions_taken", []),
            escalated=data.get("escalated", False),
            escalated_at=datetime.fromisoformat(data["escalated_at"]) if data.get("escalated_at") else None,
            resolved=data.get("resolved", False),
            resolved_at=datetime.fromisoformat(data["resolved_at"]) if data.get("resolved_at") else None,
            resolved_by=data.get("resolved_by"),
            resolution_notes=data.get("resolution_notes"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.utcnow(),
            expires_at=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None
        )

    def _get_demo_alerts(self) -> List[Alert]:
        """Return demo alerts when Firebase is unavailable."""
        now = datetime.utcnow()
        return [
            Alert(
                id="alert_demo_001",
                category=AlertCategory.CLEANER_LATE,
                priority=AlertPriority.HIGH,
                title="Cleaner Late: Castleford Estate",
                description="Cleaner Maria Rodriguez is 75 minutes late for Castleford Estate",
                property_id="prop_001",
                property_name="Castleford Estate",
                trigger_data={"cleaner_name": "Maria Rodriguez", "minutes_late": 75},
                created_at=now - timedelta(hours=1, minutes=15)
            ),
            Alert(
                id="alert_demo_002",
                category=AlertCategory.NEGATIVE_REVIEW,
                priority=AlertPriority.HIGH,
                title="2-Star Review: Permian Palace",
                description='New 2-star review for Permian Palace: "The place was dirty and..."',
                property_id="prop_002",
                property_name="Permian Palace",
                trigger_data={"rating": 2, "platform": "VRBO"},
                created_at=now - timedelta(hours=3)
            ),
            Alert(
                id="alert_demo_003",
                category=AlertCategory.BOOKING_GAP,
                priority=AlertPriority.MEDIUM,
                title="3-Night Gap: Desert Star Lodge",
                description="3-night gap at Desert Star Lodge from Jan 25 to Jan 28",
                property_id="prop_003",
                property_name="Desert Star Lodge",
                trigger_data={"nights": 3, "days_until_gap": 5},
                created_at=now - timedelta(days=1)
            ),
            Alert(
                id="alert_demo_004",
                category=AlertCategory.WEATHER_EMERGENCY,
                priority=AlertPriority.CRITICAL,
                title="Weather Alert: Dust Storm",
                description="Weather alert for Midland: Dust Storm - Visibility below 1 mile expected",
                property_id=None,
                property_name="All Properties",
                trigger_data={"alert_type": "Dust Storm", "severity": "Severe"},
                created_at=now - timedelta(minutes=30)
            ),
        ]


# Singleton instance
alert_service = AlertService()


# Convenience functions
async def create_alert(
    category: AlertCategory,
    title: str,
    description: str,
    property_id: Optional[str] = None,
    **kwargs
) -> Alert:
    """Quick alert creation."""
    return await alert_service.create_alert(
        category=category,
        title=title,
        description=description,
        property_id=property_id,
        **kwargs
    )


async def get_active_alerts(**kwargs) -> List[Alert]:
    """Get active alerts."""
    return await alert_service.get_active_alerts(**kwargs)


async def acknowledge_alert(alert_id: str, by: str = "admin") -> Optional[Alert]:
    """Acknowledge an alert."""
    return await alert_service.acknowledge_alert(alert_id, by)


async def resolve_alert(alert_id: str, by: str = "admin", notes: str = None) -> Optional[Alert]:
    """Resolve an alert."""
    return await alert_service.resolve_alert(alert_id, by, notes)
