import { NextRequest, NextResponse } from 'next/server';

// ── Reference cost data (mirrors costs/route.ts store) ─────────────────────
const costs: any[] = [
  {
    id: 'COST-001',
    property_id: 'PROP-001',
    category: 'cleaning',
    description: 'Deep clean after checkout — Sunset Retreat',
    amount_cents: 8500,
    date: '2026-03-15',
    recurring: false,
    vendor: 'Clean Brees LLC',
    created_at: '2026-03-15T10:00:00Z',
  },
  {
    id: 'COST-002',
    property_id: 'PROP-001',
    category: 'utilities',
    description: 'Electric bill — March 2026',
    amount_cents: 18200,
    date: '2026-03-01',
    recurring: true,
    recurring_interval: 'monthly',
    vendor: 'Oncor Electric',
    created_at: '2026-03-01T08:00:00Z',
  },
  {
    id: 'COST-003',
    property_id: 'PROP-002',
    category: 'maintenance',
    description: 'HVAC filter replacement',
    amount_cents: 4500,
    date: '2026-02-20',
    recurring: false,
    vendor: 'Midland Air Pros',
    created_at: '2026-02-20T14:30:00Z',
  },
  {
    id: 'COST-004',
    property_id: 'PROP-002',
    category: 'supplies',
    description: 'Toiletries restock — bulk order',
    amount_cents: 12000,
    date: '2026-03-10',
    recurring: false,
    vendor: 'Amazon Business',
    created_at: '2026-03-10T09:15:00Z',
  },
  {
    id: 'COST-005',
    property_id: 'PROP-001',
    category: 'insurance',
    description: 'Short-term rental insurance — Q1 2026',
    amount_cents: 45000,
    date: '2026-01-01',
    recurring: true,
    recurring_interval: 'quarterly',
    vendor: 'Proper Insurance',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'COST-006',
    property_id: 'PROP-001',
    category: 'cleaning',
    description: 'Turnover clean — Sunset Retreat',
    amount_cents: 7500,
    date: '2026-02-10',
    recurring: false,
    vendor: 'Clean Brees LLC',
    created_at: '2026-02-10T11:00:00Z',
  },
  {
    id: 'COST-007',
    property_id: 'PROP-002',
    category: 'utilities',
    description: 'Water bill — Feb 2026',
    amount_cents: 6800,
    date: '2026-02-01',
    recurring: true,
    recurring_interval: 'monthly',
    vendor: 'City of Midland Water',
    created_at: '2026-02-01T08:00:00Z',
  },
  {
    id: 'COST-008',
    property_id: 'PROP-003',
    category: 'maintenance',
    description: 'Plumbing repair — leaking faucet',
    amount_cents: 22000,
    date: '2026-03-05',
    recurring: false,
    vendor: 'ABC Plumbing Midland',
    created_at: '2026-03-05T16:00:00Z',
  },
];

// ── GET /api/costs/summary ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const propertyId = params.get('property_id');
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');

    let filtered = [...costs];

    if (propertyId) {
      filtered = filtered.filter((c) => c.property_id === propertyId);
    }
    if (startDate) {
      filtered = filtered.filter((c) => c.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((c) => c.date <= endDate);
    }

    // ── By category ──────────────────────────────────────────────────────
    const byCategory: Record<string, { count: number; total_cents: number }> = {};
    for (const c of filtered) {
      if (!byCategory[c.category]) {
        byCategory[c.category] = { count: 0, total_cents: 0 };
      }
      byCategory[c.category].count += 1;
      byCategory[c.category].total_cents += c.amount_cents;
    }

    // ── By property ──────────────────────────────────────────────────────
    const byProperty: Record<string, { count: number; total_cents: number }> = {};
    for (const c of filtered) {
      if (!byProperty[c.property_id]) {
        byProperty[c.property_id] = { count: 0, total_cents: 0 };
      }
      byProperty[c.property_id].count += 1;
      byProperty[c.property_id].total_cents += c.amount_cents;
    }

    // ── Monthly trend ────────────────────────────────────────────────────
    const monthlyMap: Record<string, number> = {};
    for (const c of filtered) {
      const month = c.date.substring(0, 7); // YYYY-MM
      monthlyMap[month] = (monthlyMap[month] || 0) + c.amount_cents;
    }
    const monthly_trend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total_cents]) => ({ month, total_cents }));

    // ── Top vendors ──────────────────────────────────────────────────────
    const vendorMap: Record<string, { count: number; total_cents: number }> = {};
    for (const c of filtered) {
      const v = c.vendor || 'Unknown';
      if (!vendorMap[v]) {
        vendorMap[v] = { count: 0, total_cents: 0 };
      }
      vendorMap[v].count += 1;
      vendorMap[v].total_cents += c.amount_cents;
    }
    const top_vendors = Object.entries(vendorMap)
      .map(([vendor, data]) => ({ vendor, ...data }))
      .sort((a, b) => b.total_cents - a.total_cents)
      .slice(0, 10);

    // ── Recurring vs one-time ────────────────────────────────────────────
    const recurringCosts = filtered.filter((c) => c.recurring);
    const oneTimeCosts = filtered.filter((c) => !c.recurring);

    const totalCents = filtered.reduce((sum, c) => sum + c.amount_cents, 0);

    return NextResponse.json({
      summary: {
        total_costs: filtered.length,
        total_amount_cents: totalCents,
        recurring_count: recurringCosts.length,
        recurring_total_cents: recurringCosts.reduce((s, c) => s + c.amount_cents, 0),
        one_time_count: oneTimeCosts.length,
        one_time_total_cents: oneTimeCosts.reduce((s, c) => s + c.amount_cents, 0),
      },
      by_category: byCategory,
      by_property: byProperty,
      monthly_trend,
      top_vendors,
      filters_applied: {
        property_id: propertyId ?? null,
        start_date: startDate ?? null,
        end_date: endDate ?? null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate cost summary', detail: error.message },
      { status: 500 },
    );
  }
}
