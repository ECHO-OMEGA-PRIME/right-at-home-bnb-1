import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { listCosts } from '@/lib/costs';

// Backed by the real Expense table (queue #26855). Every figure here --
// monthly trend, top vendors, recurring vs one-time -- was previously derived
// from a hardcoded array, so the cost analysis a purchasing decision would rest
// on was invented.
//
// Aggregation logic is unchanged; only the source is.

// ── GET /api/costs/summary ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const propertyId = params.get('property_id');
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');

    const filtered = await listCosts({ propertyId, startDate, endDate });

    const totalCents = filtered.reduce((s, c) => s + c.amount_cents, 0);

    const byCategory: Record<string, { count: number; total_cents: number }> = {};
    for (const c of filtered) {
      byCategory[c.category] ??= { count: 0, total_cents: 0 };
      byCategory[c.category].count += 1;
      byCategory[c.category].total_cents += c.amount_cents;
    }

    const byProperty: Record<string, { count: number; total_cents: number }> = {};
    for (const c of filtered) {
      // Costs with no property are genuinely unattributed (general supplies,
      // marketing); excluded rather than bucketed under a fabricated key.
      if (!c.property_id) continue;
      byProperty[c.property_id] ??= { count: 0, total_cents: 0 };
      byProperty[c.property_id].count += 1;
      byProperty[c.property_id].total_cents += c.amount_cents;
    }

    const monthlyMap: Record<string, number> = {};
    for (const c of filtered) {
      const month = c.date.substring(0, 7);
      monthlyMap[month] = (monthlyMap[month] || 0) + c.amount_cents;
    }
    const monthly_trend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total_cents]) => ({ month, total_cents }));

    const vendorMap: Record<string, { count: number; total_cents: number }> = {};
    for (const c of filtered) {
      const v = c.vendor || 'Unknown';
      vendorMap[v] ??= { count: 0, total_cents: 0 };
      vendorMap[v].count += 1;
      vendorMap[v].total_cents += c.amount_cents;
    }
    const top_vendors = Object.entries(vendorMap)
      .map(([vendor, data]) => ({ vendor, ...data }))
      .sort((a, b) => b.total_cents - a.total_cents)
      .slice(0, 10);

    const recurringCosts = filtered.filter((c) => c.recurring);
    const oneTimeCosts = filtered.filter((c) => !c.recurring);

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
      { error: 'Failed to build cost summary', detail: error.message },
      { status: 500 },
    );
  }
}
