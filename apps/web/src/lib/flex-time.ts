/**
 * Right at Home BnB - Flex Time System
 * Late checkout and early check-in management with automated availability checking
 * @author ECHO OMEGA PRIME
 */

import { db } from './auth';
import {
  doc, setDoc, getDoc, updateDoc, collection,
  query, where, getDocs, orderBy, serverTimestamp,
  Timestamp, deleteDoc
} from 'firebase/firestore';

// ============================================
// TYPES
// ============================================

export type FlexTimeRequestStatus = 'pending' | 'auto_approved' | 'approved' | 'denied' | 'expired' | 'cancelled';
export type FlexTimeType = 'early_checkin' | 'late_checkout';

export interface FlexTimeRequest {
  id: string;
  bookingId: string;
  propertyId: string;
  propertyName: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  type: FlexTimeType;
  originalTime: string; // ISO datetime
  requestedTime: string; // ISO datetime
  hoursRequested: number;
  reason?: string;
  // Pricing
  basePrice: number;
  calculatedFee: number;
  isPaid: boolean;
  paymentId?: string;
  paymentMethod?: string;
  // Availability analysis
  conflictLevel: 'none' | 'low' | 'medium' | 'high';
  conflictDetails?: string;
  cleaningImpact?: CleaningImpact;
  // Status
  status: FlexTimeRequestStatus;
  autoApprovalEligible: boolean;
  // Review info (for manual approval)
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  reviewNotes?: string;
  denialReason?: string;
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp; // When pending request expires
}

export interface CleaningImpact {
  cleaningJobId?: string;
  originalScheduledTime: string;
  newScheduledTime?: string;
  cleanerNotified: boolean;
  cleanerAcknowledged: boolean;
  timeReduction?: number; // Minutes reduced from cleaning window
}

export interface FlexTimePricing {
  perHourRate: number;
  minimumFee: number;
  maximumFee: number;
  vipDiscount: number; // Percentage discount for VIP guests
  repeatGuestDiscount: number; // For guests with 3+ stays
  offPeakDiscount: number; // Weekday discount
}

export interface AvailabilityResult {
  isAvailable: boolean;
  conflictLevel: 'none' | 'low' | 'medium' | 'high';
  conflictDetails: string[];
  nextBooking?: {
    checkIn: string;
    guestName: string;
    gapHours: number;
  };
  previousBooking?: {
    checkOut: string;
    guestName: string;
    gapHours: number;
  };
  cleaningWindow: {
    available: number; // Minutes available
    required: number; // Minutes required
    sufficient: boolean;
  };
  recommendedMaxExtension: number; // Hours
  autoApprovalEligible: boolean;
}

// ============================================
// CONSTANTS
// ============================================

export const DEFAULT_CHECK_IN_TIME = '15:00'; // 3:00 PM
export const DEFAULT_CHECK_OUT_TIME = '11:00'; // 11:00 AM
export const MINIMUM_CLEANING_WINDOW = 180; // 3 hours in minutes
export const AUTO_APPROVAL_GAP_THRESHOLD = 360; // 6 hours gap = auto-approve

export const DEFAULT_PRICING: FlexTimePricing = {
  perHourRate: 25,
  minimumFee: 25,
  maximumFee: 100,
  vipDiscount: 0.2, // 20% off
  repeatGuestDiscount: 0.1, // 10% off
  offPeakDiscount: 0.15, // 15% off weekdays
};

// Collection name
const FLEX_TIME_COLLECTION = 'rah_flex_time_requests';

// ============================================
// AVAILABILITY CHECKING
// ============================================

/**
 * Check availability for late checkout
 */
