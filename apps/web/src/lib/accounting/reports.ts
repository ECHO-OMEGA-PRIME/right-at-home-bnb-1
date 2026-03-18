/**
 * Right at Home BnB - Financial Report Generators
 * Generates P&L, Balance Sheet, and Cash Flow reports from journal entry data.
 */

import prisma from '../prisma';
import { getAccount, getAccountsByType, CHART_OF_ACCOUNTS } from './chart-of-accounts';
import type { JournalEntryData } from './ledger';
import { formatMoney } from '../utils/money';

// ============================================
// TYPES
// ============================================

export interface PnLLineItem {
  accountCode: string;
  name: string;
  amountCents: number;
}

export interface PnLReport {
  startDate: string;
  endDate: string;
  propertyId?: string;
  revenue: {
    items: PnLLineItem[];
    totalCents: number;
  };
  costOfRevenue: {
    items: PnLLineItem[];
    totalCents: number;
  };
  grossProfitCents: number;
  operatingExpenses: {
    items: PnLLineItem[];
    totalCents: number;
  };
  netIncomeCents: number;
}

export interface BalanceSheetSection {
  items: PnLLineItem[];
  totalCents: number;
}

export interface BalanceSheet {
  asOfDate: string;
  assets: {
    current: BalanceSheetSection;
    fixed: BalanceSheetSection;
    totalCents: number;
  };
  liabilities: {
    current: BalanceSheetSection;
    totalCents: number;
  };
  equity: {
    items: PnLLineItem[];
    retainedEarningsCents: number;
    totalCents: number;
  };
}

export interface CashFlowReport {
  startDate: string;
  endDate: string;
  operating: {
    items: PnLLineItem[];
    totalCents: number;
  };
  investing: {
    items: PnLLineItem[];
    totalCents: number;
  };
  financing: {
    items: PnLLineItem[];
    totalCents: number;
  };
  netChangeCents: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * Load all journal entries, optionally filtered by date range and property.
 */
async function loadJournalEntries(options?: {
  startDate?: Date;
  endDate?: Date;
  propertyId?: string;
}): Promise<JournalEntryData[]> {
  const allSettings = await prisma.setting.findMany({
    where: { key: { startsWith: 'je:' } },
  });

  const entries: JournalEntryData[] = [];
  for (const setting of allSettings) {
    try {
      const data = JSON.parse(setting.value) as JournalEntryData;
      const entryDate = new Date(data.date);

      if (options?.startDate && entryDate < options.startDate) continue;
      if (options?.endDate && entryDate > options.endDate) continue;
      if (options?.propertyId && data.propertyId !== options.propertyId) continue;

      entries.push(data);
    } catch {
      // Skip malformed entries
    }
  }

  return entries;
}

/**
 * Aggregate journal lines by account code, returning the net amount
 * in the account's normal balance direction.
 */
function aggregateByAccount(
  entries: JournalEntryData[],
  accountFilter: (code: string) => boolean
): Map<string, number> {
  const totals = new Map<string, { debits: number; credits: number }>();

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (!accountFilter(line.accountCode)) continue;
      const existing = totals.get(line.accountCode) || { debits: 0, credits: 0 };
      existing.debits += line.debitCents;
      existing.credits += line.creditCents;
      totals.set(line.accountCode, existing);
    }
  }

  const result = new Map<string, number>();
  for (const [code, bal] of totals.entries()) {
    const account = getAccount(code);
    if (!account) continue;
    const amount = account.normalBalance === 'debit'
      ? bal.debits - bal.credits
      : bal.credits - bal.debits;
    if (amount !== 0) {
      result.set(code, amount);
    }
  }

  return result;
}

