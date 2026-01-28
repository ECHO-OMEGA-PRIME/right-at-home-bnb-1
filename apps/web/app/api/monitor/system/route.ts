/**
 * System Monitor API
 * Monitor system health and get/acknowledge alerts
 *
 * GET /api/monitor/system - Get system health and active alerts
 * POST /api/monitor/system - Run system health check manually
 * PATCH /api/monitor/system - Acknowledge an alert
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runSystemHealthCheck,
  getActiveSystemAlerts,
  acknowledgeSystemAlert,
  callCommanderWithSystemStatus,
  flagUpdateNeeded
} from '@/lib/system-monitor';
import { getBusinessContext } from '@/lib/business-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - Get system health and active alerts
export async function GET() {
  console.log('[System Monitor API] Getting system status...');

  try {
    const [context, alerts] = await Promise.all([
      getBusinessContext(),
      getActiveSystemAlerts()
    ]);

    return NextResponse.json({
      success: true,
      status: context.systemHealth.status,
      systemHealth: context.systemHealth,
      activeAlerts: alerts,
      alertCount: alerts.length,
      summary: context.summary
    });
  } catch (error) {
    console.error('[System Monitor API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST - Run system health check or trigger call
export async function POST(request: NextRequest) {
  console.log('[System Monitor API] Processing request...');

  try {
    const body = await request.json();
    const { action, message, critical } = body;

    switch (action) {
      case 'check':
        // Run full system health check
        console.log('[System Monitor API] Running health check...');
        const checkResult = await runSystemHealthCheck();
        return NextResponse.json({
          success: true,
          result: {
            status: checkResult.systemHealth.status,
            issues: checkResult.issues.length,
            callsMade: checkResult.callsMade,
            smsSent: checkResult.smsSent
          },
          issues: checkResult.issues,
          errors: checkResult.errors
        });

      case 'call_commander':
        // Manual call to Commander with system status
        console.log('[System Monitor API] Calling Commander...');
        const callResult = await callCommanderWithSystemStatus();
        return NextResponse.json({
          success: callResult.success,
          callSid: callResult.callSid,
          error: callResult.error
        });

      case 'flag_update':
        // Flag that an update is needed
        if (!message) {
          return NextResponse.json(
            { error: 'Message is required for flagging updates' },
            { status: 400 }
          );
        }
        console.log('[System Monitor API] Flagging update:', message);
        const flagged = await flagUpdateNeeded(message, critical === true);
        return NextResponse.json({
          success: flagged,
          message: flagged ? 'Update flagged successfully' : 'Failed to flag update'
        });

      default:
        // Default: just run the check
        const defaultCheck = await runSystemHealthCheck();
        return NextResponse.json({
          success: true,
          result: {
            status: defaultCheck.systemHealth.status,
            issues: defaultCheck.issues.length,
            callsMade: defaultCheck.callsMade
          }
        });
    }
  } catch (error) {
    console.error('[System Monitor API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PATCH - Acknowledge an alert
export async function PATCH(request: NextRequest) {
  console.log('[System Monitor API] Acknowledging alert...');

  try {
    const body = await request.json();
    const { alertId, acknowledgedBy } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const acknowledged = await acknowledgeSystemAlert(
      alertId,
      acknowledgedBy || 'Commander'
    );

    return NextResponse.json({
      success: acknowledged,
      message: acknowledged ? 'Alert acknowledged' : 'Failed to acknowledge alert'
    });
  } catch (error) {
    console.error('[System Monitor API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
