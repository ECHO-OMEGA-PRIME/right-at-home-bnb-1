import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Backed by the real Booking table (761 rows).
//
// This route's store was literally `const bookings: any[] = []`, so it returned
// 404 for every real booking that exists -- worse than fabricated, simply
// non-functional (queue #26855).
//
// NOTE ON REFUNDS: the Booking model has no payment-tracking field. The old
// contract assumed `paid_cents`. Refunds are therefore computed against
// totalPrice (what the stay is worth) and the response says so via
// `basis: 'total_price'`, rather than inventing an amount-paid that no system
// records.

const dollarsToCents = (d: number | null | undefined) => Math.round((d ?? 0) * 100);
const iso = (d: Date) => d.toISOString().slice(0, 10);

type RouteContext = { params: Promise<{ id: string }> };

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['checked_out', 'completed'],
  checked_out: ['completed'],
  completed: [],
  cancelled: [],
};

function toContract(b: any) {
  return {
    id: b.id,
    property_id: b.propertyId,
    property_name: b.property?.name ?? null,
    guest_id: b.guestId,
    guest_name: b.guest?.name ?? null,
    check_in: iso(b.checkIn),
    check_out: iso(b.checkOut),
    nights: b.totalNights,
    guest_count: b.guestCount,
    platform: (b.platform || 'direct').toLowerCase(),
    status: (b.status || '').toLowerCase(),
    nightly_rate_cents: dollarsToCents(b.nightlyRate),
    subtotal_cents: dollarsToCents(b.subtotal),
    cleaning_fee_cents: dollarsToCents(b.cleaningFee),
    taxes_cents: dollarsToCents(b.taxes),
    total_cents: dollarsToCents(b.totalPrice),
    lock_code: b.accessCode,
    special_requests: b.specialReqs,
    confirm_code: b.confirmCode,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  };
}

const withRelations = {
  property: { select: { name: true } },
  guest: { select: { name: true } },
} as const;

// ── GET /api/bookings/[id] ─────────────────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const booking = await prisma.booking.findUnique({ where: { id }, include: withRelations });
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    return NextResponse.json({ booking: toContract(booking) });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to load booking', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PUT /api/bookings/[id] ─────────────────────────────────────────────────
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    const currentStatus = (existing.status || '').toLowerCase();

    if (body.status) {
      const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from '${currentStatus}' to '${body.status}'. Allowed: ${
              allowed.join(', ') || 'none'
            }`,
          },
          { status: 400 },
        );
      }
      // Stored upper-case to match the 761 existing rows.
      data.status = String(body.status).toUpperCase();
    }

    if (body.check_in !== undefined) data.checkIn = new Date(`${body.check_in}T00:00:00.000Z`);
    if (body.check_out !== undefined) data.checkOut = new Date(`${body.check_out}T00:00:00.000Z`);
    if (body.guest_count !== undefined) data.guestCount = body.guest_count;
    if (body.special_requests !== undefined) data.specialReqs = body.special_requests;
    if (body.lock_code !== undefined) data.accessCode = body.lock_code;

    // Recompute nights when either date moved, so totalNights cannot drift out
    // of step with the dates it describes.
    if (body.check_in !== undefined || body.check_out !== undefined) {
      const ci = (data.checkIn as Date) ?? existing.checkIn;
      const co = (data.checkOut as Date) ?? existing.checkOut;
      if (!(ci < co)) {
        return NextResponse.json({ error: 'check_out must be after check_in' }, { status: 400 });
      }
      data.totalNights = Math.ceil((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24));
    }

    const updated = await prisma.booking.update({
      where: { id },
      data,
      include: withRelations,
    });
    return NextResponse.json({ booking: toContract(updated) });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update booking', detail: error.message },
      { status: 500 },
    );
  }
}

// ── DELETE /api/bookings/[id] — cancel, never hard-delete ──────────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const currentStatus = (existing.status || '').toLowerCase();
    if (['completed', 'cancelled'].includes(currentStatus)) {
      return NextResponse.json(
        { error: `Cannot cancel a booking with status '${currentStatus}'` },
        { status: 400 },
      );
    }

    const totalCents = dollarsToCents(existing.totalPrice);
    const daysUntil = Math.ceil(
      (existing.checkIn.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    const refundCents =
      daysUntil > 7 ? totalCents : daysUntil >= 3 ? Math.round(totalCents * 0.5) : 0;

    // Cancellation is a status change, not a delete: the row is financial and
    // operational history.
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: withRelations,
    });

    return NextResponse.json({
      booking: toContract(updated),
      cancellation: {
        refund_cents: refundCents,
        refund_percentage: totalCents > 0 ? Math.round((refundCents / totalCents) * 100) : 0,
        // The model records no amount-paid, so the refund is expressed against
        // the booking total rather than against a payment nobody tracked.
        basis: 'total_price',
        days_until_check_in: daysUntil,
        policy: 'Full refund >7 days, 50% 3-7 days, 0% <3 days before check-in',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to cancel booking', detail: error.message },
      { status: 500 },
    );
  }
}
