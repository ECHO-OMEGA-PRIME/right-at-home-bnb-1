import { NextRequest, NextResponse } from 'next/server';

const guests: any[] = [
  {
    id: 'GUEST-001', first_name: 'Sarah', last_name: 'Johnson',
    email: 'sarah.johnson@gmail.com', phone: '+12145551234',
    source: 'vrbo', tags: ['repeat', 'family', 'vip'],
    total_bookings: 3, total_spent_cents: 215000,
    avg_rating_given: 4.8, last_stay: '2026-03-23',
    notes: 'Prefers Sunset Retreat.',
    created_at: '2025-07-15T00:00:00Z', updated_at: '2026-03-10T00:00:00Z',
  },
];

const guestBookings = [
  { id: 'BK-001', property_name: 'Sunset Retreat', check_in: '2026-03-20', check_out: '2026-03-23', total_cents: 70363, status: 'confirmed' },
  { id: 'BK-010', property_name: 'Sunset Retreat', check_in: '2025-12-22', check_out: '2025-12-26', total_cents: 82000, status: 'checked_out' },
  { id: 'BK-015', property_name: 'Oilfield Oasis', check_in: '2025-08-10', check_out: '2025-08-13', total_cents: 62637, status: 'checked_out' },
];

const guestConversations = [
  { id: 'CONV-001', channel: 'sms', last_message: 'Looking forward to our stay!', last_at: '2026-03-18T10:00:00Z', message_count: 5 },
  { id: 'CONV-002', channel: 'email', last_message: 'Thanks for the welcome guide', last_at: '2026-03-19T14:00:00Z', message_count: 3 },
];

const guestReviews = [
  { id: 'REV-001', platform: 'vrbo', rating: 5, text: 'Wonderful stay! Super clean and well-stocked.', created_at: '2025-12-28T00:00:00Z' },
  { id: 'REV-002', platform: 'google', rating: 5, text: 'Best BnB in Midland. Will be back!', created_at: '2025-08-16T00:00:00Z' },
];

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/crm/guests/[id] ────────────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const guest = guests.find((g) => g.id === id);

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    return NextResponse.json({
      guest,
      bookings: guestBookings,
      conversations: guestConversations,
      reviews: guestReviews,
      lifetime_value_cents: guest.total_spent_cents,
      avg_booking_value_cents: guest.total_bookings > 0
        ? Math.round(guest.total_spent_cents / guest.total_bookings)
        : 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get guest', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PATCH /api/crm/guests/[id] ──────────────────────────────────────────
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idx = guests.findIndex((g) => g.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = [
      'first_name', 'last_name', 'email', 'phone', 'address',
      'source', 'tags', 'notes',
    ];

    const updated = { ...guests[idx] };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updated[field] = body[field];
      }
    }

    updated.updated_at = new Date().toISOString();
    guests[idx] = updated;

    return NextResponse.json({ guest: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update guest', detail: error.message },
      { status: 500 },
    );
  }
}
