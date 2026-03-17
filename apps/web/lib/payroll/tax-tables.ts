/**
 * Right at Home BnB - 2026 Federal Tax Tables & Payroll Rates
 * Real IRS brackets, Social Security / Medicare / FUTA / SUTA rates.
 * All tax calculations operate on annual wages in integer cents.
 */

// ============================================
// TYPES
// ============================================

export interface TaxBracket {
  /** Lower bound of the bracket in cents (inclusive) */
  minCents: number;
  /** Upper bound of the bracket in cents (exclusive, Infinity for top bracket) */
  maxCents: number;
  /** Marginal rate as a decimal (e.g., 0.22 for 22%) */
  rate: number;
}

export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_of_household';

// ============================================
// 2026 FEDERAL INCOME TAX BRACKETS
// ============================================

/**
 * 2026 federal income tax brackets indexed by filing status.
 * Based on IRS Revenue Procedure inflation adjustments.
 * All thresholds are in integer cents.
 */
export const FEDERAL_BRACKETS_2026: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { minCents: 0,          maxCents: 1192500,    rate: 0.10 },  // $0 - $11,925
    { minCents: 1192500,    maxCents: 4847500,    rate: 0.12 },  // $11,925 - $48,475
    { minCents: 4847500,    maxCents: 10335000,   rate: 0.22 },  // $48,475 - $103,350
    { minCents: 10335000,   maxCents: 19740000,   rate: 0.24 },  // $103,350 - $197,400
    { minCents: 19740000,   maxCents: 25032500,   rate: 0.32 },  // $197,400 - $250,325
    { minCents: 25032500,   maxCents: 62650000,   rate: 0.35 },  // $250,325 - $626,350 (approx)
    { minCents: 62650000,   maxCents: Infinity,   rate: 0.37 },  // $626,350+
  ],
  married_joint: [
    { minCents: 0,          maxCents: 2385000,    rate: 0.10 },  // $0 - $23,850
    { minCents: 2385000,    maxCents: 9695000,    rate: 0.12 },  // $23,850 - $96,950
    { minCents: 9695000,    maxCents: 20670000,   rate: 0.22 },  // $96,950 - $206,700
    { minCents: 20670000,   maxCents: 39480000,   rate: 0.24 },  // $206,700 - $394,800
    { minCents: 39480000,   maxCents: 50065000,   rate: 0.32 },  // $394,800 - $500,650
    { minCents: 50065000,   maxCents: 75160000,   rate: 0.35 },  // $500,650 - $751,600 (approx)
    { minCents: 75160000,   maxCents: Infinity,   rate: 0.37 },  // $751,600+
  ],
  married_separate: [
    { minCents: 0,          maxCents: 1192500,    rate: 0.10 },
    { minCents: 1192500,    maxCents: 4847500,    rate: 0.12 },
    { minCents: 4847500,    maxCents: 10335000,   rate: 0.22 },
    { minCents: 10335000,   maxCents: 19740000,   rate: 0.24 },
    { minCents: 19740000,   maxCents: 25032500,   rate: 0.32 },
    { minCents: 25032500,   maxCents: 37580000,   rate: 0.35 },
    { minCents: 37580000,   maxCents: Infinity,   rate: 0.37 },
  ],
  head_of_household: [
    { minCents: 0,          maxCents: 1700000,    rate: 0.10 },  // $0 - $17,000
    { minCents: 1700000,    maxCents: 6475000,    rate: 0.12 },  // $17,000 - $64,750
    { minCents: 6475000,    maxCents: 10335000,   rate: 0.22 },  // $64,750 - $103,350
    { minCents: 10335000,   maxCents: 19740000,   rate: 0.24 },  // $103,350 - $197,400
    { minCents: 19740000,   maxCents: 25032500,   rate: 0.32 },  // $197,400 - $250,325
    { minCents: 25032500,   maxCents: 62650000,   rate: 0.35 },  // $250,325 - $626,350 (approx)
    { minCents: 62650000,   maxCents: Infinity,   rate: 0.37 },  // $626,350+
  ],
};

// ============================================
// FICA & UNEMPLOYMENT RATES
// ============================================

/** Social Security employee/employer tax rate (each side): 6.2% */
export const SS_RATE = 0.062;

/** Social Security annual wage base for 2026 (approx) in cents */
export const SS_WAGE_BASE = 17640000; // $176,400

/** Medicare employee/employer tax rate (each side): 1.45% */
export const MEDICARE_RATE = 0.0145;

/** Additional Medicare surtax on wages over $200K (employee only): 0.9% */
export const MEDICARE_SURTAX_RATE = 0.009;

/** Additional Medicare surtax threshold in cents */
export const MEDICARE_SURTAX_THRESHOLD = 20000000; // $200,000

/** Federal Unemployment Tax (FUTA) rate: 6.0% gross, effectively 0.6% after state credit */
export const FUTA_GROSS_RATE = 0.06;

/** FUTA credit for state UI payments (max 5.4%) */
export const FUTA_STATE_CREDIT = 0.054;

/** Effective FUTA rate after full state credit */
export const FUTA_RATE = FUTA_GROSS_RATE - FUTA_STATE_CREDIT; // 0.006 = 0.6%

/** FUTA annual wage base in cents */
export const FUTA_WAGE_BASE = 700000; // $7,000

/** Texas SUTA rate — varies by employer experience rating. Default for new employers. */
export const TX_SUTA_RATE = 0.027; // 2.7% (new employer default)

