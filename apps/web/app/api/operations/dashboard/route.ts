import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { resolveDatabaseUser } from '@/lib/operations-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function startOfToday(): Date {
  const date = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [year, month, day] = formatter.format(date).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

async function ownerDashboard() {
  const now = new Date();
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
  const [
    activeProperties,
    upcomingCheckIns,
    upcomingCheckOuts,
    openWorkOrders,
    unassignedWorkOrders,
    openAlerts,
    earnedPay,
    activeGuestRequests,
    lockProblems,
    recentWorkOrders,
  ] = await Promise.all([
    prisma.property.count({ where: { status: 'ACTIVE' } }),
    prisma.booking.count({
      where: { status: 'CONFIRMED', checkIn: { gte: now, lte: nextSevenDays } },
    }),
    prisma.booking.count({
      where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] }, checkOut: { gte: now, lte: nextSevenDays } },
    }),
    prisma.workOrder.count({ where: { status: { in: ['PENDING', 'UNASSIGNED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } } }),
    prisma.workOrder.count({ where: { status: 'UNASSIGNED' } }),
    prisma.operationalAlert.count({ where: { status: 'OPEN' } }),
    prisma.workerPayEntry.aggregate({ where: { status: { in: ['EARNED', 'APPROVED'] } }, _sum: { amountCents: true } }),
    prisma.guestRequest.count({ where: { status: { notIn: ['RESOLVED', 'CANCELLED'] } } }),
    prisma.smartLock.count({ where: { OR: [{ isOnline: false }, { batteryLevel: { lt: 20 } }] } }),
    prisma.workOrder.findMany({
      include: {
        property: { select: { name: true } },
        assignedWorker: { include: { user: { select: { name: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    }),
  ]);

  return {
    role: 'owner',
    metrics: {
      activeProperties,
      upcomingCheckIns,
      upcomingCheckOuts,
      openWorkOrders,
      unassignedWorkOrders,
      openAlerts,
      unpaidWorkerCents: earnedPay._sum.amountCents || 0,
      activeGuestRequests,
      lockProblems,
    },
    recentWorkOrders,
  };
}

async function workerDashboard(apiUser: { uid: string; email: string | null }) {
  const dbUser = await resolveDatabaseUser({
    ...apiUser,
    role: 'worker',
    workerType: null,
    isDevMode: false,
  });
  if (!dbUser?.workerProfile) {
    throw new Error('Worker profile is not configured');
  }

  const workerId = dbUser.workerProfile.id;
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60_000);
  const [jobs, pay, schedules] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        assignedWorkerId: workerId,
        OR: [
          { status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
          { scheduledStart: { gte: today, lt: tomorrow } },
        ],
      },
      include: {
        property: { select: { name: true, address: true, latitude: true, longitude: true } },
        checklistItems: { orderBy: { sortOrder: 'asc' } },
        accessGrant: { select: { status: true, startsAt: true, endsAt: true } },
      },
      orderBy: [{ status: 'desc' }, { scheduledStart: 'asc' }],
      take: 30,
    }),
    prisma.workerPayEntry.aggregate({
      where: { workerId, status: { in: ['EARNED', 'APPROVED'] } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.serviceSchedule.findMany({
      where: { workerId, isActive: true },
      include: { property: { select: { name: true, address: true } } },
      orderBy: { nextRunAt: 'asc' },
      take: 20,
    }),
  ]);

  return {
    role: 'worker',
    worker: {
      id: workerId,
      name: dbUser.name,
      workerType: dbUser.workerProfile.workerType,
      dispatchPriority: dbUser.workerProfile.dispatchPriority,
      isAvailable: dbUser.workerProfile.isAvailable,
    },
    metrics: {
      assignedJobs: jobs.length,
      unpaidCents: pay._sum.amountCents || 0,
      unpaidJobCount: pay._count,
      recurringSchedules: schedules.length,
    },
    jobs,
    schedules,
  };
}

async function guestDashboard(email: string | null) {
  if (!email) throw new Error('Guest email is unavailable');
  const guest = await prisma.guest.findUnique({ where: { email } });
  if (!guest) {
    return {
      role: 'guest',
      guest: null,
      activeBooking: null,
      upcomingBookings: [],
      requests: [],
    };
  }

  const now = new Date();
  const [bookings, requests] = await Promise.all([
    prisma.booking.findMany({
      where: {
        guestId: guest.id,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        checkOut: { gte: now },
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
            checkInInstr: true,
            checkOutInstr: true,
            parkingInfo: true,
            wifiNetwork: true,
            wifiPassword: true,
          },
        },
        accessGrants: {
          where: { subjectType: 'GUEST', status: { in: ['PENDING', 'DELIVERED', 'ACTIVE'] } },
          select: {
            id: true,
            status: true,
            startsAt: true,
            endsAt: true,
            deliveredAt: true,
            deliveryChannel: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { checkIn: 'asc' },
    }),
    prisma.guestRequest.findMany({
      where: { guestId: guest.id },
      include: {
        property: { select: { name: true } },
        assignedWorkOrder: {
          select: {
            id: true,
            status: true,
            assignedWorker: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: 30,
    }),
  ]);

  const activeBooking =
    bookings.find((booking) => booking.checkIn <= now && booking.checkOut >= now) || null;

  const sanitizeBooking = (booking: (typeof bookings)[number], includePrivateWifi: boolean) => ({
    ...booking,
    property: {
      ...booking.property,
      wifiPassword: includePrivateWifi ? booking.property.wifiPassword : null,
    },
  });

  return {
    role: 'guest',
    guest: { id: guest.id, name: guest.name, email: guest.email, phone: guest.phone },
    activeBooking: activeBooking ? sanitizeBooking(activeBooking, true) : null,
    upcomingBookings: bookings
      .filter((booking) => booking.id !== activeBooking?.id)
      .map((booking) => sanitizeBooking(booking, false)),
    requests,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    if (auth.user!.role === 'owner' || auth.user!.role === 'admin') {
      return NextResponse.json(await ownerDashboard());
    }
    if (auth.user!.role === 'worker') {
      return NextResponse.json(await workerDashboard(auth.user!));
    }
    return NextResponse.json(await guestDashboard(auth.user!.email));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dashboard data unavailable' },
      { status: 400 },
    );
  }
}
