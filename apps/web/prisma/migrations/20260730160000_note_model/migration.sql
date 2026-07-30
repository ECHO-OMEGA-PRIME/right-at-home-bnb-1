-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "propertyId" TEXT,
    "bookingId" TEXT,
    "guestId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "author" TEXT NOT NULL DEFAULT 'system',
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_type_idx" ON "Note"("type");

-- CreateIndex
CREATE INDEX "Note_propertyId_idx" ON "Note"("propertyId");

-- CreateIndex
CREATE INDEX "Note_bookingId_idx" ON "Note"("bookingId");

-- CreateIndex
CREATE INDEX "Note_guestId_idx" ON "Note"("guestId");

-- CreateIndex
CREATE INDEX "Note_pinned_idx" ON "Note"("pinned");

