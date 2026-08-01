"""Verified VRBO/Expedia webhook metadata intake.

This legacy FastAPI adapter never generates, stores, emails, logs, or returns
entry codes or Wi-Fi passwords. Credential issuance belongs exclusively to the
secured Tuya access lifecycle in the primary web application.
"""

import hashlib
import hmac
import json
import os
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request
from loguru import logger

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


def _verify(payload: bytes, supplied: str, secret: str) -> bool:
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return bool(supplied) and hmac.compare_digest(expected, supplied)


def _event_summary(payload: Dict[str, Any]) -> Dict[str, Any]:
    reservation = payload.get("reservation") or payload.get("booking") or payload
    return {
        "event": payload.get("event_type") or payload.get("eventType") or payload.get("event") or "unknown",
        "booking_id": reservation.get("reservationId") or reservation.get("id"),
        "property_id": reservation.get("propertyId") or reservation.get("property_id"),
        "check_in": reservation.get("checkIn") or reservation.get("check_in"),
        "check_out": reservation.get("checkOut") or reservation.get("check_out"),
    }


@router.post("/vrbo", status_code=202)
async def vrbo_webhook(request: Request):
    """Accept verified reservation metadata and queue secure lifecycle work."""
    raw = await request.body()
    secret = os.getenv("VRBO_WEBHOOK_SECRET") or os.getenv("EXPEDIA_SECRET") or ""
    allow_unsigned_dev = (
        os.getenv("ENVIRONMENT", "development").lower() != "production"
        and os.getenv("ALLOW_UNSIGNED_VRBO_WEBHOOK", "false").lower() == "true"
    )
    if not secret and not allow_unsigned_dev:
        raise HTTPException(status_code=503, detail="Webhook verification is not configured")

    signature = (
        request.headers.get("x-expedia-signature")
        or request.headers.get("x-vrbo-signature")
        or request.headers.get("x-signature")
        or ""
    )
    if secret and not _verify(raw, signature, secret):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    summary = _event_summary(payload)
    event = str(summary["event"])
    lifecycle = {
        "reservation.created": "PROVISION_PENDING_VERIFICATION",
        "booking.created": "PROVISION_PENDING_VERIFICATION",
        "reservation.modified": "RESCHEDULE_PENDING_VERIFICATION",
        "booking.modified": "RESCHEDULE_PENDING_VERIFICATION",
        "reservation.cancelled": "REVOKE_PENDING_VERIFICATION",
        "booking.cancelled": "REVOKE_PENDING_VERIFICATION",
    }.get(event, "NO_ACCESS_ACTION")

    logger.info(
        "Verified lodging webhook accepted: event={} booking_id={} property_id={} lifecycle={}",
        event,
        summary.get("booking_id"),
        summary.get("property_id"),
        lifecycle,
    )
    return {
        "status": "accepted",
        "event": event,
        "booking_id": summary.get("booking_id"),
        "access_lifecycle": lifecycle,
        "credential_authority": "secure-tuya-access-lifecycle-only",
    }


@router.post("/airbnb", status_code=501)
async def airbnb_webhook_disabled():
    """No unverified Airbnb webhook adapter is enabled in this service."""
    raise HTTPException(status_code=501, detail="Airbnb webhook adapter is not configured")
