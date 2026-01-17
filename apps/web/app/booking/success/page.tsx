'use client';

/**
 * Right at Home BnB - Booking Success Page
 * Confirmation page after successful payment
 * @author ECHO OMEGA PRIME
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CheckCircle, Calendar, MapPin, Users, Mail,
  Phone, Download, Share2, Home, ArrowRight, Loader2
} from 'lucide-react';

interface BookingDetails {
  status: string;
  customerEmail: string;
  amountTotal: number;
  metadata: {
    propertyId: string;
    propertyName: string;
    checkIn: string;
    checkOut: string;
    guestCount: string;
    nights: string;
    guestName?: string;
  };
}

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id') ?? null;
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBookingDetails() {
      if (!sessionId) {
        setError('No booking session found');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/checkout?session_id=${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch booking details');
        const data = await response.json();
        setBooking(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchBookingDetails();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#500000] animate-spin mx-auto mb-4" />
          <p className="text-[#2D2D2D]/60">Loading your booking confirmation...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D] mb-2">
            Booking Not Found
          </h1>
          <p className="text-[#2D2D2D]/60 mb-6">
            {error || 'We could not find your booking details. Please contact support.'}
          </p>
          <Link href="/properties">
            <button className="px-6 py-3 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors">
              Browse Properties
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const { metadata, amountTotal, customerEmail } = booking;
  const confirmationNumber = `RAH-${Date.now().toString().slice(-8)}`;

  return (
    <div className="min-h-screen bg-[#F5F5F0] py-12 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-4xl font-['Playfair_Display'] font-bold text-[#500000] mb-2">
            Booking Confirmed!
          </h1>
          <p className="text-[#2D2D2D]/60 text-lg">
            Your stay at Right at Home BnB has been confirmed
          </p>
        </motion.div>

        {/* Confirmation Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#500000] to-[#722F37] p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Confirmation Number</p>
                <p className="text-2xl font-bold font-mono">{confirmationNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-sm">Total Paid</p>
                <p className="text-2xl font-bold">${amountTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="p-6 border-b border-[#2D2D2D]/10">
            <h2 className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D] mb-4">
              {metadata.propertyName}
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-[#F5F5F0] rounded-xl">
                <Calendar className="w-5 h-5 text-[#500000]" />
                <div>
                  <p className="text-sm text-[#2D2D2D]/60">Check-in</p>
                  <p className="font-semibold text-[#2D2D2D]">{metadata.checkIn}</p>
                  <p className="text-sm text-[#2D2D2D]/60">3:00 PM</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-[#F5F5F0] rounded-xl">
                <Calendar className="w-5 h-5 text-[#500000]" />
                <div>
                  <p className="text-sm text-[#2D2D2D]/60">Check-out</p>
                  <p className="font-semibold text-[#2D2D2D]">{metadata.checkOut}</p>
                  <p className="text-sm text-[#2D2D2D]/60">11:00 AM</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-[#2D2D2D]/70">
                <Users className="w-4 h-4" />
                <span>{metadata.guestCount} Guest{parseInt(metadata.guestCount) > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2 text-[#2D2D2D]/70">
                <Calendar className="w-4 h-4" />
                <span>{metadata.nights} Night{parseInt(metadata.nights) > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2 text-[#2D2D2D]/70">
                <MapPin className="w-4 h-4" />
                <span>Midland, TX</span>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="p-6 bg-[#F5F5F0]">
            <h3 className="font-semibold text-[#2D2D2D] mb-4">What's Next?</h3>
            <div className="space-y-3 text-sm text-[#2D2D2D]/70">
              <p className="flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 text-[#500000]" />
                <span>A confirmation email has been sent to <strong>{customerEmail}</strong></span>
              </p>
              <p className="flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5 text-[#500000]" />
                <span>You'll receive check-in instructions 24 hours before your arrival</span>
              </p>
              <p className="flex items-start gap-2">
                <Home className="w-4 h-4 mt-0.5 text-[#500000]" />
                <span>Door code and WiFi details will be provided in your welcome message</span>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <button className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#500000] border border-[#500000] rounded-xl hover:bg-[#500000] hover:text-white transition-all">
            <Download className="w-5 h-5" />
            Download Receipt
          </button>
          <button className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#500000] border border-[#500000] rounded-xl hover:bg-[#500000] hover:text-white transition-all">
            <Share2 className="w-5 h-5" />
            Share Itinerary
          </button>
          <Link href="/properties">
            <button className="flex items-center justify-center gap-2 px-6 py-3 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors">
              Browse More Properties
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </motion.div>

        {/* Support Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center"
        >
          <p className="text-[#2D2D2D]/60 mb-2">Need help with your booking?</p>
          <p className="text-[#500000]">
            Contact us at <strong>(432) 559-1904</strong> or{' '}
            <a href="mailto:steven@rightathome.com" className="underline">
              steven@rightathome.com
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#500000] animate-spin mx-auto mb-4" />
          <p className="text-[#2D2D2D]/60">Loading your booking confirmation...</p>
        </div>
      </div>
    }>
      <BookingSuccessContent />
    </Suspense>
  );
}
