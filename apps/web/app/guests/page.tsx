'use client';

/**
 * Right at Home BnB - Guest CRM
 * VIP tracking, booking history, communication log, and guest management
 *
 * Features:
 * - VIP badges with tier progression
 * - Stay history timeline
 * - Communication log with sentiment
 * - Birthday alerts
 * - Platform analytics
 *
 * Colors: Maroon #500000, Gold #C4A777, Cream #F5F5F0
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Users, Search, Filter, Plus, Star, Crown, Mail, Phone,
  Calendar, DollarSign, Tag, MoreVertical, MessageSquare,
  TrendingUp, Award, Diamond, Gem, Medal, Trophy, Eye,
  Clock, MapPin, Home, Cake, Gift, Heart, AlertCircle,
  ThumbsUp, ThumbsDown, Meh, Send, X, ChevronDown, ChevronRight,
  History, Smile, Frown, RefreshCw, Download, Upload,
  Building2, Sparkles, Check, ExternalLink, Edit, Trash2
} from 'lucide-react';
import { useGuests, Guest } from '@/lib/api';
import DashboardShell from '@/components/layout/DashboardShell';

type ViewMode = 'all' | 'vip' | 'recent' | 'birthday';
type SortOption = 'name' | 'recent' | 'spending' | 'stays' | 'rating';

// Platform configuration
const platformColors = {
  AIRBNB: { bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-200', icon: '🏠' },
  VRBO: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', icon: '🏡' },
  BOOKING: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200', icon: '🛏️' },
  DIRECT: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200', icon: '📞' },
  OTHER: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: '📧' },
};

// VIP tier configuration with benefits
const vipTierConfig = {
  SILVER: {
    icon: Medal,
    color: 'text-gray-400',
    bg: 'bg-gray-100',
    label: 'Silver',
    minStays: 2,
    minSpent: 500,
    benefits: ['5% discount', 'Early check-in when available']
  },
  GOLD: {
    icon: Award,
    color: 'text-yellow-500',
    bg: 'bg-yellow-100',
    label: 'Gold',
    minStays: 5,
    minSpent: 2000,
    benefits: ['10% discount', 'Early check-in', 'Late checkout']
  },
  PLATINUM: {
    icon: Gem,
    color: 'text-purple-500',
    bg: 'bg-purple-100',
    label: 'Platinum',
    minStays: 10,
    minSpent: 5000,
    benefits: ['15% discount', 'Priority booking', 'Free upgrades']
  },
  DIAMOND: {
    icon: Diamond,
    color: 'text-cyan-500',
    bg: 'bg-cyan-100',
    label: 'Diamond',
    minStays: 20,
    minSpent: 15000,
    benefits: ['20% discount', 'Personal concierge', 'VIP experiences']
  },
};

// Sentiment configuration
const sentimentConfig = {
  POSITIVE: { icon: ThumbsUp, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Positive' },
  NEUTRAL: { icon: Meh, color: 'text-gray-500', bg: 'bg-gray-50', label: 'Neutral' },
  NEGATIVE: { icon: ThumbsDown, color: 'text-red-500', bg: 'bg-red-50', label: 'Needs Attention' },
};

// Sort options
const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'spending', label: 'Highest Spending' },
  { value: 'stays', label: 'Most Stays' },
  { value: 'rating', label: 'Highest Rated' },
];

// Extended Guest interface
interface ExtendedGuest extends Guest {
  lastStayDate?: string;
  nextStayDate?: string;
  birthday?: string;
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  notes?: string;
  preferredProperty?: string;
  communicationLog?: CommunicationEntry[];
  stayHistory?: StayEntry[];
}

interface CommunicationEntry {
  id: string;
  type: 'email' | 'sms' | 'call' | 'message';
  direction: 'inbound' | 'outbound';
  subject: string;
  preview: string;
  timestamp: string;
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

interface StayEntry {
  id: string;
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  amount: number;
  rating?: number;
  review?: string;
}

export default function GuestsPage() {
  const { data: guests, isLoading, error, refetch } = useGuests();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [selectedGuest, setSelectedGuest] = useState<ExtendedGuest | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedGuest(null);
        setShowAddModal(false);
      }
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowAddModal(true);
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        document.getElementById('guest-search')?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter and sort guests
  const filteredGuests = useMemo(() => {
    if (!guests) return [];

    let result = [...guests] as ExtendedGuest[];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((guest) =>
        guest.name.toLowerCase().includes(query) ||
        guest.email.toLowerCase().includes(query) ||
        guest.phone?.toLowerCase().includes(query)
      );
    }

    // View mode filter
    switch (viewMode) {
      case 'vip':
        result = result.filter((g) => g.isVip);
        break;
      case 'recent':
        result = result.filter((g) => {
          const lastStay = g.lastStayDate ? new Date(g.lastStayDate) : null;
          if (!lastStay) return false;
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return lastStay >= thirtyDaysAgo;
        });
        break;
      case 'birthday':
        result = result.filter((g) => {
          if (!g.birthday) return false;
          const today = new Date();
          const bday = new Date(g.birthday);
          return bday.getMonth() === today.getMonth();
        });
        break;
    }

    // Platform filter
    if (selectedPlatform !== 'all') {
      result = result.filter((g) => g.platform === selectedPlatform);
    }

    // Sorting
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        result.sort((a, b) => {
          const dateA = a.lastStayDate ? new Date(a.lastStayDate).getTime() : 0;
          const dateB = b.lastStayDate ? new Date(b.lastStayDate).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case 'spending':
        result.sort((a, b) => b.totalSpent - a.totalSpent);
        break;
      case 'stays':
        result.sort((a, b) => b.totalStays - a.totalStays);
        break;
      case 'rating':
        result.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
        break;
    }

    return result;
  }, [guests, searchQuery, viewMode, selectedPlatform, sortBy]);

  // Stats
  const stats = useMemo(() => {
    if (!guests) return { total: 0, vip: 0, totalRevenue: 0, avgStays: 0, birthdaysThisMonth: 0, recentGuests: 0 };

    const extendedGuests = guests as ExtendedGuest[];
    const vipGuests = guests.filter((g) => g.isVip);
    const totalRevenue = guests.reduce((acc, g) => acc + g.totalSpent, 0);
    const avgStays = guests.length > 0 ? guests.reduce((acc, g) => acc + g.totalStays, 0) / guests.length : 0;

    const today = new Date();
    const birthdaysThisMonth = extendedGuests.filter((g) => {
      if (!g.birthday) return false;
      const bday = new Date(g.birthday);
      return bday.getMonth() === today.getMonth();
    }).length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentGuests = extendedGuests.filter((g) => {
      if (!g.lastStayDate) return false;
      return new Date(g.lastStayDate) >= thirtyDaysAgo;
    }).length;

    return {
      total: guests.length,
      vip: vipGuests.length,
      totalRevenue,
      avgStays: avgStays.toFixed(1),
      birthdaysThisMonth,
      recentGuests,
    };
  }, [guests]);

  // Birthday guests this month
  const birthdayGuests = useMemo(() => {
    if (!guests) return [];
    const today = new Date();
    return (guests as ExtendedGuest[]).filter((g) => {
      if (!g.birthday) return false;
      const bday = new Date(g.birthday);
      return bday.getMonth() === today.getMonth();
    }).sort((a, b) => {
      const dayA = new Date(a.birthday!).getDate();
      const dayB = new Date(b.birthday!).getDate();
      return dayA - dayB;
    });
  }, [guests]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    toast.promise(refetch(), {
      loading: 'Refreshing guests...',
      success: 'Guest list updated!',
      error: 'Failed to refresh',
    });
  }, [refetch]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-['Playfair_Display'] text-[#2D2D2D]">
            Failed to load guests
          </h2>
          <p className="text-[#2D2D2D]/60 mt-2">Please try refreshing the page</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-6 py-2.5 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell>
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
                Guest CRM
              </h1>
              <p className="text-[#2D2D2D]/60 mt-1">
                {stats.total} guests | {stats.vip} VIP members | {stats.recentGuests} stayed recently
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className="p-2.5 bg-[#F5F5F0] text-[#2D2D2D]/60 rounded-xl hover:bg-[#500000]/10 hover:text-[#500000] transition-colors"
                title="Refresh (Ctrl+R)"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                className="p-2.5 bg-[#F5F5F0] text-[#2D2D2D]/60 rounded-xl hover:bg-[#500000]/10 hover:text-[#500000] transition-colors"
                title="Export guests"
              >
                <Download className="w-5 h-5" />
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/20 hover:shadow-xl transition-shadow"
              >
                <Plus className="w-5 h-5" />
                Add Guest
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Birthday Alert Banner */}
        {birthdayGuests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-pink-100 rounded-xl">
                <Cake className="w-6 h-6 text-pink-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[#2D2D2D]">
                  {birthdayGuests.length} Birthday{birthdayGuests.length > 1 ? 's' : ''} This Month!
                </h3>
                <p className="text-sm text-[#2D2D2D]/60">
                  {birthdayGuests.slice(0, 3).map((g) => g.name).join(', ')}
                  {birthdayGuests.length > 3 && ` and ${birthdayGuests.length - 3} more`}
                </p>
              </div>
              <button
                onClick={() => setViewMode('birthday')}
                className="px-4 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition-colors text-sm font-medium"
              >
                View All
              </button>
            </div>
          </motion.div>
        )}

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8"
        >
          {[
            { label: 'Total Guests', value: stats.total, icon: Users, color: 'text-[#500000]', bg: 'bg-[#500000]/10' },
            { label: 'VIP Members', value: stats.vip, icon: Crown, color: 'text-[#C4A777]', bg: 'bg-[#C4A777]/10' },
            { label: 'Revenue', value: `$${(stats.totalRevenue / 1000).toFixed(0)}K`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Avg Stays', value: stats.avgStays, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Recent', value: stats.recentGuests, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Birthdays', value: stats.birthdaysThisMonth, icon: Cake, color: 'text-pink-500', bg: 'bg-pink-50' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-[#2D2D2D]/5 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                {stat.value}
              </div>
              <div className="text-xs text-[#2D2D2D]/60">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Filters Bar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
            <input
              id="guest-search"
              type="text"
              placeholder="Search by name, email, or phone... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-white border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-[#2D2D2D]/40 hover:text-[#500000]" />
              </button>
            )}
          </div>

          {/* View Mode Tabs */}
          <div className="flex bg-white rounded-xl border border-[#2D2D2D]/10 p-1">
            {[
              { id: 'all' as ViewMode, label: 'All', icon: Users },
              { id: 'vip' as ViewMode, label: 'VIP', icon: Crown },
              { id: 'recent' as ViewMode, label: 'Recent', icon: Clock },
              { id: 'birthday' as ViewMode, label: 'Birthdays', icon: Cake },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === tab.id
                    ? tab.id === 'vip' ? 'bg-[#C4A777] text-white' : 'bg-[#500000] text-white'
                    : 'text-[#2D2D2D]/60 hover:text-[#500000]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none px-4 py-3 pr-10 bg-white border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 cursor-pointer min-w-[160px]"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40 pointer-events-none" />
          </div>

          {/* Platform Filter */}
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="px-4 py-3 bg-white border border-[#2D2D2D]/10 rounded-xl text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#500000]/30 cursor-pointer"
          >
            <option value="all">All Platforms</option>
            <option value="AIRBNB">Airbnb</option>
            <option value="VRBO">VRBO</option>
            <option value="BOOKING">Booking.com</option>
            <option value="DIRECT">Direct</option>
          </select>
        </div>

        {/* Results Count */}
        {!isLoading && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-[#2D2D2D]/60 text-sm">
              Showing {filteredGuests.length} of {guests?.length || 0} guests
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#2D2D2D]/10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-[#2D2D2D]/10 rounded w-1/4" />
                    <div className="h-4 bg-[#2D2D2D]/10 rounded w-1/3" />
                  </div>
                  <div className="h-8 bg-[#2D2D2D]/10 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Guest List */}
        {!isLoading && (
          <motion.div layout className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredGuests.map((guest, index) => (
                <GuestCard
                  key={guest.id}
                  guest={guest}
                  index={index}
                  onSelect={() => setSelectedGuest(guest)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Empty State */}
        {!isLoading && filteredGuests.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Users className="w-16 h-16 text-[#2D2D2D]/20 mx-auto mb-4" />
            <h3 className="text-xl font-['Playfair_Display'] text-[#2D2D2D]">No guests found</h3>
            <p className="text-[#2D2D2D]/60 mt-2">
              {searchQuery ? 'Try adjusting your search terms' : 'Guests will appear here after bookings'}
            </p>
          </motion.div>
        )}
      </main>

      {/* Guest Detail Modal */}
      <AnimatePresence>
        {selectedGuest && (
          <GuestDetailModal
            guest={selectedGuest}
            onClose={() => setSelectedGuest(null)}
          />
        )}
      </AnimatePresence>

      {/* Add Guest Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddGuestModal onClose={() => setShowAddModal(false)} />
        )}
      </AnimatePresence>
    </div>
    </DashboardShell>
  );
}

// Guest Card Component with enhanced features
function GuestCard({
  guest,
  index,
  onSelect,
}: {
  guest: ExtendedGuest;
  index: number;
  onSelect: () => void;
}) {
  const platform = platformColors[guest.platform] || platformColors.OTHER;
  const vipTier = guest.vipTier ? vipTierConfig[guest.vipTier] : null;
  const VipIcon = vipTier?.icon || Crown;
  const sentiment = guest.sentiment ? sentimentConfig[guest.sentiment] : null;
  const SentimentIcon = sentiment?.icon || Meh;

  // Check if birthday is this week
  const isBirthdayThisWeek = useMemo(() => {
    if (!guest.birthday) return false;
    const today = new Date();
    const bday = new Date(guest.birthday);
    bday.setFullYear(today.getFullYear());
    const diffDays = Math.ceil((bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }, [guest.birthday]);

  // Format last stay date
  const lastStayFormatted = useMemo(() => {
    if (!guest.lastStayDate) return null;
    const date = new Date(guest.lastStayDate);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  }, [guest.lastStayDate]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.03 }}
      className="group bg-white rounded-xl p-5 shadow-sm border border-[#2D2D2D]/5 hover:shadow-lg hover:border-[#500000]/20 transition-all duration-300 cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-center gap-4">
        {/* Avatar with VIP badge */}
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#500000]/20 to-[#722F37]/20 flex items-center justify-center text-xl font-['Playfair_Display'] font-bold text-[#500000]">
            {guest.name.split(' ').map((n) => n[0]).join('')}
          </div>
          {guest.isVip && (
            <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full ${vipTier?.bg || 'bg-[#C4A777]'} flex items-center justify-center ring-2 ring-white`}>
              <VipIcon className={`w-3.5 h-3.5 ${vipTier?.color || 'text-white'}`} />
            </div>
          )}
          {isBirthdayThisWeek && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center ring-2 ring-white animate-pulse">
              <Cake className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Main Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D] truncate group-hover:text-[#500000] transition-colors">
              {guest.name}
            </h3>
            {guest.isVip && vipTier && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${vipTier.bg} ${vipTier.color}`}>
                {vipTier.label}
              </span>
            )}
            {sentiment && (
              <div className={`p-1 rounded-full ${sentiment.bg}`} title={sentiment.label}>
                <SentimentIcon className={`w-3.5 h-3.5 ${sentiment.color}`} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-[#2D2D2D]/60">
            <div className="flex items-center gap-1 truncate">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{guest.email}</span>
            </div>
            {guest.phone && (
              <div className="flex items-center gap-1 hidden sm:flex">
                <Phone className="w-3.5 h-3.5" />
                <span>{guest.phone}</span>
              </div>
            )}
            {lastStayFormatted && (
              <div className="flex items-center gap-1 hidden md:flex text-[#500000]">
                <Clock className="w-3.5 h-3.5" />
                <span>{lastStayFormatted}</span>
              </div>
            )}
          </div>
        </div>

        {/* Platform Badge */}
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${platform.bg} ${platform.text} border ${platform.border} flex items-center gap-1.5`}>
          <span>{platform.icon}</span>
          <span className="hidden sm:inline">{guest.platform}</span>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="text-center">
            <div className="text-lg font-['Playfair_Display'] font-bold text-[#2D2D2D]">
              {guest.totalStays}
            </div>
            <div className="text-xs text-[#2D2D2D]/50">Stays</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-['Playfair_Display'] font-bold text-emerald-600">
              ${guest.totalSpent.toLocaleString()}
            </div>
            <div className="text-xs text-[#2D2D2D]/50">Spent</div>
          </div>
          {guest.avgRating && (
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center text-lg font-['Playfair_Display'] font-bold text-[#C4A777]">
                <Star className="w-4 h-4 fill-current" />
                {guest.avgRating.toFixed(1)}
              </div>
              <div className="text-xs text-[#2D2D2D]/50">Rating</div>
            </div>
          )}
        </div>

        {/* Tags */}
        {guest.tags && guest.tags.length > 0 && (
          <div className="hidden lg:flex items-center gap-1">
            {guest.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-[#F5F5F0] text-[#2D2D2D]/70 rounded-md text-xs"
              >
                {tag}
              </span>
            ))}
            {guest.tags.length > 2 && (
              <span className="text-xs text-[#2D2D2D]/40">+{guest.tags.length - 2}</span>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.success('Message sent!');
            }}
            className="p-2 hover:bg-[#500000]/10 rounded-lg transition-colors"
            title="Send Message"
          >
            <MessageSquare className="w-5 h-5 text-[#500000]" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `tel:${guest.phone}`;
            }}
            className="p-2 hover:bg-[#500000]/10 rounded-lg transition-colors"
            title="Call"
          >
            <Phone className="w-5 h-5 text-[#500000]" />
          </button>
          <ChevronRight className="w-5 h-5 text-[#2D2D2D]/30" />
        </div>
      </div>
    </motion.div>
  );
}

// Guest Detail Modal with tabs
function GuestDetailModal({
  guest,
  onClose,
}: {
  guest: ExtendedGuest;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'communication'>('overview');
  const platform = platformColors[guest.platform] || platformColors.OTHER;
  const vipTier = guest.vipTier ? vipTierConfig[guest.vipTier] : null;
  const VipIcon = vipTier?.icon || Crown;

  // Mock stay history
  const stayHistory: StayEntry[] = [
    {
      id: '1',
      propertyId: 'castleford-5001',
      propertyName: 'Castleford Retreat',
      checkIn: '2024-12-15',
      checkOut: '2024-12-20',
      amount: 1250,
      rating: 5,
      review: 'Amazing stay! The property was immaculate.',
    },
    {
      id: '2',
      propertyId: 'shandon-4600',
      propertyName: 'Shandon Suite',
      checkIn: '2024-10-01',
      checkOut: '2024-10-05',
      amount: 800,
      rating: 5,
    },
    {
      id: '3',
      propertyId: 'garfield-2702',
      propertyName: 'Garfield House',
      checkIn: '2024-07-20',
      checkOut: '2024-07-25',
      amount: 950,
      rating: 4,
    },
  ];

  // Mock communication log
  const communicationLog: CommunicationEntry[] = [
    {
      id: '1',
      type: 'message',
      direction: 'inbound',
      subject: 'Booking Inquiry',
      preview: 'Hi, I was wondering if the property is available...',
      timestamp: '2024-12-28T10:30:00Z',
      sentiment: 'POSITIVE',
    },
    {
      id: '2',
      type: 'email',
      direction: 'outbound',
      subject: 'Booking Confirmation',
      preview: 'Thank you for booking with Right at Home BnB...',
      timestamp: '2024-12-28T11:00:00Z',
      sentiment: 'NEUTRAL',
    },
    {
      id: '3',
      type: 'sms',
      direction: 'outbound',
      subject: 'Check-in Instructions',
      preview: 'Your door code is 1234. Check-in is at 3PM...',
      timestamp: '2024-12-29T14:00:00Z',
      sentiment: 'NEUTRAL',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#500000] to-[#722F37] p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-['Playfair_Display'] font-bold">
                {guest.name.split(' ').map((n) => n[0]).join('')}
              </div>
              {guest.isVip && (
                <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full ${vipTier?.bg || 'bg-[#C4A777]'} flex items-center justify-center ring-2 ring-white`}>
                  <VipIcon className={`w-5 h-5 ${vipTier?.color || 'text-white'}`} />
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-['Playfair_Display'] font-bold">{guest.name}</h2>
                {vipTier && (
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                    {vipTier.label} VIP
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-white/70 text-sm">
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {guest.email}
                </div>
                {guest.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {guest.phone}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{guest.totalStays}</div>
                <div className="text-xs text-white/70">Stays</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">${guest.totalSpent.toLocaleString()}</div>
                <div className="text-xs text-white/70">Total Spent</div>
              </div>
              {guest.avgRating && (
                <div className="text-center">
                  <div className="flex items-center gap-1 justify-center text-2xl font-bold">
                    <Star className="w-5 h-5 fill-current text-[#C4A777]" />
                    {guest.avgRating.toFixed(1)}
                  </div>
                  <div className="text-xs text-white/70">Avg Rating</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#2D2D2D]/10 px-6">
          <div className="flex gap-6">
            {[
              { id: 'overview' as const, label: 'Overview', icon: Eye },
              { id: 'history' as const, label: 'Stay History', icon: History },
              { id: 'communication' as const, label: 'Communication', icon: MessageSquare },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#500000] text-[#500000]'
                    : 'border-transparent text-[#2D2D2D]/60 hover:text-[#500000]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {activeTab === 'overview' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Guest Info */}
              <div className="space-y-4">
                <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">Guest Information</h3>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-[#F5F5F0] rounded-xl">
                    <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${platform.bg} ${platform.text}`}>
                      {platform.icon} {guest.platform}
                    </div>
                    <span className="text-sm text-[#2D2D2D]/60">Booking Platform</span>
                  </div>

                  {guest.birthday && (
                    <div className="flex items-center gap-3 p-3 bg-pink-50 rounded-xl">
                      <Cake className="w-5 h-5 text-pink-500" />
                      <div>
                        <div className="font-medium text-[#2D2D2D]">
                          {new Date(guest.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                        </div>
                        <div className="text-xs text-[#2D2D2D]/60">Birthday</div>
                      </div>
                    </div>
                  )}

                  {guest.preferredProperty && (
                    <div className="flex items-center gap-3 p-3 bg-[#500000]/5 rounded-xl">
                      <Heart className="w-5 h-5 text-[#500000]" />
                      <div>
                        <div className="font-medium text-[#2D2D2D]">{guest.preferredProperty}</div>
                        <div className="text-xs text-[#2D2D2D]/60">Preferred Property</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {guest.tags && guest.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#2D2D2D]/70 mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {guest.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-[#500000]/10 text-[#500000] rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {guest.notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#2D2D2D]/70 mb-2">Notes</h4>
                    <p className="text-sm text-[#2D2D2D]/80 bg-[#F5F5F0] p-3 rounded-xl">
                      {guest.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* VIP Benefits */}
              {vipTier && (
                <div className="space-y-4">
                  <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">VIP Benefits</h3>

                  <div className={`p-4 rounded-xl ${vipTier.bg} border ${vipTier.color.replace('text-', 'border-')}/30`}>
                    <div className="flex items-center gap-2 mb-3">
                      <VipIcon className={`w-6 h-6 ${vipTier.color}`} />
                      <span className={`font-semibold ${vipTier.color}`}>{vipTier.label} Member</span>
                    </div>
                    <ul className="space-y-2">
                      {vipTier.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-[#2D2D2D]/80">
                          <Check className="w-4 h-4 text-emerald-500" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Progress to next tier */}
                  {guest.vipTier !== 'DIAMOND' && (
                    <div className="p-4 bg-[#F5F5F0] rounded-xl">
                      <h4 className="text-sm font-semibold text-[#2D2D2D]/70 mb-2">Progress to Next Tier</h4>
                      <div className="h-2 bg-[#2D2D2D]/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#500000] to-[#C4A777] rounded-full"
                          style={{ width: '65%' }}
                        />
                      </div>
                      <p className="text-xs text-[#2D2D2D]/60 mt-2">
                        3 more stays or $1,500 more to reach next tier
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                Stay History ({stayHistory.length} stays)
              </h3>

              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[#2D2D2D]/10" />

                <div className="space-y-6">
                  {stayHistory.map((stay, index) => (
                    <motion.div
                      key={stay.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative pl-14"
                    >
                      {/* Timeline dot */}
                      <div className="absolute left-4 top-4 w-5 h-5 rounded-full bg-[#500000] border-4 border-white shadow-sm" />

                      <div className="bg-white rounded-xl p-4 border border-[#2D2D2D]/10 shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-[#2D2D2D]">{stay.propertyName}</h4>
                            <div className="flex items-center gap-2 text-sm text-[#2D2D2D]/60">
                              <Calendar className="w-4 h-4" />
                              {new Date(stay.checkIn).toLocaleDateString()} - {new Date(stay.checkOut).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-emerald-600">${stay.amount}</div>
                            {stay.rating && (
                              <div className="flex items-center gap-1 justify-end text-[#C4A777]">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3.5 h-3.5 ${i < stay.rating! ? 'fill-current' : 'opacity-30'}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {stay.review && (
                          <p className="text-sm text-[#2D2D2D]/70 mt-2 italic">"{stay.review}"</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'communication' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                  Communication Log
                </h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors text-sm">
                  <Send className="w-4 h-4" />
                  New Message
                </button>
              </div>

              <div className="space-y-3">
                {communicationLog.map((entry, index) => {
                  const sentiment = entry.sentiment ? sentimentConfig[entry.sentiment] : null;
                  const SentimentIcon = sentiment?.icon || Meh;

                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 rounded-xl border ${
                        entry.direction === 'inbound' ? 'bg-[#F5F5F0] border-[#2D2D2D]/10' : 'bg-white border-[#500000]/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          entry.type === 'email' ? 'bg-blue-100 text-blue-600' :
                          entry.type === 'sms' ? 'bg-green-100 text-green-600' :
                          entry.type === 'call' ? 'bg-purple-100 text-purple-600' :
                          'bg-[#500000]/10 text-[#500000]'
                        }`}>
                          {entry.type === 'email' ? <Mail className="w-4 h-4" /> :
                           entry.type === 'sms' ? <MessageSquare className="w-4 h-4" /> :
                           entry.type === 'call' ? <Phone className="w-4 h-4" /> :
                           <MessageSquare className="w-4 h-4" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-[#2D2D2D]">{entry.subject}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              entry.direction === 'inbound' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                              {entry.direction === 'inbound' ? 'Received' : 'Sent'}
                            </span>
                            {sentiment && (
                              <div className={`p-1 rounded-full ${sentiment.bg}`}>
                                <SentimentIcon className={`w-3 h-3 ${sentiment.color}`} />
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-[#2D2D2D]/70 truncate">{entry.preview}</p>
                          <span className="text-xs text-[#2D2D2D]/50 mt-1 block">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#2D2D2D]/10 px-6 py-4 bg-[#F5F5F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-[#2D2D2D]/60 hover:text-[#500000] transition-colors">
              <Edit className="w-4 h-4" />
              Edit Guest
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-red-500 hover:text-red-600 transition-colors">
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[#2D2D2D]/60 hover:text-[#2D2D2D] transition-colors"
            >
              Close
            </button>
            <button className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white rounded-xl hover:shadow-lg transition-all">
              <MessageSquare className="w-4 h-4" />
              Contact Guest
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Add Guest Modal
function AddGuestModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    platform: 'DIRECT',
    birthday: '',
    notes: '',
    tags: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Guest added successfully!');
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#2D2D2D]/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-['Playfair_Display'] font-bold text-[#500000]">Add New Guest</h2>
            <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors">
              <X className="w-5 h-5 text-[#2D2D2D]/60" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1.5">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-[#F5F5F0] border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000]"
                placeholder="John Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1.5">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-[#F5F5F0] border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000]"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1.5">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-[#F5F5F0] border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000]"
                placeholder="(432) 555-0123"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1.5">Platform</label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className="w-full px-4 py-3 bg-[#F5F5F0] border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30"
              >
                <option value="DIRECT">Direct Booking</option>
                <option value="AIRBNB">Airbnb</option>
                <option value="VRBO">VRBO</option>
                <option value="BOOKING">Booking.com</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1.5">Birthday</label>
              <input
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                className="w-full px-4 py-3 bg-[#F5F5F0] border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000]"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1.5">Tags (comma separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-4 py-3 bg-[#F5F5F0] border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000]"
                placeholder="work crew, returning guest, quiet"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1.5">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-[#F5F5F0] border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000] resize-none"
                placeholder="Special preferences, important information..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-[#2D2D2D]/60 hover:text-[#2D2D2D] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              Add Guest
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