/** Texas SUTA annual wage base in cents */
export const TX_SUTA_WAGE_BASE = 900000; // $9,000

// ============================================
// STANDARD DEDUCTION (2026)
// ============================================

/** 2026 standard deduction by filing status, in cents */
export const STANDARD_DEDUCTION_2026: Record<FilingStatus, number> = {
  single: 1512500,            // $15,125
  married_joint: 3025000,     // $30,250
  married_separate: 1512500,  // $15,125
  head_of_household: 2268500, // $22,685
};

// ============================================
// WITHHOLDING ALLOWANCE
// ============================================

/**
 * Per-allowance reduction for W-4 withholding purposes (annual, in cents).
 * This is the approximate value of one personal/dependency exemption
 * used to reduce taxable wages for withholding calculations.
 * Post-2017 TCJA, allowances are less common, but still used by some systems.
 */
export const WITHHOLDING_ALLOWANCE_2026 = 490000; // ~$4,900

// ============================================
// TAX CALCULATION
// ============================================

/**
 * Calculate federal income tax on an annual taxable wage amount.
 *
 * @param annualWagesCents - Gross annual wages in integer cents
 * @param filingStatus - Filing status for bracket selection
 * @param allowances - Number of withholding allowances (W-4). Each reduces
 *   taxable wages by WITHHOLDING_ALLOWANCE_2026. Use 0 for post-2020 W-4.
 * @returns Annual federal income tax in integer cents
 */
export function calculateFederalIncomeTax(
  annualWagesCents: number,
  filingStatus: FilingStatus,
  allowances: number = 0
): number {
  // Reduce taxable wages by allowances
  const allowanceReduction = allowances * WITHHOLDING_ALLOWANCE_2026;
  const taxableWages = Math.max(0, annualWagesCents - allowanceReduction);

  const brackets = FEDERAL_BRACKETS_2026[filingStatus];
  if (!brackets) {
    throw new Error(`Invalid filing status: ${filingStatus}`);
  }

  let totalTax = 0;

  for (const bracket of brackets) {
    if (taxableWages <= bracket.minCents) {
      break;
    }

    const taxableInBracket = Math.min(taxableWages, bracket.maxCents) - bracket.minCents;
    totalTax += Math.round(taxableInBracket * bracket.rate);
  }

  return totalTax;
}

/**
 * Calculate the Social Security tax for an employee (or employer) on annual wages.
 * Capped at SS_WAGE_BASE.
 *
 * @param annualWagesCents - Gross annual wages in integer cents
 * @param ytdWagesCents - Year-to-date wages already subject to SS (for mid-year cap check)
 * @returns Social Security tax in integer cents
 */
export function calculateSocialSecurityTax(
  annualWagesCents: number,
  ytdWagesCents: number = 0
): number {
  const remainingBase = Math.max(0, SS_WAGE_BASE - ytdWagesCents);
  const taxableWages = Math.min(annualWagesCents, remainingBase);
  return Math.round(taxableWages * SS_RATE);
}

/**
 * Calculate Medicare tax for an employee on annual wages.
 * Includes the 0.9% Additional Medicare Tax on wages over $200K (employee only).
 *
 * @param annualWagesCents - Gross annual wages in integer cents
 * @param includeAdditional - Whether to include the 0.9% surtax (employee only, not employer)
 * @returns Medicare tax in integer cents
 */
export function calculateMedicareTax(
  annualWagesCents: number,
  includeAdditional: boolean = true
): number {
  let tax = Math.round(annualWagesCents * MEDICARE_RATE);

  if (includeAdditional && annualWagesCents > MEDICARE_SURTAX_THRESHOLD) {
    const surtaxableWages = annualWagesCents - MEDICARE_SURTAX_THRESHOLD;
    tax += Math.round(surtaxableWages * MEDICARE_SURTAX_RATE);
  }

  return tax;
}

/**
 * Calculate FUTA tax for an employer on annual wages.
 * Effective rate is 0.6% after the standard 5.4% state credit.
 * Capped at FUTA_WAGE_BASE ($7,000).
 *
 * @param annualWagesCents - Gross annual wages in integer cents
 * @param ytdWagesCents - Year-to-date wages already subject to FUTA
 * @returns FUTA tax in integer cents
 */
export function calculateFUTATax(
  annualWagesCents: number,
  ytdWagesCents: number = 0
): number {
  const remainingBase = Math.max(0, FUTA_WAGE_BASE - ytdWagesCents);
  const taxableWages = Math.min(annualWagesCents, remainingBase);
  return Math.round(taxableWages * FUTA_RATE);
}

/**
 * Calculate Texas SUTA tax for an employer on annual wages.
 * Texas has NO state income tax. SUTA is the only state payroll tax.
 *
 * @param annualWagesCents - Gross annual wages in integer cents
 * @param ytdWagesCents - Year-to-date wages already subject to SUTA
 * @param rate - Employer-specific SUTA rate (defaults to TX new employer rate 2.7%)
 * @returns Texas SUTA tax in integer cents
 */
export function calculateTXSUTATax(
  annualWagesCents: number,
  ytdWagesCents: number = 0,
  rate: number = TX_SUTA_RATE
): number {
  const remainingBase = Math.max(0, TX_SUTA_WAGE_BASE - ytdWagesCents);
  const taxableWages = Math.min(annualWagesCents, remainingBase);
  return Math.round(taxableWages * rate);
}
