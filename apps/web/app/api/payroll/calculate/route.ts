import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  FUTA_RATE,
  FUTA_WAGE_BASE_CENTS,
  MEDICARE_ADDITIONAL_RATE,
  MEDICARE_ADDITIONAL_THRESHOLD_CENTS,
  MEDICARE_RATE,
  SS_RATE,
  SS_WAGE_BASE_CENTS,
  TX_SUTA_RATE,
  TX_SUTA_WAGE_BASE_CENTS,
  computeFUTACents,
  computeFederalTaxCents,
  computeMedicareCents,
  computeSSCents,
  computeSUTACents,
} from '@/lib/payroll-tax';
import { listPayrollEmployeesForCalc } from '@/lib/payroll';

// Real WorkerProfile rows (queue #26855). This route previously calculated
// against a hardcoded four-person roster, so a "preview" of a real payroll was
// a preview of four people who do not work here.
//
// The tax engine that used to live in this file is now @/lib/payroll-tax and is
// shared with /api/payroll/runs. It was the better of the two engines -- wage
// bases, filing status, standard deduction, additional Medicare -- so it became
// the shared one rather than being replaced by the simpler version.

// ── POST /api/payroll/calculate ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    // Validate pay period
    if (!body.pay_period || !body.pay_period.start || !body.pay_period.end) {
      return NextResponse.json(
        { error: 'pay_period with start and end dates is required' },
        { status: 400 },
      );
    }

    if (!body.entries || !Array.isArray(body.entries) || body.entries.length === 0) {
      return NextResponse.json(
        { error: 'entries array with at least one employee entry is required' },
        { status: 400 },
      );
    }

    const payPeriodsPerYear = body.pay_periods_per_year ?? 26; // default bi-weekly

    // Real roster + real year-to-date wages.
    const employees = await listPayrollEmployeesForCalc(
      body.pay_period.end ? new Date(`${body.pay_period.end}T00:00:00.000Z`) : new Date(),
    );

    const results: any[] = [];
    const errors: any[] = [];
    let totalGrossCents = 0;
    let totalNetCents = 0;
    let totalEmployerCostCents = 0;

    for (const entry of body.entries) {
      if (!entry.employee_id) {
        errors.push({ error: 'Missing employee_id in entry', entry });
        continue;
      }

      const emp = employees.find((e) => e.id === entry.employee_id);
      if (!emp) {
        errors.push({ error: `Employee not found: ${entry.employee_id}`, employee_id: entry.employee_id });
        continue;
      }

      // Calculate gross pay (all in cents)
      let grossCents = 0;
      let regularPayCents = 0;
      let overtimePayCents = 0;

      if (emp.pay_type === 'hourly') {
        const regularHours = entry.regular_hours ?? 0;
        const overtimeHours = entry.overtime_hours ?? 0;

        if (regularHours < 0 || overtimeHours < 0) {
          errors.push({ error: 'Hours cannot be negative', employee_id: emp.id });
          continue;
        }

        regularPayCents = Math.round(regularHours * emp.rate_cents);
        overtimePayCents = Math.round(overtimeHours * emp.rate_cents * 1.5);
        grossCents = regularPayCents + overtimePayCents;
      } else {
        // Salary: divide annual rate by pay periods
        regularPayCents = Math.round(emp.rate_cents / payPeriodsPerYear);
        grossCents = regularPayCents;
      }

      // Add tips and bonuses
      const tipsCents = entry.tips_cents ?? 0;
      const bonusCents = entry.bonus_cents ?? 0;
      grossCents += tipsCents + bonusCents;

      // Pre-tax deductions (401k, HSA, etc.)
      const preTaxDeductionsCents = entry.pre_tax_deductions_cents ?? 0;
      const taxableGrossCents = Math.max(0, grossCents - preTaxDeductionsCents);

      // Calculate taxes
      const federalTaxCents = computeFederalTaxCents(
        taxableGrossCents,
        emp.w4_filing_status,
        payPeriodsPerYear,
      );

      const ss = computeSSCents(taxableGrossCents, emp.ytd_ss_wages_cents);
      const medicare = computeMedicareCents(taxableGrossCents, emp.ytd_gross_cents);
      const futaCents = computeFUTACents(taxableGrossCents, emp.ytd_futa_wages_cents);
      const sutaCents = computeSUTACents(taxableGrossCents, emp.ytd_suta_wages_cents);

      // Post-tax deductions (Roth, garnishments, etc.)
      const postTaxDeductionsCents = entry.post_tax_deductions_cents ?? 0;

      // Net pay
      const totalEmployeeTaxCents = federalTaxCents + ss.employee + medicare.employee;
      const totalDeductionsCents = preTaxDeductionsCents + postTaxDeductionsCents;
      const netCents = grossCents - totalEmployeeTaxCents - totalDeductionsCents;

      // Employer cost
      const employerTaxCents = ss.employer + medicare.employer + futaCents + sutaCents;
      const totalEmployerCost = grossCents + employerTaxCents;

      totalGrossCents += grossCents;
      totalNetCents += netCents;
      totalEmployerCostCents += totalEmployerCost;

      results.push({
        employee_id: emp.id,
        employee_name: emp.name,
        pay_type: emp.pay_type,
        filing_status: emp.w4_filing_status,

        // Earnings breakdown
        earnings: {
          regular_pay_cents: regularPayCents,
          overtime_pay_cents: overtimePayCents,
          tips_cents: tipsCents,
          bonus_cents: bonusCents,
          gross_pay_cents: grossCents,
        },

        // Deductions
        deductions: {
          pre_tax_cents: preTaxDeductionsCents,
          post_tax_cents: postTaxDeductionsCents,
          total_deductions_cents: totalDeductionsCents,
        },

        // Employee taxes
        employee_taxes: {
          federal_income_tax_cents: federalTaxCents,
          social_security_cents: ss.employee,
          medicare_cents: medicare.employee,
          total_employee_tax_cents: totalEmployeeTaxCents,
        },

        // Employer taxes
        employer_taxes: {
          social_security_cents: ss.employer,
          medicare_cents: medicare.employer,
          futa_cents: futaCents,
          suta_cents: sutaCents,
          total_employer_tax_cents: employerTaxCents,
        },

        // Net pay
        net_pay_cents: netCents,
        total_employer_cost_cents: totalEmployerCost,

        // YTD context
        ytd_context: {
          ytd_gross_before_cents: emp.ytd_gross_cents,
          ytd_gross_after_cents: emp.ytd_gross_cents + grossCents,
          ss_wage_base_remaining_cents: Math.max(0, SS_WAGE_BASE_CENTS - emp.ytd_ss_wages_cents - taxableGrossCents),
          futa_wage_base_remaining_cents: Math.max(0, FUTA_WAGE_BASE_CENTS - emp.ytd_futa_wages_cents - taxableGrossCents),
          suta_wage_base_remaining_cents: Math.max(0, TX_SUTA_WAGE_BASE_CENTS - emp.ytd_suta_wages_cents - taxableGrossCents),
        },
      });
    }

    return NextResponse.json({
      pay_period: body.pay_period,
      pay_periods_per_year: payPeriodsPerYear,
      calculated_at: new Date().toISOString(),
      status: 'preview',
      note: 'This is a calculation preview. Use POST /api/payroll/runs to process and commit.',

      // Per-employee results
      employee_results: results,

      // Totals
      totals: {
        total_gross_cents: totalGrossCents,
        total_net_cents: totalNetCents,
        total_employee_taxes_cents: results.reduce(
          (sum, r) => sum + r.employee_taxes.total_employee_tax_cents, 0,
        ),
        total_employer_taxes_cents: results.reduce(
          (sum, r) => sum + r.employer_taxes.total_employer_tax_cents, 0,
        ),
        total_employer_cost_cents: totalEmployerCostCents,
        employee_count: results.length,
      },

      // Tax rates applied (for transparency)
      tax_rates_applied: {
        federal_brackets: '2026 brackets (10% / 12% / 22% / 24% / 32% / 35% / 37%)',
        ss_employee_rate: `${SS_RATE * 100}%`,
        ss_employer_rate: `${SS_RATE * 100}%`,
        ss_wage_base_cents: SS_WAGE_BASE_CENTS,
        medicare_rate: `${MEDICARE_RATE * 100}%`,
        medicare_additional_rate: `${MEDICARE_ADDITIONAL_RATE * 100}%`,
        medicare_additional_threshold_cents: MEDICARE_ADDITIONAL_THRESHOLD_CENTS,
        futa_rate: `${FUTA_RATE * 100}%`,
        futa_wage_base_cents: FUTA_WAGE_BASE_CENTS,
        tx_suta_rate: `${TX_SUTA_RATE * 100}%`,
        tx_suta_wage_base_cents: TX_SUTA_WAGE_BASE_CENTS,
        state: 'TX (no state income tax)',
      },

      // Errors
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to calculate payroll', detail: error.message },
      { status: 500 },
    );
  }
}
