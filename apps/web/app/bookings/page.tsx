'use client';

/**
 * Bookings Page - Calendar Sync & Management
 * Right at Home BnB - Steven Palma
 *
 * Features:
 * - Full calendar view with month navigation
 * - Property color coding
 * - Booking details modal
 * - Sync status indicators
 * - Conflict warnings
 * - Platform filtering (Airbnb, VRBO, Direct)
 *
 * ECHO OMEGA PRIME | Made by Commander Bobby Don McWilliams II
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle,
  User, Phone, Mail, Clock, DollarSign, Home, X, Check,
  Loader2, Plus, ExternalLink, Settings, Filter,
  Moon, Sun
} from 'lucide-react';
import AddFeedModal from '@/components/bookings/AddFeedModal';
import ConflictsModal from '@/components/bookings/ConflictsModal';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
  parseISO, isWithinInterval, differenceInDays, addDays
} from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  platform: 'airbnb' | 'vrbo' | 'booking' | 'direct' | 'other';
  guestName: string | null;
  guestCount: number;
  confirmationCode: string | null;
  totalPrice: number | null;
  color: string;
  propertyId?: string;
  propertyName?: string;
}

interface BookingDetail {
  uid: string;
  summary: string;
  start_date: string;
  end_date: string;
  platform: string;
  confirmation_code: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  num_guests: number;
  total_price: number | null;
  nights: number;
  special_requests: string | null;
}

interface SyncStatus {
  property_id: string;
  platform: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed';
  bookings_found: number;
  bookings_new: number;
  synced_at: string;
  error_message: string | null;
}

interface Conflict {
  property_id: string;
  booking1_platform: string;
  booking1_start: string;
  booking1_end: string;
  booking2_platform: string;
  booking2_start: string;
  booking2_end: string;
  overlap_days: number;
}

interface Feed {
  property_id: string;
  platform: string;
  url: string;
  enabled: boolean;
  last_sync: string | null;
  last_status: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORM_COLORS: Record<string, string> = {
  airbnb: '#FF5A5F',
  vrbo: '#3B5998',
  booking: '#003580',
  direct: '#10B981',
  other: '#8B5CF6',
};

const PLATFORM_NAMES: Record<string, string> = {
  airbnb: 'Airbnb',
  vrbo: 'VRBO',
  booking: 'Booking.com',
  direct: 'Direct',
  other: 'Other',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================================================
// HOOKS
// ============================================================================

function useCalendarData(month: number, year: number, propertyFilter: string | null) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
      });
      if (propertyFilter) {
        params.append('property_id', propertyFilter);
      }

      const response = await fetch(`${API_BASE}/api/bookings/calendar?${params}`);
      if (!response.ok) throw new Error('Failed to fetch calendar data');

      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Generate sample data for demo
      setEvents(generateSampleEvents(month, year));
    } finally {
      setLoading(false);
    }
  }, [month, year, propertyFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { events, loading, error, refetch: fetchData };
}

function useSyncStatus() {
  const [status, setStatus] = useState<Record<string, SyncStatus>>({});
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/bookings/sync/status`);
      if (!response.ok) return;
      const data = await response.json();
      // Flatten the nested structure
      const flatStatus: Record<string, SyncStatus> = {};
      for (const propId in data) {
        for (const platform in data[propId]) {
          flatStatus[`${propId}:${platform}`] = data[propId][platform];
        }
      }
      setStatus(flatStatus);
    } catch {
      // Ignore errors for status
    }
  }, []);

  const triggerSync = useCallback(async (propertyId?: string) => {
    setLoading(true);
    try {
      const body: { property_id?: string } = {};
      if (propertyId) body.property_id = propertyId;

      await fetch(`${API_BASE}/api/bookings/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await fetchStatus();
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, loading, triggerSync, refetch: fetchStatus };
}

function useConflicts() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    async function fetch() {
      try {
        const response = await globalThis.fetch(`${API_BASE}/api/bookings/conflicts`);
        if (response.ok) {
          setConflicts(await response.json());
        }
      } catch {
        // No demo conflicts - return empty array
        setConflicts([]);
      }
    }
    fetch();
  }, []);

  return conflicts;
}

// ============================================================================
// SAMPLE DATA GENERATOR
// ============================================================================

function generateSampleEvents(_month: number, _year: number): CalendarEvent[] {
  // No mock data - return empty array; real data comes from the API
  return [];
}

// ============================================================================
// COMPONENTS
// ============================================================================

function CalendarHeader({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}: {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <button
          onClick={onToday}
          className="px-3 py-1 text-sm bg-[#500000]/10 hover:bg-[#500000]/20 text-[#500000] rounded-lg transition-colors"
        >
          Today
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevMonth}
          className="p-2 hover:bg-[#500000]/10 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-[#2D2D2D]" />
        </button>
        <button
          onClick={onNextMonth}
          className="p-2 hover:bg-[#500000]/10 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-[#2D2D2D]" />
        </button>
      </div>
    </div>
  );
}

function CalendarGrid({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const startDate = parseISO(event.start);
      const endDate = parseISO(event.end);
      const eventDays = eachDayOfInterval({ start: startDate, end: addDays(endDate, -1) });
      eventDays.forEach((day) => {
        const key = format(day, 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(event);
      });
    });
    return map;
  }, [events]);

  return (
    <div className="bg-white rounded-2xl border border-[#2D2D2D]/10 overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-[#2D2D2D]/10">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-3 text-center text-sm font-semibold text-[#2D2D2D]/70 bg-[#F5F5F0]"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={idx}
              className={`min-h-[120px] p-2 border-b border-r border-[#2D2D2D]/5 ${
                !isCurrentMonth ? 'bg-[#F5F5F0]/50' : ''
              }`}
            >
              <div
                className={`text-sm mb-1 ${
                  isToday
                    ? 'w-7 h-7 rounded-full bg-[#500000] text-white flex items-center justify-center font-bold'
                    : isCurrentMonth
                    ? 'text-[#2D2D2D]'
                    : 'text-[#2D2D2D]/30'
                }`}
              >
                {format(day, 'd')}
              </div>

              {/* Events */}
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event, eventIdx) => {
                  const eventStart = parseISO(event.start);
                  const isFirstDay = isSameDay(eventStart, day);

                  return (
                    <motion.button
                      key={`${event.id}-${eventIdx}`}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => onEventClick(event)}
                      className={`w-full text-left text-xs px-2 py-1 rounded truncate ${
                        isFirstDay ? 'rounded-l' : ''
                      }`}
                      style={{ backgroundColor: `${event.color}20`, color: event.color }}
                    >
                      {isFirstDay && (
                        <span className="font-medium">
                          {event.guestName || event.title}
                        </span>
                      )}
                      {!isFirstDay && <span className="opacity-70">...</span>}
                    </motion.button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-[#2D2D2D]/50 px-2">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingModal({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const startDate = parseISO(event.start);
  const endDate = parseISO(event.end);
  const nights = differenceInDays(endDate, startDate);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="p-6 rounded-t-2xl"
            style={{ backgroundColor: `${event.color}15` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3"
                  style={{ backgroundColor: event.color, color: 'white' }}
                >
                  {PLATFORM_NAMES[event.platform] || event.platform}
                </div>
                <h3 className="text-xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                  {event.guestName || 'Guest'}
                </h3>
                {event.propertyName && (
                  <p className="text-[#2D2D2D]/60 flex items-center gap-1 mt-1">
                    <Home className="w-4 h-4" />
                    {event.propertyName}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-black/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#2D2D2D]" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#F5F5F0] rounded-xl">
                <div className="text-sm text-[#2D2D2D]/60 mb-1">Check-in</div>
                <div className="font-semibold text-[#2D2D2D]">
                  {format(startDate, 'EEE, MMM d, yyyy')}
                </div>
                <div className="text-sm text-[#2D2D2D]/60">After 3:00 PM</div>
              </div>
              <div className="p-4 bg-[#F5F5F0] rounded-xl">
                <div className="text-sm text-[#2D2D2D]/60 mb-1">Check-out</div>
                <div className="font-semibold text-[#2D2D2D]">
                  {format(endDate, 'EEE, MMM d, yyyy')}
                </div>
                <div className="text-sm text-[#2D2D2D]/60">Before 11:00 AM</div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-[#500000]/5 rounded-xl">
                <Moon className="w-5 h-5 mx-auto text-[#500000] mb-1" />
                <div className="font-bold text-[#2D2D2D]">{nights}</div>
                <div className="text-xs text-[#2D2D2D]/60">Nights</div>
              </div>
              <div className="text-center p-3 bg-[#500000]/5 rounded-xl">
                <User className="w-5 h-5 mx-auto text-[#500000] mb-1" />
                <div className="font-bold text-[#2D2D2D]">{event.guestCount}</div>
                <div className="text-xs text-[#2D2D2D]/60">Guests</div>
              </div>
              <div className="text-center p-3 bg-[#500000]/5 rounded-xl">
                <DollarSign className="w-5 h-5 mx-auto text-[#500000] mb-1" />
                <div className="font-bold text-[#2D2D2D]">
                  ${event.totalPrice?.toLocaleString() || '--'}
                </div>
                <div className="text-xs text-[#2D2D2D]/60">Total</div>
              </div>
            </div>

            {/* Confirmation Code */}
            {event.confirmationCode && (
              <div className="p-4 bg-[#F5F5F0] rounded-xl">
                <div className="text-sm text-[#2D2D2D]/60 mb-1">Confirmation Code</div>
                <div className="font-mono font-bold text-lg text-[#500000]">
                  {event.confirmationCode}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button className="flex-1 py-3 bg-[#500000] text-white rounded-xl font-medium hover:bg-[#500000]/90 transition-colors">
                Send Message
              </button>
              <button className="px-4 py-3 border border-[#2D2D2D]/20 rounded-xl hover:bg-[#F5F5F0] transition-colors">
                <ExternalLink className="w-5 h-5 text-[#2D2D2D]" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SyncPanel({
  syncing,
  onSync,
  conflicts,
  onViewConflicts,
}: {
  syncing: boolean;
  onSync: () => void;
  conflicts: Conflict[];
  onViewConflicts: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#2D2D2D]/10 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-['Playfair_Display'] font-bold text-[#2D2D2D]">
          Calendar Sync
        </h3>
        <button
          onClick={onSync}
          disabled={syncing}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
            syncing
              ? 'bg-[#500000]/50 text-white cursor-not-allowed'
              : 'bg-[#500000] text-white hover:bg-[#500000]/90'
          }`}
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Platform status */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {Object.entries(PLATFORM_NAMES).slice(0, 3).map(([key, name]) => (
          <div
            key={key}
            className="flex items-center gap-2 p-3 bg-[#F5F5F0] rounded-xl"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: PLATFORM_COLORS[key] }}
            />
            <span className="text-sm font-medium text-[#2D2D2D]">{name}</span>
            <Check className="w-4 h-4 text-green-500 ml-auto" />
          </div>
        ))}
      </div>

      {/* Conflicts warning */}
      {conflicts.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800">
              {conflicts.length} Booking Conflict{conflicts.length > 1 ? 's' : ''} Detected
            </div>
            <p className="text-sm text-amber-700 mt-1">
              Overlapping bookings found between platforms. Review and resolve to avoid double-bookings.
            </p>
            <button
              onClick={onViewConflicts}
              className="text-sm font-medium text-amber-800 hover:text-amber-900 mt-2"
            >
              View Conflicts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformLegend({ platforms }: { platforms: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {platforms.map((platform) => (
        <div key={platform} className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: PLATFORM_COLORS[platform] }}
          />
          <span className="text-sm text-[#2D2D2D]/70">
            {PLATFORM_NAMES[platform] || platform}
          </span>
        </div>
      ))}
    </div>
  );
}

function UpcomingBookings({ events }: { events: CalendarEvent[] }) {
  const upcoming = useMemo(() => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);
    return events
      .filter((e) => {
        const start = parseISO(e.start);
        return start >= now && start <= weekFromNow;
      })
      .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
      .slice(0, 5);
  }, [events]);

  if (upcoming.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#2D2D2D]/10 p-6 mb-6">
      <h3 className="font-['Playfair_Display'] font-bold text-[#2D2D2D] mb-4">
        Upcoming Check-ins (7 days)
      </h3>
      <div className="space-y-3">
        {upcoming.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-4 p-3 bg-[#F5F5F0] rounded-xl"
          >
            <div
              className="w-2 h-10 rounded-full"
              style={{ backgroundColor: event.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[#2D2D2D] truncate">
                {event.guestName || 'Guest'}
              </div>
              <div className="text-sm text-[#2D2D2D]/60">
                {event.propertyName || 'Property'}
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium text-[#2D2D2D]">
                {format(parseISO(event.start), 'MMM d')}
              </div>
              <div className="text-sm text-[#2D2D2D]/60">
                {differenceInDays(parseISO(event.end), parseISO(event.start))} nights
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsCards({ events }: { events: CalendarEvent[] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const monthlyBookings = events.filter((e) => {
      const start = parseISO(e.start);
      return start >= monthStart && start <= monthEnd;
    });

    const totalRevenue = monthlyBookings.reduce(
      (sum, e) => sum + (e.totalPrice || 0),
      0
    );

    const totalNights = monthlyBookings.reduce((sum, e) => {
      return sum + differenceInDays(parseISO(e.end), parseISO(e.start));
    }, 0);

    const byPlatform: Record<string, number> = {};
    monthlyBookings.forEach((e) => {
      byPlatform[e.platform] = (byPlatform[e.platform] || 0) + 1;
    });

    return {
      totalBookings: monthlyBookings.length,
      totalRevenue,
      totalNights,
      byPlatform,
    };
  }, [events]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-2xl border border-[#2D2D2D]/10 p-6">
        <div className="text-sm text-[#2D2D2D]/60 mb-1">This Month</div>
        <div className="text-3xl font-bold text-[#500000]">{stats.totalBookings}</div>
        <div className="text-sm text-[#2D2D2D]/60">Bookings</div>
      </div>
      <div className="bg-white rounded-2xl border border-[#2D2D2D]/10 p-6">
        <div className="text-sm text-[#2D2D2D]/60 mb-1">Revenue</div>
        <div className="text-3xl font-bold text-[#500000]">
          ${stats.totalRevenue.toLocaleString()}
        </div>
        <div className="text-sm text-[#2D2D2D]/60">This Month</div>
      </div>
      <div className="bg-white rounded-2xl border border-[#2D2D2D]/10 p-6">
        <div className="text-sm text-[#2D2D2D]/60 mb-1">Booked Nights</div>
        <div className="text-3xl font-bold text-[#500000]">{stats.totalNights}</div>
        <div className="text-sm text-[#2D2D2D]/60">This Month</div>
      </div>
      <div className="bg-white rounded-2xl border border-[#2D2D2D]/10 p-6">
        <div className="text-sm text-[#2D2D2D]/60 mb-1">Top Platform</div>
        <div className="text-3xl font-bold text-[#500000]">
          {Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1])[0]?.[0] || '--'}
        </div>
        <div className="text-sm text-[#2D2D2D]/60">
          {Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} bookings
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function BookingsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);
  const [showAddFeedModal, setShowAddFeedModal] = useState(false);
  const [showConflictsModal, setShowConflictsModal] = useState(false);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  // Demo properties list - in production, fetch from API
  const properties = [
    { id: 'prop-1', name: '2501 Stanolind Ave' },
    { id: 'prop-2', name: '3109 Princeton Ave' },
    { id: 'prop-3', name: '4205 Monty Dr' },
    { id: 'prop-4', name: '2710 Gulf Ave' },
    { id: 'prop-5', name: '4501 Princeton Ave' },
    { id: 'prop-6', name: '3807 Humble Ave' },
    { id: 'prop-7', name: '2614 Mariana St' },
    { id: 'prop-8', name: '3911 Shell Ave' },
    { id: 'prop-9', name: '4205 Monty Dr #B' },
    { id: 'prop-10', name: '2306 W Louisiana Ave' },
    { id: 'prop-11', name: '3704 Shell Ave' },
    { id: 'prop-12', name: '2609 W Kentucky Ave' },
    { id: 'prop-13', name: '2610 W Michigan Ave' },
    { id: 'prop-14', name: '2405 Brunson Ave' },
    { id: 'prop-15', name: '2503 Brunson Ave' },
    { id: 'prop-16', name: '4503 Monty Dr' },
    { id: 'prop-17', name: '3606 Humble Ave' },
    { id: 'prop-18', name: '2308 W Louisiana Ave' },
    { id: 'prop-19', name: '3505 W Golf Course Rd' },
    { id: 'prop-20', name: '2601 Mariana St' },
    { id: 'prop-21', name: '3709 Shell Ave' },
    { id: 'prop-22', name: '4007 Monty Dr' },
  ];

  const { events, loading, refetch } = useCalendarData(month, year, propertyFilter);
  const { loading: syncing, triggerSync } = useSyncStatus();
  const conflicts = useConflicts();

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleSync = async () => {
    await triggerSync();
    refetch();
  };

  const platforms = useMemo(() => {
    const set = new Set(events.map((e) => e.platform));
    return Array.from(set);
  }, [events]);

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-['Playfair_Display'] font-bold text-[#500000]">
              Bookings & Calendar
            </h1>
            <p className="text-sm text-[#2D2D2D]/60">
              Airbnb + VRBO calendar sync and booking management
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors">
              <Filter className="w-5 h-5 text-[#2D2D2D]/60" />
            </button>
            <button className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-[#2D2D2D]/60" />
            </button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats */}
        <StatsCards events={events} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Calendar */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-[#2D2D2D]/10 p-6">
              <CalendarHeader
                currentDate={currentDate}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onToday={handleToday}
              />

              <PlatformLegend platforms={platforms} />

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-[#500000]" />
                </div>
              ) : (
                <CalendarGrid
                  currentDate={currentDate}
                  events={events}
                  onEventClick={setSelectedEvent}
                />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <SyncPanel
              syncing={syncing}
              onSync={handleSync}
              conflicts={conflicts}
              onViewConflicts={() => setShowConflictsModal(true)}
            />

            <UpcomingBookings events={events} />

            {/* Add Feed CTA */}
            <div className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-2xl p-6 text-white">
              <h3 className="font-['Playfair_Display'] font-bold mb-2">
                Connect More Platforms
              </h3>
              <p className="text-sm text-white/80 mb-4">
                Import your Airbnb and VRBO calendar feeds to keep everything in sync.
              </p>
              <button
                onClick={() => setShowAddFeedModal(true)}
                className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Calendar Feed
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Detail Modal */}
      {selectedEvent && (
        <BookingModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {/* Add Feed Modal */}
      <AddFeedModal
        isOpen={showAddFeedModal}
        onClose={() => setShowAddFeedModal(false)}
        onSuccess={() => {
          refetch();
          setShowAddFeedModal(false);
        }}
        properties={properties}
      />

      {/* Conflicts Modal */}
      <ConflictsModal
        isOpen={showConflictsModal}
        onClose={() => setShowConflictsModal(false)}
        conflicts={conflicts.map((c) => ({
          property_id: c.property_id,
          booking1_uid: '',
          booking1_platform: c.booking1_platform,
          booking1_start: c.booking1_start,
          booking1_end: c.booking1_end,
          booking2_uid: '',
          booking2_platform: c.booking2_platform,
          booking2_start: c.booking2_start,
          booking2_end: c.booking2_end,
          overlap_start: c.booking1_start,
          overlap_end: c.booking2_start,
          overlap_days: c.overlap_days,
          detected_at: new Date().toISOString(),
        }))}
        propertyNames={properties.reduce(
          (acc, p) => ({ ...acc, [p.id]: p.name }),
          {} as Record<string, string>
        )}
      />
    </div>
  );
}
