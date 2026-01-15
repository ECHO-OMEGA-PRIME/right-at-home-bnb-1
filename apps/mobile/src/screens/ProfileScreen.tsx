/**
 * Right at Home BnB - Profile Screen
 * Cleaner profile with stats, earnings, and quick navigation
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Image, RefreshControl, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme/colors';
import { getCurrentUser, signOut } from '../services/auth';

interface ProfileScreenProps {
  navigation: any;
}

interface UserStats {
  totalJobs: number;
  avgScore: number;
  onTimeRate: number;
  monthlyEarnings: number;
  weeklyEarnings: number;
  totalEarnings: number;
  xp: number;
  level: number;
  rank: number;
  streak: number;
  achievementCount: number;
}

const SettingRow = ({
  icon,
  label,
  value,
  onPress,
  toggle,
  toggleValue,
  badge,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  toggleValue?: boolean;
  badge?: number;
}) => (
  <TouchableOpacity
    style={styles.settingRow}
    onPress={onPress}
    disabled={toggle}
  >
    <Text style={styles.settingIcon}>{icon}</Text>
    <Text style={styles.settingLabel}>{label}</Text>
    {badge && badge > 0 ? (
      <View style={styles.settingBadge}>
        <Text style={styles.settingBadgeText}>{badge}</Text>
      </View>
    ) : null}
    {toggle ? (
      <Switch
        value={toggleValue}
        onValueChange={onPress}
        trackColor={{ false: COLORS.grayLighter, true: `${COLORS.maroon}50` }}
        thumbColor={toggleValue ? COLORS.maroon : COLORS.white}
        ios_backgroundColor={COLORS.grayLighter}
      />
    ) : (
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        <Text style={styles.settingArrow}>></Text>
      </View>
    )}
  </TouchableOpacity>
);

const StatCard = ({
  icon,
  value,
  label,
  highlight,
  onPress,
}: {
  icon: string;
  value: string | number;
  label: string;
  highlight?: boolean;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    style={[styles.statCard, highlight && styles.statCardHighlight]}
    onPress={onPress}
    disabled={!onPress}
  >
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const [notifications, setNotifications] = useState(true);
  const [gpsTracking, setGpsTracking] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(3);

  const [profile, setProfile] = useState({
    name: 'Maria Garcia',
    initials: 'MG',
    email: 'maria@rightathome.bnb',
    phone: '(432) 555-0123',
    role: 'Senior Cleaner',
    avatar: null as string | null,
    memberSince: '2024-03-15',
    isTopPerformer: true,
  });

  const [stats, setStats] = useState<UserStats>({
    totalJobs: 156,
    avgScore: 9.2,
    onTimeRate: 98,
    monthlyEarnings: 4850,
    weeklyEarnings: 1240,
    totalEarnings: 28500,
    xp: 7850,
    level: 12,
    rank: 3,
    streak: 14,
    achievementCount: 24,
  });

  useEffect(() => {
    loadUserData();
    loadSettings();
  }, []);

  const loadUserData = async () => {
    try {
      const user = getCurrentUser();
      if (user) {
        setProfile((prev) => ({
          ...prev,
          name: user.displayName || prev.name,
          email: user.email || prev.email,
          avatar: user.photoURL || prev.avatar,
          initials: user.displayName
            ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase()
            : prev.initials,
        }));
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('@rightathome_settings');
      if (storedSettings) {
        const settings = JSON.parse(storedSettings);
        setNotifications(settings.notifications?.enabled ?? true);
        setGpsTracking(settings.privacy?.shareLocation ?? true);
        setBiometricEnabled(settings.security?.biometricEnabled ?? false);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async (key: string, value: boolean) => {
    try {
      const storedSettings = await AsyncStorage.getItem('@rightathome_settings');
      const settings = storedSettings ? JSON.parse(storedSettings) : {};

      if (key === 'notifications') {
        settings.notifications = { ...settings.notifications, enabled: value };
        setNotifications(value);
      } else if (key === 'gps') {
        settings.privacy = { ...settings.privacy, shareLocation: value };
        setGpsTracking(value);
      } else if (key === 'biometric') {
        settings.security = { ...settings.security, biometricEnabled: value };
        setBiometricEnabled(value);
      }

      await AsyncStorage.setItem('@rightathome_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    await loadSettings();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getLevelTitle = (level: number): string => {
    if (level >= 20) return 'Master Cleaner';
    if (level >= 15) return 'Expert Cleaner';
    if (level >= 10) return 'Senior Cleaner';
    if (level >= 5) return 'Cleaner';
    return 'Trainee';
  };

  const xpForNextLevel = (level: number): number => {
    return level * 1000;
  };

  const xpProgress = (stats.xp % 1000) / 10; // Progress to next level as percentage

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.maroon}
            colors={[COLORS.maroon]}
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => navigation.navigate('Settings')}
          >
            {profile.avatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{profile.initials}</Text>
              </View>
            )}
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeIcon}>+</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.role}>{getLevelTitle(stats.level)}</Text>

          <View style={styles.badgesRow}>
            {profile.isTopPerformer && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Top Performer</Text>
              </View>
            )}
            <View style={[styles.badge, styles.levelBadge]}>
              <Text style={styles.badgeText}>Level {stats.level}</Text>
            </View>
          </View>

          {/* XP Progress */}
          <View style={styles.xpContainer}>
            <View style={styles.xpHeader}>
              <Text style={styles.xpLabel}>{stats.xp.toLocaleString()} XP</Text>
              <Text style={styles.xpNext}>{xpForNextLevel(stats.level + 1).toLocaleString()} to Level {stats.level + 1}</Text>
            </View>
            <View style={styles.xpBar}>
              <View style={[styles.xpFill, { width: `${xpProgress}%` }]} />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Leaderboard')}
          >
            <Text style={styles.quickActionIcon}>🏆</Text>
            <Text style={styles.quickActionLabel}>Leaderboard</Text>
            <View style={styles.quickActionRank}>
              <Text style={styles.quickActionRankText}>#{stats.rank}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Messages')}
          >
            <Text style={styles.quickActionIcon}>💬</Text>
            <Text style={styles.quickActionLabel}>Messages</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.quickActionIcon}>🔔</Text>
            <Text style={styles.quickActionLabel}>Alerts</Text>
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.quickActionIcon}>+</Text>
            <Text style={styles.quickActionLabel}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Performance Stats</Text>
          <View style={styles.statsGrid}>
            <StatCard icon="*" value={stats.totalJobs} label="Total Jobs" />
            <StatCard
              icon="*"
              value={stats.avgScore.toFixed(1)}
              label="Avg Score"
              highlight={stats.avgScore >= 9.0}
            />
            <StatCard icon="*" value={`${stats.onTimeRate}%`} label="On Time" />
            <StatCard
              icon="*"
              value={stats.streak}
              label="Day Streak"
              highlight={stats.streak >= 7}
            />
          </View>
        </View>

        {/* Earnings Summary */}
        <View style={styles.earningsSection}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <View style={styles.earningsItem}>
                <Text style={styles.earningsLabel}>This Week</Text>
                <Text style={styles.earningsValue}>${stats.weeklyEarnings.toLocaleString()}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsItem}>
                <Text style={styles.earningsLabel}>This Month</Text>
                <Text style={styles.earningsValue}>${stats.monthlyEarnings.toLocaleString()}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsItem}>
                <Text style={styles.earningsLabel}>All Time</Text>
                <Text style={styles.earningsValueSmall}>${stats.totalEarnings.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Settings</Text>
          <View style={styles.settingsCard}>
            <SettingRow
              icon="*"
              label="Push Notifications"
              toggle
              toggleValue={notifications}
              onPress={() => saveSettings('notifications', !notifications)}
            />
            <SettingRow
              icon="*"
              label="GPS Tracking"
              toggle
              toggleValue={gpsTracking}
              onPress={() => saveSettings('gps', !gpsTracking)}
            />
            <SettingRow
              icon="*"
              label="Biometric Login"
              toggle
              toggleValue={biometricEnabled}
              onPress={() => saveSettings('biometric', !biometricEnabled)}
            />
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsCard}>
            <SettingRow
              icon="*"
              label="Notifications"
              badge={unreadNotifications}
              onPress={() => navigation.navigate('Notifications')}
            />
            <SettingRow
              icon="*"
              label="Leaderboard"
              value={`Rank #${stats.rank}`}
              onPress={() => navigation.navigate('Leaderboard')}
            />
            <SettingRow
              icon="*"
              label="Achievements"
              value={`${stats.achievementCount} earned`}
              onPress={() => navigation.navigate('Leaderboard')}
            />
            <SettingRow
              icon="*"
              label="Job History"
              onPress={() => navigation.navigate('Jobs')}
            />
            <SettingRow
              icon="*"
              label="Help & Support"
              onPress={() => navigation.navigate('Settings')}
            />
            <SettingRow
              icon="*"
              label="Settings"
              onPress={() => navigation.navigate('Settings')}
            />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>*</Text>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.memberSince}>
          Member since {new Date(profile.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: COLORS.maroon,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.gold,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  editBadgeIcon: {
    fontSize: 14,
    color: COLORS.charcoal,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginTop: 12,
  },
  role: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    backgroundColor: `${COLORS.gold}30`,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelBadge: {
    backgroundColor: `${COLORS.maroon}15`,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.maroon,
  },

  // XP Bar
  xpContainer: {
    width: '80%',
    marginTop: 16,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.maroon,
  },
  xpNext: {
    fontSize: 11,
    color: COLORS.gray,
  },
  xpBar: {
    height: 6,
    backgroundColor: COLORS.grayLighter,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 3,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    position: 'relative',
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: 11,
    color: COLORS.charcoal,
    fontWeight: '500',
  },
  quickActionRank: {
    position: 'absolute',
    top: 4,
    right: 8,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  quickActionRankText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 8,
    backgroundColor: COLORS.error,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
  },

  // Stats
  statsSection: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
  statIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.maroon,
  },
  statValueHighlight: {
    color: COLORS.gold,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 4,
  },

  // Earnings
  earningsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  earningsCard: {
    backgroundColor: COLORS.maroon,
    borderRadius: 16,
    padding: 20,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  earningsValueSmall: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  earningsDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
  },

  // Setting Row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 14,
    width: 28,
    textAlign: 'center',
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.charcoal,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    color: COLORS.gray,
    marginRight: 8,
  },
  settingArrow: {
    fontSize: 18,
    color: COLORS.grayLight,
  },
  settingBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  settingBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.white,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
  },

  // Footer
  memberSince: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.grayLight,
    marginTop: 16,
  },
});
