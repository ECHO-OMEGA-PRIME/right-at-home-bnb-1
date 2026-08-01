/**
 * Regression tests for the RAH authentication path.
 *
 * Written against a real production incident (2026-07-30): echo-prime-ai
 * Firestore began returning 429 RESOURCE_EXHAUSTED, the role lookup threw, a
 * blanket `catch { return null }` turned that into `401 Authentication
 * required`, and every correctly-authenticated user appeared to be unable to
 * log in. These tests pin the three properties that incident violated:
 *
 *   1. A role-store outage must NOT be reported as an authentication failure.
 *   2. A role-store outage must NOT fail open into any role.
 *   3. A verified token carrying a role claim must not need the role store.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const verifyIdToken = vi.fn();
const findFirst = vi.fn();
const decodeJwt = vi.fn();
const jwtVerify = vi.fn();

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}));

vi.mock('@/lib/firebase-admin', () => ({
  default: { name: 'test-app' },
}));

// The role store is Postgres, not Firestore. This mock MUST exist: without it
// the Prisma client throws "Environment variable not found: DATABASE_URL",
// which surfaces as RoleStoreUnavailableError and makes the store-down tests
// pass for entirely the wrong reason.
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findFirst } },
  default: { user: { findFirst } },
}));

// jose is an ESM namespace, so its exports are frozen and vi.spyOn cannot
// redefine them ("Cannot redefine property: decodeJwt"). It has to be mocked
// at the module boundary instead.
vi.mock('jose', () => ({
  decodeJwt,
  jwtVerify,
  createRemoteJWKSet: () => 'jwks-stub',
}));

import { RoleStoreUnavailableError, requireAuth, verifyAuthToken } from '../api-auth';

const TOKEN = 'valid.id.token';

function requestWithToken(token?: string) {
  return {
    cookies: { get: (n: string) => (token && n === 'rah-auth-token' ? { value: token } : undefined) },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  // NODE_ENV is typed readonly, so stub it rather than assigning.
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('ALLOW_DEV_LOGIN', '');
  // Default: a token is NOT echo-auth issued, so it routes to the legacy path.
  decodeJwt.mockReturnValue({ iss: 'https://securetoken.google.com/echo-prime-ai' });
});

describe('verifyAuthToken', () => {
  it('returns null when the token itself is invalid', async () => {
    verifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired'));
    await expect(verifyAuthToken(TOKEN)).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('throws RoleStoreUnavailableError when the role read fails', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com' });
    findFirst.mockRejectedValue(Object.assign(new Error('connection refused'), { code: 'P1001' }));
    await expect(verifyAuthToken(TOKEN)).rejects.toBeInstanceOf(RoleStoreUnavailableError);
  });

  it('does not fail open when the role store is down', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com' });
    findFirst.mockRejectedValue(new Error('connection refused'));
    // Specifically: it must not resolve to a usable user of ANY role.
    await expect(verifyAuthToken(TOKEN)).rejects.toThrow();
  });

  it('uses the role custom claim without touching the role store', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com', role: 'owner' });
    const user = await verifyAuthToken(TOKEN);
    expect(user).toMatchObject({ uid: 'u1', role: 'owner', isDevMode: false });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('ignores an invalid role claim and falls back to the role store', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com', role: 'superuser' });
    findFirst.mockResolvedValue({ role: 'WORKER' });
    await expect(verifyAuthToken(TOKEN)).resolves.toMatchObject({ role: 'worker' });
    expect(findFirst).toHaveBeenCalled();
  });

  it('treats a missing user document as guest', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com' });
    findFirst.mockResolvedValue(null);
    await expect(verifyAuthToken(TOKEN)).resolves.toMatchObject({ role: 'guest' });
  });

  it('rejects dev tokens outside development', async () => {
    await expect(verifyAuthToken('dev_owner_general')).resolves.toBeNull();
  });
});

describe('requireAuth', () => {
  it('returns 401 for an invalid token', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad token'));
    const { error } = await requireAuth(requestWithToken(TOKEN));
    expect(error?.status).toBe(401);
    await expect(error?.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns a retryable 503 - not 401 - when the role store is down', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com' });
    findFirst.mockRejectedValue(new Error('connection refused'));

    const { user, error } = await requireAuth(requestWithToken(TOKEN));

    expect(error?.status).toBe(503);
    expect(error?.headers.get('Retry-After')).toBe('30');
    await expect(error?.json()).resolves.toMatchObject({
      code: 'AUTH_BACKEND_UNAVAILABLE',
    });
    // and the caller is never handed a usable identity
    expect(user).toBeNull();
  });

  it('passes an authenticated user through', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com', role: 'owner' });
    const { user, error } = await requireAuth(requestWithToken(TOKEN));
    expect(error).toBeNull();
    expect(user).toMatchObject({ uid: 'u1', role: 'owner' });
  });
});

/**
 * echo-auth integration (LAW 2026-07-31: one identity runtime, never Firebase
 * direct). These pin the four states the law requires proof of, plus the
 * fail-closed branch that the Firestore incident showed is the one that matters.
 */
describe('echo-auth identity path', () => {
  const ISS = 'https://auth.echo-op.com';

  it('routes a non-echo-auth issuer to the legacy Firebase path', async () => {
    // A Firebase token must NOT be judged by the echo-auth verifier.
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com', role: 'owner' });
    const user = await verifyAuthToken(TOKEN);
    expect(user).toMatchObject({ uid: 'u1', role: 'owner' });
    expect(verifyIdToken).toHaveBeenCalled();
  });

  it('garbage token -> 401, never a login', async () => {
    verifyIdToken.mockRejectedValue(new Error('Decoding Firebase ID token failed'));
    const { user, error } = await requireAuth(requestWithToken('total-garbage'));
    expect(user).toBeNull();
    expect(error?.status).toBe(401);
  });

  it('no token -> 401', async () => {
    const { user, error } = await requireAuth(requestWithToken(undefined));
    expect(user).toBeNull();
    expect(error?.status).toBe(401);
  });

  it('an unreachable JWKS is a 503, NOT a 401 - fail closed', async () => {
    decodeJwt.mockReturnValue({ iss: ISS });
    jwtVerify.mockRejectedValue(new Error('fetch failed')); // no ERR_JW* code => transport

    const { user, error } = await requireAuth(requestWithToken('echo.auth.token'));

    expect(error?.status).toBe(503);
    expect(error?.headers.get('Retry-After')).toBe('30');
    await expect(error?.json()).resolves.toMatchObject({
      code: 'AUTH_BACKEND_UNAVAILABLE',
    });
    expect(user).toBeNull();
    // and it must never have been handed to the legacy verifier
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('a signature failure is a 401, not a 503 - a bad token is not an outage', async () => {
    decodeJwt.mockReturnValue({ iss: ISS });
    jwtVerify.mockRejectedValue(
      Object.assign(new Error('signature verification failed'), {
        code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
      })
    );
    verifyIdToken.mockRejectedValue(new Error('not a firebase token either'));

    const { user, error } = await requireAuth(requestWithToken('echo.auth.token'));

    expect(error?.status).toBe(401);
    expect(user).toBeNull();
  });
});
