-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN     "lastCountedAt" TIMESTAMP(3),
ADD COLUMN     "reorderQuantity" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "storageLocation" TEXT,
ADD COLUMN     "supplier" TEXT,
ALTER COLUMN "sku" DROP NOT NULL;

