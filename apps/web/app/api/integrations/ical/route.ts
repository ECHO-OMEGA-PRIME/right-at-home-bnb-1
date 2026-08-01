import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
  status: 'confirmed' | 'pending' | 'blocked' | 'cancelled';
  source: string;
  summary?: string;
}

/**
 * Fetch bookings for a property. In production this queries the database;
 * for development / demo purposes it returns mock data.
 */
async function getBookingsForProperty(propertyId: string): Promise<Booking[]> {
  // Real bookings. This previously returned an EMPTY mock store for every
  // property, so the feed told Airbnb/VRBO that every date was free -- a
  // double-booking vector, since channel managers block dates from exactly
  // this calendar (queue #26855).
  const rows = await prisma.booking.findMany({
    where: { propertyId },
    select: {
      id: true, propertyId: true, checkIn: true, checkOut: true,
      status: true, platform: true,
      guest: { select: { name: true } },
    },
    orderBy: { checkIn: 'asc' },
  });

  return rows.map((b) => ({
    id: b.id,
    propertyId: b.propertyId,
    // Guest names are deliberately NOT published. This feed is fetched with a
    // shared key by third-party platforms; a blocked date needs no PII.
    guestName: 'Reserved',
    checkIn: b.checkIn.toISOString().slice(0, 10),
    checkOut: b.checkOut.toISOString().slice(0, 10),
    // Stored upper-case; the generator filters on lower-case 'cancelled'.
    status: ((b.status || '').toLowerCase() as Booking['status']),
    source: (b.platform || 'direct').toLowerCase(),
  }));
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

  // Only a genuinely pending booking is TENTATIVE. An owner hold (BLOCKED) is a
  // definite unavailability, and it used to publish as `STATUS:TENTATIVE` simply
  // because it was not the string 'confirmed' -- some channel managers ignore
  // tentative events when deciding whether a date is free, which would let the
  // channel re-sell a date the owner has taken off the market. TRANSP:OPAQUE
  // already says "this blocks time"; the STATUS must not contradict it.
  const isTentative = booking.status === 'pending';
  const summary =
    booking.summary ??
    (booking.status === 'blocked'
      ? 'Blocked'
      : `${isTentative ? 'Tentative' : 'Reserved'} - ${escapeICalText(booking.guestName)}`);
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
    `STATUS:${isTentative ? 'TENTATIVE' : 'CONFIRMED'}`,
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
  // Fail CLOSED. The previous fallback literal 'rah-midland-ical-2026' meant
  // that if ICAL_EXPORT_KEY were ever unset, anyone who guessed that published
  // string could pull the booking calendar -- the same missing-env-var
  // short-circuit that left the cron routes open.
  const expectedKey = process.env.ICAL_EXPORT_KEY?.trim();
  const providedKey = searchParams.get('key');

  if (!expectedKey || !providedKey || providedKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized: invalid or missing key parameter' },
      { status: 401 },
    );
  }

  // --- Fetch bookings ---
  const bookings = await getBookingsForProperty(propertyId);

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
