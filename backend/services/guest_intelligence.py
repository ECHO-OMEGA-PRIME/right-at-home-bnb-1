"""
Right At Home BnB - GUEST INTELLIGENCE SYSTEM
==============================================
Comprehensive tracking for:
- Complete stay history across all properties
- Reviews left (with sentiment analysis)
- Complaints and issues
- Damages and charges
- Preferences and special requests
- VIP status and lifetime value

@author ECHO OMEGA PRIME
@owner Steven Palma - Midland, TX
"""

import os
import json
import hashlib
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from loguru import logger

# Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    from google.cloud.firestore_v1 import FieldFilter, Query

    if not firebase_admin._apps:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path and Path(cred_path).exists():
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()

    db = firestore.client()
    FIREBASE_AVAILABLE = True
    logger.info("Firebase initialized for Guest Intelligence")
except Exception as e:
    FIREBASE_AVAILABLE = False
    db = None
    logger.warning(f"Firebase not available: {e}")


# ============================================================================
# DATA MODELS
# ============================================================================

class VIPTier(str, Enum):
    """Guest VIP tiers based on stays and value"""
    STANDARD = "standard"       # 0 stays
    BRONZE = "bronze"           # 1-2 stays
    SILVER = "silver"           # 3-4 stays
    GOLD = "gold"              # 5-9 stays
    PLATINUM = "platinum"       # 10-19 stays
    DIAMOND = "diamond"         # 20+ stays


class IssueCategory(str, Enum):
    """Categories for complaints and issues"""
    CLEANLINESS = "cleanliness"
    MAINTENANCE = "maintenance"
    NOISE = "noise"
    AMENITIES = "amenities"
    CHECK_IN = "check_in"
    COMMUNICATION = "communication"
    SAFETY = "safety"
    BILLING = "billing"
    NEIGHBOR = "neighbor"
    PEST = "pest"
    HVAC = "hvac"
    PLUMBING = "plumbing"
    APPLIANCE = "appliance"
    OTHER = "other"


class DamageType(str, Enum):
    """Types of property damage"""
    FURNITURE = "furniture"
    APPLIANCE = "appliance"
    WALLS = "walls"
    FLOORING = "flooring"
    LINENS = "linens"
    ELECTRONICS = "electronics"
    OUTDOOR = "outdoor"
    PLUMBING = "plumbing"
    SMOKING = "smoking"
    PET = "pet"
    PARTY = "party"
    OTHER = "other"


class ReviewPlatform(str, Enum):
    """Review source platforms"""
    AIRBNB = "airbnb"
    VRBO = "vrbo"
    BOOKING = "booking.com"
    DIRECT = "direct"
    GOOGLE = "google"
    YELP = "yelp"
    INTERNAL = "internal"


@dataclass
class StayRecord:
    """Complete record of a guest stay"""
    stay_id: str
    property_id: str
    property_name: str
    property_address: str
    check_in: str  # ISO format
    check_out: str  # ISO format
    nights: int
    guests_count: int
    total_paid: float
    cleaning_fee: float = 0.0
    pet_fee: float = 0.0
    damage_deposit: float = 0.0
    deposit_returned: bool = True
    booking_platform: str = "direct"
    booking_id: str = ""
    special_requests: List[str] = field(default_factory=list)
    notes: str = ""
    rating_given: Optional[int] = None  # Rating guest gave us
    rating_received: Optional[int] = None  # Rating we gave guest
    issues_during_stay: List[str] = field(default_factory=list)
    created_at: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class ReviewRecord:
    """Guest review record"""
    review_id: str
    stay_id: str
    property_id: str
    property_name: str
    platform: str
    rating: int  # 1-5
    review_text: str
    review_date: str
    public_response: Optional[str] = None
    response_date: Optional[str] = None
    sentiment: str = "neutral"  # positive, neutral, negative
    key_topics: List[str] = field(default_factory=list)
    mentions_steven: bool = False
    recommends: bool = True
    created_at: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


@dataclass 
class ComplaintRecord:
    """Guest complaint record"""
    complaint_id: str
    stay_id: Optional[str]
    property_id: str
    property_name: str
    category: str
    severity: str  # low, medium, high, critical
    description: str
    complaint_date: str
    resolution: Optional[str] = None
    resolved_date: Optional[str] = None
    resolved_by: Optional[str] = None
    compensation_given: float = 0.0
    compensation_type: Optional[str] = None  # refund, credit, free_night, etc
    guest_satisfied: Optional[bool] = None
    escalated: bool = False
    notes: str = ""
    created_at: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class DamageRecord:
    """Property damage record"""
    damage_id: str
    stay_id: str
    property_id: str
    property_name: str
    damage_type: str
    description: str
    discovered_date: str
    repair_cost: float = 0.0
    charged_to_guest: float = 0.0
    paid_by_guest: bool = False
    payment_date: Optional[str] = None
    photos: List[str] = field(default_factory=list)  # URLs
    insurance_claim: bool = False
    claim_number: Optional[str] = None
    repaired: bool = False
    repair_date: Optional[str] = None
    notes: str = ""
    created_at: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class ConversationRecord:
    """Single conversation exchange"""
    timestamp: str
    role: str  # user, assistant
    content: str
    emotion: Optional[str] = None
    property_context: Optional[str] = None
    topic: Optional[str] = None
    sentiment: Optional[str] = None


