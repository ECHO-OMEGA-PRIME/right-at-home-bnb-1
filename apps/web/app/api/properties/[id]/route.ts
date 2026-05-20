import { NextRequest, NextResponse } from 'next/server';

// ── Mock data ────────────────────────────────────────────────────────────
const properties: any[] = [
  {
    id: 'PROP-001', name: 'Sunset Retreat', address: '1423 W Illinois Ave, Midland, TX 79701',
    status: 'active', bedrooms: 3, bathrooms: 2, max_guests: 8, pet_allowed: true,
    pet_fee_cents: 5000, nightly_rate_cents: 17500, cleaning_fee_cents: 12500,
    description: 'Beautifully renovated 3-bed home with a large backyard.',
    amenities: ['wifi', 'washer_dryer', 'kitchen', 'parking', 'yard', 'grill', 'smart_lock'],
    images: ['/properties/sunset-retreat-1.jpg'],
    check_in_time: '15:00', check_out_time: '11:00', min_nights: 1,
    created_at: '2025-06-01T00:00:00Z', updated_at: '2026-02-15T00:00:00Z',
  },
  {
    id: 'PROP-002', name: 'Oilfield Oasis', address: '802 N Marienfeld St, Midland, TX 79701',
    status: 'active', bedrooms: 4, bathrooms: 2.5, max_guests: 10, pet_allowed: false,
    pet_fee_cents: 0, nightly_rate_cents: 22500, cleaning_fee_cents: 15000,
    description: 'Spacious 4-bed house near downtown. Perfect for extended crew stays.',
    amenities: ['wifi', 'washer_dryer', 'kitchen', 'parking', 'smart_lock', 'workspace'],
    images: ['/properties/oilfield-oasis-1.jpg'],
    check_in_time: '15:00', check_out_time: '11:00', min_nights: 2,
    created_at: '2025-08-15T00:00:00Z', updated_at: '2026-01-20T00:00:00Z',
  },
  {
    id: 'PROP-003', name: 'Permian Basin Pad', address: '515 E Pine Ave, Midland, TX 79701',
    status: 'maintenance', bedrooms: 2, bathrooms: 1, max_guests: 4, pet_allowed: true,
    pet_fee_cents: 3500, nightly_rate_cents: 12500, cleaning_fee_cents: 10000,
    description: 'Cozy 2-bed bungalow. Currently undergoing renovation.',
    amenities: ['wifi', 'kitchen', 'parking'], images: [],
    check_in_time: '15:00', check_out_time: '11:00', min_nights: 1,
    created_at: '2025-11-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
];

const bookings = [
  { property_id: 'PROP-001', status: 'completed', check_in: '2026-02-15', check_out: '2026-02-18', total_cents: 70363 },
  { property_id: 'PROP-001', status: 'completed', check_in: '2026-02-22', check_out: '2026-02-25', total_cents: 70363 },
  { property_id: 'PROP-001', status: 'confirmed', check_in: '2026-03-20', check_out: '2026-03-23', total_cents: 70363 },
  { property_id: 'PROP-002', status: 'completed', check_in: '2026-02-10', check_out: '2026-02-14', total_cents: 110306 },
  { property_id: 'PROP-002', status: 'confirmed', check_in: '2026-03-22', check_out: '2026-03-25', total_cents: 89306 },
];

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/properties/[id] ─────────────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const property = properties.find((p) => p.id === id);

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Calculate stats
    const propBookings = bookings.filter((b) => b.property_id === id);
    const completedBookings = propBookings.filter((b) => b.status === 'completed');
    const upcomingBookings = propBookings.filter(
      (b) => ['confirmed', 'pending'].includes(b.status) && b.check_in >= new Date().toISOString().split('T')[0],
    );

    // Occupancy: booked nights in last 90 days / 90
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const recentBookings = completedBookings.filter((b) => b.check_out >= ninetyDaysAgo);
    let bookedNights = 0;
    for (const b of recentBookings) {
      const ci = new Date(b.check_in);
      const co = new Date(b.check_out);
      bookedNights += Math.ceil((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24));
    }
    const occupancy_rate = Math.round((bookedNights / 90) * 100) / 100;

    const total_revenue_cents = completedBookings.reduce((s, b) => s + b.total_cents, 0);

    return NextResponse.json({
      property,
      stats: {
        total_bookings: propBookings.length,
        completed_bookings: completedBookings.length,
        upcoming_bookings: upcomingBookings.length,
        occupancy_rate_90d: occupancy_rate,
        total_revenue_cents,
        avg_nightly_revenue_cents: bookedNights > 0 ? Math.round(total_revenue_cents / bookedNights) : 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch property', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PUT /api/properties/[id] ─────────────────────────────────────────────
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idx = properties.findIndex((p) => p.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const body = await request.json();
    const property = properties[idx];

    const updatable = [
      'name', 'address', 'status', 'bedrooms', 'bathrooms', 'max_guests',
      'pet_allowed', 'pet_fee_cents', 'nightly_rate_cents', 'cleaning_fee_cents',
      'description', 'amenities', 'images', 'check_in_time', 'check_out_time', 'min_nights',
    ];

    for (const field of updatable) {
      if (body[field] !== undefined) {
        property[field] = body[field];
      }
    }

    property.updated_at = new Date().toISOString();
    properties[idx] = property;

    return NextResponse.json({ property });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update property', detail: error.message },
      { status: 500 },
    );
  }
}

// ── DELETE /api/properties/[id] — Soft delete (set inactive) ─────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idx = properties.findIndex((p) => p.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    properties[idx].status = 'inactive';
    properties[idx].updated_at = new Date().toISOString();

    return NextResponse.json({
      message: 'Property deactivated',
      property: properties[idx],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to deactivate property', detail: error.message },
      { status: 500 },
    );
  }
}
