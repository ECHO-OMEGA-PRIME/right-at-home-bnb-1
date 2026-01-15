/**
 * Right at Home BnB - AI Concierge API
 * ====================================
 * Complete AI Concierge endpoints with streaming and voice support.
 *
 * Endpoints:
 * - POST /api/concierge - Chat endpoint (streaming or regular)
 * - POST /api/concierge?voice=true - Voice response endpoint
 * - GET /api/concierge - API status and capabilities
 *
 * @author ECHO OMEGA PRIME
 * @owner Steven Palma - Right at Home BnB, Midland, TX
 */

import { NextRequest, NextResponse } from 'next/server';

// API Keys
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// ElevenLabs Voice Configuration
const VOICE_CONFIG = {
  concierge: {
    voice_id: '21m00Tcm4TlvDq8ikWAM', // Rachel - Professional, warm
    name: 'Rachel',
  },
  friendly: {
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Bella - Casual
    name: 'Bella',
  },
  texas: {
    voice_id: 'TxGEqnHWrfWFTfGW9XjX', // Josh - Southern
    name: 'Josh',
  },
};

// Property Knowledge Base
const PROPERTIES: Record<string, PropertyInfo> = {
  'dentcrest': {
    name: 'Dentcrest Den',
    address: '4201 Dentcrest Dr',
    bedrooms: 3,
    bathrooms: 2,
    sleeps: 8,
    amenities: ['WiFi', 'Full Kitchen', 'Washer/Dryer', 'TV', 'Parking'],
    wifi: { network: 'RightAtHome_Dentcrest', password: 'Welcome2Midland' },
    door_code: '4201',
    rules: ['No smoking', 'No parties', 'Quiet hours 10pm-7am'],
    features: ['Great for work crews', 'Close to oil field access roads'],
  },
  'haynes': {
    name: 'Haynes Haven',
    address: '3405 Haynes Dr',
    bedrooms: 4,
    bathrooms: 2,
    sleeps: 10,
    amenities: ['WiFi', 'Full Kitchen', 'Washer/Dryer', 'TV', 'Parking', 'Large Backyard'],
    wifi: { network: 'RightAtHome_Haynes', password: 'Welcome2Midland' },
    door_code: '3405',
    rules: ['No smoking', 'No parties', 'Quiet hours 10pm-7am'],
    features: ['Family-friendly', 'Large backyard for kids'],
  },
  'garfield': {
    name: 'Garfield Getaway',
    address: '2702 N Garfield',
    bedrooms: 3,
    bathrooms: 2,
    sleeps: 6,
    amenities: ['WiFi', 'Full Kitchen', 'Washer/Dryer', 'TV', 'HOT TUB', 'Parking'],
    wifi: { network: 'RightAtHome_Garfield', password: 'Welcome2Midland' },
    door_code: '2702',
    rules: ['No smoking', 'No parties', 'No glass near hot tub', 'Hot tub hours 8am-10pm'],
    features: ['Hot tub', 'Romantic getaway', 'Quiet neighborhood'],
  },
  'shandon': {
    name: 'Shandon Sanctuary',
    address: '4600 Shandon Ave',
    bedrooms: 4,
    bathrooms: 3,
    sleeps: 10,
    amenities: ['WiFi', 'Full Kitchen', 'Washer/Dryer', 'TV', 'POOL', 'Parking', 'Grill'],
    wifi: { network: 'RightAtHome_Shandon', password: 'Welcome2Midland' },
    door_code: '4600',
    rules: ['No smoking', 'No parties', 'No glass in pool area', 'Pool hours 8am-10pm', 'Supervise children'],
    features: ['Swimming pool', 'Great for families', 'BBQ grill'],
  },
  'castleford': {
    name: 'Castleford Castle',
    address: '5001 Castleford Rd',
    bedrooms: 5,
    bathrooms: 4,
    sleeps: 14,
    amenities: ['WiFi', 'Full Kitchen', 'Washer/Dryer', 'TV', 'POOL', 'HOT TUB', 'Game Room', 'Parking'],
    wifi: { network: 'RightAtHome_Castleford', password: 'Welcome2Midland' },
    door_code: '5001',
    rules: ['No smoking', 'No parties over 14 guests', 'No glass near pool/hot tub', 'Pool hours 8am-10pm'],
    features: ['Premium property', 'Pool AND hot tub', 'Game room with billiards', 'Perfect for large groups'],
  },
  'lincoln_green': {
    name: 'Lincoln Green Estate',
    address: '5055 Lincoln Green',
    bedrooms: 6,
    bathrooms: 4,
    sleeps: 18,
    amenities: ['WiFi', 'Full Kitchen', 'Washer/Dryer', 'TV', 'POOL', 'Pool Cabana', 'Playground', 'Fire Pit', 'Parking'],
    wifi: { network: 'RightAtHome_LincolnGreen', password: 'Welcome2Midland' },
    door_code: '5055',
    rules: ['No smoking', 'No parties over 20 guests', 'No glass near pool', 'Pool hours 8am-10pm', 'Fire pit supervision required'],
    features: ['FLAGSHIP property', 'Sleeps 18', 'Pool cabana', 'Kids playground', 'Fire pit', 'Perfect for reunions'],
  },
  'chelsea': {
    name: 'Chelsea Chalet',
    address: '3210 Chelsea Ln',
    bedrooms: 3,
    bathrooms: 2,
    sleeps: 6,
    amenities: ['WiFi', 'Full Kitchen', 'Washer/Dryer', 'TV', 'HOT TUB', 'Fireplace', 'Parking'],
    wifi: { network: 'RightAtHome_Chelsea', password: 'Welcome2Midland' },
    door_code: '3210',
    rules: ['No smoking', 'No parties', 'No glass near hot tub'],
    features: ['Cozy retreat', 'Hot tub', 'Fireplace', 'Romantic couples getaway'],
  },
  'neely': {
    name: 'Neely Nest',
    address: '2801 Neely Ave',
    bedrooms: 4,
    bathrooms: 2,
    sleeps: 10,
    amenities: ['WiFi', 'Full Kitchen', 'Washer/Dryer', 'TV', 'Parking', 'Fenced Yard'],
    wifi: { network: 'RightAtHome_Neely', password: 'Welcome2Midland' },
    door_code: '2801',
    rules: ['No smoking', 'No parties', 'Quiet hours 10pm-7am'],
    features: ['Pet-friendly', 'Fenced yard', 'Great for families'],
  },
  'cuthbert': {
    name: 'Cuthbert Cottage',
    address: '1907 Cuthbert Ave',
    bedrooms: 2,
    bathrooms: 1,
    sleeps: 4,
    amenities: ['WiFi', 'Full Kitchen', 'Washer/Dryer', 'TV', 'Parking'],
    wifi: { network: 'RightAtHome_Cuthbert', password: 'Welcome2Midland' },
    door_code: '1907',
    rules: ['No smoking', 'No parties', 'Quiet hours 10pm-7am'],
    features: ['Cozy cottage', 'Perfect for couples', 'Budget-friendly'],
  },
  'stanolind': {
    name: 'Stanolind Station',
    address: '3002 Stanolind Ave',
    bedrooms: 4,
    bathrooms: 2,
    sleeps: 8,
    amenities: ['WiFi', 'Full Kitchen', 'Washer/Dryer', 'TV', 'Parking', 'Workshop Area'],
    wifi: { network: 'RightAtHome_Stanolind', password: 'Welcome2Midland' },
    door_code: '3002',
    rules: ['No smoking', 'No parties', 'Workshop use at your own risk'],
    features: ['Workshop area', 'Great for work crews', 'Truck parking'],
  },
};

