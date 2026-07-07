/**
 * GET /api/listings — Public VRBO-synced property listings catalog.
 * Alias used by external integrations and smoke tests.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PROPERTIES } from '@/lib/property-data';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const vrboId = params.get('vrboId');
    const status = params.get('status') ?? 'ACTIVE';

    // Try database first (VRBO-scraped cache), fall back to static property data
    try {
      const dbProperties = await prisma.property.findMany({
        where: {
          status: status === 'all' ? undefined : status,
          ...(vrboId ? { vrboId } : {}),
        },
        include: {
          vrboSync: true,
          photos: { where: { isPrimary: true }, take: 1 },
        },
        orderBy: { name: 'asc' },
      });

      if (dbProperties.length > 0) {
        const listings = dbProperties.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          city: p.city,
          state: p.state,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          maxGuests: p.maxGuests,
          nightlyRate: p.nightlyRate,
          amenities: p.amenities ? JSON.parse(p.amenities) : [],
          vrboId: p.vrboId,
          vrboUrl: p.vrboId ? `https://www.vrbo.com/${p.vrboId}` : null,
          icalUrl: p.vrboSync?.icalUrl ?? null,
          lastScrapeSync: p.vrboSync?.lastScrapeSync ?? null,
          lastIcalSync: p.vrboSync?.lastIcalSync ?? null,
          primaryPhoto: p.photos[0]?.url ?? null,
          status: p.status,
        }));

        return NextResponse.json({ listings, total: listings.length, source: 'database' });
      }
    } catch {
      // DATABASE_URL may be unset in dev — fall through to static data
    }

    let filtered = PROPERTIES.filter((p) =>
      status === 'all' ? true : p.status === status
    );
    if (vrboId) {
      filtered = filtered.filter((p) => p.vrboId === vrboId);
    }

    const listings = filtered.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      state: p.state,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      maxGuests: p.sleeps,
      nightlyRate: p.nightlyRate,
      amenities: p.amenities,
      vrboId: p.vrboId,
      vrboUrl: p.vrboUrl,
      status: p.status,
    }));

    return NextResponse.json({ listings, total: listings.length, source: 'static' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to list properties', detail: message }, { status: 500 });
  }
}