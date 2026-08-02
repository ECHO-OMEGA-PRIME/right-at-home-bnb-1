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
import { NextRequest } from 'next/server';

import { __testing__, middleware } from '../../../middleware';

const { secretMatches, looksLikeLiveIdToken, looksLikeEchoAuthToken, looksLikeAcceptableToken } =
  __testing__;

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

/**
 * echo-auth is the fleet's ONE identity runtime (LAW 2026-07-31), and its
 * tokens are issued by https://auth.echo-op.com rather than by Google's
 * securetoken service.
 *
 * Before the edge accepted that issuer, every echo-auth token was rejected here
 * and the cookie cleared -- while `verifyAuthToken` in the route handlers
 * accepted the same token happily. The frontend cutover is impossible until the
 * two agree, so these tests pin the agreement.
 */
describe('looksLikeEchoAuthToken', () => {
  const ECHO_ISS = 'https://auth.echo-op.com';

  function echoPayload(over: Record<string, unknown> = {}) {
    return {
      sub: 'uid-123',
      aud: PROJECT,
      iss: ECHO_ISS,
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...over,
    };
  }

  it('accepts a well-formed echo-auth token', () => {
    expect(looksLikeEchoAuthToken(idToken(echoPayload()))).toBe(true);
  });

  it('rejects an expired one', () => {
    expect(
      looksLikeEchoAuthToken(idToken(echoPayload({ exp: Math.floor(Date.now() / 1000) - 60 }))),
    ).toBe(false);
  });

  it('rejects a foreign issuer even when every other claim is right', () => {
    expect(looksLikeEchoAuthToken(idToken(echoPayload({ iss: 'https://auth.evil.test' })))).toBe(
      false,
    );
  });

  it('rejects a foreign audience', () => {
    expect(
      looksLikeEchoAuthToken(idToken(echoPayload({ aud: 'someone-elses-project' }))),
    ).toBe(false);
  });

  it('rejects a token with no subject', () => {
    expect(looksLikeEchoAuthToken(idToken(echoPayload({ sub: '' })))).toBe(false);
  });

  it('does not accept a Firebase token as an echo-auth one, or vice versa', () => {
    // The two families share an `aud` today. Checking the issuer per family is
    // what keeps that coincidence from becoming the thing holding this up.
    expect(looksLikeEchoAuthToken(idToken(validPayload()))).toBe(false);
    expect(looksLikeLiveIdToken(idToken(echoPayload()))).toBe(false);
  });
});

describe('looksLikeAcceptableToken', () => {
  const echo = () => ({
    sub: 'uid-123',
    aud: PROJECT,
    iss: 'https://auth.echo-op.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  it('accepts either family', () => {
    expect(looksLikeAcceptableToken(idToken(validPayload()))).toBe(true);
    expect(looksLikeAcceptableToken(idToken(echo()))).toBe(true);
  });

  it('still refuses everything else, so the gate stays closed by default', () => {
    expect(looksLikeAcceptableToken('garbage')).toBe(false);
    expect(looksLikeAcceptableToken('aaa.!!!not-base64!!!.ccc')).toBe(false);
    expect(
      looksLikeAcceptableToken(idToken({ ...echo(), iss: 'https://auth.evil.test' })),
    ).toBe(false);
  });
});

describe('middleware auth route lifecycle', () => {
  function post(pathname: string, cookie?: string) {
    return middleware(
      new NextRequest(`https://rah.example${pathname}`, {
        method: 'POST',
        headers: cookie ? { cookie } : undefined,
      }),
    );
  }

  it.each(['/api/auth/login', '/api/auth/signup'])(
    'allows unauthenticated POST %s to reach its route handler',
    async (pathname) => {
      const response = await post(pathname);

      expect(response.status).toBe(200);
      expect(response.headers.get('x-middleware-next')).toBe('1');
    },
  );

  it('lets logout clear a missing or malformed session cookie', async () => {
    expect((await post('/api/auth/logout')).headers.get('x-middleware-next')).toBe('1');
    expect(
      (await post('/api/auth/logout', 'rah-auth-token=malformed')).headers.get(
        'x-middleware-next',
      ),
    ).toBe('1');
  });

  it.each(['/api/auth/link', '/api/me'])(
    'keeps unauthenticated POST %s behind the API gate',
    async (pathname) => {
      const response = await post(pathname);

      expect(response.status).toBe(401);
      expect(response.headers.get('x-middleware-next')).toBeNull();
    },
  );

  it('does not make non-POST auth requests public by path alone', async () => {
    const response = await middleware(
      new NextRequest('https://rah.example/api/auth/login', { method: 'GET' }),
    );

    expect(response.status).toBe(401);
  });

  it('rejects a forged JWT-shaped cookie after authoritative verification', async () => {
    const forged = idToken({
      sub: 'attacker',
      aud: PROJECT,
      iss: 'https://auth.echo-op.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await post('/api/bookings', `rah-auth-token=${forged}`);

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://rah.example/api/me'),
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('uses the database-backed role from /api/me for admin-only APIs', async () => {
    const token = idToken({
      sub: 'worker',
      aud: PROJECT,
      iss: 'https://auth.echo-op.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ role: 'worker' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const response = await post('/api/admin/users', `rah-auth-token=${token}`);

    expect(response.status).toBe(403);
  });

  it('fails unavailable instead of trusting a token when verification is down', async () => {
    const token = idToken({
      sub: 'user',
      aud: PROJECT,
      iss: 'https://auth.echo-op.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const response = await post('/api/bookings', `rah-auth-token=${token}`);

    expect(response.status).toBe(503);
  });
});
