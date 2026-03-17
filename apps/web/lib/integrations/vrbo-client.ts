/**
 * Right at Home BnB - VRBO/Expedia Partner API Client
 * Handles reservation sync, availability updates, messaging, and webhook
 * verification for VRBO-listed properties via the Expedia Partner REST API.
 */

import { createHmac, timingSafeEqual } from 'crypto';

// ============================================
// TYPES
// ============================================

export interface VrboReservation {
  reservationId: string;
  listingId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  guestCount: number;
  totalCents: number;
  status: string;
  pets: boolean;
  specialRequests: string;
}

export interface VrboMessage {
  id: string;
  threadId: string;
  reservationId: string;
  content: string;
  sender: string;
  timestamp: string;
}

export interface VrboWebhookEvent {
  type: string;
  timestamp: string;
  data: VrboReservation | VrboMessage;
}

export interface SyncResult {
  imported: number;
  updated: number;
  cancelled: number;
  conflicts: string[];
  errors: string[];
  lastSyncAt: string;
}

interface VrboConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  webhookSecret: string;
  propertyIds: Record<string, string>;
}

interface VrboApiResponse<T> {
  data: T;
  pagination?: {
    cursor: string | null;
    hasMore: boolean;
  };
}

interface AvailabilityBlock {
  startDate: string;
  endDate: string;
  available: boolean;
  reason?: string;
}

// ============================================
// CONFIGURATION
// ============================================

/**
 * Read VRBO integration configuration from environment variables.
 * VRBO_PROPERTY_MAP is a JSON-encoded Record<internalId, vrboListingId>.
 */
export function getVrboConfig(): VrboConfig {
  const apiKey = process.env.VRBO_API_KEY || '';
  const apiSecret = process.env.VRBO_API_SECRET || '';
  const webhookSecret = process.env.VRBO_WEBHOOK_SECRET || '';
  const baseUrl = process.env.VRBO_API_BASE_URL || 'https://api.vrbo.com/v3';

  let propertyIds: Record<string, string> = {};
  const propertyMapRaw = process.env.VRBO_PROPERTY_MAP;
  if (propertyMapRaw) {
    try {
      propertyIds = JSON.parse(propertyMapRaw);
    } catch {
      console.error('[vrbo-client] Failed to parse VRBO_PROPERTY_MAP JSON');
    }
  }

  if (!apiKey || !apiSecret) {
    console.warn('[vrbo-client] VRBO_API_KEY or VRBO_API_SECRET is not set');
  }

  return { apiKey, apiSecret, baseUrl, webhookSecret, propertyIds };
}

// ============================================
// INTERNAL: API TRANSPORT
// ============================================

/**
 * Generate the Authorization header for Expedia Partner API.
 * Uses HMAC-SHA512 signature with timestamp.
 */
function buildAuthHeaders(config: VrboConfig): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signaturePayload = config.apiKey + timestamp;
  const signature = createHmac('sha512', config.apiSecret)
    .update(signaturePayload)
    .digest('hex');

  return {
    'Authorization': 'EAN apikey=' + config.apiKey + ',signature=' + signature + ',timestamp=' + timestamp,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'RightAtHomeBnB/1.0',
  };
}

/**
 * Internal fetch wrapper with auth, timeout, retry, and structured error handling.
 */
async function vrboFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    params?: Record<string, string>;
    timeoutMs?: number;
    retries?: number;
  } = {}
): Promise<T> {
  const config = getVrboConfig();
  const { method = 'GET', body, params, timeoutMs = 30000, retries = 2 } = options;

  const url = new URL(config.baseUrl + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: buildAuthHeaders(config),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        const waitMs = Math.min(retryAfter * 1000, 30000);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw new Error('VRBO API rate limited after ' + (retries + 1) + ' attempts');
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error('VRBO API ' + response.status + ' on ' + method + ' ' + path + ': ' + errorBody);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (error: unknown) {
      clearTimeout(timer);

      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = new Error('VRBO API request timed out after ' + timeoutMs + 'ms: ' + method + ' ' + path);
      } else if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error('VRBO API unknown error on ' + method + ' ' + path);
      }

      const isTransient =
        lastError.message.includes('timed out') ||
        lastError.message.includes('VRBO API 5') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('fetch failed');

      if (attempt < retries && isTransient) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }

  throw lastError || new Error('VRBO API request failed: ' + path);
}

