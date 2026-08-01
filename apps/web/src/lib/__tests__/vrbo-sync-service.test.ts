/**
 * The VRBO importer, exercised through the real syncPropertyIcal against a
 * stubbed iCal feed and a mocked Prisma.
 *
 * Every assertion here corresponds to a defect that was live in production on
 * 2026-08-01, measured against the production database:
 *
 *  - 762 VRBO bookings, externalRef populated on 0 of them, so the
 *    @@unique([platform, externalRef]) index deduplicated nothing (Postgres does
 *    not conflict NULLs).
 *  - Guests matched by first name: one "Jacqueline" row carried 25 separate
 *    stays by different people, sharing one synthesized mailbox that door codes
 *    and guest messaging were addressed to.
 *  - Owner holds imported as CONFIRMED reservations with fabricated guests --
 *    0 of 494 Guest rows ever reached the old "blocked-" placeholder branch,
 *    while holds as long as 213 nights sat in the calendar as confirmed stays.
 *  - `vrbo-${uid.slice(0, 8)}` collided on a UNIQUE column and threw
 *    "Unique constraint failed on the fields: (email)", aborting that import.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted above the imports, so the spies they close over
// have to be created in a hoisted block too -- declaring them as plain consts
// throws "Cannot access 'x' before initialization" at collection time.
const {
  bookingFindFirst,
  bookingCreate,
  bookingUpdate,
  guestUpsert,
  guestFindFirst,
  guestCreate,
  propertyFindFirst,
  vrboSyncUpsert,
  syncLogCreate,
} = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  bookingCreate: vi.fn(),
  bookingUpdate: vi.fn(),
  guestUpsert: vi.fn(),
  guestFindFirst: vi.fn(),
  guestCreate: vi.fn(),
  propertyFindFirst: vi.fn(),
  vrboSyncUpsert: vi.fn(),
  syncLogCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    property: { findFirst: propertyFindFirst },
    booking: { findFirst: bookingFindFirst, create: bookingCreate, update: bookingUpdate },
    guest: { upsert: guestUpsert, findFirst: guestFindFirst, create: guestCreate },
    vrboSync: { upsert: vrboSyncUpsert },
    syncLog: { create: syncLogCreate },
  },
}));

vi.mock('../integrations/booking-automations', () => ({
  runNewBookingAutomations: vi.fn(async () => ({ ok: true })),
  runModifiedBookingAutomations: vi.fn(async () => ({ ok: true })),
  runCancelledBookingAutomations: vi.fn(async () => ({ ok: true })),
}));

import { runNewBookingAutomations } from '../integrations/booking-automations';
import { syncPropertyIcal } from '../integrations/vrbo-sync-service';

const PROPERTY = {
  id: 'prop-castleford',
  name: 'Castleford Estate',
  vrboId: '5103283',
  nightlyRate: 200,
  cleaningFee: 75,
};

function ical(...events: Array<{ uid: string; summary: string; start: string; end: string }>) {
  const body = events
    .map(
      (e) =>
        `BEGIN:VEVENT\r\nUID:${e.uid}\r\nSUMMARY:${e.summary}\r\nDTSTART;VALUE=DATE:${e.start}\r\nDTEND;VALUE=DATE:${e.end}\r\nEND:VEVENT`,
    )
    .join('\r\n');
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`;
}

function feed(text: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => text })),
  );
}

/** The single write the importer made for a booking, whichever branch it took. */
function bookingWrite() {
  if (bookingCreate.mock.calls.length) return bookingCreate.mock.calls[0][0].data;
  return bookingUpdate.mock.calls[0][0].data;
}

beforeEach(() => {
  vi.clearAllMocks();
  propertyFindFirst.mockResolvedValue(PROPERTY);
  bookingFindFirst.mockResolvedValue(null);
  bookingCreate.mockImplementation(async () => ({ id: 'booking-new' }));
  bookingUpdate.mockResolvedValue({ id: 'booking-existing' });
  guestUpsert.mockImplementation(async (args: any) => ({
    id: `guest-${args.where.email}`,
    email: args.where.email,
    name: args.create?.name,
  }));
  vrboSyncUpsert.mockResolvedValue({});
  syncLogCreate.mockResolvedValue({});
});

