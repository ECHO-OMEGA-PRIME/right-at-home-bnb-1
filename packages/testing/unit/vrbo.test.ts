import { describe, it, expect } from 'vitest';
import {
  parseICalFeed,
  generateICal,
  extractGuestName,
  extractConfirmCode,
  parseVrboReservationsCsv,
  VRBO_LISTING_IDS,
} from '../../shared/src/vrbo';

const SAMPLE_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//VRBO//EN
BEGIN:VEVENT
UID:vrbo-booking-123@vrbo.com
DTSTART;VALUE=DATE:20260715
DTEND;VALUE=DATE:20260718
SUMMARY:Reserved - John Smith
DESCRIPTION:Confirmation Code: HA-ABC123
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:blocked-dates@vrbo.com
DTSTART;VALUE=DATE:20260801
DTEND;VALUE=DATE:20260805
SUMMARY:Blocked
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

describe('VRBO iCal module', () => {
  it('parses VRBO iCal feed events', () => {
    const bookings = parseICalFeed(SAMPLE_ICAL);
    expect(bookings).toHaveLength(2);
    expect(bookings[0].guestName).toBe('John Smith');
    expect(bookings[0].confirmCode).toBe('HA-ABC123');
    expect(bookings[0].checkIn.getFullYear()).toBe(2026);
  });

  it('extracts guest name from summary patterns', () => {
    expect(extractGuestName('Reserved - Jane Doe')).toBe('Jane Doe');
    expect(extractGuestName('VRBO (Bob Wilson)')).toBe('Bob Wilson');
  });

  it('extracts confirmation codes', () => {
    expect(extractConfirmCode('Confirmation Code: HA-XYZ789')).toBe('HA-XYZ789');
  });

  it('generates valid iCal export', () => {
    const ical = generateICal('prop-1', 'Test Property', [
      {
        id: 'bk-1',
        checkIn: '2026-08-01',
        checkOut: '2026-08-04',
        guestName: 'Direct Guest',
        status: 'confirmed',
        source: 'direct',
      },
    ]);
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('BEGIN:VEVENT');
    expect(ical).toContain('Direct Guest');
    expect(ical).toContain('END:VCALENDAR');
  });

  it('filters cancelled bookings from export', () => {
    const ical = generateICal('prop-1', 'Test', [
      { id: 'bk-1', checkIn: '2026-08-01', checkOut: '2026-08-04', guestName: 'A', status: 'cancelled' },
      { id: 'bk-2', checkIn: '2026-09-01', checkOut: '2026-09-04', guestName: 'B', status: 'confirmed' },
    ]);
    expect(ical.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    expect(ical).toContain('B');
    expect(ical).not.toContain('SUMMARY:.*A');
  });
});

describe('VRBO CSV import', () => {
  it('parses Partner Central CSV export', () => {
    const csv = `Listing ID,Guest Name,Guest Email,Check In,Check Out,Guests,Total,Status,Confirmation Code
2634718,Alice Johnson,alice@example.com,07/15/2026,07/18/2026,4,850.00,Confirmed,HA-TEST001`;

    const rows = parseVrboReservationsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].vrboListingId).toBe('2634718');
    expect(rows[0].guestName).toBe('Alice Johnson');
    expect(rows[0].confirmCode).toBe('HA-TEST001');
    expect(rows[0].status).toBe('CONFIRMED');
    expect(rows[0].guestCount).toBe(4);
  });

  it('handles empty CSV', () => {
    expect(parseVrboReservationsCsv('')).toHaveLength(0);
  });
});

describe('VRBO listing IDs', () => {
  it('includes all 15 core listing IDs from spec', () => {
    const specIds = [
      '2634718', '2636389', '2638481', '2638524', '2643784', '2643822',
      '3005111', '3355618', '3477668', '4179271', '4437486', '4471713',
      '4581977', '4700881', '4750070',
    ];
    for (const id of specIds) {
      expect(VRBO_LISTING_IDS).toContain(id);
    }
  });
});