import { NextRequest, NextResponse } from 'next/server';

const payrollRuns: any[] = [
  {
    id: 'PR-001',
    pay_period_start: '2026-03-01',
    pay_period_end: '2026-03-15',
    pay_date: '2026-03-18',
    status: 'processed',
    total_gross_cents: 106000,
    total_net_cents: 82890,
    total_employer_tax_cents: 8109,
    total_cost_cents: 114109,
    employee_count: 3,
    items: [
      {
        employee_id: 'EMP-001', employee_name: 'Maria Garcia', role: 'cleaner',
        gross_cents: 54000, net_cents: 43200, employer_taxes: { total_cents: 4131 },
      },
      {
        employee_id: 'EMP-002', employee_name: 'James Wilson', role: 'maintenance',
        gross_cents: 88000, net_cents: 67690, employer_taxes: { total_cents: 6734 },
      },
      {
        employee_id: 'EMP-003', employee_name: 'Lisa Chen', role: 'manager',
        gross_cents: 520000, net_cents: 385000, employer_taxes: { total_cents: 39780 },
      },
    ],
    journal_entry_id: null,
    created_at: '2026-03-16T08:00:00Z',
    updated_at: '2026-03-18T09:00:00Z',
  },
];

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/payroll/runs/[id] ───────────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const run = payrollRuns.find((r) => r.id === id);

    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    return NextResponse.json({ payroll_run: run });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get payroll run', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PATCH /api/payroll/runs/[id] ─────────────────────────────────────────
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idx = payrollRuns.findIndex((r) => r.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    const body = await request.json();
    const run = { ...payrollRuns[idx] };
    const validStatuses = ['draft', 'approved', 'processed', 'cancelled'];

    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `status required and must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    // Prevent invalid transitions
    if (run.status === 'processed' && body.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Processed payroll runs can only be cancelled' },
        { status: 400 },
      );
    }
    if (run.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cancelled payroll runs cannot be modified' },
        { status: 400 },
      );
    }

    let journalEntry = null;

    // When approved or processed, create the payroll journal entry
    if (body.status === 'approved' || body.status === 'processed') {
      const jeId = `JE-PR-${Date.now().toString(36).toUpperCase()}`;

      // Build journal entry:
      // Debit: Wage Expense (gross), Employer Payroll Tax Expense (employer taxes)
      // Credit: Checking (net pay), Federal Tax Payable, SS Payable, Medicare Payable, FUTA/SUTA Payable
      const totalGross = run.total_gross_cents;
      const totalNet = run.total_net_cents;
      const totalEmployerTax = run.total_employer_tax_cents;
      const totalDeductions = totalGross - totalNet; // employee withholdings
      const totalCheck = totalNet; // what goes out of checking
      const taxLiabilities = totalDeductions + totalEmployerTax; // what we owe tax authorities

      journalEntry = {
        id: jeId,
        date: run.pay_date,
        reference_type: 'payroll',
        reference_id: run.id,
        description: `Payroll ${run.pay_period_start} to ${run.pay_period_end}`,
        lines: [
          {
            account_code: '5000',
            account_name: 'Wage Expense',
            debit_cents: totalGross,
            credit_cents: 0,
          },
          {
            account_code: '5010',
            account_name: 'Employer Payroll Tax Expense',
            debit_cents: totalEmployerTax,
            credit_cents: 0,
          },
          {
            account_code: '1000',
            account_name: 'Operating Checking',
            debit_cents: 0,
            credit_cents: totalCheck,
          },
          {
            account_code: '2200',
            account_name: 'Payroll Tax Payable',
            debit_cents: 0,
            credit_cents: taxLiabilities,
          },
        ],
        created_at: new Date().toISOString(),
      };

      // Verify balanced
      const debits = journalEntry.lines.reduce((s: number, l: any) => s + l.debit_cents, 0);
      const credits = journalEntry.lines.reduce((s: number, l: any) => s + l.credit_cents, 0);
      if (debits !== credits) {
        return NextResponse.json(
          { error: 'Internal error: payroll journal entry is unbalanced', debits, credits },
          { status: 500 },
        );
      }

      run.journal_entry_id = jeId;
    }

    run.status = body.status;
    run.updated_at = new Date().toISOString();
    payrollRuns[idx] = run;

    return NextResponse.json({
      payroll_run: run,
      journal_entry: journalEntry,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update payroll run', detail: error.message },
      { status: 500 },
    );
  }
}
