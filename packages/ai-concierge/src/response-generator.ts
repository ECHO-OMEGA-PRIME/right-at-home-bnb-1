/**
 * Right at Home BnB - Response Generator
 * Generates helpful AI responses for guest queries
 */

import type {
  GuestIntent,
  PropertyContext,
  GuestContext,
  ConciergeResponse,
  ConciergeAction,
  PrebuiltResponse,
  LocalRecommendation,
  MidlandLocalGuide,
} from './types';
import { IntentClassifier } from './intent-classifier';

/**
 * Pre-built responses for common queries
 * Variables use {{variable}} syntax
 */
const PREBUILT_RESPONSES: PrebuiltResponse[] = [
  {
    intent: 'WIFI_INFO',
    patterns: ['wifi', 'internet', 'password'],
    response: `Here's the WiFi information for {{propertyName}}:

Network: {{wifiNetwork}}
Password: {{wifiPassword}}

The router is located {{routerLocation}}. If you have any connection issues, try turning WiFi off and on, or restarting your device. Let me know if you need any other help!`,
    variables: ['propertyName', 'wifiNetwork', 'wifiPassword', 'routerLocation'],
    followUp: 'Is the WiFi working well for you?',
  },
  {
    intent: 'CHECK_IN',
    patterns: ['check in', 'check-in', 'arrival'],
    response: `Welcome to {{propertyName}}! Here are your check-in details:

Check-in Time: 3:00 PM
Access Code: {{accessCode}}

{{checkInInstructions}}

The property address is: {{address}}

If you arrive early, feel free to leave luggage on the porch. Let me know when you've arrived safely!`,
    variables: ['propertyName', 'accessCode', 'checkInInstructions', 'address'],
  },
  {
    intent: 'CHECK_OUT',
    patterns: ['check out', 'checkout', 'leaving'],
    response: `Thank you for staying at {{propertyName}}! Here are the check-out details:

Check-out Time: 11:00 AM

{{checkOutInstructions}}

Please ensure:
- All doors and windows are locked
- Thermostat is set to 72°F
- Lights are turned off
- Trash is taken to the outside bin

We hope you enjoyed your stay and would love to host you again!`,
    variables: ['propertyName', 'checkOutInstructions'],
  },
  {
    intent: 'PARKING',
    patterns: ['parking', 'park', 'car'],
    response: `Here's the parking information for {{propertyName}}:

{{parkingInfo}}

Please don't block the driveway or park on the lawn. Street parking is also available if needed.`,
    variables: ['propertyName', 'parkingInfo'],
  },
  {
    intent: 'HOUSE_RULES',
    patterns: ['rules', 'policy', 'allowed'],
    response: `Here are the house rules for {{propertyName}}:

{{houseRules}}

Key points:
- Quiet hours: 10 PM - 8 AM
- No smoking inside (designated outdoor area available)
- No parties or events without prior approval
- Maximum occupancy: {{maxGuests}} guests

Please respect our neighbors and the property. Thank you for understanding!`,
    variables: ['propertyName', 'houseRules', 'maxGuests'],
  },
  {
    intent: 'EMERGENCY',
    patterns: ['emergency', 'urgent', 'help'],
    response: `I understand this is urgent. Here's what to do:

FOR LIFE-THREATENING EMERGENCIES: Call 911 immediately

For property emergencies:
- Fire/Gas: Evacuate and call 911, then contact us
- Water leak: Turn off water main (located {{waterMainLocation}})
- Power outage: Check breaker box (located {{breakerLocation}})

Emergency Contact: {{emergencyPhone}}
Host Contact: {{hostPhone}}

I'm also alerting the property manager right now. Stay safe!`,
    variables: ['waterMainLocation', 'breakerLocation', 'emergencyPhone', 'hostPhone'],
  },
  {
    intent: 'AMENITIES',
    patterns: ['amenities', 'features', 'what\'s available'],
    response: `{{propertyName}} includes these amenities:

{{amenitiesList}}

Everything you need should be available. The TV remote is on the coffee table, and kitchen supplies are in the cabinets. Let me know if you need help finding anything!`,
    variables: ['propertyName', 'amenitiesList'],
  },
  {
    intent: 'MAINTENANCE',
    patterns: ['broken', 'not working', 'fix'],
    response: `I'm sorry to hear something isn't working properly. I'm logging this maintenance issue right away.

Please provide a bit more detail:
1. What exactly is the issue?
2. Where is it located?
3. When did you first notice it?

Our maintenance team typically responds within 2-4 hours for urgent issues. If this is affecting your safety or comfort, we may be able to arrange alternative accommodations.

I've notified {{hostName}} who will reach out shortly.`,
    variables: ['hostName'],
  },
  {
    intent: 'EARLY_CHECKIN',
    patterns: ['early check-in', 'arrive early'],
    response: `I understand you'd like to check in early at {{propertyName}}.

Standard check-in is at 3:00 PM. Early check-in availability depends on whether the property is ready after the previous guest's departure and cleaning.

I'm sending your request to the host now. They'll confirm if early check-in is possible and any additional fees that may apply (typically $25-50 depending on how early).

What time were you hoping to arrive?`,
    variables: ['propertyName'],
  },
  {
    intent: 'LATE_CHECKOUT',
    patterns: ['late checkout', 'leave later', 'extend'],
    response: `I understand you'd like a late check-out from {{propertyName}}.

Standard check-out is at 11:00 AM. Late check-out depends on whether there's another guest arriving that day.

I'm checking availability now and will let you know. Late check-out fees (if available):
- Until 1 PM: $25
- Until 3 PM: $50
- Full extra night: {{nightlyRate}}

What time did you have in mind?`,
    variables: ['propertyName', 'nightlyRate'],
  },
  {
    intent: 'COMPLIMENT',
    patterns: ['thank', 'great', 'amazing', 'love'],
    response: `Thank you so much for the kind words! We're thrilled you're enjoying your stay at {{propertyName}}.

{{hostName}} takes great pride in providing a wonderful experience for guests. If there's anything else we can do to make your stay even better, please don't hesitate to ask!

We'd love it if you could leave us a review after your stay - it really helps other travelers find us.`,
    variables: ['propertyName', 'hostName'],
  },
  {
    intent: 'COMPLAINT',
    patterns: ['unhappy', 'disappointed', 'complaint'],
    response: `I'm truly sorry to hear you're not having the experience you expected at {{propertyName}}. Your satisfaction is our top priority.

Please share the specific issues you're experiencing so we can address them right away. We're committed to making this right.

I've flagged this as high priority and {{hostName}} will be in touch within the hour to discuss how we can improve your stay, including potential compensation if warranted.

What would help make this better for you?`,
    variables: ['propertyName', 'hostName'],
  },
];

