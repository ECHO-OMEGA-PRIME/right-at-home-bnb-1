/**
 * Phone Call API - Right at Home BnB
 * Make outbound calls with AI Steven
 *
 * POST /api/calls - Make a call
 * GET /api/calls - List recent calls (TODO: implement with database)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  makeCall,
  sendSMS,
  CallRequest,
  CallType,
  formatPhone,
  isValidPhone,
} from '@/lib/twilio';

// POST - Make a call
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      to,
      type,
      propertyName,
      propertyId,
      cleanerName,
      guestName,
      message,
      scheduledTime,
      urgency,
      smsOnly,
    } = body;

    // Validate phone number
    if (!to) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    if (!isValidPhone(to)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Validate call type
    const validTypes: CallType[] = [
      'status_update',
      'cleaning_reminder',
      'cleaning_complete',
      'emergency',
      'guest_checkin',
      'guest_checkout',
      'maintenance',
      'custom',
    ];

    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid call type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhone(to);

    const callRequest: CallRequest = {
      to: formattedPhone,
      type,
      propertyName,
      propertyId,
      cleanerName,
      guestName,
      message,
      scheduledTime,
      urgency: urgency || 'normal',
    };

    // SMS only mode
    if (smsOnly) {
      let smsMessage = message || `You have a ${type.replace(/_/g, ' ')} notification`;
      if (propertyName) {
        smsMessage += ` for ${propertyName}`;
      }

      const result = await sendSMS(formattedPhone, smsMessage);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send SMS' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: 'sms',
        messageSid: result.callSid,
        status: result.status,
      });
    }

    // Make the call
    const result = await makeCall(callRequest);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to make call' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: 'call',
      callSid: result.callSid,
      status: result.status,
      to: formattedPhone,
      type,
    });
  } catch (error) {
    console.error('[API] Call error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - List recent calls (placeholder - would need database)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    calls: [],
    message: 'Call history coming soon - requires database integration',
  });
}
