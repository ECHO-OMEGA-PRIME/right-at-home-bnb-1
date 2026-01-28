/**
 * Right at Home BnB - API Types
 * Type definitions for API requests and responses
 * @packageDocumentation
 */

import type {
  Property,
  PropertyPhoto,
  Guest,
  Booking,
  CleaningJob,
  SmartLock,
  Message,
  Expense,
  User,
  PaginationParams,
  PropertyFilter,
  BookingFilter,
  CleaningJobFilter,
  ExpenseFilter,
  BookingStatus,
  CleaningJobStatus,
} from './database';

// ============================================
// GENERIC API RESPONSE TYPES
// ============================================

/**
 * Standard API response wrapper
 * @template T - The data type being returned
 */
export interface ApiResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** The response data (on success) */
  data?: T;
  /** Error message (on failure) */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: string;
  /** Additional message */
  message?: string;
  /** Response timestamp */
  timestamp: string;
}

/**
 * Paginated API response
 * @template T - The data type being returned
 */
export interface PaginatedResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Array of data items */
  data: T[];
  /** Pagination metadata */
  pagination: {
    /** Current page number */
    page: number;
    /** Items per page */
    limit: number;
    /** Total number of items */
    total: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether there are more pages */
    hasMore: boolean;
  };
}

/**
 * API error response
 */
export interface ApiError {
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** HTTP status code */
  status: number;
  /** Field-specific validation errors */
  fieldErrors?: Record<string, string[]>;
  /** Stack trace (development only) */
  stack?: string;
}

// ============================================
// AUTHENTICATION
// ============================================

/** Login request */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/** Login response */
export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: string;
}

/** Register request */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

/** Token refresh request */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** Token refresh response */
export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
  expiresAt: string;
}

/** Password reset request */
export interface PasswordResetRequest {
  email: string;
}

/** Password reset confirmation */
export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

// ============================================
// DASHBOARD
// ============================================

/** Dashboard statistics response */
export interface DashboardStats {
  /** Number of active cleaning jobs */
  activeCleanings: number;
  /** Number of check-ins today */
  todayCheckIns: number;
  /** Number of check-outs today */
  todayCheckOuts: number;
  /** Current occupancy rate (0-100) */
  occupancyRate: number;
  /** Revenue this month in USD */
  monthlyRevenue: number;
  /** Revenue change from last month (%) */
  revenueChange: number;
  /** Number of pending tasks */
  pendingTasks: number;
  /** Average guest rating */
  avgGuestRating: number;
  /** Total active properties */
  totalProperties: number;
  /** Properties with issues */
  propertiesWithIssues: number;
}

/** Dashboard timeline event */
export interface TimelineEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: 'booking' | 'cleaning' | 'message' | 'issue' | 'payment';
  /** Event title */
  title: string;
  /** Event description */
  description: string;
  /** Event timestamp */
  timestamp: string;
  /** Related property ID */
  propertyId?: string;
  /** Related property name */
  propertyName?: string;
  /** Event icon */
  icon?: string;
  /** Event color */
  color?: string;
}

/** Property occupancy data */
export interface OccupancyData {
  /** Property ID */
  propertyId: string;
  /** Property name */
  propertyName: string;
  /** Occupancy rate (0-100) */
  occupancyRate: number;
  /** Days booked this month */
  daysBooked: number;
  /** Days available this month */
  daysAvailable: number;
  /** Revenue this month */
  monthlyRevenue: number;
}

// ============================================
// PROPERTY API
// ============================================

/** Property list response with extras */
export interface PropertyListResponse {
  properties: PropertyWithStats[];
  stats: {
    total: number;
    active: number;
    maintenance: number;
    inactive: number;
  };
}

/** Property with additional stats */
export interface PropertyWithStats extends Property {
  /** Primary photo URL */
  primaryPhotoUrl?: string;
  /** Number of photos */
  photoCount: number;
  /** Average rating */
  averageRating: number;
  /** Total reviews */
  totalReviews: number;
  /** Upcoming bookings count */
  upcomingBookings: number;
  /** Current booking (if occupied) */
  currentBooking?: {
    guestName: string;
    checkOut: string;
  };
  /** Next booking (if scheduled) */
  nextBooking?: {
    guestName: string;
    checkIn: string;
  };
}

/** Property detail response */
export interface PropertyDetailResponse extends Property {
  photos: PropertyPhoto[];
  reviews: PropertyReview[];
  recentBookings: BookingSummary[];
  upcomingCleanings: CleaningJobSummary[];
  financialSummary: PropertyFinancials;
  amenitiesList: string[];
}

