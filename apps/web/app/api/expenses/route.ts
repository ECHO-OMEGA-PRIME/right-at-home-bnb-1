import { NextRequest, NextResponse } from 'next/server';

const expenses: any[] = [
  {
    id: 'EXP-001',
    category: 'cleaning',
    description: 'Turnover clean \u2014 Sunset Retreat',
    amount_cents: 15000,
    property_id: 'PROP-001',
    vendor: 'Clean Brees LLC',
    payment_method: 'check',
    receipt_url: null,
    date: '2026-03-15',
    tax_deductible: true,
    notes: 'Standard turnover between guests',
    created_at: '2026-03-15T14:00:00Z',
  },
  {
    id: 'EXP-002',
    category: 'utilities',
    description: 'Electric \u2014 Sunset Retreat (March)',
    amount_cents: 19200,
    property_id: 'PROP-001',
    vendor: 'Oncor Electric',
    payment_method: 'autopay',
    receipt_url: null,
    date: '2026-03-01',
    tax_deductible: true,
    notes: null,
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'EXP-003',
    category: 'supplies',
    description: 'Guest amenities restock (soap, shampoo, coffee)',
    amount_cents: 8700,
    property_id: null,
    vendor: 'Amazon',
    payment_method: 'credit_card',
    receipt_url: null,
    date: '2026-03-10',
    tax_deductible: true,
    notes: 'Split across all 3 properties',
    created_at: '2026-03-10T16:00:00Z',
  },
  {
    id: 'EXP-004',
    category: 'maintenance',
    description: 'Garbage disposal replacement \u2014 Oilfield Oasis',
    amount_cents: 32500,
    property_id: 'PROP-002',
    vendor: 'Permian Plumbing',
    payment_method: 'check',
    receipt_url: null,
    date: '2026-03-08',
    tax_deductible: true,
    notes: 'InSinkErator Badger 5 installed. 3-year warranty.',
    created_at: '2026-03-08T11:00:00Z',
  },
  {
    id: 'EXP-005',
    category: 'marketing',
    description: 'VRBO listing boost \u2014 March campaign',
    amount_cents: 7500,
    property_id: null,
    vendor: 'VRBO/Expedia',
    payment_method: 'credit_card',
    receipt_url: null,
    date: '2026-03-01',
    tax_deductible: true,
    notes: 'Boost for Sunset Retreat and Oilfield Oasis listings',
    created_at: '2026-03-01T08:00:00Z',
  },
];

// Journal entries created from expenses (for accounting integration)
const journalEntries: any[] = [];

