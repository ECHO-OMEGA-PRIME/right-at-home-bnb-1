/**
 * Data Formatting Unit Tests
 * Tests for date, currency, phone, and address formatting
 */

import { describe, it, expect } from 'vitest';
import { formatDate, daysFromNow } from '../utils/helpers';
import { REAL_PROPERTIES, TEST_BOOKINGS } from '../utils/fixtures';

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Format currency with USD locale
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * Format phone number to (XXX) XXX-XXXX
 */
function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const cleaned = digits.startsWith('1') ? digits.slice(1) : digits;
  if (cleaned.length !== 10) return phone;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

/**
 * Format address for display
 */
function formatAddress(address: string, city: string, state: string, zip: string): string {
  return `${address}, ${city}, ${state} ${zip}`;
}

/**
 * Format guest count text
 */
function formatGuestCount(count: number): string {
  return count === 1 ? '1 guest' : `${count} guests`;
}

/**
 * Format night count text
 */
function formatNightCount(nights: number): string {
  return nights === 1 ? '1 night' : `${nights} nights`;
}

/**
 * Format date range for display
 */
function formatDateRange(checkIn: Date, checkOut: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  return `${formatter.format(checkIn)} - ${formatter.format(checkOut)}`;
}

/**
 * Format property amenities for display
 */
function formatAmenities(amenities: string[]): string {
  return amenities
    .map(a => a.replace(/_/g, ' '))
    .map(a => a.charAt(0).toUpperCase() + a.slice(1))
    .join(', ');
}

/**
 * Format booking status for display
 */
function formatBookingStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'Pending',
    'confirmed': 'Confirmed',
    'checked_in': 'Checked In',
    'checked_out': 'Checked Out',
    'cancelled': 'Cancelled'
  };
  return statusMap[status] || status;
}

