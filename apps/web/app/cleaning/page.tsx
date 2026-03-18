'use client';

/**
 * Right at Home BnB - Cleaning Jobs Management
 * Enhanced with GPS map, photo verification, AI scoring, leaderboard
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import DashboardShell from '@/components/layout/DashboardShell';
import {
  CheckCircle, Clock, Calendar, Home, AlertTriangle, Camera, ChevronRight,
  Plus, RefreshCw, MapPin, User, Sparkles, ClipboardList, Trophy, Star,
  Map, Grid3X3, Award, Medal, Crown, TrendingUp, Eye, Play, Pause,
  CheckCheck, X, Image, Upload, Zap, Target, Timer, Navigation,
  ThumbsUp, ThumbsDown, MessageSquare, Phone, Filter, Search, MoreVertical,
  ChevronDown, Maximize2, Minimize2, Battery, Wifi, WifiOff, Car
} from 'lucide-react';
import { CleaningReport, CleaningJobType } from '@/lib/cleaning-system';
import { properties } from '@/lib/property-knowledge';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface CleanerProfile {
  id: string;
  name: string;
  avatar?: string;
  phone: string;
  email: string;
  rating: number;
  totalJobs: number;
  completedJobs: number;
  avgTimeMinutes: number;
  avgScore: number;
  specialties: string[];
  status: 'available' | 'on_job' | 'offline' | 'en_route';
  currentLocation?: { lat: number; lng: number };
  currentJobId?: string;
  badges: Badge[];
  streak: number;
  earnings: { week: number; month: number; year: number };
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  earnedAt: Date;
  description: string;
}

interface VerificationPhoto {
  id: string;
  url: string;
  room: string;
  timestamp: Date;
  aiScore?: number;
  aiNotes?: string[];
  verified: boolean;
  verifiedBy?: string;
}

interface AIScoreBreakdown {
  overall: number;
  categories: {
    name: string;
    score: number;
    maxScore: number;
    notes: string[];
  }[];
  recommendations: string[];
  comparisonToAvg: number;
}

interface ExtendedCleaningJob extends Omit<CleaningReport, 'verificationPhotos'> {
  cleaner?: CleanerProfile;
  verificationPhotos: VerificationPhoto[];
  aiScore?: AIScoreBreakdown;
  estimatedArrival?: Date;
  actualArrival?: Date;
  estimatedCompletion?: Date;
  guestCheckIn?: Date;
  urgencyLevel: 'low' | 'normal' | 'high' | 'critical';
  specialInstructions?: string;
  suppliesNeeded?: string[];
}

type TabType = 'today' | 'upcoming' | 'in_progress' | 'completed';
type ViewMode = 'list' | 'map' | 'photos' | 'leaderboard';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Build property mapping from real data
const propertyNames: Record<string, { name: string; address: string; lat: number; lng: number }> = {};
properties.forEach(p => {
  propertyNames[p.id] = {
    name: p.name,
    address: p.address,
    // Mock coordinates around Midland, TX
    lat: 31.9973 + (Math.random() - 0.5) * 0.1,
    lng: -102.0779 + (Math.random() - 0.5) * 0.1
  };
});

const jobTypeLabels: Record<CleaningJobType, { label: string; color: string; bgColor: string }> = {
  turnover: { label: 'Turnover', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  deep_clean: { label: 'Deep Clean', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  inspection: { label: 'Inspection', color: 'text-green-600', bgColor: 'bg-green-100' },
  touch_up: { label: 'Touch Up', color: 'text-orange-600', bgColor: 'bg-orange-100' }
};

const urgencyConfig = {
  low: { label: 'Low', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Clock },
  normal: { label: 'Normal', color: 'text-blue-500', bgColor: 'bg-blue-100', icon: Timer },
  high: { label: 'High', color: 'text-orange-500', bgColor: 'bg-orange-100', icon: AlertTriangle },
  critical: { label: 'Critical', color: 'text-red-500', bgColor: 'bg-red-100', icon: Zap }
};

const cleanerStatusConfig = {
  available: { label: 'Available', color: 'text-green-600', bgColor: 'bg-green-100', dot: 'bg-green-500' },
  on_job: { label: 'On Job', color: 'text-blue-600', bgColor: 'bg-blue-100', dot: 'bg-blue-500' },
  en_route: { label: 'En Route', color: 'text-yellow-600', bgColor: 'bg-yellow-100', dot: 'bg-yellow-500' },
  offline: { label: 'Offline', color: 'text-gray-600', bgColor: 'bg-gray-100', dot: 'bg-gray-400' }
};

// ============================================================================
// MOCK DATA
// ============================================================================

// Cleaner profiles — loaded from API when connected
const mockCleaners: CleanerProfile[] = [];

const mockVerificationPhotos: VerificationPhoto[] = [];

const mockAIScore: AIScoreBreakdown = {
  overall: 0,
  categories: [],
  recommendations: [],
  comparisonToAvg: 0
};

// Cleaning jobs — loaded from API when connected
const mockJobs: ExtendedCleaningJob[] = [];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatTime = (date: Date | string) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const formatDate = (dateInput: Date | string) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

const getTimeUntil = (date: Date | string) => {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();

  if (diff < 0) return 'Overdue';

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getProgress = (job: ExtendedCleaningJob) => {
  if (!job.checklist.length) return 0;
  const completed = job.checklist.filter(i => i.completed).length;
  return Math.round((completed / job.checklist.length) * 100);
};

// ============================================================================
// COMPONENTS
// ============================================================================

// Loading Skeleton
function JobCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-20 bg-gray-200 rounded-full" />
            <div className="h-5 w-16 bg-gray-200 rounded-full" />
          </div>
          <div className="h-5 w-40 bg-gray-200 rounded mb-1" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
        <div className="text-right">
          <div className="h-4 w-16 bg-gray-200 rounded mb-1" />
          <div className="h-3 w-12 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="h-2 bg-gray-200 rounded-full" />
    </div>
  );
}

// Stats Card Component
function StatsCard({
  icon: Icon,
  label,
  value,
  subValue,
  color
}: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white/10 backdrop-blur rounded-xl p-3 text-center"
    >
      <Icon className={`w-6 h-6 mx-auto mb-1 ${color}`} />
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/70">{label}</div>
      {subValue && <div className="text-xs text-white/50 mt-1">{subValue}</div>}
    </motion.div>
  );
}

// Cleaner Avatar Component
function CleanerAvatar({ cleaner, size = 'md' }: { cleaner: CleanerProfile; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg'
  };

  const statusConfig = cleanerStatusConfig[cleaner.status];

  return (
    <div className="relative">
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center text-white font-semibold`}>
        {cleaner.name.split(' ').map(n => n[0]).join('')}
      </div>
      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${statusConfig.dot} rounded-full border-2 border-white`} />
    </div>
  );
}

// Job Card Component
function JobCard({
  job,
  onClick,
  onStartJob,
  showCleaner = true
}: {
  job: ExtendedCleaningJob;
  onClick: () => void;
  onStartJob?: () => void;
  showCleaner?: boolean;
}) {
  const property = propertyNames[job.propertyId] || { name: 'Unknown Property', address: '' };
  const jobType = jobTypeLabels[job.jobType];
  const urgency = urgencyConfig[job.urgencyLevel];
  const progress = getProgress(job);
  const cleaner = job.cleaner || mockCleaners.find(c => c.id === job.cleanerId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -2 }}
      className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${jobType.bgColor} ${jobType.color} font-medium`}>
              {jobType.label}
            </span>
            {job.urgencyLevel !== 'normal' && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${urgency.bgColor} ${urgency.color} font-medium flex items-center gap-1`}>
                <urgency.icon className="w-3 h-3" />
                {urgency.label}
              </span>
            )}
            {job.issues.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                {job.issues.length} issue{job.issues.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900">{property.name}</h3>
          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
            <MapPin className="w-3 h-3" />
            {property.address}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">
            {formatDate(job.scheduledAt)}
          </div>
          <div className="text-xs text-gray-500">
            {formatTime(job.scheduledAt)}
          </div>
          {job.guestCheckIn && job.status !== 'completed' && (
            <div className={`text-xs mt-1 font-medium ${
              new Date(job.guestCheckIn).getTime() - Date.now() < 3600000 * 2
                ? 'text-red-500'
                : 'text-[#500000]'
            }`}>
              Check-in: {getTimeUntil(job.guestCheckIn)}
            </div>
          )}
        </div>
      </div>

      {/* Cleaner Info */}
      {showCleaner && cleaner && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
          <CleanerAvatar cleaner={cleaner} size="sm" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">{cleaner.name}</div>
            <div className="text-xs text-gray-500">{cleanerStatusConfig[cleaner.status].label}</div>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-[#C4A777]" />
            <span className="text-xs font-medium">{cleaner.rating}</span>
          </div>
        </div>
      )}

      {/* Progress Bar for In Progress */}
      {job.status === 'in_progress' && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium text-[#500000]">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#500000] to-[#722F37] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          {job.verificationPhotos.length > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
              <Camera className="w-3 h-3" />
              {job.verificationPhotos.length} photos uploaded
            </div>
          )}
        </div>
      )}

      {/* AI Score for Completed */}
      {job.status === 'completed' && job.aiScore && (
        <div className="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
              {job.aiScore.overall}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">AI Quality Score</div>
              <div className="text-xs text-green-600">
                +{job.aiScore.comparisonToAvg}% above average
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {job.rating && [...Array(job.rating)].map((_, i) => (
              <Star key={i} className="w-4 h-4 text-[#C4A777] fill-current" />
            ))}
          </div>
        </div>
      )}

      {/* Completed Info */}
      {job.status === 'completed' && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-3">
            {job.timeSpentMinutes && (
              <div className="flex items-center gap-1 text-gray-500">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{Math.floor(job.timeSpentMinutes / 60)}h {job.timeSpentMinutes % 60}m</span>
              </div>
            )}
            {job.verificationPhotos.length > 0 && (
              <div className="flex items-center gap-1 text-gray-500">
                <Camera className="w-4 h-4" />
                <span className="text-sm">{job.verificationPhotos.length} photos</span>
              </div>
            )}
          </div>
          <CheckCircle className="w-5 h-5 text-green-500" />
        </div>
      )}

      {/* Action Button for Not Started */}
      {job.status === 'not_started' && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
          <span className="text-sm text-gray-500">Tap to view details</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartJob?.();
            }}
            className="px-3 py-1.5 bg-[#500000] text-white text-sm rounded-lg hover:bg-[#722F37] transition-colors flex items-center gap-1"
          >
            <Play className="w-4 h-4" />
            Start
          </button>
        </div>
      )}

      {/* Action for In Progress */}
      {job.status === 'in_progress' && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
          <span className="text-sm text-[#500000] font-medium">Continue cleaning</span>
          <ChevronRight className="w-5 h-5 text-[#500000]" />
        </div>
      )}
    </motion.div>
  );
}

