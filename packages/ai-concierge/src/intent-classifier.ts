/**
 * Right at Home BnB - Intent Classifier
 * Classifies guest queries into actionable intents
 */

import type {
  GuestIntent,
  IntentClassification,
  ExtractedEntity,
} from './types';

interface IntentPattern {
  intent: GuestIntent;
  patterns: RegExp[];
  keywords: string[];
  weight: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'WIFI_INFO',
    patterns: [
      /wifi|wi-fi|internet|network|password|connect/i,
      /how\s+do\s+i\s+(get\s+)?online/i,
      /what('s|s)?\s+(the\s+)?wifi/i,
    ],
    keywords: ['wifi', 'internet', 'password', 'network', 'connect', 'online', 'wireless'],
    weight: 1.0,
  },
  {
    intent: 'CHECK_IN',
    patterns: [
      /check(\s*|-)?in/i,
      /arrive|arrival|get\s+in|entering/i,
      /what\s+time\s+can\s+(i|we)\s+(come|arrive)/i,
      /early\s+arrival/i,
      /access\s+code|door\s+code|entry/i,
    ],
    keywords: ['checkin', 'check-in', 'arrive', 'arrival', 'access', 'entry', 'code', 'keys'],
    weight: 1.0,
  },
  {
    intent: 'CHECK_OUT',
    patterns: [
      /check(\s*|-)?out/i,
      /leave|leaving|departure|depart/i,
      /what\s+time\s+(do\s+)?(i|we)\s+(have\s+to\s+)?leave/i,
      /late\s+departure/i,
    ],
    keywords: ['checkout', 'check-out', 'leave', 'leaving', 'departure'],
    weight: 1.0,
  },
  {
    intent: 'PARKING',
    patterns: [
      /park(ing)?/i,
      /where\s+(can|do|should)\s+(i|we)\s+park/i,
      /car|vehicle|garage|driveway/i,
    ],
    keywords: ['parking', 'park', 'car', 'vehicle', 'garage', 'driveway', 'street'],
    weight: 1.0,
  },
  {
    intent: 'HOUSE_RULES',
    patterns: [
      /rules?|policy|policies/i,
      /allowed|permit(ted)?|can\s+(i|we)/i,
      /smok(e|ing)|quiet\s+hours|noise/i,
      /party|parties|event/i,
    ],
    keywords: ['rules', 'policy', 'allowed', 'smoking', 'pets', 'quiet', 'noise', 'party'],
    weight: 1.0,
  },
  {
    intent: 'LOCAL_RESTAURANTS',
    patterns: [
      /restaurant|food|eat(ing)?|dinner|lunch|breakfast|brunch/i,
      /where\s+(can|should)\s+(i|we)\s+eat/i,
      /recommend.*food|food.*recommend/i,
      /best\s+place\s+to\s+eat/i,
      /hungry|cuisine|takeout|delivery/i,
    ],
    keywords: ['restaurant', 'food', 'eat', 'dinner', 'lunch', 'breakfast', 'hungry', 'cuisine'],
    weight: 1.0,
  },
  {
    intent: 'LOCAL_ATTRACTIONS',
    patterns: [
      /attraction|things\s+to\s+do|activities|sights?/i,
      /what\s+(can|should)\s+(i|we)\s+do/i,
      /recommend.*do|visit|explore/i,
      /entertainment|fun|museum|park/i,
    ],
    keywords: ['attractions', 'activities', 'visit', 'explore', 'fun', 'museum', 'entertainment'],
    weight: 1.0,
  },
  {
    intent: 'EMERGENCY',
    patterns: [
      /emergency|urgent|help|911/i,
      /fire|flood|gas\s+leak|break(\s*|-)?in|broken\s+into/i,
      /injured|hurt|medical|ambulance|police/i,
      /dangerous|unsafe|threat/i,
    ],
    keywords: ['emergency', 'urgent', 'help', 'fire', 'flood', 'injured', 'police', '911'],
    weight: 2.0,
  },
  {
    intent: 'AMENITIES',
    patterns: [
      /ameniti|feature|what('s|s)?\s+(here|available)/i,
      /pool|hot\s+tub|gym|washer|dryer|kitchen/i,
      /where\s+is\s+(the|a)/i,
      /how\s+do\s+i\s+use/i,
    ],
    keywords: ['amenities', 'pool', 'gym', 'washer', 'dryer', 'kitchen', 'tv', 'grill'],
    weight: 1.0,
  },
  {
    intent: 'MAINTENANCE',
    patterns: [
      /broken|not\s+working|doesn't\s+work|won't\s+work/i,
      /fix|repair|maintenance|issue|problem/i,
      /leak(ing)?|clog(ged)?|stuck/i,
      /air\s+condition|ac|heat(ing)?|hvac/i,
    ],
    keywords: ['broken', 'fix', 'repair', 'leak', 'clogged', 'stuck', 'issue', 'problem'],
    weight: 1.2,
  },
  {
    intent: 'EARLY_CHECKIN',
    patterns: [
      /early\s+check(\s*|-)?in/i,
      /arrive\s+(early|earlier|before)/i,
      /check\s+in\s+(early|earlier|before)/i,
      /earlier\s+arrival/i,
    ],
    keywords: ['early', 'earlier', 'before', 'ahead'],
    weight: 1.0,
  },
  {
    intent: 'LATE_CHECKOUT',
    patterns: [
      /late\s+check(\s*|-)?out/i,
      /leave\s+(later?|after)/i,
      /check\s+out\s+(late|later)/i,
      /extend|stay\s+(longer|extra)/i,
    ],
    keywords: ['late', 'later', 'extend', 'longer', 'extra'],
    weight: 1.0,
  },
  {
    intent: 'EXTRA_GUESTS',
    patterns: [
      /extra\s+guest|additional\s+(guest|people|person)/i,
      /bring\s+(a\s+)?friend|visitor|more\s+people/i,
      /can\s+(more|another)\s+person/i,
    ],
    keywords: ['extra', 'additional', 'more', 'guest', 'visitor', 'friend'],
    weight: 1.0,
  },
  {
    intent: 'PETS',
    patterns: [
      /pet|dog|cat|animal/i,
      /bring\s+(my|a|our)\s+(pet|dog|cat)/i,
      /pet\s+friendly|allow\s+pets?/i,
    ],
    keywords: ['pet', 'dog', 'cat', 'animal'],
    weight: 1.0,
  },
  {
    intent: 'COMPLAINT',
    patterns: [
      /complain|unhappy|dissatisfied|disappointed/i,
      /refund|compensation|unacceptable/i,
      /terrible|awful|horrible|worst/i,
      /not\s+as\s+(described|advertised|expected)/i,
    ],
    keywords: ['complaint', 'unhappy', 'refund', 'terrible', 'disappointed'],
    weight: 1.5,
  },
  {
    intent: 'COMPLIMENT',
    patterns: [
      /great|amazing|wonderful|fantastic|excellent/i,
      /love(d)?|beautiful|perfect|best/i,
      /thank\s+you|thanks|appreciate/i,
      /will\s+(definitely\s+)?come\s+back|return/i,
    ],
    keywords: ['great', 'amazing', 'love', 'beautiful', 'thank', 'perfect', 'excellent'],
    weight: 0.8,
  },
  {
    intent: 'TRANSPORTATION',
    patterns: [
      /uber|lyft|taxi|cab|ride/i,
      /airport|shuttle|rental\s+car/i,
      /how\s+do\s+i\s+get\s+(to|around)/i,
      /transportation|transit|bus/i,
    ],
    keywords: ['uber', 'lyft', 'taxi', 'airport', 'transportation', 'rental', 'bus'],
    weight: 1.0,
  },
  {
    intent: 'WEATHER',
    patterns: [
      /weather|forecast|temperature/i,
      /rain(ing)?|sunny|hot|cold/i,
      /what\s+should\s+i\s+wear/i,
    ],
    keywords: ['weather', 'forecast', 'temperature', 'rain', 'sunny'],
    weight: 0.8,
  },
  {
    intent: 'SHOPPING',
    patterns: [
      /shop(ping)?|mall|store|buy/i,
      /where\s+can\s+i\s+(buy|shop|find)/i,
      /grocery|supermarket|walmart|target/i,
    ],
    keywords: ['shopping', 'store', 'mall', 'grocery', 'walmart', 'target'],
    weight: 1.0,
  },
  {
    intent: 'NIGHTLIFE',
    patterns: [
      /bar|club|nightlife|drinks?/i,
      /where\s+(can|should)\s+(i|we)\s+(go\s+)?(for\s+)?drinks/i,
      /happy\s+hour|cocktail|beer|wine/i,
    ],
    keywords: ['bar', 'club', 'nightlife', 'drinks', 'cocktail', 'beer', 'wine'],
    weight: 1.0,
  },
  {
    intent: 'FAMILY_ACTIVITIES',
    patterns: [
      /family|kids?|children|child-friendly/i,
      /things\s+to\s+do\s+with\s+(kids?|children|family)/i,
      /playground|zoo|aquarium/i,
    ],
    keywords: ['family', 'kids', 'children', 'playground', 'zoo'],
    weight: 1.0,
  },
  {
    intent: 'BUSINESS_SERVICES',
    patterns: [
      /business|work|office|print(ing)?|copy/i,
      /fax|conference|meeting\s+room/i,
      /co-?working|workspace/i,
    ],
    keywords: ['business', 'work', 'print', 'fax', 'office', 'meeting'],
    weight: 1.0,
  },
  {
    intent: 'BOOKING_INQUIRY',
    patterns: [
      /book(ing)?|reserv(e|ation)/i,
      /available|availability/i,
      /price|rate|cost|how\s+much/i,
      /stay\s+(longer|another|extra)\s+night/i,
    ],
    keywords: ['booking', 'reservation', 'available', 'price', 'rate', 'cost'],
    weight: 1.0,
  },
];

const SENTIMENT_PATTERNS = {
  positive: [
    /great|amazing|wonderful|fantastic|excellent|love|beautiful|perfect|awesome|thank/i,
    /helpful|friendly|clean|comfortable|nice|good|happy|pleased/i,
  ],
  negative: [
    /terrible|awful|horrible|worst|hate|dirty|uncomfortable|bad|unhappy|angry/i,
    /disappointing|frustrated|annoyed|unacceptable|rude|poor/i,
  ],
};

const URGENCY_PATTERNS = {
  critical: [/emergency|urgent|help|911|fire|flood|injured|police|ambulance/i],
  high: [/broken|not\s+working|leak|problem|issue|asap|immediately|right\s+now/i],
  medium: [/soon|today|tonight|this\s+afternoon|before\s+i\s+leave/i],
};

export class IntentClassifier {
  /**
   * Classify a guest query into an intent
   */
  classify(query: string): IntentClassification {
    const normalizedQuery = this.normalizeQuery(query);
    const scores = this.calculateIntentScores(normalizedQuery);
    const topIntent = this.getTopIntent(scores);
    const entities = this.extractEntities(query);
    const sentiment = this.analyzeSentiment(query);
    const urgency = this.analyzeUrgency(query);
    const subIntents = this.extractSubIntents(scores, topIntent.intent);

    return {
      intent: topIntent.intent,
      confidence: topIntent.confidence,
      subIntents,
      entities,
      sentiment,
      urgency,
    };
  }

