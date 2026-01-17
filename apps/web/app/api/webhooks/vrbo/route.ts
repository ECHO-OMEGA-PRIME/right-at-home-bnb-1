/**
 * Right at Home BnB - VRBO Webhook Handler
 * Receives real-time booking notifications from VRBO/Expedia
 * @author ECHO OMEGA PRIME
 *
 * Events handled:
 * - reservation.created: New booking received
 * - reservation.modified: Booking dates/details changed
 * - reservation.cancelled: Booking cancelled
 * - guest.message: Guest sent a message
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
function getFirestoreAdmin() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'echo-prime-ai',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

// Verify webhook signature from Expedia/VRBO
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// Generate a unique door code for the booking
function generateDoorCode(checkIn: Date): string {
  const month = String(checkIn.getMonth() + 1).padStart(2, '0');
  const day = String(checkIn.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `${month}${day}${random}`;
}

// Send welcome email to guest
async function sendWelcomeEmail(booking: any, propertyInfo: any, doorCode: string): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rightathomebnb.com';

    await fetch(`${baseUrl}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: booking.guestEmail,
        from: 'bookings@rah-midland.com',
        fromName: 'Right at Home BnB',
        replyTo: 'steven.palma@rah-midland.com',
        subject: `Welcome to ${propertyInfo.name} - Your Booking Confirmation`,
        html: generateWelcomeEmailHtml(booking, propertyInfo, doorCode),
      }),
    });

    console.log(`[VRBO Webhook] Welcome email sent to ${booking.guestEmail}`);
  } catch (error) {
    console.error('[VRBO Webhook] Failed to send welcome email:', error);
  }
}

// Generate welcome email HTML
function generateWelcomeEmailHtml(booking: any, property: any, doorCode: string): string {
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, serif; background: #F5F5F0; padding: 20px; margin: 0; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: #500000; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; color: #2D2D2D; }
    .code-box { background: #500000; color: white; font-size: 32px; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0; font-family: monospace; }
    .info-box { background: #F5F5F0; border-left: 4px solid #C4A777; padding: 15px; margin: 20px 0; }
    .footer { background: #2D2D2D; color: white; padding: 20px; text-align: center; font-size: 14px; }
    h2 { color: #500000; border-bottom: 2px solid #C4A777; padding-bottom: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Right at Home BnB</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">We're excited to host you, ${booking.guestName?.split(' ')[0] || 'Guest'}!</p>
    </div>
    <div class="content">
      <h2>Your Reservation Details</h2>
      <div class="info-box">
        <p><strong>Property:</strong> ${property.name}</p>
        <p><strong>Address:</strong> ${property.address || 'Address provided upon check-in'}</p>
        <p><strong>Check-in:</strong> ${checkIn.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at 3:00 PM</p>
        <p><strong>Check-out:</strong> ${checkOut.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at 11:00 AM</p>
        <p><strong>Confirmation:</strong> ${booking.confirmationCode || 'VRBO-' + booking.id}</p>
      </div>

      <h2>Your Door Code</h2>
      <div class="code-box">${doorCode}</div>
      <p style="text-align: center; color: #666; font-size: 14px;">This code activates at check-in time and expires 30 minutes after checkout.</p>

      <h2>WiFi Information</h2>
      <div class="info-box">
        <p><strong>Network:</strong> ${property.wifiNetwork || 'RightAtHome_Guest'}</p>
        <p><strong>Password:</strong> ${property.wifiPassword || 'Welcome2024'}</p>
      </div>

      <h2>Check-in Instructions</h2>
      <ol style="line-height: 1.8;">
        <li>Arrive at the property after 3:00 PM</li>
        <li>Locate the smart lock keypad on the front door</li>
        <li>Enter your door code: <strong>${doorCode}</strong></li>
        <li>Press the unlock button (checkmark)</li>
        <li>Welcome home!</li>
      </ol>

      <h2>Need Help?</h2>
      <div class="info-box">
        <p><strong>Host Steven:</strong> (432) 269-3446</p>
        <p><strong>Emergency:</strong> 911</p>
        <p>For non-urgent questions, text or call Steven anytime.</p>
      </div>

      <h2>House Rules</h2>
      <ul style="line-height: 1.8;">
        <li>No smoking inside the property</li>
        <li>No parties or events</li>
        <li>Quiet hours: 10 PM - 8 AM</li>
        <li>Please treat the home with respect</li>
        <li>Report any issues immediately</li>
      </ul>
    </div>
    <div class="footer">
      <p>Thank you for choosing Right at Home BnB!</p>
      <p>Midland, Texas | rightathomebnb.com</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Notify Steven of new booking
async function notifyOwner(booking: any, property: any): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rightathomebnb.com';

    await fetch(`${baseUrl}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'steven.palma@rah-midland.com',
        from: 'system@rah-midland.com',
        fromName: 'Right at Home BnB System',
        subject: `New VRBO Booking: ${property.name}`,
        html: `
          <h2>New VRBO Booking Received</h2>
          <p><strong>Property:</strong> ${property.name}</p>
          <p><strong>Guest:</strong> ${booking.guestName} (${booking.guestEmail})</p>
          <p><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
          <p><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
          <p><strong>Guests:</strong> ${booking.numGuests || 1}</p>
          <p><strong>Total:</strong> $${booking.totalPrice || 'TBD'}</p>
          <p><strong>Source:</strong> VRBO</p>
          <hr>
          <p>A welcome email has been automatically sent to the guest with door code and check-in instructions.</p>
        `,
      }),
    });

    console.log(`[VRBO Webhook] Owner notification sent for booking ${booking.id}`);
  } catch (error) {
    console.error('[VRBO Webhook] Failed to notify owner:', error);
  }
}

// Main webhook handler
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.VRBO_WEBHOOK_SECRET || process.env.EXPEDIA_SECRET;

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-expedia-signature') ||
                     request.headers.get('x-vrbo-signature') ||
                     request.headers.get('x-signature') || '';

    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      if (!verifySignature(rawBody, signature, webhookSecret)) {
        console.error('[VRBO Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Parse the payload
    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type || payload.eventType || payload.event || 'unknown';

    console.log(`[VRBO Webhook] Received event: ${eventType}`);

    // Initialize Firestore
    const db = getFirestoreAdmin();

    // Handle different event types
    switch (eventType) {
      case 'reservation.created':
      case 'booking.created':
      case 'reservation_created': {
        const reservation = payload.reservation || payload.booking || payload;

        // Extract booking details
        const booking = {
          id: reservation.reservationId || reservation.id || `vrbo_${Date.now()}`,
          propertyId: reservation.propertyId || reservation.property_id,
          source: 'vrbo',
          status: 'confirmed',
          guestName: reservation.guest?.name || reservation.guestName || 'Guest',
          guestEmail: reservation.guest?.email || reservation.guestEmail || '',
          guestPhone: reservation.guest?.phone || reservation.guestPhone || '',
          checkIn: reservation.checkIn || reservation.check_in,
          checkOut: reservation.checkOut || reservation.check_out,
          numGuests: reservation.numberOfGuests || reservation.num_guests || 1,
          totalPrice: reservation.totalPrice || reservation.total_price || 0,
          confirmationCode: reservation.confirmationCode || reservation.confirmation_code,
          createdAt: Timestamp.now(),
        };

        // Save to Firestore
        await db.collection('bookings').doc(booking.id).set(booking);

        // Get property info (or use defaults)
        let propertyInfo = { name: 'Right at Home Property', wifiNetwork: 'RightAtHome_Guest', wifiPassword: 'Welcome2024' };
        try {
          const propertyDoc = await db.collection('properties').doc(booking.propertyId).get();
          if (propertyDoc.exists) {
            propertyInfo = { ...propertyInfo, ...propertyDoc.data() };
          }
        } catch (e) {
          console.warn('[VRBO Webhook] Could not fetch property info');
        }

        // Generate door code
        const doorCode = generateDoorCode(new Date(booking.checkIn));

        // Save check-in record
        await db.collection('checkin_records').doc(booking.id).set({
          bookingId: booking.id,
          propertyId: booking.propertyId,
          guestEmail: booking.guestEmail,
          doorCode,
          wifiNetwork: propertyInfo.wifiNetwork,
          wifiPassword: propertyInfo.wifiPassword,
          scheduledCheckIn: booking.checkIn,
          scheduledCheckOut: booking.checkOut,
          createdAt: Timestamp.now(),
        });

        // Send welcome email to guest
        if (booking.guestEmail) {
          await sendWelcomeEmail(booking, propertyInfo, doorCode);
        }

        // Notify Steven
        await notifyOwner(booking, propertyInfo);

        // Update CRM
        if (booking.guestEmail) {
          await db.collection('guest_profiles').doc(booking.guestEmail.toLowerCase()).set({
            email: booking.guestEmail.toLowerCase(),
            firstName: booking.guestName?.split(' ')[0] || 'Guest',
            lastName: booking.guestName?.split(' ').slice(1).join(' ') || '',
            phone: booking.guestPhone,
            lastBookingSource: 'vrbo',
            lastBookingDate: Timestamp.now(),
            updatedAt: Timestamp.now(),
          }, { merge: true });
        }

        console.log(`[VRBO Webhook] Booking ${booking.id} processed successfully`);

        return NextResponse.json({
          status: 'success',
          event: eventType,
          bookingId: booking.id,
          doorCode,
        });
      }

      case 'reservation.modified':
      case 'booking.modified':
      case 'reservation_modified': {
        const reservation = payload.reservation || payload.booking || payload;
        const bookingId = reservation.reservationId || reservation.id;

        // Update booking in Firestore
        await db.collection('bookings').doc(bookingId).update({
          checkIn: reservation.checkIn || reservation.check_in,
          checkOut: reservation.checkOut || reservation.check_out,
          numGuests: reservation.numberOfGuests || reservation.num_guests,
          totalPrice: reservation.totalPrice || reservation.total_price,
          status: 'modified',
          updatedAt: Timestamp.now(),
        });

        console.log(`[VRBO Webhook] Booking ${bookingId} modified`);

        return NextResponse.json({
          status: 'modified',
          event: eventType,
          bookingId,
        });
      }

      case 'reservation.cancelled':
      case 'booking.cancelled':
      case 'reservation_cancelled': {
        const reservation = payload.reservation || payload.booking || payload;
        const bookingId = reservation.reservationId || reservation.id;

        // Update booking status
        await db.collection('bookings').doc(bookingId).update({
          status: 'cancelled',
          cancelledAt: Timestamp.now(),
        });

        // Deactivate door code
        await db.collection('checkin_records').doc(bookingId).update({
          status: 'cancelled',
          doorCodeActive: false,
        });

        console.log(`[VRBO Webhook] Booking ${bookingId} cancelled`);

        return NextResponse.json({
          status: 'cancelled',
          event: eventType,
          bookingId,
        });
      }

      case 'guest.message':
      case 'message.received': {
        // Log guest message (for future implementation)
        console.log(`[VRBO Webhook] Guest message received:`, payload);

        return NextResponse.json({
          status: 'received',
          event: eventType,
        });
      }

      default:
        console.log(`[VRBO Webhook] Unhandled event type: ${eventType}`);
        return NextResponse.json({
          status: 'ignored',
          event: eventType,
          message: 'Event type not handled',
        });
    }
  } catch (error: any) {
    console.error('[VRBO Webhook] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// GET endpoint for webhook verification
export async function GET(request: NextRequest) {
  // VRBO/Expedia may send a GET request to verify the webhook endpoint
  const challenge = request.nextUrl.searchParams.get('challenge');

  if (challenge) {
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({
    status: 'active',
    endpoint: 'VRBO Webhook Handler',
    version: '1.0.0',
    events_supported: [
      'reservation.created',
      'reservation.modified',
      'reservation.cancelled',
      'guest.message',
    ],
  });
}
