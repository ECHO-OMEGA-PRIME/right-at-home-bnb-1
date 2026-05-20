'use client';

import { useState } from 'react';
import {
  FileText, DollarSign, Calendar, AlertTriangle, CheckCircle,
  Clock, Download, ChevronRight, Building2, Users, TrendingUp,
  ArrowUpRight, Filter, Eye, Send
} from 'lucide-react';

const formatMoney = (cents: number) =>
  '$' + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

type FilingStatus = 'filed' | 'upcoming' | 'overdue' | 'paid';

interface TaxObligation {
  id: string;
  name: string;
  type: 'occupancy' | 'payroll' | 'federal' | 'state' | 'property';
  frequency: 'monthly' | 'quarterly' | 'annual';
  dueDate: string;
  amount: number;
  status: FilingStatus;
  filedDate?: string;
  confirmationNumber?: string;
  notes?: string;
}

const obligations: TaxObligation[] = [
  { id: 'T01', name: 'Hotel Occupancy Tax (HOT) — City of Midland', type: 'occupancy', frequency: 'monthly', dueDate: '2026-03-20', amount: 1240000, status: 'upcoming', notes: '7% of gross room revenue' },
  { id: 'T02', name: 'Hotel Occupancy Tax (HOT) — State of Texas', type: 'occupancy', frequency: 'monthly', dueDate: '2026-03-20', amount: 960000, status: 'upcoming', notes: '6% of gross room revenue' },
  { id: 'T03', name: 'Form 941 — Federal Payroll Tax', type: 'payroll', frequency: 'quarterly', dueDate: '2026-04-30', amount: 1488000, status: 'upcoming', notes: 'Q1 2026 (Jan-Mar)' },
  { id: 'T04', name: 'TWC Unemployment Tax', type: 'payroll', frequency: 'quarterly', dueDate: '2026-04-30', amount: 186000, status: 'upcoming', notes: 'Texas Workforce Commission' },
  { id: 'T05', name: 'Federal Estimated Tax (1040-ES)', type: 'federal', frequency: 'quarterly', dueDate: '2026-04-15', amount: 3500000, status: 'upcoming', notes: 'Q1 2026 estimated payment' },
  { id: 'T06', name: 'TX Franchise Tax', type: 'state', frequency: 'annual', dueDate: '2026-05-15', amount: 0, status: 'upcoming', notes: 'No Tax Due — revenue under $2.47M threshold' },
  { id: 'T07', name: 'Midland County Property Tax', type: 'property', frequency: 'annual', dueDate: '2026-01-31', amount: 8900000, status: 'paid', filedDate: '2026-01-28', confirmationNumber: 'MID-2026-44821' },
  { id: 'T08', name: 'HOT — City of Midland (Feb)', type: 'occupancy', frequency: 'monthly', dueDate: '2026-02-20', amount: 1180000, status: 'filed', filedDate: '2026-02-18', confirmationNumber: 'HOT-2026-0218' },
  { id: 'T09', name: 'HOT — State of Texas (Feb)', type: 'occupancy', frequency: 'monthly', dueDate: '2026-02-20', amount: 912000, status: 'filed', filedDate: '2026-02-18', confirmationNumber: 'TX-HOT-0218' },
  { id: 'T10', name: 'Form 941 — Q4 2025', type: 'payroll', frequency: 'quarterly', dueDate: '2026-01-31', amount: 1410000, status: 'filed', filedDate: '2026-01-29', confirmationNumber: '941-Q4-2025' },
  { id: 'T11', name: 'HOT — City of Midland (Jan)', type: 'occupancy', frequency: 'monthly', dueDate: '2026-01-20', amount: 1100000, status: 'filed', filedDate: '2026-01-18', confirmationNumber: 'HOT-2026-0118' },
  { id: 'T12', name: 'HOT — State of Texas (Jan)', type: 'occupancy', frequency: 'monthly', dueDate: '2026-01-20', amount: 848000, status: 'filed', filedDate: '2026-01-18', confirmationNumber: 'TX-HOT-0118' },
  { id: 'T13', name: 'W-2 / 1099 Filing', type: 'payroll', frequency: 'annual', dueDate: '2026-01-31', amount: 0, status: 'filed', filedDate: '2026-01-25', confirmationNumber: 'W2-2025-BATCH' },
];

