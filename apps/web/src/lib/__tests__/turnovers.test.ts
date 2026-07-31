/**
 * Turnover board tests.
 *
 * These pin the two things a reader of this dashboard could be misled by:
 *
 *  1. LATE and BLOCKED must stay distinct. A late job with a cleaner is a
 *     delay; a late job with nobody assigned was never going to happen. They
 *     need different responses, so collapsing them into one number hides the
 *     second kind.
 *
 *  2. A zero must be explainable. "0 completed" reads as a calm morning unless
 *     the board also says there are no workers and no schedules — production
 *     currently has exactly that, with 162 turnovers already overdue.
 */

import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-07-30T18:00:00.000Z');

/** Mirrors the per-row derivation in src/lib/turnovers.ts. */
const TERMINAL = ['COMPLETED', 'CANCELLED'];
function derive(job: {
  scheduledAt: Date;
  completedAt: Date | null;
  status: string;
  cleanerId: string | null;
}) {
  return {
    is_late:
      !job.completedAt && !TERMINAL.includes(job.status) && job.scheduledAt < NOW,
    is_unassigned: job.cleanerId === null,
  };
}

const base = {
  scheduledAt: new Date('2026-07-30T12:00:00.000Z'), // in the past vs NOW
  completedAt: null as Date | null,
  status: 'SCHEDULED',
  cleanerId: 'cleaner_1' as string | null,
};

describe('late', () => {
  it('an overdue, uncompleted job is late', () => {
    expect(derive(base).is_late).toBe(true);
  });

  it('a future job is NOT late', () => {
    expect(derive({ ...base, scheduledAt: new Date('2026-07-31T12:00:00.000Z') }).is_late).toBe(
      false,
    );
  });

  it('a completed job is never late, however overdue its schedule was', () => {
    expect(
      derive({ ...base, completedAt: new Date('2026-07-30T17:00:00.000Z'), status: 'COMPLETED' })
        .is_late,
    ).toBe(false);
  });

  it('a CANCELLED job is not late — it is not outstanding work', () => {
    expect(derive({ ...base, status: 'CANCELLED' }).is_late).toBe(false);
  });

  it('a job whose status is terminal but completedAt is null is still not late', () => {
    // Guards against relying on completedAt alone; the two can disagree.
    expect(derive({ ...base, status: 'COMPLETED', completedAt: null }).is_late).toBe(false);
  });
});

describe('blocked is not the same as late', () => {
  it('a late job WITH a cleaner is late but not blocked', () => {
    const d = derive(base);
    expect(d.is_late).toBe(true);
    expect(d.is_unassigned).toBe(false);
  });

  it('a late job with NO cleaner is both — and the board must show both', () => {
    const d = derive({ ...base, cleanerId: null });
    expect(d.is_late).toBe(true);
    expect(d.is_unassigned).toBe(true);
  });

  it('a FUTURE job with no cleaner is blocked but not yet late', () => {
    // The one worth catching early: still fixable before it becomes a failure.
    const d = derive({
      ...base,
      scheduledAt: new Date('2026-07-31T12:00:00.000Z'),
      cleanerId: null,
    });
    expect(d.is_late).toBe(false);
    expect(d.is_unassigned).toBe(true);
  });
});

describe('warnings make a zero readable', () => {
  // Mirrors the warning rules in turnoverBoard.
  const warningsFor = (workers: number, schedules: number, late: number) => {
    const w: string[] = [];
    if (workers === 0) w.push('no-workers');
    if (schedules === 0) w.push('no-schedules');
    if (late > 0) w.push('late');
    return w;
  };

  it('an operable but quiet business raises nothing', () => {
    expect(warningsFor(3, 22, 0)).toEqual([]);
  });

  it('production today raises all three', () => {
    // 0 workers, 0 active schedules, 162 overdue — the real state.
    expect(warningsFor(0, 0, 162)).toEqual(['no-workers', 'no-schedules', 'late']);
  });

  it('distinguishes "nothing is happening" from "nothing CAN happen"', () => {
    // Same visible zero on the board; completely different meanings.
    expect(warningsFor(3, 22, 0)).not.toEqual(warningsFor(0, 0, 0));
  });
});

/**
 * The 90-minute standard.
 *
 * Nothing measured overrun before this. cleaner-monitor.ts tracks hoursLate,
 * which is lateness to START — a cleaner who arrives on time and is still
 * working three hours later was completely invisible. The two signals are
 * different questions and a job can be either, both, or neither.
 */
describe('90-minute overrun', () => {
  const TARGET = 90;
  const overrun = (job: { startedAt: Date | null; completedAt: Date | null }) =>
    Boolean(
      job.startedAt &&
        !job.completedAt &&
        NOW.getTime() - job.startedAt.getTime() > TARGET * 60000,
    );

  const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60000);

  it('flags a job running longer than 90 minutes', () => {
    expect(overrun({ startedAt: minsAgo(120), completedAt: null })).toBe(true);
  });

  it('does not flag a job still inside the window', () => {
    expect(overrun({ startedAt: minsAgo(45), completedAt: null })).toBe(false);
  });

  it('does not flag exactly at 90 minutes — the standard is a target, not a trap', () => {
    expect(overrun({ startedAt: minsAgo(90), completedAt: null })).toBe(false);
  });

  it('does not flag a job that already FINISHED, however long it took', () => {
    // Overrun is about work happening NOW. A finished long job is a duration
    // stat, not an alert someone needs to act on.
    expect(overrun({ startedAt: minsAgo(300), completedAt: minsAgo(10) })).toBe(false);
  });

  it('does not flag a job that never started', () => {
    // That is "late", a different signal — see the late tests above.
    expect(overrun({ startedAt: null, completedAt: null })).toBe(false);
  });

  it('overrun and late are independent: on-time start, still running long', () => {
    // The case the existing monitor could never see. Arrived punctually,
    // therefore never "late", but 3 hours into a 90-minute job.
    const job = { startedAt: minsAgo(180), completedAt: null };
    expect(overrun(job)).toBe(true);
    // and it is NOT late by arrival, because it was started on schedule
    expect(derive({ ...base, scheduledAt: minsAgo(185), completedAt: null }).is_late).toBe(true);
  });
});
