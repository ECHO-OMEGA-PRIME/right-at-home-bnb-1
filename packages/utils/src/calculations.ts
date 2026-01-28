/**
 * Right at Home BnB - Calculation Utilities
 * Functions for pricing, availability, and business calculations
 * @packageDocumentation
 */

import {
  parseISO,
  differenceInDays,
  eachDayOfInterval,
  isWeekend,
  format,
  addDays,
  isWithinInterval,
  startOfDay,
  endOfDay,
  isSameDay,
  isAfter,
  isBefore,
} from 'date-fns';

// ============================================
// PRICING CALCULATIONS
// ============================================

/**
 * Pricing configuration for calculations
 */
export interface PricingConfig {
  baseRate: number;
  cleaningFee: number;
  weekendMultiplier?: number;
  holidayMultiplier?: number;
  weeklyDiscount?: number;
  monthlyDiscount?: number;
  extraGuestFee?: number;
  baseGuests?: number;
  petFee?: number;
  serviceFeePercent?: number;
  taxRate?: number;
}

/**
 * Price breakdown result
 */
export interface PriceBreakdown {
  nights: number;
  nightlyBreakdown: Array<{
    date: string;
    rate: number;
    type: 'weekday' | 'weekend' | 'holiday';
  }>;
  accommodationTotal: number;
  weeklyDiscount: number;
  monthlyDiscount: number;
  extraGuestFees: number;
  petFee: number;
  cleaningFee: number;
  subtotal: number;
  serviceFee: number;
  taxes: number;
  total: number;
}

/**
 * Known holiday dates (US holidays relevant to Midland, TX)
 */
const HOLIDAYS_2026: string[] = [
  '2026-01-01', // New Year's Day
  '2026-01-20', // MLK Day
  '2026-02-16', // Presidents Day
  '2026-05-25', // Memorial Day
  '2026-07-04', // Independence Day
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-11-27', // Day after Thanksgiving
  '2026-12-24', // Christmas Eve
  '2026-12-25', // Christmas Day
  '2026-12-31', // New Year's Eve
];

/**
 * Checks if a date is a holiday
 * @param date - Date to check
 * @returns Whether the date is a holiday
 */
export function isHoliday(date: Date | string): boolean {
  const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
  return HOLIDAYS_2026.includes(dateStr);
}

/**
 * Calculates the nightly rate for a specific date
 * @param date - Date to calculate rate for
 * @param config - Pricing configuration
 * @returns Rate and rate type for the date
 *
 * @example
 * ```ts
 * calculateDailyRate('2026-01-18', { baseRate: 100, weekendMultiplier: 1.2 })
 * // { rate: 120, type: 'weekend' }
 * ```
 */
export function calculateDailyRate(
  date: Date | string,
  config: PricingConfig
): { rate: number; type: 'weekday' | 'weekend' | 'holiday' } {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const { baseRate, weekendMultiplier = 1.0, holidayMultiplier = 1.25 } = config;

  if (isHoliday(dateObj)) {
    return { rate: Math.round(baseRate * holidayMultiplier), type: 'holiday' };
  }

  if (isWeekend(dateObj)) {
    return { rate: Math.round(baseRate * weekendMultiplier), type: 'weekend' };
  }

  return { rate: baseRate, type: 'weekday' };
}

/**
 * Calculates complete price breakdown for a booking
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param config - Pricing configuration
 * @param guestCount - Number of guests
 * @param hasPets - Whether pets are included
 * @returns Complete price breakdown
 *
 * @example
 * ```ts
 * calculateBookingPrice(
 *   '2026-01-17',
 *   '2026-01-20',
 *   { baseRate: 150, cleaningFee: 100, serviceFeePercent: 10, taxRate: 8 },
 *   2
 * )
 * ```
 */
