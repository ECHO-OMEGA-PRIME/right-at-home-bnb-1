/**
 * Right at Home BnB - Occupancy Calculator
 *
 * Comprehensive analytics library for vacation rental metrics:
 * - Occupancy rates (daily, weekly, monthly, yearly)
 * - RevPAR (Revenue Per Available Room)
 * - ADR (Average Daily Rate)
 * - Booking lead time analysis
 * - Length of stay patterns
 * - Property comparison analytics
 */

import { Booking, Property } from './types';

// ============================================
// TYPES
// ============================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface OccupancyMetrics {
  occupancyRate: number;          // Percentage (0-100)
  totalNights: number;            // Available nights in period
  bookedNights: number;           // Nights with bookings
  availableNights: number;        // Nights without bookings
  bookingCount: number;           // Number of bookings
}

export interface RevenueMetrics {
  totalRevenue: number;           // Total revenue in period
  revPAR: number;                 // Revenue Per Available Room/Night
  adr: number;                    // Average Daily Rate
  averageBookingValue: number;    // Average booking total
}

export interface BookingPatternMetrics {
  averageLeadTime: number;        // Days between booking and check-in
  averageLengthOfStay: number;    // Average nights per booking
  shortStayCount: number;         // 1-2 nights
  mediumStayCount: number;        // 3-6 nights
  longStayCount: number;          // 7+ nights
  weekendBookingRate: number;     // % of bookings including weekend
  leadTimeDistribution: {
    lastMinute: number;           // 0-3 days
    shortTerm: number;            // 4-14 days
    mediumTerm: number;           // 15-30 days
    longTerm: number;             // 31+ days
  };
}

export interface SeasonalMetrics {
  month: string;
  year: number;
  occupancyRate: number;
  revenue: number;
  bookings: number;
  adr: number;
  revPAR: number;
}

export interface PropertyComparison {
  propertyId: string;
  propertyName: string;
  occupancyRate: number;
  revenue: number;
  revPAR: number;
  adr: number;
  bookingCount: number;
  averageLengthOfStay: number;
}

export interface DailyOccupancy {
  date: string;
  isBooked: boolean;
  bookingId?: string;
  revenue?: number;
  propertyId: string;
}

export interface WeeklyOccupancy {
  weekStart: string;
  weekEnd: string;
  occupancyRate: number;
  revenue: number;
  bookingCount: number;
}

export interface MonthlyOccupancy {
  month: string;
  year: number;
  occupancyRate: number;
  revenue: number;
  bookingCount: number;
  adr: number;
  revPAR: number;
}

export interface YearlyOccupancy {
  year: number;
  occupancyRate: number;
  revenue: number;
  bookingCount: number;
  adr: number;
  revPAR: number;
}

