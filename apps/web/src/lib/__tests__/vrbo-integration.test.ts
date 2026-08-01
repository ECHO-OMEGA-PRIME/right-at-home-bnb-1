/**
 * VRBO channel management, now a client over /api/admin/vrbo-status.
 *
 * The assertions worth making are about the failure and derivation paths: an
 * unauthorised or broken API must not read as "nothing connected", the
 * connection badge must follow what the sync service actually did rather than a
 * stored string, and a fresh install must not display as 0% successful.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  disconnectVRBOProperty,
  getSyncLogs,
  getUpcomingVRBOBookings,
  getVRBOListings,
  getVRBOStats,
  registerVRBOProperty,
  syncFromVRBO,
} from '../vrbo-integration';

const fetchMock = vi.fn();

function statusPayload(overrides: Record<string, unknown> = {}) {
  return {
    properties: [
      {
        propertyId: 'prop-1',
        propertyName: 'Castleford Estate',
        vrboId: '123456',
        vrboUrl: 'https://www.vrbo.com/123456',
        icalUrl: 'https://www.vrbo.com/icalendar/abc.ics',
        lastIcalSync: '2026-07-31T10:00:00.000Z',
        lastScrapeSync: null,
        syncEnabled: true,
        bookingCount: 7,
        status: 'ACTIVE',
      },
    ],
    stats: {
      totalProperties: 1,
      enabledProperties: 1,
      totalVrboBookings: 7,
      upcomingVrboBookings: 3,
      last24h: { syncs: 4, successes: 3, failures: 1, imported: 9 },
    },
    recentLogs: [
      {
        syncType: 'ical_import',
        status: 'success',
        itemsCreated: 2,
        itemsUpdated: 1,
        error: null,
        durationMs: 120,
        at: '2026-07-31T10:00:00.000Z',
      },
    ],
    upcomingBookings: [
      {
        id: 'bk-1',
        propertyId: 'prop-1',
        guestName: 'Ada Lovelace',
        checkIn: '2026-08-10T16:00:00.000Z',
        checkOut: '2026-08-14T11:00:00.000Z',
        confirmCode: 'HA-9911',
        status: 'CONFIRMED',
      },
    ],
    ...overrides,
  };
}

function respondOk(payload: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reads', () => {
  it('maps VrboSync rows onto listings and sends the session cookie', async () => {
    respondOk(statusPayload());

    const listings = await getVRBOListings();

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      id: 'prop-1',
      propertyId: 'prop-1',
      vrboListingId: '123456',
      connectionStatus: 'connected',
      lastSyncBookings: 7,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/vrbo-status');
    expect(init.credentials).toBe('same-origin');
  });

  it('throws on an API failure instead of reporting an empty integration', async () => {
    // A 403 rendered as [] is how a locked-out admin sees a healthy-looking
    // page with nothing on it.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ error: 'Owner access required' }),
    });

    await expect(getVRBOListings()).rejects.toThrow(/403.*Owner access required/);
  });

  it('maps upcoming bookings and honours the limit', async () => {
    respondOk(statusPayload());

    const bookings = await getUpcomingVRBOBookings(10);

    expect(bookings[0]).toMatchObject({
      uid: 'bk-1',
      propertyId: 'prop-1',
      vrboListingId: '123456',
      source: 'vrbo',
      guestName: 'Ada Lovelace',
      confirmationCode: 'HA-9911',
      status: 'confirmed',
    });
    expect(await getUpcomingVRBOBookings(0)).toHaveLength(0);
  });

  it('reports sync logs with a direction derived from the sync type', async () => {
    respondOk(
      statusPayload({
        recentLogs: [
          {
            syncType: 'ical_export',
            status: 'partial',
            itemsCreated: 0,
            itemsUpdated: 4,
            error: 'timeout',
            durationMs: 900,
            at: '2026-07-31T11:00:00.000Z',
          },
        ],
      }),
    );

    const logs = await getSyncLogs('prop-1');

    expect(logs[0]).toMatchObject({
      propertyId: 'prop-1',
      direction: 'export',
      status: 'partial',
      bookingsExported: 4,
      errors: ['timeout'],
    });
  });
});

describe('derived connection status', () => {
  it('is disconnected when sync is disabled', async () => {
    respondOk(
      statusPayload({
        properties: [{ ...statusPayload().properties[0], syncEnabled: false }],
      }),
    );
    expect((await getVRBOListings())[0].connectionStatus).toBe('disconnected');
  });

  it('is error when the most recent sync failed', async () => {
    const base = statusPayload();
    respondOk({
      ...base,
      recentLogs: [{ ...base.recentLogs[0], status: 'failed' }],
    });
    expect((await getVRBOListings())[0].connectionStatus).toBe('error');
  });

  it('is pending when connected but never synced', async () => {
    const base = statusPayload();
    respondOk({
      ...base,
      properties: [{ ...base.properties[0], lastIcalSync: null, lastScrapeSync: null }],
      recentLogs: [],
    });
    expect((await getVRBOListings())[0].connectionStatus).toBe('pending');
  });
});

describe('getVRBOStats', () => {
  it('computes the success rate from the last 24h', async () => {
    respondOk(statusPayload());

    const stats = await getVRBOStats();

    expect(stats).toMatchObject({
      connectedListings: 1,
      totalBookings: 7,
      upcomingVRBOBookings: 3,
      syncSuccessRate: 75, // 3 of 4
    });
  });

  it('reports 100% rather than 0% when nothing has been attempted', async () => {
    // 0/0 rendered as 0% tells an owner their brand-new integration is
    // completely broken.
    const base = statusPayload();
    respondOk({
      ...base,
      stats: { ...base.stats, last24h: { syncs: 0, successes: 0, failures: 0, imported: 0 } },
    });

    expect((await getVRBOStats()).syncSuccessRate).toBe(100);
  });
});

describe('writes', () => {
  it('connects through the server rather than writing the store directly', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => statusPayload() });

    const listing = await registerVRBOProperty(
      'prop-1',
      '123456',
      'https://www.vrbo.com/icalendar/abc.ics',
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      action: 'connect',
      propertyId: 'prop-1',
      vrboListingId: '123456',
      icalUrl: 'https://www.vrbo.com/icalendar/abc.ics',
    });
    expect(listing.propertyId).toBe('prop-1');
  });

  it('reports rather than fabricates when the connection cannot be read back', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => statusPayload({ properties: [] }),
      });

    await expect(registerVRBOProperty('prop-1', '123456', 'https://x/abc.ics')).rejects.toThrow(
      /could not be read back/,
    );
  });

  it('disconnects with an explicit false, never a toggle', async () => {
    // A toggle would silently RE-ENABLE a connection that was already off.
    respondOk({ ok: true });

    await disconnectVRBOProperty('prop-1');

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      action: 'set_sync',
      propertyId: 'prop-1',
      enabled: false,
    });
  });

  it('returns a failed result rather than throwing out of a sync', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ error: 'ical unreachable' }),
    });

    await expect(syncFromVRBO('prop-1')).resolves.toMatchObject({
      success: false,
      bookingsImported: 0,
    });
  });
});
