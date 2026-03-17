/**
 * Right at Home BnB - Cost Tracker
 * Tracks per-property and portfolio-wide costs.
 * Categorizes expenses, calculates cost-per-night,
 * and generates profitability reports.
 */

import prisma from '../../src/lib/prisma';
import { toCents, formatMoney, addCents, subtractCents } from '../utils/money';
import { startOfDay, addDays } from '../utils/dates';

// ============================================
// TYPES
// ============================================

export type CostCategory =
  | 'cleaning'
  | 'maintenance'
  | 'utilities'
  | 'insurance'
  | 'property_tax'
  | 'supplies'
  | 'marketing'
  | 'software'
  | 'professional_services'
  | 'mortgage'
  | 'hoa'
  | 'furnishing'
  | 'laundry'
  | 'landscaping'
  | 'pest_control'
  | 'other';

export interface CostSummary {
  propertyId: string | null;
  propertyName: string | null;
  periodStart: string;
  periodEnd: string;
  totalCostCents: number;
  byCategory: Record<CostCategory, number>;
  transactionCount: number;
}

export interface PropertyProfitability {
  propertyId: string;
  propertyName: string;
  periodStart: string;
  periodEnd: string;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginPercent: number;
  occupancyPercent: number;
  costPerNightCents: number;
  revenuePerNightCents: number;
  totalNightsAvailable: number;
  totalNightsOccupied: number;
  avgDailyRateCents: number;
  revParCents: number; // Revenue per available night
}

export interface PortfolioSummary {
  periodStart: string;
  periodEnd: string;
  totalRevenueCents: number;
  totalCostCents: number;
  totalProfitCents: number;
  avgMarginPercent: number;
  avgOccupancyPercent: number;
  propertyCount: number;
  topPerformers: Array<{ propertyId: string; name: string; profitCents: number }>;
  bottomPerformers: Array<{ propertyId: string; name: string; profitCents: number }>;
  costBreakdown: Record<CostCategory, number>;
}

export interface CostTrend {
  period: string;
  totalCostCents: number;
  byCategory: Partial<Record<CostCategory, number>>;
}

// ============================================
// CATEGORY MAPPING
// ============================================

/**
 * Map Expense.category values from the database to our CostCategory enum.
 * The Expense model has free-form category strings; this normalizes them.
 */
const CATEGORY_MAP: Record<string, CostCategory> = {
  'CLEANING': 'cleaning',
  'CLEANING_SUPPLIES': 'cleaning',
  'MAINTENANCE': 'maintenance',
  'REPAIR': 'maintenance',
  'REPAIRS': 'maintenance',
  'UTILITIES': 'utilities',
  'ELECTRIC': 'utilities',
  'GAS': 'utilities',
  'WATER': 'utilities',
  'INTERNET': 'utilities',
  'TRASH': 'utilities',
  'INSURANCE': 'insurance',
  'PROPERTY_TAX': 'property_tax',
  'TAXES': 'property_tax',
  'SUPPLIES': 'supplies',
  'GUEST_SUPPLIES': 'supplies',
  'MARKETING': 'marketing',
  'ADVERTISING': 'marketing',
  'SOFTWARE': 'software',
  'TECHNOLOGY': 'software',
  'SUBSCRIPTIONS': 'software',
  'PROFESSIONAL': 'professional_services',
  'ACCOUNTING': 'professional_services',
  'LEGAL': 'professional_services',
  'MORTGAGE': 'mortgage',
  'HOA': 'hoa',
  'FURNISHING': 'furnishing',
  'FURNITURE': 'furnishing',
  'LAUNDRY': 'laundry',
  'LINEN': 'laundry',
  'LANDSCAPING': 'landscaping',
  'YARD': 'landscaping',
  'PEST_CONTROL': 'pest_control',
  'PEST': 'pest_control',
};

function normalizeCategory(raw: string): CostCategory {
  const upper = raw.toUpperCase().trim();
  return CATEGORY_MAP[upper] || 'other';
}

// ============================================
// COST QUERIES
// ============================================

/**
 * Get a cost summary for a specific property over a date range.
 */
export async function getPropertyCosts(
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<CostSummary> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { name: true },
  });

  const expenses = await prisma.expense.findMany({
    where: {
      propertyId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      status: { not: 'CANCELLED' },
    },
  });

  const byCategory: Record<CostCategory, number> = createEmptyCategories();
  let totalCostCents = 0;

  for (const expense of expenses) {
    const amountCents = toCents(expense.amount);
    const category = normalizeCategory(expense.category);
    byCategory[category] = addCents(byCategory[category], amountCents);
    totalCostCents = addCents(totalCostCents, amountCents);
  }

  return {
    propertyId,
    propertyName: property?.name || null,
    periodStart: startDate.toISOString().split('T')[0],
    periodEnd: endDate.toISOString().split('T')[0],
    totalCostCents,
    byCategory,
    transactionCount: expenses.length,
  };
}

