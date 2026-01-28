"""
Loyalty Program Models for Right at Home BnB
Complete loyalty system with tiers, points, rewards, and referrals
"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    Text, Numeric, ForeignKey, Enum, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from decimal import Decimal
import enum
from .connection import Base


# ============================================
# LOYALTY ENUMS
# ============================================

class LoyaltyTier(str, enum.Enum):
    """Loyalty tier levels"""
    BRONZE = "BRONZE"      # 0-999 points
    SILVER = "SILVER"      # 1000-4999 points
    GOLD = "GOLD"          # 5000-14999 points
    PLATINUM = "PLATINUM"  # 15000+ points


class PointTransactionType(str, enum.Enum):
    """Types of point transactions"""
    EARNING_BOOKING = "EARNING_BOOKING"       # Points earned from booking
    EARNING_REFERRAL = "EARNING_REFERRAL"     # Points from referral bonus
    EARNING_BIRTHDAY = "EARNING_BIRTHDAY"     # Birthday bonus points
    EARNING_ANNIVERSARY = "EARNING_ANNIVERSARY"  # Anniversary bonus
    EARNING_REVIEW = "EARNING_REVIEW"         # Points for leaving review
    EARNING_BONUS = "EARNING_BONUS"           # Manual bonus points
    EARNING_PROMOTION = "EARNING_PROMOTION"   # Promotional bonus
    REDEMPTION = "REDEMPTION"                 # Points redeemed for discount
    EXPIRATION = "EXPIRATION"                 # Points expired
    ADJUSTMENT = "ADJUSTMENT"                 # Manual adjustment (admin)


class RewardType(str, enum.Enum):
    """Types of rewards"""
    PERCENTAGE_DISCOUNT = "PERCENTAGE_DISCOUNT"  # % off booking
    FIXED_DISCOUNT = "FIXED_DISCOUNT"            # $ off booking
    FREE_NIGHT = "FREE_NIGHT"                    # Free night stay
    EARLY_CHECKIN = "EARLY_CHECKIN"              # Early check-in privilege
    LATE_CHECKOUT = "LATE_CHECKOUT"              # Late check-out privilege
    ROOM_UPGRADE = "ROOM_UPGRADE"                # Upgrade to better property
    FREE_CLEANING = "FREE_CLEANING"              # Waived cleaning fee
    GIFT_CARD = "GIFT_CARD"                      # Gift card reward


class RewardStatus(str, enum.Enum):
    """Status of a redeemed reward"""
    AVAILABLE = "AVAILABLE"
    CLAIMED = "CLAIMED"
    USED = "USED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class ReferralStatus(str, enum.Enum):
    """Status of a referral"""
    PENDING = "PENDING"          # Referral sent, not yet signed up
    REGISTERED = "REGISTERED"    # Referred user signed up
    COMPLETED = "COMPLETED"      # First booking made, points awarded
    EXPIRED = "EXPIRED"          # Referral link expired


# ============================================
# LOYALTY MODELS
# ============================================

class LoyaltyProgram(Base):
    """
    Main loyalty program configuration
    Single row table for program settings
    """
    __tablename__ = "loyalty_programs"

    id = Column(String, primary_key=True, default="default")
    name = Column(String, nullable=False, default="Right at Home Rewards")
    is_active = Column(Boolean, default=True)

    # Points earning rates
    points_per_dollar = Column(Integer, default=10)  # 10 points per $1 spent
    referral_bonus_referrer = Column(Integer, default=500)  # Referrer gets 500 points
    referral_bonus_referee = Column(Integer, default=250)   # New member gets 250 points
    birthday_bonus = Column(Integer, default=100)           # Birthday bonus
    anniversary_bonus = Column(Integer, default=200)        # Anniversary bonus
    review_bonus = Column(Integer, default=50)              # For leaving review

    # Tier thresholds
    silver_threshold = Column(Integer, default=1000)
    gold_threshold = Column(Integer, default=5000)
    platinum_threshold = Column(Integer, default=15000)

    # Tier benefits (discounts as percentages)
    bronze_discount = Column(Numeric(5, 2), default=0)      # 0% discount
    silver_discount = Column(Numeric(5, 2), default=5)      # 5% discount
    gold_discount = Column(Numeric(5, 2), default=10)       # 10% discount
    platinum_discount = Column(Numeric(5, 2), default=15)   # 15% discount

    # Point redemption rate
    points_to_dollar_rate = Column(Integer, default=100)  # 100 points = $1
    min_redemption_points = Column(Integer, default=500)  # Minimum 500 points to redeem
    max_redemption_percentage = Column(Integer, default=50)  # Max 50% of booking

    # Point expiration
    points_expiry_months = Column(Integer, default=24)  # Points expire after 24 months

    # Program settings JSON
    tier_benefits = Column(JSON)  # Detailed benefits per tier
    special_promotions = Column(JSON)  # Active promotions

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class LoyaltyMember(Base):
    """
    Loyalty program membership for a guest
    One-to-one with Guest
    """
    __tablename__ = "loyalty_members"

    id = Column(String, primary_key=True)
    guest_id = Column(String, ForeignKey("guests.id"), unique=True, nullable=False)
    member_number = Column(String, unique=True, nullable=False)  # Unique member ID

    # Current status
    current_tier = Column(Enum(LoyaltyTier), default=LoyaltyTier.BRONZE)
    lifetime_points = Column(Integer, default=0)  # Total points ever earned
    available_points = Column(Integer, default=0)  # Points available to spend
    redeemed_points = Column(Integer, default=0)  # Points already redeemed
    expired_points = Column(Integer, default=0)   # Points that have expired

    # Tracking
    total_bookings = Column(Integer, default=0)
    total_spend = Column(Numeric(12, 2), default=0)
    total_savings = Column(Numeric(12, 2), default=0)  # Total saved via rewards

    # Referral tracking
    referral_code = Column(String, unique=True)  # Unique referral code
    referred_by_id = Column(String, ForeignKey("loyalty_members.id"))
    successful_referrals = Column(Integer, default=0)

    # Special dates (for bonus points)
    birthday = Column(DateTime)
    anniversary_date = Column(DateTime)  # When they joined loyalty program
    last_birthday_bonus = Column(DateTime)  # Last time birthday bonus awarded
    last_anniversary_bonus = Column(DateTime)

    # Status
    is_active = Column(Boolean, default=True)
    opted_in_marketing = Column(Boolean, default=True)

    # Timestamps
    enrolled_at = Column(DateTime, default=func.now())
    last_activity_at = Column(DateTime, default=func.now())
    tier_upgraded_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    guest = relationship("Guest", backref="loyalty_membership")
    point_transactions = relationship("PointTransaction", back_populates="member")
    rewards = relationship("MemberReward", back_populates="member")
    referrals_made = relationship("Referral", back_populates="referrer", foreign_keys="Referral.referrer_id")
    referred_by = relationship("LoyaltyMember", remote_side=[id], backref="referred_members")


class PointTransaction(Base):
    """
    Individual point transaction record
    Tracks all point earning and spending
    """
    __tablename__ = "point_transactions"

    id = Column(String, primary_key=True)
    member_id = Column(String, ForeignKey("loyalty_members.id"), nullable=False, index=True)

    # Transaction details
    transaction_type = Column(Enum(PointTransactionType), nullable=False)
    points = Column(Integer, nullable=False)  # Positive for earning, negative for redemption

    # Balance tracking
    balance_before = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)

    # Related entities
    booking_id = Column(String, ForeignKey("bookings.id"))
    referral_id = Column(String, ForeignKey("referrals.id"))
    reward_id = Column(String, ForeignKey("member_rewards.id"))

    # Additional info
    description = Column(String)
    amount_spent = Column(Numeric(10, 2))  # For booking-related transactions
    multiplier = Column(Float, default=1.0)  # For promotional multipliers

    # Expiration tracking
    expires_at = Column(DateTime)  # When these points expire
    is_expired = Column(Boolean, default=False)

    # Admin fields
    created_by = Column(String)  # User ID if manual adjustment
    notes = Column(Text)

    transaction_date = Column(DateTime, default=func.now(), index=True)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    member = relationship("LoyaltyMember", back_populates="point_transactions")
    booking = relationship("Booking", backref="point_transactions")


class RewardCatalog(Base):
    """
    Available rewards in the loyalty program
    """
    __tablename__ = "reward_catalog"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)

    # Reward type and value
    reward_type = Column(Enum(RewardType), nullable=False)
    value = Column(Numeric(10, 2))  # Dollar amount or percentage

    # Cost in points
    points_cost = Column(Integer, nullable=False)

    # Availability
    is_active = Column(Boolean, default=True)
    min_tier_required = Column(Enum(LoyaltyTier), default=LoyaltyTier.BRONZE)

    # Limits
    quantity_available = Column(Integer)  # None = unlimited
    max_per_member = Column(Integer, default=1)  # Max times a member can redeem
    max_per_booking = Column(Integer, default=1)  # Max per single booking

    # Validity
    valid_from = Column(DateTime)
    valid_until = Column(DateTime)

    # Redemption rules
    min_booking_amount = Column(Numeric(10, 2))  # Minimum booking value
    blackout_dates = Column(JSON)  # Dates when reward can't be used
    applicable_properties = Column(JSON)  # Property IDs, null = all

    # Display
    image_url = Column(String)
    sort_order = Column(Integer, default=0)
    featured = Column(Boolean, default=False)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    member_rewards = relationship("MemberReward", back_populates="reward")


class MemberReward(Base):
    """
    Rewards claimed/redeemed by members
    """
    __tablename__ = "member_rewards"

    id = Column(String, primary_key=True)
    member_id = Column(String, ForeignKey("loyalty_members.id"), nullable=False, index=True)
    reward_id = Column(String, ForeignKey("reward_catalog.id"), nullable=False)

    # Status
    status = Column(Enum(RewardStatus), default=RewardStatus.CLAIMED)

    # Redemption details
    points_spent = Column(Integer, nullable=False)
    reward_value = Column(Numeric(10, 2))  # Actual value of reward

    # Usage
    booking_id = Column(String, ForeignKey("bookings.id"))  # When used on booking

    # Validity
    claimed_at = Column(DateTime, default=func.now())
    used_at = Column(DateTime)
    expires_at = Column(DateTime)

    # Code for claiming
    redemption_code = Column(String, unique=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    member = relationship("LoyaltyMember", back_populates="rewards")
    reward = relationship("RewardCatalog", back_populates="member_rewards")
    booking = relationship("Booking", backref="rewards_applied")


class Referral(Base):
    """
    Referral tracking
    """
    __tablename__ = "referrals"

    id = Column(String, primary_key=True)
    referrer_id = Column(String, ForeignKey("loyalty_members.id"), nullable=False, index=True)

    # Referral details
    referral_code = Column(String, nullable=False)
    referee_email = Column(String, nullable=False)
    referee_name = Column(String)

    # Status tracking
    status = Column(Enum(ReferralStatus), default=ReferralStatus.PENDING)

    # When referee signs up
    referee_member_id = Column(String, ForeignKey("loyalty_members.id"))
    registered_at = Column(DateTime)

    # When first booking made
    first_booking_id = Column(String, ForeignKey("bookings.id"))
    completed_at = Column(DateTime)

    # Points awarded
    referrer_points_awarded = Column(Integer, default=0)
    referee_points_awarded = Column(Integer, default=0)

    # Expiration
    expires_at = Column(DateTime)

    # Communication
    invite_sent_at = Column(DateTime)
    invite_resent_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    referrer = relationship("LoyaltyMember", back_populates="referrals_made", foreign_keys=[referrer_id])
    referee_member = relationship("LoyaltyMember", foreign_keys=[referee_member_id])
    first_booking = relationship("Booking", backref="referral")


class TierBenefit(Base):
    """
    Detailed benefits for each tier
    """
    __tablename__ = "tier_benefits"

    id = Column(String, primary_key=True)
    tier = Column(Enum(LoyaltyTier), nullable=False)

    # Benefit details
    benefit_name = Column(String, nullable=False)
    benefit_description = Column(Text)
    benefit_type = Column(String)  # discount, perk, priority, etc.
    benefit_value = Column(String)  # Could be percentage, text, etc.

    # Display
    icon = Column(String)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('tier', 'benefit_name', name='_tier_benefit_uc'),
    )


class PointsPromotion(Base):
    """
    Special promotions for bonus points
    """
    __tablename__ = "points_promotions"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)

    # Promotion type
    promotion_type = Column(String)  # multiplier, bonus, etc.

    # Multiplier for points (2x, 3x, etc.)
    points_multiplier = Column(Float, default=1.0)

    # Bonus points flat
    bonus_points = Column(Integer, default=0)

    # Conditions
    min_booking_amount = Column(Numeric(10, 2))
    min_nights = Column(Integer)
    applicable_tiers = Column(JSON)  # List of tiers eligible
    applicable_properties = Column(JSON)  # Property IDs, null = all

    # Validity
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)

    # Limits
    max_uses_total = Column(Integer)  # Total uses across all members
    max_uses_per_member = Column(Integer, default=1)
    current_uses = Column(Integer, default=0)

    # Status
    is_active = Column(Boolean, default=True)

    # Code if needed
    promo_code = Column(String)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


# ============================================
# UTILITY FUNCTIONS
# ============================================

def calculate_tier(lifetime_points: int, program_config: LoyaltyProgram) -> LoyaltyTier:
    """Calculate tier based on lifetime points"""
    if lifetime_points >= program_config.platinum_threshold:
        return LoyaltyTier.PLATINUM
    elif lifetime_points >= program_config.gold_threshold:
        return LoyaltyTier.GOLD
    elif lifetime_points >= program_config.silver_threshold:
        return LoyaltyTier.SILVER
    return LoyaltyTier.BRONZE


def get_tier_discount(tier: LoyaltyTier, program_config: LoyaltyProgram) -> Decimal:
    """Get discount percentage for a tier"""
    tier_discounts = {
        LoyaltyTier.BRONZE: program_config.bronze_discount,
        LoyaltyTier.SILVER: program_config.silver_discount,
        LoyaltyTier.GOLD: program_config.gold_discount,
        LoyaltyTier.PLATINUM: program_config.platinum_discount,
    }
    return tier_discounts.get(tier, Decimal(0))


def calculate_points_for_booking(
    booking_amount: Decimal,
    program_config: LoyaltyProgram,
    promotion: PointsPromotion = None
) -> int:
    """Calculate points earned for a booking"""
    base_points = int(booking_amount * program_config.points_per_dollar)

    if promotion:
        base_points = int(base_points * promotion.points_multiplier)
        base_points += promotion.bonus_points

    return base_points


def generate_member_number(prefix: str = "RAH") -> str:
    """Generate a unique member number"""
    import uuid
    import time
    timestamp = int(time.time()) % 100000
    unique = uuid.uuid4().hex[:6].upper()
    return f"{prefix}{timestamp}{unique}"


def generate_referral_code(member_id: str) -> str:
    """Generate a unique referral code"""
    import hashlib
    import time
    data = f"{member_id}-{time.time()}"
    return hashlib.md5(data.encode()).hexdigest()[:8].upper()
