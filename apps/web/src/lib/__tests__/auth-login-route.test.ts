/**
 * POST /api/auth/login — the echo-auth proxy.
 *
 * Almost every assertion here is about the difference between "those
 * credentials are wrong" and "we could not ask". Collapsing the two is the
 * failure the whole fail-closed rule exists for: a 401 during an outage tells a
 * user with a correct password that it was wrong, sends them to reset a
 * credential that was fine, and hides the real fault.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { POST } from '../../../app/api/auth/login/route';

const fetchMock = vi.fn();

function request(body: unknown) {
  return { json: async () => body } as never;
}

function upstream(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

const SESSION = {
  access_token: 'header.payload.signature',
  refresh_token: 'refresh-abc',
  uid: 'firebase-localid-preserved',
  email: 'guest@example.com',
  expires_in: 3600,
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/auth/login', () => {
  it('forwards to echo-auth and returns the session', async () => {
    fetchMock.mockResolvedValue(upstream(200, SESSION));

    const res = await POST(request({ email: ' Guest@Example.com ', password: 'hunter2' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      access_token: SESSION.access_token,
      uid: SESSION.uid,
      expires_in: 3600,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://auth.echo-op.com/v1/login');
    expect(init.method).toBe('POST');
    // Trimmed, and the password passed through untouched.
    expect(JSON.parse(init.body)).toEqual({
      email: 'Guest@Example.com',
      password: 'hunter2',
    });
  });

  it('never caches a session response', async () => {
    fetchMock.mockResolvedValue(upstream(200, SESSION));
    const res = await POST(request({ email: 'a@b.c', password: 'x' }));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 401 when echo-auth rejects the credentials', async () => {
    fetchMock.mockResolvedValue(upstream(401, { error: 'bad credentials' }));

    const res = await POST(request({ email: 'a@b.c', password: 'wrong' }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('does not leak whether an address exists', async () => {
    // Upstream distinguishes 404 from 401; we must not pass that distinction on,
    // or the endpoint becomes an account-enumeration oracle.
    fetchMock.mockResolvedValue(upstream(404, { error: 'no such user' }));

    const res = await POST(request({ email: 'nobody@example.com', password: 'x' }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(JSON.stringify(body)).not.toMatch(/no such user/);
  });

  it('returns 503, NOT 401, when echo-auth is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await POST(request({ email: 'a@b.c', password: 'correct-password' }));

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    await expect(res.json()).resolves.toMatchObject({ code: 'AUTH_BACKEND_UNAVAILABLE' });
  });

  it('returns 503, NOT 401, when echo-auth 500s', async () => {
    fetchMock.mockResolvedValue(upstream(500, { error: 'boom' }));

    const res = await POST(request({ email: 'a@b.c', password: 'correct-password' }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: 'AUTH_BACKEND_UNAVAILABLE' });
  });

  it('treats a 200 with no access token as an outage, not a login', async () => {
    fetchMock.mockResolvedValue(upstream(200, { uid: 'x' }));

    const res = await POST(request({ email: 'a@b.c', password: 'x' }));

    expect(res.status).toBe(503);
  });

  it('bounds the upstream call so a hung echo-auth cannot hang the form', async () => {
    fetchMock.mockResolvedValue(upstream(200, SESSION));
    await POST(request({ email: 'a@b.c', password: 'x' }));
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });

  it('rejects missing credentials without calling upstream', async () => {
    const bodies = [{}, { email: 'a@b.c' }, { password: 'x' }, { email: '   ', password: 'x' }];
    for (const body of bodies) {
      const res = await POST(request(body));
      expect(res.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON body without calling upstream', async () => {
    const res = await POST({
      json: async () => {
        throw new Error('not json');
      },
    } as never);

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
