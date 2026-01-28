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
import {
  checkForLateCleaners,
  getActiveCleanerAlerts
} from '@/lib/cleaner-monitor';

// Run the late cleaner check
export async function POST(request: NextRequest) {
  console.log('[Monitor API] Running late cleaner check...');

  try {
    // Optional: Check for API key in production
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.MONITOR_API_KEY;

    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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
export async function GET() {
  console.log('[Monitor API] Getting active cleaner alerts...');

  try {
    const alerts = await getActiveCleanerAlerts();

    return NextResponse.json({
      success: true,
      alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('[Monitor API] Error getting alerts:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
