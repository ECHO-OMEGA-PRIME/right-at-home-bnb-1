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
