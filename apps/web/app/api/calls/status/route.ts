/**
 * Twilio Call Status Webhook
 * Receives status updates for ongoing calls
 *
 * POST /api/calls/status
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const duration = formData.get('CallDuration') as string;
    const timestamp = formData.get('Timestamp') as string;

    console.log('[Twilio Status]', {
      callSid,
      status: callStatus,
      from,
      to,
      duration,
      timestamp,
    });

    // Handle different call statuses
    switch (callStatus) {
      case 'initiated':
        console.log(`[Call ${callSid}] Call initiated to ${to}`);
        break;

      case 'ringing':
        console.log(`[Call ${callSid}] Ringing...`);
        break;

      case 'answered':
        console.log(`[Call ${callSid}] Answered!`);
        break;

      case 'completed':
        console.log(`[Call ${callSid}] Completed. Duration: ${duration}s`);
        // TODO: Log to database
        break;

      case 'busy':
        console.log(`[Call ${callSid}] Line busy`);
        // TODO: Schedule retry?
        break;

      case 'no-answer':
        console.log(`[Call ${callSid}] No answer`);
        // TODO: Schedule retry or send SMS fallback?
        break;

      case 'failed':
        console.log(`[Call ${callSid}] Call failed`);
        // TODO: Send SMS fallback?
        break;

      case 'canceled':
        console.log(`[Call ${callSid}] Call canceled`);
        break;

      default:
        console.log(`[Call ${callSid}] Unknown status: ${callStatus}`);
    }

    // Twilio expects empty 200 response
    return new NextResponse('', { status: 200 });
  } catch (error) {
    console.error('[Status Webhook Error]', error);
    return new NextResponse('', { status: 200 }); // Still return 200 to prevent retries
  }
}
