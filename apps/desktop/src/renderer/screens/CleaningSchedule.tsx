import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Home,
  ListChecks,
  Filter,
  Search,
  X,
  Sparkles,
  AlertTriangle,
  MapPin,
  Phone,
  FileText,
  Camera,
  Upload,
  Trash2,
  Edit3,
  MoreHorizontal,
  RefreshCw,
  Download,
  Send,
  Check,
  XCircle,
  Timer,
  Star,
  TrendingUp,
  Users,
  DollarSign,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
  addDays,
  differenceInDays,
  isBefore,
  isAfter,
} from 'date-fns';
import { useApp } from '../contexts/AppContext';
import { databaseService } from '../services/database';
import type { CleaningJob, Property } from '@shared/types';

// ECHO Design Standards Color Palette
const ECHO_COLORS = {
  echoBlack: '#0A0A0A',
  darkMagenta: '#8B008B',
  echoOrange: '#FF6B35',
  cobaltBlue: '#0047AB',
  matrixMagenta: '#9932CC',
  textPrimary: '#E0E0E0',
  textSecondary: '#A0A0A0',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

// Status configuration with ECHO colors
const statusConfig: Record<string, { color: string; bgColor: string; borderColor: string; label: string }> = {
  scheduled: {
    color: ECHO_COLORS.cobaltBlue,
    bgColor: 'rgba(0, 71, 171, 0.2)',
    borderColor: 'rgba(0, 71, 171, 0.5)',
    label: 'Scheduled'
  },
  in_progress: {
    color: ECHO_COLORS.echoOrange,
    bgColor: 'rgba(255, 107, 53, 0.2)',
    borderColor: 'rgba(255, 107, 53, 0.5)',
    label: 'In Progress'
  },
  completed: {
    color: ECHO_COLORS.success,
    bgColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
    label: 'Completed'
  },
  cancelled: {
    color: ECHO_COLORS.textSecondary,
    bgColor: 'rgba(160, 160, 160, 0.2)',
    borderColor: 'rgba(160, 160, 160, 0.5)',
    label: 'Cancelled'
  },
  issue: {
    color: ECHO_COLORS.error,
    bgColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    label: 'Issue Reported'
  },
};

const typeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  turnover: {
    icon: <RefreshCw className="w-4 h-4" />,
    label: 'Turnover Clean',
    color: ECHO_COLORS.darkMagenta
  },
  deep_clean: {
    icon: <Sparkles className="w-4 h-4" />,
    label: 'Deep Clean',
    color: ECHO_COLORS.matrixMagenta
  },
  inspection: {
    icon: <Search className="w-4 h-4" />,
    label: 'Inspection',
    color: ECHO_COLORS.cobaltBlue
  },
  maintenance: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'Maintenance',
    color: ECHO_COLORS.echoOrange
  },
};

// GlassCard Component with ECHO Design Standards
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  style?: React.CSSProperties;
}> = ({ children, className = '', glow = false, style = {} }) => (
  <div
    className={`rounded-xl ${className}`}
    style={{
      background: 'rgba(139, 0, 139, 0.08)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(139, 0, 139, 0.2)',
      boxShadow: glow
        ? `0 0 30px rgba(139, 0, 139, 0.15), 0 8px 32px rgba(0, 0, 0, 0.3)`
        : `0 8px 32px rgba(0, 0, 0, 0.3)`,
      ...style,
    }}
  >
    {children}
  </div>
);

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 }
};

