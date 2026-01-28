/**
 * Right at Home BnB - Report Generator
 * Generate PDF, Excel, CSV, and JSON reports
 */

import type {
  DateRange,
  ReportConfig,
  Report,
  PerformanceSnapshot,
  PropertyPerformance,
  TimeSeriesData,
  KPI,
  ChartData,
} from './types';
import { RevenueTracker } from './revenue-tracker';
import { OccupancyCalculator } from './occupancy-calculator';
import { PerformanceMetrics } from './performance-metrics';

/**
 * Report Section
 */
interface ReportSection {
  title: string;
  type: 'summary' | 'table' | 'chart' | 'kpi' | 'text';
  data: unknown;
}

/**
 * Generated Report Data
 */
interface GeneratedReport {
  metadata: {
    id: string;
    title: string;
    generatedAt: Date;
    generatedBy: string;
    period: DateRange;
    format: 'pdf' | 'excel' | 'csv' | 'json';
  };
  sections: ReportSection[];
  rawData: Report;
}

/**
 * Report Generator
 */
export class ReportGenerator {
  private revenueTracker: RevenueTracker;
  private occupancyCalculator: OccupancyCalculator;
  private performanceMetrics: PerformanceMetrics;

  constructor() {
    this.revenueTracker = new RevenueTracker();
    this.occupancyCalculator = new OccupancyCalculator();
    this.performanceMetrics = new PerformanceMetrics();
  }

  /**
   * Load data for report generation
   */
  loadData(
    bookings: import('./types').BookingData[],
    properties: import('./types').PropertyData[],
    expenses: import('./types').ExpenseData[]
  ): void {
    this.revenueTracker.loadBookings(bookings);
    this.revenueTracker.loadProperties(properties);
    this.occupancyCalculator.loadBookings(bookings);
    this.occupancyCalculator.loadProperties(properties);
    this.performanceMetrics.loadData(bookings, properties, expenses);
  }

  /**
   * Generate a complete report
   */
  generateReport(config: ReportConfig): Report {
    const id = this.generateReportId();
    const generatedAt = new Date();

    // Calculate comparison period if needed
    let comparePeriod: DateRange | undefined;
    if (config.compareWith) {
      comparePeriod = config.compareWith;
    }

    // Get performance snapshot
    const summary = this.performanceMetrics.getPerformanceSnapshot(config.period, comparePeriod);

    // Get property breakdown
    const propertyBreakdown = this.performanceMetrics.getPropertyPerformance(config.period);

    // Filter by selected properties if specified
    const filteredBreakdown = config.properties
      ? propertyBreakdown.filter((p) => config.properties!.includes(p.propertyId))
      : propertyBreakdown;

    // Get trends
    const revenueOverTime = this.revenueTracker.getRevenueOverTime(config.period, 'day');
    const occupancyOverTime = this.occupancyCalculator.getOccupancyOverTime(config.period, 'day');
    const bookingsOverTime = this.getBookingsOverTime(config.period);

    // Build report object
    const report: Report = {
      id,
      title: config.title,
      generatedAt,
      period: config.period,
      summary,
      propertyBreakdown: filteredBreakdown,
      trends: {
        revenue: revenueOverTime,
        occupancy: occupancyOverTime,
        bookings: bookingsOverTime,
      },
    };

    // Add comparisons if compare period provided
    if (comparePeriod) {
      const previousSnapshot = this.performanceMetrics.getPerformanceSnapshot(comparePeriod);
      report.comparisons = {
        previousPeriod: previousSnapshot,
        changes: this.calculateChanges(summary, previousSnapshot),
      };
    }

    return report;
  }

  /**
   * Export report to specified format
   */
  exportReport(report: Report, format: 'pdf' | 'excel' | 'csv' | 'json'): GeneratedReport {
    const sections = this.buildReportSections(report);

    return {
      metadata: {
        id: report.id,
        title: report.title,
        generatedAt: report.generatedAt,
        generatedBy: 'Right at Home BnB Analytics',
        period: report.period,
        format,
      },
      sections,
      rawData: report,
    };
  }

