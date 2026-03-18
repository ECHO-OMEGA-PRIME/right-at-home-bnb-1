/**
 * Right at Home BnB - Calendar Sync System
 * iCal import/export for Airbnb, VRBO, and other platforms
 * @author ECHO OMEGA PRIME
 */

import { BookingPlatform, CalendarEvent, PLATFORM_COLORS } from './api/bookings';
import { properties } from './property-knowledge';

// ============================================================================
// TYPES
// ============================================================================

export interface ICalEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: Date;
  dtend: Date;
  location?: string;
  created?: Date;
  lastModified?: Date;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  organizer?: string;
  // Airbnb-specific fields
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  confirmationCode?: string;
  numberOfGuests?: number;
}

export interface CalendarFeedConfig {
  id: string;
  propertyId: string;
  platform: BookingPlatform;
  url: string;
  enabled: boolean;
  lastSync?: Date;
  lastStatus?: 'success' | 'error' | 'pending';
  lastError?: string;
  syncIntervalMinutes: number;
}

export interface SyncResult {
  propertyId: string;
  platform: BookingPlatform;
  feedUrl: string;
  success: boolean;
  eventsFound: number;
  eventsNew: number;
  eventsUpdated: number;
  eventsRemoved: number;
  errors: string[];
  syncDuration: number;
  syncedAt: Date;
}

export interface MergedCalendar {
  propertyId: string;
  propertyName: string;
  events: CalendarEvent[];
  sources: BookingPlatform[];
  conflicts: CalendarConflict[];
  lastUpdated: Date;
}

export interface CalendarConflict {
  event1: CalendarEvent;
  event2: CalendarEvent;
  overlapStart: Date;
  overlapEnd: Date;
  overlapDays: number;
}

// ============================================================================
// ICAL PARSER
// ============================================================================

/**
 * Parse iCal content from a URL response
 */
export function parseICalContent(icalContent: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = icalContent.split(/\r?\n/);

  let currentEvent: Partial<ICalEvent> | null = null;
  let currentKey = '';
  let currentValue = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle line folding (lines starting with space/tab are continuations)
    while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1])) {
      i++;
      line += lines[i].substring(1);
    }

    // Remove any remaining line breaks
    line = line.trim();

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
      continue;
    }

    if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.uid && currentEvent.dtstart && currentEvent.dtend) {
        events.push(currentEvent as ICalEvent);
      }
      currentEvent = null;
      continue;
    }

    if (!currentEvent) continue;

    // Parse property
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const propertyPart = line.substring(0, colonIndex);
    const valuePart = line.substring(colonIndex + 1);

    // Handle property parameters (e.g., DTSTART;VALUE=DATE:20260115)
    const [propertyName] = propertyPart.split(';');

    switch (propertyName.toUpperCase()) {
      case 'UID':
        currentEvent.uid = valuePart;
        break;

      case 'SUMMARY':
        currentEvent.summary = decodeICalText(valuePart);
        // Try to extract guest name from summary (Airbnb format: "Reserved - Guest Name")
        if (valuePart.includes(' - ')) {
          const parts = valuePart.split(' - ');
          if (parts.length >= 2) {
            currentEvent.guestName = decodeICalText(parts.slice(1).join(' - '));
          }
        }
        break;

      case 'DESCRIPTION':
        currentEvent.description = decodeICalText(valuePart);
        // Parse Airbnb description for details
        parseAirbnbDescription(currentEvent, valuePart);
        break;

      case 'DTSTART':
        currentEvent.dtstart = parseICalDate(valuePart, propertyPart);
        break;

      case 'DTEND':
        currentEvent.dtend = parseICalDate(valuePart, propertyPart);
        break;

      case 'LOCATION':
        currentEvent.location = decodeICalText(valuePart);
        break;

      case 'CREATED':
        currentEvent.created = parseICalDate(valuePart, propertyPart);
        break;

      case 'LAST-MODIFIED':
        currentEvent.lastModified = parseICalDate(valuePart, propertyPart);
        break;

      case 'STATUS':
        currentEvent.status = valuePart.toUpperCase() as ICalEvent['status'];
        break;

      case 'ORGANIZER':
        currentEvent.organizer = valuePart;
        break;
    }
  }

  return events;
}

