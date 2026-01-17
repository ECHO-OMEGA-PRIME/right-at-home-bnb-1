'use client';

/**
 * Right at Home BnB - Financial Management System
 * Tracks all property expenses including homeowner payments, utilities, cleaning, maintenance, yard care, inventory
 * @author ECHO OMEGA PRIME
 */

import { db } from './auth';
import {
  doc, setDoc, getDoc, updateDoc, collection,
  query, where, getDocs, orderBy, serverTimestamp,
  Timestamp, addDoc, deleteDoc
} from 'firebase/firestore';

// Expense Categories
export type ExpenseCategory =
  | 'homeowner_payment'
  | 'utilities'
  | 'cleaning'
  | 'maintenance'
  | 'yard_care'
  | 'inventory'
  | 'supplies'
  | 'insurance'
  | 'taxes'
  | 'marketing'
  | 'software'
  | 'commissions'
  | 'other';

// Utility Types
export type UtilityType = 'electric' | 'gas' | 'water' | 'internet' | 'trash' | 'cable' | 'other';

// Expense Record
export interface Expense {
  id: string;
  propertyId: string;
  propertyName: string;
  category: ExpenseCategory;
  subCategory?: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  dueDate?: string;
  paidDate?: string;
  isPaid: boolean;
  isRecurring: boolean;
  recurringFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
  vendor?: string;
  invoiceNumber?: string;
  receiptUrl?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// Homeowner Payment Record
export interface HomeownerPayment {
  id: string;
  propertyId: string;
  propertyName: string;
  homeownerName: string;
  homeownerEmail?: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidDate?: string;
  isPaid: boolean;
  paymentMethod?: 'check' | 'ach' | 'wire' | 'zelle' | 'venmo' | 'other';
  checkNumber?: string;
  transactionId?: string;
  // Revenue breakdown
  grossRevenue: number;
  managementFee: number;
  managementFeePercent: number;
  expenses: number; // Deducted expenses
  netToOwner: number;
  // Attached expenses for this period
  expenseIds: string[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Utility Bill
export interface UtilityBill {
  id: string;
  propertyId: string;
  propertyName: string;
  utilityType: UtilityType;
  provider: string;
  accountNumber?: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidDate?: string;
  isPaid: boolean;
  usage?: number;
  usageUnit?: string; // kWh, gallons, therms, etc.
  previousReading?: number;
  currentReading?: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Cleaning Record
export interface CleaningRecord {
  id: string;
  propertyId: string;
  propertyName: string;
  cleanerId: string;
  cleanerName: string;
  bookingId?: string;
  cleaningType: 'turnover' | 'deep_clean' | 'maintenance_clean' | 'inspection';
  scheduledDate: string;
  completedDate?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  laborCost: number;
  suppliesCost: number;
  totalCost: number;
  hoursWorked?: number;
  hourlyRate?: number;
  checklistCompleted?: boolean;
  photos?: string[];
  notes?: string;
  qualityScore?: number; // AI-generated or manual 1-10
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Maintenance Record
export interface MaintenanceRecord {
  id: string;
  propertyId: string;
  propertyName: string;
  category: 'hvac' | 'plumbing' | 'electrical' | 'appliances' | 'structural' | 'landscaping' | 'pest_control' | 'general' | 'other';
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'reported' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'deferred';
  reportedDate: string;
  scheduledDate?: string;
  completedDate?: string;
  vendorId?: string;
  vendorName?: string;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  isCapEx: boolean; // Capital expenditure vs operating expense
  warrantyClaimable: boolean;
  warrantyClaimStatus?: 'pending' | 'approved' | 'denied';
  photos?: string[];
  invoiceUrl?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Yard Care Record
export interface YardCareRecord {
  id: string;
  propertyId: string;
  propertyName: string;
  serviceType: 'mowing' | 'edging' | 'trimming' | 'fertilizing' | 'pest_treatment' | 'irrigation' | 'tree_service' | 'full_service' | 'other';
  vendorId?: string;
  vendorName?: string;
  scheduledDate: string;
  completedDate?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  cost: number;
  isRecurring: boolean;
  recurringFrequency?: 'weekly' | 'biweekly' | 'monthly';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Inventory Item
export interface InventoryItem {
  id: string;
  propertyId: string | 'shared'; // 'shared' for central inventory
  propertyName?: string;
  category: 'linens' | 'towels' | 'toiletries' | 'kitchen' | 'cleaning_supplies' | 'furniture' | 'electronics' | 'outdoor' | 'other';
  name: string;
  description?: string;
  quantity: number;
  minQuantity: number; // Alert threshold
  unitCost: number;
  totalValue: number;
  location?: string;
  lastRestocked?: string;
  lastAudited?: string;
  supplier?: string;
  reorderUrl?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Financial Summary
export interface FinancialSummary {
  period: {
    start: string;
    end: string;
  };
  revenue: {
    gross: number;
    byProperty: { propertyId: string; propertyName: string; amount: number }[];
    byPlatform: { platform: string; amount: number }[];
  };
  expenses: {
    total: number;
    byCategory: { category: ExpenseCategory; amount: number }[];
    homeownerPayments: number;
    utilities: number;
    cleaning: number;
    maintenance: number;
    yardCare: number;
    inventory: number;
    other: number;
  };
  profit: {
    gross: number;
    net: number;
    margin: number;
  };
  outstanding: {
    unpaidExpenses: number;
    unpaidHomeownerPayments: number;
  };
}

// Add expense
export async function addExpense(expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
  const expenseRef = doc(collection(db(), 'expenses'));
  const newExpense: Expense = {
    ...expense,
    id: expenseRef.id,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(expenseRef, newExpense);
  return newExpense;
}

// Get expenses by property and date range
export async function getExpenses(
  propertyId?: string,
  startDate?: string,
  endDate?: string,
  category?: ExpenseCategory
): Promise<Expense[]> {
  let q = query(collection(db(), 'expenses'), orderBy('date', 'desc'));

  const snapshot = await getDocs(q);
  let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Expense);

  // Client-side filtering (Firestore has limited compound query support)
  if (propertyId) {
    results = results.filter(e => e.propertyId === propertyId);
  }
  if (startDate) {
    results = results.filter(e => e.date >= startDate);
  }
  if (endDate) {
    results = results.filter(e => e.date <= endDate);
  }
  if (category) {
    results = results.filter(e => e.category === category);
  }

  return results;
}

// Add homeowner payment
export async function addHomeownerPayment(
  payment: Omit<HomeownerPayment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<HomeownerPayment> {
  const paymentRef = doc(collection(db(), 'homeownerPayments'));
  const newPayment: HomeownerPayment = {
    ...payment,
    id: paymentRef.id,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(paymentRef, newPayment);
  return newPayment;
}

// Get homeowner payments
export async function getHomeownerPayments(
  propertyId?: string,
  isPaid?: boolean
): Promise<HomeownerPayment[]> {
  const paymentsRef = collection(db(), 'homeownerPayments');
  const q = query(paymentsRef, orderBy('dueDate', 'desc'));
  const snapshot = await getDocs(q);

  let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as HomeownerPayment);

  if (propertyId) {
    results = results.filter(p => p.propertyId === propertyId);
  }
  if (isPaid !== undefined) {
    results = results.filter(p => p.isPaid === isPaid);
  }

  return results;
}

// Add utility bill
export async function addUtilityBill(
  bill: Omit<UtilityBill, 'id' | 'createdAt' | 'updatedAt'>
): Promise<UtilityBill> {
  const billRef = doc(collection(db(), 'utilityBills'));
  const newBill: UtilityBill = {
    ...bill,
    id: billRef.id,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(billRef, newBill);
  return newBill;
}

// Get utility bills
export async function getUtilityBills(
  propertyId?: string,
  utilityType?: UtilityType
): Promise<UtilityBill[]> {
  const billsRef = collection(db(), 'utilityBills');
  const q = query(billsRef, orderBy('dueDate', 'desc'));
  const snapshot = await getDocs(q);

  let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UtilityBill);

  if (propertyId) {
    results = results.filter(b => b.propertyId === propertyId);
  }
  if (utilityType) {
    results = results.filter(b => b.utilityType === utilityType);
  }

  return results;
}

// Add cleaning record
export async function addCleaningRecord(
  record: Omit<CleaningRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CleaningRecord> {
  const recordRef = doc(collection(db(), 'cleaningRecords'));
  const newRecord: CleaningRecord = {
    ...record,
    id: recordRef.id,
    totalCost: record.laborCost + record.suppliesCost,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(recordRef, newRecord);
  return newRecord;
}

// Add maintenance record
export async function addMaintenanceRecord(
  record: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MaintenanceRecord> {
  const recordRef = doc(collection(db(), 'maintenanceRecords'));
  const newRecord: MaintenanceRecord = {
    ...record,
    id: recordRef.id,
    totalCost: record.laborCost + record.partsCost,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(recordRef, newRecord);
  return newRecord;
}

// Add yard care record
export async function addYardCareRecord(
  record: Omit<YardCareRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<YardCareRecord> {
  const recordRef = doc(collection(db(), 'yardCareRecords'));
  const newRecord: YardCareRecord = {
    ...record,
    id: recordRef.id,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(recordRef, newRecord);
  return newRecord;
}

// Add or update inventory item
export async function upsertInventoryItem(
  item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'totalValue'>
): Promise<InventoryItem> {
  const itemRef = item.propertyId === 'shared'
    ? doc(collection(db(), 'inventory'))
    : doc(collection(db(), 'properties', item.propertyId, 'inventory'));

  const newItem: InventoryItem = {
    ...item,
    id: itemRef.id,
    totalValue: item.quantity * item.unitCost,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(itemRef, newItem);
  return newItem;
}

// Get inventory
export async function getInventory(propertyId?: string): Promise<InventoryItem[]> {
  const items: InventoryItem[] = [];

  // Get shared inventory
  const sharedRef = collection(db(), 'inventory');
  const sharedSnapshot = await getDocs(sharedRef);
  items.push(...sharedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as InventoryItem));

  // Get property-specific inventory if propertyId provided
  if (propertyId) {
    const propertyRef = collection(db(), 'properties', propertyId, 'inventory');
    const propertySnapshot = await getDocs(propertyRef);
    items.push(...propertySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as InventoryItem));
  }

  return items;
}

// Get low stock inventory items
export async function getLowStockItems(): Promise<InventoryItem[]> {
  const items = await getInventory();
  return items.filter(item => item.quantity <= item.minQuantity);
}

// Calculate financial summary
export async function calculateFinancialSummary(
  startDate: string,
  endDate: string,
  propertyId?: string
): Promise<FinancialSummary> {
  // Get all expenses in date range
  const expenses = await getExpenses(propertyId, startDate, endDate);
  const homeownerPayments = await getHomeownerPayments(propertyId);
  const utilities = await getUtilityBills(propertyId);

  // Calculate expense totals by category
  const expenseByCategory: Record<ExpenseCategory, number> = {
    homeowner_payment: 0,
    utilities: 0,
    cleaning: 0,
    maintenance: 0,
    yard_care: 0,
    inventory: 0,
    supplies: 0,
    insurance: 0,
    taxes: 0,
    marketing: 0,
    software: 0,
    commissions: 0,
    other: 0,
  };

  expenses.forEach(exp => {
    expenseByCategory[exp.category] += exp.amount;
  });

  // Filter homeowner payments by date
  const periodPayments = homeownerPayments.filter(
    p => p.periodEnd >= startDate && p.periodStart <= endDate
  );

  const totalHomeownerPayments = periodPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalUtilities = utilities
    .filter(u => u.periodEnd >= startDate && u.periodStart <= endDate)
    .reduce((sum, u) => sum + u.amount, 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Calculate gross revenue from homeowner payment records
  const grossRevenue = periodPayments.reduce((sum, p) => sum + p.grossRevenue, 0);

  const unpaidExpenses = expenses.filter(e => !e.isPaid).reduce((sum, e) => sum + e.amount, 0);
  const unpaidHomeownerPayments = periodPayments.filter(p => !p.isPaid).reduce((sum, p) => sum + p.amount, 0);

  const netProfit = grossRevenue - totalExpenses;
  const margin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  return {
    period: { start: startDate, end: endDate },
    revenue: {
      gross: grossRevenue,
      byProperty: [], // Would need booking data to populate
      byPlatform: [], // Would need booking data to populate
    },
    expenses: {
      total: totalExpenses,
      byCategory: Object.entries(expenseByCategory).map(([category, amount]) => ({
        category: category as ExpenseCategory,
        amount,
      })),
      homeownerPayments: totalHomeownerPayments,
      utilities: totalUtilities,
      cleaning: expenseByCategory.cleaning,
      maintenance: expenseByCategory.maintenance,
      yardCare: expenseByCategory.yard_care,
      inventory: expenseByCategory.inventory,
      other: expenseByCategory.other + expenseByCategory.supplies + expenseByCategory.software,
    },
    profit: {
      gross: grossRevenue,
      net: netProfit,
      margin,
    },
    outstanding: {
      unpaidExpenses,
      unpaidHomeownerPayments,
    },
  };
}

// Mark expense as paid
export async function markExpensePaid(expenseId: string, paidDate?: string): Promise<void> {
  const expenseRef = doc(db(), 'expenses', expenseId);
  await updateDoc(expenseRef, {
    isPaid: true,
    paidDate: paidDate || new Date().toISOString().split('T')[0],
    updatedAt: serverTimestamp(),
  });
}

// Mark homeowner payment as paid
export async function markHomeownerPaymentPaid(
  paymentId: string,
  paymentMethod: string,
  transactionId?: string
): Promise<void> {
  const paymentRef = doc(db(), 'homeownerPayments', paymentId);
  await updateDoc(paymentRef, {
    isPaid: true,
    paidDate: new Date().toISOString().split('T')[0],
    paymentMethod,
    transactionId,
    updatedAt: serverTimestamp(),
  });
}

// Delete expense
export async function deleteExpense(expenseId: string): Promise<void> {
  const expenseRef = doc(db(), 'expenses', expenseId);
  await deleteDoc(expenseRef);
}

// Export financial data for tax prep
export async function exportFinancialData(year: number): Promise<{
  expenses: Expense[];
  homeownerPayments: HomeownerPayment[];
  utilities: UtilityBill[];
  summary: FinancialSummary;
}> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const [expenses, homeownerPayments, utilities, summary] = await Promise.all([
    getExpenses(undefined, startDate, endDate),
    getHomeownerPayments(),
    getUtilityBills(),
    calculateFinancialSummary(startDate, endDate),
  ]);

  return { expenses, homeownerPayments, utilities, summary };
}
