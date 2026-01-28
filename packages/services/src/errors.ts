/**
 * Right at Home BnB - Error Handling
 * Comprehensive error classes and utilities for consistent error handling
 *
 * @packageDocumentation
 * @module @rightathome/services/errors
 */

// ============================================
// ERROR CODES
// ============================================

/**
 * Standard error codes for the application
 */
export const ErrorCode = {
  // Generic errors (1000-1099)
  UNKNOWN: 'E1000',
  VALIDATION: 'E1001',
  NOT_FOUND: 'E1002',
  CONFLICT: 'E1003',
  RATE_LIMITED: 'E1004',

  // Authentication errors (1100-1199)
  UNAUTHORIZED: 'E1100',
  FORBIDDEN: 'E1101',
  TOKEN_EXPIRED: 'E1102',
  INVALID_TOKEN: 'E1103',
  SESSION_EXPIRED: 'E1104',

  // Database errors (1200-1299)
  DB_ERROR: 'E1200',
  DB_CONNECTION: 'E1201',
  DB_CONSTRAINT: 'E1202',
  DB_TIMEOUT: 'E1203',

  // External service errors (1300-1399)
  EXTERNAL_SERVICE: 'E1300',
  AIRBNB_API: 'E1301',
  VRBO_API: 'E1302',
  LOCK_API: 'E1303',
  PAYMENT_API: 'E1304',
  EMAIL_SERVICE: 'E1305',
  SMS_SERVICE: 'E1306',

  // Business logic errors (1400-1499)
  BOOKING_CONFLICT: 'E1400',
  PROPERTY_UNAVAILABLE: 'E1401',
  INVALID_DATE_RANGE: 'E1402',
  GUEST_NOT_VERIFIED: 'E1403',
  CLEANING_IN_PROGRESS: 'E1404',
  LOCK_OFFLINE: 'E1405',
  INSUFFICIENT_NOTICE: 'E1406',
  MAX_GUESTS_EXCEEDED: 'E1407',
  MINIMUM_STAY_NOT_MET: 'E1408',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================
// HTTP STATUS MAPPING
// ============================================

const errorCodeToStatus: Record<ErrorCodeType, number> = {
  [ErrorCode.UNKNOWN]: 500,
  [ErrorCode.VALIDATION]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.DB_ERROR]: 500,
  [ErrorCode.DB_CONNECTION]: 503,
  [ErrorCode.DB_CONSTRAINT]: 409,
  [ErrorCode.DB_TIMEOUT]: 504,
  [ErrorCode.EXTERNAL_SERVICE]: 502,
  [ErrorCode.AIRBNB_API]: 502,
  [ErrorCode.VRBO_API]: 502,
  [ErrorCode.LOCK_API]: 502,
  [ErrorCode.PAYMENT_API]: 502,
  [ErrorCode.EMAIL_SERVICE]: 502,
  [ErrorCode.SMS_SERVICE]: 502,
  [ErrorCode.BOOKING_CONFLICT]: 409,
  [ErrorCode.PROPERTY_UNAVAILABLE]: 409,
  [ErrorCode.INVALID_DATE_RANGE]: 400,
  [ErrorCode.GUEST_NOT_VERIFIED]: 403,
  [ErrorCode.CLEANING_IN_PROGRESS]: 409,
  [ErrorCode.LOCK_OFFLINE]: 503,
  [ErrorCode.INSUFFICIENT_NOTICE]: 400,
  [ErrorCode.MAX_GUESTS_EXCEEDED]: 400,
  [ErrorCode.MINIMUM_STAY_NOT_MET]: 400,
};

// ============================================
// BASE APPLICATION ERROR
// ============================================

/**
 * Base error class for all application errors
 */
