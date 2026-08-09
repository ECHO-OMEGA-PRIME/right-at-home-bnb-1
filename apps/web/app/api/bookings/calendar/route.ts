/**
 * Unified owner calendar backed by the imported database mirror.
 *
 * The five-minute VRBO sync owns external retrieval. This route intentionally
 * never guesses calendar URLs or makes a second live vendor request: opaque
 * export URLs live only in VrboSync and one importer updates the source of
 * truth. That keeps the UI deterministic and makes stale data visible.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { OCCUPYING_BOOKING_STATUSES } from '@/lib/booking-availability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROPERTY_COLORS = [
  '#FF5A5F', '#3B5998', '#10B981', '#8B5CF6', '#F59E0B',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#E11D48', '#7C3AED', '#0EA5E9', '#22C55E',
  '#EF4444', '#A855F7', '#D946EF', '#0891B2', '#65A30D',
];
const FRESH_AFTER_MS = 15 * 60_000;

function integerParam(value: string | null, fallback: number): number {
  if (value === null || value === '') return fallback;
  return Number.parseInt(value, 10);
}

export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;

  const now = new Date();
  const month = integerParam(request.nextUrl.searchParams.get('month'), now.getMonth() + 1);
  const year = integerParam(request.nextUrl.searchParams.get('year'), now.getFullYear());
  const propertyFilter = request.nextUrl.searchParams.get('property_id');
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020 || year > 2100) {
    return NextResponse.json(
      { error: 'Invalid calendar month or year', code: 'INVALID_CALENDAR_RANGE' },
      { status: 400 },
    );
  }

  try {
    const properties = await prisma.property.findMany({
      where: {
        status: 'ACTIVE',
        ...(propertyFilter
          ? { OR: [{ id: propertyFilter }, { slug: propertyFilter }] }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        address: true,
        vrboSync: {
          select: { syncEnabled: true, lastIcalSync: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (propertyFilter && properties.length === 0) {
      return NextResponse.json(
        { error: 'Property not found', code: 'PROPERTY_NOT_FOUND' },
        { status: 404 },
      );
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));
    const propertyIds = properties.map((property) => property.id);
    const bookings = propertyIds.length
      ? await prisma.booking.findMany({
          where: {
            propertyId: { in: propertyIds },
            status: { in: [...OCCUPYING_BOOKING_STATUSES] },
            checkIn: { lt: endDate },
            checkOut: { gt: startDate },
          },
          include: {
            property: { select: { id: true, name: true } },
            guest: { select: { name: true } },
          },
          orderBy: [{ checkIn: 'asc' }, { propertyId: 'asc' }],
        })
      : [];

    const colorByProperty = new Map(
      properties.map((property, index) => [property.id, PROPERTY_COLORS[index % PROPERTY_COLORS.length]]),
    );
    const events = bookings.map((booking) => ({
      id: booking.id,
      title: booking.status === 'BLOCKED'
        ? `Blocked — ${booking.property.name}`
        : `${booking.guest.name} — ${booking.property.name}`,
      start: booking.checkIn.toISOString().split('T')[0],
      end: booking.checkOut.toISOString().split('T')[0],
      platform: booking.platform.toLowerCase(),
      status: booking.status,
      guestName: booking.status === 'BLOCKED' ? null : booking.guest.name,
      guestCount: booking.guestCount,
      confirmationCode: booking.confirmCode,
      totalPrice: booking.totalPrice,
      color: colorByProperty.get(booking.propertyId) || PROPERTY_COLORS[0],
      propertyId: booking.propertyId,
      propertyName: booking.property.name,
    }));

    const sourceRows = properties.map((property) => {
      const lastSync = property.vrboSync?.lastIcalSync || null;
      const ageSeconds = lastSync
        ? Math.max(0, Math.floor((now.getTime() - lastSync.getTime()) / 1000))
        : null;
      const state = !property.vrboSync?.syncEnabled || !lastSync
        ? 'missing'
        : ageSeconds! * 1000 <= FRESH_AFTER_MS
          ? 'fresh'
          : 'stale';
      return { propertyId: property.id, state, ageSeconds, lastIcalSync: lastSync?.toISOString() || null };
    });

    return NextResponse.json({
      events,
      month,
      year,
      properties: properties.map((property, index) => ({
        id: property.id,
        slug: property.slug,
        name: property.name,
        color: PROPERTY_COLORS[index % PROPERTY_COLORS.length],
      })),
      sources: {
        database: events.length,
        configured: properties.filter((property) => property.vrboSync?.syncEnabled).length,
        freshness: {
          generatedAt: now.toISOString(),
          staleAfterSeconds: FRESH_AFTER_MS / 1000,
          fresh: sourceRows.filter((row) => row.state === 'fresh').length,
          stale: sourceRows.filter((row) => row.state === 'stale').length,
          missing: sourceRows.filter((row) => row.state === 'missing').length,
          properties: sourceRows,
        },
      },
    });
  } catch (error) {
    const incidentId = crypto.randomUUID();
    console.error('[bookings/calendar] failed', { incidentId, error });
    return NextResponse.json(
      { error: 'Calendar data unavailable', code: 'CALENDAR_UNAVAILABLE', incidentId },
      { status: 503 },
    );
  }
}
