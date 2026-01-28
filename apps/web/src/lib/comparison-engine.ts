/**
 * Right at Home BnB - Property Comparison Engine
 * Comprehensive comparison calculations for multi-property portfolio analysis
 * @author ECHO OMEGA PRIME
 */

import type { Property, Booking } from './types';
import type { Expense, FinancialSummary, CleaningRecord, MaintenanceRecord } from './financials';

// Comparison metric types
export type ComparisonMetric =
  | 'revenue'
  | 'occupancy'
  | 'guestRating'
  | 'expenseRatio'
  | 'noi' // Net Operating Income
  | 'revpar' // Revenue Per Available Room
  | 'adr' // Average Daily Rate
  | 'totalExpenses'
  | 'profitMargin';

export type PerformanceCategory = 'excellent' | 'good' | 'average' | 'below_average' | 'poor';

// Property metrics for comparison
export interface PropertyMetrics {
  propertyId: string;
  propertyName: string;
  // Revenue metrics
  grossRevenue: number;
  netRevenue: number;
  averageDailyRate: number;
  revPAR: number; // Revenue per available room
  // Occupancy metrics
  occupancyRate: number;
  totalNights: number;
  bookedNights: number;
  averageStayLength: number;
  // Rating metrics
  averageGuestRating: number;
  totalReviews: number;
  fiveStarPercentage: number;
  // Expense metrics
  totalExpenses: number;
  expenseRatio: number; // expenses / revenue
  cleaningCosts: number;
  maintenanceCosts: number;
  utilityCosts: number;
  // Profitability
  netOperatingIncome: number;
  profitMargin: number;
  // Computed rankings
  revenueRank?: number;
  occupancyRank?: number;
  ratingRank?: number;
  noiRank?: number;
  overallRank?: number;
  performanceCategory?: PerformanceCategory;
}

// Portfolio-level metrics
export interface PortfolioMetrics {
  totalProperties: number;
  totalRevenue: number;
  totalExpenses: number;
  totalNOI: number;
  averageOccupancy: number;
  averageRating: number;
  averageExpenseRatio: number;
  portfolioProfitMargin: number;
  // Period comparison
  periodStart: string;
  periodEnd: string;
  // Benchmark comparison
  industryAverageOccupancy: number;
  industryAverageADR: number;
  performanceVsBenchmark: number;
  // Best/worst performers
  topPerformer: PropertyMetrics | null;
  worstPerformer: PropertyMetrics | null;
  mostImproved: string | null;
  needsAttention: string[];
}

// Comparison result
export interface ComparisonResult {
  properties: PropertyMetrics[];
  portfolio: PortfolioMetrics;
  insights: ComparisonInsight[];
  recommendations: string[];
}

// AI-generated insights
export interface ComparisonInsight {
  type: 'success' | 'warning' | 'info' | 'alert';
  title: string;
  description: string;
  metric: ComparisonMetric;
  propertyId?: string;
  value?: number;
  change?: number;
}

// Calculate occupancy rate for a property within date range
export function calculateOccupancy(
  bookings: Booking[],
  startDate: Date,
  endDate: Date
): { rate: number; bookedNights: number; totalNights: number; avgStayLength: number } {
  const totalNights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  let bookedNights = 0;
  let totalStayLength = 0;
  let stayCount = 0;

  bookings.forEach(booking => {
    const bookingStart = new Date(booking.checkIn);
    const bookingEnd = new Date(booking.checkOut);

    // Check if booking overlaps with our date range
    if (bookingEnd >= startDate && bookingStart <= endDate) {
      const overlapStart = bookingStart > startDate ? bookingStart : startDate;
      const overlapEnd = bookingEnd < endDate ? bookingEnd : endDate;
      const nights = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
      bookedNights += nights;
      totalStayLength += booking.totalNights || nights;
      stayCount++;
    }
  });

  return {
    rate: totalNights > 0 ? (bookedNights / totalNights) * 100 : 0,
    bookedNights,
    totalNights,
    avgStayLength: stayCount > 0 ? totalStayLength / stayCount : 0
  };
}

