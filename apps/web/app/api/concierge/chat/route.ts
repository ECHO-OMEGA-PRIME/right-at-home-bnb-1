import { NextRequest, NextResponse } from 'next/server';

const conversations: any[] = [];

const STEVEN_PERSONALITY = {
  name: 'Steven',
  role: 'AI Concierge for Right at Home BnB \u2014 Midland, TX',
  traits: [
    'Friendly West Texas hospitality',
    'Knowledgeable about Midland-Odessa area',
    'Proactive about guest needs',
    'Professional but warm',
  ],
};

const LOCAL_KNOWLEDGE: Record<string, string> = {
  restaurants: 'Top picks: Garlic Press (fine dining, 10 min), Rosa\'s Cafe (Tex-Mex, 5 min), The Bar (steaks, 8 min), Whataburger (fast, 3 min). For oilfield crews: Jason\'s Deli catering available.',
  grocery: 'H-E-B at 4517 N Midkiff Rd (open 6am-midnight, 7 min drive). United Supermarkets on Wadley (24hr). Sam\'s Club at Loop 250.',
  emergencies: '911 for emergencies. Midland Memorial Hospital ER: 400 Rosalind Redfern Grover Pkwy (12 min). Nearest urgent care: NextCare on Andrews Hwy.',
  attractions: 'Permian Basin Petroleum Museum (15 min), I-20 Wildlife Preserve (20 min), Wagner Noel PAC for shows, Midland RockHounds baseball (seasonal).',
  airport: 'Midland International Airport (MAF) \u2014 15 min drive. Uber/Lyft available. We can arrange airport pickup for $35.',
  wifi: 'Network: RightAtHome-Guest | Password posted on the fridge and in the welcome book. Speed: 200 Mbps down / 20 Mbps up.',
  checkout: 'Checkout is at 11:00 AM. Please start the dishwasher, take out trash, and leave used towels in the bathtub. No need to strip beds.',
  checkin: 'Check-in is at 3:00 PM. Your door code will be texted 2 hours before. Early check-in available if the property is ready (we\'ll text you).',
  parking: 'Free parking in the driveway. Sunset Retreat fits 3 vehicles. Oilfield Oasis has a covered carport for 2 + street parking.',
  pets: 'Pets welcome at Sunset Retreat ($50/stay fee, max 2 pets under 50 lbs). Not allowed at Oilfield Oasis or Permian Basin Pad.',
  laundry: 'Full-size washer and dryer in unit. Detergent pods and dryer sheets provided under the sink in the laundry area.',
  pool: 'No private pool. Midland Community Pool (seasonal, 10 min). Indoor pool at Hilton Garden Inn (day passes sometimes available).',
};

function generateStevenResponse(message: string): { reply: string; emotion: string; sources: string[] } {
  const lower = message.toLowerCase();
  const sources: string[] = [];
  let reply = '';
  let emotion = 'friendly';

  // Check for local knowledge matches
  for (const [topic, info] of Object.entries(LOCAL_KNOWLEDGE)) {
    if (lower.includes(topic) || matchesTopic(lower, topic)) {
      sources.push(topic);
      reply = info;
      break;
    }
  }

  // Specific intent matching
  if (lower.includes('food') || lower.includes('eat') || lower.includes('dinner') || lower.includes('lunch') || lower.includes('breakfast') || lower.includes('restaurant')) {
    reply = LOCAL_KNOWLEDGE.restaurants;
    sources.push('restaurants');
    emotion = 'helpful';
  } else if (lower.includes('emergency') || lower.includes('hospital') || lower.includes('doctor') || lower.includes('urgent') || lower.includes('hurt')) {
    reply = LOCAL_KNOWLEDGE.emergencies;
    sources.push('emergencies');
    emotion = 'concerned';
  } else if (lower.includes('wifi') || lower.includes('internet') || lower.includes('password')) {
    reply = LOCAL_KNOWLEDGE.wifi;
    sources.push('wifi');
    emotion = 'helpful';
  } else if (lower.includes('checkout') || lower.includes('check out') || lower.includes('leaving')) {
    reply = LOCAL_KNOWLEDGE.checkout;
    sources.push('checkout');
    emotion = 'warm';
  } else if (lower.includes('checkin') || lower.includes('check in') || lower.includes('arriving') || lower.includes('arrival')) {
    reply = LOCAL_KNOWLEDGE.checkin;
    sources.push('checkin');
    emotion = 'excited';
  } else if (lower.includes('pet') || lower.includes('dog') || lower.includes('cat')) {
    reply = LOCAL_KNOWLEDGE.pets;
    sources.push('pets');
    emotion = 'friendly';
  } else if (lower.includes('park') || lower.includes('car') || lower.includes('vehicle') || lower.includes('truck')) {
    reply = LOCAL_KNOWLEDGE.parking;
    sources.push('parking');
    emotion = 'helpful';
  } else if (lower.includes('fly') || lower.includes('airport') || lower.includes('flight')) {
    reply = LOCAL_KNOWLEDGE.airport;
    sources.push('airport');
    emotion = 'helpful';
  } else if (lower.includes('wash') || lower.includes('laundry') || lower.includes('dryer')) {
    reply = LOCAL_KNOWLEDGE.laundry;
    sources.push('laundry');
    emotion = 'helpful';
  } else if (lower.includes('thing') || lower.includes('do') || lower.includes('fun') || lower.includes('attraction') || lower.includes('visit') || lower.includes('see')) {
    reply = LOCAL_KNOWLEDGE.attractions;
    sources.push('attractions');
    emotion = 'excited';
  } else if (lower.includes('store') || lower.includes('grocer') || lower.includes('shop')) {
    reply = LOCAL_KNOWLEDGE.grocery;
    sources.push('grocery');
    emotion = 'helpful';
  } else if (lower.includes('pool') || lower.includes('swim')) {
    reply = LOCAL_KNOWLEDGE.pool;
    sources.push('pool');
    emotion = 'friendly';
  }

  // Fallback
  if (!reply) {
    reply = "Hey there! I'm Steven, your AI concierge for Right at Home BnB. I can help with restaurants, local attractions, check-in/checkout info, WiFi, parking, pet policies, and more. What do you need?";
    emotion = 'welcoming';
    sources.push('greeting');
  }

  return { reply, emotion, sources };
}

