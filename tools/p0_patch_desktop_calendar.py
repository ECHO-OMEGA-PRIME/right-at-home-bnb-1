from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\desktop\src\renderer\services\calendar.ts")
text = path.read_text(encoding="utf-8")
anchor = "export const calendarService = new CalendarService();\n"
addition = r'''export const calendarService = new CalendarService();

export interface LegacyCalendarEvent {
  uid: string;
  summary?: string;
  start: Date;
  end: Date;
  guestName?: string;
  description?: string;
  location?: string;
}

export interface LegacyCalendarBooking {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  propertyName: string;
  status: string;
}

export function formatICalDate(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

export function parseICalDate(value: string): Date {
  const normalized = value.trim();
  const match = normalized.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/
  );
  if (!match) throw new Error(`Invalid iCal date: ${value}`);
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] ?? 0),
      Number(match[5] ?? 0),
      Number(match[6] ?? 0)
    )
  );
}

function unfoldICalLines(value: string): string[] {
  return value
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/);
}

function propertyValue(lines: string[], name: string): string | undefined {
  const prefix = `${name}`.toUpperCase();
  const line = lines.find((candidate) => {
    const upper = candidate.toUpperCase();
    return upper.startsWith(`${prefix}:`) || upper.startsWith(`${prefix};`);
  });
  if (!line) return undefined;
  const separator = line.indexOf(':');
  return separator >= 0 ? line.slice(separator + 1).trim() : undefined;
}

function unescapeICalValue(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function escapeICalValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function extractGuestName(summary: string): string | undefined {
  const bookingMatch = summary.match(
    /(?:booking|guest)\s*(?:-|:)\s*([^()]+?)(?:\s*\(|$)/i
  );
  return bookingMatch?.[1]?.trim() || undefined;
}

export function parseICalData(icalData: string): LegacyCalendarEvent[] {
  if (!icalData.includes('BEGIN:VEVENT')) return [];
  const blocks = icalData.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  const events: LegacyCalendarEvent[] = [];

  for (const block of blocks) {
    try {
      const lines = unfoldICalLines(block);
      const uid = propertyValue(lines, 'UID');
      const startValue = propertyValue(lines, 'DTSTART');
      const endValue = propertyValue(lines, 'DTEND');
      if (!uid || !startValue || !endValue) continue;
      const summary = unescapeICalValue(propertyValue(lines, 'SUMMARY') ?? '');
      events.push({
        uid,
        summary,
        start: parseICalDate(startValue),
        end: parseICalDate(endValue),
        guestName: extractGuestName(summary),
        description: propertyValue(lines, 'DESCRIPTION'),
        location: propertyValue(lines, 'LOCATION'),
      });
    } catch {
      // Ignore malformed individual events while preserving valid feed entries.
    }
  }

  return events;
}

export function generateICalFeed(bookings: LegacyCalendarBooking[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${ICAL_PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const booking of bookings) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:booking-${escapeICalValue(booking.id)}@rah-midland.com`);
    lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
    lines.push(`DTSTART:${formatICalDate(booking.checkIn)}`);
    lines.push(`DTEND:${formatICalDate(booking.checkOut)}`);
    lines.push(
      `SUMMARY:${escapeICalValue(`${booking.propertyName} - ${booking.guestName}`)}`
    );
    lines.push(`DESCRIPTION:${escapeICalValue(`Guest Booking - ${booking.guestName}`)}`);
    lines.push(`STATUS:${booking.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export async function syncExternalCalendar(url: string): Promise<LegacyCalendarEvent[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Calendar fetch failed with HTTP ${response.status}`);
  }
  return parseICalData(await response.text());
}

export function mergeCalendarEvents<T extends { uid: string }>(
  localEvents: T[],
  externalEvents: T[]
): T[] {
  const merged = new Map<string, T>();
  for (const event of localEvents) merged.set(event.uid, event);
  for (const event of externalEvents) merged.set(event.uid, event);
  return [...merged.values()];
}

export function detectOverlaps<T extends { uid: string; start: Date; end: Date }>(
  events: T[]
): Array<{ first: T; second: T }> {
  const sorted = [...events].sort(
    (left, right) => left.start.getTime() - right.start.getTime()
  );
  const overlaps: Array<{ first: T; second: T }> = [];
  for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
      const first = sorted[leftIndex];
      const second = sorted[rightIndex];
      if (second.start >= first.end) break;
      if (first.start < second.end && second.start < first.end) {
        overlaps.push({ first, second });
      }
    }
  }
  return overlaps;
}
'''
if anchor not in text:
    raise SystemExit("Calendar export anchor not found")
path.write_text(text.replace(anchor, addition, 1), encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
