/**
 * Right at Home BnB - Channel Manager
 * Multi-platform calendar sync via iCal import/export. Handles VRBO, Airbnb,
 * and Booking.com feeds with conflict detection and bidirectional sync.
 * Implements RFC 5545 iCal parsing and generation.
 */

// ============================================
// TYPES
// ============================================

export interface ChannelConfig {
  channelName: string;
  propertyId: string;
  importUrl: string;
  exportEnabled: boolean;
}

export interface CalendarEvent {
  uid: string;
  summary: string;
  description: string;
  dtStart: Date;
  dtEnd: Date;
  status: string;
  source: string;
  propertyId: string;
  reservationId: string;
  guestName: string;
  created: Date;
  lastModified: Date;
}

export interface ChannelSyncResult {
  channelName: string;
  propertyId: string;
  imported: number;
  conflicts: ConflictDetail[];
  errors: string[];
  syncedAt: string;
}

export interface ConflictDetail {
  existingEvent: CalendarEvent;
  conflictingEvent: CalendarEvent;
  overlapStart: string;
  overlapEnd: string;
}

export interface FullSyncResult {
  channels: ChannelSyncResult[];
  totalImported: number;
  totalConflicts: number;
  totalErrors: number;
  syncedAt: string;
}

// ============================================
// CONFIGURATION
// ============================================

/**
 * Load channel configurations from environment variables.
 * Each channel is defined as ICAL_CHANNELS=JSON array of ChannelConfig objects.
 * Falls back to individual VRBO_ICAL_URL, AIRBNB_ICAL_URL, BOOKING_ICAL_URL env vars.
 */
function getChannelConfigs(): ChannelConfig[] {
  const channelsRaw = process.env.ICAL_CHANNELS;
  if (channelsRaw) {
    try {
      return JSON.parse(channelsRaw) as ChannelConfig[];
    } catch {
      console.error('[channel-manager] Failed to parse ICAL_CHANNELS JSON');
    }
  }

  const configs: ChannelConfig[] = [];
  const propertyIds = getPropertyIds();

  for (const propertyId of propertyIds) {
    const vrboUrl = process.env['VRBO_ICAL_URL_' + propertyId] || process.env.VRBO_ICAL_URL;
    if (vrboUrl) {
      configs.push({ channelName: 'vrbo', propertyId, importUrl: vrboUrl, exportEnabled: true });
    }

    const airbnbUrl = process.env['AIRBNB_ICAL_URL_' + propertyId] || process.env.AIRBNB_ICAL_URL;
    if (airbnbUrl) {
      configs.push({ channelName: 'airbnb', propertyId, importUrl: airbnbUrl, exportEnabled: true });
    }

    const bookingUrl = process.env['BOOKING_ICAL_URL_' + propertyId] || process.env.BOOKING_ICAL_URL;
    if (bookingUrl) {
      configs.push({ channelName: 'booking', propertyId, importUrl: bookingUrl, exportEnabled: true });
    }
  }

  return configs;
}

/**
 * Get all property IDs from the VRBO_PROPERTY_MAP or PROPERTY_IDS env var.
 */
