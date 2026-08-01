/**
 * GET /api/me — the endpoint that lets the browser stop reading Firestore to
 * find out who it is.
 *
 * The law (CLAUDE.md 2026-07-31) requires proving four states, and is explicit
 * about why the last one matters: without a positive control, "403 everywhere"
 * looks exactly like a fix and is actually an outage.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above every const in this file, so a factory that returns
// the mock DIRECTLY hits the temporal dead zone ("Cannot access 'requireAuth'
// before initialization"). vi.hoisted lifts the declaration with it. A factory
// that only touches the mock inside a nested closure gets away without this,
// which is why the sibling api-auth test does not need it.
const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }));

vi.mock('@/lib/api-auth', () => ({ requireAuth }));

import { GET } from '../../../app/api/me/route';

function req() {
  return {} as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/me', () => {
  it('returns the caller identity for a legitimate user (positive control)', async () => {
    requireAuth.mockResolvedValue({
      user: {
        uid: 'u1',
        email: 'owner@example.com',
        role: 'owner',
        workerType: null,
        isDevMode: false,
      },
      error: null,
    });

    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      uid: 'u1',
      email: 'owner@example.com',
      role: 'owner',
    });
  });

  it('never caches identity in a shared cache', async () => {
    requireAuth.mockResolvedValue({
      user: { uid: 'u1', email: null, role: 'guest', workerType: null, isDevMode: false },
      error: null,
    });

    const res = await GET(req());
    // A shared cache here would hand one user another user's role.
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('propagates 401 rather than inventing an anonymous identity', async () => {
    const { NextResponse } = await import('next/server');
    requireAuth.mockResolvedValue({
      user: null,
      error: NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 }),
    });

    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('propagates the retryable 503 rather than downgrading it to 401', async () => {
    const { NextResponse } = await import('next/server');
    requireAuth.mockResolvedValue({
      user: null,
      error: NextResponse.json(
        { code: 'AUTH_BACKEND_UNAVAILABLE' },
        { status: 503, headers: { 'Retry-After': '30' } }
      ),
    });

    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    // The distinction is the whole point: a 401 here would make an outage
    // indistinguishable from a bad credential.
    await expect(res.json()).resolves.toMatchObject({
      code: 'AUTH_BACKEND_UNAVAILABLE',
    });
  });

  it('reports only the caller, never a uid supplied by the caller', async () => {
    // The uid comes from the verified token inside requireAuth. Nothing in the
    // request can redirect this endpoint at somebody else's record.
    requireAuth.mockResolvedValue({
      user: { uid: 'real-uid', email: null, role: 'guest', workerType: null, isDevMode: false },
      error: null,
    });

    const res = await GET({ nextUrl: { searchParams: new URLSearchParams({ uid: 'victim' }) } } as never);
    await expect(res.json()).resolves.toMatchObject({ uid: 'real-uid' });
  });
});
