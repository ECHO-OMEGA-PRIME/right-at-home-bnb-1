'use client';

/**
 * Right at Home BnB - Airbnb Integration Module
 * Airbnb iCal calendar synchronization
 * @author ECHO OMEGA PRIME
 *
 * Airbnb iCal URL Format:
 * https://www.airbnb.com/calendar/ical/LISTING_ID.ics?s=SECRET_KEY
 *
 * Features:
 * - Import Airbnb bookings via iCal feed
 * - Sync every 60 minutes (Airbnb standard)
 * - Parse guest names and booking details
 */

import { db } from './auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

// Airbnb Connection Types
export type AirbnbConnectionStatus = 'connected' | 'disconnected' | 'pending' | 'error';

// Airbnb Property Listing
export interface AirbnbListing {
  id: string;
  propertyId: string;
  airbnbListingId: string;
  airbnbUrl: string;
  icalImportUrl: string;
  icalExportUrl: string;
  connectionStatus: AirbnbConnectionStatus;
  lastSyncTime?: string;
  lastSyncStatus?: 'success' | 'failed' | 'partial';
  lastSyncBookings?: number;
  createdAt: string;
  updatedAt: string;
  title?: string;
  nightlyRate?: number;
  minNights?: number;
  maxGuests?: number;
  instantBook?: boolean;
}

// Airbnb Booking from iCal
export interface AirbnbBooking {
  uid: string;
  propertyId: string;
  airbnbListingId: string;
  source: 'airbnb';
  guestName?: string;
  checkIn: string;
  checkOut: string;
  confirmationCode?: string;
  description?: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'blocked';
  importedAt: string;
}

// Sync Log Entry
export interface AirbnbSyncLog {
  id: string;
  propertyId: string;
  status: 'success' | 'failed' | 'partial';
  bookingsImported: number;
  errors?: string[];
  timestamp: string;
}

// Airbnb Integration Stats
export interface AirbnbStats {
  connectedListings: number;
  totalBookings: number;
  lastSyncTime?: string;
  syncSuccessRate: number;
  upcomingAirbnbBookings: number;
}

// Register a property for Airbnb iCal sync
export async function registerAirbnbProperty(
  propertyId: string,
  airbnbListingId: string,
  icalImportUrl: string,
  options?: {
    title?: string;
    nightlyRate?: number;
    minNights?: number;
    maxGuests?: number;
  }
): Promise<AirbnbListing> {
  const listingId = `airbnb_${propertyId}`;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const icalExportUrl = `${baseUrl}/api/ical/${propertyId}/airbnb.ics`;

  const listing: AirbnbListing = {
    id: listingId,
    propertyId,
    airbnbListingId,
    airbnbUrl: `https://www.airbnb.com/rooms/${airbnbListingId}`,
    icalImportUrl,
    icalExportUrl,
    connectionStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...options,
  };

  await setDoc(doc(db(), 'airbnb_listings', listingId), listing);
  return listing;
}

// Get Airbnb listing for a property
export async function getAirbnbListing(propertyId: string): Promise<AirbnbListing | null> {
  const listingId = `airbnb_${propertyId}`;
  const docRef = doc(db(), 'airbnb_listings', listingId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as AirbnbListing;
  }
  return null;
}

