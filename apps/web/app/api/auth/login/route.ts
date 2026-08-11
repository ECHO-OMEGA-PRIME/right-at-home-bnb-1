/**
 * POST /api/auth/login — sign in through echo-auth.
 *
 * echo-auth is the fleet's ONE identity runtime (CLAUDE.md LAW 2026-07-31).
 * This is not a new auth system: it forwards to `POST /v1/login` on
 * `auth.echo-op.com` and returns what that answers.
 *
 * It goes through our own origin rather than the browser calling echo-auth
 * directly for three reasons: no CORS or CSP surface to widen, the identity
 * host stays a server-side config value rather than something shipped in the
 * bundle, and failure semantics can be normalised here so the client cannot
 * mistake an outage for a bad password.
 *
 * FAIL CLOSED, and note the second half of that rule: an unreachable echo-auth
 * is a 503, never a 401. Telling somebody with a correct password that their
 * password is wrong is its own bug -- it sends them to reset a credential that
 * was fine, and it hides the outage. Only echo-auth actually saying "those
 * credentials are wrong" produces a 401.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ECHO_AUTH_ISSUER = process.env.ECHO_AUTH_ISSUER?.trim() || 'https://auth.echo-op.com';
const AUTH_COOKIE = 'rah-auth-token';

/** echo-auth is a network hop; without a bound a hung upstream hangs the login form. */
const LOGIN_TIMEOUT_MS = 10_000;

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required', code: 'MISSING_CREDENTIALS' },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${ECHO_AUTH_ISSUER}/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    console.error('[auth/login] echo-auth unreachable', error);
    return NextResponse.json(
      { error: 'Sign-in is temporarily unavailable', code: 'AUTH_BACKEND_UNAVAILABLE' },
      { status: 503, headers: { 'Retry-After': '30' } },
    );
  }

  const payload = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    // 5xx from echo-auth is its outage, not the caller's mistake, so it must not
    // become a 401 on the way through.
    if (upstream.status >= 500) {
      console.error('[auth/login] echo-auth error', { status: upstream.status });
      return NextResponse.json(
        { error: 'Sign-in is temporarily unavailable', code: 'AUTH_BACKEND_UNAVAILABLE' },
        { status: 503, headers: { 'Retry-After': '30' } },
      );
    }

    // 401/404 mean echo-auth does not accept these credentials. Reported as a
    // distinct code so the client can decide whether to try the legacy path,
    // and deliberately without echoing upstream's message -- it must not become
    // an oracle for which addresses exist.
    return NextResponse.json(
      { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
      { status: 401 },
    );
  }

  const accessToken = payload?.access_token;
  if (typeof accessToken !== 'string' || !accessToken) {
    // A 200 with no usable token is a contract break, not a successful login.
    console.error('[auth/login] echo-auth returned 200 without an access token');
    return NextResponse.json(
      { error: 'Sign-in is temporarily unavailable', code: 'AUTH_BACKEND_UNAVAILABLE' },
      { status: 503, headers: { 'Retry-After': '30' } },
    );
  }

  const upstreamTtl =
    typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in)
      ? Math.floor(payload.expires_in)
      : 3600;
  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
  response.cookies.set(AUTH_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    path: '/',
    // Never let a browser retain a one-hour bearer for the old 30-day client
    // cookie lifetime. The JWT expiry is still verified server-side; this just
    // keeps the browser lifecycle aligned with it.
    maxAge: Math.max(1, Math.min(upstreamTtl, 3600)),
  });
  return response;
}
