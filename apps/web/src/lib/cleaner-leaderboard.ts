/**
 * Cleaner leaderboard (P5 objective 2).
 *
 * WHY THIS MOSTLY REPORTS THAT IT CANNOT RANK ANYONE
 * Production holds 209 cleaning jobs, every one still SCHEDULED. Not one has
 * ever moved to IN_PROGRESS or COMPLETED, there are 0 WorkerProfile rows, and
 * 0 active ServiceSchedules. There is nothing to rank and nobody to rank.
 *
 * The page that displays this already had a Leaderboard tab as its DEFAULT
 * view, fed by an empty array that nothing ever populated — so it rendered an
 * empty podium with no explanation. An empty leaderboard reads as "nobody
 * scored well this month". The truth is that no turnover has ever been
 * completed by anyone, which is a completely different statement and the one
 * worth putting on the screen.
 *
 * So this returns `rankable: false` with the specific reason, and the numbers
 * that ARE known (jobs outstanding, how many are unassigned, how many are
 * overdue) rather than a podium.
 *
 * WHAT IT MEASURES ONCE WORK IS BEING RECORDED
 * Completions, punctuality (started by the scheduled time), turnaround against
 * the 90-minute standard, quality score, and whether the work left evidence
 * behind (checklist, photos, GPS check-in). Evidence is scored because a
 * turnover marked complete with no trace of the work is the failure mode the
 * completion gates in /api/cleaning were built to stop.
 */

import { prisma } from '@/lib/prisma';
import { TURNOVER_TARGET_MINS } from '@/lib/turnovers';

const TERMINAL = ['COMPLETED', 'CANCELLED'];

export interface CleanerScore {
  cleaner_id: string;
  cleaner_name: string | null;
  completed: number;
  /** Started at or before the scheduled time. */
  on_time: number;
  on_time_pct: number | null;
  /** Completed within TURNOVER_TARGET_MINS of starting. */
  within_target: number;
  within_target_pct: number | null;
  avg_minutes: number | null;
  /** Average of CleaningJob.score, when scored at all. */
  avg_quality: number | null;
  scored_jobs: number;
  /** Completions that left a checklist, photos, or a GPS check-in behind. */
  with_evidence: number;
  evidence_pct: number | null;
}

export interface CleanerLeaderboard {
  generated_at: string;
  period: { start: string; end: string };
  target_mins: number;
  /** False when there is nothing to rank — see `reason`. */
  rankable: boolean;
  reason: string | null;
  rows: CleanerScore[];
  /** What IS true right now, when a ranking is impossible. */
  context: {
    worker_count: number;
    active_schedule_count: number;
    jobs_total: number;
    jobs_completed: number;
    jobs_in_progress: number;
    jobs_unassigned: number;
    jobs_overdue: number;
  };
  warnings: string[];
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

/** A completion left evidence if any of the three traces exists. */
function hasEvidence(j: {
  checklistProgress: unknown;
  photos: unknown;
  checkInLat: number | null;
}): boolean {
  // During the rolling deploy this accepts both the new native JSON arrays and
  // legacy serialized JSON text. A malformed value is never evidence.
  const nonEmptyJson = (raw: unknown) => {
    if (!raw) return false;
    let value = raw;
    try {
      if (typeof value === 'string') value = JSON.parse(value);
    } catch {
      return false;
    }
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value && typeof value === 'object' && Object.keys(value).length);
  };
  return nonEmptyJson(j.checklistProgress) || nonEmptyJson(j.photos) || j.checkInLat !== null;
}

