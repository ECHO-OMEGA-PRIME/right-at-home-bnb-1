/**
 * POST /api/auth/signup — the echo-auth signup proxy.
 *
 * The property under test is mostly what this route REFUSES to do. echo-auth
 * answers an identical 202 for a brand-new address and one that already exists,
 * on purpose: distinguishing them would turn signup into an account-existence
 * oracle for every Echo property at once. A proxy that "helpfully" translated
 * those into different answers would hand that oracle straight back.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { POST } from '../../../app/api/auth/signup/route';

const fetchMock = vi.fn();

function request(body: unknown) {
  return { json: async () => body } as never;
}

function upstream(status: number, payload: unknown = null) {
  return { status, json: async () => payload };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/auth/signup', () => {
  it('forwards to echo-auth and passes the 202 through', async () => {
    fetchMock.mockResolvedValue(upstream(202, { status: 'accepted' }));

    const res = await POST(request({ email: ' New@Example.com ', password: 'a-long-password' }));

    expect(res.status).toBe(202);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://auth.echo-op.com/v1/signup');
    expect(JSON.parse(init.body)).toEqual({
      email: 'New@Example.com',
      password: 'a-long-password',
    });
  });

  it('answers identically for an address that already exists', async () => {
    // echo-auth returns the same 202 in both cases. This asserts the proxy does
    // not develop an opinion about which one happened -- it cannot, and must
    // not appear to.
    fetchMock.mockResolvedValue(upstream(202, { status: 'accepted' }));

    const fresh = await POST(request({ email: 'new@example.com', password: 'a-long-password' }));
    const taken = await POST(request({ email: 'taken@example.com', password: 'a-long-password' }));

    expect(fresh.status).toBe(taken.status);
    await expect(fresh.json()).resolves.toEqual(await taken.json());
  });

  it('never returns a token, even if upstream somehow sent one', async () => {
    // Belt and braces: an unverified address must not receive a session,
    // because services behind echo-auth authorize by email.
    fetchMock.mockResolvedValue(upstream(202, { status: 'accepted', access_token: 'nope' }));

    const body = await (await POST(request({ email: 'a@b.co', password: 'a-long-password' }))).json();

    expect(body).not.toHaveProperty('access_token');
    expect(body).toEqual({ status: 'accepted' });
  });

  it('reports a rejected password, which describes the credential not the account', async () => {
    fetchMock.mockResolvedValue(upstream(400, { error: 'password_too_short', min_length: 10 }));

    const res = await POST(request({ email: 'a@b.co', password: 'short' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: 'PASSWORD_TOO_SHORT' });
  });

  it('maps an upstream validation failure to a plain invalid-email answer', async () => {
    fetchMock.mockResolvedValue(upstream(422, { detail: [{ msg: 'not a valid email' }] }));

    const res = await POST(request({ email: 'nope@nope.invalid', password: 'a-long-password' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: 'INVALID_EMAIL' });
  });

  it('returns 503 when echo-auth is unreachable, never a fabricated success', async () => {
    // Telling somebody to check their email when nothing was sent is worse than
    // an error -- they wait for a message that is never coming.
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await POST(request({ email: 'a@b.co', password: 'a-long-password' }));

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    await expect(res.json()).resolves.toMatchObject({ code: 'AUTH_BACKEND_UNAVAILABLE' });
  });

  it('surfaces a closed signup distinctly', async () => {
    fetchMock.mockResolvedValue(upstream(503, { error: 'signup_disabled' }));

    const res = await POST(request({ email: 'a@b.co', password: 'a-long-password' }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: 'SIGNUP_DISABLED' });
  });

  it('treats any other upstream status as an outage rather than guessing', async () => {
    fetchMock.mockResolvedValue(upstream(418, { error: 'teapot' }));

    const res = await POST(request({ email: 'a@b.co', password: 'a-long-password' }));

    expect(res.status).toBe(503);
  });

  it('rejects missing input without calling upstream', async () => {
    for (const body of [{}, { email: 'a@b.co' }, { password: 'x' }, { email: '  ', password: 'x' }]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
