/**
 * deleteCode must refuse to report success for a code the lock still holds.
 *
 * The defect this guards (queue #26917) spans two components, each defensible
 * alone. rah-api's `/locks/clear-code` answers HTTP 200 with `ok: true` and
 * `revoked: true` while its OWN body reports `still_on_lock: true` — "revoked"
 * there describes a database row, not a door. The web app's rahFetch throws only
 * on `!res.ok || ok === false`, so the call returned normally, the try block in
 * revokeGuestAccess() completed, and the grant was written REVOKED while the
 * code was still programmed on the lock.
 *
 * The failure mode is a departed guest who can still open the door, with every
 * surface in the app reporting that they cannot.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// tuya-client reads RAH_API_TOKEN into a module-scope const, so it has to exist
// before the import is evaluated. vi.hoisted runs ahead of the hoisted imports;
// setting it in beforeEach is too late and every call throws
// "RAH_API_TOKEN not configured" instead of exercising the code under test.
vi.hoisted(() => {
  process.env.RAH_API_TOKEN = 'test-token';
  process.env.RAH_API_BASE = 'https://rah-api.test';
});

import { deleteCode } from '../integrations/tuya-client';

const DEVICE = 'eb51f7fbcf98b9d955wqb9';
const PASSWORD_ID = '1131464813';

/** A 200 response from the proxy, shaped exactly as rah-api returns it. */
function proxyResponds(body: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => body,
      text: async () => JSON.stringify(body),
    })),
  );
}

function proxySequence(...bodies: Array<Record<string, unknown>>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const body = bodies.shift() ?? {};
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => body,
        text: async () => JSON.stringify(body),
      };
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deleteCode — a code still on the lock is not a successful revocation', () => {
  it('throws when the proxy reports still_on_lock, despite ok:true and revoked:true', async () => {
    // This is the exact body observed in production on 2026-07-30.
    proxyResponds({
      ok: true,
      revoked: true,
      gone_from_lock: false,
      still_on_lock: true,
      device_phase: 3,
      verification: 'pending_on_device',
      password_id: PASSWORD_ID,
      device_id: DEVICE,
    });

    await expect(deleteCode(DEVICE, PASSWORD_ID)).rejects.toThrow(/still_on_lock=true/);
  });

  it('surfaces the verification state in the error, so the reason is legible', async () => {
    proxyResponds({ ok: true, revoked: true, still_on_lock: true, verification: 'still_on_device' });

    await expect(deleteCode(DEVICE, PASSWORD_ID)).rejects.toThrow(/verification=still_on_device/);
  });

  it.each(['unknown_phase', 'unverified', 'pending_on_device'])(
    'refuses to confirm removal for the unproven state %s',
    async (verification) => {
      proxyResponds({ ok: true, revoked: true, still_on_lock: true, verification });

      await expect(deleteCode(DEVICE, PASSWORD_ID)).rejects.toThrow();
    },
  );

  it('POSITIVE CONTROL: a confirmed removal resolves and returns the payload', async () => {
    // Without this, a change that threw unconditionally would look like a fix
    // and would break every legitimate revocation — every grant would land on
    // REVOCATION_FAILED and no code would ever be cleanly retired.
    proxySequence(
      {
        ok: true,
        revoked: true,
        gone_from_lock: true,
        still_on_lock: false,
        device_phase: 0,
        verification: 'confirmed_deleted',
        password_id: PASSWORD_ID,
      },
      { ok: true, codes: [] },
    );

    const result = await deleteCode(DEVICE, PASSWORD_ID);

    expect(result.verification).toBe('confirmed_deleted');
    expect(result.still_on_lock).toBe(false);
  });

  it('POSITIVE CONTROL: confirmed_absent also resolves', async () => {
    proxySequence(
      { ok: true, revoked: true, still_on_lock: false, verification: 'confirmed_absent' },
      { ok: true, codes: [] },
    );

    await expect(deleteCode(DEVICE, PASSWORD_ID)).resolves.toBeTruthy();
  });

  it('fails closed when the reconciled codes payload is missing', async () => {
    proxySequence({ ok: true, revoked: true }, { ok: true });

    await expect(deleteCode(DEVICE, PASSWORD_ID)).rejects.toThrow(/invalid codes payload/);
  });
});
