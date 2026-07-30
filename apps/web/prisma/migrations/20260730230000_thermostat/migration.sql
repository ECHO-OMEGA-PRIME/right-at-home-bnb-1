-- Additive only: new table + FK to Property. No existing table is altered.
CREATE TABLE IF NOT EXISTS "Thermostat" (
    "id"              TEXT NOT NULL,
    "propertyId"      TEXT NOT NULL,
    "name"            TEXT NOT NULL DEFAULT 'Main Thermostat',
    "deviceType"      TEXT NOT NULL,
    "deviceId"        TEXT,
    "targetTempF"     INTEGER,
    "mode"            TEXT NOT NULL DEFAULT 'off',
    "fanMode"         TEXT NOT NULL DEFAULT 'auto',
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule"        TEXT,
    "lastTempF"       INTEGER,
    "lastHumidity"    INTEGER,
    "lastSeenAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Thermostat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Thermostat_deviceId_key" ON "Thermostat"("deviceId");
CREATE INDEX IF NOT EXISTS "Thermostat_propertyId_idx" ON "Thermostat"("propertyId");
DO $$ BEGIN
  ALTER TABLE "Thermostat" ADD CONSTRAINT "Thermostat_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
