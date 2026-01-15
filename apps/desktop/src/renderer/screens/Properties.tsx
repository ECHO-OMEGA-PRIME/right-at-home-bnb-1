import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  Home,
  MapPin,
  Bed,
  Bath,
  Users,
  DollarSign,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  Wifi,
  Car,
  Droplet,
  Dumbbell,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { Property } from '@shared/types';

const amenityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  WiFi: Wifi,
  Parking: Car,
  Pool: Droplet,
  Gym: Dumbbell,
};

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

export default function Properties() {
  const { properties } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredProperties = properties.filter(
    (property) =>
      property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'inactive':
        return 'badge-error';
      case 'maintenance':
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Properties</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your {properties.length} vacation rental properties
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Property
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search properties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex items-center gap-2 border border-gray-200 dark:border-gray-600 rounded-xl px-4">
              <Filter className="w-5 h-5" />
              Filter
            </button>
            <div className="flex border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${
                  viewMode === 'grid'
                    ? 'bg-maroon-900 text-white'
                    : 'bg-white dark:bg-gray-800'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${
                  viewMode === 'list'
                    ? 'bg-maroon-900 text-white'
                    : 'bg-white dark:bg-gray-800'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Properties Grid/List */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
            : 'space-y-4'
        }
      >
        {filteredProperties.map((property) => (
          <motion.div
            key={property.id}
            variants={item}
            className={`card card-hover overflow-hidden ${
              viewMode === 'list' ? 'flex' : ''
            }`}
          >
            {/* Property Image */}
            <div
              className={`relative ${
                viewMode === 'grid' ? 'h-48' : 'w-48 h-32'
              } bg-gradient-to-br from-maroon-900 to-maroon-950 flex items-center justify-center`}
            >
              <Home className="w-16 h-16 text-white/30" />
              <span
                className={`absolute top-3 left-3 badge ${getStatusColor(
                  property.status
                )}`}
              >
                {property.status}
              </span>
            </div>

            {/* Property Info */}
            <div className="p-5 flex-1">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display text-lg font-semibold">
                    {property.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {property.city}, {property.state}
                  </p>
                </div>
                <div className="relative group">
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      View Calendar
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Property Stats */}
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <span className="flex items-center gap-1">
                  <Bed className="w-4 h-4" />
                  {property.bedrooms}
                </span>
                <span className="flex items-center gap-1">
                  <Bath className="w-4 h-4" />
                  {property.bathrooms}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {property.maxGuests}
                </span>
              </div>

              {/* Amenities */}
              <div className="flex flex-wrap gap-2 mb-4">
                {property.amenities.slice(0, 4).map((amenity) => {
                  const Icon = amenityIcons[amenity] || Wifi;
                  return (
                    <span
                      key={amenity}
                      className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full"
                    >
                      <Icon className="w-3 h-3" />
                      {amenity}
                    </span>
                  );
                })}
              </div>

              {/* Price */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1 text-maroon-900 dark:text-maroon-400">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-2xl font-bold">{property.basePrice}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">
                    /night
                  </span>
                </div>
                <button className="btn-secondary py-2 px-4 text-sm">
                  Manage
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Empty State */}
      {filteredProperties.length === 0 && (
        <div className="text-center py-12">
          <Home className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">
            No properties found
          </h3>
          <p className="text-gray-500 dark:text-gray-500 mt-1">
            Try adjusting your search or add a new property
          </p>
        </div>
      )}

      {/* Add Property Modal */}
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
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-display font-semibold mb-6">
                Add New Property
              </h2>

              <form className="space-y-4">
                <div>
                  <label className="label">Property Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Aggie Getaway"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Address</label>
                  <input
                    type="text"
                    placeholder="Street address"
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">City</label>
                    <input type="text" placeholder="City" className="input" />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input type="text" placeholder="TX" className="input" />
                  </div>
                  <div>
                    <label className="label">ZIP</label>
                    <input type="text" placeholder="79701" className="input" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Bedrooms</label>
                    <input type="number" min="1" className="input" defaultValue={2} />
                  </div>
                  <div>
                    <label className="label">Bathrooms</label>
                    <input type="number" min="1" className="input" defaultValue={1} />
                  </div>
                  <div>
                    <label className="label">Max Guests</label>
                    <input type="number" min="1" className="input" defaultValue={4} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Base Price ($/night)</label>
                    <input type="number" min="0" className="input" defaultValue={150} />
                  </div>
                  <div>
                    <label className="label">Cleaning Fee ($)</label>
                    <input type="number" min="0" className="input" defaultValue={75} />
                  </div>
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Describe your property..."
                    className="input"
                  />
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
                    Add Property
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