  /**
   * Generate PDF-ready content
   */
  generatePDFContent(report: Report): string {
    const lines: string[] = [];

    // Header
    lines.push('═'.repeat(80));
    lines.push(`  ${report.title.toUpperCase()}`);
    lines.push(`  Right at Home BnB - Performance Report`);
    lines.push('═'.repeat(80));
    lines.push('');
    lines.push(`Generated: ${report.generatedAt.toLocaleString()}`);
    lines.push(`Period: ${this.formatDate(report.period.start)} - ${this.formatDate(report.period.end)}`);
    lines.push('');

    // Executive Summary
    lines.push('─'.repeat(80));
    lines.push('  EXECUTIVE SUMMARY');
    lines.push('─'.repeat(80));
    lines.push('');

    const { summary } = report;
    lines.push(`Total Revenue:        $${this.formatNumber(summary.revenue.totalRevenue)}`);
    lines.push(`Net Income:           $${this.formatNumber(summary.profitability.netIncome)}`);
    lines.push(`Profit Margin:        ${summary.profitability.profitMargin.toFixed(1)}%`);
    lines.push(`Occupancy Rate:       ${summary.occupancy.occupancyRate.toFixed(1)}%`);
    lines.push(`Average Nightly Rate: $${this.formatNumber(summary.revenue.averageNightlyRate)}`);
    lines.push(`Total Bookings:       ${summary.bookings.totalBookings}`);
    lines.push('');

    // Revenue Breakdown
    lines.push('─'.repeat(80));
    lines.push('  REVENUE BREAKDOWN');
    lines.push('─'.repeat(80));
    lines.push('');
    lines.push(`Accommodation Revenue: $${this.formatNumber(summary.revenue.accommodationRevenue)}`);
    lines.push(`Cleaning Fee Revenue:  $${this.formatNumber(summary.revenue.cleaningFeeRevenue)}`);
    lines.push(`RevPAN:                $${this.formatNumber(summary.revenue.revenuePerAvailableNight)}`);
    lines.push(`Booking Value:         $${this.formatNumber(summary.revenue.bookingValue)}`);
    lines.push('');

    // Occupancy Details
    lines.push('─'.repeat(80));
    lines.push('  OCCUPANCY DETAILS');
    lines.push('─'.repeat(80));
    lines.push('');
    lines.push(`Total Nights:          ${summary.occupancy.totalNights}`);
    lines.push(`Booked Nights:         ${summary.occupancy.bookedNights}`);
    lines.push(`Available Nights:      ${summary.occupancy.availableNights}`);
    lines.push(`Avg Length of Stay:    ${summary.occupancy.averageLengthOfStay.toFixed(1)} nights`);
    lines.push(`Booking Lead Time:     ${summary.occupancy.bookingLeadTime.toFixed(1)} days`);
    lines.push('');

    // Booking Statistics
    lines.push('─'.repeat(80));
    lines.push('  BOOKING STATISTICS');
    lines.push('─'.repeat(80));
    lines.push('');
    lines.push(`Confirmed Bookings:    ${summary.bookings.confirmedBookings}`);
    lines.push(`Cancelled Bookings:    ${summary.bookings.cancelledBookings}`);
    lines.push(`Cancellation Rate:     ${summary.bookings.cancellationRate.toFixed(1)}%`);
    lines.push(`Avg Guest Count:       ${summary.bookings.averageGuestCount.toFixed(1)}`);
    lines.push(`Repeat Guest Rate:     ${summary.bookings.repeatGuestRate.toFixed(1)}%`);
    lines.push('');

    // Platform Distribution
    lines.push('Platform Distribution:');
    for (const [platform, count] of Object.entries(summary.bookings.platformDistribution)) {
      lines.push(`  - ${platform}: ${count} bookings`);
    }
    lines.push('');

    // Expense Summary
    lines.push('─'.repeat(80));
    lines.push('  EXPENSE SUMMARY');
    lines.push('─'.repeat(80));
    lines.push('');
    lines.push(`Total Expenses:        $${this.formatNumber(summary.expenses.totalExpenses)}`);
    lines.push(`Tax Deductible:        $${this.formatNumber(summary.expenses.taxDeductibleAmount)}`);
    lines.push(`Expense per Booking:   $${this.formatNumber(summary.expenses.averageExpensePerBooking)}`);
    lines.push('');

    lines.push('Expenses by Category:');
    for (const [category, amount] of Object.entries(summary.expenses.expensesByCategory)) {
      lines.push(`  - ${category}: $${this.formatNumber(amount)}`);
    }
    lines.push('');

    if (summary.expenses.topVendors.length > 0) {
      lines.push('Top Vendors:');
      for (const vendor of summary.expenses.topVendors.slice(0, 5)) {
        lines.push(`  - ${vendor.vendor}: $${this.formatNumber(vendor.amount)}`);
      }
      lines.push('');
    }

    // Property Performance
    lines.push('─'.repeat(80));
    lines.push('  PROPERTY PERFORMANCE');
    lines.push('─'.repeat(80));
    lines.push('');
    lines.push('Rank | Property                     | Revenue      | Net Income   | Occupancy');
    lines.push('─'.repeat(80));

    for (const property of report.propertyBreakdown.slice(0, 10)) {
      const rank = String(property.ranking).padStart(4);
      const name = property.propertyName.substring(0, 28).padEnd(28);
      const revenue = `$${this.formatNumber(property.revenue)}`.padStart(12);
      const netIncome = `$${this.formatNumber(property.netIncome)}`.padStart(12);
      const occupancy = `${property.occupancyRate.toFixed(1)}%`.padStart(9);
      lines.push(`${rank} | ${name} | ${revenue} | ${netIncome} | ${occupancy}`);
    }
    lines.push('');

    // Comparisons (if available)
    if (report.comparisons) {
      lines.push('─'.repeat(80));
      lines.push('  PERIOD COMPARISON');
      lines.push('─'.repeat(80));
      lines.push('');

      const changes = report.comparisons.changes;
      for (const [metric, change] of Object.entries(changes)) {
        const trend = change.percentage > 0 ? '↑' : change.percentage < 0 ? '↓' : '→';
        const percent = Math.abs(change.percentage).toFixed(1);
        lines.push(`${metric}: ${trend} ${percent}% (${change.value >= 0 ? '+' : ''}${this.formatNumber(change.value)})`);
      }
      lines.push('');
    }

    // Footer
    lines.push('═'.repeat(80));
    lines.push('  Generated by Right at Home BnB Analytics Dashboard');
    lines.push(`  Report ID: ${report.id}`);
    lines.push('═'.repeat(80));

    return lines.join('\n');
  }