export interface TrendAnalysis {
  metric: string;
  currentPeriod: number;
  previousPeriod: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface FullAnalytics {
  occupancy: OccupancyMetrics;
  revenue: RevenueMetrics;
  patterns: BookingPatternMetrics;
  dailyData: DailyOccupancy[];
  weeklyData: WeeklyOccupancy[];
  monthlyData: MonthlyOccupancy[];
  yearlyData: YearlyOccupancy[];
  trends: TrendAnalysis[];
  propertyComparisons: PropertyComparison[];
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get the number of days between two dates
 */
export function daysBetween(start: Date, end: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / oneDay);
}

/**
 * Get array of all dates in a range
 */
export function getDatesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Format date to YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get the start of the week (Sunday) for a date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get month name from date
 */
export function getMonthName(date: Date): string {
  return date.toLocaleString('default', { month: 'long' });
}

/**
 * Check if a date falls on a weekend (Friday or Saturday night)
 */
export function isWeekendNight(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6; // Friday or Saturday
}

/**
 * Parse date string or Date object to Date
 */
export function parseDate(date: string | Date): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

// ============================================
// CORE CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate occupancy metrics for a property over a date range
 */
export function calculateOccupancy(
  bookings: Booking[],
  dateRange: DateRange,
  propertyId?: string
): OccupancyMetrics {
  const { start, end } = dateRange;
  const totalNights = daysBetween(start, end);

  // Filter bookings for this property and date range
  const relevantBookings = bookings.filter(b => {
    if (propertyId && b.propertyId !== propertyId) return false;
    if (b.status === 'CANCELLED') return false;
    const checkIn = parseDate(b.checkIn);
    const checkOut = parseDate(b.checkOut);
    return checkIn < end && checkOut > start;
  });

  // Count booked nights
  const bookedDates = new Set<string>();
  relevantBookings.forEach(booking => {
    const bookingStart = parseDate(booking.checkIn);
    const bookingEnd = parseDate(booking.checkOut);
    const effectiveStart = bookingStart < start ? start : bookingStart;
    const effectiveEnd = bookingEnd > end ? end : bookingEnd;

    const dates = getDatesInRange(effectiveStart, new Date(effectiveEnd.getTime() - 24*60*60*1000));
    dates.forEach(d => bookedDates.add(formatDate(d)));
  });

  const bookedNights = bookedDates.size;
  const availableNights = totalNights - bookedNights;
  const occupancyRate = totalNights > 0 ? (bookedNights / totalNights) * 100 : 0;

  return {
    occupancyRate: Math.round(occupancyRate * 100) / 100,
    totalNights,
    bookedNights,
    availableNights,
    bookingCount: relevantBookings.length,
  };
}

/**
 * Calculate revenue metrics for a property over a date range
 */
export function calculateRevenue(
  bookings: Booking[],
  dateRange: DateRange,
  propertyId?: string
): RevenueMetrics {
  const { start, end } = dateRange;
  const totalNights = daysBetween(start, end);

  // Filter relevant bookings
  const relevantBookings = bookings.filter(b => {
    if (propertyId && b.propertyId !== propertyId) return false;
    if (b.status === 'CANCELLED') return false;
    const checkIn = parseDate(b.checkIn);
    const checkOut = parseDate(b.checkOut);
    return checkIn < end && checkOut > start;
  });

  // Calculate total revenue and booked nights
  let totalRevenue = 0;
  let totalBookedNights = 0;

  relevantBookings.forEach(booking => {
    const bookingStart = parseDate(booking.checkIn);
    const bookingEnd = parseDate(booking.checkOut);
    const bookingNights = daysBetween(bookingStart, bookingEnd);

    // Calculate what portion of this booking falls within our date range
    const effectiveStart = bookingStart < start ? start : bookingStart;
    const effectiveEnd = bookingEnd > end ? end : bookingEnd;
    const effectiveNights = daysBetween(effectiveStart, effectiveEnd);

    // Proportional revenue based on nights in range
    const proportionalRevenue = (effectiveNights / bookingNights) * booking.totalPrice;
    totalRevenue += proportionalRevenue;
    totalBookedNights += effectiveNights;
  });

  const revPAR = totalNights > 0 ? totalRevenue / totalNights : 0;
  const adr = totalBookedNights > 0 ? totalRevenue / totalBookedNights : 0;
  const averageBookingValue = relevantBookings.length > 0
    ? totalRevenue / relevantBookings.length
    : 0;

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    revPAR: Math.round(revPAR * 100) / 100,
    adr: Math.round(adr * 100) / 100,
    averageBookingValue: Math.round(averageBookingValue * 100) / 100,
  };
}

/**
 * Analyze booking patterns
 */
