/**
 * Late Cleaner Monitor API
 * Checks for late cleaners and auto-calls Steven when needed
 *
 * POST /api/monitor/late-cleaners - Run monitor check
 * GET /api/monitor/late-cleaners - Get active alerts
 *
 * This endpoint can be called:
 * 1. By a cron job every 15 minutes
 * 2. Manually from the admin dashboard
 * 3. Via webhook after schedule changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { isUnrestricted, propertyScopeFor, scopeAllows } from '@/lib/tenant-scope';
import {
  checkForLateCleaners,
  getActiveCleanerAlerts
} from '@/lib/cleaner-monitor';

// Run the late cleaner check
export async function POST(request: NextRequest) {
  // Owner/admin only. This handler PLACES PHONE CALLS to Steven's real number.
  // It previously accepted 'worker', so anyone holding a cleaner's session could
  // make the system ring a human, as often as they liked.
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  console.log('[Monitor API] Running late cleaner check...');

  try {
    // Fail CLOSED when MONITOR_API_KEY is not configured.
    //
    // This was `if (apiKey && authHeader !== ...)`, so an unset key skipped the
    // check entirely — the protection disappeared exactly when someone forgot
    // to configure it. /api/cron/monitor already gets this right (`!cronSecret
    // || ...`); this handler is the one that drifted.
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.MONITOR_API_KEY;

    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          detail: apiKey
            ? 'A valid MONITOR_API_KEY bearer token is required.'
            : 'MONITOR_API_KEY is not configured, so this endpoint is disabled. It places live phone calls and will not run unauthenticated.',
        },
        { status: 401 }
      );
    }

    // Run the monitor check
    const result = await checkForLateCleaners();

    console.log('[Monitor API] Check complete:', {
      lateCleaners: result.lateCleaners.length,
      callsMade: result.callsMade,
      errors: result.errors.length
    });

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('[Monitor API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get active cleaner alerts
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  console.log('[Monitor API] Getting active cleaner alerts...');

  try {
    // Property-level isolation (#26919). These alerts name a cleaner, the house
    // they are late to, and by how long. Unscoped, a worker could read the
    // whereabouts and performance of every crew at every property.
    const scope = await propertyScopeFor(auth.user);
    const all = await getActiveCleanerAlerts();
    const alerts = isUnrestricted(scope)
      ? all
      : all.filter((a) => scopeAllows(scope, a.propertyId));

    return NextResponse.json({
      success: true,
      alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('[Monitor API] Error getting alerts:', error);

    // 503, and never an empty `alerts` array. getActiveCleanerAlerts used to
    // swallow a store failure and return [], which this route would have
    // rendered as a cheerful "count: 0" -- indistinguishable from a morning
    // where no cleaner is late. An alerts screen that cannot reach its store
    // must say so, and say it in a way a caller can retry.
    return NextResponse.json(
      {
        success: false,
        error: 'Alert store temporarily unavailable',
        code: 'ALERT_STORE_UNAVAILABLE',
      },
      { status: 503, headers: { 'Retry-After': '30' } }
    );
  }
}
