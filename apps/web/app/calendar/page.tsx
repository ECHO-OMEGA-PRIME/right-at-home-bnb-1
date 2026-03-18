'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Home,
  Users,
  DollarSign,
  Clock,
  Filter,
  X,
  MapPin,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import DashboardShell from '@/components/layout/DashboardShell';

interface CalendarBooking {
  id: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalAmount: number;
  platform: string;
  nights: number;
}

interface Property {
  id: string;
  name: string;
  color: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Property colors for visual distinction
const PROPERTY_COLORS = [
  'bg-maroon-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-purple-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-orange-600',
];

function getPropertyColor(index: number): string {
  return PROPERTY_COLORS[index % PROPERTY_COLORS.length];
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<'month' | 'week'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Fetch bookings and properties
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch properties
        const propsRes = await fetch('/api/properties');
        if (propsRes.ok) {
          const propsData = await propsRes.json();
          const mappedProps = propsData.data?.map((p: any, i: number) => ({
            id: p.id,
            name: p.name,
            color: getPropertyColor(i),
          })) || [];
          setProperties(mappedProps);
          setSelectedProperties(mappedProps.map((p: Property) => p.id));
        }

        // Fetch bookings for the current month range
        const startDate = new Date(year, month, 1).toISOString();
        const endDate = new Date(year, month + 1, 0).toISOString();
        const bookingsRes = await fetch(`/api/bookings?startDate=${startDate}&endDate=${endDate}`);
        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          setBookings(bookingsData.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch calendar data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [year, month]);

  // Get bookings for a specific date
  const getBookingsForDate = useMemo(() => {
    return (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      return bookings.filter(booking => {
        if (!selectedProperties.includes(booking.propertyId)) return false;
        const checkIn = new Date(booking.checkIn).toISOString().split('T')[0];
        const checkOut = new Date(booking.checkOut).toISOString().split('T')[0];
        return dateStr >= checkIn && dateStr < checkOut;
      });
    };
  }, [bookings, selectedProperties]);

  // Get bookings for selected date
  const selectedDateBookings = useMemo(() => {
    if (!selectedDate) return [];
    return getBookingsForDate(selectedDate);
  }, [selectedDate, getBookingsForDate]);

  // Navigate months
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Toggle property filter
  const toggleProperty = (propertyId: string) => {
    setSelectedProperties(prev =>
      prev.includes(propertyId)
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Empty cells for days before first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, date: null });
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayBookings = getBookingsForDate(date);
      const isToday = date.getTime() === today.getTime();
      const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
      const isPast = date < today;

      days.push({
        day,
        date,
        bookings: dayBookings,
        isToday,
        isSelected,
        isPast,
      });
    }