export function analyzeBookingPatterns(
  bookings: Booking[],
  dateRange: DateRange,
  propertyId?: string
): BookingPatternMetrics {
  const { start, end } = dateRange;

  const relevantBookings = bookings.filter(b => {
    if (propertyId && b.propertyId !== propertyId) return false;
    if (b.status === 'CANCELLED') return false;
    const checkIn = parseDate(b.checkIn);
    return checkIn >= start && checkIn <= end;
  });

  if (relevantBookings.length === 0) {
    return {
      averageLeadTime: 0,
      averageLengthOfStay: 0,
      shortStayCount: 0,
      mediumStayCount: 0,
      longStayCount: 0,
      weekendBookingRate: 0,
      leadTimeDistribution: {
        lastMinute: 0,
        shortTerm: 0,
        mediumTerm: 0,
        longTerm: 0,
      },
    };
  }

  let totalLeadTime = 0;
  let totalLengthOfStay = 0;
  let shortStayCount = 0;
  let mediumStayCount = 0;
  let longStayCount = 0;
  let weekendBookings = 0;
  const leadTimes = { lastMinute: 0, shortTerm: 0, mediumTerm: 0, longTerm: 0 };

  relevantBookings.forEach(booking => {
    const checkIn = parseDate(booking.checkIn);
    const checkOut = parseDate(booking.checkOut);
    const createdAt = parseDate(booking.createdAt);

    // Lead time calculation
    const leadTime = daysBetween(createdAt, checkIn);
    totalLeadTime += Math.max(0, leadTime);

    if (leadTime <= 3) leadTimes.lastMinute++;
    else if (leadTime <= 14) leadTimes.shortTerm++;
    else if (leadTime <= 30) leadTimes.mediumTerm++;
    else leadTimes.longTerm++;

    // Length of stay calculation
    const lengthOfStay = booking.totalNights || daysBetween(checkIn, checkOut);
    totalLengthOfStay += lengthOfStay;

    if (lengthOfStay <= 2) shortStayCount++;
    else if (lengthOfStay <= 6) mediumStayCount++;
    else longStayCount++;

    // Weekend booking check
    const dates = getDatesInRange(checkIn, new Date(checkOut.getTime() - 24*60*60*1000));
    if (dates.some(d => isWeekendNight(d))) {
      weekendBookings++;
    }
  });

  const count = relevantBookings.length;

  return {
    averageLeadTime: Math.round(totalLeadTime / count),
    averageLengthOfStay: Math.round((totalLengthOfStay / count) * 10) / 10,
    shortStayCount,
    mediumStayCount,
    longStayCount,
    weekendBookingRate: Math.round((weekendBookings / count) * 100),
    leadTimeDistribution: {
      lastMinute: Math.round((leadTimes.lastMinute / count) * 100),
      shortTerm: Math.round((leadTimes.shortTerm / count) * 100),
      mediumTerm: Math.round((leadTimes.mediumTerm / count) * 100),
      longTerm: Math.round((leadTimes.longTerm / count) * 100),
    },
  };
}

// ============================================
// TIME-SERIES FUNCTIONS
// ============================================

/**
 * Calculate daily occupancy data
 */
export function calculateDailyOccupancy(
  bookings: Booking[],
  dateRange: DateRange,
  propertyId?: string
): DailyOccupancy[] {
  const { start, end } = dateRange;
  const dates = getDatesInRange(start, end);

  const relevantBookings = bookings.filter(b => {
    if (propertyId && b.propertyId !== propertyId) return false;
    if (b.status === 'CANCELLED') return false;
    const checkIn = parseDate(b.checkIn);
    const checkOut = parseDate(b.checkOut);
    return checkIn < end && checkOut > start;
  });

  return dates.map(date => {
    const dateStr = formatDate(date);
    const booking = relevantBookings.find(b => {
      const checkIn = parseDate(b.checkIn);
      const checkOut = parseDate(b.checkOut);
      return date >= checkIn && date < checkOut;
    });

    const dailyRate = booking
      ? booking.totalPrice / (booking.totalNights || daysBetween(parseDate(booking.checkIn), parseDate(booking.checkOut)))
      : 0;

    return {
      date: dateStr,
      isBooked: !!booking,
      bookingId: booking?.id,
      revenue: booking ? dailyRate : undefined,
      propertyId: propertyId || booking?.propertyId || '',
    };
  });
}

/**
 * Calculate weekly occupancy data
 */
export function calculateWeeklyOccupancy(
  bookings: Booking[],
  dateRange: DateRange,
  propertyId?: string
): WeeklyOccupancy[] {
  const { start, end } = dateRange;
  const weeks: WeeklyOccupancy[] = [];

  let weekStart = getWeekStart(start);

  while (weekStart < end) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekRange = {
      start: weekStart < start ? start : weekStart,
      end: weekEnd > end ? end : weekEnd,
    };

    const occupancy = calculateOccupancy(bookings, weekRange, propertyId);
    const revenue = calculateRevenue(bookings, weekRange, propertyId);

    weeks.push({
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      occupancyRate: occupancy.occupancyRate,
      revenue: revenue.totalRevenue,
      bookingCount: occupancy.bookingCount,
    });

    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
  }

  return weeks;
}

