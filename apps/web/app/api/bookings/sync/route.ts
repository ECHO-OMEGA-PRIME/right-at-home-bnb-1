/**
 * Right at Home BnB - Booking Sync Trigger
 * POST /api/bookings/sync — triggers VRBO iCal sync for all or one property
 */

import { NextRequest, NextResponse } from 'next/server';
import { PROPERTIES } from '@/lib/property-data';

// In-memory sync state (replaced by DB in production)
const syncState: Record<string, {
  status: string;
  bookingsFound: number;
  bookingsNew: number;
  syncedAt: string;
  error: string | null;
}> = {};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const propertyId = body.property_id;

    const targets = propertyId
      ? PROPERTIES.filter(p => p.id === propertyId && p.status === 'ACTIVE')
      : PROPERTIES.filter(p => p.status === 'ACTIVE');

    const results: Record<string, any> = {};

    for (const prop of targets) {
      if (!prop.vrboId) continue;

      syncState[prop.id] = {
        status: 'in_progress',
        bookingsFound: 0,
        bookingsNew: 0,
        syncedAt: new Date().toISOString(),
        error: null,
      };

      try {
        // Try fetching VRBO iCal
        const url = `https://www.vrbo.com/icalendar/${prop.vrboId}.ics`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'RightAtHomeBnB/1.0' },
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const text = await res.text();
          const eventCount = (text.match(/BEGIN:VEVENT/g) || []).length;
          syncState[prop.id] = {
            status: 'success',
            bookingsFound: eventCount,
            bookingsNew: eventCount,
            syncedAt: new Date().toISOString(),
            error: null,
          };
          results[prop.id] = { status: 'success', bookings: eventCount };
        } else {
          syncState[prop.id] = {
            status: 'failed',
            bookingsFound: 0,
            bookingsNew: 0,
            syncedAt: new Date().toISOString(),
            error: `VRBO iCal returned ${res.status}. Partner Central iCal URL needed.`,
          };
          results[prop.id] = { status: 'needs_ical_url', vrboId: prop.vrboId };
        }
      } catch (err: any) {
        syncState[prop.id] = {
          status: 'failed',
          bookingsFound: 0,
          bookingsNew: 0,
          syncedAt: new Date().toISOString(),
          error: err.message,
        };
        results[prop.id] = { status: 'error', message: err.message };
      }
    }

    return NextResponse.json({
      triggered: targets.length,
      results,
      message: 'Sync initiated for all active properties',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Sync failed', detail: error.message },
      { status: 500 },
    );
  }
}

// Export sync state for the status route
export { syncState };
