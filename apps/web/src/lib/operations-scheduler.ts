import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { createWorkOrder, isAutoDispatchEnabled } from '@/lib/operations-service';

function parseRule(rule: string): { frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'; interval: number } {
  const parts = Object.fromEntries(
    rule
      .split(';')
      .map((part) => part.split('=').map((value) => value.trim().toUpperCase()))
      .filter((entry) => entry.length === 2),
  );
  const frequency = ['DAILY', 'WEEKLY', 'MONTHLY'].includes(parts.FREQ)
    ? (parts.FREQ as 'DAILY' | 'WEEKLY' | 'MONTHLY')
    : 'WEEKLY';
  const interval = Math.max(1, Math.min(52, Number.parseInt(parts.INTERVAL || '1', 10) || 1));
  return { frequency, interval };
}

function nextOccurrence(current: Date, recurrenceRule: string): Date {
  const next = new Date(current);
  const { frequency, interval } = parseRule(recurrenceRule);
  if (frequency === 'DAILY') next.setUTCDate(next.getUTCDate() + interval);
  if (frequency === 'WEEKLY') next.setUTCDate(next.getUTCDate() + interval * 7);
  if (frequency === 'MONTHLY') next.setUTCMonth(next.getUTCMonth() + interval);
  return next;
}

export async function materializeDueServiceSchedules(now = new Date()) {
  const schedules = await prisma.serviceSchedule.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
    include: { property: true, worker: true },
    orderBy: { nextRunAt: 'asc' },
    take: 250,
  });

  const results: Array<{ scheduleId: string; workOrderId?: string; ok: boolean; error?: string }> = [];
  for (const schedule of schedules) {
    try {
      const autoDispatch = schedule.workerId ? false : await isAutoDispatchEnabled(schedule.propertyId);
      const start = schedule.nextRunAt || now;
      const workOrder = await createWorkOrder({
        propertyId: schedule.propertyId,
        assignedWorkerId: schedule.workerId,
        serviceType: schedule.serviceType,
        source: 'SERVICE_SCHEDULE',
        dispatchMode: autoDispatch ? 'AUTO' : 'MANUAL',
        priority: 55,
        title: `${schedule.serviceType.toLowerCase()} service: ${schedule.property.name}`,
        description: schedule.notes,
        scheduledStart: start,
        dueAt: new Date(start.getTime() + (schedule.durationMins || 120) * 60_000),
      });
      await prisma.serviceSchedule.update({
        where: { id: schedule.id },
        data: { nextRunAt: nextOccurrence(start, schedule.recurrenceRule) },
      });
      results.push({ scheduleId: schedule.id, workOrderId: workOrder.id, ok: true });
    } catch (error) {
      results.push({
        scheduleId: schedule.id,
        ok: false,
        error: error instanceof Error ? error.message : 'Schedule materialization failed',
      });
    }
  }
  return { checkedAt: now.toISOString(), results };
}

