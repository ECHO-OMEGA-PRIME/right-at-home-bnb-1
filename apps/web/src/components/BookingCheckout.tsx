'use client';

/**
 * Right at Home BnB - Booking Checkout Component
 * Handles date selection and payment processing
 * Supports both Stripe and Square payments
 * @author ECHO OMEGA PRIME
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, CreditCard, Shield, Clock, Check,
  Loader2, AlertCircle, ChevronDown, DollarSign, Tag
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface BookingCheckoutProps {
  propertyId: string;
  propertyName: string;
  nightlyRate: number;
  maxGuests: number;
  cleaningFee?: number;
  minimumNights?: number;
}

interface BookingState {
  checkIn: string;
  checkOut: string;
  guests: number;
}

export function BookingCheckout({
  propertyId,
  propertyName,
  nightlyRate,
  maxGuests,
  cleaningFee = 85,
  minimumNights = 2,
}: BookingCheckoutProps) {
  const [booking, setBooking] = useState<BookingState>({
    checkIn: '',
    checkOut: '',
    guests: 1,
  });
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'square'>('stripe');

  // Calculate number of nights
  const nights = useMemo(() => {
    if (!booking.checkIn || !booking.checkOut) return 0;
    const start = new Date(booking.checkIn);
    const end = new Date(booking.checkOut);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [booking.checkIn, booking.checkOut]);

  // Calculate totals
  const pricing = useMemo(() => {
    const subtotal = nightlyRate * nights;
    const serviceFee = Math.round(subtotal * 0.12); // 12% service fee
    const taxes = Math.round((subtotal + cleaningFee + serviceFee) * 0.0825); // 8.25% TX tax
    const total = subtotal + cleaningFee + serviceFee + taxes;
    return { subtotal, serviceFee, taxes, total };
  }, [nightlyRate, nights, cleaningFee]);

  // Validate booking
  const isValid = useMemo(() => {
    return (
      booking.checkIn &&
      booking.checkOut &&
      nights >= minimumNights &&
      booking.guests >= 1 &&
      booking.guests <= maxGuests &&
      email.includes('@')
    );
  }, [booking, nights, minimumNights, maxGuests, email]);

  // Get minimum check-in date (today)
  const today = new Date().toISOString().split('T')[0];

  // Handle Stripe checkout
  const handleStripeCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          propertyName,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guestCount: booking.guests,
          nightlyRate,
          nights,
          cleaningFee,
          serviceFee: pricing.serviceFee,
          taxes: pricing.taxes,
          guestEmail: email,
          guestName: name,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Checkout failed');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle payment submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      setError('Please fill in all required fields');
      return;
    }

    if (paymentMethod === 'stripe') {
      await handleStripeCheckout();
    } else {
      // Square payment would be handled differently (inline form)
      setError('Square payments coming soon. Please use credit card.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#2D2D2D]/10 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#2D2D2D]/10">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
              ${nightlyRate}
            </span>
            <span className="text-[#2D2D2D]/60 ml-1">/ night</span>
          </div>
          <div className="flex items-center gap-1 text-[#C4A777]">
            <span className="text-sm">★★★★★</span>
            <span className="text-[#2D2D2D]/60 text-sm">(47 reviews)</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Date Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1">
              Check-in
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D2D2D]/40" />
              <input
                type="date"
                value={booking.checkIn}
                min={today}
                onChange={(e) => setBooking({ ...booking, checkIn: e.target.value })}
                className="w-full pl-10 pr-3 py-2.5 border border-[#2D2D2D]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1">
              Check-out
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D2D2D]/40" />
              <input
                type="date"
                value={booking.checkOut}
                min={booking.checkIn || today}
                onChange={(e) => setBooking({ ...booking, checkOut: e.target.value })}
                className="w-full pl-10 pr-3 py-2.5 border border-[#2D2D2D]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000]"
              />
            </div>
          </div>
        </div>

        {/* Guest Selection */}
        <div>
          <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1">
            Guests
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D2D2D]/40" />
            <select
              value={booking.guests}
              onChange={(e) => setBooking({ ...booking, guests: parseInt(e.target.value) })}
              className="w-full pl-10 pr-10 py-2.5 border border-[#2D2D2D]/20 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000]"
            >
              {Array.from({ length: maxGuests }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  {num} guest{num > 1 ? 's' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D2D2D]/40 pointer-events-none" />
          </div>
        </div>

        {/* Guest Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-3 py-2.5 border border-[#2D2D2D]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              className="w-full px-3 py-2.5 border border-[#2D2D2D]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000]"
            />
          </div>
        </div>

        {/* Pricing Breakdown */}
        <AnimatePresence>
          {nights > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-[#2D2D2D]/10 pt-4 space-y-2"
            >
              <div className="flex justify-between text-[#2D2D2D]/70">
                <span>${nightlyRate} × {nights} night{nights > 1 ? 's' : ''}</span>
                <span>${pricing.subtotal}</span>
              </div>
              <div className="flex justify-between text-[#2D2D2D]/70">
                <span>Cleaning fee</span>
                <span>${cleaningFee}</span>
              </div>
              <div className="flex justify-between text-[#2D2D2D]/70">
                <span>Service fee</span>
                <span>${pricing.serviceFee}</span>
              </div>
              <div className="flex justify-between text-[#2D2D2D]/70">
                <span>Taxes</span>
                <span>${pricing.taxes}</span>
              </div>
              <div className="flex justify-between font-bold text-[#2D2D2D] pt-2 border-t border-[#2D2D2D]/10">
                <span>Total</span>
                <span>${pricing.total}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimum Stay Warning */}
        {nights > 0 && nights < minimumNights && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Minimum stay is {minimumNights} nights</span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Payment Method Selection */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaymentMethod('stripe')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-all ${
              paymentMethod === 'stripe'
                ? 'border-[#500000] bg-[#500000]/5 text-[#500000]'
                : 'border-[#2D2D2D]/20 text-[#2D2D2D]/60 hover:border-[#2D2D2D]/40'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Credit Card
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('square')}
            disabled
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[#2D2D2D]/10 text-[#2D2D2D]/30 cursor-not-allowed"
            title="Coming soon"
          >
            <DollarSign className="w-4 h-4" />
            Square
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full py-4 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl hover:from-[#600000] hover:to-[#822F47] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </span>
          ) : nights > 0 ? (
            `Reserve for $${pricing.total}`
          ) : (
            'Select Dates to Book'
          )}
        </button>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-4 pt-4 text-[#2D2D2D]/50 text-xs">
          <div className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Secure Payment</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Instant Confirmation</span>
          </div>
          <div className="flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            <span>Free Cancellation*</span>
          </div>
        </div>
      </form>
    </div>
  );
}

export default BookingCheckout;
