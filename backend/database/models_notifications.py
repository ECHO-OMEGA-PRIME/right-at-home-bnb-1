"""
Right At Home BnB - Notification System Models
===============================================
Comprehensive notification preferences and logging:
- Per-user notification preferences by channel and event type
- Notification history and delivery tracking
- Quiet hours and emergency override settings

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, JSON,
    ForeignKey, Enum, Time, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, time
import enum

from .connection import Base


# ============================================================================
# ENUMS
# ============================================================================

class NotificationChannel(str, enum.Enum):
    """Channels through which notifications can be delivered."""
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    PHONE_CALL = "phone_call"  # For emergencies


class NotificationEventType(str, enum.Enum):
    """Types of events that can trigger notifications."""
    # Booking Events
    NEW_BOOKING = "new_booking"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_MODIFIED = "booking_modified"
    CHECK_IN_TODAY = "check_in_today"
    CHECK_OUT_TODAY = "check_out_today"

    # Cleaner Events
    CLEANER_ASSIGNED = "cleaner_assigned"
    CLEANER_STARTED = "cleaner_started"
    CLEANER_COMPLETED = "cleaner_completed"
    CLEANER_LATE = "cleaner_late"
    CLEANER_NO_SHOW = "cleaner_no_show"

    # Maintenance Events
    MAINTENANCE_REQUEST = "maintenance_request"
    MAINTENANCE_URGENT = "maintenance_urgent"
    MAINTENANCE_COMPLETED = "maintenance_completed"

    # Guest Events
    REVIEW_RECEIVED = "review_received"
    GUEST_MESSAGE = "guest_message"
    GUEST_COMPLAINT = "guest_complaint"

    # Financial Events
    PAYMENT_RECEIVED = "payment_received"
    PAYMENT_FAILED = "payment_failed"
    REFUND_ISSUED = "refund_issued"
    PAYOUT_SENT = "payout_sent"

    # Property Events
    SMART_LOCK_ISSUE = "smart_lock_issue"
    THERMOSTAT_ALERT = "thermostat_alert"
    SECURITY_ALERT = "security_alert"

    # System Events
    DAILY_BRIEFING = "daily_briefing"
    WEEKLY_REPORT = "weekly_report"
    MONTHLY_REPORT = "monthly_report"


class NotificationPriority(str, enum.Enum):
    """Priority levels for notifications."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class NotificationStatus(str, enum.Enum):
    """Delivery status of a notification."""
    PENDING = "pending"
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    BOUNCED = "bounced"
    SKIPPED = "skipped"  # Skipped due to quiet hours or user preference


# ============================================================================
# NOTIFICATION PREFERENCE MODEL
# ============================================================================

class NotificationPreference(Base):
    """
    User notification preferences per channel and event type.

    This model stores the preference matrix: for each user, whether they want
    to receive notifications for each event type via each channel.
    """
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), ForeignKey("users.id"), nullable=False, index=True)

    # What channel and event this preference applies to
    channel = Column(Enum(NotificationChannel), nullable=False)
    event_type = Column(Enum(NotificationEventType), nullable=False)

    # Is this notification enabled?
    enabled = Column(Boolean, default=True, nullable=False)

    # Optional: custom delay before sending (in minutes)
    # e.g., wait 5 minutes before sending "cleaner late" notification
    delay_minutes = Column(Integer, default=0)

    # Optional: only send if certain conditions met
    # e.g., {"min_amount": 500} for payments
    conditions = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Ensure unique combination of user, channel, and event type
    __table_args__ = (
        UniqueConstraint('user_id', 'channel', 'event_type', name='uq_user_channel_event'),
        Index('ix_notif_pref_user_event', 'user_id', 'event_type'),
    )


class NotificationGlobalSettings(Base):
    """
    Global notification settings per user.

    These are user-wide settings that apply across all notification types,
    such as quiet hours, emergency override, and default preferences.
    """
    __tablename__ = "notification_global_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), ForeignKey("users.id"), unique=True, nullable=False)

    # Global channel enables
    email_enabled = Column(Boolean, default=True)
    sms_enabled = Column(Boolean, default=True)
    push_enabled = Column(Boolean, default=True)
    phone_call_enabled = Column(Boolean, default=False)  # Off by default

    # Quiet hours settings
    quiet_hours_enabled = Column(Boolean, default=True)
    quiet_hours_start = Column(Time, default=time(22, 0))  # 10 PM
    quiet_hours_end = Column(Time, default=time(7, 0))     # 7 AM
    quiet_hours_timezone = Column(String(50), default="America/Chicago")

    # Emergency override - always deliver these even during quiet hours
    emergency_override = Column(Boolean, default=True)
    emergency_event_types = Column(JSON, default=lambda: [
        "maintenance_urgent",
        "security_alert",
        "guest_complaint",
        "cleaner_no_show"
    ])

    # Digest preferences
    digest_enabled = Column(Boolean, default=False)
    digest_frequency = Column(String(20), default="daily")  # daily, weekly
    digest_time = Column(Time, default=time(8, 0))  # 8 AM

    # Phone number for SMS/calls (may differ from profile)
    notification_phone = Column(String(20), nullable=True)
    backup_phone = Column(String(20), nullable=True)

    # Email for notifications (may differ from profile)
    notification_email = Column(String(255), nullable=True)

    # Push notification device tokens
    push_tokens = Column(JSON, default=list)  # List of device tokens

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


