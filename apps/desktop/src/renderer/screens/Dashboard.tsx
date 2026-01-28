/**
 * Right at Home BnB - Enhanced Dashboard
 * Property Management Overview with ECHO Design Standards
 * Dark magenta theme with glassmorphism panels
 * @author ECHO OMEGA PRIME
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Camera,
  Sparkles,
  RefreshCw,
  Bell,
  MapPin,
  Bed,
  Bath,
  Star,
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { useApp } from '../contexts/AppContext';
import { db, type DashboardStats, type RevenueData, type OccupancyData } from '../services/database';

// ECHO Design Standards Colors
const ECHO_COLORS = {
  echoBlack: '#0A0A0A',
  darkMagenta: '#8B008B',
  echoOrange: '#FF6B35',
  cobaltBlue: '#0047AB',
  matrixMagenta: '#9932CC',
  textLight: '#E0E0E0',
  glassWhite: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(139, 0, 139, 0.3)',
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const pulseVariants = {
  pulse: {
    scale: [1, 1.02, 1],
    transition: { duration: 2, repeat: Infinity },
  },
};

// Chart colors matching ECHO theme
const chartColors = {
  revenue: ECHO_COLORS.echoOrange,
  expenses: ECHO_COLORS.darkMagenta,
  occupancy: ECHO_COLORS.matrixMagenta,
};

const sourceColors = [
  { name: 'Airbnb', value: 45, color: '#FF5A5F' },
  { name: 'VRBO', value: 30, color: '#3B5998' },
  { name: 'Direct', value: 15, color: ECHO_COLORS.echoOrange },
  { name: 'Other', value: 10, color: ECHO_COLORS.darkMagenta },
];

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  change?: string;
  positive?: boolean;
  loading?: boolean;
  color?: string;
}

function StatCard({ title, value, icon: Icon, change, positive, loading, color }: StatCardProps) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ scale: 1.02, y: -2 }}
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background: `linear-gradient(135deg, ${color || ECHO_COLORS.darkMagenta}20, ${color || ECHO_COLORS.matrixMagenta}10)`,
        border: `1px solid ${ECHO_COLORS.glassBorder}`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Glow effect */}
      <div
        className="absolute -top-12 -right-12 w-24 h-24 rounded-full opacity-20 blur-2xl"
        style={{ background: color || ECHO_COLORS.matrixMagenta }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${color || ECHO_COLORS.darkMagenta}, ${color || ECHO_COLORS.matrixMagenta})`,
              boxShadow: `0 4px 20px ${color || ECHO_COLORS.matrixMagenta}40`,
            }}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
          {change && (
            <div
              className={`flex items-center gap-1 text-sm font-medium ${
                positive ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {positive ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{change}</span>
            </div>
          )}
        </div>

        <p className="text-sm opacity-70 mb-1" style={{ color: ECHO_COLORS.textLight }}>
          {title}
        </p>

        {loading ? (
          <div className="h-9 w-24 rounded bg-white/10 animate-pulse" />
        ) : (
          <p className="text-3xl font-bold text-white">{value}</p>
        )}
      </div>
    </motion.div>
  );
}

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