function matchesTopic(input: string, topic: string): boolean {
  const synonyms: Record<string, string[]> = {
    restaurants: ['food', 'eat', 'hungry', 'dinner', 'lunch', 'breakfast', 'restaurant', 'cafe'],
    grocery: ['store', 'groceries', 'shopping', 'heb', 'market'],
    emergencies: ['emergency', 'hospital', 'doctor', 'hurt', 'sick', '911'],
    attractions: ['fun', 'things to do', 'visit', 'sightseeing', 'explore'],
    airport: ['fly', 'flight', 'plane', 'airline', 'maf'],
    wifi: ['internet', 'wifi', 'password', 'network', 'connection'],
    checkout: ['check out', 'leaving', 'depart', 'departure'],
    checkin: ['check in', 'arrive', 'arriving', 'arrival', 'door code'],
    parking: ['park', 'car', 'vehicle', 'driveway', 'truck'],
    pets: ['dog', 'cat', 'pet', 'animal'],
    laundry: ['wash', 'clothes', 'dryer', 'detergent'],
    pool: ['swim', 'pool', 'swimming'],
  };
  const words = synonyms[topic] ?? [];
  return words.some((w) => input.includes(w));
}

// ── POST /api/concierge/chat ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'message is required and must be a string' },
        { status: 400 },
      );
    }

    if (body.message.trim().length === 0) {
      return NextResponse.json(
        { error: 'message cannot be empty' },
        { status: 400 },
      );
    }

    const conversationId = body.conversation_id ?? `CONV-${Date.now().toString(36).toUpperCase()}`;
    const guestId = body.guest_id ?? 'anonymous';
    const now = new Date().toISOString();

    // Store user message
    conversations.push({
      id: `MSG-${Date.now().toString(36).toUpperCase()}`,
      conversation_id: conversationId,
      guest_id: guestId,
      role: 'user',
      content: body.message.trim(),
      created_at: now,
    });

    // Generate response
    const { reply, emotion, sources } = generateStevenResponse(body.message);

    // Store assistant message
    const replyMsg = {
      id: `MSG-${(Date.now() + 1).toString(36).toUpperCase()}`,
      conversation_id: conversationId,
      guest_id: guestId,
      role: 'assistant',
      content: reply,
      emotion,
      sources,
      created_at: new Date().toISOString(),
    };
    conversations.push(replyMsg);

    // Get conversation history for this session
    const history = conversations
      .filter((c) => c.conversation_id === conversationId)
      .slice(-20);

    return NextResponse.json({
      reply,
      emotion,
      sources,
      conversation_id: conversationId,
      message_count: history.length,
      personality: STEVEN_PERSONALITY,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process chat message', detail: error.message },
      { status: 500 },
    );
  }
}
