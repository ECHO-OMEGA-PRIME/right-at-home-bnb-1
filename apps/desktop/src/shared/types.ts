/**
 * Right at Home BnB - Shared Type Definitions
 */

// Property Types
export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  basePrice: number;
  cleaningFee: number;
  status: PropertyStatus;
  imageUrl?: string;
  amenities: string[];
  description: string;
  smartLockId?: string;
  createdAt: string;
  updatedAt: string;
}

export type PropertyStatus = 'active' | 'inactive' | 'maintenance';

// Booking Types
export interface Booking {
  id: string;
  propertyId: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: number;
  cleaningFee: number;
  serviceFee: number;
  status: BookingStatus;
  source: BookingSource;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
export type BookingSource = 'airbnb' | 'vrbo' | 'direct' | 'booking.com' | 'other';

// Guest Types
export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  totalBookings: number;
  totalSpent: number;
  rating: number;
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Cleaning Types
export interface CleaningJob {
  id: string;
  propertyId: string;
  bookingId?: string;
  cleanerId?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number; // in minutes
  status: CleaningStatus;
  type: CleaningType;
  checklist: CleaningChecklistItem[];
  notes?: string;
  completedAt?: string;
  photos?: string[];
  createdAt: string;
  updatedAt: string;
}

export type CleaningStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'issue';
export type CleaningType = 'turnover' | 'deep_clean' | 'inspection' | 'maintenance';

export interface CleaningChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  notes?: string;
}

export interface Cleaner {
  id: string;
  name: string;
  email: string;
  phone: string;
  hourlyRate: number;
  status: 'active' | 'inactive';
  assignedProperties: string[];
  createdAt: string;
}

// Financial Types
export interface Transaction {
  id: string;
  propertyId?: string;
  bookingId?: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string;
  date: string;
  paymentMethod?: string;
  receiptUrl?: string;
  createdAt: string;
}

export type TransactionType = 'income' | 'expense';
export type TransactionCategory =
  | 'booking_revenue'
  | 'cleaning_fee'
  | 'service_fee'
  | 'platform_fee'
  | 'cleaning_expense'
  | 'maintenance'
  | 'supplies'
  | 'utilities'
  | 'insurance'
  | 'taxes'
  | 'other';

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  revenueByProperty: Record<string, number>;
  expensesByCategory: Record<TransactionCategory, number>;
  occupancyRate: number;
  averageDailyRate: number;
  revenuePerAvailableRoom: number;
}

// Smart Lock Types
export interface SmartLock {
  id: string;
  propertyId: string;
  name: string;
  manufacturer: 'august' | 'yale' | 'schlage' | 'kwikset' | 'other';
  model?: string;
  status: LockStatus;
  batteryLevel: number;
  lastActivity?: string;
  accessCodes: AccessCode[];
  createdAt: string;
}

export type LockStatus = 'locked' | 'unlocked' | 'offline' | 'unknown';

export interface AccessCode {
  id: string;
  code: string;
  name: string;
  type: 'permanent' | 'temporary' | 'one_time';
  startDate?: string;
  endDate?: string;
  usageCount: number;
  lastUsed?: string;
  active: boolean;
}

// Dashboard Types
export interface DashboardStats {
  totalProperties: number;
  activeBookings: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  pendingCleanings: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  occupancyRate: number;
  upcomingBookings: Booking[];
  recentTransactions: Transaction[];
}

// Calendar Event Types
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'booking' | 'cleaning' | 'maintenance' | 'blocked';
  propertyId: string;
  resourceId?: string;
  color?: string;
  data?: Booking | CleaningJob;
}

// Settings Types
export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  minimizeToTray: boolean;
  startWithSystem: boolean;
  startMinimized: boolean;
  autoUpdate: boolean;
  offlineMode: boolean;
  backupPath: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  apiUrl: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Report Types
export interface Report {
  id: string;
  name: string;
  type: ReportType;
  dateRange: {
    start: string;
    end: string;
  };
  data: unknown;
  createdAt: string;
}

export type ReportType =
  | 'revenue'
  | 'occupancy'
  | 'expense'
  | 'property_performance'
  | 'guest_analytics';