describe('VRBO importer — externalRef', () => {
  it('stamps externalRef with the iCal UID on a new booking, so the unique index can act', async () => {
    feed(ical({ uid: 'uid-alpha-0001', summary: 'Reserved - Dana', start: '20260910', end: '20260914' }));

    await syncPropertyIcal(PROPERTY.id, PROPERTY.vrboId, 'https://vrbo.test/a.ics');

    expect(bookingCreate).toHaveBeenCalledTimes(1);
    expect(bookingWrite().externalRef).toBe('uid-alpha-0001');
  });

  it('backfills externalRef onto a legacy row that has NULL, even when nothing else changed', async () => {
    // The pre-fix importer wrote the UID into confirmCode and left externalRef
    // NULL. Such a row is found by the fallback probe with identical dates, so
    // without the backfill pass it would be skipped forever and the index would
    // stay inert for all 762 existing rows.
    feed(ical({ uid: 'uid-legacy-77', summary: 'Reserved - Dana', start: '20260910', end: '20260914' }));
    bookingFindFirst
      .mockResolvedValueOnce(null) // no match on externalRef
      .mockResolvedValueOnce({
        id: 'legacy-row',
        externalRef: null,
        status: 'CONFIRMED',
        checkIn: new Date(2026, 8, 10),
        checkOut: new Date(2026, 8, 14),
      });

    await syncPropertyIcal(PROPERTY.id, PROPERTY.vrboId, 'https://vrbo.test/a.ics');

    expect(bookingCreate).not.toHaveBeenCalled();
    expect(bookingUpdate).toHaveBeenCalledTimes(1);
    expect(bookingWrite().externalRef).toBe('uid-legacy-77');
  });

  it('matches an existing booking by externalRef before falling back to confirmCode', async () => {
    feed(ical({ uid: 'uid-alpha-0001', summary: 'Reserved - Dana', start: '20260910', end: '20260914' }));
    bookingFindFirst.mockResolvedValueOnce({
      id: 'already-here',
      externalRef: 'uid-alpha-0001',
      status: 'CONFIRMED',
      checkIn: new Date(2026, 8, 10),
      checkOut: new Date(2026, 8, 14),
    });

    const result = await syncPropertyIcal(PROPERTY.id, PROPERTY.vrboId, 'https://vrbo.test/a.ics');

    expect(bookingFindFirst.mock.calls[0][0].where).toMatchObject({
      platform: 'VRBO',
      externalRef: 'uid-alpha-0001',
    });
    expect(bookingCreate).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1); // nothing to do: same dates, ref already set
  });
});

describe('VRBO importer — guest identity', () => {
  it('keys the guest on the reservation id, so two guests sharing a first name stay separate', async () => {
    feed(
      ical(
        { uid: 'uid-jacq-A', summary: 'Reserved - Jacqueline', start: '20260901', end: '20260905' },
        { uid: 'uid-jacq-B', summary: 'Reserved - Jacqueline', start: '20261001', end: '20261005' },
      ),
    );

    await syncPropertyIcal(PROPERTY.id, PROPERTY.vrboId, 'https://vrbo.test/a.ics');

    const emails = guestUpsert.mock.calls.map((c) => c[0].where.email);
    expect(new Set(emails).size).toBe(2);
    expect(emails).toEqual(['vrbo-uid-jacq-A@rah-midland.com', 'vrbo-uid-jacq-B@rah-midland.com']);
    // and never by name -- the query that merged 25 strangers
    expect(guestFindFirst).not.toHaveBeenCalled();
  });

  it('does not truncate the key, so UIDs sharing a prefix cannot collide on the unique email', async () => {
    feed(
      ical(
        { uid: '78f1c9b9-aaaa-4000-8000-000000000001', summary: 'Reserved - Ann', start: '20260901', end: '20260903' },
        { uid: '78f1c9b9-bbbb-4000-8000-000000000002', summary: 'Reserved - Bob', start: '20261001', end: '20261003' },
      ),
    );

    await syncPropertyIcal(PROPERTY.id, PROPERTY.vrboId, 'https://vrbo.test/a.ics');

    const emails = guestUpsert.mock.calls.map((c) => c[0].where.email);
    expect(new Set(emails).size).toBe(2); // slice(0, 8) made these one address, and it threw
  });

  it('upserts rather than creates, so a re-sync of the same reservation is idempotent', async () => {
    feed(ical({ uid: 'uid-alpha-0001', summary: 'Reserved - Dana', start: '20260910', end: '20260914' }));

    await syncPropertyIcal(PROPERTY.id, PROPERTY.vrboId, 'https://vrbo.test/a.ics');

    expect(guestUpsert).toHaveBeenCalledTimes(1);
    expect(guestCreate).not.toHaveBeenCalled();
  });
});

