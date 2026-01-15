import React from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useApp } from '../contexts/AppContext';
import { format } from 'date-fns';

const revenueData = [
  { month: 'Jul', revenue: 3200, expenses: 800 },
  { month: 'Aug', revenue: 4100, expenses: 950 },
  { month: 'Sep', revenue: 3800, expenses: 720 },
  { month: 'Oct', revenue: 4500, expenses: 880 },
  { month: 'Nov', revenue: 4200, expenses: 850 },
  { month: 'Dec', revenue: 5100, expenses: 1100 },
];

const occupancyData = [
  { property: 'Aggie Getaway', occupancy: 85 },
  { property: 'Midland Oasis', occupancy: 72 },
  { property: 'Permian Paradise', occupancy: 68 },
];

const sourceData = [
  { name: 'Airbnb', value: 45, color: '#FF5A5F' },
  { name: 'VRBO', value: 30, color: '#3B5998' },
  { name: 'Direct', value: 15, color: '#500000' },
  { name: 'Other', value: 10, color: '#666666' },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const { stats, properties, bookings, cleaningJobs } = useApp();

  const statCards = [
    {
      title: 'Properties',
      value: stats?.totalProperties || 0,
      icon: Home,
      change: '+1 this month',
      positive: true,
    },
    {
      title: 'Active Bookings',
      value: stats?.activeBookings || 0,
      icon: Calendar,
      change: '+3 this week',
      positive: true,
    },
    {
      title: 'Monthly Revenue',
      value: `$${(stats?.monthlyRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      change: '+12% vs last month',
      positive: true,
    },
    {
      title: 'Occupancy Rate',
      value: `${stats?.occupancyRate || 0}%`,
      icon: TrendingUp,
      change: '+5% vs last month',
      positive: true,
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            variants={item}
            className="stat-card"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${
                  stat.positive ? 'text-green-300' : 'text-red-300'
                }`}
              >
                {stat.positive ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                <span>{stat.change}</span>
              </div>
            </div>
            <p className="text-white/70 text-sm mb-1">{stat.title}</p>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <motion.div variants={item} className="lg:col-span-2 card p-6">
          <h3 className="font-display text-lg font-semibold mb-4">
            Revenue Overview
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#500000" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#500000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#500000"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#DC2626"
                  strokeWidth={2}
                  fillOpacity={0.1}
                  fill="#DC2626"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Booking Sources */}
        <motion.div variants={item} className="card p-6">
          <h3 className="font-display text-lg font-semibold mb-4">
            Booking Sources
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {sourceData.map((source) => (
              <div key={source.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: source.color }}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {source.name} ({source.value}%)
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Occupancy by Property */}
        <motion.div variants={item} className="card p-6">
          <h3 className="font-display text-lg font-semibold mb-4">
            Property Occupancy
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupancyData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" domain={[0, 100]} stroke="#9CA3AF" />
                <YAxis dataKey="property" type="category" stroke="#9CA3AF" width={100} />
                <Tooltip />
                <Bar dataKey="occupancy" fill="#500000" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Upcoming Check-ins */}
        <motion.div variants={item} className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">
              Upcoming Check-ins
            </h3>
            <span className="badge badge-maroon">
              {stats?.todayCheckIns || 0} Today
            </span>
          </div>
          <div className="space-y-4">
            {bookings.slice(0, 3).map((booking) => {
              const property = properties.find((p) => p.id === booking.propertyId);
              return (
                <div
                  key={booking.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50"
                >
                  <div className="w-10 h-10 bg-maroon-100 dark:bg-maroon-900/30 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-maroon-900 dark:text-maroon-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {property?.name || 'Unknown Property'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(booking.checkIn), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      booking.status === 'confirmed'
                        ? 'badge-success'
                        : 'badge-warning'
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Today's Tasks */}
        <motion.div variants={item} className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">
              Today's Tasks
            </h3>
            <span className="badge badge-maroon">
              {cleaningJobs.length} Tasks
            </span>
          </div>
          <div className="space-y-3">
            {cleaningJobs.slice(0, 4).map((job) => {
              const property = properties.find((p) => p.id === job.propertyId);
              return (
                <div
                  key={job.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50"
                >
                  {job.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : job.status === 'in_progress' ? (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-gray-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {property?.name} - {job.type}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {job.scheduledTime}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
