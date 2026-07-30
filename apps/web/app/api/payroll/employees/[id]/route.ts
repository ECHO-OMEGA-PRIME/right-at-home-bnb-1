import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  SsnPolicyError,
  auditPiiAccess,
  getEmployee,
  normaliseSsnLast4,
  normaliseW4Status,
  toEmployeeContract,
} from '@/lib/payroll';

// Real WorkerProfile rows (queue #26855). Previously a hardcoded employee with
// an invented SSN fragment and invented pay history.
//
// SSN POLICY: last four digits only, and PATCH refuses anything longer rather
// than truncating -- see @/lib/payroll for why that distinction matters.

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/payroll/employees/[id] ──────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const employee = await getEmployee(id, true);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Pay history comes from real WorkerPayEntry rows.
    const entries = await prisma.workerPayEntry.findMany({
      where: { workerId: id },
      orderBy: { earnedAt: 'desc' },
      take: 100,
    });

    const history = entries.map((e) => ({
      id: e.id,
      amount_cents: e.amountCents,
      status: (e.status || '').toLowerCase(),
      earned_at: e.earnedAt.toISOString(),
      approved_at: e.approvedAt ? e.approvedAt.toISOString() : null,
      paid_at: e.paidAt ? e.paidAt.toISOString() : null,
      payroll_batch_id: e.payrollBatchId,
    }));

    // Year-to-date from this calendar year's entries only.
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const ytd = history.filter((h) => new Date(h.earned_at) >= yearStart);
    const ytdGrossCents = ytd.reduce((s, h) => s + h.amount_cents, 0);

    await auditPiiAccess(auth.user?.uid ?? null, 'payroll.employee.read', id);

    const withSsn = employee as typeof employee & { ssn_last4?: string | null };
    return NextResponse.json({
      employee: {
        ...employee,
        // Masked form only. The unmasked value is never assembled here.
        ssn_masked: withSsn.ssn_last4 ? `***-**-${withSsn.ssn_last4}` : null,
      },
      pay_history: history,
      ytd_gross_cents: ytdGrossCents,
      // WorkerPayEntry records the amount earned, not withholdings, so net
      // cannot be derived. Reported as null rather than echoing gross and
      // implying zero tax was withheld.
      ytd_net_cents: null,
      pay_periods_count: ytd.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to load employee', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PATCH /api/payroll/employees/[id] ────────────────────────────────────
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const existing = await prisma.workerProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const body = await request.json();

    if (body.status && !['active', 'inactive', 'terminated'].includes(body.status)) {
      return NextResponse.json(
        { error: 'status must be one of: active, inactive, terminated' },
        { status: 400 },
      );
    }

    // Policy checks run before any write, so a rejected SSN never lands.
    let ssnLast4: string | null | undefined;
    let w4FilingStatus: string | null | undefined;
    try {
      if (body.ssn_last4 !== undefined) ssnLast4 = normaliseSsnLast4(body.ssn_last4);
      if (body.w4_filing_status !== undefined) {
        w4FilingStatus = normaliseW4Status(body.w4_filing_status);
      }
    } catch (e) {
      if (e instanceof SsnPolicyError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const profileData: Record<string, unknown> = {};
    if (body.role !== undefined) profileData.workerType = String(body.role).toUpperCase();
    if (body.pay_type !== undefined) profileData.defaultPayType = String(body.pay_type).toUpperCase();
    if (body.rate_cents !== undefined) profileData.hourlyRateCents = body.rate_cents;
    if (body.default_hours !== undefined) profileData.defaultHours = body.default_hours;
    if (body.address !== undefined) profileData.addressLine = body.address;
    if (body.w4_allowances !== undefined) profileData.w4Allowances = body.w4_allowances;
    if (ssnLast4 !== undefined) profileData.ssnLast4 = ssnLast4;
    if (w4FilingStatus !== undefined) profileData.w4FilingStatus = w4FilingStatus;
    if (body.status !== undefined) profileData.isAvailable = body.status === 'active';

    // name/email/phone live on User, not WorkerProfile.
    const userData: Record<string, unknown> = {};
    if (body.name !== undefined) userData.name = body.name;
    if (body.email !== undefined) userData.email = String(body.email).toLowerCase();
    if (body.phone !== undefined) userData.phone = body.phone;
    if (body.status === 'terminated') userData.isActive = false;
    if (Object.keys(userData).length) {
      await prisma.user.update({ where: { id: existing.userId }, data: userData });
    }

    const updated = await prisma.workerProfile.update({
      where: { id },
      data: profileData,
      include: { user: { select: { name: true, email: true, phone: true, isActive: true } } },
    });

    await auditPiiAccess(auth.user?.uid ?? null, 'payroll.employee.update', id);

    return NextResponse.json({ employee: toEmployeeContract(updated as never, true) });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update employee', detail: error.message },
      { status: 500 },
    );
  }
}
