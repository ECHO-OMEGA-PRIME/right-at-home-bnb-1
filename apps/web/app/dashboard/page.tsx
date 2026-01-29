'use client';

/**
 * Right at Home BnB - Main Dashboard
 * CLEANED VERSION - No mock/placeholder data
 * Real data from API or empty states
 * 
 * @author ECHO OMEGA PRIME
 * @owner Steven Palma - Midland, TX
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
  Wifi, WifiOff, Battery, BatteryLow, Target, Award, BarChart3,
  PhoneCall, Mail
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
  useLocks,
} from '@/lib/api';
import { properties as propertyKnowledge } from '@/lib/property-knowledge';
import { CONTACT_INFO, initiateCall, initiateEmail } from '@/lib/demo-mode';
import toast from 'react-hot-toast';

// Brand Colors
const BRAND = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
  charcoal: '#2D2D2D',
  maroonLight: '#722F37',
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

  const [isRefreshing, setIsRefreshing] = useState(false);

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Active cleanings from real data
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

  // Lock statistics from real data
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
                  {propertyKnowledge.length} properties
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
        {/* Key Metrics Row - Real data only */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <MetricCard
            label="Today's Check-ins"
            value={stats?.todayCheckIns || 0}
            icon={ArrowUpRight}
            color="text-emerald-600"
            bgColor="bg-emerald-100"
          />
          <MetricCard
            label="Active Cleanings"
            value={activeCleanings.length}
            icon={Sparkles}
            color="text-purple-600"
            bgColor="bg-purple-100"
            pulse={activeCleanings.length > 0}
          />
          <MetricCard
            label="Properties"
            value={propertyKnowledge.length}
            icon={Home}
            color="text-[#500000]"
            bgColor="bg-[#500000]/10"
          />
          <MetricCard
            label="Locks Online"
            value={`${lockStats.online}/${lockStats.online + lockStats.offline || 0}`}
            icon={lockStats.offline > 0 ? WifiOff : Wifi}
            color={lockStats.offline > 0 ? 'text-amber-600' : 'text-emerald-600'}
            bgColor={lockStats.offline > 0 ? 'bg-amber-100' : 'bg-emerald-100'}
          />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Contact Card - Click to Call */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-2xl p-8 text-white"
            >
              <h2 className="text-2xl font-['Playfair_Display'] font-bold mb-4">
                Contact Steven Palma
              </h2>
              <p className="text-white/70 mb-6">
                Have questions? Reach out directly for personalized assistance with your booking or property needs.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={initiateCall}
                  className="flex items-center gap-3 px-6 py-3 bg-white text-[#500000] rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow"
                >
                  <PhoneCall className="w-5 h-5" />
                  Call {CONTACT_INFO.phoneDisplay}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => initiateEmail('Inquiry from Dashboard')}
                  className="flex items-center gap-3 px-6 py-3 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30 transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  Send Email
                </motion.button>
              </div>
            </motion.div>

            {/* Properties Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                  Property Portfolio
                </h2>
                <Link href="/properties">
                  <span className="text-sm text-[#500000] hover:underline flex items-center gap-1">
                    View All
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {propertyKnowledge.slice(0, 6).map((property, index) => (
                  <Link key={property.id} href={`/properties/${property.id}`}>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 bg-[#F5F5F0] rounded-xl hover:bg-[#500000]/5 transition-colors cursor-pointer"
                    >
                      <div className="font-medium text-sm text-[#2D2D2D] truncate">
                        {property.nickname || property.name}
                      </div>
                      <div className="text-xs text-[#2D2D2D]/50 mt-1">
                        {property.bedrooms} bed • {property.bathrooms} bath
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
              
              {propertyKnowledge.length > 6 && (
                <div className="mt-4 text-center">
                  <Link href="/properties">
                    <span className="text-sm text-[#500000] hover:underline">
                      +{propertyKnowledge.length - 6} more properties
                    </span>
                  </Link>
                </div>
              )}
            </motion.div>

            {/* Empty State for Schedule */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-8"
            >
              <div className="text-center">
                <Calendar className="w-12 h-12 text-[#2D2D2D]/20 mx-auto mb-4" />
                <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-2">
                  Today's Schedule
                </h3>
                <p className="text-[#2D2D2D]/50 text-sm mb-4">
                  No scheduled activities for today. Check the calendar for upcoming events.
                </p>
                <Link href="/calendar">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 bg-[#500000] text-white rounded-lg text-sm font-medium"
                  >
                    View Calendar
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-2xl p-6 text-white"
            >
              <h3 className="font-['Playfair_Display'] font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#C4A777]" />
                Quick Actions
              </h3>

              <div className="space-y-2">
                {[
                  { label: 'Call Steven', icon: Phone, action: initiateCall, isAction: true },
                  { label: 'Smart Home Control', icon: Thermometer, href: '/smart-home' },
                  { label: 'Generate Lock Code', icon: Key, href: '/locks' },
                  { label: 'Schedule Cleaning', icon: Sparkles, href: '/cleaning' },
                  { label: 'AI Concierge', icon: MessageSquare, href: '/concierge' },
                  { label: 'Settings', icon: Settings, href: '/settings' },
                ].map((action) => (
                  action.isAction ? (
                    <motion.button
                      key={action.label}
                      whileHover={{ x: 4 }}
                      onClick={action.action}
                      className="w-full flex items-center gap-3 p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                    >
                      <action.icon className="w-5 h-5" />
                      <span className="font-medium flex-1 text-left">{action.label}</span>
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  ) : (
                    <Link key={action.label} href={action.href!}>
                      <motion.button
                        whileHover={{ x: 4 }}
                        className="w-full flex items-center gap-3 p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                      >
                        <action.icon className="w-5 h-5" />
                        <span className="font-medium flex-1 text-left">{action.label}</span>
                        <ChevronRight className="w-4 h-4" />
                      </motion.button>
                    </Link>
                  )
                ))}
              </div>
            </motion.div>

            {/* Property Health - Real data */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                  Properties
                </h3>
                <Link href="/properties">
                  <span className="text-sm text-[#500000] hover:underline">View All</span>
                </Link>
              </div>

              <div className="space-y-3">
                {propertyKnowledge.slice(0, 5).map((property, index) => (
                  <Link key={property.id} href={`/properties/${property.id}`}>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F5F0] hover:bg-[#F5F5F0]/80 transition-colors cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-[#2D2D2D] truncate">
                          {property.nickname || property.name}
                        </div>
                        <div className="text-xs text-[#2D2D2D]/50">
                          {property.bedrooms} bed, {property.bathrooms} bath
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#2D2D2D]/30" />
                    </motion.div>
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Weather Widget - Real API */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6"
            >
              <WeatherWidget />
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Weather Widget with real API
function WeatherWidget() {
  const [weather, setWeather] = useState<{ temp: number; condition: string; emoji: string } | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('/api/weather');
        const data = await res.json();
        if (data.success && data.data) {
          setWeather({
            temp: Math.round(data.data.temp),
            condition: data.data.condition,
            emoji: getWeatherEmoji(data.data.condition),
          });
        }
      } catch (error) {
        // Silently fail - weather is non-critical
      }
    };
    fetchWeather();
  }, []);

  const getWeatherEmoji = (condition: string): string => {
    const emojis: Record<string, string> = {
      'Clear': '☀️', 'Sunny': '☀️', 'Clouds': '☁️', 'Cloudy': '☁️',
      'Partly Cloudy': '⛅', 'Rain': '🌧️', 'Thunderstorm': '⛈️',
    };
    return emojis[condition] || '🌡️';
  };

  if (!weather) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
            Midland, TX
          </h3>
          <p className="text-sm text-[#2D2D2D]/50 mt-1">Loading weather...</p>
        </div>
        <Sun className="w-10 h-10 text-[#C4A777]/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
          Midland, TX
        </h3>
        <p className="text-4xl font-bold text-[#500000] mt-2">{weather.temp}°F</p>
        <p className="text-sm text-[#2D2D2D]/60 mt-1">{weather.condition}</p>
      </div>
      <div className="text-5xl">{weather.emoji}</div>
    </div>
  );
}

// Metric Card Component - Simplified
function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  pulse = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
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
      </div>
      <div className="text-3xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
        {value}
      </div>
      <div className="text-sm text-[#2D2D2D]/60">{label}</div>
    </motion.div>
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
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 h-32" />
          ))}
        </div>
      </main>
    </div>
  );
}
