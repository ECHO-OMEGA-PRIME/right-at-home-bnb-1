"""
Right At Home BnB - Payments API Routes (Stripe)
================================================
Booking payments, security deposits, refunds, and cleaner payouts.

@author ECHO OMEGA PRIME
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from pydantic import BaseModel
from datetime import date

from services.stripe_payments import stripe_payment_service

router = APIRouter()


class BookingPaymentRequest(BaseModel):
    guest_email: str
    guest_name: str
    amount_total: float
    property_id: str
    booking_id: str
    check_in: str
    check_out: str
    include_security_deposit: bool = True


class SecurityDepositRefundRequest(BaseModel):
    booking_id: str
    full_refund: bool = True
    deduction_amount: float = 0.0
    deduction_reason: Optional[str] = None


class DamageClaimRequest(BaseModel):
    booking_id: str
    claim_amount: float
    description: str
    evidence_urls: list = []


class CleanerPayoutRequest(BaseModel):
    cleaner_name: str
    cleaner_email: str
    amount: float
    cleanings_count: int
    pay_period_start: str
    pay_period_end: str


class CleanerOnboardRequest(BaseModel):
    cleaner_email: str
    cleaner_name: str


class RefundRequest(BaseModel):
    payment_intent_id: str
    amount: Optional[float] = None
    reason: str = "requested_by_customer"


# =========================================================================
# BOOKING PAYMENTS
# =========================================================================

@router.post("/booking/create")
async def create_booking_payment(request: BookingPaymentRequest):
    """Create payment intent for booking."""
    return await stripe_payment_service.process_booking_payment(
        guest_email=request.guest_email,
        guest_name=request.guest_name,
        amount_total=request.amount_total,
        property_id=request.property_id,
        booking_id=request.booking_id,
        check_in=request.check_in,
        check_out=request.check_out,
        include_security_deposit=request.include_security_deposit
    )


@router.post("/booking/confirm/{payment_intent_id}")
async def confirm_payment(payment_intent_id: str):
    """Confirm a payment intent."""
    return await stripe_payment_service.confirm_payment(payment_intent_id)


@router.get("/booking/{booking_id}")
async def get_booking_payment(booking_id: str):
    """Get payment details for a booking."""
    return await stripe_payment_service.get_booking_payment(booking_id)


# =========================================================================
# SECURITY DEPOSITS
# =========================================================================

@router.post("/deposit/release")
async def release_security_deposit(request: SecurityDepositRefundRequest):
    """Release security deposit (full or partial)."""
    return await stripe_payment_service.release_security_deposit(
        booking_id=request.booking_id,
        full_refund=request.full_refund,
        deduction_amount=request.deduction_amount,
        deduction_reason=request.deduction_reason
    )


@router.post("/deposit/claim")
async def file_damage_claim(request: DamageClaimRequest):
    """File a damage claim against security deposit."""
    return await stripe_payment_service.file_damage_claim(
        booking_id=request.booking_id,
        claim_amount=request.claim_amount,
        description=request.description,
        evidence_urls=request.evidence_urls
    )


# =========================================================================
# CLEANER PAYOUTS (Stripe Connect)
# =========================================================================

@router.post("/cleaners/onboard")
async def onboard_cleaner(request: CleanerOnboardRequest):
    """Create Stripe Connect account for cleaner."""
    return await stripe_payment_service.create_cleaner_connect_account(
        cleaner_email=request.cleaner_email,
        cleaner_name=request.cleaner_name
    )


@router.post("/cleaners/payout")
async def create_cleaner_payout(request: CleanerPayoutRequest):
    """Create payout to cleaner via Stripe Connect."""
    return await stripe_payment_service.create_cleaner_payout(
        cleaner_name=request.cleaner_name,
        cleaner_email=request.cleaner_email,
        amount=request.amount,
        cleanings_count=request.cleanings_count,
        pay_period_start=request.pay_period_start,
        pay_period_end=request.pay_period_end
    )


@router.get("/cleaners/payout-history/{cleaner_email}")
async def get_cleaner_payout_history(cleaner_email: str, limit: int = 20):
    """Get payout history for a cleaner."""
    return await stripe_payment_service.get_cleaner_payout_history(
        cleaner_email, limit
    )


# =========================================================================
# REFUNDS
# =========================================================================

@router.post("/refund")
async def process_refund(request: RefundRequest):
    """Process a refund."""
    return await stripe_payment_service.process_refund(
        payment_intent_id=request.payment_intent_id,
        amount=request.amount,
        reason=request.reason
    )


# =========================================================================
# STRIPE WEBHOOKS
# =========================================================================

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    return await stripe_payment_service.handle_webhook(payload, sig_header)


# =========================================================================
# REVENUE & REPORTING
# =========================================================================

@router.get("/revenue/daily")
async def get_daily_revenue(target_date: Optional[str] = None):
    """Get daily revenue summary."""
    return await stripe_payment_service.get_daily_revenue(target_date)


@router.get("/revenue/monthly")
async def get_monthly_revenue(year: int, month: int):
    """Get monthly revenue summary."""
    return await stripe_payment_service.get_monthly_revenue(year, month)


@router.get("/revenue/property/{property_id}")
async def get_property_revenue(
    property_id: str,
    start_date: str,
    end_date: str
):
    """Get revenue for a specific property."""
    return await stripe_payment_service.get_property_revenue(
        property_id, start_date, end_date
    )
