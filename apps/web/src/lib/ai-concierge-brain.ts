/**
 * Right at Home BnB - AI Concierge Brain
 * The omniscient AI that knows EVERYTHING about Steven's properties and Midland
 * Optimized for oil field crews and construction workers
 * @author ECHO OMEGA PRIME
 */

import { PropertyKnowledge, PropertyDetails, PropertyReview } from './property-knowledge';
import { LocalGuide, LocalEvent, Restaurant, Bar } from './local-events';
import { FirebaseMemory } from './firebase-memory';

// ============================================
// WORK CREW SPECIFIC KNOWLEDGE
// ============================================

export interface WorkCrewInfo {
  nearbyWorkSites: string[];
  hardwareStores: HardwareStore[];
  workSupplyShops: WorkSupply[];
  earlyBreakfastSpots: Restaurant[];
  lateNightFood: Restaurant[];
  laundromats: Laundromat[];
  gasStations: GasStation[];
}

interface HardwareStore {
  name: string;
  address: string;
  hours: string;
  phone: string;
  notes: string;
}

interface WorkSupply {
  name: string;
  type: string;
  address: string;
  hours: string;
  phone: string;
}

interface Laundromat {
  name: string;
  address: string;
  hours: string;
  hasLargeMachines: boolean;
  notes: string;
}

interface GasStation {
  name: string;
  address: string;
  hasDiesel: boolean;
  hasConvenienceStore: boolean;
  hours: string;
}

export const workCrewResources: WorkCrewInfo = {
  nearbyWorkSites: [
    'Permian Basin oil fields - various locations',
    'Pioneer Natural Resources facilities',
    'Apache Corporation sites',
    'Diamondback Energy operations',
    'Chevron/Occidental facilities',
    'Various pipeline construction sites along I-20',
  ],
  hardwareStores: [
    {
      name: 'Home Depot',
      address: '4517 W Loop 250 N, Midland, TX 79707',
      hours: 'Mon-Sat 6am-10pm, Sun 8am-8pm',
      phone: '(432) 697-0980',
      notes: 'Opens at 6am for early crews. Pro desk for contractor accounts.',
    },
    {
      name: 'Lowe\'s',
      address: '4708 W Loop 250 N, Midland, TX 79707',
      hours: 'Mon-Sat 6am-10pm, Sun 8am-8pm',
      phone: '(432) 699-1750',
      notes: 'Pro services available. Good tool rental.',
    },
    {
      name: 'Ace Hardware',
      address: '3200 N Big Spring St, Midland, TX 79705',
      hours: 'Mon-Fri 7am-7pm, Sat 8am-6pm, Sun 10am-5pm',
      phone: '(432) 682-6541',
      notes: 'Locally owned, helpful staff. Good for smaller jobs.',
    },
    {
      name: 'Northern Tool + Equipment',
      address: '4401 W Loop 250 N, Midland, TX 79707',
      hours: 'Mon-Sat 7am-8pm, Sun 9am-6pm',
      phone: '(432) 699-7110',
      notes: 'Great for generators, compressors, welding supplies.',
    },
  ],
  workSupplyShops: [
    {
      name: 'Fastenal',
      type: 'Industrial supplies & fasteners',
      address: '401 S Terrell St, Midland, TX 79701',
      hours: 'Mon-Fri 7am-5pm',
      phone: '(432) 683-5550',
    },
    {
      name: 'Grainger',
      type: 'Industrial supplies',
      address: '500 W Illinois Ave, Midland, TX 79701',
      hours: 'Mon-Fri 7am-5pm',
      phone: '(432) 684-9700',
    },
    {
      name: 'HD Supply',
      type: 'Construction supplies',
      address: '3002 Garden City Hwy, Midland, TX 79701',
      hours: 'Mon-Fri 6:30am-5pm',
      phone: '(432) 520-8300',
    },
    {
      name: 'Economy Supply',
      type: 'Plumbing & HVAC',
      address: '3600 W Industrial Ave, Midland, TX 79703',
      hours: 'Mon-Fri 7am-5pm, Sat 8am-12pm',
      phone: '(432) 697-3313',
    },
  ],
  earlyBreakfastSpots: [
    {
      name: 'Whataburger',
      cuisine: 'Fast Food',
      description: '24 hours! Perfect for early morning crews. Breakfast taquitos are a local favorite.',
      address: 'Multiple locations',
      priceRange: '$' as const,
      rating: 4.0,
      hours: '24 hours',
    },
    {
      name: 'IHOP',
      cuisine: 'Breakfast',
      description: 'Opens early at 6am. Full breakfast menu, good for groups.',
      address: '3001 W Loop 250 N, Midland, TX 79705',
      priceRange: '$' as const,
      rating: 3.8,
      hours: '6am-10pm',
    },
    {
      name: 'Stripes/7-Eleven',
      cuisine: 'Convenience',
      description: '24 hours. Breakfast tacos, kolaches, and coffee for crews on the go.',
      address: 'Multiple locations',
      priceRange: '$' as const,
      rating: 3.5,
      hours: '24 hours',
    },
  ],
  lateNightFood: [
    {
      name: 'Whataburger',
      cuisine: 'Fast Food',
      description: '24/7 Texas institution. Patty Melt and honey butter chicken biscuit are must-tries.',
      address: 'Multiple locations',
      priceRange: '$' as const,
      rating: 4.2,
      hours: '24 hours',
    },
    {
      name: 'Taco Bell',
      cuisine: 'Fast Food/Mexican',
      description: 'Open late. Quick and cheap after long shifts.',
      address: 'Multiple locations',
      priceRange: '$' as const,
      rating: 3.5,
      hours: 'Until 1am-2am',
    },
    {
      name: 'Wall Street Bar & Grill',
      cuisine: 'Bar Food',
      description: 'Kitchen open until midnight. Good burgers and wings.',
      address: '115 E Wall St, Midland, TX 79701',
      priceRange: '$$' as const,
      rating: 4.0,
      hours: 'Until 2am',
    },
  ],
  laundromats: [
    {
      name: 'Wash Tub Laundry',
      address: '2907 Garden City Hwy, Midland, TX 79701',
      hours: '6am-10pm daily',
      hasLargeMachines: true,
      notes: 'Large industrial machines perfect for work clothes. Drop-off service available.',
    },
    {
      name: 'Speed Queen Laundry',
      address: '4201 W Wadley Ave, Midland, TX 79707',
      hours: '7am-9pm daily',
      hasLargeMachines: true,
      notes: 'Commercial machines. Good for heavy-duty loads.',
    },
  ],
  gasStations: [
    {
      name: 'Stripes (Laredo Taco)',
      address: 'Multiple locations',
      hasDiesel: true,
      hasConvenienceStore: true,
      hours: '24 hours',
    },
    {
      name: 'Love\'s Travel Stop',
      address: '2601 W I-20, Midland, TX 79701',
      hasDiesel: true,
      hasConvenienceStore: true,
      hours: '24 hours',
    },
    {
      name: 'Pilot Flying J',
      address: '4901 W Hwy 80, Midland, TX 79706',
      hasDiesel: true,
      hasConvenienceStore: true,
      hours: '24 hours',
    },
  ],
};

