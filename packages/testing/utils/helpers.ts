/**
 * Test Helpers for RightAtHomeBnB
 * Common utility functions for testing
 */

import { vi, expect } from 'vitest';

// ============================================
// DATE HELPERS
// ============================================

/**
 * Get a date N days from now
 */
export function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Get a date N days ago
 */
export function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return formatDate(date1) === formatDate(date2);
}

/**
 * Calculate nights between two dates
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((checkOut.getTime() - checkIn.getTime()) / msPerDay);
}

// ============================================
// PRICING HELPERS
// ============================================

/**
 * Calculate booking subtotal
 */
export function calculateSubtotal(nightlyRate: number, nights: number): number {
  return Math.round(nightlyRate * nights * 100) / 100;
}

/**
 * Calculate service fee (typically 10-12% of subtotal)
 */
export function calculateServiceFee(subtotal: number, rate: number = 0.10): number {
  return Math.round(subtotal * rate * 100) / 100;
}

/**
 * Calculate taxes (Texas occupancy tax varies, using 8.25% as example)
 */
export function calculateTaxes(subtotal: number, cleaningFee: number, rate: number = 0.0825): number {
  return Math.round((subtotal + cleaningFee) * rate * 100) / 100;
}

/**
 * Calculate total booking price
 */
export function calculateTotal(
  nightlyRate: number,
  nights: number,
  cleaningFee: number,
  serviceFeeRate: number = 0.10,
  taxRate: number = 0.0825
): {
  subtotal: number;
  serviceFee: number;
  taxes: number;
  total: number;
} {
  const subtotal = calculateSubtotal(nightlyRate, nights);
  const serviceFee = calculateServiceFee(subtotal, serviceFeeRate);
  const taxes = calculateTaxes(subtotal, cleaningFee, taxRate);
  const total = Math.round((subtotal + cleaningFee + serviceFee + taxes) * 100) / 100;

  return { subtotal, serviceFee, taxes, total };
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (US)
 */
export function isValidPhone(phone: string): boolean {
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits[0] === '1');
}

/**
 * Validate ZIP code format
 */
export function isValidZipCode(zip: string): boolean {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zip);
}

/**
 * Validate date range (checkIn must be before checkOut)
 */
export function isValidDateRange(checkIn: Date, checkOut: Date): boolean {
  return checkIn < checkOut;
}

/**
 * Validate guest count doesn't exceed max
 */
export function isValidGuestCount(guests: number, maxGuests: number): boolean {
  return guests > 0 && guests <= maxGuests;
}

// ============================================
// ASYNC HELPERS
// ============================================

/**
 * Wait for specified milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 100
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        await wait(baseDelay * Math.pow(2, attempt));
      }
    }
  }

  throw lastError!;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

// ============================================
// MOCK HELPERS
// ============================================

/**
 * Create a mock API response
 */
export function createMockResponse<T>(data: T, options: { success?: boolean; error?: string } = {}) {
  return {
    success: options.success ?? true,
    data: options.success !== false ? data : undefined,
    error: options.error
  };
}

/**
 * Create a mock paginated response
 */
export function createMockPaginatedResponse<T>(
  data: T[],
  options: { page?: number; limit?: number; total?: number } = {}
) {
  const { page = 1, limit = 10, total = data.length } = options;
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

// ============================================
// ASSERTION HELPERS
// ============================================

/**
 * Assert that a value is within a range
 */
export function expectInRange(value: number, min: number, max: number): void {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

/**
 * Assert that an array contains no duplicates
 */
export function expectNoDuplicates<T>(arr: T[], keyFn?: (item: T) => unknown): void {
  const seen = new Set();
  for (const item of arr) {
    const key = keyFn ? keyFn(item) : item;
    expect(seen.has(key)).toBe(false);
    seen.add(key);
  }
}

/**
 * Assert that dates are in order
 */
export function expectDatesInOrder(...dates: Date[]): void {
  for (let i = 1; i < dates.length; i++) {
    expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i - 1].getTime());
  }
}

/**
 * Assert that a booking total is correctly calculated
 */
export function expectCorrectBookingTotal(
  booking: {
    nightlyRate: number;
    nights: number;
    cleaningFee: number;
    serviceFee: number;
    taxes: number;
    total: number;
  },
  tolerance: number = 0.01
): void {
  const expectedSubtotal = booking.nightlyRate * booking.nights;
  const expectedTotal = expectedSubtotal + booking.cleaningFee + booking.serviceFee + booking.taxes;
  expect(Math.abs(booking.total - expectedTotal)).toBeLessThanOrEqual(tolerance);
}

// ============================================
// ID GENERATION
// ============================================

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a CUID-like ID
 */
export function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 9);
  return `c${timestamp}${random}`;
}

// ============================================
// DATA COMPARISON
// ============================================

/**
 * Deep compare two objects (ignoring specified keys)
 */
export function deepEqual<T extends object>(
  obj1: T,
  obj2: T,
  ignoreKeys: (keyof T)[] = []
): boolean {
  const keys1 = Object.keys(obj1).filter(k => !ignoreKeys.includes(k as keyof T));
  const keys2 = Object.keys(obj2).filter(k => !ignoreKeys.includes(k as keyof T));

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    const val1 = (obj1 as Record<string, unknown>)[key];
    const val2 = (obj2 as Record<string, unknown>)[key];

    if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
      if (!deepEqual(val1 as object, val2 as object, [])) return false;
    } else if (val1 !== val2) {
      return false;
    }
  }

  return true;
}
