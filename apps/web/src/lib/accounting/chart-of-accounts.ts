/**
 * Right at Home BnB - Chart of Accounts
 * Standard double-entry bookkeeping chart of accounts
 * for a short-term rental property management business.
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface Account {
  code: string;
  name: string;
  type: AccountType;
  subType: string;
  normalBalance: NormalBalance;
  description: string;
}

/**
 * Full chart of accounts for RAH-Midland BnB operations.
 *
 * 1xxx = Assets
 * 2xxx = Liabilities
 * 3xxx = Equity
 * 4xxx = Revenue
 * 5xxx = Cost of Revenue
 * 6xxx = Operating Expenses
 */
export const CHART_OF_ACCOUNTS: Account[] = [
  // ============================================
  // ASSETS (1xxx)
  // ============================================
  { code: '1000', name: 'Cash on Hand', type: 'asset', subType: 'current', normalBalance: 'debit', description: 'Petty cash for small purchases' },
  { code: '1010', name: 'Business Checking', type: 'asset', subType: 'current', normalBalance: 'debit', description: 'Primary business checking account' },
  { code: '1020', name: 'Business Savings', type: 'asset', subType: 'current', normalBalance: 'debit', description: 'Business savings / reserves' },
  { code: '1030', name: 'Stripe Balance', type: 'asset', subType: 'current', normalBalance: 'debit', description: 'Funds held in Stripe pending payout' },
  { code: '1040', name: 'Airbnb Receivable', type: 'asset', subType: 'current', normalBalance: 'debit', description: 'Pending payouts from Airbnb' },
  { code: '1050', name: 'VRBO Receivable', type: 'asset', subType: 'current', normalBalance: 'debit', description: 'Pending payouts from VRBO' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subType: 'current', normalBalance: 'debit', description: 'Guest balances owed for direct bookings' },
  { code: '1200', name: 'Security Deposits Held', type: 'asset', subType: 'current', normalBalance: 'debit', description: 'Cash security deposits from guests' },
  { code: '1300', name: 'Prepaid Insurance', type: 'asset', subType: 'current', normalBalance: 'debit', description: 'Prepaid insurance premiums' },
  { code: '1400', name: 'Inventory - Supplies', type: 'asset', subType: 'current', normalBalance: 'debit', description: 'Cleaning supplies, toiletries, linens on hand' },
  { code: '1500', name: 'Furniture & Fixtures', type: 'asset', subType: 'fixed', normalBalance: 'debit', description: 'Property furniture and fixture cost basis' },
  { code: '1510', name: 'Accumulated Depreciation - FF&E', type: 'asset', subType: 'fixed', normalBalance: 'credit', description: 'Accumulated depreciation on furniture & fixtures' },
  { code: '1600', name: 'Equipment', type: 'asset', subType: 'fixed', normalBalance: 'debit', description: 'Smart locks, cameras, HVAC equipment' },
  { code: '1610', name: 'Accumulated Depreciation - Equipment', type: 'asset', subType: 'fixed', normalBalance: 'credit', description: 'Accumulated depreciation on equipment' },

  // ============================================
  // LIABILITIES (2xxx)
  // ============================================
  { code: '2000', name: 'Accounts Payable', type: 'liability', subType: 'current', normalBalance: 'credit', description: 'Amounts owed to vendors and suppliers' },
  { code: '2010', name: 'Credit Card Payable', type: 'liability', subType: 'current', normalBalance: 'credit', description: 'Outstanding credit card balance' },
  { code: '2100', name: 'Unearned Revenue', type: 'liability', subType: 'current', normalBalance: 'credit', description: 'Guest payments for future stays (deposits)' },
  { code: '2200', name: 'Federal Income Tax Payable', type: 'liability', subType: 'current', normalBalance: 'credit', description: 'Withheld federal income tax' },
  { code: '2210', name: 'Social Security Tax Payable', type: 'liability', subType: 'current', normalBalance: 'credit', description: 'Employee + employer Social Security tax' },
  { code: '2220', name: 'Medicare Tax Payable', type: 'liability', subType: 'current', normalBalance: 'credit', description: 'Employee + employer Medicare tax' },
  { code: '2230', name: 'FUTA Payable', type: 'liability', subType: 'current', normalBalance: 'credit', description: 'Federal Unemployment Tax' },
  { code: '2240', name: 'SUTA Payable', type: 'liability', subType: 'current', normalBalance: 'credit', description: 'State Unemployment Tax (Texas)' },
  { code: '2250', name: 'Other Payroll Liabilities', type: 'liability', subType: 'current', normalBalance: 'credit', description: 'Other withheld amounts (garnishments, etc.)' },
  { code: '2300', name: 'Occupancy Tax Payable', type: 'liability', subType: 'current', normalBalance: 'credit', description: 'State + city hotel occupancy tax collected' },
  { code: '2400', name: 'Guest Security Deposits', type: 'liability', subType: 'current', normalBalance: 'credit', description: 'Refundable guest security deposit liability' },

  // ============================================
  // EQUITY (3xxx)
  // ============================================
  { code: '3000', name: 'Owner Equity', type: 'equity', subType: 'equity', normalBalance: 'credit', description: 'Steven Palma owner equity / capital' },
  { code: '3100', name: 'Owner Draws', type: 'equity', subType: 'equity', normalBalance: 'debit', description: 'Owner withdrawals / draws' },
  { code: '3200', name: 'Retained Earnings', type: 'equity', subType: 'equity', normalBalance: 'credit', description: 'Accumulated net income from prior periods' },

  // ============================================
  // REVENUE (4xxx)
  // ============================================
  { code: '4000', name: 'Rental Revenue', type: 'revenue', subType: 'operating', normalBalance: 'credit', description: 'Nightly rental income from guest stays' },
  { code: '4010', name: 'Cleaning Fee Revenue', type: 'revenue', subType: 'operating', normalBalance: 'credit', description: 'Cleaning fees charged to guests' },
  { code: '4020', name: 'Pet Fee Revenue', type: 'revenue', subType: 'operating', normalBalance: 'credit', description: 'Pet fees charged to guests' },
  { code: '4030', name: 'Extra Guest Fee Revenue', type: 'revenue', subType: 'operating', normalBalance: 'credit', description: 'Surcharges for extra guests' },
  { code: '4100', name: 'Late Fee Revenue', type: 'revenue', subType: 'other', normalBalance: 'credit', description: 'Late check-out or late payment fees' },
  { code: '4200', name: 'Damage Recovery Revenue', type: 'revenue', subType: 'other', normalBalance: 'credit', description: 'Damage charges billed to guests' },
  { code: '4300', name: 'Discount Allowances', type: 'revenue', subType: 'contra', normalBalance: 'debit', description: 'Discounts applied to bookings (contra-revenue)' },

  // ============================================
  // COST OF REVENUE (5xxx)
  // ============================================
  { code: '5000', name: 'Cleaning Costs', type: 'expense', subType: 'cost_of_revenue', normalBalance: 'debit', description: 'Direct cleaning labor and supplies per turnover' },
  { code: '5010', name: 'Laundry Costs', type: 'expense', subType: 'cost_of_revenue', normalBalance: 'debit', description: 'Linen laundry service costs' },
  { code: '5020', name: 'Guest Amenities', type: 'expense', subType: 'cost_of_revenue', normalBalance: 'debit', description: 'Toiletries, coffee, welcome baskets' },
  { code: '5030', name: 'Platform Commissions', type: 'expense', subType: 'cost_of_revenue', normalBalance: 'debit', description: 'Airbnb/VRBO host service fees (3-5%)' },
  { code: '5040', name: 'Payment Processing Fees', type: 'expense', subType: 'cost_of_revenue', normalBalance: 'debit', description: 'Stripe fees (2.9% + $0.30)' },
  { code: '5050', name: 'Consumable Supplies', type: 'expense', subType: 'cost_of_revenue', normalBalance: 'debit', description: 'Paper goods, trash bags, cleaning agents' },

  // ============================================
  // OPERATING EXPENSES (6xxx)
  // ============================================
  { code: '6000', name: 'Wages & Salaries', type: 'expense', subType: 'payroll', normalBalance: 'debit', description: 'Employee gross wages and salaries' },
  { code: '6010', name: 'Payroll Tax Expense - SS', type: 'expense', subType: 'payroll', normalBalance: 'debit', description: 'Employer Social Security (6.2%)' },
  { code: '6020', name: 'Payroll Tax Expense - Medicare', type: 'expense', subType: 'payroll', normalBalance: 'debit', description: 'Employer Medicare (1.45%)' },
  { code: '6030', name: 'Payroll Tax Expense - FUTA', type: 'expense', subType: 'payroll', normalBalance: 'debit', description: 'Federal Unemployment Tax' },
  { code: '6040', name: 'Payroll Tax Expense - SUTA', type: 'expense', subType: 'payroll', normalBalance: 'debit', description: 'Texas State Unemployment Tax' },
  { code: '6100', name: 'Homeowner Payments', type: 'expense', subType: 'property', normalBalance: 'debit', description: 'Monthly payments to property owners' },
  { code: '6110', name: 'Utilities - Electric', type: 'expense', subType: 'property', normalBalance: 'debit', description: 'Electricity bills' },
  { code: '6120', name: 'Utilities - Gas', type: 'expense', subType: 'property', normalBalance: 'debit', description: 'Natural gas bills' },
  { code: '6130', name: 'Utilities - Water', type: 'expense', subType: 'property', normalBalance: 'debit', description: 'Water and sewer bills' },
  { code: '6140', name: 'Utilities - Internet', type: 'expense', subType: 'property', normalBalance: 'debit', description: 'Internet / WiFi service' },
  { code: '6150', name: 'Utilities - Trash', type: 'expense', subType: 'property', normalBalance: 'debit', description: 'Trash pickup service' },
  { code: '6200', name: 'Maintenance & Repairs', type: 'expense', subType: 'property', normalBalance: 'debit', description: 'Property maintenance and repair costs' },
  { code: '6210', name: 'Yard Care & Landscaping', type: 'expense', subType: 'property', normalBalance: 'debit', description: 'Lawn mowing, tree trimming, landscaping' },
  { code: '6220', name: 'Pest Control', type: 'expense', subType: 'property', normalBalance: 'debit', description: 'Pest control treatments' },
  { code: '6230', name: 'Pool & Hot Tub', type: 'expense', subType: 'property', normalBalance: 'debit', description: 'Pool/hot tub maintenance and chemicals' },
  { code: '6300', name: 'Insurance', type: 'expense', subType: 'admin', normalBalance: 'debit', description: 'Business liability and property insurance' },
  { code: '6310', name: 'Property Tax', type: 'expense', subType: 'admin', normalBalance: 'debit', description: 'Property tax payments' },
  { code: '6400', name: 'Software & Technology', type: 'expense', subType: 'admin', normalBalance: 'debit', description: 'PMS, smart lock, pricing tools, AI costs' },
  { code: '6410', name: 'AI & API Costs', type: 'expense', subType: 'admin', normalBalance: 'debit', description: 'ECHO SDK, OpenAI, ElevenLabs, etc.' },
  { code: '6500', name: 'Marketing & Advertising', type: 'expense', subType: 'admin', normalBalance: 'debit', description: 'Online ads, photography, listing optimization' },
  { code: '6510', name: 'Professional Photography', type: 'expense', subType: 'admin', normalBalance: 'debit', description: 'Professional property photography' },
  { code: '6600', name: 'Professional Services', type: 'expense', subType: 'admin', normalBalance: 'debit', description: 'Accounting, legal, consulting fees' },
  { code: '6700', name: 'Vehicle Expense', type: 'expense', subType: 'admin', normalBalance: 'debit', description: 'Mileage, gas, maintenance for business travel' },
  { code: '6800', name: 'Office Supplies', type: 'expense', subType: 'admin', normalBalance: 'debit', description: 'Printer paper, pens, office supplies' },
  { code: '6900', name: 'Miscellaneous Expense', type: 'expense', subType: 'admin', normalBalance: 'debit', description: 'Other operating expenses not categorized above' },
];

/**
 * Look up a single account by its code.
 */
export function getAccount(code: string): Account | undefined {
  return CHART_OF_ACCOUNTS.find((a) => a.code === code);
}

/**
 * Get all accounts of a given type.
 */
export function getAccountsByType(type: AccountType): Account[] {
  return CHART_OF_ACCOUNTS.filter((a) => a.type === type);
}

/**
 * Check if an account code exists in the chart.
 */
export function isValidAccountCode(code: string): boolean {
  return CHART_OF_ACCOUNTS.some((a) => a.code === code);
}
