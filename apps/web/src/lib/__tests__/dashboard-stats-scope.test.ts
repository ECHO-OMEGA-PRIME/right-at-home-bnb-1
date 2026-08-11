import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  propertyFindMany,
  bookingFindMany,
  bookingCount,
  cleaningGroupBy,
  workOrderGroupBy,
} = vi.hoisted(() => ({
  propertyFindMany: vi.fn(),
  bookingFindMany: vi.fn(),
  bookingCount: vi.fn(),
  cleaningGroupBy: vi.fn(),
  workOrderGroupBy: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    property: { findMany: propertyFindMany },
    booking: { findMany: bookingFindMany, count: bookingCount },
    cleaningJob: { groupBy: cleaningGroupBy },
    workOrder: { groupBy: workOrderGroupBy },
  },
}));

import { getDashboardStats } from '../dashboard-stats';

beforeEach(() => {
  vi.clearAllMocks();
  propertyFindMany.mockResolvedValue([]);
  bookingFindMany.mockResolvedValue([]);
  bookingCount.mockResolvedValue(0);
  cleaningGroupBy.mockResolvedValue([]);
  workOrderGroupBy.mockResolvedValue([]);
});

describe('getDashboardStats scope', () => {
  it('applies a restricted property filter to every data query', async () => {
    await getDashboardStats('current_month', ['property-a']);

    expect(propertyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['property-a'] } } }),
    );
    for (const [args] of bookingFindMany.mock.calls) {
      expect(args.where).toEqual(expect.objectContaining({ propertyId: { in: ['property-a'] } }));
    }
    expect(bookingCount.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ propertyId: { in: ['property-a'] } }),
    );
    expect(cleaningGroupBy.mock.calls[0][0].where).toEqual({ propertyId: { in: ['property-a'] } });
    expect(workOrderGroupBy.mock.calls[0][0].where).toEqual({ propertyId: { in: ['property-a'] } });
  });

  it('keeps an empty restricted scope as an explicit in:[] filter', async () => {
    await getDashboardStats('current_month', []);

    expect(propertyFindMany.mock.calls[0][0].where).toEqual({ id: { in: [] } });
    expect(bookingCount.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ propertyId: { in: [] } }),
    );
  });
});
