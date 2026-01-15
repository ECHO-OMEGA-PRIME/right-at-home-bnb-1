"""
Right At Home BnB - Authentication & Authorization Service
==========================================================
Multi-provider authentication with role-based access control:
- Login providers: Google, Apple, Email/Password
- Access levels: Owner, Cleaner, Technician, Property Owner, Guest
- Steven has FULL ACCESS to everything
- Firebase Auth integration

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
import secrets
import hashlib
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
from loguru import logger

# JWT
try:
    import jwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False
    jwt = None

# Firebase
try:
    import firebase_admin
    from firebase_admin import auth as firebase_auth, firestore
    db = firestore.client() if firebase_admin._apps else None
    FIREBASE_AVAILABLE = db is not None
except:
    FIREBASE_AVAILABLE = False
    firebase_auth = None
    db = None


class UserRole(str, Enum):
    """User access levels from lowest to highest."""
    GUEST = "guest"                    # Basic guest access - view bookings, chat with AI
    CUSTOMER = "customer"              # Repeat customers - full booking history, preferences
    TECHNICIAN = "technician"          # Maintenance crews - work orders, property access
    CLEANER = "cleaner"                # Cleaning crews - schedules, property details
    PROPERTY_OWNER = "property_owner"  # External property owners - their properties only
    MANAGER = "manager"                # Property managers - multiple properties
    ADMIN = "admin"                    # Full admin access
    OWNER = "owner"                    # Steven - FULL ACCESS to EVERYTHING


class Permission(str, Enum):
    """Granular permissions."""
    # Viewing
    VIEW_OWN_BOOKINGS = "view_own_bookings"
    VIEW_ALL_BOOKINGS = "view_all_bookings"
    VIEW_PROPERTIES = "view_properties"
    VIEW_ALL_PROPERTIES = "view_all_properties"
    VIEW_FINANCIALS = "view_financials"
    VIEW_REPORTS = "view_reports"

    # Actions
    CREATE_BOOKING = "create_booking"
    MODIFY_BOOKING = "modify_booking"
    CANCEL_BOOKING = "cancel_booking"
    MANAGE_PROPERTIES = "manage_properties"
    MANAGE_CLEANERS = "manage_cleaners"
    MANAGE_TECHNICIANS = "manage_technicians"
    MANAGE_USERS = "manage_users"

    # Operations
    COMPLETE_CLEANING = "complete_cleaning"
    COMPLETE_MAINTENANCE = "complete_maintenance"
    UPDATE_INVENTORY = "update_inventory"
    ACCESS_SMART_HOME = "access_smart_home"
    GENERATE_DOOR_CODES = "generate_door_codes"

    # Steven Only
    VIEW_ALL_FINANCIALS = "view_all_financials"
    MANAGE_ALL = "manage_all"
    ACCESS_WINE_CELLAR = "access_wine_cellar"
    VIEW_MARKETING = "view_marketing"
    OVERRIDE_ALL = "override_all"


# Role to permissions mapping
ROLE_PERMISSIONS = {
    UserRole.GUEST: [
        Permission.VIEW_OWN_BOOKINGS,
        Permission.CREATE_BOOKING,
    ],
    UserRole.CUSTOMER: [
        Permission.VIEW_OWN_BOOKINGS,
        Permission.CREATE_BOOKING,
        Permission.MODIFY_BOOKING,
        Permission.CANCEL_BOOKING,
    ],
    UserRole.TECHNICIAN: [
        Permission.VIEW_PROPERTIES,
        Permission.COMPLETE_MAINTENANCE,
        Permission.UPDATE_INVENTORY,
    ],
    UserRole.CLEANER: [
        Permission.VIEW_PROPERTIES,
        Permission.COMPLETE_CLEANING,
        Permission.UPDATE_INVENTORY,
        Permission.ACCESS_SMART_HOME,
    ],
    UserRole.PROPERTY_OWNER: [
        Permission.VIEW_OWN_BOOKINGS,
        Permission.VIEW_PROPERTIES,
        Permission.VIEW_FINANCIALS,
        Permission.VIEW_REPORTS,
    ],
    UserRole.MANAGER: [
        Permission.VIEW_ALL_BOOKINGS,
        Permission.VIEW_ALL_PROPERTIES,
        Permission.VIEW_FINANCIALS,
        Permission.VIEW_REPORTS,
        Permission.MANAGE_CLEANERS,
        Permission.MANAGE_TECHNICIANS,
        Permission.GENERATE_DOOR_CODES,
        Permission.ACCESS_SMART_HOME,
    ],
    UserRole.ADMIN: [
        Permission.VIEW_ALL_BOOKINGS,
        Permission.VIEW_ALL_PROPERTIES,
        Permission.VIEW_FINANCIALS,
        Permission.VIEW_REPORTS,
        Permission.MANAGE_PROPERTIES,
        Permission.MANAGE_CLEANERS,
        Permission.MANAGE_TECHNICIANS,
        Permission.MANAGE_USERS,
        Permission.GENERATE_DOOR_CODES,
        Permission.ACCESS_SMART_HOME,
    ],
    UserRole.OWNER: [
        # ALL PERMISSIONS - Steven gets everything
        *list(Permission)
    ]
}


class AuthService:
    """
    Authentication and authorization service.
    Supports Google, Apple, and Email/Password authentication.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.jwt_available = JWT_AVAILABLE
        self.users_collection = "rah_users"
        self.sessions_collection = "rah_sessions"

        # JWT secret (in production, use proper secret management)
        self.jwt_secret = os.getenv("JWT_SECRET", secrets.token_hex(32))
        self.jwt_algorithm = "HS256"
        self.token_expiry_hours = 24

        # Steven's master credentials
        self.steven_email = os.getenv("STEVEN_EMAIL", "steven@rightathomebnb.com")
        self.steven_uid = os.getenv("STEVEN_UID", "steven-palma-owner")

    # =========================================================================
    # USER REGISTRATION
    # =========================================================================

    async def register_user(
        self,
        email: str,
        password: str = None,
        name: str = None,
        phone: str = None,
        role: UserRole = UserRole.GUEST,
        auth_provider: str = "email"
    ) -> Dict[str, Any]:
        """Register a new user."""
        # Check if user exists
        existing = await self.get_user_by_email(email)
        if existing:
            return {"error": "User already exists", "existing": True}

        user_id = f"user_{secrets.token_hex(8)}"

        # Hash password if email auth
        password_hash = None
        if password and auth_provider == "email":
            password_hash = hashlib.sha256(password.encode()).hexdigest()

        user_data = {
            "id": user_id,
            "email": email,
            "name": name or email.split("@")[0],
            "phone": phone,
            "role": role.value,
            "auth_provider": auth_provider,
            "password_hash": password_hash,
            "permissions": [p.value for p in ROLE_PERMISSIONS.get(role, [])],
            "created_at": datetime.utcnow().isoformat(),
            "last_login": None,
            "is_active": True,
            "email_verified": auth_provider != "email",  # OAuth providers are pre-verified
            "profile": {
                "avatar_url": None,
                "preferences": {}
            }
        }

        # Create in Firebase
        if self.firebase_available and db:
            db.collection(self.users_collection).document(user_id).set(user_data)

            # Also create Firebase Auth user if available
            if firebase_auth and password:
                try:
                    firebase_auth.create_user(
                        uid=user_id,
                        email=email,
                        password=password,
                        display_name=name
                    )
                except Exception as e:
                    logger.warning(f"Firebase Auth user creation failed: {e}")

        logger.info(f"User registered: {email} with role {role.value}")
        return {"success": True, "user_id": user_id, "role": role.value}

    async def register_with_google(
        self,
        google_token: str,
        role: UserRole = UserRole.GUEST
    ) -> Dict[str, Any]:
        """Register/login with Google OAuth."""
        if not firebase_auth:
            return {"error": "Firebase Auth not configured"}

        try:
            # Verify Google token with Firebase
            decoded_token = firebase_auth.verify_id_token(google_token)
            email = decoded_token.get("email")
            name = decoded_token.get("name")
            picture = decoded_token.get("picture")
            uid = decoded_token.get("uid")

            # Check if user exists
            existing = await self.get_user_by_email(email)
            if existing:
                # Login existing user
                return await self.login_oauth(email, "google", uid)

            # Register new user
            return await self.register_user(
                email=email,
                name=name,
                role=role,
                auth_provider="google"
            )

        except Exception as e:
            logger.error(f"Google auth error: {e}")
            return {"error": str(e)}

    async def register_with_apple(
        self,
        apple_token: str,
        role: UserRole = UserRole.GUEST
    ) -> Dict[str, Any]:
        """Register/login with Apple Sign In."""
        if not firebase_auth:
            return {"error": "Firebase Auth not configured"}

        try:
            # Verify Apple token with Firebase
            decoded_token = firebase_auth.verify_id_token(apple_token)
            email = decoded_token.get("email")
            name = decoded_token.get("name", email.split("@")[0])
            uid = decoded_token.get("uid")

            existing = await self.get_user_by_email(email)
            if existing:
                return await self.login_oauth(email, "apple", uid)

            return await self.register_user(
                email=email,
                name=name,
                role=role,
                auth_provider="apple"
            )

        except Exception as e:
            logger.error(f"Apple auth error: {e}")
            return {"error": str(e)}

    # =========================================================================
    # LOGIN
    # =========================================================================

    async def login_email(self, email: str, password: str) -> Dict[str, Any]:
        """Login with email and password."""
        user = await self.get_user_by_email(email)

        if not user:
            return {"error": "User not found"}

        if not user.get("is_active"):
            return {"error": "Account is disabled"}

        # Verify password
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        if user.get("password_hash") != password_hash:
            return {"error": "Invalid password"}

        # Generate JWT token
        token = self._generate_token(user)

        # Update last login
        await self._update_last_login(user["id"])

        return {
            "success": True,
            "token": token,
            "user": self._sanitize_user(user)
        }

    async def login_oauth(
        self,
        email: str,
        provider: str,
        provider_uid: str
    ) -> Dict[str, Any]:
        """Login via OAuth provider."""
        user = await self.get_user_by_email(email)

        if not user:
            return {"error": "User not found"}

        if not user.get("is_active"):
            return {"error": "Account is disabled"}

        # Generate token
        token = self._generate_token(user)

        # Update last login
        await self._update_last_login(user["id"])

        return {
            "success": True,
            "token": token,
            "user": self._sanitize_user(user)
        }

    def _generate_token(self, user: Dict) -> str:
        """Generate JWT token for user."""
        if not self.jwt_available:
            return secrets.token_hex(32)

        payload = {
            "user_id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "permissions": user.get("permissions", []),
            "exp": datetime.utcnow() + timedelta(hours=self.token_expiry_hours),
            "iat": datetime.utcnow()
        }

        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)

    async def _update_last_login(self, user_id: str) -> None:
        """Update user's last login timestamp."""
        if self.firebase_available and db:
            db.collection(self.users_collection).document(user_id).update({
                "last_login": datetime.utcnow().isoformat()
            })

    # =========================================================================
    # TOKEN VALIDATION
    # =========================================================================

    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify JWT token and return payload."""
        if not self.jwt_available:
            return {"error": "JWT not available"}

        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
            return {"valid": True, "payload": payload}
        except jwt.ExpiredSignatureError:
            return {"valid": False, "error": "Token expired"}
        except jwt.InvalidTokenError:
            return {"valid": False, "error": "Invalid token"}

    def get_user_from_token(self, token: str) -> Optional[Dict]:
        """Extract user info from token."""
        result = self.verify_token(token)
        if result.get("valid"):
            return result.get("payload")
        return None

    # =========================================================================
    # AUTHORIZATION
    # =========================================================================

    def check_permission(
        self,
        user: Dict,
        required_permission: Permission
    ) -> bool:
        """Check if user has a specific permission."""
        # Steven (owner) has all permissions
        if user.get("role") == UserRole.OWNER.value:
            return True

        # Check email for Steven
        if user.get("email") == self.steven_email:
            return True

        user_permissions = user.get("permissions", [])
        return required_permission.value in user_permissions

    def check_role(
        self,
        user: Dict,
        minimum_role: UserRole
    ) -> bool:
        """Check if user has at least the minimum role level."""
        role_hierarchy = [
            UserRole.GUEST,
            UserRole.CUSTOMER,
            UserRole.TECHNICIAN,
            UserRole.CLEANER,
            UserRole.PROPERTY_OWNER,
            UserRole.MANAGER,
            UserRole.ADMIN,
            UserRole.OWNER
        ]

        user_role = UserRole(user.get("role", "guest"))
        user_level = role_hierarchy.index(user_role)
        required_level = role_hierarchy.index(minimum_role)

        return user_level >= required_level

    def require_permission(self, permission: Permission):
        """Decorator to require a specific permission."""
        def decorator(func):
            async def wrapper(*args, **kwargs):
                user = kwargs.get("current_user")
                if not user:
                    return {"error": "Authentication required"}
                if not self.check_permission(user, permission):
                    return {"error": "Permission denied"}
                return await func(*args, **kwargs)
            return wrapper
        return decorator

    # =========================================================================
    # USER MANAGEMENT
    # =========================================================================

    async def get_user_by_email(self, email: str) -> Optional[Dict]:
        """Get user by email."""
        if not self.firebase_available or not db:
            # Demo user
            if email == self.steven_email:
                return {
                    "id": self.steven_uid,
                    "email": self.steven_email,
                    "name": "Steven Palma",
                    "role": UserRole.OWNER.value,
                    "permissions": [p.value for p in Permission],
                    "is_active": True
                }
            return None

        docs = db.collection(self.users_collection).where("email", "==", email).limit(1).stream()
        for doc in docs:
            return doc.to_dict()
        return None

    async def get_user_by_id(self, user_id: str) -> Optional[Dict]:
        """Get user by ID."""
        if not self.firebase_available or not db:
            return None

        doc = db.collection(self.users_collection).document(user_id).get()
        if doc.exists:
            return doc.to_dict()
        return None

    async def update_user_role(
        self,
        admin_user: Dict,
        target_user_id: str,
        new_role: UserRole
    ) -> Dict[str, Any]:
        """Update a user's role (admin only)."""
        if not self.check_role(admin_user, UserRole.ADMIN):
            return {"error": "Admin access required"}

        # Can't change owner role
        target_user = await self.get_user_by_id(target_user_id)
        if target_user and target_user.get("role") == UserRole.OWNER.value:
            return {"error": "Cannot modify owner role"}

        new_permissions = [p.value for p in ROLE_PERMISSIONS.get(new_role, [])]

        if self.firebase_available and db:
            db.collection(self.users_collection).document(target_user_id).update({
                "role": new_role.value,
                "permissions": new_permissions,
                "updated_at": datetime.utcnow().isoformat(),
                "updated_by": admin_user["id"]
            })

        return {"success": True, "new_role": new_role.value}

    async def get_users_by_role(self, role: UserRole, limit: int = 100) -> List[Dict]:
        """Get all users with a specific role."""
        if not self.firebase_available or not db:
            return []

        docs = db.collection(self.users_collection).where(
            "role", "==", role.value
        ).limit(limit).stream()

        return [self._sanitize_user(doc.to_dict()) for doc in docs]

    def _sanitize_user(self, user: Dict) -> Dict:
        """Remove sensitive fields from user object."""
        safe_user = user.copy()
        safe_user.pop("password_hash", None)
        return safe_user

    # =========================================================================
    # SPECIAL USERS SETUP
    # =========================================================================

    async def setup_steven_account(self) -> Dict[str, Any]:
        """Ensure Steven's owner account exists."""
        existing = await self.get_user_by_email(self.steven_email)
        if existing:
            return {"success": True, "exists": True, "user_id": existing["id"]}

        # Create Steven's account with full access
        result = await self.register_user(
            email=self.steven_email,
            name="Steven Palma",
            role=UserRole.OWNER,
            auth_provider="email"
        )

        return result

    async def register_cleaner(
        self,
        email: str,
        name: str,
        phone: str
    ) -> Dict[str, Any]:
        """Register a new cleaner."""
        return await self.register_user(
            email=email,
            name=name,
            phone=phone,
            role=UserRole.CLEANER,
            auth_provider="email"
        )

    async def register_technician(
        self,
        email: str,
        name: str,
        phone: str,
        specialization: str = None
    ) -> Dict[str, Any]:
        """Register a new technician."""
        result = await self.register_user(
            email=email,
            name=name,
            phone=phone,
            role=UserRole.TECHNICIAN,
            auth_provider="email"
        )

        if result.get("success") and specialization and self.firebase_available and db:
            db.collection(self.users_collection).document(result["user_id"]).update({
                "profile.specialization": specialization
            })

        return result

    async def register_property_owner(
        self,
        email: str,
        name: str,
        phone: str,
        property_ids: List[int] = None
    ) -> Dict[str, Any]:
        """Register an external property owner."""
        result = await self.register_user(
            email=email,
            name=name,
            phone=phone,
            role=UserRole.PROPERTY_OWNER,
            auth_provider="email"
        )

        if result.get("success") and property_ids and self.firebase_available and db:
            db.collection(self.users_collection).document(result["user_id"]).update({
                "managed_properties": property_ids
            })

        return result


# Singleton instance
auth_service = AuthService()
