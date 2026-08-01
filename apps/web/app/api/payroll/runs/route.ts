import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { assertPeriodOpen, periodLockResponse } from '@/lib/period-lock';
import { auditPiiAccess } from '@/lib/payroll';
import { computePay } from '@/lib/payroll-tax';

// Real PayrollBatch / WorkerPayEntry rows (queue #26855). Payroll runs were
// pushed onto an in-memory array over a hardcoded employee list, so a
// "processed" run vanished on the next cold start -- and the employees it paid
// never existed.
//
// The withholding maths is unchanged, but now lives in @/lib/payroll-tax so a
// run and a /api/payroll/calculate preview cannot disagree about net pay.
//
// PayrollBatch.weekEnding holds the period END and keeps its @unique: that is
// what stops payroll being run twice for the same period.

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function batchToContract(b: any) {
  const items = (b.entries ?? []).map((e: any) => ({
    employee_id: e.workerId,
    employee_name: e.worker?.user?.name ?? 'Unknown',
    role: (e.worker?.workerType ?? '').toLowerCase(),
    pay_type: (e.worker?.defaultPayType ?? '').toLowerCase(),
    hours_worked: e.hours,
    rate_cents: e.worker?.hourlyRateCents ?? 0,
    gross_cents: e.amountCents,
    deductions: {
      federal_withholding_cents: e.federalCents,
      social_security_cents: e.socialSecurityCents,
      medicare_cents: e.medicareCents,
      state_withholding_cents: e.stateCents,
      total_cents:
        e.federalCents + e.socialSecurityCents + e.medicareCents + e.stateCents,
    },
    net_cents: e.netCents,
    employer_taxes: {
      social_security_cents: e.employerSsCents,
      medicare_cents: e.employerMedicareCents,
      futa_cents: e.futaCents,
      suta_cents: e.sutaCents,
      total_cents:
        e.employerSsCents + e.employerMedicareCents + e.futaCents + e.sutaCents,
    },
  }));

  return {
    id: b.id,
    pay_period_start: iso(b.periodStart),
    pay_period_end: iso(b.weekEnding),
    pay_date: iso(b.payDate),
    status: (b.status || '').toLowerCase(),
    total_gross_cents: b.totalGrossCents,
    total_net_cents: b.totalNetCents,
    total_employer_tax_cents: b.totalEmployerTaxCents,
    total_cost_cents: b.totalGrossCents + b.totalEmployerTaxCents,
    employee_count: items.length,
    items,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  };
}

const INCLUDE = {
  entries: {
    include: {
      worker: {
        select: {
          workerType: true,
          defaultPayType: true,
          hourlyRateCents: true,
          user: { select: { name: true } },
        },
      },
    },
  },
} as const;

