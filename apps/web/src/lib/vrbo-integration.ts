'use client';

/**
 * Right at Home BnB - VRBO channel management, over the server API.
 *
 * This module used to talk to Firestore directly FROM THE BROWSER, against a
 * `vrbo_listings` collection of its own. That was a duplicate of the real
 * integration: `VrboSync`, `SyncLog` and VRBO-platform `Booking` rows already
 * live in Postgres and are driven by `/api/admin/vrbo-status`,
 * `/api/admin/vrbo-ical` and the vrbo-sync-service. Two stores meant the VRBO
 * page could show a listing as "connected" that the sync service had never
 * heard of, and a client-side write meant channel configuration bypassed the
 * owner/admin check every one of those routes enforces.
 *
 * It is now a thin typed client over those routes. The exported shapes are
 * unchanged, so the page keeps its contract; only the data source moved.
 *
 * Integration types:
 * 1. iCal Sync (Free) - Calendar synchronization every 60 minutes
 * 2. Full API (Requires Partner Agreement) - Real-time everything
 *
 * Apply for API access: https://integration-central.vrbo.com
 * Contact: pmsalesinquiry@expediagroup.com
 */

// VRBO Connection Types
export type VRBOConnectionStatus = 'connected' | 'disconnected' | 'pending' | 'error';
export type SyncDirection = 'import' | 'export' | 'both';