# ============================================================================
# NOTIFICATION LOG MODEL
# ============================================================================

class NotificationLog(Base):
    """
    Log of all notifications sent or attempted.

    This provides a complete audit trail of all notifications, their delivery
    status, and any errors that occurred.
    """
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Who this notification was for
    user_id = Column(String(100), ForeignKey("users.id"), nullable=False, index=True)

    # What notification
    event_type = Column(Enum(NotificationEventType), nullable=False, index=True)
    channel = Column(Enum(NotificationChannel), nullable=False)
    priority = Column(Enum(NotificationPriority), default=NotificationPriority.NORMAL)

    # Notification content
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    data = Column(JSON, nullable=True)  # Additional data payload

    # Related entities (optional)
    booking_id = Column(String(100), nullable=True, index=True)
    property_id = Column(String(100), nullable=True, index=True)
    guest_id = Column(String(100), nullable=True)
    cleaner_id = Column(String(100), nullable=True)

    # Delivery information
    status = Column(Enum(NotificationStatus), default=NotificationStatus.PENDING, index=True)

    # Timestamps for delivery tracking
    created_at = Column(DateTime, server_default=func.now(), index=True)
    queued_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)

    # For scheduled/delayed notifications
    scheduled_for = Column(DateTime, nullable=True)

    # Delivery details
    recipient = Column(String(255), nullable=True)  # Email address, phone number, etc.

    # External service tracking
    external_id = Column(String(255), nullable=True)  # Twilio SID, SendGrid ID, etc.
    external_status = Column(String(50), nullable=True)

    # Error tracking
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)

    # Was this notification opened/read? (for push/email tracking)
    opened_at = Column(DateTime, nullable=True)
    clicked_at = Column(DateTime, nullable=True)

    # Was delivery skipped? (quiet hours, disabled, etc.)
    skip_reason = Column(String(255), nullable=True)

    __table_args__ = (
        Index('ix_notif_log_user_created', 'user_id', 'created_at'),
        Index('ix_notif_log_status_created', 'status', 'created_at'),
        Index('ix_notif_log_event_created', 'event_type', 'created_at'),
    )


# ============================================================================
# NOTIFICATION TEMPLATE MODEL
# ============================================================================

class NotificationTemplate(Base):
    """
    Templates for notification content.

    These templates define the default content for each event type
    and can be customized per channel.
    """
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # What this template is for
    event_type = Column(Enum(NotificationEventType), nullable=False)
    channel = Column(Enum(NotificationChannel), nullable=False)

    # Template content
    title_template = Column(String(255), nullable=False)
    body_template = Column(Text, nullable=False)

    # For email: HTML template
    html_template = Column(Text, nullable=True)

    # Default priority for this event type
    default_priority = Column(Enum(NotificationPriority), default=NotificationPriority.NORMAL)

    # Is this template active?
    is_active = Column(Boolean, default=True)

    # Language/locale
    locale = Column(String(10), default="en-US")

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('event_type', 'channel', 'locale', name='uq_template_event_channel_locale'),
    )


# ============================================================================
# DEFAULT PREFERENCES HELPER
# ============================================================================

# Default preference matrix: which events should be enabled by default for which channels
DEFAULT_PREFERENCES = {
    # Event Type: {channel: enabled}
    NotificationEventType.NEW_BOOKING: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: True,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.BOOKING_CANCELLED: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: True,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.BOOKING_MODIFIED: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: False,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.CHECK_IN_TODAY: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: True,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.CHECK_OUT_TODAY: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: False,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.CLEANER_LATE: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: True,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.CLEANER_NO_SHOW: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: True,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: True,  # Emergency
    },
    NotificationEventType.MAINTENANCE_REQUEST: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: True,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.MAINTENANCE_URGENT: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: True,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: True,  # Emergency
    },
    NotificationEventType.REVIEW_RECEIVED: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: False,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.GUEST_MESSAGE: {
        NotificationChannel.EMAIL: False,
        NotificationChannel.SMS: True,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.GUEST_COMPLAINT: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: True,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.PAYMENT_RECEIVED: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: False,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.PAYMENT_FAILED: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: True,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: False,
    },
    NotificationEventType.SECURITY_ALERT: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: True,
        NotificationChannel.PUSH: True,
        NotificationChannel.PHONE_CALL: True,  # Emergency
    },
    NotificationEventType.DAILY_BRIEFING: {
        NotificationChannel.EMAIL: True,
        NotificationChannel.SMS: False,
        NotificationChannel.PUSH: False,
        NotificationChannel.PHONE_CALL: False,
    },
}


def get_default_preference(event_type: NotificationEventType, channel: NotificationChannel) -> bool:
    """Get the default preference for an event type and channel."""
    event_defaults = DEFAULT_PREFERENCES.get(event_type, {})
    return event_defaults.get(channel, False)
