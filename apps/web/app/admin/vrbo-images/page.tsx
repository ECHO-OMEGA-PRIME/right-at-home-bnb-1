'use client';

/**
 * VRBO Image Scraper Admin Page
 * Browse VRBO listings and save individual images to properties
 *
 * @author ECHO OMEGA PRIME
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  Home, Download, Check, X, ExternalLink, RefreshCw,
  Image as ImageIcon, ChevronLeft, ChevronRight, Save,
  Loader2, AlertCircle, CheckCircle, Grid, List,
  ArrowUpRight, Upload, Trash2, Star
} from 'lucide-react';

// Property configuration with VRBO mappings
interface PropertyConfig {
  propertyId: string;
  propertyName: string;
  vrboId: string;
  vrboUrl: string;
}

interface ScrapedImage {
  url: string;
  thumbnailUrl: string;
  alt: string;
  index: number;
  selected: boolean;
  saved: boolean;
  isPrimary: boolean;
}

interface ScrapeResponse {
  vrboId: string;
  images: string[];
  count: number;
  galleryUrl?: string;
  warning?: string;
  errors?: string[];
}

// All Right at Home properties with VRBO IDs
const PROPERTIES: PropertyConfig[] = [
  { propertyId: "castleford-5001", propertyName: "Oasis with Pool-Billiards @ Castleford", vrboId: "2636389", vrboUrl: "https://www.vrbo.com/2636389" },
  { propertyId: "adobe-compound-gc", propertyName: "Adobe Compound @ Golf Course", vrboId: "3005111", vrboUrl: "https://www.vrbo.com/3005111" },
  { propertyId: "garfield-2702", propertyName: "Patio Home with Hot Tub @ Garfield", vrboId: "2634718", vrboUrl: "https://www.vrbo.com/2634718" },
  { propertyId: "douglas-4501", propertyName: "Old Midland Living @ Douglas", vrboId: "3355618", vrboUrl: "https://www.vrbo.com/3355618" },
  { propertyId: "dentcrest-4707", propertyName: "Hot Tub Delight @ Dentcrest", vrboId: "2638481", vrboUrl: "https://www.vrbo.com/2638481" },
  { propertyId: "safari-gameroom", propertyName: "Safari Gameroom", vrboId: "2638524", vrboUrl: "https://www.vrbo.com/2638524" },
  { propertyId: "storey-2103", propertyName: "Destination Getaway @ Storey", vrboId: "2643822", vrboUrl: "https://www.vrbo.com/2643822" },
  { propertyId: "chelsea-3210", propertyName: "Retreat with Covered Patio @ Chelsea", vrboId: "2643784", vrboUrl: "https://www.vrbo.com/2643784" },
  { propertyId: "oriole-6100", propertyName: "Most Marvelous with Pool @ Oriole", vrboId: "4471713", vrboUrl: "https://www.vrbo.com/4471713" },
  { propertyId: "lanham-1426", propertyName: "Posh & Private with Billiards @ Lanham", vrboId: "4437486", vrboUrl: "https://www.vrbo.com/4437486" },
  { propertyId: "humble-3106", propertyName: "Outdoor Dream @ Humble", vrboId: "4700881", vrboUrl: "https://www.vrbo.com/4700881" },
  { propertyId: "daventry-1311", propertyName: "Santiago Dreams @ 1311 Daventry", vrboId: "4179271", vrboUrl: "https://www.vrbo.com/4179271" },
  { propertyId: "lincoln-green-5055", propertyName: "Sprawling Ranch House @ Lincoln Green (FLAGSHIP)", vrboId: "4581977", vrboUrl: "https://www.vrbo.com/4581977" },
  { propertyId: "daventry-1309", propertyName: "Saddle Club @ 1309 Daventry", vrboId: "4750070", vrboUrl: "https://www.vrbo.com/4750070" },
  { propertyId: "monterrey-house", propertyName: "Monterrey House", vrboId: "3477668", vrboUrl: "https://www.vrbo.com/3477668" },
];

export default function VRBOImagesPage() {
  const [selectedProperty, setSelectedProperty] = useState<PropertyConfig | null>(null);
  const [images, setImages] = useState<ScrapedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [galleryUrl, setGalleryUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'carousel'>('grid');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [savedImages, setSavedImages] = useState<Record<string, string[]>>({});

  // Load saved images from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('rah-saved-images');
    if (saved) {
      setSavedImages(JSON.parse(saved));
    }
  }, []);

  // Scrape images from VRBO
  const scrapeImages = useCallback(async (property: PropertyConfig) => {
    setLoading(true);
    setError(null);
    setWarning(null);
    setGalleryUrl(null);
    setImages([]);

    try {
      // Call our API endpoint to scrape images
      const response = await fetch('/api/admin/vrbo-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vrboId: property.vrboId, vrboUrl: property.vrboUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to scrape images');
      }

      const data: ScrapeResponse = await response.json();

      // Store gallery URL for manual access
      if (data.galleryUrl) {
        setGalleryUrl(data.galleryUrl);
      }

      // Show warning if present
      if (data.warning) {
        setWarning(data.warning);
      }

      // Mark previously saved images
      const savedForProperty = savedImages[property.propertyId] || [];
      const scrapedImages: ScrapedImage[] = data.images.map((url: string, index: number) => ({
        url,
        thumbnailUrl: url.replace(/_[a-z]\./, '_t.'), // Get thumbnail version
        alt: `${property.propertyName} - Image ${index + 1}`,
        index,
        selected: false,
        saved: savedForProperty.includes(url),
        isPrimary: index === 0,
      }));

      setImages(scrapedImages);
    } catch (err: any) {
      setError(err.message || 'Failed to load images');
      // Still set gallery URL so user can try manually
      setGalleryUrl(`${property.vrboUrl}?pwaThumbnailDialog=thumbnail-gallery`);
    } finally {
      setLoading(false);
    }
  }, [savedImages]);

  // Select/deselect image
  const toggleImage = (index: number) => {
    setImages(prev => prev.map((img, i) =>
      i === index ? { ...img, selected: !img.selected } : img
    ));
  };

  // Set image as primary
  const setPrimary = (index: number) => {
    setImages(prev => prev.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    })));
  };

  // Select all images
  const selectAll = () => {
    setImages(prev => prev.map(img => ({ ...img, selected: true })));
  };

  // Deselect all
  const deselectAll = () => {
    setImages(prev => prev.map(img => ({ ...img, selected: false })));
  };

  // Save selected images to property
  const saveSelectedImages = async () => {
    if (!selectedProperty) return;

    const selectedImages = images.filter(img => img.selected);
    if (selectedImages.length === 0) {
      setError('Please select at least one image');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/save-property-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedProperty.propertyId,
          images: selectedImages.map(img => ({
            url: img.url,
            alt: img.alt,
            isPrimary: img.isPrimary,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save images');
      }

      // Update local saved state
      const savedUrls = selectedImages.map(img => img.url);
      const newSaved = {
        ...savedImages,
        [selectedProperty.propertyId]: [
          ...(savedImages[selectedProperty.propertyId] || []),
          ...savedUrls,
        ],
      };
      setSavedImages(newSaved);
      localStorage.setItem('rah-saved-images', JSON.stringify(newSaved));

      // Mark images as saved
      setImages(prev => prev.map(img => ({
        ...img,
        saved: img.selected ? true : img.saved,
        selected: false,
      })));

      setSuccess(`Saved ${selectedImages.length} images to ${selectedProperty.propertyName}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save images');
    } finally {
      setSaving(false);
    }
  };

  // Download single image
  const downloadImage = async (image: ScrapedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedProperty?.propertyId || 'property'}_${image.index + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download image');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#500000]/10 rounded-xl">
                <ImageIcon className="w-6 h-6 text-[#500000]" />
              </div>
              <div>
                <h1 className="text-2xl font-['Playfair_Display'] font-bold text-[#500000]">
                  VRBO Image Scraper
                </h1>
                <p className="text-sm text-[#2D2D2D]/60">
                  Import photos from VRBO to your properties
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Property Selector */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 overflow-hidden">
              <div className="p-4 border-b border-[#2D2D2D]/10">
                <h2 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                  Select Property
                </h2>
                <p className="text-sm text-[#2D2D2D]/60 mt-1">
                  Choose a property to import images
                </p>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {PROPERTIES.map((property) => {
                  const savedCount = savedImages[property.propertyId]?.length || 0;
                  return (
                    <motion.button
                      key={property.propertyId}
                      onClick={() => {
                        setSelectedProperty(property);
                        scrapeImages(property);
                      }}
                      whileHover={{ backgroundColor: 'rgba(80, 0, 0, 0.05)' }}
                      className={`w-full p-4 text-left border-b border-[#2D2D2D]/5 transition-all ${
                        selectedProperty?.propertyId === property.propertyId
                          ? 'bg-[#500000]/10 border-l-4 border-l-[#500000]'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-[#2D2D2D] truncate">
                            {property.propertyName}
                          </h3>
                          <p className="text-sm text-[#2D2D2D]/60 mt-0.5">
                            VRBO #{property.vrboId}
                          </p>
                          {savedCount > 0 && (
                            <span className="inline-flex items-center gap-1 mt-1 text-xs text-emerald-600">
                              <CheckCircle className="w-3 h-3" />
                              {savedCount} images saved
                            </span>
                          )}
                        </div>
                        <a
                          href={property.vrboUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 hover:bg-[#500000]/10 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-[#500000]" />
                        </a>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Image Gallery */}
          <div className="lg:col-span-2">
            {!selectedProperty ? (
              <div className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-12 text-center">
                <Home className="w-16 h-16 text-[#2D2D2D]/20 mx-auto mb-4" />
                <h3 className="text-xl font-['Playfair_Display'] text-[#2D2D2D]">
                  Select a Property
                </h3>
                <p className="text-[#2D2D2D]/60 mt-2">
                  Choose a property from the list to view and import its VRBO images
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-[#2D2D2D]/10 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                      {selectedProperty.propertyName}
                    </h2>
                    <p className="text-sm text-[#2D2D2D]/60">
                      {images.length} images found • {images.filter(i => i.selected).length} selected
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => scrapeImages(selectedProperty)}
                      disabled={loading}
                      className="p-2 hover:bg-[#500000]/10 rounded-lg transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-5 h-5 text-[#500000] ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="flex bg-[#F5F5F0] rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition-colors ${
                          viewMode === 'grid' ? 'bg-white shadow-sm' : ''
                        }`}
                      >
                        <Grid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('carousel')}
                        className={`p-2 rounded-md transition-colors ${
                          viewMode === 'carousel' ? 'bg-white shadow-sm' : ''
                        }`}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Selection Toolbar */}
                {images.length > 0 && (
                  <div className="px-4 py-2 bg-[#F5F5F0] flex items-center gap-4 text-sm">
                    <button
                      onClick={selectAll}
                      className="text-[#500000] hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAll}
                      className="text-[#500000] hover:underline"
                    >
                      Deselect All
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={saveSelectedImages}
                      disabled={saving || images.filter(i => i.selected).length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-[#500000] text-white rounded-lg hover:bg-[#722F37] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Selected to Property
                    </button>
                  </div>
                )}

                {/* Gallery URL Link */}
                {galleryUrl && (
                  <div className="mx-4 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-700">
                    <ImageIcon className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1">
                      <strong>Gallery URL:</strong>{' '}
                      <a
                        href={galleryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-900"
                      >
                        Open VRBO Gallery with all photos
                      </a>
                    </span>
                    <a
                      href={galleryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}

                {/* Alerts */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700"
                    >
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <div className="flex-1">
                        <span>{error}</span>
                        {galleryUrl && (
                          <p className="text-sm mt-1">
                            Try opening the <a href={galleryUrl} target="_blank" rel="noopener noreferrer" className="underline">VRBO Gallery</a> directly and copy image URLs manually.
                          </p>
                        )}
                      </div>
                      <button onClick={() => setError(null)} className="ml-auto">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                  {warning && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700"
                    >
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span>{warning}</span>
                      <button onClick={() => setWarning(null)} className="ml-auto">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mx-4 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700"
                    >
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                      <span>{success}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Loading State */}
                {loading && (
                  <div className="p-12 text-center">
                    <Loader2 className="w-12 h-12 text-[#500000] animate-spin mx-auto mb-4" />
                    <p className="text-[#2D2D2D]/60">Loading images from VRBO...</p>
                  </div>
                )}

                {/* Grid View */}
                {!loading && viewMode === 'grid' && images.length > 0 && (
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {images.map((image, index) => (
                      <motion.div
                        key={index}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          image.selected
                            ? 'border-[#500000] ring-2 ring-[#500000]/20'
                            : 'border-transparent hover:border-[#500000]/30'
                        }`}
                        onClick={() => toggleImage(index)}
                      >
                        <div className="aspect-square bg-[#F5F5F0]">
                          <img
                            src={image.thumbnailUrl || image.url}
                            alt={image.alt}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>

                        {/* Selection checkbox */}
                        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          image.selected
                            ? 'bg-[#500000] text-white'
                            : 'bg-white/80 text-transparent group-hover:text-[#500000]'
                        }`}>
                          <Check className="w-4 h-4" />
                        </div>

                        {/* Saved indicator */}
                        {image.saved && (
                          <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">
                            Saved
                          </div>
                        )}

                        {/* Primary indicator */}
                        {image.isPrimary && image.selected && (
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-[#C4A777] text-white text-xs rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Cover
                          </div>
                        )}

                        {/* Action buttons on hover */}
                        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrimary(index);
                            }}
                            className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"
                            title="Set as cover image"
                          >
                            <Star className={`w-4 h-4 ${image.isPrimary ? 'text-[#C4A777] fill-current' : 'text-[#2D2D2D]'}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadImage(image);
                            }}
                            className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"
                            title="Download image"
                          >
                            <Download className="w-4 h-4 text-[#2D2D2D]" />
                          </button>
                          <a
                            href={image.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"
                            title="Open full size"
                          >
                            <ArrowUpRight className="w-4 h-4 text-[#2D2D2D]" />
                          </a>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Carousel View */}
                {!loading && viewMode === 'carousel' && images.length > 0 && (
                  <div className="p-4">
                    <div className="relative">
                      {/* Main Image */}
                      <div className="aspect-video bg-[#F5F5F0] rounded-xl overflow-hidden relative">
                        <img
                          src={images[carouselIndex].url}
                          alt={images[carouselIndex].alt}
                          className="w-full h-full object-contain"
                        />

                        {/* Navigation */}
                        <button
                          onClick={() => setCarouselIndex(i => Math.max(0, i - 1))}
                          disabled={carouselIndex === 0}
                          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full disabled:opacity-50"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                          onClick={() => setCarouselIndex(i => Math.min(images.length - 1, i + 1))}
                          disabled={carouselIndex === images.length - 1}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full disabled:opacity-50"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>

                        {/* Selection toggle */}
                        <button
                          onClick={() => toggleImage(carouselIndex)}
                          className={`absolute top-4 left-4 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                            images[carouselIndex].selected
                              ? 'bg-[#500000] text-white'
                              : 'bg-white/90 text-[#2D2D2D]'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          {images[carouselIndex].selected ? 'Selected' : 'Select'}
                        </button>

                        {/* Actions */}
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button
                            onClick={() => setPrimary(carouselIndex)}
                            className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors ${
                              images[carouselIndex].isPrimary
                                ? 'bg-[#C4A777] text-white'
                                : 'bg-white/90 text-[#2D2D2D]'
                            }`}
                          >
                            <Star className={`w-4 h-4 ${images[carouselIndex].isPrimary ? 'fill-current' : ''}`} />
                            Cover
                          </button>
                          <button
                            onClick={() => downloadImage(images[carouselIndex])}
                            className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                          >
                            <Download className="w-5 h-5 text-[#2D2D2D]" />
                          </button>
                        </div>

                        {/* Image counter */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/50 text-white rounded-full text-sm">
                          {carouselIndex + 1} / {images.length}
                        </div>
                      </div>

                      {/* Thumbnail strip */}
                      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                        {images.map((image, index) => (
                          <button
                            key={index}
                            onClick={() => setCarouselIndex(index)}
                            className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                              carouselIndex === index
                                ? 'border-[#500000]'
                                : image.selected
                                ? 'border-[#500000]/50'
                                : 'border-transparent'
                            }`}
                          >
                            <img
                              src={image.thumbnailUrl || image.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                            {image.selected && (
                              <div className="absolute inset-0 bg-[#500000]/20 flex items-center justify-center">
                                <Check className="w-6 h-6 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!loading && images.length === 0 && (
                  <div className="p-12 text-center">
                    <ImageIcon className="w-16 h-16 text-[#2D2D2D]/20 mx-auto mb-4" />
                    <h3 className="text-xl font-['Playfair_Display'] text-[#2D2D2D]">
                      No Images Found
                    </h3>
                    <p className="text-[#2D2D2D]/60 mt-2 max-w-md mx-auto">
                      VRBO may be blocking automated requests. Try opening the gallery directly to view all photos.
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-6">
                      <a
                        href={galleryUrl || `${selectedProperty.vrboUrl}?pwaThumbnailDialog=thumbnail-gallery`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#500000] text-white rounded-lg hover:bg-[#722F37] transition-colors"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Open Photo Gallery
                      </a>
                      <a
                        href={selectedProperty.vrboUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#500000] text-[#500000] rounded-lg hover:bg-[#500000]/5 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Listing
                      </a>
                    </div>
                    <p className="text-sm text-[#2D2D2D]/40 mt-4">
                      Tip: Right-click images in the gallery and select &quot;Copy image address&quot; to get URLs
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