// ============================================
// RESERVATION SYNC
// ============================================

/**
 * Normalize a raw VRBO API reservation object into our standard VrboReservation shape.
 */
function normalizeReservation(raw: Record<string, unknown>): VrboReservation {
  const guest = (raw.guest as Record<string, unknown>) || {};
  const pricing = (raw.pricing as Record<string, unknown>) || {};
  const stayDates = (raw.stayDates as Record<string, unknown>) || {};
  const policies = (raw.policies as Record<string, unknown>) || {};

  const firstName = guest.firstName ? String(guest.firstName) : '';
  const lastName = guest.lastName ? String(guest.lastName) : '';
  const fullName = guest.name
    ? String(guest.name)
    : (firstName + ' ' + lastName).trim() || 'Unknown';

  return {
    reservationId: String(raw.reservationId || raw.id || ''),
    listingId: String(raw.listingId || raw.propertyId || ''),
    guestName: fullName,
    guestEmail: String(guest.email || ''),
    guestPhone: String(guest.phone || ''),
    checkIn: String(stayDates.checkIn || raw.checkIn || ''),
    checkOut: String(stayDates.checkOut || raw.checkOut || ''),
    checkInTime: String(stayDates.checkInTime || raw.checkInTime || '16:00'),
    checkOutTime: String(stayDates.checkOutTime || raw.checkOutTime || '10:00'),
    guestCount: Number(raw.guestCount || guest.adultCount || 1),
    totalCents: Math.round(
      Number(pricing.totalAmountCents || raw.totalCents || 0) ||
      Number(pricing.totalAmount || pricing.total || 0) * 100
    ),
    status: normalizeStatus(String(raw.status || 'UNKNOWN')),
    pets: Boolean(policies.petsAllowed || raw.pets || false),
    specialRequests: String(raw.specialRequests || raw.guestNotes || ''),
  };
}

/**
 * Map VRBO status strings to our internal status nomenclature.
 */
function normalizeStatus(vrboStatus: string): string {
  const statusMap: Record<string, string> = {
    CONFIRMED: 'CONFIRMED',
    BOOKED: 'CONFIRMED',
    RESERVED: 'CONFIRMED',
    PENDING: 'PENDING',
    INQUIRY: 'INQUIRY',
    CANCELLED: 'CANCELLED',
    CANCELED: 'CANCELLED',
    DECLINED: 'DECLINED',
    EXPIRED: 'EXPIRED',
    COMPLETED: 'COMPLETED',
    CHECKED_IN: 'CHECKED_IN',
    CHECKED_OUT: 'COMPLETED',
    NO_SHOW: 'NO_SHOW',
  };
  return statusMap[vrboStatus.toUpperCase()] || vrboStatus.toUpperCase();
}

/**
 * Fetch all reservations for a specific VRBO listing.
 * Handles cursor-based pagination to retrieve the complete set.
 */
export async function fetchReservations(listingId: string): Promise<VrboReservation[]> {
  const allReservations: VrboReservation[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const params: Record<string, string> = {
      listingId,
      limit: '50',
      sort: 'checkIn:desc',
    };
    if (cursor) {
      params.cursor = cursor;
    }

    const response = await vrboFetch<VrboApiResponse<Record<string, unknown>[]>>(
      '/reservations',
      { params }
    );

    const rawItems = response.data || [];
    for (const raw of rawItems) {
      allReservations.push(normalizeReservation(raw));
    }

    cursor = response.pagination?.cursor || null;
    hasMore = response.pagination?.hasMore === true && cursor !== null;
  }

  return allReservations;
}

/**
 * Sync all properties configured in VRBO_PROPERTY_MAP.
 * Returns a consolidated SyncResult covering every listing.
 */
