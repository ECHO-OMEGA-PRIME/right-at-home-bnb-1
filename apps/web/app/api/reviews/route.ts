import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  NEEDS_RESPONSE_AT_OR_BELOW,
  listReviews,
  reviewSummary,
  toListContract,
} from '@/lib/reviews';

// Real Review rows (queue #26855). This route held an in-memory array of three
// invented reviews, so the star rating and the "needs response" count on the
// dashboard were fiction -- and an imported review vanished on the next cold
// start.
//
// Worse, /api/reviews/[id]/respond held a SECOND array that disagreed with this
// one, so a posted response updated a record this route had never heard of.
// Both now read the same rows via @/lib/reviews; the field names each route
// publishes are unchanged.

// ── GET /api/reviews ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;

    const rows = await listReviews({
      propertyId: params.get('property_id'),
      platform: params.get('platform'),
      status: params.get('status'),
      minRating: params.get('min_rating'),
      maxRating: params.get('max_rating'),
    });
    const reviews = rows.map(toListContract);

    return NextResponse.json({
      reviews,
      total: reviews.length,
      // Summary spans all reviews, not the filtered subset -- as it always has.
      summary: await reviewSummary(),
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
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    const required = ['property_id', 'guest_name', 'platform', 'rating', 'comment'];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Integer, not just 1..5. `rating: 4.5` passed the range check and then hit
    // Prisma's Int column as an opaque 500 -- the same class of failure the
    // property pre-check below exists to avoid.
    if (
      typeof body.rating !== 'number' ||
      !Number.isInteger(body.rating) ||
      body.rating < 1 ||
      body.rating > 5
    ) {
      return NextResponse.json(
        { error: 'rating must be a whole number between 1 and 5' },
        { status: 400 },
      );
    }

    // Same reasoning: a malformed date became `Invalid Date` and 500'd on write.
    const parseDay = (v: unknown): Date | null | undefined => {
      if (!v) return null;
      const d = new Date(`${v}T00:00:00.000Z`);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    const checkIn = parseDay(body.stay_dates?.check_in);
    const checkOut = parseDay(body.stay_dates?.check_out);
    if (checkIn === undefined || checkOut === undefined) {
      return NextResponse.json(
        { error: 'stay_dates must use YYYY-MM-DD' },
        { status: 400 },
      );
    }

    // Reviews now carry a real foreign key, so a bad property_id has to be
    // caught here -- otherwise it surfaces as an opaque 500 from the database.
    const property = await prisma.property.findUnique({
      where: { id: body.property_id },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json(
        { error: `Property not found: ${body.property_id}` },
        { status: 400 },
      );
    }

    const created = await prisma.review.create({
      data: {
        propertyId: body.property_id,
        bookingId: body.booking_id ?? null,
        guestId: body.guest_id ?? null,
        guestName: body.guest_name,
        platform: body.platform,
        rating: body.rating,
        comment: body.comment,
        categories: body.categories ? JSON.stringify(body.categories) : null,
        checkIn,
        checkOut,
        status: body.rating <= NEEDS_RESPONSE_AT_OR_BELOW ? 'needs_response' : 'published',
      },
    });

    return NextResponse.json({ review: toListContract(created) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to import review', detail: error.message },
      { status: 500 },
    );
  }
}
