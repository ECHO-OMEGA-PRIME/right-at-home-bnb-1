/**
 * Right at Home BnB - Competitor Analysis
 * Track and analyze competitor pricing for market positioning
 */

import type {
  Competitor,
  CompetitorRate,
  CompetitorConfig,
  MarketData,
  Property,
} from './types';

/**
 * Competitor tracking and analysis
 */
export class CompetitorAnalyzer {
  private competitors: Map<string, Competitor>;
  private rateHistory: Map<string, CompetitorRate[]>;
  private config: CompetitorConfig;

  constructor(config: Partial<CompetitorConfig> = {}) {
    this.competitors = new Map();
    this.rateHistory = new Map();
    this.config = {
      enabled: config.enabled ?? true,
      competitors: config.competitors || [],
      adjustmentRange: config.adjustmentRange || { min: 0.85, max: 1.25 },
      updateFrequency: config.updateFrequency || 'daily',
    };

    // Initialize competitors
    for (const competitor of this.config.competitors) {
      this.addCompetitor(competitor);
    }
  }

  /**
   * Add a competitor to track
   */
  addCompetitor(competitor: Competitor): void {
    this.competitors.set(competitor.id, competitor);
    this.rateHistory.set(competitor.id, []);
  }

  /**
   * Remove a competitor from tracking
   */
  removeCompetitor(competitorId: string): void {
    this.competitors.delete(competitorId);
    this.rateHistory.delete(competitorId);
  }

  /**
   * Record a competitor's rate for a specific date
   */
  recordRate(competitorId: string, date: Date, rate: number, available: boolean): void {
    const history = this.rateHistory.get(competitorId);
    if (!history) return;

    history.push({
      competitorId,
      date,
      rate,
      available,
      fetchedAt: new Date(),
    });

    // Keep only last 365 days of history
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const filtered = history.filter((r) => r.fetchedAt >= yearAgo);
    this.rateHistory.set(competitorId, filtered);
  }

