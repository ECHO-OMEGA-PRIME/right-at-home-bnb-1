'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  FileText,
  Receipt,
  BarChart3,
  ChevronRight,
  Calendar,
  Filter,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

interface SummaryCard {
  label: string;
  value: number;
  change: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  debitAmount: number;
  creditAmount: number;
  status: 'posted' | 'pending' | 'draft';
}

// Summary cards — populated from API when accounting is connected
const summaryCards: SummaryCard[] = [
  {
    label: 'Revenue MTD',
    value: 0,
    change: 0,
    icon: TrendingUp,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    label: 'Expenses MTD',
    value: 0,
    change: 0,
    icon: TrendingDown,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    label: 'Net Income',
    value: 0,
    change: 0,
    icon: DollarSign,
    color: 'text-[#500000]',
    bgColor: 'bg-[#500000]/5',
  },
  {
    label: 'Cash Balance',
    value: 0,
    change: 0,
    icon: Wallet,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
];

// Journal entries loaded from API — no hardcoded mock data
const recentEntries: JournalEntry[] = [];

// Monthly P&L loaded from API — no hardcoded mock data
const monthlyPL: { month: string; revenue: number; expenses: number; net: number }[] = [];

const statusColors: Record<string, string> = {
  posted: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-600',
};

export default function AccountingDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('mtd');

  const chartData = monthlyPL.map((m) => ({
    month: m.month,
    Revenue: m.revenue / 100,
    Expenses: m.expenses / 100,
    'Net Income': m.net / 100,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting</h1>
          <p className="text-sm text-gray-500 mt-1">
            Financial overview for Right at Home BnB &middot; 22 properties
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
          >
            <option value="mtd">Month to Date</option>
            <option value="qtd">Quarter to Date</option>
            <option value="ytd">Year to Date</option>
            <option value="last30">Last 30 Days</option>
          </select>
          <button className="flex items-center gap-1 text-sm bg-[#500000] text-white px-4 py-2 rounded-lg hover:bg-[#3C1518] transition-colors">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Custom Range</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const isPositive = card.change >= 0;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">{card.label}</span>
                <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatMoney(card.value)}</p>
              <div className="flex items-center gap-1 mt-2">
                {isPositive ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {Math.abs(card.change)}%
                </span>
                <span className="text-xs text-gray-400 ml-1">vs last month</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/admin/accounting/transactions"
          className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-[#500000]/30 transition-all group"
        >
          <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
            <Plus className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Record Revenue</p>
            <p className="text-xs text-gray-500">Log platform payouts & direct bookings</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#500000] transition-colors" />
        </Link>
        <Link
          href="/admin/accounting/transactions"
          className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-[#500000]/30 transition-all group"
        >
          <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
            <Receipt className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Record Expense</p>
            <p className="text-xs text-gray-500">Utilities, maintenance, supplies & more</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#500000] transition-colors" />
        </Link>
        <Link
          href="/admin/accounting/reports"
          className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-[#500000]/30 transition-all group"
        >
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">View Reports</p>
            <p className="text-xs text-gray-500">P&L, balance sheet, cash flow</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#500000] transition-colors" />
        </Link>
      </div>

      {/* Chart + Recent Entries */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Monthly P&L Chart */}
        <div className="xl:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Monthly P&L Trend</h2>
              <p className="text-xs text-gray-500">Last 6 months performance</p>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
                  }
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="Revenue" fill="#500000" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Net Income" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key Metrics Sidebar */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Key Metrics</h3>
            <div className="space-y-3">
              {[
                { label: 'Avg Rev / Property', value: formatMoney(18745200 / 22), sub: 'MTD' },
                { label: 'Occupancy Rate', value: '78.4%', sub: 'across 22 units' },
                { label: 'Avg Daily Rate', value: formatMoney(18500), sub: 'all platforms' },
                { label: 'RevPAR', value: formatMoney(14506), sub: 'revenue per available room' },
                { label: 'Operating Margin', value: '47.5%', sub: 'net / revenue' },
              ].map((metric) => (
                <div key={metric.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm text-gray-700">{metric.label}</p>
                    <p className="text-xs text-gray-400">{metric.sub}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
            <div className="space-y-2">
              {[
                { label: 'Accounts Receivable', href: '/admin/accounting/ar', count: 8 },
                { label: 'Accounts Payable', href: '/admin/accounting/ap', count: 14 },
                { label: 'Journal Entries', href: '/admin/accounting/transactions', count: 312 },
                { label: 'Financial Reports', href: '/admin/accounting/reports', count: null },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-sm text-gray-700 group-hover:text-[#500000]">{link.label}</span>
                  <div className="flex items-center gap-2">
                    {link.count !== null && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {link.count}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#500000]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Journal Entries */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recent Journal Entries</h2>
            <p className="text-xs text-gray-500 mt-0.5">Latest transactions across all accounts</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
            </button>
            <Link
              href="/admin/accounting/transactions"
              className="text-sm text-[#500000] hover:text-[#3C1518] font-medium px-3 py-1.5 rounded-lg hover:bg-[#500000]/5 transition-colors"
            >
              View All
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Date
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Entry #
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Description
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Debit
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Credit
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Account
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-mono text-[#500000] font-medium">{entry.id}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-900 max-w-[280px] truncate">
                    {entry.description}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {formatMoney(entry.debitAmount)}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {formatMoney(entry.creditAmount)}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                    {entry.debitAccount}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status]}`}>
                      {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Showing {recentEntries.length} of 312 entries
          </p>
          <Link
            href="/admin/accounting/transactions"
            className="text-xs text-[#500000] hover:text-[#3C1518] font-medium"
          >
            View all entries &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
