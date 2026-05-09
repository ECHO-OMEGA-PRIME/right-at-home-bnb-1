/**
 * Right at Home BnB - Calendar Events API
 * Returns unified calendar events from Prisma bookings + VRBO iCal feeds
 * GET /api/bookings/calendar?month=4&year=2026&property_id=optional
 */

import { NextRequest, NextResponse } from 'next/server';
import { PROPERTIES } from '@/lib/property-data';

// VRBO listing IDs for all active properties
const VRBO_PROPERTIES: Record<string, { vrboId: string; name: string }> = {};
for (const p of PROPERTIES) {
  if (p.status === 'ACTIVE' && p.vrboId) {
    VRBO_PROPERTIES[p.id] = { vrboId: p.vrboId, name: p.name };
  }
}

// Property colors for calendar display
const PROPERTY_COLORS = [
  '#FF5A5F', '#3B5998', '#10B981', '#8B5CF6', '#F59E0B',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#E11D48', '#7C3AED', '#0EA5E9', '#22C55E',
  '#EF4444', '#A855F7', '#D946EF', '#0891B2', '#65A30D',
];

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  platform: string;
  guestName: string | null;
  guestCount: number;
  confirmationCode: string | null;
  totalPrice: number | null;
  color: string;
  propertyId: string;
  propertyName: string;
}

// ── iCal parser ──────────────────────────────────────────────────────────────
function parseICalText(text: string): Array<{
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  description: string;
}> {
  const events: Array<{ uid: string; summary: string; dtstart: string; dtend: string; description: string }> = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');

  let inEvent = false;
  let current: any = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = { uid: '', summary: '', dtstart: '', dtend: '', description: '' };
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      inEvent = false;
      if (current.uid && current.dtstart) {
        events.push(current);
      }
      current = {};
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const nameAndParams = trimmed.slice(0, colonIdx);
    const value = trimmed.slice(colonIdx + 1);
    const name = nameAndParams.split(';')[0].toUpperCase();

    switch (name) {
      case 'UID': current.uid = value; break;
      case 'SUMMARY': current.summary = value; break;
      case 'DTSTART': current.dtstart = parseICalDate(value); break;
      case 'DTEND': current.dtend = parseICalDate(value); break;
      case 'DESCRIPTION': current.description = value; break;
    }
  }
  return events;
}

function parseICalDate(val: string): string {
  // Handle YYYYMMDD and YYYYMMDDTHHmmssZ formats
  const clean = val.replace(/[^0-9T]/g, '');
  if (clean.length >= 8) {
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    return `${y}-${m}-${d}`;
  }
  return val;
}

function extractGuestName(summary: string, description: string): string | null {
  // VRBO summaries are typically "Reserved - Guest Name" or "Booked: Guest Name"
  const patterns = [
    /Reserved\s*[-–]\s*(.+)/i,
    /Booked:\s*(.+)/i,
    /Booking:\s*(.+)/i,
    /Guest:\s*(.+)/i,
  ];
  for (const p of patterns) {
    const m = summary.match(p) || description.match(p);
    if (m) return m[1].trim();
  }
  // If summary isn't a generic "Not available", use it as guest name
  if (summary && !summary.toLowerCase().includes('not available') && !summary.toLowerCase().includes('blocked')) {
    return summary;
  }
  return null;
}

