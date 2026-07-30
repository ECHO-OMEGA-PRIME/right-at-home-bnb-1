'use client';

/**
 * Compatibility client for guest arrival/departure requests.
 *
 * Smart-lock codes are created and delivered only by the server-side Tuya
 * access lifecycle. This module intentionally cannot generate, store, read,
 * email, or return a door code or Wi-Fi credential.
 */

export const STANDARD_CHECK_IN_TIME = '3:00 PM';
export const STANDARD_CHECK_OUT_TIME = '11:00 AM';

export type CheckInStatus = 'pending' | 'checked_in' | 'no_show';
export type CheckOutStatus = 'pending' | 'checked_out' | 'extended';
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'expired';

export interface TimeModificationRequest {
  id: string;
  bookingId: string;
  type: 'early_check_in' | 'late_check_out';
  requestedTime: string;
  originalTime: string;
  reason?: string;
  additionalFee?: number;
  status: RequestStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  denialReason?: string;
}

export interface CheckInOutRecord {
  id: string;
  bookingId: string;
  propertyId: string;
  propertyName: string;
  guestEmail: string;
  guestName: string;
  scheduledCheckIn: string;
  scheduledCheckOut: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  checkInStatus: CheckInStatus;
  checkOutStatus: CheckOutStatus;
  accessStatus: 'PENDING' | 'DELIVERED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'UNAVAILABLE';
  accessDeliveredAt?: string;
  accessChannel?: string;
  guestNotes?: string;
  ownerNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CheckInInstructions {
  propertyName: string;
  propertyAddress: string;
  accessStatus: CheckInOutRecord['accessStatus'];
  accessDeliveredAt?: string;
  accessChannel?: string;
  parkingInstructions: string;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string[];
  emergencyContact: string;
  nearbyAmenities: {
    grocery: string;
    restaurant: string;
    pharmacy: string;
  };
  specialInstructions?: string;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}`);
  return body as T;
}

function retired(): never {
  throw new Error(
    'Legacy client-side check-in credential management is disabled. Access is managed by the secured Tuya server lifecycle.',
  );
}

/** @deprecated Access records are created automatically from confirmed bookings. */
export async function createCheckInOutRecord(): Promise<CheckInOutRecord> {
  return retired();
}

/** @deprecated Check-in status is driven by the booking and secured access lifecycle. */
export async function performCheckIn(): Promise<CheckInOutRecord> {
  return retired();
}

/** @deprecated Checkout is processed by the owner/service checkout automation. */
export async function performCheckOut(): Promise<CheckInOutRecord> {
  return retired();
}

async function requestTimeChange(
  bookingId: string,
  type: 'early_check_in' | 'late_check_out',
  requestedTime: string,
  reason?: string,
): Promise<TimeModificationRequest> {
  const category = type === 'early_check_in' ? 'EARLY_CHECK_IN' : 'LATE_CHECK_OUT';
  const originalTime = type === 'early_check_in' ? STANDARD_CHECK_IN_TIME : STANDARD_CHECK_OUT_TIME;
  const result = await api<any>('/api/operations/guest-requests', {
    method: 'POST',
    body: JSON.stringify({
      bookingId,
      category,
      urgency: 'NORMAL',
      description: `${category.replaceAll('_', ' ')} requested for ${requestedTime}.${reason ? ` Reason: ${reason}` : ''}`,
      sourceChannel: 'WEB',
    }),
  });
  return {
    id: result.request.id,
    bookingId,
    type,
    requestedTime,
    originalTime,
    reason,
    status: 'pending',
    requestedAt: result.request.requestedAt,
  };
}

export function requestEarlyCheckIn(
  bookingId: string,
  requestedTime: string,
  reason?: string,
): Promise<TimeModificationRequest> {
  return requestTimeChange(bookingId, 'early_check_in', requestedTime, reason);
}

export function requestLateCheckOut(
  bookingId: string,
  requestedTime: string,
  reason?: string,
): Promise<TimeModificationRequest> {
  return requestTimeChange(bookingId, 'late_check_out', requestedTime, reason);
}

/** Owner approvals are handled through the owner operations queue. */
export async function approveTimeRequest(): Promise<void> {
  return retired();
}

/** Owner denials are handled through the owner operations queue. */
export async function denyTimeRequest(): Promise<void> {
  return retired();
}

export async function getPendingTimeRequests(): Promise<Array<{
  request: TimeModificationRequest;
  record: CheckInOutRecord;
}>> {
  return [];
}

function accessStatus(grant: any): CheckInOutRecord['accessStatus'] {
  if (!grant) return 'PENDING';
  const status = String(grant.status || '').toUpperCase();
  if (status === 'DELIVERED') return 'DELIVERED';
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'REVOKED') return 'REVOKED';
  if (status === 'EXPIRED') return 'EXPIRED';
  return 'PENDING';
}

export async function getCheckInOutRecord(bookingId: string): Promise<CheckInOutRecord | null> {
  const dashboard = await api<any>('/api/operations/dashboard');
  const bookings = [dashboard.activeBooking, ...(dashboard.upcomingBookings || [])].filter(Boolean);
  const booking = bookings.find((item: any) => item.id === bookingId);
  if (!booking) return null;
  const grant = booking.accessGrants?.[0];
  return {
    id: booking.id,
    bookingId: booking.id,
    propertyId: booking.property.id,
    propertyName: booking.property.name,
    guestEmail: dashboard.guest?.email || '',
    guestName: dashboard.guest?.name || '',
    scheduledCheckIn: booking.checkIn,
    scheduledCheckOut: booking.checkOut,
    checkInStatus: booking.status === 'CHECKED_IN' ? 'checked_in' : 'pending',
    checkOutStatus: 'pending',
    accessStatus: accessStatus(grant),
    accessDeliveredAt: grant?.deliveredAt || undefined,
    accessChannel: grant?.deliveryChannel || undefined,
  };
}

export async function getCheckInInstructions(bookingId: string): Promise<CheckInInstructions | null> {
  const dashboard = await api<any>('/api/operations/dashboard');
  const bookings = [dashboard.activeBooking, ...(dashboard.upcomingBookings || [])].filter(Boolean);
  const booking = bookings.find((item: any) => item.id === bookingId);
  if (!booking) return null;
  const grant = booking.accessGrants?.[0];
  return {
    propertyName: booking.property.name,
    propertyAddress: booking.property.address,
    accessStatus: accessStatus(grant),
    accessDeliveredAt: grant?.deliveredAt || undefined,
    accessChannel: grant?.deliveryChannel || undefined,
    parkingInstructions: booking.property.parkingInfo || 'Parking instructions are available in your stay dashboard.',
    checkInTime: new Date(booking.checkIn).toLocaleTimeString('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      minute: '2-digit',
    }),
    checkOutTime: new Date(booking.checkOut).toLocaleTimeString('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      minute: '2-digit',
    }),
    houseRules: [],
    emergencyContact: '(432) 559-1904',
    nearbyAmenities: {
      grocery: 'See the live Midland shopping recommendations in your dashboard.',
      restaurant: 'See the live Midland food recommendations in your dashboard.',
      pharmacy: 'Open the map in your stay dashboard and search nearby pharmacies.',
    },
    specialInstructions: booking.property.checkInInstr || undefined,
  };
}

export async function getTodaysCheckIns(): Promise<CheckInOutRecord[]> {
  return [];
}

export async function getTodaysCheckOuts(): Promise<CheckInOutRecord[]> {
  return [];
}

/** Welcome emails never carry a credential. Access is delivered separately. */
export async function sendCompleteWelcomeEmail(): Promise<boolean> {
  return retired();
}
