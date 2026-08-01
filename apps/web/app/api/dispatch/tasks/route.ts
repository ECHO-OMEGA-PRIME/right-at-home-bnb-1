import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOwnerActor, requireWorkerActor, canManageAllWorkOrders } from '@/lib/operations-auth';
import { createWorkOrder } from '@/lib/operations-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function legacyPriority(value: number): string {
  if (value >= 90) return 'urgent';
  if (value >= 70) return 'high';
  if (value >= 40) return 'medium';
  return 'low';
}

function legacyTask(task: any) {
  return {
    id: task.id,
    property_id: task.propertyId,
    property_name: task.property?.name || null,
    booking_id: task.bookingId,
    type: task.serviceType.toLowerCase(),
    status: task.status.toLowerCase(),
    priority: legacyPriority(task.priority),
    title: task.title,
    description: task.description || '',
    assigned_to: task.assignedWorkerId,
    assigned_name: task.assignedWorker?.user?.name || null,
    scheduled_date: task.scheduledStart ? task.scheduledStart.toISOString().slice(0, 10) : null,
    scheduled_time: task.scheduledStart ? task.scheduledStart.toISOString().slice(11, 16) : null,
    estimated_duration_min: task.dueAt && task.scheduledStart
      ? Math.round((task.dueAt.getTime() - task.scheduledStart.getTime()) / 60_000)
      : null,
    actual_duration_min: task.timerSeconds ? Math.round(task.timerSeconds / 60) : null,
    checklist: (task.checklistItems || []).map((item: any) => ({
      id: item.id,
      item: item.label,
      completed: item.completed,
      requires_photo: item.requiresPhoto,
      photo_uploaded: Boolean(item.evidencePhotoUrl),
    })),
    notes: task.reportSummary || task.description || '',
    pay_amount_cents: task.payAmountCents,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireWorkerActor(request);
  if (auth.error) return auth.error;
  const params = request.nextUrl.searchParams;
  const where: any = {};

  if (params.get('status')) where.status = params.get('status')!.toUpperCase();
  if (params.get('type')) where.serviceType = params.get('type')!.toUpperCase();
  if (params.get('property_id')) where.propertyId = params.get('property_id');
  if (params.get('assigned_to')) where.assignedWorkerId = params.get('assigned_to');
  if (params.get('date')) {
    const start = new Date(`${params.get('date')}T00:00:00-05:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60_000);
    where.scheduledStart = { gte: start, lt: end };
  }

  if (!canManageAllWorkOrders(auth.user!.role)) {
    where.assignedWorkerId = auth.workerProfile!.id;
  }

  const workOrders = await prisma.workOrder.findMany({
    where,
    include: {
      property: { select: { name: true } },
      assignedWorker: { include: { user: { select: { name: true } } } },
      checklistItems: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: [{ priority: 'desc' }, { scheduledStart: 'asc' }, { createdAt: 'desc' }],
    take: 250,
  });

  const tasks = workOrders.map(legacyTask);
  return NextResponse.json({ tasks, total: tasks.length, source: 'persistent-work-orders' });
}

export async function POST(request: NextRequest) {
  const auth = await requireOwnerActor(request);
  if (auth.error) return auth.error;
  const body = await request.json();
  const propertyId = body.propertyId || body.property_id;
  const serviceType = body.serviceType || body.type;
  if (!propertyId || !serviceType || !body.title) {
    return NextResponse.json({ error: 'property_id, type, and title are required' }, { status: 400 });
  }

  const priorityMap: Record<string, number> = { low: 25, medium: 50, high: 75, urgent: 100 };
  const dispatchMode = String(body.dispatchMode || body.dispatch_mode || 'MANUAL').toUpperCase();
  try {
    const workOrder = await createWorkOrder({
      propertyId,
      bookingId: body.bookingId || body.booking_id || null,
      requestedByUserId: auth.dbUser?.id || null,
      assignedWorkerId: body.assignedWorkerId || body.assigned_to || null,
      serviceType,
      source: body.source || 'DISPATCH_API',
      dispatchMode: dispatchMode === 'AUTO' ? 'AUTO' : 'MANUAL',
      priority: typeof body.priority === 'number'
        ? body.priority
        : priorityMap[String(body.priority || 'medium').toLowerCase()] || 50,
      title: body.title,
      description: body.description || null,
      scheduledStart: body.scheduledStart
        ? new Date(body.scheduledStart)
        : body.scheduled_date
          ? new Date(`${body.scheduled_date}T${body.scheduled_time || '09:00'}:00-05:00`)
          : null,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    });
    const full = await prisma.workOrder.findUnique({
      where: { id: workOrder.id },
      include: {
        property: { select: { name: true } },
        assignedWorker: { include: { user: { select: { name: true } } } },
        checklistItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return NextResponse.json({ task: legacyTask(full) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 400 },
    );
  }
}
