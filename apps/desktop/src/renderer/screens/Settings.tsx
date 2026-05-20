/**
 * Right at Home BnB - Settings Screen
 * Application configuration and data sync management
 * ECHO Design Standards: Dark magenta theme, glassmorphism
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  Bell,
  Download,
  Upload,
  Database,
  RefreshCw,
  Shield,
  Globe,
  Clock,
  DollarSign,
  Monitor,
  Folder,
  Info,
  ExternalLink,
  Check,
  Cloud,
  CloudOff,
  HardDrive,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Key,
  Lock,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../contexts/AppContext';
import { db } from '../services/database';
import toast from 'react-hot-toast';

// ECHO Design Standards Colors
const ECHO_COLORS = {
  echoBlack: '#0A0A0A',
  darkMagenta: '#8B008B',
  echoOrange: '#FF6B35',
  cobaltBlue: '#0047AB',
  matrixMagenta: '#9932CC',
  textPrimary: '#E0E0E0',
  textSecondary: '#A0A0A0',
};

interface SettingSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

const sections: SettingSection[] = [
  { id: 'appearance', title: 'Appearance', icon: Monitor },
  { id: 'sync', title: 'Data Sync', icon: Cloud },
  { id: 'notifications', title: 'Notifications', icon: Bell },
  { id: 'data', title: 'Data & Backup', icon: Database },
  { id: 'security', title: 'Security', icon: Shield },
  { id: 'preferences', title: 'Preferences', icon: Globe },
  { id: 'about', title: 'About', icon: Info },
];

// Glassmorphism Card Component
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={`relative rounded-2xl ${className}`}
    style={{
      background: 'rgba(139, 0, 139, 0.08)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(139, 0, 139, 0.2)',
      boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
    }}
  >
    {children}
  </div>
);

// Toggle Switch Component
const ToggleSwitch: React.FC<{
  enabled: boolean;
  onChange: () => void;
}> = ({ enabled, onChange }) => (
  <button
    onClick={onChange}
    className="w-12 h-6 rounded-full transition-colors relative"
    style={{
      background: enabled ? ECHO_COLORS.echoOrange : 'rgba(139, 0, 139, 0.3)',
    }}
  >
    <div
      className="w-5 h-5 bg-white rounded-full shadow-md transition-transform absolute top-0.5"
      style={{
        transform: enabled ? 'translateX(26px)' : 'translateX(2px)',
      }}
    />
  </button>
);

export default function Settings() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { settings, updateSettings, appInfo, isOffline } = useApp();
  const [activeSection, setActiveSection] = useState('appearance');
  const [localSettings, setLocalSettings] = useState(settings);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  useEffect(() => {
    setLocalSettings(settings);
    // Load last sync time from electron-store
    window.electronAPI.store.get<string>('lastSync').then((time) => {
      if (time) setLastSync(time);
    });
  }, [settings]);

  const handleSettingChange = async (key: string, value: unknown) => {
    setLocalSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    await updateSettings({ [key]: value });
    toast.success('Setting saved');
  };

  // Sync operations
  const handleSync = async (direction: 'push' | 'pull' | 'both') => {
    setSyncing(true);
    setSyncStatus('syncing');

    try {
      const result = await window.electronAPI.db.sync(direction);

      if (result.success) {
        setSyncStatus('success');
        if (result.lastSync) {
          setLastSync(result.lastSync);
          await window.electronAPI.store.set('lastSync', result.lastSync);
        }
        toast.success(
          direction === 'push'
            ? 'Data pushed to cloud'
            : direction === 'pull'
            ? 'Data pulled from cloud'
            : 'Sync completed'
        );
      } else {
        setSyncStatus('error');
        toast.error(result.error || 'Sync failed');
      }
    } catch (error) {
      setSyncStatus('error');
      toast.error('Sync failed. Check your connection.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleExportData = async () => {
    try {
      const result = await window.electronAPI.db.export();

      if (result.canceled) return;

      if (result.success && result.path) {
        toast.success('Database exported successfully');
        await window.electronAPI.shell.openPath(result.path);
      } else {
        toast.error(result.error || 'Export failed');
      }
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleImportData = async () => {
    try {
      const result = await window.electronAPI.db.import();

      if (result.canceled) return;

      if (result.success) {
        toast.success(`Data imported from ${result.imported}`);
      } else {
        toast.error(result.error || 'Import failed');
      }
    } catch (error) {
      toast.error('Import failed');
    }
  };

  const handleSelectBackupPath = async () => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        title: 'Select Backup Location',
        properties: ['openDirectory'],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        await handleSettingChange('backupPath', result.filePaths[0]);
      }
    } catch (error) {
      toast.error('Failed to select folder');
    }
  };

  const handleCheckUpdates = async () => {
    try {
      await window.electronAPI.app.checkForUpdates();
      toast.success('Checking for updates...');
    } catch (error) {
      toast.error('Failed to check for updates');
    }
  };

  // Get sync status icon
  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <Loader2 className="w-5 h-5 animate-spin" style={{ color: ECHO_COLORS.echoOrange }} />;
      case 'success':
        return <CheckCircle className="w-5 h-5" style={{ color: '#22c55e' }} />;
      case 'error':
        return <XCircle className="w-5 h-5" style={{ color: '#ef4444' }} />;
      default:
        return isOffline ? (
          <CloudOff className="w-5 h-5" style={{ color: ECHO_COLORS.textSecondary }} />
        ) : (
          <Cloud className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
        );
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: ECHO_COLORS.echoBlack }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1
          className="text-2xl font-bold"
          style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Orbitron, sans-serif' }}
        >
          Settings
        </h1>
        <p style={{ color: ECHO_COLORS.textSecondary }}>
          Configure your app preferences and manage data
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <GlassCard className="p-2">
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                  style={{
                    background:
                      activeSection === section.id
                        ? 'rgba(139, 0, 139, 0.3)'
                        : 'transparent',
                    color: ECHO_COLORS.textPrimary,
                  }}
                >
                  <section.icon
                    className="w-5 h-5"
                    style={{
                      color:
                        activeSection === section.id
                          ? ECHO_COLORS.echoOrange
                          : ECHO_COLORS.textSecondary,
                    }}
                  />
                  <span className="font-medium">{section.title}</span>
                </button>
              ))}
            </nav>
          </GlassCard>

          {/* Sync Status Card */}
          <GlassCard className="p-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <span style={{ color: ECHO_COLORS.textSecondary }} className="text-sm">
                Sync Status
              </span>
              {getSyncStatusIcon()}
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: isOffline ? '#ef4444' : '#22c55e',
                }}
              />
              <span style={{ color: ECHO_COLORS.textPrimary }} className="text-sm">
                {isOffline ? 'Offline' : 'Connected'}
              </span>
            </div>
            {lastSync && (
              <p style={{ color: ECHO_COLORS.textSecondary }} className="text-xs mt-2">
                Last sync: {new Date(lastSync).toLocaleString()}
              </p>
            )}
          </GlassCard>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Appearance */}
          {activeSection === 'appearance' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <GlassCard className="p-6">
                <h2
                  className="text-lg font-semibold mb-6 flex items-center gap-2"
                  style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
                >
                  <Monitor className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                  Appearance
                </h2>

                <div className="space-y-6">
                  {/* Theme Selection */}
                  <div>
                    <label
                      className="block text-sm font-medium mb-3"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { value: 'light', label: 'Light', icon: Sun },
                        { value: 'dark', label: 'Dark', icon: Moon },
                        { value: 'system', label: 'System', icon: Monitor },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTheme(option.value as any)}
                          className="p-4 rounded-xl transition-all"
                          style={{
                            background:
                              theme === option.value
                                ? 'rgba(139, 0, 139, 0.3)'
                                : 'rgba(139, 0, 139, 0.1)',
                            border:
                              theme === option.value
                                ? `2px solid ${ECHO_COLORS.echoOrange}`
                                : '2px solid transparent',
                          }}
                        >
                          <option.icon
                            className="w-8 h-8 mx-auto mb-2"
                            style={{
                              color:
                                theme === option.value
                                  ? ECHO_COLORS.echoOrange
                                  : ECHO_COLORS.textSecondary,
                            }}
                          />
                          <p style={{ color: ECHO_COLORS.textPrimary }} className="font-medium text-sm">
                            {option.label}
                          </p>
                          {theme === option.value && (
                            <Check
                              className="w-4 h-4 mx-auto mt-2"
                              style={{ color: ECHO_COLORS.echoOrange }}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm mt-2" style={{ color: ECHO_COLORS.textSecondary }}>
                      Current theme: {resolvedTheme}
                    </p>
                  </div>

                  {/* Window Behavior */}
                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid rgba(139, 0, 139, 0.2)' }}
                  >
                    <h3 className="font-medium mb-4" style={{ color: ECHO_COLORS.textPrimary }}>
                      Window Behavior
                    </h3>

                    <div className="space-y-4">
                      {[
                        {
                          key: 'minimizeToTray',
                          title: 'Minimize to system tray',
                          desc: 'Keep the app running in the background',
                        },
                        {
                          key: 'startMinimized',
                          title: 'Start minimized',
                          desc: 'Start the app in the system tray',
                        },
                        {
                          key: 'startWithSystem',
                          title: 'Start with system',
                          desc: 'Launch when you log in',
                        },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                              {item.title}
                            </p>
                            <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                              {item.desc}
                            </p>
                          </div>
                          <ToggleSwitch
                            enabled={!!localSettings?.[item.key as keyof typeof localSettings]}
                            onChange={() =>
                              handleSettingChange(
                                item.key,
                                !localSettings?.[item.key as keyof typeof localSettings]
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Data Sync */}
          {activeSection === 'sync' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <GlassCard className="p-6">
                <h2
                  className="text-lg font-semibold mb-6 flex items-center gap-2"
                  style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
                >
                  <Cloud className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                  Data Sync
                </h2>

                <div className="space-y-6">
                  {/* Connection Status */}
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: isOffline ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                      border: isOffline
                        ? '1px solid rgba(239, 68, 68, 0.3)'
                        : '1px solid rgba(34, 197, 94, 0.3)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {isOffline ? (
                        <WifiOff className="w-6 h-6" style={{ color: '#ef4444' }} />
                      ) : (
                        <Wifi className="w-6 h-6" style={{ color: '#22c55e' }} />
                      )}
                      <div>
                        <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                          {isOffline ? 'Offline Mode' : 'Connected to Cloud'}
                        </p>
                        <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                          {isOffline
                            ? 'Changes will sync when connection is restored'
                            : 'All data is synced with the cloud'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sync Actions */}
                  <div>
                    <h3 className="font-medium mb-4" style={{ color: ECHO_COLORS.textPrimary }}>
                      Sync Actions
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <button
                        onClick={() => handleSync('pull')}
                        disabled={syncing || isOffline}
                        className="p-4 rounded-xl flex flex-col items-center gap-2 transition-colors disabled:opacity-50"
                        style={{
                          background: 'rgba(139, 0, 139, 0.1)',
                          border: '1px solid rgba(139, 0, 139, 0.3)',
                        }}
                      >
                        <ArrowDownCircle
                          className="w-8 h-8"
                          style={{ color: ECHO_COLORS.cobaltBlue }}
                        />
                        <span style={{ color: ECHO_COLORS.textPrimary }} className="font-medium">
                          Pull from Cloud
                        </span>
                        <span className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>
                          Download latest data
                        </span>
                      </button>

                      <button
                        onClick={() => handleSync('push')}
                        disabled={syncing || isOffline}
                        className="p-4 rounded-xl flex flex-col items-center gap-2 transition-colors disabled:opacity-50"
                        style={{
                          background: 'rgba(139, 0, 139, 0.1)',
                          border: '1px solid rgba(139, 0, 139, 0.3)',
                        }}
                      >
                        <ArrowUpCircle
                          className="w-8 h-8"
                          style={{ color: ECHO_COLORS.echoOrange }}
                        />
                        <span style={{ color: ECHO_COLORS.textPrimary }} className="font-medium">
                          Push to Cloud
                        </span>
                        <span className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>
                          Upload local changes
                        </span>
                      </button>

                      <button
                        onClick={() => handleSync('both')}
                        disabled={syncing || isOffline}
                        className="p-4 rounded-xl flex flex-col items-center gap-2 transition-colors disabled:opacity-50"
                        style={{
                          background: `linear-gradient(135deg, ${ECHO_COLORS.echoOrange}20, ${ECHO_COLORS.darkMagenta}20)`,
                          border: '1px solid rgba(255, 107, 53, 0.3)',
                        }}
                      >
                        <RefreshCw
                          className={`w-8 h-8 ${syncing ? 'animate-spin' : ''}`}
                          style={{ color: ECHO_COLORS.echoOrange }}
                        />
                        <span style={{ color: ECHO_COLORS.textPrimary }} className="font-medium">
                          Full Sync
                        </span>
                        <span className="text-xs" style={{ color: ECHO_COLORS.textSecondary }}>
                          Merge all changes
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Auto Sync Settings */}
                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid rgba(139, 0, 139, 0.2)' }}
                  >
                    <h3 className="font-medium mb-4" style={{ color: ECHO_COLORS.textPrimary }}>
                      Auto Sync
                    </h3>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                            Enable auto sync
                          </p>
                          <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                            Automatically sync changes in the background
                          </p>
                        </div>
                        <ToggleSwitch
                          enabled={!!localSettings?.autoSync}
                          onChange={() =>
                            handleSettingChange('autoSync', !localSettings?.autoSync)
                          }
                        />
                      </div>

                      <div>
                        <label
                          className="block text-sm font-medium mb-2"
                          style={{ color: ECHO_COLORS.textSecondary }}
                        >
                          Sync interval
                        </label>
                        <select
                          value={localSettings?.syncInterval || '5'}
                          onChange={(e) =>
                            handleSettingChange('syncInterval', e.target.value)
                          }
                          disabled={!localSettings?.autoSync}
                          className="w-full px-4 py-3 rounded-xl outline-none disabled:opacity-50"
                          style={{
                            background: 'rgba(139, 0, 139, 0.1)',
                            border: '1px solid rgba(139, 0, 139, 0.3)',
                            color: ECHO_COLORS.textPrimary,
                          }}
                        >
                          <option value="1">Every minute</option>
                          <option value="5">Every 5 minutes</option>
                          <option value="15">Every 15 minutes</option>
                          <option value="30">Every 30 minutes</option>
                          <option value="60">Every hour</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                            Sync on startup
                          </p>
                          <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                            Sync data when app starts
                          </p>
                        </div>
                        <ToggleSwitch
                          enabled={!!localSettings?.syncOnStartup}
                          onChange={() =>
                            handleSettingChange('syncOnStartup', !localSettings?.syncOnStartup)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sync History */}
                  {lastSync && (
                    <div
                      className="p-4 rounded-xl"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.2)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4" style={{ color: ECHO_COLORS.echoOrange }} />
                        <span className="text-sm font-medium" style={{ color: ECHO_COLORS.textSecondary }}>
                          Last Sync
                        </span>
                      </div>
                      <p style={{ color: ECHO_COLORS.textPrimary }}>
                        {new Date(lastSync).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <GlassCard className="p-6">
                <h2
                  className="text-lg font-semibold mb-6 flex items-center gap-2"
                  style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
                >
                  <Bell className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                  Notifications
                </h2>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                        Enable notifications
                      </p>
                      <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                        Receive desktop notifications
                      </p>
                    </div>
                    <ToggleSwitch
                      enabled={!!localSettings?.notifications}
                      onChange={() =>
                        handleSettingChange('notifications', !localSettings?.notifications)
                      }
                    />
                  </div>

                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid rgba(139, 0, 139, 0.2)' }}
                  >
                    <h3 className="font-medium mb-4" style={{ color: ECHO_COLORS.textPrimary }}>
                      Notify me about:
                    </h3>

                    <div className="space-y-3">
                      {[
                        'New bookings',
                        'Check-ins today',
                        'Check-outs today',
                        'Pending cleanings',
                        'Low battery on smart locks',
                        'Payment received',
                        'Guest messages',
                        'Sync failures',
                      ].map((item) => (
                        <label
                          key={item}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            defaultChecked
                            className="w-4 h-4 rounded"
                            style={{
                              accentColor: ECHO_COLORS.echoOrange,
                            }}
                          />
                          <span style={{ color: ECHO_COLORS.textPrimary }} className="text-sm">
                            {item}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Test Notification */}
                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid rgba(139, 0, 139, 0.2)' }}
                  >
                    <button
                      onClick={() =>
                        window.electronAPI.notification.show(
                          'Test Notification',
                          'This is a test notification from Right at Home BnB'
                        )
                      }
                      className="px-4 py-2 rounded-xl font-medium transition-colors"
                      style={{
                        background: 'rgba(139, 0, 139, 0.2)',
                        color: ECHO_COLORS.textPrimary,
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                      }}
                    >
                      Send Test Notification
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Data & Backup */}
          {activeSection === 'data' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <GlassCard className="p-6">
                <h2
                  className="text-lg font-semibold mb-6 flex items-center gap-2"
                  style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
                >
                  <Database className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                  Data & Backup
                </h2>

                <div className="space-y-6">
                  {/* Export/Import */}
                  <div>
                    <h3 className="font-medium mb-4" style={{ color: ECHO_COLORS.textPrimary }}>
                      Data Management
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      <button
                        onClick={handleExportData}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors"
                        style={{
                          background: 'rgba(139, 0, 139, 0.2)',
                          color: ECHO_COLORS.textPrimary,
                          border: '1px solid rgba(139, 0, 139, 0.3)',
                        }}
                      >
                        <Download className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                        Export Database
                      </button>
                      <button
                        onClick={handleImportData}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors"
                        style={{
                          background: 'rgba(139, 0, 139, 0.2)',
                          color: ECHO_COLORS.textPrimary,
                          border: '1px solid rgba(139, 0, 139, 0.3)',
                        }}
                      >
                        <Upload className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                        Import Database
                      </button>
                    </div>
                  </div>

                  {/* Backup Location */}
                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid rgba(139, 0, 139, 0.2)' }}
                  >
                    <h3 className="font-medium mb-4" style={{ color: ECHO_COLORS.textPrimary }}>
                      Backup Location
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={localSettings?.backupPath || 'Not configured'}
                        readOnly
                        className="flex-1 px-4 py-3 rounded-xl outline-none"
                        style={{
                          background: 'rgba(139, 0, 139, 0.1)',
                          border: '1px solid rgba(139, 0, 139, 0.3)',
                          color: ECHO_COLORS.textPrimary,
                        }}
                      />
                      <button
                        onClick={handleSelectBackupPath}
                        className="px-4 py-3 rounded-xl transition-colors"
                        style={{
                          background: 'rgba(139, 0, 139, 0.2)',
                          border: '1px solid rgba(139, 0, 139, 0.3)',
                          color: ECHO_COLORS.textPrimary,
                        }}
                      >
                        <Folder className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                      </button>
                    </div>
                    <p className="text-sm mt-2" style={{ color: ECHO_COLORS.textSecondary }}>
                      Automatic backups will be saved to this location
                    </p>
                  </div>

                  {/* Auto Backup */}
                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid rgba(139, 0, 139, 0.2)' }}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                            Auto backup
                          </p>
                          <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                            Automatically backup data daily
                          </p>
                        </div>
                        <ToggleSwitch
                          enabled={!!localSettings?.autoBackup}
                          onChange={() =>
                            handleSettingChange('autoBackup', !localSettings?.autoBackup)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                            Offline mode
                          </p>
                          <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                            Work without internet connection
                          </p>
                        </div>
                        <ToggleSwitch
                          enabled={!!localSettings?.offlineMode}
                          onChange={() =>
                            handleSettingChange('offlineMode', !localSettings?.offlineMode)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Database Info */}
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: 'rgba(139, 0, 139, 0.1)',
                      border: '1px solid rgba(139, 0, 139, 0.2)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <HardDrive className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                      <span className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                        Local Database
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span style={{ color: ECHO_COLORS.textSecondary }}>Type</span>
                        <span style={{ color: ECHO_COLORS.textPrimary }}>SQLite</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: ECHO_COLORS.textSecondary }}>Location</span>
                        <span style={{ color: ECHO_COLORS.textPrimary }}>rightathome.db</span>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Security */}
          {activeSection === 'security' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <GlassCard className="p-6">
                <h2
                  className="text-lg font-semibold mb-6 flex items-center gap-2"
                  style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
                >
                  <Shield className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                  Security
                </h2>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                        Require password on startup
                      </p>
                      <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                        Lock the app when starting
                      </p>
                    </div>
                    <ToggleSwitch
                      enabled={!!localSettings?.requirePassword}
                      onChange={() =>
                        handleSettingChange('requirePassword', !localSettings?.requirePassword)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                        Auto-lock on idle
                      </p>
                      <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                        Lock after 15 minutes of inactivity
                      </p>
                    </div>
                    <ToggleSwitch
                      enabled={!!localSettings?.autoLock}
                      onChange={() =>
                        handleSettingChange('autoLock', !localSettings?.autoLock)
                      }
                    />
                  </div>

                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid rgba(139, 0, 139, 0.2)' }}
                  >
                    <button
                      className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors"
                      style={{
                        background: 'rgba(139, 0, 139, 0.2)',
                        color: ECHO_COLORS.textPrimary,
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                      }}
                    >
                      <Key className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                      Change Password
                    </button>
                  </div>

                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="w-6 h-6" style={{ color: '#22c55e' }} />
                      <div>
                        <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                          Data Encryption
                        </p>
                        <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                          All sensitive data is encrypted at rest using AES-256
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Preferences */}
          {activeSection === 'preferences' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <GlassCard className="p-6">
                <h2
                  className="text-lg font-semibold mb-6 flex items-center gap-2"
                  style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
                >
                  <Globe className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                  Preferences
                </h2>

                <div className="space-y-6">
                  {/* Currency */}
                  <div>
                    <label
                      className="flex items-center gap-2 text-sm font-medium mb-2"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      <DollarSign className="w-4 h-4" />
                      Currency
                    </label>
                    <select
                      value={localSettings?.currency || 'USD'}
                      onChange={(e) => handleSettingChange('currency', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (E)</option>
                      <option value="GBP">GBP (P)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="MXN">MXN ($)</option>
                    </select>
                  </div>

                  {/* Timezone */}
                  <div>
                    <label
                      className="flex items-center gap-2 text-sm font-medium mb-2"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      <Clock className="w-4 h-4" />
                      Timezone
                    </label>
                    <select
                      value={localSettings?.timezone || 'America/Chicago'}
                      onChange={(e) => handleSettingChange('timezone', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    >
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="America/Phoenix">Arizona (MST)</option>
                    </select>
                  </div>

                  {/* Date Format */}
                  <div>
                    <label
                      className="flex items-center gap-2 text-sm font-medium mb-2"
                      style={{ color: ECHO_COLORS.textSecondary }}
                    >
                      <Calendar className="w-4 h-4" />
                      Date Format
                    </label>
                    <select
                      value={localSettings?.dateFormat || 'MM/dd/yyyy'}
                      onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      style={{
                        background: 'rgba(139, 0, 139, 0.1)',
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                        color: ECHO_COLORS.textPrimary,
                      }}
                    >
                      <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                      <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                      <option value="yyyy-MM-dd">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* About */}
          {activeSection === 'about' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <GlassCard className="p-6">
                <h2
                  className="text-lg font-semibold mb-6 flex items-center gap-2"
                  style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Rajdhani, sans-serif' }}
                >
                  <Info className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                  About
                </h2>

                <div className="space-y-6">
                  {/* App Info */}
                  <div className="text-center py-6">
                    <div
                      className="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{
                        background: `linear-gradient(135deg, ${ECHO_COLORS.echoOrange}30, ${ECHO_COLORS.darkMagenta}30)`,
                        border: `1px solid ${ECHO_COLORS.darkMagenta}50`,
                      }}
                    >
                      <span
                        className="text-3xl font-bold italic"
                        style={{ color: ECHO_COLORS.echoOrange }}
                      >
                        RAH
                      </span>
                    </div>
                    <h3
                      className="text-xl font-semibold"
                      style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'Orbitron, sans-serif' }}
                    >
                      Right at Home BnB
                    </h3>
                    <p style={{ color: ECHO_COLORS.textSecondary }} className="mt-1">
                      Desktop Property Management
                    </p>
                    <p className="text-sm mt-2" style={{ color: ECHO_COLORS.textSecondary }}>
                      Version {appInfo?.version || '1.0.0'}
                    </p>
                  </div>

                  {/* System Info */}
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: 'rgba(139, 0, 139, 0.1)',
                      border: '1px solid rgba(139, 0, 139, 0.2)',
                    }}
                  >
                    <h4 className="font-medium mb-3" style={{ color: ECHO_COLORS.textPrimary }}>
                      System Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      {[
                        { label: 'Platform', value: appInfo?.platform },
                        { label: 'Electron', value: appInfo?.electron || 'N/A' },
                        { label: 'Chrome', value: appInfo?.chrome || 'N/A' },
                        { label: 'Node.js', value: appInfo?.node || 'N/A' },
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between">
                          <span style={{ color: ECHO_COLORS.textSecondary }}>{item.label}</span>
                          <span
                            style={{ color: ECHO_COLORS.textPrimary, fontFamily: 'JetBrains Mono' }}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Updates */}
                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid rgba(139, 0, 139, 0.2)' }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-medium" style={{ color: ECHO_COLORS.textPrimary }}>
                          Auto-update
                        </p>
                        <p className="text-sm" style={{ color: ECHO_COLORS.textSecondary }}>
                          Automatically download updates
                        </p>
                      </div>
                      <ToggleSwitch
                        enabled={!!localSettings?.autoUpdate}
                        onChange={() =>
                          handleSettingChange('autoUpdate', !localSettings?.autoUpdate)
                        }
                      />
                    </div>
                    <button
                      onClick={handleCheckUpdates}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors"
                      style={{
                        background: 'rgba(139, 0, 139, 0.2)',
                        color: ECHO_COLORS.textPrimary,
                        border: '1px solid rgba(139, 0, 139, 0.3)',
                      }}
                    >
                      <RefreshCw className="w-5 h-5" style={{ color: ECHO_COLORS.echoOrange }} />
                      Check for Updates
                    </button>
                  </div>

                  {/* Links */}
                  <div
                    className="pt-6 space-y-2"
                    style={{ borderTop: '1px solid rgba(139, 0, 139, 0.2)' }}
                  >
                    {[
                      { label: 'Documentation', url: 'https://docs.rah-midland.com' },
                      { label: 'Contact Support', url: 'mailto:support@rah-midland.com' },
                      { label: 'Privacy Policy', url: 'https://rah-midland.com/privacy' },
                    ].map((link) => (
                      <button
                        key={link.label}
                        onClick={() => window.electronAPI.shell.openExternal(link.url)}
                        className="w-full flex items-center justify-between p-3 rounded-xl transition-colors"
                        style={{ color: ECHO_COLORS.textPrimary }}
                      >
                        <span>{link.label}</span>
                        <ExternalLink className="w-4 h-4" style={{ color: ECHO_COLORS.textSecondary }} />
                      </button>
                    ))}
                  </div>

                  {/* Copyright */}
                  <p
                    className="text-center text-sm pt-4"
                    style={{ color: ECHO_COLORS.textSecondary }}
                  >
                    &copy; 2024 Steven Palma. All rights reserved.
                    <br />
                    <span style={{ color: ECHO_COLORS.echoOrange }}>Gig &apos;Em Aggies!</span>
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
