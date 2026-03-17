import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// iCal Export Endpoint
// ---------------------------------------------------------------------------
// Generates RFC 5545 compliant iCal (.ics) feeds for property calendars.
// Used by external platforms (Airbnb, VRBO, Google Calendar) to sync
// availability via iCal subscription URLs.
//
// Usage:
//   https://rah-midland.com/api/integrations/ical?propertyId=PROP_ID&key=SECRET
// ---------------------------------------------------------------------------

interface Booking {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: string;   // ISO 8601 date string
  checkOut: string;   // ISO 8601 date string
  status: 'confirmed' | 'pending' | 'cancelled';
  source: string;
  summary?: string;
}

/**
 * Fetch bookings for a property. In production this queries the database;
 * for development / demo purposes it returns mock data.
 */
function getBookingsForProperty(propertyId: string): Booking[] {
  // -----------------------------------------------------------------------
  // Mock bookings for development -- replace with a real DB query in prod.
  // -----------------------------------------------------------------------
  const mockBookings: Record<string, Booking[]> = {
    prop_midland_main: [
      {
        id: 'bk_001',
        propertyId: 'prop_midland_main',
        guestName: 'John Smith',
        checkIn: '2026-04-10',
        checkOut: '2026-04-14',
        status: 'confirmed',
        source: 'vrbo',
      },
      {
        id: 'bk_002',
        propertyId: 'prop_midland_main',
        guestName: 'Sarah Johnson',
        checkIn: '2026-04-20',
        checkOut: '2026-04-25',
        status: 'confirmed',
        source: 'direct',
      },
      {
        id: 'bk_003',
        propertyId: 'prop_midland_main',
        guestName: 'Mike Davis',
        checkIn: '2026-05-01',
        checkOut: '2026-05-05',
        status: 'pending',
        source: 'airbnb',
      },
    ],
    prop_midland_guest: [
      {
        id: 'bk_004',
        propertyId: 'prop_midland_guest',
        guestName: 'Emily Chen',
        checkIn: '2026-04-15',
        checkOut: '2026-04-18',
        status: 'confirmed',
        source: 'vrbo',
      },
    ],
  };

  return mockBookings[propertyId] ?? [];
}

/**
 * Format a date string (YYYY-MM-DD or ISO 8601) into an iCal DATE value
 * (YYYYMMDD). iCal DATE values represent all-day events.
 */
function formatICalDate(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Format a Date object into an iCal DATETIME stamp (YYYYMMDDTHHMMSSZ).
 */
function formatICalTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape special characters in iCal text values per RFC 5545 Section 3.3.11.
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Fold long lines at 75 octets per RFC 5545 Section 3.1.
 * Continuation lines begin with a single space character.
 */
function foldLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }
  const parts: string[] = [];
  parts.push(line.substring(0, 75));
  let remaining = line.substring(75);
  while (remaining.length > 0) {
    // Continuation lines: space + up to 74 chars = 75 total
    parts.push(' ' + remaining.substring(0, 74));
    remaining = remaining.substring(74);
  }
  return parts.join('\r\n');
}

/**
 * Build a VEVENT block for a single booking.
 */
function buildVEvent(booking: Booking, propertyId: string): string {
  const now = formatICalTimestamp(new Date());
  const summary =
    booking.summary ??
    `${booking.status === 'confirmed' ? 'Reserved' : 'Tentative'} - ${escapeICalText(booking.guestName)}`;
  const description = `Booking ${booking.id} via ${booking.source}. Guest: ${escapeICalText(booking.guestName)}.`;
  const uid = `${booking.id}@rah-midland.com`;

  const lines = [
    'BEGIN:VEVENT',
    foldLine(`UID:${uid}`),
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${formatICalDate(booking.checkIn)}`,
    `DTEND;VALUE=DATE:${formatICalDate(booking.checkOut)}`,
    foldLine(`SUMMARY:${summary}`),
    foldLine(`DESCRIPTION:${description}`),
    `STATUS:${booking.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
    `TRANSP:OPAQUE`,
    foldLine(`X-RAH-PROPERTY-ID:${propertyId}`),
    foldLine(`X-RAH-BOOKING-SOURCE:${booking.source}`),
    foldLine(`X-RAH-BOOKING-ID:${booking.id}`),
    'END:VEVENT',
  ];

  return lines.join('\r\n');
}

/**
 * Generate a complete RFC 5545 iCalendar document for a property.
 */
function generateICal(propertyId: string, bookings: Booking[]): string {
  const now = formatICalTimestamp(new Date());

  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Right at Home BnB//RAH Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:Right at Home BnB - ${escapeICalText(propertyId)}`),
    'X-WR-TIMEZONE:America/Chicago',
    `LAST-MODIFIED:${now}`,
  ].join('\r\n');

  const events = bookings
    .filter((b) => b.status !== 'cancelled')
    .map((b) => buildVEvent(b, propertyId))
    .join('\r\n');

  const footer = 'END:VCALENDAR';

  const parts = [header];
  if (events.length > 0) {
    parts.push(events);
  }
  parts.push(footer);

  // iCal spec requires CRLF line endings
  return parts.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// GET /api/integrations/ical
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // --- Validate required param: propertyId ---
  const propertyId = searchParams.get('propertyId');
  if (!propertyId) {
    return NextResponse.json(
      {
        error: 'Missing required query parameter: propertyId',
        usage:
          'https://rah-midland.com/api/integrations/ical?propertyId=PROP_ID&key=SECRET',
      },
      { status: 400 },
    );
  }

  // --- Key-based authentication ---
  const expectedKey = process.env.ICAL_EXPORT_KEY ?? 'rah-midland-ical-2026';
  const providedKey = searchParams.get('key');

  if (!providedKey || providedKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized: invalid or missing key parameter' },
      { status: 401 },
    );
  }

  // --- Fetch bookings ---
  const bookings = getBookingsForProperty(propertyId);

  console.log(
    `[ical-export] Generating iCal for property=${propertyId}, bookings=${bookings.length}`,
  );

  // --- Generate iCal document ---
  const icalContent = generateICal(propertyId, bookings);
  const filename = `${propertyId}-calendar.ics`;

  // --- Return with proper headers ---
  return new NextResponse(icalContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
