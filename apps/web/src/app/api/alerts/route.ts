/**
 * Alert Management API
 * View and manage crash alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getAlertState, 
  silenceAlerts, 
  unsilenceAlerts, 
  isAlertsSilenced,
  clearErrors,
  acknowledgeError,
  triggerCrashAlert,
  healthCheck 
} from '@/lib/crash-alert';

// GET - Get current alert state
export async function GET(request: NextRequest) {
  const state = getAlertState();
  const silenced = isAlertsSilenced();
  
  return NextResponse.json({
    silenced,
    silencedUntil: state.silencedUntil ? new Date(state.silencedUntil).toISOString() : null,
    alertCount: state.alertCount,
    recentErrors: state.errors.slice(-20).reverse(),
    unacknowledgedCount: state.errors.filter(e => !e.acknowledged).length
  });
}

// POST - Manage alerts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, durationMinutes, errorIndex } = body;

    switch (action) {
      case 'silence':
        silenceAlerts(durationMinutes || 60);
        return NextResponse.json({ 
          success: true, 
          message: `Alerts silenced for ${durationMinutes || 60} minutes` 
        });

      case 'unsilence':
        unsilenceAlerts();
        return NextResponse.json({ 
          success: true, 
          message: 'Alerts unsilenced' 
        });

      case 'acknowledge':
        if (typeof errorIndex === 'number') {
          acknowledgeError(errorIndex);
          return NextResponse.json({ 
            success: true, 
            message: `Error ${errorIndex} acknowledged` 
          });
        }
        return NextResponse.json({ 
          success: false, 
          error: 'errorIndex required' 
        }, { status: 400 });

      case 'clear':
        clearErrors();
        return NextResponse.json({ 
          success: true, 
          message: 'Error history cleared' 
        });

      case 'test':
        // Test the alert system
        await triggerCrashAlert({
          severity: 'high',
          errorType: 'TEST_ALERT',
          message: 'This is a test alert from the dashboard',
          callCommander: body.callCommander ?? false,
          sendSMSAlert: body.sendSMS ?? true
        });
        return NextResponse.json({ 
          success: true, 
          message: 'Test alert triggered' 
        });

      case 'health':
        const health = await healthCheck();
        return NextResponse.json(health);

      default:
        return NextResponse.json({ 
          error: 'Unknown action. Valid: silence, unsilence, acknowledge, clear, test, health' 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[Alerts API] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to process request' 
    }, { status: 500 });
  }
}
