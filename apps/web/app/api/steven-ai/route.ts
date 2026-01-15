/**
 * Right at Home BnB - Steven AI Voice API
 * ========================================
 * Complete AI assistant named "Steven" with:
 * - ElevenLabs v3 Alpha TTS with emotions
 * - Infinite memory via Firebase
 * - Full context on cleaning/maintenance/lawn ops
 * - Wake word detection support
 *
 * @author ECHO OMEGA PRIME
 * @owner Steven Palma - Right at Home BnB, Midland, TX
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateGuestMemory,
  addConversationEntry,
  getGuestSummary,
  extractPreferencesFromConversation,
  getOrCreateSession,
  addSessionMessage,
  type GuestMemory,
  type ConversationEntry,
} from '@/lib/steven-memory';

// API Keys
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// ElevenLabs v3 Alpha Configuration - Steven's Voice
const STEVEN_VOICE_CONFIG = {
  voice_id: process.env.ELEVENLABS_STEVEN_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', // Professional male voice
  model_id: 'eleven_v3_alpha', // Latest v3 Alpha model with emotions
  name: 'Steven',
};

// Emotion Settings for ElevenLabs v3 Alpha
const EMOTION_PRESETS = {
  neutral: {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.3,
    use_speaker_boost: true,
  },
  friendly: {
    stability: 0.4,
    similarity_boost: 0.8,
    style: 0.5,
    use_speaker_boost: true,
  },
  concerned: {
    stability: 0.6,
    similarity_boost: 0.7,
    style: 0.2,
    use_speaker_boost: true,
  },
  excited: {
    stability: 0.3,
    similarity_boost: 0.85,
    style: 0.7,
    use_speaker_boost: true,
  },
  professional: {
    stability: 0.7,
    similarity_boost: 0.6,
    style: 0.1,
    use_speaker_boost: true,
  },
};

// Operations Context - Cleaning, Maintenance, Lawn
const OPERATIONS_CONTEXT = {
  cleaning_crews: {
    active: [
      { name: 'Maria Team', phone: '(432) 555-0101', properties: ['lincoln-green', 'castleford', 'shandon'] },
      { name: 'Quick Clean Pro', phone: '(432) 555-0102', properties: ['haynes', 'garfield', 'chelsea'] },
      { name: 'Sparkle Services', phone: '(432) 555-0103', properties: ['dentcrest', 'douglas', 'storey'] },
    ],
    schedule: {
      turnover: '3 hours before check-in',
      deep_clean: 'Every 4th booking or monthly',
      inspection: 'After each turnover',
    },
    supplies: {
      vendor: 'Costco Business Center',
      restock: 'Weekly on Mondays',
      budget_per_property: 150,
    },
  },
  maintenance: {
    contractors: [
      { name: 'ABC Plumbing', specialty: 'Plumbing', phone: '(432) 555-0201', response_time: '24h' },
      { name: 'Permian Electric', specialty: 'Electrical', phone: '(432) 555-0202', response_time: '24h' },
      { name: 'Cool Air HVAC', specialty: 'HVAC', phone: '(432) 555-0203', response_time: 'Same day' },
      { name: 'Pro Pool Service', specialty: 'Pool/Hot Tub', phone: '(432) 555-0204', response_time: 'Weekly visits' },
      { name: 'HandyMan West TX', specialty: 'General Repairs', phone: '(432) 555-0205', response_time: '48h' },
    ],
    common_issues: ['HVAC filters (monthly)', 'Water heater (annual flush)', 'Smoke detectors (battery check quarterly)'],
    emergency_protocol: 'Call contractor directly, then notify Steven, log in app',
  },
  lawn_workers: {
    companies: [
      { name: 'Green Thumb Midland', phone: '(432) 555-0301', service: 'Full lawn care', schedule: 'Weekly' },
      { name: 'Desert Landscaping', phone: '(432) 555-0302', service: 'Xeriscaping', schedule: 'Bi-weekly' },
    ],
    services: ['Mowing', 'Edging', 'Weed control', 'Seasonal planting', 'Irrigation check'],
    schedule: 'Every Wednesday (high season) / Every other Wednesday (winter)',
  },
  daily_ops: {
    check_in_time: '4:00 PM',
    check_out_time: '11:00 AM',
    early_check_in: 'If previous guest departed, can approve same-day',
    late_check_out: 'If no incoming guest, can approve until 2 PM',
    key_handoff: 'Smart locks with rotating codes',
    security: '24/7 Ring cameras at exterior only',
  },
};

// Note: Guest memory types imported from @/lib/steven-memory
// Firebase is used for persistent storage

// Wake Word Patterns (fuzzy matching)
const WAKE_WORDS = [
  'steven',
  'steven',
  'hey steven',
  'hi steven',
  'okay steven',
  'yo steven',
  'steeven',
  'stevan',
  'stefon',
  'steben',
  'steve',
  'hey steve',
];

interface StevenAIRequest {
  query: string;
  sessionId?: string;
  guestId?: string;
  guestName?: string;
  propertyId?: string;
  voiceEnabled?: boolean;
  emotion?: keyof typeof EMOTION_PRESETS;
  audioInput?: string; // base64 audio for transcription
  includeOpsContext?: boolean;
}

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * POST /api/steven-ai
 * Main chat endpoint with voice, memory, and ops context
 */
