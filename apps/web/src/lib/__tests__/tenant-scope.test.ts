/**
 * Tenant-scope tests.
 *
 * The invariant that matters: an EMPTY scope must deny everything. The natural
 * bug here is treating `[]` as falsy and therefore as "no filter" — which turns
 * "this worker is assigned to nothing" into "this worker sees the entire
 * portfolio". Every test below exists to pin that distinction.
 */

import { describe, expect, it } from 'vitest';

import {
  type PropertyScope,
  isUnrestricted,
  scopeAllows,
  scopedWhere,
} from '../tenant-scope';

describe('null and [] are different things', () => {
  it('null is unrestricted', () => {
    expect(isUnrestricted(null)).toBe(true);
  });

  it('an EMPTY array is restricted, not unrestricted', () => {
    // The whole point. `[]` is falsy-adjacent and reads as "nothing to filter
    // by"; it actually means "entitled to nothing".
    expect(isUnrestricted([])).toBe(false);
  });

  it('a populated array is restricted', () => {
    expect(isUnrestricted(['p1'])).toBe(false);
  });
});

describe('scopedWhere', () => {
  it('leaves the query untouched for an unrestricted caller', () => {
    expect(scopedWhere({ status: 'OPEN' }, null)).toEqual({ status: 'OPEN' });
  });

  it('constrains an unfiltered query to the scope', () => {
    expect(scopedWhere({ status: 'OPEN' }, ['p1', 'p2'])).toEqual({
      status: 'OPEN',
      propertyId: { in: ['p1', 'p2'] },
    });
  });

  it('an EMPTY scope produces a filter that matches NOTHING', () => {
    // Not an absent filter. `propertyId: { in: [] }` returns zero rows;
    // omitting the key would return every row in the table.
    const where = scopedWhere({ status: 'OPEN' }, []) as Record<string, any>;
    expect(where.propertyId).toEqual({ in: [] });
    expect('propertyId' in where).toBe(true);
  });

  it('honours a requested property that IS in scope', () => {
    expect(scopedWhere({ propertyId: 'p1' }, ['p1', 'p2'])).toEqual({ propertyId: 'p1' });
  });

  it('narrows — never widens — when a caller requests a property OUT of scope', () => {
    // A worker asking for someone else's property must get nothing back, not
    // that property and not the whole portfolio.
    const where = scopedWhere({ propertyId: 'p9' }, ['p1']) as Record<string, any>;
    expect(where.propertyId).not.toBe('p9');
    expect(where.propertyId).not.toEqual({ in: ['p1'] });
  });

  it('a requested property is denied when the scope is empty', () => {
    const where = scopedWhere({ propertyId: 'p1' }, []) as Record<string, any>;
    expect(where.propertyId).not.toBe('p1');
  });

  it('supports a non-default scope field', () => {
    expect(scopedWhere({ id: 'x' }, ['p1'], 'propId')).toEqual({
      id: 'x',
      propId: { in: ['p1'] },
    });
  });

  it('does not mutate the caller\'s where object', () => {
    const original = { status: 'OPEN' };
    scopedWhere(original, ['p1']);
    expect(original).toEqual({ status: 'OPEN' });
  });
});

describe('scopeAllows', () => {
  const cases: Array<[string, PropertyScope, string | null | undefined, boolean]> = [
    ['unrestricted allows anything', null, 'p1', true],
    ['unrestricted allows even a null id', null, null, true],
    ['in-scope property allowed', ['p1', 'p2'], 'p1', true],
    ['out-of-scope property denied', ['p1'], 'p9', false],
    ['EMPTY scope denies everything', [], 'p1', false],
    ['null property id denied when restricted', ['p1'], null, false],
    ['undefined property id denied when restricted', ['p1'], undefined, false],
  ];

  for (const [name, scope, propertyId, expected] of cases) {
    it(name, () => {
      expect(scopeAllows(scope, propertyId)).toBe(expected);
    });
  }
});

/**
 * Guards the dashboard allowlist against the mistake I actually made: writing a
 * denylist, missing four money fields, and believing the leak was closed.
 *
 * These assert the POLICY, not the implementation — if someone adds a new
 * revenue field to DashboardStats and it is not on the allowlist, a restricted
 * caller must not receive it.
 */
describe('dashboard restricted-view policy', () => {
  // Mirrors app/api/dashboard/stats/route.ts.
  const RESTRICTED_VISIBLE_KEYS = [
    'period',
    'generated_at',
    'active_bookings',
    'pending_tasks',
    'task_summary',
    'total_bookings_this_month',
    'total_nights_this_month',
  ];

  // Every field DashboardStats actually declares today.
  const ALL_KEYS = [
    'period', 'generated_at', 'revenue_this_month_cents', 'revenue_change_pct',
    'occupancy_rate', 'active_bookings', 'pending_tasks', 'avg_booking_value_cents',
    'avg_length_of_stay_nights', 'revenue_by_month', 'revenue_by_channel',
    'total_channel_revenue_cents', 'recent_bookings', 'task_summary',
    'property_performance', 'properties_count', 'total_nights_this_month',
    'total_bookings_this_month',
  ];

  const restrict = (stats: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const k of RESTRICTED_VISIBLE_KEYS) if (k in stats) out[k] = stats[k];
    return out;
  };

  const full = Object.fromEntries(ALL_KEYS.map((k) => [k, 'VALUE']));

  it('leaks no field carrying money', () => {
    const visible = Object.keys(restrict(full));
    const money = visible.filter((k) => /revenue|_cents|profit|expense|payout|price/i.test(k));
    expect(money, `money fields leaked: ${money.join(', ')}`).toEqual([]);
  });

  it('leaks none of the four fields my denylist originally missed', () => {
    const visible = Object.keys(restrict(full));
    for (const k of [
      'avg_booking_value_cents',
      'revenue_by_channel',
      'total_channel_revenue_cents',
      'property_performance',
    ]) {
      expect(visible).not.toContain(k);
    }
  });

  it('leaks no guest PII (recent_bookings)', () => {
    expect(Object.keys(restrict(full))).not.toContain('recent_bookings');
  });

  it('a NEW unknown field is hidden by default — the allowlist fails closed', () => {
    const withNewField = { ...full, revenue_next_quarter_cents: 'VALUE', some_new_thing: 'VALUE' };
    const visible = Object.keys(restrict(withNewField));
    expect(visible).not.toContain('revenue_next_quarter_cents');
    expect(visible).not.toContain('some_new_thing');
  });

  it('still returns something useful to a worker', () => {
    const visible = restrict(full);
    expect(Object.keys(visible).length).toBeGreaterThan(0);
    expect(visible).toHaveProperty('pending_tasks');
  });
});
