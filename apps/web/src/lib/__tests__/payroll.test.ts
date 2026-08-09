/**
 * SSN handling policy tests.
 *
 * The control being tested is REFUSAL: this system stores only the last four
 * digits, and a caller must not be able to write a full SSN into that column by
 * sending one. Truncating silently would be worse than rejecting, because the
 * full value would still have travelled through the request body, logs and any
 * error trace on the way in.
 *
 * These assertions are the reason the field is safe to exist at all.
 */

import { describe, expect, it } from 'vitest';

import {
  SsnPolicyError,
  normaliseCrew,
  normaliseSsnLast4,
  normaliseW4Status,
  toEmployeeContract,
} from '../payroll';

describe('normaliseSsnLast4 — refuses more than the last four digits', () => {
  it('REJECTS a full 9-digit SSN rather than truncating it', () => {
    const syntheticFullIdentifier = ['123', '45', '6789'].join('');
    expect(() => normaliseSsnLast4(syntheticFullIdentifier)).toThrow(SsnPolicyError);
    expect(() => normaliseSsnLast4(syntheticFullIdentifier)).toThrow(/does not store full SSNs/);
  });

  it('REJECTS a formatted full SSN', () => {
    const syntheticFormattedIdentifier = ['123', '45', '6789'].join('-');
    expect(() => normaliseSsnLast4(syntheticFormattedIdentifier)).toThrow(SsnPolicyError);
  });

  it('rejects 5+ digits generally', () => {
    expect(() => normaliseSsnLast4('12345')).toThrow(SsnPolicyError);
  });

  it('rejects fewer than 4 digits', () => {
    expect(() => normaliseSsnLast4('123')).toThrow(/exactly 4 digits/);
  });

  it('rejects non-numeric input', () => {
    expect(() => normaliseSsnLast4('abcd')).toThrow(/exactly 4 digits/);
  });

  it('accepts exactly four digits', () => {
    expect(normaliseSsnLast4('4521')).toBe('4521');
    expect(normaliseSsnLast4('0007')).toBe('0007');
  });

  it('treats empty and null as "not provided", not as an error', () => {
    expect(normaliseSsnLast4(null)).toBeNull();
    expect(normaliseSsnLast4(undefined)).toBeNull();
    expect(normaliseSsnLast4('')).toBeNull();
  });
});

describe('normaliseW4Status', () => {
  it('accepts the known filing statuses', () => {
    expect(normaliseW4Status('Single')).toBe('single');
    expect(normaliseW4Status('head_of_household')).toBe('head_of_household');
  });
  it('rejects an unknown status rather than storing free text', () => {
    expect(() => normaliseW4Status('whatever')).toThrow(SsnPolicyError);
  });
});

describe('toEmployeeContract — sensitive fields', () => {
  const row: any = {
    id: 'wp1',
    userId: 'u1',
    workerType: 'CLEANER',
    employmentClass: 'EMPLOYEE',
    defaultPayType: 'HOURLY',
    hourlyRateCents: 1800,
    paymentMethod: 'ach',
    isAvailable: true,
    hireDate: new Date('2025-06-15T00:00:00Z'),
    defaultHours: 30,
    addressLine: '220 N Big Spring St',
    ssnLast4: '4521',
    w4FilingStatus: 'single',
    w4Allowances: 1,
    createdAt: new Date('2025-06-15T00:00:00Z'),
    updatedAt: new Date('2026-01-10T00:00:00Z'),
    user: { name: 'Maria Garcia', email: 'm@example.com', phone: null, isActive: true },
  };

  it('OMITS ssn and address entirely when not privileged', () => {
    const out = toEmployeeContract(row, false) as Record<string, unknown>;
    // Omitted, not blanked: a caller cannot even tell whether a value exists.
    expect('ssn_last4' in out).toBe(false);
    expect('address' in out).toBe(false);
    expect(out.name).toBe('Maria Garcia');
  });

  it('includes them for a privileged caller', () => {
    const out = toEmployeeContract(row, true) as Record<string, unknown>;
    expect(out.ssn_last4).toBe('4521');
    expect(out.address).toBe('220 N Big Spring St');
  });

  it('never exposes a field that could hold a full SSN', () => {
    const out = toEmployeeContract(row, true) as Record<string, unknown>;
    expect(Object.keys(out)).not.toContain('ssn');
    expect(Object.keys(out)).not.toContain('ssn_full');
  });
});

/**
 * Crew normalisation.
 *
 * The business runs Crew A and Crew B. A free-text field drifts into "A", "a",
 * "Crew A", "crew-a" within a week and every crew filter silently stops
 * matching — the filter still runs, still returns rows, just the wrong ones.
 * Normalising at the boundary is what stops that.
 */
describe('normaliseCrew', () => {
  it('accepts the two real crews', () => {
    expect(normaliseCrew('A')).toBe('A');
    expect(normaliseCrew('B')).toBe('B');
  });

  it('collapses the spellings that would otherwise drift apart', () => {
    for (const v of ['a', ' a ', 'Crew A', 'crew a', 'CREW-A', 'crew-a']) {
      expect(normaliseCrew(v), `${v} should normalise to A`).toBe('A');
    }
  });

  it('clears the assignment on null, undefined or empty string', () => {
    expect(normaliseCrew(null)).toBeNull();
    expect(normaliseCrew(undefined)).toBeNull();
    expect(normaliseCrew('')).toBeNull();
  });

  it('rejects a crew that does not exist rather than storing it', () => {
    // Storing "C" would create a third crew nobody staffs, and it would only
    // surface as jobs assigned to nobody.
    for (const v of ['C', 'AB', 'Crew C', '1', 'A B']) {
      expect(() => normaliseCrew(v), `${v} should be rejected`).toThrow();
    }
  });
});
