import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.RAH_API_TOKEN = 'test-token';
  process.env.RAH_API_BASE = 'https://rah-api.test';
});

import { assertCodePresent, deleteCode } from '../integrations/tuya-client';

const DEVICE = 'test-device';
const GRANT = 'grant-123';

function response(body: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Tuya guest-code readback', () => {
  it('requires the exact grant to be present in the reconciled device view', async () => {
    const fetchMock = vi.fn(async () => response({
      ok: true,
      codes: [{ password_id: GRANT, device_view: 'present' }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(assertCodePresent(DEVICE, GRANT)).resolves.toBeUndefined();
    expect(String((fetchMock.mock.calls as unknown[][])[0][0])).toContain('reconcile=1');
  });

  it.each([
    { codes: [] },
    { codes: [{ password_id: GRANT, device_view: 'absent' }] },
    { codes: [{ password_id: 'different-grant', device_view: 'present' }] },
  ])('fails closed when the exact grant is not device-present', async ({ codes }) => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ ok: true, codes })));
    await expect(assertCodePresent(DEVICE, GRANT)).rejects.toThrow(/not verified present/);
  });

  it('rejects a malformed reconciled codes payload instead of treating it as empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ ok: true })));
    await expect(assertCodePresent(DEVICE, GRANT)).rejects.toThrow(/invalid codes payload/);
  });

  it('requires reconciled absence after a provider delete response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true, revoked: true, still_on_lock: false }))
      .mockResolvedValueOnce(response({
        ok: true,
        codes: [{ password_id: GRANT, device_view: 'present' }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteCode(DEVICE, GRANT)).rejects.toThrow(/removal was not verified/);
  });

  it('accepts deletion only after the exact grant is absent from the reconciled view', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true, revoked: true, still_on_lock: false }))
      .mockResolvedValueOnce(response({ ok: true, codes: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteCode(DEVICE, GRANT)).resolves.toMatchObject({ revoked: true });
    expect(String((fetchMock.mock.calls as unknown[][])[1][0])).toContain('reconcile=1');
  });
});
