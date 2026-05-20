/**
 * VRBO Sync API - Two-way sync of reservations and availability
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchReservations, updateAvailability, getVrboConfig, type SyncResult } from '@/lib/integrations/vrbo-client';
import { syncAllChannels, syncEverything } from '@/lib/integrations/channel-manager';

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const propertyId = params.get('propertyId');
  const mode = params.get('mode') || 'ical';
  try {
    let results: unknown;
    if (propertyId) { results = await syncAllChannels(propertyId); }
    else { results = await syncEverything(); }
    return NextResponse.json({ success: true, mode, results, syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error('VRBO sync error:', error);
    return NextResponse.json({ error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    switch (action) {
      case 'configure': {
        const { propertyId, vrboListingId, icalUrl, apiEnabled } = body;
        return NextResponse.json({ success: true, message: `VRBO configured for ${propertyId}`, config: { propertyId, vrboListingId, icalUrl, apiEnabled } });
      }
      case 'full_sync': {
        const config = getVrboConfig();
        const allResults: Record<string, SyncResult> = {};
        for (const [propertyId, listingId] of Object.entries(config.propertyIds)) {
          const reservations = await fetchReservations(listingId);
          allResults[propertyId] = { imported: reservations.length, updated: 0, cancelled: 0, conflicts: [], errors: [], lastSyncAt: new Date().toISOString() };
        }
        return NextResponse.json({ success: true, action: 'full_sync', results: allResults });
      }
      case 'push_availability': {
        const { propertyId, vrboListingId, dates } = body;
        const success = await updateAvailability(vrboListingId, dates);
        return NextResponse.json({ success, propertyId });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('VRBO sync POST error:', error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
