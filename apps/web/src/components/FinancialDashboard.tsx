'use client';

import React, { useState } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Download, Calendar,
  PieChart, BarChart3, FileText, Filter, ChevronDown,
  Home, Zap, Droplets, Wrench, ShoppingBag, Users
} from 'lucide-react';

interface PropertyFinancials {
  id: number;
  name: string;
  revenue: number;
  expenses: {
    cleaning: number;
    utilities: number;
    supplies: number;
    maintenance: number;
  };
  occupancyRate: number;
  avgNightlyRate: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

const mockFinancials: PropertyFinancials[] = [
  { id: 1, name: "Castleford Estate", revenue: 6200, expenses: { cleaning: 480, utilities: 320, supplies: 85, maintenance: 150 }, occupancyRate: 85, avgNightlyRate: 225 },
  { id: 2, name: "Petroleum Plaza Suite", revenue: 4100, expenses: { cleaning: 360, utilities: 240, supplies: 65, maintenance: 100 }, occupancyRate: 78, avgNightlyRate: 175 },
  { id: 3, name: "Basin View Cottage", revenue: 5300, expenses: { cleaning: 420, utilities: 280, supplies: 75, maintenance: 120 }, occupancyRate: 82, avgNightlyRate: 195 },
  { id: 4, name: "Downtown Loft", revenue: 3800, expenses: { cleaning: 300, utilities: 200, supplies: 55, maintenance: 80 }, occupancyRate: 75, avgNightlyRate: 155 },
  { id: 5, name: "Permian Heights", revenue: 5800, expenses: { cleaning: 450, utilities: 310, supplies: 80, maintenance: 140 }, occupancyRate: 88, avgNightlyRate: 210 },
];

const monthlyData: MonthlyData[] = [
  { month: "Aug", revenue: 42000, expenses: 11500, profit: 30500 },
  { month: "Sep", revenue: 38500, expenses: 10800, profit: 27700 },
  { month: "Oct", revenue: 45000, expenses: 12200, profit: 32800 },
  { month: "Nov", revenue: 41000, expenses: 11000, profit: 30000 },
  { month: "Dec", revenue: 48500, expenses: 13000, profit: 35500 },
  { month: "Jan", revenue: 47500, expenses: 12300, profit: 35200 },
];

const StatCard = ({ icon: Icon, label, value, subValue, trend }: {
  icon: any;
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}) => (
  <div className="card">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-charcoal-500 text-sm">{label}</p>
        <p className="text-3xl font-display font-bold text-charcoal-800 mt-1">{value}</p>
        {subValue && (
          <p className={`text-sm mt-1 flex items-center gap-1 ${
            trend === 'up' ? 'text-green-600' :
            trend === 'down' ? 'text-red-600' : 'text-charcoal-500'
          }`}>
            {trend === 'up' && <TrendingUp className="w-4 h-4" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4" />}
            {subValue}
          </p>
        )}
      </div>
      <div className="w-12 h-12 bg-maroon-100 rounded-xl flex items-center justify-center">
        <Icon className="w-6 h-6 text-maroon-800" />
      </div>
    </div>
  </div>
);

const PropertyRow = ({ property }: { property: PropertyFinancials }) => {
  const totalExpenses = Object.values(property.expenses).reduce((a, b) => a + b, 0);
  const profit = property.revenue - totalExpenses;
  const margin = ((profit / property.revenue) * 100).toFixed(0);

  return (
    <tr className="border-b border-cream-100 hover:bg-cream-50 transition-colors">
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-maroon-100 rounded-lg flex items-center justify-center">
            <Home className="w-5 h-5 text-maroon-800" />
          </div>
          <span className="font-medium text-charcoal-800">{property.name}</span>
        </div>
      </td>
      <td className="py-4 px-4 text-right font-display font-semibold text-green-700">
        ${property.revenue.toLocaleString()}
      </td>
      <td className="py-4 px-4 text-right text-red-600">
        ${totalExpenses.toLocaleString()}
      </td>
      <td className="py-4 px-4 text-right font-display font-bold text-charcoal-800">
        ${profit.toLocaleString()}
      </td>
      <td className="py-4 px-4 text-right">
        <span className={`badge ${
          Number(margin) >= 70 ? 'badge-success' :
          Number(margin) >= 50 ? 'badge-warning' : 'badge-danger'
        }`}>
          {margin}%
        </span>
      </td>
      <td className="py-4 px-4 text-right text-charcoal-600">
        {property.occupancyRate}%
      </td>
      <td className="py-4 px-4 text-right text-charcoal-600">
        ${property.avgNightlyRate}
      </td>
    </tr>
  );
};


export default function FinancialDashboard() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);

