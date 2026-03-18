import { NextRequest, NextResponse } from 'next/server';

// ── Invoices store (empty - populated via API in production) ──────────────
const invoices: any[] = [];

const TAX_RATE = 0.0825;

function generateId(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

// ── GET /api/invoices ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const status = params.get('status');
    const guestId = params.get('guest_id');

    let filtered = [...invoices];
    if (status) filtered = filtered.filter((i) => i.status === status);
    if (guestId) filtered = filtered.filter((i) => i.guest_id === guestId);

    return NextResponse.json({
      invoices: filtered,
      total: filtered.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list invoices', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/invoices — Create from booking ─────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.booking_id) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
    }

    // Booking data from request body — in production query DB
    const mockBooking = {
      id: body.booking_id,
      guest_id: body.guest_id || '',
      guest_name: body.guest_name || '',
      guest_email: body.guest_email || '',
      property_name: body.property_name || '',
      nights: body.nights || 0,
      nightly_rate_cents: body.nightly_rate_cents || 0,
      cleaning_fee_cents: body.cleaning_fee_cents || 0,
      pet_fee_cents: body.pet_fee_cents || 0,
    };

    // Auto-generate line items from booking
    const lines: any[] = [
      {
        description: `Nightly Rate (${mockBooking.nights} nights @ $${(mockBooking.nightly_rate_cents / 100).toFixed(2)})`,
        quantity: mockBooking.nights,
        unit_price_cents: mockBooking.nightly_rate_cents,
        total_cents: mockBooking.nights * mockBooking.nightly_rate_cents,
      },
      {
        description: 'Cleaning Fee',
        quantity: 1,
        unit_price_cents: mockBooking.cleaning_fee_cents,
        total_cents: mockBooking.cleaning_fee_cents,
      },
    ];

    if (mockBooking.pet_fee_cents > 0) {
      lines.push({
        description: 'Pet Fee',
        quantity: 1,
        unit_price_cents: mockBooking.pet_fee_cents,
        total_cents: mockBooking.pet_fee_cents,
      });
    }

    // Add custom lines if provided
    if (Array.isArray(body.additional_lines)) {
      for (const al of body.additional_lines) {
        lines.push({
          description: al.description,
          quantity: al.quantity || 1,
          unit_price_cents: al.unit_price_cents,
          total_cents: (al.quantity || 1) * al.unit_price_cents,
        });
      }
    }

    const subtotal_cents = lines.reduce((s, l) => s + l.total_cents, 0);
    const tax_cents = Math.round(subtotal_cents * TAX_RATE);
    const total_cents = subtotal_cents + tax_cents;

    const now = new Date().toISOString();
    const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const invoice = {
      id: generateId(),
      booking_id: mockBooking.id,
      guest_id: mockBooking.guest_id,
      guest_name: mockBooking.guest_name,
      guest_email: mockBooking.guest_email,
      property_name: mockBooking.property_name,
      status: 'draft',
      issued_date: now.split('T')[0],
      due_date: body.due_date || dueDate,
      paid_date: null,
      lines,
      subtotal_cents,
      tax_cents,
      total_cents,
      paid_cents: 0,
      notes: body.notes || null,
      created_at: now,
      updated_at: now,
    };

    invoices.push(invoice);

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create invoice', detail: error.message },
      { status: 500 },
    );
  }
}
