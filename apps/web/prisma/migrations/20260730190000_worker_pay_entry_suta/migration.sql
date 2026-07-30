-- AlterTable
-- Written by hand rather than diffed from git HEAD: the previous payroll
-- migration is applied but not yet committed, so a HEAD diff would re-list its
-- columns and abort this one (prisma migrate deploy fails silently in that case).
ALTER TABLE "WorkerPayEntry" ADD COLUMN "sutaCents" INTEGER NOT NULL DEFAULT 0;