/**
 * Midland, TX Local Guide - Real local recommendations
 */
const MIDLAND_LOCAL_GUIDE: MidlandLocalGuide = {
  restaurants: [
    {
      category: 'restaurant',
      name: 'The Garlic Press',
      description: 'Upscale American cuisine with excellent steaks and seafood',
      address: '2200 W Wadley Ave, Midland, TX',
      distance: '5 min drive',
      priceRange: '$$$',
      hours: 'Mon-Sat 11am-10pm',
      phone: '(432) 570-4020',
      highlights: ['Date night spot', 'Great wine list', 'Reservations recommended'],
      hostTip: 'Try the garlic bread appetizer - it\'s legendary!',
    },
    {
      category: 'restaurant',
      name: 'Wall Street Bar & Grill',
      description: 'Popular spot for burgers, steaks, and casual dining',
      address: '115 E Wall St, Midland, TX',
      distance: '10 min drive',
      priceRange: '$$',
      hours: 'Daily 11am-2am',
      phone: '(432) 684-8686',
      highlights: ['Great burgers', 'Sports bar', 'Late night menu'],
    },
    {
      category: 'restaurant',
      name: 'Venezia Italian Restaurant',
      description: 'Authentic Italian cuisine in a cozy setting',
      address: '2101 W Wadley Ave, Midland, TX',
      distance: '5 min drive',
      priceRange: '$$',
      hours: 'Mon-Sat 11am-9pm',
      phone: '(432) 687-0100',
      highlights: ['Homemade pasta', 'Family-friendly', 'Great lunch specials'],
    },
    {
      category: 'restaurant',
      name: 'Rosa\'s Cafe',
      description: 'Fast-casual Tex-Mex with fresh tortillas made in-house',
      address: 'Multiple locations in Midland',
      distance: 'Varies',
      priceRange: '$',
      hours: 'Daily 6am-10pm',
      highlights: ['Quick & affordable', 'Breakfast tacos', 'Drive-thru'],
      hostTip: 'Best breakfast tacos in town - try the brisket!',
    },
    {
      category: 'restaurant',
      name: 'Ki Mexico',
      description: 'Contemporary Mexican cuisine with creative cocktails',
      address: '4610 N Garfield St, Midland, TX',
      distance: '8 min drive',
      priceRange: '$$',
      hours: 'Daily 11am-10pm',
      phone: '(432) 699-0900',
      highlights: ['Modern Mexican', 'Great margaritas', 'Trendy atmosphere'],
    },
  ],
  bars: [
    {
      category: 'bar',
      name: 'The Blue Door',
      description: 'Craft cocktails and live music in downtown Midland',
      address: '119 S Main St, Midland, TX',
      distance: '10 min drive',
      priceRange: '$$',
      hours: 'Tue-Sat 5pm-2am',
      highlights: ['Live music', 'Craft cocktails', 'Hip atmosphere'],
    },
    {
      category: 'bar',
      name: 'Petrolero Taproom',
      description: 'Local craft beer taproom with rotating selections',
      address: '200 N Main St, Midland, TX',
      distance: '10 min drive',
      priceRange: '$$',
      hours: 'Daily 4pm-12am',
      highlights: ['Local craft beer', 'Laid-back vibe', 'Food trucks'],
    },
  ],
  coffee: [
    {
      category: 'coffee',
      name: 'Brew St. Bakery',
      description: 'Local coffee shop with fresh pastries and breakfast',
      address: '500 W Illinois Ave, Midland, TX',
      distance: '8 min drive',
      priceRange: '$',
      hours: 'Mon-Fri 6am-6pm, Sat 7am-5pm',
      highlights: ['Fresh pastries', 'Great espresso', 'Quiet workspace'],
    },
    {
      category: 'coffee',
      name: 'Starbucks',
      description: 'Classic Starbucks with drive-thru',
      address: 'Multiple locations',
      distance: 'Varies',
      priceRange: '$$',
      hours: 'Daily 5am-10pm',
    },
  ],
  grocery: [
    {
      category: 'grocery',
      name: 'H-E-B',
      description: 'Texas-based grocery chain with excellent selection',
      address: '4517 N Midkiff Rd, Midland, TX',
      distance: '10 min drive',
      hours: 'Daily 6am-11pm',
      highlights: ['Great deli', 'Fresh produce', 'Texas favorites'],
      hostTip: 'H-E-B is the best grocery store in Texas - try their house brand products!',
    },
    {
      category: 'grocery',
      name: 'Market Street',
      description: 'Upscale grocery with prepared foods',
      address: '4611 N Garfield St, Midland, TX',
      distance: '8 min drive',
      hours: 'Daily 6am-10pm',
      highlights: ['Prepared meals', 'Wine selection', 'Pharmacy'],
    },
    {
      category: 'grocery',
      name: 'Walmart Supercenter',
      description: 'One-stop shop for groceries and essentials',
      address: '4517 N Midland Dr, Midland, TX',
      distance: '10 min drive',
      hours: 'Daily 6am-11pm',
      highlights: ['Low prices', 'Everything you need', '24-hour pharmacy'],
    },
  ],
  attractions: [
    {
      category: 'attraction',
      name: 'Petroleum Museum',
      description: 'Learn about the oil industry that built Midland',
      address: '1500 I-20 W, Midland, TX',
      distance: '15 min drive',
      priceRange: '$',
      hours: 'Mon-Sat 10am-5pm, Sun 2pm-5pm',
      highlights: ['Educational', 'Kid-friendly', 'Texas history'],
      hostTip: 'Great for understanding why Midland exists!',
    },
    {
      category: 'attraction',
      name: 'Sibley Nature Center',
      description: 'Nature preserve with hiking trails and wildlife',
      address: '1307 E Wadley Ave, Midland, TX',
      distance: '10 min drive',
      priceRange: 'Free',
      hours: 'Tue-Sat 9am-5pm',
      highlights: ['Hiking trails', 'Wildlife viewing', 'Free admission'],
    },
    {
      category: 'attraction',
      name: 'Museum of the Southwest',
      description: 'Art museum with rotating exhibits and planetarium',
      address: '1705 W Missouri Ave, Midland, TX',
      distance: '12 min drive',
      priceRange: '$',
      hours: 'Tue-Sat 10am-5pm',
      highlights: ['Art exhibits', 'Planetarium shows', 'Beautiful grounds'],
    },
    {
      category: 'attraction',
      name: 'I-20 Wildlife Preserve',
      description: 'Urban wetland with bird watching and nature trails',
      address: '2201 S Midland Dr, Midland, TX',
      distance: '15 min drive',
      priceRange: 'Free',
      hours: 'Sunrise to sunset',
      highlights: ['Bird watching', 'Photography', 'Peaceful walks'],
    },
  ],
  familyFriendly: [
    {
      category: 'entertainment',
      name: 'Adventure Zone',
      description: 'Indoor play area with arcade and laser tag',
      address: '4400 N Big Spring St, Midland, TX',
      distance: '8 min drive',
      priceRange: '$$',
      hours: 'Mon-Thu 10am-9pm, Fri-Sat 10am-10pm',
      highlights: ['Laser tag', 'Arcade', 'Birthday parties'],
    },
    {
      category: 'entertainment',
      name: 'Cinemark Tinseltown',
      description: 'Movie theater with IMAX and XD screens',
      address: '4425 W Loop 250 N, Midland, TX',
      distance: '10 min drive',
      priceRange: '$$',
      hours: 'Varies by showtime',
      highlights: ['IMAX', 'Reclining seats', 'Great concessions'],
    },
    {
      category: 'entertainment',
      name: 'Hogan Park',
      description: 'Large city park with pool, golf, and playgrounds',
      address: '2201 N Fairgrounds Rd, Midland, TX',
      distance: '10 min drive',
      priceRange: 'Free/$',
      hours: 'Sunrise to sunset',
      highlights: ['Swimming pool', 'Golf course', 'Playgrounds'],
    },
  ],
  oilFieldServices: [
    {
      category: 'coffee',
      name: 'Industry-Friendly Spots',
      description: 'Early morning coffee and breakfast for oilfield workers',
      address: 'Various',
      distance: 'N/A',
      highlights: ['Open early', 'Quick service', 'To-go options'],
      hostTip: 'Many restaurants open at 5-6 AM for oilfield shift workers.',
    },
  ],
};

