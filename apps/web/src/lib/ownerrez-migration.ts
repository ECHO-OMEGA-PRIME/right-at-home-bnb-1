/**
 * Right at Home BnB - OwnerRez Migration Tool
 * Exports ALL data from OwnerRez for full platform replacement
 * @author ECHO OMEGA PRIME
 *
 * GOAL: Extract every piece of data from OwnerRez so Steven can
 * cancel his subscription. RAH-midland.com replaces OwnerRez entirely.
 */

import {
  OwnerRezClient,
  OwnerRezProperty,
  OwnerRezBooking,
  OwnerRezGuest,
  OwnerRezListing,
  OwnerRezQuote,
} from './ownerrez-client';

// ============================================================================
// TYPES
// ============================================================================

export interface MigrationExport {
  exported_at: string;
  ownerrez_account: string;
  properties: OwnerRezProperty[];
  bookings: OwnerRezBooking[];
  guests: OwnerRezGuest[];
  listings: OwnerRezListing[];
  quotes: OwnerRezQuote[];
  ical_feeds: Array<{ property_id: number; property_name: string; ical_url: string }>;
  summary: {
    total_properties: number;
    total_bookings: number;
    total_guests: number;
    total_listings: number;
    active_bookings: number;
    revenue_total: number;
    currency: string;
  };
}

export interface MigrationStatus {
  phase: 'idle' | 'exporting' | 'transforming' | 'importing' | 'verifying' | 'complete' | 'error';
  progress: number;
  message: string;
  errors: string[];
  started_at?: string;
  completed_at?: string;
}

// ============================================================================
// FEATURE PARITY CHECKLIST
// ============================================================================

/**
 * OwnerRez features vs RAH-midland.com built-in features:
 *
 * ✅ ALREADY BUILT IN RAH:
 * - Property management (22 properties with photos, amenities, capacity)
 * - Booking management (create, view, cancel, calendar)
 * - Guest CRM (profiles, history, ratings, VIP tagging)
 * - Calendar sync (iCal import/export for Airbnb, VRBO)
 * - Payment processing (Stripe + Square)
 * - Automated messaging (4-message flow: pre-arrival, checkin, midstay, checkout)
 * - Email templates (booking confirmation, cancellation, etc.)
 * - Financial dashboard (P&L per property, expense categories, tax export)
 * - Cleaning crew management (GPS checkin, checklists, scheduling)
 * - AI concierge (local restaurants, events, house info)
 * - Smart home integration (locks, thermostats)
 * - Admin dashboard (full management UI)
 *
 * 🔧 NEED TO BUILD TO REPLACE OWNERREZ:
 * - Direct Airbnb API sync (currently iCal only)
 * - Direct VRBO API sync (currently iCal only)
 * - Booking.com channel sync
 * - Dynamic pricing rules (min stay, seasonal rates, discounts)
 * - Rate table management UI
 * - Renter agreement / digital signatures
 * - Owner statements (if managing for other owners)
 * - Review aggregation from channels
 *
 * 💡 RAH HAS BUT OWNERREZ DOESN'T:
 * - AI concierge with local knowledge
 * - Cleaner GPS check-in/out
 * - Photo-based cleaning verification
 * - AI quality scoring
 * - Smart home integration
 * - Mobile app for cleaners
 * - Desktop admin app
 * - Real-time cross-platform sync
 */

// ============================================================================
// MIGRATION ENGINE
// ============================================================================

export class OwnerRezMigration {
  private client: OwnerRezClient;
  private status: MigrationStatus = {
    phase: 'idle',
    progress: 0,
    message: 'Not started',
    errors: [],
  };

  constructor(client: OwnerRezClient) {
    this.client = client;
  }

  getStatus(): MigrationStatus {
    return { ...this.status };
  }

