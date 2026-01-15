import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Unlock,
  Battery,
  Wifi,
  WifiOff,
  Key,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
  Home,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import type { SmartLock, AccessCode } from '@shared/types';

// Mock smart lock data
const mockLocks: SmartLock[] = [
  {
    id: '1',
    propertyId: '1',
    name: 'Front Door',
    manufacturer: 'august',
    model: 'August Wi-Fi Smart Lock',
    status: 'locked',
    batteryLevel: 85,
    lastActivity: new Date().toISOString(),
    accessCodes: [
      {
        id: '1',
        code: '1234',
        name: 'Master Code',
        type: 'permanent',
        usageCount: 42,
        lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        active: true,
      },
      {
        id: '2',
        code: '5678',
        name: 'Guest - John Smith',
        type: 'temporary',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        usageCount: 3,
        lastUsed: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        active: true,
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    propertyId: '2',
    name: 'Main Entrance',
    manufacturer: 'yale',
    model: 'Yale Assure Lock 2',
    status: 'unlocked',
    batteryLevel: 42,
    lastActivity: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    accessCodes: [
      {
        id: '3',
        code: '9876',
        name: 'Master Code',
        type: 'permanent',
        usageCount: 28,
        lastUsed: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        active: true,
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    propertyId: '3',
    name: 'Entry',
    manufacturer: 'schlage',
    model: 'Schlage Encode Plus',
    status: 'offline',
    batteryLevel: 15,
    lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    accessCodes: [],
    createdAt: new Date().toISOString(),
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function SmartLocks() {
  const { properties } = useApp();
  const [locks, setLocks] = useState<SmartLock[]>(mockLocks);
  const [selectedLock, setSelectedLock] = useState<SmartLock | null>(null);
  const [showAddCodeModal, setShowAddCodeModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const toggleLock = async (lockId: string) => {
    const lock = locks.find((l) => l.id === lockId);
    if (!lock || lock.status === 'offline') return;

    // Simulate API call
    const newStatus = lock.status === 'locked' ? 'unlocked' : 'locked';

    setLocks((prev) =>
      prev.map((l) =>
        l.id === lockId
          ? { ...l, status: newStatus, lastActivity: new Date().toISOString() }
          : l
      )
    );

    toast.success(`Lock ${newStatus === 'locked' ? 'locked' : 'unlocked'}`);
  };

  const refreshLocks = async () => {
    setIsRefreshing(true);
    // Simulate API refresh
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsRefreshing(false);
    toast.success('Lock status updated');
  };

  const copyCode = async (code: string) => {
    await window.electronAPI.clipboard.write(code);
    toast.success('Code copied to clipboard');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'locked':
        return <Lock className="w-6 h-6 text-green-500" />;
      case 'unlocked':
        return <Unlock className="w-6 h-6 text-yellow-500" />;
      case 'offline':
        return <WifiOff className="w-6 h-6 text-red-500" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-gray-500" />;
    }
  };

  const getBatteryColor = (level: number) => {
    if (level > 60) return 'text-green-500';
    if (level > 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Smart Lock Control</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage {locks.length} smart locks across your properties
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refreshLocks}
            className="btn-secondary flex items-center gap-2"
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Lock
          </button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Lock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {locks.filter((l) => l.status === 'locked').length}
              </p>
              <p className="text-sm text-gray-500">Locked</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <Unlock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {locks.filter((l) => l.status === 'unlocked').length}
              </p>
              <p className="text-sm text-gray-500">Unlocked</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <WifiOff className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {locks.filter((l) => l.status === 'offline').length}
              </p>
              <p className="text-sm text-gray-500">Offline</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <Battery className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {locks.filter((l) => l.batteryLevel < 30).length}
              </p>
              <p className="text-sm text-gray-500">Low Battery</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lock List */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="lg:col-span-2 space-y-4"
        >
          {locks.map((lock) => {
            const property = properties.find((p) => p.id === lock.propertyId);
            return (
              <motion.div
                key={lock.id}
                variants={item}
                className={`card p-6 cursor-pointer transition-all ${
                  selectedLock?.id === lock.id
                    ? 'ring-2 ring-maroon-900 dark:ring-maroon-400'
                    : ''
                }`}
                onClick={() => setSelectedLock(lock)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div
                      className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        lock.status === 'locked'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : lock.status === 'unlocked'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30'
                          : 'bg-red-100 dark:bg-red-900/30'
                      }`}
                    >
                      {getStatusIcon(lock.status)}
                    </div>

                    {/* Lock Info */}
                    <div>
                      <h3 className="font-display text-lg font-semibold">
                        {lock.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Home className="w-4 h-4" />
                        {property?.name || 'Unknown Property'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {lock.manufacturer} - {lock.model}
                      </p>
                    </div>
                  </div>

                  {/* Right Side */}
                  <div className="flex items-center gap-6">
                    {/* Battery */}
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <Battery
                          className={`w-5 h-5 ${getBatteryColor(lock.batteryLevel)}`}
                        />
                        <span
                          className={`font-medium ${getBatteryColor(
                            lock.batteryLevel
                          )}`}
                        >
                          {lock.batteryLevel}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">Battery</p>
                    </div>

                    {/* Access Codes */}
                    <div className="text-center">
                      <p className="flex items-center gap-1 font-medium">
                        <Key className="w-4 h-4 text-gray-400" />
                        {lock.accessCodes.length}
                      </p>
                      <p className="text-xs text-gray-400">Codes</p>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLock(lock.id);
                      }}
                      disabled={lock.status === 'offline'}
                      className={`px-6 py-3 rounded-xl font-medium transition-all ${
                        lock.status === 'locked'
                          ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                          : lock.status === 'unlocked'
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {lock.status === 'locked'
                        ? 'Unlock'
                        : lock.status === 'unlocked'
                        ? 'Lock'
                        : 'Offline'}
                    </button>
                  </div>
                </div>

                {/* Last Activity */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Last activity:{' '}
                    {formatDistanceToNow(new Date(lock.lastActivity), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Lock Detail Panel */}
        <div className="card p-6">
          {selectedLock ? (
            <LockDetailPanel
              lock={selectedLock}
              property={properties.find((p) => p.id === selectedLock.propertyId)}
              onCopyCode={copyCode}
              onAddCode={() => setShowAddCodeModal(true)}
            />
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Lock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Select a lock to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Access Code Modal */}
      <AnimatePresence>
        {showAddCodeModal && selectedLock && (
          <AddCodeModal
            lock={selectedLock}
            onClose={() => setShowAddCodeModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LockDetailPanel({
  lock,
  property,
  onCopyCode,
  onAddCode,
}: {
  lock: SmartLock;
  property?: any;
  onCopyCode: (code: string) => void;
  onAddCode: () => void;
}) {
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});

  const toggleCodeVisibility = (codeId: string) => {
    setShowCodes((prev) => ({ ...prev, [codeId]: !prev[codeId] }));
  };

  return (
    <div>
      {/* Lock Header */}
      <div className="text-center mb-6">
        <div
          className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
            lock.status === 'locked'
              ? 'bg-green-100 dark:bg-green-900/30'
              : lock.status === 'unlocked'
              ? 'bg-yellow-100 dark:bg-yellow-900/30'
              : 'bg-red-100 dark:bg-red-900/30'
          }`}
        >
          {lock.status === 'locked' ? (
            <Lock className="w-10 h-10 text-green-600" />
          ) : lock.status === 'unlocked' ? (
            <Unlock className="w-10 h-10 text-yellow-600" />
          ) : (
            <WifiOff className="w-10 h-10 text-red-600" />
          )}
        </div>
        <h3 className="text-xl font-display font-semibold">{lock.name}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {property?.name}
        </p>
        <span
          className={`inline-block mt-2 badge ${
            lock.status === 'locked'
              ? 'badge-success'
              : lock.status === 'unlocked'
              ? 'badge-warning'
              : 'badge-error'
          }`}
        >
          {lock.status.charAt(0).toUpperCase() + lock.status.slice(1)}
        </span>
      </div>

      {/* Lock Info */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
          <Battery
            className={`w-5 h-5 mx-auto mb-1 ${
              lock.batteryLevel > 60
                ? 'text-green-500'
                : lock.batteryLevel > 30
                ? 'text-yellow-500'
                : 'text-red-500'
            }`}
          />
          <p className="font-semibold">{lock.batteryLevel}%</p>
          <p className="text-xs text-gray-500">Battery</p>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
          <Wifi
            className={`w-5 h-5 mx-auto mb-1 ${
              lock.status !== 'offline' ? 'text-green-500' : 'text-red-500'
            }`}
          />
          <p className="font-semibold">
            {lock.status !== 'offline' ? 'Online' : 'Offline'}
          </p>
          <p className="text-xs text-gray-500">Connection</p>
        </div>
      </div>

      {/* Access Codes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Key className="w-5 h-5" />
            Access Codes
          </h4>
          <button
            onClick={onAddCode}
            className="text-sm text-maroon-900 dark:text-maroon-400 font-medium flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        <div className="space-y-2">
          {lock.accessCodes.length > 0 ? (
            lock.accessCodes.map((code) => (
              <div
                key={code.id}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{code.name}</span>
                  <span
                    className={`badge ${
                      code.type === 'permanent'
                        ? 'badge-maroon'
                        : code.type === 'temporary'
                        ? 'badge-info'
                        : 'badge-warning'
                    }`}
                  >
                    {code.type}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-lg tracking-widest">
                    {showCodes[code.id] ? code.code : '****'}
                  </div>
                  <button
                    onClick={() => toggleCodeVisibility(code.id)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    {showCodes[code.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => onCopyCode(code.code)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {code.lastUsed && (
                  <p className="text-xs text-gray-400 mt-2">
                    Last used:{' '}
                    {formatDistanceToNow(new Date(code.lastUsed), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No access codes configured
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AddCodeModal({
  lock,
  onClose,
}: {
  lock: SmartLock;
  onClose: () => void;
}) {
  const [codeType, setCodeType] = useState<'permanent' | 'temporary' | 'one_time'>(
    'temporary'
  );

  const generateCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-display font-semibold mb-6">
          Add Access Code
        </h2>

        <form className="space-y-4">
          <div>
            <label className="label">Code Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Guest - John Smith"
            />
          </div>

          <div>
            <label className="label">Access Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input font-mono text-lg tracking-widest"
                placeholder="1234"
                maxLength={6}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector(
                    'input[maxLength="6"]'
                  ) as HTMLInputElement;
                  if (input) input.value = generateCode();
                }}
                className="btn-secondary px-4"
              >
                Generate
              </button>
            </div>
          </div>

          <div>
            <label className="label">Code Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['permanent', 'temporary', 'one_time'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCodeType(type)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    codeType === type
                      ? 'bg-maroon-900 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type.replace('_', ' ').charAt(0).toUpperCase() +
                    type.replace('_', ' ').slice(1)}
                </button>
              ))}
            </div>
          </div>

          {codeType === 'temporary' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="datetime-local"
                  className="input"
                  defaultValue={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="datetime-local"
                  className="input"
                  defaultValue={format(
                    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                    "yyyy-MM-dd'T'HH:mm"
                  )}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              Create Code
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