// Calculate revenue metrics for a property
export function calculateRevenueMetrics(
  bookings: Booking[],
  startDate: Date,
  endDate: Date
): { gross: number; avgDailyRate: number; revPAR: number } {
  const totalNights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  let grossRevenue = 0;
  let totalBookedNights = 0;

  bookings.forEach(booking => {
    const bookingStart = new Date(booking.checkIn);
    const bookingEnd = new Date(booking.checkOut);

    if (bookingEnd >= startDate && bookingStart <= endDate) {
      grossRevenue += booking.totalPrice || 0;
      totalBookedNights += booking.totalNights || 0;
    }
  });

  return {
    gross: grossRevenue,
    avgDailyRate: totalBookedNights > 0 ? grossRevenue / totalBookedNights : 0,
    revPAR: totalNights > 0 ? grossRevenue / totalNights : 0
  };
}

// Calculate expense metrics for a property
export function calculateExpenseMetrics(
  expenses: Expense[],
  cleaningRecords: CleaningRecord[],
  maintenanceRecords: MaintenanceRecord[],
  startDate: string,
  endDate: string
): { total: number; cleaning: number; maintenance: number; utilities: number; other: number } {
  let cleaning = 0;
  let maintenance = 0;
  let utilities = 0;
  let other = 0;

  // Process general expenses
  expenses.forEach(expense => {
    if (expense.date >= startDate && expense.date <= endDate) {
      switch (expense.category) {
        case 'cleaning':
          cleaning += expense.amount;
          break;
        case 'maintenance':
          maintenance += expense.amount;
          break;
        case 'utilities':
          utilities += expense.amount;
          break;
        default:
          other += expense.amount;
      }
    }
  });

  // Add cleaning records
  cleaningRecords.forEach(record => {
    const recordDate = record.scheduledDate;
    if (recordDate >= startDate && recordDate <= endDate && record.status === 'completed') {
      cleaning += record.totalCost;
    }
  });

  // Add maintenance records
  maintenanceRecords.forEach(record => {
    if (record.completedDate && record.completedDate >= startDate && record.completedDate <= endDate) {
      maintenance += record.totalCost;
    }
  });

  return {
    total: cleaning + maintenance + utilities + other,
    cleaning,
    maintenance,
    utilities,
    other
  };
}

// Calculate guest rating metrics
export function calculateRatingMetrics(
  guestRatings: { rating: number; date: string }[],
  startDate: string,
  endDate: string
): { average: number; total: number; fiveStarPct: number } {
  const filteredRatings = guestRatings.filter(r => r.date >= startDate && r.date <= endDate);

  if (filteredRatings.length === 0) {
    return { average: 0, total: 0, fiveStarPct: 0 };
  }

  const sum = filteredRatings.reduce((acc, r) => acc + r.rating, 0);
  const fiveStars = filteredRatings.filter(r => r.rating >= 4.8).length;

  return {
    average: sum / filteredRatings.length,
    total: filteredRatings.length,
    fiveStarPct: (fiveStars / filteredRatings.length) * 100
  };
}

// Calculate Net Operating Income
export function calculateNOI(grossRevenue: number, totalExpenses: number): number {
  return grossRevenue - totalExpenses;
}

// Calculate profit margin
export function calculateProfitMargin(grossRevenue: number, netIncome: number): number {
  return grossRevenue > 0 ? (netIncome / grossRevenue) * 100 : 0;
}

// Calculate expense ratio
export function calculateExpenseRatio(totalExpenses: number, grossRevenue: number): number {
  return grossRevenue > 0 ? (totalExpenses / grossRevenue) * 100 : 0;
}

