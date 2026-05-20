'use client';

import { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Thermometer,
  Lock,
  Unlock,
  LightbulbOff,
  Lightbulb,
  Camera,
  BatteryMedium,
  BatteryLow,
  BatteryFull,
  AlertTriangle,
  CheckCircle,
  Settings,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Activity,
  Home,
  Droplets,
  Wind,
  Eye,
  Bell,
  Power,
  Gauge,
  Clock,
  MapPin,
  ToggleLeft,
  ToggleRight,
  Volume2,
  Shield,
} from 'lucide-react';

type DeviceType = 'lock' | 'thermostat' | 'light' | 'camera' | 'sensor' | 'smoke';
type DeviceStatus = 'online' | 'offline' | 'warning';

interface Device {
  id: string;
  name: string;
  type: DeviceType;
  property: string;
  status: DeviceStatus;
  battery: number | null;
  lastSeen: string;
  data: Record<string, unknown>;
}

interface EventLog {
  id: string;
  deviceId: string;
  deviceName: string;
  property: string;
  type: 'lock' | 'unlock' | 'temp_change' | 'motion' | 'alert' | 'low_battery' | 'offline' | 'arm' | 'disarm';
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
}

const PROPERTIES = [
  'Sunset Villa',
  'Permian Loft',
  'Desert Rose',
  'Basin View',
  'Wildcatter Suite',
  'Derrick House',
  'Cactus Court',
  'Mesa Ridge',
];

const DEVICES: Device[] = [
  { id: 'D001', name: 'Front Door Lock', type: 'lock', property: 'Sunset Villa', status: 'online', battery: 82, lastSeen: '2026-03-17 08:45', data: { locked: true, autoLock: true, guestCode: '4829', codeExpiry: '2026-03-20' } },
  { id: 'D002', name: 'Back Door Lock', type: 'lock', property: 'Sunset Villa', status: 'online', battery: 67, lastSeen: '2026-03-17 08:44', data: { locked: true, autoLock: true, guestCode: '4829', codeExpiry: '2026-03-20' } },
  { id: 'D003', name: 'Main Thermostat', type: 'thermostat', property: 'Sunset Villa', status: 'online', battery: null, lastSeen: '2026-03-17 08:45', data: { currentTemp: 72, setTemp: 72, mode: 'cool', humidity: 38, schedule: true } },
  { id: 'D004', name: 'Porch Light', type: 'light', property: 'Sunset Villa', status: 'online', battery: null, lastSeen: '2026-03-17 08:42', data: { on: true, brightness: 80, schedule: true } },
  { id: 'D005', name: 'Driveway Camera', type: 'camera', property: 'Sunset Villa', status: 'online', battery: null, lastSeen: '2026-03-17 08:45', data: { recording: true, motionDetect: true, nightVision: true } },
  { id: 'D006', name: 'Water Leak Sensor', type: 'sensor', property: 'Sunset Villa', status: 'online', battery: 91, lastSeen: '2026-03-17 08:30', data: { leak: false, location: 'Kitchen' } },
  { id: 'D007', name: 'Smoke Detector', type: 'smoke', property: 'Sunset Villa', status: 'online', battery: 95, lastSeen: '2026-03-17 08:00', data: { alarm: false, coLevel: 0 } },
  { id: 'D008', name: 'Front Door Lock', type: 'lock', property: 'Permian Loft', status: 'online', battery: 45, lastSeen: '2026-03-17 08:40', data: { locked: false, autoLock: true, guestCode: '7713', codeExpiry: '2026-03-22' } },
  { id: 'D009', name: 'Main Thermostat', type: 'thermostat', property: 'Permian Loft', status: 'online', battery: null, lastSeen: '2026-03-17 08:45', data: { currentTemp: 68, setTemp: 70, mode: 'heat', humidity: 42, schedule: true } },
  { id: 'D010', name: 'Porch Light', type: 'light', property: 'Permian Loft', status: 'offline', battery: null, lastSeen: '2026-03-16 22:10', data: { on: false, brightness: 0, schedule: true } },
  { id: 'D011', name: 'Front Door Lock', type: 'lock', property: 'Desert Rose', status: 'online', battery: 15, lastSeen: '2026-03-17 08:38', data: { locked: true, autoLock: true, guestCode: '', codeExpiry: '' } },
  { id: 'D012', name: 'Main Thermostat', type: 'thermostat', property: 'Desert Rose', status: 'warning', battery: null, lastSeen: '2026-03-17 07:15', data: { currentTemp: 84, setTemp: 72, mode: 'cool', humidity: 55, schedule: false } },
  { id: 'D013', name: 'Smoke Detector', type: 'smoke', property: 'Desert Rose', status: 'online', battery: 88, lastSeen: '2026-03-17 08:00', data: { alarm: false, coLevel: 2 } },
  { id: 'D014', name: 'Front Door Lock', type: 'lock', property: 'Basin View', status: 'online', battery: 73, lastSeen: '2026-03-17 08:42', data: { locked: true, autoLock: false, guestCode: '3356', codeExpiry: '2026-03-19' } },
  { id: 'D015', name: 'Main Thermostat', type: 'thermostat', property: 'Basin View', status: 'online', battery: null, lastSeen: '2026-03-17 08:44', data: { currentTemp: 71, setTemp: 71, mode: 'auto', humidity: 40, schedule: true } },
  { id: 'D016', name: 'Garage Camera', type: 'camera', property: 'Basin View', status: 'online', battery: null, lastSeen: '2026-03-17 08:45', data: { recording: true, motionDetect: true, nightVision: true } },
  { id: 'D017', name: 'Front Door Lock', type: 'lock', property: 'Wildcatter Suite', status: 'offline', battery: 5, lastSeen: '2026-03-16 14:20', data: { locked: true, autoLock: true, guestCode: '', codeExpiry: '' } },
  { id: 'D018', name: 'Main Thermostat', type: 'thermostat', property: 'Wildcatter Suite', status: 'online', battery: null, lastSeen: '2026-03-17 08:43', data: { currentTemp: 70, setTemp: 70, mode: 'off', humidity: 36, schedule: false } },
  { id: 'D019', name: 'Water Leak Sensor', type: 'sensor', property: 'Derrick House', status: 'warning', battery: 22, lastSeen: '2026-03-17 06:00', data: { leak: true, location: 'Bathroom' } },
  { id: 'D020', name: 'Front Door Lock', type: 'lock', property: 'Derrick House', status: 'online', battery: 60, lastSeen: '2026-03-17 08:41', data: { locked: true, autoLock: true, guestCode: '9901', codeExpiry: '2026-03-25' } },
];

