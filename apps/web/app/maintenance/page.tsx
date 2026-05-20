'use client';

/**
 * Right at Home BnB - Maintenance Workers Management
 * Manage handymen and repair workers with dispatch capabilities
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, Plus, Search, Phone, MessageSquare, MapPin,
  Star, Clock, CheckCircle, AlertCircle, X, Edit2, Trash2,
  Send, PhoneCall, Calendar, DollarSign, User, FileText,
  Trophy, TrendingUp, Package, AlertTriangle, Hammer, Zap,
  Droplet, Thermometer, PaintBucket
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';

// ============ Types ============

interface MaintenanceWorkerProfile {
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
  emergency24h: boolean;
  createdAt: string;
}

interface MaintenanceJob {
  id: string;
  workerId: string;
  workerName: string;
  propertyAddress: string;
  propertyName: string;
  jobType: string;
  priority: 'low' | 'normal' | 'high' | 'emergency';
  jobDescription: string;
  paymentAmount: number;
  scheduledTime: string;
  estimatedDuration: string;
  status: 'pending' | 'dispatched' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  dispatchedAt?: string;
  confirmedAt?: string;
  completedAt?: string;
}

// ============ Mock Data ============

const mockWorkers: MaintenanceWorkerProfile[] = [];

const mockJobs: MaintenanceJob[] = [];

// ============ Job Type Categories ============

const jobCategories = [
  { value: 'Plumbing Repair', icon: Droplet, color: 'blue' },
  { value: 'HVAC Service', icon: Thermometer, color: 'orange' },
  { value: 'Electrical', icon: Zap, color: 'yellow' },
  { value: 'Appliance Repair', icon: Package, color: 'purple' },
  { value: 'Painting/Drywall', icon: PaintBucket, color: 'pink' },
  { value: 'General Repair', icon: Hammer, color: 'gray' },
  { value: 'Emergency', icon: AlertTriangle, color: 'red' },
];

// ============ Components ============

function WorkerFormModal({
  worker,
  onSave,
  onClose
}: {
  worker?: MaintenanceWorkerProfile;
  onSave: (data: Partial<MaintenanceWorkerProfile>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<Partial<MaintenanceWorkerProfile>>(
    worker || {
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
      hourlyRate: 50,
      emergency24h: false,
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

  const commonSpecialties = [
    'Plumbing', 'HVAC', 'Electrical', 'Appliances', 'Drywall',
    'Painting', 'Roofing', 'Carpentry', 'Door Repair', 'Window Repair',
    'Pool Maintenance', 'Hot Tubs', 'Water Heaters', 'Garbage Disposals'
  ];

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
              {worker ? 'Edit Maintenance Worker' : 'Add New Maintenance Worker'}
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

          {/* Rate & Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hourly Rate ($)
              </label>
              <input
                type="number"
                value={formData.hourlyRate || 50}
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
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emergency24h || false}
                  onChange={e => setFormData({ ...formData, emergency24h: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-[#500000] focus:ring-[#500000]"
                />
                <span className="text-sm font-medium text-gray-700">24/7 Emergency Available</span>
              </label>
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
                placeholder="e.g., Plumbing, HVAC"
              />
              <button
                type="button"
                onClick={addSpecialty}
                className="px-4 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.specialties?.map(specialty => (
                <span
                  key={specialty}
                  className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm flex items-center gap-1"
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
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-gray-500 mr-2">Quick add:</span>
              {commonSpecialties.filter(s => !formData.specialties?.includes(s)).slice(0, 6).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFormData({ ...formData, specialties: [...(formData.specialties || []), s] })}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                >
                  + {s}
                </button>
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
              placeholder="Licenses, certifications, equipment they have, availability..."
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
              {worker ? 'Save Changes' : 'Add Maintenance Worker'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function DispatchModal({
  worker,
  onDispatch,
  onClose
}: {
  worker: MaintenanceWorkerProfile;
  onDispatch: (job: Partial<MaintenanceJob>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    propertyAddress: '',
    propertyName: '',
    jobType: 'General Repair',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'emergency',
    jobDescription: '',
    paymentAmount: worker.hourlyRate * 2,
    scheduledTime: new Date().toISOString().slice(0, 16),
    estimatedDuration: '2 hours',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDispatch({
      workerId: worker.id,
      workerName: worker.name,
      ...formData,
      status: 'pending',
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'normal': return 'border-blue-500 bg-blue-50';
      case 'low': return 'border-gray-400 bg-gray-50';
      default: return 'border-gray-300';
    }
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
              <h2 className="text-xl font-semibold text-[#2D2D2D]">Dispatch Maintenance Job</h2>
              <p className="text-sm text-gray-600">Send to {worker.name}</p>
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
              placeholder="Executive Suite West"
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
                {jobCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.value}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                className={`w-full px-4 py-2 border-2 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent ${getPriorityColor(formData.priority)}`}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="emergency">EMERGENCY</option>
              </select>
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
              placeholder="Describe the issue in detail..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment ($)
              </label>
              <input
                type="number"
                required
                value={formData.paymentAmount}
                onChange={e => setFormData({ ...formData, paymentAmount: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Time
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
                Est. Duration
              </label>
              <select
                value={formData.estimatedDuration}
                onChange={e => setFormData({ ...formData, estimatedDuration: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#500000] focus:border-transparent"
              >
                <option>30 minutes</option>
                <option>1 hour</option>
                <option>1.5 hours</option>
                <option>2 hours</option>
                <option>3 hours</option>
                <option>4+ hours</option>
              </select>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-xl">
            <h4 className="font-medium text-orange-800 mb-2">Steven will:</h4>
            <ul className="text-sm text-orange-700 space-y-1">
              <li className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Text job details with property access info
              </li>
              <li className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4" />
                Call to confirm receipt and availability
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Monitor for confirmation (1hr timeout)
              </li>
              {formData.priority === 'emergency' && (
                <li className="flex items-center gap-2 text-red-600 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  EMERGENCY: Will call immediately!
                </li>
              )}
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
              className={`flex-1 px-4 py-3 text-white rounded-xl font-medium flex items-center justify-center gap-2 ${
                formData.priority === 'emergency'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              <Send className="w-5 h-5" />
              {formData.priority === 'emergency' ? 'DISPATCH EMERGENCY' : 'Dispatch Job'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ============ Main Component ============

export default function MaintenancePage() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'manage' | 'jobs' | 'schedule'>('leaderboard');
  const [workers, setWorkers] = useState<MaintenanceWorkerProfile[]>(mockWorkers);
  const [jobs, setJobs] = useState<MaintenanceJob[]>(mockJobs);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<MaintenanceWorkerProfile | undefined>();
  const [dispatchingWorker, setDispatchingWorker] = useState<MaintenanceWorkerProfile | undefined>();

  // Filter workers by search
  const filteredWorkers = workers.filter(worker =>
    worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    worker.phone.includes(searchQuery) ||
    worker.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort for leaderboard
  const leaderboardWorkers = [...filteredWorkers]
    .filter(w => w.status === 'active')
    .sort((a, b) => {
      const scoreA = a.rating * 0.4 + (a.onTimePercentage / 100) * 0.3 + (a.avgScore / 5) * 0.3;
      const scoreB = b.rating * 0.4 + (b.onTimePercentage / 100) * 0.3 + (b.avgScore / 5) * 0.3;
      return scoreB - scoreA;
    });

  const handleSaveWorker = (data: Partial<MaintenanceWorkerProfile>) => {
    if (editingWorker) {
      setWorkers(workers.map(w =>
        w.id === editingWorker.id ? { ...w, ...data } as MaintenanceWorkerProfile : w
      ));
    } else {
      const newWorker: MaintenanceWorkerProfile = {
        ...data,
        id: Date.now().toString(),
        totalJobs: 0,
        onTimePercentage: 100,
        avgScore: data.rating || 5,
        createdAt: new Date().toISOString().split('T')[0],
      } as MaintenanceWorkerProfile;
      setWorkers([...workers, newWorker]);
    }
    setShowWorkerModal(false);
    setEditingWorker(undefined);
  };

  const handleDeleteWorker = (id: string) => {
    if (confirm('Are you sure you want to remove this maintenance worker?')) {
      setWorkers(workers.filter(w => w.id !== id));
    }
  };

  const handleDispatch = (job: Partial<MaintenanceJob>) => {
    const newJob: MaintenanceJob = {
      ...job,
      id: Date.now().toString(),
      status: 'dispatched',
      dispatchedAt: new Date().toISOString(),
    } as MaintenanceJob;
    setJobs([newJob, ...jobs]);
    setDispatchingWorker(undefined);

    // TODO: Integrate with Steven AI to actually send SMS and make calls
    const priorityMsg = job.priority === 'emergency' ? '\n\n🚨 EMERGENCY - Steven will call IMMEDIATELY!' : '';
    alert(`Job dispatched to ${job.workerName}!${priorityMsg}\n\nSteven will:\n1. Text job details\n2. Call to confirm\n3. Monitor for response`);
  };

  const getStatusColor = (status: MaintenanceJob['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'dispatched': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-amber-100 text-amber-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityBadge = (priority: MaintenanceJob['priority']) => {
    switch (priority) {
      case 'emergency': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'normal': return 'bg-blue-500 text-white';
      case 'low': return 'bg-gray-400 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  return (
    <DashboardShell>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                Maintenance
              </h1>
              <p className="text-[#2D2D2D]/60">
                Manage handymen and dispatch repair jobs
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
            { id: 'manage', label: 'Manage Workers', icon: User },
            { id: 'jobs', label: 'Active Jobs', icon: Send },
            { id: 'schedule', label: 'Schedule', icon: Calendar },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-[#2D2D2D]/70 hover:bg-orange-50'
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
              placeholder="Search workers by name, phone, or specialty..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => {
              setEditingWorker(undefined);
              setShowWorkerModal(true);
            }}
            className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Worker
          </button>
        </div>

        {/* Content */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-2xl p-6 text-white mb-6">
              <h2 className="text-xl font-semibold mb-2">Maintenance Worker Leaderboard</h2>
              <p className="text-white/80">
                Rankings based on rating, on-time performance, and quality scores
              </p>
            </div>

            {leaderboardWorkers.map((worker, index) => (
              <motion.div
                key={worker.id}
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg text-[#2D2D2D]">{worker.name}</h3>
                      {worker.emergency24h && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          24/7 Emergency
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {worker.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Wrench className="w-4 h-4" />
                        {worker.totalJobs} jobs
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${worker.hourlyRate}/hr
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {worker.specialties.slice(0, 4).map(s => (
                        <span key={s} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
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
                        <span className="font-bold text-lg">{worker.rating}</span>
                      </div>
                      <p className="text-xs text-gray-500">Rating</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-green-600">
                        <Clock className="w-5 h-5" />
                        <span className="font-bold text-lg">{worker.onTimePercentage}%</span>
                      </div>
                      <p className="text-xs text-gray-500">On Time</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-blue-600">
                        <TrendingUp className="w-5 h-5" />
                        <span className="font-bold text-lg">{worker.avgScore}</span>
                      </div>
                      <p className="text-xs text-gray-500">Avg Score</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDispatchingWorker(worker)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
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
            {filteredWorkers.map(worker => (
              <motion.div
                key={worker.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-[#2D2D2D]">{worker.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        worker.status === 'active' ? 'bg-green-100 text-green-700' :
                        worker.status === 'on_leave' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {worker.status.replace('_', ' ')}
                      </span>
                      {worker.emergency24h && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          24/7
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="font-medium">{worker.rating}</span>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {worker.phone}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {worker.city}, {worker.state}
                  </p>
                  <p className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    ${worker.hourlyRate}/hr
                  </p>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {worker.specialties.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                      {s}
                    </span>
                  ))}
                </div>

                {worker.notes && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{worker.notes}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingWorker(worker);
                      setShowWorkerModal(true);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm flex items-center justify-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDispatchingWorker(worker)}
                    className="flex-1 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm flex items-center justify-center gap-1"
                  >
                    <Send className="w-4 h-4" />
                    Dispatch
                  </button>
                  <button
                    onClick={() => handleDeleteWorker(worker.id)}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}

            {filteredWorkers.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No maintenance workers found</p>
                <button
                  onClick={() => setShowWorkerModal(true)}
                  className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Add First Worker
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
                <p className="text-sm">Dispatch a job from the Manage Workers tab</p>
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
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#2D2D2D]">{job.propertyName}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityBadge(job.priority)}`}>
                          {job.priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{job.propertyAddress}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Assigned To</p>
                      <p className="font-medium">{job.workerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Job Type</p>
                      <p className="font-medium">{job.jobType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Payment</p>
                      <p className="font-medium text-orange-600">${job.paymentAmount}</p>
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

                  <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                    <span>Est: {job.estimatedDuration}</span>
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
              <p className="text-sm">Calendar view of all maintenance appointments</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showWorkerModal && (
          <WorkerFormModal
            worker={editingWorker}
            onSave={handleSaveWorker}
            onClose={() => {
              setShowWorkerModal(false);
              setEditingWorker(undefined);
            }}
          />
        )}
        {dispatchingWorker && (
          <DispatchModal
            worker={dispatchingWorker}
            onDispatch={handleDispatch}
            onClose={() => setDispatchingWorker(undefined)}
          />
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}
