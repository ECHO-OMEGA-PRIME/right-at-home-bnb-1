/**
 * VRBO/Expedia webhook intake.
 *
 * Reservation metadata only. Access credentials are exclusively managed by the
 * authenticated Tuya access lifecycle and are never generated, stored, emailed,
 * logged, or returned here.
 *
 * Storage is Postgres. This route used to write reservations into a Firestore
 * `bookings` collection -- a THIRD store for data whose system of record is the
 * Postgres `Booking` table that `/api/bookings` and the whole product read. A
 * booking that arrived through this webhook was therefore invisible to the
 * application, and once the Google billing accounts closed and Firestore began
 * answering 429 RESOURCE_EXHAUSTED, inbound reservations stopped being recorded
 * anywhere at all.
 *
 * Signature verification is unchanged: HMAC-SHA256 over the raw body, compared
 * in constant time. This endpoint is in the middleware's PUBLIC_API_PREFIXES,
 * so that signature is the ONLY thing standing in front of it.
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deliverSensitiveGuestMessage } from '@/lib/secure-notifications';

export const dynamic = 'force-dynamic';

const PLATFORM = 'VRBO';

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

type Reservation = ReturnType<typeof reservationFrom>;

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/**
 * Resolve the channel guest to a CRM row.
 *
 * `Booking.guestId` is required and `Guest.email` is unique, so a reservation
 * with no email still needs one. It gets a deterministic placeholder on the
 * RFC 2606 `.invalid` TLD: deterministic so a webhook retry resolves to the
 * same guest instead of creating another, and `.invalid` because that domain
 * can never resolve, so no confirmation can ever be sent to a fabricated
 * address by accident. It is obviously synthetic to anyone reading the CRM.
 */
async function resolveGuest(reservation: Reservation): Promise<string> {
  const email =
    reservation.guestEmail.trim().toLowerCase() ||
    `vrbo+${reservation.id}@no-email.invalid`;

  const guest = await prisma.guest.upsert({
    where: { email },
    update: {
      // Never null out CRM detail a real booking flow may have filled in.
      ...(reservation.guestName ? { name: reservation.guestName } : {}),
      ...(reservation.guestPhone ? { phone: reservation.guestPhone } : {}),
      platform: PLATFORM,
    },
    create: {
      email,
      name: reservation.guestName || 'Guest',
      phone: reservation.guestPhone || null,
      platform: PLATFORM,
      platformId: reservation.id,
    },
    select: { id: true },
  });

  return guest.id;
}

async function queueAccessLifecycle(
  bookingRef: string,
  propertyId: string | null,
  action: 'PROVISION' | 'RESCHEDULE' | 'REVOKE',
) {
  // Upsert on (bookingRef, action) reproduces the Firestore document id
  // `${bookingId}_${action}`: re-delivering a webhook cannot enqueue the same
  // work twice.
  await prisma.accessLifecycleQueue.upsert({
    where: { bookingRef_action: { bookingRef, action } },
    update: { status: 'PENDING_VERIFICATION', propertyId },
    create: {
      bookingRef,
      propertyId,
      action,
      status: 'PENDING_VERIFICATION',
      containsCredential: false,
    },
  });
}

async function recordEvent(eventType: string, status: string, error?: string) {
  // SyncLog is the existing channel-activity audit; `webhook_events` was a
  // Firestore collection doing the same job with no reader.
  await prisma.syncLog
    .create({
      data: {
        syncType: `webhook_${eventType}`,
        source: 'vrbo',
        status,
        errorMessage: error ?? null,
      },
    })
    .catch(() => {
      /* the audit must never be what fails the webhook */
    });
}

