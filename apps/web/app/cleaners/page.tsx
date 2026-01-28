'use client';

/**
 * Right at Home BnB - Cleaner Management
 * Full cleaner profiles with name, phone, address, notes, ratings
 * Gamification leaderboard, job tracking, and performance metrics
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Trophy, Star, Clock, CheckCircle, Calendar,
  MapPin, Phone, Mail, TrendingUp, Award, Medal, Target,
  Zap, Timer, Users, BarChart3, Play, Pause, Camera,
  Plus, X, Edit2, Trash2, Save, FileText, DollarSign,
  Home as HomeIcon, User, AlertCircle, Bell, ThumbsUp,
  ThumbsDown, MessageSquare, Bot
} from 'lucide-react';
import { useCleaners, useCleaningJobs, CleaningJob, User as CleanerUser } from '@/lib/api';
import DashboardShell from '@/components/layout/DashboardShell';
import toast from 'react-hot-toast';

type TabView = 'leaderboard' | 'jobs' | 'schedule' | 'manage' | 'reviews';

// AI-detected review notification
interface ReviewNotification {
  id: string;
  cleanerId: string;
  cleanerName: string;
  guestName: string;
  propertyName: string;
  reviewDate: string;
  reviewText: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number; // -100 to +100
  suggestedImpact: number; // Points to add/subtract
  aiAnalysis: string;
  status: 'pending' | 'approved' | 'dismissed';
}

interface CleanerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  taxId?: string;
  notes: string;
  stevenNotes: string;
  rating: number;
  totalJobs: number;
  onTimePercentage: number;
  avgScore: number;
  status: 'active' | 'inactive' | 'on_leave';
  createdAt: string;
}

const jobStatusConfig = {
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-500', icon: Calendar },
  ASSIGNED: { label: 'Assigned', color: 'bg-purple-500', icon: Users },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-500', icon: Play },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-500', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-400', icon: Pause },
};

const jobTypeConfig = {
  TURNOVER: { label: 'Turnover', color: 'text-blue-600', bg: 'bg-blue-100' },
  DEEP_CLEAN: { label: 'Deep Clean', color: 'text-purple-600', bg: 'bg-purple-100' },
  INSPECTION: { label: 'Inspection', color: 'text-amber-600', bg: 'bg-amber-100' },
  MAINTENANCE: { label: 'Maintenance', color: 'text-red-600', bg: 'bg-red-100' },
};

// Mock cleaner profiles (would come from API/Firebase)
const mockCleanerProfiles: CleanerProfile[] = [
  {
    id: '1',
    name: 'Maria Rodriguez',
    phone: '+1 (432) 555-0101',
    email: 'maria.r@email.com',
    address: '123 Main St',
    city: 'Midland',
    state: 'TX',
    zip: '79705',
    notes: 'Excellent attention to detail. Prefers morning shifts.',
    stevenNotes: 'Very reliable. Always completes jobs on time.',
    rating: 4.9,
    totalJobs: 156,
    onTimePercentage: 98,
    avgScore: 95,
    status: 'active',
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'James Walker',
    phone: '+1 (432) 555-0102',
    email: 'james.w@email.com',
    address: '456 Oak Ave',
    city: 'Midland',
    state: 'TX',
    zip: '79705',
    notes: 'Good with deep cleans. Has own transportation.',
    stevenNotes: 'Takes extra time but work is thorough.',
    rating: 4.7,
    totalJobs: 89,
    onTimePercentage: 92,
    avgScore: 93,
    status: 'active',
    createdAt: '2024-03-20',
  },
  {
    id: '3',
    name: 'Sarah Chen',
    phone: '+1 (432) 555-0103',
    email: 'sarah.c@email.com',
    address: '789 Elm St',
    city: 'Midland',
    state: 'TX',
    zip: '79706',
    notes: 'Bilingual. Great guest reviews.',
    stevenNotes: 'Guests love her. Always gets great feedback.',
    rating: 4.8,
    totalJobs: 134,
    onTimePercentage: 96,
    avgScore: 97,
    status: 'active',
    createdAt: '2024-02-10',
  },
];

// Mock AI-detected review notifications
const mockReviewNotifications: ReviewNotification[] = [
  {
    id: 'rev_1',
    cleanerId: '1',
    cleanerName: 'Maria Rodriguez',
    guestName: 'John & Sarah Thompson',
    propertyName: 'Downtown Loft',
    reviewDate: '2026-01-17',
    reviewText: 'The place was absolutely spotless when we arrived! Maria did an incredible job. Every corner was cleaned, fresh linens, and even the kitchen appliances were sparkling. Would definitely recommend!',
    sentiment: 'positive',
    sentimentScore: 92,
    suggestedImpact: 3,
    aiAnalysis: 'Strong positive sentiment detected. Guest specifically praised cleaning quality, attention to detail, and overall presentation. Keywords: "spotless", "incredible job", "sparkling". Recommend +3 points.',
    status: 'pending',
  },
  {
    id: 'rev_2',
    cleanerId: '2',
    cleanerName: 'James Walker',
    guestName: 'Mike Davis',
    propertyName: 'Ranch House',
    reviewDate: '2026-01-16',
    reviewText: 'Found some dust under the bed and the bathroom mirror had streaks. The rest was okay but expected better given the cleaning fee.',
    sentiment: 'negative',
    sentimentScore: -45,
    suggestedImpact: -2,
    aiAnalysis: 'Moderate negative sentiment. Guest mentions specific cleaning issues: dust under bed, streaks on mirror. Disappointment with value for cleaning fee. Recommend -2 points for quality concerns.',
    status: 'pending',
  },
  {
    id: 'rev_3',
    cleanerId: '3',
    cleanerName: 'Sarah Chen',
    guestName: 'Emily Watson',
    propertyName: 'Garden Villa',
    reviewDate: '2026-01-15',
    reviewText: 'Sarah went above and beyond! Not only was everything clean but she left a lovely welcome note and arranged fresh flowers. The personal touch made our anniversary stay extra special.',
    sentiment: 'positive',
    sentimentScore: 98,
    suggestedImpact: 5,
    aiAnalysis: 'Exceptional positive sentiment. Guest highlights above-and-beyond service: welcome note, fresh flowers, personal touch. Special occasion (anniversary) made memorable. Recommend +5 points for exceptional service.',
    status: 'pending',
  },
];

export default function CleanersPage() {
  const { data: cleaners, isLoading: loadingCleaners } = useCleaners();
  const { data: jobs, isLoading: loadingJobs } = useCleaningJobs();
  const [activeTab, setActiveTab] = useState<TabView>('leaderboard');
  const [cleanerProfiles, setCleanerProfiles] = useState<CleanerProfile[]>(mockCleanerProfiles);
  const [reviewNotifications, setReviewNotifications] = useState<ReviewNotification[]>(mockReviewNotifications);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCleaner, setEditingCleaner] = useState<CleanerProfile | null>(null);

  // Count pending reviews for notification badge
  const pendingReviewsCount = reviewNotifications.filter(r => r.status === 'pending').length;

  // Stats
  const stats = useMemo(() => {
    if (!jobs) return { active: 0, completed: 0, scheduled: 0, avgScore: 0 };

    const active = jobs.filter(j => j.status === 'IN_PROGRESS').length;
    const completed = jobs.filter(j => j.status === 'COMPLETED').length;
    const scheduled = jobs.filter(j => j.status === 'SCHEDULED').length;
    const completedWithScore = jobs.filter(j => j.score !== null && j.score !== undefined);
    const avgScore = completedWithScore.length > 0
      ? completedWithScore.reduce((acc, j) => acc + (j.score || 0), 0) / completedWithScore.length
      : 0;

    return { active, completed, scheduled, avgScore: avgScore.toFixed(1) };
  }, [jobs]);

  const handleAddCleaner = (cleaner: Omit<CleanerProfile, 'id' | 'createdAt' | 'totalJobs' | 'onTimePercentage' | 'avgScore'>) => {
    const newCleaner: CleanerProfile = {
      ...cleaner,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
      totalJobs: 0,
      onTimePercentage: 100,
      avgScore: 0,
    };
    setCleanerProfiles(prev => [...prev, newCleaner]);
    setShowAddForm(false);
    toast.success(`${cleaner.name} added successfully!`);
  };

  const handleUpdateCleaner = (cleaner: CleanerProfile) => {
    setCleanerProfiles(prev => prev.map(c => c.id === cleaner.id ? cleaner : c));
    setEditingCleaner(null);
    toast.success(`${cleaner.name} updated successfully!`);
  };

  const handleDeleteCleaner = (id: string) => {
    const cleaner = cleanerProfiles.find(c => c.id === id);
    if (confirm(`Are you sure you want to remove ${cleaner?.name}?`)) {
      setCleanerProfiles(prev => prev.filter(c => c.id !== id));
      toast.success('Cleaner removed');
    }
  };

  // Handle approving a review - applies impact to cleaner score
  const handleApproveReview = (reviewId: string) => {
    const review = reviewNotifications.find(r => r.id === reviewId);
    if (!review) return;

    // Update the review status
    setReviewNotifications(prev =>
      prev.map(r => r.id === reviewId ? { ...r, status: 'approved' as const } : r)
    );

    // Apply the impact to the cleaner's score
    setCleanerProfiles(prev =>
      prev.map(c => {
        if (c.id === review.cleanerId) {
          const newScore = Math.max(0, Math.min(100, c.avgScore + review.suggestedImpact));
          const newRating = review.suggestedImpact > 0
            ? Math.min(5, c.rating + 0.1)
            : Math.max(1, c.rating - 0.1);
          return {
            ...c,
            avgScore: newScore,
            rating: Number(newRating.toFixed(1)),
          };
        }
        return c;
      })
    );

    const impact = review.suggestedImpact > 0
      ? `+${review.suggestedImpact} points`
      : `${review.suggestedImpact} points`;

    toast.success(`Review applied! ${review.cleanerName}: ${impact}`);
  };

  // Handle dismissing a review - no impact
  const handleDismissReview = (reviewId: string) => {
    const review = reviewNotifications.find(r => r.id === reviewId);
    if (!review) return;

    setReviewNotifications(prev =>
      prev.map(r => r.id === reviewId ? { ...r, status: 'dismissed' as const } : r)
    );

    toast.success('Review dismissed');
  };

  return (
    <DashboardShell>
      <div className="min-h-screen bg-[#F5F5F0]">
        {/* Header */}
        <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
                  Cleaner Hub
                </h1>
                <p className="text-[#2D2D2D]/60 mt-1">
                  {cleanerProfiles.length} cleaners • {stats.active} active jobs
                </p>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/20 hover:shadow-xl transition-shadow"
                >
                  <Plus className="w-5 h-5" />
                  Add Cleaner
                </motion.button>
              </div>
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
              { label: 'Active Jobs', value: stats.active, icon: Play, color: 'text-amber-600' },
              { label: 'Completed Today', value: stats.completed, icon: CheckCircle, color: 'text-emerald-600' },
              { label: 'Total Cleaners', value: cleanerProfiles.length, icon: Users, color: 'text-blue-600' },
              { label: 'Avg Quality Score', value: stats.avgScore, icon: Star, color: 'text-[#C4A777]' },
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

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {[
              { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
              { id: 'manage', label: 'Manage Cleaners', icon: Users },
              { id: 'reviews', label: 'AI Reviews', icon: Bot, badge: pendingReviewsCount },
              { id: 'jobs', label: 'Active Jobs', icon: Sparkles },
              { id: 'schedule', label: 'Schedule', icon: Calendar },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabView)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#500000] text-white'
                    : 'bg-white text-[#2D2D2D]/70 hover:bg-[#500000]/10'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
                {'badge' in tab && typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id
                      ? 'bg-white text-[#500000]'
                      : 'bg-amber-500 text-white'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'leaderboard' && (
            <LeaderboardView cleaners={cleanerProfiles} />
          )}

          {activeTab === 'manage' && (
            <ManageCleanersView
              cleaners={cleanerProfiles}
              onEdit={setEditingCleaner}
              onDelete={handleDeleteCleaner}
            />
          )}

          {activeTab === 'jobs' && (
            <ActiveJobsView jobs={jobs || []} isLoading={loadingJobs} />
          )}

          {activeTab === 'schedule' && (
            <ScheduleView jobs={jobs || []} isLoading={loadingJobs} />
          )}

          {activeTab === 'reviews' && (
            <ReviewNotificationsView
              notifications={reviewNotifications}
              onApprove={handleApproveReview}
              onDismiss={handleDismissReview}
            />
          )}
        </main>

        {/* Add/Edit Cleaner Modal */}
        <AnimatePresence>
          {(showAddForm || editingCleaner) && (
            <CleanerFormModal
              cleaner={editingCleaner}
              onSave={editingCleaner ? handleUpdateCleaner : handleAddCleaner}
              onClose={() => {
                setShowAddForm(false);
                setEditingCleaner(null);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}

// Cleaner Form Modal
function CleanerFormModal({
  cleaner,
  onSave,
  onClose,
}: {
  cleaner?: CleanerProfile | null;
  onSave: (cleaner: any) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: cleaner?.name || '',
    phone: cleaner?.phone || '',
    email: cleaner?.email || '',
    address: cleaner?.address || '',
    city: cleaner?.city || 'Midland',
    state: cleaner?.state || 'TX',
    zip: cleaner?.zip || '79705',
    taxId: cleaner?.taxId || '',
    notes: cleaner?.notes || '',
    stevenNotes: cleaner?.stevenNotes || '',
    rating: cleaner?.rating || 5,
    status: cleaner?.status || 'active' as const,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cleaner) {
      onSave({ ...cleaner, ...formData });
    } else {
      onSave(formData);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-[#2D2D2D]/10 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-['Playfair_Display'] font-bold text-[#500000]">
            {cleaner ? 'Edit Cleaner' : 'Add New Cleaner'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors">
            <X className="w-6 h-6 text-[#2D2D2D]/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-lg font-semibold text-[#2D2D2D] mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-[#500000]" />
              Basic Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#2D2D2D]/20 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent text-[#2D2D2D] bg-white"
                  placeholder="Maria Rodriguez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#2D2D2D]/20 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent text-[#2D2D2D] bg-white"
                  placeholder="+1 (432) 555-0101"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#2D2D2D]/20 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent text-[#2D2D2D] bg-white"
                  placeholder="maria.r@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-4 py-2.5 border border-[#2D2D2D]/20 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent text-[#2D2D2D] bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>
            </div>
          </div>

          {/* Address (Tax Info) */}
          <div>
            <h3 className="text-lg font-semibold text-[#2D2D2D] mb-4 flex items-center gap-2">
              <HomeIcon className="w-5 h-5 text-[#500000]" />
              Address (for Tax Records)
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Street Address *</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#2D2D2D]/20 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent text-[#2D2D2D] bg-white"
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D] mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-[#2D2D2D]/20 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent text-[#2D2D2D] bg-white"
                    placeholder="Midland"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D] mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-[#2D2D2D]/20 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent text-[#2D2D2D] bg-white"
                    placeholder="TX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D] mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => setFormData(prev => ({ ...prev, zip: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-[#2D2D2D]/20 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent text-[#2D2D2D] bg-white"
                    placeholder="79705"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Tax ID / SSN (Last 4)</label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#2D2D2D]/20 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent text-[#2D2D2D] bg-white"
                  placeholder="XXX-XX-1234"
                />
                <p className="text-xs text-[#2D2D2D]/50 mt-1">For 1099 tax reporting purposes</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-lg font-semibold text-[#2D2D2D] mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#500000]" />
              Notes
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1">General Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-[#2D2D2D]/20 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent resize-none text-[#2D2D2D] bg-white"
                  placeholder="Prefers morning shifts, owns own transportation..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1">
                  Steven's Notes
                  <span className="text-xs text-[#2D2D2D]/50 ml-2">(Private notes from AI Steven)</span>
                </label>
                <textarea
                  value={formData.stevenNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, stevenNotes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-[#2D2D2D]/20 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent resize-none text-[#2D2D2D] bg-amber-50"
                  placeholder="Performance observations, call history notes..."
                />
              </div>
            </div>
          </div>

          {/* Rating */}
          <div>
            <h3 className="text-lg font-semibold text-[#2D2D2D] mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-[#C4A777]" />
              Initial Rating
            </h3>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
                  className={`p-2 rounded-lg transition-colors ${
                    star <= formData.rating ? 'text-[#C4A777]' : 'text-[#2D2D2D]/20'
                  }`}
                >
                  <Star className={`w-8 h-8 ${star <= formData.rating ? 'fill-current' : ''}`} />
                </button>
              ))}
              <span className="ml-4 text-2xl font-['Playfair_Display'] font-bold text-[#500000]">
                {formData.rating}.0
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-[#2D2D2D]/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-[#2D2D2D]/20 text-[#2D2D2D] font-medium rounded-xl hover:bg-[#F5F5F0] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl hover:shadow-lg transition-shadow flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {cleaner ? 'Update Cleaner' : 'Add Cleaner'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Manage Cleaners View
function ManageCleanersView({
  cleaners,
  onEdit,
  onDelete,
}: {
  cleaners: CleanerProfile[];
  onEdit: (cleaner: CleanerProfile) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {cleaners.map((cleaner, index) => (
        <motion.div
          key={cleaner.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#500000]/20 to-[#722F37]/20 flex items-center justify-center text-xl font-['Playfair_Display'] font-bold text-[#500000]">
                {cleaner.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                    {cleaner.name}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    cleaner.status === 'active' ? 'bg-emerald-100 text-emerald-600' :
                    cleaner.status === 'on_leave' ? 'bg-amber-100 text-amber-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {cleaner.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-[#2D2D2D]/60">
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {cleaner.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {cleaner.email}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2 text-sm text-[#2D2D2D]/60">
                  <MapPin className="w-4 h-4" />
                  {cleaner.address}, {cleaner.city}, {cleaner.state} {cleaner.zip}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(cleaner)}
                className="p-2 text-[#500000] hover:bg-[#500000]/10 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => onDelete(cleaner.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-[#2D2D2D]/10">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-[#C4A777]">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-lg font-bold">{cleaner.rating}</span>
              </div>
              <div className="text-xs text-[#2D2D2D]/50">Rating</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-[#500000]">{cleaner.totalJobs}</div>
              <div className="text-xs text-[#2D2D2D]/50">Total Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-600">{cleaner.onTimePercentage}%</div>
              <div className="text-xs text-[#2D2D2D]/50">On Time</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">{cleaner.avgScore}</div>
              <div className="text-xs text-[#2D2D2D]/50">Avg Score</div>
            </div>
          </div>

          {/* Notes Preview */}
          {(cleaner.notes || cleaner.stevenNotes) && (
            <div className="mt-4 pt-4 border-t border-[#2D2D2D]/10">
              {cleaner.notes && (
                <p className="text-sm text-[#2D2D2D]/70">
                  <span className="font-medium">Notes:</span> {cleaner.notes}
                </p>
              )}
              {cleaner.stevenNotes && (
                <p className="text-sm text-amber-700 mt-2 bg-amber-50 p-2 rounded-lg">
                  <span className="font-medium">Steven's Notes:</span> {cleaner.stevenNotes}
                </p>
              )}
            </div>
          )}
        </motion.div>
      ))}

      {cleaners.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl">
          <Users className="w-16 h-16 text-[#2D2D2D]/20 mx-auto mb-4" />
          <h3 className="text-xl font-['Playfair_Display'] text-[#2D2D2D]">No cleaners yet</h3>
          <p className="text-[#2D2D2D]/60 mt-2">Add your first cleaner to get started</p>
        </div>
      )}
    </motion.div>
  );
}

// Leaderboard View
function LeaderboardView({ cleaners }: { cleaners: CleanerProfile[] }) {
  const leaderboard = [...cleaners]
    .sort((a, b) => (b.avgScore * b.rating) - (a.avgScore * a.rating))
    .map((cleaner, index) => ({
      ...cleaner,
      rank: index + 1,
      score: Math.round(cleaner.avgScore * cleaner.rating * 10),
    }));

  const rankStyles = [
    { bg: 'bg-gradient-to-r from-yellow-400 to-yellow-500', text: 'text-white', icon: Trophy },
    { bg: 'bg-gradient-to-r from-gray-300 to-gray-400', text: 'text-white', icon: Medal },
    { bg: 'bg-gradient-to-r from-amber-600 to-amber-700', text: 'text-white', icon: Award },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div className="grid md:grid-cols-3 gap-4">
          {leaderboard.slice(0, 3).map((cleaner, index) => {
            const style = rankStyles[index];
            const RankIcon = style.icon;

            return (
              <motion.div
                key={cleaner.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative overflow-hidden rounded-2xl p-6 ${style.bg} ${style.text}`}
              >
                <div className="absolute top-4 right-4 opacity-20">
                  <RankIcon className="w-24 h-24" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
                      #{cleaner.rank}
                    </div>
                    <RankIcon className="w-6 h-6" />
                  </div>

                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-['Playfair_Display'] font-bold mb-3">
                    {cleaner.name.split(' ').map(n => n[0]).join('')}
                  </div>

                  <h3 className="text-xl font-['Playfair_Display'] font-bold mb-1">
                    {cleaner.name}
                  </h3>

                  <div className="flex items-center gap-4 text-sm opacity-90">
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4" />
                      {cleaner.score} pts
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      {cleaner.rating}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Full Leaderboard */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 overflow-hidden">
        <div className="p-4 border-b border-[#2D2D2D]/10">
          <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
            Full Rankings
          </h3>
        </div>

        <div className="divide-y divide-[#2D2D2D]/5">
          {leaderboard.map((cleaner, index) => (
            <motion.div
              key={cleaner.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 p-4 hover:bg-[#F5F5F0] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                cleaner.rank <= 3 ? 'bg-[#500000] text-white' : 'bg-[#F5F5F0] text-[#2D2D2D]'
              }`}>
                #{cleaner.rank}
              </div>

              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#500000]/20 to-[#722F37]/20 flex items-center justify-center text-lg font-['Playfair_Display'] font-bold text-[#500000]">
                {cleaner.name.split(' ').map(n => n[0]).join('')}
              </div>

              <div className="flex-1">
                <div className="font-semibold text-[#2D2D2D]">{cleaner.name}</div>
                <div className="text-sm text-[#2D2D2D]/60">{cleaner.totalJobs} jobs completed</div>
              </div>

              <div className="hidden md:flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-[#C4A777]">
                    <Star className="w-4 h-4 fill-current" />
                    {cleaner.rating}
                  </div>
                  <div className="text-xs text-[#2D2D2D]/50">Rating</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-emerald-600">
                    <Target className="w-4 h-4" />
                    {cleaner.onTimePercentage}%
                  </div>
                  <div className="text-xs text-[#2D2D2D]/50">On Time</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xl font-['Playfair_Display'] font-bold text-[#500000]">
                  {cleaner.score}
                </div>
                <div className="text-xs text-[#2D2D2D]/50">points</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Active Jobs View
function ActiveJobsView({ jobs, isLoading }: { jobs: CleaningJob[]; isLoading: boolean }) {
  const activeJobs = jobs.filter(j => ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'].includes(j.status));

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
            <div className="h-6 bg-[#2D2D2D]/10 rounded w-1/3 mb-2" />
            <div className="h-4 bg-[#2D2D2D]/10 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {activeJobs.map((job, index) => {
        const status = jobStatusConfig[job.status];
        const type = jobTypeConfig[job.jobType];
        const StatusIcon = status.icon;

        return (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-xl p-5 shadow-sm border border-[#2D2D2D]/5"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${type.bg} ${type.color}`}>
                    {type.label}
                  </span>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${status.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </div>
                <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                  {job.property?.name || 'Property'}
                </h3>
              </div>

              {job.status === 'IN_PROGRESS' && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 rounded-full">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-amber-700">Live</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-6 text-sm text-[#2D2D2D]/60 mb-4">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {job.property?.address || 'Address'}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(job.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              {job.cleaner && (
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {job.cleaner.name}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#500000] text-white rounded-xl font-medium hover:bg-[#722F37] transition-colors">
                <Camera className="w-5 h-5" />
                View Progress
              </button>
              <button className="px-4 py-2.5 bg-[#F5F5F0] text-[#500000] rounded-xl font-medium hover:bg-[#500000]/10 transition-colors">
                Details
              </button>
            </div>
          </motion.div>
        );
      })}

      {activeJobs.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-['Playfair_Display'] text-[#2D2D2D]">All caught up!</h3>
          <p className="text-[#2D2D2D]/60 mt-2">No active cleaning jobs at the moment</p>
        </div>
      )}
    </motion.div>
  );
}

// Schedule View
function ScheduleView({ jobs, isLoading }: { jobs: CleaningJob[]; isLoading: boolean }) {
  const scheduledJobs = jobs.filter(j => j.status === 'SCHEDULED');

  const groupedByDate = scheduledJobs.reduce((acc, job) => {
    const date = new Date(job.scheduledAt).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(job);
    return acc;
  }, {} as Record<string, CleaningJob[]>);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {Object.entries(groupedByDate).map(([date, dateJobs], dateIndex) => (
        <div key={date}>
          <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-3">
            {date === new Date().toLocaleDateString() ? 'Today' : date}
          </h3>

          <div className="space-y-3">
            {dateJobs.map((job, index) => {
              const type = jobTypeConfig[job.jobType];

              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (dateIndex * dateJobs.length + index) * 0.05 }}
                  className="bg-white rounded-xl p-4 shadow-sm border border-[#2D2D2D]/5 flex items-center gap-4"
                >
                  <div className="w-16 text-center">
                    <div className="text-lg font-['Playfair_Display'] font-bold text-[#500000]">
                      {new Date(job.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="w-1 h-12 bg-[#500000]/20 rounded-full" />

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${type.bg} ${type.color}`}>
                        {type.label}
                      </span>
                    </div>
                    <div className="font-medium text-[#2D2D2D]">{job.property?.name || 'Property'}</div>
                    <div className="text-sm text-[#2D2D2D]/60">{job.cleaner?.name || 'Unassigned'}</div>
                  </div>

                  <button className="px-4 py-2 bg-[#F5F5F0] text-[#500000] rounded-lg text-sm font-medium hover:bg-[#500000]/10 transition-colors">
                    Assign
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {Object.keys(groupedByDate).length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl">
          <Calendar className="w-16 h-16 text-[#2D2D2D]/20 mx-auto mb-4" />
          <h3 className="text-xl font-['Playfair_Display'] text-[#2D2D2D]">No scheduled cleanings</h3>
          <p className="text-[#2D2D2D]/60 mt-2">Schedule a cleaning to see it here</p>
        </div>
      )}
    </motion.div>
  );
}

// AI Review Notifications View
function ReviewNotificationsView({
  notifications,
  onApprove,
  onDismiss,
}: {
  notifications: ReviewNotification[];
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const pendingReviews = notifications.filter(r => r.status === 'pending');
  const processedReviews = notifications.filter(r => r.status !== 'pending');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-5 border border-purple-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#2D2D2D]">AI Review Analysis</h3>
            <p className="text-[#2D2D2D]/70 mt-1">
              Guest reviews are automatically analyzed for sentiment. Positive mentions boost cleaner scores,
              while negative feedback helps identify areas for improvement. Review and approve the AI recommendations below.
            </p>
          </div>
        </div>
      </div>

      {/* Pending Reviews */}
      {pendingReviews.length > 0 && (
        <div>
          <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            Pending Reviews ({pendingReviews.length})
          </h3>

          <div className="space-y-4">
            {pendingReviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-[#2D2D2D]/5"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      review.sentiment === 'positive'
                        ? 'bg-emerald-100'
                        : review.sentiment === 'negative'
                        ? 'bg-red-100'
                        : 'bg-gray-100'
                    }`}>
                      {review.sentiment === 'positive' ? (
                        <ThumbsUp className="w-6 h-6 text-emerald-600" />
                      ) : review.sentiment === 'negative' ? (
                        <ThumbsDown className="w-6 h-6 text-red-600" />
                      ) : (
                        <MessageSquare className="w-6 h-6 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-[#2D2D2D]">{review.cleanerName}</div>
                      <div className="text-sm text-[#2D2D2D]/60">{review.propertyName}</div>
                    </div>
                  </div>

                  <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    review.sentiment === 'positive'
                      ? 'bg-emerald-100 text-emerald-700'
                      : review.sentiment === 'negative'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {review.sentiment === 'positive' ? '+' : ''}{review.suggestedImpact} points
                  </div>
                </div>

                {/* Guest Review */}
                <div className="bg-[#F5F5F0] rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-[#2D2D2D]/60" />
                    <span className="text-sm font-medium text-[#2D2D2D]">{review.guestName}</span>
                    <span className="text-sm text-[#2D2D2D]/40">• {new Date(review.reviewDate).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[#2D2D2D]/80 italic">"{review.reviewText}"</p>
                </div>

                {/* AI Analysis */}
                <div className="bg-purple-50 rounded-xl p-4 mb-4 border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">AI Analysis</span>
                    <span className={`ml-auto px-2 py-0.5 text-xs rounded-full ${
                      review.sentimentScore > 50
                        ? 'bg-emerald-100 text-emerald-700'
                        : review.sentimentScore < -30
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      Score: {review.sentimentScore > 0 ? '+' : ''}{review.sentimentScore}
                    </span>
                  </div>
                  <p className="text-sm text-purple-800">{review.aiAnalysis}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onApprove(review.id)}
                    className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
                      review.sentiment === 'positive'
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700'
                        : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                    }`}
                  >
                    <CheckCircle className="w-5 h-5" />
                    Add to Grade ({review.suggestedImpact > 0 ? '+' : ''}{review.suggestedImpact} pts)
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onDismiss(review.id)}
                    className="px-6 py-3 bg-white border border-[#2D2D2D]/20 text-[#2D2D2D]/70 rounded-xl font-medium hover:bg-[#F5F5F0] transition-colors"
                  >
                    Dismiss
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {pendingReviews.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-['Playfair_Display'] text-[#2D2D2D]">All caught up!</h3>
          <p className="text-[#2D2D2D]/60 mt-2">No pending review notifications</p>
        </div>
      )}

      {/* Processed Reviews History */}
      {processedReviews.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-['Playfair_Display'] font-semibold text-[#2D2D2D] mb-4">
            Review History
          </h3>

          <div className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 overflow-hidden">
            <div className="divide-y divide-[#2D2D2D]/5">
              {processedReviews.map((review) => (
                <div key={review.id} className="p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    review.status === 'approved'
                      ? review.sentiment === 'positive' ? 'bg-emerald-100' : 'bg-red-100'
                      : 'bg-gray-100'
                  }`}>
                    {review.status === 'approved' ? (
                      review.sentiment === 'positive' ? (
                        <ThumbsUp className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <ThumbsDown className="w-5 h-5 text-red-600" />
                      )
                    ) : (
                      <X className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="font-medium text-[#2D2D2D]">{review.cleanerName}</div>
                    <div className="text-sm text-[#2D2D2D]/60">
                      {review.guestName} • {review.propertyName}
                    </div>
                  </div>

                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    review.status === 'approved'
                      ? review.sentiment === 'positive'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {review.status === 'approved'
                      ? `Applied ${review.suggestedImpact > 0 ? '+' : ''}${review.suggestedImpact} pts`
                      : 'Dismissed'
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
