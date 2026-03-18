'use client';

/**
 * Right at Home BnB - Property Owner Dashboard
 * Main dashboard for property owners showing:
 * - Monthly earnings summary
 * - Upcoming bookings
 * - Recent expenses
 * - Occupancy rates
 * - Maintenance requests
 *
 * @author ECHO OMEGA PRIME
 * @owner Right at Home BnB - Midland, TX
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  DollarSign, TrendingUp, TrendingDown, Home, Calendar, Users,
  Building2, ChevronRight, AlertTriangle, Wrench, Sparkles, Clock,
  ArrowUpRight, ArrowDownRight, BarChart3, FileText, Download,
  RefreshCw, Bell, Filter
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import DashboardShell from '@/components/layout/DashboardShell';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

// Brand Colors
const BRAND = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
  charcoal: '#2D2D2D',
  maroonLight: '#722F37',
};

const CHART_COLORS = ['#500000', '#C4A777', '#722F37', '#8B4513', '#A0522D'];

// Types
interface DashboardData {
  owner_id: string;
  owner_name: string;
  properties_count: number;
  total_properties: any[];
  monthly_earnings: number;
  monthly_expenses: number;
  monthly_net_payout: number;
  ytd_revenue: number;
  ytd_expenses: number;
  ytd_net_payout: number;
  avg_occupancy_rate: number;
  avg_nightly_rate: number;
  avg_guest_rating: number;
  upcoming_bookings: any[];
  recent_expenses: any[];
  pending_maintenance: any[];
  revenue_change_percent: number;
  occupancy_change_percent: number;
}

// Mock data generator - returns empty/default data; real data comes from the API
const generateMockData = (): DashboardData => ({
  owner_id: '',
  owner_name: '',
  properties_count: 0,
  total_properties: [],
  monthly_earnings: 0,
  monthly_expenses: 0,
  monthly_net_payout: 0,
  ytd_revenue: 0,
  ytd_expenses: 0,
  ytd_net_payout: 0,
  avg_occupancy_rate: 0,
  avg_nightly_rate: 0,
  avg_guest_rating: 0,
  upcoming_bookings: [],
  recent_expenses: [],
  pending_maintenance: [],
  revenue_change_percent: 0,
  occupancy_change_percent: 0,
});

// Revenue chart data - empty; populated from API in production
const generateRevenueChartData = () => {
  return [] as { month: string; revenue: number; expenses: number; net: number }[];
};

// Expense breakdown data - empty; populated from API in production
const generateExpenseBreakdown = () => [] as { name: string; value: number; color: string }[];

export default function OwnerDashboardPage() {
  const { appUser, isOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [revenueData] = useState(generateRevenueChartData);
  const [expenseData] = useState(generateExpenseBreakdown);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Simulate API call
    const fetchData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setData(generateMockData());
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setData(generateMockData());
    setIsRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  if (loading || !data) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-screen">
          <RefreshCw className="w-8 h-8 animate-spin text-[#500000]" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="min-h-screen bg-[#F5F5F0]">
        {/* Header */}
        <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
                  Owner Dashboard
                </h1>
                <p className="text-[#2D2D2D]/60 mt-1">
                  {data.properties_count} properties | {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-3 bg-[#F5F5F0] rounded-xl hover:bg-[#500000]/10 transition-colors"
                >
                  <RefreshCw className={`w-5 h-5 text-[#500000] ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>

                <Link href="/owner/statements">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl"
                  >
                    <FileText className="w-5 h-5" />
                    View Statements
                  </motion.button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Key Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            <MetricCard
              label="Monthly Earnings"
              value={`$${data.monthly_earnings.toLocaleString()}`}
              icon={DollarSign}
              color="text-emerald-600"
              bgColor="bg-emerald-100"
              trend={data.revenue_change_percent}
            />
            <MetricCard
              label="Net Payout"
              value={`$${data.monthly_net_payout.toLocaleString()}`}
              icon={TrendingUp}
              color="text-[#500000]"
              bgColor="bg-[#500000]/10"
              subtext={`After ${data.monthly_earnings > 0 ? ((data.monthly_expenses / data.monthly_earnings) * 100).toFixed(0) : 0}% expenses`}
            />
            <MetricCard
              label="Occupancy Rate"
              value={`${(data.avg_occupancy_rate * 100).toFixed(0)}%`}
              icon={Home}
              color="text-blue-600"
              bgColor="bg-blue-100"
              trend={data.occupancy_change_percent}
            />
            <MetricCard
              label="Guest Rating"
              value={data.avg_guest_rating.toFixed(1)}
              icon={Users}
              color="text-[#C4A777]"
              bgColor="bg-[#C4A777]/20"
              subtext="out of 5.0"
            />
          </motion.div>

          {/* YTD Summary Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-[#500000] to-[#722F37] rounded-2xl p-6 mb-8 text-white"
          >
            <h2 className="text-lg font-semibold mb-4 opacity-90">Year-to-Date Summary</h2>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-white/60 text-sm">Total Revenue</p>
                <p className="text-3xl font-bold">${data.ytd_revenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm">Total Expenses</p>
                <p className="text-3xl font-bold">${data.ytd_expenses.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm">Net Payout</p>
                <p className="text-3xl font-bold text-[#C4A777]">${data.ytd_net_payout.toLocaleString()}</p>
              </div>
            </div>
          </motion.div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Revenue Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                  Monthly Revenue & Net Payout
                </h3>
                <Link href="/owner/earnings">
                  <span className="text-sm text-[#500000] hover:underline flex items-center gap-1">
                    View Details <ChevronRight className="w-4 h-4" />
                  </span>
                </Link>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#500000" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#500000" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C4A777" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#C4A777" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D10" />
                    <XAxis dataKey="month" stroke="#2D2D2D60" fontSize={12} />
                    <YAxis stroke="#2D2D2D60" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip
                      contentStyle={{
                        background: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#500000"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      name="Revenue"
                    />
                    <Area
                      type="monotone"
                      dataKey="net"
                      stroke="#C4A777"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorNet)"
                      name="Net Payout"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Expense Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
            >
              <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-4">
                Expense Breakdown
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {expenseData.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {expenseData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[#2D2D2D]/70">{item.name}</span>
                    </div>
                    <span className="font-medium text-[#2D2D2D]">${item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Content Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Upcoming Bookings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5"
            >
              <div className="p-6 border-b border-[#2D2D2D]/5">
                <div className="flex items-center justify-between">
                  <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D] flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#500000]" />
                    Upcoming Bookings
                  </h3>
                  <span className="text-sm text-[#2D2D2D]/50">{data.upcoming_bookings.length} upcoming</span>
                </div>
              </div>
              <div className="divide-y divide-[#2D2D2D]/5">
                {data.upcoming_bookings.map((booking) => (
                  <div key={booking.id} className="p-4 hover:bg-[#F5F5F0]/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-[#2D2D2D]">{booking.property}</span>
                      <span className="text-emerald-600 font-semibold">${booking.total.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-[#2D2D2D]/60">
                      <span>{booking.guest_name}</span>
                      <span className="flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        {booking.check_in}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        booking.platform === 'VRBO' ? 'bg-blue-100 text-blue-700' :
                        booking.platform === 'Airbnb' ? 'bg-red-100 text-red-700' :
                        'bg-[#C4A777]/20 text-[#C4A777]'
                      }`}>
                        {booking.platform}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent Expenses */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5"
            >
              <div className="p-6 border-b border-[#2D2D2D]/5">
                <div className="flex items-center justify-between">
                  <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D] flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-[#500000]" />
                    Recent Expenses
                  </h3>
                  <Link href="/owner/earnings">
                    <span className="text-sm text-[#500000] hover:underline">View All</span>
                  </Link>
                </div>
              </div>
              <div className="divide-y divide-[#2D2D2D]/5">
                {data.recent_expenses.map((expense) => (
                  <div key={expense.id} className="p-4 hover:bg-[#F5F5F0]/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[#2D2D2D]">{expense.category}</span>
                      <span className="text-red-600 font-semibold">-${expense.amount.toLocaleString()}</span>
                    </div>
                    <div className="text-sm text-[#2D2D2D]/60">
                      <span>{expense.property}</span>
                      <span className="mx-2">|</span>
                      <span>{expense.vendor}</span>
                    </div>
                    <div className="text-xs text-[#2D2D2D]/40 mt-1">{expense.date}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Maintenance Requests */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5"
            >
              <div className="p-6 border-b border-[#2D2D2D]/5">
                <div className="flex items-center justify-between">
                  <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D] flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-[#500000]" />
                    Maintenance
                  </h3>
                  {data.pending_maintenance.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      {data.pending_maintenance.length} pending
                    </span>
                  )}
                </div>
              </div>
              <div className="divide-y divide-[#2D2D2D]/5">
                {data.pending_maintenance.length === 0 ? (
                  <div className="p-8 text-center text-[#2D2D2D]/50">
                    <Sparkles className="w-8 h-8 mx-auto mb-2" />
                    <p>No maintenance requests</p>
                  </div>
                ) : (
                  data.pending_maintenance.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-[#F5F5F0]/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium text-[#2D2D2D]">{item.property}</span>
                          <p className="text-sm text-[#2D2D2D]/60 mt-1">{item.issue}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                          item.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {item.priority}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-[#2D2D2D]/40">Reported: {item.reported_at}</span>
                        <span className={`text-xs font-medium ${
                          item.status === 'SCHEDULED' ? 'text-blue-600' : 'text-amber-600'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>

          {/* Properties Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mt-8 bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#500000]" />
                My Properties
              </h3>
              <Link href="/owner/properties">
                <span className="text-sm text-[#500000] hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-4 h-4" />
                </span>
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {data.total_properties.map((property) => (
                <Link key={property.id} href={`/owner/properties?id=${property.id}`}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="p-4 rounded-xl bg-[#F5F5F0] hover:bg-[#500000]/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-[#2D2D2D]">{property.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        property.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                        property.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {property.status}
                      </span>
                    </div>
                    {property.current_booking ? (
                      <div className="text-sm text-[#2D2D2D]/60">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {property.current_booking.guest}
                        </span>
                        <span className="text-xs">Check-out: {property.current_booking.check_out}</span>
                      </div>
                    ) : (
                      <div className="text-sm text-[#2D2D2D]/40">
                        No current booking
                      </div>
                    )}
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { label: 'View Earnings', icon: DollarSign, href: '/owner/earnings' },
              { label: 'Monthly Statements', icon: FileText, href: '/owner/statements' },
              { label: 'Property Reports', icon: BarChart3, href: '/owner/reports' },
              { label: 'Download PDF', icon: Download, href: '/owner/statements' },
            ].map((action) => (
              <Link key={action.label} href={action.href}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-4 bg-white rounded-xl border border-[#2D2D2D]/5 hover:border-[#500000]/20 hover:shadow-md transition-all cursor-pointer"
                >
                  <action.icon className="w-6 h-6 text-[#500000] mb-2" />
                  <span className="text-sm font-medium text-[#2D2D2D]">{action.label}</span>
                </motion.div>
              </Link>
            ))}
          </motion.div>
        </main>
      </div>
    </DashboardShell>
  );
}

// Metric Card Component
function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  trend,
  subtext,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend?: number;
  subtext?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(80, 0, 0, 0.1)' }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-[#2D2D2D]/5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            trend > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
          }`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
        {value}
      </div>
      <div className="text-sm text-[#2D2D2D]/60">{label}</div>
      {subtext && <div className="text-xs text-[#2D2D2D]/40 mt-1">{subtext}</div>}
    </motion.div>
  );
}
