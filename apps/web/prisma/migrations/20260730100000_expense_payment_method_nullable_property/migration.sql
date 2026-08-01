-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_propertyId_fkey";

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "paymentMethod" TEXT,
ALTER COLUMN "propertyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