export class ResponseGenerator {
  private intentClassifier: IntentClassifier;
  private localGuide: MidlandLocalGuide;

  constructor() {
    this.intentClassifier = new IntentClassifier();
    this.localGuide = MIDLAND_LOCAL_GUIDE;
  }

  /**
   * Generate a response for a guest query
   */
  generateResponse(
    query: string,
    propertyContext: PropertyContext,
    guestContext?: GuestContext
  ): ConciergeResponse {
    const classification = this.intentClassifier.classify(query);
    const { intent, confidence, sentiment, urgency } = classification;

    // Check for pre-built response first
    const prebuilt = this.findPrebuiltResponse(intent);

    let message: string;
    let actions: ConciergeAction[] = [];
    let suggestions: string[] = [];
    let requiresHumanFollowUp = false;

    if (prebuilt && confidence > 0.6) {
      message = this.interpolateResponse(prebuilt.response, propertyContext, guestContext);
      if (prebuilt.followUp) {
        suggestions.push(prebuilt.followUp);
      }
    } else {
      // Generate dynamic response based on intent
      const result = this.generateDynamicResponse(
        intent,
        query,
        propertyContext,
        guestContext
      );
      message = result.message;
      suggestions = result.suggestions;
    }

    // Determine required actions
    actions = this.determineActions(intent, urgency, sentiment);
    requiresHumanFollowUp = this.requiresHuman(intent, urgency, confidence);

    // Add intent-specific suggestions
    suggestions = [...suggestions, ...this.getIntentSuggestions(intent)];

    return {
      message,
      intent,
      confidence,
      suggestions: suggestions.slice(0, 3),
      actions,
      requiresHumanFollowUp,
      sentiment,
    };
  }

