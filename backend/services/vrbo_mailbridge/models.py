from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Mapping


PARSER_VERSION = "vrbo-mail-v1"


class EventType(str, Enum):
    NEW_RESERVATION = "NEW_RESERVATION"
    RESERVATION_MODIFIED = "RESERVATION_MODIFIED"
    RESERVATION_CANCELLED = "RESERVATION_CANCELLED"
    INQUIRY = "INQUIRY"
    PAYMENT = "PAYMENT"
    MESSAGE = "MESSAGE"
    UNKNOWN = "UNKNOWN"


class ParseStatus(str, Enum):
    PARSED = "PARSED"
    PARTIAL = "PARTIAL"
    UNKNOWN_TEMPLATE = "UNKNOWN_TEMPLATE"
    REJECTED = "REJECTED"


class ConsensusStatus(str, Enum):
    CONSISTENT = "CONSISTENT"
    UNVERIFIED = "UNVERIFIED"
    SYNC_AT_RISK = "SYNC_AT_RISK"


@dataclass(frozen=True)
class ParsedMail:
    mailbox: str
    uid_validity: int
    uid: int
    internet_message_id: str | None
    from_address: str | None
    subject: str
    received_at: datetime
    raw_sha256: str
    body_text: str
    headers: Mapping[str, str]
    parser_version: str
    event_type: EventType
    parse_status: ParseStatus
    parsed: Mapping[str, Any]
    parse_error: str | None = None

    def to_json_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["received_at"] = self.received_at.astimezone(timezone.utc).isoformat()
        value["event_type"] = self.event_type.value
        value["parse_status"] = self.parse_status.value
        return value


@dataclass(frozen=True)
class ReservationEvidence:
    source_type: str
    source_key: str
    reservation_key: str
    observed_at: datetime
    payload_sha256: str
    payload: Mapping[str, Any]
    parser_version: str
    event_type: str | None = None
    property_id: str | None = None
    vrbo_listing_id: str | None = None
    reservation_id: str | None = None
    confirmation_code: str | None = None
    status: str | None = None
    check_in: datetime | None = None
    check_out: datetime | None = None
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    guest_count: int | None = None
    total_amount_cents: int | None = None
    currency: str = "USD"
    validation_status: str = "VALID"
    validation_errors: tuple[str, ...] = ()

    def to_json_dict(self) -> dict[str, Any]:
        value = asdict(self)
        for field_name in ("observed_at", "check_in", "check_out"):
            dt = value[field_name]
            if dt is not None:
                value[field_name] = dt.astimezone(timezone.utc).isoformat()
        return value


@dataclass(frozen=True)
class ReconciliationResult:
    reservation_key: str
    consensus_status: ConsensusStatus
    source_count: int
    evidence_count: int
    source_fingerprint: str
    canonical: Mapping[str, Any]
    disagreements: Mapping[str, Any] = field(default_factory=dict)
    validation_errors: tuple[str, ...] = ()

    def to_json_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["consensus_status"] = self.consensus_status.value
        return value
