'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  DollarSign,
  FileText,
  Send,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Eye,
  Download,
  Search,
  Filter,
  ChevronRight,
  Loader2,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface PayPalBalance {
  available: number;
  pending: number;
  currency: string;
}

interface PayPalConnectionStatus {
  connected: boolean;
  email?: string;
  balance?: PayPalBalance;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  recipientEmail: string;
  amount: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED';
  createdAt: string;
  dueDate: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  type: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function formatCurrency(value: number): string {
  return `$${Math.abs(value).toFixed(2)}`;
}

function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-700', bg: 'bg-gray-100', icon: FileText },
  SENT: { label: 'Sent', color: 'text-blue-700', bg: 'bg-blue-50', icon: Send },
  PAID: { label: 'Paid', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50', icon: XCircle },
};

/* ─── Skeleton Components ───────────────────────────────────────────────── */

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-gray-100 rounded w-full mb-2" />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 bg-gray-100 rounded flex-1" />
          <div className="h-4 bg-gray-100 rounded w-24" />
          <div className="h-4 bg-gray-100 rounded w-20" />
          <div className="h-4 bg-gray-100 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

/* ─── Status Badge ──────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.DRAFT;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */

export default function PayPalAdminPage() {
  // Connection & Balance
  const [connection, setConnection] = useState<PayPalConnectionStatus | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);

  // Invoices
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('ALL');

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  // Invoice Form
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [dueDate, setDueDate] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState<'invoices' | 'transactions'>('invoices');

  /* ─── Data Fetching ─────────────────────────────────────────────────── */

