'use client';

/**
 * Right at Home BnB - Property Detail Page
 * Full property view with gallery, amenities, reviews, booking calendar
 *
 * Colors: Maroon #500000, Gold #C4A777
 */

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Edit, Trash2, MapPin, Bed, Bath, Users, Home,
  Wifi, Car, DollarSign, Calendar, Star, Key, AlertCircle,
  CheckCircle, Wrench, Clock, TrendingUp, BarChart3,
  MessageSquare, Sparkles, Settings, ExternalLink, Heart,
  Share2, Droplets, Flame, Tv, Utensils, Waves, TreePine,
  Shield, BookOpen, Phone, Mail, ChevronRight, Quote
} from 'lucide-react';
import { useProperty, usePropertyOccupancy, usePropertyFinancials, Property } from '@/lib/api';
import { PropertyGallery, PropertyPhoto } from '@/components/PropertyGallery';

// Amenity icon mapping
const amenityIcons: Record<string, React.ElementType> = {
  wifi: Wifi,
  parking: Car,
  pool: Droplets,
  'hot tub': Flame,
  hottub: Flame,
  tv: Tv,
  kitchen: Utensils,
  washer: Waves,
  dryer: Waves,
  'washer/dryer': Waves,
  fireplace: Flame,
  ac: Sparkles,
  heating: Flame,
  grill: Flame,
  bbq: Flame,
  patio: TreePine,
  yard: TreePine,
  'game room': Tv,
};

const statusConfig = {
  ACTIVE: { label: 'Active', color: 'bg-emerald-500', textColor: 'text-emerald-600', icon: CheckCircle },
  INACTIVE: { label: 'Inactive', color: 'bg-gray-400', textColor: 'text-gray-600', icon: AlertCircle },
  MAINTENANCE: { label: 'Maintenance', color: 'bg-amber-500', textColor: 'text-amber-600', icon: Wrench },
};

// Sample house rules
const defaultHouseRules = [
  { rule: 'No smoking inside the property', icon: '🚭' },
  { rule: 'No parties or events', icon: '🎉' },
  { rule: 'Quiet hours: 10 PM - 8 AM', icon: '🔇' },
  { rule: 'No pets unless pre-approved', icon: '🐕' },
  { rule: 'Maximum occupancy must be respected', icon: '👥' },
  { rule: 'Please remove shoes indoors', icon: '👟' },
  { rule: 'Report any damages immediately', icon: '⚠️' },
  { rule: 'Lock all doors when leaving', icon: '🔐' },
];