// Update Airbnb listing
export async function updateAirbnbListing(
  listingId: string,
  updates: Partial<AirbnbListing>
): Promise<void> {
  const listingRef = doc(db(), 'airbnb_listings', listingId);
  await updateDoc(listingRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// Disconnect property from Airbnb
export async function disconnectAirbnbProperty(listingId: string): Promise<void> {
  await updateAirbnbListing(listingId, {
    connectionStatus: 'disconnected',
  });
}

// Parse iCal content and extract Airbnb bookings
function parseAirbnbICalContent(icalContent: string, propertyId: string, airbnbListingId: string): AirbnbBooking[] {
  const bookings: AirbnbBooking[] = [];
  const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;

  while ((match = eventRegex.exec(icalContent)) !== null) {
    const eventContent = match[1];

    const uid = extractICalField(eventContent, 'UID');
    const summary = extractICalField(eventContent, 'SUMMARY');
    const dtstart = extractICalField(eventContent, 'DTSTART');
    const dtend = extractICalField(eventContent, 'DTEND');
    const description = extractICalField(eventContent, 'DESCRIPTION');

    if (uid && dtstart && dtend) {
      const checkIn = parseICalDate(dtstart);
      const checkOut = parseICalDate(dtend);
      const guestName = extractAirbnbGuestName(summary || '');
      const confirmationCode = extractAirbnbConfirmationCode(summary || '', description || '');
      const status = determineBookingStatus(summary || '');

      bookings.push({
        uid,
        propertyId,
        airbnbListingId,
        source: 'airbnb',
        guestName,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        confirmationCode,
        description: description ?? undefined,
        status,
        importedAt: new Date().toISOString(),
      });
    }
  }

  return bookings;
}

// Extract field value from iCal content
function extractICalField(content: string, field: string): string | null {
  const regex = new RegExp(`${field}(?:;[^:]*)?:(.+?)(?:\\r?\\n|$)`);
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

// Parse iCal date format
function parseICalDate(dateStr: string): Date {
  if (dateStr.length === 8) {
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1;
    const day = parseInt(dateStr.slice(6, 8));
    return new Date(year, month, day);
  }
  return new Date(dateStr);
}

// Extract guest name from Airbnb summary
function extractAirbnbGuestName(summary: string): string | undefined {
  const patterns = [
    /Reserved\s*-\s*(.+)/i,
    /Confirmed\)\s*-\s*(.+)/i,
    /Airbnb.*-\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

// Extract confirmation code from Airbnb booking
function extractAirbnbConfirmationCode(summary: string, description: string): string | undefined {
  const codePatterns = [
    /Confirmation:\s*(\w+)/i,
    /Confirmation Code:\s*(\w+)/i,
    /Code:\s*(\w+)/i,
    /HM[A-Z0-9]+/,
  ];

  const searchText = `${summary} ${description}`;

  for (const pattern of codePatterns) {
    const match = searchText.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  return undefined;
}

// Determine booking status from summary
function determineBookingStatus(summary: string): 'confirmed' | 'pending' | 'cancelled' | 'blocked' {
  const lowerSummary = summary.toLowerCase();

  if (lowerSummary.includes('blocked') || lowerSummary.includes('not available')) {
    return 'blocked';
  }
  if (lowerSummary.includes('cancelled') || lowerSummary.includes('canceled')) {
    return 'cancelled';
  }
  if (lowerSummary.includes('pending') || lowerSummary.includes('request')) {
    return 'pending';
  }
  return 'confirmed';
}

// Import bookings from Airbnb iCal feed
export async function importAirbnbBookings(listingId: string): Promise<{
  success: boolean;
  bookingsImported: number;
  errors?: string[];
}> {
  try {
    const listingRef = doc(db(), 'airbnb_listings', listingId);
    const listingSnap = await getDoc(listingRef);

    if (!listingSnap.exists()) {
      return { success: false, bookingsImported: 0, errors: ['Listing not found'] };
    }

    const listing = listingSnap.data() as AirbnbListing;

    const response = await fetch(listing.icalImportUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch iCal: ${response.status}`);
    }

    const icalContent = await response.text();
    const bookings = parseAirbnbICalContent(icalContent, listing.propertyId, listing.airbnbListingId);

    for (const booking of bookings) {
      await setDoc(
        doc(db(), 'bookings', `airbnb_${booking.uid}`),
        {
          ...booking,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    await updateDoc(listingRef, {
      connectionStatus: 'connected',
      lastSyncTime: new Date().toISOString(),
      lastSyncStatus: 'success',
      lastSyncBookings: bookings.length,
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db(), 'airbnb_sync_logs', `${listingId}_${Date.now()}`), {
      propertyId: listing.propertyId,
      status: 'success',
      bookingsImported: bookings.length,
      timestamp: new Date().toISOString(),
    });

    return { success: true, bookingsImported: bookings.length };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await updateDoc(doc(db(), 'airbnb_listings', listingId), {
      connectionStatus: 'error',
      lastSyncStatus: 'failed',
      updatedAt: serverTimestamp(),
    });

    return {
      success: false,
      bookingsImported: 0,
      errors: [errorMessage],
    };
  }
}

// Get all Airbnb bookings for a property
export async function getAirbnbBookings(propertyId: string): Promise<AirbnbBooking[]> {
  const bookingsRef = collection(db(), 'bookings');
  const q = query(
    bookingsRef,
    where('propertyId', '==', propertyId),
    where('source', '==', 'airbnb'),
    orderBy('checkIn')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => docSnap.data() as AirbnbBooking);
}

// Get Airbnb integration stats
export async function getAirbnbStats(): Promise<AirbnbStats> {
  const listingsRef = collection(db(), 'airbnb_listings');
  const listingsSnap = await getDocs(listingsRef);

  const listings = listingsSnap.docs.map(docSnap => docSnap.data() as AirbnbListing);
  const connectedListings = listings.filter(l => l.connectionStatus === 'connected').length;

  const bookingsRef = collection(db(), 'bookings');
  const q = query(bookingsRef, where('source', '==', 'airbnb'));
  const bookingsSnap = await getDocs(q);

  const bookings = bookingsSnap.docs.map(docSnap => docSnap.data() as AirbnbBooking);
  const now = new Date();
  const upcomingBookings = bookings.filter(b => new Date(b.checkIn) > now);

  const successfulSyncs = listings.filter(l => l.lastSyncStatus === 'success').length;
  const syncSuccessRate = listings.length > 0 ? (successfulSyncs / listings.length) * 100 : 0;

  const sortedListings = listings
    .filter(l => l.lastSyncTime)
    .sort((a, b) => new Date(b.lastSyncTime!).getTime() - new Date(a.lastSyncTime!).getTime());

  return {
    connectedListings,
    totalBookings: bookings.length,
    lastSyncTime: sortedListings[0]?.lastSyncTime,
    syncSuccessRate,
    upcomingAirbnbBookings: upcomingBookings.length,
  };
}

// Sync all connected Airbnb listings
export async function syncAllAirbnbListings(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  errors?: string[];
}> {
  const listingsRef = collection(db(), 'airbnb_listings');
  const q = query(listingsRef, where('connectionStatus', '==', 'connected'));
  const snapshot = await getDocs(q);

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const docSnap of snapshot.docs) {
    const result = await importAirbnbBookings(docSnap.id);
    if (result.success) {
      synced++;
    } else {
      failed++;
      if (result.errors) {
        errors.push(...result.errors);
      }
    }
  }

  return {
    success: failed === 0,
    synced,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}
