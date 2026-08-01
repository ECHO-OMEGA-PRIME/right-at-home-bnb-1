-- AlterTable
ALTER TABLE "OperationalAlert" ADD COLUMN     "resolvedBy" TEXT,
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "metadata" TEXT;

-- CreateIndex
CREATE INDEX "OperationalAlert_dedupeKey_status_idx" ON "OperationalAlert"("dedupeKey", "status");

-- CreateIndex
CREATE INDEX "OperationalAlert_alertType_status_idx" ON "OperationalAlert"("alertType", "status");
