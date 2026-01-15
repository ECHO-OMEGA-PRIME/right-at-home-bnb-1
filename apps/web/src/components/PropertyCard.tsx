'use client';

/**
 * Right at Home BnB - Property Card Component
 * Beautiful property cards with hero image, amenities, ratings
 *
 * Colors: Maroon #500000, Gold #C4A777
 */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MapPin, Bed, Bath, Users, Star, Heart, Eye,
  Wifi, Car, Droplets, Flame, Tv, Utensils,
  Waves, Home, Building2, TreePine, ChevronLeft, ChevronRight,
  Sparkles
} from 'lucide-react';
import { Property } from '@/lib/api';
import { PropertyPhoto, CompactGallery } from './PropertyGallery';

// Amenity icons mapping
const amenityIcons: Record<string, React.ElementType> = {
  wifi: Wifi,
  parking: Car,
  pool: Droplets,
  'hot tub': Flame,
  hottub: Flame,
  'hot-tub': Flame,
  tv: Tv,
  kitchen: Utensils,
  washer: Waves,
  dryer: Waves,
  'washer/dryer': Waves,
  fireplace: Flame,
  ac: Sparkles,
  'air conditioning': Sparkles,
  heating: Flame,
  grill: Flame,
  bbq: Flame,
  patio: TreePine,
  yard: TreePine,
  'game room': Tv,
  gameroom: Tv,
  billiards: Tv,
};

// Get icon for amenity
function getAmenityIcon(amenity: string): React.ElementType {
  const key = amenity.toLowerCase().trim();
  return amenityIcons[key] || Sparkles;
}

// Property type icons
const propertyTypeIcons: Record<string, React.ElementType> = {
  HOUSE: Home,
  APARTMENT: Building2,
  CONDO: Building2,
  TOWNHOUSE: Home,
  CABIN: TreePine,
};

// Status configuration
const statusConfig = {
  ACTIVE: { label: 'Active', bgColor: 'bg-emerald-500', textColor: 'text-emerald-600' },
  INACTIVE: { label: 'Inactive', bgColor: 'bg-gray-400', textColor: 'text-gray-600' },
  MAINTENANCE: { label: 'Maintenance', bgColor: 'bg-amber-500', textColor: 'text-amber-600' },
};

// Extended Property interface for UI
export interface PropertyWithPhotos extends Property {
  photos?: PropertyPhoto[];
  rating?: number;
  reviewCount?: number;
  isFeatured?: boolean;
  isNew?: boolean;
}

interface PropertyCardProps {
  property: PropertyWithPhotos;
  index?: number;
  variant?: 'default' | 'compact' | 'featured';
  onQuickView?: (property: PropertyWithPhotos) => void;
}

