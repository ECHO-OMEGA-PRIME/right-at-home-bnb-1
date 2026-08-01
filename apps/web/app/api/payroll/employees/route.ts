import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  SsnPolicyError,
  auditPiiAccess,
  listEmployees,
  normaliseSsnLast4,
  normaliseW4Status,
  toEmployeeContract,
} from '@/lib/payroll';

// Real WorkerProfile rows joined to User (queue #26855). This route previously
// served fabricated employees carrying invented SSN fragments, home addresses
// and pay rates.
//
// SSN POLICY: only the last four digits are ever stored, and the API REFUSES
// anything longer rather than truncating it -- truncating would mean the full
// value had already travelled through the request body and logs to get here.
// See @/lib/payroll.

// ── GET /api/payroll/employees ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;

    const employees = await listEmployees({
      role: params.get('role'),
      status: params.get('status'),
      // Only owner/admin reach this line at all; kept explicit so the
      // privileged read is a visible decision rather than an accident.
      includeSensitive: true,
    });

    // Reading employee PII leaves a trail.
    await auditPiiAccess(auth.user?.uid ?? null, 'payroll.employees.list', 'ALL');

    return NextResponse.json({ employees, total: employees.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list employees', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/payroll/employees ──────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    for (const field of ['name', 'role', 'pay_type', 'rate_cents'] as const) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }
    if (!['hourly', 'salary'].includes(body.pay_type)) {
      return NextResponse.json({ error: 'pay_type must be "hourly" or "salary"' }, { status: 400 });
    }
    if (typeof body.rate_cents !== 'number' || body.rate_cents <= 0) {
      return NextResponse.json({ error: 'rate_cents must be a positive number' }, { status: 400 });
    }

    // Policy checks run BEFORE anything is written, so a rejected SSN never
    // reaches the database.
    let ssnLast4: string | null;
    let w4FilingStatus: string | null;
    try {
      ssnLast4 = normaliseSsnLast4(body.ssn_last4);
      w4FilingStatus = normaliseW4Status(body.w4_filing_status);
    } catch (e) {
      if (e instanceof SsnPolicyError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    // A worker profile hangs off a User; create or reuse one by email.
    const email = body.email ?? `${String(body.name).toLowerCase().replace(/\s+/g, '.')}@rah.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: body.name, phone: body.phone ?? undefined },
      create: { email, name: body.name, phone: body.phone ?? null, role: 'WORKER' },
    });

    const existingProfile = await prisma.workerProfile.findUnique({ where: { userId: user.id } });
    if (existingProfile) {
      return NextResponse.json(
        { error: 'An employee profile already exists for that email' },
        { status: 409 },
      );
    }

    const created = await prisma.workerProfile.create({
      data: {
        userId: user.id,
        workerType: String(body.role).toUpperCase(),
        defaultPayType: String(body.pay_type).toUpperCase(),
        hourlyRateCents: body.rate_cents,
        defaultHours: body.default_hours ?? null,
        hireDate: body.hire_date ? new Date(`${body.hire_date}T00:00:00.000Z`) : null,
        addressLine: body.address ?? null,
        ssnLast4,
        w4FilingStatus,
        w4Allowances: body.w4_allowances ?? null,
        paymentMethod: body.payment_method ?? null,
      },
      include: { user: { select: { name: true, email: true, phone: true, isActive: true } } },
    });

    await auditPiiAccess(auth.user?.uid ?? null, 'payroll.employees.create', created.id);

    return NextResponse.json(
      { employee: toEmployeeContract(created as never, true) },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create employee', detail: error.message },
      { status: 500 },
    );
  }
}