/**
 * Get a cost summary across ALL properties for a date range.
 */
export async function getPortfolioCosts(
  startDate: Date,
  endDate: Date
): Promise<CostSummary> {
  const expenses = await prisma.expense.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
      status: { not: 'CANCELLED' },
    },
  });

  const byCategory: Record<CostCategory, number> = createEmptyCategories();
  let totalCostCents = 0;

  for (const expense of expenses) {
    const amountCents = toCents(expense.amount);
    const category = normalizeCategory(expense.category);
    byCategory[category] = addCents(byCategory[category], amountCents);
    totalCostCents = addCents(totalCostCents, amountCents);
  }

  return {
    propertyId: null,
    propertyName: null,
    periodStart: startDate.toISOString().split('T')[0],
    periodEnd: endDate.toISOString().split('T')[0],
    totalCostCents,
    byCategory,
    transactionCount: expenses.length,
  };
}

// ============================================
// PROFITABILITY
// ============================================

/**
 * Calculate profitability for a single property over a date range.
 * Combines revenue from bookings with costs from expenses.
 */
export async function getPropertyProfitability(
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<PropertyProfitability> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { name: true },
  });

  if (!property) {
    throw new Error(`Property not found: ${propertyId}`);
  }

  // Revenue from bookings in the period
  const bookings = await prisma.booking.findMany({
    where: {
      propertyId,
      status: { notIn: ['CANCELLED', 'DECLINED'] },
      checkIn: { lt: endDate },
      checkOut: { gt: startDate },
    },
    select: {
      checkIn: true,
      checkOut: true,
      totalPrice: true,
      totalNights: true,
    },
  });

  let revenueCents = 0;
  let totalNightsOccupied = 0;

  for (const booking of bookings) {
    revenueCents = addCents(revenueCents, toCents(booking.totalPrice));

    // Count only nights that fall within the reporting period
    const overlapStart = booking.checkIn > startDate ? booking.checkIn : startDate;
    const overlapEnd = booking.checkOut < endDate ? booking.checkOut : endDate;
    const nights = Math.max(0, Math.ceil(
      (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)
    ));
    totalNightsOccupied += nights;
  }

  // Costs from expenses
  const costs = await getPropertyCosts(propertyId, startDate, endDate);
  const costCents = costs.totalCostCents;

  // Total nights in the period
  const totalNightsAvailable = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const profitCents = subtractCents(revenueCents, costCents);
  const marginPercent = revenueCents > 0
    ? Math.round((profitCents / revenueCents) * 10000) / 100
    : 0;
  const occupancyPercent = totalNightsAvailable > 0
    ? Math.round((totalNightsOccupied / totalNightsAvailable) * 10000) / 100
    : 0;

  const costPerNightCents = totalNightsAvailable > 0
    ? Math.round(costCents / totalNightsAvailable)
    : 0;
  const revenuePerNightCents = totalNightsOccupied > 0
    ? Math.round(revenueCents / totalNightsOccupied)
    : 0;
  const avgDailyRateCents = revenuePerNightCents;
  const revParCents = totalNightsAvailable > 0
    ? Math.round(revenueCents / totalNightsAvailable)
    : 0;

  return {
    propertyId,
    propertyName: property.name,
    periodStart: startDate.toISOString().split('T')[0],
    periodEnd: endDate.toISOString().split('T')[0],
    revenueCents,
    costCents,
    profitCents,
    marginPercent,
    occupancyPercent,
    costPerNightCents,
    revenuePerNightCents,
    totalNightsAvailable,
    totalNightsOccupied,
    avgDailyRateCents,
    revParCents,
  };
}

/**
 * Get a portfolio-wide profitability summary across all properties.
 */
