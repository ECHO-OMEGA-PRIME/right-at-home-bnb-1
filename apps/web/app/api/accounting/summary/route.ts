import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { accountBalances as ledgerAccountBalances } from '@/lib/ledger';

// Account balances are computed from real JournalEntryLine rows by
// @/lib/ledger. This route previously derived every figure from a hardcoded
// `accountBalances` array, so the endpoint returned confident numbers that
// were never real (queue #26855). The response contract is unchanged; only
// the data source is. With an empty ledger these are honest zeros rather
// than invented figures.

// ── GET /api/accounting/summary ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const accountBalances = await ledgerAccountBalances();

    // Revenue: 4xxx accounts this month
    const totalRevenueCents = accountBalances
      .filter((a) => a.code.startsWith('4'))
      .reduce((sum, a) => sum + a.balance_cents, 0);

    // Expenses: 5xxx + 6xxx this month
    const totalExpensesCents = accountBalances
      .filter((a) => a.code.startsWith('5') || a.code.startsWith('6'))
      .reduce((sum, a) => sum + a.balance_cents, 0);

    // Net income
    const netIncomeCents = totalRevenueCents - totalExpensesCents;

    // Cash balance: 1000 + 1010 + 1020
    const cashBalanceCents = accountBalances
      .filter((a) => ['1000', '1010', '1020'].includes(a.code))
      .reduce((sum, a) => sum + a.balance_cents, 0);

    // AR balance: 1100
    const arBalanceCents =
      accountBalances.find((a) => a.code === '1100')?.balance_cents ?? 0;

    // AP balance: 2000
    const apBalanceCents =
      accountBalances.find((a) => a.code === '2000')?.balance_cents ?? 0;

    // Build revenue breakdown
    const revenueBreakdown = accountBalances
      .filter((a) => a.code.startsWith('4'))
      .map((a) => ({ code: a.code, name: a.name, amount_cents: a.balance_cents }));

    // Build expense breakdown
    const expenseBreakdown = accountBalances
      .filter((a) => a.code.startsWith('5') || a.code.startsWith('6'))
      .map((a) => ({ code: a.code, name: a.name, amount_cents: a.balance_cents }));

    // Tax obligations
    const taxObligations = accountBalances
      .filter((a) => ['2100', '2110', '2200'].includes(a.code))
      .map((a) => ({ code: a.code, name: a.name, amount_cents: a.balance_cents }));

    return NextResponse.json({
      period: new Date().toISOString().slice(0, 7), // YYYY-MM
      total_revenue_cents: totalRevenueCents,
      total_expenses_cents: totalExpensesCents,
      net_income_cents: netIncomeCents,
      cash_balance_cents: cashBalanceCents,
      ar_balance_cents: arBalanceCents,
      ap_balance_cents: apBalanceCents,
      profit_margin_pct: totalRevenueCents > 0
        ? Math.round((netIncomeCents / totalRevenueCents) * 10000) / 100
        : 0,
      revenue_breakdown: revenueBreakdown,
      expense_breakdown: expenseBreakdown,
      tax_obligations: taxObligations,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate summary', detail: error.message },
      { status: 500 },
    );
  }
}
