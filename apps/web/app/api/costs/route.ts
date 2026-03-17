import { NextRequest, NextResponse } from 'next/server';

const costs: any[] = [
  {
    id: 'COST-001',
    category: 'cleaning',
    description: 'Deep clean — Sunset Retreat post-checkout',
    amount_cents: 15000,
    property_id: 'PROP-001',
    booking_id: 'BK-010',
    vendor: 'Clean Brees LLC',
    date: '2025-12-26',
    recurring: false,
    notes: 'Extra deep clean for holiday checkout',
    created_at: '2025-12-26T14:00:00Z',
  },
  {
    id: 'COST-002',
    category: 'maintenance',
    description: 'HVAC filter replacement — all 3 properties',
    amount_cents: 8500,
    property_id: null,
    booking_id: null,
    vendor: 'Permian HVAC Co',
    date: '2026-01-15',
    recurring: true,
    notes: 'Quarterly filter change',
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'COST-003',
    category: 'supplies',
    description: 'Towels, linens, and toiletries restock',
    amount_cents: 32000,
    property_id: null,
    booking_id: null,
    vendor: 'Sam\'s Club',
    date: '2026-02-01',
    recurring: false,
    notes: 'Monthly restock run',
    created_at: '2026-02-01T11:00:00Z',
  },
  {
    id: 'COST-004',
    category: 'utilities',
    description: 'Electric bill — Sunset Retreat (Feb)',
    amount_cents: 18500,
    property_id: 'PROP-001',
    booking_id: null,
    vendor: 'Oncor Electric',
    date: '2026-02-15',
    recurring: true,
    notes: null,
    created_at: '2026-02-15T00:00:00Z',
  },
  {
    id: 'COST-005',
    category: 'insurance',
    description: 'Short-term rental liability insurance (quarterly)',
    amount_cents: 45000,
    property_id: null,
    booking_id: null,
    vendor: 'Proper Insurance',
    date: '2026-01-01',
    recurring: true,
    notes: 'Covers all 3 properties',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'COST-006',
    category: 'cleaning',
    description: 'Standard turnover clean — Oilfield Oasis',
    amount_cents: 12000,
    property_id: 'PROP-002',
    booking_id: 'BK-020',
    vendor: 'Clean Brees LLC',
    date: '2026-01-19',
    recurring: false,
    notes: null,
    created_at: '2026-01-19T13:00:00Z',
  },
];

// ── GET /api/costs ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const category = params.get('category');
    const propertyId = params.get('property_id');
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');
    const recurring = params.get('recurring');

    let filtered = [...costs];

    if (category) {
      filtered = filtered.filter((c) => c.category === category);
    }
    if (propertyId) {
      filtered = filtered.filter((c) => c.property_id === propertyId);
    }
    if (startDate) {
      filtered = filtered.filter((c) => c.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((c) => c.date <= endDate);
    }
    if (recurring !== null && recurring !== undefined) {
      filtered = filtered.filter((c) => c.recurring === (recurring === 'true'));
    }

    const totalCents = filtered.reduce((sum, c) => sum + c.amount_cents, 0);

    // Group by category
    const byCategory: Record<string, number> = {};
    for (const c of filtered) {
      byCategory[c.category] = (byCategory[c.category] ?? 0) + c.amount_cents;
    }

    return NextResponse.json({
      costs: filtered,
      total: filtered.length,
      total_cents: totalCents,
      by_category: byCategory,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list costs', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/costs ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.category || !body.description || typeof body.amount_cents !== 'number') {
      return NextResponse.json(
        { error: 'Missing required: category, description, amount_cents' },
        { status: 400 },
      );
    }

    if (body.amount_cents <= 0) {
      return NextResponse.json(
        { error: 'amount_cents must be positive' },
        { status: 400 },
      );
    }

    const validCategories = [
      'cleaning', 'maintenance', 'supplies', 'utilities',
      'insurance', 'mortgage', 'taxes', 'marketing',
      'software', 'furnishing', 'landscaping', 'other',
    ];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(', ')}` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const cost = {
      id: `COST-${Date.now().toString(36).toUpperCase()}`,
      category: body.category,
      description: body.description,
      amount_cents: body.amount_cents,
      property_id: body.property_id ?? null,
      booking_id: body.booking_id ?? null,
      vendor: body.vendor ?? null,
      date: body.date ?? now.split('T')[0],
      recurring: body.recurring ?? false,
      notes: body.notes ?? null,
      created_at: now,
    };

    costs.push(cost);

    return NextResponse.json({ cost }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create cost entry', detail: error.message },
      { status: 500 },
    );
  }
}
