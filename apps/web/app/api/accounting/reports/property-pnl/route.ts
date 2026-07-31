import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { propertyScopeFor } from '@/lib/tenant-scope';
import { propertyPnL } from '@/lib/property-pnl';

// P5 objective 0 — property-level P&L, every property side by side.
//
// The existing /api/accounting/reports/pnl answers "how did the business do"
// for one property at a time, and adds every unallocated line into whichever
// property you ask about. Asking it 22 times therefore gives 22 answers that
// each carry the whole company's overhead and do not sum to the total. This
// route exists to make properties COMPARABLE: each row carries only what is
// attributable to it, so the numbers add up and can be ranked.
//
// It reports null rather than a profit when no costs are recorded — see the
// header of src/lib/property-pnl.ts for why that matters here specifically.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** First day of the current month, UTC. */
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

// ── GET /api/accounting/reports/property-pnl ─────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const start = parseDay(params.get('start'), defaultStart());
  const end = parseDay(params.get('end'), new Date(), true);

  // Reject a bad date instead of silently falling back to the current month —
  // a report quietly covering a different period than the one asked for is
  // worse than an error, because nothing about the output looks wrong.
  if (!start || !end) {
    return NextResponse.json(
      { error: 'start and end must be YYYY-MM-DD dates' },
      { status: 400 },
    );
  }
  if (start > end) {
    return NextResponse.json({ error: 'start must be on or before end' }, { status: 400 });
  }

  try {
    const scope = await propertyScopeFor(auth.user);
    return NextResponse.json(await propertyPnL(scope, start, end));
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate the property P&L', detail: error.message },
      { status: 500 },
    );
  }
}
