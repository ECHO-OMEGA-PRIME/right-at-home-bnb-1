from __future__ import annotations

import imaplib
import os
import ssl
from dataclasses import dataclass, field
from typing import Iterable

from .parser import evidence_from_mail, is_candidate_message, parse_message
from .repository import MailBridgeRepository


@dataclass(frozen=True)
class ImapConfig:
    host: str
    port: int
    username: str
    password: str = field(repr=False)
    mailbox: str = "INBOX"
    allowed_sender_domains: tuple[str, ...] = ()
    subject_markers: tuple[str, ...] = ()
    max_messages: int = 250

    @classmethod
    def from_env(cls) -> "ImapConfig":
        shadow_mode = os.getenv("VRBO_MAIL_SHADOW_MODE", "true").strip().lower()
        if shadow_mode not in {"1", "true", "yes", "on"}:
            raise RuntimeError("VRBO_MAIL_SHADOW_MODE must remain true in Phase 1")

        username = os.getenv("VRBO_MAIL_USERNAME", "").strip()
        password = os.getenv("VRBO_MAIL_PASSWORD", "")
        password_file = os.getenv("VRBO_MAIL_PASSWORD_FILE", "").strip()
        if not password and password_file:
            with open(password_file, "r", encoding="utf-8") as handle:
                password = handle.read().strip()

        if not username:
            raise RuntimeError("VRBO_MAIL_USERNAME is required")
        if not password:
            raise RuntimeError("VRBO_MAIL_PASSWORD or VRBO_MAIL_PASSWORD_FILE is required")

        domains = tuple(
            item.strip().lower()
            for item in os.getenv(
                "VRBO_MAIL_ALLOWED_SENDER_DOMAINS",
                "vrbo.com,homeaway.com,expediagroup.com",
            ).split(",")
            if item.strip()
        )
        markers = tuple(
            item.strip().lower()
            for item in os.getenv(
                "VRBO_MAIL_SUBJECT_MARKERS",
                "vrbo,reservation,booking,inquiry,traveler",
            ).split(",")
            if item.strip()
        )

        return cls(
            host=os.getenv("VRBO_MAIL_IMAP_HOST", "imap.mail.att.net").strip(),
            port=int(os.getenv("VRBO_MAIL_IMAP_PORT", "993")),
            username=username,
            password=password,
            mailbox=os.getenv("VRBO_MAIL_MAILBOX", "INBOX").strip(),
            allowed_sender_domains=domains,
            subject_markers=markers,
            max_messages=max(1, int(os.getenv("VRBO_MAIL_MAX_MESSAGES", "250"))),
        )


@dataclass
class IngestStats:
    examined: int = 0
    candidates: int = 0
    stored: int = 0
    duplicates: int = 0
    evidence_created: int = 0
    unknown_templates: int = 0
    partial: int = 0
    errors: int = 0
    last_uid: int = 0

    def to_dict(self) -> dict[str, int]:
        return dict(self.__dict__)


def _uid_validity(conn: imaplib.IMAP4_SSL) -> int:
    response = conn.response("UIDVALIDITY")
    if response and response[1]:
        raw = response[1][0]
        if isinstance(raw, bytes):
            raw = raw.decode("ascii", errors="ignore")
        digits = "".join(ch for ch in str(raw) if ch.isdigit())
        if digits:
            return int(digits)
    raise RuntimeError("IMAP server did not return UIDVALIDITY")


def _extract_raw_message(fetch_data: Iterable[object]) -> bytes:
    for item in fetch_data:
        if isinstance(item, tuple) and len(item) >= 2 and isinstance(item[1], bytes):
            return item[1]
    raise RuntimeError("IMAP FETCH response did not contain message bytes")


def ingest_once(
    repository: MailBridgeRepository,
    config: ImapConfig,
    *,
    dry_run: bool = False,
    max_messages: int | None = None,
) -> IngestStats:
    stats = IngestStats()
    limit = max_messages if max_messages is not None else config.max_messages
    context = ssl.create_default_context()

    with imaplib.IMAP4_SSL(
        config.host,
        config.port,
        ssl_context=context,
        timeout=30,
    ) as conn:
        conn.login(config.username, config.password)
        status, _ = conn.select(config.mailbox, readonly=True)
        if status != "OK":
            raise RuntimeError(f"Unable to select mailbox {config.mailbox!r} read-only")

        uid_validity = _uid_validity(conn)
        cursor = repository.get_cursor(config.mailbox)
        last_uid = cursor[1] if cursor and cursor[0] == uid_validity else 0
        start_uid = last_uid + 1

        status, search_data = conn.uid("search", None, f"UID {start_uid}:*")
        if status != "OK":
            raise RuntimeError("IMAP UID SEARCH failed")

        uid_values = [
            int(value)
            for value in (search_data[0] or b"").split()
            if value.isdigit()
        ][:limit]

        for uid in uid_values:
            stats.examined += 1
            stats.last_uid = uid
            try:
                fetch_status, fetch_data = conn.uid(
                    "fetch",
                    str(uid),
                    "(BODY.PEEK[] INTERNALDATE)",
                )
                if fetch_status != "OK":
                    raise RuntimeError(f"IMAP UID FETCH failed for UID {uid}")

                raw_message = _extract_raw_message(fetch_data)
                parsed = parse_message(
                    raw_message,
                    mailbox=config.mailbox,
                    uid_validity=uid_validity,
                    uid=uid,
                )

                candidate = is_candidate_message(
                    parsed,
                    allowed_sender_domains=config.allowed_sender_domains,
                    subject_markers=config.subject_markers,
                )
                if not candidate:
                    if not dry_run:
                        repository.set_cursor(config.mailbox, uid_validity, uid)
                    continue

                stats.candidates += 1
                if parsed.parse_status.value == "UNKNOWN_TEMPLATE":
                    stats.unknown_templates += 1
                elif parsed.parse_status.value == "PARTIAL":
                    stats.partial += 1

                if dry_run:
                    continue

                _, inserted = repository.store_mail(parsed)
                if inserted:
                    stats.stored += 1
                else:
                    stats.duplicates += 1

                evidence = evidence_from_mail(parsed)
                if evidence is not None:
                    _, evidence_inserted = repository.store_evidence(evidence)
                    if evidence_inserted:
                        stats.evidence_created += 1

                repository.set_cursor(config.mailbox, uid_validity, uid)
            except Exception:
                stats.errors += 1
                # Cursor intentionally does not advance on a failed message.
                raise

    return stats
