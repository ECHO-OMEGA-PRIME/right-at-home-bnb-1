import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { resolveDatabaseUser } from '@/lib/operations-auth';
import { createGuestRequest } from '@/lib/operations-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveGuestId(email: string | null): Promise<string | null> {
  if (!email) return null;
  const guest = await prisma.guest.findUnique({ where: { email } });
  return guest?.id || null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const where: any = {};
  if (params.get('status')) where.status = params.get('status')!.toUpperCase();
  if (params.get('propertyId')) where.propertyId = params.get('propertyId');
  if (params.get('urgency')) where.urgency = params.get('urgency')!.toUpperCase();

  if (auth.user!.role === 'guest') {
    const guestId = await resolveGuestId(auth.user!.email);
    if (!guestId) return NextResponse.json({ requests: [], total: 0 });
    where.guestId = guestId;
  } else if (auth.user!.role === 'worker') {
    const dbUser = await resolveDatabaseUser(auth.user!);
    if (!dbUser?.workerProfile) {
      return NextResponse.json({ error: 'Worker profile required' }, { status: 403 });
    }
    where.assignedWorkOrder = { assignedWorkerId: dbUser.workerProfile.id };
  }

  const requests = await prisma.guestRequest.findMany({
    where,
    include: {
      property: { select: { name: true, address: true } },
      guest: { select: { name: true, email: true, phone: true } },
      booking: { select: { id: true, checkIn: true, checkOut: true, status: true } },
      assignedWorkOrder: {
        include: {
          assignedWorker: { include: { user: { select: { name: true, phone: true } } } },
        },
      },
    },
    orderBy: [{ urgency: 'desc' }, { requestedAt: 'desc' }],
    take: Math.min(Number(params.get('limit') || 100), 250),
  });

  return NextResponse.json({ requests, total: requests.length });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.bookingId || !body.category || !String(body.description || '').trim()) {
    return NextResponse.json(
      { error: 'bookingId, category, and description are required' },
      { status: 400 },
    );
  }

  let guestId: string | null = null;
  if (auth.user!.role === 'guest') {
    guestId = await resolveGuestId(auth.user!.email);
  } else if (['owner', 'admin'].includes(auth.user!.role)) {
    guestId = body.guestId || null;
    if (!guestId) {
      const booking = await prisma.booking.findUnique({
        where: { id: body.bookingId },
        select: { guestId: true },
      });
      guestId = booking?.guestId || null;
    }
  } else {
    return NextResponse.json({ error: 'Guests or owner may create guest requests' }, { status: 403 });
  }

  if (!guestId) {
    return NextResponse.json({ error: 'Guest profile could not be resolved' }, { status: 403 });
  }

  const urgency = String(body.urgency || 'NORMAL').toUpperCase();
  if (!['NORMAL', 'HIGH', 'EMERGENCY'].includes(urgency)) {
    return NextResponse.json({ error: 'urgency must be NORMAL, HIGH, or EMERGENCY' }, { status: 400 });
  }

  try {
    const result = await createGuestRequest({
      bookingId: body.bookingId,
      guestId,
      category: body.category,
      description: String(body.description).trim(),
      urgency: urgency as 'NORMAL' | 'HIGH' | 'EMERGENCY',
      sourceChannel: body.sourceChannel || 'WEB',
    });
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Guest request failed' },
      { status: 400 },
    );
  }
}
