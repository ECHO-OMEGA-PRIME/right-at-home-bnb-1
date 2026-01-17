/**
 * Right at Home BnB - Leaderboard Service
 * Handles all leaderboard and achievement API operations
 * @author ECHO OMEGA PRIME
 */

import { apiClient } from './api';
import { ApiResponse, LeaderboardEntry, CleanerStats, CleanerProfile } from '../types';

// Achievement type (extend types)
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  total: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  xpReward: number;
  category: 'jobs' | 'quality' | 'streak' | 'earnings' | 'special';
}

// User ranking info
export interface UserRanking {
  userId: string;
  displayName: string;
  avatar?: string;
  rank: number;
  score: number;
  level: number;
  xp: number;
  nextLevelXp: number;
  jobsCompleted: number;
  avgRating: number;
  earnings: number;
  streak: number;
  change: number; // Rank change from previous period
}

// Leaderboard filters
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'alltime';

/**
 * Leaderboard Service - Rankings and achievements
 */
class LeaderboardService {
  /**
   * Get leaderboard entries for a period
   */
  async getLeaderboard(
    period: LeaderboardPeriod = 'weekly',
    limit: number = 20
  ): Promise<ApiResponse<LeaderboardEntry[]>> {
    return apiClient.get<LeaderboardEntry[]>(`/leaderboard?period=${period}&limit=${limit}`);
  }

  /**
   * Get top cleaners (top 3)
   */
  async getTopCleaners(period: LeaderboardPeriod = 'weekly'): Promise<ApiResponse<LeaderboardEntry[]>> {
    return this.getLeaderboard(period, 3);
  }

  /**
   * Get current user's ranking
   */
  async getCurrentUserRanking(period: LeaderboardPeriod = 'weekly'): Promise<ApiResponse<UserRanking>> {
    return apiClient.get<UserRanking>(`/leaderboard/me?period=${period}`);
  }

  /**
   * Get user's rank position in leaderboard
   */
  async getUserRank(userId: string, period: LeaderboardPeriod = 'weekly'): Promise<ApiResponse<{
    rank: number;
    totalParticipants: number;
    percentile: number;
  }>> {
    return apiClient.get(`/leaderboard/rank/${userId}?period=${period}`);
  }

  /**
   * Get all achievements
   */
  async getAchievements(): Promise<ApiResponse<Achievement[]>> {
    return apiClient.get<Achievement[]>('/achievements');
  }

  /**
   * Get user's achievements
   */
  async getUserAchievements(userId?: string): Promise<ApiResponse<Achievement[]>> {
    const endpoint = userId ? `/achievements/user/${userId}` : '/achievements/me';
    return apiClient.get<Achievement[]>(endpoint);
  }

  /**
   * Get achievement categories with counts
   */
  async getAchievementCategories(): Promise<ApiResponse<{
    category: string;
    total: number;
    unlocked: number;
    xpTotal: number;
    xpEarned: number;
  }[]>> {
    return apiClient.get('/achievements/categories');
  }

  /**
   * Get recently unlocked achievements
   */
  async getRecentAchievements(limit: number = 5): Promise<ApiResponse<Achievement[]>> {
    return apiClient.get<Achievement[]>(`/achievements/recent?limit=${limit}`);
  }

  /**
   * Get achievement progress for a specific achievement
   */
  async getAchievementProgress(achievementId: string): Promise<ApiResponse<{
    achievement: Achievement;
    currentProgress: number;
    remainingProgress: number;
    estimatedCompletion?: string;
  }>> {
    return apiClient.get(`/achievements/${achievementId}/progress`);
  }

  /**
   * Claim an achievement reward
   */
  async claimAchievement(achievementId: string): Promise<ApiResponse<{
    xpAwarded: number;
    newTotalXp: number;
    levelUp?: {
      newLevel: number;
      rewards: string[];
    };
  }>> {
    return apiClient.post(`/achievements/${achievementId}/claim`);
  }

  /**
   * Get user's XP and level info
   */
  async getLevelInfo(): Promise<ApiResponse<{
    level: number;
    currentXp: number;
    xpToNextLevel: number;
    totalXpEarned: number;
    levelRewards: string[];
    nextLevelRewards: string[];
  }>> {
    return apiClient.get('/user/level');
  }

  /**
   * Get stats comparison with another user
   */
  async compareStats(otherUserId: string): Promise<ApiResponse<{
    currentUser: CleanerStats;
    otherUser: CleanerStats;
    comparison: {
      jobsDiff: number;
      scoreDiff: number;
      earningsDiff: number;
    };
  }>> {
    return apiClient.get(`/leaderboard/compare/${otherUserId}`);
  }

  /**
   * Get streak info
   */
  async getStreakInfo(): Promise<ApiResponse<{
    currentStreak: number;
    longestStreak: number;
    streakProtected: boolean;
    protectionEnds?: string;
    nextMilestone: number;
    milestoneReward: number;
  }>> {
    return apiClient.get('/user/streak');
  }

  /**
   * Get seasonal/special event leaderboard
   */
  async getEventLeaderboard(eventId: string): Promise<ApiResponse<LeaderboardEntry[]>> {
    return apiClient.get<LeaderboardEntry[]>(`/events/${eventId}/leaderboard`);
  }

  /**
   * Get available events
   */
  async getActiveEvents(): Promise<ApiResponse<{
    id: string;
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    rewards: string[];
    participantCount: number;
  }[]>> {
    return apiClient.get('/events/active');
  }
}

// Export singleton instance
export const leaderboardService = new LeaderboardService();

// Export class for testing
export { LeaderboardService };
