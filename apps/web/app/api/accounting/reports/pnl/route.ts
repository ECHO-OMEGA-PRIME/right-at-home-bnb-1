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

    // Unallocated lines (property_id null) used to be folded into WHICHEVER
    // property was asked for. Asking about each property in turn therefore
    // charged the whole company's overhead to every one of them, so no two
    // properties could be compared and the per-property figures did not sum to
    // the company total. They are now excluded and reported on their own line,
    // so the cost is still visible but belongs to nobody in particular.
    const unallocated = propertyFilter
      ? filtered.filter((l) => l.property_id === null)
      : [];
    if (propertyFilter) {
      filtered = filtered.filter((l) => l.property_id === propertyFilter);
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

    // The ledger is currently EMPTY (0 JournalEntry, 0 JournalEntryLine against
    // 27 seeded accounts), so this report returns zeros for a business with 762
    // confirmed bookings. Say so, rather than presenting a clean $0 P&L that
    // looks like a finished report of a business that did nothing.
    const ledgerEmpty = journalLines.length === 0;

    return NextResponse.json({
      report: 'profit_and_loss',
      period: { start: startDate, end: endDate },
      property_id: propertyFilter ?? 'all',
      source: 'journal_ledger',
      ledger_empty: ledgerEmpty,
      warnings: ledgerEmpty
        ? [
            'No journal entries exist for this period, so every figure below is zero because nothing has been posted to the ledger — not because the business had no activity. For revenue actually recorded against properties, use /api/accounting/reports/property-pnl.',
          ]
        : [],
      // Costs that belong to the business rather than to one property. Only
      // populated when a single property was requested; otherwise they are
      // already inside the totals.
      unallocated: propertyFilter
        ? {
            note: 'Not included in the figures above — company-level lines that are not attributable to this property.',
            debit_cents: unallocated.reduce((s, l) => s + l.debit_cents, 0),
            credit_cents: unallocated.reduce((s, l) => s + l.credit_cents, 0),
          }
        : null,
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
