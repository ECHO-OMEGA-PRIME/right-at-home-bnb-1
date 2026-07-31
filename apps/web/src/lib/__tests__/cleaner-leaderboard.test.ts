/**
 * Cleaner leaderboard tests (P5-2).
 *
 * The thing worth guarding here is the EMPTY case, because that is the real
 * one: production has 209 cleaning jobs all still SCHEDULED, 0 workers, and
 * 0 active schedules. The page already defaulted to a Leaderboard tab fed by
 * an array nothing populated, so it rendered an empty podium — which reads as
 * "nobody scored well this month" when the truth is that no turnover has ever
 * been completed by anyone. Those need different responses, so they must not
 * render the same.
 */

import { describe, expect, it } from 'vitest';

const TARGET = 90;

// ── mirrors of the per-cleaner derivation in src/lib/cleaner-leaderboard.ts ──

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

function nonEmptyJson(rawValue: string | null) {
  if (!rawValue) return false;
  try {
    const v = JSON.parse(rawValue);
    return Array.isArray(v) ? v.length > 0 : Boolean(v && Object.keys(v).length);
  } catch {
    return false;
  }
}
const hasEvidence = (j: {
  checklistProgress: string | null;
  photos: string | null;
  checkInLat: number | null;
}) => nonEmptyJson(j.checklistProgress) || nonEmptyJson(j.photos) || j.checkInLat !== null;

const mins = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);

describe('an empty leaderboard must explain itself', () => {
  // Mirrors the reason rules; all three states produce zero rows.
  const reasonFor = (workers: number, completedEver: number) => {
    if (workers === 0) return 'no-workers';
    if (completedEver === 0) return 'never-completed';
    return 'none-this-period';
  };

  it('says nobody is set up, when there are no workers — production today', () => {
    expect(reasonFor(0, 0)).toBe('no-workers');
  });

  it('distinguishes "never completed one" from "none this period"', () => {
    expect(reasonFor(3, 0)).toBe('never-completed');
    expect(reasonFor(3, 40)).toBe('none-this-period');
  });

  it('a quiet month and a business that cannot operate do NOT look the same', () => {
    expect(reasonFor(3, 40)).not.toBe(reasonFor(0, 0));
  });
});

describe('punctuality is about the START', () => {
  const onTime = (scheduledAt: string, startedAt: string | null) =>
    Boolean(startedAt && new Date(startedAt) <= new Date(scheduledAt));

  it('counts a start before the scheduled time', () => {
    expect(onTime('2026-07-30T12:00:00Z', '2026-07-30T11:50:00Z')).toBe(true);
  });

  it('counts a start exactly on time', () => {
    expect(onTime('2026-07-30T12:00:00Z', '2026-07-30T12:00:00Z')).toBe(true);
  });

  it('does not count a late start', () => {
    expect(onTime('2026-07-30T12:00:00Z', '2026-07-30T12:30:00Z')).toBe(false);
  });

  it('a completion with no recorded start is not on time', () => {
    // It is also not "late" — it simply has no start to judge, and crediting it
    // would reward the job with the least evidence.
    expect(onTime('2026-07-30T12:00:00Z', null)).toBe(false);
  });
});

describe('turnaround against the 90-minute standard', () => {
  const within = (m: number) => m <= TARGET;

  it('80 minutes meets the standard', () => {
    expect(within(mins('2026-07-30T12:00:00Z', '2026-07-30T13:20:00Z'))).toBe(true);
  });

  it('exactly 90 minutes meets it — a target, not a trap', () => {
    expect(within(mins('2026-07-30T12:00:00Z', '2026-07-30T13:30:00Z'))).toBe(true);
  });

  it('91 minutes does not', () => {
    expect(within(mins('2026-07-30T12:00:00Z', '2026-07-30T13:31:00Z'))).toBe(false);
  });

  it('rates against jobs that HAVE a duration, not all completions', () => {
    // 3 completions, only 2 with a start time, 1 of those within target.
    // Dividing by 3 would report 33% and quietly punish a cleaner for a missing
    // timestamp somebody else failed to record.
    expect(pct(1, 2)).toBe(50);
    expect(pct(1, 3)).toBe(33.3);
  });
});

describe('evidence — a completion with no trace of the work', () => {
  const base = { checklistProgress: null, photos: null, checkInLat: null };

  it('counts a non-empty checklist', () => {
    expect(hasEvidence({ ...base, checklistProgress: '[{"itemId":"a","completed":true}]' })).toBe(
      true,
    );
  });

  it('counts photos', () => {
    expect(hasEvidence({ ...base, photos: '["https://x/1.jpg"]' })).toBe(true);
  });

  it('counts a GPS check-in', () => {
    expect(hasEvidence({ ...base, checkInLat: 31.997 })).toBe(true);
  });

  it('does NOT count an empty array as evidence', () => {
    expect(hasEvidence({ ...base, checklistProgress: '[]', photos: '[]' })).toBe(false);
  });

  it('does NOT count a malformed blob as evidence', () => {
    // parseJsonColumn returns [] for a bad blob elsewhere in this codebase, and
    // "evidence we cannot read" must not score the same as evidence.
    expect(hasEvidence({ ...base, checklistProgress: '{not json' })).toBe(false);
  });

  it('a completion with nothing recorded scores no evidence', () => {
    expect(hasEvidence(base)).toBe(false);
  });
});

describe('percentages', () => {
  it('returns null rather than 0 when there is nothing to divide by', () => {
    // 0% means "measured, and it was none". null means "not measured".
    expect(pct(0, 0)).toBeNull();
    expect(pct(0, 5)).toBe(0);
  });

  it('keeps one decimal place', () => {
    expect(pct(2, 3)).toBe(66.7);
  });
});

describe('ranking order', () => {
  it('ranks by completions, breaking ties on quality', () => {
    const rows = [
      { id: 'a', completed: 5, avg_quality: 4.1 },
      { id: 'b', completed: 9, avg_quality: 3.0 },
      { id: 'c', completed: 5, avg_quality: 4.8 },
    ].sort((x, y) => y.completed - x.completed || (y.avg_quality ?? 0) - (x.avg_quality ?? 0));
    expect(rows.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
});