/**
 * Parse Airbnb description for guest details
 */
function parseAirbnbDescription(event: Partial<ICalEvent>, description: string): void {
  const decoded = decodeICalText(description);

  // Try to extract phone number
  const phoneMatch = decoded.match(/(?:Phone|Tel|Mobile|Cell)[:\s]*([+\d\s()-]+)/i);
  if (phoneMatch) {
    event.guestPhone = phoneMatch[1].trim();
  }

  // Try to extract email
  const emailMatch = decoded.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    event.guestEmail = emailMatch[1];
  }

  // Try to extract confirmation code (Airbnb format)
  const confirmMatch = decoded.match(/(?:Confirmation|Reservation|Code)[:\s#]*([A-Z0-9]+)/i);
  if (confirmMatch) {
    event.confirmationCode = confirmMatch[1];
  }

  // Try to extract number of guests
  const guestMatch = decoded.match(/(\d+)\s*(?:guest|person|adult)/i);
  if (guestMatch) {
    event.numberOfGuests = parseInt(guestMatch[1], 10);
  }
}

/**
 * Parse iCal date string to Date object
 */
function parseICalDate(value: string, propertyPart: string): Date {
  // Check if it's a date-only value (no time)
  const isDateOnly = propertyPart.includes('VALUE=DATE') || value.length === 8;

  if (isDateOnly) {
    // Format: YYYYMMDD
    const year = parseInt(value.substring(0, 4), 10);
    const month = parseInt(value.substring(4, 6), 10) - 1;
    const day = parseInt(value.substring(6, 8), 10);
    return new Date(year, month, day);
  }

  // Format: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  const year = parseInt(value.substring(0, 4), 10);
  const month = parseInt(value.substring(4, 6), 10) - 1;
  const day = parseInt(value.substring(6, 8), 10);

  if (value.length >= 15) {
    const hour = parseInt(value.substring(9, 11), 10);
    const minute = parseInt(value.substring(11, 13), 10);
    const second = parseInt(value.substring(13, 15), 10);

    if (value.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
  }

  return new Date(year, month, day);
}

/**
 * Decode iCal escaped text
 */
function decodeICalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// ============================================================================
// ICAL FETCH & IMPORT
// ============================================================================

/**
 * Fetch and parse iCal feed from URL
 */
export async function fetchICalFeed(url: string): Promise<{ events: ICalEvent[]; error?: string }> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/calendar',
        'User-Agent': 'RightAtHomeBnB/1.0',
      },
      // Add timeout
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return {
        events: [],
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const content = await response.text();

    // Validate it's iCal content
    if (!content.includes('BEGIN:VCALENDAR')) {
      return {
        events: [],
        error: 'Invalid iCal format: Missing VCALENDAR',
      };
    }

    const events = parseICalContent(content);
    return { events };
  } catch (error: any) {
    return {
      events: [],
      error: error.message || 'Failed to fetch iCal feed',
    };
  }
}

/**
 * Import Airbnb iCal feed and convert to CalendarEvents
 */
export async function importAirbnbCalendar(
  feedUrl: string,
  propertyId: string
): Promise<{ events: CalendarEvent[]; rawEvents: ICalEvent[]; error?: string }> {
  const result = await fetchICalFeed(feedUrl);

  if (result.error) {
    return { events: [], rawEvents: [], error: result.error };
  }

  const calendarEvents: CalendarEvent[] = result.events.map((icalEvent) => ({
    id: icalEvent.uid,
    title: icalEvent.summary || 'Blocked',
    start: icalEvent.dtstart.toISOString(),
    end: icalEvent.dtend.toISOString(),
    platform: 'airbnb' as BookingPlatform,
    guestName: icalEvent.guestName || null,
    guestCount: icalEvent.numberOfGuests || 1,
    confirmationCode: icalEvent.confirmationCode || null,
    totalPrice: null,
    color: PLATFORM_COLORS.airbnb,
  }));

  return {
    events: calendarEvents,
    rawEvents: result.events,
  };
}

/**
 * Import VRBO iCal feed and convert to CalendarEvents
 */
