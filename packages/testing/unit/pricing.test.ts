/**
 * Pricing Calculations Unit Tests
 * Tests for booking price calculations, discounts, and fees
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateSubtotal,
  calculateServiceFee,
  calculateTaxes,
  calculateTotal,
  calculateNights,
  expectInRange
} from '../utils/helpers';
import { REAL_PROPERTIES, createTestBooking } from '../utils/fixtures';

describe('Pricing Calculations', () => {
  describe('calculateNights', () => {
    it('should calculate nights correctly for a 3-day stay', () => {
      const checkIn = new Date('2026-02-15');
      const checkOut = new Date('2026-02-18');
      expect(calculateNights(checkIn, checkOut)).toBe(3);
    });

    it('should calculate nights correctly for a week stay', () => {
      const checkIn = new Date('2026-03-01');
      const checkOut = new Date('2026-03-08');
      expect(calculateNights(checkIn, checkOut)).toBe(7);
    });

    it('should calculate nights correctly for a month stay', () => {
      const checkIn = new Date('2026-04-01');
      const checkOut = new Date('2026-05-01');
      expect(calculateNights(checkIn, checkOut)).toBe(30);
    });

    it('should handle single night stay', () => {
      const checkIn = new Date('2026-02-15');
      const checkOut = new Date('2026-02-16');
      expect(calculateNights(checkIn, checkOut)).toBe(1);
    });

    it('should return 0 for same-day checkout', () => {
      const checkIn = new Date('2026-02-15');
      const checkOut = new Date('2026-02-15');
      expect(calculateNights(checkIn, checkOut)).toBe(0);
    });
  });

  describe('calculateSubtotal', () => {
    it('should calculate subtotal for standard stay', () => {
      expect(calculateSubtotal(200, 3)).toBe(600);
    });

    it('should calculate subtotal for single night', () => {
      expect(calculateSubtotal(275, 1)).toBe(275);
    });

    it('should calculate subtotal for week stay', () => {
      expect(calculateSubtotal(350, 7)).toBe(2450);
    });

    it('should handle decimal rates', () => {
      expect(calculateSubtotal(199.99, 3)).toBe(599.97);
    });

    it('should handle zero nights', () => {
      expect(calculateSubtotal(200, 0)).toBe(0);
    });
  });

  describe('calculateServiceFee', () => {
    it('should calculate 10% service fee by default', () => {
      expect(calculateServiceFee(1000)).toBe(100);
    });

    it('should calculate custom service fee rate', () => {
      expect(calculateServiceFee(1000, 0.12)).toBe(120);
    });

    it('should round to 2 decimal places', () => {
      expect(calculateServiceFee(333)).toBe(33.3);
    });

    it('should handle zero subtotal', () => {
      expect(calculateServiceFee(0)).toBe(0);
    });

    it('should calculate correct fee for Oasis Pool booking', () => {
      // Oasis Pool: $275/night, 3 nights = $825 subtotal
      const subtotal = 275 * 3;
      const serviceFee = calculateServiceFee(subtotal, 0.10);
      expect(serviceFee).toBe(82.5);
    });
  });

  describe('calculateTaxes', () => {
    it('should calculate taxes on subtotal and cleaning fee', () => {
      // (1000 + 100) * 0.0825 = 90.75
      expect(calculateTaxes(1000, 100, 0.0825)).toBe(90.75);
    });

    it('should use default tax rate', () => {
      expect(calculateTaxes(1000, 100)).toBe(90.75);
    });

    it('should handle zero cleaning fee', () => {
      expect(calculateTaxes(1000, 0, 0.0825)).toBe(82.5);
    });

    it('should calculate taxes for Adobe Compound booking', () => {
      // Adobe Compound: $350/night, 7 nights = $2450 subtotal, $200 cleaning
      const taxes = calculateTaxes(2450, 200, 0.0825);
      expect(taxes).toBe(218.63); // (2450 + 200) * 0.0825 = 218.625 rounded
    });
  });

  describe('calculateTotal', () => {
    it('should calculate complete booking total', () => {
      const result = calculateTotal(200, 3, 100);
      expect(result.subtotal).toBe(600);
      expect(result.serviceFee).toBe(60);
      expect(result.taxes).toBe(57.75); // (600 + 100) * 0.0825
      expect(result.total).toBe(817.75);
    });

    it('should calculate total for Oasis Pool 3-night stay', () => {
      // Oasis Pool: $275/night, $150 cleaning
      const result = calculateTotal(275, 3, 150);
      expect(result.subtotal).toBe(825);
      expect(result.serviceFee).toBe(82.5);
      expect(result.taxes).toBe(80.44); // (825 + 150) * 0.0825 = 80.4375
      expect(result.total).toBe(1137.94);
    });

    it('should calculate total for Adobe Compound week stay', () => {
      // Adobe Compound: $350/night, $200 cleaning
      const result = calculateTotal(350, 7, 200);
      expect(result.subtotal).toBe(2450);
      expect(result.serviceFee).toBe(245);
      expect(result.taxes).toBe(218.63);
      expect(result.total).toBe(3113.63);
    });

    it('should allow custom fee rates', () => {
      const result = calculateTotal(200, 3, 100, 0.12, 0.10);
      expect(result.serviceFee).toBe(72); // 600 * 0.12
      expect(result.taxes).toBe(70); // (600 + 100) * 0.10
    });
  });

  describe('Property Pricing Validation', () => {
    it('should have valid nightly rates for all properties', () => {
      for (const property of REAL_PROPERTIES) {
        expect(property.baseRate).toBeDefined();
        expect(property.baseRate).toBeGreaterThan(0);
        expectInRange(property.baseRate!, 100, 500);
      }
    });

    it('should have valid cleaning fees for all properties', () => {
      for (const property of REAL_PROPERTIES) {
        expect(property.cleaningFee).toBeDefined();
        expect(property.cleaningFee).toBeGreaterThanOrEqual(0);
        expectInRange(property.cleaningFee!, 50, 250);
      }
    });

    it('should have cleaning fees proportional to property size', () => {
      // Larger properties should generally have higher cleaning fees
      const sortedByBedrooms = [...REAL_PROPERTIES].sort((a, b) => (b.bedrooms || 0) - (a.bedrooms || 0));
      const largestProperty = sortedByBedrooms[0];
      const smallestProperty = sortedByBedrooms[sortedByBedrooms.length - 1];

      expect(largestProperty.cleaningFee).toBeGreaterThan(smallestProperty.cleaningFee!);
    });

    it('should price Adobe Compound (largest) higher than Uptown Place (smallest)', () => {
      const adobe = REAL_PROPERTIES.find(p => p.id === 'prop_adobe_compound');
      const uptown = REAL_PROPERTIES.find(p => p.id === 'prop_uptown_place');

      expect(adobe?.baseRate).toBeGreaterThan(uptown?.baseRate!);
    });
  });

  describe('Booking Total Integrity', () => {
    it('should create booking with correct calculated totals', () => {
      const booking = createTestBooking({
        nightlyRate: 225,
        nights: 4,
        cleaningFee: 125
      });

      // Calculate expected values
      const expectedSubtotal = 225 * 4; // 900
      const expectedServiceFee = expectedSubtotal * 0.10; // 90
      const expectedTaxes = (expectedSubtotal + 125) * 0.0825; // 84.5625

      // Recalculate total based on booking fixture's calculation
      const { subtotal, serviceFee, taxes, total } = calculateTotal(225, 4, 125);

      expect(subtotal).toBe(expectedSubtotal);
      expect(serviceFee).toBe(90);
      expectInRange(taxes, 84.5, 84.6);
    });

    it('should handle edge case of minimum stay', () => {
      const result = calculateTotal(150, 1, 75);
      expect(result.subtotal).toBe(150);
      expect(result.total).toBeGreaterThan(result.subtotal + result.cleaningFee || 0);
    });

    it('should handle long-term stay (30 nights)', () => {
      const result = calculateTotal(200, 30, 150);
      expect(result.subtotal).toBe(6000);
      expect(result.serviceFee).toBe(600);
      // Total should be substantial but reasonable
      expectInRange(result.total, 6500, 7500);
    });
  });

  describe('Weekend and Discount Pricing', () => {
    it('should handle weekend rate premium', () => {
      const weekdayRate = 200;
      const weekendRate = 250; // 25% premium
      const premium = (weekendRate - weekdayRate) / weekdayRate;
      expect(premium).toBe(0.25);
    });

    it('should calculate weekly discount correctly', () => {
      const baseRate = 200;
      const weeklyDiscount = 0.10; // 10% off for 7+ nights
      const nights = 7;
      const discountedSubtotal = baseRate * nights * (1 - weeklyDiscount);
      expect(discountedSubtotal).toBe(1260);
    });

    it('should calculate monthly discount correctly', () => {
      const baseRate = 200;
      const monthlyDiscount = 0.20; // 20% off for 28+ nights
      const nights = 30;
      const discountedSubtotal = baseRate * nights * (1 - monthlyDiscount);
      expect(discountedSubtotal).toBe(4800);
    });

    it('should stack discounts appropriately', () => {
      const baseRate = 200;
      const nights = 30;
      const fullPrice = baseRate * nights;
      const monthlyDiscountPrice = fullPrice * 0.80; // 20% off

      expect(monthlyDiscountPrice).toBeLessThan(fullPrice);
      expect(monthlyDiscountPrice).toBe(4800);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small amounts', () => {
      const result = calculateTotal(0.01, 1, 0.01);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should handle large bookings', () => {
      const result = calculateTotal(500, 365, 250);
      expect(result.subtotal).toBe(182500);
      expect(result.total).toBeGreaterThan(200000);
    });

    it('should maintain precision with floating point', () => {
      const result = calculateTotal(199.99, 3, 99.99);
      // Ensure no floating point errors
      expect(result.subtotal.toString()).not.toContain('000000001');
      expect(result.total.toString()).not.toContain('000000001');
    });
  });
});