/** Property review */
export interface PropertyReview {
  id: string;
  guestName: string;
  guestAvatar?: string;
  platform: string;
  rating: number;
  comment: string;
  response?: string;
  createdAt: string;
}

/** Booking summary for property detail */
export interface BookingSummary {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  totalPrice: number;
}

/** Cleaning job summary */
export interface CleaningJobSummary {
  id: string;
  cleanerName?: string;
  scheduledAt: string;
  status: CleaningJobStatus;
  jobType: string;
}

/** Property financial summary */
export interface PropertyFinancials {
  /** Total revenue (all time) */
  totalRevenue: number;
  /** Revenue this month */
  monthlyRevenue: number;
  /** Revenue last month */
  lastMonthRevenue: number;
  /** Total expenses (all time) */
  totalExpenses: number;
  /** Expenses this month */
  monthlyExpenses: number;
  /** Net profit this month */
  monthlyProfit: number;
  /** Average nightly rate */
  avgNightlyRate: number;
  /** Average occupancy rate */
  avgOccupancy: number;
}

// ============================================
// BOOKING API
// ============================================

/** Calendar event for bookings display */
export interface CalendarEvent {
  /** Event ID */
  id: string;
  /** Event title */
  title: string;
  /** Start date/time */
  start: string;
  /** End date/time */
  end: string;
  /** All day event */
  allDay: boolean;
  /** Event color */
  color: string;
  /** Event type */
  type: 'booking' | 'cleaning' | 'blocked' | 'maintenance';
  /** Related resource ID */
  resourceId: string;
  /** Additional data */
  extendedProps: {
    propertyId: string;
    propertyName: string;
    guestName?: string;
    status?: string;
    platform?: string;
  };
}

/** Availability check request */
export interface AvailabilityCheckRequest {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guestCount?: number;
}

/** Availability check response */
export interface AvailabilityCheckResponse {
  available: boolean;
  conflictingBookings?: {
    id: string;
    checkIn: string;
    checkOut: string;
    guestName: string;
  }[];
  pricing?: {
    nightlyRate: number;
    nights: number;
    subtotal: number;
    cleaningFee: number;
    serviceFee: number;
    taxes: number;
    total: number;
  };
}

/** Booking creation response */
export interface CreateBookingResponse extends Booking {
  property: Property;
  guest: Guest;
  accessCode?: string;
}

// ============================================
// CLEANING API
// ============================================

/** Cleaner dashboard stats */
export interface CleanerDashboardStats {
  /** Jobs completed today */
  todayCompleted: number;
  /** Jobs remaining today */
  todayRemaining: number;
  /** Jobs this week */
  weekJobs: number;
  /** Average score */
  avgScore: number;
  /** Earnings this week */
  weekEarnings: number;
  /** Current streak (consecutive perfect scores) */
  currentStreak: number;
}

/** Cleaner leaderboard entry */
export interface LeaderboardEntry {
  /** Cleaner user ID */
  cleanerId: string;
  /** Cleaner name */
  name: string;
  /** Cleaner avatar */
  avatar?: string;
  /** Jobs completed this month */
  jobsCompleted: number;
  /** Average score */
  avgScore: number;
  /** Total points */
  points: number;
  /** Rank */
  rank: number;
  /** Rank change from last period */
  rankChange: number;
}

/** Cleaning job detail for mobile app */
export interface CleaningJobDetail extends CleaningJob {
  property: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
    wifiNetwork?: string;
    wifiPassword?: string;
    accessCode?: string;
    primaryPhoto?: string;
  };
  booking?: {
    id: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    specialReqs?: string;
  };
  checklist: {
    id: string;
    area: string;
    task: string;
    required: boolean;
    completed: boolean;
    photoUrl?: string;
  }[];
  reportedIssues: {
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    photoUrls: string[];
    resolved: boolean;
  }[];
}

