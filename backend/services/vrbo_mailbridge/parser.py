from __future__ import annotations

import hashlib
import html
import json
import re
from datetime import datetime, timezone
from email import policy
from email.header import decode_header, make_header
from email.message import Message
from email.parser import BytesParser
from email.utils import parseaddr, parsedate_to_datetime
from html.parser import HTMLParser
from typing import Iterable

from dateutil import parser as date_parser

from .models import (
    EventType,
    PARSER_VERSION,
    ParseStatus,
    ParsedMail,
    ReservationEvidence,
)


_LABEL_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "reservation_id": (
        re.compile(r"(?im)^\s*(?:reservation|booking)\s*(?:id|number|#)\s*[:#-]\s*([A-Z0-9-]{4,})\s*$"),
        re.compile(r"(?i)\b(?:reservation|booking)\s*(?:id|number|#)\s*[:#-]?\s*([A-Z0-9-]{4,})\b"),
    ),
    "confirmation_code": (
        re.compile(r"(?im)^\s*confirmation\s*(?:code|number|#)?\s*[:#-]\s*([A-Z0-9-]{4,})\s*$"),
        re.compile(r"(?i)\bconfirmation\s*(?:code|number|#)?\s*[:#-]?\s*([A-Z0-9-]{4,})\b"),
    ),
    "listing_id": (
        re.compile(r"(?im)^\s*(?:listing|property)\s*(?:id|number|#)\s*[:#-]\s*([A-Z0-9-]{3,})\s*$"),
    ),
    "property_name": (
        re.compile(r"(?im)^\s*(?:property|listing)\s*(?:name)?\s*[:#-]\s*(.+?)\s*$"),
    ),
    "guest_name": (
        re.compile(r"(?im)^\s*(?:guest|traveler)\s*(?:name)?\s*[:#-]\s*(.+?)\s*$"),
    ),
    "guest_email": (
        re.compile(r"(?im)^\s*(?:guest|traveler)\s*email\s*[:#-]\s*([^\s<>]+@[^\s<>]+)\s*$"),
        re.compile(r"(?i)\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b"),
    ),
    "guest_phone": (
        re.compile(r"(?im)^\s*(?:guest|traveler)\s*phone\s*[:#-]\s*(.+?)\s*$"),
    ),
    "guest_count": (
        re.compile(r"(?im)^\s*(?:guests?|travelers?|party\s*size)\s*[:#-]\s*(\d{1,3})\s*$"),
    ),
    "check_in": (
        re.compile(r"(?im)^\s*(?:check[\s-]?in|arrival(?:\s*date)?)\s*[:#-]\s*(.+?)\s*$"),
    ),
    "check_out": (
        re.compile(r"(?im)^\s*(?:check[\s-]?out|departure(?:\s*date)?)\s*[:#-]\s*(.+?)\s*$"),
    ),
    "total": (
        re.compile(r"(?im)^\s*(?:reservation\s*)?(?:total|amount\s*paid|payout)\s*[:#-]\s*(?:USD\s*)?\$?\s*([\d,]+(?:\.\d{1,2})?)\s*$"),
    ),
}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data)

    def text(self) -> str:
        return "\n".join(self.parts)


