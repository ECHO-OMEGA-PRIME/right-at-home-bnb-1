"""
Right At Home BnB - PayPal Payment Service
==========================================
PayPal payment processing for direct bookings.
Steven Palma uses PayPal (not Stripe) for all transactions.

Supports:
- PayPal Checkout (Orders API v2)
- Guest booking payments
- Security deposit holds
- Refunds
- Webhook verification

PayPal REST API Docs: https://developer.paypal.com/docs/api/orders/v2/

@author ECHO OMEGA PRIME
@owner Steven Palma - Right At Home BnB, Midland, TX
"""

import os
import base64
import hashlib
import hmac
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

import httpx
from loguru import logger
from pydantic import BaseModel, Field


# =============================================================================
# CONFIGURATION
# =============================================================================

PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "")
PAYPAL_MODE = os.getenv("PAYPAL_MODE", "sandbox")  # "sandbox" or "live"
PAYPAL_WEBHOOK_ID = os.getenv("PAYPAL_WEBHOOK_ID", "")

PAYPAL_BASE_URL = (
    "https://api-m.paypal.com"
    if PAYPAL_MODE == "live"
    else "https://api-m.sandbox.paypal.com"
)

PAYPAL_AVAILABLE = bool(PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET)


# =============================================================================
# ENUMS & MODELS
# =============================================================================

class PaymentType(str, Enum):
    BOOKING = "booking"
    SECURITY_DEPOSIT = "security_deposit"
    CLEANING_FEE = "cleaning_fee"
    DAMAGE_CLAIM = "damage_claim"
    PET_FEE = "pet_fee"
    REFUND = "refund"


class PayPalOrderStatus(str, Enum):
    CREATED = "CREATED"
    SAVED = "SAVED"
    APPROVED = "APPROVED"
    VOIDED = "VOIDED"
    COMPLETED = "COMPLETED"
    PAYER_ACTION_REQUIRED = "PAYER_ACTION_REQUIRED"


class PayPalOrder(BaseModel):
    order_id: str
    status: str
    approve_url: Optional[str] = None
    capture_url: Optional[str] = None
    amount: float
    currency: str = "USD"
    created_at: datetime = Field(default_factory=datetime.now)


# =============================================================================
# PAYPAL PAYMENT SERVICE
# =============================================================================

