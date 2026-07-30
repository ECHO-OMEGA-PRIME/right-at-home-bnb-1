/**
 * Ledger invariant tests.
 *
 * `assertBalanced` is the single gate every ledger write passes through, so it
 * is tested directly and adversarially. An accounting system that accepts an
 * unbalanced entry is worse than no accounting system: it produces confident,
 * wrong numbers, which is exactly the failure mode these routes already had
 * when they served hardcoded arrays.
 */

import { describe, expect, it } from 'vitest';

import { assertBalanced, LedgerImbalanceError } from '../ledger';

const CASH = '1000';
const REVENUE = '4000';

describe('assertBalanced - accepts valid entries', () => {
  it('accepts a simple balanced two-line entry', () => {
    expect(
      assertBalanced([
        { accountCode: CASH, debitCents: 25000 },
        { accountCode: REVENUE, creditCents: 25000 },
      ]),
    ).toEqual({ debits: 25000, credits: 25000 });
  });

  it('accepts a split entry where many lines sum to the other side', () => {
    expect(
      assertBalanced([
        { accountCode: CASH, debitCents: 30000 },
        { accountCode: REVENUE, creditCents: 25000 },
        { accountCode: '2100', creditCents: 5000 },
      ]),
    ).toEqual({ debits: 30000, credits: 30000 });
  });
});

describe('assertBalanced - rejects everything unbalanced', () => {
  it('rejects debits != credits', () => {
    expect(() =>
      assertBalanced([
        { accountCode: CASH, debitCents: 25000 },
        { accountCode: REVENUE, creditCents: 24999 },
      ]),
    ).toThrow(LedgerImbalanceError);
  });

  it('rejects an off-by-one-cent entry specifically', () => {
    // The classic rounding bug. One cent must fail as loudly as one dollar.
    expect(() =>
      assertBalanced([
        { accountCode: CASH, debitCents: 1 },
        { accountCode: REVENUE, creditCents: 2 },
      ]),
    ).toThrow(LedgerImbalanceError);
  });

  it('rejects a single-line entry', () => {
    expect(() => assertBalanced([{ accountCode: CASH, debitCents: 100 }])).toThrow(
      /at least two lines/,
    );
  });

  it('rejects a line carrying both a debit and a credit', () => {
    expect(() =>
      assertBalanced([
        { accountCode: CASH, debitCents: 100, creditCents: 100 },
        { accountCode: REVENUE, creditCents: 100, debitCents: 100 },
      ]),
    ).toThrow(/both a debit and a credit/);
  });

  it('rejects a zero line', () => {
    expect(() =>
      assertBalanced([
        { accountCode: CASH, debitCents: 0, creditCents: 0 },
        { accountCode: REVENUE, creditCents: 100 },
      ]),
    ).toThrow(/zero on both sides/);
  });

  it('rejects fractional cents', () => {
    expect(() =>
      assertBalanced([
        { accountCode: CASH, debitCents: 10.5 },
        { accountCode: REVENUE, creditCents: 10.5 },
      ]),
    ).toThrow(/integer of cents/);
  });

  it('rejects negative amounts (a negative debit is a disguised credit)', () => {
    expect(() =>
      assertBalanced([
        { accountCode: CASH, debitCents: -100 },
        { accountCode: REVENUE, creditCents: -100 },
      ]),
    ).toThrow(/non-negative/);
  });

  it('reports both totals so an imbalance is diagnosable', () => {
    try {
      assertBalanced([
        { accountCode: CASH, debitCents: 500 },
        { accountCode: REVENUE, creditCents: 300 },
      ]);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain('500');
      expect((e as Error).message).toContain('300');
      expect((e as Error).message).toContain('Nothing was written');
    }
  });
});