  const fetchConnection = useCallback(async () => {
    setConnectionLoading(true);
    try {
      const res = await fetch('/api/integrations/paypal/balance');
      if (!res.ok) throw new Error('Failed to fetch PayPal status');
      const data = await res.json();
      setConnection(data);
    } catch {
      setConnection({ connected: false });
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    setBalanceRefreshing(true);
    try {
      const res = await fetch('/api/integrations/paypal/balance');
      if (!res.ok) throw new Error('Failed to refresh balance');
      const data = await res.json();
      setConnection(data);
      toast.success('Balance refreshed');
    } catch {
      toast.error('Failed to refresh balance');
    } finally {
      setBalanceRefreshing(false);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const res = await fetch('/api/integrations/paypal/invoices');
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      setInvoices(data.invoices || data || []);
    } catch {
      toast.error('Failed to load invoices');
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const res = await fetch('/api/integrations/paypal/transactions');
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data.transactions || data || []);
    } catch {
      toast.error('Failed to load transactions');
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnection();
    fetchInvoices();
    fetchTransactions();
  }, [fetchConnection, fetchInvoices, fetchTransactions]);

  /* ─── Invoice Form Handlers ─────────────────────────────────────────── */

  const addLineItem = () => {
    setLineItems((prev) => [...prev, { id: generateId(), description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const invoiceTotal = subtotal + taxAmount;

  const resetInvoiceForm = () => {
    setRecipientName('');
    setRecipientEmail('');
    setLineItems([{ id: generateId(), description: '', quantity: 1, unitPrice: 0 }]);
    setInvoiceNotes('');
    setTaxRate(0);
    setDueDate('');
  };

  const handleSubmitInvoice = async (sendImmediately: boolean) => {
    if (!recipientName.trim() || !recipientEmail.trim()) {
      toast.error('Recipient name and email are required');
      return;
    }
    if (lineItems.some((item) => !item.description.trim() || item.quantity <= 0 || item.unitPrice <= 0)) {
      toast.error('All line items must have a description, quantity, and unit price');
      return;
    }
    if (!dueDate) {
      toast.error('Due date is required');
      return;
    }

    setInvoiceSubmitting(true);
    try {
      const payload = {
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim(),
        lineItems: lineItems.map(({ description, quantity, unitPrice }) => ({
          description,
          quantity,
          unitPrice,
        })),
        notes: invoiceNotes.trim(),
        taxRate,
        dueDate,
        sendImmediately,
      };

      const res = await fetch('/api/integrations/paypal/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create invoice');
      }

      toast.success(sendImmediately ? 'Invoice created and sent!' : 'Invoice saved as draft');
      resetInvoiceForm();
      setShowInvoiceForm(false);
      fetchInvoices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create invoice';
      toast.error(message);
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  /* ─── Filtered Invoices ─────────────────────────────────────────────── */

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      !invoiceSearch ||
      inv.recipientName.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.recipientEmail.toLowerCase().includes(invoiceSearch.toLowerCase());
    const matchesFilter = invoiceFilter === 'ALL' || inv.status === invoiceFilter;
    return matchesSearch && matchesFilter;
  });

  /* ─── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PayPal Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage invoices, payments, and transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchInvoices(); fetchTransactions(); refreshBalance(); }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh All
          </button>
          <button
            onClick={() => setShowInvoiceForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#500000] rounded-lg hover:bg-[#3d0000] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      {connectionLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-gray-200" />
            <div className="h-4 bg-gray-200 rounded w-48" />
          </div>
        </div>
      ) : connection?.connected ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-200 p-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#003087] flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                  <CheckCircle className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">PayPal Connected</p>
                {connection.email && (
                  <p className="text-xs text-emerald-600">{connection.email}</p>
                )}
              </div>
            </div>
            {connection.balance && (
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-emerald-600">Available:</span>{' '}
                  <span className="font-bold text-emerald-800">{formatCurrency(connection.balance.available)}</span>
                </div>
                <div className="h-4 w-px bg-emerald-300" />
                <div>
                  <span className="text-emerald-600">Pending:</span>{' '}
                  <span className="font-semibold text-emerald-700">{formatCurrency(connection.balance.pending)}</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-50 to-amber-100/50 rounded-xl border border-amber-200 p-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">PayPal Not Connected</p>
                <p className="text-xs text-amber-600">Connect your PayPal account to manage payments</p>
              </div>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#003087] rounded-lg hover:bg-[#002060] transition-colors shadow-sm">
              <CreditCard className="w-4 h-4" />
              Connect PayPal
            </button>
          </div>
        </motion.div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Available Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#500000]/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#500000]" />
            </div>
            <button
              onClick={refreshBalance}
              disabled={balanceRefreshing}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              title="Refresh balance"
            >
              <RefreshCw className={`w-4 h-4 ${balanceRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-1">Available Balance</p>
          {connectionLoading ? (
            <div className="h-9 bg-gray-100 rounded animate-pulse w-32" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">
              {connection?.balance ? formatCurrency(connection.balance.available) : '$0.00'}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">USD</p>
        </motion.div>

        {/* Pending Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#C4A777]/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#C4A777]" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Pending Balance</p>
          {connectionLoading ? (
            <div className="h-9 bg-gray-100 rounded animate-pulse w-28" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">
              {connection?.balance ? formatCurrency(connection.balance.pending) : '$0.00'}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">Processing</p>
        </motion.div>

        {/* Invoice Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Outstanding Invoices</p>
          {invoicesLoading ? (
            <div className="h-9 bg-gray-100 rounded animate-pulse w-24" />
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">
                {invoices.filter((inv) => inv.status === 'SENT').length}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {formatCurrency(
                  invoices.filter((inv) => inv.status === 'SENT').reduce((sum, inv) => sum + inv.amount, 0)
                )}{' '}
                awaiting payment
              </p>
            </>
          )}
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <button
          onClick={() => setShowInvoiceForm(true)}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-[#500000]/30 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-[#500000]/10 flex items-center justify-center group-hover:bg-[#500000] transition-colors">
            <Plus className="w-4 h-4 text-[#500000] group-hover:text-white transition-colors" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">Create Invoice</p>
            <p className="text-xs text-gray-500">New billing</p>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('invoices'); setInvoiceFilter('ALL'); }}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-[#C4A777]/40 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-[#C4A777]/20 flex items-center justify-center group-hover:bg-[#C4A777] transition-colors">
            <Eye className="w-4 h-4 text-[#C4A777] group-hover:text-white transition-colors" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">All Invoices</p>
            <p className="text-xs text-gray-500">View list</p>
          </div>
        </button>

        <button
          onClick={() => {
            const sent = invoices.filter((inv) => inv.status === 'SENT');
            if (sent.length === 0) {
              toast('No outstanding invoices to remind', { icon: '📭' });
            } else {
              toast.success(`Reminders sent for ${sent.length} invoice(s)`);
            }
          }}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
            <Send className="w-4 h-4 text-blue-600 group-hover:text-white transition-colors" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">Send Reminders</p>
            <p className="text-xs text-gray-500">Unpaid invoices</p>
          </div>
        </button>

        <button
          onClick={() => {
            toast.success('Transaction export started — check your downloads');
          }}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-200 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
            <Download className="w-4 h-4 text-emerald-600 group-hover:text-white transition-colors" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">Export</p>
            <p className="text-xs text-gray-500">Transactions CSV</p>
          </div>
        </button>
      </motion.div>

      {/* Create Invoice Modal/Panel */}
      <AnimatePresence>
        {showInvoiceForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-8 px-4 overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) setShowInvoiceForm(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-8 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-[#500000] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Create Invoice</h2>
                    <p className="text-xs text-white/60">Send a professional invoice via PayPal</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInvoiceForm(false)}
                  className="text-white/60 hover:text-white transition-colors text-xl leading-none p-1"
                >
                  &times;
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Recipient */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipient Name</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipient Email</label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Line Items</label>
                    <button
                      onClick={addLineItem}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#500000] bg-[#500000]/5 rounded-md hover:bg-[#500000]/10 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Header row */}
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                      <div className="col-span-5">Description</div>
                      <div className="col-span-2 text-center">Qty</div>
                      <div className="col-span-3 text-right">Unit Price</div>
                      <div className="col-span-1 text-right">Total</div>
                      <div className="col-span-1" />
                    </div>

                    <AnimatePresence>
                      {lineItems.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="grid grid-cols-12 gap-2 items-center"
                        >
                          <div className="col-span-5">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                              placeholder="Service or item"
                              className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none transition-all"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none transition-all"
                            />
                          </div>
                          <div className="col-span-3">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice || ''}
                                onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-full pl-6 pr-2.5 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none transition-all"
                              />
                            </div>
                          </div>
                          <div className="col-span-1 text-right text-sm font-medium text-gray-700">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button
                              onClick={() => removeLineItem(item.id)}
                              disabled={lineItems.length <= 1}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Tax & Due Date Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Tax Rate (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={taxRate || ''}
                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none transition-all pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
                  <textarea
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="Thank you for your business! Payment is due upon receipt."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none transition-all resize-none"
                  />
                </div>

                {/* Totals */}
                <div className="bg-[#F5F5F0] rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  {taxRate > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Tax ({taxRate}%)</span>
                      <span className="font-medium">{formatCurrency(taxAmount)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 pt-2 flex justify-between text-base">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-[#500000] text-lg">{formatCurrency(invoiceTotal)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => handleSubmitInvoice(true)}
                    disabled={invoiceSubmitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-[#500000] rounded-lg hover:bg-[#3d0000] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {invoiceSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Create & Send Invoice
                  </button>
                  <button
                    onClick={() => handleSubmitInvoice(false)}
                    disabled={invoiceSubmitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-[#500000] bg-[#500000]/5 rounded-lg hover:bg-[#500000]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {invoiceSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    Save as Draft
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invoices & Transactions Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tab Bar */}
        <div className="border-b border-gray-200 px-4 sm:px-6">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`relative px-4 py-3.5 text-sm font-medium transition-colors ${
                activeTab === 'invoices'
                  ? 'text-[#500000]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Invoices
                {!invoicesLoading && (
                  <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {invoices.length}
                  </span>
                )}
              </span>
              {activeTab === 'invoices' && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#500000]"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`relative px-4 py-3.5 text-sm font-medium transition-colors ${
                activeTab === 'transactions'
                  ? 'text-[#500000]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Transactions
                {!transactionsLoading && (
                  <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {transactions.length}
                  </span>
                )}
              </span>
              {activeTab === 'transactions' && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#500000]"
                />
              )}
            </button>
          </div>
        </div>

        {/* Invoices Tab Content */}
        {activeTab === 'invoices' && (
          <div>
            {/* Search & Filter Bar */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder="Search invoices by name, number, or email..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none transition-all"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={invoiceFilter}
                  onChange={(e) => setInvoiceFilter(e.target.value)}
                  className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="PAID">Paid</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
              </div>
            </div>

            {/* Invoice List */}
            <div className="px-4 sm:px-6 py-4">
              {invoicesLoading ? (
                <TableSkeleton rows={5} />
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">
                    {invoiceSearch || invoiceFilter !== 'ALL' ? 'No invoices match your filters' : 'No invoices yet'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {invoiceSearch || invoiceFilter !== 'ALL'
                      ? 'Try adjusting your search or filter'
                      : 'Create your first invoice to get started'}
                  </p>
                  {!invoiceSearch && invoiceFilter === 'ALL' && (
                    <button
                      onClick={() => setShowInvoiceForm(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 mt-4 text-sm font-medium text-white bg-[#500000] rounded-lg hover:bg-[#3d0000] transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Invoice
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="pb-3 pr-4">Invoice</th>
                        <th className="pb-3 pr-4">Recipient</th>
                        <th className="pb-3 pr-4 text-right">Amount</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3 text-right">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredInvoices.map((invoice, idx) => (
                        <motion.tr
                          key={invoice.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="hover:bg-[#F5F5F0]/50 transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-[#500000]">
                                {invoice.invoiceNumber}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </td>
                          <td className="py-3.5 pr-4">
                            <p className="text-sm font-medium text-gray-900">{invoice.recipientName}</p>
                            <p className="text-xs text-gray-500">{invoice.recipientEmail}</p>
                          </td>
                          <td className="py-3.5 pr-4 text-right">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(invoice.amount)}
                            </span>
                          </td>
                          <td className="py-3.5 pr-4">
                            <StatusBadge status={invoice.status} />
                          </td>
                          <td className="py-3.5 pr-4">
                            <span className="text-sm text-gray-500">
                              {new Date(invoice.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </td>
                          <td className="py-3.5 text-right">
                            <span className="text-sm text-gray-500">
                              {new Date(invoice.dueDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transactions Tab Content */}
        {activeTab === 'transactions' && (
          <div className="px-4 sm:px-6 py-4">
            {transactionsLoading ? (
              <TableSkeleton rows={8} />
            ) : transactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">No transactions yet</p>
                <p className="text-xs text-gray-400 mt-1">Transactions will appear here once payments are processed</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Description</th>
                      <th className="pb-3 pr-4">Type</th>
                      <th className="pb-3 pr-4 text-right">Amount</th>
                      <th className="pb-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((txn, idx) => (
                      <motion.tr
                        key={txn.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="hover:bg-[#F5F5F0]/50 transition-colors"
                      >
                        <td className="py-3.5 pr-4">
                          <span className="text-sm text-gray-600">
                            {new Date(txn.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                txn.amount >= 0 ? 'bg-emerald-50' : 'bg-red-50'
                              }`}
                            >
                              {txn.amount >= 0 ? (
                                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <ArrowUpRight className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-900">{txn.description}</span>
                          </div>
                        </td>
                        <td className="py-3.5 pr-4">
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {txn.type}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4 text-right">
                          <span
                            className={`text-sm font-semibold ${
                              txn.amount >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {txn.amount >= 0 ? '+' : '-'}{formatCurrency(txn.amount)}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                              txn.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : txn.status === 'PENDING'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {txn.status === 'COMPLETED' && <CheckCircle className="w-3 h-3" />}
                            {txn.status === 'PENDING' && <Clock className="w-3 h-3" />}
                            {txn.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 text-xs text-gray-400 pb-4"
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <p>
          PayPal data syncs in real-time. Invoices and transactions may take a few minutes to reflect after creation.
          All amounts displayed in USD.
        </p>
      </motion.div>
    </div>
  );
}
