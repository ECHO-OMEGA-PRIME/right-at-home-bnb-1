'use client';

import { useState } from 'react';
import {
  Users,
  DollarSign,
  Calendar,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  Download,
  UserPlus,
  Briefcase,
  FileText,
  ArrowUpRight,
  Timer,
  CreditCard,
} from 'lucide-react';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

interface Employee {
  id: string;
  name: string;
  role: string;
  type: 'full-time' | 'part-time' | 'contractor';
  hourlyRate: number;
  hoursThisPeriod: number;
  overtimeHours: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  status: 'active' | 'on-leave' | 'terminated';
  startDate: string;
  email: string;
  phone: string;
}

interface PayrollRun {
  id: string;
  period: string;
  payDate: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeeCount: number;
  status: 'completed' | 'processing' | 'scheduled' | 'draft';
}

// Employees loaded from database — add via employee management
const employees: Employee[] = [];

// Payroll history loaded from database
const payrollHistory: PayrollRun[] = [];

const totalEmployees = employees.filter((e) => e.status === 'active').length;
const totalGrossPay = employees.reduce((s, e) => s + e.grossPay, 0);
const totalDeductions = employees.reduce((s, e) => s + e.deductions, 0);
const totalNetPay = employees.reduce((s, e) => s + e.netPay, 0);
const totalHours = employees.reduce((s, e) => s + e.hoursThisPeriod + e.overtimeHours, 0);
const totalOT = employees.reduce((s, e) => s + e.overtimeHours, 0);

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  'on-leave': 'bg-amber-100 text-amber-700',
  terminated: 'bg-red-100 text-red-700',
};

const typeColors: Record<string, string> = {
  'full-time': 'bg-blue-100 text-blue-700',
  'part-time': 'bg-purple-100 text-purple-700',
  contractor: 'bg-gray-100 text-gray-600',
};

const payrollStatusColors: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  processing: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-600',
};

