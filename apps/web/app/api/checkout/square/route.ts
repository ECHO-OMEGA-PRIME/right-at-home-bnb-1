/**
 * Right at Home BnB - Square Payment API
 * Alternative payment processing via Square
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// Square API Configuration
const SQUARE_API_BASE = 'https://connect.squareup.com/v2';
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID;
const SQUARE_APPLICATION_ID = process.env.SQUARE_APPLICATION_ID;

export interface SquarePaymentRequest {
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  nights: number;
  totalAmount: number; // In dollars
  sourceId: string; // Payment token from Square Web SDK
  guestEmail?: string;
  guestName?: string;
  verificationToken?: string;
}

async function squareRequest(endpoint: string, method: string, body?: any) {
  const response = await fetch(`${SQUARE_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Square-Version': '2024-01-18',
      'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.errors?.[0]?.detail || 'Square API error');
  }

  return data;
}

// POST - Process Square payment
export async function POST(request: NextRequest) {
  try {
    // Check if Square is configured
    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
      return NextResponse.json(
        { error: 'Square payments not configured', code: 'NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    const body: SquarePaymentRequest = await request.json();
    const {
      propertyId,
      propertyName,
      checkIn,
      checkOut,
      guestCount,
      nights,
      totalAmount,
      sourceId,
      guestEmail,
      guestName,
      verificationToken,
    } = body;

    // Validate required fields
    if (!sourceId || !totalAmount || !propertyId) {
      return NextResponse.json(
        { error: 'Missing required payment information' },
        { status: 400 }
      );
    }

    // Create idempotency key to prevent duplicate charges
    const idempotencyKey = randomUUID();

    // Create Square payment
    const paymentRequest = {
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      amount_money: {
        amount: Math.round(totalAmount * 100), // Square uses cents
        currency: 'USD',
      },
      location_id: SQUARE_LOCATION_ID,
      note: `${propertyName} | ${checkIn} to ${checkOut} | ${guestCount} guests`,
      reference_id: `${propertyId}_${Date.now()}`,
      buyer_email_address: guestEmail,
      ...(verificationToken && { verification_token: verificationToken }),
    };

    const paymentResult = await squareRequest('/payments', 'POST', paymentRequest);

    // Return success
    return NextResponse.json({
      success: true,
      paymentId: paymentResult.payment.id,
      status: paymentResult.payment.status,
      receiptUrl: paymentResult.payment.receipt_url,
      cardDetails: {
        brand: paymentResult.payment.card_details?.card?.card_brand,
        last4: paymentResult.payment.card_details?.card?.last_4,
      },
      metadata: {
        propertyId,
        propertyName,
        checkIn,
        checkOut,
        guestCount,
        nights,
        guestName,
      },
    });

  } catch (error: any) {
    console.error('Square payment error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment processing failed' },
      { status: 500 }
    );
  }
}

// GET - Retrieve payment details or application info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('payment_id');

    // If payment_id provided, fetch payment details
    if (paymentId) {
      if (!SQUARE_ACCESS_TOKEN) {
        return NextResponse.json(
          { error: 'Square not configured' },
          { status: 503 }
        );
      }

      const paymentResult = await squareRequest(`/payments/${paymentId}`, 'GET');
      return NextResponse.json({
        payment: paymentResult.payment,
      });
    }

    // Otherwise return Square application config for client SDK
    return NextResponse.json({
      applicationId: SQUARE_APPLICATION_ID,
      locationId: SQUARE_LOCATION_ID,
      configured: !!(SQUARE_ACCESS_TOKEN && SQUARE_LOCATION_ID && SQUARE_APPLICATION_ID),
    });

  } catch (error: any) {
    console.error('Square retrieval error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve information' },
      { status: 500 }
    );
  }
}
