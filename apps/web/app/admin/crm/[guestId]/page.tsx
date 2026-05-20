'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Star, Mail, Phone, MapPin, Calendar, DollarSign,
  Clock, MessageSquare, Send, Edit3, Award, FileText, Plus,
  CheckCircle, User, Heart, Building2, TrendingUp, StickyNote
} from 'lucide-react';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

type VipTier = 'bronze' | 'silver' | 'gold' | 'platinum';

interface GuestProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  city: string;
  state: string;
  vipTier: VipTier;
  totalStays: number;
  totalSpent: number;
  avgRating: number;
  firstStay: string;
  lastStay: string;
  preferredProperty: string;
  preferredBedType: string;
  loyaltyDiscount: number;
  preferences: Record<string, boolean>;
}

interface StayRecord {
  id: string;
  property: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: number;
  status: 'completed' | 'upcoming' | 'cancelled';
  rating?: number;
}

interface NoteEntry {
  id: string;
  date: string;
  author: string;
  content: string;
}

interface CommLog {
  id: string;
  type: 'email' | 'sms' | 'call' | 'note';
  direction: 'inbound' | 'outbound' | 'internal';
  subject: string;
  content: string;
  date: string;
  agent: string;
}

const tierStyles: Record<VipTier, { bg: string; text: string; label: string }> = {
  bronze: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Bronze (1-2 stays)' },
  silver: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Silver (3-5 stays)' },
  gold: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Gold (6-9 stays)' },
  platinum: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Platinum (10+ stays)' },
};