export async function cleanerLeaderboard(
  start: Date,
  end: Date,
  now = new Date(),
): Promise<CleanerLeaderboard> {
  const [completedJobs, workerCount, scheduleCount, counts] = await Promise.all([
    prisma.cleaningJob.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null, gte: start, lte: end },
        cleanerId: { not: null },
      },
      select: {
        cleanerId: true,
        scheduledAt: true,
        startedAt: true,
        completedAt: true,
        score: true,
        checklistProgress: true,
        photos: true,
        checkInLat: true,
        cleaner: { select: { name: true } },
      },
    }),
    prisma.workerProfile.count(),
    prisma.serviceSchedule.count({ where: { isActive: true } }),
    Promise.all([
      prisma.cleaningJob.count(),
      prisma.cleaningJob.count({ where: { status: 'COMPLETED' } }),
      prisma.cleaningJob.count({
        where: { startedAt: { not: null }, completedAt: null, status: { notIn: TERMINAL } },
      }),
      prisma.cleaningJob.count({ where: { cleanerId: null, status: { notIn: TERMINAL } } }),
      prisma.cleaningJob.count({
        where: { scheduledAt: { lt: now }, completedAt: null, status: { notIn: TERMINAL } },
      }),
    ]),
  ]);

  const [jobsTotal, jobsCompleted, jobsInProgress, jobsUnassigned, jobsOverdue] = counts;

  const acc = new Map<
    string,
    {
      name: string | null;
      completed: number;
      onTime: number;
      withinTarget: number;
      minutesTotal: number;
      minutesCount: number;
      scoreTotal: number;
      scored: number;
      evidence: number;
    }
  >();

  for (const j of completedJobs) {
    const id = j.cleanerId!;
    const a =
      acc.get(id) ??
      {
        name: j.cleaner?.name ?? null,
        completed: 0,
        onTime: 0,
        withinTarget: 0,
        minutesTotal: 0,
        minutesCount: 0,
        scoreTotal: 0,
        scored: 0,
        evidence: 0,
      };

    a.completed += 1;
    if (j.startedAt && j.startedAt <= j.scheduledAt) a.onTime += 1;
    if (j.startedAt && j.completedAt) {
      const mins = Math.round((j.completedAt.getTime() - j.startedAt.getTime()) / 60000);
      a.minutesTotal += mins;
      a.minutesCount += 1;
      // Boundary is inclusive here: 90 minutes exactly meets the standard.
      if (mins <= TURNOVER_TARGET_MINS) a.withinTarget += 1;
    }
    if (typeof j.score === 'number') {
      a.scoreTotal += j.score;
      a.scored += 1;
    }
    if (hasEvidence(j)) a.evidence += 1;
    acc.set(id, a);
  }

  const rows: CleanerScore[] = [...acc.entries()]
    .map(([id, a]) => ({
      cleaner_id: id,
      cleaner_name: a.name,
      completed: a.completed,
      on_time: a.onTime,
      on_time_pct: pct(a.onTime, a.completed),
      within_target: a.withinTarget,
      // Denominator is jobs with a measurable duration, not all completions —
      // a job completed without a start time has no turnaround to judge.
      within_target_pct: pct(a.withinTarget, a.minutesCount),
      avg_minutes: a.minutesCount > 0 ? Math.round(a.minutesTotal / a.minutesCount) : null,
      avg_quality: a.scored > 0 ? Math.round((a.scoreTotal / a.scored) * 10) / 10 : null,
      scored_jobs: a.scored,
      with_evidence: a.evidence,
      evidence_pct: pct(a.evidence, a.completed),
    }))
    .sort((x, y) => y.completed - x.completed || (y.avg_quality ?? 0) - (x.avg_quality ?? 0));

  // Say precisely why there is no ranking. "No completions in this period" and
  // "nobody has ever completed one" call for different responses.
  let reason: string | null = null;
  if (rows.length === 0) {
    if (workerCount === 0) {
      reason =
        'No worker records exist, so no turnover can be assigned to or completed by anyone. This is not a slow month — nobody is set up to be ranked.';
    } else if (jobsCompleted === 0) {
      reason = `No turnover has ever been completed. All ${jobsTotal} cleaning jobs are still outstanding.`;
    } else {
      reason = 'No turnovers were completed in this period, though completions exist outside it.';
    }
  }

  const warnings: string[] = [];
  if (scheduleCount === 0) {
    warnings.push('No active service schedules exist, so no new turnovers are being generated.');
  }
  if (jobsUnassigned > 0) {
    warnings.push(`${jobsUnassigned} outstanding turnover(s) have no cleaner assigned.`);
  }
  if (jobsOverdue > 0) {
    warnings.push(`${jobsOverdue} turnover(s) are past their scheduled time and not completed.`);
  }

  return {
    generated_at: now.toISOString(),
    period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
    target_mins: TURNOVER_TARGET_MINS,
    rankable: rows.length > 0,
    reason,
    rows,
    context: {
      worker_count: workerCount,
      active_schedule_count: scheduleCount,
      jobs_total: jobsTotal,
      jobs_completed: jobsCompleted,
      jobs_in_progress: jobsInProgress,
      jobs_unassigned: jobsUnassigned,
      jobs_overdue: jobsOverdue,
    },
    warnings,
  };
}
