/**
 * Right at Home BnB - Revenue Optimizer
 * Optimize pricing for maximum revenue
 */

import type {
  Property,
  RevenueProjection,
  RevenueScenario,
  PriceRecommendation,
  DatePricing,
  OccupancyData,
  PricingBreakdown,
} from './types';
import { SeasonalRatesManager } from './seasonal-rates';
import { CompetitorAnalyzer } from './competitor-analysis';

interface OptimizationConfig {
  targetOccupancy: number;
  minAcceptableRate: number;
  maxRate: number;
  revenueGoal?: number;
  prioritizeOccupancy: boolean;
}

export class RevenueOptimizer {
  private seasonalManager: SeasonalRatesManager;
  private competitorAnalyzer: CompetitorAnalyzer;

  constructor(
    seasonalManager?: SeasonalRatesManager,
    competitorAnalyzer?: CompetitorAnalyzer
  ) {
    this.seasonalManager = seasonalManager || new SeasonalRatesManager();
    this.competitorAnalyzer = competitorAnalyzer || new CompetitorAnalyzer();
  }

  /**
   * Generate revenue projection for a property
   */
  generateProjection(
    property: Property,
    period: 'week' | 'month' | 'quarter' | 'year',
    startDate?: Date
  ): RevenueProjection {
    const start = startDate || new Date();
    const end = this.getEndDate(start, period);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate projected rates for each day
    const dailyRates = this.calculateDailyRates(property, start, end);
    const averageRate = dailyRates.reduce((sum, r) => sum + r.adjustedRate, 0) / dailyRates.length;

    // Generate scenarios
    const scenarios = this.generateScenarios(property, dailyRates, totalDays);

    // Use moderate scenario as primary projection
    const moderateScenario = scenarios.find((s) => s.name === 'moderate')!;

    return {
      propertyId: property.id,
      period,
      startDate: start,
      endDate: end,
      projectedRevenue: moderateScenario.revenue,
      projectedOccupancy: moderateScenario.occupancyRate,
      averageNightlyRate: Math.round(averageRate),
      scenarios,
    };
  }

  /**
   * Get end date based on period
   */
  private getEndDate(start: Date, period: 'week' | 'month' | 'quarter' | 'year'): Date {
    const end = new Date(start);
    switch (period) {
      case 'week':
        end.setDate(end.getDate() + 7);
        break;
      case 'month':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'quarter':
        end.setMonth(end.getMonth() + 3);
        break;
      case 'year':
        end.setFullYear(end.getFullYear() + 1);
        break;
    }
    return end;
  }

  /**
   * Calculate daily rates for a date range
   */
  private calculateDailyRates(
    property: Property,
    startDate: Date,
    endDate: Date
  ): DatePricing[] {
    const rates: DatePricing[] = [];
    const current = new Date(startDate);

    while (current < endDate) {
      const multiplier = this.seasonalManager.getCombinedMultiplier(current);
      const adjustedRate = Math.round(property.baseRate * multiplier);

      rates.push({
        date: new Date(current),
        baseRate: property.baseRate,
        adjustedRate: Math.max(property.minRate, Math.min(property.maxRate, adjustedRate)),
        factors: this.seasonalManager.getAllMultipliers(current).map((m) => ({
          type: m.type as 'seasonal' | 'weekend' | 'event',
          name: m.name,
          multiplier: m.multiplier,
          impact: (m.multiplier - 1) * property.baseRate,
        })),
        available: true,
        minStay: this.seasonalManager.getMinimumStay(current),
      });

      current.setDate(current.getDate() + 1);
    }

    return rates;
  }

