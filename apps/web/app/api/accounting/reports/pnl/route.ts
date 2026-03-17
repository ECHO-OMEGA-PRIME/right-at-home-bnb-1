import { NextRequest, NextResponse } from 'next/server';

// ── Mock journal data for P&L computation ────────────────────────────────
const journalLines: any[] = [
  // Revenue entries
  { date: '2026-03-01', account_code: '4000', account_name: 'Rental Revenue', debit_cents: 0, credit_cents: 175000, property_id: 'PROP-001' },
  { date: '2026-03-05', account_code: '4000', account_name: 'Rental Revenue', debit_cents: 0, credit_cents: 225000, property_id: 'PROP-002' },
  { date: '2026-03-10', account_code: '4000', account_name: 'Rental Revenue', debit_cents: 0, credit_cents: 350000, property_id: 'PROP-001' },
  { date: '2026-03-12', account_code: '4000', account_name: 'Rental Revenue', debit_cents: 0, credit_cents: 125000, property_id: 'PROP-002' },
  { date: '2026-03-01', account_code: '4010', account_name: 'Cleaning Fee Revenue', debit_cents: 0, credit_cents: 25000, property_id: 'PROP-001' },
  { date: '2026-03-05', account_code: '4010', account_name: 'Cleaning Fee Revenue', debit_cents: 0, credit_cents: 37500, property_id: 'PROP-002' },
  { date: '2026-03-08', account_code: '4020', account_name: 'Pet Fee Revenue', debit_cents: 0, credit_cents: 15000, property_id: 'PROP-001' },

  // Expense entries
  { date: '2026-03-01', account_code: '5000', account_name: 'Wage Expense', debit_cents: 160000, credit_cents: 0, property_id: null },
  { date: '2026-03-15', account_code: '5000', account_name: 'Wage Expense', debit_cents: 160000, credit_cents: 0, property_id: null },
  { date: '2026-03-01', account_code: '5010', account_name: 'Employer Payroll Tax', debit_cents: 12240, credit_cents: 0, property_id: null },
  { date: '2026-03-15', account_code: '5010', account_name: 'Employer Payroll Tax', debit_cents: 12240, credit_cents: 0, property_id: null },
  { date: '2026-03-02', account_code: '5100', account_name: 'Utilities', debit_cents: 22000, credit_cents: 0, property_id: 'PROP-001' },
  { date: '2026-03-02', account_code: '5100', account_name: 'Utilities', debit_cents: 23000, credit_cents: 0, property_id: 'PROP-002' },
  { date: '2026-03-05', account_code: '5200', account_name: 'Cleaning Supplies', debit_cents: 8500, credit_cents: 0, property_id: 'PROP-001' },
  { date: '2026-03-07', account_code: '5200', account_name: 'Cleaning Supplies', debit_cents: 10000, credit_cents: 0, property_id: 'PROP-002' },
  { date: '2026-03-10', account_code: '5300', account_name: 'Maintenance & Repairs', debit_cents: 32000, credit_cents: 0, property_id: 'PROP-001' },
  { date: '2026-03-01', account_code: '5400', account_name: 'Insurance', debit_cents: 25000, credit_cents: 0, property_id: null },
  { date: '2026-03-08', account_code: '6000', account_name: 'Platform Fees', debit_cents: 43750, credit_cents: 0, property_id: null },
  { date: '2026-03-10', account_code: '6100', account_name: 'Marketing', debit_cents: 15000, credit_cents: 0, property_id: null },
  { date: '2026-03-01', account_code: '6200', account_name: 'Software & Subs', debit_cents: 8500, credit_cents: 0, property_id: null },
  { date: '2026-03-01', account_code: '6300', account_name: 'Property Management', debit_cents: 12000, credit_cents: 0, property_id: null },
];

// ── GET /api/accounting/reports/pnl ──────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const startDate = params.get('start') ?? new Date().toISOString().slice(0, 8) + '01';
    const endDate = params.get('end') ?? new Date().toISOString().split('T')[0];
    const propertyFilter = params.get('property_id');

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
