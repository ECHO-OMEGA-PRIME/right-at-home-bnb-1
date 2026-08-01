/**
 * business-context, now on Postgres.
 *
 * This object feeds two things that matter: the monitors that decide whether to
 * phone a human, and the summary Steven reads aloud. So the behaviour worth
 * pinning is what happens when a section CANNOT be read — it must not come back
 * looking like a quiet day with nothing to report.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const { queryRaw, bookingFindMany, cleaningJobFindMany, propertyFindMany, listOpenAlerts } =
  vi.hoisted(() => ({
    queryRaw: vi.fn(),
    bookingFindMany: vi.fn(),
    cleaningJobFindMany: vi.fn(),
    propertyFindMany: vi.fn(),
    listOpenAlerts: vi.fn(),
  }));

vi.mock('../prisma', () => ({
  default: {
    $queryRaw: queryRaw,
    booking: { findMany: bookingFindMany },
    cleaningJob: { findMany: cleaningJobFindMany },
    property: { findMany: propertyFindMany },
  },
}));
vi.mock('../operational-alerts', () => ({ listOpenAlerts }));

import {
  getActiveAlerts,
  getActiveUsers,
  getBusinessContext,
  getCleanerSchedules,
  getPropertyStatuses,
  getSystemHealth,
  getTodayCheckIns,
} from '../business-context';

function at(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * 3600_000);
}

beforeEach(() => {
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  bookingFindMany.mockResolvedValue([]);
  cleaningJobFindMany.mockResolvedValue([]);
  propertyFindMany.mockResolvedValue([]);
  listOpenAlerts.mockResolvedValue([]);
  process.env.TWILIO_ACCOUNT_SID = 'sid';
  process.env.TWILIO_AUTH_TOKEN = 'token';
});

describe('getSystemHealth', () => {
  it('probes Postgres, not Firestore', async () => {
    const health = await getSystemHealth();

    expect(queryRaw).toHaveBeenCalled();
    expect(health.status).toBe('healthy');
    expect(health.services.database).toBe(true);
  });

  it('is CRITICAL when the system of record is unreachable', async () => {
    // No "maybe it just isn't configured" reading any more -- that ambiguity
    // was the whole problem with probing Firestore.
    queryRaw.mockRejectedValue(new Error('connection refused'));

    const health = await getSystemHealth();

    expect(health.status).toBe('critical');
    expect(health.services.database).toBe(false);
    expect(health.recentErrors[0].type).toBe('database');
  });

  it('degrades, never pages, for missing Twilio credentials', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    const health = await getSystemHealth();
    expect(health.status).toBe('degraded');
  });
});

describe('getActiveUsers', () => {
  it('reports nobody rather than inventing presence', async () => {
    // Postgres has no lastActive column; `updatedAt` changes when an admin
    // edits a role, not when somebody signs in. Reporting those as "online"
    // would put a fabricated number into a spoken summary.
    await expect(getActiveUsers()).resolves.toEqual([]);
  });
});

describe('getTodayCheckIns', () => {
  it('reads bookings for today and excludes cancellations', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: 'b1',
        checkIn: at(2),
        checkOut: at(50),
        guestCount: 3,
        status: 'CONFIRMED',
        specialReqs: 'late arrival',
        guest: { name: 'Ada', email: 'ada@example.com', phone: '432' },
        property: { id: 'p1', name: 'Castleford' },
      },
    ]);

    const checkIns = await getTodayCheckIns();

    expect(bookingFindMany.mock.calls[0][0].where.status).toEqual({ not: 'CANCELLED' });
    expect(checkIns[0]).toMatchObject({
      id: 'b1',
      guestName: 'Ada',
      propertyName: 'Castleford',
      numGuests: 3,
      status: 'confirmed',
      notes: 'late arrival',
    });
  });
});

describe('getCleanerSchedules', () => {
  it('marks an unstarted overdue job late, with hours', async () => {
    cleaningJobFindMany.mockResolvedValue([
      {
        id: 'j1',
        scheduledAt: at(-3),
        startedAt: null,
        completedAt: null,
        status: 'SCHEDULED',
        cleanerId: 'c1',
        cleaner: { name: 'Sam', phone: '555' },
        property: { id: 'p1', name: 'Castleford' },
      },
    ]);

    const [job] = await getCleanerSchedules();

    expect(job.status).toBe('late');
    expect(job.hoursLate).toBe(3);
  });

  it('does not call a job late once it has started', async () => {
    cleaningJobFindMany.mockResolvedValue([
      {
        id: 'j1',
        scheduledAt: at(-3),
        startedAt: at(-2),
        completedAt: null,
        status: 'IN_PROGRESS',
        cleanerId: 'c1',
        cleaner: { name: 'Sam', phone: '555' },
        property: { id: 'p1', name: 'Castleford' },
      },
    ]);

    const [job] = await getCleanerSchedules();

    expect(job.status).toBe('in_progress');
    expect(job.hoursLate).toBeUndefined();
  });
});

describe('getPropertyStatuses', () => {
  it('derives the current guest and next arrival from real bookings', async () => {
    const inHouseOut = at(24);
    const nextArrival = at(48);
    const lastClean = at(-72);

    propertyFindMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Castleford',
        address: '1 Main',
        status: 'OCCUPIED',
        bookings: [
          { checkIn: at(-24), checkOut: inHouseOut, guest: { name: 'Ada' } },
          { checkIn: nextArrival, checkOut: at(96), guest: { name: 'Grace' } },
        ],
        cleaningJobs: [{ completedAt: lastClean }],
      },
    ]);

    const [property] = await getPropertyStatuses();

    // The in-house stay supplies the guest and the departure; the later one
    // supplies the next arrival. Getting these crossed is the easy mistake.
    expect(property.currentGuest).toBe('Ada');
    expect(property.nextCheckOut).toBe(inHouseOut.toISOString());
    expect(property.nextCheckIn).toBe(nextArrival.toISOString());
    expect(property.lastCleaned).toBe(lastClean.toISOString());
    expect(property.status).toBe('occupied');
  });
});

describe('getActiveAlerts', () => {
  it('reads the one alert table the monitors write', async () => {
    listOpenAlerts.mockResolvedValue([
      {
        id: 'a1',
        alertType: 'LATE_CLEANER',
        severity: 'HIGH',
        status: 'OPEN',
        message: 'Sam is late',
        propertyId: 'p1',
        createdAt: new Date(),
        metadata: { propertyName: 'Castleford' },
      },
    ]);

    const [alert] = await getActiveAlerts();

    expect(alert).toMatchObject({
      type: 'cleaner_late',
      priority: 'high',
      acknowledged: false,
      propertyName: 'Castleford',
    });
  });
});

describe('getBusinessContext degradation', () => {
  it('does not let one unreadable section look like a quiet day', async () => {
    // A failed read of today's check-ins is indistinguishable from a day with
    // no arrivals unless the failure is stated.
    bookingFindMany.mockRejectedValue(new Error('store down'));

    const context = await getBusinessContext();

    expect(context.systemHealth.status).not.toBe('healthy');
    const types = context.systemHealth.recentErrors.map((e) => e.type);
    expect(types).toContain('today_check_ins');
    expect(context.todayCheckIns).toEqual([]);
  });

  it('still returns a usable context when only one section fails', async () => {
    listOpenAlerts.mockRejectedValue(new Error('alerts down'));
    cleaningJobFindMany.mockResolvedValue([]);

    const context = await getBusinessContext();

    expect(context.summary).toBeDefined();
    expect(context.systemHealth.recentErrors.some((e) => e.type === 'alerts')).toBe(true);
  });

  it('reports healthy with no errors when everything answers', async () => {
    const context = await getBusinessContext();

    expect(context.systemHealth.status).toBe('healthy');
    expect(context.systemHealth.recentErrors).toEqual([]);
  });
});
