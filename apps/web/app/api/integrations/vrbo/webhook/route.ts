import { NextRequest, NextResponse } from 'next/server';
import {
  verifyWebhookSignature,
  parseWebhookEvent,
  getActionsForEvent,
} from '@/lib/integrations/vrbo-client';
import type {
  VrboWebhookEvent,
  VrboReservation,
  VrboMessage,
} from '@/lib/integrations/vrbo-client';

// ---------------------------------------------------------------------------
// VRBO Webhook Receiver
// ---------------------------------------------------------------------------
// Accepts real-time notifications from VRBO for:
//   - reservation.created / reservation.modified / reservation.cancelled
//   - message.received
//
// Each event triggers the appropriate downstream actions (lock codes,
// thermostat scheduling, cleaning tasks, calendar sync, guest messaging).
// ---------------------------------------------------------------------------

/** Resolve the base URL for internal API calls. */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

/**
 * Map a VRBO listing / property ID to the internal Right-at-Home property ID.
 *
 * The mapping is stored in the VRBO_PROPERTY_MAP env var as a JSON string:
 *   { "vrbo-listing-123": "prop_midland_main", ... }
 *
 * Falls back to the raw VRBO ID prefixed with "vrbo_" when no mapping exists.
 */
function resolvePropertyId(vrboPropertyId: string): string {
  const raw = process.env.VRBO_PROPERTY_MAP;
  if (raw) {
    try {
      const map: Record<string, string> = JSON.parse(raw);
      if (map[vrboPropertyId]) {
        return map[vrboPropertyId];
      }
    } catch {
      console.error('[vrbo-webhook] Failed to parse VRBO_PROPERTY_MAP env var');
    }
  }
  return `vrbo_${vrboPropertyId}`;
}

// ---------------------------------------------------------------------------
// Internal API helpers
// ---------------------------------------------------------------------------

