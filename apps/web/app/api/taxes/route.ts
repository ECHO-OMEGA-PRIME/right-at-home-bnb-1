import { NextRequest, NextResponse } from 'next/server';

const taxRecords: any[] = [
  {
    id: 'TAX-001',
    type: 'hot',
    description: 'Hotel Occupancy Tax — January 2026',
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    taxable_revenue_cents: 340000,
    tax_rate: 0.06,
    tax_due_cents: 20400,
    status: 'paid',
    due_date: '2026-02-20',
    paid_date: '2026-02-18',
    created_at: '2026-02-01T00:00:00Z',
  },
  {
    id: 'TAX-002',
    type: 'sales',
    description: 'Texas Sales Tax — January 2026',
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    taxable_revenue_cents: 340000,
    tax_rate: 0.0825,
    tax_due_cents: 28050,
    status: 'paid',
    due_date: '2026-02-20',
    paid_date: '2026-02-18',
    created_at: '2026-02-01T00:00:00Z',
  },
  {
    id: 'TAX-003',
    type: 'hot',
    description: 'Hotel Occupancy Tax — February 2026',
    period_start: '2026-02-01',
    period_end: '2026-02-28',
    taxable_revenue_cents: 282000,
    tax_rate: 0.06,
    tax_due_cents: 16920,
    status: 'due',
    due_date: '2026-03-20',
    paid_date: null,
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'TAX-004',
    type: 'sales',
    description: 'Texas Sales Tax — February 2026',
    period_start: '2026-02-01',
    period_end: '2026-02-28',
    taxable_revenue_cents: 282000,
    tax_rate: 0.0825,
    tax_due_cents: 23265,
    status: 'due',
    due_date: '2026-03-20',
    paid_date: null,
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'TAX-005',
    type: 'property',
    description: 'Property Tax — Sunset Retreat (2025)',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    taxable_revenue_cents: 0,
    tax_rate: 0,
    tax_due_cents: 485000,
    status: 'paid',
    due_date: '2026-01-31',
    paid_date: '2026-01-28',
    created_at: '2025-11-01T00:00:00Z',
  },
];

// ── GET /api/taxes ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const type = params.get('type');
    const status = params.get('status');
    const year = params.get('year');

    let filtered = [...taxRecords];

    if (type) {
      filtered = filtered.filter((t) => t.type === type);
    }
    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }
    if (year) {
      filtered = filtered.filter((t) => t.period_start.startsWith(year));
    }

    const totalDueCents = filtered
      .filter((t) => t.status === 'due')
      .reduce((sum, t) => sum + t.tax_due_cents, 0);

    const totalPaidCents = filtered
      .filter((t) => t.status === 'paid')
      .reduce((sum, t) => sum + t.tax_due_cents, 0);

    // Group by type
    const byType: Record<string, { due_cents: number; paid_cents: number; count: number }> = {};
    for (const t of filtered) {
      if (!byType[t.type]) {
        byType[t.type] = { due_cents: 0, paid_cents: 0, count: 0 };
      }
      byType[t.type].count += 1;
      if (t.status === 'due') {
        byType[t.type].due_cents += t.tax_due_cents;
      } else if (t.status === 'paid') {
        byType[t.type].paid_cents += t.tax_due_cents;
      }
    }

    return NextResponse.json({
      tax_records: filtered,
      total: filtered.length,
      total_due_cents: totalDueCents,
      total_paid_cents: totalPaidCents,
      by_type: byType,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list tax records', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/taxes ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.type || !body.period_start || !body.period_end) {
      return NextResponse.json(
        { error: 'Missing required: type, period_start, period_end' },
        { status: 400 },
      );
    }

    const validTypes = ['hot', 'sales', 'property', 'income', 'payroll'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    // Auto-calculate tax if taxable_revenue and rate provided
    let taxDueCents = body.tax_due_cents ?? 0;
    if (body.taxable_revenue_cents && body.tax_rate && !body.tax_due_cents) {
      taxDueCents = Math.round(body.taxable_revenue_cents * body.tax_rate);
    }

    const now = new Date().toISOString();
    const record = {
      id: `TAX-${Date.now().toString(36).toUpperCase()}`,
      type: body.type,
      description: body.description ?? `${body.type} tax — ${body.period_start} to ${body.period_end}`,
      period_start: body.period_start,
      period_end: body.period_end,
      taxable_revenue_cents: body.taxable_revenue_cents ?? 0,
      tax_rate: body.tax_rate ?? 0,
      tax_due_cents: taxDueCents,
      status: 'due',
      due_date: body.due_date ?? null,
      paid_date: null,
      created_at: now,
    };

    taxRecords.push(record);

    return NextResponse.json({ tax_record: record }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create tax record', detail: error.message },
      { status: 500 },
    );
  }
}
