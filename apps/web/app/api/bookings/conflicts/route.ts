/**
 * Right at Home BnB - Booking Conflicts API
 * GET /api/bookings/conflicts — returns overlapping bookings across platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  // For now return empty conflicts array
  // When real bookings exist, this will query Prisma for overlapping date ranges
  try {
    return NextResponse.json([]);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to check conflicts', detail: error.message },
      { status: 500 },
    );
  }
}
