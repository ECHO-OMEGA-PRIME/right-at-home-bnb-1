import { beforeEach, describe, expect, it, vi } from 'vitest';

const { propertyFindMany } = vi.hoisted(() => ({ propertyFindMany: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: { property: { findMany: propertyFindMany } },
}));

import { GET } from '../../../app/api/properties/route';

function request(query = '') {
  return { nextUrl: new URL(`https://rah-midland.com/api/properties${query}`) } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  propertyFindMany.mockResolvedValue([
    {
      id: 'database-property-id',
      slug: null,
      vrboId: '2636389',
      name: 'Oasis with Pool & Billiards',
      address: 'Public listing address',
      city: 'Midland',
      state: 'TX',
      zipCode: '79705',
      bedrooms: 4,
      bathrooms: 3,
      maxGuests: 10,
      propertyType: 'HOUSE',
      amenities: '["Private Pool","Free WiFi"]',
      nightlyRate: 250,
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ]);
});

describe('GET /api/properties canonical identity', () => {
  it('uses the database id while preserving the public listing slug', async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.properties[0]).toMatchObject({
      id: 'database-property-id',
      databaseId: 'database-property-id',
      slug: 'castleford-5001',
      vrboId: '2636389',
    });
    expect(body.data).toEqual(body.properties);
  });

  it('resolves a marketing slug to the canonical database property', async () => {
    const response = await GET(request('?id=castleford-5001'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: 'database-property-id', slug: 'castleford-5001' });
  });
});
