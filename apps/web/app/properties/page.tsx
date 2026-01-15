'use client';

/**
 * Right at Home BnB - Properties Page
 * Full property grid with search, filters, sorting
 *
 * Colors: Maroon #500000, Gold #C4A777
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Home, Search, Filter, Plus, MapPin, Users, Bed, Bath,
  DollarSign, Star, Eye, Edit, Calendar, X, SlidersHorizontal,
  CheckCircle, AlertCircle, Wrench, Grid3X3, List, LayoutGrid,
  TrendingUp, Building2, ArrowUpDown, ChevronDown, Wifi, Car,
  Droplets, Flame, Sparkles
} from 'lucide-react';
import { useProperties, Property } from '@/lib/api';
import { PropertyCard, PropertyWithPhotos } from '@/components/PropertyCard';
import { PropertyGallery, PropertyPhoto } from '@/components/PropertyGallery';

type ViewMode = 'grid' | 'list' | 'featured';
type StatusFilter = 'all' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
type SortOption = 'name' | 'price_asc' | 'price_desc' | 'beds' | 'rating' | 'newest';

// Amenity filters available
const amenityFilters = [
  { key: 'wifi', label: 'WiFi', icon: Wifi },
  { key: 'pool', label: 'Pool', icon: Droplets },
  { key: 'hot tub', label: 'Hot Tub', icon: Flame },
  { key: 'parking', label: 'Parking', icon: Car },
  { key: 'game room', label: 'Game Room', icon: Sparkles },
];

const statusConfig = {
  ACTIVE: { label: 'Active', color: 'bg-emerald-500', icon: CheckCircle },
  INACTIVE: { label: 'Inactive', color: 'bg-gray-400', icon: AlertCircle },
  MAINTENANCE: { label: 'Maintenance', color: 'bg-amber-500', icon: Wrench },
};

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'beds', label: 'Most Bedrooms' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'newest', label: 'Newest First' },
];

export default function PropertiesPage() {
  const { data: properties, isLoading, error } = useProperties();

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [bedroomFilter, setBedroomFilter] = useState<number | null>(null);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
  const [quickViewProperty, setQuickViewProperty] = useState<PropertyWithPhotos | null>(null);

  // Toggle amenity filter
  const toggleAmenity = useCallback((amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity]
    );
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setSelectedAmenities([]);
    setBedroomFilter(null);
    setPriceRange(null);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery !== '' ||
      statusFilter !== 'all' ||
      selectedAmenities.length > 0 ||
      bedroomFilter !== null ||
      priceRange !== null
    );
  }, [searchQuery, statusFilter, selectedAmenities, bedroomFilter, priceRange]);

  // Filter and sort properties
  const filteredProperties = useMemo(() => {
    if (!properties) return [];

    let result = [...properties];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.address.toLowerCase().includes(query) ||
          p.city.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Amenity filters
    if (selectedAmenities.length > 0) {
      result = result.filter((p) =>
        selectedAmenities.every((amenity) =>
          p.amenities?.some((a) => a.toLowerCase().includes(amenity.toLowerCase()))
        )
      );
    }

    // Bedroom filter
    if (bedroomFilter !== null) {
      result = result.filter((p) => p.bedrooms >= bedroomFilter);
    }

    // Price range filter
    if (priceRange) {
      result = result.filter(
        (p) => p.nightlyRate >= priceRange.min && p.nightlyRate <= priceRange.max
      );
    }

    // Sorting
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price_asc':
        result.sort((a, b) => a.nightlyRate - b.nightlyRate);
        break;
      case 'price_desc':
        result.sort((a, b) => b.nightlyRate - a.nightlyRate);
        break;
      case 'beds':
        result.sort((a, b) => b.bedrooms - a.bedrooms);
        break;
      case 'rating':
        result.sort((a, b) => {
          const ratingA = (a as PropertyWithPhotos).rating || 0;
          const ratingB = (b as PropertyWithPhotos).rating || 0;
          return ratingB - ratingA;
        });
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return result as PropertyWithPhotos[];
  }, [properties, searchQuery, statusFilter, selectedAmenities, bedroomFilter, priceRange, sortBy]);

  // Stats
  const stats = useMemo(() => {
    if (!properties) return { total: 0, active: 0, avgRate: 0, totalBeds: 0 };

    return {
      total: properties.length,
      active: properties.filter((p) => p.status === 'ACTIVE').length,
      avgRate: properties.length > 0
        ? Math.round(properties.reduce((acc, p) => acc + p.nightlyRate, 0) / properties.length)
        : 0,
      totalBeds: properties.reduce((acc, p) => acc + p.bedrooms, 0),
    };
  }, [properties]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-['Playfair_Display'] text-[#2D2D2D]">
            Failed to load properties
          </h2>
          <p className="text-[#2D2D2D]/60 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
                Properties
              </h1>
              <p className="text-[#2D2D2D]/60 mt-1">
                Managing {stats.total} properties in Midland, TX
              </p>
            </div>

            <Link href="/properties/new">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/20 hover:shadow-xl transition-shadow"
              >
                <Plus className="w-5 h-5" />
                Add Property
              </motion.button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Total Properties', value: stats.total, icon: Home, color: 'text-[#500000]' },
            { label: 'Active Listings', value: stats.active, icon: CheckCircle, color: 'text-emerald-600' },
            { label: 'Avg Nightly Rate', value: `$${stats.avgRate}`, icon: DollarSign, color: 'text-[#C4A777]' },
            { label: 'Total Bedrooms', value: stats.totalBeds, icon: Bed, color: 'text-blue-600' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-[#2D2D2D]/5"
            >
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                {stat.value}
              </div>
              <div className="text-sm text-[#2D2D2D]/60">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Search, Sort, and Filters Bar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
            <input
              type="text"
              placeholder="Search properties by name, address, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 focus:border-[#500000] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-[#2D2D2D]/40 hover:text-[#500000]" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none px-4 py-3 pr-10 bg-white border border-[#2D2D2D]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#500000]/30 cursor-pointer"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40 pointer-events-none" />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
              showFilters || hasActiveFilters
                ? 'bg-[#500000] text-white border-[#500000]'
                : 'bg-white border-[#2D2D2D]/10 text-[#2D2D2D]/70 hover:border-[#500000]/30'
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {selectedAmenities.length + (statusFilter !== 'all' ? 1 : 0) + (bedroomFilter ? 1 : 0)}
              </span>
            )}
          </button>

          {/* View Toggle */}
          <div className="flex bg-white rounded-xl border border-[#2D2D2D]/10 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-[#500000] text-white' : 'text-[#2D2D2D]/60 hover:text-[#500000]'
              }`}
              title="Grid View"
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-[#500000] text-white' : 'text-[#2D2D2D]/60 hover:text-[#500000]'
              }`}
              title="List View"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('featured')}
              className={`p-2.5 rounded-lg transition-all ${
                viewMode === 'featured' ? 'bg-[#500000] text-white' : 'text-[#2D2D2D]/60 hover:text-[#500000]'
              }`}
              title="Featured View"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Expanded Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-2xl border border-[#2D2D2D]/10 p-6 mb-6 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                  Filter Properties
                </h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-[#500000] hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-4 gap-6">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-3">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          statusFilter === status
                            ? 'bg-[#500000] text-white'
                            : 'bg-[#F5F5F0] text-[#2D2D2D]/70 hover:bg-[#500000]/10'
                        }`}
                      >
                        {status === 'all' ? 'All' : statusConfig[status].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bedroom Filter */}
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-3">
                    Minimum Bedrooms
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[null, 1, 2, 3, 4, 5].map((beds) => (
                      <button
                        key={beds ?? 'any'}
                        onClick={() => setBedroomFilter(beds)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          bedroomFilter === beds
                            ? 'bg-[#500000] text-white'
                            : 'bg-[#F5F5F0] text-[#2D2D2D]/70 hover:bg-[#500000]/10'
                        }`}
                      >
                        {beds === null ? 'Any' : `${beds}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-3">
                    Price Range
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { min: 0, max: 100, label: '$0-$100' },
                      { min: 100, max: 200, label: '$100-$200' },
                      { min: 200, max: 300, label: '$200-$300' },
                      { min: 300, max: 999999, label: '$300+' },
                    ].map((range) => (
                      <button
                        key={range.label}
                        onClick={() =>
                          setPriceRange(
                            priceRange?.min === range.min && priceRange?.max === range.max
                              ? null
                              : range
                          )
                        }
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          priceRange?.min === range.min && priceRange?.max === range.max
                            ? 'bg-[#500000] text-white'
                            : 'bg-[#F5F5F0] text-[#2D2D2D]/70 hover:bg-[#500000]/10'
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amenities Filter */}
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D]/70 mb-3">
                    Amenities
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {amenityFilters.map((amenity) => {
                      const Icon = amenity.icon;
                      const isSelected = selectedAmenities.includes(amenity.key);
                      return (
                        <button
                          key={amenity.key}
                          onClick={() => toggleAmenity(amenity.key)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-[#500000] text-white'
                              : 'bg-[#F5F5F0] text-[#2D2D2D]/70 hover:bg-[#500000]/10'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {amenity.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Count */}
        {!isLoading && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-[#2D2D2D]/60 text-sm">
              Showing {filteredProperties.length} of {properties?.length || 0} properties
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-[#500000] hover:underline flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-48 bg-[#2D2D2D]/10 rounded-xl mb-4" />
                <div className="h-6 bg-[#2D2D2D]/10 rounded w-3/4 mb-2" />
                <div className="h-4 bg-[#2D2D2D]/10 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Property Grid */}
        {!isLoading && viewMode === 'grid' && (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredProperties.map((property, index) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  index={index}
                  variant="default"
                  onQuickView={(p) => setQuickViewProperty(p)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Property List */}
        {!isLoading && viewMode === 'list' && (
          <motion.div layout className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredProperties.map((property, index) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  index={index}
                  variant="compact"
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Featured View */}
        {!isLoading && viewMode === 'featured' && (
          <motion.div layout className="space-y-8">
            <AnimatePresence mode="popLayout">
              {filteredProperties.map((property, index) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  index={index}
                  variant="featured"
                  onQuickView={(p) => setQuickViewProperty(p)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Empty State */}
        {!isLoading && filteredProperties.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Home className="w-16 h-16 text-[#2D2D2D]/20 mx-auto mb-4" />
            <h3 className="text-xl font-['Playfair_Display'] text-[#2D2D2D]">No properties found</h3>
            <p className="text-[#2D2D2D]/60 mt-2">
              {hasActiveFilters
                ? 'Try adjusting your filters or search terms'
                : 'Add your first property to get started'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 px-6 py-2.5 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] transition-colors"
              >
                Clear all filters
              </button>
            )}
          </motion.div>
        )}
      </main>

      {/* Quick View Modal */}
      <AnimatePresence>
        {quickViewProperty && (
          <QuickViewModal
            property={quickViewProperty}
            onClose={() => setQuickViewProperty(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Quick View Modal Component
function QuickViewModal({
  property,
  onClose,
}: {
  property: PropertyWithPhotos;
  onClose: () => void;
}) {
  // Generate mock photos if none exist
  const photos: PropertyPhoto[] = property.photos?.length
    ? property.photos
    : [
        {
          id: '1',
          url: '/images/property-placeholder.jpg',
          alt: `${property.name} - Main`,
          isPrimary: true,
          category: 'exterior',
        },
      ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gallery */}
        <div className="relative h-80">
          <PropertyGallery
            photos={photos}
            propertyName={property.name}
            maxHeight="320px"
          />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/90 rounded-full hover:bg-white transition-colors z-10"
          >
            <X className="w-5 h-5 text-[#2D2D2D]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                {property.name}
              </h2>
              <div className="flex items-center gap-1.5 text-[#2D2D2D]/60 mt-1">
                <MapPin className="w-4 h-4" />
                <span>{property.address}, {property.city}, {property.state}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-['Playfair_Display'] font-bold text-[#500000]">
                ${property.nightlyRate}
              </div>
              <div className="text-sm text-[#2D2D2D]/60">per night</div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mb-6 text-[#2D2D2D]">
            <div className="flex items-center gap-2">
              <Bed className="w-5 h-5 text-[#500000]" />
              <span>{property.bedrooms} Bedrooms</span>
            </div>
            <div className="flex items-center gap-2">
              <Bath className="w-5 h-5 text-[#500000]" />
              <span>{property.bathrooms} Bathrooms</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#500000]" />
              <span>{property.maxGuests} Guests</span>
            </div>
            {property.rating && (
              <div className="flex items-center gap-1.5">
                <Star className="w-5 h-5 text-[#C4A777] fill-current" />
                <span className="font-semibold">{property.rating.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Amenities */}
          {property.amenities && property.amenities.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-[#2D2D2D]/70 mb-3">Amenities</h4>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="px-3 py-1.5 bg-[#500000]/10 text-[#500000] rounded-full text-sm capitalize"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Link href={`/properties/${property.id}`} className="flex-1">
              <button className="w-full py-3 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl hover:from-[#600000] hover:to-[#822F47] transition-all">
                View Full Details
              </button>
            </Link>
            <Link href={`/properties/${property.id}/calendar`}>
              <button className="px-6 py-3 bg-[#F5F5F0] text-[#500000] font-semibold rounded-xl hover:bg-[#500000]/10 transition-colors">
                <Calendar className="w-5 h-5" />
              </button>
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
