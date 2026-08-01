-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authUid" TEXT;

-- CreateTable
CREATE TABLE "WorkerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workerType" TEXT NOT NULL,
    "employmentClass" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "dispatchPriority" INTEGER NOT NULL DEFAULT 100,
    "autoDispatchEligible" BOOLEAN NOT NULL DEFAULT true,
    "defaultPayType" TEXT NOT NULL DEFAULT 'PER_JOB',
    "hourlyRateCents" INTEGER,
    "paymentMethod" TEXT,
    "paymentDestinationRef" TEXT,
    "tuyaIdentityRef" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "maxConcurrentJobs" INTEGER NOT NULL DEFAULT 1,
    "scheduleJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyServiceRate" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyServiceRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyChecklistTemplate" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "itemsJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "bookingId" TEXT,
    "requestedByUserId" TEXT,
    "assignedWorkerId" TEXT,
    "serviceType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dispatchMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledStart" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "checkInLat" DOUBLE PRECISION,
    "checkInLng" DOUBLE PRECISION,
    "checkOutLat" DOUBLE PRECISION,
    "checkOutLng" DOUBLE PRECISION,
    "timerSeconds" INTEGER,
    "payAmountCents" INTEGER,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNAPPROVED',
    "reportSummary" TEXT,
    "damageReported" BOOLEAN NOT NULL DEFAULT false,
    "theftReported" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceNeeded" BOOLEAN NOT NULL DEFAULT false,
    "yardNeeded" BOOLEAN NOT NULL DEFAULT false,
    "poolNeeded" BOOLEAN NOT NULL DEFAULT false,
    "reportSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderChecklistItem" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "templateItemKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "evidencePhotoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderPhoto" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "objectUrl" TEXT NOT NULL,
    "objectSha256" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "caption" TEXT,
    "uploadedByUserId" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderIssue" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'NORMAL',
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REPORTED',
    "photoUrlsJson" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSchedule" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "workerId" TEXT,
    "serviceType" TEXT NOT NULL,
    "recurrenceRule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "nextRunAt" TIMESTAMP(3),
    "durationMins" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "bookingId" TEXT,
    "workOrderId" TEXT,
    "userId" TEXT,
    "subjectType" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'TUYA',
    "externalGrantRef" TEXT NOT NULL,
    "secretRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "deliveryChannel" TEXT,
    "deliveryReceiptRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "bookingId" TEXT,
    "guestId" TEXT NOT NULL,
    "assignedWorkOrderId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sourceChannel" TEXT NOT NULL DEFAULT 'WEB',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollBatch" (
    "id" TEXT NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerPayEntry" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "payrollBatchId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'EARNED',
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "externalPaymentRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerPayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConciergeAction" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "actorType" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "inputJson" TEXT,
    "resultJson" TEXT,
    "failureReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConciergeAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalAlert" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "bookingId" TEXT,
    "workOrderId" TEXT,
    "assignedToUserId" TEXT,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notifiedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_userId_key" ON "WorkerProfile"("userId");

-- CreateIndex
CREATE INDEX "WorkerProfile_workerType_isAvailable_idx" ON "WorkerProfile"("workerType", "isAvailable");

-- CreateIndex
CREATE INDEX "WorkerProfile_autoDispatchEligible_dispatchPriority_idx" ON "WorkerProfile"("autoDispatchEligible", "dispatchPriority");

-- CreateIndex
CREATE INDEX "WorkerProfile_employmentClass_idx" ON "WorkerProfile"("employmentClass");

