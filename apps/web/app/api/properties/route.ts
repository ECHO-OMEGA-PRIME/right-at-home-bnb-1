import { NextRequest, NextResponse } from 'next/server';
import { PROPERTIES } from '@/lib/property-data';

// Map PropertyListing → API Property shape
const properties = PROPERTIES.map((p) => ({
  id: p.id,
  name: p.name,
  address: p.address,
  city: p.city,
  state: p.state,
  zipCode: p.zipCode,
  bedrooms: p.bedrooms,
  bathrooms: p.bathrooms,
  maxGuests: p.sleeps,
  propertyType: p.propertyType,
  amenities: p.amenities,
  nightlyRate: p.nightlyRate,
  status: p.status,
  createdAt: '2024-01-01T00:00:00Z',
}));

// ── GET /api/properties ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const id = params.get('id');
    const status = params.get('status');
    const minBeds = params.get('beds');
    const minBaths = params.get('baths');
    const petAllowed = params.get('pet_allowed');

    // Single property lookup
    if (id) {
      const property = properties.find((p) => p.id === id);
      if (!property) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }
      return NextResponse.json(property);
    }

    let filtered = [...properties];

    if (status) {
      filtered = filtered.filter((p) => p.status === status);
    }
    if (minBeds) {
      filtered = filtered.filter((p) => p.bedrooms >= parseInt(minBeds, 10));
    }
    if (minBaths) {
      filtered = filtered.filter((p) => p.bathrooms >= parseFloat(minBaths));
    }
    if (petAllowed === 'true') {
      filtered = filtered.filter((p) =>
        p.amenities.some((a) => a.toLowerCase().includes('pet'))
      );
    }

    return NextResponse.json({
      properties: filtered,
      total: filtered.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list properties', detail: error.message },
      { status: 500 },
    );
  }
}
