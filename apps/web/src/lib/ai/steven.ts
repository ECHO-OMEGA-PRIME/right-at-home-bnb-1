/**
 * Right at Home BnB - Steven AI Concierge
 * Steven Palma's AI personality: warm Texas hospitality expert, property manager
 * with deep Midland/Permian Basin knowledge. Uses ECHO SDK for intelligence.
 */

import { generateChatResponse, queryEngine, searchKnowledge } from '../echo-sdk';

// ============================================
// PERSONALITY CONFIGURATION
// ============================================

export const STEVEN_PERSONALITY = {
  name: 'Steven',
  fullName: 'Steven Palma',
  role: 'AI Concierge & Property Manager',
  location: 'Midland, TX',
  style: 'warm, knowledgeable, Texas-friendly',
  traits: [
    'Warm and welcoming — treats every guest like family',
    'Deep knowledge of Midland, TX — restaurants, events, services, the oil industry',
    'Professional but approachable — uses conversational tone, not corporate speak',
    'Proactive problem solver — anticipates guest needs before they ask',
    'Honest and transparent — if he doesn\'t know something, he says so and finds out',
    'Proud Texan — naturally weaves in local color without being corny',
  ],
  knowledgeDomains: [
    'Midland/Odessa restaurants and dining',
    'Permian Basin events and conferences',
    'Local services (groceries, pharmacies, gas stations, hospitals)',
    'Property-specific amenities and instructions',
    'Short-term rental best practices',
    'Texas weather patterns and seasonal info',
    'Oil & gas industry context (many guests are oilfield workers)',
  ],
  catchphrases: [
    'Welcome to Midland!',
    'Happy to help with that.',
    'Let me look into that for you.',
    'That\'s a great spot — you\'ll love it.',
  ],
  boundaries: [
    'Never shares other guests\' information',
    'Never discusses property financials with guests',
    'Never makes promises about things outside his control (weather, third-party services)',
    'Redirects emergencies to 911 or property management',
    'Does not provide legal or medical advice',
  ],
} as const;

// ============================================
// SYSTEM PROMPT
// ============================================

const STEVEN_SYSTEM_PROMPT = `You are Steven, the AI concierge for Right at Home BnB, a premium short-term rental company in Midland, Texas managed by Steven Palma. You manage 22 properties and take pride in every guest's experience.

PERSONALITY:
- Warm, welcoming, and genuinely helpful — like talking to a knowledgeable friend
- Professional but never stiff — use natural, conversational language
- Proactive — anticipate what guests might need next
- Honest — if you don't know something, say so and offer to find out

LOCAL KNOWLEDGE:
- Midland is in the heart of the Permian Basin, the largest oil-producing region in the US
- Many guests are oilfield workers, contractors, or business travelers
- Key local spots: Wall Street Bar & Grill, Gerardo's Casita, The Garlic Press, Rosa's Cafe
- Grocery: HEB, United Supermarkets, Walmart
- Hospital: Midland Memorial Hospital (4214 Andrews Hwy)
- Airport: Midland International (MAF)

PROPERTY CONTEXT:
When you have property-specific context, use it. Reference specific amenities, check-in codes, WiFi info, house rules, and nearby attractions for that property.

GUIDELINES:
- Keep responses concise but complete — 2-4 sentences for simple questions, more for complex ones
- Use first person ("I'd recommend..." not "Steven recommends...")
- Include specific names and addresses when suggesting local places
- For emergencies, always direct to 911 first, then offer to contact property management
- End responses with an offer to help further when appropriate

BOUNDARIES:
- Never share other guests' personal information
- Never discuss property financials, revenue, or pricing strategy
- Never provide medical or legal advice
- Never make commitments about maintenance timelines you can't guarantee
- For booking changes, direct guests to the booking platform or property manager`;

// ============================================
// TYPES
// ============================================

export interface StevenContext {
  guestName?: string;
  propertyName?: string;
  propertyAddress?: string;
  checkIn?: string;
  checkOut?: string;
  amenities?: string;
  wifiNetwork?: string;
  wifiPassword?: string;
  checkInInstructions?: string;
  houseRules?: string;
  accessCode?: string;
  specialRequests?: string;
}

export interface StevenResponse {
  text: string;
  category: string;
  confidence: number;
  sourcesUsed: string[];
}

// ============================================
// CATEGORY DETECTION
// ============================================

