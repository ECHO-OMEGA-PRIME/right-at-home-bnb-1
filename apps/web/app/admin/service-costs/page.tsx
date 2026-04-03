'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Phone,
  Cloud,
  Database,
  Bot,
  Mail,
  Globe,
  Server,
  Plus,
  X,
  Filter,
  TrendingUp,
  CreditCard,
  Gift,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface ServiceCost {
  id: string;
  service: string;
  category: string;
  description: string;
  monthlyCost: number;
  billingCycle: string;
  status: string;
  usageMetric?: string;
  currentUsage?: number;
  usageLimit?: number;
  notes?: string;
  lastBilled?: string;
}

interface Summary {
  totalMonthly: number;
  totalAnnual: number;
  activeServices: number;
  freeServices: number;
  totalServices: number;
  byCategory: Record<string, { count: number; monthly: number; services: string[] }>;
}

// ── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  communications: '#ef4444',
  hosting: '#3b82f6',
  database: '#8b5cf6',
  ai: '#f59e0b',
  email: '#10b981',
  other: '#6b7280',
};

const CATEGORY_LABELS: Record<string, string> = {
  communications: 'Communications',
  hosting: 'Hosting',
  database: 'Database',
  ai: 'AI',
  email: 'Email',
  other: 'Other',
};

const CATEGORY_ICONS: Record<string, typeof DollarSign> = {
  communications: Phone,
  hosting: Cloud,
  database: Database,
  ai: Bot,
  email: Mail,
  other: Globe,
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: typeof CheckCircle }> = {
  active: { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle },
  'free-tier': { color: 'text-blue-700', bg: 'bg-blue-100', icon: Gift },
  trial: { color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
  cancelled: { color: 'text-gray-500', bg: 'bg-gray-100', icon: XCircle },
};

const BILLING_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
  'usage-based': 'Usage-Based',
  free: 'Free',
};