function mapToLineItems(balances: Map<string, number>): PnLLineItem[] {
  const items: PnLLineItem[] = [];
  for (const [code, amount] of balances.entries()) {
    const account = getAccount(code);
    if (account) {
      items.push({ accountCode: code, name: account.name, amountCents: amount });
    }
  }
  return items.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

function sumLineItems(items: PnLLineItem[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

// ============================================
// PROFIT & LOSS
// ============================================

/**
 * Generate a Profit & Loss (Income Statement) report.
 * Revenue (4xxx) - Cost of Revenue (5xxx) = Gross Profit
 * Gross Profit - Operating Expenses (6xxx) = Net Income
 */
export async function generateProfitAndLoss(
  startDate: Date,
  endDate: Date,
  propertyId?: string
): Promise<PnLReport> {
  const entries = await loadJournalEntries({ startDate, endDate, propertyId });

  // Revenue: 4xxx accounts
  const revenueBalances = aggregateByAccount(entries, (code) => code.startsWith('4'));
  const revenueItems = mapToLineItems(revenueBalances);
  const revenueTotalCents = sumLineItems(revenueItems);

  // Cost of Revenue: 5xxx accounts
  const corBalances = aggregateByAccount(entries, (code) => code.startsWith('5'));
  const corItems = mapToLineItems(corBalances);
  const corTotalCents = sumLineItems(corItems);

  const grossProfitCents = revenueTotalCents - corTotalCents;

  // Operating Expenses: 6xxx accounts
  const opexBalances = aggregateByAccount(entries, (code) => code.startsWith('6'));
  const opexItems = mapToLineItems(opexBalances);
  const opexTotalCents = sumLineItems(opexItems);

  const netIncomeCents = grossProfitCents - opexTotalCents;

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    propertyId,
    revenue: { items: revenueItems, totalCents: revenueTotalCents },
    costOfRevenue: { items: corItems, totalCents: corTotalCents },
    grossProfitCents,
    operatingExpenses: { items: opexItems, totalCents: opexTotalCents },
    netIncomeCents,
  };
}

// ============================================
// BALANCE SHEET
// ============================================

/**
 * Generate a Balance Sheet as of a given date.
 * Assets = Liabilities + Equity
 */
export async function generateBalanceSheet(asOfDate: Date): Promise<BalanceSheet> {
  const entries = await loadJournalEntries({ endDate: asOfDate });

  // Assets: 1xxx
  const assetBalances = aggregateByAccount(entries, (code) => code.startsWith('1'));
  const currentAssetItems = mapToLineItems(
    new Map([...assetBalances].filter(([code]) => {
      const acct = getAccount(code);
      return acct && acct.subType === 'current';
    }))
  );
  const fixedAssetItems = mapToLineItems(
    new Map([...assetBalances].filter(([code]) => {
      const acct = getAccount(code);
      return acct && acct.subType === 'fixed';
    }))
  );
  const totalAssets = sumLineItems(currentAssetItems) + sumLineItems(fixedAssetItems);

  // Liabilities: 2xxx
  const liabBalances = aggregateByAccount(entries, (code) => code.startsWith('2'));
  const currentLiabItems = mapToLineItems(liabBalances);
  const totalLiabilities = sumLineItems(currentLiabItems);

  // Equity: 3xxx
  const equityBalances = aggregateByAccount(entries, (code) => code.startsWith('3'));
  const equityItems = mapToLineItems(equityBalances);

  // Calculate retained earnings = total revenue - total expenses (all time)
  const revenueBalances = aggregateByAccount(entries, (code) => code.startsWith('4'));
  const expenseBalances = aggregateByAccount(entries, (code) => code.startsWith('5') || code.startsWith('6'));
  const totalRevenue = [...revenueBalances.values()].reduce((s, v) => s + v, 0);
  const totalExpenses = [...expenseBalances.values()].reduce((s, v) => s + v, 0);
  const retainedEarningsCents = totalRevenue - totalExpenses;

  const totalEquity = sumLineItems(equityItems) + retainedEarningsCents;

  return {
    asOfDate: asOfDate.toISOString().split('T')[0],
    assets: {
      current: { items: currentAssetItems, totalCents: sumLineItems(currentAssetItems) },
      fixed: { items: fixedAssetItems, totalCents: sumLineItems(fixedAssetItems) },
      totalCents: totalAssets,
    },
    liabilities: {
      current: { items: currentLiabItems, totalCents: totalLiabilities },
      totalCents: totalLiabilities,
    },
    equity: {
      items: equityItems,
      retainedEarningsCents,
      totalCents: totalEquity,
    },
  };
}

// ============================================
// CASH FLOW STATEMENT
// ============================================

/**
 * Generate a Cash Flow Statement.
 * Operating: Revenue collections + operating expense payments
 * Investing: Fixed asset purchases / sales
 * Financing: Equity contributions + draws
 */
export async function generateCashFlow(
  startDate: Date,
  endDate: Date
): Promise<CashFlowReport> {
  const entries = await loadJournalEntries({ startDate, endDate });

  // Operating activities: changes in cash from revenue, expenses, and working capital
  // Cash inflows from revenue (credits to 4xxx matched by debits to cash/receivables)
  // Cash outflows for expenses (debits to 5xxx/6xxx matched by credits to cash/payables)
  const operatingItems: PnLLineItem[] = [];
  const investingItems: PnLLineItem[] = [];
  const financingItems: PnLLineItem[] = [];

  // Aggregate net cash impact from checking account (1010) entries
  for (const entry of entries) {
    let cashImpact = 0;
    let nonCashDescription = '';

    for (const line of entry.lines) {
      if (line.accountCode === '1010' || line.accountCode === '1000') {
        cashImpact += line.debitCents - line.creditCents;
      }
      if (!line.accountCode.startsWith('10')) {
        nonCashDescription = line.accountCode;
      }
    }

    if (cashImpact === 0) continue;

    const acct = getAccount(nonCashDescription);
    const category = nonCashDescription.charAt(0);

    const item: PnLLineItem = {
      accountCode: nonCashDescription,
      name: entry.description,
      amountCents: cashImpact,
    };

    if (category === '1' && acct?.subType === 'fixed') {
      // Fixed asset = investing
      investingItems.push(item);
    } else if (category === '3') {
      // Equity = financing
      financingItems.push(item);
    } else {
      // Everything else = operating
      operatingItems.push(item);
    }
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    operating: { items: operatingItems, totalCents: sumLineItems(operatingItems) },
    investing: { items: investingItems, totalCents: sumLineItems(investingItems) },
    financing: { items: financingItems, totalCents: sumLineItems(financingItems) },
    netChangeCents:
      sumLineItems(operatingItems) + sumLineItems(investingItems) + sumLineItems(financingItems),
  };
}
