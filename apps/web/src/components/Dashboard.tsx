'use client';

import React, { useState, useEffect } from 'react';
import { 
  Home, Users, Sparkles, DollarSign, Key, MessageSquare, 
  MapPin, Calendar, TrendingUp, Bell, Settings, Menu,
  ChevronDown, Star, Clock, CheckCircle, AlertTriangle
} from 'lucide-react';

// Stats Card Component
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  change, 
  changeType = 'positive' 
}: {
  icon: any;
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}) => (
  <div className="stat-card">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-cream-200 text-sm font-medium">{label}</p>
        <p className="text-3xl font-display font-bold mt-2">{value}</p>
        {change && (
          <p className={`text-sm mt-2 ${
            changeType === 'positive' ? 'text-green-300' :
            changeType === 'negative' ? 'text-red-300' : 'text-cream-200'
          }`}>
            {changeType === 'positive' ? '↑' : changeType === 'negative' ? '↓' : '→'} {change}
          </p>
        )}
      </div>
      <div className="bg-white/10 p-3 rounded-xl">
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

// Property Card Component
const PropertyCard = ({ property }: { property: any }) => (
  <div className="card group cursor-pointer">
    <div className="flex items-start gap-4">
      <div className="w-20 h-20 bg-gradient-to-br from-maroon-800 to-maroon-900 
                      rounded-xl flex items-center justify-center text-white 
                      font-display text-2xl font-bold group-hover:scale-105 
                      transition-transform">
        {property.name.charAt(0)}
      </div>
      <div className="flex-1">
        <h3 className="font-display text-lg font-semibold text-charcoal-800">
          {property.name}
        </h3>
        <p className="text-charcoal-500 text-sm mt-1">{property.address}</p>
        <div className="flex items-center gap-4 mt-3">
          <span className="badge badge-success">
            <CheckCircle className="w-3 h-3 mr-1" />
            Available
          </span>
          <span className="text-sm text-charcoal-500">
            {property.bedrooms} bed • {property.bathrooms} bath
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-2xl font-display font-bold text-maroon-800">
          ${property.monthlyRevenue?.toLocaleString() || '0'}
        </p>
        <p className="text-xs text-charcoal-500 mt-1">this month</p>
      </div>
    </div>
  </div>
);

// Active Cleaning Card
const CleaningCard = ({ job }: { job: any }) => (
  <div className="card">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${
          job.status === 'in_progress' ? 'bg-amber-400 animate-pulse' :
          job.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
        }`} />
        <div>
          <p className="font-medium text-charcoal-800">{job.property_name}</p>
          <p className="text-sm text-charcoal-500">{job.cleaner_name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`badge ${
          job.status === 'in_progress' ? 'badge-warning' :
          job.status === 'completed' ? 'badge-success' : 'badge-maroon'
        }`}>
          {job.status.replace('_', ' ')}
        </span>
        {job.photos?.length > 0 && (
          <span className="text-sm text-charcoal-500">
            📷 {job.photos.length}
          </span>
        )}
      </div>
    </div>
  </div>
);

// Guest Message Card
const MessageCard = ({ message }: { message: any }) => (
  <div className="card">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 bg-gold-100 rounded-full flex items-center 
                      justify-center text-gold-600 font-display font-bold">
        {message.guest_name?.charAt(0) || 'G'}
      </div>
      <div className="flex-1">
        <p className="font-medium text-charcoal-800">{message.guest_name}</p>
        <p className="text-sm text-charcoal-500 mt-1 line-clamp-2">
          {message.subject}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`badge ${
            message.status === 'pending_approval' ? 'badge-warning' :
            message.status === 'sent' ? 'badge-success' : 'badge-maroon'
          }`}>
            {message.status === 'pending_approval' ? 'Needs Approval' : message.status}
          </span>
        </div>
      </div>
    </div>
  </div>
);


// Main Dashboard Component
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Mock data - will connect to API
  const stats = {
    activeCleanings: 3,
    todayCheckIns: 5,
    todayCheckOuts: 4,
    monthlyRevenue: 47500,
    occupancyRate: 82,
    avgRating: 4.87,
    pendingMessages: 3,
    lowInventory: 2
  };

  const properties = [
    { id: 1, name: "Castleford Estate", address: "123 Oak Lane, Midland", bedrooms: 4, bathrooms: 3, monthlyRevenue: 6200 },
    { id: 2, name: "Petroleum Plaza Suite", address: "456 Main St, Midland", bedrooms: 2, bathrooms: 2, monthlyRevenue: 4100 },
    { id: 3, name: "Basin View Cottage", address: "789 Basin Blvd, Midland", bedrooms: 3, bathrooms: 2, monthlyRevenue: 5300 },
  ];

  const activeJobs = [
    { id: 1, property_name: "Castleford Estate", cleaner_name: "Maria Garcia", status: "in_progress", photos: ["1.jpg", "2.jpg"] },
    { id: 2, property_name: "Basin View Cottage", cleaner_name: "Rosa Martinez", status: "scheduled", photos: [] },
  ];

  const pendingMessages = [
    { id: 1, guest_name: "Sarah Mitchell", subject: "Welcome to Right at Home!", status: "pending_approval" },
    { id: 2, guest_name: "John Davis", subject: "Check-in Day Details", status: "pending_approval" },
  ];

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'properties', label: 'Properties', icon: Home },
    { id: 'guests', label: 'Guest CRM', icon: Users },
    { id: 'cleaners', label: 'Crew Tracking', icon: Sparkles },
    { id: 'locks', label: 'Smart Locks', icon: Key },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'finance', label: 'Financials', icon: DollarSign },
    { id: 'concierge', label: 'AI Concierge', icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-cream-100 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-cream-200 
                         transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-6 border-b border-cream-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-maroon-800 to-maroon-900 
                            rounded-xl flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-display font-bold text-maroon-800">Right at Home</h1>
                <p className="text-xs text-charcoal-500">BnB Management</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl 
                             transition-all duration-200 ${
                    activeTab === item.id
                      ? 'bg-maroon-800 text-white shadow-elegant'
                      : 'text-charcoal-600 hover:bg-cream-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {sidebarOpen && <span className="font-medium">{item.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-cream-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-100 rounded-full flex items-center 
                            justify-center text-gold-600 font-display font-bold">
              SP
            </div>
            {sidebarOpen && (
              <div>
                <p className="font-medium text-charcoal-800">Steven Palma</p>
                <p className="text-xs text-charcoal-500">Owner</p>
              </div>
            )}
          </div>
        </div>
      </aside>


      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white border-b border-cream-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-charcoal-800">
                {navItems.find(n => n.id === activeTab)?.label || 'Dashboard'}
              </h2>
              <p className="text-charcoal-500 text-sm mt-1">
                Midland, TX • 22 Properties
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <button className="relative p-2 text-charcoal-600 hover:text-maroon-800 
                                 transition-colors">
                <Bell className="w-6 h-6" />
                {stats.pendingMessages > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-maroon-800 
                                   text-white text-xs rounded-full flex items-center 
                                   justify-center">
                    {stats.pendingMessages}
                  </span>
                )}
              </button>
              {/* Settings */}
              <button className="p-2 text-charcoal-600 hover:text-maroon-800 
                                 transition-colors">
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8">
          {activeTab === 'overview' && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  icon={DollarSign}
                  label="Monthly Revenue"
                  value={`$${stats.monthlyRevenue.toLocaleString()}`}
                  change="12% vs last month"
                  changeType="positive"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Occupancy Rate"
                  value={`${stats.occupancyRate}%`}
                  change="5% vs last month"
                  changeType="positive"
                />
                <StatCard
                  icon={Star}
                  label="Avg Guest Rating"
                  value={stats.avgRating}
                  change="Excellent"
                  changeType="neutral"
                />
                <StatCard
                  icon={Calendar}
                  label="Today's Activity"
                  value={`${stats.todayCheckIns} in / ${stats.todayCheckOuts} out`}
                  change={`${stats.activeCleanings} cleanings active`}
                  changeType="neutral"
                />
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Properties */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-xl font-semibold text-charcoal-800">
                      Top Properties
                    </h3>
                    <button className="text-maroon-800 text-sm font-medium hover:underline">
                      View All →
                    </button>
                  </div>
                  <div className="space-y-4">
                    {properties.map((property) => (
                      <PropertyCard key={property.id} property={property} />
                    ))}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                  {/* Active Cleanings */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-xl font-semibold text-charcoal-800">
                        Active Cleanings
                      </h3>
                      <span className="badge badge-warning">
                        {stats.activeCleanings} in progress
                      </span>
                    </div>
                    <div className="space-y-3">
                      {activeJobs.map((job) => (
                        <CleaningCard key={job.id} job={job} />
                      ))}
                    </div>
                  </div>

                  {/* Pending Approvals */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-xl font-semibold text-charcoal-800">
                        Messages Pending Approval
                      </h3>
                      <span className="badge badge-maroon">
                        {stats.pendingMessages} pending
                      </span>
                    </div>
                    <div className="space-y-3">
                      {pendingMessages.map((msg) => (
                        <MessageCard key={msg.id} message={msg} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
