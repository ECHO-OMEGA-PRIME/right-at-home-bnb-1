import { describe, expect, it } from 'vitest';

import {
  buildBookingConflicts,
  summarizePortfolioAvailability,
} from '@/lib/booking-availability';

const now = new Date('2026-08-09T20:00:00.000Z');

describe('booking availability', () => {
  it('finds reservation conflicts, treats checkout as exclusive, and permits block-on-block overlap', () => {
    const conflicts = buildBookingConflicts([
      {
        id: 'reservation-a',
        propertyId: 'property-a',
        checkIn: new Date('2026-08-10T00:00:00.000Z'),
        checkOut: new Date('2026-08-13T00:00:00.000Z'),
        platform: 'VRBO',
        status: 'CONFIRMED',
      },
      {
        id: 'block-a',
        propertyId: 'property-a',
        checkIn: new Date('2026-08-12T00:00:00.000Z'),
        checkOut: new Date('2026-08-14T00:00:00.000Z'),
        platform: 'DIRECT',
        status: 'BLOCKED',
      },
      {
        id: 'adjacent-a',
        propertyId: 'property-a',
        checkIn: new Date('2026-08-14T00:00:00.000Z'),
        checkOut: new Date('2026-08-16T00:00:00.000Z'),
        platform: 'VRBO',
        status: 'CONFIRMED',
      },
      {
        id: 'block-b',
        propertyId: 'property-b',
        checkIn: new Date('2026-08-10T00:00:00.000Z'),
        checkOut: new Date('2026-08-14T00:00:00.000Z'),
        platform: 'DIRECT',
        status: 'BLOCKED',
      },
      {
        id: 'block-c',
        propertyId: 'property-b',
        checkIn: new Date('2026-08-11T00:00:00.000Z'),
        checkOut: new Date('2026-08-12T00:00:00.000Z'),
        platform: 'DIRECT',
        status: 'BLOCKED',
      },
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      propertyId: 'property-a',
      booking1Id: 'reservation-a',
      booking2Id: 'block-a',
    });
  });

  it('builds a PII-free live portfolio with occupancy, next stay, conflicts, and sync freshness', () => {
    const properties = [
      {
        id: 'property-a',
        slug: 'alpha-house',
        name: 'Alpha House',
        address: '100 Example Street',
        vrboSync: {
          syncEnabled: true,
          lastIcalSync: new Date('2026-08-09T19:55:00.000Z'),
        },
      },
      {
        id: 'property-b',
        slug: 'bravo-house',
        name: 'Bravo House',
        address: '200 Example Street',
        vrboSync: {
          syncEnabled: true,
          lastIcalSync: new Date('2026-08-09T18:00:00.000Z'),
        },
      },
      {
        id: 'property-c',
        slug: 'charlie-house',
        name: 'Charlie House',
        address: '300 Example Street',
        vrboSync: null,
      },
    ];
    const bookings = [
      {
        id: 'current-a',
        propertyId: 'property-a',
        checkIn: new Date('2026-08-08T20:00:00.000Z'),
        checkOut: new Date('2026-08-11T20:00:00.000Z'),
        platform: 'VRBO',
        status: 'CHECKED_IN',
      },
      {
        id: 'next-a',
        propertyId: 'property-a',
        checkIn: new Date('2026-08-14T20:00:00.000Z'),
        checkOut: new Date('2026-08-16T20:00:00.000Z'),
        platform: 'VRBO',
        status: 'CONFIRMED',
      },
      {
        id: 'block-b',
        propertyId: 'property-b',
        checkIn: new Date('2026-08-09T19:00:00.000Z'),
        checkOut: new Date('2026-08-10T20:00:00.000Z'),
        platform: 'DIRECT',
        status: 'BLOCKED',
      },
      {
        id: 'conflict-b',
        propertyId: 'property-b',
        checkIn: new Date('2026-08-10T00:00:00.000Z'),
        checkOut: new Date('2026-08-12T20:00:00.000Z'),
        platform: 'VRBO',
        status: 'CONFIRMED',
      },
    ];

    const result = summarizePortfolioAvailability({ properties, bookings, now });

    expect(result.summary).toEqual({
      total: 3,
      occupied: 1,
      blocked: 1,
      available: 1,
      conflicts: 1,
      staleSources: 2,
    });
    expect(result.properties[0]).toMatchObject({
      propertyId: 'property-a',
      slug: 'alpha-house',
      availability: 'occupied',
      sourceState: 'fresh',
      conflictCount: 0,
      currentStay: { platform: 'VRBO' },
      nextStay: { platform: 'VRBO' },
    });
    expect(result.properties[1]).toMatchObject({
      availability: 'blocked',
      sourceState: 'stale',
      conflictCount: 1,
    });
    expect(result.properties[2]).toMatchObject({
      availability: 'available',
      sourceState: 'missing',
    });
    expect(JSON.stringify(result)).not.toMatch(/guest|email|phone/i);
  });
});
