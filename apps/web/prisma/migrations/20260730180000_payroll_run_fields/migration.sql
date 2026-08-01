-- DropForeignKey
ALTER TABLE "WorkerPayEntry" DROP CONSTRAINT "WorkerPayEntry_workOrderId_fkey";

-- AlterTable
ALTER TABLE "PayrollBatch" ADD COLUMN     "payDate" TIMESTAMP(3),
ADD COLUMN     "periodStart" TIMESTAMP(3),
ADD COLUMN     "totalEmployerTaxCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalGrossCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalNetCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "WorkerPayEntry" ADD COLUMN     "employerMedicareCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "employerSsCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "federalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "futaCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hours" DOUBLE PRECISION,
ADD COLUMN     "medicareCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "netCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "socialSecurityCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stateCents" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "workOrderId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "WorkerPayEntry" ADD CONSTRAINT "WorkerPayEntry_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

