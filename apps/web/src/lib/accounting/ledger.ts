/**
 * Right at Home BnB - Double-Entry Bookkeeping Ledger
 * Creates balanced journal entries, posts revenue/expense/payroll transactions,
 * and generates trial balances. Uses the Setting model as a journal_entries store
 * since the Prisma schema doesn't have dedicated accounting tables.
 *
 * Journal entries are stored as JSON in Settings with key prefix "je:".
 * Each entry has lines that must balance (total debits = total credits).
 */

import prisma from '../../src/lib/prisma';
import { isValidAccountCode, getAccount } from './chart-of-accounts';
import { toCents, addCents } from '../utils/money';

// ============================================
// TYPES
// ============================================

export interface JournalLine {
  accountCode: string;
  description: string;
  debitCents: number;
  creditCents: number;
}

export interface JournalEntryData {
  id: string;
  date: string;
  description: string;
  refType: string;
  refId?: string;
  propertyId?: string;
  lines: JournalLine[];
  createdAt: string;
}

export interface BookingForRevenue {
  id: string;
  propertyId: string;
  totalPrice: number;
  cleaningFee?: number | null;
  taxes?: number | null;
  checkIn: Date;
}

export interface PayrollRun {
  id: string;
  employeeName: string;
  payPeriodEnd: Date;
  grossCents: number;
  federalIncomeTaxCents: number;
  ssEmployeeCents: number;
  ssEmployerCents: number;
  medicareEmployeeCents: number;
  medicareEmployerCents: number;
  futaCents: number;
  sutaCents: number;
  netCents: number;
}

export interface TrialBalanceRow {
  accountCode: string;
  name: string;
  debitBalance: number;
  creditBalance: number;
}

// ============================================
// CORE JOURNAL ENTRY CREATION
// ============================================

/**
 * Create a balanced journal entry.
 * Validates that:
 * - All account codes are valid
 * - Total debits equal total credits
 * - Each line has either a debit or credit (not both)
 *
 * Stores the entry as a JSON Setting with key "je:{id}".
 */
