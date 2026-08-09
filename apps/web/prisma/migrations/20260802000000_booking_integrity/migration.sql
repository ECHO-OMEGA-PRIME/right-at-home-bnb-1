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

-- Retire legacy VRBO rows that have no channel identity when the current iCal
-- mirror has an identified row occupying the same property and dates.  The
-- row stays in place for audit/history, but it can no longer create a false
-- double booking.  We deliberately do NOT infer externalRef from confirmCode:
-- those fields have different semantics and an invented identity is worse
-- than an explicit historical record.
CREATE TEMP TABLE "_legacy_superseded" ON COMMIT DROP AS
SELECT DISTINCT ON (legacy."id")
       legacy."id" AS "legacyId",
       current."id" AS "currentId"
FROM "Booking" AS legacy
JOIN "Booking" AS current
  ON current."id" <> legacy."id"
 AND current."propertyId" = legacy."propertyId"
 AND UPPER(current."platform") = UPPER(legacy."platform")
 AND current."status" <> 'CANCELLED'
 AND current."externalRef" IS NOT NULL
 AND tsrange(current."checkIn", current."checkOut", '[)') &&
     tsrange(legacy."checkIn", legacy."checkOut", '[)')
WHERE legacy."status" <> 'CANCELLED'
  AND UPPER(legacy."platform") = 'VRBO'
  AND legacy."externalRef" IS NULL
ORDER BY legacy."id", current."updatedAt" DESC, current."id";

UPDATE "Booking" AS legacy
SET "status" = 'CANCELLED',
    "internalNotes" = CONCAT_WS(
      E'\n',
      NULLIF(legacy."internalNotes", ''),
      CONCAT('Retired by booking-integrity migration; superseded by ', s."currentId")
    ),
    "updatedAt" = CURRENT_TIMESTAMP
FROM "_legacy_superseded" AS s
WHERE legacy."id" = s."legacyId"
  AND legacy."externalRef" IS NULL;

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

-- The prior migration created the nullable idempotency index. Keep it and add
-- database-enforced concurrency protection only after the data repair above.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "booking_no_overlap";

-- The exclusion constraint closes concurrent guest-reservation races. Blocks
-- are handled by the trigger below so two maintenance/owner blocks may overlap
-- without weakening the guest-reservation guarantee.
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_overlap"
  EXCLUDE USING gist (
    "propertyId" WITH =,
    tsrange("checkIn", "checkOut", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN'));

CREATE OR REPLACE FUNCTION "booking_prevent_overlap"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" NOT IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'BLOCKED') THEN
    RETURN NEW;
  END IF;

  IF NEW."checkOut" <= NEW."checkIn" THEN
    RAISE EXCEPTION 'booking check-out must be after check-in'
      USING ERRCODE = '22007';
  END IF;

  -- Serialize all occupancy writes per property. The GiST constraint protects
  -- guest/guest races too; this lock also makes guest/block checks race-safe.
  PERFORM pg_advisory_xact_lock(hashtext(NEW."propertyId"));

  IF EXISTS (
    SELECT 1
    FROM "Booking" AS existing
    WHERE existing."id" <> NEW."id"
      AND existing."propertyId" = NEW."propertyId"
      AND existing."status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'BLOCKED')
      AND tsrange(existing."checkIn", existing."checkOut", '[)') &&
          tsrange(NEW."checkIn", NEW."checkOut", '[)')
      AND NOT (NEW."status" = 'BLOCKED' AND existing."status" = 'BLOCKED')
  ) THEN
    RAISE EXCEPTION 'booking overlaps occupied inventory for property %', NEW."propertyId"
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "booking_prevent_overlap" ON "Booking";
CREATE TRIGGER "booking_prevent_overlap"
BEFORE INSERT OR UPDATE OF "propertyId", "checkIn", "checkOut", "status"
ON "Booking"
FOR EACH ROW EXECUTE FUNCTION "booking_prevent_overlap"();

COMMIT;
