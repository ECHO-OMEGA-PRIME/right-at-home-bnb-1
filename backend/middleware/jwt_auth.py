"""
Right At Home BnB - JWT Authentication Middleware
=================================================
Comprehensive JWT authentication with:
- Token generation and validation
- Session tracking in database
- Device fingerprinting
- Rate limiting per user
- Cloudflare Zero Trust integration
- Token refresh with rotation

@author ECHO OMEGA PRIME
@version 1.0.0
"""

import os
import secrets
import hashlib
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Callable
from functools import wraps

from fastapi import Request, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response, JSONResponse
from sqlalchemy.orm import Session
from loguru import logger

# JWT library
try:
    from jose import jwt, JWTError, ExpiredSignatureError
    JWT_AVAILABLE = True
except ImportError:
    try:
        import jwt as pyjwt
        from jwt import PyJWTError as JWTError, ExpiredSignatureError
        jwt = pyjwt
        JWT_AVAILABLE = True
    except ImportError:
        JWT_AVAILABLE = False
        jwt = None
        JWTError = Exception
        ExpiredSignatureError = Exception

# Password hashing
try:
    import bcrypt
    BCRYPT_AVAILABLE = True
except ImportError:
    BCRYPT_AVAILABLE = False
    bcrypt = None

from database.connection import get_db, SessionLocal
from database.models_security import UserSession, SessionStatus


# ============================================
# CONFIGURATION
# ============================================

class JWTConfig:
    """JWT configuration settings."""
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", secrets.token_hex(32))
    REFRESH_SECRET_KEY: str = os.getenv("JWT_REFRESH_SECRET_KEY", secrets.token_hex(32))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_ACCESS_EXPIRE_MINUTES", "60"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "7"))

    # Rate limiting
    RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
    RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))

    # Session settings
    MAX_SESSIONS_PER_USER: int = int(os.getenv("MAX_SESSIONS_PER_USER", "10"))
    TRACK_SESSIONS: bool = os.getenv("TRACK_SESSIONS", "true").lower() == "true"


# ============================================
# SECURITY BEARER
# ============================================

security = HTTPBearer(auto_error=False)


# ============================================
# JWT SERVICE
# ============================================

