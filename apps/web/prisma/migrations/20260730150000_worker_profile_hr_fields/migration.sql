-- AlterTable
ALTER TABLE "WorkerProfile" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "defaultHours" INTEGER,
ADD COLUMN     "hireDate" TIMESTAMP(3),
ADD COLUMN     "ssnLast4" TEXT,
ADD COLUMN     "w4Allowances" INTEGER,
ADD COLUMN     "w4FilingStatus" TEXT;