export default function PayrollDashboard() {
  const [showRunPayroll, setShowRunPayroll] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'employees' | 'history'>('employees');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">
            Right at Home BnB &middot; {totalEmployees} active employees
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRunPayroll(true)}
            className="flex items-center gap-1.5 text-sm bg-[#500000] text-white px-4 py-2 rounded-lg hover:bg-[#3C1518] transition-colors"
          >
            <Play className="w-4 h-4" />
            Run Payroll
          </button>
          <button className="flex items-center gap-1.5 text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <UserPlus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Employees</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400">
              {employees.filter((e) => e.type === 'full-time').length} FT,{' '}
              {employees.filter((e) => e.type === 'part-time').length} PT,{' '}
              {employees.filter((e) => e.type === 'contractor').length} 1099
            </span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Next Pay Date</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">Mar 20</p>
          <p className="text-xs text-gray-400 mt-1">3 days from now</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Gross Payroll</span>
            <div className="w-8 h-8 rounded-lg bg-[#500000]/5 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[#500000]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(totalGrossPay)}</p>
          <div className="flex items-center gap-1 mt-1">
            <ArrowUpRight className="w-3 h-3 text-amber-500" />
            <span className="text-xs text-amber-600">+2.0% vs last period</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total Hours</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Timer className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalHours}h</p>
          <p className="text-xs text-gray-400 mt-1">{totalOT}h overtime</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Net Payroll</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatMoney(totalNetPay)}</p>
          <p className="text-xs text-gray-400 mt-1">After {formatMoney(totalDeductions)} deductions</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setSelectedTab('employees')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'employees'
                ? 'border-[#500000] text-[#500000] bg-[#500000]/5'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" />
            Employee List
          </button>
          <button
            onClick={() => setSelectedTab('history')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'history'
                ? 'border-[#500000] text-[#500000] bg-[#500000]/5'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Payroll History
          </button>
        </div>

        {/* Employee List */}
        {selectedTab === 'employees' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Employee</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Type</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Rate</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Hours</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">OT</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Gross Pay</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Deductions</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Net Pay</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#500000]/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[#500000]">
                            {emp.name.split(' ').map((n) => n[0]).join('')}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-700">{emp.role}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[emp.type]}`}>
                        {emp.type === 'full-time' ? 'Full-Time' : emp.type === 'part-time' ? 'Part-Time' : '1099'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {emp.hourlyRate > 0 ? `${formatMoney(emp.hourlyRate)}/hr` : 'Salary'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm text-gray-700">{emp.hoursThisPeriod || '--'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`text-sm ${emp.overtimeHours > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                        {emp.overtimeHours > 0 ? `${emp.overtimeHours}h` : '--'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-gray-900">{formatMoney(emp.grossPay)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm text-red-600">
                        {emp.deductions > 0 ? `-${formatMoney(emp.deductions)}` : '--'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-emerald-600">{formatMoney(emp.netPay)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[emp.status]}`}>
                        {emp.status === 'on-leave' ? 'On Leave' : emp.status.charAt(0).toUpperCase() + emp.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td colSpan={4} className="px-5 py-3 text-sm font-bold text-gray-900">TOTALS</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                    {employees.reduce((s, e) => s + e.hoursThisPeriod, 0)}h
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-amber-600">{totalOT}h</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">{formatMoney(totalGrossPay)}</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-red-600">-{formatMoney(totalDeductions)}</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-emerald-600">{formatMoney(totalNetPay)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Payroll History */}
        {selectedTab === 'history' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Run ID</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Pay Period</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Pay Date</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Employees</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Gross</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Deductions</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Net</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payrollHistory.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-mono text-[#500000] font-medium">{run.id}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-gray-700">{run.period}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {new Date(run.payDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm text-gray-700">{run.employeeCount}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-medium text-gray-900">{formatMoney(run.totalGross)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm text-red-600">-{formatMoney(run.totalDeductions)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-emerald-600">{formatMoney(run.totalNet)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${payrollStatusColors[run.status]}`}>
                        {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 text-gray-400 hover:text-[#500000] hover:bg-[#500000]/5 rounded-lg transition-colors" title="View Details">
                          <FileText className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-[#500000] hover:bg-[#500000]/5 rounded-lg transition-colors" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payroll Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Department */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Payroll by Role</h3>
          <div className="space-y-3">
            {[
              { role: 'Management', count: 2, gross: employees.filter((e) => e.role.includes('Manager') || e.role.includes('Owner')).reduce((s, e) => s + e.grossPay, 0) },
              { role: 'Maintenance', count: 2, gross: employees.filter((e) => e.role.includes('Maintenance')).reduce((s, e) => s + e.grossPay, 0) },
              { role: 'Cleaning', count: 3, gross: employees.filter((e) => e.role.includes('Clean') || e.role.includes('Laundry')).reduce((s, e) => s + e.grossPay, 0) },
              { role: 'Guest Relations', count: 1, gross: employees.filter((e) => e.role.includes('Guest')).reduce((s, e) => s + e.grossPay, 0) },
              { role: 'Contractors', count: 1, gross: employees.filter((e) => e.type === 'contractor').reduce((s, e) => s + e.grossPay, 0) },
            ].map((dept) => {
              const pct = (dept.gross / totalGrossPay) * 100;
              return (
                <div key={dept.role}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">{dept.role}</span>
                      <span className="text-xs text-gray-400">({dept.count})</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{formatMoney(dept.gross)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-[#500000] h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(1)}% of total</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Payroll Metrics</h3>
          <div className="space-y-3">
            {[
              { label: 'Avg Hourly Rate', value: formatMoney(Math.round(employees.filter((e) => e.hourlyRate > 0).reduce((s, e) => s + e.hourlyRate, 0) / employees.filter((e) => e.hourlyRate > 0).length)), sub: 'Excluding salaried' },
              { label: 'Payroll as % of Revenue', value: `${((totalGrossPay / 18745200) * 100).toFixed(1)}%`, sub: 'Target: <15%' },
              { label: 'Cost per Property', value: formatMoney(Math.round(totalGrossPay / 22)), sub: 'Per pay period' },
              { label: 'Overtime Cost', value: formatMoney(employees.reduce((s, e) => s + (e.overtimeHours * e.hourlyRate * 1.5), 0)), sub: `${totalOT} total OT hours` },
              { label: 'Tax Withholding Rate', value: `${((totalDeductions / totalGrossPay) * 100).toFixed(1)}%`, sub: 'Federal + State + FICA' },
              { label: 'Next Payroll Due', value: 'Mar 20, 2026', sub: 'Semi-monthly schedule' },
            ].map((metric) => (
              <div key={metric.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm text-gray-700">{metric.label}</p>
                  <p className="text-xs text-gray-400">{metric.sub}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Run Payroll Modal */}
      {showRunPayroll && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Run Payroll</h2>
              <p className="text-xs text-gray-500 mt-0.5">Pay period: March 1-15, 2026</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-[#500000]/5 rounded-lg p-4 border border-[#500000]/20">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-[#500000] font-medium">Gross</p>
                    <p className="text-lg font-bold text-[#500000]">{formatMoney(totalGrossPay)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-red-600 font-medium">Deductions</p>
                    <p className="text-lg font-bold text-red-600">-{formatMoney(totalDeductions)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Net</p>
                    <p className="text-lg font-bold text-emerald-600">{formatMoney(totalNetPay)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Employees to pay</span>
                  <span className="font-medium">{employees.filter((e) => e.status === 'active').length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Pay date</span>
                  <span className="font-medium">March 20, 2026</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Payment method</span>
                  <span className="font-medium">Direct Deposit</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Federal taxes</span>
                  <span className="font-medium">{formatMoney(Math.round(totalDeductions * 0.55))}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">State taxes (TX)</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">FICA / Medicare</span>
                  <span className="font-medium">{formatMoney(Math.round(totalDeductions * 0.45))}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-amber-50 rounded-lg p-3 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700">
                  <p className="font-medium">Review before processing</p>
                  <p className="mt-0.5">Payroll will be submitted for processing. Direct deposits will be initiated 2 business days before pay date.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowRunPayroll(false)}
                className="text-sm text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowRunPayroll(false)}
                className="flex items-center gap-1.5 text-sm bg-[#500000] text-white px-4 py-2 rounded-lg hover:bg-[#3C1518] transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