export async function getPortfolioProfitability(
  startDate: Date,
  endDate: Date
): Promise<PortfolioSummary> {
  const properties = await prisma.property.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  });

  const profitabilities: PropertyProfitability[] = [];

  for (const property of properties) {
    const prof = await getPropertyProfitability(property.id, startDate, endDate);
    profitabilities.push(prof);
  }

  const totalRevenueCents = profitabilities.reduce((sum, p) => addCents(sum, p.revenueCents), 0);
  const totalCostCents = profitabilities.reduce((sum, p) => addCents(sum, p.costCents), 0);
  const totalProfitCents = subtractCents(totalRevenueCents, totalCostCents);

  const avgMarginPercent = totalRevenueCents > 0
    ? Math.round((totalProfitCents / totalRevenueCents) * 10000) / 100
    : 0;

  const totalOccupied = profitabilities.reduce((sum, p) => sum + p.totalNightsOccupied, 0);
  const totalAvailable = profitabilities.reduce((sum, p) => sum + p.totalNightsAvailable, 0);
  const avgOccupancyPercent = totalAvailable > 0
    ? Math.round((totalOccupied / totalAvailable) * 10000) / 100
    : 0;

  // Sort by profit for top/bottom performers
  const sorted = [...profitabilities].sort((a, b) => b.profitCents - a.profitCents);
  const topPerformers = sorted.slice(0, 5).map((p) => ({
    propertyId: p.propertyId,
    name: p.propertyName,
    profitCents: p.profitCents,
  }));
  const bottomPerformers = sorted.slice(-5).reverse().map((p) => ({
    propertyId: p.propertyId,
    name: p.propertyName,
    profitCents: p.profitCents,
  }));

  // Aggregate cost breakdown
  const costBreakdown = await getPortfolioCosts(startDate, endDate);

  return {
    periodStart: startDate.toISOString().split('T')[0],
    periodEnd: endDate.toISOString().split('T')[0],
    totalRevenueCents,
    totalCostCents,
    totalProfitCents,
    avgMarginPercent,
    avgOccupancyPercent,
    propertyCount: properties.length,
    topPerformers,
    bottomPerformers,
    costBreakdown: costBreakdown.byCategory,
  };
}

// ============================================
// TRENDS
// ============================================

/**
 * Get monthly cost trends for a property over the last N months.
 */
export async function getCostTrends(
  propertyId: string | null,
  months: number = 12
): Promise<CostTrend[]> {
  const trends: CostTrend[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const year = now.getFullYear();
    const month = now.getMonth() - i;
    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const periodLabel = periodStart.toISOString().slice(0, 7); // "YYYY-MM"

    const summary = propertyId
      ? await getPropertyCosts(propertyId, periodStart, periodEnd)
      : await getPortfolioCosts(periodStart, periodEnd);

    // Only include non-zero categories in the trend
    const nonZeroCategories: Partial<Record<CostCategory, number>> = {};
    for (const [cat, amount] of Object.entries(summary.byCategory)) {
      if (amount > 0) {
        nonZeroCategories[cat as CostCategory] = amount;
      }
    }

    trends.push({
      period: periodLabel,
      totalCostCents: summary.totalCostCents,
      byCategory: nonZeroCategories,
    });
  }

  return trends;
}

/**
 * Calculate cost-per-night for a property over a date range.
 * Useful for pricing decisions and profitability analysis.
 */
export async function getCostPerNight(
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalCostCents: number;
  nightsInPeriod: number;
  costPerNightCents: number;
  breakdown: Record<CostCategory, number>;
}> {
  const costs = await getPropertyCosts(propertyId, startDate, endDate);
  const nightsInPeriod = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const costPerNightCents = nightsInPeriod > 0
    ? Math.round(costs.totalCostCents / nightsInPeriod)
    : 0;

  // Per-category cost per night
  const breakdown: Record<CostCategory, number> = createEmptyCategories();
  for (const [cat, amount] of Object.entries(costs.byCategory)) {
    breakdown[cat as CostCategory] = nightsInPeriod > 0
      ? Math.round(amount / nightsInPeriod)
      : 0;
  }

  return {
    totalCostCents: costs.totalCostCents,
    nightsInPeriod,
    costPerNightCents,
    breakdown,
  };
}

/**
 * Get the top expense categories for a property, sorted by total spend.
 */
export async function getTopExpenseCategories(
  propertyId: string | null,
  startDate: Date,
  endDate: Date,
  limit: number = 5
): Promise<Array<{ category: CostCategory; totalCents: number; percent: number }>> {
  const summary = propertyId
    ? await getPropertyCosts(propertyId, startDate, endDate)
    : await getPortfolioCosts(startDate, endDate);

  const entries = Object.entries(summary.byCategory)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);

  return entries.map(([category, totalCents]) => ({
    category: category as CostCategory,
    totalCents,
    percent: summary.totalCostCents > 0
      ? Math.round((totalCents / summary.totalCostCents) * 10000) / 100
      : 0,
  }));
}

// ============================================
// HELPERS
// ============================================

function createEmptyCategories(): Record<CostCategory, number> {
  return {
    cleaning: 0,
    maintenance: 0,
    utilities: 0,
    insurance: 0,
    property_tax: 0,
    supplies: 0,
    marketing: 0,
    software: 0,
    professional_services: 0,
    mortgage: 0,
    hoa: 0,
    furnishing: 0,
    laundry: 0,
    landscaping: 0,
    pest_control: 0,
    other: 0,
  };
}
