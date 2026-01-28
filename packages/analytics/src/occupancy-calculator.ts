/**
 * Right at Home BnB - Occupancy Calculator
 * Calculate and analyze occupancy rates
 */

import type {
  DateRange,
  Period,
  BookingData,
  PropertyData,
  OccupancyMetrics,
  TimeSeriesData,
} from './types';

/**
 * Occupancy Calendar Entry
 */
interface CalendarEntry {
  date: string;
  isBooked: boolean;
  bookingId?: string;
  propertyId: string;
}

/**
 * Occupancy Calculator
 */
export class OccupancyCalculator {
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
   * Calculate occupancy metrics for a period
   */
  calculateOccupancyMetrics(
    dateRange: DateRange,
    propertyId?: string,
    comparePeriod?: DateRange
  ): OccupancyMetrics {
    const calendar = this.buildOccupancyCalendar(dateRange, propertyId);
    const totalNights = calendar.length;
    const bookedNights = calendar.filter((e) => e.isBooked).length;
    const availableNights = totalNights - bookedNights;
    const occupancyRate = totalNights > 0 ? (bookedNights / totalNights) * 100 : 0;

    // Calculate average length of stay
    const filteredBookings = this.filterBookings(dateRange, propertyId);
    const completedBookings = filteredBookings.filter((b) => b.status !== 'CANCELLED');

    let totalStayLength = 0;
    let totalLeadTime = 0;

    for (const booking of completedBookings) {
      const stayLength = this.calculateNights(booking.checkIn, booking.checkOut);
      totalStayLength += stayLength;

      const leadTime = this.calculateNights(booking.createdAt, booking.checkIn);
      totalLeadTime += leadTime;
    }

    const averageLengthOfStay = completedBookings.length > 0
      ? totalStayLength / completedBookings.length
      : 0;

    const bookingLeadTime = completedBookings.length > 0
      ? totalLeadTime / completedBookings.length
      : 0;

    // Calculate growth if comparison period provided
    let growth = { percentage: 0, trend: 'flat' as const };
    if (comparePeriod) {
      const compareCalendar = this.buildOccupancyCalendar(comparePeriod, propertyId);
      const compareBooked = compareCalendar.filter((e) => e.isBooked).length;
      const compareRate = compareCalendar.length > 0
        ? (compareBooked / compareCalendar.length) * 100
        : 0;

      growth.percentage = occupancyRate - compareRate;
      growth.trend = growth.percentage > 0 ? 'up' : growth.percentage < 0 ? 'down' : 'flat';
    }

    return {
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      totalNights,
      bookedNights,
      availableNights,
      averageLengthOfStay: Math.round(averageLengthOfStay * 100) / 100,
      bookingLeadTime: Math.round(bookingLeadTime * 100) / 100,
      growth: {
        percentage: Math.round(growth.percentage * 100) / 100,
        trend: growth.trend,
      },
    };
  }

  /**
   * Build occupancy calendar
   */
  buildOccupancyCalendar(dateRange: DateRange, propertyId?: string): CalendarEntry[] {
    const calendar: CalendarEntry[] = [];
    const properties = propertyId
      ? [propertyId]
      : Array.from(this.properties.keys());

    const bookedDates = this.getBookedDates(dateRange, propertyId);

    for (const propId of properties) {
      const current = new Date(dateRange.start);
      while (current < dateRange.end) {
        const dateKey = `${propId}_${current.toISOString().split('T')[0]}`;

        calendar.push({
          date: current.toISOString().split('T')[0],
          isBooked: bookedDates.has(dateKey),
          bookingId: bookedDates.get(dateKey),
          propertyId: propId,
        });

        current.setDate(current.getDate() + 1);
      }
    }

    return calendar;
  }

  /**
   * Get booked dates map
   */
  private getBookedDates(dateRange: DateRange, propertyId?: string): Map<string, string> {
    const booked = new Map<string, string>();
    const filteredBookings = this.filterBookings(dateRange, propertyId);

    for (const booking of filteredBookings) {
      if (booking.status === 'CANCELLED') continue;

      const start = new Date(Math.max(booking.checkIn.getTime(), dateRange.start.getTime()));
      const end = new Date(Math.min(booking.checkOut.getTime(), dateRange.end.getTime()));

      const current = new Date(start);
      while (current < end) {
        const dateKey = `${booking.propertyId}_${current.toISOString().split('T')[0]}`;
        booked.set(dateKey, booking.id);
        current.setDate(current.getDate() + 1);
      }
    }

    return booked;
  }

  /**
   * Get occupancy over time
   */
  getOccupancyOverTime(dateRange: DateRange, granularity: Period = 'day', propertyId?: string): TimeSeriesData[] {
    const series: TimeSeriesData[] = [];
    const intervals = this.getTimeIntervals(dateRange, granularity);

    for (const interval of intervals) {
      const metrics = this.calculateOccupancyMetrics(interval, propertyId);
      series.push({
        date: interval.start,
        value: metrics.occupancyRate,
        label: this.formatIntervalLabel(interval.start, granularity),
      });
    }

    return series;
  }

