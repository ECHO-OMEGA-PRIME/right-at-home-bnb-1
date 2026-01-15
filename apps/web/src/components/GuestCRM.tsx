'use client';

import React, { useState } from 'react';
import { 
  Users, Star, Calendar, MessageSquare, Tag, Search,
  Filter, ChevronDown, Phone, Mail, MapPin, Clock,
  Award, AlertTriangle, CheckCircle, Heart
} from 'lucide-react';

interface Guest {
  id: number;
  name: string;
  email: string;
  phone: string;
  platform: 'airbnb' | 'vrbo' | 'direct';
  firstStay: string;
  lastStay: string;
  totalStays: number;
  avgRating: number;
  totalSpent: number;
  tags: string[];
  notes: string;
  vip: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
}

const mockGuests: Guest[] = [
  {
    id: 1,
    name: "Sarah Mitchell",
    email: "sarah@email.com",
    phone: "(555) 010-1234",
    platform: "airbnb",
    firstStay: "2024-03-15",
    lastStay: "2024-12-10",
    totalStays: 4,
    avgRating: 4.9,
    totalSpent: 4800,
    tags: ["VIP", "Wine Lover", "Repeat Guest", "Late Checkout"],
    notes: "Prefers Castleford Estate. Loves the wine selection.",
    vip: true,
    sentiment: "positive"
  },
  {
    id: 2,
    name: "John Davis",
    email: "john.davis@oilco.com",
    phone: "(555) 010-5678",
    platform: "vrbo",
    firstStay: "2024-06-20",
    lastStay: "2024-11-05",
    totalStays: 2,
    avgRating: 4.7,
    totalSpent: 2400,
    tags: ["Business", "Repeat Guest", "Oil Industry"],
    notes: "Executive at Permian Basin Energy. Quiet, respectful.",
    vip: false,
    sentiment: "positive"
  },
  {
    id: 3,
    name: "Emily Chen",
    email: "emily.chen@gmail.com",
    phone: "(555) 010-9012",
    platform: "airbnb",
    firstStay: "2024-08-01",
    lastStay: "2024-08-05",
    totalStays: 1,
    avgRating: 5.0,
    totalSpent: 850,
    tags: ["First Timer", "Family"],
    notes: "Traveling with 2 kids. Very neat.",
    vip: false,
    sentiment: "positive"
  },
  {
    id: 4,
    name: "Robert Thompson",
    email: "rthompson@email.com",
    phone: "(555) 010-3456",
    platform: "direct",
    firstStay: "2024-02-10",
    lastStay: "2024-10-15",
    totalStays: 6,
    avgRating: 4.5,
    totalSpent: 7200,
    tags: ["VIP", "Repeat Guest", "Monthly Stays"],
    notes: "Contractor working in Midland. Reliable long-term guest.",
    vip: true,
    sentiment: "neutral"
  },
];

