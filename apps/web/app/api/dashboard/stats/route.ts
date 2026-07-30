import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { getDashboardStats } from '@/lib/dashboard-stats';

// Every figure here used to be fabricated: invented monthly revenue, three
// made-up properties, five made-up bookings and a hardcoded task summary. The
// owner's dashboard was showing numbers nobody could act on (queue #26855).
// It now computes the same response shape from the real database.

// ── GET /api/dashboard/stats ───────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const period = request.nextUrl.searchParams.get('period') ?? 'current_month';
    return NextResponse.json(await getDashboardStats(period));
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate dashboard stats', detail: error.message },
      { status: 500 },
    );
  }
}
