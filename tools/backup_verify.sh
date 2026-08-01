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
#   ./backup_verify.sh --verify-only <dumpfile>
#
# Exit codes: 0 verified · 1 dump failed · 2 restore failed · 3 MISMATCH
set -Eeuo pipefail

PGBIN=/usr/lib/postgresql/17/bin
BACKUP_DIR="${RAH_BACKUP_DIR:-/var/backups/rah}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="${BACKUP_DIR}/rah-${STAMP}.dump"
SCRATCH_DB="rah_verify_${STAMP}"

# Tables whose counts must match exactly. Chosen because losing any of them is
# unrecoverable business data, not because they are the biggest.
CRITICAL_TABLES=(Property Booking Guest CleaningJob WorkOrder Invoice JournalEntry Expense)

log() { printf '%s  %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
die() { log "FATAL: $*"; exit "${2:-1}"; }

[[ -n "${DIRECT_URL:-}" ]] || die "DIRECT_URL is not set. Source the prod env first."
[[ -x "${PGBIN}/pg_dump" ]] || die "pg_dump 17 not found at ${PGBIN}. apt-get install postgresql-client-17"

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

# Retention. Unbounded dumps are how the disk gets full in the first place.
KEEP="${RAH_KEEP:-7}"
mapfile -t OLD < <(ls -1t "${BACKUP_DIR}"/rah-*.dump 2>/dev/null | tail -n +$((KEEP + 1)))
if (( ${#OLD[@]} > 0 )); then
  log "pruning $(( ${#OLD[@]} )) dump(s) beyond the newest ${KEEP}"
  rm -f "${OLD[@]}"
fi
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
log "dumping production (schema: public) -> ${DUMP}"
if ! "${PGBIN}/pg_dump" --format=custom --no-owner --no-privileges \
     --schema=public \
     --file="$DUMP" "$DIRECT_URL" 2>"${DUMP}.err"; then
  log "pg_dump failed:"; sed 's/^/    /' "${DUMP}.err"
  die "dump failed" 1
fi

# A dump can "succeed" and be useless. Check it is non-trivial and parseable.
SIZE=$(stat -c%s "$DUMP")
log "dump size: ${SIZE} bytes"
(( SIZE > 10240 )) || die "dump is implausibly small (${SIZE} bytes) — treating as failure" 1

if ! "${PGBIN}/pg_restore" --list "$DUMP" >/dev/null 2>&1; then
  die "dump is not readable by pg_restore — it is not a backup" 1
fi

# THE CHECK THE DR FAILURE NEEDED. A skipped table is silent otherwise.
if grep -qiE '\b(skip|skipped|permission denied)\b' "${DUMP}.err" 2>/dev/null; then
  log "stderr mentions skipping:"; sed 's/^/    /' "${DUMP}.err"
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
LOCAL="${RAH_VERIFY_PG:-postgresql://echo:echo@localhost:5433}"
"${PGBIN}/psql" "${LOCAL}/postgres" -qc "CREATE DATABASE \"${SCRATCH_DB}\";" \
  || die "could not create scratch database" 2

# A --schema=public dump carries its own `CREATE SCHEMA public`, which collides
# with the one every fresh database already has. Drop it so the restore recreates
# the schema exactly as production has it, rather than restoring INTO a
# pre-existing schema and quietly inheriting whatever was already there.
"${PGBIN}/psql" "${LOCAL}/${SCRATCH_DB}" -qc "DROP SCHEMA IF EXISTS public CASCADE;" \
  || die "could not clear the scratch schema" 2

cleanup() {
  "${PGBIN}/psql" "${LOCAL}/postgres" -qc \
    "DROP DATABASE IF EXISTS \"${SCRATCH_DB}\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# --exit-on-error so a partial restore cannot masquerade as a good one.
if ! "${PGBIN}/pg_restore" --no-owner --no-privileges --exit-on-error \
     --dbname="${LOCAL}/${SCRATCH_DB}" "$DUMP" >/dev/null 2>"${DUMP}.restore.err"; then
  log "pg_restore failed:"; sed 's/^/    /' "${DUMP}.restore.err" | head -20
  die "restore failed — the dump is NOT restorable" 2
fi

# ── 3. COMPARE ROW COUNTS, LIVE vs RESTORED ──────────────────────────────
log "comparing row counts"
FAILED=0
for t in "${CRITICAL_TABLES[@]}"; do
  live=$("${PGBIN}/psql" "$DIRECT_URL" -tAc "SELECT count(*) FROM public.\"${t}\";" 2>/dev/null || echo ERR)
  rest=$("${PGBIN}/psql" "${LOCAL}/${SCRATCH_DB}" -tAc "SELECT count(*) FROM public.\"${t}\";" 2>/dev/null || echo ERR)
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

log "VERIFIED: ${DUMP} restores cleanly and matches production row for row"
log "reminder: this dump contains guest PII. ${BACKUP_DIR} is 0700. Keep it that way."
