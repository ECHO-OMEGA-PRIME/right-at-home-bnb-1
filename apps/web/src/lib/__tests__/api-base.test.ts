/**
 * API base-URL guard.
 *
 * The shared axios client was built as
 *
 *     process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
 *
 * and in production that variable held
 * "https://rightathome-api.bmcii1976.workers.dev\n" — a Cloudflare Worker on
 * the RETIRED account, which answers 404 for every path including "/", with a
 * literal backslash-n appended by `vercel env pull`.
 *
 * Every call through the client therefore went to a host that does not exist:
 * 57 distinct paths across 9 pages. Nothing looked broken, because the failures
 * render as empty or perpetually-loading states rather than errors — "no data
 * yet" and "the request went to a dead server" look identical on screen.
 *
 * These tests exist so that cannot come back quietly. They assert the failure
 * modes, not the implementation.
 */

import { describe, expect, it } from 'vitest';
import { usableBase } from '../api';

describe('the specific host that was dead in production', () => {
  it('is never used, however it is configured', () => {
    expect(usableBase('https://rightathome-api.bmcii1976.workers.dev')).toBe('');
  });

  it('is rejected even with the literal backslash-n that `vercel env pull` appends', () => {
    expect(usableBase('https://rightathome-api.bmcii1976.workers.dev\\n')).toBe('');
  });

  it('rejects any worker on that retired account, not just this one', () => {
    expect(usableBase('https://anything-else.bmcii1976.workers.dev')).toBe('');
  });
});

describe('falls back to same-origin rather than a guessed host', () => {
  it('returns an empty base when nothing is configured', () => {
    // An empty baseURL means every request is relative to the page's own
    // origin, which is where this app's /api routes actually live.
    expect(usableBase(undefined)).toBe('');
    expect(usableBase('')).toBe('');
    expect(usableBase('   ')).toBe('');
  });

  it('returns an empty base for a value that is not a URL at all', () => {
    // Better to be same-origin than to send every request somewhere unparseable.
    expect(usableBase('not a url')).toBe('');
    expect(usableBase('/api')).toBe('');
  });
});

describe('a real host is still honoured', () => {
  it('accepts a normal https origin', () => {
    expect(usableBase('https://api.rah-midland.com')).toBe('https://api.rah-midland.com');
  });

  it('strips a trailing slash so paths do not double up', () => {
    // '/api/x' against 'https://h/' would produce 'https://h//api/x'.
    expect(usableBase('https://api.rah-midland.com/')).toBe('https://api.rah-midland.com');
  });

  it('cleans the escape sequence off an otherwise good value', () => {
    // This is the positive control for the \n handling: the escape must be
    // stripped, not treated as proof the value is broken. A previous probe of
    // mine 404'd against a URL that still contained it and would have "proved"
    // a live host was dead.
    expect(usableBase('https://api.rah-midland.com\\n')).toBe('https://api.rah-midland.com');
  });
});

describe('localhost', () => {
  it('is kept on the server, where it can legitimately mean this machine', () => {
    // No `window` in this environment, so this is the server-side branch.
    expect(usableBase('http://localhost:8000')).toBe('http://localhost:8000');
  });

  it('is documented as browser-hostile', () => {
    // In a browser, localhost is the USER's machine, not ours — which is what
    // the old `|| 'http://localhost:8000'` default meant for every visitor.
    // The runtime guard for that lives behind `typeof window !== 'undefined'`
    // and cannot be exercised here; this test records the intent so the
    // branch is not deleted as dead code.
    expect(usableBase('http://localhost:8000')).not.toBe('');
  });
});
