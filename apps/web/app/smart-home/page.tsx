'use client';

/**
 * Right at Home BnB - Smart Home Automation Center
 * Complete Smart Home Control: Locks, Thermostats, Cameras, Lights, Sensors
 * @author ECHO OMEGA PRIME
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import {
  Lock, Key, Thermometer, Users, Clock, Bell, Plus,
  Trash2, Eye, EyeOff, Copy, RefreshCw, Home, User,
  Wrench, Sparkles, Shield, History, ChevronRight,
  CheckCircle, AlertTriangle, ThermometerSun, Snowflake,
  Flame, Wind, Calendar, Send, X, Edit2, Camera, Video,
  Lightbulb, Sun, Moon, Power, Wifi, WifiOff, Battery,
  BatteryLow, BatteryWarning, Droplets, CloudRain, Zap,
  Activity, Play, Pause, Volume2, VolumeX, ChevronDown,
  ChevronUp, Settings, MoreVertical, MapPin, Signal,
  Film, Image, Download, Maximize2, Grid3X3, List,
  Search, Filter, SlidersHorizontal, LayoutGrid, Timer
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type TabView = 'overview' | 'codes' | 'thermostat' | 'cameras' | 'lights' | 'sensors' | 'logs' | 'scenes';

interface LockCode {
  id: string;
  propertyId: string;
  propertyName: string;
  code: string;
  type: 'guest' | 'cleaner' | 'maintenance' | 'owner' | 'emergency';
  name: string;
  createdAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  usageCount: number;
  lastUsed?: Date;
  guestName?: string;
  bookingId?: string;
}

interface EntryLog {
  id: string;
  propertyId: string;
  propertyName: string;
  codeName: string;
  codeType: string;
  timestamp: Date;
  action: 'unlock' | 'lock';
  notified: boolean;
}

interface SmartDevice {
  id: string;
  propertyId: string;
  propertyName: string;
  name: string;
  type: 'lock' | 'thermostat' | 'camera' | 'light' | 'sensor' | 'speaker';
  brand: string;
  model: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  battery?: number;
  lastActivity: Date;
  features: string[];
}

interface ThermostatDevice extends SmartDevice {
  type: 'thermostat';
  currentTemp: number;
  targetTemp: number;
  humidity: number;
  mode: 'heat' | 'cool' | 'auto' | 'off' | 'eco';
  fanMode: 'auto' | 'on' | 'circulate';
  schedule: ThermostatSchedule[];
}

interface ThermostatSchedule {
  id: string;
  name: string;
  time: string;
  temp: number;
  days: number[];
  isActive: boolean;
}

interface CameraDevice extends SmartDevice {
  type: 'camera';
  isRecording: boolean;
  hasMotion: boolean;
  lastMotion?: Date;
  streamUrl: string;
  thumbnailUrl: string;
  nightVision: boolean;
  resolution: '720p' | '1080p' | '4K';
  storage: { used: number; total: number };
}

interface LightDevice extends SmartDevice {
  type: 'light';
  isOn: boolean;
  brightness: number;
  color?: string;
  colorTemp?: number;
  supportsColor: boolean;
  supportsDimming: boolean;
}

interface SensorDevice extends SmartDevice {
  type: 'sensor';
  sensorType: 'motion' | 'door' | 'water' | 'smoke' | 'co' | 'temperature' | 'humidity';
  triggered: boolean;
  lastTriggered?: Date;
  value?: number;
  unit?: string;
}

interface Scene {
  id: string;
  name: string;
  icon: string;
  description: string;
  devices: { deviceId: string; action: string; value?: any }[];
  isActive: boolean;
  triggerType: 'manual' | 'schedule' | 'event';
  schedule?: { time: string; days: number[] };
}

// ============================================================================
// MOCK DATA
// ============================================================================

const PROPERTIES = [
  { id: 'prop-1', name: 'Sunset Villa' },
  { id: 'prop-2', name: 'Oak Street Cottage' },
  { id: 'prop-3', name: 'Desert Rose' },
  { id: 'prop-4', name: 'Permian Suite' },
  { id: 'prop-5', name: 'Downtown Loft' },
  { id: 'prop-6', name: 'Garden View' },
];

const CODE_TYPE_CONFIG = {
  guest: { label: 'Guest', icon: User, color: 'bg-blue-500', textColor: 'text-blue-600', bgLight: 'bg-blue-50' },
  cleaner: { label: 'Cleaner', icon: Sparkles, color: 'bg-purple-500', textColor: 'text-purple-600', bgLight: 'bg-purple-50' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: 'bg-amber-500', textColor: 'text-amber-600', bgLight: 'bg-amber-50' },
  owner: { label: 'Owner', icon: Shield, color: 'bg-emerald-500', textColor: 'text-emerald-600', bgLight: 'bg-emerald-50' },
  emergency: { label: 'Emergency', icon: AlertTriangle, color: 'bg-red-500', textColor: 'text-red-600', bgLight: 'bg-red-50' },
};

const MOCK_CODES: LockCode[] = [
  {
    id: 'code-1', propertyId: 'ALL', propertyName: 'All Properties', code: '159753', type: 'owner',
    name: 'Steven Palma', createdAt: new Date('2024-01-01'), expiresAt: null, isActive: true, usageCount: 47,
    lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'code-2', propertyId: 'ALL', propertyName: 'All Properties', code: '246810', type: 'cleaner',
    name: 'Maria Rodriguez', createdAt: new Date('2024-06-15'), expiresAt: null, isActive: true, usageCount: 312,
    lastUsed: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    id: 'code-3', propertyId: 'ALL', propertyName: 'All Properties', code: '135792', type: 'cleaner',
    name: 'Ana Garcia', createdAt: new Date('2024-08-20'), expiresAt: null, isActive: true, usageCount: 156,
    lastUsed: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
  {
    id: 'code-4', propertyId: 'ALL', propertyName: 'All Properties', code: '864209', type: 'maintenance',
    name: 'Carlos Martinez', createdAt: new Date('2024-03-10'), expiresAt: null, isActive: true, usageCount: 89,
    lastUsed: new Date(Date.now() - 48 * 60 * 60 * 1000),
  },
  {
    id: 'code-5', propertyId: 'ALL', propertyName: 'All Properties', code: '911911', type: 'emergency',
    name: 'Emergency Access', createdAt: new Date('2024-01-01'), expiresAt: null, isActive: true, usageCount: 0,
  },
  {
    id: 'code-6', propertyId: 'prop-1', propertyName: 'Sunset Villa', code: '482736', type: 'guest',
    name: 'Thompson Family', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), isActive: true, usageCount: 4,
    lastUsed: new Date(Date.now() - 8 * 60 * 60 * 1000), guestName: 'John Thompson', bookingId: 'BK-2024-001',
  },
];

const MOCK_LOGS: EntryLog[] = [
  { id: 'log-1', propertyId: 'prop-1', propertyName: 'Sunset Villa', codeName: 'Thompson Family', codeType: 'guest', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), action: 'unlock', notified: true },
  { id: 'log-2', propertyId: 'prop-3', propertyName: 'Desert Rose', codeName: 'Maria Rodriguez', codeType: 'cleaner', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), action: 'unlock', notified: true },
  { id: 'log-3', propertyId: 'prop-3', propertyName: 'Desert Rose', codeName: 'Maria Rodriguez', codeType: 'cleaner', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), action: 'lock', notified: true },
  { id: 'log-4', propertyId: 'prop-2', propertyName: 'Oak Street Cottage', codeName: 'Steven Palma', codeType: 'owner', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), action: 'unlock', notified: false },
  { id: 'log-5', propertyId: 'prop-4', propertyName: 'Permian Suite', codeName: 'Ana Garcia', codeType: 'cleaner', timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), action: 'unlock', notified: true },
];

const MOCK_THERMOSTATS: ThermostatDevice[] = PROPERTIES.map((prop, idx) => ({
  id: `thermo-${prop.id}`,
  propertyId: prop.id,
  propertyName: prop.name,
  name: 'Nest Thermostat',
  type: 'thermostat' as const,
  brand: 'Google Nest',
  model: 'Learning Thermostat 3rd Gen',
  status: idx === 2 ? 'warning' : 'online',
  lastActivity: new Date(Date.now() - Math.random() * 60 * 60 * 1000),
  features: ['learning', 'scheduling', 'remote', 'eco'],
  currentTemp: 68 + Math.floor(Math.random() * 8),
  targetTemp: 72,
  humidity: 35 + Math.floor(Math.random() * 20),
  mode: ['heat', 'cool', 'auto'][Math.floor(Math.random() * 3)] as any,
  fanMode: 'auto',
  schedule: [
    { id: 'sch-1', name: 'Morning', time: '07:00', temp: 72, days: [1,2,3,4,5], isActive: true },
    { id: 'sch-2', name: 'Night', time: '22:00', temp: 68, days: [0,1,2,3,4,5,6], isActive: true },
  ],
}));

const MOCK_CAMERAS: CameraDevice[] = [
  {
    id: 'cam-1', propertyId: 'prop-1', propertyName: 'Sunset Villa', name: 'Front Door Camera',
    type: 'camera', brand: 'Ring', model: 'Video Doorbell Pro 2', status: 'online',
    lastActivity: new Date(Date.now() - 5 * 60 * 1000), features: ['motion', 'two-way-audio', 'night-vision'],
    isRecording: true, hasMotion: false, streamUrl: '', thumbnailUrl: '/api/placeholder/320/180',
    nightVision: false, resolution: '1080p', storage: { used: 45, total: 100 },
  },
  {
    id: 'cam-2', propertyId: 'prop-1', propertyName: 'Sunset Villa', name: 'Backyard Camera',
    type: 'camera', brand: 'Ring', model: 'Spotlight Cam Pro', status: 'online',
    lastActivity: new Date(Date.now() - 15 * 60 * 1000), features: ['motion', 'spotlight', 'siren'],
    isRecording: true, hasMotion: false, streamUrl: '', thumbnailUrl: '/api/placeholder/320/180',
    nightVision: true, resolution: '1080p', storage: { used: 62, total: 100 },
  },
  {
    id: 'cam-3', propertyId: 'prop-2', propertyName: 'Oak Street Cottage', name: 'Front Porch',
    type: 'camera', brand: 'Nest', model: 'Doorbell (Wired)', status: 'online',
    lastActivity: new Date(Date.now() - 2 * 60 * 1000), features: ['motion', 'package-detection'],
    isRecording: true, hasMotion: true, lastMotion: new Date(Date.now() - 2 * 60 * 1000),
    streamUrl: '', thumbnailUrl: '/api/placeholder/320/180', nightVision: true, resolution: '1080p',
    storage: { used: 78, total: 100 },
  },
  {
    id: 'cam-4', propertyId: 'prop-3', propertyName: 'Desert Rose', name: 'Driveway Cam',
    type: 'camera', brand: 'Wyze', model: 'Cam v3 Pro', status: 'offline',
    lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000), features: ['motion', 'color-night'],
    isRecording: false, hasMotion: false, streamUrl: '', thumbnailUrl: '/api/placeholder/320/180',
    nightVision: true, resolution: '1080p', storage: { used: 0, total: 32 },
  },
];

const MOCK_LIGHTS: LightDevice[] = [
  { id: 'light-1', propertyId: 'prop-1', propertyName: 'Sunset Villa', name: 'Living Room', type: 'light', brand: 'Philips Hue', model: 'A19 Color', status: 'online', lastActivity: new Date(), features: ['color', 'dimming'], isOn: true, brightness: 80, color: '#FFE4C4', supportsColor: true, supportsDimming: true },
  { id: 'light-2', propertyId: 'prop-1', propertyName: 'Sunset Villa', name: 'Porch Light', type: 'light', brand: 'Philips Hue', model: 'White Outdoor', status: 'online', lastActivity: new Date(), features: ['dimming', 'scheduling'], isOn: false, brightness: 0, supportsColor: false, supportsDimming: true },
  { id: 'light-3', propertyId: 'prop-2', propertyName: 'Oak Street Cottage', name: 'Kitchen', type: 'light', brand: 'LIFX', model: 'A60 Color', status: 'online', lastActivity: new Date(), features: ['color', 'dimming'], isOn: true, brightness: 100, color: '#FFFFFF', supportsColor: true, supportsDimming: true },
  { id: 'light-4', propertyId: 'prop-3', propertyName: 'Desert Rose', name: 'Bedroom', type: 'light', brand: 'Wyze', model: 'Bulb Color', status: 'online', battery: 100, lastActivity: new Date(), features: ['color', 'dimming'], isOn: false, brightness: 0, supportsColor: true, supportsDimming: true },
];

const MOCK_SENSORS: SensorDevice[] = [
  { id: 'sensor-1', propertyId: 'prop-1', propertyName: 'Sunset Villa', name: 'Front Door', type: 'sensor', sensorType: 'door', brand: 'Ring', model: 'Alarm Contact Sensor', status: 'online', battery: 85, lastActivity: new Date(), features: ['tamper-detection'], triggered: false },
  { id: 'sensor-2', propertyId: 'prop-1', propertyName: 'Sunset Villa', name: 'Kitchen Water', type: 'sensor', sensorType: 'water', brand: 'Honeywell', model: 'Lyric Wi-Fi', status: 'online', battery: 72, lastActivity: new Date(), features: ['temp-humidity'], triggered: false },
  { id: 'sensor-3', propertyId: 'prop-1', propertyName: 'Sunset Villa', name: 'Smoke Detector', type: 'sensor', sensorType: 'smoke', brand: 'Nest', model: 'Protect 2nd Gen', status: 'online', lastActivity: new Date(), features: ['co-detection', 'voice-alerts'], triggered: false },
  { id: 'sensor-4', propertyId: 'prop-2', propertyName: 'Oak Street Cottage', name: 'Motion - Hallway', type: 'sensor', sensorType: 'motion', brand: 'Ring', model: 'Motion Detector', status: 'online', battery: 45, lastActivity: new Date(), features: ['pet-immune'], triggered: true, lastTriggered: new Date(Date.now() - 10 * 60 * 1000) },
  { id: 'sensor-5', propertyId: 'prop-3', propertyName: 'Desert Rose', name: 'Water Heater', type: 'sensor', sensorType: 'water', brand: 'Flo', model: 'Smart Water Monitor', status: 'warning', lastActivity: new Date(), features: ['auto-shutoff'], triggered: false, value: 2.3, unit: 'gpm' },
];

const MOCK_SCENES: Scene[] = [
  { id: 'scene-1', name: 'Guest Welcome', icon: '🏠', description: 'Prepare property for guest arrival', devices: [], isActive: false, triggerType: 'event' },
  { id: 'scene-2', name: 'Away Mode', icon: '🚗', description: 'Energy saving when property is empty', devices: [], isActive: true, triggerType: 'manual' },
  { id: 'scene-3', name: 'Night Mode', icon: '🌙', description: 'Dim lights, lock doors, lower thermostat', devices: [], isActive: false, triggerType: 'schedule', schedule: { time: '22:00', days: [0,1,2,3,4,5,6] } },
  { id: 'scene-4', name: 'Good Morning', icon: '☀️', description: 'Raise lights, adjust temperature', devices: [], isActive: false, triggerType: 'schedule', schedule: { time: '07:00', days: [0,1,2,3,4,5,6] } },
  { id: 'scene-5', name: 'Movie Night', icon: '🎬', description: 'Dim lights to 20%, close blinds', devices: [], isActive: false, triggerType: 'manual' },
  { id: 'scene-6', name: 'Cleaning Mode', icon: '🧹', description: 'Max lights, thermostat off, unlock', devices: [], isActive: false, triggerType: 'event' },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================================================
// COMPONENTS
// ============================================================================

function LoadingSkeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#2D2D2D]/10 rounded-xl ${className}`} />;
}

function DeviceStatusBadge({ status }: { status: SmartDevice['status'] }) {
  const configs = {
    online: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    offline: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
    warning: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
    error: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  };
  const config = configs[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function BatteryIndicator({ level }: { level: number }) {
  const color = level > 50 ? 'text-emerald-500' : level > 20 ? 'text-amber-500' : 'text-red-500';
  const Icon = level > 50 ? Battery : level > 20 ? BatteryWarning : BatteryLow;

  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium">{level}%</span>
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color, trend }: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  color: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-[#2D2D2D]/5"
    >
      <div className="flex items-start justify-between">
        <Icon className={`w-6 h-6 ${color}`} />
        {trend && (
          <span className={`text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <div className="text-2xl font-['Playfair_Display'] font-bold text-[#2D2D2D] mt-3">
        {value}
      </div>
      <div className="text-sm text-[#2D2D2D]/60">{label}</div>
    </motion.div>
  );
}

function LockCodeCard({ code, onToggleShow, showCode, onCopy, onDelete }: {
  code: LockCode;
  onToggleShow: () => void;
  showCode: boolean;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const config = CODE_TYPE_CONFIG[code.type];
  const Icon = config?.icon || User;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-[#2D2D2D]/10 p-4 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl ${config?.bgLight} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-6 h-6 ${config?.textColor}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-[#2D2D2D] truncate">{code.name}</h4>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config?.bgLight} ${config?.textColor}`}>
              {config?.label}
            </span>
          </div>
          <p className="text-sm text-[#2D2D2D]/60 truncate">
            {code.propertyId === 'ALL' ? 'All Properties' : code.propertyName}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-[#2D2D2D]/40">
            <span>{code.usageCount} uses</span>
            {code.lastUsed && <span>Last: {formatTimeAgo(code.lastUsed)}</span>}
            {code.expiresAt && (
              <span className="text-amber-600">Expires {code.expiresAt.toLocaleDateString()}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-[#F5F5F0] rounded-lg font-mono text-lg tracking-wider min-w-[100px] text-center">
            {showCode ? code.code : '••••••'}
          </div>
          <button onClick={onToggleShow} className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors">
            {showCode ? <EyeOff className="w-5 h-5 text-[#500000]" /> : <Eye className="w-5 h-5 text-[#500000]" />}
          </button>
          <button onClick={onCopy} className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors">
            <Copy className="w-5 h-5 text-[#500000]" />
          </button>
          {code.type !== 'owner' && (
            <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-5 h-5 text-red-500" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ThermostatCard({ thermostat, onUpdate }: {
  thermostat: ThermostatDevice;
  onUpdate: (id: string, changes: Partial<ThermostatDevice>) => void;
}) {
  const [localTemp, setLocalTemp] = useState(thermostat.targetTemp);

  const modeConfig = {
    heat: { icon: Flame, color: 'text-orange-500', bg: 'bg-orange-100', label: 'Heating' },
    cool: { icon: Snowflake, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Cooling' },
    auto: { icon: Wind, color: 'text-purple-500', bg: 'bg-purple-100', label: 'Auto' },
    off: { icon: Power, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Off' },
    eco: { icon: Sparkles, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'Eco' },
  };

  const mode = modeConfig[thermostat.mode];
  const ModeIcon = mode.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 overflow-hidden"
    >
      <div className="p-4 border-b border-[#2D2D2D]/5 flex items-center justify-between">
        <div>
          <h3 className="font-['Playfair_Display'] font-semibold text-[#2D2D2D]">{thermostat.propertyName}</h3>
          <p className="text-xs text-[#2D2D2D]/50 flex items-center gap-1">
            <span>{thermostat.brand}</span>
            <DeviceStatusBadge status={thermostat.status} />
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${mode.bg} ${mode.color}`}>
          <ModeIcon className="w-3.5 h-3.5" />
          {mode.label}
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-center mb-6">
          <div className="text-center">
            <div className="text-6xl font-bold text-[#2D2D2D]">{localTemp}°</div>
            <div className="text-sm text-[#2D2D2D]/50 mt-1">
              Current: {thermostat.currentTemp}°F &middot; {thermostat.humidity}% humidity
            </div>
          </div>
        </div>

        <div className="mb-6">
          <input
            type="range"
            min="60"
            max="85"
            value={localTemp}
            onChange={(e) => setLocalTemp(parseInt(e.target.value))}
            onMouseUp={() => onUpdate(thermostat.id, { targetTemp: localTemp })}
            onTouchEnd={() => onUpdate(thermostat.id, { targetTemp: localTemp })}
            className="w-full accent-[#500000] h-2 rounded-full"
          />
          <div className="flex justify-between text-xs text-[#2D2D2D]/40 mt-1">
            <span>60°F</span>
            <span>85°F</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {(['heat', 'cool', 'auto', 'eco', 'off'] as const).map((m) => {
            const cfg = modeConfig[m];
            const MIcon = cfg.icon;
            return (
              <button
                key={m}
                onClick={() => onUpdate(thermostat.id, { mode: m })}
                className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                  thermostat.mode === m
                    ? `${cfg.bg} ${cfg.color}`
                    : 'bg-[#F5F5F0] text-[#2D2D2D]/60 hover:bg-[#500000]/10'
                }`}
              >
                <MIcon className="w-4 h-4" />
                <span className="text-[10px] font-medium capitalize">{m}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="p-3 bg-[#F5F5F0] rounded-xl space-y-2">
          {thermostat.schedule.filter(s => s.isActive).map((sch) => (
            <div key={sch.id} className="flex items-center justify-between text-sm">
              <span className="text-[#2D2D2D]/60 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {sch.name}
              </span>
              <span className="font-medium text-[#2D2D2D]">{sch.time} - {sch.temp}°F</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function CameraCard({ camera, onToggleRecording }: {
  camera: CameraDevice;
  onToggleRecording: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 overflow-hidden"
    >
      <div className="relative aspect-video bg-[#2D2D2D] flex items-center justify-center">
        {camera.status === 'online' ? (
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
        ) : (
          <div className="text-center text-white/60">
            <WifiOff className="w-10 h-10 mx-auto mb-2" />
            <p>Camera Offline</p>
          </div>
        )}

        <div className="absolute top-3 left-3 flex items-center gap-2">
          {camera.isRecording && (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              REC
            </span>
          )}
          {camera.hasMotion && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white text-xs rounded-full">
              <Activity className="w-3 h-3" />
              Motion
            </span>
          )}
        </div>

        <div className="absolute top-3 right-3">
          <DeviceStatusBadge status={camera.status} />
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="text-white text-sm">
            <p className="font-medium">{camera.name}</p>
            <p className="text-white/70 text-xs">{camera.propertyName}</p>
          </div>
          <div className="flex gap-2">
            <button className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
              <Maximize2 className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={onToggleRecording}
              className={`p-2 rounded-lg transition-colors ${
                camera.isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {camera.isRecording ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-[#2D2D2D]/60">
            <span className="flex items-center gap-1">
              <Film className="w-4 h-4" />
              {camera.resolution}
            </span>
            {camera.nightVision && (
              <span className="flex items-center gap-1">
                <Moon className="w-4 h-4" />
                Night Vision
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="w-20 h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  camera.storage.used > 80 ? 'bg-red-500' : camera.storage.used > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${camera.storage.used}%` }}
              />
            </div>
            <span className="text-xs text-[#2D2D2D]/50">{camera.storage.used}%</span>
          </div>
        </div>
        {camera.lastMotion && (
          <p className="text-xs text-amber-600 mt-2">
            Last motion: {formatTimeAgo(camera.lastMotion)}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function LightCard({ light, onToggle, onBrightnessChange }: {
  light: LightDevice;
  onToggle: () => void;
  onBrightnessChange: (brightness: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl border border-[#2D2D2D]/10 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            light.isOn ? 'bg-amber-100' : 'bg-[#F5F5F0]'
          }`}>
            <Lightbulb className={`w-5 h-5 ${light.isOn ? 'text-amber-500' : 'text-[#2D2D2D]/40'}`} />
          </div>
          <div>
            <h4 className="font-medium text-[#2D2D2D]">{light.name}</h4>
            <p className="text-xs text-[#2D2D2D]/50">{light.propertyName}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            light.isOn ? 'bg-[#500000]' : 'bg-[#E5E5E5]'
          }`}
        >
          <motion.div
            animate={{ x: light.isOn ? 22 : 4 }}
            className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
          />
        </button>
      </div>

      {light.supportsDimming && light.isOn && (
        <div className="flex items-center gap-3">
          <Sun className="w-4 h-4 text-[#2D2D2D]/40" />
          <input
            type="range"
            min="1"
            max="100"
            value={light.brightness}
            onChange={(e) => onBrightnessChange(parseInt(e.target.value))}
            className="flex-1 accent-[#500000]"
          />
          <span className="text-sm text-[#2D2D2D]/60 w-10 text-right">{light.brightness}%</span>
        </div>
      )}

      {light.supportsColor && light.isOn && light.color && (
        <div className="flex items-center gap-2 mt-3">
          <div
            className="w-6 h-6 rounded-full border-2 border-white shadow-md"
            style={{ backgroundColor: light.color }}
          />
          <span className="text-xs text-[#2D2D2D]/50">{light.color}</span>
        </div>
      )}
    </motion.div>
  );
}

function SensorCard({ sensor }: { sensor: SensorDevice }) {
  const typeConfig = {
    motion: { icon: Activity, color: 'text-purple-500', bg: 'bg-purple-100' },
    door: { icon: Lock, color: 'text-blue-500', bg: 'bg-blue-100' },
    water: { icon: Droplets, color: 'text-cyan-500', bg: 'bg-cyan-100' },
    smoke: { icon: CloudRain, color: 'text-red-500', bg: 'bg-red-100' },
    co: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-100' },
    temperature: { icon: Thermometer, color: 'text-amber-500', bg: 'bg-amber-100' },
    humidity: { icon: Droplets, color: 'text-teal-500', bg: 'bg-teal-100' },
  };

  const config = typeConfig[sensor.sensorType];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-white rounded-xl border p-4 ${
        sensor.triggered ? 'border-red-300 bg-red-50' : 'border-[#2D2D2D]/10'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.bg}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h4 className="font-medium text-[#2D2D2D]">{sensor.name}</h4>
            <p className="text-xs text-[#2D2D2D]/50">{sensor.propertyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sensor.battery !== undefined && <BatteryIndicator level={sensor.battery} />}
          <DeviceStatusBadge status={sensor.status} />
        </div>
      </div>

      {sensor.triggered && (
        <div className="p-2 bg-red-100 text-red-700 rounded-lg text-sm flex items-center gap-2 mt-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{sensor.sensorType === 'motion' ? 'Motion detected' : 'Alert!'}</span>
          {sensor.lastTriggered && <span className="text-red-500 text-xs ml-auto">{formatTimeAgo(sensor.lastTriggered)}</span>}
        </div>
      )}

      {sensor.value !== undefined && (
        <div className="mt-2 text-sm text-[#2D2D2D]/60">
          Current: <span className="font-medium text-[#2D2D2D]">{sensor.value} {sensor.unit}</span>
        </div>
      )}
    </motion.div>
  );
}

function SceneCard({ scene, onActivate }: { scene: Scene; onActivate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
        scene.isActive ? 'border-[#500000] bg-[#500000]/5' : 'border-[#2D2D2D]/10'
      }`}
      onClick={onActivate}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{scene.icon}</span>
          <div>
            <h4 className="font-semibold text-[#2D2D2D]">{scene.name}</h4>
            <p className="text-xs text-[#2D2D2D]/60">{scene.description}</p>
          </div>
        </div>
        <div className={`w-3 h-3 rounded-full ${scene.isActive ? 'bg-emerald-500' : 'bg-[#2D2D2D]/20'}`} />
      </div>

      {scene.schedule && (
        <div className="text-xs text-[#2D2D2D]/50 flex items-center gap-1 mt-2">
          <Clock className="w-3 h-3" />
          Daily at {scene.schedule.time}
        </div>
      )}

      {scene.triggerType === 'event' && (
        <div className="text-xs text-[#2D2D2D]/50 flex items-center gap-1 mt-2">
          <Zap className="w-3 h-3" />
          Triggered by events
        </div>
      )}
    </motion.div>
  );
}

function AddCodeModal({ isOpen, onClose, onSubmit }: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<LockCode['type']>('cleaner');
  const [customCode, setCustomCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [propertyId, setPropertyId] = useState('ALL');
  const [expiresAt, setExpiresAt] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl max-w-md w-full overflow-hidden"
      >
        <div className="p-5 border-b border-[#2D2D2D]/10 flex items-center justify-between">
          <h2 className="font-['Playfair_Display'] text-xl font-semibold text-[#2D2D2D]">Add Lock Code</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#2D2D2D] mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Maria Rodriguez"
              className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2D2D2D] mb-2">Code Type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CODE_TYPE_CONFIG).filter(([k]) => k !== 'guest').map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key as LockCode['type'])}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      type === key
                        ? 'border-[#500000] bg-[#500000]/5'
                        : 'border-transparent bg-[#F5F5F0]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${cfg.textColor}`} />
                    <span className="font-medium text-[#2D2D2D]">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2D2D2D] mb-2">Property</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl"
            >
              <option value="ALL">All Properties</option>
              {PROPERTIES.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-[#2D2D2D]">
              <input
                type="checkbox"
                checked={useCustomCode}
                onChange={(e) => setUseCustomCode(e.target.checked)}
                className="rounded accent-[#500000]"
              />
              Use custom code
            </label>
            {useCustomCode && (
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl mt-2 font-mono"
              />
            )}
          </div>

          {type === 'guest' && (
            <div>
              <label className="block text-sm font-medium text-[#2D2D2D] mb-2">Expires (optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl"
              />
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[#2D2D2D]/10 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-[#F5F5F0] rounded-xl font-medium">
            Cancel
          </button>
          <button
            onClick={() => {
              onSubmit({
                name,
                type,
                propertyId,
                code: useCustomCode ? customCode : generateCode(),
                expiresAt: expiresAt ? new Date(expiresAt) : null,
              });
              onClose();
            }}
            disabled={!name}
            className="flex-1 py-3 bg-[#500000] text-white rounded-xl font-medium disabled:opacity-50"
          >
            Add Code
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SmartHomePage() {
  // State
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Data state
  const [codes, setCodes] = useState<LockCode[]>(MOCK_CODES);
  const [logs, setLogs] = useState<EntryLog[]>(MOCK_LOGS);
  const [thermostats, setThermostats] = useState<ThermostatDevice[]>(MOCK_THERMOSTATS);
  const [cameras, setCameras] = useState<CameraDevice[]>(MOCK_CAMERAS);
  const [lights, setLights] = useState<LightDevice[]>(MOCK_LIGHTS);
  const [sensors, setSensors] = useState<SensorDevice[]>(MOCK_SENSORS);
  const [scenes, setScenes] = useState<Scene[]>(MOCK_SCENES);

  // UI state
  const [showCodeValues, setShowCodeValues] = useState<Record<string, boolean>>({});
  const [showAddCodeModal, setShowAddCodeModal] = useState(false);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddCodeModal(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const handleDeleteCode = (codeId: string) => {
    setCodes(prev => prev.filter(c => c.id !== codeId));
    toast.success('Code deleted');
  };

  const handleAddCode = (data: any) => {
    const newCode: LockCode = {
      id: `code-${Date.now()}`,
      ...data,
      propertyName: data.propertyId === 'ALL' ? 'All Properties' : PROPERTIES.find(p => p.id === data.propertyId)?.name || '',
      createdAt: new Date(),
      isActive: true,
      usageCount: 0,
    };
    setCodes(prev => [...prev, newCode]);
    toast.success('Code added successfully!');
  };

  const handleThermostatUpdate = (id: string, changes: Partial<ThermostatDevice>) => {
    setThermostats(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t));
    toast.success('Thermostat updated');
  };

  const handleToggleLight = (lightId: string) => {
    setLights(prev => prev.map(l => l.id === lightId ? { ...l, isOn: !l.isOn } : l));
  };

  const handleLightBrightness = (lightId: string, brightness: number) => {
    setLights(prev => prev.map(l => l.id === lightId ? { ...l, brightness } : l));
  };

  const handleToggleRecording = (cameraId: string) => {
    setCameras(prev => prev.map(c => c.id === cameraId ? { ...c, isRecording: !c.isRecording } : c));
  };

  const handleActivateScene = (sceneId: string) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isActive: !s.isActive } : s));
    const scene = scenes.find(s => s.id === sceneId);
    if (scene) {
      toast.success(`${scene.isActive ? 'Deactivated' : 'Activated'} ${scene.name}`);
    }
  };

  // Filter data by property
  const filteredCodes = useMemo(() => {
    return codes.filter(c =>
      (selectedProperty === 'all' || c.propertyId === 'ALL' || c.propertyId === selectedProperty) &&
      (searchQuery === '' || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [codes, selectedProperty, searchQuery]);

  const filteredLogs = useMemo(() => {
    return logs.filter(l =>
      selectedProperty === 'all' || l.propertyId === selectedProperty
    );
  }, [logs, selectedProperty]);

  const filteredThermostats = useMemo(() => {
    return thermostats.filter(t =>
      selectedProperty === 'all' || t.propertyId === selectedProperty
    );
  }, [thermostats, selectedProperty]);

  const filteredCameras = useMemo(() => {
    return cameras.filter(c =>
      selectedProperty === 'all' || c.propertyId === selectedProperty
    );
  }, [cameras, selectedProperty]);

  const filteredLights = useMemo(() => {
    return lights.filter(l =>
      selectedProperty === 'all' || l.propertyId === selectedProperty
    );
  }, [lights, selectedProperty]);

  const filteredSensors = useMemo(() => {
    return sensors.filter(s =>
      selectedProperty === 'all' || s.propertyId === selectedProperty
    );
  }, [sensors, selectedProperty]);

  // Stats
  const stats = useMemo(() => ({
    totalDevices: thermostats.length + cameras.length + lights.length + sensors.length + codes.length,
    onlineDevices: [...thermostats, ...cameras, ...lights, ...sensors].filter(d => d.status === 'online').length,
    activeCodes: codes.filter(c => c.isActive).length,
    todayEntries: logs.filter(l => {
      const today = new Date().toDateString();
      return l.timestamp.toDateString() === today;
    }).length,
    activeScenes: scenes.filter(s => s.isActive).length,
    alerts: sensors.filter(s => s.triggered || s.status === 'warning').length,
  }), [thermostats, cameras, lights, sensors, codes, logs, scenes]);

  const tabs: { id: TabView; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'codes', label: 'Lock Codes', icon: Key, count: filteredCodes.length },
    { id: 'thermostat', label: 'Thermostats', icon: Thermometer, count: filteredThermostats.length },
    { id: 'cameras', label: 'Cameras', icon: Camera, count: filteredCameras.length },
    { id: 'lights', label: 'Lights', icon: Lightbulb, count: filteredLights.length },
    { id: 'sensors', label: 'Sensors', icon: Activity, count: filteredSensors.length },
    { id: 'scenes', label: 'Scenes', icon: Sparkles, count: scenes.length },
    { id: 'logs', label: 'Entry Logs', icon: History },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <LoadingSkeleton className="h-16 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <LoadingSkeleton key={i} className="h-28" />)}
          </div>
          <LoadingSkeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-['Playfair_Display'] font-bold text-[#500000]">
                Smart Home Control
              </h1>
              <p className="text-[#2D2D2D]/60 mt-1">
                Manage all devices across {PROPERTIES.length} properties
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D2D2D]/40" />
                <input
                  id="search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search devices..."
                  className="pl-10 pr-4 py-2.5 bg-[#F5F5F0] rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-[#500000]/20"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-white rounded text-xs text-[#2D2D2D]/40 border">
                  {'\u2318'}K
                </kbd>
              </div>

              {/* Property Filter */}
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="px-4 py-2.5 bg-[#F5F5F0] rounded-xl text-[#2D2D2D] font-medium"
              >
                <option value="all">All Properties</option>
                {PROPERTIES.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {/* Refresh */}
              <button
                onClick={() => {
                  setIsLoading(true);
                  setTimeout(() => setIsLoading(false), 500);
                  toast.success('Data refreshed');
                }}
                className="p-2.5 bg-[#F5F5F0] rounded-xl hover:bg-[#500000]/10 transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-[#500000]" />
              </button>

              {/* Add Code */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddCodeModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#500000] to-[#722F37] text-white font-semibold rounded-xl shadow-lg shadow-[#500000]/20"
              >
                <Plus className="w-5 h-5" />
                Add Code
              </motion.button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-2 -mb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#500000] text-white shadow-lg shadow-[#500000]/20'
                    : 'text-[#2D2D2D]/60 hover:bg-[#500000]/10 hover:text-[#500000]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-[#2D2D2D]/10'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {/* ============================================================== */}
          {/* OVERVIEW TAB */}
          {/* ============================================================== */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard icon={Wifi} value={stats.onlineDevices} label="Online Devices" color="text-emerald-500" />
                <StatCard icon={Key} value={stats.activeCodes} label="Active Codes" color="text-[#500000]" />
                <StatCard icon={History} value={stats.todayEntries} label="Today's Entries" color="text-blue-500" />
                <StatCard icon={Camera} value={cameras.filter(c => c.isRecording).length} label="Cameras Recording" color="text-purple-500" />
                <StatCard icon={Sparkles} value={stats.activeScenes} label="Active Scenes" color="text-amber-500" />
                <StatCard icon={AlertTriangle} value={stats.alerts} label="Alerts" color={stats.alerts > 0 ? 'text-red-500' : 'text-gray-400'} />
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6">
                <h2 className="font-['Playfair_Display'] text-lg font-semibold text-[#2D2D2D] mb-4">
                  Quick Actions
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: Lock, label: 'Lock All Doors', action: () => toast.success('All doors locked') },
                    { icon: Thermometer, label: 'Set Eco Mode', action: () => toast.success('Eco mode activated') },
                    { icon: Lightbulb, label: 'All Lights Off', action: () => { setLights(prev => prev.map(l => ({ ...l, isOn: false }))); toast.success('All lights off'); } },
                    { icon: Camera, label: 'Start Recording', action: () => toast.success('Recording started') },
                  ].map((action) => (
                    <button
                      key={action.label}
                      onClick={action.action}
                      className="p-4 bg-[#F5F5F0] rounded-xl hover:bg-[#500000]/10 transition-colors group"
                    >
                      <action.icon className="w-8 h-8 text-[#500000] mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium text-[#2D2D2D]">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Activity & Alerts */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Recent Entries */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6">
                  <h2 className="font-['Playfair_Display'] text-lg font-semibold text-[#2D2D2D] mb-4">
                    Recent Entries
                  </h2>
                  <div className="space-y-3">
                    {logs.slice(0, 5).map((log) => {
                      const config = CODE_TYPE_CONFIG[log.codeType as keyof typeof CODE_TYPE_CONFIG];
                      const Icon = config?.icon || User;
                      return (
                        <div key={log.id} className="flex items-center gap-3 p-3 bg-[#F5F5F0] rounded-xl">
                          <div className={`w-8 h-8 rounded-lg ${config?.bgLight} flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 ${config?.textColor}`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-[#2D2D2D] text-sm">{log.codeName}</p>
                            <p className="text-xs text-[#2D2D2D]/50">{log.propertyName}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs">{log.action === 'unlock' ? '🔓' : '🔒'}</span>
                            <p className="text-xs text-[#2D2D2D]/50">{formatTimeAgo(log.timestamp)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Active Alerts */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 p-6">
                  <h2 className="font-['Playfair_Display'] text-lg font-semibold text-[#2D2D2D] mb-4">
                    Active Alerts
                  </h2>
                  <div className="space-y-3">
                    {sensors.filter(s => s.triggered || s.status === 'warning').length > 0 ? (
                      sensors.filter(s => s.triggered || s.status === 'warning').map((sensor) => (
                        <div key={sensor.id} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <div className="flex-1">
                            <p className="font-medium text-red-700 text-sm">{sensor.name}</p>
                            <p className="text-xs text-red-500">{sensor.propertyName}</p>
                          </div>
                          <button className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                            Dismiss
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <p className="text-[#2D2D2D]/60">No active alerts</p>
                        <p className="text-sm text-[#2D2D2D]/40">All systems normal</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* LOCK CODES TAB */}
          {/* ============================================================== */}
          {activeTab === 'codes' && (
            <motion.div
              key="codes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                {filteredCodes.map((code) => (
                  <LockCodeCard
                    key={code.id}
                    code={code}
                    showCode={showCodeValues[code.id] || false}
                    onToggleShow={() => setShowCodeValues(prev => ({ ...prev, [code.id]: !prev[code.id] }))}
                    onCopy={() => handleCopyCode(code.code)}
                    onDelete={() => handleDeleteCode(code.id)}
                  />
                ))}
              </div>

              {/* How It Works */}
              <div className="bg-gradient-to-br from-[#500000] to-[#722F37] rounded-2xl p-6 text-white">
                <h3 className="font-['Playfair_Display'] text-lg font-semibold mb-4">
                  How Lock Automation Works
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { num: '1', title: 'Guest Check-In', desc: 'Random 6-digit code auto-generated before arrival' },
                    { num: '2', title: 'Entry Logging', desc: 'Every code use is logged & Steven gets notified' },
                    { num: '3', title: 'Auto Checkout', desc: 'Guest code deleted at checkout, thermostat resets' },
                  ].map((step) => (
                    <div key={step.num} className="bg-white/10 rounded-xl p-4">
                      <div className="text-2xl mb-2">{step.num}</div>
                      <div className="font-medium">{step.title}</div>
                      <p className="text-sm text-white/70 mt-1">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* THERMOSTATS TAB */}
          {/* ============================================================== */}
          {activeTab === 'thermostat' && (
            <motion.div
              key="thermostat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredThermostats.map((thermostat) => (
                  <ThermostatCard
                    key={thermostat.id}
                    thermostat={thermostat}
                    onUpdate={handleThermostatUpdate}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* CAMERAS TAB */}
          {/* ============================================================== */}
          {activeTab === 'cameras' && (
            <motion.div
              key="cameras"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCameras.map((camera) => (
                  <CameraCard
                    key={camera.id}
                    camera={camera}
                    onToggleRecording={() => handleToggleRecording(camera.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* LIGHTS TAB */}
          {/* ============================================================== */}
          {activeTab === 'lights' && (
            <motion.div
              key="lights"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLights.map((light) => (
                  <LightCard
                    key={light.id}
                    light={light}
                    onToggle={() => handleToggleLight(light.id)}
                    onBrightnessChange={(b) => handleLightBrightness(light.id, b)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* SENSORS TAB */}
          {/* ============================================================== */}
          {activeTab === 'sensors' && (
            <motion.div
              key="sensors"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSensors.map((sensor) => (
                  <SensorCard key={sensor.id} sensor={sensor} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* SCENES TAB */}
          {/* ============================================================== */}
          {activeTab === 'scenes' && (
            <motion.div
              key="scenes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenes.map((scene) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    onActivate={() => handleActivateScene(scene.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* LOGS TAB */}
          {/* ============================================================== */}
          {activeTab === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="bg-white rounded-2xl shadow-sm border border-[#2D2D2D]/5 overflow-hidden">
                <div className="p-5 border-b border-[#2D2D2D]/5">
                  <h2 className="font-['Playfair_Display'] text-xl font-semibold text-[#2D2D2D]">
                    Entry Log History
                  </h2>
                  <p className="text-sm text-[#2D2D2D]/60 mt-1">
                    All lock access events across properties
                  </p>
                </div>

                <div className="divide-y divide-[#2D2D2D]/5">
                  {filteredLogs.map((log) => {
                    const config = CODE_TYPE_CONFIG[log.codeType as keyof typeof CODE_TYPE_CONFIG];
                    const Icon = config?.icon || User;

                    return (
                      <div key={log.id} className="p-4 flex items-center gap-4 hover:bg-[#F5F5F0]/50">
                        <div className={`w-10 h-10 rounded-full ${config?.bgLight} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${config?.textColor}`} />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-[#2D2D2D]">{log.codeName}</div>
                          <div className="text-sm text-[#2D2D2D]/60">
                            {log.action === 'unlock' ? '🔓 Unlocked' : '🔒 Locked'} at {log.propertyName}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-[#2D2D2D]">
                            {log.timestamp.toLocaleTimeString()}
                          </div>
                          <div className="text-xs text-[#2D2D2D]/50">
                            {log.timestamp.toLocaleDateString()}
                          </div>
                        </div>
                        {log.notified && (
                          <div className="flex items-center gap-1 text-emerald-500">
                            <Bell className="w-4 h-4" />
                            <span className="text-xs">Notified</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Add Code Modal */}
      <AddCodeModal
        isOpen={showAddCodeModal}
        onClose={() => setShowAddCodeModal(false)}
        onSubmit={handleAddCode}
      />

      {/* Keyboard Shortcuts */}
      <div className="fixed bottom-4 right-4 text-xs text-[#2D2D2D]/40">
        <kbd className="px-2 py-1 bg-white rounded shadow">Ctrl</kbd>+
        <kbd className="px-2 py-1 bg-white rounded shadow">K</kbd> to search
      </div>
    </div>
  );
}
