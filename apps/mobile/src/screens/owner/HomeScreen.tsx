/**
 * Owner Home Screen - Dashboard Overview
 * Shows key metrics, upcoming bookings, and cleaning tasks
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { format, isToday, isTomorrow, startOfDay, endOfDay, addDays } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';
import { StatWidget, HeroStat, StatGrid } from '../../components/owner/StatWidget';
import { BookingCard } from '../../components/owner/BookingCard';
import { PropertyCard } from '../../components/owner/PropertyCard';

const { width } = Dimensions.get('window');

// Mock data - would come from database/API
const MOCK_STATS = {
  totalRevenue: 24850,
  revenueGrowth: 12.5,
  occupancyRate: 78,
  activeBookings: 4,
  upcomingCheckIns: 2,
  pendingCleanings: 3,
  averageRating: 4.8,
  totalProperties: 6,
};

const MOCK_UPCOMING_BOOKINGS = [
  {
    id: '1',
    propertyName: 'Castleford Estate',
    guestName: 'John Smith',
    checkIn: new Date(),
    checkOut: addDays(new Date(), 3),
    guests: 4,
    status: 'confirmed' as const,
    source: 'airbnb' as const,
    total: 850,
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
];

const MOCK_PROPERTIES_NEEDING_ATTENTION = [
  {
    id: '1',
    name: 'Permian Palace',
    address: '123 Oil Baron Ln',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400',
    status: 'maintenance' as const,
    stats: { occupancyRate: 65, rating: 4.6, monthlyRevenue: 3200 },
  },
  {
    id: '2',
    name: 'Downtown Loft',
    address: '456 Main St #201',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400',
    status: 'inactive' as const,
    stats: { occupancyRate: 0, rating: 4.9, monthlyRevenue: 0 },
  },
];

const MOCK_CLEANING_TASKS = [
  { id: '1', property: 'Castleford Estate', time: '2:00 PM', cleaner: 'Maria G.', status: 'in_progress' },
  { id: '2', property: 'Basin View Cottage', time: '5:00 PM', cleaner: 'Jose R.', status: 'scheduled' },
  { id: '3', property: 'Permian Palace', time: 'Tomorrow 10:00 AM', cleaner: 'Unassigned', status: 'urgent' },
];

export default function OwnerHomeScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Would trigger sync here
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const navigateToBookings = () => navigation.navigate('Bookings');
  const navigateToProperties = () => navigation.navigate('Properties');
  const navigateToCleaning = () => navigation.navigate('Cleaning');
  const navigateToNotifications = () => navigation.navigate('Notifications');

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.maroon}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>Steven</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={navigateToNotifications}
          >
            <Text style={styles.notificationIcon}>🔔</Text>
            <View style={styles.notificationBadge}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>
        <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>
      </View>

      {/* Hero Revenue Stat */}
      <HeroStat
        title="This Month's Revenue"
        value={`$${MOCK_STATS.totalRevenue.toLocaleString()}`}
        icon="💰"
        trend={{
          value: MOCK_STATS.revenueGrowth,
          direction: 'up',
          label: 'vs last month',
        }}
        onPress={() => navigation.navigate('Settings')}
      />

      {/* Quick Stats Grid */}
      <View style={styles.statsRow}>
        <StatWidget
          title="Occupancy"
          value={`${MOCK_STATS.occupancyRate}%`}
          icon="📊"
          variant="default"
          size="small"
          style={styles.statItem}
          onPress={navigateToProperties}
        />
        <StatWidget
          title="Active"
          value={MOCK_STATS.activeBookings.toString()}
          icon="🏠"
          variant="default"
          size="small"
          style={styles.statItem}
          onPress={navigateToBookings}
        />
        <StatWidget
          title="Cleanings"
          value={MOCK_STATS.pendingCleanings.toString()}
          icon="🧹"
          variant={MOCK_STATS.pendingCleanings > 2 ? 'warning' : 'default'}
          size="small"
          style={styles.statItem}
          onPress={navigateToCleaning}
        />
        <StatWidget
          title="Rating"
          value={MOCK_STATS.averageRating.toFixed(1)}
          icon="⭐"
          variant="success"
          size="small"
          style={styles.statItem}
        />
      </View>

      {/* Today's Activity Alert */}
      {MOCK_STATS.upcomingCheckIns > 0 && (
        <TouchableOpacity style={styles.activityAlert} onPress={navigateToBookings}>
          <View style={styles.alertIcon}>
            <Text style={styles.alertIconText}>📍</Text>
          </View>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>
              {MOCK_STATS.upcomingCheckIns} Check-in{MOCK_STATS.upcomingCheckIns > 1 ? 's' : ''} Today
            </Text>
            <Text style={styles.alertSubtitle}>Tap to view guest details</Text>
          </View>
          <Text style={styles.alertArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Upcoming Bookings */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
          <TouchableOpacity onPress={navigateToBookings}>
            <Text style={styles.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>

        {MOCK_UPCOMING_BOOKINGS.map((booking) => (
          <BookingCard
            key={booking.id}
            id={booking.id}
            propertyName={booking.propertyName}
            guestName={booking.guestName}
            checkIn={booking.checkIn}
            checkOut={booking.checkOut}
            guests={booking.guests}
            status={booking.status}
            source={booking.source}
            total={booking.total}
            onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
          />
        ))}
      </View>

      {/* Cleaning Tasks */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Cleaning Tasks</Text>
          <TouchableOpacity onPress={navigateToCleaning}>
            <Text style={styles.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>

        {MOCK_CLEANING_TASKS.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={[
              styles.cleaningCard,
              task.status === 'urgent' && styles.cleaningCardUrgent,
            ]}
            onPress={navigateToCleaning}
          >
            <View style={styles.cleaningHeader}>
              <View
                style={[
                  styles.cleaningStatus,
                  task.status === 'in_progress' && styles.statusInProgress,
                  task.status === 'urgent' && styles.statusUrgent,
                ]}
              />
              <Text style={styles.cleaningProperty}>{task.property}</Text>
              {task.status === 'urgent' && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentText}>URGENT</Text>
                </View>
              )}
            </View>
            <View style={styles.cleaningMeta}>
              <Text style={styles.cleaningTime}>🕐 {task.time}</Text>
              <Text style={styles.cleaningCleaner}>👤 {task.cleaner}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Properties Needing Attention */}
      {MOCK_PROPERTIES_NEEDING_ATTENTION.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Needs Attention</Text>
            <TouchableOpacity onPress={navigateToProperties}>
              <Text style={styles.seeAll}>View All →</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.propertiesScroll}
          >
            {MOCK_PROPERTIES_NEEDING_ATTENTION.map((property) => (
              <View key={property.id} style={styles.propertyCardWrapper}>
                <PropertyCard
                  {...property}
                  onPress={() => navigation.navigate('PropertyDetail', { propertyId: property.id })}
                  variant="grid"
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Calendar')}
          >
            <Text style={styles.quickActionIcon}>📅</Text>
            <Text style={styles.quickActionLabel}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Messages')}
          >
            <Text style={styles.quickActionIcon}>💬</Text>
            <Text style={styles.quickActionLabel}>Messages</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Properties')}
          >
            <Text style={styles.quickActionIcon}>🏡</Text>
            <Text style={styles.quickActionLabel}>Properties</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.quickActionIcon}>⚙️</Text>
            <Text style={styles.quickActionLabel}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Padding */}
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
    padding: 20,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 16,
    color: COLORS.gray,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.maroon,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 4,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationIcon: {
    fontSize: 22,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
  },

  // Activity Alert
  activityAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.maroon,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertIconText: {
    fontSize: 20,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  alertSubtitle: {
    color: COLORS.white + '80',
    fontSize: 13,
    marginTop: 2,
  },
  alertArrow: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  seeAll: {
    color: COLORS.maroon,
    fontSize: 14,
    fontWeight: '500',
  },

  // Cleaning Cards
  cleaningCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cleaningCardUrgent: {
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  cleaningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cleaningStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
    marginRight: 10,
  },
  statusInProgress: {
    backgroundColor: COLORS.warning,
  },
  statusUrgent: {
    backgroundColor: COLORS.error,
  },
  cleaningProperty: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  urgentBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgentText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  cleaningMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  cleaningTime: {
    fontSize: 13,
    color: COLORS.gray,
  },
  cleaningCleaner: {
    fontSize: 13,
    color: COLORS.gray,
  },

  // Properties Scroll
  propertiesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  propertyCardWrapper: {
    width: (width - 48) / 2,
    marginRight: 12,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
});
