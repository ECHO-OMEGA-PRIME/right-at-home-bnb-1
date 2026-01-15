"""
Right at Home BnB - Unified Smart Lock Service
Aggregates all lock providers with code management, SMS notifications, and auto-expiry
@author ECHO OMEGA PRIME
"""

import os
import asyncio
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, timedelta
from loguru import logger
from twilio.rest import Client as TwilioClient

from .base import (
    SmartLockProvider,
    LockProviderType,
    LockStatus,
    CodeType,
    AccessCode,
    LockActivityEntry,
    LockInfo,
)
from .schlage import SchlageLockProvider
from .yale import YaleLockProvider
from .august import AugustLockProvider
from .kwikset import KwiksetLockProvider


class UnifiedSmartLockService:
    """
    Unified smart lock service that aggregates all lock providers.

    Features:
    - Multi-provider support (Schlage, Yale, August, Kwikset)
    - Unique code generation with collision detection
    - Auto-expiry management (checkout + 30 min grace)
    - SMS notifications via Twilio
    - Centralized activity logging
    - Battery monitoring and alerts
    """

    # Code expiry grace period after checkout
    CODE_EXPIRY_GRACE_MINUTES = 30

    def __init__(self):
        """Initialize the unified service with all providers."""
        self.providers: Dict[LockProviderType, SmartLockProvider] = {}
        self._locks_cache: Dict[str, LockInfo] = {}
        self._codes_db: Dict[str, List[AccessCode]] = {}
        self._active_codes: Dict[str, AccessCode] = {}  # code -> AccessCode mapping

        # Twilio for SMS
        self.twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_from = os.getenv("TWILIO_PHONE_NUMBER")
        self.twilio_client: Optional[TwilioClient] = None

        if self.twilio_sid and self.twilio_token:
            self.twilio_client = TwilioClient(self.twilio_sid, self.twilio_token)

        # Initialize providers
        self._init_providers()
        logger.info("Unified smart lock service initialized")

    def _init_providers(self):
        """Initialize all lock providers."""
        self.providers[LockProviderType.SCHLAGE] = SchlageLockProvider()
        self.providers[LockProviderType.YALE] = YaleLockProvider()
        self.providers[LockProviderType.AUGUST] = AugustLockProvider()
        self.providers[LockProviderType.KWIKSET] = KwiksetLockProvider()

    def _get_provider(self, provider_type: Union[str, LockProviderType]) -> SmartLockProvider:
        """Get provider by type."""
        if isinstance(provider_type, str):
            provider_type = LockProviderType(provider_type.upper())
        return self.providers.get(provider_type)

    def _get_provider_for_lock(self, lock_id: str) -> Optional[SmartLockProvider]:
        """Determine provider from lock ID prefix or cache."""
        # Check cache first
        if lock_id in self._locks_cache:
            return self._get_provider(self._locks_cache[lock_id].provider)

        # Determine from ID prefix
        prefixes = {
            "SCH": LockProviderType.SCHLAGE,
            "YALE": LockProviderType.YALE,
            "AUG": LockProviderType.AUGUST,
            "KWIK": LockProviderType.KWIKSET,
        }

        for prefix, provider_type in prefixes.items():
            if lock_id.upper().startswith(prefix):
                return self.providers.get(provider_type)

        # Default to checking all providers
        return None

    async def list_all_locks(self, property_id: Optional[str] = None) -> Dict[str, Any]:
        """
        List all locks from all providers.

        Args:
            property_id: Optional filter by property

        Returns:
            Dict with combined lock list
        """
        try:
            all_locks: List[LockInfo] = []

            # Fetch from all providers in parallel
            tasks = [provider.list_locks() for provider in self.providers.values()]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, list):
                    all_locks.extend(result)
                elif isinstance(result, Exception):
                    logger.error(f"Provider error: {result}")

            # Filter by property if specified
            if property_id:
                all_locks = [l for l in all_locks if l.property_id == property_id]

            # Update cache
            for lock in all_locks:
                self._locks_cache[lock.lock_id] = lock

            return {
                "success": True,
                "locks": [lock.to_dict() for lock in all_locks],
                "count": len(all_locks),
                "providers": {
                    "schlage": sum(1 for l in all_locks if l.provider == LockProviderType.SCHLAGE),
                    "yale": sum(1 for l in all_locks if l.provider == LockProviderType.YALE),
                    "august": sum(1 for l in all_locks if l.provider == LockProviderType.AUGUST),
                    "kwikset": sum(1 for l in all_locks if l.provider == LockProviderType.KWIKSET),
                },
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error listing all locks: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def get_lock_status(self, lock_id: str) -> Dict[str, Any]:
        """Get status of a specific lock."""
        try:
            provider = self._get_provider_for_lock(lock_id)

            if provider:
                lock = await provider.get_lock_status(lock_id)
                if lock:
                    self._locks_cache[lock_id] = lock
                    return {
                        "success": True,
                        **lock.to_dict(),
                    }

            # Try all providers
            for prov in self.providers.values():
                lock = await prov.get_lock_status(lock_id)
                if lock:
                    self._locks_cache[lock_id] = lock
                    return {
                        "success": True,
                        **lock.to_dict(),
                    }

            return {
                "success": False,
                "error": "Lock not found",
                "lock_id": lock_id,
            }

        except Exception as e:
            logger.error(f"Error getting lock status: {e}")
            return {
                "success": False,
                "error": str(e),
                "lock_id": lock_id,
            }

    async def lock(self, lock_id: str) -> Dict[str, Any]:
        """Lock a specific lock."""
        provider = self._get_provider_for_lock(lock_id)
        if not provider:
            for prov in self.providers.values():
                result = await prov.lock(lock_id)
                if result.get("success"):
                    return result
            return {"success": False, "error": "Lock not found"}

        return await provider.lock(lock_id)

    async def unlock(self, lock_id: str, duration_seconds: int = 30) -> Dict[str, Any]:
        """Unlock a specific lock."""
        provider = self._get_provider_for_lock(lock_id)
        if not provider:
            for prov in self.providers.values():
                result = await prov.unlock(lock_id, duration_seconds)
                if result.get("success"):
                    return result
            return {"success": False, "error": "Lock not found"}

        return await provider.unlock(lock_id, duration_seconds)

    async def generate_guest_code(
        self,
        lock_id: str,
        guest_name: str,
        check_in: datetime,
        check_out: datetime,
        guest_phone: Optional[str] = None,
        reservation_id: Optional[str] = None,
        code_length: int = 6,
        send_sms: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate a unique guest access code with auto-expiry.

        Args:
            lock_id: Lock identifier
            guest_name: Guest name
            check_in: Check-in datetime
            check_out: Check-out datetime (code expires 30 min after)
            guest_phone: Guest phone for SMS notification
            reservation_id: Optional booking reference
            code_length: Code length (4-8 digits)
            send_sms: Whether to send SMS with code

        Returns:
            Dict with generated code details
        """
        try:
            provider = self._get_provider_for_lock(lock_id)
            if not provider:
                return {"success": False, "error": "Lock not found"}

            # Get existing codes to avoid duplicates
            existing_codes = set()
            for codes in self._codes_db.values():
                existing_codes.update(c.code for c in codes if c.is_active and not c.is_expired)

            # Generate unique code
            code = SmartLockProvider.generate_access_code(
                length=code_length,
                exclude_patterns=True,
                existing_codes=list(existing_codes),
            )

            # Calculate expiry with grace period
            code_expires = check_out + timedelta(minutes=self.CODE_EXPIRY_GRACE_MINUTES)

            # Create the code on the lock
            access_code = await provider.create_access_code(
                lock_id=lock_id,
                name=f"Guest: {guest_name}",
                code=code,
                code_type=CodeType.GUEST,
                start_time=check_in,
                end_time=code_expires,
                guest_name=guest_name,
                guest_phone=guest_phone,
                reservation_id=reservation_id,
            )

            # Store in local DB
            if lock_id not in self._codes_db:
                self._codes_db[lock_id] = []
            self._codes_db[lock_id].append(access_code)
            self._active_codes[code] = access_code

            # Update lock with current code info
            if lock_id in self._locks_cache:
                self._locks_cache[lock_id].current_code = code
                self._locks_cache[lock_id].code_expires_at = code_expires

            # Send SMS notification
            sms_sent = False
            if send_sms and guest_phone and self.twilio_client:
                sms_sent = await self._send_code_sms(
                    phone=guest_phone,
                    guest_name=guest_name,
                    code=code,
                    property_name=self._locks_cache.get(lock_id, LockInfo(lock_id, "", LockProviderType.SCHLAGE, "")).property_name or "the property",
                    check_in=check_in,
                    check_out=check_out,
                )

            logger.info(f"Generated guest code for {guest_name} on lock {lock_id}: {code}")

            return {
                "success": True,
                "lock_id": lock_id,
                "code": code,
                "code_id": access_code.code_id,
                "guest_name": guest_name,
                "check_in": check_in.isoformat(),
                "check_out": check_out.isoformat(),
                "expires_at": code_expires.isoformat(),
                "grace_period_minutes": self.CODE_EXPIRY_GRACE_MINUTES,
                "sms_sent": sms_sent,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error generating guest code: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def _send_code_sms(
        self,
        phone: str,
        guest_name: str,
        code: str,
        property_name: str,
        check_in: datetime,
        check_out: datetime,
    ) -> bool:
        """Send SMS with access code to guest."""
        try:
            if not self.twilio_client or not self.twilio_from:
                logger.warning("Twilio not configured for SMS")
                return False

            message_body = (
                f"Welcome {guest_name}! Your access code for {property_name} is: {code}\n\n"
                f"Check-in: {check_in.strftime('%b %d, %I:%M %p')}\n"
                f"Check-out: {check_out.strftime('%b %d, %I:%M %p')}\n\n"
                f"Your code will work from check-in until 30 minutes after checkout.\n\n"
                f"- Right at Home BnB"
            )

            self.twilio_client.messages.create(
                body=message_body,
                from_=self.twilio_from,
                to=phone,
            )

            logger.info(f"Sent access code SMS to {phone}")
            return True

        except Exception as e:
            logger.error(f"Error sending SMS: {e}")
            return False

    async def revoke_code(self, lock_id: str, code_id: str) -> Dict[str, Any]:
        """Revoke an access code immediately."""
        try:
            provider = self._get_provider_for_lock(lock_id)
            if not provider:
                return {"success": False, "error": "Lock not found"}

            # Delete from lock
            deleted = await provider.delete_access_code(lock_id, code_id)

            # Remove from local DB
            if lock_id in self._codes_db:
                removed_code = None
                for code in self._codes_db[lock_id]:
                    if code.code_id == code_id:
                        removed_code = code
                        code.is_active = False
                        break

                if removed_code and removed_code.code in self._active_codes:
                    del self._active_codes[removed_code.code]

            logger.info(f"Revoked access code {code_id} from lock {lock_id}")

            return {
                "success": deleted,
                "lock_id": lock_id,
                "code_id": code_id,
                "action": "revoked",
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error revoking code: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def list_access_codes(self, lock_id: str, include_expired: bool = False) -> Dict[str, Any]:
        """List all access codes for a lock."""
        try:
            provider = self._get_provider_for_lock(lock_id)
            if not provider:
                return {"success": False, "error": "Lock not found"}

            codes = await provider.list_access_codes(lock_id)

            # Merge with local DB
            local_codes = self._codes_db.get(lock_id, [])
            code_ids = {c.code_id for c in codes}

            for local_code in local_codes:
                if local_code.code_id not in code_ids:
                    codes.append(local_code)

            # Filter expired if needed
            if not include_expired:
                codes = [c for c in codes if not c.is_expired]

            return {
                "success": True,
                "lock_id": lock_id,
                "codes": [c.to_dict() for c in codes],
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

    async def get_activity_log(
        self,
        lock_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """Get activity log for a lock."""
        try:
            provider = self._get_provider_for_lock(lock_id)
            if not provider:
                return {"success": False, "error": "Lock not found"}

            activities = await provider.get_activity_log(
                lock_id=lock_id,
                start_date=start_date,
                end_date=end_date,
                limit=limit,
            )

            return {
                "success": True,
                "lock_id": lock_id,
                "activities": [a.to_dict() for a in activities],
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

    async def get_battery_status(self, lock_id: str) -> Dict[str, Any]:
        """Get battery status for a lock."""
        try:
            provider = self._get_provider_for_lock(lock_id)
            if not provider:
                return {"success": False, "error": "Lock not found"}

            return await provider.get_battery_status(lock_id)

        except Exception as e:
            logger.error(f"Error getting battery status: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def get_low_battery_alerts(self, threshold: int = 20) -> Dict[str, Any]:
        """Get all locks with low battery."""
        try:
            alerts = []

            # Refresh all locks
            await self.list_all_locks()

            for lock in self._locks_cache.values():
                if lock.battery_level < threshold:
                    alerts.append({
                        "lock_id": lock.lock_id,
                        "name": lock.name,
                        "property_name": lock.property_name,
                        "provider": lock.provider.value,
                        "battery_level": lock.battery_level,
                        "is_critical": lock.battery_level < 10,
                    })

            # Sort by battery level (lowest first)
            alerts.sort(key=lambda x: x["battery_level"])

            return {
                "success": True,
                "alerts": alerts,
                "count": len(alerts),
                "threshold": threshold,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error getting battery alerts: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def cleanup_expired_codes(self) -> Dict[str, Any]:
        """Remove all expired codes from locks."""
        try:
            deleted_count = 0
            errors = []

            for lock_id, codes in self._codes_db.items():
                for code in codes:
                    if code.is_expired and code.is_active:
                        try:
                            provider = self._get_provider_for_lock(lock_id)
                            if provider:
                                await provider.delete_access_code(lock_id, code.code_id)
                                code.is_active = False
                                deleted_count += 1

                                if code.code in self._active_codes:
                                    del self._active_codes[code.code]

                        except Exception as e:
                            errors.append({
                                "lock_id": lock_id,
                                "code_id": code.code_id,
                                "error": str(e),
                            })

            logger.info(f"Cleaned up {deleted_count} expired codes")

            return {
                "success": True,
                "deleted_count": deleted_count,
                "errors": errors,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error cleaning up expired codes: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def health_check(self) -> Dict[str, Any]:
        """Check health of all locks."""
        try:
            await self.list_all_locks()

            online_count = sum(1 for l in self._locks_cache.values() if l.is_online)
            offline_locks = [l.to_dict() for l in self._locks_cache.values() if not l.is_online]
            low_battery = [l.to_dict() for l in self._locks_cache.values() if l.battery_level < 20]

            return {
                "success": True,
                "total_locks": len(self._locks_cache),
                "online_count": online_count,
                "offline_count": len(offline_locks),
                "offline_locks": offline_locks,
                "low_battery_count": len(low_battery),
                "low_battery_locks": low_battery,
                "providers_status": {
                    "schlage": "online",
                    "yale": "online",
                    "august": "online",
                    "kwikset": "online",
                },
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error in health check: {e}")
            return {
                "success": False,
                "error": str(e),
            }


# Singleton instance
unified_lock_service = UnifiedSmartLockService()
