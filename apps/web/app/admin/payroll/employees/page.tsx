'use client';

import { useState } from 'react';
import {
  Users, Plus, Search, Edit2, Eye, X, Save,
  ChevronDown, ChevronUp, Award, Clock, DollarSign,
  Calendar, UserCheck, UserX, Briefcase, Phone, Mail,
} from 'lucide-react';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

type EmployeeStatus = 'Active' | 'On Leave' | 'Terminated';
type EmployeeRole = 'Cleaner' | 'Maintenance' | 'Inspector' | 'Manager';

interface PayHistoryEntry { date: string; grossPay: number; netPay: number; hours: number; }
interface HoursLogEntry { date: string; hoursWorked: number; property: string; taskType: string; }
interface Certification { name: string; issueDate: string; expiryDate: string; status: 'Valid' | 'Expiring' | 'Expired'; }

interface Employee {
  id: string; name: string; email: string; phone: string;
  role: EmployeeRole; hireDate: string; hourlyRate: number; status: EmployeeStatus;
  address: string; emergencyContact: string;
  payHistory: PayHistoryEntry[]; hoursLog: HoursLogEntry[]; certifications: Certification[];
}

// Employee data — loaded from HR/payroll system when connected
const MOCK_EMPLOYEES: Employee[] = [];

const ROLES: EmployeeRole[] = ['Cleaner', 'Maintenance', 'Inspector', 'Manager'];