export interface VRBOListing {
  /** The propertyId. VrboSync is unique per property, so it IS the identity. */
  id: string;
  propertyId: string;
  propertyName?: string;
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

export interface VRBOStats {
  connectedListings: number;
  totalBookings: number;
  lastSyncTime?: string;
  syncSuccessRate: number;
  upcomingVRBOBookings: number;
}

// ============================================================
// TRANSPORT
// ============================================================

const STATUS_ENDPOINT = '/api/admin/vrbo-status';

/**
 * Every call goes through here so no caller can forget `credentials`.
 *
 * The routes authenticate with the `rah-auth-token` COOKIE (see api-auth), and
 * middleware refuses `/api/admin/*` outright for anyone below owner/admin. A
 * failure therefore has to surface as a real error rather than an empty list --
 * rendering "0 connected listings" for what is actually a 403 or an outage is
 * how a broken integration comes to look like a working one with nothing in it.
 */
async function callStatusApi<T>(init?: RequestInit): Promise<T> {
  const response = await fetch(STATUS_ENDPOINT, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail =
      payload && typeof payload.error === 'string' ? payload.error : response.statusText;
    throw new Error(`VRBO API ${response.status}: ${detail}`);
  }

  return (await response.json()) as T;
}

interface StatusResponse {
  properties: Array<{
    propertyId: string;
    propertyName: string;
    vrboId: string;
    vrboUrl: string;
    icalUrl: string | null;
    lastIcalSync: string | null;
    lastScrapeSync: string | null;
    syncEnabled: boolean;
    bookingCount: number;
    status: string;
  }>;
  stats: {
    totalProperties: number;
    enabledProperties: number;
    totalVrboBookings: number;
    upcomingVrboBookings: number;
    last24h: { syncs: number; successes: number; failures: number; imported: number };
  };
  recentLogs: Array<{
    syncType: string;
    status: string;
    itemsCreated: number;
    itemsUpdated: number;
    error: string | null;
    durationMs: number | null;
    at: string;
  }>;
  upcomingBookings: Array<{
    id: string;
    propertyId: string;
    guestName: string | null;
    checkIn: string;
    checkOut: string;
    confirmCode: string | null;
    status: string;
  }>;
}

function getStatus(): Promise<StatusResponse> {
  return callStatusApi<StatusResponse>();
}

function exportCalendarUrl(propertyId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  return `${baseUrl}/api/integrations/ical/${propertyId}/vrbo.ics`;
}

/**
 * Connection status is DERIVED, never stored.
 *
 * The Firestore version persisted a `connectionStatus` string that only its own
 * writes ever updated, so a listing stayed "connected" long after syncing began
 * failing. Deriving it from what the sync service actually did means the badge
 * cannot disagree with reality.
 */
function deriveStatus(
  syncEnabled: boolean,
  lastSync: string | null,
  lastLogStatus?: string,
): VRBOConnectionStatus {
  if (!syncEnabled) return 'disconnected';
  if (lastLogStatus === 'failed') return 'error';
  if (!lastSync) return 'pending';
  return 'connected';
}

function toListing(
  row: StatusResponse['properties'][number],
  logs: StatusResponse['recentLogs'],
): VRBOListing {
  const lastSync = row.lastIcalSync ?? row.lastScrapeSync;
  const lastLog = logs[0];

  return {
    id: row.propertyId,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    vrboListingId: row.vrboId,
    vrboUrl: row.vrboUrl,
    icalImportUrl: row.icalUrl ?? '',
    icalExportUrl: exportCalendarUrl(row.propertyId),
    connectionStatus: deriveStatus(row.syncEnabled, lastSync, lastLog?.status),
    lastSyncTime: lastSync ?? undefined,
    lastSyncStatus: (lastLog?.status as VRBOListing['lastSyncStatus']) ?? undefined,
    lastSyncBookings: row.bookingCount,
    title: row.propertyName,
    createdAt: lastSync ?? '',
    updatedAt: lastSync ?? '',
  };
}

// ============================================================
// READS
// ============================================================

export async function getVRBOListings(): Promise<VRBOListing[]> {
  const status = await getStatus();
  return status.properties.map((p) => toListing(p, status.recentLogs));
}

export async function getVRBOListingByProperty(propertyId: string): Promise<VRBOListing | null> {
  const listings = await getVRBOListings();
  return listings.find((l) => l.propertyId === propertyId) ?? null;
}

export async function getVRBOStats(): Promise<VRBOStats> {
  const { properties, stats } = await getStatus();

  const attempted = stats.last24h.syncs;
  const lastSyncTimes = properties
    .map((p) => p.lastIcalSync ?? p.lastScrapeSync)
    .filter((t): t is string => Boolean(t))
    .sort();

  return {
    connectedListings: stats.enabledProperties,
    totalBookings: stats.totalVrboBookings,
    lastSyncTime: lastSyncTimes.length ? lastSyncTimes[lastSyncTimes.length - 1] : undefined,
    // No syncs attempted is NOT a 0% success rate -- that renders as total
    // failure on an install that has simply not run yet.
    syncSuccessRate:
      attempted === 0 ? 100 : Math.round((stats.last24h.successes / attempted) * 100),
    upcomingVRBOBookings: stats.upcomingVrboBookings,
  };
}

export async function getUpcomingVRBOBookings(limit: number = 10): Promise<VRBOBooking[]> {
  const { upcomingBookings, properties } = await getStatus();
  const vrboIdByProperty = Object.fromEntries(properties.map((p) => [p.propertyId, p.vrboId]));

  return upcomingBookings.slice(0, limit).map((b) => ({
    uid: b.id,
    propertyId: b.propertyId,
    vrboListingId: vrboIdByProperty[b.propertyId] ?? '',
    source: 'vrbo' as const,
    guestName: b.guestName ?? undefined,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    confirmationCode: b.confirmCode ?? undefined,
    status: b.status?.toUpperCase() === 'CANCELLED' ? 'cancelled' : 'confirmed',
    importedAt: b.checkIn,
  }));
}

export async function getSyncLogs(propertyId: string, limit: number = 20): Promise<VRBOSyncLog[]> {
  const { recentLogs } = await getStatus();

  return recentLogs.slice(0, limit).map((l, i) => ({
    id: `${l.at}-${i}`,
    propertyId,
    direction: l.syncType?.includes('export') ? 'export' : 'import',
    status: (l.status as VRBOSyncLog['status']) ?? 'failed',
    bookingsImported: l.itemsCreated,
    bookingsExported: l.itemsUpdated,
    errors: l.error ? [l.error] : undefined,
    timestamp: l.at,
  }));
}

// ============================================================
// WRITES -- all server-side, all behind the owner/admin guard
// ============================================================

export async function registerVRBOProperty(
  propertyId: string,
  vrboListingId: string,
  icalImportUrl: string,
): Promise<VRBOListing> {
  await callStatusApi({
    method: 'POST',
    body: JSON.stringify({ action: 'connect', propertyId, vrboListingId, icalUrl: icalImportUrl }),
  });

  const listing = await getVRBOListingByProperty(propertyId);
  if (!listing) {
    // The write succeeded but the row is not readable back -- report that
    // rather than fabricating a listing object the server never confirmed.
    throw new Error('VRBO listing was connected but could not be read back');
  }
  return listing;
}

export async function disconnectVRBOProperty(propertyId: string): Promise<void> {
  await callStatusApi({
    method: 'POST',
    body: JSON.stringify({ action: 'set_sync', propertyId, enabled: false }),
  });
}

export async function reconnectVRBOProperty(propertyId: string): Promise<void> {
  await callStatusApi({
    method: 'POST',
    body: JSON.stringify({ action: 'set_sync', propertyId, enabled: true }),
  });
}

export async function syncFromVRBO(propertyId: string): Promise<{
  success: boolean;
  bookingsImported: number;
  error?: string;
}> {
  try {
    const result = await callStatusApi<{
      ok: boolean;
      created?: number;
      imported?: number;
      error?: string;
    }>({
      method: 'POST',
      body: JSON.stringify({ action: 'sync_one', propertyId }),
    });
    return {
      success: Boolean(result.ok),
      bookingsImported: result.created ?? result.imported ?? 0,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      bookingsImported: 0,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

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
