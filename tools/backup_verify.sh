#!/usr/bin/env bash
#
# Take a backup of the RAH production database AND PROVE IT IS RESTORABLE.
#
# WHY THE VERIFY HALF EXISTS
# The DR failure earlier this month was not a backup that errored. It was a
# backup that reported SUCCESS while silently SKIPPING, on a full disk, with
# systemd recording exit 0. Nobody looked until a restore was needed.
#
# So this script does not trust its own exit code. It restores the dump into a
# throwaway database and compares row counts table by table against production.
# A backup nobody has restored is a hypothesis, not a backup.
#
# WHAT IT DOES NOT DO
# It does not replace Supabase's managed backups. It is an INDEPENDENT copy --
# a managed backup you have never restored and cannot inspect is exactly the
# thing this exists to stop relying on.
#
# PII WARNING
# The dump contains real guest names, emails, phone numbers and booking history.
# It is written to a 0700 directory and never to the repo. Do not move it
# somewhere with looser permissions.
#
# USAGE (run on FORGE, which has the PG17 client and the network path):
#   ./backup_verify.sh                 # dump + verify, keep the dump
#
# Exit codes: 0 verified · 1 dump failed · 2 restore failed · 3 MISMATCH
set -Eeuo pipefail

PGBIN=/usr/lib/postgresql/17/bin
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
BACKUP_DIR="${RAH_BACKUP_DIR:-/var/backups/rah}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="${BACKUP_DIR}/rah-${STAMP}.dump"
PENDING_DUMP="${BACKUP_DIR}/.rah-${STAMP}.dump.partial"
DUMP_ERR="${PENDING_DUMP}.err"
RESTORE_ERR="${PENDING_DUMP}.restore.err"
SCRATCH_DB="rah_verify_${STAMP}"
SCRATCH_CREATED=0
PG_RUNTIME_DIR=""

# Tables whose counts must match exactly. Chosen because losing any of them is
# unrecoverable business data, not because they are the biggest.
CRITICAL_TABLES=(Property Booking Guest CleaningJob WorkOrder Invoice JournalEntry Expense)

