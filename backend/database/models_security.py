"""
Right At Home BnB - Security Models
====================================
JWT session tracking and audit logging for data hardening.

Tables:
- UserSession: JWT session management with device fingerprinting
- AuditLog: Comprehensive action tracking with before/after state

@author ECHO OMEGA PRIME
@version 1.0.0
"""

from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime,
    Text, ForeignKey, Index, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from .connection import Base


# ============================================
# ENUMS
# ============================================

class AuditAction(str, enum.Enum):
    """Types of auditable actions."""
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    TOKEN_REFRESH = "token_refresh"
    SESSION_REVOKED = "session_revoked"
    PERMISSION_DENIED = "permission_denied"
    PASSWORD_CHANGE = "password_change"
    ROLE_CHANGE = "role_change"
    EXPORT = "export"
    IMPORT = "import"


class SessionStatus(str, enum.Enum):
    """Session lifecycle states."""
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    LOGGED_OUT = "logged_out"


# ============================================
# USER SESSION MODEL
# ============================================

class UserSession(Base):
    """
    Track JWT sessions for security and session management.
    Supports multiple active sessions per user with device fingerprinting.
    Integrates with Cloudflare Zero Trust for additional security context.
    """
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)

    # Session tokens
    session_token = Column(String(512), nullable=False, unique=True, index=True)
    refresh_token = Column(String(512), nullable=True, unique=True, index=True)
    token_family = Column(String(64), nullable=True)  # For refresh token rotation

    # Device information
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6
    user_agent = Column(String(500), nullable=True)
    device_fingerprint = Column(String(256), nullable=True, index=True)
    device_type = Column(String(50), nullable=True)  # mobile, desktop, tablet
    browser = Column(String(100), nullable=True)
    os = Column(String(100), nullable=True)

    # Cloudflare Zero Trust integration
    cf_access_token = Column(String(1000), nullable=True)
    cf_identity = Column(JSON, nullable=True)  # Cloudflare identity claims
    cf_ray_id = Column(String(100), nullable=True)  # Cloudflare Ray ID
    cf_country = Column(String(10), nullable=True)  # Two-letter country code
    cf_city = Column(String(100), nullable=True)

    # Session status
    status = Column(String(20), default=SessionStatus.ACTIVE.value, index=True)
    revoked_at = Column(DateTime, nullable=True)
    revoke_reason = Column(String(200), nullable=True)
    revoked_by = Column(String, nullable=True)  # Admin who revoked (if any)

    # Rate limiting tracking
    request_count = Column(Integer, default=0)
    last_request_at = Column(DateTime, nullable=True)
    rate_limit_exceeded_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    last_activity = Column(DateTime, nullable=True)

    # Indexes for common queries
    __table_args__ = (
        Index('idx_user_sessions_user_status', 'user_id', 'status'),
        Index('idx_user_sessions_expires', 'expires_at'),
        Index('idx_user_sessions_fingerprint', 'device_fingerprint'),
    )

    def __repr__(self) -> str:
        return f"<UserSession(id={self.id}, user_id={self.user_id}, status={self.status})>"

    @property
    def is_active(self) -> bool:
        """Check if session is currently active and not expired."""
        if self.status != SessionStatus.ACTIVE.value:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True

    def to_dict(self) -> dict:
        """Convert session to dictionary for API responses."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "device_type": self.device_type,
            "browser": self.browser,
            "os": self.os,
            "ip_address": self.ip_address,
            "location": {
                "country": self.cf_country,
                "city": self.cf_city
            } if self.cf_country else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "is_current": False  # Set by the API based on request context
        }


# ============================================
# AUDIT LOG MODEL
# ============================================

class AuditLog(Base):
    """
    Comprehensive audit logging for all sensitive operations.
    Captures before/after state for changes, request context,
    and Cloudflare security headers.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Actor information
    user_id = Column(String, nullable=True, index=True)  # Null for anonymous/system actions
    session_id = Column(Integer, ForeignKey("user_sessions.id"), nullable=True)
    user_role = Column(String(50), nullable=True)

    # Action details
    action = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)  # "booking", "waiver", "expense", etc.
    resource_id = Column(String, nullable=True, index=True)
    resource_name = Column(String(200), nullable=True)  # Human-readable identifier

    # State tracking
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    changes = Column(JSON, nullable=True)  # Diff of changes for easier querying

    # Request context
    ip_address = Column(String(45), nullable=True, index=True)
    user_agent = Column(String(500), nullable=True)
    request_method = Column(String(10), nullable=True)  # GET, POST, PUT, DELETE
    request_path = Column(String(500), nullable=True)
    request_id = Column(String(64), nullable=True, index=True)  # For request correlation

    # Cloudflare headers
    cf_ray = Column(String(100), nullable=True, index=True)  # Cloudflare Ray ID
    cf_country = Column(String(10), nullable=True)
    cf_ip_country = Column(String(10), nullable=True)
    cf_connecting_ip = Column(String(45), nullable=True)

    # Result
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    http_status_code = Column(Integer, nullable=True)

    # Additional metadata
    metadata = Column(JSON, nullable=True)  # Flexible field for extra context

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)
    duration_ms = Column(Integer, nullable=True)  # Request duration in milliseconds

    # Indexes for common queries
    __table_args__ = (
        Index('idx_audit_user_action', 'user_id', 'action'),
        Index('idx_audit_resource', 'resource_type', 'resource_id'),
        Index('idx_audit_created', 'created_at'),
        Index('idx_audit_action_resource', 'action', 'resource_type'),
    )

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, action={self.action}, resource={self.resource_type}/{self.resource_id})>"

    def to_dict(self) -> dict:
        """Convert audit log to dictionary for API responses."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_role": self.user_role,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "resource_name": self.resource_name,
            "before_state": self.before_state,
            "after_state": self.after_state,
            "changes": self.changes,
            "ip_address": self.ip_address,
            "cf_ray": self.cf_ray,
            "cf_country": self.cf_country,
            "success": self.success,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "duration_ms": self.duration_ms,
            "metadata": self.metadata
        }

    @classmethod
    def create_log(
        cls,
        action: str,
        resource_type: str,
        resource_id: str = None,
        user_id: str = None,
        session_id: int = None,
        user_role: str = None,
        before_state: dict = None,
        after_state: dict = None,
        ip_address: str = None,
        user_agent: str = None,
        request_method: str = None,
        request_path: str = None,
        request_id: str = None,
        cf_ray: str = None,
        cf_country: str = None,
        success: bool = True,
        error_message: str = None,
        metadata: dict = None
    ) -> "AuditLog":
        """Factory method to create an audit log entry."""
        # Calculate changes if both states provided
        changes = None
        if before_state and after_state:
            changes = {}
            all_keys = set(before_state.keys()) | set(after_state.keys())
            for key in all_keys:
                old_val = before_state.get(key)
                new_val = after_state.get(key)
                if old_val != new_val:
                    changes[key] = {"old": old_val, "new": new_val}

        return cls(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            session_id=session_id,
            user_role=user_role,
            before_state=before_state,
            after_state=after_state,
            changes=changes,
            ip_address=ip_address,
            user_agent=user_agent,
            request_method=request_method,
            request_path=request_path,
            request_id=request_id,
            cf_ray=cf_ray,
            cf_country=cf_country,
            success=success,
            error_message=error_message,
            metadata=metadata
        )