export async function syncAllProperties(): Promise<SyncResult> {
  const config = getVrboConfig();
  const propertyEntries = Object.entries(config.propertyIds);

  const result: SyncResult = {
    imported: 0,
    updated: 0,
    cancelled: 0,
    conflicts: [],
    errors: [],
    lastSyncAt: new Date().toISOString(),
  };

  if (propertyEntries.length === 0) {
    result.errors.push('No properties configured in VRBO_PROPERTY_MAP');
    return result;
  }

  for (const [internalId, vrboListingId] of propertyEntries) {
    try {
      const reservations = await fetchReservations(vrboListingId);
      const syncOutcome = categorizeReservations(reservations, internalId);

      result.imported += syncOutcome.imported;
      result.updated += syncOutcome.updated;
      result.cancelled += syncOutcome.cancelled;
      result.conflicts.push(...syncOutcome.conflicts);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push('Property ' + internalId + ' (' + vrboListingId + '): ' + message);
    }
  }

  return result;
}

/**
 * Categorize fetched reservations into import/update/cancel buckets.
 * Detects date overlaps across reservations as conflicts.
 */
function categorizeReservations(
  reservations: VrboReservation[],
  internalPropertyId: string
): Omit<SyncResult, 'lastSyncAt' | 'errors'> {
  let imported = 0;
  let updated = 0;
  let cancelled = 0;
  const conflicts: string[] = [];

  const sorted = [...reservations].sort(
    (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()
  );

  const activeReservations: VrboReservation[] = [];

  for (const reservation of sorted) {
    if (reservation.status === 'CANCELLED' || reservation.status === 'DECLINED') {
      cancelled++;
      continue;
    }

    for (const existing of activeReservations) {
      const existingIn = new Date(existing.checkIn).getTime();
      const existingOut = new Date(existing.checkOut).getTime();
      const newIn = new Date(reservation.checkIn).getTime();
      const newOut = new Date(reservation.checkOut).getTime();

      if (newIn < existingOut && newOut > existingIn) {
        conflicts.push(
          'Overlap on ' + internalPropertyId + ': ' + reservation.reservationId +
          ' (' + reservation.checkIn + '-' + reservation.checkOut + ') conflicts with ' +
          existing.reservationId + ' (' + existing.checkIn + '-' + existing.checkOut + ')'
        );
      }
    }

    activeReservations.push(reservation);

    if (reservation.status === 'PENDING' || reservation.status === 'INQUIRY') {
      imported++;
    } else {
      updated++;
    }
  }

  return { imported, updated, cancelled, conflicts };
}

// ============================================
// AVAILABILITY MANAGEMENT
// ============================================

/**
 * Push availability blocks to VRBO for a specific listing.
 * Dates array contains objects with startDate, endDate, and available flag.
 */
export async function updateAvailability(
  listingId: string,
  dates: AvailabilityBlock[]
): Promise<void> {
  const MAX_BATCH = 365;
  const batches: AvailabilityBlock[][] = [];

  for (let i = 0; i < dates.length; i += MAX_BATCH) {
    batches.push(dates.slice(i, i + MAX_BATCH));
  }

  for (const batch of batches) {
    const payload = {
      listingId,
      availability: batch.map((block) => ({
        dateRange: {
          startDate: block.startDate,
          endDate: block.endDate,
        },
        available: block.available,
        reason: block.reason || (block.available ? undefined : 'OWNER_BLOCK'),
      })),
    };

    await vrboFetch<void>('/listings/' + listingId + '/availability', {
      method: 'PUT',
      body: payload as unknown as Record<string, unknown>,
    });
  }
}

// ============================================
// MESSAGING
// ============================================

/**
 * Fetch message history for a specific reservation on a listing.
 */
export async function fetchMessages(
  listingId: string,
  reservationId: string
): Promise<VrboMessage[]> {
  const allMessages: VrboMessage[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const params: Record<string, string> = {
      listingId,
      reservationId,
      limit: '50',
      sort: 'timestamp:asc',
    };
    if (cursor) {
      params.cursor = cursor;
    }

    const response = await vrboFetch<VrboApiResponse<Record<string, unknown>[]>>(
      '/messages',
      { params }
    );

    const rawItems = response.data || [];
    for (const raw of rawItems) {
      allMessages.push(normalizeMessage(raw));
    }

    cursor = response.pagination?.cursor || null;
    hasMore = response.pagination?.hasMore === true && cursor !== null;
  }

  return allMessages;
}

/**
 * Send a message to a guest via the VRBO messaging API.
 */
export async function sendMessage(
  listingId: string,
  reservationId: string,
  content: string
): Promise<VrboMessage> {
  const response = await vrboFetch<Record<string, unknown>>('/messages', {
    method: 'POST',
    body: {
      listingId,
      reservationId,
      content,
      sender: 'host',
    },
  });

  return normalizeMessage(response);
}

/**
 * Normalize a raw VRBO API message object.
 */
function normalizeMessage(raw: Record<string, unknown>): VrboMessage {
  return {
    id: String(raw.id || raw.messageId || ''),
    threadId: String(raw.threadId || raw.conversationId || ''),
    reservationId: String(raw.reservationId || ''),
    content: String(raw.content || raw.body || raw.text || ''),
    sender: String(raw.sender || raw.senderType || 'unknown'),
    timestamp: String(raw.timestamp || raw.sentAt || raw.createdAt || new Date().toISOString()),
  };
}

// ============================================
// WEBHOOK HANDLING
// ============================================

/**
 * Verify a VRBO webhook request signature using HMAC-SHA256.
 * The signature is computed over the raw request body using VRBO_WEBHOOK_SECRET.
 * Returns true if the signature matches, false otherwise.
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const config = getVrboConfig();

  if (!config.webhookSecret) {
    console.error('[vrbo-client] VRBO_WEBHOOK_SECRET not configured, rejecting webhook');
    return false;
  }

  if (!signature) {
    return false;
  }

  const providedSig = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature;

  const expectedSig = createHmac('sha256', config.webhookSecret)
    .update(body)
    .digest('hex');

  try {
    const providedBuf = Buffer.from(providedSig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }

    return timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Parse a raw webhook payload into a structured VrboWebhookEvent.
 * Handles the various event shapes VRBO sends (reservation events, message events, etc.).
 */
export function parseWebhookEvent(payload: Record<string, unknown>): VrboWebhookEvent {
  const eventType = String(
    payload.event_type || payload.eventType || payload.type || 'unknown'
  );
  const timestamp = String(
    payload.timestamp || payload.created_at || payload.sentAt || new Date().toISOString()
  );

  const eventData = (payload.data || payload.payload || payload) as Record<string, unknown>;

  let data: VrboReservation | VrboMessage;

  if (isReservationEvent(eventType)) {
    data = normalizeReservation(eventData);
  } else if (isMessageEvent(eventType)) {
    data = normalizeMessage(eventData);
  } else {
    data = normalizeReservation(eventData);
  }

  return { type: eventType, timestamp, data };
}

/**
 * Determine what actions should be taken for a given webhook event.
 * Returns a set of action flags the caller can use to trigger downstream workflows.
 */
export function getActionsForEvent(event: VrboWebhookEvent): {
  shouldSyncReservation: boolean;
  shouldUpdateCalendar: boolean;
  shouldNotifyHost: boolean;
  shouldNotifyGuest: boolean;
  shouldUpdateAvailability: boolean;
  shouldCreateGuestProfile: boolean;
  shouldTriggerDispatch: boolean;
  actionDescription: string;
} {
  const type = event.type.toLowerCase();

  const actions = {
    shouldSyncReservation: false,
    shouldUpdateCalendar: false,
    shouldNotifyHost: false,
    shouldNotifyGuest: false,
    shouldUpdateAvailability: false,
    shouldCreateGuestProfile: false,
    shouldTriggerDispatch: false,
    actionDescription: 'No specific action for event type: ' + event.type,
  };

  // New booking / reservation created
  if (
    type.includes('reservation.created') ||
    type.includes('booking.new') ||
    type === 'new_reservation'
  ) {
    actions.shouldSyncReservation = true;
    actions.shouldUpdateCalendar = true;
    actions.shouldNotifyHost = true;
    actions.shouldNotifyGuest = true;
    actions.shouldUpdateAvailability = true;
    actions.shouldCreateGuestProfile = true;
    actions.shouldTriggerDispatch = true;
    actions.actionDescription =
      'New reservation: full sync, calendar block, notify both parties, create guest profile, dispatch tasks';
    return actions;
  }

  // Reservation confirmed
  if (type.includes('reservation.confirmed') || type.includes('booking.confirmed')) {
    actions.shouldSyncReservation = true;
    actions.shouldUpdateCalendar = true;
    actions.shouldNotifyHost = true;
    actions.shouldUpdateAvailability = true;
    actions.shouldTriggerDispatch = true;
    actions.actionDescription =
      'Reservation confirmed: sync, update calendar, notify host, dispatch prep tasks';
    return actions;
  }

  // Reservation modified / updated
  if (
    type.includes('reservation.modified') ||
    type.includes('reservation.updated') ||
    type.includes('booking.changed')
  ) {
    actions.shouldSyncReservation = true;
    actions.shouldUpdateCalendar = true;
    actions.shouldNotifyHost = true;
    actions.shouldUpdateAvailability = true;
    actions.actionDescription = 'Reservation modified: re-sync, update calendar and availability';
    return actions;
  }

  // Reservation cancelled
  if (
    type.includes('reservation.cancelled') ||
    type.includes('reservation.canceled') ||
    type.includes('booking.cancelled')
  ) {
    actions.shouldSyncReservation = true;
    actions.shouldUpdateCalendar = true;
    actions.shouldNotifyHost = true;
    actions.shouldUpdateAvailability = true;
    actions.shouldTriggerDispatch = true;
    actions.actionDescription =
      'Reservation cancelled: sync status, free calendar dates, notify host, cancel dispatch tasks';
    return actions;
  }

  // Check-in events
  if (type.includes('checkin') || type.includes('check_in')) {
    actions.shouldSyncReservation = true;
    actions.shouldNotifyHost = true;
    actions.actionDescription = 'Guest checked in: update status, notify host';
    return actions;
  }

  // Check-out events
  if (type.includes('checkout') || type.includes('check_out')) {
    actions.shouldSyncReservation = true;
    actions.shouldNotifyHost = true;
    actions.shouldUpdateAvailability = true;
    actions.shouldTriggerDispatch = true;
    actions.actionDescription = 'Guest checked out: update status, free dates, dispatch cleaning';
    return actions;
  }

  // Message events
  if (type.includes('message') || type.includes('inquiry')) {
    actions.shouldNotifyHost = true;
    actions.actionDescription = 'New message or inquiry: notify host';
    if (type.includes('inquiry')) {
      actions.shouldCreateGuestProfile = true;
      actions.actionDescription = 'New inquiry: notify host, create guest profile';
    }
    return actions;
  }

  // Review events
  if (type.includes('review')) {
    actions.shouldNotifyHost = true;
    actions.actionDescription = 'New review: notify host';
    return actions;
  }

  // Payout events
  if (type.includes('payout')) {
    actions.shouldNotifyHost = true;
    actions.actionDescription = 'Payout event: notify host';
    return actions;
  }

  return actions;
}

// ============================================
// HELPERS
// ============================================

/**
 * Check if an event type string corresponds to a reservation event.
 */
function isReservationEvent(eventType: string): boolean {
  const lower = eventType.toLowerCase();
  return (
    lower.includes('reservation') ||
    lower.includes('booking') ||
    lower.includes('checkin') ||
    lower.includes('checkout') ||
    lower.includes('check_in') ||
    lower.includes('check_out') ||
    lower.includes('payout')
  );
}

/**
 * Check if an event type string corresponds to a message event.
 */
function isMessageEvent(eventType: string): boolean {
  const lower = eventType.toLowerCase();
  return lower.includes('message') || lower.includes('inquiry');
}
