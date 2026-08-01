/**
 * Tests for Twilio webhook signature verification.
 *
 * The dangerous failure here is NOT "forged request accepted" -- it is
 * "genuine request rejected", which silently breaks every inbound phone call
 * for a live business. So the positive case is tested first and with a
 * signature computed independently, using Twilio's documented algorithm
 * (HMAC-SHA1 over url + params sorted by key, base64), rather than by calling
 * the same helper the implementation uses.
 */

import { createHmac } from 'node:crypto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { isValidTwilioRequest, __testing__ } from '../twilio-webhook';

const AUTH_TOKEN = 'test_auth_token_abc123';
const HOST = 'rah-midland.com';
const PATH = '/api/calls/incoming';

/** Twilio's documented signing algorithm, implemented independently here. */
function sign(url: string, params: Record<string, string>, token = AUTH_TOKEN): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');
}

function makeRequest(
  params: Record<string, string>,
  opts: { signature?: string; path?: string; headers?: Record<string, string> } = {},
) {
  const path = opts.path ?? PATH;
  const body = new URLSearchParams(params);
  const headers = new Map<string, string>([
    ['x-forwarded-proto', 'https'],
    ['x-forwarded-host', HOST],
    ['host', HOST],
    ...Object.entries(opts.headers ?? {}),
  ]);
  if (opts.signature !== undefined) headers.set('x-twilio-signature', opts.signature);

  const req = {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    nextUrl: { pathname: path, search: '', host: HOST },
    clone: () => ({ formData: async () => body }),
  };
  return req as unknown as import('next/server').NextRequest;
}

const CALL = { CallSid: 'CA123', From: '+14325551234', To: '+14325555678', AccountSid: 'AC1' };

beforeEach(() => {
  vi.stubEnv('TWILIO_AUTH_TOKEN', AUTH_TOKEN);
  vi.stubEnv('TWILIO_WEBHOOK_BASE_URL', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isValidTwilioRequest - genuine requests must be accepted', () => {
  it('accepts a correctly signed Twilio webhook', async () => {
    const sig = sign(`https://${HOST}${PATH}`, CALL);
    await expect(isValidTwilioRequest(makeRequest(CALL, { signature: sig }))).resolves.toBe(true);
  });

  it('accepts regardless of param insertion order (signing sorts keys)', async () => {
    const sig = sign(`https://${HOST}${PATH}`, CALL);
    const reordered = { To: CALL.To, AccountSid: CALL.AccountSid, From: CALL.From, CallSid: CALL.CallSid };
    await expect(
      isValidTwilioRequest(makeRequest(reordered, { signature: sig })),
    ).resolves.toBe(true);
  });

  it('honours TWILIO_WEBHOOK_BASE_URL when the public host differs', async () => {
    vi.stubEnv('TWILIO_WEBHOOK_BASE_URL', 'https://www.rah-midland.com');
    const sig = sign(`https://www.rah-midland.com${PATH}`, CALL);
    await expect(isValidTwilioRequest(makeRequest(CALL, { signature: sig }))).resolves.toBe(true);
  });
});

describe('isValidTwilioRequest - forgeries must be rejected', () => {
  it('rejects a missing signature', async () => {
    await expect(isValidTwilioRequest(makeRequest(CALL))).resolves.toBe(false);
  });

  it('rejects a garbage signature', async () => {
    await expect(
      isValidTwilioRequest(makeRequest(CALL, { signature: 'not-a-signature' })),
    ).resolves.toBe(false);
  });

  it('rejects a signature made with the wrong auth token', async () => {
    const sig = sign(`https://${HOST}${PATH}`, CALL, 'attacker_token');
    await expect(isValidTwilioRequest(makeRequest(CALL, { signature: sig }))).resolves.toBe(false);
  });

  it('rejects when a param is tampered with after signing', async () => {
    const sig = sign(`https://${HOST}${PATH}`, CALL);
    const tampered = { ...CALL, From: '+19999999999' };
    await expect(
      isValidTwilioRequest(makeRequest(tampered, { signature: sig })),
    ).resolves.toBe(false);
  });

  it('rejects a signature valid for a DIFFERENT path (replay to another endpoint)', async () => {
    const sig = sign(`https://${HOST}/api/calls/status`, CALL);
    await expect(
      isValidTwilioRequest(makeRequest(CALL, { signature: sig, path: PATH })),
    ).resolves.toBe(false);
  });

  it('fails CLOSED when TWILIO_AUTH_TOKEN is unset', async () => {
    vi.stubEnv('TWILIO_AUTH_TOKEN', '');
    const sig = sign(`https://${HOST}${PATH}`, CALL);
    await expect(isValidTwilioRequest(makeRequest(CALL, { signature: sig }))).resolves.toBe(false);
  });
});

describe('webhookUrl reconstruction', () => {
  it('prefers x-forwarded-host over host (Vercel proxies the request)', () => {
    const req = makeRequest(CALL, { headers: { host: 'internal.vercel.internal' } });
    expect(__testing__.webhookUrl(req)).toBe(`https://${HOST}${PATH}`);
  });
});
