import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireOneOfRoles, bookingFindMany, propertyFindMany } = vi.hoisted(() => ({
  requireOneOfRoles: vi.fn(),
  bookingFindMany: vi.fn(),
  propertyFindMany: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({ requireOneOfRoles }));
vi.mock('@/lib/prisma', () => {
  const prisma = {
    booking: { findMany: bookingFindMany },
    property: { findMany: propertyFindMany },
  };
  return { prisma, default: prisma };
});

import { GET as getCalendar } from '../../../app/api/bookings/calendar/route';
import { GET as getConflicts } from '../../../app/api/bookings/conflicts/route';

function request(path: string) {
  return { nextUrl: new URL(`https://rah-midland.com${path}`) } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOneOfRoles.mockResolvedValue({
    user: { uid: 'owner-1', role: 'owner', email: 'owner@example.test' },
    error: null,
  });
  propertyFindMany.mockResolvedValue([
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
  ]);
});

describe('GET /api/bookings/conflicts', () => {
  it('returns real active overlaps without guest PII and permits block-on-block overlap', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: 'reservation', propertyId: 'property-a', platform: 'VRBO', status: 'CONFIRMED',
        checkIn: new Date('2026-08-10T00:00:00.000Z'), checkOut: new Date('2026-08-13T00:00:00.000Z'),
      },
      {
        id: 'block', propertyId: 'property-a', platform: 'DIRECT', status: 'BLOCKED',
        checkIn: new Date('2026-08-12T00:00:00.000Z'), checkOut: new Date('2026-08-14T00:00:00.000Z'),
      },
    ]);

    const response = await getConflicts(request('/api/bookings/conflicts'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ booking1Id: 'reservation', booking2Id: 'block' });
    expect(JSON.stringify(body)).not.toMatch(/guest|email|phone/i);
  });
});

describe('GET /api/bookings/calendar', () => {
  it('uses the imported database mirror and reports source freshness without guessing VRBO URLs', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: 'reservation', propertyId: 'property-a', platform: 'VRBO', status: 'CONFIRMED',
        checkIn: new Date('2026-08-10T00:00:00.000Z'), checkOut: new Date('2026-08-13T00:00:00.000Z'),
        guestCount: 2, confirmCode: 'SAFE-REF', totalPrice: 500,
        property: { id: 'property-a', name: 'Alpha House' },
        guest: { name: 'Authorized Owner View' },
      },
    ]);
    const networkFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network must not be used'));

    const response = await getCalendar(request('/api/bookings/calendar?month=8&year=2026'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(networkFetch).not.toHaveBeenCalled();
    expect(body.events).toHaveLength(1);
    expect(body.properties[0]).toMatchObject({ id: 'property-a', slug: 'alpha-house' });
    expect(body.sources).toMatchObject({ database: 1, configured: 1 });
    expect(body.sources.freshness).toBeDefined();
    networkFetch.mockRestore();
  });

  it('fails closed when the database mirror is unavailable', async () => {
    propertyFindMany.mockRejectedValue(new Error('database unavailable'));

    const response = await getCalendar(request('/api/bookings/calendar?month=8&year=2026'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ code: 'CALENDAR_UNAVAILABLE' });
    expect(body.events).toBeUndefined();
  });
});
