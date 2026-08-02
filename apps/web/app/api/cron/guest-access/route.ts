import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  previewGuestAccessLifecycle,
  processGuestAccessLifecycle,
} from '@/lib/access-orchestration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeEqual(leftValue: string, rightValue: string): boolean {
  const left = Buffer.from(leftValue);
  const right = Buffer.from(rightValue);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || '';
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return Boolean(expected && bearer && safeEqual(expected, bearer));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const now = new Date();
  const active = process.env.GUEST_ACCESS_AUTOMATION_MODE === 'active';
  if (!active) {
    const preview = await previewGuestAccessLifecycle(now);
    return NextResponse.json(
      { success: true, mode: 'observe', preview },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await processGuestAccessLifecycle(now);
  const failed = [
    ...result.provision.filter((item) => !item.ok),
    ...result.revoke.filter((item) => !item.ok),
  ].length;

  return NextResponse.json(
    { success: failed === 0, mode: 'active', failed, result },
    {
      status: failed === 0 ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
