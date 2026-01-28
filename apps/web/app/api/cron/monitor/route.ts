/**
 * Cron Job - System & Cleaner Monitor
 * Runs every 15 minutes via Vercel Cron
 *
 * GET /api/cron/monitor
 *
 * Checks:
 * 1. Late cleaners - auto-calls Steven
 * 2. System health - auto-calls Commander if something breaks
 * 3. Unacknowledged alerts - auto-calls after timeout
 *
 * Vercel cron config in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/monitor",
 *     "schedule": "0,15,30,45 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkForLateCleaners } from '@/lib/cleaner-monitor';
import { runSystemHealthCheck } from '@/lib/system-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('[Cron Monitor] Running scheduled check...');

  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In production, verify the cron secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Cron Monitor] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const errors: string[] = [];

  // Results from both monitors
  let cleanerResult = null;
  let systemResult = null;

  // 1. Check for late cleaners (calls Steven)
  try {
    console.log('[Cron Monitor] Checking for late cleaners...');
    cleanerResult = await checkForLateCleaners();
    console.log('[Cron Monitor] Cleaner check complete:', {
      lateCleaners: cleanerResult.lateCleaners.length,
      callsMade: cleanerResult.callsMade
    });
  } catch (error) {
    const errorMsg = `Cleaner monitor failed: ${error instanceof Error ? error.message : 'Unknown'}`;
    errors.push(errorMsg);
    console.error('[Cron Monitor]', errorMsg);
  }

  // 2. Check system health (calls Commander if something breaks)
  try {
    console.log('[Cron Monitor] Running system health check...');
    systemResult = await runSystemHealthCheck();
    console.log('[Cron Monitor] System check complete:', {
      status: systemResult.systemHealth.status,
      issues: systemResult.issues.length,
      callsMade: systemResult.callsMade
    });
  } catch (error) {
    const errorMsg = `System monitor failed: ${error instanceof Error ? error.message : 'Unknown'}`;
    errors.push(errorMsg);
    console.error('[Cron Monitor]', errorMsg);
  }

  const duration = Date.now() - startTime;

  console.log('[Cron Monitor] All checks complete:', {
    duration: `${duration}ms`,
    errors: errors.length
  });

  return NextResponse.json({
    success: errors.length === 0,
    checkedAt: new Date().toISOString(),
    duration: `${duration}ms`,
    cleaner: cleanerResult ? {
      lateCleaners: cleanerResult.lateCleaners.length,
      alertsCreated: cleanerResult.alertsCreated,
      callsMade: cleanerResult.callsMade,
      smsSent: cleanerResult.smsSent,
      errors: cleanerResult.errors.length
    } : null,
    system: systemResult ? {
      status: systemResult.systemHealth.status,
      issues: systemResult.issues.length,
      callsMade: systemResult.callsMade,
      smsSent: systemResult.smsSent,
      errors: systemResult.errors.length
    } : null,
    errors
  });
}
