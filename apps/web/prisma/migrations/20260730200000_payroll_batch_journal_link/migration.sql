-- Additive only: links a payroll run to the journal entry it posted.
-- Nullable, no default, no data rewrite. Existing rows are untouched.
ALTER TABLE "PayrollBatch" ADD COLUMN IF NOT EXISTS "journalEntryId" TEXT;
