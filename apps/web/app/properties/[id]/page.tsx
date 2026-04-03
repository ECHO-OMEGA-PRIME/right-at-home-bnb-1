'use client';

/**
 * Right at Home BnB - Property Detail Page
 * Full photo gallery with room categorization + property info
 *
 * Colors: Maroon #500000, Gold #C4A777
 */

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Bed, Bath, Users, Star, MapPin, ExternalLink,
  Wifi, Car, Droplets, Flame, Sparkles, Home, ChevronRight,
  Grid3X3, X, ChevronLeft, ZoomIn, Heart, Share2,
  Coffee, Tv, Waves, TreePine, Shield, UtensilsCrossed,
  Shirt, Gamepad2, Baby, PawPrint, Wind, Maximize2
} from 'lucide-react';
import {
  PROPERTIES, CATEGORY_CONFIG, normalizeCategory,
  getPropertyById, type PropertyListing
} from '@/lib/property-data';
import { PROPERTY_PHOTOS, getPhotosForProperty, type PropertyPhotoEntry } from '@/lib/property-photos';

// Amenity icons
const AMENITY_ICONS: Record<string, typeof Wifi> = {
  'free wifi': Wifi, 'wifi': Wifi,
  'pool': Droplets, 'private pool': Droplets,
  'hot tub': Flame, 'outdoor spa tub': Flame,
  'parking': Car, 'covered parking': Car, 'extra parking': Car,
  'kitchen': UtensilsCrossed, 'private kitchen': UtensilsCrossed,
  'washer': Shirt, 'dryer': Shirt,
  'air conditioning': Wind,
  'pet friendly': PawPrint,
  'fireplace': Flame,
  'billiards': Gamepad2, 'billiards table': Gamepad2, 'game room': Gamepad2,
  'patio': TreePine, 'covered patio': TreePine,
  'barbecue grill': Flame,
  'playground': Baby, 'children\'s area': Baby,
  'large yard': TreePine, 'massive yard': TreePine, 'two large yards': TreePine, 'gated yard': Shield,
  'pool cabana': Waves, 'jetted bathtub': Waves,
  'near golf course': Sparkles,
  'fire pits': Flame,
  'balcony': Maximize2,
  'outdoor dining': UtensilsCrossed,
  'multiple outdoor spaces': TreePine, 'outdoor living areas': TreePine,
  'corner lot': Home,
  'man cave': Gamepad2,
  'safari theme': Sparkles, 'retro theme': Sparkles, 'stylish decor': Sparkles,
};

function getAmenityIcon(amenity: string) {
  const lower = amenity.toLowerCase();
  for (const [key, Icon] of Object.entries(AMENITY_ICONS)) {
    if (lower.includes(key) || key.includes(lower)) return Icon;
  }
  return Sparkles;
}

