import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOwnerActor, requireWorkerActor, canManageAllWorkOrders } from '@/lib/operations-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireWorkerActor(request);
  if (auth.error) return auth.error;

  const where: any = {};
  if (!canManageAllWorkOrders(auth.user!.role)) where.workerId = auth.workerProfile!.id;
  if (request.nextUrl.searchParams.get('serviceType')) {
    where.serviceType = request.nextUrl.searchParams.get('serviceType')!.toUpperCase();
  }
  if (request.nextUrl.searchParams.get('active')) {
    where.isActive = request.nextUrl.searchParams.get('active') === 'true';
  }

  const schedules = await prisma.serviceSchedule.findMany({
    where,
    include: {
      property: { select: { name: true, address: true } },
      worker: { include: { user: { select: { name: true, phone: true, email: true } } } },
    },
    orderBy: [{ nextRunAt: 'asc' }, { serviceType: 'asc' }],
  });
  return NextResponse.json({ schedules, total: schedules.length });
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

  if (!body.propertyId || !body.serviceType || !body.recurrenceRule || !body.nextRunAt) {
    return NextResponse.json(
      { error: 'propertyId, serviceType, recurrenceRule, and nextRunAt are required' },
      { status: 400 },
    );
  }
  if (!/^FREQ=(DAILY|WEEKLY|MONTHLY)(;INTERVAL=\d+)?$/i.test(body.recurrenceRule)) {
    return NextResponse.json(
      { error: 'recurrenceRule must use FREQ=DAILY|WEEKLY|MONTHLY with optional INTERVAL=n' },
      { status: 400 },
    );
  }

  const schedule = await prisma.serviceSchedule.create({
    data: {
      propertyId: body.propertyId,
      workerId: body.workerId || null,
      serviceType: String(body.serviceType).toUpperCase(),
      recurrenceRule: String(body.recurrenceRule).toUpperCase(),
      timezone: body.timezone || 'America/Chicago',
      nextRunAt: new Date(body.nextRunAt),
      durationMins: body.durationMins ? Number(body.durationMins) : null,
      isActive: body.isActive !== false,
      notes: body.notes || null,
    },
    include: {
      property: { select: { name: true, address: true } },
      worker: { include: { user: { select: { name: true } } } },
    },
  });
  return NextResponse.json({ success: true, schedule }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireOwnerActor(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const data: any = {};
  if (body.workerId !== undefined) data.workerId = body.workerId || null;
  if (body.recurrenceRule !== undefined) data.recurrenceRule = String(body.recurrenceRule).toUpperCase();
  if (body.nextRunAt !== undefined) data.nextRunAt = new Date(body.nextRunAt);
  if (body.durationMins !== undefined) data.durationMins = body.durationMins ? Number(body.durationMins) : null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.notes !== undefined) data.notes = body.notes || null;

  const schedule = await prisma.serviceSchedule.update({ where: { id: body.id }, data });
  return NextResponse.json({ success: true, schedule });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireOwnerActor(request);
  if (auth.error) return auth.error;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await prisma.serviceSchedule.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true, id, isActive: false });
}