  /**
   * Generate revenue scenarios
   */
  private generateScenarios(
    property: Property,
    dailyRates: DatePricing[],
    totalDays: number
  ): RevenueScenario[] {
    const totalPotentialRevenue = dailyRates.reduce((sum, r) => sum + r.adjustedRate, 0);

    return [
      {
        name: 'conservative',
        occupancyRate: 0.55,
        nightsBooked: Math.floor(totalDays * 0.55),
        revenue: Math.round(totalPotentialRevenue * 0.55 + property.cleaningFee * Math.floor(totalDays * 0.55 / 3)),
      },
      {
        name: 'moderate',
        occupancyRate: 0.70,
        nightsBooked: Math.floor(totalDays * 0.70),
        revenue: Math.round(totalPotentialRevenue * 0.70 + property.cleaningFee * Math.floor(totalDays * 0.70 / 3)),
      },
      {
        name: 'optimistic',
        occupancyRate: 0.85,
        nightsBooked: Math.floor(totalDays * 0.85),
        revenue: Math.round(totalPotentialRevenue * 0.85 + property.cleaningFee * Math.floor(totalDays * 0.85 / 3)),
      },
    ];
  }

  /**
   * Generate price recommendations
   */
  generateRecommendations(
    property: Property,
    occupancyData: OccupancyData[],
    lookAheadDays: number = 30
  ): PriceRecommendation[] {
    const recommendations: PriceRecommendation[] = [];
    const today = new Date();

    for (let i = 0; i < lookAheadDays; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      // Check if date is booked
      const occupancy = occupancyData.find(
        (o) => o.date.toISOString().split('T')[0] === date.toISOString().split('T')[0]
      );

      if (occupancy?.isBooked) continue;

      const recommendation = this.recommendPrice(property, date, i);
      recommendations.push(recommendation);
    }

    return recommendations;
  }

  /**
   * Recommend optimal price for a specific date
   */
  private recommendPrice(
    property: Property,
    date: Date,
    daysAhead: number
  ): PriceRecommendation {
    const reasoning: string[] = [];

    // Start with seasonal rate
    const seasonalMultiplier = this.seasonalManager.getCombinedMultiplier(date);
    let recommendedRate = property.baseRate * seasonalMultiplier;
    reasoning.push(
      `Base rate: $${property.baseRate} x ${seasonalMultiplier.toFixed(2)} seasonal = $${Math.round(recommendedRate)}`
    );

    // Get competitor adjustment
    const competitorAdjustment = this.competitorAnalyzer.getCompetitiveAdjustment(
      property,
      date,
      recommendedRate
    );
    recommendedRate *= competitorAdjustment.multiplier;
    reasoning.push(competitorAdjustment.reasoning);

    // Last-minute adjustments
    if (daysAhead <= 3) {
      // Very last minute - discount to fill
      const lastMinuteDiscount = 0.85;
      recommendedRate *= lastMinuteDiscount;
      reasoning.push(`Last-minute discount (${daysAhead} days ahead): -15%`);
    } else if (daysAhead <= 7) {
      // Week ahead - slight discount
      const weekDiscount = 0.95;
      recommendedRate *= weekDiscount;
      reasoning.push(`7-day window discount: -5%`);
    }

    // Apply min/max constraints
    recommendedRate = Math.max(property.minRate, Math.min(property.maxRate, recommendedRate));
    recommendedRate = Math.round(recommendedRate);

    // Calculate confidence
    const confidence = this.calculateConfidence(daysAhead, competitorAdjustment.multiplier);

    // Calculate potential revenue difference
    const currentRate = Math.round(property.baseRate * seasonalMultiplier);
    const potentialDifference = recommendedRate - currentRate;

    return {
      propertyId: property.id,
      date,
      currentRate,
      recommendedRate,
      confidence,
      reasoning,
      potentialRevenue: {
        current: currentRate,
        recommended: recommendedRate,
        difference: potentialDifference,
      },
    };
  }

