/**
 * Right at Home BnB - Property Detail Screen
 * Full property view with photo gallery
 * ECHO Design Standards: Dark magenta theme, glassmorphism
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Home,
  MapPin,
  Bed,
  Bath,
  Users,
  DollarSign,
  Edit2,
  Trash2,
  Calendar,
  Wifi,
  Car,
  Droplet,
  Dumbbell,
  Tv,
  Coffee,
  Wind,
  Flame,
  Dog,
  Mountain,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  Share2,
  Star,
  Clock,
  Key,
  FileText,
  Camera,
  Plus,
  Grid,
  List,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { db, PropertyWithPhotos } from '../services/database';

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
  'Pet Friendly': Dog,
  'Mountain View': Mountain,
  Washer: Droplet,
  Dryer: Wind,
  Kitchen: Coffee,
  Fireplace: Flame,
};

interface PropertyDetailProps {
  propertyId: string;
  onBack: () => void;
}

// Glassmorphism Card Component
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}> = ({ children, className = '', glow = false }) => (
  <div
    className={`relative rounded-2xl ${className}`}
    style={{
      background: 'rgba(139, 0, 139, 0.08)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(139, 0, 139, 0.2)',
      boxShadow: glow
        ? `0 0 30px rgba(139, 0, 139, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)`
        : `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
    }}
  >
    {children}
  </div>
);

// Photo Gallery Modal
const PhotoGalleryModal: React.FC<{
  photos: Array<{ id: string; url: string; caption?: string | null }>;
  initialIndex: number;
  onClose: () => void;
}> = ({ photos, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, onClose]);

  const currentPhoto = photos[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(10, 10, 10, 0.95)' }}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full transition-colors z-10"
        style={{
          background: 'rgba(139, 0, 139, 0.3)',
          color: ECHO_COLORS.textPrimary,
        }}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation arrows */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          goPrev();
        }}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-colors"
        style={{
          background: 'rgba(139, 0, 139, 0.3)',
          color: ECHO_COLORS.textPrimary,
        }}
      >
        <ChevronLeft className="w-8 h-8" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          goNext();
        }}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-colors"
        style={{
          background: 'rgba(139, 0, 139, 0.3)',
          color: ECHO_COLORS.textPrimary,
        }}
      >
        <ChevronRight className="w-8 h-8" />
      </button>

      {/* Main image */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="max-w-5xl max-h-[80vh] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {currentPhoto?.url ? (
          <img
            src={currentPhoto.url}
            alt={currentPhoto.caption || `Photo ${currentIndex + 1}`}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        ) : (
          <div
            className="w-[800px] h-[600px] flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(139, 0, 139, 0.2)' }}
          >
            <Camera className="w-24 h-24" style={{ color: ECHO_COLORS.darkMagenta }} />
          </div>
        )}
      </motion.div>

      {/* Photo counter and caption */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        <p style={{ color: ECHO_COLORS.textPrimary }} className="text-lg font-medium">
          {currentIndex + 1} / {photos.length}
        </p>
        {currentPhoto?.caption && (
          <p style={{ color: ECHO_COLORS.textSecondary }} className="mt-1">
            {currentPhoto.caption}
          </p>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 max-w-full overflow-x-auto px-4">
        {photos.slice(0, 10).map((photo, idx) => (
          <button
            key={photo.id}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(idx);
            }}
            className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 transition-all ${
              idx === currentIndex ? 'ring-2 ring-offset-2' : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              ringColor: ECHO_COLORS.echoOrange,
              ringOffsetColor: ECHO_COLORS.echoBlack,
            }}
          >
            {photo.url ? (
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: 'rgba(139, 0, 139, 0.3)' }}
              >
                <Camera className="w-6 h-6" style={{ color: ECHO_COLORS.darkMagenta }} />
              </div>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default function PropertyDetail({ propertyId, onBack }: PropertyDetailProps) {
  const { properties } = useApp();
  const [property, setProperty] = useState<PropertyWithPhotos | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [photoView, setPhotoView] = useState<'grid' | 'list'>('grid');
  const [copied, setCopied] = useState<string | null>(null);

  // Load property data
  useEffect(() => {
    async function loadProperty() {
      try {
        const data = await db.getPropertyById(propertyId);
        if (data) {
          setProperty(data);
        } else {
          // Fallback to context data
          const contextProperty = properties.find((p) => p.id === propertyId);
          if (contextProperty) {
            setProperty({
              ...contextProperty,
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
            } as PropertyWithPhotos);
          }
        }
      } catch (error) {
        console.error('Error loading property:', error);
        // Fallback to context
        const contextProperty = properties.find((p) => p.id === propertyId);
        if (contextProperty) {
          setProperty({
            ...contextProperty,
            photos: [],
          } as PropertyWithPhotos);
        }
      } finally {
        setLoading(false);
      }
    }
    loadProperty();
  }, [propertyId, properties]);

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  // Parse amenities from string or array
  const getAmenities = (): string[] => {
    if (!property) return [];
    if (Array.isArray(property.amenities)) return property.amenities;
    if (typeof property.amenities === 'string') {
      try {
        return JSON.parse(property.amenities);
      } catch {
        return [];
      }
    }
    return [];
  };

  // Mock photos for demo if none exist
  const getPhotos = () => {
    if (property?.photos && property.photos.length > 0) {
      return property.photos;
    }
    // Generate placeholder photos
    return Array.from({ length: 12 }, (_, i) => ({
      id: `placeholder-${i}`,
      url: '',
      caption: `Room ${i + 1}`,
      isPrimary: i === 0,
      sortOrder: i,
    }));
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ background: ECHO_COLORS.echoBlack }}
      >
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 rounded-full mx-auto mb-4"
            style={{
              borderColor: `${ECHO_COLORS.darkMagenta} transparent transparent transparent`,
            }}
          />
          <p style={{ color: ECHO_COLORS.textSecondary }}>Loading property...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ background: ECHO_COLORS.echoBlack }}
      >
        <div className="text-center">
          <Home className="w-16 h-16 mx-auto mb-4" style={{ color: ECHO_COLORS.darkMagenta }} />
          <p style={{ color: ECHO_COLORS.textPrimary }} className="text-lg">
            Property not found
          </p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
            style={{ background: ECHO_COLORS.darkMagenta, color: ECHO_COLORS.textPrimary }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Properties
          </button>
        </div>
      </div>
    );
  }

  const amenities = getAmenities();
  const photos = getPhotos();
  const primaryPhoto = photos.find((p) => p.isPrimary) || photos[0];

  return (
    <div className="min-h-screen p-6" style={{ background: ECHO_COLORS.echoBlack }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-colors"
            style={{
              background: 'rgba(139, 0, 139, 0.2)',
              color: ECHO_COLORS.textPrimary,
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Orbitron, sans-serif' }}
            >
              {property.name}
            </h1>
            <p className="flex items-center gap-1" style={{ color: ECHO_COLORS.textSecondary }}>
              <MapPin className="w-4 h-4" />
              {property.address}, {property.city}, {property.state}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-lg transition-colors"
            style={{
              background: 'rgba(139, 0, 139, 0.2)',
              color: ECHO_COLORS.textPrimary,
            }}
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            className="p-2 rounded-lg transition-colors"
            style={{
              background: 'rgba(139, 0, 139, 0.2)',
              color: ECHO_COLORS.textPrimary,
            }}
          >
            <Edit2 className="w-5 h-5" />
          </button>
          <button
            className="px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
            style={{
              background: `linear-gradient(135deg, ${ECHO_COLORS.echoOrange}, ${ECHO_COLORS.darkMagenta})`,
              color: ECHO_COLORS.textPrimary,
            }}
          >
            <Calendar className="w-4 h-4" />
            View Calendar
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Photos & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Photo */}
          <GlassCard glow className="overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative h-80 cursor-pointer"
              onClick={() => setSelectedPhotoIndex(0)}
            >
              {primaryPhoto?.url ? (
                <img
                  src={primaryPhoto.url}
                  alt={property.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${ECHO_COLORS.darkMagenta}40, ${ECHO_COLORS.matrixMagenta}20)`,
                  }}
                >
                  <Home className="w-24 h-24" style={{ color: ECHO_COLORS.darkMagenta }} />
                </div>
              )}
              {/* Photo count overlay */}
              <div
                className="absolute bottom-4 right-4 px-3 py-1 rounded-lg flex items-center gap-2"
                style={{ background: 'rgba(10, 10, 10, 0.8)' }}
              >
                <Camera className="w-4 h-4" style={{ color: ECHO_COLORS.echoOrange }} />
                <span style={{ color: ECHO_COLORS.textPrimary }}>{photos.length} photos</span>
              </div>
              {/* Status badge */}
              <div
                className="absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  background:
                    property.status === 'ACTIVE'
                      ? 'rgba(34, 197, 94, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                  color: property.status === 'ACTIVE' ? '#22c55e' : '#ef4444',
                  border: `1px solid ${property.status === 'ACTIVE' ? '#22c55e40' : '#ef444440'}`,
                }}
              >
                {property.status}
              </div>
            </motion.div>
          </GlassCard>

          {/* Photo Gallery */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-lg font-semibold"
                style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
              >
                Photo Gallery ({photos.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPhotoView('grid')}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    background:
                      photoView === 'grid' ? ECHO_COLORS.darkMagenta : 'rgba(139, 0, 139, 0.2)',
                    color: ECHO_COLORS.textPrimary,
                  }}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPhotoView('list')}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    background:
                      photoView === 'list' ? ECHO_COLORS.darkMagenta : 'rgba(139, 0, 139, 0.2)',
                    color: ECHO_COLORS.textPrimary,
                  }}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  className="p-2 rounded-lg transition-colors ml-2"
                  style={{
                    background: 'rgba(255, 107, 53, 0.2)',
                    color: ECHO_COLORS.echoOrange,
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <motion.div
              className={
                photoView === 'grid'
                  ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'
                  : 'space-y-3'
              }
            >
              {photos.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative group cursor-pointer rounded-lg overflow-hidden ${
                    photoView === 'list' ? 'flex items-center gap-4 p-2' : 'aspect-square'
                  }`}
                  style={{
                    background: 'rgba(139, 0, 139, 0.1)',
                    border: '1px solid rgba(139, 0, 139, 0.2)',
                  }}
                  onClick={() => setSelectedPhotoIndex(index)}
                >
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.caption || `Photo ${index + 1}`}
                      className={`object-cover ${
                        photoView === 'list' ? 'w-20 h-20 rounded-lg' : 'w-full h-full'
                      }`}
                    />
                  ) : (
                    <div
                      className={`flex items-center justify-center ${
                        photoView === 'list' ? 'w-20 h-20 rounded-lg' : 'w-full h-full'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${ECHO_COLORS.darkMagenta}30, ${ECHO_COLORS.matrixMagenta}20)`,
                      }}
                    >
                      <Camera
                        className={photoView === 'list' ? 'w-6 h-6' : 'w-8 h-8'}
                        style={{ color: ECHO_COLORS.darkMagenta }}
                      />
                    </div>
                  )}

                  {photoView === 'list' && (
                    <div className="flex-1">
                      <p style={{ color: ECHO_COLORS.textPrimary }}>
                        {photo.caption || `Photo ${index + 1}`}
                      </p>
                      {photo.isPrimary && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(255, 107, 53, 0.2)',
                            color: ECHO_COLORS.echoOrange,
                          }}
                        >
                          Primary
                        </span>
                      )}
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    style={{ background: 'rgba(10, 10, 10, 0.5)' }}
                  >
                    <Camera className="w-8 h-8" style={{ color: ECHO_COLORS.textPrimary }} />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </GlassCard>

          {/* Property Description */}
          <GlassCard className="p-6">
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
            >
              About This Property
            </h2>
            <p style={{ color: ECHO_COLORS.textSecondary }} className="leading-relaxed">
              {property.houseRules ||
                `Beautiful ${property.bedrooms} bedroom, ${property.bathrooms} bathroom property in ${property.city}, ${property.state}. Perfect for families or groups up to ${property.maxGuests} guests. Features modern amenities and a comfortable living space.`}
            </p>
          </GlassCard>
        </div>

        {/* Right Column - Info Panels */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <GlassCard className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div
                className="p-4 rounded-xl text-center"
                style={{ background: 'rgba(139, 0, 139, 0.15)' }}
              >
                <Bed className="w-6 h-6 mx-auto mb-2" style={{ color: ECHO_COLORS.echoOrange }} />
                <p className="text-2xl font-bold" style={{ color: ECHO_COLORS.textPrimary }}>
                  {property.bedrooms}
                </p>
                <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                  Bedrooms
                </p>
              </div>
              <div
                className="p-4 rounded-xl text-center"
                style={{ background: 'rgba(139, 0, 139, 0.15)' }}
              >
                <Bath className="w-6 h-6 mx-auto mb-2" style={{ color: ECHO_COLORS.echoOrange }} />
                <p className="text-2xl font-bold" style={{ color: ECHO_COLORS.textPrimary }}>
                  {property.bathrooms}
                </p>
                <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                  Bathrooms
                </p>
              </div>
              <div
                className="p-4 rounded-xl text-center"
                style={{ background: 'rgba(139, 0, 139, 0.15)' }}
              >
                <Users className="w-6 h-6 mx-auto mb-2" style={{ color: ECHO_COLORS.echoOrange }} />
                <p className="text-2xl font-bold" style={{ color: ECHO_COLORS.textPrimary }}>
                  {property.maxGuests}
                </p>
                <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                  Max Guests
                </p>
              </div>
              <div
                className="p-4 rounded-xl text-center"
                style={{ background: 'rgba(139, 0, 139, 0.15)' }}
              >
                <Home className="w-6 h-6 mx-auto mb-2" style={{ color: ECHO_COLORS.echoOrange }} />
                <p className="text-2xl font-bold" style={{ color: ECHO_COLORS.textPrimary }}>
                  {property.squareFeet || '---'}
                </p>
                <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                  Sq Ft
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Pricing */}
          <GlassCard className="p-6">
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
            >
              Pricing
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span style={{ color: ECHO_COLORS.textSecondary }}>Nightly Rate</span>
                <span
                  className="text-xl font-bold"
                  style={{ color: ECHO_COLORS.echoOrange }}
                >
                  ${property.nightlyRate}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: ECHO_COLORS.textSecondary }}>Cleaning Fee</span>
                <span style={{ color: ECHO_COLORS.textPrimary }}>
                  ${property.cleaningFee || 0}
                </span>
              </div>
              {property.securityDeposit && (
                <div className="flex items-center justify-between">
                  <span style={{ color: ECHO_COLORS.textSecondary }}>Security Deposit</span>
                  <span style={{ color: ECHO_COLORS.textPrimary }}>
                    ${property.securityDeposit}
                  </span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Amenities */}
          <GlassCard className="p-6">
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
            >
              Amenities
            </h3>
            <div className="flex flex-wrap gap-2">
              {amenities.length > 0 ? (
                amenities.map((amenity) => {
                  const Icon = amenityIcons[amenity] || Wifi;
                  return (
                    <span
                      key={amenity}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                      style={{
                        background: 'rgba(139, 0, 139, 0.15)',
                        color: ECHO_COLORS.textPrimary,
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                      }}
                    >
                      <Icon className="w-4 h-4" style={{ color: ECHO_COLORS.echoOrange }} />
                      {amenity}
                    </span>
                  );
                })
              ) : (
                <p style={{ color: ECHO_COLORS.textSecondary }}>No amenities listed</p>
              )}
            </div>
          </GlassCard>

          {/* WiFi Info */}
          {(property.wifiNetwork || property.wifiPassword) && (
            <GlassCard className="p-6">
              <h3
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
              >
                <Wifi className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                WiFi Access
              </h3>
              <div className="space-y-3">
                {property.wifiNetwork && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: ECHO_COLORS.textSecondary }}>Network</span>
                    <div className="flex items-center gap-2">
                      <span style={{ color: ECHO_COLORS.textPrimary }}>{property.wifiNetwork}</span>
                      <button
                        onClick={() => copyToClipboard(property.wifiNetwork!, 'network')}
                        className="p-1 rounded"
                        style={{ color: ECHO_COLORS.textSecondary }}
                      >
                        {copied === 'network' ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
                {property.wifiPassword && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: ECHO_COLORS.textSecondary }}>Password</span>
                    <div className="flex items-center gap-2">
                      <span
                        style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'JetBrains Mono' }}
                      >
                        {property.wifiPassword}
                      </span>
                      <button
                        onClick={() => copyToClipboard(property.wifiPassword!, 'password')}
                        className="p-1 rounded"
                        style={{ color: ECHO_COLORS.textSecondary }}
                      >
                        {copied === 'password' ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {/* External Links */}
          <GlassCard className="p-6">
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
            >
              Listings
            </h3>
            <div className="space-y-2">
              {property.airbnbId && (
                <a
                  href={`https://airbnb.com/rooms/${property.airbnbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg transition-colors"
                  style={{
                    background: 'rgba(255, 90, 95, 0.1)',
                    border: '1px solid rgba(255, 90, 95, 0.3)',
                  }}
                >
                  <span style={{ color: '#FF5A5F' }}>Airbnb</span>
                  <ExternalLink className="w-4 h-4" style={{ color: '#FF5A5F' }} />
                </a>
              )}
              {property.vrboId && (
                <a
                  href={`https://vrbo.com/${property.vrboId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg transition-colors"
                  style={{
                    background: 'rgba(0, 117, 190, 0.1)',
                    border: '1px solid rgba(0, 117, 190, 0.3)',
                  }}
                >
                  <span style={{ color: '#0075BE' }}>VRBO</span>
                  <ExternalLink className="w-4 h-4" style={{ color: '#0075BE' }} />
                </a>
              )}
              {!property.airbnbId && !property.vrboId && (
                <p style={{ color: ECHO_COLORS.textSecondary }} className="text-sm">
                  No external listings connected
                </p>
              )}
            </div>
          </GlassCard>

          {/* Quick Actions */}
          <GlassCard className="p-6">
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
            >
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button
                className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left"
                style={{
                  background: 'rgba(139, 0, 139, 0.15)',
                  color: ECHO_COLORS.textPrimary,
                }}
              >
                <Calendar className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                View Bookings
              </button>
              <button
                className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left"
                style={{
                  background: 'rgba(139, 0, 139, 0.15)',
                  color: ECHO_COLORS.textPrimary,
                }}
              >
                <Key className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                Smart Lock Settings
              </button>
              <button
                className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left"
                style={{
                  background: 'rgba(139, 0, 139, 0.15)',
                  color: ECHO_COLORS.textPrimary,
                }}
              >
                <FileText className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                Cleaning Checklist
              </button>
              <button
                className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left"
                style={{
                  background: 'rgba(139, 0, 139, 0.15)',
                  color: ECHO_COLORS.textPrimary,
                }}
              >
                <DollarSign className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                View Expenses
              </button>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Photo Gallery Modal */}
      <AnimatePresence>
        {selectedPhotoIndex !== null && (
          <PhotoGalleryModal
            photos={photos}
            initialIndex={selectedPhotoIndex}
            onClose={() => setSelectedPhotoIndex(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
