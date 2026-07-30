import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { reportJournalLines } from '@/lib/ledger';

// ── Mock journal data for P&L computation ────────────────────────────────
// Journal lines come from real JournalEntryLine rows via @/lib/ledger. This
// route previously aggregated a hardcoded `journalLines` array, so the P&L it
// reported was invented (queue #26855). The aggregation and filtering below
// are unchanged -- only the source is.

export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const startDate = params.get('start') ?? new Date().toISOString().slice(0, 8) + '01';
    const endDate = params.get('end') ?? new Date().toISOString().split('T')[0];
    const propertyFilter = params.get('property_id');

    const journalLines = await reportJournalLines({
      from: new Date(`${startDate}T00:00:00.000Z`),
      to: new Date(`${endDate}T23:59:59.999Z`),
    });

    // Filter by date range and optional property
    let filtered = journalLines.filter(
      (l) => l.date >= startDate && l.date <= endDate,
    );
    if (propertyFilter) {
      filtered = filtered.filter(
        (l) => l.property_id === propertyFilter || l.property_id === null,
      );
    }

    // Aggregate revenue lines (4xxx accounts — credit-normal)
    const revenueMap = new Map<string, { code: string; name: string; amount_cents: number }>();
    for (const line of filtered.filter((l) => l.account_code.startsWith('4'))) {
      const key = line.account_code;
      const existing = revenueMap.get(key) ?? { code: key, name: line.account_name, amount_cents: 0 };
      existing.amount_cents += line.credit_cents - line.debit_cents;
      revenueMap.set(key, existing);
    }

    // Aggregate expense lines (5xxx, 6xxx accounts — debit-normal)
    const expenseMap = new Map<string, { code: string; name: string; amount_cents: number }>();
    for (const line of filtered.filter(
      (l) => l.account_code.startsWith('5') || l.account_code.startsWith('6'),
    )) {
      const key = line.account_code;
      const existing = expenseMap.get(key) ?? { code: key, name: line.account_name, amount_cents: 0 };
      existing.amount_cents += line.debit_cents - line.credit_cents;
      expenseMap.set(key, existing);
    }

    const revenueLines = Array.from(revenueMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    );
    const expenseLines = Array.from(expenseMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    );

    const totalRevenueCents = revenueLines.reduce((s, r) => s + r.amount_cents, 0);
    const totalExpensesCents = expenseLines.reduce((s, e) => s + e.amount_cents, 0);
    const netIncomeCents = totalRevenueCents - totalExpensesCents;

    return NextResponse.json({
      report: 'profit_and_loss',
      period: { start: startDate, end: endDate },
      property_id: propertyFilter ?? 'all',
      revenue: {
        lines: revenueLines,
        total_cents: totalRevenueCents,
      },
      expenses: {
        lines: expenseLines,
        total_cents: totalExpensesCents,
      },
      net_income_cents: netIncomeCents,
      profit_margin_pct: totalRevenueCents > 0
        ? Math.round((netIncomeCents / totalRevenueCents) * 10000) / 100
        : 0,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate P&L report', detail: error.message },
      { status: 500 },
    );
  }
}
