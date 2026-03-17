/**
 * Right at Home BnB — Invoice & Estimate Generator
 * Creates, tracks, and converts invoices and estimates.
 * Texas sales tax: 8.25% on taxable items.
 * Late fee: 1.5% per month on overdue balance.
 * All monetary values in INTEGER CENTS.
 * @author ECHO OMEGA PRIME
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvoiceType = 'invoice' | 'estimate';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'void';

export interface LineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  taxable: boolean;
}

export interface Invoice {
  id: string;
  number: string;            // RAH-2026-XXXX
  type: InvoiceType;
  clientName: string;
  clientEmail: string;
  propertyId: string | null;
  lineItems: LineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  status: InvoiceStatus;
  dueDate: Date | null;
  validUntil: Date | null;   // for estimates
  paidDate: Date | null;
  paymentMethod: string | null;
  transactionId: string | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceTotals {
  subtotalCents: number;
  taxableCents: number;
  taxCents: number;
  totalCents: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Texas state + local sales tax rate: 6.25% state + 2% local = 8.25%. */
const SALES_TAX_RATE = 0.0825;

/** Late fee: 1.5% per month on the outstanding balance. */
const LATE_FEE_MONTHLY_RATE = 0.015;

// ---------------------------------------------------------------------------
// In-memory store (swap for Prisma / Firebase in production)
// ---------------------------------------------------------------------------

const invoices: Invoice[] = [];
let sequenceCounter = 0;

// ---------------------------------------------------------------------------
// Invoice Number Generation
// ---------------------------------------------------------------------------

/**
 * Generate the next sequential invoice number: RAH-{YEAR}-{0001..9999}.
 */
