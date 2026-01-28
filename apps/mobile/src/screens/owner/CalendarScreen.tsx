/**
 * Calendar Screen
 * Calendar view showing all bookings across properties
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
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
import { COLORS } from '../../theme/colors';

const { width } = Dimensions.get('window');
const DAY_SIZE = (width - 32) / 7;

// Mock booking data
const MOCK_BOOKINGS = [
  {
    id: '1',
    propertyId: 'p1',
    propertyName: 'Castleford Estate',
    propertyColor: COLORS.maroon,
    guestName: 'John Smith',
    startDate: new Date(),
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    status: 'checked_in',
  },
  {
    id: '2',
    propertyId: 'p2',
    propertyName: 'Basin View',
    propertyColor: COLORS.info,
    guestName: 'Sarah Johnson',
    startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: 'confirmed',
  },
  {
    id: '3',
    propertyId: 'p1',
    propertyName: 'Castleford Estate',
    propertyColor: COLORS.maroon,
    guestName: 'Emily Davis',
    startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    status: 'confirmed',
  },
  {
    id: '4',
    propertyId: 'p3',
    propertyName: 'Downtown Loft',
    propertyColor: COLORS.success,
    guestName: 'Mike Chen',
    startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: 'confirmed',
  },
];

const PROPERTIES = [
  { id: 'all', name: 'All Properties', color: COLORS.charcoal },
  { id: 'p1', name: 'Castleford Estate', color: COLORS.maroon },
  { id: 'p2', name: 'Basin View', color: COLORS.info },
  { id: 'p3', name: 'Downtown Loft', color: COLORS.success },
  { id: 'p4', name: 'Permian Palace', color: COLORS.warning },
];

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { propertyId: initialPropertyId } = route.params || {};

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedProperty, setSelectedProperty] = useState(initialPropertyId || 'all');

  const filteredBookings = useMemo(() => {
    if (selectedProperty === 'all') return MOCK_BOOKINGS;
    return MOCK_BOOKINGS.filter((b) => b.propertyId === selectedProperty);
  }, [selectedProperty]);

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  }, []);

  const getBookingsForDate = useCallback(
    (date: Date) => {
      return filteredBookings.filter((booking) =>
        isWithinInterval(date, {
          start: booking.startDate,
          end: booking.endDate,
        })
      );
    },
    [filteredBookings]
  );

  const selectedDateBookings = useMemo(() => {
    if (!selectedDate) return [];
    return getBookingsForDate(selectedDate);
  }, [selectedDate, getBookingsForDate]);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
          <Text style={styles.navIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Text style={styles.navIcon}>›</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
        <Text style={styles.todayText}>Today</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPropertyFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.propertyFilter}
    >
      {PROPERTIES.map((property) => (
        <TouchableOpacity
          key={property.id}
          style={[
            styles.propertyChip,
            selectedProperty === property.id && styles.propertyChipActive,
            selectedProperty === property.id && { borderColor: property.color },
          ]}
          onPress={() => setSelectedProperty(property.id)}
        >
          <View style={[styles.propertyDot, { backgroundColor: property.color }]} />
          <Text
            style={[
              styles.propertyChipText,
              selectedProperty === property.id && styles.propertyChipTextActive,
            ]}
          >
            {property.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderWeekDays = () => (
    <View style={styles.weekDays}>
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
        <View key={day} style={styles.weekDay}>
          <Text style={styles.weekDayText}>{day}</Text>
        </View>
      ))}
    </View>
  );

  const renderCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const days = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }

    return (
      <View style={styles.daysGrid}>
        {days.map((date, index) => {
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isToday = isSameDay(date, new Date());
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const dayBookings = getBookingsForDate(date);
          const hasBookings = dayBookings.length > 0;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayCell,
                isSelected && styles.dayCellSelected,
                isToday && styles.dayCellToday,
              ]}
              onPress={() => setSelectedDate(date)}
            >
              <Text
                style={[
                  styles.dayText,
                  !isCurrentMonth && styles.dayTextMuted,
                  isToday && styles.dayTextToday,
                  isSelected && styles.dayTextSelected,
                ]}
              >
                {format(date, 'd')}
              </Text>

              {hasBookings && (
                <View style={styles.bookingDots}>
                  {dayBookings.slice(0, 3).map((booking, i) => (
                    <View
                      key={booking.id}
                      style={[styles.bookingDot, { backgroundColor: booking.propertyColor }]}
                    />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderSelectedDateBookings = () => {
    if (!selectedDate) {
      return (
        <View style={styles.noSelection}>
          <Text style={styles.noSelectionText}>Select a date to view bookings</Text>
        </View>
      );
    }

    return (
      <View style={styles.selectedDateSection}>
        <Text style={styles.selectedDateTitle}>
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </Text>

        {selectedDateBookings.length === 0 ? (
          <View style={styles.noBookings}>
            <Text style={styles.noBookingsIcon}>📅</Text>
            <Text style={styles.noBookingsText}>No bookings on this date</Text>
            <TouchableOpacity
              style={styles.addBookingButton}
              onPress={() => navigation.navigate('AddBooking', { date: selectedDate })}
            >
              <Text style={styles.addBookingText}>+ Add Booking</Text>
            </TouchableOpacity>
          </View>
        ) : (
          selectedDateBookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              style={styles.bookingCard}
              onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
            >
              <View style={[styles.bookingBar, { backgroundColor: booking.propertyColor }]} />
              <View style={styles.bookingContent}>
                <Text style={styles.bookingProperty}>{booking.propertyName}</Text>
                <Text style={styles.bookingGuest}>{booking.guestName}</Text>
                <Text style={styles.bookingDates}>
                  {format(booking.startDate, 'MMM d')} - {format(booking.endDate, 'MMM d')}
                </Text>
              </View>
              <View
                style={[
                  styles.bookingStatus,
                  booking.status === 'checked_in' && styles.statusCheckedIn,
                ]}
              >
                <Text style={styles.bookingStatusText}>
                  {booking.status === 'checked_in' ? 'In Stay' : 'Confirmed'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  const renderLegend = () => (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: COLORS.maroon }]} />
        <Text style={styles.legendText}>Castleford</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: COLORS.info }]} />
        <Text style={styles.legendText}>Basin View</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
        <Text style={styles.legendText}>Downtown</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {renderHeader()}
      {renderPropertyFilter()}

      <View style={styles.calendarContainer}>
        {renderWeekDays()}
        {renderCalendarDays()}
      </View>

      {renderLegend()}
      {renderSelectedDateBookings()}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  navIcon: {
    fontSize: 24,
    color: COLORS.charcoal,
    lineHeight: 26,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.charcoal,
    minWidth: 160,
    textAlign: 'center',
  },
  todayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.maroon,
    borderRadius: 20,
  },
  todayText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },

  // Property Filter
  propertyFilter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  propertyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
    marginRight: 8,
    gap: 6,
  },
  propertyChipActive: {
    backgroundColor: COLORS.maroon + '10',
    borderWidth: 2,
  },
  propertyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  propertyChipText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: '500',
  },
  propertyChipTextActive: {
    color: COLORS.charcoal,
    fontWeight: '600',
  },

  // Calendar
  calendarContainer: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    width: DAY_SIZE - 2,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: DAY_SIZE - 2,
    height: DAY_SIZE - 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: (DAY_SIZE - 2) / 2,
  },
  dayCellSelected: {
    backgroundColor: COLORS.maroon,
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: COLORS.maroon,
  },
  dayText: {
    fontSize: 15,
    color: COLORS.charcoal,
    fontWeight: '500',
  },
  dayTextMuted: {
    color: COLORS.grayLight,
  },
  dayTextToday: {
    color: COLORS.maroon,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: COLORS.white,
    fontWeight: '700',
  },
  bookingDots: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    gap: 2,
  },
  bookingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.gray,
  },

  // Selected Date Section
  selectedDateSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 16,
  },
  noSelection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSelectionText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  noBookings: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: COLORS.white,
    borderRadius: 16,
  },
  noBookingsIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  noBookingsText: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 16,
  },
  addBookingButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.maroon + '15',
    borderRadius: 20,
  },
  addBookingText: {
    color: COLORS.maroon,
    fontSize: 14,
    fontWeight: '600',
  },

  // Booking Card
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  bookingContent: {
    flex: 1,
    padding: 14,
  },
  bookingProperty: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  bookingGuest: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  bookingDates: {
    fontSize: 12,
    color: COLORS.grayLight,
    marginTop: 4,
  },
  bookingStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.info + '15',
    marginRight: 12,
    borderRadius: 12,
  },
  statusCheckedIn: {
    backgroundColor: COLORS.success + '15',
  },
  bookingStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.info,
  },
});
