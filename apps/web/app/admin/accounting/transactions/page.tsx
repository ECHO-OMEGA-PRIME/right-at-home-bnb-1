'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Check,
  AlertCircle,
  Trash2,
  Calendar,
} from 'lucide-react';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

interface JournalLine {
  account: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  lines: JournalLine[];
  status: 'posted' | 'pending' | 'draft' | 'void';
  createdBy: string;
  type: 'revenue' | 'expense' | 'transfer' | 'adjustment';
}

const ACCOUNTS = [
  'Cash - Operating',
  'Cash - Reserves',
  'Accounts Receivable',
  'Security Deposits',
  'Rental Revenue',
  'Cleaning Revenue',
  'Late Fee Revenue',
  'Utilities Expense',
  'Cleaning Expense',
  'Maintenance & Repairs',
  'Insurance Expense',
  'Property Tax Expense',
  'Mortgage Interest',
  'Supplies Expense',
  'Accounts Payable',
  'Credit Card - Business',
  'Owner Equity',
  'Depreciation Expense',
  'Management Fees',
  'Platform Fees',
];

const mockEntries: JournalEntry[] = [
  {
    id: '1',
    date: '2026-03-15',
    entryNumber: 'JE-2026-0312',
    description: 'Airbnb payout - 14 properties (Mar 1-15)',
    lines: [
      { account: 'Cash - Operating', debit: 4231500, credit: 0 },
      { account: 'Platform Fees', debit: 423150, credit: 0 },
      { account: 'Rental Revenue', debit: 0, credit: 4654650 },
    ],
    status: 'posted',
    createdBy: 'System',
    type: 'revenue',
  },
  {
    id: '2',
    date: '2026-03-14',
    entryNumber: 'JE-2026-0311',
    description: 'Midland Electric - 22 units March billing',
    lines: [
      { account: 'Utilities Expense', debit: 486200, credit: 0 },
      { account: 'Cash - Operating', debit: 0, credit: 486200 },
    ],
    status: 'posted',
    createdBy: 'Bobby M.',
    type: 'expense',
  },
  {
    id: '3',
    date: '2026-03-13',
    entryNumber: 'JE-2026-0310',
    description: 'VRBO payout - 8 properties (Mar 1-14)',
    lines: [
      { account: 'Cash - Operating', debit: 2187400, credit: 0 },
      { account: 'Platform Fees', debit: 218740, credit: 0 },
      { account: 'Rental Revenue', debit: 0, credit: 2406140 },
    ],
    status: 'posted',
    createdBy: 'System',
    type: 'revenue',
  },
  {
    id: '4',
    date: '2026-03-12',
    entryNumber: 'JE-2026-0309',
    description: 'ABC Cleaning Services - deep cleans x6 turnovers',
    lines: [
      { account: 'Cleaning Expense', debit: 189000, credit: 0 },
      { account: 'Accounts Payable', debit: 0, credit: 189000 },
    ],
    status: 'pending',
    createdBy: 'Bobby M.',
    type: 'expense',
  },
  {
    id: '5',
    date: '2026-03-11',
    entryNumber: 'JE-2026-0308',
    description: 'Home Depot - maintenance supplies (filters, bulbs, hardware)',
    lines: [
      { account: 'Supplies Expense', debit: 43425, credit: 0 },
      { account: 'Maintenance & Repairs', debit: 30000, credit: 0 },
      { account: 'Credit Card - Business', debit: 0, credit: 73425 },
    ],
    status: 'posted',
    createdBy: 'Bobby M.',
    type: 'expense',
  },
  {
    id: '6',
    date: '2026-03-10',
    entryNumber: 'JE-2026-0307',
    description: 'Booking.com payout - 5 properties (Mar 1-10)',
    lines: [
      { account: 'Cash - Operating', debit: 1542800, credit: 0 },
      { account: 'Platform Fees', debit: 231420, credit: 0 },
      { account: 'Rental Revenue', debit: 0, credit: 1774220 },
    ],
    status: 'posted',
    createdBy: 'System',
    type: 'revenue',
  },
  {
    id: '7',
    date: '2026-03-09',
    entryNumber: 'JE-2026-0306',
    description: 'State Farm - property insurance Q1 installment',
    lines: [
      { account: 'Insurance Expense', debit: 345600, credit: 0 },
      { account: 'Cash - Operating', debit: 0, credit: 345600 },
    ],
    status: 'posted',
    createdBy: 'Bobby M.',
    type: 'expense',
  },
  {
    id: '8',
    date: '2026-03-08',
    entryNumber: 'JE-2026-0305',
    description: 'Guest damage deposit refund - Unit 7 (J. Rodriguez)',
    lines: [
      { account: 'Security Deposits', debit: 50000, credit: 0 },
      { account: 'Cash - Operating', debit: 0, credit: 50000 },
    ],
    status: 'draft',
    createdBy: 'Bobby M.',
    type: 'adjustment',
  },
  {
    id: '9',
    date: '2026-03-07',
    entryNumber: 'JE-2026-0304',
    description: 'Midland County - property tax payment (22 parcels)',
    lines: [
      { account: 'Property Tax Expense', debit: 1876500, credit: 0 },
      { account: 'Cash - Reserves', debit: 0, credit: 1876500 },
    ],
    status: 'posted',
    createdBy: 'Bobby M.',
    type: 'expense',
  },
  {
    id: '10',
    date: '2026-03-06',
    entryNumber: 'JE-2026-0303',
    description: 'Transfer from operating to reserves',
    lines: [
      { account: 'Cash - Reserves', debit: 500000, credit: 0 },
      { account: 'Cash - Operating', debit: 0, credit: 500000 },
    ],
    status: 'posted',
    createdBy: 'Bobby M.',
    type: 'transfer',
  },
  {
    id: '11',
    date: '2026-03-05',
    entryNumber: 'JE-2026-0302',
    description: 'Mortgage payments - 18 financed properties',
    lines: [
      { account: 'Mortgage Interest', debit: 2145000, credit: 0 },
      { account: 'Cash - Operating', debit: 0, credit: 2145000 },
    ],
    status: 'posted',
    createdBy: 'System',
    type: 'expense',
  },
  {
    id: '12',
    date: '2026-03-04',
    entryNumber: 'JE-2026-0301',
    description: 'Direct booking - Williams family, Unit 12 (7 nights)',
    lines: [
      { account: 'Accounts Receivable', debit: 245000, credit: 0 },
      { account: 'Rental Revenue', debit: 0, credit: 220500 },
      { account: 'Cleaning Revenue', debit: 0, credit: 24500 },
    ],
    status: 'posted',
    createdBy: 'Bobby M.',
    type: 'revenue',
  },
];