/**
 * Format relative time (e.g., "in 3 days", "2 days ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

// ============================================
// TESTS
// ============================================

describe('Data Formatting', () => {
  describe('Date Formatting', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2026-02-15');
      expect(formatDate(date)).toBe('2026-02-15');
    });

    it('should handle single digit months and days', () => {
      const date = new Date('2026-01-05');
      expect(formatDate(date)).toBe('2026-01-05');
    });

    it('should format future dates correctly', () => {
      const future = daysFromNow(30);
      const formatted = formatDate(future);
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should format date ranges for booking display', () => {
      const checkIn = new Date('2026-02-15');
      const checkOut = new Date('2026-02-18');
      const range = formatDateRange(checkIn, checkOut);

      expect(range).toContain('Feb');
      expect(range).toContain('15');
      expect(range).toContain('18');
      expect(range).toContain('2026');
    });

    it('should handle year boundary in date range', () => {
      const checkIn = new Date('2026-12-30');
      const checkOut = new Date('2027-01-02');
      const range = formatDateRange(checkIn, checkOut);

      expect(range).toContain('Dec');
      expect(range).toContain('Jan');
    });
  });

  describe('Currency Formatting', () => {
    it('should format whole numbers', () => {
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(10000)).toBe('$10,000.00');
    });

    it('should format decimal amounts', () => {
      expect(formatCurrency(99.99)).toBe('$99.99');
      expect(formatCurrency(1152.88)).toBe('$1,152.88');
    });

    it('should format zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format property rates correctly', () => {
      for (const property of REAL_PROPERTIES) {
        const formatted = formatCurrency(property.baseRate!);
        expect(formatted).toMatch(/^\$[\d,]+\.\d{2}$/);
      }
    });

    it('should format booking totals correctly', () => {
      for (const booking of TEST_BOOKINGS) {
        if (booking.total) {
          const formatted = formatCurrency(booking.total);
          expect(formatted).toMatch(/^\$[\d,]+\.\d{2}$/);
        }
      }
    });
  });

  describe('Phone Formatting', () => {
    it('should format 10-digit phone numbers', () => {
      expect(formatPhoneNumber('4325551234')).toBe('(432) 555-1234');
    });

    it('should handle phone with country code', () => {
      expect(formatPhoneNumber('+14325551234')).toBe('(432) 555-1234');
      expect(formatPhoneNumber('14325551234')).toBe('(432) 555-1234');
    });

    it('should handle already formatted phones', () => {
      expect(formatPhoneNumber('(432) 555-1234')).toBe('(432) 555-1234');
    });

    it('should preserve invalid phone numbers', () => {
      expect(formatPhoneNumber('123')).toBe('123');
    });

    it('should format all Midland area codes consistently', () => {
      const midlandPhones = [
        '+14325550001',
        '+14325550002',
        '+14325550003'
      ];

      for (const phone of midlandPhones) {
        const formatted = formatPhoneNumber(phone);
        expect(formatted).toMatch(/^\(432\) \d{3}-\d{4}$/);
      }
    });
  });

  describe('Address Formatting', () => {
    it('should format full address', () => {
      const formatted = formatAddress('2506 Castleford', 'Midland', 'TX', '79705');
      expect(formatted).toBe('2506 Castleford, Midland, TX 79705');
    });

    it('should format all property addresses', () => {
      for (const property of REAL_PROPERTIES) {
        const formatted = formatAddress(
          property.address!,
          property.city!,
          property.state!,
          property.zip!
        );

        expect(formatted).toContain('Midland');
        expect(formatted).toContain('TX');
        expect(formatted).toMatch(/\d{5}$/);
      }
    });
  });

  describe('Guest Count Formatting', () => {
    it('should format singular guest', () => {
      expect(formatGuestCount(1)).toBe('1 guest');
    });

    it('should format plural guests', () => {
      expect(formatGuestCount(2)).toBe('2 guests');
      expect(formatGuestCount(10)).toBe('10 guests');
    });

    it('should format property max guests', () => {
      for (const property of REAL_PROPERTIES) {
        const formatted = formatGuestCount(property.maxGuests!);
        expect(formatted).toMatch(/^\d+ guests?$/);
      }
    });
  });

  describe('Night Count Formatting', () => {
    it('should format singular night', () => {
      expect(formatNightCount(1)).toBe('1 night');
    });

    it('should format plural nights', () => {
      expect(formatNightCount(3)).toBe('3 nights');
      expect(formatNightCount(7)).toBe('7 nights');
    });

    it('should format booking nights', () => {
      for (const booking of TEST_BOOKINGS) {
        if (booking.nights) {
          const formatted = formatNightCount(booking.nights);
          expect(formatted).toMatch(/^\d+ nights?$/);
        }
      }
    });
  });

  describe('Amenities Formatting', () => {
    it('should capitalize and space amenities', () => {
      const amenities = ['hot_tub', 'smart_tv', 'wifi'];
      const formatted = formatAmenities(amenities);

      expect(formatted).toContain('Hot tub');
      expect(formatted).toContain('Smart tv');
      expect(formatted).toContain('Wifi');
    });

    it('should join with commas', () => {
      const amenities = ['pool', 'grill', 'patio'];
      const formatted = formatAmenities(amenities);
      expect(formatted).toBe('Pool, Grill, Patio');
    });

    it('should handle property amenities', () => {
      for (const property of REAL_PROPERTIES) {
        const formatted = formatAmenities(property.amenities!);
        expect(formatted.length).toBeGreaterThan(0);
        expect(formatted).not.toContain('_');
      }
    });
  });

  describe('Booking Status Formatting', () => {
    it('should format all statuses correctly', () => {
      expect(formatBookingStatus('pending')).toBe('Pending');
      expect(formatBookingStatus('confirmed')).toBe('Confirmed');
      expect(formatBookingStatus('checked_in')).toBe('Checked In');
      expect(formatBookingStatus('checked_out')).toBe('Checked Out');
      expect(formatBookingStatus('cancelled')).toBe('Cancelled');
    });

    it('should handle unknown statuses', () => {
      expect(formatBookingStatus('unknown')).toBe('unknown');
    });
  });

  describe('Relative Time Formatting', () => {
    it('should format today', () => {
      const today = new Date();
      expect(formatRelativeTime(today)).toBe('Today');
    });

    it('should format tomorrow', () => {
      const tomorrow = daysFromNow(1);
      expect(formatRelativeTime(tomorrow)).toBe('Tomorrow');
    });

    it('should format future days', () => {
      const futureDate = daysFromNow(5);
      expect(formatRelativeTime(futureDate)).toBe('In 5 days');
    });

    it('should format past days', () => {
      const pastDate = daysFromNow(-3);
      expect(formatRelativeTime(pastDate)).toBe('3 days ago');
    });
  });

  describe('Property Name Formatting', () => {
    it('should have descriptive property names', () => {
      for (const property of REAL_PROPERTIES) {
        expect(property.name!.length).toBeGreaterThan(5);
        expect(property.name!.length).toBeLessThan(50);
      }
    });

    it('should have unique property names', () => {
      const names = REAL_PROPERTIES.map(p => p.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('URL Slug Generation', () => {
    function generateSlug(name: string): string {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }

    it('should generate valid URL slugs from property names', () => {
      for (const property of REAL_PROPERTIES) {
        const slug = generateSlug(property.name!);
        expect(slug).toMatch(/^[a-z0-9-]+$/);
        expect(slug).not.toContain('--');
      }
    });

    it('should handle special characters in names', () => {
      expect(generateSlug("O'Connor's Place")).toBe('oconnors-place');
      expect(generateSlug('Pool & Patio')).toBe('pool-patio');
    });
  });

  describe('Numeric Formatting', () => {
    it('should format bedroom count', () => {
      for (const property of REAL_PROPERTIES) {
        const bedroomText = property.bedrooms === 1 ? '1 bedroom' : `${property.bedrooms} bedrooms`;
        expect(bedroomText).toMatch(/^\d+ bedrooms?$/);
      }
    });

    it('should format bathroom count with decimal', () => {
      for (const property of REAL_PROPERTIES) {
        const bathroomText = property.bathrooms === 1
          ? '1 bathroom'
          : `${property.bathrooms} bathrooms`;
        expect(bathroomText).toMatch(/^\d+\.?\d* bathrooms?$/);
      }
    });

    it('should format cleaning duration as hours/minutes', () => {
      function formatDuration(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours === 0) return `${mins} min`;
        if (mins === 0) return `${hours} hr`;
        return `${hours} hr ${mins} min`;
      }

      expect(formatDuration(60)).toBe('1 hr');
      expect(formatDuration(90)).toBe('1 hr 30 min');
      expect(formatDuration(180)).toBe('3 hr');
      expect(formatDuration(45)).toBe('45 min');
    });
  });
});
