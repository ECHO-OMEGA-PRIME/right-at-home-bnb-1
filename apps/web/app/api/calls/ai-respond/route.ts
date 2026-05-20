/**
 * AI Conversation Handler for Incoming Calls
 * Right at Home BnB - AI Phone Answering System
 *
 * Receives speech-to-text from Twilio's <Gather>, runs it through GROQ LLM,
 * and responds with TwiML. Tracks conversation turns and escalates to Steven
 * when the AI can't help or after maxAiTurns.
 *
 * POST /api/calls/ai-respond
 *
 * @author ECHO OMEGA PRIME
 * @owner Steven Palma - Right at Home BnB, Midland, TX
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { echoChat, isEchoLLMConfigured } from '@/lib/echo-llm';

const STEVEN_PHONE = process.env.STEVEN_PHONE || '+14325591904';
// CF Workers AI was the primary AI provider; replaced by Echo SDK gate
// (echo.claude.oauth) per NO-CLOUDFLARE doctrine. GROQ remains as fallback.
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://rah-midland.com';
const VOICE = 'voice="Polly.Matthew-Neural" language="en-US"';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

// Natural follow-up prompts to vary conversation flow
const FOLLOW_UP_PROMPTS = [
  'Is there anything else I can help you with?',
  'What else can I do for you?',
  'Is there anything else you need?',
  'Can I help you with anything else today?',
  'Do you have any other questions?',
  'Anything else on your mind?',
  'Is there something else I can assist with?',
];

const MAX_TURN_PROMPTS = [
  'Is there anything else I can help with, or would you like me to connect you with Steven?',
  'Can I help with anything else, or should I put you through to Steven?',
  'Do you have more questions, or would you prefer to speak with Steven directly?',
  'Anything else I can assist with, or would you like to talk to Steven?',
];

// Emergency keywords — immediate escalation to Steven
const EMERGENCY_KEYWORDS = ['emergency', 'urgent', 'fire', 'flood', 'locked out', 'police', '911', 'help me', 'break in', 'broken into'];

// Escalation keywords — caller wants a human
const ESCALATE_KEYWORDS = [
  'speak to someone', 'talk to steven', 'real person', 'human',
  'manager', 'complaint', 'refund', 'talk to a person',
  'speak to a person', 'get me steven', 'let me talk', 'transfer me',
];

// In-memory conversation tracker (keyed by CallSid)
// In production this would use Redis or a database
const conversationTurns = new Map<string, number>();

/**
 * Load AI-specific settings from the database.
 */
async function getAiSettings(): Promise<{ maxAiTurns: number; escalateKeywords: string[] }> {
  try {
    const rows = await prisma.setting.findMany({
      where: {
        key: { in: ['callRouting.maxAiTurns', 'callRouting.aiEscalateKeywords'] },
      },
    });

    let maxAiTurns = 3;
    let escalateKeywords = ESCALATE_KEYWORDS;

    for (const row of rows) {
      if (row.key === 'callRouting.maxAiTurns') {
        try { maxAiTurns = JSON.parse(row.value); } catch { /* keep default */ }
      }
      if (row.key === 'callRouting.aiEscalateKeywords') {
        try { escalateKeywords = JSON.parse(row.value); } catch { /* keep default */ }
      }
    }

    return { maxAiTurns, escalateKeywords };
  } catch {
    return { maxAiTurns: 3, escalateKeywords: ESCALATE_KEYWORDS };
  }
}

/**
 * Fetch all active properties for the AI knowledge base.
 */
async function getPropertyKnowledge(): Promise<string> {
  try {
    const properties = await prisma.property.findMany({
      where: { status: 'ACTIVE' },
      select: {
        name: true,
        address: true,
        bedrooms: true,
        bathrooms: true,
        maxGuests: true,
        amenities: true,
      },
      orderBy: { name: 'asc' },
    });

    if (properties.length === 0) {
      return 'Right at Home BnB manages multiple short-term rental properties in Midland, Texas.';
    }

    const lines = properties.map((p) => {
      const amenities = p.amenities ? JSON.parse(p.amenities) : [];
      const hasPool = amenities.some((a: string) => a.toLowerCase().includes('pool'));
      const hasHotTub = amenities.some((a: string) => a.toLowerCase().includes('hot tub') || a.toLowerCase().includes('jacuzzi'));
      return `- ${p.name} (${p.address}): ${p.bedrooms}BR/${p.bathrooms}BA, sleeps ${p.maxGuests}${hasPool ? ', has pool' : ''}${hasHotTub ? ', has hot tub' : ''}`;
    });

    return `Right at Home BnB manages ${properties.length} properties in Midland, TX:\n${lines.join('\n')}`;
  } catch {
    return 'Right at Home BnB manages multiple short-term rental properties in Midland, Texas.';
  }
}

/**
 * Build the system prompt for the GROQ LLM with full property knowledge.
 */
