import { NextRequest, NextResponse } from 'next/server';

// ── Bookings store (empty - in production this is DB) ────────────────────
const bookings: any[] = [];

// Cancellation refund policy: >7 days = 100%, 3-7 days = 50%, <3 days = 0%
function calculateRefundCents(booking: any): number {
  const now = new Date();
  const checkIn = new Date(booking.check_in);
  const daysUntil = Math.ceil((checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil > 7) return booking.paid_cents;
  if (daysUntil >= 3) return Math.round(booking.paid_cents * 0.5);
  return 0;
}

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/bookings/[id] ───────────────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const booking = bookings.find((b) => b.id === id);

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ booking });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch booking', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PUT /api/bookings/[id] ───────────────────────────────────────────────
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idx = bookings.findIndex((b) => b.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const body = await request.json();
    const booking = bookings[idx];

    // Status transitions
    const validTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['checked_in', 'cancelled'],
      checked_in: ['completed'],
      completed: [],
      cancelled: [],
    };

    if (body.status) {
      const allowed = validTransitions[booking.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from '${booking.status}' to '${body.status}'. Allowed: ${allowed.join(', ') || 'none'}`,
          },
          { status: 400 },
        );
      }
      booking.status = body.status;
    }

    // Update allowed fields
    if (body.check_in !== undefined) booking.check_in = body.check_in;
    if (body.check_out !== undefined) booking.check_out = body.check_out;
    if (body.guest_count !== undefined) booking.guest_count = body.guest_count;
    if (body.special_requests !== undefined) booking.special_requests = body.special_requests;
    if (body.lock_code !== undefined) booking.lock_code = body.lock_code;
    if (body.paid_cents !== undefined) booking.paid_cents = body.paid_cents;

    // Recalculate nights if dates changed
    if (body.check_in || body.check_out) {
      const ci = new Date(booking.check_in);
      const co = new Date(booking.check_out);
      booking.nights = Math.ceil((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24));
    }

    booking.updated_at = new Date().toISOString();
    bookings[idx] = booking;

    return NextResponse.json({ booking });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update booking', detail: error.message },
      { status: 500 },
    );
  }
}

// ── DELETE /api/bookings/[id] — Cancel booking ───────────────────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idx = bookings.findIndex((b) => b.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = bookings[idx];

    if (['completed', 'cancelled'].includes(booking.status)) {
      return NextResponse.json(
        { error: `Cannot cancel a booking with status '${booking.status}'` },
        { status: 400 },
      );
    }

    const refund_cents = calculateRefundCents(booking);
    booking.status = 'cancelled';
    booking.updated_at = new Date().toISOString();
    bookings[idx] = booking;

    return NextResponse.json({
      booking,
      cancellation: {
        refund_cents,
        refund_percentage: booking.paid_cents > 0 ? Math.round((refund_cents / booking.paid_cents) * 100) : 0,
        policy: 'Full refund >7 days, 50% 3-7 days, 0% <3 days before check-in',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to cancel booking', detail: error.message },
      { status: 500 },
    );
  }
}
