/**
 * Emergency Call Acknowledgment Webhook
 * Handles acknowledgment of emergency calls
 *
 * POST /api/calls/emergency-ack
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const digits = formData.get('Digits') as string;
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;

    console.log('[Emergency Ack]', { callSid, digits, from, to });

    const voiceSettings = 'voice="Polly.Matthew" language="en-US"';

    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    if (digits === '1') {
      // Emergency acknowledged
      twiml += `<Say ${voiceSettings}>
        Thank you for acknowledging this emergency.
        You can view full details in the Right at Home app.
        If you need to speak with someone, press 0 now.
        Otherwise, goodbye and please address this issue as soon as possible.
      </Say>`;
      twiml += `<Gather input="dtmf" numDigits="1" action="/api/calls/emergency-callback" method="POST" timeout="5">
        <Say ${voiceSettings}>Press 0 to speak with someone.</Say>
      </Gather>`;

      console.log(`[Emergency ${callSid}] ACKNOWLEDGED by ${to} at ${new Date().toISOString()}`);
      // TODO: Update database with acknowledgment
      // TODO: Send notification to other admins that emergency was acknowledged
    } else {
      // Prompt again
      twiml += `<Gather input="dtmf" numDigits="1" action="/api/calls/emergency-ack" method="POST" timeout="10">
        <Say ${voiceSettings}>Please press 1 to acknowledge this emergency.</Say>
      </Gather>`;
      twiml += `<Say ${voiceSettings}>No response received. We will call again.</Say>`;
    }

    twiml += '</Response>';

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[Emergency Ack Error]', error);

    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Polly.Matthew" language="en-US">
          Emergency acknowledged. Please check the app for details. Goodbye.
        </Say>
      </Response>`;

    return new NextResponse(errorTwiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
