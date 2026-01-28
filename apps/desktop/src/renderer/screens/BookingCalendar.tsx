/**
 * Right at Home BnB - Booking Calendar Screen
 * Interactive calendar view for all property bookings
 * ECHO Design Standards: Dark magenta theme, glassmorphism
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Home,
  User,
  Clock,
  DollarSign,
  Phone,
  Mail,
  X,
  Filter,
  List,
  Grid,
  Search,
  Plus,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Users,
  CheckCircle,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { db, BookingWithRelations, PropertyWithPhotos } from '../services/database';

// ECHO Design Standards Colors
const ECHO_COLORS = {
  echoBlack: '#0A0A0A',
  darkMagenta: '#8B008B',
  echoOrange: '#FF6B35',
  cobaltBlue: '#0047AB',
  matrixMagenta: '#9932CC',
  textPrimary: '#E0E0E0',
  textSecondary: '#A0A0A0',
};

// Booking status colors
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CONFIRMED: {
    bg: 'rgba(34, 197, 94, 0.2)',
    text: '#22c55e',
    border: 'rgba(34, 197, 94, 0.4)',
  },
  PENDING: {
    bg: 'rgba(234, 179, 8, 0.2)',
    text: '#eab308',
    border: 'rgba(234, 179, 8, 0.4)',
  },
  CANCELLED: {
    bg: 'rgba(239, 68, 68, 0.2)',
    text: '#ef4444',
    border: 'rgba(239, 68, 68, 0.4)',
  },
  COMPLETED: {
    bg: 'rgba(59, 130, 246, 0.2)',
    text: '#3b82f6',
    border: 'rgba(59, 130, 246, 0.4)',
  },
};

// Glassmorphism Card Component
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={`relative rounded-2xl ${className}`}
    style={{
      background: 'rgba(139, 0, 139, 0.08)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(139, 0, 139, 0.2)',
      boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
    }}
  >
    {children}
  </div>
);

// Helper to get days in a month
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

// Helper to get first day of month (0 = Sunday)
const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

// Helper to format date
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

// Property color generator for consistent booking colors
const getPropertyColor = (propertyId: string) => {
  const colors = [
    { bg: 'rgba(139, 0, 139, 0.3)', border: 'rgba(139, 0, 139, 0.6)' }, // Magenta
    { bg: 'rgba(255, 107, 53, 0.3)', border: 'rgba(255, 107, 53, 0.6)' }, // Orange
    { bg: 'rgba(0, 71, 171, 0.3)', border: 'rgba(0, 71, 171, 0.6)' }, // Blue
    { bg: 'rgba(34, 197, 94, 0.3)', border: 'rgba(34, 197, 94, 0.6)' }, // Green
    { bg: 'rgba(168, 85, 247, 0.3)', border: 'rgba(168, 85, 247, 0.6)' }, // Purple
    { bg: 'rgba(236, 72, 153, 0.3)', border: 'rgba(236, 72, 153, 0.6)' }, // Pink
    { bg: 'rgba(20, 184, 166, 0.3)', border: 'rgba(20, 184, 166, 0.6)' }, // Teal
    { bg: 'rgba(251, 146, 60, 0.3)', border: 'rgba(251, 146, 60, 0.6)' }, // Amber
  ];
  const hash = propertyId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Booking Detail Modal
const BookingDetailModal: React.FC<{
  booking: BookingWithRelations;
  onClose: () => void;
}> = ({ booking, onClose }) => {
  const statusColor = STATUS_COLORS[booking.status] || STATUS_COLORS.PENDING;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(10, 10, 10, 0.9)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg mx-4 rounded-2xl p-6"
        style={{
          background: 'rgba(10, 10, 10, 0.95)',
          border: '1px solid rgba(139, 0, 139, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2
              className="text-xl font-semibold"
              style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Orbitron, sans-serif' }}
            >
              Booking Details
            </h2>
            <p style={{ color: ECHO_COLORS.textSecondary }} className="text-sm mt-1">
              {booking.confirmCode || booking.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: ECHO_COLORS.textSecondary }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Badge */}
        <div className="mb-6">
          <span
            className="px-3 py-1 rounded-full text-sm font-medium"
            style={{
              background: statusColor.bg,
              color: statusColor.text,
              border: `1px solid ${statusColor.border}`,
            }}
          >
            {booking.status}
          </span>
        </div>

        {/* Property */}
        <div
          className="p-4 rounded-xl mb-4"
          style={{ background: 'rgba(139, 0, 139, 0.1)', border: '1px solid rgba(139, 0, 139, 0.2)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(139, 0, 139, 0.2)' }}
            >
              <Home className="w-6 h-6" style={{ color: ECHO_COLORS.echoOrange }} />
            </div>
            <div>
              <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                {booking.property?.name || 'Property'}
              </p>
              <p className="text-sm flex items-center gap-1" style={{ color: ECHO_COLORS.textSecondary }}>
                <MapPin className="w-3 h-3" />
                {booking.property?.city}, {booking.property?.state}
              </p>
            </div>
          </div>
        </div>

        {/* Guest */}
        <div
          className="p-4 rounded-xl mb-4"
          style={{ background: 'rgba(139, 0, 139, 0.1)', border: '1px solid rgba(139, 0, 139, 0.2)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(139, 0, 139, 0.2)' }}
            >
              <User className="w-6 h-6" style={{ color: ECHO_COLORS.echoOrange }} />
            </div>
            <div className="flex-1">
              <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                {booking.guest?.name || 'Guest'}
              </p>
              <div className="flex items-center gap-4 text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                {booking.guest?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {booking.guest.email}
                  </span>
                )}
                {booking.guest?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {booking.guest.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div
            className="p-4 rounded-xl"
            style={{ background: 'rgba(139, 0, 139, 0.1)', border: '1px solid rgba(139, 0, 139, 0.2)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowRight className="w-4 h-4" style={{ color: ECHO_COLORS.echoOrange }} />
              <span style={{ color: ECHO_COLORS.textSecondary }} className="text-sm">
                Check-in
              </span>
            </div>
            <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
              {formatDate(new Date(booking.checkIn))}
            </p>
          </div>
          <div
            className="p-4 rounded-xl"
            style={{ background: 'rgba(139, 0, 139, 0.1)', border: '1px solid rgba(139, 0, 139, 0.2)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowLeft className="w-4 h-4" style={{ color: ECHO_COLORS.echoOrange }} />
              <span style={{ color: ECHO_COLORS.textSecondary }} className="text-sm">
                Check-out
              </span>
            </div>
            <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
              {formatDate(new Date(booking.checkOut))}
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div
            className="p-3 rounded-xl text-center"
            style={{ background: 'rgba(139, 0, 139, 0.1)' }}
          >
            <Clock className="w-5 h-5 mx-auto mb-1" style={{ color: ECHO_COLORS.echoOrange }} />
            <p className="font-bold" style={{ color: ECHO_COLORS.textPrimary }}>
              {booking.totalNights}
            </p>
            <p className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>
              Nights
            </p>
          </div>
          <div
            className="p-3 rounded-xl text-center"
            style={{ background: 'rgba(139, 0, 139, 0.1)' }}
          >
            <Users className="w-5 h-5 mx-auto mb-1" style={{ color: ECHO_COLORS.echoOrange }} />
            <p className="font-bold" style={{ color: ECHO_COLORS.textPrimary }}>
              {booking.guestCount}
            </p>
            <p className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>
              Guests
            </p>
          </div>
          <div
            className="p-3 rounded-xl text-center"
            style={{ background: 'rgba(139, 0, 139, 0.1)' }}
          >
            <DollarSign className="w-5 h-5 mx-auto mb-1" style={{ color: ECHO_COLORS.echoOrange }} />
            <p className="font-bold" style={{ color: ECHO_COLORS.textPrimary }}>
              ${booking.totalPrice.toLocaleString()}
            </p>
            <p className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>
              Total
            </p>
          </div>
        </div>

        {/* Special Requests */}
        {booking.specialReqs && (
          <div
            className="p-4 rounded-xl mb-4"
            style={{ background: 'rgba(139, 0, 139, 0.1)', border: '1px solid rgba(139, 0, 139, 0.2)' }}
          >
            <p className="text-sm font-medium mb-2" style={{ color: ECHO_COLORS.textSecondary }}>
              Special Requests
            </p>
            <p style={{ color: ECHO_COLORS.textPrimary }}>{booking.specialReqs}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            className="flex-1 px-4 py-3 rounded-xl font-medium transition-colors"
            style={{
              background: 'rgba(139, 0, 139, 0.2)',
              color: ECHO_COLORS.textPrimary,
              border: '1px solid rgba(139, 0, 139, 0.3)',
            }}
          >
            Edit Booking
          </button>
          <button
            className="flex-1 px-4 py-3 rounded-xl font-medium transition-colors"
            style={{
              background: `linear-gradient(135deg, ${ECHO_COLORS.echoOrange}, ${ECHO_COLORS.darkMagenta})`,
              color: ECHO_COLORS.textPrimary,
            }}
          >
            Message Guest
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function BookingCalendar() {
  const { bookings: contextBookings, properties: contextProperties } = useApp();
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const [bookingsData, propertiesData] = await Promise.all([
          db.getBookings(),
          db.getProperties(),
        ]);

        if (bookingsData && bookingsData.length > 0) {
          setBookings(bookingsData);
        } else {
          // Map context bookings to expected type
          setBookings(
            contextBookings.map((b) => ({
              ...b,
              property: contextProperties.find((p) => p.id === b.propertyId) as any,
              guest: { name: 'Guest', email: '' } as any,
            })) as BookingWithRelations[]
          );
        }

        if (propertiesData && propertiesData.length > 0) {
          setProperties(propertiesData);
        } else {
          setProperties(contextProperties as any);
        }
      } catch (error) {
        console.error('Error loading bookings:', error);
        // Fallback to context
        setBookings(
          contextBookings.map((b) => ({
            ...b,
            property: contextProperties.find((p) => p.id === b.propertyId) as any,
            guest: { name: 'Guest', email: '' } as any,
          })) as BookingWithRelations[]
        );
        setProperties(contextProperties as any);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [contextBookings, contextProperties]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentDate);

  // Navigate months
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesProperty =
        propertyFilter === 'all' || booking.propertyId === propertyFilter;
      const matchesSearch =
        !searchQuery ||
        booking.guest?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.property?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.confirmCode?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesProperty && matchesSearch;
    });
  }, [bookings, propertyFilter, searchQuery]);

  // Get bookings for a specific day
  const getBookingsForDay = (day: number) => {
    const date = new Date(year, month, day);
    return filteredBookings.filter((booking) => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      checkIn.setHours(0, 0, 0, 0);
      checkOut.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      return date >= checkIn && date <= checkOut;
    });
  };

  // Check if a day is today
  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  }, [firstDayOfMonth, daysInMonth]);

  // Get upcoming bookings for list view
  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return filteredBookings
      .filter((b) => new Date(b.checkIn) >= now)
      .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
      .slice(0, 20);
  }, [filteredBookings]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen p-6" style={{ background: ECHO_COLORS.echoBlack }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
      >
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Orbitron, sans-serif' }}
          >
            Booking Calendar
          </h1>
          <p style={{ color: ECHO_COLORS.textSecondary }}>
            {filteredBookings.length} bookings across {properties.length} properties
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
          style={{
            background: `linear-gradient(135deg, ${ECHO_COLORS.echoOrange}, ${ECHO_COLORS.darkMagenta})`,
            color: ECHO_COLORS.textPrimary,
          }}
        >
          <Plus className="w-5 h-5" />
          New Booking
        </button>
      </motion.div>

      {/* Filters Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-4 mb-6"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: ECHO_COLORS.textSecondary }}
          />
          <input
            type="text"
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl outline-none"
            style={{
              background: 'rgba(139, 0, 139, 0.1)',
              border: '1px solid rgba(139, 0, 139, 0.3)',
              color: ECHO_COLORS.textPrimary,
            }}
          />
        </div>

        {/* Property Filter */}
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="px-4 py-2 rounded-xl outline-none"
          style={{
            background: 'rgba(139, 0, 139, 0.1)',
            border: '1px solid rgba(139, 0, 139, 0.3)',
            color: ECHO_COLORS.textPrimary,
          }}
        >
          <option value="all">All Properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* View Mode Toggle */}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(139, 0, 139, 0.3)' }}
        >
          {(['month', 'week', 'list'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="px-3 py-2 transition-colors"
              style={{
                background:
                  viewMode === mode ? ECHO_COLORS.darkMagenta : 'rgba(139, 0, 139, 0.2)',
                color: ECHO_COLORS.textPrimary,
              }}
            >
              {mode === 'month' && <Calendar className="w-4 h-4" />}
              {mode === 'week' && <Grid className="w-4 h-4" />}
              {mode === 'list' && <List className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-4 rounded-full"
            style={{
              borderColor: `${ECHO_COLORS.darkMagenta} transparent transparent transparent`,
            }}
          />
        </div>
      )}

      {/* Calendar View */}
      {!loading && viewMode === 'month' && (
        <GlassCard className="p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={prevMonth}
                className="p-2 rounded-lg transition-colors"
                style={{ background: 'rgba(139, 0, 139, 0.2)', color: ECHO_COLORS.textPrimary }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2
                className="text-xl font-semibold min-w-[200px] text-center"
                style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
              >
                {monthName} {year}
              </h2>
              <button
                onClick={nextMonth}
                className="p-2 rounded-lg transition-colors"
                style={{ background: 'rgba(139, 0, 139, 0.2)', color: ECHO_COLORS.textPrimary }}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={goToToday}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: 'rgba(139, 0, 139, 0.2)',
                color: ECHO_COLORS.textPrimary,
                border: '1px solid rgba(139, 0, 139, 0.3)',
              }}
            >
              Today
            </button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium"
                style={{ color: ECHO_COLORS.textSecondary }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="h-24" />;
              }

              const dayBookings = getBookingsForDay(day);
              const today = isToday(day);

              return (
                <motion.div
                  key={day}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.01 }}
                  className="h-24 p-1 rounded-lg overflow-hidden"
                  style={{
                    background: today ? 'rgba(255, 107, 53, 0.1)' : 'rgba(139, 0, 139, 0.05)',
                    border: today
                      ? '2px solid rgba(255, 107, 53, 0.5)'
                      : '1px solid rgba(139, 0, 139, 0.1)',
                  }}
                >
                  <div
                    className="text-sm font-medium mb-1"
                    style={{ color: today ? ECHO_COLORS.echoOrange : ECHO_COLORS.textPrimary }}
                  >
                    {day}
                  </div>
                  <div className="space-y-0.5 overflow-y-auto max-h-[60px]">
                    {dayBookings.slice(0, 3).map((booking) => {
                      const color = getPropertyColor(booking.propertyId);
                      return (
                        <button
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className="w-full text-left px-1 py-0.5 rounded text-xs truncate"
                          style={{
                            background: color.bg,
                            borderLeft: `2px solid ${color.border}`,
                            color: ECHO_COLORS.textPrimary,
                          }}
                        >
                          {booking.guest?.name || 'Guest'}
                        </button>
                      );
                    })}
                    {dayBookings.length > 3 && (
                      <div
                        className="text-xs px-1"
                        style={{ color: ECHO_COLORS.textSecondary }}
                      >
                        +{dayBookings.length - 3} more
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* List View */}
      {!loading && viewMode === 'list' && (
        <div className="space-y-4">
          {upcomingBookings.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4" style={{ color: ECHO_COLORS.darkMagenta }} />
              <p style={{ color: ECHO_COLORS.textPrimary }} className="text-lg">
                No upcoming bookings
              </p>
              <p style={{ color: ECHO_COLORS.textSecondary }}>
                Bookings will appear here when guests book your properties
              </p>
            </GlassCard>
          ) : (
            upcomingBookings.map((booking, index) => {
              const statusColor = STATUS_COLORS[booking.status] || STATUS_COLORS.PENDING;
              const propertyColor = getPropertyColor(booking.propertyId);

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <GlassCard
                    className="p-4 cursor-pointer hover:scale-[1.01] transition-transform"
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Color indicator */}
                      <div
                        className="w-2 h-16 rounded-full"
                        style={{ background: propertyColor.border }}
                      />

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3
                            className="font-semibold truncate"
                            style={{ color: ECHO_COLORS.textPrimary }}
                          >
                            {booking.guest?.name || 'Guest'}
                          </h3>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                            style={{
                              background: statusColor.bg,
                              color: statusColor.text,
                              border: `1px solid ${statusColor.border}`,
                            }}
                          >
                            {booking.status}
                          </span>
                        </div>
                        <p
                          className="text-sm flex items-center gap-2"
                          style={{ color: ECHO_COLORS.textSecondary }}
                        >
                          <Home className="w-4 h-4" />
                          {booking.property?.name || 'Property'}
                        </p>
                      </div>

                      {/* Dates */}
                      <div className="text-right">
                        <p style={{ color: ECHO_COLORS.textPrimary }}>
                          {formatDate(new Date(booking.checkIn))}
                        </p>
                        <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                          {booking.totalNights} nights
                        </p>
                      </div>

                      {/* Price */}
                      <div
                        className="text-right px-4 py-2 rounded-lg"
                        style={{ background: 'rgba(139, 0, 139, 0.1)' }}
                      >
                        <p
                          className="font-bold"
                          style={{ color: ECHO_COLORS.echoOrange }}
                        >
                          ${booking.totalPrice.toLocaleString()}
                        </p>
                        <p className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>
                          total
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Week View Placeholder */}
      {!loading && viewMode === 'week' && (
        <GlassCard className="p-12 text-center">
          <Grid className="w-16 h-16 mx-auto mb-4" style={{ color: ECHO_COLORS.darkMagenta }} />
          <p style={{ color: ECHO_COLORS.textPrimary }} className="text-lg">
            Week View Coming Soon
          </p>
          <p style={{ color: ECHO_COLORS.textSecondary }}>
            Detailed week-by-week booking timeline
          </p>
        </GlassCard>
      )}

      {/* Property Legend */}
      {!loading && viewMode === 'month' && properties.length > 0 && (
        <GlassCard className="p-4 mt-6">
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: ECHO_COLORS.textSecondary }}
          >
            Property Legend
          </h3>
          <div className="flex flex-wrap gap-3">
            {properties.slice(0, 8).map((property) => {
              const color = getPropertyColor(property.id);
              return (
                <div key={property.id} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ background: color.border }}
                  />
                  <span className="text-sm" style={{ color: ECHO_COLORS.textPrimary }}>
                    {property.name}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Booking Detail Modal */}
      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailModal
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
