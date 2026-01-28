/**
 * Twilio Call Status Callback
 * Logs call status changes
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const to = formData.get('To') as string;
    const duration = formData.get('CallDuration');

    console.log(`[Calls/Status] Call ${callSid} to ${to}: ${callStatus}${duration ? ` (${duration}s)` : ''}`);

    // Could store in database for audit trail
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Calls/Status] Error:', error);
    return NextResponse.json({ error: 'Failed to process status' }, { status: 500 });
  }
}
