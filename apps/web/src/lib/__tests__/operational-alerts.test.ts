/**
 * The operational alert store, and the cleaner monitor's use of it.
 *
 * The contract under test is the one that keeps a real phone from ringing every
 * 15 minutes: a lookup may answer "none" only when it actually asked and got
 * nothing. Everything else here follows from that.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const { alertFindFirst, alertFindMany, alertFindUnique, alertCreate, alertUpdate } = vi.hoisted(
  () => ({
    alertFindFirst: vi.fn(),
    alertFindMany: vi.fn(),
    alertFindUnique: vi.fn(),
    alertCreate: vi.fn(),
    alertUpdate: vi.fn(),
  }),
);

vi.mock('@/lib/prisma', () => ({
  default: {
    operationalAlert: {
      findFirst: alertFindFirst,
      findMany: alertFindMany,
      findUnique: alertFindUnique,
      create: alertCreate,
      update: alertUpdate,
    },
  },
}));

import {
  ALERT_LOOKUP_UNKNOWN,
  createAlert,
  escalateAlert,
  findOpenAlert,
  listOpenAlerts,
  markNotified,
  mergeAlertMetadata,
  resolveAlert,
} from '../operational-alerts';

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'alert-1',
    alertType: 'LATE_CLEANER',
    severity: 'NORMAL',
    status: 'OPEN',
    title: 'late',
    message: 'is late',
    propertyId: 'prop-1',
    dedupeKey: 'cleaner-schedule:sched-1',
    metadata: '{"cleanerName":"Ada","callMade":false}',
    createdAt: new Date('2026-08-01T06:00:00.000Z'),
    notifiedAt: null,
    resolvedAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  alertCreate.mockResolvedValue(row());
  alertUpdate.mockResolvedValue(row());
  alertFindUnique.mockResolvedValue({ metadata: '{"callMade":false}' });
});

describe('findOpenAlert — the fail-closed contract', () => {
  it('returns null ONLY for a successful query that matched nothing', async () => {
    alertFindFirst.mockResolvedValue(null);
    await expect(findOpenAlert('k')).resolves.toBeNull();
  });

  it('returns UNKNOWN — never null — when the store fails', async () => {
    // Returning null here is what made the monitor re-alert every run and phone
    // a real person for the length of an outage.
    alertFindFirst.mockRejectedValue(new Error('connection refused'));
    await expect(findOpenAlert('k')).resolves.toBe(ALERT_LOOKUP_UNKNOWN);
  });

  it('only counts unresolved alerts as existing', async () => {
    alertFindFirst.mockResolvedValue(row());
    await findOpenAlert('cleaner-schedule:sched-1');

    expect(alertFindFirst.mock.calls[0][0].where).toMatchObject({
      dedupeKey: 'cleaner-schedule:sched-1',
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
    });
  });

  it('returns the most recent match', async () => {
    alertFindFirst.mockResolvedValue(row());
    const found = await findOpenAlert('k');

    expect(alertFindFirst.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
    expect(found).toMatchObject({ id: 'alert-1' });
  });

  it('degrades malformed metadata rather than throwing out of a sweep', async () => {
    alertFindFirst.mockResolvedValue(row({ metadata: '{not json' }));
    const found = await findOpenAlert('k');
    expect(found).toMatchObject({ metadata: {} });
  });
});

describe('createAlert', () => {
  it('persists the alert with its dedupe key', async () => {
    await createAlert({
      alertType: 'LATE_CLEANER',
      title: 't',
      message: 'm',
      severity: 'HIGH',
      dedupeKey: 'cleaner-schedule:sched-1',
      propertyId: 'prop-1',
      metadata: { cleanerName: 'Ada' },
    });

    expect(alertCreate.mock.calls[0][0].data).toMatchObject({
      alertType: 'LATE_CLEANER',
      severity: 'HIGH',
      status: 'OPEN',
      dedupeKey: 'cleaner-schedule:sched-1',
      propertyId: 'prop-1',
      metadata: JSON.stringify({ cleanerName: 'Ada' }),
    });
  });

  it('THROWS when the write fails instead of returning a phantom alert', async () => {
    // The Firestore version returned an unsaved object, so the caller phoned
    // somebody about an alert that existed nowhere.
    alertCreate.mockRejectedValue(new Error('store down'));
    await expect(createAlert({ alertType: 'X', title: 't', message: 'm' })).rejects.toThrow();
  });
});

describe('metadata handling', () => {
  it('merges rather than replaces', async () => {
    alertFindUnique.mockResolvedValue({ metadata: '{"cleanerName":"Ada","callMade":false}' });

    await mergeAlertMetadata('alert-1', { callMade: true, callSid: 'CA1' });

    expect(JSON.parse(alertUpdate.mock.calls[0][0].data.metadata)).toEqual({
      cleanerName: 'Ada',
      callMade: true,
      callSid: 'CA1',
    });
  });

  it('does nothing for an alert that does not exist', async () => {
    alertFindUnique.mockResolvedValue(null);
    await mergeAlertMetadata('nope', { x: 1 });
    expect(alertUpdate).not.toHaveBeenCalled();
  });

  it('escalation raises severity and keeps prior metadata', async () => {
    await escalateAlert('alert-1', 'HIGH', { alertType: 'very_late', hoursLate: 3 });

    expect(alertUpdate.mock.calls[0][0].data).toEqual({ severity: 'HIGH' });
    const merged = JSON.parse(alertUpdate.mock.calls[1][0].data.metadata);
    expect(merged).toMatchObject({ callMade: false, alertType: 'very_late', hoursLate: 3 });
    expect(merged.escalatedAt).toBeDefined();
  });

  it('markNotified stamps notifiedAt and records the call detail', async () => {
    await markNotified('alert-1', { callMade: true, callSid: 'CA1' });

    expect(alertUpdate.mock.calls[0][0].data.notifiedAt).toBeInstanceOf(Date);
    expect(JSON.parse(alertUpdate.mock.calls[1][0].data.metadata)).toMatchObject({
      callMade: true,
      callSid: 'CA1',
    });
  });
});

describe('resolveAlert', () => {
  it('resolves and records who did it', async () => {
    await expect(resolveAlert('alert-1', 'steven')).resolves.toBe(true);
    expect(alertUpdate.mock.calls[0][0].data).toMatchObject({
      status: 'RESOLVED',
      resolvedBy: 'steven',
    });
  });

  it('reports false rather than throwing when the store fails', async () => {
    alertUpdate.mockRejectedValue(new Error('store down'));
    await expect(resolveAlert('alert-1', 'steven')).resolves.toBe(false);
  });
});

describe('listOpenAlerts', () => {
  it('returns open alerts of the requested kind', async () => {
    alertFindMany.mockResolvedValue([row()]);

    const alerts = await listOpenAlerts('LATE_CLEANER');

    expect(alertFindMany.mock.calls[0][0].where).toMatchObject({
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      alertType: 'LATE_CLEANER',
    });
    expect(alerts[0].metadata).toMatchObject({ cleanerName: 'Ada' });
  });

  it('THROWS on a store failure rather than reporting "nothing is wrong"', async () => {
    // [] during an outage is indistinguishable from a quiet morning. That is
    // the most dangerous thing an alerts screen can say.
    alertFindMany.mockRejectedValue(new Error('store down'));
    await expect(listOpenAlerts('LATE_CLEANER')).rejects.toThrow();
  });
});
