'use client';

import { useState, useMemo } from 'react';
import {
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Building2,
  Tag,
  ArrowUpRight,
  CreditCard,
  FileText,
  Zap,
  Wrench,
  Shield,
  Home,
  Droplets,
  Package,
} from 'lucide-react';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

type BillStatus = 'paid' | 'due' | 'overdue' | 'scheduled';
type BillCategory = 'utilities' | 'supplies' | 'maintenance' | 'insurance' | 'mortgage' | 'property_tax' | 'cleaning' | 'landscaping' | 'pest_control' | 'software' | 'legal';

interface Bill {
  id: string;
  vendor: string;
  vendorContact: string;
  category: BillCategory;
  description: string;
  amount: number;
  dueDate: string;
  status: BillStatus;
  invoiceRef: string;
  recurring: boolean;
  properties: string;
}

const categoryConfig: Record<BillCategory, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  utilities: { label: 'Utilities', icon: Zap, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  supplies: { label: 'Supplies', icon: Package, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  insurance: { label: 'Insurance', icon: Shield, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  mortgage: { label: 'Mortgage', icon: Home, color: 'text-[#500000]', bgColor: 'bg-[#500000]/5' },
  property_tax: { label: 'Property Tax', icon: Building2, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  cleaning: { label: 'Cleaning', icon: Droplets, color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  landscaping: { label: 'Landscaping', icon: Tag, color: 'text-green-600', bgColor: 'bg-green-50' },
  pest_control: { label: 'Pest Control', icon: Tag, color: 'text-red-600', bgColor: 'bg-red-50' },
  software: { label: 'Software', icon: Tag, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  legal: { label: 'Legal', icon: FileText, color: 'text-stone-600', bgColor: 'bg-stone-50' },
};

const statusConfig: Record<BillStatus, { label: string; color: string; bgColor: string }> = {
  paid: { label: 'Paid', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  due: { label: 'Due', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  overdue: { label: 'Overdue', color: 'text-red-700', bgColor: 'bg-red-100' },
  scheduled: { label: 'Scheduled', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

const mockBills: Bill[] = [];

export default function AccountsPayablePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 8;

  const filteredBills = useMemo(() => {
    return mockBills.filter((bill) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !bill.vendor.toLowerCase().includes(q) &&
          !bill.description.toLowerCase().includes(q) &&
          !bill.invoiceRef.toLowerCase().includes(q)
        )
          return false;
      }
      if (filterCategory !== 'all' && bill.category !== filterCategory) return false;
      if (filterStatus !== 'all' && bill.status !== filterStatus) return false;
      return true;
    });
  }, [searchQuery, filterCategory, filterStatus]);

  const totalPages = Math.ceil(filteredBills.length / perPage);
  const paginatedBills = filteredBills.slice((currentPage - 1) * perPage, currentPage * perPage);

  const unpaidBills = mockBills.filter((b) => b.status !== 'paid');
  const totalAP = unpaidBills.reduce((s, b) => s + b.amount, 0);
  const overdueBills = mockBills.filter((b) => b.status === 'overdue');
  const overdueTotal = overdueBills.reduce((s, b) => s + b.amount, 0);

  const today = new Date('2026-03-17');
  const weekFromNow = new Date('2026-03-24');
  const dueThisWeek = mockBills
    .filter((b) => {
      const due = new Date(b.dueDate);
      return b.status !== 'paid' && due >= today && due <= weekFromNow;
    })
    .reduce((s, b) => s + b.amount, 0);

  const dueThisWeekCount = mockBills.filter((b) => {
    const due = new Date(b.dueDate);
    return b.status !== 'paid' && due >= today && due <= weekFromNow;
  }).length;

  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  function handleMarkPaid(billId: string) {
    setMarkingPaid(billId);
    setTimeout(() => setMarkingPaid(null), 1500);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts Payable</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bills & expenses &middot; {unpaidBills.length} outstanding
          </p>
        </div>
        <button className="flex items-center gap-1.5 text-sm bg-[#500000] text-white px-4 py-2 rounded-lg hover:bg-[#3C1518] transition-colors">
          <FileText className="w-4 h-4" />
          Add Bill
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total A/P</span>
            <div className="w-8 h-8 rounded-lg bg-[#500000]/5 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[#500000]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(totalAP)}</p>
          <p className="text-xs text-gray-400 mt-1">{unpaidBills.length} unpaid bills</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Due This Week</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatMoney(dueThisWeek)}</p>
          <p className="text-xs text-gray-400 mt-1">{dueThisWeekCount} bills due by Mar 24</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Overdue</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600">{formatMoney(overdueTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{overdueBills.length} bills past due</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Paid This Month</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {formatMoney(mockBills.filter((b) => b.status === 'paid').reduce((s, b) => s + b.amount, 0))}
          </p>
          <p className="text-xs text-gray-400 mt-1">{mockBills.filter((b) => b.status === 'paid').length} bills paid</p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Expense Categories (Unpaid)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {Object.entries(categoryConfig)
            .map(([key, cfg]) => {
              const catBills = unpaidBills.filter((b) => b.category === key);
              const catTotal = catBills.reduce((s, b) => s + b.amount, 0);
              if (catTotal === 0) return null;
              const Icon = cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => { setFilterCategory(filterCategory === key ? 'all' : key); setCurrentPage(1); }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                    filterCategory === key
                      ? 'border-[#500000] bg-[#500000]/5 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg ${cfg.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center leading-tight">{cfg.label}</span>
                  <span className="text-xs font-semibold text-gray-900">{formatMoney(catTotal)}</span>
                  <span className="text-[10px] text-gray-400">{catBills.length} bills</span>
                </button>
              );
            })
            .filter(Boolean)}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by vendor, description, or invoice #..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
          >
            <option value="all">All Categories</option>
            {Object.entries(categoryConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="due">Due</option>
            <option value="overdue">Overdue</option>
            <option value="scheduled">Scheduled</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Vendor</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Category</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Description</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Due Date</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedBills.map((bill) => {
                const catCfg = categoryConfig[bill.category];
                const stCfg = statusConfig[bill.status];
                const CatIcon = catCfg.icon;
                const isPaid = bill.status === 'paid' || markingPaid === bill.id;
                return (
                  <tr key={bill.id} className={`hover:bg-gray-50/50 transition-colors ${isPaid ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg ${catCfg.bgColor} flex items-center justify-center shrink-0`}>
                          <Building2 className={`w-4 h-4 ${catCfg.color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{bill.vendor}</p>
                          <p className="text-xs text-gray-400 font-mono">{bill.invoiceRef}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <CatIcon className={`w-3.5 h-3.5 ${catCfg.color}`} />
                        <span className={`text-xs font-medium ${catCfg.color}`}>{catCfg.label}</span>
                      </div>
                      {bill.recurring && (
                        <span className="inline-flex items-center text-[10px] text-gray-400 mt-0.5">
                          <ArrowUpRight className="w-3 h-3 mr-0.5" />
                          Recurring
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-gray-700 truncate max-w-[220px]">{bill.description}</p>
                      <p className="text-xs text-gray-400">{bill.properties}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-gray-900">{formatMoney(bill.amount)}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className={`text-sm ${bill.status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {new Date(bill.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        markingPaid === bill.id
                          ? 'bg-emerald-100 text-emerald-700'
                          : `${stCfg.bgColor} ${stCfg.color}`
                      }`}>
                        {markingPaid === bill.id ? 'Paid!' : stCfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {bill.status !== 'paid' && markingPaid !== bill.id ? (
                        <button
                          onClick={() => handleMarkPaid(bill.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#500000] hover:text-[#3C1518] bg-[#500000]/5 hover:bg-[#500000]/10 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Mark Paid
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Paid
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginatedBills.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-500">
                    No bills match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Showing {((currentPage - 1) * perPage) + 1}-{Math.min(currentPage * perPage, filteredBills.length)} of {filteredBills.length}
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
    </div>
  );
}
