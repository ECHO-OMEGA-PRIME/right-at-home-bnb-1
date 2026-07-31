/**
 * Property-level P&L (P5 objective 0).
 *
 * WHY THIS DOES NOT REPORT A PROFIT
 * The database holds 762 confirmed bookings worth $851,410 and ZERO recorded
 * costs: the Expense table is empty, and so is the double-entry ledger
 * (JournalEntry/JournalEntryLine are both at 0 rows, though 27 LedgerAccounts
 * are seeded). Revenue is real; there is no cost data at all.
 *
 * A P&L computed from that would show every property at a 100% margin. That is
 * not a conservative estimate or a rounding artefact — it is a number that
 * would tell the owner this business has no costs, which is the single most
 * misleading thing this report could say. So when a period has no recorded
 * costs, `net_income_cents` and `margin_pct` come back NULL with a stated
 * reason, not 0. A null forces a caller to render "unknown"; a zero lets it
 * render a profit.
 *
 * The moment expenses start being recorded, the same code produces a real
 * net income with no change — the nulls disappear on their own.
 *
 * REVENUE IS RECOGNISED AT CHECK-OUT
 * Bookings in this database run through October 2027. Recognising on booking
 * date (or counting every booking regardless of date) would book years of
 * future stays into the current period and inflate it enormously. A stay is
 * earned when it has been provided, so a booking lands in the period its
 * checkOut falls in. Money already collected for a future stay is a deposit —
 * a liability — not income, and is reported separately as `unearned`.
 *
 * TAXES COLLECTED ARE NOT REVENUE
 * Lodging tax collected from a guest is owed to the state; it passes through
 * this business. It is excluded from revenue and surfaced on its own line so
 * it can be remitted rather than spent. (Currently null on every row, i.e.
 * never recorded — which the report says rather than silently treating as 0.)
 */

import { prisma } from '@/lib/prisma';
import { type PropertyScope, isUnrestricted, scopeAllows } from '@/lib/tenant-scope';

/** Booking money columns are Float DOLLARS, not integer cents. */
function toCents(dollars: number | null | undefined): number {
  if (dollars === null || dollars === undefined || Number.isNaN(dollars)) return 0;
  // Round at the boundary: 0.1 + 0.2 arithmetic on dollars accumulates drift
  // that shows up as off-by-a-cent totals after a few hundred bookings.
  return Math.round(dollars * 100);
}

export interface PropertyPnLRow {
  property_id: string;
  property_name: string;
  bookings: number;
  nights: number;
  /** Room/stay revenue actually earned in the period. */
  accommodation_cents: number;
  cleaning_fee_cents: number;
  service_fee_cents: number;
  /** Pass-through liability, deliberately NOT part of revenue. */
  taxes_collected_cents: number;
  revenue_cents: number;
  cost_cents: number;
  /** null when no costs are recorded — see the file header. */
  net_income_cents: number | null;
  margin_pct: number | null;
  /** Collected for stays that end after this period; a deposit, not income. */
  unearned_cents: number;
}

export interface PropertyPnL {
  generated_at: string;
  period: { start: string; end: string };
  basis: 'checkout';
  scope: 'all_properties' | 'assigned_properties';
  rows: PropertyPnLRow[];
  totals: {
    bookings: number;
    revenue_cents: number;
    cost_cents: number;
    net_income_cents: number | null;
    margin_pct: number | null;
    unearned_cents: number;
  };
  /** Where cost figures came from, and whether any exist at all. */
  cost_sources: {
    expenses_recorded: number;
    journal_expense_lines: number;
    /** True when nothing anywhere records a cost for this period. */
    no_cost_data: boolean;
  };
  warnings: string[];
}

function marginPct(net: number | null, revenue: number): number | null {
  if (net === null || revenue <= 0) return null;
  return Math.round((net / revenue) * 10000) / 100;
}

/**
 * Build the per-property P&L for a period.
 *
 * Every property the caller is entitled to appears, including ones with no
 * bookings at all — a property earning nothing is the row an owner most needs
 * to see, and grouping from the booking table would silently drop it. (Two
 * properties currently have zero bookings.)
 */
