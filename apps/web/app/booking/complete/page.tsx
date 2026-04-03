'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle, Loader2, XCircle, Mail, Phone, Home, ArrowRight,
} from 'lucide-react';

interface CaptureResult {
  success: boolean;
  confirmCode: string;
  transactionId: string;
  invoiceId: string;
  invoiceUrl: string;
}

export default function BookingCompletePage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function capturePayment() {
      // PayPal returns with ?token=ORDER_ID on the return URL
      const paypalToken = searchParams.get('token');
      const bookingId = sessionStorage.getItem('rah_booking_id');
      const storedOrder = sessionStorage.getItem('rah_paypal_order');

      const paypalOrderId = paypalToken || storedOrder;

      if (!paypalOrderId || !bookingId) {
        setStatus('error');
        setErrorMsg('Missing booking information. Please try booking again.');
        return;
      }

      try {
        const res = await fetch('/api/bookings/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paypalOrderId, bookingId }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setErrorMsg(data.error || 'Payment capture failed');
          return;
        }

        setResult(data);
        setStatus('success');

        // Clean up session storage
        sessionStorage.removeItem('rah_booking_id');
        sessionStorage.removeItem('rah_paypal_order');
      } catch {
        setStatus('error');
        setErrorMsg('Failed to confirm payment. Please contact us.');
      }
    }

    capturePayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0505] flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Loading */}
        {status === 'loading' && (
          <div className="text-center py-16">
            <Loader2 className="w-12 h-12 text-[#C4A777] animate-spin mx-auto mb-4" />
            <h1 className="font-playfair text-2xl text-white mb-2">Confirming Your Booking</h1>
            <p className="text-white/60">Processing your PayPal payment...</p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && result && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>

            <h1 className="font-playfair text-3xl text-white mb-2">Booking Confirmed!</h1>
            <p className="text-white/60 mb-6">
              Your reservation is all set. We can&apos;t wait to host you!
            </p>

            {/* Confirmation Details */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-left">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Confirmation Code</span>
                  <span className="text-[#C4A777] font-mono font-semibold">{result.confirmCode}</span>
                </div>
                {result.transactionId && (
                  <div className="flex justify-between">
                    <span className="text-white/50">Transaction ID</span>
                    <span className="text-white/70 font-mono text-xs">{result.transactionId}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice notice */}
            <div className="bg-[#C4A777]/10 border border-[#C4A777]/20 rounded-xl p-4 mb-6 flex items-center gap-3">
              <Mail className="w-5 h-5 text-[#C4A777] shrink-0" />
              <p className="text-white/80 text-sm text-left">
                Your invoice has been sent to your email. Check your inbox for the full receipt.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <a
                href="tel:+14325551234"
                className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10
                         text-white py-3 px-6 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                <Phone className="w-4 h-4 text-[#C4A777]" />
                Contact Steven — (432) 555-1234
              </a>
              <Link
                href="/properties"
                className="w-full flex items-center justify-center gap-2 bg-[#C4A777] text-[#0a0505]
                         font-semibold py-3 px-6 rounded-xl hover:bg-[#d4b787] transition-colors"
              >
                <Home className="w-4 h-4" />
                Browse More Properties
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>

            <h1 className="font-playfair text-2xl text-white mb-2">Something Went Wrong</h1>
            <p className="text-white/60 mb-4">{errorMsg}</p>

            <div className="space-y-3">
              <a
                href="tel:+14325551234"
                className="w-full flex items-center justify-center gap-2 bg-[#500000] text-white
                         py-3 px-6 rounded-xl hover:bg-[#600000] transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call Steven for Help
              </a>
              <Link
                href="/properties"
                className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10
                         text-white/70 py-3 px-6 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                Back to Properties
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