// Determine performance category based on metrics
export function determinePerformanceCategory(metrics: PropertyMetrics): PerformanceCategory {
  let score = 0;
  const weights = {
    occupancy: 0.25,
    profitMargin: 0.25,
    guestRating: 0.20,
    expenseRatio: 0.15,
    revPAR: 0.15
  };

  // Occupancy scoring (0-100)
  if (metrics.occupancyRate >= 85) score += 100 * weights.occupancy;
  else if (metrics.occupancyRate >= 70) score += 80 * weights.occupancy;
  else if (metrics.occupancyRate >= 55) score += 60 * weights.occupancy;
  else if (metrics.occupancyRate >= 40) score += 40 * weights.occupancy;
  else score += 20 * weights.occupancy;

  // Profit margin scoring
  if (metrics.profitMargin >= 60) score += 100 * weights.profitMargin;
  else if (metrics.profitMargin >= 45) score += 80 * weights.profitMargin;
  else if (metrics.profitMargin >= 30) score += 60 * weights.profitMargin;
  else if (metrics.profitMargin >= 15) score += 40 * weights.profitMargin;
  else score += 20 * weights.profitMargin;

  // Guest rating scoring (assuming 5-point scale)
  if (metrics.averageGuestRating >= 4.8) score += 100 * weights.guestRating;
  else if (metrics.averageGuestRating >= 4.5) score += 80 * weights.guestRating;
  else if (metrics.averageGuestRating >= 4.0) score += 60 * weights.guestRating;
  else if (metrics.averageGuestRating >= 3.5) score += 40 * weights.guestRating;
  else score += 20 * weights.guestRating;

  // Expense ratio scoring (lower is better)
  if (metrics.expenseRatio <= 25) score += 100 * weights.expenseRatio;
  else if (metrics.expenseRatio <= 35) score += 80 * weights.expenseRatio;
  else if (metrics.expenseRatio <= 45) score += 60 * weights.expenseRatio;
  else if (metrics.expenseRatio <= 55) score += 40 * weights.expenseRatio;
  else score += 20 * weights.expenseRatio;

  // RevPAR scoring (relative to portfolio average would be ideal)
  const normalizedRevPAR = Math.min(metrics.revPAR / 200, 1) * 100; // Assuming $200 is excellent
  score += normalizedRevPAR * weights.revPAR;

  // Convert score to category
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'average';
  if (score >= 40) return 'below_average';
  return 'poor';
}

// Rank properties by metric
export function rankByMetric(
  properties: PropertyMetrics[],
  metric: ComparisonMetric,
  ascending: boolean = false
): PropertyMetrics[] {
  const getValue = (p: PropertyMetrics): number => {
    switch (metric) {
      case 'revenue': return p.grossRevenue;
      case 'occupancy': return p.occupancyRate;
      case 'guestRating': return p.averageGuestRating;
      case 'expenseRatio': return p.expenseRatio;
      case 'noi': return p.netOperatingIncome;
      case 'revpar': return p.revPAR;
      case 'adr': return p.averageDailyRate;
      case 'totalExpenses': return p.totalExpenses;
      case 'profitMargin': return p.profitMargin;
      default: return 0;
    }
  };

  return [...properties].sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    return ascending ? aVal - bVal : bVal - aVal;
  });
}

