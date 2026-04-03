import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createPayPalOrder } from "@/lib/integrations/paypal-client";
import { PROPERTIES } from "@/lib/property-data";

const TX_TAX_RATE = 0.0825; // 8.25% Texas hotel occupancy + local

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      propertyId,
      checkIn,
      checkOut,
      guestCount,
      guestName,
      guestEmail,
      guestPhone,
      specialReqs,
    } = body;

    // ── Validate required fields ─────────────────────────────────
    if (!propertyId || !checkIn || !checkOut || !guestName || !guestEmail) {
      return NextResponse.json(
        { error: "Missing required fields: propertyId, checkIn, checkOut, guestName, guestEmail" },
        { status: 400 }
      );
    }

    // ── Validate dates ───────────────────────────────────────────
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }
    if (checkInDate < now) {
      return NextResponse.json({ error: "Check-in date cannot be in the past" }, { status: 400 });
    }
    if (checkOutDate <= checkInDate) {
      return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
    }

    // ── Look up property pricing ─────────────────────────────────
    const property = PROPERTIES.find((p) => p.id === propertyId);
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }
    if (property.status !== "ACTIVE") {
      return NextResponse.json({ error: "Property is not available for booking" }, { status: 400 });
    }

    // ── Calculate pricing ────────────────────────────────────────
    const totalNights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (totalNights < 1 || totalNights > 90) {
      return NextResponse.json({ error: "Stay must be between 1 and 90 nights" }, { status: 400 });
    }

    const nightlyRate = property.nightlyRate;
    const subtotal = nightlyRate * totalNights;
    const cleaningFee = 150; // Standard cleaning fee for all properties
    const taxes = Math.round((subtotal + cleaningFee) * TX_TAX_RATE * 100) / 100;
    const totalPrice = Math.round((subtotal + cleaningFee + taxes) * 100) / 100;

    // ── Create PayPal order ──────────────────────────────────────
    const bookingRef = `RAH-${Date.now().toString(36).toUpperCase()}`;
    const description = `${property.name} — ${totalNights} night${totalNights > 1 ? "s" : ""} (${checkIn} to ${checkOut})`;

    const { id: paypalOrderId, approveUrl } = await createPayPalOrder(
      totalPrice,
      description,
      bookingRef
    );

    // ── Upsert guest ─────────────────────────────────────────────
    const guest = await prisma.guest.upsert({
      where: { email: guestEmail },
      update: {
        name: guestName,
        phone: guestPhone || undefined,
      },
      create: {
        email: guestEmail,
        name: guestName,
        phone: guestPhone || null,
        platform: "DIRECT",
      },
    });

    // ── Create booking ───────────────────────────────────────────
    const booking = await prisma.booking.create({
      data: {
        propertyId,
        guestId: guest.id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guestCount: guestCount || 1,
        platform: "DIRECT",
        confirmCode: bookingRef,
        nightlyRate,
        totalNights,
        subtotal,
        cleaningFee,
        serviceFee: 0,
        taxes,
        totalPrice,
        status: "PENDING",
        specialReqs: specialReqs || null,
        internalNotes: `PayPal Order: ${paypalOrderId}`,
      },
    });

    return NextResponse.json({
      paypalOrderId,
      approveUrl,
      bookingId: booking.id,
      priceBreakdown: {
        nightlyRate,
        totalNights,
        subtotal,
        cleaningFee,
        taxes,
        totalPrice,
      },
    });
  } catch (err: unknown) {
    console.error("Booking checkout error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
