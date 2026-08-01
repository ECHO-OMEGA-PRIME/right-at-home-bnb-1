import { prisma } from '@/lib/prisma';

/**
 * Cost tracking (queue #26855).
 *
 * /api/costs and /api/expenses were two separate hardcoded arrays describing
 * the same thing: money the business spent. Backing both with the Expense table
 * means a cost recorded through either route appears in the other, and in the
 * P&L, rather than the business having two disagreeing spend ledgers.
 *
 * That unification is a deliberate behaviour change, not an accident of
 * implementation: two sources of truth for spend is how a P&L quietly stops
 * matching the bank.
 *
 * MONEY: Expense.amount is Float DOLLARS (backend/routers/expenses.py documents
 * it). The contract speaks cents, so conversion happens once at the boundary.
 */

export const dollarsToCents = (d: number | null | undefined) => Math.round((d ?? 0) * 100);
export const centsToDollars = (c: number) => c / 100;

export const VALID_COST_CATEGORIES = [
  'cleaning', 'maintenance', 'supplies', 'utilities',
  'insurance', 'mortgage', 'taxes', 'marketing',
  'software', 'furnishing', 'landscaping', 'other',
];

interface ExpenseRow {
  id: string;
  category: string;
  description: string;
  amount: number;
  propertyId: string | null;
  bookingId: string | null;
  vendor: string | null;
  recurring: boolean;
  date: Date;
  notes: string | null;
  createdAt: Date;
}

export function toCostContract(e: ExpenseRow) {
  return {
    id: e.id,
    category: e.category,
    description: e.description,
    amount_cents: dollarsToCents(e.amount),
    property_id: e.propertyId,
    booking_id: e.bookingId,
    vendor: e.vendor,
    date: e.date.toISOString().slice(0, 10),
    recurring: e.recurring,
    notes: e.notes,
    created_at: e.createdAt.toISOString(),
  };
}

export async function listCosts(opts: {
  category?: string | null;
  propertyId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  recurring?: string | null;
}) {
  const rows = (await prisma.expense.findMany({
    where: {
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.propertyId ? { propertyId: opts.propertyId } : {}),
      ...(opts.recurring !== null && opts.recurring !== undefined
        ? { recurring: opts.recurring === 'true' }
        : {}),
      ...(opts.startDate || opts.endDate
        ? {
            date: {
              ...(opts.startDate ? { gte: new Date(`${opts.startDate}T00:00:00.000Z`) } : {}),
              ...(opts.endDate ? { lte: new Date(`${opts.endDate}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: 'desc' },
  })) as ExpenseRow[];

  return rows.map(toCostContract);
}