  // Calculate totals
  const totals = mockFinancials.reduce((acc, p) => {
    const expenses = Object.values(p.expenses).reduce((a, b) => a + b, 0);
    return {
      revenue: acc.revenue + p.revenue,
      expenses: acc.expenses + expenses,
      profit: acc.profit + (p.revenue - expenses)
    };
  }, { revenue: 0, expenses: 0, profit: 0 });

  const expenseBreakdown = mockFinancials.reduce((acc, p) => ({
    cleaning: acc.cleaning + p.expenses.cleaning,
    utilities: acc.utilities + p.expenses.utilities,
    supplies: acc.supplies + p.expenses.supplies,
    maintenance: acc.maintenance + p.expenses.maintenance,
  }), { cleaning: 0, utilities: 0, supplies: 0, maintenance: 0 });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display text-2xl font-bold text-charcoal-800">
            Financial Overview
          </h2>
          <p className="text-charcoal-500 mt-1">
            January 2025 • All 22 Properties
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex bg-cream-100 rounded-xl p-1">
            {(['month', 'quarter', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  period === p
                    ? 'bg-maroon-800 text-white'
                    : 'text-charcoal-600 hover:text-charcoal-800'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          {/* Export */}
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={`$${totals.revenue.toLocaleString()}`}
          subValue="+12% vs last month"
          trend="up"
        />
        <StatCard
          icon={TrendingDown}
          label="Total Expenses"
          value={`$${totals.expenses.toLocaleString()}`}
          subValue="+5% vs last month"
          trend="down"
        />
        <StatCard
          icon={TrendingUp}
          label="Net Profit"
          value={`$${totals.profit.toLocaleString()}`}
          subValue="+15% vs last month"
          trend="up"
        />
        <StatCard
          icon={PieChart}
          label="Profit Margin"
          value={`${((totals.profit / totals.revenue) * 100).toFixed(0)}%`}
          subValue="Healthy"
          trend="neutral"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Expense Breakdown */}
        <div className="card">
          <h3 className="font-display text-lg font-semibold text-charcoal-800 mb-6">
            Expense Breakdown
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Cleaning', value: expenseBreakdown.cleaning, icon: Users, color: 'bg-blue-500' },
              { label: 'Utilities', value: expenseBreakdown.utilities, icon: Zap, color: 'bg-yellow-500' },
              { label: 'Supplies', value: expenseBreakdown.supplies, icon: ShoppingBag, color: 'bg-green-500' },
              { label: 'Maintenance', value: expenseBreakdown.maintenance, icon: Wrench, color: 'bg-red-500' },
            ].map((expense) => {
              const percentage = ((expense.value / totals.expenses) * 100).toFixed(0);
              return (
                <div key={expense.label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <expense.icon className="w-4 h-4 text-charcoal-500" />
                      <span className="text-sm font-medium text-charcoal-700">{expense.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-charcoal-800">
                      ${expense.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-cream-200 rounded-full h-2">
                    <div
                      className={`${expense.color} h-2 rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="card lg:col-span-2">
          <h3 className="font-display text-lg font-semibold text-charcoal-800 mb-6">
            6-Month Trend
          </h3>
          <div className="h-64 flex items-end gap-4">
            {monthlyData.map((data) => (
              <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col gap-1">
                  <div
                    className="w-full bg-green-200 rounded-t"
                    style={{ height: `${(data.profit / 40000) * 150}px` }}
                    title={`Profit: $${data.profit.toLocaleString()}`}
                  />
                  <div
                    className="w-full bg-red-200 rounded-b"
                    style={{ height: `${(data.expenses / 40000) * 150}px` }}
                    title={`Expenses: $${data.expenses.toLocaleString()}`}
                  />
                </div>
                <span className="text-xs text-charcoal-500">{data.month}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-200 rounded" />
              <span className="text-sm text-charcoal-500">Profit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-200 rounded" />
              <span className="text-sm text-charcoal-500">Expenses</span>
            </div>
          </div>
        </div>
      </div>

      {/* Property Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-lg font-semibold text-charcoal-800">
            P&L by Property
          </h3>
          <button className="text-maroon-800 text-sm font-medium hover:underline">
            View All 22 Properties →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cream-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-charcoal-500">Property</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-charcoal-500">Revenue</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-charcoal-500">Expenses</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-charcoal-500">Profit</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-charcoal-500">Margin</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-charcoal-500">Occupancy</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-charcoal-500">Avg Rate</th>
              </tr>
            </thead>
            <tbody>
              {mockFinancials.map((property) => (
                <PropertyRow key={property.id} property={property} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Export Section */}
      <div className="mt-8 card bg-maroon-50 border-maroon-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-maroon-800 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-charcoal-800">
                Tax-Ready Reports
              </h3>
              <p className="text-charcoal-600 text-sm">
                Download categorized expense reports for your CPA
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary">
              <Download className="w-4 h-4 mr-2" />
              CSV
            </button>
            <button className="btn-primary">
              <Download className="w-4 h-4 mr-2" />
              PDF Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
