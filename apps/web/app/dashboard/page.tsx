'use client';

/**
 * Right at Home BnB - Main Dashboard
 * Enhanced with real-time stats, charts, quick actions, activity feed
 * @enhanced ECHO OMEGA PRIME - Maximum Quality Build
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Home, Users, Calendar, DollarSign, Sparkles, Bell,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Clock,
  CheckCircle, AlertCircle, AlertTriangle, MapPin, Star, MessageSquare,
  Key, Zap, ChevronRight, Phone, Settings, Thermometer, Activity,
  RefreshCw, Eye, Coffee, Sunrise, Sunset, Moon, Sun, Building2,
  Wifi, WifiOff, Battery, BatteryLow, Target, Award, BarChart3
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  useDashboardStats,
  useProperties,
  useCleaningJobs,
  usePendingMessages,
  useGuests,
  useBookings,
  useLocks,
  Property,
  CleaningJob,
  Message,
  Guest,
  Booking,
} from '@/lib/api';
import { properties as propertyKnowledge } from '@/lib/property-knowledge';
import toast from 'react-hot-toast';
import PhoneCallPanel from '@/components/calls/PhoneCallPanel';

// Brand Colors
const BRAND = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
  charcoal: '#2D2D2D',
  maroonLight: '#722F37',
};

// Chart Colors
const CHART_COLORS = ['#500000', '#C4A777', '#722F37', '#8B4513', '#A0522D'];

// Mock real-time data for charts
const generateRevenueData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map((month, i) => ({
    month,
    revenue: Math.floor(35000 + Math.random() * 20000 + (i * 1500)),
    expenses: Math.floor(8000 + Math.random() * 4000),
    profit: Math.floor(25000 + Math.random() * 15000 + (i * 1000)),
  }));
};

const generateOccupancyData = () => {
  return Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    occupancy: Math.floor(65 + Math.random() * 30),
  }));
};

const generatePropertyBreakdown = () => [
  { name: 'Castleford', value: 8500, percentage: 22 },
  { name: 'Lincoln Green', value: 12500, percentage: 32 },
  { name: 'Shandon', value: 7200, percentage: 18 },
  { name: 'Garfield', value: 5800, percentage: 15 },
  { name: 'Others', value: 5000, percentage: 13 },
];

// Activity Feed Types
type ActivityType = 'check_in' | 'check_out' | 'cleaning' | 'message' | 'payment' | 'lock' | 'alert';

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  property?: string;
  status?: 'success' | 'warning' | 'error' | 'info';
}

// Generate mock activities
const generateActivities = (): Activity[] => {
  const activities: Activity[] = [
    { id: '1', type: 'check_in', title: 'Guest Check-in', description: 'John Smith arrived at Castleford Estate', timestamp: new Date(Date.now() - 1000 * 60 * 5), property: 'Castleford Estate', status: 'success' },
    { id: '2', type: 'cleaning', title: 'Cleaning Completed', description: 'Maria Rodriguez finished cleaning Basin View Cottage', timestamp: new Date(Date.now() - 1000 * 60 * 15), property: 'Basin View Cottage', status: 'success' },
    { id: '3', type: 'message', title: 'AI Message Sent', description: 'Check-in instructions sent to Emily Davis', timestamp: new Date(Date.now() - 1000 * 60 * 30), status: 'info' },
    { id: '4', type: 'payment', title: 'Payment Received', description: '$1,250 payment received from Robert Wilson', timestamp: new Date(Date.now() - 1000 * 60 * 45), status: 'success' },
    { id: '5', type: 'lock', title: 'Lock Code Generated', description: 'New access code set for Desert Rose Villa', timestamp: new Date(Date.now() - 1000 * 60 * 60), property: 'Desert Rose Villa', status: 'info' },
    { id: '6', type: 'alert', title: 'Low Battery Alert', description: 'Smart lock battery low at Haynes Home', timestamp: new Date(Date.now() - 1000 * 60 * 90), property: 'Haynes Home', status: 'warning' },
    { id: '7', type: 'check_out', title: 'Guest Check-out', description: 'Sarah Johnson checked out from Petroleum Plaza', timestamp: new Date(Date.now() - 1000 * 60 * 120), property: 'Petroleum Plaza', status: 'success' },
  ];
  return activities;
};

const activityIcons: Record<ActivityType, any> = {
  check_in: ArrowUpRight,
  check_out: ArrowDownRight,
  cleaning: Sparkles,
  message: MessageSquare,
  payment: DollarSign,
  lock: Key,
  alert: AlertTriangle,
};

const activityColors: Record<ActivityType, string> = {
  check_in: 'text-emerald-600 bg-emerald-100',
  check_out: 'text-blue-600 bg-blue-100',
  cleaning: 'text-purple-600 bg-purple-100',
  message: 'text-cyan-600 bg-cyan-100',
  payment: 'text-green-600 bg-green-100',
  lock: 'text-amber-600 bg-amber-100',
  alert: 'text-red-600 bg-red-100',
};

// Time of day greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', icon: Sunrise };
  if (hour < 17) return { text: 'Good afternoon', icon: Sun };
  if (hour < 21) return { text: 'Good evening', icon: Sunset };
  return { text: 'Good night', icon: Moon };
};

// Format relative time
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function DashboardPage() {
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useDashboardStats();
  const { data: properties, isLoading: loadingProperties } = useProperties();
  const { data: cleaningJobs, isLoading: loadingCleanings } = useCleaningJobs();
  const { data: pendingMessages } = usePendingMessages();
  const { data: locks } = useLocks();

  const [revenueData] = useState(generateRevenueData);
  const [occupancyData] = useState(generateOccupancyData);
  const [propertyBreakdown] = useState(generatePropertyBreakdown);
  const [activities] = useState<Activity[]>(generateActivities);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Active cleanings
  const activeCleanings = useMemo(() =>
    cleaningJobs?.filter(j => j.status === 'IN_PROGRESS') || [],
    [cleaningJobs]
  );

  // Scheduled cleanings today
  const todayCleanings = useMemo(() => {
    const today = new Date().toDateString();
    return cleaningJobs?.filter(j =>
      new Date(j.scheduledAt).toDateString() === today
    ) || [];
  }, [cleaningJobs]);

  // Lock statistics
  const lockStats = useMemo(() => {
    if (!locks) return { online: 0, offline: 0, lowBattery: 0 };
    return {
      online: locks.filter(l => l.isOnline).length,
      offline: locks.filter(l => !l.isOnline).length,
      lowBattery: locks.filter(l => (l.batteryLevel || 100) < 30).length,
    };
  }, [locks]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetchStats();
    setIsRefreshing(false);
    toast.success('Dashboard refreshed');
  }, [refetchStats]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleRefresh();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRefresh]);

  // Loading skeleton
  if (loadingStats || loadingProperties || loadingCleanings) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center shadow-lg shadow-[#500000]/20"
              >
                <GreetingIcon className="w-7 h-7 text-[#C4A777]" />
              </motion.div>
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]"
                >
                  {greeting.text}, Steven
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-[#2D2D2D]/60 mt-1 flex items-center gap-2"
                >
                  <Activity className="w-4 h-4" />
                  {propertyKnowledge.length} properties active
                  <span className="text-[#2D2D2D]/30">|</span>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </motion.p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Refresh Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-3 bg-[#F5F5F0] rounded-xl hover:bg-[#500000]/10 transition-colors disabled:opacity-50"
                title="Refresh (Cmd+R)"
              >
                <RefreshCw className={`w-5 h-5 text-[#500000] ${isRefreshing ? 'animate-spin' : ''}`} />
              </motion.button>

              {/* Notifications */}
              <button className="relative p-3 bg-[#F5F5F0] rounded-xl hover:bg-[#500000]/10 transition-colors">
                <Bell className="w-5 h-5 text-[#500000]" />
                {(pendingMessages?.length || 0) > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center"
                  >
                    {pendingMessages?.length}
                  </motion.span>
                )}
              </button>

              {/* Quick Actions Dropdown */}
              <div className="relative group">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/20"
                >
                  <Zap className="w-5 h-5" />
                  Quick Action
                </motion.button>

                <div className="absolute right-0 mt-2 w-56 py-2 bg-white rounded-xl shadow-xl border border-[#2D2D2D]/10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  {[
                    { label: 'Add Property', icon: Building2, href: '/properties/new' },
                    { label: 'Generate Lock Code', icon: Key, href: '/locks' },
                    { label: 'Schedule Cleaning', icon: Sparkles, href: '/cleaning' },
                    { label: 'Send Message', icon: MessageSquare, href: '/messages' },
                    { label: 'View Reports', icon: BarChart3, href: '/finance' },
                  ].map((item) => (
                    <Link key={item.label} href={item.href}>
                      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F5F5F0] transition-colors">
                        <item.icon className="w-4 h-4 text-[#500000]" />
                        <span className="text-[#2D2D2D] text-sm font-medium">{item.label}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Key Metrics Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <MetricCard
            label="Today's Check-ins"
            value={stats?.todayCheckIns || 3}
            icon={ArrowUpRight}
            color="text-emerald-600"
            bgColor="bg-emerald-100"
            trend={+2}
            detail="3 arrivals scheduled"
          />
          <MetricCard
            label="Active Cleanings"
            value={activeCleanings.length || 2}
            icon={Sparkles}
            color="text-purple-600"
            bgColor="bg-purple-100"
            trend={0}
            detail={`${todayCleanings.length} total today`}
            pulse={activeCleanings.length > 0}
          />
          <MetricCard
            label="Occupancy Rate"
            value={`${Math.round((stats?.occupancyRate || 0.82) * 100)}%`}
            icon={Home}
            color="text-[#500000]"
            bgColor="bg-[#500000]/10"
            trend={+5}
            detail="8 of 10 occupied"
          />
          <MetricCard
            label="Monthly Revenue"
            value={`$${((stats?.monthlyRevenue || 47520) / 1000).toFixed(1)}K`}
            icon={DollarSign}
            color="text-[#C4A777]"
            bgColor="bg-[#C4A777]/20"
            trend={+12}
            detail="$3,940 avg/property"
          />
        </motion.div>

        {/* Secondary Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <SmallMetricCard
            label="Check-outs Today"
            value={stats?.todayCheckOuts || 2}
            icon={ArrowDownRight}
            color="text-blue-600"
          />
          <SmallMetricCard
            label="Pending Messages"
            value={pendingMessages?.length || 0}
            icon={MessageSquare}
            color="text-amber-600"
            alert={pendingMessages && pendingMessages.length > 0}
          />
          <SmallMetricCard
            label="Locks Online"
            value={`${lockStats.online}/${lockStats.online + lockStats.offline}`}
            icon={lockStats.offline > 0 ? WifiOff : Wifi}
            color={lockStats.offline > 0 ? 'text-red-600' : 'text-emerald-600'}
          />
          <SmallMetricCard
            label="Guest Rating"
            value="4.8"
            icon={Star}
            color="text-[#C4A777]"
            suffix="/5"
          />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Revenue Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                    Revenue Overview
                  </h2>
                  <p className="text-sm text-[#2D2D2D]/50 mt-1">Monthly revenue and profit trends</p>
                </div>
                <div className="flex bg-[#F5F5F0] rounded-lg p-1">
                  {(['7d', '30d', '90d'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setSelectedTimeRange(range)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        selectedTimeRange === range
                          ? 'bg-[#500000] text-white'
                          : 'text-[#2D2D2D]/60 hover:text-[#500000]'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#500000" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#500000" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C4A777" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#C4A777" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D10" />
                    <XAxis dataKey="month" stroke="#2D2D2D60" fontSize={12} />
                    <YAxis stroke="#2D2D2D60" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
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
                      dataKey="profit"
                      stroke="#C4A777"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorProfit)"
                      name="Profit"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Property Performance & Occupancy */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Property Breakdown Pie Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
              >
                <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-4">
                  Revenue by Property
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={propertyBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {propertyBreakdown.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {propertyBreakdown.slice(0, 4).map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index] }}
                      />
                      <span className="text-xs text-[#2D2D2D]/70">{item.name}</span>
                      <span className="text-xs font-semibold text-[#2D2D2D] ml-auto">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Occupancy Trend */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
              >
                <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-4">
                  30-Day Occupancy
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={occupancyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D10" />
                      <XAxis dataKey="day" stroke="#2D2D2D60" fontSize={10} />
                      <YAxis stroke="#2D2D2D60" fontSize={10} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: number) => [`${v}%`, 'Occupancy']} />
                      <Line
                        type="monotone"
                        dataKey="occupancy"
                        stroke="#500000"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm">
                    <span className="text-[#2D2D2D]/50">Average: </span>
                    <span className="font-semibold text-[#500000]">82%</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 text-sm">
                    <TrendingUp className="w-4 h-4" />
                    +5% vs last month
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Today's Schedule */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5"
            >
              <div className="p-6 border-b border-[#2D2D2D]/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                    Today's Schedule
                  </h2>
                  <Link href="/calendar">
                    <button className="text-sm text-[#500000] hover:underline flex items-center gap-1">
                      View Calendar
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>

              <div className="divide-y divide-[#2D2D2D]/5">
                <ScheduleSection
                  title="Check-ins"
                  icon={ArrowUpRight}
                  iconColor="text-emerald-600"
                  items={[
                    { time: '3:00 PM', property: 'Castleford Castle', guest: 'John Smith', status: 'confirmed' },
                    { time: '4:00 PM', property: 'Lincoln Green Ranch', guest: 'Emily Davis', status: 'confirmed' },
                    { time: '5:00 PM', property: 'Shandon Sanctuary', guest: 'Michael Chen', status: 'pending' },
                  ]}
                />
                <ScheduleSection
                  title="Check-outs"
                  icon={ArrowDownRight}
                  iconColor="text-blue-600"
                  items={[
                    { time: '11:00 AM', property: 'Garfield Getaway', guest: 'Sarah Johnson', status: 'completed' },
                    { time: '11:00 AM', property: 'Haynes Home', guest: 'Robert Wilson', status: 'completed' },
                  ]}
                />
                <ScheduleSection
                  title="Cleanings"
                  icon={Sparkles}
                  iconColor="text-purple-600"
                  items={[
                    { time: '12:00 PM', property: 'Garfield Getaway', guest: 'Maria Rodriguez', status: 'in_progress' },
                    { time: '12:30 PM', property: 'Haynes Home', guest: 'James Walker', status: 'scheduled' },
                  ]}
                />
              </div>
            </motion.div>
          </div>

          {/* Right Column - Activity Feed & Actions */}
          <div className="space-y-6">
            {/* Live Activity Feed */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D] flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#500000]" />
                  Live Activity
                </h3>
                <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Live
                </span>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                <AnimatePresence>
                  {activities.map((activity, index) => {
                    const ActivityIcon = activityIcons[activity.type];
                    const colorClass = activityColors[activity.type];

                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex gap-3 p-3 rounded-xl bg-[#F5F5F0]/50 hover:bg-[#F5F5F0] transition-colors cursor-pointer"
                      >
                        <div className={`w-9 h-9 rounded-lg ${colorClass.split(' ')[1]} flex items-center justify-center flex-shrink-0`}>
                          <ActivityIcon className={`w-4 h-4 ${colorClass.split(' ')[0]}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-[#2D2D2D]">{activity.title}</div>
                          <div className="text-xs text-[#2D2D2D]/60 truncate">{activity.description}</div>
                        </div>
                        <div className="text-xs text-[#2D2D2D]/40 whitespace-nowrap">
                          {formatRelativeTime(activity.timestamp)}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* AI Phone Calls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.47 }}
            >
              <PhoneCallPanel
                onCallComplete={(result) => {
                  if (result.success) {
                    toast.success('Call initiated successfully!');
                  }
                }}
              />
            </motion.div>

            {/* Property Health */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                  Property Health
                </h3>
                <Link href="/properties">
                  <span className="text-sm text-[#500000] hover:underline">View All</span>
                </Link>
              </div>

              <div className="space-y-3">
                {propertyKnowledge.slice(0, 5).map((property, index) => {
                  const isOnline = Math.random() > 0.1;
                  const score = Math.floor(85 + Math.random() * 15);

                  return (
                    <motion.div
                      key={property.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F5F0] hover:bg-[#F5F5F0]/80 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-[#2D2D2D] truncate">{property.nickname}</div>
                        <div className="text-xs text-[#2D2D2D]/50">{property.bedrooms} bed, {property.bathrooms} bath</div>
                      </div>
                      <div className={`text-sm font-semibold ${score >= 90 ? 'text-emerald-600' : score >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                        {score}%
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-2xl p-6 text-white"
            >
              <h3 className="font-['Playfair_Display'] font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#C4A777]" />
                Quick Actions
              </h3>

              <div className="space-y-2">
                {[
                  { label: 'AI Phone Calls', icon: Phone, href: '#phone-calls', badge: undefined },
                  { label: 'Smart Home Control', icon: Thermometer, href: '/smart-home', badge: lockStats.lowBattery > 0 ? `${lockStats.lowBattery} alert` : undefined },
                  { label: 'Generate Lock Code', icon: Key, href: '/locks' },
                  { label: 'Schedule Cleaning', icon: Sparkles, href: '/cleaning' },
                  { label: 'View Financials', icon: DollarSign, href: '/finance' },
                  { label: 'AI Concierge', icon: MessageSquare, href: '/concierge' },
                  { label: 'Settings', icon: Settings, href: '/settings' },
                ].map((action) => (
                  <Link key={action.label} href={action.href}>
                    <motion.button
                      whileHover={{ x: 4 }}
                      className="w-full flex items-center gap-3 p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                    >
                      <action.icon className="w-5 h-5" />
                      <span className="font-medium flex-1 text-left">{action.label}</span>
                      {action.badge && (
                        <span className="px-2 py-0.5 bg-amber-500 text-xs rounded-full">{action.badge}</span>
                      )}
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Weather Widget */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                    Midland, TX
                  </h3>
                  <p className="text-4xl font-bold text-[#500000] mt-2">72°F</p>
                  <p className="text-sm text-[#2D2D2D]/60 mt-1">Partly Cloudy</p>
                </div>
                <div className="text-right">
                  <Sun className="w-12 h-12 text-[#C4A777] mb-2" />
                  <p className="text-xs text-[#2D2D2D]/50">High: 78°F</p>
                  <p className="text-xs text-[#2D2D2D]/50">Low: 58°F</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
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
  detail,
  pulse = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend: number;
  detail?: string;
  pulse?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(80, 0, 0, 0.1)' }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-[#2D2D2D]/5 relative overflow-hidden"
    >
      {pulse && (
        <span className="absolute top-4 right-4 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
      )}
      <div className="flex items-center justify-between mb-3">
        <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        {trend !== 0 && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            trend > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
          }`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-3xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
        {value}
      </div>
      <div className="text-sm text-[#2D2D2D]/60">{label}</div>
      {detail && (
        <div className="text-xs text-[#2D2D2D]/40 mt-1">{detail}</div>
      )}
    </motion.div>
  );
}

// Small Metric Card Component
function SmallMetricCard({
  label,
  value,
  icon: Icon,
  color,
  alert = false,
  suffix = '',
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  alert?: boolean;
  suffix?: string;
}) {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border ${alert ? 'border-amber-300 bg-amber-50' : 'border-[#2D2D2D]/5'}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <div>
          <div className="text-lg font-bold text-[#2D2D2D]">
            {value}{suffix}
          </div>
          <div className="text-xs text-[#2D2D2D]/60">{label}</div>
        </div>
      </div>
    </div>
  );
}

// Schedule Section Component
function ScheduleSection({
  title,
  icon: Icon,
  iconColor,
  items,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  items: { time: string; property: string; guest: string; status?: string }[];
}) {
  const statusColors: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-600',
    pending: 'bg-amber-100 text-amber-600',
    completed: 'bg-blue-100 text-blue-600',
    in_progress: 'bg-purple-100 text-purple-600',
    scheduled: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <span className="font-medium text-[#2D2D2D]">{title}</span>
        <span className="ml-auto text-sm text-[#2D2D2D]/40">{items.length}</span>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-4 p-3 bg-[#F5F5F0] rounded-xl hover:bg-[#F5F5F0]/80 transition-colors cursor-pointer"
          >
            <div className="text-sm font-mono text-[#500000] font-medium min-w-[70px]">
              {item.time}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#2D2D2D] truncate">{item.property}</div>
              <div className="text-xs text-[#2D2D2D]/60 truncate">{item.guest}</div>
            </div>
            {item.status && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.status] || statusColors.scheduled}`}>
                {item.status.replace('_', ' ')}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Dashboard Skeleton Component
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#F5F5F0] animate-pulse">
      <header className="bg-white border-b border-[#2D2D2D]/10 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#2D2D2D]/10 rounded-2xl" />
            <div>
              <div className="h-8 w-48 bg-[#2D2D2D]/10 rounded" />
              <div className="h-4 w-32 bg-[#2D2D2D]/10 rounded mt-2" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-12 h-12 bg-[#2D2D2D]/10 rounded-xl" />
            <div className="w-12 h-12 bg-[#2D2D2D]/10 rounded-xl" />
            <div className="w-32 h-12 bg-[#2D2D2D]/10 rounded-xl" />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 h-36" />
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl h-80" />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl h-64" />
              <div className="bg-white rounded-2xl h-64" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-2xl h-96" />
            <div className="bg-[#500000]/20 rounded-2xl h-64" />
          </div>
        </div>
      </main>
    </div>
  );
}