  /**
   * Find a pre-built response for an intent
   */
  private findPrebuiltResponse(intent: GuestIntent): PrebuiltResponse | undefined {
    return PREBUILT_RESPONSES.find((r) => r.intent === intent);
  }

  /**
   * Interpolate variables in a response template
   */
  private interpolateResponse(
    template: string,
    property: PropertyContext,
    guest?: GuestContext
  ): string {
    let result = template;

    // Property variables
    result = result.replace(/\{\{propertyName\}\}/g, property.propertyName);
    result = result.replace(/\{\{address\}\}/g, property.address);
    result = result.replace(/\{\{wifiNetwork\}\}/g, property.wifiNetwork || 'See house manual');
    result = result.replace(/\{\{wifiPassword\}\}/g, property.wifiPassword || 'See house manual');
    result = result.replace(/\{\{checkInInstructions\}\}/g, property.checkInInstructions || 'Standard check-in applies.');
    result = result.replace(/\{\{checkOutInstructions\}\}/g, property.checkOutInstructions || 'Standard check-out applies.');
    result = result.replace(/\{\{parkingInfo\}\}/g, property.parkingInfo || 'Driveway parking available.');
    result = result.replace(/\{\{houseRules\}\}/g, property.houseRules || 'Standard house rules apply.');
    result = result.replace(/\{\{amenitiesList\}\}/g, property.amenities.join('\n- ') || 'Standard amenities');

    // Guest variables
    if (guest) {
      result = result.replace(/\{\{guestName\}\}/g, guest.guestName);
      result = result.replace(/\{\{accessCode\}\}/g, 'Your access code will be sent separately');
    }

    // Default values for any remaining variables
    result = result.replace(/\{\{routerLocation\}\}/g, 'near the TV');
    result = result.replace(/\{\{waterMainLocation\}\}/g, 'in the garage');
    result = result.replace(/\{\{breakerLocation\}\}/g, 'in the garage');
    result = result.replace(/\{\{emergencyPhone\}\}/g, '(432) 555-0123');
    result = result.replace(/\{\{hostPhone\}\}/g, '(432) 555-0124');
    result = result.replace(/\{\{hostName\}\}/g, 'Steven');
    result = result.replace(/\{\{maxGuests\}\}/g, '6');
    result = result.replace(/\{\{nightlyRate\}\}/g, 'the standard nightly rate');

    return result;
  }

