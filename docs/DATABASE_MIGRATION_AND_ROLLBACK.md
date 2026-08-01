# Database migration & rollback runbook

Production is **Supabase Postgres 17.6** (`aws-1-us-east-1.pooler.supabase.com`).
It holds a real business: 22 properties, 762 bookings, 494 guests, 209 cleaning
jobs. There is no staging database — see the "Known gaps" section, because that
fact shapes everything below.

Every trap in this document was hit for real on this project. None of it is
theoretical.

---

## 1. Migrations are ADDITIVE ONLY

Nullable columns, new tables, new indexes. No drops, no renames, no type
narrowing, no `NOT NULL` on an existing populated column.

The reason is specific to this deployment: **preview deployments write to the
production database** (#26853). A destructive migration is therefore not just
risky at deploy time — a preview build can hit the same schema.

If a column genuinely must go, that is a two-release dance: stop writing it,
ship, confirm nothing reads it, then drop it in a later migration. Not one PR.

---

## 2. Write the SQL by hand. Do not diff against git HEAD.

**The trap:** `prisma migrate diff --from-schema-datamodel` compares against the
schema file *as committed*. If an earlier migration is already applied but not
yet committed, the diff re-lists columns that already exist. `prisma migrate
deploy` then prints:

```
All migrations have been successfully applied.
```

…and applies **nothing**. No error. No warning. The success message is the
failure mode.

This happened on `paidDate` and cost real time to find. Write the SQL yourself:

```sql
-- Additive only: nullable column, no default, no data rewrite.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paypalOrderRef" TEXT;
```

`IF NOT EXISTS` everywhere, so re-running is safe.

---

## 3. `unset DATABASE_URL DIRECT_URL` before running anything

An exported placeholder silently **wins over `.env`**. A migration aimed at
production went to `localhost` because `DATABASE_URL` was exported earlier in the
shell. It failed loudly only by luck; it could as easily have succeeded against
the wrong database.

```bash
unset DATABASE_URL DIRECT_URL
source /path/to/rah.dbenv     # the real values, kept OUT of the repo
```

Note also that `vercel env pull` writes values containing a **literal** `\n`
inside the quotes. Decode with `unicode_escape` before use, or a credential will
be silently wrong by one character. That has caused a false "outage" on this
project.

---

## 4. VERIFY with `information_schema`. Never trust `migrate deploy` output.

This is the single most important habit in this document. `migrate deploy`
reporting success is **not** evidence the column exists.

```sql
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'Booking' AND column_name = 'paypalOrderRef';

-- constraints and indexes are separate questions
SELECT conname FROM pg_constraint WHERE conrelid = '"Review"'::regclass;
SELECT indexname FROM pg_indexes  WHERE tablename = 'WorkerProfile';
```

Also record the row count before and after. A migration that "succeeded" while
changing row counts is a migration that did something you did not intend.

---

## 5. Rollback

### 5a. Additive migration — usually nothing to roll back

An unused nullable column is inert. Deploy the previous application build; the
column sits there harmlessly. Prefer this. **Do not drop a column to "clean up"
during an incident** — that is a destructive change made under time pressure,
which is the worst possible moment for one.

### 5b. Data damage — restore from a verified dump

Backups live on FORGE at `/var/backups/rah/` (0700, contains guest PII), produced
by `tools/backup_verify.sh`, which dumps **and proves the dump restores**.

```bash
# on FORGE
ls -lt /var/backups/rah/*.dump | head        # newest first
```

**The restore target must be PostgreSQL 17.** FORGE's original cluster is PG16
and *cannot* restore a PG17 dump — it fails with `unrecognized configuration
parameter "transaction_timeout"`. PG17 runs alongside it on **port 5433**.

```bash
PGBIN=/usr/lib/postgresql/17/bin
DUMP=/var/backups/rah/rah-YYYYMMDDTHHMMSSZ.dump

# 1. ALWAYS restore to a scratch database first and look at it.
$PGBIN/psql postgresql://echo:echo@localhost:5433/postgres \
  -c 'CREATE DATABASE rah_restore_check;'
$PGBIN/psql postgresql://echo:echo@localhost:5433/rah_restore_check \
  -c 'DROP SCHEMA IF EXISTS public CASCADE;'   # the dump carries its own
$PGBIN/pg_restore --no-owner --no-privileges --exit-on-error \
  --dbname=postgresql://echo:echo@localhost:5433/rah_restore_check "$DUMP"

# 2. Confirm it holds what you expect BEFORE touching production.
$PGBIN/psql postgresql://echo:echo@localhost:5433/rah_restore_check \
  -c 'SELECT count(*) FROM public."Booking";'
```

Only then consider production. Restoring **into** production is not a routine
operation and is not scripted here on purpose:

- take a fresh dump of the damaged state first — you may need it
- prefer restoring individual tables over the whole schema
- Supabase's own PITR is often the better instrument for a whole-database
  rollback; this dump is the independent copy for when it is not
- have someone else read the command before it runs

### 5c. What the backup does NOT cover

`--schema=public` only. **Supabase `auth`, `realtime` and `storage` are not
included** — the application role cannot read them, and an unscoped dump aborts.

Sign-in is Firebase, not Supabase auth, so the gap is narrow. It is still a gap,
and it is written here rather than living in someone's head.

---

## 6. Deploy order

1. `npx prisma migrate deploy` (schema first — the old app must tolerate the new
   schema, which additive-only guarantees)
2. Verify via `information_schema`
3. `npx prisma generate`
4. `tsc --noEmit`, `vitest run` — **read the exit code, not the output**; a
   piped `| tail` will happily show green ticks over a segfault
5. `python tools/rbac_coverage_audit.py --strict` and
   `python tools/idor_audit.py --strict`
6. Deploy the application
7. Probe live with a **non-zero positive control**. `/api/cleaning` returns 100
   jobs and `/api/smart-home/locks` returns 3 — on an empty result, "working"
   and "broken" look identical.

---

## 7. Seeding

`prisma/seed.ts` uses `property.create`, not upsert. Running it against a
populated database **duplicates the portfolio**. `prisma/seed-guard.ts` refuses
unless the target is empty *and* an explicit opt-in phrase is set:

```bash
ALLOW_SEED=yes-seed-this-database npx ts-node prisma/seed.ts
```

The guard keys on *the database already containing data*, not on a hostname
allowlist — a hostname check fails open the day production moves.

`seed-chart-of-accounts.ts` is deliberately **not** guarded: it upserts reference
data that should exist in production.

---

## Known gaps

- **No staging database.** Preview deployments write to production (#26853).
  Until that is fixed, every migration is a production migration.
- **Backups are not scheduled** (#26968). The script is proven; the timer is
  deliberately not added until failure alerting exists — including alerting on
  *silence*, since a job that stops running never reports a failure.
- **`/var` on FORGE is 86% full.** The original DR incident was a backup that
  skipped on a full disk while reporting success. The script now refuses below
  2 GB free, but the underlying pressure is unaddressed.

## What in this document is PROVEN vs merely written down

**Proven, executed against production:** the dump, the restore into a scratch
database, and a row-for-row count match (Property 22, Booking 762, Guest 494,
CleaningJob 209). The seed guard, tested in isolation against production.

**Not proven:** restoring *into* production. Nobody should rehearse that
casually, and claiming it works because the scratch restore worked would be the
same error as trusting an untested backup.
