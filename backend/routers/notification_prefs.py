"""
Right At Home BnB - Notification Preferences API
================================================
API routes for managing notification preferences:
- GET/PUT notification preferences
- Notification history
- Test notifications
- Global settings management

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, time, timedelta
from enum import Enum
from loguru import logger
import uuid

from sqlalchemy.orm import Session
from database.connection import get_db
from database.models_notifications import (
    NotificationPreference,
    NotificationGlobalSettings,
    NotificationLog,
    NotificationTemplate,
    NotificationChannel,
    NotificationEventType,
    NotificationPriority,
    NotificationStatus,
    DEFAULT_PREFERENCES,
    get_default_preference,
)

# Import notification services
try:
    from services.twilio_sms import twilio_sms_service
    from services.twilio_voice import twilio_voice_service
    SMS_AVAILABLE = True
except ImportError:
    SMS_AVAILABLE = False

router = APIRouter()


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class ChannelPreference(BaseModel):
    """Preference for a single channel."""
    channel: NotificationChannel
    enabled: bool
    delay_minutes: int = 0


class EventPreferences(BaseModel):
    """Preferences for a single event type across all channels."""
    event_type: NotificationEventType
    email: bool = True
    sms: bool = True
    push: bool = True
    phone_call: bool = False


class NotificationPreferencesRequest(BaseModel):
    """Request to update notification preferences."""
    preferences: List[EventPreferences]


class NotificationPreferencesResponse(BaseModel):
    """Response containing all notification preferences."""
    user_id: str
    preferences: Dict[str, Dict[str, bool]]  # event_type -> channel -> enabled
    global_settings: Dict[str, Any]


class GlobalSettingsUpdate(BaseModel):
    """Request to update global notification settings."""
    email_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    phone_call_enabled: Optional[bool] = None

    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None  # HH:MM format
    quiet_hours_end: Optional[str] = None    # HH:MM format
    quiet_hours_timezone: Optional[str] = None

    emergency_override: Optional[bool] = None
    emergency_event_types: Optional[List[str]] = None

    digest_enabled: Optional[bool] = None
    digest_frequency: Optional[str] = None
    digest_time: Optional[str] = None  # HH:MM format

    notification_phone: Optional[str] = None
    backup_phone: Optional[str] = None
    notification_email: Optional[EmailStr] = None


class NotificationLogEntry(BaseModel):
    """Single notification log entry."""
    id: int
    event_type: str
    channel: str
    priority: str
    title: str
    body: str
    status: str
    created_at: datetime
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    recipient: Optional[str]
    error_message: Optional[str]
    booking_id: Optional[str]
    property_id: Optional[str]


class NotificationHistoryResponse(BaseModel):
    """Response containing notification history."""
    notifications: List[NotificationLogEntry]
    total: int
    page: int
    page_size: int
    has_more: bool


class TestNotificationRequest(BaseModel):
    """Request to send a test notification."""
    channel: NotificationChannel
    event_type: Optional[NotificationEventType] = None


class PreferenceMatrixCell(BaseModel):
    """Single cell in the preference matrix."""
    event_type: str
    channel: str
    enabled: bool
    delay_minutes: int = 0


class PreferenceMatrixResponse(BaseModel):
    """Complete preference matrix for UI."""
    user_id: str
    matrix: List[PreferenceMatrixCell]
    event_types: List[Dict[str, str]]  # {value, label, category}
    channels: List[Dict[str, str]]     # {value, label, icon}
    global_settings: Dict[str, Any]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def parse_time_string(time_str: str) -> time:
    """Parse HH:MM string to time object."""
    try:
        parts = time_str.split(":")
        return time(int(parts[0]), int(parts[1]))
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail=f"Invalid time format: {time_str}. Use HH:MM")


def get_or_create_global_settings(db: Session, user_id: str) -> NotificationGlobalSettings:
    """Get or create global notification settings for a user."""
    settings = db.query(NotificationGlobalSettings).filter(
        NotificationGlobalSettings.user_id == user_id
    ).first()

    if not settings:
        settings = NotificationGlobalSettings(user_id=user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


def initialize_default_preferences(db: Session, user_id: str) -> None:
    """Initialize default notification preferences for a new user."""
    for event_type, channel_defaults in DEFAULT_PREFERENCES.items():
        for channel, enabled in channel_defaults.items():
            existing = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user_id,
                NotificationPreference.event_type == event_type,
                NotificationPreference.channel == channel,
            ).first()

            if not existing:
                pref = NotificationPreference(
                    user_id=user_id,
                    event_type=event_type,
                    channel=channel,
                    enabled=enabled,
                )
                db.add(pref)

    db.commit()


def get_event_type_info() -> List[Dict[str, str]]:
    """Get metadata about event types for UI."""
    categories = {
        "booking": ["new_booking", "booking_cancelled", "booking_modified", "check_in_today", "check_out_today"],
        "cleaner": ["cleaner_assigned", "cleaner_started", "cleaner_completed", "cleaner_late", "cleaner_no_show"],
        "maintenance": ["maintenance_request", "maintenance_urgent", "maintenance_completed"],
        "guest": ["review_received", "guest_message", "guest_complaint"],
        "financial": ["payment_received", "payment_failed", "refund_issued", "payout_sent"],
        "property": ["smart_lock_issue", "thermostat_alert", "security_alert"],
        "reports": ["daily_briefing", "weekly_report", "monthly_report"],
    }

    labels = {
        "new_booking": "New Booking",
        "booking_cancelled": "Booking Cancelled",
        "booking_modified": "Booking Modified",
        "check_in_today": "Check-in Today",
        "check_out_today": "Check-out Today",
        "cleaner_assigned": "Cleaner Assigned",
        "cleaner_started": "Cleaner Started",
        "cleaner_completed": "Cleaner Completed",
        "cleaner_late": "Cleaner Late",
        "cleaner_no_show": "Cleaner No-Show",
        "maintenance_request": "Maintenance Request",
        "maintenance_urgent": "Urgent Maintenance",
        "maintenance_completed": "Maintenance Completed",
        "review_received": "Review Received",
        "guest_message": "Guest Message",
        "guest_complaint": "Guest Complaint",
        "payment_received": "Payment Received",
        "payment_failed": "Payment Failed",
        "refund_issued": "Refund Issued",
        "payout_sent": "Payout Sent",
        "smart_lock_issue": "Smart Lock Issue",
        "thermostat_alert": "Thermostat Alert",
        "security_alert": "Security Alert",
        "daily_briefing": "Daily Briefing",
        "weekly_report": "Weekly Report",
        "monthly_report": "Monthly Report",
    }

    result = []
    for category, events in categories.items():
        for event in events:
            result.append({
                "value": event,
                "label": labels.get(event, event.replace("_", " ").title()),
                "category": category,
            })

    return result


def get_channel_info() -> List[Dict[str, str]]:
    """Get metadata about channels for UI."""
    return [
        {"value": "email", "label": "Email", "icon": "Mail"},
        {"value": "sms", "label": "SMS", "icon": "MessageSquare"},
        {"value": "push", "label": "Push", "icon": "Bell"},
        {"value": "phone_call", "label": "Phone Call", "icon": "Phone"},
    ]


# ============================================================================
# API ROUTES
# ============================================================================

@router.get("/settings/notifications", response_model=PreferenceMatrixResponse)
async def get_notification_preferences(
    user_id: str = Query(default="owner-1", description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Get all notification preferences for a user.

    Returns a complete preference matrix showing which channels are enabled
    for each event type, plus global settings like quiet hours.
    """
    logger.info(f"Fetching notification preferences for user: {user_id}")

    # Get or create global settings
    global_settings = get_or_create_global_settings(db, user_id)

    # Get all preferences for this user
    preferences = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id
    ).all()

    # If no preferences exist, initialize defaults
    if not preferences:
        initialize_default_preferences(db, user_id)
        preferences = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id
        ).all()

    # Build matrix
    matrix = []
    for pref in preferences:
        matrix.append(PreferenceMatrixCell(
            event_type=pref.event_type.value,
            channel=pref.channel.value,
            enabled=pref.enabled,
            delay_minutes=pref.delay_minutes or 0,
        ))

    # Fill in missing combinations with defaults
    existing_combos = {(p.event_type.value, p.channel.value) for p in preferences}
    for event_type in NotificationEventType:
        for channel in NotificationChannel:
            if (event_type.value, channel.value) not in existing_combos:
                matrix.append(PreferenceMatrixCell(
                    event_type=event_type.value,
                    channel=channel.value,
                    enabled=get_default_preference(event_type, channel),
                    delay_minutes=0,
                ))

    # Build global settings dict
    global_dict = {
        "email_enabled": global_settings.email_enabled,
        "sms_enabled": global_settings.sms_enabled,
        "push_enabled": global_settings.push_enabled,
        "phone_call_enabled": global_settings.phone_call_enabled,
        "quiet_hours_enabled": global_settings.quiet_hours_enabled,
        "quiet_hours_start": global_settings.quiet_hours_start.strftime("%H:%M") if global_settings.quiet_hours_start else "22:00",
        "quiet_hours_end": global_settings.quiet_hours_end.strftime("%H:%M") if global_settings.quiet_hours_end else "07:00",
        "quiet_hours_timezone": global_settings.quiet_hours_timezone,
        "emergency_override": global_settings.emergency_override,
        "emergency_event_types": global_settings.emergency_event_types or [],
        "digest_enabled": global_settings.digest_enabled,
        "digest_frequency": global_settings.digest_frequency,
        "digest_time": global_settings.digest_time.strftime("%H:%M") if global_settings.digest_time else "08:00",
        "notification_phone": global_settings.notification_phone,
        "backup_phone": global_settings.backup_phone,
        "notification_email": global_settings.notification_email,
    }

    return PreferenceMatrixResponse(
        user_id=user_id,
        matrix=matrix,
        event_types=get_event_type_info(),
        channels=get_channel_info(),
        global_settings=global_dict,
    )


