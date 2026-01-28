/**
 * Right at Home BnB - Dynamic Pricing Engine
 * Main pricing engine combining all pricing factors
 */

import type {
  Property,
  PricingConfig,
  DynamicPricingResult,
  DatePricing,
  PricingFactor,
  LengthOfStayDiscount,
  LastMinuteDiscount,
} from './types';
import { SeasonalRatesManager, SEASONAL_MULTIPLIERS } from './seasonal-rates';
import { CompetitorAnalyzer, DEFAULT_MIDLAND_COMPETITORS } from './competitor-analysis';
import { RevenueOptimizer } from './revenue-optimizer';

/**
 * Default pricing configuration
 */
const DEFAULT_CONFIG: Omit<PricingConfig, 'baseRate' | 'minRate' | 'maxRate' | 'cleaningFee'> = {
  weekendMarkup: 0.15,
  seasonalMultipliers: SEASONAL_MULTIPLIERS,
  eventPricing: [],
  lengthOfStayDiscounts: [
    { minNights: 7, discountPercent: 10 },
    { minNights: 14, discountPercent: 15 },
    { minNights: 28, discountPercent: 20 },
  ],
  lastMinuteDiscounts: [
    { daysBeforeCheckIn: 1, discountPercent: 20, onlyIfUnbooked: true },
    { daysBeforeCheckIn: 3, discountPercent: 15, onlyIfUnbooked: true },
    { daysBeforeCheckIn: 7, discountPercent: 10, onlyIfUnbooked: true },
  ],
  demandMultiplier: {
    highDemandThreshold: 0.85,
    lowDemandThreshold: 0.50,
    highDemandMultiplier: 1.15,
    lowDemandMultiplier: 0.90,
  },
  competitorTracking: {
    enabled: true,
    competitors: DEFAULT_MIDLAND_COMPETITORS,
    adjustmentRange: { min: 0.85, max: 1.25 },
    updateFrequency: 'daily',
  },
};

/**
 * Dynamic Pricing Engine
 */
export class DynamicPricingEngine {
  private config: PricingConfig;
  private seasonalManager: SeasonalRatesManager;
  private competitorAnalyzer: CompetitorAnalyzer;
  private revenueOptimizer: RevenueOptimizer;
  private occupancyCache: Map<string, boolean>;

