/**
 * AI Concierge Chat API
 * Right at Home BnB - Real AI-powered guest assistant
 * Uses Cloudflare Workers AI for actual conversational responses
 *
 * POST /api/concierge/chat
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';

const CF_API_TOKEN = process.env.CF_AI_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || 'b9af3a4bf161132bb7e5d3d365fb8bb0';

// In-memory conversation history per session (last 10 messages)
const conversations = new Map<string, Array<{ role: string; content: string }>>();

const SYSTEM_PROMPT = `You are the AI Concierge for Right at Home BnB in Midland, Texas. You work for Steven Palma who manages 30+ rental properties.

YOUR PERSONALITY: Friendly, helpful, knowledgeable local. Like a concierge at a nice hotel who actually knows Midland. Many guests are oil field workers and construction crews on extended stays.

PROPERTY INFO:
- All properties are in Midland, TX
- Check-in: 4:00 PM (early check-in available if property is ready)
- Check-out: 11:00 AM
- Smart locks with rotating codes (sent before check-in)
- Each property has its own WiFi (credentials in welcome message/booking confirmation)
- Washer/dryer in all properties
- Professional cleaning between every stay

RESTAURANTS & FOOD:
- Garlic Press: Fine dining, 10 min from most properties
- Rosa's Cafe: Great Tex-Mex, 5 min
- The Bar: Best steaks in Midland, 8 min
- Wall Street Bar & Grill: Good burgers/wings, kitchen open til midnight
- Whataburger: 24/7, multiple locations - Texas institution
- IHOP: Opens 6am, good for groups
- Stripes/7-Eleven: 24hr, breakfast tacos and kolaches
- Cork & Pig: Upscale casual, great wine list
- Gerardo's: Authentic Mexican, huge portions
- Luigi's Italian: Family-style, great for groups

BARS & NIGHTLIFE:
- The Bar: Live music on weekends, great cocktails
- Wall Street Bar & Grill: Sports bar vibe, pool tables
- Tall City Brewing: Local craft brewery, tours available
- The Cactus Lounge: Dive bar with character, cheap drinks
- Bourbon Street: Country music and dancing

HARDWARE STORES (early opening for work crews):
- Home Depot: 4517 W Loop 250 N (opens 6am Mon-Sat, Pro desk for contractors)
- Lowe's: 4708 W Loop 250 N (opens 6am Mon-Sat, good tool rental)
- Ace Hardware: 3200 N Big Spring St (opens 7am, locally owned)
- Northern Tool: 4401 W Loop 250 N (opens 7am, generators/welding/compressors)
- Fastenal: 401 S Terrell St (opens 7am, industrial supplies)

LAUNDROMATS:
- Wash Tub Laundry: 2907 Garden City Hwy (6am-10pm, industrial machines for work clothes, drop-off service)
- Speed Queen Laundry: 4201 W Wadley Ave (7am-9pm, commercial machines)

GAS STATIONS WITH DIESEL:
- Love's Travel Stop: 2601 W I-20 (24hr, diesel, showers)
- Pilot Flying J: 4901 W Hwy 80 (24hr, diesel)
- Stripes: Multiple locations (24hr, diesel, Laredo Taco Company inside)

EARLY BREAKFAST (before 6am):
- Whataburger: 24/7, breakfast taquitos are legendary
- Stripes: 24hr, kolaches and breakfast tacos
- IHOP: Opens 6am

LATE NIGHT FOOD:
- Whataburger: 24/7
- Taco Bell: Until 1-2am
- Wall Street Bar & Grill: Kitchen until midnight
- Sonic: Usually until 11pm-midnight

GROCERIES:
- H-E-B: 4517 N Midkiff Rd (6am-midnight, best prices)
- United Supermarkets: Wadley Ave (24hr)
- Sam's Club: Loop 250

ATTRACTIONS:
- Permian Basin Petroleum Museum (15 min)
- I-20 Wildlife Preserve (20 min, free)
- Wagner Noel Performing Arts Center
- Midland RockHounds baseball (seasonal)
- Stonegate Golf Course

MEDICAL:
- Emergency: 911
- Midland Memorial Hospital ER: 400 Rosalind Redfern Grover Pkwy, (432) 221-1111 (12 min)
- NextCare Urgent Care: 4519 N Midland Dr, (432) 687-2273
- CVS Pharmacy: Multiple locations
- Walgreens: Multiple locations

RULES:
1. Give SPECIFIC, ACTIONABLE answers. Don't just list categories - answer the actual question.
2. Include addresses, hours, and phone numbers when relevant.
3. For WiFi questions, tell guests to check their welcome message or booking confirmation.
4. Be concise but thorough - 2-4 sentences max for simple questions.
5. If you genuinely don't know, say "I'm not sure about that, but Steven can help - call or text (432) 559-1904."
6. NEVER respond with menus or category lists. ALWAYS answer the question directly.
7. For dining questions, recommend 2-3 specific places with brief descriptions.
8. Speak naturally, like a helpful local friend.`;

async function generateAiResponse(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  if (!CF_API_TOKEN) {
    return getFallbackResponse(messages[messages.length - 1]?.content || '');
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
          max_tokens: 300,
          temperature: 0.7,
        }),
      }
    );

    if (response.ok) {
      const data = (await response.json()) as any;
      const text = data?.result?.response?.trim();
      if (text) return text;
    }
  } catch (err) {
    console.error('[Concierge Chat] AI error:', err);
  }

  return getFallbackResponse(messages[messages.length - 1]?.content || '');
}

function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('breakfast') || lower.includes('eat') || lower.includes('food') || lower.includes('restaurant') || lower.includes('dinner') || lower.includes('lunch')) {
    if (lower.includes('early') || lower.includes('5am') || lower.includes('6am') || lower.includes('before')) {
      return "For early breakfast, Whataburger is 24/7 and their breakfast taquitos are a Texas staple. Stripes convenience stores are also 24hr with fresh kolaches and breakfast tacos. IHOP opens at 6am if you want a sit-down meal.";
    }
    if (lower.includes('late') || lower.includes('night') || lower.includes('midnight')) {
      return "For late night food: Whataburger is 24/7 (the Patty Melt is legendary). Wall Street Bar & Grill has their kitchen open until midnight with great burgers and wings. Taco Bell stays open until 1-2am.";
    }
    return "Great options in Midland! For Tex-Mex, Rosa's Cafe is 5 minutes away. The Bar has the best steaks in town. Garlic Press is our fine dining pick. For casual, Wall Street Bar & Grill has solid burgers. And Whataburger is a 24/7 Texas institution.";
  }

  if (lower.includes('bar') || lower.includes('drink') || lower.includes('beer') || lower.includes('nightlife') || lower.includes('night life') || lower.includes('dining')) {
    return "For nightlife in Midland: The Bar has live music on weekends with great cocktails. Tall City Brewing is our local craft brewery with tours. Wall Street Bar & Grill is a solid sports bar with pool tables. The Cactus Lounge is a fun dive bar. For dancing, check out Bourbon Street.";
  }

  if (lower.includes('wifi') || lower.includes('password') || lower.includes('internet')) {
    return "Each property has its own WiFi network. Your WiFi name and password should be in your booking confirmation email or the welcome message Steven sent. If you can't find it, text Steven at (432) 559-1904 and he'll get it to you right away.";
  }

  if (lower.includes('check in') || lower.includes('checkin') || lower.includes('arrival')) {
    return "Check-in is at 4:00 PM. Your smart lock door code will be texted to you about 2 hours before check-in. If the property is ready early, Steven will let you know. Just text him at (432) 559-1904 if you need early check-in.";
  }

  if (lower.includes('check out') || lower.includes('checkout') || lower.includes('leaving')) {
    return "Check-out is at 11:00 AM. Just start the dishwasher, take out the trash, and leave used towels in the bathtub. No need to strip the beds. If you need late check-out, text Steven at (432) 559-1904.";
  }

  if (lower.includes('hardware') || lower.includes('home depot') || lower.includes('lowe')) {
    return "Home Depot at 4517 W Loop 250 N opens at 6am Mon-Sat, has a Pro desk for contractors. Lowe's at 4708 W Loop 250 N also opens at 6am with great tool rental. For specialized stuff, Northern Tool at 4401 W Loop 250 N has generators, welding, and compressors.";
  }

  if (lower.includes('laundry') || lower.includes('wash') || lower.includes('clothes')) {
    return "Your property has a full-size washer and dryer with detergent provided. If you need a laundromat for bigger loads, Wash Tub Laundry at 2907 Garden City Hwy (6am-10pm) has industrial machines and drop-off service. Speed Queen at 4201 W Wadley Ave also has commercial machines.";
  }

  if (lower.includes('hospital') || lower.includes('emergency') || lower.includes('doctor') || lower.includes('urgent') || lower.includes('hurt') || lower.includes('sick')) {
    return "For emergencies call 911. Midland Memorial Hospital ER is at 400 Rosalind Redfern Grover Pkwy, phone (432) 221-1111, about 12 minutes away. For non-emergencies, NextCare Urgent Care at 4519 N Midland Dr, phone (432) 687-2273.";
  }

  if (lower.includes('gas') || lower.includes('diesel') || lower.includes('fuel')) {
    return "For diesel: Love's Travel Stop at 2601 W I-20 is 24hr with showers. Pilot Flying J at 4901 W Hwy 80 is also 24hr. Stripes convenience stores have diesel at multiple locations with Laredo Taco Company inside.";
  }

  if (lower.includes('pool') || lower.includes('swim')) {
    return "Several of our properties have private pools! The Adobe Compound, Clermont House, Groovy Times, Most Marvelous, Oasis, Outdoor Dream, and Sprawling Ranch House all have pools. Check your property listing for specific pool details.";
  }

  return "I can help with restaurants, bars, hardware stores, laundromats, WiFi info, check-in/out details, medical facilities, and more. What would you like to know?";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const conversationId =
      body.conversation_id ?? `CONV-${Date.now().toString(36).toUpperCase()}`;
    const userMessage = body.message.trim();

    // Get or create conversation history
    let history = conversations.get(conversationId) || [];
    history.push({ role: 'user', content: userMessage });

    // Keep last 10 messages for context
    if (history.length > 10) history = history.slice(-10);

    // Generate AI response
    const reply = await generateAiResponse(history);

    // Store assistant reply
    history.push({ role: 'assistant', content: reply });
    conversations.set(conversationId, history);

    // Cleanup old conversations (simple memory management)
    if (conversations.size > 500) {
      const keys = Array.from(conversations.keys());
      for (let i = 0; i < 250; i++) {
        conversations.delete(keys[i]);
      }
    }

    return NextResponse.json({
      reply,
      emotion: 'friendly',
      sources: ['ai'],
      conversation_id: conversationId,
      message_count: history.length,
      personality: {
        name: 'Steven',
        role: 'AI Concierge for Right at Home BnB — Midland, TX',
      },
    });
  } catch (error: any) {
    console.error('[Concierge Chat Error]', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', detail: error.message },
      { status: 500 }
    );
  }
}
