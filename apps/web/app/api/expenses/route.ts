import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { assertPeriodOpen, periodLockResponse } from '@/lib/period-lock';
import { postJournalEntry } from '@/lib/ledger';

// Expenses are real Expense rows, and each one posts a real double-entry
// journal entry. This route previously pushed onto in-memory arrays that were
// discarded on the next cold start, so "Expense recorded and journal entry
// created" was not true of anything durable (queue #26855).
//
// MONEY UNITS: Expense.amount is Float DOLLARS -- backend/routers/expenses.py
// documents it as "Expense amount in dollars". The API contract speaks
// amount_cents, so conversion happens once at each boundary.

const dollarsToCents = (d: number | null | undefined) => Math.round((d ?? 0) * 100);
const centsToDollars = (c: number) => c / 100;

const VALID_CATEGORIES = [
  'cleaning', 'maintenance', 'supplies', 'utilities',
  'insurance', 'mortgage', 'taxes', 'marketing',
  'software', 'furnishing', 'landscaping', 'travel',
  'professional_services', 'other',
];

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

interface ExpenseRow {
  id: string;
  category: string;
  description: string;
  amount: number;
  propertyId: string | null;
  vendor: string | null;
  paymentMethod: string | null;
  receiptUrl: string | null;
  date: Date;
  isTaxDeductible: boolean;
  notes: string | null;
  createdAt: Date;
}

const toContract = (e: ExpenseRow) => ({
  id: e.id,
  category: e.category,
  description: e.description,
  amount_cents: dollarsToCents(e.amount),
  property_id: e.propertyId,
  vendor: e.vendor,
  payment_method: e.paymentMethod ?? 'other',
  receipt_url: e.receiptUrl,
  date: e.date.toISOString().slice(0, 10),
  tax_deductible: e.isTaxDeductible,
  notes: e.notes,
  created_at: e.createdAt.toISOString(),
});

// ── GET /api/expenses ──────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const category = params.get('category');
    const propertyId = params.get('property_id');
    const vendor = params.get('vendor');
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');
    const taxDeductible = params.get('tax_deductible');

    // Filtering happens in the query rather than in memory.
    const rows = (await prisma.expense.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(propertyId ? { propertyId } : {}),
        ...(vendor ? { vendor: { contains: vendor, mode: 'insensitive' as const } } : {}),
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: new Date(`${startDate}T00:00:00.000Z`) } : {}),
                ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
        ...(taxDeductible !== null ? { isTaxDeductible: taxDeductible === 'true' } : {}),
      },
      orderBy: { date: 'desc' },
    })) as ExpenseRow[];

    const filtered = rows.map(toContract);
    const totalCents = filtered.reduce((s, e) => s + e.amount_cents, 0);

    const byCategory: Record<string, number> = {};
    const byPaymentMethod: Record<string, number> = {};
    for (const e of filtered) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_cents;
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

// ── POST /api/expenses ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    if (!body.category || !body.description || typeof body.amount_cents !== 'number') {
      return NextResponse.json(
        { error: 'Missing required: category, description, amount_cents' },
        { status: 400 },
      );
    }
    if (!Number.isInteger(body.amount_cents) || body.amount_cents <= 0) {
      return NextResponse.json(
        { error: 'amount_cents must be a positive integer' },
        { status: 400 },
      );
    }
    if (!VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 },
      );
    }

    const expenseDate = new Date(
      `${body.date ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
    );

    // Closed books stay closed (P5-1). Checked before the write, not after, so
    // a rejected expense leaves nothing behind.
    await assertPeriodOpen(expenseDate);

    const created = (await prisma.expense.create({
      data: {
        category: body.category,
        description: body.description,
        amount: centsToDollars(body.amount_cents),
        propertyId: body.property_id ?? null,
        vendor: body.vendor ?? null,
        paymentMethod: body.payment_method ?? 'other',
        receiptUrl: body.receipt_url ?? null,
        date: expenseDate,
        isTaxDeductible: body.tax_deductible ?? true,
        notes: body.notes ?? null,
      },
    })) as ExpenseRow;

    // Post the matching double-entry: debit the expense account, credit cash
    // (or A/P when it went on a card). postJournalEntry refuses to write an
    // unbalanced entry, so a mistake here fails loudly instead of corrupting
    // the ledger.
    const expenseAccount = categoryToAccountCode(body.category);
    const paymentAccountCode = body.payment_method === 'credit_card' ? '2000' : '1000';

    let journalEntry: unknown = null;
    let journalError: string | null = null;
    try {
      journalEntry = await postJournalEntry({
        entryDate: expenseDate,
        memo: `Expense: ${body.description}`,
        reference: `expense:${created.id}`,
        propertyId: body.property_id ?? null,
        lines: [
          { accountCode: expenseAccount.code, debitCents: body.amount_cents },
          { accountCode: paymentAccountCode, creditCents: body.amount_cents },
        ],
      });
    } catch (e: any) {
      // The expense is real and already saved; surface the posting failure
      // rather than silently reporting success for a ledger write that did not
      // happen (e.g. the chart of accounts is missing a code).
      journalError = e.message;
    }

    return NextResponse.json(
      {
        expense: toContract(created),
        journal_entry: journalEntry,
        ...(journalError ? { journal_error: journalError } : {}),
        message: journalError
          ? 'Expense recorded; journal entry FAILED'
          : 'Expense recorded and journal entry created',
      },
      { status: 201 },
    );
  } catch (error: any) {
    // A locked accounting period is a REFUSAL, not a fault. Returning the
    // generic 500 below would tell the caller the system broke when it did
    // exactly what it was built to do, and the reason would be lost.
    const locked = periodLockResponse(error);
    if (locked) return NextResponse.json(locked.body, { status: locked.status });

    return NextResponse.json(
      { error: 'Failed to create expense', detail: error.message },
      { status: 500 },
    );
  }
}
