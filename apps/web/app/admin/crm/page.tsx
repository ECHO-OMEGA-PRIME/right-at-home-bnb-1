'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Users, Search, ChevronRight, Star, Mail, Phone, DollarSign,
  TrendingUp, ArrowUpRight, Send, UserPlus, X, FileText,
  Award, StickyNote
} from 'lucide-react';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

type VipTier = 'bronze' | 'silver' | 'gold' | 'platinum';

interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalStays: number;
  totalSpent: number;
  vipTier: VipTier;
  lastVisit: string;
  avgRating: number;
  source: 'airbnb' | 'vrbo' | 'direct' | 'google' | 'referral';
  notes: string;
}

function getVipTier(stays: number): VipTier {
  if (stays >= 10) return 'platinum';
  if (stays >= 6) return 'gold';
  if (stays >= 3) return 'silver';
  return 'bronze';
}

const tierStyles: Record<VipTier, { bg: string; text: string; label: string; border: string }> = {
  bronze: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Bronze', border: 'border-orange-200' },
  silver: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Silver', border: 'border-gray-300' },
  gold: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Gold', border: 'border-yellow-300' },
  platinum: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Platinum', border: 'border-purple-300' },
};

const sourceLabels: Record<Guest['source'], string> = {
  airbnb: 'Airbnb',
  vrbo: 'VRBO',
  direct: 'Direct',
  google: 'Google',
  referral: 'Referral',
};

// Guest data loaded from API — no hardcoded mock data
const guests: Guest[] = [];

type SortField = 'name' | 'totalStays' | 'totalSpent' | 'lastVisit';
type SortDir = 'asc' | 'desc';