  /**
   * Generate dynamic response for intents without pre-built templates
   */
  private generateDynamicResponse(
    intent: GuestIntent,
    query: string,
    property: PropertyContext,
    guest?: GuestContext
  ): { message: string; suggestions: string[] } {
    switch (intent) {
      case 'LOCAL_RESTAURANTS':
        return this.generateRestaurantRecommendations(query);

      case 'LOCAL_ATTRACTIONS':
        return this.generateAttractionRecommendations(query);

      case 'SHOPPING':
        return this.generateShoppingRecommendations();

      case 'NIGHTLIFE':
        return this.generateNightlifeRecommendations();

      case 'FAMILY_ACTIVITIES':
        return this.generateFamilyRecommendations();

      case 'TRANSPORTATION':
        return this.generateTransportationInfo();

      case 'WEATHER':
        return this.generateWeatherResponse();

      case 'BUSINESS_SERVICES':
        return this.generateBusinessServicesInfo();

      case 'EXTRA_GUESTS':
        return {
          message: `I understand you'd like to bring additional guests to ${property.propertyName}.

The maximum occupancy is listed in the booking details. Additional guests beyond the original booking may require:
- Host approval
- Additional fee ($25/person/night)
- Verification that it doesn't exceed the max occupancy

Would you like me to submit this request to the host?`,
          suggestions: ['What is the maximum occupancy?', 'Contact the host'],
        };

      case 'PETS':
        return {
          message: `Thanks for asking about pets! Pet policies vary by property.

Please note:
- Pet-friendly properties allow dogs only (no cats, birds, or exotic pets)
- A pet fee of $50-100 typically applies
- Pets must be house-trained and supervised

Let me check if ${property.propertyName} is pet-friendly. What kind of pet do you have?`,
          suggestions: ['Contact host about pets', 'What are the pet rules?'],
        };

      case 'BOOKING_INQUIRY':
        return {
          message: `I'd be happy to help with your booking inquiry!

For ${property.propertyName}, please let me know:
- What dates are you interested in?
- How many guests?
- Any special requirements?

I can check availability and provide pricing, or the host can provide a custom quote.`,
          suggestions: ['Check availability', 'Get a price quote', 'Contact the host'],
        };

      default:
        return {
          message: `Thank you for your message! I'm here to help with any questions about ${property.propertyName}.

I can assist with:
- Check-in/check-out information
- WiFi and amenities
- Local recommendations (restaurants, attractions)
- Any issues during your stay

What would you like to know?`,
          suggestions: ['WiFi password', 'Check-in instructions', 'Local restaurants'],
        };
    }
  }

