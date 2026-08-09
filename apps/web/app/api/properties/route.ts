import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PROPERTIES } from '@/lib/property-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parsedAmenities(value: string | null, fallback: string[]): string[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
      ? parsed
      : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const id = params.get('id');
    const status = params.get('status');
    const minBeds = params.get('beds');
    const minBaths = params.get('baths');
    const petAllowed = params.get('pet_allowed');

    const databaseProperties = await prisma.property.findMany({
      where: status ? { status } : undefined,
      select: {
        id: true,
        slug: true,
        name: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        bedrooms: true,
        bathrooms: true,
        maxGuests: true,
        propertyType: true,
        amenities: true,
        nightlyRate: true,
        status: true,
        vrboId: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    const properties = databaseProperties.map((property) => {
      const listing = PROPERTIES.find(
        (candidate) => candidate.id === property.slug || candidate.vrboId === property.vrboId,
      );
      const slug = property.slug || listing?.id || null;
      return {
        id: property.id,
        databaseId: property.id,
        slug,
        name: property.name,
        address: property.address,
        city: property.city,
        state: property.state,
        zipCode: property.zipCode,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        maxGuests: property.maxGuests,
        propertyType: property.propertyType,
        amenities: parsedAmenities(property.amenities, listing?.amenities || []),
        nightlyRate: property.nightlyRate,
        status: property.status,
        vrboId: property.vrboId,
        createdAt: property.createdAt,
      };
    });

    if (id) {
      const property = properties.find(
        (candidate) => candidate.id === id || candidate.slug === id || candidate.vrboId === id,
      );
      if (!property) {
        return NextResponse.json(
          { error: 'Property not found', code: 'PROPERTY_NOT_FOUND' },
          { status: 404 },
        );
      }
      return NextResponse.json(property);
    }

    let filtered = properties;
    if (minBeds) {
      const beds = Number.parseInt(minBeds, 10);
      if (Number.isFinite(beds)) filtered = filtered.filter((property) => property.bedrooms >= beds);
    }
    if (minBaths) {
      const baths = Number.parseFloat(minBaths);
      if (Number.isFinite(baths)) filtered = filtered.filter((property) => property.bathrooms >= baths);
    }
    if (petAllowed === 'true') {
      filtered = filtered.filter((property) =>
        property.amenities.some((amenity) => amenity.toLowerCase().includes('pet')),
      );
    }

    // `data` is retained as a compatibility alias for older dashboard pages;
    // both arrays now carry the canonical database id plus the marketing slug.
    return NextResponse.json({ properties: filtered, data: filtered, total: filtered.length });
  } catch (error) {
    const incidentId = crypto.randomUUID();
    console.error('[properties] failed', { incidentId, error });
    return NextResponse.json(
      { error: 'Property catalogue unavailable', code: 'PROPERTIES_UNAVAILABLE', incidentId },
      { status: 503 },
    );
  }
}