export default function EmployeesPage() {
  const [employees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailTab, setDetailTab] = useState<'pay' | 'hours' | 'certs'>('pay');
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'role' | 'hireDate' | 'hourlyRate'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<EmployeeRole>('Cleaner');
  const [newRate, setNewRate] = useState('18.00');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const filtered = employees.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'All' || e.role === roleFilter;
    const matchStatus = statusFilter === 'All' || e.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  }).sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortField === 'role') cmp = a.role.localeCompare(b.role);
    else if (sortField === 'hireDate') cmp = a.hireDate.localeCompare(b.hireDate);
    else if (sortField === 'hourlyRate') cmp = a.hourlyRate - b.hourlyRate;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const activeCount = employees.filter((e) => e.status === 'Active').length;
  const onLeaveCount = employees.filter((e) => e.status === 'On Leave').length;
  const avgRate = employees.length > 0 ? Math.round(employees.reduce((s, e) => s + e.hourlyRate, 0) / employees.length) : 0;

  function toggleSort(field: typeof sortField) { if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortField(field); setSortDir('asc'); } }
  const SortIcon = ({ field }: { field: typeof sortField }) => sortField === field ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null;
  const roleColor = (role: string) => { switch (role) { case 'Manager': return 'bg-purple-100 text-purple-700'; case 'Inspector': return 'bg-blue-100 text-blue-700'; case 'Maintenance': return 'bg-orange-100 text-orange-700'; default: return 'bg-green-100 text-green-700'; } };
  const statusColor = (status: string) => { switch (status) { case 'Active': return 'bg-green-100 text-green-700'; case 'On Leave': return 'bg-yellow-100 text-yellow-700'; default: return 'bg-red-100 text-red-700'; } };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div><h1 className="text-3xl font-bold text-[#500000]">Employee Management</h1><p className="text-gray-600 mt-1">Right at Home BnB staff directory and payroll records</p></div>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-5 py-3 bg-[#500000] text-white rounded-lg font-semibold hover:bg-[#3C1518] transition-colors"><Plus className="w-5 h-5" /> Add Employee</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-[#500000] bg-opacity-10 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-[#500000]" /></div><div><p className="text-xs text-gray-500 uppercase">Total Staff</p><p className="text-2xl font-bold text-[#500000]">{employees.length}</p></div></div></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center"><UserCheck className="w-5 h-5 text-green-600" /></div><div><p className="text-xs text-gray-500 uppercase">Active</p><p className="text-2xl font-bold text-green-600">{activeCount}</p></div></div></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center"><UserX className="w-5 h-5 text-yellow-600" /></div><div><p className="text-xs text-gray-500 uppercase">On Leave</p><p className="text-2xl font-bold text-yellow-600">{onLeaveCount}</p></div></div></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-gray-500 uppercase">Avg Rate</p><p className="text-2xl font-bold text-blue-600">{formatMoney(avgRate)}/hr</p></div></div></div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent text-sm" /></div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]"><option value="All">All Roles</option>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]"><option value="All">All Status</option><option value="Active">Active</option><option value="On Leave">On Leave</option><option value="Terminated">Terminated</option></select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-[#500000] text-white">
              <th className="px-4 py-3 text-left text-sm font-semibold cursor-pointer" onClick={() => toggleSort('name')}><div className="flex items-center gap-1">Employee <SortIcon field="name" /></div></th>
              <th className="px-4 py-3 text-left text-sm font-semibold cursor-pointer" onClick={() => toggleSort('role')}><div className="flex items-center gap-1">Role <SortIcon field="role" /></div></th>
              <th className="px-4 py-3 text-left text-sm font-semibold cursor-pointer" onClick={() => toggleSort('hireDate')}><div className="flex items-center gap-1">Hire Date <SortIcon field="hireDate" /></div></th>
              <th className="px-4 py-3 text-right text-sm font-semibold cursor-pointer" onClick={() => toggleSort('hourlyRate')}><div className="flex items-center gap-1 justify-end">Rate <SortIcon field="hourlyRate" /></div></th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[#3C1518] text-white flex items-center justify-center text-xs font-bold">{emp.name.split(' ').map((n) => n[0]).join('')}</div><div><p className="font-medium text-gray-900">{emp.name}</p><p className="text-xs text-gray-500">{emp.id}</p></div></div></td>
                  <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColor(emp.role)}`}>{emp.role}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-700">{emp.hireDate}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{formatMoney(emp.hourlyRate)}/hr</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(emp.status)}`}>{emp.status}</span></td>
                  <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1"><button onClick={() => { setSelectedEmployee(emp); setDetailTab('pay'); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View Details"><Eye className="w-4 h-4" /></button><button className="p-1.5 text-[#500000] hover:bg-red-50 rounded transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-12 text-center text-gray-500"><Users className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="font-medium">No employees found</p><p className="text-sm mt-1">Try adjusting your search or filters</p></div>}
        </div>

        {selectedEmployee && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="bg-[#500000] text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4"><div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">{selectedEmployee.name.split(' ').map((n) => n[0]).join('')}</div><div><h2 className="text-xl font-bold">{selectedEmployee.name}</h2><p className="text-sm opacity-80">{selectedEmployee.role} | {selectedEmployee.id}</p></div></div>
                  <button onClick={() => setSelectedEmployee(null)} className="p-2 hover:bg-white/20 rounded-lg transition-colors"><X className="w-6 h-6" /></button>
                </div>
              </div>
              <div className="p-6 border-b"><div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-700"><Mail className="w-4 h-4 text-gray-400" /> {selectedEmployee.email}</div>
                <div className="flex items-center gap-2 text-sm text-gray-700"><Phone className="w-4 h-4 text-gray-400" /> {selectedEmployee.phone}</div>
                <div className="flex items-center gap-2 text-sm text-gray-700"><Calendar className="w-4 h-4 text-gray-400" /> Hired: {selectedEmployee.hireDate}</div>
                <div className="flex items-center gap-2 text-sm text-gray-700"><DollarSign className="w-4 h-4 text-gray-400" /> {formatMoney(selectedEmployee.hourlyRate)}/hr</div>
                <div className="flex items-center gap-2 text-sm text-gray-700 col-span-2"><Briefcase className="w-4 h-4 text-gray-400" /> {selectedEmployee.address}</div>
              </div></div>
              <div className="flex border-b">
                {([{ key: 'pay' as const, label: 'Pay History', icon: DollarSign }, { key: 'hours' as const, label: 'Hours Log', icon: Clock }, { key: 'certs' as const, label: 'Certifications', icon: Award }]).map((tab) => (
                  <button key={tab.key} onClick={() => setDetailTab(tab.key)} className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${detailTab === tab.key ? 'border-[#500000] text-[#500000]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><tab.icon className="w-4 h-4" /> {tab.label}</button>
                ))}
              </div>
              <div className="p-6">
                {detailTab === 'pay' && (selectedEmployee.payHistory.length === 0 ? <p className="text-gray-500 text-center py-8">No pay history available</p> : <table className="w-full text-sm"><thead><tr className="text-left bg-gray-50"><th className="px-3 py-2 font-semibold text-gray-700">Pay Date</th><th className="px-3 py-2 text-right font-semibold text-gray-700">Hours</th><th className="px-3 py-2 text-right font-semibold text-gray-700">Gross Pay</th><th className="px-3 py-2 text-right font-semibold text-gray-700">Net Pay</th></tr></thead><tbody className="divide-y divide-gray-100">{selectedEmployee.payHistory.map((ph, i) => (<tr key={i} className="hover:bg-gray-50"><td className="px-3 py-2">{ph.date}</td><td className="px-3 py-2 text-right font-mono">{ph.hours}</td><td className="px-3 py-2 text-right font-mono">{formatMoney(ph.grossPay)}</td><td className="px-3 py-2 text-right font-mono font-semibold text-green-700">{formatMoney(ph.netPay)}</td></tr>))}</tbody></table>)}
                {detailTab === 'hours' && (selectedEmployee.hoursLog.length === 0 ? <p className="text-gray-500 text-center py-8">No hours logged recently</p> : <table className="w-full text-sm"><thead><tr className="text-left bg-gray-50"><th className="px-3 py-2 font-semibold text-gray-700">Date</th><th className="px-3 py-2 font-semibold text-gray-700">Property</th><th className="px-3 py-2 font-semibold text-gray-700">Task</th><th className="px-3 py-2 text-right font-semibold text-gray-700">Hours</th></tr></thead><tbody className="divide-y divide-gray-100">{selectedEmployee.hoursLog.map((hl, i) => (<tr key={i} className="hover:bg-gray-50"><td className="px-3 py-2">{hl.date}</td><td className="px-3 py-2">{hl.property}</td><td className="px-3 py-2">{hl.taskType}</td><td className="px-3 py-2 text-right font-mono font-semibold">{hl.hoursWorked}</td></tr>))}</tbody></table>)}
                {detailTab === 'certs' && (selectedEmployee.certifications.length === 0 ? <p className="text-gray-500 text-center py-8">No certifications on file</p> : <div className="space-y-3">{selectedEmployee.certifications.map((cert, i) => (<div key={i} className={`flex items-center justify-between p-4 rounded-lg border ${cert.status === 'Expired' ? 'border-red-200 bg-red-50' : cert.status === 'Expiring' ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}`}><div className="flex items-center gap-3"><Award className={`w-5 h-5 ${cert.status === 'Expired' ? 'text-red-600' : cert.status === 'Expiring' ? 'text-yellow-600' : 'text-green-600'}`} /><div><p className="font-medium text-gray-900">{cert.name}</p><p className="text-xs text-gray-500">Issued: {cert.issueDate} | Expires: {cert.expiryDate}</p></div></div><span className={`px-3 py-1 rounded-full text-xs font-bold ${cert.status === 'Expired' ? 'bg-red-200 text-red-800' : cert.status === 'Expiring' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}`}>{cert.status}</span></div>))}</div>)}
              </div>
            </div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b"><h2 className="text-xl font-bold text-[#500000]">Add New Employee</h2><button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button></div>
              <div className="p-6 space-y-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent" placeholder="John Doe" /></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-semibold text-gray-700 mb-1">Role</label><select value={newRole} onChange={(e) => setNewRole(e.target.value as EmployeeRole)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000]">{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div><div><label className="block text-sm font-semibold text-gray-700 mb-1">Hourly Rate</label><input type="text" value={newRate} onChange={(e) => setNewRate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent" placeholder="18.00" /></div></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Email</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent" placeholder="john.doe@rahbnb.com" /></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label><input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent" placeholder="(432) 555-0000" /></div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t"><button onClick={() => setShowAddModal(false)} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button><button onClick={() => setShowAddModal(false)} className="flex items-center gap-2 px-5 py-2.5 bg-[#500000] text-white rounded-lg font-semibold hover:bg-[#3C1518] transition-colors"><Save className="w-4 h-4" /> Save Employee</button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
