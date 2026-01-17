/**
 * Right at Home BNB - Shared Types
 * Used across Web, Mobile, and Desktop platforms
 */

// ============================================
// USER & AUTH
// ============================================

export type UserRole = 'owner' | 'admin' | 'cleaner' | 'guest';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
  lastLogin?: Date;
}

export interface Cleaner extends User {
  role: 'cleaner';
  rating: number;
  totalJobs: number;
  completedJobs: number;
  currentLocation?: GeoLocation;
  isAvailable: boolean;
  preferredProperties?: string[];
  hourlyRate: number;
  bankAccount?: {
    routingNumber: string;
    accountNumber: string;
  };
}

export interface Guest extends User {
  role: 'guest';
  bookings: string[];
  preferences?: {
    earlyCheckin?: boolean;
    lateCheckout?: boolean;
    petFriendly?: boolean;
    quietHours?: boolean;
  };
  vipStatus?: boolean;
  totalStays: number;
  lifetimeValue: number;
}

// ============================================
// PROPERTY
// ============================================

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  location: GeoLocation;
  type: 'house' | 'apartment' | 'condo' | 'cabin' | 'studio';
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  amenities: string[];
  photos: string[];
  description: string;
  houseRules: string[];

  // Pricing
  baseRate: number;
  cleaningFee: number;
  weekendRate?: number;
  weeklyDiscount?: number;
  monthlyDiscount?: number;

  // Status
  status: 'active' | 'inactive' | 'maintenance';
  currentBooking?: string;
  nextBooking?: string;
  lastCleaned?: Date;

  // Smart Home
  smartLock?: SmartLock;
  thermostat?: Thermostat;

  // Calendar Sync
  airbnbCalendarUrl?: string;
  vrboCalendarUrl?: string;

  // Cleaning
  cleaningDuration: number; // minutes
  cleaningChecklist: CleaningChecklistItem[];
  assignedCleaners?: string[];

  createdAt: Date;
  updatedAt: Date;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

// ============================================
// BOOKING
// ============================================

export interface Booking {
  id: string;
  propertyId: string;
  guestId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;

  checkIn: Date;
  checkOut: Date;
  guests: number;

  // Pricing
  nightlyRate: number;
  nights: number;
  subtotal: number;
  cleaningFee: number;
  serviceFee: number;
  taxes: number;
  total: number;

  // Status
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  source: 'direct' | 'airbnb' | 'vrbo' | 'booking.com';
  externalId?: string;

  // Communication
  messagesSent: number;
  messagesScheduled: AutomatedMessage[];

  // Special requests
  notes?: string;
  specialRequests?: string[];

  createdAt: Date;
  updatedAt: Date;
}

export interface AutomatedMessage {
  id: string;
  type: 'booking_confirmed' | 'pre_arrival' | 'check_in_instructions' | 'post_checkout';
  scheduledFor: Date;
  sent: boolean;
  sentAt?: Date;
  content: string;
}

// ============================================
// CLEANING
// ============================================

export interface CleaningJob {
  id: string;
  propertyId: string;
  bookingId?: string;
  cleanerId?: string;

  scheduledDate: Date;
  scheduledTime: string;
  estimatedDuration: number; // minutes

  status: 'scheduled' | 'assigned' | 'in_progress' | 'completed' | 'verified' | 'issue_reported';
  priority: 'normal' | 'high' | 'urgent';

  // Check-in/out
  checkInTime?: Date;
  checkInLocation?: GeoLocation;
  checkOutTime?: Date;

  // Completion
  completedAt?: Date;
  completedBy?: string;
  report?: CleaningReport;

  // Payment
  rate: number;
  bonus?: number;
  paid: boolean;
  paidAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface CleaningReport {
  id: string;
  jobId: string;
  cleanerId: string;

  checklistCompleted: CleaningChecklistItem[];
  photos: CleaningPhoto[];
  issues: CleaningIssue[];

  notes?: string;
  duration: number; // actual minutes

  rating?: number; // from owner review
  feedback?: string;

  submittedAt: Date;
}

export interface CleaningChecklistItem {
  id: string;
  area: 'kitchen' | 'bathroom' | 'bedroom' | 'living' | 'outdoor' | 'general';
  task: string;
  required: boolean;
  completed?: boolean;
  photo?: string;
}

export interface CleaningPhoto {
  id: string;
  area: string;
  url: string;
  thumbnail?: string;
  takenAt: Date;
  location?: GeoLocation;
}

export interface CleaningIssue {
  id: string;
  type: 'damage' | 'missing' | 'maintenance' | 'supply' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  photos: string[];
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: string;
}

// ============================================
// SMART HOME
// ============================================

export interface SmartLock {
  id: string;
  propertyId: string;
  brand: 'august' | 'schlage' | 'yale' | 'kwikset' | 'other';
  model?: string;