async function sendReservationConfirmation(reservation: Reservation, propertyName: string) {
  if (!reservation.guestEmail && !reservation.guestPhone) return null;
  const message = [
    `Your reservation at ${propertyName} is confirmed.`,
    `Check-in: ${reservation.checkIn || 'See reservation'}`,
    `Check-out: ${reservation.checkOut || 'See reservation'}`,
    'Temporary door access and private stay details are delivered separately through the secure access lifecycle shortly before check-in.',
    'This message intentionally contains no door code or Wi-Fi password.',
  ].join('\n');
  return deliverSensitiveGuestMessage({
    email: reservation.guestEmail || null,
    phone: reservation.guestPhone || null,
    subject: `Reservation confirmed: ${propertyName}`,
    message,
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.VRBO_WEBHOOK_SECRET || process.env.EXPEDIA_SECRET || '';
  const allowUnsignedDev =
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_UNSIGNED_VRBO_WEBHOOK === 'true';

  if (!secret && !allowUnsignedDev) {
    return NextResponse.json({ error: 'Webhook verification is not configured' }, { status: 503 });
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
    const eventType = String(payload.event_type || payload.eventType || payload.event || 'unknown');
    const reservation = reservationFrom(payload);

    const isMessage = eventType === 'guest.message' || eventType === 'message.received';
    if (!reservation.id && !isMessage) {
      return NextResponse.json({ error: 'Reservation identifier required' }, { status: 400 });
    }

    const externalRef = reservation.id;
    const identity = { platform_externalRef: { platform: PLATFORM, externalRef } };

    if (['reservation.created', 'booking.created', 'reservation_created'].includes(eventType)) {
      const checkIn = parseDate(reservation.checkIn);
      const checkOut = parseDate(reservation.checkOut);

      // Postgres requires both dates. Firestore accepted nulls and produced a
      // booking nothing could schedule -- refusing is the honest answer, and
      // the channel will retry a delivery we rejected.
      if (!checkIn || !checkOut) {
        await recordEvent(eventType, 'failed', 'missing or invalid check-in/check-out');
        return NextResponse.json(
          { error: 'Valid checkIn and checkOut are required' },
          { status: 400 },
        );
      }

      const property = reservation.propertyId
        ? await prisma.property.findUnique({
            where: { id: reservation.propertyId },
            select: { id: true, name: true },
          })
        : null;

      if (!property) {
        await recordEvent(eventType, 'failed', `unknown property ${reservation.propertyId}`);
        return NextResponse.json({ error: 'Unknown property' }, { status: 400 });
      }

      const guestId = await resolveGuest(reservation);
      const totalNights = nightsBetween(checkIn, checkOut);
      const totalPrice = Number.isFinite(reservation.totalPrice) ? reservation.totalPrice : 0;
      // The channel sends a total, not a rate. Deriving it keeps the column
      // meaningful rather than storing 0 against a real reservation.
      const nightlyRate = totalNights > 0 ? totalPrice / totalNights : totalPrice;

      const booking = await prisma.booking.upsert({
        where: identity,
        update: {
          checkIn,
          checkOut,
          guestCount: reservation.numGuests,
          totalPrice,
          subtotal: totalPrice,
          totalNights,
          nightlyRate,
          status: 'CONFIRMED',
          confirmCode: reservation.confirmationCode,
        },
        create: {
          propertyId: property.id,
          guestId,
          externalRef,
          platform: PLATFORM,
          checkIn,
          checkOut,
          guestCount: reservation.numGuests,
          nightlyRate,
          totalNights,
          subtotal: totalPrice,
          totalPrice,
          status: 'CONFIRMED',
          confirmCode: reservation.confirmationCode,
        },
        select: { id: true },
      });

      const receipt = await sendReservationConfirmation(reservation, property.name).catch(
        () => null,
      );
      await queueAccessLifecycle(externalRef, property.id, 'PROVISION');
      await recordEvent(eventType, 'success');

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
      const checkIn = parseDate(reservation.checkIn);
      const checkOut = parseDate(reservation.checkOut);
      const totalPrice = Number.isFinite(reservation.totalPrice) ? reservation.totalPrice : 0;

      // updateMany, not update: a modification for a reservation we never
      // received must not throw. count === 0 says so plainly.
      const result = await prisma.booking.updateMany({
        where: { platform: PLATFORM, externalRef },
        data: {
          ...(checkIn ? { checkIn } : {}),
          ...(checkOut ? { checkOut } : {}),
          ...(checkIn && checkOut ? { totalNights: nightsBetween(checkIn, checkOut) } : {}),
          guestCount: reservation.numGuests,
          totalPrice,
          subtotal: totalPrice,
          status: 'MODIFIED',
        },
      });

      if (result.count === 0) {
        await recordEvent(eventType, 'failed', `no booking for reservation ${externalRef}`);
        return NextResponse.json({ error: 'Unknown reservation' }, { status: 404 });
      }

      await queueAccessLifecycle(externalRef, reservation.propertyId || null, 'RESCHEDULE');
      await recordEvent(eventType, 'success');
      return NextResponse.json(
        { status: 'accepted', event: eventType, bookingId: externalRef },
        { status: 202 },
      );
    }

    if (['reservation.cancelled', 'booking.cancelled', 'reservation_cancelled'].includes(eventType)) {
      // REVOKE is queued FIRST and unconditionally. Withdrawing door access is
      // the safety-critical half of a cancellation and must not be contingent on
      // our having recorded the booking -- if anything, not knowing the
      // reservation is a reason to be more eager to revoke, not less.
      await queueAccessLifecycle(externalRef, reservation.propertyId || null, 'REVOKE');

      const result = await prisma.booking.updateMany({
        where: { platform: PLATFORM, externalRef },
        data: { status: 'CANCELLED' },
      });

      // 202 even when we hold no booking: the revocation succeeded, and a
      // channel redelivery cannot conjure a booking we never received. The
      // missing row is surfaced in the response and the audit rather than
      // hidden behind a retry loop that can never converge.
      await recordEvent(
        eventType,
        result.count === 0 ? 'partial' : 'success',
        result.count === 0 ? `revoked access; no booking row for ${externalRef}` : undefined,
      );

      return NextResponse.json(
        {
          status: 'accepted',
          event: eventType,
          bookingId: externalRef,
          bookingKnown: result.count > 0,
          accessLifecycle: 'PENDING_VERIFICATION',
        },
        { status: 202 },
      );
    }

    if (isMessage) {
      await recordEvent(eventType, 'success');
      return NextResponse.json({ status: 'received', event: eventType }, { status: 202 });
    }

    return NextResponse.json({ status: 'ignored', event: eventType });
  } catch (error) {
    console.error('[vrbo-webhook] processing failed', error);
    // The store being down is a retryable 503, not a 500: the channel redelivers
    // on 5xx, and a 503 says which kind of failure this was.
    return NextResponse.json(
      { error: 'Webhook processing failed', code: 'WEBHOOK_STORE_UNAVAILABLE' },
      { status: 503, headers: { 'Retry-After': '30' } },
    );
  }
}

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) return NextResponse.json({ challenge });
  return NextResponse.json({
    status: 'active',
    version: '3.0.0',
    credentialAuthority: 'secure-tuya-access-lifecycle-only',
  });
}
