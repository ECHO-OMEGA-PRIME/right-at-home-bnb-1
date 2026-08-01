-- Additive only: nullable column + unique index. Property.id is NOT touched.
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Property_slug_key" ON "Property"("slug");
