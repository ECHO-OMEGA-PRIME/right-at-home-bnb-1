-- AlterTable
ALTER TABLE "PropertyPhoto" ADD COLUMN     "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "PropertyPhotoBlob" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyPhotoBlob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyPhotoBlob_photoId_key" ON "PropertyPhotoBlob"("photoId");

-- CreateIndex
CREATE INDEX "PropertyPhoto_propertyId_sourceUrl_idx" ON "PropertyPhoto"("propertyId", "sourceUrl");

-- AddForeignKey
ALTER TABLE "PropertyPhotoBlob" ADD CONSTRAINT "PropertyPhotoBlob_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "PropertyPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
