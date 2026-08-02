import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { getDashboardStats } from '@/lib/dashboard-stats';
import { isUnrestricted, propertyScopeFor, scopeAllows } from '@/lib/tenant-scope';

// Every figure here used to be fabricated: invented monthly revenue, three
// made-up properties, five made-up bookings and a hardcoded task summary. The
// owner's dashboard was showing numbers nobody could act on (queue #26855).
// It now computes the same response shape from the real database.
//
// It also handed the WHOLE BUSINESS'S REVENUE to anyone with the `worker` role
// (#26919). A role check answered "may this person call this route" and nothing
// answered "what may they see through it" -- so a cleaner could read monthly
// revenue, revenue by month, and portfolio-wide totals.
//
// Financial figures are now STRIPPED for restricted callers -- not scoped down
// to their properties, removed. A cleaner has no business reading revenue for
// the houses they clean either; least privilege means the field should not be
// in the response at all.

/**
 * What a RESTRICTED caller may see. An allowlist, deliberately.
 *
 * I first wrote this as a denylist of financial keys and immediately missed four
 * of them -- avg_booking_value_cents, revenue_by_channel,
 * total_channel_revenue_cents and property_performance -- while believing the
 * leak was closed. A denylist fails OPEN: every field added to DashboardStats
 * later is exposed by default, and nobody notices until it is in someone's
 * hands. An allowlist fails CLOSED, which is the only safe direction here.
 *
 * Excluded on purpose, beyond the obvious revenue fields:
 *   recent_bookings     -- carries guest PII
 *   property_performance-- per-property revenue
 *   occupancy_rate      -- business performance, not needed to clean a house
 */
const RESTRICTED_VISIBLE_KEYS = [
  'period',
  'generated_at',
  'active_bookings',
  'pending_tasks',
  'task_summary',
  'total_bookings_this_month',
  'total_nights_this_month',
];

// ── GET /api/dashboard/stats ───────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const period = request.nextUrl.searchParams.get('period') ?? 'current_month';
    const scope = await propertyScopeFor(auth.user);
    const requestedPropertyId = request.nextUrl.searchParams.get('propertyId');
    if (requestedPropertyId && !scopeAllows(scope, requestedPropertyId)) {
      return NextResponse.json(
        { error: 'Property is outside your assignment scope', code: 'PROPERTY_FORBIDDEN' },
        { status: 403 },
      );
    }

    const effectiveScope = requestedPropertyId ? [requestedPropertyId] : scope;
    const stats = await getDashboardStats(period, effectiveScope);

    if (isUnrestricted(scope)) {
      return NextResponse.json(stats);
    }

    // Build up from nothing rather than deleting from everything. A key absent
    // from the allowlist is absent from the response, including keys that do
    // not exist yet.
    const source = stats as unknown as Record<string, unknown>;
    const visible: Record<string, unknown> = {};
    for (const key of RESTRICTED_VISIBLE_KEYS) {
      if (key in source) visible[key] = source[key];
    }

    return NextResponse.json({
      ...visible,
      scope: 'assigned_properties',
      property_count_in_scope: effectiveScope?.length ?? 0,
      property_ids_in_scope: effectiveScope ?? [],
      // Said out loud, so a restricted caller cannot mistake a partial view for
      // the whole picture.
      note:
        'Financial figures are omitted for this role, and counts cover only your ' +
        'assigned properties.',
    });
  } catch (error) {
    const incidentId = crypto.randomUUID();
    console.error('[dashboard/stats] failed', { incidentId, error });
    return NextResponse.json(
      { error: 'Failed to generate dashboard stats', code: 'DASHBOARD_UNAVAILABLE', incidentId },
      { status: 500 },
    );
  }
}