// ── GET /api/expenses ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const category = params.get('category');
    const propertyId = params.get('property_id');
    const vendor = params.get('vendor');
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');
    const taxDeductible = params.get('tax_deductible');

    let filtered = [...expenses];

    if (category) {
      filtered = filtered.filter((e) => e.category === category);
    }
    if (propertyId) {
      filtered = filtered.filter((e) => e.property_id === propertyId);
    }
    if (vendor) {
      const q = vendor.toLowerCase();
      filtered = filtered.filter((e) => e.vendor?.toLowerCase().includes(q));
    }
    if (startDate) {
      filtered = filtered.filter((e) => e.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((e) => e.date <= endDate);
    }
    if (taxDeductible !== null && taxDeductible !== undefined) {
      filtered = filtered.filter((e) => e.tax_deductible === (taxDeductible === 'true'));
    }

    const totalCents = filtered.reduce((sum, e) => sum + e.amount_cents, 0);

    // By category
    const byCategory: Record<string, { total_cents: number; count: number }> = {};
    for (const e of filtered) {
      if (!byCategory[e.category]) {
        byCategory[e.category] = { total_cents: 0, count: 0 };
      }
      byCategory[e.category].total_cents += e.amount_cents;
      byCategory[e.category].count += 1;
    }

    // By payment method
    const byPaymentMethod: Record<string, number> = {};
    for (const e of filtered) {
      byPaymentMethod[e.payment_method] = (byPaymentMethod[e.payment_method] ?? 0) + e.amount_cents;
    }

    return NextResponse.json({
      expenses: filtered,
      total: filtered.length,
      total_cents: totalCents,
      by_category: byCategory,
      by_payment_method: byPaymentMethod,
      tax_deductible_cents: filtered
        .filter((e) => e.tax_deductible)
        .reduce((sum, e) => sum + e.amount_cents, 0),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list expenses', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/expenses ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.category || !body.description || typeof body.amount_cents !== 'number') {
      return NextResponse.json(
        { error: 'Missing required: category, description, amount_cents' },
        { status: 400 },
      );
    }

    if (body.amount_cents <= 0) {
      return NextResponse.json(
        { error: 'amount_cents must be positive' },
        { status: 400 },
      );
    }

    const validCategories = [
      'cleaning', 'maintenance', 'supplies', 'utilities',
      'insurance', 'mortgage', 'taxes', 'marketing',
      'software', 'furnishing', 'landscaping', 'travel',
      'professional_services', 'other',
    ];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(', ')}` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const expenseDate = body.date ?? now.split('T')[0];

    const expense = {
      id: `EXP-${Date.now().toString(36).toUpperCase()}`,
      category: body.category,
      description: body.description,
      amount_cents: body.amount_cents,
      property_id: body.property_id ?? null,
      vendor: body.vendor ?? null,
      payment_method: body.payment_method ?? 'other',
      receipt_url: body.receipt_url ?? null,
      date: expenseDate,
      tax_deductible: body.tax_deductible ?? true,
      notes: body.notes ?? null,
      created_at: now,
    };

    expenses.push(expense);

    // Auto-create journal entry (debit expense account, credit cash/AP)
    const expenseAccountCode = categoryToAccountCode(body.category);
    const paymentAccountCode = body.payment_method === 'credit_card' ? '2000' : '1000';
    const paymentAccountName = body.payment_method === 'credit_card' ? 'Accounts Payable' : 'Operating Checking';

    const journalEntry = {
      id: `JE-${Date.now().toString(36).toUpperCase()}`,
      date: expenseDate,
      description: `Expense: ${body.description}`,
      reference_type: 'expense',
      reference_id: expense.id,
      property_id: body.property_id ?? null,
      lines: [
        {
          account_code: expenseAccountCode.code,
          account_name: expenseAccountCode.name,
          debit_cents: body.amount_cents,
          credit_cents: 0,
        },
        {
          account_code: paymentAccountCode,
          account_name: paymentAccountName,
          debit_cents: 0,
          credit_cents: body.amount_cents,
        },
      ],
      created_at: now,
    };

    journalEntries.push(journalEntry);

    return NextResponse.json({
      expense,
      journal_entry: journalEntry,
      message: 'Expense recorded and journal entry created',
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create expense', detail: error.message },
      { status: 500 },
    );
  }
}

function categoryToAccountCode(category: string): { code: string; name: string } {
  const map: Record<string, { code: string; name: string }> = {
    cleaning: { code: '5100', name: 'Cleaning Expense' },
    maintenance: { code: '5200', name: 'Maintenance & Repairs' },
    supplies: { code: '5300', name: 'Supplies Expense' },
    utilities: { code: '5400', name: 'Utilities Expense' },
    insurance: { code: '5500', name: 'Insurance Expense' },
    mortgage: { code: '5600', name: 'Mortgage/Rent Expense' },
    taxes: { code: '5700', name: 'Tax Expense' },
    marketing: { code: '5800', name: 'Marketing & Advertising' },
    software: { code: '5900', name: 'Software & Subscriptions' },
    furnishing: { code: '6100', name: 'Furniture & Equipment' },
    landscaping: { code: '6200', name: 'Landscaping & Exterior' },
    travel: { code: '6300', name: 'Travel Expense' },
    professional_services: { code: '6400', name: 'Professional Services' },
    other: { code: '6900', name: 'Other Expense' },
  };
  return map[category] ?? map.other;
}
