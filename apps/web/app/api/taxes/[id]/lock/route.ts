import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// P5 objective 1 — locking and unlocking an accounting period.
//
// TaxPeriod.lockedAt already existed, documented in the schema as "what makes a
// closed period immutable". Nothing set it and nothing read it, so no period
// could ever be locked and no write would have respected one. This is the
// setter; src/lib/period-lock.ts is the enforcement.
//
// Unlocking is deliberately possible. A lock with no way back turns an honest
// mistake into a permanent one, and the pressure to work around it produces
// worse books than a reopened month. What makes it safe is that both directions
// are owner-only and both write an AuditLog entry — and that log is now
// append-only at the database level, so the record of a reopened period cannot
// itself be removed.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function shape(t: {
  id: string;
  name: string;
  type: string;
  periodStart: Date;
  periodEnd: Date;
  lockedAt: Date | null;
  lockedById: string | null;
}) {
  return {
    id: t.id,
    name: t.name,
    type: t.type,
    period_start: t.periodStart.toISOString().slice(0, 10),
    period_end: t.periodEnd.toISOString().slice(0, 10),
    locked_at: iso(t.lockedAt),
    locked_by_id: t.lockedById,
    is_locked: t.lockedAt !== null,
  };
}

// ── POST /api/taxes/[id]/lock — close the period ─────────────────────────
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Owner only. Closing a period fixes the numbers a filing is made from; it is
  // not an operational action.
  const auth = await requireOneOfRoles(request, ['owner']);
  if (auth.error) return auth.error;

  try {
    const period = await prisma.taxPeriod.findUnique({ where: { id: params.id } });
    if (!period) {
      return NextResponse.json({ error: 'Tax period not found' }, { status: 404 });
    }
    // Already locked is not an error, but it must not silently overwrite the
    // original lock timestamp — that would erase who closed it and when.
    if (period.lockedAt) {
      return NextResponse.json(
        {
          error: 'That period is already locked',
          period: shape(period),
        },
        { status: 409 },
      );
    }

    const updated = await prisma.taxPeriod.update({
      where: { id: params.id },
      data: { lockedAt: new Date(), lockedById: auth.user?.uid ?? null },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.user?.uid ?? null,
        action: 'ACCOUNTING_PERIOD_LOCKED',
        entity: 'TaxPeriod',
        entityId: updated.id,
        newValues: JSON.stringify({
          name: updated.name,
          type: updated.type,
          period_start: updated.periodStart.toISOString().slice(0, 10),
          period_end: updated.periodEnd.toISOString().slice(0, 10),
          locked_at: updated.lockedAt?.toISOString(),
        }),
      },
    });

    return NextResponse.json({ period: shape(updated) });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to lock the period', detail: error.message },
      { status: 500 },
    );
  }
}

// ── DELETE /api/taxes/[id]/lock — reopen the period ──────────────────────
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOneOfRoles(request, ['owner']);
  if (auth.error) return auth.error;

  try {
    const period = await prisma.taxPeriod.findUnique({ where: { id: params.id } });
    if (!period) {
      return NextResponse.json({ error: 'Tax period not found' }, { status: 404 });
    }
    if (!period.lockedAt) {
      return NextResponse.json({ error: 'That period is not locked' }, { status: 409 });
    }

    // A reason is required. Reopening closed books after a filing is a decision
    // someone has to answer for later, and "why" is the part that is impossible
    // to reconstruct afterwards.
    let reason = '';
    try {
      reason = String((await request.json())?.reason ?? '').trim();
    } catch {
      reason = '';
    }
    if (reason.length < 10) {
      return NextResponse.json(
        { error: 'A reason of at least 10 characters is required to reopen a closed period' },
        { status: 400 },
      );
    }

    const wasLockedAt = period.lockedAt;
    const updated = await prisma.taxPeriod.update({
      where: { id: params.id },
      data: { lockedAt: null, lockedById: null },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.user?.uid ?? null,
        action: 'ACCOUNTING_PERIOD_UNLOCKED',
        entity: 'TaxPeriod',
        entityId: updated.id,
        // Both sides recorded: the lock that was removed, and the justification.
        oldValues: JSON.stringify({
          locked_at: wasLockedAt.toISOString(),
          locked_by_id: period.lockedById,
        }),
        newValues: JSON.stringify({
          name: updated.name,
          type: updated.type,
          period_start: updated.periodStart.toISOString().slice(0, 10),
          period_end: updated.periodEnd.toISOString().slice(0, 10),
          reason,
        }),
      },
    });

    return NextResponse.json({ period: shape(updated), reason });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to reopen the period', detail: error.message },
      { status: 500 },
    );
  }
}