log() { printf '%s  %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
die() { log "FATAL: $*"; exit "${2:-1}"; }

KEEP="${RAH_KEEP:-7}"
[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || die "RAH_KEEP must be a positive integer" 1
[[ -x "${PGBIN}/pg_dump" ]] || die "pg_dump 17 not found at ${PGBIN}. apt-get install postgresql-client-17"
[[ -x "${SCRIPT_DIR}/prepare_pg_client_env.py" ]] || die "private libpq environment helper is missing"
CREDENTIAL_FILE="${RAH_BACKUP_DB_CREDENTIAL:-${CREDENTIALS_DIRECTORY:-}/rah_db_config}"
[[ -n "$CREDENTIAL_FILE" && -r "$CREDENTIAL_FILE" ]] || die "systemd database credential is unavailable"

# LoadCredential gives the service a private, read-only credential file. The
# helper converts it into a 0600 pgpass file plus NON-SECRET libpq metadata.
# Passwords never appear in pg_dump/psql argv or their environment.
PG_RUNTIME_DIR=$(mktemp -d /tmp/rah-pg-client.XXXXXX)
chmod 700 "$PG_RUNTIME_DIR"
if ! python3 "${SCRIPT_DIR}/prepare_pg_client_env.py" "$CREDENTIAL_FILE" "$PG_RUNTIME_DIR"; then
  rmdir -- "$PG_RUNTIME_DIR" 2>/dev/null || true
  die "could not prepare private libpq credentials" 1
fi
# shellcheck disable=SC1091 -- generated file contains quoted non-secret exports
source "${PG_RUNTIME_DIR}/client.env"

prod_cmd() {
  PGHOST="$RAH_PROD_PGHOST" PGPORT="$RAH_PROD_PGPORT" \
  PGDATABASE="$RAH_PROD_PGDATABASE" PGUSER="$RAH_PROD_PGUSER" \
  PGSSLMODE="$RAH_PROD_PGSSLMODE" PGPASSFILE="$PGPASSFILE" "$@"
}

local_cmd() {
  local database=$1
  shift
  PGHOST="$RAH_LOCAL_PGHOST" PGPORT="$RAH_LOCAL_PGPORT" \
  PGDATABASE="$database" PGUSER="$RAH_LOCAL_PGUSER" \
  PGPASSFILE="$PGPASSFILE" "$@"
}

cleanup() {
  if (( SCRATCH_CREATED == 1 )); then
    local_cmd "$RAH_LOCAL_PGDATABASE" "${PGBIN}/psql" -qc \
      "DROP DATABASE IF EXISTS \"${SCRATCH_DB}\" WITH (FORCE);" \
      >/dev/null 2>&1 || true
  fi
  rm -f -- "$PENDING_DUMP" "$DUMP_ERR" "$RESTORE_ERR"
  if [[ "$PG_RUNTIME_DIR" == /tmp/rah-pg-client.* ]]; then
    rm -f -- "${PG_RUNTIME_DIR}/client.env" "${PG_RUNTIME_DIR}/pgpass"
    rmdir -- "$PG_RUNTIME_DIR" 2>/dev/null || true
  fi
}
trap cleanup EXIT

mkdir -p "$BACKUP_DIR"
# Only tighten if we own it; a non-owner run should not abort on chmod.
[[ -O "$BACKUP_DIR" ]] && chmod 700 "$BACKUP_DIR"
[[ "$(stat -c%a "$BACKUP_DIR")" == "700" ]] || log "WARNING: ${BACKUP_DIR} is not 0700 — it holds guest PII"

# ── 0. SPACE ─────────────────────────────────────────────────────────────
# The DR failure this script exists to prevent happened ON A FULL DISK: the
# backup skipped, and systemd recorded success. So refuse to start rather than
# produce a truncated dump that looks like a real one.
#
# A dump is ~19 MB today; the floor is deliberately far above that so growth
# does not quietly walk into the same wall.
MIN_FREE_MB="${RAH_MIN_FREE_MB:-2048}"
FREE_MB=$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')
USE_PCT=$(df -P "$BACKUP_DIR" | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
log "free space at ${BACKUP_DIR}: ${FREE_MB} MB (${USE_PCT}% used)"
(( FREE_MB >= MIN_FREE_MB )) || die "only ${FREE_MB} MB free, need ${MIN_FREE_MB} MB — refusing to write a backup that could be truncated" 1
(( USE_PCT < 95 )) || die "filesystem is ${USE_PCT}% full — refusing" 1

# Zero-byte dumps are failed runs. They are not backups and must never be kept.
find "$BACKUP_DIR" -maxdepth 1 -name 'rah-*.dump' -size 0 -delete 2>/dev/null || true

# ── 1. DUMP ──────────────────────────────────────────────────────────────
# --schema=public ONLY, and that is a deliberate boundary, not laziness.
#
# Supabase owns auth/realtime/storage. The application role cannot read them --
# pg_dump aborts with "permission denied for schema auth" if you try -- and it
# should not be able to. Everything this business would lose sleep over lives in
# public: properties, bookings, guests, jobs, invoices, the ledger.
#
# WHAT THIS BACKUP DOES NOT COVER: Supabase auth users and storage objects.
# Sign-in for this app is Firebase, not Supabase auth, so the gap is narrow --
# but it IS a gap, and it belongs in the runbook rather than in someone's head.
log "dumping production (schema: public) -> pending verified artifact"
if ! prod_cmd "${PGBIN}/pg_dump" --format=custom --no-owner --no-privileges \
     --schema=public \
     --file="$PENDING_DUMP" 2>"$DUMP_ERR"; then
  log "pg_dump failed:"; sed 's/^/    /' "$DUMP_ERR"
  die "dump failed" 1
fi

# A dump can "succeed" and be useless. Check it is non-trivial and parseable.
SIZE=$(stat -c%s "$PENDING_DUMP")
log "dump size: ${SIZE} bytes"
(( SIZE > 10240 )) || die "dump is implausibly small (${SIZE} bytes) — treating as failure" 1

if ! "${PGBIN}/pg_restore" --list "$PENDING_DUMP" >/dev/null 2>&1; then
  die "dump is not readable by pg_restore — it is not a backup" 1
fi

# THE CHECK THE DR FAILURE NEEDED. A skipped table is silent otherwise.
if grep -qiE '\b(skip|skipped|permission denied)\b' "$DUMP_ERR" 2>/dev/null; then
  log "stderr mentions skipping:"; sed 's/^/    /' "$DUMP_ERR"
  die "pg_dump reported SKIPPED objects — a partial backup is not a backup" 1
fi

# ── 2. RESTORE INTO A THROWAWAY DATABASE ─────────────────────────────────
log "restoring into scratch db ${SCRATCH_DB}"
# The restore target MUST be the same major version as production. FORGE's
# original cluster is PG16 and production is PG17.6, so a PG17 dump failed to
# restore with `unrecognized configuration parameter "transaction_timeout"`.
#
# That is precisely the thing worth finding now rather than during an outage: a
# backup you cannot restore onto any machine you own is not a backup. PG17 runs
# alongside PG16 on 5433; the 16 cluster is untouched.
local_cmd "$RAH_LOCAL_PGDATABASE" "${PGBIN}/psql" -qc "CREATE DATABASE \"${SCRATCH_DB}\";" \
  || die "could not create scratch database" 2
SCRATCH_CREATED=1

# A --schema=public dump carries its own `CREATE SCHEMA public`, which collides
# with the one every fresh database already has. Drop it so the restore recreates
# the schema exactly as production has it, rather than restoring INTO a
# pre-existing schema and quietly inheriting whatever was already there.
local_cmd "$SCRATCH_DB" "${PGBIN}/psql" -qc "DROP SCHEMA IF EXISTS public CASCADE;" \
  || die "could not clear the scratch schema" 2

# --exit-on-error so a partial restore cannot masquerade as a good one.
if ! local_cmd "$SCRATCH_DB" "${PGBIN}/pg_restore" --no-owner --no-privileges --exit-on-error \
     --dbname="$SCRATCH_DB" "$PENDING_DUMP" >/dev/null 2>"$RESTORE_ERR"; then
  log "pg_restore failed:"; sed 's/^/    /' "$RESTORE_ERR" | head -20
  die "restore failed — the dump is NOT restorable" 2
fi

# ── 3. COMPARE ROW COUNTS, LIVE vs RESTORED ──────────────────────────────
log "comparing row counts"
FAILED=0
for t in "${CRITICAL_TABLES[@]}"; do
  live=$(prod_cmd "${PGBIN}/psql" -tAc "SELECT count(*) FROM public.\"${t}\";" 2>/dev/null || echo ERR)
  rest=$(local_cmd "$SCRATCH_DB" "${PGBIN}/psql" -tAc "SELECT count(*) FROM public.\"${t}\";" 2>/dev/null || echo ERR)
  if [[ "$live" == "ERR" || "$rest" == "ERR" ]]; then
    printf '  %-14s live=%-8s restored=%-8s  UNREADABLE\n' "$t" "$live" "$rest"; FAILED=1; continue
  fi
  if [[ "$live" == "$rest" ]]; then
    printf '  %-14s %s rows  OK\n' "$t" "$live"
  else
    printf '  %-14s live=%-8s restored=%-8s  MISMATCH\n' "$t" "$live" "$rest"; FAILED=1
  fi
done

(( FAILED == 0 )) || die "row counts differ between production and the restored copy" 3

# The public filename is the verification marker. Failed dumps retain only a
# hidden .partial name and cleanup removes them; freshness can never mistake a
# failed restore or mismatch for a verified recovery point.
mv -f -- "$PENDING_DUMP" "$DUMP"
chmod 600 "$DUMP"

# Retention runs only after the new artifact is proven and published. A failed
# run never deletes a prior recovery point, and a successful run leaves exactly
# the configured number of verified dumps rather than KEEP+1 until tomorrow.
mapfile -t OLD < <(ls -1t "${BACKUP_DIR}"/rah-*.dump 2>/dev/null | tail -n +$((KEEP + 1)))
if (( ${#OLD[@]} > 0 )); then
  log "pruning $(( ${#OLD[@]} )) dump(s) beyond the newest ${KEEP}"
  rm -f "${OLD[@]}"
fi
log "VERIFIED: ${DUMP} restores cleanly and matches production row for row"
log "reminder: this dump contains guest PII. ${BACKUP_DIR} is 0700. Keep it that way."
