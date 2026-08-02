import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireOneOfRoles, getDashboardStats, propertyScopeFor } = vi.hoisted(() => ({
  requireOneOfRoles: vi.fn(),
  getDashboardStats: vi.fn(),
  propertyScopeFor: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({ requireOneOfRoles }));
vi.mock('@/lib/dashboard-stats', () => ({ getDashboardStats }));
vi.mock('@/lib/tenant-scope', () => ({
  propertyScopeFor,
  isUnrestricted: (scope: string[] | null) => scope === null,
  scopeAllows: (scope: string[] | null, id: string) => scope === null || scope.includes(id),
}));

import { GET } from '../../../app/api/dashboard/stats/route';

function request(query = '') {
  return { nextUrl: { searchParams: new URLSearchParams(query) } } as never;
}

const worker = {
  uid: 'worker-uid',
  email: 'worker@example.test',
  emailVerified: true,
  role: 'worker',
  workerType: 'cleaner',
  isDevMode: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireOneOfRoles.mockResolvedValue({ user: worker, error: null });
  propertyScopeFor.mockResolvedValue(['property-a']);
  getDashboardStats.mockResolvedValue({
    period: 'current_month',
    generated_at: '2026-08-02T00:00:00.000Z',
    active_bookings: 1,
    pending_tasks: 2,
    task_summary: { pending: 2 },
    total_bookings_this_month: 3,
    total_nights_this_month: 4,
    revenue_this_month_cents: 999,
    recent_bookings: [{ guest_name: 'must not leak' }],
  });
});

describe('GET /api/dashboard/stats tenant scope', () => {
  it.each([401, 401])('propagates an authentication rejection (%s)', async (status) => {
    requireOneOfRoles.mockResolvedValue({ user: null, error: new Response(null, { status }) });

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(getDashboardStats).not.toHaveBeenCalled();
  });

  it('passes the assignment scope into aggregation and strips money/PII', async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getDashboardStats).toHaveBeenCalledWith('current_month', ['property-a']);
    expect(body.property_ids_in_scope).toEqual(['property-a']);
    expect(body).not.toHaveProperty('revenue_this_month_cents');
    expect(body).not.toHaveProperty('recent_bookings');
  });

  it('returns 403 before querying when a worker requests a foreign property', async () => {
    const response = await GET(request('propertyId=property-b'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'PROPERTY_FORBIDDEN' });
    expect(getDashboardStats).not.toHaveBeenCalled();
  });

  it('narrows an allowed explicit property to that property only', async () => {
    const response = await GET(request('propertyId=property-a'));

    expect(response.status).toBe(200);
    expect(getDashboardStats).toHaveBeenCalledWith('current_month', ['property-a']);
  });

  it('keeps an empty worker scope empty instead of widening', async () => {
    propertyScopeFor.mockResolvedValue([]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(getDashboardStats).toHaveBeenCalledWith('current_month', []);
    await expect(response.json()).resolves.toMatchObject({
      property_count_in_scope: 0,
      property_ids_in_scope: [],
    });
  });
});
