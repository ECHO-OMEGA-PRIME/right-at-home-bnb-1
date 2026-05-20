import { NextRequest, NextResponse } from 'next/server';

// ── GET /api/accounting/reports/balance-sheet ─────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const asOf = params.get('as_of') ?? new Date().toISOString().split('T')[0];

    // In production, these balances come from aggregating journal_entry_lines
    // up to the as_of date. Here we simulate with realistic balances.

    const assets = {
      current: [
        { code: '1000', name: 'Operating Checking', balance_cents: 4523100 },
        { code: '1010', name: 'Savings Account', balance_cents: 1500000 },
        { code: '1020', name: 'Petty Cash', balance_cents: 25000 },
        { code: '1100', name: 'Accounts Receivable', balance_cents: 140726 },
        { code: '1110', name: 'Prepaid Insurance', balance_cents: 75000 },
        { code: '1200', name: 'Security Deposits Receivable', balance_cents: 200000 },
      ],
      fixed: [
        { code: '1500', name: 'Furniture & Equipment', balance_cents: 850000 },
        { code: '1510', name: 'Accumulated Depreciation', balance_cents: -170000 },
        { code: '1600', name: 'Leasehold Improvements', balance_cents: 420000 },
        { code: '1610', name: 'Accum Depreciation — Improvements', balance_cents: -84000 },
      ],
    };

    const liabilities = {
      current: [
        { code: '2000', name: 'Accounts Payable', balance_cents: 35200 },
        { code: '2100', name: 'Sales Tax Payable', balance_cents: 42500 },
        { code: '2110', name: 'HOT Tax Payable', balance_cents: 28000 },
        { code: '2200', name: 'Payroll Tax Payable', balance_cents: 15300 },
        { code: '2300', name: 'Guest Deposits', balance_cents: 75000 },
        { code: '2400', name: 'Accrued Expenses', balance_cents: 18000 },
      ],
      long_term: [
        { code: '2500', name: 'Owner Loan Payable', balance_cents: 0 },
      ],
    };

    const equity = [
      { code: '3000', name: "Owner's Equity", balance_cents: 500000 },
      { code: '3100', name: 'Retained Earnings', balance_cents: 2100000 },
      { code: '3200', name: 'Current Period Net Income', balance_cents: 413270 },
    ];

    // Compute totals
    const totalCurrentAssets = assets.current.reduce((s, a) => s + a.balance_cents, 0);
    const totalFixedAssets = assets.fixed.reduce((s, a) => s + a.balance_cents, 0);
    const totalAssets = totalCurrentAssets + totalFixedAssets;

    const totalCurrentLiabilities = liabilities.current.reduce((s, l) => s + l.balance_cents, 0);
    const totalLongTermLiabilities = liabilities.long_term.reduce((s, l) => s + l.balance_cents, 0);
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

    const totalEquity = equity.reduce((s, e) => s + e.balance_cents, 0);

    // Verify A = L + E (accounting equation)
    const balanceCheck = totalAssets === totalLiabilities + totalEquity;

    return NextResponse.json({
      report: 'balance_sheet',
      as_of: asOf,
      assets: {
        current: {
          items: assets.current,
          total_cents: totalCurrentAssets,
        },
        fixed: {
          items: assets.fixed,
          total_cents: totalFixedAssets,
        },
        total_cents: totalAssets,
      },
      liabilities: {
        current: {
          items: liabilities.current,
          total_cents: totalCurrentLiabilities,
        },
        long_term: {
          items: liabilities.long_term,
          total_cents: totalLongTermLiabilities,
        },
        total_cents: totalLiabilities,
      },
      equity: {
        items: equity,
        total_cents: totalEquity,
      },
      liabilities_plus_equity_cents: totalLiabilities + totalEquity,
      balanced: balanceCheck,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate balance sheet', detail: error.message },
      { status: 500 },
    );
  }
}
