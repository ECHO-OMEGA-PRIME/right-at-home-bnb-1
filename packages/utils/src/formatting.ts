/**
 * Right at Home BnB - Formatting Utilities
 * Functions for formatting dates, currency, addresses, and other display values
 * @packageDocumentation
 */

import {
  format,
  formatDistance,
  formatRelative,
  parseISO,
  isValid,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  addDays,
  startOfDay,
  endOfDay,
  isSameDay,
  isWithinInterval,
} from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

// ============================================
// DATE FORMATTING
// ============================================

/** Default timezone for the application (Midland, TX) */
const DEFAULT_TIMEZONE = 'America/Chicago';

/**
 * Formats a date for display
 * @param date - Date to format (Date, string, or timestamp)
 * @param formatStr - Format string (date-fns format)
 * @param timezone - Timezone (defaults to America/Chicago)
 * @returns Formatted date string
 *
 * @example
 * ```ts
 * formatDate(new Date(), 'MMM d, yyyy') // "Jan 17, 2026"
 * formatDate('2026-01-17', 'EEEE, MMMM d') // "Friday, January 17"
 * ```
 */
export function formatDate(
  date: Date | string | number,
  formatStr: string = 'MMM d, yyyy',
  timezone: string = DEFAULT_TIMEZONE
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  if (!isValid(dateObj)) {
    return 'Invalid date';
  }
  return formatInTimeZone(dateObj, timezone, formatStr);
}

/**
 * Formats a date and time for display
 * @param date - Date to format
 * @param timezone - Timezone (defaults to America/Chicago)
 * @returns Formatted date and time string
 *
 * @example
 * ```ts
 * formatDateTime(new Date()) // "Jan 17, 2026 at 3:30 PM"
 * ```
 */
export function formatDateTime(
  date: Date | string | number,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatDate(date, "MMM d, yyyy 'at' h:mm a", timezone);
}

/**
 * Formats just the time portion
 * @param date - Date to format
 * @param timezone - Timezone
 * @returns Formatted time string
 *
 * @example
 * ```ts
 * formatTime(new Date()) // "3:30 PM"
 * ```
 */
export function formatTime(
  date: Date | string | number,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatDate(date, 'h:mm a', timezone);
}

/**
 * Formats a date range (check-in to check-out)
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param options - Formatting options
 * @returns Formatted date range string
 *
 * @example
 * ```ts
 * formatDateRange('2026-01-17', '2026-01-20') // "Jan 17 - 20, 2026"
 * formatDateRange('2026-01-17', '2026-02-05') // "Jan 17 - Feb 5, 2026"
 * ```
 */
export function formatDateRange(
  checkIn: Date | string,
  checkOut: Date | string,
  options: { includeYear?: boolean; separator?: string } = {}
): string {
  const { includeYear = true, separator = ' - ' } = options;
  const start = typeof checkIn === 'string' ? parseISO(checkIn) : checkIn;
  const end = typeof checkOut === 'string' ? parseISO(checkOut) : checkOut;

  if (!isValid(start) || !isValid(end)) {
    return 'Invalid dates';
  }

  const startMonth = format(start, 'MMM');
  const endMonth = format(end, 'MMM');
  const startDay = format(start, 'd');
  const endDay = format(end, 'd');
  const year = format(end, 'yyyy');

  if (startMonth === endMonth) {
    return includeYear
      ? `${startMonth} ${startDay}${separator}${endDay}, ${year}`
      : `${startMonth} ${startDay}${separator}${endDay}`;
  }

  return includeYear
    ? `${startMonth} ${startDay}${separator}${endMonth} ${endDay}, ${year}`
    : `${startMonth} ${startDay}${separator}${endMonth} ${endDay}`;
}

/**
 * Returns a relative time description
 * @param date - Date to describe
 * @param baseDate - Base date for comparison (defaults to now)
 * @returns Relative time string
 *
 * @example
 * ```ts
 * formatRelativeTime(yesterday) // "yesterday"
 * formatRelativeTime(hourAgo) // "about 1 hour ago"
 * ```
 */
export function formatRelativeTime(
  date: Date | string | number,
  baseDate: Date = new Date()
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  if (!isValid(dateObj)) {
    return 'Invalid date';
  }
  return formatDistance(dateObj, baseDate, { addSuffix: true });
}

/**
 * Calculates and formats the duration of a stay
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Number of nights and formatted string
 *
 * @example
 * ```ts
 * formatStayDuration('2026-01-17', '2026-01-20') // { nights: 3, formatted: "3 nights" }
 * ```
 */
export function formatStayDuration(
  checkIn: Date | string,
  checkOut: Date | string
): { nights: number; formatted: string } {
  const start = typeof checkIn === 'string' ? parseISO(checkIn) : checkIn;
  const end = typeof checkOut === 'string' ? parseISO(checkOut) : checkOut;
  const nights = differenceInDays(end, start);
  return {
    nights,
    formatted: `${nights} night${nights !== 1 ? 's' : ''}`,
  };
}

