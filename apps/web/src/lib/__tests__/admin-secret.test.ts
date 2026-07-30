/**
 * ADMIN_API_SECRET validation tests.
 *
 * The defect these pin: `process.env.ADMIN_API_SECRET || 'rah-vrbo-sync-2026'`.
 * A missing secret must DENY, never substitute a published default — the whole
 * point is that a misconfigured deployment refuses service instead of accepting
 * a value anyone can read in the repo.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { adminSecretConfigured, adminSecretMatches } from '../admin-secret';

const REAL = 'a-real-secret-value';
let saved: string | undefined;

beforeEach(() => {
  saved = process.env.ADMIN_API_SECRET;
});

afterEach(() => {
  if (saved === undefined) delete process.env.ADMIN_API_SECRET;
  else process.env.ADMIN_API_SECRET = saved;
});

describe('a missing secret fails CLOSED', () => {
  it('denies everything when the env var is unset', () => {
    delete process.env.ADMIN_API_SECRET;
    expect(adminSecretMatches('anything')).toBe(false);
    expect(adminSecretMatches('')).toBe(false);
    expect(adminSecretConfigured()).toBe(false);
  });

  it('denies the retired hardcoded fallback specifically', () => {
    // The literal that used to be accepted when the env var was missing.
    delete process.env.ADMIN_API_SECRET;
    expect(adminSecretMatches('rah-vrbo-sync-2026')).toBe(false);
  });

  it('treats an empty/whitespace env var as unset', () => {
    process.env.ADMIN_API_SECRET = '   ';
    expect(adminSecretMatches('   ')).toBe(false);
    expect(adminSecretMatches('')).toBe(false);
    expect(adminSecretConfigured()).toBe(false);
  });
});

describe('matching', () => {
  beforeEach(() => {
    process.env.ADMIN_API_SECRET = REAL;
  });

  it('accepts the exact secret', () => {
    expect(adminSecretMatches(REAL)).toBe(true);
  });

  it('rejects a wrong secret of the SAME length', () => {
    // A length-only comparison would pass this.
    const wrong = 'b'.repeat(REAL.length);
    expect(wrong.length).toBe(REAL.length);
    expect(adminSecretMatches(wrong)).toBe(false);
  });

  it('rejects a prefix, a suffix and a superstring', () => {
    expect(adminSecretMatches(REAL.slice(0, -1))).toBe(false);
    expect(adminSecretMatches(REAL.slice(1))).toBe(false);
    expect(adminSecretMatches(REAL + 'x')).toBe(false);
  });

  it('rejects null and undefined without throwing', () => {
    expect(adminSecretMatches(null)).toBe(false);
    expect(adminSecretMatches(undefined)).toBe(false);
  });

  it('tolerates surrounding whitespace on the supplied value', () => {
    // `vercel env pull` writes values that arrive padded; a real secret should
    // not fail because of a trailing newline.
    expect(adminSecretMatches(`  ${REAL}\n`)).toBe(true);
  });

  it('is case sensitive', () => {
    expect(adminSecretMatches(REAL.toUpperCase())).toBe(false);
  });
});
