/**
 * VRBO iCal URL Management API
 * POST — Set iCal export URL for a property (paste from Partner Central)
 * GET  — List all properties and their iCal URL status
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireOneOfRoles } from '@/lib/api-auth';
import { adminSecretMatches } from '@/lib/admin-secret';

export async function GET(request: NextRequest) {
  // GET lists every property's iCal export URL and sync status -- admin data,
  // and it was relying on the middleware prefix alone. Guarded here too so the
  // route defends itself, matching POST.
  const apiSecret = request.headers.get('x-api-secret');
  if (apiSecret) {
    if (!adminSecretMatches(apiSecret)) {
      return NextResponse.json({ error: 'Invalid API secret' }, { status: 403 });
    }
  } else {
    const auth = await requireOneOfRoles(request, ['owner', 'admin']);
    if (auth.error) return auth.error;
  }

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
    // Two defects replaced here (see @/lib/admin-secret):
    //   - the secret was compared against `env.ADMIN_API_SECRET || 'rah-vrbo-...'`,
    //     so an unset env var would have accepted a PUBLISHED literal;
    //   - `if (!apiSecret && !cookie)` accepted ANY cookie value without
    //     validating it, treating presence as authentication.
    //
    // Neither was live — /api/admin is in the middleware's ADMIN_ONLY_PREFIXES
    // and an unauthenticated request is refused before this runs (verified: a
    // garbage cookie gets 401). This is defence-in-depth for the day that list
    // changes.
    const apiSecret = request.headers.get('x-api-secret');
    const cookie = request.cookies.get('rah-auth-token')?.value;

    if (apiSecret) {
      // A supplied secret must be CORRECT. Wrong secret denies outright rather
      // than falling through to the session path.
      if (!adminSecretMatches(apiSecret)) {
        return NextResponse.json({ error: 'Invalid API secret' }, { status: 403 });
      }
    } else {
      // No secret: require a genuinely verified admin session. A cookie being
      // present proves nothing about who sent it.
      if (!cookie) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      const auth = await requireOneOfRoles(request, ['owner', 'admin']);
      if (auth.error) return auth.error;
    }

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
