'use client';

/**
 * Right at Home BnB - Check-In/Check-Out System
 * Handles guest check-in, check-out, and early/late requests with approval workflow
 * @author ECHO OMEGA PRIME
 */

import { db } from './auth';
import {
  doc, setDoc, getDoc, updateDoc, collection,
  query, where, getDocs, orderBy, serverTimestamp,
  Timestamp, addDoc
} from 'firebase/firestore';
import { sendBookingEmail } from './email-templates';

// Standard times
export const STANDARD_CHECK_IN_TIME = '3:00 PM';
export const STANDARD_CHECK_OUT_TIME = '11:00 AM';

// Door code generation
function generateDoorCode(bookingId: string, checkInDate: string): string {
  // Generate a 6-digit code based on booking details
  // In production, this would integrate with smart lock API
  const seed = `${bookingId}${checkInDate}`.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const code = ((seed * 9301 + 49297) % 899999 + 100000).toString();
  return code;
}

// Check-In Status
export type CheckInStatus = 'pending' | 'checked_in' | 'no_show';
export type CheckOutStatus = 'pending' | 'checked_out' | 'extended';

// Time Request Status
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'expired';

// Check-In/Out Record
export interface CheckInOutRecord {
  id: string;
  bookingId: string;
  propertyId: string;
  propertyName: string;
  guestEmail: string;
  guestName: string;
  // Standard times
  scheduledCheckIn: string; // ISO datetime
  scheduledCheckOut: string;
  // Actual times
  actualCheckIn?: string;
  actualCheckOut?: string;
  // Status
  checkInStatus: CheckInStatus;
  checkOutStatus: CheckOutStatus;
  // Door code (personalized)
  doorCode: string;
  doorCodeActivatedAt?: Timestamp;
  doorCodeDeactivatedAt?: Timestamp;
  // WiFi
  wifiName: string;
  wifiPassword: string;
  // Time modification requests
  earlyCheckInRequest?: TimeModificationRequest;
  lateCheckOutRequest?: TimeModificationRequest;
  // Notes
  guestNotes?: string;
  ownerNotes?: string;
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Time Modification Request (Early Check-In or Late Check-Out)
export interface TimeModificationRequest {
  id: string;
  bookingId: string;
  type: 'early_check_in' | 'late_check_out';
  requestedTime: string; // The time they're requesting
  originalTime: string; // The original scheduled time
  reason?: string;
  additionalFee?: number;
  status: RequestStatus;
  requestedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  denialReason?: string;
}

// Check-In Instructions
export interface CheckInInstructions {
  propertyName: string;
  propertyAddress: string;
  doorCode: string;
  doorCodeValidFrom: string;
  doorCodeValidUntil: string;
  wifiName: string;
  wifiPassword: string;
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

// Create check-in/out record for a booking
export async function createCheckInOutRecord(
  bookingId: string,
  propertyId: string,
  propertyName: string,
  guestEmail: string,
  guestName: string,
  checkInDate: string, // YYYY-MM-DD
  checkOutDate: string,
  wifiName: string = 'RAH-Guest',
  wifiPassword: string = 'Welcome123'
): Promise<CheckInOutRecord> {
  const doorCode = generateDoorCode(bookingId, checkInDate);

  const record: CheckInOutRecord = {
    id: bookingId,
    bookingId,
    propertyId,
    propertyName,
    guestEmail,
    guestName,
    scheduledCheckIn: `${checkInDate}T15:00:00`,
    scheduledCheckOut: `${checkOutDate}T11:00:00`,
    checkInStatus: 'pending',
    checkOutStatus: 'pending',
    doorCode,
    wifiName,
    wifiPassword,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  const recordRef = doc(db(), 'checkInOut', bookingId);
  await setDoc(recordRef, record);

  return record;
}

// Guest check-in
export async function performCheckIn(
  bookingId: string,
  guestNotes?: string
): Promise<CheckInOutRecord> {
  const recordRef = doc(db(), 'checkInOut', bookingId);
  const now = new Date().toISOString();

  await updateDoc(recordRef, {
    actualCheckIn: now,
    checkInStatus: 'checked_in',
    doorCodeActivatedAt: serverTimestamp(),
    guestNotes: guestNotes || null,
    updatedAt: serverTimestamp(),
  });

  const updated = await getDoc(recordRef);
  return { id: updated.id, ...updated.data() } as CheckInOutRecord;
}

// Guest check-out
export async function performCheckOut(
  bookingId: string,
  guestNotes?: string
): Promise<CheckInOutRecord> {
  const recordRef = doc(db(), 'checkInOut', bookingId);
  const now = new Date().toISOString();

  await updateDoc(recordRef, {
    actualCheckOut: now,
    checkOutStatus: 'checked_out',
    doorCodeDeactivatedAt: serverTimestamp(),
    guestNotes: guestNotes ? (await getDoc(recordRef)).data()?.guestNotes + '\n' + guestNotes : undefined,
    updatedAt: serverTimestamp(),
  });

  const updated = await getDoc(recordRef);
  return { id: updated.id, ...updated.data() } as CheckInOutRecord;
}

// Request early check-in
export async function requestEarlyCheckIn(
  bookingId: string,
  requestedTime: string, // e.g., "12:00 PM"
  reason?: string
): Promise<TimeModificationRequest> {
  const recordRef = doc(db(), 'checkInOut', bookingId);
  const record = (await getDoc(recordRef)).data() as CheckInOutRecord;

  const request: TimeModificationRequest = {
    id: `early_${bookingId}_${Date.now()}`,
    bookingId,
    type: 'early_check_in',
    requestedTime,
    originalTime: STANDARD_CHECK_IN_TIME,
    reason,
    status: 'pending',
    requestedAt: serverTimestamp() as Timestamp,
  };

  await updateDoc(recordRef, {
    earlyCheckInRequest: request,
    updatedAt: serverTimestamp(),
  });

  // Send notification to owner
  await notifyOwnerOfTimeRequest(request, record);

  return request;
}

// Request late check-out
export async function requestLateCheckOut(
  bookingId: string,
  requestedTime: string, // e.g., "2:00 PM"
  reason?: string
): Promise<TimeModificationRequest> {
  const recordRef = doc(db(), 'checkInOut', bookingId);
  const record = (await getDoc(recordRef)).data() as CheckInOutRecord;

  const request: TimeModificationRequest = {
    id: `late_${bookingId}_${Date.now()}`,
    bookingId,
    type: 'late_check_out',
    requestedTime,
    originalTime: STANDARD_CHECK_OUT_TIME,
    reason,
    status: 'pending',
    requestedAt: serverTimestamp() as Timestamp,
  };

  await updateDoc(recordRef, {
    lateCheckOutRequest: request,
    updatedAt: serverTimestamp(),
  });

  // Send notification to owner
  await notifyOwnerOfTimeRequest(request, record);

  return request;
}

// Approve time modification request (Owner/Steven only)
export async function approveTimeRequest(
  bookingId: string,
  requestType: 'early_check_in' | 'late_check_out',
  approvedBy: string,
  additionalFee?: number
): Promise<void> {
  const recordRef = doc(db(), 'checkInOut', bookingId);
  const field = requestType === 'early_check_in' ? 'earlyCheckInRequest' : 'lateCheckOutRequest';

  const record = (await getDoc(recordRef)).data() as CheckInOutRecord;
  const request = requestType === 'early_check_in'
    ? record.earlyCheckInRequest
    : record.lateCheckOutRequest;

  if (!request) {
    throw new Error('No pending request found');
  }

  await updateDoc(recordRef, {
    [`${field}.status`]: 'approved',
    [`${field}.reviewedAt`]: serverTimestamp(),
    [`${field}.reviewedBy`]: approvedBy,
    [`${field}.additionalFee`]: additionalFee || 0,
    // Update scheduled time
    ...(requestType === 'early_check_in'
      ? { scheduledCheckIn: `${record.scheduledCheckIn.split('T')[0]}T${convertTo24Hour(request.requestedTime)}` }
      : { scheduledCheckOut: `${record.scheduledCheckOut.split('T')[0]}T${convertTo24Hour(request.requestedTime)}` }),
    updatedAt: serverTimestamp(),
  });

  // Notify guest of approval
  await notifyGuestOfApproval(bookingId, requestType, request.requestedTime, additionalFee);
}

// Deny time modification request (Owner/Steven only)
export async function denyTimeRequest(
  bookingId: string,
  requestType: 'early_check_in' | 'late_check_out',
  deniedBy: string,
  reason: string
): Promise<void> {
  const recordRef = doc(db(), 'checkInOut', bookingId);
  const field = requestType === 'early_check_in' ? 'earlyCheckInRequest' : 'lateCheckOutRequest';

  await updateDoc(recordRef, {
    [`${field}.status`]: 'denied',
    [`${field}.reviewedAt`]: serverTimestamp(),
    [`${field}.reviewedBy`]: deniedBy,
    [`${field}.denialReason`]: reason,
    updatedAt: serverTimestamp(),
  });

  // Notify guest of denial
  await notifyGuestOfDenial(bookingId, requestType, reason);
}

// Get pending time requests (for owner dashboard)
export async function getPendingTimeRequests(): Promise<{
  request: TimeModificationRequest;
  record: CheckInOutRecord;
}[]> {
  const recordsRef = collection(db(), 'checkInOut');
  const snapshot = await getDocs(recordsRef);

  const pending: { request: TimeModificationRequest; record: CheckInOutRecord }[] = [];

  snapshot.docs.forEach(doc => {
    const record = { id: doc.id, ...doc.data() } as CheckInOutRecord;

    if (record.earlyCheckInRequest?.status === 'pending') {
      pending.push({ request: record.earlyCheckInRequest, record });
    }
    if (record.lateCheckOutRequest?.status === 'pending') {
      pending.push({ request: record.lateCheckOutRequest, record });
    }
  });

  return pending;
}

// Get check-in instructions for guest
export async function getCheckInInstructions(bookingId: string): Promise<CheckInInstructions | null> {
  const recordRef = doc(db(), 'checkInOut', bookingId);
  const recordSnap = await getDoc(recordRef);

  if (!recordSnap.exists()) return null;

  const record = recordSnap.data() as CheckInOutRecord;

  // Get property details
  const propertyRef = doc(db(), 'properties', record.propertyId);
  const propertySnap = await getDoc(propertyRef);
  const property = propertySnap.data();

  return {
    propertyName: record.propertyName,
    propertyAddress: property?.address || 'Address provided upon check-in',
    doorCode: record.doorCode,
    doorCodeValidFrom: record.scheduledCheckIn,
    doorCodeValidUntil: record.scheduledCheckOut,
    wifiName: record.wifiName,
    wifiPassword: record.wifiPassword,
    parkingInstructions: property?.parkingInstructions || 'Parking available in driveway',
    checkInTime: formatTime(record.scheduledCheckIn),
    checkOutTime: formatTime(record.scheduledCheckOut),
    houseRules: property?.houseRules || [
      'No smoking inside the property',
      'No parties or events',
      'Quiet hours 10PM - 8AM',
      'Pets allowed with prior approval only',
    ],
    emergencyContact: '(432) 559-1904',
    nearbyAmenities: {
      grocery: 'United Supermarkets - 0.5 miles',
      restaurant: 'Multiple options within 1 mile',
      pharmacy: 'Walgreens - 0.8 miles',
    },
    specialInstructions: property?.specialInstructions,
  };
}

// Get check-in/out record by booking ID
export async function getCheckInOutRecord(bookingId: string): Promise<CheckInOutRecord | null> {
  const recordRef = doc(db(), 'checkInOut', bookingId);
  const recordSnap = await getDoc(recordRef);

  if (!recordSnap.exists()) return null;
  return { id: recordSnap.id, ...recordSnap.data() } as CheckInOutRecord;
}

// Get all check-ins for today (for worker dashboard)
export async function getTodaysCheckIns(): Promise<CheckInOutRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  const recordsRef = collection(db(), 'checkInOut');
  const snapshot = await getDocs(recordsRef);

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as CheckInOutRecord)
    .filter(r => r.scheduledCheckIn.startsWith(today) && r.checkInStatus === 'pending');
}

// Get all check-outs for today
export async function getTodaysCheckOuts(): Promise<CheckInOutRecord[]> {
  const today = new Date().toISOString().split('T')[0];
  const recordsRef = collection(db(), 'checkInOut');
  const snapshot = await getDocs(recordsRef);

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as CheckInOutRecord)
    .filter(r => r.scheduledCheckOut.startsWith(today) && r.checkOutStatus === 'pending');
}