const EVENTS: EventLog[] = [
  { id: 'E01', deviceId: 'D019', deviceName: 'Water Leak Sensor', property: 'Derrick House', type: 'alert', message: 'Water leak detected in bathroom', timestamp: '2026-03-17 06:00', severity: 'critical' },
  { id: 'E02', deviceId: 'D017', deviceName: 'Front Door Lock', property: 'Wildcatter Suite', type: 'low_battery', message: 'Battery critically low (5%)', timestamp: '2026-03-16 14:20', severity: 'critical' },
  { id: 'E03', deviceId: 'D012', deviceName: 'Main Thermostat', property: 'Desert Rose', type: 'temp_change', message: 'Temperature 84F exceeds setpoint 72F by 12 degrees', timestamp: '2026-03-17 07:15', severity: 'warning' },
  { id: 'E04', deviceId: 'D010', deviceName: 'Porch Light', property: 'Permian Loft', type: 'offline', message: 'Device went offline', timestamp: '2026-03-16 22:10', severity: 'warning' },
  { id: 'E05', deviceId: 'D011', deviceName: 'Front Door Lock', property: 'Desert Rose', type: 'low_battery', message: 'Battery low (15%)', timestamp: '2026-03-17 08:00', severity: 'warning' },
  { id: 'E06', deviceId: 'D008', deviceName: 'Front Door Lock', property: 'Permian Loft', type: 'unlock', message: 'Guest code 7713 used to unlock', timestamp: '2026-03-17 08:40', severity: 'info' },
  { id: 'E07', deviceId: 'D001', deviceName: 'Front Door Lock', property: 'Sunset Villa', type: 'lock', message: 'Auto-locked after 5 minutes', timestamp: '2026-03-17 08:32', severity: 'info' },
  { id: 'E08', deviceId: 'D005', deviceName: 'Driveway Camera', property: 'Sunset Villa', type: 'motion', message: 'Motion detected on driveway', timestamp: '2026-03-17 08:27', severity: 'info' },
  { id: 'E09', deviceId: 'D001', deviceName: 'Front Door Lock', property: 'Sunset Villa', type: 'unlock', message: 'Guest code 4829 used to unlock', timestamp: '2026-03-17 08:27', severity: 'info' },
  { id: 'E10', deviceId: 'D003', deviceName: 'Main Thermostat', property: 'Sunset Villa', type: 'temp_change', message: 'Temperature adjusted from 70F to 72F', timestamp: '2026-03-17 07:00', severity: 'info' },
  { id: 'E11', deviceId: 'D016', deviceName: 'Garage Camera', property: 'Basin View', type: 'motion', message: 'Motion detected near garage', timestamp: '2026-03-17 06:45', severity: 'info' },
  { id: 'E12', deviceId: 'D014', deviceName: 'Front Door Lock', property: 'Basin View', type: 'lock', message: 'Manually locked via app', timestamp: '2026-03-17 06:30', severity: 'info' },
];

