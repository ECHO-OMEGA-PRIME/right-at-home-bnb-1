'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { PropertyPhoto } from '@/lib/types';
import { X, ChevronLeft, ChevronRight, Grid, Expand } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PhotoGalleryProps {
  photos: PropertyPhoto[];
  propertyName: string;
  className?: string;
}

export function PhotoGallery({ photos, propertyName, className }: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showGrid, setShowGrid] = useState(false);

  const sortedPhotos = [...photos].sort((a, b) => {
    if (a.isPrimary) return -1;
    if (b.isPrimary) return 1;
    return a.sortOrder - b.sortOrder;
  });

  const openLightbox = useCallback((index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setShowGrid(false);
    document.body.style.overflow = 'unset';
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % sortedPhotos.length);
  }, [sortedPhotos.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + sortedPhotos.length) % sortedPhotos.length);
  }, [sortedPhotos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, closeLightbox, goNext, goPrev]);

  if (sortedPhotos.length === 0) {
    return (
      <div className={cn('aspect-[16/9] bg-[#1a0a0a] rounded-xl flex items-center justify-center', className)}>
        <p className="text-white/30">No photos available</p>
      </div>
    );
  }

  return (
    <>
      {/* Gallery Grid */}
      <div className={cn('relative', className)}>
        {sortedPhotos.length === 1 ? (
          // Single photo layout
          <div
            className="relative aspect-[16/9] rounded-xl overflow-hidden cursor-pointer group"
            onClick={() => openLightbox(0)}
          >
            <Image
              src={sortedPhotos[0].url}
              alt={sortedPhotos[0].caption || propertyName}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              priority
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
              <Expand className="h-4 w-4" />
              View
            </div>
          </div>
        ) : sortedPhotos.length <= 4 ? (
          // 2-4 photos grid
          <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden">
            {sortedPhotos.slice(0, 4).map((photo, idx) => (
              <div
                key={photo.id}
                className={cn(
                  'relative cursor-pointer group',
                  idx === 0 && sortedPhotos.length === 3 && 'row-span-2',
                  idx === 0 ? 'aspect-square' : 'aspect-[4/3]'
                )}
                onClick={() => openLightbox(idx)}
              >
                <Image
                  src={photo.url}
                  alt={photo.caption || `${propertyName} photo ${idx + 1}`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  priority={idx === 0}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
            ))}
          </div>
        ) : (
          // 5+ photos bento grid
          <div className="grid grid-cols-4 grid-rows-2 gap-2 rounded-xl overflow-hidden aspect-[2/1]">
            <div
              className="relative col-span-2 row-span-2 cursor-pointer group"
              onClick={() => openLightbox(0)}
            >
              <Image
                src={sortedPhotos[0].url}
                alt={sortedPhotos[0].caption || propertyName}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                priority
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
            {sortedPhotos.slice(1, 5).map((photo, idx) => (
              <div
                key={photo.id}
                className="relative cursor-pointer group"
                onClick={() => openLightbox(idx + 1)}
              >
                <Image
                  src={photo.url}
                  alt={photo.caption || `${propertyName} photo ${idx + 2}`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                {idx === 3 && sortedPhotos.length > 5 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">+{sortedPhotos.length - 5}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* View all button */}
        {sortedPhotos.length > 1 && (
          <button
            onClick={() => openLightbox(0)}
            className="absolute bottom-4 right-4 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-colors flex items-center gap-2"
          >
            <Grid className="h-4 w-4" />
            View all {sortedPhotos.length} photos
          </button>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {/* Grid toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowGrid(!showGrid);
              }}
              className="absolute top-4 left-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Grid className="h-6 w-6 text-white" />
            </button>

            {showGrid ? (
              // Grid view
              <div
                className="absolute inset-0 overflow-auto p-8 pt-16"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
                  {sortedPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer group"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowGrid(false);
                      }}
                    >
                      <Image
                        src={photo.url}
                        alt={photo.caption || `Photo ${idx + 1}`}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Single image view
              <div
                className="absolute inset-0 flex items-center justify-center p-8"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Navigation arrows */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  className="absolute left-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft className="h-8 w-8 text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  className="absolute right-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <ChevronRight className="h-8 w-8 text-white" />
                </button>

                {/* Main image */}
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="relative max-w-5xl max-h-[80vh] w-full h-full"
                >
                  <Image
                    src={sortedPhotos[currentIndex].url}
                    alt={sortedPhotos[currentIndex].caption || `Photo ${currentIndex + 1}`}
                    fill
                    className="object-contain"
                    priority
                  />
                </motion.div>

                {/* Caption and counter */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
                  <p className="text-white/60 text-sm mb-2">
                    {currentIndex + 1} / {sortedPhotos.length}
                  </p>
                  {sortedPhotos[currentIndex].caption && (
                    <p className="text-white text-lg max-w-xl">
                      {sortedPhotos[currentIndex].caption}
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default PhotoGallery;
