-- Additive only: new table + FK to Property. No existing table is altered.
CREATE TABLE IF NOT EXISTS "Review" (
    "id"          TEXT NOT NULL,
    "propertyId"  TEXT NOT NULL,
    "bookingId"   TEXT,
    "guestId"     TEXT,
    "guestName"   TEXT NOT NULL,
    "platform"    TEXT NOT NULL DEFAULT 'direct',
    "rating"      INTEGER NOT NULL,
    "comment"     TEXT NOT NULL,
    "response"    TEXT,
    "respondedAt" TIMESTAMP(3),
    "categories"  TEXT,
    "checkIn"     TIMESTAMP(3),
    "checkOut"    TIMESTAMP(3),
    "status"      TEXT NOT NULL DEFAULT 'published',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Review_propertyId_status_idx" ON "Review"("propertyId", "status");
CREATE INDEX IF NOT EXISTS "Review_platform_idx"          ON "Review"("platform");
CREATE INDEX IF NOT EXISTS "Review_rating_idx"            ON "Review"("rating");
CREATE INDEX IF NOT EXISTS "Review_respondedAt_idx"       ON "Review"("respondedAt");

DO $$ BEGIN
  ALTER TABLE "Review" ADD CONSTRAINT "Review_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