export async function propertyPnL(
  scope: PropertyScope,
  start: Date,
  end: Date,
): Promise<PropertyPnL> {
  const properties = await prisma.property.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const visible = properties.filter((p) => scopeAllows(scope, p.id));
  const visibleIds = visible.map((p) => p.id);

  const [earned, future, expenses, journalLines] = await Promise.all([
    // Earned in the period: the stay finished inside it.
    prisma.booking.findMany({
      where: {
        propertyId: { in: visibleIds },
        status: { not: 'CANCELLED' },
        checkOut: { gte: start, lte: end },
      },
      select: {
        propertyId: true,
        totalNights: true,
        subtotal: true,
        cleaningFee: true,
        serviceFee: true,
        taxes: true,
      },
    }),
    // Booked and possibly paid, but the stay ends later: a deposit, not income.
    prisma.booking.findMany({
      where: {
        propertyId: { in: visibleIds },
        status: { not: 'CANCELLED' },
        checkOut: { gt: end },
      },
      select: { propertyId: true, subtotal: true, cleaningFee: true },
    }),
    prisma.expense.findMany({
      where: { propertyId: { in: visibleIds }, date: { gte: start, lte: end } },
      select: { propertyId: true, amount: true },
    }),
    // Expense-class ledger lines (5xxx cost of revenue, 6xxx operating).
    prisma.journalEntryLine.findMany({
      where: {
        propertyId: { in: visibleIds },
        journalEntry: { entryDate: { gte: start, lte: end } },
        account: { OR: [{ code: { startsWith: '5' } }, { code: { startsWith: '6' } }] },
      },
      select: { propertyId: true, debitCents: true, creditCents: true },
    }),
  ]);

  const blank = (): Omit<PropertyPnLRow, 'property_id' | 'property_name'> => ({
    bookings: 0,
    nights: 0,
    accommodation_cents: 0,
    cleaning_fee_cents: 0,
    service_fee_cents: 0,
    taxes_collected_cents: 0,
    revenue_cents: 0,
    cost_cents: 0,
    net_income_cents: null,
    margin_pct: null,
    unearned_cents: 0,
  });

  const acc = new Map(visible.map((p) => [p.id, blank()]));

  for (const b of earned) {
    const r = acc.get(b.propertyId);
    if (!r) continue;
    r.bookings += 1;
    r.nights += b.totalNights ?? 0;
    r.accommodation_cents += toCents(b.subtotal);
    r.cleaning_fee_cents += toCents(b.cleaningFee);
    r.service_fee_cents += toCents(b.serviceFee);
    r.taxes_collected_cents += toCents(b.taxes);
  }
  for (const b of future) {
    const r = acc.get(b.propertyId);
    if (!r) continue;
    r.unearned_cents += toCents(b.subtotal) + toCents(b.cleaningFee);
  }
  for (const e of expenses) {
    const r = e.propertyId ? acc.get(e.propertyId) : undefined;
    if (!r) continue;
    r.cost_cents += toCents(e.amount);
  }
  for (const l of journalLines) {
    const r = l.propertyId ? acc.get(l.propertyId) : undefined;
    if (!r) continue;
    // Expense accounts are debit-normal; a credit is a refund/reversal.
    r.cost_cents += l.debitCents - l.creditCents;
  }

  // Nothing anywhere recorded a cost for this period. Distinguish that from
  // "costs were recorded and happened to net to zero", which is a real result.
  const noCostData = expenses.length === 0 && journalLines.length === 0;

  const rows: PropertyPnLRow[] = visible.map((p) => {
    const r = acc.get(p.id)!;
    r.revenue_cents = r.accommodation_cents + r.cleaning_fee_cents + r.service_fee_cents;
    r.net_income_cents = noCostData ? null : r.revenue_cents - r.cost_cents;
    r.margin_pct = marginPct(r.net_income_cents, r.revenue_cents);
    return { property_id: p.id, property_name: p.name, ...r };
  });

  const sum = (pick: (r: PropertyPnLRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const totalRevenue = sum((r) => r.revenue_cents);
  const totalCost = sum((r) => r.cost_cents);
  const totalNet = noCostData ? null : totalRevenue - totalCost;

  const warnings: string[] = [];
  if (noCostData) {
    warnings.push(
      'No costs are recorded for this period — the Expense table and the journal ledger are both empty for it, so no profit or margin can be stated. Revenue below is real; it is not income.',
    );
  }
  if (rows.some((r) => r.taxes_collected_cents === 0) && totalRevenue > 0) {
    warnings.push(
      'No lodging tax is recorded on any booking. If tax is being collected, it is not being tracked here and cannot be remitted from this report.',
    );
  }
  const idle = rows.filter((r) => r.bookings === 0).length;
  if (idle > 0) {
    warnings.push(`${idle} propert${idle === 1 ? 'y' : 'ies'} earned nothing in this period.`);
  }

  return {
    generated_at: new Date().toISOString(),
    period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
    basis: 'checkout',
    scope: isUnrestricted(scope) ? 'all_properties' : 'assigned_properties',
    rows: rows.sort((a, b) => b.revenue_cents - a.revenue_cents),
    totals: {
      bookings: sum((r) => r.bookings),
      revenue_cents: totalRevenue,
      cost_cents: totalCost,
      net_income_cents: totalNet,
      margin_pct: marginPct(totalNet, totalRevenue),
      unearned_cents: sum((r) => r.unearned_cents),
    },
    cost_sources: {
      expenses_recorded: expenses.length,
      journal_expense_lines: journalLines.length,
      no_cost_data: noCostData,
    },
    warnings,
  };
}
