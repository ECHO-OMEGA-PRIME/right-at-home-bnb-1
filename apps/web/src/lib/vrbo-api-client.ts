/**
 * Right at Home BnB - VRBO Full API Client
 * Expedia Rapid API Integration for VRBO Content
 * @author ECHO OMEGA PRIME
 *
 * VRBO content is available through Expedia's Rapid API
 * Documentation: https://developers.expediagroup.com/docs/products/rapid
 * VRBO Guide: https://developers.expediagroup.com/docs/products/rapid/lodging/vacation-rentals/vrbo-integration-guide
 *
 * To get API access:
 * 1. Apply at: https://partner.expediagroup.com
 * 2. Or contact: pmsalesinquiry@expediagroup.com
 * 3. Complete onboarding and get sandbox credentials
 * 4. Pass certification to get production credentials
 */

import crypto from 'crypto';

// Environment configuration
const EXPEDIA_API_KEY = process.env.EXPEDIA_API_KEY || '';
const EXPEDIA_SECRET = process.env.EXPEDIA_SECRET || '';
const EXPEDIA_BASE_URL = process.env.EXPEDIA_BASE_URL || 'https://test.ean.com/v3';

// API Response Types
export interface VRBOPropertyContent {
  property_id: string;
  name: string;
  address: {
    line_1: string;
    line_2?: string;
    city: string;
    state_province_name: string;
    postal_code: string;
    country_code: string;
  };
  ratings?: {
    property?: {
      rating: string;
      type: string;
    };
  };
  location: {
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  phone: string;
  category?: {
    id: string;
    name: string;
  };
  images?: PropertyImage[];
  amenities?: Record<string, Amenity>;
  descriptions?: {
    general?: string;
    amenities?: string;
    location?: string;
  };
  statistics?: {
    bedrooms?: number;
    bathrooms?: number;
    max_occupancy?: number;
  };
}

export interface PropertyImage {
  hero_image?: boolean;
  category?: number;
  links?: {
    '70px'?: { href: string };
    '200px'?: { href: string };
    '350px'?: { href: string };
    '1000px'?: { href: string };
  };
  caption?: string;
}

export interface Amenity {
  id: string;
  name: string;
  categories?: string[];
}

export interface RoomRate {
  id: string;
  room_name: string;
  rates: Rate[];
  bed_groups?: BedGroup[];
  occupancy_allowed?: {
    adults: number;
    children?: number;
  };
}

export interface Rate {
  id: string;
  nightly: Price[];
  totals: {
    inclusive: Price;
    exclusive: Price;
    property_fees?: Price;
    strikethrough?: Price;
    marketing_fee?: Price;
  };
  merchant_of_record: 'expedia' | 'property';
  amenities?: Record<string, Amenity>;
  cancel_penalties?: CancelPenalty[];
  refundable?: boolean;
}

export interface Price {
  value: string;
  currency: string;
  request_currency?: {
    value: string;
    currency: string;
  };
}

export interface BedGroup {
  id: string;
  description: string;
  configuration: BedConfiguration[];
}

export interface BedConfiguration {
  type: string;
  size: string;
  quantity: number;
}

export interface CancelPenalty {
  start: string;
  end: string;
  nights?: string;
  amount?: string;
  currency?: string;
  percent?: string;
}

export interface BookingRequest {
  affiliate_reference_id: string;
  hold?: boolean;
  rooms: RoomBooking[];
  payments?: PaymentInfo[];
}

export interface RoomBooking {
  given_name: string;
  family_name: string;
  email: string;
  phone: string;
  smoking?: boolean;
  special_request?: string;
}

export interface PaymentInfo {
  type: 'customer_card' | 'affiliate_card' | 'virtual_card';
  card_type?: string;
  number?: string;
  security_code?: string;
  expiration_month?: string;
  expiration_year?: string;
  billing_contact?: {
    given_name: string;
    family_name: string;
    address: {
      line_1: string;
      city: string;
      state_province_code: string;
      postal_code: string;
      country_code: string;
    };
  };
}

export interface BookingResponse {
  itinerary_id: string;
  links: {
    retrieve: { href: string };
  };
  rooms: {
    confirmation_id: {
      expedia: string;
      property?: string;
    };
    status: string;
  }[];
}

export interface ItineraryRetrieve {
  itinerary_id: string;
  property_id: string;
  confirmation_ids: {
    expedia: string;
    property?: string;
  };
  status: 'pending' | 'confirmed' | 'cancelled' | 'refunded';
  rooms: {
    check_in: string;
    check_out: string;
    guest_name: string;
    rate: Rate;
    status: string;
  }[];
  creation_date_time: string;
}

/**
 * VRBO API Client using Expedia Rapid API
 */
export class VRBOApiClient {
  private apiKey: string;
  private secret: string;
  private baseUrl: string;

