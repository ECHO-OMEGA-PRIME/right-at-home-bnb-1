"""
Right At Home BnB - Steven's Private Wine Cellar
=================================================
Personal wine collection management with invitation system:
- Track wine inventory (bottles, vintages, regions)
- Private collection accessible only with invitation pass
- Friends & family can browse with valid pass codes
- Tasting notes, ratings, pairings
- Value tracking and cellar organization

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX (PERSONAL)
"""

import os
import secrets
import string
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from enum import Enum
from loguru import logger

# Firebase
try:
    import firebase_admin
    from firebase_admin import firestore
    db = firestore.client() if firebase_admin._apps else None
    FIREBASE_AVAILABLE = db is not None
except:
    FIREBASE_AVAILABLE = False
    db = None


class WineType(str, Enum):
    RED = "red"
    WHITE = "white"
    ROSE = "rose"
    SPARKLING = "sparkling"
    DESSERT = "dessert"
    FORTIFIED = "fortified"


class WineLocation(str, Enum):
    MAIN_CELLAR = "main_cellar"
    CLIMATE_ROOM = "climate_room"
    READY_RACK = "ready_rack"
    DISPLAY_CASE = "display_case"
    DRINKING_NOW = "drinking_now"


class InviteAccessLevel(str, Enum):
    VIEW_ONLY = "view_only"          # Can browse collection
    TASTING_NOTES = "tasting_notes"  # Can see notes and ratings
    FULL_ACCESS = "full_access"      # Can see values and all details
    ADMIN = "admin"                  # Steven and trusted family


