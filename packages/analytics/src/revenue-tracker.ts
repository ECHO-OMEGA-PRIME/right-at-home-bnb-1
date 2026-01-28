/**
 * Right at Home BnB - Revenue Tracker
 * Track and analyze revenue across properties
 */

import type {
  DateRange,
  Period,
  BookingData,
  PropertyData,
  RevenueMetrics,
  TimeSeriesData,
  PropertyPerformance,
} from './types';

/**
 * Revenue Tracker
 */
export class RevenueTracker {
  private bookings: BookingData[];
  private properties: Map<string, PropertyData>;

  constructor(bookings: BookingData[] = [], properties: PropertyData[] = []) {
    this.bookings = bookings;
    this.properties = new Map(properties.map((p) => [p.id, p]));
  }

  /**
   * Load bookings data
   */
  loadBookings(bookings: BookingData[]): void {
    this.bookings = bookings;
  }

  /**
   * Load properties data
   */
  loadProperties(properties: PropertyData[]): void {
    this.properties = new Map(properties.map((p) => [p.id, p]));
  }

  /**
   * Calculate revenue metrics for a period
   */
  calculateRevenueMetrics(
    dateRange: DateRange,
    propertyId?: string,
    comparePeriod?: DateRange
  ): RevenueMetrics {
    const filteredBookings = this.filterBookings(dateRange, propertyId);
    const totalDays = this.calculateDays(dateRange);

    // Calculate main metrics
    let totalRevenue = 0;
    let accommodationRevenue = 0;
    let cleaningFeeRevenue = 0;
    let totalNights = 0;

    for (const booking of filteredBookings) {
      if (booking.status === 'CANCELLED') continue;

      const bookingNights = this.calculateBookingNights(booking, dateRange);
      totalRevenue += booking.totalPrice;
      accommodationRevenue += booking.nightlyRate * bookingNights;
      cleaningFeeRevenue += booking.cleaningFee;
      totalNights += bookingNights;
    }

    const averageNightlyRate = totalNights > 0 ? accommodationRevenue / totalNights : 0;
    const revenuePerAvailableNight = totalDays > 0 ? totalRevenue / totalDays : 0;
    const bookingValue = filteredBookings.length > 0
      ? totalRevenue / filteredBookings.filter((b) => b.status !== 'CANCELLED').length
      : 0;

    // Calculate growth if comparison period provided
    let growth = { amount: 0, percentage: 0, trend: 'flat' as const };
    if (comparePeriod) {
      const compareBookings = this.filterBookings(comparePeriod, propertyId);
      const compareRevenue = compareBookings
        .filter((b) => b.status !== 'CANCELLED')
        .reduce((sum, b) => sum + b.totalPrice, 0);

      growth.amount = totalRevenue - compareRevenue;
      growth.percentage = compareRevenue > 0 ? ((totalRevenue - compareRevenue) / compareRevenue) * 100 : 0;
      growth.trend = growth.amount > 0 ? 'up' : growth.amount < 0 ? 'down' : 'flat';
    }

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      accommodationRevenue: Math.round(accommodationRevenue * 100) / 100,
      cleaningFeeRevenue: Math.round(cleaningFeeRevenue * 100) / 100,
      averageNightlyRate: Math.round(averageNightlyRate * 100) / 100,
      revenuePerAvailableNight: Math.round(revenuePerAvailableNight * 100) / 100,
      bookingValue: Math.round(bookingValue * 100) / 100,
      growth: {
        amount: Math.round(growth.amount * 100) / 100,
        percentage: Math.round(growth.percentage * 100) / 100,
        trend: growth.trend,
      },
    };
  }

  /**
   * Get revenue by property
   */
  getRevenueByProperty(dateRange: DateRange): PropertyPerformance[] {
    const propertyRevenue = new Map<string, {
      revenue: number;
      bookings: number;
      nights: number;
    }>();

    // Initialize all properties
    for (const [propertyId] of this.properties) {
      propertyRevenue.set(propertyId, { revenue: 0, bookings: 0, nights: 0 });
    }

    // Calculate revenue per property
    const filteredBookings = this.filterBookings(dateRange);
    for (const booking of filteredBookings) {
      if (booking.status === 'CANCELLED') continue;

      const current = propertyRevenue.get(booking.propertyId) || { revenue: 0, bookings: 0, nights: 0 };
      const nights = this.calculateBookingNights(booking, dateRange);

      propertyRevenue.set(booking.propertyId, {
        revenue: current.revenue + booking.totalPrice,
        bookings: current.bookings + 1,
        nights: current.nights + nights,
      });
    }

    // Convert to performance array
    const totalDays = this.calculateDays(dateRange);
    const performances: PropertyPerformance[] = [];

    for (const [propertyId, data] of propertyRevenue) {
      const property = this.properties.get(propertyId);
      if (!property) continue;

      const occupancyRate = totalDays > 0 ? (data.nights / totalDays) * 100 : 0;
      const averageNightlyRate = data.nights > 0 ? data.revenue / data.nights : 0;

      performances.push({
        propertyId,
        propertyName: property.name,
        revenue: Math.round(data.revenue * 100) / 100,
        expenses: 0, // Will be filled by expense tracker
        netIncome: Math.round(data.revenue * 100) / 100,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        averageNightlyRate: Math.round(averageNightlyRate * 100) / 100,
        totalBookings: data.bookings,
        ranking: 0,
      });
    }

    // Sort by revenue and assign rankings
    performances.sort((a, b) => b.revenue - a.revenue);
    performances.forEach((p, index) => {
      p.ranking = index + 1;
    });

    return performances;
  }

  /**
   * Get revenue over time
   */
  getRevenueOverTime(dateRange: DateRange, granularity: Period = 'day'): TimeSeriesData[] {
    const series: TimeSeriesData[] = [];
    const intervals = this.getTimeIntervals(dateRange, granularity);

    for (const interval of intervals) {
      const bookings = this.filterBookings(interval);
      const revenue = bookings
        .filter((b) => b.status !== 'CANCELLED')
        .reduce((sum, b) => sum + b.totalPrice, 0);

      series.push({
        date: interval.start,
        value: Math.round(revenue * 100) / 100,
        label: this.formatIntervalLabel(interval.start, granularity),
      });
    }

    return series;
  }

  /**
   * Get daily revenue
   */
  getDailyRevenue(dateRange: DateRange): Map<string, number> {
    const daily = new Map<string, number>();
    const current = new Date(dateRange.start);

    while (current <= dateRange.end) {
      const dateKey = current.toISOString().split('T')[0];
      daily.set(dateKey, 0);
      current.setDate(current.getDate() + 1);
    }

    for (const booking of this.bookings) {
      if (booking.status === 'CANCELLED') continue;

      const bookingStart = new Date(Math.max(booking.checkIn.getTime(), dateRange.start.getTime()));
      const bookingEnd = new Date(Math.min(booking.checkOut.getTime(), dateRange.end.getTime()));

      const bookingNights = this.calculateBookingNights(booking, dateRange);
      if (bookingNights <= 0) continue;

      const nightlyRevenue = booking.totalPrice / this.calculateBookingNights(booking, {
        start: booking.checkIn,
        end: booking.checkOut,
      });

      const trackDate = new Date(bookingStart);
      while (trackDate < bookingEnd) {
        const dateKey = trackDate.toISOString().split('T')[0];
        if (daily.has(dateKey)) {
          daily.set(dateKey, (daily.get(dateKey) || 0) + nightlyRevenue);
        }
        trackDate.setDate(trackDate.getDate() + 1);
      }
    }

    return daily;
  }

  /**
   * Get top revenue days
   */
  getTopRevenueDays(dateRange: DateRange, limit: number = 10): Array<{ date: string; revenue: number }> {
    const daily = this.getDailyRevenue(dateRange);
    const entries = Array.from(daily.entries())
      .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return entries;
  }

  /**
   * Get revenue by platform
   */
  getRevenueByPlatform(dateRange: DateRange): Record<string, number> {
    const platforms: Record<string, number> = {};
    const filteredBookings = this.filterBookings(dateRange);

    for (const booking of filteredBookings) {
      if (booking.status === 'CANCELLED') continue;

      const platform = booking.platform || 'OTHER';
      platforms[platform] = (platforms[platform] || 0) + booking.totalPrice;
    }

    // Round values
    for (const platform in platforms) {
      platforms[platform] = Math.round(platforms[platform] * 100) / 100;
    }

    return platforms;
  }

  /**
   * Calculate month-over-month growth
   */
  calculateMoMGrowth(month: number, year: number): { current: number; previous: number; growth: number } {
    const currentStart = new Date(year, month - 1, 1);
    const currentEnd = new Date(year, month, 0);

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const previousStart = new Date(prevYear, prevMonth - 1, 1);
    const previousEnd = new Date(prevYear, prevMonth, 0);

    const currentMetrics = this.calculateRevenueMetrics({ start: currentStart, end: currentEnd });
    const previousMetrics = this.calculateRevenueMetrics({ start: previousStart, end: previousEnd });

    const growth = previousMetrics.totalRevenue > 0
      ? ((currentMetrics.totalRevenue - previousMetrics.totalRevenue) / previousMetrics.totalRevenue) * 100
      : 0;

    return {
      current: currentMetrics.totalRevenue,
      previous: previousMetrics.totalRevenue,
      growth: Math.round(growth * 100) / 100,
    };
  }

  /**
   * Calculate year-over-year growth
   */
  calculateYoYGrowth(year: number): { current: number; previous: number; growth: number } {
    const currentStart = new Date(year, 0, 1);
    const currentEnd = new Date(year, 11, 31);
    const previousStart = new Date(year - 1, 0, 1);
    const previousEnd = new Date(year - 1, 11, 31);

    const currentMetrics = this.calculateRevenueMetrics({ start: currentStart, end: currentEnd });
    const previousMetrics = this.calculateRevenueMetrics({ start: previousStart, end: previousEnd });

    const growth = previousMetrics.totalRevenue > 0
      ? ((currentMetrics.totalRevenue - previousMetrics.totalRevenue) / previousMetrics.totalRevenue) * 100
      : 0;

    return {
      current: currentMetrics.totalRevenue,
      previous: previousMetrics.totalRevenue,
      growth: Math.round(growth * 100) / 100,
    };
  }

  /**
   * Get cumulative revenue
   */
  getCumulativeRevenue(dateRange: DateRange): TimeSeriesData[] {
    const daily = this.getDailyRevenue(dateRange);
    const series: TimeSeriesData[] = [];
    let cumulative = 0;

    const sortedDates = Array.from(daily.keys()).sort();
    for (const date of sortedDates) {
      cumulative += daily.get(date) || 0;
      series.push({
        date: new Date(date),
        value: Math.round(cumulative * 100) / 100,
      });
    }

    return series;
  }

  /**
   * Filter bookings by date range and optional property
   */
  private filterBookings(dateRange: DateRange, propertyId?: string): BookingData[] {
    return this.bookings.filter((booking) => {
      // Check property filter
      if (propertyId && booking.propertyId !== propertyId) return false;

      // Check date overlap
      return booking.checkIn < dateRange.end && booking.checkOut > dateRange.start;
    });
  }

  /**
   * Calculate nights for a booking within a date range
   */
  private calculateBookingNights(booking: BookingData, dateRange: DateRange): number {
    const overlapStart = new Date(Math.max(booking.checkIn.getTime(), dateRange.start.getTime()));
    const overlapEnd = new Date(Math.min(booking.checkOut.getTime(), dateRange.end.getTime()));

    if (overlapStart >= overlapEnd) return 0;

    return Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate days in a date range
   */
  private calculateDays(dateRange: DateRange): number {
    return Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get time intervals for a date range
   */
  private getTimeIntervals(dateRange: DateRange, granularity: Period): DateRange[] {
    const intervals: DateRange[] = [];
    const current = new Date(dateRange.start);

    while (current < dateRange.end) {
      const intervalEnd = new Date(current);

      switch (granularity) {
        case 'day':
          intervalEnd.setDate(intervalEnd.getDate() + 1);
          break;
        case 'week':
          intervalEnd.setDate(intervalEnd.getDate() + 7);
          break;
        case 'month':
          intervalEnd.setMonth(intervalEnd.getMonth() + 1);
          break;
        case 'quarter':
          intervalEnd.setMonth(intervalEnd.getMonth() + 3);
          break;
        case 'year':
          intervalEnd.setFullYear(intervalEnd.getFullYear() + 1);
          break;
      }

      intervals.push({
        start: new Date(current),
        end: new Date(Math.min(intervalEnd.getTime(), dateRange.end.getTime())),
      });

      current.setTime(intervalEnd.getTime());
    }

    return intervals;
  }

  /**
   * Format interval label
   */
  private formatIntervalLabel(date: Date, granularity: Period): string {
    switch (granularity) {
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'week':
        return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter} ${date.getFullYear()}`;
      case 'year':
        return String(date.getFullYear());
      default:
        return date.toISOString().split('T')[0];
    }
  }
}

export const revenueTracker = new RevenueTracker();
