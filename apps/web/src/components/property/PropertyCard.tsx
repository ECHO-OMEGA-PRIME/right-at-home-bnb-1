'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn, formatCurrency, getStatusColor, parseAmenities } from '@/lib/utils';
import type { Property, PropertyPhoto } from '@/lib/types';
import { Bed, Bath, Users, MapPin, Star, Wifi, Car, Coffee } from 'lucide-react';

interface PropertyCardProps {
  property: Property & { photos?: PropertyPhoto[] };
  className?: string;
  showStatus?: boolean;
}

export function PropertyCard({ property, className, showStatus = true }: PropertyCardProps) {
  const primaryPhoto = property.photos?.find(p => p.isPrimary) || property.photos?.[0];
  const amenities = parseAmenities(property.amenities);

  const hasWifi = amenities.some(a => a.toLowerCase().includes('wifi'));
  const hasParking = amenities.some(a => a.toLowerCase().includes('parking'));
  const hasCoffee = amenities.some(a => a.toLowerCase().includes('coffee'));

  return (
    <Link href={`/properties/${property.id}`} className="block group">
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border border-white/10 bg-[#1a0a0a]/80',
          'backdrop-blur-sm transition-all duration-300',
          'hover:border-maroon-800/50 hover:shadow-xl hover:shadow-maroon-800/20',
          'hover:-translate-y-1',
          className
        )}
      >
        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {primaryPhoto ? (
            <Image
              src={primaryPhoto.url}
              alt={property.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-maroon-800/30 to-[#1a0a0a] flex items-center justify-center">
              <span className="text-white/30 text-lg">No Image</span>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Status badge */}
          {showStatus && (
            <div className="absolute top-3 left-3">
              <span
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm',
                  getStatusColor(property.status)
                )}
              >
                {property.status}
              </span>
            </div>
          )}

          {/* Photo count */}
          {property.photos && property.photos.length > 1 && (
            <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-xs text-white/80">
              {property.photos.length} photos
            </div>
          )}

          {/* Price overlay */}
          <div className="absolute bottom-3 right-3">
            <div className="px-3 py-1.5 rounded-lg bg-maroon-800/90 backdrop-blur-sm border border-maroon-700/50">
              <span className="text-white font-bold">{formatCurrency(property.nightlyRate)}</span>
              <span className="text-white/60 text-sm">/night</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-display text-lg font-semibold text-white truncate group-hover:text-maroon-400 transition-colors">
            {property.name}
          </h3>

          <div className="mt-1 flex items-center gap-1 text-white/50 text-sm">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{property.city}, {property.state}</span>
          </div>

          {/* Property specs */}
          <div className="mt-3 flex items-center gap-4 text-sm text-white/70">
            <div className="flex items-center gap-1">
              <Bed className="h-4 w-4 text-maroon-400" />
              <span>{property.bedrooms}</span>
            </div>
            <div className="flex items-center gap-1">
              <Bath className="h-4 w-4 text-maroon-400" />
              <span>{property.bathrooms}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-maroon-400" />
              <span>{property.maxGuests}</span>
            </div>
          </div>

          {/* Amenity icons */}
          <div className="mt-3 flex items-center gap-2">
            {hasWifi && (
              <div className="p-1.5 rounded bg-white/5" title="WiFi">
                <Wifi className="h-3.5 w-3.5 text-white/50" />
              </div>
            )}
            {hasParking && (
              <div className="p-1.5 rounded bg-white/5" title="Parking">
                <Car className="h-3.5 w-3.5 text-white/50" />
              </div>
            )}
            {hasCoffee && (
              <div className="p-1.5 rounded bg-white/5" title="Coffee">
                <Coffee className="h-3.5 w-3.5 text-white/50" />
              </div>
            )}
            {amenities.length > 3 && (
              <span className="text-xs text-white/40">+{amenities.length - 3} more</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default PropertyCard;
