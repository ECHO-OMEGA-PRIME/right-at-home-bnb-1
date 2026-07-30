import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { postJournalEntry, reverseJournalEntry, UnknownAccountError } from '@/lib/ledger';
import { auditPiiAccess } from '@/lib/payroll';

// Real PayrollBatch rows (queue #26855). This route previously read from a
// module-level array holding one invented run, and -- more seriously -- BUILT a
// payroll journal entry on approval and then threw it away. Approving payroll
// produced no accounting record at all.
//
// Now approval posts a real balanced entry through @/lib/ledger, and the entry
// id is stored on the batch so a second approve cannot double-post.
//
// Cancelling a run that already posted REVERSES the entry rather than deleting
// it: history stays intact, which is the point of a ledger.

type RouteContext = { params: Promise<{ id: string }> };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

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
    journal_entry_id: b.journalEntryId ?? null,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  };
}

// ── GET /api/payroll/runs/[id] ───────────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const run = await prisma.payrollBatch.findUnique({ where: { id }, include: INCLUDE });
    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }
    return NextResponse.json({ payroll_run: batchToContract(run) });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get payroll run', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PATCH /api/payroll/runs/[id] ─────────────────────────────────────────
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const run = await prisma.payrollBatch.findUnique({ where: { id }, include: INCLUDE });
    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    const body = await request.json();
    const validStatuses = ['draft', 'approved', 'processed', 'cancelled'];
    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `status required and must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    const current = (run.status || '').toLowerCase();

    // Transition rules unchanged.
    if (current === 'processed' && body.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Processed payroll runs can only be cancelled' },
        { status: 400 },
      );
    }
    if (current === 'cancelled') {
      return NextResponse.json(
        { error: 'Cancelled payroll runs cannot be modified' },
        { status: 400 },
      );
    }

    let journalEntry: any = null;
    let journalEntryId: string | null = run.journalEntryId ?? null;

    if (body.status === 'approved' || body.status === 'processed') {
      if (journalEntryId) {
        // Already posted on a previous approve. Re-posting would double the
        // payroll expense, so return the existing entry instead.
        journalEntry = await prisma.journalEntry.findUnique({
          where: { id: journalEntryId },
          include: { lines: true },
        });
      } else {
        // Debit wage expense (gross) + employer tax expense.
        // Credit checking (net actually paid out) + payroll tax payable
        // (employee withholdings we hold, plus the employer share we owe).
        const totalGross = run.totalGrossCents;
        const totalNet = run.totalNetCents;
        const totalEmployerTax = run.totalEmployerTaxCents;
        const taxLiabilities = totalGross - totalNet + totalEmployerTax;

        try {
          journalEntry = await postJournalEntry({
            entryDate: run.payDate ?? run.weekEnding,
            memo: `Payroll ${iso(run.periodStart) ?? '?'} to ${iso(run.weekEnding)}`,
            reference: `payroll:${run.id}`,
            createdById: auth.user?.uid ?? null,
            lines: [
              { accountCode: '5000', debitCents: totalGross, memo: 'Wage expense' },
              { accountCode: '5010', debitCents: totalEmployerTax, memo: 'Employer payroll tax' },
              { accountCode: '1000', creditCents: totalNet, memo: 'Net pay out of checking' },
              { accountCode: '2200', creditCents: taxLiabilities, memo: 'Payroll tax payable' },
            ],
          });
        } catch (e) {
          if (e instanceof UnknownAccountError) {
            // Better to refuse than to post payroll into invented accounts.
            return NextResponse.json(
              {
                error:
                  'Chart of accounts is missing the payroll accounts required to post this run',
                detail: e.message,
              },
              { status: 409 },
            );
          }
          throw e;
        }
        journalEntryId = journalEntry.id;
      }
    }

    // Cancelling a run that already hit the ledger must reverse it, not erase it.
    if (body.status === 'cancelled' && journalEntryId) {
      journalEntry = await reverseJournalEntry(
        journalEntryId,
        `Reversal of cancelled payroll run ${run.id}`,
      );
      journalEntryId = null;
    }

    const updated = await prisma.payrollBatch.update({
      where: { id },
      data: {
        status: String(body.status).toUpperCase(),
        journalEntryId,
        approvedAt:
          body.status === 'approved' && !run.approvedAt ? new Date() : run.approvedAt,
        paidAt: body.status === 'processed' && !run.paidAt ? new Date() : run.paidAt,
      },
      include: INCLUDE,
    });

    await auditPiiAccess(auth.user?.uid ?? null, `payroll.run.${body.status}`, run.id);

    return NextResponse.json({
      payroll_run: batchToContract(updated),
      journal_entry: journalEntry,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update payroll run', detail: error.message },
      { status: 500 },
    );
  }
}
