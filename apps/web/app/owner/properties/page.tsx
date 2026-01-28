'use client';

/**
 * Right at Home BnB - Owner Properties Page
 * Shows all properties owned by the logged-in owner with performance stats
 *
 * @author ECHO OMEGA PRIME
 * @owner Right at Home BnB - Midland, TX
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Building2, ChevronLeft, Users, DollarSign, TrendingUp, Star,
  Calendar, MapPin, Bed, Bath, Home, Eye, BarChart3, RefreshCw
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

// Types
interface PropertyStats {
  monthly_revenue: number;
  monthly_occupancy: number;
  ytd_revenue: number;
  avg_rating: number;
  total_bookings_ytd: number;
}

interface Property {
  id: string;
  name: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  current_booking?: {
    guest: string;
    check_out: string;
  } | null;
  stats?: PropertyStats;
}

// Mock data
const getMockProperties = (): Property[] => [
  {
    id: 'prop_1',
    name: 'Castleford Estate',
    address: '123 Castle Dr, Midland, TX 79705',
    bedrooms: 4,
    bathrooms: 3,
    status: 'ACTIVE',
    current_booking: { guest: 'John Smith', check_out: '2026-01-20' },
    stats: {
      monthly_revenue: 8500,
      monthly_occupancy: 0.85,
      ytd_revenue: 85000,
      avg_rating: 4.9,
      total_bookings_ytd: 52,
    },
  },
  {
    id: 'prop_2',
    name: 'Basin View Cottage',
    address: '456 Basin Rd, Midland, TX 79701',
    bedrooms: 3,
    bathrooms: 2,
    status: 'ACTIVE',
    current_booking: null,
    stats: {
      monthly_revenue: 5500,
      monthly_occupancy: 0.72,
      ytd_revenue: 55000,
      avg_rating: 4.7,
      total_bookings_ytd: 38,
    },
  },
  {
    id: 'prop_3',
    name: 'Desert Rose Villa',
    address: '789 Rose Ln, Midland, TX 79703',
    bedrooms: 5,
    bathrooms: 4,
    status: 'MAINTENANCE',
    current_booking: null,
    stats: {
      monthly_revenue: 4500,
      monthly_occupancy: 0.65,
      ytd_revenue: 45000,
      avg_rating: 4.8,
      total_bookings_ytd: 28,
    },
  },
];

export default function OwnerPropertiesPage() {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'maintenance'>('all');

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setProperties(getMockProperties());
      setLoading(false);
    };
    fetchProperties();
  }, []);

  const filteredProperties = properties.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'active') return p.status === 'ACTIVE';
    if (filter === 'maintenance') return p.status === 'MAINTENANCE';
    return true;
  });

  // Aggregate stats
  const totalRevenue = properties.reduce((sum, p) => sum + (p.stats?.monthly_revenue || 0), 0);
  const avgOccupancy = properties.reduce((sum, p) => sum + (p.stats?.monthly_occupancy || 0), 0) / properties.length;
  const totalBookings = properties.reduce((sum, p) => sum + (p.stats?.total_bookings_ytd || 0), 0);

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-screen">
          <RefreshCw className="w-8 h-8 animate-spin text-[#500000]" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="min-h-screen bg-[#F5F5F0]">
        {/* Header */}
        <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/owner">
                  <button className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5 text-[#500000]" />
                  </button>
                </Link>
                <div>
                  <h1 className="text-2xl font-['Playfair_Display'] font-bold text-[#500000]">
                    My Properties
                  </h1>
                  <p className="text-[#2D2D2D]/60 mt-1">
                    {properties.length} properties in your portfolio
                  </p>
                </div>
              </div>

              {/* Filter */}
              <div className="flex bg-[#F5F5F0] rounded-lg p-1">
                {(['all', 'active', 'maintenance'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                      filter === f
                        ? 'bg-[#500000] text-white'
                        : 'text-[#2D2D2D]/60 hover:text-[#500000]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <SummaryCard
              label="Total Properties"
              value={properties.length.toString()}
              icon={Building2}
              color="text-[#500000]"
            />
            <SummaryCard
              label="Monthly Revenue"
              value={`$${totalRevenue.toLocaleString()}`}
              icon={DollarSign}
              color="text-emerald-600"
            />
            <SummaryCard
              label="Avg Occupancy"
              value={`${(avgOccupancy * 100).toFixed(0)}%`}
              icon={Home}
              color="text-blue-600"
            />
            <SummaryCard
              label="YTD Bookings"
              value={totalBookings.toString()}
              icon={Calendar}
              color="text-[#C4A777]"
            />
          </div>

          {/* Properties Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map((property, index) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <PropertyCard property={property} />
              </motion.div>
            ))}
          </div>

          {filteredProperties.length === 0 && (
            <div className="text-center py-12 text-[#2D2D2D]/50">
              <Building2 className="w-12 h-12 mx-auto mb-4" />
              <p>No properties found matching your filter.</p>
            </div>
          )}
        </main>
      </div>
    </DashboardShell>
  );
}

// Summary Card Component
function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-[#2D2D2D]/5">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <div>
          <div className="text-lg font-bold text-[#2D2D2D]">{value}</div>
          <div className="text-xs text-[#2D2D2D]/60">{label}</div>
        </div>
      </div>
    </div>
  );
}

// Property Card Component
function PropertyCard({ property }: { property: Property }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#500000] to-[#722F37] p-4 text-white">
        <div className="flex items-center justify-between">
          <h3 className="font-['Playfair_Display'] font-semibold text-lg">{property.name}</h3>
          <span className={`text-xs px-2 py-1 rounded-full ${
            property.status === 'ACTIVE' ? 'bg-emerald-500' :
            property.status === 'MAINTENANCE' ? 'bg-amber-500' :
            'bg-gray-500'
          }`}>
            {property.status}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1 text-white/70 text-sm">
          <MapPin className="w-3 h-3" />
          {property.address}
        </div>
      </div>

      {/* Property Info */}
      <div className="p-4">
        <div className="flex items-center gap-4 text-sm text-[#2D2D2D]/60 mb-4">
          <span className="flex items-center gap-1">
            <Bed className="w-4 h-4" />
            {property.bedrooms} beds
          </span>
          <span className="flex items-center gap-1">
            <Bath className="w-4 h-4" />
            {property.bathrooms} baths
          </span>
        </div>

        {/* Current Booking */}
        {property.current_booking ? (
          <div className="bg-emerald-50 rounded-lg p-3 mb-4">
            <div className="text-xs text-emerald-600 font-medium mb-1">Currently Occupied</div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm text-[#2D2D2D]">
                <Users className="w-4 h-4" />
                {property.current_booking.guest}
              </span>
              <span className="text-xs text-[#2D2D2D]/60">
                Out: {property.current_booking.check_out}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-[#F5F5F0] rounded-lg p-3 mb-4">
            <div className="text-sm text-[#2D2D2D]/50">No current booking</div>
          </div>
        )}

        {/* Stats */}
        {property.stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F5F5F0] rounded-lg p-3">
              <div className="text-xs text-[#2D2D2D]/60">Monthly Revenue</div>
              <div className="text-lg font-bold text-emerald-600">
                ${property.stats.monthly_revenue.toLocaleString()}
              </div>
            </div>
            <div className="bg-[#F5F5F0] rounded-lg p-3">
              <div className="text-xs text-[#2D2D2D]/60">Occupancy</div>
              <div className="text-lg font-bold text-blue-600">
                {(property.stats.monthly_occupancy * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-[#F5F5F0] rounded-lg p-3">
              <div className="text-xs text-[#2D2D2D]/60">YTD Revenue</div>
              <div className="text-lg font-bold text-[#500000]">
                ${property.stats.ytd_revenue.toLocaleString()}
              </div>
            </div>
            <div className="bg-[#F5F5F0] rounded-lg p-3">
              <div className="text-xs text-[#2D2D2D]/60">Rating</div>
              <div className="text-lg font-bold text-[#C4A777] flex items-center gap-1">
                <Star className="w-4 h-4 fill-[#C4A777]" />
                {property.stats.avg_rating.toFixed(1)}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Link href={`/properties/${property.id}`} className="flex-1">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#F5F5F0] rounded-lg text-[#500000] text-sm font-medium hover:bg-[#500000]/10 transition-colors">
              <Eye className="w-4 h-4" />
              View Details
            </button>
          </Link>
          <Link href={`/owner/earnings?property=${property.id}`} className="flex-1">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#500000] rounded-lg text-white text-sm font-medium hover:bg-[#722F37] transition-colors">
              <BarChart3 className="w-4 h-4" />
              Earnings
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
