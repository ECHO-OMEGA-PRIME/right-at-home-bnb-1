/**
 * Right at Home BnB - Jobs Service
 * Handles all job-related API operations
 * @author ECHO OMEGA PRIME
 */

import { apiClient } from './api';
import {
  Job,
  JobSummary,
  JobStatus,
  ChecklistItem,
  Photo,
  ApiResponse,
  PaginatedResponse,
  LocationCheckResult,
} from '../types';

// Job filters
export interface JobFilters {
  status?: JobStatus | 'all';
  date?: string; // ISO date string
  startDate?: string;
  endDate?: string;
  propertyId?: string;
}

// Job completion data
export interface JobCompletionData {
  checkOutTime: string;
  checklist: ChecklistItem[];
  photos: Photo[];
  notes?: string;
  signature?: string;
}

// Check-in data
export interface CheckInData {
  jobId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

// Photo upload response
export interface PhotoUploadResponse {
  photoId: string;
  url: string;
  thumbnailUrl: string;
}

/**
 * Jobs Service - All job-related API operations
 */
class JobsService {
  /**
   * Get all jobs with optional filters
   */
  async getJobs(filters?: JobFilters): Promise<ApiResponse<JobSummary[]>> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.date) {
        params.append('date', filters.date);
      }
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters.propertyId) {
        params.append('propertyId', filters.propertyId);
      }
    }

    const queryString = params.toString();
    const endpoint = `/jobs${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<JobSummary[]>(endpoint);
  }

  /**
   * Get paginated jobs
   */
  async getJobsPaginated(
    page: number = 1,
    pageSize: number = 20,
    filters?: JobFilters
  ): Promise<PaginatedResponse<JobSummary>> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());

    if (filters) {
      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.date) {
        params.append('date', filters.date);
      }
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters.propertyId) {
        params.append('propertyId', filters.propertyId);
      }
    }

    const response = await apiClient.get<PaginatedResponse<JobSummary>>(
      `/jobs?${params.toString()}`
    );

    return {
      success: response.success,
      data: response.data?.data,
      page: response.data?.page || page,
      pageSize: response.data?.pageSize || pageSize,
      totalPages: response.data?.totalPages || 0,
      totalItems: response.data?.totalItems || 0,
      error: response.error,
    };
  }

  /**
   * Get today's jobs
   */
  async getTodaysJobs(): Promise<ApiResponse<JobSummary[]>> {
    const today = new Date().toISOString().split('T')[0];
    return this.getJobs({ date: today });
  }

  /**
   * Get upcoming jobs (next 7 days)
   */
  async getUpcomingJobs(): Promise<ApiResponse<JobSummary[]>> {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return this.getJobs({
      startDate: today.toISOString().split('T')[0],
      endDate: nextWeek.toISOString().split('T')[0],
    });
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<JobSummary[]>> {
    return this.getJobs({
      status: 'completed',
      startDate,
      endDate,
    });
  }

  /**
   * Get urgent jobs
   */
  async getUrgentJobs(): Promise<ApiResponse<JobSummary[]>> {
    return this.getJobs({ status: 'urgent' });
  }

  /**
   * Get a single job by ID with full details
   */
  async getJob(jobId: string): Promise<ApiResponse<Job>> {
    return apiClient.get<Job>(`/jobs/${jobId}`);
  }

  /**
   * Get next upcoming job
   */
  async getNextJob(): Promise<ApiResponse<JobSummary | null>> {
    const response = await apiClient.get<JobSummary>('/jobs/next');
    return {
      ...response,
      data: response.success ? response.data : null,
    };
  }

  /**
   * GPS Check-in for a job
   */
  async checkIn(data: CheckInData): Promise<ApiResponse<LocationCheckResult>> {
    return apiClient.post<LocationCheckResult>(`/jobs/${data.jobId}/check-in`, {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
      timestamp: data.timestamp,
    });
  }

  /**
   * Check-out from a job
   */
  async checkOut(
    jobId: string,
    completionData: JobCompletionData
  ): Promise<ApiResponse<Job>> {
    return apiClient.post<Job>(`/jobs/${jobId}/check-out`, completionData);
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: JobStatus
  ): Promise<ApiResponse<Job>> {
    return apiClient.patch<Job>(`/jobs/${jobId}/status`, { status });
  }

  /**
   * Start a job (set to in_progress)
   */
  async startJob(jobId: string): Promise<ApiResponse<Job>> {
    return this.updateJobStatus(jobId, 'in_progress');
  }

  /**
   * Complete a job
   */
  async completeJob(jobId: string): Promise<ApiResponse<Job>> {
    return this.updateJobStatus(jobId, 'completed');
  }

  /**
   * Get checklist for a job
   */
  async getChecklist(jobId: string): Promise<ApiResponse<ChecklistItem[]>> {
    return apiClient.get<ChecklistItem[]>(`/jobs/${jobId}/checklist`);
  }

  /**
   * Update a checklist item
   */
  async updateChecklistItem(
    jobId: string,
    itemId: string,
    completed: boolean,
    photoUri?: string,
    notes?: string
  ): Promise<ApiResponse<ChecklistItem>> {
    return apiClient.patch<ChecklistItem>(
      `/jobs/${jobId}/checklist/${itemId}`,
      {
        completed,
        photoUri,
        notes,
        completedAt: completed ? new Date().toISOString() : undefined,
      }
    );
  }

  /**
   * Toggle checklist item completion
   */
  async toggleChecklistItem(
    jobId: string,
    itemId: string,
    currentState: boolean
  ): Promise<ApiResponse<ChecklistItem>> {
    return this.updateChecklistItem(jobId, itemId, !currentState);
  }

  /**
   * Bulk update checklist items
   */
  async bulkUpdateChecklist(
    jobId: string,
    items: Array<{
      id: string;
      completed: boolean;
      photoUri?: string;
      notes?: string;
    }>
  ): Promise<ApiResponse<ChecklistItem[]>> {
    return apiClient.patch<ChecklistItem[]>(`/jobs/${jobId}/checklist`, {
      items,
    });
  }

  /**
   * Get photos for a job
   */
  async getPhotos(jobId: string): Promise<ApiResponse<Photo[]>> {
    return apiClient.get<Photo[]>(`/jobs/${jobId}/photos`);
  }

  /**
   * Upload a photo for a job
   */
  async uploadPhoto(
    jobId: string,
    uri: string,
    area?: string,
    taskId?: string,
    notes?: string
  ): Promise<ApiResponse<PhotoUploadResponse>> {
    // For actual implementation, this would use FormData
    // and a different content type for file upload
    return apiClient.post<PhotoUploadResponse>(`/jobs/${jobId}/photos`, {
      uri,
      area,
      taskId,
      notes,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Delete a photo
   */
  async deletePhoto(jobId: string, photoId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/jobs/${jobId}/photos/${photoId}`);
  }

  /**
   * Get job statistics for current user
   */
  async getJobStats(
    period: 'today' | 'week' | 'month' | 'all' = 'month'
  ): Promise<
    ApiResponse<{
      totalJobs: number;
      completedJobs: number;
      avgScore: number;
      totalEarnings: number;
      onTimeRate: number;
    }>
  > {
    return apiClient.get(`/jobs/stats?period=${period}`);
  }

  /**
   * Get job history with pagination
   */
  async getJobHistory(
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResponse<JobSummary>> {
    return this.getJobsPaginated(page, pageSize, { status: 'completed' });
  }

  /**
   * Search jobs by property name or address
   */
  async searchJobs(query: string): Promise<ApiResponse<JobSummary[]>> {
    const encodedQuery = encodeURIComponent(query);
    return apiClient.get<JobSummary[]>(`/jobs/search?q=${encodedQuery}`);
  }

  /**
   * Accept an urgent job
   */
  async acceptUrgentJob(jobId: string): Promise<ApiResponse<Job>> {
    return apiClient.post<Job>(`/jobs/${jobId}/accept`);
  }

  /**
   * Decline a job (with reason)
   */
  async declineJob(
    jobId: string,
    reason: string
  ): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/jobs/${jobId}/decline`, { reason });
  }

  /**
   * Report an issue during a job
   */
  async reportIssue(
    jobId: string,
    issue: {
      category: 'maintenance' | 'supplies' | 'safety' | 'damage' | 'other';
      priority: 'low' | 'medium' | 'high' | 'urgent';
      title: string;
      description: string;
      photoUris?: string[];
    }
  ): Promise<ApiResponse<{ issueId: string }>> {
    return apiClient.post<{ issueId: string }>(`/jobs/${jobId}/issues`, issue);
  }

  /**
   * Get estimated earnings for a date range
   */
  async getEstimatedEarnings(
    startDate: string,
    endDate: string
  ): Promise<
    ApiResponse<{
      totalEstimated: number;
      jobCount: number;
      bonusEstimate: number;
    }>
  > {
    return apiClient.get(
      `/jobs/earnings/estimate?startDate=${startDate}&endDate=${endDate}`
    );
  }

  /**
   * Get ETA to a job location
   */
  async getETA(
    jobId: string,
    currentLat: number,
    currentLng: number
  ): Promise<
    ApiResponse<{
      etaMinutes: number;
      distanceMiles: number;
    }>
  > {
    return apiClient.get(
      `/jobs/${jobId}/eta?lat=${currentLat}&lng=${currentLng}`
    );
  }
}

// Export singleton instance
export const jobsService = new JobsService();

// Export class for testing
export { JobsService };
