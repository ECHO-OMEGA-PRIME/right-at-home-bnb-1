/**
 * Right at Home BnB - Dynamic Pricing Service
 * Smart price optimization based on demand, events, and market data
 */

import type { Property, Booking } from '@shared/types';
import { format, parseISO, addDays, differenceInDays, getDay, getMonth } from 'date-fns';

export interface PricingConfig {
  enabled: boolean;
  minPrice: number;
  maxPrice: number;
  baseOccupancyTarget: number; // e.g., 75%
  demandMultiplier: number;
  weekendMultiplier: number;
  seasonalMultipliers: SeasonalMultiplier[];
  eventMultipliers: EventMultiplier[];
  lastMinuteDiscount: LastMinuteDiscount;
  lengthOfStayDiscounts: LengthOfStayDiscount[];
  competitorTracking: boolean;
}

interface SeasonalMultiplier {
  id: string;
  name: string;
  startMonth: number; // 0-11
  endMonth: number;
  multiplier: number;
}

interface EventMultiplier {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  multiplier: number;
  recurring?: 'yearly';
}

interface LastMinuteDiscount {
  enabled: boolean;
  daysBeforeCheckIn: number;
  discountPercent: number;
}

interface LengthOfStayDiscount {
  minNights: number;
  discountPercent: number;
}

export interface PricingRecommendation {
  date: string;
  basePrice: number;
  recommendedPrice: number;
  factors: PricingFactor[];
  confidence: number;
  occupancy: number;
}

interface PricingFactor {
  name: string;
  impact: number; // percentage
  description: string;
}

export interface MarketComparison {
  propertyId: string;
  avgAreaPrice: number;
  pricePercentile: number;
  recommendation: 'increase' | 'maintain' | 'decrease';
  competitors: CompetitorPrice[];
}

interface CompetitorPrice {
  name: string;
  price: number;
  bedrooms: number;
  rating: number;
}

// Midland, TX specific events and seasons
const MIDLAND_EVENTS: EventMultiplier[] = [
  {
    id: 'pbr',
    name: 'Permian Basin Oil Show',
    startDate: '2024-10-15',
    endDate: '2024-10-17',
    multiplier: 1.5,
    recurring: 'yearly',
  },
  {
    id: 'pbf',
    name: 'Petroleum Professional Development Conference',
    startDate: '2024-09-10',
    endDate: '2024-09-12',
    multiplier: 1.35,
    recurring: 'yearly',
  },
  {
    id: 'thanksgiving',
    name: 'Thanksgiving Weekend',
    startDate: '2024-11-27',
    endDate: '2024-12-01',
    multiplier: 1.25,
    recurring: 'yearly',
  },
  {
    id: 'christmas',
    name: 'Christmas/New Year',
    startDate: '2024-12-20',
    endDate: '2025-01-02',
    multiplier: 1.3,
    recurring: 'yearly',
  },
  {
    id: 'spring_break',
    name: 'Spring Break',
    startDate: '2024-03-10',
    endDate: '2024-03-17',
    multiplier: 1.2,
    recurring: 'yearly',
  },
];

const MIDLAND_SEASONS: SeasonalMultiplier[] = [
  { id: 'winter_low', name: 'Winter Low', startMonth: 0, endMonth: 1, multiplier: 0.9 },
  { id: 'spring', name: 'Spring', startMonth: 2, endMonth: 4, multiplier: 1.0 },
  { id: 'summer', name: 'Summer Peak', startMonth: 5, endMonth: 7, multiplier: 1.15 },
  { id: 'fall', name: 'Fall High', startMonth: 8, endMonth: 10, multiplier: 1.1 },
  { id: 'holiday', name: 'Holiday Season', startMonth: 11, endMonth: 11, multiplier: 1.2 },
];

class PricingService {
  private config: Record<string, PricingConfig> = {};
  private occupancyCache: Map<string, { date: string; rate: number }[]> = new Map();

