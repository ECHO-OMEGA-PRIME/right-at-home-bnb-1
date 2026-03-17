import { NextRequest, NextResponse } from 'next/server';

// ── Payroll employee lookup (mirrors payroll/employees store) ─────────────

const employees: any[] = [
  {
    id: 'EMP-001', name: 'Maria Garcia', role: 'cleaner',
    pay_type: 'hourly', rate_cents: 1800,
    w4_filing_status: 'single', w4_allowances: 1,
    ytd_gross_cents: 1944000, ytd_ss_wages_cents: 1944000,
    ytd_futa_wages_cents: 700000, ytd_suta_wages_cents: 900000,
  },
  {
    id: 'EMP-002', name: 'James Wilson', role: 'maintenance',
    pay_type: 'hourly', rate_cents: 2200,
    w4_filing_status: 'married', w4_allowances: 3,
    ytd_gross_cents: 2288000, ytd_ss_wages_cents: 2288000,
    ytd_futa_wages_cents: 700000, ytd_suta_wages_cents: 900000,
  },
  {
    id: 'EMP-003', name: 'Lisa Chen', role: 'manager',
    pay_type: 'salary', rate_cents: 520000,
    w4_filing_status: 'single', w4_allowances: 1,
    ytd_gross_cents: 2600000, ytd_ss_wages_cents: 2600000,
    ytd_futa_wages_cents: 700000, ytd_suta_wages_cents: 900000,
  },
  {
    id: 'EMP-004', name: 'Carlos Ramirez', role: 'cleaner',
    pay_type: 'hourly', rate_cents: 1600,
    w4_filing_status: 'single', w4_allowances: 1,
    ytd_gross_cents: 832000, ytd_ss_wages_cents: 832000,
    ytd_futa_wages_cents: 700000, ytd_suta_wages_cents: 832000,
  },
];

// ── 2026 Federal Income Tax Brackets (Single) ────────────────────────────

const SINGLE_BRACKETS = [
  { min: 0, max: 1192500, rate: 0.10 },
  { min: 1192500, max: 4847500, rate: 0.12 },
  { min: 4847500, max: 10335000, rate: 0.22 },
  { min: 10335000, max: 19700000, rate: 0.24 },
  { min: 19700000, max: 24375000, rate: 0.32 },
  { min: 24375000, max: 62650000, rate: 0.35 },
  { min: 62650000, max: Infinity, rate: 0.37 },
];

const MARRIED_BRACKETS = [
  { min: 0, max: 2385000, rate: 0.10 },
  { min: 2385000, max: 9695000, rate: 0.12 },
  { min: 9695000, max: 20670000, rate: 0.22 },
  { min: 20670000, max: 39400000, rate: 0.24 },
  { min: 39400000, max: 48750000, rate: 0.32 },
  { min: 48750000, max: 76350000, rate: 0.35 },
  { min: 76350000, max: Infinity, rate: 0.37 },
];

// ── Tax Constants (all in cents) ─────────────────────────────────────────

const SS_RATE = 0.062;
const SS_WAGE_BASE_CENTS = 17610000; // $176,100
const MEDICARE_RATE = 0.0145;
const MEDICARE_ADDITIONAL_THRESHOLD_CENTS = 20000000; // $200,000
const MEDICARE_ADDITIONAL_RATE = 0.009;
const FUTA_RATE = 0.006;
const FUTA_WAGE_BASE_CENTS = 700000; // $7,000
const TX_SUTA_RATE = 0.027;
const TX_SUTA_WAGE_BASE_CENTS = 900000; // $9,000
const STANDARD_DEDUCTION_SINGLE_CENTS = 1550000; // $15,500
const STANDARD_DEDUCTION_MARRIED_CENTS = 3100000; // $31,000

// ── Helper: Annualize pay period gross to compute per-period fed tax ─────

function computeFederalTaxCents(
  periodGrossCents: number,
  filingStatus: string,
  payPeriodsPerYear: number,
): number {
  const brackets = filingStatus === 'married' ? MARRIED_BRACKETS : SINGLE_BRACKETS;
  const standardDeduction = filingStatus === 'married'
    ? STANDARD_DEDUCTION_MARRIED_CENTS
    : STANDARD_DEDUCTION_SINGLE_CENTS;

  // Annualize, subtract standard deduction
  const annualizedGross = periodGrossCents * payPeriodsPerYear;
  const taxableIncome = Math.max(0, annualizedGross - standardDeduction);

  // Progressive bracket calculation
  let annualTax = 0;
  let remaining = taxableIncome;

  for (const bracket of brackets) {
    const bracketWidth = bracket.max - bracket.min;
    const taxable = Math.min(remaining, bracketWidth);
    annualTax += Math.round(taxable * bracket.rate);
    remaining -= taxable;
    if (remaining <= 0) break;
  }

  // De-annualize to per-period
  return Math.round(annualTax / payPeriodsPerYear);
}

// ── Helper: Compute SS tax respecting wage base ──────────────────────────

function computeSSCents(periodGrossCents: number, ytdSSWagesCents: number): {
  employee: number;
  employer: number;
  taxable_wages_cents: number;
} {
  const remainingBase = Math.max(0, SS_WAGE_BASE_CENTS - ytdSSWagesCents);
  const taxableWages = Math.min(periodGrossCents, remainingBase);
  return {
    employee: Math.round(taxableWages * SS_RATE),
    employer: Math.round(taxableWages * SS_RATE),
    taxable_wages_cents: taxableWages,
  };
}

// ── Helper: Compute Medicare tax with additional surcharge ────────────────

function computeMedicareCents(
  periodGrossCents: number,
  ytdGrossCents: number,
): { employee: number; employer: number } {
  const baseMedicare = Math.round(periodGrossCents * MEDICARE_RATE);

  // Additional Medicare Tax (employee-only) on wages > $200K
  let additionalMedicare = 0;
  if (ytdGrossCents + periodGrossCents > MEDICARE_ADDITIONAL_THRESHOLD_CENTS) {
    const overThreshold = Math.max(
      0,
      ytdGrossCents + periodGrossCents - MEDICARE_ADDITIONAL_THRESHOLD_CENTS,
    );
    const periodOverThreshold = Math.min(periodGrossCents, overThreshold);
    additionalMedicare = Math.round(periodOverThreshold * MEDICARE_ADDITIONAL_RATE);
  }

  return {
    employee: baseMedicare + additionalMedicare,
    employer: baseMedicare, // employer does NOT pay additional Medicare
  };
}

// ── Helper: FUTA (employer only, wage base $7,000) ───────────────────────

function computeFUTACents(periodGrossCents: number, ytdFutaWagesCents: number): number {
  const remainingBase = Math.max(0, FUTA_WAGE_BASE_CENTS - ytdFutaWagesCents);
  const taxableWages = Math.min(periodGrossCents, remainingBase);
  return Math.round(taxableWages * FUTA_RATE);
}

// ── Helper: TX SUTA (employer only, wage base $9,000) ────────────────────

function computeSUTACents(periodGrossCents: number, ytdSutaWagesCents: number): number {
  const remainingBase = Math.max(0, TX_SUTA_WAGE_BASE_CENTS - ytdSutaWagesCents);
  const taxableWages = Math.min(periodGrossCents, remainingBase);
  return Math.round(taxableWages * TX_SUTA_RATE);
}

// ── POST /api/payroll/calculate ──────────────────────────────────────────

export async function POST(request: NextRequest) {
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