  /**
   * Normalize query for better matching
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate scores for each intent
   */
  private calculateIntentScores(query: string): Map<GuestIntent, number> {
    const scores = new Map<GuestIntent, number>();
    const words = query.split(/\s+/);

    for (const pattern of INTENT_PATTERNS) {
      let score = 0;

      // Pattern matching
      for (const regex of pattern.patterns) {
        if (regex.test(query)) {
          score += 2 * pattern.weight;
        }
      }

      // Keyword matching
      for (const keyword of pattern.keywords) {
        const keywordLower = keyword.toLowerCase();
        if (words.includes(keywordLower)) {
          score += 1 * pattern.weight;
        } else if (query.includes(keywordLower)) {
          score += 0.5 * pattern.weight;
        }
      }

      if (score > 0) {
        scores.set(pattern.intent, score);
      }
    }

    return scores;
  }

  /**
   * Get the top matching intent
   */
  private getTopIntent(scores: Map<GuestIntent, number>): {
    intent: GuestIntent;
    confidence: number;
  } {
    if (scores.size === 0) {
      return { intent: 'UNKNOWN', confidence: 0 };
    }

    let topIntent: GuestIntent = 'UNKNOWN';
    let topScore = 0;
    let totalScore = 0;

    for (const [intent, score] of scores) {
      totalScore += score;
      if (score > topScore) {
        topScore = score;
        topIntent = intent;
      }
    }

    // Calculate confidence as a normalized score
    const confidence = totalScore > 0 ? Math.min(topScore / (totalScore * 0.5), 1) : 0;

    return { intent: topIntent, confidence: Math.round(confidence * 100) / 100 };
  }

