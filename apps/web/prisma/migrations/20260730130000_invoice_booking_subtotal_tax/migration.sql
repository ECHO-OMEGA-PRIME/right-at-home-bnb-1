-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "subtotalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxCents" INTEGER NOT NULL DEFAULT 0;

