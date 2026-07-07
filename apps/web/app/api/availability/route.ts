/**
 * GET /api/availability — Public availability check (smoke-test alias).
 * Params: property_id (or propertyId), check_in, check_out
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function datesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const propertyId =
      params.get('property_id') ?? params.get('propertyId');
    const checkIn = params.get('check_in') ?? params.get('checkIn');
    const checkOut = params.get('check_out') ?? params.get('checkOut');

    if (!propertyId || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'Missing required params: property_id, check_in, check_out' },
        { status: 400 }
      );
    }

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);

    if (outDate <= inDate) {
      return NextResponse.json(
        { error: 'check_out must be after check_in' },
        { status: 400 }
      );
    }

    const activeStatuses = ['CONFIRMED', 'PENDING', 'CHECKED_IN'];

    let conflicts: { booking_id: string; check_in: string; check_out: string; status: string; platform: string }[] = [];

    try {
      const bookings = await prisma.booking.findMany({
        where: {
          propertyId,
          status: { in: activeStatuses },
          checkIn: { lt: outDate },
          checkOut: { gt: inDate },
        },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          status: true,
          platform: true,
        },
      });

      conflicts = bookings.map((b) => ({
        booking_id: b.id,
        check_in: b.checkIn.toISOString().slice(0, 10),
        check_out: b.checkOut.toISOString().slice(0, 10),
        status: b.status,
        platform: b.platform,
      }));
    } catch {
      // No DB — report available with warning
      return NextResponse.json({
        available: true,
        property_id: propertyId,
        requested: { check_in: checkIn, check_out: checkOut },
        conflicts: [],
        warning: 'Database unavailable — availability not verified',
      });
    }

    return NextResponse.json({
      available: conflicts.length === 0,
      property_id: propertyId,
      requested: { check_in: checkIn, check_out: checkOut },
      conflicts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Availability check failed', detail: message }, { status: 500 });
  }
}