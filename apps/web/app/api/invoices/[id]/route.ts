import { NextRequest, NextResponse } from 'next/server';

// ── Mock invoices (shared reference) ─────────────────────────────────────
const invoices: any[] = [
  {
    id: 'INV-001', booking_id: 'BK-001', guest_id: 'GUEST-001',
    guest_name: 'Sarah Johnson', guest_email: 'sarah@example.com',
    property_name: 'Sunset Retreat', status: 'paid',
    issued_date: '2026-03-10', due_date: '2026-03-20', paid_date: '2026-03-10',
    lines: [
      { description: 'Nightly Rate (3 nights @ $175.00)', quantity: 3, unit_price_cents: 17500, total_cents: 52500 },
      { description: 'Cleaning Fee', quantity: 1, unit_price_cents: 12500, total_cents: 12500 },
    ],
    subtotal_cents: 65000, tax_cents: 5363, total_cents: 70363, paid_cents: 70363,
    notes: null, created_at: '2026-03-10T14:30:00Z', updated_at: '2026-03-10T15:00:00Z',
  },
  {
    id: 'INV-002', booking_id: 'BK-002', guest_id: 'GUEST-002',
    guest_name: 'Mike Chen', guest_email: 'mike.chen@example.com',
    property_name: 'Oilfield Oasis', status: 'sent',
    issued_date: '2026-03-12', due_date: '2026-03-22', paid_date: null,
    lines: [
      { description: 'Nightly Rate (3 nights @ $225.00)', quantity: 3, unit_price_cents: 22500, total_cents: 67500 },
      { description: 'Cleaning Fee', quantity: 1, unit_price_cents: 15000, total_cents: 15000 },
    ],
    subtotal_cents: 82500, tax_cents: 6806, total_cents: 89306, paid_cents: 0,
    notes: 'VRBO booking', created_at: '2026-03-12T09:15:00Z', updated_at: '2026-03-12T09:15:00Z',
  },
];

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/invoices/[id] ───────────────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const invoice = invoices.find((i) => i.id === id);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch invoice', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PUT /api/invoices/[id] — Update status, record payment ──────────────
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idx = invoices.findIndex((i) => i.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const body = await request.json();
    const invoice = invoices[idx];

    // Status transitions
    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['sent', 'void'],
        sent: ['paid', 'overdue', 'void'],
        overdue: ['paid', 'void'],
        paid: [],
        void: [],
      };

      const allowed = validTransitions[invoice.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Cannot transition from '${invoice.status}' to '${body.status}'` },
          { status: 400 },
        );
      }
      invoice.status = body.status;

      if (body.status === 'paid') {
        invoice.paid_date = new Date().toISOString().split('T')[0];
        invoice.paid_cents = body.paid_cents || invoice.total_cents;
      }
    }

    // Record partial payment
    if (body.payment_cents && !body.status) {
      invoice.paid_cents = Math.min(
        (invoice.paid_cents || 0) + body.payment_cents,
        invoice.total_cents,
      );
      if (invoice.paid_cents >= invoice.total_cents) {
        invoice.status = 'paid';
        invoice.paid_date = new Date().toISOString().split('T')[0];
      }
    }

    if (body.notes !== undefined) invoice.notes = body.notes;

    invoice.updated_at = new Date().toISOString();
    invoices[idx] = invoice;

    return NextResponse.json({ invoice });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update invoice', detail: error.message },
      { status: 500 },
    );
  }
}

// ── DELETE /api/invoices/[id] — Void invoice ─────────────────────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idx = invoices.findIndex((i) => i.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoices[idx].status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot void a paid invoice. Issue a credit note instead.' },
        { status: 400 },
      );
    }

    invoices[idx].status = 'void';
    invoices[idx].updated_at = new Date().toISOString();

    return NextResponse.json({
      message: 'Invoice voided',
      invoice: invoices[idx],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to void invoice', detail: error.message },
      { status: 500 },
    );
  }
}
