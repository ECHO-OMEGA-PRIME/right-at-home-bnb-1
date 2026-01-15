'use client';

/**
 * Add Calendar Feed Modal
 * Right at Home BnB - Connect Airbnb/VRBO iCal feeds
 *
 * ECHO OMEGA PRIME | Made by Commander Bobby Don McWilliams II
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Link, HelpCircle, Check, AlertCircle } from 'lucide-react';
import {
  BookingPlatform,
  PLATFORM_COLORS,
  PLATFORM_NAMES,
  PLATFORM_ICAL_HELP,
  bookingsApi,
} from '@/lib/api/bookings';

interface AddFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  properties: Array<{ id: string; name: string }>;
}

export default function AddFeedModal({
  isOpen,
  onClose,
  onSuccess,
  properties,
}: AddFeedModalProps) {
  const [step, setStep] = useState<'property' | 'platform' | 'url'>('property');
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<BookingPlatform | ''>('');
  const [feedUrl, setFeedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platforms: BookingPlatform[] = ['airbnb', 'vrbo', 'booking', 'direct', 'other'];

  const handleSubmit = async () => {
    if (!selectedProperty || !selectedPlatform || !feedUrl) {
      setError('Please fill in all fields');
      return;
    }

    // Basic URL validation
    try {
      new URL(feedUrl);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await bookingsApi.addFeed({
        property_id: selectedProperty,
        platform: selectedPlatform,
        url: feedUrl,
      });

      // Trigger initial sync
      await bookingsApi.triggerSync({ property_id: selectedProperty });

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add feed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('property');
    setSelectedProperty('');
    setSelectedPlatform('');
    setFeedUrl('');
    setError(null);
    onClose();
  };

  const goNext = () => {
    if (step === 'property' && selectedProperty) {
      setStep('platform');
    } else if (step === 'platform' && selectedPlatform) {
      setStep('url');
    }
  };

  const goBack = () => {
    if (step === 'url') {
      setStep('platform');
    } else if (step === 'platform') {
      setStep('property');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#2D2D2D]/10">
            <div>
              <h2 className="text-xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                Add Calendar Feed
              </h2>
              <p className="text-sm text-[#2D2D2D]/60">
                Step {step === 'property' ? 1 : step === 'platform' ? 2 : 3} of 3
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#2D2D2D]" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-[#F5F5F0]">
            <div
              className="h-full bg-[#500000] transition-all duration-300"
              style={{
                width:
                  step === 'property' ? '33%' : step === 'platform' ? '66%' : '100%',
              }}
            />
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Step 1: Select Property */}
            {step === 'property' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-[#2D2D2D]">Select Property</h3>
                <p className="text-sm text-[#2D2D2D]/60">
                  Choose which property to sync the calendar for.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {properties.map((property) => (
                    <button
                      key={property.id}
                      onClick={() => setSelectedProperty(property.id)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        selectedProperty === property.id
                          ? 'border-[#500000] bg-[#500000]/5'
                          : 'border-[#2D2D2D]/10 hover:border-[#500000]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[#2D2D2D]">
                          {property.name}
                        </span>
                        {selectedProperty === property.id && (
                          <Check className="w-5 h-5 text-[#500000]" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Select Platform */}
            {step === 'platform' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-[#2D2D2D]">Select Platform</h3>
                <p className="text-sm text-[#2D2D2D]/60">
                  Choose the booking platform to import from.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {platforms.map((platform) => (
                    <button
                      key={platform}
                      onClick={() => setSelectedPlatform(platform)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedPlatform === platform
                          ? 'border-[#500000] bg-[#500000]/5'
                          : 'border-[#2D2D2D]/10 hover:border-[#500000]/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: PLATFORM_COLORS[platform] }}
                        />
                        <span className="font-medium text-[#2D2D2D]">
                          {PLATFORM_NAMES[platform]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Enter URL */}
            {step === 'url' && selectedPlatform && (
              <div className="space-y-4">
                <h3 className="font-semibold text-[#2D2D2D]">
                  Enter iCal Feed URL
                </h3>

                {/* Help text */}
                <div className="flex items-start gap-3 p-4 bg-[#500000]/5 rounded-xl">
                  <HelpCircle className="w-5 h-5 text-[#500000] flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-[#2D2D2D]/80">
                    <strong>How to get the URL:</strong>
                    <br />
                    {PLATFORM_ICAL_HELP[selectedPlatform]}
                  </div>
                </div>

                {/* URL Input */}
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D] mb-2">
                    iCal URL
                  </label>
                  <div className="relative">
                    <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
                    <input
                      type="url"
                      value={feedUrl}
                      onChange={(e) => setFeedUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full pl-12 pr-4 py-3 border border-[#2D2D2D]/20 rounded-xl focus:border-[#500000] focus:ring-1 focus:ring-[#500000] outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[#2D2D2D]/10 flex items-center justify-between">
            {step !== 'property' ? (
              <button
                onClick={goBack}
                className="px-6 py-2 text-[#2D2D2D] hover:bg-[#F5F5F0] rounded-xl transition-colors"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step === 'url' ? (
              <button
                onClick={handleSubmit}
                disabled={loading || !feedUrl}
                className={`px-6 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                  loading || !feedUrl
                    ? 'bg-[#500000]/50 text-white cursor-not-allowed'
                    : 'bg-[#500000] text-white hover:bg-[#500000]/90'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Feed'
                )}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={
                  (step === 'property' && !selectedProperty) ||
                  (step === 'platform' && !selectedPlatform)
                }
                className={`px-6 py-2 rounded-xl font-medium transition-colors ${
                  (step === 'property' && !selectedProperty) ||
                  (step === 'platform' && !selectedPlatform)
                    ? 'bg-[#500000]/50 text-white cursor-not-allowed'
                    : 'bg-[#500000] text-white hover:bg-[#500000]/90'
                }`}
              >
                Continue
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
