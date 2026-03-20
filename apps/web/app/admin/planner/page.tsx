'use client';

import { useState, useMemo } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Building2, TrendingUp,
  Moon, DollarSign, BarChart3, StickyNote, Plus, Search,
  X, Clock, Star, Edit3, Trash2, Save, Loader2, AlertTriangle
} from 'lucide-react';
import {
  usePlannerData,
  usePlannerNotes,
  useCreatePlannerNote,
  useDeletePlannerNote,
  useTogglePinNote,
  type PlannerDayData,
  type PlannerNote,
} from '@/lib/api';

const formatMoney = (cents: number) =>
  '$' + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

type NoteCategory = 'maintenance' | 'guest' | 'reminder' | 'idea' | 'financial';

const CATEGORY_STYLES: Record<NoteCategory, { bg: string; text: string; label: string }> = {
  maintenance: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Maintenance' },
  guest: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Guest' },
  reminder: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Reminder' },
  idea: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Idea' },
  financial: { bg: 'bg-green-100', text: 'text-green-700', label: 'Financial' },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function OccupancyPlanner() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [noteSearch, setNoteSearch] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', category: 'reminder' as NoteCategory });

  // Live API hooks
  const { data: plannerData, isLoading: dataLoading, error: dataError, refetch: refetchData } = usePlannerData(currentMonth, currentYear);
  const { data: notesData, isLoading: notesLoading, error: notesError, refetch: refetchNotes } = usePlannerNotes(currentMonth, currentYear);
  const createNoteMutation = useCreatePlannerNote();
  const deleteNoteMutation = useDeletePlannerNote();
  const togglePinMutation = useTogglePinNote();

  const monthData: PlannerDayData[] = plannerData?.days || [];
  const totalUnits = plannerData?.totalUnits || 1;
  const notes: PlannerNote[] = notesData?.notes || [];

  const firstDow = new Date(currentYear, currentMonth, 1).getDay();

  const { avgOccupancy, totalRevenue, totalCheckIns, revPAR } = useMemo(() => {
    if (monthData.length === 0) return { avgOccupancy: 0, totalRevenue: 0, totalCheckIns: 0, revPAR: 0 };
    const avgOcc = Math.round(monthData.reduce((s, d) => s + d.occupancy, 0) / monthData.length);
    const totRev = monthData.reduce((s, d) => s + d.revenue, 0);
    const totCI = monthData.reduce((s, d) => s + d.checkIns, 0);
    const rpar = Math.round(totRev / (totalUnits * monthData.length));
    return { avgOccupancy: avgOcc, totalRevenue: totRev, totalCheckIns: totCI, revPAR: rpar };
  }, [monthData, totalUnits]);

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
    const noteDate = dateStr || `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    createNoteMutation.mutate(
      { date: noteDate, title: newNote.title, content: newNote.content, category: newNote.category },
      { onSuccess: () => {
        setNewNote({ title: '', content: '', category: 'reminder' });
        setShowNewNote(false);
      }}
    );
  };

  const deleteNote = (id: string) => deleteNoteMutation.mutate(id);
  const togglePin = (id: string) => togglePinMutation.mutate(id);

  const isLoading = dataLoading || notesLoading;
  const hasError = dataError || notesError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-maroon-800" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <p className="text-charcoal-600">Failed to load planner data</p>
        <button onClick={() => { refetchData(); refetchNotes(); }} className="px-4 py-2 bg-maroon-800 text-white rounded-lg">Retry</button>
      </div>
    );
  }

  const occupiedCount = selectedDayData ? Math.round(totalUnits * selectedDayData.occupancy / 100) : 0;

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
          <p className="text-charcoal-400 mt-1">Calendar view, KPIs, and operational notes &middot; {totalUnits} units</p>
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
                  <p className="font-bold text-charcoal-800">{selectedDayData.occupancy}% ({occupiedCount} / {totalUnits})</p>
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
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLES[n.category]?.bg || 'bg-gray-100'} ${CATEGORY_STYLES[n.category]?.text || 'text-gray-700'} mr-2`}>
                        {CATEGORY_STYLES[n.category]?.label || n.category}
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
            {filteredNotes.length === 0 && (
              <p className="text-sm text-charcoal-400 text-center py-8">No notes for this month</p>
            )}
            {filteredNotes.map((note) => (
              <div key={note.id} className={`border rounded-lg p-3 ${note.pinned ? 'border-maroon-300 bg-maroon-50/30' : 'border-charcoal-100'}`}>
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLES[note.category]?.bg || 'bg-gray-100'} ${CATEGORY_STYLES[note.category]?.text || 'text-gray-700'}`}>
                      {CATEGORY_STYLES[note.category]?.label || note.category}
                    </span>
                    {note.pinned && <Star className="w-3 h-3 text-maroon-800 fill-maroon-800" />}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => togglePin(note.id)} className="p-1 hover:bg-cream-100 rounded" title={note.pinned ? 'Unpin' : 'Pin'}>
                      <Star className={`w-3 h-3 ${note.pinned ? 'text-maroon-800' : 'text-charcoal-300'}`} />
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      disabled={deleteNoteMutation.isPending}
                      className="p-1 hover:bg-red-50 rounded"
                    >
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
                  onChange={(e) => setNewNote({ ...newNote, category: e.target.value as NoteCategory })}
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
                <button
                  onClick={addNote}
                  disabled={createNoteMutation.isPending}
                  className="flex items-center gap-2 bg-maroon-800 hover:bg-maroon-700 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {createNoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