const statusColors: Record<string, string> = {
  posted: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-600',
  void: 'bg-red-100 text-red-700',
};

const typeColors: Record<string, string> = {
  revenue: 'text-emerald-600',
  expense: 'text-red-600',
  transfer: 'text-blue-600',
  adjustment: 'text-purple-600',
};

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState('2026-03-17');
  const [newLines, setNewLines] = useState<JournalLine[]>([
    { account: '', debit: 0, credit: 0 },
    { account: '', debit: 0, credit: 0 },
  ]);

  const perPage = 8;

  const filteredEntries = useMemo(() => {
    return mockEntries.filter((entry) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          entry.description.toLowerCase().includes(q) ||
          entry.entryNumber.toLowerCase().includes(q) ||
          entry.lines.some((l) => l.account.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }
      if (filterType !== 'all' && entry.type !== filterType) return false;
      if (filterStatus !== 'all' && entry.status !== filterStatus) return false;
      if (filterAccount !== 'all' && !entry.lines.some((l) => l.account === filterAccount)) return false;
      return true;
    });
  }, [searchQuery, filterType, filterStatus, filterAccount]);

  const totalPages = Math.ceil(filteredEntries.length / perPage);
  const paginatedEntries = filteredEntries.slice((currentPage - 1) * perPage, currentPage * perPage);

  const totalDebits = (entry: JournalEntry) => entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = (entry: JournalEntry) => entry.lines.reduce((sum, l) => sum + l.credit, 0);

  const newEntryTotalDebits = newLines.reduce((sum, l) => sum + l.debit, 0);
  const newEntryTotalCredits = newLines.reduce((sum, l) => sum + l.credit, 0);
  const isBalanced = newEntryTotalDebits === newEntryTotalCredits && newEntryTotalDebits > 0;

  function addLine() {
    setNewLines([...newLines, { account: '', debit: 0, credit: 0 }]);
  }

  function removeLine(index: number) {
    if (newLines.length <= 2) return;
    setNewLines(newLines.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof JournalLine, value: string | number) {
    const updated = [...newLines];
    if (field === 'account') {
      updated[index] = { ...updated[index], account: value as string };
    } else {
      updated[index] = { ...updated[index], [field]: Number(value) };
    }
    setNewLines(updated);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredEntries.length} entries &middot; Double-entry bookkeeping
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewEntry(true)}
            className="flex items-center gap-1.5 text-sm bg-[#500000] text-white px-4 py-2 rounded-lg hover:bg-[#3C1518] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </button>
          <button className="flex items-center gap-1.5 text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search entries by description, number, or account..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border transition-colors ${
              showFilters
                ? 'border-[#500000] text-[#500000] bg-[#500000]/5'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
              >
                <option value="all">All Types</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="posted">Posted</option>
                <option value="pending">Pending</option>
                <option value="draft">Draft</option>
                <option value="void">Void</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Account</label>
              <select
                value={filterAccount}
                onChange={(e) => { setFilterAccount(e.target.value); setCurrentPage(1); }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
              >
                <option value="all">All Accounts</option>
                {ACCOUNTS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Entries Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Entry #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Description</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Accounts</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Debit Total</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Credit Total</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-mono font-medium text-[#500000]">{entry.entryNumber}</span>
                  </td>
                  <td className="px-5 py-3.5 max-w-[240px]">
                    <p className="text-sm text-gray-900 truncate">{entry.description}</p>
                    <span className={`text-xs font-medium capitalize ${typeColors[entry.type]}`}>{entry.type}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="space-y-0.5">
                      {entry.lines.slice(0, 2).map((line, i) => (
                        <p key={i} className="text-xs text-gray-500 truncate max-w-[180px]">
                          {line.debit > 0 ? 'DR' : 'CR'}: {line.account}
                        </p>
                      ))}
                      {entry.lines.length > 2 && (
                        <p className="text-xs text-gray-400">+{entry.lines.length - 2} more</p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900 text-right whitespace-nowrap">
                    {formatMoney(totalDebits(entry))}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900 text-right whitespace-nowrap">
                    {formatMoney(totalCredits(entry))}
                  </td>
                  <td className="px-5 py-3.5 text-center whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status]}`}>
                      {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
              {paginatedEntries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <p className="text-sm text-gray-500">No journal entries match your filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Showing {((currentPage - 1) * perPage) + 1}-{Math.min(currentPage * perPage, filteredEntries.length)} of {filteredEntries.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-[#500000] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* New Entry Modal */}
      {showNewEntry && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">New Journal Entry</h2>
                <p className="text-xs text-gray-500 mt-0.5">Double-entry: debits must equal credits</p>
              </div>
              <button
                onClick={() => setShowNewEntry(false)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Entry Number</label>
                  <input
                    type="text"
                    value="JE-2026-0313"
                    readOnly
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g., Airbnb payout - March 16-31"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
                />
              </div>

              {/* Journal Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">Line Items</label>
                  <button
                    onClick={addLine}
                    className="flex items-center gap-1 text-xs text-[#500000] hover:text-[#3C1518] font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Line
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[1fr_100px_100px_40px] gap-0 bg-gray-50 px-3 py-2">
                    <span className="text-xs font-medium text-gray-500">Account</span>
                    <span className="text-xs font-medium text-gray-500 text-right">Debit</span>
                    <span className="text-xs font-medium text-gray-500 text-right">Credit</span>
                    <span></span>
                  </div>
                  {newLines.map((line, index) => (
                    <div key={index} className="grid grid-cols-[1fr_100px_100px_40px] gap-0 px-3 py-2 border-t border-gray-100 items-center">
                      <select
                        value={line.account}
                        onChange={(e) => updateLine(index, 'account', e.target.value)}
                        className="text-sm border border-gray-200 rounded px-2 py-1.5 mr-2 focus:ring-1 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
                      >
                        <option value="">Select account...</option>
                        {ACCOUNTS.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={line.debit || ''}
                        onChange={(e) => updateLine(index, 'debit', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="text-sm text-right border border-gray-200 rounded px-2 py-1.5 w-full focus:ring-1 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={line.credit || ''}
                        onChange={(e) => updateLine(index, 'credit', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="text-sm text-right border border-gray-200 rounded px-2 py-1.5 w-full focus:ring-1 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
                      />
                      <button
                        onClick={() => removeLine(index)}
                        disabled={newLines.length <= 2}
                        className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors mx-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {/* Totals Row */}
                  <div className="grid grid-cols-[1fr_100px_100px_40px] gap-0 px-3 py-2 border-t-2 border-gray-200 bg-gray-50">
                    <span className="text-xs font-semibold text-gray-700">Totals</span>
                    <span className="text-xs font-semibold text-gray-900 text-right">{formatMoney(newEntryTotalDebits)}</span>
                    <span className="text-xs font-semibold text-gray-900 text-right">{formatMoney(newEntryTotalCredits)}</span>
                    <span></span>
                  </div>
                </div>

                {/* Balance indicator */}
                <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${isBalanced ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {isBalanced ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Entry is balanced
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      Debits must equal credits (difference: {formatMoney(Math.abs(newEntryTotalDebits - newEntryTotalCredits))})
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowNewEntry(false)}
                className="text-sm text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Save Draft
              </button>
              <button
                disabled={!isBalanced || !newDescription}
                className="text-sm bg-[#500000] text-white px-4 py-2 rounded-lg hover:bg-[#3C1518] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Post Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