  /**
   * Get market data for a specific date
   */
  getMarketData(date: Date): MarketData {
    const rates: number[] = [];

    for (const [competitorId, history] of this.rateHistory) {
      // Find the most recent rate for this date
      const dateStr = date.toISOString().split('T')[0];
      const relevantRates = history.filter(
        (r) => r.date.toISOString().split('T')[0] === dateStr && r.available
      );

      if (relevantRates.length > 0) {
        // Use the most recent fetch
        const mostRecent = relevantRates.sort(
          (a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime()
        )[0];
        rates.push(mostRecent.rate);
      }
    }

    if (rates.length === 0) {
      return {
        date,
        averageRate: 0,
        medianRate: 0,
        minRate: 0,
        maxRate: 0,
        occupancyRate: 0,
        sampleSize: 0,
      };
    }

    const sorted = [...rates].sort((a, b) => a - b);
    const sum = rates.reduce((a, b) => a + b, 0);

    return {
      date,
      averageRate: Math.round(sum / rates.length),
      medianRate: Math.round(
        rates.length % 2 === 0
          ? (sorted[rates.length / 2 - 1] + sorted[rates.length / 2]) / 2
          : sorted[Math.floor(rates.length / 2)]
      ),
      minRate: Math.min(...rates),
      maxRate: Math.max(...rates),
      occupancyRate: this.calculateOccupancyRate(date),
      sampleSize: rates.length,
    };
  }

  /**
   * Calculate market occupancy rate based on competitor availability
   */
  private calculateOccupancyRate(date: Date): number {
    const dateStr = date.toISOString().split('T')[0];
    let available = 0;
    let total = 0;

    for (const history of this.rateHistory.values()) {
      const relevantRates = history.filter(
        (r) => r.date.toISOString().split('T')[0] === dateStr
      );

      if (relevantRates.length > 0) {
        total++;
        const mostRecent = relevantRates.sort(
          (a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime()
        )[0];
        if (!mostRecent.available) {
          // Not available = booked
          available++;
        }
      }
    }

    if (total === 0) return 0;
    return Math.round((available / total) * 100) / 100;
  }

  /**
   * Calculate competitive pricing adjustment
   */
  getCompetitiveAdjustment(
    property: Property,
    date: Date,
    currentRate: number
  ): { multiplier: number; reasoning: string } {
    if (!this.config.enabled) {
      return { multiplier: 1.0, reasoning: 'Competitor tracking disabled' };
    }

    const marketData = this.getMarketData(date);

    if (marketData.sampleSize < 3) {
      return {
        multiplier: 1.0,
        reasoning: `Insufficient competitor data (only ${marketData.sampleSize} samples)`,
      };
    }

    // Compare our rate to market average
    const marketPosition = currentRate / marketData.averageRate;

    // Get similar competitors (by bedroom count)
    const similarCompetitors = Array.from(this.competitors.values()).filter(
      (c) => Math.abs(c.bedrooms - property.bedrooms) <= 1
    );

    let targetMultiplier = 1.0;
    let reasoning = '';

    // Strategy: Position based on market conditions
    if (marketData.occupancyRate > 0.8) {
      // High demand - price higher
      targetMultiplier = 1.1;
      reasoning = `High market occupancy (${Math.round(marketData.occupancyRate * 100)}%) - pricing above average`;
    } else if (marketData.occupancyRate < 0.5) {
      // Low demand - be competitive
      targetMultiplier = 0.95;
      reasoning = `Low market occupancy (${Math.round(marketData.occupancyRate * 100)}%) - pricing competitively`;
    } else {
      // Normal conditions - match market
      if (currentRate > marketData.averageRate * 1.1) {
        targetMultiplier = 0.98;
        reasoning = `Priced above market average ($${marketData.averageRate}) - slight reduction suggested`;
      } else if (currentRate < marketData.averageRate * 0.9) {
        targetMultiplier = 1.05;
        reasoning = `Priced below market average ($${marketData.averageRate}) - opportunity to increase`;
      } else {
        targetMultiplier = 1.0;
        reasoning = `Well-positioned relative to market average ($${marketData.averageRate})`;
      }
    }

    // Clamp to configured range
    targetMultiplier = Math.max(
      this.config.adjustmentRange.min,
      Math.min(this.config.adjustmentRange.max, targetMultiplier)
    );

    return { multiplier: targetMultiplier, reasoning };
  }

  /**
   * Get competitor price comparison
   */
  getCompetitorComparison(
    property: Property,
    date: Date
  ): Array<{
    competitor: Competitor;
    rate: number | null;
    available: boolean;
    priceDifference: number | null;
  }> {
    const dateStr = date.toISOString().split('T')[0];
    const results: Array<{
      competitor: Competitor;
      rate: number | null;
      available: boolean;
      priceDifference: number | null;
    }> = [];

    for (const [competitorId, competitor] of this.competitors) {
      const history = this.rateHistory.get(competitorId) || [];
      const relevantRates = history.filter(
        (r) => r.date.toISOString().split('T')[0] === dateStr
      );

      if (relevantRates.length > 0) {
        const mostRecent = relevantRates.sort(
          (a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime()
        )[0];
        results.push({
          competitor,
          rate: mostRecent.rate,
          available: mostRecent.available,
          priceDifference: property.baseRate - mostRecent.rate,
        });
      } else {
        results.push({
          competitor,
          rate: null,
          available: false,
          priceDifference: null,
        });
      }
    }

    return results.sort((a, b) => {
      if (a.rate === null) return 1;
      if (b.rate === null) return -1;
      return a.rate - b.rate;
    });
  }

  /**
   * Analyze competitor pricing trends
   */
  analyzeTrends(
    competitorId: string,
    days: number = 30
  ): {
    trend: 'increasing' | 'decreasing' | 'stable';
    averageChange: number;
    volatility: number;
  } {
    const history = this.rateHistory.get(competitorId) || [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentRates = history
      .filter((r) => r.fetchedAt >= cutoff)
      .sort((a, b) => a.fetchedAt.getTime() - b.fetchedAt.getTime());

    if (recentRates.length < 2) {
      return { trend: 'stable', averageChange: 0, volatility: 0 };
    }

    // Calculate daily changes
    const changes: number[] = [];
    for (let i = 1; i < recentRates.length; i++) {
      const change = recentRates[i].rate - recentRates[i - 1].rate;
      changes.push(change);
    }

    const averageChange = changes.reduce((a, b) => a + b, 0) / changes.length;

    // Calculate volatility (standard deviation)
    const squaredDiffs = changes.map((c) => Math.pow(c - averageChange, 2));
    const volatility = Math.sqrt(
      squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length
    );

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (averageChange > 5) {
      trend = 'increasing';
    } else if (averageChange < -5) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return {
      trend,
      averageChange: Math.round(averageChange * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
    };
  }

  /**
   * Get market position ranking
   */
  getMarketPosition(
    property: Property,
    currentRate: number,
    date: Date
  ): {
    rank: number;
    total: number;
    percentile: number;
    position: 'budget' | 'mid-range' | 'premium' | 'luxury';
  } {
    const comparison = this.getCompetitorComparison(property, date);
    const ratesWithOurs = [...comparison.map((c) => c.rate).filter((r) => r !== null), currentRate] as number[];

    if (ratesWithOurs.length === 0) {
      return { rank: 1, total: 1, percentile: 50, position: 'mid-range' };
    }

    const sorted = [...ratesWithOurs].sort((a, b) => a - b);
    const rank = sorted.indexOf(currentRate) + 1;
    const percentile = Math.round((rank / sorted.length) * 100);

    let position: 'budget' | 'mid-range' | 'premium' | 'luxury';
    if (percentile <= 25) {
      position = 'budget';
    } else if (percentile <= 50) {
      position = 'mid-range';
    } else if (percentile <= 75) {
      position = 'premium';
    } else {
      position = 'luxury';
    }

    return {
      rank,
      total: sorted.length,
      percentile,
      position,
    };
  }

  /**
   * Generate pricing recommendations based on competitor data
   */
  generateRecommendations(
    property: Property,
    dates: Date[]
  ): Array<{
    date: Date;
    recommendedRate: number;
    reasoning: string;
    competitorAvg: number;
    confidence: 'high' | 'medium' | 'low';
  }> {
    const recommendations: Array<{
      date: Date;
      recommendedRate: number;
      reasoning: string;
      competitorAvg: number;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    for (const date of dates) {
      const marketData = this.getMarketData(date);
      const adjustment = this.getCompetitiveAdjustment(property, date, property.baseRate);

      let confidence: 'high' | 'medium' | 'low';
      if (marketData.sampleSize >= 5) {
        confidence = 'high';
      } else if (marketData.sampleSize >= 3) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      recommendations.push({
        date,
        recommendedRate: Math.round(property.baseRate * adjustment.multiplier),
        reasoning: adjustment.reasoning,
        competitorAvg: marketData.averageRate,
        confidence,
      });
    }

    return recommendations;
  }

  /**
   * Get all tracked competitors
   */
  getCompetitors(): Competitor[] {
    return Array.from(this.competitors.values());
  }

  /**
   * Calculate similarity score between properties
   */
  calculateSimilarityScore(property: Property, competitor: Competitor): number {
    let score = 0;

    // Bedroom match (most important)
    const bedroomDiff = Math.abs(property.bedrooms - competitor.bedrooms);
    if (bedroomDiff === 0) score += 40;
    else if (bedroomDiff === 1) score += 25;
    else if (bedroomDiff === 2) score += 10;

    // Platform match
    if (competitor.platform === 'airbnb' || competitor.platform === 'vrbo') {
      score += 20;
    }

    // Add the competitor's pre-calculated similarity score
    score += competitor.similarityScore * 40;

    return Math.min(100, score);
  }

  /**
   * Import competitor rates from external source
   */
  importRates(
    data: Array<{
      competitorId: string;
      date: string;
      rate: number;
      available: boolean;
    }>
  ): number {
    let imported = 0;

    for (const item of data) {
      if (this.competitors.has(item.competitorId)) {
        this.recordRate(
          item.competitorId,
          new Date(item.date),
          item.rate,
          item.available
        );
        imported++;
      }
    }

    return imported;
  }

  /**
   * Export rate history for analysis
   */
  exportRateHistory(): Array<{
    competitorId: string;
    competitorName: string;
    date: string;
    rate: number;
    available: boolean;
    fetchedAt: string;
  }> {
    const exports: Array<{
      competitorId: string;
      competitorName: string;
      date: string;
      rate: number;
      available: boolean;
      fetchedAt: string;
    }> = [];

    for (const [competitorId, history] of this.rateHistory) {
      const competitor = this.competitors.get(competitorId);
      for (const rate of history) {
        exports.push({
          competitorId,
          competitorName: competitor?.name || 'Unknown',
          date: rate.date.toISOString().split('T')[0],
          rate: rate.rate,
          available: rate.available,
          fetchedAt: rate.fetchedAt.toISOString(),
        });
      }
    }

    return exports.sort((a, b) => a.date.localeCompare(b.date));
  }
}

/**
 * Default Midland competitor set (example properties)
 */
export const DEFAULT_MIDLAND_COMPETITORS: Competitor[] = [
  {
    id: 'comp_1',
    name: 'Downtown Midland 3BR',
    platform: 'airbnb',
    bedrooms: 3,
    similarityScore: 0.85,
  },
  {
    id: 'comp_2',
    name: 'Oilfield Executive Suite',
    platform: 'vrbo',
    bedrooms: 4,
    similarityScore: 0.75,
  },
  {
    id: 'comp_3',
    name: 'Midland Family Home',
    platform: 'airbnb',
    bedrooms: 3,
    similarityScore: 0.9,
  },
  {
    id: 'comp_4',
    name: 'Budget Midland 2BR',
    platform: 'airbnb',
    bedrooms: 2,
    similarityScore: 0.6,
  },
  {
    id: 'comp_5',
    name: 'Luxury West Texas Estate',
    platform: 'vrbo',
    bedrooms: 5,
    similarityScore: 0.5,
  },
];

export const competitorAnalyzer = new CompetitorAnalyzer({
  enabled: true,
  competitors: DEFAULT_MIDLAND_COMPETITORS,
});
