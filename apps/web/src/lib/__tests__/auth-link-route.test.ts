import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAuth, findFirst, findMany, findUnique, updateMany } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({ requireAuth }));
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findFirst, findMany, findUnique, updateMany } },
}));

import { POST } from '../../../app/api/auth/link/route';

const request = {} as never;

function caller(overrides: Record<string, unknown> = {}) {
  requireAuth.mockResolvedValue({
    user: {
      uid: 'canonical-uid',
      email: 'owner@example.test',
      emailVerified: true,
      role: 'guest',
      workerType: null,
      isDevMode: false,
      ...overrides,
    },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  caller();
  findFirst.mockResolvedValue(null);
  findMany.mockResolvedValue([]);
  updateMany.mockResolvedValue({ count: 0 });
  findUnique.mockResolvedValue(null);
});

describe('POST /api/auth/link', () => {
  it('accepts an exact active uid link without re-claiming by email', async () => {
    caller({ emailVerified: false });
    findFirst.mockReset();
    findFirst.mockResolvedValueOnce({ id: 'user-1' });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, linked: true });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('requires a verified email before claiming a null uid', async () => {
    caller({ emailVerified: false });
    findFirst.mockResolvedValue(null);

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toContain('rah-auth-token=');
    expect(response.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('claims an active pre-provisioned row with one compare-and-set', async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([{ id: 'user-1', authUid: null, isActive: true }]);
    updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', authUid: null, isActive: true },
      data: { authUid: 'canonical-uid' },
    });
  });

  it('never overwrites a different non-null uid', async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([{ id: 'user-1', authUid: 'other-uid', isActive: true }]);

    const response = await POST(request);

    expect(response.status).toBe(409);
    expect(response.headers.get('set-cookie')).toContain('rah-auth-token=');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('fails closed when case-insensitive lookup is ambiguous', async () => {
    findMany.mockResolvedValue([
      { id: 'user-1', authUid: null, isActive: true },
      { id: 'user-2', authUid: null, isActive: true },
    ]);

    const response = await POST(request);

    expect(response.status).toBe(409);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('does not claim an inactive row', async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([{ id: 'user-1', authUid: null, isActive: false }]);

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('loses a concurrent claim safely instead of last-writer-wins', async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([{ id: 'user-1', authUid: null, isActive: true }]);
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue({ authUid: 'other-uid' });

    const response = await POST(request);

    expect(response.status).toBe(409);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
