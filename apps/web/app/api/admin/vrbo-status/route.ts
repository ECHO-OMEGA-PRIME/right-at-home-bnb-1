/**
 * VRBO Integration Status & Control API
 * GET  — Sync status for all properties (last sync times, error counts)
 * POST — Trigger manual sync for one or all properties
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncAllProperties, syncPropertyIcal, initializeVrboMappings } from '@/lib/integrations/vrbo-sync-service';
import { requireOneOfRoles } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    // Get all VRBO sync records with property info
    const syncs = await prisma.vrboSync.findMany({
      include: { property: { select: { id: true, name: true, vrboId: true, status: true } } },
      orderBy: { property: { name: 'asc' } },
    });

    // Get recent sync logs (last 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = await prisma.syncLog.findMany({
      where: { source: 'vrbo', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get booking counts per property from VRBO
    const vrboBookings = await prisma.booking.groupBy({
      by: ['propertyId'],
      where: { platform: 'VRBO' },
      _count: true,
    });
    const bookingMap = Object.fromEntries(vrboBookings.map(b => [b.propertyId, b._count]));

    // Upcoming VRBO arrivals. The count is queried separately rather than taken
    // from `upcoming.length` -- that list is capped, and a capped length
    // reported as a total is a wrong number that looks plausible.
    const now = new Date();
    const upcomingWhere = {
      platform: 'VRBO',
      checkIn: { gte: now },
      status: { not: 'CANCELLED' },
    } as const;

    const [upcoming, upcomingCount] = await Promise.all([
      prisma.booking.findMany({
        where: upcomingWhere,
        orderBy: { checkIn: 'asc' },
        take: 25,
        select: {
          id: true,
          propertyId: true,
          checkIn: true,
          checkOut: true,
          confirmCode: true,
          status: true,
          guest: { select: { name: true } },
        },
      }),
      prisma.booking.count({ where: upcomingWhere }),
    ]);

    // Aggregate stats
    const successCount = recentLogs.filter(l => l.status === 'success').length;
    const failCount = recentLogs.filter(l => l.status === 'failed').length;
    const totalImported = recentLogs.reduce((s, l) => s + l.itemsCreated, 0);

    return NextResponse.json({
      properties: syncs.map(s => ({
        propertyId: s.property.id,
        propertyName: s.property.name,
        vrboId: s.vrboListingId,
        vrboUrl: `https://www.vrbo.com/${s.vrboListingId}`,
        icalUrl: s.icalUrl,
        lastIcalSync: s.lastIcalSync,
        lastScrapeSync: s.lastScrapeSync,
        syncEnabled: s.syncEnabled,
        bookingCount: bookingMap[s.property.id] || 0,
        status: s.property.status,
      })),
      stats: {
        totalProperties: syncs.length,
        enabledProperties: syncs.filter(s => s.syncEnabled).length,
        totalVrboBookings: Object.values(bookingMap).reduce((s: number, c: number) => s + c, 0),
        last24h: { syncs: successCount + failCount, successes: successCount, failures: failCount, imported: totalImported },
        upcomingVrboBookings: upcomingCount,
      },
      upcomingBookings: upcoming.map(b => ({
        id: b.id,
        propertyId: b.propertyId,
        guestName: b.guest?.name ?? null,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        confirmCode: b.confirmCode,
        status: b.status,
      })),
      recentLogs: recentLogs.slice(0, 10).map(l => ({
        syncType: l.syncType,
        status: l.status,
        itemsCreated: l.itemsCreated,
        itemsUpdated: l.itemsUpdated,
        error: l.errorMessage,
        durationMs: l.durationMs,
        at: l.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const { action, propertyId } = body;

    switch (action) {
      case 'sync_all': {
        const initialized = await initializeVrboMappings();
        const result = await syncAllProperties();
        return NextResponse.json({ ok: true, initialized, ...result });
      }

      case 'sync_one': {
        if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
        const property = await prisma.property.findFirst({
          where: { id: propertyId },
          include: { vrboSync: true },
        });
        if (!property?.vrboId) return NextResponse.json({ error: 'Property not found or no VRBO ID' }, { status: 404 });
        const icalUrl = property.vrboSync?.icalUrl || `https://www.vrbo.com/ical/${property.vrboId}`;
        const result = await syncPropertyIcal(property.id, property.vrboId, icalUrl);
        return NextResponse.json({ ok: true, ...result });
      }

      case 'initialize': {
        const count = await initializeVrboMappings();
        return NextResponse.json({ ok: true, initialized: count });
      }

      case 'connect': {
        // Create or repoint a property's VRBO connection.
        //
        // `/api/admin/vrbo-ical` can only UPDATE an existing VrboSync -- it
        // answers "VrboSync record not found" otherwise -- so there was no
        // server-side way to connect a property that had never been connected.
        // The VRBO page did it by writing a `vrbo_listings` document straight
        // from the browser instead.
        const { vrboListingId, icalUrl } = body;
        if (!propertyId || !vrboListingId) {
          return NextResponse.json(
            { error: 'propertyId and vrboListingId required' },
            { status: 400 },
          );
        }
        // Validate the same way the iCal route does, so a URL that route would
        // reject cannot enter through this one.
        if (icalUrl && !String(icalUrl).includes('.ics')) {
          return NextResponse.json({ error: 'icalUrl must end in .ics' }, { status: 400 });
        }

        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        if (!property) {
          return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        // vrboListingId is unique across properties. Claiming one already bound
        // to a DIFFERENT property would silently move the listing.
        const clash = await prisma.vrboSync.findUnique({ where: { vrboListingId } });
        if (clash && clash.propertyId !== propertyId) {
          return NextResponse.json(
            { error: 'That VRBO listing is already connected to another property', code: 'LISTING_TAKEN' },
            { status: 409 },
          );
        }

        const sync = await prisma.vrboSync.upsert({
          where: { propertyId },
          update: { vrboListingId, icalUrl: icalUrl || null, syncEnabled: true },
          create: { propertyId, vrboListingId, icalUrl: icalUrl || null, syncEnabled: true },
        });
        return NextResponse.json({ ok: true, sync });
      }

      case 'set_sync': {
        // Explicit and idempotent, unlike toggle_sync. "Disconnect" must mean
        // OFF; expressing it as a toggle would silently re-enable a connection
        // that was already disabled.
        const { enabled } = body;
        if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
        if (typeof enabled !== 'boolean') {
          return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
        }
        const existing = await prisma.vrboSync.findUnique({ where: { propertyId } });
        if (!existing) return NextResponse.json({ error: 'VrboSync not found' }, { status: 404 });

        const updated = await prisma.vrboSync.update({
          where: { propertyId },
          data: { syncEnabled: enabled },
        });
        return NextResponse.json({ ok: true, syncEnabled: updated.syncEnabled });
      }

      case 'toggle_sync': {
        if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
        const sync = await prisma.vrboSync.findUnique({ where: { propertyId } });
        if (!sync) return NextResponse.json({ error: 'VrboSync not found' }, { status: 404 });
        const updated = await prisma.vrboSync.update({
          where: { propertyId },
          data: { syncEnabled: !sync.syncEnabled },
        });
        return NextResponse.json({ ok: true, syncEnabled: updated.syncEnabled });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