export async function importVRBOCalendar(
  feedUrl: string,
  propertyId: string
): Promise<{ events: CalendarEvent[]; rawEvents: ICalEvent[]; error?: string }> {
  const result = await fetchICalFeed(feedUrl);

  if (result.error) {
    return { events: [], rawEvents: [], error: result.error };
  }

  const calendarEvents: CalendarEvent[] = result.events.map((icalEvent) => ({
    id: icalEvent.uid,
    title: icalEvent.summary || 'Blocked',
    start: icalEvent.dtstart.toISOString(),
    end: icalEvent.dtend.toISOString(),
    platform: 'vrbo' as BookingPlatform,
    guestName: icalEvent.guestName || null,
    guestCount: icalEvent.numberOfGuests || 1,
    confirmationCode: icalEvent.confirmationCode || null,
    totalPrice: null,
    color: PLATFORM_COLORS.vrbo,
  }));

  return {
    events: calendarEvents,
    rawEvents: result.events,
  };
}

// ============================================================================
// CALENDAR MERGING
// ============================================================================

/**
 * Merge calendars from multiple platforms
 */
export function mergeCalendars(
  airbnbEvents: CalendarEvent[],
  vrboEvents: CalendarEvent[],
  directEvents: CalendarEvent[] = [],
  otherEvents: CalendarEvent[] = []
): CalendarEvent[] {
  const allEvents = [
    ...airbnbEvents,
    ...vrboEvents,
    ...directEvents,
    ...otherEvents,
  ];

  // Sort by start date
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return allEvents;
}

/**
 * Detect booking conflicts (overlapping reservations)
 */