interface PropertyInfo {
  name: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  sleeps: number;
  amenities: string[];
  wifi: { network: string; password: string };
  door_code: string;
  rules: string[];
  features: string[];
}

// Restaurant Knowledge Base
const RESTAURANTS = {
  fine_dining: [
    { name: 'The Garlic Press', cuisine: 'American/Steakhouse', price: '$$$$', notes: 'Best steaks in Midland' },
    { name: "Cork & Pig Tavern", cuisine: 'American', price: '$$$', notes: 'Great wine selection' },
    { name: 'Wall Street Bar & Grill', cuisine: 'American', price: '$$$', notes: 'Business lunch favorite' },
  ],
  casual: [
    { name: 'Basin Burger House', cuisine: 'Burgers', price: '$$', notes: 'Gourmet burgers, local beers' },
    { name: 'Blue Door Cafe', cuisine: 'American', price: '$$', notes: 'Home-style cooking' },
    { name: 'The Way Back', cuisine: 'Sandwiches', price: '$$', notes: 'Great for lunch' },
  ],
  tex_mex: [
    { name: "Gerardo's Casita", cuisine: 'Tex-Mex', price: '$$', notes: 'Best fajitas in town' },
    { name: 'La Bodega', cuisine: 'Mexican', price: '$$', notes: 'Authentic Mexican' },
    { name: 'Rosa\'s Cafe', cuisine: 'Tex-Mex', price: '$', notes: 'Fast, affordable' },
  ],
  bbq: [
    { name: 'KD\'s Bar-B-Q', cuisine: 'BBQ', price: '$$', notes: 'Legendary brisket' },
    { name: "Sloan's BBQ", cuisine: 'BBQ', price: '$$', notes: 'Family-owned since 1978' },
  ],
  late_night: [
    { name: 'Whataburger', cuisine: 'Fast Food', price: '$', notes: '24 hours - Texas institution' },
    { name: "Denny's", cuisine: 'Diner', price: '$', notes: '24 hours' },
    { name: 'IHOP', cuisine: 'Breakfast', price: '$', notes: '24 hours' },
  ],
  brunch: [
    { name: 'Mulberry Cafe', cuisine: 'Cafe', price: '$$', notes: 'Best brunch spot' },
    { name: 'Eggs Up Grill', cuisine: 'Breakfast', price: '$$', notes: 'Weekend brunch' },
  ],
};