  constructor() {
    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const stored = await window.electronAPI.store.get<Record<string, PricingConfig>>('pricingConfig');
      if (stored) {
        this.config = stored;
      }
    } catch (error) {
      console.error('[Pricing] Failed to load config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    await window.electronAPI.store.set('pricingConfig', this.config);
  }

  getConfig(propertyId: string): PricingConfig {
    return this.config[propertyId] || this.getDefaultConfig();
  }

  private getDefaultConfig(): PricingConfig {
    return {
      enabled: true,
      minPrice: 75,
      maxPrice: 500,
      baseOccupancyTarget: 75,
      demandMultiplier: 1.0,
      weekendMultiplier: 1.15,
      seasonalMultipliers: MIDLAND_SEASONS,
      eventMultipliers: MIDLAND_EVENTS,
      lastMinuteDiscount: {
        enabled: true,
        daysBeforeCheckIn: 3,
        discountPercent: 15,
      },
      lengthOfStayDiscounts: [
        { minNights: 7, discountPercent: 10 },
        { minNights: 28, discountPercent: 20 },
      ],
      competitorTracking: true,
    };
  }

  async updateConfig(propertyId: string, config: Partial<PricingConfig>): Promise<void> {
    this.config[propertyId] = { ...this.getConfig(propertyId), ...config };
    await this.saveConfig();
  }

  // Calculate recommended price for a specific date
  calculatePrice(
    property: Property,
    date: Date,
    bookings: Booking[],
    options?: { nights?: number; isLastMinute?: boolean }
  ): PricingRecommendation {
    const config = this.getConfig(property.id);
    const factors: PricingFactor[] = [];
    let price = property.basePrice;

    // Weekend pricing
    if (isWeekend(date)) {
      const weekendImpact = (config.weekendMultiplier - 1) * 100;
      price *= config.weekendMultiplier;
      factors.push({
        name: 'Weekend',
        impact: weekendImpact,
        description: 'Weekend pricing adjustment',
      });
    }

    // Seasonal pricing
    const month = getMonth(date);
    const season = config.seasonalMultipliers.find(
      (s) => month >= s.startMonth && month <= s.endMonth
    );
    if (season && season.multiplier !== 1.0) {
      const seasonalImpact = (season.multiplier - 1) * 100;
      price *= season.multiplier;
      factors.push({
        name: season.name,
        impact: seasonalImpact,
        description: `${season.name} seasonal pricing`,
      });
    }

    // Event pricing
    const event = this.findActiveEvent(date, config.eventMultipliers);
    if (event) {
      const eventImpact = (event.multiplier - 1) * 100;
      price *= event.multiplier;
      factors.push({
        name: event.name,
        impact: eventImpact,
        description: `Special event: ${event.name}`,
      });
    }

    // Occupancy-based pricing
    const occupancy = this.calculateOccupancy(property.id, bookings, date, 14);
    if (occupancy > config.baseOccupancyTarget) {
      const demandImpact = ((occupancy - config.baseOccupancyTarget) / 100) * 50 * config.demandMultiplier;
      price *= 1 + demandImpact / 100;
      factors.push({
        name: 'High Demand',
        impact: demandImpact,
        description: `Occupancy at ${occupancy.toFixed(0)}%`,
      });
    } else if (occupancy < config.baseOccupancyTarget - 20) {
      const demandImpact = -10;
      price *= 1 + demandImpact / 100;
      factors.push({
        name: 'Low Demand',
        impact: demandImpact,
        description: `Occupancy at ${occupancy.toFixed(0)}%`,
      });
    }

    // Last-minute discount
    if (options?.isLastMinute && config.lastMinuteDiscount.enabled) {
      const daysOut = differenceInDays(date, new Date());
      if (daysOut <= config.lastMinuteDiscount.daysBeforeCheckIn && daysOut >= 0) {
        price *= 1 - config.lastMinuteDiscount.discountPercent / 100;
        factors.push({
          name: 'Last Minute',
          impact: -config.lastMinuteDiscount.discountPercent,
          description: `${daysOut} days until check-in`,
        });
      }
    }

    // Length of stay discount
    if (options?.nights) {
      const losDiscount = config.lengthOfStayDiscounts
        .filter((d) => options.nights! >= d.minNights)
        .sort((a, b) => b.minNights - a.minNights)[0];

      if (losDiscount) {
        price *= 1 - losDiscount.discountPercent / 100;
        factors.push({
          name: 'Extended Stay',
          impact: -losDiscount.discountPercent,
          description: `${options.nights}+ night discount`,
        });
      }
    }

    // Apply min/max bounds
    const finalPrice = Math.max(config.minPrice, Math.min(config.maxPrice, Math.round(price)));

    // Calculate confidence
    const confidence = this.calculateConfidence(factors, occupancy, event !== undefined);

    return {
      date: format(date, 'yyyy-MM-dd'),
      basePrice: property.basePrice,
      recommendedPrice: finalPrice,
      factors,
      confidence,
      occupancy,
    };
  }

  // Generate pricing recommendations for a date range
  generatePricingCalendar(
    property: Property,
    startDate: Date,
    days: number,
    bookings: Booking[]
  ): PricingRecommendation[] {
    const recommendations: PricingRecommendation[] = [];

    for (let i = 0; i < days; i++) {
      const date = addDays(startDate, i);
      recommendations.push(this.calculatePrice(property, date, bookings));
    }

    return recommendations;
  }

  private findActiveEvent(date: Date, events: EventMultiplier[]): EventMultiplier | undefined {
    const year = date.getFullYear();

    return events.find((event) => {
      let startDate = parseISO(event.startDate);
      let endDate = parseISO(event.endDate);

      // Adjust for recurring yearly events
      if (event.recurring === 'yearly') {
        startDate = new Date(year, startDate.getMonth(), startDate.getDate());
        endDate = new Date(year, endDate.getMonth(), endDate.getDate());
      }

      return date >= startDate && date <= endDate;
    });
  }

  private calculateOccupancy(
    propertyId: string,
    bookings: Booking[],
    aroundDate: Date,
    windowDays: number
  ): number {
    const startDate = addDays(aroundDate, -windowDays / 2);
    const endDate = addDays(aroundDate, windowDays / 2);

    let bookedDays = 0;

    bookings
      .filter((b) => b.propertyId === propertyId && b.status !== 'cancelled')
      .forEach((booking) => {
        const checkIn = parseISO(booking.checkIn);
        const checkOut = parseISO(booking.checkOut);

        // Count overlapping days
        const overlapStart = checkIn > startDate ? checkIn : startDate;
        const overlapEnd = checkOut < endDate ? checkOut : endDate;

        if (overlapStart < overlapEnd) {
          bookedDays += differenceInDays(overlapEnd, overlapStart);
        }
      });

    return (bookedDays / windowDays) * 100;
  }

  private calculateConfidence(factors: PricingFactor[], occupancy: number, hasEvent: boolean): number {
    let confidence = 75; // Base confidence

    // More factors = more confident
    confidence += Math.min(factors.length * 5, 15);

    // Event data increases confidence
    if (hasEvent) {
      confidence += 5;
    }

    // Good occupancy data increases confidence
    if (occupancy > 0) {
      confidence += 5;
    }

    return Math.min(confidence, 95);
  }

  // Get market comparison (would typically call external API)
  async getMarketComparison(property: Property): Promise<MarketComparison> {
    // In production, this would call AirDNA, PriceLabs, or similar API
    // For now, return simulated data based on property characteristics

    const bedroomMultiplier = 50 + property.bedrooms * 25;
    const avgAreaPrice = bedroomMultiplier + Math.random() * 50;

    const pricePercentile = Math.min(
      100,
      Math.max(0, 50 + ((property.basePrice - avgAreaPrice) / avgAreaPrice) * 100)
    );

    let recommendation: 'increase' | 'maintain' | 'decrease' = 'maintain';
    if (pricePercentile < 35) {
      recommendation = 'increase';
    } else if (pricePercentile > 75) {
      recommendation = 'decrease';
    }

    // Simulated competitors
    const competitors: CompetitorPrice[] = [
      { name: 'Similar Property A', price: avgAreaPrice * 0.95, bedrooms: property.bedrooms, rating: 4.7 },
      { name: 'Similar Property B', price: avgAreaPrice * 1.05, bedrooms: property.bedrooms, rating: 4.5 },
      { name: 'Similar Property C', price: avgAreaPrice, bedrooms: property.bedrooms, rating: 4.8 },
    ];

    return {
      propertyId: property.id,
      avgAreaPrice: Math.round(avgAreaPrice),
      pricePercentile: Math.round(pricePercentile),
      recommendation,
      competitors,
    };
  }

  // Revenue optimization suggestions
  getOptimizationSuggestions(
    property: Property,
    bookings: Booking[],
    recommendations: PricingRecommendation[]
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const config = this.getConfig(property.id);

    // Check for gaps in bookings
    const gaps = this.findBookingGaps(property.id, bookings, 30);
    gaps.forEach((gap) => {
      if (gap.days >= 2 && gap.days <= 5) {
        suggestions.push({
          type: 'gap_fill',
          priority: 'high',
          title: 'Booking Gap Opportunity',
          description: `${gap.days}-day gap starting ${format(gap.start, 'MMM d')}. Consider offering a discount to fill.`,
          potentialRevenue: property.basePrice * gap.days * 0.8,
          action: 'Apply 20% last-minute discount',
        });
      }
    });

    // Check if prices are below market
    const avgRecommended =
      recommendations.reduce((sum, r) => sum + r.recommendedPrice, 0) / recommendations.length;
    if (property.basePrice < avgRecommended * 0.85) {
      suggestions.push({
        type: 'price_increase',
        priority: 'medium',
        title: 'Base Price Below Market',
        description: `Your base price ($${property.basePrice}) is below the recommended average ($${Math.round(avgRecommended)}).`,
        potentialRevenue: (avgRecommended - property.basePrice) * 30,
        action: `Increase base price to $${Math.round(avgRecommended)}`,
      });
    }

    // Weekend pricing opportunities
    if (!config.weekendMultiplier || config.weekendMultiplier < 1.1) {
      suggestions.push({
        type: 'weekend_pricing',
        priority: 'medium',
        title: 'Weekend Pricing Opportunity',
        description: 'Enable or increase weekend pricing to capture higher demand.',
        potentialRevenue: property.basePrice * 0.15 * 8,
        action: 'Set weekend multiplier to 1.15',
      });
    }

    // Length of stay discounts
    if (!config.lengthOfStayDiscounts || config.lengthOfStayDiscounts.length === 0) {
      suggestions.push({
        type: 'los_discount',
        priority: 'low',
        title: 'Attract Longer Stays',
        description: 'Offer discounts for weekly/monthly stays to increase occupancy.',
        potentialRevenue: property.basePrice * 7 * 0.9,
        action: 'Add 10% discount for 7+ night stays',
      });
    }

    return suggestions;
  }

  private findBookingGaps(
    propertyId: string,
    bookings: Booking[],
    lookAheadDays: number
  ): { start: Date; end: Date; days: number }[] {
    const gaps: { start: Date; end: Date; days: number }[] = [];
    const today = new Date();
    const endDate = addDays(today, lookAheadDays);

    // Get sorted bookings for this property
    const propertyBookings = bookings
      .filter((b) => b.propertyId === propertyId && b.status !== 'cancelled')
      .map((b) => ({
        checkIn: parseISO(b.checkIn),
        checkOut: parseISO(b.checkOut),
      }))
      .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());

    let lastCheckOut = today;

    propertyBookings.forEach((booking) => {
      if (booking.checkIn > lastCheckOut) {
        const gapDays = differenceInDays(booking.checkIn, lastCheckOut);
        if (gapDays > 1) {
          gaps.push({
            start: lastCheckOut,
            end: booking.checkIn,
            days: gapDays,
          });
        }
      }
      if (booking.checkOut > lastCheckOut) {
        lastCheckOut = booking.checkOut;
      }
    });

    // Check gap between last booking and end of look-ahead period
    if (lastCheckOut < endDate) {
      const gapDays = differenceInDays(endDate, lastCheckOut);
      if (gapDays > 1) {
        gaps.push({
          start: lastCheckOut,
          end: endDate,
          days: gapDays,
        });
      }
    }

    return gaps;
  }