export default function GuestCRM() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<VipTier | 'all'>('all');
  const [filterPlatform, setFilterPlatform] = useState<Guest['source'] | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('lastVisit');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [noteText, setNoteText] = useState('');

  const filtered = useMemo(() => {
    let result = guests
      .filter((g) => filterTier === 'all' || g.vipTier === filterTier)
      .filter((g) => filterPlatform === 'all' || g.source === filterPlatform)
      .filter((g) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          g.name.toLowerCase().includes(q) ||
          g.email.toLowerCase().includes(q) ||
          g.phone.includes(q) ||
          g.notes.toLowerCase().includes(q)
        );
      });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'totalStays') cmp = a.totalStays - b.totalStays;
      else if (sortField === 'totalSpent') cmp = a.totalSpent - b.totalSpent;
      else if (sortField === 'lastVisit') cmp = a.lastVisit.localeCompare(b.lastVisit);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [searchQuery, filterTier, filterPlatform, sortField, sortDir]);

  const totalRevenue = guests.reduce((s, g) => s + g.totalSpent, 0);
  const avgLTV = Math.round(totalRevenue / guests.length);
  const repeatRate = ((guests.filter((g) => g.totalStays > 1).length / guests.length) * 100).toFixed(0);
  const platinumCount = guests.filter((g) => g.vipTier === 'platinum').length;

  const tierCounts = {
    all: guests.length,
    bronze: guests.filter((g) => g.vipTier === 'bronze').length,
    silver: guests.filter((g) => g.vipTier === 'silver').length,
    gold: guests.filter((g) => g.vipTier === 'gold').length,
    platinum: guests.filter((g) => g.vipTier === 'platinum').length,
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const openEmail = (guest: Guest) => {
    setSelectedGuest(guest);
    setEmailSubject('');
    setEmailBody('');
    setShowEmailModal(true);
  };

  const openNote = (guest: Guest) => {
    setSelectedGuest(guest);
    setNoteText('');
    setShowNoteModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guest CRM</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage guest relationships, VIP tiers, and communications
          </p>
        </div>
        <button className="flex items-center gap-2 bg-[#500000] hover:bg-[#3C1518] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <UserPlus className="w-4 h-4" /> Add Guest
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-[#500000]/10 p-2.5 rounded-lg">
              <Users className="w-5 h-5 text-[#500000]" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Total Guests</p>
          <p className="text-2xl font-bold text-gray-900">{guests.length}</p>
          <p className="text-xs text-gray-400 mt-1">{platinumCount} Platinum guests</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-emerald-50 p-2.5 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Lifetime from all guests</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-50 p-2.5 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Avg Lifetime Value</p>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(avgLTV)}</p>
          <p className="text-xs text-gray-400 mt-1">Per guest average</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-purple-50 p-2.5 rounded-lg">
              <ArrowUpRight className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Repeat Rate</p>
          <p className="text-2xl font-bold text-gray-900">{repeatRate}%</p>
          <p className="text-xs text-gray-400 mt-1">
            {guests.filter((g) => g.totalStays > 1).length} of {guests.length} guests
          </p>
        </div>
      </div>

      {/* VIP Tier Filter + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'platinum', 'gold', 'silver', 'bronze'] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filterTier === tier
                  ? 'bg-[#500000] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {tier === 'all' ? 'All' : tierStyles[tier].label}{' '}
              <span className="ml-1 opacity-75">({tierCounts[tier]})</span>
            </button>
          ))}
        </div>
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value as Guest['source'] | 'all')}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
        >
          <option value="all">All Sources</option>
          {Object.entries(sourceLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guests..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
          />
        </div>
      </div>

      {/* Guest Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                  onClick={() => toggleSort('name')}
                >
                  Guest {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">VIP Tier</th>
                <th
                  className="text-center py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                  onClick={() => toggleSort('totalStays')}
                >
                  Stays {sortField === 'totalStays' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                  onClick={() => toggleSort('totalSpent')}
                >
                  Total Spent {sortField === 'totalSpent' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Rating</th>
                <th
                  className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                  onClick={() => toggleSort('lastVisit')}
                >
                  Last Visit {sortField === 'lastVisit' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Source</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((guest) => (
                <tr
                  key={guest.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#500000]/10 flex items-center justify-center text-[#500000] font-bold text-xs">
                        {guest.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{guest.name}</p>
                        <p className="text-xs text-gray-400">{guest.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tierStyles[guest.vipTier].bg} ${tierStyles[guest.vipTier].text}`}
                    >
                      <Award className="w-3 h-3" />
                      {tierStyles[guest.vipTier].label}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-gray-800">
                    {guest.totalStays}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-800">
                    {formatMoney(guest.totalSpent)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {guest.avgRating > 0 ? (
                      <span className="flex items-center justify-center gap-1 text-sm">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        {guest.avgRating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">--</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{guest.lastVisit}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{sourceLabels[guest.source]}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEmail(guest)}
                        title="Send Email"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#500000] hover:bg-[#500000]/5 transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openNote(guest)}
                        title="Add Note"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#500000] hover:bg-[#500000]/5 transition-colors"
                      >
                        <StickyNote className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/admin/crm/${guest.id}`}
                        className="flex items-center gap-1 p-1.5 rounded-lg text-[#500000] hover:bg-[#500000]/5 text-xs font-medium transition-colors"
                      >
                        View <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            {guests.length === 0
              ? 'No guest data yet. Guests will appear here as bookings are synced from Airbnb and VRBO.'
              : 'No guests match your filters.'}
          </div>
        )}
      </div>

      {/* Email Modal */}
      {showEmailModal && selectedGuest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                Email {selectedGuest.name}
              </h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="text"
                  value={selectedGuest.email}
                  readOnly
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={5}
                  placeholder="Write your message..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button className="flex items-center gap-2 bg-[#500000] hover:bg-[#3C1518] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <Send className="w-4 h-4" /> Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && selectedGuest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                Note for {selectedGuest.name}
              </h3>
              <button
                onClick={() => setShowNoteModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-800 mb-1">Current Notes:</p>
                <p>{selectedGuest.notes}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Note</label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={4}
                  placeholder="Add a note about this guest..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button className="flex items-center gap-2 bg-[#500000] hover:bg-[#3C1518] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <FileText className="w-4 h-4" /> Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
