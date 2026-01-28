/**
 * Right at Home BnB - Dynamic Pricing Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockElectronAPI, mockStore } from '../setup';

describe('Dynamic Pricing Service', () => {
  let pricingService: typeof import('@renderer/services/pricing');

  beforeEach(async () => {
    vi.resetModules();
    mockStore.clear();

    // Dynamic import to get fresh instance
    pricingService = await import('@renderer/services/pricing');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Base Price Calculation', () => {
    it('should calculate base price for property', () => {
      const property = {
        id: 'prop-123',
        basePrice: 150,
        minPrice: 100,
        maxPrice: 300,
        bedrooms: 2,
        bathrooms: 1,
        amenities: ['wifi', 'pool', 'kitchen'],
      };

      const basePrice = pricingService.getBasePrice(property);

      expect(basePrice).toBe(150);
    });

    it('should apply minimum price constraint', () => {
      const property = {
        basePrice: 80,
        minPrice: 100,
        maxPrice: 300,
      };

      const calculatedPrice = pricingService.calculatePrice(property, new Date());

      expect(calculatedPrice).toBeGreaterThanOrEqual(100);
    });

    it('should apply maximum price constraint', () => {
      const property = {
        basePrice: 150,
        minPrice: 100,
        maxPrice: 300,
      };

      // Even with all multipliers, should not exceed max
      const calculatedPrice = pricingService.calculatePrice(
        property,
        new Date('2024-12-31'), // New Year's Eve
        { demandMultiplier: 3.0 }
      );

      expect(calculatedPrice).toBeLessThanOrEqual(300);
    });
  });

  describe('Seasonal Adjustments', () => {
    it('should apply summer season multiplier', () => {
      const basePrice = 100;

      const summerMultiplier = pricingService.getSeasonalMultiplier(new Date('2024-07-15'));

      // Summer should have higher multiplier
      expect(summerMultiplier).toBeGreaterThan(1);
    });

    it('should apply off-season multiplier', () => {
      const basePrice = 100;

      const offSeasonMultiplier = pricingService.getSeasonalMultiplier(new Date('2024-02-15'));

      // Off-season should have lower or equal multiplier
      expect(offSeasonMultiplier).toBeLessThanOrEqual(1);
    });

    it('should identify holiday periods', () => {
      expect(pricingService.isHolidayPeriod(new Date('2024-12-25'))).toBe(true);
      expect(pricingService.isHolidayPeriod(new Date('2024-07-04'))).toBe(true);
      expect(pricingService.isHolidayPeriod(new Date('2024-11-28'))).toBe(true); // Thanksgiving
      expect(pricingService.isHolidayPeriod(new Date('2024-03-15'))).toBe(false);
    });

    it('should apply holiday premium', () => {
      const property = {
        basePrice: 150,
        minPrice: 100,
        maxPrice: 500,
      };

      const regularPrice = pricingService.calculatePrice(property, new Date('2024-03-15'));
      const holidayPrice = pricingService.calculatePrice(property, new Date('2024-12-25'));

      expect(holidayPrice).toBeGreaterThan(regularPrice);
    });
  });

  describe('Day of Week Adjustments', () => {
    it('should apply weekend premium', () => {
      const baseMultiplier = pricingService.getDayOfWeekMultiplier(new Date('2024-01-15')); // Monday
      const weekendMultiplier = pricingService.getDayOfWeekMultiplier(new Date('2024-01-20')); // Saturday

      expect(weekendMultiplier).toBeGreaterThan(baseMultiplier);
    });

    it('should identify weekends correctly', () => {
      expect(pricingService.isWeekend(new Date('2024-01-20'))).toBe(true); // Saturday
      expect(pricingService.isWeekend(new Date('2024-01-21'))).toBe(true); // Sunday
      expect(pricingService.isWeekend(new Date('2024-01-15'))).toBe(false); // Monday
    });
  });

  describe('Demand-Based Pricing', () => {
    it('should increase price with high demand', () => {
      const property = {
        basePrice: 150,
        minPrice: 100,
        maxPrice: 300,
      };

      const lowDemandPrice = pricingService.calculatePrice(property, new Date(), {
        demandMultiplier: 0.8,
      });

      const highDemandPrice = pricingService.calculatePrice(property, new Date(), {
        demandMultiplier: 1.5,
      });

      expect(highDemandPrice).toBeGreaterThan(lowDemandPrice);
    });

    it('should calculate demand from occupancy rate', () => {
      const highOccupancy = { bookedNights: 25, totalNights: 30 };
      const lowOccupancy = { bookedNights: 10, totalNights: 30 };

      const highDemand = pricingService.calculateDemandMultiplier(highOccupancy);
      const lowDemand = pricingService.calculateDemandMultiplier(lowOccupancy);

      expect(highDemand).toBeGreaterThan(lowDemand);
    });
  });

  describe('Length of Stay Discounts', () => {
    it('should apply weekly discount', () => {
      const property = {
        basePrice: 100,
        weeklyDiscount: 0.1, // 10% discount
      };

      const weeklyRate = pricingService.calculateTotalWithDiscount(property, 7);
      const dailyTotal = 100 * 7;

      expect(weeklyRate).toBe(dailyTotal * 0.9);
    });

    it('should apply monthly discount', () => {
      const property = {
        basePrice: 100,
        monthlyDiscount: 0.2, // 20% discount
      };

      const monthlyRate = pricingService.calculateTotalWithDiscount(property, 30);
      const dailyTotal = 100 * 30;

      expect(monthlyRate).toBe(dailyTotal * 0.8);
    });

    it('should not apply discount for short stays', () => {
      const property = {
        basePrice: 100,
        weeklyDiscount: 0.1,
        monthlyDiscount: 0.2,
      };

      const shortStayRate = pricingService.calculateTotalWithDiscount(property, 3);

      expect(shortStayRate).toBe(100 * 3);
    });
  });

  describe('Last Minute Pricing', () => {
    it('should apply last minute discount for gaps', () => {
      const property = {
        basePrice: 150,
        minPrice: 100,
        maxPrice: 300,
      };

      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 1); // Tomorrow

      const lastMinutePrice = pricingService.calculateLastMinutePrice(property, checkIn);

      expect(lastMinutePrice).toBeLessThan(150);
      expect(lastMinutePrice).toBeGreaterThanOrEqual(100);
    });

    it('should not apply discount for bookings far in advance', () => {
      const property = {
        basePrice: 150,
        minPrice: 100,
        maxPrice: 300,
      };

      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 30); // 30 days out

      const advancePrice = pricingService.calculateLastMinutePrice(property, checkIn);

      expect(advancePrice).toBe(150);
    });
  });

  describe('Competitor Analysis', () => {
    it('should adjust price based on competitors', () => {
      const property = {
        basePrice: 150,
        minPrice: 100,
        maxPrice: 300,
      };

      const competitorPrices = [120, 140, 160, 180];

      const adjustedPrice = pricingService.adjustForCompetition(property, competitorPrices);

      // Should be competitive but not lowest
      expect(adjustedPrice).toBeGreaterThan(100);
      expect(adjustedPrice).toBeLessThan(200);
    });

    it('should calculate market position', () => {
      const ourPrice = 150;
      const competitorPrices = [120, 140, 160, 180, 200];

      const position = pricingService.calculateMarketPosition(ourPrice, competitorPrices);

      // 150 is in the middle of the range
      expect(position).toBeGreaterThan(0);
      expect(position).toBeLessThan(1);
    });
  });

  describe('Price Recommendations', () => {
    it('should generate price recommendation', () => {
      const property = {
        id: 'prop-123',
        basePrice: 150,
        minPrice: 100,
        maxPrice: 300,
      };

      const date = new Date('2024-07-15');

      const recommendation = pricingService.generateRecommendation(property, date);

      expect(recommendation).toBeDefined();
      expect(recommendation.suggestedPrice).toBeDefined();
      expect(recommendation.factors).toBeDefined();
      expect(recommendation.confidence).toBeGreaterThan(0);
    });

    it('should explain pricing factors', () => {
      const property = {
        basePrice: 150,
        minPrice: 100,
        maxPrice: 300,
      };

      const date = new Date('2024-12-25'); // Christmas

      const recommendation = pricingService.generateRecommendation(property, date);

      expect(recommendation.factors).toContain('Holiday premium');
    });
  });

  describe('Revenue Optimization', () => {
    it('should calculate optimal price for revenue', () => {
      const property = {
        basePrice: 150,
        minPrice: 100,
        maxPrice: 300,
      };

      const historicalData = [
        { price: 100, occupancy: 0.95 },
        { price: 150, occupancy: 0.75 },
        { price: 200, occupancy: 0.50 },
        { price: 250, occupancy: 0.25 },
      ];

      const optimalPrice = pricingService.calculateOptimalPrice(property, historicalData);

      // Optimal should maximize revenue (price * occupancy)
      expect(optimalPrice).toBeGreaterThanOrEqual(100);
      expect(optimalPrice).toBeLessThanOrEqual(200);
    });

    it('should calculate expected revenue', () => {
      const price = 150;
      const occupancyRate = 0.75;
      const nights = 30;

      const expectedRevenue = pricingService.calculateExpectedRevenue(price, occupancyRate, nights);

      expect(expectedRevenue).toBe(150 * 0.75 * 30);
    });
  });
});
