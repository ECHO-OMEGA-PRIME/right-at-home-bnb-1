import { NextRequest, NextResponse } from 'next/server';
import { runAutonomyLoop } from '@/lib/autonomy-loop';

// Real rows (queue #26855). This loop ran against four hardcoded arrays and
// REPORTED ACTIONS IT NEVER TOOK -- "Lock code 4821 generated for Sarah
// Johnson", "Cleaning dispatched at 11:30" -- for bookings that did not exist.
// It then mutated its own array, so a cold start made it "handle" the same
// booking again. An operator trusting that output sends a guest to a door with
// no code and an uncleaned house.
//
// Detection and action are now separate words: every action carries status
// 'done' or 'pending', and only work that actually completed says 'done'.
// See @/lib/autonomy-loop for why lock codes are deliberately NOT written.

// ── GET /api/cron/autonomy-loop ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Vercel's documented cron pattern, fail-closed: an unset CRON_SECRET must
  // DENY, not allow. This route previously had no check at all and returned
  // 200 to anonymous callers on production (verified 2026-07-30).
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ?dry_run=1 reports what the loop would do without creating anything.
    // Worth having on a job that runs every five minutes and writes.
    const dryRun = ['1', 'true'].includes(
      (request.nextUrl.searchParams.get('dry_run') ?? '').toLowerCase(),
    );

    return NextResponse.json(await runAutonomyLoop({ dryRun }));
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Autonomy loop failed', detail: error.message },
      { status: 500 },
    );
  }
}
