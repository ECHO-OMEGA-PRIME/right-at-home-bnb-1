/**
 * Emergency Callback Handler
 * Connects caller to Steven when they press 0 after emergency ack
 *
 * POST /api/calls/emergency-callback
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const digits = formData.get('Digits') as string;
    const callSid = formData.get('CallSid') as string;

    console.log('[Emergency Callback]', { callSid, digits });

    const voiceSettings = 'voice="Polly.Matthew" language="en-US"';
    const stevenPhone = process.env.STEVEN_PHONE || '+14325591904';

    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    if (digits === '0') {
      twiml += `<Say ${voiceSettings}>Connecting you to Steven now. Please hold.</Say>`;
      twiml += `<Dial timeout="60" callerId="${process.env.TWILIO_PHONE_NUMBER || '+14322248166'}">
        ${stevenPhone}
      </Dial>`;
      twiml += `<Say ${voiceSettings}>
        We were unable to reach Steven at this time.
        Please try calling directly or check the app for updates.
        Goodbye.
      </Say>`;
      console.log(`[Emergency ${callSid}] Connecting to Steven`);
    } else {
      twiml += `<Say ${voiceSettings}>Thank you. Please address the emergency as soon as possible. Goodbye.</Say>`;
    }

    twiml += '</Response>';

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[Emergency Callback Error]', error);

    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Polly.Matthew" language="en-US">
          Sorry, we couldn't complete your request. Please try calling directly. Goodbye.
        </Say>
      </Response>`;

    return new NextResponse(errorTwiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
