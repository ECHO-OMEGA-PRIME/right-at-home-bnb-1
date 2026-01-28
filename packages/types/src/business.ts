/**
 * Right at Home BnB - Business Logic Types
 * Types for business rules, calculations, and workflows
 * @packageDocumentation
 */

// ============================================
// PRICING & CALCULATIONS
// ============================================

/** Pricing configuration for a property */
export interface PricingConfig {
  /** Base nightly rate in USD */
  baseRate: number;
  /** Cleaning fee in USD */
  cleaningFee: number;
  /** Weekend rate multiplier (1.0 = same as base) */
  weekendMultiplier?: number;
  /** Holiday rate multiplier */
  holidayMultiplier?: number;
  /** Weekly discount percentage (0-100) */
  weeklyDiscount?: number;
  /** Monthly discount percentage (0-100) */
  monthlyDiscount?: number;
  /** Minimum nights requirement */
  minNights?: number;
  /** Maximum nights allowed */
  maxNights?: number;
  /** Extra guest fee (per guest beyond base) */
  extraGuestFee?: number;
  /** Base guests included in rate */
  baseGuests?: number;
  /** Pet fee */
  petFee?: number;
  /** Service fee percentage */
  serviceFeePercent?: number;
  /** Tax rate percentage */
  taxRate?: number;
}

/** Pricing breakdown for a booking */
export interface PricingBreakdown {
  /** Number of nights */
  nights: number;
  /** Breakdown by night */
  nightlyBreakdown: {
    date: string;
    rate: number;
    type: 'weekday' | 'weekend' | 'holiday';
  }[];
  /** Subtotal (nights only) */
  subtotal: number;
  /** Weekly discount applied */
  weeklyDiscount: number;
  /** Monthly discount applied */
  monthlyDiscount: number;
  /** Extra guest fees */
  extraGuestFees: number;
  /** Pet fee */
  petFee: number;
  /** Cleaning fee */
  cleaningFee: number;
  /** Service fee */
  serviceFee: number;
  /** Taxes */
  taxes: number;
  /** Security deposit (refundable) */
  securityDeposit: number;
  /** Total amount due */
  total: number;
  /** Currency */
  currency: 'USD';
}

/** Dynamic pricing adjustment */
export interface PricingAdjustment {
  /** Adjustment type */
  type: 'demand' | 'event' | 'seasonal' | 'last_minute' | 'gap_fill' | 'manual';
  /** Adjustment percentage (+/-) */
  percentage: number;
  /** Reason/description */
  reason: string;
  /** Valid from date */
  validFrom?: string;
  /** Valid until date */
  validUntil?: string;
  /** Property IDs to apply to (empty = all) */
  propertyIds?: string[];
}

// ============================================
// AVAILABILITY & CALENDAR
// ============================================

/** Day availability status */
export interface DayAvailability {
  /** Date string (YYYY-MM-DD) */
  date: string;
  /** Whether available for booking */
  available: boolean;
  /** Reason if unavailable */
  unavailableReason?: 'booked' | 'blocked' | 'maintenance' | 'minimum_stay' | 'past';
  /** Booking ID if booked */
  bookingId?: string;
  /** Nightly rate for this date */
  rate?: number;
  /** Whether minimum stay requirement met */
  meetsMinimum?: boolean;
}

/** Calendar block (manual or synced) */
export interface CalendarBlock {
  /** Block ID */
  id: string;
  /** Property ID */
  propertyId: string;
  /** Start date */
  startDate: string;
  /** End date */
  endDate: string;
  /** Block reason */
  reason: 'owner_use' | 'maintenance' | 'external_booking' | 'other';
  /** Notes */
  notes?: string;
  /** Source (manual, airbnb, vrbo, etc) */
  source: string;
  /** Whether synced from external */
  isExternal: boolean;
}

/** iCal feed configuration */
export interface ICalFeed {
  /** Feed ID */
  id: string;
  /** Property ID */
  propertyId: string;
  /** Feed URL */
  url: string;
  /** Feed source */
  source: 'airbnb' | 'vrbo' | 'booking' | 'other';
  /** Feed name */
  name: string;
  /** Last sync timestamp */
  lastSynced?: string;
  /** Sync status */
  status: 'active' | 'error' | 'disabled';
  /** Error message if any */
  error?: string;
}

// ============================================
// CLEANING WORKFLOW
// ============================================

