import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { processGuestAccessLifecycle } from '@/lib/access-orchestration';
import { materializeDueServiceSchedules } from '@/lib/operations-scheduler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET || '';
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const header = request.headers.get('x-api-secret') || '';
  return Boolean(expected && ((bearer && safeEqual(expected, bearer)) || (header && safeEqual(expected, header))));
}

async function run(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const now = new Date();
  const [access, schedules] = await Promise.all([
    processGuestAccessLifecycle(now),
    materializeDueServiceSchedules(now),
  ]);

  return NextResponse.json({
    success: true,
    checkedAt: now.toISOString(),
    access,
    schedules,
  });
}

export const GET = run;
export const POST = run;
