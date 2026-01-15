import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Printer,
  Filter,
  Calendar,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  FileText,
  ChevronDown,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { useApp } from '../contexts/AppContext';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';

const revenueData = [
  { month: 'Jan', revenue: 8200, expenses: 2100, profit: 6100 },
  { month: 'Feb', revenue: 7800, expenses: 1900, profit: 5900 },
  { month: 'Mar', revenue: 9100, expenses: 2200, profit: 6900 },
  { month: 'Apr', revenue: 8600, expenses: 2000, profit: 6600 },
  { month: 'May', revenue: 10200, expenses: 2400, profit: 7800 },
  { month: 'Jun', revenue: 11500, expenses: 2600, profit: 8900 },
  { month: 'Jul', revenue: 12100, expenses: 2800, profit: 9300 },
  { month: 'Aug', revenue: 11800, expenses: 2700, profit: 9100 },
  { month: 'Sep', revenue: 10900, expenses: 2500, profit: 8400 },
  { month: 'Oct', revenue: 9800, expenses: 2300, profit: 7500 },
  { month: 'Nov', revenue: 10500, expenses: 2400, profit: 8100 },
  { month: 'Dec', revenue: 13200, expenses: 3100, profit: 10100 },
];

const expenseCategories = [
  { name: 'Cleaning', value: 3200, color: '#500000' },
  { name: 'Maintenance', value: 1800, color: '#722F37' },
  { name: 'Supplies', value: 950, color: '#A85858' },
  { name: 'Utilities', value: 1400, color: '#C4A777' },
  { name: 'Insurance', value: 800, color: '#2D2D2D' },
  { name: 'Other', value: 450, color: '#666666' },
];

const recentTransactions = [
  {
    id: '1',
    description: 'Booking - Aggie Getaway',
    type: 'income',
    amount: 525,
    date: '2024-01-14',
    category: 'booking_revenue',
  },
  {
    id: '2',
    description: 'Cleaning Service - Maria',
    type: 'expense',
    amount: 120,
    date: '2024-01-13',
    category: 'cleaning_expense',
  },
  {
    id: '3',
    description: 'Airbnb Platform Fee',
    type: 'expense',
    amount: 78,
    date: '2024-01-13',
    category: 'platform_fee',
  },
  {
    id: '4',
    description: 'Booking - Midland Oasis',
    type: 'income',
    amount: 750,
    date: '2024-01-12',
    category: 'booking_revenue',
  },
  {
    id: '5',
    description: 'AC Repair',
    type: 'expense',
    amount: 350,
    date: '2024-01-10',
    category: 'maintenance',
  },
];

const propertyRevenue = [
  { property: 'Aggie Getaway', revenue: 4500 },
  { property: 'Midland Oasis', revenue: 5200 },
  { property: 'Permian Paradise', revenue: 3100 },
];

export default function Finance() {
  const { stats, properties } = useApp();
  const [dateRange, setDateRange] = useState('month');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
  const totalExpenses = expenseCategories.reduce((sum, c) => sum + c.value, 0);
  const netProfit = totalRevenue - totalExpenses;

  const handlePrint = async () => {
    try {
      await window.electronAPI.print.page();
      toast.success('Printing...');
    } catch (error) {
      toast.error('Failed to print');
    }
  };

  const handleExportPDF = async () => {
    try {
      const result = await window.electronAPI.print.toPDF();
      if (result.success) {
        toast.success('PDF exported successfully');
        await window.electronAPI.shell.openPath(result.path!);
      }
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  const handleExportExcel = async () => {
    try {
      const result = await window.electronAPI.dialog.showSaveDialog({
        title: 'Export Financial Report',
        defaultPath: `financial-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });

      if (!result.canceled && result.filePath) {
        // In real app, use xlsx library to create workbook
        const data = JSON.stringify({
          revenue: revenueData,
          expenses: expenseCategories,
          transactions: recentTransactions,
        });

        await window.electronAPI.file.write(result.filePath, data);
        toast.success('Excel file exported successfully');
        await window.electronAPI.shell.openPath(result.filePath);
      }
    } catch (error) {
      toast.error('Failed to export Excel');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-display font-bold">Financial Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track revenue, expenses, and profitability
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="btn-secondary flex items-center gap-2"
          >
            <Printer className="w-5 h-5" />
            Print
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export
              <ChevronDown className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-10">
                <button
                  onClick={() => {
                    handleExportPDF();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Export as PDF
                </button>
                <button
                  onClick={() => {
                    handleExportExcel();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Export as Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="card p-4 no-print">
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-gray-400" />
          <div className="flex gap-2">
            {['week', 'month', 'quarter', 'year'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-maroon-900 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center gap-1 text-green-300">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-sm">+12%</span>
            </div>
          </div>
          <p className="text-white/70 text-sm">Total Revenue</p>
          <p className="text-3xl font-bold text-white">
            ${totalRevenue.toLocaleString()}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex items-center gap-1 text-red-500">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-sm">+5%</span>
            </div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Total Expenses
          </p>
          <p className="text-3xl font-bold">
            ${totalExpenses.toLocaleString()}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex items-center gap-1 text-green-500">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-sm">+15%</span>
            </div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Net Profit</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            ${netProfit.toLocaleString()}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <PieChart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Profit Margin
          </p>
          <p className="text-3xl font-bold">
            {Math.round((netProfit / totalRevenue) * 100)}%
          </p>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 card p-6"
        >
          <h3 className="font-display text-lg font-semibold mb-4">
            Revenue & Expenses Trend
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#500000" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#500000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#500000"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#DC2626"
                  strokeWidth={2}
                  dot={false}
                  name="Expenses"
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#16A34A"
                  strokeWidth={2}
                  dot={false}
                  name="Profit"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Expense Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <h3 className="font-display text-lg font-semibold mb-4">
            Expense Breakdown
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={expenseCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {expenseCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {expenseCategories.map((cat) => (
              <div
                key={cat.name}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-gray-600 dark:text-gray-400">
                    {cat.name}
                  </span>
                </div>
                <span className="font-medium">${cat.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Revenue by Property & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Property Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <h3 className="font-display text-lg font-semibold mb-4">
            Revenue by Property
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={propertyRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" stroke="#9CA3AF" />
                <YAxis
                  dataKey="property"
                  type="category"
                  stroke="#9CA3AF"
                  width={120}
                />
                <Tooltip
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#500000" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">
              Recent Transactions
            </h3>
            <button className="text-sm text-maroon-900 dark:text-maroon-400 font-medium">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      tx.type === 'income'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}
                  >
                    {tx.type === 'income' ? (
                      <ArrowDownRight className="w-5 h-5 text-green-600" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{tx.description}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(tx.date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-semibold ${
                    tx.type === 'income'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
