"""
Right at Home BnB - Smart Lock Base Provider
Abstract base class and common types for all lock providers
@author ECHO OMEGA PRIME
"""

import os
import random
import string
import hashlib
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from loguru import logger
import httpx


class LockProviderType(str, Enum):
    """Supported lock provider types."""
    SCHLAGE = "SCHLAGE"
    YALE = "YALE"
    AUGUST = "AUGUST"
    KWIKSET = "KWIKSET"


class LockStatus(str, Enum):
    """Lock status states."""
    LOCKED = "locked"
    UNLOCKED = "unlocked"
    JAMMED = "jammed"
    UNKNOWN = "unknown"
    OFFLINE = "offline"


class CodeType(str, Enum):
    """Access code types."""
    PERMANENT = "permanent"
    TEMPORARY = "temporary"
    ONE_TIME = "one_time"
    SCHEDULED = "scheduled"
    GUEST = "guest"
    CLEANER = "cleaner"


@dataclass
class AccessCode:
    """Represents an access code for a smart lock."""
    code_id: str
    lock_id: str
    code: str
    name: str
    code_type: CodeType
    created_at: datetime = field(default_factory=datetime.utcnow)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    max_uses: Optional[int] = None
    uses_count: int = 0
    is_active: bool = True
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    reservation_id: Optional[str] = None

    @property
    def is_expired(self) -> bool:
        """Check if code has expired."""
        if self.end_time and datetime.utcnow() > self.end_time:
            return True
        if self.max_uses and self.uses_count >= self.max_uses:
            return True
        return False

    @property
    def time_until_expiry(self) -> Optional[timedelta]:
        """Get time remaining until expiry."""
        if not self.end_time:
            return None
        remaining = self.end_time - datetime.utcnow()
        return remaining if remaining.total_seconds() > 0 else timedelta(0)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "code_id": self.code_id,
            "lock_id": self.lock_id,
            "code": self.code,
            "name": self.name,
            "code_type": self.code_type.value,
            "created_at": self.created_at.isoformat(),
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "max_uses": self.max_uses,
            "uses_count": self.uses_count,
            "is_active": self.is_active,
            "is_expired": self.is_expired,
            "time_until_expiry_seconds": self.time_until_expiry.total_seconds() if self.time_until_expiry else None,
            "guest_name": self.guest_name,
            "guest_phone": self.guest_phone,
            "reservation_id": self.reservation_id,
        }


@dataclass
class LockActivityEntry:
    """Represents an entry in the lock activity log."""
    timestamp: datetime
    action: str  # unlocked, locked, code_used, failed_attempt, battery_low
    method: str  # code, app, manual, auto, key
    user_name: Optional[str] = None
    code_name: Optional[str] = None
    code_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "action": self.action,
            "method": self.method,
            "user_name": self.user_name,
            "code_name": self.code_name,
            "code_id": self.code_id,
            "details": self.details,
        }


@dataclass
class LockInfo:
    """Represents detailed lock information."""
    lock_id: str
    name: str
    provider: LockProviderType
    property_id: str
    property_name: Optional[str] = None
    model: Optional[str] = None
    firmware_version: Optional[str] = None
    location: Optional[str] = None  # front_door, back_door, garage, etc.
    status: LockStatus = LockStatus.UNKNOWN
    battery_level: int = 100
    is_online: bool = True
    last_activity: Optional[datetime] = None
    current_code: Optional[str] = None
    code_expires_at: Optional[datetime] = None
    auto_lock_enabled: bool = True
    auto_lock_delay_seconds: int = 30

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.lock_id,
            "lock_id": self.lock_id,
            "name": self.name,
            "brand": self.provider.value,
            "provider": self.provider.value,
            "property_id": self.property_id,
            "property": {"name": self.property_name} if self.property_name else None,
            "model": self.model,
            "firmware_version": self.firmware_version,
            "location": self.location,
            "status": self.status.value,
            "batteryLevel": self.battery_level,
            "battery_level": self.battery_level,
            "isOnline": self.is_online,
            "is_online": self.is_online,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "currentCode": self.current_code,
            "current_code": self.current_code,
            "codeExpiresAt": self.code_expires_at.isoformat() if self.code_expires_at else None,
            "code_expires_at": self.code_expires_at.isoformat() if self.code_expires_at else None,
            "auto_lock_enabled": self.auto_lock_enabled,
            "auto_lock_delay_seconds": self.auto_lock_delay_seconds,
        }


