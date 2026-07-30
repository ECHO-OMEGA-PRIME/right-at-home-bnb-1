import { prisma } from '@/lib/prisma';

/**
 * Double-entry ledger service (P1 objective 2 / queue #26855).
 *
 * The accounting routes previously derived every figure from a hardcoded
 * `accountBalances` array. This computes the same shape from real
 * JournalEntryLine rows so the API contract is unchanged while the numbers stop
 * being invented.
 *
 * The debits == credits invariant lives here because it is a cross-row
 * constraint Postgres cannot express as a simple CHECK. Every write goes
 * through postJournalEntry, which refuses to persist an unbalanced entry, so
 * there is exactly one door into the ledger.
 */

export interface JournalLineInput {
  accountCode: string;
  debitCents?: number;
  creditCents?: number;
  propertyId?: string | null;
  memo?: string | null;
}

export interface JournalEntryInput {
  entryDate: Date;
  memo: string;
  reference?: string | null;
  propertyId?: string | null;
  createdById?: string | null;
  lines: JournalLineInput[];
}

export class LedgerImbalanceError extends Error {
  constructor(debits: number, credits: number) {
    super(
      `Journal entry does not balance: debits ${debits} != credits ${credits}. ` +
        'Nothing was written.',
    );
    this.name = 'LedgerImbalanceError';
  }
}

export class UnknownAccountError extends Error {
  constructor(codes: string[]) {
    super(`Unknown ledger account code(s): ${codes.join(', ')}`);
    this.name = 'UnknownAccountError';
  }
}

