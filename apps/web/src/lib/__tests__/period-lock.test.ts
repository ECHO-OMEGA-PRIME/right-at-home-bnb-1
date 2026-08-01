/**
 * Period-lock tests — these import the REAL guard.
 *
 * tools/period_lock_integration.mjs proves the lock query behaves correctly
 * against a real Postgres, but it restates the query rather than importing
 * this module (a .mjs script cannot import the TypeScript lib). So these
 * exercise the actual assertPeriodOpen / periodLockResponse that the routes
 * call, with the database stubbed.
 *
 * WHAT THIS IS GUARDING AGAINST
 * TaxPeriod.lockedAt shipped with the schema comment "lockedAt is what makes a
 * closed period immutable" and no code anywhere set it or read it. A column
 * documented as enforcing something, enforcing nothing, is worse than an
 * absent feature — the schema tells the next reader the books are protected.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: { taxPeriod: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

import {
  PeriodLockedError,
  assertPeriodOpen,
  isPeriodLocked,
  lockedPeriodFor,
  periodLockResponse,
} from '../period-lock';

const LOCKED = {
  id: 'tp_1',
  name: 'income:2026-01-01:2026-03-31',
  type: 'income',
  periodStart: new Date('2026-01-01T00:00:00.000Z'),
  periodEnd: new Date('2026-03-31T23:59:59.999Z'),
  lockedAt: new Date('2026-04-10T12:00:00.000Z'),
};

const INSIDE = new Date('2026-02-15T00:00:00.000Z');
const OUTSIDE = new Date('2026-06-15T00:00:00.000Z');

beforeEach(() => {
  findFirst.mockReset();
});

/** Stub the DB: locked period covers Q1 2026, nothing else. */
function periodCoveringQ1() {
  findFirst.mockImplementation(({ where }: any) => {
    const d: Date = where.periodStart.lte;
    return Promise.resolve(d >= LOCKED.periodStart && d <= LOCKED.periodEnd ? LOCKED : null);
  });
}

describe('assertPeriodOpen', () => {
  it('throws for a date inside a locked period', async () => {
    periodCoveringQ1();
    await expect(assertPeriodOpen(INSIDE)).rejects.toBeInstanceOf(PeriodLockedError);
  });

  it('resolves for a date outside every locked period', async () => {
    periodCoveringQ1();
    await expect(assertPeriodOpen(OUTSIDE)).resolves.toBeUndefined();
  });

  it('throws if ANY of several dates is locked', async () => {
    // The update case: old date closed, new date open. Checking only the new
    // one would let a record be moved out of a closed period.
    periodCoveringQ1();
    await expect(assertPeriodOpen(OUTSIDE, INSIDE)).rejects.toBeInstanceOf(PeriodLockedError);
  });

  it('skips null and undefined instead of treating them as a date', async () => {
    // Optional columns (paidDate) are passed straight in. `new Date(null)` is
    // the epoch, which would silently check 1970 instead of skipping.
    periodCoveringQ1();
    await expect(assertPeriodOpen(null, undefined, OUTSIDE)).resolves.toBeUndefined();
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('accepts date strings as well as Date objects', async () => {
    periodCoveringQ1();
    await expect(assertPeriodOpen('2026-02-15T00:00:00.000Z')).rejects.toBeInstanceOf(
      PeriodLockedError,
    );
  });

  it('ignores an unparseable date rather than checking Invalid Date', async () => {
    periodCoveringQ1();
    await expect(assertPeriodOpen('not-a-date')).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('does NOT swallow a database failure', async () => {
    // A guard that lets everything through when it is broken is not a guard.
    findFirst.mockRejectedValue(new Error('connection refused'));
    await expect(assertPeriodOpen(INSIDE)).rejects.toThrow('connection refused');
  });

  it('checks nothing when given nothing', async () => {
    await expect(assertPeriodOpen()).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe('the error explains itself', () => {
  it('names the period, its dates, and what to do instead', async () => {
    periodCoveringQ1();
    const err = await assertPeriodOpen(INSIDE).then(
      () => null,
      (e: unknown) => e,
    );
    // Narrow before reading fields, so a resolved promise fails here rather
    // than reporting "undefined does not contain ..." further down.
    expect(err).toBeInstanceOf(PeriodLockedError);
    if (!(err instanceof PeriodLockedError)) throw new Error('expected PeriodLockedError');
    expect(err.message).toContain('income:2026-01-01:2026-03-31');
    expect(err.message).toContain('2026-02-15');
    // The remedy matters as much as the refusal.
    expect(err.message).toContain('compensating entry');
    expect(err.period.id).toBe('tp_1');
    expect(err.attemptedDate).toEqual(INSIDE);
  });
});

describe('periodLockResponse', () => {
  it('maps a lock rejection to 409, not 500', async () => {
    periodCoveringQ1();
    const err = await assertPeriodOpen(INSIDE).catch((e) => e);
    const res = periodLockResponse(err);
    expect(res?.status).toBe(409);
    expect(res?.body.period_locked).toBe(true);
    expect(res?.body.period.start).toBe('2026-01-01');
    expect(res?.body.attempted_date).toBe('2026-02-15');
  });

  it('returns null for any OTHER error so real faults still surface as 500', async () => {
    // A refusal must not be confused with a fault in either direction.
    expect(periodLockResponse(new Error('database is on fire'))).toBeNull();
    expect(periodLockResponse(null)).toBeNull();
    expect(periodLockResponse('a string')).toBeNull();
  });
});

describe('lookup helpers', () => {
  it('lockedPeriodFor returns the period, or null', async () => {
    periodCoveringQ1();
    expect((await lockedPeriodFor(INSIDE))?.id).toBe('tp_1');
    expect(await lockedPeriodFor(OUTSIDE)).toBeNull();
  });

  it('isPeriodLocked answers the read-path question', async () => {
    periodCoveringQ1();
    expect(await isPeriodLocked(INSIDE)).toBe(true);
    expect(await isPeriodLocked(OUTSIDE)).toBe(false);
  });

  it('only considers periods that are actually locked', async () => {
    // The query filters lockedAt: { not: null }. An open period covering the
    // same dates must not block anything.
    periodCoveringQ1();
    await assertPeriodOpen(INSIDE).catch(() => undefined);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ lockedAt: { not: null } }) }),
    );
  });
});