describe('VRBO importer — owner holds', () => {
  const holds = ['Blocked', 'Not available', 'Unavailable', 'Owner stay', 'Maintenance', 'Do not book'];

  it.each(holds)('imports %s as BLOCKED, not as a confirmed reservation', async (summary) => {
    feed(ical({ uid: `uid-hold-${summary}`, summary, start: '20260601', end: '20261231' }));

    await syncPropertyIcal(PROPERTY.id, PROPERTY.vrboId, 'https://vrbo.test/a.ics');

    expect(bookingWrite().status).toBe('BLOCKED');
  });

  it('gives a hold one house guest per property instead of fabricating a person', async () => {
    feed(ical({ uid: 'uid-hold-1', summary: 'Blocked', start: '20260601', end: '20261231' }));

    await syncPropertyIcal(PROPERTY.id, PROPERTY.vrboId, 'https://vrbo.test/a.ics');

    expect(guestUpsert.mock.calls[0][0].where.email).toBe(`owner-hold-${PROPERTY.id}@rah-midland.com`);
  });

  it('never fires guest automations for a hold — there is nobody to welcome', async () => {
    feed(ical({ uid: 'uid-hold-1', summary: 'Blocked', start: '20260601', end: '20261231' }));

    await syncPropertyIcal(PROPERTY.id, PROPERTY.vrboId, 'https://vrbo.test/a.ics');

    expect(runNewBookingAutomations).not.toHaveBeenCalled();
  });

  it('reclassifies a hold that the old importer already stored as CONFIRMED', async () => {
    // This is the 2026-06-29 -> 2026-08-29 row that overlaps four real stays.
    // Deleting it would create a double booking; relabelling it does not, because
    // availability excludes only CANCELLED and DECLINED.
    feed(ical({ uid: 'uid-hold-legacy', summary: 'Blocked', start: '20260629', end: '20260829' }));
    bookingFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'mislabelled',
      externalRef: 'uid-hold-legacy',
      status: 'CONFIRMED',
      checkIn: new Date(2026, 5, 29),
      checkOut: new Date(2026, 7, 29),
    });

    await syncPropertyIcal(PROPERTY.id, PROPERTY.vrboId, 'https://vrbo.test/a.ics');

    expect(bookingUpdate).toHaveBeenCalledTimes(1);
    expect(bookingWrite().status).toBe('BLOCKED');
  });

  it('POSITIVE CONTROL: a real reservation is still CONFIRMED and still fires automations', async () => {
    // Without this, "everything is BLOCKED" would look like a fix and would be an
    // outage -- no welcome mail, no door code, for every genuine guest.
    feed(ical({ uid: 'uid-real-1', summary: 'Reserved - Dana', start: '20260910', end: '20260914' }));

    await syncPropertyIcal(PROPERTY.id, PROPERTY.vrboId, 'https://vrbo.test/a.ics');

    const data = bookingWrite();
    expect(data.status).toBe('CONFIRMED');
    expect(data.externalRef).toBe('uid-real-1');
    expect(runNewBookingAutomations).toHaveBeenCalledTimes(1);
  });
});