def _decode_header(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _decode_payload(part: Message) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        raw = part.get_payload()
        return raw if isinstance(raw, str) else ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def _message_body(message: Message) -> str:
    plain: list[str] = []
    html_parts: list[str] = []

    if message.is_multipart():
        for part in message.walk():
            disposition = (part.get("Content-Disposition") or "").lower()
            if "attachment" in disposition:
                continue
            content_type = part.get_content_type()
            if content_type == "text/plain":
                plain.append(_decode_payload(part))
            elif content_type == "text/html":
                html_parts.append(_decode_payload(part))
    else:
        if message.get_content_type() == "text/html":
            html_parts.append(_decode_payload(message))
        else:
            plain.append(_decode_payload(message))

    if plain:
        body = "\n".join(plain)
    else:
        extractor = _TextExtractor()
        for fragment in html_parts:
            extractor.feed(fragment)
        body = extractor.text()

    body = html.unescape(body)
    body = body.replace("\r\n", "\n").replace("\r", "\n")
    body = re.sub(r"[ \t]+\n", "\n", body)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


def _first_match(name: str, text: str) -> str | None:
    for pattern in _LABEL_PATTERNS[name]:
        match = pattern.search(text)
        if match:
            return match.group(1).strip(" \t\r\n<>")
    return None


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    cleaned = re.sub(r"\s+\([^)]*\)\s*$", "", value.strip())
    try:
        parsed = date_parser.parse(cleaned, fuzzy=True)
    except (ValueError, OverflowError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _parse_received_at(message: Message) -> datetime:
    date_value = message.get("Date")
    if date_value:
        try:
            parsed = parsedate_to_datetime(date_value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except (TypeError, ValueError, OverflowError):
            pass
    return datetime.now(timezone.utc)


def classify_event(subject: str, body: str) -> EventType:
    text = f"{subject}\n{body}".lower()

    if any(token in text for token in (
        "reservation cancelled",
        "reservation canceled",
        "booking cancelled",
        "booking canceled",
        "cancellation confirmed",
        "has been cancelled",
        "has been canceled",
    )):
        return EventType.RESERVATION_CANCELLED

    if any(token in text for token in (
        "reservation changed",
        "reservation modified",
        "booking updated",
        "dates changed",
        "guest updated their reservation",
    )):
        return EventType.RESERVATION_MODIFIED

    if any(token in text for token in (
        "new reservation",
        "booking confirmed",
        "reservation confirmed",
        "you received a booking",
        "new booking",
    )):
        return EventType.NEW_RESERVATION

    if any(token in text for token in (
        "new inquiry",
        "traveler inquiry",
        "booking inquiry",
        "request to book",
    )):
        return EventType.INQUIRY

    if any(token in text for token in (
        "payment received",
        "payout",
        "payment confirmation",
    )):
        return EventType.PAYMENT

    if any(token in text for token in (
        "new message",
        "traveler sent you a message",
        "guest message",
    )):
        return EventType.MESSAGE

    return EventType.UNKNOWN


def _status_for_event(event_type: EventType, text: str) -> str | None:
    if event_type == EventType.RESERVATION_CANCELLED:
        return "CANCELLED"
    if event_type == EventType.NEW_RESERVATION:
        return "CONFIRMED"
    if event_type == EventType.INQUIRY:
        return "INQUIRY"
    if event_type == EventType.RESERVATION_MODIFIED:
        explicit = re.search(r"(?im)^\s*status\s*[:#-]\s*([A-Z _-]+?)\s*$", text)
        return explicit.group(1).strip().upper().replace(" ", "_") if explicit else None
    return None


def _parse_amount_cents(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return round(float(value.replace(",", "")) * 100)
    except ValueError:
        return None


def _reservation_key(parsed: dict[str, object]) -> str:
    reservation_id = str(parsed.get("reservation_id") or "").strip()
    confirmation = str(parsed.get("confirmation_code") or "").strip()
    if reservation_id:
        return f"VRBO:RES:{reservation_id.upper()}"
    if confirmation:
        return f"VRBO:CONF:{confirmation.upper()}"

    fallback = "|".join(
        str(parsed.get(key) or "").strip().lower()
        for key in (
            "vrbo_listing_id",
            "property_name",
            "check_in",
            "check_out",
            "guest_email",
        )
    )
    return "VRBO:FALLBACK:" + hashlib.sha256(fallback.encode("utf-8")).hexdigest()[:24]


def parse_message(
    raw_message: bytes,
    *,
    mailbox: str,
    uid_validity: int,
    uid: int,
) -> ParsedMail:
    raw_sha256 = hashlib.sha256(raw_message).hexdigest()
    try:
        message = BytesParser(policy=policy.default).parsebytes(raw_message)
    except Exception as exc:
        return ParsedMail(
            mailbox=mailbox,
            uid_validity=uid_validity,
            uid=uid,
            internet_message_id=None,
            from_address=None,
            subject="",
            received_at=datetime.now(timezone.utc),
            raw_sha256=raw_sha256,
            body_text="",
            headers={},
            parser_version=PARSER_VERSION,
            event_type=EventType.UNKNOWN,
            parse_status=ParseStatus.REJECTED,
            parsed={},
            parse_error=f"email_parse_error:{type(exc).__name__}",
        )

    subject = _decode_header(message.get("Subject"))
    from_address = parseaddr(_decode_header(message.get("From")))[1] or None
    body = _message_body(message)
    event_type = classify_event(subject, body)
    text = f"{subject}\n{body}"

    check_in = _parse_date(_first_match("check_in", text))
    check_out = _parse_date(_first_match("check_out", text))
    guest_count_raw = _first_match("guest_count", text)

    parsed: dict[str, object] = {
        "reservation_id": _first_match("reservation_id", text),
        "confirmation_code": _first_match("confirmation_code", text),
        "vrbo_listing_id": _first_match("listing_id", text),
        "property_name": _first_match("property_name", text),
        "guest_name": _first_match("guest_name", text),
        "guest_email": _first_match("guest_email", text),
        "guest_phone": _first_match("guest_phone", text),
        "guest_count": int(guest_count_raw) if guest_count_raw else None,
        "check_in": check_in.isoformat() if check_in else None,
        "check_out": check_out.isoformat() if check_out else None,
        "total_amount_cents": _parse_amount_cents(_first_match("total", text)),
        "currency": "USD",
        "status": _status_for_event(event_type, text),
    }
    parsed["reservation_key"] = _reservation_key(parsed)

    reservation_event = event_type in {
        EventType.NEW_RESERVATION,
        EventType.RESERVATION_MODIFIED,
        EventType.RESERVATION_CANCELLED,
    }
    has_identity = bool(parsed["reservation_id"] or parsed["confirmation_code"])
    has_dates = bool(check_in and check_out)

    if event_type == EventType.UNKNOWN:
        parse_status = ParseStatus.UNKNOWN_TEMPLATE
        parse_error = "unknown_vrbo_template"
    elif reservation_event and (
        not has_identity
        or (event_type != EventType.RESERVATION_CANCELLED and not has_dates)
    ):
        parse_status = ParseStatus.PARTIAL
        missing: list[str] = []
        if not has_identity:
            missing.append("reservation_identity")
        if event_type != EventType.RESERVATION_CANCELLED and not has_dates:
            missing.append("stay_dates")
        parse_error = "missing:" + ",".join(missing)
    else:
        parse_status = ParseStatus.PARSED
        parse_error = None

    headers = {
        key: _decode_header(value)
        for key, value in message.items()
        if key.lower() in {
            "message-id",
            "from",
            "to",
            "subject",
            "date",
            "reply-to",
        }
    }

    return ParsedMail(
        mailbox=mailbox,
        uid_validity=uid_validity,
        uid=uid,
        internet_message_id=_decode_header(message.get("Message-ID")) or None,
        from_address=from_address,
        subject=subject,
        received_at=_parse_received_at(message),
        raw_sha256=raw_sha256,
        body_text=body,
        headers=headers,
        parser_version=PARSER_VERSION,
        event_type=event_type,
        parse_status=parse_status,
        parsed=parsed,
        parse_error=parse_error,
    )


def evidence_from_mail(parsed_mail: ParsedMail) -> ReservationEvidence | None:
    if parsed_mail.parse_status not in {ParseStatus.PARSED, ParseStatus.PARTIAL}:
        return None

    parsed = parsed_mail.parsed
    reservation_key = str(parsed.get("reservation_key") or "")
    if not reservation_key:
        return None

    def parse_iso(value: object) -> datetime | None:
        return _parse_date(str(value)) if value else None

    source_key = (
        parsed_mail.internet_message_id
        or f"{parsed_mail.mailbox}:{parsed_mail.uid_validity}:{parsed_mail.uid}"
    )
    payload = {
        "mailbox": parsed_mail.mailbox,
        "uid_validity": parsed_mail.uid_validity,
        "uid": parsed_mail.uid,
        "internet_message_id": parsed_mail.internet_message_id,
        "received_at": parsed_mail.received_at.astimezone(timezone.utc).isoformat(),
        "raw_sha256": parsed_mail.raw_sha256,
        "parser_version": parsed_mail.parser_version,
        "event_type": parsed_mail.event_type.value,
        "parse_status": parsed_mail.parse_status.value,
        "parsed": dict(parsed),
    }
    payload_sha256 = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    ).hexdigest()

    validation_errors: list[str] = []
    check_in = parse_iso(parsed.get("check_in"))
    check_out = parse_iso(parsed.get("check_out"))
    if check_in and check_out and check_out <= check_in:
        validation_errors.append("check_out_not_after_check_in")

    return ReservationEvidence(
        source_type="VRBO_EMAIL",
        source_key=source_key,
        reservation_key=reservation_key,
        observed_at=parsed_mail.received_at,
        payload_sha256=payload_sha256,
        payload=payload,
        parser_version=parsed_mail.parser_version,
        event_type=parsed_mail.event_type.value,
        vrbo_listing_id=str(parsed.get("vrbo_listing_id") or "") or None,
        reservation_id=str(parsed.get("reservation_id") or "") or None,
        confirmation_code=str(parsed.get("confirmation_code") or "") or None,
        status=str(parsed.get("status") or "") or None,
        check_in=check_in,
        check_out=check_out,
        guest_name=str(parsed.get("guest_name") or "") or None,
        guest_email=str(parsed.get("guest_email") or "") or None,
        guest_phone=str(parsed.get("guest_phone") or "") or None,
        guest_count=(
            int(parsed["guest_count"])
            if parsed.get("guest_count") is not None
            else None
        ),
        total_amount_cents=(
            int(parsed["total_amount_cents"])
            if parsed.get("total_amount_cents") is not None
            else None
        ),
        currency=str(parsed.get("currency") or "USD"),
        validation_status="INVALID" if validation_errors else "VALID",
        validation_errors=tuple(validation_errors),
    )


def is_candidate_message(
    parsed_mail: ParsedMail,
    *,
    allowed_sender_domains: Iterable[str],
    subject_markers: Iterable[str],
) -> bool:
    sender = (parsed_mail.from_address or "").lower()
    sender_domain = sender.rsplit("@", 1)[-1] if "@" in sender else ""
    subject = parsed_mail.subject.lower()
    domains = tuple(
        domain.strip().lower().lstrip("@")
        for domain in allowed_sender_domains
        if domain.strip()
    )
    markers = tuple(
        marker.strip().lower()
        for marker in subject_markers
        if marker.strip()
    )

    sender_match = any(
        sender_domain == domain or sender_domain.endswith("." + domain)
        for domain in domains
    )
    marker_match = any(marker in subject for marker in markers)
    return sender_match or marker_match