  /**
   * Generate restaurant recommendations
   */
  private generateRestaurantRecommendations(query: string): { message: string; suggestions: string[] } {
    const restaurants = this.localGuide.restaurants;
    const queryLower = query.toLowerCase();

    // Filter based on query keywords
    let filtered = restaurants;
    if (queryLower.includes('mexican') || queryLower.includes('tex-mex')) {
      filtered = restaurants.filter(r =>
        r.name.toLowerCase().includes('mexico') ||
        r.description.toLowerCase().includes('mexican')
      );
    } else if (queryLower.includes('italian')) {
      filtered = restaurants.filter(r => r.description.toLowerCase().includes('italian'));
    } else if (queryLower.includes('cheap') || queryLower.includes('affordable')) {
      filtered = restaurants.filter(r => r.priceRange === '$');
    } else if (queryLower.includes('fancy') || queryLower.includes('nice') || queryLower.includes('date')) {
      filtered = restaurants.filter(r => r.priceRange === '$$$');
    }

    if (filtered.length === 0) filtered = restaurants.slice(0, 3);

    const recList = filtered.slice(0, 3).map(r =>
      `**${r.name}** (${r.priceRange})
${r.description}
Address: ${r.address}
${r.hostTip ? `Host Tip: ${r.hostTip}` : ''}`
    ).join('\n\n');

    return {
      message: `Here are my top restaurant recommendations in Midland:\n\n${recList}\n\nWould you like more specific recommendations or different cuisine options?`,
      suggestions: ['Mexican food options', 'Best steakhouse', 'Quick lunch spots'],
    };
  }

  /**
   * Generate attraction recommendations
   */
  private generateAttractionRecommendations(query: string): { message: string; suggestions: string[] } {
    const attractions = this.localGuide.attractions;

    const recList = attractions.slice(0, 3).map(a =>
      `**${a.name}** (${a.priceRange})
${a.description}
Address: ${a.address}
Hours: ${a.hours}
${a.hostTip ? `Host Tip: ${a.hostTip}` : ''}`
    ).join('\n\n');

    return {
      message: `Here are some great things to do in Midland:\n\n${recList}\n\nMidland is known for its oil industry heritage, so the Petroleum Museum is definitely worth a visit! Would you like more suggestions?`,
      suggestions: ['Family activities', 'Free things to do', 'Nature and outdoors'],
    };
  }

  /**
   * Generate shopping recommendations
   */
  private generateShoppingRecommendations(): { message: string; suggestions: string[] } {
    const grocery = this.localGuide.grocery;

    const groceryList = grocery.slice(0, 2).map(g =>
      `**${g.name}**
${g.description}
Address: ${g.address}
Hours: ${g.hours}`
    ).join('\n\n');

    return {
      message: `Here are the best shopping options in Midland:\n\n**Grocery Stores:**\n${groceryList}\n\n**Shopping Centers:**
- Midland Park Mall (4511 N Midkiff Rd) - Main mall with major retailers
- Market Street area - Various shops and restaurants

H-E-B is the local favorite and has everything you need!`,
      suggestions: ['Where is the nearest Walmart?', 'Best grocery store', 'Mall hours'],
    };
  }