  /**
   * Generate Excel-ready data
   */
  generateExcelData(report: Report): {
    summary: Record<string, unknown>[];
    properties: Record<string, unknown>[];
    revenueTimeSeries: Record<string, unknown>[];
    occupancyTimeSeries: Record<string, unknown>[];
    expenses: Record<string, unknown>[];
  } {
    return {
      summary: [
        {
          'Report Title': report.title,
          'Generated At': report.generatedAt,
          'Period Start': report.period.start,
          'Period End': report.period.end,
          'Total Revenue': report.summary.revenue.totalRevenue,
          'Net Income': report.summary.profitability.netIncome,
          'Profit Margin %': report.summary.profitability.profitMargin,
          'Occupancy Rate %': report.summary.occupancy.occupancyRate,
          'Average Nightly Rate': report.summary.revenue.averageNightlyRate,
          'Total Bookings': report.summary.bookings.totalBookings,
          'Cancellation Rate %': report.summary.bookings.cancellationRate,
          'Total Expenses': report.summary.expenses.totalExpenses,
        },
      ],
      properties: report.propertyBreakdown.map((p) => ({
        Rank: p.ranking,
        'Property ID': p.propertyId,
        'Property Name': p.propertyName,
        Revenue: p.revenue,
        Expenses: p.expenses,
        'Net Income': p.netIncome,
        'Occupancy Rate %': p.occupancyRate,
        'Avg Nightly Rate': p.averageNightlyRate,
        'Total Bookings': p.totalBookings,
      })),
      revenueTimeSeries: report.trends.revenue.map((d) => ({
        Date: d.date,
        Revenue: d.value,
        Label: d.label || '',
      })),
      occupancyTimeSeries: report.trends.occupancy.map((d) => ({
        Date: d.date,
        'Occupancy %': d.value,
        Label: d.label || '',
      })),
      expenses: Object.entries(report.summary.expenses.expensesByCategory).map(([category, amount]) => ({
        Category: category,
        Amount: amount,
      })),
    };
  }