const guestDatabase: Record<string, GuestProfile> = {
  G001: { id: 'G001', name: 'Amanda Richardson', email: 'amanda.r@pioneeroil.com', phone: '(432) 555-0101', company: 'Pioneer Oil & Gas', title: 'Pipeline Inspector', city: 'Houston', state: 'TX', vipTier: 'platinum', totalStays: 14, totalSpent: 4200000, avgRating: 5.0, firstStay: '2024-06-15', lastStay: '2026-03-10', preferredProperty: 'Sunset Villa', preferredBedType: 'King', loyaltyDiscount: 15, preferences: { earlyCheckIn: true, lateCheckOut: true, extraTowels: true, hypoallergenic: false, parkingSpot: true, quietUnit: false, petFriendly: false, kitchenEssentials: true } },
  G002: { id: 'G002', name: 'Robert Chen', email: 'r.chen@basineng.com', phone: '(432) 555-0102', company: 'Basin Engineering', title: 'Project Manager', city: 'Dallas', state: 'TX', vipTier: 'gold', totalStays: 8, totalSpent: 2800000, avgRating: 4.8, firstStay: '2025-02-10', lastStay: '2026-03-05', preferredProperty: 'Permian Loft', preferredBedType: 'Queen', loyaltyDiscount: 10, preferences: { earlyCheckIn: false, lateCheckOut: true, extraTowels: false, hypoallergenic: false, parkingSpot: true, quietUnit: true, petFriendly: false, kitchenEssentials: true } },
  G003: { id: 'G003', name: 'Jennifer Lopez-Martinez', email: 'jlm@outlook.com', phone: '(915) 555-0103', company: 'Self', title: 'Family Visitor', city: 'El Paso', state: 'TX', vipTier: 'gold', totalStays: 6, totalSpent: 1650000, avgRating: 4.5, firstStay: '2025-04-20', lastStay: '2026-02-28', preferredProperty: 'Basin View', preferredBedType: 'Queen', loyaltyDiscount: 10, preferences: { earlyCheckIn: true, lateCheckOut: false, extraTowels: true, hypoallergenic: true, parkingSpot: false, quietUnit: true, petFriendly: false, kitchenEssentials: true } },
  G005: { id: 'G005', name: 'Sarah Williams', email: 'swilliams@chevron.com', phone: '(713) 555-0105', company: 'Chevron', title: 'Field Supervisor', city: 'Houston', state: 'TX', vipTier: 'platinum', totalStays: 11, totalSpent: 3850000, avgRating: 4.9, firstStay: '2024-09-01', lastStay: '2026-03-12', preferredProperty: 'Sunset Villa', preferredBedType: 'King', loyaltyDiscount: 15, preferences: { earlyCheckIn: true, lateCheckOut: true, extraTowels: true, hypoallergenic: false, parkingSpot: true, quietUnit: false, petFriendly: false, kitchenEssentials: true } },
  G007: { id: 'G007', name: 'Patricia Dawson', email: 'pdawson@dawsondrilling.com', phone: '(432) 555-0107', company: 'Dawson Drilling', title: 'Owner', city: 'Odessa', state: 'TX', vipTier: 'gold', totalStays: 9, totalSpent: 2970000, avgRating: 4.7, firstStay: '2024-11-05', lastStay: '2026-02-20', preferredProperty: 'Wildcatter Suite', preferredBedType: 'King', loyaltyDiscount: 10, preferences: { earlyCheckIn: false, lateCheckOut: true, extraTowels: true, hypoallergenic: false, parkingSpot: true, quietUnit: false, petFriendly: false, kitchenEssentials: false } },
  G010: { id: 'G010', name: 'David Hernandez', email: 'dhernandez@halliburton.com', phone: '(832) 555-0110', company: 'Halliburton', title: 'Completions Lead', city: 'Houston', state: 'TX', vipTier: 'gold', totalStays: 7, totalSpent: 2450000, avgRating: 4.6, firstStay: '2025-03-15', lastStay: '2026-03-01', preferredProperty: 'Prairie House', preferredBedType: 'Queen', loyaltyDiscount: 10, preferences: { earlyCheckIn: true, lateCheckOut: false, extraTowels: false, hypoallergenic: false, parkingSpot: true, quietUnit: false, petFriendly: false, kitchenEssentials: true } },
  G013: { id: 'G013', name: 'Maria Gonzalez', email: 'mgonzalez@pxd.com', phone: '(432) 555-0113', company: 'Pioneer Natural Resources', title: 'Geology Manager', city: 'Midland', state: 'TX', vipTier: 'platinum', totalStays: 10, totalSpent: 3100000, avgRating: 4.9, firstStay: '2024-08-10', lastStay: '2026-03-15', preferredProperty: 'Oilfield Oasis', preferredBedType: 'King', loyaltyDiscount: 15, preferences: { earlyCheckIn: true, lateCheckOut: true, extraTowels: false, hypoallergenic: true, parkingSpot: true, quietUnit: true, petFriendly: false, kitchenEssentials: true } },
};

const staysByGuest: Record<string, StayRecord[]> = {
  G001: [
    { id: 'B014', property: 'Sunset Villa', checkIn: '2026-03-01', checkOut: '2026-03-10', nights: 9, total: 1575000, status: 'completed', rating: 5 },
    { id: 'B013', property: 'Sunset Villa', checkIn: '2026-02-03', checkOut: '2026-02-14', nights: 11, total: 1925000, status: 'completed', rating: 5 },
    { id: 'B012', property: 'Sunset Villa', checkIn: '2026-01-06', checkOut: '2026-01-17', nights: 11, total: 1925000, status: 'completed', rating: 5 },
    { id: 'B011', property: 'Permian Loft', checkIn: '2025-12-01', checkOut: '2025-12-12', nights: 11, total: 1595000, status: 'completed', rating: 5 },
    { id: 'B010', property: 'Sunset Villa', checkIn: '2025-11-03', checkOut: '2025-11-14', nights: 11, total: 1760000, status: 'completed', rating: 5 },
    { id: 'B015', property: 'Sunset Villa', checkIn: '2026-04-07', checkOut: '2026-04-18', nights: 11, total: 1925000, status: 'upcoming' },
  ],
  G002: [
    { id: 'B020', property: 'Permian Loft', checkIn: '2026-02-24', checkOut: '2026-03-05', nights: 9, total: 1305000, status: 'completed', rating: 5 },
    { id: 'B019', property: 'Permian Loft', checkIn: '2026-01-13', checkOut: '2026-01-24', nights: 11, total: 1595000, status: 'completed', rating: 4 },
    { id: 'B018', property: 'Basin View', checkIn: '2025-11-15', checkOut: '2025-11-28', nights: 13, total: 1820000, status: 'completed', rating: 5 },
  ],
};

