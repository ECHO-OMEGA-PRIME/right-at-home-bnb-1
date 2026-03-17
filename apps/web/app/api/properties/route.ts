import { NextRequest, NextResponse } from 'next/server';

// ── In-memory property store ─────────────────────────────────────────────
const properties: any[] = [
  {
    id: 'PROP-001',
    name: 'Sunset Retreat',
    address: '1423 W Illinois Ave, Midland, TX 79701',
    status: 'active',
    bedrooms: 3,
    bathrooms: 2,
    max_guests: 8,
    pet_allowed: true,
    pet_fee_cents: 5000,
    nightly_rate_cents: 17500,
    cleaning_fee_cents: 12500,
    description: 'Beautifully renovated 3-bed home with a large backyard, perfect for families and oilfield crews.',
    amenities: ['wifi', 'washer_dryer', 'kitchen', 'parking', 'yard', 'grill', 'smart_lock'],
    images: ['/properties/sunset-retreat-1.jpg'],
    check_in_time: '15:00',
    check_out_time: '11:00',
    min_nights: 1,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-02-15T00:00:00Z',
  },
  {
    id: 'PROP-002',
    name: 'Oilfield Oasis',
    address: '802 N Marienfeld St, Midland, TX 79701',
    status: 'active',
    bedrooms: 4,
    bathrooms: 2.5,
    max_guests: 10,
    pet_allowed: false,
    pet_fee_cents: 0,
    nightly_rate_cents: 22500,
    cleaning_fee_cents: 15000,
    description: 'Spacious 4-bed house near downtown. Perfect for extended crew stays.',
    amenities: ['wifi', 'washer_dryer', 'kitchen', 'parking', 'smart_lock', 'workspace'],
    images: ['/properties/oilfield-oasis-1.jpg'],
    check_in_time: '15:00',
    check_out_time: '11:00',
    min_nights: 2,
    created_at: '2025-08-15T00:00:00Z',
    updated_at: '2026-01-20T00:00:00Z',
  },
  {
    id: 'PROP-003',
    name: 'Permian Basin Pad',
    address: '515 E Pine Ave, Midland, TX 79701',
    status: 'maintenance',
    bedrooms: 2,
    bathrooms: 1,
    max_guests: 4,
    pet_allowed: true,
    pet_fee_cents: 3500,
    nightly_rate_cents: 12500,
    cleaning_fee_cents: 10000,
    description: 'Cozy 2-bed bungalow. Currently undergoing renovation.',
    amenities: ['wifi', 'kitchen', 'parking'],
    images: [],
    check_in_time: '15:00',
    check_out_time: '11:00',
    min_nights: 1,
    created_at: '2025-11-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
];

// ── GET /api/properties ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const status = params.get('status');
    const minBeds = params.get('beds');
    const minBaths = params.get('baths');
    const petAllowed = params.get('pet_allowed');

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
    if (petAllowed !== null && petAllowed !== undefined) {
      const wantPets = petAllowed === 'true';
      filtered = filtered.filter((p) => p.pet_allowed === wantPets);
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

// ── POST /api/properties (admin only) ────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const required = ['name', 'address', 'bedrooms', 'bathrooms', 'nightly_rate_cents'];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    if (typeof body.bedrooms !== 'number' || body.bedrooms < 0) {
      return NextResponse.json({ error: 'bedrooms must be a non-negative number' }, { status: 400 });
    }
    if (typeof body.nightly_rate_cents !== 'number' || body.nightly_rate_cents <= 0) {
      return NextResponse.json({ error: 'nightly_rate_cents must be a positive integer' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const property = {
      id: `PROP-${Date.now().toString(36).toUpperCase()}`,
      name: body.name,
      address: body.address,
      status: body.status ?? 'active',
      bedrooms: body.bedrooms,
      bathrooms: body.bathrooms ?? 1,
      max_guests: body.max_guests ?? body.bedrooms * 2,
      pet_allowed: body.pet_allowed ?? false,
      pet_fee_cents: body.pet_fee_cents ?? 0,
      nightly_rate_cents: body.nightly_rate_cents,
      cleaning_fee_cents: body.cleaning_fee_cents ?? 10000,
      description: body.description ?? '',
      amenities: body.amenities ?? ['wifi', 'kitchen', 'parking'],
      images: body.images ?? [],
      check_in_time: body.check_in_time ?? '15:00',
      check_out_time: body.check_out_time ?? '11:00',
      min_nights: body.min_nights ?? 1,
      created_at: now,
      updated_at: now,
    };

    properties.push(property);

    return NextResponse.json({ property }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create property', detail: error.message },
      { status: 500 },
    );
  }
}
