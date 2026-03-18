/**
 * Right at Home BnB - Terms of Service Page
 * Legal terms for BnB guests and cleaners
 * @author ECHO OMEGA PRIME
 */

import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Right at Home BnB vacation rentals in Midland, Texas. Rules and policies for guests, cleaners, and service providers.',
};

export default function TermsOfServicePage() {
  const lastUpdated = 'January 16, 2026';
  const effectiveDate = 'January 16, 2026';

  return (
    <div className="min-h-screen bg-[#0a0505]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#500000] to-[#722F37] py-16">
        <div className="max-w-4xl mx-auto px-6">
          <Link href="/" className="text-[#d4a574] hover:text-white transition-colors mb-4 inline-block">
            &larr; Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-display text-white mt-4">Terms of Service</h1>
          <p className="text-[#d4a574] mt-4 text-lg">
            Please read these terms carefully before booking with us
          </p>
          <p className="text-white/60 mt-2 text-sm">
            Last Updated: {lastUpdated} | Effective Date: {effectiveDate}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-invert prose-lg max-w-none">

          {/* Introduction */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">1. Acceptance of Terms</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed">
                Welcome to Right at Home BnB, operated by Steven Palma (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;). These Terms of
                Service (&quot;Terms&quot;) govern your use of our vacation rental properties in Midland, Texas, our
                website (rah-midland.com), and all related services.
              </p>
              <p className="text-white/80 leading-relaxed mt-4">
                By making a reservation, accessing our properties, or using our services, you agree to be
                bound by these Terms. If you do not agree to these Terms, you may not use our services or
                stay at our properties.
              </p>
              <p className="text-white/80 leading-relaxed mt-4">
                These Terms apply to all guests, visitors, cleaning staff, contractors, and anyone who
                interacts with our properties or services.
              </p>
            </div>
          </section>

          {/* Eligibility */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">2. Eligibility & Booking Requirements</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <ul className="text-white/80 space-y-3 list-disc list-inside">
                <li><strong>Age Requirement:</strong> You must be at least 25 years old to book our properties.
                    Exceptions may be made for business travelers with valid company credentials (minimum age 21).</li>
                <li><strong>Valid Identification:</strong> A valid government-issued photo ID is required at booking.</li>
                <li><strong>Accurate Information:</strong> You must provide truthful, accurate, and complete information
                    during the booking process.</li>
                <li><strong>Guest Count:</strong> The number of guests must not exceed the maximum occupancy listed
                    for each property. All overnight guests must be disclosed at booking.</li>
                <li><strong>Purpose of Stay:</strong> Our properties are for residential vacation/temporary housing only.
                    Commercial use, parties, events, or filming require prior written approval.</li>
              </ul>
            </div>
          </section>

          {/* Reservations */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">3. Reservations & Payment</h2>
            <div className="space-y-6">

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">3.1 Booking Confirmation</h3>
                <p className="text-white/80 leading-relaxed">
                  A reservation is confirmed only when you receive a written confirmation from us (via email
                  or through the booking platform). We reserve the right to decline any booking for any reason.
                </p>
              </div>

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">3.2 Payment Terms</h3>
                <ul className="text-white/80 space-y-2 list-disc list-inside">
                  <li>Full payment is due at time of booking unless otherwise specified</li>
                  <li>We accept major credit cards (Visa, Mastercard, Amex, Discover)</li>
                  <li>A security deposit may be required and will be refunded within 7-14 days after checkout (minus any deductions for damages)</li>
                  <li>Prices include base lodging; additional fees (cleaning, taxes, pet fees) will be clearly disclosed</li>
                  <li>All rates are in US Dollars (USD)</li>
                </ul>
              </div>

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">3.3 Pricing</h3>
                <p className="text-white/80 leading-relaxed">
                  Rental rates are subject to change without notice prior to booking confirmation. Once confirmed,
                  your rate is locked. Peak season rates, holiday rates, and special event rates may apply during
                  certain periods. All applicable taxes and fees will be disclosed before booking.
                </p>
              </div>
            </div>
          </section>

          {/* Cancellation */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">4. Cancellation & Refund Policy</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-white/80 text-sm">
                  <thead>
                    <tr className="border-b border-[#500000]/30">
                      <th className="text-left py-3 px-4 text-[#d4a574]">Cancellation Timing</th>
                      <th className="text-left py-3 px-4 text-[#d4a574]">Refund Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#500000]/20">
                      <td className="py-3 px-4">30+ days before check-in</td>
                      <td className="py-3 px-4">Full refund (minus service fees)</td>
                    </tr>
                    <tr className="border-b border-[#500000]/20">
                      <td className="py-3 px-4">14-29 days before check-in</td>
                      <td className="py-3 px-4">50% refund</td>
                    </tr>
                    <tr className="border-b border-[#500000]/20">
                      <td className="py-3 px-4">7-13 days before check-in</td>
                      <td className="py-3 px-4">25% refund</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Less than 7 days</td>
                      <td className="py-3 px-4">No refund</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-white/60 text-sm mt-4">
                For bookings made through third-party platforms (Airbnb, VRBO), the platform&apos;s cancellation
                policy may take precedence. Extenuating circumstances will be evaluated on a case-by-case basis.
              </p>
            </div>
          </section>

          {/* Check-in/Check-out */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">5. Check-In & Check-Out</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg text-white font-semibold mb-2">Check-In</h3>
                  <ul className="text-white/80 space-y-2 list-disc list-inside">
                    <li>Standard time: 3:00 PM local time</li>
                    <li>Early check-in subject to availability (may incur additional fee)</li>
                    <li>Self check-in available via smart lock</li>
                    <li>Check-in instructions sent 24 hours before arrival</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg text-white font-semibold mb-2">Check-Out</h3>
                  <ul className="text-white/80 space-y-2 list-disc list-inside">
                    <li>Standard time: 11:00 AM local time</li>
                    <li>Late check-out subject to availability (may incur fee)</li>
                    <li>Please follow checkout checklist provided</li>
                    <li>Leave keys/codes secure; lock all doors</li>
                  </ul>
                </div>
              </div>
              <p className="text-white/80 mt-4">
                Failure to check out by the designated time may result in additional charges equal to
                one night&apos;s rental rate per hour of overstay.
              </p>
            </div>
          </section>

          {/* House Rules */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">6. House Rules</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 mb-4">
                By booking, you agree to the following rules. Violation may result in immediate eviction without refund:
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg text-white font-semibold mb-2">Strictly Prohibited</h3>
                  <ul className="text-white/80 space-y-2 list-disc list-inside">
                    <li>Smoking inside properties (designated outdoor areas only)</li>
                    <li>Parties or events without prior approval</li>
                    <li>Excessive noise (quiet hours: 10 PM - 7 AM)</li>
                    <li>Illegal activities of any kind</li>
                    <li>Exceeding maximum guest count</li>
                    <li>Unauthorized pets</li>
                    <li>Use of candles, incense, or open flames</li>
                    <li>Tampering with security cameras or smart home devices</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg text-white font-semibold mb-2">Guest Responsibilities</h3>
                  <ul className="text-white/80 space-y-2 list-disc list-inside">
                    <li>Treat property with care and respect</li>
                    <li>Report damages immediately</li>
                    <li>Dispose of trash properly</li>
                    <li>Respect neighbors and community</li>
                    <li>Follow pool/hot tub safety rules</li>
                    <li>Secure doors and windows when leaving</li>
                    <li>Follow specific property instructions</li>
                    <li>Supervise children and pets at all times</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Pets */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">7. Pet Policy</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed">
                Many of our properties are pet-friendly. Pet-friendly properties are clearly marked.
              </p>
              <ul className="text-white/80 space-y-2 list-disc list-inside mt-4">
                <li>Maximum of 2 pets per property (unless otherwise specified)</li>
                <li>Pet fee: $50-100 per pet per stay (non-refundable)</li>
                <li>Pets must be disclosed at booking</li>
                <li>Dogs and cats only (other pets require approval)</li>
                <li>Pets must not be left unattended in the property</li>
                <li>Owner is responsible for all pet-related damages and additional cleaning</li>
                <li>Service animals are welcome (no fee) with proper documentation</li>
              </ul>
              <p className="text-white/80 mt-4">
                Undisclosed pets will result in a minimum $250 penalty plus additional cleaning fees.
              </p>
            </div>
          </section>

          {/* Damages & Liability */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">8. Damages, Liability & Insurance</h2>
            <div className="space-y-6">

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">8.1 Guest Liability for Damages</h3>
                <p className="text-white/80 leading-relaxed">
                  You are responsible for any damage to the property, furnishings, or amenities caused by you,
                  your guests, or your pets during your stay. This includes but is not limited to: broken items,
                  stains, burns, excessive cleaning requirements, missing items, and damage to appliances.
                </p>
                <p className="text-white/80 leading-relaxed mt-3">
                  Damage charges will be deducted from your security deposit. If damages exceed the deposit
                  amount, you authorize us to charge the remaining balance to your payment method on file.
                </p>
              </div>

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">8.2 Limitation of Liability</h3>
                <p className="text-white/80 leading-relaxed">
                  Right at Home BnB is not liable for:
                </p>
                <ul className="text-white/80 space-y-2 list-disc list-inside mt-3">
                  <li>Personal injury, theft, or property damage during your stay</li>
                  <li>Loss of personal belongings left at the property</li>
                  <li>Temporary loss of amenities (internet, hot tub, pool, A/C) due to circumstances beyond our control</li>
                  <li>Interruptions caused by maintenance, weather, or utility outages</li>
                  <li>Actions of other guests, neighbors, or third parties</li>
                </ul>
                <p className="text-white/80 leading-relaxed mt-3">
                  Our maximum liability is limited to the amount you paid for your reservation.
                </p>
              </div>

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">8.3 Insurance Recommendation</h3>
                <p className="text-white/80 leading-relaxed">
                  We strongly recommend guests obtain travel insurance covering trip cancellation, medical
                  emergencies, and personal property. Right at Home BnB does not provide insurance coverage
                  for guest belongings or injuries.
                </p>
              </div>
            </div>
          </section>

          {/* Terms for Cleaners */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">9. Terms for Cleaning Staff & Contractors</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed mb-4">
                If you provide cleaning or maintenance services to Right at Home BnB properties, the
                following terms apply in addition to any separate service agreement:
              </p>
              <ul className="text-white/80 space-y-3 list-disc list-inside">
                <li><strong>Confidentiality:</strong> Do not disclose door codes, guest information, or property
                    details to anyone outside of authorized personnel</li>
                <li><strong>Access:</strong> Property access is granted only for scheduled service appointments</li>
                <li><strong>Quality Standards:</strong> Follow provided checklists and quality standards.
                    Substandard work may require re-cleaning at no additional cost</li>
                <li><strong>Documentation:</strong> Submit photo documentation of completed work via our app/system</li>
                <li><strong>Scheduling:</strong> Arrive within the scheduled time window. Notify us immediately
                    of any delays or issues</li>
                <li><strong>Damage Reporting:</strong> Report any existing damage or maintenance issues immediately</li>
                <li><strong>Independent Contractor:</strong> Cleaners are independent contractors, not employees.
                    You are responsible for your own taxes and insurance</li>
                <li><strong>Background Check:</strong> All cleaning staff must pass a background check</li>
              </ul>
            </div>
          </section>

          {/* Intellectual Property */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">10. Intellectual Property</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed">
                All content on our website, including text, graphics, logos, images, and software, is the
                property of Right at Home BnB or its licensors and is protected by copyright and trademark
                laws. The &quot;Right at Home BnB&quot; name, logo, and &quot;RAH&quot; are trademarks of Steven Palma.
              </p>
              <p className="text-white/80 leading-relaxed mt-4">
                Photos taken by guests during their stay may be shared on personal social media. Commercial
                photography or filming requires prior written approval.
              </p>
            </div>
          </section>

          {/* Dispute Resolution */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">11. Dispute Resolution</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed">
                We aim to resolve all disputes amicably. If you have a concern:
              </p>
              <ol className="text-white/80 space-y-2 list-decimal list-inside mt-4">
                <li>Contact us directly first at support@rah-midland.com</li>
                <li>We will respond within 48 business hours</li>
                <li>If unresolved, both parties agree to mediation before pursuing legal action</li>
                <li>Any legal proceedings shall be conducted in Midland County, Texas</li>
              </ol>
              <p className="text-white/80 leading-relaxed mt-4">
                These Terms are governed by the laws of the State of Texas, without regard to conflict
                of law principles.
              </p>
            </div>
          </section>

          {/* Modifications */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">12. Modifications to Terms</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed">
                We reserve the right to modify these Terms at any time. Changes will be effective upon
                posting to our website. For existing bookings, the Terms in effect at the time of booking
                will apply unless the modification is required by law.
              </p>
            </div>
          </section>

          {/* Severability */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">13. Severability</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed">
                If any provision of these Terms is found to be unenforceable or invalid, the remaining
                provisions will continue in full force and effect. The unenforceable provision will be
                modified to the minimum extent necessary to make it enforceable.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">14. Contact Information</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed mb-4">
                For questions about these Terms of Service:
              </p>
              <div className="space-y-3 text-white/80">
                <p><strong>Right at Home BnB</strong></p>
                <p>Owner: Steven Palma</p>
                <p>Location: Midland, Texas</p>
                <p>
                  Email:{' '}
                  <a href="mailto:support@rah-midland.com" className="text-[#d4a574] hover:underline">
                    support@rah-midland.com
                  </a>
                </p>
                <p>
                  Phone:{' '}
                  <a href="tel:+14325591904" className="text-[#d4a574] hover:underline">
                    (432) 559-1904
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="mb-12">
            <div className="bg-[#500000]/20 border border-[#500000] rounded-xl p-6">
              <h2 className="text-xl font-display text-white mb-3">Acknowledgment</h2>
              <p className="text-white/80 leading-relaxed">
                By booking a stay at any Right at Home BnB property, you acknowledge that you have read,
                understood, and agree to be bound by these Terms of Service and our Privacy Policy. Thank
                you for choosing Right at Home BnB - we look forward to hosting you in Midland, Texas!
              </p>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a0a0a] border-t border-[#500000]/30 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-white/60 text-sm">
            &copy; {new Date().getFullYear()} Right at Home BnB. All rights reserved.
          </p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/privacy-policy" className="text-[#d4a574] hover:underline text-sm">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" className="text-[#d4a574] hover:underline text-sm">
              Terms of Service
            </Link>
            <Link href="/" className="text-[#d4a574] hover:underline text-sm">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
