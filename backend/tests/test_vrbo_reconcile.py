from __future__ import annotations

from datetime import datetime, timezone

from vrbo_mailbridge.evidence import evidence_from_mapping
from vrbo_mailbridge.models import ConsensusStatus
from vrbo_mailbridge.reconcile import reconcile_all, reconcile_reservation


NOW = datetime(2026, 7, 17, 12, 0, tzinfo=timezone.utc)


def _evidence(source_type: str, source_key: str, **overrides):
    payload = {
        "reservation_id": "HA-ABC123",
        "vrbo_listing_id": "445566",
        "status": "CONFIRMED",
        "check_in": "2026-08-02T21:00:00Z",
        "check_out": "2026-08-05T15:00:00Z",
        "guest_email": "jane@example.com",
        "total_amount_cents": 123456,
        **overrides,
    }
    return evidence_from_mapping(
        source_type=source_type,
        source_key=source_key,
        payload=payload,
        parser_version="test-v1",
        observed_at=NOW,
    )


def test_two_matching_sources_are_consistent() -> None:
    items = [
        _evidence("VRBO_EMAIL", "email-1"),
        _evidence("VRBO_ICAL", "ical-1"),
    ]
    result = reconcile_reservation(items[0].reservation_key, items)
    assert result.consensus_status == ConsensusStatus.CONSISTENT
    assert result.source_count == 2
    assert result.disagreements == {}


def test_single_source_is_unverified() -> None:
    item = _evidence("VRBO_EMAIL", "email-1")
    result = reconcile_reservation(item.reservation_key, [item])
    assert result.consensus_status == ConsensusStatus.UNVERIFIED


def test_status_disagreement_is_sync_at_risk() -> None:
    items = [
        _evidence("VRBO_EMAIL", "email-1", status="CANCELLED"),
        _evidence("VRBO_ICAL", "ical-1", status="CONFIRMED"),
    ]
    result = reconcile_reservation(items[0].reservation_key, items)
    assert result.consensus_status == ConsensusStatus.SYNC_AT_RISK
    assert "status" in result.disagreements


def test_date_disagreement_is_sync_at_risk() -> None:
    items = [
        _evidence("VRBO_EMAIL", "email-1"),
        _evidence("RAH_ICAL", "ical-rah", check_out="2026-08-06T15:00:00Z"),
    ]
    result = reconcile_reservation(items[0].reservation_key, items)
    assert result.consensus_status == ConsensusStatus.SYNC_AT_RISK
    assert "check_out" in result.disagreements


def test_invalid_date_order_is_sync_at_risk() -> None:
    item = _evidence(
        "VRBO_EMAIL",
        "email-1",
        check_in="2026-08-05T15:00:00Z",
        check_out="2026-08-02T15:00:00Z",
    )
    result = reconcile_reservation(item.reservation_key, [item])
    assert result.consensus_status == ConsensusStatus.SYNC_AT_RISK
    assert "check_out_not_after_check_in" in result.validation_errors


def test_reconcile_all_groups_reservations() -> None:
    first = _evidence("VRBO_EMAIL", "email-1")
    second = evidence_from_mapping(
        source_type="VRBO_EMAIL",
        source_key="email-2",
        payload={
            "reservation_id": "HA-SECOND",
            "status": "CONFIRMED",
            "check_in": "2026-09-01T20:00:00Z",
            "check_out": "2026-09-03T15:00:00Z",
        },
        parser_version="test-v1",
        observed_at=NOW,
    )
    results = reconcile_all([first, second])
    assert len(results) == 2


def test_same_stay_dates_with_different_times_are_consistent() -> None:
    items = [
        _evidence(
            "VRBO_EMAIL",
            "email-time",
            check_in="2026-08-02T00:00:00Z",
            check_out="2026-08-05T00:00:00Z",
        ),
        _evidence(
            "VRBO_ICAL",
            "ical-time",
            check_in="2026-08-02T21:00:00Z",
            check_out="2026-08-05T15:00:00Z",
        ),
    ]
    result = reconcile_reservation(items[0].reservation_key, items)
    assert result.consensus_status == ConsensusStatus.CONSISTENT


def test_latest_evidence_per_source_supersedes_history() -> None:
    old_email = evidence_from_mapping(
        source_type="VRBO_EMAIL",
        source_key="email-confirmed",
        payload={
            "reservation_id": "HA-ABC123",
            "status": "CONFIRMED",
            "check_in": "2026-08-02T00:00:00Z",
            "check_out": "2026-08-05T00:00:00Z",
        },
        parser_version="test-v1",
        observed_at=datetime(2026, 7, 16, 12, 0, tzinfo=timezone.utc),
    )
    cancellation_email = evidence_from_mapping(
        source_type="VRBO_EMAIL",
        source_key="email-cancelled",
        payload={
            "reservation_id": "HA-ABC123",
            "status": "CANCELLED",
            "check_in": "2026-08-02T00:00:00Z",
            "check_out": "2026-08-05T00:00:00Z",
        },
        parser_version="test-v1",
        observed_at=datetime(2026, 7, 17, 12, 0, tzinfo=timezone.utc),
    )
    ical_tombstone = evidence_from_mapping(
        source_type="VRBO_ICAL",
        source_key="ical-cancelled",
        payload={
            "reservation_id": "HA-ABC123",
            "status": "CANCELLED",
            "check_in": "2026-08-02T00:00:00Z",
            "check_out": "2026-08-05T00:00:00Z",
        },
        parser_version="test-v1",
        observed_at=datetime(2026, 7, 17, 12, 5, tzinfo=timezone.utc),
    )

    result = reconcile_reservation(
        old_email.reservation_key,
        [old_email, cancellation_email, ical_tombstone],
    )
    assert result.consensus_status == ConsensusStatus.CONSISTENT
    assert result.evidence_count == 3
    assert result.canonical["status"] == "CANCELLED"


def test_identifier_aliases_merge_reservation_and_confirmation_keys() -> None:
    email = evidence_from_mapping(
        source_type="VRBO_EMAIL",
        source_key="email-alias",
        payload={
            "reservation_id": "HA-ALIAS-1",
            "confirmation_code": "CONF-ALIAS-1",
            "vrbo_listing_id": "445566",
            "status": "CONFIRMED",
            "check_in": "2026-10-01T00:00:00Z",
            "check_out": "2026-10-03T00:00:00Z",
            "guest_name": "Jane Traveler",
        },
        parser_version="test-v1",
        observed_at=NOW,
    )
    ical = evidence_from_mapping(
        source_type="VRBO_ICAL",
        source_key="ical-alias",
        payload={
            "confirmation_code": "CONF-ALIAS-1",
            "vrbo_listing_id": "445566",
            "status": "CONFIRMED",
            "check_in": "2026-10-01T00:00:00Z",
            "check_out": "2026-10-03T00:00:00Z",
            "guest_name": "Jane Traveler",
        },
        parser_version="test-v1",
        observed_at=NOW,
    )

    results = reconcile_all([email, ical])
    assert len(results) == 1
    assert results[0].reservation_key == "VRBO:RES:HA-ALIAS-1"
    assert results[0].consensus_status == ConsensusStatus.CONSISTENT