// Generate comparison insights
export function generateInsights(
  properties: PropertyMetrics[],
  portfolio: PortfolioMetrics
): ComparisonInsight[] {
  const insights: ComparisonInsight[] = [];

  // Top performer insight
  if (portfolio.topPerformer) {
    insights.push({
      type: 'success',
      title: 'Top Performer',
      description: `${portfolio.topPerformer.propertyName} leads with ${portfolio.topPerformer.profitMargin.toFixed(1)}% profit margin and ${portfolio.topPerformer.occupancyRate.toFixed(1)}% occupancy.`,
      metric: 'profitMargin',
      propertyId: portfolio.topPerformer.propertyId,
      value: portfolio.topPerformer.profitMargin
    });
  }

  // Properties needing attention
  const lowOccupancy = properties.filter(p => p.occupancyRate < 50);
  if (lowOccupancy.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Low Occupancy Alert',
      description: `${lowOccupancy.length} properties have occupancy below 50%. Consider adjusting pricing or marketing.`,
      metric: 'occupancy',
      value: lowOccupancy.length
    });
  }

  // High expense ratio warning
  const highExpenseRatio = properties.filter(p => p.expenseRatio > 50);
  if (highExpenseRatio.length > 0) {
    insights.push({
      type: 'alert',
      title: 'High Expense Ratio',
      description: `${highExpenseRatio.length} properties have expense ratios above 50%. Review operational costs.`,
      metric: 'expenseRatio',
      value: highExpenseRatio.length
    });
  }

  // Rating insights
  const lowRating = properties.filter(p => p.averageGuestRating > 0 && p.averageGuestRating < 4.0);
  if (lowRating.length > 0) {
    insights.push({
      type: 'alert',
      title: 'Guest Rating Concern',
      description: `${lowRating.length} properties have ratings below 4.0. Address guest feedback urgently.`,
      metric: 'guestRating',
      value: lowRating.length
    });
  }

  // Portfolio performance vs benchmark
  if (portfolio.averageOccupancy > portfolio.industryAverageOccupancy) {
    insights.push({
      type: 'success',
      title: 'Above Market Performance',
      description: `Portfolio occupancy (${portfolio.averageOccupancy.toFixed(1)}%) exceeds market average (${portfolio.industryAverageOccupancy.toFixed(1)}%).`,
      metric: 'occupancy',
      value: portfolio.averageOccupancy,
      change: portfolio.averageOccupancy - portfolio.industryAverageOccupancy
    });
  }

  // Revenue concentration
  if (properties.length > 3 && portfolio.topPerformer) {
    const topRevenueShare = (portfolio.topPerformer.grossRevenue / portfolio.totalRevenue) * 100;
    if (topRevenueShare > 40) {
      insights.push({
        type: 'info',
        title: 'Revenue Concentration',
        description: `${portfolio.topPerformer.propertyName} accounts for ${topRevenueShare.toFixed(1)}% of total revenue. Consider diversification.`,
        metric: 'revenue',
        propertyId: portfolio.topPerformer.propertyId,
        value: topRevenueShare
      });
    }
  }

  return insights;
}

// Generate recommendations based on comparison
export function generateRecommendations(
  properties: PropertyMetrics[],
  portfolio: PortfolioMetrics
): string[] {
  const recommendations: string[] = [];

  // Pricing recommendations
  const highOccupancyLowADR = properties.filter(
    p => p.occupancyRate > 80 && p.averageDailyRate < portfolio.totalRevenue / portfolio.totalProperties / 30
  );
  if (highOccupancyLowADR.length > 0) {
    recommendations.push(
      `Consider raising rates for ${highOccupancyLowADR.map(p => p.propertyName).join(', ')} - high demand suggests pricing power.`
    );
  }

  // Expense optimization
  const highExpense = properties.filter(p => p.expenseRatio > portfolio.averageExpenseRatio * 1.3);
  if (highExpense.length > 0) {
    recommendations.push(
      `Review operational costs for ${highExpense.map(p => p.propertyName).join(', ')} - expense ratios significantly above portfolio average.`
    );
  }

  // Occupancy improvement
  const lowOccupancy = properties.filter(p => p.occupancyRate < 60);
  if (lowOccupancy.length > 0) {
    recommendations.push(
      `Implement dynamic pricing and targeted marketing for underperforming properties to boost occupancy.`
    );
  }

  // Guest experience
  const lowRating = properties.filter(p => p.averageGuestRating > 0 && p.averageGuestRating < 4.5);
  if (lowRating.length > 0) {
    recommendations.push(
      `Conduct guest experience audits for ${lowRating.map(p => p.propertyName).join(', ')} to identify improvement areas.`
    );
  }

  // Portfolio balance
  if (portfolio.totalProperties > 5) {
    const excellentCount = properties.filter(p => p.performanceCategory === 'excellent').length;
    const poorCount = properties.filter(p => p.performanceCategory === 'poor').length;

    if (poorCount > excellentCount) {
      recommendations.push(
        `Consider divesting from consistently underperforming properties to strengthen overall portfolio performance.`
      );
    }
  }

  return recommendations;
}

