import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOwnerActor } from '@/lib/operations-auth';
import { normalizeWorkerType } from '@/lib/operations-policy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeSchedule(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function serialize(profile: any) {
  return {
    id: profile.id,
    user_id: profile.userId,
    name: profile.user.name,
    role: profile.workerType.toLowerCase(),
    worker_type: profile.workerType,
    employment_class: profile.employmentClass,
    phone: profile.user.phone,
    email: profile.user.email,
    status: profile.user.isActive ? 'active' : 'inactive',
    availability: profile.isAvailable ? 'available' : 'off_duty',
    dispatch_priority: profile.dispatchPriority,
    auto_dispatch_eligible: profile.autoDispatchEligible,
    max_concurrent_jobs: profile.maxConcurrentJobs,
    hourly_rate_cents: profile.hourlyRateCents,
    default_pay_type: profile.defaultPayType,
    payment_method: profile.paymentMethod,
    has_payment_destination: Boolean(profile.paymentDestinationRef),
    has_managed_lock_identity: Boolean(profile.tuyaIdentityRef),
    schedule: safeSchedule(profile.scheduleJson),
    active_task_count: profile.workOrders?.length || 0,
    current_tasks: (profile.workOrders || []).map((order: any) => ({
      id: order.id,
      type: order.serviceType.toLowerCase(),
      property_name: order.property?.name || null,
      status: order.status.toLowerCase(),
      scheduled_date: order.scheduledStart?.toISOString().slice(0, 10) || null,
    })),
    earned_unpaid_cents: profile.payEntries?.reduce((sum: number, entry: any) => sum + entry.amountCents, 0) || 0,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireOwnerActor(request);
  if (auth.error) return auth.error;
  const params = request.nextUrl.searchParams;
  const where: any = {};

  if (params.get('role')) where.workerType = normalizeWorkerType(params.get('role'));
  if (params.get('status')) where.user = { isActive: params.get('status') === 'active' };
  if (params.get('availability')) where.isAvailable = params.get('availability') === 'available';

  const profiles = await prisma.workerProfile.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, phone: true, email: true, isActive: true } },
      workOrders: {
        where: { status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
        include: { property: { select: { name: true } } },
        orderBy: { scheduledStart: 'asc' },
      },
      payEntries: { where: { status: { in: ['EARNED', 'APPROVED'] } }, select: { amountCents: true } },
    },
    orderBy: [{ workerType: 'asc' }, { dispatchPriority: 'asc' }, { createdAt: 'asc' }],
  });

  const employees = profiles.map(serialize);
  return NextResponse.json({
    employees,
    total: employees.length,
    available_count: employees.filter((employee) => employee.availability === 'available').length,
    on_task_count: employees.filter((employee) => employee.active_task_count > 0).length,
    roles: [...new Set(employees.map((employee) => employee.role))],
    source: 'persistent-worker-profiles',
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireOwnerActor(request);
  if (auth.error) return auth.error;
  const body = await request.json();

  if (!body.name || !body.email || !body.phone || !body.role) {
    return NextResponse.json({ error: 'name, email, phone, and role are required' }, { status: 400 });
  }

  const workerType = normalizeWorkerType(body.role);
  const employmentClass = String(body.employmentClass || body.employment_class || 'EMPLOYEE').toUpperCase();
  if (!['EMPLOYEE', 'INDEPENDENT_CONTRACTOR', 'VENDOR'].includes(employmentClass)) {
    return NextResponse.json(
      { error: 'employmentClass must be EMPLOYEE, INDEPENDENT_CONTRACTOR, or VENDOR' },
      { status: 400 },
    );
  }

  try {
    const profile = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          authUid: body.authUid || null,
          name: String(body.name).trim(),
          email: String(body.email).trim().toLowerCase(),
          phone: String(body.phone).trim(),
          role: 'WORKER',
          isActive: body.isActive !== false,
        },
      });
      return tx.workerProfile.create({
        data: {
          userId: user.id,
          workerType,
          employmentClass,
          dispatchPriority: Math.max(1, Math.min(999, Number(body.dispatchPriority || body.dispatch_priority || 100))),
          autoDispatchEligible: body.autoDispatchEligible !== false,
          defaultPayType: String(body.defaultPayType || body.default_pay_type || 'PER_JOB').toUpperCase(),
          hourlyRateCents: body.hourlyRateCents || body.hourly_rate_cents || null,
          paymentMethod: body.paymentMethod || body.payment_method || null,
          paymentDestinationRef: body.paymentDestinationRef || null,
          tuyaIdentityRef: body.tuyaIdentityRef || null,
          isAvailable: body.isAvailable !== false,
          maxConcurrentJobs: Math.max(1, Math.min(10, Number(body.maxConcurrentJobs || 1))),
          scheduleJson: body.schedule ? JSON.stringify(body.schedule) : null,
        },
        include: {
          user: true,
          workOrders: { where: { id: '__none__' }, include: { property: true } },
          payEntries: { where: { id: '__none__' } },
        },
      });
    });
    return NextResponse.json({ employee: serialize(profile) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create worker';
    const status = message.toLowerCase().includes('unique') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
