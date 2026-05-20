'use client';

/**
 * Direct Booking Flow — PayPal Integration
 * =========================================
 * Complete guest booking flow with PayPal checkout.
 * Replaces Stripe integration — Steven uses PayPal exclusively.
 *
 * Flow:
 * 1. Guest selects dates + guest count
 * 2. System checks availability via iCal sync
 * 3. Price calculator shows savings vs VRBO/Airbnb
 * 4. Guest fills info + PayPal checkout
 * 5. PayPal redirect → capture → confirmation
 *
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback, useEffect } from 'react';
import { format, differenceInDays, addDays } from 'date-fns';

// Types
interface PriceBreakdown {
  nightly_rate: number;
  num_nights: number;
  subtotal: number;
  cleaning_fee: number;
  service_fee: number;
  taxes: number;
  security_deposit: number;
  discount: number;
  discount_reason: string | null;
  ota_comparison: number;
  savings: number;
  savings_percentage: number;
  total: number;
  total_with_deposit: number;
}

interface PropertyInfo {
  id: string;
  name: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  sleeps: number;
  nightly_rate: number;
  cleaning_fee: number;
  min_nights: number;
  amenities: string[];
  rating: string | null;
  reviews: number;
  vrbo_id: string | null;
  vrbo_url: string | null;
}

interface GuestInfo {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  special_requests: string;
  arrival_time: string;
}

type BookingStep = 'dates' | 'price' | 'guest-info' | 'payment' | 'confirmation';

interface DirectBookingFlowProps {
  propertyId: string;
  property?: PropertyInfo;
  apiBase?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

export function DirectBookingFlow({
  propertyId,
  property: initialProperty,
  apiBase = API_BASE,
}: DirectBookingFlowProps) {
  // State
  const [step, setStep] = useState<BookingStep>('dates');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [property, setProperty] = useState<PropertyInfo | null>(initialProperty || null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [promoCode, setPromoCode] = useState('');

  const [available, setAvailable] = useState<boolean | null>(null);
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  const [guestInfo, setGuestInfo] = useState<GuestInfo>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    special_requests: '',
    arrival_time: '15:00',
  });

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [paypalApproveUrl, setPaypalApproveUrl] = useState<string | null>(null);

  // Load property info if not provided
  useEffect(() => {
    if (!property) {
      fetch(`${apiBase}/book/properties/${propertyId}`)
        .then((r) => r.json())
        .then(setProperty)
        .catch(() => setError('Failed to load property details'));
    }
  }, [propertyId, property, apiBase]);

  // Calculate nights
  const nights = checkIn && checkOut ? differenceInDays(new Date(checkOut), new Date(checkIn)) : 0;

  // ── Step 1: Check Availability ────────────────────────────────────────
  const checkAvailability = useCallback(async () => {
    if (!checkIn || !checkOut || nights < 1) {
      setError('Please select valid dates');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/book/check-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          check_in: checkIn,
          check_out: checkOut,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Availability check failed');
        return;
      }

      setAvailable(data.available);

      if (data.available) {
        // Auto-calculate price
        await calculatePrice();
      } else {
        setError(data.message || 'Property not available for these dates');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [checkIn, checkOut, nights, propertyId, apiBase]);

  // ── Step 2: Calculate Price ───────────────────────────────────────────
  const calculatePrice = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/book/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          check_in: checkIn,
          check_out: checkOut,
          guest_count: guestCount,
          apply_promo_code: promoCode || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Price calculation failed');
        return;
      }

      setPriceBreakdown(data.breakdown);
      setQuoteId(data.quote_id);
      setStep('price');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [checkIn, checkOut, guestCount, promoCode, propertyId, apiBase]);

  // ── Step 3: Create Booking ────────────────────────────────────────────
  const createBooking = useCallback(async () => {
    if (!guestInfo.first_name || !guestInfo.last_name || !guestInfo.email || !guestInfo.phone) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/book/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          check_in: checkIn,
          check_out: checkOut,
          guest_count: guestCount,
          guest_info: guestInfo,
          quote_id: quoteId,
          promo_code: promoCode || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Booking creation failed');
        return;
      }

      setBookingId(data.id);
      setConfirmationCode(data.confirmation_code);

      // Create PayPal payment
      await initiatePayPalPayment(data.id);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [guestInfo, propertyId, checkIn, checkOut, guestCount, quoteId, promoCode, apiBase]);

  // ── Step 4: PayPal Payment ────────────────────────────────────────────
  const initiatePayPalPayment = useCallback(
    async (bId: string) => {
      setLoading(true);
      setError(null);

      try {
        const returnUrl = `${window.location.origin}/booking/confirm?booking_id=${bId}`;
        const cancelUrl = `${window.location.origin}/booking/cancelled?booking_id=${bId}`;

        const res = await fetch(`${apiBase}/book/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_id: bId,
            include_security_deposit: true,
            return_url: returnUrl,
            cancel_url: cancelUrl,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.detail || 'Payment initialization failed');
          return;
        }

        if (data.approve_url) {
          setPaypalApproveUrl(data.approve_url);
          setStep('payment');
        } else {
          setError('PayPal checkout URL not received');
        }
      } catch {
        setError('Payment system error. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [apiBase]
  );

  // ── Minimum date (tomorrow) ───────────────────────────────────────────
  const minDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  if (!property) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-800 text-white rounded-t-2xl p-6">
        <h2 className="text-2xl font-bold">{property.name}</h2>
        <p className="text-amber-100 mt-1">{property.address}</p>
        <div className="flex gap-4 mt-3 text-sm">
          <span>{property.bedrooms} BR</span>
          <span>{property.bathrooms} BA</span>
          <span>Sleeps {property.sleeps}</span>
          {property.rating && <span>★ {property.rating}</span>}
        </div>
      </div>

      <div className="bg-white rounded-b-2xl shadow-lg p-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4">
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold">
              ×
            </button>
          </div>
        )}

        {/* Step 1: Date Selection */}
        {step === 'dates' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Select Your Dates</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Check-in</label>
                <input
                  type="date"
                  min={minDate}
                  value={checkIn}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    setAvailable(null);
                  }}
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Check-out</label>
                <input
                  type="date"
                  min={checkIn || minDate}
                  value={checkOut}
                  onChange={(e) => {
                    setCheckOut(e.target.value);
                    setAvailable(null);
                  }}
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Guests</label>
              <select
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-amber-500"
              >
                {Array.from({ length: property.sleeps }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'Guest' : 'Guests'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Promo Code (optional)</label>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter promo code"
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {nights > 0 && (
              <p className="text-gray-500 text-sm">
                {nights} {nights === 1 ? 'night' : 'nights'} · ${property.nightly_rate}/night
                {nights < property.min_nights && (
                  <span className="text-red-500 ml-2">
                    (Minimum {property.min_nights} nights)
                  </span>
                )}
              </p>
            )}

            <button
              onClick={checkAvailability}
              disabled={loading || !checkIn || !checkOut || nights < 1}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Checking...' : 'Check Availability & Price'}
            </button>

            {/* Direct booking savings badge */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <span className="text-green-700 font-semibold">
                💰 Book direct & save 10-15% vs VRBO/Airbnb
              </span>
              <p className="text-green-600 text-sm mt-1">
                No middleman fees. Pay with PayPal. Instant confirmation.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Price Breakdown */}
        {step === 'price' && priceBreakdown && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Price Breakdown</h3>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span>${priceBreakdown.nightly_rate}/night × {priceBreakdown.num_nights} nights</span>
                <span>${priceBreakdown.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Cleaning fee</span>
                <span>${priceBreakdown.cleaning_fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Service fee (3%)</span>
                <span>${priceBreakdown.service_fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Taxes (13%)</span>
                <span>${priceBreakdown.taxes.toFixed(2)}</span>
              </div>
              {priceBreakdown.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{priceBreakdown.discount_reason}</span>
                  <span>-${priceBreakdown.discount.toFixed(2)}</span>
                </div>
              )}
              <hr />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${priceBreakdown.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-sm">
                <span>+ Refundable security deposit</span>
                <span>${priceBreakdown.security_deposit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Due at checkout</span>
                <span>${priceBreakdown.total_with_deposit.toFixed(2)}</span>
              </div>
            </div>

            {/* Savings comparison */}
            {priceBreakdown.savings > 0 && (
              <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-green-800">
                      You save ${priceBreakdown.savings.toFixed(2)}!
                    </p>
                    <p className="text-green-600 text-sm">
                      {priceBreakdown.savings_percentage.toFixed(0)}% less than VRBO/Airbnb
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 line-through text-sm">
                      ${priceBreakdown.ota_comparison.toFixed(2)} on VRBO
                    </p>
                    <p className="text-green-700 font-bold">
                      ${priceBreakdown.total.toFixed(2)} direct
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('dates')}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep('guest-info')}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg"
              >
                Continue to Book
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Guest Info */}
        {step === 'guest-info' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Guest Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={guestInfo.first_name}
                  onChange={(e) => setGuestInfo({ ...guestInfo, first_name: e.target.value })}
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={guestInfo.last_name}
                  onChange={(e) => setGuestInfo({ ...guestInfo, last_name: e.target.value })}
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email *</label>
              <input
                type="email"
                value={guestInfo.email}
                onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Phone *</label>
              <input
                type="tel"
                value={guestInfo.phone}
                onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-amber-500"
                placeholder="(432) 555-1234"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Estimated Arrival Time
              </label>
              <select
                value={guestInfo.arrival_time}
                onChange={(e) => setGuestInfo({ ...guestInfo, arrival_time: e.target.value })}
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-amber-500"
              >
                <option value="15:00">3:00 PM (Check-in time)</option>
                <option value="16:00">4:00 PM</option>
                <option value="17:00">5:00 PM</option>
                <option value="18:00">6:00 PM</option>
                <option value="19:00">7:00 PM</option>
                <option value="20:00">8:00 PM</option>
                <option value="21:00">9:00 PM (Late arrival)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Special Requests (optional)
              </label>
              <textarea
                value={guestInfo.special_requests}
                onChange={(e) => setGuestInfo({ ...guestInfo, special_requests: e.target.value })}
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-amber-500"
                rows={3}
                placeholder="Early check-in, pets, etc."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('price')}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={createBooking}
                disabled={loading}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50"
              >
                {loading ? 'Creating Booking...' : 'Proceed to PayPal'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: PayPal Payment */}
        {step === 'payment' && (
          <div className="space-y-4 text-center">
            <h3 className="text-lg font-semibold text-gray-800">Complete Payment with PayPal</h3>

            {confirmationCode && (
              <p className="text-gray-600">
                Booking <span className="font-mono font-bold">{confirmationCode}</span> created
              </p>
            )}

            {priceBreakdown && (
              <p className="text-2xl font-bold text-gray-800">
                ${priceBreakdown.total_with_deposit.toFixed(2)}
              </p>
            )}

            {paypalApproveUrl ? (
              <a
                href={paypalApproveUrl}
                className="inline-block w-full bg-[#0070ba] hover:bg-[#003087] text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                    <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 00-.607-.541c1.654 1.904 1.07 4.822-.474 7.177C18.658 15.757 16.086 17 12.892 17h-2.19a1.64 1.64 0 00-1.619 1.386l-1.12 7.106a.641.641 0 01-.633.508h-3.29" />
                  </svg>
                  Pay with PayPal
                </span>
              </a>
            ) : (
              <div className="animate-pulse bg-gray-200 rounded-lg h-14" />
            )}

            <p className="text-gray-500 text-sm">
              You will be redirected to PayPal to complete your payment securely.
              <br />
              Security deposit of ${priceBreakdown?.security_deposit.toFixed(2)} is fully refundable.
            </p>

            <button
              onClick={() => setStep('guest-info')}
              className="text-gray-500 hover:text-gray-700 text-sm underline"
            >
              Go back
            </button>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 'confirmation' && (
          <div className="space-y-4 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-2xl font-bold text-green-700">Booking Confirmed!</h3>

            <div className="bg-green-50 rounded-lg p-6">
              <p className="text-lg">
                Confirmation Code:{' '}
                <span className="font-mono font-bold text-2xl">{confirmationCode}</span>
              </p>
              <p className="text-gray-600 mt-2">
                {property?.name}
                <br />
                {checkIn} → {checkOut} · {guestCount} guests
              </p>
            </div>

            <div className="text-left bg-amber-50 rounded-lg p-4">
              <h4 className="font-semibold text-amber-800 mb-2">What&apos;s Next:</h4>
              <ul className="text-amber-700 space-y-1 text-sm">
                <li>✓ Confirmation email sent to {guestInfo.email}</li>
                <li>✓ Door code sent via text 24 hours before check-in</li>
                <li>✓ Complete waivers linked in your email</li>
                <li>✓ Contact Steven for any questions</li>
              </ul>
            </div>

            <p className="text-gray-500 text-sm">
              Thank you for booking direct with Right At Home BnB!
              {priceBreakdown && priceBreakdown.savings > 0 && (
                <span className="text-green-600 font-semibold block mt-1">
                  You saved ${priceBreakdown.savings.toFixed(2)} by booking direct!
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DirectBookingFlow;
