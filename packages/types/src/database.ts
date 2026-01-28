/**
 * Right at Home BnB - Database Types
 * Type definitions matching the Prisma schema
 * @packageDocumentation
 */

// ============================================
// ENUMS - String literal unions for type safety
// ============================================

/** User roles in the system */
export type UserRole = 'ADMIN' | 'OWNER' | 'CLEANER' | 'GUEST';

/** Property status options */
export type PropertyStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

/** Property type classification */
export type PropertyType = 'HOUSE' | 'APARTMENT' | 'CONDO' | 'TOWNHOUSE' | 'CABIN' | 'STUDIO';

/** Booking status lifecycle */
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';

/** Cleaning job status lifecycle */
export type CleaningJobStatus = 'SCHEDULED' | 'ASSIGNED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'CANCELLED';

/** Types of cleaning jobs */
export type CleaningJobType = 'TURNOVER' | 'DEEP_CLEAN' | 'INSPECTION' | 'MAINTENANCE' | 'TOUCH_UP';

/** Booking platforms/sources */
export type BookingPlatform = 'AIRBNB' | 'VRBO' | 'BOOKING' | 'DIRECT' | 'OTHER';

/** Smart lock brands supported */
export type SmartLockBrand = 'SCHLAGE' | 'YALE' | 'AUGUST' | 'KWIKSET' | 'WYZE' | 'OTHER';

/** Message delivery channels */
export type MessageChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'APP_NOTIFICATION' | 'IN_PLATFORM';

/** Message workflow status */
export type MessageStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SCHEDULED' | 'SENT' | 'FAILED' | 'DELIVERED';

/** Message sentiment analysis result */
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

/** Expense approval status */
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'REIMBURSED';

/** Expense categories for tax purposes */
export type ExpenseCategory =
  | 'CLEANING'
  | 'MAINTENANCE'
  | 'UTILITIES'
  | 'SUPPLIES'
  | 'MARKETING'
  | 'INSURANCE'
  | 'TAXES'
  | 'MORTGAGE'
  | 'HOA'
  | 'PROFESSIONAL_SERVICES'
  | 'OTHER';

/** VIP tier levels for guests */
export type VIPTier = 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

/** Cleaning issue severity levels */
export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Types of cleaning issues */
export type IssueType = 'DAMAGE' | 'MISSING' | 'MAINTENANCE' | 'SUPPLY' | 'SAFETY' | 'OTHER';

// ============================================
// BASE ENTITY - Common fields
// ============================================