@router.put("/settings/notifications")
async def update_notification_preferences(
    preferences: List[PreferenceMatrixCell],
    user_id: str = Query(default="owner-1", description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Update notification preferences for a user.

    Accepts a list of preference matrix cells to update.
    """
    logger.info(f"Updating notification preferences for user: {user_id}")

    updated_count = 0
    for pref_cell in preferences:
        try:
            event_type = NotificationEventType(pref_cell.event_type)
            channel = NotificationChannel(pref_cell.channel)
        except ValueError as e:
            logger.warning(f"Invalid event_type or channel: {e}")
            continue

        # Find existing preference
        existing = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
            NotificationPreference.event_type == event_type,
            NotificationPreference.channel == channel,
        ).first()

        if existing:
            existing.enabled = pref_cell.enabled
            existing.delay_minutes = pref_cell.delay_minutes
        else:
            new_pref = NotificationPreference(
                user_id=user_id,
                event_type=event_type,
                channel=channel,
                enabled=pref_cell.enabled,
                delay_minutes=pref_cell.delay_minutes,
            )
            db.add(new_pref)

        updated_count += 1

    db.commit()
    logger.info(f"Updated {updated_count} notification preferences for user: {user_id}")

    return {
        "success": True,
        "message": f"Updated {updated_count} preferences",
        "user_id": user_id,
    }


@router.put("/settings/notifications/global")
async def update_global_settings(
    settings: GlobalSettingsUpdate,
    user_id: str = Query(default="owner-1", description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Update global notification settings for a user.

    Includes quiet hours, emergency override, and channel enables.
    """
    logger.info(f"Updating global notification settings for user: {user_id}")

    global_settings = get_or_create_global_settings(db, user_id)

    # Update fields that were provided
    if settings.email_enabled is not None:
        global_settings.email_enabled = settings.email_enabled
    if settings.sms_enabled is not None:
        global_settings.sms_enabled = settings.sms_enabled
    if settings.push_enabled is not None:
        global_settings.push_enabled = settings.push_enabled
    if settings.phone_call_enabled is not None:
        global_settings.phone_call_enabled = settings.phone_call_enabled

    if settings.quiet_hours_enabled is not None:
        global_settings.quiet_hours_enabled = settings.quiet_hours_enabled
    if settings.quiet_hours_start:
        global_settings.quiet_hours_start = parse_time_string(settings.quiet_hours_start)
    if settings.quiet_hours_end:
        global_settings.quiet_hours_end = parse_time_string(settings.quiet_hours_end)
    if settings.quiet_hours_timezone:
        global_settings.quiet_hours_timezone = settings.quiet_hours_timezone

    if settings.emergency_override is not None:
        global_settings.emergency_override = settings.emergency_override
    if settings.emergency_event_types is not None:
        global_settings.emergency_event_types = settings.emergency_event_types

    if settings.digest_enabled is not None:
        global_settings.digest_enabled = settings.digest_enabled
    if settings.digest_frequency:
        global_settings.digest_frequency = settings.digest_frequency
    if settings.digest_time:
        global_settings.digest_time = parse_time_string(settings.digest_time)

    if settings.notification_phone:
        global_settings.notification_phone = settings.notification_phone
    if settings.backup_phone:
        global_settings.backup_phone = settings.backup_phone
    if settings.notification_email:
        global_settings.notification_email = settings.notification_email

    db.commit()
    logger.info(f"Updated global notification settings for user: {user_id}")

    return {
        "success": True,
        "message": "Global settings updated",
        "user_id": user_id,
    }


@router.get("/notifications/history", response_model=NotificationHistoryResponse)
async def get_notification_history(
    user_id: str = Query(default="owner-1", description="User ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    channel: Optional[str] = Query(None, description="Filter by channel"),
    status: Optional[str] = Query(None, description="Filter by status"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    Get notification history for a user.

    Supports filtering by event type, channel, status, and date range.
    Results are paginated.
    """
    logger.info(f"Fetching notification history for user: {user_id}")

    # Build query
    query = db.query(NotificationLog).filter(NotificationLog.user_id == user_id)

    if event_type:
        try:
            query = query.filter(NotificationLog.event_type == NotificationEventType(event_type))
        except ValueError:
            pass

    if channel:
        try:
            query = query.filter(NotificationLog.channel == NotificationChannel(channel))
        except ValueError:
            pass

    if status:
        try:
            query = query.filter(NotificationLog.status == NotificationStatus(status))
        except ValueError:
            pass

    if start_date:
        query = query.filter(NotificationLog.created_at >= start_date)

    if end_date:
        query = query.filter(NotificationLog.created_at <= end_date)

    # Get total count
    total = query.count()

    # Apply pagination and ordering
    offset = (page - 1) * page_size
    notifications = query.order_by(NotificationLog.created_at.desc()).offset(offset).limit(page_size).all()

    # Convert to response format
    entries = []
    for n in notifications:
        entries.append(NotificationLogEntry(
            id=n.id,
            event_type=n.event_type.value,
            channel=n.channel.value,
            priority=n.priority.value if n.priority else "normal",
            title=n.title,
            body=n.body,
            status=n.status.value,
            created_at=n.created_at,
            sent_at=n.sent_at,
            delivered_at=n.delivered_at,
            recipient=n.recipient,
            error_message=n.error_message,
            booking_id=n.booking_id,
            property_id=n.property_id,
        ))

    return NotificationHistoryResponse(
        notifications=entries,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + page_size) < total,
    )


@router.post("/notifications/test")
async def send_test_notification(
    request: TestNotificationRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Query(default="owner-1", description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Send a test notification to verify settings.

    Sends a test notification via the specified channel.
    """
    logger.info(f"Sending test notification for user: {user_id}, channel: {request.channel}")

    global_settings = get_or_create_global_settings(db, user_id)

    # Create test notification log entry
    log_entry = NotificationLog(
        user_id=user_id,
        event_type=request.event_type or NotificationEventType.NEW_BOOKING,
        channel=request.channel,
        priority=NotificationPriority.NORMAL,
        title="Test Notification",
        body="This is a test notification from Right at Home BnB. If you received this, your notification settings are working correctly!",
        status=NotificationStatus.PENDING,
    )

    # Send based on channel
    if request.channel == NotificationChannel.SMS:
        if not SMS_AVAILABLE:
            log_entry.status = NotificationStatus.FAILED
            log_entry.error_message = "SMS service not available"
        elif not global_settings.notification_phone:
            log_entry.status = NotificationStatus.FAILED
            log_entry.error_message = "No notification phone number configured"
        else:
            log_entry.recipient = global_settings.notification_phone
            # Send SMS in background
            async def send_test_sms():
                result = await twilio_sms_service.send_sms(
                    global_settings.notification_phone,
                    log_entry.body
                )
                if result.success:
                    log_entry.status = NotificationStatus.SENT
                    log_entry.sent_at = datetime.utcnow()
                    log_entry.external_id = result.message_sid
                else:
                    log_entry.status = NotificationStatus.FAILED
                    log_entry.error_message = result.error
                db.add(log_entry)
                db.commit()

            background_tasks.add_task(send_test_sms)
            return {
                "success": True,
                "message": f"Test SMS queued for delivery to {global_settings.notification_phone}",
                "channel": request.channel.value,
            }

    elif request.channel == NotificationChannel.EMAIL:
        log_entry.recipient = global_settings.notification_email
        log_entry.status = NotificationStatus.QUEUED
        log_entry.skip_reason = "Email service integration pending"

    elif request.channel == NotificationChannel.PUSH:
        log_entry.status = NotificationStatus.QUEUED
        log_entry.skip_reason = "Push notification service integration pending"

    elif request.channel == NotificationChannel.PHONE_CALL:
        if not SMS_AVAILABLE:
            log_entry.status = NotificationStatus.FAILED
            log_entry.error_message = "Voice service not available"
        elif not global_settings.notification_phone:
            log_entry.status = NotificationStatus.FAILED
            log_entry.error_message = "No notification phone number configured"
        else:
            log_entry.recipient = global_settings.notification_phone
            # Place test call in background
            async def send_test_call():
                result = await twilio_voice_service.call_steven(
                    message="This is a test call from Right at Home B and B. Your phone call notifications are working correctly.",
                )
                if result.get("success"):
                    log_entry.status = NotificationStatus.SENT
                    log_entry.sent_at = datetime.utcnow()
                    log_entry.external_id = result.get("call_sid")
                else:
                    log_entry.status = NotificationStatus.FAILED
                    log_entry.error_message = result.get("error")
                db.add(log_entry)
                db.commit()

            background_tasks.add_task(send_test_call)
            return {
                "success": True,
                "message": f"Test phone call queued to {global_settings.notification_phone}",
                "channel": request.channel.value,
            }

    db.add(log_entry)
    db.commit()

    return {
        "success": log_entry.status != NotificationStatus.FAILED,
        "message": f"Test notification status: {log_entry.status.value}",
        "channel": request.channel.value,
        "log_id": log_entry.id,
        "error": log_entry.error_message,
    }


@router.get("/notifications/stats")
async def get_notification_stats(
    user_id: str = Query(default="owner-1", description="User ID"),
    days: int = Query(7, ge=1, le=90, description="Number of days to include"),
    db: Session = Depends(get_db)
):
    """
    Get notification statistics for a user.

    Returns counts by status, channel, and event type for the specified period.
    """
    logger.info(f"Fetching notification stats for user: {user_id}")

    start_date = datetime.utcnow() - timedelta(days=days)

    # Get all notifications in period
    notifications = db.query(NotificationLog).filter(
        NotificationLog.user_id == user_id,
        NotificationLog.created_at >= start_date,
    ).all()

    # Calculate stats
    total = len(notifications)
    by_status = {}
    by_channel = {}
    by_event_type = {}
    by_day = {}

    for n in notifications:
        # By status
        status = n.status.value
        by_status[status] = by_status.get(status, 0) + 1

        # By channel
        channel = n.channel.value
        by_channel[channel] = by_channel.get(channel, 0) + 1

        # By event type
        event = n.event_type.value
        by_event_type[event] = by_event_type.get(event, 0) + 1

        # By day
        day = n.created_at.strftime("%Y-%m-%d")
        by_day[day] = by_day.get(day, 0) + 1

    # Calculate delivery rate
    sent_count = by_status.get("sent", 0) + by_status.get("delivered", 0)
    failed_count = by_status.get("failed", 0) + by_status.get("bounced", 0)
    delivery_rate = (sent_count / total * 100) if total > 0 else 0

    return {
        "period_days": days,
        "total_notifications": total,
        "delivery_rate": round(delivery_rate, 1),
        "by_status": by_status,
        "by_channel": by_channel,
        "by_event_type": by_event_type,
        "by_day": by_day,
    }


@router.delete("/notifications/history/{notification_id}")
async def delete_notification_log(
    notification_id: int,
    user_id: str = Query(default="owner-1", description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Delete a notification log entry.

    Only the owner of the notification can delete it.
    """
    notification = db.query(NotificationLog).filter(
        NotificationLog.id == notification_id,
        NotificationLog.user_id == user_id,
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()

    return {
        "success": True,
        "message": "Notification deleted",
        "id": notification_id,
    }


@router.post("/notifications/bulk-update")
async def bulk_update_preferences(
    event_type: Optional[str] = Query(None, description="Event type to update"),
    channel: Optional[str] = Query(None, description="Channel to update"),
    enabled: bool = Query(..., description="Enable or disable"),
    user_id: str = Query(default="owner-1", description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Bulk update notification preferences.

    Can update all preferences for a specific event type, channel, or both.
    """
    logger.info(f"Bulk updating preferences for user: {user_id}")

    query = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id
    )

    if event_type:
        try:
            query = query.filter(NotificationPreference.event_type == NotificationEventType(event_type))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid event type: {event_type}")

    if channel:
        try:
            query = query.filter(NotificationPreference.channel == NotificationChannel(channel))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid channel: {channel}")

    updated = query.update({"enabled": enabled})
    db.commit()

    return {
        "success": True,
        "message": f"Updated {updated} preferences to enabled={enabled}",
        "user_id": user_id,
        "event_type": event_type,
        "channel": channel,
    }
