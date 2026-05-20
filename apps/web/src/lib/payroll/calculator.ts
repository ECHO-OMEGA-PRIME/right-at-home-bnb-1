/**
 * Right at Home BnB - Gross-to-Net Payroll Calculator
 * Calculates employee paycheck with real 2026 tax math.
 * All monetary values in integer cents.
 */

import {
  calculateFederalIncomeTax,
  calculateSocialSecurityTax,
  calculateMedicareTax,
  calculateFUTATax,
  calculateTXSUTATax,
  SS_RATE,
  MEDICARE_RATE,
  type FilingStatus,
} from './tax-tables';
import { addCents } from '../utils/money';

// ============================================
// TYPES
// ============================================

export interface Employee {
  id: string;
  name: string;
  filingStatus: FilingStatus;
  allowances: number;
  hourlyRateCents: number;
  salaryAnnualCents?: number;
  payFrequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  ytdGrossCents: number;
  ytdFederalTaxCents: number;
  ytdSocialSecurityCents: number;
  ytdMedicareCents: number;
  ytdFutaCents: number;
  ytdSutaCents: number;
}

export interface PayrollInput {
  employee: Employee;
  hoursWorked: number;
  overtimeHours: number;
  bonusCents: number;
  deductionPreTaxCents: number;
  deductionPostTaxCents: number;
  payPeriodEnd: Date;
}

export interface PayStub {
  employeeId: string;
  employeeName: string;
  payPeriodEnd: string;

  // Earnings
  regularHours: number;
  overtimeHours: number;
  regularPayCents: number;
  overtimePayCents: number;
  bonusCents: number;
  grossPayCents: number;

  // Pre-tax deductions
  preTaxDeductionsCents: number;
  taxableGrossCents: number;

  // Employee withholdings
  federalIncomeTaxCents: number;
  socialSecurityEmployeeCents: number;
  medicareEmployeeCents: number;
  totalEmployeeWithholdingCents: number;

  // Post-tax deductions
  postTaxDeductionsCents: number;

  // Net pay
  netPayCents: number;

  // Employer taxes (not deducted from employee pay)
  socialSecurityEmployerCents: number;
  medicareEmployerCents: number;
  futaCents: number;
  sutaCents: number;
  totalEmployerTaxCents: number;

  // Total cost to employer
  totalCostToEmployerCents: number;

  // Year-to-date (after this check)
  ytdGrossCents: number;
  ytdFederalTaxCents: number;
  ytdSocialSecurityCents: number;
  ytdMedicareCents: number;
  ytdNetPayCents: number;
}

// ============================================
// PAY PERIODS
// ============================================

/**
 * Number of pay periods per year for each frequency.
 */
const PAY_PERIODS_PER_YEAR: Record<Employee['payFrequency'], number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

// ============================================
// GROSS PAY CALCULATION
// ============================================

/**
 * Calculate gross earnings from hours and rate.
 * Overtime pays at 1.5x the regular hourly rate per FLSA.
 */
function calculateGrossPay(
  hourlyRateCents: number,
  regularHours: number,
  overtimeHours: number,
  bonusCents: number
): {
  regularPayCents: number;
  overtimePayCents: number;
  grossPayCents: number;
} {
  const regularPayCents = Math.round(hourlyRateCents * regularHours);
  const overtimePayCents = Math.round(hourlyRateCents * 1.5 * overtimeHours);
  const grossPayCents = addCents(regularPayCents, overtimePayCents, bonusCents);

  return { regularPayCents, overtimePayCents, grossPayCents };
}

// ============================================
// MAIN CALCULATOR
// ============================================

/**
 * Calculate a complete pay stub from gross to net.
 *
 * Process:
 * 1. Calculate gross earnings (regular + overtime + bonus)
 * 2. Subtract pre-tax deductions (e.g., 401k, health insurance)
 * 3. Annualize wages for bracket-based tax calculations
 * 4. Calculate federal income tax withholding
 * 5. Calculate Social Security (employee + employer)
 * 6. Calculate Medicare (employee + employer)
 * 7. Calculate FUTA and SUTA (employer only)
 * 8. Subtract post-tax deductions (e.g., Roth 401k, garnishments)
 * 9. Arrive at net pay
 *
 * Texas has NO state income tax — the only state payroll tax is SUTA (employer).
 */
