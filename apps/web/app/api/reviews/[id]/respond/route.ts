import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { toRespondContract } from '@/lib/reviews';

// Real Review rows (queue #26855). This route kept its own in-memory array of
// two invented reviews that CONFLICTED with the array in /api/reviews: id
// REV-002 was a 5-star Google review from "Sarah Johnson" here and a 4-star
// Airbnb review from "Sarah J." there. Posting a response updated this copy
// only, so the review stayed unanswered in the list view forever -- and the
// response itself was gone on the next cold start, never having reached the
// platform or the database.
//
// Both routes now read the same rows. The field names this route publishes
// (text / response_text / response_status / stay_dates) are unchanged.

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/reviews/[id]/respond ────────────────────────────────────────
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const review = await prisma.review.findUnique({ where: { id } });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (review.respondedAt) {
      return NextResponse.json(
        {
          error: 'Review already has a response',
          responded_at: review.respondedAt.toISOString(),
        },
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

    const text = body.response_text.trim();

    if (text.length < 10) {
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

    // updateMany with respondedAt:null in the WHERE makes this atomic. The
    // read-then-write version let two concurrent responds both pass the check
    // above, both return 200, and the second silently overwrite the first
    // operator's reply. Caught by Fable in review.
    const claimed = await prisma.review.updateMany({
      where: { id, respondedAt: null },
      data: {
        response: text,
        respondedAt: new Date(),
        // A review flagged for a reply is no longer waiting once answered.
        // Leaving it at needs_response is what would keep the dashboard counter
        // high no matter how many replies were written.
        status: review.status === 'needs_response' ? 'published' : review.status,
      },
    });

    if (claimed.count === 0) {
      // Another request won the race between our read and this write.
      const current = await prisma.review.findUnique({ where: { id } });
      return NextResponse.json(
        {
          error: 'Review already has a response',
          responded_at: current?.respondedAt?.toISOString() ?? null,
        },
        { status: 409 },
      );
    }

    const updated = (await prisma.review.findUnique({ where: { id } }))!;

    return NextResponse.json({
      review: toRespondContract(updated),
      // Honest wording. The response is recorded here; pushing it to Airbnb or
      // VRBO is a separate integration that does not exist yet, and saying
      // "posted to <platform>" would be a claim the operator acts on.
      message:
        `Response recorded for the ${review.platform} review from ${review.guestName}. ` +
        'It is stored here; publishing to the platform is not yet wired up.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to respond to review', detail: error.message },
      { status: 500 },
    );
  }
}
