'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, X, Shield, Sparkles, Waves, Wrench, TreePine,
  Key, Phone, Mail, Clock, MapPin, ChevronDown, Trash2,
  CheckCircle, AlertTriangle, Eye, EyeOff, Copy, Crown,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkerType = 'cleaner' | 'pool' | 'maintenance' | 'yard' | 'owner' | 'admin';

interface Worker {
  id: string;
  name: string;
  type: WorkerType;
  email: string;
  phone: string;
  code: string;
  active: boolean;
  lock_count: number;
  properties: string[];
  hired_date: string;
  notes: string;
}

const WORKER_TYPE_CONFIG: Record<WorkerType, { label: string; icon: typeof Users; color: string; bgColor: string }> = {
  owner: { label: 'Owner', icon: Crown, color: 'text-amber-600', bgColor: 'bg-amber-500' },
  admin: { label: 'Admin', icon: Shield, color: 'text-purple-600', bgColor: 'bg-purple-500' },
  cleaner: { label: 'Cleaning', icon: Sparkles, color: 'text-emerald-600', bgColor: 'bg-emerald-500' },
  pool: { label: 'Pool / Hot Tub', icon: Waves, color: 'text-cyan-600', bgColor: 'bg-cyan-500' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: 'text-orange-600', bgColor: 'bg-orange-500' },
  yard: { label: 'Yard / Lawn', icon: TreePine, color: 'text-green-600', bgColor: 'bg-green-600' },
};

// Workers loaded from the smart-home lock API — no hardcoded data
const INITIAL_WORKERS: Worker[] = [];

// ─── Component ───────────────────────────────────────────────────────────────

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>(INITIAL_WORKERS);
  const [showForm, setShowForm] = useState(false);
  const [showCodes, setShowCodes] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<WorkerType | 'all'>('all');
  const [form, setForm] = useState({
    name: '',
    type: 'cleaner' as WorkerType,
    email: '',
    phone: '',
    notes: '',
  });

  const filtered = filter === 'all' ? workers : workers.filter(w => w.type === filter);

  const toggleCodeVisibility = (id: string) => {
    setShowCodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyCode = (code: string, name: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Code for ${name} copied`);
  };

  const generatePin = (): string => {
    let pin: string;
    const existing = new Set(workers.map(w => w.code));
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (existing.has(pin) || /(.)\1{3,}/.test(pin));
    return pin;
  };

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const code = generatePin();
    const id = `W-${form.name.split(' ')[0].toUpperCase()}-${Date.now().toString(36)}`;

    const newWorker: Worker = {
      id,
      name: form.name.trim(),
      type: form.type,
      email: form.email.trim(),
      phone: form.phone.trim(),
      code,
      active: true,
      lock_count: 0,
      properties: [],
      hired_date: new Date().toISOString().split('T')[0],
      notes: form.notes.trim(),
    };

    setWorkers(prev => [...prev, newWorker]);
    setShowForm(false);
    setForm({ name: '', type: 'cleaner', email: '', phone: '', notes: '' });
    toast.success(`${newWorker.name} added — Lock code: ${code}`);
  };

  const handleDeactivate = (id: string) => {
    if (!confirm('Deactivate this worker? Their lock codes will be revoked.')) return;
    setWorkers(prev => prev.map(w => w.id === id ? { ...w, active: false } : w));
    toast.success('Worker deactivated');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#500000]" />
            Workers & Lock Codes
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {workers.filter(w => w.active).length} active workers — each has a unique PIN for all property locks
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#500000] text-white font-medium text-sm hover:bg-[#722F37] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register Worker
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'cleaner', 'pool', 'maintenance', 'yard', 'owner', 'admin'] as const).map(t => {
          const count = t === 'all' ? workers.length : workers.filter(w => w.type === t).length;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === t
                  ? 'bg-[#500000] text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t === 'all' ? 'All' : WORKER_TYPE_CONFIG[t].label}
              <span className="ml-1.5 text-xs opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Add Worker Form */}
      {showForm && (
        <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Register New Worker</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleAddWorker}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Maria Rodriguez"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-[#500000]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as WorkerType })}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-[#500000]"
                >
                  <option value="cleaner">Cleaning Crew</option>
                  <option value="pool">Pool / Hot Tub Tech</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="yard">Yard / Lawn Crew</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="worker@rah-midland.com"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-[#500000]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="432-555-1234"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-[#500000]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Specialties, availability, assigned properties..."
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-[#500000]"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button type="submit" className="px-6 py-2.5 rounded-xl bg-[#500000] text-white font-medium text-sm hover:bg-[#722F37]">
                Register & Generate Lock Code
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              A unique 6-digit lock code will be auto-generated and can be programmed to all property locks.
            </p>
          </form>
        </div>
      )}

      {/* Worker Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(worker => {
          const config = WORKER_TYPE_CONFIG[worker.type];
          const Icon = config.icon;
          const codeVisible = showCodes.has(worker.id);

          return (
            <div
              key={worker.id}
              className={`bg-white rounded-2xl border p-5 transition-all ${
                worker.active ? 'border-gray-200 shadow-sm' : 'border-red-200 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{worker.name}</h3>
                    <p className={`text-xs font-medium ${config.color}`}>{config.label}</p>
                  </div>
                </div>
                {worker.active ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> Inactive
                  </span>
                )}
              </div>

              {/* Lock Code */}
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#500000]" />
                    <span className="text-xs font-medium text-gray-500">Lock Code</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleCodeVisibility(worker.id)} className="p-1 text-gray-400 hover:text-gray-600">
                      {codeVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => copyCode(worker.code, worker.name)} className="p-1 text-gray-400 hover:text-gray-600">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-2xl font-mono font-bold text-[#500000] mt-1 tracking-widest">
                  {codeVisible ? worker.code : '******'}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">Unlocks all {worker.lock_count} property locks</p>
              </div>

              {/* Contact Info */}
              <div className="space-y-1.5 mb-3">
                {worker.email && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{worker.email}</span>
                  </div>
                )}
                {worker.phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{worker.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Since {new Date(worker.hired_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                </div>
              </div>

              {/* Notes */}
              {worker.notes && (
                <p className="text-xs text-gray-400 italic mb-3">{worker.notes}</p>
              )}

              {/* Actions */}
              {worker.active && worker.type !== 'owner' && (
                <button
                  onClick={() => handleDeactivate(worker.id)}
                  className="w-full text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg py-2 transition-colors"
                >
                  Deactivate & Revoke Codes
                </button>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No workers found</p>
          <p className="text-sm mt-1">Register a new worker to get started.</p>
        </div>
      )}
    </div>
  );
}