  /**
   * Get occupancy by property
   */
  getOccupancyByProperty(dateRange: DateRange): Array<{
    propertyId: string;
    propertyName: string;
    occupancyRate: number;
    bookedNights: number;
    availableNights: number;
  }> {
    const results: Array<{
      propertyId: string;
      propertyName: string;
      occupancyRate: number;
      bookedNights: number;
      availableNights: number;
    }> = [];

    for (const [propertyId, property] of this.properties) {
      const metrics = this.calculateOccupancyMetrics(dateRange, propertyId);
      results.push({
        propertyId,
        propertyName: property.name,
        occupancyRate: metrics.occupancyRate,
        bookedNights: metrics.bookedNights,
        availableNights: metrics.availableNights,
      });
    }

    return results.sort((a, b) => b.occupancyRate - a.occupancyRate);
  }

  /**
   * Get occupancy by day of week
   */
  getOccupancyByDayOfWeek(dateRange: DateRange, propertyId?: string): number[] {
    const dayStats = new Array(7).fill(0).map(() => ({ booked: 0, total: 0 }));
    const calendar = this.buildOccupancyCalendar(dateRange, propertyId);

    for (const entry of calendar) {
      const dayOfWeek = new Date(entry.date).getDay();
      dayStats[dayOfWeek].total++;
      if (entry.isBooked) {
        dayStats[dayOfWeek].booked++;
      }
    }

    return dayStats.map((stat) =>
      stat.total > 0 ? Math.round((stat.booked / stat.total) * 100 * 100) / 100 : 0
    );
  }

  /**
   * Get gap analysis (unbooked periods)
   */
  getGapAnalysis(dateRange: DateRange, propertyId?: string): Array<{
    propertyId: string;
    propertyName: string;
    startDate: string;
    endDate: string;
    nights: number;
  }> {
    const gaps: Array<{
      propertyId: string;
      propertyName: string;
      startDate: string;
      endDate: string;
      nights: number;
    }> = [];

    const properties = propertyId
      ? [[propertyId, this.properties.get(propertyId)!] as [string, PropertyData]]
      : Array.from(this.properties.entries());

    for (const [propId, property] of properties) {
      if (!property) continue;

      const bookedDates = this.getBookedDates(dateRange, propId);
      let gapStart: Date | null = null;

      const current = new Date(dateRange.start);
      while (current <= dateRange.end) {
        const dateKey = `${propId}_${current.toISOString().split('T')[0]}`;
        const isBooked = bookedDates.has(dateKey);

        if (!isBooked && !gapStart) {
          gapStart = new Date(current);
        } else if (isBooked && gapStart) {
          const nights = this.calculateNights(gapStart, current);
          if (nights > 0) {
            gaps.push({
              propertyId: propId,
              propertyName: property.name,
              startDate: gapStart.toISOString().split('T')[0],
              endDate: current.toISOString().split('T')[0],
              nights,
            });
          }
          gapStart = null;
        }

        current.setDate(current.getDate() + 1);
      }

      // Handle gap at end of period
      if (gapStart) {
        const nights = this.calculateNights(gapStart, dateRange.end);
        if (nights > 0) {
          gaps.push({
            propertyId: propId,
            propertyName: property.name,
            startDate: gapStart.toISOString().split('T')[0],
            endDate: dateRange.end.toISOString().split('T')[0],
            nights,
          });
        }
      }
    }

    return gaps.sort((a, b) => b.nights - a.nights);
  }

  /**
   * Get booking density heatmap data
   */
  getBookingDensityHeatmap(dateRange: DateRange, propertyId?: string): Map<string, number> {
    const density = new Map<string, number>();
    const properties = propertyId
      ? [propertyId]
      : Array.from(this.properties.keys());

    const totalProperties = properties.length;
    const bookedDates = this.getBookedDates(dateRange, propertyId);

    const current = new Date(dateRange.start);
    while (current < dateRange.end) {
      const dateStr = current.toISOString().split('T')[0];
      let bookedCount = 0;

      for (const propId of properties) {
        const dateKey = `${propId}_${dateStr}`;
        if (bookedDates.has(dateKey)) {
          bookedCount++;
        }
      }

      density.set(dateStr, totalProperties > 0 ? (bookedCount / totalProperties) * 100 : 0);
      current.setDate(current.getDate() + 1);
    }

    return density;
  }

  /**
   * Project future occupancy
   */
  projectOccupancy(futureDays: number, propertyId?: string): {
    projected: number;
    confidence: number;
    basedOn: string;
  } {
    // Get historical data for same period last year
    const now = new Date();
    const futureEnd = new Date(now);
    futureEnd.setDate(futureEnd.getDate() + futureDays);

    const lastYearStart = new Date(now);
    lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
    const lastYearEnd = new Date(futureEnd);
    lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);

    const historicalMetrics = this.calculateOccupancyMetrics(
      { start: lastYearStart, end: lastYearEnd },
      propertyId
    );

    // Get current booking pace
    const currentBookings = this.filterBookings({ start: now, end: futureEnd }, propertyId);
    const currentBooked = currentBookings.filter((b) => b.status !== 'CANCELLED').length;

    // Calculate projection
    const projected = (historicalMetrics.occupancyRate + (currentBooked > 0 ? 10 : 0)) / 100;
    const confidence = Math.min(0.8, 0.5 + (currentBooked * 0.05));

    return {
      projected: Math.round(Math.min(projected * 100, 100) * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      basedOn: `Historical data from ${lastYearStart.toLocaleDateString()} - ${lastYearEnd.toLocaleDateString()}`,
    };
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
   * Calculate nights between two dates
   */
  private calculateNights(start: Date, end: Date): number {
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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

export const occupancyCalculator = new OccupancyCalculator();