const GuestCard = ({ guest, onSelect }: { guest: Guest; onSelect: (g: Guest) => void }) => (
  <div 
    onClick={() => onSelect(guest)}
    className="card cursor-pointer hover:shadow-elegant transition-all group"
  >
    <div className="flex items-start gap-4">
      {/* Avatar */}
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center 
                       font-display text-xl font-bold transition-transform 
                       group-hover:scale-105 ${
        guest.vip 
          ? 'bg-gradient-to-br from-gold-400 to-gold-500 text-white' 
          : 'bg-maroon-100 text-maroon-800'
      }`}>
        {guest.name.split(' ').map(n => n[0]).join('')}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg font-semibold text-charcoal-800 truncate">
            {guest.name}
          </h3>
          {guest.vip && (
            <span className="badge badge-gold flex items-center gap-1">
              <Award className="w-3 h-3" /> VIP
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 mt-1 text-sm text-charcoal-500">
          <span className="flex items-center gap-1">
            <Mail className="w-3 h-3" /> {guest.email}
          </span>
          <span className="capitalize">{guest.platform}</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-3">
          {guest.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="badge badge-maroon text-xs">
              {tag}
            </span>
          ))}
          {guest.tags.length > 3 && (
            <span className="text-xs text-charcoal-500">
              +{guest.tags.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="text-right">
        <div className="flex items-center gap-1 justify-end">
          <Star className="w-4 h-4 text-gold-400 fill-gold-400" />
          <span className="font-display font-bold text-charcoal-800">
            {guest.avgRating}
          </span>
        </div>
        <p className="text-sm text-charcoal-500 mt-1">
          {guest.totalStays} {guest.totalStays === 1 ? 'stay' : 'stays'}
        </p>
        <p className="text-lg font-display font-bold text-maroon-800 mt-2">
          ${guest.totalSpent.toLocaleString()}
        </p>
      </div>
    </div>
  </div>
);


// Guest Detail Panel
const GuestDetail = ({ guest, onClose }: { guest: Guest; onClose: () => void }) => (
  <div className="card-elevated">
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center 
                         font-display text-2xl font-bold ${
          guest.vip 
            ? 'bg-gradient-to-br from-gold-400 to-gold-500 text-white' 
            : 'bg-maroon-100 text-maroon-800'
        }`}>
          {guest.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-charcoal-800">
            {guest.name}
          </h2>
          <p className="text-charcoal-500">
            Guest since {new Date(guest.firstStay).toLocaleDateString('en-US', { 
              month: 'long', year: 'numeric' 
            })}
          </p>
        </div>
      </div>
      <button 
        onClick={onClose}
        className="text-charcoal-400 hover:text-charcoal-600"
      >
        ✕
      </button>
    </div>

    {/* Contact Info */}
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="flex items-center gap-3 p-3 bg-cream-100 rounded-xl">
        <Mail className="w-5 h-5 text-maroon-800" />
        <div>
          <p className="text-xs text-charcoal-500">Email</p>
          <p className="font-medium text-charcoal-800">{guest.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 p-3 bg-cream-100 rounded-xl">
        <Phone className="w-5 h-5 text-maroon-800" />
        <div>
          <p className="text-xs text-charcoal-500">Phone</p>
          <p className="font-medium text-charcoal-800">{guest.phone}</p>
        </div>
      </div>
    </div>

    {/* Stats */}
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="text-center p-4 bg-maroon-50 rounded-xl">
        <p className="text-2xl font-display font-bold text-maroon-800">
          {guest.totalStays}
        </p>
        <p className="text-xs text-charcoal-500">Total Stays</p>
      </div>
      <div className="text-center p-4 bg-gold-50 rounded-xl">
        <p className="text-2xl font-display font-bold text-gold-600">
          {guest.avgRating}
        </p>
        <p className="text-xs text-charcoal-500">Avg Rating</p>
      </div>
      <div className="text-center p-4 bg-green-50 rounded-xl">
        <p className="text-2xl font-display font-bold text-green-700">
          ${guest.totalSpent.toLocaleString()}
        </p>
        <p className="text-xs text-charcoal-500">Lifetime Value</p>
      </div>
      <div className="text-center p-4 bg-cream-100 rounded-xl">
        <p className="text-2xl font-display font-bold text-charcoal-800 capitalize">
          {guest.platform}
        </p>
        <p className="text-xs text-charcoal-500">Platform</p>
      </div>
    </div>

    {/* Tags */}
    <div className="mb-6">
      <h4 className="font-medium text-charcoal-800 mb-3">Tags</h4>
      <div className="flex flex-wrap gap-2">
        {guest.tags.map((tag) => (
          <span key={tag} className="badge badge-maroon">
            {tag}
          </span>
        ))}
        <button className="badge bg-cream-200 text-charcoal-600 hover:bg-cream-300">
          + Add Tag
        </button>
      </div>
    </div>

    {/* Notes */}
    <div className="mb-6">
      <h4 className="font-medium text-charcoal-800 mb-3">Notes</h4>
      <div className="p-4 bg-cream-100 rounded-xl">
        <p className="text-charcoal-700">{guest.notes || 'No notes yet.'}</p>
      </div>
    </div>

    {/* Actions */}
    <div className="flex gap-3">
      <button className="btn-primary flex-1 flex items-center justify-center gap-2">
        <MessageSquare className="w-4 h-4" /> Send Message
      </button>
      <button className="btn-secondary flex-1 flex items-center justify-center gap-2">
        <Heart className="w-4 h-4" /> {guest.vip ? 'Remove VIP' : 'Make VIP'}
      </button>
    </div>
  </div>
);

// Main CRM Component
export default function GuestCRM() {
  const [guests] = useState<Guest[]>(mockGuests);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVIP, setFilterVIP] = useState(false);
  const [filterRepeat, setFilterRepeat] = useState(false);

  const filteredGuests = guests.filter(g => {
    if (searchQuery && !g.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterVIP && !g.vip) return false;
    if (filterRepeat && g.totalStays < 2) return false;
    return true;
  });

  const stats = {
    total: guests.length,
    vip: guests.filter(g => g.vip).length,
    repeat: guests.filter(g => g.totalStays >= 2).length,
    avgRating: (guests.reduce((sum, g) => sum + g.avgRating, 0) / guests.length).toFixed(2),
    totalRevenue: guests.reduce((sum, g) => sum + g.totalSpent, 0)
  };

  return (
    <div className="p-8">
      {/* Header Stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-cream-200 text-sm">Total Guests</p>
          <p className="text-3xl font-display font-bold mt-1">{stats.total}</p>
        </div>
        <div className="stat-card">
          <p className="text-cream-200 text-sm">VIP Guests</p>
          <p className="text-3xl font-display font-bold mt-1">{stats.vip}</p>
        </div>
        <div className="stat-card">
          <p className="text-cream-200 text-sm">Repeat Guests</p>
          <p className="text-3xl font-display font-bold mt-1">{stats.repeat}</p>
        </div>
        <div className="stat-card">
          <p className="text-cream-200 text-sm">Avg Rating</p>
          <p className="text-3xl font-display font-bold mt-1">{stats.avgRating}</p>
        </div>
        <div className="stat-card">
          <p className="text-cream-200 text-sm">Lifetime Revenue</p>
          <p className="text-3xl font-display font-bold mt-1">
            ${stats.totalRevenue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal-400" />
          <input
            type="text"
            placeholder="Search guests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-12"
          />
        </div>
        <button
          onClick={() => setFilterVIP(!filterVIP)}
          className={`btn-secondary ${filterVIP ? 'bg-maroon-800 text-white' : ''}`}
        >
          <Award className="w-4 h-4 mr-2" /> VIP Only
        </button>
        <button
          onClick={() => setFilterRepeat(!filterRepeat)}
          className={`btn-secondary ${filterRepeat ? 'bg-maroon-800 text-white' : ''}`}
        >
          <Users className="w-4 h-4 mr-2" /> Repeat Only
        </button>
      </div>

      {/* Guest List & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {filteredGuests.map((guest) => (
            <GuestCard 
              key={guest.id} 
              guest={guest} 
              onSelect={setSelectedGuest}
            />
          ))}
          {filteredGuests.length === 0 && (
            <div className="card text-center py-12">
              <Users className="w-12 h-12 text-charcoal-300 mx-auto mb-4" />
              <p className="text-charcoal-500">No guests found</p>
            </div>
          )}
        </div>
        <div>
          {selectedGuest ? (
            <GuestDetail guest={selectedGuest} onClose={() => setSelectedGuest(null)} />
          ) : (
            <div className="card text-center py-12">
              <Users className="w-12 h-12 text-charcoal-300 mx-auto mb-4" />
              <p className="text-charcoal-500">Select a guest to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
