import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Availability is checked against the real Booking table (761 rows).
//
// This route previously answered from a small hardcoded array, which meant it
// would report dates as AVAILABLE that were in fact booked -- a double-booking
// hazard, not merely a cosmetic mock (queue #26855).
//
// Statuses in the database are upper-case ('CONFIRMED'); the API contract is
// lower-case. Comparisons are case-insensitive so a casing mismatch cannot
// silently make every existing booking invisible to the overlap check, which
// would fail OPEN in exactly the wrong direction.

const BLOCKING_STATUSES = ['confirmed', 'pending', 'checked_in'];

const iso = (d: Date) => d.toISOString().slice(0, 10);

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

function datesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  // Half-open ranges: a checkout on the same day as another check-in is fine.
  return aIn < bOut && aOut > bIn;
}

// ── GET /api/bookings/availability ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const propertyId = params.get('property_id');
    const checkIn = params.get('check_in');
    const checkOut = params.get('check_out');

    if (!propertyId || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'Missing required: property_id, check_in, check_out' },
        { status: 400 },
      );
    }
    if (!(checkIn < checkOut)) {
      return NextResponse.json(
        { error: 'check_out must be after check_in' },
        { status: 400 },
      );
    }

    // Every blocking booking for this property, mapped to the contract shape.
    const rows = await prisma.booking.findMany({
      where: { propertyId },
      select: { id: true, checkIn: true, checkOut: true, status: true },
      orderBy: { checkIn: 'asc' },
    });

    const bookedRanges = rows
      .filter((b) => BLOCKING_STATUSES.includes((b.status || '').toLowerCase()))
      .map((b) => ({
        booking_id: b.id,
        check_in: iso(b.checkIn),
        check_out: iso(b.checkOut),
        status: (b.status || '').toLowerCase(),
      }));

    const conflicts = bookedRanges.filter((b) =>
      datesOverlap(checkIn, checkOut, b.check_in, b.check_out),
    );
    const available = conflicts.length === 0;

    const suggestedDates: { check_in: string; check_out: string }[] = [];
    if (!available) {
      const requestedNights = Math.ceil(
        (new Date(`${checkOut}T00:00:00.000Z`).getTime() -
          new Date(`${checkIn}T00:00:00.000Z`).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      // Right after each conflicting checkout, if that window is itself free.
      for (const conflict of conflicts) {
        const altCheckIn = conflict.check_out;
        const altCheckOut = addDays(altCheckIn, requestedNights);
        const clash = bookedRanges.some((b) =>
          datesOverlap(altCheckIn, altCheckOut, b.check_in, b.check_out),
        );
        if (!clash) suggestedDates.push({ check_in: altCheckIn, check_out: altCheckOut });
      }

      // And immediately before the first conflict, if that is not in the past.
      const firstConflict = [...conflicts].sort((a, b) =>
        a.check_in.localeCompare(b.check_in),
      )[0];
      if (firstConflict) {
        const altCheckOut = firstConflict.check_in;
        const altCheckIn = addDays(altCheckOut, -requestedNights);
        if (altCheckIn >= iso(new Date())) {
          const clash = bookedRanges.some((b) =>
            datesOverlap(altCheckIn, altCheckOut, b.check_in, b.check_out),
          );
          if (!clash) suggestedDates.push({ check_in: altCheckIn, check_out: altCheckOut });
        }
      }
    }

    const unique = suggestedDates.filter(
      (s, i, arr) =>
        arr.findIndex((x) => x.check_in === s.check_in && x.check_out === s.check_out) === i,
    );

    return NextResponse.json({
      available,
      property_id: propertyId,
      requested: { check_in: checkIn, check_out: checkOut },
      conflicts,
      suggested_dates: unique,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to check availability', detail: error.message },
      { status: 500 },
    );
  }
}
