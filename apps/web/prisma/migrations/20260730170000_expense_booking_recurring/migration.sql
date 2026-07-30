-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "recurring" BOOLEAN NOT NULL DEFAULT false;

