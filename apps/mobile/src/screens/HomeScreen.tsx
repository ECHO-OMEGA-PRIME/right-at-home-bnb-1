/**
 * Right at Home BnB - Home Screen
 * Cleaner dashboard with stats, jobs, and notifications
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, Animated
} from 'react-native';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationData, sendTestNotification } from '../services/notifications';

const COLORS = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
  charcoal: '#2D2D2D',
  white: '#FFFFFF',
  green: '#4CAF50',
  orange: '#FFA500',
  red: '#EF4444',
};

// Stat Card
const StatCard = ({ icon, label, value, subValue, highlight }: any) => (
  <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {subValue && <Text style={styles.statSub}>{subValue}</Text>}
  </View>
);

// Quick Action Button
const QuickAction = ({ icon, label, onPress, badge }: any) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress}>
    {badge > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    )}
    <Text style={styles.quickIcon}>{icon}</Text>
    <Text style={styles.quickLabel}>{label}</Text>
  </TouchableOpacity>
);

// Active Job Card
const ActiveJobCard = ({ job, onPress, isUrgent }: any) => (
  <TouchableOpacity
    style={[styles.jobCard, isUrgent && styles.jobCardUrgent]}
    onPress={onPress}
  >
    {isUrgent && (
      <View style={styles.urgentBanner}>
        <Text style={styles.urgentText}>URGENT - 1.5x PAY</Text>
      </View>
    )}
    <View style={styles.jobHeader}>
      <View style={[
        styles.statusDot,
        {
          backgroundColor: job.status === 'in_progress' ? COLORS.orange
            : job.status === 'urgent' ? COLORS.red
            : COLORS.green
        }
      ]} />
      <Text style={styles.jobProperty}>{job.property}</Text>
      {job.bonusMultiplier && job.bonusMultiplier > 1 && (
        <View style={styles.bonusTag}>
          <Text style={styles.bonusTagText}>{job.bonusMultiplier}x</Text>
        </View>
      )}
    </View>
    <Text style={styles.jobTime}>{job.time} • {job.duration}</Text>
    <View style={styles.jobFooter}>
      <Text style={styles.jobStatus}>{job.status.replace('_', ' ').toUpperCase()}</Text>
      <View style={styles.jobMeta}>
        <Text style={styles.jobPhotos}>📷 {job.photos || 0}</Text>
        <Text style={styles.jobPayment}>${job.payment}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

// Notification Toast
const NotificationToast = ({ notification, onDismiss }: any) => {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(4000),
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onDismiss?.());
  }, []);

  if (!notification) return null;

  return (
    <Animated.View style={[styles.toast, { opacity: fadeAnim }]}>
      <TouchableOpacity onPress={onDismiss} style={styles.toastContent}>
        <Text style={styles.toastTitle}>{notification.title}</Text>
        <Text style={styles.toastBody}>{notification.body}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function HomeScreen({ navigation, route }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const [latestNotification, setLatestNotification] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(2);
  const filter = route?.params?.filter;

  // Initialize push notifications
  useNotifications({
    userId: 'cleaner_123', // Would come from auth context
    onNotificationReceived: (notification) => {
      setLatestNotification({
        title: notification.request.content.title,
        body: notification.request.content.body,
      });
      setUnreadCount(prev => prev + 1);
    },
    onNotificationTapped: (data: NotificationData) => {
      setUnreadCount(0);
    },
  });

  const stats = {
    todayJobs: 3,
    completedToday: 2,
    avgScore: 9.2,
    earnings: 360,
    weeklyEarnings: 1240,
    rank: 3,
  };

  const activeJobs = [
    {
      id: 1,
      property: 'Castleford Estate',
      time: '2:00 PM',
      duration: '2 hrs',
      status: 'in_progress',
      photos: 3,
      payment: 85,
      bonusMultiplier: 1.0,
    },
    {
      id: 2,
      property: 'Basin View Cottage',
      time: '5:00 PM',
      duration: '1.5 hrs',
      status: 'scheduled',
      photos: 0,
      payment: 65,
    },
    {
      id: 3,
      property: 'Permian Palace',
      time: 'ASAP',
      duration: '2 hrs',
      status: 'urgent',
      photos: 0,
      payment: 128, // 1.5x of $85
      bonusMultiplier: 1.5,
    },
  ];

  // Filter for urgent if coming from notification
  const displayJobs = filter === 'urgent'
    ? activeJobs.filter(j => j.status === 'urgent')
    : activeJobs;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate API refresh
    setTimeout(() => {
      setRefreshing(false);
      setUnreadCount(0);
    }, 1500);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={styles.wrapper}>
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
        {/* Welcome Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.name}>Maria!</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Text style={styles.notificationIcon}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Rank Badge */}
          <View style={styles.rankBadge}>
            <Text style={styles.rankIcon}>🏆</Text>
            <Text style={styles.rankText}>Rank #{stats.rank} this week</Text>
            <Text style={styles.rankEarnings}>${stats.weeklyEarnings} earned</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard icon="📋" label="Today's Jobs" value={stats.todayJobs} />
          <StatCard icon="✅" label="Completed" value={stats.completedToday} />
          <StatCard
            icon="⭐"
            label="Avg Score"
            value={stats.avgScore}
            highlight={stats.avgScore >= 9.0}
          />
          <StatCard icon="💵" label="Today" value={`$${stats.earnings}`} />
        </View>

        {/* Urgent Alert */}
        {activeJobs.some(j => j.status === 'urgent') && (
          <TouchableOpacity
            style={styles.urgentAlert}
            onPress={() => {
              const urgentJob = activeJobs.find(j => j.status === 'urgent');
              if (urgentJob) {
                navigation.navigate('Jobs', {
                  screen: 'JobDetail',
                  params: { jobId: urgentJob.id }
                });
              }
            }}
          >
            <Text style={styles.urgentAlertIcon}>🚨</Text>
            <View style={styles.urgentAlertContent}>
              <Text style={styles.urgentAlertTitle}>Urgent Job Available!</Text>
              <Text style={styles.urgentAlertSub}>1.5x pay - Claim now</Text>
            </View>
            <Text style={styles.urgentAlertArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickAction
            icon="📍"
            label="Check In"
            badge={1}
            onPress={() => {
              const nextJob = activeJobs.find(j => j.status === 'scheduled' || j.status === 'urgent');
              if (nextJob) {
                navigation.navigate('Jobs', {
                  screen: 'JobDetail',
                  params: { jobId: nextJob.id }
                });
              }
            }}
          />
          <QuickAction
            icon="📷"
            label="Photos"
            onPress={() => {
              const inProgressJob = activeJobs.find(j => j.status === 'in_progress');
              if (inProgressJob) {
                navigation.navigate('Jobs', {
                  screen: 'JobDetail',
                  params: { jobId: inProgressJob.id }
                });
              }
            }}
          />
          <QuickAction
            icon="📦"
            label="Supplies"
            onPress={() => Alert.alert('Supplies', 'Low supply request sent!')}
          />
          <QuickAction
            icon="🔧"
            label="Issue"
            onPress={() => navigation.navigate('ReportIssue')}
          />
        </View>

        {/* Active Jobs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {filter === 'urgent' ? 'Urgent Jobs' : 'Active Jobs'}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Jobs')}>
            <Text style={styles.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>

        {displayJobs.map((job) => (
          <ActiveJobCard
            key={job.id}
            job={job}
            isUrgent={job.status === 'urgent'}
            onPress={() => navigation.navigate('Jobs', {
              screen: 'JobDetail',
              params: { jobId: job.id }
            })}
          />
        ))}

        {displayJobs.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySub}>No urgent jobs right now</Text>
          </View>
        )}

        {/* Test Notification Button (dev only) */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => sendTestNotification()}
          >
            <Text style={styles.testButtonText}>Test Notification</Text>
          </TouchableOpacity>
        )}

        {/* Bottom Padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Notification Toast */}
      <NotificationToast
        notification={latestNotification}
        onDismiss={() => setLatestNotification(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
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
    color: COLORS.charcoal,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.maroon,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationIcon: { fontSize: 20 },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gold + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    gap: 8,
  },
  rankIcon: { fontSize: 16 },
  rankText: { fontSize: 13, color: COLORS.charcoal, fontWeight: '500' },
  rankEarnings: { fontSize: 13, color: COLORS.green, fontWeight: '600', marginLeft: 'auto' },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
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
  statCardHighlight: {
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.maroon },
  statValueHighlight: { color: COLORS.gold },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  statSub: { fontSize: 10, color: '#999' },

  // Urgent Alert
  urgentAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.red,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  urgentAlertIcon: { fontSize: 24 },
  urgentAlertContent: { flex: 1 },
  urgentAlertTitle: { color: COLORS.white, fontWeight: '600', fontSize: 15 },
  urgentAlertSub: { color: COLORS.white, opacity: 0.9, fontSize: 12 },
  urgentAlertArrow: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },

  // Sections
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.charcoal,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
  },
  seeAll: {
    color: COLORS.maroon,
    fontWeight: '500',
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
    position: 'relative',
  },
  quickIcon: { fontSize: 24, marginBottom: 8 },
  quickLabel: { fontSize: 12, color: COLORS.charcoal, fontWeight: '500' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: 'bold' },

  // Job Cards
  jobCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  jobCardUrgent: {
    borderWidth: 2,
    borderColor: COLORS.red,
  },
  urgentBanner: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  urgentText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  jobProperty: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  bonusTag: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bonusTagText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  jobTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.maroon,
    backgroundColor: `${COLORS.maroon}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  jobPhotos: {
    fontSize: 14,
    color: '#666',
  },
  jobPayment: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.green,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.charcoal },
  emptySub: { fontSize: 14, color: '#666', marginTop: 4 },

  // Test Button (dev)
  testButton: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#DDD',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: { color: '#666', fontSize: 12 },

  // Toast
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.maroon,
  },
  toastContent: {},
  toastTitle: { fontSize: 15, fontWeight: '600', color: COLORS.charcoal },
  toastBody: { fontSize: 13, color: '#666', marginTop: 4 },
});
