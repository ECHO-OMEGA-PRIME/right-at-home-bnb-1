import { NextRequest, NextResponse } from 'next/server';

// ── Tax calculation helpers ──────────────────────────────────────────────
function calculateFederalWithholding(annualizedGrossCents: number): number {
  // 2026 simplified brackets (single filer)
  const brackets = [
    { limit: 1155000, rate: 0.10 },
    { limit: 4692500, rate: 0.12 },
    { limit: 10052500, rate: 0.22 },
    { limit: 19190000, rate: 0.24 },
    { limit: 24350000, rate: 0.32 },
    { limit: 59125000, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ];

  let taxCents = 0;
  let prevLimit = 0;
  for (const bracket of brackets) {
    if (annualizedGrossCents <= prevLimit) break;
    const taxable = Math.min(annualizedGrossCents, bracket.limit) - prevLimit;
    taxCents += Math.round(taxable * bracket.rate);
    prevLimit = bracket.limit;
  }

  // Return per-period amount (semi-monthly = 24 periods)
  return Math.round(taxCents / 24);
}

function calculateSocialSecurity(grossCents: number): number {
  const annualWageCap = 16830000; // $168,300 for 2026
  const rate = 0.062;
  // Simplified: assume under cap for each paycheck
  return Math.round(grossCents * rate);
}

function calculateMedicare(grossCents: number): number {
  return Math.round(grossCents * 0.0145);
}

// ── In-memory data ───────────────────────────────────────────────────────
const employees = [
  { id: 'EMP-001', name: 'Maria Garcia', role: 'cleaner', status: 'active', pay_type: 'hourly', rate_cents: 1800, default_hours: 30 },
  { id: 'EMP-002', name: 'James Wilson', role: 'maintenance', status: 'active', pay_type: 'hourly', rate_cents: 2200, default_hours: 40 },
  { id: 'EMP-003', name: 'Lisa Chen', role: 'manager', status: 'active', pay_type: 'salary', rate_cents: 520000, default_hours: null }, // semi-monthly salary
];

const payrollRuns: any[] = [
  {
    id: 'PR-001',
    pay_period_start: '2026-03-01',
    pay_period_end: '2026-03-15',
    pay_date: '2026-03-18',
    status: 'processed',
    total_gross_cents: 106000,
    total_net_cents: 82890,
    total_employer_tax_cents: 8109,
    items: [],
    created_at: '2026-03-16T08:00:00Z',
    updated_at: '2026-03-18T09:00:00Z',
  },
];

// ── GET /api/payroll/runs ────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      payroll_runs: payrollRuns,
      total: payrollRuns.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list payroll runs', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/payroll/runs ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.pay_period_start || !body.pay_period_end || !body.pay_date) {
      return NextResponse.json(
        { error: 'Missing required: pay_period_start, pay_period_end, pay_date' },
        { status: 400 },
      );
    }

    const activeEmployees = employees.filter((e) => e.status === 'active');
    const items: any[] = [];
    let totalGrossCents = 0;
    let totalNetCents = 0;
    let totalEmployerTaxCents = 0;

    for (const emp of activeEmployees) {
      // Calculate gross pay
      let grossCents = 0;
      const hoursOverride = body.hours?.[emp.id];

      if (emp.pay_type === 'hourly') {
        const hours = hoursOverride ?? emp.default_hours ?? 0;
        grossCents = hours * emp.rate_cents;
      } else {
        // Salary: semi-monthly amount
        grossCents = emp.rate_cents;
      }

      // Annualize for federal withholding calculation
      const annualizedCents = grossCents * 24;

      // Employee deductions
      const federalWithholding = calculateFederalWithholding(annualizedCents);
      const ssCents = calculateSocialSecurity(grossCents);
      const medicareCents = calculateMedicare(grossCents);
      const stateWithholding = 0; // Texas has no state income tax

      const totalDeductionsCents = federalWithholding + ssCents + medicareCents + stateWithholding;
      const netCents = grossCents - totalDeductionsCents;

      // Employer taxes
      const employerSsCents = ssCents; // employer matches
      const employerMedicareCents = medicareCents; // employer matches
      const futaCents = Math.round(grossCents * 0.006); // 0.6% FUTA
      const sutaCents = Math.round(grossCents * 0.027); // TX SUTA ~2.7%
      const employerTotalCents = employerSsCents + employerMedicareCents + futaCents + sutaCents;

      items.push({
        employee_id: emp.id,
        employee_name: emp.name,
        role: emp.role,
        pay_type: emp.pay_type,
        hours_worked: emp.pay_type === 'hourly' ? (hoursOverride ?? emp.default_hours) : null,
        rate_cents: emp.rate_cents,
        gross_cents: grossCents,
        deductions: {
          federal_withholding_cents: federalWithholding,
          social_security_cents: ssCents,
          medicare_cents: medicareCents,
          state_withholding_cents: stateWithholding,
          total_cents: totalDeductionsCents,
        },
        net_cents: netCents,
        employer_taxes: {
          social_security_cents: employerSsCents,
          medicare_cents: employerMedicareCents,
          futa_cents: futaCents,
          suta_cents: sutaCents,
          total_cents: employerTotalCents,
        },
      });

      totalGrossCents += grossCents;
      totalNetCents += netCents;
      totalEmployerTaxCents += employerTotalCents;
    }

    const now = new Date().toISOString();
    const payrollRun = {
      id: `PR-${Date.now().toString(36).toUpperCase()}`,
      pay_period_start: body.pay_period_start,
      pay_period_end: body.pay_period_end,
      pay_date: body.pay_date,
      status: 'draft',
      total_gross_cents: totalGrossCents,
      total_net_cents: totalNetCents,
      total_employer_tax_cents: totalEmployerTaxCents,
      total_cost_cents: totalGrossCents + totalEmployerTaxCents,
      employee_count: items.length,
      items,
      created_at: now,
      updated_at: now,
    };

    payrollRuns.push(payrollRun);

    return NextResponse.json({ payroll_run: payrollRun }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create payroll run', detail: error.message },
      { status: 500 },
    );
  }
}
