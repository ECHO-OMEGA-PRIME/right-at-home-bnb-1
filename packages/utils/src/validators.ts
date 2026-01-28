/**
 * Right at Home BnB - Validation Utilities
 * Business logic validation functions
 * @packageDocumentation
 */

import { parseISO, isValid, isBefore, isAfter, differenceInDays, addDays } from 'date-fns';

// ============================================
// VALIDATION RESULT TYPES
// ============================================

/**
 * Validation result object
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Array of error messages */
  errors: string[];
  /** Field-specific error messages */
  fieldErrors?: Record<string, string[]>;
}

/**
 * Creates a successful validation result
 */
export function validResult(): ValidationResult {
  return { valid: true, errors: [] };
}

/**
 * Creates a failed validation result
 * @param errors - Error messages
 * @param fieldErrors - Field-specific errors
 */
export function invalidResult(
  errors: string[],
  fieldErrors?: Record<string, string[]>
): ValidationResult {
  return { valid: false, errors, fieldErrors };
}

/**
 * Merges multiple validation results
 * @param results - Array of validation results
 */
export function mergeValidations(...results: ValidationResult[]): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};

  for (const result of results) {
    errors.push(...result.errors);
    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(...messages);
      }
    }
  }

  return {
    valid: errors.length === 0 && Object.keys(fieldErrors).length === 0,
    errors,
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}

// ============================================
// BOOKING VALIDATION
// ============================================

/**
 * Booking input for validation
 */
export interface BookingInput {
  propertyId: string;
  guestId?: string;
  checkIn: Date | string;
  checkOut: Date | string;
  guestCount: number;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
}

/**
 * Booking validation options
 */
export interface BookingValidationOptions {
  maxGuests?: number;
  minNights?: number;
  maxNights?: number;
  minAdvanceHours?: number;
  maxAdvanceDays?: number;
  allowPastBookings?: boolean;
}

/**
 * Validates a booking request
 * @param booking - Booking input to validate
 * @param options - Validation options
 * @returns Validation result
 *
 * @example
 * ```ts
 * const result = validateBooking({
 *   propertyId: 'prop123',
 *   checkIn: '2026-01-17',
 *   checkOut: '2026-01-20',
 *   guestCount: 4
 * }, { maxGuests: 6, minNights: 2 });
 * ```
 */
export function validateBooking(
  booking: BookingInput,
  options: BookingValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};

  const {
    maxGuests = 16,
    minNights = 1,
    maxNights = 365,
    minAdvanceHours = 24,
    maxAdvanceDays = 365,
    allowPastBookings = false,
  } = options;

  // Parse dates
  const checkIn = typeof booking.checkIn === 'string' ? parseISO(booking.checkIn) : booking.checkIn;
  const checkOut = typeof booking.checkOut === 'string' ? parseISO(booking.checkOut) : booking.checkOut;
  const now = new Date();

  // Validate dates are valid
  if (!isValid(checkIn)) {
    fieldErrors.checkIn = ['Invalid check-in date'];
  }
  if (!isValid(checkOut)) {
    fieldErrors.checkOut = ['Invalid check-out date'];
  }

  if (isValid(checkIn) && isValid(checkOut)) {
    // Check-out must be after check-in
    if (!isAfter(checkOut, checkIn)) {
      fieldErrors.checkOut = ['Check-out must be after check-in'];
    }

    // Check minimum advance booking
    if (!allowPastBookings && isBefore(checkIn, addDays(now, minAdvanceHours / 24))) {
      const hoursText = minAdvanceHours >= 24 ? `${minAdvanceHours / 24} days` : `${minAdvanceHours} hours`;
      fieldErrors.checkIn = [`Check-in must be at least ${hoursText} in advance`];
    }

    // Check maximum advance booking
    if (isAfter(checkIn, addDays(now, maxAdvanceDays))) {
      fieldErrors.checkIn = [`Cannot book more than ${maxAdvanceDays} days in advance`];
    }

    // Calculate nights
    const nights = differenceInDays(checkOut, checkIn);

    // Check minimum nights
    if (nights < minNights) {
      errors.push(`Minimum stay is ${minNights} night${minNights > 1 ? 's' : ''}`);
    }

    // Check maximum nights
    if (nights > maxNights) {
      errors.push(`Maximum stay is ${maxNights} nights`);
    }
  }

  // Validate guest count
  if (booking.guestCount < 1) {
    fieldErrors.guestCount = ['At least 1 guest is required'];
  } else if (booking.guestCount > maxGuests) {
    fieldErrors.guestCount = [`Maximum ${maxGuests} guests allowed`];
  }

  // Validate property ID
  if (!booking.propertyId || booking.propertyId.trim() === '') {
    fieldErrors.propertyId = ['Property is required'];
  }

  // Validate guest info if provided
  if (booking.guestEmail && !isValidEmail(booking.guestEmail)) {
    fieldErrors.guestEmail = ['Invalid email address'];
  }

  if (booking.guestPhone && !isValidPhone(booking.guestPhone)) {
    fieldErrors.guestPhone = ['Invalid phone number'];
  }

  return {
    valid: errors.length === 0 && Object.keys(fieldErrors).length === 0,
    errors,
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}

