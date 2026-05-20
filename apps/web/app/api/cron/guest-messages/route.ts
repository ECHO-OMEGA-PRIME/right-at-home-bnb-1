/**
 * Guest Message Cron — Runs every 5 minutes.
 * Sends scheduled messages that are due and revokes expired lock codes.
 *
 * Message lifecycle:
 *   SCHEDULED → (scheduledFor <= now) → SENT
 *   Lock codes → (codeExpiresAt <= now) → revoked (set to null)
 */

import { NextRequest, NextResponse } from 'next/server';
import { processDueMessages } from '@/lib/integrations/booking-automations';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sets this for cron jobs)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processDueMessages();

    return NextResponse.json({
      ok: true,
      ...result,
      processedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[guest-messages] Cron error:', error);
    return NextResponse.json(
      { error: 'Guest message processing failed', detail: error.message },
      { status: 500 },
    );
  }
}
