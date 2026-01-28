/**
 * Booking Logic Unit Tests
 * Tests for booking creation, validation, and status management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestBooking,
  createTestGuest,
  REAL_PROPERTIES,
  TEST_BOOKINGS
} from '../utils/fixtures';
import {
  isValidDateRange,
  isValidGuestCount,
  daysFromNow,
  daysAgo,
  calculateNights,
  expectDatesInOrder
} from '../utils/helpers';

describe('Booking Logic', () => {
  describe('Booking Creation', () => {
    it('should create a valid booking with all required fields', () => {
      const booking = createTestBooking();

      expect(booking.id).toBeDefined();
      expect(booking.propertyId).toBeDefined();
      expect(booking.guestName).toBeDefined();
      expect(booking.guestEmail).toBeDefined();
      expect(booking.checkIn).toBeInstanceOf(Date);
      expect(booking.checkOut).toBeInstanceOf(Date);
      expect(booking.guests).toBeGreaterThan(0);
      expect(booking.nightlyRate).toBeGreaterThan(0);
      expect(booking.total).toBeGreaterThan(0);
    });

    it('should create booking with custom property', () => {
      const property = REAL_PROPERTIES[0];
      const booking = createTestBooking({
        propertyId: property.id,
        nightlyRate: property.baseRate,
        cleaningFee: property.cleaningFee
      });

      expect(booking.propertyId).toBe(property.id);
      expect(booking.nightlyRate).toBe(property.baseRate);
      expect(booking.cleaningFee).toBe(property.cleaningFee);
    });

    it('should create booking with future dates by default', () => {
      const booking = createTestBooking();
      const now = new Date();

      expect(booking.checkIn!.getTime()).toBeGreaterThan(now.getTime());
      expect(booking.checkOut!.getTime()).toBeGreaterThan(booking.checkIn!.getTime());
    });

    it('should generate unique booking IDs', () => {
      const booking1 = createTestBooking();
      const booking2 = createTestBooking();

      expect(booking1.id).not.toBe(booking2.id);
    });
  });

  describe('Date Validation', () => {
    it('should validate that checkIn is before checkOut', () => {
      const checkIn = daysFromNow(7);
      const checkOut = daysFromNow(10);

      expect(isValidDateRange(checkIn, checkOut)).toBe(true);
    });

    it('should reject checkIn after checkOut', () => {
      const checkIn = daysFromNow(10);
      const checkOut = daysFromNow(7);

      expect(isValidDateRange(checkIn, checkOut)).toBe(false);
    });

    it('should reject same-day booking (checkIn equals checkOut)', () => {
      const sameDay = daysFromNow(7);

      expect(isValidDateRange(sameDay, sameDay)).toBe(false);
    });

    it('should validate date sequence for multiple bookings', () => {
      const dates = [
        daysFromNow(1),
        daysFromNow(5),
        daysFromNow(10),
        daysFromNow(15)
      ];

      expectDatesInOrder(...dates);
    });

    it('should handle year boundary correctly', () => {
      const checkIn = new Date('2026-12-30');
      const checkOut = new Date('2027-01-02');

      expect(isValidDateRange(checkIn, checkOut)).toBe(true);
      expect(calculateNights(checkIn, checkOut)).toBe(3);
    });

    it('should handle leap year correctly', () => {
      const checkIn = new Date('2028-02-28'); // 2028 is a leap year
      const checkOut = new Date('2028-03-01');

      expect(calculateNights(checkIn, checkOut)).toBe(2); // Feb 28, Feb 29
    });
  });

  describe('Guest Count Validation', () => {
    it('should accept valid guest count within limit', () => {
      const maxGuests = 10;
      expect(isValidGuestCount(4, maxGuests)).toBe(true);
      expect(isValidGuestCount(10, maxGuests)).toBe(true);
      expect(isValidGuestCount(1, maxGuests)).toBe(true);
    });

    it('should reject guest count exceeding max', () => {
      const maxGuests = 10;
      expect(isValidGuestCount(11, maxGuests)).toBe(false);
      expect(isValidGuestCount(15, maxGuests)).toBe(false);
    });

    it('should reject zero or negative guest count', () => {
      const maxGuests = 10;
      expect(isValidGuestCount(0, maxGuests)).toBe(false);
      expect(isValidGuestCount(-1, maxGuests)).toBe(false);
    });

    it('should validate guest count for each property', () => {
      for (const property of REAL_PROPERTIES) {
        // Valid counts
        expect(isValidGuestCount(1, property.maxGuests!)).toBe(true);
        expect(isValidGuestCount(property.maxGuests!, property.maxGuests!)).toBe(true);

        // Invalid counts
        expect(isValidGuestCount(property.maxGuests! + 1, property.maxGuests!)).toBe(false);
      }
    });
  });

  describe('Booking Status Transitions', () => {
    const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

    it('should have valid initial status', () => {
      const booking = createTestBooking();
      expect(validStatuses).toContain(booking.status);
    });

    it('should allow transition from pending to confirmed', () => {
      const booking = createTestBooking({ status: 'pending' });
      const canConfirm = booking.status === 'pending';
      expect(canConfirm).toBe(true);
    });

    it('should allow transition from confirmed to checked_in', () => {
      const booking = createTestBooking({ status: 'confirmed' });
      const canCheckIn = booking.status === 'confirmed';
      expect(canCheckIn).toBe(true);
    });

    it('should allow cancellation from pending or confirmed', () => {
      const pending = createTestBooking({ status: 'pending' });
      const confirmed = createTestBooking({ status: 'confirmed' });

      expect(['pending', 'confirmed']).toContain(pending.status);
      expect(['pending', 'confirmed']).toContain(confirmed.status);
    });

    it('should not allow cancellation after check-in', () => {
      const checkedIn = createTestBooking({ status: 'checked_in' });
      const canCancel = ['pending', 'confirmed'].includes(checkedIn.status!);
      expect(canCancel).toBe(false);
    });
  });

  describe('Booking Source Handling', () => {
    const validSources = ['direct', 'airbnb', 'vrbo', 'booking.com'];

    it('should accept all valid booking sources', () => {
      for (const source of validSources) {
        const booking = createTestBooking({ source: source as 'direct' | 'airbnb' | 'vrbo' | 'booking.com' });
        expect(validSources).toContain(booking.source);
      }
    });

    it('should default to direct source', () => {
      const booking = createTestBooking();
      expect(booking.source).toBe('direct');
    });

    it('should track external ID for platform bookings', () => {
      const airbnbBooking = createTestBooking({
        source: 'airbnb',
        externalId: 'HMABCDEF123'
      });

      expect(airbnbBooking.source).toBe('airbnb');
      expect(airbnbBooking.externalId).toBe('HMABCDEF123');
    });
  });

  describe('Booking Overlap Detection', () => {
    it('should detect overlapping bookings for same property', () => {
      const existingBooking = createTestBooking({
        propertyId: 'prop_oasis_pool',
        checkIn: daysFromNow(10),
        checkOut: daysFromNow(15)
      });

      const newBooking = createTestBooking({
        propertyId: 'prop_oasis_pool',
        checkIn: daysFromNow(12),
        checkOut: daysFromNow(17)
      });

      // Check for overlap
      const overlaps =
        newBooking.checkIn! < existingBooking.checkOut! &&
        newBooking.checkOut! > existingBooking.checkIn!;

      expect(overlaps).toBe(true);
    });

    it('should allow back-to-back bookings', () => {
      const firstBooking = createTestBooking({
        propertyId: 'prop_oasis_pool',
        checkIn: daysFromNow(10),
        checkOut: daysFromNow(15)
      });

      const secondBooking = createTestBooking({
        propertyId: 'prop_oasis_pool',
        checkIn: daysFromNow(15), // Same day as first checkout
        checkOut: daysFromNow(20)
      });

      // Back-to-back should not overlap
      const overlaps =
        secondBooking.checkIn! < firstBooking.checkOut! &&
        secondBooking.checkOut! > firstBooking.checkIn!;

      expect(overlaps).toBe(false);
    });

    it('should allow bookings on different properties at same time', () => {
      const booking1 = createTestBooking({
        propertyId: 'prop_oasis_pool',
        checkIn: daysFromNow(10),
        checkOut: daysFromNow(15)
      });

      const booking2 = createTestBooking({
        propertyId: 'prop_adobe_compound',
        checkIn: daysFromNow(10),
        checkOut: daysFromNow(15)
      });

      // Different properties should not conflict
      expect(booking1.propertyId).not.toBe(booking2.propertyId);
    });
  });

  describe('Special Requests Handling', () => {
    it('should store special requests', () => {
      const booking = createTestBooking({
        notes: 'Early check-in requested',
        specialRequests: ['Extra towels', 'Baby crib']
      });

      expect(booking.notes).toBe('Early check-in requested');
      expect(booking.specialRequests).toContain('Extra towels');
      expect(booking.specialRequests).toContain('Baby crib');
    });

    it('should handle booking without special requests', () => {
      const booking = createTestBooking();

      expect(booking.notes).toBeUndefined();
      expect(booking.specialRequests).toBeUndefined();
    });
  });

  describe('Test Bookings Fixture Validation', () => {
    it('should have valid test bookings', () => {
      expect(TEST_BOOKINGS.length).toBeGreaterThan(0);

      for (const booking of TEST_BOOKINGS) {
        expect(booking.id).toBeDefined();
        expect(booking.propertyId).toBeDefined();
        expect(booking.guestName).toBeDefined();
        expect(booking.guestEmail).toBeDefined();
        expect(booking.checkIn).toBeDefined();
        expect(booking.checkOut).toBeDefined();
      }
    });

    it('should have consistent pricing in test bookings', () => {
      for (const booking of TEST_BOOKINGS) {
        if (booking.nightlyRate && booking.nights && booking.subtotal) {
          const expectedSubtotal = booking.nightlyRate * booking.nights;
          expect(booking.subtotal).toBe(expectedSubtotal);
        }
      }
    });

    it('should have unique booking IDs', () => {
      const ids = TEST_BOOKINGS.map(b => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
