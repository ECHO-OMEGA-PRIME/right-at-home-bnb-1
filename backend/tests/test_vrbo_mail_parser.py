from __future__ import annotations

from email.message import EmailMessage

from vrbo_mailbridge.models import EventType, ParseStatus
from vrbo_mailbridge.parser import evidence_from_mail, parse_message


def _raw(subject: str, body: str) -> bytes:
    message = EmailMessage()
    message["From"] = "Vrbo <automated@messages.vrbo.com>"
    message["To"] = "host@example.com"
    message["Subject"] = subject
    message["Message-ID"] = "<msg-123@example.com>"
    message["Date"] = "Fri, 17 Jul 2026 10:00:00 -0500"
    message.set_content(body)
    return message.as_bytes()


def test_parse_confirmed_reservation() -> None:
    parsed = parse_message(
        _raw(
            "New reservation confirmed",
            """
Reservation ID: HA-ABC123
Confirmation code: CONF-9911
Listing ID: 445566
Property: Midland Retreat
Guest name: Jane Traveler
Guest email: jane@example.com
Guest phone: +1 432 555 0100
Guests: 4
Check-in: August 2, 2026
Check-out: August 5, 2026
Total: $1,234.56
""",
        ),
        mailbox="INBOX",
        uid_validity=10,
        uid=20,
    )

    assert parsed.event_type == EventType.NEW_RESERVATION
    assert parsed.parse_status == ParseStatus.PARSED
    assert parsed.parsed["reservation_id"] == "HA-ABC123"
    assert parsed.parsed["confirmation_code"] == "CONF-9911"
    assert parsed.parsed["guest_count"] == 4
    assert parsed.parsed["total_amount_cents"] == 123456
    assert parsed.parsed["status"] == "CONFIRMED"

    evidence = evidence_from_mail(parsed)
    assert evidence is not None
    assert evidence.reservation_key == "VRBO:RES:HA-ABC123"
    assert evidence.check_in is not None
    assert evidence.check_out is not None


def test_parse_cancellation_without_dates_is_valid() -> None:
    parsed = parse_message(
        _raw(
            "Reservation cancelled",
            """
Reservation ID: HA-CANCEL-7
Confirmation code: CANCEL-7
This reservation has been cancelled.
""",
        ),
        mailbox="INBOX",
        uid_validity=10,
        uid=21,
    )

    assert parsed.event_type == EventType.RESERVATION_CANCELLED
    assert parsed.parse_status == ParseStatus.PARSED
    assert parsed.parsed["status"] == "CANCELLED"


def test_unknown_template_fails_closed() -> None:
    parsed = parse_message(
        _raw("Weekly Vrbo newsletter", "Here are hosting tips for this week."),
        mailbox="INBOX",
        uid_validity=10,
        uid=22,
    )

    assert parsed.event_type == EventType.UNKNOWN
    assert parsed.parse_status == ParseStatus.UNKNOWN_TEMPLATE
    assert evidence_from_mail(parsed) is None


def test_known_reservation_missing_identity_is_partial() -> None:
    parsed = parse_message(
        _raw(
            "New booking",
            """
Property: Midland Retreat
Check-in: August 2, 2026
Check-out: August 5, 2026
""",
        ),
        mailbox="INBOX",
        uid_validity=10,
        uid=23,
    )
    assert parsed.parse_status == ParseStatus.PARTIAL
    assert parsed.parse_error == "missing:reservation_identity"


def test_candidate_sender_accepts_vrbo_subdomain() -> None:
    from vrbo_mailbridge.parser import is_candidate_message

    parsed = parse_message(
        _raw("Hosting update", "No reservation fields."),
        mailbox="INBOX",
        uid_validity=10,
        uid=24,
    )
    assert is_candidate_message(
        parsed,
        allowed_sender_domains=("vrbo.com",),
        subject_markers=(),
    )
