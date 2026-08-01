/**
 * system-monitor's storage, now Postgres.
 *
 * Two behaviours are worth pinning. The Firestore version called `.add()`
 * unconditionally, so a condition that stayed broken produced a fresh alert on
 * every sweep — one every 15 minutes, indefinitely, for a single ongoing
 * outage. And its readers returned [] on failure, which renders as "every
 * system is healthy" on the screen an operator checks to find out whether
 * anything is broken.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const { settingFindUnique, settingUpsert } = vi.hoisted(() => ({
  settingFindUnique: vi.fn(),
  settingUpsert: vi.fn(),
}));

const {
  findOpenAlert,
  createAlert,
  mergeAlertMetadata,
  listOpenAlerts,
  acknowledgeAlert,
  ALERT_LOOKUP_UNKNOWN,
} = vi.hoisted(() => ({
  findOpenAlert: vi.fn(),
  createAlert: vi.fn(),
  mergeAlertMetadata: vi.fn(),
  listOpenAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
  ALERT_LOOKUP_UNKNOWN: Symbol('alert-lookup-unknown'),
}));

vi.mock('@/lib/prisma', () => ({
  default: { setting: { findUnique: settingFindUnique, upsert: settingUpsert } },
}));
vi.mock('../prisma', () => ({
  default: { setting: { findUnique: settingFindUnique, upsert: settingUpsert } },
}));
vi.mock('../operational-alerts', () => ({
  findOpenAlert,
  createAlert,
  mergeAlertMetadata,
  listOpenAlerts,
  acknowledgeAlert,
  ALERT_LOOKUP_UNKNOWN,
}));
vi.mock('../twilio', () => ({ makeCall: vi.fn(), sendSMS: vi.fn() }));
vi.mock('../business-context', () => ({ getBusinessContext: vi.fn() }));
vi.mock('../firebase-admin', () => ({
  getFirebaseAdminStatus: () => ({ configured: true, error: null }),
  isConfigurationIssue: () => false,
}));

import {
  acknowledgeSystemAlert,
  flagUpdateNeeded,
  getActiveSystemAlerts,
} from '../system-monitor';

beforeEach(() => {
  vi.clearAllMocks();
  settingFindUnique.mockResolvedValue(null);
  settingUpsert.mockResolvedValue({});
  createAlert.mockResolvedValue({ id: 'alert-1' });
  acknowledgeAlert.mockResolvedValue(true);
});

describe('getActiveSystemAlerts', () => {
  it('maps stored alerts back to the SystemAlert shape', async () => {
    listOpenAlerts.mockResolvedValue([
      {
        id: 'a1',
        status: 'OPEN',
        message: 'Twilio unreachable',
        createdAt: new Date('2026-08-01T06:00:00.000Z'),
        metadata: { type: 'service_down', severity: 'emergency', callMade: true },
      },
    ]);

    const alerts = await getActiveSystemAlerts();

    expect(listOpenAlerts).toHaveBeenCalledWith('SYSTEM');
    expect(alerts[0]).toMatchObject({
      id: 'a1',
      type: 'service_down',
      severity: 'emergency',
      callMade: true,
      acknowledged: false,
    });
  });

  it('still reports ACKNOWLEDGED alerts as active', async () => {
    // Acknowledged means somebody has SEEN it, not that it is fixed. The
    // Firestore query filtered these out, so a live problem vanished from the
    // dashboard the moment anyone clicked on it.
    listOpenAlerts.mockResolvedValue([
      {
        id: 'a1',
        status: 'ACKNOWLEDGED',
        message: 'still broken',
        createdAt: new Date(),
        metadata: { type: 'service_down', severity: 'emergency' },
      },
    ]);

    const alerts = await getActiveSystemAlerts();

    expect(alerts).toHaveLength(1);
    expect(alerts[0].acknowledged).toBe(true);
  });

  it('THROWS on a store failure rather than reporting zero alerts', async () => {
    listOpenAlerts.mockRejectedValue(new Error('store down'));
    await expect(getActiveSystemAlerts()).rejects.toThrow();
  });
});

describe('acknowledgeSystemAlert', () => {
  it('delegates to the shared store', async () => {
    await expect(acknowledgeSystemAlert('a1', 'commander')).resolves.toBe(true);
    expect(acknowledgeAlert).toHaveBeenCalledWith('a1', 'commander');
  });
});

describe('flagUpdateNeeded', () => {
  it('appends to the pending list without dropping what is there', async () => {
    settingFindUnique.mockResolvedValue({ value: '{"pendingUpdates":["first"]}' });

    await expect(flagUpdateNeeded('second')).resolves.toBe(true);

    const written = JSON.parse(settingUpsert.mock.calls[0][0].update.value);
    expect(written.pendingUpdates).toEqual(['first', 'second']);
    expect(written.flaggedAt).toBeDefined();
  });

  it('records a critical update without clobbering pending ones', async () => {
    settingFindUnique.mockResolvedValue({ value: '{"pendingUpdates":["first"]}' });

    await flagUpdateNeeded('urgent', true);

    const written = JSON.parse(settingUpsert.mock.calls[0][0].update.value);
    expect(written.criticalUpdate).toBe('urgent');
    expect(written.pendingUpdates).toEqual(['first']);
  });

  it('creates the setting row when none exists', async () => {
    settingFindUnique.mockResolvedValue(null);

    await flagUpdateNeeded('first');

    const call = settingUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ key: 'system.update_flags' });
    expect(JSON.parse(call.create.value).pendingUpdates).toEqual(['first']);
  });

  it('treats a malformed config value as empty instead of throwing', async () => {
    settingFindUnique.mockResolvedValue({ value: '{not json' });

    await expect(flagUpdateNeeded('first')).resolves.toBe(true);
    expect(JSON.parse(settingUpsert.mock.calls[0][0].update.value).pendingUpdates).toEqual([
      'first',
    ]);
  });

  it('reports false rather than throwing when the store fails', async () => {
    settingUpsert.mockRejectedValue(new Error('store down'));
    await expect(flagUpdateNeeded('first')).resolves.toBe(false);
  });
});
