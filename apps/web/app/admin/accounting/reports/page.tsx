'use client';

import { useState } from 'react';
import {
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  DollarSign,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

type ReportTab = 'pnl' | 'balance' | 'cashflow';

const pnlData: { revenue: { label: string; amount: number }[]; expenses: { label: string; amount: number }[] } = {
  revenue: [
    { label: 'Airbnb Revenue', amount: 9845200 },
    { label: 'VRBO Revenue', amount: 4312800 },
    { label: 'Booking.com Revenue', amount: 2876400 },
    { label: 'Direct Bookings', amount: 1245000 },
    { label: 'Cleaning Fees', amount: 312000 },
    { label: 'Late Fees & Penalties', amount: 45800 },
    { label: 'Pet Fees', amount: 108000 },
  ],
  expenses: [
    { label: 'Mortgage Interest', amount: 2145000 },
    { label: 'Property Taxes', amount: 1876500 },
    { label: 'Utilities (Electric/Gas/Water)', amount: 486200 },
    { label: 'Internet & Cable (22 units)', amount: 154000 },
    { label: 'Insurance', amount: 345600 },
    { label: 'Cleaning Services', amount: 756000 },
    { label: 'Maintenance & Repairs', amount: 423500 },
    { label: 'Supplies & Amenities', amount: 198400 },
    { label: 'Platform Fees (Airbnb/VRBO)', amount: 873310 },
    { label: 'Property Management Software', amount: 44900 },
    { label: 'Landscaping', amount: 132000 },
    { label: 'Pest Control', amount: 66000 },
    { label: 'Marketing & Advertising', amount: 89500 },
    { label: 'Legal & Professional', amount: 125000 },
    { label: 'Depreciation', amount: 812000 },
    { label: 'Miscellaneous', amount: 45200 },
  ],
};

const balanceSheetData = {
  assets: {
    current: [
      { label: 'Cash - Operating Account', amount: 2452180 },
      { label: 'Cash - Reserve Account', amount: 1000000 },
      { label: 'Accounts Receivable', amount: 487500 },
      { label: 'Security Deposits Held', amount: 220000 },
      { label: 'Prepaid Insurance', amount: 172800 },
      { label: 'Supplies Inventory', amount: 34500 },
    ],
    fixed: [
      { label: 'Real Estate - 22 Properties', amount: 485000000 },
      { label: 'Furniture & Fixtures', amount: 44000000 },
      { label: 'Appliances & Equipment', amount: 17600000 },
      { label: 'Less: Accumulated Depreciation', amount: -9744000 },
    ],
  },
  liabilities: {
    current: [
      { label: 'Accounts Payable', amount: 345600 },
      { label: 'Credit Card Balance', amount: 187200 },
      { label: 'Accrued Expenses', amount: 234500 },
      { label: 'Security Deposits Liability', amount: 220000 },
      { label: 'Current Portion of Mortgages', amount: 1560000 },
    ],
    longTerm: [
      { label: 'Mortgage Payable (18 properties)', amount: 321000000 },
      { label: 'Equipment Loans', amount: 2400000 },
    ],
  },
  equity: [
    { label: 'Owner\'s Equity - Bobby McWilliams', amount: 0 },
    { label: 'Retained Earnings', amount: 0 },
    { label: 'Current Year Net Income', amount: 8913100 },
  ],
};

const cashFlowData = {
  operating: [
    { label: 'Net Income', amount: 8913100 },
    { label: 'Add: Depreciation', amount: 812000 },
    { label: 'Decrease in Accounts Receivable', amount: 125000 },
    { label: 'Increase in Accounts Payable', amount: 87600 },
    { label: 'Increase in Accrued Expenses', amount: 45200 },
    { label: 'Decrease in Prepaid Expenses', amount: -57600 },
  ],
  investing: [
    { label: 'Purchase of Property (Unit 22)', amount: -22500000 },
    { label: 'Furniture & Fixtures - New Unit', amount: -2000000 },
    { label: 'Capital Improvements (5 units)', amount: -876500 },
    { label: 'Sale of Old Appliances', amount: 15000 },
  ],
  financing: [
    { label: 'New Mortgage - Unit 22', amount: 18000000 },
    { label: 'Mortgage Principal Payments', amount: -1560000 },
    { label: 'Owner Distributions', amount: -500000 },
    { label: 'Equipment Loan Proceeds', amount: 0 },
  ],
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('pnl');
  const [dateFrom, setDateFrom] = useState('2026-03-01');
  const [dateTo, setDateTo] = useState('2026-03-17');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    revenue: true,
    expenses: true,
    currentAssets: true,
    fixedAssets: true,
    currentLiabilities: true,
    longTermLiabilities: true,
    equity: true,
    operating: true,
    investing: true,
    financing: true,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const tabs: { key: ReportTab; label: string; icon: React.ElementType }[] = [
    { key: 'pnl', label: 'Profit & Loss', icon: TrendingUp },
    { key: 'balance', label: 'Balance Sheet', icon: BarChart3 },
    { key: 'cashflow', label: 'Cash Flow', icon: DollarSign },
  ];

  const totalRevenue = pnlData.revenue.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = pnlData.expenses.reduce((sum, item) => sum + item.amount, 0);
  const netIncome = totalRevenue - totalExpenses;

  const totalCurrentAssets = balanceSheetData.assets.current.reduce((s, i) => s + i.amount, 0);
  const totalFixedAssets = balanceSheetData.assets.fixed.reduce((s, i) => s + i.amount, 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const totalCurrentLiabilities = balanceSheetData.liabilities.current.reduce((s, i) => s + i.amount, 0);
  const totalLongTermLiabilities = balanceSheetData.liabilities.longTerm.reduce((s, i) => s + i.amount, 0);
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
  const totalEquity = totalAssets - totalLiabilities;

  const operatingCashFlow = cashFlowData.operating.reduce((s, i) => s + i.amount, 0);
  const investingCashFlow = cashFlowData.investing.reduce((s, i) => s + i.amount, 0);
  const financingCashFlow = cashFlowData.financing.reduce((s, i) => s + i.amount, 0);
  const netCashChange = operatingCashFlow + investingCashFlow + financingCashFlow;

  function exportCSV() {
    let csv = '';
    if (activeTab === 'pnl') {
      csv = 'Category,Item,Amount\n';
      pnlData.revenue.forEach((r) => { csv += `Revenue,${r.label},${(r.amount / 100).toFixed(2)}\n`; });
      csv += `Revenue,TOTAL REVENUE,${(totalRevenue / 100).toFixed(2)}\n`;
      pnlData.expenses.forEach((e) => { csv += `Expenses,${e.label},${(e.amount / 100).toFixed(2)}\n`; });
      csv += `Expenses,TOTAL EXPENSES,${(totalExpenses / 100).toFixed(2)}\n`;
      csv += `Net,NET INCOME,${(netIncome / 100).toFixed(2)}\n`;
    } else if (activeTab === 'balance') {
      csv = 'Category,Item,Amount\n';
      balanceSheetData.assets.current.forEach((a) => { csv += `Current Assets,${a.label},${(a.amount / 100).toFixed(2)}\n`; });
      balanceSheetData.assets.fixed.forEach((a) => { csv += `Fixed Assets,${a.label},${(a.amount / 100).toFixed(2)}\n`; });
      csv += `TOTAL,TOTAL ASSETS,${(totalAssets / 100).toFixed(2)}\n`;
      balanceSheetData.liabilities.current.forEach((l) => { csv += `Current Liabilities,${l.label},${(l.amount / 100).toFixed(2)}\n`; });
      balanceSheetData.liabilities.longTerm.forEach((l) => { csv += `Long-Term Liabilities,${l.label},${(l.amount / 100).toFixed(2)}\n`; });
      csv += `TOTAL,TOTAL LIABILITIES,${(totalLiabilities / 100).toFixed(2)}\n`;
      csv += `TOTAL,TOTAL EQUITY,${(totalEquity / 100).toFixed(2)}\n`;
    } else {
      csv = 'Category,Item,Amount\n';
      cashFlowData.operating.forEach((o) => { csv += `Operating,${o.label},${(o.amount / 100).toFixed(2)}\n`; });
      cashFlowData.investing.forEach((i) => { csv += `Investing,${i.label},${(i.amount / 100).toFixed(2)}\n`; });
      cashFlowData.financing.forEach((f) => { csv += `Financing,${f.label},${(f.amount / 100).toFixed(2)}\n`; });
      csv += `Net,NET CHANGE IN CASH,${(netCashChange / 100).toFixed(2)}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rah-bnb-${activeTab}-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderSection(
    title: string,
    sectionKey: string,
    items: { label: string; amount: number }[],
    total: number,
    totalLabel: string,
    colorClass: string
  ) {
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center justify-between w-full px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections[sectionKey] ? '' : '-rotate-90'}`} />
        </button>
        {expandedSections[sectionKey] && (
          <div>
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-2.5 border-t border-gray-100 hover:bg-gray-50/50"
              >
                <span className="text-sm text-gray-700 pl-4">{item.label}</span>
                <span className={`text-sm font-medium ${item.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {item.amount < 0 ? `(${formatMoney(Math.abs(item.amount))})` : formatMoney(item.amount)}
                </span>
              </div>
            ))}
            <div className={`flex items-center justify-between px-5 py-3 border-t-2 border-gray-300 bg-gray-50 ${colorClass}`}>
              <span className="text-sm font-bold">{totalLabel}</span>
              <span className="text-sm font-bold">{total < 0 ? `(${formatMoney(Math.abs(total))})` : formatMoney(total)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Right at Home BnB &middot; 22 properties &middot; Midland, TX
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 text-sm bg-[#500000] text-white px-4 py-2 rounded-lg hover:bg-[#3C1518] transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="font-medium">Report Period:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
            />
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] outline-none"
            />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {['MTD', 'QTD', 'YTD', '2025'].map((preset) => (
              <button
                key={preset}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-[#500000] text-[#500000] bg-[#500000]/5'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {/* P&L Statement */}
          {activeTab === 'pnl' && (
            <div className="space-y-4">
              <div className="text-center pb-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Profit & Loss Statement</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Right at Home BnB LLC &middot; {new Date(dateFrom).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {new Date(dateTo).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                  <p className="text-xs font-medium text-emerald-600 uppercase">Total Revenue</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{formatMoney(totalRevenue)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-xs font-medium text-red-600 uppercase">Total Expenses</p>
                  <p className="text-xl font-bold text-red-700 mt-1">{formatMoney(totalExpenses)}</p>
                </div>
                <div className={`rounded-lg p-4 border ${netIncome >= 0 ? 'bg-[#500000]/5 border-[#500000]/20' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-xs font-medium uppercase ${netIncome >= 0 ? 'text-[#500000]' : 'text-red-600'}`}>Net Income</p>
                  <p className={`text-xl font-bold mt-1 ${netIncome >= 0 ? 'text-[#500000]' : 'text-red-700'}`}>
                    {formatMoney(netIncome)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {((netIncome / totalRevenue) * 100).toFixed(1)}% margin
                  </p>
                </div>
              </div>

              {renderSection('Revenue', 'revenue', pnlData.revenue, totalRevenue, 'Total Revenue', 'text-emerald-700')}
              {renderSection('Operating Expenses', 'expenses', pnlData.expenses, totalExpenses, 'Total Expenses', 'text-red-700')}

              {/* Net Income */}
              <div className={`flex items-center justify-between px-5 py-4 rounded-lg border-2 ${netIncome >= 0 ? 'border-[#500000] bg-[#500000]/5' : 'border-red-500 bg-red-50'}`}>
                <div className="flex items-center gap-2">
                  {netIncome >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-[#500000]" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`text-base font-bold ${netIncome >= 0 ? 'text-[#500000]' : 'text-red-700'}`}>
                    NET INCOME
                  </span>
                </div>
                <span className={`text-lg font-bold ${netIncome >= 0 ? 'text-[#500000]' : 'text-red-700'}`}>
                  {formatMoney(netIncome)}
                </span>
              </div>
            </div>
          )}

          {/* Balance Sheet */}
          {activeTab === 'balance' && (
            <div className="space-y-4">
              <div className="text-center pb-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Balance Sheet</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Right at Home BnB LLC &middot; As of {new Date(dateTo).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-xs font-medium text-blue-600 uppercase">Total Assets</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{formatMoney(totalAssets)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <p className="text-xs font-medium text-amber-600 uppercase">Total Liabilities</p>
                  <p className="text-xl font-bold text-amber-700 mt-1">{formatMoney(totalLiabilities)}</p>
                </div>
                <div className="bg-[#500000]/5 rounded-lg p-4 border border-[#500000]/20">
                  <p className="text-xs font-medium text-[#500000] uppercase">Owner&apos;s Equity</p>
                  <p className="text-xl font-bold text-[#500000] mt-1">{formatMoney(totalEquity)}</p>
                </div>
              </div>

              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider pt-2">Assets</h3>
              {renderSection('Current Assets', 'currentAssets', balanceSheetData.assets.current, totalCurrentAssets, 'Total Current Assets', 'text-blue-700')}
              {renderSection('Fixed Assets (Property, Plant & Equipment)', 'fixedAssets', balanceSheetData.assets.fixed, totalFixedAssets, 'Total Fixed Assets', 'text-blue-700')}
              <div className="flex items-center justify-between px-5 py-3 rounded-lg bg-blue-50 border-2 border-blue-300">
                <span className="text-sm font-bold text-blue-800">TOTAL ASSETS</span>
                <span className="text-base font-bold text-blue-800">{formatMoney(totalAssets)}</span>
              </div>

              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider pt-2">Liabilities & Equity</h3>
              {renderSection('Current Liabilities', 'currentLiabilities', balanceSheetData.liabilities.current, totalCurrentLiabilities, 'Total Current Liabilities', 'text-amber-700')}
              {renderSection('Long-Term Liabilities', 'longTermLiabilities', balanceSheetData.liabilities.longTerm, totalLongTermLiabilities, 'Total Long-Term Liabilities', 'text-amber-700')}
              <div className="flex items-center justify-between px-5 py-3 rounded-lg bg-amber-50 border-2 border-amber-300">
                <span className="text-sm font-bold text-amber-800">TOTAL LIABILITIES</span>
                <span className="text-base font-bold text-amber-800">{formatMoney(totalLiabilities)}</span>
              </div>

              {renderSection(
                'Owner\'s Equity',
                'equity',
                [
                  ...balanceSheetData.equity.slice(0, -1),
                  { label: 'Current Year Net Income', amount: netIncome },
                  { label: 'Retained Earnings (Computed)', amount: totalEquity - netIncome },
                ],
                totalEquity,
                'Total Equity',
                'text-[#500000]'
              )}

              <div className="flex items-center justify-between px-5 py-4 rounded-lg border-2 border-[#500000] bg-[#500000]/5">
                <span className="text-base font-bold text-[#500000]">TOTAL LIABILITIES + EQUITY</span>
                <span className="text-lg font-bold text-[#500000]">{formatMoney(totalLiabilities + totalEquity)}</span>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-2">
                <PieChart className="w-3.5 h-3.5" />
                {totalAssets === totalLiabilities + totalEquity ? (
                  <span className="text-emerald-600 font-medium">Balance sheet is balanced</span>
                ) : (
                  <span className="text-red-600 font-medium">Warning: Balance sheet is not balanced</span>
                )}
              </div>
            </div>
          )}

          {/* Cash Flow Statement */}
          {activeTab === 'cashflow' && (
            <div className="space-y-4">
              <div className="text-center pb-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Cash Flow Statement</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Right at Home BnB LLC &middot; {new Date(dateFrom).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {new Date(dateTo).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                  <p className="text-xs font-medium text-emerald-600 uppercase">Operating</p>
                  <p className="text-lg font-bold text-emerald-700 mt-1">{formatMoney(operatingCashFlow)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-xs font-medium text-red-600 uppercase">Investing</p>
                  <p className="text-lg font-bold text-red-700 mt-1">{formatMoney(investingCashFlow)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-xs font-medium text-blue-600 uppercase">Financing</p>
                  <p className="text-lg font-bold text-blue-700 mt-1">{formatMoney(financingCashFlow)}</p>
                </div>
                <div className={`rounded-lg p-4 border ${netCashChange >= 0 ? 'bg-[#500000]/5 border-[#500000]/20' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-xs font-medium uppercase ${netCashChange >= 0 ? 'text-[#500000]' : 'text-red-600'}`}>Net Change</p>
                  <p className={`text-lg font-bold mt-1 ${netCashChange >= 0 ? 'text-[#500000]' : 'text-red-700'}`}>
                    {formatMoney(netCashChange)}
                  </p>
                </div>
              </div>

              {renderSection('Cash from Operating Activities', 'operating', cashFlowData.operating, operatingCashFlow, 'Net Cash from Operations', 'text-emerald-700')}
              {renderSection('Cash from Investing Activities', 'investing', cashFlowData.investing, investingCashFlow, 'Net Cash from Investing', 'text-red-700')}
              {renderSection('Cash from Financing Activities', 'financing', cashFlowData.financing, financingCashFlow, 'Net Cash from Financing', 'text-blue-700')}

              <div className={`flex items-center justify-between px-5 py-4 rounded-lg border-2 ${netCashChange >= 0 ? 'border-[#500000] bg-[#500000]/5' : 'border-red-500 bg-red-50'}`}>
                <span className={`text-base font-bold ${netCashChange >= 0 ? 'text-[#500000]' : 'text-red-700'}`}>
                  NET CHANGE IN CASH
                </span>
                <span className={`text-lg font-bold ${netCashChange >= 0 ? 'text-[#500000]' : 'text-red-700'}`}>
                  {formatMoney(netCashChange)}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Beginning Cash Balance</span>
                  <span className="font-medium text-gray-900">{formatMoney(3452180 - netCashChange)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600">Net Change in Cash</span>
                  <span className={`font-medium ${netCashChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {netCashChange >= 0 ? '+' : ''}{formatMoney(netCashChange)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Ending Cash Balance</span>
                  <span className="font-bold text-gray-900">{formatMoney(3452180)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