export async function checkLateCheckoutAvailability(
  propertyId: string,
  bookingId: string,
  requestedCheckoutTime: string // ISO datetime
): Promise<AvailabilityResult> {
  const requestedDate = new Date(requestedCheckoutTime);
  const dateStr = requestedCheckoutTime.split('T')[0];

  // Get next booking for this property after the current checkout date
  const bookingsRef = collection(db(), 'bookings');
  const nextBookingQuery = query(
    bookingsRef,
    where('propertyId', '==', propertyId),
    where('checkIn', '>=', new Date(dateStr)),
    where('status', '!=', 'CANCELLED'),
    orderBy('checkIn', 'asc')
  );

  const snapshot = await getDocs(nextBookingQuery);
  const nextBookings = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as { id: string; checkIn: any; checkOut: any; status: string; [key: string]: any }))
    .filter(b => b.id !== bookingId);

  const conflicts: string[] = [];
  let conflictLevel: AvailabilityResult['conflictLevel'] = 'none';
  let autoApprovalEligible = true;
  let recommendedMaxExtension = 6; // Default 6 hours max

  const nextBooking = nextBookings[0];

  if (nextBooking) {
    const nextCheckIn = nextBooking.checkIn.toDate ? nextBooking.checkIn.toDate() : new Date(nextBooking.checkIn);
    const gapMs = nextCheckIn.getTime() - requestedDate.getTime();
    const gapMinutes = gapMs / (1000 * 60);
    const gapHours = gapMinutes / 60;

    // Calculate cleaning window
    const cleaningWindowMinutes = gapMinutes;
    const cleaningWindowSufficient = cleaningWindowMinutes >= MINIMUM_CLEANING_WINDOW;

    if (cleaningWindowMinutes < MINIMUM_CLEANING_WINDOW) {
      conflicts.push(`Insufficient cleaning time: ${Math.round(cleaningWindowMinutes)} minutes available, ${MINIMUM_CLEANING_WINDOW} minutes required`);
      conflictLevel = 'high';
      autoApprovalEligible = false;
    } else if (cleaningWindowMinutes < MINIMUM_CLEANING_WINDOW * 1.5) {
      conflicts.push(`Tight cleaning window: ${Math.round(cleaningWindowMinutes)} minutes available`);
      conflictLevel = 'medium';
      autoApprovalEligible = false;
    } else if (cleaningWindowMinutes < AUTO_APPROVAL_GAP_THRESHOLD) {
      conflicts.push(`Limited gap before next guest: ${gapHours.toFixed(1)} hours`);
      conflictLevel = 'low';
    }

    // Calculate max extension
    const maxExtensionMinutes = gapMinutes - MINIMUM_CLEANING_WINDOW;
    recommendedMaxExtension = Math.max(0, Math.floor(maxExtensionMinutes / 60));

    return {
      isAvailable: cleaningWindowSufficient,
      conflictLevel,
      conflictDetails: conflicts,
      nextBooking: {
        checkIn: nextCheckIn.toISOString(),
        guestName: nextBooking.guestName || 'Upcoming Guest',
        gapHours,
      },
      cleaningWindow: {
        available: cleaningWindowMinutes,
        required: MINIMUM_CLEANING_WINDOW,
        sufficient: cleaningWindowSufficient,
      },
      recommendedMaxExtension,
      autoApprovalEligible,
    };
  }

  // No next booking - fully available
  return {
    isAvailable: true,
    conflictLevel: 'none',
    conflictDetails: [],
    cleaningWindow: {
      available: 480, // 8 hours default
      required: MINIMUM_CLEANING_WINDOW,
      sufficient: true,
    },
    recommendedMaxExtension: 8,
    autoApprovalEligible: true,
  };
}

/**
 * Check availability for early check-in
 */
