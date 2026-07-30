-- AlterTable
-- Only paidDate: bookingId / subtotalCents / taxCents were already applied by
-- 20260730130000_invoice_booking_subtotal_tax. The generated diff duplicated
-- them because it was taken against git HEAD rather than the last applied
-- schema state, and re-adding an existing column aborts the migration.
ALTER TABLE "Invoice" ADD COLUMN "paidDate" TIMESTAMP(3);
