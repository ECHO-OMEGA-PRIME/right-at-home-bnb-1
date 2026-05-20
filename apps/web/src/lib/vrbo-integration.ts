'use client';

/**
 * Right at Home BnB - VRBO Integration Module
 * Complete VRBO channel management for property listings
 * @author ECHO OMEGA PRIME
 *
 * Integration Types:
 * 1. iCal Sync (Free) - Calendar synchronization every 60 minutes
 * 2. Full API (Requires Partner Agreement) - Real-time everything
 *
 * Apply for API access: https://integration-central.vrbo.com
 * Contact: pmsalesinquiry@expediagroup.com
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

// VRBO Connection Types
export type VRBOConnectionStatus = 'connected' | 'disconnected' | 'pending' | 'error';
export type SyncDirection = 'import' | 'export' | 'both';

// VRBO Property Listing
export interface VRBOListing {
  id: string;
  propertyId: string;
  vrboListingId: string;
  vrboUrl: string;
  icalImportUrl: string;
  icalExportUrl: string;
  connectionStatus: VRBOConnectionStatus;
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

// VRBO Booking from iCal
export interface VRBOBooking {
  uid: string;
  propertyId: string;
  vrboListingId: string;
  source: 'vrbo';
  guestName?: string;
  checkIn: string;
  checkOut: string;
  confirmationCode?: string;
  description?: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'blocked';
  importedAt: string;
}

// Sync Log Entry
export interface VRBOSyncLog {
  id: string;
  propertyId: string;
  direction: SyncDirection;
  status: 'success' | 'failed' | 'partial';
  bookingsImported: number;
  bookingsExported: number;
  errors?: string[];
  timestamp: string;
}

// VRBO Integration Stats
export interface VRBOStats {
  connectedListings: number;
  totalBookings: number;
  lastSyncTime?: string;
  syncSuccessRate: number;
  upcomingVRBOBookings: number;
}

// Register a property for VRBO iCal sync
export async function registerVRBOProperty(
  propertyId: string,
  vrboListingId: string,
  icalImportUrl: string,
  options?: {
    title?: string;
    nightlyRate?: number;
    minNights?: number;
    maxGuests?: number;
  }
): Promise<VRBOListing> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.rah-midland.com';
  const icalExportUrl = `${baseUrl}/ical/${propertyId}/vrbo.ics`;
  const vrboUrl = `https://www.vrbo.com/${vrboListingId}`;

  const listing: VRBOListing = {
    id: `vrbo_${propertyId}_${vrboListingId}`,
    propertyId,
    vrboListingId,
    vrboUrl,
    icalImportUrl,
    icalExportUrl,
    connectionStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...options,
  };

  await setDoc(doc(db(), 'vrbo_listings', listing.id), {
    ...listing,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return listing;
}

// Update VRBO listing configuration
export async function updateVRBOListing(
  listingId: string,
  updates: Partial<VRBOListing>
): Promise<void> {
  const listingRef = doc(db(), 'vrbo_listings', listingId);
  await updateDoc(listingRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// Disconnect property from VRBO
export async function disconnectVRBOProperty(listingId: string): Promise<void> {
  await updateVRBOListing(listingId, {
    connectionStatus: 'disconnected',
  });
}

// Parse iCal content and extract bookings
function parseICalContent(icalContent: string, propertyId: string, vrboListingId: string): VRBOBooking[] {
  const bookings: VRBOBooking[] = [];
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
      const guestName = extractGuestName(summary || '');
      const confirmationCode = extractConfirmationCode(description || '');
      const status = summary?.toLowerCase().includes('blocked') ? 'blocked' : 'confirmed';

      bookings.push({
        uid,
        propertyId,
        vrboListingId,
        source: 'vrbo',
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
  if (dateStr.includes('T')) {
    return new Date(
      dateStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z')
    );
  }
  return new Date(dateStr);
}

// Extract guest name from booking summary
function extractGuestName(summary: string): string | undefined {
  const patterns = [
    /Reserved\s*[-:]\s*(.+)/i,
    /Booked\s*[-:]\s*(.+)/i,
    /(.+?)\s*[-:]\s*(?:VRBO|Reserved|Blocked)/i,
  ];

  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match) return match[1].trim();
  }

  if (summary && !summary.toLowerCase().includes('blocked') && !summary.toLowerCase().includes('unavailable')) {
    return summary;
  }

  return undefined;
}

// Extract confirmation code from description
function extractConfirmationCode(description: string): string | undefined {
  const patterns = [
    /confirmation[:\s]*([A-Z0-9-]+)/i,
    /code[:\s]*([A-Z0-9-]+)/i,
    /booking[:\s]*([A-Z0-9-]+)/i,
    /reservation[:\s]*([A-Z0-9-]+)/i,
    /HA-([A-Z0-9]+)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) return match[1].trim();
  }

  return undefined;
}

// Sync calendar from VRBO (import bookings)
export async function syncFromVRBO(listingId: string): Promise<{
  success: boolean;
  bookingsImported: number;
  bookings: VRBOBooking[];
  error?: string;
}> {
  try {
    const listingRef = doc(db(), 'vrbo_listings', listingId);
    const listingSnap = await getDoc(listingRef);

    if (!listingSnap.exists()) {
      return { success: false, bookingsImported: 0, bookings: [], error: 'Listing not found' };
    }

    const listing = listingSnap.data() as VRBOListing;
    const response = await fetch(listing.icalImportUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch iCal: ${response.status}`);
    }

    const icalContent = await response.text();
    const bookings = parseICalContent(icalContent, listing.propertyId, listing.vrboListingId);

    for (const booking of bookings) {
      await setDoc(doc(db(), 'vrbo_bookings', booking.uid), booking);
    }

    await updateDoc(listingRef, {
      connectionStatus: 'connected',
      lastSyncTime: new Date().toISOString(),
      lastSyncStatus: 'success',
      lastSyncBookings: bookings.length,
      updatedAt: serverTimestamp(),
    });

    await logSync(listing.propertyId, 'import', 'success', bookings.length, 0);

    return {
      success: true,
      bookingsImported: bookings.length,
      bookings,
    };
  } catch (error: any) {
    const listingRef = doc(db(), 'vrbo_listings', listingId);
    await updateDoc(listingRef, {
      lastSyncTime: new Date().toISOString(),
      lastSyncStatus: 'failed',
      updatedAt: serverTimestamp(),
    });

    return {
      success: false,
      bookingsImported: 0,
      bookings: [],
      error: error.message,
    };
  }
}

// Generate iCal content for VRBO to import
export async function generateExportCalendar(propertyId: string): Promise<string> {
  const bookingsQuery = query(
    collection(db(), 'bookings'),
    where('propertyId', '==', propertyId),
    orderBy('checkIn')
  );

  const snapshot = await getDocs(bookingsQuery);
  const bookings = snapshot.docs.map(doc => doc.data());

  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Right at Home BnB//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Right at Home BnB',
  ];

  for (const booking of bookings) {
    if (booking.source === 'vrbo') continue; // Skip VRBO bookings

    const uid = `rah-${booking.id}@rah-midland.com`;
    const dtstart = formatICalDate(new Date(booking.checkIn));
    const dtend = formatICalDate(new Date(booking.checkOut));
    const dtstamp = formatICalDateTime(new Date());
    const summary = `Blocked - ${booking.guestName || 'Reserved'}`;

    ical.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `DTSTAMP:${dtstamp}`,
      `SUMMARY:${summary}`,
      'DESCRIPTION:Booking from Right at Home BnB',
      'END:VEVENT'
    );
  }

  ical.push('END:VCALENDAR');
  return ical.join('\r\n');
}

// Format date for iCal (YYYYMMDD)
function formatICalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Format datetime for iCal (YYYYMMDDTHHMMSSZ)
function formatICalDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Log a sync operation
async function logSync(
  propertyId: string,
  direction: SyncDirection,
  status: 'success' | 'failed' | 'partial',
  bookingsImported: number,
  bookingsExported: number,
  errors?: string[]
): Promise<void> {
  const logEntry: VRBOSyncLog = {
    id: `sync_${propertyId}_${Date.now()}`,
    propertyId,
    direction,
    status,
    bookingsImported,
    bookingsExported,
    errors,
    timestamp: new Date().toISOString(),
  };

  await setDoc(doc(db(), 'vrbo_sync_logs', logEntry.id), logEntry);
}

// Get all VRBO listings
export async function getVRBOListings(): Promise<VRBOListing[]> {
  const snapshot = await getDocs(collection(db(), 'vrbo_listings'));
  return snapshot.docs.map(doc => doc.data() as VRBOListing);
}

// Get VRBO listing by property ID
export async function getVRBOListingByProperty(propertyId: string): Promise<VRBOListing | null> {
  const q = query(
    collection(db(), 'vrbo_listings'),
    where('propertyId', '==', propertyId)
  );
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : (snapshot.docs[0].data() as VRBOListing);
}

// Get VRBO bookings for a property
export async function getVRBOBookings(propertyId: string): Promise<VRBOBooking[]> {
  const q = query(
    collection(db(), 'vrbo_bookings'),
    where('propertyId', '==', propertyId),
    orderBy('checkIn')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as VRBOBooking);
}

// Get upcoming VRBO bookings across all properties
export async function getUpcomingVRBOBookings(limit: number = 10): Promise<VRBOBooking[]> {
  const now = new Date().toISOString();
  const q = query(
    collection(db(), 'vrbo_bookings'),
    where('checkIn', '>=', now),
    where('status', '==', 'confirmed'),
    orderBy('checkIn')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.slice(0, limit).map(doc => doc.data() as VRBOBooking);
}

// Get sync logs for a property
export async function getSyncLogs(propertyId: string, limit: number = 20): Promise<VRBOSyncLog[]> {
  const q = query(
    collection(db(), 'vrbo_sync_logs'),
    where('propertyId', '==', propertyId),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.slice(0, limit).map(doc => doc.data() as VRBOSyncLog);
}

// Get VRBO integration statistics
export async function getVRBOStats(): Promise<VRBOStats> {
  const listings = await getVRBOListings();
  const connectedListings = listings.filter(l => l.connectionStatus === 'connected').length;

  const bookingsSnap = await getDocs(collection(db(), 'vrbo_bookings'));
  const totalBookings = bookingsSnap.size;

  const upcomingBookings = await getUpcomingVRBOBookings(100);

  const listingsWithSync = listings.filter(l => l.lastSyncTime);
  const mostRecentSync = listingsWithSync.length > 0
    ? listingsWithSync.sort((a, b) =>
        new Date(b.lastSyncTime!).getTime() - new Date(a.lastSyncTime!).getTime()
      )[0].lastSyncTime
    : undefined;

  let successRate = 100;
  if (listingsWithSync.length > 0) {
    const successfulSyncs = listingsWithSync.filter(l => l.lastSyncStatus === 'success').length;
    successRate = Math.round((successfulSyncs / listingsWithSync.length) * 100);
  }

  return {
    connectedListings,
    totalBookings,
    lastSyncTime: mostRecentSync,
    syncSuccessRate: successRate,
    upcomingVRBOBookings: upcomingBookings.length,
  };
}

// VRBO Setup Instructions
export const VRBO_SETUP_GUIDE = {
  icalSync: {
    title: 'iCal Calendar Sync (Free)',
    description: 'Basic calendar synchronization that updates every 60 minutes',
    steps: [
      {
        step: 1,
        title: 'Get your VRBO iCal URL',
        instructions: [
          'Log into your VRBO dashboard',
          'Go to Calendar > Import & Export',
          'Click "Export calendar"',
          'Copy the .ics URL (ends with .ics)',
        ],
      },
      {
        step: 2,
        title: 'Register property here',
        instructions: [
          'Go to VRBO Settings in this dashboard',
          'Click "Add VRBO Listing"',
          'Enter your VRBO listing ID and iCal URL',
          'Save the configuration',
        ],
      },
      {
        step: 3,
        title: 'Import our calendar to VRBO',
        instructions: [
          'Copy the export URL we provide',
          'Go back to VRBO > Calendar > Import & Export',
          'Click "Import a calendar"',
          'Paste our URL and save',
        ],
      },
      {
        step: 4,
        title: 'Verify sync',
        instructions: [
          'Wait up to 60 minutes for first sync',
          'Check that bookings appear in both systems',
          'Calendars will auto-sync every hour',
        ],
      },
    ],
  },
  fullAPI: {
    title: 'Full API Integration (Premium)',
    description: 'Real-time sync with guest messaging, pricing, and content management',
    howToApply: 'https://integration-central.vrbo.com',
    contact: 'pmsalesinquiry@expediagroup.com',
    benefits: [
      'Real-time booking notifications (no 60-min delay)',
      'Guest messaging integration',
      'Dynamic pricing management',
      'Content sync (photos, descriptions, amenities)',
      'Instant availability updates',
      'Payment processing',
      'Review management',
    ],
    requirements: [
      'Business with multiple properties',
      'Technical development team',
      'Signed API agreement with Expedia Group',
      'Completed onboarding process',
    ],
  },
};
