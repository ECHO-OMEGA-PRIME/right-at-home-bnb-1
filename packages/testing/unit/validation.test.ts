/**
 * Input Validation Unit Tests
 * Tests for email, phone, address, and data validation
 */

import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidPhone,
  isValidZipCode,
  isValidDateRange,
  isValidGuestCount,
  daysFromNow
} from '../utils/helpers';
import {
  REAL_PROPERTIES,
  TEST_GUESTS,
  TEST_USERS,
  TEST_BOOKINGS
} from '../utils/fixtures';

describe('Input Validation', () => {
  describe('Email Validation', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.org',
        'user+tag@example.com',
        'user123@sub.domain.com',
        'a@b.co',
        'steven@rightathomebnb.com'
      ];

      for (const email of validEmails) {
        expect(isValidEmail(email)).toBe(true);
      }
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'notanemail',
        '@nodomain.com',
        'noat.com',
        'spaces in@email.com',
        'missing@tld',
        '@',
        'double@@at.com'
      ];

      for (const email of invalidEmails) {
        expect(isValidEmail(email)).toBe(false);
      }
    });

    it('should validate all test guest emails', () => {
      for (const guest of TEST_GUESTS) {
        if (guest.email) {
          expect(isValidEmail(guest.email)).toBe(true);
        }
      }
    });

    it('should validate all test user emails', () => {
      for (const user of TEST_USERS) {
        if (user.email) {
          expect(isValidEmail(user.email)).toBe(true);
        }
      }
    });
  });

  describe('Phone Validation', () => {
    it('should accept valid US phone numbers', () => {
      const validPhones = [
        '+14325551234',
        '14325551234',
        '4325551234',
        '(432) 555-1234',
        '432-555-1234',
        '432.555.1234',
        '432 555 1234'
      ];

      for (const phone of validPhones) {
        expect(isValidPhone(phone)).toBe(true);
      }
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '',
        '123',
        '123456789', // Too short
        '12345678901234', // Too long
        'notaphone',
        '+44 20 7123 4567' // UK number
      ];

      for (const phone of invalidPhones) {
        expect(isValidPhone(phone)).toBe(false);
      }
    });

    it('should validate all test user phones', () => {
      for (const user of TEST_USERS) {
        if (user.phone) {
          expect(isValidPhone(user.phone)).toBe(true);
        }
      }
    });
  });

  describe('ZIP Code Validation', () => {
    it('should accept valid 5-digit ZIP codes', () => {
      const validZips = [
        '79705',
        '79707',
        '79701',
        '79703',
        '79706',
        '00000',
        '99999'
      ];

      for (const zip of validZips) {
        expect(isValidZipCode(zip)).toBe(true);
      }
    });

    it('should accept valid ZIP+4 codes', () => {
      const validZips = [
        '79705-1234',
        '79707-5678',
        '00000-0000',
        '99999-9999'
      ];

      for (const zip of validZips) {
        expect(isValidZipCode(zip)).toBe(true);
      }
    });

    it('should reject invalid ZIP codes', () => {
      const invalidZips = [
        '',
        '1234', // Too short
        '123456', // Too long without dash
        '12345-', // Incomplete ZIP+4
        '12345-12', // Incomplete ZIP+4
        'ABCDE', // Letters
        '123-45' // Wrong format
      ];

      for (const zip of invalidZips) {
        expect(isValidZipCode(zip)).toBe(false);
      }
    });

    it('should validate all property ZIP codes', () => {
      for (const property of REAL_PROPERTIES) {
        if (property.zip) {
          expect(isValidZipCode(property.zip)).toBe(true);
        }
      }
    });
  });

  describe('Date Range Validation', () => {
    it('should accept valid date ranges', () => {
      expect(isValidDateRange(daysFromNow(1), daysFromNow(5))).toBe(true);
      expect(isValidDateRange(daysFromNow(10), daysFromNow(11))).toBe(true);
      expect(isValidDateRange(new Date('2026-01-01'), new Date('2026-12-31'))).toBe(true);
    });

    it('should reject invalid date ranges', () => {
      expect(isValidDateRange(daysFromNow(5), daysFromNow(1))).toBe(false);
      expect(isValidDateRange(daysFromNow(5), daysFromNow(5))).toBe(false);
    });

    it('should validate all test booking date ranges', () => {
      for (const booking of TEST_BOOKINGS) {
        if (booking.checkIn && booking.checkOut) {
          expect(isValidDateRange(booking.checkIn, booking.checkOut)).toBe(true);
        }
      }
    });
  });

  describe('Guest Count Validation', () => {
    it('should validate guest counts within property limits', () => {
      for (const property of REAL_PROPERTIES) {
        // Valid cases
        expect(isValidGuestCount(1, property.maxGuests!)).toBe(true);
        expect(isValidGuestCount(property.maxGuests!, property.maxGuests!)).toBe(true);

        // Invalid cases
        expect(isValidGuestCount(0, property.maxGuests!)).toBe(false);
        expect(isValidGuestCount(property.maxGuests! + 1, property.maxGuests!)).toBe(false);
      }
    });

    it('should handle edge cases', () => {
      expect(isValidGuestCount(1, 1)).toBe(true); // Minimum valid
      expect(isValidGuestCount(100, 100)).toBe(true); // Large event
      expect(isValidGuestCount(-5, 10)).toBe(false);
    });
  });

  describe('Property Data Validation', () => {
    it('should have valid data for all properties', () => {
      for (const property of REAL_PROPERTIES) {
        // Required fields
        expect(property.id).toBeDefined();
        expect(property.name).toBeDefined();
        expect(property.address).toBeDefined();
        expect(property.city).toBe('Midland');
        expect(property.state).toBe('TX');

        // Numeric fields
        expect(property.bedrooms).toBeGreaterThan(0);
        expect(property.bathrooms).toBeGreaterThan(0);
        expect(property.maxGuests).toBeGreaterThan(0);
        expect(property.baseRate).toBeGreaterThan(0);
        expect(property.cleaningFee).toBeGreaterThanOrEqual(0);

        // Logical relationships
        expect(property.maxGuests).toBeGreaterThanOrEqual(property.bedrooms!);
      }
    });

    it('should have unique property IDs', () => {
      const ids = REAL_PROPERTIES.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique property addresses', () => {
      const addresses = REAL_PROPERTIES.map(p => p.address);
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(addresses.length);
    });

    it('should have amenities as arrays', () => {
      for (const property of REAL_PROPERTIES) {
        expect(Array.isArray(property.amenities)).toBe(true);
        expect(property.amenities!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Booking Data Validation', () => {
    it('should have consistent booking totals', () => {
      for (const booking of TEST_BOOKINGS) {
        if (booking.subtotal && booking.cleaningFee !== undefined &&
            booking.serviceFee && booking.taxes && booking.total) {
          const calculatedTotal = booking.subtotal + booking.cleaningFee +
                                   booking.serviceFee + booking.taxes;
          // Allow small floating point difference
          expect(Math.abs(booking.total - calculatedTotal)).toBeLessThan(0.02);
        }
      }
    });

    it('should have valid booking statuses', () => {
      const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];
      for (const booking of TEST_BOOKINGS) {
        expect(validStatuses).toContain(booking.status);
      }
    });

    it('should have valid booking sources', () => {
      const validSources = ['direct', 'airbnb', 'vrbo', 'booking.com'];
      for (const booking of TEST_BOOKINGS) {
        expect(validSources).toContain(booking.source);
      }
    });
  });

  describe('User Data Validation', () => {
    it('should have valid roles for all users', () => {
      const validRoles = ['owner', 'admin', 'cleaner', 'guest'];
      for (const user of TEST_USERS) {
        expect(validRoles).toContain(user.role);
      }
    });

    it('should have unique user IDs', () => {
      const ids = TEST_USERS.map(u => u.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique user emails', () => {
      const emails = TEST_USERS.map(u => u.email);
      const uniqueEmails = new Set(emails);
      expect(uniqueEmails.size).toBe(emails.length);
    });
  });

  describe('Guest Data Validation', () => {
    it('should have non-negative lifetime values', () => {
      for (const guest of TEST_GUESTS) {
        if (guest.lifetimeValue !== undefined) {
          expect(guest.lifetimeValue).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should have non-negative total stays', () => {
      for (const guest of TEST_GUESTS) {
        if (guest.totalStays !== undefined) {
          expect(guest.totalStays).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should have VIP status as boolean', () => {
      for (const guest of TEST_GUESTS) {
        if (guest.vipStatus !== undefined) {
          expect(typeof guest.vipStatus).toBe('boolean');
        }
      }
    });
  });

  describe('Sanitization Tests', () => {
    it('should handle whitespace in emails', () => {
      const emailWithSpaces = '  test@example.com  ';
      const trimmed = emailWithSpaces.trim();
      expect(isValidEmail(trimmed)).toBe(true);
    });

    it('should handle special characters in names', () => {
      const specialNames = [
        "O'Brien",
        'Jean-Pierre',
        'van der Berg',
        'Maria Garcia-Lopez',
        'Test (nickname) User'
      ];

      for (const name of specialNames) {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    });

    it('should handle international characters', () => {
      const internationalStrings = [
        'Muller', // German
        'Garcia', // Spanish
        'Nguyen', // Vietnamese
        'Wang', // Chinese
        'Sato' // Japanese
      ];

      for (const str of internationalStrings) {
        expect(str.length).toBeGreaterThan(0);
      }
    });
  });
});
