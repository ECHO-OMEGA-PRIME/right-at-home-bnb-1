'use client';

/**
 * Right at Home BnB - Smart Lock Management
 * Complete lock control with code generation, access logs, and monitoring
 * @author ECHO OMEGA PRIME
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Lock, Unlock, Battery, Wifi, WifiOff, RefreshCw,
  Clock, Home, User, History, Shield, AlertTriangle,
  CheckCircle, Copy, Eye, EyeOff, Plus, Settings, X,
  Send, Phone, Calendar, Timer, Activity, ChevronRight,
  Zap, BatteryLow, BatteryWarning, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';

// Types
interface SmartLock {
  id: string;
  lock_id: string;
  name: string;
  brand: string;
  provider: string;
  property_id: string;
  property?: { name: string };
  model?: string;
  location?: string;
  status: string;
  batteryLevel: number;
  battery_level: number;
  isOnline: boolean;
  is_online: boolean;
  last_activity?: string;
  currentCode?: string;
  current_code?: string;
  codeExpiresAt?: string;
  code_expires_at?: string;
  auto_lock_enabled?: boolean;
}

interface AccessCode {
  code_id: string;
  code: string;
  name: string;
  code_type: string;
  start_time?: string;
  end_time?: string;
  is_active: boolean;
  is_expired: boolean;
  guest_name?: string;
  time_until_expiry_seconds?: number;
}

interface ActivityEntry {
  timestamp: string;
  action: string;
  method: string;
  user_name?: string;
  code_name?: string;
}

const brandConfig: Record<string, { name: string; color: string; bgColor: string }> = {
  SCHLAGE: { name: 'Schlage', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  YALE: { name: 'Yale', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  AUGUST: { name: 'August', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  KWIKSET: { name: 'Kwikset', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  ARPHA: { name: 'ARPHA (Tuya)', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  TUYA: { name: 'Tuya', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  OTHER: { name: 'Other', color: 'text-gray-500', bgColor: 'bg-gray-500/10' },
};

// Use Next.js API route (has Tuya integration) instead of Python backend
const API_BASE = '/api/smart-home';

export default function LocksPage() {
  const [locks, setLocks] = useState<SmartLock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLock, setSelectedLock] = useState<SmartLock | null>(null);
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch locks from Next.js API route (Tuya integration)
  const fetchLocks = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/locks`);
      if (response.ok) {
        const data = await response.json();
        setLocks(data.locks || []);
      }
    } catch (error) {
      console.error('Failed to fetch locks:', error);
      toast.error('Failed to load locks');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLocks();
    // Refresh every 30 seconds
    const interval = setInterval(fetchLocks, 30000);
    return () => clearInterval(interval);
  }, [fetchLocks]);

  // Stats
  const stats = useMemo(() => {
    if (!locks) return { total: 0, online: 0, lowBattery: 0, activeCode: 0 };

    return {
      total: locks.length,
      online: locks.filter(l => l.isOnline || l.is_online).length,
      lowBattery: locks.filter(l => (l.batteryLevel || l.battery_level || 100) < 30).length,
      activeCode: locks.filter(l => l.currentCode || l.current_code).length,
    };
  }, [locks]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const toggleShowCode = (lockId: string) => {
    setShowCodes(prev => ({ ...prev, [lockId]: !prev[lockId] }));
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLocks();
  };

  const handleLock = async (lockId: string) => {
    try {
      const lock = locks.find(l => l.id === lockId || l.lock_id === lockId);
      const deviceId = (lock as any)?.device_id || lockId;
      const response = await fetch(`${API_BASE}/locks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock', lock_id: lockId, device_id: deviceId }),
      });
      if (response.ok) {
        toast.success('Lock secured');
        fetchLocks();
      } else {
        toast.error('Failed to lock');
      }
    } catch (error) {
      toast.error('Failed to lock');
    }
  };

  const handleUnlock = async (lockId: string) => {
    try {
      const lock = locks.find(l => l.id === lockId || l.lock_id === lockId);
      const deviceId = (lock as any)?.device_id || lockId;
      const response = await fetch(`${API_BASE}/locks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', lock_id: lockId, device_id: deviceId }),
      });
      if (response.ok) {
        toast.success('Unlocked');
        fetchLocks();
      } else {
        toast.error('Failed to unlock');
      }
    } catch (error) {
      toast.error('Failed to unlock');
    }
  };

  const handleViewActivity = async (lock: SmartLock) => {
    setSelectedLock(lock);
    try {
      const deviceId = (lock as any)?.device_id || lock.id || lock.lock_id;
      const response = await fetch(`${API_BASE}/locks?view=activity&device_id=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setActivityLog(data.activity || []);
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    }
    setShowActivityModal(true);
  };

  const handleViewCodes = async (lock: SmartLock) => {
    setSelectedLock(lock);
    try {
      const deviceId = (lock as any)?.device_id || lock.id || lock.lock_id;
      const response = await fetch(`${API_BASE}/locks?view=codes&device_id=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setAccessCodes(data.codes || []);
      }
    } catch (error) {
      console.error('Failed to fetch codes:', error);
    }
  };

  return (
    <DashboardShell>
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
                Smart Locks
              </h1>
              <p className="text-[#2D2D2D]/60 mt-1">
                {stats.online}/{stats.total} locks online
              </p>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#F5F5F0] text-[#500000] font-medium rounded-xl hover:bg-[#500000]/10 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Sync All
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/20"
              >
                <Plus className="w-5 h-5" />
                Generate Code
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Total Locks', value: stats.total, icon: Lock, color: 'text-[#500000]' },
            { label: 'Online', value: stats.online, icon: Wifi, color: 'text-emerald-600' },
            { label: 'Low Battery', value: stats.lowBattery, icon: BatteryWarning, color: stats.lowBattery > 0 ? 'text-amber-600' : 'text-gray-400' },
            { label: 'Active Codes', value: stats.activeCode, icon: Key, color: 'text-blue-600' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-[#2D2D2D]/5"
            >
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D]">
                {stat.value}
              </div>
              <div className="text-sm text-[#2D2D2D]/60">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Low Battery Alert */}
        {stats.lowBattery > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3"
          >
            <BatteryLow className="w-5 h-5 text-amber-600" />
            <span className="text-amber-800">
              {stats.lowBattery} lock{stats.lowBattery > 1 ? 's' : ''} with low battery - consider replacing batteries soon
            </span>
          </motion.div>
        )}

        {/* Locks Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-[#2D2D2D]/10 rounded w-1/2 mb-4" />
                <div className="h-16 bg-[#2D2D2D]/10 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {locks?.map((lock, index) => (
                <LockCard
                  key={lock.id || lock.lock_id}
                  lock={lock}
                  index={index}
                  showCode={showCodes[lock.id || lock.lock_id]}
                  onToggleCode={() => toggleShowCode(lock.id || lock.lock_id)}
                  onCopyCode={handleCopyCode}
                  onLock={() => handleLock(lock.id || lock.lock_id)}
                  onUnlock={() => handleUnlock(lock.id || lock.lock_id)}
                  onViewActivity={() => handleViewActivity(lock)}
                  onGenerateCode={() => {
                    setSelectedLock(lock);
                    setShowGenerateModal(true);
                  }}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Empty State */}
        {!isLoading && (!locks || locks.length === 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-white rounded-2xl"
          >
            <Lock className="w-16 h-16 text-[#2D2D2D]/20 mx-auto mb-4" />
            <h3 className="text-xl font-['Playfair_Display'] text-[#2D2D2D]">No locks configured</h3>
            <p className="text-[#2D2D2D]/60 mt-2">Add your first smart lock to get started</p>
          </motion.div>
        )}
      </main>

      {/* Generate Code Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <GenerateCodeModal
            lock={selectedLock}
            locks={locks}
            onClose={() => {
              setShowGenerateModal(false);
              setSelectedLock(null);
            }}
            onSuccess={() => {
              fetchLocks();
              setShowGenerateModal(false);
              setSelectedLock(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Activity Modal */}
      <AnimatePresence>
        {showActivityModal && selectedLock && (
          <ActivityModal
            lock={selectedLock}
            activities={activityLog}
            onClose={() => {
              setShowActivityModal(false);
              setSelectedLock(null);
              setActivityLog([]);
            }}
          />
        )}
      </AnimatePresence>
    </div>
    </DashboardShell>
  );
}

