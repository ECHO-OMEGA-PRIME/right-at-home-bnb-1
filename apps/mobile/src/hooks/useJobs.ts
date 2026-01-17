/**
 * Right at Home BnB - Jobs Hooks
 * React Query hooks for job data fetching and mutations
 * @author ECHO OMEGA PRIME
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { jobsService, JobFilters, JobCompletionData, CheckInData } from '../services/jobs';
import { Job, JobSummary, JobStatus, ChecklistItem, Photo, ApiResponse } from '../types';

// Query keys for cache management
export const jobsQueryKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobsQueryKeys.all, 'list'] as const,
  list: (filters?: JobFilters) => [...jobsQueryKeys.lists(), filters] as const,
  details: () => [...jobsQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobsQueryKeys.details(), id] as const,
  today: () => [...jobsQueryKeys.all, 'today'] as const,
  upcoming: () => [...jobsQueryKeys.all, 'upcoming'] as const,
  urgent: () => [...jobsQueryKeys.all, 'urgent'] as const,
  completed: () => [...jobsQueryKeys.all, 'completed'] as const,
  next: () => [...jobsQueryKeys.all, 'next'] as const,
  checklist: (jobId: string) => [...jobsQueryKeys.detail(jobId), 'checklist'] as const,
  photos: (jobId: string) => [...jobsQueryKeys.detail(jobId), 'photos'] as const,
  stats: (period?: string) => [...jobsQueryKeys.all, 'stats', period] as const,
};

/**
 * Hook to fetch jobs with optional filters
 */
export function useJobs(filters?: JobFilters, options?: Partial<UseQueryOptions<ApiResponse<JobSummary[]>>>) {
  return useQuery({
    queryKey: jobsQueryKeys.list(filters),
    queryFn: () => jobsService.getJobs(filters),
    staleTime: 30000, // 30 seconds
    ...options,
  });
}

/**
 * Hook to fetch today's jobs
 */
export function useTodaysJobs(options?: Partial<UseQueryOptions<ApiResponse<JobSummary[]>>>) {
  return useQuery({
    queryKey: jobsQueryKeys.today(),
    queryFn: () => jobsService.getTodaysJobs(),
    staleTime: 30000,
    ...options,
  });
}

/**
 * Hook to fetch upcoming jobs
 */
export function useUpcomingJobs(options?: Partial<UseQueryOptions<ApiResponse<JobSummary[]>>>) {
  return useQuery({
    queryKey: jobsQueryKeys.upcoming(),
    queryFn: () => jobsService.getUpcomingJobs(),
    staleTime: 60000, // 1 minute
    ...options,
  });
}

/**
 * Hook to fetch urgent jobs
 */
export function useUrgentJobs(options?: Partial<UseQueryOptions<ApiResponse<JobSummary[]>>>) {
  return useQuery({
    queryKey: jobsQueryKeys.urgent(),
    queryFn: () => jobsService.getUrgentJobs(),
    staleTime: 10000, // 10 seconds - refresh frequently
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    ...options,
  });
}

/**
 * Hook to fetch completed jobs
 */
export function useCompletedJobs(
  startDate?: string,
  endDate?: string,
  options?: Partial<UseQueryOptions<ApiResponse<JobSummary[]>>>
) {
  return useQuery({
    queryKey: [...jobsQueryKeys.completed(), startDate, endDate],
    queryFn: () => jobsService.getCompletedJobs(startDate, endDate),
    staleTime: 60000,
    ...options,
  });
}

/**
 * Hook to fetch next upcoming job
 */
export function useNextJob(options?: Partial<UseQueryOptions<ApiResponse<JobSummary | null>>>) {
  return useQuery({
    queryKey: jobsQueryKeys.next(),
    queryFn: () => jobsService.getNextJob(),
    staleTime: 30000,
    refetchInterval: 60000, // Auto-refresh every minute
    ...options,
  });
}

/**
 * Hook to fetch a single job by ID
 */
export function useJob(jobId: string, options?: Partial<UseQueryOptions<ApiResponse<Job>>>) {
  return useQuery({
    queryKey: jobsQueryKeys.detail(jobId),
    queryFn: () => jobsService.getJob(jobId),
    staleTime: 30000,
    enabled: !!jobId,
    ...options,
  });
}

/**
 * Hook to fetch job checklist
 */
export function useJobChecklist(
  jobId: string,
  options?: Partial<UseQueryOptions<ApiResponse<ChecklistItem[]>>>
) {
  return useQuery({
    queryKey: jobsQueryKeys.checklist(jobId),
    queryFn: () => jobsService.getChecklist(jobId),
    staleTime: 30000,
    enabled: !!jobId,
    ...options,
  });
}

/**
 * Hook to fetch job photos
 */
export function useJobPhotos(
  jobId: string,
  options?: Partial<UseQueryOptions<ApiResponse<Photo[]>>>
) {
  return useQuery({
    queryKey: jobsQueryKeys.photos(jobId),
    queryFn: () => jobsService.getPhotos(jobId),
    staleTime: 30000,
    enabled: !!jobId,
    ...options,
  });
}

/**
 * Hook to fetch job statistics
 */
export function useJobStats(
  period: 'today' | 'week' | 'month' | 'all' = 'month',
  options?: Partial<UseQueryOptions<ApiResponse<{
    totalJobs: number;
    completedJobs: number;
    avgScore: number;
    totalEarnings: number;
    onTimeRate: number;
  }>>>
) {
  return useQuery({
    queryKey: jobsQueryKeys.stats(period),
    queryFn: () => jobsService.getJobStats(period),
    staleTime: 60000,
    ...options,
  });
}

