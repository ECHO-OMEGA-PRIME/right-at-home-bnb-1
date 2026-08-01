-- Additive only: one nullable column plus an index. No existing column altered.
ALTER TABLE "WorkerProfile" ADD COLUMN IF NOT EXISTS "crew" TEXT;
CREATE INDEX IF NOT EXISTS "WorkerProfile_crew_idx" ON "WorkerProfile"("crew");
