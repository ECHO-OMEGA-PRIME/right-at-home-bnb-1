/**
 * Right at Home BNB - Unified API Client
 * Used by all platforms for consistent API access
 */

import type {
  Property,
  Booking,
  Cleaner,
  Guest,
  CleaningJob,
  CleaningReport,
  Message,
  SmartLock,
  Thermostat,
  Transaction,
  FinancialSummary,
  Notification,
  AppSettings,
  ApiResponse,
  PaginatedResponse
} from '../types';

// API base URL - configurable per platform
const getBaseUrl = (): string => {
  // Next.js (web)
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // Expo (mobile)
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Vite/Electron (desktop)
  if (typeof process !== 'undefined' && process.env.VITE_API_URL) {
    return process.env.VITE_API_URL;
  }
  // Default to production
  return 'https://rightathome.vercel.app/api';
};

class RightAtHomeAPI {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getBaseUrl();
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  clearAuthToken(): void {
    this.authToken = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options.headers
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`
        };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // ============================================
  // PROPERTIES
  // ============================================

  async getProperties(): Promise<ApiResponse<Property[]>> {
    return this.request('/properties');
  }

  async getProperty(id: string): Promise<ApiResponse<Property>> {
    return this.request(`/properties/${id}`);
  }

  async createProperty(property: Partial<Property>): Promise<ApiResponse<Property>> {
    return this.request('/properties', {
      method: 'POST',
      body: JSON.stringify(property)
    });
  }

  async updateProperty(id: string, updates: Partial<Property>): Promise<ApiResponse<Property>> {
    return this.request(`/properties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  // ============================================
  // BOOKINGS
  // ============================================

  async getBookings(propertyId?: string): Promise<ApiResponse<Booking[]>> {
    const query = propertyId ? `?propertyId=${propertyId}` : '';
    return this.request(`/bookings${query}`);
  }

  async getBooking(id: string): Promise<ApiResponse<Booking>> {
    return this.request(`/bookings/${id}`);
  }

  async createBooking(booking: Partial<Booking>): Promise<ApiResponse<Booking>> {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(booking)
    });
  }

  async updateBooking(id: string, updates: Partial<Booking>): Promise<ApiResponse<Booking>> {
    return this.request(`/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  // ============================================
  // CLEANING
  // ============================================

  async getCleaningJobs(filters?: {
    propertyId?: string;
    cleanerId?: string;
    status?: string;
    date?: string;
  }): Promise<ApiResponse<CleaningJob[]>> {
    const params = new URLSearchParams(filters as Record<string, string>);
    return this.request(`/cleaning?${params}`);
  }

  async getCleaningJob(id: string): Promise<ApiResponse<CleaningJob>> {
    return this.request(`/cleaning/${id}`);
  }

  async assignCleaningJob(jobId: string, cleanerId: string): Promise<ApiResponse<CleaningJob>> {
    return this.request(`/cleaning/${jobId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ cleanerId })
    });
  }

  async checkInCleaning(jobId: string, location: { lat: number; lng: number }): Promise<ApiResponse<CleaningJob>> {
    return this.request(`/cleaning/${jobId}/checkin`, {
      method: 'POST',
      body: JSON.stringify({ location })
    });
  }

  async submitCleaningReport(jobId: string, report: Partial<CleaningReport>): Promise<ApiResponse<CleaningReport>> {
    return this.request(`/cleaning/${jobId}/report`, {
      method: 'POST',
      body: JSON.stringify(report)
    });
  }

  // ============================================
  // CLEANERS
  // ============================================

  async getCleaners(): Promise<ApiResponse<Cleaner[]>> {
    return this.request('/cleaners');
  }

  async getCleaner(id: string): Promise<ApiResponse<Cleaner>> {
    return this.request(`/cleaners/${id}`);
  }

  async updateCleanerLocation(id: string, location: { lat: number; lng: number }): Promise<ApiResponse<void>> {
    return this.request(`/cleaners/${id}/location`, {
      method: 'POST',
      body: JSON.stringify(location)
    });
  }

  // ============================================
  // GUESTS
  // ============================================

  async getGuests(): Promise<ApiResponse<Guest[]>> {
    return this.request('/guests');
  }

  async getGuest(id: string): Promise<ApiResponse<Guest>> {
    return this.request(`/guests/${id}`);
  }

  async createGuest(guest: Partial<Guest>): Promise<ApiResponse<Guest>> {
    return this.request('/guests', {
      method: 'POST',
      body: JSON.stringify(guest)
    });
  }

  // ============================================
  // MESSAGES
  // ============================================

  async getMessages(guestId: string): Promise<ApiResponse<Message[]>> {
    return this.request(`/messages?guestId=${guestId}`);
  }

  async sendMessage(guestId: string, content: string): Promise<ApiResponse<Message>> {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({ guestId, content, fromHost: true })
    });
  }

  // ============================================
  // SMART HOME
  // ============================================

  async getSmartLocks(propertyId?: string): Promise<ApiResponse<SmartLock[]>> {
    const query = propertyId ? `?propertyId=${propertyId}` : '';
    return this.request(`/smart-home/locks${query}`);
  }

  async controlLock(lockId: string, action: 'lock' | 'unlock'): Promise<ApiResponse<SmartLock>> {
    return this.request(`/smart-home/locks/${lockId}/${action}`, {
      method: 'POST'
    });
  }

  async createAccessCode(lockId: string, code: {
    code: string;
    name: string;
    type: 'guest' | 'cleaner';
    validFrom?: Date;
    validUntil?: Date;
  }): Promise<ApiResponse<{ id: string }>> {
    return this.request(`/smart-home/locks/${lockId}/codes`, {
      method: 'POST',
      body: JSON.stringify(code)
    });
  }

  async getThermostats(propertyId?: string): Promise<ApiResponse<Thermostat[]>> {
    const query = propertyId ? `?propertyId=${propertyId}` : '';
    return this.request(`/smart-home/thermostats${query}`);
  }

  async setThermostat(thermostatId: string, settings: {
    targetTemp?: number;
    mode?: 'heat' | 'cool' | 'auto' | 'off';
  }): Promise<ApiResponse<Thermostat>> {
    return this.request(`/smart-home/thermostats/${thermostatId}`, {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
  }

  // ============================================
  // FINANCE
  // ============================================

  async getTransactions(filters?: {
    propertyId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<Transaction[]>> {
    const params = new URLSearchParams(filters as Record<string, string>);
    return this.request(`/finance/transactions?${params}`);
  }

  async getFinancialSummary(period: 'week' | 'month' | 'year'): Promise<ApiResponse<FinancialSummary>> {
    return this.request(`/finance/summary?period=${period}`);
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  async getNotifications(): Promise<ApiResponse<Notification[]>> {
    return this.request('/notifications');
  }

  async markNotificationRead(id: string): Promise<ApiResponse<void>> {
    return this.request(`/notifications/${id}/read`, { method: 'POST' });
  }

  // ============================================
  // SETTINGS
  // ============================================

  async getSettings(): Promise<ApiResponse<AppSettings>> {
    return this.request('/settings');
  }

  async updateSettings(settings: Partial<AppSettings>): Promise<ApiResponse<AppSettings>> {
    return this.request('/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
  }

  // ============================================
  // AI CONCIERGE
  // ============================================

  async askConcierge(question: string, context?: {
    propertyId?: string;
    guestId?: string;
    bookingId?: string;
  }): Promise<ApiResponse<{ answer: string; suggestions?: string[] }>> {
    return this.request('/concierge', {
      method: 'POST',
      body: JSON.stringify({ question, ...context })
    });
  }

  // ============================================
  // CALENDAR SYNC
  // ============================================

  async syncAirbnbCalendar(propertyId: string, icalUrl: string): Promise<ApiResponse<{ synced: number }>> {
    return this.request(`/ical/${propertyId}/sync`, {
      method: 'POST',
      body: JSON.stringify({ source: 'airbnb', url: icalUrl })
    });
  }

  async syncVrboCalendar(propertyId: string, icalUrl: string): Promise<ApiResponse<{ synced: number }>> {
    return this.request(`/ical/${propertyId}/sync`, {
      method: 'POST',
      body: JSON.stringify({ source: 'vrbo', url: icalUrl })
    });
  }
}

// Export singleton instance
export const api = new RightAtHomeAPI();

// Export class for custom instances
export { RightAtHomeAPI };

export default api;