// Helper: Convert 12-hour time to 24-hour
function convertTo24Hour(time12h: string): string {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');

  if (hours === '12') {
    hours = '00';
  }

  if (modifier === 'PM') {
    hours = String(parseInt(hours, 10) + 12);
  }

  return `${hours.padStart(2, '0')}:${minutes}:00`;
}

// Helper: Format ISO datetime to readable time
function formatTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Notify owner of time modification request
async function notifyOwnerOfTimeRequest(
  request: TimeModificationRequest,
  record: CheckInOutRecord
): Promise<void> {
  // In production, this would send email/SMS to Steven
  console.log(`[NOTIFICATION] Time request from ${record.guestName}:`, {
    type: request.type,
    requestedTime: request.requestedTime,
    property: record.propertyName,
    reason: request.reason,
  });

  // Store notification for dashboard
  const notifRef = doc(collection(db(), 'ownerNotifications'));
  await setDoc(notifRef, {
    type: 'time_request',
    bookingId: request.bookingId,
    guestName: record.guestName,
    propertyName: record.propertyName,
    requestType: request.type,
    requestedTime: request.requestedTime,
    reason: request.reason,
    status: 'unread',
    createdAt: serverTimestamp(),
  });
}

// Notify guest of approval
async function notifyGuestOfApproval(
  bookingId: string,
  requestType: 'early_check_in' | 'late_check_out',
  approvedTime: string,
  additionalFee?: number
): Promise<void> {
  const record = await getCheckInOutRecord(bookingId);
  if (!record) return;

  console.log(`[NOTIFICATION] Approved ${requestType} for ${record.guestEmail}:`, {
    approvedTime,
    additionalFee,
  });

  // Would send email to guest
}

