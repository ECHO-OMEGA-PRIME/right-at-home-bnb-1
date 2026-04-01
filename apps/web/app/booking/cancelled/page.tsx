'use client';

/**
 * PayPal Booking Cancelled Page
 * Shown when guest cancels payment on PayPal checkout.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function CancelledContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams?.get('booking_id') ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md text-center bg-white rounded-2xl shadow-lg p-8">
        <div className="text-5xl mb-4">🏠</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Not Completed</h1>
        <p className="text-gray-600 mb-6">
          No worries! Your booking is saved and you can complete payment anytime.
        </p>

        {bookingId && (
          <p className="text-sm text-gray-500 mb-4">
            Booking ID: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{bookingId}</code>
          </p>
        )}

        <div className="space-y-3">
          <Link
            href="/properties"
            className="block bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            Browse Properties
          </Link>
          <Link href="/" className="block text-amber-600 hover:text-amber-800 underline text-sm">
            Return Home
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Questions? Email bookings@rightathomebnb.com
        </p>
      </div>
    </div>
  );
}

export default function BookingCancelledPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <CancelledContent />
    </Suspense>
  );
}