@dataclass
class GuestProfile:
    """Complete guest intelligence profile"""
    guest_id: str
    
    # Identity
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    alternate_phones: List[str] = field(default_factory=list)
    alternate_emails: List[str] = field(default_factory=list)
    
    # Demographics (inferred)
    travel_type: Optional[str] = None  # business, family, work_crew, romantic, medical
    company: Optional[str] = None
    home_city: Optional[str] = None
    home_state: Optional[str] = None
    
    # VIP & Value
    vip_tier: str = "standard"
    lifetime_value: float = 0.0
    total_stays: int = 0
    total_nights: int = 0
    average_stay_length: float = 0.0
    average_rating_given: float = 0.0
    
    # Behavioral
    preferred_properties: List[str] = field(default_factory=list)
    preferred_amenities: List[str] = field(default_factory=list)
    dietary_restrictions: List[str] = field(default_factory=list)
    accessibility_needs: List[str] = field(default_factory=list)
    pet_owner: bool = False
    pet_types: List[str] = field(default_factory=list)
    prefers_early_checkin: bool = False
    prefers_late_checkout: bool = False
    prefers_quiet: bool = False
    communication_preference: str = "text"  # text, call, email, app
    
    # Risk Assessment  
    risk_score: int = 0  # 0-100, higher = more risk
    damage_history: bool = False
    total_damage_cost: float = 0.0
    complaint_count: int = 0
    unresolved_complaints: int = 0
    payment_issues: bool = False
    rule_violations: List[str] = field(default_factory=list)
    banned: bool = False
    ban_reason: Optional[str] = None
    
    # Review Summary
    total_reviews_left: int = 0
    average_review_rating: float = 0.0
    review_sentiment: str = "neutral"  # positive, neutral, negative
    mentions_in_reviews: List[str] = field(default_factory=list)  # Key themes
    
    # Tags & Notes
    tags: List[str] = field(default_factory=list)
    internal_notes: str = ""
    steven_notes: str = ""  # AI-generated insights
    
    # Records
    stays: List[Dict] = field(default_factory=list)
    reviews: List[Dict] = field(default_factory=list)
    complaints: List[Dict] = field(default_factory=list)
    damages: List[Dict] = field(default_factory=list)
    conversations: List[Dict] = field(default_factory=list)
    
    # Timestamps
    first_interaction: Optional[str] = None
    last_interaction: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    
    def __post_init__(self):
        now = datetime.utcnow().isoformat()
        if not self.created_at:
            self.created_at = now
        self.updated_at = now


# ============================================================================
# GUEST INTELLIGENCE ENGINE
# ============================================================================

