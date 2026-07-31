/**
 * Accounting period locking (P5 objective 1).
 *
 * WHAT WAS ACTUALLY THERE
 * TaxPeriod.lockedAt existed with the schema comment "lockedAt is what makes a
 * closed period immutable (P5 'period locking')" — and nothing anywhere set it
 * or checked it. It was serialised out by GET /api/taxes and that was the
 * entire implementation. There was no way to lock a period and nothing would
 * have respected one, so a column documented as enforcing immutability enforced
 * nothing. A lock that is only described is worse than no lock, because the
 * schema tells the next reader the books are protected.
 *
 * WHAT A LOCK MEANS HERE
 * Once a period is locked, no financial record dated inside it may be created,
 * changed, or removed. A filing has been made from those numbers; if they can
 * still move, the filing and the books no longer agree and nothing says so.
 *
 * MOVING A RECORD *OUT* OF A LOCKED PERIOD IS ALSO A MUTATION
 * Changing an invoice's paid date from a closed month to an open one silently
 * reduces the closed month's totals. So an update is checked against BOTH its
 * old and its new date: the write is refused if either falls in a locked
 * window. Checking only the new date would leave the obvious way around a lock.
 *
 * REVERSALS ARE ALLOWED, AND THAT IS THE POINT
 * Correcting a closed period is done by posting a compensating entry in the
 * current open period, never by editing the closed one. So a reversal is
 * checked against ITS OWN date, not the date of the entry it reverses. That is
 * standard practice and the only honest way to fix a closed month.
 */

import { prisma } from '@/lib/prisma';

export interface LockedPeriod {
  id: string;
  name: string;
  type: string;
  periodStart: Date;
  periodEnd: Date;
  lockedAt: Date;
}

export class PeriodLockedError extends Error {
  readonly period: LockedPeriod;
  readonly attemptedDate: Date;

  constructor(period: LockedPeriod, attemptedDate: Date) {
    super(
      `The ${period.type} period "${period.name}" ` +
        `(${period.periodStart.toISOString().slice(0, 10)} to ${period.periodEnd
          .toISOString()
          .slice(0, 10)}) was locked on ${period.lockedAt.toISOString().slice(0, 10)}. ` +
        `A record dated ${attemptedDate.toISOString().slice(0, 10)} falls inside it and cannot ` +
        `be created, changed or removed. To correct a closed period, post a compensating entry ` +
        `in the current open period instead.`,
    );
    this.name = 'PeriodLockedError';
    this.period = period;
    this.attemptedDate = attemptedDate;
  }
}

/**
 * The locked period containing `date`, if any.
 *
 * Several period types (hot, sales, income…) can cover the same day. Any one of
 * them being locked closes that day — a filing was made from those numbers
 * whichever tax it was for.
 */
export async function lockedPeriodFor(date: Date): Promise<LockedPeriod | null> {
  const row = await prisma.taxPeriod.findFirst({
    where: {
      lockedAt: { not: null },
      periodStart: { lte: date },
      periodEnd: { gte: date },
    },
    orderBy: { periodEnd: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      periodStart: true,
      periodEnd: true,
      lockedAt: true,
    },
  });
  return row ? (row as LockedPeriod) : null;
}

/**
 * Throw if any of the given dates falls inside a locked period.
 *
 * Pass every date the write touches — for an update that means the existing
 * date as well as the new one. Nulls and undefineds are skipped so callers can
 * hand over optional columns directly without pre-filtering.
 *
 * This deliberately does not catch its own errors. If the lock table cannot be
 * read, the write must not proceed: a guard that lets everything through when
 * it is broken is not a guard.
 */
export async function assertPeriodOpen(
  ...dates: Array<Date | string | null | undefined>
): Promise<void> {
  const real = dates
    .filter((d): d is Date | string => d !== null && d !== undefined)
    .map((d) => (d instanceof Date ? d : new Date(d)))
    .filter((d) => !Number.isNaN(d.getTime()));

  for (const d of real) {
    const locked = await lockedPeriodFor(d);
    if (locked) throw new PeriodLockedError(locked, d);
  }
}

/**
 * True when a period overlapping `date` is locked. For read paths that want to
 * show a padlock rather than refuse a write.
 */
export async function isPeriodLocked(date: Date): Promise<boolean> {
  return (await lockedPeriodFor(date)) !== null;
}

/**
 * Turn a caught PeriodLockedError into the response it deserves, or null if the
 * error is something else.
 *
 * Without this every route's `catch (error: any)` would return a 500 reading
 * "Failed to create expense" — which says the system broke when in fact it
 * worked exactly as designed. A refusal has to be distinguishable from a fault,
 * or the first person to hit a locked period files a bug instead of reading the
 * reason.
 *
 * 409 Conflict: the request is well-formed and the caller is permitted; it
 * conflicts with the current state of the books.
 */
export function periodLockResponse(error: unknown): {
  status: 409;
  body: {
    error: string;
    period_locked: true;
    period: { id: string; name: string; type: string; start: string; end: string; locked_at: string };
    attempted_date: string;
  };
} | null {
  if (!(error instanceof PeriodLockedError)) return null;
  const p = error.period;
  return {
    status: 409,
    body: {
      error: error.message,
      period_locked: true,
      period: {
        id: p.id,
        name: p.name,
        type: p.type,
        start: p.periodStart.toISOString().slice(0, 10),
        end: p.periodEnd.toISOString().slice(0, 10),
        locked_at: p.lockedAt.toISOString(),
      },
      attempted_date: error.attemptedDate.toISOString().slice(0, 10),
    },
  };
}