-- CreateIndex
CREATE INDEX "PropertyServiceRate_propertyId_serviceType_isActive_idx" ON "PropertyServiceRate"("propertyId", "serviceType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyServiceRate_propertyId_serviceType_effectiveFrom_key" ON "PropertyServiceRate"("propertyId", "serviceType", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PropertyChecklistTemplate_propertyId_serviceType_isActive_idx" ON "PropertyChecklistTemplate"("propertyId", "serviceType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyChecklistTemplate_propertyId_serviceType_version_key" ON "PropertyChecklistTemplate"("propertyId", "serviceType", "version");

-- CreateIndex
CREATE INDEX "WorkOrder_propertyId_status_idx" ON "WorkOrder"("propertyId", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_bookingId_idx" ON "WorkOrder"("bookingId");

-- CreateIndex
CREATE INDEX "WorkOrder_assignedWorkerId_status_idx" ON "WorkOrder"("assignedWorkerId", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_serviceType_status_idx" ON "WorkOrder"("serviceType", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_scheduledStart_idx" ON "WorkOrder"("scheduledStart");

-- CreateIndex
CREATE INDEX "WorkOrder_dueAt_status_idx" ON "WorkOrder"("dueAt", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_dispatchMode_status_priority_idx" ON "WorkOrder"("dispatchMode", "status", "priority");

-- CreateIndex
CREATE INDEX "WorkOrderChecklistItem_workOrderId_completed_idx" ON "WorkOrderChecklistItem"("workOrderId", "completed");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderChecklistItem_workOrderId_templateItemKey_key" ON "WorkOrderChecklistItem"("workOrderId", "templateItemKey");

-- CreateIndex
CREATE INDEX "WorkOrderPhoto_workOrderId_category_idx" ON "WorkOrderPhoto"("workOrderId", "category");

-- CreateIndex
CREATE INDEX "WorkOrderIssue_workOrderId_status_idx" ON "WorkOrderIssue"("workOrderId", "status");

-- CreateIndex
CREATE INDEX "WorkOrderIssue_issueType_severity_status_idx" ON "WorkOrderIssue"("issueType", "severity", "status");

-- CreateIndex
CREATE INDEX "ServiceSchedule_serviceType_isActive_nextRunAt_idx" ON "ServiceSchedule"("serviceType", "isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "ServiceSchedule_workerId_isActive_idx" ON "ServiceSchedule"("workerId", "isActive");

-- CreateIndex
CREATE INDEX "ServiceSchedule_propertyId_serviceType_idx" ON "ServiceSchedule"("propertyId", "serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrant_workOrderId_key" ON "AccessGrant"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrant_externalGrantRef_key" ON "AccessGrant"("externalGrantRef");

-- CreateIndex
CREATE INDEX "AccessGrant_propertyId_status_idx" ON "AccessGrant"("propertyId", "status");

-- CreateIndex
CREATE INDEX "AccessGrant_bookingId_idx" ON "AccessGrant"("bookingId");

-- CreateIndex
CREATE INDEX "AccessGrant_userId_status_idx" ON "AccessGrant"("userId", "status");

-- CreateIndex
CREATE INDEX "AccessGrant_startsAt_endsAt_status_idx" ON "AccessGrant"("startsAt", "endsAt", "status");

-- CreateIndex
CREATE INDEX "GuestRequest_guestId_status_idx" ON "GuestRequest"("guestId", "status");

-- CreateIndex
CREATE INDEX "GuestRequest_bookingId_idx" ON "GuestRequest"("bookingId");

-- CreateIndex
CREATE INDEX "GuestRequest_propertyId_status_urgency_idx" ON "GuestRequest"("propertyId", "status", "urgency");

-- CreateIndex
CREATE INDEX "GuestRequest_assignedWorkOrderId_idx" ON "GuestRequest"("assignedWorkOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollBatch_weekEnding_key" ON "PayrollBatch"("weekEnding");

-- CreateIndex
CREATE INDEX "PayrollBatch_status_weekEnding_idx" ON "PayrollBatch"("status", "weekEnding");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerPayEntry_workOrderId_key" ON "WorkerPayEntry"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkerPayEntry_workerId_status_earnedAt_idx" ON "WorkerPayEntry"("workerId", "status", "earnedAt");

-- CreateIndex
CREATE INDEX "WorkerPayEntry_payrollBatchId_idx" ON "WorkerPayEntry"("payrollBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ConciergeAction_idempotencyKey_key" ON "ConciergeAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ConciergeAction_status_riskLevel_idx" ON "ConciergeAction"("status", "riskLevel");

-- CreateIndex
CREATE INDEX "ConciergeAction_requestedByUserId_createdAt_idx" ON "ConciergeAction"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ConciergeAction_actionType_targetType_targetId_idx" ON "ConciergeAction"("actionType", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "OperationalAlert_status_severity_createdAt_idx" ON "OperationalAlert"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "OperationalAlert_propertyId_status_idx" ON "OperationalAlert"("propertyId", "status");

-- CreateIndex
CREATE INDEX "OperationalAlert_bookingId_idx" ON "OperationalAlert"("bookingId");

-- CreateIndex
CREATE INDEX "OperationalAlert_workOrderId_idx" ON "OperationalAlert"("workOrderId");

-- CreateIndex
CREATE INDEX "OperationalAlert_assignedToUserId_status_idx" ON "OperationalAlert"("assignedToUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_authUid_key" ON "User"("authUid");

-- AddForeignKey
ALTER TABLE "WorkerProfile" ADD CONSTRAINT "WorkerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyServiceRate" ADD CONSTRAINT "PropertyServiceRate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyChecklistTemplate" ADD CONSTRAINT "PropertyChecklistTemplate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assignedWorkerId_fkey" FOREIGN KEY ("assignedWorkerId") REFERENCES "WorkerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderChecklistItem" ADD CONSTRAINT "WorkOrderChecklistItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPhoto" ADD CONSTRAINT "WorkOrderPhoto_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderIssue" ADD CONSTRAINT "WorkOrderIssue_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSchedule" ADD CONSTRAINT "ServiceSchedule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSchedule" ADD CONSTRAINT "ServiceSchedule_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "WorkerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_assignedWorkOrderId_fkey" FOREIGN KEY ("assignedWorkOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerPayEntry" ADD CONSTRAINT "WorkerPayEntry_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "WorkerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerPayEntry" ADD CONSTRAINT "WorkerPayEntry_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerPayEntry" ADD CONSTRAINT "WorkerPayEntry_payrollBatchId_fkey" FOREIGN KEY ("payrollBatchId") REFERENCES "PayrollBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciergeAction" ADD CONSTRAINT "ConciergeAction_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciergeAction" ADD CONSTRAINT "ConciergeAction_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