export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCodeType = ErrorCode.UNKNOWN,
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = errorCodeToStatus[code] || 500;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp.toISOString(),
      },
    };
  }

  /**
   * Convert to API response format
   */
  toApiResponse(): { success: false; error: Record<string, unknown> } {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

// ============================================
// SPECIFIC ERROR CLASSES
// ============================================

/**
 * Validation error - bad input from user
 */
export class ValidationError extends AppError {
  public readonly fields: Record<string, string[]>;

  constructor(message: string, fields: Record<string, string[]> = {}) {
    super(message, ErrorCode.VALIDATION, { fields });
    this.fields = fields;
  }

  static field(fieldName: string, message: string): ValidationError {
    return new ValidationError(`Validation failed: ${message}`, { [fieldName]: [message] });
  }

  static fields(errors: Record<string, string[]>): ValidationError {
    const messages = Object.entries(errors)
      .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
      .join('; ');
    return new ValidationError(`Validation failed: ${messages}`, errors);
  }
}

/**
 * Not found error - resource doesn't exist
 */
export class NotFoundError extends AppError {
  public readonly resource: string;
  public readonly resourceId?: string;

  constructor(resource: string, resourceId?: string) {
    const message = resourceId
      ? `${resource} with id '${resourceId}' not found`
      : `${resource} not found`;
    super(message, ErrorCode.NOT_FOUND, { resource, resourceId });
    this.resource = resource;
    this.resourceId = resourceId;
  }

  static property(id: string): NotFoundError {
    return new NotFoundError('Property', id);
  }

  static booking(id: string): NotFoundError {
    return new NotFoundError('Booking', id);
  }

  static guest(id: string): NotFoundError {
    return new NotFoundError('Guest', id);
  }

  static user(id: string): NotFoundError {
    return new NotFoundError('User', id);
  }

  static cleaningJob(id: string): NotFoundError {
    return new NotFoundError('CleaningJob', id);
  }
}

/**
 * Authentication error - user not authenticated
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, ErrorCode.UNAUTHORIZED);
  }

  static invalidCredentials(): UnauthorizedError {
    return new UnauthorizedError('Invalid email or password');
  }

  static tokenExpired(): UnauthorizedError {
    return new UnauthorizedError('Authentication token has expired');
  }

  static invalidToken(): UnauthorizedError {
    return new UnauthorizedError('Invalid authentication token');
  }
}

/**
 * Authorization error - user doesn't have permission
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, ErrorCode.FORBIDDEN);
  }

  static insufficientPermissions(action: string): ForbiddenError {
    return new ForbiddenError(`Insufficient permissions to ${action}`);
  }

  static resourceAccess(resource: string): ForbiddenError {
    return new ForbiddenError(`Access denied to ${resource}`);
  }
}

/**
 * Conflict error - resource state conflict
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.CONFLICT, details);
  }

  static bookingConflict(
    propertyId: string,
    checkIn: Date,
    checkOut: Date
  ): ConflictError {
    return new ConflictError('Booking dates conflict with existing reservation', {
      propertyId,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
    });
  }

  static duplicateEntry(field: string, value: string): ConflictError {
    return new ConflictError(`A record with ${field} '${value}' already exists`, {
      field,
      value,
    });
  }
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number, message = 'Too many requests') {
    super(message, ErrorCode.RATE_LIMITED, { retryAfter });
    this.retryAfter = retryAfter;
  }
}

/**
 * Database error - database operation failed
 */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    code: ErrorCodeType = ErrorCode.DB_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, code, details, false);
  }

  static connectionFailed(): DatabaseError {
    return new DatabaseError('Failed to connect to database', ErrorCode.DB_CONNECTION);
  }

  static timeout(): DatabaseError {
    return new DatabaseError('Database operation timed out', ErrorCode.DB_TIMEOUT);
  }

  static constraint(constraint: string): DatabaseError {
    return new DatabaseError(`Database constraint violation: ${constraint}`, ErrorCode.DB_CONSTRAINT, {
      constraint,
    });
  }
}

