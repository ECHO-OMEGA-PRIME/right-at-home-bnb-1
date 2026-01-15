'use client';

/**
 * Right at Home BnB - Cleaner Management
 * Gamification leaderboard, job tracking, and performance metrics
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Sparkles, Trophy, Star, Clock, CheckCircle, Calendar,
  MapPin, Phone, Mail, TrendingUp, Award, Medal, Target,
  Zap, Timer, Users, BarChart3, Play, Pause, Camera
} from 'lucide-react';
import { useCleaners, useCleaningJobs, useCleanerLeaderboard, CleaningJob, User } from '@/lib/api';

type TabView = 'leaderboard' | 'jobs' | 'schedule';

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

export default function CleanersPage() {
  const { data: cleaners, isLoading: loadingCleaners } = useCleaners();
  const { data: jobs, isLoading: loadingJobs } = useCleaningJobs();
  const [activeTab, setActiveTab] = useState<TabView>('leaderboard');

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

  return (
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
                {cleaners?.length || 0} cleaners • {stats.active} active jobs
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/20 hover:shadow-xl transition-shadow"
            >
              <Calendar className="w-5 h-5" />
              Schedule Cleaning
            </motion.button>
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
            { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: 'text-blue-600' },
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
        <div className="flex gap-2 mb-6">
          {[
            { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
            { id: 'jobs', label: 'Active Jobs', icon: Sparkles },
            { id: 'schedule', label: 'Schedule', icon: Calendar },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabView)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#500000] text-white'
                  : 'bg-white text-[#2D2D2D]/70 hover:bg-[#500000]/10'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'leaderboard' && (
          <LeaderboardView cleaners={cleaners || []} isLoading={loadingCleaners} />
        )}

        {activeTab === 'jobs' && (
          <ActiveJobsView jobs={jobs || []} isLoading={loadingJobs} />
        )}

        {activeTab === 'schedule' && (
          <ScheduleView jobs={jobs || []} isLoading={loadingJobs} />
        )}
      </main>
    </div>
  );
}

// Leaderboard View
function LeaderboardView({ cleaners, isLoading }: { cleaners: User[]; isLoading: boolean }) {
  // Mock leaderboard data (would come from API)
  const leaderboard = cleaners.map((cleaner, index) => ({
    ...cleaner,
    rank: index + 1,
    score: Math.floor(Math.random() * 500) + 500,
    jobsCompleted: Math.floor(Math.random() * 50) + 10,
    avgRating: (Math.random() * 0.5 + 4.5).toFixed(2),
    streak: Math.floor(Math.random() * 10) + 1,
  })).sort((a, b) => b.score - a.score);

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
                    {cleaner.avgRating}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

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
                <div className="text-sm text-[#2D2D2D]/60">{cleaner.jobsCompleted} jobs completed</div>
              </div>

              <div className="hidden md:flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-[#C4A777]">
                    <Star className="w-4 h-4 fill-current" />
                    {cleaner.avgRating}
                  </div>
                  <div className="text-xs text-[#2D2D2D]/50">Rating</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-emerald-600">
                    <Zap className="w-4 h-4" />
                    {cleaner.streak}
                  </div>
                  <div className="text-xs text-[#2D2D2D]/50">Streak</div>
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

  // Group by date
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
