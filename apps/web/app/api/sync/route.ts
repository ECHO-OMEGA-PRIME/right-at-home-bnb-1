/**
 * Right at Home BnB - CloudSync API
 * Triggers sync with external platforms (Airbnb, VRBO, etc.)
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface SyncResult {
  platform: string;
  status: 'success' | 'error' | 'skipped';
  itemsSynced: number;
  errors: string[];
  duration: number;
}

interface SyncResponse {
  success: boolean;
  syncId: string;
  startedAt: string;
  completedAt: string;
  results: SyncResult[];
  summary: {
    totalPlatforms: number;
    successful: number;
    failed: number;
    totalItemsSynced: number;
  };
}

// Supported sync platforms
const PLATFORMS = ['airbnb', 'vrbo', 'booking', 'direct', 'ical'] as const;
type Platform = typeof PLATFORMS[number];

// Simulated sync functions for each platform
async function syncAirbnb(propertyIds: string[]): Promise<SyncResult> {
  const start = Date.now();
  // In production, this would call Airbnb API
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    platform: 'airbnb',
    status: 'success',
    itemsSynced: Math.floor(Math.random() * 5) + 1,
    errors: [],
    duration: Date.now() - start,
  };
}

async function syncVrbo(propertyIds: string[]): Promise<SyncResult> {
  const start = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 400));

  return {
    platform: 'vrbo',
    status: 'success',
    itemsSynced: Math.floor(Math.random() * 3) + 1,
    errors: [],
    duration: Date.now() - start,
  };
}

async function syncBookingCom(propertyIds: string[]): Promise<SyncResult> {
  const start = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 600));

  return {
    platform: 'booking',
    status: 'success',
    itemsSynced: Math.floor(Math.random() * 4),
    errors: [],
    duration: Date.now() - start,
  };
}

async function syncICal(propertyIds: string[]): Promise<SyncResult> {
  const start = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    platform: 'ical',
    status: 'success',
    itemsSynced: propertyIds.length,
    errors: [],
    duration: Date.now() - start,
  };
}

// GET /api/sync - Get sync status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('syncId');

    // Return last sync info
    const settings = await prisma.setting.findFirst({
      where: { key: 'lastSync' },
    });

    if (!settings) {
      return NextResponse.json({
        lastSync: null,
        message: 'No sync has been performed yet',
      });
    }

    const lastSyncData = JSON.parse(settings.value);

    return NextResponse.json({
      lastSync: lastSyncData,
      scheduledSyncs: [
        { platform: 'airbnb', interval: '15m', nextRun: new Date(Date.now() + 15 * 60 * 1000).toISOString() },
        { platform: 'vrbo', interval: '15m', nextRun: new Date(Date.now() + 12 * 60 * 1000).toISOString() },
        { platform: 'ical', interval: '30m', nextRun: new Date(Date.now() + 25 * 60 * 1000).toISOString() },
      ],
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/sync - Trigger manual sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { platforms, propertyIds, fullSync = false } = body;

    const syncId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date();

    // Get properties to sync
    let properties = [];
    if (propertyIds && propertyIds.length > 0) {
      properties = await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: { id: true, name: true },
      });
    } else {
      properties = await prisma.property.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
      });
    }

    const propertyIdList = properties.map((p) => p.id);

    // Determine which platforms to sync
    const platformsToSync: Platform[] = platforms && platforms.length > 0
      ? platforms.filter((p: string) => PLATFORMS.includes(p as Platform))
      : [...PLATFORMS];

    // Run syncs in parallel
    const syncPromises = platformsToSync.map(async (platform: Platform) => {
      try {
        switch (platform) {
          case 'airbnb':
            return await syncAirbnb(propertyIdList);
          case 'vrbo':
            return await syncVrbo(propertyIdList);
          case 'booking':
            return await syncBookingCom(propertyIdList);
          case 'ical':
            return await syncICal(propertyIdList);
          default:
            return {
              platform,
              status: 'skipped' as const,
              itemsSynced: 0,
              errors: ['Unknown platform'],
              duration: 0,
            };
        }
      } catch (error) {
        return {
          platform,
          status: 'error' as const,
          itemsSynced: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          duration: 0,
        };
      }
    });

    const results = await Promise.all(syncPromises);
    const completedAt = new Date();

    // Calculate summary
    const summary = {
      totalPlatforms: results.length,
      successful: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'error').length,
      totalItemsSynced: results.reduce((sum, r) => sum + r.itemsSynced, 0),
    };

    const response: SyncResponse = {
      success: summary.failed === 0,
      syncId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      results,
      summary,
    };

    // Save sync result to settings
    await prisma.setting.upsert({
      where: { key: 'lastSync' },
      update: { value: JSON.stringify(response) },
      create: { key: 'lastSync', value: JSON.stringify(response) },
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'SYNC_COMPLETED',
        entity: 'sync',
        entityId: syncId,
        oldValues: null,
        newValues: JSON.stringify({
          platforms: platformsToSync,
          propertyCount: propertyIdList.length,
          summary,
        }),
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json(
      { error: 'Failed to trigger sync', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/sync - Cancel running sync (for future webhook support)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('syncId');

    if (!syncId) {
      return NextResponse.json({ error: 'Sync ID is required' }, { status: 400 });
    }

    // In production, this would cancel a running sync job
    return NextResponse.json({
      syncId,
      status: 'cancelled',
      message: 'Sync cancellation requested',
    });
  } catch (error) {
    console.error('Error cancelling sync:', error);
    return NextResponse.json(
      { error: 'Failed to cancel sync', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
