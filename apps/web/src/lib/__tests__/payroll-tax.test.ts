/**
 * Payroll tax engine tests.
 *
 * Two properties matter most here:
 *  1. Employer contributions must NEVER be subtracted from an employee's gross.
 *     They are a business cost, not a withholding, and conflating them
 *     understates take-home pay on every paycheck.
 *  2. Wage-base taxes must stop at their cap. Without YTD context, FUTA and
 *     SUTA get over-collected all year and Social Security never stops.
 */

import { describe, expect, it } from 'vitest';

import {
  FUTA_WAGE_BASE_CENTS,
  MEDICARE_ADDITIONAL_THRESHOLD_CENTS,
  SS_WAGE_BASE_CENTS,
  TX_SUTA_WAGE_BASE_CENTS,
  ZERO_YTD,
  computeFUTACents,
  computeMedicareCents,
  computeSSCents,
  computeSUTACents,
  computePay,
} from '../payroll-tax';

describe('statutory rates', () => {
  it('social security is 6.2% for both sides below the cap', () => {
    const ss = computeSSCents(100000, 0);
    expect(ss.employee).toBe(6200);
    expect(ss.employer).toBe(6200);
  });

  it('medicare is 1.45%', () => {
    expect(computeMedicareCents(100000, 0).employee).toBe(1450);
  });

  it('rounds to whole cents rather than carrying fractions', () => {
    expect(Number.isInteger(computeMedicareCents(12345, 0).employee)).toBe(true);
    expect(Number.isInteger(computeSSCents(12345, 0).employee)).toBe(true);
  });
});

describe('wage bases', () => {
  it('social security stops once the annual wage base is reached', () => {
    const ss = computeSSCents(500000, SS_WAGE_BASE_CENTS);
    expect(ss.employee).toBe(0);
    expect(ss.taxable_wages_cents).toBe(0);
  });

  it('social security taxes only the part of the cheque below the cap', () => {
    // $1,000 remaining under the cap, $2,000 cheque -> only $1,000 is taxable.
    const ss = computeSSCents(200000, SS_WAGE_BASE_CENTS - 100000);
    expect(ss.taxable_wages_cents).toBe(100000);
    expect(ss.employee).toBe(Math.round(100000 * 0.062));
  });

  it('FUTA stops at the $7,000 wage base', () => {
    expect(computeFUTACents(500000, FUTA_WAGE_BASE_CENTS)).toBe(0);
    expect(computeFUTACents(500000, 0)).toBe(Math.round(500000 * 0.006));
  });

  it('SUTA stops at the Texas $9,000 wage base', () => {
    expect(computeSUTACents(500000, TX_SUTA_WAGE_BASE_CENTS)).toBe(0);
    expect(computeSUTACents(500000, 0)).toBe(Math.round(500000 * 0.027));
  });

  it('medicare has NO wage base -- it applies to every dollar', () => {
    expect(computeMedicareCents(100000, 99_000_000).employee).toBeGreaterThan(0);
  });

  it('the additional medicare surcharge is employee-only', () => {
    const m = computeMedicareCents(100000, MEDICARE_ADDITIONAL_THRESHOLD_CENTS);
    expect(m.employee).toBeGreaterThan(m.employer);
    expect(m.employer).toBe(Math.round(100000 * 0.0145));
  });
});

describe('computePay', () => {
  const gross = 200000; // $2,000 for the period

  it('net = gross minus employee deductions only', () => {
    const p = computePay(gross);
    expect(p.netCents).toBe(gross - p.totalDeductionsCents);
  });

  it('does NOT deduct employer contributions from net', () => {
    const p = computePay(gross);
    // The bug this guards: netting employer SS/Medicare/FUTA/SUTA off gross.
    const wrongNet = gross - p.totalDeductionsCents - p.employerTotalCents;
    expect(p.netCents).not.toBe(wrongNet);
    expect(p.netCents).toBeGreaterThan(wrongNet);
  });

  it('employer matches employee SS, and Medicare below the surcharge', () => {
    const p = computePay(gross);
    expect(p.employerSsCents).toBe(p.socialSecurityCents);
    expect(p.employerMedicareCents).toBe(p.medicareCents);
  });

  it('totalDeductions is the sum of its parts', () => {
    const p = computePay(gross, { stateWithholdingCents: 5000 });
    expect(p.totalDeductionsCents).toBe(
      p.federalCents +
        p.socialSecurityCents +
        p.medicareCents +
        p.stateCents +
        p.preTaxDeductionsCents +
        p.postTaxDeductionsCents,
    );
  });

  it('employerTotal is the sum of its parts', () => {
    const p = computePay(gross);
    expect(p.employerTotalCents).toBe(
      p.employerSsCents + p.employerMedicareCents + p.futaCents + p.sutaCents,
    );
  });

  it('state withholding defaults to zero (Texas has no state income tax)', () => {
    expect(computePay(gross).stateCents).toBe(0);
  });

  it('honours an explicit state withholding when operating outside TX', () => {
    const p = computePay(gross, { stateWithholdingCents: 7500 });
    expect(p.stateCents).toBe(7500);
    expect(p.netCents).toBe(gross - p.totalDeductionsCents);
  });

  it('pre-tax deductions reduce the wages taxes are computed on', () => {
    const plain = computePay(gross);
    const withPreTax = computePay(gross, { preTaxDeductionsCents: 20000 });
    expect(withPreTax.taxableGrossCents).toBe(gross - 20000);
    expect(withPreTax.federalCents).toBeLessThan(plain.federalCents);
    expect(withPreTax.socialSecurityCents).toBeLessThan(plain.socialSecurityCents);
  });

  it('post-tax deductions reduce net but NOT the taxable wage', () => {
    const plain = computePay(gross);
    const withPostTax = computePay(gross, { postTaxDeductionsCents: 20000 });
    expect(withPostTax.taxableGrossCents).toBe(gross);
    expect(withPostTax.federalCents).toBe(plain.federalCents);
    expect(withPostTax.netCents).toBe(plain.netCents - 20000);
  });

  it('married filing status withholds less federal than single at equal gross', () => {
    const single = computePay(gross, { filingStatus: 'single' });
    const married = computePay(gross, { filingStatus: 'married' });
    expect(married.federalCents).toBeLessThan(single.federalCents);
  });

  it('YTD wages at the caps zero out FUTA and SUTA', () => {
    const p = computePay(gross, {
      ytd: {
        grossCents: 5_000_000,
        ssWagesCents: 0,
        futaWagesCents: FUTA_WAGE_BASE_CENTS,
        sutaWagesCents: TX_SUTA_WAGE_BASE_CENTS,
      },
    });
    expect(p.futaCents).toBe(0);
    expect(p.sutaCents).toBe(0);
    // ...but Social Security is still owed, because its own cap is far higher.
    expect(p.socialSecurityCents).toBeGreaterThan(0);
  });

  it('defaults to a zero YTD, which is only correct for a first paycheck', () => {
    const p = computePay(gross);
    const explicit = computePay(gross, { ytd: ZERO_YTD });
    expect(p).toEqual(explicit);
    expect(p.futaCents).toBeGreaterThan(0);
  });

  it('every returned amount is a whole number of cents', () => {
    const p = computePay(123457);
    for (const [k, v] of Object.entries(p)) {
      expect(Number.isInteger(v), `${k} must be integer cents`).toBe(true);
    }
  });

  it('zero gross produces zero everything, not NaN', () => {
    const p = computePay(0);
    expect(p.netCents).toBe(0);
    expect(p.employerTotalCents).toBe(0);
    expect(p.federalCents).toBe(0);
  });
});
