from __future__ import annotations

import os
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from typing import Any
from urllib.parse import urlparse

import httpx
from icalendar import Calendar

from .evidence import evidence_from_mapping
from .repository import MailBridgeRepository


ICAL_PARSER_VERSION = "vrbo-ical-v1"


@dataclass(frozen=True)
class IcalFeed:
    property_id: str
    vrbo_listing_id: str
    url: str


@dataclass
class IcalIngestStats:
    feeds_configured: int = 0
    feeds_succeeded: int = 0
    feeds_failed: int = 0
    events_examined: int = 0
    evidence_created: int = 0
    duplicates: int = 0
    errors: list[str] | None = None

    def __post_init__(self) -> None:
        if self.errors is None:
            self.errors = []

    def to_dict(self) -> dict[str, Any]:
        return {
            "feeds_configured": self.feeds_configured,
            "feeds_succeeded": self.feeds_succeeded,
            "feeds_failed": self.feeds_failed,
            "events_examined": self.events_examined,
            "evidence_created": self.evidence_created,
            "duplicates": self.duplicates,
            "errors": list(self.errors or []),
        }


def load_configured_feeds(repository: MailBridgeRepository) -> list[IcalFeed]:
    with repository.connect() as conn, conn.cursor() as cur:
        cur.execute(
            '''
            SELECT "propertyId", "vrboListingId", "icalUrl"
            FROM "VrboSync"
            WHERE "syncEnabled" = true
              AND "icalUrl" IS NOT NULL
              AND BTRIM("icalUrl") <> ''
            ORDER BY "propertyId"
            '''
        )
        return [
            IcalFeed(
                property_id=str(row[0]),
                vrbo_listing_id=str(row[1]),
                url=str(row[2]),
            )
            for row in cur.fetchall()
        ]


def _allowed_domains() -> tuple[str, ...]:
    return tuple(
        item.strip().lower().lstrip(".")
        for item in os.getenv(
            "VRBO_ICAL_ALLOWED_DOMAINS",
            "vrbo.com,homeaway.com",
        ).split(",")
        if item.strip()
    )


def _validate_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        raise ValueError("iCal feed must use HTTPS")
    host = (parsed.hostname or "").lower()
    if not host:
        raise ValueError("iCal feed host is missing")
    if not any(host == domain or host.endswith("." + domain) for domain in _allowed_domains()):
        raise ValueError("iCal feed host is not allowlisted")


def _fetch_feed(url: str) -> bytes:
    _validate_url(url)
    max_bytes = max(1024, int(os.getenv("VRBO_ICAL_MAX_BYTES", "5242880")))
    timeout_seconds = max(5, int(os.getenv("VRBO_ICAL_TIMEOUT_SECONDS", "30")))

    with httpx.Client(
        timeout=timeout_seconds,
        follow_redirects=True,
        headers={"User-Agent": "RightAtHomeBnB-MailBridge/1.0"},
    ) as client:
        response = client.get(url)
        response.raise_for_status()
        _validate_url(str(response.url))
        content = response.content
        if len(content) > max_bytes:
            raise ValueError("iCal feed exceeds VRBO_ICAL_MAX_BYTES")
        return content


def _as_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        result = value
    elif isinstance(value, date):
        result = datetime.combine(value, time.min)
    else:
        return None
    if result.tzinfo is None:
        result = result.replace(tzinfo=timezone.utc)
    return result.astimezone(timezone.utc)


def _text(component: Any, key: str) -> str:
    value = component.get(key)
    return str(value).strip() if value is not None else ""


def _reservation_identity(uid: str, summary: str, description: str) -> tuple[str | None, str | None]:
    text = f"{summary}\n{description}"

    reservation_match = re.search(
        r"(?i)\b(?:reservation|booking)\s*(?:id|number|#)\s*[:#-]?\s*([A-Z0-9-]{4,})\b",
        text,
    )
    confirmation_match = re.search(
        r"(?i)\bconfirmation\s*(?:code|number|#)?\s*[:#-]?\s*([A-Z0-9-]{4,})\b",
        text,
    )

    reservation_id = reservation_match.group(1) if reservation_match else None
    confirmation_code = confirmation_match.group(1) if confirmation_match else None

    if not reservation_id and uid:
        uid_local = uid.split("@", 1)[0].strip()
        if re.fullmatch(r"[A-Z0-9-]{6,}", uid_local, re.IGNORECASE):
            confirmation_code = confirmation_code or uid_local

    return reservation_id, confirmation_code


