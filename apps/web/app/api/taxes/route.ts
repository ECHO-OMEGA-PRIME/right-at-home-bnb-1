import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Real TaxPeriod rows (queue #26855). This route served a hardcoded array, so
// tax liabilities, due totals and payment status were all invented -- on a
// surface where being wrong has a filing deadline attached.
//
// TaxPeriod was originally the period-locking model for P5. Rather than add a
// second entity with its own overlapping period fields, it was extended into
// the tax record it needed to be: one row is a period, its computed liability,
// and whether it is locked and paid.

const VALID_TYPES = ['hot', 'sales', 'property', 'income', 'payroll'];

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function toContract(t: any) {
  return {
    id: t.id,
    type: t.type,
    description: t.description,
    period_start: iso(t.periodStart),
    period_end: iso(t.periodEnd),
    taxable_revenue_cents: t.taxableRevenueCents,
    tax_rate: t.taxRate,
    tax_due_cents: t.taxDueCents,
    tax_paid_cents: t.taxPaidCents,
    status: t.status,
    due_date: iso(t.dueDate),
    paid_date: iso(t.paidDate),
    locked_at: t.lockedAt ? t.lockedAt.toISOString() : null,
    created_at: t.createdAt.toISOString(),
  };
}

// ── GET /api/taxes ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const type = params.get('type');
    const status = params.get('status');
    const year = params.get('year');

    const rows = await prisma.taxPeriod.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(year
          ? {
              periodStart: {
                gte: new Date(`${year}-01-01T00:00:00.000Z`),
                lte: new Date(`${year}-12-31T23:59:59.999Z`),
              },
            }
          : {}),
      },
      orderBy: { periodStart: 'desc' },
    });

    const filtered = rows.map(toContract);

    // 'due' is the contract's word for an unpaid liability; the model's default
    // status is 'pending'. Both count as outstanding, or a newly created record
    // would silently vanish from the due total.
    const totalDueCents = filtered
      .filter((t) => ['due', 'pending', 'overdue', 'filed'].includes(t.status))
      .reduce((sum, t) => sum + t.tax_due_cents, 0);

    const totalPaidCents = filtered
      .filter((t) => t.status === 'paid')
      .reduce((sum, t) => sum + t.tax_due_cents, 0);

    const byType: Record<string, { due_cents: number; paid_cents: number; count: number }> = {};
    for (const t of filtered) {
      byType[t.type] ??= { due_cents: 0, paid_cents: 0, count: 0 };
      byType[t.type].count += 1;
      if (t.status === 'paid') byType[t.type].paid_cents += t.tax_due_cents;
      else byType[t.type].due_cents += t.tax_due_cents;
    }

    return NextResponse.json({
      tax_records: filtered,
      total: filtered.length,
      total_due_cents: totalDueCents,
      total_paid_cents: totalPaidCents,
      by_type: byType,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list tax records', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/taxes ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    if (!body.type || !body.period_start || !body.period_end) {
      return NextResponse.json(
        { error: 'Required: type, period_start, period_end' },
        { status: 400 },
      );
    }
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    // Derive the liability when a rate and base were given, rather than
    // trusting a client-supplied total to agree with its own inputs.
    let taxDueCents = body.tax_due_cents ?? 0;
    if (body.taxable_revenue_cents && body.tax_rate && !body.tax_due_cents) {
      taxDueCents = Math.round(body.taxable_revenue_cents * body.tax_rate);
    }

    const description =
      body.description ?? `${body.type} tax — ${body.period_start} to ${body.period_end}`;

    const created = await prisma.taxPeriod.create({
      data: {
        // `name` is unique and identifies the filing; type + period is what
        // makes one filing distinct from another.
        name: `${body.type}:${body.period_start}:${body.period_end}`,
        type: body.type,
        description,
        periodStart: new Date(`${body.period_start}T00:00:00.000Z`),
        periodEnd: new Date(`${body.period_end}T23:59:59.999Z`),
        taxableRevenueCents: body.taxable_revenue_cents ?? 0,
        taxRate: body.tax_rate ?? 0,
        taxDueCents,
        status: 'due',
        dueDate: body.due_date ? new Date(`${body.due_date}T00:00:00.000Z`) : null,
        notes: body.notes ?? null,
      },
    });

    return NextResponse.json({ tax_record: toContract(created) }, { status: 201 });
  } catch (error: any) {
    if (String(error.message).includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A tax record already exists for that type and period' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to create tax record', detail: error.message },
      { status: 500 },
    );
  }
}
