/**
 * Configured iCal backup reconciliation.
 *
 * This route does not guess VRBO feed URLs and is not the authoritative
 * inventory channel. Real booking authority must remain the certified PMS.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { syncPropertyIcal } from '@/lib/integrations/vrbo-sync-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const propertyId = body.property_id ? String(body.property_id) : null;

  const feeds = await prisma.vrboSync.findMany({
    where: {
      syncEnabled: true,
      ...(propertyId ? { propertyId } : {}),
      property: { status: 'ACTIVE' },
    },
    include: { property: { select: { id: true, name: true, status: true } } },
    orderBy: { property: { name: 'asc' } },
  });

  if (propertyId && feeds.length === 0) {
    return NextResponse.json(
      {
        error: 'No enabled VRBO sync configuration exists for this active property',
        code: 'SYNC_CONFIGURATION_MISSING',
      },
      { status: 409 },
    );
  }

  const configured = feeds.filter((feed) => Boolean(feed.icalUrl));
  const missing = feeds
    .filter((feed) => !feed.icalUrl)
    .map((feed) => ({ propertyId: feed.propertyId, propertyName: feed.property.name }));

  const results = [];
  for (const feed of configured) {
    const started = Date.now();
    try {
      const result = await syncPropertyIcal(
        feed.propertyId,
        feed.vrboListingId,
        feed.icalUrl!,
      );
      await prisma.vrboSync.update({
        where: { id: feed.id },
        data: { lastIcalSync: new Date() },
      });
      results.push({
        propertyId: feed.propertyId,
        propertyName: feed.property.name,
        status: result.errors.length ? 'PARTIAL' : 'SUCCESS',
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
        durationMs: result.durationMs || Date.now() - started,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'iCal reconciliation failed';
      await prisma.syncLog.create({
        data: {
          propertyId: feed.propertyId,
          syncType: 'ical_import',
          source: 'vrbo',
          status: 'failed',
          errorMessage: message.slice(0, 1000),
          durationMs: Date.now() - started,
          metadata: JSON.stringify({ mode: 'ICAL_BACKUP_RECONCILIATION' }),
        },
      });
      results.push({
        propertyId: feed.propertyId,
        propertyName: feed.property.name,
        status: 'FAILED',
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [message],
        durationMs: Date.now() - started,
      });
    }
  }

  const failed = results.filter((result) => result.status === 'FAILED').length;
  return NextResponse.json(
    {
      mode: 'ICAL_BACKUP_RECONCILIATION',
      authoritative: false,
      warning: 'iCal is delayed backup reconciliation and cannot guarantee real-time double-booking prevention.',
      configuredFeeds: configured.length,
      missingFeeds: missing,
      results,
    },
    { status: failed ? 207 : 200 },
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;

  const logs = await prisma.syncLog.findMany({
    where: { source: 'vrbo', syncType: 'ical_import' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const feeds = await prisma.vrboSync.findMany({
    include: { property: { select: { name: true, status: true } } },
    orderBy: { property: { name: 'asc' } },
  });

  return NextResponse.json({
    mode: 'ICAL_BACKUP_RECONCILIATION',
    authoritative: false,
    feeds: feeds.map((feed) => ({
      propertyId: feed.propertyId,
      propertyName: feed.property.name,
      propertyStatus: feed.property.status,
      enabled: feed.syncEnabled,
      configured: Boolean(feed.icalUrl),
      lastIcalSync: feed.lastIcalSync,
    })),
    logs,
  });
}
