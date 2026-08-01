-- CreateTable
CREATE TABLE "StaffApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffApplication_status_idx" ON "StaffApplication"("status");

-- CreateIndex
CREATE INDEX "StaffApplication_userId_idx" ON "StaffApplication"("userId");

-- CreateIndex
CREATE INDEX "StaffApplication_createdAt_idx" ON "StaffApplication"("createdAt");

-- AddForeignKey
ALTER TABLE "StaffApplication" ADD CONSTRAINT "StaffApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