const ALL_CATEGORIES = ['all', 'communications', 'hosting', 'database', 'ai', 'email', 'other'];

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ServiceCostsPage() {
  const [services, setServices] = useState<ServiceCost[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState<string>('');

  // Form state for adding new service
  const [newService, setNewService] = useState({
    service: '',
    category: 'hosting',
    description: '',
    monthlyCost: 0,
    billingCycle: 'monthly' as string,
    status: 'active' as string,
    usageMetric: '',
    currentUsage: 0,
    usageLimit: 0,
    notes: '',
  });

  async function fetchServices(category?: string) {
    try {
      setLoading(true);
      const url = category && category !== 'all'
        ? `/api/service-costs?category=${category}`
        : '/api/service-costs';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setServices(data.services);
      setSummary(data.summary);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchServices();
  }, []);

  const filteredServices = useMemo(() => {
    if (activeFilter === 'all') return services;
    return services.filter((s) => s.category === activeFilter);
  }, [services, activeFilter]);

  const filteredSummary = useMemo(() => {
    if (!summary) return null;
    if (activeFilter === 'all') return summary;
    const filtered = services.filter((s) => s.category === activeFilter);
    const totalMonthly = filtered.reduce((sum, s) => sum + s.monthlyCost, 0);
    return {
      ...summary,
      totalMonthly: Math.round(totalMonthly * 100) / 100,
      totalAnnual: Math.round(totalMonthly * 12 * 100) / 100,
      activeServices: filtered.filter((s) => s.status === 'active' || s.status === 'trial').length,
      freeServices: filtered.filter((s) => s.status === 'free-tier').length,
      totalServices: filtered.length,
    };
  }, [summary, services, activeFilter]);

  async function handleAddService() {
    if (!newService.service || !newService.description) return;
    try {
      const res = await fetch('/api/service-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newService,
          usageMetric: newService.usageMetric || undefined,
          currentUsage: newService.currentUsage || undefined,
          usageLimit: newService.usageLimit || undefined,
          notes: newService.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to add service');
      setShowAddModal(false);
      setNewService({
        service: '',
        category: 'hosting',
        description: '',
        monthlyCost: 0,
        billingCycle: 'monthly',
        status: 'active',
        usageMetric: '',
        currentUsage: 0,
        usageLimit: 0,
        notes: '',
      });
      await fetchServices();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleInlineEdit(service: ServiceCost) {
    const newCost = parseFloat(editCost);
    if (isNaN(newCost) || newCost < 0) {
      setEditingId(null);
      return;
    }
    try {
      const res = await fetch('/api/service-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...service,
          monthlyCost: newCost,
          status: newCost === 0 ? 'free-tier' : service.status === 'free-tier' ? 'active' : service.status,
          billingCycle: newCost === 0 ? 'free' : service.billingCycle === 'free' ? 'monthly' : service.billingCycle,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setEditingId(null);
      await fetchServices();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading && services.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#500000]" />
      </div>
    );
  }

  if (error && services.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">Failed to load service costs</p>
        <button onClick={() => fetchServices()} className="px-4 py-2 bg-[#500000] text-white rounded-lg text-sm">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Costs</h1>
          <p className="text-sm text-gray-500">Monthly tech service expenses for Right at Home BnB</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#500000] text-white rounded-lg hover:bg-[#3C1518] text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>

      {/* Summary Cards */}
      {filteredSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Monthly</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(filteredSummary.totalMonthly)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Annual</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(filteredSummary.totalAnnual)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-lg">
                <CreditCard className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Active / Paid</p>
                <p className="text-xl font-bold text-gray-900">{filteredSummary.activeServices}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-100 rounded-lg">
                <Gift className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Free Tier</p>
                <p className="text-xl font-bold text-gray-900">{filteredSummary.freeServices}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400 mr-1" />
          {ALL_CATEGORIES.map((cat) => {
            const isActive = activeFilter === cat;
            const label = cat === 'all' ? 'All' : CATEGORY_LABELS[cat] || cat;
            const color = cat === 'all' ? '#500000' : CATEGORY_COLORS[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? 'text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
                style={isActive ? { backgroundColor: color } : undefined}
              >
                {label}
              </button>
            );
          })}
          <span className="text-sm text-gray-500 ml-auto">{filteredServices.length} services</span>
        </div>
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredServices.map((svc) => {
          const Icon = CATEGORY_ICONS[svc.category] || Server;
          const catColor = CATEGORY_COLORS[svc.category] || '#6b7280';
          const statusCfg = STATUS_CONFIG[svc.status] || STATUS_CONFIG.active;
          const StatusIcon = statusCfg.icon;
          const usagePct = svc.usageLimit && svc.currentUsage
            ? Math.min((svc.currentUsage / svc.usageLimit) * 100, 100)
            : null;

          return (
            <div key={svc.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: catColor + '15' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: catColor }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{svc.service}</h3>
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: catColor + '15', color: catColor }}
                    >
                      {CATEGORY_LABELS[svc.category] || svc.category}
                    </span>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {svc.status === 'free-tier' ? 'Free' : svc.status.charAt(0).toUpperCase() + svc.status.slice(1)}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{svc.description}</p>

              {/* Cost */}
              <div className="flex items-baseline gap-2 mb-3">
                {editingId === svc.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleInlineEdit(svc);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm font-bold text-gray-900"
                      autoFocus
                    />
                    <span className="text-xs text-gray-400">/mo</span>
                    <button onClick={() => handleInlineEdit(svc)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(svc.monthlyCost)}
                    </span>
                    <span className="text-xs text-gray-400">/mo</span>
                    <button
                      onClick={() => { setEditingId(svc.id); setEditCost(svc.monthlyCost.toString()); }}
                      className="text-xs text-gray-400 hover:text-[#500000] ml-auto"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>

              {/* Billing cycle */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>Billing: {BILLING_LABELS[svc.billingCycle] || svc.billingCycle}</span>
                {svc.lastBilled && <span>Last: {new Date(svc.lastBilled).toLocaleDateString()}</span>}
              </div>

              {/* Usage bar */}
              {usagePct !== null && svc.usageMetric && (
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{svc.usageMetric}</span>
                    <span>{svc.currentUsage?.toLocaleString()} / {svc.usageLimit?.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${usagePct}%`,
                        backgroundColor: usagePct > 80 ? '#ef4444' : usagePct > 50 ? '#f59e0b' : '#10b981',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              {svc.notes && (
                <p className="text-xs text-gray-400 mt-3 italic">{svc.notes}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Category Breakdown Table */}
      {summary && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Monthly Cost Breakdown by Category</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">Category</th>
                <th className="px-6 py-3 text-center font-semibold text-gray-600">Services</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">Monthly</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">Annual</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b.monthly - a.monthly)
                .map(([cat, data], i) => {
                  const Icon = CATEGORY_ICONS[cat] || Server;
                  const color = CATEGORY_COLORS[cat] || '#6b7280';
                  const pct = summary.totalMonthly > 0 ? ((data.monthly / summary.totalMonthly) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={cat} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: color + '15' }}
                          >
                            <Icon className="w-3.5 h-3.5" style={{ color }} />
                          </div>
                          <span className="font-medium text-gray-900">{CATEGORY_LABELS[cat] || cat}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center text-gray-600">{data.count}</td>
                      <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatCurrency(data.monthly)}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{formatCurrency(data.monthly * 12)}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className="px-6 py-3 font-bold text-gray-900">Total</td>
                <td className="px-6 py-3 text-center font-semibold text-gray-700">{summary.totalServices}</td>
                <td className="px-6 py-3 text-right font-bold text-gray-900">{formatCurrency(summary.totalMonthly)}</td>
                <td className="px-6 py-3 text-right font-bold text-gray-900">{formatCurrency(summary.totalAnnual)}</td>
                <td className="px-6 py-3 text-right font-bold text-gray-700">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Add Service Cost</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Service Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                <input
                  type="text"
                  value={newService.service}
                  onChange={(e) => setNewService((p) => ({ ...p, service: e.target.value }))}
                  placeholder="e.g., Stripe, OpenAI, AWS..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Category + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={newService.category}
                    onChange={(e) => setNewService((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="communications">Communications</option>
                    <option value="hosting">Hosting</option>
                    <option value="database">Database</option>
                    <option value="ai">AI</option>
                    <option value="email">Email</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={newService.status}
                    onChange={(e) => setNewService((p) => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="free-tier">Free Tier</option>
                    <option value="trial">Trial</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newService.description}
                  onChange={(e) => setNewService((p) => ({ ...p, description: e.target.value }))}
                  placeholder="What is this service used for?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Monthly Cost + Billing Cycle */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newService.monthlyCost}
                    onChange={(e) => setNewService((p) => ({ ...p, monthlyCost: parseFloat(e.target.value || '0') }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
                  <select
                    value={newService.billingCycle}
                    onChange={(e) => setNewService((p) => ({ ...p, billingCycle: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                    <option value="usage-based">Usage-Based</option>
                    <option value="free">Free</option>
                  </select>
                </div>
              </div>

              {/* Usage Metric */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usage Metric</label>
                  <input
                    type="text"
                    value={newService.usageMetric}
                    onChange={(e) => setNewService((p) => ({ ...p, usageMetric: e.target.value }))}
                    placeholder="e.g., requests/mo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Usage</label>
                  <input
                    type="number"
                    min="0"
                    value={newService.currentUsage}
                    onChange={(e) => setNewService((p) => ({ ...p, currentUsage: parseInt(e.target.value || '0') }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit</label>
                  <input
                    type="number"
                    min="0"
                    value={newService.usageLimit}
                    onChange={(e) => setNewService((p) => ({ ...p, usageLimit: parseInt(e.target.value || '0') }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newService.notes}
                  onChange={(e) => setNewService((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional notes about pricing, plan limits, etc."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddService}
                  className="px-4 py-2 bg-[#500000] text-white rounded-lg text-sm hover:bg-[#3C1518] font-medium"
                >
                  Add Service
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
