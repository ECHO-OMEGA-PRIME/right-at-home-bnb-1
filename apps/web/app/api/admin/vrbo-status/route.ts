/**
 * VRBO Integration Status & Control API
 * GET  — Sync status for all properties (last sync times, error counts)
 * POST — Trigger manual sync for one or all properties
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncAllProperties, syncPropertyIcal, initializeVrboMappings } from '@/lib/integrations/vrbo-sync-service';

export async function GET() {
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
      },
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
