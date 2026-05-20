/**
 * Right at Home BnB - OwnerRez Webhook Receiver
 * Catches real-time booking/property events from OwnerRez
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[OwnerRez Webhook]', JSON.stringify(body, null, 2));

    const { category, action, entity_type, entity_id, data } = body;

    switch (entity_type) {
      case 'booking': {
        if (action === 'entity_update') {
          console.log(`[OwnerRez] Booking ${entity_id} updated`);
          // TODO: Sync updated booking to local database
          // await syncBookingFromOwnerRez(entity_id);
        } else if (action === 'entity_delete') {
          console.log(`[OwnerRez] Booking ${entity_id} deleted/cancelled`);
          // TODO: Mark booking as cancelled locally
          // await cancelLocalBooking(entity_id);
        }
        break;
      }

      case 'guest': {
        console.log(`[OwnerRez] Guest ${entity_id} ${action}`);
        // TODO: Sync guest data to CRM
        break;
      }

      case 'property': {
        console.log(`[OwnerRez] Property ${entity_id} ${action}`);
        // TODO: Refresh property cache
        break;
      }

      default:
        console.log(`[OwnerRez] Unhandled: ${entity_type} ${action} ${entity_id}`);
    }

    return NextResponse.json({ received: true, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('[OwnerRez Webhook Error]', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing error' },
      { status: 500 }
    );
  }
}

// Respond to GET for webhook verification
export async function GET() {
  return NextResponse.json({
    service: 'Right at Home BnB',
    webhook: 'ownerrez',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
}
