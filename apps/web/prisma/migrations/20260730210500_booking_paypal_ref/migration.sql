-- Additive only: two nullable columns. No existing column is altered.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paypalOrderRef" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paypalCaptureId" TEXT;
