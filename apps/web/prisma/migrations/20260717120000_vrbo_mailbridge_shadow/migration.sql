-- RAH Vrbo MailBridge Phase 1
-- Read-only shadow ingestion and reconciliation. No mutation of Booking,
-- calendars, messages, finance, or smart-lock state.

-- CreateTable
CREATE TABLE "VrboMailCursor" (
    "mailbox" TEXT NOT NULL,
    "uidValidity" BIGINT NOT NULL,
    "lastUid" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VrboMailCursor_pkey" PRIMARY KEY ("mailbox")
);

-- CreateTable
CREATE TABLE "VrboMailMessage" (
    "id" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "uidValidity" BIGINT NOT NULL,
    "uid" BIGINT NOT NULL,
    "internetMessageId" TEXT,
    "fromAddress" TEXT,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "rawSha256" TEXT NOT NULL,
    "bodyText" TEXT,
    "headersJson" JSONB,
    "parserVersion" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "parseStatus" TEXT NOT NULL,
    "parsedJson" JSONB,
    "parseError" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VrboMailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VrboReservationEvidence" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "reservationKey" TEXT NOT NULL,
    "propertyId" TEXT,
    "vrboListingId" TEXT,
    "reservationId" TEXT,
    "confirmationCode" TEXT,
    "eventType" TEXT,
    "status" TEXT,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "guestCount" INTEGER,
    "totalAmountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "observedAt" TIMESTAMP(3) NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "validationStatus" TEXT NOT NULL DEFAULT 'VALID',
    "validationErrors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VrboReservationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VrboReservationLedger" (
    "reservationKey" TEXT NOT NULL,
    "propertyId" TEXT,
    "vrboListingId" TEXT,
    "reservationId" TEXT,
    "confirmationCode" TEXT,
    "status" TEXT,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "guestCount" INTEGER,
    "totalAmountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "consensusStatus" TEXT NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "evidenceCount" INTEGER NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "canonicalJson" JSONB NOT NULL,
    "disagreementJson" JSONB,
    "validationErrors" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastReconciledAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VrboReservationLedger_pkey" PRIMARY KEY ("reservationKey")
);

-- CreateTable
CREATE TABLE "VrboReconciliationRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "mode" TEXT NOT NULL DEFAULT 'SHADOW',
    "status" TEXT NOT NULL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "reservationCount" INTEGER NOT NULL DEFAULT 0,
    "consistentCount" INTEGER NOT NULL DEFAULT 0,
    "unverifiedCount" INTEGER NOT NULL DEFAULT 0,
    "syncAtRiskCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VrboReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VrboMailMessage_mailbox_uidValidity_uid_key"
ON "VrboMailMessage"("mailbox", "uidValidity", "uid");

-- CreateIndex
CREATE INDEX "VrboMailMessage_receivedAt_idx"
ON "VrboMailMessage"("receivedAt");

-- CreateIndex
CREATE INDEX "VrboMailMessage_parseStatus_eventType_idx"
ON "VrboMailMessage"("parseStatus", "eventType");

-- CreateIndex
CREATE INDEX "VrboMailMessage_rawSha256_idx"
ON "VrboMailMessage"("rawSha256");

-- CreateIndex
CREATE UNIQUE INDEX "VrboReservationEvidence_sourceType_sourceKey_payloadSha256_key"
ON "VrboReservationEvidence"("sourceType", "sourceKey", "payloadSha256");

-- CreateIndex
CREATE INDEX "VrboReservationEvidence_reservationKey_observedAt_idx"
ON "VrboReservationEvidence"("reservationKey", "observedAt");

-- CreateIndex
CREATE INDEX "VrboReservationEvidence_sourceType_createdAt_idx"
ON "VrboReservationEvidence"("sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "VrboReservationEvidence_validationStatus_idx"
ON "VrboReservationEvidence"("validationStatus");

-- CreateIndex
CREATE INDEX "VrboReservationLedger_consensusStatus_lastReconciledAt_idx"
ON "VrboReservationLedger"("consensusStatus", "lastReconciledAt");

-- CreateIndex
CREATE INDEX "VrboReservationLedger_propertyId_checkIn_idx"
ON "VrboReservationLedger"("propertyId", "checkIn");

-- CreateIndex
CREATE INDEX "VrboReservationLedger_vrboListingId_idx"
ON "VrboReservationLedger"("vrboListingId");

-- CreateIndex
CREATE INDEX "VrboReconciliationRun_status_startedAt_idx"
ON "VrboReconciliationRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "VrboReconciliationRun_syncAtRiskCount_startedAt_idx"
ON "VrboReconciliationRun"("syncAtRiskCount", "startedAt");

-- CreateIndex
CREATE INDEX "VrboMailCursor_updatedAt_idx"
ON "VrboMailCursor"("updatedAt");
