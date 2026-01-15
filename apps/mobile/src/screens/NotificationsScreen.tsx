/**
 * Right at Home BnB - Notifications Screen
 * Push notification history and management
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme/colors';

interface NotificationsScreenProps {
  navigation: any;
}

type NotificationType = 'job' | 'message' | 'payment' | 'alert' | 'achievement' | 'system';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  timestamp: Date;
}

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  job: '🏠',
  message: '💬',
  payment: '💰',
  alert: '⚠️',
  achievement: '🏆',
  system: '🔔',
};

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  job: COLORS.info,
  message: COLORS.maroon,
  payment: COLORS.success,
  alert: COLORS.warning,
  achievement: COLORS.gold,
  system: COLORS.gray,
};

const STORAGE_KEY = '@rightathome_notifications';

export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        })));
      } else {
        // Demo notifications for UI display
        setNotifications(generateDemoNotifications());
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateDemoNotifications = (): Notification[] => {
    const now = new Date();
    return [
      {
        id: '1',
        type: 'job',
        title: 'New Job Available',
        body: 'A new cleaning job at 123 Main St is available. Tap to view details.',
        data: { jobId: 'job123', propertyId: 'prop456' },
        read: false,
        timestamp: new Date(now.getTime() - 5 * 60 * 1000), // 5 min ago
      },
      {
        id: '2',
        type: 'message',
        title: 'Message from Sarah',
        body: 'Guest inquiry: "What time can I check in early?"',
        data: { conversationId: 'conv789', guestId: 'guest012' },
        read: false,
        timestamp: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago
      },
      {
        id: '3',
        type: 'payment',
        title: 'Payment Received',
        body: 'You received $85.00 for completing "Sunset Villa" cleaning.',
        data: { paymentId: 'pay345', amount: 85.0 },
        read: true,
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        id: '4',
        type: 'achievement',
        title: 'Achievement Unlocked!',
        body: 'You earned "Speed Demon" - Complete 5 jobs in one day!',
        data: { achievementId: 'speed_demon', xp: 500 },
        read: true,
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        id: '5',
        type: 'alert',
        title: 'Urgent: Guest Issue',
        body: 'Guest reported a maintenance issue at Downtown Loft. Please review.',
        data: { issueId: 'issue678', priority: 'high' },
        read: false,
        timestamp: new Date(now.getTime() - 45 * 60 * 1000), // 45 min ago
      },
      {
        id: '6',
        type: 'system',
        title: 'App Update Available',
        body: 'Version 2.1.0 is now available with new features and bug fixes.',
        read: true,
        timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      {
        id: '7',
        type: 'job',
        title: 'Job Reminder',
        body: 'Your job at "Beach House" starts in 1 hour. Don\'t forget to check in!',
        data: { jobId: 'job234', propertyId: 'prop567' },
        read: true,
        timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
      },
    ];
  };

  const saveNotifications = async (updated: Notification[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save notifications:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, []);

  const markAsRead = async (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    await saveNotifications(updated);
  };

  const markAllAsRead = async () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    await saveNotifications(updated);
  };

  const deleteNotification = async (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    await saveNotifications(updated);
  };

  const clearAllNotifications = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setNotifications([]);
            await AsyncStorage.removeItem(STORAGE_KEY);
          },
        },
      ]
    );
  };

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);

    // Navigate based on notification type
    switch (notification.type) {
      case 'job':
        if (notification.data?.jobId) {
          navigation.navigate('JobDetail', { jobId: notification.data.jobId });
        }
        break;
      case 'message':
        if (notification.data?.conversationId) {
          navigation.navigate('Messages', {
            conversationId: notification.data.conversationId,
          });
        }
        break;
      case 'payment':
        navigation.navigate('Profile', { tab: 'earnings' });
        break;
      case 'achievement':
        navigation.navigate('Leaderboard');
        break;
      case 'alert':
        if (notification.data?.issueId) {
          navigation.navigate('IssueDetail', { issueId: notification.data.issueId });
        }
        break;
      default:
        // System notifications - just mark as read
        break;
    }
  };

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications = notifications.filter((n) =>
    filter === 'all' ? true : n.type === filter
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderFilterButton = (type: NotificationType | 'all', label: string) => (
    <TouchableOpacity
      key={type}
      style={[styles.filterButton, filter === type && styles.filterButtonActive]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderNotification = ({ item }: { item: Notification }) => (
    <Animated.View>
      <TouchableOpacity
        style={[styles.notificationCard, !item.read && styles.notificationUnread]}
        onPress={() => handleNotificationPress(item)}
        onLongPress={() => {
          Alert.alert('Delete Notification', 'Remove this notification?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => deleteNotification(item.id),
            },
          ]);
        }}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${NOTIFICATION_COLORS[item.type]}20` },
          ]}
        >
          <Text style={styles.icon}>{NOTIFICATION_ICONS[item.type]}</Text>
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
        </View>

        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔔</Text>
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptySubtitle}>
        {filter === 'all'
          ? "You're all caught up! Check back later."
          : `No ${filter} notifications yet.`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => {
            Alert.alert('Options', 'Choose an action', [
              { text: 'Mark All as Read', onPress: markAllAsRead },
              { text: 'Clear All', onPress: clearAllNotifications, style: 'destructive' },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <Text style={styles.headerActionIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { type: 'all', label: 'All' },
            { type: 'job', label: 'Jobs' },
            { type: 'message', label: 'Messages' },
            { type: 'payment', label: 'Payments' },
            { type: 'alert', label: 'Alerts' },
            { type: 'achievement', label: 'Achievements' },
          ]}
          keyExtractor={(item) => item.type}
          renderItem={({ item }) => renderFilterButton(item.type as NotificationType | 'all', item.label)}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.maroon]}
            tintColor={COLORS.maroon}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.maroon,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: COLORS.white,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  badge: {
    marginLeft: 8,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionIcon: {
    fontSize: 24,
    color: COLORS.white,
  },

  // Filters
  filterContainer: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  filterList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.grayLighter,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: COLORS.maroon,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
  },
  filterTextActive: {
    color: COLORS.white,
  },

  // List
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },

  // Notification Card
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationUnread: {
    backgroundColor: `${COLORS.maroon}08`,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.maroon,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  contentContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
    marginRight: 8,
  },
  titleUnread: {
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 11,
    color: COLORS.grayLight,
  },
  body: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 18,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.maroon,
    position: 'absolute',
    top: 14,
    right: 14,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