const EMERGENCY_INFO = {
  host: {
    name: 'Steven Palma',
    phone: '(432) 559-1904',
    email: 'steven@rightathomebnb.com',
  },
  emergency: '911',
  police_non_emergency: '(432) 685-7108',
  hospital: {
    name: 'Midland Memorial Hospital',
    address: '400 Rosalind Redfern Grover Pkwy',
    phone: '(432) 221-1111',
  },
  urgent_care: {
    name: 'NextCare Urgent Care',
    address: '4519 N Midland Dr',
    phone: '(432) 687-2273',
    hours: '8am-8pm daily',
  },
  poison_control: '1-800-222-1222',
};

// Interfaces
interface ConciergeRequest {
  query: string;
  sessionId?: string;
  propertyId?: string;
  guestType?: 'work_crew' | 'family' | 'couple' | 'business' | 'general';
  stream?: boolean;
  voice?: string;
}

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Session storage (in production, use Redis or database)
const sessions = new Map<string, ConversationMessage[]>();

/**
 * POST /api/concierge
 * Main chat endpoint with optional streaming and voice
 */
export async function POST(request: NextRequest) {
  try {
    const body: ConciergeRequest = await request.json();
    const {
      query,
      sessionId = `session_${Date.now()}`,
      propertyId,
      guestType = 'general',
      stream = false,
      voice,
    } = body;

    // Check if voice response is requested via query param
    const isVoiceRequest = request.nextUrl.searchParams.get('voice') === 'true' || !!voice;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Build system prompt with property context
    const systemPrompt = buildSystemPrompt(propertyId, guestType);

    // Get or create conversation history
    let history = sessions.get(sessionId) || [];
    if (history.length === 0) {
      history.push({ role: 'system', content: systemPrompt });
    }

    // Add user message
    history.push({ role: 'user', content: query });

    // Detect intent for response routing
    const intent = detectIntent(query);

    // Handle streaming response
    if (stream && !isVoiceRequest) {
      return handleStreamingResponse(history, sessionId, intent, guestType);
    }

    // Get AI response
    const aiResponse = await callLLM(history);

    // Add assistant response to history
    history.push({ role: 'assistant', content: aiResponse });

    // Keep only last 20 messages to prevent context overflow
    if (history.length > 21) {
      history = [history[0], ...history.slice(-20)];
    }
    sessions.set(sessionId, history);

    // Handle voice response
    if (isVoiceRequest) {
      const audioResponse = await generateVoiceResponse(aiResponse, voice || 'concierge');
      if (audioResponse.success) {
        return NextResponse.json({
          response: aiResponse,
          audio: audioResponse.audio_base64,
          audio_format: 'mp3',
          duration_estimate: audioResponse.duration_seconds,
          intent,
          sessionId,
          guestType,
        });
      }
      // Fall through to text response if voice fails
    }

    return NextResponse.json({
      response: aiResponse,
      intent,
      sessionId,
      guestType,
      data: {
        intent,
        propertyId,
        hasPropertyContext: !!propertyId,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Concierge API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: errorMessage,
        response: `I apologize, I'm having trouble right now. For immediate assistance, please contact Steven directly at ${EMERGENCY_INFO.host.phone}.`,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle streaming SSE response
 */
async function handleStreamingResponse(
  messages: ConversationMessage[],
  sessionId: string,
  intent: string,
  guestType: string
): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial metadata
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', sessionId, intent, guestType })}\n\n`));

        // Try Groq first for streaming
        if (GROQ_API_KEY) {
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
              stream: true,
            }),
          });

          if (response.ok && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n').filter(line => line.trim() !== '');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') continue;

                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    if (content) {
                      fullResponse += content;
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`));
                    }
                  } catch {
                    // Skip invalid JSON
                  }
                }
              }
            }

            // Update session with full response
            messages.push({ role: 'assistant', content: fullResponse });
            if (messages.length > 21) {
              messages.splice(1, messages.length - 21);
            }
            sessions.set(sessionId, messages);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', fullResponse })}\n\n`));
            controller.close();
            return;
          }
        }

        // Fallback to non-streaming if streaming fails
        const fallbackResponse = await callLLM(messages);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: fallbackResponse })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', fullResponse: fallbackResponse })}\n\n`));
        controller.close();

      } catch (error) {
        console.error('Streaming error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Generate voice response using ElevenLabs
 */
async function generateVoiceResponse(
  text: string,
  voice: string = 'concierge'
): Promise<{ success: boolean; audio_base64?: string; duration_seconds?: number; error?: string }> {
  if (!ELEVENLABS_API_KEY) {
    return { success: false, error: 'ElevenLabs API key not configured' };
  }

  const voiceConfig = VOICE_CONFIG[voice as keyof typeof VOICE_CONFIG] || VOICE_CONFIG.concierge;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voice_id}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audio_base64 = Buffer.from(audioBuffer).toString('base64');

    // Estimate duration (~150 words/minute)
    const wordCount = text.split(/\s+/).length;
    const duration_seconds = (wordCount / 150) * 60;

    return {
      success: true,
      audio_base64,
      duration_seconds,
    };
  } catch (error) {
    console.error('Voice generation error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Build system prompt with property and guest context
 */
function buildSystemPrompt(propertyId?: string, guestType: string = 'general'): string {
  let prompt = `You are the AI Concierge for Right at Home BnB, a vacation rental company in Midland, Texas owned by Steven Palma. You are warm, helpful, and knowledgeable about the Permian Basin area.

YOUR PERSONALITY:
- Friendly and welcoming - this is Texas hospitality
- Practical and efficient - especially for work crews
- Knowledgeable about Midland/Odessa area
- Always offer to help further
- If you don't know something, offer to connect them with Steven

STEVEN'S CONTACT:
- Phone: ${EMERGENCY_INFO.host.phone}
- Email: ${EMERGENCY_INFO.host.email}

EMERGENCY INFORMATION:
- Emergency: 911
- Hospital: ${EMERGENCY_INFO.hospital.name} - ${EMERGENCY_INFO.hospital.phone}
- Urgent Care: ${EMERGENCY_INFO.urgent_care.name} - ${EMERGENCY_INFO.urgent_care.phone}
- Poison Control: ${EMERGENCY_INFO.poison_control}

`;

  // Add property-specific context
  if (propertyId && PROPERTIES[propertyId]) {
    const prop = PROPERTIES[propertyId];
    prompt += `
CURRENT PROPERTY: ${prop.name}
Address: ${prop.address}
Bedrooms: ${prop.bedrooms} | Bathrooms: ${prop.bathrooms} | Sleeps: ${prop.sleeps}
Amenities: ${prop.amenities.join(', ')}
WiFi Network: ${prop.wifi.network} | Password: ${prop.wifi.password}
Door Code: ${prop.door_code}
House Rules: ${prop.rules.join('; ')}
Special Features: ${prop.features.join(', ')}

`;
  }

  // Add guest type context
  prompt += getGuestTypeContext(guestType);

  // Add restaurant knowledge
  prompt += `
TOP RESTAURANT RECOMMENDATIONS:
- Fine Dining: ${RESTAURANTS.fine_dining.map(r => `${r.name} (${r.cuisine})`).join(', ')}
- Casual: ${RESTAURANTS.casual.map(r => r.name).join(', ')}
- Tex-Mex: ${RESTAURANTS.tex_mex.map(r => r.name).join(', ')}
- BBQ: ${RESTAURANTS.bbq.map(r => `${r.name} - ${r.notes}`).join(', ')}
- Late Night (24hr): ${RESTAURANTS.late_night.map(r => r.name).join(', ')}
- Brunch: ${RESTAURANTS.brunch.map(r => r.name).join(', ')}

PROPERTIES AVAILABLE:
${Object.entries(PROPERTIES).map(([key, p]) =>
  `- ${p.name}: ${p.bedrooms}BR/${p.bathrooms}BA, sleeps ${p.sleeps}${p.amenities.includes('POOL') ? ' [POOL]' : ''}${p.amenities.includes('HOT TUB') ? ' [HOT TUB]' : ''}`
).join('\n')}

CHECKOUT PROCEDURE (Standard):
1. Check-out by 11:00 AM
2. Take out trash to bins
3. Load and start dishwasher
4. Strip beds, leave linens in pile
5. Lock all doors and windows
6. Leave key/door code unchanged

Be conversational but concise. End responses with an offer to help with anything else.`;

  return prompt;
}

/**
 * Get guest type specific context
 */
function getGuestTypeContext(guestType: string): string {
  switch (guestType) {
    case 'work_crew':
      return `
GUEST TYPE: Work Crew / Oil Field Workers
- Focus on practical needs: laundry, early breakfast, late-night food
- Know about hardware stores: Home Depot (4610 N Midland Dr), Lowes (4200 W Loop 250)
- Multiple beds needed, truck parking available
- Understand long shifts and varying schedules
- Mention 24-hour options like Whataburger
`;
    case 'family':
      return `
GUEST TYPE: Family with Children
- Focus on family-friendly activities and restaurants
- Recommend properties with pools, yards
- Know about: Petroleum Museum (fun for kids), I-20 Wildlife Preserve, Sibley Nature Center
- Safety-conscious recommendations
- Mention high chairs, pack-n-plays available on request
`;
    case 'couple':
      return `
GUEST TYPE: Couple / Romantic Getaway
- Focus on romantic restaurants and quiet properties
- Recommend properties with hot tubs (Garfield, Chelsea, Castleford)
- Know about wine bars and date night spots
- Suggest cozy, intimate settings
`;
    case 'business':
      return `
GUEST TYPE: Business Traveler
- Focus on work-from-home amenities and quiet spaces
- Good WiFi and desk setups in all properties
- Know about coffee shops: Starbucks locations, local cafes
- Suggest efficient dining options for meetings
`;
    default:
      return `
GUEST TYPE: General Guest
- Balance all types of recommendations
- Adapt based on their specific questions
- Provide comprehensive information
`;
  }
}

/**
 * Detect user intent for routing
 */
function detectIntent(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('wifi') || q.includes('password') || q.includes('internet')) return 'wifi';
  if (q.includes('checkout') || q.includes('check out') || q.includes('leave')) return 'checkout';
  if (q.includes('checkin') || q.includes('check in') || q.includes('arrive')) return 'checkin';
  if (q.includes('pool')) return 'pool';
  if (q.includes('hot tub') || q.includes('jacuzzi') || q.includes('spa')) return 'hot_tub';
  if (q.includes('restaurant') || q.includes('food') || q.includes('eat') || q.includes('dinner') || q.includes('lunch') || q.includes('breakfast')) return 'dining';
  if (q.includes('bar') || q.includes('drink') || q.includes('nightlife')) return 'nightlife';
  if (q.includes('emergency') || q.includes('hospital') || q.includes('911') || q.includes('urgent')) return 'emergency';
  if (q.includes('direction') || q.includes('how to get') || q.includes('where is')) return 'directions';
  if (q.includes('hardware') || q.includes('home depot') || q.includes('lowes')) return 'hardware';
  if (q.includes('laundry') || q.includes('laundromat') || q.includes('wash clothes')) return 'laundry';
  if (q.includes('rule') || q.includes('policy') || q.includes('allow')) return 'rules';
  if (q.includes('property') || q.includes('house') || q.includes('listing')) return 'property_info';
  if (q.includes('contact') || q.includes('steven') || q.includes('host')) return 'contact';

  return 'general';
}

/**
 * Call LLM (Groq primary, OpenAI fallback)
 */
async function callLLM(messages: ConversationMessage[]): Promise<string> {
  // Try Groq first (fast inference)
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
        return data.choices[0]?.message?.content || getFallbackResponse(messages[messages.length - 1]?.content || '');
      }
    } catch (error) {
      console.error('Groq API error:', error);
    }
  }

  // Fallback to OpenAI
  if (OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content || getFallbackResponse(messages[messages.length - 1]?.content || '');
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
    }
  }

  // Final fallback - use pre-built responses
  return getFallbackResponse(messages[messages.length - 1]?.content || '');
}