async function buildSystemPrompt(): Promise<string> {
  const propertyKnowledge = await getPropertyKnowledge();

  return `You are Steven's AI assistant at Right at Home BnB in Midland, Texas. You help callers with property questions, booking inquiries, check-in/out info, WiFi passwords, directions, and general questions. Be warm, professional, and concise. Keep responses under 3 sentences. You are speaking on the phone so do NOT use markdown, bullet points, or special formatting — speak naturally.

PROPERTY KNOWLEDGE:
${propertyKnowledge}

KEY INFORMATION:
- Check-in time: 4:00 PM
- Check-out time: 11:00 AM
- WiFi: Each property has its own WiFi network. Tell callers to check their welcome message or booking confirmation for property-specific WiFi credentials.
- Smart locks: All properties use smart locks with rotating codes. Access codes are sent via message before check-in.
- Booking inquiries: Direct callers to VRBO.com or the specific property listing to book. We do not take bookings over the phone.
- Cleaning: Professional cleaning is scheduled between every checkout and the next check-in.
- Pet policy: Pet policy varies by property. Some properties are pet-friendly with a pet fee. Callers should check the specific property listing for pet details.
- Emergency contacts: Call 911 for life-threatening emergencies. For property issues, Steven can be reached directly.
- Location: All properties are in Midland, Texas.
- Midland Memorial Hospital: 400 Rosalind Redfern Grover Pkwy, (432) 221-1111
- NextCare Urgent Care: 4519 N Midland Dr, (432) 687-2273

ESCALATION RULES:
If the caller needs any of the following, say "Let me connect you with Steven directly" and nothing else:
- Booking changes or cancellations
- Payment or refund issues
- Complaints or disputes
- Maintenance emergencies (plumbing, electrical, HVAC failures)
- Anything you are not confident answering

Remember: You are on a phone call. Speak naturally, avoid lists or special characters. Use numbers spelled out when helpful (e.g., "four PM" not "4:00 PM").`;
}

/**
 * Call AI API to generate a response.
 * Priority: Echo SDK gate (echo.claude.oauth, $0 Max-OAuth) -> GROQ -> static fallback.
 * Replaced direct Cloudflare Workers AI calls per NO-CLOUDFLARE doctrine.
 */
async function generateAiResponse(userMessage: string, systemPrompt: string): Promise<{ text: string; shouldEscalate: boolean }> {
  const escalationPhrases = ['connect you with steven', 'transfer you to steven', 'let me get steven', 'put you through to steven', 'connect you directly'];

  // Primary: Echo SDK gate (FORGE) via cloudflared tunnel — $0 Max-OAuth path.
  if (isEchoLLMConfigured()) {
    try {
      const result = await echoChat(
        [{ role: 'user', content: userMessage }],
        {
          system: systemPrompt,
          maxTokens: 200,
          temperature: 0.7,
          // Phone calls are latency-sensitive; cap waits short and fall through to GROQ if slow.
          timeoutMs: 12000,
        }
      );
      const aiText = (result.text || '').trim();
      if (aiText) {
        const shouldEscalate = escalationPhrases.some((p) => aiText.toLowerCase().includes(p));
        return { text: aiText, shouldEscalate };
      }
      console.warn('[AI Respond] Echo SDK returned empty text; source=', result.source);
    } catch (echoErr) {
      console.error('[AI Respond] Echo SDK exception:', echoErr);
    }
  }

  // Fallback to GROQ
  if (GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 200,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiText = data.choices?.[0]?.message?.content?.trim() || '';
        if (aiText) {
          const shouldEscalate = escalationPhrases.some(p => aiText.toLowerCase().includes(p));
          return { text: aiText, shouldEscalate };
        }
      }
    } catch (groqErr) {
      console.error('[AI Respond] GROQ exception:', groqErr);
    }
  }

  // No AI provider available
  console.error('[AI Respond] No AI provider available (Echo SDK gate and GROQ both failed)');
  return { text: 'I apologize, but I am having a technical issue right now. Let me connect you with Steven.', shouldEscalate: true };
}


/**
 * Build TwiML to forward the call to Steven.
 */
function connectToSteven(preamble?: string): string {
  const sayPreamble = preamble
    ? `<Say ${VOICE}>${preamble}</Say>`
    : `<Say ${VOICE}>Let me connect you with Steven right now. One moment please.</Say>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayPreamble}
  <Dial timeout="30" callerId="${process.env.TWILIO_PHONE_NUMBER || '+14322248166'}">
    ${STEVEN_PHONE}
  </Dial>
  <Say ${VOICE}>I'm sorry, Steven is not available right now. Please try calling back later or leave a message after the beep.</Say>
  <Record maxLength="120" transcribe="true" transcribeCallback="${BASE_URL}/api/calls/transcribe" />
  <Say ${VOICE}>Thank you for calling Right at Home B and B. Goodbye!</Say>
</Response>`;
}

