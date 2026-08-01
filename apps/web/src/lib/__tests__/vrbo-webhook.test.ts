/**
 * POST /api/webhooks/vrbo.
 *
 * This endpoint is in the middleware's PUBLIC_API_PREFIXES, so the HMAC
 * signature is the ONLY thing in front of it — and it now writes to the real
 * booking table rather than a Firestore collection nothing read. The assertions
 * worth making are therefore: nothing is written without a valid signature,
 * a redelivery cannot produce a second booking, and a cancellation still
 * revokes door access when we have no record of the reservation.
 */

import crypto from 'crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  bookingUpsert,
  bookingUpdateMany,
  guestUpsert,
  propertyFindUnique,
  queueUpsert,
  syncLogCreate,
  deliverSensitiveGuestMessage,
} = vi.hoisted(() => ({
  bookingUpsert: vi.fn(),
  bookingUpdateMany: vi.fn(),
  guestUpsert: vi.fn(),
  propertyFindUnique: vi.fn(),
  queueUpsert: vi.fn(),
  syncLogCreate: vi.fn(),
  deliverSensitiveGuestMessage: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    booking: { upsert: bookingUpsert, updateMany: bookingUpdateMany },
    guest: { upsert: guestUpsert },
    property: { findUnique: propertyFindUnique },
    accessLifecycleQueue: { upsert: queueUpsert },
    syncLog: { create: syncLogCreate },
  },
}));
vi.mock('@/lib/secure-notifications', () => ({ deliverSensitiveGuestMessage }));

import { POST } from '../../../app/api/webhooks/vrbo/route';

const SECRET = 'test-webhook-secret';

function signed(body: unknown, secret: string | null = SECRET) {
  const raw = JSON.stringify(body);
  const headers = new Map<string, string>();
  if (secret) {
    headers.set(
      'x-vrbo-signature',
      crypto.createHmac('sha256', secret).update(raw).digest('hex'),
    );
  }
  return {
    text: async () => raw,
    headers: { get: (n: string) => headers.get(n.toLowerCase()) ?? null },
  } as never;
}

function created(over: Record<string, unknown> = {}) {
  return {
    event_type: 'reservation.created',
    reservation: {
      reservationId: 'RES-1',
      propertyId: 'prop-1',
      guest: { name: 'Ada Lovelace', email: 'ada@example.com', phone: '432-555-1212' },
      checkIn: '2026-09-01',
      checkOut: '2026-09-05',
      numberOfGuests: 3,
      totalPrice: 800,
      confirmationCode: 'HA-1',
      ...over,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VRBO_WEBHOOK_SECRET = SECRET;
  propertyFindUnique.mockResolvedValue({ id: 'prop-1', name: 'Castleford Estate' });
  guestUpsert.mockResolvedValue({ id: 'guest-1' });
  bookingUpsert.mockResolvedValue({ id: 'booking-1' });
  bookingUpdateMany.mockResolvedValue({ count: 1 });
  queueUpsert.mockResolvedValue({});
  syncLogCreate.mockResolvedValue({});
  deliverSensitiveGuestMessage.mockResolvedValue({ ok: true });
});

describe('signature', () => {
  it('rejects a bad signature and writes NOTHING', async () => {
    const res = await POST(signed(created(), 'wrong-secret'));

    expect(res.status).toBe(401);
    expect(bookingUpsert).not.toHaveBeenCalled();
    expect(guestUpsert).not.toHaveBeenCalled();
    expect(queueUpsert).not.toHaveBeenCalled();
  });

  it('rejects a missing signature', async () => {
    const res = await POST(signed(created(), null));
    expect(res.status).toBe(401);
    expect(bookingUpsert).not.toHaveBeenCalled();
  });

  it('refuses to run at all when no secret is configured', async () => {
    delete process.env.VRBO_WEBHOOK_SECRET;
    delete process.env.EXPEDIA_SECRET;

    const res = await POST(signed(created(), null));

    expect(res.status).toBe(503);
    expect(bookingUpsert).not.toHaveBeenCalled();
  });
});

describe('reservation.created', () => {
  it('writes the booking to Postgres keyed for idempotency', async () => {
    const res = await POST(signed(created()));

    expect(res.status).toBe(202);
    const call = bookingUpsert.mock.calls[0][0];
    // The unique key is what stops a redelivery creating a second booking.
    expect(call.where).toEqual({
      platform_externalRef: { platform: 'VRBO', externalRef: 'RES-1' },
    });
    expect(call.create).toMatchObject({
      propertyId: 'prop-1',
      guestId: 'guest-1',
      externalRef: 'RES-1',
      platform: 'VRBO',
      guestCount: 3,
      totalPrice: 800,
      totalNights: 4,
      nightlyRate: 200, // 800 over 4 nights, not 0
      status: 'CONFIRMED',
    });
  });

  it('is idempotent: the same delivery twice targets one row', async () => {
    await POST(signed(created()));
    await POST(signed(created()));

    expect(bookingUpsert).toHaveBeenCalledTimes(2);
    const [first, second] = bookingUpsert.mock.calls.map((c) => c[0].where);
    expect(first).toEqual(second);
    // And the queue entry is keyed the same way.
    expect(queueUpsert.mock.calls[0][0].where).toEqual({
      bookingRef_action: { bookingRef: 'RES-1', action: 'PROVISION' },
    });
  });

  it('refuses a reservation with no usable dates instead of storing a stub', async () => {
    const res = await POST(signed(created({ checkIn: null, checkOut: null })));

    expect(res.status).toBe(400);
    expect(bookingUpsert).not.toHaveBeenCalled();
    expect(syncLogCreate).toHaveBeenCalled();
  });

  it('refuses an unknown property', async () => {
    propertyFindUnique.mockResolvedValue(null);

    const res = await POST(signed(created()));

    expect(res.status).toBe(400);
    expect(bookingUpsert).not.toHaveBeenCalled();
  });

  it('gives an emailless guest a deterministic unmailable placeholder', async () => {
    // Booking.guestId is required and Guest.email is unique, so one has to
    // exist. It must be stable across retries and impossible to mail.
    await POST(signed(created({ guest: { name: 'Walk In' } })));

    const where = guestUpsert.mock.calls[0][0].where;
    expect(where.email).toBe('vrbo+RES-1@no-email.invalid');

    guestUpsert.mockClear();
    await POST(signed(created({ guest: { name: 'Walk In' } })));
    expect(guestUpsert.mock.calls[0][0].where.email).toBe('vrbo+RES-1@no-email.invalid');
  });

  it('does not null out CRM detail for a guest it already knows', async () => {
    await POST(signed(created({ guest: { name: 'Ada', email: 'ada@example.com' } })));

    const update = guestUpsert.mock.calls[0][0].update;
    expect(update).not.toHaveProperty('phone'); // absent, so not overwritten with null
  });

  it('still records the booking when the confirmation message fails', async () => {
    deliverSensitiveGuestMessage.mockRejectedValue(new Error('smtp down'));

    const res = await POST(signed(created()));

    expect(res.status).toBe(202);
    expect(bookingUpsert).toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ confirmationDelivered: false });
  });
});

