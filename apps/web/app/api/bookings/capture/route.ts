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

    // ── Capture payment ──────────────────────────────────────────
    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Payment not completed. Status: ${capture.status}` },
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
