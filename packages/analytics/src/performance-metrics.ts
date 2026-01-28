/**
 * Right at Home BnB - Performance Metrics
 * Calculate and track key performance indicators
 */

import type {
  DateRange,
  Period,
  BookingData,
  PropertyData,
  ExpenseData,
  RevenueMetrics,
  OccupancyMetrics,
  BookingMetrics,
  ExpenseMetrics,
  ProfitabilityMetrics,
  PropertyPerformance,
  PerformanceSnapshot,
  KPI,
  BenchmarkData,
} from './types';
import { RevenueTracker } from './revenue-tracker';
import { OccupancyCalculator } from './occupancy-calculator';

/**
 * Performance Metrics Calculator
 */
export class PerformanceMetrics {
  private bookings: BookingData[];
  private properties: Map<string, PropertyData>;
  private expenses: ExpenseData[];
  private revenueTracker: RevenueTracker;
  private occupancyCalculator: OccupancyCalculator;

  constructor(
    bookings: BookingData[] = [],
    properties: PropertyData[] = [],
    expenses: ExpenseData[] = []
  ) {
    this.bookings = bookings;
    this.properties = new Map(properties.map((p) => [p.id, p]));
    this.expenses = expenses;
    this.revenueTracker = new RevenueTracker(bookings, properties);
    this.occupancyCalculator = new OccupancyCalculator(bookings, properties);
  }

  /**
   * Load data
   */
  loadData(bookings: BookingData[], properties: PropertyData[], expenses: ExpenseData[]): void {
    this.bookings = bookings;
    this.properties = new Map(properties.map((p) => [p.id, p]));
    this.expenses = expenses;
    this.revenueTracker.loadBookings(bookings);
    this.revenueTracker.loadProperties(properties);
    this.occupancyCalculator.loadBookings(bookings);
    this.occupancyCalculator.loadProperties(properties);
  }