    return days;
  }, [year, month, firstDay, daysInMonth, selectedDate, getBookingsForDate]);

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    const filteredBookings = bookings.filter(b =>
      selectedProperties.includes(b.propertyId)
    );
    const totalRevenue = filteredBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalNights = filteredBookings.reduce((sum, b) => sum + b.nights, 0);
    const occupancyRate = properties.length > 0
      ? Math.round((totalNights / (daysInMonth * properties.length)) * 100)
      : 0;

    return {
      totalBookings: filteredBookings.length,
      totalRevenue,
      totalNights,
      occupancyRate: Math.min(occupancyRate, 100),
    };
  }, [bookings, selectedProperties, properties.length, daysInMonth]);

  return (
    <DashboardShell>
    <div className="min-h-screen bg-[#0a0505]">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#1a0a0a]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-maroon-800/30">
                <CalendarIcon className="h-6 w-6 text-maroon-400" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-white">Calendar</h1>
                <p className="text-sm text-white/60">Manage bookings across all properties</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                  showFilters
                    ? 'bg-maroon-800 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                )}
              >
                <Filter className="h-4 w-4" />
                Filters
                {selectedProperties.length < properties.length && (
                  <span className="px-1.5 py-0.5 rounded bg-maroon-600 text-xs">
                    {selectedProperties.length}
                  </span>
                )}
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-700 text-white text-sm font-medium transition-colors"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/10 bg-[#1a0a0a]/50 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex flex-wrap gap-2">
                {properties.map((property, index) => (
                  <button
                    key={property.id}
                    onClick={() => toggleProperty(property.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2',
                      selectedProperties.includes(property.id)
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    )}
                  >
                    <span className={cn('w-2 h-2 rounded-full', getPropertyColor(index))} />
                    {property.name}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Monthly Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="h-4 w-4 text-maroon-400" />
              <span className="text-sm text-white/60">Bookings</span>
            </div>
            <p className="text-2xl font-bold text-white">{monthlyStats.totalBookings}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-white/60">Revenue</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(monthlyStats.totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-white/60">Nights Booked</span>
            </div>
            <p className="text-2xl font-bold text-white">{monthlyStats.totalNights}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Home className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-white/60">Occupancy</span>
            </div>
            <p className="text-2xl font-bold text-white">{monthlyStats.occupancyRate}%</p>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Main Calendar */}
          <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 overflow-hidden">
            {/* Month Navigation */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <button
                onClick={goToPrevMonth}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-white/70" />
              </button>
              <h2 className="text-lg font-semibold text-white">
                {MONTHS[month]} {year}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-white/70" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-white/10">
              {DAYS.map(day => (
                <div
                  key={day}
                  className="py-2 text-center text-sm font-medium text-white/50"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            {isLoading ? (
              <div className="h-96 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-maroon-800/30 border-t-maroon-600" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((dayData, index) => (
                  <div
                    key={index}
                    className={cn(
                      'min-h-24 border-b border-r border-white/5 p-1 transition-colors',
                      dayData.day === null && 'bg-white/[0.02]',
                      dayData.isPast && 'opacity-50',
                      dayData.isToday && 'bg-maroon-800/10',
                      dayData.isSelected && 'bg-maroon-800/20 ring-1 ring-inset ring-maroon-500'
                    )}
                    onClick={() => dayData.date && setSelectedDate(dayData.date)}
                  >
                    {dayData.day && (
                      <>
                        <div
                          className={cn(
                            'w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1',
                            dayData.isToday && 'bg-maroon-600 text-white font-semibold',
                            !dayData.isToday && 'text-white/70 hover:bg-white/10 cursor-pointer'
                          )}
                        >
                          {dayData.day}
                        </div>
                        <div className="space-y-0.5 overflow-hidden">
                          {dayData.bookings?.slice(0, 3).map((booking, i) => {
                            const propIndex = properties.findIndex(p => p.id === booking.propertyId);
                            return (
                              <div
                                key={booking.id}
                                className={cn(
                                  'text-[10px] px-1 py-0.5 rounded truncate text-white',
                                  getPropertyColor(propIndex)
                                )}
                                title={`${booking.guestName} - ${booking.propertyName}`}
                              >
                                {booking.guestName}
                              </div>
                            );
                          })}
                          {dayData.bookings && dayData.bookings.length > 3 && (
                            <div className="text-[10px] text-white/50 px-1">
                              +{dayData.bookings.length - 3} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Side Panel - Selected Date Details */}
          <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 p-4 h-fit lg:sticky lg:top-24">
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h3>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <X className="h-4 w-4 text-white/50" />
                  </button>
                </div>

                {selectedDateBookings.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDateBookings.map((booking, index) => {
                      const propIndex = properties.findIndex(p => p.id === booking.propertyId);
                      return (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-3 rounded-lg bg-white/5 border border-white/10"
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn('w-1 h-full rounded-full self-stretch', getPropertyColor(propIndex))} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-white truncate">
                                  {booking.guestName}
                                </span>
                                <span className={cn(
                                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                  booking.status === 'confirmed' && 'bg-emerald-500/20 text-emerald-400',
                                  booking.status === 'pending' && 'bg-amber-500/20 text-amber-400',
                                  booking.status === 'cancelled' && 'bg-red-500/20 text-red-400'
                                )}>
                                  {booking.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-white/60 mb-2">
                                <MapPin className="h-3 w-3" />
                                {booking.propertyName}
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-1 text-white/50">
                                  <Clock className="h-3 w-3" />
                                  {booking.nights} nights
                                </div>
                                <span className="font-medium text-emerald-400">
                                  {formatCurrency(booking.totalAmount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-12 w-12 text-white/20 mx-auto mb-3" />
                    <p className="text-white/50">No bookings on this date</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/50">Select a date to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </DashboardShell>
  );
}
