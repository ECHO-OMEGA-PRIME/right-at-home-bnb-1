import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOwnerActor, requireWorkerActor, canManageAllWorkOrders } from '@/lib/operations-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['UNASSIGNED', 'ASSIGNED', 'CANCELLED'],
  UNASSIGNED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'IN_PROGRESS', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function serialize(task: any) {
  const total = task.checklistItems.length;
  const completed = task.checklistItems.filter((item: any) => item.completed).length;
  return {
    task: {
      id: task.id,
      property_id: task.propertyId,
      property_name: task.property.name,
      booking_id: task.bookingId,
      type: task.serviceType.toLowerCase(),
      status: task.status.toLowerCase(),
      priority: task.priority,
      title: task.title,
      description: task.description,
      assigned_to: task.assignedWorkerId,
      assigned_name: task.assignedWorker?.user?.name || null,
      scheduled_at: task.scheduledStart,
      due_at: task.dueAt,
      timer_seconds: task.timerSeconds,
      pay_amount_cents: task.payAmountCents,
      checklist: task.checklistItems.map((item: any) => ({
        id: item.id,
        item: item.label,
        completed: item.completed,
        requires_photo: item.requiresPhoto,
        photo_uploaded: Boolean(item.evidencePhotoUrl),
      })),
      report_summary: task.reportSummary,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
    },
    checklist_progress: {
      completed,
      total,
      percent: total ? Math.round((completed / total) * 100) : 0,
    },
  };
}

async function getVisibleWorkOrder(request: NextRequest, id: string) {
  const auth = await requireWorkerActor(request);
  if (auth.error) return { auth, task: null };
  const where: any = { id };
  if (!canManageAllWorkOrders(auth.user!.role)) where.assignedWorkerId = auth.workerProfile!.id;
  const task = await prisma.workOrder.findFirst({
    where,
    include: {
      property: { select: { name: true } },
      assignedWorker: { include: { user: { select: { name: true } } } },
      checklistItems: { orderBy: { sortOrder: 'asc' } },
    },
  });
  return { auth, task };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { auth, task } = await getVisibleWorkOrder(request, params.id);
  if (auth.error) return auth.error;
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json(serialize(task));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireOwnerActor(request);
  if (auth.error) return auth.error;
  const current = await prisma.workOrder.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const body = await request.json();
  const data: any = {};
  if (body.status !== undefined) {
    const nextStatus = String(body.status).toUpperCase();
    if (!STATUS_TRANSITIONS[current.status]?.includes(nextStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from ${current.status} to ${nextStatus}` },
        { status: 400 },
      );
    }
    data.status = nextStatus;
  }
  if (body.assigned_to !== undefined || body.assignedWorkerId !== undefined) {
    const workerId = body.assignedWorkerId ?? body.assigned_to ?? null;
    data.assignedWorkerId = workerId;
    if (workerId && ['PENDING', 'UNASSIGNED'].includes(current.status) && !data.status) data.status = 'ASSIGNED';
  }
  if (body.priority !== undefined) data.priority = Number(body.priority);
  if (body.title !== undefined) data.title = String(body.title);
  if (body.description !== undefined) data.description = body.description || null;
  if (body.scheduledStart !== undefined) data.scheduledStart = body.scheduledStart ? new Date(body.scheduledStart) : null;
  if (body.dueAt !== undefined) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;

  await prisma.workOrder.update({ where: { id: current.id }, data });
  const updated = await prisma.workOrder.findUnique({
    where: { id: current.id },
    include: {
      property: { select: { name: true } },
      assignedWorker: { include: { user: { select: { name: true } } } },
      checklistItems: { orderBy: { sortOrder: 'asc' } },
    },
  });
  return NextResponse.json(serialize(updated));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireOwnerActor(request);
  if (auth.error) return auth.error;
  const current = await prisma.workOrder.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (current.status === 'COMPLETED') {
    return NextResponse.json({ error: 'Completed tasks cannot be cancelled' }, { status: 400 });
  }
  const task = await prisma.workOrder.update({
    where: { id: current.id },
    data: { status: 'CANCELLED' },
  });
  return NextResponse.json({ success: true, task });
}
