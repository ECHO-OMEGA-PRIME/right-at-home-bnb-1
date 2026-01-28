/**
 * Right at Home BnB - Analytics Types
 * Type definitions for analytics dashboard
 */

export interface DateRange {
  start: Date;
  end: Date;
}

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type ComparisonPeriod = 'previous' | 'lastYear' | 'custom';

export interface PropertyData {
  id: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  baseRate: number;
}

export interface BookingData {
  id: string;
  propertyId: string;
  guestId: string;
  checkIn: Date;
  checkOut: Date;
  totalPrice: number;
  nightlyRate: number;
  cleaningFee: number;
  platform: 'AIRBNB' | 'VRBO' | 'DIRECT' | 'OTHER';
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  guestCount: number;
  createdAt: Date;
}

export interface ExpenseData {
  id: string;
  propertyId: string;
  category: string;
  subcategory?: string;
  amount: number;
  date: Date;
  vendor?: string;
  isTaxDeductible: boolean;
}

export interface RevenueMetrics {
  totalRevenue: number;
  accommodationRevenue: number;
  cleaningFeeRevenue: number;
  averageNightlyRate: number;
  revenuePerAvailableNight: number;
  bookingValue: number;
  growth: {
    amount: number;
    percentage: number;
    trend: 'up' | 'down' | 'flat';
  };
}

export interface OccupancyMetrics {
  occupancyRate: number;
  totalNights: number;
  bookedNights: number;
  availableNights: number;
  averageLengthOfStay: number;
  bookingLeadTime: number;
  growth: {
    percentage: number;
    trend: 'up' | 'down' | 'flat';
  };
}

export interface BookingMetrics {
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  averageGuestCount: number;
  repeatGuestRate: number;
  platformDistribution: Record<string, number>;
  bookingsByDayOfWeek: number[];
}

export interface ExpenseMetrics {
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  averageExpensePerBooking: number;
  taxDeductibleAmount: number;
  topVendors: Array<{ vendor: string; amount: number }>;
}

export interface ProfitabilityMetrics {
  grossRevenue: number;
  totalExpenses: number;
  netIncome: number;
  profitMargin: number;
  revenuePerProperty: number;
  expenseRatio: number;
  roi: number;
}

export interface PropertyPerformance {
  propertyId: string;
  propertyName: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  occupancyRate: number;
  averageNightlyRate: number;
  totalBookings: number;
  averageRating?: number;
  ranking: number;
}

export interface PerformanceSnapshot {
  period: DateRange;
  revenue: RevenueMetrics;
  occupancy: OccupancyMetrics;
  bookings: BookingMetrics;
  expenses: ExpenseMetrics;
  profitability: ProfitabilityMetrics;
}

export interface KPI {
  name: string;
  value: number;
  unit: 'currency' | 'percentage' | 'number' | 'days';
  trend: 'up' | 'down' | 'flat';
  changeAmount: number;
  changePercentage: number;
  target?: number;
  targetAchievement?: number;
}

export interface DashboardData {
  kpis: KPI[];
  revenueByProperty: PropertyPerformance[];
  revenueOverTime: TimeSeriesData[];
  occupancyOverTime: TimeSeriesData[];
  bookingsByPlatform: ChartData[];
  expensesByCategory: ChartData[];
  topProperties: PropertyPerformance[];
  bottomProperties: PropertyPerformance[];
}

export interface TimeSeriesData {
  date: Date;
  value: number;
  label?: string;
}

export interface ChartData {
  label: string;
  value: number;
  percentage?: number;
  color?: string;
}

export interface ReportConfig {
  title: string;
  period: DateRange;
  compareWith?: DateRange;
  properties?: string[];
  includeCharts: boolean;
  includeDetails: boolean;
  format: 'pdf' | 'excel' | 'csv' | 'json';
}

export interface Report {
  id: string;
  title: string;
  generatedAt: Date;
  period: DateRange;
  summary: PerformanceSnapshot;
  propertyBreakdown: PropertyPerformance[];
  trends: {
    revenue: TimeSeriesData[];
    occupancy: TimeSeriesData[];
    bookings: TimeSeriesData[];
  };
  comparisons?: {
    previousPeriod: PerformanceSnapshot;
    changes: Record<string, { value: number; percentage: number }>;
  };
}

export interface Forecast {
  period: DateRange;
  projectedRevenue: number;
  projectedOccupancy: number;
  projectedBookings: number;
  confidence: number;
  scenarios: {
    optimistic: { revenue: number; occupancy: number };
    moderate: { revenue: number; occupancy: number };
    conservative: { revenue: number; occupancy: number };
  };
}

export interface AnalyticsConfig {
  defaultPeriod: Period;
  fiscalYearStart: number;
  currency: string;
  timezone: string;
}

export interface BenchmarkData {
  metric: string;
  yourValue: number;
  marketAverage: number;
  marketTop25: number;
  percentile: number;
}