export async function POST(request: NextRequest) {
  try {
    const body: StevenAIRequest = await request.json();
    const {
      query,
      sessionId = `steven_${Date.now()}`,
      guestId,
      guestName,
      propertyId,
      voiceEnabled = false,
      emotion = 'friendly',
      includeOpsContext = false,
    } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Check for wake word (for voice transcriptions)
    const hasWakeWord = checkWakeWord(query);

    // Get or create guest memory from Firebase
    let memory: GuestMemory | null = null;
    let guestSummary = '';
    if (guestId) {
      memory = await getOrCreateGuestMemory(guestId, guestName);
      guestSummary = await getGuestSummary(guestId);
      // Extract preferences from this conversation
      await extractPreferencesFromConversation(guestId, query);
    }

    // Get or create session from Firebase
    const session = await getOrCreateSession(sessionId, guestId);
    let history = session.messages;

    // Build system prompt with context
    const systemPrompt = buildStevenSystemPrompt(propertyId, memory, includeOpsContext, guestSummary);
    const messages: ConversationMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: query },
    ];

    // Detect emotion from query context
    const detectedEmotion = detectEmotionFromQuery(query);
    const responseEmotion = detectedEmotion || emotion;

    // Call AI
    const aiResponse = await callStevenAI(messages);

    // Store conversation in Firebase
    const userEntry: ConversationEntry = {
      timestamp: new Date().toISOString(),
      role: 'user',
      content: query,
      context: propertyId,
      propertyId,
      sessionId,
    };
    const assistantEntry: ConversationEntry = {
      timestamp: new Date().toISOString(),
      role: 'assistant',
      content: aiResponse,
      emotion: responseEmotion,
      sessionId,
    };

    // Save to session in Firebase
    await addSessionMessage(sessionId, userEntry);
    await addSessionMessage(sessionId, assistantEntry);

    // Save to guest memory in Firebase if guest exists
    if (guestId) {
      await addConversationEntry(guestId, userEntry);
      await addConversationEntry(guestId, assistantEntry);
    }

    // Generate voice response if enabled
    let audioResponse: { audio_base64?: string; duration_seconds?: number } = {};
    if (voiceEnabled) {
      audioResponse = await generateStevenVoice(aiResponse, responseEmotion);
    }

    return NextResponse.json({
      response: aiResponse,
      sessionId,
      wakeWordDetected: hasWakeWord,
      emotion: responseEmotion,
      ...(audioResponse.audio_base64 && {
        audio: audioResponse.audio_base64,
        audio_format: 'mp3',
        duration_estimate: audioResponse.duration_seconds,
      }),
      memory: memory ? {
        guestId: memory.guestId,
        guestName: memory.guestName,
        vipStatus: memory.vipStatus,
        totalConversations: memory.conversations.length,
        totalStays: memory.stays.length,
      } : null,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Steven AI error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Check for wake word with fuzzy matching
 */
function checkWakeWord(query: string): boolean {
  const normalized = query.toLowerCase().trim();

  // Direct match
  for (const wake of WAKE_WORDS) {
    if (normalized.startsWith(wake) || normalized.includes(wake)) {
      return true;
    }
  }

  // Fuzzy matching - Levenshtein distance
  const words = normalized.split(/\s+/).slice(0, 3);
  for (const word of words) {
    for (const wake of WAKE_WORDS) {
      if (levenshteinDistance(word, wake) <= 2) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Detect emotion from query context
 */
function detectEmotionFromQuery(query: string): keyof typeof EMOTION_PRESETS | null {
  const q = query.toLowerCase();

  if (q.includes('emergency') || q.includes('urgent') || q.includes('problem') || q.includes('broken')) {
    return 'concerned';
  }
  if (q.includes('thank') || q.includes('love') || q.includes('amazing') || q.includes('great')) {
    return 'excited';
  }
  if (q.includes('work') || q.includes('business') || q.includes('schedule') || q.includes('report')) {
    return 'professional';
  }
  if (q.includes('help') || q.includes('question') || q.includes('how') || q.includes('what')) {
    return 'friendly';
  }

  return null;
}

/**
 * Build Steven's system prompt with all context
 */
function buildStevenSystemPrompt(
  propertyId?: string,
  memory?: GuestMemory | null,
  includeOpsContext: boolean = false,
  guestSummary: string = ''
): string {
  let prompt = `You are Steven, the AI assistant for Right at Home BnB in Midland, Texas. You represent Steven Palma's vacation rental business.

YOUR PERSONALITY:
- Warm, friendly, and genuinely helpful - true Texas hospitality
- Professional but personable - like talking to a trusted friend
- Knowledgeable about every property, the local area, and daily operations
- Proactive in anticipating guest needs
- Quick to solve problems and offer solutions
- Remember previous conversations and build relationships

YOUR VOICE:
- Speak naturally, like a helpful concierge
- Use "I" and "we" to feel personal
- Keep responses conversational but informative
- Match the guest's energy and urgency

CONTACT INFO:
- Steven Palma (Owner): (432) 559-1904
- Email: steven@rightathomebnb.com
- Emergency: 911

`;

  // Add guest memory context
  if (memory || guestSummary) {
    prompt += `
GUEST CONTEXT:
${guestSummary || `Guest: ${memory?.guestName || 'Unknown'}`}
${memory ? `
Remember: This guest has interacted with us ${memory.conversations.length} times. Reference past conversations naturally.
` : ''}
`;
  }

  // Add property context
  if (propertyId) {
    prompt += `
CURRENT PROPERTY CONTEXT:
Guest is at or asking about property: ${propertyId}
Provide property-specific information when relevant.

`;
  }

  // Add operations context for staff/admin
  if (includeOpsContext) {
    prompt += `
OPERATIONS CONTEXT (STAFF ACCESS):

CLEANING CREWS:
${OPERATIONS_CONTEXT.cleaning_crews.active.map(c =>
  `- ${c.name}: ${c.phone} (handles: ${c.properties.join(', ')})`
).join('\n')}
Schedule: Turnover ${OPERATIONS_CONTEXT.cleaning_crews.schedule.turnover}
Supplies: ${OPERATIONS_CONTEXT.cleaning_crews.supplies.vendor} (restock ${OPERATIONS_CONTEXT.cleaning_crews.supplies.restock})

MAINTENANCE CONTRACTORS:
${OPERATIONS_CONTEXT.maintenance.contractors.map(c =>
  `- ${c.name} (${c.specialty}): ${c.phone} - Response: ${c.response_time}`
).join('\n')}
Common Issues: ${OPERATIONS_CONTEXT.maintenance.common_issues.join(', ')}
Emergency Protocol: ${OPERATIONS_CONTEXT.maintenance.emergency_protocol}

LAWN CARE:
${OPERATIONS_CONTEXT.lawn_workers.companies.map(c =>
  `- ${c.name}: ${c.phone} (${c.service}) - ${c.schedule}`
).join('\n')}
Services: ${OPERATIONS_CONTEXT.lawn_workers.services.join(', ')}

DAILY OPERATIONS:
- Check-in: ${OPERATIONS_CONTEXT.daily_ops.check_in_time}
- Check-out: ${OPERATIONS_CONTEXT.daily_ops.check_out_time}
- Early Check-in: ${OPERATIONS_CONTEXT.daily_ops.early_check_in}
- Late Check-out: ${OPERATIONS_CONTEXT.daily_ops.late_check_out}
- Security: ${OPERATIONS_CONTEXT.daily_ops.security}

`;
  }

  prompt += `
RESPONSE GUIDELINES:
1. Be helpful and solution-oriented
2. If you don't know something specific, offer to connect them with Steven
3. For emergencies, always provide 911 and relevant contacts first
4. Remember guest preferences and reference them naturally
5. Keep responses concise but complete
6. End with an offer to help further when appropriate`;

  return prompt;
}

/**
 * Call AI for Steven's responses
 */
async function callStevenAI(messages: ConversationMessage[]): Promise<string> {
  if (GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content || getDefaultResponse();
      }
    } catch (error) {
      console.error('Groq API error:', error);
    }
  }

  return getDefaultResponse();
}

/**
 * Get default response when AI unavailable
 */
function getDefaultResponse(): string {
  return `Hey there! I'm having a brief moment, but I'm here to help. For immediate assistance, you can reach Steven directly at (432) 559-1904. Otherwise, let me know what you need and I'll get right on it!`;
}

/**
 * Generate Steven's voice response using ElevenLabs v3 Alpha
 */
async function generateStevenVoice(
  text: string,
  emotion: keyof typeof EMOTION_PRESETS = 'friendly'
): Promise<{ audio_base64?: string; duration_seconds?: number }> {
  if (!ELEVENLABS_API_KEY) {
    console.warn('ElevenLabs API key not configured');
    return {};
  }

  const voiceSettings = EMOTION_PRESETS[emotion];

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${STEVEN_VOICE_CONFIG.voice_id}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: STEVEN_VOICE_CONFIG.model_id,
          voice_settings: voiceSettings,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error:', response.status, errorText);
      return {};
    }

    const audioBuffer = await response.arrayBuffer();
    const audio_base64 = Buffer.from(audioBuffer).toString('base64');

    // Estimate duration (~150 words/minute)
    const wordCount = text.split(/\s+/).length;
    const duration_seconds = (wordCount / 150) * 60;

    return { audio_base64, duration_seconds };
  } catch (error) {
    console.error('Voice generation error:', error);
    return {};
  }
}

/**
 * GET /api/steven-ai
 * API status and capabilities
 */
export async function GET() {
  return NextResponse.json({
    name: 'Steven AI',
    version: '1.0.0',
    status: 'Active',
    capabilities: [
      'Natural conversation with memory',
      'ElevenLabs v3 Alpha voice synthesis',
      'Emotional voice modulation',
      'Wake word detection (fuzzy matching)',
      'Guest memory and preferences',
      'Property-specific context',
      'Operations context (cleaning, maintenance, lawn)',
      'VIP guest recognition',
    ],
    emotions: Object.keys(EMOTION_PRESETS),
    wakeWords: WAKE_WORDS.slice(0, 5),
    voiceConfig: {
      model: STEVEN_VOICE_CONFIG.model_id,
      name: STEVEN_VOICE_CONFIG.name,
    },
    operationsAccess: {
      cleaningCrews: OPERATIONS_CONTEXT.cleaning_crews.active.length,
      maintenanceContractors: OPERATIONS_CONTEXT.maintenance.contractors.length,
      lawnCompanies: OPERATIONS_CONTEXT.lawn_workers.companies.length,
    },
  });
}
