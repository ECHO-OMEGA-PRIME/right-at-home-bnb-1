import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { assertPeriodOpen, periodLockResponse } from '@/lib/period-lock';

// Real Invoice / InvoiceLine rows (queue #26855). Previously a hardcoded array,
// so recorded payments disappeared on the next cold start -- an invoice ledger
// that forgot who had paid.

type RouteContext = { params: Promise<{ id: string }> };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'void'],
  sent: ['paid', 'overdue', 'void'],
  overdue: ['paid', 'void'],
  paid: [],
  void: [],
};

async function toContract(inv: any) {
  const guest = inv.guestId
    ? await prisma.guest.findUnique({ where: { id: inv.guestId }, select: { name: true, email: true } })
    : null;
  return {
    id: inv.id,
    number: inv.number,
    booking_id: inv.bookingId,
    guest_id: inv.guestId,
    guest_name: guest?.name ?? null,
    guest_email: guest?.email ?? null,
    property_name: inv.property?.name ?? null,
    status: inv.status,
    issued_date: iso(inv.issueDate),
    due_date: iso(inv.dueDate),
    paid_date: iso(inv.paidDate),
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

const INCLUDE = { lines: true, property: { select: { name: true } } } as const;

// ── GET /api/invoices/[id] ───────────────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: INCLUDE });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json({ invoice: await toContract(invoice) });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to load invoice', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PUT /api/invoices/[id] ───────────────────────────────────────────────
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.status) {
      const allowed = VALID_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Cannot transition from '${existing.status}' to '${body.status}'` },
          { status: 400 },
        );
      }
      data.status = body.status;
      if (body.status === 'paid') {
        data.paidDate = new Date();
        data.paidCents = body.paid_cents ?? existing.totalCents;
      }
    }

    // A payment without an explicit status change: accumulate, and let the
    // invoice settle itself once it is fully covered.
    if (body.payment_cents && !body.status) {
      if (!Number.isInteger(body.payment_cents) || body.payment_cents <= 0) {
        return NextResponse.json(
          { error: 'payment_cents must be a positive integer' },
          { status: 400 },
        );
      }
      // Capped at the total: a payment cannot make an invoice more than paid,
      // which would silently create a negative balance owed.
      const paid = Math.min(existing.paidCents + body.payment_cents, existing.totalCents);
      data.paidCents = paid;
      if (paid >= existing.totalCents) {
        data.status = 'paid';
        data.paidDate = new Date();
      }
    }

    if (body.notes !== undefined) data.notes = body.notes;

    // Closed books stay closed (P5-1). Both the invoice's EXISTING dates and any
    // new paid date are checked: marking a closed month's invoice paid changes
    // that month's figures, and so does moving a paid date out of one. Checking
    // only the new value would leave the obvious way around the lock.
    await assertPeriodOpen(
      existing.issueDate,
      existing.paidDate,
      data.paidDate as Date | undefined,
    );

    const updated = await prisma.invoice.update({ where: { id }, data, include: INCLUDE });
    return NextResponse.json({ invoice: await toContract(updated) });
  } catch (error: any) {
    // A locked accounting period is a REFUSAL, not a fault. Returning the
    // generic 500 below would tell the caller the system broke when it did
    // exactly what it was built to do, and the reason would be lost.
    const locked = periodLockResponse(error);
    if (locked) return NextResponse.json(locked.body, { status: locked.status });

    return NextResponse.json(
      { error: 'Failed to update invoice', detail: error.message },
      { status: 500 },
    );
  }
}

// ── DELETE /api/invoices/[id] — void, never destroy ──────────────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    if (existing.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot void a paid invoice; issue a credit note instead' },
        { status: 400 },
      );
    }

    // Voiding preserves the number and the record. Deleting an invoice would
    // leave a gap in the sequence, which is exactly what auditors look for.
    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'void' },
      include: INCLUDE,
    });
    return NextResponse.json({
      invoice: await toContract(updated),
      message: 'Invoice voided (not deleted — the number and record are preserved)',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to void invoice', detail: error.message },
      { status: 500 },
    );
  }
}
