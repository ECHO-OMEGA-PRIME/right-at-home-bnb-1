// Right at Home BnB - TypeScript Types
// Derived from Prisma schema with additional frontend types

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  squareFeet: number | null;
  propertyType: string;
  amenities: string | null;
  wifiNetwork: string | null;
  wifiPassword: string | null;
  parkingInfo: string | null;
  checkInInstr: string | null;
  checkOutInstr: string | null;
  houseRules: string | null;
  cleaningChecklist: string | null;
  nightlyRate: number;
  cleaningFee: number | null;
  securityDeposit: number | null;
  airbnbId: string | null;
  vrboId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  photos?: PropertyPhoto[];
  bookings?: Booking[];
}

export interface PropertyPhoto {
  id: string;
  propertyId: string;
  url: string;
  caption: string | null;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface Guest {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  platform: string;
  platformId: string | null;
  firstStay: Date | null;
  lastStay: Date | null;
  totalStays: number;
  totalSpent: number;
  avgRating: number | null;
  tags: string | null;
  notes: string | null;
  preferences: string | null;
  isVip: boolean;
  vipTier: string | null;
  birthday: Date | null;
  anniversary: Date | null;
  createdAt: Date;
  updatedAt: Date;
  bookings?: Booking[];
}

export interface Booking {
  id: string;
  propertyId: string;
  guestId: string;
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  platform: string;
  confirmCode: string | null;
  nightlyRate: number;
  totalNights: number;
  subtotal: number;
  cleaningFee: number | null;
  serviceFee: number | null;
  taxes: number | null;
  totalPrice: number;
  accessCode: string | null;
  codeExpiresAt: Date | null;
  status: string;
  specialReqs: string | null;
  internalNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  property?: Property;
  guest?: Guest;
  cleaningJob?: CleaningJob;
}

export interface CleaningJob {
  id: string;
  propertyId: string;
  cleanerId: string | null;
  bookingId: string | null;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  jobType: string;
  status: string;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checklistProgress: string | null;
  photos: string | null;
  score: number | null;
  scoreFeedback: string | null;
  notes: string | null;
  issues: string | null;
  durationMins: number | null;
  createdAt: Date;
  updatedAt: Date;
  property?: Property;
  booking?: Booking;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Frontend-specific types
export interface PropertyWithStats extends Property {
  occupancyRate?: number;
  monthlyRevenue?: number;
  upcomingBookings?: number;
}

export interface BookingCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  propertyId: string;
  propertyName: string;
  guestName: string;
  status: string;
  platform: string;
  color: string;
}

export interface DashboardStats {
  totalProperties: number;
  totalBookings: number;
  occupancyRate: number;
  monthlyRevenue: number;
  upcomingCheckIns: number;
  pendingCleanings: number;
  totalGuests: number;
  vipGuests: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  bookings: number;
}

export interface OccupancyDataPoint {
  month: string;
  occupancy: number;
  bookings: number;
}

// API Response types
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

// Form types
export interface BookingFormData {
  propertyId: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  platform: string;
  nightlyRate: number;
  cleaningFee?: number;
  specialReqs?: string;
}

export interface GuestFormData {
  email: string;
  name: string;
  phone?: string;
  platform: string;
  notes?: string;
  isVip: boolean;
}

// Filter types
export interface PropertyFilters {
  status?: string;
  bedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

export interface BookingFilters {
  propertyId?: string;
  status?: string;
  platform?: string;
  startDate?: string;
  endDate?: string;
}