// ── GET /api/payroll/runs ────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const batches = await prisma.payrollBatch.findMany({
      include: INCLUDE,
      orderBy: { weekEnding: 'desc' },
    });
    const payroll_runs = batches.map(batchToContract);
    return NextResponse.json({ payroll_runs, total: payroll_runs.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list payroll runs', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/payroll/runs ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    if (!body.pay_period_start || !body.pay_period_end || !body.pay_date) {
      return NextResponse.json(
        { error: 'Missing required: pay_period_start, pay_period_end, pay_date' },
        { status: 400 },
      );
    }

    const periodEnd = new Date(`${body.pay_period_end}T00:00:00.000Z`);
    const periodStart = new Date(`${body.pay_period_start}T00:00:00.000Z`);

    // Real employees, not a hardcoded list.
    const workers = await prisma.workerProfile.findMany({
      where: { isAvailable: true },
      include: { user: { select: { name: true, isActive: true } } },
    });
    const active = workers.filter((w) => w.user?.isActive !== false);

    if (active.length === 0) {
      // Better than silently producing a zero-employee run that looks processed.
      return NextResponse.json(
        { error: 'No active employees to pay. Create employee records first.' },
        { status: 400 },
      );
    }

    // Year-to-date wages BEFORE this period, per worker. Wage-base taxes are
    // wrong without this: a zero YTD makes every cheque look like the first of
    // the year, so FUTA and SUTA get over-collected and SS never stops at the
    // cap.
    const yearStart = new Date(Date.UTC(periodStart.getUTCFullYear(), 0, 1));
    const ytdRows = await prisma.workerPayEntry.groupBy({
      by: ['workerId'],
      where: { earnedAt: { gte: yearStart, lt: periodStart } },
      _sum: { amountCents: true },
    });
    const ytdByWorker = new Map(ytdRows.map((r) => [r.workerId, r._sum.amountCents ?? 0]));

    let totalGrossCents = 0;
    let totalNetCents = 0;
    let totalEmployerTaxCents = 0;

    const entryData = active.map((emp) => {
      const payType = (emp.defaultPayType || '').toLowerCase();
      const rateCents = emp.hourlyRateCents ?? 0;
      const hoursOverride = body.hours?.[emp.id];
      const hours = payType === 'hourly' ? (hoursOverride ?? emp.defaultHours ?? 0) : null;
      const grossCents = payType === 'hourly' ? Math.round(hours! * rateCents) : rateCents;

      // All wages are subject to each of these taxes; only the caps differ, so
      // one YTD gross figure feeds all three wage bases.
      const ytdGross = ytdByWorker.get(emp.id) ?? 0;

      const p = computePay(grossCents, {
        filingStatus: emp.w4FilingStatus ?? 'single',
        payPeriodsPerYear: body.pay_periods_per_year ?? 24,
        stateWithholdingCents: body.state_withholding?.[emp.id] ?? 0,
        ytd: {
          grossCents: ytdGross,
          ssWagesCents: ytdGross,
          futaWagesCents: ytdGross,
          sutaWagesCents: ytdGross,
        },
      });

      totalGrossCents += p.grossCents;
      totalNetCents += p.netCents;
      totalEmployerTaxCents += p.employerTotalCents;

      return {
        workerId: emp.id,
        // No work order: this entry covers a pay PERIOD, not a job.
        workOrderId: null,
        amountCents: p.grossCents,
        hours,
        federalCents: p.federalCents,
        socialSecurityCents: p.socialSecurityCents,
        medicareCents: p.medicareCents,
        stateCents: p.stateCents,
        netCents: p.netCents,
        employerSsCents: p.employerSsCents,
        employerMedicareCents: p.employerMedicareCents,
        futaCents: p.futaCents,
        sutaCents: p.sutaCents,
        status: 'EARNED',
        earnedAt: periodEnd,
      };
    });

    const payDate = new Date(`${body.pay_date}T00:00:00.000Z`);

    // Closed books stay closed (P5-1). Both ends of the pay period and the pay
    // date itself: a run that starts inside a closed month still moves that
    // month's wage cost, even if it is paid in an open one.
    await assertPeriodOpen(periodStart, periodEnd, payDate);

    const created = await prisma.payrollBatch.create({
      data: {
        weekEnding: periodEnd,
        // The same values the lock was checked against, not rebuilt copies.
        periodStart,
        payDate,
        status: 'DRAFT',
        totalCents: totalNetCents,
        totalGrossCents,
        totalNetCents,
        totalEmployerTaxCents,
        entries: { create: entryData },
      },
      include: INCLUDE,
    });

    await auditPiiAccess(auth.user?.uid ?? null, 'payroll.run.create', created.id);

    return NextResponse.json({ payroll_run: batchToContract(created) }, { status: 201 });
  } catch (error: any) {
    // A locked accounting period is a REFUSAL, not a fault. Returning the
    // generic 500 below would tell the caller the system broke when it did
    // exactly what it was built to do, and the reason would be lost.
    const locked = periodLockResponse(error);
    if (locked) return NextResponse.json(locked.body, { status: locked.status });

    if (String(error.message).includes('Unique constraint')) {
      // weekEnding is unique: this is the guard against paying a period twice.
      return NextResponse.json(
        { error: 'A payroll run already exists for that pay period end date' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to create payroll run', detail: error.message },
      { status: 500 },
    );
  }
}
