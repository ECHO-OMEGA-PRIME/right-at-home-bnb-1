import { NextRequest, NextResponse } from 'next/server';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_placeholder';

const processedEvents: any[] = [];

const bookingPayments: Record<string, any> = {
  'BK-001': {
    booking_id: 'BK-001',
    total_cents: 70363,
    status: 'pending',
    stripe_payment_intent: null,
    paid_at: null,
    refunded_at: null,
    refund_amount_cents: 0,
  },
};

// ── POST /api/webhooks/stripe ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 },
      );
    }

    // Verify signature (simplified — in production use stripe.webhooks.constructEvent)
    // For now: parse the body and validate structure
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    if (!event.id || !event.type || !event.data?.object) {
      return NextResponse.json(
        { error: 'Invalid Stripe event structure' },
        { status: 400 },
      );
    }

    // Idempotency check — don't process the same event twice
    if (processedEvents.find((e) => e.id === event.id)) {
      return NextResponse.json({
        received: true,
        message: 'Event already processed (idempotent)',
        event_id: event.id,
      });
    }

    const now = new Date().toISOString();
    const obj = event.data.object;

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const bookingId = obj.metadata?.booking_id;
        if (!bookingId) {
          processedEvents.push({ id: event.id, type: event.type, status: 'skipped', reason: 'no booking_id in metadata', at: now });
          return NextResponse.json({ received: true, message: 'No booking_id in metadata, skipped' });
        }

        // Update booking payment record
        if (!bookingPayments[bookingId]) {
          bookingPayments[bookingId] = {
            booking_id: bookingId,
            total_cents: obj.amount ?? 0,
            status: 'pending',
            stripe_payment_intent: null,
            paid_at: null,
            refunded_at: null,
            refund_amount_cents: 0,
          };
        }

        bookingPayments[bookingId].status = 'paid';
        bookingPayments[bookingId].stripe_payment_intent = obj.id;
        bookingPayments[bookingId].paid_at = now;

        processedEvents.push({
          id: event.id,
          type: event.type,
          status: 'processed',
          booking_id: bookingId,
          amount_cents: obj.amount,
          at: now,
        });

        return NextResponse.json({
          received: true,
          message: `Payment recorded for booking ${bookingId}`,
          amount_cents: obj.amount,
          booking_status: 'paid',
        });
      }

      case 'payment_intent.payment_failed': {
        const bookingId = obj.metadata?.booking_id;

        processedEvents.push({
          id: event.id,
          type: event.type,
          status: 'processed',
          booking_id: bookingId ?? null,
          failure_code: obj.last_payment_error?.code ?? 'unknown',
          failure_message: obj.last_payment_error?.message ?? 'Payment failed',
          at: now,
        });

        if (bookingId && bookingPayments[bookingId]) {
          bookingPayments[bookingId].status = 'failed';
        }

        return NextResponse.json({
          received: true,
          message: `Payment failed for ${bookingId ?? 'unknown booking'}`,
          failure_code: obj.last_payment_error?.code ?? 'unknown',
        });
      }

      case 'charge.refunded': {
        const bookingId = obj.metadata?.booking_id;
        const refundAmountCents = obj.amount_refunded ?? 0;

        processedEvents.push({
          id: event.id,
          type: event.type,
          status: 'processed',
          booking_id: bookingId ?? null,
          refund_amount_cents: refundAmountCents,
          at: now,
        });

        if (bookingId && bookingPayments[bookingId]) {
          bookingPayments[bookingId].status = 'refunded';
          bookingPayments[bookingId].refunded_at = now;
          bookingPayments[bookingId].refund_amount_cents = refundAmountCents;
        }

        return NextResponse.json({
          received: true,
          message: `Refund of $${(refundAmountCents / 100).toFixed(2)} processed for ${bookingId ?? 'unknown booking'}`,
          refund_amount_cents: refundAmountCents,
        });
      }

      case 'checkout.session.completed': {
        const bookingId = obj.metadata?.booking_id;

        processedEvents.push({
          id: event.id,
          type: event.type,
          status: 'processed',
          booking_id: bookingId ?? null,
          customer_email: obj.customer_details?.email ?? null,
          amount_total_cents: obj.amount_total ?? 0,
          at: now,
        });

        return NextResponse.json({
          received: true,
          message: `Checkout completed for ${bookingId ?? 'unknown booking'}`,
          amount_total_cents: obj.amount_total,
        });
      }

      default: {
        processedEvents.push({
          id: event.id,
          type: event.type,
          status: 'unhandled',
          at: now,
        });

        return NextResponse.json({
          received: true,
          message: `Unhandled event type: ${event.type}`,
        });
      }
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Webhook processing failed', detail: error.message },
      { status: 500 },
    );
  }
}
