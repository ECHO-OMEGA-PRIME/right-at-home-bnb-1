/**
 * Context-Aware Call API
 * Make calls with full business context
 *
 * POST /api/calls/context-call
 *
 * AI Steven will have complete awareness of:
 * - System health
 * - Who's logged in
 * - Today's check-ins/check-outs
 * - Late cleaners
 * - Active alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  contextCallSteven,
  contextCallCommander,
  makeContextAwareCall,
  dailyBriefingCall
} from '@/lib/twilio';
import { getBusinessContext } from '@/lib/business-context';

export async function POST(request: NextRequest) {
  console.log('[Context Call API] Processing request...');

  try {
    const body = await request.json();
    const {
      recipient,  // 'steven', 'commander', or phone number
      reason,     // 'status_update', 'emergency', 'daily_briefing'
    } = body;

    // Validate
    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient is required' },
        { status: 400 }
      );
    }

    const callReason = reason || 'status_update';
    let result;

    // Route to appropriate function
    switch (recipient.toLowerCase()) {
      case 'steven':
        console.log(`[Context Call API] Calling Steven - ${callReason}`);
        result = await contextCallSteven(callReason);
        break;

      case 'commander':
      case 'bob':
        console.log(`[Context Call API] Calling Commander - ${callReason}`);
        result = await contextCallCommander(callReason);
        break;

      case 'daily_briefing':
        console.log('[Context Call API] Daily briefing call');
        result = await dailyBriefingCall();
        break;

      default:
        // Direct phone number
        if (recipient.match(/^\+?\d{10,15}$/)) {
          console.log(`[Context Call API] Calling ${recipient} - ${callReason}`);
          result = await makeContextAwareCall(recipient, callReason);
        } else {
          return NextResponse.json(
            { error: 'Invalid recipient. Use "steven", "commander", or a phone number' },
            { status: 400 }
          );
        }
    }

    console.log('[Context Call API] Call result:', result);

    return NextResponse.json({
      success: result.success,
      callSid: result.callSid,
      status: result.status,
      error: result.error
    });
  } catch (error) {
    console.error('[Context Call API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - Return current business context (for debugging/display)
export async function GET() {
  console.log('[Context Call API] Getting business context...');

  try {
    const context = await getBusinessContext();

    return NextResponse.json({
      success: true,
      context: {
        generatedAt: context.generatedAt,
        summary: context.summary,
        systemHealth: context.systemHealth,
        activeUsersCount: context.activeUsers.length,
        todayCheckInsCount: context.todayCheckIns.length,
        todayCheckOutsCount: context.todayCheckOuts.length,
        lateCleanersCount: context.lateCleaners.length,
        alertsCount: context.alerts.length,
        // Include details for dashboard
        todayCheckIns: context.todayCheckIns.map(r => ({
          guestName: r.guestName,
          propertyName: r.propertyName,
          checkIn: r.checkIn
        })),
        todayCheckOuts: context.todayCheckOuts.map(r => ({
          guestName: r.guestName,
          propertyName: r.propertyName,
          checkOut: r.checkOut
        })),
        lateCleaners: context.lateCleaners.map(c => ({
          cleanerName: c.cleanerName,
          propertyName: c.propertyName,
          hoursLate: c.hoursLate
        }))
      }
    });
  } catch (error) {
    console.error('[Context Call API] Error getting context:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