  constructor(config: Partial<PricingConfig> = {}) {
    this.config = {
      baseRate: config.baseRate ?? 150,
      minRate: config.minRate ?? 100,
      maxRate: config.maxRate ?? 500,
      cleaningFee: config.cleaningFee ?? 150,
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.seasonalManager = new SeasonalRatesManager();
    this.competitorAnalyzer = new CompetitorAnalyzer(this.config.competitorTracking);
    this.revenueOptimizer = new RevenueOptimizer(this.seasonalManager, this.competitorAnalyzer);
    this.occupancyCache = new Map();
  }

  /**
   * Calculate dynamic pricing for a booking
   */
  calculatePrice(
    property: Property,
    checkIn: Date,
    checkOut: Date,
    options: {
      guestCount?: number;
      applyLastMinuteDiscount?: boolean;
      applyLengthDiscount?: boolean;
      competitorAdjust?: boolean;
    } = {}
  ): DynamicPricingResult {
    const {
      guestCount = 1,
      applyLastMinuteDiscount = true,
      applyLengthDiscount = true,
      competitorAdjust = true,
    } = options;

    const nights = this.calculateNights(checkIn, checkOut);
    const daysUntilCheckIn = this.calculateDaysUntil(checkIn);

    // Calculate nightly rates
    const nightlyRates = this.calculateNightlyRates(property, checkIn, checkOut, competitorAdjust);

    // Calculate subtotal
    const subtotal = nightlyRates.reduce((sum, rate) => sum + rate.adjustedRate, 0);

    // Calculate discounts
    let lengthOfStayDiscount = 0;
    if (applyLengthDiscount) {
      lengthOfStayDiscount = this.calculateLengthOfStayDiscount(subtotal, nights);
    }

    let lastMinuteDiscount = 0;
    if (applyLastMinuteDiscount && this.isLastMinute(daysUntilCheckIn, property.id)) {
      lastMinuteDiscount = this.calculateLastMinuteDiscount(subtotal, daysUntilCheckIn);
    }

    // Total discounts
    const totalDiscounts = lengthOfStayDiscount + lastMinuteDiscount;

    // Final calculations
    const cleaningFee = property.cleaningFee;
    const totalPrice = subtotal - totalDiscounts + cleaningFee;
    const averageNightlyRate = Math.round(subtotal / nights);

    // Build breakdown
    const breakdown = this.buildPricingBreakdown(
      property,
      nightlyRates,
      lengthOfStayDiscount,
      lastMinuteDiscount,
      cleaningFee
    );

    return {
      propertyId: property.id,
      checkIn,
      checkOut,
      nights,
      nightlyRates,
      subtotal: Math.round(subtotal),
      cleaningFee: Math.round(cleaningFee),
      lengthOfStayDiscount: Math.round(lengthOfStayDiscount),
      lastMinuteDiscount: Math.round(lastMinuteDiscount),
      totalPrice: Math.round(totalPrice),
      averageNightlyRate,
      breakdown,
    };
  }

  /**
   * Calculate nightly rates for each night of the stay
   */
  private calculateNightlyRates(
    property: Property,
    checkIn: Date,
    checkOut: Date,
    competitorAdjust: boolean
  ): DatePricing[] {
    const rates: DatePricing[] = [];
    const current = new Date(checkIn);

    while (current < checkOut) {
      const rate = this.calculateSingleNightRate(property, current, competitorAdjust);
      rates.push(rate);
      current.setDate(current.getDate() + 1);
    }

    return rates;
  }

  /**
   * Calculate rate for a single night
   */
  private calculateSingleNightRate(
    property: Property,
    date: Date,
    competitorAdjust: boolean
  ): DatePricing {
    const factors: PricingFactor[] = [];
    let multiplier = 1.0;

    // Get seasonal multipliers
    const seasonalFactors = this.seasonalManager.getAllMultipliers(date);
    for (const factor of seasonalFactors) {
      factors.push({
        type: factor.type as 'seasonal' | 'weekend' | 'event',
        name: factor.name,
        multiplier: factor.multiplier,
        impact: (factor.multiplier - 1) * property.baseRate,
      });
      multiplier *= factor.multiplier;
    }

    // Get demand multiplier based on market occupancy
    const demandFactor = this.getDemandMultiplier(date);
    if (demandFactor !== 1.0) {
      factors.push({
        type: 'demand',
        name: demandFactor > 1 ? 'High Demand' : 'Low Demand',
        multiplier: demandFactor,
        impact: (demandFactor - 1) * property.baseRate,
      });
      multiplier *= demandFactor;
    }

    // Get competitor adjustment
    if (competitorAdjust && this.config.competitorTracking.enabled) {
      const competitorFactor = this.competitorAnalyzer.getCompetitiveAdjustment(
        property,
        date,
        property.baseRate * multiplier
      );
      if (competitorFactor.multiplier !== 1.0) {
        factors.push({
          type: 'competitor',
          name: competitorFactor.reasoning,
          multiplier: competitorFactor.multiplier,
          impact: (competitorFactor.multiplier - 1) * property.baseRate,
        });
        multiplier *= competitorFactor.multiplier;
      }
    }

    // Calculate adjusted rate
    let adjustedRate = property.baseRate * multiplier;

    // Apply min/max constraints
    adjustedRate = Math.max(property.minRate, Math.min(property.maxRate, adjustedRate));

    return {
      date: new Date(date),
      baseRate: property.baseRate,
      adjustedRate: Math.round(adjustedRate),
      factors,
      available: true,
      minStay: this.seasonalManager.getMinimumStay(date),
    };
  }

  /**
   * Get demand-based multiplier
   */
  private getDemandMultiplier(date: Date): number {
    const marketData = this.competitorAnalyzer.getMarketData(date);

    if (marketData.sampleSize < 3) {
      return 1.0;
    }

    if (marketData.occupancyRate >= this.config.demandMultiplier.highDemandThreshold) {
      return this.config.demandMultiplier.highDemandMultiplier;
    }

    if (marketData.occupancyRate <= this.config.demandMultiplier.lowDemandThreshold) {
      return this.config.demandMultiplier.lowDemandMultiplier;
    }

    return 1.0;
  }

  /**
   * Calculate length of stay discount
   */
  private calculateLengthOfStayDiscount(subtotal: number, nights: number): number {
    // Sort discounts by minNights descending to get the best applicable discount
    const applicableDiscounts = this.config.lengthOfStayDiscounts
      .filter((d) => nights >= d.minNights)
      .sort((a, b) => b.minNights - a.minNights);

    if (applicableDiscounts.length === 0) {
      return 0;
    }

    const bestDiscount = applicableDiscounts[0];
    return subtotal * (bestDiscount.discountPercent / 100);
  }

  /**
   * Check if booking qualifies for last-minute discount
   */
  private isLastMinute(daysUntil: number, propertyId: string): boolean {
    // Only apply if the property is not yet booked for those dates
    const cacheKey = `${propertyId}_${new Date().toISOString().split('T')[0]}`;
    const isBooked = this.occupancyCache.get(cacheKey);

    // If we know it's booked, no discount
    if (isBooked) return false;

    // Check if within any last-minute window
    return this.config.lastMinuteDiscounts.some((d) => daysUntil <= d.daysBeforeCheckIn);
  }

  /**
   * Calculate last-minute discount
   */
  private calculateLastMinuteDiscount(subtotal: number, daysUntil: number): number {
    const applicableDiscounts = this.config.lastMinuteDiscounts
      .filter((d) => daysUntil <= d.daysBeforeCheckIn)
      .sort((a, b) => a.daysBeforeCheckIn - b.daysBeforeCheckIn);

    if (applicableDiscounts.length === 0) {
      return 0;
    }

    // Use the discount for the closest matching window
    const bestDiscount = applicableDiscounts[0];
    return subtotal * (bestDiscount.discountPercent / 100);
  }

  /**
   * Build pricing breakdown
   */
  private buildPricingBreakdown(
    property: Property,
    nightlyRates: DatePricing[],
    lengthDiscount: number,
    lastMinuteDiscount: number,
    cleaningFee: number
  ): DynamicPricingResult['breakdown'] {
    let baseTotal = 0;
    let seasonalAdjustment = 0;
    let weekendAdjustment = 0;
    let eventAdjustment = 0;
    let demandAdjustment = 0;
    let competitorAdjustment = 0;

    for (const rate of nightlyRates) {
      baseTotal += property.baseRate;

      for (const factor of rate.factors) {
        switch (factor.type) {
          case 'seasonal':
            seasonalAdjustment += factor.impact;
            break;
          case 'weekend':
            weekendAdjustment += factor.impact;
            break;
          case 'event':
            eventAdjustment += factor.impact;
            break;
          case 'demand':
            demandAdjustment += factor.impact;
            break;
          case 'competitor':
            competitorAdjustment += factor.impact;
            break;
        }
      }
    }

    const subtotal = nightlyRates.reduce((sum, r) => sum + r.adjustedRate, 0);
    const totalDiscounts = lengthDiscount + lastMinuteDiscount;
    const finalTotal = subtotal - totalDiscounts + cleaningFee;

    return {
      baseTotal: Math.round(baseTotal),
      seasonalAdjustment: Math.round(seasonalAdjustment),
      weekendAdjustment: Math.round(weekendAdjustment),
      eventAdjustment: Math.round(eventAdjustment),
      demandAdjustment: Math.round(demandAdjustment),
      competitorAdjustment: Math.round(competitorAdjustment),
      discounts: Math.round(totalDiscounts),
      fees: Math.round(cleaningFee),
      finalTotal: Math.round(finalTotal),
    };
  }

  /**
   * Calculate number of nights
   */
  private calculateNights(checkIn: Date, checkOut: Date): number {
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate days until check-in
   */
  private calculateDaysUntil(checkIn: Date): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const checkInDate = new Date(checkIn);
    checkInDate.setHours(0, 0, 0, 0);
    return Math.ceil((checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get price calendar for a month
   */
  getPriceCalendar(
    property: Property,
    year: number,
    month: number
  ): Array<{
    date: Date;
    rate: number;
    available: boolean;
    minStay: number;
    factors: string[];
  }> {
    const calendar: Array<{
      date: Date;
      rate: number;
      available: boolean;
      minStay: number;
      factors: string[];
    }> = [];

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const current = new Date(startDate);
    while (current <= endDate) {
      const rate = this.calculateSingleNightRate(property, current, true);
      calendar.push({
        date: new Date(current),
        rate: rate.adjustedRate,
        available: rate.available,
        minStay: rate.minStay,
        factors: rate.factors.map((f) => f.name),
      });
      current.setDate(current.getDate() + 1);
    }

    return calendar;
  }

  /**
   * Update occupancy cache
   */
  setOccupancy(propertyId: string, date: Date, isBooked: boolean): void {
    const key = `${propertyId}_${date.toISOString().split('T')[0]}`;
    this.occupancyCache.set(key, isBooked);
  }

  /**
   * Bulk update occupancy from bookings
   */
  updateOccupancyFromBookings(
    bookings: Array<{ propertyId: string; checkIn: Date; checkOut: Date }>
  ): void {
    for (const booking of bookings) {
      const current = new Date(booking.checkIn);
      while (current < booking.checkOut) {
        this.setOccupancy(booking.propertyId, current, true);
        current.setDate(current.getDate() + 1);
      }
    }
  }

  /**
   * Get quick quote (simplified pricing)
   */
  getQuickQuote(
    property: Property,
    checkIn: Date,
    checkOut: Date
  ): {
    nights: number;
    totalPrice: number;
    averageRate: number;
    hasDiscount: boolean;
    discountType?: string;
  } {
    const result = this.calculatePrice(property, checkIn, checkOut);
    const hasDiscount = result.lengthOfStayDiscount > 0 || result.lastMinuteDiscount > 0;

    let discountType: string | undefined;
    if (result.lengthOfStayDiscount > 0 && result.lastMinuteDiscount > 0) {
      discountType = 'Length + Last Minute';
    } else if (result.lengthOfStayDiscount > 0) {
      discountType = 'Weekly/Monthly';
    } else if (result.lastMinuteDiscount > 0) {
      discountType = 'Last Minute';
    }

    return {
      nights: result.nights,
      totalPrice: result.totalPrice,
      averageRate: result.averageNightlyRate,
      hasDiscount,
      discountType,
    };
  }

  /**
   * Update pricing configuration
   */
  updateConfig(updates: Partial<PricingConfig>): void {
    this.config = { ...this.config, ...updates };

    if (updates.competitorTracking) {
      this.competitorAnalyzer = new CompetitorAnalyzer(this.config.competitorTracking);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PricingConfig {
    return { ...this.config };
  }

  /**
   * Get revenue optimizer instance
   */
  getRevenueOptimizer(): RevenueOptimizer {
    return this.revenueOptimizer;
  }

  /**
   * Get competitor analyzer instance
   */
  getCompetitorAnalyzer(): CompetitorAnalyzer {
    return this.competitorAnalyzer;
  }

  /**
   * Get seasonal manager instance
   */
  getSeasonalManager(): SeasonalRatesManager {
    return this.seasonalManager;
  }
}

/**
 * Create pricing engine with property defaults
 */
export function createPricingEngine(property: Property): DynamicPricingEngine {
  return new DynamicPricingEngine({
    baseRate: property.baseRate,
    minRate: property.minRate,
    maxRate: property.maxRate,
    cleaningFee: property.cleaningFee,
  });
}

export const dynamicPricingEngine = new DynamicPricingEngine();
