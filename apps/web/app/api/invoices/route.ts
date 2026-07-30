import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Real Invoice / InvoiceLine rows (queue #26855).
//
// The previous POST took a booking_id and then built a "mockBooking" out of
// request-body fields -- it never looked the booking up, so an invoice could
// bill any amount for any stay and nothing reconciled. Lines are now derived
// from the actual Booking row; the client supplies only genuinely additional
// charges.

const TAX_RATE = 0.0825;

const dollarsToCents = (d: number | null | undefined) => Math.round((d ?? 0) * 100);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function toContract(inv: any, guestName: string | null, guestEmail: string | null) {
  return {
    id: inv.id,
    number: inv.number,
    booking_id: inv.bookingId,
    guest_id: inv.guestId,
    guest_name: guestName,
    guest_email: guestEmail,
    property_name: inv.property?.name ?? null,
    status: inv.status,
    issued_date: iso(inv.issueDate),
    due_date: iso(inv.dueDate),
    paid_date: null,
    lines: (inv.lines ?? []).map((l: any) => ({
      description: l.description,
      quantity: l.quantity,
      unit_price_cents: l.unitCents,
      total_cents: l.totalCents,
    })),
    subtotal_cents: inv.subtotalCents,
    tax_cents: inv.taxCents,
    total_cents: inv.totalCents,
    paid_cents: inv.paidCents,
    notes: inv.notes,
    created_at: inv.createdAt.toISOString(),
    updated_at: inv.updatedAt.toISOString(),
  };
}

/** Guest is stored as a plain id on Invoice, not a relation, so resolve names in one query. */
async function guestLookup(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return new Map<string, { name: string; email: string }>();
  const guests = await prisma.guest.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return new Map(guests.map((g) => [g.id, { name: g.name, email: g.email }]));
}

// ── GET /api/invoices ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const status = params.get('status');
    const guestId = params.get('guest_id');

    const rows = await prisma.invoice.findMany({
      where: { ...(status ? { status } : {}), ...(guestId ? { guestId } : {}) },
      include: { lines: true, property: { select: { name: true } } },
      orderBy: { issueDate: 'desc' },
    });

    const guests = await guestLookup(rows.map((r) => r.guestId));
    const invoices = rows.map((r) => {
      const g = r.guestId ? guests.get(r.guestId) : undefined;
      return toContract(r, g?.name ?? null, g?.email ?? null);
    });

    return NextResponse.json({ invoices, total: invoices.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list invoices', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/invoices — create from a real booking ──────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    if (!body.booking_id) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
    }

    // The booking is the source of truth for what is being billed.
    const booking = await prisma.booking.findUnique({
      where: { id: body.booking_id },
      include: { property: { select: { name: true } }, guest: { select: { id: true, name: true, email: true } } },
    });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const lines: { description: string; quantity: number; unitCents: number; totalCents: number }[] = [];

    const nightlyCents = dollarsToCents(booking.nightlyRate);
    lines.push({
      description: `${booking.property?.name ?? 'Stay'} — ${booking.totalNights} night(s)`,
      quantity: booking.totalNights,
      unitCents: nightlyCents,
      totalCents: nightlyCents * booking.totalNights,
    });

    const cleaningCents = dollarsToCents(booking.cleaningFee);
    if (cleaningCents > 0) {
      lines.push({ description: 'Cleaning fee', quantity: 1, unitCents: cleaningCents, totalCents: cleaningCents });
    }

    // Only genuinely extra charges come from the request.
    if (Array.isArray(body.additional_lines)) {
      for (const al of body.additional_lines) {
        if (!al?.description || typeof al.unit_price_cents !== 'number') continue;
        const qty = al.quantity || 1;
        lines.push({
          description: al.description,
          quantity: qty,
          unitCents: al.unit_price_cents,
          totalCents: qty * al.unit_price_cents,
        });
      }
    }

    const subtotalCents = lines.reduce((s, l) => s + l.totalCents, 0);
    const taxCents = Math.round(subtotalCents * TAX_RATE);
    const totalCents = subtotalCents + taxCents;

    const dueDate = body.due_date
      ? new Date(`${body.due_date}T00:00:00.000Z`)
      : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    const created = await prisma.invoice.create({
      data: {
        number: `INV-${Date.now().toString(36).toUpperCase()}`,
        bookingId: booking.id,
        propertyId: booking.propertyId,
        guestId: booking.guestId,
        status: 'draft',
        issueDate: new Date(),
        dueDate,
        subtotalCents,
        taxCents,
        totalCents,
        notes: body.notes || null,
        lines: { create: lines },
      },
      include: { lines: true, property: { select: { name: true } } },
    });

    return NextResponse.json(
      { invoice: toContract(created, booking.guest?.name ?? null, booking.guest?.email ?? null) },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create invoice', detail: error.message },
      { status: 500 },
    );
  }
}