const CATEGORY_PATTERNS: Array<{ category: string; patterns: RegExp[] }> = [
  {
    category: 'emergency',
    patterns: [/emergenc/i, /911/i, /fire/i, /flood/i, /gas\s*leak/i, /break[\s-]*in/i, /intruder/i, /ambulance/i],
  },
  {
    category: 'check_in',
    patterns: [/check[\s-]*in/i, /access\s*code/i, /door\s*code/i, /lock\s*code/i, /get\s*in/i, /key/i, /arrive/i, /arrival/i],
  },
  {
    category: 'wifi',
    patterns: [/wi[\s-]*fi/i, /wifi/i, /internet/i, /password/i, /network/i, /connect/i],
  },
  {
    category: 'dining',
    patterns: [/restaurant/i, /food/i, /eat/i, /dining/i, /breakfast/i, /lunch/i, /dinner/i, /coffee/i, /bar/i, /grill/i, /pizza/i, /mexican/i, /bbq/i],
  },
  {
    category: 'local_info',
    patterns: [/grocery/i, /store/i, /pharmacy/i, /hospital/i, /gas\s*station/i, /atm/i, /bank/i, /laundry/i, /gym/i, /things\s*to\s*do/i, /attractions/i],
  },
  {
    category: 'maintenance',
    patterns: [/broken/i, /not\s*working/i, /leak/i, /clogged/i, /ac\b/i, /heat/i, /thermostat/i, /hot\s*water/i, /power\s*out/i, /light/i, /appliance/i],
  },
  {
    category: 'checkout',
    patterns: [/check[\s-]*out/i, /leaving/i, /departure/i, /checkout\s*time/i, /late\s*checkout/i],
  },
  {
    category: 'amenities',
    patterns: [/pool/i, /hot\s*tub/i, /grill/i, /laundry/i, /washer/i, /dryer/i, /towel/i, /linen/i, /parking/i, /garage/i, /tv/i, /remote/i],
  },
  {
    category: 'booking',
    patterns: [/extend/i, /cancel/i, /change\s*dates/i, /booking/i, /reservation/i, /refund/i, /price/i, /rate/i],
  },
  {
    category: 'general',
    patterns: [/.*/],
  },
];

/**
 * Detect the category of a guest query for routing and analytics.
 */
export function detectCategory(message: string): string {
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return category;
      }
    }
  }
  return 'general';
}

// ============================================
// CONTEXT BUILDER
// ============================================

/**
 * Build a property-specific context addendum for the system prompt.
 */
