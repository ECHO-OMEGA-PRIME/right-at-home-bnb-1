/**
 * Right at Home BnB - Booking Conflicts API
 * GET /api/bookings/conflicts — returns overlapping bookings across platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  buildBookingConflicts,
  OCCUPYING_BOOKING_STATUSES,
} from '@/lib/booking-availability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: [...OCCUPYING_BOOKING_STATUSES] },
        checkOut: { gt: new Date() },
      },
      select: {
        id: true,
        propertyId: true,
        checkIn: true,
        checkOut: true,
        platform: true,
        status: true,
      },
      orderBy: [{ propertyId: 'asc' }, { checkIn: 'asc' }],
    });
    return NextResponse.json(buildBookingConflicts(bookings));
  } catch (error) {
    const incidentId = crypto.randomUUID();
    console.error('[bookings/conflicts] failed', { incidentId, error });
    return NextResponse.json(
      { error: 'Failed to check conflicts', code: 'CONFLICT_CHECK_UNAVAILABLE', incidentId },
      { status: 500 },
    );
  }
}
