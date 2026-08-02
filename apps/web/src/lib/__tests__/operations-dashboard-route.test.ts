import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireAuth,
  resolveDatabaseUser,
  propertyScopeFor,
  workOrderFindMany,
  payAggregate,
  scheduleFindMany,
} = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  resolveDatabaseUser: vi.fn(),
  propertyScopeFor: vi.fn(),
  workOrderFindMany: vi.fn(),
  payAggregate: vi.fn(),
  scheduleFindMany: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({ requireAuth }));
vi.mock('@/lib/operations-auth', () => ({ resolveDatabaseUser }));
vi.mock('@/lib/tenant-scope', () => ({
  propertyScopeFor,
  scopeAllows: (scope: string[] | null, id: string) => scope === null || scope.includes(id),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workOrder: { findMany: workOrderFindMany },
    workerPayEntry: { aggregate: payAggregate },
    serviceSchedule: { findMany: scheduleFindMany },
  },
}));

import { GET } from '../../../app/api/operations/dashboard/route';

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
  requireAuth.mockResolvedValue({ user: worker, error: null });
  propertyScopeFor.mockResolvedValue(['property-a']);
  resolveDatabaseUser.mockResolvedValue({
    id: 'user-1',
    name: 'QA Worker',
    workerProfile: {
      id: 'worker-1',
      workerType: 'CLEANER',
      dispatchPriority: 1,
      isAvailable: true,
    },
  });
  workOrderFindMany.mockResolvedValue([{ id: 'job-1', property: { id: 'property-a' } }]);
  payAggregate.mockResolvedValue({ _sum: { amountCents: 100 }, _count: 1 });
  scheduleFindMany.mockResolvedValue([{ id: 'schedule-1', property: { id: 'property-a' } }]);
});

describe('GET /api/operations/dashboard tenant scope', () => {
  it.each([401, 401])('propagates an authentication rejection (%s)', async (status) => {
    requireAuth.mockResolvedValue({ user: null, error: new Response(null, { status }) });

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(workOrderFindMany).not.toHaveBeenCalled();
  });

  it('returns 403 before worker data queries for a foreign property', async () => {
    const response = await GET(request('propertyId=property-b'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'PROPERTY_FORBIDDEN' });
    expect(workOrderFindMany).not.toHaveBeenCalled();
  });

  it('filters jobs, schedules, and pay to an allowed property', async () => {
    const response = await GET(request('propertyId=property-a'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(workOrderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedWorkerId: 'worker-1', propertyId: 'property-a' }),
      }),
    );
    expect(scheduleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workerId: 'worker-1', propertyId: 'property-a' }),
      }),
    );
    expect(payAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workOrder: { propertyId: 'property-a' } }),
      }),
    );
    expect(body.jobs.every((job: { property: { id: string } }) => job.property.id === 'property-a')).toBe(true);
    expect(body.schedules.every((row: { property: { id: string } }) => row.property.id === 'property-a')).toBe(true);
  });

  it('returns an explicit 403 when the linked worker profile is absent', async () => {
    resolveDatabaseUser.mockResolvedValue(null);

    const response = await GET(request('propertyId=property-a'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'WORKER_PROFILE_REQUIRED' });
  });
});
