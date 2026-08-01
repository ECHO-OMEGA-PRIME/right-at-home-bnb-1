import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  capturePayPalOrder,
  createAndSendInvoice,
  getPayPalOrder,
} from "@/lib/integrations/paypal-client";
import { PROPERTIES } from "@/lib/property-data";

export async function POST(req: NextRequest) {
  // @public-by-design — a guest completing a PayPal payment is not logged in.
  // Its control is payment verification, not a role: see the checks below.
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
      select: {
        id: true,
        confirmCode: true,
        paypalOrderRef: true,
        paypalCaptureId: true,
        totalPrice: true,
        status: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // IDEMPOTENCY. A guest whose browser times out after PayPal has already
    // captured will retry. Without this the retry either double-charges or --
    // once confirmCode has been overwritten with the transaction id -- fails the
    // reference check and strands them on a booking that IS paid.
    //
    // Answer the repeat with the original result and do not touch PayPal again.
    if (existing.paypalCaptureId && existing.status === "CONFIRMED") {
      return NextResponse.json({
        success: true,
        alreadyCaptured: true,
        confirmCode: existing.confirmCode,
        transactionId: existing.paypalCaptureId,
      });
    }

    // ── Verify BEFORE taking the money ───────────────────────────
    // The order is read first so a request that will be refused never results
    // in a captured payment. The same two facts are re-checked after capture
    // below: this pre-check is the courtesy, the post-check is the control.
    const order = await getPayPalOrder(paypalOrderId);
    const expectedRefPre = existing.paypalOrderRef ?? existing.confirmCode;

    if (!order.referenceId || order.referenceId !== expectedRefPre) {
      console.error("[bookings/capture] pre-capture order/booking mismatch", {
        bookingId,
        paypalOrderId,
        orderRef: order.referenceId,
      });
      return NextResponse.json(
        { error: "This payment does not belong to that booking" },
        { status: 400 }
      );
    }

    const owedPre = existing.totalPrice ?? 0;
    if (order.amount == null || Math.abs(order.amount - owedPre) > 0.01) {
      console.error("[bookings/capture] pre-capture amount mismatch", {
        bookingId,
        offered: order.amount,
        owed: owedPre,
      });
      return NextResponse.json(
        { error: "Payment amount does not match the booking total" },
        { status: 400 }
      );
    }

    // ── Capture payment ──────────────────────────────────────────
    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Payment not completed. Status: ${capture.status}` },
        { status: 400 }
      );
    }

    // The order must be the one created FOR THIS BOOKING. Checked against
    // paypalOrderRef, NOT confirmCode: confirmCode is overwritten with the
    // transaction id below, so verifying against it worked exactly once and
    // then broke every retry. Older bookings predate the column, so fall back
    // to confirmCode for those rather than rejecting a legitimate payment.
    const expectedRef = existing.paypalOrderRef ?? existing.confirmCode;
    if (!capture.referenceId || capture.referenceId !== expectedRef) {
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
        paypalCaptureId: capture.transactionId,
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
