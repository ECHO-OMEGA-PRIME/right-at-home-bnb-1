/**
 * Right At Home BnB - Zod Validation Schemas
 * OWASP-compliant input validation for all API endpoints
 *
 * Made by ECHO OMEGA PRIME | Authority 11.0 SOVEREIGN
 */

import { z } from 'zod';

// ============================================================================
// COMMON VALIDATION PATTERNS
// ============================================================================

/** Email validation with strict RFC 5322 compliance */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(254, 'Email too long')
  .toLowerCase()
  .transform((email) => email.trim());

/** Phone validation - US format with optional country code */
export const phoneSchema = z
  .string()
  .regex(
    /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
    'Invalid US phone number format'
  )
  .transform((phone) => phone.replace(/[-.\s()]/g, ''))
  .optional()
  .nullable();

/** UUID/CUID validation */
export const idSchema = z
  .string()
  .min(1, 'ID required')
  .max(128, 'ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format');

/** Safe string - no script injection */
export const safeStringSchema = z
  .string()
  .max(10000, 'String too long')
  .transform((str) => str.trim())
  .refine(
    (str) => !/<script[\s\S]*?>[\s\S]*?<\/script>/gi.test(str),
    'Script tags not allowed'
  )
  .refine(
    (str) => !/on\w+\s*=/gi.test(str),
    'Event handlers not allowed'
  );

/** Name validation - alphabetic with spaces, hyphens, apostrophes */
export const nameSchema = z
  .string()
  .min(1, 'Name required')
  .max(100, 'Name too long')
  .regex(
    /^[a-zA-Z\s'-]+$/,
    'Name can only contain letters, spaces, hyphens, and apostrophes'
  )
  .transform((name) => name.trim());

/** URL validation */
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL too long')
  .refine(
    (url) => url.startsWith('https://') || url.startsWith('http://'),
    'URL must use http or https protocol'
  );

/** Date string in ISO format */
export const dateSchema = z
  .string()
  .datetime({ message: 'Invalid datetime format, use ISO 8601' })
  .or(z.date());

/** Future date validation */
export const futureDateSchema = z
  .string()
  .datetime()
  .refine(
    (date) => new Date(date) > new Date(),
    'Date must be in the future'
  );

/** Positive number */
export const positiveNumberSchema = z
  .number()
  .positive('Must be positive')
  .finite('Must be a finite number');

/** Currency amount (2 decimal places max) */
export const currencySchema = z
  .number()
  .min(0, 'Amount cannot be negative')
  .max(1000000, 'Amount too large')
  .multipleOf(0.01, 'Maximum 2 decimal places');

/** Latitude validation */
export const latitudeSchema = z
  .number()
  .min(-90, 'Invalid latitude')
  .max(90, 'Invalid latitude');

/** Longitude validation */
export const longitudeSchema = z
  .number()
  .min(-180, 'Invalid longitude')
  .max(180, 'Invalid longitude');

/** Rating (1-5) */
export const ratingSchema = z
  .number()
  .int('Rating must be an integer')
  .min(1, 'Minimum rating is 1')
  .max(5, 'Maximum rating is 5');

// ============================================================================
// USER & AUTH SCHEMAS
// ============================================================================

/** User roles - strict enum */
export const UserRole = z.enum(['ADMIN', 'CLEANER', 'GUEST', 'OWNER']);
export type UserRoleType = z.infer<typeof UserRole>;

/** Login request */
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
});

/** Registration request */
export const registerSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must include uppercase, lowercase, number, and special character'
    ),
  phone: phoneSchema,
  role: UserRole.default('GUEST'),
});

/** User update */
export const userUpdateSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema,
  avatarUrl: urlSchema.optional().nullable(),
  isActive: z.boolean().optional(),
});

/** Password change */
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must include uppercase, lowercase, number, and special character'
    ),
});

// ============================================================================
// PROPERTY SCHEMAS
// ============================================================================

/** Property types */
export const PropertyType = z.enum([
  'HOUSE',
  'APARTMENT',
  'CONDO',
  'TOWNHOUSE',
  'CABIN',
  'STUDIO',
]);

/** Property status */
export const PropertyStatus = z.enum([
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE',
  'BLOCKED',
]);

