/**
 * Right at Home BnB - Leaderboard Screen
 * Cleaner rankings, achievements, and scores
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Image, Dimensions, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';

const { width } = Dimensions.get('window');

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatar?: string;
  score: number;
  jobsCompleted: number;
  avgRating: number;
  earnings: number;
  streak: number;
  isCurrentUser: boolean;
  change: number; // Rank change from last week
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  total: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  xpReward: number;
}

interface LeaderboardScreenProps {
  navigation: any;
}

export default function LeaderboardScreen({ navigation }: LeaderboardScreenProps) {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'alltime'>('weekly');
  const [refreshing, setRefreshing] = useState(false);

  // Mock data - in real app would come from API
  const currentUser = {
    id: 'user_123',
    name: 'Maria S.',
    avatar: null,
    rank: 3,
    score: 2450,
    jobsCompleted: 28,
    avgRating: 9.2,
    earnings: 1840,
    streak: 5,
    level: 12,
    xp: 3200,
    nextLevelXp: 4000,
  };

  const leaderboard: LeaderboardEntry[] = [
    {
      rank: 1,
      id: 'user_001',
      name: 'Sarah J.',
      score: 3200,
      jobsCompleted: 42,
      avgRating: 9.8,
      earnings: 2560,
      streak: 12,
      isCurrentUser: false,
      change: 0,
    },
    {
      rank: 2,
      id: 'user_002',
      name: 'Carlos M.',
      score: 2800,
      jobsCompleted: 35,
      avgRating: 9.5,
      earnings: 2100,
      streak: 8,
      isCurrentUser: false,
      change: 1,
    },
    {
      rank: 3,
      id: 'user_123',
      name: 'Maria S.',
      score: 2450,
      jobsCompleted: 28,
      avgRating: 9.2,
      earnings: 1840,
      streak: 5,
      isCurrentUser: true,
      change: -1,
    },
    {
      rank: 4,
      id: 'user_003',
      name: 'James W.',
      score: 2200,
      jobsCompleted: 25,
      avgRating: 9.0,
      earnings: 1650,
      streak: 3,
      isCurrentUser: false,
      change: 2,
    },
    {
      rank: 5,
      id: 'user_004',
      name: 'Lisa K.',
      score: 2100,
      jobsCompleted: 24,
      avgRating: 8.9,
      earnings: 1580,
      streak: 4,
      isCurrentUser: false,
      change: 0,
    },
  ];

  const achievements: Achievement[] = [
    {
      id: 'first_clean',
      title: 'First Clean',
      description: 'Complete your first cleaning job',
      icon: '🎉',
      progress: 1,
      total: 1,
      isUnlocked: true,
      unlockedAt: '2024-01-15',
      xpReward: 50,
    },
    {
      id: 'streak_5',
      title: 'On Fire!',
      description: 'Maintain a 5-day streak',
      icon: '🔥',
      progress: 5,
      total: 5,
      isUnlocked: true,
      unlockedAt: '2024-01-20',
      xpReward: 100,
    },
    {
      id: 'perfect_10',
      title: 'Perfect 10',
      description: 'Get a 10/10 rating',
      icon: '⭐',
      progress: 8,
      total: 10,
      isUnlocked: false,
      xpReward: 150,
    },
    {
      id: 'jobs_25',
      title: 'Quarter Century',
      description: 'Complete 25 jobs',
      icon: '🏅',
      progress: 28,
      total: 25,
      isUnlocked: true,
      unlockedAt: '2024-01-18',
      xpReward: 200,
    },
    {
      id: 'early_bird',
      title: 'Early Bird',
      description: 'Complete 10 morning jobs',
      icon: '🌅',
      progress: 6,
      total: 10,
      isUnlocked: false,
      xpReward: 75,
    },
    {
      id: 'photo_pro',
      title: 'Photo Pro',
      description: 'Take 100 documentation photos',
      icon: '📸',
      progress: 84,
      total: 100,
      isUnlocked: false,
      xpReward: 100,
    },
  ];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return { icon: '🥇', color: '#FFD700', label: '1st' };
      case 2:
        return { icon: '🥈', color: '#C0C0C0', label: '2nd' };
      case 3:
        return { icon: '🥉', color: '#CD7F32', label: '3rd' };
      default:
        return { icon: `#${rank}`, color: COLORS.gray, label: `${rank}th` };
    }
  };

  const getChangeIndicator = (change: number) => {
    if (change > 0) return { icon: '↑', color: COLORS.success };
    if (change < 0) return { icon: '↓', color: COLORS.error };
    return { icon: '−', color: COLORS.gray };
  };

  const renderLeaderboardEntry = (entry: LeaderboardEntry) => {
    const badge = getRankBadge(entry.rank);
    const change = getChangeIndicator(entry.change);

    return (
      <TouchableOpacity
        key={entry.id}
        style={[
          styles.leaderboardEntry,
          entry.isCurrentUser && styles.leaderboardEntryHighlight,
        ]}
        activeOpacity={0.7}
      >
        {/* Rank */}
        <View style={[styles.rankContainer, { backgroundColor: `${badge.color}20` }]}>
          <Text style={styles.rankIcon}>
            {entry.rank <= 3 ? badge.icon : entry.rank}
          </Text>
          <View style={[styles.changeIndicator, { backgroundColor: change.color }]}>
            <Text style={styles.changeText}>{change.icon}</Text>
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            {entry.avatar ? (
              <Image source={{ uri: entry.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{entry.name.charAt(0)}</Text>
              </View>
            )}
            {entry.isCurrentUser && <View style={styles.youBadge} />}
          </View>
          <View style={styles.nameContainer}>
            <Text style={[styles.userName, entry.isCurrentUser && styles.userNameHighlight]}>
              {entry.name} {entry.isCurrentUser && '(You)'}
            </Text>
            <Text style={styles.userStats}>
              ⭐ {entry.avgRating} • {entry.jobsCompleted} jobs • 🔥 {entry.streak}
            </Text>
          </View>
        </View>

        {/* Score */}
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreValue}>{entry.score.toLocaleString()}</Text>
          <Text style={styles.scoreLabel}>pts</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAchievement = (achievement: Achievement) => {
    const progressPercent = Math.min(100, (achievement.progress / achievement.total) * 100);

    return (
      <TouchableOpacity
        key={achievement.id}
        style={[
          styles.achievementCard,
          !achievement.isUnlocked && styles.achievementLocked,
        ]}
        activeOpacity={0.7}
      >
        <View style={styles.achievementIcon}>
          <Text style={styles.achievementEmoji}>{achievement.icon}</Text>
          {achievement.isUnlocked && (
            <View style={styles.unlockedBadge}>
              <Text style={styles.unlockedText}>✓</Text>
            </View>
          )}
        </View>
        <View style={styles.achievementContent}>
          <Text style={styles.achievementTitle}>{achievement.title}</Text>
          <Text style={styles.achievementDesc}>{achievement.description}</Text>
          <View style={styles.achievementProgress}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPercent}%`,
                    backgroundColor: achievement.isUnlocked ? COLORS.success : COLORS.gold,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {achievement.progress}/{achievement.total}
            </Text>
          </View>
        </View>
        <View style={styles.xpBadge}>
          <Text style={styles.xpText}>+{achievement.xpReward} XP</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* User Stats Card */}
        <View style={styles.userStatsCard}>
          <View style={styles.userStatsHeader}>
            <View style={styles.userAvatarLarge}>
              <Text style={styles.userAvatarLargeText}>{currentUser.name.charAt(0)}</Text>
            </View>
            <View style={styles.userMainStats}>
              <Text style={styles.userNameLarge}>{currentUser.name}</Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>Level {currentUser.level}</Text>
              </View>
            </View>
            <View style={styles.rankDisplay}>
              <Text style={styles.rankNumber}>#{currentUser.rank}</Text>
              <Text style={styles.rankLabel}>This Week</Text>
            </View>
          </View>

          {/* XP Progress */}
          <View style={styles.xpContainer}>
            <View style={styles.xpHeader}>
              <Text style={styles.xpLabel}>XP to Level {currentUser.level + 1}</Text>
              <Text style={styles.xpValue}>{currentUser.xp}/{currentUser.nextLevelXp}</Text>
            </View>
            <View style={styles.xpBar}>
              <View
                style={[
                  styles.xpFill,
                  { width: `${(currentUser.xp / currentUser.nextLevelXp) * 100}%` },
                ]}
              />
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{currentUser.score}</Text>
              <Text style={styles.quickStatLabel}>Points</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>${currentUser.earnings}</Text>
              <Text style={styles.quickStatLabel}>Earned</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>🔥 {currentUser.streak}</Text>
              <Text style={styles.quickStatLabel}>Day Streak</Text>
            </View>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          {(['weekly', 'monthly', 'alltime'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'alltime' ? 'All Time' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Leaderboard */}
        <Text style={styles.sectionTitle}>Top Cleaners</Text>
        <View style={styles.leaderboardList}>
          {leaderboard.map(renderLeaderboardEntry)}
        </View>

        {/* Achievements */}
        <Text style={styles.sectionTitle}>Achievements</Text>
        <View style={styles.achievementsList}>
          {achievements.map(renderAchievement)}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    justifyContent: 'space-between',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerRight: {
    width: 40,
  },

  scrollView: {
    flex: 1,
  },

  // User Stats Card
  userStatsCard: {
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  userStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarLargeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  userMainStats: {
    flex: 1,
    marginLeft: 16,
  },
  userNameLarge: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  levelBadge: {
    backgroundColor: `${COLORS.gold}30`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.goldDark,
  },
  rankDisplay: {
    alignItems: 'flex-end',
  },
  rankNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.maroon,
  },
  rankLabel: {
    fontSize: 11,
    color: COLORS.gray,
  },

  // XP Progress
  xpContainer: {
    marginTop: 20,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  xpLabel: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  xpValue: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '600',
  },
  xpBar: {
    height: 8,
    backgroundColor: COLORS.grayLighter,
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 4,
  },

  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLighter,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  quickStatLabel: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: COLORS.grayLighter,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: COLORS.maroon,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
  },
  tabTextActive: {
    color: COLORS.white,
  },

  // Section Title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginTop: 24,
    marginBottom: 12,
    marginHorizontal: 16,
  },

  // Leaderboard List
  leaderboardList: {
    paddingHorizontal: 16,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  leaderboardEntryHighlight: {
    borderWidth: 2,
    borderColor: COLORS.maroon,
    backgroundColor: `${COLORS.maroon}05`,
  },
  rankContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rankIcon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  changeIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray,
  },
  youBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.maroon,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  nameContainer: {
    marginLeft: 10,
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  userNameHighlight: {
    color: COLORS.maroon,
  },
  userStats: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.maroon,
  },
  scoreLabel: {
    fontSize: 10,
    color: COLORS.gray,
  },

  // Achievements
  achievementsList: {
    paddingHorizontal: 16,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  achievementLocked: {
    opacity: 0.6,
  },
  achievementIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: `${COLORS.gold}20`,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  achievementEmoji: {
    fontSize: 26,
  },
  unlockedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockedText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  achievementContent: {
    flex: 1,
    marginLeft: 12,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  achievementDesc: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },
  achievementProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.grayLighter,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: COLORS.gray,
    fontWeight: '500',
  },
  xpBadge: {
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  xpText: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: '600',
  },
});