export async function checkEarlyCheckinAvailability(
  propertyId: string,
  bookingId: string,
  requestedCheckinTime: string // ISO datetime
): Promise<AvailabilityResult> {
  const requestedDate = new Date(requestedCheckinTime);
  const dateStr = requestedCheckinTime.split('T')[0];

  // Get previous booking for this property before the current check-in date
  const bookingsRef = collection(db(), 'bookings');
  const prevBookingQuery = query(
    bookingsRef,
    where('propertyId', '==', propertyId),
    where('checkOut', '<=', new Date(dateStr + 'T23:59:59')),
    where('status', '!=', 'CANCELLED'),
    orderBy('checkOut', 'desc')
  );

  const snapshot = await getDocs(prevBookingQuery);
  const prevBookings = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as { id: string; checkIn: any; checkOut: any; status: string; [key: string]: any }))
    .filter(b => b.id !== bookingId);

  const conflicts: string[] = [];
  let conflictLevel: AvailabilityResult['conflictLevel'] = 'none';
  let autoApprovalEligible = true;
  let recommendedMaxExtension = 6;

  const prevBooking = prevBookings[0];

  if (prevBooking) {
    const prevCheckOut = prevBooking.checkOut.toDate ? prevBooking.checkOut.toDate() : new Date(prevBooking.checkOut);
    const gapMs = requestedDate.getTime() - prevCheckOut.getTime();
    const gapMinutes = gapMs / (1000 * 60);
    const gapHours = gapMinutes / 60;

    const cleaningWindowMinutes = gapMinutes;
    const cleaningWindowSufficient = cleaningWindowMinutes >= MINIMUM_CLEANING_WINDOW;

    if (cleaningWindowMinutes < MINIMUM_CLEANING_WINDOW) {
      conflicts.push(`Insufficient cleaning time: ${Math.round(cleaningWindowMinutes)} minutes available, ${MINIMUM_CLEANING_WINDOW} minutes required`);
      conflictLevel = 'high';
      autoApprovalEligible = false;
    } else if (cleaningWindowMinutes < MINIMUM_CLEANING_WINDOW * 1.5) {
      conflicts.push(`Tight cleaning window: ${Math.round(cleaningWindowMinutes)} minutes available`);
      conflictLevel = 'medium';
      autoApprovalEligible = false;
    } else if (cleaningWindowMinutes < AUTO_APPROVAL_GAP_THRESHOLD) {
      conflicts.push(`Limited gap after previous guest: ${gapHours.toFixed(1)} hours`);
      conflictLevel = 'low';
    }

    const maxExtensionMinutes = gapMinutes - MINIMUM_CLEANING_WINDOW;
    recommendedMaxExtension = Math.max(0, Math.floor(maxExtensionMinutes / 60));

    return {
      isAvailable: cleaningWindowSufficient,
      conflictLevel,
      conflictDetails: conflicts,
      previousBooking: {
        checkOut: prevCheckOut.toISOString(),
        guestName: prevBooking.guestName || 'Previous Guest',
        gapHours,
      },
      cleaningWindow: {
        available: cleaningWindowMinutes,
        required: MINIMUM_CLEANING_WINDOW,
        sufficient: cleaningWindowSufficient,
      },
      recommendedMaxExtension,
      autoApprovalEligible,
    };
  }

  // No previous booking - fully available
  return {
    isAvailable: true,
    conflictLevel: 'none',
    conflictDetails: [],
    cleaningWindow: {
      available: 480,
      required: MINIMUM_CLEANING_WINDOW,
      sufficient: true,
    },
    recommendedMaxExtension: 8,
    autoApprovalEligible: true,
  };
}

// ============================================
// PRICING CALCULATION
// ============================================

/**
 * Calculate fee for flex time request
 */
export function calculateFlexTimeFee(
  hours: number,
  isVip: boolean = false,
  totalStays: number = 0,
  isWeekday: boolean = false,
  customPricing?: Partial<FlexTimePricing>
): { baseFee: number; discount: number; finalFee: number; discountReasons: string[] } {
  const pricing = { ...DEFAULT_PRICING, ...customPricing };
  const discountReasons: string[] = [];

  // Calculate base fee
  let baseFee = Math.max(pricing.minimumFee, hours * pricing.perHourRate);
  baseFee = Math.min(baseFee, pricing.maximumFee);

  // Apply discounts
  let totalDiscount = 0;

  if (isVip) {
    totalDiscount += pricing.vipDiscount;
    discountReasons.push(`VIP discount: ${(pricing.vipDiscount * 100).toFixed(0)}%`);
  }

  if (totalStays >= 3) {
    totalDiscount += pricing.repeatGuestDiscount;
    discountReasons.push(`Repeat guest discount: ${(pricing.repeatGuestDiscount * 100).toFixed(0)}%`);
  }

  if (isWeekday) {
    totalDiscount += pricing.offPeakDiscount;
    discountReasons.push(`Off-peak discount: ${(pricing.offPeakDiscount * 100).toFixed(0)}%`);
  }

  // Cap total discount at 40%
  totalDiscount = Math.min(totalDiscount, 0.4);

  const discount = baseFee * totalDiscount;
  const finalFee = Math.round((baseFee - discount) * 100) / 100;

  return {
    baseFee,
    discount,
    finalFee,
    discountReasons,
  };
}