const notesByGuest: Record<string, NoteEntry[]> = {
  G001: [
    { id: 'N01', date: '2026-03-10', author: 'Maria', content: 'Amanda now prefers the upstairs king suite (more natural light). Updated profile. Also wants sparkling water stocked instead of still.' },
    { id: 'N02', date: '2026-02-14', author: 'Bobby', content: 'Amanda tipped the cleaning crew $50 again. Always very generous. Mentioned she might bring a colleague next month.' },
    { id: 'N03', date: '2026-01-06', author: 'Bobby', content: 'Renewed loyalty discount at 15%. Amanda has referred 3 guests in the past 6 months. True VIP.' },
  ],
  G002: [
    { id: 'N04', date: '2026-03-05', author: 'Bobby', content: 'Robert needs reliable WiFi for daily video standups at 7:30 AM. Verified Permian Loft speed at 250 Mbps.' },
  ],
};

const commsByGuest: Record<string, CommLog[]> = {
  G001: [
    { id: 'C01', type: 'email', direction: 'outbound', subject: 'Booking Confirmation - April 7-18', content: 'Hi Amanda! Your upcoming stay at Sunset Villa is confirmed. Same king suite as always.', date: '2026-03-14 10:30', agent: 'Bobby' },
    { id: 'C02', type: 'sms', direction: 'inbound', subject: 'Early check-in request', content: 'Hey Bobby, any chance I can check in around 1pm on the 7th? Flight lands at noon.', date: '2026-03-13 15:45', agent: 'Guest' },
    { id: 'C03', type: 'sms', direction: 'outbound', subject: 'Re: Early check-in', content: 'Absolutely Amanda! Place will be ready by 1pm. Safe travels!', date: '2026-03-13 15:52', agent: 'Bobby' },
    { id: 'C04', type: 'email', direction: 'outbound', subject: 'Thank you + loyalty discount', content: 'Amanda, thank you for another great stay! As a VIP guest, you now receive 15% off all future bookings.', date: '2026-03-10 16:00', agent: 'Bobby' },
    { id: 'C05', type: 'call', direction: 'inbound', subject: 'Referral inquiry', content: 'Amanda called to refer colleague David Martinez at Pioneer. Needs housing for 3-week project starting April 21.', date: '2026-03-08 11:20', agent: 'Bobby' },
  ],
  G002: [
    { id: 'C10', type: 'email', direction: 'outbound', subject: 'February Booking Confirmed', content: 'Hi Robert, your Feb 24 - Mar 5 stay at Permian Loft is confirmed. Same setup as last time.', date: '2026-02-15 09:00', agent: 'Bobby' },
    { id: 'C11', type: 'sms', direction: 'inbound', subject: 'WiFi question', content: 'Bobby, what is the WiFi speed at Permian Loft? Need to do video calls for work.', date: '2026-02-20 14:30', agent: 'Guest' },
    { id: 'C12', type: 'sms', direction: 'outbound', subject: 'Re: WiFi', content: '250 Mbps on Permian Loft. More than enough for video calls. Safe travels Robert!', date: '2026-02-20 14:45', agent: 'Bobby' },
  ],
};

const commTypeStyles: Record<CommLog['type'], { bg: string; text: string; icon: typeof Mail }> = {
  email: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Mail },
  sms: { bg: 'bg-green-50', text: 'text-green-700', icon: MessageSquare },
  call: { bg: 'bg-purple-50', text: 'text-purple-700', icon: Phone },
  note: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: FileText },
};

const defaultGuest: GuestProfile = {
  id: 'G000', name: 'Guest Not Found', email: '', phone: '', company: '', title: '',
  city: '', state: '', vipTier: 'bronze', totalStays: 0, totalSpent: 0, avgRating: 0,
  firstStay: '', lastStay: '', preferredProperty: '', preferredBedType: '',
  loyaltyDiscount: 0, preferences: {},
};

