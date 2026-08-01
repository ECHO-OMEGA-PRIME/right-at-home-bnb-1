from __future__ import annotations

from datetime import datetime, timezone

from vrbo_mailbridge.ical_evidence import parse_calendar_evidence


def test_vrbo_ical_event_becomes_reservation_evidence() -> None:
    raw = b"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Vrbo//Calendar//EN
BEGIN:VEVENT
UID:CONF-ICAL-100@vrbo.com
DTSTART;VALUE=DATE:20261001
DTEND;VALUE=DATE:20261004
SUMMARY:RESERVED: Jane Traveler
DESCRIPTION:Confirmation code: CONF-ICAL-100
STATUS:CONFIRMED
SEQUENCE:2
END:VEVENT
END:VCALENDAR
"""

    evidence = parse_calendar_evidence(
        raw,
        property_id="property-1",
        vrbo_listing_id="listing-1",
        observed_at=datetime(2026, 7, 17, 12, 0, tzinfo=timezone.utc),
    )

    assert len(evidence) == 1
    item = evidence[0]
    assert item.source_type == "VRBO_ICAL"
    assert item.property_id == "property-1"
    assert item.vrbo_listing_id == "listing-1"
    assert item.confirmation_code == "CONF-ICAL-100"
    assert item.status == "CONFIRMED"
    assert item.check_in is not None
    assert item.check_out is not None


def test_owner_block_is_not_reservation_evidence() -> None:
    raw = b"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Vrbo//Calendar//EN
BEGIN:VEVENT
UID:owner-block-100@vrbo.com
DTSTART;VALUE=DATE:20261010
DTEND;VALUE=DATE:20261012
SUMMARY:Blocked
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
"""

    evidence = parse_calendar_evidence(
        raw,
        property_id="property-1",
        vrbo_listing_id="listing-1",
        observed_at=datetime(2026, 7, 17, 12, 0, tzinfo=timezone.utc),
    )

    assert evidence == []