export default function CleaningSchedule() {
  const { cleaningJobs: contextJobs, properties: contextProperties } = useApp();
  const [cleaningJobs, setCleaningJobs] = useState<CleaningJob[]>(contextJobs || []);
  const [properties, setProperties] = useState<Property[]>(contextProperties || []);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedJob, setSelectedJob] = useState<CleaningJob | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Load data from database
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [jobsData, propertiesData] = await Promise.all([
          databaseService.getCleaningJobs(),
          databaseService.getProperties(),
        ]);

        if (jobsData && jobsData.length > 0) {
          setCleaningJobs(jobsData);
        } else if (contextJobs && contextJobs.length > 0) {
          setCleaningJobs(contextJobs);
        }

        if (propertiesData && propertiesData.length > 0) {
          setProperties(propertiesData);
        } else if (contextProperties && contextProperties.length > 0) {
          setProperties(contextProperties);
        }
      } catch (error) {
        console.error('Failed to load cleaning data:', error);
        // Fallback to context data
        if (contextJobs) setCleaningJobs(contextJobs);
        if (contextProperties) setProperties(contextProperties);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [contextJobs, contextProperties]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = useMemo(
    () => eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    [calendarStart.toISOString(), calendarEnd.toISOString()]
  );

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    return cleaningJobs.filter((job) => {
      const property = properties.find((p) => p.id === job.propertyId);
      const matchesSearch = searchQuery === '' ||
        property?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      const matchesType = typeFilter === 'all' || job.type === typeFilter;
      const matchesProperty = propertyFilter === 'all' || job.propertyId === propertyFilter;

      return matchesSearch && matchesStatus && matchesType && matchesProperty;
    });
  }, [cleaningJobs, properties, searchQuery, statusFilter, typeFilter, propertyFilter]);

  const getJobsForDate = useCallback((date: Date) =>
    filteredJobs.filter((job) =>
      isSameDay(new Date(job.scheduledDate), date)
    ),
    [filteredJobs]
  );

  const selectedDateJobs = selectedDate ? getJobsForDate(selectedDate) : [];

  // Statistics
  const stats = useMemo(() => {
    const today = new Date();
    const thisWeekStart = startOfWeek(today);
    const thisWeekEnd = endOfWeek(today);

    const thisWeekJobs = cleaningJobs.filter((job) => {
      const jobDate = new Date(job.scheduledDate);
      return jobDate >= thisWeekStart && jobDate <= thisWeekEnd;
    });

    const completedThisWeek = thisWeekJobs.filter((j) => j.status === 'completed').length;
    const scheduledToday = cleaningJobs.filter((job) =>
      isSameDay(new Date(job.scheduledDate), today)
    ).length;
    const issueCount = cleaningJobs.filter((j) => j.status === 'issue').length;
    const inProgressCount = cleaningJobs.filter((j) => j.status === 'in_progress').length;

    return {
      totalThisWeek: thisWeekJobs.length,
      completedThisWeek,
      scheduledToday,
      issueCount,
      inProgressCount,
      completionRate: thisWeekJobs.length > 0
        ? Math.round((completedThisWeek / thisWeekJobs.length) * 100)
        : 0,
    };
  }, [cleaningJobs]);

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  return (
    <motion.div
      className="min-h-screen p-6"
      style={{ background: ECHO_COLORS.echoBlack }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6"
        variants={itemVariants}
      >
        <div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{
              color: ECHO_COLORS.textPrimary,
              textShadow: `0 0 20px rgba(139, 0, 139, 0.3)`
            }}
          >
            Cleaning Schedule
          </h1>
          <p style={{ color: ECHO_COLORS.textSecondary }}>
            Manage turnover cleans and maintenance tasks across all properties
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: ECHO_COLORS.textSecondary }}
            />
            <input
              type="text"
              placeholder="Search cleanings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg w-64 text-sm focus:outline-none focus:ring-2"
              style={{
                background: 'rgba(139, 0, 139, 0.1)',
                border: '1px solid rgba(139, 0, 139, 0.3)',
                color: ECHO_COLORS.textPrimary,
              }}
            />
          </div>

          {/* View Mode Toggle */}
          <GlassCard className="flex p-1">
            {(['month', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                style={{
                  background: viewMode === mode ? ECHO_COLORS.darkMagenta : 'transparent',
                  color: viewMode === mode ? '#fff' : ECHO_COLORS.textSecondary,
                }}
              >
                {mode}
              </button>
            ))}
          </GlassCard>

          {/* Schedule Clean Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              background: `linear-gradient(135deg, ${ECHO_COLORS.darkMagenta}, ${ECHO_COLORS.matrixMagenta})`,
              color: '#fff',
              boxShadow: `0 4px 15px rgba(139, 0, 139, 0.3)`,
            }}
          >
            <Plus className="w-5 h-5" />
            Schedule Clean
          </motion.button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        variants={itemVariants}
      >
        <GlassCard className="p-4" glow>
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-lg"
              style={{ background: 'rgba(139, 0, 139, 0.2)' }}
            >
              <CalendarIcon className="w-5 h-5" style={{ color: ECHO_COLORS.darkMagenta }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: ECHO_COLORS.textPrimary }}>
                {stats.scheduledToday}
              </p>
              <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                Today's Cleanings
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-lg"
              style={{ background: 'rgba(255, 107, 53, 0.2)' }}
            >
              <Timer className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: ECHO_COLORS.textPrimary }}>
                {stats.inProgressCount}
              </p>
              <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                In Progress
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-lg"
              style={{ background: 'rgba(16, 185, 129, 0.2)' }}
            >
              <TrendingUp className="w-5 h-5" style={{ color: ECHO_COLORS.success }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: ECHO_COLORS.textPrimary }}>
                {stats.completionRate}%
              </p>
              <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                This Week
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-lg"
              style={{ background: 'rgba(239, 68, 68, 0.2)' }}
            >
              <AlertCircle className="w-5 h-5" style={{ color: ECHO_COLORS.error }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: ECHO_COLORS.textPrimary }}>
                {stats.issueCount}
              </p>
              <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                Issues
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Filters Row */}
      <motion.div variants={itemVariants} className="mb-6">
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" style={{ color: ECHO_COLORS.textSecondary }} />
              <span className="text-sm font-medium" style={{ color: ECHO_COLORS.textSecondary }}>
                Filters:
              </span>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{
                background: 'rgba(139, 0, 139, 0.15)',
                border: '1px solid rgba(139, 0, 139, 0.3)',
                color: ECHO_COLORS.textPrimary,
              }}
            >
              <option value="all">All Statuses</option>
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{
                background: 'rgba(139, 0, 139, 0.15)',
                border: '1px solid rgba(139, 0, 139, 0.3)',
                color: ECHO_COLORS.textPrimary,
              }}
            >
              <option value="all">All Types</option>
              {Object.entries(typeConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>

            {/* Property Filter */}
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{
                background: 'rgba(139, 0, 139, 0.15)',
                border: '1px solid rgba(139, 0, 139, 0.3)',
                color: ECHO_COLORS.textPrimary,
              }}
            >
              <option value="all">All Properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{property.name}</option>
              ))}
            </select>

            {/* Clear Filters */}
            {(statusFilter !== 'all' || typeFilter !== 'all' || propertyFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setTypeFilter('all');
                  setPropertyFilter('all');
                  setSearchQuery('');
                }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  color: ECHO_COLORS.echoOrange,
                  background: 'rgba(255, 107, 53, 0.1)',
                }}
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* Main Content */}
      {viewMode === 'month' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <GlassCard className="p-6" glow>
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={goToPreviousMonth}
                    className="p-2 rounded-lg transition-colors"
                    style={{
                      background: 'rgba(139, 0, 139, 0.1)',
                      color: ECHO_COLORS.textPrimary,
                    }}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2
                    className="text-xl font-semibold min-w-[200px] text-center"
                    style={{ color: ECHO_COLORS.textPrimary }}
                  >
                    {format(currentDate, 'MMMM yyyy')}
                  </h2>
                  <button
                    onClick={goToNextMonth}
                    className="p-2 rounded-lg transition-colors"
                    style={{
                      background: 'rgba(139, 0, 139, 0.1)',
                      color: ECHO_COLORS.textPrimary,
                    }}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={goToToday}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: 'rgba(139, 0, 139, 0.15)',
                    color: ECHO_COLORS.textPrimary,
                    border: '1px solid rgba(139, 0, 139, 0.3)',
                  }}
                >
                  Today
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Day Headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium py-2"
                    style={{ color: ECHO_COLORS.textSecondary }}
                  >
                    {day}
                  </div>
                ))}

                {/* Calendar Days */}
                {calendarDays.map((day) => {
                  const dayJobs = getJobsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isDayToday = isToday(day);

                  return (
                    <motion.button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      whileHover={{ scale: 1.02 }}
                      className="min-h-[90px] p-2 rounded-xl text-left transition-all"
                      style={{
                        background: isSelected
                          ? 'rgba(139, 0, 139, 0.3)'
                          : isDayToday
                          ? 'rgba(255, 107, 53, 0.15)'
                          : isCurrentMonth
                          ? 'rgba(139, 0, 139, 0.05)'
                          : 'transparent',
                        border: isSelected
                          ? `2px solid ${ECHO_COLORS.darkMagenta}`
                          : isDayToday
                          ? `1px solid ${ECHO_COLORS.echoOrange}`
                          : '1px solid transparent',
                        opacity: isCurrentMonth ? 1 : 0.4,
                      }}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: isDayToday
                            ? ECHO_COLORS.echoOrange
                            : ECHO_COLORS.textPrimary,
                        }}
                      >
                        {format(day, 'd')}
                      </span>

                      {/* Job Indicators */}
                      <div className="mt-1 space-y-1">
                        {dayJobs.slice(0, 2).map((job) => {
                          const property = properties.find(
                            (p) => p.id === job.propertyId
                          );
                          const status = statusConfig[job.status];
                          return (
                            <div
                              key={job.id}
                              className="text-xs px-2 py-1 rounded truncate"
                              style={{
                                background: status?.bgColor || 'rgba(139, 0, 139, 0.2)',
                                color: status?.color || ECHO_COLORS.textPrimary,
                                border: `1px solid ${status?.borderColor || 'rgba(139, 0, 139, 0.3)'}`,
                              }}
                            >
                              {property?.name || 'Unknown'}
                            </div>
                          );
                        })}
                        {dayJobs.length > 2 && (
                          <div
                            className="text-xs px-2"
                            style={{ color: ECHO_COLORS.textSecondary }}
                          >
                            +{dayJobs.length - 2} more
                          </div>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-6 pt-4" style={{ borderTop: '1px solid rgba(139, 0, 139, 0.2)' }}>
                {Object.entries(statusConfig).map(([status, config]) => (
                  <div key={status} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: config.color }}
                    />
                    <span className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                      {config.label}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          {/* Selected Day Panel */}
          <motion.div variants={itemVariants}>
            <GlassCard className="p-6 h-full">
              {selectedDate ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3
                        className="text-lg font-semibold"
                        style={{ color: ECHO_COLORS.textPrimary }}
                      >
                        {format(selectedDate, 'EEEE')}
                      </h3>
                      <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                        {format(selectedDate, 'MMMM d, yyyy')}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowAddModal(true)}
                      className="p-2 rounded-lg"
                      style={{
                        background: 'rgba(139, 0, 139, 0.2)',
                        color: ECHO_COLORS.darkMagenta,
                      }}
                    >
                      <Plus className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {selectedDateJobs.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDateJobs.map((job) => {
                        const property = properties.find(
                          (p) => p.id === job.propertyId
                        );
                        const status = statusConfig[job.status];
                        const type = typeConfig[job.type];

                        return (
                          <motion.div
                            key={job.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.02 }}
                            className="p-4 rounded-xl cursor-pointer transition-all"
                            style={{
                              background: 'rgba(139, 0, 139, 0.1)',
                              border: '1px solid rgba(139, 0, 139, 0.2)',
                            }}
                            onClick={() => setSelectedJob(job)}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ background: status?.color }}
                              />
                              <span
                                className="text-sm font-medium"
                                style={{ color: status?.color }}
                              >
                                {status?.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                              <Home className="w-4 h-4" style={{ color: ECHO_COLORS.textSecondary }} />
                              <span
                                className="font-medium"
                                style={{ color: ECHO_COLORS.textPrimary }}
                              >
                                {property?.name || 'Unknown'}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {job.scheduledTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <Timer className="w-4 h-4" />
                                {job.duration} min
                              </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <span
                                className="text-xs px-2 py-1 rounded-full flex items-center gap-1"
                                style={{
                                  background: 'rgba(139, 0, 139, 0.2)',
                                  color: type?.color || ECHO_COLORS.textPrimary,
                                }}
                              >
                                {type?.icon}
                                {type?.label || job.type}
                              </span>
                              <span className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>
                                {job.checklist?.filter((c) => c.completed).length || 0}/
                                {job.checklist?.length || 0} tasks
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <CalendarIcon
                        className="w-12 h-12 mx-auto mb-4"
                        style={{ color: 'rgba(139, 0, 139, 0.3)' }}
                      />
                      <p style={{ color: ECHO_COLORS.textSecondary }}>
                        No cleanings scheduled
                      </p>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-4 text-sm font-medium"
                        style={{ color: ECHO_COLORS.darkMagenta }}
                      >
                        + Add a cleaning
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CalendarIcon
                    className="w-12 h-12 mx-auto mb-4"
                    style={{ color: 'rgba(139, 0, 139, 0.3)' }}
                  />
                  <p style={{ color: ECHO_COLORS.textSecondary }}>
                    Select a date to view cleanings
                  </p>
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>
      ) : (
        /* List View */
        <motion.div variants={itemVariants}>
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'rgba(139, 0, 139, 0.1)' }}>
                    <th className="text-left px-6 py-4 text-sm font-medium" style={{ color: ECHO_COLORS.textSecondary }}>
                      Property
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium" style={{ color: ECHO_COLORS.textSecondary }}>
                      Type
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium" style={{ color: ECHO_COLORS.textSecondary }}>
                      Date & Time
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium" style={{ color: ECHO_COLORS.textSecondary }}>
                      Duration
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium" style={{ color: ECHO_COLORS.textSecondary }}>
                      Status
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium" style={{ color: ECHO_COLORS.textSecondary }}>
                      Progress
                    </th>
                    <th className="text-right px-6 py-4 text-sm font-medium" style={{ color: ECHO_COLORS.textSecondary }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs
                    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
                    .map((job, index) => {
                      const property = properties.find((p) => p.id === job.propertyId);
                      const status = statusConfig[job.status];
                      const type = typeConfig[job.type];
                      const completedTasks = job.checklist?.filter((c) => c.completed).length || 0;
                      const totalTasks = job.checklist?.length || 0;
                      const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

                      return (
                        <motion.tr
                          key={job.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="cursor-pointer transition-colors"
                          style={{
                            borderBottom: '1px solid rgba(139, 0, 139, 0.1)',
                          }}
                          onClick={() => setSelectedJob(job)}
                          whileHover={{ background: 'rgba(139, 0, 139, 0.05)' }}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ background: 'rgba(139, 0, 139, 0.2)' }}
                              >
                                <Home className="w-5 h-5" style={{ color: ECHO_COLORS.darkMagenta }} />
                              </div>
                              <span
                                className="font-medium"
                                style={{ color: ECHO_COLORS.textPrimary }}
                              >
                                {property?.name || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className="flex items-center gap-2 text-sm"
                              style={{ color: type?.color || ECHO_COLORS.textPrimary }}
                            >
                              {type?.icon}
                              {type?.label || job.type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div style={{ color: ECHO_COLORS.textPrimary }}>
                              {format(new Date(job.scheduledDate), 'MMM d, yyyy')}
                            </div>
                            <div className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                              {job.scheduledTime}
                            </div>
                          </td>
                          <td className="px-6 py-4" style={{ color: ECHO_COLORS.textPrimary }}>
                            {job.duration} min
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className="px-3 py-1 rounded-full text-xs font-medium"
                              style={{
                                background: status?.bgColor,
                                color: status?.color,
                                border: `1px solid ${status?.borderColor}`,
                              }}
                            >
                              {status?.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="w-32">
                              <div className="flex items-center justify-between text-xs mb-1" style={{ color: ECHO_COLORS.textSecondary }}>
                                <span>{completedTasks}/{totalTasks}</span>
                                <span>{Math.round(progress)}%</span>
                              </div>
                              <div
                                className="h-2 rounded-full overflow-hidden"
                                style={{ background: 'rgba(139, 0, 139, 0.2)' }}
                              >
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${progress}%`,
                                    background: progress === 100
                                      ? ECHO_COLORS.success
                                      : ECHO_COLORS.darkMagenta,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedJob(job);
                              }}
                              className="p-2 rounded-lg transition-colors"
                              style={{
                                background: 'rgba(139, 0, 139, 0.1)',
                                color: ECHO_COLORS.textSecondary,
                              }}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                </tbody>
              </table>

              {filteredJobs.length === 0 && (
                <div className="text-center py-12">
                  <ListChecks
                    className="w-12 h-12 mx-auto mb-4"
                    style={{ color: 'rgba(139, 0, 139, 0.3)' }}
                  />
                  <p style={{ color: ECHO_COLORS.textSecondary }}>
                    No cleaning jobs found
                  </p>
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Job Detail Modal */}
      <AnimatePresence>
        {selectedJob && (
          <JobDetailModal
            job={selectedJob}
            property={properties.find((p) => p.id === selectedJob.propertyId)}
            onClose={() => setSelectedJob(null)}
          />
        )}
      </AnimatePresence>

      {/* Add Cleaning Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddCleaningModal
            properties={properties}
            selectedDate={selectedDate}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Job Detail Modal Component
function JobDetailModal({
  job,
  property,
  onClose,
}: {
  job: CleaningJob;
  property?: Property;
  onClose: () => void;
}) {
  const [checklist, setChecklist] = useState(job.checklist || []);
  const [notes, setNotes] = useState(job.notes || '');
  const [isEditing, setIsEditing] = useState(false);

  const toggleTask = (taskId: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === taskId ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const completedCount = checklist.filter((c) => c.completed).length;
  const progress = checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0;
  const status = statusConfig[job.status];
  const type = typeConfig[job.type];

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{
          background: ECHO_COLORS.echoBlack,
          border: '1px solid rgba(139, 0, 139, 0.3)',
          boxShadow: `0 0 50px rgba(139, 0, 139, 0.2)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-6"
          style={{
            borderBottom: '1px solid rgba(139, 0, 139, 0.2)',
            background: 'rgba(139, 0, 139, 0.05)',
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="flex items-center gap-2"
                  style={{ color: type?.color || ECHO_COLORS.textPrimary }}
                >
                  {type?.icon}
                  <span className="text-lg font-semibold">
                    {type?.label || job.type}
                  </span>
                </span>
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: status?.bgColor,
                    color: status?.color,
                    border: `1px solid ${status?.borderColor}`,
                  }}
                >
                  {status?.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4" style={{ color: ECHO_COLORS.textSecondary }} />
                <span style={{ color: ECHO_COLORS.textSecondary }}>
                  {property?.name || 'Unknown Property'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="p-2 rounded-lg transition-colors"
                style={{
                  background: 'rgba(139, 0, 139, 0.1)',
                  color: ECHO_COLORS.textSecondary,
                }}
              >
                <Edit3 className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-colors"
                style={{
                  background: 'rgba(139, 0, 139, 0.1)',
                  color: ECHO_COLORS.textSecondary,
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span style={{ color: ECHO_COLORS.textSecondary }}>Progress</span>
              <span style={{ color: ECHO_COLORS.textPrimary }} className="font-medium">
                {completedCount}/{checklist.length} tasks
              </span>
            </div>
            <div
              className="h-3 rounded-full overflow-hidden"
              style={{ background: 'rgba(139, 0, 139, 0.2)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: progress === 100
                    ? ECHO_COLORS.success
                    : `linear-gradient(90deg, ${ECHO_COLORS.darkMagenta}, ${ECHO_COLORS.matrixMagenta})`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5" style={{ color: ECHO_COLORS.darkMagenta }} />
                <div>
                  <p className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>Date</p>
                  <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                    {format(new Date(job.scheduledDate), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                <div>
                  <p className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>Time</p>
                  <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                    {job.scheduledTime}
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5" style={{ color: ECHO_COLORS.cobaltBlue }} />
                <div>
                  <p className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>Duration</p>
                  <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                    {job.duration} minutes
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                {type?.icon && React.cloneElement(type.icon as React.ReactElement, {
                  className: 'w-5 h-5',
                  style: { color: type.color }
                })}
                <div>
                  <p className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>Type</p>
                  <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                    {type?.label || job.type}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Checklist */}
          <div className="mb-6">
            <h3
              className="font-semibold mb-4 flex items-center gap-2"
              style={{ color: ECHO_COLORS.textPrimary }}
            >
              <ListChecks className="w-5 h-5" style={{ color: ECHO_COLORS.darkMagenta }} />
              Checklist
            </h3>
            <div className="space-y-2">
              {checklist.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => toggleTask(item.id)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all"
                  style={{
                    background: item.completed
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(139, 0, 139, 0.05)',
                    border: item.completed
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid rgba(139, 0, 139, 0.1)',
                  }}
                >
                  {item.completed ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: ECHO_COLORS.success }} />
                  ) : (
                    <div
                      className="w-5 h-5 border-2 rounded-full flex-shrink-0"
                      style={{ borderColor: 'rgba(139, 0, 139, 0.4)' }}
                    />
                  )}
                  <span
                    style={{
                      color: item.completed ? ECHO_COLORS.textSecondary : ECHO_COLORS.textPrimary,
                      textDecoration: item.completed ? 'line-through' : 'none',
                    }}
                  >
                    {item.task}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Notes */}
          {(notes || isEditing) && (
            <div className="mb-6">
              <h3
                className="font-semibold mb-3 flex items-center gap-2"
                style={{ color: ECHO_COLORS.textPrimary }}
              >
                <FileText className="w-5 h-5" style={{ color: ECHO_COLORS.darkMagenta }} />
                Notes
              </h3>
              {isEditing ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full p-4 rounded-xl focus:outline-none focus:ring-2"
                  style={{
                    background: 'rgba(139, 0, 139, 0.1)',
                    border: '1px solid rgba(139, 0, 139, 0.3)',
                    color: ECHO_COLORS.textPrimary,
                    resize: 'none',
                  }}
                  placeholder="Add notes..."
                />
              ) : (
                <GlassCard className="p-4">
                  <p style={{ color: ECHO_COLORS.textSecondary }}>
                    {notes || 'No notes added'}
                  </p>
                </GlassCard>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-medium transition-colors"
              style={{
                background: 'rgba(139, 0, 139, 0.1)',
                border: '1px solid rgba(139, 0, 139, 0.3)',
                color: ECHO_COLORS.textPrimary,
              }}
            >
              Close
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              style={{
                background: progress === 100
                  ? ECHO_COLORS.success
                  : `linear-gradient(135deg, ${ECHO_COLORS.darkMagenta}, ${ECHO_COLORS.matrixMagenta})`,
                color: '#fff',
                boxShadow: `0 4px 15px rgba(139, 0, 139, 0.3)`,
              }}
            >
              {progress === 100 ? (
                <>
                  <Check className="w-5 h-5" />
                  View Report
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Mark Complete
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Add Cleaning Modal Component
function AddCleaningModal({
  properties,
  selectedDate,
  onClose,
}: {
  properties: Property[];
  selectedDate: Date | null;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    propertyId: '',
    type: 'turnover',
    date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: '10:00',
    duration: 120,
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create cleaning job via database service
      await databaseService.createCleaningJob({
        propertyId: formData.propertyId,
        type: formData.type as any,
        scheduledDate: formData.date,
        scheduledTime: formData.time,
        duration: formData.duration,
        notes: formData.notes,
        status: 'scheduled',
        checklist: getDefaultChecklist(formData.type),
      });

      onClose();
    } catch (error) {
      console.error('Failed to create cleaning job:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDefaultChecklist = (type: string) => {
    const baseChecklist = [
      { id: '1', task: 'Strip and remake all beds', completed: false },
      { id: '2', task: 'Clean all bathrooms', completed: false },
      { id: '3', task: 'Vacuum/mop all floors', completed: false },
      { id: '4', task: 'Clean kitchen appliances', completed: false },
      { id: '5', task: 'Wipe all surfaces', completed: false },
      { id: '6', task: 'Take out trash', completed: false },
      { id: '7', task: 'Restock supplies', completed: false },
      { id: '8', task: 'Check for damages', completed: false },
    ];

    if (type === 'deep_clean') {
      return [
        ...baseChecklist,
        { id: '9', task: 'Clean inside oven', completed: false },
        { id: '10', task: 'Clean inside refrigerator', completed: false },
        { id: '11', task: 'Wash windows', completed: false },
        { id: '12', task: 'Deep clean carpets', completed: false },
      ];
    }

    if (type === 'inspection') {
      return [
        { id: '1', task: 'Check all locks and security', completed: false },
        { id: '2', task: 'Test smoke detectors', completed: false },
        { id: '3', task: 'Check HVAC system', completed: false },
        { id: '4', task: 'Inspect plumbing', completed: false },
        { id: '5', task: 'Check for pest issues', completed: false },
        { id: '6', task: 'Document any damages', completed: false },
      ];
    }

    return baseChecklist;
  };

  const inputStyle = {
    background: 'rgba(139, 0, 139, 0.1)',
    border: '1px solid rgba(139, 0, 139, 0.3)',
    color: ECHO_COLORS.textPrimary,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-lg rounded-2xl"
        style={{
          background: ECHO_COLORS.echoBlack,
          border: '1px solid rgba(139, 0, 139, 0.3)',
          boxShadow: `0 0 50px rgba(139, 0, 139, 0.2)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-6 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(139, 0, 139, 0.2)' }}
        >
          <h2
            className="text-xl font-semibold"
            style={{ color: ECHO_COLORS.textPrimary }}
          >
            Schedule Cleaning
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{
              background: 'rgba(139, 0, 139, 0.1)',
              color: ECHO_COLORS.textSecondary,
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Property Select */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: ECHO_COLORS.textSecondary }}
            >
              Property *
            </label>
            <select
              required
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
              style={{
                ...inputStyle,
                focusRingColor: ECHO_COLORS.darkMagenta,
              }}
            >
              <option value="">Select a property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Select */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: ECHO_COLORS.textSecondary }}
            >
              Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(typeConfig).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: key })}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all"
                  style={{
                    background: formData.type === key
                      ? 'rgba(139, 0, 139, 0.2)'
                      : 'rgba(139, 0, 139, 0.05)',
                    border: formData.type === key
                      ? `2px solid ${ECHO_COLORS.darkMagenta}`
                      : '1px solid rgba(139, 0, 139, 0.2)',
                  }}
                >
                  <span style={{ color: config.color }}>{config.icon}</span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: ECHO_COLORS.textPrimary }}
                  >
                    {config.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: ECHO_COLORS.textSecondary }}
              >
                Date *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: ECHO_COLORS.textSecondary }}
              >
                Time *
              </label>
              <input
                type="time"
                required
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: ECHO_COLORS.textSecondary }}
            >
              Duration (minutes)
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 120 })}
              min={30}
              step={30}
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>

          {/* Notes */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: ECHO_COLORS.textSecondary }}
            >
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 resize-none"
              style={inputStyle}
              placeholder="Any special instructions..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-medium transition-colors"
              style={{
                background: 'rgba(139, 0, 139, 0.1)',
                border: '1px solid rgba(139, 0, 139, 0.3)',
                color: ECHO_COLORS.textPrimary,
              }}
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={isSubmitting || !formData.propertyId}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${ECHO_COLORS.darkMagenta}, ${ECHO_COLORS.matrixMagenta})`,
                color: '#fff',
                boxShadow: `0 4px 15px rgba(139, 0, 139, 0.3)`,
              }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <CalendarIcon className="w-5 h-5" />
                  Schedule
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