// Notify guest of denial
async function notifyGuestOfDenial(
  bookingId: string,
  requestType: 'early_check_in' | 'late_check_out',
  reason: string
): Promise<void> {
  const record = await getCheckInOutRecord(bookingId);
  if (!record) return;

  console.log(`[NOTIFICATION] Denied ${requestType} for ${record.guestEmail}:`, {
    reason,
  });

  // Would send email to guest
}

// Send complete welcome email with all instructions and door code
export async function sendCompleteWelcomeEmail(bookingId: string): Promise<boolean> {
  const record = await getCheckInOutRecord(bookingId);
  if (!record) return false;

  const instructions = await getCheckInInstructions(bookingId);
  if (!instructions) return false;

  const emailData = {
    guestName: record.guestName,
    guestEmail: record.guestEmail,
    propertyName: record.propertyName,
    propertyAddress: instructions.propertyAddress,
    checkInDate: record.scheduledCheckIn.split('T')[0],
    checkOutDate: record.scheduledCheckOut.split('T')[0],
    checkInTime: instructions.checkInTime,
    checkOutTime: instructions.checkOutTime,
    numberOfGuests: 2, // Would come from booking
    numberOfNights: Math.ceil(
      (new Date(record.scheduledCheckOut).getTime() - new Date(record.scheduledCheckIn).getTime()) /
      (1000 * 60 * 60 * 24)
    ),
    totalAmount: 0, // Would come from booking
    confirmationNumber: bookingId,
    wifiName: record.wifiName,
    wifiPassword: record.wifiPassword,
    doorCode: record.doorCode,
    parkingInstructions: instructions.parkingInstructions,
    specialInstructions: instructions.houseRules.join('\n- '),
    contactPhone: instructions.emergencyContact,
  };

  const result = await sendBookingEmail('welcome', emailData);
  return result.success;
}