function getPropertyIds(): string[] {
  const propertyMapRaw = process.env.VRBO_PROPERTY_MAP;
  if (propertyMapRaw) {
    try {
      return Object.keys(JSON.parse(propertyMapRaw));
    } catch {
      // fall through
    }
  }
  const idsRaw = process.env.PROPERTY_IDS;
  if (idsRaw) {
    return idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// ============================================
// iCAL PARSER (RFC 5545)
// ============================================

/**
 * Parse an iCal (RFC 5545) string into an array of CalendarEvent objects.
 */
function parseICalFeed(icalText: string, source: string, propertyId: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = unfoldICalLines(icalText);
  let inEvent = false;
  let currentEvent: Partial<CalendarEvent> = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        source, propertyId,
        status: 'CONFIRMED', description: '', guestName: '', reservationId: '',
      };
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      if (currentEvent.uid && currentEvent.dtStart && currentEvent.dtEnd) {
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = {};
      continue;
    }
    if (!inEvent) continue;

    const { name, params, value } = parseICalProperty(line);
    switch (name) {
      case 'UID': currentEvent.uid = value; break;
      case 'SUMMARY':
        currentEvent.summary = value;
        currentEvent.guestName = extractGuestName(value);
        break;
      case 'DESCRIPTION':
        currentEvent.description = value;
        if (!currentEvent.guestName) currentEvent.guestName = extractGuestName(value);
        if (!currentEvent.reservationId) currentEvent.reservationId = extractReservationId(value);
        break;
      case 'DTSTART': currentEvent.dtStart = parseICalDate(value, params); break;
      case 'DTEND': currentEvent.dtEnd = parseICalDate(value, params); break;
      case 'STATUS': currentEvent.status = value; break;
      case 'CREATED': currentEvent.created = parseICalDate(value, params); break;
      case 'LAST-MODIFIED': currentEvent.lastModified = parseICalDate(value, params); break;
    }
  }

  const now = new Date();
  for (const event of events) {
    if (!event.created) event.created = now;
    if (!event.lastModified) event.lastModified = now;
    if (!event.summary) event.summary = 'Blocked';
  }
  return events;
}

/**
 * Unfold iCal lines per RFC 5545 section 3.1.
 */
function unfoldICalLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const unfolded = normalized.replace(/\n[ \t]/g, '');
  return unfolded.split('\n').map((l) => l.trim()).filter(Boolean);
}

/**
 * Parse a single iCal property line into name, parameters, and value.
 */
function parseICalProperty(line: string): { name: string; params: Record<string, string>; value: string } {
  let colonIndex = -1;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes;
    else if (line[i] === ':' && !inQuotes) { colonIndex = i; break; }
  }
  if (colonIndex === -1) return { name: line, params: {}, value: '' };

  const nameAndParams = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const params: Record<string, string> = {};
  const semicolonIndex = nameAndParams.indexOf(';');
  let name: string;
  if (semicolonIndex === -1) {
    name = nameAndParams;
  } else {
    name = nameAndParams.slice(0, semicolonIndex);
    const paramStr = nameAndParams.slice(semicolonIndex + 1);
    for (const part of paramStr.split(';')) {
      const eqIndex = part.indexOf('=');
      if (eqIndex !== -1) params[part.slice(0, eqIndex).toUpperCase()] = part.slice(eqIndex + 1);
    }
  }
  return { name: name.toUpperCase(), params, value };
}

/**
 * Parse an iCal date/date-time value into a JavaScript Date.
 */
function parseICalDate(value: string, params: Record<string, string>): Date {
  const clean = value.replace(/[^0-9TZ]/g, '');
  if (clean.length === 8 || params.VALUE === 'DATE') {
    const year = parseInt(clean.slice(0, 4), 10);
    const month = parseInt(clean.slice(4, 6), 10) - 1;
    const day = parseInt(clean.slice(6, 8), 10);
    return new Date(year, month, day);
  }
  const isUtc = clean.endsWith('Z');
  const digits = clean.replace('T', '').replace('Z', '');
  const year = parseInt(digits.slice(0, 4), 10);
  const month = parseInt(digits.slice(4, 6), 10) - 1;
  const day = parseInt(digits.slice(6, 8), 10);
  const hour = parseInt(digits.slice(8, 10), 10) || 0;
  const minute = parseInt(digits.slice(10, 12), 10) || 0;
  const second = parseInt(digits.slice(12, 14), 10) || 0;
  if (isUtc || params.TZID === undefined) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  return new Date(year, month, day, hour, minute, second);
}

/**
 * Extract guest name from iCal SUMMARY or DESCRIPTION fields.
 */
function extractGuestName(text: string): string {
  if (!text) return '';
  const reservedMatch = text.match(/Reserved\s*[-:]\s*(.+)/i);
  if (reservedMatch) return reservedMatch[1].trim();
  const parenMatch = text.match(/(?:airbnb|vrbo|booking)\s*\((.+?)\)/i);
  if (parenMatch) return parenMatch[1].trim();
  const guestMatch = text.match(/Guest:\s*(.+)/i);
  if (guestMatch) return guestMatch[1].trim();
  const words = text.trim().split(/\s+/);
  if (words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Z]/.test(w))) {
    return text.trim();
  }
  return '';
}

