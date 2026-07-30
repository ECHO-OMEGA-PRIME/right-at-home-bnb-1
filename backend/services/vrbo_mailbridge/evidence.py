from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Mapping

from dateutil import parser as date_parser

from .models import ReservationEvidence


def _parse_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = date_parser.parse(str(value), fuzzy=False)
        except (ValueError, TypeError, OverflowError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _reservation_key(payload: Mapping[str, Any]) -> str:
    reservation_id = str(payload.get("reservation_id") or payload.get("reservationId") or "").strip()
    confirmation = str(payload.get("confirmation_code") or payload.get("confirmationCode") or "").strip()
    if reservation_id:
        return f"VRBO:RES:{reservation_id.upper()}"
    if confirmation:
        return f"VRBO:CONF:{confirmation.upper()}"

    fallback = "|".join(
        str(
            payload.get(name)
            or payload.get(
                {
                    "vrbo_listing_id": "vrboListingId",
                    "check_in": "checkIn",
                    "check_out": "checkOut",
                    "guest_email": "guestEmail",
                }.get(name, name)
            )
            or ""
        ).strip().lower()
        for name in ("vrbo_listing_id", "property_id", "check_in", "check_out", "guest_email")
    )
    return "VRBO:FALLBACK:" + hashlib.sha256(fallback.encode("utf-8")).hexdigest()[:24]


def evidence_from_mapping(
    *,
    source_type: str,
    source_key: str,
    payload: Mapping[str, Any],
    parser_version: str,
    observed_at: datetime | None = None,
) -> ReservationEvidence:
    normalized_payload = dict(payload)
    payload_sha256 = hashlib.sha256(
        json.dumps(normalized_payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    ).hexdigest()

    def value(snake: str, camel: str) -> Any:
        return normalized_payload.get(snake, normalized_payload.get(camel))

    check_in = _parse_datetime(value("check_in", "checkIn"))
    check_out = _parse_datetime(value("check_out", "checkOut"))
    validation_errors: list[str] = []

    if value("check_in", "checkIn") and check_in is None:
        validation_errors.append("invalid_check_in")
    if value("check_out", "checkOut") and check_out is None:
        validation_errors.append("invalid_check_out")
    if check_in and check_out and check_out <= check_in:
        validation_errors.append("check_out_not_after_check_in")

    total_raw = value("total_amount_cents", "totalAmountCents")
    guest_count_raw = value("guest_count", "guestCount")
    try:
        total_amount_cents = int(total_raw) if total_raw is not None else None
    except (ValueError, TypeError):
        total_amount_cents = None
        validation_errors.append("invalid_total_amount_cents")
    try:
        guest_count = int(guest_count_raw) if guest_count_raw is not None else None
    except (ValueError, TypeError):
        guest_count = None
        validation_errors.append("invalid_guest_count")

    return ReservationEvidence(
        source_type=source_type.upper(),
        source_key=source_key,
        reservation_key=str(normalized_payload.get("reservation_key") or _reservation_key(normalized_payload)),
        observed_at=(observed_at or datetime.now(timezone.utc)).astimezone(timezone.utc),
        payload_sha256=payload_sha256,
        payload=normalized_payload,
        parser_version=parser_version,
        event_type=str(value("event_type", "eventType") or "") or None,
        property_id=str(value("property_id", "propertyId") or "") or None,
        vrbo_listing_id=str(value("vrbo_listing_id", "vrboListingId") or "") or None,
        reservation_id=str(value("reservation_id", "reservationId") or "") or None,
        confirmation_code=str(value("confirmation_code", "confirmationCode") or "") or None,
        status=str(normalized_payload.get("status") or "") or None,
        check_in=check_in,
        check_out=check_out,
        guest_name=str(value("guest_name", "guestName") or "") or None,
        guest_email=str(value("guest_email", "guestEmail") or "") or None,
        guest_phone=str(value("guest_phone", "guestPhone") or "") or None,
        guest_count=guest_count,
        total_amount_cents=total_amount_cents,
        currency=str(normalized_payload.get("currency") or "USD"),
        validation_status="INVALID" if validation_errors else "VALID",
        validation_errors=tuple(validation_errors),
    )