class JWTService:
    """
    JWT token service with session management.
    Handles token generation, validation, refresh, and session tracking.
    """

    def __init__(self, config: JWTConfig = None):
        self.config = config or JWTConfig()
        if not JWT_AVAILABLE:
            logger.warning("JWT library not available. Install python-jose or PyJWT.")

    # =========================================================================
    # TOKEN GENERATION
    # =========================================================================

    def create_access_token(
        self,
        user_id: str,
        email: str,
        role: str,
        permissions: List[str] = None,
        additional_claims: Dict[str, Any] = None
    ) -> str:
        """
        Create a new JWT access token.

        Args:
            user_id: User's unique identifier
            email: User's email address
            role: User's role (owner, admin, cleaner, etc.)
            permissions: List of permission strings
            additional_claims: Extra claims to include

        Returns:
            Encoded JWT token string
        """
        if not JWT_AVAILABLE:
            raise RuntimeError("JWT library not available")

        now = datetime.utcnow()
        expire = now + timedelta(minutes=self.config.ACCESS_TOKEN_EXPIRE_MINUTES)

        payload = {
            "sub": user_id,
            "email": email,
            "role": role,
            "permissions": permissions or [],
            "type": "access",
            "iat": now,
            "exp": expire,
            "jti": secrets.token_hex(16)  # JWT ID for tracking
        }

        if additional_claims:
            payload.update(additional_claims)

        return jwt.encode(payload, self.config.SECRET_KEY, algorithm=self.config.ALGORITHM)

    def create_refresh_token(
        self,
        user_id: str,
        token_family: str = None
    ) -> tuple[str, str]:
        """
        Create a new refresh token with rotation support.

        Args:
            user_id: User's unique identifier
            token_family: Token family for rotation tracking

        Returns:
            Tuple of (refresh_token, token_family)
        """
        if not JWT_AVAILABLE:
            raise RuntimeError("JWT library not available")

        now = datetime.utcnow()
        expire = now + timedelta(days=self.config.REFRESH_TOKEN_EXPIRE_DAYS)

        # Create or use existing token family
        family = token_family or secrets.token_hex(16)

        payload = {
            "sub": user_id,
            "type": "refresh",
            "family": family,
            "iat": now,
            "exp": expire,
            "jti": secrets.token_hex(16)
        }

        token = jwt.encode(payload, self.config.REFRESH_SECRET_KEY, algorithm=self.config.ALGORITHM)
        return token, family

    def create_tokens(
        self,
        user_id: str,
        email: str,
        role: str,
        permissions: List[str] = None,
        additional_claims: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Create both access and refresh tokens.

        Returns:
            Dictionary with access_token, refresh_token, and expiry info
        """
        access_token = self.create_access_token(
            user_id=user_id,
            email=email,
            role=role,
            permissions=permissions,
            additional_claims=additional_claims
        )

        refresh_token, token_family = self.create_refresh_token(user_id=user_id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "token_family": token_family,
            "expires_in": self.config.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "refresh_expires_in": self.config.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
        }

    # =========================================================================
    # TOKEN VALIDATION
    # =========================================================================

    def verify_access_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Verify and decode an access token.

        Args:
            token: JWT access token

        Returns:
            Decoded payload or None if invalid
        """
        if not JWT_AVAILABLE:
            return None

        try:
            payload = jwt.decode(
                token,
                self.config.SECRET_KEY,
                algorithms=[self.config.ALGORITHM]
            )

            if payload.get("type") != "access":
                logger.warning("Token is not an access token")
                return None

            return payload

        except ExpiredSignatureError:
            logger.debug("Access token expired")
            return None
        except JWTError as e:
            logger.warning(f"JWT validation error: {e}")
            return None

    def verify_refresh_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Verify and decode a refresh token.

        Args:
            token: JWT refresh token

        Returns:
            Decoded payload or None if invalid
        """
        if not JWT_AVAILABLE:
            return None

        try:
            payload = jwt.decode(
                token,
                self.config.REFRESH_SECRET_KEY,
                algorithms=[self.config.ALGORITHM]
            )

            if payload.get("type") != "refresh":
                logger.warning("Token is not a refresh token")
                return None

            return payload

        except ExpiredSignatureError:
            logger.debug("Refresh token expired")
            return None
        except JWTError as e:
            logger.warning(f"JWT refresh validation error: {e}")
            return None

    # =========================================================================
    # SESSION MANAGEMENT
    # =========================================================================

    def create_session(
        self,
        db: Session,
        user_id: str,
        access_token: str,
        refresh_token: str,
        token_family: str,
        request: Request = None
    ) -> UserSession:
        """
        Create a new session record in the database.

        Args:
            db: Database session
            user_id: User's ID
            access_token: JWT access token
            refresh_token: JWT refresh token
            token_family: Token family for rotation
            request: FastAPI request for device info

        Returns:
            Created UserSession instance
        """
        # Extract device info from request
        ip_address = None
        user_agent = None
        device_fingerprint = None
        device_type = None
        browser = None
        os_name = None
        cf_ray = None
        cf_country = None
        cf_city = None
        cf_access_token = None
        cf_identity = None

        if request:
            # IP address (check Cloudflare headers first)
            ip_address = (
                request.headers.get("CF-Connecting-IP") or
                request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or
                request.client.host if request.client else None
            )

            user_agent = request.headers.get("User-Agent", "")[:500]

            # Parse user agent for device info
            device_type, browser, os_name = self._parse_user_agent(user_agent)

            # Create device fingerprint
            device_fingerprint = self._create_fingerprint(
                ip_address, user_agent, request.headers.get("Accept-Language", "")
            )

            # Cloudflare headers
            cf_ray = request.headers.get("CF-Ray")
            cf_country = request.headers.get("CF-IPCountry")
            cf_city = request.headers.get("CF-IPCity")
            cf_access_token = request.headers.get("Cf-Access-Jwt-Assertion")

            if cf_access_token:
                try:
                    # Decode CF access token (without verification for identity info)
                    cf_identity = jwt.decode(cf_access_token, options={"verify_signature": False})
                except:
                    cf_identity = None

        # Enforce max sessions per user
        self._enforce_max_sessions(db, user_id)

        # Calculate expiry
        expires_at = datetime.utcnow() + timedelta(days=self.config.REFRESH_TOKEN_EXPIRE_DAYS)

        session = UserSession(
            user_id=user_id,
            session_token=access_token[:256],  # Store truncated for lookup
            refresh_token=refresh_token[:256],
            token_family=token_family,
            ip_address=ip_address,
            user_agent=user_agent,
            device_fingerprint=device_fingerprint,
            device_type=device_type,
            browser=browser,
            os=os_name,
            cf_access_token=cf_access_token,
            cf_identity=cf_identity,
            cf_ray_id=cf_ray,
            cf_country=cf_country,
            cf_city=cf_city,
            status=SessionStatus.ACTIVE.value,
            expires_at=expires_at,
            last_activity=datetime.utcnow()
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        logger.info(f"Session created for user {user_id} from {ip_address}")
        return session

    def _enforce_max_sessions(self, db: Session, user_id: str) -> None:
        """Remove oldest sessions if user exceeds max allowed."""
        active_sessions = db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.status == SessionStatus.ACTIVE.value
        ).order_by(UserSession.created_at.asc()).all()

        if len(active_sessions) >= self.config.MAX_SESSIONS_PER_USER:
            # Revoke oldest sessions
            sessions_to_revoke = active_sessions[:len(active_sessions) - self.config.MAX_SESSIONS_PER_USER + 1]
            for session in sessions_to_revoke:
                session.status = SessionStatus.REVOKED.value
                session.revoked_at = datetime.utcnow()
                session.revoke_reason = "Max sessions exceeded"
            db.commit()
            logger.info(f"Revoked {len(sessions_to_revoke)} old sessions for user {user_id}")

    def get_session_by_token(self, db: Session, token: str) -> Optional[UserSession]:
        """Find session by access token."""
        return db.query(UserSession).filter(
            UserSession.session_token == token[:256],
            UserSession.status == SessionStatus.ACTIVE.value
        ).first()

    def update_session_activity(self, db: Session, session: UserSession) -> None:
        """Update session's last activity timestamp."""
        session.last_activity = datetime.utcnow()
        session.request_count = (session.request_count or 0) + 1
        session.last_request_at = datetime.utcnow()
        db.commit()

    def revoke_session(
        self,
        db: Session,
        session_id: int,
        reason: str = "User logout",
        revoked_by: str = None
    ) -> bool:
        """Revoke a specific session."""
        session = db.query(UserSession).filter(UserSession.id == session_id).first()
        if not session:
            return False

        session.status = SessionStatus.LOGGED_OUT.value if reason == "User logout" else SessionStatus.REVOKED.value
        session.revoked_at = datetime.utcnow()
        session.revoke_reason = reason
        session.revoked_by = revoked_by
        db.commit()

        logger.info(f"Session {session_id} revoked: {reason}")
        return True

    def revoke_all_user_sessions(
        self,
        db: Session,
        user_id: str,
        reason: str = "Security action",
        except_session_id: int = None
    ) -> int:
        """Revoke all sessions for a user."""
        query = db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.status == SessionStatus.ACTIVE.value
        )

        if except_session_id:
            query = query.filter(UserSession.id != except_session_id)

        sessions = query.all()
        for session in sessions:
            session.status = SessionStatus.REVOKED.value
            session.revoked_at = datetime.utcnow()
            session.revoke_reason = reason

        db.commit()
        logger.info(f"Revoked {len(sessions)} sessions for user {user_id}")
        return len(sessions)

    def get_user_sessions(self, db: Session, user_id: str) -> List[UserSession]:
        """Get all active sessions for a user."""
        return db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.status == SessionStatus.ACTIVE.value
        ).order_by(UserSession.created_at.desc()).all()

    # =========================================================================
    # RATE LIMITING
    # =========================================================================

    def check_rate_limit(self, db: Session, session: UserSession) -> bool:
        """
        Check if the session has exceeded rate limits.

        Returns:
            True if within limits, False if exceeded
        """
        if not session.last_request_at:
            return True

        window_start = datetime.utcnow() - timedelta(seconds=self.config.RATE_LIMIT_WINDOW_SECONDS)

        if session.last_request_at < window_start:
            # Reset counter for new window
            session.request_count = 0
            session.rate_limit_exceeded_at = None
            return True

        if session.request_count >= self.config.RATE_LIMIT_REQUESTS:
            if not session.rate_limit_exceeded_at:
                session.rate_limit_exceeded_at = datetime.utcnow()
                db.commit()
            return False

        return True

    # =========================================================================
    # HELPERS
    # =========================================================================

    def _parse_user_agent(self, user_agent: str) -> tuple[str, str, str]:
        """Parse user agent string to extract device info."""
        ua_lower = user_agent.lower()

        # Device type
        if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
            device_type = "mobile"
        elif "tablet" in ua_lower or "ipad" in ua_lower:
            device_type = "tablet"
        else:
            device_type = "desktop"

        # Browser
        browser = "unknown"
        if "chrome" in ua_lower and "edg" not in ua_lower:
            browser = "Chrome"
        elif "firefox" in ua_lower:
            browser = "Firefox"
        elif "safari" in ua_lower and "chrome" not in ua_lower:
            browser = "Safari"
        elif "edg" in ua_lower:
            browser = "Edge"
        elif "opera" in ua_lower or "opr" in ua_lower:
            browser = "Opera"

        # OS
        os_name = "unknown"
        if "windows" in ua_lower:
            os_name = "Windows"
        elif "mac os" in ua_lower or "macos" in ua_lower:
            os_name = "macOS"
        elif "linux" in ua_lower:
            os_name = "Linux"
        elif "android" in ua_lower:
            os_name = "Android"
        elif "iphone" in ua_lower or "ipad" in ua_lower:
            os_name = "iOS"

        return device_type, browser, os_name

    def _create_fingerprint(self, ip: str, user_agent: str, accept_language: str) -> str:
        """Create a device fingerprint hash."""
        data = f"{ip}|{user_agent}|{accept_language}"
        return hashlib.sha256(data.encode()).hexdigest()[:64]


