import { NextRequest, NextResponse } from 'next/server';

// ── Account balances (derived from journal entries in production) ─────────
// In production, these would be SQL aggregations over the journal_entry_lines table.
// Here we simulate with realistic pre-computed balances.

interface AccountBalance {
  code: string;
  name: string;
  balance_cents: number;
  normal_side: 'debit' | 'credit';
}

const accountBalances: AccountBalance[] = [
  // Assets (1xxx) — debit-normal
  { code: '1000', name: 'Operating Checking', balance_cents: 4523100, normal_side: 'debit' },
  { code: '1010', name: 'Savings Account', balance_cents: 1500000, normal_side: 'debit' },
  { code: '1020', name: 'Petty Cash', balance_cents: 25000, normal_side: 'debit' },
  { code: '1100', name: 'Accounts Receivable', balance_cents: 140726, normal_side: 'debit' },
  { code: '1200', name: 'Security Deposits Held', balance_cents: 200000, normal_side: 'debit' },
  { code: '1500', name: 'Furniture & Equipment', balance_cents: 850000, normal_side: 'debit' },
  { code: '1510', name: 'Accumulated Depreciation', balance_cents: -170000, normal_side: 'debit' },

  // Liabilities (2xxx) — credit-normal
  { code: '2000', name: 'Accounts Payable', balance_cents: 35200, normal_side: 'credit' },
  { code: '2100', name: 'Sales Tax Payable', balance_cents: 42500, normal_side: 'credit' },
  { code: '2110', name: 'HOT Tax Payable', balance_cents: 28000, normal_side: 'credit' },
  { code: '2200', name: 'Payroll Tax Payable', balance_cents: 15300, normal_side: 'credit' },
  { code: '2300', name: 'Guest Deposits', balance_cents: 75000, normal_side: 'credit' },

  // Equity (3xxx) — credit-normal
  { code: '3000', name: "Owner's Equity", balance_cents: 500000, normal_side: 'credit' },
  { code: '3100', name: 'Retained Earnings', balance_cents: 2100000, normal_side: 'credit' },

  // Revenue (4xxx) — credit-normal (this month)
  { code: '4000', name: 'Rental Revenue', balance_cents: 875000, normal_side: 'credit' },
  { code: '4010', name: 'Cleaning Fee Revenue', balance_cents: 62500, normal_side: 'credit' },
  { code: '4020', name: 'Pet Fee Revenue', balance_cents: 15000, normal_side: 'credit' },
  { code: '4100', name: 'Late Fee Revenue', balance_cents: 5000, normal_side: 'credit' },

  // Expenses (5xxx, 6xxx) — debit-normal (this month)
  { code: '5000', name: 'Wage Expense', balance_cents: 320000, normal_side: 'debit' },
  { code: '5010', name: 'Employer Payroll Tax', balance_cents: 24480, normal_side: 'debit' },
  { code: '5100', name: 'Utilities Expense', balance_cents: 45000, normal_side: 'debit' },
  { code: '5200', name: 'Cleaning Supplies', balance_cents: 18500, normal_side: 'debit' },
  { code: '5300', name: 'Maintenance & Repairs', balance_cents: 32000, normal_side: 'debit' },
  { code: '5400', name: 'Insurance Expense', balance_cents: 25000, normal_side: 'debit' },
  { code: '6000', name: 'Platform Fees (VRBO/Airbnb)', balance_cents: 43750, normal_side: 'debit' },
  { code: '6100', name: 'Marketing & Advertising', balance_cents: 15000, normal_side: 'debit' },
  { code: '6200', name: 'Software & Subscriptions', balance_cents: 8500, normal_side: 'debit' },
  { code: '6300', name: 'Property Management', balance_cents: 12000, normal_side: 'debit' },
];

// ── GET /api/accounting/summary ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
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
