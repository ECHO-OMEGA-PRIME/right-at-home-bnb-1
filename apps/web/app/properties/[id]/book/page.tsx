'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Bed, Bath, Users, Star, MapPin, Calendar,
  User, Mail, Phone, MessageSquare, CreditCard, Loader2,
} from 'lucide-react';
import { getPropertyById } from '@/lib/property-data';

const TX_TAX_RATE = 0.0825;
const CLEANING_FEE = 150;

export default function BookPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;
  const property = useMemo(() => getPropertyById(propertyId), [propertyId]);

  // Form state
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialReqs, setSpecialReqs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Price calculation
  const pricing = useMemo(() => {
    if (!property || !checkIn || !checkOut) return null;
    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    const nights = Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
    if (nights < 1) return null;

    const subtotal = property.nightlyRate * nights;
    const taxes = Math.round((subtotal + CLEANING_FEE) * TX_TAX_RATE * 100) / 100;
    const total = Math.round((subtotal + CLEANING_FEE + taxes) * 100) / 100;

    return { nights, subtotal, cleaningFee: CLEANING_FEE, taxes, total };
  }, [property, checkIn, checkOut]);

  // Min date for check-in (today)
  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!property || !pricing) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/bookings/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property.id,
          checkIn,
          checkOut,
          guestCount,
          guestName,
          guestEmail,
          guestPhone,
          specialReqs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setLoading(false);
        return;
      }

      // Store bookingId in sessionStorage for the return page
      sessionStorage.setItem('rah_booking_id', data.bookingId);
      sessionStorage.setItem('rah_paypal_order', data.paypalOrderId);

      // Redirect to PayPal approval
      window.location.href = data.approveUrl;
    } catch (err) {
      setError('Failed to connect to payment service. Please try again.');
      setLoading(false);
    }
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-[#0a0505] flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-playfair text-3xl text-white mb-4">Property Not Found</h1>
          <Link
            href="/properties"
            className="inline-flex items-center gap-2 bg-[#500000] text-white px-6 py-3 rounded-xl hover:bg-[#600000] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Properties
          </Link>
        </div>
      </div>
    );
  }

  const ratingStars = Math.round(property.rating / 2);

  return (
    <div className="min-h-screen bg-[#0a0505]">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#500000]/30 to-transparent">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href={`/properties/${property.id}`}
            className="inline-flex items-center gap-2 text-white/60 hover:text-[#C4A777] transition-colors text-sm mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {property.name}
          </Link>
          <h1 className="font-playfair text-3xl sm:text-4xl text-white">
            Book Your Stay
          </h1>
          <p className="text-white/60 mt-1">
            Complete your reservation at {property.name}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Booking Form (2/3) */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Dates */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h2 className="font-playfair text-xl text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#C4A777]" />
                  Stay Dates
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/70 text-sm mb-1.5">Check-in</label>
                    <input
                      type="date"
                      required
                      min={today}
                      value={checkIn}
                      onChange={(e) => {
                        setCheckIn(e.target.value);
                        if (checkOut && e.target.value >= checkOut) setCheckOut('');
                      }}
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white
                                 focus:outline-none focus:border-[#C4A777] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm mb-1.5">Check-out</label>
                    <input
                      type="date"
                      required
                      min={checkIn || today}
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white
                                 focus:outline-none focus:border-[#C4A777] transition-colors"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-white/70 text-sm mb-1.5">Guests</label>
                  <select
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                    className="w-full sm:w-48 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white
                               focus:outline-none focus:border-[#C4A777] transition-colors"
                  >
                    {Array.from({ length: property.sleeps }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n} className="bg-[#1a1010] text-white">
                        {n} guest{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Guest Info */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h2 className="font-playfair text-xl text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-[#C4A777]" />
                  Guest Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-white/70 text-sm mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white
                                 placeholder:text-white/30 focus:outline-none focus:border-[#C4A777] transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white/70 text-sm mb-1.5 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> Email
                      </label>
                      <input
                        type="email"
                        required
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white
                                   placeholder:text-white/30 focus:outline-none focus:border-[#C4A777] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-white/70 text-sm mb-1.5 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> Phone
                      </label>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="(432) 555-1234"
                        className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white
                                   placeholder:text-white/30 focus:outline-none focus:border-[#C4A777] transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm mb-1.5 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" /> Special Requests
                    </label>
                    <textarea
                      value={specialReqs}
                      onChange={(e) => setSpecialReqs(e.target.value)}
                      placeholder="Early check-in, late check-out, extra towels..."
                      rows={3}
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white
                                 placeholder:text-white/30 focus:outline-none focus:border-[#C4A777] transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              {pricing && (
                <div className="bg-white/5 backdrop-blur-sm border border-[#C4A777]/30 rounded-2xl p-6">
                  <h2 className="font-playfair text-xl text-white mb-4">Price Breakdown</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-white/70">
                      <span>{pricing.nights} night{pricing.nights > 1 ? 's' : ''} x ${property.nightlyRate}/night</span>
                      <span className="text-white">${pricing.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                      <span>Cleaning fee</span>
                      <span className="text-white">${pricing.cleaningFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                      <span>Taxes (8.25%)</span>
                      <span className="text-white">${pricing.taxes.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 mt-2 flex justify-between font-semibold">
                      <span className="text-white">Total</span>
                      <span className="text-[#C4A777] text-lg">${pricing.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !pricing}
                className="w-full flex items-center justify-center gap-3 bg-[#C4A777] hover:bg-[#d4b787]
                         text-[#0a0505] font-bold py-4 px-8 rounded-xl transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Pay with PayPal{pricing ? ` — $${pricing.total.toFixed(2)}` : ''}
                  </>
                )}
              </button>

              <p className="text-white/30 text-xs text-center">
                You will be redirected to PayPal to complete your payment securely.
              </p>
            </form>
          </div>

          {/* Right: Property Summary (1/3) */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                {/* Property photo placeholder */}
                <div className="w-full aspect-[4/3] bg-[#500000]/20 rounded-xl mb-4 flex items-center justify-center">
                  <span className="text-white/30 text-sm">Property Photo</span>
                </div>

                <h3 className="font-playfair text-lg text-white mb-1">{property.name}</h3>
                <p className="text-white/50 text-sm flex items-center gap-1 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-[#C4A777]" />
                  {property.city}, {property.state}
                </p>

                {/* Rating */}
                {property.rating > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= ratingStars ? 'text-[#C4A777] fill-[#C4A777]' : 'text-white/20'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-white/60 text-xs">
                      {property.rating}/10 ({property.reviewCount} reviews)
                    </span>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
                  <div className="text-center">
                    <Bed className="w-4 h-4 text-[#C4A777] mx-auto mb-1" />
                    <div className="text-white text-sm font-medium">{property.bedrooms}</div>
                    <div className="text-white/40 text-xs">Beds</div>
                  </div>
                  <div className="text-center">
                    <Bath className="w-4 h-4 text-[#C4A777] mx-auto mb-1" />
                    <div className="text-white text-sm font-medium">{property.bathrooms}</div>
                    <div className="text-white/40 text-xs">Baths</div>
                  </div>
                  <div className="text-center">
                    <Users className="w-4 h-4 text-[#C4A777] mx-auto mb-1" />
                    <div className="text-white text-sm font-medium">{property.sleeps}</div>
                    <div className="text-white/40 text-xs">Sleeps</div>
                  </div>
                </div>

                {/* Price */}
                <div className="border-t border-white/10 pt-4 mt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">${property.nightlyRate}</span>
                    <span className="text-white/50 text-sm">/ night</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