/** Cleaning schedule configuration */
export interface CleaningScheduleConfig {
  /** Default duration in minutes */
  defaultDuration: number;
  /** Buffer time after checkout (hours) */
  checkoutBuffer: number;
  /** Buffer time before checkin (hours) */
  checkinBuffer: number;
  /** Auto-assign cleaners */
  autoAssign: boolean;
  /** Preferred cleaner assignment */
  preferredCleaners?: string[];
  /** GPS verification required */
  gpsRequired: boolean;
  /** GPS verification radius (meters) */
  gpsRadius: number;
  /** Photo requirements */
  photoRequirements: {
    minPhotos: number;
    requiredAreas: string[];
  };
}

/** Cleaner performance metrics */
export interface CleanerMetrics {
  /** Cleaner user ID */
  cleanerId: string;
  /** Period start */
  periodStart: string;
  /** Period end */
  periodEnd: string;
  /** Total jobs */
  totalJobs: number;
  /** Completed jobs */
  completedJobs: number;
  /** On-time completion rate */
  onTimeRate: number;
  /** Average quality score */
  avgScore: number;
  /** Issues reported count */
  issuesReported: number;
  /** Average duration vs estimate */
  avgDurationVsEstimate: number;
  /** Total earnings */
  totalEarnings: number;
  /** Bonuses earned */
  bonusesEarned: number;
}

/** Cleaning quality criteria */
export interface QualityCriteria {
  /** Category */
  category: 'cleanliness' | 'completeness' | 'timeliness' | 'photos' | 'communication';
  /** Weight (0-100) */
  weight: number;
  /** Maximum points */
  maxPoints: number;
  /** Scoring rules */
  rules: {
    condition: string;
    points: number;
  }[];
}

// ============================================
// GUEST CRM & MARKETING
// ============================================

/** Guest segment definition */
export interface GuestSegment {
  /** Segment ID */
  id: string;
  /** Segment name */
  name: string;
  /** Description */
  description: string;
  /** Filter criteria */
  criteria: {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
    value: unknown;
  }[];
  /** Number of guests in segment */
  guestCount?: number;
}

/** Marketing campaign */
export interface MarketingCampaign {
  /** Campaign ID */
  id: string;
  /** Campaign name */
  name: string;
  /** Campaign type */
  type: 'email' | 'sms' | 'promo_code';
  /** Target segment IDs */
  segments: string[];
  /** Campaign status */
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'paused';
  /** Scheduled send time */
  scheduledFor?: string;
  /** Campaign content */
  content: {
    subject?: string;
    body: string;
    promoCode?: string;
    discountPercent?: number;
  };
  /** Campaign metrics */
  metrics?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    revenue: number;
  };
}

/** Guest lifecycle stage */
export type GuestLifecycleStage =
  | 'prospect'
  | 'first_time'
  | 'returning'
  | 'loyal'
  | 'vip'
  | 'at_risk'
  | 'lapsed';

/** Guest engagement score */
export interface GuestEngagement {
  /** Guest ID */
  guestId: string;
  /** Lifecycle stage */
  stage: GuestLifecycleStage;
  /** Engagement score (0-100) */
  score: number;
  /** Score factors */
  factors: {
    recency: number;
    frequency: number;
    monetary: number;
    sentiment: number;
  };
  /** Next best action */
  nextAction?: {
    type: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  };
}

// ============================================
// REPORTING & ANALYTICS
// ============================================

/** Report configuration */
export interface ReportConfig {
  /** Report type */
  type: 'revenue' | 'occupancy' | 'expenses' | 'cleaners' | 'guests' | 'custom';
  /** Report name */
  name: string;
  /** Date range */
  dateRange: {
    start: string;
    end: string;
  };
  /** Grouping */
  groupBy?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'property';
  /** Filters */
  filters?: {
    propertyIds?: string[];
    platforms?: string[];
    statuses?: string[];
  };
  /** Columns to include */
  columns?: string[];
  /** Sort configuration */
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/** Report data point */
export interface ReportDataPoint {
  /** Label (date, property name, etc) */
  label: string;
  /** Primary value */
  value: number;
  /** Previous period value for comparison */
  previousValue?: number;
  /** Change percentage */
  change?: number;
  /** Additional metrics */
  metrics?: Record<string, number>;
}

/** Report result */
export interface ReportResult {
  /** Report configuration */
  config: ReportConfig;
  /** Generated timestamp */
  generatedAt: string;
  /** Summary metrics */
  summary: {
    total: number;
    average: number;
    min: number;
    max: number;
    count: number;
  };
  /** Data points */
  data: ReportDataPoint[];
  /** Comparison with previous period */
  comparison?: {
    previousTotal: number;
    change: number;
    changePercent: number;
  };
}

// ============================================
// NOTIFICATIONS & ALERTS
// ============================================

/** Notification preferences */
export interface NotificationPreferences {
  /** Email notifications */
  email: {
    enabled: boolean;
    address: string;
    types: string[];
  };
  /** Push notifications */
  push: {
    enabled: boolean;
    types: string[];
  };
  /** SMS notifications */
  sms: {
    enabled: boolean;
    phone: string;
    types: string[];
  };
  /** Quiet hours */
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm
    end: string; // HH:mm
    timezone: string;
  };
}