export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();

  // Find the highest sequence used this year
  const thisYearInvoices = invoices.filter((inv) => inv.number.startsWith(`RAH-${year}-`));
  if (thisYearInvoices.length > 0) {
    const maxSeq = Math.max(
      ...thisYearInvoices.map((inv) => {
        const parts = inv.number.split('-');
        return parseInt(parts[2], 10) || 0;
      }),
    );
    sequenceCounter = Math.max(sequenceCounter, maxSeq);
  }

  sequenceCounter++;
  return `RAH-${year}-${String(sequenceCounter).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Totals Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate subtotal, taxable amount, tax, and total from line items.
 * Tax: 8.25% Texas sales tax applies only to taxable items.
 */
export function calculateTotals(lineItems: LineItem[]): InvoiceTotals {
  let subtotalCents = 0;
  let taxableCents = 0;

  for (const item of lineItems) {
    const lineTotal = item.quantity * item.unitPriceCents;
    subtotalCents += lineTotal;
    if (item.taxable) {
      taxableCents += lineTotal;
    }
  }

  const taxCents = Math.round(taxableCents * SALES_TAX_RATE);
  const totalCents = subtotalCents + taxCents;

  return { subtotalCents, taxableCents, taxCents, totalCents };
}

// ---------------------------------------------------------------------------
// Build line items with computed totals
// ---------------------------------------------------------------------------

function buildLineItems(
  items: Omit<LineItem, 'totalCents'>[],
): LineItem[] {
  return items.map((item) => ({
    ...item,
    totalCents: item.quantity * item.unitPriceCents,
  }));
}

// ---------------------------------------------------------------------------
// Invoice Creation
// ---------------------------------------------------------------------------

/**
 * Create an invoice with an auto-generated number.
 * Line-item totals are computed automatically.
 */
export function createInvoice(
  clientName: string,
  clientEmail: string,
  rawLineItems: Omit<LineItem, 'totalCents'>[],
  dueDate?: Date,
  notes?: string,
  propertyId?: string,
): Invoice {
  const lineItems = buildLineItems(rawLineItems);
  const totals = calculateTotals(lineItems);
  const number = generateInvoiceNumber();
  const now = new Date();

  const invoice: Invoice = {
    id: `inv_${number}`,
    number,
    type: 'invoice',
    clientName,
    clientEmail,
    propertyId: propertyId ?? null,
    lineItems,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    status: 'draft',
    dueDate: dueDate ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // Net 30
    validUntil: null,
    paidDate: null,
    paymentMethod: null,
    transactionId: null,
    notes: notes ?? '',
    createdAt: now,
    updatedAt: now,
  };

  invoices.push(invoice);
  return invoice;
}

/**
 * Create an estimate (not yet a binding invoice).
 */
export function createEstimate(
  clientName: string,
  clientEmail: string,
  rawLineItems: Omit<LineItem, 'totalCents'>[],
  validUntil?: Date,
  notes?: string,
  propertyId?: string,
): Invoice {
  const lineItems = buildLineItems(rawLineItems);
  const totals = calculateTotals(lineItems);
  const number = generateInvoiceNumber();
  const now = new Date();

  const estimate: Invoice = {
    id: `est_${number}`,
    number,
    type: 'estimate',
    clientName,
    clientEmail,
    propertyId: propertyId ?? null,
    lineItems,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    status: 'sent',
    dueDate: null,
    validUntil: validUntil ?? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
    paidDate: null,
    paymentMethod: null,
    transactionId: null,
    notes: notes ?? '',
    createdAt: now,
    updatedAt: now,
  };

  invoices.push(estimate);
  return estimate;
}

/**
 * Convert an approved estimate into a live invoice.
 */
export function convertEstimateToInvoice(estimateId: string): Invoice {
  const estimate = invoices.find((inv) => inv.id === estimateId);
  if (!estimate) throw new Error(`Estimate ${estimateId} not found`);
  if (estimate.type !== 'estimate') throw new Error(`${estimateId} is not an estimate`);

  const now = new Date();
  const number = generateInvoiceNumber();

  const invoice: Invoice = {
    ...estimate,
    id: `inv_${number}`,
    number,
    type: 'invoice',
    status: 'sent',
    dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // Net 30
    validUntil: null,
    createdAt: now,
    updatedAt: now,
  };

  // Mark the estimate as converted (cancel it)
  estimate.status = 'cancelled';
  estimate.updatedAt = now;

  invoices.push(invoice);
  return invoice;
}

// ---------------------------------------------------------------------------
// Status Updates
// ---------------------------------------------------------------------------

/**
 * Record a payment against an invoice.
 */
export function markAsPaid(
  invoiceId: string,
  paymentMethod: string,
  transactionId?: string,
): Invoice {
  const inv = invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new Error(`Invoice ${invoiceId} not found`);

  inv.status = 'paid';
  inv.paidDate = new Date();
  inv.paymentMethod = paymentMethod;
  inv.transactionId = transactionId ?? null;
  inv.updatedAt = new Date();
  return inv;
}

/**
 * Flag an invoice as overdue.
 */
export function markAsOverdue(invoiceId: string): Invoice {
  const inv = invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new Error(`Invoice ${invoiceId} not found`);

  inv.status = 'overdue';
  inv.updatedAt = new Date();
  return inv;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get all unpaid invoices (draft, sent, or overdue).
 */
export function getOutstandingInvoices(): Invoice[] {
  return invoices.filter(
    (inv) =>
      inv.type === 'invoice' &&
      (inv.status === 'draft' || inv.status === 'sent' || inv.status === 'overdue'),
  );
}

/**
 * Get all invoices and estimates for a client (by name, case-insensitive).
 */
export function getInvoicesByClient(clientName: string): Invoice[] {
  const lower = clientName.toLowerCase();
  return invoices.filter((inv) => inv.clientName.toLowerCase() === lower);
}

/**
 * Get a single invoice by ID.
 */
export function getInvoiceById(invoiceId: string): Invoice | null {
  return invoices.find((inv) => inv.id === invoiceId) ?? null;
}

// ---------------------------------------------------------------------------
// Late Fee Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the late fee for an overdue invoice.
 * 1.5% per month on the outstanding balance, prorated by days overdue.
 */
export function calculateLateFee(invoiceId: string): {
  lateFeesCents: number;
  daysOverdue: number;
  monthlyRatePercent: number;
} {
  const inv = invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new Error(`Invoice ${invoiceId} not found`);
  if (!inv.dueDate) return { lateFeesCents: 0, daysOverdue: 0, monthlyRatePercent: LATE_FEE_MONTHLY_RATE * 100 };

  const now = new Date();
  const dueMs = inv.dueDate.getTime();
  const nowMs = now.getTime();

  if (nowMs <= dueMs) {
    return { lateFeesCents: 0, daysOverdue: 0, monthlyRatePercent: LATE_FEE_MONTHLY_RATE * 100 };
  }

  const daysOverdue = Math.floor((nowMs - dueMs) / (24 * 60 * 60 * 1000));
  const monthsOverdue = daysOverdue / 30;
  const lateFeesCents = Math.round(inv.totalCents * LATE_FEE_MONTHLY_RATE * monthsOverdue);

  return {
    lateFeesCents,
    daysOverdue,
    monthlyRatePercent: LATE_FEE_MONTHLY_RATE * 100,
  };
}

// ---------------------------------------------------------------------------
// Batch Operations (for cron)
// ---------------------------------------------------------------------------

/**
 * Scan all invoices and auto-flag overdue ones. Returns count of newly flagged.
 */
export function flagOverdueInvoices(): number {
  const now = new Date();
  let flagged = 0;

  for (const inv of invoices) {
    if (
      inv.type === 'invoice' &&
      (inv.status === 'draft' || inv.status === 'sent') &&
      inv.dueDate &&
      inv.dueDate < now
    ) {
      inv.status = 'overdue';
      inv.updatedAt = now;
      flagged++;
    }
  }

  return flagged;
}
