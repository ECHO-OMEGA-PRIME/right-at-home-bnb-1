import React, { useState, useMemo } from 'react';
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
} from 'date-fns';
import { useApp } from '../contexts/AppContext';
import type { CleaningJob, Property } from '@shared/types';

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  completed: 'bg-green-500',
  cancelled: 'bg-gray-500',
  issue: 'bg-red-500',
};

const typeLabels: Record<string, string> = {
  turnover: 'Turnover Clean',
  deep_clean: 'Deep Clean',
  inspection: 'Inspection',
  maintenance: 'Maintenance',
};

export default function CleaningSchedule() {
  const { cleaningJobs, properties } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedJob, setSelectedJob] = useState<CleaningJob | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = useMemo(
    () => eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    [currentDate]
  );

  const getJobsForDate = (date: Date) =>
    cleaningJobs.filter((job) =>
      isSameDay(new Date(job.scheduledDate), date)
    );

  const selectedDateJobs = selectedDate ? getJobsForDate(selectedDate) : [];

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Cleaning Schedule</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage turnover cleans and maintenance tasks
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Schedule Clean
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 card p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-display font-semibold min-w-[200px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button onClick={goToToday} className="btn-ghost px-4 py-2">
              Today
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-gray-500 py-2"
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
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    min-h-[80px] p-2 rounded-xl text-left transition-all
                    ${isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800' : 'bg-transparent opacity-40'}
                    ${isSelected ? 'ring-2 ring-maroon-900 dark:ring-maroon-400' : ''}
                    ${isDayToday ? 'bg-maroon-50 dark:bg-maroon-900/20' : ''}
                    hover:bg-gray-100 dark:hover:bg-gray-700
                  `}
                >
                  <span
                    className={`
                      text-sm font-medium
                      ${isDayToday ? 'text-maroon-900 dark:text-maroon-400 font-bold' : ''}
                    `}
                  >
                    {format(day, 'd')}
                  </span>

                  {/* Job Indicators */}
                  <div className="mt-1 space-y-1">
                    {dayJobs.slice(0, 3).map((job) => {
                      const property = properties.find(
                        (p) => p.id === job.propertyId
                      );
                      return (
                        <div
                          key={job.id}
                          className={`
                            text-xs px-2 py-1 rounded truncate text-white
                            ${statusColors[job.status]}
                          `}
                        >
                          {property?.name}
                        </div>
                      );
                    })}
                    {dayJobs.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{dayJobs.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            {Object.entries(statusColors).map(([status, color]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-sm text-gray-500 capitalize">
                  {status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Day Panel */}
        <div className="card p-6">
          {selectedDate ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-display font-semibold">
                    {format(selectedDate, 'EEEE')}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {format(selectedDate, 'MMMM d, yyyy')}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="p-2 bg-maroon-100 dark:bg-maroon-900/30 rounded-lg"
                >
                  <Plus className="w-5 h-5 text-maroon-900 dark:text-maroon-400" />
                </button>
              </div>

              {selectedDateJobs.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateJobs.map((job) => {
                    const property = properties.find(
                      (p) => p.id === job.propertyId
                    );
                    return (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => setSelectedJob(job)}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className={`w-2 h-2 rounded-full ${statusColors[job.status]}`}
                          />
                          <span className="text-sm font-medium capitalize">
                            {job.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <Home className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">
                            {property?.name || 'Unknown'}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {job.scheduledTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-4 h-4" />
                            {job.duration} min
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">
                            {typeLabels[job.type] || job.type}
                          </span>
                          <span className="text-xs text-gray-400">
                            {job.checklist.filter((c) => c.completed).length}/
                            {job.checklist.length} tasks
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No cleanings scheduled</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-4 text-sm text-maroon-900 dark:text-maroon-400 font-medium"
                  >
                    + Add a cleaning
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Select a date to view cleanings</p>
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
}

function JobDetailModal({
  job,
  property,
  onClose,
}: {
  job: CleaningJob;
  property?: Property;
  onClose: () => void;
}) {
  const [checklist, setChecklist] = useState(job.checklist);

  const toggleTask = (taskId: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === taskId ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const completedCount = checklist.filter((c) => c.completed).length;
  const progress = (completedCount / checklist.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-display font-semibold">
              {typeLabels[job.type]}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {property?.name}
            </p>
          </div>
          <span
            className={`badge ${
              job.status === 'completed'
                ? 'badge-success'
                : job.status === 'in_progress'
                ? 'badge-warning'
                : 'badge-info'
            }`}
          >
            {job.status.replace('_', ' ')}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium">
              {completedCount}/{checklist.length} tasks
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-maroon-900"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 mb-1">Date</p>
            <p className="font-medium">
              {format(new Date(job.scheduledDate), 'MMM d, yyyy')}
            </p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 mb-1">Time</p>
            <p className="font-medium">{job.scheduledTime}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 mb-1">Duration</p>
            <p className="font-medium">{job.duration} minutes</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 mb-1">Type</p>
            <p className="font-medium capitalize">{job.type.replace('_', ' ')}</p>
          </div>
        </div>

        {/* Checklist */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ListChecks className="w-5 h-5" />
            Checklist
          </h3>
          <div className="space-y-2">
            {checklist.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleTask(item.id)}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all
                  ${
                    item.completed
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-gray-50 dark:bg-gray-700/50'
                  }
                `}
              >
                {item.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0" />
                )}
                <span
                  className={item.completed ? 'line-through text-gray-400' : ''}
                >
                  {item.task}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">
            Close
          </button>
          <button className="btn-primary flex-1">
            {job.status === 'completed' ? 'View Report' : 'Mark Complete'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AddCleaningModal({
  properties,
  selectedDate,
  onClose,
}: {
  properties: Property[];
  selectedDate: Date | null;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-display font-semibold mb-6">
          Schedule Cleaning
        </h2>

        <form className="space-y-4">
          <div>
            <label className="label">Property</label>
            <select className="input">
              <option value="">Select a property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Type</label>
            <select className="input">
              <option value="turnover">Turnover Clean</option>
              <option value="deep_clean">Deep Clean</option>
              <option value="inspection">Inspection</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                defaultValue={
                  selectedDate
                    ? format(selectedDate, 'yyyy-MM-dd')
                    : format(new Date(), 'yyyy-MM-dd')
                }
              />
            </div>
            <div>
              <label className="label">Time</label>
              <input type="time" className="input" defaultValue="10:00" />
            </div>
          </div>

          <div>
            <label className="label">Duration (minutes)</label>
            <input
              type="number"
              className="input"
              defaultValue={120}
              min={30}
              step={30}
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              rows={3}
              className="input"
              placeholder="Any special instructions..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              Schedule
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
