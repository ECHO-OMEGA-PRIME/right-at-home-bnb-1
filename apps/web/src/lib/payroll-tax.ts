/**
 * Payroll tax engine -- the single source of withholding maths.
 *
 * Two engines used to exist: a simplified one inside /api/payroll/runs and a
 * considerably more correct one inside /api/payroll/calculate. They disagreed,
 * which meant the "preview" a manager approved and the run that was actually
 * committed could quote different net pay for the same period.
 *
 * This module is the /api/payroll/calculate engine, lifted intact and made
 * shared, because it is the better of the two: it honours wage bases, filing
 * status, the standard deduction, and the additional Medicare surcharge.
 *
 * These are still simplified federal rules, not a substitute for a payroll
 * provider's engine. They model a run honestly; they are NOT a filing
 * authority.
 */

// ── 2026 federal brackets (cents) ────────────────────────────────────────

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

// ── Statutory constants (cents) ──────────────────────────────────────────

export const SS_RATE = 0.062;
export const SS_WAGE_BASE_CENTS = 17610000; // $176,100
export const MEDICARE_RATE = 0.0145;
export const MEDICARE_ADDITIONAL_THRESHOLD_CENTS = 20000000; // $200,000
export const MEDICARE_ADDITIONAL_RATE = 0.009;
export const FUTA_RATE = 0.006;
export const FUTA_WAGE_BASE_CENTS = 700000; // $7,000
export const TX_SUTA_RATE = 0.027;
export const TX_SUTA_WAGE_BASE_CENTS = 900000; // $9,000
export const STANDARD_DEDUCTION_SINGLE_CENTS = 1550000; // $15,500
export const STANDARD_DEDUCTION_MARRIED_CENTS = 3100000; // $31,000

/** Federal income tax withholding for one pay period. */
export function computeFederalTaxCents(
  periodGrossCents: number,
  filingStatus: string,
  payPeriodsPerYear: number,
): number {
  const brackets = filingStatus === 'married' ? MARRIED_BRACKETS : SINGLE_BRACKETS;
  const standardDeduction =
    filingStatus === 'married'
      ? STANDARD_DEDUCTION_MARRIED_CENTS
      : STANDARD_DEDUCTION_SINGLE_CENTS;

  const annualizedGross = periodGrossCents * payPeriodsPerYear;
  const taxableIncome = Math.max(0, annualizedGross - standardDeduction);

  let annualTax = 0;
  let remaining = taxableIncome;
  for (const bracket of brackets) {
    const bracketWidth = bracket.max - bracket.min;
    const taxable = Math.min(remaining, bracketWidth);
    annualTax += Math.round(taxable * bracket.rate);
    remaining -= taxable;
    if (remaining <= 0) break;
  }

  return Math.round(annualTax / payPeriodsPerYear);
}

/** Social Security, capped at the annual wage base. */
export function computeSSCents(
  periodGrossCents: number,
  ytdSSWagesCents: number,
): { employee: number; employer: number; taxable_wages_cents: number } {
  const remainingBase = Math.max(0, SS_WAGE_BASE_CENTS - ytdSSWagesCents);
  const taxableWages = Math.min(periodGrossCents, remainingBase);
  return {
    employee: Math.round(taxableWages * SS_RATE),
    employer: Math.round(taxableWages * SS_RATE),
    taxable_wages_cents: taxableWages,
  };
}

/** Medicare, including the employee-only surcharge above the threshold. */
export function computeMedicareCents(
  periodGrossCents: number,
  ytdGrossCents: number,
): { employee: number; employer: number } {
  const baseMedicare = Math.round(periodGrossCents * MEDICARE_RATE);

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
    employer: baseMedicare, // employer does NOT pay the additional Medicare
  };
}

/** FUTA -- employer only, capped at $7,000 of wages per employee per year. */
export function computeFUTACents(periodGrossCents: number, ytdFutaWagesCents: number): number {
  const remainingBase = Math.max(0, FUTA_WAGE_BASE_CENTS - ytdFutaWagesCents);
  return Math.round(Math.min(periodGrossCents, remainingBase) * FUTA_RATE);
}