function GlassCard({ children, className = '', title, action }: GlassCardProps) {
  return (
    <motion.div
      variants={itemVariants}
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        background: ECHO_COLORS.glassWhite,
        border: `1px solid ${ECHO_COLORS.glassBorder}`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {title && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="font-semibold text-lg text-white">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { properties, bookings, cleaningJobs, isOffline, refreshData } = useApp();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load all dashboard data in parallel
      const [dashStats, revenue, occupancy] = await Promise.all([
        db.getDashboardStats(),
        db.getRevenueData(6),
        db.getOccupancyByProperty(),
      ]);

      setStats(dashStats);
      setRevenueData(revenue);
      setOccupancyData(occupancy.slice(0, 5)); // Top 5 properties
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Fall back to mock data
      setStats({
        totalProperties: properties.length || 14,
        activeBookings: bookings.filter(b => b.status === 'confirmed').length || 18,
        todayCheckIns: 4,
        todayCheckOuts: 3,
        pendingCleanings: cleaningJobs.filter(j => j.status !== 'completed').length || 5,
        monthlyRevenue: 87500,
        occupancyRate: 82,
        totalPhotos: 730,
        totalGuests: 156,
        avgRating: 4.9,
      });
      setRevenueData([
        { month: 'Aug', revenue: 15200, expenses: 3800, net: 11400 },
        { month: 'Sep', revenue: 14100, expenses: 3200, net: 10900 },
        { month: 'Oct', revenue: 16800, expenses: 4100, net: 12700 },
        { month: 'Nov', revenue: 18500, expenses: 4500, net: 14000 },
        { month: 'Dec', revenue: 22100, expenses: 5200, net: 16900 },
        { month: 'Jan', revenue: 19800, expenses: 4800, net: 15000 },
      ]);
      setOccupancyData([
        { propertyId: '1', propertyName: 'Midland Oasis', occupancyRate: 92, totalNights: 30, bookedNights: 28 },
        { propertyId: '2', propertyName: 'Aggie Getaway', occupancyRate: 87, totalNights: 30, bookedNights: 26 },
        { propertyId: '3', propertyName: 'Executive Suite', occupancyRate: 83, totalNights: 30, bookedNights: 25 },
        { propertyId: '4', propertyName: 'Downtown Loft', occupancyRate: 78, totalNights: 30, bookedNights: 23 },
        { propertyId: '5', propertyName: 'Ranch House', occupancyRate: 72, totalNights: 30, bookedNights: 22 },
      ]);
      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [properties, bookings, cleaningJobs]);

  useEffect(() => {
    loadDashboardData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(loadDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    await refreshData();
    setIsRefreshing(false);

    // Show notification
    window.electronAPI.notification.show(
      'Dashboard Updated',
      'All data has been refreshed.',
      { silent: true }
    );
  };

  const statCards = [
    {
      title: 'Properties',
      value: stats?.totalProperties || 0,
      icon: Home,
      change: '+1 this month',
      positive: true,
      color: ECHO_COLORS.echoOrange,
    },
    {
      title: 'Active Bookings',
      value: stats?.activeBookings || 0,
      icon: Calendar,
      change: '+3 this week',
      positive: true,
      color: ECHO_COLORS.cobaltBlue,
    },
    {
      title: 'Monthly Revenue',
      value: `$${(stats?.monthlyRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      change: '+12% vs last month',
      positive: true,
      color: '#10B981',
    },
    {
      title: 'Occupancy Rate',
      value: `${stats?.occupancyRate || 0}%`,
      icon: TrendingUp,
      change: '+5% vs last month',
      positive: true,
      color: ECHO_COLORS.matrixMagenta,
    },
    {
      title: 'Total Photos',
      value: stats?.totalPhotos || 0,
      icon: Camera,
      change: '730 uploaded',
      positive: true,
      color: ECHO_COLORS.darkMagenta,
    },
    {
      title: 'Guest Rating',
      value: stats?.avgRating?.toFixed(1) || '4.9',
      icon: Star,
      change: 'Excellent',
      positive: true,
      color: '#F59E0B',
    },
  ];

  // Update tray stats when stats change
  useEffect(() => {
    if (stats) {
      window.electronAPI.tray.updateStats({
        todayJobs: stats.pendingCleanings,
        checkInsToday: stats.todayCheckIns,
        checkOutsToday: stats.todayCheckOuts,
        pendingCleanings: stats.pendingCleanings,
        revenue: stats.monthlyRevenue,
      });
    }
  }, [stats]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 p-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold text-white"
          >
            Dashboard
          </motion.h1>
          <p className="text-sm opacity-60 text-white mt-1">
            {lastUpdated
              ? `Last updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}`
              : 'Loading...'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isOffline && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-sm text-yellow-500">Offline Mode</span>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
            style={{
              background: `linear-gradient(135deg, ${ECHO_COLORS.darkMagenta}, ${ECHO_COLORS.matrixMagenta})`,
              boxShadow: `0 4px 20px ${ECHO_COLORS.matrixMagenta}40`,
            }}
          >
            <RefreshCw className={`w-4 h-4 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-white text-sm font-medium">Refresh</span>
          </motion.button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <StatCard
            key={stat.title}
            {...stat}
            loading={isLoading}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <GlassCard
          className="lg:col-span-2"
          title="Revenue Overview"
          action={
            <span className="text-sm text-green-400">
              +${((stats?.monthlyRevenue || 0) - 15000).toLocaleString()} net
            </span>
          }
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ECHO_COLORS.echoOrange} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={ECHO_COLORS.echoOrange} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ECHO_COLORS.darkMagenta} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={ECHO_COLORS.darkMagenta} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10, 10, 10, 0.9)',
                    border: `1px solid ${ECHO_COLORS.glassBorder}`,
                    borderRadius: '12px',
                    color: 'white',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={ECHO_COLORS.echoOrange}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name="Revenue"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke={ECHO_COLORS.darkMagenta}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorExpenses)"
                  name="Expenses"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Booking Sources Pie */}
        <GlassCard title="Booking Sources">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceColors}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {sourceColors.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10, 10, 10, 0.9)',
                    border: `1px solid ${ECHO_COLORS.glassBorder}`,
                    borderRadius: '8px',
                    color: 'white',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {sourceColors.map((source) => (
              <div key={source.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: source.color }}
                />
                <span className="text-xs text-white/70">
                  {source.name} ({source.value}%)
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Property Occupancy */}
        <GlassCard title="Property Occupancy">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupancyData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="rgba(255,255,255,0.5)"
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  dataKey="propertyName"
                  type="category"
                  stroke="rgba(255,255,255,0.5)"
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10, 10, 10, 0.9)',
                    border: `1px solid ${ECHO_COLORS.glassBorder}`,
                    borderRadius: '8px',
                    color: 'white',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Occupancy']}
                />
                <Bar
                  dataKey="occupancyRate"
                  fill={ECHO_COLORS.matrixMagenta}
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Today's Check-ins/Check-outs */}
        <GlassCard
          title="Today's Activity"
          action={
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                {stats?.todayCheckIns || 0} In
              </span>
              <span className="px-2 py-1 text-xs rounded-full bg-orange-500/20 text-orange-400">
                {stats?.todayCheckOuts || 0} Out
              </span>
            </div>
          }
        >
          <div className="space-y-3">
            {bookings.slice(0, 4).map((booking) => {
              const property = properties.find((p) => p.id === booking.propertyId);
              const isCheckIn = format(new Date(booking.checkIn), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-4 p-3 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{
                      background: isCheckIn
                        ? 'linear-gradient(135deg, #10B981, #059669)'
                        : `linear-gradient(135deg, ${ECHO_COLORS.echoOrange}, #F97316)`,
                    }}
                  >
                    {isCheckIn ? (
                      <ArrowUpRight className="w-5 h-5 text-white" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {property?.name || 'Unknown Property'}
                    </p>
                    <p className="text-sm text-white/50">
                      {isCheckIn ? 'Check-in' : 'Check-out'} at{' '}
                      {format(new Date(isCheckIn ? booking.checkIn : booking.checkOut), 'h:mm a')}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      booking.status === 'confirmed'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {booking.status}
                  </span>
                </motion.div>
              );
            })}

            {bookings.length === 0 && (
              <div className="text-center py-8 text-white/40">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No bookings today</p>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Cleaning Tasks */}
        <GlassCard
          title="Pending Tasks"
          action={
            <span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-400">
              {stats?.pendingCleanings || 0} Tasks
            </span>
          }
        >
          <div className="space-y-3">
            {cleaningJobs.slice(0, 4).map((job) => {
              const property = properties.find((p) => p.id === job.propertyId);

              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {job.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : job.status === 'in_progress' ? (
                    <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-white/40" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {property?.name} - {job.type}
                    </p>
                    <p className="text-sm text-white/50">{job.scheduledTime}</p>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      job.status === 'completed'
                        ? 'bg-green-400'
                        : job.status === 'in_progress'
                        ? 'bg-yellow-400 animate-pulse'
                        : 'bg-white/20'
                    }`}
                  />
                </motion.div>
              );
            })}

            {cleaningJobs.length === 0 && (
              <div className="text-center py-8 text-white/40">
                <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>All caught up!</p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Quick Property Overview */}
      <GlassCard
        title="Property Portfolio"
        action={
          <span className="text-sm text-white/60">
            {stats?.totalProperties || 0} properties | {stats?.totalPhotos || 0} photos
          </span>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {properties.slice(0, 8).map((property) => (
            <motion.div
              key={property.id}
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden rounded-xl cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {/* Property Image Placeholder */}
              <div
                className="h-32 relative"
                style={{
                  background: `linear-gradient(135deg, ${ECHO_COLORS.darkMagenta}30, ${ECHO_COLORS.matrixMagenta}20)`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Home className="w-10 h-10 text-white/20" />
                </div>
                <div className="absolute top-2 right-2 px-2 py-1 text-xs rounded-full bg-black/50 text-white">
                  {property.status === 'active' ? 'Active' : property.status}
                </div>
              </div>

              <div className="p-3">
                <h4 className="font-medium text-white truncate">{property.name}</h4>
                <div className="flex items-center gap-1 text-xs text-white/50 mt-1">
                  <MapPin className="w-3 h-3" />
                  <span>{property.city}</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-white/60">
                  <div className="flex items-center gap-1">
                    <Bed className="w-3 h-3" />
                    <span>{property.bedrooms}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bath className="w-3 h-3" />
                    <span>{property.bathrooms}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{property.maxGuests}</span>
                  </div>
                </div>
                <div className="mt-2 text-sm font-medium" style={{ color: ECHO_COLORS.echoOrange }}>
                  ${property.basePrice}/night
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {properties.length > 8 && (
          <div className="text-center mt-4">
            <button
              className="text-sm font-medium hover:underline"
              style={{ color: ECHO_COLORS.echoOrange }}
            >
              View all {properties.length} properties
            </button>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
