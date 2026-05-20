'use client';

import { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  Plus,
  Filter,
  Download,
  Building2,
  Wrench,
  Zap,
  Droplets,
  Shield,
  Wifi,
  Truck,
  ShoppingCart,
  Users,
  X,
  ChevronDown,
  ChevronUp,
  BarChart3,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useAdminCosts, useCreateExpense, CostExpense, PropertyProfit } from '@/lib/api';

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

type ExpenseCategory =
  | 'Utilities'
  | 'Maintenance'
  | 'Supplies'
  | 'Insurance'
  | 'Marketing'
  | 'Payroll'
  | 'Mortgage'
  | 'Property Tax'
  | 'Internet/Cable'
  | 'Landscaping';

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Utilities: '#ef4444',
  Maintenance: '#f97316',
  Supplies: '#eab308',
  Insurance: '#22c55e',
  Marketing: '#3b82f6',
  Payroll: '#8b5cf6',
  Mortgage: '#ec4899',
  'Property Tax': '#14b8a6',
  'Internet/Cable': '#6366f1',
  Landscaping: '#a855f7',
};

const CATEGORY_ICONS: Record<ExpenseCategory, typeof DollarSign> = {
  Utilities: Zap,
  Maintenance: Wrench,
  Supplies: ShoppingCart,
  Insurance: Shield,
  Marketing: TrendingUp,
  Payroll: Users,
  Mortgage: Building2,
  'Property Tax': DollarSign,
  'Internet/Cable': Wifi,
  Landscaping: Droplets,
};

// Data loaded from API via useAdminCosts hook

function SvgPieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  let cumulative = 0;
  const slices = data.filter(d => d.value > 0).map((d) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const largeArc = d.value / total > 0.5 ? 1 : 0;
    const x1 = 100 + 80 * Math.cos(startAngle);
    const y1 = 100 + 80 * Math.sin(startAngle);
    const x2 = 100 + 80 * Math.cos(endAngle);
    const y2 = 100 + 80 * Math.sin(endAngle);
    return {
      ...d,
      path: `M100,100 L${x1},${y1} A80,80 0 ${largeArc},1 ${x2},${y2} Z`,
      pct: ((d.value / total) * 100).toFixed(1),
    };
  });

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5">
          <title>{s.label}: {s.pct}%</title>
        </path>
      ))}
    </svg>
  );
}

