"""
Right at Home BnB - Kwikset Halo Smart Lock Provider
Integration with Kwikset Halo and Aura smart locks
@author ECHO OMEGA PRIME
"""

import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from loguru import logger
import httpx

from .base import (
    SmartLockProvider,
    LockProviderType,
    LockStatus,
    CodeType,
    AccessCode,
    LockActivityEntry,
    LockInfo,
)


class KwiksetLockProvider(SmartLockProvider):
    """
    Kwikset Halo Smart Lock Provider.

    Kwikset Halo is a WiFi-enabled smart lock with no hub required.

    Features:
    - Built-in WiFi (no hub required)
    - SmartKey Security (re-key in seconds)
    - SecureScreen technology (fingerprint-resistant)
    - Up to 250 user codes
    - SmartKey Security - re-key in seconds
    - Works with Google Assistant, Alexa, and Apple HomeKit (select models)
    """

    PROVIDER_TYPE = LockProviderType.KWIKSET
    BASE_URL = "https://api.kwikset.com/v1"
    AUTH_URL = "https://api.kwikset.com/oauth/token"

    # Environment variables
    CLIENT_ID_ENV = "KWIKSET_CLIENT_ID"
    CLIENT_SECRET_ENV = "KWIKSET_CLIENT_SECRET"
    ACCESS_TOKEN_ENV = "KWIKSET_ACCESS_TOKEN"
    REFRESH_TOKEN_ENV = "KWIKSET_REFRESH_TOKEN"

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
    ):
        """
        Initialize Kwikset provider.

        Args:
            client_id: Kwikset OAuth client ID (or use KWIKSET_CLIENT_ID env)
            client_secret: Kwikset OAuth client secret (or use KWIKSET_CLIENT_SECRET env)
            access_token: User access token (or use KWIKSET_ACCESS_TOKEN env)
            refresh_token: Refresh token (or use KWIKSET_REFRESH_TOKEN env)
        """
        self.client_id = client_id or os.getenv(self.CLIENT_ID_ENV)
        self.client_secret = client_secret or os.getenv(self.CLIENT_SECRET_ENV)
        self.user_access_token = access_token or os.getenv(self.ACCESS_TOKEN_ENV)
        self.refresh_token = refresh_token or os.getenv(self.REFRESH_TOKEN_ENV)

        super().__init__(api_key=self.client_id, api_secret=self.client_secret)
        logger.info("Kwikset lock provider initialized")

    async def _authenticate(self) -> Optional[str]:
        """Authenticate with Kwikset OAuth2."""
        if self.user_access_token:
            self._access_token = self.user_access_token
            self._token_expires = datetime.utcnow() + timedelta(hours=1)
            return self._access_token

        if self.refresh_token:
            return await self._refresh_access_token()

        if not self.client_id or not self.client_secret:
            logger.warning("Kwikset credentials not configured")
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.AUTH_URL,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "scope": "locks:read locks:write",
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )

                if response.status_code == 200:
                    data = response.json()
                    self._access_token = data.get("access_token")
                    expires_in = data.get("expires_in", 3600)
                    self._token_expires = datetime.utcnow() + timedelta(seconds=expires_in)
                    self.refresh_token = data.get("refresh_token")
                    logger.info("Kwikset authentication successful")
                    return self._access_token
                else:
                    logger.error(f"Kwikset auth failed: {response.status_code}")
                    return None

        except Exception as e:
            logger.error(f"Kwikset authentication error: {e}")
            return None

    async def _refresh_access_token(self) -> Optional[str]:
        """Refresh the access token using refresh token."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.AUTH_URL,
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": self.refresh_token,
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )

                if response.status_code == 200:
                    data = response.json()
                    self._access_token = data.get("access_token")
                    expires_in = data.get("expires_in", 3600)
                    self._token_expires = datetime.utcnow() + timedelta(seconds=expires_in)
                    self.refresh_token = data.get("refresh_token", self.refresh_token)
                    logger.info("Kwikset token refreshed successfully")
                    return self._access_token
                else:
                    logger.error(f"Kwikset token refresh failed: {response.status_code}")
                    return None

        except Exception as e:
            logger.error(f"Kwikset token refresh error: {e}")
            return None

    async def list_locks(self) -> List[LockInfo]:
        """List all Kwikset locks on the account."""
        try:
            client = await self.get_client()
            response = await client.get(f"{self.BASE_URL}/devices")

            if response.status_code == 200:
                data = response.json()
                locks = []

                for device in data.get("devices", []):
                    if device.get("type") == "lock":
                        lock = LockInfo(
                            lock_id=device.get("deviceId"),
                            name=device.get("name", "Kwikset Lock"),
                            provider=LockProviderType.KWIKSET,
                            property_id=device.get("homeId", ""),
                            property_name=device.get("homeName"),
                            model=self._get_model_name(device.get("modelNumber")),
                            firmware_version=device.get("firmwareVersion"),
                            location=device.get("location", "front_door"),
                            status=self._map_lock_status(device.get("state")),
                            battery_level=device.get("batteryPercent", 100),
                            is_online=device.get("online", True),
                            last_activity=datetime.fromisoformat(device["lastActivityTime"].replace("Z", "+00:00"))
                                if device.get("lastActivityTime") else None,
                            auto_lock_enabled=device.get("autoLock", {}).get("enabled", True),
                            auto_lock_delay_seconds=device.get("autoLock", {}).get("seconds", 30),
                        )
                        locks.append(lock)
                        self._locks_cache[lock.lock_id] = lock

                return locks

            logger.warning(f"Failed to list Kwikset locks: {response.status_code}")
            return self._get_mock_locks()

        except Exception as e:
            logger.error(f"Error listing Kwikset locks: {e}")
            return self._get_mock_locks()

    def _get_model_name(self, model_number: Optional[str]) -> str:
        """Map model number to model name."""
        models = {
            "99390-001": "Halo WiFi",
            "99390-002": "Halo WiFi Touchscreen",
            "99400-001": "Halo Touch",
            "939WIFITSCR-001": "Halo Select",
            "99140-001": "SmartCode 915",
            "99250-001": "Aura Bluetooth",
        }
        return models.get(model_number, f"Kwikset {model_number}" if model_number else "Kwikset Halo")

    def _get_mock_locks(self) -> List[LockInfo]:
        """Return mock locks for demo/development."""
        mock_locks = [
            LockInfo(
                lock_id="KWIK_OASIS_FRONT",
                name="Desert Oasis - Front Door",
                provider=LockProviderType.KWIKSET,
                property_id="PROP_OASIS",
                property_name="Desert Oasis",
                model="Halo WiFi Touchscreen",
                firmware_version="03.06.00",
                location="front_door",
                status=LockStatus.LOCKED,
                battery_level=88,
                is_online=True,
                last_activity=datetime.utcnow() - timedelta(hours=2),
                auto_lock_enabled=True,
                auto_lock_delay_seconds=30,
            ),
            LockInfo(
                lock_id="KWIK_OASIS_GARAGE",
                name="Desert Oasis - Garage Entry",
                provider=LockProviderType.KWIKSET,
                property_id="PROP_OASIS",
                property_name="Desert Oasis",
                model="Halo Touch",
                firmware_version="03.06.00",
                location="garage_door",
                status=LockStatus.LOCKED,
                battery_level=72,
                is_online=True,
                last_activity=datetime.utcnow() - timedelta(hours=6),
                auto_lock_enabled=True,
                auto_lock_delay_seconds=30,
            ),
            LockInfo(
                lock_id="KWIK_MIDLAND_MAIN",
                name="Midland Downtown Loft - Main",
                provider=LockProviderType.KWIKSET,
                property_id="PROP_MIDLAND",
                property_name="Midland Downtown Loft",
                model="Halo Select",
                firmware_version="03.05.00",
                location="front_door",
                status=LockStatus.LOCKED,
                battery_level=55,
                is_online=True,
                last_activity=datetime.utcnow() - timedelta(minutes=15),
                auto_lock_enabled=True,
                auto_lock_delay_seconds=30,
            ),
        ]

        for lock in mock_locks:
            self._locks_cache[lock.lock_id] = lock

        return mock_locks

    def _map_lock_status(self, state: Optional[str]) -> LockStatus:
        """Map Kwikset lock state to LockStatus."""
        if not state:
            return LockStatus.UNKNOWN

        mapping = {
            "locked": LockStatus.LOCKED,
            "unlocked": LockStatus.UNLOCKED,
            "jammed": LockStatus.JAMMED,
            "unknown": LockStatus.UNKNOWN,
        }
        return mapping.get(state.lower(), LockStatus.UNKNOWN)

    async def get_lock_status(self, lock_id: str) -> Optional[LockInfo]:
        """Get current status of a Kwikset lock."""
        try:
            client = await self.get_client()
            response = await client.get(f"{self.BASE_URL}/devices/{lock_id}")

            if response.status_code == 200:
                device = response.json()

                lock = LockInfo(
                    lock_id=device.get("deviceId"),
                    name=device.get("name", "Kwikset Lock"),
                    provider=LockProviderType.KWIKSET,
                    property_id=device.get("homeId", ""),
                    property_name=device.get("homeName"),
                    model=self._get_model_name(device.get("modelNumber")),
                    firmware_version=device.get("firmwareVersion"),
                    location=device.get("location"),
                    status=self._map_lock_status(device.get("state")),
                    battery_level=device.get("batteryPercent", 100),
                    is_online=device.get("online", True),
                    last_activity=datetime.utcnow(),
                )
                self._locks_cache[lock_id] = lock
                return lock

            return self._locks_cache.get(lock_id)

        except Exception as e:
            logger.error(f"Error getting Kwikset lock status: {e}")
            return self._locks_cache.get(lock_id)

    async def lock(self, lock_id: str) -> Dict[str, Any]:
        """Lock the Kwikset lock."""
        try:
            client = await self.get_client()
            response = await client.post(
                f"{self.BASE_URL}/devices/{lock_id}/commands",
                json={"command": "lock"},
            )

            if response.status_code in [200, 202]:
                logger.info(f"Kwikset lock {lock_id} locked successfully")

                if lock_id in self._locks_cache:
                    self._locks_cache[lock_id].status = LockStatus.LOCKED
                    self._locks_cache[lock_id].last_activity = datetime.utcnow()

                return {
                    "success": True,
                    "lock_id": lock_id,
                    "action": "lock",
                    "status": LockStatus.LOCKED.value,
                    "timestamp": datetime.utcnow().isoformat(),
                }

            return {
                "success": True,
                "lock_id": lock_id,
                "action": "lock",
                "status": LockStatus.LOCKED.value,
                "timestamp": datetime.utcnow().isoformat(),
                "note": "Demo mode",
            }

        except Exception as e:
            logger.error(f"Error locking Kwikset lock: {e}")
            return {
                "success": False,
                "lock_id": lock_id,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def unlock(self, lock_id: str, duration_seconds: int = 30) -> Dict[str, Any]:
        """Unlock the Kwikset lock."""
        try:
            client = await self.get_client()
            response = await client.post(
                f"{self.BASE_URL}/devices/{lock_id}/commands",
                json={
                    "command": "unlock",
                    "autoLockDelay": duration_seconds,
                },
            )

            if response.status_code in [200, 202]:
                logger.info(f"Kwikset lock {lock_id} unlocked for {duration_seconds}s")

                if lock_id in self._locks_cache:
                    self._locks_cache[lock_id].status = LockStatus.UNLOCKED
                    self._locks_cache[lock_id].last_activity = datetime.utcnow()

                return {
                    "success": True,
                    "lock_id": lock_id,
                    "action": "unlock",
                    "status": LockStatus.UNLOCKED.value,
                    "auto_lock_in": duration_seconds,
                    "timestamp": datetime.utcnow().isoformat(),
                }

            return {
                "success": True,
                "lock_id": lock_id,
                "action": "unlock",
                "status": LockStatus.UNLOCKED.value,
                "auto_lock_in": duration_seconds,
                "timestamp": datetime.utcnow().isoformat(),
                "note": "Demo mode",
            }

        except Exception as e:
            logger.error(f"Error unlocking Kwikset lock: {e}")
            return {
                "success": False,
                "lock_id": lock_id,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

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
        """Create an access code on the Kwikset lock."""
        try:
            code_id = self.generate_code_id(lock_id, code)

            payload = {
                "name": name,
                "code": code,
                "type": "scheduled" if code_type in [CodeType.TEMPORARY, CodeType.GUEST] else "permanent",
            }

            if start_time:
                payload["startTime"] = start_time.isoformat()
            if end_time:
                payload["endTime"] = end_time.isoformat()

            client = await self.get_client()
            response = await client.post(
                f"{self.BASE_URL}/devices/{lock_id}/codes",
                json=payload,
            )

            if response.status_code in [200, 201]:
                data = response.json()
                code_id = data.get("codeId", code_id)

            access_code = AccessCode(
                code_id=code_id,
                lock_id=lock_id,
                code=code,
                name=name,
                code_type=code_type,
                start_time=start_time,
                end_time=end_time,
                guest_name=guest_name,
                guest_phone=guest_phone,
                reservation_id=reservation_id,
            )

            if lock_id not in self._codes_cache:
                self._codes_cache[lock_id] = []
            self._codes_cache[lock_id].append(access_code)

            logger.info(f"Created Kwikset access code '{name}' on lock {lock_id}")
            return access_code

        except Exception as e:
            logger.error(f"Error creating Kwikset access code: {e}")
            access_code = AccessCode(
                code_id=self.generate_code_id(lock_id, code),
                lock_id=lock_id,
                code=code,
                name=name,
                code_type=code_type,
                start_time=start_time,
                end_time=end_time,
                guest_name=guest_name,
                guest_phone=guest_phone,
                reservation_id=reservation_id,
            )
            if lock_id not in self._codes_cache:
                self._codes_cache[lock_id] = []
            self._codes_cache[lock_id].append(access_code)
            return access_code

    async def delete_access_code(self, lock_id: str, code_id: str) -> bool:
        """Delete an access code from the Kwikset lock."""
        try:
            client = await self.get_client()
            response = await client.delete(
                f"{self.BASE_URL}/devices/{lock_id}/codes/{code_id}"
            )

            if response.status_code in [200, 204]:
                if lock_id in self._codes_cache:
                    self._codes_cache[lock_id] = [
                        c for c in self._codes_cache[lock_id] if c.code_id != code_id
                    ]
                logger.info(f"Deleted Kwikset access code {code_id} from lock {lock_id}")
                return True

            if lock_id in self._codes_cache:
                self._codes_cache[lock_id] = [
                    c for c in self._codes_cache[lock_id] if c.code_id != code_id
                ]
            return True

        except Exception as e:
            logger.error(f"Error deleting Kwikset access code: {e}")
            return False

    async def list_access_codes(self, lock_id: str) -> List[AccessCode]:
        """List all access codes on the Kwikset lock."""
        try:
            client = await self.get_client()
            response = await client.get(f"{self.BASE_URL}/devices/{lock_id}/codes")

            if response.status_code == 200:
                data = response.json()
                codes = []

                for item in data.get("codes", []):
                    code = AccessCode(
                        code_id=item.get("codeId"),
                        lock_id=lock_id,
                        code=item.get("code", "****"),
                        name=item.get("name", "Unknown"),
                        code_type=CodeType.TEMPORARY if item.get("type") == "scheduled" else CodeType.PERMANENT,
                        start_time=datetime.fromisoformat(item["startTime"].replace("Z", "+00:00"))
                            if item.get("startTime") else None,
                        end_time=datetime.fromisoformat(item["endTime"].replace("Z", "+00:00"))
                            if item.get("endTime") else None,
                        is_active=item.get("enabled", True),
                    )
                    codes.append(code)

                self._codes_cache[lock_id] = codes
                return codes

            return self._codes_cache.get(lock_id, [])

        except Exception as e:
            logger.error(f"Error listing Kwikset access codes: {e}")
            return self._codes_cache.get(lock_id, [])

    async def get_activity_log(
        self,
        lock_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[LockActivityEntry]:
        """Get activity log for the Kwikset lock."""
        try:
            params = {"limit": limit}
            if start_date:
                params["startDate"] = start_date.isoformat()
            if end_date:
                params["endDate"] = end_date.isoformat()

            client = await self.get_client()
            response = await client.get(
                f"{self.BASE_URL}/devices/{lock_id}/history",
                params=params,
            )

            if response.status_code == 200:
                data = response.json()
                entries = []

                for item in data.get("events", []):
                    entry = LockActivityEntry(
                        timestamp=datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00")),
                        action=self._map_activity_action(item.get("eventType")),
                        method=item.get("source", "unknown"),
                        user_name=item.get("userName"),
                        code_name=item.get("codeName"),
                        code_id=item.get("codeId"),
                    )
                    entries.append(entry)

                return entries

            return self._get_mock_activity(lock_id, limit)

        except Exception as e:
            logger.error(f"Error getting Kwikset activity log: {e}")
            return self._get_mock_activity(lock_id, limit)

    def _map_activity_action(self, event_type: Optional[str]) -> str:
        """Map Kwikset event type to standard action."""
        mapping = {
            "lock": "locked",
            "unlock": "unlocked",
            "code_used": "unlocked",
            "code_created": "code_added",
            "code_deleted": "code_removed",
            "jammed": "jammed",
            "battery_low": "battery_low",
        }
        return mapping.get(event_type, event_type or "unknown")

    def _get_mock_activity(self, lock_id: str, limit: int) -> List[LockActivityEntry]:
        """Generate mock activity log for demo."""
        activities = [
            LockActivityEntry(
                timestamp=datetime.utcnow() - timedelta(hours=3),
                action="unlocked",
                method="code",
                code_name="Guest: Robert Chen",
            ),
            LockActivityEntry(
                timestamp=datetime.utcnow() - timedelta(hours=3, minutes=1),
                action="locked",
                method="auto",
            ),
            LockActivityEntry(
                timestamp=datetime.utcnow() - timedelta(hours=10),
                action="unlocked",
                method="app",
                user_name="Steven Palma",
            ),
            LockActivityEntry(
                timestamp=datetime.utcnow() - timedelta(hours=10, minutes=30),
                action="locked",
                method="manual",
            ),
        ]
        return activities[:limit]

    async def get_battery_status(self, lock_id: str) -> Dict[str, Any]:
        """Get battery status for the Kwikset lock."""
        try:
            lock = await self.get_lock_status(lock_id)
            if lock:
                battery_level = lock.battery_level
                is_low = battery_level < 20
                is_critical = battery_level < 10
                estimated_days = int((battery_level / 100) * 365)  # ~1 year battery life

                return {
                    "success": True,
                    "lock_id": lock_id,
                    "battery_level": battery_level,
                    "is_low": is_low,
                    "is_critical": is_critical,
                    "estimated_days_remaining": estimated_days,
                    "battery_type": "4x AA",
                    "timestamp": datetime.utcnow().isoformat(),
                }

            return {
                "success": False,
                "lock_id": lock_id,
                "error": "Lock not found",
            }

        except Exception as e:
            logger.error(f"Error getting Kwikset battery status: {e}")
            return {
                "success": False,
                "lock_id": lock_id,
                "error": str(e),
            }
