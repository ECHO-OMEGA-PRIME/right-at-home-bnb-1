/**
 * Turnover completion gates (P2-1: "without allowing silent completion gaps").
 *
 * These mirror the gates in the `complete` branch of app/api/cleaning/route.ts.
 * They exist because the original check only asked "are the photo-required
 * checklist items done?" — which passes trivially when there are no such items,
 * and passes vacuously when there is no checklist at all.
 *
 * Two failure shapes it let through:
 *
 *   NEVER STARTED — a checklist with no photo-required items completed a job
 *   whose startedAt was null. A turnover marked done that nobody ever began,
 *   with no duration and no evidence.
 *
 *   EMPTY / UNREADABLE CHECKLIST — reached the score maths as 0/0, produced
 *   NaN, and failed at the database write as an opaque 500. That is failing
 *   closed by ACCIDENT, not by design, and an accident is not a control.
 */

import { describe, expect, it } from 'vitest';

type Job = {
  startedAt: Date | null;
  checklist: Array<{ itemId: string; completed: boolean }>;
  master: Array<{ id: string; requiresPhoto: boolean }>;
};

type Result = { ok: true } | { ok: false; reason: string };

/** Mirrors the gate order in the route. Order matters — see the last test. */
function canComplete(job: Job): Result {
  if (!job.startedAt) return { ok: false, reason: 'never-started' };
  if (job.checklist.length === 0) return { ok: false, reason: 'no-checklist' };

  const incompleteRequired = job.checklist.filter((item) => {
    const original = job.master.find((m) => m.id === item.itemId);
    return original?.requiresPhoto && !item.completed;
  });
  if (incompleteRequired.length > 0) return { ok: false, reason: 'required-items-incomplete' };

  return { ok: true };
}

const STARTED = new Date('2026-07-30T12:00:00.000Z');
const master = [
  { id: 'photo-item', requiresPhoto: true },
  { id: 'plain-item', requiresPhoto: false },
];

describe('the ALLOW path', () => {
  it('completes a started job whose photo-required items are done', () => {
    expect(
      canComplete({
        startedAt: STARTED,
        checklist: [
          { itemId: 'photo-item', completed: true },
          { itemId: 'plain-item', completed: true },
        ],
        master,
      }),
    ).toEqual({ ok: true });
  });

  it('completes when an optional item is left undone', () => {
    // Only photo-required items block completion; this must stay true or the
    // gate becomes an obstacle and gets removed.
    expect(
      canComplete({
        startedAt: STARTED,
        checklist: [
          { itemId: 'photo-item', completed: true },
          { itemId: 'plain-item', completed: false },
        ],
        master,
      }),
    ).toEqual({ ok: true });
  });
});

describe('the gaps that used to let a job through', () => {
  it('refuses a job that was NEVER STARTED, even with a clean checklist', () => {
    // The original check passed this: no photo-required items outstanding.
    expect(
      canComplete({
        startedAt: null,
        checklist: [{ itemId: 'plain-item', completed: true }],
        master,
      }),
    ).toEqual({ ok: false, reason: 'never-started' });
  });

  it('refuses an EMPTY checklist instead of reaching 0/0 and NaN', () => {
    expect(canComplete({ startedAt: STARTED, checklist: [], master })).toEqual({
      ok: false,
      reason: 'no-checklist',
    });
  });

  it('refuses an UNREADABLE checklist, which arrives as an empty list', () => {
    // parseJsonColumn returns [] for a malformed blob. "No evidence" and
    // "evidence we could not read" must both block completion — the hardening
    // that stopped a bad row 500-ing the endpoint must not become a free pass.
    const fromMalformedBlob: Job['checklist'] = [];
    expect(canComplete({ startedAt: STARTED, checklist: fromMalformedBlob, master })).toEqual({
      ok: false,
      reason: 'no-checklist',
    });
  });
});

describe('the original check still holds', () => {
  it('refuses when a photo-required item is outstanding', () => {
    expect(
      canComplete({
        startedAt: STARTED,
        checklist: [{ itemId: 'photo-item', completed: false }],
        master,
      }),
    ).toEqual({ ok: false, reason: 'required-items-incomplete' });
  });
});

describe('gate ordering', () => {
  it('reports NEVER STARTED before anything else', () => {
    // A job that is unstarted AND has no checklist should say the most
    // actionable thing, not the last thing checked.
    expect(canComplete({ startedAt: null, checklist: [], master }).valueOf()).toEqual({
      ok: false,
      reason: 'never-started',
    });
  });
});