/**
 * External service error - third-party API failed
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(
    service: string,
    message: string,
    code: ErrorCodeType = ErrorCode.EXTERNAL_SERVICE,
    details?: Record<string, unknown>
  ) {
    super(message, code, { ...details, service }, false);
    this.service = service;
  }

  static airbnb(message: string, details?: Record<string, unknown>): ExternalServiceError {
    return new ExternalServiceError('Airbnb', message, ErrorCode.AIRBNB_API, details);
  }

  static vrbo(message: string, details?: Record<string, unknown>): ExternalServiceError {
    return new ExternalServiceError('VRBO', message, ErrorCode.VRBO_API, details);
  }

  static smartLock(message: string, details?: Record<string, unknown>): ExternalServiceError {
    return new ExternalServiceError('SmartLock', message, ErrorCode.LOCK_API, details);
  }

  static payment(message: string, details?: Record<string, unknown>): ExternalServiceError {
    return new ExternalServiceError('Payment', message, ErrorCode.PAYMENT_API, details);
  }
}

// ============================================
// BUSINESS LOGIC ERRORS
// ============================================

/**
 * Booking-related business errors
 */
export class BookingError extends AppError {
  constructor(message: string, code: ErrorCodeType, details?: Record<string, unknown>) {
    super(message, code, details);
  }

  static dateConflict(existingBookingId: string): BookingError {
    return new BookingError(
      'Selected dates conflict with an existing booking',
      ErrorCode.BOOKING_CONFLICT,
      { existingBookingId }
    );
  }

  static propertyUnavailable(propertyId: string, reason: string): BookingError {
    return new BookingError(
      `Property is unavailable: ${reason}`,
      ErrorCode.PROPERTY_UNAVAILABLE,
      { propertyId, reason }
    );
  }

  static invalidDateRange(message: string): BookingError {
    return new BookingError(message, ErrorCode.INVALID_DATE_RANGE);
  }

  static maxGuestsExceeded(requested: number, maximum: number): BookingError {
    return new BookingError(
      `Guest count (${requested}) exceeds property maximum (${maximum})`,
      ErrorCode.MAX_GUESTS_EXCEEDED,
      { requested, maximum }
    );
  }

  static minimumStayNotMet(nights: number, minimum: number): BookingError {
    return new BookingError(
      `Stay duration (${nights} nights) is below minimum (${minimum} nights)`,
      ErrorCode.MINIMUM_STAY_NOT_MET,
      { nights, minimum }
    );
  }

  static insufficientNotice(daysNotice: number, required: number): BookingError {
    return new BookingError(
      `Booking requires ${required} days notice (${daysNotice} provided)`,
      ErrorCode.INSUFFICIENT_NOTICE,
      { daysNotice, required }
    );
  }
}

/**
 * Smart lock related errors
 */
export class SmartLockError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.LOCK_OFFLINE, details);
  }

  static offline(lockId: string): SmartLockError {
    return new SmartLockError(`Smart lock is offline`, { lockId });
  }

  static lowBattery(lockId: string, batteryLevel: number): SmartLockError {
    return new SmartLockError(`Smart lock battery critically low (${batteryLevel}%)`, {
      lockId,
      batteryLevel,
    });
  }
}

// ============================================
// ERROR HANDLING UTILITIES
// ============================================

/**
 * Check if an error is an operational error (expected)
 * vs programming error (bug)
 */
export function isOperationalError(error: unknown): error is AppError {
  return error instanceof AppError && error.isOperational;
}

/**
 * Convert any error to an AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, ErrorCode.UNKNOWN, {
      originalName: error.name,
      stack: error.stack,
    });
  }

  return new AppError(String(error), ErrorCode.UNKNOWN);
}

/**
 * Create a standardized API error response
 */
export function createErrorResponse(error: unknown): {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
} {
  const appError = toAppError(error);
  return appError.toApiResponse();
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  errorHandler?: (error: AppError) => void
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = toAppError(error);
      if (errorHandler) {
        errorHandler(appError);
      }
      throw appError;
    }
  }) as T;
}

/**
 * Try-catch wrapper that returns a Result type
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: toAppError(error) };
  }
}

export function tryCatchSync<T>(fn: () => T): Result<T> {
  try {
    const data = fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: toAppError(error) };
  }
}
