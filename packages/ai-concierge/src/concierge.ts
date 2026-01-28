/**
 * Right at Home BnB - AI Concierge
 * Main concierge service using Groq llama-3.3-70b for fast AI responses
 */

import Groq from 'groq-sdk';
import type {
  ConciergeConfig,
  ConciergeResponse,
  PropertyContext,
  GuestContext,
  ConversationMessage,
  QueryAnalytics,
  ConciergeAction,
  GuestIntent,
} from './types';
import { IntentClassifier } from './intent-classifier';
import { ResponseGenerator } from './response-generator';

const DEFAULT_CONFIG: Partial<ConciergeConfig> = {
  model: 'llama-3.3-70b-versatile',
  maxTokens: 1024,
  temperature: 0.7,
  enableVoice: false,
  defaultLanguage: 'en',
  hostName: 'Steven',
  businessName: 'Right at Home BnB',
  emergencyPhone: '(432) 555-0123',
};

const SYSTEM_PROMPT = `You are the AI concierge for Right at Home BnB, a vacation rental company in Midland, Texas operated by Steven Palma with 22 properties.

Your role is to:
1. Provide helpful, friendly, and accurate information to guests
2. Answer questions about the property, amenities, and local area
3. Handle common requests (WiFi, check-in/out, local recommendations)
4. Escalate urgent issues (maintenance, complaints, emergencies) appropriately
5. Represent the Right at Home BnB brand professionally

Guidelines:
- Be warm and welcoming - guests are on vacation or business trips
- Keep responses concise but complete (aim for 2-3 paragraphs max)
- Always offer follow-up assistance
- For safety issues, always recommend contacting 911 first
- Never share other guests' information
- If you don't know something specific about the property, say so and offer to connect them with the host

Local Knowledge (Midland, TX):
- Oil industry town - many guests are oilfield workers
- Hot summers (95-105°F), mild winters
- Best restaurants: The Garlic Press, Wall Street Bar & Grill, Rosa's Cafe
- Attractions: Petroleum Museum, Museum of the Southwest
- Grocery: H-E-B (Texas favorite), Market Street, Walmart

Property Details will be provided in each message context.`;

export class AIConcierge {
  private groq: Groq;
  private config: ConciergeConfig;
  private intentClassifier: IntentClassifier;
  private responseGenerator: ResponseGenerator;
  private conversationCache: Map<string, ConversationMessage[]>;
  private analyticsBuffer: QueryAnalytics[];

  constructor(config: ConciergeConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as ConciergeConfig;
    this.groq = new Groq({ apiKey: config.groqApiKey });
    this.intentClassifier = new IntentClassifier();
    this.responseGenerator = new ResponseGenerator();
    this.conversationCache = new Map();
    this.analyticsBuffer = [];
  }

  /**
   * Process a guest query and generate a response
   */
  async processQuery(
    query: string,
    propertyContext: PropertyContext,
    guestContext?: GuestContext
  ): Promise<ConciergeResponse> {
    const startTime = Date.now();

    // First, classify the intent
    const classification = this.intentClassifier.classify(query);

    // For high-confidence simple queries, use pre-built responses
    if (classification.confidence > 0.8 && this.hasPrebuiltResponse(classification.intent)) {
      const response = this.responseGenerator.generateResponse(
        query,
        propertyContext,
        guestContext
      );

      // Log analytics
      this.logAnalytics({
        queryId: this.generateQueryId(),
        guestId: guestContext?.guestId || 'anonymous',
        propertyId: propertyContext.propertyId,
        query,
        intent: classification.intent,
        confidence: classification.confidence,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      });

      return response;
    }

    // For complex or low-confidence queries, use Groq AI
    return this.processWithAI(query, propertyContext, guestContext, classification, startTime);
  }

