/**
 * Right at Home BnB - Integer Cents Math Utilities
 * All monetary calculations use integer cents to avoid floating-point errors.
 * Never store or compute with fractional dollars directly.
 */

/**
 * Convert a dollar amount to integer cents.
 * Uses Math.round to handle floating-point imprecision (e.g., 19.99 * 100).
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert integer cents to a dollar amount for display.
 * Returns a number with up to 2 decimal places.
 */
export function toDollars(cents: number): number {
  return cents / 100;
}

/**
 * Format integer cents as a USD currency string.
 * Examples: formatMoney(123456) => "$1,234.56", formatMoney(-500) => "-$5.00"
 */
export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  const dollarsFormatted = dollars.toLocaleString('en-US');
  const centsFormatted = remainder.toString().padStart(2, '0');
  return `${negative ? '-' : ''}$${dollarsFormatted}.${centsFormatted}`;
}

/**
 * Safely add multiple cent amounts together.
 * All values must already be integer cents.
 */
export function addCents(...amounts: number[]): number {
  let total = 0;
  for (const amount of amounts) {
    total += amount;
  }
  return total;
}

/**
 * Subtract b from a in cents.
 */
export function subtractCents(a: number, b: number): number {
  return a - b;
}

/**
 * Multiply a cent amount by a scalar multiplier.
 * Rounds the result to the nearest cent.
 */
export function multiplyCents(cents: number, multiplier: number): number {
  return Math.round(cents * multiplier);
}

/**
 * Calculate a percentage of a cent amount.
 * percent is expressed as a number (e.g., 2.9 for 2.9%).
 * Example: percentOf(10000, 2.9) => 290
 */
export function percentOf(cents: number, percent: number): number {
  return Math.round(cents * (percent / 100));
}

/**
 * Split a cent amount evenly N ways.
 * Distributes the remainder one cent at a time to the first recipients.
 * The sum of the returned array always equals the original cents.
 *
 * Example: splitCents(1000, 3) => [334, 333, 333]
 */
export function splitCents(cents: number, ways: number): number[] {
  if (ways <= 0) {
    throw new Error('Cannot split cents into zero or negative parts');
  }
  if (ways === 1) {
    return [cents];
  }

  const base = Math.floor(cents / ways);
  const remainder = cents - base * ways;

  const result: number[] = [];
  for (let i = 0; i < ways; i++) {
    result.push(base + (i < remainder ? 1 : 0));
  }
  return result;
}
