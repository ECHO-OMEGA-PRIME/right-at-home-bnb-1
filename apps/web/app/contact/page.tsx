'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Phone, Mail, MapPin, Send, Loader2 } from 'lucide-react';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `Contact form from ${name} (${email}): ${message}`,
          category: 'contact',
        }),
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="bg-maroon-900 text-white py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-serif font-bold mb-2">Contact Us</h1>
          <p className="text-maroon-100">Questions about a property or booking? We respond fast.</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-gray-700">
              <Phone className="w-5 h-5 text-maroon-700" />
              <span>(432) 555-0100</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <Mail className="w-5 h-5 text-maroon-700" />
              <span>steven@rah-midland.com</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <MapPin className="w-5 h-5 text-maroon-700" />
              <span>Midland, TX 79701</span>
            </div>
          </div>

          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-green-800">
              <p className="font-medium mb-2">Message received!</p>
              <p className="text-sm">Steven or our team will get back to you shortly.</p>
              <Link href="/book" className="text-sm text-maroon-700 underline mt-3 inline-block">
                Browse properties
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Your name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-maroon-500"
              />
              <input
                type="email"
                placeholder="Email address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-maroon-500"
              />
              <textarea
                placeholder="How can we help?"
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-maroon-500 resize-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-maroon-800 text-white px-6 py-2.5 rounded-lg hover:bg-maroon-900 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Message
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}