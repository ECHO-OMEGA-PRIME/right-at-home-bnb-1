'use client';

import { useState, useMemo } from 'react';
import {
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
  Calendar,
  User,
  Home,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Receipt,
} from 'lucide-react';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  guest: string;
  guestEmail: string;
  property: string;
  propertyUnit: number;
  description: string;
  amount: number;
  paidAmount: number;
  issueDate: string;
  dueDate: string;
  status: 'paid' | 'current' | 'overdue-30' | 'overdue-60' | 'overdue-90';
  platform: 'Airbnb' | 'VRBO' | 'Booking.com' | 'Direct';
}

const mockInvoices: Invoice[] = [];

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  paid: { label: 'Paid', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  current: { label: 'Current', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  'overdue-30': { label: '30+ Days', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  'overdue-60': { label: '60+ Days', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  'overdue-90': { label: '90+ Days', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export default function AccountsReceivablePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('check');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 6;

  const filteredInvoices = useMemo(() => {
    return mockInvoices.filter((inv) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !inv.guest.toLowerCase().includes(q) &&
          !inv.invoiceNumber.toLowerCase().includes(q) &&
          !inv.property.toLowerCase().includes(q)
        )
          return false;
      }
      if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
      if (filterPlatform !== 'all' && inv.platform !== filterPlatform) return false;
      return true;
    });
  }, [searchQuery, filterStatus, filterPlatform]);

  const totalPages = Math.ceil(filteredInvoices.length / perPage);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * perPage, currentPage * perPage);

  const totalAR = mockInvoices.reduce((s, i) => s + (i.amount - i.paidAmount), 0);
  const currentBucket = mockInvoices.filter((i) => i.status === 'current').reduce((s, i) => s + (i.amount - i.paidAmount), 0);
  const bucket30 = mockInvoices.filter((i) => i.status === 'overdue-30').reduce((s, i) => s + (i.amount - i.paidAmount), 0);
  const bucket60 = mockInvoices.filter((i) => i.status === 'overdue-60').reduce((s, i) => s + (i.amount - i.paidAmount), 0);
  const bucket90 = mockInvoices.filter((i) => i.status === 'overdue-90').reduce((s, i) => s + (i.amount - i.paidAmount), 0);

  const daysOverdue = (dueDate: string): number => {
    const diff = new Date().getTime() - new Date(dueDate).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  const unpaidInvoices = mockInvoices.filter((i) => i.status !== 'paid');
  const avgDaysOutstanding = unpaidInvoices.length > 0
    ? Math.round(unpaidInvoices.reduce((s, i) => s + daysOverdue(i.dueDate), 0) / unpaidInvoices.length)
    : 0;

  function openPaymentModal(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setPaymentAmount(((invoice.amount - invoice.paidAmount) / 100).toFixed(2));
    setShowPaymentModal(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts Receivable</h1>
          <p className="text-sm text-gray-500 mt-1">
            Outstanding invoices &middot; {mockInvoices.filter((i) => i.status !== 'paid').length} open
          </p>
        </div>
        <button className="flex items-center gap-1.5 text-sm bg-[#500000] text-white px-4 py-2 rounded-lg hover:bg-[#3C1518] transition-colors">
          <Receipt className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total A/R</span>
            <div className="w-8 h-8 rounded-lg bg-[#500000]/5 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[#500000]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(totalAR)}</p>
          <p className="text-xs text-gray-400 mt-1">{mockInvoices.filter((i) => i.status !== 'paid').length} outstanding invoices</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Avg Days Outstanding</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{avgDaysOutstanding} days</p>
          <p className="text-xs text-gray-400 mt-1">target: &lt;30 days</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Overdue</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600">{formatMoney(bucket30 + bucket60 + bucket90)}</p>
          <p className="text-xs text-gray-400 mt-1">{mockInvoices.filter((i) => i.status.startsWith('overdue')).length} invoices past due</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Collection Rate</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">87.3%</p>
          <p className="text-xs text-gray-400 mt-1">last 90 days</p>
        </div>
      </div>

      {/* Aging Buckets */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Aging Summary</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Current', value: currentBucket, color: 'bg-blue-500', lightColor: 'bg-blue-50', textColor: 'text-blue-700' },
            { label: '1-30 Days', value: bucket30, color: 'bg-amber-500', lightColor: 'bg-amber-50', textColor: 'text-amber-700' },
            { label: '31-60 Days', value: bucket60, color: 'bg-orange-500', lightColor: 'bg-orange-50', textColor: 'text-orange-700' },
            { label: '61-90+ Days', value: bucket90, color: 'bg-red-500', lightColor: 'bg-red-50', textColor: 'text-red-700' },
          ].map((bucket) => {
            const pct = totalAR > 0 ? (bucket.value / totalAR) * 100 : 0;
            return (
              <div key={bucket.label} className={`${bucket.lightColor} rounded-lg p-3 border`}>
                <p className={`text-xs font-medium ${bucket.textColor}`}>{bucket.label}</p>
                <p className={`text-lg font-bold ${bucket.textColor} mt-1`}>{formatMoney(bucket.value)}</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div className={`${bucket.color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{pct.toFixed(1)}% of total</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by guest name, invoice #, or property..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="current">Current</option>
            <option value="overdue-30">30+ Days</option>
            <option value="overdue-60">60+ Days</option>
            <option value="overdue-90">90+ Days</option>
          </select>
          <select
            value={filterPlatform}
            onChange={(e) => { setFilterPlatform(e.target.value); setCurrentPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
          >
            <option value="all">All Platforms</option>
            <option value="Airbnb">Airbnb</option>
            <option value="VRBO">VRBO</option>
            <option value="Booking.com">Booking.com</option>
            <option value="Direct">Direct</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Guest</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Property</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Invoice</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Amount</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Balance</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Due Date</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedInvoices.map((inv) => {
                const balance = inv.amount - inv.paidAmount;
                const days = daysOverdue(inv.dueDate);
                const cfg = statusConfig[inv.status];
                return (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#500000]/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-[#500000]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{inv.guest}</p>
                          <p className="text-xs text-gray-400">{inv.platform}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Home className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-700 truncate">{inv.property}</p>
                          <p className="text-xs text-gray-400">Unit {inv.propertyUnit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-mono text-[#500000] font-medium">{inv.invoiceNumber}</span>
                      <p className="text-xs text-gray-400 truncate max-w-[160px]">{inv.description}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-medium text-gray-900">{formatMoney(inv.amount)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`text-sm font-semibold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatMoney(balance)}
                      </span>
                      {inv.paidAmount > 0 && (
                        <p className="text-xs text-gray-400">Paid: {formatMoney(inv.paidAmount)}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {days > 0 && (
                        <p className="text-xs text-red-500 font-medium">{days} days overdue</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bgColor} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => openPaymentModal(inv)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#500000] hover:text-[#3C1518] bg-[#500000]/5 hover:bg-[#500000]/10 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Record Payment
                      </button>
                    </td>
                  </tr>
                );
              })}
              {paginatedInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-gray-500">
                    No invoices match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Showing {((currentPage - 1) * perPage) + 1}-{Math.min(currentPage * perPage, filteredInvoices.length)} of {filteredInvoices.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  page === currentPage ? 'bg-[#500000] text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedInvoice.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Guest</span>
                  <span className="font-medium text-gray-900">{selectedInvoice.guest}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Property</span>
                  <span className="text-gray-700">{selectedInvoice.property}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Invoice Total</span>
                  <span className="font-medium text-gray-900">{formatMoney(selectedInvoice.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Already Paid</span>
                  <span className="text-emerald-600">{formatMoney(selectedInvoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="font-medium text-gray-900">Balance Due</span>
                  <span className="font-bold text-red-600">
                    {formatMoney(selectedInvoice.amount - selectedInvoice.paidAmount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
                >
                  <option value="check">Check</option>
                  <option value="ach">ACH / Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="cash">Cash</option>
                  <option value="venmo">Venmo</option>
                  <option value="zelle">Zelle</option>
                  <option value="platform">Platform Credit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  defaultValue="2026-03-17"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reference / Notes</label>
                <input
                  type="text"
                  placeholder="e.g., Check #4521"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-sm text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button className="text-sm bg-[#500000] text-white px-4 py-2 rounded-lg hover:bg-[#3C1518] transition-colors">
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