  /**
   * Generate nightlife recommendations
   */
  private generateNightlifeRecommendations(): { message: string; suggestions: string[] } {
    const bars = this.localGuide.bars;

    const barList = bars.map(b =>
      `**${b.name}**
${b.description}
Address: ${b.address}
Hours: ${b.hours}`
    ).join('\n\n');

    return {
      message: `Here's the nightlife scene in Midland:\n\n${barList}\n\nMidland's downtown area (around Main Street) has several bars and restaurants. Many restaurants like Wall Street Bar & Grill also have great bar scenes.

Note: Texas bars close at 2 AM, and last call is typically around 1:30 AM.`,
      suggestions: ['Live music venues', 'Happy hour spots', 'Late night food'],
    };
  }

  /**
   * Generate family activity recommendations
   */
  private generateFamilyRecommendations(): { message: string; suggestions: string[] } {
    const family = this.localGuide.familyFriendly;

    const actList = family.slice(0, 3).map(a =>
      `**${a.name}** (${a.priceRange})
${a.description}
Address: ${a.address}
Hours: ${a.hours}`
    ).join('\n\n');

    return {
      message: `Great family activities in Midland:\n\n${actList}\n\nThe Museum of the Southwest also has a planetarium with shows that kids love!`,
      suggestions: ['Indoor activities', 'Parks and playgrounds', 'Movie theaters'],
    };
  }

  /**
   * Generate transportation info
   */
  private generateTransportationInfo(): { message: string; suggestions: string[] } {
    return {
      message: `Here's how to get around Midland:

**Rideshare:**
- Uber and Lyft are available but can have longer wait times than major cities
- Typical wait: 5-15 minutes

**Rental Cars:**
- Available at Midland International Airport (MAF)
- Recommended for exploring the area

**Airport:**
- Midland International Airport (MAF) is about 10 miles from downtown
- Serves American, United, and Southwest airlines

**Local Tip:** Most visitors rent a car as Midland is spread out and doesn't have great public transit. Uber works fine for bar hopping downtown though!`,
      suggestions: ['Airport shuttle options', 'Rental car companies', 'Taxi services'],
    };
  }

  /**
   * Generate weather response
   */
  private generateWeatherResponse(): { message: string; suggestions: string[] } {
    return {
      message: `Midland, TX Weather:

Midland has a semi-arid climate with hot summers and mild winters.

**Typical conditions:**
- Summer (Jun-Aug): Hot! 95-105°F, very sunny
- Fall (Sep-Nov): Pleasant, 70-85°F
- Winter (Dec-Feb): Mild, 45-65°F, occasional cold fronts
- Spring (Mar-May): Warm, 70-90°F, possible dust storms

**Packing tips:**
- Always bring sunscreen and sunglasses
- Light, breathable clothing in summer
- Layers in winter (temperatures can swing 30+ degrees in a day)

For current conditions, I recommend checking Weather.com or your phone's weather app!`,
      suggestions: ['What to wear today', 'Will it rain?', 'Best time to visit'],
    };
  }

  /**
   * Generate business services info
   */
  private generateBusinessServicesInfo(): { message: string; suggestions: string[] } {
    return {
      message: `Business services in Midland:

**Printing & Shipping:**
- FedEx Office: 3211 W Wadley Ave
- UPS Store: Multiple locations
- Staples: 4400 N Midkiff Rd

**Coworking Spaces:**
- Many coffee shops offer good WiFi for remote work
- Brew St. Bakery is popular with remote workers

**The property has:**
- High-speed WiFi
- Desk/workspace area
- Good cell coverage

Need anything specific for work during your stay?`,
      suggestions: ['Nearest FedEx', 'Best coffee shop for work', 'WiFi speed'],
    };
  }