export function calculateBookingPrice(
  checkIn: Date | string,
  checkOut: Date | string,
  config: PricingConfig,
  guestCount: number = 1,
  hasPets: boolean = false
): PriceBreakdown {
  const startDate = typeof checkIn === 'string' ? parseISO(checkIn) : checkIn;
  const endDate = typeof checkOut === 'string' ? parseISO(checkOut) : checkOut;

  const nights = differenceInDays(endDate, startDate);
  const dates = eachDayOfInterval({ start: startDate, end: addDays(endDate, -1) });

  // Calculate nightly breakdown
  const nightlyBreakdown = dates.map((date) => {
    const { rate, type } = calculateDailyRate(date, config);
    return {
      date: format(date, 'yyyy-MM-dd'),
      rate,
      type,
    };
  });

  const accommodationTotal = nightlyBreakdown.reduce((sum, night) => sum + night.rate, 0);

  // Calculate discounts
  const weeklyDiscount = nights >= 7 && config.weeklyDiscount
    ? Math.round(accommodationTotal * (config.weeklyDiscount / 100))
    : 0;

  const monthlyDiscount = nights >= 28 && config.monthlyDiscount
    ? Math.round(accommodationTotal * (config.monthlyDiscount / 100))
    : 0;

  // Apply only the larger discount
  const discount = Math.max(weeklyDiscount, monthlyDiscount);
  const finalWeeklyDiscount = discount === weeklyDiscount && nights >= 7 && nights < 28 ? discount : 0;
  const finalMonthlyDiscount = discount === monthlyDiscount && nights >= 28 ? discount : 0;

  // Extra guest fees
  const baseGuests = config.baseGuests || 2;
  const extraGuests = Math.max(0, guestCount - baseGuests);
  const extraGuestFees = extraGuests * (config.extraGuestFee || 0) * nights;

  // Pet fee
  const petFee = hasPets ? (config.petFee || 0) : 0;

  // Cleaning fee
  const cleaningFee = config.cleaningFee;

  // Subtotal before service fee and taxes
  const subtotal = accommodationTotal - discount + extraGuestFees + petFee + cleaningFee;

  // Service fee (typically charged to guest)
  const serviceFee = config.serviceFeePercent
    ? Math.round(subtotal * (config.serviceFeePercent / 100))
    : 0;

  // Taxes
  const taxes = config.taxRate
    ? Math.round((subtotal + serviceFee) * (config.taxRate / 100))
    : 0;

  // Total
  const total = subtotal + serviceFee + taxes;

  return {
    nights,
    nightlyBreakdown,
    accommodationTotal,
    weeklyDiscount: finalWeeklyDiscount,
    monthlyDiscount: finalMonthlyDiscount,
    extraGuestFees,
    petFee,
    cleaningFee,
    subtotal,
    serviceFee,
    taxes,
    total,
  };
}

/**
 * Calculates average nightly rate from a price breakdown
 * @param breakdown - Price breakdown
 * @returns Average nightly rate
 */
export function calculateAverageNightlyRate(breakdown: PriceBreakdown): number {
  if (breakdown.nights === 0) return 0;
  const netAccommodation = breakdown.accommodationTotal - breakdown.weeklyDiscount - breakdown.monthlyDiscount;
  return Math.round(netAccommodation / breakdown.nights);
}

// ============================================
// AVAILABILITY CALCULATIONS
// ============================================

/**
 * Booking for availability checking
 */
export interface BookingPeriod {
  id: string;
  checkIn: Date | string;
  checkOut: Date | string;
  status?: string;
}

/**
 * Availability result for a single day
 */
export interface DayAvailability {
  date: string;
  available: boolean;
  reason?: 'booked' | 'blocked' | 'past' | 'minimum_stay';
  bookingId?: string;
}

/**
 * Checks if a date range overlaps with any existing bookings
 * @param checkIn - Requested check-in date
 * @param checkOut - Requested check-out date
 * @param existingBookings - Array of existing bookings
 * @param excludeBookingId - Booking ID to exclude (for modifications)
 * @returns Array of conflicting bookings
 *
 * @example
 * ```ts
 * const conflicts = findConflictingBookings(
 *   '2026-01-17',
 *   '2026-01-20',
 *   existingBookings
 * );
 * ```
 */
export function findConflictingBookings(
  checkIn: Date | string,
  checkOut: Date | string,
  existingBookings: BookingPeriod[],
  excludeBookingId?: string
): BookingPeriod[] {
  const requestedStart = typeof checkIn === 'string' ? parseISO(checkIn) : checkIn;
  const requestedEnd = typeof checkOut === 'string' ? parseISO(checkOut) : checkOut;

  return existingBookings.filter((booking) => {
    if (excludeBookingId && booking.id === excludeBookingId) return false;
    if (booking.status === 'CANCELLED') return false;

    const bookingStart = typeof booking.checkIn === 'string' ? parseISO(booking.checkIn) : booking.checkIn;
    const bookingEnd = typeof booking.checkOut === 'string' ? parseISO(booking.checkOut) : booking.checkOut;

    // Check for overlap (checkout day = checkin day is allowed)
    return isBefore(requestedStart, bookingEnd) && isAfter(requestedEnd, bookingStart);
  });
}

/**
 * Checks if a date range is available
 * @param checkIn - Requested check-in date
 * @param checkOut - Requested check-out date
 * @param existingBookings - Array of existing bookings
 * @param excludeBookingId - Booking ID to exclude
 * @returns Whether the date range is available
 */
export function isDateRangeAvailable(
  checkIn: Date | string,
  checkOut: Date | string,
  existingBookings: BookingPeriod[],
  excludeBookingId?: string
): boolean {
  return findConflictingBookings(checkIn, checkOut, existingBookings, excludeBookingId).length === 0;
}