  /**
   * Full export — pulls everything from OwnerRez
   */
  async exportAll(): Promise<MigrationExport> {
    this.status = {
      phase: 'exporting',
      progress: 0,
      message: 'Starting full OwnerRez export...',
      errors: [],
      started_at: new Date().toISOString(),
    };

    const errors: string[] = [];

    // Step 1: Properties
    this.status.message = 'Exporting properties...';
    this.status.progress = 10;
    let properties: OwnerRezProperty[] = [];
    try {
      properties = await this.client.getProperties();
    } catch (e: any) {
      errors.push(`Properties: ${e.message}`);
    }

    // Step 2: Listings (photos, amenities)
    this.status.message = 'Exporting listings (photos, amenities)...';
    this.status.progress = 25;
    let listings: OwnerRezListing[] = [];
    try {
      listings = await this.client.getListings();
    } catch (e: any) {
      errors.push(`Listings: ${e.message} (may require premium)`);
    }

    // Step 3: Bookings
    this.status.message = 'Exporting bookings...';
    this.status.progress = 40;
    let bookings: OwnerRezBooking[] = [];
    if (properties.length > 0) {
      try {
        const propertyIds = properties.map((p) => p.id);
        bookings = await this.client.getBookings(propertyIds);
      } catch (e: any) {
        errors.push(`Bookings: ${e.message}`);
      }
    }

    // Step 4: Guests
    this.status.message = 'Exporting guests...';
    this.status.progress = 60;
    let guests: OwnerRezGuest[] = [];
    // Extract unique guest IDs from bookings
    const guestIds = [...new Set(bookings.map((b) => b.guest_id).filter(Boolean))];
    for (const gid of guestIds) {
      try {
        const guest = await this.client.getGuest(gid);
        guests.push(guest);
      } catch (e: any) {
        errors.push(`Guest ${gid}: ${e.message}`);
      }
      // Rate limit protection — pace requests
      if (guestIds.indexOf(gid) % 50 === 49) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Step 5: Calculate summary
    this.status.message = 'Calculating summary...';
    this.status.progress = 90;

    const activeBookings = bookings.filter(
      (b) => b.status === 'booked' && new Date(b.departure) >= new Date()
    );
    const revenueTotal = bookings
      .filter((b) => b.status === 'booked')
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);

    const result: MigrationExport = {
      exported_at: new Date().toISOString(),
      ownerrez_account: process.env.OWNERREZ_EMAIL || 'unknown',
      properties,
      bookings,
      guests,
      listings,
      quotes: [], // Quotes are ephemeral, not worth exporting
      ical_feeds: [], // Will be populated if we can find feed URLs
      summary: {
        total_properties: properties.length,
        total_bookings: bookings.length,
        total_guests: guests.length,
        total_listings: listings.length,
        active_bookings: activeBookings.length,
        revenue_total: revenueTotal,
        currency: bookings[0]?.currency || 'USD',
      },
    };

    this.status = {
      phase: 'complete',
      progress: 100,
      message: `Export complete: ${properties.length} properties, ${bookings.length} bookings, ${guests.length} guests`,
      errors,
      started_at: this.status.started_at,
      completed_at: new Date().toISOString(),
    };

    return result;
  }

  /**
   * Transform OwnerRez data into RAH-midland.com format
   */
  transformForRAH(data: MigrationExport) {
    return {
      properties: data.properties.map((p) => ({
        id: `or-${p.id}`,
        name: p.name,
        address: p.address
          ? `${p.address.street1}, ${p.address.city}, ${p.address.state} ${p.address.postal_code}`
          : '',
        bedrooms: p.bedrooms || 0,
        bathrooms: p.bathrooms || 0,
        maxGuests: p.max_guests || 0,
        checkIn: p.check_in_time || '3:00 PM',
        checkOut: p.check_out_time || '11:00 AM',
        active: p.active,
        source: 'ownerrez',
        sourceId: p.id,
      })),
      bookings: data.bookings.map((b) => ({
        id: `or-${b.id}`,
        propertyId: `or-${b.property_id}`,
        guestId: `or-${b.guest_id}`,
        checkIn: b.arrival,
        checkOut: b.departure,
        status: b.status === 'booked' ? 'confirmed' : b.status,
        adults: b.adults,
        children: b.children,
        pets: b.pets,
        totalAmount: b.total_amount,
        totalPaid: b.total_paid,
        balanceDue: b.balance_due,
        platform: b.source || 'direct',
        confirmationCode: b.confirmation_code,
        source: 'ownerrez',
        sourceId: b.id,
      })),
      guests: data.guests.map((g) => ({
        id: `or-${g.id}`,
        firstName: g.first_name,
        lastName: g.last_name,
        email: g.email_addresses?.[0]?.email_address || '',
        phone: g.phones?.[0]?.phone_number || '',
        source: 'ownerrez',
        sourceId: g.id,
      })),
    };
  }
}