const deviceTypeIcon: Record<DeviceType, React.ReactNode> = {
  lock: <Lock className="w-5 h-5" />,
  thermostat: <Thermometer className="w-5 h-5" />,
  light: <Lightbulb className="w-5 h-5" />,
  camera: <Camera className="w-5 h-5" />,
  sensor: <Droplets className="w-5 h-5" />,
  smoke: <Shield className="w-5 h-5" />,
};

const deviceTypeLabel: Record<DeviceType, string> = {
  lock: 'Smart Lock',
  thermostat: 'Thermostat',
  light: 'Light',
  camera: 'Camera',
  sensor: 'Sensor',
  smoke: 'Smoke/CO',
};

export default function SmartHomePage() {
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | DeviceType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [showEventsPanel, setShowEventsPanel] = useState(true);
  const [devices, setDevices] = useState(DEVICES);

  const filtered = devices.filter((d) => {
    if (propertyFilter !== 'all' && d.property !== propertyFilter) return false;
    if (typeFilter !== 'all' && d.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.property.toLowerCase().includes(q) ||
        d.type.includes(q)
      );
    }
    return true;
  });

  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const offlineCount = devices.filter((d) => d.status === 'offline').length;
  const warningCount = devices.filter((d) => d.status === 'warning').length;
  const lowBattery = devices.filter((d) => d.battery !== null && d.battery < 20).length;
  const criticalEvents = EVENTS.filter((e) => e.severity === 'critical').length;
  const uniqueProperties = [...new Set(devices.map((d) => d.property))];

  const toggleLock = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId && d.type === 'lock'
          ? { ...d, data: { ...d.data, locked: !d.data.locked } }
          : d
      )
    );
  };

  const adjustTemp = (deviceId: string, delta: number) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId && d.type === 'thermostat'
          ? { ...d, data: { ...d.data, setTemp: (d.data.setTemp as number) + delta } }
          : d
      )
    );
  };

  const toggleLight = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId && d.type === 'light'
          ? { ...d, data: { ...d.data, on: !d.data.on } }
          : d
      )
    );
  };

  const getBatteryIcon = (level: number) => {
    if (level < 20) return <BatteryLow className="w-4 h-4 text-red-500" />;
    if (level < 60) return <BatteryMedium className="w-4 h-4 text-amber-500" />;
    return <BatteryFull className="w-4 h-4 text-green-500" />;
  };

  const getStatusDot = (status: DeviceStatus) => {
    const colors: Record<DeviceStatus, string> = {
      online: 'bg-green-500',
      offline: 'bg-red-500',
      warning: 'bg-amber-500',
    };
    return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`} />;
  };

  const getSeverityStyle = (severity: EventLog['severity']) => {
    const styles: Record<EventLog['severity'], string> = {
      info: 'border-l-blue-400 bg-white',
      warning: 'border-l-amber-400 bg-amber-50',
      critical: 'border-l-red-500 bg-red-50',
    };
    return styles[severity];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Home Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {devices.length} devices across {uniqueProperties.length} properties
          </p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4" />
          Refresh All
        </button>
      </div>

      {/* Alert Banner */}
      {(criticalEvents > 0 || lowBattery > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">Attention Required</p>
            <div className="text-sm text-red-700 mt-1 space-y-1">
              {criticalEvents > 0 && (
                <p>{criticalEvents} critical event{criticalEvents > 1 ? 's' : ''} need immediate attention</p>
              )}
              {lowBattery > 0 && (
                <p>{lowBattery} device{lowBattery > 1 ? 's' : ''} with critically low battery</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-500">Online</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{onlineCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <WifiOff className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-500">Offline</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{offlineCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-gray-500">Warnings</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{warningCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BatteryLow className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-500">Low Battery</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{lowBattery}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-[#500000]" />
            <span className="text-xs text-gray-500">Locked</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {devices.filter((d) => d.type === 'lock' && d.data.locked).length}/
            {devices.filter((d) => d.type === 'lock').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
          />
        </div>
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
        >
          <option value="all">All Properties</option>
          {uniqueProperties.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | DeviceType)}
          className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
        >
          <option value="all">All Types</option>
          {(Object.keys(deviceTypeLabel) as DeviceType[]).map((t) => (
            <option key={t} value={t}>
              {deviceTypeLabel[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Grid */}
        <div className="lg:col-span-2 space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              No devices match your filters
            </div>
          )}
          {filtered.map((device) => {
            const expanded = expandedDevice === device.id;
            return (
              <div
                key={device.id}
                className={`bg-white rounded-xl border transition-all ${
                  device.status === 'warning'
                    ? 'border-amber-300'
                    : device.status === 'offline'
                    ? 'border-red-200'
                    : 'border-gray-200'
                }`}
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedDevice(expanded ? null : device.id)}
                >
                  <div
                    className={`p-2.5 rounded-lg ${
                      device.status === 'offline'
                        ? 'bg-red-50 text-red-500'
                        : device.status === 'warning'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-[#500000]/10 text-[#500000]'
                    }`}
                  >
                    {deviceTypeIcon[device.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{device.name}</span>
                      {getStatusDot(device.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {device.property}
                      </span>
                      <span>{deviceTypeLabel[device.type]}</span>
                      {device.battery !== null && (
                        <span className="flex items-center gap-1">
                          {getBatteryIcon(device.battery)}
                          {device.battery}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Controls */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {device.type === 'lock' && (
                      <button
                        onClick={() => toggleLock(device.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          device.data.locked
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {device.data.locked ? (
                          <>
                            <Lock className="w-3.5 h-3.5" /> Locked
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3.5 h-3.5" /> Unlocked
                          </>
                        )}
                      </button>
                    )}
                    {device.type === 'thermostat' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => adjustTemp(device.id, -1)}
                          className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium"
                        >
                          -
                        </button>
                        <span className="w-14 text-center font-semibold text-gray-900 text-sm">
                          {String(device.data.setTemp)}°F
                        </span>
                        <button
                          onClick={() => adjustTemp(device.id, 1)}
                          className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium"
                        >
                          +
                        </button>
                      </div>
                    )}
                    {device.type === 'light' && (
                      <button
                        onClick={() => toggleLight(device.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          device.data.on
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {device.data.on ? (
                          <>
                            <Lightbulb className="w-3.5 h-3.5" /> On
                          </>
                        ) : (
                          <>
                            <LightbulbOff className="w-3.5 h-3.5" /> Off
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="text-gray-400">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {expanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-xs text-gray-400">Status</span>
                        <p className="font-medium text-gray-900 capitalize flex items-center gap-1.5">
                          {getStatusDot(device.status)} {device.status}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400">Last Seen</span>
                        <p className="font-medium text-gray-900">{device.lastSeen}</p>
                      </div>
                      {device.battery !== null && (
                        <div>
                          <span className="text-xs text-gray-400">Battery</span>
                          <p className="font-medium text-gray-900 flex items-center gap-1">
                            {getBatteryIcon(device.battery)} {device.battery}%
                          </p>
                        </div>
                      )}

                      {device.type === 'lock' && (
                        <>
                          <div>
                            <span className="text-xs text-gray-400">Auto-Lock</span>
                            <p className="font-medium text-gray-900">
                              {device.data.autoLock ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Guest Code</span>
                            <p className="font-medium text-gray-900">
                              {(device.data.guestCode as string) || 'Not set'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Code Expiry</span>
                            <p className="font-medium text-gray-900">
                              {(device.data.codeExpiry as string) || 'N/A'}
                            </p>
                          </div>
                        </>
                      )}

                      {device.type === 'thermostat' && (
                        <>
                          <div>
                            <span className="text-xs text-gray-400">Current Temp</span>
                            <p className="font-medium text-gray-900">{String(device.data.currentTemp)}°F</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Mode</span>
                            <p className="font-medium text-gray-900 capitalize">{String(device.data.mode)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Humidity</span>
                            <p className="font-medium text-gray-900">{String(device.data.humidity)}%</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Schedule</span>
                            <p className="font-medium text-gray-900">
                              {device.data.schedule ? 'Active' : 'Off'}
                            </p>
                          </div>
                        </>
                      )}

                      {device.type === 'camera' && (
                        <>
                          <div>
                            <span className="text-xs text-gray-400">Recording</span>
                            <p className="font-medium text-gray-900">
                              {device.data.recording ? 'Active' : 'Paused'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Motion Detect</span>
                            <p className="font-medium text-gray-900">
                              {device.data.motionDetect ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Night Vision</span>
                            <p className="font-medium text-gray-900">
                              {device.data.nightVision ? 'On' : 'Off'}
                            </p>
                          </div>
                        </>
                      )}

                      {device.type === 'sensor' && (
                        <>
                          <div>
                            <span className="text-xs text-gray-400">Leak Detected</span>
                            <p className={`font-medium ${device.data.leak ? 'text-red-600' : 'text-green-600'}`}>
                              {device.data.leak ? 'YES - Active Leak' : 'No'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Location</span>
                            <p className="font-medium text-gray-900">{String(device.data.location)}</p>
                          </div>
                        </>
                      )}

                      {device.type === 'smoke' && (
                        <>
                          <div>
                            <span className="text-xs text-gray-400">Alarm</span>
                            <p className={`font-medium ${device.data.alarm ? 'text-red-600' : 'text-green-600'}`}>
                              {device.data.alarm ? 'ACTIVE' : 'Clear'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">CO Level</span>
                            <p className="font-medium text-gray-900">{String(device.data.coLevel)} ppm</p>
                          </div>
                        </>
                      )}

                      {device.type === 'light' && (
                        <>
                          <div>
                            <span className="text-xs text-gray-400">Brightness</span>
                            <p className="font-medium text-gray-900">{String(device.data.brightness)}%</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Schedule</span>
                            <p className="font-medium text-gray-900">
                              {device.data.schedule ? 'Active' : 'Off'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Event Log Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 sticky top-6">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#500000]" />
                Event Log
              </h2>
              <span className="text-xs text-gray-400">{EVENTS.length} events</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {EVENTS.map((event) => (
                <div
                  key={event.id}
                  className={`p-3 border-l-4 ${getSeverityStyle(event.severity)}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {event.severity === 'critical' ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : event.severity === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Activity className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 font-medium">{event.message}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{event.deviceName}</span>
                        <span>&middot;</span>
                        <span>{event.property}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{event.timestamp}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Property Quick Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Home className="w-5 h-5 text-[#500000]" />
          Property Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {uniqueProperties.map((property) => {
            const propDevices = devices.filter((d) => d.property === property);
            const propOnline = propDevices.filter((d) => d.status === 'online').length;
            const propLocks = propDevices.filter((d) => d.type === 'lock');
            const allLocked = propLocks.every((l) => l.data.locked);
            const thermostat = propDevices.find((d) => d.type === 'thermostat');
            const hasWarning = propDevices.some((d) => d.status === 'warning' || d.status === 'offline');

            return (
              <div
                key={property}
                className={`p-4 rounded-lg border transition-colors ${
                  hasWarning ? 'border-amber-300 bg-amber-50/50' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 text-sm">{property}</h3>
                  {hasWarning && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                </div>
                <div className="space-y-1.5 text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Devices</span>
                    <span className="font-medium">
                      {propOnline}/{propDevices.length} online
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Locks</span>
                    <span
                      className={`font-medium ${allLocked ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {allLocked ? 'All Locked' : 'Unlocked'}
                    </span>
                  </div>
                  {thermostat && (
                    <div className="flex items-center justify-between">
                      <span>Temp</span>
                      <span className="font-medium">
                        {String(thermostat.data.currentTemp)}°F / {String(thermostat.data.setTemp)}°F
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