/**
 * Gets availability for each day in a date range
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @param existingBookings - Array of existing bookings
 * @returns Array of day availability objects
 */
export function getAvailabilityCalendar(
  startDate: Date | string,
  endDate: Date | string,
  existingBookings: BookingPeriod[]
): DayAvailability[] {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  const today = startOfDay(new Date());

  const dates = eachDayOfInterval({ start, end });

  return dates.map((date) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    // Check if date is in the past
    if (isBefore(date, today)) {
      return { date: dateStr, available: false, reason: 'past' as const };
    }

    // Check for existing bookings
    for (const booking of existingBookings) {
      if (booking.status === 'CANCELLED') continue;

      const bookingStart = typeof booking.checkIn === 'string' ? parseISO(booking.checkIn) : booking.checkIn;
      const bookingEnd = typeof booking.checkOut === 'string' ? parseISO(booking.checkOut) : booking.checkOut;

      // Date is booked if it falls between check-in (inclusive) and check-out (exclusive)
      if (
        (isAfter(date, bookingStart) || isSameDay(date, bookingStart)) &&
        isBefore(date, bookingEnd)
      ) {
        return { date: dateStr, available: false, reason: 'booked' as const, bookingId: booking.id };
      }
    }

    return { date: dateStr, available: true };
  });
}

/**
 * Finds the next available check-in date
 * @param fromDate - Date to start searching from
 * @param existingBookings - Array of existing bookings
 * @param maxDaysAhead - Maximum days to search ahead
 * @returns Next available date or null
 */
export function findNextAvailableDate(
  fromDate: Date | string,
  existingBookings: BookingPeriod[],
  maxDaysAhead: number = 365
): Date | null {
  const start = typeof fromDate === 'string' ? parseISO(fromDate) : fromDate;
  const endSearch = addDays(start, maxDaysAhead);
  const calendar = getAvailabilityCalendar(start, endSearch, existingBookings);

  const firstAvailable = calendar.find((day) => day.available);
  return firstAvailable ? parseISO(firstAvailable.date) : null;
}

// ============================================
// OCCUPANCY CALCULATIONS
// ============================================

/**
 * Calculates occupancy rate for a period
 * @param bookings - Array of bookings in the period
 * @param startDate - Period start date
 * @param endDate - Period end date
 * @returns Occupancy rate (0-100)
 *
 * @example
 * ```ts
 * calculateOccupancyRate(bookings, '2026-01-01', '2026-01-31')
 * // 75.5 (75.5% occupancy)
 * ```
 */
export function calculateOccupancyRate(
  bookings: BookingPeriod[],
  startDate: Date | string,
  endDate: Date | string
): number {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  const totalDays = differenceInDays(end, start) + 1;

  if (totalDays <= 0) return 0;

  let bookedDays = 0;
  const dates = eachDayOfInterval({ start, end });

  for (const date of dates) {
    for (const booking of bookings) {
      if (booking.status === 'CANCELLED') continue;

      const bookingStart = typeof booking.checkIn === 'string' ? parseISO(booking.checkIn) : booking.checkIn;
      const bookingEnd = typeof booking.checkOut === 'string' ? parseISO(booking.checkOut) : booking.checkOut;

      if (
        (isAfter(date, bookingStart) || isSameDay(date, bookingStart)) &&
        isBefore(date, bookingEnd)
      ) {
        bookedDays++;
        break;
      }
    }
  }

  return Math.round((bookedDays / totalDays) * 1000) / 10; // Round to 1 decimal
}

/**
 * Calculates RevPAR (Revenue Per Available Room/Night)
 * @param totalRevenue - Total revenue for the period
 * @param totalNights - Total nights available in the period
 * @returns RevPAR value
 */
export function calculateRevPAR(totalRevenue: number, totalNights: number): number {
  if (totalNights === 0) return 0;
  return Math.round((totalRevenue / totalNights) * 100) / 100;
}

/**
 * Calculates ADR (Average Daily Rate) for actual bookings
 * @param totalRevenue - Total revenue from bookings
 * @param bookedNights - Total nights that were booked
 * @returns ADR value
 */
export function calculateADR(totalRevenue: number, bookedNights: number): number {
  if (bookedNights === 0) return 0;
  return Math.round((totalRevenue / bookedNights) * 100) / 100;
}

// ============================================
// CLEANER METRICS CALCULATIONS
// ============================================

/**
 * Cleaning job for metrics calculation
 */
export interface CleaningJobMetrics {
  id: string;
  status: string;
  scheduledAt: Date | string;
  completedAt?: Date | string;
  durationMins?: number;
  score?: number;
  estimatedDuration?: number;
}

