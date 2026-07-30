from __future__ import annotations

import os
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

import psycopg2
from psycopg2.extensions import connection
from psycopg2.extras import Json, RealDictCursor

from .models import ParsedMail, ReconciliationResult, ReservationEvidence


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


class MailBridgeRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url or os.environ.get("DATABASE_URL", "")
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is required")

    @contextmanager
    def connect(self) -> Iterator[connection]:
        conn = psycopg2.connect(self.database_url, connect_timeout=15)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def get_cursor(self, mailbox: str) -> tuple[int, int] | None:
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(
                'SELECT "uidValidity", "lastUid" FROM "VrboMailCursor" WHERE "mailbox" = %s',
                (mailbox,),
            )
            row = cur.fetchone()
            return (int(row[0]), int(row[1])) if row else None

    def set_cursor(self, mailbox: str, uid_validity: int, last_uid: int) -> None:
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO "VrboMailCursor"
                    ("mailbox", "uidValidity", "lastUid", "updatedAt")
                VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT ("mailbox") DO UPDATE SET
                    "uidValidity" = EXCLUDED."uidValidity",
                    "lastUid" = CASE
                        WHEN "VrboMailCursor"."uidValidity" = EXCLUDED."uidValidity"
                        THEN GREATEST("VrboMailCursor"."lastUid", EXCLUDED."lastUid")
                        ELSE EXCLUDED."lastUid"
                    END,
                    "updatedAt" = CURRENT_TIMESTAMP
                ''',
                (mailbox, uid_validity, last_uid),
            )

    def store_mail(self, mail: ParsedMail) -> tuple[str, bool]:
        mail_id = _id("vmm")
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO "VrboMailMessage" (
                    "id", "mailbox", "uidValidity", "uid", "internetMessageId",
                    "fromAddress", "subject", "receivedAt", "rawSha256",
                    "bodyText", "headersJson", "parserVersion", "eventType",
                    "parseStatus", "parsedJson", "parseError", "ingestedAt"
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, CURRENT_TIMESTAMP
                )
                ON CONFLICT ("mailbox", "uidValidity", "uid") DO UPDATE SET
                    "internetMessageId" = EXCLUDED."internetMessageId",
                    "fromAddress" = EXCLUDED."fromAddress",
                    "subject" = EXCLUDED."subject",
                    "receivedAt" = EXCLUDED."receivedAt",
                    "rawSha256" = EXCLUDED."rawSha256",
                    "bodyText" = EXCLUDED."bodyText",
                    "headersJson" = EXCLUDED."headersJson",
                    "parserVersion" = EXCLUDED."parserVersion",
                    "eventType" = EXCLUDED."eventType",
                    "parseStatus" = EXCLUDED."parseStatus",
                    "parsedJson" = EXCLUDED."parsedJson",
                    "parseError" = EXCLUDED."parseError"
                RETURNING "id", (xmax = 0) AS inserted
                ''',
                (
                    mail_id,
                    mail.mailbox,
                    mail.uid_validity,
                    mail.uid,
                    mail.internet_message_id,
                    mail.from_address,
                    mail.subject,
                    mail.received_at,
                    mail.raw_sha256,
                    mail.body_text,
                    Json(dict(mail.headers)),
                    mail.parser_version,
                    mail.event_type.value,
                    mail.parse_status.value,
                    Json(dict(mail.parsed)),
                    mail.parse_error,
                ),
            )
            row = cur.fetchone()
            return str(row[0]), bool(row[1])

    def store_evidence(self, evidence: ReservationEvidence) -> tuple[str, bool]:
        evidence_id = _id("vre")
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO "VrboReservationEvidence" (
                    "id", "sourceType", "sourceKey", "reservationKey",
                    "propertyId", "vrboListingId", "reservationId",
                    "confirmationCode", "eventType", "status", "checkIn",
                    "checkOut", "guestName", "guestEmail", "guestPhone",
                    "guestCount", "totalAmountCents", "currency", "observedAt",
                    "parserVersion", "payloadSha256", "payloadJson",
                    "validationStatus", "validationErrors", "createdAt"
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, CURRENT_TIMESTAMP
                )
                ON CONFLICT ("sourceType", "sourceKey", "payloadSha256")
                DO NOTHING
                RETURNING "id"
                ''',
                (
                    evidence_id,
                    evidence.source_type,
                    evidence.source_key,
                    evidence.reservation_key,
                    evidence.property_id,
                    evidence.vrbo_listing_id,
                    evidence.reservation_id,
                    evidence.confirmation_code,
                    evidence.event_type,
                    evidence.status,
                    evidence.check_in,
                    evidence.check_out,
                    evidence.guest_name,
                    evidence.guest_email,
                    evidence.guest_phone,
                    evidence.guest_count,
                    evidence.total_amount_cents,
                    evidence.currency,
                    evidence.observed_at,
                    evidence.parser_version,
                    evidence.payload_sha256,
                    Json(dict(evidence.payload)),
                    evidence.validation_status,
                    Json(list(evidence.validation_errors)),
                ),
            )
            row = cur.fetchone()
            return (str(row[0]), True) if row else ("", False)

    def load_evidence(
        self,
        *,
        reservation_key: str | None = None,
        since: datetime | None = None,
    ) -> list[ReservationEvidence]:
        clauses: list[str] = []
        params: list[Any] = []
        if reservation_key:
            clauses.append('"reservationKey" = %s')
            params.append(reservation_key)
        if since:
            clauses.append('"createdAt" >= %s')
            params.append(since)
        where = " WHERE " + " AND ".join(clauses) if clauses else ""

        with self.connect() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f'SELECT * FROM "VrboReservationEvidence"{where} ORDER BY "reservationKey", "observedAt", "createdAt"',
                tuple(params),
            )
            rows = cur.fetchall()

        return [
            ReservationEvidence(
                source_type=row["sourceType"],
                source_key=row["sourceKey"],
                reservation_key=row["reservationKey"],
                observed_at=row["observedAt"],
                payload_sha256=row["payloadSha256"],
                payload=row["payloadJson"] or {},
                parser_version=row["parserVersion"],
                event_type=row["eventType"],
                property_id=row["propertyId"],
                vrbo_listing_id=row["vrboListingId"],
                reservation_id=row["reservationId"],
                confirmation_code=row["confirmationCode"],
                status=row["status"],
                check_in=row["checkIn"],
                check_out=row["checkOut"],
                guest_name=row["guestName"],
                guest_email=row["guestEmail"],
                guest_phone=row["guestPhone"],
                guest_count=row["guestCount"],
                total_amount_cents=row["totalAmountCents"],
                currency=row["currency"],
                validation_status=row["validationStatus"],
                validation_errors=tuple(row["validationErrors"] or ()),
            )
            for row in rows
        ]

    def upsert_ledger(self, result: ReconciliationResult) -> None:
        canonical = dict(result.canonical)
        now = datetime.now(timezone.utc)
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO "VrboReservationLedger" (
                    "reservationKey", "propertyId", "vrboListingId",
                    "reservationId", "confirmationCode", "status", "checkIn",
                    "checkOut", "guestName", "guestEmail", "guestPhone",
                    "guestCount", "totalAmountCents", "currency",
                    "consensusStatus", "sourceCount", "evidenceCount",
                    "sourceFingerprint", "canonicalJson", "disagreementJson",
                    "validationErrors", "firstSeenAt", "lastSeenAt",
                    "lastReconciledAt", "updatedAt"
                ) VALUES (
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s
                )
                ON CONFLICT ("reservationKey") DO UPDATE SET
                    "propertyId" = EXCLUDED."propertyId",
                    "vrboListingId" = EXCLUDED."vrboListingId",
                    "reservationId" = EXCLUDED."reservationId",
                    "confirmationCode" = EXCLUDED."confirmationCode",
                    "status" = EXCLUDED."status",
                    "checkIn" = EXCLUDED."checkIn",
                    "checkOut" = EXCLUDED."checkOut",
                    "guestName" = EXCLUDED."guestName",
                    "guestEmail" = EXCLUDED."guestEmail",
                    "guestPhone" = EXCLUDED."guestPhone",
                    "guestCount" = EXCLUDED."guestCount",
                    "totalAmountCents" = EXCLUDED."totalAmountCents",
                    "currency" = EXCLUDED."currency",
                    "consensusStatus" = EXCLUDED."consensusStatus",
                    "sourceCount" = EXCLUDED."sourceCount",
                    "evidenceCount" = EXCLUDED."evidenceCount",
                    "sourceFingerprint" = EXCLUDED."sourceFingerprint",
                    "canonicalJson" = EXCLUDED."canonicalJson",
                    "disagreementJson" = EXCLUDED."disagreementJson",
                    "validationErrors" = EXCLUDED."validationErrors",
                    "lastSeenAt" = EXCLUDED."lastSeenAt",
                    "lastReconciledAt" = EXCLUDED."lastReconciledAt",
                    "updatedAt" = EXCLUDED."updatedAt"
                ''',
                (
                    result.reservation_key,
                    canonical.get("property_id"),
                    canonical.get("vrbo_listing_id"),
                    canonical.get("reservation_id"),
                    canonical.get("confirmation_code"),
                    canonical.get("status"),
                    canonical.get("check_in"),
                    canonical.get("check_out"),
                    canonical.get("guest_name"),
                    canonical.get("guest_email"),
                    canonical.get("guest_phone"),
                    canonical.get("guest_count"),
                    canonical.get("total_amount_cents"),
                    canonical.get("currency") or "USD",
                    result.consensus_status.value,
                    result.source_count,
                    result.evidence_count,
                    result.source_fingerprint,
                    Json(canonical),
                    Json(dict(result.disagreements)),
                    Json(list(result.validation_errors)),
                    now,
                    canonical.get("observed_at") or now,
                    now,
                    now,
                ),
            )

    def record_run(
        self,
        *,
        status: str,
        started_at: datetime,
        completed_at: datetime,
        evidence_count: int,
        reservation_count: int,
        consistent_count: int,
        unverified_count: int,
        sync_at_risk_count: int,
        error_count: int,
        details: dict[str, Any],
    ) -> str:
        run_id = _id("vrr")
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO "VrboReconciliationRun" (
                    "id", "startedAt", "completedAt", "mode", "status",
                    "evidenceCount", "reservationCount", "consistentCount",
                    "unverifiedCount", "syncAtRiskCount", "errorCount",
                    "detailsJson", "createdAt"
                ) VALUES (
                    %s, %s, %s, 'SHADOW', %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, CURRENT_TIMESTAMP
                )
                ''',
                (
                    run_id,
                    started_at,
                    completed_at,
                    status,
                    evidence_count,
                    reservation_count,
                    consistent_count,
                    unverified_count,
                    sync_at_risk_count,
                    error_count,
                    Json(details),
                ),
            )
        return run_id

    def status_summary(self) -> dict[str, Any]:
        with self.connect() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                '''
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE "consensusStatus" = 'CONSISTENT')::int AS consistent,
                    COUNT(*) FILTER (WHERE "consensusStatus" = 'UNVERIFIED')::int AS unverified,
                    COUNT(*) FILTER (WHERE "consensusStatus" = 'SYNC_AT_RISK')::int AS sync_at_risk,
                    MAX("lastReconciledAt") AS last_reconciled_at
                FROM "VrboReservationLedger"
                '''
            )
            ledger = dict(cur.fetchone() or {})
            cur.execute(
                '''
                SELECT
                    COUNT(*)::int AS messages,
                    COUNT(*) FILTER (WHERE "parseStatus" = 'PARSED')::int AS parsed,
                    COUNT(*) FILTER (WHERE "parseStatus" = 'PARTIAL')::int AS partial,
                    COUNT(*) FILTER (WHERE "parseStatus" = 'UNKNOWN_TEMPLATE')::int AS unknown_templates,
                    MAX("ingestedAt") AS last_ingested_at
                FROM "VrboMailMessage"
                '''
            )
            mail = dict(cur.fetchone() or {})
        return {"mode": "SHADOW", "mail": mail, "ledger": ledger}