/** Base entity with common fields */
export interface BaseEntity {
  /** Unique identifier (CUID) */
  id: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

// ============================================
// USER & AUTHENTICATION
// ============================================

/** User entity - represents all system users */
export interface User extends BaseEntity {
  /** Email address (unique) */
  email: string;
  /** Display name */
  name: string;
  /** Phone number (optional) */
  phone: string | null;
  /** Avatar URL (optional) */
  avatarUrl: string | null;
  /** User role */
  role: UserRole;
  /** Whether user is active */
  isActive: boolean;
}

/** User creation input */
export interface CreateUserInput {
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  role?: UserRole;
}

/** User update input */
export interface UpdateUserInput {
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: UserRole;
  isActive?: boolean;
}

// ============================================
// PROPERTIES
// ============================================

/** Geographic coordinates */
export interface GeoLocation {
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
}

/** Property entity - rental property details */
export interface Property extends BaseEntity {
  /** Property name/title */
  name: string;
  /** Street address */
  address: string;
  /** City (defaults to Midland) */
  city: string;
  /** State (defaults to TX) */
  state: string;
  /** ZIP code */
  zipCode: string | null;
  /** Latitude coordinate */
  latitude: number | null;
  /** Longitude coordinate */
  longitude: number | null;
  /** Number of bedrooms */
  bedrooms: number;
  /** Number of bathrooms (can be .5 for half baths) */
  bathrooms: number;
  /** Maximum guest capacity */
  maxGuests: number;
  /** Square footage */
  squareFeet: number | null;
  /** Property type classification */
  propertyType: PropertyType;
  /** Amenities (JSON stringified array) */
  amenities: string | null;
  /** WiFi network name */
  wifiNetwork: string | null;
  /** WiFi password */
  wifiPassword: string | null;
  /** Parking instructions */
  parkingInfo: string | null;
  /** Check-in instructions */
  checkInInstr: string | null;
  /** Check-out instructions */
  checkOutInstr: string | null;
  /** House rules */
  houseRules: string | null;
  /** Cleaning checklist (JSON stringified) */
  cleaningChecklist: string | null;
  /** Nightly rate in USD */
  nightlyRate: number;
  /** Cleaning fee in USD */
  cleaningFee: number | null;
  /** Security deposit in USD */
  securityDeposit: number | null;
  /** External Airbnb listing ID */
  airbnbId: string | null;
  /** External VRBO listing ID */
  vrboId: string | null;
  /** Property status */
  status: PropertyStatus;
}

/** Property photo entity */
export interface PropertyPhoto {
  /** Unique identifier */
  id: string;
  /** Associated property ID */
  propertyId: string;
  /** Photo URL */
  url: string;
  /** Photo caption/alt text */
  caption: string | null;
  /** Whether this is the primary display photo */
  isPrimary: boolean;
  /** Sort order for display */
  sortOrder: number;
  /** Creation timestamp */
  createdAt: Date;
}

/** Property creation input */
export interface CreatePropertyInput {
  name: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  squareFeet?: number;
  propertyType?: PropertyType;
  amenities?: string[];
  wifiNetwork?: string;
  wifiPassword?: string;
  parkingInfo?: string;
  checkInInstr?: string;
  checkOutInstr?: string;
  houseRules?: string;
  nightlyRate: number;
  cleaningFee?: number;
  securityDeposit?: number;
  airbnbId?: string;
  vrboId?: string;
}

/** Property update input */
export interface UpdatePropertyInput extends Partial<Omit<CreatePropertyInput, 'amenities'>> {
  amenities?: string[];
  status?: PropertyStatus;
}

// ============================================
// GUESTS & CRM
// ============================================

/** Guest entity - customer information */
export interface Guest extends BaseEntity {
  /** Email address (unique) */
  email: string;
  /** Guest name */
  name: string;
  /** Phone number */
  phone: string | null;
  /** Original booking platform */
  platform: BookingPlatform;
  /** Platform-specific ID */
  platformId: string | null;
  /** Date of first stay */
  firstStay: Date | null;
  /** Date of most recent stay */
  lastStay: Date | null;
  /** Total number of stays */
  totalStays: number;
  /** Total amount spent (USD) */
  totalSpent: number;
  /** Average rating given */
  avgRating: number | null;
  /** Tags (JSON stringified array) */
  tags: string | null;
  /** Internal notes */
  notes: string | null;
  /** Guest preferences (JSON stringified) */
  preferences: string | null;
  /** VIP status flag */
  isVip: boolean;
  /** VIP tier level */
  vipTier: VIPTier | null;
  /** Birthday date */
  birthday: Date | null;
  /** Anniversary date */
  anniversary: Date | null;
}

/** Guest creation input */
export interface CreateGuestInput {
  email: string;
  name: string;
  phone?: string;
  platform?: BookingPlatform;
  platformId?: string;
  tags?: string[];
  notes?: string;
  preferences?: GuestPreferences;
  birthday?: Date;
  anniversary?: Date;
}

/** Guest preferences structure */
export interface GuestPreferences {
  earlyCheckIn?: boolean;
  lateCheckOut?: boolean;
  petFriendly?: boolean;
  quietHours?: boolean;
  preferredContactMethod?: 'email' | 'sms' | 'phone';
  dietaryRestrictions?: string[];
  specialRequests?: string;
}

// ============================================
// BOOKINGS
// ============================================

/** Booking entity - reservation details */
export interface Booking extends BaseEntity {
  /** Associated property ID */
  propertyId: string;
  /** Associated guest ID */
  guestId: string;
  /** Check-in date/time */
  checkIn: Date;
  /** Check-out date/time */
  checkOut: Date;
  /** Number of guests */
  guestCount: number;
  /** Booking platform source */
  platform: BookingPlatform;
  /** Platform confirmation code */
  confirmCode: string | null;
  /** Nightly rate at time of booking */
  nightlyRate: number;
  /** Total number of nights */
  totalNights: number;
  /** Subtotal (nights * rate) */
  subtotal: number;
  /** Cleaning fee charged */
  cleaningFee: number | null;
  /** Service fee charged */
  serviceFee: number | null;
  /** Taxes charged */
  taxes: number | null;
  /** Total price including all fees */
  totalPrice: number;
  /** Access code for smart lock */
  accessCode: string | null;
  /** When access code expires */
  codeExpiresAt: Date | null;
  /** Booking status */
  status: BookingStatus;
  /** Special requests from guest */
  specialReqs: string | null;
  /** Internal notes */
  internalNotes: string | null;
}

/** Booking creation input */
export interface CreateBookingInput {
  propertyId: string;
  guestId: string;
  checkIn: Date;
  checkOut: Date;
  guestCount?: number;
  platform?: BookingPlatform;
  confirmCode?: string;
  nightlyRate: number;
  cleaningFee?: number;
  serviceFee?: number;
  taxes?: number;
  specialReqs?: string;
  internalNotes?: string;
}

/** Booking with related entities */
export interface BookingWithRelations extends Booking {
  property: Property;
  guest: Guest;
  cleaningJob?: CleaningJob;
}

// ============================================
// CLEANING & CREW
// ============================================

/** Cleaning job entity - cleaning assignment */
export interface CleaningJob extends BaseEntity {
  /** Associated property ID */
  propertyId: string;
  /** Assigned cleaner user ID */
  cleanerId: string | null;
  /** Associated booking ID (if turnover) */
  bookingId: string | null;
  /** Scheduled date/time */
  scheduledAt: Date;
  /** Actual start time */
  startedAt: Date | null;
  /** Completion time */
  completedAt: Date | null;
  /** Type of cleaning job */
  jobType: CleaningJobType;
  /** Job status */
  status: CleaningJobStatus;
  /** GPS check-in latitude */
  checkInLat: number | null;
  /** GPS check-in longitude */
  checkInLng: number | null;
  /** GPS check-out latitude */
  checkOutLat: number | null;
  /** GPS check-out longitude */
  checkOutLng: number | null;
  /** Checklist progress (JSON stringified) */
  checklistProgress: string | null;
  /** Photo URLs (JSON stringified array) */
  photos: string | null;
  /** Quality score (0-100) */
  score: number | null;
  /** Score feedback */
  scoreFeedback: string | null;
  /** Cleaner notes */
  notes: string | null;
  /** Issues reported (JSON stringified) */
  issues: string | null;
  /** Actual duration in minutes */
  durationMins: number | null;
}

/** Cleaning checklist item */
export interface CleaningChecklistItem {
  /** Unique item ID */
  id: string;
  /** Room/area of the property */
  area: 'kitchen' | 'bathroom' | 'bedroom' | 'living' | 'outdoor' | 'general' | 'laundry';
  /** Task description */
  task: string;
  /** Whether required for completion */
  required: boolean;
  /** Whether completed */
  completed?: boolean;
  /** Completion timestamp */
  completedAt?: Date;
  /** Photo proof URL */
  photoUrl?: string;
  /** Notes about completion */
  notes?: string;
}

/** Cleaning issue report */
export interface CleaningIssue {
  /** Unique issue ID */
  id: string;
  /** Issue type */
  type: IssueType;
  /** Severity level */
  severity: IssueSeverity;
  /** Issue title */
  title: string;
  /** Detailed description */
  description: string;
  /** Location in property */
  location: string;
  /** Photo URLs */
  photoUrls: string[];
  /** When reported */
  reportedAt: Date;
  /** Whether resolved */
  resolved: boolean;
  /** When resolved */
  resolvedAt?: Date;
  /** Resolution description */
  resolution?: string;
}

/** Cleaning job creation input */
export interface CreateCleaningJobInput {
  propertyId: string;
  cleanerId?: string;
  bookingId?: string;
  scheduledAt: Date;
  jobType?: CleaningJobType;
}

/** Cleaning job with related entities */
export interface CleaningJobWithRelations extends CleaningJob {
  property: Property;
  cleaner?: User;
  booking?: Booking;
}

// ============================================
// SMART LOCKS
// ============================================

/** Smart lock entity - door lock device */
export interface SmartLock extends BaseEntity {
  /** Associated property ID (unique) */
  propertyId: string;
  /** Lock brand */
  brand: SmartLockBrand;
  /** Lock model */
  model: string | null;
  /** Device ID from manufacturer */
  deviceId: string;
  /** Serial number */
  serialNumber: string | null;
  /** Current access code */
  currentCode: string | null;
  /** When current code expires */
  codeExpiresAt: Date | null;
  /** Battery level percentage */
  batteryLevel: number | null;
  /** Last activity timestamp */
  lastActivity: Date | null;
  /** Whether device is online */
  isOnline: boolean;
  /** Access log (JSON stringified) */
  accessLog: string | null;
}

/** Access code for smart lock */
export interface AccessCode {
  /** Code identifier */
  id: string;
  /** The numeric code */
  code: string;
  /** Code name/label */
  name: string;
  /** Code type */
  type: 'guest' | 'cleaner' | 'owner' | 'emergency' | 'maintenance';
  /** When code becomes valid */
  validFrom?: Date;
  /** When code expires */
  validUntil?: Date;
  /** Number of times used */
  usageCount?: number;
  /** Whether code is active */
  active: boolean;
}

/** Smart lock access log entry */
export interface AccessLogEntry {
  /** Entry timestamp */
  timestamp: Date;
  /** Action taken */
  action: 'lock' | 'unlock' | 'code_entry' | 'auto_lock' | 'manual';
  /** Code used (if applicable) */
  codeUsed?: string;
  /** User ID if known */
  userId?: string;
  /** Method of access */
  method: 'code' | 'app' | 'manual' | 'auto';
}

// ============================================
// MESSAGING
// ============================================

/** Message entity - guest communication */
export interface Message extends BaseEntity {
  /** Associated guest ID */
  guestId: string;
  /** Associated booking ID (optional) */
  bookingId: string | null;
  /** Message type (booking_confirm, pre_arrival, etc) */
  type: string;
  /** Delivery channel */
  channel: MessageChannel;
  /** Message subject (for email) */
  subject: string | null;
  /** Message body */
  body: string;
  /** Message status */
  status: MessageStatus;
  /** Scheduled send time */
  scheduledFor: Date | null;
  /** Actual send time */
  sentAt: Date | null;
  /** Approving user ID */
  approvedBy: string | null;
  /** Approval timestamp */
  approvedAt: Date | null;
  /** AI sentiment analysis */
  sentiment: Sentiment | null;
  /** Sentiment confidence score */
  sentimentScore: number | null;
}

/** Message creation input */
export interface CreateMessageInput {
  guestId: string;
  bookingId?: string;
  type: string;
  channel?: MessageChannel;
  subject?: string;
  body: string;
  scheduledFor?: Date;
}

// ============================================
// FINANCES
// ============================================

/** Expense entity - property expense tracking */
export interface Expense extends BaseEntity {
  /** Associated property ID */
  propertyId: string;
  /** User who created the expense */
  createdById: string | null;
  /** Expense category */
  category: ExpenseCategory;
  /** Subcategory */
  subcategory: string | null;
  /** Amount in USD */
  amount: number;
  /** Description */
  description: string;
  /** Vendor/merchant name */
  vendor: string | null;
  /** Expense date */
  date: Date;
  /** Receipt URL */
  receiptUrl: string | null;
  /** Whether tax deductible */
  isTaxDeductible: boolean;
  /** Tax category for reporting */
  taxCategory: string | null;
  /** Approval status */
  status: ExpenseStatus;
  /** Notes */
  notes: string | null;
}

/** Expense creation input */
export interface CreateExpenseInput {
  propertyId: string;
  category: ExpenseCategory;
  subcategory?: string;
  amount: number;
  description: string;
  vendor?: string;
  date: Date;
  receiptUrl?: string;
  isTaxDeductible?: boolean;
  taxCategory?: string;
  notes?: string;
}

// ============================================
// AI CONCIERGE
// ============================================

/** Concierge query entity - AI assistant interactions */
export interface ConciergeQuery {
  /** Unique identifier */
  id: string;
  /** Associated guest ID */
  guestId: string | null;
  /** Associated property ID */
  propertyId: string | null;
  /** User query */
  query: string;
  /** AI response */
  response: string;
  /** Query category */
  category: string | null;
  /** Detected intent */
  intent: string | null;
  /** Whether response was helpful */
  wasHelpful: boolean | null;
  /** User rating (1-5) */
  rating: number | null;
  /** Whether voice was used */
  voiceUsed: boolean;
  /** Audio recording URL */
  audioUrl: string | null;
  /** Query timestamp */
  createdAt: Date;
}

// ============================================
// SYSTEM & AUDIT
// ============================================

/** Audit log entity - system activity tracking */
export interface AuditLog {
  /** Unique identifier */
  id: string;
  /** User who performed action */
  userId: string | null;
  /** Action performed */
  action: string;
  /** Entity type affected */
  entity: string;
  /** Entity ID affected */
  entityId: string | null;
  /** Previous values (JSON stringified) */
  oldValues: string | null;
  /** New values (JSON stringified) */
  newValues: string | null;
  /** Client IP address */
  ipAddress: string | null;
  /** Client user agent */
  userAgent: string | null;
  /** Action timestamp */
  createdAt: Date;
}

/** System setting entity */
export interface Setting {
  /** Unique identifier */
  id: string;
  /** Setting key (unique) */
  key: string;
  /** Setting value */
  value: string;
  /** Description */
  description: string | null;
  /** Last update timestamp */
  updatedAt: Date;
}

// ============================================
// QUERY FILTERS
// ============================================

/** Pagination parameters */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/** Date range filter */
export interface DateRangeFilter {
  /** Start date (inclusive) */
  from?: Date;
  /** End date (inclusive) */
  to?: Date;
}

/** Property filter options */
export interface PropertyFilter extends PaginationParams {
  status?: PropertyStatus;
  propertyType?: PropertyType;
  city?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minRate?: number;
  maxRate?: number;
  search?: string;
}

/** Booking filter options */
export interface BookingFilter extends PaginationParams, DateRangeFilter {
  propertyId?: string;
  guestId?: string;
  status?: BookingStatus;
  platform?: BookingPlatform;
}

/** Cleaning job filter options */
export interface CleaningJobFilter extends PaginationParams, DateRangeFilter {
  propertyId?: string;
  cleanerId?: string;
  status?: CleaningJobStatus;
  jobType?: CleaningJobType;
}

/** Expense filter options */
export interface ExpenseFilter extends PaginationParams, DateRangeFilter {
  propertyId?: string;
  category?: ExpenseCategory;
  status?: ExpenseStatus;
  minAmount?: number;
  maxAmount?: number;
}
