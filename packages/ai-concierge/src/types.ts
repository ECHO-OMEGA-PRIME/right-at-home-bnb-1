/**
 * Right at Home BnB - AI Concierge Types
 * Type definitions for the AI concierge system
 */

export type GuestIntent =
  | 'WIFI_INFO'
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'PARKING'
  | 'HOUSE_RULES'
  | 'LOCAL_RESTAURANTS'
  | 'LOCAL_ATTRACTIONS'
  | 'EMERGENCY'
  | 'AMENITIES'
  | 'MAINTENANCE'
  | 'EARLY_CHECKIN'
  | 'LATE_CHECKOUT'
  | 'EXTRA_GUESTS'
  | 'PETS'
  | 'COMPLAINT'
  | 'COMPLIMENT'
  | 'GENERAL_QUESTION'
  | 'BOOKING_INQUIRY'
  | 'TRANSPORTATION'
  | 'WEATHER'
  | 'SHOPPING'
  | 'NIGHTLIFE'
  | 'FAMILY_ACTIVITIES'
  | 'BUSINESS_SERVICES'
  | 'UNKNOWN';

export interface IntentClassification {
  intent: GuestIntent;
  confidence: number;
  subIntents: string[];
  entities: ExtractedEntity[];
  sentiment: 'positive' | 'negative' | 'neutral';
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ExtractedEntity {
  type: 'DATE' | 'TIME' | 'LOCATION' | 'NUMBER' | 'AMENITY' | 'PERSON' | 'ISSUE';
  value: string;
  normalized?: string;
}

export interface PropertyContext {
  propertyId: string;
  propertyName: string;
  address: string;
  wifiNetwork: string | null;
  wifiPassword: string | null;
  checkInInstructions: string | null;
  checkOutInstructions: string | null;
  parkingInfo: string | null;
  houseRules: string | null;
  amenities: string[];
  nearbyPlaces: NearbyPlace[];
}

export interface NearbyPlace {
  name: string;
  type: 'restaurant' | 'attraction' | 'shopping' | 'grocery' | 'hospital' | 'gas' | 'entertainment';
  distance: string;
  address?: string;
  phone?: string;
  hours?: string;
  rating?: number;
  priceLevel?: 1 | 2 | 3 | 4;
  cuisine?: string;
  description?: string;
}

export interface GuestContext {
  guestId: string;
  guestName: string;
  bookingId: string;
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  isVip: boolean;
  previousStays: number;
  conversationHistory: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'guest' | 'concierge' | 'system';
  content: string;
  timestamp: Date;
  intent?: GuestIntent;
}

export interface ConciergeResponse {
  message: string;
  intent: GuestIntent;
  confidence: number;
  suggestions?: string[];
  actions?: ConciergeAction[];
  requiresHumanFollowUp: boolean;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface ConciergeAction {
  type: 'NOTIFY_HOST' | 'CREATE_TICKET' | 'SEND_INFO' | 'ESCALATE' | 'LOG_ONLY';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  data?: Record<string, unknown>;
}

export interface ConciergeConfig {
  groqApiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  enableVoice?: boolean;
  defaultLanguage?: string;
  hostName?: string;
  businessName?: string;
  emergencyPhone?: string;
}

export interface QueryAnalytics {
  queryId: string;
  guestId: string;
  propertyId: string;
  query: string;
  intent: GuestIntent;
  confidence: number;
  responseTime: number;
  wasHelpful?: boolean;
  rating?: number;
  timestamp: Date;
}

export interface PrebuiltResponse {
  intent: GuestIntent;
  patterns: string[];
  response: string;
  variables: string[];
  followUp?: string;
}

export interface LocalRecommendation {
  category: 'restaurant' | 'bar' | 'coffee' | 'grocery' | 'attraction' | 'entertainment' | 'fitness' | 'spa';
  name: string;
  description: string;
  address: string;
  distance: string;
  priceRange?: string;
  hours?: string;
  phone?: string;
  website?: string;
  highlights?: string[];
  hostTip?: string;
}

export interface MidlandLocalGuide {
  restaurants: LocalRecommendation[];
  bars: LocalRecommendation[];
  coffee: LocalRecommendation[];
  grocery: LocalRecommendation[];
  attractions: LocalRecommendation[];
  oilFieldServices?: LocalRecommendation[];
  familyFriendly: LocalRecommendation[];
}