// Photo category display
interface CategoryGroup {
  category: string;
  label: string;
  photos: PropertyPhotoEntry[];
}

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  const property = useMemo(() => getPropertyById(propertyId), [propertyId]);
  const photos = useMemo(() => getPhotosForProperty(propertyId), [propertyId]);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  // Group photos by category
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const groups: Record<string, PropertyPhotoEntry[]> = {};
    for (const photo of photos) {
      const cat = photo.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(photo);
    }

    return Object.entries(groups)
      .map(([category, catPhotos]) => ({
        category,
        label: CATEGORY_CONFIG[category]?.label || category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        photos: catPhotos,
      }))
      .sort((a, b) => {
        const orderA = CATEGORY_CONFIG[a.category]?.order ?? 50;
        const orderB = CATEGORY_CONFIG[b.category]?.order ?? 50;
        return orderA - orderB;
      });
  }, [photos]);

  // Flat list for lightbox navigation
  const allPhotos = useMemo(() => {
    if (activeCategory) {
      return photos.filter(p => p.category === activeCategory);
    }
    return photos;
  }, [photos, activeCategory]);

  // Keyboard nav
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') setLightboxIndex(i => Math.min(i + 1, allPhotos.length - 1));
      if (e.key === 'ArrowLeft') setLightboxIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, allPhotos.length]);

  if (!property) {
    return (
      <div className="min-h-screen bg-[#0a0505] flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-playfair text-3xl text-white mb-4">Property Not Found</h1>
          <p className="text-white/60 mb-8">The property you&apos;re looking for doesn&apos;t exist.</p>
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

  const heroPhoto = photos.find(p => p.category === 'hero') || photos[0];
  const ratingStars = Math.round(property.rating / 2); // Convert /10 to /5

  function openLightbox(photoIndex: number) {
    setLightboxIndex(photoIndex);
    setLightboxOpen(true);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: `${property!.name} - Right at Home BnB`,
        text: property!.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0505]">
      {/* Header / Breadcrumbs */}
      <div className="bg-gradient-to-b from-[#500000]/30 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center gap-2 text-sm text-white/50 mb-4">
            <Link href="/" className="hover:text-[#C4A777] transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/properties" className="hover:text-[#C4A777] transition-colors">Properties</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-[#C4A777]">{property.name}</span>
          </nav>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-playfair text-3xl sm:text-4xl lg:text-5xl text-white mb-2">
                {property.name}
              </h1>
              <div className="flex items-center gap-4 text-white/70">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-[#C4A777]" />
                  {property.address}, {property.city}, {property.state}
                </span>
                {property.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-[#C4A777] fill-[#C4A777]" />
                    <span className="text-white font-medium">{property.rating}/10</span>
                    <span className="text-white/50">({property.reviewCount} reviews)</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleShare}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                title="Share"
              >
                <Share2 className="w-5 h-5 text-white/70" />
              </button>
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                title="Favorite"
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'text-red-500 fill-red-500' : 'text-white/70'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Photo Grid */}
      {photos.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-2xl overflow-hidden">
            {/* Main hero */}
            <div
              className="md:col-span-2 md:row-span-2 relative group cursor-pointer aspect-[4/3] md:aspect-auto"
              onClick={() => openLightbox(0)}
            >
              <img
                src={heroPhoto?.url || '/properties/placeholder.webp'}
                alt={property.name}
                className="w-full h-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            {/* Side photos */}
            {photos.slice(1, 5).map((photo, idx) => (
              <div
                key={photo.filename}
                className="relative group cursor-pointer aspect-[4/3] hidden md:block"
                onClick={() => openLightbox(idx + 1)}
              >
                <img
                  src={photo.url}
                  alt={photo.alt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                {idx === 3 && photos.length > 5 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-medium text-lg">+{photos.length - 5} photos</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Show all photos button */}
          {photos.length > 5 && (
            <button
              onClick={() => openLightbox(0)}
              className="mt-3 inline-flex items-center gap-2 text-[#C4A777] hover:text-white transition-colors text-sm"
            >
              <Grid3X3 className="w-4 h-4" />
              Show all {photos.length} photos
            </button>
          )}
        </div>
      )}

      {/* Property Info + Gallery */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Details + Photos */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: Bed, label: 'Bedrooms', value: property.bedrooms },
                { icon: Bath, label: 'Bathrooms', value: property.bathrooms },
                { icon: Users, label: 'Sleeps', value: property.sleeps },
                { icon: Star, label: 'Rating', value: `${property.rating}/10` },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center"
                >
                  <Icon className="w-5 h-5 text-[#C4A777] mx-auto mb-2" />
                  <div className="text-white font-semibold text-lg">{value}</div>
                  <div className="text-white/50 text-sm">{label}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-playfair text-xl text-white mb-3">About This Property</h2>
              <p className="text-white/70 leading-relaxed">{property.description}</p>
            </div>

            {/* Amenities */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="font-playfair text-xl text-white mb-4">Amenities</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {property.amenities.map((amenity) => {
                  const Icon = getAmenityIcon(amenity);
                  return (
                    <div key={amenity} className="flex items-center gap-3 text-white/70">
                      <div className="w-8 h-8 rounded-lg bg-[#500000]/30 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[#C4A777]" />
                      </div>
                      <span className="text-sm">{amenity}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Photo Gallery by Category */}
            {categoryGroups.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-playfair text-2xl text-white">Photo Gallery</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-sm">{photos.length} photos</span>
                  </div>
                </div>

                {/* Category Filter Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setActiveCategory(null)}
                    className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                      activeCategory === null
                        ? 'bg-[#500000] text-white'
                        : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    All ({photos.length})
                  </button>
                  {categoryGroups.map(group => (
                    <button
                      key={group.category}
                      onClick={() => setActiveCategory(
                        activeCategory === group.category ? null : group.category
                      )}
                      className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                        activeCategory === group.category
                          ? 'bg-[#500000] text-white'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {group.label} ({group.photos.length})
                    </button>
                  ))}
                </div>

                {/* Photo Grid */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeCategory || 'all'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                  >
                    {(activeCategory
                      ? photos.filter(p => p.category === activeCategory)
                      : photos
                    ).map((photo, idx) => (
                      <motion.div
                        key={photo.filename}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                        className="relative group cursor-pointer aspect-[4/3] rounded-xl overflow-hidden"
                        onClick={() => openLightbox(idx)}
                      >
                        <img
                          src={photo.url}
                          alt={photo.alt}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-white text-xs bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md">
                            {CATEGORY_CONFIG[photo.category]?.label ||
                              photo.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Right Sidebar: Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Booking Card */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-white">${property.nightlyRate}</span>
                  <span className="text-white/50">/ night</span>
                </div>

                {property.rating > 0 && (
                  <div className="flex items-center gap-2 mb-6">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= ratingStars
                              ? 'text-[#C4A777] fill-[#C4A777]'
                              : 'text-white/20'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-white/70 text-sm">
                      {property.rating}/10 ({property.reviewCount} reviews)
                    </span>
                  </div>
                )}

                {/* Direct Booking — Primary */}
                <Link
                  href={`/properties/${property.id}/book`}
                  className="w-full flex items-center justify-center gap-2 bg-[#C4A777] hover:bg-[#d4b787]
                           text-[#0a0505] font-bold py-3 px-6 rounded-xl transition-colors mb-2"
                >
                  Book Now — Best Price
                </Link>

                {/* VRBO — Secondary */}
                {property.vrboUrl && (
                  <a
                    href={property.vrboUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 border border-white/20
                             text-white/70 text-sm py-2.5 px-6 rounded-xl hover:bg-white/5 transition-colors mb-2"
                  >
                    Or book on VRBO
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <p className="text-green-400 text-xs text-center mb-2">
                  Save by booking direct!
                </p>

                <p className="text-white/40 text-xs text-center">
                  Managed by Steven Palma
                </p>
              </div>

              {/* Property Highlights */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h3 className="font-playfair text-lg text-white mb-4">Property Highlights</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Home className="w-5 h-5 text-[#C4A777]" />
                    <div>
                      <div className="text-white text-sm font-medium">Entire {property.propertyType.toLowerCase()}</div>
                      <div className="text-white/50 text-xs">{property.bedrooms} bed, {property.bathrooms} bath</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-[#C4A777]" />
                    <div>
                      <div className="text-white text-sm font-medium">Sleeps {property.sleeps}</div>
                      <div className="text-white/50 text-xs">Perfect for groups</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-[#C4A777]" />
                    <div>
                      <div className="text-white text-sm font-medium">Midland, TX</div>
                      <div className="text-white/50 text-xs">Permian Basin</div>
                    </div>
                  </div>
                  {property.amenities.some(a => a.toLowerCase().includes('pet')) && (
                    <div className="flex items-center gap-3">
                      <PawPrint className="w-5 h-5 text-[#C4A777]" />
                      <div>
                        <div className="text-white text-sm font-medium">Pet Friendly</div>
                        <div className="text-white/50 text-xs">Bring your furry friends</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Back to listings */}
              <Link
                href="/properties"
                className="flex items-center justify-center gap-2 text-white/50 hover:text-[#C4A777] transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                View all properties
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && allPhotos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Close */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Counter */}
            <div className="absolute top-4 left-4 z-10 text-white/70 text-sm">
              {lightboxIndex + 1} / {allPhotos.length}
            </div>

            {/* Category label */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <span className="text-white/70 text-sm bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full">
                {CATEGORY_CONFIG[allPhotos[lightboxIndex]?.category]?.label ||
                  allPhotos[lightboxIndex]?.category.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </span>
            </div>

            {/* Prev */}
            {lightboxIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => i - 1); }}
                className="absolute left-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
            )}

            {/* Next */}
            {lightboxIndex < allPhotos.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => i + 1); }}
                className="absolute right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            )}

            {/* Image */}
            <motion.img
              key={allPhotos[lightboxIndex]?.url}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              src={allPhotos[lightboxIndex]?.url}
              alt={allPhotos[lightboxIndex]?.alt}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Thumbnail strip */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 max-w-[90vw] overflow-x-auto pb-1">
              {allPhotos.slice(
                Math.max(0, lightboxIndex - 5),
                Math.min(allPhotos.length, lightboxIndex + 6)
              ).map((photo, idx) => {
                const realIdx = Math.max(0, lightboxIndex - 5) + idx;
                return (
                  <button
                    key={photo.filename}
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(realIdx); }}
                    className={`w-12 h-12 rounded-md overflow-hidden shrink-0 border-2 transition-colors ${
                      realIdx === lightboxIndex ? 'border-[#C4A777]' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
