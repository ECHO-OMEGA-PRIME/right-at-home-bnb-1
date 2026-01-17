/**
 * Right at Home BnB - Leaderboard Hooks
 * React Query hooks for leaderboard and achievements
 * @author ECHO OMEGA PRIME
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import {
  leaderboardService,
  LeaderboardPeriod,
  Achievement,
  UserRanking,
} from '../services/leaderboard';
import { LeaderboardEntry, ApiResponse } from '../types';

// Query keys for cache management
export const leaderboardQueryKeys = {
  all: ['leaderboard'] as const,
  lists: () => [...leaderboardQueryKeys.all, 'list'] as const,
  list: (period: LeaderboardPeriod) => [...leaderboardQueryKeys.lists(), period] as const,
  top: (period: LeaderboardPeriod) => [...leaderboardQueryKeys.all, 'top', period] as const,
  currentUser: (period: LeaderboardPeriod) => [...leaderboardQueryKeys.all, 'me', period] as const,
  achievements: () => [...leaderboardQueryKeys.all, 'achievements'] as const,
  userAchievements: (userId?: string) => [...leaderboardQueryKeys.achievements(), userId || 'me'] as const,
  achievementProgress: (id: string) => [...leaderboardQueryKeys.achievements(), 'progress', id] as const,
  level: () => [...leaderboardQueryKeys.all, 'level'] as const,
  streak: () => [...leaderboardQueryKeys.all, 'streak'] as const,
  events: () => [...leaderboardQueryKeys.all, 'events'] as const,
};

/**
 * Hook to fetch leaderboard entries
 */
export function useLeaderboard(
  period: LeaderboardPeriod = 'weekly',
  limit: number = 20,
  options?: Partial<UseQueryOptions<ApiResponse<LeaderboardEntry[]>>>
) {
  return useQuery({
    queryKey: leaderboardQueryKeys.list(period),
    queryFn: () => leaderboardService.getLeaderboard(period, limit),
    staleTime: 60000, // 1 minute
    ...options,
  });
}

/**
 * Hook to fetch top cleaners
 */
export function useTopCleaners(
  period: LeaderboardPeriod = 'weekly',
  options?: Partial<UseQueryOptions<ApiResponse<LeaderboardEntry[]>>>
) {
  return useQuery({
    queryKey: leaderboardQueryKeys.top(period),
    queryFn: () => leaderboardService.getTopCleaners(period),
    staleTime: 60000,
    ...options,
  });
}

/**
 * Hook to fetch current user's ranking
 */
export function useCurrentUserRanking(
  period: LeaderboardPeriod = 'weekly',
  options?: Partial<UseQueryOptions<ApiResponse<UserRanking>>>
) {
  return useQuery({
    queryKey: leaderboardQueryKeys.currentUser(period),
    queryFn: () => leaderboardService.getCurrentUserRanking(period),
    staleTime: 30000, // 30 seconds
    ...options,
  });
}

/**
 * Hook to fetch all achievements
 */
export function useAchievements(
  options?: Partial<UseQueryOptions<ApiResponse<Achievement[]>>>
) {
  return useQuery({
    queryKey: leaderboardQueryKeys.achievements(),
    queryFn: () => leaderboardService.getAchievements(),
    staleTime: 300000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to fetch user's achievements
 */
export function useUserAchievements(
  userId?: string,
  options?: Partial<UseQueryOptions<ApiResponse<Achievement[]>>>
) {
  return useQuery({
    queryKey: leaderboardQueryKeys.userAchievements(userId),
    queryFn: () => leaderboardService.getUserAchievements(userId),
    staleTime: 60000,
    ...options,
  });
}

/**
 * Hook to fetch achievement progress
 */
export function useAchievementProgress(
  achievementId: string,
  options?: Partial<UseQueryOptions<ApiResponse<{
    achievement: Achievement;
    currentProgress: number;
    remainingProgress: number;
    estimatedCompletion?: string;
  }>>>
) {
  return useQuery({
    queryKey: leaderboardQueryKeys.achievementProgress(achievementId),
    queryFn: () => leaderboardService.getAchievementProgress(achievementId),
    staleTime: 60000,
    enabled: !!achievementId,
    ...options,
  });
}

/**
 * Hook to fetch level info
 */
export function useLevelInfo(
  options?: Partial<UseQueryOptions<ApiResponse<{
    level: number;
    currentXp: number;
    xpToNextLevel: number;
    totalXpEarned: number;
    levelRewards: string[];
    nextLevelRewards: string[];
  }>>>
) {
  return useQuery({
    queryKey: leaderboardQueryKeys.level(),
    queryFn: () => leaderboardService.getLevelInfo(),
    staleTime: 60000,
    ...options,
  });
}

/**
 * Hook to fetch streak info
 */
export function useStreakInfo(
  options?: Partial<UseQueryOptions<ApiResponse<{
    currentStreak: number;
    longestStreak: number;
    streakProtected: boolean;
    protectionEnds?: string;
    nextMilestone: number;
    milestoneReward: number;
  }>>>
) {
  return useQuery({
    queryKey: leaderboardQueryKeys.streak(),
    queryFn: () => leaderboardService.getStreakInfo(),
    staleTime: 60000,
    ...options,
  });
}

/**
 * Hook to fetch active events
 */
export function useActiveEvents(
  options?: Partial<UseQueryOptions<ApiResponse<{
    id: string;
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    rewards: string[];
    participantCount: number;
  }[]>>>
) {
  return useQuery({
    queryKey: leaderboardQueryKeys.events(),
    queryFn: () => leaderboardService.getActiveEvents(),
    staleTime: 300000, // 5 minutes
    ...options,
  });
}

// ============= MUTATIONS =============

/**
 * Hook to claim an achievement
 */
export function useClaimAchievement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (achievementId: string) =>
      leaderboardService.claimAchievement(achievementId),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: leaderboardQueryKeys.achievements() });
      queryClient.invalidateQueries({ queryKey: leaderboardQueryKeys.level() });
      queryClient.invalidateQueries({ queryKey: leaderboardQueryKeys.currentUser('weekly') });
    },
  });
}

/**
 * Combined hook for leaderboard screen data
 * Fetches all necessary data in parallel
 */
export function useLeaderboardScreenData(period: LeaderboardPeriod = 'weekly') {
  const leaderboard = useLeaderboard(period);
  const currentUserRanking = useCurrentUserRanking(period);
  const achievements = useUserAchievements();
  const levelInfo = useLevelInfo();
  const streakInfo = useStreakInfo();

  const isLoading =
    leaderboard.isLoading ||
    currentUserRanking.isLoading ||
    achievements.isLoading ||
    levelInfo.isLoading ||
    streakInfo.isLoading;

  const isError =
    leaderboard.isError ||
    currentUserRanking.isError ||
    achievements.isError ||
    levelInfo.isError ||
    streakInfo.isError;

  const refetch = async () => {
    await Promise.all([
      leaderboard.refetch(),
      currentUserRanking.refetch(),
      achievements.refetch(),
      levelInfo.refetch(),
      streakInfo.refetch(),
    ]);
  };

  return {
    leaderboard: leaderboard.data?.data || [],
    currentUserRanking: currentUserRanking.data?.data,
    achievements: achievements.data?.data || [],
    levelInfo: levelInfo.data?.data,
    streakInfo: streakInfo.data?.data,
    isLoading,
    isError,
    refetch,
  };
}
