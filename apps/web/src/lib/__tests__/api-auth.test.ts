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
const docGet = vi.fn();

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}));

vi.mock('@/lib/firebase-admin', () => ({
  default: { name: 'test-app' },
  db: { collection: () => ({ doc: () => ({ get: docGet }) }) },
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
});

describe('verifyAuthToken', () => {
  it('returns null when the token itself is invalid', async () => {
    verifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired'));
    await expect(verifyAuthToken(TOKEN)).resolves.toBeNull();
    expect(docGet).not.toHaveBeenCalled();
  });

  it('throws RoleStoreUnavailableError when the role read fails', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com' });
    docGet.mockRejectedValue(Object.assign(new Error('Quota exceeded.'), { code: 8 }));
    await expect(verifyAuthToken(TOKEN)).rejects.toBeInstanceOf(RoleStoreUnavailableError);
  });

  it('does not fail open when the role store is down', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com' });
    docGet.mockRejectedValue(new Error('Quota exceeded.'));
    // Specifically: it must not resolve to a usable user of ANY role.
    await expect(verifyAuthToken(TOKEN)).rejects.toThrow();
  });

  it('uses the role custom claim without touching the role store', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com', role: 'owner' });
    const user = await verifyAuthToken(TOKEN);
    expect(user).toMatchObject({ uid: 'u1', role: 'owner', isDevMode: false });
    expect(docGet).not.toHaveBeenCalled();
  });

  it('ignores an invalid role claim and falls back to the role store', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com', role: 'superuser' });
    docGet.mockResolvedValue({ exists: true, data: () => ({ role: 'worker' }) });
    await expect(verifyAuthToken(TOKEN)).resolves.toMatchObject({ role: 'worker' });
    expect(docGet).toHaveBeenCalled();
  });

  it('treats a missing user document as guest', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com' });
    docGet.mockResolvedValue({ exists: false, data: () => undefined });
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
    docGet.mockRejectedValue(new Error('Quota exceeded.'));

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
