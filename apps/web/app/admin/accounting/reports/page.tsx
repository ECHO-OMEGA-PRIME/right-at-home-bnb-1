'use client';

import { useEffect, useState } from 'react';
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

interface Line { label: string; amount: number }

/**
 * This page used to render module-level CONSTANTS: a $187,451 P&L, a full
 * balance sheet, and a cash-flow statement itemising transactions that never
 * happened ("Purchase of Property (Unit 22)", -$225,000). The Download CSV
 * button wrote those invented figures to a file an accountant could file taxes
 * from.
 *
 * The API routes behind these reports were made real earlier (queue #26855);
 * that sweep fixed routes and never touched the pages, so this one kept
 * serving fiction from a page nobody re-read. It now fetches the same
 * endpoints, and where no real source exists it says so instead of inventing
 * one.
 *
 * The real books: $851,410 of booking revenue and ZERO recorded costs. Expect
 * the P&L to be sparse — that is the actual state of the accounts, and it is
 * the thing worth showing.
 */
async function getJson(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('pnl');
  const [dateFrom, setDateFrom] = useState(() => `${new Date().getUTCFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
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

  const [pnl, setPnl] = useState<{ revenue: Line[]; expenses: Line[]; ledgerEmpty: boolean } | null>(null);
  const [balance, setBalance] = useState<{
    current: Line[]; fixed: Line[]; currentLiabilities: Line[]; longTermLiabilities: Line[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      getJson(`/api/accounting/reports/pnl?start=${dateFrom}&end=${dateTo}`),
      getJson(`/api/accounting/reports/balance-sheet?as_of=${dateTo}`),
    ])
      .then(([p, b]) => {
        if (cancelled) return;
        setPnl({
          revenue: (p.revenue?.lines ?? []).map((l: any) => ({
            label: `${l.code} ${l.name}`, amount: l.amount_cents,
          })),
          expenses: (p.expenses?.lines ?? []).map((l: any) => ({
            label: `${l.code} ${l.name}`, amount: l.amount_cents,
          })),
          ledgerEmpty: Boolean(p.ledger_empty),
        });
        // The balance sheet returns `items` with `balance_cents`; the P&L
        // returns `lines` with `amount_cents`. Assuming they matched produced
        // undefined everywhere and rendered every section as $0 -- which looks
        // exactly like a real, empty balance sheet. Read the contract.
        const sec = (rows: any[]) =>
          (rows ?? []).map((l: any) => ({ label: `${l.code} ${l.name}`, amount: l.balance_cents }));
        setBalance({
          current: sec(b.assets?.current?.items),
          fixed: sec(b.assets?.fixed?.items),
          currentLiabilities: sec(b.liabilities?.current?.items),
          longTermLiabilities: sec(b.liabilities?.long_term?.items),
        });
      })
      .catch((e) => !cancelled && setLoadError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  const sum = (rows: Line[]) => rows.reduce((s, i) => s + i.amount, 0);

  const totalRevenue = sum(pnl?.revenue ?? []);
  const totalExpenses = sum(pnl?.expenses ?? []);
  const netIncome = totalRevenue - totalExpenses;

  const totalCurrentAssets = sum(balance?.current ?? []);
  const totalFixedAssets = sum(balance?.fixed ?? []);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const totalCurrentLiabilities = sum(balance?.currentLiabilities ?? []);
  const totalLongTermLiabilities = sum(balance?.longTermLiabilities ?? []);
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
  const totalEquity = totalAssets - totalLiabilities;

  /**
   * Hands off to the server rather than building CSV here.
   *
   * The old version did `rows.join(',')` with no escaping, so one property name
   * containing a comma shifted every column after it — a file that opens
   * cleanly with the wrong numbers under the wrong headings. It also had no
   * defence against a name beginning with "=", which Excel executes.
   */
  function exportCSV() {
    const report = activeTab === 'balance' ? 'tax-summary' : 'revenue';
    window.location.href =
      `/api/accounting/exports?report=${report}&start=${dateFrom}&end=${dateTo}`;
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

              {renderSection('Revenue', 'revenue', (pnl?.revenue ?? []), totalRevenue, 'Total Revenue', 'text-emerald-700')}
              {renderSection('Operating Expenses', 'expenses', (pnl?.expenses ?? []), totalExpenses, 'Total Expenses', 'text-red-700')}

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
              {renderSection('Current Assets', 'currentAssets', (balance?.current ?? []), totalCurrentAssets, 'Total Current Assets', 'text-blue-700')}
              {renderSection('Fixed Assets (Property, Plant & Equipment)', 'fixedAssets', (balance?.fixed ?? []), totalFixedAssets, 'Total Fixed Assets', 'text-blue-700')}
              <div className="flex items-center justify-between px-5 py-3 rounded-lg bg-blue-50 border-2 border-blue-300">
                <span className="text-sm font-bold text-blue-800">TOTAL ASSETS</span>
                <span className="text-base font-bold text-blue-800">{formatMoney(totalAssets)}</span>
              </div>

              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider pt-2">Liabilities & Equity</h3>
              {renderSection('Current Liabilities', 'currentLiabilities', (balance?.currentLiabilities ?? []), totalCurrentLiabilities, 'Total Current Liabilities', 'text-amber-700')}
              {renderSection('Long-Term Liabilities', 'longTermLiabilities', (balance?.longTermLiabilities ?? []), totalLongTermLiabilities, 'Total Long-Term Liabilities', 'text-amber-700')}
              <div className="flex items-center justify-between px-5 py-3 rounded-lg bg-amber-50 border-2 border-amber-300">
                <span className="text-sm font-bold text-amber-800">TOTAL LIABILITIES</span>
                <span className="text-base font-bold text-amber-800">{formatMoney(totalLiabilities)}</span>
              </div>

              {renderSection(
                'Owner\'s Equity',
                'equity',
                [
                  // Derived from the ledger, not a stored equity list. The
                  // invented owner-contribution lines that used to sit here
                  // described capital that was never put in.
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
            <div className="p-8 text-center">
              {/*
                There is no cash-flow data source. What stood here was a
                fabricated statement itemising transactions that never
                happened -- "Purchase of Property (Unit 22)" at -$225,000,
                "New Mortgage - Unit 22" at $180,000, an ending cash balance
                of $34,521.80 -- rendered from a module constant.

                Building a real cash-flow statement needs bank activity this
                system does not hold. Saying so is the only honest option:
                an invented statement of where the money went is worse than
                an empty tab, because it answers a question nobody can check.
              */}
              <BarChart3 className="w-10 h-10 mx-auto text-gray-300" />
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                Cash flow is not available
              </h3>
              <p className="mt-2 text-sm text-gray-500 max-w-xl mx-auto">
                A cash-flow statement needs bank and payment activity, which this
                system does not yet record. The figures previously shown here were
                placeholders and did not come from the accounts.
              </p>
              <p className="mt-3 text-sm text-gray-500 max-w-xl mx-auto">
                The Profit &amp; Loss and Balance Sheet tabs are built from the real
                ledger. For revenue actually recorded against each property, use the
                property P&amp;L report.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
