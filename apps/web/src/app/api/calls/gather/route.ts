/**
 * Twilio Call Response Handler
 * Handles DTMF inputs from crash alert calls
 * 
 * Options when called:
 * 1 = Acknowledge + silence 1 hour
 * 2 = Silence until fixed
 * 3 = Escalate to Steven
 */

import { NextRequest, NextResponse } from 'next/server';
import { silenceAlerts, acknowledgeError, getAlertState } from '@/lib/crash-alert';

const STEVEN_PHONE = process.env.STEVEN_PHONE || '+14325591904';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const digits = formData.get('Digits') as string;
    const callSid = formData.get('CallSid') as string;

    console.log(`[Calls/Gather] Received DTMF: ${digits} from call ${callSid}`);

    let response = '';
    const voiceSettings = 'voice="Polly.Matthew" language="en-US"';

    switch (digits) {
      case '1':
        // Acknowledge + silence 1 hour
        silenceAlerts(60);
        const state = getAlertState();
        if (state.errors.length > 0) {
          acknowledgeError(state.errors.length - 1);
        }
        response = `
          <Say ${voiceSettings}>
            Alert acknowledged. Alerts silenced for one hour.
            Check the dashboard for error details.
            Goodbye.
          </Say>
          <Hangup/>
        `;
        break;

      case '2':
        // Silence until fixed (8 hours max)
        silenceAlerts(480);
        response = `
          <Say ${voiceSettings}>
            Alerts silenced until fixed, up to 8 hours maximum.
            Remember to unsilence when the issue is resolved.
            Goodbye.
          </Say>
          <Hangup/>
        `;
        break;

      case '3':
        // Escalate to Steven
        response = `
          <Say ${voiceSettings}>
            Escalating to Steven now. Please hold.
          </Say>
          <Dial callerId="${process.env.TWILIO_PHONE_NUMBER || '+14322248166'}">
            ${STEVEN_PHONE}
          </Dial>
          <Say ${voiceSettings}>
            Steven is unavailable. Please try again later.
          </Say>
          <Hangup/>
        `;
        break;

      default:
        response = `
          <Say ${voiceSettings}>
            Invalid option. Press 1 to acknowledge and silence for one hour.
            Press 2 to silence until fixed.
            Press 3 to escalate to Steven.
          </Say>
          <Gather input="dtmf" numDigits="1" action="/api/calls/gather" method="POST" timeout="10">
            <Say ${voiceSettings}>Please make a selection.</Say>
          </Gather>
          <Say ${voiceSettings}>No input received. Goodbye.</Say>
          <Hangup/>
        `;
    }

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response>${response}</Response>`,
      {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      }
    );
  } catch (error) {
    console.error('[Calls/Gather] Error:', error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response>
        <Say voice="Polly.Matthew">An error occurred. Please try again later.</Say>
        <Hangup/>
      </Response>`,
      {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      }
    );
  }
}