/**
 * Calculates cleaner performance metrics
 * @param jobs - Array of cleaning jobs
 * @returns Performance metrics
 */
export function calculateCleanerMetrics(jobs: CleaningJobMetrics[]): {
  totalJobs: number;
  completedJobs: number;
  completionRate: number;
  avgScore: number;
  avgDuration: number;
  onTimeRate: number;
} {
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED' || j.status === 'VERIFIED');
  const jobsWithScore = completedJobs.filter((j) => j.score != null);
  const jobsWithDuration = completedJobs.filter((j) => j.durationMins != null);

  const totalJobs = jobs.length;
  const completedCount = completedJobs.length;
  const completionRate = totalJobs > 0 ? Math.round((completedCount / totalJobs) * 100) : 0;

  const avgScore = jobsWithScore.length > 0
    ? Math.round(jobsWithScore.reduce((sum, j) => sum + (j.score || 0), 0) / jobsWithScore.length)
    : 0;

  const avgDuration = jobsWithDuration.length > 0
    ? Math.round(jobsWithDuration.reduce((sum, j) => sum + (j.durationMins || 0), 0) / jobsWithDuration.length)
    : 0;

  // On-time is completing within estimated duration + 15 minute buffer
  const jobsWithEstimate = completedJobs.filter((j) => j.estimatedDuration != null && j.durationMins != null);
  const onTimeJobs = jobsWithEstimate.filter(
    (j) => (j.durationMins || 0) <= (j.estimatedDuration || 0) + 15
  );
  const onTimeRate = jobsWithEstimate.length > 0
    ? Math.round((onTimeJobs.length / jobsWithEstimate.length) * 100)
    : 100;

  return {
    totalJobs,
    completedJobs: completedCount,
    completionRate,
    avgScore,
    avgDuration,
    onTimeRate,
  };
}

/**
 * Calculates points for cleaner leaderboard
 * @param metrics - Cleaner metrics
 * @returns Total points
 */
export function calculateCleanerPoints(metrics: {
  completedJobs: number;
  avgScore: number;
  onTimeRate: number;
}): number {
  // Points formula:
  // - 10 points per completed job
  // - Bonus based on average score (0-50 points)
  // - Bonus based on on-time rate (0-30 points)
  const jobPoints = metrics.completedJobs * 10;
  const scoreBonus = Math.round((metrics.avgScore / 100) * 50);
  const onTimeBonus = Math.round((metrics.onTimeRate / 100) * 30);

  return jobPoints + scoreBonus + onTimeBonus;
}

// ============================================
// GPS VERIFICATION CALCULATIONS
// ============================================

/**
 * Calculates distance between two coordinates using Haversine formula
 * @param lat1 - First latitude
 * @param lon1 - First longitude
 * @param lat2 - Second latitude
 * @param lon2 - Second longitude
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Verifies GPS check-in is within acceptable radius
 * @param checkInLat - Check-in latitude
 * @param checkInLon - Check-in longitude
 * @param propertyLat - Property latitude
 * @param propertyLon - Property longitude
 * @param maxRadius - Maximum allowed radius in meters (default 100)
 * @returns Verification result
 */
export function verifyGpsCheckIn(
  checkInLat: number,
  checkInLon: number,
  propertyLat: number,
  propertyLon: number,
  maxRadius: number = 100
): { verified: boolean; distance: number } {
  const distance = calculateDistance(checkInLat, checkInLon, propertyLat, propertyLon);
  return {
    verified: distance <= maxRadius,
    distance: Math.round(distance),
  };
}

// ============================================
// FINANCIAL CALCULATIONS
// ============================================

/**
 * Calculates net income from gross and expenses
 * @param grossIncome - Total gross income
 * @param expenses - Total expenses
 * @returns Net income and margin
 */
export function calculateNetIncome(
  grossIncome: number,
  expenses: number
): { net: number; margin: number } {
  const net = grossIncome - expenses;
  const margin = grossIncome > 0 ? Math.round((net / grossIncome) * 1000) / 10 : 0;
  return { net, margin };
}

/**
 * Calculates ROI (Return on Investment)
 * @param netIncome - Net income
 * @param investment - Total investment/cost basis
 * @returns ROI percentage
 */
export function calculateROI(netIncome: number, investment: number): number {
  if (investment === 0) return 0;
  return Math.round((netIncome / investment) * 1000) / 10;
}

/**
 * Calculates period-over-period change
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Change amount and percentage
 */
export function calculateChange(
  current: number,
  previous: number
): { amount: number; percentage: number } {
  const amount = current - previous;
  const percentage = previous !== 0 ? Math.round((amount / previous) * 1000) / 10 : 0;
  return { amount, percentage };
}
