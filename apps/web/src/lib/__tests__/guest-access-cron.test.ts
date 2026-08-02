import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  process: vi.fn(),
}));

vi.mock('@/lib/access-orchestration', () => ({
  previewGuestAccessLifecycle: mocks.preview,
  processGuestAccessLifecycle: mocks.process,
}));

import { GET } from '../../../app/api/cron/guest-access/route';

function request(secret?: string) {
  return new NextRequest('https://rah.test/api/cron/guest-access', {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'unit-test-secret';
  delete process.env.GUEST_ACCESS_AUTOMATION_MODE;
  mocks.preview.mockResolvedValue({ provision: { eligible: 0 }, revoke: { eligibleBookings: 0 } });
  mocks.process.mockResolvedValue({ provision: [], revoke: [] });
});

describe('dedicated guest-access cron', () => {
  it.each([undefined, 'wrong-secret'])('rejects missing or wrong bearer auth without work', async (secret) => {
    const response = await GET(request(secret));

    expect(response.status).toBe(401);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it('is read-only by default', async () => {
    const response = await GET(request('unit-test-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe('observe');
    expect(mocks.preview).toHaveBeenCalledOnce();
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it('runs mutations only under the explicit active switch', async () => {
    process.env.GUEST_ACCESS_AUTOMATION_MODE = 'active';
    const response = await GET(request('unit-test-secret'));

    expect(response.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledOnce();
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it('returns non-2xx when an active run has any failed booking', async () => {
    process.env.GUEST_ACCESS_AUTOMATION_MODE = 'active';
    mocks.process.mockResolvedValue({
      provision: [{ bookingId: 'opaque-booking', ok: false, error: 'provider unavailable' }],
      revoke: [],
    });

    const response = await GET(request('unit-test-secret'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ success: false, mode: 'active', failed: 1 });
  });
});