export function PropertyCard({
  property,
  index = 0,
  variant = 'default',
  onQuickView,
}: PropertyCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const TypeIcon = propertyTypeIcons[property.propertyType] || Home;
  const status = statusConfig[property.status];

  // Get display photos or create placeholder
  const photos: PropertyPhoto[] = property.photos?.length
    ? property.photos
    : [
        {
          id: 'placeholder',
          url: `/properties/${property.id}/hero.jpg`,
          alt: property.name,
          isPrimary: true,
        },
      ];

  // Priority amenities to show (max 4)
  const priorityAmenities = ['wifi', 'pool', 'hot tub', 'parking', 'kitchen', 'tv'];
  const displayAmenities = (property.amenities || [])
    .filter((a) => priorityAmenities.some((p) => a.toLowerCase().includes(p)))
    .slice(0, 4);

  if (variant === 'compact') {
    return (
      <CompactPropertyCard property={property} index={index} />
    );
  }

  if (variant === 'featured') {
    return (
      <FeaturedPropertyCard
        property={property}
        index={index}
        photos={photos}
        onQuickView={onQuickView}
      />
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-[#2D2D2D]/5 hover:shadow-xl hover:border-[#500000]/20 transition-all duration-300"
    >
      {/* Image Section */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {/* Photo Carousel */}
        {photos.length > 0 ? (
          <div className="relative w-full h-full">
            <Image
              src={photos[imageIndex]?.url || '/images/property-placeholder.jpg'}
              alt={photos[imageIndex]?.alt || property.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/images/property-placeholder.jpg';
              }}
            />

            {/* Photo Navigation */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setImageIndex(imageIndex > 0 ? imageIndex - 1 : photos.length - 1);
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white z-10"
                >
                  <ChevronLeft className="w-4 h-4 text-[#2D2D2D]" />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setImageIndex(imageIndex < photos.length - 1 ? imageIndex + 1 : 0);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white z-10"
                >
                  <ChevronRight className="w-4 h-4 text-[#2D2D2D]" />
                </button>

                {/* Photo Dots */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {photos.slice(0, 5).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setImageIndex(idx);
                      }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === imageIndex ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/75'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#500000]/10 to-[#722F37]/10 flex items-center justify-center">
            <TypeIcon className="w-16 h-16 text-[#500000]/30" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {/* Status Badge */}
          <div className={`px-3 py-1 rounded-full text-white text-xs font-medium ${status.bgColor}`}>
            {status.label}
          </div>

          {/* Featured/New Badge */}
          {property.isFeatured && (
            <div className="px-3 py-1 bg-[#C4A777] rounded-full text-white text-xs font-medium flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" />
              Featured
            </div>
          )}
          {property.isNew && (
            <div className="px-3 py-1 bg-[#500000] rounded-full text-white text-xs font-medium">
              New
            </div>
          )}
        </div>

        {/* Top Right Actions */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsFavorite(!isFavorite);
            }}
            className={`p-2 rounded-full transition-all ${
              isFavorite
                ? 'bg-red-500 text-white'
                : 'bg-white/80 text-[#2D2D2D] hover:bg-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          {onQuickView && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickView(property);
              }}
              className="p-2 bg-white/80 text-[#2D2D2D] rounded-full hover:bg-white transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Bottom Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Price Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Rating */}
              {property.rating && (
                <div className="flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-sm">
                  <Star className="w-4 h-4 text-[#C4A777] fill-current" />
                  <span className="font-semibold text-[#2D2D2D]">{property.rating.toFixed(2)}</span>
                  {property.reviewCount && (
                    <span className="text-[#2D2D2D]/60">({property.reviewCount})</span>
                  )}
                </div>
              )}
            </div>

            <div className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg">
              <span className="font-bold text-[#500000]">${property.nightlyRate}</span>
              <span className="text-[#2D2D2D]/60 text-sm">/night</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <Link href={`/properties/${property.id}`}>
        <div className="p-5">
          {/* Title */}
          <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-1 truncate group-hover:text-[#500000] transition-colors">
            {property.name}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1 text-[#2D2D2D]/60 text-sm mb-4">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {property.address}, {property.city}
            </span>
          </div>

          {/* Property Stats */}
          <div className="flex items-center gap-4 text-[#2D2D2D]/70 text-sm mb-4">
            <div className="flex items-center gap-1.5">
              <Bed className="w-4 h-4" />
              <span>{property.bedrooms} bed{property.bedrooms !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bath className="w-4 h-4" />
              <span>{property.bathrooms} bath{property.bathrooms !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>{property.maxGuests} guest{property.maxGuests !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Amenities */}
          {displayAmenities.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {displayAmenities.map((amenity) => {
                const Icon = getAmenityIcon(amenity);
                return (
                  <div
                    key={amenity}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F5F5F0] rounded-lg text-xs text-[#2D2D2D]/70"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="capitalize">{amenity}</span>
                  </div>
                );
              })}
              {(property.amenities?.length || 0) > displayAmenities.length && (
                <div className="px-2.5 py-1 bg-[#500000]/10 rounded-lg text-xs text-[#500000] font-medium">
                  +{(property.amenities?.length || 0) - displayAmenities.length} more
                </div>
              )}
            </div>
          )}

          {/* CTA Button */}
          <button className="w-full py-3 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl hover:from-[#600000] hover:to-[#822F47] transition-all shadow-md hover:shadow-lg">
            View Details
          </button>
        </div>
      </Link>
    </motion.div>
  );
}

// Compact Property Card (for lists)
function CompactPropertyCard({
  property,
  index,
}: {
  property: PropertyWithPhotos;
  index: number;
}) {
  const TypeIcon = propertyTypeIcons[property.propertyType] || Home;
  const status = statusConfig[property.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.03 }}
      className="group bg-white rounded-xl p-4 shadow-sm border border-[#2D2D2D]/5 hover:shadow-lg hover:border-[#500000]/20 transition-all duration-300"
    >
      <Link href={`/properties/${property.id}`}>
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 relative">
            {property.photos?.[0] ? (
              <Image
                src={property.photos[0].url}
                alt={property.name}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#500000]/10 to-[#722F37]/10 flex items-center justify-center">
                <TypeIcon className="w-8 h-8 text-[#500000]/30" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D] truncate group-hover:text-[#500000] transition-colors">
                {property.name}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-white text-xs ${status.bgColor}`}>
                {status.label}
              </span>
            </div>

            <div className="flex items-center gap-1 text-[#2D2D2D]/60 text-sm mb-2">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate">{property.address}, {property.city}</span>
            </div>

            <div className="flex items-center gap-4 text-[#2D2D2D]/70 text-xs">
              <span className="flex items-center gap-1">
                <Bed className="w-3.5 h-3.5" />
                {property.bedrooms}
              </span>
              <span className="flex items-center gap-1">
                <Bath className="w-3.5 h-3.5" />
                {property.bathrooms}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {property.maxGuests}
              </span>
              {property.rating && (
                <span className="flex items-center gap-1 text-[#C4A777]">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {property.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="text-right flex-shrink-0">
            <div className="text-xl font-['Playfair_Display'] font-bold text-[#500000]">
              ${property.nightlyRate}
            </div>
            <div className="text-xs text-[#2D2D2D]/50">per night</div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// Featured Property Card (larger, more detail)
function FeaturedPropertyCard({
  property,
  index,
  photos,
  onQuickView,
}: {
  property: PropertyWithPhotos;
  index: number;
  photos: PropertyPhoto[];
  onQuickView?: (property: PropertyWithPhotos) => void;
}) {
  const [isFavorite, setIsFavorite] = useState(false);
  const TypeIcon = propertyTypeIcons[property.propertyType] || Home;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group bg-white rounded-3xl overflow-hidden shadow-elegant-lg border border-[#2D2D2D]/5 hover:shadow-2xl transition-all duration-500"
    >
      <div className="grid md:grid-cols-2 gap-0">
        {/* Image Section */}
        <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[400px]">
          <CompactGallery
            photos={photos}
            maxPhotos={5}
            onViewAll={onQuickView ? () => onQuickView(property) : undefined}
          />

          {/* Featured Badge */}
          <div className="absolute top-4 left-4 px-4 py-2 bg-gradient-to-r from-[#C4A777] to-[#D4B787] rounded-full text-white font-semibold flex items-center gap-2 shadow-lg">
            <Star className="w-4 h-4 fill-current" />
            Featured Property
          </div>

          {/* Favorite */}
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsFavorite(!isFavorite);
            }}
            className={`absolute top-4 right-4 p-3 rounded-full transition-all shadow-lg ${
              isFavorite ? 'bg-red-500 text-white' : 'bg-white text-[#2D2D2D] hover:bg-red-500 hover:text-white'
            }`}
          >
            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Content Section */}
        <div className="p-8 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D] mb-2">
                  {property.name}
                </h2>
                <div className="flex items-center gap-1.5 text-[#2D2D2D]/60">
                  <MapPin className="w-4 h-4" />
                  <span>{property.address}, {property.city}, {property.state}</span>
                </div>
              </div>

              {property.rating && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F5F0] rounded-xl">
                  <Star className="w-5 h-5 text-[#C4A777] fill-current" />
                  <span className="text-lg font-bold text-[#2D2D2D]">{property.rating.toFixed(2)}</span>
                  {property.reviewCount && (
                    <span className="text-sm text-[#2D2D2D]/60">({property.reviewCount})</span>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-[#F5F5F0] rounded-xl">
                <Bed className="w-6 h-6 text-[#500000] mx-auto mb-2" />
                <div className="text-xl font-bold text-[#2D2D2D]">{property.bedrooms}</div>
                <div className="text-sm text-[#2D2D2D]/60">Bedrooms</div>
              </div>
              <div className="text-center p-4 bg-[#F5F5F0] rounded-xl">
                <Bath className="w-6 h-6 text-[#500000] mx-auto mb-2" />
                <div className="text-xl font-bold text-[#2D2D2D]">{property.bathrooms}</div>
                <div className="text-sm text-[#2D2D2D]/60">Bathrooms</div>
              </div>
              <div className="text-center p-4 bg-[#F5F5F0] rounded-xl">
                <Users className="w-6 h-6 text-[#500000] mx-auto mb-2" />
                <div className="text-xl font-bold text-[#2D2D2D]">{property.maxGuests}</div>
                <div className="text-sm text-[#2D2D2D]/60">Guests</div>
              </div>
            </div>

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[#2D2D2D]/70 mb-3">Key Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.slice(0, 6).map((amenity) => {
                    const Icon = getAmenityIcon(amenity);
                    return (
                      <div
                        key={amenity}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#500000]/5 rounded-lg text-sm text-[#500000]"
                      >
                        <Icon className="w-4 h-4" />
                        <span className="capitalize">{amenity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-[#2D2D2D]/10">
            <div>
              <div className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
                ${property.nightlyRate}
              </div>
              <div className="text-sm text-[#2D2D2D]/60">per night</div>
            </div>

            <Link href={`/properties/${property.id}`}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-maroon hover:shadow-xl transition-all"
              >
                View Property
              </motion.button>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default PropertyCard;
