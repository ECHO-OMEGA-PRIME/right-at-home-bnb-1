'use client';

/**
 * PayPal Booking Confirmation Page
 * ================================
 * Handles the PayPal return redirect after guest approves payment.
 * Captures the payment and shows confirmation details.
 *
 * URL: /booking/confirm?booking_id=xxx
 *
 * @author ECHO OMEGA PRIME
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

interface ConfirmationData {
  success: boolean;
  booking_id: string;
  confirmation_code: string;
  status: string;
  capture_id?: string;
  message: string;
}

interface BookingDetail {
  id: string;
  property_name: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  confirmation_code: string;
  guest_info: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  price_breakdown: {
    total: number;
    total_with_deposit: number;
    savings: number;
    savings_percentage: number;
    security_deposit: number;
  };
}

function ConfirmContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams?.get('booking_id') ?? null;
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [confirmCode, setConfirmCode] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setError('No booking ID provided');
      setLoading(false);
      return;
    }

    const captureAndConfirm = async () => {
      try {
        // Capture the PayPal payment
        const captureRes = await fetch(`${API_BASE}/book/payment/capture/${bookingId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const captureData: ConfirmationData = await captureRes.json();

        if (captureData.success) {
          setConfirmed(true);
          setConfirmCode(captureData.confirmation_code);

          // Fetch full booking details
          const bookingRes = await fetch(`${API_BASE}/book/${bookingId}`);
          if (bookingRes.ok) {
            const bookingData = await bookingRes.json();
            setBooking(bookingData);
          }
        } else {
          setError(captureData.message || 'Payment capture failed. Please contact us.');
        }
      } catch {
        setError('Network error confirming payment. Please contact us with your booking ID.');
      } finally {
        setLoading(false);
      }
    };

    captureAndConfirm();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-lg text-gray-600">Confirming your payment...</p>
          <p className="text-sm text-gray-400 mt-1">Please do not close this page</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-lg p-8">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-700 mb-2">Payment Issue</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          {bookingId && (
            <p className="text-sm text-gray-500 mb-4">
              Booking ID: <code className="bg-gray-100 px-2 py-1 rounded">{bookingId}</code>
            </p>
          )}
          <div className="space-y-3">
            <a
              href="mailto:bookings@rightathomebnb.com"
              className="block bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg"
            >
              Contact Us
            </a>
            <Link href="/" className="block text-amber-600 hover:text-amber-800 underline">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-700 text-white p-8 text-center">
          <div className="text-6xl mb-3">✅</div>
          <h1 className="text-3xl font-bold">Booking Confirmed!</h1>
          <p className="text-green-100 mt-2">Payment received via PayPal</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Confirmation Code */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center">
            <p className="text-sm text-amber-600 font-medium">Your Confirmation Code</p>
            <p className="text-4xl font-mono font-bold text-amber-800 mt-1">
              {confirmCode || booking?.confirmation_code}
            </p>
            <p className="text-xs text-amber-500 mt-2">Save this code for your records</p>
          </div>

          {/* Booking Details */}
          {booking && (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-800 text-lg">{booking.property_name}</h2>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Check-in</p>
                  <p className="font-semibold">{booking.check_in}</p>
                  <p className="text-xs text-gray-400">3:00 PM</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Check-out</p>
                  <p className="font-semibold">{booking.check_out}</p>
                  <p className="text-xs text-gray-400">11:00 AM</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Guests</span>
                  <span className="font-semibold">{booking.guest_count}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Total Paid</span>
                  <span className="font-semibold">
                    ${booking.price_breakdown.total_with_deposit.toFixed(2)}
                  </span>
                </div>
                {booking.price_breakdown.savings > 0 && (
                  <div className="flex justify-between mt-1 text-green-600">
                    <span>Saved vs VRBO/Airbnb</span>
                    <span className="font-semibold">
                      ${booking.price_breakdown.savings.toFixed(2)} (
                      {booking.price_breakdown.savings_percentage.toFixed(0)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* What's Next */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">What Happens Next</h3>
            <ul className="text-blue-700 text-sm space-y-2">
              <li className="flex gap-2">
                <span>📧</span>
                <span>Confirmation email sent to {booking?.guest_info.email}</span>
              </li>
              <li className="flex gap-2">
                <span>📝</span>
                <span>Complete your waivers (links in email)</span>
              </li>
              <li className="flex gap-2">
                <span>🔑</span>
                <span>Door code texted 24 hours before check-in</span>
              </li>
              <li className="flex gap-2">
                <span>📞</span>
                <span>Steven available for any questions</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href="/"
              className="flex-1 text-center border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:bg-gray-50"
            >
              Return Home
            </Link>
            <Link
              href="/properties"
              className="flex-1 text-center bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg"
            >
              Browse Properties
            </Link>
          </div>

          <p className="text-center text-xs text-gray-400">
            Thank you for booking direct with Right At Home BnB - Midland, TX
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BookingConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