// Sample reviews (would come from API)
const sampleReviews = [
  {
    id: '1',
    guestName: 'Sarah M.',
    guestAvatar: null,
    date: '2026-01-05',
    rating: 5,
    comment: 'Absolutely loved this place! The hot tub was amazing and the house was spotlessly clean. Perfect for our family getaway.',
    helpful: 12,
  },
  {
    id: '2',
    guestName: 'James K.',
    guestAvatar: null,
    date: '2025-12-28',
    rating: 5,
    comment: 'Great location, wonderful amenities. The game room kept the kids entertained for hours. Will definitely book again!',
    helpful: 8,
  },
  {
    id: '3',
    guestName: 'Maria G.',
    guestAvatar: null,
    date: '2025-12-15',
    rating: 4,
    comment: 'Very comfortable stay. Kitchen was fully equipped and the beds were super comfortable. Only minor issue was WiFi speed.',
    helpful: 5,
  },
];

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  const { data: property, isLoading, error } = useProperty(propertyId);
  const { data: occupancy } = usePropertyOccupancy(propertyId);
  const { data: financials } = usePropertyFinancials(propertyId);

  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'financials' | 'settings'>('overview');
  const [isFavorite, setIsFavorite] = useState(false);

  // Generate sample photos (would come from property data)
  const photos: PropertyPhoto[] = useMemo(() => {
    if (!property) return [];

    // Check if property has photos, otherwise generate placeholders
    return [
      { id: '1', url: `/properties/${propertyId}/hero.jpg`, alt: `${property.name} - Main View`, isPrimary: true, category: 'exterior' as const },
      { id: '2', url: `/properties/${propertyId}/living.jpg`, alt: `${property.name} - Living Room`, category: 'living' as const },
      { id: '3', url: `/properties/${propertyId}/bedroom.jpg`, alt: `${property.name} - Master Bedroom`, category: 'bedroom' as const },
      { id: '4', url: `/properties/${propertyId}/kitchen.jpg`, alt: `${property.name} - Kitchen`, category: 'kitchen' as const },
      { id: '5', url: `/properties/${propertyId}/bathroom.jpg`, alt: `${property.name} - Bathroom`, category: 'bathroom' as const },
    ];
  }, [property, propertyId]);

  // Calculate rating stats
  const ratingStats = useMemo(() => {
    const avgRating = sampleReviews.reduce((acc, r) => acc + r.rating, 0) / sampleReviews.length;
    return {
      average: avgRating,
      total: sampleReviews.length,
      distribution: [0, 0, 0, 1, 2], // 1-5 stars count
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-[#2D2D2D]/10 rounded w-1/3" />
            <div className="h-96 bg-[#2D2D2D]/10 rounded-2xl" />
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-[#2D2D2D]/10 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-['Playfair_Display'] text-[#2D2D2D]">Property not found</h2>
          <p className="text-[#2D2D2D]/60 mt-2">This property may have been removed</p>
          <Link href="/properties">
            <button className="mt-6 px-6 py-3 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors">
              Back to Properties
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig[property.status].icon;

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[#2D2D2D]" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-['Playfair_Display'] font-bold text-[#500000]">
                    {property.name}
                  </h1>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-sm font-medium ${statusConfig[property.status].color}`}>
                    <StatusIcon className="w-4 h-4" />
                    {statusConfig[property.status].label}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[#2D2D2D]/60 mt-1">
                  <MapPin className="w-4 h-4" />
                  <span>{property.address}, {property.city}, {property.state}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className={`p-2.5 rounded-xl transition-colors ${
                  isFavorite ? 'bg-red-500 text-white' : 'bg-[#F5F5F0] text-[#2D2D2D] hover:bg-red-50 hover:text-red-500'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2.5 bg-[#F5F5F0] text-[#2D2D2D] rounded-xl hover:bg-[#500000]/10 transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
              <Link href={`/properties/${propertyId}/calendar`}>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F5F5F0] text-[#500000] font-medium rounded-xl hover:bg-[#500000]/10 transition-colors">
                  <Calendar className="w-5 h-5" />
                  Calendar
                </button>
              </Link>
              <Link href={`/properties/${propertyId}/edit`}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/20"
                >
                  <Edit className="w-5 h-5" />
                  Edit
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Photo Gallery */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <PropertyGallery
            photos={photos}
            propertyName={property.name}
            maxHeight="500px"
          />
        </motion.div>

        {/* Property Info Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5"
            >
              <div className="grid grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#500000]/10 flex items-center justify-center mx-auto mb-3">
                    <Bed className="w-7 h-7 text-[#500000]" />
                  </div>
                  <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                    {property.bedrooms}
                  </div>
                  <div className="text-sm text-[#2D2D2D]/60">Bedrooms</div>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#500000]/10 flex items-center justify-center mx-auto mb-3">
                    <Bath className="w-7 h-7 text-[#500000]" />
                  </div>
                  <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                    {property.bathrooms}
                  </div>
                  <div className="text-sm text-[#2D2D2D]/60">Bathrooms</div>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#500000]/10 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-7 h-7 text-[#500000]" />
                  </div>
                  <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                    {property.maxGuests}
                  </div>
                  <div className="text-sm text-[#2D2D2D]/60">Max Guests</div>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#C4A777]/20 flex items-center justify-center mx-auto mb-3">
                    <Star className="w-7 h-7 text-[#C4A777]" />
                  </div>
                  <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                    {ratingStats.average.toFixed(2)}
                  </div>
                  <div className="text-sm text-[#2D2D2D]/60">{ratingStats.total} reviews</div>
                </div>
              </div>
            </motion.div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[
                { id: 'overview', label: 'Overview', icon: Home },
                { id: 'reviews', label: 'Reviews', icon: Star },
                { id: 'financials', label: 'Financials', icon: BarChart3 },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-[#500000] text-white'
                      : 'bg-white text-[#2D2D2D]/70 hover:bg-[#500000]/10'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <OverviewTab property={property} />
              )}
              {activeTab === 'reviews' && (
                <ReviewsTab reviews={sampleReviews} stats={ratingStats} />
              )}
              {activeTab === 'financials' && (
                <FinancialsTab propertyId={propertyId} />
              )}
              {activeTab === 'settings' && (
                <SettingsTab property={property} />
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Booking Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5 sticky top-24"
            >
              <div className="flex items-baseline justify-between mb-6">
                <div>
                  <span className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
                    ${property.nightlyRate}
                  </span>
                  <span className="text-[#2D2D2D]/60 ml-1">/ night</span>
                </div>
                {property.cleaningFee && (
                  <span className="text-sm text-[#2D2D2D]/60">
                    +${property.cleaningFee} cleaning
                  </span>
                )}
              </div>

              {/* WiFi Info */}
              {property.wifiNetwork && (
                <div className="bg-[#F5F5F0] rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 text-[#2D2D2D]/70 mb-3">
                    <Wifi className="w-5 h-5" />
                    <span className="font-medium">WiFi Access</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#2D2D2D]/50">Network:</span>
                      <span className="font-mono text-[#2D2D2D]">{property.wifiNetwork}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#2D2D2D]/50">Password:</span>
                      <span className="font-mono text-[#2D2D2D]">{property.wifiPassword || '••••••••'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white rounded-xl font-semibold hover:from-[#600000] hover:to-[#822F47] transition-all shadow-lg shadow-[#500000]/20">
                  <Key className="w-5 h-5" />
                  Generate Access Code
                </button>
                <button className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#F5F5F0] text-[#500000] rounded-xl font-medium hover:bg-[#500000]/10 transition-colors">
                  <MessageSquare className="w-5 h-5" />
                  Message Guest
                </button>
                <Link href={`/properties/${propertyId}/calendar`} className="block">
                  <button className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#F5F5F0] text-[#500000] rounded-xl font-medium hover:bg-[#500000]/10 transition-colors">
                    <Calendar className="w-5 h-5" />
                    View Calendar
                  </button>
                </Link>
              </div>

              {/* Performance Summary */}
              <div className="mt-6 pt-6 border-t border-[#2D2D2D]/10">
                <h4 className="font-semibold text-[#2D2D2D] mb-4">This Month</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-[#F5F5F0] rounded-xl">
                    <div className="text-xl font-bold text-emerald-600">87%</div>
                    <div className="text-xs text-[#2D2D2D]/60">Occupancy</div>
                  </div>
                  <div className="text-center p-3 bg-[#F5F5F0] rounded-xl">
                    <div className="text-xl font-bold text-[#500000]">$4,250</div>
                    <div className="text-xs text-[#2D2D2D]/60">Revenue</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Contact Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
              <h4 className="font-semibold text-[#2D2D2D] mb-4">Need Help?</h4>
              <div className="space-y-3">
                <a href="tel:+14329006300" className="flex items-center gap-3 p-3 bg-[#F5F5F0] rounded-xl hover:bg-[#500000]/10 transition-colors">
                  <Phone className="w-5 h-5 text-[#500000]" />
                  <span className="text-[#2D2D2D]">(432) 900-6300</span>
                </a>
                <a href="mailto:support@rightathomebnb.com" className="flex items-center gap-3 p-3 bg-[#F5F5F0] rounded-xl hover:bg-[#500000]/10 transition-colors">
                  <Mail className="w-5 h-5 text-[#500000]" />
                  <span className="text-[#2D2D2D]">Contact Support</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Overview Tab
function OverviewTab({ property }: { property: Property }) {
  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Amenities */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
        <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-4">
          Amenities
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(property.amenities || ['WiFi', 'Kitchen', 'Washer/Dryer', 'Parking', 'TV', 'AC']).map((amenity) => {
            const Icon = amenityIcons[amenity.toLowerCase()] || Sparkles;
            return (
              <div
                key={amenity}
                className="flex items-center gap-3 p-3 bg-[#F5F5F0] rounded-xl"
              >
                <div className="w-10 h-10 rounded-lg bg-[#500000]/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#500000]" />
                </div>
                <span className="text-[#2D2D2D] capitalize">{amenity}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* House Rules */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-[#500000]" />
          <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
            House Rules
          </h3>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {defaultHouseRules.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 bg-[#F5F5F0] rounded-xl"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[#2D2D2D] text-sm">{item.rule}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Check-in/Check-out */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-[#500000]" />
          <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
            Check-in & Check-out
          </h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <div className="font-semibold text-emerald-700 mb-1">Check-in</div>
            <div className="text-emerald-600">After 3:00 PM</div>
          </div>
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div className="font-semibold text-amber-700 mb-1">Check-out</div>
            <div className="text-amber-600">Before 11:00 AM</div>
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
            Recent Bookings
          </h3>
          <Link href={`/properties/${property.id}/calendar`}>
            <button className="text-sm text-[#500000] hover:underline flex items-center gap-1">
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </div>

        <div className="space-y-3">
          {[
            { guest: 'John D.', dates: 'Jan 15-20, 2026', status: 'confirmed', total: '$825' },
            { guest: 'Sarah M.', dates: 'Jan 22-25, 2026', status: 'pending', total: '$495' },
            { guest: 'Mike R.', dates: 'Jan 28 - Feb 2, 2026', status: 'confirmed', total: '$990' },
          ].map((booking, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-[#F5F5F0] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#500000]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#500000]" />
                </div>
                <div>
                  <div className="font-medium text-[#2D2D2D]">{booking.guest}</div>
                  <div className="text-sm text-[#2D2D2D]/60">{booking.dates}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-[#500000]">{booking.total}</div>
                <div className={`text-xs font-medium ${
                  booking.status === 'confirmed' ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Reviews Tab
function ReviewsTab({
  reviews,
  stats,
}: {
  reviews: typeof sampleReviews;
  stats: { average: number; total: number; distribution: number[] };
}) {
  return (
    <motion.div
      key="reviews"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Rating Summary */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
        <div className="flex items-center gap-8">
          <div className="text-center">
            <div className="text-5xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
              {stats.average.toFixed(1)}
            </div>
            <div className="flex items-center justify-center gap-1 my-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(stats.average)
                      ? 'text-[#C4A777] fill-current'
                      : 'text-[#2D2D2D]/20'
                  }`}
                />
              ))}
            </div>
            <div className="text-sm text-[#2D2D2D]/60">{stats.total} reviews</div>
          </div>

          <div className="flex-1">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center gap-2 mb-1">
                <span className="text-sm text-[#2D2D2D]/70 w-3">{rating}</span>
                <Star className="w-4 h-4 text-[#C4A777]" />
                <div className="flex-1 h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C4A777] rounded-full"
                    style={{ width: `${(stats.distribution[rating - 1] / stats.total) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-[#2D2D2D]/50 w-8">
                  {stats.distribution[rating - 1]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center text-white font-semibold">
                  {review.guestName.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-[#2D2D2D]">{review.guestName}</div>
                  <div className="text-sm text-[#2D2D2D]/60">
                    {new Date(review.date).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= review.rating
                        ? 'text-[#C4A777] fill-current'
                        : 'text-[#2D2D2D]/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="relative">
              <Quote className="absolute -top-2 -left-2 w-8 h-8 text-[#500000]/10" />
              <p className="text-[#2D2D2D]/80 leading-relaxed pl-4">
                {review.comment}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-[#2D2D2D]/10 flex items-center justify-between">
              <button className="text-sm text-[#2D2D2D]/60 hover:text-[#500000] transition-colors">
                {review.helpful} found this helpful
              </button>
              <button className="text-sm text-[#500000] hover:underline">
                Report
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Financials Tab
function FinancialsTab({ propertyId }: { propertyId: string }) {
  return (
    <motion.div
      key="financials"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Revenue Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm text-[#2D2D2D]/60">Total Revenue</div>
              <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">$47,520</div>
            </div>
          </div>
          <div className="text-sm text-emerald-600">+12% from last year</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-sm text-[#2D2D2D]/60">Total Expenses</div>
              <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">$8,340</div>
            </div>
          </div>
          <div className="text-sm text-[#2D2D2D]/60">Cleaning, supplies, repairs</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#500000]/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#500000]" />
            </div>
            <div>
              <div className="text-sm text-[#2D2D2D]/60">Net Profit</div>
              <div className="text-2xl font-['Playfair_Display'] font-bold text-[#500000]">$39,180</div>
            </div>
          </div>
          <div className="text-sm text-[#500000]">82% profit margin</div>
        </div>
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
        <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-4">
          Revenue Over Time
        </h3>
        <div className="h-64 bg-gradient-to-br from-[#F5F5F0] to-white rounded-xl flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-[#2D2D2D]/20 mx-auto mb-2" />
            <p className="text-[#2D2D2D]/40">Revenue chart visualization</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
        <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-4">
          Recent Transactions
        </h3>
        <div className="space-y-3">
          {[
            { type: 'Booking Payment', amount: '+$825', date: 'Jan 15, 2026', guest: 'John D.' },
            { type: 'Cleaning Fee', amount: '-$75', date: 'Jan 14, 2026', vendor: 'Rosa M.' },
            { type: 'Booking Payment', amount: '+$495', date: 'Jan 10, 2026', guest: 'Sarah M.' },
            { type: 'Supplies', amount: '-$45', date: 'Jan 8, 2026', vendor: 'Amazon' },
          ].map((transaction, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-[#F5F5F0] rounded-xl">
              <div>
                <div className="font-medium text-[#2D2D2D]">{transaction.type}</div>
                <div className="text-sm text-[#2D2D2D]/60">
                  {transaction.date} - {transaction.guest || transaction.vendor}
                </div>
              </div>
              <div className={`font-semibold ${
                transaction.amount.startsWith('+') ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {transaction.amount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Settings Tab
function SettingsTab({ property }: { property: Property }) {
  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Platform Listings */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
        <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-4">
          Platform Listings
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#F5F5F0] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[#2D2D2D]">Airbnb</span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                  Active
                </span>
                <ExternalLink className="w-4 h-4 text-[#500000] cursor-pointer" />
              </div>
            </div>
            <div className="text-sm text-[#2D2D2D]/60 font-mono">ID: airbnb_123456</div>
          </div>
          <div className="p-4 bg-[#F5F5F0] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[#2D2D2D]">VRBO</span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                  Active
                </span>
                <ExternalLink className="w-4 h-4 text-[#500000] cursor-pointer" />
              </div>
            </div>
            <div className="text-sm text-[#2D2D2D]/60 font-mono">ID: vrbo_789012</div>
          </div>
        </div>
      </div>

      {/* Smart Lock */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-[#500000]" />
          <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
            Smart Lock
          </h3>
        </div>
        <div className="p-4 bg-[#F5F5F0] rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-[#2D2D2D]">Schlage Encode Plus</div>
              <div className="text-sm text-[#2D2D2D]/60">Battery: 85%</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-emerald-600">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-red-200">
        <h3 className="text-lg font-['Playfair_Display'] font-semibold text-red-600 mb-4">
          Danger Zone
        </h3>
        <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl">
          <div>
            <div className="font-medium text-[#2D2D2D]">Delete Property</div>
            <div className="text-sm text-[#2D2D2D]/60">
              Permanently remove this property and all data
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
}
