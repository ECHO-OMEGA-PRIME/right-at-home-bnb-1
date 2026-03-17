'use client';

import { useState, useMemo } from 'react';
import {
  DollarSign,
  Calendar,
  Users,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Edit2,
  Save,
  X,
} from 'lucide-react';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

interface Employee {
  id: string;
  name: string;
  role: string;
  hourlyRate: number;
  regularHours: number;
  overtimeHours: number;
  ytdGross: number;
}

interface PayrollCalculation {
  employeeId: string;
  name: string;
  role: string;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  federalTax: number;
  socialSecurity: number;
  medicare: number;
  stateTax: number;
  totalDeductions: number;
  netPay: number;
}

const MOCK_EMPLOYEES: Employee[] = [
  { id: 'E001', name: 'Maria Garcia', role: 'Cleaner', hourlyRate: 1800, regularHours: 40, overtimeHours: 4, ytdGross: 1920000 },
  { id: 'E002', name: 'James Wilson', role: 'Maintenance', hourlyRate: 2200, regularHours: 40, overtimeHours: 8, ytdGross: 2640000 },
  { id: 'E003', name: 'Aisha Patel', role: 'Cleaner', hourlyRate: 1800, regularHours: 38, overtimeHours: 0, ytdGross: 1728000 },
  { id: 'E004', name: 'Robert Chen', role: 'Inspector', hourlyRate: 2500, regularHours: 40, overtimeHours: 2, ytdGross: 3120000 },
  { id: 'E005', name: 'Sarah Johnson', role: 'Manager', hourlyRate: 3200, regularHours: 40, overtimeHours: 6, ytdGross: 4224000 },
  { id: 'E006', name: 'Carlos Mendez', role: 'Maintenance', hourlyRate: 2000, regularHours: 40, overtimeHours: 3, ytdGross: 2280000 },
  { id: 'E007', name: 'Linda Thompson', role: 'Cleaner', hourlyRate: 1700, regularHours: 32, overtimeHours: 0, ytdGross: 1305600 },
  { id: 'E008', name: 'David Okonkwo', role: 'Cleaner', hourlyRate: 1800, regularHours: 40, overtimeHours: 2, ytdGross: 1872000 },
  { id: 'E009', name: 'Jennifer Martinez', role: 'Inspector', hourlyRate: 2400, regularHours: 40, overtimeHours: 0, ytdGross: 2880000 },
  { id: 'E010', name: 'Michael Brown', role: 'Maintenance', hourlyRate: 2100, regularHours: 40, overtimeHours: 5, ytdGross: 2520000 },
];

const SS_RATE = 0.062;
const SS_CAP_CENTS = 16860000;
const MEDICARE_RATE = 0.0145;

