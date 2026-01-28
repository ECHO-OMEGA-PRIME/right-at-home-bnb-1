/**
 * Right at Home BnB - Pricing Engine Types
 * Type definitions for dynamic pricing system
 */

export interface Property {
  id: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  baseRate: number;
  minRate: number;
  maxRate: number;
  cleaningFee: number;
  city: string;
  propertyType: 'HOUSE' | 'APARTMENT' | 'CONDO' | 'TOWNHOUSE';
}

export interface PricingConfig {
  baseRate: number;
  minRate: number;
  maxRate: number;
  cleaningFee: number;
  weekendMarkup: number;
  seasonalMultipliers: SeasonalMultiplier[];
  eventPricing: EventPricing[];
  lengthOfStayDiscounts: LengthOfStayDiscount[];
  lastMinuteDiscounts: LastMinuteDiscount[];
  demandMultiplier: DemandMultiplier;
  competitorTracking: CompetitorConfig;
}

export interface SeasonalMultiplier {
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  multiplier: number;
  priority: number;
}

export interface EventPricing {
  name: string;
  startDate: Date;
  endDate: Date;
  multiplier: number;
  minStay?: number;
}

export interface LengthOfStayDiscount {
  minNights: number;
  discountPercent: number;
}

export interface LastMinuteDiscount {
  daysBeforeCheckIn: number;
  discountPercent: number;
  onlyIfUnbooked: boolean;
}

export interface DemandMultiplier {
  highDemandThreshold: number;
  lowDemandThreshold: number;
  highDemandMultiplier: number;
  lowDemandMultiplier: number;
}

export interface CompetitorConfig {
  enabled: boolean;
  competitors: Competitor[];
  adjustmentRange: { min: number; max: number };
  updateFrequency: 'daily' | 'weekly';
}

export interface Competitor {
  id: string;
  name: string;
  platform: 'airbnb' | 'vrbo' | 'booking' | 'direct';
  listingUrl?: string;
  bedrooms: number;
  similarityScore: number;
}

export interface CompetitorRate {
  competitorId: string;
  date: Date;
  rate: number;
  available: boolean;
  fetchedAt: Date;
}

export interface DatePricing {
  date: Date;
  baseRate: number;
  adjustedRate: number;
  factors: PricingFactor[];
  available: boolean;
  minStay: number;
}

export interface PricingFactor {
  type: 'seasonal' | 'weekend' | 'event' | 'demand' | 'competitor' | 'lastMinute' | 'lengthOfStay';
  name: string;
  multiplier: number;
  impact: number;
}

export interface OccupancyData {
  propertyId: string;
  date: Date;
  isBooked: boolean;
  bookingId?: string;
}

export interface MarketData {
  date: Date;
  averageRate: number;
  medianRate: number;
  minRate: number;
  maxRate: number;
  occupancyRate: number;
  sampleSize: number;
}

export interface RevenueProjection {
  propertyId: string;
  period: 'week' | 'month' | 'quarter' | 'year';
  startDate: Date;
  endDate: Date;
  projectedRevenue: number;
  projectedOccupancy: number;
  averageNightlyRate: number;
  scenarios: RevenueScenario[];
}

export interface RevenueScenario {
  name: 'conservative' | 'moderate' | 'optimistic';
  occupancyRate: number;
  revenue: number;
  nightsBooked: number;
}

export interface PriceRecommendation {
  propertyId: string;
  date: Date;
  currentRate: number;
  recommendedRate: number;
  confidence: number;
  reasoning: string[];
  potentialRevenue: {
    current: number;
    recommended: number;
    difference: number;
  };
}

export interface SeasonDefinition {
  name: string;
  type: 'peak' | 'high' | 'shoulder' | 'low' | 'off';
  months: number[];
  multiplier: number;
}

export interface MidlandEvents {
  oilIndustryEvents: EventPricing[];
  localEvents: EventPricing[];
  holidays: EventPricing[];
}

export interface DynamicPricingResult {
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  nightlyRates: DatePricing[];
  subtotal: number;
  cleaningFee: number;
  lengthOfStayDiscount: number;
  lastMinuteDiscount: number;
  totalPrice: number;
  averageNightlyRate: number;
  breakdown: PricingBreakdown;
}

export interface PricingBreakdown {
  baseTotal: number;
  seasonalAdjustment: number;
  weekendAdjustment: number;
  eventAdjustment: number;
  demandAdjustment: number;
  competitorAdjustment: number;
  discounts: number;
  fees: number;
  finalTotal: number;
}
