/**
 * Review contract-mapping tests.
 *
 * The defect these guard against is the one that shipped: two routes each held
 * their own array of "the reviews", disagreed about what REV-002 was, and a
 * response posted through one was invisible to the other. One row now feeds two
 * published shapes, so the thing worth testing is that BOTH shapes render the
 * SAME row faithfully -- and that response_status is derived rather than stored
 * alongside a timestamp it could contradict.
 */

import { describe, expect, it } from 'vitest';

import {
  NEEDS_RESPONSE_AT_OR_BELOW,
  type ReviewRow,
  toListContract,
  toRespondContract,
} from '../reviews';

const base: ReviewRow = {
  id: 'rev_1',
  propertyId: 'prop_1',
  bookingId: 'bk_1',
  guestId: 'guest_1',
  guestName: 'Sarah J.',
  platform: 'airbnb',
  rating: 4,
  comment: 'Great location near downtown.',
  response: null,
  respondedAt: null,
  categories: JSON.stringify({ cleanliness: 5, value: 4 }),
  checkIn: new Date('2025-08-10T00:00:00.000Z'),
  checkOut: new Date('2025-08-13T00:00:00.000Z'),
  status: 'published',
  createdAt: new Date('2026-03-15T09:00:00.000Z'),
  updatedAt: new Date('2026-03-15T09:00:00.000Z'),
};

describe('the two shapes describe the same review', () => {
  it('agree on identity, guest, platform and rating', () => {
    const list = toListContract(base);
    const respond = toRespondContract(base);
    expect(respond.id).toBe(list.id);
    expect(respond.guest_name).toBe(list.guest_name);
    expect(respond.platform).toBe(list.platform);
    expect(respond.rating).toBe(list.rating);
    expect(respond.property_id).toBe(list.property_id);
  });

  it('publish the review body under their own historical names', () => {
    // list calls it `comment`, respond calls it `text`. Both must be the row.
    expect(toListContract(base).comment).toBe(base.comment);
    expect(toRespondContract(base).text).toBe(base.comment);
  });

  it('publish the reply under their own historical names', () => {
    const answered: ReviewRow = {
      ...base,
      response: 'Thanks for the feedback!',
      respondedAt: new Date('2026-03-16T10:00:00.000Z'),
    };
    expect(toListContract(answered).response).toBe(answered.response);
    expect(toRespondContract(answered).response_text).toBe(answered.response);
  });
});

describe('response_status is derived, never stored', () => {
  it('is pending while there is no responded_at', () => {
    expect(toRespondContract(base).response_status).toBe('pending');
    expect(toRespondContract(base).responded_at).toBeNull();
  });

  it('is responded once responded_at is set', () => {
    const answered: ReviewRow = {
      ...base,
      response: 'Thank you!',
      respondedAt: new Date('2026-03-16T10:00:00.000Z'),
    };
    expect(toRespondContract(answered).response_status).toBe('responded');
  });

  it('cannot disagree with responded_at, because it is computed from it', () => {
    // A stored status field is what lets "responded" coexist with a null
    // timestamp. There is no way to express that contradiction here.
    const answered: ReviewRow = { ...base, respondedAt: new Date() };
    const c = toRespondContract(answered);
    expect(c.response_status === 'responded').toBe(c.responded_at !== null);
  });
});

describe('field handling', () => {
  it('parses the categories JSON blob', () => {
    expect(toListContract(base).categories).toEqual({ cleanliness: 5, value: 4 });
  });

  it('survives a malformed categories blob instead of throwing', () => {
    // A bad blob on one row must not 500 the whole list endpoint.
    const bad: ReviewRow = { ...base, categories: '{not json' };
    expect(toListContract(bad).categories).toBeNull();
  });

  it('renders stay dates as plain dates, and nulls when absent', () => {
    expect(toRespondContract(base).stay_dates).toEqual({
      check_in: '2025-08-10',
      check_out: '2025-08-13',
    });
    const undated: ReviewRow = { ...base, checkIn: null, checkOut: null };
    expect(toRespondContract(undated).stay_dates).toEqual({
      check_in: null,
      check_out: null,
    });
  });

  it('emits ISO timestamps, not Date objects', () => {
    expect(toListContract(base).created_at).toBe('2026-03-15T09:00:00.000Z');
  });
});

describe('needs-response threshold', () => {
  it('flags three stars and below', () => {
    expect(NEEDS_RESPONSE_AT_OR_BELOW).toBe(3);
    for (const rating of [1, 2, 3]) {
      expect(rating <= NEEDS_RESPONSE_AT_OR_BELOW).toBe(true);
    }
    for (const rating of [4, 5]) {
      expect(rating <= NEEDS_RESPONSE_AT_OR_BELOW).toBe(false);
    }
  });
});
