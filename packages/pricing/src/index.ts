/**
 * Right at Home BnB - Smart Pricing Engine Package
 * Export all pricing functionality
 */

export {
  DynamicPricingEngine,
  createPricingEngine,
  dynamicPricingEngine,
} from './dynamic-pricing';

export {
  SeasonalRatesManager,
  seasonalRatesManager,
  getMidlandEvents,
  SEASONAL_MULTIPLIERS,
  MIDLAND_SEASONS,
} from './seasonal-rates';

export {
  CompetitorAnalyzer,
  competitorAnalyzer,
  DEFAULT_MIDLAND_COMPETITORS,
} from './competitor-analysis';

export {
  RevenueOptimizer,
  revenueOptimizer,
} from './revenue-optimizer';

export type {
  Property,
  PricingConfig,
  SeasonalMultiplier,
  SeasonDefinition,
  EventPricing,
  LengthOfStayDiscount,
  LastMinuteDiscount,
  DemandMultiplier,
  CompetitorConfig,
  Competitor,
  CompetitorRate,
  DatePricing,
  PricingFactor,
  OccupancyData,
  MarketData,
  RevenueProjection,
  RevenueScenario,
  PriceRecommendation,
  MidlandEvents,
  DynamicPricingResult,
  PricingBreakdown,
} from './types';