// Leaderboard Entry Component
function LeaderboardEntry({
  cleaner,
  rank,
  onClick
}: {
  cleaner: CleanerProfile;
  rank: number;
  onClick: () => void;
}) {
  const getRankIcon = () => {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-[#C4A777]" />;
      case 2: return <Medal className="w-6 h-6 text-gray-400" />;
      case 3: return <Medal className="w-6 h-6 text-amber-600" />;
      default: return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-bold">{rank}</span>;
    }
  };

  const statusConfig = cleanerStatusConfig[cleaner.status];

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
        rank === 1
          ? 'bg-gradient-to-r from-[#500000]/10 to-[#C4A777]/10 border border-[#C4A777]/30'
          : 'bg-white hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-center w-8">
        {getRankIcon()}
      </div>

      <CleanerAvatar cleaner={cleaner} size="lg" />

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{cleaner.name}</h3>
          {cleaner.streak > 10 && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full flex items-center gap-1">
              🔥 {cleaner.streak} streak
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-xs ${statusConfig.color} ${statusConfig.bgColor} px-2 py-0.5 rounded-full`}>
            {statusConfig.label}
          </span>
          <span className="text-xs text-gray-500">{cleaner.totalJobs} jobs</span>
          <span className="text-xs text-gray-500">{cleaner.avgScore}% avg</span>
        </div>
        {cleaner.badges.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            {cleaner.badges.slice(0, 3).map(badge => (
              <span key={badge.id} title={badge.description} className="text-lg">
                {badge.icon}
              </span>
            ))}
            {cleaner.badges.length > 3 && (
              <span className="text-xs text-gray-400">+{cleaner.badges.length - 3}</span>
            )}
          </div>
        )}
      </div>

      <div className="text-right">
        <div className="flex items-center gap-1 justify-end">
          <Star className="w-5 h-5 text-[#C4A777] fill-current" />
          <span className="text-xl font-bold text-gray-900">{cleaner.rating}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          ${cleaner.earnings.month.toLocaleString()}/mo
        </div>
      </div>
    </motion.div>
  );
}

// Photo Verification Grid Component
function PhotoVerificationGrid({
  photos,
  onPhotoClick
}: {
  photos: VerificationPhoto[];
  onPhotoClick: (photo: VerificationPhoto) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {photos.map((photo) => (
        <motion.div
          key={photo.id}
          whileHover={{ scale: 1.02 }}
          onClick={() => onPhotoClick(photo)}
          className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer group"
        >
          {/* Placeholder image */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <Camera className="w-8 h-8 text-gray-400" />
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Room Label */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
            <div className="text-white text-sm font-medium">{photo.room}</div>
            <div className="text-white/70 text-xs">{formatTime(photo.timestamp)}</div>
          </div>

          {/* AI Score Badge */}
          {photo.aiScore && (
            <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${
              photo.aiScore >= 95
                ? 'bg-green-500 text-white'
                : photo.aiScore >= 90
                  ? 'bg-yellow-500 text-white'
                  : 'bg-orange-500 text-white'
            }`}>
              {photo.aiScore}
            </div>
          )}

          {/* Verified Badge */}
          {photo.verified && (
            <div className="absolute top-2 left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// GPS Map View Component (Simplified - would use Mapbox/Google Maps in production)
function GPSMapView({
  jobs,
  cleaners,
  onJobClick,
  onCleanerClick
}: {
  jobs: ExtendedCleaningJob[];
  cleaners: CleanerProfile[];
  onJobClick: (job: ExtendedCleaningJob) => void;
  onCleanerClick: (cleaner: CleanerProfile) => void;
}) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  return (
    <div className="relative bg-gray-100 rounded-2xl overflow-hidden" style={{ height: '500px' }}>
      {/* Map Placeholder - In production, use Mapbox or Google Maps */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300">
        {/* Grid lines to simulate map */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(20)].map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute h-px bg-gray-400"
              style={{ top: `${i * 5}%`, left: 0, right: 0 }}
            />
          ))}
          {[...Array(20)].map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute w-px bg-gray-400"
              style={{ left: `${i * 5}%`, top: 0, bottom: 0 }}
            />
          ))}
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <Map className="w-16 h-16 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Map View - Midland, TX</p>
            <p className="text-xs opacity-70">Real-time cleaner locations</p>
          </div>
        </div>
      </div>

      {/* Property Markers */}
      {jobs.filter(j => j.status !== 'completed').map((job, index) => {
        const property = propertyNames[job.propertyId];
        if (!property) return null;

        // Simulate positions on the "map"
        const left = 20 + (index * 15) % 60;
        const top = 20 + Math.floor(index / 4) * 20;

        return (
          <motion.div
            key={job.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.2 }}
            onClick={() => {
              setSelectedItem(job.id);
              onJobClick(job);
            }}
            className={`absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 ${
              selectedItem === job.id ? 'z-20' : 'z-10'
            }`}
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
              job.urgencyLevel === 'critical' ? 'bg-red-500' :
              job.urgencyLevel === 'high' ? 'bg-orange-500' :
              job.status === 'in_progress' ? 'bg-[#500000]' : 'bg-gray-500'
            }`}>
              <Home className="w-5 h-5 text-white" />
            </div>
            {selectedItem === job.id && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-3 min-w-[200px] z-30"
              >
                <div className="font-medium text-sm">{property.name}</div>
                <div className="text-xs text-gray-500">{jobTypeLabels[job.jobType].label}</div>
                <div className="text-xs text-[#500000] mt-1">
                  {job.status === 'in_progress' ? 'In Progress' : `Check-in: ${getTimeUntil(job.guestCheckIn!)}`}
                </div>
              </motion.div>
            )}
          </motion.div>
        );
      })}

      {/* Cleaner Markers */}
      {cleaners.filter(c => c.status !== 'offline' && c.currentLocation).map((cleaner, index) => {
        // Simulate cleaner positions
        const left = 30 + (index * 20) % 50;
        const top = 40 + (index * 15) % 40;

        return (
          <motion.div
            key={cleaner.id}
            initial={{ scale: 0 }}
            animate={{
              scale: 1,
              x: [0, 5, -5, 0],
              y: [0, -5, 5, 0]
            }}
            transition={{
              x: { repeat: Infinity, duration: 3, ease: "easeInOut" },
              y: { repeat: Infinity, duration: 4, ease: "easeInOut" }
            }}
            whileHover={{ scale: 1.2 }}
            onClick={() => {
              setSelectedItem(cleaner.id);
              onCleanerClick(cleaner);
            }}
            className={`absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 ${
              selectedItem === cleaner.id ? 'z-20' : 'z-10'
            }`}
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <div className={`relative`}>
              <div className={`w-12 h-12 rounded-full border-4 ${
                cleaner.status === 'on_job' ? 'border-blue-500' :
                cleaner.status === 'en_route' ? 'border-yellow-500' : 'border-green-500'
              } bg-white shadow-lg overflow-hidden`}>
                <div className="w-full h-full bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center text-white font-bold text-sm">
                  {cleaner.name.split(' ').map(n => n[0]).join('')}
                </div>
              </div>
              {cleaner.status === 'en_route' && (
                <motion.div
                  className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <Car className="w-3 h-3 text-white" />
                </motion.div>
              )}
            </div>
            {selectedItem === cleaner.id && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-14 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-3 min-w-[180px] z-30"
              >
                <div className="font-medium text-sm">{cleaner.name}</div>
                <div className={`text-xs ${cleanerStatusConfig[cleaner.status].color}`}>
                  {cleanerStatusConfig[cleaner.status].label}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <Star className="w-3 h-3 text-[#C4A777]" />
                  {cleaner.rating} rating
                </div>
              </motion.div>
            )}
          </motion.div>
        );
      })}

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50">
          <Plus className="w-5 h-5 text-gray-600" />
        </button>
        <button className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50">
          <Minimize2 className="w-5 h-5 text-gray-600" />
        </button>
        <button className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50">
          <Navigation className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3">
        <div className="text-xs font-medium text-gray-700 mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-[#500000]" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>High Priority</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Available Cleaner</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>En Route</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Job Detail Modal
function JobDetailModal({
  job,
  onClose
}: {
  job: ExtendedCleaningJob;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'photos' | 'checklist' | 'ai'>('overview');
  const property = propertyNames[job.propertyId] || { name: 'Unknown', address: '' };
  const cleaner = job.cleaner || mockCleaners.find(c => c.id === job.cleanerId);
  const progress = getProgress(job);

  return (
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
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#500000] to-[#722F37] text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full bg-white/20`}>
                  {jobTypeLabels[job.jobType].label}
                </span>
                {job.urgencyLevel !== 'normal' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full bg-white/20`}>
                    {urgencyConfig[job.urgencyLevel].label}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold">{property.name}</h2>
              <p className="text-white/70 text-sm">{property.address}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          {job.status === 'in_progress' && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-white/70">Progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C4A777] rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['overview', 'photos', 'checklist', 'ai'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-[#500000] border-b-2 border-[#500000]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Cleaner Info */}
              {cleaner && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <CleanerAvatar cleaner={cleaner} size="lg" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{cleaner.name}</div>
                    <div className="text-sm text-gray-500">{cleaner.phone}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="w-4 h-4 text-[#C4A777]" />
                      <span className="text-sm font-medium">{cleaner.rating}</span>
                      <span className="text-xs text-gray-400">|</span>
                      <span className="text-xs text-gray-500">{cleaner.totalJobs} jobs</span>
                    </div>
                  </div>
                  <button className="p-2 bg-[#500000] text-white rounded-lg hover:bg-[#722F37]">
                    <Phone className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-500 mb-1">Scheduled</div>
                  <div className="font-medium">{formatDate(job.scheduledAt)}</div>
                  <div className="text-sm text-gray-600">{formatTime(job.scheduledAt)}</div>
                </div>
                {job.guestCheckIn && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs text-gray-500 mb-1">Guest Check-in</div>
                    <div className="font-medium">{formatDate(job.guestCheckIn)}</div>
                    <div className={`text-sm ${
                      new Date(job.guestCheckIn).getTime() - Date.now() < 3600000 * 2
                        ? 'text-red-500 font-medium'
                        : 'text-gray-600'
                    }`}>
                      {getTimeUntil(job.guestCheckIn)}
                    </div>
                  </div>
                )}
              </div>

              {/* Special Instructions */}
              {job.specialInstructions && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-center gap-2 text-yellow-700 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium text-sm">Special Instructions</span>
                  </div>
                  <p className="text-sm text-yellow-800">{job.specialInstructions}</p>
                </div>
              )}

              {/* Supplies Needed */}
              {job.suppliesNeeded && job.suppliesNeeded.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Supplies Needed</div>
                  <div className="flex flex-wrap gap-2">
                    {job.suppliesNeeded.map((supply, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                        {supply}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues */}
              {job.issues.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Reported Issues</div>
                  <div className="space-y-2">
                    {job.issues.map((issue) => (
                      <div key={issue.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          <span className="font-medium text-sm text-orange-700">{issue.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            issue.severity === 'high' ? 'bg-red-100 text-red-600' :
                            issue.severity === 'medium' ? 'bg-orange-100 text-orange-600' :
                            'bg-yellow-100 text-yellow-600'
                          }`}>
                            {issue.severity}
                          </span>
                        </div>
                        <p className="text-xs text-orange-600 mt-1">{issue.location}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'photos' && (
            <div>
              {job.verificationPhotos.length > 0 ? (
                <PhotoVerificationGrid
                  photos={job.verificationPhotos}
                  onPhotoClick={(photo) => toast.success(`Viewing ${photo.room}`)}
                />
              ) : (
                <div className="text-center py-12">
                  <Camera className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No photos uploaded yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'checklist' && (
            <div>
              {job.checklist.length > 0 ? (
                <div className="space-y-2">
                  {job.checklist.map((item, i) => (
                    <div
                      key={item.itemId}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        item.completed ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        item.completed ? 'bg-green-500' : 'border-2 border-gray-300'
                      }`}>
                        {item.completed && <CheckCircle className="w-4 h-4 text-white" />}
                      </div>
                      <span className={`text-sm ${item.completed ? 'text-gray-600' : 'text-gray-900'}`}>
                        Checklist Item {i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No checklist items</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ai' && (
            <div>
              {job.aiScore ? (
                <div className="space-y-6">
                  {/* Overall Score */}
                  <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                      {job.aiScore.overall}
                    </div>
                    <div className="mt-4 text-lg font-medium text-gray-900">AI Quality Score</div>
                    <div className="text-sm text-green-600">
                      {job.aiScore.comparisonToAvg > 0 ? '+' : ''}{job.aiScore.comparisonToAvg}% vs average
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div className="space-y-3">
                    {job.aiScore.categories.map((cat) => (
                      <div key={cat.name} className="p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{cat.name}</span>
                          <span className="text-sm font-medium text-[#500000]">
                            {cat.score}/{cat.maxScore}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#500000] to-[#C4A777] rounded-full"
                            style={{ width: `${(cat.score / cat.maxScore) * 100}%` }}
                          />
                        </div>
                        {cat.notes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {cat.notes.map((note, i) => (
                              <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                {note}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Recommendations */}
                  {job.aiScore.recommendations.length > 0 && (
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <div className="flex items-center gap-2 text-blue-700 mb-2">
                        <Target className="w-4 h-4" />
                        <span className="font-medium text-sm">AI Recommendations</span>
                      </div>
                      <ul className="space-y-1">
                        {job.aiScore.recommendations.map((rec, i) => (
                          <li key={i} className="text-sm text-blue-800 flex items-start gap-2">
                            <span className="text-blue-400 mt-1">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Zap className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">AI scoring available after completion</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-3">
          {job.status === 'not_started' && (
            <button className="flex-1 px-4 py-3 bg-[#500000] text-white rounded-xl font-medium hover:bg-[#722F37] transition-colors flex items-center justify-center gap-2">
              <Play className="w-5 h-5" />
              Start Cleaning
            </button>
          )}
          {job.status === 'in_progress' && (
            <>
              <button className="flex-1 px-4 py-3 bg-[#500000] text-white rounded-xl font-medium hover:bg-[#722F37] transition-colors flex items-center justify-center gap-2">
                <CheckCheck className="w-5 h-5" />
                Mark Complete
              </button>
              <button className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                <Camera className="w-5 h-5" />
              </button>
            </>
          )}
          {job.status === 'completed' && (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Cleaner Detail Modal
function CleanerDetailModal({
  cleaner,
  onClose
}: {
  cleaner: CleanerProfile;
  onClose: () => void;
}) {
  const statusConfig = cleanerStatusConfig[cleaner.status];

  return (
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
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#500000] to-[#722F37] text-white p-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold mb-3">
            {cleaner.name.split(' ').map(n => n[0]).join('')}
          </div>
          <h2 className="text-xl font-bold">{cleaner.name}</h2>
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#500000]">{cleaner.rating}</div>
            <div className="text-xs text-gray-500">Rating</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#500000]">{cleaner.totalJobs}</div>
            <div className="text-xs text-gray-500">Total Jobs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#500000]">{cleaner.avgScore}%</div>
            <div className="text-xs text-gray-500">Avg Score</div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Contact */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Contact</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4" />
                {cleaner.phone}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MessageSquare className="w-4 h-4" />
                {cleaner.email}
              </div>
            </div>
          </div>

          {/* Specialties */}
          {cleaner.specialties.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Specialties</div>
              <div className="flex flex-wrap gap-2">
                {cleaner.specialties.map((spec, i) => (
                  <span key={i} className="px-3 py-1 bg-[#500000]/10 text-[#500000] text-sm rounded-full">
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Badges */}
          {cleaner.badges.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Badges</div>
              <div className="flex flex-wrap gap-2">
                {cleaner.badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg"
                    title={badge.description}
                  >
                    <span className="text-xl">{badge.icon}</span>
                    <span className="text-sm text-gray-700">{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Earnings */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Earnings</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <div className="text-lg font-bold text-gray-900">${cleaner.earnings.week.toLocaleString()}</div>
                <div className="text-xs text-gray-500">This Week</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <div className="text-lg font-bold text-gray-900">${cleaner.earnings.month.toLocaleString()}</div>
                <div className="text-xs text-gray-500">This Month</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <div className="text-lg font-bold text-gray-900">${cleaner.earnings.year.toLocaleString()}</div>
                <div className="text-xs text-gray-500">This Year</div>
              </div>
            </div>
          </div>

          {/* Streak */}
          {cleaner.streak > 0 && (
            <div className="p-4 bg-orange-50 rounded-xl flex items-center gap-3">
              <div className="text-3xl">🔥</div>
              <div>
                <div className="font-medium text-orange-700">{cleaner.streak} Day Streak!</div>
                <div className="text-sm text-orange-600">Consecutive perfect cleanings</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button className="flex-1 px-4 py-3 bg-[#500000] text-white rounded-xl font-medium hover:bg-[#722F37] transition-colors flex items-center justify-center gap-2">
            <Phone className="w-5 h-5" />
            Call
          </button>
          <button className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Message
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CleaningJobsPage() {
  const [jobs, setJobs] = useState<ExtendedCleaningJob[]>(mockJobs);
  const [cleaners, setCleaners] = useState<CleanerProfile[]>(mockCleaners);
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ExtendedCleaningJob | null>(null);
  const [selectedCleaner, setSelectedCleaner] = useState<CleanerProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const today = new Date().toDateString();

  // Filter jobs by tab
  const filteredJobs = useMemo(() => {
    let filtered = jobs.filter(job => {
      const jobDate = new Date(job.scheduledAt).toDateString();

      switch (activeTab) {
        case 'today':
          return jobDate === today && job.status !== 'completed';
        case 'upcoming':
          return new Date(job.scheduledAt) > new Date() && job.status === 'not_started';
        case 'in_progress':
          return job.status === 'in_progress';
        case 'completed':
          return job.status === 'completed';
        default:
          return true;
      }
    });

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(job =>
        job.propertyName.toLowerCase().includes(query) ||
        job.cleanerName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [jobs, activeTab, searchQuery, today]);

  // Stats
  const todayCount = jobs.filter(j => new Date(j.scheduledAt).toDateString() === today && j.status !== 'completed').length;
  const inProgressCount = jobs.filter(j => j.status === 'in_progress').length;
  const upcomingCount = jobs.filter(j => new Date(j.scheduledAt) > new Date() && j.status === 'not_started').length;
  const avgScore = Math.round(jobs.filter(j => j.aiScore).reduce((acc, j) => acc + (j.aiScore?.overall || 0), 0) / jobs.filter(j => j.aiScore).length) || 0;

  const tabs: { id: TabType; label: string; count: number; icon: any }[] = [
    { id: 'today', label: 'Today', count: todayCount, icon: Calendar },
    { id: 'in_progress', label: 'In Progress', count: inProgressCount, icon: Clock },
    { id: 'upcoming', label: 'Upcoming', count: upcomingCount, icon: ChevronRight },
    { id: 'completed', label: 'History', count: 0, icon: CheckCircle }
  ];

  const handleRefresh = async () => {
    setLoading(true);
    toast.loading('Refreshing...', { id: 'refresh' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    toast.success('Updated!', { id: 'refresh' });
  };

  const handleStartJob = (jobId: string) => {
    setJobs(prev => prev.map(j =>
      j.id === jobId
        ? { ...j, status: 'in_progress' as const, startedAt: new Date() }
        : j
    ));
    toast.success('Job started!');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedJob(null);
        setSelectedCleaner(null);
      }
      if (e.key === 'm' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setViewMode(prev => prev === 'map' ? 'list' : 'map');
      }
      if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setViewMode(prev => prev === 'leaderboard' ? 'list' : 'leaderboard');
      }
      if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <DashboardShell>
      <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#500000] to-[#722F37] text-white px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold font-['Playfair_Display']">Cleaning Operations</h1>
              <p className="text-white/70 mt-1">Right at Home BnB - Midland, TX</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                title="Refresh (Ctrl+R)"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatsCard
              icon={ClipboardList}
              label="Today"
              value={todayCount}
              subValue="Jobs scheduled"
              color="text-[#C4A777]"
            />
            <StatsCard
              icon={Clock}
              label="Active"
              value={inProgressCount}
              subValue="In progress"
              color="text-yellow-400"
            />
            <StatsCard
              icon={Trophy}
              label="Avg Score"
              value={avgScore || '--'}
              subValue="AI quality"
              color="text-green-400"
            />
            <StatsCard
              icon={User}
              label="Cleaners"
              value={cleaners.filter(c => c.status !== 'offline').length}
              subValue={`${cleaners.length} total`}
              color="text-blue-400"
            />
          </div>
        </div>
      </div>

      {/* View Mode Toggle & Search */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* View Mode */}
          <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm">
            {[
              { id: 'list' as ViewMode, icon: ClipboardList, label: 'List' },
              { id: 'map' as ViewMode, icon: Map, label: 'Map' },
              { id: 'photos' as ViewMode, icon: Grid3X3, label: 'Photos' },
              { id: 'leaderboard' as ViewMode, icon: Trophy, label: 'Leaderboard' }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  viewMode === mode.id
                    ? 'bg-[#500000] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <mode.icon className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">{mode.label}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs or cleaners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 pb-24">
        {/* List/Map/Photos View */}
        {viewMode !== 'leaderboard' && (
          <>
            {/* Tabs (for list view) */}
            {viewMode === 'list' && (
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-[#500000] text-white shadow-lg'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{tab.label}</span>
                      {tab.count > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-white/20' : 'bg-[#500000]/10 text-[#500000]'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Job List */}
            {viewMode === 'list' && (
              <AnimatePresence mode="wait">
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <JobCardSkeleton key={i} />
                    ))}
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center py-16"
                  >
                    <Sparkles className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg">No jobs found</p>
                    {activeTab === 'today' && (
                      <p className="text-sm text-gray-400 mt-2">All caught up for today!</p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid gap-4 md:grid-cols-2"
                  >
                    {filteredJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onClick={() => setSelectedJob(job)}
                        onStartJob={() => handleStartJob(job.id)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* GPS Map View */}
            {viewMode === 'map' && (
              <GPSMapView
                jobs={jobs}
                cleaners={cleaners}
                onJobClick={setSelectedJob}
                onCleanerClick={setSelectedCleaner}
              />
            )}

            {/* Photo Grid View */}
            {viewMode === 'photos' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Verification Photos</h2>
                <PhotoVerificationGrid
                  photos={jobs.flatMap(j => j.verificationPhotos).slice(0, 12)}
                  onPhotoClick={(photo) => {
                    toast.success(`Viewing ${photo.room}`);
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* Leaderboard View */}
        {viewMode === 'leaderboard' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-[#500000]/10 to-[#C4A777]/10 rounded-2xl p-6 text-center">
              <Trophy className="w-12 h-12 mx-auto text-[#C4A777] mb-3" />
              <h2 className="text-xl font-bold text-gray-900">Cleaner Leaderboard</h2>
              <p className="text-gray-500 mt-1">Top performers this month</p>
            </div>

            <div className="space-y-3">
              {cleaners
                .sort((a, b) => b.avgScore - a.avgScore)
                .map((cleaner, index) => (
                  <LeaderboardEntry
                    key={cleaner.id}
                    cleaner={cleaner}
                    rank={index + 1}
                    onClick={() => setSelectedCleaner(cleaner)}
                  />
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedJob && (
          <JobDetailModal
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
          />
        )}
        {selectedCleaner && (
          <CleanerDetailModal
            cleaner={selectedCleaner}
            onClose={() => setSelectedCleaner(null)}
          />
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 lg:hidden">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link href="/" className="flex flex-col items-center text-gray-400 hover:text-[#500000]">
            <Home className="w-6 h-6" />
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link href="/cleaning" className="flex flex-col items-center text-[#500000]">
            <ClipboardList className="w-6 h-6" />
            <span className="text-xs mt-1 font-medium">Jobs</span>
          </Link>
          <button
            onClick={() => setViewMode('map')}
            className={`flex flex-col items-center ${viewMode === 'map' ? 'text-[#500000]' : 'text-gray-400 hover:text-[#500000]'}`}
          >
            <Map className="w-6 h-6" />
            <span className="text-xs mt-1">Map</span>
          </button>
          <button
            onClick={() => setViewMode('leaderboard')}
            className={`flex flex-col items-center ${viewMode === 'leaderboard' ? 'text-[#500000]' : 'text-gray-400 hover:text-[#500000]'}`}
          >
            <Trophy className="w-6 h-6" />
            <span className="text-xs mt-1">Leaders</span>
          </button>
        </div>
      </div>
      </div>
    </DashboardShell>
  );
}