# ============================================
# SINGLETON INSTANCE
# ============================================

jwt_service = JWTService()


# ============================================
# DEPENDENCY INJECTION
# ============================================

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    FastAPI dependency to get the current authenticated user.
    Raises HTTPException if authentication fails.
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    payload = jwt_service.verify_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Check session if tracking enabled
    if jwt_service.config.TRACK_SESSIONS:
        session = jwt_service.get_session_by_token(db, token)
        if not session:
            raise HTTPException(
                status_code=401,
                detail="Session not found or revoked",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Check rate limit
        if not jwt_service.check_rate_limit(db, session):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later."
            )

        # Update activity
        jwt_service.update_session_activity(db, session)

        # Add session info to payload
        payload["session_id"] = session.id

    # Store user in request state for audit logging
    request.state.user = payload

    return payload


async def get_current_user_optional(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency to optionally get the current user.
    Returns None if no authentication provided.
    """
    if not credentials:
        return None

    try:
        return await get_current_user(request, credentials, db)
    except HTTPException:
        return None


def require_role(*roles: str):
    """
    Decorator factory to require specific roles.

    Usage:
        @router.get("/admin")
        @require_role("admin", "owner")
        async def admin_endpoint(user = Depends(get_current_user)):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user = kwargs.get("user") or kwargs.get("current_user")
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")

            user_role = user.get("role", "")
            if user_role not in roles and user_role != "owner":  # Owner always has access
                raise HTTPException(status_code=403, detail="Insufficient permissions")

            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_permission(*permissions: str):
    """
    Decorator factory to require specific permissions.

    Usage:
        @router.post("/users")
        @require_permission("manage_users")
        async def create_user(user = Depends(get_current_user)):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user = kwargs.get("user") or kwargs.get("current_user")
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")

            user_permissions = set(user.get("permissions", []))
            required = set(permissions)

            # Owner role has all permissions
            if user.get("role") == "owner":
                return await func(*args, **kwargs)

            if not required.intersection(user_permissions):
                raise HTTPException(status_code=403, detail="Insufficient permissions")

            return await func(*args, **kwargs)
        return wrapper
    return decorator


# ============================================
# MIDDLEWARE
# ============================================

class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware for JWT authentication on all requests.
    Extracts user info and attaches to request state.
    """

    def __init__(self, app, exclude_paths: List[str] = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            "/",
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh"
        ]

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip auth for excluded paths
        path = request.url.path
        if any(path.startswith(exc) for exc in self.exclude_paths):
            return await call_next(request)

        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization", "")

        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            payload = jwt_service.verify_access_token(token)

            if payload:
                request.state.user = payload
                request.state.authenticated = True
            else:
                request.state.user = None
                request.state.authenticated = False
        else:
            request.state.user = None
            request.state.authenticated = False

        return await call_next(request)


# ============================================
# PASSWORD UTILITIES
# ============================================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    if BCRYPT_AVAILABLE:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    else:
        # Fallback to SHA-256 (less secure, not recommended for production)
        return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    if BCRYPT_AVAILABLE:
        try:
            return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
        except:
            # Might be SHA-256 hash from fallback
            return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password
    else:
        return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password
