"""
Right At Home BnB - Authentication API Routes
=============================================
Multi-provider auth with role-based access control.

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from pydantic import BaseModel, EmailStr

from services.auth_service import (
    auth_service, UserRole, Permission, AuthProvider
)

router = APIRouter()


class GoogleAuthRequest(BaseModel):
    google_token: str
    role: str = "guest"


class AppleAuthRequest(BaseModel):
    apple_token: str
    identity_token: Optional[str] = None
    role: str = "guest"


class EmailRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    role: str = "guest"


class EmailLoginRequest(BaseModel):
    email: EmailStr
    password: str


class RoleUpdateRequest(BaseModel):
    user_id: str
    new_role: str


class TokenRefreshRequest(BaseModel):
    refresh_token: str


# =========================================================================
# REGISTRATION
# =========================================================================

@router.post("/register/google")
async def register_with_google(request: GoogleAuthRequest):
    """Register or login with Google OAuth."""
    try:
        role = UserRole(request.role)
    except ValueError:
        role = UserRole.GUEST

    result = await auth_service.register_with_google(request.google_token, role)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/register/apple")
async def register_with_apple(request: AppleAuthRequest):
    """Register or login with Apple Sign-In."""
    try:
        role = UserRole(request.role)
    except ValueError:
        role = UserRole.GUEST

    result = await auth_service.register_with_apple(
        request.apple_token,
        request.identity_token,
        role
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/register/email")
async def register_with_email(request: EmailRegisterRequest):
    """Register with email and password."""
    try:
        role = UserRole(request.role)
    except ValueError:
        role = UserRole.GUEST

    result = await auth_service.register_with_email(
        email=request.email,
        password=request.password,
        name=request.name,
        phone=request.phone,
        role=role
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# =========================================================================
# LOGIN
# =========================================================================

@router.post("/login/email")
async def login_with_email(request: EmailLoginRequest):
    """Login with email and password."""
    result = await auth_service.login_with_email(request.email, request.password)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return result


@router.post("/refresh")
async def refresh_token(request: TokenRefreshRequest):
    """Refresh access token."""
    result = await auth_service.refresh_token(request.refresh_token)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return result


# =========================================================================
# USER MANAGEMENT
# =========================================================================

@router.get("/me")
async def get_current_user(authorization: str = Header(...)):
    """Get current user from token."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.split(" ")[1]
    user = await auth_service.verify_token(token)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return user


@router.get("/user/{user_id}")
async def get_user(user_id: str, authorization: str = Header(...)):
    """Get user by ID (admin only)."""
    token = authorization.split(" ")[1] if authorization.startswith("Bearer ") else authorization
    current_user = await auth_service.verify_token(token)

    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Check permission
    if not auth_service.check_permission(current_user, Permission.MANAGE_USERS):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user = await auth_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@router.put("/user/{user_id}/role")
async def update_user_role(
    user_id: str,
    request: RoleUpdateRequest,
    authorization: str = Header(...)
):
    """Update user role (admin only)."""
    token = authorization.split(" ")[1] if authorization.startswith("Bearer ") else authorization
    current_user = await auth_service.verify_token(token)

    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Check permission
    if not auth_service.check_permission(current_user, Permission.MANAGE_USERS):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        new_role = UserRole(request.new_role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role")

    result = await auth_service.update_user_role(user_id, new_role)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.get("/users")
async def list_users(
    role: Optional[str] = None,
    limit: int = 50,
    authorization: str = Header(...)
):
    """List users (admin only)."""
    token = authorization.split(" ")[1] if authorization.startswith("Bearer ") else authorization
    current_user = await auth_service.verify_token(token)

    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not auth_service.check_permission(current_user, Permission.VIEW_USERS):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    role_filter = UserRole(role) if role else None
    return await auth_service.list_users(role_filter, limit)


# =========================================================================
# ROLES & PERMISSIONS
# =========================================================================

@router.get("/roles")
async def get_available_roles():
    """Get all available roles and their permissions."""
    return auth_service.get_role_permissions_map()


@router.get("/permissions/{role}")
async def get_role_permissions(role: str):
    """Get permissions for a specific role."""
    try:
        user_role = UserRole(role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role")

    return {
        "role": role,
        "permissions": [p.value for p in auth_service.get_permissions_for_role(user_role)]
    }


@router.post("/check-permission")
async def check_permission(
    permission: str,
    authorization: str = Header(...)
):
    """Check if current user has a specific permission."""
    token = authorization.split(" ")[1] if authorization.startswith("Bearer ") else authorization
    current_user = await auth_service.verify_token(token)

    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        perm = Permission(permission)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid permission")

    has_permission = auth_service.check_permission(current_user, perm)

    return {
        "user_id": current_user.get("user_id"),
        "role": current_user.get("role"),
        "permission": permission,
        "granted": has_permission
    }


# =========================================================================
# LOGOUT
# =========================================================================

@router.post("/logout")
async def logout(authorization: str = Header(...)):
    """Logout and invalidate token."""
    token = authorization.split(" ")[1] if authorization.startswith("Bearer ") else authorization
    result = await auth_service.logout(token)
    return result
