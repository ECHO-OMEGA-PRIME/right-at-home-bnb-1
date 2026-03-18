/**
 * Right at Home BnB - Privacy Policy Page
 * Legal compliance for BnB rental service
 * @author ECHO OMEGA PRIME
 */

import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Right at Home BnB vacation rental services in Midland, Texas. Learn how we collect, use, and protect your personal information.',
};

export default function PrivacyPolicyPage() {
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
          <h1 className="text-4xl md:text-5xl font-display text-white mt-4">Privacy Policy</h1>
          <p className="text-[#d4a574] mt-4 text-lg">
            Your privacy matters to us at Right at Home BnB
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
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">1. Introduction</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed">
                Right at Home BnB (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates vacation rental properties in Midland, Texas,
                managed by Steven Palma. This Privacy Policy explains how we collect, use, disclose, and safeguard
                your information when you visit our website (rah-midland.com), book our properties through any
                platform (including Airbnb, VRBO, or direct booking), or otherwise interact with our services.
              </p>
              <p className="text-white/80 leading-relaxed mt-4">
                By using our services, you consent to the data practices described in this policy. If you do not
                agree with any aspect of this policy, please do not access or use our services.
              </p>
            </div>
          </section>

          {/* Information We Collect */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">2. Information We Collect</h2>
            <div className="space-y-6">

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">2.1 Personal Information You Provide</h3>
                <ul className="text-white/80 space-y-2 list-disc list-inside">
                  <li><strong>Contact Information:</strong> Full name, email address, phone number, mailing address</li>
                  <li><strong>Booking Details:</strong> Check-in/check-out dates, number of guests, special requests</li>
                  <li><strong>Payment Information:</strong> Credit card details (processed securely through third-party processors)</li>
                  <li><strong>Government ID:</strong> When required for verification purposes</li>
                  <li><strong>Communication Records:</strong> Messages sent through our platform, emails, and phone calls</li>
                  <li><strong>Vehicle Information:</strong> License plate numbers for parking purposes</li>
                  <li><strong>Emergency Contacts:</strong> Names and phone numbers of emergency contacts you provide</li>
                </ul>
              </div>

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">2.2 Information Collected Automatically</h3>
                <ul className="text-white/80 space-y-2 list-disc list-inside">
                  <li><strong>Device Information:</strong> IP address, browser type, operating system</li>
                  <li><strong>Usage Data:</strong> Pages visited, time spent on pages, referring website</li>
                  <li><strong>Cookies:</strong> Session cookies, preference cookies, analytics cookies</li>
                  <li><strong>Smart Home Data:</strong> Smart lock access logs, thermostat settings (for property management only)</li>
                </ul>
              </div>

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">2.3 Information from Third Parties</h3>
                <ul className="text-white/80 space-y-2 list-disc list-inside">
                  <li><strong>Booking Platforms:</strong> Airbnb, VRBO, Booking.com reservation details</li>
                  <li><strong>Payment Processors:</strong> Square, Stripe transaction confirmations</li>
                  <li><strong>Cleaning Services:</strong> Property condition reports</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Information */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">3. How We Use Your Information</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <ul className="text-white/80 space-y-3 list-disc list-inside">
                <li><strong>Process Reservations:</strong> Confirm bookings, send check-in instructions, process payments</li>
                <li><strong>Guest Communication:</strong> Send pre-arrival information, mid-stay check-ins, and checkout reminders</li>
                <li><strong>Property Access:</strong> Generate temporary door codes for smart locks during your stay</li>
                <li><strong>Improve Services:</strong> Analyze guest feedback to enhance property amenities and experiences</li>
                <li><strong>Safety & Security:</strong> Verify guest identity, prevent fraud, and ensure property security</li>
                <li><strong>Legal Compliance:</strong> Comply with local lodging regulations and tax requirements</li>
                <li><strong>Marketing (with consent):</strong> Send promotional offers and newsletters (you may opt-out)</li>
                <li><strong>AI Concierge Services:</strong> Provide personalized recommendations and assistance via our AI concierge</li>
              </ul>
            </div>
          </section>

          {/* Data Sharing */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">4. Information Sharing & Disclosure</h2>
            <div className="space-y-6">

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">4.1 Service Providers</h3>
                <p className="text-white/80 leading-relaxed">
                  We share information with trusted third parties who assist in operating our business:
                </p>
                <ul className="text-white/80 space-y-2 list-disc list-inside mt-3">
                  <li>Payment processors (Square, Stripe)</li>
                  <li>Cleaning and maintenance crews (limited to necessary information)</li>
                  <li>Smart home system providers (August, Schlage for smart locks)</li>
                  <li>Email and communication services (SendGrid, Twilio)</li>
                  <li>Analytics providers (Google Analytics)</li>
                </ul>
              </div>

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">4.2 Legal Requirements</h3>
                <p className="text-white/80 leading-relaxed">
                  We may disclose your information when required by law, including:
                </p>
                <ul className="text-white/80 space-y-2 list-disc list-inside mt-3">
                  <li>Response to valid legal processes (subpoenas, court orders)</li>
                  <li>Tax authorities for lodging tax compliance</li>
                  <li>Law enforcement in cases of suspected illegal activity</li>
                  <li>Protection of our rights, property, or safety</li>
                </ul>
              </div>

              <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
                <h3 className="text-xl text-white font-semibold mb-3">4.3 We Do NOT Sell Your Data</h3>
                <p className="text-white/80 leading-relaxed">
                  Right at Home BnB does not sell, rent, or trade your personal information to third parties
                  for marketing purposes. We will never share your data with advertisers.
                </p>
              </div>
            </div>
          </section>

          {/* Data Security */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">5. Data Security</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed">
                We implement robust security measures to protect your personal information:
              </p>
              <ul className="text-white/80 space-y-2 list-disc list-inside mt-4">
                <li><strong>Encryption:</strong> All data transmitted via HTTPS/TLS encryption</li>
                <li><strong>Secure Storage:</strong> Data stored on encrypted, access-controlled servers</li>
                <li><strong>Access Controls:</strong> Only authorized personnel can access guest information</li>
                <li><strong>Payment Security:</strong> PCI-DSS compliant payment processing (we never store full card numbers)</li>
                <li><strong>Smart Lock Security:</strong> Temporary codes expire after checkout; access logs monitored</li>
                <li><strong>Regular Audits:</strong> Periodic security reviews and vulnerability assessments</li>
              </ul>
              <p className="text-white/60 text-sm mt-4">
                While we strive to protect your information, no method of transmission over the Internet
                is 100% secure. We cannot guarantee absolute security.
              </p>
            </div>
          </section>

          {/* Data Retention */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">6. Data Retention</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <ul className="text-white/80 space-y-3 list-disc list-inside">
                <li><strong>Booking Records:</strong> Retained for 7 years for tax and legal compliance</li>
                <li><strong>Communication Logs:</strong> Retained for 3 years</li>
                <li><strong>Smart Lock Access Logs:</strong> Retained for 90 days after checkout</li>
                <li><strong>Marketing Preferences:</strong> Until you unsubscribe or request deletion</li>
                <li><strong>Account Information:</strong> Until you request deletion (subject to legal retention requirements)</li>
              </ul>
            </div>
          </section>

          {/* Your Rights */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">7. Your Privacy Rights</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed mb-4">
                Depending on your location, you may have the following rights regarding your personal data:
              </p>
              <ul className="text-white/80 space-y-3 list-disc list-inside">
                <li><strong>Access:</strong> Request a copy of your personal data we hold</li>
                <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your data (subject to legal requirements)</li>
                <li><strong>Portability:</strong> Receive your data in a portable format</li>
                <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications at any time</li>
                <li><strong>Restrict Processing:</strong> Request limitations on how we use your data</li>
              </ul>
              <p className="text-white/80 mt-4">
                To exercise these rights, contact us at:{' '}
                <a href="mailto:privacy@rah-midland.com" className="text-[#d4a574] hover:underline">
                  privacy@rah-midland.com
                </a>
              </p>
            </div>
          </section>

          {/* Cookies */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">8. Cookies & Tracking</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed mb-4">
                Our website uses cookies to enhance your experience:
              </p>
              <ul className="text-white/80 space-y-2 list-disc list-inside">
                <li><strong>Essential Cookies:</strong> Required for website functionality</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how visitors use our site (Google Analytics)</li>
                <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
              </ul>
              <p className="text-white/80 mt-4">
                You can control cookies through your browser settings. Disabling cookies may affect website functionality.
              </p>
            </div>
          </section>

          {/* Children's Privacy */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">9. Children&apos;s Privacy</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed">
                Our services are not directed to individuals under 18 years of age. We do not knowingly
                collect personal information from children. Booking reservations must be made by adults
                (18 years or older). If you believe we have inadvertently collected information from a
                child, please contact us immediately.
              </p>
            </div>
          </section>

          {/* International Transfers */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">10. International Data Transfers</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed">
                Our operations are based in Texas, USA. If you are accessing our services from outside
                the United States, please be aware that your information may be transferred to and
                processed in the United States. By using our services, you consent to this transfer.
              </p>
            </div>
          </section>

          {/* Policy Changes */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">11. Changes to This Policy</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed">
                We may update this Privacy Policy from time to time. Changes will be posted on this page
                with an updated &quot;Last Modified&quot; date. For significant changes, we will provide notice
                via email or prominent website notice. Your continued use of our services after changes
                constitutes acceptance of the updated policy.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="mb-12">
            <h2 className="text-2xl font-display text-[#d4a574] mb-4">12. Contact Us</h2>
            <div className="bg-[#1a0a0a] border border-[#500000]/30 rounded-xl p-6">
              <p className="text-white/80 leading-relaxed mb-4">
                If you have questions, concerns, or requests regarding this Privacy Policy:
              </p>
              <div className="space-y-3 text-white/80">
                <p><strong>Right at Home BnB</strong></p>
                <p>Owner: Steven Palma</p>
                <p>Location: Midland, Texas</p>
                <p>
                  Email:{' '}
                  <a href="mailto:privacy@rah-midland.com" className="text-[#d4a574] hover:underline">
                    privacy@rah-midland.com
                  </a>
                </p>
                <p>
                  Phone:{' '}
                  <a href="tel:+14325591904" className="text-[#d4a574] hover:underline">
                    (432) 559-1904
                  </a>
                </p>
              </div>
              <p className="text-white/60 text-sm mt-4">
                We will respond to privacy-related inquiries within 30 days.
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
