/**
 * VRBO listing scrape cron — daily refresh of public listing data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { scrapeAndCacheAllListings } from '@/lib/integrations/vrbo-listing-service';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { results, durationMs } = await scrapeAndCacheAllListings();
    const updated = results.filter((r) => r.action === 'updated').length;
    const errors = results.filter((r) => r.action === 'error').length;

    return NextResponse.json({
      ok: true,
      updated,
      errors,
      durationMs,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scrape failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}