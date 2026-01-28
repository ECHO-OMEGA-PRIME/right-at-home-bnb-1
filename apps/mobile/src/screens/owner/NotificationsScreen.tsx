/**
 * Notifications Screen (Owner)
 * All notifications for property management activities
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
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { COLORS } from '../../theme/colors';

type NotificationCategory = 'all' | 'bookings' | 'cleaning' | 'maintenance' | 'payments' | 'alerts';

interface Notification {
  id: string;
  type: 'booking_new' | 'booking_cancelled' | 'booking_modified' | 'checkin_today' | 'checkout_today' |
        'cleaning_assigned' | 'cleaning_completed' | 'cleaning_issue' |
        'maintenance_request' | 'maintenance_completed' |
        'payment_received' | 'payout_processed' |
        'review_received' | 'message_received' |
        'alert_security' | 'alert_noise' | 'alert_device';
  title: string;
  body: string;
  propertyId?: string;
  propertyName?: string;
  bookingId?: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  image?: string;
  metadata?: Record<string, any>;
}

// Mock data
const generateMockNotifications = (): Notification[] => [
  {
    id: '1',
    type: 'booking_new',
    title: 'New Booking!',
    body: 'Sarah Johnson booked Basin View Cottage for Jan 18-22',
    propertyId: '2',
    propertyName: 'Basin View Cottage',
    bookingId: '2',
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 min ago
    read: false,
    metadata: { amount: 620, nights: 4 },
  },
  {
    id: '2',
    type: 'checkin_today',
    title: 'Check-in Today',
    body: 'John Smith checks in at Castleford Estate at 3:00 PM',
    propertyId: '1',
    propertyName: 'Castleford Estate',
    bookingId: '1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    read: false,
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=100',
  },
  {
    id: '3',
    type: 'cleaning_completed',
    title: 'Cleaning Complete',
    body: 'Maria Garcia completed turnover at Basin View Cottage',
    propertyId: '2',
    propertyName: 'Basin View Cottage',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
    read: true,
  },
  {
    id: '4',
    type: 'payment_received',
    title: 'Payment Received',
    body: 'You received $620 for Basin View Cottage booking',
    propertyId: '2',
    propertyName: 'Basin View Cottage',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
    read: true,
    metadata: { amount: 620 },
  },
  {
    id: '5',
    type: 'review_received',
    title: 'New Review!',
    body: 'David Wilson left a 5-star review for Castleford Estate',
    propertyId: '1',
    propertyName: 'Castleford Estate',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // Yesterday
    read: true,
    metadata: { rating: 5 },
  },
  {
    id: '6',
    type: 'maintenance_request',
    title: 'Maintenance Needed',
    body: 'AC filter replacement due at Executive Suite',
    propertyId: '6',
    propertyName: 'Executive Suite',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26), // Yesterday
    read: false,
  },
  {
    id: '7',
    type: 'cleaning_issue',
    title: 'Cleaning Issue Reported',
    body: 'James Wilson reported an issue at Castleford Estate - extra supplies needed',
    propertyId: '1',
    propertyName: 'Castleford Estate',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    read: true,
  },
  {
    id: '8',
    type: 'payout_processed',
    title: 'Payout Processed',
    body: 'Weekly payout of $3,240 sent to your bank account',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    read: true,
    metadata: { amount: 3240 },
  },
  {
    id: '9',
    type: 'booking_cancelled',
    title: 'Booking Cancelled',
    body: 'Robert Taylor cancelled their booking at Permian Palace',
    propertyId: '3',
    propertyName: 'Permian Palace',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96), // 4 days ago
    read: true,
    metadata: { refundAmount: 880 },
  },
  {
    id: '10',
    type: 'alert_device',
    title: 'Smart Lock Alert',
    body: 'Front door lock battery low at Downtown Loft',
    propertyId: '4',
    propertyName: 'Downtown Loft',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120), // 5 days ago
    read: true,
  },
];

const CATEGORY_FILTERS = [
  { key: 'all', label: 'All', icon: '🔔' },
  { key: 'bookings', label: 'Bookings', icon: '📅' },
  { key: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { key: 'payments', label: 'Payments', icon: '💰' },
  { key: 'alerts', label: 'Alerts', icon: '⚠️' },
];

const TYPE_CONFIG: Record<string, { icon: string; color: string; category: NotificationCategory }> = {
  booking_new: { icon: '📅', color: '#10B981', category: 'bookings' },
  booking_cancelled: { icon: '❌', color: '#EF4444', category: 'bookings' },
  booking_modified: { icon: '✏️', color: '#F59E0B', category: 'bookings' },
  checkin_today: { icon: '🚪', color: '#3B82F6', category: 'bookings' },
  checkout_today: { icon: '👋', color: '#8B5CF6', category: 'bookings' },
  cleaning_assigned: { icon: '🧹', color: '#6366F1', category: 'cleaning' },
  cleaning_completed: { icon: '✨', color: '#10B981', category: 'cleaning' },
  cleaning_issue: { icon: '⚠️', color: '#EF4444', category: 'cleaning' },
  maintenance_request: { icon: '🔧', color: '#F59E0B', category: 'maintenance' },
  maintenance_completed: { icon: '✅', color: '#10B981', category: 'maintenance' },
  payment_received: { icon: '💵', color: '#10B981', category: 'payments' },
  payout_processed: { icon: '🏦', color: '#3B82F6', category: 'payments' },
  review_received: { icon: '⭐', color: '#F59E0B', category: 'bookings' },
  message_received: { icon: '💬', color: '#6366F1', category: 'bookings' },
  alert_security: { icon: '🚨', color: '#EF4444', category: 'alerts' },
  alert_noise: { icon: '🔊', color: '#F59E0B', category: 'alerts' },
  alert_device: { icon: '📱', color: '#6366F1', category: 'alerts' },
};

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<NotificationCategory>('all');
  const [notifications, setNotifications] = useState(generateMockNotifications);

  const filteredNotifications = useMemo(() => {
    if (category === 'all') return notifications;
    return notifications.filter((n) => {
      const config = TYPE_CONFIG[n.type];
      return config?.category === category;
    });
  }, [notifications, category]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const groupedNotifications = useMemo(() => {
    const groups: { title: string; data: Notification[] }[] = [];
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const earlier: Notification[] = [];

    filteredNotifications.forEach((n) => {
      if (isToday(new Date(n.timestamp))) {
        today.push(n);
      } else if (isYesterday(new Date(n.timestamp))) {
        yesterday.push(n);
      } else {
        earlier.push(n);
      }
    });

    if (today.length) groups.push({ title: 'Today', data: today });
    if (yesterday.length) groups.push({ title: 'Yesterday', data: yesterday });
    if (earlier.length) groups.push({ title: 'Earlier', data: earlier });

    return groups;
  }, [filteredNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleNotificationPress = useCallback((notification: Notification) => {
    markAsRead(notification.id);

    // Navigate based on type
    if (notification.bookingId) {
      navigation.navigate('BookingDetail', { bookingId: notification.bookingId });
    } else if (notification.propertyId && notification.type.includes('cleaning')) {
      navigation.navigate('CleaningTasks');
    } else if (notification.propertyId) {
      navigation.navigate('PropertyDetail', { propertyId: notification.propertyId });
    }
  }, [navigation, markAsRead]);

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Unread Count & Actions */}
      <View style={styles.headerRow}>
        {unreadCount > 0 ? (
          <>
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{unreadCount}</Text>
              <Text style={styles.unreadLabel}>unread</Text>
            </View>
            <TouchableOpacity style={styles.markReadButton} onPress={markAllAsRead}>
              <Text style={styles.markReadText}>Mark all as read</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.allReadText}>All caught up!</Text>
        )}
      </View>

      {/* Category Filters */}
      <View style={styles.filters}>
        {CATEGORY_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterButton,
              category === filter.key && styles.filterButtonActive,
            ]}
            onPress={() => setCategory(filter.key as NotificationCategory)}
          >
            <Text style={styles.filterIcon}>{filter.icon}</Text>
            <Text
              style={[
                styles.filterLabel,
                category === filter.key && styles.filterLabelActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderNotification = ({ item }: { item: Notification }) => {
    const config = TYPE_CONFIG[item.type] || { icon: '🔔', color: COLORS.gray };

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.read && styles.notificationUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: config.color + '15' }]}>
          <Text style={styles.icon}>{config.icon}</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.timestamp}>
              {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
            </Text>
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
          {item.propertyName && (
            <View style={styles.propertyTag}>
              <Text style={styles.propertyTagText}>{item.propertyName}</Text>
            </View>
          )}
        </View>

        {/* Unread Indicator */}
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🔔</Text>
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptySubtitle}>
        {category !== 'all'
          ? `No ${category} notifications`
          : "You're all caught up!"}
      </Text>
    </View>
  );

  // Flatten grouped data for FlatList
  const flattenedData = useMemo(() => {
    const result: (Notification | { type: 'header'; title: string })[] = [];
    groupedNotifications.forEach((group) => {
      result.push({ type: 'header', title: group.title } as any);
      result.push(...group.data);
    });
    return result;
  }, [groupedNotifications]);

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'header') {
      return renderSectionHeader(item.title);
    }
    return renderNotification({ item });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={flattenedData}
        renderItem={renderItem}
        keyExtractor={(item) => (item as any).id || (item as any).title}
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
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadCount: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.maroon,
  },
  unreadLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  markReadButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.maroon + '15',
  },
  markReadText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.maroon,
  },
  allReadText: {
    fontSize: 16,
    color: COLORS.gray,
  },

  // Filters
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
    gap: 4,
  },
  filterButtonActive: {
    backgroundColor: COLORS.maroon,
    borderColor: COLORS.maroon,
  },
  filterIcon: {
    fontSize: 12,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  filterLabelActive: {
    color: COLORS.white,
  },

  // List
  list: {
    paddingBottom: 40,
  },

  // Section Header
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Notification Card
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  notificationUnread: {
    backgroundColor: COLORS.maroon + '05',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.maroon,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
    flex: 1,
  },
  titleUnread: {
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 11,
    color: COLORS.grayLight,
    marginLeft: 8,
  },
  body: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 18,
  },
  propertyTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.grayLighter,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  propertyTagText: {
    fontSize: 11,
    color: COLORS.gray,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.maroon,
    marginLeft: 8,
    marginTop: 4,
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
