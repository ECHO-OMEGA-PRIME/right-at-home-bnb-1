/**
 * BookingCard Component
 * Displays booking summary with guest info and dates
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { format, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { COLORS } from '../../theme/colors';

export interface BookingCardProps {
  id: string;
  propertyName: string;
  propertyImage?: string;
  guestName: string;
  guestPhoto?: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  source: 'direct' | 'airbnb' | 'vrbo' | 'booking.com';
  total: number;
  onPress: () => void;
}

const statusConfig = {
  pending: { color: COLORS.warning, label: 'Pending', icon: '⏳' },
  confirmed: { color: COLORS.info, label: 'Confirmed', icon: '✓' },
  checked_in: { color: COLORS.success, label: 'Checked In', icon: '🏠' },
  checked_out: { color: COLORS.gray, label: 'Checked Out', icon: '✓' },
  cancelled: { color: COLORS.error, label: 'Cancelled', icon: '✕' },
};

const sourceConfig = {
  direct: { label: 'Direct', color: COLORS.maroon },
  airbnb: { label: 'Airbnb', color: '#FF5A5F' },
  vrbo: { label: 'VRBO', color: '#3B5998' },
  'booking.com': { label: 'Booking', color: '#003580' },
};

function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'MMM d');
}

export function BookingCard({
  propertyName,
  propertyImage,
  guestName,
  guestPhoto,
  checkIn,
  checkOut,
  guests,
  status,
  source,
  total,
  onPress,
}: BookingCardProps) {
  const nights = differenceInDays(new Date(checkOut), new Date(checkIn));
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const statusInfo = statusConfig[status];
  const sourceInfo = sourceConfig[source];

  const isUpcoming = status === 'confirmed' && (isToday(checkInDate) || isTomorrow(checkInDate));

  return (
    <TouchableOpacity
      style={[styles.card, isUpcoming && styles.upcomingCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isUpcoming && (
        <View style={styles.upcomingBanner}>
          <Text style={styles.upcomingText}>
            {isToday(checkInDate) ? 'CHECK-IN TODAY' : 'CHECK-IN TOMORROW'}
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.guestInfo}>
          {guestPhoto ? (
            <Image source={{ uri: guestPhoto }} style={styles.guestPhoto} />
          ) : (
            <View style={styles.guestInitials}>
              <Text style={styles.initialsText}>
                {guestName.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </Text>
            </View>
          )}
          <View style={styles.guestDetails}>
            <Text style={styles.guestName}>{guestName}</Text>
            <Text style={styles.guestCount}>{guests} guest{guests > 1 ? 's' : ''}</Text>
          </View>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.icon} {statusInfo.label}
          </Text>
        </View>
      </View>

      <View style={styles.propertyRow}>
        {propertyImage && (
          <Image source={{ uri: propertyImage }} style={styles.propertyThumb} />
        )}
        <Text style={styles.propertyName} numberOfLines={1}>{propertyName}</Text>
      </View>

      <View style={styles.datesRow}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateLabel}>Check-in</Text>
          <Text style={styles.dateValue}>{getDateLabel(checkInDate)}</Text>
          <Text style={styles.dateTime}>{format(checkInDate, 'h:mm a')}</Text>
        </View>

        <View style={styles.dateDivider}>
          <View style={styles.nightsCircle}>
            <Text style={styles.nightsValue}>{nights}</Text>
            <Text style={styles.nightsLabel}>nights</Text>
          </View>
        </View>

        <View style={[styles.dateBlock, styles.dateBlockRight]}>
          <Text style={styles.dateLabel}>Check-out</Text>
          <Text style={styles.dateValue}>{getDateLabel(checkOutDate)}</Text>
          <Text style={styles.dateTime}>{format(checkOutDate, 'h:mm a')}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={[styles.sourceBadge, { backgroundColor: sourceInfo.color + '15' }]}>
          <Text style={[styles.sourceText, { color: sourceInfo.color }]}>
            {sourceInfo.label}
          </Text>
        </View>

        <Text style={styles.totalAmount}>${total.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  upcomingCard: {
    borderWidth: 2,
    borderColor: COLORS.maroon,
  },
  upcomingBanner: {
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  upcomingText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  guestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  guestPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.grayLighter,
  },
  guestInitials: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  guestDetails: {
    marginLeft: 12,
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  guestCount: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  propertyThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: COLORS.grayLighter,
  },
  propertyName: {
    fontSize: 14,
    color: COLORS.charcoal,
    fontWeight: '500',
    flex: 1,
  },

  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateBlock: {
    flex: 1,
  },
  dateBlockRight: {
    alignItems: 'flex-end',
  },
  dateLabel: {
    fontSize: 11,
    color: COLORS.gray,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  dateTime: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  dateDivider: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  nightsCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.maroon + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nightsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.maroon,
  },
  nightsLabel: {
    fontSize: 9,
    color: COLORS.maroon,
    marginTop: -2,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.success,
  },
});

export default BookingCard;
