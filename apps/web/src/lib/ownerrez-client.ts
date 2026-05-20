/**
 * Right at Home BnB - OwnerRez API Client
 * Full integration with OwnerRez v2 REST API
 * @author ECHO OMEGA PRIME
 * @see https://api.ownerreservations.com/help/v2
 */

const OWNERREZ_API_BASE = 'https://api.ownerrez.com/v2';

// ============================================================================
// TYPES
// ============================================================================

export interface OwnerRezConfig {
  email: string;
  apiToken: string;
}

export interface OwnerRezProperty {
  id: number;
  name: string;
  internal_name?: string;
  address?: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  bedrooms?: number;
  bathrooms?: number;
  max_guests?: number;
  check_in_time?: string;
  check_out_time?: string;
  currency?: string;
  active: boolean;
  created_utc: string;
  modified_utc: string;
}

export interface OwnerRezBooking {
  id: number;
  property_id: number;
  guest_id: number;
  arrival: string;
  departure: string;
  status: 'booked' | 'inquired' | 'blocked' | 'cancelled' | 'declined';
  adults: number;
  children: number;
  pets: number;
  total_amount: number;
  total_paid: number;
  balance_due: number;
  currency: string;
  source?: string;
  confirmation_code?: string;
  guest?: OwnerRezGuest;
  created_utc: string;
  modified_utc: string;
}

export interface OwnerRezGuest {
  id: number;
  first_name: string;
  last_name: string;
  email_addresses?: Array<{ email_address: string; type: string }>;
  phones?: Array<{ phone_number: string; type: string }>;
  addresses?: Array<{
    street1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  }>;
  created_utc: string;
  modified_utc: string;
}

export interface OwnerRezQuote {
  id: number;
  property_id: number;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  pets: number;
  total_amount: number;
  currency: string;
  line_items: Array<{
    description: string;
    amount: number;
    type: string;
  }>;
  status: string;
  expires_utc?: string;
  created_utc: string;
}

export interface OwnerRezListing {
  id: number;
  property_id: number;
  headline: string;
  description: string;
  photos: Array<{
    url: string;
    caption?: string;
    sort_order: number;
  }>;
  amenities: string[];
  bedrooms: Array<{
    name: string;
    beds: Array<{ type: string; count: number }>;
  }>;
}

export interface OwnerRezWebhookEvent {
  id: string;
  category: string;
  action: 'entity_update' | 'entity_delete';
  entity_type: string;
  entity_id: number;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ============================================================================
// CLIENT
// ============================================================================

export class OwnerRezClient {
  private email: string;
  private token: string;
  private headers: Record<string, string>;

  constructor(config?: OwnerRezConfig) {
    this.email = config?.email || process.env.OWNERREZ_EMAIL || '';
    this.token = config?.apiToken || process.env.OWNERREZ_API_TOKEN || '';

    if (!this.email || !this.token) {
      throw new Error(
        'OwnerRez credentials required. Set OWNERREZ_EMAIL and OWNERREZ_API_TOKEN env vars or pass config.'
      );
    }

    const authString = Buffer.from(`${this.email}:${this.token}`).toString('base64');
    this.headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'RightAtHomeBnB/1.0 (rah-midland.com)',
    };
  }

