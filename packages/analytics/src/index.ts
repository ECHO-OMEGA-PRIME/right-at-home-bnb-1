/**
 * Right at Home BnB - Analytics Package
 * Complete analytics dashboard for vacation rental performance tracking
 */

// Type exports
export type {
  DateRange,
  Period,
  ComparisonPeriod,
  PropertyData,
  BookingData,
  ExpenseData,
  RevenueMetrics,
  OccupancyMetrics,
  BookingMetrics,
  ExpenseMetrics,
  ProfitabilityMetrics,
  PropertyPerformance,
  PerformanceSnapshot,
  KPI,
  DashboardData,
  TimeSeriesData,
  ChartData,
  ReportConfig,
  Report,
  Forecast,
  AnalyticsConfig,
  BenchmarkData,
} from './types';

// Revenue Tracker
export { RevenueTracker, revenueTracker } from './revenue-tracker';

// Occupancy Calculator
export { OccupancyCalculator, occupancyCalculator } from './occupancy-calculator';

// Performance Metrics
export { PerformanceMetrics, performanceMetrics } from './performance-metrics';

// Report Generator
export { ReportGenerator, reportGenerator } from './report-generator';

/**
 * Analytics Dashboard - Unified interface for all analytics
 */
export class AnalyticsDashboard {
  private revenueTracker: import('./revenue-tracker').RevenueTracker;
  private occupancyCalculator: import('./occupancy-calculator').OccupancyCalculator;
  private performanceMetrics: import('./performance-metrics').PerformanceMetrics;
  private reportGenerator: import('./report-generator').ReportGenerator;

