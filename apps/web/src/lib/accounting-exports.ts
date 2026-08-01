/**
 * Tax and utilities exports (P5 objective 1).
 *
 * These produce the files an accountant actually files from, so every figure
 * here comes from a real table and the report says plainly when a table is
 * empty rather than emitting a tidy header-only CSV.
 *
 * WHY "EMPTY" HAS TO BE LOUD
 * The Expense table has no rows, so the utilities export has nothing in it. A
 * bare header row reads as "this business had no utility costs" — a defensible
 * reading of an empty file, and a completely wrong one. The JSON form carries a
 * warning, the CSV carries an X-Export-Rows header, and both distinguish "no
 * matching rows in this period" from "this table has never had a row in it".
 *
 * REVENUE IS RECOGNISED AT CHECK-OUT, matching src/lib/property-pnl.ts. A stay
 * is earned when it has been provided. Bookings here run into 2027, and a tax
 * export that counted them would report years of future stays as this year's
 * income.
 */

import { prisma } from '@/lib/prisma';
import { type PropertyScope, scopeAllows } from '@/lib/tenant-scope';
import { type CsvCell, money, raw } from '@/lib/csv';

export const EXPORT_REPORTS = ['revenue', 'utilities', 'tax-summary'] as const;
export type ExportReport = (typeof EXPORT_REPORTS)[number];

/** Expense categories that are utilities for filing purposes. */
const UTILITY_CATEGORIES = ['utilities'];