export async function createJournalEntry(params: {
  date: Date;
  description: string;
  refType: string;
  refId?: string;
  propertyId?: string;
  lines: JournalLine[];
}): Promise<string> {
  const { date, description, refType, refId, propertyId, lines } = params;

  // Validate account codes
  for (const line of lines) {
    if (!isValidAccountCode(line.accountCode)) {
      throw new Error(`Invalid account code: ${line.accountCode}`);
    }
    if (line.debitCents < 0 || line.creditCents < 0) {
      throw new Error('Debit and credit amounts must be non-negative');
    }
    if (line.debitCents > 0 && line.creditCents > 0) {
      throw new Error(`Line for account ${line.accountCode} cannot have both debit and credit`);
    }
  }

  // Validate balance
  const totalDebits = lines.reduce((sum, l) => sum + l.debitCents, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.creditCents, 0);
  if (totalDebits !== totalCredits) {
    throw new Error(
      `Journal entry does not balance: debits=${totalDebits}, credits=${totalCredits}`
    );
  }

  if (totalDebits === 0) {
    throw new Error('Journal entry must have a non-zero amount');
  }

  // Generate entry ID
  const entryId = `je_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const entryData: JournalEntryData = {
    id: entryId,
    date: date.toISOString(),
    description,
    refType,
    refId,
    propertyId,
    lines,
    createdAt: new Date().toISOString(),
  };

  await prisma.setting.create({
    data: {
      key: `je:${entryId}`,
      value: JSON.stringify(entryData),
      description: `Journal Entry: ${description}`,
    },
  });

  // Also log to audit trail
  await prisma.auditLog.create({
    data: {
      action: 'CREATE',
      entity: 'JournalEntry',
      entityId: entryId,
      newValues: JSON.stringify({ description, refType, refId, totalDebits }),
    },
  });

  return entryId;
}

// ============================================
// BOOKING REVENUE POSTING
// ============================================

/**
 * Post revenue for a completed booking.
 * Creates a journal entry:
 *   Debit 1100 Accounts Receivable (total price)
 *   Credit 4000 Rental Revenue (room revenue)
 *   Credit 4010 Cleaning Fee Revenue (if applicable)
 *   Credit 2300 Occupancy Tax Payable (taxes collected)
 */
export async function postBookingRevenue(booking: BookingForRevenue): Promise<string> {
  const totalCents = toCents(booking.totalPrice);
  const cleaningFeeCents = booking.cleaningFee ? toCents(booking.cleaningFee) : 0;
  const taxCents = booking.taxes ? toCents(booking.taxes) : 0;
  const rentalRevenueCents = totalCents - cleaningFeeCents - taxCents;

  const lines: JournalLine[] = [
    {
      accountCode: '1100',
      description: `Booking ${booking.id} - Guest receivable`,
      debitCents: totalCents,
      creditCents: 0,
    },
    {
      accountCode: '4000',
      description: `Booking ${booking.id} - Rental revenue`,
      debitCents: 0,
      creditCents: rentalRevenueCents,
    },
  ];

  if (cleaningFeeCents > 0) {
    lines.push({
      accountCode: '4010',
      description: `Booking ${booking.id} - Cleaning fee`,
      debitCents: 0,
      creditCents: cleaningFeeCents,
    });
  }

  if (taxCents > 0) {
    lines.push({
      accountCode: '2300',
      description: `Booking ${booking.id} - Occupancy tax`,
      debitCents: 0,
      creditCents: taxCents,
    });
  }

  return createJournalEntry({
    date: booking.checkIn,
    description: `Revenue for booking ${booking.id}`,
    refType: 'booking',
    refId: booking.id,
    propertyId: booking.propertyId,
    lines,
  });
}

// ============================================
// EXPENSE POSTING
// ============================================

/**
 * Post an expense to the ledger.
 * Creates a journal entry:
 *   Debit [expense account code] (the expense)
 *   Credit 2000 Accounts Payable (or 1010 if paid immediately)
 */
export async function postExpense(expense: {
  amount_cents: number;
  accountCode: string;
  description: string;
  date: Date;
  propertyId?: string;
  paidImmediately?: boolean;
}): Promise<string> {
  const creditAccount = expense.paidImmediately ? '1010' : '2000';

  return createJournalEntry({
    date: expense.date,
    description: expense.description,
    refType: 'expense',
    propertyId: expense.propertyId,
    lines: [
      {
        accountCode: expense.accountCode,
        description: expense.description,
        debitCents: expense.amount_cents,
        creditCents: 0,
      },
      {
        accountCode: creditAccount,
        description: expense.description,
        debitCents: 0,
        creditCents: expense.amount_cents,
      },
    ],
  });
}

// ============================================
// PAYROLL POSTING
// ============================================

/**
 * Post a payroll run to the ledger.
 * Creates journal entries for:
 *   Debit 6000 Wages & Salaries (gross pay)
 *   Debit 6010 Payroll Tax - SS (employer portion)
 *   Debit 6020 Payroll Tax - Medicare (employer portion)
 *   Debit 6030 Payroll Tax - FUTA
 *   Debit 6040 Payroll Tax - SUTA
 *   Credit 1010 Business Checking (net pay)
 *   Credit 2200 Federal Income Tax Payable
 *   Credit 2210 Social Security Tax Payable (employee + employer)
 *   Credit 2220 Medicare Tax Payable (employee + employer)
 *   Credit 2230 FUTA Payable
 *   Credit 2240 SUTA Payable
 */
export async function postPayroll(payroll: PayrollRun): Promise<string> {
  const totalSS = addCents(payroll.ssEmployeeCents, payroll.ssEmployerCents);
  const totalMedicare = addCents(payroll.medicareEmployeeCents, payroll.medicareEmployerCents);
  const totalEmployerTax = addCents(
    payroll.ssEmployerCents,
    payroll.medicareEmployerCents,
    payroll.futaCents,
    payroll.sutaCents
  );

  const lines: JournalLine[] = [
    // DEBITS: expense accounts
    {
      accountCode: '6000',
      description: `Gross wages - ${payroll.employeeName}`,
      debitCents: payroll.grossCents,
      creditCents: 0,
    },
    {
      accountCode: '6010',
      description: `Employer SS - ${payroll.employeeName}`,
      debitCents: payroll.ssEmployerCents,
      creditCents: 0,
    },
    {
      accountCode: '6020',
      description: `Employer Medicare - ${payroll.employeeName}`,
      debitCents: payroll.medicareEmployerCents,
      creditCents: 0,
    },
    {
      accountCode: '6030',
      description: `FUTA - ${payroll.employeeName}`,
      debitCents: payroll.futaCents,
      creditCents: 0,
    },
    {
      accountCode: '6040',
      description: `SUTA - ${payroll.employeeName}`,
      debitCents: payroll.sutaCents,
      creditCents: 0,
    },

    // CREDITS: cash out (net pay)
    {
      accountCode: '1010',
      description: `Net pay - ${payroll.employeeName}`,
      debitCents: 0,
      creditCents: payroll.netCents,
    },

    // CREDITS: tax liabilities
    {
      accountCode: '2200',
      description: `Federal income tax withheld - ${payroll.employeeName}`,
      debitCents: 0,
      creditCents: payroll.federalIncomeTaxCents,
    },
    {
      accountCode: '2210',
      description: `Social Security tax - ${payroll.employeeName}`,
      debitCents: 0,
      creditCents: totalSS,
    },
    {
      accountCode: '2220',
      description: `Medicare tax - ${payroll.employeeName}`,
      debitCents: 0,
      creditCents: totalMedicare,
    },
    {
      accountCode: '2230',
      description: `FUTA - ${payroll.employeeName}`,
      debitCents: 0,
      creditCents: payroll.futaCents,
    },
    {
      accountCode: '2240',
      description: `SUTA - ${payroll.employeeName}`,
      debitCents: 0,
      creditCents: payroll.sutaCents,
    },
  ];

  return createJournalEntry({
    date: payroll.payPeriodEnd,
    description: `Payroll - ${payroll.employeeName} - period ending ${payroll.payPeriodEnd.toISOString().split('T')[0]}`,
    refType: 'payroll',
    refId: payroll.id,
    lines,
  });
}

// ============================================
// TRIAL BALANCE
// ============================================

/**
 * Generate a trial balance from all journal entries.
 * Returns each account's net debit or credit balance.
 */
export async function getTrialBalance(): Promise<TrialBalanceRow[]> {
  const allEntries = await prisma.setting.findMany({
    where: { key: { startsWith: 'je:' } },
  });

  // Aggregate by account code
  const balances = new Map<string, { debits: number; credits: number }>();

  for (const entry of allEntries) {
    try {
      const data = JSON.parse(entry.value) as JournalEntryData;
      for (const line of data.lines) {
        const existing = balances.get(line.accountCode) || { debits: 0, credits: 0 };
        existing.debits += line.debitCents;
        existing.credits += line.creditCents;
        balances.set(line.accountCode, existing);
      }
    } catch {
      // Skip malformed entries
    }
  }

  // Build trial balance rows
  const rows: TrialBalanceRow[] = [];
  for (const [code, bal] of balances.entries()) {
    const account = getAccount(code);
    if (!account) continue;

    const netDebit = bal.debits > bal.credits ? bal.debits - bal.credits : 0;
    const netCredit = bal.credits > bal.debits ? bal.credits - bal.debits : 0;

    if (netDebit > 0 || netCredit > 0) {
      rows.push({
        accountCode: code,
        name: account.name,
        debitBalance: netDebit,
        creditBalance: netCredit,
      });
    }
  }

  // Sort by account code
  rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  return rows;
}

// ============================================
// ACCOUNT BALANCE
// ============================================

/**
 * Get the current balance of a single account.
 * Returns the balance in cents, positive for normal balance direction.
 * For debit-normal accounts: debits - credits
 * For credit-normal accounts: credits - debits
 */
export async function getAccountBalance(accountCode: string): Promise<number> {
  const account = getAccount(accountCode);
  if (!account) {
    throw new Error(`Unknown account code: ${accountCode}`);
  }

  const allEntries = await prisma.setting.findMany({
    where: { key: { startsWith: 'je:' } },
  });

  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of allEntries) {
    try {
      const data = JSON.parse(entry.value) as JournalEntryData;
      for (const line of data.lines) {
        if (line.accountCode === accountCode) {
          totalDebits += line.debitCents;
          totalCredits += line.creditCents;
        }
      }
    } catch {
      // Skip malformed entries
    }
  }

  if (account.normalBalance === 'debit') {
    return totalDebits - totalCredits;
  }
  return totalCredits - totalDebits;
}