// Full property comparison calculation
export function calculatePropertyComparison(
  properties: Property[],
  bookingsByProperty: Record<string, Booking[]>,
  expensesByProperty: Record<string, Expense[]>,
  cleaningRecordsByProperty: Record<string, CleaningRecord[]>,
  maintenanceRecordsByProperty: Record<string, MaintenanceRecord[]>,
  ratingsByProperty: Record<string, { rating: number; date: string }[]>,
  startDate: string,
  endDate: string,
  industryBenchmarks: { occupancy: number; adr: number } = { occupancy: 65, adr: 150 }
): ComparisonResult {
  const propertyMetrics: PropertyMetrics[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Calculate metrics for each property
  properties.forEach(property => {
    const bookings = bookingsByProperty[property.id] || [];
    const expenses = expensesByProperty[property.id] || [];
    const cleaningRecords = cleaningRecordsByProperty[property.id] || [];
    const maintenanceRecords = maintenanceRecordsByProperty[property.id] || [];
    const ratings = ratingsByProperty[property.id] || [];

    const occupancy = calculateOccupancy(bookings, start, end);
    const revenue = calculateRevenueMetrics(bookings, start, end);
    const expenseMetrics = calculateExpenseMetrics(
      expenses, cleaningRecords, maintenanceRecords, startDate, endDate
    );
    const ratingMetrics = calculateRatingMetrics(ratings, startDate, endDate);

    const noi = calculateNOI(revenue.gross, expenseMetrics.total);
    const profitMargin = calculateProfitMargin(revenue.gross, noi);
    const expenseRatio = calculateExpenseRatio(expenseMetrics.total, revenue.gross);

    const metrics: PropertyMetrics = {
      propertyId: property.id,
      propertyName: property.name,
      grossRevenue: revenue.gross,
      netRevenue: noi,
      averageDailyRate: revenue.avgDailyRate,
      revPAR: revenue.revPAR,
      occupancyRate: occupancy.rate,
      totalNights: occupancy.totalNights,
      bookedNights: occupancy.bookedNights,
      averageStayLength: occupancy.avgStayLength,
      averageGuestRating: ratingMetrics.average,
      totalReviews: ratingMetrics.total,
      fiveStarPercentage: ratingMetrics.fiveStarPct,
      totalExpenses: expenseMetrics.total,
      expenseRatio,
      cleaningCosts: expenseMetrics.cleaning,
      maintenanceCosts: expenseMetrics.maintenance,
      utilityCosts: expenseMetrics.utilities,
      netOperatingIncome: noi,
      profitMargin
    };

    metrics.performanceCategory = determinePerformanceCategory(metrics);
    propertyMetrics.push(metrics);
  });

  // Calculate rankings
  const byRevenue = rankByMetric(propertyMetrics, 'revenue');
  const byOccupancy = rankByMetric(propertyMetrics, 'occupancy');
  const byRating = rankByMetric(propertyMetrics, 'guestRating');
  const byNOI = rankByMetric(propertyMetrics, 'noi');

  propertyMetrics.forEach(p => {
    p.revenueRank = byRevenue.findIndex(m => m.propertyId === p.propertyId) + 1;
    p.occupancyRank = byOccupancy.findIndex(m => m.propertyId === p.propertyId) + 1;
    p.ratingRank = byRating.findIndex(m => m.propertyId === p.propertyId) + 1;
    p.noiRank = byNOI.findIndex(m => m.propertyId === p.propertyId) + 1;
    // Overall rank is average of all ranks
    p.overallRank = Math.round((p.revenueRank + p.occupancyRank + p.ratingRank + p.noiRank) / 4);
  });

  // Calculate portfolio metrics
  const totalRevenue = propertyMetrics.reduce((sum, p) => sum + p.grossRevenue, 0);
  const totalExpenses = propertyMetrics.reduce((sum, p) => sum + p.totalExpenses, 0);
  const totalNOI = propertyMetrics.reduce((sum, p) => sum + p.netOperatingIncome, 0);
  const avgOccupancy = propertyMetrics.reduce((sum, p) => sum + p.occupancyRate, 0) / propertyMetrics.length;
  const avgRating = propertyMetrics.filter(p => p.averageGuestRating > 0)
    .reduce((sum, p, _, arr) => sum + p.averageGuestRating / arr.length, 0);
  const avgExpenseRatio = propertyMetrics.reduce((sum, p) => sum + p.expenseRatio, 0) / propertyMetrics.length;

  const topPerformer = propertyMetrics.length > 0
    ? propertyMetrics.reduce((best, p) => p.netOperatingIncome > best.netOperatingIncome ? p : best)
    : null;

  const worstPerformer = propertyMetrics.length > 0
    ? propertyMetrics.reduce((worst, p) => p.netOperatingIncome < worst.netOperatingIncome ? p : worst)
    : null;

  const needsAttention = propertyMetrics
    .filter(p => p.performanceCategory === 'poor' || p.performanceCategory === 'below_average')
    .map(p => p.propertyName);

  const portfolio: PortfolioMetrics = {
    totalProperties: properties.length,
    totalRevenue,
    totalExpenses,
    totalNOI,
    averageOccupancy: avgOccupancy,
    averageRating: avgRating,
    averageExpenseRatio: avgExpenseRatio,
    portfolioProfitMargin: totalRevenue > 0 ? (totalNOI / totalRevenue) * 100 : 0,
    periodStart: startDate,
    periodEnd: endDate,
    industryAverageOccupancy: industryBenchmarks.occupancy,
    industryAverageADR: industryBenchmarks.adr,
    performanceVsBenchmark: avgOccupancy - industryBenchmarks.occupancy,
    topPerformer,
    worstPerformer,
    mostImproved: null, // Would need historical data
    needsAttention
  };

  const insights = generateInsights(propertyMetrics, portfolio);
  const recommendations = generateRecommendations(propertyMetrics, portfolio);

  return {
    properties: propertyMetrics,
    portfolio,
    insights,
    recommendations
  };
}

// Export data for charts (Recharts format)
export function formatForCharts(comparison: ComparisonResult): {
  revenueComparison: { name: string; revenue: number; expenses: number; noi: number }[];
  occupancyComparison: { name: string; occupancy: number; industryAvg: number }[];
  ratingComparison: { name: string; rating: number; reviews: number }[];
  expenseBreakdown: { name: string; cleaning: number; maintenance: number; utilities: number; other: number }[];
  performanceDistribution: { category: string; count: number }[];
} {
  const revenueComparison = comparison.properties.map(p => ({
    name: p.propertyName.length > 15 ? p.propertyName.substring(0, 15) + '...' : p.propertyName,
    revenue: p.grossRevenue,
    expenses: p.totalExpenses,
    noi: p.netOperatingIncome
  }));

  const occupancyComparison = comparison.properties.map(p => ({
    name: p.propertyName.length > 15 ? p.propertyName.substring(0, 15) + '...' : p.propertyName,
    occupancy: p.occupancyRate,
    industryAvg: comparison.portfolio.industryAverageOccupancy
  }));

  const ratingComparison = comparison.properties
    .filter(p => p.averageGuestRating > 0)
    .map(p => ({
      name: p.propertyName.length > 15 ? p.propertyName.substring(0, 15) + '...' : p.propertyName,
      rating: p.averageGuestRating,
      reviews: p.totalReviews
    }));

  const expenseBreakdown = comparison.properties.map(p => ({
    name: p.propertyName.length > 15 ? p.propertyName.substring(0, 15) + '...' : p.propertyName,
    cleaning: p.cleaningCosts,
    maintenance: p.maintenanceCosts,
    utilities: p.utilityCosts,
    other: p.totalExpenses - p.cleaningCosts - p.maintenanceCosts - p.utilityCosts
  }));

  const categoryCount = {
    excellent: 0,
    good: 0,
    average: 0,
    below_average: 0,
    poor: 0
  };
  comparison.properties.forEach(p => {
    if (p.performanceCategory) {
      categoryCount[p.performanceCategory]++;
    }
  });

  const performanceDistribution = [
    { category: 'Excellent', count: categoryCount.excellent },
    { category: 'Good', count: categoryCount.good },
    { category: 'Average', count: categoryCount.average },
    { category: 'Below Average', count: categoryCount.below_average },
    { category: 'Poor', count: categoryCount.poor }
  ].filter(c => c.count > 0);

  return {
    revenueComparison,
    occupancyComparison,
    ratingComparison,
    expenseBreakdown,
    performanceDistribution
  };
}