/**
 * Extract a reservation ID from iCal DESCRIPTION text.
 */
function extractReservationId(text: string): string {
  if (!text) return '';
  const patterns = [
    /Reservation\s*(?:ID|#|:)\s*([A-Z0-9-]+)/i,
    /Confirmation\s*(?:Code|#|:)\s*([A-Z0-9-]+)/i,
    /Booking\s*(?:ID|#|:)\s*([A-Z0-9-]+)/i,
    /(?:HA|HM|HMXXX)[A-Z0-9-]{6,}/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1] || match[0];
  }
  return '';
}

// ============================================
// iCAL GENERATOR (RFC 5545)
// ============================================

function formatICalDate(date: Date): string {
  const y = date.getFullYear().toString().padStart(4, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return y + m + d;
}

function formatICalDateTime(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const mo = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  const h = date.getUTCHours().toString().padStart(2, '0');
  const mi = date.getUTCMinutes().toString().padStart(2, '0');
  const s = date.getUTCSeconds().toString().padStart(2, '0');
  return y + mo + d + 'T' + h + mi + s + 'Z';
}

function foldICalLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  parts.push(line.slice(0, 75));
  let remaining = line.slice(75);
  while (remaining.length > 0) {
    parts.push(' ' + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }
  return parts.join('\r\n');
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function generateICalString(events: CalendarEvent[], propertyId: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Right at Home BnB//Channel Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Right at Home BnB - ' + propertyId,
    'X-WR-TIMEZONE:America/Chicago',
  ];
  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(foldICalLine('UID:' + event.uid));
    lines.push('DTSTART;VALUE=DATE:' + formatICalDate(event.dtStart));
    lines.push('DTEND;VALUE=DATE:' + formatICalDate(event.dtEnd));
    lines.push(foldICalLine('SUMMARY:' + escapeICalText(event.summary || 'Blocked')));
    if (event.description) {
      lines.push(foldICalLine('DESCRIPTION:' + escapeICalText(event.description)));
    }
    lines.push('STATUS:' + (event.status || 'CONFIRMED'));
    lines.push('TRANSP:OPAQUE');
    lines.push('DTSTAMP:' + formatICalDateTime(new Date()));
    if (event.created) lines.push('CREATED:' + formatICalDateTime(event.created));
    if (event.lastModified) lines.push('LAST-MODIFIED:' + formatICalDateTime(event.lastModified));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ============================================
// CONFLICT DETECTION
// ============================================

function detectConflicts(events: CalendarEvent[]): ConflictDetail[] {
  const conflicts: ConflictDetail[] = [];
  const active = events.filter(
    (e) => e.status !== 'CANCELLED' && e.status !== 'TENTATIVE'
  );
  const sorted = [...active].sort((a, b) => a.dtStart.getTime() - b.dtStart.getTime());

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (b.dtStart.getTime() >= a.dtEnd.getTime()) break;
      const overlapStart = new Date(Math.max(a.dtStart.getTime(), b.dtStart.getTime()));
      const overlapEnd = new Date(Math.min(a.dtEnd.getTime(), b.dtEnd.getTime()));
      conflicts.push({
        existingEvent: a,
        conflictingEvent: b,
        overlapStart: overlapStart.toISOString().slice(0, 10),
        overlapEnd: overlapEnd.toISOString().slice(0, 10),
      });
    }
  }
  return conflicts;
}

// ============================================
// iCAL FEED FETCHER
// ============================================

async function fetchICalFeed(
  url: string, source: string, propertyId: string, timeoutMs: number = 30000
): Promise<{ events: CalendarEvent[]; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/calendar, text/plain, */*',
        'User-Agent': 'RightAtHomeBnB-ChannelManager/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      return {
        events: [],
        error: 'HTTP ' + response.status + ' fetching ' + source + ' iCal feed',
      };
    }
    const contentType = response.headers.get('Content-Type') || '';
    const icalText = await response.text();
    if (!icalText.includes('BEGIN:VCALENDAR') && !contentType.includes('text/calendar')) {
      return {
        events: [],
        error: source + ' feed did not return valid iCal data',
      };
    }
    const events = parseICalFeed(icalText, source, propertyId);
    return { events, error: null };
  } catch (error: unknown) {
    clearTimeout(timer);
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { events: [], error: source + ' iCal feed timed out after ' + timeoutMs + 'ms' };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { events: [], error: source + ' iCal fetch error: ' + message };
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Sync all channels (VRBO, Airbnb, Booking.com) for a single property.
 */
export async function syncAllChannels(propertyId: string): Promise<ChannelSyncResult[]> {
  const configs = getChannelConfigs().filter((c) => c.propertyId === propertyId);
  const results: ChannelSyncResult[] = [];
  if (configs.length === 0) {
    results.push({
      channelName: 'none', propertyId, imported: 0, conflicts: [],
      errors: ['No channels configured for property ' + propertyId],
      syncedAt: new Date().toISOString(),
    });
    return results;
  }
  const allEvents: CalendarEvent[] = [];
  for (const config of configs) {
    const result: ChannelSyncResult = {
      channelName: config.channelName, propertyId: config.propertyId,
      imported: 0, conflicts: [], errors: [], syncedAt: new Date().toISOString(),
    };
    if (!config.importUrl) {
      result.errors.push('No import URL configured for ' + config.channelName);
      results.push(result);
      continue;
    }
    const { events, error } = await fetchICalFeed(
      config.importUrl, config.channelName, config.propertyId
    );
    if (error) result.errors.push(error);
    result.imported = events.length;
    allEvents.push(...events);
    results.push(result);
  }
  if (allEvents.length > 0) {
    const conflicts = detectConflicts(allEvents);
    for (const conflict of conflicts) {
      const sourceChannel = conflict.conflictingEvent.source;
      const channelResult = results.find((r) => r.channelName === sourceChannel);
      if (channelResult) channelResult.conflicts.push(conflict);
      else if (results.length > 0) results[0].conflicts.push(conflict);
    }
  }
  return results;
}

/**
 * Sync all properties across all configured channels.
 */
export async function syncEverything(): Promise<FullSyncResult> {
  const configs = getChannelConfigs();
  const propertyIds = [...new Set(configs.map((c) => c.propertyId))];
  const allChannelResults: ChannelSyncResult[] = [];
  if (propertyIds.length === 0) {
    const envPropertyIds = getPropertyIds();
    if (envPropertyIds.length === 0) {
      return { channels: [], totalImported: 0, totalConflicts: 0, totalErrors: 1, syncedAt: new Date().toISOString() };
    }
    propertyIds.push(...envPropertyIds);
  }
  for (const propertyId of propertyIds) {
    const channelResults = await syncAllChannels(propertyId);
    allChannelResults.push(...channelResults);
  }
  return {
    channels: allChannelResults,
    totalImported: allChannelResults.reduce((sum, r) => sum + r.imported, 0),
    totalConflicts: allChannelResults.reduce((sum, r) => sum + r.conflicts.length, 0),
    totalErrors: allChannelResults.reduce((sum, r) => sum + r.errors.length, 0),
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Generate an iCal calendar string for a property, suitable for export.
 * Enables bidirectional sync: other platforms import this feed to see our bookings.
 */
export async function exportCalendar(
  propertyId: string,
  additionalEvents?: CalendarEvent[]
): Promise<string> {
  const configs = getChannelConfigs().filter((c) => c.propertyId === propertyId);
  const allEvents: CalendarEvent[] = [];
  for (const config of configs) {
    if (!config.importUrl) continue;
    const { events } = await fetchICalFeed(config.importUrl, config.channelName, config.propertyId);
    allEvents.push(...events);
  }
  if (additionalEvents) allEvents.push(...additionalEvents);

  // Deduplicate by UID
  const seen = new Set<string>();
  const deduped: CalendarEvent[] = [];
  for (const event of allEvents) {
    if (!seen.has(event.uid)) {
      seen.add(event.uid);
      deduped.push(event);
    }
  }
  deduped.sort((a, b) => a.dtStart.getTime() - b.dtStart.getTime());
  return generateICalString(deduped, propertyId);
}