  /**
   * Calculate booking metrics
   */
  calculateBookingMetrics(dateRange: DateRange, propertyId?: string): BookingMetrics {
    const filteredBookings = this.filterBookings(dateRange, propertyId);

    const totalBookings = filteredBookings.length;
    const confirmedBookings = filteredBookings.filter(
      (b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED'
    ).length;
    const cancelledBookings = filteredBookings.filter((b) => b.status === 'CANCELLED').length;
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;

    // Calculate average guest count
    const nonCancelledBookings = filteredBookings.filter((b) => b.status !== 'CANCELLED');
    const totalGuests = nonCancelledBookings.reduce((sum, b) => sum + b.guestCount, 0);
    const averageGuestCount = nonCancelledBookings.length > 0
      ? totalGuests / nonCancelledBookings.length
      : 0;

    // Calculate repeat guest rate
    const guestIds = nonCancelledBookings.map((b) => b.guestId);
    const uniqueGuests = new Set(guestIds);
    const repeatGuests = guestIds.length - uniqueGuests.size;
    const repeatGuestRate = guestIds.length > 0 ? (repeatGuests / guestIds.length) * 100 : 0;

    // Platform distribution
    const platformDistribution: Record<string, number> = {};
    for (const booking of nonCancelledBookings) {
      const platform = booking.platform || 'OTHER';
      platformDistribution[platform] = (platformDistribution[platform] || 0) + 1;
    }

    // Bookings by day of week
    const bookingsByDayOfWeek = new Array(7).fill(0);
    for (const booking of nonCancelledBookings) {
      const dayOfWeek = new Date(booking.checkIn).getDay();
      bookingsByDayOfWeek[dayOfWeek]++;
    }

    return {
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      cancellationRate: Math.round(cancellationRate * 100) / 100,
      averageGuestCount: Math.round(averageGuestCount * 100) / 100,
      repeatGuestRate: Math.round(repeatGuestRate * 100) / 100,
      platformDistribution,
      bookingsByDayOfWeek,
    };
  }

  /**
   * Calculate expense metrics
   */
  calculateExpenseMetrics(dateRange: DateRange, propertyId?: string): ExpenseMetrics {
    const filteredExpenses = this.filterExpenses(dateRange, propertyId);

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Expenses by category
    const expensesByCategory: Record<string, number> = {};
    for (const expense of filteredExpenses) {
      expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount;
    }

    // Average expense per booking
    const filteredBookings = this.filterBookings(dateRange, propertyId);
    const completedBookings = filteredBookings.filter((b) => b.status !== 'CANCELLED').length;
    const averageExpensePerBooking = completedBookings > 0 ? totalExpenses / completedBookings : 0;

    // Tax deductible amount
    const taxDeductibleAmount = filteredExpenses
      .filter((e) => e.isTaxDeductible)
      .reduce((sum, e) => sum + e.amount, 0);

    // Top vendors
    const vendorTotals = new Map<string, number>();
    for (const expense of filteredExpenses) {
      if (expense.vendor) {
        vendorTotals.set(
          expense.vendor,
          (vendorTotals.get(expense.vendor) || 0) + expense.amount
        );
      }
    }

    const topVendors = Array.from(vendorTotals.entries())
      .map(([vendor, amount]) => ({ vendor, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return {
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      expensesByCategory: Object.fromEntries(
        Object.entries(expensesByCategory).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
      averageExpensePerBooking: Math.round(averageExpensePerBooking * 100) / 100,
      taxDeductibleAmount: Math.round(taxDeductibleAmount * 100) / 100,
      topVendors,
    };
  }

  /**
   * Calculate profitability metrics
   */
  calculateProfitabilityMetrics(dateRange: DateRange, propertyId?: string): ProfitabilityMetrics {
    const revenueMetrics = this.revenueTracker.calculateRevenueMetrics(dateRange, propertyId);
    const expenseMetrics = this.calculateExpenseMetrics(dateRange, propertyId);

    const grossRevenue = revenueMetrics.totalRevenue;
    const totalExpenses = expenseMetrics.totalExpenses;
    const netIncome = grossRevenue - totalExpenses;
    const profitMargin = grossRevenue > 0 ? (netIncome / grossRevenue) * 100 : 0;

    const propertyCount = propertyId ? 1 : this.properties.size;
    const revenuePerProperty = propertyCount > 0 ? grossRevenue / propertyCount : 0;
    const expenseRatio = grossRevenue > 0 ? (totalExpenses / grossRevenue) * 100 : 0;

    // Calculate ROI based on property base rates (simplified)
    const totalPropertyValue = propertyId
      ? this.properties.get(propertyId)?.baseRate || 0
      : Array.from(this.properties.values()).reduce((sum, p) => sum + p.baseRate * 365, 0);

    const roi = totalPropertyValue > 0 ? (netIncome / totalPropertyValue) * 100 : 0;

    return {
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netIncome: Math.round(netIncome * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      revenuePerProperty: Math.round(revenuePerProperty * 100) / 100,
      expenseRatio: Math.round(expenseRatio * 100) / 100,
      roi: Math.round(roi * 100) / 100,
    };
  }

  /**
   * Get complete performance snapshot
   */
  getPerformanceSnapshot(dateRange: DateRange, comparePeriod?: DateRange): PerformanceSnapshot {
    return {
      period: dateRange,
      revenue: this.revenueTracker.calculateRevenueMetrics(dateRange, undefined, comparePeriod),
      occupancy: this.occupancyCalculator.calculateOccupancyMetrics(dateRange, undefined, comparePeriod),
      bookings: this.calculateBookingMetrics(dateRange),
      expenses: this.calculateExpenseMetrics(dateRange),
      profitability: this.calculateProfitabilityMetrics(dateRange),
    };
  }

  /**
   * Get key performance indicators
   */
  getKPIs(dateRange: DateRange, comparePeriod?: DateRange): KPI[] {
    const currentSnapshot = this.getPerformanceSnapshot(dateRange);
    const previousSnapshot = comparePeriod ? this.getPerformanceSnapshot(comparePeriod) : null;

    const kpis: KPI[] = [];

    // Revenue KPI
    const revenueChange = previousSnapshot
      ? currentSnapshot.revenue.totalRevenue - previousSnapshot.revenue.totalRevenue
      : 0;
    const revenueChangePercent = previousSnapshot && previousSnapshot.revenue.totalRevenue > 0
      ? (revenueChange / previousSnapshot.revenue.totalRevenue) * 100
      : 0;

    kpis.push({
      name: 'Total Revenue',
      value: currentSnapshot.revenue.totalRevenue,
      unit: 'currency',
      trend: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'flat',
      changeAmount: Math.round(revenueChange * 100) / 100,
      changePercentage: Math.round(revenueChangePercent * 100) / 100,
    });

    // Occupancy Rate KPI
    const occupancyChange = previousSnapshot
      ? currentSnapshot.occupancy.occupancyRate - previousSnapshot.occupancy.occupancyRate
      : 0;

    kpis.push({
      name: 'Occupancy Rate',
      value: currentSnapshot.occupancy.occupancyRate,
      unit: 'percentage',
      trend: occupancyChange > 0 ? 'up' : occupancyChange < 0 ? 'down' : 'flat',
      changeAmount: Math.round(occupancyChange * 100) / 100,
      changePercentage: Math.round(occupancyChange * 100) / 100,
    });

    // Average Nightly Rate KPI
    const anrChange = previousSnapshot
      ? currentSnapshot.revenue.averageNightlyRate - previousSnapshot.revenue.averageNightlyRate
      : 0;
    const anrChangePercent = previousSnapshot && previousSnapshot.revenue.averageNightlyRate > 0
      ? (anrChange / previousSnapshot.revenue.averageNightlyRate) * 100
      : 0;

    kpis.push({
      name: 'Average Nightly Rate',
      value: currentSnapshot.revenue.averageNightlyRate,
      unit: 'currency',
      trend: anrChange > 0 ? 'up' : anrChange < 0 ? 'down' : 'flat',
      changeAmount: Math.round(anrChange * 100) / 100,
      changePercentage: Math.round(anrChangePercent * 100) / 100,
    });

    // RevPAN (Revenue Per Available Night) KPI
    const revpanChange = previousSnapshot
      ? currentSnapshot.revenue.revenuePerAvailableNight - previousSnapshot.revenue.revenuePerAvailableNight
      : 0;
    const revpanChangePercent = previousSnapshot && previousSnapshot.revenue.revenuePerAvailableNight > 0
      ? (revpanChange / previousSnapshot.revenue.revenuePerAvailableNight) * 100
      : 0;

    kpis.push({
      name: 'RevPAN',
      value: currentSnapshot.revenue.revenuePerAvailableNight,
      unit: 'currency',
      trend: revpanChange > 0 ? 'up' : revpanChange < 0 ? 'down' : 'flat',
      changeAmount: Math.round(revpanChange * 100) / 100,
      changePercentage: Math.round(revpanChangePercent * 100) / 100,
    });

    // Net Income KPI
    const netIncomeChange = previousSnapshot
      ? currentSnapshot.profitability.netIncome - previousSnapshot.profitability.netIncome
      : 0;
    const netIncomeChangePercent = previousSnapshot && previousSnapshot.profitability.netIncome > 0
      ? (netIncomeChange / previousSnapshot.profitability.netIncome) * 100
      : 0;

    kpis.push({
      name: 'Net Income',
      value: currentSnapshot.profitability.netIncome,
      unit: 'currency',
      trend: netIncomeChange > 0 ? 'up' : netIncomeChange < 0 ? 'down' : 'flat',
      changeAmount: Math.round(netIncomeChange * 100) / 100,
      changePercentage: Math.round(netIncomeChangePercent * 100) / 100,
    });

    // Profit Margin KPI
    const marginChange = previousSnapshot
      ? currentSnapshot.profitability.profitMargin - previousSnapshot.profitability.profitMargin
      : 0;

    kpis.push({
      name: 'Profit Margin',
      value: currentSnapshot.profitability.profitMargin,
      unit: 'percentage',
      trend: marginChange > 0 ? 'up' : marginChange < 0 ? 'down' : 'flat',
      changeAmount: Math.round(marginChange * 100) / 100,
      changePercentage: Math.round(marginChange * 100) / 100,
    });

    // Booking Count KPI
    const bookingChange = previousSnapshot
      ? currentSnapshot.bookings.totalBookings - previousSnapshot.bookings.totalBookings
      : 0;
    const bookingChangePercent = previousSnapshot && previousSnapshot.bookings.totalBookings > 0
      ? (bookingChange / previousSnapshot.bookings.totalBookings) * 100
      : 0;

    kpis.push({
      name: 'Total Bookings',
      value: currentSnapshot.bookings.totalBookings,
      unit: 'number',
      trend: bookingChange > 0 ? 'up' : bookingChange < 0 ? 'down' : 'flat',
      changeAmount: bookingChange,
      changePercentage: Math.round(bookingChangePercent * 100) / 100,
    });

    // Average Length of Stay KPI
    const alosChange = previousSnapshot
      ? currentSnapshot.occupancy.averageLengthOfStay - previousSnapshot.occupancy.averageLengthOfStay
      : 0;
    const alosChangePercent = previousSnapshot && previousSnapshot.occupancy.averageLengthOfStay > 0
      ? (alosChange / previousSnapshot.occupancy.averageLengthOfStay) * 100
      : 0;

    kpis.push({
      name: 'Average Length of Stay',
      value: currentSnapshot.occupancy.averageLengthOfStay,
      unit: 'days',
      trend: alosChange > 0 ? 'up' : alosChange < 0 ? 'down' : 'flat',
      changeAmount: Math.round(alosChange * 100) / 100,
      changePercentage: Math.round(alosChangePercent * 100) / 100,
    });

    // Cancellation Rate KPI (lower is better)
    const cancelChange = previousSnapshot
      ? currentSnapshot.bookings.cancellationRate - previousSnapshot.bookings.cancellationRate
      : 0;

    kpis.push({
      name: 'Cancellation Rate',
      value: currentSnapshot.bookings.cancellationRate,
      unit: 'percentage',
      trend: cancelChange < 0 ? 'up' : cancelChange > 0 ? 'down' : 'flat', // Inverted - lower is better
      changeAmount: Math.round(cancelChange * 100) / 100,
      changePercentage: Math.round(cancelChange * 100) / 100,
    });

    // Repeat Guest Rate KPI
    const repeatChange = previousSnapshot
      ? currentSnapshot.bookings.repeatGuestRate - previousSnapshot.bookings.repeatGuestRate
      : 0;

    kpis.push({
      name: 'Repeat Guest Rate',
      value: currentSnapshot.bookings.repeatGuestRate,
      unit: 'percentage',
      trend: repeatChange > 0 ? 'up' : repeatChange < 0 ? 'down' : 'flat',
      changeAmount: Math.round(repeatChange * 100) / 100,
      changePercentage: Math.round(repeatChange * 100) / 100,
    });

    return kpis;
  }

  /**
   * Get property performance rankings
   */
  getPropertyPerformance(dateRange: DateRange): PropertyPerformance[] {
    const performances: PropertyPerformance[] = [];
    const totalDays = this.calculateDays(dateRange);

    for (const [propertyId, property] of this.properties) {
      const revenueMetrics = this.revenueTracker.calculateRevenueMetrics(dateRange, propertyId);
      const occupancyMetrics = this.occupancyCalculator.calculateOccupancyMetrics(dateRange, propertyId);
      const expenseMetrics = this.calculateExpenseMetrics(dateRange, propertyId);
      const bookingMetrics = this.calculateBookingMetrics(dateRange, propertyId);

      performances.push({
        propertyId,
        propertyName: property.name,
        revenue: revenueMetrics.totalRevenue,
        expenses: expenseMetrics.totalExpenses,
        netIncome: revenueMetrics.totalRevenue - expenseMetrics.totalExpenses,
        occupancyRate: occupancyMetrics.occupancyRate,
        averageNightlyRate: revenueMetrics.averageNightlyRate,
        totalBookings: bookingMetrics.confirmedBookings,
        ranking: 0,
      });
    }

    // Sort by net income and assign rankings
    performances.sort((a, b) => b.netIncome - a.netIncome);
    performances.forEach((p, index) => {
      p.ranking = index + 1;
    });

    return performances;
  }

  /**
   * Get benchmark comparisons
   */
  getBenchmarks(dateRange: DateRange): BenchmarkData[] {
    const snapshot = this.getPerformanceSnapshot(dateRange);

    // Midland, TX vacation rental market averages (realistic estimates)
    const marketAverages = {
      occupancyRate: 65,
      averageNightlyRate: 175,
      revPAN: 113.75,
      profitMargin: 35,
      cancellationRate: 8,
      averageLengthOfStay: 3.5,
    };

    const marketTop25 = {
      occupancyRate: 80,
      averageNightlyRate: 225,
      revPAN: 180,
      profitMargin: 50,
      cancellationRate: 3,
      averageLengthOfStay: 5,
    };

    const benchmarks: BenchmarkData[] = [];

    // Occupancy Rate
    benchmarks.push({
      metric: 'Occupancy Rate',
      yourValue: snapshot.occupancy.occupancyRate,
      marketAverage: marketAverages.occupancyRate,
      marketTop25: marketTop25.occupancyRate,
      percentile: this.calculatePercentile(
        snapshot.occupancy.occupancyRate,
        marketAverages.occupancyRate,
        marketTop25.occupancyRate
      ),
    });

    // Average Nightly Rate
    benchmarks.push({
      metric: 'Average Nightly Rate',
      yourValue: snapshot.revenue.averageNightlyRate,
      marketAverage: marketAverages.averageNightlyRate,
      marketTop25: marketTop25.averageNightlyRate,
      percentile: this.calculatePercentile(
        snapshot.revenue.averageNightlyRate,
        marketAverages.averageNightlyRate,
        marketTop25.averageNightlyRate
      ),
    });

    // RevPAN
    benchmarks.push({
      metric: 'RevPAN',
      yourValue: snapshot.revenue.revenuePerAvailableNight,
      marketAverage: marketAverages.revPAN,
      marketTop25: marketTop25.revPAN,
      percentile: this.calculatePercentile(
        snapshot.revenue.revenuePerAvailableNight,
        marketAverages.revPAN,
        marketTop25.revPAN
      ),
    });

    // Profit Margin
    benchmarks.push({
      metric: 'Profit Margin',
      yourValue: snapshot.profitability.profitMargin,
      marketAverage: marketAverages.profitMargin,
      marketTop25: marketTop25.profitMargin,
      percentile: this.calculatePercentile(
        snapshot.profitability.profitMargin,
        marketAverages.profitMargin,
        marketTop25.profitMargin
      ),
    });

    // Cancellation Rate (lower is better)
    benchmarks.push({
      metric: 'Cancellation Rate',
      yourValue: snapshot.bookings.cancellationRate,
      marketAverage: marketAverages.cancellationRate,
      marketTop25: marketTop25.cancellationRate,
      percentile: this.calculatePercentileInverse(
        snapshot.bookings.cancellationRate,
        marketAverages.cancellationRate,
        marketTop25.cancellationRate
      ),
    });

    // Average Length of Stay
    benchmarks.push({
      metric: 'Average Length of Stay',
      yourValue: snapshot.occupancy.averageLengthOfStay,
      marketAverage: marketAverages.averageLengthOfStay,
      marketTop25: marketTop25.averageLengthOfStay,
      percentile: this.calculatePercentile(
        snapshot.occupancy.averageLengthOfStay,
        marketAverages.averageLengthOfStay,
        marketTop25.averageLengthOfStay
      ),
    });

    return benchmarks;
  }

  /**
   * Get top and bottom performing properties
   */
  getPropertyRankings(dateRange: DateRange, limit: number = 5): {
    top: PropertyPerformance[];
    bottom: PropertyPerformance[];
  } {
    const all = this.getPropertyPerformance(dateRange);

    return {
      top: all.slice(0, limit),
      bottom: all.slice(-limit).reverse(),
    };
  }

  /**
   * Calculate percentile (higher is better)
   */
  private calculatePercentile(value: number, average: number, top25: number): number {
    if (value >= top25) return 90 + ((value - top25) / top25) * 10;
    if (value >= average) return 50 + ((value - average) / (top25 - average)) * 40;
    return Math.max(0, (value / average) * 50);
  }

  /**
   * Calculate percentile (lower is better)
   */
  private calculatePercentileInverse(value: number, average: number, top25: number): number {
    if (value <= top25) return 90 + ((top25 - value) / top25) * 10;
    if (value <= average) return 50 + ((average - value) / (average - top25)) * 40;
    return Math.max(0, 50 - ((value - average) / average) * 50);
  }

  /**
   * Filter bookings by date range and optional property
   */
  private filterBookings(dateRange: DateRange, propertyId?: string): BookingData[] {
    return this.bookings.filter((booking) => {
      if (propertyId && booking.propertyId !== propertyId) return false;
      return booking.checkIn < dateRange.end && booking.checkOut > dateRange.start;
    });
  }

  /**
   * Filter expenses by date range and optional property
   */
  private filterExpenses(dateRange: DateRange, propertyId?: string): ExpenseData[] {
    return this.expenses.filter((expense) => {
      if (propertyId && expense.propertyId !== propertyId) return false;
      return expense.date >= dateRange.start && expense.date <= dateRange.end;
    });
  }

  /**
   * Calculate days in a date range
   */
  private calculateDays(dateRange: DateRange): number {
    return Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
  }
}

export const performanceMetrics = new PerformanceMetrics();