async function createBooking(reservation: VrboReservation, propertyId: string) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'vrbo',
      sourceReservationId: reservation.reservationId,
      propertyId,
      guestName: reservation.guestName,
      guestEmail: reservation.guestEmail,
      guestPhone: reservation.guestPhone ?? null,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      guests: reservation.numberOfGuests,
      totalPrice: reservation.totalPrice,
      currency: reservation.currency ?? 'USD',
      status: 'confirmed',
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`createBooking failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function updateBooking(reservation: VrboReservation, propertyId: string) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/bookings/${reservation.reservationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'vrbo',
      propertyId,
      guestName: reservation.guestName,
      guestEmail: reservation.guestEmail,
      guestPhone: reservation.guestPhone ?? null,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      guests: reservation.numberOfGuests,
      totalPrice: reservation.totalPrice,
      currency: reservation.currency ?? 'USD',
      status: 'confirmed',
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`updateBooking failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function cancelBooking(reservationId: string) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/bookings/${reservationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`cancelBooking failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function generateLockCode(
  propertyId: string,
  reservationId: string,
  checkIn: string,
  checkOut: string,
) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/smart-home/locks/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId,
      reservationId,
      validFrom: checkIn,
      validUntil: checkOut,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`generateLockCode failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function revokeLockCode(propertyId: string, reservationId: string) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/smart-home/locks/code`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, reservationId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`revokeLockCode failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function scheduleThermostat(
  propertyId: string,
  checkIn: string,
  checkOut: string,
) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/smart-home/thermostat/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId,
      mode: 'guest',
      activeFrom: checkIn,
      activeUntil: checkOut,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`scheduleThermostat failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function revertThermostat(propertyId: string) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/smart-home/thermostat/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId,
      mode: 'away',
      activeFrom: new Date().toISOString(),
      activeUntil: null,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`revertThermostat failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function createCleaningTask(
  propertyId: string,
  reservationId: string,
  checkOut: string,
) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/tasks/cleaning`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId,
      reservationId,
      scheduledFor: checkOut,
      type: 'turnover',
      status: 'pending',
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`createCleaningTask failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function cancelCleaningTask(reservationId: string) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/tasks/cleaning/${reservationId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`cancelCleaningTask failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function sendWelcomeMessage(
  guestName: string,
  guestEmail: string,
  propertyId: string,
  checkIn: string,
) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/messaging/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: guestEmail,
      template: 'welcome',
      data: {
        guestName,
        propertyId,
        checkIn,
      },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`sendWelcomeMessage failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function syncCalendar(propertyId: string) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/integrations/calendar/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`syncCalendar failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function routeToStevenAI(message: VrboMessage, propertyId: string) {
  const base = getBaseUrl();
  const response = await fetch(`${base}/api/concierge/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'vrbo',
      propertyId,
      conversationId: message.conversationId,
      senderName: message.senderName,
      senderEmail: message.senderEmail ?? null,
      content: message.content,
      receivedAt: message.timestamp,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`routeToStevenAI failed (${response.status}): ${text}`);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Orchestration per event type
// ---------------------------------------------------------------------------

async function handleReservationCreated(reservation: VrboReservation) {
  const propertyId = resolvePropertyId(reservation.propertyId);
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // 1. Create booking record
  try {
    results.booking = await createBooking(reservation, propertyId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`createBooking: ${msg}`);
  }

  // 2. Generate smart lock code
  try {
    results.lockCode = await generateLockCode(
      propertyId,
      reservation.reservationId,
      reservation.checkIn,
      reservation.checkOut,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`generateLockCode: ${msg}`);
  }

  // 3. Schedule thermostat for guest arrival
  try {
    results.thermostat = await scheduleThermostat(
      propertyId,
      reservation.checkIn,
      reservation.checkOut,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`scheduleThermostat: ${msg}`);
  }

  // 4. Create turnover cleaning task
  try {
    results.cleaning = await createCleaningTask(
      propertyId,
      reservation.reservationId,
      reservation.checkOut,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`createCleaningTask: ${msg}`);
  }

  // 5. Send guest welcome message
  try {
    results.welcomeMessage = await sendWelcomeMessage(
      reservation.guestName,
      reservation.guestEmail,
      propertyId,
      reservation.checkIn,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`sendWelcomeMessage: ${msg}`);
  }

  // 6. Sync calendar across platforms
  try {
    results.calendarSync = await syncCalendar(propertyId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`syncCalendar: ${msg}`);
  }

  return { event: 'reservation.created', propertyId, results, errors };
}

async function handleReservationModified(reservation: VrboReservation) {
  const propertyId = resolvePropertyId(reservation.propertyId);
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // 1. Update booking record
  try {
    results.booking = await updateBooking(reservation, propertyId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`updateBooking: ${msg}`);
  }

  // 2. Regenerate lock code (dates may have changed)
  try {
    await revokeLockCode(propertyId, reservation.reservationId);
    results.lockCode = await generateLockCode(
      propertyId,
      reservation.reservationId,
      reservation.checkIn,
      reservation.checkOut,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`regenerateLockCode: ${msg}`);
  }

  // 3. Reschedule thermostat
  try {
    results.thermostat = await scheduleThermostat(
      propertyId,
      reservation.checkIn,
      reservation.checkOut,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`rescheduleThermostat: ${msg}`);
  }

  // 4. Reschedule cleaning task (cancel old, create new)
  try {
    await cancelCleaningTask(reservation.reservationId);
    results.cleaning = await createCleaningTask(
      propertyId,
      reservation.reservationId,
      reservation.checkOut,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`rescheduleCleaning: ${msg}`);
  }

  // 5. Sync calendar
  try {
    results.calendarSync = await syncCalendar(propertyId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`syncCalendar: ${msg}`);
  }

  return { event: 'reservation.modified', propertyId, results, errors };
}

async function handleReservationCancelled(reservation: VrboReservation) {
  const propertyId = resolvePropertyId(reservation.propertyId);
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // 1. Cancel booking
  try {
    results.booking = await cancelBooking(reservation.reservationId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`cancelBooking: ${msg}`);
  }

  // 2. Revoke lock code
  try {
    results.lockCode = await revokeLockCode(propertyId, reservation.reservationId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`revokeLockCode: ${msg}`);
  }

  // 3. Revert thermostat to away mode
  try {
    results.thermostat = await revertThermostat(propertyId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`revertThermostat: ${msg}`);
  }

  // 4. Cancel cleaning task
  try {
    results.cleaning = await cancelCleaningTask(reservation.reservationId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`cancelCleaningTask: ${msg}`);
  }

  // 5. Sync calendar
  try {
    results.calendarSync = await syncCalendar(propertyId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`syncCalendar: ${msg}`);
  }

  return { event: 'reservation.cancelled', propertyId, results, errors };
}

async function handleMessageReceived(message: VrboMessage) {
  const propertyId = resolvePropertyId(message.propertyId);
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  try {
    results.concierge = await routeToStevenAI(message, propertyId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`routeToStevenAI: ${msg}`);
  }

  return { event: 'message.received', propertyId, results, errors };
}

// ---------------------------------------------------------------------------
// POST /api/integrations/vrbo/webhook
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Read raw body for signature verification
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: 'Failed to read request body' },
      { status: 400 },
    );
  }

  if (!rawBody || rawBody.trim().length === 0) {
    return NextResponse.json(
      { error: 'Empty request body' },
      { status: 400 },
    );
  }

  // Verify webhook signature
  const signature = request.headers.get('x-vrbo-signature') ?? '';
  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    console.error('[vrbo-webhook] Invalid webhook signature');
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 401 },
    );
  }

  // Parse event payload
  let event: VrboWebhookEvent;
  try {
    event = parseWebhookEvent(rawBody);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[vrbo-webhook] Failed to parse event: ${msg}`);
    return NextResponse.json(
      { error: 'Invalid event payload', details: msg },
      { status: 400 },
    );
  }

  const actions = getActionsForEvent(event);
  console.log(
    `[vrbo-webhook] Received event: ${event.eventType} | actions: ${actions.join(', ')}`,
  );

  // Route to handler based on event type
  let result: Record<string, unknown>;

  try {
    switch (event.eventType) {
      case 'reservation.created': {
        const reservation = event.data as VrboReservation;
        result = await handleReservationCreated(reservation);
        break;
      }

      case 'reservation.modified': {
        const reservation = event.data as VrboReservation;
        result = await handleReservationModified(reservation);
        break;
      }

      case 'reservation.cancelled': {
        const reservation = event.data as VrboReservation;
        result = await handleReservationCancelled(reservation);
        break;
      }

      case 'message.received': {
        const message = event.data as VrboMessage;
        result = await handleMessageReceived(message);
        break;
      }

      default:
        console.warn(`[vrbo-webhook] Unhandled event type: ${event.eventType}`);
        return NextResponse.json(
          {
            status: 'ignored',
            eventType: event.eventType,
            message: 'Event type not handled',
          },
          { status: 200 },
        );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[vrbo-webhook] Handler error for ${event.eventType}: ${msg}`);
    return NextResponse.json(
      {
        status: 'error',
        eventType: event.eventType,
        error: msg,
      },
      { status: 500 },
    );
  }

  const durationMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: 'processed',
      eventType: event.eventType,
      actions,
      durationMs,
      ...result,
    },
    { status: 200 },
  );
}

// ---------------------------------------------------------------------------
// GET /api/integrations/vrbo/webhook -- Health check
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'vrbo-webhook-receiver',
    version: '1.0.0',
    acceptedEvents: [
      'reservation.created',
      'reservation.modified',
      'reservation.cancelled',
      'message.received',
    ],
    timestamp: new Date().toISOString(),
  });
}