  constructor(apiKey?: string, secret?: string, baseUrl?: string) {
    this.apiKey = apiKey || EXPEDIA_API_KEY;
    this.secret = secret || EXPEDIA_SECRET;
    this.baseUrl = baseUrl || EXPEDIA_BASE_URL;

    if (!this.apiKey || !this.secret) {
      console.warn('[VRBO API] Credentials not configured. API calls will fail.');
    }
  }

  /**
   * Generate Expedia authentication header
   * Uses SHA-512 signature: SHA512(apiKey + secret + timestamp)
   */
  private generateAuthHeader(): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const toHash = `${this.apiKey}${this.secret}${timestamp}`;
    const signature = crypto.createHash('sha512').update(toHash).digest('hex');

    return `EAN APIKey=${this.apiKey},Signature=${signature},timestamp=${timestamp}`;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    method: string,
    endpoint: string,
    params?: Record<string, string>,
    body?: any
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    // Always request VRBO supply
    if (!url.searchParams.has('supply_source')) {
      url.searchParams.append('supply_source', 'vrbo');
    }

    const headers: Record<string, string> = {
      'Authorization': this.generateAuthHeader(),
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'Customer-Ip': '127.0.0.1', // Replace with actual customer IP in production
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`VRBO API Error ${response.status}: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  // ============================================
  // CONTENT APIs
  // ============================================

  /**
   * Get property content (details, images, amenities)
   * @param propertyId VRBO property ID
   * @param language Language code (default: en-US)
   */
  async getPropertyContent(propertyId: string, language: string = 'en-US'): Promise<VRBOPropertyContent> {
    return this.request<VRBOPropertyContent>(
      'GET',
      `/properties/content`,
      {
        property_id: propertyId,
        language,
        include: 'property_ids,descriptions,address,ratings,location,phone,images,amenities,statistics',
      }
    );
  }

  /**
   * Get multiple properties content
   * @param propertyIds Array of VRBO property IDs (max 250)
   */
  async getPropertiesContent(propertyIds: string[], language: string = 'en-US'): Promise<VRBOPropertyContent[]> {
    return this.request<VRBOPropertyContent[]>(
      'GET',
      `/properties/content`,
      {
        property_id: propertyIds.join(','),
        language,
        include: 'property_ids,descriptions,address,ratings,location,phone,images,amenities,statistics',
      }
    );
  }

  // ============================================
  // SHOPPING APIs
  // ============================================

  /**
   * Search for available properties (Property Availability)
   * @param params Search parameters
   */
  async searchAvailability(params: {
    checkin: string; // YYYY-MM-DD
    checkout: string; // YYYY-MM-DD
    occupancy: string; // e.g., "2" for 2 adults or "2-1" for 2 adults, 1 child
    currency?: string;
    language?: string;
    // Filter by region, coordinates, or property IDs
    region_id?: string;
    coordinates?: { latitude: number; longitude: number; radius: number };
    property_id?: string[];
    // Filters
    filter?: {
      price?: { min?: number; max?: number };
      guest_rating?: { min?: string };
      star_rating?: string[];
      amenities?: string[];
    };
  }): Promise<any> {
    const queryParams: Record<string, string> = {
      checkin: params.checkin,
      checkout: params.checkout,
      currency: params.currency || 'USD',
      language: params.language || 'en-US',
      occupancy: params.occupancy,
    };

    if (params.region_id) {
      queryParams.region_id = params.region_id;
    }

    if (params.coordinates) {
      queryParams.latitude = params.coordinates.latitude.toString();
      queryParams.longitude = params.coordinates.longitude.toString();
      queryParams.radius = params.coordinates.radius.toString();
    }

    if (params.property_id && params.property_id.length > 0) {
      queryParams.property_id = params.property_id.join(',');
    }

    if (params.filter) {
      if (params.filter.price) {
        if (params.filter.price.min) queryParams['filter[price][min]'] = params.filter.price.min.toString();
        if (params.filter.price.max) queryParams['filter[price][max]'] = params.filter.price.max.toString();
      }
      if (params.filter.guest_rating?.min) {
        queryParams['filter[guest_rating][min]'] = params.filter.guest_rating.min;
      }
    }

    return this.request('GET', '/properties/availability', queryParams);
  }

  /**
   * Get room rates for a specific property (Price Check)
   * @param propertyId VRBO property ID
   * @param token Rate token from availability search
   */
  async getRoomRates(propertyId: string, token: string): Promise<RoomRate[]> {
    return this.request<RoomRate[]>(
      'GET',
      `/properties/${propertyId}/rooms/rates`,
      { token }
    );
  }

  /**
   * Price check before booking
   * @param propertyId VRBO property ID
   * @param roomId Room ID from rates
   * @param rateId Rate ID from rates
   * @param token Rate token
   */
  async priceCheck(
    propertyId: string,
    roomId: string,
    rateId: string,
    token: string
  ): Promise<any> {
    return this.request(
      'GET',
      `/properties/${propertyId}/rooms/${roomId}/rates/${rateId}`,
      { token }
    );
  }

  // ============================================
  // BOOKING APIs
  // ============================================

  /**
   * Create a booking
   * @param propertyId VRBO property ID
   * @param roomId Room ID
   * @param rateId Rate ID
   * @param token Rate token
   * @param booking Booking details
   */
  async createBooking(
    propertyId: string,
    roomId: string,
    rateId: string,
    token: string,
    booking: BookingRequest
  ): Promise<BookingResponse> {
    return this.request<BookingResponse>(
      'POST',
      `/properties/${propertyId}/rooms/${roomId}/rates/${rateId}/book`,
      { token },
      booking
    );
  }

  /**
   * Retrieve booking/itinerary details
   * @param itineraryId Itinerary ID from booking response
   * @param email Guest email for authentication
   */
  async getItinerary(itineraryId: string, email: string): Promise<ItineraryRetrieve> {
    return this.request<ItineraryRetrieve>(
      'GET',
      `/itineraries/${itineraryId}`,
      { email }
    );
  }

  /**
   * Cancel a booking
   * @param itineraryId Itinerary ID
   * @param roomId Room ID to cancel
   * @param email Guest email
   */
  async cancelBooking(itineraryId: string, roomId: string, email: string): Promise<any> {
    return this.request(
      'DELETE',
      `/itineraries/${itineraryId}/rooms/${roomId}`,
      { email }
    );
  }

  // ============================================
  // GEOGRAPHY APIs
  // ============================================

  /**
   * Search for regions (cities, neighborhoods, airports)
   * @param query Search term
   */
  async searchRegions(query: string, language: string = 'en-US'): Promise<any> {
    return this.request(
      'GET',
      '/regions',
      {
        keyword: query,
        language,
        include: 'property_ids,details',
      }
    );
  }

  /**
   * Get region details
   * @param regionId Region ID
   */
  async getRegion(regionId: string, language: string = 'en-US'): Promise<any> {
    return this.request(
      'GET',
      `/regions/${regionId}`,
      {
        language,
        include: 'property_ids,details',
      }
    );
  }

  // ============================================
  // NOTIFICATIONS / WEBHOOKS
  // ============================================

  /**
   * Verify webhook signature from Expedia/VRBO
   * @param payload Raw webhook payload
   * @param signature Signature from header
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Check if API credentials are configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.secret);
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    environment: string;
  }> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          message: 'API credentials not configured',
          environment: this.baseUrl.includes('test') ? 'sandbox' : 'production',
        };
      }

      // Try to search for a region to test connectivity
      await this.searchRegions('Midland, TX');

      return {
        success: true,
        message: 'API connection successful',
        environment: this.baseUrl.includes('test') ? 'sandbox' : 'production',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        environment: this.baseUrl.includes('test') ? 'sandbox' : 'production',
      };
    }
  }
}

// Export singleton instance
export const vrboApiClient = new VRBOApiClient();

// Export configuration helper
export const VRBO_API_CONFIG = {
  applyUrl: 'https://partner.expediagroup.com',
  integrationCentral: 'https://integration-central.vrbo.com',
  salesContact: 'pmsalesinquiry@expediagroup.com',
  documentation: 'https://developers.expediagroup.com/docs/products/rapid',
  vrboGuide: 'https://developers.expediagroup.com/docs/products/rapid/lodging/vacation-rentals/vrbo-integration-guide',
  sandboxBaseUrl: 'https://test.ean.com/v3',
  productionBaseUrl: 'https://api.ean.com/v3',

  requiredEnvVars: [
    'EXPEDIA_API_KEY',
    'EXPEDIA_SECRET',
    'EXPEDIA_BASE_URL',
  ],

  features: {
    current: [
      'iCal calendar sync (60-minute intervals)',
      'Manual booking import via iCal',
      'Calendar export for VRBO to poll',
    ],
    withFullAPI: [
      'Real-time booking notifications',
      'Instant availability updates',
      'Dynamic pricing management',
      'Guest messaging integration',
      'Content sync (photos, descriptions)',
      'Review management',
      'Payment processing',
      'Cancellation handling',
    ],
  },
};
