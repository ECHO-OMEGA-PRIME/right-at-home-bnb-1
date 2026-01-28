/**
 * Right at Home BnB - Shared Type Definitions
 * Comprehensive TypeScript types for the entire application
 *
 * @packageDocumentation
 * @module @rightathome/types
 */

// Re-export all database types
export * from './database';

// Re-export all API types
export * from './api';

// Re-export all business logic types
export * from './business';

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Makes all properties in T optional and nullable
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] | null;
};

/**
 * Makes specific keys K of T required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Makes specific keys K of T optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extracts the type from a Promise
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Creates a type with only the specified keys
 */
export type PickByValue<T, V> = Pick<T, { [K in keyof T]: T[K] extends V ? K : never }[keyof T]>;

/**
 * Makes all properties readonly recursively
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Removes readonly modifier from all properties
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Creates a union type of all object values
 */
export type ValueOf<T> = T[keyof T];

/**
 * Ensures a type is not null or undefined
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * String literal union to string enum-like object
 */
export type StringEnum<T extends string> = { [K in T]: K };

// ============================================
// BRAND TYPES (Nominal Typing)
// ============================================

/**
 * Brand type for type-safe IDs
 */
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

/** Branded property ID */
export type PropertyId = Brand<string, 'PropertyId'>;

/** Branded guest ID */
export type GuestId = Brand<string, 'GuestId'>;

/** Branded booking ID */
export type BookingId = Brand<string, 'BookingId'>;

/** Branded user ID */
export type UserId = Brand<string, 'UserId'>;

/** Branded cleaning job ID */
export type CleaningJobId = Brand<string, 'CleaningJobId'>;

// ============================================
// VALIDATION TYPES
// ============================================

/**
 * Validation result type
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Array of error messages */
  errors: string[];
  /** Field-specific errors */
  fieldErrors?: Record<string, string[]>;
}

/**
 * Validator function type
 */
export type Validator<T> = (value: T) => ValidationResult;

// ============================================
// EVENT TYPES
// ============================================

/**
 * Base event type for event-driven architecture
 */
export interface BaseEvent<T extends string, P = unknown> {
  /** Event type identifier */
  type: T;
  /** Event payload */
  payload: P;
  /** Event timestamp */
  timestamp: string;
  /** Source of the event */
  source: string;
  /** Correlation ID for tracing */
  correlationId?: string;
}

/** Booking created event */
export type BookingCreatedEvent = BaseEvent<'booking.created', {
  bookingId: string;
  propertyId: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
}>;

/** Booking cancelled event */
export type BookingCancelledEvent = BaseEvent<'booking.cancelled', {
  bookingId: string;
  reason?: string;
}>;

/** Cleaning completed event */
export type CleaningCompletedEvent = BaseEvent<'cleaning.completed', {
  jobId: string;
  propertyId: string;
  cleanerId: string;
  score: number;
}>;

/** Lock accessed event */
export type LockAccessedEvent = BaseEvent<'lock.accessed', {
  lockId: string;
  propertyId: string;
  action: 'lock' | 'unlock';
  method: string;
}>;

/** Union of all system events */
export type SystemEvent =
  | BookingCreatedEvent
  | BookingCancelledEvent
  | CleaningCompletedEvent
  | LockAccessedEvent;

// ============================================
// CONSTANTS
// ============================================

/** Default pagination limit */
export const DEFAULT_PAGE_LIMIT = 20;

/** Maximum pagination limit */
export const MAX_PAGE_LIMIT = 100;

/** Default timezone */
export const DEFAULT_TIMEZONE = 'America/Chicago';

/** Default currency */
export const DEFAULT_CURRENCY = 'USD';

/** GPS verification radius in meters */
export const DEFAULT_GPS_RADIUS = 100;

/** Access code expiration buffer in hours */
export const CODE_EXPIRATION_BUFFER = 2;

/** Minimum booking advance in hours */
export const MIN_BOOKING_ADVANCE = 24;

/** Standard check-in time */
export const STANDARD_CHECK_IN_TIME = '15:00';

/** Standard check-out time */
export const STANDARD_CHECK_OUT_TIME = '11:00';