class PayPalPaymentService:
    """PayPal payment service using Orders API v2."""

    def __init__(self):
        self._access_token: Optional[str] = None
        self._token_expires: Optional[datetime] = None
        self._client = httpx.AsyncClient(timeout=30.0)

    async def _get_access_token(self) -> str:
        """Get OAuth2 access token from PayPal."""
        if self._access_token and self._token_expires and datetime.now() < self._token_expires:
            return self._access_token

        if not PAYPAL_AVAILABLE:
            raise RuntimeError("PayPal credentials not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.")

        auth_string = base64.b64encode(
            f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode()
        ).decode()

        response = await self._client.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            headers={
                "Authorization": f"Basic {auth_string}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
        )

        if response.status_code != 200:
            logger.error(f"PayPal auth failed: {response.status_code} {response.text}")
            raise RuntimeError(f"PayPal authentication failed: {response.status_code}")

        data = response.json()
        self._access_token = data["access_token"]
        # Token typically valid for ~9 hours, refresh after 8
        from datetime import timedelta
        self._token_expires = datetime.now() + timedelta(seconds=data.get("expires_in", 28800) - 300)

        logger.info("PayPal access token refreshed")
        return self._access_token

    async def _headers(self) -> Dict[str, str]:
        """Get authenticated headers."""
        token = await self._get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    # =========================================================================
    # CREATE ORDER
    # =========================================================================

    async def create_order(
        self,
        amount: float,
        booking_id: str,
        confirmation_code: str,
        property_name: str,
        check_in: str,
        check_out: str,
        guest_name: str,
        guest_email: str,
        payment_type: PaymentType = PaymentType.BOOKING,
        include_deposit: bool = True,
        deposit_amount: float = 250.00,
        return_url: str = "",
        cancel_url: str = "",
    ) -> Dict[str, Any]:
        """
        Create a PayPal order for a booking.

        Returns order_id and approve_url for redirecting the guest.
        """
        if not return_url:
            base = os.getenv("APP_BASE_URL", "https://rah-midland.com")
            return_url = f"{base}/booking/confirm?booking_id={booking_id}"
            cancel_url = f"{base}/booking/cancelled?booking_id={booking_id}"

        total_amount = amount
        if include_deposit:
            total_amount += deposit_amount

        # Build item breakdown
        items = [
            {
                "name": f"Booking: {property_name}",
                "description": f"{check_in} to {check_out} | Conf: {confirmation_code}",
                "quantity": "1",
                "unit_amount": {
                    "currency_code": "USD",
                    "value": f"{amount:.2f}",
                },
                "category": "DIGITAL_GOODS",
            }
        ]

        if include_deposit:
            items.append({
                "name": "Refundable Security Deposit",
                "description": "Returned within 7 days of checkout if no damage",
                "quantity": "1",
                "unit_amount": {
                    "currency_code": "USD",
                    "value": f"{deposit_amount:.2f}",
                },
                "category": "DIGITAL_GOODS",
            })

        order_payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "reference_id": booking_id,
                    "description": f"Right At Home BnB - {property_name} ({confirmation_code})",
                    "custom_id": confirmation_code,
                    "invoice_id": f"RAH-{confirmation_code}",
                    "amount": {
                        "currency_code": "USD",
                        "value": f"{total_amount:.2f}",
                        "breakdown": {
                            "item_total": {
                                "currency_code": "USD",
                                "value": f"{total_amount:.2f}",
                            },
                        },
                    },
                    "items": items,
                    "payee": {
                        "email_address": os.getenv(
                            "PAYPAL_MERCHANT_EMAIL",
                            "steven@rightathomebnb.com"
                        ),
                    },
                }
            ],
            "payment_source": {
                "paypal": {
                    "experience_context": {
                        "payment_method_preference": "IMMEDIATE_PAYMENT_REQUIRED",
                        "brand_name": "Right At Home BnB - Midland",
                        "locale": "en-US",
                        "landing_page": "LOGIN",
                        "shipping_preference": "NO_SHIPPING",
                        "user_action": "PAY_NOW",
                        "return_url": return_url,
                        "cancel_url": cancel_url,
                    }
                }
            },
            "application_context": {
                "brand_name": "Right At Home BnB - Midland",
                "locale": "en-US",
                "landing_page": "LOGIN",
                "shipping_preference": "NO_SHIPPING",
                "user_action": "PAY_NOW",
                "return_url": return_url,
                "cancel_url": cancel_url,
            },
        }

        headers = await self._headers()
        response = await self._client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            headers=headers,
            json=order_payload,
        )

        if response.status_code not in (200, 201):
            logger.error(f"PayPal create order failed: {response.status_code} {response.text}")
            return {"error": f"PayPal order creation failed: {response.text}"}

        data = response.json()
        order_id = data["id"]
        status = data["status"]

        # Extract approve URL
        approve_url = None
        for link in data.get("links", []):
            if link["rel"] == "payer-action":
                approve_url = link["href"]
                break
            if link["rel"] == "approve":
                approve_url = link["href"]
                break

        logger.info(
            f"PayPal order created: {order_id} | "
            f"Amount: ${total_amount:.2f} | "
            f"Booking: {confirmation_code} | "
            f"Status: {status}"
        )

        return {
            "order_id": order_id,
            "status": status,
            "approve_url": approve_url,
            "amount": total_amount,
            "booking_id": booking_id,
            "confirmation_code": confirmation_code,
        }

    # =========================================================================
    # CAPTURE ORDER (after guest approves)
    # =========================================================================

    async def capture_order(self, order_id: str) -> Dict[str, Any]:
        """
        Capture payment after guest approves on PayPal.

        Call this after the guest is redirected back from PayPal.
        """
        headers = await self._headers()
        response = await self._client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            headers=headers,
            json={},
        )

        if response.status_code not in (200, 201):
            logger.error(f"PayPal capture failed: {response.status_code} {response.text}")
            return {"error": f"Payment capture failed: {response.text}", "status": "FAILED"}

        data = response.json()
        status = data.get("status", "UNKNOWN")

        # Extract capture details
        capture_id = None
        capture_status = None
        captures = (
            data.get("purchase_units", [{}])[0]
            .get("payments", {})
            .get("captures", [])
        )
        if captures:
            capture_id = captures[0].get("id")
            capture_status = captures[0].get("status")

        logger.info(f"PayPal order {order_id} captured: {status} | Capture: {capture_id}")

        return {
            "success": status == "COMPLETED",
            "order_id": order_id,
            "capture_id": capture_id,
            "status": status,
            "capture_status": capture_status,
            "payer": data.get("payer", {}),
        }

    # =========================================================================
    # GET ORDER DETAILS
    # =========================================================================

    async def get_order(self, order_id: str) -> Dict[str, Any]:
        """Get full order details from PayPal."""
        headers = await self._headers()
        response = await self._client.get(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}",
            headers=headers,
        )

        if response.status_code != 200:
            return {"error": f"Failed to get order: {response.text}"}

        return response.json()

    # =========================================================================
    # REFUND
    # =========================================================================

    async def refund_payment(
        self,
        capture_id: str,
        amount: Optional[float] = None,
        reason: str = "Guest cancellation",
    ) -> Dict[str, Any]:
        """
        Refund a captured payment.

        Args:
            capture_id: The PayPal capture ID from the original payment.
            amount: Partial refund amount. None = full refund.
            reason: Reason for the refund.
        """
        headers = await self._headers()

        refund_payload: Dict[str, Any] = {
            "note_to_payer": reason,
        }

        if amount is not None:
            refund_payload["amount"] = {
                "currency_code": "USD",
                "value": f"{amount:.2f}",
            }

        response = await self._client.post(
            f"{PAYPAL_BASE_URL}/v2/payments/captures/{capture_id}/refund",
            headers=headers,
            json=refund_payload,
        )

        if response.status_code not in (200, 201):
            logger.error(f"PayPal refund failed: {response.status_code} {response.text}")
            return {"error": f"Refund failed: {response.text}"}

        data = response.json()
        refund_id = data.get("id")
        refund_status = data.get("status")

        logger.info(f"PayPal refund {refund_id}: {refund_status} | Capture: {capture_id}")

        return {
            "success": refund_status == "COMPLETED",
            "refund_id": refund_id,
            "status": refund_status,
            "capture_id": capture_id,
            "amount": amount,
        }

    # =========================================================================
    # WEBHOOK VERIFICATION
    # =========================================================================

    async def verify_webhook(
        self,
        headers: Dict[str, str],
        body: bytes,
    ) -> bool:
        """
        Verify PayPal webhook signature.

        Headers needed: PAYPAL-TRANSMISSION-ID, PAYPAL-TRANSMISSION-TIME,
        PAYPAL-TRANSMISSION-SIG, PAYPAL-CERT-URL, PAYPAL-AUTH-ALGO
        """
        if not PAYPAL_WEBHOOK_ID:
            logger.warning("PAYPAL_WEBHOOK_ID not set, skipping webhook verification")
            return True

        verification_payload = {
            "auth_algo": headers.get("PAYPAL-AUTH-ALGO", ""),
            "cert_url": headers.get("PAYPAL-CERT-URL", ""),
            "transmission_id": headers.get("PAYPAL-TRANSMISSION-ID", ""),
            "transmission_sig": headers.get("PAYPAL-TRANSMISSION-SIG", ""),
            "transmission_time": headers.get("PAYPAL-TRANSMISSION-TIME", ""),
            "webhook_id": PAYPAL_WEBHOOK_ID,
            "webhook_event": body.decode("utf-8") if isinstance(body, bytes) else body,
        }

        auth_headers = await self._headers()
        response = await self._client.post(
            f"{PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature",
            headers=auth_headers,
            json=verification_payload,
        )

        if response.status_code == 200:
            result = response.json()
            verified = result.get("verification_status") == "SUCCESS"
            if not verified:
                logger.warning(f"PayPal webhook verification failed: {result}")
            return verified

        logger.error(f"PayPal webhook verify request failed: {response.status_code}")
        return False

    # =========================================================================
    # CLEANUP
    # =========================================================================

    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()


# =============================================================================
# SINGLETON
# =============================================================================

_paypal_service: Optional[PayPalPaymentService] = None


def get_paypal_service() -> PayPalPaymentService:
    """Get singleton PayPal payment service."""
    global _paypal_service
    if _paypal_service is None:
        _paypal_service = PayPalPaymentService()
    return _paypal_service
