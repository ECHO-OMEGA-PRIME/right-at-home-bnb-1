/**
 * Right at Home BnB - Stripe Checkout API
 * Creates checkout sessions for booking payments
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export interface CheckoutRequest {
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  nightlyRate: number;
  nights: number;
  cleaningFee?: number;
  serviceFee?: number;
  taxes?: number;
  guestEmail?: string;
  guestName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequest = await request.json();
    const {
      propertyId,
      propertyName,
      checkIn,
      checkOut,
      guestCount,
      nightlyRate,
      nights,
      cleaningFee = 85,
      serviceFee = 0,
      taxes = 0,
      guestEmail,
      guestName,
    } = body;

    // Validate required fields
    if (!propertyId || !propertyName || !checkIn || !checkOut || !nights || !nightlyRate) {
      return NextResponse.json(
        { error: 'Missing required booking information' },
        { status: 400 }
      );
    }

    // Calculate totals
    const subtotal = nightlyRate * nights;
    const totalBeforeTax = subtotal + cleaningFee + serviceFee;
    const calculatedTax = taxes || Math.round(totalBeforeTax * 0.0825); // 8.25% TX tax
    const totalAmount = totalBeforeTax + calculatedTax;

    // Build line items for Stripe
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${propertyName} - ${nights} Night${nights > 1 ? 's' : ''}`,
            description: `${checkIn} to ${checkOut} • ${guestCount} Guest${guestCount > 1 ? 's' : ''}`,
            images: [], // Could add property image URL here
          },
          unit_amount: subtotal * 100, // Stripe uses cents
        },
        quantity: 1,
      },
    ];

    // Add cleaning fee as separate line item
    if (cleaningFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Cleaning Fee',
            description: 'Professional cleaning service',
          },
          unit_amount: cleaningFee * 100,
        },
        quantity: 1,
      });
    }

    // Add service fee if applicable
    if (serviceFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Service Fee',
          },
          unit_amount: serviceFee * 100,
        },
        quantity: 1,
      });
    }

    // Add tax line item
    if (calculatedTax > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Occupancy Tax',
            description: 'Texas lodging tax',
          },
          unit_amount: calculatedTax * 100,
        },
        quantity: 1,
      });
    }

    // Get base URL for success/cancel redirects
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${baseUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/properties/${propertyId}?cancelled=true`,
      customer_email: guestEmail,
      metadata: {
        propertyId,
        propertyName,
        checkIn,
        checkOut,
        guestCount: guestCount.toString(),
        nights: nights.toString(),
        guestName: guestName || '',
      },
      payment_intent_data: {
        metadata: {
          propertyId,
          checkIn,
          checkOut,
        },
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      totalAmount,
    });

  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

// GET - Retrieve session details (for success page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'line_items'],
    });

    return NextResponse.json({
      status: session.payment_status,
      customerEmail: session.customer_email,
      amountTotal: session.amount_total ? session.amount_total / 100 : 0,
      metadata: session.metadata,
      paymentIntent: session.payment_intent,
    });

  } catch (error: any) {
    console.error('Session retrieval error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}
