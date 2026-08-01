import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { accountBalances } from '@/lib/ledger';

// Real balances aggregated from JournalEntryLine (queue #26855). This report
// previously returned a hardcoded balance sheet whose own comment admitted
// "here we simulate with realistic balances" -- a statement of financial
// position that was entirely invented.
//
// Accounts are grouped by code, matching the chart of accounts:
//   1000-1499 current assets    1500+ fixed assets
//   2000-2499 current liabs     2500+ long-term liabs
//   3xxx      equity            4xxx revenue, 5xxx/6xxx expense
//
// CURRENT PERIOD NET INCOME is DERIVED (revenue - expenses) and added to
// equity. Without it the sheet cannot balance for a live ledger: income has not
// yet been closed to retained earnings, so assets would exceed
// liabilities + equity by exactly the period's profit. Deriving it is what
// makes balance_check a real assertion rather than decoration.

const numeric = (code: string) => parseInt(code, 10) || 0;

// ── GET /api/accounting/reports/balance-sheet ─────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const asOf = params.get('as_of') ?? new Date().toISOString().split('T')[0];

    // Balances up to and including the as_of date.
    const balances = await accountBalances({ to: new Date(`${asOf}T23:59:59.999Z`) });
    const pick = (predicate: (code: number) => boolean) =>
      balances
        .filter((b) => predicate(numeric(b.code)))
        .map((b) => ({ code: b.code, name: b.name, balance_cents: b.balance_cents }));

    const assets = {
      current: pick((c) => c >= 1000 && c < 1500),
      fixed: pick((c) => c >= 1500 && c < 2000),
    };
    const liabilities = {
      current: pick((c) => c >= 2000 && c < 2500),
      long_term: pick((c) => c >= 2500 && c < 3000),
    };

    const revenueTotal = balances
      .filter((b) => numeric(b.code) >= 4000 && numeric(b.code) < 5000)
      .reduce((s, b) => s + b.balance_cents, 0);
    const expenseTotal = balances
      .filter((b) => numeric(b.code) >= 5000 && numeric(b.code) < 7000)
      .reduce((s, b) => s + b.balance_cents, 0);
    const netIncomeCents = revenueTotal - expenseTotal;

    const equity = [
      ...pick((c) => c >= 3000 && c < 4000),
      {
        code: '3200',
        name: 'Current Period Net Income',
        balance_cents: netIncomeCents,
      },
    ];

    const totalCurrentAssets = assets.current.reduce((s, a) => s + a.balance_cents, 0);
    const totalFixedAssets = assets.fixed.reduce((s, a) => s + a.balance_cents, 0);
    const totalAssets = totalCurrentAssets + totalFixedAssets;

    const totalCurrentLiabilities = liabilities.current.reduce((s, l) => s + l.balance_cents, 0);
    const totalLongTermLiabilities = liabilities.long_term.reduce((s, l) => s + l.balance_cents, 0);
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

    const totalEquity = equity.reduce((s, e) => s + e.balance_cents, 0);
    const balanceCheck = totalAssets === totalLiabilities + totalEquity;

    return NextResponse.json({
      report: 'balance_sheet',
      as_of: asOf,
      assets: {
        current: { items: assets.current, total_cents: totalCurrentAssets },
        fixed: { items: assets.fixed, total_cents: totalFixedAssets },
        total_cents: totalAssets,
      },
      liabilities: {
        current: { items: liabilities.current, total_cents: totalCurrentLiabilities },
        long_term: { items: liabilities.long_term, total_cents: totalLongTermLiabilities },
        total_cents: totalLiabilities,
      },
      equity: { items: equity, total_cents: totalEquity },
      liabilities_plus_equity_cents: totalLiabilities + totalEquity,
      balance_check: balanceCheck,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate balance sheet', detail: error.message },
      { status: 500 },
    );
  }
}
