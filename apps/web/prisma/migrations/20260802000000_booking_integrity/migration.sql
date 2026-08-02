-- Booking integrity hardening for the VRBO mirror.
--
-- This migration is deliberately snapshot-first and idempotent.  It preserves
-- duplicate rows as CANCELLED records after transferring references instead of
-- deleting customer history, then adds the database-level overlap guarantee.

BEGIN;

-- Recovery anchor required before any data repair.
CREATE TABLE IF NOT EXISTS "Booking_backup_20260801" AS TABLE "Booking";

-- Explicit owner/maintenance holds must occupy dates without masquerading as
-- guest reservations.  Unknown long stays are left untouched for review.
UPDATE "Booking"
SET "status" = 'BLOCKED', "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" <> 'CANCELLED'
  AND LOWER(CONCAT_WS(' ', "specialReqs", "internalNotes")) ~
      '(blocked|not available|unavailable|owner stay|maintenance|do not book|owner hold)';

-- The legacy importer stored the channel UID in confirmCode.  Backfill only
-- one row per (platform, confirmCode); ambiguous candidates remain NULL rather
-- than inventing an identity or violating the existing unique index.
CREATE TEMP TABLE "_booking_ref_candidates" ON COMMIT DROP AS
SELECT "id", "platform", "confirmCode",
       ROW_NUMBER() OVER (
         PARTITION BY "platform", "confirmCode"
         ORDER BY "createdAt", "id"
       ) AS "candidateRank"
FROM "Booking"
WHERE "externalRef" IS NULL
  AND NULLIF(BTRIM("confirmCode"), '') IS NOT NULL;

UPDATE "Booking" AS b
SET "externalRef" = NULLIF(BTRIM(c."confirmCode"), ''),
    "updatedAt" = CURRENT_TIMESTAMP
FROM "_booking_ref_candidates" AS c
WHERE b."id" = c."id"
  AND c."candidateRank" = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "Booking" AS occupied
    WHERE occupied."id" <> b."id"
      AND occupied."platform" = b."platform"
      AND occupied."externalRef" = NULLIF(BTRIM(c."confirmCode"), '')
  );

-- Collapse exact duplicate reservations without destroying their audit trail.
-- Foreign keys that are not one-to-one are moved to the keeper where possible;
-- the later duplicate is retained as CANCELLED with its channel ref cleared.
CREATE TEMP TABLE "_booking_dedupe" ON COMMIT DROP AS
WITH ranked AS (
  SELECT "id",
         FIRST_VALUE("id") OVER w AS "keeperId",
         ROW_NUMBER() OVER w AS "rowNumber"
  FROM "Booking"
  WHERE "status" <> 'CANCELLED'
  WINDOW w AS (
    PARTITION BY "propertyId", "platform", "checkIn", "checkOut"
    ORDER BY "createdAt", "id"
  )
)
SELECT "id" AS "duplicateId", "keeperId"
FROM ranked
WHERE "rowNumber" > 1;

UPDATE "WorkOrder" AS child
SET "bookingId" = d."keeperId", "updatedAt" = CURRENT_TIMESTAMP
FROM "_booking_dedupe" AS d
WHERE child."bookingId" = d."duplicateId"
  AND NOT EXISTS (
    SELECT 1 FROM "WorkOrder" AS existing
    WHERE existing."bookingId" = d."keeperId"
  );

UPDATE "AccessGrant" AS child
SET "bookingId" = d."keeperId", "updatedAt" = CURRENT_TIMESTAMP
FROM "_booking_dedupe" AS d
WHERE child."bookingId" = d."duplicateId";

UPDATE "GuestRequest" AS child
SET "bookingId" = d."keeperId", "updatedAt" = CURRENT_TIMESTAMP
FROM "_booking_dedupe" AS d
WHERE child."bookingId" = d."duplicateId";

UPDATE "OperationalAlert" AS child
SET "bookingId" = d."keeperId", "updatedAt" = CURRENT_TIMESTAMP
FROM "_booking_dedupe" AS d
WHERE child."bookingId" = d."duplicateId";

UPDATE "Invoice" AS child
SET "bookingId" = d."keeperId", "updatedAt" = CURRENT_TIMESTAMP
FROM "_booking_dedupe" AS d
WHERE child."bookingId" = d."duplicateId";

UPDATE "Note" AS child
SET "bookingId" = d."keeperId", "updatedAt" = CURRENT_TIMESTAMP
FROM "_booking_dedupe" AS d
WHERE child."bookingId" = d."duplicateId";

UPDATE "Review" AS child
SET "bookingId" = d."keeperId", "updatedAt" = CURRENT_TIMESTAMP
FROM "_booking_dedupe" AS d
WHERE child."bookingId" = d."duplicateId";

-- CleaningJob.bookingId is one-to-one.  Keep both jobs if the keeper already
-- owns one; the duplicate booking remains a cancelled historical row.
UPDATE "CleaningJob" AS child
SET "bookingId" = d."keeperId", "updatedAt" = CURRENT_TIMESTAMP
FROM "_booking_dedupe" AS d
WHERE child."bookingId" = d."duplicateId"
  AND NOT EXISTS (
    SELECT 1 FROM "CleaningJob" AS existing
    WHERE existing."bookingId" = d."keeperId"
  );

UPDATE "Booking" AS duplicate
SET "status" = 'CANCELLED',
    "externalRef" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "_booking_dedupe" AS d
WHERE duplicate."id" = d."duplicateId";

-- The prior migration created the nullable idempotency index.  Keep it and add
-- the non-null production guarantee only after the data repair above.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_no_overlap'
  ) THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "booking_no_overlap"
      EXCLUDE USING gist (
        "propertyId" WITH =,
        tsrange("checkIn", "checkOut", '[)') WITH &&
      )
      WHERE ("status" <> 'CANCELLED');
  END IF;
END $$;

COMMIT;
