/**
 * Turnover operations view (P2 objective 3).
 *
 * The existing /api/operations/dashboard covers work orders, bookings, alerts
 * and lock health but contains ZERO CleaningJob queries — turnovers, the thing
 * the business actually runs on, were absent from the operations picture.
 *
 * WHAT THIS DELIBERATELY SURFACES RATHER THAN SMOOTHS OVER
 * Production currently holds 209 cleaning jobs, ALL of them status SCHEDULED.
 * None has ever moved to IN_PROGRESS or COMPLETED, and 162 are already past
 * their scheduled time. There are also 0 worker records, so nobody could have
 * completed them.
 *
 * A dashboard that quietly showed "0 completed" next to a healthy-looking
 * upcoming count would read as a calm morning. This one reports the late count,
 * the unassigned count, and whether any workers or schedules exist at all,
 * because "nothing is happening" and "nothing can happen" look identical
 * otherwise.
 */

import { prisma } from '@/lib/prisma';
import { type PropertyScope, isUnrestricted, scopedWhere } from '@/lib/tenant-scope';

/**
 * The turnover standard: 90 minutes from start to completion.
 *
 * Nothing in this codebase measured overrun before. cleaner-monitor.ts tracks
 * hoursLate, which is lateness to START (scheduled vs now) — a different signal
 * entirely. A cleaner who arrives on time and is still working three hours later
 * was invisible.
 */
export const TURNOVER_TARGET_MINS = 90;

/** Statuses that mean the job is finished, one way or another. */
const TERMINAL = ['COMPLETED', 'CANCELLED'];

export interface TurnoverBuckets {
  upcoming: number;
  active: number;
  late: number;
  blocked: number;
  completed: number;
}

function jobShape(j: {
  id: string;
  propertyId: string;
  cleanerId: string | null;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  status: string;
  jobType: string;
  property?: { name: string } | null;
  cleaner?: { name: string } | null;
}) {
  return {
    id: j.id,
    property_id: j.propertyId,
    property_name: j.property?.name ?? null,
    cleaner_id: j.cleanerId,
    cleaner_name: j.cleaner?.name ?? null,
    job_type: j.jobType,
    status: j.status,
    scheduled_at: j.scheduledAt.toISOString(),
    started_at: j.startedAt ? j.startedAt.toISOString() : null,
    completed_at: j.completedAt ? j.completedAt.toISOString() : null,
    // Stated per row so a client does not have to re-derive the rule.
    is_late: !j.completedAt && !TERMINAL.includes(j.status) && j.scheduledAt < new Date(),
    is_unassigned: j.cleanerId === null,
    // Minutes elapsed for a job still running, so an overrun is visible WHILE it
    // is happening rather than only in the duration recorded at completion.
    running_mins: j.startedAt && !j.completedAt
      ? Math.round((Date.now() - j.startedAt.getTime()) / 60000)
      : null,
    is_over_target: Boolean(
      j.startedAt &&
        !j.completedAt &&
        Date.now() - j.startedAt.getTime() > TURNOVER_TARGET_MINS * 60000,
    ),
  };
}

const INCLUDE = {
  property: { select: { name: true } },
  cleaner: { select: { name: true } },
} as const;

/**
 * The five states P2-3 names, plus the context needed to read them honestly.
 *
 * `blocked` means the job cannot proceed as it stands: no cleaner is assigned.
 * That is kept separate from `late` on purpose — a late job with a cleaner is a
 * delay, a late job with nobody assigned is a job that was never going to
 * happen, and they need different responses.
 */
export async function turnoverBoard(scope: PropertyScope, now = new Date()) {
  const where = (extra: Record<string, unknown>) => scopedWhere(extra, scope);

  const [upcoming, active, late, blocked, completed, overTarget, unassignedTotal, workers, schedules] =
    await Promise.all([
      prisma.cleaningJob.count({
        where: where({ scheduledAt: { gt: now }, status: { notIn: TERMINAL } }),
      }),
      prisma.cleaningJob.count({
        where: where({ startedAt: { not: null }, completedAt: null, status: { notIn: TERMINAL } }),
      }),
      prisma.cleaningJob.count({
        where: where({ scheduledAt: { lt: now }, completedAt: null, status: { notIn: TERMINAL } }),
      }),
      prisma.cleaningJob.count({
        where: where({ cleanerId: null, completedAt: null, status: { notIn: TERMINAL } }),
      }),
      prisma.cleaningJob.count({ where: where({ status: 'COMPLETED' }) }),

      // Started, unfinished, and already past the 90-minute standard.
      prisma.cleaningJob.count({
        where: where({
          startedAt: { lt: new Date(now.getTime() - TURNOVER_TARGET_MINS * 60000) },
          completedAt: null,
          status: { notIn: TERMINAL },
        }),
      }),

      prisma.cleaningJob.count({ where: where({ cleanerId: null }) }),
      // Not scoped: whether ANY worker or schedule exists is a property of the
      // business, not of the caller, and it is the difference between "quiet"
      // and "not wired up".
      prisma.workerProfile.count(),
      prisma.serviceSchedule.count({ where: { isActive: true } }),
    ]);

  const [nextUp, lateJobs] = await Promise.all([
    prisma.cleaningJob.findMany({
      where: where({ scheduledAt: { gt: now }, status: { notIn: TERMINAL } }),
      include: INCLUDE,
      orderBy: { scheduledAt: 'asc' },
      take: 25,
    }),
    prisma.cleaningJob.findMany({
      where: where({ scheduledAt: { lt: now }, completedAt: null, status: { notIn: TERMINAL } }),
      include: INCLUDE,
      orderBy: { scheduledAt: 'asc' }, // oldest overdue first — worst first
      take: 25,
    }),
  ]);

  const buckets: TurnoverBuckets = { upcoming, active, late, blocked, completed };

  // Say the quiet part. A reader seeing 0 completed needs to know whether that
  // means "a calm day" or "this was never operable".
  const warnings: string[] = [];
  if (workers === 0) {
    warnings.push(
      'No worker records exist, so no turnover can be assigned or completed by anyone.',
    );
  }
  if (schedules === 0) {
    warnings.push(
      'No active service schedules exist, so no future turnovers are being generated.',
    );
  }
  if (overTarget > 0) {
    warnings.push(
      `${overTarget} turnover(s) have been running longer than ${TURNOVER_TARGET_MINS} minutes.`,
    );
  }
  if (late > 0) {
    warnings.push(`${late} turnover(s) are past their scheduled time and not completed.`);
  }

  return {
    generated_at: now.toISOString(),
    scope: isUnrestricted(scope) ? 'all_properties' : 'assigned_properties',
    buckets,
    over_target_count: overTarget,
    turnover_target_mins: TURNOVER_TARGET_MINS,
    unassigned_total: unassignedTotal,
    worker_count: workers,
    active_schedule_count: schedules,
    warnings,
    upcoming: nextUp.map(jobShape),
    late: lateJobs.map(jobShape),
  };
}
