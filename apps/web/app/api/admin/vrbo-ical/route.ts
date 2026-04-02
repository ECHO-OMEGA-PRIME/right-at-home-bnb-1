/**
 * VRBO iCal URL Management API
 * POST — Set iCal export URL for a property (paste from Partner Central)
 * GET  — List all properties and their iCal URL status
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const syncs = await prisma.vrboSync.findMany({
      include: { property: { select: { id: true, name: true, vrboId: true } } },
      orderBy: { property: { name: 'asc' } },
    });

    const properties = syncs.map(s => ({
      propertyId: s.property.id,
      propertyName: s.property.name,
      vrboId: s.vrboListingId,
      icalUrl: s.icalUrl,
      hasValidIcalUrl: s.icalUrl ? s.icalUrl.includes('icalendar') && s.icalUrl.includes('.ics') : false,
      lastIcalSync: s.lastIcalSync,
      lastScrapeSync: s.lastScrapeSync,
      syncEnabled: s.syncEnabled,
    }));

    const valid = properties.filter(p => p.hasValidIcalUrl).length;
    const missing = properties.filter(p => !p.hasValidIcalUrl).length;

    return NextResponse.json({
      properties,
      summary: { total: properties.length, valid, missing },
      instructions: {
        howToGetUrl: [
          '1. Log into https://partner.vrbo.com with Steven\'s credentials',
          '2. Go to a property\'s Calendar page',
          '3. Click "Import & Export" or "Calendar sync"',
          '4. Find "Export calendar" section',
          '5. Copy the iCal URL (format: https://www.vrbo.com/icalendar/{hash}.ics)',
          '6. POST it to this endpoint with { vrboId, icalUrl }',
        ],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support single or bulk update
    const updates: Array<{ vrboId: string; icalUrl: string }> = Array.isArray(body) ? body : [body];

    const results = [];
    for (const { vrboId, icalUrl } of updates) {
      if (!vrboId || !icalUrl) {
        results.push({ vrboId, error: 'vrboId and icalUrl required' });
        continue;
      }

      // Validate URL format
      if (!icalUrl.includes('.ics')) {
        results.push({ vrboId, error: 'URL must end in .ics' });
        continue;
      }

      const sync = await prisma.vrboSync.findFirst({
        where: { vrboListingId: vrboId },
      });

      if (!sync) {
        results.push({ vrboId, error: 'VrboSync record not found' });
        continue;
      }

      await prisma.vrboSync.update({
        where: { id: sync.id },
        data: {
          icalUrl,
          lastScrapeSync: new Date(),
        },
      });

      results.push({ vrboId, icalUrl, status: 'updated' });
    }

    return NextResponse.json({
      ok: true,
      results,
      updated: results.filter(r => r.status === 'updated').length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
