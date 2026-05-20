import { NextRequest, NextResponse } from 'next/server';

const reviews: any[] = [
  {
    id: 'REV-002',
    booking_id: 'BK-015',
    property_id: 'PROP-002',
    guest_id: 'GUEST-001',
    guest_name: 'Sarah Johnson',
    platform: 'google',
    rating: 5,
    text: 'Best BnB in Midland. Will be back!',
    response_text: null,
    response_status: 'pending',
    stay_dates: { check_in: '2025-08-10', check_out: '2025-08-13' },
    created_at: '2025-08-16T00:00:00Z',
    responded_at: null,
  },
  {
    id: 'REV-003',
    booking_id: 'BK-020',
    property_id: 'PROP-002',
    guest_id: 'GUEST-002',
    guest_name: 'Mike Thompson',
    platform: 'direct',
    rating: 4,
    text: 'Good location for work. WiFi could be faster.',
    response_text: null,
    response_status: 'pending',
    stay_dates: { check_in: '2026-01-05', check_out: '2026-01-19' },
    created_at: '2026-01-21T00:00:00Z',
    responded_at: null,
  },
];

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/reviews/[id]/respond ────────────────────────────────────────
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idx = reviews.findIndex((r) => r.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const review = reviews[idx];

    if (review.response_status === 'responded') {
      return NextResponse.json(
        { error: 'Review already has a response', responded_at: review.responded_at },
        { status: 409 },
      );
    }

    const body = await request.json();

    if (!body.response_text || typeof body.response_text !== 'string') {
      return NextResponse.json(
        { error: 'response_text is required and must be a string' },
        { status: 400 },
      );
    }

    if (body.response_text.trim().length < 10) {
      return NextResponse.json(
        { error: 'response_text must be at least 10 characters' },
        { status: 400 },
      );
    }

    if (body.response_text.length > 2000) {
      return NextResponse.json(
        { error: 'response_text must be 2000 characters or fewer' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    reviews[idx] = {
      ...review,
      response_text: body.response_text.trim(),
      response_status: 'responded',
      responded_at: now,
    };

    return NextResponse.json({
      review: reviews[idx],
      message: `Response posted to ${review.platform} review from ${review.guest_name}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to respond to review', detail: error.message },
      { status: 500 },
    );
  }
}
