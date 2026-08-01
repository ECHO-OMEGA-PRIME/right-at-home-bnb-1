import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { dollarsToCents, getGuest, toGuestContract } from '@/lib/guest-crm';

// Backed by the real Guest table. Previously an invented guest, plus invented
// bookings, conversations and reviews (queue #26855). Bookings and messages are
// now real joins; reviews stay empty because no Review model exists yet -- an
// honest empty array rather than fabricated five-star testimonials.

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/crm/guests/[id] ────────────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const guest = await getGuest(id);
    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const [bookings, messages] = await Promise.all([
      prisma.booking.findMany({
        where: { guestId: id },
        orderBy: { checkIn: 'desc' },
        include: { property: { select: { name: true } } },
      }),
      prisma.message.findMany({
        where: { guestId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const guestBookings = bookings.map((b) => ({
      id: b.id,
      property_id: b.propertyId,
      property_name: b.property?.name ?? 'Unknown',
      check_in: b.checkIn.toISOString().slice(0, 10),
      check_out: b.checkOut.toISOString().slice(0, 10),
      nights: b.totalNights,
      total_cents: dollarsToCents(b.totalPrice),
      status: (b.status || '').toLowerCase(),
      platform: (b.platform || 'direct').toLowerCase(),
    }));

    const totalCents = guestBookings.reduce((s, b) => s + b.total_cents, 0);

    return NextResponse.json({
      guest,
      bookings: guestBookings,
      conversations: messages.map((m) => ({
        id: m.id,
        created_at: m.createdAt.toISOString(),
      })),
      // No Review model exists. Empty is the truth; inventing reviews here is
      // exactly what this migration is removing.
      reviews: [],
      // Derived from the guest's actual bookings rather than a stored figure,
      // so it cannot drift from the rows it claims to summarise.
      lifetime_value_cents: totalCents,
      avg_booking_value_cents:
        guestBookings.length > 0 ? Math.round(totalCents / guestBookings.length) : 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to load guest', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PATCH /api/crm/guests/[id] ──────────────────────────────────────────
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const existing = await prisma.guest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    // first/last collapse into the model's single `name`; only rebuild it when
    // one of them was actually supplied, so a PATCH of just `notes` cannot
    // silently rewrite the name.
    if (body.first_name !== undefined || body.last_name !== undefined) {
      const [curFirst, ...curRest] = (existing.name || '').trim().split(/\s+/);
      const first = body.first_name ?? curFirst ?? '';
      const last = body.last_name ?? curRest.join(' ');
      data.name = `${first} ${last}`.trim();
    }
    if (body.email !== undefined) data.email = String(body.email).toLowerCase();
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.source !== undefined) data.platform = String(body.source).toUpperCase();
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.tags !== undefined) data.tags = JSON.stringify(body.tags);
    if (body.is_vip !== undefined) data.isVip = Boolean(body.is_vip);

    const updated = await prisma.guest.update({ where: { id }, data });
    return NextResponse.json({ guest: toGuestContract(updated as never) });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update guest', detail: error.message },
      { status: 500 },
    );
  }
}
