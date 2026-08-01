-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "externalRef" TEXT;

-- CreateTable
CREATE TABLE "AccessLifecycleQueue" (
    "id" TEXT NOT NULL,
    "bookingRef" TEXT NOT NULL,
    "propertyId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "containsCredential" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessLifecycleQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessLifecycleQueue_bookingRef_action_key" ON "AccessLifecycleQueue"("bookingRef", "action");

-- CreateIndex
CREATE INDEX "AccessLifecycleQueue_status_idx" ON "AccessLifecycleQueue"("status");

-- CreateIndex
CREATE INDEX "AccessLifecycleQueue_createdAt_idx" ON "AccessLifecycleQueue"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_platform_externalRef_key" ON "Booking"("platform", "externalRef");