const statusStyles: Record<FilingStatus, { bg: string; text: string; icon: typeof CheckCircle }> = {
  filed: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  paid: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  upcoming: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
  overdue: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
};

const typeLabels: Record<TaxObligation['type'], string> = {
  occupancy: 'Occupancy Tax',
  payroll: 'Payroll Tax',
  federal: 'Federal Tax',
  state: 'State Tax',
  property: 'Property Tax',
};

const typeColors: Record<TaxObligation['type'], string> = {
  occupancy: 'bg-maroon-100 text-maroon-800',
  payroll: 'bg-blue-100 text-blue-700',
  federal: 'bg-purple-100 text-purple-700',
  state: 'bg-orange-100 text-orange-700',
  property: 'bg-green-100 text-green-700',
};

export default function TaxDashboard() {
  const [filterType, setFilterType] = useState<TaxObligation['type'] | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<FilingStatus | 'all'>('all');

  const filtered = obligations
    .filter(o => filterType === 'all' || o.type === filterType)
    .filter(o => filterStatus === 'all' || o.status === filterStatus);

  const upcoming = obligations.filter(o => o.status === 'upcoming');
  const upcomingTotal = upcoming.reduce((s, o) => s + o.amount, 0);
  const ytdPaid = obligations.filter(o => o.status === 'filed' || o.status === 'paid').reduce((s, o) => s + o.amount, 0);

  const hotMonthly = obligations.filter(o => o.type === 'occupancy' && o.status === 'upcoming').reduce((s, o) => s + o.amount, 0);
  const payrollQuarterly = obligations.filter(o => o.type === 'payroll' && o.status === 'upcoming').reduce((s, o) => s + o.amount, 0);

  const nextDue = upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const daysUntilNext = nextDue ? Math.max(0, Math.ceil((new Date(nextDue.dueDate).getTime() - Date.now()) / 86400000)) : 0;

  const summaryCards = [
    { label: 'Upcoming Tax Due', value: formatMoney(upcomingTotal), sub: `${upcoming.length} obligations pending`, icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'YTD Taxes Paid', value: formatMoney(ytdPaid), sub: '2026 year to date', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Next Due Date', value: nextDue?.dueDate || '--', sub: `${daysUntilNext} days away`, icon: Calendar, color: 'text-maroon-800', bg: 'bg-maroon-50' },
    { label: 'Monthly HOT Due', value: formatMoney(hotMonthly), sub: 'City + State occupancy', icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="min-h-screen bg-cream-100 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-800">Tax Dashboard</h1>
          <p className="text-charcoal-400 mt-1">Occupancy tax, payroll tax, federal estimates, and filing history</p>
        </div>
        <button className="flex items-center gap-2 bg-maroon-800 hover:bg-maroon-700 text-white px-4 py-2 rounded-lg transition-colors">
          <Download className="w-4 h-4" /> Export Tax Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl shadow-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`${card.bg} p-3 rounded-lg`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-sm text-charcoal-400 mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-charcoal-800">{card.value}</p>
              <p className="text-xs text-charcoal-400 mt-1">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Upcoming Deadlines Alert */}
      {upcoming.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Upcoming Tax Deadlines</p>
              <div className="mt-2 space-y-1">
                {upcoming.slice(0, 4).map(o => (
                  <p key={o.id} className="text-sm text-yellow-700">
                    <span className="font-medium">{o.dueDate}</span> — {o.name} ({formatMoney(o.amount)})
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tax Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-maroon-50 p-2 rounded-lg"><Building2 className="w-5 h-5 text-maroon-800" /></div>
            <div>
              <p className="font-semibold text-charcoal-800">Occupancy Tax (HOT)</p>
              <p className="text-xs text-charcoal-400">City 7% + State 6% = 13% of gross room revenue</p>
            </div>
          </div>
          <p className="text-lg font-bold text-charcoal-800">{formatMoney(hotMonthly)}<span className="text-sm font-normal text-charcoal-400">/month</span></p>
          <p className="text-xs text-charcoal-400 mt-1">Due 20th of each month for prior month</p>
        </div>
        <div className="bg-white rounded-xl shadow-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-50 p-2 rounded-lg"><Users className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="font-semibold text-charcoal-800">Payroll Tax (941)</p>
              <p className="text-xs text-charcoal-400">Fed withholding + FICA (employer + employee)</p>
            </div>
          </div>
          <p className="text-lg font-bold text-charcoal-800">{formatMoney(payrollQuarterly)}<span className="text-sm font-normal text-charcoal-400">/quarter</span></p>
          <p className="text-xs text-charcoal-400 mt-1">Form 941 due end of month after quarter</p>
        </div>
        <div className="bg-white rounded-xl shadow-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-purple-50 p-2 rounded-lg"><DollarSign className="w-5 h-5 text-purple-600" /></div>
            <div>
              <p className="font-semibold text-charcoal-800">Federal Estimates</p>
              <p className="text-xs text-charcoal-400">1040-ES quarterly estimated payments</p>
            </div>
          </div>
          <p className="text-lg font-bold text-charcoal-800">{formatMoney(3500000)}<span className="text-sm font-normal text-charcoal-400">/quarter</span></p>
          <p className="text-xs text-charcoal-400 mt-1">Due Apr 15, Jun 15, Sep 15, Jan 15</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-charcoal-500">Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="border border-charcoal-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-800"
          >
            <option value="all">All Types</option>
            {Object.entries(typeLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-charcoal-500">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="border border-charcoal-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-800"
          >
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="filed">Filed</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Filing History Table */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="p-6 pb-4">
          <h2 className="text-lg font-bold text-charcoal-800">Tax Obligations & Filing History</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream-100 border-b border-charcoal-200">
              <th className="text-left py-3 px-4 font-medium text-charcoal-600">Obligation</th>
              <th className="text-left py-3 px-4 font-medium text-charcoal-600">Type</th>
              <th className="text-left py-3 px-4 font-medium text-charcoal-600">Frequency</th>
              <th className="text-left py-3 px-4 font-medium text-charcoal-600">Due Date</th>
              <th className="text-right py-3 px-4 font-medium text-charcoal-600">Amount</th>
              <th className="text-center py-3 px-4 font-medium text-charcoal-600">Status</th>
              <th className="text-left py-3 px-4 font-medium text-charcoal-600">Confirmation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ob) => {
              const StatusIcon = statusStyles[ob.status].icon;
              return (
                <tr key={ob.id} className="border-b border-charcoal-100 hover:bg-cream-100 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-medium text-charcoal-800">{ob.name}</p>
                    {ob.notes && <p className="text-xs text-charcoal-400">{ob.notes}</p>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${typeColors[ob.type]}`}>
                      {typeLabels[ob.type]}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-charcoal-600 capitalize">{ob.frequency}</td>
                  <td className="py-3 px-4 text-charcoal-700 font-medium">{ob.dueDate}</td>
                  <td className="py-3 px-4 text-right font-medium text-charcoal-800">
                    {ob.amount > 0 ? formatMoney(ob.amount) : 'No Tax Due'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium capitalize ${statusStyles[ob.status].bg} ${statusStyles[ob.status].text}`}>
                      <StatusIcon className="w-3 h-3" /> {ob.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-charcoal-500 text-xs">
                    {ob.confirmationNumber ? (
                      <div>
                        <p className="font-mono">{ob.confirmationNumber}</p>
                        {ob.filedDate && <p className="text-charcoal-400">Filed {ob.filedDate}</p>}
                      </div>
                    ) : (
                      ob.status === 'upcoming' && (
                        <button className="flex items-center gap-1 text-maroon-800 hover:underline">
                          <Send className="w-3 h-3" /> File Now
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Texas Notes */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-800 mb-1">Texas Tax Notes</p>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Texas has NO state income tax. No personal or corporate income tax filings required.</li>
          <li>TX Franchise Tax: No tax due if total revenue is under $2.47M (2026 threshold).</li>
          <li>Hotel Occupancy Tax: City of Midland (7%) + State of Texas (6%) = 13% of gross room revenue.</li>
          <li>Payroll: Federal withholding + FICA required. No state withholding (no state income tax).</li>
          <li>Property taxes due January 31st. Midland CAD appraisal protest deadline: May 15th.</li>
        </ul>
      </div>
    </div>
  );
}
