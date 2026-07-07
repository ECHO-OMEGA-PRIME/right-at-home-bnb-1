import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateICal } from '@rightathome/shared/vrbo';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const propertyId = searchParams.get('propertyId');
  if (!propertyId) {
    return NextResponse.json(
      {
        error: 'Missing required query parameter: propertyId',
        usage: 'https://rah-midland.com/api/integrations/ical?propertyId=PROP_ID&key=SECRET',
      },
      { status: 400 }
    );
  }

  const expectedKey = process.env.ICAL_EXPORT_KEY ?? 'rah-midland-ical-2026';
  const providedKey = searchParams.get('key');

  if (!providedKey || providedKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized: invalid or missing key parameter' },
      { status: 401 }
    );
  }

  let propertyName = propertyId;
  const exportBookings: {
    id: string;
    checkIn: Date;
    checkOut: Date;
    guestName: string;
    status: 'confirmed' | 'pending' | 'cancelled';
    source: string;
  }[] = [];

  try {
    const property = await prisma.property.findFirst({
      where: { OR: [{ id: propertyId }, { vrboId: propertyId }] },
    });

    if (property) {
      propertyName = property.name;
      const bookings = await prisma.booking.findMany({
        where: {
          propertyId: property.id,
          status: { in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] },
          checkOut: { gte: new Date() },
        },
        include: { guest: { select: { name: true } } },
        orderBy: { checkIn: 'asc' },
      });

      for (const b of bookings) {
        exportBookings.push({
          id: b.id,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          guestName: b.guest.name,
          status: b.status === 'PENDING' ? 'pending' : 'confirmed',
          source: b.platform.toLowerCase(),
        });
      }
    }
  } catch {
    // DATABASE_URL unset — export empty calendar (valid iCal)
  }

  const icalContent = generateICal(propertyId, propertyName, exportBookings);
  const filename = `${propertyId}-calendar.ics`;

  return new NextResponse(icalContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}