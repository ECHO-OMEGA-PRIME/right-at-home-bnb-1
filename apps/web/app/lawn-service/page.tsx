'use client';

/**
 * Right at Home BnB - Lawn Service Management
 * Manage lawn care crews with dispatch capabilities
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, Plus, Search, Phone, MessageSquare, MapPin,
  Star, Clock, CheckCircle, AlertCircle, X, Edit2, Trash2,
  Send, PhoneCall, Calendar, DollarSign, User, FileText,
  Trophy, TrendingUp, Leaf
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';

// ============ Types ============

interface LawnCrewProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  taxId?: string;
  notes: string;
  stevenNotes: string;
  rating: number;
  totalJobs: number;
  onTimePercentage: number;
  avgScore: number;
  status: 'active' | 'inactive' | 'on_leave';
  specialties: string[];
  hourlyRate: number;
  createdAt: string;
}

interface DispatchJob {
  id: string;
  crewId: string;
  crewName: string;
  propertyAddress: string;
  propertyName: string;
  jobType: string;
  jobDescription: string;
  paymentAmount: number;
  scheduledTime: string;
  nextBookingTime?: string;
  status: 'pending' | 'dispatched' | 'confirmed' | 'in_progress' | 'completed' | 'late';
  dispatchedAt?: string;
  confirmedAt?: string;
  completedAt?: string;
}

// ============ Mock Data ============

const mockCrews: LawnCrewProfile[] = [
  {
    id: '1',
    name: 'Carlos Martinez',
    phone: '(432) 555-0101',
    email: 'carlos@lawnpros.com',
    address: '456 Oak Street',
    city: 'Midland',
    state: 'TX',
    zip: '79701',
    taxId: '87-6543210',
    notes: 'Owner of Martinez Lawn Care. Has own equipment.',
    stevenNotes: 'Very reliable. Always brings extra workers for big jobs.',
    rating: 4.9,
    totalJobs: 156,
    onTimePercentage: 98,
    avgScore: 4.8,
    status: 'active',
    specialties: ['Mowing', 'Edging', 'Tree Trimming', 'Sprinkler Repair'],
    hourlyRate: 45,
    createdAt: '2024-06-15',
  },
  {
    id: '2',
    name: 'Mike Johnson',
    phone: '(432) 555-0102',
    email: 'mike.j@email.com',
    address: '789 Elm Drive',
    city: 'Odessa',
    state: 'TX',
    zip: '79762',
    notes: 'Solo operator. Good for smaller properties.',
    stevenNotes: 'Prefers morning jobs. Does excellent detail work.',
    rating: 4.7,
    totalJobs: 89,
    onTimePercentage: 94,
    avgScore: 4.6,
    status: 'active',
    specialties: ['Mowing', 'Edging', 'Weed Control'],
    hourlyRate: 35,
    createdAt: '2024-08-20',
  },
  {
    id: '3',
    name: 'Green Thumb Landscaping',
    phone: '(432) 555-0103',
    email: 'info@greenthumb.com',
    address: '321 Garden Way',
    city: 'Midland',
    state: 'TX',
    zip: '79705',
    taxId: '12-3456789',
    notes: 'Full service landscaping company. 3-person crew.',
    stevenNotes: 'Premium pricing but exceptional quality. Use for high-end properties.',
    rating: 5.0,
    totalJobs: 45,
    onTimePercentage: 100,
    avgScore: 5.0,
    status: 'active',
    specialties: ['Full Landscaping', 'Irrigation', 'Hardscaping', 'Design'],
    hourlyRate: 75,
    createdAt: '2024-10-01',
  },
];

const mockJobs: DispatchJob[] = [
  {
    id: 'j1',
    crewId: '1',
    crewName: 'Carlos Martinez',
    propertyAddress: '123 Main St, Midland, TX',
    propertyName: 'Desert Oasis Villa',
    jobType: 'Weekly Maintenance',
    jobDescription: 'Mow front and back yard, edge sidewalks, trim bushes',
    paymentAmount: 85,
    scheduledTime: '2026-01-17T09:00:00',
    nextBookingTime: '2026-01-17T15:00:00',
    status: 'confirmed',
    dispatchedAt: '2026-01-16T14:00:00',
    confirmedAt: '2026-01-16T14:15:00',
  },
  {
    id: 'j2',
    crewId: '2',
    crewName: 'Mike Johnson',
    propertyAddress: '456 Oak Ave, Midland, TX',
    propertyName: 'Sunrise Retreat',
    jobType: 'Post-Guest Cleanup',
    jobDescription: 'Clean up yard debris, mow lawn, check sprinklers',
    paymentAmount: 65,
    scheduledTime: '2026-01-17T11:00:00',
    status: 'dispatched',
    dispatchedAt: '2026-01-17T08:00:00',
  },
];

// ============ Components ============

function CrewFormModal({
  crew,
  onSave,
  onClose
}: {
  crew?: LawnCrewProfile;
  onSave: (data: Partial<LawnCrewProfile>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<Partial<LawnCrewProfile>>(
    crew || {
      name: '',
      phone: '',
      email: '',
      address: '',
      city: 'Midland',
      state: 'TX',
      zip: '',
      taxId: '',
      notes: '',
      stevenNotes: '',
      rating: 5,
      status: 'active',
      specialties: [],
      hourlyRate: 40,
    }
  );

  const [specialtyInput, setSpecialtyInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addSpecialty = () => {
    if (specialtyInput.trim() && !formData.specialties?.includes(specialtyInput.trim())) {
      setFormData({
        ...formData,
        specialties: [...(formData.specialties || []), specialtyInput.trim()]
      });
      setSpecialtyInput('');
    }
  };

  const removeSpecialty = (specialty: string) => {
    setFormData({
      ...formData,
      specialties: formData.specialties?.filter(s => s !== specialty) || []
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2D2D2D]">
              {crew ? 'Edit Lawn Crew' : 'Add New Lawn Crew'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name / Company *
              </label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                placeholder="John Doe or Company Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone *
              </label>
              <input
                type="tel"
                required
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                placeholder="(432) 555-0100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              placeholder="email@example.com"
            />
          </div>

          {/* Address for Tax/1099 */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Address (for 1099 Tax Reporting)
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address
              </label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                placeholder="123 Main Street"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={e => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input
                  type="text"
                  value={formData.zip || ''}
                  onChange={e => setFormData({ ...formData, zip: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax ID / SSN (last 4 for verification)
              </label>
              <input
                type="text"
                value={formData.taxId || ''}
                onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                placeholder="XX-XXXXXXX or last 4 digits"
              />
            </div>
          </div>

          {/* Specialties & Rate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hourly Rate ($)
              </label>
              <input
                type="number"
                value={formData.hourlyRate || 40}
                onChange={e => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status || 'active'}
                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Specialties */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Specialties
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={specialtyInput}
                onChange={e => setSpecialtyInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
                placeholder="e.g., Mowing, Tree Trimming"
              />
              <button
                type="button"
                onClick={addSpecialty}
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.specialties?.map(specialty => (
                <span
                  key={specialty}
                  className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-1"
                >
                  {specialty}
                  <button
                    type="button"
                    onClick={() => removeSpecialty(specialty)}
                    className="hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              General Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              placeholder="Equipment they have, availability preferences, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Steven&apos;s Private Notes
            </label>
            <textarea
              value={formData.stevenNotes || ''}
              onChange={e => setFormData({ ...formData, stevenNotes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent bg-amber-50"
              placeholder="AI observations and performance notes..."
            />
            <p className="text-xs text-amber-600 mt-1">
              These notes are for Steven AI&apos;s use in making dispatch decisions
            </p>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Rating
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData({ ...formData, rating: star })}
                  className="p-1"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= (formData.rating || 5)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-600">
                {formData.rating || 5} / 5
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-[#500000] text-white rounded-xl hover:bg-[#722F37] font-medium"
            >
              {crew ? 'Save Changes' : 'Add Lawn Crew'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function DispatchModal({
  crew,
  onDispatch,
  onClose
}: {
  crew: LawnCrewProfile;
  onDispatch: (job: Partial<DispatchJob>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    propertyAddress: '',
    propertyName: '',
    jobType: 'Weekly Maintenance',
    jobDescription: '',
    paymentAmount: crew.hourlyRate * 2,
    scheduledTime: new Date().toISOString().slice(0, 16),
    nextBookingTime: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDispatch({
      crewId: crew.id,
      crewName: crew.name,
      ...formData,
      status: 'pending',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#2D2D2D]">Dispatch Job</h2>
              <p className="text-sm text-gray-600">Send job to {crew.name}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Name
            </label>
            <input
              type="text"
              required
              value={formData.propertyName}
              onChange={e => setFormData({ ...formData, propertyName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              placeholder="Desert Oasis Villa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Address *
            </label>
            <input
              type="text"
              required
              value={formData.propertyAddress}
              onChange={e => setFormData({ ...formData, propertyAddress: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              placeholder="123 Main St, Midland, TX 79705"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Type
              </label>
              <select
                value={formData.jobType}
                onChange={e => setFormData({ ...formData, jobType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              >
                <option>Weekly Maintenance</option>
                <option>Post-Guest Cleanup</option>
                <option>One-Time Service</option>
                <option>Emergency</option>
                <option>Sprinkler Repair</option>
                <option>Tree Trimming</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount ($)
              </label>
              <input
                type="number"
                required
                value={formData.paymentAmount}
                onChange={e => setFormData({ ...formData, paymentAmount: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Description *
            </label>
            <textarea
              required
              value={formData.jobDescription}
              onChange={e => setFormData({ ...formData, jobDescription: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              placeholder="Mow front and back yard, edge sidewalks, trim bushes..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Time *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.scheduledTime}
                onChange={e => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next Booking (optional)
              </label>
              <input
                type="datetime-local"
                value={formData.nextBookingTime}
                onChange={e => setFormData({ ...formData, nextBookingTime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Time before next guest arrives</p>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-xl">
            <h4 className="font-medium text-green-800 mb-2">Steven will:</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Text job details to {crew.name}
              </li>
              <li className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4" />
                Call to confirm receipt
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Monitor for confirmation (1hr timeout)
              </li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              Dispatch Job
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ============ Main Component ============

export default function LawnServicePage() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'manage' | 'jobs' | 'schedule'>('leaderboard');
  const [crews, setCrews] = useState<LawnCrewProfile[]>(mockCrews);
  const [jobs, setJobs] = useState<DispatchJob[]>(mockJobs);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCrewModal, setShowCrewModal] = useState(false);
  const [editingCrew, setEditingCrew] = useState<LawnCrewProfile | undefined>();
  const [dispatchingCrew, setDispatchingCrew] = useState<LawnCrewProfile | undefined>();

  // Filter crews by search
  const filteredCrews = crews.filter(crew =>
    crew.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    crew.phone.includes(searchQuery) ||
    crew.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort for leaderboard
  const leaderboardCrews = [...filteredCrews]
    .filter(c => c.status === 'active')
    .sort((a, b) => {
      const scoreA = a.rating * 0.4 + (a.onTimePercentage / 100) * 0.3 + (a.avgScore / 5) * 0.3;
      const scoreB = b.rating * 0.4 + (b.onTimePercentage / 100) * 0.3 + (b.avgScore / 5) * 0.3;
      return scoreB - scoreA;
    });

  const handleSaveCrew = (data: Partial<LawnCrewProfile>) => {
    if (editingCrew) {
      setCrews(crews.map(c =>
        c.id === editingCrew.id ? { ...c, ...data } as LawnCrewProfile : c
      ));
    } else {
      const newCrew: LawnCrewProfile = {
        ...data,
        id: Date.now().toString(),
        totalJobs: 0,
        onTimePercentage: 100,
        avgScore: data.rating || 5,
        createdAt: new Date().toISOString().split('T')[0],
      } as LawnCrewProfile;
      setCrews([...crews, newCrew]);
    }
    setShowCrewModal(false);
    setEditingCrew(undefined);
  };

  const handleDeleteCrew = (id: string) => {
    if (confirm('Are you sure you want to remove this lawn crew?')) {
      setCrews(crews.filter(c => c.id !== id));
    }
  };

  const handleDispatch = (job: Partial<DispatchJob>) => {
    const newJob: DispatchJob = {
      ...job,
      id: Date.now().toString(),
      status: 'dispatched',
      dispatchedAt: new Date().toISOString(),
    } as DispatchJob;
    setJobs([newJob, ...jobs]);
    setDispatchingCrew(undefined);

    // TODO: Integrate with Steven AI to actually send SMS and make calls
    alert(`Job dispatched to ${job.crewName}!\n\nSteven will:\n1. Text job details\n2. Call to confirm\n3. Monitor for response`);
  };

  const getStatusColor = (status: DispatchJob['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'dispatched': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-amber-100 text-amber-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'late': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DashboardShell>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                Lawn Service
              </h1>
              <p className="text-[#2D2D2D]/60">
                Manage lawn crews and dispatch jobs
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
            { id: 'manage', label: 'Manage Crews', icon: User },
            { id: 'jobs', label: 'Active Jobs', icon: Send },
            { id: 'schedule', label: 'Schedule', icon: Calendar },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-[#2D2D2D]/70 hover:bg-green-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Add */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search crews by name, phone, or specialty..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => {
              setEditingCrew(undefined);
              setShowCrewModal(true);
            }}
            className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Crew
          </button>
        </div>

        {/* Content */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-6 text-white mb-6">
              <h2 className="text-xl font-semibold mb-2">Lawn Crew Leaderboard</h2>
              <p className="text-white/80">
                Rankings based on rating, on-time performance, and quality scores
              </p>
            </div>

            {leaderboardCrews.map((crew, index) => (
              <motion.div
                key={crew.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                    index === 0 ? 'bg-amber-400 text-white' :
                    index === 1 ? 'bg-gray-300 text-gray-700' :
                    index === 2 ? 'bg-amber-600 text-white' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-[#2D2D2D]">{crew.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {crew.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Wrench className="w-4 h-4" />
                        {crew.totalJobs} jobs
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${crew.hourlyRate}/hr
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {crew.specialties.slice(0, 3).map(s => (
                        <span key={s} className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="w-5 h-5 fill-amber-400" />
                        <span className="font-bold text-lg">{crew.rating}</span>
                      </div>
                      <p className="text-xs text-gray-500">Rating</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-green-600">
                        <Clock className="w-5 h-5" />
                        <span className="font-bold text-lg">{crew.onTimePercentage}%</span>
                      </div>
                      <p className="text-xs text-gray-500">On Time</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-blue-600">
                        <TrendingUp className="w-5 h-5" />
                        <span className="font-bold text-lg">{crew.avgScore}</span>
                      </div>
                      <p className="text-xs text-gray-500">Avg Score</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDispatchingCrew(crew)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Dispatch
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCrews.map(crew => (
              <motion.div
                key={crew.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-[#2D2D2D]">{crew.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      crew.status === 'active' ? 'bg-green-100 text-green-700' :
                      crew.status === 'on_leave' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {crew.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="font-medium">{crew.rating}</span>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {crew.phone}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {crew.city}, {crew.state}
                  </p>
                  <p className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    ${crew.hourlyRate}/hr
                  </p>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {crew.specialties.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                      {s}
                    </span>
                  ))}
                </div>

                {crew.notes && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{crew.notes}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingCrew(crew);
                      setShowCrewModal(true);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm flex items-center justify-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDispatchingCrew(crew)}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center justify-center gap-1"
                  >
                    <Send className="w-4 h-4" />
                    Dispatch
                  </button>
                  <button
                    onClick={() => handleDeleteCrew(crew.id)}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}

            {filteredCrews.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <Leaf className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No lawn crews found</p>
                <button
                  onClick={() => setShowCrewModal(true)}
                  className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add First Crew
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active jobs</p>
                <p className="text-sm">Dispatch a job from the Manage Crews tab</p>
              </div>
            ) : (
              jobs.map(job => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-[#2D2D2D]">{job.propertyName}</h3>
                      <p className="text-sm text-gray-600">{job.propertyAddress}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Assigned To</p>
                      <p className="font-medium">{job.crewName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Job Type</p>
                      <p className="font-medium">{job.jobType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Payment</p>
                      <p className="font-medium text-green-600">${job.paymentAmount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Scheduled</p>
                      <p className="font-medium">
                        {new Date(job.scheduledTime).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {job.jobDescription}
                  </p>

                  {job.nextBookingTime && (
                    <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Next booking at {new Date(job.nextBookingTime).toLocaleString()}
                    </div>
                  )}

                  <div className="mt-4 flex gap-2 text-sm text-gray-500">
                    {job.dispatchedAt && (
                      <span>Dispatched: {new Date(job.dispatchedAt).toLocaleTimeString()}</span>
                    )}
                    {job.confirmedAt && (
                      <span className="text-green-600">
                        Confirmed: {new Date(job.confirmedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Schedule View Coming Soon</p>
              <p className="text-sm">Calendar view of all lawn service appointments</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCrewModal && (
          <CrewFormModal
            crew={editingCrew}
            onSave={handleSaveCrew}
            onClose={() => {
              setShowCrewModal(false);
              setEditingCrew(undefined);
            }}
          />
        )}
        {dispatchingCrew && (
          <DispatchModal
            crew={dispatchingCrew}
            onDispatch={handleDispatch}
            onClose={() => setDispatchingCrew(undefined)}
          />
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}
