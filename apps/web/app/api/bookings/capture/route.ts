import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  capturePayPalOrder,
  createAndSendInvoice,
} from "@/lib/integrations/paypal-client";
import { PROPERTIES } from "@/lib/property-data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paypalOrderId, bookingId } = body;

    if (!paypalOrderId || !bookingId) {
      return NextResponse.json(
        { error: "Missing paypalOrderId or bookingId" },
        { status: 400 }
      );
    }

    // This endpoint is PUBLIC by design (middleware PUBLIC_API_PREFIXES) -- a
    // guest completing a PayPal payment is not logged in. That makes verifying
    // the payment itself the ONLY control, and it was missing entirely: the
    // route captured whatever order id it was handed and then confirmed
    // whatever bookingId it was handed, with no link between the two and no
    // check on the amount.
    //
    // So anyone could POST their own completed $1 order id together with
    // someone else's bookingId and mark that booking CONFIRMED -- paying a
    // dollar for a $2,000 stay, or confirming a booking they do not own.
    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, confirmCode: true, totalPrice: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // ── Capture payment ──────────────────────────────────────────
    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Payment not completed. Status: ${capture.status}` },
        { status: 400 }
      );
    }

    // The order must be the one created FOR THIS BOOKING. checkout stores that
    // reference as booking.confirmCode, so the two must agree.
    if (!capture.referenceId || capture.referenceId !== existing.confirmCode) {
      console.error(
        "[bookings/capture] order/booking mismatch",
        { bookingId, paypalOrderId, orderRef: capture.referenceId },
      );
      return NextResponse.json(
        { error: "This payment does not belong to that booking" },
        { status: 400 }
      );
    }

    // ...and it must be for the right money. totalPrice is DOLLARS as a float,
    // so compare with a cent of tolerance rather than exact equality.
    const owed = existing.totalPrice ?? 0;
    if (capture.amount == null || Math.abs(capture.amount - owed) > 0.01) {
      console.error(
        "[bookings/capture] amount mismatch",
        { bookingId, paid: capture.amount, owed },
      );
      return NextResponse.json(
        { error: "Payment amount does not match the booking total" },
        { status: 400 }
      );
    }

    if (capture.currency && capture.currency !== "USD") {
      return NextResponse.json(
        { error: `Unexpected currency: ${capture.currency}` },
        { status: 400 }
      );
    }

    // ── Update booking ───────────────────────────────────────────
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CONFIRMED",
        confirmCode: capture.transactionId,
        internalNotes: `PayPal Order: ${paypalOrderId} | Transaction: ${capture.transactionId}`,
      },
      include: { guest: true },
    });

    // ── Send invoice ─────────────────────────────────────────────
    const property = PROPERTIES.find((p) => p.id === booking.propertyId);
    const propertyName = property?.name ?? booking.propertyId;

    let invoiceId = "";
    let invoiceUrl = "";

    try {
      const invoiceResult = await createAndSendInvoice({
        recipientEmail: booking.guest.email,
        recipientName: booking.guest.name,
        propertyName,
        checkIn: booking.checkIn.toISOString().slice(0, 10),
        checkOut: booking.checkOut.toISOString().slice(0, 10),
        nights: booking.totalNights,
        nightlyRate: booking.nightlyRate,
        cleaningFee: booking.cleaningFee ?? 0,
        totalAmount: booking.totalPrice,
        bookingRef: booking.confirmCode ?? bookingId,
      });
      invoiceId = invoiceResult.invoiceId;
      invoiceUrl = invoiceResult.invoiceUrl;
    } catch (invoiceErr) {
      // Log but don't fail the booking — payment already captured
      console.error("Invoice creation error (non-fatal):", invoiceErr);
    }

    return NextResponse.json({
      success: true,
      confirmCode: booking.confirmCode,
      transactionId: capture.transactionId,
      invoiceId,
      invoiceUrl,
    });
  } catch (err: unknown) {
    console.error("Payment capture error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