  /**
   * Determine required actions based on intent
   */
  private determineActions(
    intent: GuestIntent,
    urgency: 'low' | 'medium' | 'high' | 'critical',
    sentiment: 'positive' | 'negative' | 'neutral'
  ): ConciergeAction[] {
    const actions: ConciergeAction[] = [];

    // Emergency always requires immediate notification
    if (intent === 'EMERGENCY' || urgency === 'critical') {
      actions.push({
        type: 'NOTIFY_HOST',
        priority: 'urgent',
        description: 'EMERGENCY: Guest requires immediate assistance',
      });
      actions.push({
        type: 'ESCALATE',
        priority: 'urgent',
        description: 'Emergency escalation triggered',
      });
    }

    // Maintenance issues
    if (intent === 'MAINTENANCE') {
      actions.push({
        type: 'CREATE_TICKET',
        priority: urgency === 'high' ? 'high' : 'medium',
        description: 'Maintenance request submitted',
      });
      actions.push({
        type: 'NOTIFY_HOST',
        priority: urgency === 'high' ? 'high' : 'medium',
        description: 'Maintenance issue reported',
      });
    }

    // Complaints require host notification
    if (intent === 'COMPLAINT' || sentiment === 'negative') {
      actions.push({
        type: 'NOTIFY_HOST',
        priority: 'high',
        description: 'Guest complaint or negative feedback',
      });
    }

    // Early check-in / late checkout requests
    if (intent === 'EARLY_CHECKIN' || intent === 'LATE_CHECKOUT') {
      actions.push({
        type: 'NOTIFY_HOST',
        priority: 'medium',
        description: `Guest requesting ${intent === 'EARLY_CHECKIN' ? 'early check-in' : 'late checkout'}`,
      });
    }

    // Log all queries
    actions.push({
      type: 'LOG_ONLY',
      priority: 'low',
      description: 'Query logged for analytics',
    });

    return actions;
  }

  /**
   * Determine if human follow-up is required
   */
  private requiresHuman(
    intent: GuestIntent,
    urgency: 'low' | 'medium' | 'high' | 'critical',
    confidence: number
  ): boolean {
    // Always require human for emergencies
    if (intent === 'EMERGENCY' || urgency === 'critical') return true;

    // Require human for complaints
    if (intent === 'COMPLAINT') return true;

    // Require human for booking/pricing questions
    if (intent === 'BOOKING_INQUIRY') return true;

    // Require human for low confidence responses
    if (confidence < 0.5) return true;

    // Require human for maintenance
    if (intent === 'MAINTENANCE') return true;

    return false;
  }

  /**
   * Get follow-up suggestions based on intent
   */
  private getIntentSuggestions(intent: GuestIntent): string[] {
    const suggestions: Record<GuestIntent, string[]> = {
      WIFI_INFO: ['Is the WiFi working well?', 'Need help connecting?'],
      CHECK_IN: ['Need directions?', 'Any special requests?'],
      CHECK_OUT: ['Need late checkout?', 'How was your stay?'],
      PARKING: ['Need help finding the spot?'],
      HOUSE_RULES: ['Any other questions?'],
      LOCAL_RESTAURANTS: ['What cuisine do you prefer?', 'Need reservations?'],
      LOCAL_ATTRACTIONS: ['Looking for something specific?'],
      EMERGENCY: [],
      AMENITIES: ['Need help finding something?'],
      MAINTENANCE: ['Is it urgent?', 'Would you like to call instead?'],
      EARLY_CHECKIN: ['What time would work?'],
      LATE_CHECKOUT: ['What time did you have in mind?'],
      EXTRA_GUESTS: ['How many additional guests?'],
      PETS: ['What type of pet?'],
      COMPLAINT: ['How can we make this right?'],
      COMPLIMENT: ['Would you leave us a review?'],
      GENERAL_QUESTION: ['What else can I help with?'],
      BOOKING_INQUIRY: ['What dates are you looking at?'],
      TRANSPORTATION: ['Need a ride somewhere?'],
      WEATHER: ['Planning outdoor activities?'],
      SHOPPING: ['Looking for something specific?'],
      NIGHTLIFE: ['Any preferences?'],
      FAMILY_ACTIVITIES: ['Ages of the kids?'],
      BUSINESS_SERVICES: ['What do you need?'],
      UNKNOWN: ['Can you tell me more?', 'What do you need help with?'],
    };

    return suggestions[intent] || [];
  }

  /**
   * Get local recommendations by category
   */
  getLocalRecommendations(category: keyof MidlandLocalGuide): LocalRecommendation[] {
    return this.localGuide[category] || [];
  }
}

export const responseGenerator = new ResponseGenerator();