  /**
   * Generate CSV content
   */
  generateCSVContent(report: Report): string {
    const lines: string[] = [];

    // Summary section
    lines.push('# SUMMARY');
    lines.push('Metric,Value');
    lines.push(`Total Revenue,${report.summary.revenue.totalRevenue}`);
    lines.push(`Net Income,${report.summary.profitability.netIncome}`);
    lines.push(`Profit Margin %,${report.summary.profitability.profitMargin}`);
    lines.push(`Occupancy Rate %,${report.summary.occupancy.occupancyRate}`);
    lines.push(`Average Nightly Rate,${report.summary.revenue.averageNightlyRate}`);
    lines.push(`Total Bookings,${report.summary.bookings.totalBookings}`);
    lines.push(`Cancellation Rate %,${report.summary.bookings.cancellationRate}`);
    lines.push(`Total Expenses,${report.summary.expenses.totalExpenses}`);
    lines.push('');

    // Property performance section
    lines.push('# PROPERTY PERFORMANCE');
    lines.push('Rank,Property ID,Property Name,Revenue,Expenses,Net Income,Occupancy %,Avg Nightly Rate,Bookings');
    for (const p of report.propertyBreakdown) {
      lines.push(
        `${p.ranking},${p.propertyId},"${p.propertyName}",${p.revenue},${p.expenses},${p.netIncome},${p.occupancyRate},${p.averageNightlyRate},${p.totalBookings}`
      );
    }
    lines.push('');

    // Revenue time series
    lines.push('# REVENUE BY DAY');
    lines.push('Date,Revenue');
    for (const d of report.trends.revenue) {
      lines.push(`${this.formatDate(d.date)},${d.value}`);
    }
    lines.push('');

    // Occupancy time series
    lines.push('# OCCUPANCY BY DAY');
    lines.push('Date,Occupancy %');
    for (const d of report.trends.occupancy) {
      lines.push(`${this.formatDate(d.date)},${d.value}`);
    }
    lines.push('');

    // Expenses by category
    lines.push('# EXPENSES BY CATEGORY');
    lines.push('Category,Amount');
    for (const [category, amount] of Object.entries(report.summary.expenses.expensesByCategory)) {
      lines.push(`"${category}",${amount}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate JSON content
   */
  generateJSONContent(report: Report): string {
    return JSON.stringify(report, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }, 2);
  }

  /**
   * Generate quick summary report
   */
  generateQuickSummary(period: DateRange): string {
    const snapshot = this.performanceMetrics.getPerformanceSnapshot(period);

    const lines = [
      '📊 PERFORMANCE SUMMARY',
      `Period: ${this.formatDate(period.start)} - ${this.formatDate(period.end)}`,
      '',
      `💰 Revenue: $${this.formatNumber(snapshot.revenue.totalRevenue)}`,
      `📈 Net Income: $${this.formatNumber(snapshot.profitability.netIncome)}`,
      `🏠 Occupancy: ${snapshot.occupancy.occupancyRate.toFixed(1)}%`,
      `💵 Avg Rate: $${snapshot.revenue.averageNightlyRate.toFixed(0)}/night`,
      `📅 Bookings: ${snapshot.bookings.totalBookings}`,
      `❌ Cancellations: ${snapshot.bookings.cancellationRate.toFixed(1)}%`,
    ];

    return lines.join('\n');
  }

  /**
   * Generate monthly report
   */
  generateMonthlyReport(year: number, month: number): Report {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    // Previous month for comparison
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const compareStart = new Date(prevYear, prevMonth - 1, 1);
    const compareEnd = new Date(prevYear, prevMonth, 0, 23, 59, 59);

    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });

    return this.generateReport({
      title: `${monthName} ${year} Performance Report`,
      period: { start, end },
      compareWith: { start: compareStart, end: compareEnd },
      includeCharts: true,
      includeDetails: true,
      format: 'pdf',
    });
  }

  /**
   * Generate quarterly report
   */
  generateQuarterlyReport(year: number, quarter: number): Report {
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59);

    // Previous quarter for comparison
    const prevQuarter = quarter === 1 ? 4 : quarter - 1;
    const prevYear = quarter === 1 ? year - 1 : year;
    const prevStartMonth = (prevQuarter - 1) * 3;
    const compareStart = new Date(prevYear, prevStartMonth, 1);
    const compareEnd = new Date(prevYear, prevStartMonth + 3, 0, 23, 59, 59);

    return this.generateReport({
      title: `Q${quarter} ${year} Performance Report`,
      period: { start, end },
      compareWith: { start: compareStart, end: compareEnd },
      includeCharts: true,
      includeDetails: true,
      format: 'pdf',
    });
  }

  /**
   * Generate annual report
   */
  generateAnnualReport(year: number): Report {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    // Previous year for comparison
    const compareStart = new Date(year - 1, 0, 1);
    const compareEnd = new Date(year - 1, 11, 31, 23, 59, 59);

    return this.generateReport({
      title: `${year} Annual Performance Report`,
      period: { start, end },
      compareWith: { start: compareStart, end: compareEnd },
      includeCharts: true,
      includeDetails: true,
      format: 'pdf',
    });
  }

  /**
   * Get bookings over time
   */
  private getBookingsOverTime(dateRange: DateRange): TimeSeriesData[] {
    // Simplified implementation - would need booking data for full implementation
    return [];
  }

  /**
   * Calculate changes between periods
   */
  private calculateChanges(
    current: PerformanceSnapshot,
    previous: PerformanceSnapshot
  ): Record<string, { value: number; percentage: number }> {
    return {
      'Total Revenue': {
        value: current.revenue.totalRevenue - previous.revenue.totalRevenue,
        percentage: previous.revenue.totalRevenue > 0
          ? ((current.revenue.totalRevenue - previous.revenue.totalRevenue) / previous.revenue.totalRevenue) * 100
          : 0,
      },
      'Net Income': {
        value: current.profitability.netIncome - previous.profitability.netIncome,
        percentage: previous.profitability.netIncome > 0
          ? ((current.profitability.netIncome - previous.profitability.netIncome) / previous.profitability.netIncome) * 100
          : 0,
      },
      'Occupancy Rate': {
        value: current.occupancy.occupancyRate - previous.occupancy.occupancyRate,
        percentage: current.occupancy.occupancyRate - previous.occupancy.occupancyRate,
      },
      'Average Nightly Rate': {
        value: current.revenue.averageNightlyRate - previous.revenue.averageNightlyRate,
        percentage: previous.revenue.averageNightlyRate > 0
          ? ((current.revenue.averageNightlyRate - previous.revenue.averageNightlyRate) / previous.revenue.averageNightlyRate) * 100
          : 0,
      },
      'Total Bookings': {
        value: current.bookings.totalBookings - previous.bookings.totalBookings,
        percentage: previous.bookings.totalBookings > 0
          ? ((current.bookings.totalBookings - previous.bookings.totalBookings) / previous.bookings.totalBookings) * 100
          : 0,
      },
      'Cancellation Rate': {
        value: current.bookings.cancellationRate - previous.bookings.cancellationRate,
        percentage: current.bookings.cancellationRate - previous.bookings.cancellationRate,
      },
    };
  }

  /**
   * Build report sections for export
   */
  private buildReportSections(report: Report): ReportSection[] {
    const sections: ReportSection[] = [];

    // KPIs section
    sections.push({
      title: 'Key Performance Indicators',
      type: 'kpi',
      data: this.extractKPIsFromSnapshot(report.summary),
    });

    // Summary section
    sections.push({
      title: 'Executive Summary',
      type: 'summary',
      data: report.summary,
    });

    // Property performance table
    sections.push({
      title: 'Property Performance',
      type: 'table',
      data: report.propertyBreakdown,
    });

    // Revenue chart
    sections.push({
      title: 'Revenue Trend',
      type: 'chart',
      data: report.trends.revenue,
    });

    // Occupancy chart
    sections.push({
      title: 'Occupancy Trend',
      type: 'chart',
      data: report.trends.occupancy,
    });

    // Platform distribution chart
    sections.push({
      title: 'Bookings by Platform',
      type: 'chart',
      data: this.platformToChartData(report.summary.bookings.platformDistribution),
    });

    // Expenses by category chart
    sections.push({
      title: 'Expenses by Category',
      type: 'chart',
      data: this.expensesToChartData(report.summary.expenses.expensesByCategory),
    });

    return sections;
  }

  /**
   * Extract KPIs from snapshot
   */
  private extractKPIsFromSnapshot(snapshot: PerformanceSnapshot): KPI[] {
    return [
      {
        name: 'Total Revenue',
        value: snapshot.revenue.totalRevenue,
        unit: 'currency',
        trend: snapshot.revenue.growth.trend,
        changeAmount: snapshot.revenue.growth.amount,
        changePercentage: snapshot.revenue.growth.percentage,
      },
      {
        name: 'Occupancy Rate',
        value: snapshot.occupancy.occupancyRate,
        unit: 'percentage',
        trend: snapshot.occupancy.growth.trend,
        changeAmount: snapshot.occupancy.growth.percentage,
        changePercentage: snapshot.occupancy.growth.percentage,
      },
      {
        name: 'Net Income',
        value: snapshot.profitability.netIncome,
        unit: 'currency',
        trend: 'flat',
        changeAmount: 0,
        changePercentage: 0,
      },
      {
        name: 'Total Bookings',
        value: snapshot.bookings.totalBookings,
        unit: 'number',
        trend: 'flat',
        changeAmount: 0,
        changePercentage: 0,
      },
    ];
  }

  /**
   * Convert platform distribution to chart data
   */
  private platformToChartData(distribution: Record<string, number>): ChartData[] {
    const total = Object.values(distribution).reduce((sum, v) => sum + v, 0);

    return Object.entries(distribution).map(([label, value]) => ({
      label,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
    }));
  }

  /**
   * Convert expenses to chart data
   */
  private expensesToChartData(expenses: Record<string, number>): ChartData[] {
    const total = Object.values(expenses).reduce((sum, v) => sum + v, 0);

    return Object.entries(expenses)
      .map(([label, value]) => ({
        label,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `RPT-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Format number with commas
   */
  private formatNumber(value: number): string {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

export const reportGenerator = new ReportGenerator();
