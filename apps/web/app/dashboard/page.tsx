'use client';

/**
 * Right at Home BnB - Role-Based Dashboard
 * Detects user role (owner/admin/worker) and worker type (cleaner/pool/maintenance/yard)
 * Shows tailored dashboard for each role.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Home, Calendar, DollarSign, Sparkles, Bell,
  ArrowUpRight, Clock, CheckCircle, AlertCircle, AlertTriangle,
  MapPin, Star, MessageSquare, Key, Zap, ChevronRight, Phone,
  Settings, Thermometer, Activity, RefreshCw, Sunrise, Sunset,
  Moon, Sun, Building2, Wifi, WifiOff, BarChart3, PhoneCall, Mail,
  Camera, ClipboardCheck, Package, Droplets, Wrench, TreePine,
  Waves, Timer, CircleDot, FileText, TrendingUp, Truck, Hammer,
  Leaf, Scissors, CloudRain, ThermometerSun, AlertOctagon,
  CheckSquare, XCircle, PlayCircle, PauseCircle,
} from 'lucide-react';
import {
  useDashboardStats, useProperties, useCleaningJobs,
  usePendingMessages, useLocks,
} from '@/lib/api';
import { properties as propertyKnowledge } from '@/lib/property-knowledge';
import { CONTACT_INFO, initiateCall, initiateEmail } from '@/lib/demo-mode';
import toast from 'react-hot-toast';

const BRAND = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
  charcoal: '#2D2D2D',
  maroonLight: '#722F37',
};

type WorkerType = 'cleaner' | 'pool' | 'maintenance' | 'yard';
type UserRole = 'guest' | 'worker' | 'admin' | 'owner';

interface DevUser {
  displayName: string;
  role: UserRole;
  workerType: WorkerType | null;
}

function useCurrentUser(): DevUser {
  const [user, setUser] = useState<DevUser>({
    displayName: 'Steven',
    role: 'owner',
    workerType: null,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('dev_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser({
          displayName: parsed.displayName || 'User',
          role: parsed.role || 'owner',
          workerType: parsed.workerType || null,
        });
      }
    } catch {}
  }, []);

  return user;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', icon: Sunrise };
  if (hour < 17) return { text: 'Good afternoon', icon: Sun };
  if (hour < 21) return { text: 'Good evening', icon: Sunset };
  return { text: 'Good night', icon: Moon };
};

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD - ROUTES BY ROLE
// ═══════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const user = useCurrentUser();

  if (user.role === 'worker' && user.workerType) {
    switch (user.workerType) {
      case 'cleaner': return <CleanerDashboard user={user} />;
      case 'pool': return <PoolDashboard user={user} />;
      case 'maintenance': return <MaintenanceDashboard user={user} />;
      case 'yard': return <YardDashboard user={user} />;
    }
  }

  if (user.role === 'admin') {
    return <AdminDashboard user={user} />;
  }

  if (user.role === 'guest') {
    return <GuestDashboard user={user} />;
  }

  return <OwnerDashboard user={user} />;
}

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════

function DashboardShell({
  user,
  accentColor,
  accentBg,
  icon: HeaderIcon,
  subtitle,
  children,
}: {
  user: DevUser;
  accentColor: string;
  accentBg: string;
  icon: React.ElementType;
  subtitle: string;
  children: React.ReactNode;
}) {
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;
  const firstName = user.displayName.split(' ')[0];

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${accentBg} flex items-center justify-center`}>
                <HeaderIcon className={`w-6 h-6 ${accentColor}`} />
              </div>
              <div>
                <h1 className="text-2xl font-['Playfair_Display'] font-bold text-[#500000]">
                  {greeting.text}, {firstName}
                </h1>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <GreetingIcon className="w-4 h-4" />
                  {subtitle}
                  <span className="text-gray-300">|</span>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/messages">
                <button className="p-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                  <MessageSquare className="w-5 h-5 text-gray-600" />
                </button>
              </Link>
              <Link href="/dev-login">
                <button className="px-3 py-2 text-xs bg-gray-100 rounded-lg text-gray-500 hover:bg-gray-200">
                  Switch Role
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}

function JobCard({
  title,
  property,
  time,
  status,
  priority,
  icon: Icon,
  iconColor,
  onClick,
}: {
  title: string;
  property: string;
  time: string;
  status: 'pending' | 'in_progress' | 'completed' | 'urgent';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  icon: React.ElementType;
  iconColor: string;
  onClick?: () => void;
}) {
  const statusConfig = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Pending', icon: Clock },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress', icon: PlayCircle },
    completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Done', icon: CheckCircle },
    urgent: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgent', icon: AlertOctagon },
  };
  const s = statusConfig[status];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {property}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.text}`}>
              {s.label}
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {time}
            </span>
            {priority === 'urgent' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                URGENT
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, color, bgColor }: {
  label: string; value: string | number; icon: React.ElementType; color: string; bgColor: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CLEANING CREW DASHBOARD
// ═══════════════════════════════════════════════════════════════

function CleanerDashboard({ user }: { user: DevUser }) {
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  useEffect(() => {
    if (!activeTimer) return;
    const interval = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  const formatTimer = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const todayJobs = [
    { id: '1', title: 'Turnover Clean', property: 'Oasis Pool & Billiards — Castleford', time: '9:00 AM', status: 'in_progress' as const, type: 'turnover' as const },
    { id: '2', title: 'Deep Clean', property: 'Adobe Compound — Golf Course', time: '12:00 PM', status: 'pending' as const, type: 'deep' as const },
    { id: '3', title: 'Turnover Clean', property: 'Patio Home — Hot Tub', time: '2:30 PM', status: 'pending' as const, type: 'turnover' as const },
    { id: '4', title: 'Touch-Up', property: 'Modern Ranch — W. Wall St', time: '4:00 PM', status: 'pending' as const, type: 'touchup' as const },
  ];

  const checklist = [
    { id: '1', task: 'Strip beds & start laundry', done: true },
    { id: '2', task: 'Clean all bathrooms', done: true },
    { id: '3', task: 'Vacuum & mop all floors', done: false },
    { id: '4', task: 'Wipe all surfaces & countertops', done: false },
    { id: '5', task: 'Clean kitchen & appliances', done: false },
    { id: '6', task: 'Restock supplies & amenities', done: false },
    { id: '7', task: 'Make beds with fresh linens', done: false },
    { id: '8', task: 'Take completion photos', done: false },
  ];

  return (
    <DashboardShell user={user} accentColor="text-white" accentBg="bg-emerald-500" icon={Sparkles} subtitle="Cleaning Crew">
      {/* Active Timer */}
      {activeTimer && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-emerald-600 rounded-xl p-4 text-white flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Timer className="w-6 h-6" />
            <div>
              <p className="font-semibold">Clocked In — {activeTimer}</p>
              <p className="text-emerald-200 text-sm">{formatTimer(timerSeconds)}</p>
            </div>
          </div>
          <button
            onClick={() => { setActiveTimer(null); setTimerSeconds(0); toast.success('Clocked out'); }}
            className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30"
          >
            Clock Out
          </button>
        </motion.div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Today's Jobs" value={todayJobs.length} icon={ClipboardCheck} color="text-emerald-600" bgColor="bg-emerald-100" />
        <StatCard label="Completed" value={todayJobs.filter(j => (j.status as string) === 'completed').length} icon={CheckCircle} color="text-blue-600" bgColor="bg-blue-100" />
        <StatCard label="Properties" value={5} icon={Home} color="text-[#500000]" bgColor="bg-[#500000]/10" />
        <StatCard label="This Week" value={12} icon={Calendar} color="text-purple-600" bgColor="bg-purple-100" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Jobs */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" /> Today&apos;s Schedule
          </h2>
          {todayJobs.map((job) => (
            <JobCard
              key={job.id}
              title={job.title}
              property={job.property}
              time={job.time}
              status={job.status}
              icon={Sparkles}
              iconColor={job.type === 'deep' ? 'bg-purple-500' : job.type === 'touchup' ? 'bg-amber-500' : 'bg-emerald-500'}
              onClick={() => {
                if (!activeTimer) {
                  setActiveTimer(job.property);
                  toast.success(`Started timer for ${job.property}`);
                }
              }}
            />
          ))}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Cleaning Checklist */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-emerald-600" /> Turnover Checklist
            </h3>
            <div className="space-y-2">
              {checklist.map((item) => (
                <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={item.done}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className={`text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item.task}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">{checklist.filter(c => c.done).length}/{checklist.length} complete</p>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Upload Photos', icon: Camera, color: 'bg-blue-500' },
                { label: 'Request Supplies', icon: Package, color: 'bg-amber-500' },
                { label: 'Flag Maintenance Issue', icon: AlertTriangle, color: 'bg-red-500' },
                { label: 'Message Steven', icon: MessageSquare, color: 'bg-[#500000]' },
              ].map((action) => (
                <button
                  key={action.label}
                  className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center`}>
                    <action.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════
// POOL TECH DASHBOARD
// ═══════════════════════════════════════════════════════════════

function PoolDashboard({ user }: { user: DevUser }) {
  const todayRoute = [
    { id: '1', property: 'Oasis Pool & Billiards — Castleford', time: '8:00 AM', status: 'completed' as const, ph: 7.4, chlorine: 2.1 },
    { id: '2', property: 'Adobe Compound — Golf Course', time: '9:30 AM', status: 'in_progress' as const, ph: null, chlorine: null },
    { id: '3', property: 'Executive Retreat — N. A St', time: '11:00 AM', status: 'pending' as const, ph: null, chlorine: null },
    { id: '4', property: 'Hot Tub Villa — Garfield', time: '1:00 PM', status: 'pending' as const, ph: null, chlorine: null },
  ];

  return (
    <DashboardShell user={user} accentColor="text-white" accentBg="bg-cyan-500" icon={Waves} subtitle="Pool Technician">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Today's Pools" value={todayRoute.length} icon={Droplets} color="text-cyan-600" bgColor="bg-cyan-100" />
        <StatCard label="Completed" value={todayRoute.filter(r => r.status === 'completed').length} icon={CheckCircle} color="text-emerald-600" bgColor="bg-emerald-100" />
        <StatCard label="Chemical Tests" value={1} icon={CircleDot} color="text-purple-600" bgColor="bg-purple-100" />
        <StatCard label="Alerts" value={0} icon={AlertCircle} color="text-red-600" bgColor="bg-red-100" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Waves className="w-5 h-5 text-cyan-600" /> Today&apos;s Pool Route
          </h2>
          {todayRoute.map((stop, i) => (
            <motion.div
              key={stop.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    stop.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    stop.status === 'in_progress' ? 'bg-cyan-100 text-cyan-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {i + 1}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-900">{stop.property}</h4>
                    <p className="text-xs text-gray-500">{stop.time}</p>
                  </div>
                </div>
                {stop.ph !== null && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">pH: <span className={`font-bold ${stop.ph >= 7.2 && stop.ph <= 7.6 ? 'text-emerald-600' : 'text-red-600'}`}>{stop.ph}</span></p>
                    <p className="text-xs text-gray-500">Cl: <span className={`font-bold ${stop.chlorine! >= 1.0 && stop.chlorine! <= 3.0 ? 'text-emerald-600' : 'text-red-600'}`}>{stop.chlorine} ppm</span></p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-4">
          {/* Chemical Ranges */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-cyan-600" /> Target Ranges
            </h3>
            <div className="space-y-3 text-sm">
              {[
                { label: 'pH Level', range: '7.2 — 7.6', color: 'text-cyan-600' },
                { label: 'Free Chlorine', range: '1.0 — 3.0 ppm', color: 'text-blue-600' },
                { label: 'Alkalinity', range: '80 — 120 ppm', color: 'text-purple-600' },
                { label: 'Cyanuric Acid', range: '30 — 50 ppm', color: 'text-amber-600' },
                { label: 'Calcium Hardness', range: '200 — 400 ppm', color: 'text-gray-600' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-gray-600">{item.label}</span>
                  <span className={`font-medium ${item.color}`}>{item.range}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Log Chemical Reading', icon: FileText, color: 'bg-cyan-500' },
                { label: 'Report Equipment Issue', icon: AlertTriangle, color: 'bg-red-500' },
                { label: 'Order Chemicals', icon: Package, color: 'bg-amber-500' },
                { label: 'Upload Photos', icon: Camera, color: 'bg-blue-500' },
                { label: 'Message Steven', icon: MessageSquare, color: 'bg-[#500000]' },
              ].map((action) => (
                <button key={action.label} className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left">
                  <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center`}>
                    <action.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAINTENANCE TECH DASHBOARD
// ═══════════════════════════════════════════════════════════════

function MaintenanceDashboard({ user }: { user: DevUser }) {
  const workOrders = [
    { id: '1', title: 'HVAC not cooling — Unit 2', property: 'Adobe Compound — Golf Course', time: 'Today', status: 'urgent' as const, priority: 'urgent' as const },
    { id: '2', title: 'Leaking faucet — Master bath', property: 'Patio Home — Hot Tub', time: 'Today', status: 'in_progress' as const, priority: 'high' as const },
    { id: '3', title: 'Replace smoke detector batteries', property: 'Oasis Pool & Billiards', time: 'Tomorrow', status: 'pending' as const, priority: 'normal' as const },
    { id: '4', title: 'Garage door sensor alignment', property: 'Modern Ranch — W. Wall St', time: 'Tomorrow', status: 'pending' as const, priority: 'normal' as const },
    { id: '5', title: 'Touch up paint — Guest bedroom', property: 'Executive Retreat — N. A St', time: 'This week', status: 'pending' as const, priority: 'low' as const },
  ];

  return (
    <DashboardShell user={user} accentColor="text-white" accentBg="bg-orange-500" icon={Wrench} subtitle="Maintenance Technician">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Open Orders" value={workOrders.filter(w => (w.status as string) !== 'completed').length} icon={Wrench} color="text-orange-600" bgColor="bg-orange-100" />
        <StatCard label="Urgent" value={workOrders.filter(w => w.priority === 'urgent').length} icon={AlertOctagon} color="text-red-600" bgColor="bg-red-100" />
        <StatCard label="In Progress" value={workOrders.filter(w => w.status === 'in_progress').length} icon={PlayCircle} color="text-blue-600" bgColor="bg-blue-100" />
        <StatCard label="Completed Today" value={2} icon={CheckCircle} color="text-emerald-600" bgColor="bg-emerald-100" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Hammer className="w-5 h-5 text-orange-600" /> Work Orders
          </h2>
          {workOrders.map((wo) => (
            <JobCard
              key={wo.id}
              title={wo.title}
              property={wo.property}
              time={wo.time}
              status={wo.status}
              priority={wo.priority}
              icon={wo.priority === 'urgent' ? AlertOctagon : Wrench}
              iconColor={wo.priority === 'urgent' ? 'bg-red-500' : wo.priority === 'high' ? 'bg-orange-500' : 'bg-gray-400'}
            />
          ))}
        </div>

        <div className="space-y-4">
          {/* Parts Inventory */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-600" /> Parts in Truck
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { part: 'HVAC Filters (various)', qty: 6 },
                { part: 'Smoke Detectors', qty: 4 },
                { part: 'Faucet Repair Kits', qty: 3 },
                { part: 'Light Bulbs (LED)', qty: 12 },
                { part: 'Caulk Tubes', qty: 5 },
                { part: 'Door Hardware Kit', qty: 2 },
              ].map(item => (
                <div key={item.part} className="flex justify-between items-center py-1">
                  <span className="text-gray-600">{item.part}</span>
                  <span className={`font-medium ${item.qty <= 2 ? 'text-red-600' : 'text-gray-900'}`}>
                    {item.qty} {item.qty <= 2 && '⚠️'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Log Time & Parts', icon: Timer, color: 'bg-orange-500' },
                { label: 'Upload Repair Photos', icon: Camera, color: 'bg-blue-500' },
                { label: 'Order Parts', icon: Truck, color: 'bg-purple-500' },
                { label: 'Property Inspection', icon: ClipboardCheck, color: 'bg-emerald-500' },
                { label: 'Message Steven', icon: MessageSquare, color: 'bg-[#500000]' },
              ].map((action) => (
                <button key={action.label} className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left">
                  <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center`}>
                    <action.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════
// YARD CREW DASHBOARD
// ═══════════════════════════════════════════════════════════════

function YardDashboard({ user }: { user: DevUser }) {
  const schedule = [
    { id: '1', title: 'Full Mow & Edge', property: 'Oasis Pool & Billiards — Castleford', time: '7:30 AM', status: 'completed' as const },
    { id: '2', title: 'Full Mow & Edge', property: 'Adobe Compound — Golf Course', time: '9:00 AM', status: 'in_progress' as const },
    { id: '3', title: 'Trim Hedges & Blow', property: 'Patio Home — Hot Tub', time: '10:30 AM', status: 'pending' as const },
    { id: '4', title: 'Full Mow & Edge', property: 'Modern Ranch — W. Wall St', time: '12:00 PM', status: 'pending' as const },
    { id: '5', title: 'Tree Trimming', property: 'Executive Retreat — N. A St', time: '2:00 PM', status: 'pending' as const },
  ];

  return (
    <DashboardShell user={user} accentColor="text-white" accentBg="bg-green-600" icon={TreePine} subtitle="Yard Crew">
      {/* Weather Alert */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3"
      >
        <ThermometerSun className="w-6 h-6 text-amber-600 shrink-0" />
        <div>
          <p className="font-medium text-amber-800 text-sm">High Heat Advisory — 98°F today</p>
          <p className="text-xs text-amber-600">Take water breaks every 30 min. Avoid heavy work 12-3 PM.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Today's Properties" value={schedule.length} icon={TreePine} color="text-green-600" bgColor="bg-green-100" />
        <StatCard label="Completed" value={schedule.filter(s => s.status === 'completed').length} icon={CheckCircle} color="text-emerald-600" bgColor="bg-emerald-100" />
        <StatCard label="Seasonal Tasks" value={3} icon={Leaf} color="text-orange-600" bgColor="bg-orange-100" />
        <StatCard label="Equipment OK" value="5/5" icon={Scissors} color="text-gray-600" bgColor="bg-gray-100" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green-600" /> Today&apos;s Route
          </h2>
          {schedule.map((job) => (
            <JobCard
              key={job.id}
              title={job.title}
              property={job.property}
              time={job.time}
              status={job.status}
              icon={job.title.includes('Trim') || job.title.includes('Tree') ? Scissors : TreePine}
              iconColor={job.title.includes('Tree') ? 'bg-amber-600' : 'bg-green-600'}
            />
          ))}
        </div>

        <div className="space-y-4">
          {/* Equipment Check */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-green-600" /> Equipment Check
            </h3>
            <div className="space-y-2">
              {[
                { item: 'Zero-Turn Mower', status: 'ok' },
                { item: 'String Trimmer', status: 'ok' },
                { item: 'Hedge Trimmer', status: 'ok' },
                { item: 'Backpack Blower', status: 'ok' },
                { item: 'Chainsaw', status: 'needs_fuel' },
              ].map(eq => (
                <div key={eq.item} className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-600">{eq.item}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    eq.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {eq.status === 'ok' ? 'Ready' : 'Needs Fuel'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Before/After Photos', icon: Camera, color: 'bg-green-600' },
                { label: 'Log Equipment Issue', icon: AlertTriangle, color: 'bg-red-500' },
                { label: 'Request Supplies', icon: Package, color: 'bg-amber-500' },
                { label: 'Flag Irrigation Problem', icon: Droplets, color: 'bg-blue-500' },
                { label: 'Message Steven', icon: MessageSquare, color: 'bg-[#500000]' },
              ].map((action) => (
                <button key={action.label} className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left">
                  <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center`}>
                    <action.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════
// OWNER DASHBOARD (Steven Palma - original)
// ═══════════════════════════════════════════════════════════════

function OwnerDashboard({ user }: { user: DevUser }) {
  const { data: stats } = useDashboardStats();
  const { data: cleaningJobs } = useCleaningJobs();
  const { data: pendingMessages } = usePendingMessages();
  const { data: locks } = useLocks();
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;
  const firstName = user.displayName.split(' ')[0];

  const activeCleanings = cleaningJobs?.filter(j => j.status === 'IN_PROGRESS') || [];
  const lockStats = useMemo(() => {
    if (!locks) return { online: 0, offline: 0 };
    return {
      online: locks.filter(l => l.isOnline).length,
      offline: locks.filter(l => !l.isOnline).length,
    };
  }, [locks]);

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center shadow-lg shadow-[#500000]/20">
                <GreetingIcon className="w-7 h-7 text-[#C4A777]" />
              </div>
              <div>
                <h1 className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
                  {greeting.text}, {firstName}
                </h1>
                <p className="text-gray-500 mt-1 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  {propertyKnowledge.length} properties
                  <span className="text-gray-300">|</span>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                <Bell className="w-5 h-5 text-[#500000]" />
                {(pendingMessages?.length || 0) > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                    {pendingMessages?.length}
                  </span>
                )}
              </button>
              <div className="relative group">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/20">
                  <Zap className="w-5 h-5" /> Quick Action
                </button>
                <div className="absolute right-0 mt-2 w-56 py-2 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  {[
                    { label: 'Add Property', icon: Building2, href: '/properties/new' },
                    { label: 'Generate Lock Code', icon: Key, href: '/locks' },
                    { label: 'Schedule Cleaning', icon: Sparkles, href: '/cleaning' },
                    { label: 'Send Message', icon: MessageSquare, href: '/messages' },
                    { label: 'View Reports', icon: BarChart3, href: '/finance' },
                  ].map((item) => (
                    <Link key={item.label} href={item.href}>
                      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                        <item.icon className="w-4 h-4 text-[#500000]" />
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Today's Check-ins" value={stats?.todayCheckIns || 0} icon={ArrowUpRight} color="text-emerald-600" bgColor="bg-emerald-100" />
          <StatCard label="Active Cleanings" value={activeCleanings.length} icon={Sparkles} color="text-purple-600" bgColor="bg-purple-100" />
          <StatCard label="Properties" value={propertyKnowledge.length} icon={Home} color="text-[#500000]" bgColor="bg-[#500000]/10" />
          <StatCard label="Locks Online" value={`${lockStats.online}/${lockStats.online + lockStats.offline}`} icon={lockStats.offline > 0 ? WifiOff : Wifi} color={lockStats.offline > 0 ? 'text-amber-600' : 'text-emerald-600'} bgColor={lockStats.offline > 0 ? 'bg-amber-100' : 'bg-emerald-100'} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Card */}
            <div className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-2xl p-8 text-white">
              <h2 className="text-2xl font-['Playfair_Display'] font-bold mb-4">Property Management</h2>
              <p className="text-white/70 mb-6">Manage your {propertyKnowledge.length} properties across Midland, TX.</p>
              <div className="flex flex-wrap gap-4">
                <Link href="/admin/dispatch">
                  <button className="flex items-center gap-3 px-6 py-3 bg-white text-[#500000] rounded-xl font-semibold shadow-lg">
                    <Activity className="w-5 h-5" /> View Dispatch
                  </button>
                </Link>
                <Link href="/admin/accounting">
                  <button className="flex items-center gap-3 px-6 py-3 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30">
                    <DollarSign className="w-5 h-5" /> Financials
                  </button>
                </Link>
              </div>
            </div>

            {/* Properties */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-['Playfair_Display'] font-semibold text-gray-900">Property Portfolio</h2>
                <Link href="/properties"><span className="text-sm text-[#500000] hover:underline flex items-center gap-1">View All <ChevronRight className="w-4 h-4" /></span></Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {propertyKnowledge.slice(0, 6).map((property) => (
                  <Link key={property.id} href={`/properties/${property.id}`}>
                    <div className="p-4 bg-gray-50 rounded-xl hover:bg-[#500000]/5 transition-colors">
                      <div className="font-medium text-sm text-gray-900 truncate">{property.nickname || property.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{property.bedrooms} bed • {property.bathrooms} bath</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-2xl p-6 text-white">
              <h3 className="font-['Playfair_Display'] font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#C4A777]" /> Quick Actions
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Smart Home Control', icon: Thermometer, href: '/smart-home' },
                  { label: 'Generate Lock Code', icon: Key, href: '/locks' },
                  { label: 'Schedule Cleaning', icon: Sparkles, href: '/cleaning' },
                  { label: 'AI Concierge', icon: MessageSquare, href: '/concierge' },
                  { label: 'Settings', icon: Settings, href: '/settings' },
                ].map((action) => (
                  <Link key={action.label} href={action.href}>
                    <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                      <action.icon className="w-5 h-5" />
                      <span className="font-medium flex-1">{action.label}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Properties Sidebar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-['Playfair_Display'] font-semibold text-gray-900 mb-4">Properties</h3>
              <div className="space-y-3">
                {propertyKnowledge.slice(0, 5).map((property) => (
                  <Link key={property.id} href={`/properties/${property.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{property.nickname || property.name}</div>
                        <div className="text-xs text-gray-500">{property.bedrooms} bed, {property.bathrooms} bath</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════

function AdminDashboard({ user }: { user: DevUser }) {
  return (
    <DashboardShell user={user} accentColor="text-white" accentBg="bg-purple-500" icon={Activity} subtitle="Admin Panel">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Properties" value={propertyKnowledge.length} icon={Home} color="text-[#500000]" bgColor="bg-[#500000]/10" />
        <StatCard label="Active Workers" value={8} icon={Activity} color="text-purple-600" bgColor="bg-purple-100" />
        <StatCard label="Open Tasks" value={14} icon={ClipboardCheck} color="text-amber-600" bgColor="bg-amber-100" />
        <StatCard label="Messages" value={3} icon={MessageSquare} color="text-blue-600" bgColor="bg-blue-100" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {[
          { title: 'Bookings', icon: Calendar, href: '/bookings', desc: 'Manage reservations, check-ins, check-outs' },
          { title: 'Dispatch', icon: Truck, href: '/admin/dispatch', desc: 'Assign and track worker tasks' },
          { title: 'Properties', icon: Home, href: '/properties', desc: 'View and manage all properties' },
          { title: 'Smart Home', icon: Thermometer, href: '/admin/smart-home', desc: 'Locks, thermostats, devices' },
          { title: 'Guest CRM', icon: Star, href: '/admin/crm', desc: 'Guest profiles, reviews, loyalty' },
          { title: 'Inventory', icon: Package, href: '/admin/inventory', desc: 'Supplies, linens, equipment' },
        ].map((item) => (
          <Link key={item.title} href={item.href}>
            <motion.div
              whileHover={{ y: -2 }}
              className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#500000]/10 flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-[#500000]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 ml-auto" />
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════
// GUEST DASHBOARD
// ═══════════════════════════════════════════════════════════════

function GuestDashboard({ user }: { user: DevUser }) {
  return (
    <DashboardShell user={user} accentColor="text-white" accentBg="bg-blue-500" icon={Home} subtitle="Guest Portal">
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Your Bookings" value={0} icon={Calendar} color="text-blue-600" bgColor="bg-blue-100" />
        <StatCard label="Messages" value={0} icon={MessageSquare} color="text-[#500000]" bgColor="bg-[#500000]/10" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Link href="/properties">
          <motion.div whileHover={{ y: -2 }} className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-xl p-8 text-white">
            <Home className="w-10 h-10 text-[#C4A777] mb-4" />
            <h3 className="text-xl font-['Playfair_Display'] font-bold mb-2">Browse Properties</h3>
            <p className="text-white/70">Explore our {propertyKnowledge.length} properties across Midland, TX</p>
          </motion.div>
        </Link>

        <Link href="/concierge">
          <motion.div whileHover={{ y: -2 }} className="bg-white rounded-xl p-8 border border-gray-100 shadow-sm">
            <MessageSquare className="w-10 h-10 text-[#500000] mb-4" />
            <h3 className="text-xl font-['Playfair_Display'] font-bold text-gray-900 mb-2">AI Concierge</h3>
            <p className="text-gray-500">Chat with Steven, our AI concierge for local tips and assistance</p>
          </motion.div>
        </Link>
      </div>

      <div className="mt-8 bg-white rounded-xl p-6 border border-gray-100 shadow-sm text-center">
        <Phone className="w-8 h-8 text-[#500000] mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900 mb-1">Need Help?</h3>
        <p className="text-sm text-gray-500 mb-4">Call or text Steven directly</p>
        <button onClick={initiateCall} className="px-6 py-3 bg-[#500000] text-white rounded-xl font-semibold">
          <span className="flex items-center gap-2"><PhoneCall className="w-5 h-5" /> Call {CONTACT_INFO.phoneDisplay}</span>
        </button>
      </div>
    </DashboardShell>
  );
}
