/**
 * VRBO/Expedia webhook intake.
 * Reservation metadata only. Access credentials are exclusively managed by
 * the authenticated Tuya access lifecycle and are never generated, stored,
 * emailed, logged, or returned here.
 */
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { db as firebaseAdminDb, getFirebaseAdminStatus } from '@/lib/firebase-admin';
import { deliverSensitiveGuestMessage } from '@/lib/secure-notifications';

class FirebaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirebaseUnavailableError';
  }
}

function firestore(): Firestore {
  if (firebaseAdminDb) return firebaseAdminDb;

  const status = getFirebaseAdminStatus();
  throw new FirebaseUnavailableError(
    status.error
      ? `Firebase Admin unavailable: ${status.error}`
      : 'Firebase Admin unavailable.',
  );
}

function verifySignature(payload: string, supplied: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const left = Buffer.from(supplied, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function reservationFrom(payload: any) {
  const source = payload.reservation || payload.booking || payload;
  return {
    id: String(source.reservationId || source.id || ''),
    propertyId: String(source.propertyId || source.property_id || ''),
    source: 'vrbo',
    status: 'confirmed',
    guestName: String(source.guest?.name || source.guestName || 'Guest'),
    guestEmail: String(source.guest?.email || source.guestEmail || ''),
    guestPhone: String(source.guest?.phone || source.guestPhone || ''),
    checkIn: source.checkIn || source.check_in || null,
    checkOut: source.checkOut || source.check_out || null,
    numGuests: Number(source.numberOfGuests || source.num_guests || 1),
    totalPrice: Number(source.totalPrice || source.total_price || 0),
    confirmationCode: source.confirmationCode || source.confirmation_code || null,
  };
}

async function sendReservationConfirmation(
  booking: ReturnType<typeof reservationFrom>,
  propertyName: string,
) {
  if (!booking.guestEmail && !booking.guestPhone) return null;
  const message = [
    `Your reservation at ${propertyName} is confirmed.`,
    `Check-in: ${booking.checkIn || 'See reservation'}`,
    `Check-out: ${booking.checkOut || 'See reservation'}`,
    'Temporary door access and private stay details are delivered separately through the secure access lifecycle shortly before check-in.',
    'This message intentionally contains no door code or Wi-Fi password.',
  ].join('\n');
  return deliverSensitiveGuestMessage({
    email: booking.guestEmail || null,
    phone: booking.guestPhone || null,
    subject: `Reservation confirmed: ${propertyName}`,
    message,
  });
}

async function queueAccessLifecycle(
  bookingId: string,
  propertyId: string,
  action: 'PROVISION' | 'RESCHEDULE' | 'REVOKE',
) {
  await firestore()
    .collection('access_lifecycle_queue')
    .doc(`${bookingId}_${action}`)
    .set(
      {
        bookingId,
        propertyId,
        action,
        status: 'PENDING_VERIFICATION',
        containsCredential: false,
        createdAt: Timestamp.now(),
      },
      { merge: true },
    );
}

export async function POST(request: NextRequest) {
  const secret = process.env.VRBO_WEBHOOK_SECRET || process.env.EXPEDIA_SECRET || '';
  const allowUnsignedDev =
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_UNSIGNED_VRBO_WEBHOOK === 'true';

  if (!secret && !allowUnsignedDev) {
    return NextResponse.json(
      { error: 'Webhook verification is not configured' },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature =
    request.headers.get('x-expedia-signature') ||
    request.headers.get('x-vrbo-signature') ||
    request.headers.get('x-signature') ||
    '';

  if (secret && (!signature || !verifySignature(rawBody, signature, secret))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const eventType = String(
      payload.event_type || payload.eventType || payload.event || 'unknown',
    );
    const booking = reservationFrom(payload);

    if (!booking.id && eventType !== 'guest.message' && eventType !== 'message.received') {
      return NextResponse.json(
        { error: 'Reservation identifier required' },
        { status: 400 },
      );
    }

    const db = firestore();

    if (['reservation.created', 'booking.created', 'reservation_created'].includes(eventType)) {
      await db.collection('bookings').doc(booking.id).set(
        {
          ...booking,
          status: 'confirmed',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );

      const propertyDoc = booking.propertyId
        ? await db.collection('properties').doc(booking.propertyId).get()
        : null;
      const propertyName = String(
        propertyDoc?.data()?.name || 'Right at Home property',
      );
      const receipt = await sendReservationConfirmation(booking, propertyName).catch(
        () => null,
      );
      await queueAccessLifecycle(booking.id, booking.propertyId, 'PROVISION');

      return NextResponse.json(
        {
          status: 'accepted',
          event: eventType,
          bookingId: booking.id,
          accessLifecycle: 'PENDING_VERIFICATION',
          confirmationDelivered: Boolean(receipt),
        },
        { status: 202 },
      );
    }

    if (['reservation.modified', 'booking.modified', 'reservation_modified'].includes(eventType)) {
      await db.collection('bookings').doc(booking.id).set(
        {
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          numGuests: booking.numGuests,
          totalPrice: booking.totalPrice,
          status: 'modified',
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
      await queueAccessLifecycle(booking.id, booking.propertyId, 'RESCHEDULE');
      return NextResponse.json(
        { status: 'accepted', event: eventType, bookingId: booking.id },
        { status: 202 },
      );
    }

    if (['reservation.cancelled', 'booking.cancelled', 'reservation_cancelled'].includes(eventType)) {
      await db.collection('bookings').doc(booking.id).set(
        {
          status: 'cancelled',
          cancelledAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
      await queueAccessLifecycle(booking.id, booking.propertyId, 'REVOKE');
      return NextResponse.json(
        { status: 'accepted', event: eventType, bookingId: booking.id },
        { status: 202 },
      );
    }

    if (['guest.message', 'message.received'].includes(eventType)) {
      await db.collection('webhook_events').add({
        eventType,
        status: 'RECEIVED',
        receivedAt: Timestamp.now(),
      });
      return NextResponse.json(
        { status: 'received', event: eventType },
        { status: 202 },
      );
    }

    return NextResponse.json({ status: 'ignored', event: eventType });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Webhook processing failed';
    const status = error instanceof FirebaseUnavailableError ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) return NextResponse.json({ challenge });
  return NextResponse.json({
    status: 'active',
    version: '2.1.0',
    credentialAuthority: 'secure-tuya-access-lifecycle-only',
  });
}