export default function CostsPage() {
  const { data: apiData, isLoading, error, refetch } = useAdminCosts();
  const createExpense = useCreateExpense();

  const expenses: CostExpense[] = apiData?.expenses || [];
  const PROPERTIES: string[] = apiData?.properties || [];
  const PROPERTY_PROFITS: PropertyProfit[] = apiData?.propertyProfits || [];

  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'All'>('All');
  const [filterProperty, setFilterProperty] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortField, setSortField] = useState<'date' | 'amountCents' | 'category'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showProfitTable, setShowProfitTable] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [newExpense, setNewExpense] = useState({
    date: today,
    category: 'Maintenance' as ExpenseCategory,
    description: '',
    amountCents: 0,
    property: '',
    vendor: '',
    recurring: false,
  });

  const filteredExpenses = useMemo(() => {
    let result = [...expenses];
    if (filterCategory !== 'All') result = result.filter(e => e.category === filterCategory);
    if (filterProperty !== 'All') result = result.filter(e => e.property === filterProperty);
    result.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'date') return mul * a.date.localeCompare(b.date);
      if (sortField === 'amountCents') return mul * (a.amountCents - b.amountCents);
      return mul * a.category.localeCompare(b.category);
    });
    return result;
  }, [expenses, filterCategory, filterProperty, sortField, sortDir]);

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amountCents;
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value, color: CATEGORY_COLORS[label as ExpenseCategory] }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const totalExpensesCents = expenses.reduce((s, e) => s + e.amountCents, 0);
  const recurringCents = expenses.filter(e => e.recurring).reduce((s, e) => s + e.amountCents, 0);
  const oneTimeCents = totalExpensesCents - recurringCents;
  const propCount = PROPERTIES.length || 1;
  const avgPerProperty = Math.round(totalExpensesCents / propCount);

  const totalPortfolioRevenue = PROPERTY_PROFITS.reduce((s, p) => s + p.revenueCents, 0);
  const totalPortfolioExpenses = PROPERTY_PROFITS.reduce((s, p) => s + p.expensesCents, 0);
  const portfolioNOI = totalPortfolioRevenue - totalPortfolioExpenses;
  const portfolioMargin = totalPortfolioRevenue > 0 ? ((portfolioNOI / totalPortfolioRevenue) * 100).toFixed(1) : '0.0';

  function toggleSort(field: 'date' | 'amountCents' | 'category') {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  }

  function handleAddExpense() {
    if (!newExpense.description || newExpense.amountCents <= 0) return;
    createExpense.mutate({
      category: newExpense.category,
      description: newExpense.description,
      amount: newExpense.amountCents / 100,
      date: newExpense.date,
      vendor: newExpense.vendor,
      property: newExpense.property,
      recurring: newExpense.recurring,
    });
    setShowAddModal(false);
    setNewExpense({ date: today, category: 'Maintenance', description: '', amountCents: 0, property: '', vendor: '', recurring: false });
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#500000]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">Failed to load cost data</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-[#500000] text-white rounded-lg text-sm">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cost Tracker</h1>
          <p className="text-sm text-gray-500">{apiData?.month || 'Current month'} expense overview across {PROPERTIES.length} properties</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowProfitTable(p => !p)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <BarChart3 className="w-4 h-4" /> {showProfitTable ? 'Hide' : 'Show'} Profitability
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#500000] text-white rounded-lg hover:bg-[#3C1518] text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 rounded-lg"><DollarSign className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Expenses</p>
              <p className="text-xl font-bold text-gray-900">{formatMoney(totalExpensesCents)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Recurring</p>
              <p className="text-xl font-bold text-gray-900">{formatMoney(recurringCents)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">One-Time</p>
              <p className="text-xl font-bold text-gray-900">{formatMoney(oneTimeCents)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-lg"><Building2 className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Avg / Property</p>
              <p className="text-xl font-bold text-gray-900">{formatMoney(avgPerProperty)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pie Chart + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-[#500000]" /> Expense Breakdown
          </h2>
          <div className="w-48 h-48 mx-auto mb-4">
            <SvgPieChart data={categoryTotals} />
          </div>
          <div className="text-center text-sm text-gray-500">{expenses.length} expenses this month</div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Category Totals</h2>
          <div className="space-y-3">
            {categoryTotals.map(ct => {
              const pct = totalExpensesCents > 0 ? (ct.value / totalExpensesCents) * 100 : 0;
              const Icon = CATEGORY_ICONS[ct.label as ExpenseCategory] || DollarSign;
              return (
                <div key={ct.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ct.color + '20' }}>
                    <Icon className="w-4 h-4" style={{ color: ct.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{ct.label}</span>
                      <span className="text-gray-900 font-semibold">{formatMoney(ct.value)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: ct.color }} />
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as ExpenseCategory | 'All')} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
            <option value="All">All Categories</option>
            {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
            <option value="All">All Properties</option>
            {PROPERTIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="text-sm text-gray-500 ml-auto">{filteredExpenses.length} expenses</span>
          <button className="flex items-center gap-1 text-sm text-[#500000] hover:underline"><Download className="w-3.5 h-3.5" /> Export CSV</button>
        </div>
      </div>

      {/* Expense Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('date')}>
                <span className="flex items-center gap-1">Date <SortIcon field="date" /></span>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('category')}>
                <span className="flex items-center gap-1">Category <SortIcon field="category" /></span>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Property</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Vendor</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('amountCents')}>
                <span className="flex items-center justify-end gap-1">Amount <SortIcon field="amountCents" /></span>
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Type</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((e, i) => {
              const Icon = CATEGORY_ICONS[e.category as ExpenseCategory] || DollarSign;
              return (
                <tr key={e.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-3 text-gray-600">{e.date}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: CATEGORY_COLORS[e.category as ExpenseCategory] + '15', color: CATEGORY_COLORS[e.category as ExpenseCategory] }}>
                      <Icon className="w-3 h-3" /> {e.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{e.description}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{e.property}</td>
                  <td className="px-4 py-3 text-gray-600">{e.vendor}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatMoney(e.amountCents)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.recurring ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {e.recurring ? 'Recurring' : 'One-time'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Profitability Table */}
      {showProfitTable && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Property Profitability - {apiData?.month || 'Current Month'}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Portfolio NOI: <span className="font-bold text-emerald-600">{formatMoney(portfolioNOI)}</span> | Margin: {portfolioMargin}% | Total Revenue: {formatMoney(totalPortfolioRevenue)}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Property</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Revenue</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Expenses</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">NOI</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Margin</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Occupancy</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">ADR</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">RevPAR</th>
              </tr>
            </thead>
            <tbody>
              {PROPERTY_PROFITS.map((p, i) => {
                const noi = p.revenueCents - p.expensesCents;
                const margin = p.revenueCents > 0 ? ((noi / p.revenueCents) * 100).toFixed(1) : '0.0';
                const occupancy = ((p.nightsBooked / p.nightsAvailable) * 100).toFixed(0);
                const revPAR = Math.round(p.revenueCents / p.nightsAvailable);
                const isNeg = noi < 0;
                return (
                  <tr key={p.name} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-900 text-xs">{p.name}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700 font-medium">{formatMoney(p.revenueCents)}</td>
                    <td className="px-4 py-2.5 text-right text-red-600 font-medium">{formatMoney(p.expensesCents)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${isNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                      <span className="inline-flex items-center gap-1">
                        {isNeg ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {formatMoney(noi)}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${parseFloat(margin) < 20 ? 'text-amber-600' : 'text-emerald-700'}`}>{margin}%</td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-[#500000] rounded-full" style={{ width: `${occupancy}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{occupancy}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{formatMoney(p.avgNightlyRateCents)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#500000]">{formatMoney(revPAR)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Add Expense</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={newExpense.date} onChange={e => setNewExpense(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={newExpense.category} onChange={e => setNewExpense(p => ({ ...p, category: e.target.value as ExpenseCategory }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={newExpense.description} onChange={e => setNewExpense(p => ({ ...p, description: e.target.value }))} placeholder="HVAC repair, Unit 3A..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                  <input type="number" step="0.01" min="0" value={(newExpense.amountCents / 100).toFixed(2)} onChange={e => setNewExpense(p => ({ ...p, amountCents: Math.round(parseFloat(e.target.value || '0') * 100) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                  <input type="text" value={newExpense.vendor} onChange={e => setNewExpense(p => ({ ...p, vendor: e.target.value }))} placeholder="Vendor name..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
                <select value={newExpense.property} onChange={e => setNewExpense(p => ({ ...p, property: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {PROPERTIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newExpense.recurring} onChange={e => setNewExpense(p => ({ ...p, recurring: e.target.checked }))} className="rounded border-gray-300 text-[#500000] focus:ring-[#500000]" />
                <span className="text-sm text-gray-700">Recurring expense</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={handleAddExpense} className="px-4 py-2 bg-[#500000] text-white rounded-lg text-sm hover:bg-[#3C1518] font-medium">Add Expense</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
