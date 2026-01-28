/**
 * Right at Home BnB - Calendar Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockElectronAPI, mockStore } from '../setup';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Calendar Service', () => {
  let calendarService: typeof import('@renderer/services/calendar');

  beforeEach(async () => {
    vi.resetModules();
    mockStore.clear();
    mockFetch.mockReset();

    // Dynamic import to get fresh instance
    calendarService = await import('@renderer/services/calendar');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('iCal Parsing', () => {
    it('should parse valid iCal data', () => {
      const icalData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
DTSTART:20240115T100000Z
DTEND:20240117T100000Z
SUMMARY:Guest Booking - John Doe
UID:test-event-123
END:VEVENT
END:VCALENDAR`;

      const events = calendarService.parseICalData(icalData);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        uid: 'test-event-123',
        summary: 'Guest Booking - John Doe',
      });
    });

    it('should handle empty iCal data', () => {
      const icalData = `BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR`;

      const events = calendarService.parseICalData(icalData);
      expect(events).toHaveLength(0);
    });

    it('should handle malformed iCal data gracefully', () => {
      const icalData = 'not valid ical data';

      expect(() => calendarService.parseICalData(icalData)).not.toThrow();
      const events = calendarService.parseICalData(icalData);
      expect(events).toHaveLength(0);
    });

    it('should extract guest names from summary', () => {
      const icalData = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Airbnb Booking - Jane Smith (2 guests)
UID:airbnb-123
DTSTART:20240120T140000Z
DTEND:20240125T110000Z
END:VEVENT
END:VCALENDAR`;

      const events = calendarService.parseICalData(icalData);

      expect(events[0].guestName).toBeDefined();
      expect(events[0].summary).toContain('Jane Smith');
    });
  });

  describe('iCal Generation', () => {
    it('should generate valid iCal format', () => {
      const bookings = [
        {
          id: 'booking-1',
          guestName: 'John Doe',
          checkIn: new Date('2024-01-15T15:00:00Z'),
          checkOut: new Date('2024-01-18T11:00:00Z'),
          propertyName: 'Sunset Villa',
          status: 'confirmed',
        },
      ];

      const icalString = calendarService.generateICalFeed(bookings);

      expect(icalString).toContain('BEGIN:VCALENDAR');
      expect(icalString).toContain('END:VCALENDAR');
      expect(icalString).toContain('BEGIN:VEVENT');
      expect(icalString).toContain('John Doe');
      expect(icalString).toContain('Sunset Villa');
    });

    it('should generate unique UIDs for each event', () => {
      const bookings = [
        {
          id: 'booking-1',
          guestName: 'Guest 1',
          checkIn: new Date('2024-01-15'),
          checkOut: new Date('2024-01-18'),
          propertyName: 'Property 1',
          status: 'confirmed',
        },
        {
          id: 'booking-2',
          guestName: 'Guest 2',
          checkIn: new Date('2024-01-20'),
          checkOut: new Date('2024-01-23'),
          propertyName: 'Property 2',
          status: 'confirmed',
        },
      ];

      const icalString = calendarService.generateICalFeed(bookings);
      const uidMatches = icalString.match(/UID:.+/g);

      expect(uidMatches).toHaveLength(2);
      expect(uidMatches![0]).not.toBe(uidMatches![1]);
    });
  });

  describe('Calendar Sync', () => {
    it('should fetch and parse external calendar', async () => {
      const mockIcal = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:External Booking
DTSTART:20240201T100000Z
DTEND:20240205T100000Z
UID:external-123
END:VEVENT
END:VCALENDAR`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockIcal),
      });

      const events = await calendarService.syncExternalCalendar('https://example.com/calendar.ics');

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('example.com'));
      expect(events).toHaveLength(1);
      expect(events[0].summary).toBe('External Booking');
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        calendarService.syncExternalCalendar('https://invalid-url.com/calendar.ics')
      ).rejects.toThrow();
    });

    it('should merge overlapping events correctly', () => {
      const localEvents = [
        { uid: 'local-1', start: new Date('2024-01-15'), end: new Date('2024-01-18') },
      ];
      const externalEvents = [
        { uid: 'external-1', start: new Date('2024-01-17'), end: new Date('2024-01-20') },
      ];

      const merged = calendarService.mergeCalendarEvents(localEvents, externalEvents);

      expect(merged).toHaveLength(2);
      // Check for overlap detection
      const overlaps = calendarService.detectOverlaps(merged);
      expect(overlaps.length).toBeGreaterThan(0);
    });
  });

  describe('Date Utilities', () => {
    it('should format dates for iCal correctly', () => {
      const date = new Date('2024-01-15T15:30:00Z');
      const formatted = calendarService.formatICalDate(date);

      expect(formatted).toMatch(/^\d{8}T\d{6}Z$/);
    });

    it('should parse iCal dates correctly', () => {
      const icalDate = '20240115T153000Z';
      const parsed = calendarService.parseICalDate(icalDate);

      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getUTCFullYear()).toBe(2024);
      expect(parsed.getUTCMonth()).toBe(0); // January
      expect(parsed.getUTCDate()).toBe(15);
    });
  });
});
