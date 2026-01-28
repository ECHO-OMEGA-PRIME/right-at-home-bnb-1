"""
Right At Home BnB - Middleware Package
======================================
Security middleware for JWT authentication and audit logging.

@author ECHO OMEGA PRIME
"""

from .jwt_auth import (
    JWTAuthMiddleware,
    JWTService,
    get_current_user,
    get_current_user_optional,
    require_role,
    require_permission,
    jwt_service
)

from .audit import (
    AuditMiddleware,
    AuditService,
    audit_service,
    audit_action
)

__all__ = [
    # JWT Auth
    "JWTAuthMiddleware",
    "JWTService",
    "get_current_user",
    "get_current_user_optional",
    "require_role",
    "require_permission",
    "jwt_service",
    # Audit
    "AuditMiddleware",
    "AuditService",
    "audit_service",
    "audit_action"
]
