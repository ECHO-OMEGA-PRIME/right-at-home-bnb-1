/**
 * Right at Home BnB - Dynamic Pricing Engine
 * Calculates booking prices with seasonal rates, length discounts,
 * gap-night discounts, cleaning fees, pet fees, and occupancy taxes.
 * All monetary values in integer cents.
 */

import prisma from '../prisma';
import { nightsBetween, addDays, startOfDay } from '../utils/dates';
import { toCents, addCents, multiplyCents, percentOf } from '../utils/money';

// ============================================
// TYPES
// ============================================

export interface PriceBreakdown {
  nights: number;
  baseRateCents: number;
  seasonalMultiplier: number;
  lengthDiscount: number;
  subtotalCents: number;
  cleaningFeeCents: number;
  petFeeCents: number;
  occupancyTaxCents: number;
  stripeFeeEstimateCents: number;
  totalCents: number;
}

export interface PricingParams {
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  numGuests: number;
  petFee?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

/** Midland, TX Hotel Occupancy Tax: 7% state + 6% city = 13% */
const OCCUPANCY_TAX_RATE = 0.13;

/** Stripe processing fee: 2.9% + 30 cents */
const STRIPE_PERCENT = 2.9;
const STRIPE_FLAT_CENTS = 30;

/** Standard pet fee in cents */
const DEFAULT_PET_FEE_CENTS = 5000; // $50.00

// ============================================
// SEASONAL MULTIPLIER
// ============================================

/**
 * Get the seasonal pricing multiplier for a given date.
 * Midland, TX is driven by oil & gas activity + Permian Basin events.
 *
 * Peak season (1.25x): March-May (spring break + conferences), September-November (industry events)
 * Shoulder season (1.0x): June-August, December
 * Off-season (0.85x): January-February
 * Special dates get additional multipliers.
 */
export function getSeasonalMultiplier(date: Date): number {
  const month = date.getMonth(); // 0-indexed

  // Check for special events/holidays
  const monthDay = `${month + 1}-${date.getDate()}`;

  // Permian Basin International Oil Show (mid-October, biennial), UT Permian homecoming, etc.
  const specialDates: Record<string, number> = {
    '12-24': 1.40, // Christmas Eve
    '12-25': 1.40, // Christmas
    '12-31': 1.50, // New Year's Eve
    '1-1': 1.40,   // New Year's Day
    '7-4': 1.35,   // Independence Day
    '11-27': 1.30, // Thanksgiving (approx)
    '11-28': 1.30, // Black Friday
  };

  if (specialDates[monthDay]) {
    return specialDates[monthDay];
  }

  // Seasonal rates by month
  switch (month) {
    case 0: // January
    case 1: // February
      return 0.85; // Off-season
    case 2: // March
    case 3: // April
    case 4: // May
      return 1.25; // Peak: spring conferences
    case 5: // June
    case 6: // July
    case 7: // August
      return 1.0; // Shoulder: hot summer
    case 8: // September
    case 9: // October
    case 10: // November
      return 1.25; // Peak: fall industry season
    case 11: // December
      return 1.0; // Shoulder: holidays balance with slowdown
    default:
      return 1.0;
  }
}

// ============================================
// LENGTH-OF-STAY DISCOUNTS
// ============================================

/**
 * Get the discount percentage for longer stays.
 * Returns a decimal multiplier (e.g., 0.90 for 10% discount).
 */
export function getLengthDiscount(nights: number): number {
  if (nights >= 28) return 0.75; // 25% off for monthly stays
  if (nights >= 14) return 0.85; // 15% off for 2+ weeks
  if (nights >= 7) return 0.90;  // 10% off for weekly stays
  if (nights >= 4) return 0.95;  // 5% off for 4+ nights
  return 1.0; // No discount
}

// ============================================
// GAP-NIGHT DISCOUNT
// ============================================

/**
 * Calculate a gap-night discount when a booking fills a 1-2 night gap
 * between existing bookings. This incentivizes filling otherwise empty nights.
 * Returns a multiplier (e.g., 0.85 for 15% discount).
 */
export async function getGapNightDiscount(
  propertyId: string,
  checkIn: Date
): Promise<number> {
  const ciDay = startOfDay(checkIn);

  // Look for a booking that checks out on our check-in day or 1-2 days before
  const recentCheckout = await prisma.booking.findFirst({
    where: {
      propertyId,
      status: { notIn: ['CANCELLED', 'DECLINED'] },
      checkOut: {
        gte: addDays(ciDay, -2),
        lte: addDays(ciDay, 1),
      },
    },
    orderBy: { checkOut: 'desc' },
  });

  if (!recentCheckout) return 1.0;

  // Check if there's a booking starting soon after (within 1-3 days of our check-in)
  const upcomingCheckin = await prisma.booking.findFirst({
    where: {
      propertyId,
      status: { notIn: ['CANCELLED', 'DECLINED'] },
      checkIn: {
        gte: ciDay,
        lte: addDays(ciDay, 3),
      },
      id: { not: recentCheckout.id },
    },
    orderBy: { checkIn: 'asc' },
  });

  // If we're sandwiched between two bookings with a small gap, offer a discount
  if (recentCheckout && upcomingCheckin) {
    const gapDays = nightsBetween(recentCheckout.checkOut, upcomingCheckin.checkIn);
    if (gapDays <= 2) return 0.85; // 15% discount for filling a tight gap
  }

  // If there's just a recent checkout nearby, smaller discount
  const daysSinceCheckout = nightsBetween(recentCheckout.checkOut, ciDay);
  if (daysSinceCheckout <= 1) return 0.90; // 10% discount

  return 1.0;
}

// ============================================
// MAIN PRICING CALCULATOR
// ============================================

/**
 * Calculate the full price breakdown for a booking.
 * Factors in: base rate, seasonal pricing, length discounts, gap discounts,
 * cleaning fee, pet fee, occupancy tax, and estimated Stripe processing fee.
 */
export async function calculateBookingPrice(
  params: PricingParams
): Promise<PriceBreakdown> {
  const { propertyId, checkIn, checkOut, numGuests, petFee = false } = params;

  // Fetch property pricing data
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      nightlyRate: true,
      cleaningFee: true,
      maxGuests: true,
    },
  });

  if (!property) {
    throw new Error(`Property not found: ${propertyId}`);
  }

  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) {
    throw new Error('Check-out must be after check-in');
  }

  const baseRateCents = toCents(property.nightlyRate);
  const cleaningFeeCents = property.cleaningFee ? toCents(property.cleaningFee) : 0;

  // Calculate per-night rate with seasonal adjustment
  // Use the average seasonal multiplier across all nights
  let totalSeasonalMultiplier = 0;
  let currentDate = startOfDay(checkIn);
  for (let i = 0; i < nights; i++) {
    totalSeasonalMultiplier += getSeasonalMultiplier(currentDate);
    currentDate = addDays(currentDate, 1);
  }
  const avgSeasonalMultiplier = totalSeasonalMultiplier / nights;
  const roundedMultiplier = Math.round(avgSeasonalMultiplier * 100) / 100;

  // Apply seasonal multiplier
  const seasonalRateCents = multiplyCents(baseRateCents, roundedMultiplier);

  // Calculate raw subtotal (nightly rate * nights)
  const rawSubtotal = seasonalRateCents * nights;

  // Apply length-of-stay discount
  const lengthDiscountMultiplier = getLengthDiscount(nights);
  const afterLengthDiscount = multiplyCents(rawSubtotal, lengthDiscountMultiplier);

  // Apply gap-night discount
  const gapDiscountMultiplier = await getGapNightDiscount(propertyId, checkIn);
  const subtotalCents = multiplyCents(afterLengthDiscount, gapDiscountMultiplier);

  // Extra guest surcharge: $15/night per guest over the base (max guests / 2)
  const baseGuestCount = Math.max(1, Math.floor((property.maxGuests || 4) / 2));
  const extraGuests = Math.max(0, numGuests - baseGuestCount);
  const extraGuestChargeCents = extraGuests * 1500 * nights; // $15/night/guest

  // Pet fee
  const petFeeCents = petFee ? DEFAULT_PET_FEE_CENTS : 0;

  // Pre-tax subtotal
  const preTaxSubtotal = addCents(subtotalCents, extraGuestChargeCents, cleaningFeeCents, petFeeCents);

  // Occupancy tax applies to the room rate subtotal (not cleaning or pet fees)
  const taxableAmount = addCents(subtotalCents, extraGuestChargeCents);
  const occupancyTaxCents = percentOf(taxableAmount, OCCUPANCY_TAX_RATE * 100);

  // Estimated Stripe fee for transparency
  const chargeableCents = addCents(preTaxSubtotal, occupancyTaxCents);
  const stripeFeeEstimateCents = addCents(
    percentOf(chargeableCents, STRIPE_PERCENT),
    STRIPE_FLAT_CENTS
  );

  // Total = pre-tax subtotal + tax
  const totalCents = addCents(preTaxSubtotal, occupancyTaxCents);

  return {
    nights,
    baseRateCents,
    seasonalMultiplier: roundedMultiplier,
    lengthDiscount: lengthDiscountMultiplier,
    subtotalCents: addCents(subtotalCents, extraGuestChargeCents),
    cleaningFeeCents,
    petFeeCents,
    occupancyTaxCents,
    stripeFeeEstimateCents,
    totalCents,
  };
}