class WineCellarService:
    """
    Steven's personal wine cellar management.
    Private collection with invitation-based access for friends & family.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.wines_collection = "rah_wine_cellar"
        self.invites_collection = "rah_wine_invites"
        self.tasting_notes_collection = "rah_wine_tastings"
        self.cellar_log_collection = "rah_wine_log"

        # Steven's admin code (would be hashed in production)
        self.admin_code = os.getenv("WINE_CELLAR_ADMIN_CODE", "STEVEN-PRIME-2026")

    def _generate_invite_code(self, length: int = 8) -> str:
        """Generate a unique invite code."""
        chars = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(chars) for _ in range(length))

    async def create_invite(
        self,
        admin_code: str,
        guest_name: str,
        access_level: InviteAccessLevel = InviteAccessLevel.VIEW_ONLY,
        expires_days: int = 30,
        uses_allowed: int = 10,
        personal_message: str = None
    ) -> Dict[str, Any]:
        """
        Create an invitation pass for a friend or family member.
        Only Steven (with admin code) can create invites.
        """
        if admin_code != self.admin_code:
            return {"success": False, "error": "Invalid admin code"}

        invite_code = f"WINE-{self._generate_invite_code()}"
        expires_at = (date.today() + timedelta(days=expires_days)).isoformat()

        invite = {
            "code": invite_code,
            "guest_name": guest_name,
            "access_level": access_level.value,
            "personal_message": personal_message or f"Welcome to Steven's wine cellar, {guest_name}!",
            "expires_at": expires_at,
            "uses_allowed": uses_allowed,
            "uses_count": 0,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": "Steven Palma",
            "is_active": True,
            "access_log": []
        }

        if self.firebase_available and db:
            db.collection(self.invites_collection).document(invite_code).set(invite)

        logger.info(f"Wine cellar invite created for {guest_name}: {invite_code}")
        return {"success": True, "invite": invite}

    async def validate_invite(self, invite_code: str) -> Dict[str, Any]:
        """Validate an invitation code and return access level."""
        if not self.firebase_available or not db:
            # Demo mode
            if invite_code.startswith("WINE-"):
                return {
                    "valid": True,
                    "access_level": "view_only",
                    "guest_name": "Demo Guest",
                    "message": "Welcome to Steven's wine cellar!"
                }
            return {"valid": False, "error": "Invalid invite code"}

        doc = db.collection(self.invites_collection).document(invite_code).get()

        if not doc.exists:
            return {"valid": False, "error": "Invalid invite code"}

        invite = doc.to_dict()

        # Check if active
        if not invite.get("is_active"):
            return {"valid": False, "error": "This invite has been revoked"}

        # Check expiration
        if invite.get("expires_at"):
            if date.fromisoformat(invite["expires_at"]) < date.today():
                return {"valid": False, "error": "This invite has expired"}

        # Check uses
        if invite.get("uses_count", 0) >= invite.get("uses_allowed", 10):
            return {"valid": False, "error": "This invite has reached its usage limit"}

        # Log access and increment counter
        doc.reference.update({
            "uses_count": invite["uses_count"] + 1,
            "access_log": firestore.ArrayUnion([{
                "timestamp": datetime.utcnow().isoformat(),
                "action": "accessed"
            }])
        })

        return {
            "valid": True,
            "access_level": invite.get("access_level"),
            "guest_name": invite.get("guest_name"),
            "message": invite.get("personal_message")
        }

    async def add_wine(
        self,
        admin_code: str,
        name: str,
        winery: str,
        vintage: int,
        wine_type: WineType,
        region: str,
        country: str,
        quantity: int = 1,
        purchase_price: float = None,
        current_value: float = None,
        location: WineLocation = WineLocation.MAIN_CELLAR,
        rack_position: str = None,
        drink_window_start: int = None,
        drink_window_end: int = None,
        tasting_notes: str = None,
        rating: float = None,
        food_pairings: List[str] = None
    ) -> Dict[str, Any]:
        """Add a wine to the cellar."""
        if admin_code != self.admin_code:
            return {"success": False, "error": "Invalid admin code"}

        wine_id = f"wine_{winery.lower().replace(' ', '_')}_{vintage}_{datetime.utcnow().strftime('%H%M%S')}"

        wine = {
            "id": wine_id,
            "name": name,
            "winery": winery,
            "vintage": vintage,
            "wine_type": wine_type.value,
            "region": region,
            "country": country,
            "quantity": quantity,
            "purchase_price": purchase_price,
            "current_value": current_value or purchase_price,
            "location": location.value,
            "rack_position": rack_position,
            "drink_window": {
                "start": drink_window_start or vintage + 3,
                "end": drink_window_end or vintage + 15
            },
            "tasting_notes": tasting_notes,
            "rating": rating,
            "food_pairings": food_pairings or [],
            "added_at": datetime.utcnow().isoformat(),
            "last_updated": datetime.utcnow().isoformat(),
            "bottles_consumed": 0,
            "consumption_log": []
        }

        if self.firebase_available and db:
            db.collection(self.wines_collection).document(wine_id).set(wine)

        return {"success": True, "wine": wine}

    async def get_cellar(
        self,
        invite_code: str,
        wine_type: WineType = None,
        region: str = None,
        drinking_now: bool = False
    ) -> Dict[str, Any]:
        """
        Get wines from the cellar.
        Access level determines what information is shown.
        """
        # Validate access
        validation = await self.validate_invite(invite_code)
        if not validation.get("valid"):
            return {"error": validation.get("error")}

        access_level = validation.get("access_level")

        if not self.firebase_available or not db:
            # Demo data
            wines = [
                {
                    "name": "Opus One",
                    "winery": "Opus One",
                    "vintage": 2018,
                    "wine_type": "red",
                    "region": "Napa Valley",
                    "country": "USA",
                    "quantity": 6,
                    "rating": 4.8
                },
                {
                    "name": "Château Margaux",
                    "winery": "Château Margaux",
                    "vintage": 2015,
                    "wine_type": "red",
                    "region": "Bordeaux",
                    "country": "France",
                    "quantity": 3,
                    "rating": 4.9
                },
                {
                    "name": "Dom Pérignon",
                    "winery": "Moët & Chandon",
                    "vintage": 2012,
                    "wine_type": "sparkling",
                    "region": "Champagne",
                    "country": "France",
                    "quantity": 4,
                    "rating": 4.7
                }
            ]
        else:
            query = db.collection(self.wines_collection)

            if wine_type:
                query = query.where("wine_type", "==", wine_type.value)
            if region:
                query = query.where("region", "==", region)

            wines = [doc.to_dict() for doc in query.stream()]

        # Filter by drink window if requested
        current_year = date.today().year
        if drinking_now:
            wines = [
                w for w in wines
                if w.get("drink_window", {}).get("start", 0) <= current_year <= w.get("drink_window", {}).get("end", 9999)
            ]

        # Filter fields based on access level
        if access_level == "view_only":
            # Basic info only
            wines = [{
                "name": w.get("name"),
                "winery": w.get("winery"),
                "vintage": w.get("vintage"),
                "wine_type": w.get("wine_type"),
                "region": w.get("region"),
                "country": w.get("country"),
                "quantity": w.get("quantity")
            } for w in wines]
        elif access_level == "tasting_notes":
            # Add tasting info
            wines = [{
                "name": w.get("name"),
                "winery": w.get("winery"),
                "vintage": w.get("vintage"),
                "wine_type": w.get("wine_type"),
                "region": w.get("region"),
                "country": w.get("country"),
                "quantity": w.get("quantity"),
                "tasting_notes": w.get("tasting_notes"),
                "rating": w.get("rating"),
                "food_pairings": w.get("food_pairings"),
                "drink_window": w.get("drink_window")
            } for w in wines]
        # full_access and admin get everything

        return {
            "success": True,
            "access_level": access_level,
            "guest_name": validation.get("guest_name"),
            "wines": wines,
            "total_bottles": sum(w.get("quantity", 0) for w in wines),
            "wine_types": list(set(w.get("wine_type") for w in wines if w.get("wine_type")))
        }

    async def get_cellar_stats(self, admin_code: str) -> Dict[str, Any]:
        """Get cellar statistics (admin only)."""
        if admin_code != self.admin_code:
            return {"error": "Invalid admin code"}

        if not self.firebase_available or not db:
            return {
                "total_bottles": 147,
                "total_value": 28500.00,
                "by_type": {
                    "red": {"bottles": 89, "value": 18200.00},
                    "white": {"bottles": 32, "value": 5600.00},
                    "sparkling": {"bottles": 18, "value": 3800.00},
                    "rose": {"bottles": 8, "value": 900.00}
                },
                "by_country": {
                    "France": 45,
                    "USA": 52,
                    "Italy": 28,
                    "Spain": 12,
                    "Other": 10
                },
                "drinking_now": 34,
                "too_young": 67,
                "past_peak": 8,
                "most_valuable": [
                    {"name": "Château Margaux 2015", "value": 850.00, "qty": 3},
                    {"name": "Opus One 2018", "value": 425.00, "qty": 6},
                    {"name": "Dom Pérignon 2012", "value": 220.00, "qty": 4}
                ]
            }

        wines = [doc.to_dict() for doc in db.collection(self.wines_collection).stream()]

        # Calculate stats
        total_bottles = sum(w.get("quantity", 0) for w in wines)
        total_value = sum(w.get("current_value", 0) * w.get("quantity", 0) for w in wines)

        current_year = date.today().year
        drinking_now = sum(
            w.get("quantity", 0) for w in wines
            if w.get("drink_window", {}).get("start", 0) <= current_year <= w.get("drink_window", {}).get("end", 9999)
        )

        return {
            "total_bottles": total_bottles,
            "total_value": total_value,
            "drinking_now": drinking_now,
            "wines_count": len(wines)
        }

    async def log_consumption(
        self,
        admin_code: str,
        wine_id: str,
        bottles: int = 1,
        occasion: str = None,
        guests: List[str] = None,
        notes: str = None
    ) -> Dict[str, Any]:
        """Log wine consumption."""
        if admin_code != self.admin_code:
            return {"error": "Invalid admin code"}

        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "bottles": bottles,
            "occasion": occasion,
            "guests": guests or [],
            "notes": notes
        }

        if self.firebase_available and db:
            wine_ref = db.collection(self.wines_collection).document(wine_id)
            wine = wine_ref.get()

            if wine.exists:
                wine_data = wine.to_dict()
                new_qty = wine_data.get("quantity", 0) - bottles
                bottles_consumed = wine_data.get("bottles_consumed", 0) + bottles

                wine_ref.update({
                    "quantity": max(0, new_qty),
                    "bottles_consumed": bottles_consumed,
                    "consumption_log": firestore.ArrayUnion([log_entry]),
                    "last_updated": datetime.utcnow().isoformat()
                })

                return {
                    "success": True,
                    "remaining": max(0, new_qty),
                    "total_consumed": bottles_consumed
                }

        return {"success": True, "message": "Consumption logged"}

    async def get_recommendations(
        self,
        invite_code: str,
        occasion: str = None,
        food: str = None,
        mood: str = None
    ) -> Dict[str, Any]:
        """Get wine recommendations based on criteria."""
        validation = await self.validate_invite(invite_code)
        if not validation.get("valid"):
            return {"error": validation.get("error")}

        # Smart recommendations based on criteria
        recommendations = []

        if food:
            food_lower = food.lower()
            if any(x in food_lower for x in ["steak", "beef", "lamb", "red meat"]):
                recommendations.append({
                    "suggestion": "Full-bodied red wine",
                    "examples": ["Cabernet Sauvignon", "Malbec", "Syrah"],
                    "from_cellar": "Opus One 2018"
                })
            elif any(x in food_lower for x in ["fish", "seafood", "shrimp", "lobster"]):
                recommendations.append({
                    "suggestion": "Crisp white or light sparkling",
                    "examples": ["Chardonnay", "Sauvignon Blanc", "Champagne"],
                    "from_cellar": "Chablis Grand Cru"
                })
            elif any(x in food_lower for x in ["chicken", "turkey", "pork"]):
                recommendations.append({
                    "suggestion": "Medium-bodied white or light red",
                    "examples": ["Pinot Noir", "Viognier", "Rosé"],
                    "from_cellar": "Willamette Pinot Noir"
                })

        if occasion:
            occasion_lower = occasion.lower()
            if any(x in occasion_lower for x in ["celebration", "party", "birthday"]):
                recommendations.append({
                    "suggestion": "Something special!",
                    "examples": ["Champagne", "Fine Burgundy"],
                    "from_cellar": "Dom Pérignon 2012"
                })
            elif any(x in occasion_lower for x in ["casual", "everyday", "relaxed"]):
                recommendations.append({
                    "suggestion": "Easy-drinking everyday wine",
                    "examples": ["Light red", "Rosé", "Crisp white"],
                    "from_cellar": "Côtes du Rhône"
                })

        if not recommendations:
            recommendations.append({
                "suggestion": "Drinking window recommendation",
                "from_cellar": "Check wines in their ideal drinking window",
                "tip": "Ask Steven AI for personalized suggestions!"
            })

        return {
            "success": True,
            "recommendations": recommendations,
            "criteria_used": {
                "occasion": occasion,
                "food": food,
                "mood": mood
            }
        }

    async def get_invites_list(self, admin_code: str) -> List[Dict]:
        """Get all active invites (admin only)."""
        if admin_code != self.admin_code:
            return []

        if not self.firebase_available or not db:
            return [
                {"guest_name": "Mom", "code": "WINE-MOM2026", "access_level": "full_access", "uses_count": 5},
                {"guest_name": "Brother Mike", "code": "WINE-MIKE01", "access_level": "tasting_notes", "uses_count": 2},
                {"guest_name": "Best Friend Jake", "code": "WINE-JAKE99", "access_level": "view_only", "uses_count": 1}
            ]

        return [doc.to_dict() for doc in db.collection(self.invites_collection).where("is_active", "==", True).stream()]

    async def revoke_invite(self, admin_code: str, invite_code: str) -> Dict[str, Any]:
        """Revoke an invitation."""
        if admin_code != self.admin_code:
            return {"error": "Invalid admin code"}

        if self.firebase_available and db:
            db.collection(self.invites_collection).document(invite_code).update({
                "is_active": False,
                "revoked_at": datetime.utcnow().isoformat()
            })

        return {"success": True, "message": f"Invite {invite_code} has been revoked"}


# Singleton instance
wine_cellar_service = WineCellarService()