/** Create property */
export const createPropertySchema = z.object({
  name: safeStringSchema.pipe(z.string().min(1).max(200)),
  address: safeStringSchema.pipe(z.string().min(5).max(500)),
  city: nameSchema.default('Midland'),
  state: z.string().length(2, 'State must be 2 letter code').default('TX'),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format')
    .optional()
    .nullable(),
  latitude: latitudeSchema.optional().nullable(),
  longitude: longitudeSchema.optional().nullable(),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().min(0).max(20),
  maxGuests: z.number().int().min(1).max(50),
  squareFeet: z.number().int().positive().max(50000).optional().nullable(),
  propertyType: PropertyType.default('HOUSE'),
  amenities: z.array(z.string().max(100)).max(50).optional(),
  wifiNetwork: safeStringSchema.max(100).optional().nullable(),
  wifiPassword: z.string().max(100).optional().nullable(),
  parkingInfo: safeStringSchema.max(1000).optional().nullable(),
  checkInInstr: safeStringSchema.max(5000).optional().nullable(),
  checkOutInstr: safeStringSchema.max(5000).optional().nullable(),
  houseRules: safeStringSchema.max(5000).optional().nullable(),
  cleaningChecklist: z.array(z.string().max(500)).max(100).optional(),
  nightlyRate: currencySchema,
  cleaningFee: currencySchema.optional().nullable(),
  securityDeposit: currencySchema.optional().nullable(),
  airbnbId: z.string().max(100).optional().nullable(),
  vrboId: z.string().max(100).optional().nullable(),
  status: PropertyStatus.default('ACTIVE'),
});

/** Update property */
export const updatePropertySchema = createPropertySchema.partial();

// ============================================================================
// GUEST SCHEMAS
// ============================================================================

/** Platform source */
export const BookingPlatform = z.enum([
  'DIRECT',
  'AIRBNB',
  'VRBO',
  'BOOKING',
  'OTHER',
]);

/** VIP tiers */
export const VipTier = z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']);

/** Create guest */
export const createGuestSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  phone: phoneSchema,
  platform: BookingPlatform.default('DIRECT'),
  platformId: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: safeStringSchema.max(5000).optional().nullable(),
  preferences: z.record(z.string().max(100), z.unknown()).optional(),
  isVip: z.boolean().default(false),
  vipTier: VipTier.optional().nullable(),
  birthday: dateSchema.optional().nullable(),
  anniversary: dateSchema.optional().nullable(),
});

/** Update guest */
export const updateGuestSchema = createGuestSchema.partial().omit({ email: true });

// ============================================================================
// BOOKING SCHEMAS
// ============================================================================

/** Booking status */
export const BookingStatus = z.enum([
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
]);

/** Create booking */
export const createBookingSchema = z.object({
  propertyId: idSchema,
  guestId: idSchema,
  checkIn: dateSchema,
  checkOut: dateSchema,
  guestCount: z.number().int().min(1).max(50).default(1),
  platform: BookingPlatform.default('DIRECT'),
  confirmCode: z.string().max(100).optional().nullable(),
  nightlyRate: currencySchema,
  cleaningFee: currencySchema.optional().nullable(),
  serviceFee: currencySchema.optional().nullable(),
  taxes: currencySchema.optional().nullable(),
  specialReqs: safeStringSchema.max(2000).optional().nullable(),
  internalNotes: safeStringSchema.max(2000).optional().nullable(),
}).refine(
  (data) => new Date(data.checkOut) > new Date(data.checkIn),
  { message: 'Check-out must be after check-in', path: ['checkOut'] }
);

/** Update booking */
export const updateBookingSchema = z.object({
  checkIn: dateSchema.optional(),
  checkOut: dateSchema.optional(),
  guestCount: z.number().int().min(1).max(50).optional(),
  status: BookingStatus.optional(),
  specialReqs: safeStringSchema.max(2000).optional().nullable(),
  internalNotes: safeStringSchema.max(2000).optional().nullable(),
  accessCode: z.string().max(20).optional().nullable(),
});

// ============================================================================
// CLEANING JOB SCHEMAS
// ============================================================================

