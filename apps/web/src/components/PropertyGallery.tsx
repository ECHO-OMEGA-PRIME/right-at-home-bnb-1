'use client';

/**
 * Right at Home BnB - Property Gallery Component
 * Full-screen lightbox with thumbnails, swipe, zoom, keyboard nav
 *
 * Colors: Maroon #500000, Gold #C4A777
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useAnimation, PanInfo } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Grid3X3,
  Maximize2, Download, Share2, Heart
} from 'lucide-react';

export interface PropertyPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  alt: string;
  category?: 'exterior' | 'living' | 'bedroom' | 'bathroom' | 'kitchen' | 'amenity' | 'other';
  isPrimary?: boolean;
}

interface PropertyGalleryProps {
  photos: PropertyPhoto[];
  propertyName: string;
  showThumbnails?: boolean;
  maxHeight?: string;
}

// Main Gallery Component
export function PropertyGallery({
  photos,
  propertyName,
  showThumbnails = true,
  maxHeight = '500px',
}: PropertyGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!photos || photos.length === 0) {
    return (
      <div
        className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#500000]/10 to-[#722F37]/10 flex items-center justify-center"
        style={{ height: maxHeight }}
      >
        <div className="text-center">
          <Grid3X3 className="w-16 h-16 text-[#500000]/30 mx-auto mb-3" />
          <p className="text-[#2D2D2D]/50">No photos available</p>
        </div>
      </div>
    );
  }

  const primaryPhoto = photos.find(p => p.isPrimary) || photos[0];
  const remainingPhotos = photos.filter(p => p.id !== primaryPhoto.id).slice(0, 4);
  const totalPhotos = photos.length;

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      {/* Gallery Grid */}
      <div className="relative rounded-2xl overflow-hidden" style={{ height: maxHeight }}>
        <div className="grid grid-cols-4 grid-rows-2 gap-2 h-full">
          {/* Main Image - Takes 2x2 */}
          <div
            className="col-span-2 row-span-2 relative cursor-pointer group"
            onClick={() => openLightbox(0)}
          >
            <Image
              src={primaryPhoto.url}
              alt={primaryPhoto.alt}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBAUEBAYFBQUGBgYHCQ4JCQgICRINDQoOFRIWFhUSFBQXGiEcFxgfGRQUHScdHyIjJSUlFhwpLCgkKyEkJST/2wBDAQYGBgkICREJCREkGBQYJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCT/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQREiExQQUGE1H/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABkRAAMBAQEAAAAAAAAAAAAAAAABAhESIf/aAAwDAQACEQMRAD8AzeKe4js4YxI4VRheWwO+ttqWp96rSlJ0y8f/2Q=="
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white font-medium flex items-center gap-2">
                <Maximize2 className="w-5 h-5" />
                View Gallery
              </span>
            </div>
          </div>

          {/* Secondary Images */}
          {remainingPhotos.map((photo, idx) => (
            <div
              key={photo.id}
              className="relative cursor-pointer group overflow-hidden"
              onClick={() => openLightbox(photos.findIndex(p => p.id === photo.id))}
            >
              <Image
                src={photo.url}
                alt={photo.alt}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-110"
                sizes="(max-width: 768px) 50vw, 25vw"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBAUEBAYFBQUGBgYHCQ4JCQgICRINDQoOFRIWFhUSFBQXGiEcFxgfGRQUHScdHyIjJSUlFhwpLCgkKyEkJST/2wBDAQYGBgkICREJCREkGBQYJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCT/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQREiExQQUGE1H/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABkRAAMBAQEAAAAAAAAAAAAAAAABAhESIf/aAAwDAQACEQMRAD8AzeKe4js4YxI4VRheWwO+ttqWp96rSlJ0y8f/2Q=="
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

              {/* Show +X more on last image if there are more photos */}
              {idx === 3 && totalPhotos > 5 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-xl font-semibold">
                    +{totalPhotos - 5} more
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Fill empty slots with gradient placeholder */}
          {remainingPhotos.length < 4 &&
            Array(4 - remainingPhotos.length)
              .fill(null)
              .map((_, idx) => (
                <div
                  key={`placeholder-${idx}`}
                  className="bg-gradient-to-br from-[#500000]/10 to-[#722F37]/10"
                />
              ))}
        </div>

        {/* Photo Count Badge */}
        <button
          onClick={() => openLightbox(0)}
          className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl text-[#2D2D2D] font-medium shadow-lg hover:bg-white transition-colors"
        >
          <Grid3X3 className="w-5 h-5" />
          {totalPhotos} photos
        </button>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <Lightbox
            photos={photos}
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
            onClose={() => setLightboxOpen(false)}
            propertyName={propertyName}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Lightbox Component
interface LightboxProps {
  photos: PropertyPhoto[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onClose: () => void;
  propertyName: string;
}

function Lightbox({
  photos,
  currentIndex,
  setCurrentIndex,
  onClose,
  propertyName,
}: LightboxProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageControls = useAnimation();

  const currentPhoto = photos[currentIndex];
  const totalPhotos = photos.length;

  // Navigate photos
  const goToPrevious = useCallback(() => {
    if (isZoomed) return;
    setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : totalPhotos - 1);
  }, [currentIndex, totalPhotos, setCurrentIndex, isZoomed]);

  const goToNext = useCallback(() => {
    if (isZoomed) return;
    setCurrentIndex(currentIndex < totalPhotos - 1 ? currentIndex + 1 : 0);
  }, [currentIndex, totalPhotos, setCurrentIndex, isZoomed]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          if (isZoomed) {
            setIsZoomed(false);
          } else {
            onClose();
          }
          break;
        case ' ':
          e.preventDefault();
          setIsZoomed(!isZoomed);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, onClose, isZoomed]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Handle swipe gestures
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isZoomed) return;

    const swipeThreshold = 50;
    if (info.offset.x > swipeThreshold) {
      goToPrevious();
    } else if (info.offset.x < -swipeThreshold) {
      goToNext();
    }
  };

  // Toggle zoom
  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
    if (!isZoomed) {
      imageControls.start({ scale: 2 });
    } else {
      imageControls.start({ scale: 1 });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black"
      ref={containerRef}
    >
      {/* Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-0 left-0 right-0 z-10 px-6 py-4 bg-gradient-to-b from-black/70 to-transparent"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-lg font-semibold">{propertyName}</h2>
            <p className="text-white/70 text-sm">
              {currentIndex + 1} of {totalPhotos}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className={`p-3 rounded-full transition-colors ${
                isFavorite ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title="Add to favorites"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={() => {}}
              className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
              title="Share"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => {}}
              className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowThumbnails(!showThumbnails)}
              className={`p-3 rounded-full transition-colors ${
                showThumbnails ? 'bg-[#500000] text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title="Toggle thumbnails"
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button
              onClick={toggleZoom}
              className={`p-3 rounded-full transition-colors ${
                isZoomed ? 'bg-[#C4A777] text-black' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={isZoomed ? 'Zoom out' : 'Zoom in'}
            >
              {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-3 bg-white/10 text-white rounded-full hover:bg-red-500 transition-colors ml-2"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Image Container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          drag={!isZoomed ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className={`relative w-full h-full flex items-center justify-center ${
            isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
          }`}
          onClick={toggleZoom}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPhoto.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`relative ${showThumbnails ? 'h-[calc(100vh-200px)]' : 'h-[calc(100vh-100px)]'} w-full max-w-6xl mx-auto`}
            >
              <motion.div
                animate={imageControls}
                className="relative w-full h-full"
              >
                <Image
                  src={currentPhoto.url}
                  alt={currentPhoto.alt}
                  fill
                  className={`object-contain ${isZoomed ? 'object-cover' : 'object-contain'}`}
                  sizes="100vw"
                  priority
                  quality={90}
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Navigation Arrows */}
      {!isZoomed && totalPhotos > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-4 bg-white/10 backdrop-blur-sm text-white rounded-full hover:bg-white/20 transition-all hover:scale-110"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-4 bg-white/10 backdrop-blur-sm text-white rounded-full hover:bg-white/20 transition-all hover:scale-110"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* Thumbnail Strip */}
      <AnimatePresence>
        {showThumbnails && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 z-10 px-6 py-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent"
          >
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(index);
                  }}
                  className={`relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden transition-all ${
                    index === currentIndex
                      ? 'ring-2 ring-[#C4A777] ring-offset-2 ring-offset-black scale-110'
                      : 'opacity-50 hover:opacity-100'
                  }`}
                >
                  <Image
                    src={photo.thumbnailUrl || photo.url}
                    alt={photo.alt}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </button>
              ))}
            </div>

            {/* Photo Category Pills */}
            {currentPhoto.category && (
              <div className="mt-2 flex items-center gap-2">
                <span className="px-3 py-1 bg-[#500000] text-white text-xs rounded-full capitalize">
                  {currentPhoto.category}
                </span>
                <span className="text-white/50 text-sm">{currentPhoto.alt}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo Counter (Mobile) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 md:hidden">
        <div className="flex gap-1.5">
          {photos.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-[#C4A777] w-6' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Compact Gallery for Cards
export function CompactGallery({
  photos,
  maxPhotos = 5,
  onViewAll,
}: {
  photos: PropertyPhoto[];
  maxPhotos?: number;
  onViewAll?: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const displayPhotos = photos.slice(0, maxPhotos);

  if (!photos || photos.length === 0) {
    return (
      <div className="aspect-[4/3] bg-gradient-to-br from-[#500000]/10 to-[#722F37]/10 rounded-xl flex items-center justify-center">
        <Grid3X3 className="w-10 h-10 text-[#500000]/30" />
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] rounded-xl overflow-hidden group">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
        >
          <Image
            src={displayPhotos[currentIndex].url}
            alt={displayPhotos[currentIndex].alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        </motion.div>
      </AnimatePresence>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      {/* Navigation Dots */}
      {displayPhotos.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {displayPhotos.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      )}

      {/* Arrow Navigation */}
      {displayPhotos.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : displayPhotos.length - 1);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronLeft className="w-4 h-4 text-[#2D2D2D]" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCurrentIndex(currentIndex < displayPhotos.length - 1 ? currentIndex + 1 : 0);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronRight className="w-4 h-4 text-[#2D2D2D]" />
          </button>
        </>
      )}

      {/* View All Button */}
      {photos.length > maxPhotos && onViewAll && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onViewAll();
          }}
          className="absolute bottom-3 right-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-medium text-[#2D2D2D] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          +{photos.length - maxPhotos} more
        </button>
      )}
    </div>
  );
}

export default PropertyGallery;
