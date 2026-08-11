import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authInstance,
  clearAuthCookie,
  firebaseSignOut,
  setAuthCookie,
  signInWithPopup,
} = vi.hoisted(() => ({
  authInstance: { currentUser: null as unknown },
  clearAuthCookie: vi.fn(),
  firebaseSignOut: vi.fn(),
  setAuthCookie: vi.fn(),
  signInWithPopup: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: () => ({ options: { projectId: 'echo-prime-ai' } }),
}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class { addScope() {} },
  OAuthProvider: class { addScope() {} },
  getAuth: () => authInstance,
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup,
  signOut: firebaseSignOut,
}));
vi.mock('@/lib/firebase-client-config', () => ({
  getFirebaseClientConfig: () => ({ projectId: 'echo-prime-ai' }),
  getFirebaseClientConfigurationStatus: () => ({ configured: true }),
}));
vi.mock('@/lib/auth-cookie', () => ({
  clearAuthCookie,
  setAuthCookie,
}));

import {
  SignInUnavailableError,
  getCurrentUser,
  signInWithEmail,
  signInWithGoogle,
  signOut,
} from '../auth';

const fetchMock = vi.fn();

function response(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  clearAuthCookie.mockReset();
  firebaseSignOut.mockReset();
  setAuthCookie.mockReset();
  signInWithPopup.mockReset();
  authInstance.currentUser = null;
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('echo-auth client session', () => {
  it('hydrates /api/me without a Firebase currentUser', async () => {
    fetchMock.mockResolvedValueOnce(
      response(200, { uid: 'uid-1', email: 'owner@example.test', role: 'admin' }),
    );

    await expect(getCurrentUser()).resolves.toMatchObject({ uid: 'uid-1', role: 'admin' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('completes login, guarded linking, and profile hydration in order', async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, { ok: true }))
      .mockResolvedValueOnce(response(200, { ok: true, linked: true }))
      .mockResolvedValueOnce(
        response(200, { uid: 'uid-1', email: 'owner@example.test', role: 'admin' }),
      );

    await expect(signInWithEmail('owner@example.test', 'correct')).resolves.toMatchObject({
      uid: 'uid-1',
      role: 'admin',
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/login',
      '/api/auth/link',
      '/api/me',
    ]);
  });

  it('clears the new session when identity linking fails', async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, { ok: true }))
      .mockResolvedValueOnce(response(409, { code: 'IDENTITY_LINK_CONFLICT' }))
      .mockResolvedValueOnce(response(200, { ok: true }));

    await expect(signInWithEmail('owner@example.test', 'correct')).rejects.toThrow(
      'could not be linked securely',
    );
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/login',
      '/api/auth/link',
      '/api/auth/logout',
    ]);
  });

  it('reports a link backend outage as unavailable after clearing the session', async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, { ok: true }))
      .mockResolvedValueOnce(response(503, { code: 'AUTH_BACKEND_UNAVAILABLE' }))
      .mockResolvedValueOnce(response(200, { ok: true }));

    await expect(signInWithEmail('owner@example.test', 'correct')).rejects.toBeInstanceOf(
      SignInUnavailableError,
    );
  });

  it('does not report logout success when the HttpOnly cookie could not be cleared', async () => {
    fetchMock.mockResolvedValueOnce(response(503, { code: 'AUTH_BACKEND_UNAVAILABLE' }));

    await expect(signOut()).rejects.toThrow('Sign-out is temporarily unavailable');
  });

  it('tears down both provider sessions when a social identity link is rejected', async () => {
    const providerUser = {
      uid: 'provider-uid',
      email: 'owner@example.test',
      displayName: 'Owner',
      photoURL: null,
      emailVerified: true,
      getIdToken: vi.fn().mockResolvedValue('provider-token'),
    };
    authInstance.currentUser = providerUser;
    signInWithPopup.mockResolvedValue({ user: providerUser });
    fetchMock
      .mockResolvedValueOnce(response(409, { code: 'IDENTITY_LINK_CONFLICT' }))
      .mockResolvedValueOnce(response(200, { ok: true }));

    await expect(signInWithGoogle()).rejects.toThrow('could not be linked securely');

    expect(setAuthCookie).toHaveBeenCalledWith('provider-token');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/link',
      '/api/auth/logout',
    ]);
    expect(clearAuthCookie).toHaveBeenCalled();
    expect(firebaseSignOut).toHaveBeenCalledWith(authInstance);
  });
});
