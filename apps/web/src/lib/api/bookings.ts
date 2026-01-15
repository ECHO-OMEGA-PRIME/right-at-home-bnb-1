/**
 * Bookings API Client
 * Right at Home BnB - Calendar Sync & Booking Management
 *
 * ECHO OMEGA PRIME | Made by Commander Bobby Don McWilliams II
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================================================
// TYPES
// ============================================================================

export type BookingPlatform = 'airbnb' | 'vrbo' | 'booking' | 'direct' | 'other';
export type SyncStatusType = 'pending' | 'in_progress' | 'success' | 'failed' | 'partial';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  platform: BookingPlatform;
  guestName: string | null;
  guestCount: number;
  confirmationCode: string | null;
  totalPrice: number | null;
  color: string;
}

export interface BookingResponse {
  uid: string;
  summary: string;
  start_date: string;
  end_date: string;
  platform: string;
  confirmation_code: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  num_guests: number;
  total_price: number | null;
  nights: number;
  special_requests: string | null;
}

export interface SyncResult {
  property_id: string;
  platform: string;
  status: SyncStatusType;
  bookings_found: number;
  bookings_new: number;
  bookings_updated: number;
  bookings_removed: number;
  conflicts_detected: number;
  error_message: string | null;
  sync_duration_seconds: number;
  synced_at: string;
}

export interface CalendarFeed {
  property_id: string;
  platform: string;
  url: string;
  enabled: boolean;
  last_sync: string | null;
  last_status: string;
  last_error: string | null;
}

export interface BookingConflict {
  property_id: string;
  booking1_uid: string;
  booking1_platform: string;
  booking1_start: string;
  booking1_end: string;
  booking2_uid: string;
  booking2_platform: string;
  booking2_start: string;
  booking2_end: string;
  overlap_start: string;
  overlap_end: string;
  overlap_days: number;
  detected_at: string;
}

export interface CalendarDataResponse {
  month: number;
  year: number;
  events: CalendarEvent[];
  totalBookings: number;
  generatedAt: string;
}

export interface BookingStats {
  period_days: number;
  total_bookings: number;
  by_platform: Record<string, number>;
  total_nights: number;
  average_nights: number;
  total_revenue: number;
  upcoming_count: number;
  conflicts_count: number;
  generated_at: string;
}

// ============================================================================
// API CLIENT CLASS
// ============================================================================

class BookingsAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ==========================================================================
  // BOOKINGS
  // ==========================================================================

  /**
   * List all bookings with optional filters
   */
  async listBookings(params?: {
    property_id?: string;
    platform?: BookingPlatform;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<BookingResponse[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request(`/api/bookings${query ? `?${query}` : ''}`);
  }

  /**
   * Get bookings for a specific property
   */
  async getPropertyBookings(
    propertyId: string,
    params?: { platform?: BookingPlatform; include_past?: boolean }
  ): Promise<BookingResponse[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request(`/api/bookings/property/${propertyId}${query ? `?${query}` : ''}`);
  }

  /**
   * Get a specific booking by UID
   */
  async getBooking(propertyId: string, uid: string): Promise<BookingResponse> {
    return this.request(`/api/bookings/booking/${propertyId}/${uid}`);
  }

  /**
   * Get upcoming bookings (next N days)
   */
  async getUpcomingBookings(params?: {
    property_id?: string;
    days?: number;
  }): Promise<BookingResponse[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request(`/api/bookings/upcoming${query ? `?${query}` : ''}`);
  }

  // ==========================================================================
  // CALENDAR
  // ==========================================================================

  /**
   * Get calendar data for a specific month
   */
  async getCalendarData(params?: {
    property_id?: string;
    month?: number;
    year?: number;
  }): Promise<CalendarDataResponse> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request(`/api/bookings/calendar${query ? `?${query}` : ''}`);
  }

  // ==========================================================================
  // SYNC
  // ==========================================================================

  /**
   * Trigger a calendar sync
   */
  async triggerSync(params?: {
    property_id?: string;
    platform?: BookingPlatform;
  }): Promise<Record<string, SyncResult[]>> {
    return this.request('/api/bookings/sync', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }

  /**
   * Get sync status for all feeds
   */
  async getSyncStatus(propertyId?: string): Promise<Record<string, Record<string, SyncResult>>> {
    const query = propertyId ? `?property_id=${propertyId}` : '';
    return this.request(`/api/bookings/sync/status${query}`);
  }

  // ==========================================================================
  // CONFLICTS
  // ==========================================================================

  /**
   * Get booking conflicts
   */
  async getConflicts(propertyId?: string): Promise<BookingConflict[]> {
    const query = propertyId ? `?property_id=${propertyId}` : '';
    return this.request(`/api/bookings/conflicts${query}`);
  }

  // ==========================================================================
  // FEEDS
  // ==========================================================================

  /**
   * List all calendar feeds
   */
  async listFeeds(propertyId?: string): Promise<Record<string, CalendarFeed[]>> {
    const query = propertyId ? `?property_id=${propertyId}` : '';
    return this.request(`/api/bookings/feeds${query}`);
  }

  /**
   * Add a new calendar feed
   */
  async addFeed(params: {
    property_id: string;
    platform: BookingPlatform;
    url: string;
  }): Promise<CalendarFeed> {
    return this.request('/api/bookings/feeds', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Remove a calendar feed
   */
  async removeFeed(propertyId: string, platform: BookingPlatform): Promise<void> {
    return this.request(`/api/bookings/feeds/${propertyId}/${platform}`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  /**
   * Get booking statistics
   */
  async getStats(params?: {
    property_id?: string;
    days?: number;
  }): Promise<BookingStats> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return this.request(`/api/bookings/stats${query ? `?${query}` : ''}`);
  }

  // ==========================================================================
  // HEALTH
  // ==========================================================================

  /**
   * Check bookings system health
   */
  async checkHealth(): Promise<{
    status: string;
    total_properties: number;
    total_feeds: number;
    failed_syncs: number;
    active_conflicts: number;
    scheduler_running: boolean;
    timestamp: string;
  }> {
    return this.request('/api/bookings/health');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const bookingsApi = new BookingsAPI();

// ============================================================================
// REACT QUERY HOOKS (for future use with @tanstack/react-query)
// ============================================================================

export const QUERY_KEYS = {
  bookings: ['bookings'] as const,
  propertyBookings: (propertyId: string) => ['bookings', 'property', propertyId] as const,
  booking: (propertyId: string, uid: string) => ['bookings', propertyId, uid] as const,
  upcoming: ['bookings', 'upcoming'] as const,
  calendar: (month: number, year: number) => ['bookings', 'calendar', month, year] as const,
  syncStatus: ['bookings', 'sync', 'status'] as const,
  conflicts: ['bookings', 'conflicts'] as const,
  feeds: ['bookings', 'feeds'] as const,
  stats: ['bookings', 'stats'] as const,
  health: ['bookings', 'health'] as const,
};

// ============================================================================
// PLATFORM UTILITIES
// ============================================================================

export const PLATFORM_COLORS: Record<BookingPlatform, string> = {
  airbnb: '#FF5A5F',
  vrbo: '#3B5998',
  booking: '#003580',
  direct: '#10B981',
  other: '#8B5CF6',
};

export const PLATFORM_NAMES: Record<BookingPlatform, string> = {
  airbnb: 'Airbnb',
  vrbo: 'VRBO',
  booking: 'Booking.com',
  direct: 'Direct',
  other: 'Other',
};

export const PLATFORM_ICAL_HELP: Record<BookingPlatform, string> = {
  airbnb: 'Go to Hosting > Calendar > Availability Settings > Export Calendar',
  vrbo: 'Go to Calendar > Import/Export > Export Calendar',
  booking: 'Go to Property > Rates & Availability > Calendar Sync',
  direct: 'Enter your custom iCal URL',
  other: 'Enter the iCal feed URL from your booking platform',
};