function calculateFederalTax(annualizedGross: number): number {
  const brackets = [
    { limit: 1160000, rate: 0.10 },
    { limit: 4727500, rate: 0.12 },
    { limit: 10063000, rate: 0.22 },
    { limit: 19175000, rate: 0.24 },
    { limit: 24350000, rate: 0.32 },
    { limit: 60962500, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ];
  let tax = 0;
  let remaining = annualizedGross;
  let prev = 0;
  for (const bracket of brackets) {
    const taxable = Math.min(remaining, bracket.limit - prev);
    if (taxable <= 0) break;
    tax += taxable * bracket.rate;
    remaining -= taxable;
    prev = bracket.limit;
  }
  return tax;
}

function calculatePayroll(emp: Employee): PayrollCalculation {
  const regularPay = emp.hourlyRate * emp.regularHours;
  const overtimePay = Math.round(emp.hourlyRate * 1.5) * emp.overtimeHours;
  const grossPay = regularPay + overtimePay;
  const annualizedGross = grossPay * 26;
  const annualFedTax = calculateFederalTax(annualizedGross);
  const federalTax = Math.round(annualFedTax / 26);
  const ytdAfterThis = emp.ytdGross + grossPay;
  let ssWages = grossPay;
  if (emp.ytdGross >= SS_CAP_CENTS) {
    ssWages = 0;
  } else if (ytdAfterThis > SS_CAP_CENTS) {
    ssWages = SS_CAP_CENTS - emp.ytdGross;
  }
  const socialSecurity = Math.round(ssWages * SS_RATE);
  const medicare = Math.round(grossPay * MEDICARE_RATE);
  const stateTax = 0;
  const totalDeductions = federalTax + socialSecurity + medicare + stateTax;
  const netPay = grossPay - totalDeductions;
  return {
    employeeId: emp.id, name: emp.name, role: emp.role,
    regularPay, overtimePay, grossPay, federalTax, socialSecurity,
    medicare, stateTax, totalDeductions, netPay,
  };
}

const STEPS = [
  { label: 'Pay Period', icon: Calendar },
  { label: 'Review Hours', icon: Users },
  { label: 'Calculate', icon: Calculator },
  { label: 'Confirm', icon: CheckCircle2 },
];

export default function RunPayrollPage() {
  const [step, setStep] = useState(0);
  const [payPeriodStart, setPayPeriodStart] = useState('2026-03-02');
  const [payPeriodEnd, setPayPeriodEnd] = useState('2026-03-15');
  const [payDate, setPayDate] = useState('2026-03-20');
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRegular, setEditRegular] = useState(0);
  const [editOT, setEditOT] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const calculations = useMemo(() => employees.map(calculatePayroll), [employees]);
  const totals = useMemo(() => calculations.reduce(
    (acc, c) => ({
      grossPay: acc.grossPay + c.grossPay,
      federalTax: acc.federalTax + c.federalTax,
      socialSecurity: acc.socialSecurity + c.socialSecurity,
      medicare: acc.medicare + c.medicare,
      totalDeductions: acc.totalDeductions + c.totalDeductions,
      netPay: acc.netPay + c.netPay,
    }),
    { grossPay: 0, federalTax: 0, socialSecurity: 0, medicare: 0, totalDeductions: 0, netPay: 0 }
  ), [calculations]);

  function startEdit(emp: Employee) {
    setEditingId(emp.id);
    setEditRegular(emp.regularHours);
    setEditOT(emp.overtimeHours);
  }

  function saveEdit(id: string) {
    setEmployees((prev) =>
      prev.map((e) => e.id === id ? { ...e, regularHours: editRegular, overtimeHours: editOT } : e)
    );
    setEditingId(null);
  }

  const roleStyle = (role: string) => {
    switch (role) {
      case 'Manager': return 'bg-purple-100 text-purple-700';
      case 'Inspector': return 'bg-blue-100 text-blue-700';
      case 'Maintenance': return 'bg-orange-100 text-orange-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#500000]">Run Payroll</h1>
          <p className="text-gray-600 mt-1">Process payroll for Right at Home BnB staff</p>
        </div>

        {/* Step Indicator */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isComplete = i < step || submitted;
              return (
                <div key={s.label} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${isComplete ? 'bg-green-600 text-white' : isActive ? 'bg-[#500000] text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {isComplete && !isActive ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <span className={`text-sm font-medium ${isActive ? 'text-[#500000]' : isComplete ? 'text-green-600' : 'text-gray-400'}`}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-2 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 1: Pay Period */}
        {step === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-[#500000] mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6" /> Select Pay Period
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Period Start</label>
                <input type="date" value={payPeriodStart} onChange={(e) => setPayPeriodStart(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Period End</label>
                <input type="date" value={payPeriodEnd} onChange={(e) => setPayPeriodEnd(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Pay Date</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent" />
              </div>
            </div>
            <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Biweekly Pay Schedule</p>
                <p className="text-sm text-amber-700 mt-1">Processing payroll for {employees.length} employees. Pay period: {payPeriodStart} to {payPeriodEnd}. Checks issued on {payDate}.</p>
              </div>
            </div>
            <div className="mt-8 bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Pay Period Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border"><p className="text-xs text-gray-500 uppercase">Employees</p><p className="text-2xl font-bold text-[#500000]">{employees.length}</p></div>
                <div className="bg-white p-4 rounded-lg border"><p className="text-xs text-gray-500 uppercase">Pay Frequency</p><p className="text-2xl font-bold text-[#500000]">Biweekly</p></div>
                <div className="bg-white p-4 rounded-lg border"><p className="text-xs text-gray-500 uppercase">Period Days</p><p className="text-2xl font-bold text-[#500000]">14</p></div>
                <div className="bg-white p-4 rounded-lg border"><p className="text-xs text-gray-500 uppercase">Status</p><p className="text-lg font-bold text-green-600">Ready</p></div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review Hours */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-[#500000] mb-6 flex items-center gap-2"><Users className="w-6 h-6" /> Review Employee Hours</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#500000] text-white">
                    <th className="px-4 py-3 text-left text-sm font-semibold rounded-tl-lg">Employee</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Rate</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Regular Hrs</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">OT Hrs</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Total Hrs</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold rounded-tr-lg">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#3C1518] text-white flex items-center justify-center text-xs font-bold">{emp.name.split(' ').map((n) => n[0]).join('')}</div>
                          <div><p className="font-medium text-gray-900">{emp.name}</p><p className="text-xs text-gray-500">{emp.id}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${roleStyle(emp.role)}`}>{emp.role}</span></td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{formatMoney(emp.hourlyRate)}/hr</td>
                      {editingId === emp.id ? (
                        <>
                          <td className="px-4 py-3 text-right"><input type="number" value={editRegular} onChange={(e) => setEditRegular(Number(e.target.value))} className="w-20 px-2 py-1 border border-[#500000] rounded text-right text-sm" min={0} max={80} /></td>
                          <td className="px-4 py-3 text-right"><input type="number" value={editOT} onChange={(e) => setEditOT(Number(e.target.value))} className="w-20 px-2 py-1 border border-[#500000] rounded text-right text-sm" min={0} max={40} /></td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right font-mono text-sm">{emp.regularHours}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm">{emp.overtimeHours > 0 ? <span className="text-amber-600 font-semibold">{emp.overtimeHours}</span> : emp.overtimeHours}</td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold">{editingId === emp.id ? editRegular + editOT : emp.regularHours + emp.overtimeHours}</td>
                      <td className="px-4 py-3 text-center">
                        {editingId === emp.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => saveEdit(emp.id)} className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"><Save className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(emp)} className="p-1.5 text-[#500000] hover:bg-[#500000] hover:text-white rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-xs text-gray-500 uppercase">Total Regular Hours</p><p className="text-2xl font-bold text-[#500000]">{employees.reduce((s, e) => s + e.regularHours, 0)}</p></div>
              <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-200"><p className="text-xs text-amber-600 uppercase">Total OT Hours</p><p className="text-2xl font-bold text-amber-700">{employees.reduce((s, e) => s + e.overtimeHours, 0)}</p></div>
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-xs text-gray-500 uppercase">Combined Hours</p><p className="text-2xl font-bold text-[#500000]">{employees.reduce((s, e) => s + e.regularHours + e.overtimeHours, 0)}</p></div>
            </div>
          </div>
        )}

        {/* Step 3: Calculate */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-[#500000] mb-6 flex items-center gap-2"><Calculator className="w-6 h-6" /> Payroll Calculations</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#500000] text-white">
                    <th className="px-3 py-3 text-left font-semibold rounded-tl-lg">Employee</th>
                    <th className="px-3 py-3 text-right font-semibold">Gross Pay</th>
                    <th className="px-3 py-3 text-right font-semibold">Federal Tax</th>
                    <th className="px-3 py-3 text-right font-semibold">SS (6.2%)</th>
                    <th className="px-3 py-3 text-right font-semibold">Medicare</th>
                    <th className="px-3 py-3 text-right font-semibold">State Tax</th>
                    <th className="px-3 py-3 text-right font-semibold">Deductions</th>
                    <th className="px-3 py-3 text-right font-semibold rounded-tr-lg">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {calculations.map((calc) => (
                    <tr key={calc.employeeId} className="hover:bg-gray-50">
                      <td className="px-3 py-3"><p className="font-medium text-gray-900">{calc.name}</p><p className="text-xs text-gray-500">{calc.role}</p></td>
                      <td className="px-3 py-3 text-right font-mono font-semibold text-gray-900">{formatMoney(calc.grossPay)}</td>
                      <td className="px-3 py-3 text-right font-mono text-red-600">-{formatMoney(calc.federalTax)}</td>
                      <td className="px-3 py-3 text-right font-mono text-red-600">-{formatMoney(calc.socialSecurity)}</td>
                      <td className="px-3 py-3 text-right font-mono text-red-600">-{formatMoney(calc.medicare)}</td>
                      <td className="px-3 py-3 text-right font-mono text-gray-500">$0.00</td>
                      <td className="px-3 py-3 text-right font-mono text-red-700 font-semibold">-{formatMoney(calc.totalDeductions)}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-green-700">{formatMoney(calc.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#3C1518] text-white font-semibold">
                    <td className="px-3 py-3 rounded-bl-lg">TOTALS</td>
                    <td className="px-3 py-3 text-right font-mono">{formatMoney(totals.grossPay)}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatMoney(totals.federalTax)}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatMoney(totals.socialSecurity)}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatMoney(totals.medicare)}</td>
                    <td className="px-3 py-3 text-right font-mono">$0.00</td>
                    <td className="px-3 py-3 text-right font-mono">{formatMoney(totals.totalDeductions)}</td>
                    <td className="px-3 py-3 text-right font-mono rounded-br-lg">{formatMoney(totals.netPay)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#500000] text-white rounded-xl p-5"><DollarSign className="w-6 h-6 mb-2 opacity-80" /><p className="text-xs uppercase opacity-80">Total Gross</p><p className="text-xl font-bold">{formatMoney(totals.grossPay)}</p></div>
              <div className="bg-red-600 text-white rounded-xl p-5"><Calculator className="w-6 h-6 mb-2 opacity-80" /><p className="text-xs uppercase opacity-80">Total Taxes</p><p className="text-xl font-bold">{formatMoney(totals.totalDeductions)}</p></div>
              <div className="bg-green-700 text-white rounded-xl p-5"><CheckCircle2 className="w-6 h-6 mb-2 opacity-80" /><p className="text-xs uppercase opacity-80">Total Net</p><p className="text-xl font-bold">{formatMoney(totals.netPay)}</p></div>
              <div className="bg-[#3C1518] text-white rounded-xl p-5"><Users className="w-6 h-6 mb-2 opacity-80" /><p className="text-xs uppercase opacity-80">Employees</p><p className="text-xl font-bold">{employees.length}</p></div>
            </div>
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <p className="font-semibold">Tax Notes:</p>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>Federal tax calculated using 2026 brackets (10/12/22/24/32/35/37%)</li>
                <li>Social Security: 6.2% on wages up to $168,600 cap</li>
                <li>Medicare: 1.45% on all wages (no cap)</li>
                <li>Texas has no state income tax</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 3 && !submitted && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-[#500000] mb-6 flex items-center gap-2"><CheckCircle2 className="w-6 h-6" /> Confirm & Submit Payroll</h2>
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div><p className="text-xs text-gray-500 uppercase">Pay Period</p><p className="font-semibold text-gray-900">{payPeriodStart} to {payPeriodEnd}</p></div>
                <div><p className="text-xs text-gray-500 uppercase">Pay Date</p><p className="font-semibold text-gray-900">{payDate}</p></div>
                <div><p className="text-xs text-gray-500 uppercase">Employees</p><p className="font-semibold text-gray-900">{employees.length}</p></div>
                <div><p className="text-xs text-gray-500 uppercase">Total Net Pay</p><p className="font-semibold text-green-700">{formatMoney(totals.netPay)}</p></div>
              </div>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
              {calculations.map((calc, i) => (
                <div key={calc.employeeId} className={`flex items-center justify-between px-5 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <div><p className="font-medium text-gray-900">{calc.name}</p><p className="text-xs text-gray-500">{calc.role}</p></div>
                  <div className="text-right"><p className="font-bold text-green-700">{formatMoney(calc.netPay)}</p><p className="text-xs text-gray-500">Gross: {formatMoney(calc.grossPay)}</p></div>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Final Review</p>
                <p className="mt-1">By submitting, you authorize direct deposit payments totaling <strong>{formatMoney(totals.netPay)}</strong> to {employees.length} employees on {payDate}. Employer taxes of {formatMoney(totals.socialSecurity + totals.medicare)} will be remitted to the IRS.</p>
              </div>
            </div>
            <button onClick={() => setSubmitted(true)} className="w-full py-4 bg-[#500000] text-white rounded-xl font-bold text-lg hover:bg-[#3C1518] transition-colors flex items-center justify-center gap-2">
              <CheckCircle2 className="w-6 h-6" /> Submit Payroll
            </button>
          </div>
        )}

        {/* Success */}
        {submitted && (
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="w-10 h-10 text-green-600" /></div>
            <h2 className="text-2xl font-bold text-green-700 mb-2">Payroll Submitted Successfully!</h2>
            <p className="text-gray-600 mb-4">Payroll for {employees.length} employees has been processed. Total disbursement: <strong className="text-green-700">{formatMoney(totals.netPay)}</strong></p>
            <p className="text-sm text-gray-500 mb-8">Pay period: {payPeriodStart} to {payPeriodEnd} | Pay date: {payDate}</p>
            <button onClick={() => { setStep(0); setSubmitted(false); }} className="px-6 py-3 bg-[#500000] text-white rounded-lg font-semibold hover:bg-[#3C1518] transition-colors">Run Another Payroll</button>
          </div>
        )}

        {/* Navigation */}
        {!submitted && (
          <div className="flex justify-between mt-8">
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-5 h-5" /> Previous
            </button>
            {step < 3 && (
              <button onClick={() => setStep((s) => Math.min(3, s + 1))} className="flex items-center gap-2 px-6 py-3 bg-[#500000] text-white rounded-lg font-semibold hover:bg-[#3C1518] transition-colors">
                Next <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
