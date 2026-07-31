import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { cleanerLeaderboard } from '@/lib/cleaner-leaderboard';

// P5 objective 2 — cleaner leaderboard.
//
// src/lib/api.ts already had fetchCleanerLeaderboard() calling
// '/api/cleaners/leaderboard' through the shared axios client, whose baseURL is
// NEXT_PUBLIC_API_URL. In production that resolves to a Cloudflare Worker on the
// retired account, which answers 404 for every path including '/'. So the
// function existed, the endpoint did not, and the call could never have
// succeeded. This is the endpoint, served by Next itself and same-origin.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function defaultStart(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
}

function parseDay(raw: string | null, fallback: Date, endOfDay = false): Date | null {
  if (!raw) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── GET /api/cleaners/leaderboard ────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Owner/admin: a ranking of people is a management view, not something a
  // worker sees about their colleagues.
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const start = parseDay(params.get('start'), defaultStart());
  const end = parseDay(params.get('end'), new Date(), true);

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end must be YYYY-MM-DD dates' }, { status: 400 });
  }
  if (start > end) {
    return NextResponse.json({ error: 'start must be on or before end' }, { status: 400 });
  }

  try {
    return NextResponse.json(await cleanerLeaderboard(start, end));
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to build the cleaner leaderboard', detail: error.message },
      { status: 500 },
    );
  }
}