  // Apply pricing recommendations (update property prices)
  async applyRecommendations(
    propertyId: string,
    recommendations: PricingRecommendation[]
  ): Promise<{ success: boolean; appliedCount: number }> {
    // In a real implementation, this would update the property's calendar pricing
    console.log(`[Pricing] Would apply ${recommendations.length} price recommendations for property ${propertyId}`);

    return {
      success: true,
      appliedCount: recommendations.length,
    };
  }
}

interface OptimizationSuggestion {
  type: 'gap_fill' | 'price_increase' | 'weekend_pricing' | 'los_discount' | 'event_pricing';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialRevenue: number;
  action: string;
}

export const pricingService = new PricingService();

export interface LegacyPricingProperty {
  id?: string;
  basePrice: number;
  minPrice?: number;
  maxPrice?: number;
  weeklyDiscount?: number;
  monthlyDiscount?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
}

function clampPrice(property: LegacyPricingProperty, price: number): number {
  const minimum = property.minPrice ?? 0;
  const maximum = property.maxPrice ?? Number.POSITIVE_INFINITY;
  return Math.min(maximum, Math.max(minimum, Math.round(price * 100) / 100));
}

export function getBasePrice(property: LegacyPricingProperty): number {
  return property.basePrice;
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function getDayOfWeekMultiplier(date: Date): number {
  return isWeekend(date) ? 1.15 : 1;
}

export function getSeasonalMultiplier(date: Date): number {
  const month = date.getUTCMonth();
  if (month === 0 || month === 1) return 0.9;
  if (month >= 5 && month <= 7) return 1.15;
  if (month >= 8 && month <= 10) return 1.1;
  if (month === 11) return 1.2;
  return 1;
}

function thanksgivingDate(year: number): number {
  const first = new Date(Date.UTC(year, 10, 1));
  const firstThursday = 1 + ((4 - first.getUTCDay() + 7) % 7);
  return firstThursday + 21;
}

export function isHolidayPeriod(date: Date): boolean {
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  if (month === 6 && day === 4) return true;
  if (month === 11 && day >= 20) return true;
  if (month === 0 && day <= 2) return true;
  if (month === 10 && day === thanksgivingDate(year)) return true;
  return false;
}

export function calculatePrice(
  property: LegacyPricingProperty,
  date: Date,
  options: { demandMultiplier?: number } = {}
): number {
  let price = property.basePrice;
  price *= getSeasonalMultiplier(date);
  price *= getDayOfWeekMultiplier(date);
  if (isHolidayPeriod(date)) price *= 1.3;
  price *= options.demandMultiplier ?? 1;
  return clampPrice(property, price);
}

export function calculateDemandMultiplier(input: {
  bookedNights: number;
  totalNights: number;
}): number {
  if (input.totalNights <= 0) return 1;
  const occupancy = Math.min(1, Math.max(0, input.bookedNights / input.totalNights));
  if (occupancy >= 0.85) return 1.35;
  if (occupancy >= 0.7) return 1.2;
  if (occupancy <= 0.35) return 0.85;
  if (occupancy <= 0.55) return 0.95;
  return 1.05;
}

export function calculateTotalWithDiscount(
  property: LegacyPricingProperty,
  nights: number
): number {
  if (!Number.isFinite(nights) || nights < 0) {
    throw new RangeError('Nights must be a non-negative number');
  }
  let discount = 0;
  if (nights >= 30) discount = property.monthlyDiscount ?? property.weeklyDiscount ?? 0;
  else if (nights >= 7) discount = property.weeklyDiscount ?? 0;
  return property.basePrice * nights * (1 - discount);
}

export function calculateLastMinutePrice(
  property: LegacyPricingProperty,
  checkIn: Date
): number {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const checkInUtc = Date.UTC(
    checkIn.getUTCFullYear(),
    checkIn.getUTCMonth(),
    checkIn.getUTCDate()
  );
  const daysOut = Math.round((checkInUtc - todayUtc) / (24 * 60 * 60 * 1000));
  const discount = daysOut >= 0 && daysOut <= 3 ? 0.15 : 0;
  return clampPrice(property, property.basePrice * (1 - discount));
}

export function adjustForCompetition(
  property: LegacyPricingProperty,
  competitorPrices: number[]
): number {
  const valid = competitorPrices.filter((price) => Number.isFinite(price) && price > 0);
  if (valid.length === 0) return clampPrice(property, property.basePrice);
  const average = valid.reduce((sum, price) => sum + price, 0) / valid.length;
  const target = Math.min(property.basePrice, average * 0.98);
  return clampPrice(property, target);
}

export function calculateMarketPosition(
  ourPrice: number,
  competitorPrices: number[]
): number {
  const valid = competitorPrices.filter((price) => Number.isFinite(price));
  if (valid.length === 0) return 0.5;
  const below = valid.filter((price) => price < ourPrice).length;
  const equal = valid.filter((price) => price === ourPrice).length;
  return (below + equal * 0.5) / valid.length;
}

export function generateRecommendation(
  property: LegacyPricingProperty,
  date: Date
): {
  suggestedPrice: number;
  factors: string[];
  confidence: number;
} {
  const factors: string[] = [];
  const season = getSeasonalMultiplier(date);
  if (season > 1) factors.push('Seasonal premium');
  if (season < 1) factors.push('Off-season adjustment');
  if (isWeekend(date)) factors.push('Weekend premium');
  if (isHolidayPeriod(date)) factors.push('Holiday premium');
  if (factors.length === 0) factors.push('Base market rate');
  return {
    suggestedPrice: calculatePrice(property, date),
    factors,
    confidence: Math.min(0.95, 0.7 + factors.length * 0.05),
  };
}

export function calculateExpectedRevenue(
  price: number,
  occupancyRate: number,
  nights: number
): number {
  return price * occupancyRate * nights;
}

export function calculateOptimalPrice(
  property: LegacyPricingProperty,
  historicalData: Array<{ price: number; occupancy: number }>
): number {
  const valid = historicalData.filter(
    (row) => Number.isFinite(row.price) && Number.isFinite(row.occupancy)
  );
  if (valid.length === 0) return clampPrice(property, property.basePrice);
  const best = valid.reduce((current, candidate) =>
    candidate.price * candidate.occupancy > current.price * current.occupancy
      ? candidate
      : current
  );
  return clampPrice(property, best.price);
}
