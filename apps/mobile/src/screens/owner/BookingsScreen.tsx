/**
 * Bookings Screen
 * List of all bookings with filtering by status and date
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format, addDays, subDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { COLORS } from '../../theme/colors';
import { BookingCard } from '../../components/owner/BookingCard';

type BookingStatus = 'all' | 'upcoming' | 'current' | 'past';
type DateRange = 'week' | 'month' | 'quarter' | 'all';

// Mock data
const generateMockBookings = () => [
  {
    id: '1',
    propertyName: 'Castleford Estate',
    propertyImage: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=200',
    guestName: 'John Smith',
    checkIn: new Date(),
    checkOut: addDays(new Date(), 3),
    guests: 4,
    status: 'checked_in' as const,
    source: 'airbnb' as const,
    total: 900,
  },
  {
    id: '2',
    propertyName: 'Basin View Cottage',
    guestName: 'Sarah Johnson',
    checkIn: addDays(new Date(), 1),
    checkOut: addDays(new Date(), 5),
    guests: 2,
    status: 'confirmed' as const,
    source: 'direct' as const,
    total: 620,
  },
  {
    id: '3',
    propertyName: 'Downtown Loft',
    guestName: 'Mike Chen',
    checkIn: addDays(new Date(), 7),
    checkOut: addDays(new Date(), 10),
    guests: 3,
    status: 'confirmed' as const,
    source: 'vrbo' as const,
    total: 780,
  },
  {
    id: '4',
    propertyName: 'Executive Suite',
    guestName: 'Emily Davis',
    checkIn: addDays(new Date(), 14),
    checkOut: addDays(new Date(), 18),
    guests: 2,
    status: 'pending' as const,
    source: 'booking.com' as const,
    total: 1200,
  },
  {
    id: '5',
    propertyName: 'Castleford Estate',
    guestName: 'David Wilson',
    checkIn: subDays(new Date(), 7),
    checkOut: subDays(new Date(), 4),
    guests: 6,
    status: 'checked_out' as const,
    source: 'airbnb' as const,
    total: 1050,
  },
  {
    id: '6',
    propertyName: 'Basin View Cottage',
    guestName: 'Lisa Anderson',
    checkIn: subDays(new Date(), 14),
    checkOut: subDays(new Date(), 10),
    guests: 2,
    status: 'checked_out' as const,
    source: 'direct' as const,
    total: 560,
  },
  {
    id: '7',
    propertyName: 'Permian Palace',
    guestName: 'Robert Taylor',
    checkIn: subDays(new Date(), 21),
    checkOut: subDays(new Date(), 17),
    guests: 4,
    status: 'cancelled' as const,
    source: 'vrbo' as const,
    total: 880,
  },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'upcoming', label: 'Upcoming', icon: '📅' },
  { key: 'current', label: 'Current', icon: '🏠' },
  { key: 'past', label: 'Past', icon: '✓' },
];

const DATE_FILTERS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: '3 Months' },
  { key: 'all', label: 'All Time' },
];

export default function BookingsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { propertyId } = route.params || {};

  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BookingStatus>('all');
  const [dateRange, setDateRange] = useState<DateRange>('month');

  const allBookings = generateMockBookings();

  const filteredBookings = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);

    return allBookings.filter((booking) => {
      // Property filter
      if (propertyId && !booking.propertyName.toLowerCase().includes('castle')) {
        return false;
      }

      const checkInDate = startOfDay(new Date(booking.checkIn));
      const checkOutDate = endOfDay(new Date(booking.checkOut));

      // Status filter
      if (statusFilter === 'upcoming') {
        return isAfter(checkInDate, today);
      }
      if (statusFilter === 'current') {
        return booking.status === 'checked_in';
      }
      if (statusFilter === 'past') {
        return isBefore(checkOutDate, today) || booking.status === 'checked_out' || booking.status === 'cancelled';
      }

      // Date range filter (for 'all' status)
      if (dateRange !== 'all') {
        const daysMap = { week: 7, month: 30, quarter: 90 };
        const rangeStart = subDays(now, daysMap[dateRange]);
        const rangeEnd = addDays(now, daysMap[dateRange]);
        return (
          (isAfter(checkInDate, rangeStart) || isAfter(checkOutDate, rangeStart)) &&
          isBefore(checkInDate, rangeEnd)
        );
      }

      return true;
    });
  }, [allBookings, statusFilter, dateRange, propertyId]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);

    return {
      upcoming: allBookings.filter((b) => isAfter(startOfDay(new Date(b.checkIn)), today)).length,
      current: allBookings.filter((b) => b.status === 'checked_in').length,
      past: allBookings.filter((b) => b.status === 'checked_out' || b.status === 'cancelled').length,
      total: allBookings.length,
    };
  }, [allBookings]);

  const totalRevenue = useMemo(() => {
    return filteredBookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + b.total, 0);
  }, [filteredBookings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{filteredBookings.length}</Text>
            <Text style={styles.summaryLabel}>Bookings</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, styles.revenueValue]}>
              ${totalRevenue.toLocaleString()}
            </Text>
            <Text style={styles.summaryLabel}>Revenue</Text>
          </View>
        </View>
      </View>

      {/* Status Filters */}
      <View style={styles.filters}>
        {STATUS_FILTERS.map((filter) => {
          const count =
            filter.key === 'all'
              ? stats.total
              : stats[filter.key as keyof typeof stats];

          return (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                statusFilter === filter.key && styles.filterButtonActive,
              ]}
              onPress={() => setStatusFilter(filter.key as BookingStatus)}
            >
              <Text style={styles.filterIcon}>{filter.icon}</Text>
              <Text
                style={[
                  styles.filterLabel,
                  statusFilter === filter.key && styles.filterLabelActive,
                ]}
              >
                {filter.label}
              </Text>
              <View
                style={[
                  styles.filterBadge,
                  statusFilter === filter.key && styles.filterBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    statusFilter === filter.key && styles.filterBadgeTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Date Range */}
      {statusFilter === 'all' && (
        <View style={styles.dateFilters}>
          {DATE_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.dateButton,
                dateRange === filter.key && styles.dateButtonActive,
              ]}
              onPress={() => setDateRange(filter.key as DateRange)}
            >
              <Text
                style={[
                  styles.dateLabel,
                  dateRange === filter.key && styles.dateLabelActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderBooking = ({ item }: { item: typeof allBookings[0] }) => (
    <BookingCard
      {...item}
      onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📅</Text>
      <Text style={styles.emptyTitle}>No Bookings Found</Text>
      <Text style={styles.emptySubtitle}>
        {statusFilter === 'upcoming'
          ? 'No upcoming bookings scheduled'
          : statusFilter === 'current'
          ? 'No guests currently checked in'
          : 'No bookings match your filters'}
      </Text>
    </View>
  );

  const renderSectionHeader = (title: string, date?: Date) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {date && <Text style={styles.sectionDate}>{format(date, 'MMM d')}</Text>}
    </View>
  );

  // Group bookings by date for better UX
  const groupedData = useMemo(() => {
    const groups: { title: string; data: typeof allBookings }[] = [];
    const today = startOfDay(new Date());

    if (statusFilter === 'current') {
      groups.push({ title: 'Currently Staying', data: filteredBookings });
    } else if (statusFilter === 'upcoming') {
      const thisWeek = filteredBookings.filter(
        (b) => isBefore(new Date(b.checkIn), addDays(today, 7))
      );
      const later = filteredBookings.filter(
        (b) => !isBefore(new Date(b.checkIn), addDays(today, 7))
      );

      if (thisWeek.length) groups.push({ title: 'This Week', data: thisWeek });
      if (later.length) groups.push({ title: 'Later', data: later });
    } else {
      groups.push({ title: 'All Bookings', data: filteredBookings });
    }

    return groups;
  }, [filteredBookings, statusFilter]);

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredBookings}
        renderItem={renderBooking}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.maroon}
          />
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 16,
    marginBottom: 8,
  },
  summaryCard: {
    backgroundColor: COLORS.maroon,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.white + '30',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.white,
  },
  revenueValue: {
    color: COLORS.gold,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.white + '80',
    marginTop: 4,
  },

  // Filters
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
    gap: 4,
  },
  filterButtonActive: {
    backgroundColor: COLORS.maroon,
    borderColor: COLORS.maroon,
  },
  filterIcon: {
    fontSize: 18,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  filterLabelActive: {
    color: COLORS.white,
  },
  filterBadge: {
    backgroundColor: COLORS.grayLighter,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  filterBadgeActive: {
    backgroundColor: COLORS.white + '30',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  filterBadgeTextActive: {
    color: COLORS.white,
  },

  // Date Filters
  dateFilters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  dateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
  },
  dateButtonActive: {
    backgroundColor: COLORS.maroon + '15',
    borderColor: COLORS.maroon,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
  },
  dateLabelActive: {
    color: COLORS.maroon,
  },

  // List
  list: {
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  sectionDate: {
    fontSize: 14,
    color: COLORS.gray,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
  },
});
