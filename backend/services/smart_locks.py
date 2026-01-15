"""
Right at Home BnB - Smart Lock Integration Service
Support for Schlage, Yale, and August smart locks
@author ECHO OMEGA PRIME
"""

import os
import random
import string
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
from loguru import logger
import httpx

# Lock Provider Configurations
LOCK_PROVIDERS = {
    "schlage": {
        "base_url": "https://api.allegion.com/v1",
        "auth_url": "https://api.allegion.com/oauth2/token",
    },
    "yale": {
        "base_url": "https://api.augusthome.com/v1",  # Yale uses August API
        "auth_url": "https://api.augusthome.com/v1/authorize",
    },
    "august": {
        "base_url": "https://api.augusthome.com/v1",
        "auth_url": "https://api.augusthome.com/v1/authorize",
    },
}


class LockProvider(str, Enum):
    SCHLAGE = "schlage"
    YALE = "yale"
    AUGUST = "august"


class LockStatus(str, Enum):
    LOCKED = "locked"
    UNLOCKED = "unlocked"
    UNKNOWN = "unknown"
    OFFLINE = "offline"


class CodeType(str, Enum):
    PERMANENT = "permanent"
    TEMPORARY = "temporary"
    ONE_TIME = "one_time"
    SCHEDULED = "scheduled"