function extractConfirmCode(summary: string, description: string): string | null {
  const combined = `${summary} ${description}`;
  const m = combined.match(/(?:Confirmation|Conf|Code|Ref)[\s#:]*([A-Z0-9]{6,})/i);
  return m ? m[1] : null;
}

// ── Fetch VRBO iCal feeds ────────────────────────────────────────────────────
async function fetchVrboCalendars(propertyFilter?: string | null): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  const propertyIds = Object.keys(VRBO_PROPERTIES);
  const targets = propertyFilter
    ? propertyIds.filter(id => id === propertyFilter)
    : propertyIds;

  // Try multiple VRBO iCal URL patterns
  const urlPatterns = [
    (vrboId: string) => `https://www.vrbo.com/icalendar/${vrboId}.ics`,
    (vrboId: string) => `https://www.vrbo.com/ical/${vrboId}.ics`,
    (vrboId: string) => `https://calendar.vrbo.com/ical/${vrboId}`,
  ];

  const fetchPromises = targets.map(async (propId, propIdx) => {
    const { vrboId, name } = VRBO_PROPERTIES[propId];
    const color = PROPERTY_COLORS[propIdx % PROPERTY_COLORS.length];

    for (const pattern of urlPatterns) {
      try {
        const url = pattern(vrboId);
        const res = await fetch(url, {
          headers: { 'User-Agent': 'RightAtHomeBnB/1.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;

        const text = await res.text();
        if (!text.includes('BEGIN:VCALENDAR')) continue;

        const parsed = parseICalText(text);
        for (const evt of parsed) {
          events.push({
            id: `vrbo-${vrboId}-${evt.uid}`,
            title: evt.summary || `VRBO Booking - ${name}`,
            start: evt.dtstart,
            end: evt.dtend || evt.dtstart,
            platform: 'vrbo',
            guestName: extractGuestName(evt.summary, evt.description),
            guestCount: 1,
            confirmationCode: extractConfirmCode(evt.summary, evt.description),
            totalPrice: null,
            color,
            propertyId: propId,
            propertyName: name,
          });
        }
        break; // Stop trying patterns once one works
      } catch {
        // Try next pattern
      }
    }
  });

  await Promise.allSettled(fetchPromises);
  return events;
}

// ── Fetch Prisma bookings ────────────────────────────────────────────────────
async function fetchPrismaBookings(month: number, year: number, propertyFilter?: string | null): Promise<CalendarEvent[]> {
  try {
    // Dynamic import to handle cases where prisma isn't configured
    const { default: prisma } = await import('@/lib/prisma');

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const where: any = {
      status: { not: 'CANCELLED' },
      OR: [
        { checkIn: { gte: startDate, lte: endDate } },
        { checkOut: { gte: startDate, lte: endDate } },
        { AND: [{ checkIn: { lte: startDate } }, { checkOut: { gte: endDate } }] },
      ],
    };

    if (propertyFilter) {
      where.propertyId = propertyFilter;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        property: { select: { id: true, name: true } },
        guest: { select: { name: true } },
      },
    });

    const propIds = [...new Set(bookings.map(b => b.propertyId))];

    return bookings.map((b) => {
      const propIdx = propIds.indexOf(b.propertyId);
      return {
        id: b.id,
        title: `${b.guest.name} — ${b.property.name}`,
        start: b.checkIn.toISOString().split('T')[0],
        end: b.checkOut.toISOString().split('T')[0],
        platform: b.platform.toLowerCase(),
        guestName: b.guest.name,
        guestCount: b.guestCount,
        confirmationCode: b.confirmCode,
        totalPrice: b.totalPrice,
        color: PROPERTY_COLORS[propIdx % PROPERTY_COLORS.length],
        propertyId: b.propertyId,
        propertyName: b.property.name,
      };
    });
  } catch (err) {
    console.error('[calendar] Prisma query failed:', err);
    return [];
  }
}

// ── GET handler ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const month = parseInt(params.get('month') || String(new Date().getMonth() + 1));
    const year = parseInt(params.get('year') || String(new Date().getFullYear()));
    const propertyFilter = params.get('property_id') || null;

    // Fetch from both sources in parallel
    const [prismaEvents, vrboEvents] = await Promise.all([
      fetchPrismaBookings(month, year, propertyFilter),
      fetchVrboCalendars(propertyFilter),
    ]);

    // Filter VRBO events to the requested month (rough filter - include surrounding weeks)
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const filteredVrbo = vrboEvents.filter(evt => {
      const start = new Date(evt.start);
      const end = new Date(evt.end);
      return start <= monthEnd && end >= monthStart;
    });

    // Deduplicate: if a VRBO booking matches a Prisma booking by confirmation code, skip the VRBO one
    const prismaConfCodes = new Set(prismaEvents.map(e => e.confirmationCode).filter(Boolean));
    const dedupedVrbo = filteredVrbo.filter(e =>
      !e.confirmationCode || !prismaConfCodes.has(e.confirmationCode)
    );

    const allEvents = [...prismaEvents, ...dedupedVrbo];

    // Build property list for sidebar
    const propertyMap = new Map<string, string>();
    for (const p of PROPERTIES) {
      if (p.status === 'ACTIVE') {
        propertyMap.set(p.id, p.name);
      }
    }

    return NextResponse.json({
      events: allEvents,
      month,
      year,
      properties: Array.from(propertyMap.entries()).map(([id, name], idx) => ({
        id,
        name,
        color: PROPERTY_COLORS[idx % PROPERTY_COLORS.length],
      })),
      sources: {
        prisma: prismaEvents.length,
        vrbo: dedupedVrbo.length,
      },
    });
  } catch (error: any) {
    console.error('[calendar] Error:', error);
    return NextResponse.json(
      { events: [], error: error.message },
      { status: 200 }, // Return 200 with empty events to avoid breaking the UI
    );
  }
}