  constructor() {
    const { RevenueTracker } = require('./revenue-tracker');
    const { OccupancyCalculator } = require('./occupancy-calculator');
    const { PerformanceMetrics } = require('./performance-metrics');
    const { ReportGenerator } = require('./report-generator');

    this.revenueTracker = new RevenueTracker();
    this.occupancyCalculator = new OccupancyCalculator();
    this.performanceMetrics = new PerformanceMetrics();
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Load all data into analytics modules
   */
  loadData(
    bookings: import('./types').BookingData[],
    properties: import('./types').PropertyData[],
    expenses: import('./types').ExpenseData[] = []
  ): void {
    this.revenueTracker.loadBookings(bookings);
    this.revenueTracker.loadProperties(properties);
    this.occupancyCalculator.loadBookings(bookings);
    this.occupancyCalculator.loadProperties(properties);
    this.performanceMetrics.loadData(bookings, properties, expenses);
    this.reportGenerator.loadData(bookings, properties, expenses);
  }

  /**
   * Get complete dashboard data
   */
  getDashboardData(
    dateRange: import('./types').DateRange,
    comparePeriod?: import('./types').DateRange
  ): import('./types').DashboardData {
    const kpis = this.performanceMetrics.getKPIs(dateRange, comparePeriod);
    const propertyPerformance = this.performanceMetrics.getPropertyPerformance(dateRange);
    const revenueOverTime = this.revenueTracker.getRevenueOverTime(dateRange, 'day');
    const occupancyOverTime = this.occupancyCalculator.getOccupancyOverTime(dateRange, 'day');

    const snapshot = this.performanceMetrics.getPerformanceSnapshot(dateRange);

    // Convert platform distribution to chart data
    const bookingsByPlatform = Object.entries(snapshot.bookings.platformDistribution).map(
      ([label, value]) => ({
        label,
        value,
        percentage: snapshot.bookings.totalBookings > 0
          ? (value / snapshot.bookings.totalBookings) * 100
          : 0,
      })
    );

    // Convert expenses to chart data
    const totalExpenses = snapshot.expenses.totalExpenses;
    const expensesByCategory = Object.entries(snapshot.expenses.expensesByCategory).map(
      ([label, value]) => ({
        label,
        value,
        percentage: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0,
      })
    );

    return {
      kpis,
      revenueByProperty: propertyPerformance,
      revenueOverTime,
      occupancyOverTime,
      bookingsByPlatform,
      expensesByCategory,
      topProperties: propertyPerformance.slice(0, 5),
      bottomProperties: propertyPerformance.slice(-5).reverse(),
    };
  }

  /**
   * Get revenue metrics
   */
  getRevenueMetrics(
    dateRange: import('./types').DateRange,
    propertyId?: string,
    comparePeriod?: import('./types').DateRange
  ): import('./types').RevenueMetrics {
    return this.revenueTracker.calculateRevenueMetrics(dateRange, propertyId, comparePeriod);
  }

  /**
   * Get occupancy metrics
   */
  getOccupancyMetrics(
    dateRange: import('./types').DateRange,
    propertyId?: string,
    comparePeriod?: import('./types').DateRange
  ): import('./types').OccupancyMetrics {
    return this.occupancyCalculator.calculateOccupancyMetrics(dateRange, propertyId, comparePeriod);
  }

  /**
   * Get booking metrics
   */
  getBookingMetrics(
    dateRange: import('./types').DateRange,
    propertyId?: string
  ): import('./types').BookingMetrics {
    return this.performanceMetrics.calculateBookingMetrics(dateRange, propertyId);
  }

  /**
   * Get expense metrics
   */
  getExpenseMetrics(
    dateRange: import('./types').DateRange,
    propertyId?: string
  ): import('./types').ExpenseMetrics {
    return this.performanceMetrics.calculateExpenseMetrics(dateRange, propertyId);
  }

  /**
   * Get profitability metrics
   */
  getProfitabilityMetrics(
    dateRange: import('./types').DateRange,
    propertyId?: string
  ): import('./types').ProfitabilityMetrics {
    return this.performanceMetrics.calculateProfitabilityMetrics(dateRange, propertyId);
  }

  /**
   * Get performance snapshot
   */
  getPerformanceSnapshot(
    dateRange: import('./types').DateRange,
    comparePeriod?: import('./types').DateRange
  ): import('./types').PerformanceSnapshot {
    return this.performanceMetrics.getPerformanceSnapshot(dateRange, comparePeriod);
  }

  /**
   * Get KPIs
   */
  getKPIs(
    dateRange: import('./types').DateRange,
    comparePeriod?: import('./types').DateRange
  ): import('./types').KPI[] {
    return this.performanceMetrics.getKPIs(dateRange, comparePeriod);
  }

  /**
   * Get benchmarks
   */
  getBenchmarks(dateRange: import('./types').DateRange): import('./types').BenchmarkData[] {
    return this.performanceMetrics.getBenchmarks(dateRange);
  }

  /**
   * Get property performance
   */
  getPropertyPerformance(
    dateRange: import('./types').DateRange
  ): import('./types').PropertyPerformance[] {
    return this.performanceMetrics.getPropertyPerformance(dateRange);
  }

  /**
   * Get revenue by property
   */
  getRevenueByProperty(
    dateRange: import('./types').DateRange
  ): import('./types').PropertyPerformance[] {
    return this.revenueTracker.getRevenueByProperty(dateRange);
  }

  /**
   * Get occupancy by property
   */
  getOccupancyByProperty(dateRange: import('./types').DateRange): Array<{
    propertyId: string;
    propertyName: string;
    occupancyRate: number;
    bookedNights: number;
    availableNights: number;
  }> {
    return this.occupancyCalculator.getOccupancyByProperty(dateRange);
  }

  /**
   * Get revenue over time
   */
  getRevenueOverTime(
    dateRange: import('./types').DateRange,
    granularity: import('./types').Period = 'day'
  ): import('./types').TimeSeriesData[] {
    return this.revenueTracker.getRevenueOverTime(dateRange, granularity);
  }

  /**
   * Get occupancy over time
   */
  getOccupancyOverTime(
    dateRange: import('./types').DateRange,
    granularity: import('./types').Period = 'day',
    propertyId?: string
  ): import('./types').TimeSeriesData[] {
    return this.occupancyCalculator.getOccupancyOverTime(dateRange, granularity, propertyId);
  }

  /**
   * Get gap analysis
   */
  getGapAnalysis(
    dateRange: import('./types').DateRange,
    propertyId?: string
  ): Array<{
    propertyId: string;
    propertyName: string;
    startDate: string;
    endDate: string;
    nights: number;
  }> {
    return this.occupancyCalculator.getGapAnalysis(dateRange, propertyId);
  }

  /**
   * Get revenue by platform
   */
  getRevenueByPlatform(dateRange: import('./types').DateRange): Record<string, number> {
    return this.revenueTracker.getRevenueByPlatform(dateRange);
  }

  /**
   * Calculate month-over-month growth
   */
  calculateMoMGrowth(
    month: number,
    year: number
  ): { current: number; previous: number; growth: number } {
    return this.revenueTracker.calculateMoMGrowth(month, year);
  }

  /**
   * Calculate year-over-year growth
   */
  calculateYoYGrowth(year: number): { current: number; previous: number; growth: number } {
    return this.revenueTracker.calculateYoYGrowth(year);
  }

  /**
   * Project occupancy
   */
  projectOccupancy(
    futureDays: number,
    propertyId?: string
  ): { projected: number; confidence: number; basedOn: string } {
    return this.occupancyCalculator.projectOccupancy(futureDays, propertyId);
  }

  /**
   * Generate report
   */
  generateReport(config: import('./types').ReportConfig): import('./types').Report {
    return this.reportGenerator.generateReport(config);
  }

  /**
   * Generate monthly report
   */
  generateMonthlyReport(year: number, month: number): import('./types').Report {
    return this.reportGenerator.generateMonthlyReport(year, month);
  }

  /**
   * Generate quarterly report
   */
  generateQuarterlyReport(year: number, quarter: number): import('./types').Report {
    return this.reportGenerator.generateQuarterlyReport(year, quarter);
  }

  /**
   * Generate annual report
   */
  generateAnnualReport(year: number): import('./types').Report {
    return this.reportGenerator.generateAnnualReport(year);
  }

  /**
   * Export report to PDF content
   */
  exportToPDF(report: import('./types').Report): string {
    return this.reportGenerator.generatePDFContent(report);
  }

  /**
   * Export report to CSV content
   */
  exportToCSV(report: import('./types').Report): string {
    return this.reportGenerator.generateCSVContent(report);
  }

  /**
   * Export report to JSON content
   */
  exportToJSON(report: import('./types').Report): string {
    return this.reportGenerator.generateJSONContent(report);
  }

  /**
   * Export report to Excel data format
   */
  exportToExcelData(report: import('./types').Report): {
    summary: Record<string, unknown>[];
    properties: Record<string, unknown>[];
    revenueTimeSeries: Record<string, unknown>[];
    occupancyTimeSeries: Record<string, unknown>[];
    expenses: Record<string, unknown>[];
  } {
    return this.reportGenerator.generateExcelData(report);
  }

  /**
   * Generate quick summary
   */
  generateQuickSummary(dateRange: import('./types').DateRange): string {
    return this.reportGenerator.generateQuickSummary(dateRange);
  }
}

// Default instance
export const analyticsDashboard = new AnalyticsDashboard();