  // --------------------------------------------------------------------------
  // HTTP helpers
  // --------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${OWNERREZ_API_BASE}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const options: RequestInit = {
      method,
      headers: this.headers,
    };

    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (response.status === 429) {
      throw new Error('OwnerRez rate limit exceeded (300 requests per 5 minutes). Retry later.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OwnerRez API error ${response.status}: ${errorText}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  private get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  private post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private patch<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  private delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  // --------------------------------------------------------------------------
  // Properties
  // --------------------------------------------------------------------------

  async getProperties(): Promise<OwnerRezProperty[]> {
    const result = await this.get<{ items: OwnerRezProperty[] }>('/properties');
    return result.items || [];
  }

  async getProperty(id: number): Promise<OwnerRezProperty> {
    return this.get<OwnerRezProperty>(`/properties/${id}`);
  }

  // --------------------------------------------------------------------------
  // Listings (photos, amenities, descriptions - requires premium)
  // --------------------------------------------------------------------------

  async getListings(): Promise<OwnerRezListing[]> {
    const result = await this.get<{ items: OwnerRezListing[] }>('/listings');
    return result.items || [];
  }

  async getListing(id: number): Promise<OwnerRezListing> {
    return this.get<OwnerRezListing>(`/listings/${id}`);
  }

  // --------------------------------------------------------------------------
  // Bookings
  // --------------------------------------------------------------------------

  async getBookings(propertyIds: number[], sinceUtc?: string): Promise<OwnerRezBooking[]> {
    const params: Record<string, string> = {
      property_ids: propertyIds.join(','),
    };
    if (sinceUtc) {
      params.since_utc = sinceUtc;
    }
    const result = await this.get<{ items: OwnerRezBooking[] }>('/bookings', params);
    return result.items || [];
  }

  async getBooking(id: number): Promise<OwnerRezBooking> {
    return this.get<OwnerRezBooking>(`/bookings/${id}`);
  }

  async createBooking(booking: {
    property_id: number;
    arrival: string;
    departure: string;
    adults: number;
    children?: number;
    pets?: number;
    guest_id?: number;
  }): Promise<OwnerRezBooking> {
    return this.post<OwnerRezBooking>('/bookings', booking);
  }

  async updateBooking(
    id: number,
    updates: Partial<Pick<OwnerRezBooking, 'arrival' | 'departure' | 'adults' | 'children' | 'pets' | 'status'>>
  ): Promise<OwnerRezBooking> {
    return this.patch<OwnerRezBooking>(`/bookings/${id}`, updates);
  }

  // --------------------------------------------------------------------------
  // Guests
  // --------------------------------------------------------------------------

  async searchGuests(query: string): Promise<OwnerRezGuest[]> {
    const result = await this.get<{ items: OwnerRezGuest[] }>('/guests', { q: query });
    return result.items || [];
  }

  async getGuest(id: number): Promise<OwnerRezGuest> {
    return this.get<OwnerRezGuest>(`/guests/${id}`);
  }

  async createGuest(guest: {
    first_name: string;
    last_name: string;
    email_addresses?: Array<{ email_address: string; type: string }>;
    phones?: Array<{ phone_number: string; type: string }>;
  }): Promise<OwnerRezGuest> {
    return this.post<OwnerRezGuest>('/guests', guest);
  }

  // --------------------------------------------------------------------------
  // Quotes (pricing)
  // --------------------------------------------------------------------------

  async createQuote(quote: {
    property_id: number;
    arrival: string;
    departure: string;
    adults: number;
    children?: number;
    pets?: number;
  }): Promise<OwnerRezQuote> {
    return this.post<OwnerRezQuote>('/quotes', quote);
  }

  async getQuote(id: number): Promise<OwnerRezQuote> {
    return this.get<OwnerRezQuote>(`/quotes/${id}`);
  }

  // --------------------------------------------------------------------------
  // Financial
  // --------------------------------------------------------------------------

  async getPayments(bookingId?: number): Promise<unknown[]> {
    const params = bookingId ? { booking_id: bookingId.toString() } : {};
    const result = await this.get<{ items: unknown[] }>('/payments', params);
    return result.items || [];
  }

  // --------------------------------------------------------------------------
  // iCal feeds
  // --------------------------------------------------------------------------

  async getICalFeed(feedId: string): Promise<string> {
    const response = await fetch(`https://app.ownerrez.com/feeds/ical/${feedId}`, {
      headers: { 'User-Agent': 'RightAtHomeBnB/1.0' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch iCal feed: ${response.status}`);
    }
    return response.text();
  }

  // --------------------------------------------------------------------------
  // Availability helper
  // --------------------------------------------------------------------------

  async getAvailability(
    propertyId: number,
    startDate: string,
    endDate: string
  ): Promise<{ date: string; available: boolean }[]> {
    const bookings = await this.getBookings([propertyId]);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates: { date: string; available: boolean }[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const isBooked = bookings.some((b) => {
        if (b.status === 'cancelled' || b.status === 'declined') return false;
        const arrival = new Date(b.arrival);
        const departure = new Date(b.departure);
        return d >= arrival && d < departure;
      });
      dates.push({ date: dateStr, available: !isBooked });
    }

    return dates;
  }

  // --------------------------------------------------------------------------
  // User info
  // --------------------------------------------------------------------------

  async getMe(): Promise<{ id: number; email: string; name: string }> {
    return this.get('/users/me');
  }

  // --------------------------------------------------------------------------
  // Webhook subscriptions (requires OAuth, not PAT)
  // --------------------------------------------------------------------------

  async getWebhookCategories(): Promise<string[]> {
    const result = await this.get<{ items: string[] }>('/webhooksubscriptions/categories');
    return result.items || [];
  }

  // --------------------------------------------------------------------------
  // Health check — verify credentials work
  // --------------------------------------------------------------------------

  async healthCheck(): Promise<{ ok: boolean; email?: string; error?: string }> {
    try {
      const me = await this.getMe();
      return { ok: true, email: me.email };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let _client: OwnerRezClient | null = null;

export function getOwnerRezClient(): OwnerRezClient {
  if (!_client) {
    _client = new OwnerRezClient();
  }
  return _client;
}

// ============================================================================
// PROPERTY MAPPING — OwnerRez ID ↔ RAH internal property slug
// ============================================================================

export interface PropertyMapping {
  ownerrezId: number;
  slug: string;
  name: string;
  address: string;
  icalFeedId?: string;
}

// This will be populated once we have the API token and can query properties
// For now, we define the structure and the mapping will be built on first sync
let _propertyMap: PropertyMapping[] = [];

export async function syncPropertyMap(client?: OwnerRezClient): Promise<PropertyMapping[]> {
  const c = client || getOwnerRezClient();
  const properties = await c.getProperties();

  _propertyMap = properties.map((p) => ({
    ownerrezId: p.id,
    slug: slugify(p.name),
    name: p.name,
    address: p.address
      ? `${p.address.street1}, ${p.address.city}, ${p.address.state} ${p.address.postal_code}`
      : '',
  }));

  return _propertyMap;
}

export function getPropertyMap(): PropertyMapping[] {
  return _propertyMap;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
