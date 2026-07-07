import Link from 'next/link';
import { Home, Star, MapPin, Shield } from 'lucide-react';

export const metadata = {
  title: 'About | Right at Home BnB',
  description: 'Steven Palma manages 22 vacation rentals in Midland, Texas.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <header className="bg-maroon-900 text-white py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-maroon-200 text-sm uppercase tracking-widest mb-3">Midland, Texas</p>
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">Right at Home BnB</h1>
          <p className="text-maroon-100 text-lg">
            Premium short-term rentals managed by Steven Palma — local hospitality with
            Aggie pride and Texas warmth.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <section>
          <h2 className="text-2xl font-serif font-semibold text-maroon-900 mb-4">Our Story</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Right at Home BnB operates {22} vacation rental properties across Midland, Texas —
            serving oilfield professionals, relocating families, and travelers who want a
            comfortable home away from home.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Every property is professionally cleaned, fully furnished, and equipped with
            the amenities you need for an extended stay. Book direct on this site or find
            us on VRBO.
          </p>
        </section>

        <section className="grid sm:grid-cols-2 gap-6">
          {[
            { icon: Home, title: '22 Properties', desc: 'Houses and compounds across Midland' },
            { icon: Star, title: 'Guest-First', desc: '24/7 support and concierge services' },
            { icon: MapPin, title: 'Local Expert', desc: 'Steven Palma — born and raised in West Texas' },
            { icon: Shield, title: 'Professionally Managed', desc: 'Cleaning, maintenance, and smart locks' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-xl p-5 border border-maroon-100 shadow-sm">
              <Icon className="w-8 h-8 text-maroon-700 mb-3" />
              <h3 className="font-semibold text-maroon-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </section>

        <section className="text-center pt-4">
          <Link
            href="/book"
            className="inline-block bg-maroon-800 text-white px-8 py-3 rounded-lg font-medium hover:bg-maroon-900 transition-colors"
          >
            Browse &amp; Book
          </Link>
        </section>
      </main>
    </div>
  );
}