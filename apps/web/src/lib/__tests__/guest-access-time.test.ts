import { afterEach, describe, expect, it } from 'vitest';
import {
  guestAccessCandidateDateBounds,
  guestAccessWindowForBooking,
  midlandLocalTimeToUtc,
} from '../guest-access-time';

afterEach(() => {
  delete process.env.GUEST_ACCESS_CHECKIN_LOCAL_TIME;
  delete process.env.GUEST_ACCESS_CHECKOUT_LOCAL_TIME;
});

describe('guest access business-time conversion', () => {
  it('honors CST for winter bookings', () => {
    expect(midlandLocalTimeToUtc('2026-01-15', 16, 0).toISOString()).toBe('2026-01-15T22:00:00.000Z');
    expect(midlandLocalTimeToUtc('2026-01-18', 11, 0).toISOString()).toBe('2026-01-18T17:00:00.000Z');
  });

  it('honors CDT for summer bookings', () => {
    expect(midlandLocalTimeToUtc('2026-07-15', 16, 0).toISOString()).toBe('2026-07-15T21:00:00.000Z');
    expect(midlandLocalTimeToUtc('2026-07-18', 11, 0).toISOString()).toBe('2026-07-18T16:00:00.000Z');
  });

  it('turns date-only booking columns into the configured validity window', () => {
    const window = guestAccessWindowForBooking(
      new Date('2026-07-15T00:00:00.000Z'),
      new Date('2026-07-18T00:00:00.000Z'),
      30,
      30,
    );

    expect(window.checkInAt.toISOString()).toBe('2026-07-15T21:00:00.000Z');
    expect(window.startsAt.toISOString()).toBe('2026-07-15T20:30:00.000Z');
    expect(window.checkOutAt.toISOString()).toBe('2026-07-18T16:00:00.000Z');
    expect(window.endsAt.toISOString()).toBe('2026-07-18T16:30:00.000Z');
  });

  it('queries date-only rows using Midland calendar-day bounds', () => {
    const bounds = guestAccessCandidateDateBounds(
      new Date('2026-07-16T02:00:00.000Z'),
      new Date('2026-07-16T05:00:00.000Z'),
    );

    expect(bounds.checkOutGte.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    expect(bounds.checkInLte.toISOString()).toBe('2026-07-16T00:00:00.000Z');
  });
});