// ============================================
// REQUEST MANAGEMENT
// ============================================

/**
 * Create a flex time request
 */
export async function createFlexTimeRequest(
  data: Omit<FlexTimeRequest, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'conflictLevel' | 'autoApprovalEligible'>
): Promise<FlexTimeRequest> {
  const id = `flex_${data.bookingId}_${data.type}_${Date.now()}`;

  // Check availability
  const availability = data.type === 'late_checkout'
    ? await checkLateCheckoutAvailability(data.propertyId, data.bookingId, data.requestedTime)
    : await checkEarlyCheckinAvailability(data.propertyId, data.bookingId, data.requestedTime);

  if (!availability.isAvailable) {
    throw new Error(`Request not available: ${availability.conflictDetails.join(', ')}`);
  }

  // Determine initial status
  let status: FlexTimeRequestStatus = 'pending';
  if (availability.autoApprovalEligible && availability.conflictLevel === 'none') {
    status = 'auto_approved';
  }

  const request: FlexTimeRequest = {
    ...data,
    id,
    status,
    conflictLevel: availability.conflictLevel,
    conflictDetails: availability.conflictDetails.join('; '),
    autoApprovalEligible: availability.autoApprovalEligible,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // 24 hour expiry
  };

  const requestRef = doc(db(), FLEX_TIME_COLLECTION, id);
  await setDoc(requestRef, request);

  // If auto-approved, update the booking and notify cleaner
  if (status === 'auto_approved') {
    await handleAutoApproval(request);
  }

  return request;
}

/**
 * Handle auto-approval side effects
 */
async function handleAutoApproval(request: FlexTimeRequest): Promise<void> {
  // Update check-in/out record with new time
  const checkInOutRef = doc(db(), 'checkInOut', request.bookingId);
  const checkInOutSnap = await getDoc(checkInOutRef);

  if (checkInOutSnap.exists()) {
    const updateField = request.type === 'late_checkout' ? 'scheduledCheckOut' : 'scheduledCheckIn';
    await updateDoc(checkInOutRef, {
      [updateField]: request.requestedTime,
      updatedAt: serverTimestamp(),
    });
  }

  // Create notification for owner
  const notifRef = doc(collection(db(), 'ownerNotifications'));
  await setDoc(notifRef, {
    type: 'flex_time_auto_approved',
    bookingId: request.bookingId,
    guestName: request.guestName,
    propertyName: request.propertyName,
    requestType: request.type,
    requestedTime: request.requestedTime,
    fee: request.calculatedFee,
    status: 'unread',
    createdAt: serverTimestamp(),
  });

  // Update cleaning job if applicable
  await updateCleaningSchedule(request);
}

/**
 * Update cleaning schedule based on flex time request
 */
