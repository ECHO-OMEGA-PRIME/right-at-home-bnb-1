"""
Right At Home BnB - Audit Logging Middleware
============================================
Comprehensive audit logging for all sensitive operations:
- Logs all create, update, delete operations
- Captures before/after state for changes
- Stores IP, user agent, Cloudflare Ray ID
- Async logging to not block requests
- Decorator-based audit for specific routes

@author ECHO OMEGA PRIME
@version 1.0.0
"""

import asyncio
import time
import json
import secrets
from datetime import datetime
from typing import Optional, Dict, Any, Callable, List
from functools import wraps
from contextlib import asynccontextmanager

from fastapi import Request, Response, BackgroundTasks
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
from loguru import logger

from database.connection import SessionLocal
from database.models_security import AuditLog, AuditAction


# ============================================
# AUDIT SERVICE
# ============================================

class AuditService:
    """
    Centralized audit logging service.
    Supports both synchronous and asynchronous logging.
    """

    def __init__(self):
        self._queue: List[AuditLog] = []
        self._flush_interval = 5  # seconds
        self._max_queue_size = 100
        self._background_task_running = False

    # =========================================================================
    # CORE LOGGING METHODS
    # =========================================================================

    def log(
        self,
        db: Session,
        action: str,
        resource_type: str,
        resource_id: str = None,
        resource_name: str = None,
        user_id: str = None,
        session_id: int = None,
        user_role: str = None,
        before_state: Dict = None,
        after_state: Dict = None,
        ip_address: str = None,
        user_agent: str = None,
        request_method: str = None,
        request_path: str = None,
        request_id: str = None,
        cf_ray: str = None,
        cf_country: str = None,
        success: bool = True,
        error_message: str = None,
        duration_ms: int = None,
        metadata: Dict = None
    ) -> AuditLog:
        """
        Create an audit log entry synchronously.

        Args:
            db: Database session
            action: Action type (create, update, delete, etc.)
            resource_type: Type of resource (booking, waiver, expense, etc.)
            resource_id: ID of the resource
            resource_name: Human-readable name/identifier
            user_id: ID of the user performing the action
            session_id: Session ID if available
            user_role: User's role
            before_state: State before the change
            after_state: State after the change
            ip_address: Client IP address
            user_agent: Client user agent
            request_method: HTTP method
            request_path: Request path
            request_id: Unique request ID for correlation
            cf_ray: Cloudflare Ray ID
            cf_country: Cloudflare country code
            success: Whether the operation succeeded
            error_message: Error message if failed
            duration_ms: Operation duration in milliseconds
            metadata: Additional metadata

        Returns:
            Created AuditLog instance
        """
        audit_log = AuditLog.create_log(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            session_id=session_id,
            user_role=user_role,
            before_state=before_state,
            after_state=after_state,
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

        audit_log.resource_name = resource_name
        audit_log.duration_ms = duration_ms

        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)

        logger.debug(f"Audit: {action} on {resource_type}/{resource_id} by {user_id}")
        return audit_log

    async def log_async(
        self,
        action: str,
        resource_type: str,
        resource_id: str = None,
        **kwargs
    ) -> None:
        """
        Queue an audit log entry for async processing.
        Does not block the request.
        """
        audit_data = {
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            **kwargs
        }

        self._queue.append(audit_data)

        # Flush if queue is full
        if len(self._queue) >= self._max_queue_size:
            await self._flush_queue()

    async def _flush_queue(self) -> None:
        """Flush queued audit logs to database."""
        if not self._queue:
            return

        logs_to_write = self._queue.copy()
        self._queue.clear()

        db = SessionLocal()
        try:
            for log_data in logs_to_write:
                audit_log = AuditLog.create_log(**log_data)
                db.add(audit_log)
            db.commit()
            logger.debug(f"Flushed {len(logs_to_write)} audit logs")
        except Exception as e:
            logger.error(f"Failed to flush audit logs: {e}")
            db.rollback()
        finally:
            db.close()

    # =========================================================================
    # CONTEXT EXTRACTION
    # =========================================================================

    def extract_request_context(self, request: Request) -> Dict[str, Any]:
        """Extract audit-relevant information from a request."""
        context = {
            "ip_address": self._get_client_ip(request),
            "user_agent": request.headers.get("User-Agent", "")[:500],
            "request_method": request.method,
            "request_path": str(request.url.path),
            "request_id": request.headers.get("X-Request-ID") or secrets.token_hex(8),
            "cf_ray": request.headers.get("CF-Ray"),
            "cf_country": request.headers.get("CF-IPCountry"),
        }

        # Add user info if available
        if hasattr(request.state, "user") and request.state.user:
            context["user_id"] = request.state.user.get("sub")
            context["user_role"] = request.state.user.get("role")
            context["session_id"] = request.state.user.get("session_id")

        return context

    def _get_client_ip(self, request: Request) -> str:
        """Get the real client IP, checking Cloudflare and proxy headers."""
        # Cloudflare
        if cf_ip := request.headers.get("CF-Connecting-IP"):
            return cf_ip

        # X-Forwarded-For (take first IP)
        if forwarded := request.headers.get("X-Forwarded-For"):
            return forwarded.split(",")[0].strip()

        # X-Real-IP
        if real_ip := request.headers.get("X-Real-IP"):
            return real_ip

        # Direct connection
        return request.client.host if request.client else "unknown"

    # =========================================================================
    # QUERY METHODS
    # =========================================================================

    def get_logs(
        self,
        db: Session,
        user_id: str = None,
        resource_type: str = None,
        resource_id: str = None,
        action: str = None,
        start_date: datetime = None,
        end_date: datetime = None,
        success: bool = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditLog]:
        """Query audit logs with filters."""
        query = db.query(AuditLog)

        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        if resource_id:
            query = query.filter(AuditLog.resource_id == resource_id)
        if action:
            query = query.filter(AuditLog.action == action)
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        if success is not None:
            query = query.filter(AuditLog.success == success)

        return query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    def get_user_activity(
        self,
        db: Session,
        user_id: str,
        limit: int = 100
    ) -> List[AuditLog]:
        """Get all activity for a specific user."""
        return db.query(AuditLog).filter(
            AuditLog.user_id == user_id
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()

    def get_resource_history(
        self,
        db: Session,
        resource_type: str,
        resource_id: str
    ) -> List[AuditLog]:
        """Get complete audit history for a resource."""
        return db.query(AuditLog).filter(
            AuditLog.resource_type == resource_type,
            AuditLog.resource_id == resource_id
        ).order_by(AuditLog.created_at.asc()).all()

    def get_recent_failures(
        self,
        db: Session,
        limit: int = 50
    ) -> List[AuditLog]:
        """Get recent failed operations."""
        return db.query(AuditLog).filter(
            AuditLog.success == False
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()


# ============================================
# SINGLETON INSTANCE
# ============================================

audit_service = AuditService()


# ============================================
# DECORATOR FOR AUDIT LOGGING
# ============================================

def audit_action(
    action: str,
    resource_type: str,
    resource_id_param: str = None,
    get_before_state: Callable = None,
    get_after_state: Callable = None,
    get_resource_name: Callable = None
):
    """
    Decorator to automatically audit an endpoint.

    Args:
        action: Action type (create, update, delete)
        resource_type: Type of resource being modified
        resource_id_param: Name of the path/query parameter containing resource ID
        get_before_state: Function to get state before operation (receives request, **kwargs)
        get_after_state: Function to get state after operation (receives result, **kwargs)
        get_resource_name: Function to get human-readable resource name

    Usage:
        @router.put("/bookings/{booking_id}")
        @audit_action(
            action="update",
            resource_type="booking",
            resource_id_param="booking_id"
        )
        async def update_booking(booking_id: str, ...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get request from kwargs or args
            request = kwargs.get("request")
            if not request:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break

            # Get database session
            db = kwargs.get("db")

            # Extract context
            context = audit_service.extract_request_context(request) if request else {}

            # Get resource ID
            resource_id = None
            if resource_id_param:
                resource_id = kwargs.get(resource_id_param)

            # Get before state
            before_state = None
            if get_before_state and db:
                try:
                    before_state = await get_before_state(request, db=db, **kwargs)
                except Exception as e:
                    logger.warning(f"Failed to get before state: {e}")

            # Track timing
            start_time = time.time()
            success = True
            error_message = None
            result = None

            try:
                # Execute the actual function
                result = await func(*args, **kwargs)

            except Exception as e:
                success = False
                error_message = str(e)
                raise

            finally:
                duration_ms = int((time.time() - start_time) * 1000)

                # Get after state
                after_state = None
                if get_after_state and result and success:
                    try:
                        after_state = await get_after_state(result, db=db, **kwargs)
                    except Exception as e:
                        logger.warning(f"Failed to get after state: {e}")

                # Get resource name
                resource_name = None
                if get_resource_name:
                    try:
                        resource_name = await get_resource_name(result, **kwargs)
                    except:
                        pass

                # Log the action (async to not block response)
                if db:
                    try:
                        audit_service.log(
                            db=db,
                            action=action,
                            resource_type=resource_type,
                            resource_id=str(resource_id) if resource_id else None,
                            resource_name=resource_name,
                            before_state=before_state,
                            after_state=after_state,
                            success=success,
                            error_message=error_message,
                            duration_ms=duration_ms,
                            **context
                        )
                    except Exception as e:
                        logger.error(f"Failed to create audit log: {e}")

            return result

        return wrapper
    return decorator


# ============================================
# CONTEXT MANAGER FOR AUDIT
# ============================================

@asynccontextmanager
async def audit_context(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: str = None,
    request: Request = None,
    user_id: str = None,
    before_state: Dict = None
):
    """
    Context manager for auditing operations.

    Usage:
        async with audit_context(db, "update", "booking", booking_id, request) as audit:
            audit["before_state"] = old_booking.to_dict()
            # ... perform update ...
            audit["after_state"] = new_booking.to_dict()

    The audit log is automatically created on exit.
    """
    audit_data = {
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "before_state": before_state,
        "after_state": None,
        "success": True,
        "error_message": None,
        "metadata": {}
    }

    # Extract context from request
    context = {}
    if request:
        context = audit_service.extract_request_context(request)
    elif user_id:
        context["user_id"] = user_id

    start_time = time.time()

    try:
        yield audit_data
    except Exception as e:
        audit_data["success"] = False
        audit_data["error_message"] = str(e)
        raise
    finally:
        duration_ms = int((time.time() - start_time) * 1000)

        audit_service.log(
            db=db,
            duration_ms=duration_ms,
            **audit_data,
            **context
        )


# ============================================
# MIDDLEWARE
# ============================================

class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware that automatically audits all state-changing requests.
    Logs POST, PUT, PATCH, DELETE operations.
    """

    def __init__(
        self,
        app,
        exclude_paths: List[str] = None,
        audit_reads: bool = False
    ):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            "/api/auth/refresh"  # Don't audit token refresh spam
        ]
        self.audit_reads = audit_reads

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip excluded paths
        path = request.url.path
        if any(path.startswith(exc) for exc in self.exclude_paths):
            return await call_next(request)

        # Only audit state-changing methods (and optionally reads)
        if request.method not in ["POST", "PUT", "PATCH", "DELETE"]:
            if not self.audit_reads or request.method != "GET":
                return await call_next(request)

        # Generate request ID
        request_id = request.headers.get("X-Request-ID") or secrets.token_hex(8)

        # Extract resource info from path
        resource_type, resource_id = self._extract_resource_info(path)

        # Determine action from method
        action_map = {
            "POST": AuditAction.CREATE.value,
            "PUT": AuditAction.UPDATE.value,
            "PATCH": AuditAction.UPDATE.value,
            "DELETE": AuditAction.DELETE.value,
            "GET": AuditAction.READ.value
        }
        action = action_map.get(request.method, "unknown")

        start_time = time.time()
        success = True
        error_message = None
        status_code = 200

        try:
            response = await call_next(request)
            status_code = response.status_code
            success = 200 <= status_code < 400

            if not success:
                error_message = f"HTTP {status_code}"

            return response

        except Exception as e:
            success = False
            error_message = str(e)
            raise

        finally:
            duration_ms = int((time.time() - start_time) * 1000)

            # Log asynchronously to not block response
            await audit_service.log_async(
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address=audit_service._get_client_ip(request),
                user_agent=request.headers.get("User-Agent", "")[:500],
                request_method=request.method,
                request_path=path,
                request_id=request_id,
                cf_ray=request.headers.get("CF-Ray"),
                cf_country=request.headers.get("CF-IPCountry"),
                success=success,
                error_message=error_message,
                user_id=request.state.user.get("sub") if hasattr(request.state, "user") and request.state.user else None,
                user_role=request.state.user.get("role") if hasattr(request.state, "user") and request.state.user else None,
                metadata={"http_status": status_code, "duration_ms": duration_ms}
            )

    def _extract_resource_info(self, path: str) -> tuple[str, str]:
        """Extract resource type and ID from URL path."""
        # Common patterns: /api/bookings/123, /api/users/abc-def
        parts = [p for p in path.strip("/").split("/") if p]

        resource_type = "unknown"
        resource_id = None

        # Find the main resource in the path
        resource_keywords = [
            "bookings", "guests", "properties", "cleaners", "expenses",
            "waivers", "workers", "jobs", "sessions", "users", "payments",
            "messages", "locks", "financials", "briefing"
        ]

        for i, part in enumerate(parts):
            if part in resource_keywords:
                resource_type = part.rstrip("s")  # Remove plural
                # Next part might be the ID
                if i + 1 < len(parts) and not parts[i + 1] in resource_keywords:
                    resource_id = parts[i + 1]
                break

        return resource_type, resource_id
