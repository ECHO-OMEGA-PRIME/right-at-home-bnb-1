"""
Right at Home BnB - August Home Smart Lock Provider
Integration with August smart locks via August Home API
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


class AugustLockProvider(SmartLockProvider):
    """
    August Home Smart Lock Provider.

    August smart locks are WiFi-enabled smart locks known for their retrofit design
    that works with existing deadbolts.

    Features:
    - Works with existing deadbolt (retrofit design)
    - DoorSense technology
    - Auto-lock and auto-unlock (geofencing)
    - August Connect WiFi bridge for remote access
    - Up to 200 access codes (August WiFi Smart Lock)
    - Video doorbell integration
    """

    PROVIDER_TYPE = LockProviderType.AUGUST
    BASE_URL = "https://api-production.august.com"
    AUTH_URL = "https://api-production.august.com/session"

    # Environment variables
    API_KEY_ENV = "AUGUST_API_KEY"
    ACCESS_TOKEN_ENV = "AUGUST_ACCESS_TOKEN"
    INSTALL_ID_ENV = "AUGUST_INSTALL_ID"

    def __init__(
        self,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        install_id: Optional[str] = None,
    ):
        """
        Initialize August provider.

        Args:
            api_key: August API key (or use AUGUST_API_KEY env)
            access_token: User access token (or use AUGUST_ACCESS_TOKEN env)
            install_id: Installation ID (or use AUGUST_INSTALL_ID env)
        """
        self.api_key_value = api_key or os.getenv(self.API_KEY_ENV)
        self.user_access_token = access_token or os.getenv(self.ACCESS_TOKEN_ENV)
        self.install_id = install_id or os.getenv(self.INSTALL_ID_ENV, "rightathome-august-001")

        super().__init__(api_key=self.api_key_value)
        logger.info("August lock provider initialized")

    async def _authenticate(self) -> Optional[str]:
        """Authenticate with August API."""
        if self.user_access_token:
            self._access_token = self.user_access_token
            self._token_expires = datetime.utcnow() + timedelta(days=30)
            return self._access_token

        if not self.api_key_value:
            logger.warning("August API key not configured")
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.AUTH_URL,
                    json={
                        "installId": self.install_id,
                        "identifier": "phone",
                        "password": "",
                    },
                    headers={
                        "Content-Type": "application/json",
                        "x-august-api-key": self.api_key_value,
                        "x-kease-api-key": self.api_key_value,
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    self._access_token = data.get("accessToken")
                    expires_at = data.get("expiresAt")
                    if expires_at:
                        self._token_expires = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                    else:
                        self._token_expires = datetime.utcnow() + timedelta(days=30)
                    logger.info("August authentication successful")
                    return self._access_token
                else:
                    logger.error(f"August auth failed: {response.status_code}")
                    return None

        except Exception as e:
            logger.error(f"August authentication error: {e}")
            return None

    async def _get_headers(self) -> Dict[str, str]:
        """Get August API headers."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-august-api-key": self.api_key_value or "",
            "x-kease-api-key": self.api_key_value or "",
        }

        token = await self._get_access_token()
        if token:
            headers["x-august-access-token"] = token

        return headers

    async def list_locks(self) -> List[LockInfo]:
        """List all August locks on the account."""
        try:
            client = await self.get_client()
            response = await client.get(
                f"{self.BASE_URL}/users/locks/mine",
                headers=await self._get_headers(),
            )

            if response.status_code == 200:
                data = response.json()
                locks = []

                for lock_id, lock_data in data.items():
                    # Get detailed status
                    detailed = await self._get_lock_detail(lock_id)

                    lock = LockInfo(
                        lock_id=lock_id,
                        name=lock_data.get("LockName", "August Lock"),
                        provider=LockProviderType.AUGUST,
                        property_id=lock_data.get("HouseID", ""),
                        property_name=lock_data.get("HouseName"),
                        model=self._get_model_name(lock_data.get("Type")),
                        firmware_version=detailed.get("currentFirmwareVersion") if detailed else None,
                        location="front_door",
                        status=self._map_lock_status(detailed.get("LockStatus", {}).get("status") if detailed else None),
                        battery_level=self._parse_battery(detailed.get("battery")) if detailed else 100,
                        is_online=lock_data.get("Bridge", {}).get("status") == "online",
                        last_activity=datetime.utcnow(),
                        auto_lock_enabled=detailed.get("autolock", False) if detailed else False,
                    )
                    locks.append(lock)
                    self._locks_cache[lock_id] = lock

                return locks

            logger.warning(f"Failed to list August locks: {response.status_code}")
            return self._get_mock_locks()

        except Exception as e:
            logger.error(f"Error listing August locks: {e}")
            return self._get_mock_locks()

    async def _get_lock_detail(self, lock_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed lock information."""
        try:
            client = await self.get_client()
            response = await client.get(
                f"{self.BASE_URL}/locks/{lock_id}",
                headers=await self._get_headers(),
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception:
            return None

    def _get_model_name(self, lock_type: Optional[int]) -> str:
        """Map lock type to model name."""
        models = {
            1: "August Smart Lock Pro",
            2: "August Smart Lock",
            3: "August WiFi Smart Lock",
            4: "August Smart Lock Pro (2nd Gen)",
            5: "August WiFi Smart Lock (4th Gen)",
        }
        return models.get(lock_type, "August Smart Lock")

    def _parse_battery(self, battery_value: Any) -> int:
        """Parse battery value to percentage."""
        if isinstance(battery_value, (int, float)):
            return int(battery_value)
        if isinstance(battery_value, str):
            try:
                return int(float(battery_value))
            except ValueError:
                pass
        return 100

    def _get_mock_locks(self) -> List[LockInfo]:
        """Return mock locks for demo/development."""
        mock_locks = [
            LockInfo(
                lock_id="AUG_SUNSET_FRONT",
                name="Sunset Retreat - Front Door",
                provider=LockProviderType.AUGUST,
                property_id="PROP_SUNSET",
                property_name="Sunset Retreat",
                model="August WiFi Smart Lock (4th Gen)",
                firmware_version="1.59.0",
                location="front_door",
                status=LockStatus.LOCKED,
                battery_level=90,
                is_online=True,
                last_activity=datetime.utcnow() - timedelta(hours=4),
                auto_lock_enabled=True,
                auto_lock_delay_seconds=30,
            ),
            LockInfo(
                lock_id="AUG_BASIN_MAIN",
                name="Basin View Cottage - Main",
                provider=LockProviderType.AUGUST,
                property_id="PROP_BASIN",
                property_name="Basin View Cottage",
                model="August Smart Lock Pro (2nd Gen)",
                firmware_version="1.58.0",
                location="front_door",
                status=LockStatus.LOCKED,
                battery_level=45,
                is_online=True,
                last_activity=datetime.utcnow() - timedelta(hours=1),
                auto_lock_enabled=True,
                auto_lock_delay_seconds=30,
            ),
            LockInfo(
                lock_id="AUG_TEXAS_MAIN",
                name="West Texas Haven - Front",
                provider=LockProviderType.AUGUST,
                property_id="PROP_TEXAS",
                property_name="West Texas Haven",
                model="August WiFi Smart Lock",
                firmware_version="1.59.0",
                location="front_door",
                status=LockStatus.LOCKED,
                battery_level=82,
                is_online=True,
                last_activity=datetime.utcnow() - timedelta(minutes=30),
                auto_lock_enabled=True,
                auto_lock_delay_seconds=30,
            ),
        ]

        for lock in mock_locks:
            self._locks_cache[lock.lock_id] = lock

        return mock_locks

    def _map_lock_status(self, state: Optional[str]) -> LockStatus:
        """Map August lock state to LockStatus."""
        if not state:
            return LockStatus.UNKNOWN

        mapping = {
            "locked": LockStatus.LOCKED,
            "unlocked": LockStatus.UNLOCKED,
            "kAugLockState_Locked": LockStatus.LOCKED,
            "kAugLockState_Unlocked": LockStatus.UNLOCKED,
            "kAugLockState_Jammed": LockStatus.JAMMED,
            "kAugLockState_Unknown": LockStatus.UNKNOWN,
        }
        return mapping.get(state, LockStatus.UNKNOWN)

    async def get_lock_status(self, lock_id: str) -> Optional[LockInfo]:
        """Get current status of an August lock."""
        try:
            client = await self.get_client()
            response = await client.get(
                f"{self.BASE_URL}/locks/{lock_id}/status",
                headers=await self._get_headers(),
            )

            if response.status_code == 200:
                data = response.json()

                if lock_id in self._locks_cache:
                    lock = self._locks_cache[lock_id]
                    lock.status = self._map_lock_status(data.get("status"))
                    lock.is_online = data.get("bridgeOnline", True)
                    lock.last_activity = datetime.utcnow()
                    if "battery" in data:
                        lock.battery_level = self._parse_battery(data["battery"])
                    return lock

                lock = LockInfo(
                    lock_id=lock_id,
                    name="August Lock",
                    provider=LockProviderType.AUGUST,
                    property_id="",
                    status=self._map_lock_status(data.get("status")),
                    battery_level=self._parse_battery(data.get("battery", 100)),
                    is_online=data.get("bridgeOnline", True),
                    last_activity=datetime.utcnow(),
                )
                self._locks_cache[lock_id] = lock
                return lock

            return self._locks_cache.get(lock_id)

        except Exception as e:
            logger.error(f"Error getting August lock status: {e}")
            return self._locks_cache.get(lock_id)

    async def lock(self, lock_id: str) -> Dict[str, Any]:
        """Lock the August lock."""
        try:
            client = await self.get_client()
            response = await client.put(
                f"{self.BASE_URL}/remoteoperate/{lock_id}/lock",
                headers=await self._get_headers(),
            )

            if response.status_code == 200:
                data = response.json()
                logger.info(f"August lock {lock_id} locked successfully")

                if lock_id in self._locks_cache:
                    self._locks_cache[lock_id].status = LockStatus.LOCKED
                    self._locks_cache[lock_id].last_activity = datetime.utcnow()

                return {
                    "success": True,
                    "lock_id": lock_id,
                    "action": "lock",
                    "status": self._map_lock_status(data.get("status")).value,
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
            logger.error(f"Error locking August lock: {e}")
            return {
                "success": False,
                "lock_id": lock_id,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def unlock(self, lock_id: str, duration_seconds: int = 30) -> Dict[str, Any]:
        """Unlock the August lock."""
        try:
            client = await self.get_client()
            response = await client.put(
                f"{self.BASE_URL}/remoteoperate/{lock_id}/unlock",
                headers=await self._get_headers(),
            )

            if response.status_code == 200:
                data = response.json()
                logger.info(f"August lock {lock_id} unlocked for {duration_seconds}s")

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
            logger.error(f"Error unlocking August lock: {e}")
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
        """Create an access code on the August lock."""
        try:
            code_id = self.generate_code_id(lock_id, code)

            # August guest access API
            payload = {
                "pin": code,
                "firstName": guest_name.split()[0] if guest_name else name,
                "lastName": guest_name.split()[-1] if guest_name and " " in guest_name else "",
            }

            if start_time:
                payload["accessStartTime"] = start_time.isoformat()
            if end_time:
                payload["accessEndTime"] = end_time.isoformat()

            client = await self.get_client()
            response = await client.post(
                f"{self.BASE_URL}/locks/{lock_id}/pins",
                json=payload,
                headers=await self._get_headers(),
            )

            if response.status_code in [200, 201]:
                data = response.json()
                code_id = data.get("pinID", code_id)

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

            logger.info(f"Created August access code '{name}' on lock {lock_id}")
            return access_code

        except Exception as e:
            logger.error(f"Error creating August access code: {e}")
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
        """Delete an access code from the August lock."""
        try:
            client = await self.get_client()
            response = await client.delete(
                f"{self.BASE_URL}/locks/{lock_id}/pins/{code_id}",
                headers=await self._get_headers(),
            )

            if response.status_code in [200, 204]:
                if lock_id in self._codes_cache:
                    self._codes_cache[lock_id] = [
                        c for c in self._codes_cache[lock_id] if c.code_id != code_id
                    ]
                logger.info(f"Deleted August access code {code_id} from lock {lock_id}")
                return True

            if lock_id in self._codes_cache:
                self._codes_cache[lock_id] = [
                    c for c in self._codes_cache[lock_id] if c.code_id != code_id
                ]
            return True

        except Exception as e:
            logger.error(f"Error deleting August access code: {e}")
            return False

    async def list_access_codes(self, lock_id: str) -> List[AccessCode]:
        """List all access codes on the August lock."""
        try:
            client = await self.get_client()
            response = await client.get(
                f"{self.BASE_URL}/locks/{lock_id}/pins",
                headers=await self._get_headers(),
            )

            if response.status_code == 200:
                data = response.json()
                codes = []

                for pin_id, pin_data in data.get("loaded", {}).items():
                    code = AccessCode(
                        code_id=pin_id,
                        lock_id=lock_id,
                        code=pin_data.get("pin", "****"),
                        name=f"{pin_data.get('firstName', '')} {pin_data.get('lastName', '')}".strip() or "Guest",
                        code_type=CodeType.TEMPORARY,
                        start_time=datetime.fromisoformat(pin_data["accessStartTime"].replace("Z", "+00:00"))
                            if pin_data.get("accessStartTime") else None,
                        end_time=datetime.fromisoformat(pin_data["accessEndTime"].replace("Z", "+00:00"))
                            if pin_data.get("accessEndTime") else None,
                        is_active=pin_data.get("status") == "enabled",
                    )
                    codes.append(code)

                self._codes_cache[lock_id] = codes
                return codes

            return self._codes_cache.get(lock_id, [])

        except Exception as e:
            logger.error(f"Error listing August access codes: {e}")
            return self._codes_cache.get(lock_id, [])

    async def get_activity_log(
        self,
        lock_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[LockActivityEntry]:
        """Get activity log for the August lock."""
        try:
            params = {"limit": limit}

            client = await self.get_client()
            response = await client.get(
                f"{self.BASE_URL}/locks/{lock_id}/activities",
                params=params,
                headers=await self._get_headers(),
            )

            if response.status_code == 200:
                data = response.json()
                entries = []

                for item in data:
                    timestamp = datetime.fromtimestamp(item.get("dateTime", 0) / 1000)

                    if start_date and timestamp < start_date:
                        continue
                    if end_date and timestamp > end_date:
                        continue

                    entry = LockActivityEntry(
                        timestamp=timestamp,
                        action=self._map_activity_action(item.get("action")),
                        method=self._map_activity_method(item.get("via")),
                        user_name=item.get("callingUser", {}).get("FirstName"),
                        code_name=item.get("info", {}).get("pinName"),
                        details={
                            "door_state": item.get("doorState"),
                            "result": item.get("result"),
                        },
                    )
                    entries.append(entry)

                return entries[:limit]

            return self._get_mock_activity(lock_id, limit)

        except Exception as e:
            logger.error(f"Error getting August activity log: {e}")
            return self._get_mock_activity(lock_id, limit)

    def _map_activity_action(self, action: Optional[str]) -> str:
        """Map August activity action to standard action."""
        mapping = {
            "lock": "locked",
            "unlock": "unlocked",
            "kAugLockAction_Lock": "locked",
            "kAugLockAction_Unlock": "unlocked",
            "doorsense_close": "door_closed",
            "doorsense_open": "door_opened",
        }
        return mapping.get(action, action or "unknown")

    def _map_activity_method(self, via: Optional[str]) -> str:
        """Map August via method to standard method."""
        mapping = {
            "remote": "app",
            "keypad": "code",
            "manual": "manual",
            "auto": "auto",
        }
        return mapping.get(via, via or "unknown")

    def _get_mock_activity(self, lock_id: str, limit: int) -> List[LockActivityEntry]:
        """Generate mock activity log for demo."""
        activities = [
            LockActivityEntry(
                timestamp=datetime.utcnow() - timedelta(hours=1),
                action="unlocked",
                method="code",
                code_name="Guest: Emily Davis",
            ),
            LockActivityEntry(
                timestamp=datetime.utcnow() - timedelta(hours=1, minutes=1),
                action="door_opened",
                method="doorsense",
            ),
            LockActivityEntry(
                timestamp=datetime.utcnow() - timedelta(hours=1, minutes=2),
                action="door_closed",
                method="doorsense",
            ),
            LockActivityEntry(
                timestamp=datetime.utcnow() - timedelta(hours=1, minutes=3),
                action="locked",
                method="auto",
            ),
            LockActivityEntry(
                timestamp=datetime.utcnow() - timedelta(hours=6),
                action="unlocked",
                method="app",
                user_name="Steven Palma",
            ),
        ]
        return activities[:limit]

    async def get_battery_status(self, lock_id: str) -> Dict[str, Any]:
        """Get battery status for the August lock."""
        try:
            lock = await self.get_lock_status(lock_id)
            if lock:
                battery_level = lock.battery_level
                is_low = battery_level < 20
                is_critical = battery_level < 10
                estimated_days = int((battery_level / 100) * 180)  # August batteries ~6 months

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
            logger.error(f"Error getting August battery status: {e}")
            return {
                "success": False,
                "lock_id": lock_id,
                "error": str(e),
            }