// Lock Card Component
function LockCard({
  lock,
  index,
  showCode,
  onToggleCode,
  onCopyCode,
  onLock,
  onUnlock,
  onViewActivity,
  onGenerateCode,
}: {
  lock: SmartLock;
  index: number;
  showCode: boolean;
  onToggleCode: () => void;
  onCopyCode: (code: string) => void;
  onLock: () => void;
  onUnlock: () => void;
  onViewActivity: () => void;
  onGenerateCode: () => void;
}) {
  const brand = brandConfig[lock.brand || lock.provider] || brandConfig.OTHER;
  const batteryLevel = lock.batteryLevel || lock.battery_level || 100;
  const isLowBattery = batteryLevel < 30;
  const isCriticalBattery = batteryLevel < 10;
  const isOnline = lock.isOnline || lock.is_online;
  const currentCode = lock.currentCode || lock.current_code;
  const codeExpiresAt = lock.codeExpiresAt || lock.code_expires_at;
  const codeExpired = codeExpiresAt ? new Date(codeExpiresAt) < new Date() : false;

  // Calculate time until expiry
  const getExpiryCountdown = () => {
    if (!codeExpiresAt) return null;
    const expiry = new Date(codeExpiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#2D2D2D]/5 hover:shadow-lg transition-all duration-300"
    >
      {/* Header */}
      <div className="p-5 border-b border-[#2D2D2D]/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${brand.bgColor} flex items-center justify-center`}>
              <Lock className={`w-5 h-5 ${brand.color}`} />
            </div>
            <div>
              <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">
                {lock.property?.name || lock.name || 'Property'}
              </h3>
              <div className="flex items-center gap-2 text-xs text-[#2D2D2D]/50">
                <span>{brand.name}</span>
                {lock.model && <span>- {lock.model}</span>}
              </div>
            </div>
          </div>

          {/* Status Indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isOnline
              ? 'bg-emerald-100 text-emerald-600'
              : 'bg-red-100 text-red-600'
          }`}>
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                Offline
              </>
            )}
          </div>
        </div>

        {/* Battery Level */}
        <div className="flex items-center gap-2">
          <Battery className={`w-4 h-4 ${isCriticalBattery ? 'text-red-500' : isLowBattery ? 'text-amber-500' : 'text-[#2D2D2D]/40'}`} />
          <div className="flex-1 h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${batteryLevel}%` }}
              className={`h-full rounded-full ${
                batteryLevel > 50 ? 'bg-emerald-500' :
                batteryLevel > 20 ? 'bg-amber-500' : 'bg-red-500'
              }`}
            />
          </div>
          <span className={`text-xs ${isCriticalBattery ? 'text-red-500 font-medium' : 'text-[#2D2D2D]/60'}`}>
            {batteryLevel}%
          </span>
        </div>
      </div>

      {/* Code Section */}
      <div className="p-5">
        {currentCode && !codeExpired ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#2D2D2D]/60">Current Access Code</span>
              {codeExpiresAt && (
                <div className="flex items-center gap-1 text-xs text-[#500000]">
                  <Timer className="w-3 h-3" />
                  <span>{getExpiryCountdown()}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-[#F5F5F0] rounded-xl font-mono text-lg text-center tracking-wider">
                {showCode ? currentCode : '\u2022\u2022\u2022\u2022\u2022\u2022'}
              </div>
              <button
                onClick={onToggleCode}
                className="p-3 bg-[#F5F5F0] rounded-xl hover:bg-[#500000]/10 transition-colors"
              >
                {showCode ? (
                  <EyeOff className="w-5 h-5 text-[#500000]" />
                ) : (
                  <Eye className="w-5 h-5 text-[#500000]" />
                )}
              </button>
              <button
                onClick={() => onCopyCode(currentCode)}
                className="p-3 bg-[#F5F5F0] rounded-xl hover:bg-[#500000]/10 transition-colors"
              >
                <Copy className="w-5 h-5 text-[#500000]" />
              </button>
            </div>

            {codeExpiresAt && !codeExpired && (
              <div className="flex items-center gap-1.5 text-xs text-[#2D2D2D]/50">
                <Clock className="w-3 h-3" />
                Expires: {new Date(codeExpiresAt).toLocaleString()}
              </div>
            )}
          </div>
        ) : codeExpired ? (
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 text-amber-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Code Expired</span>
            </div>
            <p className="text-sm text-[#2D2D2D]/50">Generate a new code for the next guest</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <Key className="w-8 h-8 text-[#2D2D2D]/20 mx-auto mb-2" />
            <p className="text-sm text-[#2D2D2D]/50">No active code</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-5 pb-3">
        <div className="flex gap-2">
          <button
            onClick={onLock}
            disabled={!isOnline}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#F5F5F0] text-[#2D2D2D] rounded-xl font-medium hover:bg-[#500000]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="w-4 h-4" />
            Lock
          </button>
          <button
            onClick={onUnlock}
            disabled={!isOnline}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#F5F5F0] text-[#2D2D2D] rounded-xl font-medium hover:bg-[#500000]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Unlock className="w-4 h-4" />
            Unlock
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5">
        <div className="flex gap-2">
          <button
            onClick={onGenerateCode}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#500000] text-white rounded-xl font-medium hover:bg-[#722F37] transition-colors"
          >
            <Key className="w-4 h-4" />
            Generate Code
          </button>
          <button
            onClick={onViewActivity}
            className="p-2.5 bg-[#F5F5F0] text-[#500000] rounded-xl hover:bg-[#500000]/10 transition-colors"
            title="View Activity"
          >
            <History className="w-5 h-5" />
          </button>
          <button
            className="p-2.5 bg-[#F5F5F0] text-[#500000] rounded-xl hover:bg-[#500000]/10 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Generate Code Modal
function GenerateCodeModal({
  lock,
  locks,
  onClose,
  onSuccess,
}: {
  lock: SmartLock | null;
  locks: SmartLock[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedLockId, setSelectedLockId] = useState(lock?.id || lock?.lock_id || '');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [codeLength, setCodeLength] = useState(6);
  const [sendSms, setSendSms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const selectedLock = locks.find(l => l.id === selectedLockId || l.lock_id === selectedLockId);
      const deviceId = (selectedLock as any)?.device_id || selectedLockId;
      const response = await fetch(`${API_BASE}/locks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_guest_code',
          device_id: deviceId,
          lock_id: selectedLockId,
          guest_name: guestName,
          check_in: new Date(checkIn).toISOString(),
          check_out: new Date(checkOut).toISOString(),
          guest_phone: guestPhone || undefined,
          code_length: codeLength,
          send_sms: sendSms && !!guestPhone,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedCode(data.code);
        toast.success(`Code generated: ${data.code}`);

        if (data.sms_sent) {
          toast.success('SMS sent to guest');
        }

        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to generate code');
      }
    } catch (error) {
      toast.error('Failed to generate code');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-[#2D2D2D]/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-['Playfair_Display'] font-bold text-[#500000]">
              Generate Access Code
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-xl transition-colors">
              <X className="w-5 h-5 text-[#2D2D2D]/60" />
            </button>
          </div>
        </div>

        {generatedCode ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-[#2D2D2D] mb-2">Code Generated!</h3>
            <div className="p-4 bg-[#F5F5F0] rounded-xl font-mono text-3xl tracking-wider mb-4">
              {generatedCode}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedCode);
                toast.success('Copied!');
              }}
              className="flex items-center gap-2 mx-auto px-4 py-2 bg-[#500000] text-white rounded-xl"
            >
              <Copy className="w-4 h-4" />
              Copy Code
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Lock Selection */}
            <div>
              <label className="block text-sm font-medium text-[#2D2D2D] mb-1.5">Select Lock</label>
              <select
                value={selectedLockId}
                onChange={(e) => setSelectedLockId(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-[#F5F5F0] border-0 rounded-xl focus:ring-2 focus:ring-[#500000]/20"
              >
                <option value="">Choose a lock...</option>
                {locks.map((l) => (
                  <option key={l.id || l.lock_id} value={l.id || l.lock_id}>
                    {l.property?.name || l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Guest Name */}
            <div>
              <label className="block text-sm font-medium text-[#2D2D2D] mb-1.5">Guest Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                  placeholder="John Smith"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F5F5F0] border-0 rounded-xl focus:ring-2 focus:ring-[#500000]/20"
                />
              </div>
            </div>

            {/* Guest Phone */}
            <div>
              <label className="block text-sm font-medium text-[#2D2D2D] mb-1.5">Guest Phone (optional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F5F5F0] border-0 rounded-xl focus:ring-2 focus:ring-[#500000]/20"
                />
              </div>
            </div>

            {/* Check-in */}
            <div>
              <label className="block text-sm font-medium text-[#2D2D2D] mb-1.5">Check-in</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
                <input
                  type="datetime-local"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F5F5F0] border-0 rounded-xl focus:ring-2 focus:ring-[#500000]/20"
                />
              </div>
            </div>

            {/* Check-out */}
            <div>
              <label className="block text-sm font-medium text-[#2D2D2D] mb-1.5">Check-out</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#2D2D2D]/40" />
                <input
                  type="datetime-local"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F5F5F0] border-0 rounded-xl focus:ring-2 focus:ring-[#500000]/20"
                />
              </div>
            </div>

            {/* Code Length */}
            <div>
              <label className="block text-sm font-medium text-[#2D2D2D] mb-1.5">Code Length</label>
              <div className="flex gap-2">
                {[4, 5, 6, 7, 8].map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setCodeLength(len)}
                    className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
                      codeLength === len
                        ? 'bg-[#500000] text-white'
                        : 'bg-[#F5F5F0] text-[#2D2D2D] hover:bg-[#500000]/10'
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>

            {/* SMS Option */}
            {guestPhone && (
              <label className="flex items-center gap-3 p-3 bg-[#F5F5F0] rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendSms}
                  onChange={(e) => setSendSms(e.target.checked)}
                  className="w-5 h-5 rounded border-[#2D2D2D]/20 text-[#500000] focus:ring-[#500000]/20"
                />
                <div className="flex-1">
                  <div className="font-medium text-[#2D2D2D]">Send SMS to guest</div>
                  <div className="text-xs text-[#2D2D2D]/60">Code and instructions will be texted</div>
                </div>
                <MessageSquare className="w-5 h-5 text-[#500000]" />
              </label>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/20 hover:shadow-xl transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5" />
                  Generate Code
                </span>
              )}
            </button>

            <p className="text-xs text-center text-[#2D2D2D]/50">
              Code will expire 30 minutes after checkout
            </p>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}

// Activity Modal
function ActivityModal({
  lock,
  activities,
  onClose,
}: {
  lock: SmartLock;
  activities: ActivityEntry[];
  onClose: () => void;
}) {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'locked':
        return <Lock className="w-4 h-4 text-emerald-600" />;
      case 'unlocked':
        return <Unlock className="w-4 h-4 text-blue-600" />;
      case 'code_added':
        return <Plus className="w-4 h-4 text-purple-600" />;
      case 'code_removed':
        return <X className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getMethodBadge = (method: string) => {
    const styles: Record<string, string> = {
      code: 'bg-blue-100 text-blue-700',
      app: 'bg-purple-100 text-purple-700',
      manual: 'bg-gray-100 text-gray-700',
      auto: 'bg-emerald-100 text-emerald-700',
    };
    return styles[method] || 'bg-gray-100 text-gray-700';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
      >
        <div className="p-6 border-b border-[#2D2D2D]/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-['Playfair_Display'] font-bold text-[#500000]">
                Activity Log
              </h2>
              <p className="text-sm text-[#2D2D2D]/60">{lock.property?.name || lock.name}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-xl transition-colors">
              <X className="w-5 h-5 text-[#2D2D2D]/60" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {activities.length === 0 ? (
            <div className="p-8 text-center">
              <History className="w-12 h-12 text-[#2D2D2D]/20 mx-auto mb-3" />
              <p className="text-[#2D2D2D]/60">No recent activity</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2D2D2D]/5">
              {activities.map((activity, index) => (
                <div key={index} className="p-4 hover:bg-[#F5F5F0]/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#F5F5F0] flex items-center justify-center flex-shrink-0">
                      {getActionIcon(activity.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[#2D2D2D] capitalize">
                          {activity.action.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getMethodBadge(activity.method)}`}>
                          {activity.method}
                        </span>
                      </div>
                      {(activity.user_name || activity.code_name) && (
                        <p className="text-sm text-[#2D2D2D]/60 mt-0.5">
                          {activity.user_name || activity.code_name}
                        </p>
                      )}
                      <p className="text-xs text-[#2D2D2D]/40 mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#2D2D2D]/20 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
