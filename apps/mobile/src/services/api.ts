/**
 * Right at Home BnB - API Service
 * Centralized API client for all backend communication
 * @author ECHO OMEGA PRIME
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, PaginatedResponse } from '../types';

// API Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.rah-midland.com';
const API_TIMEOUT = 30000; // 30 seconds

// Storage keys
const AUTH_TOKEN_KEY = '@RightAtHomeBnB:authToken';
const REFRESH_TOKEN_KEY = '@RightAtHomeBnB:refreshToken';

interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  requiresAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.loadTokens();
  }

  /**
   * Load auth tokens from storage
   */
  private async loadTokens(): Promise<void> {
    try {
      const [authToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(REFRESH_TOKEN_KEY),
      ]);
      this.authToken = authToken;
      this.refreshToken = refreshToken;
    } catch (error) {
      console.error('Failed to load auth tokens:', error);
    }
  }

  /**
   * Save auth tokens to storage
   */
  async setTokens(authToken: string, refreshToken: string): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, authToken),
        AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
      ]);
      this.authToken = authToken;
      this.refreshToken = refreshToken;
    } catch (error) {
      console.error('Failed to save auth tokens:', error);
      throw error;
    }
  }

  /**
   * Clear auth tokens (logout)
   */
  async clearTokens(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(AUTH_TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
      ]);
      this.authToken = null;
      this.refreshToken = null;
    } catch (error) {
      console.error('Failed to clear auth tokens:', error);
      throw error;
    }
  }

  /**
   * Get current auth token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  /**
   * Refresh the auth token using refresh token
   */
  private async refreshAuthToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        await this.clearTokens();
        return false;
      }

      const data = await response.json();
      if (data.authToken && data.refreshToken) {
        await this.setTokens(data.authToken, data.refreshToken);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Make an HTTP request with retry logic
   */
  private async request<T>(
    endpoint: string,
    config: RequestConfig
  ): Promise<ApiResponse<T>> {
    const {
      method,
      headers = {},
      body,
      timeout = API_TIMEOUT,
      requiresAuth = true,
    } = config;

    const url = `${this.baseUrl}${endpoint}`;

    // Build headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    };

    if (requiresAuth && this.authToken) {
      requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
    }

    // Build request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    requestOptions.signal = controller.signal;

    try {
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - try token refresh
      if (response.status === 401 && requiresAuth) {
        const refreshed = await this.refreshAuthToken();
        if (refreshed) {
          // Retry the request with new token
          requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
          const retryResponse = await fetch(url, {
            ...requestOptions,
            headers: requestHeaders,
          });
          const retryData = await retryResponse.json();
          return {
            success: retryResponse.ok,
            data: retryResponse.ok ? retryData : undefined,
            error: !retryResponse.ok ? retryData.message || 'Request failed' : undefined,
          };
        }
        return {
          success: false,
          error: 'Authentication expired. Please login again.',
        };
      }

      const data = await response.json();

      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: !response.ok ? data.message || 'Request failed' : undefined,
        message: data.message,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timed out. Please try again.',
          };
        }
        return {
          success: false,
          error: error.message || 'Network error. Please check your connection.',
        };
      }

      return {
        success: false,
        error: 'An unexpected error occurred.',
      };
    }
  }

  // Public HTTP methods
  async get<T>(endpoint: string, requiresAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', requiresAuth });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    requiresAuth = true
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, requiresAuth });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    requiresAuth = true
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, requiresAuth });
  }

  async patch<T>(
    endpoint: string,
    body?: unknown,
    requiresAuth = true
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body, requiresAuth });
  }

  async delete<T>(endpoint: string, requiresAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', requiresAuth });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };
