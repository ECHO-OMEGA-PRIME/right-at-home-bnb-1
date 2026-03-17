/**
 * Right at Home BnB - Date Utilities
 * All dates operate in CST (America/Chicago) for Midland, TX.
 */

const CST_TIMEZONE = 'America/Chicago';

/**
 * Get the current time as a Date object representing CST.
 * Note: The returned Date still has a UTC internal representation,
 * but the value corresponds to "now" in CST.
 */
export function nowCST(): Date {
  const now = new Date();
  const cstString = now.toLocaleString('en-US', { timeZone: CST_TIMEZONE });
  return new Date(cstString);
}

/**
 * Coerce a Date | string into a Date object.
 */
function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

/**
 * Format a date as "Mar 17, 2026".
 */
export function formatDate(date: Date | string): string {
  const d = toDate(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: CST_TIMEZONE,
  });
}

/**
 * Format a date+time as "Mar 17, 2026 2:30 PM".
 */
export function formatDateTime(date: Date | string): string {
  const d = toDate(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: CST_TIMEZONE,
  });
}

/**
 * Calculate the number of calendar days between two dates.
 * Always returns a non-negative integer.
 */
export function daysBetween(start: Date | string, end: Date | string): number {
  const s = startOfDay(toDate(start));
  const e = startOfDay(toDate(end));
  const diffMs = Math.abs(e.getTime() - s.getTime());
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate the number of nights between check-in and check-out.
 * Identical to daysBetween for standard bookings (check-out date minus check-in date).
 */
export function nightsBetween(checkIn: Date | string, checkOut: Date | string): number {
  const s = startOfDay(toDate(checkIn));
  const e = startOfDay(toDate(checkOut));
  const diffMs = e.getTime() - s.getTime();
  if (diffMs < 0) return 0;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date falls within a range (inclusive on both ends).
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const d = startOfDay(date).getTime();
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return d >= s && d <= e;
}

/**
 * Check if two date ranges overlap.
 * Uses the standard overlap test: A.start < B.end && B.start < A.end
 */
export function dateRangesOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date }
): boolean {
  const aStart = startOfDay(a.start).getTime();
  const aEnd = startOfDay(a.end).getTime();
  const bStart = startOfDay(b.start).getTime();
  const bEnd = startOfDay(b.end).getTime();
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Add a number of days to a date. Supports negative values.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Return a new Date set to the start of the day (00:00:00.000).
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Return a new Date set to the end of the day (23:59:59.999).
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}