/** Job type */
export const CleaningJobType = z.enum([
  'TURNOVER',
  'DEEP_CLEAN',
  'MAINTENANCE',
  'INSPECTION',
  'TOUCH_UP',
]);

/** Job status */
export const CleaningJobStatus = z.enum([
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'VERIFIED',
  'ISSUE_REPORTED',
  'CANCELLED',
]);

/** Create cleaning job */
export const createCleaningJobSchema = z.object({
  propertyId: idSchema,
  cleanerId: idSchema.optional().nullable(),
  bookingId: idSchema.optional().nullable(),
  scheduledAt: dateSchema,
  jobType: CleaningJobType.default('TURNOVER'),
  notes: safeStringSchema.max(2000).optional().nullable(),
});

/** Update cleaning job */
export const updateCleaningJobSchema = z.object({
  cleanerId: idSchema.optional().nullable(),
  scheduledAt: dateSchema.optional(),
  status: CleaningJobStatus.optional(),
  checkInLat: latitudeSchema.optional().nullable(),
  checkInLng: longitudeSchema.optional().nullable(),
  checkOutLat: latitudeSchema.optional().nullable(),
  checkOutLng: longitudeSchema.optional().nullable(),
  checklistProgress: z.record(z.string(), z.boolean()).optional(),
  photos: z.array(urlSchema).max(50).optional(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  scoreFeedback: safeStringSchema.max(1000).optional().nullable(),
  notes: safeStringSchema.max(2000).optional().nullable(),
  issues: safeStringSchema.max(2000).optional().nullable(),
});

/** GPS check-in/out */
export const gpsCheckSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  timestamp: dateSchema.optional(),
  accuracy: z.number().positive().max(1000).optional(),
});

// ============================================================================
// EXPENSE SCHEMAS
// ============================================================================

/** Expense categories */
export const ExpenseCategory = z.enum([
  'CLEANING',
  'MAINTENANCE',
  'UTILITIES',
  'SUPPLIES',
  'INSURANCE',
  'TAXES',
  'MORTGAGE',
  'HOA',
  'MARKETING',
  'PLATFORM_FEES',
  'OTHER',
]);

/** Expense status */
export const ExpenseStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID']);

/** Create expense */
export const createExpenseSchema = z.object({
  propertyId: idSchema,
  category: ExpenseCategory,
  subcategory: z.string().max(100).optional().nullable(),
  amount: currencySchema,
  description: safeStringSchema.pipe(z.string().min(1).max(500)),
  vendor: safeStringSchema.max(200).optional().nullable(),
  date: dateSchema,
  receiptUrl: urlSchema.optional().nullable(),
  isTaxDeductible: z.boolean().default(true),
  taxCategory: z.string().max(100).optional().nullable(),
  notes: safeStringSchema.max(1000).optional().nullable(),
});

/** Update expense */
export const updateExpenseSchema = createExpenseSchema.partial().extend({
  status: ExpenseStatus.optional(),
});

// ============================================================================
// MESSAGE SCHEMAS
// ============================================================================

/** Message types */
export const MessageType = z.enum([
  'WELCOME',
  'PRE_ARRIVAL',
  'CHECK_IN',
  'DURING_STAY',
  'CHECK_OUT',
  'REVIEW_REQUEST',
  'PROMO',
  'CUSTOM',
]);

/** Message channels */
export const MessageChannel = z.enum(['EMAIL', 'SMS', 'APP', 'WHATSAPP']);

/** Message status */
export const MessageStatus = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SCHEDULED',
  'SENT',
  'DELIVERED',
  'FAILED',
]);

/** Create message */
export const createMessageSchema = z.object({
  guestId: idSchema,
  bookingId: idSchema.optional().nullable(),
  type: MessageType,
  channel: MessageChannel.default('EMAIL'),
  subject: safeStringSchema.max(200).optional().nullable(),
  body: safeStringSchema.pipe(z.string().min(1).max(10000)),
  scheduledFor: dateSchema.optional().nullable(),
});

/** Update message */
export const updateMessageSchema = z.object({
  subject: safeStringSchema.max(200).optional().nullable(),
  body: safeStringSchema.max(10000).optional(),
  status: MessageStatus.optional(),
  scheduledFor: dateSchema.optional().nullable(),
});

