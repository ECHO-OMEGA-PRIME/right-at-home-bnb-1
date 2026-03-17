import { NextRequest, NextResponse } from 'next/server';

// ── Mock bookings store (shared reference — in production this is DB) ────
const bookings: any[] = [
  {
    id: 'BK-001',
    property_id: 'PROP-001',
    property_name: 'Sunset Retreat',
    guest_id: 'GUEST-001',
    guest_name: 'Sarah Johnson',
    guest_email: 'sarah@example.com',
    guest_phone: '+14325551001',
    status: 'confirmed',
    check_in: '2026-03-20',
    check_out: '2026-03-23',
    nights: 3,
    nightly_rate_cents: 17500,
    cleaning_fee_cents: 12500,
    pet_fee_cents: 0,
    subtotal_cents: 65000,
    tax_cents: 5363,
    total_cents: 70363,
    paid_cents: 70363,
    platform: 'direct',
    guest_count: 2,
    pets: false,
    special_requests: null,
    lock_code: '7823',
    created_at: '2026-03-10T14:30:00Z',
    updated_at: '2026-03-10T14:30:00Z',
  },
  {
    id: 'BK-002',
    property_id: 'PROP-002',
    property_name: 'Oilfield Oasis',
    guest_id: 'GUEST-002',
    guest_name: 'Mike Chen',
    guest_email: 'mike.chen@example.com',
    guest_phone: '+14325551002',
    status: 'pending',
    check_in: '2026-03-22',
    check_out: '2026-03-25',
    nights: 3,
    nightly_rate_cents: 22500,
    cleaning_fee_cents: 15000,
    pet_fee_cents: 0,
    subtotal_cents: 82500,
    tax_cents: 6806,
    total_cents: 89306,
    paid_cents: 0,
    platform: 'vrbo',
    guest_count: 2,
    pets: false,
    special_requests: 'Late check-in around 9pm',
    lock_code: null,
    created_at: '2026-03-12T09:15:00Z',
    updated_at: '2026-03-12T09:15:00Z',
  },
  {
    id: 'BK-003',
    property_id: 'PROP-001',
    property_name: 'Sunset Retreat',
    guest_id: 'GUEST-003',
    guest_name: 'Emily Davis',
    guest_email: 'emily.d@example.com',
    guest_phone: '+14325551003',
    status: 'completed',
    check_in: '2026-03-10',
    check_out: '2026-03-14',
    nights: 4,
    nightly_rate_cents: 17500,
    cleaning_fee_cents: 12500,
    pet_fee_cents: 5000,
    subtotal_cents: 87500,
    tax_cents: 7219,
    total_cents: 94719,
    paid_cents: 94719,
    platform: 'airbnb',
    guest_count: 3,
    pets: true,
    special_requests: 'Traveling with a small dog',
    lock_code: '4519',
    created_at: '2026-03-01T18:00:00Z',
    updated_at: '2026-03-14T11:00:00Z',
  },
];

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
