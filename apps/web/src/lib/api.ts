/**
 * Right at Home BnB - API Client
 * Full TypeScript API client with React Query integration
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

// ============================================
// API CONFIGURATION
// ============================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Auth interceptor
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Error interceptor
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Redirect to login on unauthorized
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============================================
// TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  role: 'ADMIN' | 'CLEANER' | 'GUEST';
  isActive: boolean;
  createdAt: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  squareFeet?: number;
  propertyType: 'HOUSE' | 'APARTMENT' | 'CONDO' | 'TOWNHOUSE' | 'CABIN';
  amenities?: string[];
  wifiNetwork?: string;
  wifiPassword?: string;
  nightlyRate: number;
  cleaningFee?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  createdAt: string;
}

export interface Guest {
  id: string;
  email: string;
  name: string;
  phone?: string;
  platform: 'AIRBNB' | 'VRBO' | 'BOOKING' | 'DIRECT' | 'OTHER';
  totalStays: number;
  totalSpent: number;
  avgRating?: number;
  tags?: string[];
  isVip: boolean;
  vipTier?: 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
  createdAt: string;
}

export interface Booking {
  id: string;
  propertyId: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  platform: string;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  accessCode?: string;
  property?: Property;
  guest?: Guest;
}

export interface CleaningJob {
  id: string;
  propertyId: string;
  cleanerId?: string;
  bookingId?: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  jobType: 'TURNOVER' | 'DEEP_CLEAN' | 'INSPECTION' | 'MAINTENANCE';
  status: 'SCHEDULED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  score?: number;
  durationMins?: number;
  property?: Property;
  cleaner?: User;
}

export interface SmartLock {
  id: string;
  propertyId: string;
  brand: 'SCHLAGE' | 'YALE' | 'AUGUST' | 'KWIKSET' | 'OTHER';
  model?: string;
  deviceId: string;
  currentCode?: string;
  codeExpiresAt?: string;
  batteryLevel?: number;
  isOnline: boolean;
  property?: Property;
}

export interface Message {
  id: string;
  guestId: string;
  bookingId?: string;
  type: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'APP_NOTIFICATION';
  subject?: string;
  body: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SCHEDULED' | 'SENT';
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  guest?: Guest;
}

export interface Expense {
  id: string;
  propertyId: string;
  category: string;
  amount: number;
  description: string;
  vendor?: string;
  date: string;
  receiptUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  property?: Property;
}

export interface DashboardStats {
  activeCleanings: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  occupancyRate: number;
  monthlyRevenue: number;
  pendingTasks: number;
  avgGuestRating: number;
}

// ============================================
// PHOTO TYPES
// ============================================

export interface PropertyPhoto {
  id: string;
  propertyId: string;
  url: string;
  thumbnailUrl?: string;
  alt: string;
  category: 'exterior' | 'living' | 'bedroom' | 'bathroom' | 'kitchen' | 'amenity' | 'other';
  isPrimary: boolean;
  sortOrder: number;
  width?: number;
  height?: number;
  createdAt: string;
}

export interface PhotoUploadRequest {
  propertyId: string;
  file: File;
  category?: PropertyPhoto['category'];
  alt?: string;
  isPrimary?: boolean;
}

export interface PhotoUpdateRequest {
  alt?: string;
  category?: PropertyPhoto['category'];
  isPrimary?: boolean;
  sortOrder?: number;
}

// ============================================
// REVIEW TYPES
// ============================================

export interface Review {
  id: string;
  propertyId: string;
  bookingId: string;
  guestId: string;
  guestName: string;
  guestAvatar?: string;
  platform: 'AIRBNB' | 'VRBO' | 'BOOKING' | 'DIRECT' | 'GOOGLE';
  overallRating: number;
  cleanlinessRating?: number;
  communicationRating?: number;
  checkInRating?: number;
  accuracyRating?: number;
  locationRating?: number;
  valueRating?: number;
  comment: string;
  hostResponse?: string;
  hostRespondedAt?: string;
  stayDate: string;
  createdAt: string;
  isVerified: boolean;
  isPublic: boolean;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  categoryAverages: {
    cleanliness: number;
    communication: number;
    checkIn: number;
    accuracy: number;
    location: number;
    value: number;
  };
  platformBreakdown: {
    platform: string;
    count: number;
    averageRating: number;
  }[];
  recentTrend: 'improving' | 'stable' | 'declining';
}

export interface ReviewResponse {
  reviewId: string;
  response: string;
}

export interface PropertyWithDetails extends Property {
  photos: PropertyPhoto[];
  reviews: Review[];
  reviewStats: ReviewStats;
  rating: number;
  reviewCount: number;
}

// ============================================
// API FUNCTIONS
// ============================================

// Dashboard Stats
export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const { data } = await api.get('/api/stats');
  return data;
};

// Properties - Use local Next.js API route for property data
export const fetchProperties = async (): Promise<Property[]> => {
  // Use local Next.js API route (not external backend)
  const response = await fetch('/api/properties');
  if (!response.ok) {
    throw new Error('Failed to fetch properties');
  }
  const data = await response.json();
  // API returns { properties: [...], total } — extract the array
  return data.properties ?? data ?? [];
};

export const fetchProperty = async (id: string): Promise<Property> => {
  // Use local Next.js API route
  const response = await fetch(`/api/properties?id=${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch property');
  }
  return response.json();
};

export const createProperty = async (property: Partial<Property>): Promise<Property> => {
  const { data } = await api.post('/api/properties', property);
  return data;
};

export const updateProperty = async (id: string, property: Partial<Property>): Promise<Property> => {
  const { data } = await api.put(`/api/properties/${id}`, property);
  return data;
};

export const fetchPropertyOccupancy = async (id: string) => {
  const { data } = await api.get(`/api/properties/${id}/occupancy`);
  return data;
};

export const fetchPropertyFinancials = async (id: string) => {
  const { data } = await api.get(`/api/properties/${id}/financials`);
  return data;
};

// Property Photos
export const fetchPropertyPhotos = async (propertyId: string): Promise<PropertyPhoto[]> => {
  const { data } = await api.get(`/api/properties/${propertyId}/photos`);
  return data;
};

export const uploadPropertyPhoto = async (request: PhotoUploadRequest): Promise<PropertyPhoto> => {
  const formData = new FormData();
  formData.append('file', request.file);
  formData.append('propertyId', request.propertyId);
  if (request.category) formData.append('category', request.category);
  if (request.alt) formData.append('alt', request.alt);
  if (request.isPrimary !== undefined) formData.append('isPrimary', String(request.isPrimary));

  const { data } = await api.post(`/api/properties/${request.propertyId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const updatePropertyPhoto = async (
  propertyId: string,
  photoId: string,
  updates: PhotoUpdateRequest
): Promise<PropertyPhoto> => {
  const { data } = await api.patch(`/api/properties/${propertyId}/photos/${photoId}`, updates);
  return data;
};

export const deletePropertyPhoto = async (propertyId: string, photoId: string): Promise<void> => {
  await api.delete(`/api/properties/${propertyId}/photos/${photoId}`);
};

export const reorderPropertyPhotos = async (
  propertyId: string,
  photoIds: string[]
): Promise<PropertyPhoto[]> => {
  const { data } = await api.post(`/api/properties/${propertyId}/photos/reorder`, { photoIds });
  return data;
};

export const setPrimaryPhoto = async (propertyId: string, photoId: string): Promise<PropertyPhoto> => {
  const { data } = await api.post(`/api/properties/${propertyId}/photos/${photoId}/set-primary`);
  return data;
};

// Property Reviews
export const fetchPropertyReviews = async (propertyId: string): Promise<Review[]> => {
  const { data } = await api.get(`/api/properties/${propertyId}/reviews`);
  return data;
};

export const fetchPropertyReviewStats = async (propertyId: string): Promise<ReviewStats> => {
  const { data } = await api.get(`/api/properties/${propertyId}/reviews/stats`);
  return data;
};

export const fetchPropertyWithDetails = async (propertyId: string): Promise<PropertyWithDetails> => {
  const { data } = await api.get(`/api/properties/${propertyId}/full`);
  return data;
};

export const respondToReview = async (
  propertyId: string,
  reviewId: string,
  response: string
): Promise<Review> => {
  const { data } = await api.post(`/api/properties/${propertyId}/reviews/${reviewId}/respond`, { response });
  return data;
};

export const flagReview = async (
  propertyId: string,
  reviewId: string,
  reason: string
): Promise<void> => {
  await api.post(`/api/properties/${propertyId}/reviews/${reviewId}/flag`, { reason });
};

// Guests
export const fetchGuests = async (): Promise<Guest[]> => {
  const { data } = await api.get('/api/guests');
  return data;
};

export const fetchGuest = async (id: string): Promise<Guest> => {
  const { data } = await api.get(`/api/guests/${id}`);
  return data;
};

export const createGuest = async (guest: Partial<Guest>): Promise<Guest> => {
  const { data } = await api.post('/api/guests', guest);
  return data;
};

export const updateGuest = async (id: string, guest: Partial<Guest>): Promise<Guest> => {
  const { data } = await api.put(`/api/guests/${id}`, guest);
  return data;
};

// Bookings
export const fetchBookings = async (): Promise<Booking[]> => {
  const { data } = await api.get('/api/bookings');
  return data;
};

export const fetchBooking = async (id: string): Promise<Booking> => {
  const { data } = await api.get(`/api/bookings/${id}`);
  return data;
};

// Cleaners
export const fetchCleaners = async (): Promise<User[]> => {
  const { data } = await api.get('/api/cleaners');
  return data;
};

export const fetchCleaningJobs = async (): Promise<CleaningJob[]> => {
  const { data } = await api.get('/api/cleaners/jobs');
  return data;
};

export const fetchCleanerLeaderboard = async () => {
  const { data } = await api.get('/api/cleaners/leaderboard');
  return data;
};

// Smart Locks
export const fetchLocks = async (): Promise<SmartLock[]> => {
  const { data } = await api.get('/api/locks');
  return data;
};

export const generateLockCode = async (lockId: string, bookingId: string) => {
  const { data } = await api.post(`/api/locks/${lockId}/generate-code`, { bookingId });
  return data;
};

export const revokeLockCode = async (lockId: string) => {
  const { data } = await api.post(`/api/locks/${lockId}/revoke-code`);
  return data;
};

// Messages
export const fetchMessages = async (): Promise<Message[]> => {
  const { data } = await api.get('/api/messages');
  return data;
};

export const fetchPendingMessages = async (): Promise<Message[]> => {
  const { data } = await api.get('/api/messages/pending');
  return data;
};

export const approveMessage = async (id: string): Promise<Message> => {
  const { data } = await api.post(`/api/messages/${id}/approve`);
  return data;
};

export const sendMessage = async (id: string): Promise<Message> => {
  const { data } = await api.post(`/api/messages/${id}/send`);
  return data;
};

// Finance
export const fetchExpenses = async (): Promise<Expense[]> => {
  const { data } = await api.get('/api/finance/expenses');
  return data;
};

export const fetchFinancialSummary = async () => {
  const { data } = await api.get('/api/finance/summary');
  return data;
};

export const fetchPropertyPnL = async (propertyId: string) => {
  const { data } = await api.get(`/api/finance/pnl/${propertyId}`);
  return data;
};

// PayPal Integration
export interface PayPalStats {
  total_invoices: number;
  total_paid: number;
  total_pending: number;
  total_revenue: number;
  total_surcharges: number;
  avg_invoice: number;
}

export interface PayPalTransaction {
  id: number;
  invoice_id: number;
  paypal_transaction_id: string;
  amount: number;
  method: string;
  status: string;
  payer_email: string;
  notes: string;
  created_at: string;
}

export interface Payment {
  id: number;
  invoice_id: number;
  paypal_transaction_id: string;
  amount: number;
  method: string;
  status: string;
  payer_email: string;
  notes: string;
  created_at: string;
}

export const fetchPayPalStats = async (): Promise<PayPalStats> => {
  const { data } = await api.get('/paypal/stats');
  return data;
};

export const fetchPayPalTransactions = async (limit = 50, offset = 0): Promise<{ transactions: PayPalTransaction[]; total: number }> => {
  const { data } = await api.get(`/paypal/transactions?limit=${limit}&offset=${offset}`);
  return data;
};

export const fetchPayments = async (limit = 50, offset = 0): Promise<{ payments: Payment[]; total: number }> => {
  const { data } = await api.get(`/payments?limit=${limit}&offset=${offset}`);
  return data;
};

export const createPayPalInvoice = async (invoiceId: number): Promise<{ paypal_invoice_id: string; status: string }> => {
  const { data } = await api.post(`/invoices/${invoiceId}/paypal`);
  return data;
};

export const createPaymentLink = async (invoiceId: number, sendSms = false): Promise<{ payment_link: string }> => {
  const { data } = await api.post(`/invoices/${invoiceId}/payment-link`, { send_sms: sendSms });
  return data;
};

export const recordPayment = async (payment: { invoice_id: number; amount: number; method?: string; payer_email?: string; notes?: string }): Promise<Payment> => {
  const { data } = await api.post('/payments', payment);
  return data;
};

// Concierge - Uses local Next.js API route
export interface ConciergeQueryParams {
  query: string;
  sessionId?: string;
  propertyId?: string;
  guestType?: 'work_crew' | 'family' | 'couple' | 'business' | 'general';
}

export const sendConciergeQuery = async (params: ConciergeQueryParams) => {
  // Use local Next.js API route (not backend)
  const response = await fetch('/api/concierge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error('Concierge query failed');
  }
  return response.json();
};

// ============================================
// REACT QUERY HOOKS
// ============================================

// Dashboard
export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

// Properties
export const useProperties = () => {
  return useQuery({
    queryKey: ['properties'],
    queryFn: fetchProperties,
  });
};

export const useProperty = (id: string) => {
  return useQuery({
    queryKey: ['property', id],
    queryFn: () => fetchProperty(id),
    enabled: !!id,
  });
};

export const usePropertyOccupancy = (id: string) => {
  return useQuery({
    queryKey: ['propertyOccupancy', id],
    queryFn: () => fetchPropertyOccupancy(id),
    enabled: !!id,
  });
};

export const usePropertyFinancials = (id: string) => {
  return useQuery({
    queryKey: ['propertyFinancials', id],
    queryFn: () => fetchPropertyFinancials(id),
    enabled: !!id,
  });
};

export const useCreateProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProperty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property created successfully!');
    },
    onError: () => {
      toast.error('Failed to create property');
    },
  });
};

// Property Photos Hooks
export const usePropertyPhotos = (propertyId: string) => {
  return useQuery({
    queryKey: ['propertyPhotos', propertyId],
    queryFn: () => fetchPropertyPhotos(propertyId),
    enabled: !!propertyId,
  });
};

export const useUploadPropertyPhoto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadPropertyPhoto,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyPhotos', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property', variables.propertyId] });
      toast.success('Photo uploaded successfully!');
    },
    onError: () => {
      toast.error('Failed to upload photo');
    },
  });
};

export const useUpdatePropertyPhoto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, photoId, updates }: { propertyId: string; photoId: string; updates: PhotoUpdateRequest }) =>
      updatePropertyPhoto(propertyId, photoId, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyPhotos', variables.propertyId] });
      toast.success('Photo updated!');
    },
    onError: () => {
      toast.error('Failed to update photo');
    },
  });
};

export const useDeletePropertyPhoto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, photoId }: { propertyId: string; photoId: string }) =>
      deletePropertyPhoto(propertyId, photoId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyPhotos', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property', variables.propertyId] });
      toast.success('Photo deleted!');
    },
    onError: () => {
      toast.error('Failed to delete photo');
    },
  });
};

export const useReorderPropertyPhotos = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, photoIds }: { propertyId: string; photoIds: string[] }) =>
      reorderPropertyPhotos(propertyId, photoIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyPhotos', variables.propertyId] });
      toast.success('Photos reordered!');
    },
    onError: () => {
      toast.error('Failed to reorder photos');
    },
  });
};

export const useSetPrimaryPhoto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, photoId }: { propertyId: string; photoId: string }) =>
      setPrimaryPhoto(propertyId, photoId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyPhotos', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property', variables.propertyId] });
      toast.success('Primary photo set!');
    },
    onError: () => {
      toast.error('Failed to set primary photo');
    },
  });
};

// Property Reviews Hooks
export const usePropertyReviews = (propertyId: string) => {
  return useQuery({
    queryKey: ['propertyReviews', propertyId],
    queryFn: () => fetchPropertyReviews(propertyId),
    enabled: !!propertyId,
  });
};

export const usePropertyReviewStats = (propertyId: string) => {
  return useQuery({
    queryKey: ['propertyReviewStats', propertyId],
    queryFn: () => fetchPropertyReviewStats(propertyId),
    enabled: !!propertyId,
  });
};

export const usePropertyWithDetails = (propertyId: string) => {
  return useQuery({
    queryKey: ['propertyWithDetails', propertyId],
    queryFn: () => fetchPropertyWithDetails(propertyId),
    enabled: !!propertyId,
  });
};

export const useRespondToReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, reviewId, response }: { propertyId: string; reviewId: string; response: string }) =>
      respondToReview(propertyId, reviewId, response),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyReviews', variables.propertyId] });
      toast.success('Response posted!');
    },
    onError: () => {
      toast.error('Failed to post response');
    },
  });
};

export const useFlagReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, reviewId, reason }: { propertyId: string; reviewId: string; reason: string }) =>
      flagReview(propertyId, reviewId, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['propertyReviews', variables.propertyId] });
      toast.success('Review flagged for review');
    },
    onError: () => {
      toast.error('Failed to flag review');
    },
  });
};

// Bookings
export const useBookings = () => {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: fetchBookings,
  });
};

export const useBooking = (id: string) => {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: () => fetchBooking(id),
    enabled: !!id,
  });
};

// Guests
export const useGuests = () => {
  return useQuery({
    queryKey: ['guests'],
    queryFn: fetchGuests,
  });
};

export const useGuest = (id: string) => {
  return useQuery({
    queryKey: ['guest', id],
    queryFn: () => fetchGuest(id),
    enabled: !!id,
  });
};

// Cleaners
export const useCleaners = () => {
  return useQuery({
    queryKey: ['cleaners'],
    queryFn: fetchCleaners,
  });
};

export const useCleaningJobs = () => {
  return useQuery({
    queryKey: ['cleaningJobs'],
    queryFn: fetchCleaningJobs,
  });
};

export const useCleanerLeaderboard = () => {
  return useQuery({
    queryKey: ['cleanerLeaderboard'],
    queryFn: fetchCleanerLeaderboard,
  });
};

// Smart Locks
export const useLocks = () => {
  return useQuery({
    queryKey: ['locks'],
    queryFn: fetchLocks,
  });
};

// Messages
export const useMessages = () => {
  return useQuery({
    queryKey: ['messages'],
    queryFn: fetchMessages,
  });
};

export const usePendingMessages = () => {
  return useQuery({
    queryKey: ['pendingMessages'],
    queryFn: fetchPendingMessages,
    refetchInterval: 60000, // Check every minute
  });
};

export const useApproveMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['pendingMessages'] });
      toast.success('Message approved!');
    },
  });
};

// Finance
export const useExpenses = () => {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: fetchExpenses,
  });
};

export const useFinancialSummary = () => {
  return useQuery({
    queryKey: ['financialSummary'],
    queryFn: fetchFinancialSummary,
  });
};

// PayPal
export const usePayPalStats = () => {
  return useQuery({
    queryKey: ['paypalStats'],
    queryFn: fetchPayPalStats,
    refetchInterval: 60000,
  });
};

export const usePayPalTransactions = (limit = 50, offset = 0) => {
  return useQuery({
    queryKey: ['paypalTransactions', limit, offset],
    queryFn: () => fetchPayPalTransactions(limit, offset),
  });
};

export const usePayments = (limit = 50, offset = 0) => {
  return useQuery({
    queryKey: ['payments', limit, offset],
    queryFn: () => fetchPayments(limit, offset),
  });
};

export const useCreatePayPalInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: number) => createPayPalInvoice(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paypalStats'] });
      queryClient.invalidateQueries({ queryKey: ['paypalTransactions'] });
      toast.success('PayPal invoice created and sent!');
    },
    onError: () => {
      toast.error('Failed to create PayPal invoice');
    },
  });
};

export const useCreatePaymentLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, sendSms }: { invoiceId: number; sendSms?: boolean }) =>
      createPaymentLink(invoiceId, sendSms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paypalStats'] });
      toast.success('Payment link created!');
    },
    onError: () => {
      toast.error('Failed to create payment link');
    },
  });
};

export const useRecordPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['paypalStats'] });
      toast.success('Payment recorded!');
    },
    onError: () => {
      toast.error('Failed to record payment');
    },
  });
};

// ============================================
// ANALYTICS API
// ============================================

export interface AnalyticsResponse {
  totals: {
    totalRevenue: number;
    revenueChange: number;
    totalBookings: number;
    bookingsChange: number;
    avgOccupancy: number;
    occupancyChange: number;
    avgNightlyRate: number;
    rateChange: number;
    totalExpenses: number;
    expensesChange: number;
    avgRating: string;
    reviewCount: number;
  };
  monthly: { month: string; revenue: number; bookings: number; occupancy: number }[];
  platforms: { name: string; value: number; color: string }[];
  properties: {
    id: string;
    name: string;
    revenue: number;
    bookings: number;
    occupancy: number;
    avgNightlyRate: number;
    avgRating: string;
  }[];
}

async function fetchAnalytics(range: string): Promise<AnalyticsResponse> {
  const { data } = await api.get(`/analytics?range=${range}`);
  return data;
}

export function useAnalytics(range: string) {
  return useQuery({
    queryKey: ['analytics', range],
    queryFn: () => fetchAnalytics(range),
    refetchInterval: 60000,
  });
}

// ============================================
// OWNER DASHBOARD API
// ============================================

export interface OwnerDashboardResponse {
  owner_id: string;
  owner_name: string;
  properties_count: number;
  total_properties: {
    id: number;
    name: string;
    address: string;
    bedrooms: number;
    bathrooms: number;
    max_guests: number;
    nightly_rate: number;
    status: string;
    current_booking: { guest: string; check_out: string } | null;
  }[];
  monthly_earnings: number;
  monthly_expenses: number;
  monthly_net_payout: number;
  ytd_revenue: number;
  ytd_expenses: number;
  ytd_net_payout: number;
  avg_occupancy_rate: number;
  avg_nightly_rate: number;
  avg_guest_rating: number;
  upcoming_bookings: {
    id: number;
    guest_name: string;
    guest_email: string;
    room_name: string;
    check_in: string;
    check_out: string;
    total: number;
    status: string;
    notes: string;
  }[];
  recent_expenses: {
    id: number;
    category: string;
    description: string;
    amount: number;
    date: string;
    vendor: string;
  }[];
  pending_maintenance: any[];
  revenue_change_percent: number;
  occupancy_change_percent: number;
  revenue_chart: { month: string; revenue: number; expenses: number; net: number }[];
  expense_breakdown: { name: string; value: number; color: string }[];
}

async function fetchOwnerDashboard(): Promise<OwnerDashboardResponse> {
  const { data } = await api.get('/owner/dashboard');
  return data;
}

export function useOwnerDashboard() {
  return useQuery({
    queryKey: ['ownerDashboard'],
    queryFn: fetchOwnerDashboard,
    refetchInterval: 60000,
  });
}

// ============================================
// ADMIN FINANCE API
// ============================================

export interface AdminFinanceResponse {
  range: string;
  totals: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    avgOccupancy: number;
    avgRevPAR: number;
    profitMargin: number;
    propertyCount: number;
    avgRating: number;
  };
  propertyFinancials: {
    propertyId: string;
    propertyName: string;
    grossRevenue: number;
    expenses: number;
    netProfit: number;
    occupancyPercent: number;
    profitMarginPercent: number;
    totalNights: number;
    bookedNights: number;
    avgDailyRate: number;
    revPAR: number;
  }[];
  monthlyData: {
    month: string;
    monthLabel: string;
    revenue: number;
    expenses: number;
    netProfit: number;
  }[];
  expenseBreakdown: {
    category: string;
    amount: number;
    percentage: number;
    taxCategory: string;
  }[];
  bookingGaps: any[];
  weeklyPayouts: any[];
}

async function fetchAdminFinance(range: string): Promise<AdminFinanceResponse> {
  const { data } = await api.get(`/admin/finance?range=${range}`);
  return data;
}

export function useAdminFinance(range: string) {
  return useQuery({
    queryKey: ['adminFinance', range],
    queryFn: () => fetchAdminFinance(range),
    refetchInterval: 60000,
  });
}

// ============================================
// GUEST DETAIL API
// ============================================

export interface StayEntry {
  id: string;
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  amount: number;
  rating?: number;
  review?: string;
}

export interface CommunicationEntry {
  id: string;
  type: 'email' | 'sms' | 'call' | 'message';
  direction: 'inbound' | 'outbound';
  subject: string;
  preview: string;
  timestamp: string;
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

export function useGuestStays(guestId: number | string | undefined) {
  return useQuery<StayEntry[]>({
    queryKey: ['guestStays', guestId],
    queryFn: async () => {
      const { data } = await api.get(`/guests/${guestId}/stays`);
      return data;
    },
    enabled: !!guestId,
  });
}

export function useGuestCommunications(guestId: number | string | undefined) {
  return useQuery<CommunicationEntry[]>({
    queryKey: ['guestCommunications', guestId],
    queryFn: async () => {
      const { data } = await api.get(`/guests/${guestId}/communications`);
      return data;
    },
    enabled: !!guestId,
  });
}

// ============================================
// NOTIFICATIONS API
// ============================================

export interface Notification {
  id: number;
  type: string;       // 'booking' | 'payment' | 'lock' | 'cleaning' | 'maintenance' | 'message' | 'system'
  title: string;
  message: string;
  severity: string;   // 'info' | 'warning' | 'success' | 'error'
  read: number;
  action_url: string | null;
  metadata: string;   // JSON string
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  limit: number;
  offset: number;
}

export const fetchNotifications = async (params?: { type?: string; unread?: boolean; limit?: number; offset?: number }): Promise<NotificationListResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.unread) searchParams.set('unread', 'true');
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const { data } = await api.get(`/notifications?${searchParams.toString()}`);
  return data;
};

export const fetchUnreadCount = async (): Promise<{ unread: number }> => {
  const { data } = await api.get('/notifications/unread-count');
  return data;
};

export const markNotificationRead = async (id: number): Promise<void> => {
  await api.post(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await api.post('/notifications/read-all');
};

export const deleteNotification = async (id: number): Promise<void> => {
  await api.delete(`/notifications/${id}`);
};

export const useNotifications = (params?: { type?: string; unread?: boolean }) => {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => fetchNotifications(params),
    refetchInterval: 30000, // Poll every 30s
  });
};

export const useUnreadCount = () => {
  return useQuery({
    queryKey: ['unreadCount'],
    queryFn: fetchUnreadCount,
    refetchInterval: 15000, // Poll every 15s
  });
};

export const useMarkRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
};

export const useMarkAllRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      toast.success('All notifications marked as read');
    },
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
};

// Concierge
export const useConciergeQuery = () => {
  return useMutation({
    mutationFn: (params: ConciergeQueryParams) => sendConciergeQuery(params),
  });
};

// ============================================
// CLEANING API
// ============================================

export interface CleaningReportSummary {
  id: string;
  propertyId: string;
  cleanerId: string;
  scheduledFor: string;
  jobType: 'turnover' | 'deep_clean' | 'inspection' | 'maintenance';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  score?: number;
  durationMinutes?: number;
  issueCount?: number;
}

// Fetch cleaning reports for a cleaner
export const fetchCleaningReports = async (cleanerId?: string): Promise<CleaningReportSummary[]> => {
  const params = cleanerId ? `?cleanerId=${cleanerId}` : '';
  const response = await fetch(`/api/cleaning${params}`);
  if (!response.ok) throw new Error('Failed to fetch cleaning jobs');
  const data = await response.json();
  return data.reports;
};

// Fetch a specific cleaning report
export const fetchCleaningReport = async (reportId: string) => {
  const response = await fetch(`/api/cleaning?id=${reportId}`);
  if (!response.ok) throw new Error('Failed to fetch cleaning report');
  return response.json();
};

// Create a new cleaning job
export const createCleaningJob = async (data: {
  propertyId: string;
  cleanerId: string;
  scheduledFor: string;
  jobType?: string;
}) => {
  const response = await fetch('/api/cleaning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', ...data }),
  });
  if (!response.ok) throw new Error('Failed to create cleaning job');
  return response.json();
};

// Start a cleaning job
export const startCleaningJob = async (reportId: string) => {
  const response = await fetch('/api/cleaning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start', reportId }),
  });
  if (!response.ok) throw new Error('Failed to start cleaning job');
  return response.json();
};

// Complete a checklist item
export const completeChecklistItem = async (data: {
  reportId: string;
  itemId: string;
  photoUrl?: string;
  notes?: string;
}) => {
  const response = await fetch('/api/cleaning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'complete_item', ...data }),
  });
  if (!response.ok) throw new Error('Failed to complete checklist item');
  return response.json();
};

// Report an issue
export const reportCleaningIssue = async (data: {
  reportId: string;
  issue: {
    category: string;
    severity: string;
    title: string;
    description: string;
    location: string;
    photoUrls: string[];
  };
}) => {
  const response = await fetch('/api/cleaning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'report_issue', ...data }),
  });
  if (!response.ok) throw new Error('Failed to report issue');
  return response.json();
};

// Complete a cleaning job
export const completeCleaningJob = async (data: {
  reportId: string;
  notes?: string;
}) => {
  const response = await fetch('/api/cleaning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'complete', ...data }),
  });
  if (!response.ok) throw new Error('Failed to complete cleaning job');
  return response.json();
};

// Cleaning Hooks
export const useCleaningJobsList = (cleanerId?: string) => {
  return useQuery({
    queryKey: ['cleaningReports', cleanerId],
    queryFn: () => fetchCleaningReports(cleanerId),
    refetchInterval: 60000, // Refresh every minute
  });
};

export const useCleaningReport = (reportId: string) => {
  return useQuery({
    queryKey: ['cleaningReport', reportId],
    queryFn: () => fetchCleaningReport(reportId),
    enabled: !!reportId,
  });
};

export const useCreateCleaningJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCleaningJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaningJobs'] });
      toast.success('Cleaning job created!');
    },
    onError: () => {
      toast.error('Failed to create cleaning job');
    },
  });
};

export const useStartCleaningJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startCleaningJob,
    onSuccess: (_, reportId) => {
      queryClient.invalidateQueries({ queryKey: ['cleaningJobs'] });
      queryClient.invalidateQueries({ queryKey: ['cleaningReport', reportId] });
      toast.success('Cleaning job started!');
    },
  });
};

export const useCompleteChecklistItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeChecklistItem,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cleaningReport'] });
    },
  });
};

export const useReportCleaningIssue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reportCleaningIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaningReport'] });
      toast.success('Issue reported!');
    },
    onError: () => {
      toast.error('Failed to report issue');
    },
  });
};

export const useCompleteCleaningJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeCleaningJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaningJobs'] });
      queryClient.invalidateQueries({ queryKey: ['cleaningReport'] });
      toast.success('Cleaning job completed!');
    },
    onError: () => {
      toast.error('Failed to complete cleaning job');
    },
  });
};

// ============================================
// QUERY CLIENT CONFIGURATION
// ============================================

export const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