  status: 'locked' | 'unlocked' | 'jammed' | 'offline';
  batteryLevel?: number;
  lastActivity?: Date;

  // Access codes
  masterCode?: string;
  guestCodes: AccessCode[];
  cleanerCodes: AccessCode[];

  apiConfig?: Record<string, unknown>;
}

export interface AccessCode {
  id: string;
  code: string;
  name: string;
  type: 'guest' | 'cleaner' | 'owner' | 'emergency';
  validFrom?: Date;
  validUntil?: Date;
  usageCount?: number;
  active: boolean;
}

export interface Thermostat {
  id: string;
  propertyId: string;
  brand: 'nest' | 'ecobee' | 'honeywell' | 'other';
  model?: string;

  currentTemp: number;
  targetTemp: number;
  mode: 'heat' | 'cool' | 'auto' | 'off';
  humidity?: number;

  schedule?: ThermostatSchedule[];

  apiConfig?: Record<string, unknown>;
}

export interface ThermostatSchedule {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  periods: {
    time: string;
    temp: number;
    mode: 'heat' | 'cool' | 'auto';
  }[];
}

// ============================================
// MESSAGING
// ============================================

export interface Message {
  id: string;
  conversationId: string;
  guestId: string;
  propertyId?: string;
  bookingId?: string;

  content: string;
  fromHost: boolean;
  automated: boolean;

  read: boolean;
  readAt?: Date;

  attachments?: Attachment[];

  createdAt: Date;
}

export interface Conversation {
  id: string;
  guestId: string;
  guestName: string;
  propertyId?: string;
  bookingId?: string;

  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: number;

  status: 'active' | 'archived';

  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  id: string;
  type: 'image' | 'document' | 'video';
  url: string;
  name: string;
  size: number;
}

// ============================================
// FINANCE
// ============================================

export interface Transaction {
  id: string;
  type: 'booking_income' | 'cleaning_expense' | 'maintenance' | 'utility' | 'supply' | 'other';
  category: string;

  propertyId?: string;
  bookingId?: string;
  cleaningJobId?: string;

  amount: number;
  currency: 'USD';

  description: string;
  vendor?: string;
  receipt?: string;

  date: Date;
  createdAt: Date;
}

export interface FinancialSummary {
  period: 'day' | 'week' | 'month' | 'year';
  startDate: Date;
  endDate: Date;

  totalIncome: number;
  totalExpenses: number;
  netProfit: number;

  incomeByProperty: Record<string, number>;
  expensesByCategory: Record<string, number>;

  occupancyRate: number;
  averageNightlyRate: number;

  topProperties: { id: string; name: string; revenue: number }[];
}

// ============================================
// NOTIFICATIONS
// ============================================

export interface Notification {
  id: string;
  userId: string;

  type: 'booking' | 'cleaning' | 'message' | 'payment' | 'alert' | 'system';
  title: string;
  body: string;

  data?: Record<string, unknown>;
  actionUrl?: string;

  read: boolean;
  readAt?: Date;

  createdAt: Date;
}

// ============================================
// SETTINGS
// ============================================

export interface AppSettings {
  userId: string;

  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    bookingAlerts: boolean;
    cleaningAlerts: boolean;
    messageAlerts: boolean;
    paymentAlerts: boolean;
  };

  automation: {
    autoAssignCleaners: boolean;
    autoSendMessages: boolean;
    autoGenerateCodes: boolean;
    autoAdjustThermostats: boolean;
  };

  display: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
    dateFormat: string;
    currency: string;
  };

  integrations: {
    airbnb: boolean;
    vrbo: boolean;
    stripe: boolean;
    square: boolean;
  };
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