class SmartLockService:
    """
    Unified smart lock service for multiple providers.
    Supports Schlage Encode, Yale Assure, and August smart locks.
    """

    def __init__(self):
        self.schlage_token = os.getenv("SCHLAGE_API_TOKEN")
        self.august_token = os.getenv("AUGUST_API_TOKEN")
        self.yale_token = os.getenv("YALE_API_TOKEN")
        self._lock_cache: Dict[str, Dict] = {}

    async def _get_headers(self, provider: LockProvider) -> Dict[str, str]:
        """Get authorization headers for a provider."""
        tokens = {
            LockProvider.SCHLAGE: self.schlage_token,
            LockProvider.YALE: self.yale_token,
            LockProvider.AUGUST: self.august_token,
        }
        return {
            "Authorization": f"Bearer {tokens.get(provider, '')}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def generate_access_code(length: int = 6, exclude_patterns: bool = True) -> str:
        """
        Generate a secure access code.

        Args:
            length: Code length (default 6)
            exclude_patterns: Exclude sequential/repeated digits

        Returns:
            Generated code string
        """
        while True:
            code = ''.join(random.choices(string.digits, k=length))

            if exclude_patterns:
                # Check for sequential patterns (123, 321)
                has_sequence = False
                for i in range(len(code) - 2):
                    chunk = code[i:i+3]
                    if chunk in "0123456789" or chunk in "9876543210":
                        has_sequence = True
                        break

                # Check for repeated digits (111, 222)
                has_repeat = any(code.count(d) >= 3 for d in set(code))

                if not has_sequence and not has_repeat:
                    return code
            else:
                return code

    async def list_locks(self, provider: Optional[LockProvider] = None) -> Dict[str, Any]:
        """
        List all smart locks, optionally filtered by provider.

        Args:
            provider: Optional provider filter

        Returns:
            Dict with list of locks and metadata
        """
        try:
            all_locks = []

            providers_to_query = [provider] if provider else list(LockProvider)

            for p in providers_to_query:
                locks = await self._fetch_provider_locks(p)
                all_locks.extend(locks)

            return {
                "success": True,
                "locks": all_locks,
                "count": len(all_locks),
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error listing locks: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def _fetch_provider_locks(self, provider: LockProvider) -> List[Dict]:
        """Fetch locks from a specific provider."""
        # In production, this would call the actual provider API
        # For now, return mock data representing Steven's 22 properties

        mock_locks = [
            {"id": "SCH001", "name": "Castleford Estate - Front", "provider": "schlage", "battery": 85, "online": True},
            {"id": "SCH002", "name": "Castleford Estate - Side", "provider": "schlage", "battery": 92, "online": True},
            {"id": "YAL001", "name": "Permian Palace - Main", "provider": "yale", "battery": 78, "online": True},
            {"id": "YAL002", "name": "Permian Palace - Garage", "provider": "yale", "battery": 65, "online": True},
            {"id": "AUG001", "name": "Sunset Retreat - Front", "provider": "august", "battery": 90, "online": True},
            {"id": "AUG002", "name": "Basin View Cottage", "provider": "august", "battery": 45, "online": True},
            {"id": "SCH003", "name": "Desert Rose Villa - Main", "provider": "schlage", "battery": 88, "online": True},
            {"id": "SCH004", "name": "Desert Rose Villa - Pool", "provider": "schlage", "battery": 71, "online": False},
            {"id": "YAL003", "name": "Oilfield Executive Suite", "provider": "yale", "battery": 95, "online": True},
            {"id": "AUG003", "name": "West Texas Haven", "provider": "august", "battery": 82, "online": True},
        ]

        return [l for l in mock_locks if provider is None or l["provider"] == provider.value]

    async def get_lock_status(self, lock_id: str) -> Dict[str, Any]:
        """
        Get the current status of a specific lock.

        Args:
            lock_id: Lock identifier

        Returns:
            Dict with lock status details
        """
        try:
            # In production, would query the actual lock
            # Mock response
            return {
                "success": True,
                "lock_id": lock_id,
                "status": LockStatus.LOCKED.value,
                "battery_level": random.randint(60, 100),
                "online": True,
                "last_activity": datetime.utcnow().isoformat(),
                "last_locked": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error getting lock status: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def lock(self, lock_id: str) -> Dict[str, Any]:
        """
        Lock a smart lock.

        Args:
            lock_id: Lock identifier

        Returns:
            Dict with operation result
        """
        try:
            logger.info(f"Locking {lock_id}")
            # In production, would send lock command to provider
            return {
                "success": True,
                "lock_id": lock_id,
                "action": "lock",
                "status": LockStatus.LOCKED.value,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error locking {lock_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def unlock(self, lock_id: str, duration_seconds: int = 30) -> Dict[str, Any]:
        """
        Unlock a smart lock (auto-relocks after duration).

        Args:
            lock_id: Lock identifier
            duration_seconds: Seconds until auto-relock

        Returns:
            Dict with operation result
        """
        try:
            logger.info(f"Unlocking {lock_id} for {duration_seconds}s")
            # In production, would send unlock command to provider
            return {
                "success": True,
                "lock_id": lock_id,
                "action": "unlock",
                "status": LockStatus.UNLOCKED.value,
                "auto_lock_in": duration_seconds,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error unlocking {lock_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def create_access_code(
        self,
        lock_id: str,
        name: str,
        code: Optional[str] = None,
        code_type: CodeType = CodeType.TEMPORARY,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        max_uses: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Create an access code for a lock.

        Args:
            lock_id: Lock identifier
            name: Name/label for the code (e.g., "Guest: John Smith")
            code: Specific code to use (auto-generated if not provided)
            code_type: Type of access code
            start_time: When code becomes active
            end_time: When code expires
            max_uses: Maximum number of uses (for one_time type)

        Returns:
            Dict with created code details
        """
        try:
            # Generate code if not provided
            if not code:
                code = self.generate_access_code()

            # Default times for temporary codes
            if code_type == CodeType.TEMPORARY and not start_time:
                start_time = datetime.utcnow()
            if code_type == CodeType.TEMPORARY and not end_time:
                end_time = datetime.utcnow() + timedelta(days=7)

            logger.info(f"Creating access code '{name}' for {lock_id}")

            return {
                "success": True,
                "lock_id": lock_id,
                "code_id": f"CODE_{lock_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                "code": code,
                "name": name,
                "type": code_type.value,
                "start_time": start_time.isoformat() if start_time else None,
                "end_time": end_time.isoformat() if end_time else None,
                "max_uses": max_uses,
                "uses_remaining": max_uses,
                "created_at": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error creating access code: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def list_access_codes(self, lock_id: str) -> Dict[str, Any]:
        """
        List all access codes for a lock.

        Args:
            lock_id: Lock identifier

        Returns:
            Dict with list of access codes
        """
        try:
            # Mock codes
            codes = [
                {
                    "code_id": "CODE001",
                    "name": "Master Code",
                    "type": "permanent",
                    "active": True,
                    "created_at": "2024-01-01T00:00:00Z",
                },
                {
                    "code_id": "CODE002",
                    "name": "Guest: John Smith",
                    "type": "temporary",
                    "active": True,
                    "start_time": "2024-01-15T15:00:00Z",
                    "end_time": "2024-01-18T11:00:00Z",
                },
                {
                    "code_id": "CODE003",
                    "name": "Cleaner: Maria",
                    "type": "scheduled",
                    "active": True,
                    "schedule": "Mon-Fri 09:00-17:00",
                },
            ]

            return {
                "success": True,
                "lock_id": lock_id,
                "codes": codes,
                "count": len(codes),
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error listing access codes: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def delete_access_code(self, lock_id: str, code_id: str) -> Dict[str, Any]:
        """
        Delete an access code.

        Args:
            lock_id: Lock identifier
            code_id: Code identifier

        Returns:
            Dict with operation result
        """
        try:
            logger.info(f"Deleting access code {code_id} from {lock_id}")
            return {
                "success": True,
                "lock_id": lock_id,
                "code_id": code_id,
                "action": "deleted",
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error deleting access code: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def get_activity_log(
        self,
        lock_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """
        Get activity log for a lock.

        Args:
            lock_id: Lock identifier
            start_date: Filter start date
            end_date: Filter end date
            limit: Maximum entries to return

        Returns:
            Dict with activity entries
        """
        try:
            # Mock activity log
            activities = [
                {
                    "timestamp": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
                    "action": "unlocked",
                    "method": "code",
                    "code_name": "Guest: John Smith",
                },
                {
                    "timestamp": (datetime.utcnow() - timedelta(hours=1, minutes=2)).isoformat(),
                    "action": "locked",
                    "method": "auto",
                },
                {
                    "timestamp": (datetime.utcnow() - timedelta(hours=5)).isoformat(),
                    "action": "unlocked",
                    "method": "app",
                    "user": "Steven Palma",
                },
                {
                    "timestamp": (datetime.utcnow() - timedelta(hours=5, minutes=30)).isoformat(),
                    "action": "locked",
                    "method": "manual",
                },
            ]

            return {
                "success": True,
                "lock_id": lock_id,
                "activities": activities[:limit],
                "count": len(activities),
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error getting activity log: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def create_guest_access(
        self,
        lock_ids: List[str],
        guest_name: str,
        check_in: datetime,
        check_out: datetime,
    ) -> Dict[str, Any]:
        """
        Create access codes for a guest across multiple locks.
        Generates a single code that works on all specified locks.

        Args:
            lock_ids: List of lock identifiers
            guest_name: Guest name for labeling
            check_in: Check-in datetime
            check_out: Check-out datetime

        Returns:
            Dict with created codes for all locks
        """
        try:
            # Generate a single code for all locks
            code = self.generate_access_code()
            results = []

            for lock_id in lock_ids:
                result = await self.create_access_code(
                    lock_id=lock_id,
                    name=f"Guest: {guest_name}",
                    code=code,
                    code_type=CodeType.TEMPORARY,
                    start_time=check_in,
                    end_time=check_out,
                )
                results.append(result)

            return {
                "success": True,
                "guest_name": guest_name,
                "access_code": code,
                "valid_from": check_in.isoformat(),
                "valid_until": check_out.isoformat(),
                "locks": results,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error creating guest access: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def revoke_guest_access(
        self,
        lock_ids: List[str],
        guest_name: str,
    ) -> Dict[str, Any]:
        """
        Revoke all access codes for a guest.

        Args:
            lock_ids: List of lock identifiers
            guest_name: Guest name to revoke

        Returns:
            Dict with revocation results
        """
        try:
            results = []
            for lock_id in lock_ids:
                # In production, would find and delete codes by guest name
                results.append({
                    "lock_id": lock_id,
                    "revoked": True,
                })

            return {
                "success": True,
                "guest_name": guest_name,
                "locks_updated": len(results),
                "results": results,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error revoking guest access: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }


# Singleton instance
smart_lock_service = SmartLockService()


# Quick utility functions
async def generate_guest_code(
    property_id: str,
    guest_name: str,
    check_in: datetime,
    check_out: datetime,
) -> str:
    """Quick function to generate a guest access code."""
    # Would look up lock IDs for property
    lock_ids = [f"LOCK_{property_id}"]
    result = await smart_lock_service.create_guest_access(
        lock_ids=lock_ids,
        guest_name=guest_name,
        check_in=check_in,
        check_out=check_out,
    )
    return result.get("access_code", "")


async def quick_unlock(lock_id: str) -> bool:
    """Quick unlock a lock."""
    result = await smart_lock_service.unlock(lock_id)
    return result.get("success", False)