class SmartLockProvider(ABC):
    """
    Abstract base class for smart lock providers.
    Each provider (Schlage, Yale, August, Kwikset) implements this interface.
    """

    PROVIDER_TYPE: LockProviderType = None
    BASE_URL: str = ""
    AUTH_URL: str = ""

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        """
        Initialize the provider with credentials.

        Args:
            api_key: API key or access token
            api_secret: API secret if required
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self._access_token: Optional[str] = None
        self._token_expires: Optional[datetime] = None
        self._client: Optional[httpx.AsyncClient] = None
        self._codes_cache: Dict[str, List[AccessCode]] = {}
        self._locks_cache: Dict[str, LockInfo] = {}

    async def get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if not self._client:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(30.0),
                headers=await self._get_headers(),
            )
        return self._client

    async def close(self):
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _get_headers(self) -> Dict[str, str]:
        """Get authorization headers."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        token = await self._get_access_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"

        return headers

    async def _get_access_token(self) -> Optional[str]:
        """Get or refresh access token."""
        if self._access_token and self._token_expires and datetime.utcnow() < self._token_expires:
            return self._access_token

        token = await self._authenticate()
        return token

    @abstractmethod
    async def _authenticate(self) -> Optional[str]:
        """
        Authenticate with the provider API.
        Returns access token on success, None on failure.
        """
        pass

    @abstractmethod
    async def list_locks(self) -> List[LockInfo]:
        """
        List all locks associated with this provider account.

        Returns:
            List of LockInfo objects
        """
        pass

    @abstractmethod
    async def get_lock_status(self, lock_id: str) -> Optional[LockInfo]:
        """
        Get current status of a specific lock.

        Args:
            lock_id: Lock identifier

        Returns:
            LockInfo with current status or None if not found
        """
        pass

    @abstractmethod
    async def lock(self, lock_id: str) -> Dict[str, Any]:
        """
        Lock the door.

        Args:
            lock_id: Lock identifier

        Returns:
            Result dict with success status
        """
        pass

    @abstractmethod
    async def unlock(self, lock_id: str, duration_seconds: int = 30) -> Dict[str, Any]:
        """
        Unlock the door (auto-relocks after duration).

        Args:
            lock_id: Lock identifier
            duration_seconds: Seconds until auto-relock

        Returns:
            Result dict with success status
        """
        pass

    @abstractmethod
    async def create_access_code(
        self,
        lock_id: str,
        name: str,
        code: str,
        code_type: CodeType = CodeType.TEMPORARY,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        guest_name: Optional[str] = None,
        guest_phone: Optional[str] = None,
        reservation_id: Optional[str] = None,
    ) -> AccessCode:
        """
        Create an access code on the lock.

        Args:
            lock_id: Lock identifier
            name: Label for the code
            code: The access code digits
            code_type: Type of access code
            start_time: When code becomes active
            end_time: When code expires
            guest_name: Optional guest name
            guest_phone: Optional guest phone for SMS
            reservation_id: Optional booking reference

        Returns:
            Created AccessCode object
        """
        pass

    @abstractmethod
    async def delete_access_code(self, lock_id: str, code_id: str) -> bool:
        """
        Delete an access code from the lock.

        Args:
            lock_id: Lock identifier
            code_id: Code identifier

        Returns:
            True if deleted successfully
        """
        pass

    @abstractmethod
    async def list_access_codes(self, lock_id: str) -> List[AccessCode]:
        """
        List all access codes on a lock.

        Args:
            lock_id: Lock identifier

        Returns:
            List of AccessCode objects
        """
        pass

    @abstractmethod
    async def get_activity_log(
        self,
        lock_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[LockActivityEntry]:
        """
        Get activity log for a lock.

        Args:
            lock_id: Lock identifier
            start_date: Filter start date
            end_date: Filter end date
            limit: Maximum entries to return

        Returns:
            List of LockActivityEntry objects
        """
        pass

    @abstractmethod
    async def get_battery_status(self, lock_id: str) -> Dict[str, Any]:
        """
        Get battery status for a lock.

        Args:
            lock_id: Lock identifier

        Returns:
            Dict with battery_level, is_low, estimated_days_remaining
        """
        pass

    @staticmethod
    def generate_access_code(
        length: int = 6,
        exclude_patterns: bool = True,
        existing_codes: Optional[List[str]] = None,
    ) -> str:
        """
        Generate a secure, unique access code.

        Args:
            length: Code length (4-8 digits)
            exclude_patterns: Exclude sequential/repeated patterns
            existing_codes: List of codes to avoid duplicating

        Returns:
            Generated code string
        """
        existing = set(existing_codes or [])
        max_attempts = 1000

        for _ in range(max_attempts):
            code = ''.join(random.choices(string.digits, k=length))

            # Skip if duplicate
            if code in existing:
                continue

            if exclude_patterns:
                # Check for sequential patterns (123, 321, 234, etc.)
                has_sequence = False
                for i in range(len(code) - 2):
                    chunk = code[i:i+3]
                    ascending = "0123456789"
                    descending = "9876543210"
                    if chunk in ascending or chunk in descending:
                        has_sequence = True
                        break

                if has_sequence:
                    continue

                # Check for repeated digits (111, 222, 000)
                if any(code.count(d) >= 3 for d in set(code)):
                    continue

                # Check for common patterns
                common_patterns = ["1234", "4321", "0000", "1111", "2222", "1212", "6969", "4200"]
                if any(p in code for p in common_patterns):
                    continue

            return code

        # Fallback: return random code
        return ''.join(random.choices(string.digits, k=length))

    @staticmethod
    def generate_code_id(lock_id: str, code: str) -> str:
        """Generate a unique code ID."""
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
        raw = f"{lock_id}_{code}_{timestamp}"
        return hashlib.md5(raw.encode()).hexdigest()[:16].upper()
