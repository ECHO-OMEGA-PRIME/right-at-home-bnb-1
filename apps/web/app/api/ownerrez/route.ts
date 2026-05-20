/**
 * Right at Home BnB - OwnerRez API Routes
 * Proxy and data sync endpoints for OwnerRez integration
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import { OwnerRezClient } from '@/lib/ownerrez-client';

function getClient(): OwnerRezClient | null {
  try {
    return new OwnerRezClient();
  } catch {
    return null;
  }
}

// GET /api/ownerrez — Health check + property list
export async function GET(request: NextRequest) {
  const client = getClient();
  if (!client) {
    return NextResponse.json(
      { error: 'OwnerRez not configured. Set OWNERREZ_EMAIL and OWNERREZ_API_TOKEN.' },
      { status: 503 }
    );
  }

  const action = request.nextUrl.searchParams.get('action') || 'health';

  try {
    switch (action) {
      case 'health': {
        const health = await client.healthCheck();
        return NextResponse.json(health);
      }

      case 'properties': {
        const properties = await client.getProperties();
        return NextResponse.json({ count: properties.length, properties });
      }

      case 'listings': {
        const listings = await client.getListings();
        return NextResponse.json({ count: listings.length, listings });
      }

      case 'bookings': {
        const propertyIds = request.nextUrl.searchParams.get('property_ids');
        if (!propertyIds) {
          return NextResponse.json({ error: 'property_ids required' }, { status: 400 });
        }
        const ids = propertyIds.split(',').map(Number);
        const since = request.nextUrl.searchParams.get('since') || undefined;
        const bookings = await client.getBookings(ids, since);
        return NextResponse.json({ count: bookings.length, bookings });
      }

      case 'availability': {
        const propertyId = request.nextUrl.searchParams.get('property_id');
        const start = request.nextUrl.searchParams.get('start');
        const end = request.nextUrl.searchParams.get('end');
        if (!propertyId || !start || !end) {
          return NextResponse.json(
            { error: 'property_id, start, and end required' },
            { status: 400 }
          );
        }
        const availability = await client.getAvailability(Number(propertyId), start, end);
        return NextResponse.json({ property_id: Number(propertyId), availability });
      }

      case 'guests': {
        const q = request.nextUrl.searchParams.get('q');
        if (!q) {
          return NextResponse.json({ error: 'q (search query) required' }, { status: 400 });
        }
        const guests = await client.searchGuests(q);
        return NextResponse.json({ count: guests.length, guests });
      }

      case 'export': {
        // Full data export — pull everything for migration
        const properties = await client.getProperties();
        const propertyIds = properties.map((p) => p.id);

        const bookings = propertyIds.length > 0
          ? await client.getBookings(propertyIds)
          : [];

        let listings: unknown[] = [];
        try {
          listings = await client.getListings();
        } catch {
          // Listings API may require premium
        }

        return NextResponse.json({
          exported_at: new Date().toISOString(),
          properties: { count: properties.length, data: properties },
          bookings: { count: bookings.length, data: bookings },
          listings: { count: listings.length, data: listings },
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[OwnerRez API Error]', error);
    return NextResponse.json(
      { error: error.message || 'OwnerRez API error' },
      { status: 500 }
    );
  }
}

// POST /api/ownerrez — Create quotes, bookings
export async function POST(request: NextRequest) {
  const client = getClient();
  if (!client) {
    return NextResponse.json(
      { error: 'OwnerRez not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'quote': {
        const quote = await client.createQuote({
          property_id: data.property_id,
          arrival: data.arrival,
          departure: data.departure,
          adults: data.adults || 1,
          children: data.children || 0,
          pets: data.pets || 0,
        });
        return NextResponse.json(quote);
      }

      case 'booking': {
        const booking = await client.createBooking({
          property_id: data.property_id,
          arrival: data.arrival,
          departure: data.departure,
          adults: data.adults || 1,
          children: data.children,
          pets: data.pets,
          guest_id: data.guest_id,
        });
        return NextResponse.json(booking);
      }

      case 'guest': {
        const guest = await client.createGuest({
          first_name: data.first_name,
          last_name: data.last_name,
          email_addresses: data.email ? [{ email_address: data.email, type: 'personal' }] : undefined,
          phones: data.phone ? [{ phone_number: data.phone, type: 'mobile' }] : undefined,
        });
        return NextResponse.json(guest);
      }

      case 'sync-properties': {
        const { syncPropertyMap } = await import('@/lib/ownerrez-client');
        const map = await syncPropertyMap(client);
        return NextResponse.json({ synced: map.length, properties: map });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[OwnerRez POST Error]', error);
    return NextResponse.json(
      { error: error.message || 'OwnerRez API error' },
      { status: 500 }
    );
  }
}
