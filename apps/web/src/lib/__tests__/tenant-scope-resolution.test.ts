import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  cleaningFindMany,
  scheduleFindMany,
  userFindFirst,
  workerFindUnique,
  workOrderFindMany,
} = vi.hoisted(() => ({
  cleaningFindMany: vi.fn(),
  scheduleFindMany: vi.fn(),
  userFindFirst: vi.fn(),
  workerFindUnique: vi.fn(),
  workOrderFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: userFindFirst },
    workerProfile: { findUnique: workerFindUnique },
    cleaningJob: { findMany: cleaningFindMany },
    serviceSchedule: { findMany: scheduleFindMany },
    workOrder: { findMany: workOrderFindMany },
  },
}));

import type { ApiUser } from '../api-auth';
import { propertyScopeFor } from '../tenant-scope';

function user(role: ApiUser['role'] = 'worker'): ApiUser {
  return {
    uid: 'auth-uid',
    email: 'worker@example.test',
    emailVerified: true,
    role,
    workerType: null,
    isDevMode: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  userFindFirst.mockResolvedValue({ id: 'db-user' });
  workerFindUnique.mockResolvedValue({ id: 'worker-profile' });
  cleaningFindMany.mockResolvedValue([]);
  scheduleFindMany.mockResolvedValue([]);
  workOrderFindMany.mockResolvedValue([]);
});

describe('propertyScopeFor assignment resolution', () => {
  it('does not query assignments for an owner/admin', async () => {
    await expect(propertyScopeFor(user('admin'))).resolves.toBeNull();
    expect(userFindFirst).not.toHaveBeenCalled();
  });

  it('fails closed when no active authUid binding exists', async () => {
    userFindFirst.mockResolvedValue(null);

    await expect(propertyScopeFor(user())).resolves.toEqual([]);
    expect(userFindFirst).toHaveBeenCalledWith({
      where: { authUid: 'auth-uid', isActive: true },
      select: { id: true },
    });
    expect(cleaningFindMany).not.toHaveBeenCalled();
  });

  it('unions only current cleaning, schedule, and work-order assignments', async () => {
    cleaningFindMany.mockResolvedValue([{ propertyId: 'p1' }]);
    scheduleFindMany.mockResolvedValue([{ propertyId: 'p2' }]);
    workOrderFindMany.mockResolvedValue([{ propertyId: 'p3' }, { propertyId: 'p1' }]);

    await expect(propertyScopeFor(user())).resolves.toEqual(['p1', 'p2', 'p3']);
    expect(cleaningFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cleanerId: 'db-user',
          status: { in: ['SCHEDULED', 'PENDING', 'IN_PROGRESS'] },
        },
      }),
    );
    expect(scheduleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workerId: 'worker-profile', isActive: true },
      }),
    );
    expect(workOrderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assignedWorkerId: 'worker-profile',
          status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
        },
      }),
    );
  });

  it('does not query profile-backed assignments when no worker profile exists', async () => {
    workerFindUnique.mockResolvedValue(null);
    cleaningFindMany.mockResolvedValue([{ propertyId: 'p1' }]);

    await expect(propertyScopeFor(user())).resolves.toEqual(['p1']);
    expect(scheduleFindMany).not.toHaveBeenCalled();
    expect(workOrderFindMany).not.toHaveBeenCalled();
  });
});