/** Alert configuration */
export interface AlertConfig {
  /** Alert ID */
  id: string;
  /** Alert name */
  name: string;
  /** Alert type */
  type: 'booking' | 'cleaning' | 'lock' | 'payment' | 'review' | 'issue' | 'system';
  /** Condition */
  condition: {
    field: string;
    operator: string;
    value: unknown;
  };
  /** Action to take */
  action: 'notify' | 'email' | 'sms' | 'webhook';
  /** Recipients */
  recipients: string[];
  /** Priority */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  /** Whether active */
  isActive: boolean;
}

// ============================================
// AUTOMATION & WORKFLOWS
// ============================================

/** Automation rule */
export interface AutomationRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Trigger event */
  trigger: {
    event: string;
    conditions?: {
      field: string;
      operator: string;
      value: unknown;
    }[];
  };
  /** Actions to perform */
  actions: {
    type: string;
    config: Record<string, unknown>;
    delay?: number; // seconds
  }[];
  /** Whether active */
  isActive: boolean;
  /** Execution count */
  executionCount?: number;
  /** Last executed */
  lastExecuted?: string;
}

/** Workflow step */
export interface WorkflowStep {
  /** Step ID */
  id: string;
  /** Step name */
  name: string;
  /** Step type */
  type: 'action' | 'condition' | 'delay' | 'notification';
  /** Step configuration */
  config: Record<string, unknown>;
  /** Next step IDs */
  next?: string[];
  /** Condition for branching */
  condition?: {
    field: string;
    operator: string;
    value: unknown;
    trueNext: string;
    falseNext: string;
  };
}

/** Workflow definition */
export interface Workflow {
  /** Workflow ID */
  id: string;
  /** Workflow name */
  name: string;
  /** Description */
  description: string;
  /** Trigger */
  trigger: string;
  /** Steps */
  steps: WorkflowStep[];
  /** Entry step ID */
  entryStep: string;
  /** Whether active */
  isActive: boolean;
}

// ============================================
// INTEGRATION CONFIGURATIONS
// ============================================

/** External platform integration */
export interface PlatformIntegration {
  /** Platform identifier */
  platform: 'airbnb' | 'vrbo' | 'booking' | 'stripe' | 'square' | 'twilio' | 'sendgrid';
  /** Whether enabled */
  enabled: boolean;
  /** Connection status */
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  /** Last sync timestamp */
  lastSync?: string;
  /** Error message if any */
  error?: string;
  /** Platform-specific config */
  config: Record<string, unknown>;
}

/** Webhook subscription */
export interface WebhookSubscription {
  /** Subscription ID */
  id: string;
  /** Webhook URL */
  url: string;
  /** Events to subscribe to */
  events: string[];
  /** Secret for verification */
  secret: string;
  /** Whether active */
  isActive: boolean;
  /** Last triggered */
  lastTriggered?: string;
  /** Failure count */
  failureCount: number;
}

// ============================================
// SETTINGS & CONFIGURATION
// ============================================

/** System settings */
export interface SystemSettings {
  /** Business settings */
  business: {
    name: string;
    email: string;
    phone: string;
    address: string;
    timezone: string;
    currency: 'USD';
    taxId?: string;
  };
  /** Default pricing */
  defaultPricing: PricingConfig;
  /** Cleaning settings */
  cleaning: CleaningScheduleConfig;
  /** Booking settings */
  booking: {
    allowInstantBook: boolean;
    requireIdVerification: boolean;
    minAdvanceBooking: number; // hours
    maxAdvanceBooking: number; // days
    cancellationPolicy: 'flexible' | 'moderate' | 'strict' | 'super_strict';
  };
  /** Communication settings */
  communication: {
    autoRespond: boolean;
    responseDelay: number; // minutes
    defaultLanguage: string;
  };
  /** Smart home settings */
  smartHome: {
    autoLockOnCheckout: boolean;
    guestCodeLength: number;
    codeExpirationBuffer: number; // hours
  };
}

/** User settings */
export interface UserSettings {
  /** User ID */
  userId: string;
  /** Display preferences */
  display: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
    dateFormat: string;
    numberFormat: string;
  };
  /** Notification preferences */
  notifications: NotificationPreferences;
  /** Dashboard layout */
  dashboard: {
    widgets: string[];
    layout: 'grid' | 'list';
    defaultView: 'day' | 'week' | 'month';
  };
}
