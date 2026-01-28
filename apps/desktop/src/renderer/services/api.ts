/**
 * Right at Home BnB - API Service
 * Centralized API client with caching, retry logic, and offline support
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, Property, Booking, Guest, CleaningJob, DashboardStats } from '@shared/types';

// Cache configuration
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Queue for offline requests
interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  data?: unknown;
  timestamp: number;
}

const offlineQueue: QueuedRequest[] = [];

class ApiService {
  private client: AxiosInstance;
  private isOnline: boolean = navigator.onLine;
  private baseURL: string = 'https://api.rightathomebnb.com';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.setupOnlineListener();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // Add auth token if available
        const token = await this.getAuthToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request timestamp for logging
        (config as unknown as Record<string, unknown>).metadata = { startTime: Date.now() };

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor with retry logic
    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - ((response.config as unknown as Record<string, { startTime: number }>).metadata?.startTime || 0);
        console.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`);
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };

        if (!config) {
          return Promise.reject(error);
        }

        config._retryCount = config._retryCount || 0;

        // Retry on network errors or 5xx
        if (
          config._retryCount < MAX_RETRIES &&
          (!error.response || error.response.status >= 500)
        ) {
          config._retryCount += 1;
          console.log(`[API] Retrying request (${config._retryCount}/${MAX_RETRIES})`);
          await this.delay(RETRY_DELAY * config._retryCount);
          return this.client(config);
        }

        // Queue for offline if network error
        if (!error.response && !this.isOnline) {
          this.queueOfflineRequest(config);
        }

        return Promise.reject(error);
      }
    );
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[API] Back online - processing queue');
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[API] Offline mode activated');
    });
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await window.electronAPI.store.get<string>('authToken');
    } catch {
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getCacheKey(method: string, url: string, params?: unknown): string {
    return `${method}:${url}:${JSON.stringify(params || {})}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = cache.get(key) as CacheEntry<T> | undefined;
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return entry.data;
    }
    cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  private queueOfflineRequest(config: InternalAxiosRequestConfig): void {
    offlineQueue.push({
      id: crypto.randomUUID(),
      method: config.method || 'GET',
      url: config.url || '',
      data: config.data,
      timestamp: Date.now(),
    });
    console.log(`[API] Request queued for offline processing`);
  }

  private async processOfflineQueue(): Promise<void> {
    while (offlineQueue.length > 0) {
      const request = offlineQueue.shift();
      if (request) {
        try {
          await this.client.request({
            method: request.method,
            url: request.url,
            data: request.data,
          });
          console.log(`[API] Processed queued request: ${request.method} ${request.url}`);
        } catch (error) {
          console.error(`[API] Failed to process queued request`, error);
          // Re-queue if still offline
          if (!this.isOnline) {
            offlineQueue.unshift(request);
            break;
          }
        }
      }
    }
  }

  // API Methods
  async get<T>(url: string, params?: unknown, useCache: boolean = true): Promise<ApiResponse<T>> {
    const cacheKey = this.getCacheKey('GET', url, params);

    if (useCache) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }
    }

    try {
      const response = await this.client.get<ApiResponse<T>>(url, { params });
      if (response.data.success && response.data.data) {
        this.setCache(cacheKey, response.data.data);
      }
      return response.data;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async post<T>(url: string, data: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data);
      return response.data;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async put<T>(url: string, data: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data);
      return response.data;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url);
      return response.data;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  private handleError<T>(error: unknown): ApiResponse<T> {
    const axiosError = error as AxiosError<ApiResponse<T>>;
    const message = axiosError.response?.data?.error || axiosError.message || 'An error occurred';
    console.error('[API] Error:', message);
    return { success: false, error: message };
  }

  // Domain-specific methods
  async getProperties(): Promise<ApiResponse<Property[]>> {
    return this.get<Property[]>('/properties');
  }

  async getProperty(id: string): Promise<ApiResponse<Property>> {
    return this.get<Property>(`/properties/${id}`);
  }

  async createProperty(property: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Property>> {
    return this.post<Property>('/properties', property);
  }

  async updateProperty(id: string, property: Partial<Property>): Promise<ApiResponse<Property>> {
    return this.put<Property>(`/properties/${id}`, property);
  }

  async deleteProperty(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/properties/${id}`);
  }

  async getBookings(params?: { propertyId?: string; status?: string }): Promise<ApiResponse<Booking[]>> {
    return this.get<Booking[]>('/bookings', params);
  }

  async getGuests(): Promise<ApiResponse<Guest[]>> {
    return this.get<Guest[]>('/guests');
  }

  async getCleaningJobs(params?: { propertyId?: string; date?: string }): Promise<ApiResponse<CleaningJob[]>> {
    return this.get<CleaningJob[]>('/cleaning-jobs', params);
  }

  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    return this.get<DashboardStats>('/dashboard/stats', undefined, false);
  }

  // Clear all cache
  clearCache(): void {
    cache.clear();
  }

  // Set base URL (for different environments)
  setBaseURL(url: string): void {
    this.baseURL = url;
    this.client.defaults.baseURL = url;
  }
}

export const api = new ApiService();
