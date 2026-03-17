import { NextRequest, NextResponse } from 'next/server';

// ── Mock journal entries ─────────────────────────────────────────────────
const journalEntries: any[] = [
  {
    id: 'JE-001',
    date: '2026-03-10',
    reference_type: 'booking',
    reference_id: 'BK-001',
    description: 'Booking BK-001 — 3 nights at Sunset Retreat',
    lines: [
      { account_code: '1100', account_name: 'Accounts Receivable', debit_cents: 70363, credit_cents: 0 },
      { account_code: '4000', account_name: 'Rental Revenue', debit_cents: 0, credit_cents: 65000 },
      { account_code: '2100', account_name: 'Sales Tax Payable', debit_cents: 0, credit_cents: 5363 },
    ],
    created_at: '2026-03-10T14:30:00Z',
  },
  {
    id: 'JE-002',
    date: '2026-03-10',
    reference_type: 'payment',
    reference_id: 'PAY-001',
    description: 'Payment received for BK-001 via Stripe',
    lines: [
      { account_code: '1000', account_name: 'Cash — Operating', debit_cents: 70363, credit_cents: 0 },
      { account_code: '1100', account_name: 'Accounts Receivable', debit_cents: 0, credit_cents: 70363 },
    ],
    created_at: '2026-03-10T15:00:00Z',
  },
  {
    id: 'JE-003',
    date: '2026-03-12',
    reference_type: 'expense',
    reference_id: 'EXP-001',
    description: 'Cleaning supplies purchased — H-E-B',
    lines: [
      { account_code: '5200', account_name: 'Cleaning Supplies', debit_cents: 8450, credit_cents: 0 },
      { account_code: '1000', account_name: 'Cash — Operating', debit_cents: 0, credit_cents: 8450 },
    ],
    created_at: '2026-03-12T10:00:00Z',
  },
  {
    id: 'JE-004',
    date: '2026-03-15',
    reference_type: 'payroll',
    reference_id: 'PR-001',
    description: 'Payroll run — March 1-15',
    lines: [
      { account_code: '5100', account_name: 'Wages Expense', debit_cents: 320000, credit_cents: 0 },
      { account_code: '5110', account_name: 'Payroll Tax Expense', debit_cents: 24480, credit_cents: 0 },
      { account_code: '2200', account_name: 'Federal Tax Withholding', debit_cents: 0, credit_cents: 44800 },
      { account_code: '2210', account_name: 'FICA Withholding', debit_cents: 0, credit_cents: 24480 },
      { account_code: '2220', account_name: 'Employer FICA Payable', debit_cents: 0, credit_cents: 24480 },
      { account_code: '1000', account_name: 'Cash — Operating', debit_cents: 0, credit_cents: 250720 },
    ],
    created_at: '2026-03-15T12:00:00Z',
  },
];

function generateId(): string {
  return `JE-${Date.now().toString(36).toUpperCase()}`;
}

// ── GET /api/accounting/journal-entries ───────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');
    const referenceType = params.get('reference_type');

    let filtered = [...journalEntries];

    if (startDate) {
      filtered = filtered.filter((je) => je.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((je) => je.date <= endDate);
    }
    if (referenceType) {
      filtered = filtered.filter((je) => je.reference_type === referenceType);
    }

    return NextResponse.json({
      journal_entries: filtered,
      total: filtered.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list journal entries', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/accounting/journal-entries ──────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.date || !body.description || !Array.isArray(body.lines) || body.lines.length < 2) {
      return NextResponse.json(
        { error: 'Required: date, description, lines (array with at least 2 entries)' },
        { status: 400 },
      );
    }

    // Validate each line
    for (const line of body.lines) {
      if (!line.account_code || !line.account_name) {
        return NextResponse.json(
          { error: 'Each line must have account_code and account_name' },
          { status: 400 },
        );
      }
      if (typeof line.debit_cents !== 'number' || typeof line.credit_cents !== 'number') {
        return NextResponse.json(
          { error: 'Each line must have numeric debit_cents and credit_cents' },
          { status: 400 },
        );
      }
      if (line.debit_cents < 0 || line.credit_cents < 0) {
        return NextResponse.json(
          { error: 'debit_cents and credit_cents must be non-negative' },
          { status: 400 },
        );
      }
    }

    // CRITICAL: Validate debits = credits (double-entry accounting)
    const totalDebits = body.lines.reduce((s: number, l: any) => s + l.debit_cents, 0);
    const totalCredits = body.lines.reduce((s: number, l: any) => s + l.credit_cents, 0);

    if (totalDebits !== totalCredits) {
      return NextResponse.json(
        {
          error: 'Journal entry is unbalanced. Total debits must equal total credits.',
          total_debits_cents: totalDebits,
          total_credits_cents: totalCredits,
          difference_cents: Math.abs(totalDebits - totalCredits),
        },
        { status: 400 },
      );
    }

    const entry = {
      id: generateId(),
      date: body.date,
      reference_type: body.reference_type || 'manual',
      reference_id: body.reference_id || null,
      description: body.description,
      lines: body.lines,
      created_at: new Date().toISOString(),
    };

    journalEntries.push(entry);

    return NextResponse.json({ journal_entry: entry }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create journal entry', detail: error.message },
      { status: 500 },
    );
  }
}