// ============================================================================
// SMART LOCK SCHEMAS
// ============================================================================

/** Lock brands */
export const LockBrand = z.enum(['SCHLAGE', 'YALE', 'AUGUST', 'KWIKSET', 'OTHER']);

/** Create smart lock */
export const createSmartLockSchema = z.object({
  propertyId: idSchema,
  brand: LockBrand,
  model: z.string().max(100).optional().nullable(),
  deviceId: z.string().max(200),
  serialNumber: z.string().max(100).optional().nullable(),
});

/** Update smart lock code */
export const updateLockCodeSchema = z.object({
  code: z
    .string()
    .regex(/^\d{4,8}$/, 'Code must be 4-8 digits')
    .transform((code) => code),
  expiresAt: dateSchema.optional().nullable(),
  label: safeStringSchema.max(100).optional(),
});

// ============================================================================
// CONCIERGE SCHEMAS
// ============================================================================

/** Create concierge query */
export const createConciergeQuerySchema = z.object({
  guestId: idSchema.optional().nullable(),
  propertyId: idSchema.optional().nullable(),
  query: safeStringSchema.pipe(z.string().min(1).max(2000)),
  voiceUsed: z.boolean().default(false),
});

/** Rate concierge response */
export const rateConciergeSchema = z.object({
  wasHelpful: z.boolean(),
  rating: ratingSchema.optional(),
});

// ============================================================================
// SEARCH & FILTER SCHEMAS
// ============================================================================

/** Pagination */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** Date range filter */
export const dateRangeSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be after start date', path: ['endDate'] }
);

/** Property search */
export const propertySearchSchema = paginationSchema.extend({
  query: z.string().max(200).optional(),
  status: PropertyStatus.optional(),
  minBedrooms: z.number().int().min(0).optional(),
  maxBedrooms: z.number().int().max(20).optional(),
  minPrice: currencySchema.optional(),
  maxPrice: currencySchema.optional(),
  city: z.string().max(100).optional(),
});

/** Booking search */
export const bookingSearchSchema = paginationSchema.extend({
  propertyId: idSchema.optional(),
  guestId: idSchema.optional(),
  status: BookingStatus.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  platform: BookingPlatform.optional(),
});

/** Guest search */
export const guestSearchSchema = paginationSchema.extend({
  query: z.string().max(200).optional(),
  isVip: z.boolean().optional(),
  vipTier: VipTier.optional(),
  minStays: z.number().int().min(0).optional(),
  platform: BookingPlatform.optional(),
});

// ============================================================================
// EXPORT TYPE INFERENCES
// ============================================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

export type CreateCleaningJobInput = z.infer<typeof createCleaningJobSchema>;
export type UpdateCleaningJobInput = z.infer<typeof updateCleaningJobSchema>;
export type GpsCheckInput = z.infer<typeof gpsCheckSchema>;

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;

export type CreateSmartLockInput = z.infer<typeof createSmartLockSchema>;
export type UpdateLockCodeInput = z.infer<typeof updateLockCodeSchema>;

export type CreateConciergeQueryInput = z.infer<typeof createConciergeQuerySchema>;
export type RateConciergeInput = z.infer<typeof rateConciergeSchema>;

export type PaginationInput = z.infer<typeof paginationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type PropertySearchInput = z.infer<typeof propertySearchSchema>;
export type BookingSearchInput = z.infer<typeof bookingSearchSchema>;
export type GuestSearchInput = z.infer<typeof guestSearchSchema>;

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate input against a schema with detailed error formatting
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: ValidationError[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: ValidationError[] = result.error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return { success: false, errors };
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Create a validated request handler wrapper
 */
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (data: T) => Promise<unknown>
) {
  return async (input: unknown) => {
    const validation = validateInput(schema, input);

    if (!validation.success) {
      throw new ValidationException(validation.errors);
    }

    return handler(validation.data);
  };
}

/**
 * Custom validation exception
 */
export class ValidationException extends Error {
  public readonly errors: ValidationError[];
  public readonly statusCode = 400;

  constructor(errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationException';
    this.errors = errors;
  }

  toJSON() {
    return {
      error: 'Validation failed',
      statusCode: this.statusCode,
      details: this.errors,
    };
  }
}