/**
 * Hook to search jobs
 */
export function useJobSearch(query: string, options?: Partial<UseQueryOptions<ApiResponse<JobSummary[]>>>) {
  return useQuery({
    queryKey: [...jobsQueryKeys.all, 'search', query],
    queryFn: () => jobsService.searchJobs(query),
    staleTime: 30000,
    enabled: query.length >= 2,
    ...options,
  });
}

// ============= MUTATIONS =============

/**
 * Hook to check in to a job
 */
export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CheckInData) => jobsService.checkIn(data),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.detail(variables.jobId) });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.today() });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
    },
  });
}

/**
 * Hook to check out from a job
 */
export function useCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: JobCompletionData }) =>
      jobsService.checkOut(jobId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.detail(variables.jobId) });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.today() });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.completed() });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.stats() });
    },
  });
}

/**
 * Hook to update job status
 */
export function useUpdateJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: JobStatus }) =>
      jobsService.updateJobStatus(jobId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.detail(variables.jobId) });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.today() });
      if (variables.status === 'completed') {
        queryClient.invalidateQueries({ queryKey: jobsQueryKeys.completed() });
        queryClient.invalidateQueries({ queryKey: jobsQueryKeys.stats() });
      }
    },
  });
}

/**
 * Hook to start a job
 */
export function useStartJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => jobsService.startJob(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.today() });
    },
  });
}

/**
 * Hook to complete a job
 */
export function useCompleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => jobsService.completeJob(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.today() });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.completed() });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.stats() });
    },
  });
}

/**
 * Hook to toggle checklist item
 */
export function useToggleChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      jobId,
      itemId,
      currentState,
    }: {
      jobId: string;
      itemId: string;
      currentState: boolean;
    }) => jobsService.toggleChecklistItem(jobId, itemId, currentState),
    onMutate: async ({ jobId, itemId, currentState }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: jobsQueryKeys.checklist(jobId) });

      // Get current data
      const previousData = queryClient.getQueryData<ApiResponse<ChecklistItem[]>>(
        jobsQueryKeys.checklist(jobId)
      );

      // Optimistically update
      if (previousData?.data) {
        queryClient.setQueryData<ApiResponse<ChecklistItem[]>>(
          jobsQueryKeys.checklist(jobId),
          {
            ...previousData,
            data: previousData.data.map((item) =>
              item.id === itemId
                ? { ...item, completed: !currentState, completedAt: !currentState ? new Date().toISOString() : undefined }
                : item
            ),
          }
        );
      }

      return { previousData };
    },
    onError: (_, { jobId }, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(jobsQueryKeys.checklist(jobId), context.previousData);
      }
    },
    onSettled: (_, __, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.checklist(jobId) });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.detail(jobId) });
    },
  });
}

/**
 * Hook to update checklist item with photo
 */
export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      jobId,
      itemId,
      completed,
      photoUri,
      notes,
    }: {
      jobId: string;
      itemId: string;
      completed: boolean;
      photoUri?: string;
      notes?: string;
    }) => jobsService.updateChecklistItem(jobId, itemId, completed, photoUri, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.checklist(variables.jobId) });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.detail(variables.jobId) });
    },
  });
}

/**
 * Hook to upload a photo
 */
export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      jobId,
      uri,
      area,
      taskId,
      notes,
    }: {
      jobId: string;
      uri: string;
      area?: string;
      taskId?: string;
      notes?: string;
    }) => jobsService.uploadPhoto(jobId, uri, area, taskId, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.photos(variables.jobId) });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.detail(variables.jobId) });
    },
  });
}

/**
 * Hook to delete a photo
 */
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, photoId }: { jobId: string; photoId: string }) =>
      jobsService.deletePhoto(jobId, photoId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.photos(variables.jobId) });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.detail(variables.jobId) });
    },
  });
}

/**
 * Hook to accept an urgent job
 */
export function useAcceptUrgentJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => jobsService.acceptUrgentJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.urgent() });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.today() });
    },
  });
}

/**
 * Hook to decline a job
 */
export function useDeclineJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason: string }) =>
      jobsService.declineJob(jobId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.today() });
    },
  });
}

/**
 * Hook to report an issue
 */
export function useReportIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      jobId,
      issue,
    }: {
      jobId: string;
      issue: {
        category: 'maintenance' | 'supplies' | 'safety' | 'damage' | 'other';
        priority: 'low' | 'medium' | 'high' | 'urgent';
        title: string;
        description: string;
        photoUris?: string[];
      };
    }) => jobsService.reportIssue(jobId, issue),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.detail(variables.jobId) });
    },
  });
}

/**
 * Hook to get ETA to job location
 */
export function useJobETA(
  jobId: string,
  currentLat: number | null,
  currentLng: number | null,
  options?: Partial<UseQueryOptions<ApiResponse<{ etaMinutes: number; distanceMiles: number }>>>
) {
  return useQuery({
    queryKey: [...jobsQueryKeys.detail(jobId), 'eta', currentLat, currentLng],
    queryFn: () => jobsService.getETA(jobId, currentLat!, currentLng!),
    staleTime: 60000,
    enabled: !!jobId && currentLat !== null && currentLng !== null,
    refetchInterval: 120000, // Refresh every 2 minutes
    ...options,
  });
}
