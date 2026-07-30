-- Additive only: new table, no existing table touched.
CREATE TABLE IF NOT EXISTS "ServiceSubscription" (
    "id"           TEXT NOT NULL,
    "service"      TEXT NOT NULL,
    "category"     TEXT NOT NULL,
    "description"  TEXT NOT NULL,
    "monthlyCost"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "status"       TEXT NOT NULL DEFAULT 'active',
    "usageMetric"  TEXT,
    "currentUsage" INTEGER,
    "usageLimit"   INTEGER,
    "notes"        TEXT,
    "lastBilled"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceSubscription_service_key"
    ON "ServiceSubscription"("service");
CREATE INDEX IF NOT EXISTS "ServiceSubscription_status_category_idx"
    ON "ServiceSubscription"("status", "category");
