'use client';

import { useState } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Building2, TrendingUp,
  Moon, DollarSign, BarChart3, StickyNote, Plus, Search,
  X, Clock, Star, Edit3, Trash2, Save
} from 'lucide-react';

const formatMoney = (cents: number) =>
  '$' + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

interface Note {
  id: string;
  date: string;
  title: string;
  content: string;
  category: 'maintenance' | 'guest' | 'reminder' | 'idea' | 'financial';
  pinned: boolean;
  createdAt: string;
}

interface DayData {
  date: number;
  occupancy: number;
  revenue: number;
  checkIns: number;
  checkOuts: number;
}

const CATEGORY_STYLES: Record<Note['category'], { bg: string; text: string; label: string }> = {
  maintenance: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Maintenance' },
  guest: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Guest' },
  reminder: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Reminder' },
  idea: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Idea' },
  financial: { bg: 'bg-green-100', text: 'text-green-700', label: 'Financial' },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function generateMonthData(year: number, month: number): DayData[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const data: DayData[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    const isWeekend = dow === 5 || dow === 6;
    const baseOcc = isWeekend ? 85 : 65;
    const occ = Math.min(100, Math.max(30, baseOcc + Math.floor(Math.random() * 20 - 10)));
    data.push({
      date: d,
      occupancy: occ,
      revenue: occ * 22 * 15000 / 100,
      checkIns: Math.floor(Math.random() * 6) + (isWeekend ? 3 : 1),
      checkOuts: Math.floor(Math.random() * 5) + (dow === 0 ? 4 : 1),
    });
  }
  return data;
}

const initialNotes: Note[] = [
  { id: 'N1', date: '2026-03-05', title: 'HVAC service — Sunset Villa', content: 'Annual HVAC inspection and filter change for all units at Sunset Villa. Contractor confirmed for 9am. Budget: $450.', category: 'maintenance', pinned: true, createdAt: '2026-03-01' },
  { id: 'N2', date: '2026-03-10', title: 'VIP guest — Permian Loft', content: 'Corporate repeat guest John Hargrove checking in. Prefers king bed, extra towels, late checkout. Leave welcome basket.', category: 'guest', pinned: true, createdAt: '2026-03-02' },
  { id: 'N3', date: '2026-03-15', title: 'Q1 Tax filing reminder', content: 'Occupancy tax (HOT) due to City of Midland. Estimated $12,400. Payroll taxes 941 also due this week.', category: 'reminder', pinned: false, createdAt: '2026-02-28' },
  { id: 'N4', date: '2026-03-08', title: 'Test dynamic pricing tool', content: 'Evaluate PriceLabs vs Beyond Pricing for automated rate optimization. Free trial starts today.', category: 'idea', pinned: false, createdAt: '2026-03-03' },
  { id: 'N5', date: '2026-03-20', title: 'Insurance renewal review', content: 'State Farm policy renewal coming up April 1. Review coverage limits, compare with Allstate quote. Current premium: $10,680/yr.', category: 'financial', pinned: false, createdAt: '2026-03-04' },
  { id: 'N6', date: '2026-03-12', title: 'Pool heater replacement — Basin View', content: 'Pool heater at Basin View failed inspection. Need replacement — estimated $2,800. Get two more quotes.', category: 'maintenance', pinned: false, createdAt: '2026-03-05' },
  { id: 'N7', date: '2026-03-22', title: 'Spring break pricing strategy', content: 'UT Permian Basin spring break March 16-20. Midland schools March 10-14. Bump rates 25% for these windows. Already seeing bookings increase.', category: 'financial', pinned: true, createdAt: '2026-03-01' },
  { id: 'N8', date: '2026-03-18', title: 'New linens delivery', content: 'Standard Textile delivering 50 sets of white linens. Need someone at warehouse 8am-12pm to receive.', category: 'reminder', pinned: false, createdAt: '2026-03-06' },
];

export default function OccupancyPlanner() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [noteSearch, setNoteSearch] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', category: 'reminder' as Note['category'] });

  const monthData = generateMonthData(currentYear, currentMonth);
  const firstDow = new Date(currentYear, currentMonth, 1).getDay();

  const avgOccupancy = Math.round(monthData.reduce((s, d) => s + d.occupancy, 0) / monthData.length);
  const totalRevenue = monthData.reduce((s, d) => s + d.revenue, 0);
  const totalCheckIns = monthData.reduce((s, d) => s + d.checkIns, 0);
  const avgRate = Math.round(totalRevenue / monthData.reduce((s, d) => s + (d.occupancy * 22 / 100), 0));
  const revPAR = Math.round(totalRevenue / (22 * monthData.length));

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
    setSelectedDay(null);
  };

  const occColor = (occ: number) => {
    if (occ >= 90) return 'bg-maroon-800 text-white';
    if (occ >= 75) return 'bg-maroon-200 text-maroon-900';
    if (occ >= 60) return 'bg-yellow-100 text-yellow-800';
    if (occ >= 40) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const selectedDayData = selectedDay ? monthData.find(d => d.date === selectedDay) : null;
  const dateStr = selectedDay ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}` : '';
  const dayNotes = notes.filter(n => n.date === dateStr);

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(noteSearch.toLowerCase()) ||
    n.content.toLowerCase().includes(noteSearch.toLowerCase())
  ).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const addNote = () => {
    if (!newNote.title.trim()) return;
    const note: Note = {
      id: `N${Date.now()}`,
      date: dateStr || `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
      title: newNote.title,
      content: newNote.content,
      category: newNote.category,
      pinned: false,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setNotes([note, ...notes]);
    setNewNote({ title: '', content: '', category: 'reminder' });
    setShowNewNote(false);
  };

  const deleteNote = (id: string) => setNotes(notes.filter(n => n.id !== id));
  const togglePin = (id: string) => setNotes(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));

  const kpis = [
    { label: 'Avg Occupancy', value: `${avgOccupancy}%`, icon: Building2, color: 'text-maroon-800', bg: 'bg-maroon-50' },
    { label: 'Total Revenue', value: formatMoney(totalRevenue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Check-ins', value: String(totalCheckIns), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'RevPAR', value: formatMoney(revPAR), icon: BarChart3, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="min-h-screen bg-cream-100 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-800">Occupancy Planner</h1>
          <p className="text-charcoal-400 mt-1">Calendar view, KPIs, and operational notes</p>
        </div>
        <button
          onClick={() => setShowNewNote(true)}
          className="flex items-center gap-2 bg-maroon-800 hover:bg-maroon-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Note
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl shadow-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`${kpi.bg} p-3 rounded-lg`}>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
              <p className="text-sm text-charcoal-400 mb-1">{kpi.label}</p>
              <p className="text-2xl font-bold text-charcoal-800">{kpi.value}</p>
              <p className="text-xs text-charcoal-400 mt-1">{MONTHS[currentMonth]} {currentYear}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Heatmap */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button onClick={prevMonth} className="p-2 hover:bg-cream-100 rounded-lg"><ChevronLeft className="w-5 h-5 text-charcoal-600" /></button>
              <h2 className="text-lg font-bold text-charcoal-800">{MONTHS[currentMonth]} {currentYear}</h2>
              <button onClick={nextMonth} className="p-2 hover:bg-cream-100 rounded-lg"><ChevronRight className="w-5 h-5 text-charcoal-600" /></button>
            </div>
            <div className="flex items-center gap-2 text-xs text-charcoal-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100" /> &lt;40%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100" /> 40-59%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100" /> 60-74%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-maroon-200" /> 75-89%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-maroon-800" /> 90%+</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-charcoal-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {monthData.map((day) => {
              const isSelected = selectedDay === day.date;
              const isToday = day.date === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(day.date)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all ${occColor(day.occupancy)} ${
                    isSelected ? 'ring-2 ring-maroon-800 ring-offset-2' : ''
                  } ${isToday ? 'font-bold' : ''} hover:scale-105`}
                >
                  <span className="font-medium">{day.date}</span>
                  <span className="text-[10px] opacity-75">{day.occupancy}%</span>
                </button>
              );
            })}
          </div>

          {/* Selected Day Detail */}
          {selectedDayData && (
            <div className="mt-4 p-4 bg-cream-100 rounded-lg">
              <h3 className="font-bold text-charcoal-800 mb-2">
                {MONTHS[currentMonth]} {selectedDay}, {currentYear}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-charcoal-400">Occupancy</p>
                  <p className="font-bold text-charcoal-800">{selectedDayData.occupancy}% ({Math.round(22 * selectedDayData.occupancy / 100)} / 22)</p>
                </div>
                <div>
                  <p className="text-charcoal-400">Revenue</p>
                  <p className="font-bold text-charcoal-800">{formatMoney(selectedDayData.revenue)}</p>
                </div>
                <div>
                  <p className="text-charcoal-400">Check-ins</p>
                  <p className="font-bold text-charcoal-800">{selectedDayData.checkIns}</p>
                </div>
                <div>
                  <p className="text-charcoal-400">Check-outs</p>
                  <p className="font-bold text-charcoal-800">{selectedDayData.checkOuts}</p>
                </div>
              </div>
              {dayNotes.length > 0 && (
                <div className="mt-3 border-t border-charcoal-200 pt-3">
                  <p className="text-xs font-medium text-charcoal-500 mb-2">Notes for this day:</p>
                  {dayNotes.map(n => (
                    <div key={n.id} className="bg-white rounded p-2 mb-1 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLES[n.category].bg} ${CATEGORY_STYLES[n.category].text} mr-2`}>
                        {CATEGORY_STYLES[n.category].label}
                      </span>
                      <span className="font-medium text-charcoal-800">{n.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes Panel */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-charcoal-800 flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-maroon-800" /> Notes
            </h2>
            <span className="text-sm text-charcoal-400">{filteredNotes.length}</span>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
            <input
              type="text"
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full pl-9 pr-4 py-2 border border-charcoal-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-800"
            />
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredNotes.map((note) => (
              <div key={note.id} className={`border rounded-lg p-3 ${note.pinned ? 'border-maroon-300 bg-maroon-50/30' : 'border-charcoal-100'}`}>
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLES[note.category].bg} ${CATEGORY_STYLES[note.category].text}`}>
                      {CATEGORY_STYLES[note.category].label}
                    </span>
                    {note.pinned && <Star className="w-3 h-3 text-maroon-800 fill-maroon-800" />}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => togglePin(note.id)} className="p-1 hover:bg-cream-100 rounded" title={note.pinned ? 'Unpin' : 'Pin'}>
                      <Star className={`w-3 h-3 ${note.pinned ? 'text-maroon-800' : 'text-charcoal-300'}`} />
                    </button>
                    <button onClick={() => deleteNote(note.id)} className="p-1 hover:bg-red-50 rounded">
                      <Trash2 className="w-3 h-3 text-charcoal-300 hover:text-red-500" />
                    </button>
                  </div>
                </div>
                <p className="font-medium text-charcoal-800 text-sm">{note.title}</p>
                <p className="text-xs text-charcoal-500 mt-1 line-clamp-2">{note.content}</p>
                <p className="text-[10px] text-charcoal-400 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {note.date}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Note Modal */}
      {showNewNote && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-elegant-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-charcoal-800">New Note</h3>
              <button onClick={() => setShowNewNote(false)} className="p-1 hover:bg-cream-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  className="w-full border border-charcoal-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-800"
                  placeholder="Note title..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">Category</label>
                <select
                  value={newNote.category}
                  onChange={(e) => setNewNote({ ...newNote, category: e.target.value as Note['category'] })}
                  className="w-full border border-charcoal-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-800"
                >
                  {Object.entries(CATEGORY_STYLES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">Content</label>
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  rows={4}
                  className="w-full border border-charcoal-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-800"
                  placeholder="Write your note..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowNewNote(false)} className="px-4 py-2 text-sm text-charcoal-600 hover:bg-cream-100 rounded-lg">Cancel</button>
                <button onClick={addNote} className="flex items-center gap-2 bg-maroon-800 hover:bg-maroon-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                  <Save className="w-4 h-4" /> Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
