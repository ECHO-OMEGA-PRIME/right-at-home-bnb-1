/**
 * Reviews -- one source of truth for two response shapes.
 *
 * /api/reviews and /api/reviews/[id]/respond each carried their own in-memory
 * array, and they disagreed: id REV-002 was a 4-star Airbnb review from
 * "Sarah J." in the list route and a 5-star Google review from "Sarah Johnson"
 * in the respond route. Posting a response therefore updated a record the list
 * view had never heard of, and the review stayed unanswered on screen forever.
 *
 * Both routes now read the same Review rows. Their published field names differ
 * (comment/response/status vs text/response_text/response_status) and both are
 * preserved exactly -- the fix is one row underneath, not one contract.
 */

import { prisma } from '@/lib/prisma';

export type ReviewRow = {
  id: string;
  propertyId: string;
  bookingId: string | null;
  guestId: string | null;
  guestName: string;
  platform: string;
  rating: number;
  comment: string;
  response: string | null;
  respondedAt: Date | null;
  categories: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Reviews at or below this rating are flagged for a reply. */
export const NEEDS_RESPONSE_AT_OR_BELOW = 3;

function parseCategories(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // A malformed blob is not worth a 500 on a list endpoint.
    return null;
  }
}

/** Shape used by GET/POST /api/reviews. */
export function toListContract(r: ReviewRow) {
  return {
    id: r.id,
    property_id: r.propertyId,
    booking_id: r.bookingId,
    guest_id: r.guestId,
    guest_name: r.guestName,
    platform: r.platform,
    rating: r.rating,
    comment: r.comment,
    response: r.response,
    responded_at: r.respondedAt ? r.respondedAt.toISOString() : null,
    categories: parseCategories(r.categories),
    status: r.status,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

/** Shape used by POST /api/reviews/[id]/respond. */
export function toRespondContract(r: ReviewRow) {
  return {
    id: r.id,
    booking_id: r.bookingId,
    property_id: r.propertyId,
    guest_id: r.guestId,
    guest_name: r.guestName,
    platform: r.platform,
    rating: r.rating,
    text: r.comment,
    response_text: r.response,
    // Derived from whether a response exists, not stored separately. Two fields
    // that must agree are two fields that will eventually disagree.
    response_status: r.respondedAt ? 'responded' : 'pending',
    stay_dates: {
      check_in: r.checkIn ? r.checkIn.toISOString().slice(0, 10) : null,
      check_out: r.checkOut ? r.checkOut.toISOString().slice(0, 10) : null,
    },
    created_at: r.createdAt.toISOString(),
    responded_at: r.respondedAt ? r.respondedAt.toISOString() : null,
  };
}

export interface ReviewFilters {
  propertyId?: string | null;
  platform?: string | null;
  status?: string | null;
  minRating?: string | null;
  maxRating?: string | null;
}

export async function listReviews(f: ReviewFilters = {}) {
  const where: Record<string, unknown> = {};
  if (f.propertyId) where.propertyId = f.propertyId;
  if (f.platform) where.platform = f.platform;
  if (f.status) where.status = f.status;

  const min = f.minRating ? parseInt(f.minRating, 10) : NaN;
  const max = f.maxRating ? parseInt(f.maxRating, 10) : NaN;
  const rating: Record<string, number> = {};
  if (Number.isFinite(min)) rating.gte = min;
  if (Number.isFinite(max)) rating.lte = max;
  if (Object.keys(rating).length) where.rating = rating;

  return prisma.review.findMany({ where, orderBy: { createdAt: 'desc' } });
}

/**
 * Portfolio-wide summary.
 *
 * Computed over ALL reviews regardless of the caller's filters, which is what
 * the original did: the average rating on screen is the business's rating, not
 * the average of whatever subset is currently displayed.
 */
export async function reviewSummary() {
  const [agg, needsResponse, byPlatformRows] = await Promise.all([
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.count({ where: { status: 'needs_response' } }),
    prisma.review.groupBy({ by: ['platform'], _count: { _all: true } }),
  ]);

  const byPlatform: Record<string, number> = { direct: 0, airbnb: 0, vrbo: 0 };
  for (const row of byPlatformRows) {
    byPlatform[row.platform] = row._count._all;
  }

  return {
    avg_rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
    total_reviews: agg._count._all,
    needs_response: needsResponse,
    by_platform: byPlatform,
  };
}