export default function GuestDetail() {
  const params = useParams();
  const guestId = params.guestId as string;

  const guest = guestDatabase[guestId] || defaultGuest;
  const stays = staysByGuest[guestId] || [];
  const notes = notesByGuest[guestId] || [];
  const comms = commsByGuest[guestId] || [];

  const [activeTab, setActiveTab] = useState<'stays' | 'notes' | 'comms' | 'preferences'>('stays');
  const [newNote, setNewNote] = useState('');

  const lifetimeMonths = useMemo(() => {
    if (!guest.firstStay) return 0;
    const first = new Date(guest.firstStay);
    const now = new Date('2026-03-17');
    return Math.round((now.getTime() - first.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }, [guest.firstStay]);

  const avgStayValue = guest.totalStays > 0 ? Math.round(guest.totalSpent / guest.totalStays) : 0;
  const monthlyValue = lifetimeMonths > 0 ? Math.round(guest.totalSpent / lifetimeMonths) : 0;

  if (guest.id === 'G000') {
    return (
      <div className="space-y-6">
        <Link href="/admin/crm" className="inline-flex items-center gap-2 text-[#500000] hover:underline text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Guest CRM
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <User className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">Guest not found</p>
          <p className="text-gray-400 text-sm mt-1">No guest with ID &quot;{guestId}&quot; exists in the system.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'stays' as const, label: 'Stay History', count: stays.length },
    { key: 'notes' as const, label: 'Notes', count: notes.length },
    { key: 'comms' as const, label: 'Communications', count: comms.length },
    { key: 'preferences' as const, label: 'Preferences' },
  ];

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/admin/crm" className="inline-flex items-center gap-2 text-[#500000] hover:underline text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Guest CRM
      </Link>

      {/* Guest Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#500000]/10 flex items-center justify-center text-[#500000] font-bold text-xl">
              {guest.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{guest.name}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${tierStyles[guest.vipTier].bg} ${tierStyles[guest.vipTier].text}`}>
                  <Award className="w-3 h-3" />
                  {tierStyles[guest.vipTier].label}
                </span>
              </div>
              <p className="text-gray-500">{guest.title} at {guest.company}</p>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {guest.email}</span>
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {guest.phone}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {guest.city}, {guest.state}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Mail className="w-4 h-4" /> Email
            </button>
            <button className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Phone className="w-4 h-4" /> Call
            </button>
            <button className="flex items-center gap-2 bg-[#500000] hover:bg-[#3C1518] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Stays', value: String(guest.totalStays), icon: Calendar },
          { label: 'Total Spent', value: formatMoney(guest.totalSpent), icon: DollarSign },
          { label: 'Avg Rating', value: guest.avgRating.toFixed(1), icon: Star },
          { label: 'Avg Stay Value', value: formatMoney(avgStayValue), icon: TrendingUp },
          { label: 'Monthly Value', value: formatMoney(monthlyValue), icon: TrendingUp },
          { label: 'Loyalty Discount', value: guest.loyaltyDiscount + '%', icon: Heart },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <Icon className="w-4 h-4 text-[#500000] mb-2" />
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-lg font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Lifetime Value Calculation */}
      <div className="bg-gradient-to-r from-[#500000] to-[#3C1518] rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-5 h-5" />
          <h3 className="font-bold">Lifetime Value Breakdown</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-white/60">Guest Since</p>
            <p className="font-semibold">{guest.firstStay} ({lifetimeMonths} months)</p>
          </div>
          <div>
            <p className="text-white/60">Total Revenue</p>
            <p className="font-semibold">{formatMoney(guest.totalSpent)}</p>
          </div>
          <div>
            <p className="text-white/60">Revenue/Month</p>
            <p className="font-semibold">{formatMoney(monthlyValue)}</p>
          </div>
          <div>
            <p className="text-white/60">Projected Annual</p>
            <p className="font-semibold">{formatMoney(monthlyValue * 12)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#500000] text-[#500000]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            {'count' in tab && tab.count !== undefined && (
              <span className="ml-2 bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Stay History Tab */}
      {activeTab === 'stays' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Property</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Check-in</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Check-out</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Nights</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Rating</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {stays.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900">{s.property}</td>
                  <td className="py-3 px-4 text-gray-600">{s.checkIn}</td>
                  <td className="py-3 px-4 text-gray-600">{s.checkOut}</td>
                  <td className="py-3 px-4 text-center text-gray-700">{s.nights}</td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">{formatMoney(s.total)}</td>
                  <td className="py-3 px-4 text-center">
                    {s.rating ? (
                      <span className="flex items-center justify-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> {s.rating}
                      </span>
                    ) : (
                      <span className="text-gray-300">--</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                      s.status === 'completed' ? 'bg-green-50 text-green-700' :
                      s.status === 'upcoming' ? 'bg-blue-50 text-blue-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stays.length === 0 && (
            <div className="p-12 text-center text-gray-400">No stay records found.</div>
          )}
        </div>
      )}

      {/* Notes Timeline Tab */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* Add Note */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <div className="bg-[#500000]/10 p-2 rounded-lg mt-1">
                <StickyNote className="w-4 h-4 text-[#500000]" />
              </div>
              <div className="flex-1">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] mb-2"
                  placeholder="Add an internal note about this guest..."
                />
                <button className="flex items-center gap-2 bg-[#500000] hover:bg-[#3C1518] text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  <Plus className="w-3 h-3" /> Add Note
                </button>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200" />
            {notes.map((note) => (
              <div key={note.id} className="relative pl-14 pb-6">
                <div className="absolute left-4 w-5 h-5 rounded-full bg-[#500000] border-2 border-white flex items-center justify-center">
                  <FileText className="w-2.5 h-2.5 text-white" />
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">
                      {note.author} &middot; {note.date}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{note.content}</p>
                </div>
              </div>
            ))}
          </div>

          {notes.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              No notes yet. Add the first note above.
            </div>
          )}
        </div>
      )}

      {/* Communications Tab */}
      {activeTab === 'comms' && (
        <div className="space-y-3">
          {comms.map((comm) => {
            const style = commTypeStyles[comm.type];
            const Icon = style.icon;
            return (
              <div key={comm.id} className={`bg-white rounded-xl border border-gray-200 p-4 ${
                comm.direction === 'inbound' ? 'border-l-4 border-l-blue-400' :
                comm.direction === 'internal' ? 'border-l-4 border-l-yellow-400' : ''
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`${style.bg} p-2 rounded-lg`}>
                    <Icon className={`w-4 h-4 ${style.text}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm">{comm.subject}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
                          {comm.type}
                        </span>
                        <span className="text-[10px] text-gray-400 capitalize">{comm.direction}</span>
                      </div>
                      <span className="text-xs text-gray-400">{comm.date}</span>
                    </div>
                    <p className="text-sm text-gray-600">{comm.content}</p>
                    <p className="text-xs text-gray-400 mt-1">by {comm.agent}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {comms.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              No communications recorded.
            </div>
          )}
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Stay Preferences</h3>
            <div className="space-y-3">
              {Object.entries(guest.preferences).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    value ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {value ? 'Yes' : 'No'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Booking Patterns</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1"><span className="text-gray-500">Preferred Property</span><span className="font-medium text-gray-900">{guest.preferredProperty}</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-500">Preferred Bed</span><span className="font-medium text-gray-900">{guest.preferredBedType}</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-500">Avg Stay Length</span><span className="font-medium text-gray-900">{stays.length > 0 ? Math.round(stays.reduce((s, st) => s + st.nights, 0) / stays.length) : '--'} nights</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-500">Loyalty Discount</span><span className="font-medium text-[#500000]">{guest.loyaltyDiscount}%</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-500">Guest Since</span><span className="font-medium text-gray-900">{guest.firstStay}</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-500">Months as Guest</span><span className="font-medium text-gray-900">{lifetimeMonths}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
