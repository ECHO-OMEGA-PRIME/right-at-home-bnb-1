import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOwnerActor, requireWorkerActor, canManageAllWorkOrders } from '@/lib/operations-auth';
import { createWorkOrder } from '@/lib/operations-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireWorkerActor(request);
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const where: any = {};
  if (params.get('status')) where.status = params.get('status')!.toUpperCase();
  if (params.get('serviceType')) where.serviceType = params.get('serviceType')!.toUpperCase();
  if (params.get('propertyId')) where.propertyId = params.get('propertyId');
  if (params.get('bookingId')) where.bookingId = params.get('bookingId');

  if (!canManageAllWorkOrders(auth.user!.role)) {
    where.assignedWorkerId = auth.workerProfile!.id;
  } else if (params.get('assignedWorkerId')) {
    where.assignedWorkerId = params.get('assignedWorkerId');
  }

  const workOrders = await prisma.workOrder.findMany({
    where,
    include: {
      property: { select: { name: true, address: true } },
      assignedWorker: { include: { user: { select: { name: true, phone: true, email: true } } } },
      checklistItems: { orderBy: { sortOrder: 'asc' } },
      issues: true,
      photos: true,
      payEntry: true,
    },
    orderBy: [{ priority: 'desc' }, { scheduledStart: 'asc' }, { createdAt: 'desc' }],
    take: Math.min(Number(params.get('limit') || 100), 250),
  });

  return NextResponse.json({ workOrders, total: workOrders.length });
}

export async function POST(request: NextRequest) {
  const auth = await requireOwnerActor(request);
  if (auth.error) return auth.error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.propertyId || !body.serviceType || !body.title) {
    return NextResponse.json(
      { error: 'propertyId, serviceType, and title are required' },
      { status: 400 },
    );
  }

  const dispatchMode = String(body.dispatchMode || 'MANUAL').toUpperCase();
  if (!['AUTO', 'MANUAL'].includes(dispatchMode)) {
    return NextResponse.json({ error: 'dispatchMode must be AUTO or MANUAL' }, { status: 400 });
  }

  try {
    const workOrder = await createWorkOrder({
      propertyId: body.propertyId,
      bookingId: body.bookingId || null,
      requestedByUserId: auth.dbUser?.id || null,
      assignedWorkerId: body.assignedWorkerId || null,
      serviceType: body.serviceType,
      source: body.source || 'OWNER',
      dispatchMode: dispatchMode as 'AUTO' | 'MANUAL',
      priority: Number(body.priority || 50),
      title: body.title,
      description: body.description || null,
      scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    });
    return NextResponse.json({ success: true, workOrder }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create work order' },
      { status: 400 },
    );
  }
}
