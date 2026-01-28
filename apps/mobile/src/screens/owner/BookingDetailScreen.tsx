/**
 * Booking Detail Screen
 * Full booking details with guest info and actions
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { format, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { COLORS } from '../../theme/colors';

// Mock data
const MOCK_BOOKING = {
  id: '1',
  property: {
    id: 'p1',
    name: 'Castleford Estate',
    address: '789 Mansion Dr, Midland, TX 79701',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400',
  },
  guest: {
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '+1 (555) 123-4567',
    photo: null,
    previousStays: 2,
    vipStatus: false,
  },
  checkIn: new Date(),
  checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  guests: 4,
  status: 'checked_in' as const,
  source: 'airbnb' as const,
  externalId: 'HM9K2JS8',
  pricing: {
    nightlyRate: 250,
    nights: 3,
    subtotal: 750,
    cleaningFee: 150,
    serviceFee: 75,
    taxes: 82.50,
    total: 1057.50,
  },
  specialRequests: [
    'Early check-in if possible (around 2 PM)',
    'Need a crib for infant',
  ],
  notes: 'Guest mentioned they are celebrating an anniversary.',
  accessCode: '7842',
  messages: [
    { id: 'm1', from: 'guest', content: 'Hi! We are excited for our stay!', time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    { id: 'm2', from: 'host', content: 'Welcome! Let me know if you need anything.', time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3600000) },
    { id: 'm3', from: 'guest', content: 'Is early check-in possible?', time: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  ],
  timeline: [
    { action: 'Booking Confirmed', time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), icon: '✓' },
    { action: 'Pre-arrival message sent', time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), icon: '📩' },
    { action: 'Check-in instructions sent', time: new Date(Date.now() - 24 * 60 * 60 * 1000), icon: '🔑' },
    { action: 'Guest checked in', time: new Date(), icon: '🏠' },
  ],
};

const statusConfig = {
  pending: { color: COLORS.warning, label: 'Pending', icon: '⏳' },
  confirmed: { color: COLORS.info, label: 'Confirmed', icon: '✓' },
  checked_in: { color: COLORS.success, label: 'Checked In', icon: '🏠' },
  checked_out: { color: COLORS.gray, label: 'Checked Out', icon: '✓' },
  cancelled: { color: COLORS.error, label: 'Cancelled', icon: '✕' },
};

const sourceConfig = {
  direct: { label: 'Direct Booking', color: COLORS.maroon },
  airbnb: { label: 'Airbnb', color: '#FF5A5F' },
  vrbo: { label: 'VRBO', color: '#3B5998' },
  'booking.com': { label: 'Booking.com', color: '#003580' },
};

export default function BookingDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { bookingId } = route.params || {};
  const [showFullPricing, setShowFullPricing] = useState(false);

  const booking = MOCK_BOOKING;
  const statusInfo = statusConfig[booking.status];
  const sourceInfo = sourceConfig[booking.source];
  const nights = differenceInDays(booking.checkOut, booking.checkIn);

  const handleCall = useCallback(() => {
    Linking.openURL(`tel:${booking.guest.phone}`);
  }, [booking.guest.phone]);

  const handleEmail = useCallback(() => {
    Linking.openURL(`mailto:${booking.guest.email}`);
  }, [booking.guest.email]);

  const handleMessage = useCallback(() => {
    navigation.navigate('Messages', { bookingId: booking.id });
  }, [navigation, booking.id]);

  const handleCheckIn = useCallback(() => {
    Alert.alert(
      'Check In Guest',
      'Are you sure you want to check in this guest?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check In', onPress: () => console.log('Check in') },
      ]
    );
  }, []);

  const handleCheckOut = useCallback(() => {
    Alert.alert(
      'Check Out Guest',
      'Are you sure you want to check out this guest?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check Out', onPress: () => console.log('Check out') },
      ]
    );
  }, []);

  const handleCancelBooking = useCallback(() => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking? This action cannot be undone.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        { text: 'Cancel Booking', style: 'destructive', onPress: () => console.log('Cancel') },
      ]
    );
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Property Card */}
      <TouchableOpacity
        style={styles.propertyCard}
        onPress={() => navigation.navigate('PropertyDetail', { propertyId: booking.property.id })}
      >
        <Image
          source={{ uri: booking.property.image }}
          style={styles.propertyImage}
        />
        <View style={styles.propertyInfo}>
          <Text style={styles.propertyName}>{booking.property.name}</Text>
          <Text style={styles.propertyAddress}>{booking.property.address}</Text>
        </View>
        <Text style={styles.propertyArrow}>→</Text>
      </TouchableOpacity>

      {/* Status & Source */}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
          <Text style={styles.statusText}>{statusInfo.icon} {statusInfo.label}</Text>
        </View>
        <View style={[styles.sourceBadge, { backgroundColor: sourceInfo.color + '20' }]}>
          <Text style={[styles.sourceText, { color: sourceInfo.color }]}>
            {sourceInfo.label}
          </Text>
        </View>
        {booking.externalId && (
          <Text style={styles.externalId}>#{booking.externalId}</Text>
        )}
      </View>

      {/* Guest Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Guest Information</Text>
        <View style={styles.guestCard}>
          <View style={styles.guestHeader}>
            {booking.guest.photo ? (
              <Image source={{ uri: booking.guest.photo }} style={styles.guestPhoto} />
            ) : (
              <View style={styles.guestInitials}>
                <Text style={styles.initialsText}>
                  {booking.guest.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
            )}
            <View style={styles.guestDetails}>
              <Text style={styles.guestName}>{booking.guest.name}</Text>
              <Text style={styles.guestMeta}>
                {booking.guests} guest{booking.guests > 1 ? 's' : ''}
                {booking.guest.previousStays > 0 && ` • ${booking.guest.previousStays} previous stays`}
              </Text>
              {booking.guest.vipStatus && (
                <View style={styles.vipBadge}>
                  <Text style={styles.vipText}>VIP GUEST</Text>
                </View>
              )}
            </View>
          </View>

          {/* Contact Buttons */}
          <View style={styles.contactButtons}>
            <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
              <Text style={styles.contactIcon}>📞</Text>
              <Text style={styles.contactLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton} onPress={handleEmail}>
              <Text style={styles.contactIcon}>✉️</Text>
              <Text style={styles.contactLabel}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton} onPress={handleMessage}>
              <Text style={styles.contactIcon}>💬</Text>
              <Text style={styles.contactLabel}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Dates */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stay Details</Text>
        <View style={styles.datesCard}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>CHECK-IN</Text>
            <Text style={styles.dateValue}>{format(booking.checkIn, 'EEE, MMM d')}</Text>
            <Text style={styles.dateTime}>3:00 PM</Text>
          </View>

          <View style={styles.nightsBlock}>
            <View style={styles.nightsCircle}>
              <Text style={styles.nightsValue}>{nights}</Text>
              <Text style={styles.nightsLabel}>nights</Text>
            </View>
          </View>

          <View style={[styles.dateBlock, styles.dateBlockRight]}>
            <Text style={styles.dateLabel}>CHECK-OUT</Text>
            <Text style={styles.dateValue}>{format(booking.checkOut, 'EEE, MMM d')}</Text>
            <Text style={styles.dateTime}>11:00 AM</Text>
          </View>
        </View>
      </View>

      {/* Access Code */}
      {booking.accessCode && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Access Code</Text>
          <View style={styles.accessCard}>
            <Text style={styles.accessIcon}>🔐</Text>
            <Text style={styles.accessCode}>{booking.accessCode}</Text>
            <TouchableOpacity style={styles.copyButton}>
              <Text style={styles.copyText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Special Requests */}
      {booking.specialRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Requests</Text>
          <View style={styles.requestsCard}>
            {booking.specialRequests.map((request, index) => (
              <View key={index} style={styles.requestItem}>
                <Text style={styles.requestBullet}>•</Text>
                <Text style={styles.requestText}>{request}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Notes */}
      {booking.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>{booking.notes}</Text>
          </View>
        </View>
      )}

      {/* Pricing */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.pricingHeader}
          onPress={() => setShowFullPricing(!showFullPricing)}
        >
          <Text style={styles.sectionTitle}>Payment</Text>
          <Text style={styles.expandIcon}>{showFullPricing ? '−' : '+'}</Text>
        </TouchableOpacity>

        <View style={styles.pricingCard}>
          {showFullPricing && (
            <>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>
                  ${booking.pricing.nightlyRate} x {booking.pricing.nights} nights
                </Text>
                <Text style={styles.pricingValue}>${booking.pricing.subtotal}</Text>
              </View>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Cleaning fee</Text>
                <Text style={styles.pricingValue}>${booking.pricing.cleaningFee}</Text>
              </View>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Service fee</Text>
                <Text style={styles.pricingValue}>${booking.pricing.serviceFee}</Text>
              </View>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Taxes</Text>
                <Text style={styles.pricingValue}>${booking.pricing.taxes}</Text>
              </View>
              <View style={styles.pricingDivider} />
            </>
          )}
          <View style={styles.pricingRow}>
            <Text style={styles.pricingTotal}>Total</Text>
            <Text style={styles.pricingTotalValue}>
              ${booking.pricing.total.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        <View style={styles.timelineCard}>
          {booking.timeline.map((event, index) => (
            <View key={index} style={styles.timelineItem}>
              <View style={styles.timelineIcon}>
                <Text style={styles.timelineEmoji}>{event.icon}</Text>
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineAction}>{event.action}</Text>
                <Text style={styles.timelineTime}>
                  {format(event.time, 'MMM d, h:mm a')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {booking.status === 'confirmed' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleCheckIn}
          >
            <Text style={styles.primaryButtonText}>Check In Guest</Text>
          </TouchableOpacity>
        )}

        {booking.status === 'checked_in' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleCheckOut}
          >
            <Text style={styles.primaryButtonText}>Check Out Guest</Text>
          </TouchableOpacity>
        )}

        {(booking.status === 'pending' || booking.status === 'confirmed') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleCancelBooking}
          >
            <Text style={styles.dangerButtonText}>Cancel Booking</Text>
          </TouchableOpacity>
        )}
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

  // Property Card
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    margin: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  propertyImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: COLORS.grayLighter,
  },
  propertyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  propertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  propertyAddress: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  propertyArrow: {
    fontSize: 18,
    color: COLORS.grayLight,
  },

  // Status Row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  sourceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  externalId: {
    fontSize: 12,
    color: COLORS.gray,
    marginLeft: 'auto',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  // Guest Card
  guestCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  guestHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  guestPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  guestInitials: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '600',
  },
  guestDetails: {
    marginLeft: 14,
    flex: 1,
  },
  guestName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  guestMeta: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  vipBadge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  vipText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.maroon + '10',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  contactIcon: {
    fontSize: 16,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.maroon,
  },

  // Dates
  datesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
  },
  dateBlock: {
    flex: 1,
  },
  dateBlockRight: {
    alignItems: 'flex-end',
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  dateTime: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  nightsBlock: {
    paddingHorizontal: 20,
  },
  nightsCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nightsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  nightsLabel: {
    fontSize: 10,
    color: COLORS.white + '80',
    marginTop: -2,
  },

  // Access Code
  accessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  accessIcon: {
    fontSize: 24,
  },
  accessCode: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.charcoal,
    letterSpacing: 4,
  },
  copyButton: {
    backgroundColor: COLORS.maroon + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  copyText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.maroon,
  },

  // Requests
  requestsCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  requestItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  requestBullet: {
    fontSize: 14,
    color: COLORS.maroon,
    marginRight: 8,
    lineHeight: 22,
  },
  requestText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.charcoal,
    lineHeight: 22,
  },

  // Notes
  notesCard: {
    backgroundColor: COLORS.gold + '15',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  notesText: {
    fontSize: 14,
    color: COLORS.charcoal,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // Pricing
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  expandIcon: {
    fontSize: 20,
    color: COLORS.maroon,
    fontWeight: '600',
  },
  pricingCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  pricingLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  pricingValue: {
    fontSize: 14,
    color: COLORS.charcoal,
  },
  pricingDivider: {
    height: 1,
    backgroundColor: COLORS.grayLighter,
    marginVertical: 8,
  },
  pricingTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  pricingTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.success,
  },

  // Timeline
  timelineCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.maroon + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineEmoji: {
    fontSize: 16,
  },
  timelineContent: {
    flex: 1,
    justifyContent: 'center',
  },
  timelineAction: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  timelineTime: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },

  // Actions
  actions: {
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.maroon,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: COLORS.error + '15',
  },
  dangerButtonText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
