/**
 * VRBO iCal parse/generate module — RFC 5545 compliant two-way calendar sync.
 * Used by Next.js cron, FastAPI backend, and VRBO Partner Central subscriptions.
 */

export interface ICalBooking {
  uid: string;
  guestName: string;
  confirmCode: string;
  checkIn: Date;
  checkOut: Date;
  summary: string;
  description: string;
  status: string;
  source?: string;
}

export interface ICalExportBooking {
  id: string;
  checkIn: string | Date;
  checkOut: string | Date;
  guestName: string;
  status?: 'confirmed' | 'pending' | 'cancelled';
  source?: string;
  summary?: string;
}

function findUnquotedColon(line: string): number {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes;
    else if (line[i] === ':' && !inQuotes) return i;
  }
  return -1;
}

export function parseICalDate(value: string): Date {
  const clean = value.replace(/[^0-9TZ]/g, '');
  if (clean.length === 8) {
    return new Date(
      parseInt(clean.slice(0, 4), 10),
      parseInt(clean.slice(4, 6), 10) - 1,
      parseInt(clean.slice(6, 8), 10)
    );
  }
  const digits = clean.replace('T', '').replace('Z', '');
  const y = parseInt(digits.slice(0, 4), 10);
  const mo = parseInt(digits.slice(4, 6), 10) - 1;
  const d = parseInt(digits.slice(6, 8), 10);
  const h = parseInt(digits.slice(8, 10), 10) || 0;
  const mi = parseInt(digits.slice(10, 12), 10) || 0;
  return clean.endsWith('Z')
    ? new Date(Date.UTC(y, mo, d, h, mi))
    : new Date(y, mo, d, h, mi);
}

export function extractGuestName(text: string): string {
  if (!text) return '';
  const patterns = [
    /Reserved\s*[-:]\s*(.+)/i,
    /(?:airbnb|vrbo|booking)\s*\((.+?)\)/i,
    /Guest:\s*(.+)/i,
    /Booked by\s*[-:]\s*(.+)/i,
    /Blocked\s*[-:]\s*(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return '';
}

export function extractConfirmCode(text: string): string {
  if (!text) return '';
  const patterns = [
    /Reservation\s*(?:ID|#|:)\s*([A-Z0-9-]+)/i,
    /Confirmation\s*(?:Code|#|:)\s*([A-Z0-9-]+)/i,
    /Booking\s*(?:ID|#|:)\s*([A-Z0-9-]+)/i,
    /(HA-[A-Z0-9]+)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1] || m[0];
  }
  return '';
}

/**
 * Parse an iCal feed string into booking events.
 */
export function parseICalFeed(icalText: string): ICalBooking[] {
  const bookings: ICalBooking[] = [];
  const lines = icalText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');

  let inEvent = false;
  let current: Partial<ICalBooking> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {
        status: 'CONFIRMED',
        summary: '',
        description: '',
        guestName: '',
        confirmCode: '',
      };
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      inEvent = false;
      if (current.uid && current.checkIn && current.checkOut) {
        bookings.push(current as ICalBooking);
      }
      current = {};
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = findUnquotedColon(trimmed);
    if (colonIdx === -1) continue;
    const nameAndParams = trimmed.slice(0, colonIdx);
    const value = trimmed.slice(colonIdx + 1);
    const name = nameAndParams.split(';')[0].toUpperCase();

    switch (name) {
      case 'UID':
        current.uid = value;
        break;
      case 'SUMMARY':
        current.summary = value;
        current.guestName = current.guestName || extractGuestName(value);
        break;
      case 'DESCRIPTION':
        current.description = value;
        if (!current.guestName) current.guestName = extractGuestName(value);
        if (!current.confirmCode) current.confirmCode = extractConfirmCode(value);
        break;
      case 'DTSTART':
        current.checkIn = parseICalDate(value);
        break;
      case 'DTEND':
        current.checkOut = parseICalDate(value);
        break;
      case 'STATUS':
        current.status = value;
        break;
    }
  }

  return bookings;
}

function formatICalDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatICalTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.substring(0, 75)];
  let remaining = line.substring(75);
  while (remaining.length > 0) {
    parts.push(' ' + remaining.substring(0, 74));
    remaining = remaining.substring(74);
  }
  return parts.join('\r\n');
}

function buildVEvent(booking: ICalExportBooking, propertyId: string): string {
  const now = formatICalTimestamp(new Date());
  const status = booking.status ?? 'confirmed';
  const summary =
    booking.summary ??
    `${status === 'confirmed' ? 'Reserved' : 'Tentative'} - ${escapeICalText(booking.guestName)}`;
  const description = `Booking ${booking.id} via ${booking.source ?? 'rah-midland'}. Guest: ${escapeICalText(booking.guestName)}.`;
  const uid = `${booking.id}@rah-midland.com`;

  const lines = [
    'BEGIN:VEVENT',
    foldLine(`UID:${uid}`),
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${formatICalDate(booking.checkIn)}`,
    `DTEND;VALUE=DATE:${formatICalDate(booking.checkOut)}`,
    foldLine(`SUMMARY:${summary}`),
    foldLine(`DESCRIPTION:${description}`),
    `STATUS:${status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
    'TRANSP:OPAQUE',
    foldLine(`X-RAH-PROPERTY-ID:${propertyId}`),
    foldLine(`X-RAH-BOOKING-SOURCE:${booking.source ?? 'direct'}`),
    foldLine(`X-RAH-BOOKING-ID:${booking.id}`),
    'END:VEVENT',
  ];

  return lines.join('\r\n');
}

/**
 * Generate RFC 5545 iCalendar document for export to VRBO.
 */
export function generateICal(
  propertyId: string,
  propertyName: string,
  bookings: ICalExportBooking[]
): string {
  const now = formatICalTimestamp(new Date());

  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Right at Home BnB//RAH Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:Right at Home BnB - ${escapeICalText(propertyName || propertyId)}`),
    'X-WR-TIMEZONE:America/Chicago',
    `LAST-MODIFIED:${now}`,
  ].join('\r\n');

  const events = bookings
    .filter((b) => b.status !== 'cancelled')
    .map((b) => buildVEvent(b, propertyId))
    .join('\r\n');

  const parts = [header];
  if (events.length > 0) parts.push(events);
  parts.push('END:VCALENDAR');

  return parts.join('\r\n') + '\r\n';
}

/**
 * Fetch and parse a remote iCal URL.
 */
export async function fetchAndParseICal(
  icalUrl: string,
  options?: { timeoutMs?: number; userAgent?: string }
): Promise<ICalBooking[]> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const response = await fetch(icalUrl, {
    headers: {
      'User-Agent': options?.userAgent ?? 'RightAtHomeBnB/1.0 Calendar-Sync',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`iCal fetch failed: ${response.status} ${response.statusText}`);
  }

  const icalText = await response.text();
  if (!icalText.includes('BEGIN:VCALENDAR')) {
    throw new Error('Invalid iCal response');
  }

  return parseICalFeed(icalText);
}