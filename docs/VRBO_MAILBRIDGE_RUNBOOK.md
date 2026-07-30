# Vrbo MailBridge Phase 1 — Shadow Mode Runbook

## Purpose

MailBridge reads Vrbo notification email through IMAP without changing mailbox
state, parses reservation evidence, and reconciles it against other imported
sources. Phase 1 is observation-only.

It does **not**:

- mark email read;
- delete, move, or reply to email;
- create, update, or cancel live `Booking` rows;
- mutate Vrbo, RAH, Google, or other calendars;
- send guest messages;
- change rates or availability;
- issue or revoke smart-lock access;
- post financial transactions.

Unknown templates and source disagreements fail closed.

## Required environment

```text
DATABASE_URL=postgresql://...
VRBO_MAIL_SHADOW_MODE=true
VRBO_MAIL_IMAP_HOST=imap.mail.att.net
VRBO_MAIL_IMAP_PORT=993
VRBO_MAIL_USERNAME=<mailbox address>
VRBO_MAIL_PASSWORD_FILE=<path materialized from Echo Vault>
VRBO_MAIL_MAILBOX=INBOX
VRBO_MAIL_ALLOWED_SENDER_DOMAINS=vrbo.com,homeaway.com,expediagroup.com
VRBO_MAIL_SUBJECT_MARKERS=vrbo,reservation,booking,inquiry,traveler
VRBO_MAIL_MAX_MESSAGES=250
```

Use `VRBO_MAIL_PASSWORD` only for ephemeral process injection. Do not place a
password in a repository file, task definition, command history, or log.

## Deploy schema

From `apps/web`:

```powershell
pnpm prisma validate
pnpm prisma generate
pnpm prisma migrate deploy
```

Migration:

```text
prisma/migrations/20260717120000_vrbo_mailbridge_shadow/migration.sql
```

## Validate parser and reconciler

From the repository root:

```powershell
$env:PYTHONPATH = "$PWD\backend\services"
python -m pytest backend/tests/test_vrbo_mail_parser.py backend/tests/test_vrbo_reconcile.py -q
```

## Dry run

Dry run reads and parses but writes no database rows and does not advance the
mailbox UID cursor:

```powershell
.\scripts\run-vrbo-mailbridge.ps1 -DryRun -MaxMessages 25
```

## Shadow ingestion and reconciliation

```powershell
.\scripts\run-vrbo-mailbridge.ps1 -MaxMessages 250
```

Exit codes:

- `0`: run completed with no reconciled risk;
- `2`: reconciliation failed;
- `3`: one or more reservations are `SYNC_AT_RISK`.

`SYNC_AT_RISK` is an operational stop signal. It must not trigger automatic
calendar, booking, messaging, finance, or access changes.

## Import evidence from calendar/API adapters

MailBridge accepts JSON Lines from Vrbo iCal, RAH iCal, or a future Vrbo API
adapter:

```json
{"source_type":"VRBO_ICAL","source_key":"listing-1:event-7","parser_version":"vrbo-ical-v1","reservation_id":"HA-123","vrbo_listing_id":"445566","status":"CONFIRMED","check_in":"2026-08-02T21:00:00Z","check_out":"2026-08-05T15:00:00Z"}
```

```powershell
$env:PYTHONPATH = "$PWD\backend\services"
python -m vrbo_mailbridge.run_once --import-evidence .\evidence.jsonl
```

## Status

CLI:

```powershell
.\scripts\run-vrbo-mailbridge.ps1 -Status
```

Authenticated admin API:

```text
GET /api/admin/vrbo-mailbridge/status
```

## Promotion gate

MailBridge remains in shadow mode until all conditions hold:

1. At least 30 consecutive days of ingestion without mailbox mutation.
2. Known-template parse precision is manually sampled at 99% or better.
3. Unknown templates always remain non-actionable.
4. Every live reservation has at least two agreeing evidence sources.
5. Cancellation and date-change disagreements reliably enter `SYNC_AT_RISK`.
6. Database restore and evidence replay are tested.
7. Credential rotation and repository secret remediation are complete.
8. Security hotfixes for `/dev-login` and owner-only routes are deployed.

## Automatic Vrbo iCal evidence

Each normal or dry run reads enabled `VrboSync.icalUrl` records and imports
current `VEVENT` data as `VRBO_ICAL` evidence. Only HTTPS feeds on configured
Vrbo/HomeAway domains are accepted. Redirect destinations are revalidated,
responses are size-limited, and feed URLs are never included in worker errors.

Use `--skip-ical` for an email-only diagnostic run or `--ical-only` to fetch
calendar evidence without connecting to IMAP.
