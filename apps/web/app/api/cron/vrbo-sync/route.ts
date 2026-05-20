/**
 * VRBO iCal Sync Cron — Runs every 15 minutes
 * Fetches iCal feeds from VRBO for all 15 properties,
 * parses bookings, and upserts into Supabase PostgreSQL.
 * No OwnerRez. No PMS middleman. $0/mo forever.
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAllProperties, initializeVrboMappings } from '@/lib/integrations/vrbo-sync-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sets this automatically for cron jobs)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize mappings if needed (first run)
    const initialized = await initializeVrboMappings();

    // Run the sync
    const result = await syncAllProperties();

    return NextResponse.json({
      ok: true,
      initialized,
      ...result,
    });
  } catch (error: any) {
    console.error('[vrbo-sync] Cron error:', error);
    return NextResponse.json(
      { error: 'VRBO sync failed', detail: error.message },
      { status: 500 }
    );
  }
}
