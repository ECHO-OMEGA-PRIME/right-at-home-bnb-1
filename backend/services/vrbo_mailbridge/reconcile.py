from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Iterable, Sequence

from .models import ConsensusStatus, ReconciliationResult, ReservationEvidence


_CRITICAL_FIELDS = (
    "property_id",
    "vrbo_listing_id",
    "status",
    "check_in",
    "check_out",
)

_INFORMATIONAL_FIELDS = (
    "reservation_id",
    "confirmation_code",
    "guest_name",
    "guest_email",
    "guest_phone",
    "guest_count",
    "total_amount_cents",
    "currency",
)

_SOURCE_PRIORITY = {
    "VRBO_API": 500,
    "VRBO_EMAIL": 400,
    "VRBO_ICAL": 300,
    "RAH_ICAL": 200,
    "DIRECT": 100,
}


def _normalize_status(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().upper().replace(" ", "_")
    aliases = {
        "BOOKED": "CONFIRMED",
        "RESERVED": "CONFIRMED",
        "CANCELED": "CANCELLED",
        "CHECKED_OUT": "COMPLETED",
    }
    return aliases.get(normalized, normalized)


def _json_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return value


def _comparable(field: str, value: Any) -> Any:
    if value is None or value == "":
        return None
    if field == "status":
        return _normalize_status(str(value))
    if isinstance(value, datetime):
        normalized = value.astimezone(timezone.utc)
        if field in {"check_in", "check_out"}:
            return normalized.date().isoformat()
        return normalized.isoformat()
    if field in {"guest_email", "currency"}:
        return str(value).strip().upper() if field == "currency" else str(value).strip().lower()
    if isinstance(value, str):
        return value.strip()
    return value


def _latest_by_source(evidence: Sequence[ReservationEvidence]) -> list[ReservationEvidence]:
    latest: dict[str, ReservationEvidence] = {}
    for item in evidence:
        source = item.source_type.upper()
        current = latest.get(source)
        if current is None or (item.observed_at, item.payload_sha256) > (
            current.observed_at,
            current.payload_sha256,
        ):
            latest[source] = item
    return list(latest.values())


def _choose_canonical(field: str, evidence: Sequence[ReservationEvidence]) -> Any:
    populated = [item for item in evidence if _comparable(field, getattr(item, field)) is not None]
    if not populated:
        return None

    values = [_comparable(field, getattr(item, field)) for item in populated]
    counts = Counter(values)
    top_count = max(counts.values())
    candidates = {value for value, count in counts.items() if count == top_count}

    ranked = sorted(
        populated,
        key=lambda item: (
            _SOURCE_PRIORITY.get(item.source_type.upper(), 0),
            item.observed_at,
        ),
        reverse=True,
    )
    for item in ranked:
        candidate = _comparable(field, getattr(item, field))
        if candidate in candidates:
            return _json_value(getattr(item, field))
    return _json_value(getattr(ranked[0], field))


def reconcile_reservation(
    reservation_key: str,
    evidence: Sequence[ReservationEvidence],
) -> ReconciliationResult:
    if not evidence:
        raise ValueError("evidence must not be empty")

    current_evidence = _latest_by_source(evidence)
    source_types = {item.source_type.upper() for item in current_evidence}
    validation_errors = tuple(
        sorted(
            {
                error
                for item in current_evidence
                for error in item.validation_errors
            }
        )
    )

    canonical: dict[str, Any] = {
        "reservation_key": reservation_key,
        "event_type": _choose_canonical("event_type", current_evidence),
        "observed_at": max(item.observed_at for item in current_evidence).astimezone(timezone.utc).isoformat(),
    }
    for field in _CRITICAL_FIELDS + _INFORMATIONAL_FIELDS:
        canonical[field] = _choose_canonical(field, current_evidence)

    disagreements: dict[str, Any] = {}
    for field in _CRITICAL_FIELDS + ("total_amount_cents", "guest_email"):
        by_source: dict[str, list[Any]] = defaultdict(list)
        for item in current_evidence:
            value = _comparable(field, getattr(item, field))
            if value is not None:
                by_source[item.source_type.upper()].append(value)

        distinct_values = {
            json.dumps(value, sort_keys=True, default=str)
            for values in by_source.values()
            for value in values
        }
        if len(distinct_values) > 1:
            disagreements[field] = {
                source: sorted(
                    {_json_value(value) for value in values},
                    key=lambda value: str(value),
                )
                for source, values in sorted(by_source.items())
            }

    if validation_errors or disagreements:
        consensus_status = ConsensusStatus.SYNC_AT_RISK
    elif len(source_types) < 2:
        consensus_status = ConsensusStatus.UNVERIFIED
    else:
        consensus_status = ConsensusStatus.CONSISTENT

    fingerprint_material = "|".join(
        sorted(f"{item.source_type}:{item.payload_sha256}" for item in current_evidence)
    )
    source_fingerprint = hashlib.sha256(fingerprint_material.encode("utf-8")).hexdigest()

    return ReconciliationResult(
        reservation_key=reservation_key,
        consensus_status=consensus_status,
        source_count=len(source_types),
        evidence_count=len(evidence),
        source_fingerprint=source_fingerprint,
        canonical=canonical,
        disagreements=disagreements,
        validation_errors=validation_errors,
    )


def _identity_aliases(item: ReservationEvidence) -> set[str]:
    aliases: set[str] = set()
    if item.reservation_key:
        aliases.add(item.reservation_key.upper())
    if item.reservation_id:
        aliases.add("VRBO:RES:" + item.reservation_id.strip().upper())
    if item.confirmation_code:
        aliases.add("VRBO:CONF:" + item.confirmation_code.strip().upper())

    guest_identity = (item.guest_email or item.guest_name or "").strip().lower()
    if item.vrbo_listing_id and item.check_in and item.check_out and guest_identity:
        aliases.add(
            "VRBO:STAY:"
            + "|".join(
                (
                    item.vrbo_listing_id.strip().lower(),
                    item.check_in.astimezone(timezone.utc).date().isoformat(),
                    item.check_out.astimezone(timezone.utc).date().isoformat(),
                    guest_identity,
                )
            )
        )
    return aliases


def _canonical_group_key(items: Sequence[ReservationEvidence]) -> str:
    current = _latest_by_source(items)
    reservation_id = _choose_canonical("reservation_id", current)
    if reservation_id:
        return "VRBO:RES:" + str(reservation_id).strip().upper()
    confirmation = _choose_canonical("confirmation_code", current)
    if confirmation:
        return "VRBO:CONF:" + str(confirmation).strip().upper()
    keys = sorted(item.reservation_key for item in items if item.reservation_key)
    if not keys:
        raise ValueError("evidence group has no reservation key")
    return keys[0]


def reconcile_all(
    evidence: Iterable[ReservationEvidence],
) -> list[ReconciliationResult]:
    items = [item for item in evidence if item.reservation_key]
    if not items:
        return []

    parent = list(range(len(items)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left: int, right: int) -> None:
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    alias_owner: dict[str, int] = {}
    for index, item in enumerate(items):
        for alias in _identity_aliases(item):
            previous = alias_owner.get(alias)
            if previous is None:
                alias_owner[alias] = index
            else:
                union(index, previous)

    grouped: dict[int, list[ReservationEvidence]] = defaultdict(list)
    for index, item in enumerate(items):
        grouped[find(index)].append(item)

    results = [
        reconcile_reservation(_canonical_group_key(group), group)
        for group in grouped.values()
    ]
    return sorted(results, key=lambda result: result.reservation_key)
