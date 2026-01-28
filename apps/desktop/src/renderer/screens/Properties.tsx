/**
 * Right at Home BnB - Properties Screen
 * Property listing with grid/list view
 * ECHO Design Standards: Dark magenta theme, glassmorphism
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  Home,
  MapPin,
  Bed,
  Bath,
  Users,
  DollarSign,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  Wifi,
  Car,
  Droplet,
  Dumbbell,
  Tv,
  Coffee,
  Wind,
  Flame,
  X,
  Camera,
  Star,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { db, PropertyWithPhotos } from '../services/database';
import PropertyDetail from './PropertyDetail';

// ECHO Design Standards Colors
const ECHO_COLORS = {
  echoBlack: '#0A0A0A',
  darkMagenta: '#8B008B',
  echoOrange: '#FF6B35',
  cobaltBlue: '#0047AB',
  matrixMagenta: '#9932CC',
  textPrimary: '#E0E0E0',
  textSecondary: '#A0A0A0',
};

// Amenity icon mapping
const amenityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  WiFi: Wifi,
  Parking: Car,
  Pool: Droplet,
  Gym: Dumbbell,
  TV: Tv,
  Coffee: Coffee,
  'Air Conditioning': Wind,
  Heating: Flame,
};

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// Glassmorphism Card Component
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -4 }}
    className={`relative rounded-2xl cursor-pointer transition-all duration-300 ${className}`}
    style={{
      background: 'rgba(139, 0, 139, 0.08)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(139, 0, 139, 0.2)',
      boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
    }}
    onClick={onClick}
  >
    {children}
  </motion.div>
);

export default function Properties() {
  const { properties: contextProperties } = useApp();
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Load properties
  useEffect(() => {
    async function loadProperties() {
      try {
        const data = await db.getProperties();
        if (data && data.length > 0) {
          setProperties(data);
        } else {
          // Fallback to context data
          setProperties(
            contextProperties.map((p) => ({
              ...p,
              photos: [],
              zipCode: null,
              latitude: null,
              longitude: null,
              squareFeet: null,
              propertyType: 'HOUSE',
              wifiNetwork: null,
              wifiPassword: null,
              parkingInfo: null,
              checkInInstr: null,
              checkOutInstr: null,
              houseRules: null,
              cleaningChecklist: null,
              securityDeposit: null,
              airbnbId: null,
              vrboId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })) as PropertyWithPhotos[]
          );
        }
      } catch (error) {
        console.error('Error loading properties:', error);
        // Use context fallback
        setProperties(
          contextProperties.map((p) => ({
            ...p,
            photos: [],
          })) as PropertyWithPhotos[]
        );
      } finally {
        setLoading(false);
      }
    }
    loadProperties();
  }, [contextProperties]);

  // Filter properties
  const filteredProperties = properties.filter((property) => {
    const matchesSearch =
      property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.city.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || property.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Get status styling
  const getStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return {
          background: 'rgba(34, 197, 94, 0.2)',
          color: '#22c55e',
          border: '1px solid rgba(34, 197, 94, 0.4)',
        };
      case 'INACTIVE':
        return {
          background: 'rgba(239, 68, 68, 0.2)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.4)',
        };
      case 'MAINTENANCE':
        return {
          background: 'rgba(234, 179, 8, 0.2)',
          color: '#eab308',
          border: '1px solid rgba(234, 179, 8, 0.4)',
        };
      default:
        return {
          background: 'rgba(139, 0, 139, 0.2)',
          color: ECHO_COLORS.matrixMagenta,
          border: '1px solid rgba(139, 0, 139, 0.4)',
        };
    }
  };

  // Parse amenities
  const getAmenities = (property: PropertyWithPhotos): string[] => {
    if (Array.isArray(property.amenities)) return property.amenities as unknown as string[];
    if (typeof property.amenities === 'string') {
      try {
        return JSON.parse(property.amenities);
      } catch {
        return [];
      }
    }
    return [];
  };

  // If viewing a property detail
  if (selectedPropertyId) {
    return (
      <PropertyDetail
        propertyId={selectedPropertyId}
        onBack={() => setSelectedPropertyId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: ECHO_COLORS.echoBlack }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
      >
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Orbitron, sans-serif' }}
          >
            Properties
          </h1>
          <p style={{ color: ECHO_COLORS.textSecondary }}>
            Manage your {properties.length} vacation rental properties
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
          style={{
            background: `linear-gradient(135deg, ${ECHO_COLORS.echoOrange}, ${ECHO_COLORS.darkMagenta})`,
            color: ECHO_COLORS.textPrimary,
          }}
        >
          <Plus className="w-5 h-5" />
          Add Property
        </button>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-2xl mb-6"
        style={{
          background: 'rgba(139, 0, 139, 0.08)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(139, 0, 139, 0.2)',
        }}
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
              style={{ color: ECHO_COLORS.textSecondary }}
            />
            <input
              type="text"
              placeholder="Search properties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl outline-none transition-all"
              style={{
                background: 'rgba(10, 10, 10, 0.6)',
                border: '1px solid rgba(139, 0, 139, 0.3)',
                color: ECHO_COLORS.textPrimary,
              }}
            />
          </div>
          <div className="flex gap-2">
            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl transition-all"
                style={{
                  background: 'rgba(139, 0, 139, 0.2)',
                  border: '1px solid rgba(139, 0, 139, 0.3)',
                  color: ECHO_COLORS.textPrimary,
                }}
              >
                <Filter className="w-5 h-5" />
                Filter
              </button>
              {showFilterMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl p-2 z-20"
                  style={{
                    background: 'rgba(10, 10, 10, 0.95)',
                    border: '1px solid rgba(139, 0, 139, 0.3)',
                  }}
                >
                  {['all', 'ACTIVE', 'INACTIVE', 'MAINTENANCE'].map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);
                        setShowFilterMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left rounded-lg transition-colors"
                      style={{
                        background:
                          statusFilter === status ? 'rgba(139, 0, 139, 0.3)' : 'transparent',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    >
                      {status === 'all' ? 'All Statuses' : status}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            {/* View Mode Toggle */}
            <div
              className="flex rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(139, 0, 139, 0.3)' }}
            >
              <button
                onClick={() => setViewMode('grid')}
                className="px-3 py-2 transition-colors"
                style={{
                  background:
                    viewMode === 'grid' ? ECHO_COLORS.darkMagenta : 'rgba(139, 0, 139, 0.2)',
                  color: ECHO_COLORS.textPrimary,
                }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className="px-3 py-2 transition-colors"
                style={{
                  background:
                    viewMode === 'list' ? ECHO_COLORS.darkMagenta : 'rgba(139, 0, 139, 0.2)',
                  color: ECHO_COLORS.textPrimary,
                }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-4 rounded-full"
            style={{
              borderColor: `${ECHO_COLORS.darkMagenta} transparent transparent transparent`,
            }}
          />
        </div>
      )}

      {/* Properties Grid/List */}
      {!loading && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
              : 'space-y-4'
          }
        >
          {filteredProperties.map((property) => {
            const amenities = getAmenities(property);
            const statusStyle = getStatusStyle(property.status);
            const primaryPhoto = property.photos?.find((p) => p.isPrimary) || property.photos?.[0];

            return (
              <motion.div key={property.id} variants={item}>
                <GlassCard
                  className={`overflow-hidden ${viewMode === 'list' ? 'flex' : ''}`}
                  onClick={() => setSelectedPropertyId(property.id)}
                >
                  {/* Property Image */}
                  <div
                    className={`relative ${viewMode === 'grid' ? 'h-48' : 'w-48 h-32'}`}
                    style={{
                      background: `linear-gradient(135deg, ${ECHO_COLORS.darkMagenta}40, ${ECHO_COLORS.matrixMagenta}20)`,
                    }}
                  >
                    {primaryPhoto?.url ? (
                      <img
                        src={primaryPhoto.url}
                        alt={property.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="w-16 h-16" style={{ color: ECHO_COLORS.darkMagenta }} />
                      </div>
                    )}
                    {/* Status Badge */}
                    <span
                      className="absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium"
                      style={statusStyle}
                    >
                      {property.status}
                    </span>
                    {/* Photo Count */}
                    {property.photos && property.photos.length > 0 && (
                      <div
                        className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                        style={{ background: 'rgba(10, 10, 10, 0.8)', color: ECHO_COLORS.textPrimary }}
                      >
                        <Camera className="w-3 h-3" />
                        {property.photos.length}
                      </div>
                    )}
                  </div>

                  {/* Property Info */}
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3
                          className="font-semibold text-lg"
                          style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
                        >
                          {property.name}
                        </h3>
                        <p
                          className="text-sm flex items-center gap-1 mt-1"
                          style={{ color: ECHO_COLORS.textSecondary }}
                        >
                          <MapPin className="w-4 h-4" />
                          {property.city}, {property.state}
                        </p>
                      </div>
                      <div className="relative group">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: ECHO_COLORS.textSecondary }}
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        <div
                          className="absolute right-0 top-full mt-1 w-40 rounded-xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10"
                          style={{
                            background: 'rgba(10, 10, 10, 0.95)',
                            border: '1px solid rgba(139, 0, 139, 0.3)',
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPropertyId(property.id);
                            }}
                            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2"
                            style={{ color: ECHO_COLORS.textPrimary }}
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </button>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2"
                            style={{ color: ECHO_COLORS.textPrimary }}
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2"
                            style={{ color: ECHO_COLORS.textPrimary }}
                          >
                            <Calendar className="w-4 h-4" />
                            View Calendar
                          </button>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2"
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Property Stats */}
                    <div
                      className="flex items-center gap-4 text-sm mb-4"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      <span className="flex items-center gap-1">
                        <Bed className="w-4 h-4" style={{ color: ECHO_COLORS.echoOrange }} />
                        {property.bedrooms}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath className="w-4 h-4" style={{ color: ECHO_COLORS.echoOrange }} />
                        {property.bathrooms}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" style={{ color: ECHO_COLORS.echoOrange }} />
                        {property.maxGuests}
                      </span>
                    </div>

                    {/* Amenities */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {amenities.slice(0, 4).map((amenity) => {
                        const Icon = amenityIcons[amenity] || Wifi;
                        return (
                          <span
                            key={amenity}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                            style={{
                              background: 'rgba(139, 0, 139, 0.15)',
                              color: ECHO_COLORS.textSecondary,
                            }}
                          >
                            <Icon className="w-3 h-3" />
                            {amenity}
                          </span>
                        );
                      })}
                      {amenities.length > 4 && (
                        <span
                          className="text-xs px-2 py-1 rounded-full"
                          style={{
                            background: 'rgba(139, 0, 139, 0.15)',
                            color: ECHO_COLORS.textSecondary,
                          }}
                        >
                          +{amenities.length - 4} more
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    <div
                      className="flex items-center justify-between pt-3"
                      style={{ borderTop: '1px solid rgba(139, 0, 139, 0.2)' }}
                    >
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                        <span
                          className="text-2xl font-bold"
                          style={{ color: ECHO_COLORS.textPrimary }}
                        >
                          {property.nightlyRate}
                        </span>
                        <span style={{ color: ECHO_COLORS.textSecondary }} className="text-sm">
                          /night
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPropertyId(property.id);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{
                          background: 'rgba(139, 0, 139, 0.3)',
                          color: ECHO_COLORS.textPrimary,
                          border: '1px solid rgba(139, 0, 139, 0.4)',
                        }}
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Empty State */}
      {!loading && filteredProperties.length === 0 && (
        <div className="text-center py-12">
          <Home className="w-16 h-16 mx-auto mb-4" style={{ color: ECHO_COLORS.darkMagenta }} />
          <h3 className="text-lg font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
            No properties found
          </h3>
          <p style={{ color: ECHO_COLORS.textSecondary }} className="mt-1">
            Try adjusting your search or add a new property
          </p>
        </div>
      )}

      {/* Add Property Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ background: 'rgba(10, 10, 10, 0.9)' }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-2xl p-6"
              style={{
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(139, 0, 139, 0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2
                  className="text-xl font-semibold"
                  style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Orbitron, sans-serif' }}
                >
                  Add New Property
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: ECHO_COLORS.textSecondary }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: ECHO_COLORS.textSecondary }}
                  >
                    Property Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Aggie Getaway"
                    className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                    style={{
                      background: 'rgba(139, 0, 139, 0.1)',
                      border: '1px solid rgba(139, 0, 139, 0.3)',
                      color: ECHO_COLORS.textPrimary,
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: ECHO_COLORS.textSecondary }}
                  >
                    Address
                  </label>
                  <input
                    type="text"
                    placeholder="Street address"
                    className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                    style={{
                      background: 'rgba(139, 0, 139, 0.1)',
                      border: '1px solid rgba(139, 0, 139, 0.3)',
                      color: ECHO_COLORS.textPrimary,
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="Midland"
                      defaultValue="Midland"
                      className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      State
                    </label>
                    <input
                      type="text"
                      placeholder="TX"
                      defaultValue="TX"
                      className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      ZIP
                    </label>
                    <input
                      type="text"
                      placeholder="79701"
                      className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      Bedrooms
                    </label>
                    <input
                      type="number"
                      min="1"
                      defaultValue={2}
                      className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      Bathrooms
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      defaultValue={1}
                      className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      Max Guests
                    </label>
                    <input
                      type="number"
                      min="1"
                      defaultValue={4}
                      className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      Nightly Rate ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      defaultValue={150}
                      className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      Cleaning Fee ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      defaultValue={75}
                      className="w-full px-4 py-3 rounded-xl outline-none transition-all"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl font-medium transition-colors"
                    style={{
                      background: 'rgba(139, 0, 139, 0.2)',
                      color: ECHO_COLORS.textPrimary,
                      border: '1px solid rgba(139, 0, 139, 0.3)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl font-medium transition-colors"
                    style={{
                      background: `linear-gradient(135deg, ${ECHO_COLORS.echoOrange}, ${ECHO_COLORS.darkMagenta})`,
                      color: ECHO_COLORS.textPrimary,
                    }}
                  >
                    Add Property
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
