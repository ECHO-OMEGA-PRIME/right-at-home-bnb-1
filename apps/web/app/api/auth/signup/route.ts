/**
 * POST /api/auth/signup — create an account through echo-auth.
 *
 * echo-auth is the fleet's ONE identity runtime (CLAUDE.md LAW 2026-07-31).
 * This forwards to `POST /v1/signup` on `auth.echo-op.com` and returns what
 * that answers, for the same reasons as the login proxy: no CORS or CSP surface
 * to widen, the identity host stays server-side config, and failure semantics
 * are normalised in one place.
 *
 * TWO PROPERTIES OF echo-auth's SIGNUP THAT THIS MUST NOT BREAK
 * -------------------------------------------------------------
 * 1. It answers **202 with no tokens, ever** — including for an address that
 *    already exists. Four of the six services behind echo-auth authorize by
 *    EMAIL rather than uid, so issuing a session for an address nobody has
 *    proved they control would hand over that address's existing access. The
 *    account is created unverified and is unusable until confirmed.
 * 2. That identical 202 is deliberate anti-enumeration. Reporting "already
 *    registered" would turn signup into an account-existence oracle for every
 *    Echo property at once. This proxy therefore does NOT inspect, translate or
 *    enrich the outcome — passing it through unchanged is the security
 *    property, not laziness.
 *
 * Fail closed: an unreachable echo-auth is 503, never a fabricated success. A
 * signup that silently did nothing while telling the user to check their email
 * is worse than an error, because they will wait for a message that is never
 * coming.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ECHO_AUTH_ISSUER = process.env.ECHO_AUTH_ISSUER?.trim() || 'https://auth.echo-op.com';
const SIGNUP_TIMEOUT_MS = 10_000;

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
    upstream = await fetch(`${ECHO_AUTH_ISSUER}/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(SIGNUP_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    console.error('[auth/signup] echo-auth unreachable', error);
    return NextResponse.json(
      { error: 'Sign-up is temporarily unavailable', code: 'AUTH_BACKEND_UNAVAILABLE' },
      { status: 503, headers: { 'Retry-After': '30' } },
    );
  }

  const payload = await upstream.json().catch(() => null);

  if (upstream.status === 202) {
    return NextResponse.json(
      { status: 'accepted' },
      { status: 202, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // A rejected PASSWORD is safe to report: it describes the submitted
  // credential, not whether the account exists.
  if (upstream.status === 400 && payload?.error === 'password_too_short') {
    return NextResponse.json(
      {
        error: `Password must be at least ${payload.min_length ?? 10} characters`,
        code: 'PASSWORD_TOO_SHORT',
      },
      { status: 400 },
    );
  }

  if (upstream.status === 422) {
    return NextResponse.json(
      { error: 'Please enter a valid email address', code: 'INVALID_EMAIL' },
      { status: 400 },
    );
  }

  if (upstream.status === 503 && payload?.error === 'signup_disabled') {
    return NextResponse.json(
      { error: 'Sign-up is currently closed', code: 'SIGNUP_DISABLED' },
      { status: 503 },
    );
  }

  console.error('[auth/signup] unexpected echo-auth response', { status: upstream.status });
  return NextResponse.json(
    { error: 'Sign-up is temporarily unavailable', code: 'AUTH_BACKEND_UNAVAILABLE' },
    { status: 503, headers: { 'Retry-After': '30' } },
  );
}
