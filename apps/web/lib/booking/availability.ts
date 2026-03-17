/**
 * Right at Home BnB - Availability Engine
 * Checks property availability, manages date holds, and generates calendars.
 * All date comparisons use start-of-day normalization.
 */

import prisma from '../../src/lib/prisma';
import { addDays, startOfDay, dateRangesOverlap } from '../utils/dates';

export interface AvailabilityResult {
  available: boolean;
  conflicts: Array<{
    id: string;
    guestName: string;
    checkIn: Date;
    checkOut: Date;
    status: string;
  }>;
}

export interface DayAvailability {
  date: string;
  available: boolean;
}

/**
 * Check if a property is available for a given date range.
 * Returns availability status and any conflicting bookings.
 * A booking conflicts if its date range overlaps with the requested range
 * and its status is not CANCELLED.
 */
export async function checkAvailability(
  propertyId: string,
  checkIn: Date,
  checkOut: Date
): Promise<AvailabilityResult> {
  const ciStart = startOfDay(checkIn);
  const coStart = startOfDay(checkOut);

  // Find bookings that overlap: existing.checkIn < requestedCheckOut AND existing.checkOut > requestedCheckIn
  const overlapping = await prisma.booking.findMany({
    where: {
      propertyId,
      status: { notIn: ['CANCELLED', 'DECLINED'] },
      checkIn: { lt: coStart },
      checkOut: { gt: ciStart },
    },
    include: {
      guest: { select: { name: true } },
    },
    orderBy: { checkIn: 'asc' },
  });

  // Also check holds (temporary blocks stored in Setting with key pattern hold:*)
  const holdKey = `hold:${propertyId}`;
  const activeHolds = await prisma.setting.findMany({
    where: {
      key: { startsWith: holdKey },
    },
  });

  const holdConflicts: AvailabilityResult['conflicts'] = [];
  for (const hold of activeHolds) {
    try {
      const holdData = JSON.parse(hold.value) as {
        checkIn: string;
        checkOut: string;
        expiresAt: string;
      };
      const holdExpiry = new Date(holdData.expiresAt);
      if (holdExpiry < new Date()) {
        // Expired hold, clean up in background
        prisma.setting.delete({ where: { id: hold.id } }).catch(() => {});
        continue;
      }
      const holdRange = {
        start: startOfDay(new Date(holdData.checkIn)),
        end: startOfDay(new Date(holdData.checkOut)),
      };
      const requestRange = { start: ciStart, end: coStart };
      if (dateRangesOverlap(holdRange, requestRange)) {
        holdConflicts.push({
          id: hold.id,
          guestName: '[Date Hold]',
          checkIn: holdRange.start,
          checkOut: holdRange.end,
          status: 'HOLD',
        });
      }
    } catch {
      // Malformed hold data, skip
    }
  }

  const bookingConflicts = overlapping.map((b) => ({
    id: b.id,
    guestName: b.guest.name,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    status: b.status,
  }));

  const allConflicts = [...bookingConflicts, ...holdConflicts];

  return {
    available: allConflicts.length === 0,
    conflicts: allConflicts,
  };
}

/**
 * Get availability for each day of a given month plus surrounding days (42 days total).
 * Returns an array of {date: "YYYY-MM-DD", available: boolean}.
 * A day is unavailable if any confirmed/pending booking occupies that night.
 */
export async function getAvailableDates(
  propertyId: string,
  month: Date
): Promise<DayAvailability[]> {
  // Start from the first day of the month, go back to the previous Sunday
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const dayOfWeek = firstOfMonth.getDay();
  const calendarStart = addDays(firstOfMonth, -dayOfWeek);
  const calendarEnd = addDays(calendarStart, 42);

  // Fetch all bookings that overlap this 42-day window
  const bookings = await prisma.booking.findMany({
    where: {
      propertyId,
      status: { notIn: ['CANCELLED', 'DECLINED'] },
      checkIn: { lt: calendarEnd },
      checkOut: { gt: calendarStart },
    },
    select: {
      checkIn: true,
      checkOut: true,
    },
  });

  // Build the occupied nights set
  const occupiedDates = new Set<string>();
  for (const booking of bookings) {
    let current = startOfDay(booking.checkIn);
    const end = startOfDay(booking.checkOut);
    while (current < end) {
      occupiedDates.add(current.toISOString().split('T')[0]);
      current = addDays(current, 1);
    }
  }

  // Also check holds
  const holdKey = `hold:${propertyId}`;
  const activeHolds = await prisma.setting.findMany({
    where: { key: { startsWith: holdKey } },
  });
  for (const hold of activeHolds) {
    try {
      const holdData = JSON.parse(hold.value) as {
        checkIn: string;
        checkOut: string;
        expiresAt: string;
      };
      if (new Date(holdData.expiresAt) < new Date()) continue;
      let current = startOfDay(new Date(holdData.checkIn));
      const end = startOfDay(new Date(holdData.checkOut));
      while (current < end) {
        occupiedDates.add(current.toISOString().split('T')[0]);
        current = addDays(current, 1);
      }
    } catch {
      // Skip malformed holds
    }
  }

  // Generate the 42-day calendar
  const result: DayAvailability[] = [];
  for (let i = 0; i < 42; i++) {
    const day = addDays(calendarStart, i);
    const dateStr = day.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      available: !occupiedDates.has(dateStr),
    });
  }

  return result;
}

/**
 * Create a temporary date hold for a property.
 * Used during the booking checkout flow to prevent double-booking.
 * Returns a hold ID that can be used to release the hold.
 */
export async function holdDates(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  holdMinutes: number = 15
): Promise<string> {
  // First verify the dates are actually available
  const { available } = await checkAvailability(propertyId, checkIn, checkOut);
  if (!available) {
    throw new Error('Dates are not available for hold');
  }

  const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
  const holdId = `hold:${propertyId}:${Date.now()}`;

  await prisma.setting.create({
    data: {
      key: holdId,
      value: JSON.stringify({
        propertyId,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      }),
      description: `Date hold for property ${propertyId}`,
    },
  });

  return holdId;
}

/**
 * Release a previously created date hold.
 */
export async function releaseHold(holdId: string): Promise<void> {
  await prisma.setting.deleteMany({
    where: { key: holdId },
  });
}