/** GPS check-in request */
export interface GpsCheckInRequest {
  jobId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

/** GPS check-in response */
export interface GpsCheckInResponse {
  success: boolean;
  verified: boolean;
  distanceMeters?: number;
  message: string;
}

// ============================================
// SMART LOCK API
// ============================================

/** Lock status response */
export interface LockStatusResponse {
  id: string;
  propertyId: string;
  propertyName: string;
  brand: string;
  status: 'locked' | 'unlocked' | 'jammed' | 'offline';
  batteryLevel: number;
  lastActivity?: string;
  isOnline: boolean;
  currentCode?: string;
  codeExpiresAt?: string;
}

/** Generate code request */
export interface GenerateCodeRequest {
  lockId: string;
  bookingId?: string;
  name: string;
  type: 'guest' | 'cleaner' | 'maintenance';
  validFrom?: string;
  validUntil?: string;
}

/** Generate code response */
export interface GenerateCodeResponse {
  code: string;
  validFrom: string;
  validUntil: string;
  lockId: string;
}

/** Lock command request */
export interface LockCommandRequest {
  lockId: string;
  command: 'lock' | 'unlock';
}

/** Lock access history entry */
export interface LockAccessHistoryEntry {
  timestamp: string;
  action: 'lock' | 'unlock' | 'code_entry';
  method: 'code' | 'app' | 'manual' | 'auto';
  codeUsed?: string;
  userName?: string;
}

// ============================================
// MESSAGING API
// ============================================

/** Conversation thread */
export interface Conversation {
  id: string;
  guestId: string;
  guestName: string;
  guestAvatar?: string;
  propertyId?: string;
  propertyName?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'active' | 'archived';
}

/** Message thread response */
export interface MessageThread {
  conversation: Conversation;
  messages: MessageDetail[];
}

/** Message with details */
export interface MessageDetail extends Message {
  guest: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  booking?: {
    id: string;
    propertyName: string;
    checkIn: string;
    checkOut: string;
  };
}

/** Send message request */
export interface SendMessageRequest {
  guestId: string;
  bookingId?: string;
  channel: 'email' | 'sms' | 'whatsapp';
  subject?: string;
  body: string;
  scheduledFor?: string;
}

/** Message template */
export interface MessageTemplate {
  id: string;
  name: string;
  type: string;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

// ============================================
// FINANCE API
// ============================================

/** Financial summary response */
export interface FinancialSummaryResponse {
  period: {
    start: string;
    end: string;
    label: string;
  };
  revenue: {
    total: number;
    booking: number;
    fees: number;
    other: number;
  };
  expenses: {
    total: number;
    byCategory: Record<string, number>;
  };
  profit: {
    gross: number;
    net: number;
    margin: number;
  };
  comparison: {
    revenuePrevious: number;
    revenueChange: number;
    expensesPrevious: number;
    expensesChange: number;
    profitPrevious: number;
    profitChange: number;
  };
}

/** Property P&L report */
export interface PropertyPnLReport {
  propertyId: string;
  propertyName: string;
  period: {
    start: string;
    end: string;
  };
  income: {
    bookingRevenue: number;
    cleaningFees: number;
    otherIncome: number;
    total: number;
  };
  expenses: {
    cleaning: number;
    maintenance: number;
    utilities: number;
    supplies: number;
    marketing: number;
    insurance: number;
    taxes: number;
    other: number;
    total: number;
  };
  netIncome: number;
  roi: number;
  occupancyRate: number;
  avgNightlyRate: number;
}

/** Expense summary by category */
export interface ExpenseSummary {
  category: string;
  amount: number;
  count: number;
  percentOfTotal: number;
}

// ============================================
// CONCIERGE API
// ============================================

/** Concierge query request */
export interface ConciergeQueryRequest {
  query: string;
  sessionId?: string;
  propertyId?: string;
  bookingId?: string;
  guestType?: 'work_crew' | 'family' | 'couple' | 'business' | 'general';
  language?: string;
}

/** Concierge query response */
export interface ConciergeQueryResponse {
  response: string;
  sessionId: string;
  category?: string;
  intent?: string;
  confidence: number;
  suggestions?: string[];
  relatedFaq?: {
    question: string;
    answer: string;
  }[];
  actions?: {
    type: string;
    label: string;
    data: Record<string, unknown>;
  }[];
}

// ============================================
// WEBHOOK PAYLOADS
// ============================================

/** VRBO webhook payload */
export interface VRBOWebhookPayload {
  event: 'reservation_created' | 'reservation_updated' | 'reservation_cancelled';
  timestamp: string;
  reservation: {
    id: string;
    propertyId: string;
    checkIn: string;
    checkOut: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    adults: number;
    children: number;
    totalPrice: number;
    status: string;
  };
}

/** Airbnb webhook payload */
export interface AirbnbWebhookPayload {
  event_type: string;
  timestamp: string;
  confirmation_code: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  guest: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  };
  number_of_guests: number;
  payout_price: number;
  status: string;
}

/** Smart lock webhook payload */
export interface SmartLockWebhookPayload {
  event: 'lock' | 'unlock' | 'code_used' | 'low_battery' | 'offline';
  deviceId: string;
  timestamp: string;
  data: {
    batteryLevel?: number;
    codeUsed?: string;
    method?: string;
  };
}