// ============================================
// PROPERTY VALIDATION
// ============================================

/**
 * Property input for validation
 */
export interface PropertyInput {
  name: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  cleaningFee?: number;
  latitude?: number;
  longitude?: number;
}

/**
 * Validates property input
 * @param property - Property input to validate
 * @returns Validation result
 */
export function validateProperty(property: PropertyInput): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};

  // Name validation
  if (!property.name || property.name.trim().length < 3) {
    fieldErrors.name = ['Property name must be at least 3 characters'];
  } else if (property.name.length > 100) {
    fieldErrors.name = ['Property name must be less than 100 characters'];
  }

  // Address validation
  if (!property.address || property.address.trim().length < 5) {
    fieldErrors.address = ['Valid address is required'];
  }

  // Bedrooms validation
  if (property.bedrooms < 0 || property.bedrooms > 20) {
    fieldErrors.bedrooms = ['Bedrooms must be between 0 and 20'];
  }

  // Bathrooms validation
  if (property.bathrooms < 0 || property.bathrooms > 20) {
    fieldErrors.bathrooms = ['Bathrooms must be between 0 and 20'];
  }

  // Max guests validation
  if (property.maxGuests < 1) {
    fieldErrors.maxGuests = ['Must allow at least 1 guest'];
  } else if (property.maxGuests > 50) {
    fieldErrors.maxGuests = ['Maximum guests cannot exceed 50'];
  }

  // Nightly rate validation
  if (property.nightlyRate < 0) {
    fieldErrors.nightlyRate = ['Nightly rate cannot be negative'];
  } else if (property.nightlyRate > 10000) {
    fieldErrors.nightlyRate = ['Nightly rate seems too high'];
  }

  // Cleaning fee validation
  if (property.cleaningFee !== undefined && property.cleaningFee < 0) {
    fieldErrors.cleaningFee = ['Cleaning fee cannot be negative'];
  }

  // Coordinates validation
  if (property.latitude !== undefined) {
    if (property.latitude < -90 || property.latitude > 90) {
      fieldErrors.latitude = ['Invalid latitude'];
    }
  }
  if (property.longitude !== undefined) {
    if (property.longitude < -180 || property.longitude > 180) {
      fieldErrors.longitude = ['Invalid longitude'];
    }
  }

  // ZIP code validation (US format)
  if (property.zipCode && !isValidZipCode(property.zipCode)) {
    fieldErrors.zipCode = ['Invalid ZIP code'];
  }

  return {
    valid: errors.length === 0 && Object.keys(fieldErrors).length === 0,
    errors,
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}

// ============================================
// GUEST VALIDATION
// ============================================

/**
 * Guest input for validation
 */
export interface GuestInput {
  email: string;
  name: string;
  phone?: string;
}

/**
 * Validates guest input
 * @param guest - Guest input to validate
 * @returns Validation result
 */
export function validateGuest(guest: GuestInput): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  // Email validation
  if (!guest.email || !isValidEmail(guest.email)) {
    fieldErrors.email = ['Valid email address is required'];
  }

  // Name validation
  if (!guest.name || guest.name.trim().length < 2) {
    fieldErrors.name = ['Name must be at least 2 characters'];
  } else if (guest.name.length > 100) {
    fieldErrors.name = ['Name must be less than 100 characters'];
  }

  // Phone validation (optional but must be valid if provided)
  if (guest.phone && !isValidPhone(guest.phone)) {
    fieldErrors.phone = ['Invalid phone number'];
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    errors: [],
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}

// ============================================
// CLEANING JOB VALIDATION
// ============================================

/**
 * Cleaning job input for validation
 */
export interface CleaningJobInput {
  propertyId: string;
  cleanerId?: string;
  scheduledAt: Date | string;
  jobType?: string;
}

/**
 * Validates cleaning job input
 * @param job - Cleaning job input to validate
 * @returns Validation result
 */
export function validateCleaningJob(job: CleaningJobInput): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  // Property ID validation
  if (!job.propertyId || job.propertyId.trim() === '') {
    fieldErrors.propertyId = ['Property is required'];
  }

  // Scheduled time validation
  const scheduledAt = typeof job.scheduledAt === 'string' ? parseISO(job.scheduledAt) : job.scheduledAt;

  if (!isValid(scheduledAt)) {
    fieldErrors.scheduledAt = ['Valid scheduled date/time is required'];
  }

  // Job type validation
  const validJobTypes = ['TURNOVER', 'DEEP_CLEAN', 'INSPECTION', 'MAINTENANCE', 'TOUCH_UP'];
  if (job.jobType && !validJobTypes.includes(job.jobType)) {
    fieldErrors.jobType = ['Invalid job type'];
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    errors: [],
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}

