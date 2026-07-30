import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Backed by the real ServiceSubscription table (queue #26855). This route was a
// module-level array of seven services with invented monthly costs and invented
// usage counters, so every figure on the operating-cost screen -- what the
// business spends per month, what it spends per year, how close a free tier is
// to its limit -- was fiction that reset on the next cold start.
//
// The array is deliberately NOT migrated into the table. The service names were
// real, but their costs and usage numbers were not, and seeding invented money
// into production is worse than an empty screen that admits it is empty. Real
// subscriptions go in through POST.
//
// monthlyCost is DOLLARS as a float here and in the model, matching the rest of
// this app's money fields and the contract the UI already consumes.

interface ServiceCost {
  id: string;
  service: string;
  category: string;
  description: string;
  monthlyCost: number;
  billingCycle: string;
  status: string;
  usageMetric?: string;
  currentUsage?: number;
  usageLimit?: number;
  notes?: string;
  lastBilled?: string;
}

function toContract(row: {
  id: string;
  service: string;
  category: string;
  description: string;
  monthlyCost: number;
  billingCycle: string;
  status: string;
  usageMetric: string | null;
  currentUsage: number | null;
  usageLimit: number | null;
  notes: string | null;
  lastBilled: Date | null;
}): ServiceCost {
  return {
    id: row.id,
    service: row.service,
    category: row.category,
    description: row.description,
    monthlyCost: row.monthlyCost,
    billingCycle: row.billingCycle,
    status: row.status,
    // Absent stays absent rather than becoming null: the original contract
    // omitted these keys entirely when unset.
    ...(row.usageMetric !== null ? { usageMetric: row.usageMetric } : {}),
    ...(row.currentUsage !== null ? { currentUsage: row.currentUsage } : {}),
    ...(row.usageLimit !== null ? { usageLimit: row.usageLimit } : {}),
    ...(row.notes !== null ? { notes: row.notes } : {}),
    ...(row.lastBilled !== null
      ? { lastBilled: row.lastBilled.toISOString().slice(0, 10) }
      : {}),
  };
}

// Aggregation logic is unchanged; only the source is.
function buildSummary(costs: ServiceCost[]) {
  const totalMonthly = costs.reduce((sum, c) => sum + c.monthlyCost, 0);
  const totalAnnual = totalMonthly * 12;
  const activeServices = costs.filter((c) => c.status === 'active' || c.status === 'trial').length;
  const freeServices = costs.filter((c) => c.status === 'free-tier').length;

  const byCategory: Record<string, { count: number; monthly: number; services: string[] }> = {};
  for (const c of costs) {
    if (!byCategory[c.category]) {
      byCategory[c.category] = { count: 0, monthly: 0, services: [] };
    }
    byCategory[c.category].count += 1;
    byCategory[c.category].monthly += c.monthlyCost;
    byCategory[c.category].services.push(c.service);
  }

  return {
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    totalAnnual: Math.round(totalAnnual * 100) / 100,
    activeServices,
    freeServices,
    totalServices: costs.length,
    byCategory,
  };
}

const VALID_CATEGORIES = ['communications', 'hosting', 'database', 'ai', 'email', 'other'];
const VALID_STATUSES = ['active', 'trial', 'free-tier', 'cancelled'];
const VALID_CYCLES = ['monthly', 'annual', 'usage-based', 'free'];

// ── GET /api/service-costs ───────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const category = params.get('category');
    const status = params.get('status');

    const where: Record<string, unknown> = {};
    if (category && category !== 'all') where.category = category;
    if (status) where.status = status;

    const rows = await prisma.serviceSubscription.findMany({
      where,
      orderBy: [{ category: 'asc' }, { service: 'asc' }],
    });
    const services = rows.map(toContract);

    // Summary reflects the FILTERED set, as it always has.
    return NextResponse.json({ services, summary: buildSummary(services) });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch service costs', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/service-costs ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    if (
      !body.service ||
      !body.category ||
      !body.description ||
      typeof body.monthlyCost !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: service, category, description, monthlyCost' },
        { status: 400 },
      );
    }

    if (!VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 },
      );
    }

    if (!Number.isFinite(body.monthlyCost) || body.monthlyCost < 0) {
      // NaN or a negative cost silently corrupts every total on the screen.
      return NextResponse.json(
        { error: 'monthlyCost must be a non-negative number of dollars' },
        { status: 400 },
      );
    }

    // Match on id first, then case-insensitively on service name -- the same
    // upsert-by-name behaviour the in-memory version had, so re-posting Twilio
    // updates Twilio instead of creating a second row.
    // id first, then FALL BACK to the name. Looking up by id ALONE meant that
    // {id:'new-thing', service:'Twilio'} missed the id, tried to create, and hit
    // the unique constraint on `service` as an opaque 500 -- where the old
    // in-memory version matched either and updated Twilio.
    const byName = {
      where: { service: { equals: body.service, mode: 'insensitive' as const } },
    };
    const existing =
      (body.id
        ? await prisma.serviceSubscription.findUnique({ where: { id: body.id } })
        : null) ?? (await prisma.serviceSubscription.findFirst(byName));

    const data = {
      service: body.service,
      category: body.category,
      description: body.description,
      monthlyCost: body.monthlyCost,
      billingCycle: VALID_CYCLES.includes(body.billingCycle) ? body.billingCycle : 'monthly',
      status: VALID_STATUSES.includes(body.status) ? body.status : 'active',
      usageMetric: body.usageMetric ?? null,
      currentUsage: typeof body.currentUsage === 'number' ? body.currentUsage : null,
      usageLimit: typeof body.usageLimit === 'number' ? body.usageLimit : null,
      notes: body.notes ?? null,
      lastBilled: body.lastBilled ? new Date(`${body.lastBilled}T00:00:00.000Z`) : null,
    };

    const saved = existing
      ? await prisma.serviceSubscription.update({ where: { id: existing.id }, data })
      : await prisma.serviceSubscription.create({ data });

    // Summary here covers ALL services, not just the saved one -- unchanged.
    const all = await prisma.serviceSubscription.findMany();

    return NextResponse.json(
      { service: toContract(saved), summary: buildSummary(all.map(toContract)) },
      { status: existing ? 200 : 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to save service cost', detail: error.message },
      { status: 500 },
    );
  }
}