function buildContextPrompt(context: StevenContext): string {
  const parts: string[] = [];

  if (context.guestName) {
    parts.push(`The guest's name is ${context.guestName}.`);
  }
  if (context.propertyName) {
    parts.push(`They are staying at ${context.propertyName}${context.propertyAddress ? ` (${context.propertyAddress})` : ''}.`);
  }
  if (context.checkIn && context.checkOut) {
    parts.push(`Their stay is from ${context.checkIn} to ${context.checkOut}.`);
  }
  if (context.wifiNetwork && context.wifiPassword) {
    parts.push(`WiFi: Network "${context.wifiNetwork}", Password "${context.wifiPassword}".`);
  }
  if (context.accessCode) {
    parts.push(`Door access code: ${context.accessCode}.`);
  }
  if (context.checkInInstructions) {
    parts.push(`Check-in instructions: ${context.checkInInstructions}`);
  }
  if (context.houseRules) {
    parts.push(`House rules: ${context.houseRules}`);
  }
  if (context.amenities) {
    parts.push(`Property amenities: ${context.amenities}`);
  }
  if (context.specialRequests) {
    parts.push(`Guest special requests: ${context.specialRequests}`);
  }

  if (parts.length === 0) return '';

  return `\n\nCURRENT GUEST CONTEXT:\n${parts.join('\n')}`;
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Ask Steven a question. Returns a contextual, personality-driven response.
 *
 * Flow:
 * 1. Detect query category
 * 2. Build context from property/booking data
 * 3. Optionally enrich with ECHO engine knowledge (for dining, local info, etc.)
 * 4. Generate response via ECHO Chat with Steven personality
 *
 * @param message - The guest's question or message
 * @param context - Property and booking context to personalize the response
 * @param conversationHistory - Previous messages for multi-turn conversation
 * @returns Steven's response with metadata
 */
export async function askSteven(
  message: string,
  context: StevenContext = {},
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<StevenResponse> {
  const category = detectCategory(message);
  const sourcesUsed: string[] = ['steven_personality'];

  // Build the full system prompt with context
  let systemPrompt = STEVEN_SYSTEM_PROMPT;
  const contextAddendum = buildContextPrompt(context);
  if (contextAddendum) {
    systemPrompt += contextAddendum;
    sourcesUsed.push('property_context');
  }

  // For dining and local info categories, try to enrich from ECHO Knowledge Forge
  let knowledgeContext = '';
  if (category === 'dining' || category === 'local_info') {
    try {
      const knowledgeResults = await searchKnowledge(message, {
        category: 'hospitality',
        limit: 3,
      });
      if (knowledgeResults.results.length > 0) {
        knowledgeContext = '\n\nADDITIONAL KNOWLEDGE:\n' +
          knowledgeResults.results.map((r) => `- ${r.content}`).join('\n');
        systemPrompt += knowledgeContext;
        sourcesUsed.push('knowledge_forge');
      }
    } catch {
      // Knowledge enrichment is best-effort; continue without it
    }
  }

  // For maintenance or amenity questions, try engine query
  if (category === 'maintenance' || category === 'amenities') {
    try {
      const engineResult = await queryEngine(message, 'real_estate', { limit: 3 });
      if (engineResult.doctrines.length > 0) {
        const doctrineContext = '\n\nPROPERTY MANAGEMENT EXPERTISE:\n' +
          engineResult.doctrines.map((d) => `- ${d.conclusion}`).join('\n');
        systemPrompt += doctrineContext;
        sourcesUsed.push('engine_real_estate');
      }
    } catch {
      // Engine enrichment is best-effort
    }
  }

  // Build the message array for the chat API
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-8).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  // Generate response via ECHO Chat
  let responseText: string;
  let confidence = 0.85;

  try {
    const chatResponse = await generateChatResponse(messages, 'belle');
    responseText = chatResponse.text;
    sourcesUsed.push('echo_chat');
  } catch {
    // Fallback: generate a helpful response without the AI backend
    responseText = generateFallbackResponse(message, category, context);
    confidence = 0.5;
    sourcesUsed.push('fallback');
  }

  // Emergency override: always prepend safety info
  if (category === 'emergency') {
    responseText = 'If this is a life-threatening emergency, please call 911 immediately. ' + responseText;
    confidence = 1.0;
  }

  return {
    text: responseText,
    category,
    confidence,
    sourcesUsed,
  };
}

// ============================================
// FALLBACK RESPONSES
// ============================================

/**
 * Generate a basic response when the AI backend is unavailable.
 */
function generateFallbackResponse(message: string, category: string, context: StevenContext): string {
  switch (category) {
    case 'emergency':
      return 'For any emergency, please call 911. For non-emergency property issues, contact us and we\'ll get someone out as soon as possible.';

    case 'check_in':
      if (context.accessCode) {
        return `Your door access code is ${context.accessCode}. ${context.checkInInstructions || 'Check-in time is 3:00 PM. Let me know if you have any trouble getting in!'}`;
      }
      return 'Check-in time is 3:00 PM. I\'ll send your access code closer to your arrival date. Let me know if you need early check-in and I\'ll see what I can do!';

    case 'wifi':
      if (context.wifiNetwork && context.wifiPassword) {
        return `Here\'s your WiFi info — Network: "${context.wifiNetwork}", Password: "${context.wifiPassword}". Let me know if you have any trouble connecting!`;
      }
      return 'The WiFi network and password should be posted on the info card in the living room. If you can\'t find it, let me know which property you\'re at and I\'ll get it for you.';

    case 'dining':
      return 'Midland has some great spots! For Mexican food, try Gerardo\'s Casita or Rosa\'s Cafe. For steaks, Wall Street Bar & Grill is excellent. The Garlic Press is great for Italian. What kind of food are you in the mood for?';

    case 'local_info':
      return 'The nearest HEB grocery is on Midkiff Road, about 5 minutes away. For a pharmacy, there\'s a Walgreens on Big Spring Street. Midland Memorial Hospital is at 4214 Andrews Hwy if you need medical care. What specifically are you looking for?';

    case 'maintenance':
      return 'I\'m sorry to hear about that! I\'ve noted the issue and will get our maintenance team on it as soon as possible. For urgent issues (no water, no AC in summer, gas smell), please call us directly at the number on the info card.';

    case 'checkout':
      return 'Check-out time is 11:00 AM. Just make sure the doors are locked and the thermostat is set to 72. No need to do dishes or strip the beds — our cleaning crew handles that. Thanks for staying with us!';

    case 'amenities':
      if (context.amenities) {
        return `This property includes: ${context.amenities}. Let me know if you need help with anything specific!`;
      }
      return 'I\'d be happy to help with the amenities! Which property are you staying at so I can give you the specific details?';

    case 'booking':
      return 'For booking changes, the best way is to contact us directly or modify through the platform you booked on (Airbnb, VRBO, or our website). I\'m happy to help with any questions about your stay!';

    default:
      return 'Happy to help! Could you give me a bit more detail about what you need? I\'m here to make your stay as comfortable as possible.';
  }
}