  /**
   * Process query using Groq AI for complex responses
   */
  private async processWithAI(
    query: string,
    propertyContext: PropertyContext,
    guestContext: GuestContext | undefined,
    classification: ReturnType<IntentClassifier['classify']>,
    startTime: number
  ): Promise<ConciergeResponse> {
    const conversationHistory = guestContext?.conversationHistory || [];
    const conversationId = guestContext?.guestId || 'anonymous';

    // Build context message
    const contextMessage = this.buildContextMessage(propertyContext, guestContext);

    // Prepare messages for Groq
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextMessage },
    ];

    // Add conversation history (last 10 messages)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'guest') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'concierge') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    // Add current query with intent hint
    const enhancedQuery = this.enhanceQuery(query, classification);
    messages.push({ role: 'user', content: enhancedQuery });

    try {
      const completion = await this.groq.chat.completions.create({
        model: this.config.model!,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I was unable to process your request. Please try again or contact the host directly.';

      // Update conversation cache
      this.updateConversationCache(conversationId, query, aiResponse);

      // Determine actions and follow-up requirements
      const actions = this.determineActions(classification);
      const requiresHumanFollowUp = this.requiresHumanFollowUp(classification);

      // Log analytics
      this.logAnalytics({
        queryId: this.generateQueryId(),
        guestId: guestContext?.guestId || 'anonymous',
        propertyId: propertyContext.propertyId,
        query,
        intent: classification.intent,
        confidence: classification.confidence,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      });

      return {
        message: aiResponse,
        intent: classification.intent,
        confidence: classification.confidence,
        suggestions: this.generateSuggestions(classification.intent),
        actions,
        requiresHumanFollowUp,
        sentiment: classification.sentiment,
      };
    } catch (error) {
      console.error('Groq API error:', error);

      // Fallback to pre-built response
      const fallbackResponse = this.responseGenerator.generateResponse(
        query,
        propertyContext,
        guestContext
      );

      return {
        ...fallbackResponse,
        message: fallbackResponse.message + '\n\n(Note: Our AI assistant is temporarily limited. A team member will follow up shortly.)',
        requiresHumanFollowUp: true,
      };
    }
  }

  /**
   * Build context message for the AI
   */
  private buildContextMessage(
    property: PropertyContext,
    guest?: GuestContext
  ): string {
    let context = `PROPERTY CONTEXT:
Name: ${property.propertyName}
Address: ${property.address}
WiFi Network: ${property.wifiNetwork || 'Not provided'}
WiFi Password: ${property.wifiPassword || 'Not provided'}
Check-in Instructions: ${property.checkInInstructions || 'Standard 3 PM check-in'}
Check-out Instructions: ${property.checkOutInstructions || 'Standard 11 AM check-out'}
Parking: ${property.parkingInfo || 'Driveway parking available'}
House Rules: ${property.houseRules || 'Standard rules apply'}
Amenities: ${property.amenities.join(', ') || 'Standard amenities'}
`;

    if (guest) {
      const stayDuration = Math.ceil(
        (guest.checkOut.getTime() - guest.checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
      context += `
GUEST CONTEXT:
Name: ${guest.guestName}
Check-in: ${guest.checkIn.toLocaleDateString()}
Check-out: ${guest.checkOut.toLocaleDateString()}
Stay Duration: ${stayDuration} nights
Guest Count: ${guest.guestCount}
VIP Status: ${guest.isVip ? 'Yes' : 'No'}
Previous Stays: ${guest.previousStays}
`;
    }

    return context;
  }

  /**
   * Enhance query with intent classification hints
   */
  private enhanceQuery(
    query: string,
    classification: ReturnType<IntentClassifier['classify']>
  ): string {
    if (classification.confidence < 0.5) {
      return query;
    }

    const intentHints: Record<string, string> = {
      EMERGENCY: '[URGENT - Possible emergency situation]',
      MAINTENANCE: '[Maintenance/repair issue]',
      COMPLAINT: '[Guest expressing dissatisfaction]',
      COMPLIMENT: '[Positive feedback]',
    };

    const hint = intentHints[classification.intent];
    return hint ? `${hint} ${query}` : query;
  }

  /**
   * Check if we have a high-quality pre-built response
   */
  private hasPrebuiltResponse(intent: GuestIntent): boolean {
    const prebuiltIntents: GuestIntent[] = [
      'WIFI_INFO',
      'CHECK_IN',
      'CHECK_OUT',
      'PARKING',
      'HOUSE_RULES',
      'AMENITIES',
      'EMERGENCY',
    ];
    return prebuiltIntents.includes(intent);
  }

  /**
   * Determine required actions based on classification
   */
  private determineActions(
    classification: ReturnType<IntentClassifier['classify']>
  ): ConciergeAction[] {
    const actions: ConciergeAction[] = [];

    // Emergency handling
    if (classification.intent === 'EMERGENCY' || classification.urgency === 'critical') {
      actions.push({
        type: 'NOTIFY_HOST',
        priority: 'urgent',
        description: 'Emergency situation - immediate attention required',
      });
      actions.push({
        type: 'ESCALATE',
        priority: 'urgent',
        description: 'Emergency escalated to all available channels',
      });
    }

    // Maintenance requests
    if (classification.intent === 'MAINTENANCE') {
      actions.push({
        type: 'CREATE_TICKET',
        priority: classification.urgency === 'high' ? 'high' : 'medium',
        description: 'Maintenance ticket created',
      });
    }

    // Complaints
    if (classification.intent === 'COMPLAINT' || classification.sentiment === 'negative') {
      actions.push({
        type: 'NOTIFY_HOST',
        priority: 'high',
        description: 'Guest complaint requires attention',
      });
    }

    // Booking inquiries
    if (classification.intent === 'BOOKING_INQUIRY') {
      actions.push({
        type: 'NOTIFY_HOST',
        priority: 'medium',
        description: 'Potential booking inquiry',
      });
    }

    return actions;
  }

  /**
   * Determine if human follow-up is needed
   */
  private requiresHumanFollowUp(
    classification: ReturnType<IntentClassifier['classify']>
  ): boolean {
    const humanRequiredIntents: GuestIntent[] = [
      'EMERGENCY',
      'COMPLAINT',
      'MAINTENANCE',
      'BOOKING_INQUIRY',
      'EARLY_CHECKIN',
      'LATE_CHECKOUT',
      'EXTRA_GUESTS',
    ];

    return (
      humanRequiredIntents.includes(classification.intent) ||
      classification.urgency === 'critical' ||
      classification.urgency === 'high' ||
      classification.confidence < 0.5
    );
  }

  /**
   * Generate follow-up suggestions
   */
  private generateSuggestions(intent: GuestIntent): string[] {
    const suggestionMap: Record<GuestIntent, string[]> = {
      WIFI_INFO: ['Is the connection working?', 'Need help with streaming?'],
      CHECK_IN: ['Need early check-in?', 'Want directions?'],
      CHECK_OUT: ['Need late check-out?', 'How was your stay?'],
      LOCAL_RESTAURANTS: ['Any cuisine preferences?', 'Looking for fine dining?'],
      LOCAL_ATTRACTIONS: ['Family activities?', 'Outdoor adventures?'],
      MAINTENANCE: ['Is this urgent?', 'Need alternative accommodation?'],
      EMERGENCY: [],
      PARKING: ['Multiple vehicles?'],
      HOUSE_RULES: ['Any specific questions?'],
      AMENITIES: ['Need help using something?'],
      EARLY_CHECKIN: [],
      LATE_CHECKOUT: [],
      EXTRA_GUESTS: [],
      PETS: ['What type of pet?'],
      COMPLAINT: [],
      COMPLIMENT: ['Leave us a review?'],
      GENERAL_QUESTION: ['What else can I help with?'],
      BOOKING_INQUIRY: ['What dates?', 'How many guests?'],
      TRANSPORTATION: ['Need airport pickup?'],
      WEATHER: ['Planning outdoor activities?'],
      SHOPPING: ['Looking for something specific?'],
      NIGHTLIFE: ['Dinner recommendations too?'],
      FAMILY_ACTIVITIES: ['Ages of children?'],
      BUSINESS_SERVICES: ['Need printing?'],
      UNKNOWN: ['Can you clarify?', 'Let me help you better'],
    };

    return suggestionMap[intent] || ['Anything else I can help with?'];
  }

  /**
   * Update conversation cache
   */
  private updateConversationCache(
    conversationId: string,
    query: string,
    response: string
  ): void {
    const history = this.conversationCache.get(conversationId) || [];

    history.push({
      role: 'guest',
      content: query,
      timestamp: new Date(),
    });

    history.push({
      role: 'concierge',
      content: response,
      timestamp: new Date(),
    });

    // Keep only last 50 messages
    const trimmedHistory = history.slice(-50);
    this.conversationCache.set(conversationId, trimmedHistory);
  }

  /**
   * Get conversation history for a guest
   */
  getConversationHistory(guestId: string): ConversationMessage[] {
    return this.conversationCache.get(guestId) || [];
  }

  /**
   * Clear conversation history for a guest
   */
  clearConversationHistory(guestId: string): void {
    this.conversationCache.delete(guestId);
  }

  /**
   * Log query analytics
   */
  private logAnalytics(analytics: QueryAnalytics): void {
    this.analyticsBuffer.push(analytics);

    // Flush buffer when it reaches 100 items
    if (this.analyticsBuffer.length >= 100) {
      this.flushAnalytics();
    }
  }

  /**
   * Flush analytics buffer (to be implemented with actual storage)
   */
  async flushAnalytics(): Promise<QueryAnalytics[]> {
    const buffer = [...this.analyticsBuffer];
    this.analyticsBuffer = [];
    return buffer;
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Quick response for common queries (no AI needed)
   */
  quickResponse(
    intent: GuestIntent,
    propertyContext: PropertyContext
  ): string | null {
    switch (intent) {
      case 'WIFI_INFO':
        if (propertyContext.wifiNetwork && propertyContext.wifiPassword) {
          return `WiFi Network: ${propertyContext.wifiNetwork}\nPassword: ${propertyContext.wifiPassword}`;
        }
        return null;

      case 'CHECK_IN':
        return `Check-in time is 3:00 PM.\n\n${propertyContext.checkInInstructions || 'Standard check-in procedures apply. Your access code will be sent separately.'}`;

      case 'CHECK_OUT':
        return `Check-out time is 11:00 AM.\n\n${propertyContext.checkOutInstructions || 'Please leave the property as you found it and lock up on your way out.'}`;

      case 'PARKING':
        return propertyContext.parkingInfo || 'Driveway parking is available for guests.';

      default:
        return null;
    }
  }

  /**
   * Stream response for real-time chat UI
   */
  async *streamResponse(
    query: string,
    propertyContext: PropertyContext,
    guestContext?: GuestContext
  ): AsyncGenerator<string, void, unknown> {
    const classification = this.intentClassifier.classify(query);
    const contextMessage = this.buildContextMessage(propertyContext, guestContext);
    const conversationHistory = guestContext?.conversationHistory || [];

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextMessage },
    ];

    // Add recent conversation history
    for (const msg of conversationHistory.slice(-10)) {
      if (msg.role === 'guest') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'concierge') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    messages.push({ role: 'user', content: this.enhanceQuery(query, classification) });

    try {
      const stream = await this.groq.chat.completions.create({
        model: this.config.model!,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
        yield content;
      }

      // Update conversation cache after streaming completes
      if (guestContext) {
        this.updateConversationCache(guestContext.guestId, query, fullResponse);
      }
    } catch (error) {
      console.error('Streaming error:', error);
      yield 'I apologize, but I encountered an error. Please try again or contact the host directly.';
    }
  }
}

/**
 * Factory function to create a concierge instance
 */
export function createConcierge(config: ConciergeConfig): AIConcierge {
  return new AIConcierge(config);
}

export { AIConcierge };
