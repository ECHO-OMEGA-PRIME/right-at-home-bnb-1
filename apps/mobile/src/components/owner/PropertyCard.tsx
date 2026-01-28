/**
 * PropertyCard Component
 * Displays property preview with image, stats, and status
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { COLORS } from '../../theme/colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export interface PropertyCardProps {
  id: string;
  name: string;
  address: string;
  image: string;
  status: 'active' | 'inactive' | 'maintenance';
  currentBooking?: {
    guestName: string;
    checkOut: Date;
  };
  nextBooking?: {
    guestName: string;
    checkIn: Date;
  };
  stats: {
    occupancyRate: number;
    rating: number;
    monthlyRevenue: number;
  };
  onPress: () => void;
  variant?: 'grid' | 'list';
}

const statusColors = {
  active: COLORS.success,
  inactive: COLORS.gray,
  maintenance: COLORS.warning,
};

const statusLabels = {
  active: 'Active',
  inactive: 'Inactive',
  maintenance: 'Maintenance',
};

export function PropertyCard({
  name,
  address,
  image,
  status,
  currentBooking,
  nextBooking,
  stats,
  onPress,
  variant = 'grid',
}: PropertyCardProps) {
  if (variant === 'list') {
    return (
      <TouchableOpacity style={styles.listCard} onPress={onPress} activeOpacity={0.7}>
        <Image
          source={{ uri: image || 'https://via.placeholder.com/120x90' }}
          style={styles.listImage}
        />
        <View style={styles.listContent}>
          <View style={styles.listHeader}>
            <Text style={styles.listName} numberOfLines={1}>{name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColors[status] }]}>
              <Text style={styles.statusText}>{statusLabels[status]}</Text>
            </View>
          </View>
          <Text style={styles.listAddress} numberOfLines={1}>{address}</Text>

          {currentBooking ? (
            <View style={styles.bookingInfo}>
              <Text style={styles.bookingLabel}>Currently Occupied</Text>
              <Text style={styles.bookingGuest}>{currentBooking.guestName}</Text>
            </View>
          ) : nextBooking ? (
            <View style={styles.bookingInfo}>
              <Text style={styles.bookingLabel}>Next Guest</Text>
              <Text style={styles.bookingGuest}>{nextBooking.guestName}</Text>
            </View>
          ) : (
            <Text style={styles.availableText}>Available</Text>
          )}

          <View style={styles.listStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.occupancyRate}%</Text>
              <Text style={styles.statLabel}>Occ.</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.revenueValue]}>
                ${(stats.monthlyRevenue / 1000).toFixed(1)}k
              </Text>
              <Text style={styles.statLabel}>Mo. Rev</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.gridCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: image || 'https://via.placeholder.com/200x150' }}
          style={styles.gridImage}
        />
        <View style={[styles.statusBadgeAbsolute, { backgroundColor: statusColors[status] }]}>
          <Text style={styles.statusText}>{statusLabels[status]}</Text>
        </View>
        {currentBooking && (
          <View style={styles.occupiedBadge}>
            <Text style={styles.occupiedText}>Occupied</Text>
          </View>
        )}
      </View>

      <View style={styles.gridContent}>
        <Text style={styles.gridName} numberOfLines={1}>{name}</Text>
        <Text style={styles.gridAddress} numberOfLines={1}>{address}</Text>

        <View style={styles.gridStats}>
          <View style={styles.gridStatItem}>
            <Text style={styles.gridStatIcon}>📊</Text>
            <Text style={styles.gridStatValue}>{stats.occupancyRate}%</Text>
          </View>
          <View style={styles.gridStatItem}>
            <Text style={styles.gridStatIcon}>★</Text>
            <Text style={styles.gridStatValue}>{stats.rating.toFixed(1)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // List Variant
  listCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  listImage: {
    width: 120,
    height: 'auto',
    minHeight: 120,
    backgroundColor: COLORS.grayLighter,
  },
  listContent: {
    flex: 1,
    padding: 12,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  listName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
    flex: 1,
    marginRight: 8,
  },
  listAddress: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 8,
  },
  bookingInfo: {
    backgroundColor: COLORS.maroon + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  bookingLabel: {
    fontSize: 10,
    color: COLORS.maroon,
    fontWeight: '500',
  },
  bookingGuest: {
    fontSize: 12,
    color: COLORS.charcoal,
    fontWeight: '500',
  },
  availableText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '500',
    marginBottom: 8,
  },
  listStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.gray,
  },
  revenueValue: {
    color: COLORS.success,
  },

  // Status Badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeAbsolute: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Grid Variant
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: 100,
    backgroundColor: COLORS.grayLighter,
  },
  occupiedBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  occupiedText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.white,
  },
  gridContent: {
    padding: 12,
  },
  gridName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 2,
  },
  gridAddress: {
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 8,
  },
  gridStats: {
    flexDirection: 'row',
    gap: 12,
  },
  gridStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridStatIcon: {
    fontSize: 12,
  },
  gridStatValue: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
});

export default PropertyCard;
