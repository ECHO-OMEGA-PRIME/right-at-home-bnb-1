/**
 * Property Detail Screen
 * Full property details with photos, stats, and management
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { format, addDays } from 'date-fns';
import { COLORS } from '../../theme/colors';
import { PhotoCarousel } from '../../components/owner/PhotoCarousel';
import { StatWidget } from '../../components/owner/StatWidget';
import { BookingCard } from '../../components/owner/BookingCard';

const { width } = Dimensions.get('window');

// Mock data
const MOCK_PROPERTY = {
  id: '1',
  name: 'Castleford Estate',
  address: '789 Mansion Dr',
  city: 'Midland',
  state: 'TX',
  zip: '79701',
  type: 'house',
  bedrooms: 4,
  bathrooms: 3,
  maxGuests: 8,
  description: 'Luxurious estate with stunning views of the West Texas landscape. Perfect for families or groups looking for a premium getaway experience. Features a private pool, outdoor kitchen, and spacious living areas.',
  amenities: ['Pool', 'WiFi', 'Kitchen', 'Parking', 'AC', 'Washer', 'Dryer', 'TV', 'Outdoor Grill', 'Fire Pit'],
  photos: [
    { id: '1', url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800', caption: 'Front View' },
    { id: '2', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', caption: 'Living Room' },
    { id: '3', url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800', caption: 'Kitchen' },
    { id: '4', url: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800', caption: 'Master Bedroom' },
    { id: '5', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', caption: 'Pool Area' },
  ],
  status: 'active',
  baseRate: 250,
  cleaningFee: 150,
  weekendRate: 300,
  stats: {
    occupancyRate: 85,
    rating: 4.9,
    reviewCount: 47,
    monthlyRevenue: 5200,
    totalBookings: 124,
    repeatGuests: 18,
  },
  smartLock: {
    brand: 'august',
    status: 'locked',
    batteryLevel: 78,
  },
  thermostat: {
    brand: 'nest',
    currentTemp: 72,
    targetTemp: 70,
    mode: 'cool',
  },
  currentBooking: {
    id: 'b1',
    guestName: 'John Smith',
    guestEmail: 'john@example.com',
    checkIn: new Date(),
    checkOut: addDays(new Date(), 3),
    guests: 4,
    status: 'checked_in' as const,
    source: 'airbnb' as const,
    total: 900,
  },
  upcomingBookings: [
    {
      id: 'b2',
      guestName: 'Emily Davis',
      checkIn: addDays(new Date(), 5),
      checkOut: addDays(new Date(), 8),
      guests: 2,
      status: 'confirmed' as const,
      source: 'direct' as const,
      total: 780,
    },
  ],
  nextCleaning: {
    date: addDays(new Date(), 3),
    time: '11:00 AM',
    cleaner: 'Maria G.',
    status: 'scheduled',
  },
};

export default function PropertyDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { propertyId } = route.params || {};
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'cleaning' | 'settings'>('overview');

  const property = MOCK_PROPERTY; // Would fetch by propertyId

  const handleLockToggle = useCallback(() => {
    Alert.alert(
      property.smartLock?.status === 'locked' ? 'Unlock Door?' : 'Lock Door?',
      'Are you sure you want to change the lock status?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => console.log('Toggle lock') },
      ]
    );
  }, [property.smartLock?.status]);

  const handleThermostatAdjust = useCallback(() => {
    navigation.navigate('ThermostatControl', { propertyId });
  }, [navigation, propertyId]);

  const renderTabs = () => (
    <View style={styles.tabs}>
      {[
        { key: 'overview', label: 'Overview', icon: '📊' },
        { key: 'bookings', label: 'Bookings', icon: '📅' },
        { key: 'cleaning', label: 'Cleaning', icon: '🧹' },
        { key: 'settings', label: 'Settings', icon: '⚙️' },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => setActiveTab(tab.key as any)}
        >
          <Text style={styles.tabIcon}>{tab.icon}</Text>
          <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOverview = () => (
    <>
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatWidget
          title="Occupancy"
          value={`${property.stats.occupancyRate}%`}
          icon="📊"
          variant="default"
          size="small"
          style={styles.statCard}
        />
        <StatWidget
          title="Rating"
          value={property.stats.rating.toFixed(1)}
          subtitle={`${property.stats.reviewCount} reviews`}
          icon="⭐"
          variant="success"
          size="small"
          style={styles.statCard}
        />
        <StatWidget
          title="Revenue"
          value={`$${(property.stats.monthlyRevenue / 1000).toFixed(1)}k`}
          subtitle="This month"
          icon="💰"
          variant="primary"
          size="small"
          style={styles.statCard}
        />
        <StatWidget
          title="Bookings"
          value={property.stats.totalBookings.toString()}
          subtitle={`${property.stats.repeatGuests} repeat`}
          icon="🏠"
          variant="default"
          size="small"
          style={styles.statCard}
        />
      </View>

      {/* Property Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Property Details</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>{property.type}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Bedrooms</Text>
            <Text style={styles.infoValue}>{property.bedrooms}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Bathrooms</Text>
            <Text style={styles.infoValue}>{property.bathrooms}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Max Guests</Text>
            <Text style={styles.infoValue}>{property.maxGuests}</Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{property.description}</Text>
      </View>

      {/* Amenities */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Amenities</Text>
        <View style={styles.amenitiesGrid}>
          {property.amenities.map((amenity, index) => (
            <View key={index} style={styles.amenityTag}>
              <Text style={styles.amenityText}>{amenity}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Smart Home Controls */}
      {(property.smartLock || property.thermostat) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Smart Home</Text>
          <View style={styles.smartControls}>
            {property.smartLock && (
              <TouchableOpacity style={styles.smartCard} onPress={handleLockToggle}>
                <View style={styles.smartHeader}>
                  <Text style={styles.smartIcon}>🔐</Text>
                  <Text style={styles.smartLabel}>Door Lock</Text>
                </View>
                <Text style={[
                  styles.smartStatus,
                  property.smartLock.status === 'locked' && styles.smartStatusGood,
                  property.smartLock.status === 'unlocked' && styles.smartStatusWarning,
                ]}>
                  {property.smartLock.status.toUpperCase()}
                </Text>
                <View style={styles.batteryRow}>
                  <Text style={styles.batteryIcon}>🔋</Text>
                  <Text style={styles.batteryText}>{property.smartLock.batteryLevel}%</Text>
                </View>
              </TouchableOpacity>
            )}

            {property.thermostat && (
              <TouchableOpacity style={styles.smartCard} onPress={handleThermostatAdjust}>
                <View style={styles.smartHeader}>
                  <Text style={styles.smartIcon}>🌡️</Text>
                  <Text style={styles.smartLabel}>Thermostat</Text>
                </View>
                <Text style={styles.tempValue}>{property.thermostat.currentTemp}°F</Text>
                <Text style={styles.tempTarget}>
                  Target: {property.thermostat.targetTemp}°F • {property.thermostat.mode}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Pricing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pricing</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Base Rate</Text>
            <Text style={styles.infoValue}>${property.baseRate}/night</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Weekend Rate</Text>
            <Text style={styles.infoValue}>${property.weekendRate}/night</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cleaning Fee</Text>
            <Text style={styles.infoValue}>${property.cleaningFee}</Text>
          </View>
        </View>
      </View>
    </>
  );

  const renderBookings = () => (
    <>
      {/* Current Booking */}
      {property.currentBooking && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Guest</Text>
          <BookingCard
            {...property.currentBooking}
            propertyName={property.name}
            onPress={() => navigation.navigate('BookingDetail', { bookingId: property.currentBooking.id })}
          />
        </View>
      )}

      {/* Upcoming Bookings */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Bookings', { propertyId })}>
            <Text style={styles.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>

        {property.upcomingBookings.length > 0 ? (
          property.upcomingBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              {...booking}
              propertyName={property.name}
              onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>No upcoming bookings</Text>
          </View>
        )}
      </View>

      {/* Calendar Preview */}
      <TouchableOpacity
        style={styles.calendarPreview}
        onPress={() => navigation.navigate('Calendar', { propertyId })}
      >
        <Text style={styles.calendarIcon}>📅</Text>
        <Text style={styles.calendarText}>View Full Calendar</Text>
        <Text style={styles.calendarArrow}>→</Text>
      </TouchableOpacity>
    </>
  );

  const renderCleaning = () => (
    <>
      {/* Next Cleaning */}
      {property.nextCleaning && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next Cleaning</Text>
          <View style={styles.cleaningCard}>
            <View style={styles.cleaningHeader}>
              <View>
                <Text style={styles.cleaningDate}>
                  {format(property.nextCleaning.date, 'EEEE, MMM d')}
                </Text>
                <Text style={styles.cleaningTime}>{property.nextCleaning.time}</Text>
              </View>
              <View style={[styles.cleaningStatus, styles.statusScheduled]}>
                <Text style={styles.cleaningStatusText}>
                  {property.nextCleaning.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.cleanerInfo}>
              <Text style={styles.cleanerLabel}>Assigned to:</Text>
              <Text style={styles.cleanerName}>{property.nextCleaning.cleaner}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Cleaning', { propertyId })}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>View History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ScheduleCleaning', { propertyId })}
          >
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionLabel}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('CleaningChecklist', { propertyId })}
          >
            <Text style={styles.actionIcon}>✅</Text>
            <Text style={styles.actionLabel}>Checklist</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const renderSettings = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Property Settings</Text>
        <View style={styles.settingsList}>
          {[
            { icon: '✏️', label: 'Edit Property', screen: 'EditProperty' },
            { icon: '📸', label: 'Manage Photos', screen: 'ManagePhotos' },
            { icon: '💵', label: 'Pricing Rules', screen: 'PricingRules' },
            { icon: '📅', label: 'Calendar Sync', screen: 'CalendarSync' },
            { icon: '🔗', label: 'Listing Links', screen: 'ListingLinks' },
            { icon: '🔔', label: 'Notifications', screen: 'PropertyNotifications' },
          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.settingItem}
              onPress={() => navigation.navigate(item.screen, { propertyId })}
            >
              <Text style={styles.settingIcon}>{item.icon}</Text>
              <Text style={styles.settingLabel}>{item.label}</Text>
              <Text style={styles.settingArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Danger Zone */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={() => Alert.alert('Deactivate Property?', 'This will hide the property from all listings.')}
        >
          <Text style={styles.dangerButtonText}>Deactivate Property</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Photo Carousel */}
      <PhotoCarousel photos={property.photos} height={280} showDots showCount />

      {/* Header Info */}
      <View style={styles.headerInfo}>
        <View style={styles.titleRow}>
          <Text style={styles.propertyName}>{property.name}</Text>
          <View style={[
            styles.statusBadge,
            property.status === 'active' && styles.statusActive,
            property.status === 'maintenance' && styles.statusMaintenance,
          ]}>
            <Text style={styles.statusText}>
              {property.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.address}>
          {property.address}, {property.city}, {property.state} {property.zip}
        </Text>
        <Text style={styles.propertyType}>
          {property.bedrooms} bed • {property.bathrooms} bath • Up to {property.maxGuests} guests
        </Text>
      </View>

      {/* Tabs */}
      {renderTabs()}

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'bookings' && renderBookings()}
        {activeTab === 'cleaning' && renderCleaning()}
        {activeTab === 'settings' && renderSettings()}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerInfo: {
    padding: 16,
    backgroundColor: COLORS.white,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  propertyName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.charcoal,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.gray,
  },
  statusActive: {
    backgroundColor: COLORS.success,
  },
  statusMaintenance: {
    backgroundColor: COLORS.warning,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
  },
  address: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 4,
  },
  propertyType: {
    fontSize: 14,
    color: COLORS.charcoal,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.maroon,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
  },
  tabLabelActive: {
    color: COLORS.maroon,
    fontWeight: '600',
  },
  tabContent: {
    padding: 16,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: (width - 44) / 2,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.maroon,
    fontWeight: '500',
  },

  // Info Card
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  infoDivider: {
    height: 1,
    backgroundColor: COLORS.grayLighter,
  },

  // Description
  description: {
    fontSize: 14,
    color: COLORS.charcoal,
    lineHeight: 22,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
  },

  // Amenities
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityTag: {
    backgroundColor: COLORS.maroon + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  amenityText: {
    fontSize: 13,
    color: COLORS.maroon,
    fontWeight: '500',
  },

  // Smart Controls
  smartControls: {
    flexDirection: 'row',
    gap: 12,
  },
  smartCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
  },
  smartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  smartIcon: {
    fontSize: 20,
  },
  smartLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  smartStatus: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.charcoal,
    marginBottom: 8,
  },
  smartStatusGood: {
    color: COLORS.success,
  },
  smartStatusWarning: {
    color: COLORS.warning,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryIcon: {
    fontSize: 14,
  },
  batteryText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  tempValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  tempTarget: {
    fontSize: 12,
    color: COLORS.gray,
  },

  // Cleaning
  cleaningCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
  },
  cleaningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cleaningDate: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  cleaningTime: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2,
  },
  cleaningStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusScheduled: {
    backgroundColor: COLORS.info + '20',
  },
  cleaningStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.info,
  },
  cleanerInfo: {
    flexDirection: 'row',
    gap: 8,
  },
  cleanerLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  cleanerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.charcoal,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
  },

  // Calendar Preview
  calendarPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.maroon + '10',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  calendarIcon: {
    fontSize: 24,
  },
  calendarText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.maroon,
  },
  calendarArrow: {
    fontSize: 18,
    color: COLORS.maroon,
  },

  // Settings
  settingsList: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.charcoal,
  },
  settingArrow: {
    fontSize: 16,
    color: COLORS.grayLight,
  },

  // Danger Zone
  dangerSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.error + '30',
    paddingTop: 24,
  },
  dangerTitle: {
    color: COLORS.error,
  },
  dangerButton: {
    backgroundColor: COLORS.error + '15',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: COLORS.white,
    borderRadius: 16,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray,
  },
});
