/**
 * Right at Home BnB - Sync Status API
 * GET /api/bookings/sync/status — returns sync status for all properties
 */

import { NextResponse } from 'next/server';
import { PROPERTIES } from '@/lib/property-data';

export async function GET() {
  // Build status from properties list
  const status: Record<string, Record<string, any>> = {};

  for (const prop of PROPERTIES) {
    if (prop.status !== 'ACTIVE' || !prop.vrboId) continue;

    status[prop.id] = {
      vrbo: {
        property_id: prop.id,
        platform: 'vrbo',
        status: 'pending',
        bookings_found: 0,
        bookings_new: 0,
        synced_at: null,
        error_message: null,
      },
    };
  }

  return NextResponse.json(status);
}
