-- CreateTable
CREATE TABLE "StevenMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "guestId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "emotion" TEXT,
    "propertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StevenMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StevenMessage_sessionId_createdAt_idx" ON "StevenMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "StevenMessage_guestId_createdAt_idx" ON "StevenMessage"("guestId", "createdAt");

-- CreateIndex
CREATE INDEX "StevenMessage_createdAt_idx" ON "StevenMessage"("createdAt");