/**
 * Build TwiML element for AI response — uses <Play> with ElevenLabs TTS if available, else <Say>.
 */
function buildResponseTwiml(text: string): string {
  if (ELEVENLABS_API_KEY) {
    const encoded = Buffer.from(text).toString('base64');
    const ttsUrl = `${BASE_URL}/api/calls/tts?t=${encodeURIComponent(encoded)}`;
    // Use <Play> with ElevenLabs, fall back to <Say> if TTS endpoint fails
    return `<Play>${ttsUrl}</Play>`;
  }
  return `<Say ${VOICE}>${text}</Say>`;
}

/**
 * Build TwiML that says the AI response and gathers the next speech input.
 */
function continueConversation(aiResponse: string, turnCount: number, maxTurns: number): string {
  const responseTwiml = buildResponseTwiml(aiResponse);

  // After maxTurns, offer to connect to Steven
  if (turnCount >= maxTurns) {
    const maxTurnPrompt = MAX_TURN_PROMPTS[turnCount % MAX_TURN_PROMPTS.length];
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${responseTwiml}
  <Gather input="speech" action="${BASE_URL}/api/calls/ai-respond" method="POST" speechTimeout="auto" language="en-US">
    <Say ${VOICE}>${maxTurnPrompt}</Say>
  </Gather>
  <Say ${VOICE}>Thank you for calling Right at Home B and B. Have a wonderful day!</Say>
</Response>`;
  }

  const followUp = FOLLOW_UP_PROMPTS[turnCount % FOLLOW_UP_PROMPTS.length];
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${responseTwiml}
  <Gather input="speech" action="${BASE_URL}/api/calls/ai-respond" method="POST" speechTimeout="auto" language="en-US">
    <Say ${VOICE}>${followUp}</Say>
  </Gather>
  <Say ${VOICE}>It sounds like we're all set. Thank you for calling Right at Home B and B. Have a great day!</Say>
</Response>`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const speechResult = formData.get('SpeechResult') as string;
    const confidence = formData.get('Confidence') as string;
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;

    console.log('[AI Respond]', {
      callSid,
      from,
      speechResult,
      confidence,
      timestamp: new Date().toISOString(),
    });

    // No speech detected
    if (!speechResult || speechResult.trim().length === 0) {
      return new NextResponse(connectToSteven(
        "I wasn't able to hear you clearly. Let me connect you with Steven."
      ), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const spokenText = speechResult.trim().toLowerCase();

    // 1. Check for emergency keywords — immediate transfer
    const isEmergency = EMERGENCY_KEYWORDS.some((kw) => spokenText.includes(kw));
    if (isEmergency) {
      console.log(`[AI Respond] EMERGENCY detected in speech: "${speechResult}". Connecting to Steven immediately.`);
      return new NextResponse(connectToSteven(
        "I understand this is urgent. Let me connect you with Steven right away."
      ), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // 2. Load settings for escalation keywords and max turns
    const { maxAiTurns, escalateKeywords } = await getAiSettings();

    // 3. Check for escalation keywords — caller wants a human
    const wantsHuman = escalateKeywords.some((kw) => spokenText.includes(kw.toLowerCase()));
    if (wantsHuman) {
      console.log(`[AI Respond] Escalation keyword detected: "${speechResult}". Connecting to Steven.`);
      return new NextResponse(connectToSteven(
        "Of course! Let me connect you with Steven right now."
      ), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // 4. Track conversation turns
    const currentTurn = (conversationTurns.get(callSid) || 0) + 1;
    conversationTurns.set(callSid, currentTurn);

    // Clean up old entries periodically (simple memory management)
    if (conversationTurns.size > 1000) {
      const entries = Array.from(conversationTurns.entries());
      const toDelete = entries.slice(0, 500);
      for (const [key] of toDelete) {
        conversationTurns.delete(key);
      }
    }

    // 5. Generate AI response via GROQ
    const systemPrompt = await buildSystemPrompt();
    const { text: aiResponse, shouldEscalate } = await generateAiResponse(speechResult, systemPrompt);

    console.log('[AI Respond] Generated response:', {
      callSid,
      turn: currentTurn,
      aiResponse: aiResponse.substring(0, 100),
      shouldEscalate,
    });

    // 6. If AI decided to escalate, connect to Steven
    if (shouldEscalate) {
      return new NextResponse(connectToSteven(aiResponse), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // 7. Continue the conversation
    // Sanitize AI response for TwiML (remove XML-unsafe chars)
    const sanitizedResponse = aiResponse
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    return new NextResponse(continueConversation(sanitizedResponse, currentTurn, maxAiTurns), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[AI Respond Error]', error);

    // On any error, connect to Steven
    return new NextResponse(connectToSteven(
      "I apologize, I'm experiencing a technical issue. Let me connect you with Steven."
    ), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
