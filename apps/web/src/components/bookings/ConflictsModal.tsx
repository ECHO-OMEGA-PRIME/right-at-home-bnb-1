'use client';

/**
 * Booking Conflicts Modal
 * Right at Home BnB - Display and manage booking conflicts
 *
 * ECHO OMEGA PRIME | Made by Commander Bobby Don McWilliams II
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Calendar, Home, ExternalLink } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { PLATFORM_COLORS, PLATFORM_NAMES, BookingConflict } from '@/lib/api/bookings';

interface ConflictsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: BookingConflict[];
  propertyNames: Record<string, string>;
}

export default function ConflictsModal({
  isOpen,
  onClose,
  conflicts,
  propertyNames,
}: ConflictsModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#2D2D2D]/10 bg-red-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                  Booking Conflicts
                </h2>
                <p className="text-sm text-red-600">
                  {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#2D2D2D]" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {conflicts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-[#2D2D2D] mb-2">No Conflicts</h3>
                <p className="text-[#2D2D2D]/60">
                  All your bookings are properly scheduled with no overlaps.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {conflicts.map((conflict, index) => (
                  <ConflictCard
                    key={index}
                    conflict={conflict}
                    propertyName={propertyNames[conflict.property_id] || 'Unknown Property'}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {conflicts.length > 0 && (
            <div className="p-6 border-t border-[#2D2D2D]/10 bg-[#F5F5F0]">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[#2D2D2D]/70">
                  <strong>How to resolve conflicts:</strong>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Cancel one of the overlapping bookings on the original platform</li>
                    <li>Contact guests to negotiate alternative dates</li>
                    <li>Check if a guest can be moved to another property</li>
                  </ul>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 bg-[#500000] text-white rounded-xl font-medium hover:bg-[#500000]/90 transition-colors"
              >
                Acknowledge & Close
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ConflictCard({
  conflict,
  propertyName,
}: {
  conflict: BookingConflict;
  propertyName: string;
}) {
  const booking1Start = parseISO(conflict.booking1_start);
  const booking1End = parseISO(conflict.booking1_end);
  const booking2Start = parseISO(conflict.booking2_start);
  const booking2End = parseISO(conflict.booking2_end);
  const overlapStart = parseISO(conflict.overlap_start);
  const overlapEnd = parseISO(conflict.overlap_end);

  const platform1 = conflict.booking1_platform as keyof typeof PLATFORM_COLORS;
  const platform2 = conflict.booking2_platform as keyof typeof PLATFORM_COLORS;

  return (
    <div className="border border-red-200 bg-red-50/50 rounded-xl p-4">
      {/* Property */}
      <div className="flex items-center gap-2 mb-4">
        <Home className="w-4 h-4 text-[#500000]" />
        <span className="font-medium text-[#2D2D2D]">{propertyName}</span>
      </div>

      {/* Bookings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* Booking 1 */}
        <div className="bg-white rounded-lg p-3 border border-[#2D2D2D]/10">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: PLATFORM_COLORS[platform1] || '#8B5CF6' }}
            />
            <span className="text-sm font-medium" style={{ color: PLATFORM_COLORS[platform1] || '#8B5CF6' }}>
              {PLATFORM_NAMES[platform1] || conflict.booking1_platform}
            </span>
          </div>
          <div className="text-sm text-[#2D2D2D]">
            {format(booking1Start, 'MMM d')} - {format(booking1End, 'MMM d, yyyy')}
          </div>
          <div className="text-xs text-[#2D2D2D]/60 mt-1">
            {differenceInDays(booking1End, booking1Start)} nights
          </div>
        </div>

        {/* Booking 2 */}
        <div className="bg-white rounded-lg p-3 border border-[#2D2D2D]/10">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: PLATFORM_COLORS[platform2] || '#8B5CF6' }}
            />
            <span className="text-sm font-medium" style={{ color: PLATFORM_COLORS[platform2] || '#8B5CF6' }}>
              {PLATFORM_NAMES[platform2] || conflict.booking2_platform}
            </span>
          </div>
          <div className="text-sm text-[#2D2D2D]">
            {format(booking2Start, 'MMM d')} - {format(booking2End, 'MMM d, yyyy')}
          </div>
          <div className="text-xs text-[#2D2D2D]/60 mt-1">
            {differenceInDays(booking2End, booking2Start)} nights
          </div>
        </div>
      </div>

      {/* Overlap Info */}
      <div className="flex items-center justify-between p-3 bg-red-100 rounded-lg">
        <div>
          <div className="text-sm font-medium text-red-800">Overlap Period</div>
          <div className="text-sm text-red-700">
            {format(overlapStart, 'MMM d')} - {format(overlapEnd, 'MMM d, yyyy')}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-red-800">{conflict.overlap_days}</div>
          <div className="text-xs text-red-700">day{conflict.overlap_days !== 1 ? 's' : ''} overlap</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button className="flex-1 py-2 px-3 bg-white border border-[#2D2D2D]/20 rounded-lg text-sm font-medium hover:bg-[#F5F5F0] transition-colors flex items-center justify-center gap-2">
          <ExternalLink className="w-4 h-4" />
          Open in {PLATFORM_NAMES[platform1] || conflict.booking1_platform}
        </button>
        <button className="flex-1 py-2 px-3 bg-white border border-[#2D2D2D]/20 rounded-lg text-sm font-medium hover:bg-[#F5F5F0] transition-colors flex items-center justify-center gap-2">
          <ExternalLink className="w-4 h-4" />
          Open in {PLATFORM_NAMES[platform2] || conflict.booking2_platform}
        </button>
      </div>
    </div>
  );
}
