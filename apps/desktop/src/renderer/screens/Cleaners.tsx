import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Plus,
  Phone,
  Mail,
  MapPin,
  Star,
  Clock,
  CheckCircle,
  Trophy,
  TrendingUp,
  Navigation,
  MoreVertical,
  Edit2,
  Trash2,
  User,
  DollarSign,
  Calendar,
  Award,
  Target,
  Zap,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { format, subDays, subHours } from 'date-fns';

// Cleaner data with performance metrics
interface CleanerWithStats {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  hourlyRate: number;
  status: 'active' | 'inactive' | 'on_job';
  assignedProperties: string[];
  totalJobsCompleted: number;
  avgRating: number;
  avgCleanTime: number; // minutes
  onTimeRate: number; // percentage
  monthlyEarnings: number;
  rank: number;
  currentLocation?: {
    lat: number;
    lng: number;
    address: string;
    timestamp: string;
  };
  recentJobs: {
    id: string;
    propertyName: string;
    date: string;
    duration: number;
    rating: number;
    status: 'completed' | 'in_progress';
  }[];
  gpsLogs: {
    id: string;
    timestamp: string;
    address: string;
    action: 'arrived' | 'started' | 'completed' | 'break' | 'travel';
    propertyName?: string;
  }[];
}

const mockCleaners: CleanerWithStats[] = [
  {
    id: '1',
    name: 'Maria Garcia',
    email: 'maria.g@email.com',
    phone: '(432) 555-1001',
    hourlyRate: 25,
    status: 'on_job',
    assignedProperties: ['1', '2', '5', '7', '11'],
    totalJobsCompleted: 247,
    avgRating: 4.9,
    avgCleanTime: 95,
    onTimeRate: 98,
    monthlyEarnings: 4250,
    rank: 1,
    currentLocation: {
      lat: 31.9973,
      lng: -102.0779,
      address: '456 Basin St, Midland, TX',
      timestamp: new Date().toISOString(),
    },
    recentJobs: [
      { id: '1', propertyName: 'Midland Oasis', date: new Date().toISOString(), duration: 110, rating: 5, status: 'in_progress' },
      { id: '2', propertyName: 'Executive Suite', date: subDays(new Date(), 1).toISOString(), duration: 85, rating: 5, status: 'completed' },
      { id: '3', propertyName: 'Ranch House Retreat', date: subDays(new Date(), 2).toISOString(), duration: 150, rating: 5, status: 'completed' },
    ],
    gpsLogs: [
      { id: '1', timestamp: new Date().toISOString(), address: '456 Basin St, Midland', action: 'arrived', propertyName: 'Midland Oasis' },
      { id: '2', timestamp: subHours(new Date(), 1).toISOString(), address: '456 Basin St, Midland', action: 'started', propertyName: 'Midland Oasis' },
      { id: '3', timestamp: subHours(new Date(), 3).toISOString(), address: '2200 Andrews Hwy, Midland', action: 'completed', propertyName: 'Executive Suite' },
      { id: '4', timestamp: subHours(new Date(), 5).toISOString(), address: '2200 Andrews Hwy, Midland', action: 'arrived', propertyName: 'Executive Suite' },
    ],
  },
  {
    id: '2',
    name: 'Rosa Martinez',
    email: 'rosa.m@email.com',
    phone: '(432) 555-1002',
    hourlyRate: 23,
    status: 'active',
    assignedProperties: ['3', '4', '8', '9', '15'],
    totalJobsCompleted: 198,
    avgRating: 4.8,
    avgCleanTime: 100,
    onTimeRate: 95,
    monthlyEarnings: 3800,
    rank: 2,
    currentLocation: {
      lat: 31.8457,
      lng: -102.3676,
      address: '789 Oil Field Rd, Odessa, TX',
      timestamp: subHours(new Date(), 2).toISOString(),
    },
    recentJobs: [
      { id: '1', propertyName: 'Permian Paradise', date: subDays(new Date(), 1).toISOString(), duration: 75, rating: 5, status: 'completed' },
      { id: '2', propertyName: 'Crew Quarters A', date: subDays(new Date(), 2).toISOString(), duration: 120, rating: 4, status: 'completed' },
    ],
    gpsLogs: [
      { id: '1', timestamp: subHours(new Date(), 2).toISOString(), address: '789 Oil Field Rd, Odessa', action: 'completed', propertyName: 'Permian Paradise' },
      { id: '2', timestamp: subHours(new Date(), 4).toISOString(), address: '789 Oil Field Rd, Odessa', action: 'arrived', propertyName: 'Permian Paradise' },
    ],
  },
  {
    id: '3',
    name: 'Ana Rodriguez',
    email: 'ana.r@email.com',
    phone: '(432) 555-1003',
    hourlyRate: 22,
    status: 'active',
    assignedProperties: ['6', '10', '13', '14', '19'],
    totalJobsCompleted: 156,
    avgRating: 4.7,
    avgCleanTime: 105,
    onTimeRate: 92,
    monthlyEarnings: 3200,
    rank: 3,
    recentJobs: [
      { id: '1', propertyName: 'Oil Patch Hideaway', date: subDays(new Date(), 1).toISOString(), duration: 95, rating: 5, status: 'completed' },
    ],
    gpsLogs: [
      { id: '1', timestamp: subHours(new Date(), 6).toISOString(), address: '555 Petroleum Dr, Midland', action: 'completed', propertyName: 'Oil Patch Hideaway' },
    ],
  },
  {
    id: '4',
    name: 'Carmen Lopez',
    email: 'carmen.l@email.com',
    phone: '(432) 555-1004',
    hourlyRate: 24,
    status: 'active',
    assignedProperties: ['12', '16', '17', '18'],
    totalJobsCompleted: 134,
    avgRating: 4.6,
    avgCleanTime: 110,
    onTimeRate: 88,
    monthlyEarnings: 2900,
    rank: 4,
    recentJobs: [
      { id: '1', propertyName: 'Petroleum Club Tower Suite', date: subDays(new Date(), 2).toISOString(), duration: 90, rating: 4, status: 'completed' },
    ],
    gpsLogs: [],
  },
  {
    id: '5',
    name: 'Sofia Hernandez',
    email: 'sofia.h@email.com',
    phone: '(432) 555-1005',
    hourlyRate: 21,
    status: 'inactive',
    assignedProperties: ['20', '21', '22'],
    totalJobsCompleted: 89,
    avgRating: 4.5,
    avgCleanTime: 115,
    onTimeRate: 85,
    monthlyEarnings: 1800,
    rank: 5,
    recentJobs: [],
    gpsLogs: [],
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Cleaners() {
  const { properties } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCleaner, setSelectedCleaner] = useState<CleanerWithStats | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'gps'>('overview');

  const filteredCleaners = mockCleaners.filter(
    (cleaner) =>
      cleaner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cleaner.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'on_job':
        return 'badge-info';
      case 'inactive':
        return 'badge-error';
      default:
        return 'badge-info';
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (rank === 2) return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    if (rank === 3) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'arrived':
        return <MapPin className="w-4 h-4 text-blue-500" />;
      case 'started':
        return <Zap className="w-4 h-4 text-green-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-maroon-900 dark:text-maroon-400" />;
      case 'break':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'travel':
        return <Navigation className="w-4 h-4 text-purple-500" />;
      default:
        return <MapPin className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Cleaner Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage {mockCleaners.length} cleaners across {properties.length} properties
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Cleaner
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'overview', label: 'Overview', icon: User },
          { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          { id: 'gps', label: 'GPS Logs', icon: Navigation },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-maroon-900 text-maroon-900 dark:border-maroon-400 dark:text-maroon-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search cleaners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <button className="btn-ghost flex items-center gap-2 border border-gray-200 dark:border-gray-600 rounded-xl px-4">
            <Filter className="w-5 h-5" />
            Filter
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cleaner List */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="lg:col-span-2 space-y-4"
          >
            {filteredCleaners.map((cleaner) => (
              <motion.div
                key={cleaner.id}
                variants={item}
                onClick={() => setSelectedCleaner(cleaner)}
                className={`card p-5 cursor-pointer transition-all hover:shadow-card-hover ${
                  selectedCleaner?.id === cleaner.id ? 'ring-2 ring-maroon-900 dark:ring-maroon-400' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 bg-maroon-100 dark:bg-maroon-900/30 rounded-full flex items-center justify-center">
                        <User className="w-7 h-7 text-maroon-900 dark:text-maroon-400" />
                      </div>
                      <span className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${getRankBadge(cleaner.rank)}`}>
                        #{cleaner.rank}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{cleaner.name}</h3>
                      <p className="text-sm text-gray-500">{cleaner.email}</p>
                      <span className={`badge mt-1 ${getStatusColor(cleaner.status)}`}>
                        {cleaner.status === 'on_job' ? 'On Job' : cleaner.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold">{cleaner.avgRating}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{cleaner.totalJobsCompleted} jobs</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Avg Time</p>
                    <p className="font-semibold">{cleaner.avgCleanTime}m</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">On-Time</p>
                    <p className="font-semibold text-green-600">{cleaner.onTimeRate}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Rate</p>
                    <p className="font-semibold">${cleaner.hourlyRate}/hr</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Monthly</p>
                    <p className="font-semibold text-maroon-900 dark:text-maroon-400">${cleaner.monthlyEarnings.toLocaleString()}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Cleaner Detail Panel */}
          <div className="card p-6">
            {selectedCleaner ? (
              <CleanerDetail cleaner={selectedCleaner} properties={properties} />
            ) : (
              <div className="text-center py-12 text-gray-500">
                <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Select a cleaner to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Jobs This Month</p>
              <p className="text-2xl font-bold mt-1">127</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Average Rating</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold">4.7</p>
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              </div>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">On-Time Rate</p>
              <p className="text-2xl font-bold text-green-600 mt-1">92%</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Payroll</p>
              <p className="text-2xl font-bold text-maroon-900 dark:text-maroon-400 mt-1">$15,950</p>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-display font-semibold text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Monthly Leaderboard
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {[...mockCleaners].sort((a, b) => a.rank - b.rank).map((cleaner, index) => (
                <motion.div
                  key={cleaner.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${getRankBadge(cleaner.rank)}`}>
                    {cleaner.rank === 1 && <Trophy className="w-5 h-5" />}
                    {cleaner.rank === 2 && <Award className="w-5 h-5" />}
                    {cleaner.rank === 3 && <Target className="w-5 h-5" />}
                    {cleaner.rank > 3 && cleaner.rank}
                  </div>
                  <div className="w-12 h-12 bg-maroon-100 dark:bg-maroon-900/30 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-maroon-900 dark:text-maroon-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{cleaner.name}</h4>
                    <p className="text-sm text-gray-500">{cleaner.totalJobsCompleted} jobs completed</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold">{cleaner.avgRating}</span>
                    </div>
                    <p className="text-sm text-maroon-900 dark:text-maroon-400 font-semibold">
                      ${cleaner.monthlyEarnings.toLocaleString()}
                    </p>
                  </div>
                  <div className="w-24">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${cleaner.onTimeRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{cleaner.onTimeRate}%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">On-time</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'gps' && (
        <div className="space-y-6">
          {/* Live Map Placeholder */}
          <div className="card p-6">
            <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-maroon-900 dark:text-maroon-400" />
              Live Locations
            </h3>
            <div className="h-64 bg-gradient-to-br from-maroon-900 to-maroon-950 rounded-xl flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                {/* Grid overlay */}
                <div className="w-full h-full" style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }} />
              </div>
              <div className="text-white/70 text-center z-10">
                <Navigation className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                <p className="font-medium">GPS Map Integration</p>
                <p className="text-sm text-white/50">Ready for Google Maps API</p>
              </div>
              {/* Cleaner markers */}
              {mockCleaners.filter(c => c.currentLocation).map((cleaner, i) => (
                <div
                  key={cleaner.id}
                  className="absolute w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg"
                  style={{
                    top: `${30 + i * 20}%`,
                    left: `${20 + i * 15}%`,
                    boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)'
                  }}
                  title={cleaner.name}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-4">
              {mockCleaners.filter(c => c.currentLocation).map((cleaner) => (
                <div key={cleaner.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">{cleaner.name}</span>
                  <span className="text-xs text-gray-500">{cleaner.currentLocation?.address}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GPS Activity Log */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-display font-semibold text-lg">GPS Activity Log</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {mockCleaners.flatMap(cleaner =>
                cleaner.gpsLogs.map(log => ({ ...log, cleanerName: cleaner.name }))
              ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((log) => (
                <div key={log.id + log.cleanerName} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      <span className="text-maroon-900 dark:text-maroon-400">{log.cleanerName}</span>
                      <span className="text-gray-500"> {log.action} </span>
                      {log.propertyName && <span className="font-medium">at {log.propertyName}</span>}
                    </p>
                    <p className="text-sm text-gray-500">{log.address}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {format(new Date(log.timestamp), 'h:mm a')}
                    <br />
                    <span className="text-xs">{format(new Date(log.timestamp), 'MMM d')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Cleaner Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-display font-semibold mb-6">
                Add New Cleaner
              </h2>

              <form className="space-y-4">
                <div>
                  <label className="label">Full Name</label>
                  <input type="text" className="input" placeholder="Maria Garcia" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" placeholder="maria@email.com" />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input type="tel" className="input" placeholder="(432) 555-0000" />
                  </div>
                </div>

                <div>
                  <label className="label">Hourly Rate ($)</label>
                  <input type="number" className="input" defaultValue={22} min={15} />
                </div>

                <div>
                  <label className="label">Assigned Properties</label>
                  <select multiple className="input h-32">
                    {properties.map((prop) => (
                      <option key={prop.id} value={prop.id}>{prop.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary flex-1">
                    Add Cleaner
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CleanerDetail({ cleaner, properties }: { cleaner: CleanerWithStats; properties: any[] }) {
  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="relative inline-block">
          <div className="w-20 h-20 bg-maroon-100 dark:bg-maroon-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-maroon-900 dark:text-maroon-400" />
          </div>
          <span className={`absolute -top-1 right-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            cleaner.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
            cleaner.rank === 2 ? 'bg-gray-100 text-gray-700' :
            cleaner.rank === 3 ? 'bg-amber-100 text-amber-700' :
            'bg-gray-50 text-gray-600'
          }`}>
            #{cleaner.rank}
          </span>
        </div>
        <h3 className="text-xl font-display font-semibold">{cleaner.name}</h3>
        <span className={`badge mt-2 ${
          cleaner.status === 'active' ? 'badge-success' :
          cleaner.status === 'on_job' ? 'badge-info' :
          'badge-error'
        }`}>
          {cleaner.status === 'on_job' ? 'On Job' : cleaner.status}
        </span>
      </div>

      {/* Contact Info */}
      <div className="space-y-3 mb-6">
        <a
          href={`mailto:${cleaner.email}`}
          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Mail className="w-5 h-5 text-gray-400" />
          <span className="text-sm">{cleaner.email}</span>
        </a>
        <a
          href={`tel:${cleaner.phone}`}
          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Phone className="w-5 h-5 text-gray-400" />
          <span className="text-sm">{cleaner.phone}</span>
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <CheckCircle className="w-5 h-5 mx-auto mb-2 text-gray-400" />
          <p className="text-2xl font-bold">{cleaner.totalJobsCompleted}</p>
          <p className="text-xs text-gray-500">Jobs Done</p>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <Star className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
          <p className="text-2xl font-bold">{cleaner.avgRating}</p>
          <p className="text-xs text-gray-500">Avg Rating</p>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <Clock className="w-5 h-5 mx-auto mb-2 text-gray-400" />
          <p className="text-2xl font-bold">{cleaner.avgCleanTime}m</p>
          <p className="text-xs text-gray-500">Avg Time</p>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <DollarSign className="w-5 h-5 mx-auto mb-2 text-gray-400" />
          <p className="text-2xl font-bold">${cleaner.monthlyEarnings}</p>
          <p className="text-xs text-gray-500">This Month</p>
        </div>
      </div>

      {/* Current Location */}
      {cleaner.currentLocation && (
        <div className="mb-6">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-green-500" />
            Current Location
          </h4>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <p className="text-sm">{cleaner.currentLocation.address}</p>
            <p className="text-xs text-gray-500 mt-1">
              Updated {format(new Date(cleaner.currentLocation.timestamp), 'h:mm a')}
            </p>
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      <div>
        <h4 className="font-semibold mb-3">Recent Jobs</h4>
        <div className="space-y-2">
          {cleaner.recentJobs.length > 0 ? (
            cleaner.recentJobs.map((job) => (
              <div
                key={job.id}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{job.propertyName}</p>
                  <span className={`badge ${job.status === 'completed' ? 'badge-success' : 'badge-info'}`}>
                    {job.status === 'in_progress' ? 'In Progress' : 'Done'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">
                    {format(new Date(job.date), 'MMM d, yyyy')}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{job.duration}m</span>
                    <div className="flex items-center">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs ml-0.5">{job.rating}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No recent jobs</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-6">
        <button className="btn-primary flex-1 flex items-center justify-center gap-2">
          <Phone className="w-4 h-4" />
          Call
        </button>
        <button className="btn-secondary px-4">
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
