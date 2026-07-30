import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { propertyScopeFor } from '@/lib/tenant-scope';
import { turnoverBoard } from '@/lib/turnovers';

// P2 objective 3 — owner/admin live operations view for turnovers.
//
// /api/operations/dashboard already existed but contained ZERO CleaningJob
// queries: it reported work orders, bookings, alerts and lock health while the
// turnovers the business actually runs on were absent from the picture.
//
// Scoped like every other worker-reachable route: a cleaner sees the turnovers
// at properties they work at, an owner sees all of them.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── GET /api/operations/turnovers ────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const scope = await propertyScopeFor(auth.user);
    return NextResponse.json(await turnoverBoard(scope));
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to build the turnover board', detail: error.message },
      { status: 500 },
    );
  }
}