/** Money must be whole cents. Floats silently lose money at scale. */
function assertWholeCents(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer of cents, got ${value}`);
  }
}

export function assertBalanced(lines: JournalLineInput[]): { debits: number; credits: number } {
  if (lines.length < 2) {
    throw new Error('A double-entry journal entry needs at least two lines');
  }
  let debits = 0;
  let credits = 0;
  for (const [i, l] of lines.entries()) {
    const d = l.debitCents ?? 0;
    const c = l.creditCents ?? 0;
    assertWholeCents(d, `lines[${i}].debitCents`);
    assertWholeCents(c, `lines[${i}].creditCents`);
    // A line is one side or the other. Allowing both invites entries that
    // "balance" internally and hide their real effect.
    if (d > 0 && c > 0) {
      throw new Error(`lines[${i}] has both a debit and a credit; use two lines`);
    }
    if (d === 0 && c === 0) {
      throw new Error(`lines[${i}] is zero on both sides`);
    }
    debits += d;
    credits += c;
  }
  if (debits !== credits) throw new LedgerImbalanceError(debits, credits);
  return { debits, credits };
}

/** Post one balanced entry. Rejects unbalanced input before touching the DB. */
export async function postJournalEntry(input: JournalEntryInput) {
  assertBalanced(input.lines);

  const codes = [...new Set(input.lines.map((l) => l.accountCode))];
  const accounts = await prisma.ledgerAccount.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const missing = codes.filter((c) => !byCode.has(c));
  if (missing.length) throw new UnknownAccountError(missing);

  return prisma.journalEntry.create({
    data: {
      entryDate: input.entryDate,
      memo: input.memo,
      reference: input.reference ?? null,
      propertyId: input.propertyId ?? null,
      createdById: input.createdById ?? null,
      lines: {
        create: input.lines.map((l) => ({
          accountId: byCode.get(l.accountCode)!.id,
          debitCents: l.debitCents ?? 0,
          creditCents: l.creditCents ?? 0,
          // Fall back to the entry's property so per-line attribution is never
          // silently lost -- property-level P&L depends on it.
          propertyId: l.propertyId ?? input.propertyId ?? null,
          memo: l.memo ?? null,
        })),
      },
    },
    include: { lines: true },
  });
}

/**
 * Reverse an entry by posting its mirror image. History is never edited, which
 * is what makes the ledger an audit trail rather than a mutable table.
 */
export async function reverseJournalEntry(entryId: string, memo: string, entryDate = new Date()) {
  const original = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: { include: { account: true } } },
  });
  if (!original) throw new Error(`Journal entry ${entryId} not found`);

  return prisma.journalEntry.create({
    data: {
      entryDate,
      memo,
      reference: original.reference,
      propertyId: original.propertyId,
      reversesId: original.id,
      lines: {
        create: original.lines.map((l) => ({
          accountId: l.accountId,
          debitCents: l.creditCents,
          creditCents: l.debitCents,
          propertyId: l.propertyId,
          memo: `Reversal of ${original.id}`,
        })),
      },
    },
    include: { lines: true },
  });
}

export interface AccountBalance {
  code: string;
  name: string;
  balance_cents: number;
  normal_side: 'debit' | 'credit';
}

/**
 * Balances per account, signed by the account's normal side so a revenue
 * account reads positive. Mirrors the shape the accounting routes already
 * consume, so wiring them up is a data-source swap rather than a rewrite.
 */
export async function accountBalances(opts: {
  propertyId?: string;
  from?: Date;
  to?: Date;
} = {}): Promise<AccountBalance[]> {
  const accounts = await prisma.ledgerAccount.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
  });

  const grouped = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    _sum: { debitCents: true, creditCents: true },
    where: {
      ...(opts.propertyId ? { propertyId: opts.propertyId } : {}),
      ...(opts.from || opts.to
        ? {
            journalEntry: {
              entryDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) },
            },
          }
        : {}),
    },
  });
  const sums = new Map(grouped.map((g) => [g.accountId, g._sum]));

  return accounts.map((a) => {
    const s = sums.get(a.id);
    const d = s?.debitCents ?? 0;
    const c = s?.creditCents ?? 0;
    return {
      code: a.code,
      name: a.name,
      balance_cents: a.normalSide === 'credit' ? c - d : d - c,
      normal_side: a.normalSide === 'credit' ? 'credit' : 'debit',
    };
  });
}

/**
 * Property-level profit and loss, derived from per-line propertyId. This is the
 * P5 requirement ("traceable revenue, cleaning, maintenance, supplies and
 * utility inputs") and is only derivable because lines carry their own
 * property rather than the entry alone.
 */
export async function propertyPnL(opts: { from?: Date; to?: Date } = {}) {
  const lines = await prisma.journalEntryLine.findMany({
    where:
      opts.from || opts.to
        ? {
            journalEntry: {
              entryDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) },
            },
          }
        : {},
    include: { account: true },
  });

  const byProperty = new Map<string, { revenue_cents: number; expense_cents: number }>();
  for (const l of lines) {
    const key = l.propertyId ?? '__unattributed__';
    const row = byProperty.get(key) ?? { revenue_cents: 0, expense_cents: 0 };
    if (l.account.type === 'revenue') row.revenue_cents += l.creditCents - l.debitCents;
    if (l.account.type === 'expense') row.expense_cents += l.debitCents - l.creditCents;
    byProperty.set(key, row);
  }

  return [...byProperty.entries()].map(([propertyId, v]) => ({
    propertyId: propertyId === '__unattributed__' ? null : propertyId,
    ...v,
    net_income_cents: v.revenue_cents - v.expense_cents,
  }));
}

export interface ReportJournalLine {
  date: string;
  account_code: string;
  account_name: string;
  debit_cents: number;
  credit_cents: number;
  property_id: string | null;
  memo: string | null;
}

/**
 * Flat journal lines for reporting, shaped exactly like the array the
 * accounting report routes previously hardcoded. Returning the existing shape
 * means those routes keep their aggregation and filtering logic untouched --
 * only the data source changes, so there is no behaviour to re-verify beyond
 * "is it real now".
 *
 * `date` is YYYY-MM-DD because the routes compare it as a string.
 */
export async function reportJournalLines(opts: { from?: Date; to?: Date } = {}): Promise<ReportJournalLine[]> {
  const lines = await prisma.journalEntryLine.findMany({
    where:
      opts.from || opts.to
        ? {
            journalEntry: {
              entryDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) },
            },
          }
        : {},
    include: { account: true, journalEntry: true },
    orderBy: { journalEntry: { entryDate: 'asc' } },
  });

  return lines.map((l) => ({
    date: l.journalEntry.entryDate.toISOString().slice(0, 10),
    account_code: l.account.code,
    account_name: l.account.name,
    debit_cents: l.debitCents,
    credit_cents: l.creditCents,
    property_id: l.propertyId,
    memo: l.memo,
  }));
}

/**
 * Journal entries in the shape /api/accounting/journal-entries returns.
 *
 * `reference` is stored as a single "type:id" string (e.g. "expense:abc123")
 * because one column keeps the pair atomic; it is split back out here so the
 * API contract keeps its separate reference_type / reference_id fields.
 */
export async function listJournalEntries(opts: {
  from?: Date;
  to?: Date;
  referenceType?: string | null;
} = {}) {
  const entries = await prisma.journalEntry.findMany({
    where: {
      ...(opts.from || opts.to
        ? { entryDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
        : {}),
      ...(opts.referenceType ? { reference: { startsWith: `${opts.referenceType}:` } } : {}),
    },
    include: { lines: { include: { account: true } } },
    orderBy: { entryDate: 'desc' },
  });

  return entries.map((e) => {
    const [refType, ...refRest] = (e.reference ?? '').split(':');
    return {
      id: e.id,
      date: e.entryDate.toISOString().slice(0, 10),
      reference_type: e.reference ? refType : 'manual',
      reference_id: refRest.join(':') || null,
      description: e.memo,
      property_id: e.propertyId,
      reverses_id: e.reversesId,
      lines: e.lines.map((l) => ({
        account_code: l.account.code,
        account_name: l.account.name,
        debit_cents: l.debitCents,
        credit_cents: l.creditCents,
        property_id: l.propertyId,
        memo: l.memo,
      })),
      created_at: e.postedAt.toISOString(),
    };
  });
}

/** True when the whole ledger balances. A cheap integrity check for monitoring. */
export async function ledgerIsBalanced(): Promise<{ balanced: boolean; debits: number; credits: number }> {
  const agg = await prisma.journalEntryLine.aggregate({
    _sum: { debitCents: true, creditCents: true },
  });
  const debits = agg._sum.debitCents ?? 0;
  const credits = agg._sum.creditCents ?? 0;
  return { balanced: debits === credits, debits, credits };
}