// ============================================
// AVAILABILITY SYSTEM (Mock - connects to booking API)
// ============================================

export interface AvailabilitySlot {
  propertyId: string;
  startDate: string;
  endDate: string;
  isAvailable: boolean;
  pricePerNight: number;
  minimumStay: number;
}

// This would connect to actual booking calendar API
export async function checkAvailability(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilitySlot | null> {
  // TODO: Integrate with actual booking calendar (Airbnb, VRBO, or custom)
  // For now, return mock data
  return {
    propertyId,
    startDate,
    endDate,
    isAvailable: true, // Would check actual calendar
    pricePerNight: 150,
    minimumStay: 1,
  };
}

export async function getNextAvailableWeek(propertyId: string): Promise<{
  startDate: string;
  endDate: string;
} | null> {
  // TODO: Scan calendar for next 7 consecutive available days
  // Mock response for now
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const endWeek = new Date(nextWeek);
  endWeek.setDate(endWeek.getDate() + 7);

  return {
    startDate: nextWeek.toISOString().split('T')[0],
    endDate: endWeek.toISOString().split('T')[0],
  };
}

// ============================================
// AI KNOWLEDGE CONTEXT BUILDER
// ============================================

export function buildPropertyContext(property: PropertyDetails): string {
  const amenityList: string[] = [];
  if (property.amenities.pool) amenityList.push('SWIMMING POOL');
  if (property.amenities.hotTub) amenityList.push('HOT TUB');
  if (property.amenities.bbqGrill) amenityList.push('BBQ grill');
  if (property.amenities.fireplace) amenityList.push('fireplace');
  if (property.amenities.petFriendly) amenityList.push('pet friendly');
  if (property.amenities.garage) amenityList.push('garage parking');
  if (property.amenities.washerDryer) amenityList.push('washer/dryer');

  return `
**${property.name}** (${property.nickname})
- Address: ${property.address}
- Bedrooms: ${property.bedrooms} | Bathrooms: ${property.bathrooms} | Sleeps: ${property.maxGuests}
- Size: ${property.sqft} sqft
- Key Amenities: ${amenityList.join(', ')}
- Check-in: ${property.checkIn} | Check-out: ${property.checkOut}
- WiFi: ${property.wifiName} / Password: ${property.wifiPassword}
- Door Code: ${property.doorCode}
- Special Features: ${property.specialFeatures.join(', ')}
- Description: ${property.description}
`.trim();
}

export function buildFullKnowledgeBase(): string {
  const allProperties = PropertyKnowledge.all
    .map(p => buildPropertyContext(p))
    .join('\n\n---\n\n');

  const poolProperties = PropertyKnowledge.withPool().map(p => p.name).join(', ');
  const hotTubProperties = PropertyKnowledge.withHotTub().map(p => p.name).join(', ');

  return `
# RIGHT AT HOME BnB - COMPLETE KNOWLEDGE BASE
## Owner: Steven Palma | Midland, Texas

### CLIENTELE
Primary guests are oil field workers, construction crews, and traveling professionals.
Many bookings are for entire work crews (4-8 people) on extended stays.

### PROPERTIES WITH POOLS
${poolProperties || 'None currently'}

### PROPERTIES WITH HOT TUBS
${hotTubProperties || 'None currently'}

### ALL PROPERTIES
${allProperties}

### WORK CREW RESOURCES
**Hardware Stores (Open Early):**
${workCrewResources.hardwareStores.map(h => `- ${h.name}: ${h.address} (${h.hours})`).join('\n')}

**24-Hour Food:**
- Whataburger (multiple locations) - Texas institution, great breakfast
- Stripes convenience stores - kolaches, breakfast tacos
- Sonic (varies by location)

**Laundry for Work Clothes:**
${workCrewResources.laundromats.map(l => `- ${l.name}: ${l.address} (${l.notes})`).join('\n')}

**Diesel Fuel:**
${workCrewResources.gasStations.filter(g => g.hasDiesel).map(g => `- ${g.name}: ${g.address}`).join('\n')}

### LOCAL ATTRACTIONS
${LocalGuide.attractions.map(a => `- ${a.name}: ${a.description}`).join('\n')}

### TOP RESTAURANTS
${LocalGuide.restaurants.slice(0, 5).map(r => `- ${r.name} (${r.cuisine}, ${r.priceRange}): ${r.description}`).join('\n')}

### BARS & NIGHTLIFE
${LocalGuide.bars.map(b => `- ${b.name} (${b.type}): ${b.description}`).join('\n')}

### EMERGENCY CONTACTS
- Steven Palma (Owner): (432) 555-0199
- Emergency: 911
- Midland Memorial Hospital: (432) 221-1111
- Police Non-Emergency: (432) 685-7108
`.trim();
}

// ============================================
// QUERY HANDLERS
// ============================================

export type QueryIntent =
  | 'availability'
  | 'amenities'
  | 'reviews'
  | 'directions'
  | 'restaurants'
  | 'bars'
  | 'events'
  | 'property_info'
  | 'wifi'
  | 'checkout'
  | 'hardware_store'
  | 'laundry'
  | 'general';

export function detectIntent(query: string): QueryIntent {
  const q = query.toLowerCase();

  if (q.includes('available') || q.includes('open') || q.includes('book') || q.includes('vacancy'))
    return 'availability';
  if (q.includes('pool') || q.includes('hot tub') || q.includes('amenit') || q.includes('feature'))
    return 'amenities';
  if (q.includes('review') || q.includes('rating'))
    return 'reviews';
  if (q.includes('direction') || q.includes('how do i get') || q.includes('where is'))
    return 'directions';
  if (q.includes('restaurant') || q.includes('food') || q.includes('eat') || q.includes('dinner') || q.includes('breakfast') || q.includes('lunch'))
    return 'restaurants';
  if (q.includes('bar') || q.includes('drink') || q.includes('beer') || q.includes('nightlife'))
    return 'bars';
  if (q.includes('event') || q.includes('happening') || q.includes('going on'))
    return 'events';
  if (q.includes('wifi') || q.includes('password') || q.includes('internet'))
    return 'wifi';
  if (q.includes('checkout') || q.includes('check out') || q.includes('leave'))
    return 'checkout';
  if (q.includes('hardware') || q.includes('home depot') || q.includes('lowe') || q.includes('tool'))
    return 'hardware_store';
  if (q.includes('laundry') || q.includes('wash') || q.includes('clothes'))
    return 'laundry';

  return 'general';
}

export function getContextForIntent(intent: QueryIntent, query: string): string {
  switch (intent) {
    case 'amenities':
      const poolProps = PropertyKnowledge.withPool();
      const hotTubProps = PropertyKnowledge.withHotTub();
      return `
Properties with POOLS: ${poolProps.map(p => p.name).join(', ')}
Properties with HOT TUBS: ${hotTubProps.map(p => p.name).join(', ')}

Details:
${poolProps.map(p => `- ${p.name}: Has pool. ${p.description}`).join('\n')}
${hotTubProps.map(p => `- ${p.name}: Has hot tub. ${p.description}`).join('\n')}
      `.trim();

    case 'reviews':
      return `Recent Reviews:\n${PropertyKnowledge.reviews.slice(0, 10).map(r =>
        `- ${PropertyKnowledge.all.find(p => p.id === r.propertyId)?.name || r.propertyId} (${r.platform}): "${r.comment}" - ${r.guestName}, ${r.rating}/5 stars`
      ).join('\n')}`;

    case 'restaurants':
      return `Top Restaurants in Midland:\n${LocalGuide.restaurants.map(r =>
        `- ${r.name} (${r.cuisine}, ${r.priceRange}): ${r.description} - Hours: ${r.hours}`
      ).join('\n')}`;

    case 'bars':
      return `Bars & Nightlife:\n${LocalGuide.bars.map(b =>
        `- ${b.name} (${b.type}): ${b.description} - Features: ${b.features.join(', ')}`
      ).join('\n')}`;

    case 'events':
      return `Upcoming Events:\n${LocalGuide.events.map(e =>
        `- ${e.name} (${e.date}): ${e.description} - ${e.venue}, ${e.time}. ${e.price || 'Free'}`
      ).join('\n')}`;

    case 'hardware_store':
      return `Hardware Stores (Open Early for Work Crews):\n${workCrewResources.hardwareStores.map(h =>
        `- ${h.name}: ${h.address}\n  Hours: ${h.hours}\n  Notes: ${h.notes}`
      ).join('\n\n')}`;

    case 'laundry':
      return `Laundromats (with large machines for work clothes):\n${workCrewResources.laundromats.map(l =>
        `- ${l.name}: ${l.address}\n  Hours: ${l.hours}\n  ${l.hasLargeMachines ? 'Has industrial/large machines!' : ''}\n  ${l.notes}`
      ).join('\n\n')}`;

    default:
      return buildFullKnowledgeBase();
  }
}

// ============================================
// MAIN CONCIERGE BRAIN
// ============================================

export interface ConciergeResponse {
  response: string;
  intent: QueryIntent;
  context: string;
  propertyMentioned?: string;
  followUpSuggestions?: string[];
}

export async function processQuery(
  query: string,
  sessionId: string,
  propertyId?: string
): Promise<{ systemPrompt: string; userContext: string; intent: QueryIntent }> {
  const intent = detectIntent(query);
  const contextInfo = getContextForIntent(intent, query);

  // Store query in memory for context continuity
  await FirebaseMemory.session.addMessage(sessionId, 'user', query);

  const systemPrompt = `You are the AI Concierge for Right at Home BnB in Midland, Texas.
You work for Steven Palma who owns 22+ rental properties.

YOUR PERSONALITY:
- Friendly, helpful, and professional
- Like a knowledgeable local friend
- Understand that many guests are oil field workers and construction crews
- Practical and efficient - workers appreciate quick, useful answers

KEY FACTS:
- Most guests are work crews on extended stays (weeks or months)
- Properties are equipped for multiple workers sharing
- All properties have washer/dryer for dirty work clothes
- WiFi is provided for evening relaxation
- Steven is responsive and available for issues

RULES:
1. Always be helpful and provide specific, actionable information
2. If asked about availability, mention they should check the booking calendar or contact Steven
3. For amenity questions, be SPECIFIC about which properties have what
4. Recommend restaurants/bars that are open late for workers on varying shifts
5. Know that hardware stores like Home Depot open at 6am for early crews
6. Provide door codes and WiFi passwords when guests ask (they're authorized)

CURRENT CONTEXT:
${contextInfo}

Answer the guest's question directly and helpfully. Be concise but thorough.`;

  return {
    systemPrompt,
    userContext: contextInfo,
    intent,
  };
}

// ============================================
// EXPORT
// ============================================

export const ConciergeBrain = {
  processQuery,
  detectIntent,
  getContextForIntent,
  buildFullKnowledgeBase,
  checkAvailability,
  getNextAvailableWeek,
  workCrewResources,
  PropertyKnowledge,
  LocalGuide,
};

export default ConciergeBrain;
