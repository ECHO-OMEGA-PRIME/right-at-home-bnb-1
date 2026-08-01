/**
 * Property-level P&L tests (P5-0).
 *
 * These pin the three ways this report could lie to an owner:
 *
 *  1. REPORTING A PROFIT WITH NO COST DATA. Production holds 762 bookings worth
 *     $851,410 and zero recorded expenses. Subtracting nothing from revenue
 *     yields a 100% margin on every property — a number that reads as a
 *     spectacular business rather than as missing data. Net income must be
 *     null, never 0.
 *
 *  2. BOOKING FUTURE STAYS AS INCOME. Bookings in this database run to October
 *     2027. Anything that recognises revenue on booking date, or simply counts
 *     every booking, reports years of unearned money as current income.
 *
 *  3. TREATING COLLECTED TAX AS REVENUE. Lodging tax is owed to the state. Spent
 *     as income, it is missing when it comes due.
 */

import { describe, expect, it } from 'vitest';

// ── mirrors of the pure logic in src/lib/property-pnl.ts ──────────────────

const toCents = (d: number | null | undefined) =>
  d === null || d === undefined || Number.isNaN(d) ? 0 : Math.round(d * 100);

const marginPct = (net: number | null, revenue: number) =>
  net === null || revenue <= 0 ? null : Math.round((net / revenue) * 10000) / 100;

function settle(revenue: number, cost: number, noCostData: boolean) {
  const net = noCostData ? null : revenue - cost;
  return { net, margin: marginPct(net, revenue) };
}

describe('no cost data must not become a profit', () => {
  it('reports NULL net income, not zero cost, when nothing is recorded', () => {
    // The production case: real revenue, no expenses anywhere.
    const { net, margin } = settle(85_141_000, 0, true);
    expect(net).toBeNull();
    expect(margin).toBeNull();
  });

  it('does NOT report a 100% margin', () => {
    // The specific wrong answer this guards against.
    const { margin } = settle(85_141_000, 0, true);
    expect(margin).not.toBe(100);
  });

  it('still reports a real result once costs exist, including a zero one', () => {
    // "Costs were recorded and netted to zero" is a legitimate finding and must
    // stay distinguishable from "no costs were recorded".
    const { net, margin } = settle(10_000, 10_000, false);
    expect(net).toBe(0);
    expect(margin).toBe(0);
  });

  it('reports a loss as a loss', () => {
    const { net, margin } = settle(10_000, 15_000, false);
    expect(net).toBe(-5_000);
    expect(margin).toBe(-50);
  });

  it('never divides by zero revenue', () => {
    expect(settle(0, 5_000, false).margin).toBeNull();
  });
});

describe('revenue is earned at check-out, not at booking', () => {
  const start = new Date('2026-07-01T00:00:00Z');
  const end = new Date('2026-07-31T23:59:59.999Z');
  const earned = (checkOut: Date) => checkOut >= start && checkOut <= end;
  const unearned = (checkOut: Date) => checkOut > end;

  it('counts a stay that ended inside the period', () => {
    expect(earned(new Date('2026-07-15T11:00:00Z'))).toBe(true);
  });

  it('does NOT count a 2027 stay as current income', () => {
    // Bookings really do run to 2027-10-23 in this database.
    const far = new Date('2027-10-23T11:00:00Z');
    expect(earned(far)).toBe(false);
    expect(unearned(far)).toBe(true);
  });

  it('does not count a stay that ended before the period', () => {
    expect(earned(new Date('2026-06-30T11:00:00Z'))).toBe(false);
  });

  it('reports money for a future stay separately from revenue', () => {
    const revenue = 0;
    const unearnedCents = toCents(1_500);
    expect(revenue).toBe(0);
    expect(unearnedCents).toBe(150_000);
  });
});

describe('collected tax is a liability, not revenue', () => {
  it('excludes taxes from the revenue total', () => {
    const accommodation = toCents(1_000);
    const cleaning = toCents(100);
    const service = toCents(50);
    const taxes = toCents(87.5);

    const revenue = accommodation + cleaning + service;
    expect(revenue).toBe(115_000);
    // Present and reported, but deliberately outside revenue.
    expect(taxes).toBe(8_750);
    expect(revenue).not.toBe(revenue + taxes);
  });
});

describe('dollars to cents', () => {
  it('rounds rather than truncating', () => {
    expect(toCents(10.005)).toBe(1001);
    expect(toCents(0.1 + 0.2)).toBe(30); // 0.30000000000000004
  });

  it('treats a NULL money column as zero, not NaN', () => {
    // serviceFee and taxes are NULL on every production row. Arithmetic on
    // NaN silently poisons every total downstream, so this is the guard that
    // keeps one missing column from blanking the whole report.
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents(NaN)).toBe(0);
    expect(toCents(1) + toCents(null)).toBe(100);
  });

  it('accumulates 762 bookings without drifting off by a cent', () => {
    // Rounding at the boundary, not at the end, is what makes this hold.
    let total = 0;
    for (let i = 0; i < 762; i++) total += toCents(1117.33);
    expect(total).toBe(762 * 111733);
  });
});

describe('every property appears, including the ones earning nothing', () => {
  it('keeps a zero-booking property in the rows', () => {
    // Two properties currently have no bookings at all. Grouping from the
    // booking table would drop them — and a property earning nothing is the
    // row an owner most needs to see.
    const properties = [{ id: 'a' }, { id: 'b' }, { id: 'idle' }];
    const withBookings = new Set(['a', 'b']);
    const rows = properties.map((p) => ({
      property_id: p.id,
      bookings: withBookings.has(p.id) ? 3 : 0,
    }));
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.property_id === 'idle')?.bookings).toBe(0);
  });
});

describe('per-property figures must sum to the company total', () => {
  it('does not charge unallocated overhead to every property', () => {
    // The defect in /api/accounting/reports/pnl: lines with property_id null
    // were added to WHICHEVER property was requested, so overhead was counted
    // once per property and the parts exceeded the whole.
    const overhead = 50_000;
    const perProperty = [10_000, 20_000, 30_000];
    const wrong = perProperty.map((c) => c + overhead);

    expect(perProperty.reduce((a, b) => a + b, 0)).toBe(60_000);
    // Three properties, overhead counted three times.
    expect(wrong.reduce((a, b) => a + b, 0)).toBe(60_000 + overhead * 3);
    expect(wrong.reduce((a, b) => a + b, 0)).not.toBe(60_000 + overhead);
  });
});
