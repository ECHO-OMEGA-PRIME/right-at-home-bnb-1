import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  VALID_COST_CATEGORIES,
  centsToDollars,
  listCosts,
  toCostContract,
} from '@/lib/costs';

// Backed by the real Expense table (queue #26855).
//
// /api/costs and /api/expenses were two separate hardcoded arrays describing
// the same thing: money the business spent. They now share one table, so a cost
// recorded through either route appears in the other and in the P&L. Two
// sources of truth for spend is how a P&L quietly stops matching the bank.

// ── GET /api/costs ──────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const filtered = await listCosts({
      category: params.get('category'),
      propertyId: params.get('property_id'),
      startDate: params.get('start_date'),
      endDate: params.get('end_date'),
      recurring: params.get('recurring'),
    });

    const totalCents = filtered.reduce((s, c) => s + c.amount_cents, 0);
    const byCategory: Record<string, number> = {};
    for (const c of filtered) {
      byCategory[c.category] = (byCategory[c.category] ?? 0) + c.amount_cents;
    }

    return NextResponse.json({
      costs: filtered,
      total: filtered.length,
      total_cents: totalCents,
      by_category: byCategory,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list costs', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/costs ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    if (!body.category || !body.description || typeof body.amount_cents !== 'number') {
      return NextResponse.json(
        { error: 'Missing required: category, description, amount_cents' },
        { status: 400 },
      );
    }
    if (!Number.isInteger(body.amount_cents) || body.amount_cents <= 0) {
      return NextResponse.json(
        { error: 'amount_cents must be a positive integer' },
        { status: 400 },
      );
    }
    if (!VALID_COST_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_COST_CATEGORIES.join(', ')}` },
        { status: 400 },
      );
    }

    const created = await prisma.expense.create({
      data: {
        category: body.category,
        description: body.description,
        amount: centsToDollars(body.amount_cents),
        propertyId: body.property_id ?? null,
        bookingId: body.booking_id ?? null,
        vendor: body.vendor ?? null,
        recurring: body.recurring ?? false,
        date: new Date(`${body.date ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
        notes: body.notes ?? null,
      },
    });

    return NextResponse.json({ cost: toCostContract(created as never) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create cost entry', detail: error.message },
      { status: 500 },
    );
  }
}
