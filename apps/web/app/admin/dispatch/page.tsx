'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  ClipboardList, Plus, Filter, ChevronRight, ChevronLeft,
  Clock, MapPin, User, CheckCircle2, Loader2, X, Search,
  Sparkles, Wrench, Eye, ShoppingBag, MessageSquare, Calendar,
} from 'lucide-react';
import { properties as propertyKnowledge } from '@/lib/property-knowledge';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

type TaskStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Completed';
type TaskType = 'Cleaning' | 'Maintenance' | 'Inspection' | 'Supply Run' | 'Guest Request';
type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';

interface Task {
  id: string; title: string; type: TaskType; property: string; assignee: string;
  priority: Priority; dueDate: string; dueTime: string; status: TaskStatus;
  notes: string; createdAt: string; estimatedMinutes: number;
}

// Real properties from property-knowledge.ts
const PROPERTIES: string[] = propertyKnowledge.map(
  (p) => p.nickname || p.name
);

const ASSIGNEES: string[] = [
  'Steven Palma',
  'Cleaning Crew A',
  'Cleaning Crew B',
  'Pool Service',
  'Maintenance Team',
  'Yard Crew',
];

const STORAGE_KEY = 'rah_dispatch_tasks';

function loadTasks(): Task[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveTasks(tasks: Task[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {}
}

const COLUMNS: { status: TaskStatus; color: string; bgColor: string; icon: typeof Clock }[] = [
  { status: 'Pending', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Clock },
  { status: 'Assigned', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: User },
  { status: 'In Progress', color: 'text-amber-600', bgColor: 'bg-amber-100', icon: Loader2 },
  { status: 'Completed', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle2 },
];

const typeIcon = (type: TaskType) => { switch (type) { case 'Cleaning': return Sparkles; case 'Maintenance': return Wrench; case 'Inspection': return Eye; case 'Supply Run': return ShoppingBag; case 'Guest Request': return MessageSquare; } };
const priorityBadge = (p: Priority) => { switch (p) { case 'Urgent': return 'bg-red-600 text-white'; case 'High': return 'bg-red-100 text-red-700'; case 'Medium': return 'bg-yellow-100 text-yellow-700'; case 'Low': return 'bg-gray-100 text-gray-600'; } };

export default function DispatchPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterProperty, setFilterProperty] = useState('All');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<TaskType>('Cleaning');
  const [newProperty, setNewProperty] = useState(PROPERTIES[0] || '');
  const [newAssignee, setNewAssignee] = useState(ASSIGNEES[0] || '');
  const [newPriority, setNewPriority] = useState<Priority>('Medium');
  const [newDueDate, setNewDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDueTime, setNewDueTime] = useState('10:00');
  const [newNotes, setNewNotes] = useState('');

  // Load tasks from localStorage on mount
  useEffect(() => {
    setTasks(loadTasks());
  }, []);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  function deleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function clearCompleted() {
    setTasks((prev) => prev.filter((t) => t.status !== 'Completed'));
  }

  const filtered = useMemo(() => tasks.filter((t) => {
    if (filterProperty !== 'All' && t.property !== filterProperty) return false;
    if (filterAssignee !== 'All' && t.assignee !== filterAssignee) return false;
    if (filterPriority !== 'All' && t.priority !== filterPriority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.property.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, filterProperty, filterAssignee, filterPriority, search]);

  function moveTask(taskId: string, direction: 'forward' | 'back') {
    const statusOrder: TaskStatus[] = ['Pending', 'Assigned', 'In Progress', 'Completed'];
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const idx = statusOrder.indexOf(t.status);
      const newIdx = direction === 'forward' ? Math.min(idx + 1, 3) : Math.max(idx - 1, 0);
      return { ...t, status: statusOrder[newIdx] };
    }));
  }

  function addTask() {
    if (!newTitle.trim()) return;
    const task: Task = { id: `T${Date.now()}`, title: newTitle, type: newType, property: newProperty, assignee: newAssignee, priority: newPriority, dueDate: newDueDate, dueTime: newDueTime, status: 'Pending', notes: newNotes, createdAt: new Date().toISOString(), estimatedMinutes: 60 };
    setTasks((prev) => [...prev, task]);
    setShowAddForm(false);
    setNewTitle(''); setNewNotes('');
  }

  const stats = useMemo(() => ({
    pending: filtered.filter((t) => t.status === 'Pending').length,
    assigned: filtered.filter((t) => t.status === 'Assigned').length,
    inProgress: filtered.filter((t) => t.status === 'In Progress').length,
    completed: filtered.filter((t) => t.status === 'Completed').length,
    urgent: filtered.filter((t) => t.priority === 'Urgent').length,
  }), [filtered]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-3xl font-bold text-[#500000]">Task Dispatch</h1><p className="text-gray-600 mt-1">Kanban board for property operations across {PROPERTIES.length} rentals</p></div>
          <div className="flex items-center gap-3">
            {tasks.some((t) => t.status === 'Completed') && (
              <button onClick={clearCompleted} className="flex items-center gap-2 px-4 py-2.5 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors"><CheckCircle2 className="w-4 h-4" /> Clear Done</button>
            )}
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${showFilters ? 'border-[#500000] text-[#500000] bg-red-50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}><Filter className="w-4 h-4" /> Filters</button>
            <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-[#500000] text-white rounded-lg font-semibold hover:bg-[#3C1518] transition-colors"><Plus className="w-5 h-5" /> Add Task</button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center"><p className="text-xs text-gray-500 uppercase">Pending</p><p className="text-xl font-bold text-gray-700">{stats.pending}</p></div>
          <div className="bg-white rounded-lg border border-blue-200 p-3 text-center"><p className="text-xs text-blue-500 uppercase">Assigned</p><p className="text-xl font-bold text-blue-700">{stats.assigned}</p></div>
          <div className="bg-white rounded-lg border border-amber-200 p-3 text-center"><p className="text-xs text-amber-500 uppercase">In Progress</p><p className="text-xl font-bold text-amber-700">{stats.inProgress}</p></div>
          <div className="bg-white rounded-lg border border-green-200 p-3 text-center"><p className="text-xs text-green-500 uppercase">Completed</p><p className="text-xl font-bold text-green-700">{stats.completed}</p></div>
          <div className="bg-white rounded-lg border border-red-200 p-3 text-center"><p className="text-xs text-red-500 uppercase">Urgent</p><p className="text-xl font-bold text-red-600">{stats.urgent}</p></div>
        </div>

        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]" /></div>
              <select value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]"><option value="All">All Properties</option>{PROPERTIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
              <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]"><option value="All">All Assignees</option>{ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}</select>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]"><option value="All">All Priorities</option><option value="Urgent">Urgent</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const Icon = col.icon;
            const columnTasks = filtered.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className={`p-4 border-b flex items-center justify-between ${col.bgColor} rounded-t-xl`}>
                  <div className="flex items-center gap-2"><Icon className={`w-5 h-5 ${col.color}`} /><h3 className={`font-bold ${col.color}`}>{col.status}</h3></div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${col.bgColor} ${col.color} border`}>{columnTasks.length}</span>
                </div>
                <div className="p-3 space-y-3 min-h-[200px] max-h-[600px] overflow-y-auto">
                  {columnTasks.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No tasks</p>}
                  {columnTasks.map((task) => {
                    const TypeIcon = typeIcon(task.type);
                    return (
                      <div key={task.id} className="bg-gray-50 rounded-lg border border-gray-200 p-3 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-1.5"><TypeIcon className="w-4 h-4 text-gray-500" /><span className="text-xs text-gray-500">{task.type}</span></div>
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${priorityBadge(task.priority)}`}>{task.priority}</span>
                            <button onClick={() => deleteTask(task.id)} className="ml-1 p-0.5 text-gray-300 hover:text-red-500 transition-colors" title="Delete task"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <h4 className="font-semibold text-gray-900 text-sm mb-1">{task.title}</h4>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1"><MapPin className="w-3 h-3" /> {task.property}</div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1"><User className="w-3 h-3" /> {task.assignee}</div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2"><Calendar className="w-3 h-3" /> {task.dueDate} {task.dueTime}</div>
                        {task.notes && <p className="text-xs text-gray-400 italic mb-2 line-clamp-2">{task.notes}</p>}
                        <div className="flex items-center gap-1">
                          {task.status !== 'Pending' && <button onClick={() => moveTask(task.id, 'back')} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-200 text-gray-600 rounded text-xs hover:bg-gray-300 transition-colors"><ChevronLeft className="w-3 h-3" /> Back</button>}
                          {task.status !== 'Completed' && <button onClick={() => moveTask(task.id, 'forward')} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#500000] text-white rounded text-xs hover:bg-[#3C1518] transition-colors">Next <ChevronRight className="w-3 h-3" /></button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-[#500000] flex items-center gap-2"><ClipboardList className="w-6 h-6" /> Quick Add Task</h2>
                <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Task Title</label><input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent" placeholder="e.g. Turnover clean after checkout" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-semibold text-gray-700 mb-1">Type</label><select value={newType} onChange={(e) => setNewType(e.target.value as TaskType)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000]"><option value="Cleaning">Cleaning</option><option value="Maintenance">Maintenance</option><option value="Inspection">Inspection</option><option value="Supply Run">Supply Run</option><option value="Guest Request">Guest Request</option></select></div>
                  <div><label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label><select value={newPriority} onChange={(e) => setNewPriority(e.target.value as Priority)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000]"><option value="Urgent">Urgent</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
                </div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Property</label><select value={newProperty} onChange={(e) => setNewProperty(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000]">{PROPERTIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Assignee</label><select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000]">{ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-semibold text-gray-700 mb-1">Due Date</label><input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000]" /></div>
                  <div><label className="block text-sm font-semibold text-gray-700 mb-1">Due Time</label><input type="time" value={newDueTime} onChange={(e) => setNewDueTime(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000]" /></div>
                </div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label><textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] focus:border-transparent resize-none" placeholder="Additional details..." /></div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t">
                <button onClick={() => setShowAddForm(false)} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={addTask} className="flex items-center gap-2 px-5 py-2.5 bg-[#500000] text-white rounded-lg font-semibold hover:bg-[#3C1518] transition-colors"><Plus className="w-4 h-4" /> Create Task</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