export function detectConflicts(events: CalendarEvent[]): CalendarConflict[] {
  const conflicts: CalendarConflict[] = [];

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const event1 = events[i];
      const event2 = events[j];

      const start1 = new Date(event1.start);
      const end1 = new Date(event1.end);
      const start2 = new Date(event2.start);
      const end2 = new Date(event2.end);

      // Check for overlap
      if (start1 < end2 && start2 < end1) {
        const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
        const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
        const overlapDays = Math.ceil(
          (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)
        );

        conflicts.push({
          event1,
          event2,
          overlapStart,
          overlapEnd,
          overlapDays,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Full sync for a property - import all configured feeds and merge
 */
export async function syncPropertyCalendar(
  propertyId: string,
  feeds: CalendarFeedConfig[]
): Promise<MergedCalendar> {
  const property = properties.find((p) => p.id === propertyId);
  const allEvents: CalendarEvent[] = [];
  const sources: BookingPlatform[] = [];

  for (const feed of feeds) {
    if (!feed.enabled) continue;

    let result: { events: CalendarEvent[]; error?: string };

    switch (feed.platform) {
      case 'airbnb':
        result = await importAirbnbCalendar(feed.url, propertyId);
        break;
      case 'vrbo':
        result = await importVRBOCalendar(feed.url, propertyId);
        break;
      default:
        result = await fetchAndConvertGenericCalendar(feed.url, feed.platform, propertyId);
    }

    if (!result.error && result.events.length > 0) {
      allEvents.push(...result.events);
      if (!sources.includes(feed.platform)) {
        sources.push(feed.platform);
      }
    }
  }

  // Sort and detect conflicts
  const mergedEvents = mergeCalendars(
    allEvents.filter((e) => e.platform === 'airbnb'),
    allEvents.filter((e) => e.platform === 'vrbo'),
    allEvents.filter((e) => e.platform === 'direct'),
    allEvents.filter((e) => !['airbnb', 'vrbo', 'direct'].includes(e.platform))
  );

  const conflicts = detectConflicts(mergedEvents);

  return {
    propertyId,
    propertyName: property?.name || propertyId,
    events: mergedEvents,
    sources,
    conflicts,
    lastUpdated: new Date(),
  };
}

/**
 * Fetch and convert generic iCal feed
 */
async function fetchAndConvertGenericCalendar(
  feedUrl: string,
  platform: BookingPlatform,
  propertyId: string
): Promise<{ events: CalendarEvent[]; error?: string }> {
  const result = await fetchICalFeed(feedUrl);

  if (result.error) {
    return { events: [], error: result.error };
  }

  const calendarEvents: CalendarEvent[] = result.events.map((icalEvent) => ({
    id: icalEvent.uid,
    title: icalEvent.summary || 'Blocked',
    start: icalEvent.dtstart.toISOString(),
    end: icalEvent.dtend.toISOString(),
    platform,
    guestName: icalEvent.guestName || null,
    guestCount: icalEvent.numberOfGuests || 1,
    confirmationCode: icalEvent.confirmationCode || null,
    totalPrice: null,
    color: PLATFORM_COLORS[platform] || '#8B5CF6',
  }));

  return { events: calendarEvents };
}

// ============================================================================
// ICAL EXPORT
// ============================================================================

/**
 * Generate iCal content for export (to share with other platforms)
 */
export function generateICalExport(
  events: CalendarEvent[],
  propertyId: string,
  propertyName: string
): string {
  const now = new Date();
  const timestamp = formatICalDate(now, true);

  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Right at Home BnB//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(propertyName)}`,
    `X-WR-CALDESC:Availability calendar for ${escapeICalText(propertyName)}`,
  ];

  for (const event of events) {
    const eventLines = [
      'BEGIN:VEVENT',
      `UID:${event.id}@rah-midland.com`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${formatICalDate(new Date(event.start))}`,
      `DTEND;VALUE=DATE:${formatICalDate(new Date(event.end))}`,
      `SUMMARY:${escapeICalText(event.title)}`,
      `STATUS:CONFIRMED`,
    ];

    if (event.guestName) {
      eventLines.push(`DESCRIPTION:${escapeICalText(`Guest: ${event.guestName}`)}`);
    }

    eventLines.push('END:VEVENT');
    ical = ical.concat(eventLines);
  }

  ical.push('END:VCALENDAR');

  return ical.join('\r\n');
}

/**
 * Format date for iCal
 */
function formatICalDate(date: Date, includeTime = false): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  if (!includeTime) {
    return `${year}${month}${day}`;
  }

  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape text for iCal format
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate iCal feed URL
 */
export function validateICalUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Check protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS' };
    }

    // Check for common iCal patterns
    const isLikelyIcal =
      url.includes('.ics') ||
      url.includes('ical') ||
      url.includes('calendar') ||
      url.includes('airbnb') ||
      url.includes('vrbo') ||
      url.includes('booking.com');

    if (!isLikelyIcal) {
      return { valid: true }; // Still valid, just not obviously an iCal
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Detect platform from iCal URL
 */
export function detectPlatformFromUrl(url: string): BookingPlatform {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('airbnb')) return 'airbnb';
  if (lowerUrl.includes('vrbo') || lowerUrl.includes('homeaway')) return 'vrbo';
  if (lowerUrl.includes('booking.com')) return 'booking';

  return 'other';
}

/**
 * Get instructions for finding iCal URL by platform
 */
export function getICalInstructions(platform: BookingPlatform): string {
  const instructions: Record<BookingPlatform, string> = {
    airbnb: `
**Airbnb iCal Export:**
1. Log in to your Airbnb host account
2. Go to Calendar for your listing
3. Click "Availability settings" (gear icon)
4. Scroll to "Sync calendars"
5. Click "Export Calendar"
6. Copy the iCal link provided
    `.trim(),
    vrbo: `
**VRBO/HomeAway iCal Export:**
1. Log in to your VRBO owner dashboard
2. Go to Calendar
3. Click "Import/Export"
4. Under "Export Calendar", click "Get link"
5. Copy the iCal URL provided
    `.trim(),
    booking: `
**Booking.com iCal Export:**
1. Log in to your Booking.com partner extranet
2. Go to Rates & Availability
3. Click "Calendar Sync"
4. Copy your property's iCal link
    `.trim(),
    direct: 'Enter your custom iCal URL',
    other: 'Enter the iCal feed URL from your booking platform',
  };

  return instructions[platform];
}

// ============================================================================
// EXPORTS
// ============================================================================

export const CalendarSync = {
  // Parsing
  parseICalContent,
  fetchICalFeed,

  // Import
  importAirbnb: importAirbnbCalendar,
  importVRBO: importVRBOCalendar,

  // Merging
  merge: mergeCalendars,
  detectConflicts,
  syncProperty: syncPropertyCalendar,

  // Export
  generateExport: generateICalExport,

  // Utilities
  validateUrl: validateICalUrl,
  detectPlatform: detectPlatformFromUrl,
  getInstructions: getICalInstructions,
};

export default CalendarSync;
