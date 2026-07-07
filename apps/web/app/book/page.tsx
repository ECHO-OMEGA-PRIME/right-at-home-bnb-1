'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, Users, ArrowRight } from 'lucide-react';
import { PROPERTIES } from '@/lib/property-data';
import { getPhotosForProperty } from '@/lib/property-photos';

export default function BookPage() {
  const activeProperties = PROPERTIES.filter((p) => p.status === 'ACTIVE');

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="bg-maroon-900 text-white py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-maroon-200 text-sm uppercase tracking-widest mb-2">Right at Home BnB</p>
          <h1 className="text-4xl font-serif font-bold mb-3">Book Your Stay</h1>
          <p className="text-maroon-100 max-w-2xl">
            Choose from {activeProperties.length} vacation rentals in Midland, Texas.
            Direct booking — no platform fees.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid gap-6 md:grid-cols-2">
          {activeProperties.map((property) => {
            const photos = getPhotosForProperty(property.id);
            const coverUrl = photos[0]?.url;
            return (
            <Link
              key={property.id}
              href={`/properties/${property.id}/book`}
              className="group bg-white rounded-2xl shadow-sm border border-maroon-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="relative h-48 bg-maroon-100">
                {coverUrl && (
                  <Image
                    src={coverUrl}
                    alt={property.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                )}
              </div>
              <div className="p-5">
                <h2 className="text-xl font-serif font-semibold text-maroon-900 mb-2">
                  {property.name}
                </h2>
                <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {property.city}, {property.state}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" /> Sleeps {property.sleeps}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-maroon-800">
                    ${property.nightlyRate}/night
                  </span>
                  <span className="flex items-center gap-1 text-maroon-700 font-medium group-hover:gap-2 transition-all">
                    <Calendar className="w-4 h-4" />
                    Book now <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </Link>
          );
          })}
        </div>

        <p className="text-center text-gray-500 mt-10 text-sm">
          Also available on{' '}
          <a href="/listings" className="text-maroon-700 underline">VRBO listings</a>
          {' '}and{' '}
          <Link href="/properties" className="text-maroon-700 underline">all properties</Link>.
        </p>
      </main>
    </div>
  );
}