/** Texas SUTA -- employer only, capped at $9,000 of wages per employee per year. */
export function computeSUTACents(periodGrossCents: number, ytdSutaWagesCents: number): number {
  const remainingBase = Math.max(0, TX_SUTA_WAGE_BASE_CENTS - ytdSutaWagesCents);
  return Math.round(Math.min(periodGrossCents, remainingBase) * TX_SUTA_RATE);
}

// ── Whole-paycheck computation ───────────────────────────────────────────

/**
 * Year-to-date wages BEFORE this period.
 *
 * Wage-base taxes are wrong without it: default all-zero YTD makes every
 * paycheck look like the employee's first of the year, which over-collects
 * FUTA and SUTA and never stops Social Security at the cap.
 */
export interface YtdWages {
  grossCents: number;
  ssWagesCents: number;
  futaWagesCents: number;
  sutaWagesCents: number;
}

export const ZERO_YTD: YtdWages = {
  grossCents: 0,
  ssWagesCents: 0,
  futaWagesCents: 0,
  sutaWagesCents: 0,
};

export interface ComputePayOptions {
  /** 'single' | 'married'. Anything else is treated as single. */
  filingStatus?: string;
  payPeriodsPerYear?: number;
  preTaxDeductionsCents?: number;
  postTaxDeductionsCents?: number;
  /** Texas has none; the field exists so the shape survives outside TX. */
  stateWithholdingCents?: number;
  ytd?: YtdWages;
}

export interface PayComputation {
  grossCents: number;
  taxableGrossCents: number;
  federalCents: number;
  socialSecurityCents: number;
  medicareCents: number;
  stateCents: number;
  preTaxDeductionsCents: number;
  postTaxDeductionsCents: number;
  /** Employee taxes + elective deductions -- everything withheld from gross. */
  totalDeductionsCents: number;
  netCents: number;
  employerSsCents: number;
  employerMedicareCents: number;
  futaCents: number;
  sutaCents: number;
  employerTotalCents: number;
}

/**
 * One employee's pay for one period.
 *
 * Employer contributions are returned SEPARATELY from deductions. They are a
 * cost to the business, not money withheld from the worker, and netting them
 * off gross would understate take-home pay.
 */
export function computePay(
  grossCents: number,
  opts: ComputePayOptions = {},
): PayComputation {
  const {
    filingStatus = 'single',
    payPeriodsPerYear = 26,
    preTaxDeductionsCents = 0,
    postTaxDeductionsCents = 0,
    stateWithholdingCents = 0,
    ytd = ZERO_YTD,
  } = opts;

  // Pre-tax deductions (401k, HSA) reduce the wages taxes are computed on.
  const taxableGrossCents = Math.max(0, grossCents - preTaxDeductionsCents);

  const federalCents = computeFederalTaxCents(
    taxableGrossCents,
    filingStatus,
    payPeriodsPerYear,
  );
  const ss = computeSSCents(taxableGrossCents, ytd.ssWagesCents);
  const medicare = computeMedicareCents(taxableGrossCents, ytd.grossCents);
  const futaCents = computeFUTACents(taxableGrossCents, ytd.futaWagesCents);
  const sutaCents = computeSUTACents(taxableGrossCents, ytd.sutaWagesCents);

  const totalDeductionsCents =
    federalCents +
    ss.employee +
    medicare.employee +
    stateWithholdingCents +
    preTaxDeductionsCents +
    postTaxDeductionsCents;

  const employerTotalCents =
    ss.employer + medicare.employer + futaCents + sutaCents;

  return {
    grossCents,
    taxableGrossCents,
    federalCents,
    socialSecurityCents: ss.employee,
    medicareCents: medicare.employee,
    stateCents: stateWithholdingCents,
    preTaxDeductionsCents,
    postTaxDeductionsCents,
    totalDeductionsCents,
    netCents: grossCents - totalDeductionsCents,
    employerSsCents: ss.employer,
    employerMedicareCents: medicare.employer,
    futaCents,
    sutaCents,
    employerTotalCents,
  };
}
