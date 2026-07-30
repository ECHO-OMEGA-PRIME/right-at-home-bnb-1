import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Backed by the real Property table (22 rows). Previously three invented
// properties and invented bookings behind them (queue #26855).
//
// GET stays PUBLIC: /api/properties/[id] serves the marketing site's listings
// and middleware exempts it deliberately. PUT and DELETE carry their own
// owner/admin guard here rather than relying on a middleware path regex to
// distinguish a read from a write -- defence in depth on the mutating verbs.

const dollarsToCents = (d: number | null | undefined) => Math.round((d ?? 0) * 100);
const iso = (d: Date) => d.toISOString().slice(0, 10);

type RouteContext = { params: Promise<{ id: string }> };

function parseAmenities(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw.split(',').map((a) => a.trim()).filter(Boolean);
  }
}

function toContract(p: any) {
  return {
    id: p.id,
    name: p.name,
    address: [p.address, p.city, p.state, p.zipCode].filter(Boolean).join(', '),
    status: (p.status || '').toLowerCase(),
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    max_guests: p.maxGuests,
    nightly_rate_cents: dollarsToCents(p.nightlyRate),
    cleaning_fee_cents: dollarsToCents(p.cleaningFee),
    security_deposit_cents: dollarsToCents(p.securityDeposit),
    amenities: parseAmenities(p.amenities),
    images: (p.photos ?? []).map((ph: { url: string }) => ph.url),
    property_type: p.propertyType,
    square_feet: p.squareFeet,
    check_in_instructions: p.checkInInstr,
    check_out_instructions: p.checkOutInstr,
    house_rules: p.houseRules,
    // The model records no pet policy, no free-text description and no
    // check-in/out times or minimum-nights rule. Reported as null rather than
    // invented -- these are schema gaps, not values to guess.
    pet_allowed: null,
    pet_fee_cents: null,
    description: null,
    check_in_time: null,
    check_out_time: null,
    min_nights: null,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

// ── GET /api/properties/[id] — public ──────────────────────────────────────
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const property = await prisma.property.findUnique({
      where: { id },
      include: { photos: { orderBy: { sortOrder: 'asc' }, select: { url: true } } },
    });
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const bookings = await prisma.booking.findMany({
      where: { propertyId: id },
      select: { checkIn: true, checkOut: true, totalNights: true, totalPrice: true, status: true },
    });

    const today = iso(new Date());
    const norm = (s: string | null) => (s || '').toLowerCase();
    // Status is stored upper-case; compare case-insensitively or every booking
    // silently drops out of these stats.
    const completed = bookings.filter((b) => ['completed', 'checked_out'].includes(norm(b.status)));
    const upcoming = bookings.filter(
      (b) => ['confirmed', 'pending'].includes(norm(b.status)) && iso(b.checkIn) >= today,
    );

    const ninetyDaysAgo = iso(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    const bookedNights = completed
      .filter((b) => iso(b.checkOut) >= ninetyDaysAgo)
      .reduce((s, b) => s + (b.totalNights ?? 0), 0);

    const totalRevenueCents = completed.reduce((s, b) => s + dollarsToCents(b.totalPrice), 0);

    return NextResponse.json({
      property: toContract(property),
      stats: {
        total_bookings: bookings.length,
        completed_bookings: completed.length,
        upcoming_bookings: upcoming.length,
        occupancy_rate_90d: Math.round((bookedNights / 90) * 100) / 100,
        total_revenue_cents: totalRevenueCents,
        avg_nightly_revenue_cents:
          bookedNights > 0 ? Math.round(totalRevenueCents / bookedNights) : 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch property', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PUT /api/properties/[id] ───────────────────────────────────────────────
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.address !== undefined) data.address = body.address;
    if (body.status !== undefined) data.status = String(body.status).toUpperCase();
    if (body.bedrooms !== undefined) data.bedrooms = body.bedrooms;
    if (body.bathrooms !== undefined) data.bathrooms = body.bathrooms;
    if (body.max_guests !== undefined) data.maxGuests = body.max_guests;
    if (body.amenities !== undefined) data.amenities = JSON.stringify(body.amenities);
    if (body.house_rules !== undefined) data.houseRules = body.house_rules;
    // Money arrives as cents and is stored as Float dollars.
    if (body.nightly_rate_cents !== undefined) data.nightlyRate = body.nightly_rate_cents / 100;
    if (body.cleaning_fee_cents !== undefined) data.cleaningFee = body.cleaning_fee_cents / 100;

    const updated = await prisma.property.update({
      where: { id },
      data,
      include: { photos: { orderBy: { sortOrder: 'asc' }, select: { url: true } } },
    });
    return NextResponse.json({ property: toContract(updated) });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update property', detail: error.message },
      { status: 500 },
    );
  }
}

// ── DELETE /api/properties/[id] — deactivate, never destroy ────────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    // Soft-deactivate. A property has bookings, expenses and ledger history
    // hanging off it; hard-deleting would orphan or cascade real records.
    const updated = await prisma.property.update({
      where: { id },
      data: { status: 'INACTIVE' },
      include: { photos: { orderBy: { sortOrder: 'asc' }, select: { url: true } } },
    });

    return NextResponse.json({
      property: toContract(updated),
      message: 'Property deactivated (not deleted — booking and financial history is preserved)',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to deactivate property', detail: error.message },
      { status: 500 },
    );
  }
}
