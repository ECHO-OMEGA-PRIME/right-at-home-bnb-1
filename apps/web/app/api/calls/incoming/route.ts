/**
 * Twilio Incoming Call Webhook
 * Right at Home BnB - AI Phone Answering System
 *
 * When someone calls the RAH Twilio number:
 * 1. Check if AI assistant is enabled and within availability hours
 * 2. Detect emergency keywords for immediate escalation
 * 3. Greet caller as Steven's AI assistant
 * 4. Gather speech input and route to /api/calls/ai-respond
 * 5. Fall back to forwarding to Steven if AI is off or quiet hours
 *
 * POST /api/calls/incoming (Twilio sends POST to webhooks)
 *
 * @author ECHO OMEGA PRIME
 * @owner Steven Palma - Right at Home BnB, Midland, TX
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const STEVEN_PHONE = process.env.STEVEN_PHONE || '+14325591904';
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://rah-midland.com';
const VOICE = 'voice="Polly.Matthew-Neural" language="en-US"';

// Default settings used when DB is unreachable
const FALLBACK_SETTINGS = {
  aiCallsEnabled: false,
  aiAssistantEnabled: true,
  availabilityMode: 'scheduled',
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  emergencyBypass: true,
  emergencyKeywords: ['emergency', 'urgent', 'help', 'fire', 'flood', 'locked out', 'police'],
  aiGreeting: "Hello! You've reached Right at Home B and B in Midland, Texas. I'm Steven's AI assistant. How can I help you today?",
  callForwardNumber: '(432) 559-1904',
  aiEscalateKeywords: ['speak to someone', 'talk to steven', 'real person', 'human', 'manager', 'complaint', 'refund'],
  maxAiTurns: 3,
};

/**
 * Load call routing settings from the database.
 * Merges DB values on top of fallback defaults so every key is always present.
 */
async function getCallSettings(): Promise<typeof FALLBACK_SETTINGS> {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { startsWith: 'callRouting.' } },
    });

    if (rows.length === 0) return { ...FALLBACK_SETTINGS };

    const settings: Record<string, any> = { ...FALLBACK_SETTINGS };
    for (const row of rows) {
      const field = row.key.replace('callRouting.', '');
      try {
        settings[field] = JSON.parse(row.value);
      } catch {
        settings[field] = row.value;
      }
    }
    return settings as typeof FALLBACK_SETTINGS;
  } catch (error) {
    console.error('[Incoming] Failed to load settings:', error);
    return { ...FALLBACK_SETTINGS };
  }
}

/**
 * Determine whether the AI assistant should handle the call right now.
 */
function isAiActive(settings: typeof FALLBACK_SETTINGS): boolean {
  // Master toggles
  if (!settings.aiCallsEnabled && !settings.aiAssistantEnabled) return false;

  if (settings.availabilityMode === 'always') return true;

  if (settings.availabilityMode === 'scheduled' && settings.quietHoursEnabled) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = String(settings.quietHoursStart).split(':').map(Number);
    const [endH, endM] = String(settings.quietHoursEnd).split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Quiet hours span midnight when start > end
    const isQuietHours = startMinutes > endMinutes
      ? currentMinutes >= startMinutes || currentMinutes < endMinutes
      : currentMinutes >= startMinutes && currentMinutes < endMinutes;

    // AI is active DURING quiet hours (when Steven is unavailable)
    return isQuietHours;
  }

  // manual mode or unknown — AI not active
  return false;
}

/**
 * Build TwiML that forwards the call directly to Steven's phone.
 */
function forwardToSteven(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say ${VOICE}>Please hold while I connect you with Steven.</Say>
  <Dial timeout="30" callerId="${process.env.TWILIO_PHONE_NUMBER || '+14322248166'}">
    ${STEVEN_PHONE}
  </Dial>
  <Say ${VOICE}>I'm sorry, Steven is not available right now. Please leave a message after the beep and he will call you back as soon as possible.</Say>
  <Record maxLength="120" transcribe="true" transcribeCallback="${BASE_URL}/api/calls/transcribe" />
  <Say ${VOICE}>Thank you for calling Right at Home B and B. Goodbye!</Say>
</Response>`;
}

/**
 * Build TwiML that greets the caller with the AI assistant and gathers speech.
 */
function aiGreeting(settings: typeof FALLBACK_SETTINGS): string {
  const greeting = settings.aiGreeting ||
    "Hello! You've reached Right at Home B and B in Midland, Texas. I'm Steven's AI assistant. How can I help you today?";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${BASE_URL}/api/calls/ai-respond" method="POST" speechTimeout="auto" speechModel="experimental_conversations" language="en-US" enhanced="true">
    <Say ${VOICE}>${greeting}</Say>
  </Gather>
  <Say ${VOICE}>I didn't catch that. Let me try again.</Say>
  <Gather input="speech" action="${BASE_URL}/api/calls/ai-respond" method="POST" speechTimeout="auto" language="en-US">
    <Say ${VOICE}>Are you still there? How can I help you today?</Say>
  </Gather>
  <Say ${VOICE}>It seems like we're having trouble hearing each other. Let me connect you with Steven directly.</Say>
  <Dial timeout="30" callerId="${process.env.TWILIO_PHONE_NUMBER || '+14322248166'}">
    ${STEVEN_PHONE}
  </Dial>
  <Say ${VOICE}>Steven is not available right now. Please call back during business hours. Thank you and goodbye!</Say>
</Response>`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callerCity = formData.get('CallerCity') as string;
    const callerState = formData.get('CallerState') as string;

    console.log('[Incoming Call]', {
      callSid,
      from,
      to,
      callerCity,
      callerState,
      timestamp: new Date().toISOString(),
    });

    // Load settings
    const settings = await getCallSettings();

    // Check if AI should handle this call
    const aiActive = isAiActive(settings);

    if (!aiActive) {
      console.log(`[Incoming] AI not active, forwarding to Steven. CallSid=${callSid}`);
      return new NextResponse(forwardToSteven(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // AI is active — greet caller and gather speech
    console.log(`[Incoming] AI active, greeting caller. CallSid=${callSid}`);
    return new NextResponse(aiGreeting(settings), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[Incoming Call Error]', error);

    // On any error, forward to Steven so the caller is never stuck
    return new NextResponse(forwardToSteven(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