  /**
   * Calculate recommendation confidence
   */
  private calculateConfidence(daysAhead: number, competitorMultiplier: number): number {
    let confidence = 0.8;

    // Reduce confidence for far-out dates
    if (daysAhead > 60) confidence -= 0.2;
    else if (daysAhead > 30) confidence -= 0.1;

    // Reduce confidence for extreme competitor adjustments
    if (competitorMultiplier < 0.9 || competitorMultiplier > 1.1) {
      confidence -= 0.1;
    }

    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * Optimize pricing for a date range
   */
  optimizePricing(
    property: Property,
    startDate: Date,
    endDate: Date,
    config: Partial<OptimizationConfig> = {}
  ): DatePricing[] {
    const fullConfig: OptimizationConfig = {
      targetOccupancy: config.targetOccupancy ?? 0.75,
      minAcceptableRate: config.minAcceptableRate ?? property.minRate,
      maxRate: config.maxRate ?? property.maxRate,
      revenueGoal: config.revenueGoal,
      prioritizeOccupancy: config.prioritizeOccupancy ?? false,
    };

    const optimizedRates: DatePricing[] = [];
    const current = new Date(startDate);

    while (current < endDate) {
      const optimizedRate = this.optimizeSingleDay(property, current, fullConfig);
      optimizedRates.push(optimizedRate);
      current.setDate(current.getDate() + 1);
    }

    return optimizedRates;
  }

  /**
   * Optimize pricing for a single day
   */
  private optimizeSingleDay(
    property: Property,
    date: Date,
    config: OptimizationConfig
  ): DatePricing {
    // Get base seasonal rate
    const multiplier = this.seasonalManager.getCombinedMultiplier(date);
    let baseAdjustedRate = property.baseRate * multiplier;

    // Get market data
    const marketData = this.competitorAnalyzer.getMarketData(date);

    // Optimization strategy
    let optimizedRate: number;

    if (config.prioritizeOccupancy) {
      // Price competitively to maximize bookings
      optimizedRate = Math.min(baseAdjustedRate, marketData.medianRate || baseAdjustedRate);
      optimizedRate = Math.max(optimizedRate * 0.95, config.minAcceptableRate);
    } else {
      // Balance revenue and occupancy
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

      if (isWeekend) {
        // Weekends can command premium
        optimizedRate = baseAdjustedRate * 1.05;
      } else {
        // Weekdays - be more competitive
        optimizedRate = baseAdjustedRate * 0.98;
      }

      // Adjust based on market
      if (marketData.sampleSize >= 3) {
        if (marketData.occupancyRate > 0.8) {
          // High demand - increase price
          optimizedRate = Math.min(optimizedRate * 1.1, config.maxRate);
        } else if (marketData.occupancyRate < 0.5) {
          // Low demand - reduce price
          optimizedRate = Math.max(optimizedRate * 0.9, config.minAcceptableRate);
        }
      }
    }

    // Apply constraints
    optimizedRate = Math.max(config.minAcceptableRate, Math.min(config.maxRate, optimizedRate));
    optimizedRate = Math.round(optimizedRate);

    const factors = this.seasonalManager.getAllMultipliers(date).map((m) => ({
      type: m.type as 'seasonal' | 'weekend' | 'event',
      name: m.name,
      multiplier: m.multiplier,
      impact: (m.multiplier - 1) * property.baseRate,
    }));

    return {
      date: new Date(date),
      baseRate: property.baseRate,
      adjustedRate: optimizedRate,
      factors,
      available: true,
      minStay: this.seasonalManager.getMinimumStay(date),
    };
  }

  /**
   * Calculate revenue potential vs actual
   */
  calculateRevenuePotential(
    property: Property,
    bookings: Array<{
      checkIn: Date;
      checkOut: Date;
      totalPrice: number;
    }>,
    period: { start: Date; end: Date }
  ): {
    actualRevenue: number;
    potentialRevenue: number;
    revenueGap: number;
    occupancyRate: number;
    averageRate: number;
    optimizedPotential: number;
  } {
    const totalDays = Math.ceil(
      (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate actual revenue and booked nights
    let actualRevenue = 0;
    let bookedNights = 0;

    for (const booking of bookings) {
      if (booking.checkIn >= period.start && booking.checkOut <= period.end) {
        actualRevenue += booking.totalPrice;
        bookedNights += Math.ceil(
          (booking.checkOut.getTime() - booking.checkIn.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    // Calculate potential revenue at optimized rates
    const optimizedRates = this.optimizePricing(property, period.start, period.end);
    const potentialRevenue = optimizedRates.reduce((sum, r) => sum + r.adjustedRate, 0);

    // Calculate optimized potential (with realistic occupancy)
    const optimizedPotential = Math.round(potentialRevenue * 0.75); // 75% target occupancy

    return {
      actualRevenue,
      potentialRevenue,
      revenueGap: potentialRevenue - actualRevenue,
      occupancyRate: bookedNights / totalDays,
      averageRate: bookedNights > 0 ? actualRevenue / bookedNights : 0,
      optimizedPotential,
    };
  }

  /**
   * Suggest optimal minimum stay requirements
   */
  suggestMinimumStay(date: Date): {
    recommended: number;
    reasoning: string;
  } {
    const dayOfWeek = date.getDay();
    const event = this.seasonalManager.getEventPricing(date);

    if (event?.minStay) {
      return {
        recommended: event.minStay,
        reasoning: `${event.name} event - ${event.minStay}-night minimum`,
      };
    }

    // Weekend
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      return {
        recommended: 2,
        reasoning: 'Weekend - 2-night minimum recommended',
      };
    }

    // Holiday adjacent
    const month = date.getMonth();
    if ((month === 11 && date.getDate() >= 20) || (month === 0 && date.getDate() <= 5)) {
      return {
        recommended: 3,
        reasoning: 'Holiday season - 3-night minimum recommended',
      };
    }

    return {
      recommended: 1,
      reasoning: 'Standard weekday - 1-night minimum',
    };
  }

  /**
   * Calculate pricing breakdown
   */
  calculatePricingBreakdown(
    property: Property,
    checkIn: Date,
    checkOut: Date,
    guestCount: number
  ): PricingBreakdown & { nightlyRates: DatePricing[] } {
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    const nightlyRates = this.calculateDailyRates(property, checkIn, checkOut);

    let baseTotal = 0;
    let seasonalAdjustment = 0;
    let weekendAdjustment = 0;
    let eventAdjustment = 0;

    for (const rate of nightlyRates) {
      baseTotal += property.baseRate;

      for (const factor of rate.factors) {
        const impact = factor.impact;
        switch (factor.type) {
          case 'seasonal':
            seasonalAdjustment += impact;
            break;
          case 'weekend':
            weekendAdjustment += impact;
            break;
          case 'event':
            eventAdjustment += impact;
            break;
        }
      }
    }

    const subtotal = nightlyRates.reduce((sum, r) => sum + r.adjustedRate, 0);

    // Length of stay discount
    let discountPercent = 0;
    if (nights >= 30) discountPercent = 20;
    else if (nights >= 14) discountPercent = 15;
    else if (nights >= 7) discountPercent = 10;
    else if (nights >= 5) discountPercent = 5;

    const discounts = Math.round(subtotal * (discountPercent / 100));
    const fees = property.cleaningFee;
    const finalTotal = subtotal - discounts + fees;

    return {
      baseTotal: Math.round(baseTotal),
      seasonalAdjustment: Math.round(seasonalAdjustment),
      weekendAdjustment: Math.round(weekendAdjustment),
      eventAdjustment: Math.round(eventAdjustment),
      demandAdjustment: 0,
      competitorAdjustment: 0,
      discounts: Math.round(discounts),
      fees: Math.round(fees),
      finalTotal: Math.round(finalTotal),
      nightlyRates,
    };
  }
}

export const revenueOptimizer = new RevenueOptimizer();