class GuestIntelligence:
    """
    Comprehensive guest intelligence system with infinite memory.
    Tracks every interaction, stay, review, complaint, and damage.
    """
    
    # Firebase collections
    COLLECTION_PROFILES = "rah_guest_profiles"
    COLLECTION_STAYS = "rah_stays"
    COLLECTION_REVIEWS = "rah_reviews"
    COLLECTION_COMPLAINTS = "rah_complaints"
    COLLECTION_DAMAGES = "rah_damages"
    COLLECTION_CONVERSATIONS = "rah_conversations"
    
    def __init__(self):
        self.firebase_available = FIREBASE_AVAILABLE
        self.db = db
        logger.info("Guest Intelligence Engine initialized")
    
    def _generate_id(self, prefix: str = "gi") -> str:
        """Generate unique ID"""
        import uuid
        return f"{prefix}_{uuid.uuid4().hex[:12]}"
    
    def _get_guest_id(self, identifier: str) -> str:
        """Generate consistent guest ID from any identifier"""
        return hashlib.sha256(identifier.lower().strip().encode()).hexdigest()[:16]
    
    def _calculate_vip_tier(self, total_stays: int, lifetime_value: float) -> str:
        """Calculate VIP tier based on stays and value"""
        if total_stays >= 20 or lifetime_value >= 50000:
            return VIPTier.DIAMOND.value
        elif total_stays >= 10 or lifetime_value >= 25000:
            return VIPTier.PLATINUM.value
        elif total_stays >= 5 or lifetime_value >= 10000:
            return VIPTier.GOLD.value
        elif total_stays >= 3 or lifetime_value >= 5000:
            return VIPTier.SILVER.value
        elif total_stays >= 1:
            return VIPTier.BRONZE.value
        return VIPTier.STANDARD.value
    
    def _calculate_risk_score(self, profile: GuestProfile) -> int:
        """Calculate risk score (0-100) based on history"""
        score = 0
        
        # Damage history
        if profile.damage_history:
            score += 25
            score += min(profile.total_damage_cost / 100, 25)  # Up to 25 more points
        
        # Complaints
        score += profile.complaint_count * 5  # 5 points per complaint
        score += profile.unresolved_complaints * 10  # Extra for unresolved
        
        # Payment issues
        if profile.payment_issues:
            score += 15
        
        # Rule violations
        score += len(profile.rule_violations) * 10
        
        # Offset by positive factors
        if profile.average_review_rating >= 4.5:
            score -= 10
        if profile.total_stays >= 5 and profile.complaint_count == 0:
            score -= 15  # Loyal clean guest
        
        return max(0, min(100, score))
    
    def _analyze_review_sentiment(self, text: str) -> tuple[str, List[str]]:
        """Simple sentiment analysis for reviews"""
        text_lower = text.lower()
        
        positive_words = [
            'amazing', 'excellent', 'wonderful', 'perfect', 'great', 'fantastic',
            'clean', 'comfortable', 'beautiful', 'spacious', 'friendly', 'helpful',
            'recommend', 'loved', 'best', 'awesome', 'outstanding', 'spotless'
        ]
        
        negative_words = [
            'dirty', 'broken', 'noisy', 'disappointed', 'terrible', 'awful',
            'worst', 'never', 'problem', 'issue', 'complaint', 'unacceptable',
            'rude', 'late', 'missing', 'uncomfortable', 'smelled', 'bugs'
        ]
        
        pos_count = sum(1 for word in positive_words if word in text_lower)
        neg_count = sum(1 for word in negative_words if word in text_lower)
        
        topics = []
        topic_keywords = {
            'cleanliness': ['clean', 'dirty', 'spotless', 'tidy', 'dust', 'sanitized'],
            'location': ['location', 'area', 'neighborhood', 'close', 'convenient'],
            'amenities': ['amenities', 'pool', 'hot tub', 'kitchen', 'wifi', 'parking'],
            'communication': ['communication', 'response', 'helpful', 'host', 'steven'],
            'value': ['price', 'value', 'worth', 'expensive', 'affordable', 'deal'],
            'comfort': ['comfortable', 'bed', 'sleep', 'cozy', 'relaxing'],
            'check_in': ['check-in', 'checkin', 'arrival', 'key', 'code', 'lock']
        }
        
        for topic, keywords in topic_keywords.items():
            if any(kw in text_lower for kw in keywords):
                topics.append(topic)
        
        if pos_count > neg_count + 2:
            sentiment = "positive"
        elif neg_count > pos_count + 1:
            sentiment = "negative"
        else:
            sentiment = "neutral"
        
        return sentiment, topics

    # ============================================================================
    # PROFILE MANAGEMENT
    # ============================================================================
    
    async def get_or_create_profile(
        self,
        identifier: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None
    ) -> GuestProfile:
        """Get existing profile or create new one"""
        guest_id = self._get_guest_id(identifier)
        
        if not self.firebase_available or not self.db:
            return GuestProfile(guest_id=guest_id, name=name or "Guest")
        
        try:
            doc_ref = self.db.collection(self.COLLECTION_PROFILES).document(guest_id)
            doc = doc_ref.get()
            
            if doc.exists:
                data = doc.to_dict()
                profile = GuestProfile(**data)
                
                # Update with any new info
                updated = False
                if name and name != profile.name:
                    profile.name = name
                    updated = True
                if email and email not in [profile.email] + profile.alternate_emails:
                    if not profile.email:
                        profile.email = email
                    else:
                        profile.alternate_emails.append(email)
                    updated = True
                if phone and phone not in [profile.phone] + profile.alternate_phones:
                    if not profile.phone:
                        profile.phone = phone
                    else:
                        profile.alternate_phones.append(phone)
                    updated = True
                
                if updated:
                    profile.updated_at = datetime.utcnow().isoformat()
                    doc_ref.set(asdict(profile))
                
                return profile
            
            # Create new profile
            now = datetime.utcnow().isoformat()
            profile = GuestProfile(
                guest_id=guest_id,
                name=name or "Guest",
                email=email,
                phone=phone,
                first_interaction=now,
                last_interaction=now,
                created_at=now,
                updated_at=now
            )
            
            doc_ref.set(asdict(profile))
            logger.info(f"Created new guest profile: {guest_id[:8]}...")
            return profile
            
        except Exception as e:
            logger.error(f"Error getting/creating profile: {e}")
            return GuestProfile(guest_id=guest_id, name=name or "Guest")
    
    async def update_profile(self, guest_id: str, updates: Dict[str, Any]) -> bool:
        """Update specific fields in guest profile"""
        if not self.firebase_available or not self.db:
            return False
        
        try:
            updates["updated_at"] = datetime.utcnow().isoformat()
            doc_ref = self.db.collection(self.COLLECTION_PROFILES).document(guest_id)
            doc_ref.update(updates)
            return True
        except Exception as e:
            logger.error(f"Error updating profile: {e}")
            return False
    
    async def get_profile(self, guest_id: str) -> Optional[GuestProfile]:
        """Get profile by guest ID"""
        if not self.firebase_available or not self.db:
            return None
        
        try:
            doc = self.db.collection(self.COLLECTION_PROFILES).document(guest_id).get()
            if doc.exists:
                return GuestProfile(**doc.to_dict())
            return None
        except Exception as e:
            logger.error(f"Error getting profile: {e}")
            return None
    
    async def search_guests(
        self,
        query: str = "",
        vip_tier: Optional[str] = None,
        has_complaints: Optional[bool] = None,
        has_damages: Optional[bool] = None,
        min_stays: int = 0,
        limit: int = 50
    ) -> List[GuestProfile]:
        """Search guests with filters"""
        if not self.firebase_available or not self.db:
            return []
        
        try:
            collection_ref = self.db.collection(self.COLLECTION_PROFILES)
            
            # Base query
            q = collection_ref.order_by("last_interaction", direction=Query.DESCENDING)
            
            if vip_tier:
                q = q.where("vip_tier", "==", vip_tier)
            
            if has_damages is True:
                q = q.where("damage_history", "==", True)
            
            if min_stays > 0:
                q = q.where("total_stays", ">=", min_stays)
            
            q = q.limit(limit)
            docs = q.stream()
            
            results = []
            query_lower = query.lower()
            
            for doc in docs:
                profile = GuestProfile(**doc.to_dict())
                
                # Apply text search filter
                if query:
                    searchable = f"{profile.name} {profile.email or ''} {profile.phone or ''} {' '.join(profile.tags)}".lower()
                    if query_lower not in searchable:
                        continue
                
                # Apply complaints filter
                if has_complaints is True and profile.complaint_count == 0:
                    continue
                if has_complaints is False and profile.complaint_count > 0:
                    continue
                
                results.append(profile)
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching guests: {e}")
            return []
    
    # ============================================================================
    # STAY TRACKING
    # ============================================================================
    
    async def record_stay(
        self,
        guest_id: str,
        property_id: str,
        property_name: str,
        property_address: str,
        check_in: str,
        check_out: str,
        total_paid: float,
        guests_count: int = 1,
        booking_platform: str = "direct",
        booking_id: str = "",
        **kwargs
    ) -> StayRecord:
        """Record a guest stay"""
        stay_id = self._generate_id("stay")
        
        # Calculate nights
        check_in_dt = datetime.fromisoformat(check_in.replace('Z', '+00:00'))
        check_out_dt = datetime.fromisoformat(check_out.replace('Z', '+00:00'))
        nights = (check_out_dt - check_in_dt).days
        
        stay = StayRecord(
            stay_id=stay_id,
            property_id=property_id,
            property_name=property_name,
            property_address=property_address,
            check_in=check_in,
            check_out=check_out,
            nights=nights,
            guests_count=guests_count,
            total_paid=total_paid,
            booking_platform=booking_platform,
            booking_id=booking_id,
            **kwargs
        )
        
        if self.firebase_available and self.db:
            try:
                # Store stay record
                self.db.collection(self.COLLECTION_STAYS).document(stay_id).set(
                    {**asdict(stay), "guest_id": guest_id}
                )
                
                # Update profile
                profile = await self.get_profile(guest_id)
                if profile:
                    profile.stays.append(asdict(stay))
                    profile.total_stays += 1
                    profile.total_nights += nights
                    profile.lifetime_value += total_paid
                    profile.average_stay_length = profile.total_nights / profile.total_stays
                    
                    # Update preferred properties
                    if property_id not in profile.preferred_properties:
                        profile.preferred_properties.append(property_id)
                    
                    # Recalculate VIP tier
                    profile.vip_tier = self._calculate_vip_tier(
                        profile.total_stays,
                        profile.lifetime_value
                    )
                    
                    profile.last_interaction = datetime.utcnow().isoformat()
                    profile.updated_at = datetime.utcnow().isoformat()
                    
                    self.db.collection(self.COLLECTION_PROFILES).document(guest_id).set(
                        asdict(profile)
                    )
                
                logger.info(f"Recorded stay {stay_id} for guest {guest_id[:8]}")
                
            except Exception as e:
                logger.error(f"Error recording stay: {e}")
        
        return stay
    
    async def get_stay_history(self, guest_id: str) -> List[StayRecord]:
        """Get all stays for a guest"""
        if not self.firebase_available or not self.db:
            return []
        
        try:
            docs = (
                self.db.collection(self.COLLECTION_STAYS)
                .where("guest_id", "==", guest_id)
                .order_by("check_in", direction=Query.DESCENDING)
                .stream()
            )
            
            return [StayRecord(**{k: v for k, v in doc.to_dict().items() if k != 'guest_id'}) for doc in docs]
            
        except Exception as e:
            logger.error(f"Error getting stay history: {e}")
            return []
    
    async def get_stays_at_property(self, property_id: str, limit: int = 100) -> List[Dict]:
        """Get all stays at a specific property"""
        if not self.firebase_available or not self.db:
            return []
        
        try:
            docs = (
                self.db.collection(self.COLLECTION_STAYS)
                .where("property_id", "==", property_id)
                .order_by("check_in", direction=Query.DESCENDING)
                .limit(limit)
                .stream()
            )
            
            return [doc.to_dict() for doc in docs]
            
        except Exception as e:
            logger.error(f"Error getting property stays: {e}")
            return []

    
    # ============================================================================
    # REVIEW TRACKING
    # ============================================================================
    
    async def record_review(
        self,
        guest_id: str,
        stay_id: str,
        property_id: str,
        property_name: str,
        platform: str,
        rating: int,
        review_text: str,
        review_date: str,
        public_response: Optional[str] = None
    ) -> ReviewRecord:
        """Record a guest review"""
        review_id = self._generate_id("rev")
        
        # Analyze sentiment
        sentiment, topics = self._analyze_review_sentiment(review_text)
        mentions_steven = "steven" in review_text.lower()
        recommends = rating >= 4 or any(word in review_text.lower() for word in ['recommend', 'return', 'again', 'come back'])
        
        review = ReviewRecord(
            review_id=review_id,
            stay_id=stay_id,
            property_id=property_id,
            property_name=property_name,
            platform=platform,
            rating=rating,
            review_text=review_text,
            review_date=review_date,
            public_response=public_response,
            sentiment=sentiment,
            key_topics=topics,
            mentions_steven=mentions_steven,
            recommends=recommends
        )
        
        if self.firebase_available and self.db:
            try:
                # Store review
                self.db.collection(self.COLLECTION_REVIEWS).document(review_id).set(
                    {**asdict(review), "guest_id": guest_id}
                )
                
                # Update profile
                profile = await self.get_profile(guest_id)
                if profile:
                    profile.reviews.append(asdict(review))
                    profile.total_reviews_left += 1
                    
                    # Recalculate average rating
                    all_ratings = [r.get('rating', 0) for r in profile.reviews if r.get('rating')]
                    if all_ratings:
                        profile.average_review_rating = sum(all_ratings) / len(all_ratings)
                    
                    # Update overall sentiment
                    sentiments = [r.get('sentiment', 'neutral') for r in profile.reviews]
                    pos = sentiments.count('positive')
                    neg = sentiments.count('negative')
                    if pos > neg * 2:
                        profile.review_sentiment = "positive"
                    elif neg > pos:
                        profile.review_sentiment = "negative"
                    else:
                        profile.review_sentiment = "neutral"
                    
                    # Track mentions
                    for topic in topics:
                        if topic not in profile.mentions_in_reviews:
                            profile.mentions_in_reviews.append(topic)
                    
                    profile.updated_at = datetime.utcnow().isoformat()
                    self.db.collection(self.COLLECTION_PROFILES).document(guest_id).set(
                        asdict(profile)
                    )
                
                logger.info(f"Recorded review {review_id} ({rating}★) from guest {guest_id[:8]}")
                
            except Exception as e:
                logger.error(f"Error recording review: {e}")
        
        return review
    
    async def get_reviews_by_guest(self, guest_id: str) -> List[ReviewRecord]:
        """Get all reviews from a guest"""
        if not self.firebase_available or not self.db:
            return []
        
        try:
            docs = (
                self.db.collection(self.COLLECTION_REVIEWS)
                .where("guest_id", "==", guest_id)
                .order_by("review_date", direction=Query.DESCENDING)
                .stream()
            )
            
            return [ReviewRecord(**{k: v for k, v in doc.to_dict().items() if k != 'guest_id'}) for doc in docs]
            
        except Exception as e:
            logger.error(f"Error getting guest reviews: {e}")
            return []
    
    async def get_reviews_for_property(self, property_id: str, limit: int = 100) -> List[ReviewRecord]:
        """Get all reviews for a property"""
        if not self.firebase_available or not self.db:
            return []
        
        try:
            docs = (
                self.db.collection(self.COLLECTION_REVIEWS)
                .where("property_id", "==", property_id)
                .order_by("review_date", direction=Query.DESCENDING)
                .limit(limit)
                .stream()
            )
            
            return [ReviewRecord(**{k: v for k, v in doc.to_dict().items() if k != 'guest_id'}) for doc in docs]
            
        except Exception as e:
            logger.error(f"Error getting property reviews: {e}")
            return []
    
    # ============================================================================
    # COMPLAINT TRACKING
    # ============================================================================
    
    async def record_complaint(
        self,
        guest_id: str,
        property_id: str,
        property_name: str,
        category: str,
        severity: str,
        description: str,
        stay_id: Optional[str] = None,
        **kwargs
    ) -> ComplaintRecord:
        """Record a guest complaint"""
        complaint_id = self._generate_id("cmp")
        
        complaint = ComplaintRecord(
            complaint_id=complaint_id,
            stay_id=stay_id,
            property_id=property_id,
            property_name=property_name,
            category=category,
            severity=severity,
            description=description,
            complaint_date=datetime.utcnow().isoformat(),
            **kwargs
        )
        
        if self.firebase_available and self.db:
            try:
                # Store complaint
                self.db.collection(self.COLLECTION_COMPLAINTS).document(complaint_id).set(
                    {**asdict(complaint), "guest_id": guest_id}
                )
                
                # Update profile
                profile = await self.get_profile(guest_id)
                if profile:
                    profile.complaints.append(asdict(complaint))
                    profile.complaint_count += 1
                    profile.unresolved_complaints += 1
                    
                    # Recalculate risk score
                    profile.risk_score = self._calculate_risk_score(profile)
                    
                    # Add tag
                    if "has_complaints" not in profile.tags:
                        profile.tags.append("has_complaints")
                    
                    profile.updated_at = datetime.utcnow().isoformat()
                    self.db.collection(self.COLLECTION_PROFILES).document(guest_id).set(
                        asdict(profile)
                    )
                
                logger.info(f"Recorded complaint {complaint_id} ({severity}) from guest {guest_id[:8]}")
                
            except Exception as e:
                logger.error(f"Error recording complaint: {e}")
        
        return complaint
    
    async def resolve_complaint(
        self,
        complaint_id: str,
        resolution: str,
        resolved_by: str,
        compensation_given: float = 0.0,
        compensation_type: Optional[str] = None,
        guest_satisfied: bool = True
    ) -> bool:
        """Mark a complaint as resolved"""
        if not self.firebase_available or not self.db:
            return False
        
        try:
            doc_ref = self.db.collection(self.COLLECTION_COMPLAINTS).document(complaint_id)
            doc = doc_ref.get()
            
            if not doc.exists:
                return False
            
            data = doc.to_dict()
            guest_id = data.get("guest_id")
            
            # Update complaint
            updates = {
                "resolution": resolution,
                "resolved_date": datetime.utcnow().isoformat(),
                "resolved_by": resolved_by,
                "compensation_given": compensation_given,
                "compensation_type": compensation_type,
                "guest_satisfied": guest_satisfied
            }
            doc_ref.update(updates)
            
            # Update profile
            if guest_id:
                profile = await self.get_profile(guest_id)
                if profile:
                    profile.unresolved_complaints = max(0, profile.unresolved_complaints - 1)
                    profile.risk_score = self._calculate_risk_score(profile)
                    profile.updated_at = datetime.utcnow().isoformat()
                    
                    self.db.collection(self.COLLECTION_PROFILES).document(guest_id).set(
                        asdict(profile)
                    )
            
            logger.info(f"Resolved complaint {complaint_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error resolving complaint: {e}")
            return False
    
    async def get_complaints_by_guest(self, guest_id: str) -> List[ComplaintRecord]:
        """Get all complaints from a guest"""
        if not self.firebase_available or not self.db:
            return []
        
        try:
            docs = (
                self.db.collection(self.COLLECTION_COMPLAINTS)
                .where("guest_id", "==", guest_id)
                .order_by("complaint_date", direction=Query.DESCENDING)
                .stream()
            )
            
            return [ComplaintRecord(**{k: v for k, v in doc.to_dict().items() if k != 'guest_id'}) for doc in docs]
            
        except Exception as e:
            logger.error(f"Error getting guest complaints: {e}")
            return []

    
    # ============================================================================
    # DAMAGE TRACKING
    # ============================================================================
    
    async def record_damage(
        self,
        guest_id: str,
        stay_id: str,
        property_id: str,
        property_name: str,
        damage_type: str,
        description: str,
        repair_cost: float = 0.0,
        charged_to_guest: float = 0.0,
        photos: List[str] = None,
        **kwargs
    ) -> DamageRecord:
        """Record property damage"""
        damage_id = self._generate_id("dmg")
        
        damage = DamageRecord(
            damage_id=damage_id,
            stay_id=stay_id,
            property_id=property_id,
            property_name=property_name,
            damage_type=damage_type,
            description=description,
            discovered_date=datetime.utcnow().isoformat(),
            repair_cost=repair_cost,
            charged_to_guest=charged_to_guest,
            photos=photos or [],
            **kwargs
        )
        
        if self.firebase_available and self.db:
            try:
                # Store damage record
                self.db.collection(self.COLLECTION_DAMAGES).document(damage_id).set(
                    {**asdict(damage), "guest_id": guest_id}
                )
                
                # Update profile
                profile = await self.get_profile(guest_id)
                if profile:
                    profile.damages.append(asdict(damage))
                    profile.damage_history = True
                    profile.total_damage_cost += repair_cost
                    
                    # Recalculate risk score
                    profile.risk_score = self._calculate_risk_score(profile)
                    
                    # Add tags
                    if "has_damage_history" not in profile.tags:
                        profile.tags.append("has_damage_history")
                    if f"damage_{damage_type}" not in profile.tags:
                        profile.tags.append(f"damage_{damage_type}")
                    
                    profile.updated_at = datetime.utcnow().isoformat()
                    self.db.collection(self.COLLECTION_PROFILES).document(guest_id).set(
                        asdict(profile)
                    )
                
                logger.warning(f"Recorded damage {damage_id} (${repair_cost}) from guest {guest_id[:8]}")
                
            except Exception as e:
                logger.error(f"Error recording damage: {e}")
        
        return damage
    
    async def mark_damage_paid(self, damage_id: str) -> bool:
        """Mark damage as paid by guest"""
        if not self.firebase_available or not self.db:
            return False
        
        try:
            doc_ref = self.db.collection(self.COLLECTION_DAMAGES).document(damage_id)
            doc_ref.update({
                "paid_by_guest": True,
                "payment_date": datetime.utcnow().isoformat()
            })
            return True
        except Exception as e:
            logger.error(f"Error marking damage paid: {e}")
            return False
    
    async def mark_damage_repaired(self, damage_id: str) -> bool:
        """Mark damage as repaired"""
        if not self.firebase_available or not self.db:
            return False
        
        try:
            doc_ref = self.db.collection(self.COLLECTION_DAMAGES).document(damage_id)
            doc_ref.update({
                "repaired": True,
                "repair_date": datetime.utcnow().isoformat()
            })
            return True
        except Exception as e:
            logger.error(f"Error marking damage repaired: {e}")
            return False
    
    async def get_damages_by_guest(self, guest_id: str) -> List[DamageRecord]:
        """Get all damages from a guest"""
        if not self.firebase_available or not self.db:
            return []
        
        try:
            docs = (
                self.db.collection(self.COLLECTION_DAMAGES)
                .where("guest_id", "==", guest_id)
                .order_by("discovered_date", direction=Query.DESCENDING)
                .stream()
            )
            
            return [DamageRecord(**{k: v for k, v in doc.to_dict().items() if k != 'guest_id'}) for doc in docs]
            
        except Exception as e:
            logger.error(f"Error getting guest damages: {e}")
            return []
    
    # ============================================================================
    # CONVERSATION TRACKING
    # ============================================================================
    
    async def store_conversation(
        self,
        guest_id: str,
        message: str,
        response: str,
        property_context: Optional[str] = None,
        emotion: Optional[str] = None,
        topic: Optional[str] = None
    ) -> bool:
        """Store conversation exchange"""
        if not self.firebase_available or not self.db:
            return False
        
        try:
            timestamp = datetime.utcnow().isoformat()
            
            # Store user message
            user_record = ConversationRecord(
                timestamp=timestamp,
                role="user",
                content=message,
                property_context=property_context,
                topic=topic
            )
            
            # Store assistant response
            assistant_record = ConversationRecord(
                timestamp=timestamp,
                role="assistant",
                content=response,
                emotion=emotion,
                property_context=property_context
            )
            
            # Store in conversations collection
            doc_id = f"{guest_id}_{int(datetime.utcnow().timestamp() * 1000)}"
            self.db.collection(self.COLLECTION_CONVERSATIONS).document(doc_id).set({
                "guest_id": guest_id,
                "user_message": asdict(user_record),
                "assistant_response": asdict(assistant_record),
                "timestamp": timestamp,
                "property_context": property_context
            })
            
            # Update profile conversations (keep last 100)
            profile = await self.get_profile(guest_id)
            if profile:
                profile.conversations.append({
                    "user": asdict(user_record),
                    "assistant": asdict(assistant_record)
                })
                
                # Trim to last 100 conversations
                if len(profile.conversations) > 100:
                    profile.conversations = profile.conversations[-100:]
                
                profile.last_interaction = timestamp
                profile.updated_at = timestamp
                
                self.db.collection(self.COLLECTION_PROFILES).document(guest_id).set(
                    asdict(profile)
                )
            
            return True
            
        except Exception as e:
            logger.error(f"Error storing conversation: {e}")
            return False
    
    async def get_conversation_history(
        self,
        guest_id: str,
        limit: int = 50
    ) -> List[Dict]:
        """Get conversation history for a guest"""
        if not self.firebase_available or not self.db:
            return []
        
        try:
            docs = (
                self.db.collection(self.COLLECTION_CONVERSATIONS)
                .where("guest_id", "==", guest_id)
                .order_by("timestamp", direction=Query.DESCENDING)
                .limit(limit)
                .stream()
            )
            
            convos = [doc.to_dict() for doc in docs]
            return list(reversed(convos))  # Chronological order
            
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return []

    
    # ============================================================================
    # INTELLIGENCE SUMMARY FOR AI CONTEXT
    # ============================================================================
    
    async def get_full_guest_context(self, guest_id: str) -> str:
        """
        Generate comprehensive guest context for AI.
        This is the INFINITE MEMORY context that gives Steven AI
        complete knowledge about every guest interaction.
        """
        profile = await self.get_profile(guest_id)
        if not profile:
            return f"[New guest - no history available]"
        
        lines = []
        lines.append("=" * 60)
        lines.append("GUEST INTELLIGENCE DOSSIER")
        lines.append("=" * 60)
        
        # Identity & Status
        lines.append(f"\n📋 IDENTITY")
        lines.append(f"   Name: {profile.name}")
        lines.append(f"   Email: {profile.email or 'Unknown'}")
        lines.append(f"   Phone: {profile.phone or 'Unknown'}")
        lines.append(f"   VIP Tier: {profile.vip_tier.upper()}")
        lines.append(f"   Risk Score: {profile.risk_score}/100")
        
        # Value
        lines.append(f"\n💰 LIFETIME VALUE")
        lines.append(f"   Total Stays: {profile.total_stays}")
        lines.append(f"   Total Nights: {profile.total_nights}")
        lines.append(f"   Lifetime Value: ${profile.lifetime_value:,.2f}")
        lines.append(f"   Avg Stay Length: {profile.average_stay_length:.1f} nights")
        
        # Stay History
        if profile.stays:
            lines.append(f"\n🏠 STAY HISTORY ({len(profile.stays)} stays)")
            for stay in profile.stays[-5:]:  # Last 5 stays
                lines.append(f"   • {stay.get('property_name', 'Unknown')} - {stay.get('check_in', '')[:10]} to {stay.get('check_out', '')[:10]}")
                if stay.get('rating_given'):
                    lines.append(f"     Rating given: {stay['rating_given']}★")
                if stay.get('issues_during_stay'):
                    lines.append(f"     Issues: {', '.join(stay['issues_during_stay'])}")
        
        # Reviews
        if profile.reviews:
            lines.append(f"\n⭐ REVIEWS LEFT ({profile.total_reviews_left} total)")
            lines.append(f"   Average Rating: {profile.average_review_rating:.1f}★")
            lines.append(f"   Sentiment: {profile.review_sentiment.upper()}")
            for review in profile.reviews[-3:]:  # Last 3 reviews
                lines.append(f"   • {review.get('property_name', '')} ({review.get('platform', '')}): {review.get('rating', 0)}★")
                text = review.get('review_text', '')[:100]
                if text:
                    lines.append(f"     \"{text}...\"")
        
        # Complaints
        if profile.complaints:
            lines.append(f"\n⚠️ COMPLAINTS ({profile.complaint_count} total, {profile.unresolved_complaints} unresolved)")
            for complaint in profile.complaints[-3:]:  # Last 3
                status = "✓ Resolved" if complaint.get('resolution') else "⏳ Pending"
                lines.append(f"   • [{complaint.get('severity', 'low').upper()}] {complaint.get('category', 'other')}: {complaint.get('description', '')[:80]}")
                lines.append(f"     Status: {status}")
                if complaint.get('compensation_given', 0) > 0:
                    lines.append(f"     Compensation: ${complaint['compensation_given']} ({complaint.get('compensation_type', '')})")
        
        # Damages
        if profile.damages:
            lines.append(f"\n🔨 DAMAGE HISTORY (${profile.total_damage_cost:,.2f} total)")
            for damage in profile.damages:
                paid = "✓ Paid" if damage.get('paid_by_guest') else "⏳ Unpaid"
                lines.append(f"   • {damage.get('damage_type', 'other')}: {damage.get('description', '')[:60]}")
                lines.append(f"     Cost: ${damage.get('repair_cost', 0)} | Charged: ${damage.get('charged_to_guest', 0)} | {paid}")
        
        # Preferences
        if any([profile.preferred_properties, profile.pet_owner, profile.travel_type]):
            lines.append(f"\n💡 PREFERENCES")
            if profile.travel_type:
                lines.append(f"   Travel Type: {profile.travel_type}")
            if profile.preferred_properties:
                lines.append(f"   Preferred Properties: {', '.join(profile.preferred_properties[:3])}")
            if profile.pet_owner:
                lines.append(f"   Pet Owner: Yes ({', '.join(profile.pet_types) if profile.pet_types else 'type unknown'})")
            if profile.prefers_early_checkin:
                lines.append(f"   Prefers Early Check-in: Yes")
            if profile.prefers_late_checkout:
                lines.append(f"   Prefers Late Checkout: Yes")
            if profile.communication_preference != "text":
                lines.append(f"   Communication: {profile.communication_preference}")
        
        # Tags
        if profile.tags:
            lines.append(f"\n🏷️ TAGS: {', '.join(profile.tags)}")
        
        # Notes
        if profile.internal_notes:
            lines.append(f"\n📝 INTERNAL NOTES:\n   {profile.internal_notes}")
        
        # Recent Conversations
        if profile.conversations:
            lines.append(f"\n💬 RECENT CONVERSATIONS (last {min(len(profile.conversations), 5)})")
            for conv in profile.conversations[-5:]:
                user_msg = conv.get('user', {}).get('content', '')[:80]
                assistant_msg = conv.get('assistant', {}).get('content', '')[:80]
                lines.append(f"   Guest: \"{user_msg}...\"")
                lines.append(f"   Steven: \"{assistant_msg}...\"")
                lines.append("")
        
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    async def get_quick_context(self, guest_id: str) -> str:
        """Get a brief context summary for quick reference"""
        profile = await self.get_profile(guest_id)
        if not profile:
            return "[New guest]"
        
        parts = [
            f"{profile.name}",
            f"VIP:{profile.vip_tier}",
            f"Stays:{profile.total_stays}",
            f"Value:${profile.lifetime_value:,.0f}"
        ]
        
        if profile.complaint_count > 0:
            parts.append(f"⚠️Complaints:{profile.complaint_count}")
        
        if profile.damage_history:
            parts.append(f"🔨Damages:${profile.total_damage_cost:,.0f}")
        
        if profile.risk_score > 25:
            parts.append(f"Risk:{profile.risk_score}")
        
        if profile.average_review_rating > 0:
            parts.append(f"Rating:{profile.average_review_rating:.1f}★")
        
        return " | ".join(parts)
    
    async def ban_guest(
        self,
        guest_id: str,
        reason: str,
        banned_by: str = "system"
    ) -> bool:
        """Ban a guest from future bookings"""
        if not self.firebase_available or not self.db:
            return False
        
        try:
            profile = await self.get_profile(guest_id)
            if not profile:
                return False
            
            profile.banned = True
            profile.ban_reason = reason
            profile.tags.append("BANNED")
            profile.internal_notes += f"\n[{datetime.utcnow().isoformat()}] BANNED by {banned_by}: {reason}"
            profile.updated_at = datetime.utcnow().isoformat()
            
            self.db.collection(self.COLLECTION_PROFILES).document(guest_id).set(
                asdict(profile)
            )
            
            logger.warning(f"Guest {guest_id[:8]} BANNED: {reason}")
            return True
            
        except Exception as e:
            logger.error(f"Error banning guest: {e}")
            return False


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

guest_intel = GuestIntelligence()


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_guest_context(identifier: str) -> str:
    """Quick helper to get full guest context"""
    guest_id = guest_intel._get_guest_id(identifier)
    return await guest_intel.get_full_guest_context(guest_id)


async def check_guest_risk(identifier: str) -> Dict[str, Any]:
    """Check if a guest is risky"""
    guest_id = guest_intel._get_guest_id(identifier)
    profile = await guest_intel.get_profile(guest_id)
    
    if not profile:
        return {"risk_level": "unknown", "new_guest": True}
    
    risk_level = "low"
    if profile.risk_score > 50:
        risk_level = "high"
    elif profile.risk_score > 25:
        risk_level = "medium"
    
    return {
        "risk_level": risk_level,
        "risk_score": profile.risk_score,
        "banned": profile.banned,
        "damage_history": profile.damage_history,
        "complaint_count": profile.complaint_count,
        "vip_tier": profile.vip_tier,
        "lifetime_value": profile.lifetime_value
    }