/**
 * Calculate monthly occupancy data
 */
export function calculateMonthlyOccupancy(
  bookings: Booking[],
  dateRange: DateRange,
  propertyId?: string
): MonthlyOccupancy[] {
  const { start, end } = dateRange;
  const months: MonthlyOccupancy[] = [];

  let current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current < end) {
    const monthStart = new Date(Math.max(current.getTime(), start.getTime()));
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    const effectiveEnd = new Date(Math.min(monthEnd.getTime(), end.getTime()));

    const monthRange = { start: monthStart, end: effectiveEnd };

    const occupancy = calculateOccupancy(bookings, monthRange, propertyId);
    const revenue = calculateRevenue(bookings, monthRange, propertyId);

    months.push({
      month: getMonthName(current),
      year: current.getFullYear(),
      occupancyRate: occupancy.occupancyRate,
      revenue: revenue.totalRevenue,
      bookingCount: occupancy.bookingCount,
      adr: revenue.adr,
      revPAR: revenue.revPAR,
    });

    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return months;
}

/**
 * Calculate yearly occupancy data
 */
export function calculateYearlyOccupancy(
  bookings: Booking[],
  dateRange: DateRange,
  propertyId?: string
): YearlyOccupancy[] {
  const { start, end } = dateRange;
  const years: YearlyOccupancy[] = [];

  let currentYear = start.getFullYear();

  while (currentYear <= end.getFullYear()) {
    const yearStart = new Date(Math.max(new Date(currentYear, 0, 1).getTime(), start.getTime()));
    const yearEnd = new Date(Math.min(new Date(currentYear, 11, 31).getTime(), end.getTime()));

    const yearRange = { start: yearStart, end: yearEnd };

    const occupancy = calculateOccupancy(bookings, yearRange, propertyId);
    const revenue = calculateRevenue(bookings, yearRange, propertyId);

    years.push({
      year: currentYear,
      occupancyRate: occupancy.occupancyRate,
      revenue: revenue.totalRevenue,
      bookingCount: occupancy.bookingCount,
      adr: revenue.adr,
      revPAR: revenue.revPAR,
    });

    currentYear++;
  }

  return years;
}

// ============================================
// COMPARISON & TREND FUNCTIONS
// ============================================

/**
 * Compare metrics across multiple properties
 */
export function compareProperties(
  properties: Property[],
  bookings: Booking[],
  dateRange: DateRange
): PropertyComparison[] {
  return properties.map(property => {
    const propertyBookings = bookings.filter(b => b.propertyId === property.id);
    const occupancy = calculateOccupancy(propertyBookings, dateRange, property.id);
    const revenue = calculateRevenue(propertyBookings, dateRange, property.id);
    const patterns = analyzeBookingPatterns(propertyBookings, dateRange, property.id);

    return {
      propertyId: property.id,
      propertyName: property.name,
      occupancyRate: occupancy.occupancyRate,
      revenue: revenue.totalRevenue,
      revPAR: revenue.revPAR,
      adr: revenue.adr,
      bookingCount: occupancy.bookingCount,
      averageLengthOfStay: patterns.averageLengthOfStay,
    };
  });
}

/**
 * Calculate trend analysis comparing two periods
 */