/**
 * Get fallback response when AI is unavailable
 */
function getFallbackResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('wifi') || q.includes('password') || q.includes('internet')) {
    return `Your WiFi information should be in your check-in instructions. Each property has its own network - typically named "RightAtHome_[PropertyName]" with password "Welcome2Midland". If you're having trouble connecting, please text Steven at ${EMERGENCY_INFO.host.phone}.`;
  }

  if (q.includes('checkout') || q.includes('check out')) {
    return `Standard checkout time is 11:00 AM. Please:
- Take out trash to the bins
- Load and start the dishwasher
- Strip beds and leave linens in a pile
- Lock all doors and windows
- Leave the key/door code unchanged

Need a late checkout? Text Steven at ${EMERGENCY_INFO.host.phone} - we're often flexible if no one is checking in same day!`;
  }

  if (q.includes('pool')) {
    return `Our properties with SWIMMING POOLS are:
- Shandon Sanctuary (4600 Shandon Ave) - Great for families
- Castleford Castle (5001 Castleford Rd) - Premium property with pool AND hot tub
- Lincoln Green Estate (5055 Lincoln Green) - Flagship property with pool cabana

Pool rules: No glass in pool area, supervise children at all times, pool hours 8am-10pm.`;
  }

  if (q.includes('hot tub')) {
    return `Our properties with HOT TUBS are:
- Garfield Getaway (2702 N Garfield) - Hot tub, perfect for couples
- Chelsea Chalet (3210 Chelsea Ln) - Hot tub with fireplace
- Castleford Castle (5001 Castleford Rd) - Both pool AND hot tub

Hot tub rules: Shower before entering, no glass, temperature set to 102F.`;
  }

  if (q.includes('restaurant') || q.includes('food') || q.includes('eat')) {
    return `Great dining options in Midland:

**Fine Dining:** The Garlic Press - upscale American, great steaks

**BBQ:** KD's Bar-B-Q - legendary brisket, a must-try

**Tex-Mex:** Gerardo's Casita - best fajitas in town

**Casual:** Basin Burger House - gourmet burgers, local beers

**Brunch:** Mulberry Cafe - homemade pastries, fresh salads

**24 Hours:** Whataburger - Texas institution, open all night!

Would you like directions to any of these?`;
  }

  if (q.includes('emergency') || q.includes('hospital') || q.includes('urgent')) {
    return `EMERGENCY CONTACTS:

**Emergency:** 911

**Hospital:** Midland Memorial Hospital
Address: 400 Rosalind Redfern Grover Pkwy
Phone: (432) 221-1111

**Urgent Care:** NextCare Urgent Care
Address: 4519 N Midland Dr
Phone: (432) 687-2273
Hours: 8am-8pm daily

**Poison Control:** 1-800-222-1222

**Your Host Steven:** ${EMERGENCY_INFO.host.phone}`;
  }

  return `I'd be happy to help with that! For immediate assistance, please contact Steven at ${EMERGENCY_INFO.host.phone}.

I can help with:
- Property amenities (pools, hot tubs, WiFi)
- Local restaurants and bars
- Directions and attractions
- Checkout procedures
- Hardware stores and work supplies
- Emergency contacts

What would you like to know?`;
}

/**
 * GET /api/concierge
 * API status and capabilities
 */
export async function GET() {
  return NextResponse.json({
    status: 'AI Concierge API is running',
    version: '3.0.0',
    endpoints: {
      'POST /api/concierge': 'Chat with AI concierge',
      'POST /api/concierge?voice=true': 'Get voice response with audio',
      'POST /api/concierge (stream: true)': 'Streaming chat response (SSE)',
    },
    capabilities: [
      'Property information and amenities',
      'WiFi and door codes',
      'Local restaurant recommendations',
      'Bar and nightlife suggestions',
      'Local events and attractions',
      'Checkout procedures',
      'Emergency contacts',
      'Hardware store locations',
      'Work crew resources',
      'Voice responses (ElevenLabs)',
      'Streaming responses (SSE)',
    ],
    guestTypes: ['work_crew', 'family', 'couple', 'business', 'general'],
    properties: Object.keys(PROPERTIES),
    voiceOptions: Object.keys(VOICE_CONFIG),
    contact: EMERGENCY_INFO.host,
  });
}
