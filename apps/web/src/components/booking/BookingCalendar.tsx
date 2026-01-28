'use client';

import React, { useState, useMemo } from 'react';
import { cn, formatDate, getPlatformColor } from '@/lib/utils';
import type { BookingCalendarEvent } from '@/lib/types';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BookingCalendarProps {
  bookings: BookingCalendarEvent[];
  onDateSelect?: (date: Date) => void;
  onBookingSelect?: (booking: BookingCalendarEvent) => void;
  className?: string;
  showPropertyFilter?: boolean;
  properties?: { id: string; name: string }[];
}

export function BookingCalendar({
  bookings,
  onDateSelect,
  onBookingSelect,
  className,
  showPropertyFilter = false,
  properties = [],
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');

  const filteredBookings = useMemo(() => {
    if (selectedPropertyId === 'all') return bookings;
    return bookings.filter((b) => b.propertyId === selectedPropertyId);
  }, [bookings, selectedPropertyId]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  // Generate calendar days
  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  // Get bookings for a specific day
  const getBookingsForDay = (date: Date): BookingCalendarEvent[] => {
    return filteredBookings.filter((booking) => {
      const start = typeof booking.start === 'string' ? parseISO(booking.start) : booking.start;
      const end = typeof booking.end === 'string' ? parseISO(booking.end) : booking.end;
      return isWithinInterval(date, { start, end: addDays(end, -1) });
    });
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const selectedDayBookings = selectedDate ? getBookingsForDay(selectedDate) : [];

  return (
    <div className={cn('flex flex-col lg:flex-row gap-6', className)}>
      {/* Calendar */}
      <div className="flex-1 min-w-0">
        <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 backdrop-blur-sm overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-white/60" />
              </button>
              <h2 className="text-lg font-semibold text-white">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-white/60" />
              </button>
            </div>

            {/* Property filter */}
            {showPropertyFilter && properties.length > 0 && (
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-maroon-800/50"
              >
                <option value="all">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-white/10">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
              <div
                key={dayName}
                className="p-2 text-center text-xs font-medium text-white/40 uppercase tracking-wider"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {days.map((dayDate, idx) => {
              const dayBookings = getBookingsForDay(dayDate);
              const isCurrentMonth = isSameMonth(dayDate, currentMonth);
              const isSelected = selectedDate && isSameDay(dayDate, selectedDate);
              const isToday = isSameDay(dayDate, new Date());

              return (
                <div
                  key={idx}
                  onClick={() => handleDateClick(dayDate)}
                  className={cn(
                    'min-h-[80px] p-1.5 border-b border-r border-white/5 cursor-pointer transition-colors',
                    !isCurrentMonth && 'bg-white/[0.02]',
                    isSelected && 'bg-maroon-800/20',
                    'hover:bg-white/5'
                  )}
                >
                  <div
                    className={cn(
                      'text-xs font-medium mb-1',
                      !isCurrentMonth && 'text-white/30',
                      isCurrentMonth && 'text-white/70',
                      isToday && 'text-maroon-400 font-bold',
                      isSelected && 'text-white'
                    )}
                  >
                    {format(dayDate, 'd')}
                  </div>

                  {/* Booking indicators */}
                  <div className="space-y-0.5">
                    {dayBookings.slice(0, 3).map((booking) => (
                      <div
                        key={booking.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookingSelect?.(booking);
                        }}
                        className={cn(
                          'text-[10px] px-1 py-0.5 rounded truncate cursor-pointer',
                          'hover:brightness-110 transition-all',
                          getPlatformColor(booking.platform)
                        )}
                        title={`${booking.guestName} - ${booking.propertyName}`}
                      >
                        {booking.guestName.split(' ')[0]}
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className="text-[10px] text-white/40 px-1">
                        +{dayBookings.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Side panel for selected day */}
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-full lg:w-80 flex-shrink-0"
          >
            <div className="rounded-xl border border-white/10 bg-[#1a0a0a]/80 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon className="h-5 w-5 text-maroon-400" />
                <h3 className="font-semibold text-white">
                  {formatDate(selectedDate, 'EEEE, MMMM d')}
                </h3>
              </div>

              {selectedDayBookings.length === 0 ? (
                <p className="text-white/40 text-sm">No bookings on this day</p>
              ) : (
                <div className="space-y-3">
                  {selectedDayBookings.map((booking) => (
                    <div
                      key={booking.id}
                      onClick={() => onBookingSelect?.(booking)}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-colors',
                        'hover:bg-white/5',
                        getPlatformColor(booking.platform)
                      )}
                    >
                      <div className="font-medium text-white text-sm">
                        {booking.guestName}
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        {booking.propertyName}
                      </div>
                      <div className="text-xs text-white/40 mt-1">
                        {formatDate(booking.start, 'MMM d')} - {formatDate(booking.end, 'MMM d')}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            booking.status === 'CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          )}
                        >
                          {booking.status}
                        </span>
                        <span className="text-xs text-white/50">{booking.platform}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BookingCalendar;