async function updateCleaningSchedule(request: FlexTimeRequest): Promise<void> {
  const cleaningRef = collection(db(), 'rah_cleaning_reports');
  const q = query(
    cleaningRef,
    where('bookingId', '==', request.bookingId),
    where('status', 'in', ['not_started', 'in_progress'])
  );

  const snapshot = await getDocs(q);

  for (const doc of snapshot.docs) {
    const cleaningJob = doc.data();
    let newScheduledTime: Date;

    if (request.type === 'late_checkout') {
      // Push cleaning start time later
      newScheduledTime = new Date(request.requestedTime);
      newScheduledTime.setMinutes(newScheduledTime.getMinutes() + 30); // 30 min buffer after checkout
    } else {
      // Keep cleaning time but note earlier guest arrival
      newScheduledTime = cleaningJob.scheduledAt.toDate();
    }

    await updateDoc(doc.ref, {
      scheduledAt: Timestamp.fromDate(newScheduledTime),
      flexTimeAdjusted: true,
      flexTimeRequestId: request.id,
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Approve a pending flex time request (manual approval)
 */
export async function approveFlexTimeRequest(
  requestId: string,
  reviewedBy: string,
  reviewNotes?: string
): Promise<FlexTimeRequest> {
  const requestRef = doc(db(), FLEX_TIME_COLLECTION, requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new Error('Request not found');
  }

  const request = { id: requestSnap.id, ...requestSnap.data() } as FlexTimeRequest;

  if (request.status !== 'pending') {
    throw new Error(`Cannot approve request with status: ${request.status}`);
  }

  await updateDoc(requestRef, {
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewedBy,
    reviewNotes: reviewNotes || null,
    updatedAt: serverTimestamp(),
  });

  // Apply the approval
  const updatedRequest = { ...request, status: 'approved' as FlexTimeRequestStatus };
  await handleAutoApproval(updatedRequest);

  // Notify guest
  await notifyGuestOfApproval(request);

  return updatedRequest;
}

/**
 * Deny a pending flex time request
 */
export async function denyFlexTimeRequest(
  requestId: string,
  reviewedBy: string,
  denialReason: string
): Promise<FlexTimeRequest> {
  const requestRef = doc(db(), FLEX_TIME_COLLECTION, requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new Error('Request not found');
  }

  const request = { id: requestSnap.id, ...requestSnap.data() } as FlexTimeRequest;

  if (request.status !== 'pending') {
    throw new Error(`Cannot deny request with status: ${request.status}`);
  }

  await updateDoc(requestRef, {
    status: 'denied',
    reviewedAt: serverTimestamp(),
    reviewedBy,
    denialReason,
    updatedAt: serverTimestamp(),
  });

  // Notify guest
  await notifyGuestOfDenial(request, denialReason);

  return { ...request, status: 'denied', denialReason };
}

/**
 * Cancel a flex time request (by guest)
 */
export async function cancelFlexTimeRequest(requestId: string): Promise<void> {
  const requestRef = doc(db(), FLEX_TIME_COLLECTION, requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new Error('Request not found');
  }

  const request = requestSnap.data() as FlexTimeRequest;

  if (!['pending', 'auto_approved', 'approved'].includes(request.status)) {
    throw new Error(`Cannot cancel request with status: ${request.status}`);
  }

  await updateDoc(requestRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });

  // If was approved, revert changes
  if (request.status === 'approved' || request.status === 'auto_approved') {
    await revertFlexTimeChanges(request);
  }
}

/**
 * Revert flex time changes (on cancellation)
 */
async function revertFlexTimeChanges(request: FlexTimeRequest): Promise<void> {
  // Revert check-in/out record
  const checkInOutRef = doc(db(), 'checkInOut', request.bookingId);
  const checkInOutSnap = await getDoc(checkInOutRef);

  if (checkInOutSnap.exists()) {
    const updateField = request.type === 'late_checkout' ? 'scheduledCheckOut' : 'scheduledCheckIn';
    await updateDoc(checkInOutRef, {
      [updateField]: request.originalTime,
      updatedAt: serverTimestamp(),
    });
  }
}

// ============================================
// QUERIES
// ============================================

/**
 * Get flex time request by ID
 */
export async function getFlexTimeRequest(requestId: string): Promise<FlexTimeRequest | null> {
  const requestRef = doc(db(), FLEX_TIME_COLLECTION, requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) return null;
  return { id: requestSnap.id, ...requestSnap.data() } as FlexTimeRequest;
}

/**
 * Get all pending flex time requests
 */
export async function getPendingFlexTimeRequests(): Promise<FlexTimeRequest[]> {
  const requestsRef = collection(db(), FLEX_TIME_COLLECTION);
  const q = query(
    requestsRef,
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as FlexTimeRequest[];
}

/**
 * Get flex time requests for a booking
 */
export async function getBookingFlexTimeRequests(bookingId: string): Promise<FlexTimeRequest[]> {
  const requestsRef = collection(db(), FLEX_TIME_COLLECTION);
  const q = query(
    requestsRef,
    where('bookingId', '==', bookingId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as FlexTimeRequest[];
}

/**
 * Get flex time requests for a property within date range
 */
export async function getPropertyFlexTimeRequests(
  propertyId: string,
  startDate?: Date,
  endDate?: Date
): Promise<FlexTimeRequest[]> {
  const requestsRef = collection(db(), FLEX_TIME_COLLECTION);
  let q = query(
    requestsRef,
    where('propertyId', '==', propertyId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  let requests = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as FlexTimeRequest[];

  // Filter by date if provided
  if (startDate || endDate) {
    requests = requests.filter(r => {
      const requestDate = new Date(r.requestedTime);
      if (startDate && requestDate < startDate) return false;
      if (endDate && requestDate > endDate) return false;
      return true;
    });
  }

  return requests;
}

// ============================================
// NOTIFICATIONS
// ============================================

async function notifyGuestOfApproval(request: FlexTimeRequest): Promise<void> {
  console.log(`[NOTIFICATION] Flex time approved for ${request.guestEmail}:`, {
    type: request.type,
    requestedTime: request.requestedTime,
    fee: request.calculatedFee,
  });

  // Store notification
  const notifRef = doc(collection(db(), 'guestNotifications'));
  await setDoc(notifRef, {
    type: 'flex_time_approved',
    guestEmail: request.guestEmail,
    bookingId: request.bookingId,
    requestType: request.type,
    requestedTime: request.requestedTime,
    fee: request.calculatedFee,
    status: 'unsent',
    createdAt: serverTimestamp(),
  });
}

async function notifyGuestOfDenial(request: FlexTimeRequest, reason: string): Promise<void> {
  console.log(`[NOTIFICATION] Flex time denied for ${request.guestEmail}:`, {
    type: request.type,
    reason,
  });

  // Store notification
  const notifRef = doc(collection(db(), 'guestNotifications'));
  await setDoc(notifRef, {
    type: 'flex_time_denied',
    guestEmail: request.guestEmail,
    bookingId: request.bookingId,
    requestType: request.type,
    reason,
    status: 'unsent',
    createdAt: serverTimestamp(),
  });
}

// ============================================
// PAYMENT PROCESSING
// ============================================

/**
 * Mark flex time request as paid
 */
export async function markFlexTimePaid(
  requestId: string,
  paymentId: string,
  paymentMethod: string
): Promise<void> {
  const requestRef = doc(db(), FLEX_TIME_COLLECTION, requestId);
  await updateDoc(requestRef, {
    isPaid: true,
    paymentId,
    paymentMethod,
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert time string to hours from midnight
 */
export function timeToHours(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + minutes / 60;
}

/**
 * Calculate hours difference between two times
 */
export function calculateHoursDifference(originalTime: string, requestedTime: string): number {
  const originalDate = new Date(originalTime);
  const requestedDate = new Date(requestedTime);
  const diffMs = Math.abs(requestedDate.getTime() - originalDate.getTime());
  return diffMs / (1000 * 60 * 60);
}

/**
 * Check if a date is a weekday
 */
export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 4; // Monday to Thursday
}

/**
 * Format time for display
 */
export function formatFlexTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ============================================
// EXPORTS
// ============================================

export const FlexTimeSystem = {
  // Availability
  checkLateCheckoutAvailability,
  checkEarlyCheckinAvailability,
  // Pricing
  calculateFlexTimeFee,
  DEFAULT_PRICING,
  // Requests
  createFlexTimeRequest,
  approveFlexTimeRequest,
  denyFlexTimeRequest,
  cancelFlexTimeRequest,
  getFlexTimeRequest,
  getPendingFlexTimeRequests,
  getBookingFlexTimeRequests,
  getPropertyFlexTimeRequests,
  // Payment
  markFlexTimePaid,
  // Helpers
  timeToHours,
  calculateHoursDifference,
  isWeekday,
  formatFlexTime,
};

export default FlexTimeSystem;
