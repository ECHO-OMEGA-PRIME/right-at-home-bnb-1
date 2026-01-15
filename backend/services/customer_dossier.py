"""
Right At Home BnB - Customer Dossier Service
==============================================
Comprehensive customer profiles with AI memory:
- Remembers EVERY review from EVERY customer
- Tracks guest behavior (clean, dirty, good, bad)
- Notes average star ratings
- Stores preferences and special requests
- Flags problem guests (do not rent)

Steven's AI (named Steven) adds notes from every conversation.

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import hashlib
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from loguru import logger
from enum import Enum

# Firebase
try:
    import firebase_admin
    from firebase_admin import firestore
    db = firestore.client() if firebase_admin._apps else None
    FIREBASE_AVAILABLE = db is not None
except:
    FIREBASE_AVAILABLE = False
    db = None


class GuestRating(str, Enum):
    EXCELLENT = "excellent"  # 5 stars, great guest
    GOOD = "good"           # 4 stars, no issues
    AVERAGE = "average"     # 3 stars, some issues
    POOR = "poor"           # 2 stars, problems
    BAD = "bad"             # 1 star, do not rent again
    BANNED = "banned"       # Never rent to this guest


class CustomerDossierService:
    """
    Comprehensive customer tracking with AI memory.
    Steven AI adds notes from every conversation.
    """

    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.dossiers_collection = "rah_customer_dossiers"
        self.reviews_collection = "rah_customer_reviews"
        self.stays_collection = "rah_customer_stays"

    def _hash_identifier(self, identifier: str) -> str:
        """Hash email or phone for privacy-safe lookup."""
        return hashlib.sha256(identifier.lower().strip().encode()).hexdigest()[:16]

    async def get_or_create_dossier(
        self,
        email: str = None,
        phone: str = None,
        name: str = None
    ) -> Dict[str, Any]:
        """Get existing dossier or create new one."""
        identifier = email or phone
        if not identifier:
            return {"error": "Email or phone required"}

        dossier_id = self._hash_identifier(identifier)

        if self.firebase_available and db:
            doc = db.collection(self.dossiers_collection).document(dossier_id).get()
            if doc.exists:
                return {"success": True, "dossier": doc.to_dict(), "is_new": False}

        # Create new dossier
        new_dossier = {
            "dossier_id": dossier_id,
            "email_hash": self._hash_identifier(email) if email else None,
            "phone_hash": self._hash_identifier(phone) if phone else None,
            "name": name,

            # Default ratings
            "overall_rating": GuestRating.GOOD.value,
            "avg_star_rating": None,
            "our_rating_of_them": None,

            # Behavior flags (start positive)
            "is_clean_guest": True,
            "is_quiet_guest": True,
            "follows_rules": True,
            "good_communication": True,
            "pays_on_time": True,

            # Stats
            "total_stays": 0,
            "total_nights": 0,
            "total_revenue": 0,
            "last_stay_date": None,

            # Issues
            "damage_incidents": 0,
            "noise_complaints": 0,
            "rule_violations": 0,
            "late_payments": 0,

            # AI notes
            "ai_notes": [],
            "preferences": {},
            "special_requests_history": [],
            "reviews_given": [],

            # Owner notes
            "owner_notes": None,
            "do_not_rent": False,
            "do_not_rent_reason": None,

            # Timestamps
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        if self.firebase_available and db:
            db.collection(self.dossiers_collection).document(dossier_id).set(new_dossier)

        return {"success": True, "dossier": new_dossier, "is_new": True}

    async def add_review(
        self,
        email: str = None,
        phone: str = None,
        property_id: int = None,
        star_rating: int = None,
        review_text: str = None,
        platform: str = None,
        booking_id: str = None,
        ai_sentiment: str = None,
        ai_summary: str = None
    ) -> Dict[str, Any]:
        """Add a review from a customer to their dossier."""
        result = await self.get_or_create_dossier(email=email, phone=phone)
        if "error" in result:
            return result

        dossier_id = result["dossier"]["dossier_id"]

        review = {
            "dossier_id": dossier_id,
            "property_id": property_id,
            "booking_id": booking_id,
            "review_date": datetime.utcnow().date().isoformat(),
            "platform": platform or "direct",
            "star_rating": star_rating,
            "review_text": review_text,
            "sentiment": ai_sentiment,
            "ai_summary": ai_summary,
            "created_at": datetime.utcnow().isoformat()
        }

        if self.firebase_available and db:
            # Add review
            review_ref = db.collection(self.reviews_collection).document()
            review_ref.set(review)
            review["id"] = review_ref.id

            # Update dossier
            dossier_ref = db.collection(self.dossiers_collection).document(dossier_id)
            dossier_ref.update({
                "reviews_given": firestore.ArrayUnion([{
                    "id": review["id"],
                    "rating": star_rating,
                    "date": review["review_date"],
                    "platform": platform
                }]),
                "updated_at": datetime.utcnow().isoformat()
            })

        # Recalculate average rating
        await self._recalculate_avg_rating(dossier_id)

        logger.info(f"Added {star_rating}-star review to dossier {dossier_id[:8]}...")
        return {"success": True, "review": review}

    async def _recalculate_avg_rating(self, dossier_id: str):
        """Recalculate average star rating from all reviews."""
        if not self.firebase_available or not db:
            return

        docs = (
            db.collection(self.reviews_collection)
            .where("dossier_id", "==", dossier_id)
            .stream()
        )

        ratings = [doc.to_dict().get("star_rating") for doc in docs
                  if doc.to_dict().get("star_rating")]

        if ratings:
            avg = sum(ratings) / len(ratings)
            db.collection(self.dossiers_collection).document(dossier_id).update({
                "avg_star_rating": round(avg, 2)
            })

    async def add_ai_note(
        self,
        email: str = None,
        phone: str = None,
        note: str = None,
        note_type: str = "observation",
        source: str = "steven_ai"
    ) -> Dict[str, Any]:
        """Add an AI-generated note to customer dossier."""
        result = await self.get_or_create_dossier(email=email, phone=phone)
        if "error" in result:
            return result

        dossier_id = result["dossier"]["dossier_id"]

        ai_note = {
            "note": note,
            "type": note_type,
            "source": source,
            "timestamp": datetime.utcnow().isoformat()
        }

        if self.firebase_available and db:
            db.collection(self.dossiers_collection).document(dossier_id).update({
                "ai_notes": firestore.ArrayUnion([ai_note]),
                "updated_at": datetime.utcnow().isoformat()
            })

        return {"success": True, "note_added": ai_note}

    async def add_stay(
        self,
        email: str = None,
        phone: str = None,
        property_id: int = None,
        check_in: str = None,
        check_out: str = None,
        nights: int = None,
        total_paid: float = None,
        booking_id: str = None
    ) -> Dict[str, Any]:
        """Record a guest stay."""
        result = await self.get_or_create_dossier(email=email, phone=phone)
        if "error" in result:
            return result

        dossier_id = result["dossier"]["dossier_id"]

        stay = {
            "dossier_id": dossier_id,
            "property_id": property_id,
            "booking_id": booking_id,
            "check_in": check_in,
            "check_out": check_out,
            "nights": nights or 1,
            "total_paid": total_paid or 0,
            "created_at": datetime.utcnow().isoformat()
        }

        if self.firebase_available and db:
            # Add stay
            stay_ref = db.collection(self.stays_collection).document()
            stay_ref.set(stay)

            # Update dossier stats
            db.collection(self.dossiers_collection).document(dossier_id).update({
                "total_stays": firestore.Increment(1),
                "total_nights": firestore.Increment(nights or 1),
                "total_revenue": firestore.Increment(total_paid or 0),
                "last_stay_date": check_out or check_in,
                "updated_at": datetime.utcnow().isoformat()
            })

        return {"success": True, "stay": stay}

    async def rate_guest(
        self,
        email: str = None,
        phone: str = None,
        rating: GuestRating = None,
        our_rating: float = None,
        is_clean: bool = None,
        is_quiet: bool = None,
        follows_rules: bool = None,
        good_communication: bool = None,
        pays_on_time: bool = None,
        owner_notes: str = None
    ) -> Dict[str, Any]:
        """Rate a guest (Steven/owner rating of the guest)."""
        result = await self.get_or_create_dossier(email=email, phone=phone)
        if "error" in result:
            return result

        dossier_id = result["dossier"]["dossier_id"]

        updates = {"updated_at": datetime.utcnow().isoformat()}

        if rating:
            updates["overall_rating"] = rating.value
        if our_rating is not None:
            updates["our_rating_of_them"] = our_rating
        if is_clean is not None:
            updates["is_clean_guest"] = is_clean
        if is_quiet is not None:
            updates["is_quiet_guest"] = is_quiet
        if follows_rules is not None:
            updates["follows_rules"] = follows_rules
        if good_communication is not None:
            updates["good_communication"] = good_communication
        if pays_on_time is not None:
            updates["pays_on_time"] = pays_on_time
        if owner_notes:
            updates["owner_notes"] = owner_notes

        if self.firebase_available and db:
            db.collection(self.dossiers_collection).document(dossier_id).update(updates)

        return {"success": True, "updates": updates}

    async def flag_do_not_rent(
        self,
        email: str = None,
        phone: str = None,
        reason: str = None
    ) -> Dict[str, Any]:
        """Flag a guest as do-not-rent."""
        result = await self.get_or_create_dossier(email=email, phone=phone)
        if "error" in result:
            return result

        dossier_id = result["dossier"]["dossier_id"]

        if self.firebase_available and db:
            db.collection(self.dossiers_collection).document(dossier_id).update({
                "overall_rating": GuestRating.BANNED.value,
                "do_not_rent": True,
                "do_not_rent_reason": reason,
                "updated_at": datetime.utcnow().isoformat()
            })

        logger.warning(f"Guest {dossier_id[:8]}... flagged as DO NOT RENT: {reason}")
        return {"success": True, "status": "banned", "reason": reason}

    async def record_incident(
        self,
        email: str = None,
        phone: str = None,
        incident_type: str = None,  # damage, noise, rule_violation, late_payment
        description: str = None
    ) -> Dict[str, Any]:
        """Record an incident for a guest."""
        result = await self.get_or_create_dossier(email=email, phone=phone)
        if "error" in result:
            return result

        dossier_id = result["dossier"]["dossier_id"]

        field_map = {
            "damage": "damage_incidents",
            "noise": "noise_complaints",
            "rule_violation": "rule_violations",
            "late_payment": "late_payments"
        }

        field = field_map.get(incident_type)
        if not field:
            return {"error": f"Unknown incident type: {incident_type}"}

        # Add AI note about the incident
        await self.add_ai_note(
            email=email,
            phone=phone,
            note=f"INCIDENT ({incident_type}): {description}",
            note_type="incident",
            source="system"
        )

        if self.firebase_available and db:
            db.collection(self.dossiers_collection).document(dossier_id).update({
                field: firestore.Increment(1),
                "updated_at": datetime.utcnow().isoformat()
            })

        # Update behavior flags based on incident
        behavior_updates = {}
        if incident_type == "damage":
            behavior_updates["is_clean_guest"] = False
        elif incident_type == "noise":
            behavior_updates["is_quiet_guest"] = False
        elif incident_type == "rule_violation":
            behavior_updates["follows_rules"] = False
        elif incident_type == "late_payment":
            behavior_updates["pays_on_time"] = False

        if behavior_updates:
            await self.rate_guest(email=email, phone=phone, **behavior_updates)

        return {"success": True, "incident_type": incident_type, "recorded": True}

    async def get_dossier(
        self,
        email: str = None,
        phone: str = None
    ) -> Optional[Dict[str, Any]]:
        """Get full customer dossier."""
        identifier = email or phone
        if not identifier:
            return None

        dossier_id = self._hash_identifier(identifier)

        if self.firebase_available and db:
            doc = db.collection(self.dossiers_collection).document(dossier_id).get()
            if doc.exists:
                dossier = doc.to_dict()

                # Get all reviews
                reviews_docs = (
                    db.collection(self.reviews_collection)
                    .where("dossier_id", "==", dossier_id)
                    .stream()
                )
                dossier["all_reviews"] = [d.to_dict() for d in reviews_docs]

                # Get all stays
                stays_docs = (
                    db.collection(self.stays_collection)
                    .where("dossier_id", "==", dossier_id)
                    .stream()
                )
                dossier["all_stays"] = [d.to_dict() for d in stays_docs]

                return dossier

        return None

    async def get_problem_guests(self) -> List[Dict[str, Any]]:
        """Get all guests flagged as poor, bad, or banned."""
        if not self.firebase_available or not db:
            return []

        problem_ratings = [GuestRating.POOR.value, GuestRating.BAD.value, GuestRating.BANNED.value]
        results = []

        for rating in problem_ratings:
            docs = (
                db.collection(self.dossiers_collection)
                .where("overall_rating", "==", rating)
                .stream()
            )
            results.extend([d.to_dict() for d in docs])

        return results

    async def get_vip_guests(self) -> List[Dict[str, Any]]:
        """Get excellent guests (VIPs)."""
        if not self.firebase_available or not db:
            return []

        docs = (
            db.collection(self.dossiers_collection)
            .where("overall_rating", "==", GuestRating.EXCELLENT.value)
            .stream()
        )

        return [d.to_dict() for d in docs]

    async def search_guests(
        self,
        min_stays: int = None,
        min_revenue: float = None,
        is_clean: bool = None
    ) -> List[Dict[str, Any]]:
        """Search guests by criteria."""
        if not self.firebase_available or not db:
            return []

        query = db.collection(self.dossiers_collection)

        if min_stays:
            query = query.where("total_stays", ">=", min_stays)

        docs = query.stream()
        results = [d.to_dict() for d in docs]

        # Filter in-memory for other criteria
        if min_revenue:
            results = [r for r in results if r.get("total_revenue", 0) >= min_revenue]
        if is_clean is not None:
            results = [r for r in results if r.get("is_clean_guest") == is_clean]

        return results


# Singleton instance
customer_dossier_service = CustomerDossierService()