export interface ExportResult {
  report: ExportReport;
  period: { start: string; end: string };
  headers: string[];
  rows: CsvCell[][];
  /** Same data as objects, for the JSON form. */
  records: Record<string, unknown>[];
  warnings: string[];
  filename: string;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const dollars = (cents: number) => Math.round(cents) / 100;
const toCents = (d: number | null | undefined) =>
  d === null || d === undefined || Number.isNaN(d) ? 0 : Math.round(d * 100);

/**
 * Revenue by property for the period — the Schedule E line an owner files from.
 */
async function revenueExport(
  scope: PropertyScope,
  start: Date,
  end: Date,
): Promise<Omit<ExportResult, 'report' | 'period' | 'filename'>> {
  const properties = (
    await prisma.property.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
  ).filter((p) => scopeAllows(scope, p.id));

  const bookings = await prisma.booking.findMany({
    where: {
      propertyId: { in: properties.map((p) => p.id) },
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
  });

  const acc = new Map(
    properties.map((p) => [
      p.id,
      { nights: 0, bookings: 0, accommodation: 0, cleaning: 0, service: 0, tax: 0 },
    ]),
  );
  for (const b of bookings) {
    const a = acc.get(b.propertyId);
    if (!a) continue;
    a.bookings += 1;
    a.nights += b.totalNights ?? 0;
    a.accommodation += toCents(b.subtotal);
    a.cleaning += toCents(b.cleaningFee);
    a.service += toCents(b.serviceFee);
    a.tax += toCents(b.taxes);
  }

  const headers = [
    'property_id',
    'property_name',
    'bookings',
    'nights',
    'accommodation_revenue',
    'cleaning_fees',
    'service_fees',
    'gross_revenue',
    'lodging_tax_collected',
  ];

  const rows: CsvCell[][] = [];
  const records: Record<string, unknown>[] = [];
  let taxTotal = 0;

  for (const p of properties) {
    const a = acc.get(p.id)!;
    const gross = a.accommodation + a.cleaning + a.service;
    taxTotal += a.tax;
    // Every property is listed, including ones that earned nothing — a blank
    // line on a tax schedule is a question the owner needs to have answered.
    rows.push([
      p.id,
      p.name,
      raw(a.bookings),
      raw(a.nights),
      money(a.accommodation),
      money(a.cleaning),
      money(a.service),
      money(gross),
      money(a.tax),
    ]);
    records.push({
      property_id: p.id,
      property_name: p.name,
      bookings: a.bookings,
      nights: a.nights,
      accommodation_revenue: dollars(a.accommodation),
      cleaning_fees: dollars(a.cleaning),
      service_fees: dollars(a.service),
      gross_revenue: dollars(gross),
      lodging_tax_collected: dollars(a.tax),
    });
  }

  const warnings: string[] = [];
  if (bookings.length === 0) {
    warnings.push('No stays ended in this period, so there is no revenue to report for it.');
  }
  if (taxTotal === 0 && bookings.length > 0) {
    warnings.push(
      'Lodging tax is zero on every booking in this period. If tax is being collected it is not recorded here, and this export cannot be used to remit it.',
    );
  }
  warnings.push(
    'Revenue is counted when a stay CHECKS OUT, not when it was booked. Stays booked for later periods are excluded.',
  );

  return { headers, rows, records, warnings };
}

/**
 * Utility costs by property, itemised — the deductible-expense side of filing.
 */
async function utilitiesExport(
  scope: PropertyScope,
  start: Date,
  end: Date,
): Promise<Omit<ExportResult, 'report' | 'period' | 'filename'>> {
  const properties = (
    await prisma.property.findMany({ select: { id: true, name: true } })
  ).filter((p) => scopeAllows(scope, p.id));
  const nameById = new Map(properties.map((p) => [p.id, p.name]));

  const expenses = await prisma.expense.findMany({
    where: {
      category: { in: UTILITY_CATEGORIES },
      date: { gte: start, lte: end },
      propertyId: { in: properties.map((p) => p.id) },
    },
    orderBy: [{ date: 'asc' }],
    select: {
      id: true,
      date: true,
      propertyId: true,
      subcategory: true,
      vendor: true,
      description: true,
      amount: true,
      isTaxDeductible: true,
      paymentMethod: true,
      receiptUrl: true,
    },
  });

  const headers = [
    'expense_id',
    'date',
    'property_id',
    'property_name',
    'subcategory',
    'vendor',
    'description',
    'amount',
    'tax_deductible',
    'payment_method',
    'receipt_url',
  ];

  const rows: CsvCell[][] = expenses.map((e) => [
    e.id,
    raw(day(e.date)),
    e.propertyId,
    e.propertyId ? (nameById.get(e.propertyId) ?? '') : '',
    e.subcategory,
    e.vendor,
    e.description,
    money(toCents(e.amount)),
    raw(e.isTaxDeductible ? 'yes' : 'no'),
    e.paymentMethod,
    e.receiptUrl,
  ]);

  const records = expenses.map((e) => ({
    expense_id: e.id,
    date: day(e.date),
    property_id: e.propertyId,
    property_name: e.propertyId ? (nameById.get(e.propertyId) ?? null) : null,
    subcategory: e.subcategory,
    vendor: e.vendor,
    description: e.description,
    amount: dollars(toCents(e.amount)),
    tax_deductible: e.isTaxDeductible,
    payment_method: e.paymentMethod,
    receipt_url: e.receiptUrl,
  }));

  // "No utility rows in this period" and "no expense has ever been recorded"
  // produce an identical empty file and mean completely different things.
  const warnings: string[] = [];
  if (expenses.length === 0) {
    const anyExpenseAtAll = await prisma.expense.count();
    warnings.push(
      anyExpenseAtAll === 0
        ? 'The expense record is EMPTY — not one expense of any kind has ever been recorded, so this file being empty does not mean there were no utility costs. It means none were entered.'
        : 'No utility expenses fall in this period, though other expenses exist.',
    );
  }

  return { headers, rows, records, warnings };
}

/** Tax periods, their liability, and whether the period is closed. */
async function taxSummaryExport(
  start: Date,
  end: Date,
): Promise<Omit<ExportResult, 'report' | 'period' | 'filename'>> {
  const periods = await prisma.taxPeriod.findMany({
    where: { periodStart: { lte: end }, periodEnd: { gte: start } },
    orderBy: { periodStart: 'asc' },
  });

  const headers = [
    'period_id',
    'name',
    'type',
    'period_start',
    'period_end',
    'taxable_revenue',
    'tax_rate',
    'tax_due',
    'tax_paid',
    'status',
    'due_date',
    'paid_date',
    'locked',
  ];

  const rows: CsvCell[][] = periods.map((t) => [
    t.id,
    t.name,
    t.type,
    raw(day(t.periodStart)),
    raw(day(t.periodEnd)),
    money(t.taxableRevenueCents),
    raw(t.taxRate),
    money(t.taxDueCents),
    money(t.taxPaidCents),
    t.status,
    t.dueDate ? raw(day(t.dueDate)) : '',
    t.paidDate ? raw(day(t.paidDate)) : '',
    raw(t.lockedAt ? 'locked' : 'open'),
  ]);

  const records = periods.map((t) => ({
    period_id: t.id,
    name: t.name,
    type: t.type,
    period_start: day(t.periodStart),
    period_end: day(t.periodEnd),
    taxable_revenue: dollars(t.taxableRevenueCents),
    tax_rate: t.taxRate,
    tax_due: dollars(t.taxDueCents),
    tax_paid: dollars(t.taxPaidCents),
    status: t.status,
    due_date: t.dueDate ? day(t.dueDate) : null,
    paid_date: t.paidDate ? day(t.paidDate) : null,
    locked: t.lockedAt !== null,
  }));

  const warnings: string[] = [];
  if (periods.length === 0) {
    warnings.push(
      'No tax periods have been set up, so nothing is tracked as owed, filed or paid — and no period can be closed until one exists.',
    );
  }

  return { headers, rows, records, warnings };
}

export async function buildExport(
  report: ExportReport,
  scope: PropertyScope,
  start: Date,
  end: Date,
): Promise<ExportResult> {
  const period = { start: day(start), end: day(end) };
  const body =
    report === 'revenue'
      ? await revenueExport(scope, start, end)
      : report === 'utilities'
        ? await utilitiesExport(scope, start, end)
        : await taxSummaryExport(start, end);

  return {
    report,
    period,
    filename: `rah-${report}-${period.start}-to-${period.end}.csv`,
    ...body,
  };
}
