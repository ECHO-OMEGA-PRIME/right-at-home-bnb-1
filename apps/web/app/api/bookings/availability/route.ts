import { NextRequest, NextResponse } from 'next/server';

// ── Bookings store (shared with bookings route in production via DB) ─────
const bookings = [
  {
    id: 'BK-001', property_id: 'PROP-001', status: 'confirmed',
    check_in: '2026-03-20', check_out: '2026-03-23',
  },
  {
    id: 'BK-002', property_id: 'PROP-001', status: 'confirmed',
    check_in: '2026-03-25', check_out: '2026-03-28',
  },
  {
    id: 'BK-003', property_id: 'PROP-002', status: 'pending',
    check_in: '2026-03-22', check_out: '2026-03-24',
  },
];

function datesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── GET /api/bookings/availability ───────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const propertyId = params.get('property_id');
    const checkIn = params.get('check_in');
    const checkOut = params.get('check_out');

    if (!propertyId || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'Missing required params: property_id, check_in, check_out' },
        { status: 400 },
      );
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      return NextResponse.json(
        { error: 'check_out must be after check_in' },
        { status: 400 },
      );
    }

    // Find conflicting bookings for this property
    const conflicts = bookings
      .filter(
        (b) =>
          b.property_id === propertyId &&
          ['confirmed', 'pending', 'checked_in'].includes(b.status) &&
          datesOverlap(checkIn, checkOut, b.check_in, b.check_out),
      )
      .map((b) => ({
        booking_id: b.id,
        check_in: b.check_in,
        check_out: b.check_out,
        status: b.status,
      }));

    const available = conflicts.length === 0;

    // Generate suggested alternative dates if not available
    const suggestedDates: { check_in: string; check_out: string }[] = [];
    if (!available) {
      const requestedNights = Math.ceil(
        (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      // Collect all booked ranges for this property, sorted by check_in
      const bookedRanges = bookings
        .filter(
          (b) =>
            b.property_id === propertyId &&
            ['confirmed', 'pending', 'checked_in'].includes(b.status),
        )
        .sort((a, b) => a.check_in.localeCompare(b.check_in));

      // Suggest: right after the last conflicting checkout
      for (const conflict of conflicts) {
        const altCheckIn = conflict.check_out;
        const altCheckOut = addDays(altCheckIn, requestedNights);

        // Verify the suggested window is also free
        const altConflicts = bookedRanges.filter((b) =>
          datesOverlap(altCheckIn, altCheckOut, b.check_in, b.check_out),
        );
        if (altConflicts.length === 0) {
          suggestedDates.push({ check_in: altCheckIn, check_out: altCheckOut });
        }
      }

      // Also suggest: right before the first conflict
      const firstConflict = conflicts.sort((a, b) =>
        a.check_in.localeCompare(b.check_in),
      )[0];
      if (firstConflict) {
        const altCheckOut = firstConflict.check_in;
        const altCheckIn = addDays(altCheckOut, -requestedNights);
        if (altCheckIn >= new Date().toISOString().split('T')[0]) {
          const priorConflicts = bookedRanges.filter((b) =>
            datesOverlap(altCheckIn, altCheckOut, b.check_in, b.check_out),
          );
          if (priorConflicts.length === 0) {
            suggestedDates.push({ check_in: altCheckIn, check_out: altCheckOut });
          }
        }
      }
    }

    // Deduplicate suggested dates
    const unique = suggestedDates.filter(
      (s, i, arr) =>
        arr.findIndex(
          (x) => x.check_in === s.check_in && x.check_out === s.check_out,
        ) === i,
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
      { error: 'Availability check failed', detail: error.message },
      { status: 500 },
    );
  }
}