export function calculatePayroll(input: PayrollInput): PayStub {
  const { employee, hoursWorked, overtimeHours, bonusCents, deductionPreTaxCents, deductionPostTaxCents, payPeriodEnd } = input;

  // Step 1: Gross earnings
  const { regularPayCents, overtimePayCents, grossPayCents } = calculateGrossPay(
    employee.hourlyRateCents,
    hoursWorked,
    overtimeHours,
    bonusCents
  );

  // Step 2: Pre-tax deductions
  const taxableGrossCents = Math.max(0, grossPayCents - deductionPreTaxCents);

  // Step 3: Annualize for bracket calculations
  const periodsPerYear = PAY_PERIODS_PER_YEAR[employee.payFrequency];
  const annualizedWages = taxableGrossCents * periodsPerYear;

  // Step 4: Federal income tax (annualized, then de-annualized to per-period)
  const annualFederalTax = calculateFederalIncomeTax(
    annualizedWages,
    employee.filingStatus,
    employee.allowances
  );
  const federalIncomeTaxCents = Math.round(annualFederalTax / periodsPerYear);

  // Step 5: Social Security — employee side (6.2%, capped at SS wage base)
  // Use YTD to handle mid-year cap correctly
  const ssEmployeeCents = calculateSocialSecurityTax(taxableGrossCents, employee.ytdGrossCents);

  // Step 5b: Social Security — employer side (same rate, same cap)
  const ssEmployerCents = calculateSocialSecurityTax(taxableGrossCents, employee.ytdGrossCents);

  // Step 6: Medicare — employee side (1.45% + 0.9% surtax over $200K)
  const medicareEmployeeCents = calculateMedicareTax(taxableGrossCents, true);

  // Step 6b: Medicare — employer side (1.45%, NO surtax)
  const medicareEmployerCents = calculateMedicareTax(taxableGrossCents, false);

  // Step 7: FUTA (employer only, 0.6% on first $7,000)
  const futaCents = calculateFUTATax(taxableGrossCents, employee.ytdGrossCents);

  // Step 7b: Texas SUTA (employer only, 2.7% on first $9,000)
  const sutaCents = calculateTXSUTATax(taxableGrossCents, employee.ytdGrossCents);

  // Step 8: Total employee withholdings
  const totalEmployeeWithholdingCents = addCents(
    federalIncomeTaxCents,
    ssEmployeeCents,
    medicareEmployeeCents
  );

  // Step 9: Net pay
  const netPayCents = grossPayCents - deductionPreTaxCents - totalEmployeeWithholdingCents - deductionPostTaxCents;

  // Employer totals
  const totalEmployerTaxCents = addCents(
    ssEmployerCents,
    medicareEmployerCents,
    futaCents,
    sutaCents
  );

  const totalCostToEmployerCents = addCents(grossPayCents, totalEmployerTaxCents);

  // Year-to-date updates
  const ytdGrossCents = employee.ytdGrossCents + grossPayCents;
  const ytdFederalTaxCents = employee.ytdFederalTaxCents + federalIncomeTaxCents;
  const ytdSocialSecurityCents = employee.ytdSocialSecurityCents + ssEmployeeCents;
  const ytdMedicareCents = employee.ytdMedicareCents + medicareEmployeeCents;

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    payPeriodEnd: payPeriodEnd.toISOString().split('T')[0],

    regularHours: hoursWorked,
    overtimeHours,
    regularPayCents,
    overtimePayCents,
    bonusCents,
    grossPayCents,

    preTaxDeductionsCents: deductionPreTaxCents,
    taxableGrossCents,

    federalIncomeTaxCents,
    socialSecurityEmployeeCents: ssEmployeeCents,
    medicareEmployeeCents,
    totalEmployeeWithholdingCents,

    postTaxDeductionsCents: deductionPostTaxCents,

    netPayCents,

    socialSecurityEmployerCents: ssEmployerCents,
    medicareEmployerCents: medicareEmployerCents,
    futaCents,
    sutaCents,
    totalEmployerTaxCents,

    totalCostToEmployerCents,

    ytdGrossCents,
    ytdFederalTaxCents,
    ytdSocialSecurityCents,
    ytdMedicareCents,
    ytdNetPayCents: 0, // Would require full YTD tracking; placeholder for current check
  };
}

/**
 * Convenience: Calculate a salaried employee's pay stub.
 * Divides annual salary by pay periods to get per-period gross.
 */
export function calculateSalariedPayroll(
  employee: Employee & { salaryAnnualCents: number },
  payPeriodEnd: Date,
  options?: {
    bonusCents?: number;
    deductionPreTaxCents?: number;
    deductionPostTaxCents?: number;
  }
): PayStub {
  const periodsPerYear = PAY_PERIODS_PER_YEAR[employee.payFrequency];
  const perPeriodGross = Math.round(employee.salaryAnnualCents / periodsPerYear);

  // Back-calculate an effective hourly rate for display purposes
  // Assume 40 hours per period for salaried
  const effectiveHourlyRate = Math.round(perPeriodGross / 40);

  return calculatePayroll({
    employee: {
      ...employee,
      hourlyRateCents: effectiveHourlyRate,
    },
    hoursWorked: 40,
    overtimeHours: 0,
    bonusCents: options?.bonusCents ?? 0,
    deductionPreTaxCents: options?.deductionPreTaxCents ?? 0,
    deductionPostTaxCents: options?.deductionPostTaxCents ?? 0,
    payPeriodEnd,
  });
}

/**
 * Estimate the total annual cost of an employee to the employer.
 * Includes gross salary + all employer-side taxes.
 */
export function estimateAnnualEmployerCost(
  annualSalaryCents: number,
  sutaRate: number = 0.027
): {
  salaryCents: number;
  employerSSCents: number;
  employerMedicareCents: number;
  futaCents: number;
  sutaCents: number;
  totalAnnualCostCents: number;
} {
  const employerSSCents = Math.round(Math.min(annualSalaryCents, 17640000) * SS_RATE);
  const employerMedicareCents = Math.round(annualSalaryCents * MEDICARE_RATE);
  const futaCents = Math.round(Math.min(annualSalaryCents, 700000) * 0.006);
  const sutaCents = Math.round(Math.min(annualSalaryCents, 900000) * sutaRate);
  const totalAnnualCostCents = addCents(
    annualSalaryCents,
    employerSSCents,
    employerMedicareCents,
    futaCents,
    sutaCents
  );

  return {
    salaryCents: annualSalaryCents,
    employerSSCents,
    employerMedicareCents,
    futaCents,
    sutaCents,
    totalAnnualCostCents,
  };
}