def _guest_name(summary: str) -> str | None:
    patterns = (
        r"(?i)^\s*reserved\s*[:\-]\s*(.+?)\s*$",
        r"(?i)^\s*(.+?)\s*[-–]\s*reservation\s*$",
    )
    for pattern in patterns:
        match = re.match(pattern, summary)
        if match:
            candidate = match.group(1).strip()
            if candidate and candidate.lower() not in {"blocked", "not available"}:
                return candidate
    return None


def parse_calendar_evidence(
    raw_calendar: bytes,
    *,
    property_id: str,
    vrbo_listing_id: str,
    observed_at: datetime | None = None,
) -> list[Any]:
    fetched_at = (observed_at or datetime.now(timezone.utc)).astimezone(timezone.utc)
    calendar = Calendar.from_ical(raw_calendar)
    evidence = []

    for component in calendar.walk("VEVENT"):
        uid = _text(component, "UID")
        summary = _text(component, "SUMMARY")
        description = _text(component, "DESCRIPTION")
        status_raw = _text(component, "STATUS").upper()
        check_in = _as_datetime(component.decoded("DTSTART", None))
        check_out = _as_datetime(component.decoded("DTEND", None))
        if not uid or not check_in or not check_out:
            continue

        cancelled = (
            status_raw == "CANCELLED"
            or "cancelled" in summary.lower()
            or "canceled" in summary.lower()
        )
        blocked = (
            "blocked" in summary.lower()
            or "not available" in summary.lower()
        )
        status = "CANCELLED" if cancelled else ("BLOCKED" if blocked else "CONFIRMED")
        reservation_id, confirmation_code = _reservation_identity(uid, summary, description)

        payload = {
            "event_type": "RESERVATION_CANCELLED" if cancelled else "NEW_RESERVATION",
            "property_id": property_id,
            "vrbo_listing_id": vrbo_listing_id,
            "reservation_id": reservation_id,
            "confirmation_code": confirmation_code,
            "status": status,
            "check_in": check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "guest_name": _guest_name(summary),
            "ical_uid": uid,
            "summary": summary,
            "description": description,
            "sequence": int(component.get("SEQUENCE", 0) or 0),
        }
        source_key = f"{vrbo_listing_id}:{uid}"
        evidence.append(
            evidence_from_mapping(
                source_type="VRBO_ICAL",
                source_key=source_key,
                payload=payload,
                parser_version=ICAL_PARSER_VERSION,
                observed_at=fetched_at,
            )
        )

    return evidence


def ingest_configured_feeds(
    repository: MailBridgeRepository,
    *,
    dry_run: bool = False,
) -> IcalIngestStats:
    feeds = load_configured_feeds(repository)
    stats = IcalIngestStats(feeds_configured=len(feeds))

    for feed in feeds:
        try:
            raw = _fetch_feed(feed.url)
            items = parse_calendar_evidence(
                raw,
                property_id=feed.property_id,
                vrbo_listing_id=feed.vrbo_listing_id,
            )
            stats.events_examined += len(items)
            for item in items:
                if dry_run:
                    stats.evidence_created += 1
                    continue
                _, created = repository.store_evidence(item)
                if created:
                    stats.evidence_created += 1
                else:
                    stats.duplicates += 1
            stats.feeds_succeeded += 1
        except Exception as exc:
            stats.feeds_failed += 1
            if isinstance(exc, httpx.HTTPStatusError):
                detail = f"http_status_{exc.response.status_code}"
            elif isinstance(exc, httpx.RequestError):
                detail = "request_failed"
            elif isinstance(exc, ValueError):
                detail = str(exc)
            else:
                detail = type(exc).__name__
            stats.errors.append(f"{feed.property_id}:{detail}")

    return stats


# Owner blocks are availability evidence, not guest reservations. Keep the
# parser reusable, but exclude BLOCKED entries from the reservation ledger.
_parse_calendar_evidence_including_blocks = parse_calendar_evidence


def parse_calendar_evidence(
    raw_calendar: bytes,
    *,
    property_id: str,
    vrbo_listing_id: str,
    observed_at: datetime | None = None,
) -> list[Any]:
    return [
        item
        for item in _parse_calendar_evidence_including_blocks(
            raw_calendar,
            property_id=property_id,
            vrbo_listing_id=vrbo_listing_id,
            observed_at=observed_at,
        )
        if item.status != "BLOCKED"
    ]
