/**
 * Twilio DTMF Gather Webhook
 * Handles keypad input during calls
 *
 * POST /api/calls/gather
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const digits = formData.get('Digits') as string;
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;

    console.log('[Twilio Gather]', { callSid, digits, from });

    // Voice settings
    const voiceSettings = 'voice="Polly.Matthew" language="en-US"';

    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    switch (digits) {
      case '1':
        // Confirmed
        twiml += `<Say ${voiceSettings}>Thank you for confirming. We've recorded your response. Have a great day!</Say>`;
        console.log(`[Call ${callSid}] User confirmed (pressed 1)`);
        // TODO: Update database with confirmation
        break;

      case '2':
        // Reschedule requested
        twiml += `<Say ${voiceSettings}>
          You've requested to reschedule. Someone from our team will contact you shortly to arrange a new time.
          Thank you for letting us know. Goodbye!
        </Say>`;
        console.log(`[Call ${callSid}] User requested reschedule (pressed 2)`);
        // TODO: Create reschedule task
        break;

      case '9':
        // Repeat menu
        twiml += `<Say ${voiceSettings}>Press 1 to confirm, or press 2 to reschedule.</Say>`;
        twiml += `<Gather input="dtmf" numDigits="1" action="/api/calls/gather" method="POST" timeout="10">
          <Say ${voiceSettings}>We're waiting for your response.</Say>
        </Gather>`;
        break;

      case '0':
        // Speak to someone
        twiml += `<Say ${voiceSettings}>Please hold while we connect you with our team.</Say>`;
        twiml += `<Dial timeout="30">+14325591904</Dial>`;
        twiml += `<Say ${voiceSettings}>We're sorry, no one is available right now. Please call back later. Goodbye!</Say>`;
        break;

      default:
        // Invalid input
        twiml += `<Say ${voiceSettings}>Sorry, that wasn't a valid option.</Say>`;
        twiml += `<Gather input="dtmf" numDigits="1" action="/api/calls/gather" method="POST" timeout="10">
          <Say ${voiceSettings}>Press 1 to confirm, 2 to reschedule, or 0 to speak with someone.</Say>
        </Gather>`;
        twiml += `<Say ${voiceSettings}>No response received. Goodbye!</Say>`;
    }

    twiml += '</Response>';

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[Gather Webhook Error]', error);

    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Polly.Matthew" language="en-US">
          Sorry, we encountered an error. Please try calling us directly. Goodbye!
        </Say>
      </Response>`;

    return new NextResponse(errorTwiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