export function calculateTrends(
  bookings: Booking[],
  currentRange: DateRange,
  previousRange: DateRange,
  propertyId?: string
): TrendAnalysis[] {
  const currentOccupancy = calculateOccupancy(bookings, currentRange, propertyId);
  const previousOccupancy = calculateOccupancy(bookings, previousRange, propertyId);

  const currentRevenue = calculateRevenue(bookings, currentRange, propertyId);
  const previousRevenue = calculateRevenue(bookings, previousRange, propertyId);

  const trends: TrendAnalysis[] = [];

  const calculateChange = (current: number, previous: number): TrendAnalysis => {
    const change = current - previous;
    const changePercent = previous !== 0
      ? ((current - previous) / previous) * 100
      : current > 0 ? 100 : 0;
    const trend = change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'stable';
    return { metric: '', currentPeriod: current, previousPeriod: previous, change, changePercent: Math.round(changePercent * 10) / 10, trend };
  };

  const occupancyTrend = calculateChange(currentOccupancy.occupancyRate, previousOccupancy.occupancyRate);
  trends.push({ ...occupancyTrend, metric: 'Occupancy Rate' });

  const revenueTrend = calculateChange(currentRevenue.totalRevenue, previousRevenue.totalRevenue);
  trends.push({ ...revenueTrend, metric: 'Revenue' });

  const revPARTrend = calculateChange(currentRevenue.revPAR, previousRevenue.revPAR);
  trends.push({ ...revPARTrend, metric: 'RevPAR' });

  const adrTrend = calculateChange(currentRevenue.adr, previousRevenue.adr);
  trends.push({ ...adrTrend, metric: 'ADR' });

  const bookingsTrend = calculateChange(currentOccupancy.bookingCount, previousOccupancy.bookingCount);
  trends.push({ ...bookingsTrend, metric: 'Bookings' });

  return trends;
}

// ============================================
// FULL ANALYTICS FUNCTION
// ============================================

/**
 * Generate complete analytics for a property or portfolio
 */
export function generateFullAnalytics(
  properties: Property[],
  bookings: Booking[],
  dateRange: DateRange,
  propertyId?: string
): FullAnalytics {
  // Calculate previous period for trend comparison
  const periodLength = daysBetween(dateRange.start, dateRange.end);
  const previousRange: DateRange = {
    start: new Date(dateRange.start.getTime() - periodLength * 24 * 60 * 60 * 1000),
    end: new Date(dateRange.start.getTime() - 24 * 60 * 60 * 1000),
  };

  const filteredBookings = propertyId
    ? bookings.filter(b => b.propertyId === propertyId)
    : bookings;

  return {
    occupancy: calculateOccupancy(filteredBookings, dateRange, propertyId),
    revenue: calculateRevenue(filteredBookings, dateRange, propertyId),
    patterns: analyzeBookingPatterns(filteredBookings, dateRange, propertyId),
    dailyData: calculateDailyOccupancy(filteredBookings, dateRange, propertyId),
    weeklyData: calculateWeeklyOccupancy(filteredBookings, dateRange, propertyId),
    monthlyData: calculateMonthlyOccupancy(filteredBookings, dateRange, propertyId),
    yearlyData: calculateYearlyOccupancy(filteredBookings, dateRange, propertyId),
    trends: calculateTrends(filteredBookings, dateRange, previousRange, propertyId),
    propertyComparisons: propertyId
      ? []
      : compareProperties(properties, bookings, dateRange),
  };
}

// ============================================
// REACT QUERY HOOKS DATA FETCHING
// ============================================

export interface OccupancyQueryParams {
  propertyId?: string;
  startDate: string;
  endDate: string;
  granularity?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface TrendQueryParams {
  propertyId?: string;
  currentStart: string;
  currentEnd: string;
  compareType?: 'previous_period' | 'same_period_last_year';
}

/**
 * API response formatters for frontend consumption
 */
export function formatOccupancyResponse(analytics: FullAnalytics) {
  return {
    summary: {
      occupancyRate: analytics.occupancy.occupancyRate,
      totalNights: analytics.occupancy.totalNights,
      bookedNights: analytics.occupancy.bookedNights,
      bookingCount: analytics.occupancy.bookingCount,
      totalRevenue: analytics.revenue.totalRevenue,
      revPAR: analytics.revenue.revPAR,
      adr: analytics.revenue.adr,
    },
    patterns: analytics.patterns,
    timeSeries: {
      daily: analytics.dailyData,
      weekly: analytics.weeklyData,
      monthly: analytics.monthlyData,
      yearly: analytics.yearlyData,
    },
  };
}

export function formatTrendResponse(analytics: FullAnalytics) {
  return {
    trends: analytics.trends,
    propertyComparisons: analytics.propertyComparisons,
    currentPeriod: {
      occupancy: analytics.occupancy,
      revenue: analytics.revenue,
    },
  };
}