// ============================================
// EXPENSE VALIDATION
// ============================================

/**
 * Expense input for validation
 */
export interface ExpenseInput {
  propertyId: string;
  category: string;
  amount: number;
  description: string;
  date: Date | string;
  vendor?: string;
}

/**
 * Validates expense input
 * @param expense - Expense input to validate
 * @returns Validation result
 */
export function validateExpense(expense: ExpenseInput): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  // Property ID validation
  if (!expense.propertyId || expense.propertyId.trim() === '') {
    fieldErrors.propertyId = ['Property is required'];
  }

  // Category validation
  const validCategories = [
    'CLEANING', 'MAINTENANCE', 'UTILITIES', 'SUPPLIES', 'MARKETING',
    'INSURANCE', 'TAXES', 'MORTGAGE', 'HOA', 'PROFESSIONAL_SERVICES', 'OTHER'
  ];
  if (!expense.category || !validCategories.includes(expense.category)) {
    fieldErrors.category = ['Valid category is required'];
  }

  // Amount validation
  if (expense.amount <= 0) {
    fieldErrors.amount = ['Amount must be greater than 0'];
  } else if (expense.amount > 1000000) {
    fieldErrors.amount = ['Amount seems too high'];
  }

  // Description validation
  if (!expense.description || expense.description.trim().length < 3) {
    fieldErrors.description = ['Description must be at least 3 characters'];
  } else if (expense.description.length > 500) {
    fieldErrors.description = ['Description must be less than 500 characters'];
  }

  // Date validation
  const date = typeof expense.date === 'string' ? parseISO(expense.date) : expense.date;
  if (!isValid(date)) {
    fieldErrors.date = ['Valid date is required'];
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    errors: [],
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}

// ============================================
// ACCESS CODE VALIDATION
// ============================================

/**
 * Validates a smart lock access code
 * @param code - Access code to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateAccessCode(
  code: string,
  options: { minLength?: number; maxLength?: number; numericOnly?: boolean } = {}
): ValidationResult {
  const { minLength = 4, maxLength = 8, numericOnly = true } = options;
  const errors: string[] = [];

  if (!code) {
    errors.push('Access code is required');
  } else {
    if (code.length < minLength) {
      errors.push(`Code must be at least ${minLength} characters`);
    }
    if (code.length > maxLength) {
      errors.push(`Code must be at most ${maxLength} characters`);
    }
    if (numericOnly && !/^\d+$/.test(code)) {
      errors.push('Code must contain only numbers');
    }
    // Check for common weak codes
    if (['0000', '1111', '1234', '4321', '0123', '9999'].includes(code)) {
      errors.push('Code is too simple');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// BASIC VALIDATORS
// ============================================

/**
 * Validates an email address
 * @param email - Email to validate
 * @returns Whether email is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates a phone number (US format)
 * @param phone - Phone number to validate
 * @returns Whether phone is valid
 */
export function isValidPhone(phone: string): boolean {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // Valid if 10 digits or 11 digits starting with 1
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

/**
 * Validates a US ZIP code
 * @param zipCode - ZIP code to validate
 * @returns Whether ZIP code is valid
 */
export function isValidZipCode(zipCode: string): boolean {
  // 5-digit or 5+4 format
  return /^\d{5}(-\d{4})?$/.test(zipCode);
}

/**
 * Validates a URL
 * @param url - URL to validate
 * @returns Whether URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a latitude value
 * @param lat - Latitude to validate
 * @returns Whether latitude is valid
 */
export function isValidLatitude(lat: number): boolean {
  return lat >= -90 && lat <= 90;
}

/**
 * Validates a longitude value
 * @param lng - Longitude to validate
 * @returns Whether longitude is valid
 */
export function isValidLongitude(lng: number): boolean {
  return lng >= -180 && lng <= 180;
}

/**
 * Validates a CUID (Collision-resistant Unique Identifier)
 * @param id - ID to validate
 * @returns Whether ID appears to be a valid CUID
 */
export function isValidCuid(id: string): boolean {
  // CUID format: c + timestamp + counter + fingerprint + random
  return /^c[a-z0-9]{24,}$/.test(id);
}

// ============================================
// SANITIZATION
// ============================================

/**
 * Sanitizes a string for safe display (removes potential XSS)
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitizes a phone number to digits only
 * @param phone - Phone number to sanitize
 * @returns Sanitized phone number
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Sanitizes a name (removes special characters, normalizes whitespace)
 * @param name - Name to sanitize
 * @returns Sanitized name
 */
export function sanitizeName(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\s'-]/gu, '') // Allow letters, numbers, spaces, hyphens, apostrophes
    .replace(/\s+/g, ' ')               // Normalize whitespace
    .trim();
}

/**
 * Validates and sanitizes an amount (rounds to 2 decimal places)
 * @param amount - Amount to validate
 * @returns Validated amount or null if invalid
 */
export function validateAmount(amount: number): number | null {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}