describe('reservation.cancelled', () => {
  it('revokes access BEFORE looking for the booking', async () => {
    await POST(
      signed({ event_type: 'reservation.cancelled', reservation: { reservationId: 'RES-1' } }),
    );

    expect(queueUpsert.mock.calls[0][0].where).toEqual({
      bookingRef_action: { bookingRef: 'RES-1', action: 'REVOKE' },
    });
  });

  it('still revokes when we hold no booking, and says so', async () => {
    // A redelivery cannot conjure a booking we never received, so 404 + retry
    // would never converge. The revocation is the part that matters.
    bookingUpdateMany.mockResolvedValue({ count: 0 });

    const res = await POST(
      signed({ event_type: 'reservation.cancelled', reservation: { reservationId: 'GHOST' } }),
    );

    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toMatchObject({ bookingKnown: false });
    expect(queueUpsert).toHaveBeenCalled();
  });
});

describe('reservation.modified', () => {
  it('applies the change and queues a reschedule', async () => {
    const res = await POST(
      signed({
        event_type: 'reservation.modified',
        reservation: {
          reservationId: 'RES-1',
          checkIn: '2026-09-02',
          checkOut: '2026-09-06',
          numberOfGuests: 2,
          totalPrice: 600,
        },
      }),
    );

    expect(res.status).toBe(202);
    expect(bookingUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { platform: 'VRBO', externalRef: 'RES-1' },
      data: expect.objectContaining({ status: 'MODIFIED', totalNights: 4, totalPrice: 600 }),
    });
    expect(queueUpsert.mock.calls[0][0].where).toEqual({
      bookingRef_action: { bookingRef: 'RES-1', action: 'RESCHEDULE' },
    });
  });

  it('404s a modification for a reservation we never received', async () => {
    bookingUpdateMany.mockResolvedValue({ count: 0 });

    const res = await POST(
      signed({ event_type: 'reservation.modified', reservation: { reservationId: 'GHOST' } }),
    );

    expect(res.status).toBe(404);
  });
});

describe('other events', () => {
  it('requires a reservation id for reservation events', async () => {
    const res = await POST(signed({ event_type: 'reservation.created', reservation: {} }));
    expect(res.status).toBe(400);
  });

  it('accepts a guest message with no reservation id', async () => {
    const res = await POST(signed({ event_type: 'guest.message' }));
    expect(res.status).toBe(202);
  });

  it('ignores an unrecognised event without writing', async () => {
    const res = await POST(
      signed({ event_type: 'something.else', reservation: { reservationId: 'RES-1' } }),
    );
    expect(res.status).toBe(200);
    expect(bookingUpsert).not.toHaveBeenCalled();
  });

  it('returns a retryable 503 when the store fails, not a 500', async () => {
    bookingUpsert.mockRejectedValue(new Error('connection refused'));

    const res = await POST(signed(created()));

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('does not let a failed audit write fail the webhook', async () => {
    syncLogCreate.mockRejectedValue(new Error('audit down'));

    const res = await POST(signed(created()));

    expect(res.status).toBe(202);
  });
});
