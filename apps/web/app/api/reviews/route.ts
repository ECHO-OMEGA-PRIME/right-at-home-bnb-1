import { NextRequest, NextResponse } from 'next/server';

// ── In-memory reviews store ─────────────────────────────────────────────────
const reviews: any[] = [
  {
    id: 'REV-001',
    property_id: 'PROP-001',
    booking_id: 'BK-001',
    guest_id: 'GUEST-001',
    guest_name: 'John D.',
    platform: 'direct',
    rating: 5,
    comment: 'Excellent stay! The house was spotless, well-stocked, and the smart lock made check-in a breeze. Will definitely come back.',
    response: null,
    responded_at: null,
    categories: {
      cleanliness: 5,
      communication: 5,
      check_in: 5,
      accuracy: 5,
      location: 4,
      value: 5,
    },
    status: 'published',
    created_at: '2026-03-11T14:00:00Z',
    updated_at: '2026-03-11T14:00:00Z',
  },
  {
    id: 'REV-002',
    property_id: 'PROP-002',
    booking_id: null,
    guest_id: 'GUEST-002',
    guest_name: 'Sarah J.',
    platform: 'airbnb',
    rating: 4,
    comment: 'Great location near downtown. Spacious rooms. Only knock is the water pressure could be better.',
    response: 'Thank you for the feedback, Sarah! We have a plumber scheduled to address the water pressure. Hope to see you again!',
    responded_at: '2026-03-16T10:00:00Z',
    categories: {
      cleanliness: 5,
      communication: 5,
      check_in: 4,
      accuracy: 4,
      location: 5,
      value: 4,
    },
    status: 'published',
    created_at: '2026-03-15T09:00:00Z',
    updated_at: '2026-03-16T10:00:00Z',
  },
  {
    id: 'REV-003',
    property_id: 'PROP-001',
    booking_id: null,
    guest_id: 'GUEST-003',
    guest_name: 'Mike R.',
    platform: 'vrbo',
    rating: 3,
    comment: 'Decent place but the yard needed mowing and the grill was not clean.',
    response: null,
    responded_at: null,
    categories: {
      cleanliness: 2,
      communication: 4,
      check_in: 4,
      accuracy: 3,
      location: 4,
      value: 3,
    },
    status: 'needs_response',
    created_at: '2026-02-22T11:00:00Z',
    updated_at: '2026-02-22T11:00:00Z',
  },
];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// ── GET /api/reviews ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const propertyId = params.get('property_id');
    const platform = params.get('platform');
    const status = params.get('status');
    const minRating = params.get('min_rating');
    const maxRating = params.get('max_rating');

    let filtered = [...reviews];

    if (propertyId) {
      filtered = filtered.filter((r) => r.property_id === propertyId);
    }
    if (platform) {
      filtered = filtered.filter((r) => r.platform === platform);
    }
    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }
    if (minRating) {
      filtered = filtered.filter((r) => r.rating >= parseInt(minRating, 10));
    }
    if (maxRating) {
      filtered = filtered.filter((r) => r.rating <= parseInt(maxRating, 10));
    }

    const totalRatings = reviews.length;
    const avgRating = totalRatings > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalRatings) * 10) / 10
      : 0;
    const needsResponse = reviews.filter((r) => r.status === 'needs_response').length;

    return NextResponse.json({
      reviews: filtered,
      total: filtered.length,
      summary: {
        avg_rating: avgRating,
        total_reviews: totalRatings,
        needs_response: needsResponse,
        by_platform: {
          direct: reviews.filter((r) => r.platform === 'direct').length,
          airbnb: reviews.filter((r) => r.platform === 'airbnb').length,
          vrbo: reviews.filter((r) => r.platform === 'vrbo').length,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list reviews', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/reviews (import) ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const required = ['property_id', 'guest_name', 'platform', 'rating', 'comment'];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
      return NextResponse.json(
        { error: 'rating must be between 1 and 5' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const review = {
      id: generateId('REV'),
      property_id: body.property_id,
      booking_id: body.booking_id ?? null,
      guest_id: body.guest_id ?? null,
      guest_name: body.guest_name,
      platform: body.platform,
      rating: body.rating,
      comment: body.comment,
      response: null,
      responded_at: null,
      categories: body.categories ?? null,
      status: body.rating <= 3 ? 'needs_response' : 'published',
      created_at: now,
      updated_at: now,
    };

    reviews.push(review);

    return NextResponse.json({ review }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to import review', detail: error.message },
      { status: 500 },
    );
  }
}