/**
 * Formats a duration in minutes to human-readable
 * @param minutes - Duration in minutes
 * @returns Formatted duration string
 *
 * @example
 * ```ts
 * formatDuration(90) // "1h 30m"
 * formatDuration(45) // "45m"
 * ```
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ============================================
// CURRENCY FORMATTING
// ============================================

/** Currency formatter for USD */
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Currency formatter for whole dollars */
const usdWholeFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Formats a number as USD currency
 * @param amount - Amount to format
 * @param options - Formatting options
 * @returns Formatted currency string
 *
 * @example
 * ```ts
 * formatCurrency(1234.56) // "$1,234.56"
 * formatCurrency(1234.56, { wholeDollars: true }) // "$1,235"
 * formatCurrency(-500) // "-$500"
 * ```
 */
export function formatCurrency(
  amount: number,
  options: { wholeDollars?: boolean; showPlus?: boolean } = {}
): string {
  const { wholeDollars = false, showPlus = false } = options;
  const formatter = wholeDollars ? usdWholeFormatter : usdFormatter;
  const formatted = formatter.format(Math.abs(amount));

  if (amount < 0) {
    return `-${formatted}`;
  }
  if (showPlus && amount > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

/**
 * Formats a nightly rate with "/night" suffix
 * @param rate - Nightly rate
 * @returns Formatted rate string
 *
 * @example
 * ```ts
 * formatNightlyRate(150) // "$150/night"
 * ```
 */
export function formatNightlyRate(rate: number): string {
  return `${formatCurrency(rate, { wholeDollars: true })}/night`;
}

/**
 * Formats a percentage
 * @param value - Value to format (0-100 or 0-1)
 * @param options - Formatting options
 * @returns Formatted percentage string
 *
 * @example
 * ```ts
 * formatPercentage(85.5) // "85.5%"
 * formatPercentage(0.855, { isDecimal: true }) // "85.5%"
 * formatPercentage(100, { showPlus: true }) // "+100%"
 * ```
 */
export function formatPercentage(
  value: number,
  options: { decimals?: number; isDecimal?: boolean; showPlus?: boolean } = {}
): string {
  const { decimals = 1, isDecimal = false, showPlus = false } = options;
  const percentage = isDecimal ? value * 100 : value;
  const formatted = percentage.toFixed(decimals).replace(/\.0+$/, '');

  if (showPlus && percentage > 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Formats a compact number (1K, 1M, etc.)
 * @param value - Number to format
 * @returns Formatted compact string
 *
 * @example
 * ```ts
 * formatCompactNumber(1234) // "1.2K"
 * formatCompactNumber(1234567) // "1.2M"
 * ```
 */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

// ============================================
// ADDRESS FORMATTING
// ============================================

/**
 * Address components
 */
export interface AddressComponents {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

/**
 * Formats an address for display
 * @param components - Address components
 * @param format - Format type
 * @returns Formatted address string
 *
 * @example
 * ```ts
 * formatAddress({ street: '123 Main St', city: 'Midland', state: 'TX', zipCode: '79701' })
 * // "123 Main St, Midland, TX 79701"
 *
 * formatAddress({ city: 'Midland', state: 'TX' }, 'short')
 * // "Midland, TX"
 * ```
 */
export function formatAddress(
  components: AddressComponents,
  format: 'full' | 'short' | 'oneLine' = 'full'
): string {
  const { street, city, state, zipCode, country } = components;

  switch (format) {
    case 'short':
      return [city, state].filter(Boolean).join(', ');

    case 'oneLine':
      return [street, city, state, zipCode, country].filter(Boolean).join(', ');

    case 'full':
    default:
      const line1 = street || '';
      const line2 = [city, state].filter(Boolean).join(', ');
      const line3 = [zipCode, country].filter(Boolean).join(' ');
      return [line1, line2, line3].filter(Boolean).join(', ');
  }
}

/**
 * Formats coordinates for display
 * @param lat - Latitude
 * @param lng - Longitude
 * @param precision - Decimal places
 * @returns Formatted coordinates string
 *
 * @example
 * ```ts
 * formatCoordinates(31.9973, -102.0779) // "31.9973, -102.0779"
 * ```
 */
export function formatCoordinates(
  lat: number,
  lng: number,
  precision: number = 4
): string {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}

// ============================================
// PHONE NUMBER FORMATTING
// ============================================

/**
 * Formats a phone number for display
 * @param phone - Phone number (digits only or with formatting)
 * @returns Formatted phone number
 *
 * @example
 * ```ts
 * formatPhoneNumber('4325551234') // "(432) 555-1234"
 * formatPhoneNumber('+14325551234') // "+1 (432) 555-1234"
 * ```
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Check for country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Standard 10-digit US number
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Return as-is if not recognized
  return phone;
}

// ============================================
// NAME FORMATTING
// ============================================

/**
 * Gets initials from a name
 * @param name - Full name
 * @returns Initials (up to 2 characters)
 *
 * @example
 * ```ts
 * getInitials('John Doe') // "JD"
 * getInitials('Alice') // "A"
 * getInitials('John Michael Doe') // "JD"
 * ```
 */
export function getInitials(name: string): string {
  if (!name) return '';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Formats a name with title case
 * @param name - Name to format
 * @returns Title-cased name
 *
 * @example
 * ```ts
 * formatName('john doe') // "John Doe"
 * formatName('JANE SMITH') // "Jane Smith"
 * ```
 */
export function formatName(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================
// STATUS FORMATTING
// ============================================

/**
 * Status display configuration
 */
export interface StatusDisplay {
  label: string;
  color: string;
  bgColor: string;
  icon?: string;
}

/** Booking status display mapping */
export const BOOKING_STATUS_DISPLAY: Record<string, StatusDisplay> = {
  PENDING: { label: 'Pending', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: 'clock' },
  CONFIRMED: { label: 'Confirmed', color: 'text-green-700', bgColor: 'bg-green-100', icon: 'check' },
  CHECKED_IN: { label: 'Checked In', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: 'home' },
  CHECKED_OUT: { label: 'Checked Out', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: 'logout' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100', icon: 'x' },
  NO_SHOW: { label: 'No Show', color: 'text-red-700', bgColor: 'bg-red-100', icon: 'alert' },
};

/** Cleaning job status display mapping */
export const CLEANING_STATUS_DISPLAY: Record<string, StatusDisplay> = {
  SCHEDULED: { label: 'Scheduled', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: 'calendar' },
  ASSIGNED: { label: 'Assigned', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: 'user' },
  EN_ROUTE: { label: 'En Route', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: 'navigation' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: 'refresh' },
  COMPLETED: { label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-100', icon: 'check' },
  VERIFIED: { label: 'Verified', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: 'badge-check' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100', icon: 'x' },
};

/** Property status display mapping */
export const PROPERTY_STATUS_DISPLAY: Record<string, StatusDisplay> = {
  ACTIVE: { label: 'Active', color: 'text-green-700', bgColor: 'bg-green-100', icon: 'check-circle' },
  INACTIVE: { label: 'Inactive', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: 'pause' },
  MAINTENANCE: { label: 'Maintenance', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: 'tool' },
};

/**
 * Gets the display configuration for a status
 * @param status - Status value
 * @param type - Status type (booking, cleaning, property)
 * @returns Status display configuration
 *
 * @example
 * ```ts
 * getStatusDisplay('CONFIRMED', 'booking') // { label: 'Confirmed', color: '...', ... }
 * ```
 */
export function getStatusDisplay(
  status: string,
  type: 'booking' | 'cleaning' | 'property'
): StatusDisplay {
  const displayMap = {
    booking: BOOKING_STATUS_DISPLAY,
    cleaning: CLEANING_STATUS_DISPLAY,
    property: PROPERTY_STATUS_DISPLAY,
  }[type];

  return displayMap[status] || { label: status, color: 'text-gray-700', bgColor: 'bg-gray-100' };
}

// ============================================
// RATING FORMATTING
// ============================================

/**
 * Formats a rating for display
 * @param rating - Rating value (typically 0-5)
 * @param options - Formatting options
 * @returns Formatted rating string
 *
 * @example
 * ```ts
 * formatRating(4.5) // "4.5"
 * formatRating(4.567, { decimals: 2 }) // "4.57"
 * formatRating(4.5, { showMax: true }) // "4.5/5"
 * ```
 */
export function formatRating(
  rating: number,
  options: { decimals?: number; showMax?: boolean; max?: number } = {}
): string {
  const { decimals = 1, showMax = false, max = 5 } = options;
  const formatted = rating.toFixed(decimals);
  return showMax ? `${formatted}/${max}` : formatted;
}

/**
 * Gets star representation for a rating
 * @param rating - Rating value (0-5)
 * @returns Object with full, half, and empty star counts
 *
 * @example
 * ```ts
 * getStarRating(4.5) // { full: 4, half: 1, empty: 0 }
 * getStarRating(3.2) // { full: 3, half: 0, empty: 2 }
 * ```
 */
export function getStarRating(rating: number): { full: number; half: number; empty: number } {
  const full = Math.floor(rating);
  const decimal = rating - full;
  const half = decimal >= 0.25 && decimal < 0.75 ? 1 : 0;
  const extraFull = decimal >= 0.75 ? 1 : 0;
  const totalFull = full + extraFull;
  const empty = 5 - totalFull - half;

  return { full: totalFull, half, empty };
}

// ============================================
// WIFI INFO FORMATTING
// ============================================

/**
 * Formats WiFi credentials for display or sharing
 * @param network - Network name (SSID)
 * @param password - Network password
 * @param format - Output format
 * @returns Formatted WiFi info
 *
 * @example
 * ```ts
 * formatWifiCredentials('GuestWifi', 'password123', 'text')
 * // "Network: GuestWifi\nPassword: password123"
 *
 * formatWifiCredentials('GuestWifi', 'password123', 'qr')
 * // "WIFI:T:WPA;S:GuestWifi;P:password123;;"
 * ```
 */
export function formatWifiCredentials(
  network: string,
  password: string,
  format: 'text' | 'qr' = 'text'
): string {
  if (format === 'qr') {
    // QR code format for WiFi
    return `WIFI:T:WPA;S:${network};P:${password};;`;
  }
  return `Network: ${network}\nPassword: ${password}`;
}