  /**
   * Extract sub-intents for compound queries
   */
  private extractSubIntents(
    scores: Map<GuestIntent, number>,
    primaryIntent: GuestIntent
  ): string[] {
    const subIntents: string[] = [];
    const sortedScores = Array.from(scores.entries())
      .filter(([intent]) => intent !== primaryIntent)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2);

    for (const [intent, score] of sortedScores) {
      if (score > 0.5) {
        subIntents.push(intent);
      }
    }

    return subIntents;
  }

  /**
   * Extract entities from the query
   */
  private extractEntities(query: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Date patterns
    const datePatterns = [
      /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g,
      /\b(today|tomorrow|yesterday)\b/gi,
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(st|nd|rd|th)?\b/gi,
    ];

    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        entities.push({
          type: 'DATE',
          value: match[0],
          normalized: this.normalizeDate(match[0]),
        });
      }
    }

    // Time patterns
    const timePattern = /\b(\d{1,2}(:\d{2})?\s*(am|pm|AM|PM)?)\b/g;
    let timeMatch;
    while ((timeMatch = timePattern.exec(query)) !== null) {
      if (timeMatch[0].match(/\d{1,2}(:\d{2})?\s*(am|pm)/i)) {
        entities.push({
          type: 'TIME',
          value: timeMatch[0],
        });
      }
    }

    // Number patterns (for guest counts, etc.)
    const numberPattern = /\b(\d+)\s*(people|guests?|persons?|nights?|days?)\b/gi;
    let numMatch;
    while ((numMatch = numberPattern.exec(query)) !== null) {
      entities.push({
        type: 'NUMBER',
        value: numMatch[0],
        normalized: numMatch[1],
      });
    }

    // Amenity patterns
    const amenities = ['pool', 'hot tub', 'gym', 'washer', 'dryer', 'kitchen', 'tv', 'wifi', 'grill', 'fireplace'];
    for (const amenity of amenities) {
      if (query.toLowerCase().includes(amenity)) {
        entities.push({
          type: 'AMENITY',
          value: amenity,
        });
      }
    }

    return entities;
  }

  /**
   * Normalize date strings
   */
  private normalizeDate(dateStr: string): string {
    const lower = dateStr.toLowerCase();
    const now = new Date();

    if (lower === 'today') {
      return now.toISOString().split('T')[0];
    }
    if (lower === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    if (lower === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }

    return dateStr;
  }

  /**
   * Analyze sentiment of the query
   */
  private analyzeSentiment(query: string): 'positive' | 'negative' | 'neutral' {
    let positiveScore = 0;
    let negativeScore = 0;

    for (const pattern of SENTIMENT_PATTERNS.positive) {
      if (pattern.test(query)) {
        positiveScore++;
      }
    }

    for (const pattern of SENTIMENT_PATTERNS.negative) {
      if (pattern.test(query)) {
        negativeScore++;
      }
    }

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  /**
   * Analyze urgency of the query
   */
  private analyzeUrgency(query: string): 'low' | 'medium' | 'high' | 'critical' {
    for (const pattern of URGENCY_PATTERNS.critical) {
      if (pattern.test(query)) return 'critical';
    }

    for (const pattern of URGENCY_PATTERNS.high) {
      if (pattern.test(query)) return 'high';
    }

    for (const pattern of URGENCY_PATTERNS.medium) {
      if (pattern.test(query)) return 'medium';
    }

    return 'low';
  }

  /**
   * Get intent suggestions for autocomplete
   */
  getSuggestions(partialQuery: string): GuestIntent[] {
    const scores = this.calculateIntentScores(partialQuery.toLowerCase());
    return Array.from(scores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([intent]) => intent);
  }
}

export const intentClassifier = new IntentClassifier();
