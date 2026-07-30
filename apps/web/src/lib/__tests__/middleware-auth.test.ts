/**
 * Regression tests for the middleware API authentication bypass found on
 * 2026-07-30 against live production.
 *
 * Two independent bypasses each returned 200 with real guest PII on
 * rah-midland.com:
 *
 *   curl -H 'x-api-secret: anything'        /api/bookings   -> 200 + booking data
 *   curl --cookie 'rah-auth-token=garbage'  /api/bookings   -> 200 + booking data
 *
 * Cause: middleware treated the mere PRESENCE of the header/cookie as
 * authentication and deferred validation to the route handler, but most API
 * routes carry no session guard of their own, so nothing ever validated it.
 *
 * These tests exercise the two pure predicates that now gate that path.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { __testing__ } from '../../../middleware';

const { secretMatches, looksLikeLiveIdToken } = __testing__;

const PROJECT = 'echo-prime-ai';

function idToken(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'RS256' })}.${b64(payload)}.signature-not-checked-here`;
}

function validPayload(over: Record<string, unknown> = {}) {
  return {
    sub: 'uid-123',
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...over,
  };
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', PROJECT);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('secretMatches (x-api-secret bypass)', () => {
  it('rejects an arbitrary value - the exact production bypass', () => {
    expect(secretMatches('totally-invalid-value', 'the-real-secret')).toBe(false);
  });

  it('rejects when no secret is configured, rather than accepting everything', () => {
    expect(secretMatches('anything', '')).toBe(false);
    expect(secretMatches('', '')).toBe(false);
  });

  it('accepts only the exact secret', () => {
    expect(secretMatches('the-real-secret', 'the-real-secret')).toBe(true);
  });

  it('rejects prefixes and near-misses', () => {
    expect(secretMatches('the-real-secre', 'the-real-secret')).toBe(false);
    expect(secretMatches('the-real-secretX', 'the-real-secret')).toBe(false);
    expect(secretMatches('the-real-secrez', 'the-real-secret')).toBe(false);
  });
});

describe('looksLikeLiveIdToken (cookie bypass)', () => {
  it('rejects arbitrary garbage - the exact production bypass', () => {
    expect(looksLikeLiveIdToken('not-a-real-token')).toBe(false);
    expect(looksLikeLiveIdToken('x')).toBe(false);
    expect(looksLikeLiveIdToken('')).toBe(false);
  });

  it('rejects a token that is not three segments', () => {
    expect(looksLikeLiveIdToken('aaa.bbb')).toBe(false);
  });

  it('rejects an expired token', () => {
    expect(
      looksLikeLiveIdToken(idToken(validPayload({ exp: Math.floor(Date.now() / 1000) - 1 }))),
    ).toBe(false);
  });

  it('rejects a token minted for a different Firebase project', () => {
    expect(looksLikeLiveIdToken(idToken(validPayload({ aud: 'someone-elses-project' })))).toBe(
      false,
    );
    expect(
      looksLikeLiveIdToken(
        idToken(validPayload({ iss: 'https://securetoken.google.com/attacker' })),
      ),
    ).toBe(false);
  });

  it('rejects a token with no subject', () => {
    expect(looksLikeLiveIdToken(idToken(validPayload({ sub: '' })))).toBe(false);
  });

  it('rejects undecodable payloads without throwing', () => {
    expect(looksLikeLiveIdToken('aaa.!!!not-base64!!!.ccc')).toBe(false);
  });

  it('accepts a well-formed unexpired token for this project', () => {
    expect(looksLikeLiveIdToken(idToken(validPayload()))).toBe(true);
  });
});
