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
  Thermometer,
  Flame,
  Snowflake,
  Wind,
  Power,
  Sun,
  Moon,
  ChevronUp,
  ChevronDown,
  Calendar,
  Zap,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import type { SmartLock, AccessCode } from '@shared/types';

// Thermostat types
interface Thermostat {
  id: string;
  propertyId: string;
  name: string;
  manufacturer: 'nest' | 'ecobee' | 'honeywell' | 'carrier';
  model: string;
  currentTemp: number;
  targetTemp: number;
  humidity: number;
  mode: 'heat' | 'cool' | 'auto' | 'off';
  fanMode: 'auto' | 'on';
  status: 'online' | 'offline' | 'heating' | 'cooling' | 'idle';
  schedule: {
    enabled: boolean;
    home: number;
    away: number;
    sleep: number;
  };
  energySaving: boolean;
  lastUpdated: string;
}

// Mock thermostat data
const mockThermostats: Thermostat[] = [
  {
    id: 't1',
    propertyId: '1',
    name: 'Main Floor',
    manufacturer: 'nest',
    model: 'Nest Learning Thermostat (3rd gen)',
    currentTemp: 72,
    targetTemp: 70,
    humidity: 45,
    mode: 'cool',
    fanMode: 'auto',
    status: 'cooling',
    schedule: { enabled: true, home: 72, away: 78, sleep: 68 },
    energySaving: true,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 't2',
    propertyId: '2',
    name: 'Living Area',
    manufacturer: 'ecobee',
    model: 'ecobee SmartThermostat Premium',
    currentTemp: 74,
    targetTemp: 72,
    humidity: 52,
    mode: 'cool',
    fanMode: 'auto',
    status: 'cooling',
    schedule: { enabled: true, home: 72, away: 80, sleep: 70 },
    energySaving: true,
    lastUpdated: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 't3',
    propertyId: '3',
    name: 'Whole House',
    manufacturer: 'honeywell',
    model: 'Honeywell Home T9',
    currentTemp: 68,
    targetTemp: 70,
    humidity: 38,
    mode: 'heat',
    fanMode: 'on',
    status: 'heating',
    schedule: { enabled: false, home: 70, away: 62, sleep: 66 },
    energySaving: false,
    lastUpdated: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 't4',
    propertyId: '4',
    name: 'Downstairs',
    manufacturer: 'nest',
    model: 'Nest Thermostat E',
    currentTemp: 71,
    targetTemp: 71,
    humidity: 48,
    mode: 'auto',
    fanMode: 'auto',
    status: 'idle',
    schedule: { enabled: true, home: 71, away: 76, sleep: 68 },
    energySaving: true,
    lastUpdated: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: 't5',
    propertyId: '5',
    name: 'Climate Control',
    manufacturer: 'carrier',
    model: 'Carrier Infinity System',
    currentTemp: 73,
    targetTemp: 72,
    humidity: 50,
    mode: 'cool',
    fanMode: 'auto',
    status: 'offline',
    schedule: { enabled: true, home: 72, away: 78, sleep: 70 },
    energySaving: true,
    lastUpdated: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

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

type TabType = 'locks' | 'thermostats';

export default function SmartLocks() {
  const { properties } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('locks');
  const [locks, setLocks] = useState<SmartLock[]>(mockLocks);
  const [thermostats, setThermostats] = useState<Thermostat[]>(mockThermostats);
  const [selectedLock, setSelectedLock] = useState<SmartLock | null>(null);
  const [selectedThermostat, setSelectedThermostat] = useState<Thermostat | null>(null);
  const [showAddCodeModal, setShowAddCodeModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const adjustTemperature = (thermostatId: string, delta: number) => {
    setThermostats((prev) =>
      prev.map((t) =>
        t.id === thermostatId
          ? { ...t, targetTemp: Math.max(60, Math.min(85, t.targetTemp + delta)), lastUpdated: new Date().toISOString() }
          : t
      )
    );
    if (selectedThermostat?.id === thermostatId) {
      setSelectedThermostat((prev) =>
        prev ? { ...prev, targetTemp: Math.max(60, Math.min(85, prev.targetTemp + delta)), lastUpdated: new Date().toISOString() } : null
      );
    }
    toast.success(`Temperature ${delta > 0 ? 'increased' : 'decreased'}`);
  };

  const setThermostatMode = (thermostatId: string, mode: Thermostat['mode']) => {
    setThermostats((prev) =>
      prev.map((t) =>
        t.id === thermostatId
          ? {
              ...t,
              mode,
              status: mode === 'off' ? 'idle' : t.status === 'offline' ? 'offline' : 'idle',
              lastUpdated: new Date().toISOString(),
            }
          : t
      )
    );
    if (selectedThermostat?.id === thermostatId) {
      setSelectedThermostat((prev) =>
        prev
          ? {
              ...prev,
              mode,
              status: mode === 'off' ? 'idle' : prev.status === 'offline' ? 'offline' : 'idle',
              lastUpdated: new Date().toISOString(),
            }
          : null
      );
    }
    toast.success(`Mode set to ${mode}`);
  };

  const toggleFanMode = (thermostatId: string) => {
    setThermostats((prev) =>
      prev.map((t) =>
        t.id === thermostatId
          ? { ...t, fanMode: t.fanMode === 'auto' ? 'on' : 'auto', lastUpdated: new Date().toISOString() }
          : t
      )
    );
    toast.success('Fan mode updated');
  };

  const toggleSchedule = (thermostatId: string) => {
    setThermostats((prev) =>
      prev.map((t) =>
        t.id === thermostatId
          ? { ...t, schedule: { ...t.schedule, enabled: !t.schedule.enabled }, lastUpdated: new Date().toISOString() }
          : t
      )
    );
    toast.success('Schedule updated');
  };

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
          <h1 className="text-2xl font-display font-bold">Smart Home Control</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage locks and climate across your properties
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
            {activeTab === 'locks' ? 'Add Lock' : 'Add Thermostat'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('locks')}
          className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'locks'
              ? 'border-maroon-900 text-maroon-900 dark:border-maroon-400 dark:text-maroon-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Lock className="w-5 h-5" />
          Smart Locks ({locks.length})
        </button>
        <button
          onClick={() => setActiveTab('thermostats')}
          className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'thermostats'
              ? 'border-maroon-900 text-maroon-900 dark:border-maroon-400 dark:text-maroon-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Thermometer className="w-5 h-5" />
          Thermostats ({thermostats.length})
        </button>
      </div>

      {activeTab === 'locks' ? (
        <>
          {/* Lock Status Overview */}
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
        </>
      ) : (
        <>
          {/* Thermostat Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Snowflake className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {thermostats.filter((t) => t.status === 'cooling').length}
                  </p>
                  <p className="text-sm text-gray-500">Cooling</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {thermostats.filter((t) => t.status === 'heating').length}
                  </p>
                  <p className="text-sm text-gray-500">Heating</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {thermostats.filter((t) => t.status === 'idle').length}
                  </p>
                  <p className="text-sm text-gray-500">Idle</p>
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
                    {thermostats.filter((t) => t.status === 'offline').length}
                  </p>
                  <p className="text-sm text-gray-500">Offline</p>
                </div>
              </div>
            </div>
          </div>

          {/* Thermostat Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="lg:col-span-2 space-y-4"
            >
              {thermostats.map((thermostat) => {
                const property = properties.find((p) => p.id === thermostat.propertyId);
                return (
                  <motion.div
                    key={thermostat.id}
                    variants={item}
                    className={`card p-6 cursor-pointer transition-all ${
                      selectedThermostat?.id === thermostat.id
                        ? 'ring-2 ring-maroon-900 dark:ring-maroon-400'
                        : ''
                    }`}
                    onClick={() => setSelectedThermostat(thermostat)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Status Icon */}
                        <div
                          className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                            thermostat.status === 'cooling'
                              ? 'bg-blue-100 dark:bg-blue-900/30'
                              : thermostat.status === 'heating'
                              ? 'bg-orange-100 dark:bg-orange-900/30'
                              : thermostat.status === 'offline'
                              ? 'bg-red-100 dark:bg-red-900/30'
                              : 'bg-green-100 dark:bg-green-900/30'
                          }`}
                        >
                          {thermostat.status === 'cooling' ? (
                            <Snowflake className="w-6 h-6 text-blue-600" />
                          ) : thermostat.status === 'heating' ? (
                            <Flame className="w-6 h-6 text-orange-600" />
                          ) : thermostat.status === 'offline' ? (
                            <WifiOff className="w-6 h-6 text-red-600" />
                          ) : (
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                          )}
                        </div>

                        {/* Thermostat Info */}
                        <div>
                          <h3 className="font-display text-lg font-semibold">
                            {thermostat.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Home className="w-4 h-4" />
                            {property?.name || 'Unknown Property'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {thermostat.manufacturer.charAt(0).toUpperCase() + thermostat.manufacturer.slice(1)} - {thermostat.model}
                          </p>
                        </div>
                      </div>

                      {/* Right Side - Temperature */}
                      <div className="flex items-center gap-6">
                        {/* Current Temp */}
                        <div className="text-center">
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {thermostat.currentTemp}°
                          </p>
                          <p className="text-xs text-gray-400">Current</p>
                        </div>

                        {/* Target Temp */}
                        <div className="text-center">
                          <p className={`text-2xl font-semibold ${
                            thermostat.mode === 'cool' ? 'text-blue-500' :
                            thermostat.mode === 'heat' ? 'text-orange-500' :
                            thermostat.mode === 'auto' ? 'text-green-500' :
                            'text-gray-400'
                          }`}>
                            {thermostat.targetTemp}°
                          </p>
                          <p className="text-xs text-gray-400">Target</p>
                        </div>

                        {/* Humidity */}
                        <div className="text-center">
                          <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
                            {thermostat.humidity}%
                          </p>
                          <p className="text-xs text-gray-400">Humidity</p>
                        </div>

                        {/* Temperature Controls */}
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustTemperature(thermostat.id, 1);
                            }}
                            disabled={thermostat.status === 'offline' || thermostat.mode === 'off'}
                            className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustTemperature(thermostat.id, -1);
                            }}
                            disabled={thermostat.status === 'offline' || thermostat.mode === 'off'}
                            className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mode & Last Updated */}
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${
                          thermostat.mode === 'cool' ? 'badge-info' :
                          thermostat.mode === 'heat' ? 'badge-warning' :
                          thermostat.mode === 'auto' ? 'badge-success' :
                          'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                        }`}>
                          {thermostat.mode === 'cool' && <Snowflake className="w-3 h-3 mr-1" />}
                          {thermostat.mode === 'heat' && <Flame className="w-3 h-3 mr-1" />}
                          {thermostat.mode === 'auto' && <Zap className="w-3 h-3 mr-1" />}
                          {thermostat.mode === 'off' && <Power className="w-3 h-3 mr-1" />}
                          {thermostat.mode.charAt(0).toUpperCase() + thermostat.mode.slice(1)}
                        </span>
                        <span className={`badge ${thermostat.fanMode === 'on' ? 'badge-maroon' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                          <Wind className="w-3 h-3 mr-1" />
                          Fan {thermostat.fanMode}
                        </span>
                        {thermostat.schedule.enabled && (
                          <span className="badge badge-success">
                            <Calendar className="w-3 h-3 mr-1" />
                            Scheduled
                          </span>
                        )}
                        {thermostat.energySaving && (
                          <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            <Zap className="w-3 h-3 mr-1" />
                            Eco
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Updated:{' '}
                        {formatDistanceToNow(new Date(thermostat.lastUpdated), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Thermostat Detail Panel */}
            <div className="card p-6">
              {selectedThermostat ? (
                <ThermostatDetailPanel
                  thermostat={selectedThermostat}
                  property={properties.find((p) => p.id === selectedThermostat.propertyId)}
                  onAdjustTemp={(delta) => adjustTemperature(selectedThermostat.id, delta)}
                  onSetMode={(mode) => setThermostatMode(selectedThermostat.id, mode)}
                  onToggleFan={() => toggleFanMode(selectedThermostat.id)}
                  onToggleSchedule={() => toggleSchedule(selectedThermostat.id)}
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Thermometer className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a thermostat to view details</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
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

function ThermostatDetailPanel({
  thermostat,
  property,
  onAdjustTemp,
  onSetMode,
  onToggleFan,
  onToggleSchedule,
}: {
  thermostat: Thermostat;
  property?: any;
  onAdjustTemp: (delta: number) => void;
  onSetMode: (mode: Thermostat['mode']) => void;
  onToggleFan: () => void;
  onToggleSchedule: () => void;
}) {
  const getModeIcon = (mode: Thermostat['mode']) => {
    switch (mode) {
      case 'cool':
        return <Snowflake className="w-5 h-5" />;
      case 'heat':
        return <Flame className="w-5 h-5" />;
      case 'auto':
        return <Zap className="w-5 h-5" />;
      case 'off':
        return <Power className="w-5 h-5" />;
    }
  };

  return (
    <div>
      {/* Thermostat Header */}
      <div className="text-center mb-6">
        <div
          className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 relative ${
            thermostat.status === 'cooling'
              ? 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50'
              : thermostat.status === 'heating'
              ? 'bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/50 dark:to-orange-800/50'
              : thermostat.status === 'offline'
              ? 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600'
              : 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/50 dark:to-green-800/50'
          }`}
        >
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {thermostat.currentTemp}°
          </span>
          {thermostat.status === 'cooling' && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-1 -right-1"
            >
              <Snowflake className="w-6 h-6 text-blue-500" />
            </motion.div>
          )}
          {thermostat.status === 'heating' && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-1 -right-1"
            >
              <Flame className="w-6 h-6 text-orange-500" />
            </motion.div>
          )}
        </div>
        <h3 className="text-xl font-display font-semibold">{thermostat.name}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {property?.name}
        </p>
        <span
          className={`inline-block mt-2 badge ${
            thermostat.status === 'cooling'
              ? 'badge-info'
              : thermostat.status === 'heating'
              ? 'badge-warning'
              : thermostat.status === 'offline'
              ? 'badge-error'
              : 'badge-success'
          }`}
        >
          {thermostat.status.charAt(0).toUpperCase() + thermostat.status.slice(1)}
        </span>
      </div>

      {/* Temperature Control */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">
          Target Temperature
        </label>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => onAdjustTemp(-1)}
            disabled={thermostat.status === 'offline' || thermostat.mode === 'off'}
            className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
          <div className="text-center">
            <span className={`text-4xl font-bold ${
              thermostat.mode === 'cool' ? 'text-blue-500' :
              thermostat.mode === 'heat' ? 'text-orange-500' :
              thermostat.mode === 'auto' ? 'text-green-500' :
              'text-gray-400'
            }`}>
              {thermostat.targetTemp}°F
            </span>
          </div>
          <button
            onClick={() => onAdjustTemp(1)}
            disabled={thermostat.status === 'offline' || thermostat.mode === 'off'}
            className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronUp className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
          <Thermometer className="w-5 h-5 mx-auto mb-1 text-gray-500" />
          <p className="font-semibold">{thermostat.currentTemp}°F</p>
          <p className="text-xs text-gray-500">Current</p>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
          <Wind className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <p className="font-semibold">{thermostat.humidity}%</p>
          <p className="text-xs text-gray-500">Humidity</p>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">
          Mode
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(['cool', 'heat', 'auto', 'off'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onSetMode(mode)}
              disabled={thermostat.status === 'offline'}
              className={`py-3 px-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                thermostat.mode === mode
                  ? mode === 'cool'
                    ? 'bg-blue-500 text-white'
                    : mode === 'heat'
                    ? 'bg-orange-500 text-white'
                    : mode === 'auto'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {getModeIcon(mode)}
              <span className="text-xs font-medium capitalize">{mode}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Fan Control */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">
          Fan
        </label>
        <button
          onClick={onToggleFan}
          disabled={thermostat.status === 'offline'}
          className={`w-full py-3 px-4 rounded-xl flex items-center justify-between transition-all ${
            thermostat.fanMode === 'on'
              ? 'bg-maroon-900 text-white'
              : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <div className="flex items-center gap-2">
            <Wind className="w-5 h-5" />
            <span className="font-medium">Fan Mode</span>
          </div>
          <span className="text-sm">{thermostat.fanMode === 'on' ? 'Always On' : 'Auto'}</span>
        </button>
      </div>

      {/* Schedule */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Schedule
          </label>
          <button
            onClick={onToggleSchedule}
            disabled={thermostat.status === 'offline'}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              thermostat.schedule.enabled ? 'bg-maroon-900' : 'bg-gray-300 dark:bg-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                thermostat.schedule.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {thermostat.schedule.enabled && (
          <div className="space-y-2 mt-3">
            <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">Home</span>
              </div>
              <span className="font-medium">{thermostat.schedule.home}°F</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Away</span>
              </div>
              <span className="font-medium">{thermostat.schedule.away}°F</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-500" />
                <span className="text-sm">Sleep</span>
              </div>
              <span className="font-medium">{thermostat.schedule.sleep}°F</span>
            </div>
          </div>
        )}
      </div>

      {/* Energy Saving */}
      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
        <div className="flex items-center gap-2">
          <Zap className={`w-5 h-5 ${thermostat.energySaving ? 'text-green-500' : 'text-gray-400'}`} />
          <div>
            <p className="font-medium text-sm">Energy Saving</p>
            <p className="text-xs text-gray-500">
              {thermostat.energySaving ? 'Active - Optimizing energy usage' : 'Disabled'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
