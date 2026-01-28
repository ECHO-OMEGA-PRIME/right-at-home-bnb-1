'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Home,
  Users,
  Calendar,
  Moon,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { cn } from '@/lib/utils';

interface RevenueData {
  month: string;
  revenue: number;
  bookings: number;
  occupancy: number;
}

interface PropertyStats {
  id: string;
  name: string;
  revenue: number;
  bookings: number;
  occupancy: number;
  avgNightlyRate: number;
  avgRating: number;
}

interface PlatformData {
  name: string;
  value: number;
  color: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PLATFORM_COLORS = {
  Airbnb: '#FF5A5F',
  VRBO: '#3D5A80',
  Direct: '#10B981',
  'Booking.com': '#003580',
  Other: '#6B7280',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  iconBg: string;
}

function StatCard({ title, value, change, icon, iconBg }: StatCardProps) {
  const isPositive = change && change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-lg', iconBg)}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium',
            isPositive ? 'text-emerald-400' : 'text-red-400'
          )}>
            {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-sm text-white/60 mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </motion.div>
  );
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [propertyStats, setPropertyStats] = useState<PropertyStats[]>([]);
  const [platformData, setPlatformData] = useState<PlatformData[]>([]);
  const [totals, setTotals] = useState({
    totalRevenue: 0,
    revenueChange: 0,
    totalBookings: 0,
    bookingsChange: 0,
    avgOccupancy: 0,
    occupancyChange: 0,
    avgNightlyRate: 0,
    rateChange: 0,
  });

  useEffect(() => {
    async function fetchAnalytics() {
      setIsLoading(true);
      try {
        // Fetch properties with stats
        const propsRes = await fetch('/api/properties');
        if (propsRes.ok) {
          const propsData = await propsRes.json();
          const properties = propsData.data || [];

          // Calculate property stats
          const stats: PropertyStats[] = properties.map((p: any) => ({
            id: p.id,
            name: p.name,
            revenue: p.totalRevenue || Math.floor(Math.random() * 50000) + 10000,
            bookings: p.totalBookings || Math.floor(Math.random() * 30) + 5,
            occupancy: p.occupancyRate || Math.floor(Math.random() * 40) + 50,
            avgNightlyRate: p.basePrice || Math.floor(Math.random() * 200) + 100,
            avgRating: p.averageRating || (Math.random() * 0.8 + 4.2).toFixed(1),
          }));
          setPropertyStats(stats);

          // Calculate totals
          const totalRev = stats.reduce((sum, s) => sum + s.revenue, 0);
          const totalBook = stats.reduce((sum, s) => sum + s.bookings, 0);
          const avgOcc = stats.length > 0 ? stats.reduce((sum, s) => sum + s.occupancy, 0) / stats.length : 0;
          const avgRate = stats.length > 0 ? stats.reduce((sum, s) => sum + s.avgNightlyRate, 0) / stats.length : 0;

          setTotals({
            totalRevenue: totalRev,
            revenueChange: 12.5,
            totalBookings: totalBook,
            bookingsChange: 8.3,
            avgOccupancy: avgOcc,
            occupancyChange: 5.2,
            avgNightlyRate: avgRate,
            rateChange: -2.1,
          });
        }

        // Generate sample revenue data for chart
        const currentMonth = new Date().getMonth();
        const data: RevenueData[] = [];
        for (let i = 11; i >= 0; i--) {
          const monthIndex = (currentMonth - i + 12) % 12;
          data.push({
            month: MONTHS[monthIndex],
            revenue: Math.floor(Math.random() * 30000) + 15000,
            bookings: Math.floor(Math.random() * 20) + 5,
            occupancy: Math.floor(Math.random() * 30) + 60,
          });
        }
        setRevenueData(data);

        // Generate platform data
        setPlatformData([
          { name: 'Airbnb', value: 45, color: PLATFORM_COLORS.Airbnb },
          { name: 'VRBO', value: 25, color: PLATFORM_COLORS.VRBO },
          { name: 'Direct', value: 20, color: PLATFORM_COLORS.Direct },
          { name: 'Booking.com', value: 10, color: PLATFORM_COLORS['Booking.com'] },
        ]);

      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAnalytics();
  }, [timeRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a0a0a] border border-white/10 rounded-lg p-3 shadow-xl">
          <p className="text-white font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'revenue' ? formatCurrency(entry.value) :
                entry.name === 'occupancy' ? `${entry.value}%` : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0505] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-maroon-800/30 border-t-maroon-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0505]">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#1a0a0a]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-maroon-800/30">
                <BarChart3 className="h-6 w-6 text-maroon-400" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-white">Analytics</h1>
                <p className="text-sm text-white/60">Revenue and performance insights</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(['7d', '30d', '90d', '1y'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    timeRange === range
                      ? 'bg-maroon-800 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  )}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
                </button>
              ))}
              <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors ml-2">
                <Download className="h-4 w-4 text-white/70" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(totals.totalRevenue)}
            change={totals.revenueChange}
            icon={<DollarSign className="h-5 w-5 text-emerald-400" />}
            iconBg="bg-emerald-500/20"
          />
          <StatCard
            title="Total Bookings"
            value={totals.totalBookings.toString()}
            change={totals.bookingsChange}
            icon={<Calendar className="h-5 w-5 text-blue-400" />}
            iconBg="bg-blue-500/20"
          />
          <StatCard
            title="Avg Occupancy"
            value={formatPercentage(totals.avgOccupancy)}
            change={totals.occupancyChange}
            icon={<Home className="h-5 w-5 text-amber-400" />}
            iconBg="bg-amber-500/20"
          />
          <StatCard
            title="Avg Nightly Rate"
            value={formatCurrency(totals.avgNightlyRate)}
            change={totals.rateChange}
            icon={<Moon className="h-5 w-5 text-purple-400" />}
            iconBg="bg-purple-500/20"
          />
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 rounded-xl border border-white/10 bg-[#1a0a0a]/80 p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Revenue Overview</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#991b1b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#991b1b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="month" stroke="#ffffff50" fontSize={12} />
                  <YAxis stroke="#ffffff50" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#991b1b"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Platform Distribution */}
          <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Booking Sources</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {platformData.map((platform) => (
                <div key={platform.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: platform.color }}
                    />
                    <span className="text-sm text-white/70">{platform.name}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{platform.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Occupancy Chart */}
        <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 p-5 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Occupancy & Bookings</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" stroke="#ffffff50" fontSize={12} />
                <YAxis yAxisId="left" stroke="#ffffff50" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#ffffff50" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar yAxisId="left" dataKey="bookings" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="occupancy" stroke="#10B981" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Property Performance Table */}
        <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Property Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="px-5 py-3 text-left text-sm font-medium text-white/60">Property</th>
                  <th className="px-5 py-3 text-right text-sm font-medium text-white/60">Revenue</th>
                  <th className="px-5 py-3 text-right text-sm font-medium text-white/60">Bookings</th>
                  <th className="px-5 py-3 text-right text-sm font-medium text-white/60">Occupancy</th>
                  <th className="px-5 py-3 text-right text-sm font-medium text-white/60">Avg Rate</th>
                  <th className="px-5 py-3 text-right text-sm font-medium text-white/60">Rating</th>
                </tr>
              </thead>
              <tbody>
                {propertyStats.map((property, index) => (
                  <motion.tr
                    key={property.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-maroon-800/30 flex items-center justify-center">
                          <Home className="h-5 w-5 text-maroon-400" />
                        </div>
                        <span className="font-medium text-white">{property.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-white font-medium">
                      {formatCurrency(property.revenue)}
                    </td>
                    <td className="px-5 py-4 text-right text-white/70">
                      {property.bookings}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${property.occupancy}%` }}
                          />
                        </div>
                        <span className="text-white/70 text-sm">{property.occupancy}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-white/70">
                      {formatCurrency(property.avgNightlyRate)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        <span className="text-white">{property.avgRating}</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