export function weeklyPeriod(weekEnding: Date) {
  const end = new Date(weekEnding);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

export async function previewFridayPay(weekEnding: Date) {
  const { start, end } = weeklyPeriod(weekEnding);
  const entries = await prisma.workerPayEntry.findMany({
    where: {
      status: 'EARNED',
      earnedAt: { gte: start, lte: end },
      payrollBatchId: null,
      // Job-based entries only. WorkerPayEntry.workOrderId became optional so a
      // salaried pay-period entry can exist; those belong to a payroll run, not
      // to this per-job Friday preview.
      workOrderId: { not: null },
    },
    include: {
      worker: { include: { user: { select: { name: true, email: true, phone: true } } } },
      workOrder: { include: { property: { select: { name: true } } } },
    },
    orderBy: [{ workerId: 'asc' }, { earnedAt: 'asc' }],
  });

  const workerMap = new Map<string, any>();
  for (const entry of entries) {
    const worker = entry.worker;
    const current = workerMap.get(worker.id) || {
      workerId: worker.id,
      workerName: worker.user.name,
      workerType: worker.workerType,
      employmentClass: worker.employmentClass,
      preferredPaymentMethod: worker.paymentMethod,
      jobCount: 0,
      amountCents: 0,
      jobs: [],
    };
    current.jobCount += 1;
    current.amountCents += entry.amountCents;
    current.jobs.push({
      payEntryId: entry.id,
      workOrderId: entry.workOrderId,
      propertyName: entry.workOrder?.property.name ?? null,
      serviceType: entry.workOrder?.serviceType ?? null,
      amountCents: entry.amountCents,
      earnedAt: entry.earnedAt,
    });
    workerMap.set(worker.id, current);
  }

  const workers = [...workerMap.values()];
  return {
    periodStart: start,
    weekEnding: end,
    workerCount: workers.length,
    jobCount: entries.length,
    totalCents: workers.reduce((sum, worker) => sum + worker.amountCents, 0),
    workers,
  };
}

export async function createFridayPayrollBatch(weekEnding: Date) {
  const preview = await previewFridayPay(weekEnding);
  if (preview.jobCount === 0) throw new Error('No earned work-order pay is available for this week');

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollBatch.create({
      data: {
        weekEnding: preview.weekEnding,
        status: 'DRAFT',
        totalCents: preview.totalCents,
      },
    });
    const ids = preview.workers.flatMap((worker: any) => worker.jobs.map((job: any) => job.payEntryId));
    await tx.workerPayEntry.updateMany({
      where: { id: { in: ids }, status: 'EARNED', payrollBatchId: null },
      data: { payrollBatchId: created.id },
    });
    return created;
  });

  return { batch, preview };
}

export async function approveAndQueueFridayPayments(input: {
  batchId: string;
  approvedByUserId?: string | null;
  confirmation: string;
}) {
  if (input.confirmation !== 'FRIDAY_PAYROLL_APPROVED') {
    throw new Error('Explicit payroll approval is required');
  }

  const batch = await prisma.payrollBatch.findUnique({
    where: { id: input.batchId },
    include: {
      entries: {
        include: {
          worker: { include: { user: true } },
          workOrder: { include: { property: true } },
        },
      },
    },
  });
  if (!batch) throw new Error('Payroll batch not found');
  if (batch.status !== 'DRAFT') throw new Error(`Payroll batch is already ${batch.status}`);

  const grouped = new Map<string, typeof batch.entries>();
  for (const entry of batch.entries) {
    const current = grouped.get(entry.workerId) || [];
    current.push(entry);
    grouped.set(entry.workerId, current);
  }

  const actions = await prisma.$transaction(async (tx) => {
    await tx.payrollBatch.update({
      where: { id: batch.id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
    await tx.workerPayEntry.updateMany({
      where: { payrollBatchId: batch.id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });

    const created = [];
    for (const [workerId, entries] of grouped) {
      const worker = entries[0].worker;
      const amountCents = entries.reduce((sum, entry) => sum + entry.amountCents, 0);
      created.push(
        await tx.conciergeAction.create({
          data: {
            requestedByUserId: input.approvedByUserId || null,
            approvedByUserId: input.approvedByUserId || null,
            actorType: 'OWNER',
            actionType: 'SEND_PAYMENT',
            targetType: 'WORKER',
            targetId: workerId,
            riskLevel: 'CRITICAL',
            requiresApproval: true,
            approvalStatus: 'APPROVED',
            status: 'QUEUED',
            idempotencyKey: `payroll-${batch.id}-${workerId}-${crypto.randomUUID()}`,
            inputJson: JSON.stringify({
              payrollBatchId: batch.id,
              workerId,
              workerName: worker.user.name,
              amountCents,
              paymentMethod: worker.paymentMethod,
              payEntryIds: entries.map((entry) => entry.id),
            }),
            approvedAt: new Date(),
          },
        }),
      );
    }
    return created;
  });

  return { batchId: batch.id, paymentActions: actions };
}
