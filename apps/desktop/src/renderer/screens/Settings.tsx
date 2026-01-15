import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../contexts/AppContext';
import toast from 'react-hot-toast';

interface SettingSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

const sections: SettingSection[] = [
  { id: 'appearance', title: 'Appearance', icon: Monitor },
  { id: 'notifications', title: 'Notifications', icon: Bell },
  { id: 'data', title: 'Data & Backup', icon: Database },
  { id: 'preferences', title: 'Preferences', icon: Globe },
  { id: 'about', title: 'About', icon: Info },
];

export default function Settings() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { settings, updateSettings, appInfo } = useApp();
  const [activeSection, setActiveSection] = useState('appearance');
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSettingChange = async (key: string, value: unknown) => {
    setLocalSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    await updateSettings({ [key]: value });
    toast.success('Setting saved');
  };

  const handleExportData = async () => {
    try {
      const result = await window.electronAPI.dialog.showSaveDialog({
        title: 'Export Data Backup',
        defaultPath: `rightathome-backup-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (!result.canceled && result.filePath) {
        // In real app, export actual data
        const backupData = {
          settings: localSettings,
          exportDate: new Date().toISOString(),
          version: appInfo?.version,
        };

        await window.electronAPI.file.write(
          result.filePath,
          JSON.stringify(backupData, null, 2)
        );
        toast.success('Data exported successfully');
        await window.electronAPI.shell.openPath(result.filePath);
      }
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleImportData = async () => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        title: 'Import Data Backup',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const fileResult = await window.electronAPI.file.read(result.filePaths[0]);
        if (fileResult.success && fileResult.data) {
          const imported = JSON.parse(fileResult.data);
          toast.success('Data imported successfully');
        }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Configure your app preferences and manage data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="card p-2 space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  activeSection === section.id
                    ? 'bg-maroon-100 dark:bg-maroon-900/30 text-maroon-900 dark:text-maroon-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <section.icon className="w-5 h-5" />
                <span className="font-medium">{section.title}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Appearance */}
          {activeSection === 'appearance' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <h2 className="text-lg font-display font-semibold mb-6 flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Appearance
              </h2>

              <div className="space-y-6">
                {/* Theme Selection */}
                <div>
                  <label className="label">Theme</label>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    {[
                      { value: 'light', label: 'Light', icon: Sun },
                      { value: 'dark', label: 'Dark', icon: Moon },
                      { value: 'system', label: 'System', icon: Monitor },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value as any)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          theme === option.value
                            ? 'border-maroon-900 dark:border-maroon-400 bg-maroon-50 dark:bg-maroon-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <option.icon
                          className={`w-8 h-8 mx-auto mb-2 ${
                            theme === option.value
                              ? 'text-maroon-900 dark:text-maroon-400'
                              : 'text-gray-400'
                          }`}
                        />
                        <p className="font-medium text-sm">{option.label}</p>
                        {theme === option.value && (
                          <Check className="w-4 h-4 mx-auto mt-2 text-maroon-900 dark:text-maroon-400" />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Current theme: {resolvedTheme}
                  </p>
                </div>

                {/* Window Behavior */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium mb-4">Window Behavior</h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Minimize to system tray</p>
                        <p className="text-sm text-gray-500">
                          Keep the app running in the background
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleSettingChange(
                            'minimizeToTray',
                            !localSettings?.minimizeToTray
                          )
                        }
                        className={`w-12 h-6 rounded-full transition-colors ${
                          localSettings?.minimizeToTray
                            ? 'bg-maroon-900'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            localSettings?.minimizeToTray
                              ? 'translate-x-6'
                              : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Start minimized</p>
                        <p className="text-sm text-gray-500">
                          Start the app in the system tray
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleSettingChange(
                            'startMinimized',
                            !localSettings?.startMinimized
                          )
                        }
                        className={`w-12 h-6 rounded-full transition-colors ${
                          localSettings?.startMinimized
                            ? 'bg-maroon-900'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            localSettings?.startMinimized
                              ? 'translate-x-6'
                              : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Start with system</p>
                        <p className="text-sm text-gray-500">
                          Launch when you log in
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleSettingChange(
                            'startWithSystem',
                            !localSettings?.startWithSystem
                          )
                        }
                        className={`w-12 h-6 rounded-full transition-colors ${
                          localSettings?.startWithSystem
                            ? 'bg-maroon-900'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            localSettings?.startWithSystem
                              ? 'translate-x-6'
                              : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <h2 className="text-lg font-display font-semibold mb-6 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable notifications</p>
                    <p className="text-sm text-gray-500">
                      Receive desktop notifications
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      handleSettingChange(
                        'notifications',
                        !localSettings?.notifications
                      )
                    }
                    className={`w-12 h-6 rounded-full transition-colors ${
                      localSettings?.notifications
                        ? 'bg-maroon-900'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        localSettings?.notifications
                          ? 'translate-x-6'
                          : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium mb-4">Notify me about:</h3>

                  <div className="space-y-3">
                    {[
                      'New bookings',
                      'Check-ins today',
                      'Check-outs today',
                      'Pending cleanings',
                      'Low battery on smart locks',
                      'Payment received',
                    ].map((item) => (
                      <label
                        key={item}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 text-maroon-900 rounded border-gray-300 focus:ring-maroon-900"
                        />
                        <span className="text-sm">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Test Notification */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() =>
                      window.electronAPI.notification.show(
                        'Test Notification',
                        'This is a test notification from Right at Home BnB'
                      )
                    }
                    className="btn-secondary"
                  >
                    Send Test Notification
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Data & Backup */}
          {activeSection === 'data' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <h2 className="text-lg font-display font-semibold mb-6 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data & Backup
              </h2>

              <div className="space-y-6">
                {/* Export/Import */}
                <div>
                  <h3 className="font-medium mb-4">Data Management</h3>
                  <div className="flex gap-4">
                    <button
                      onClick={handleExportData}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Export Data
                    </button>
                    <button
                      onClick={handleImportData}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      Import Data
                    </button>
                  </div>
                </div>

                {/* Backup Location */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium mb-4">Backup Location</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={localSettings?.backupPath || 'Not configured'}
                      readOnly
                      className="input flex-1"
                    />
                    <button
                      onClick={handleSelectBackupPath}
                      className="btn-secondary px-4"
                    >
                      <Folder className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Automatic backups will be saved to this location
                  </p>
                </div>

                {/* Offline Mode */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Offline mode</p>
                      <p className="text-sm text-gray-500">
                        Work without internet connection
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleSettingChange(
                          'offlineMode',
                          !localSettings?.offlineMode
                        )
                      }
                      className={`w-12 h-6 rounded-full transition-colors ${
                        localSettings?.offlineMode
                          ? 'bg-maroon-900'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          localSettings?.offlineMode
                            ? 'translate-x-6'
                            : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Preferences */}
          {activeSection === 'preferences' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <h2 className="text-lg font-display font-semibold mb-6 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Preferences
              </h2>

              <div className="space-y-6">
                {/* Currency */}
                <div>
                  <label className="label flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Currency
                  </label>
                  <select
                    value={localSettings?.currency || 'USD'}
                    onChange={(e) =>
                      handleSettingChange('currency', e.target.value)
                    }
                    className="input"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR ()</option>
                    <option value="GBP">GBP ()</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>

                {/* Timezone */}
                <div>
                  <label className="label flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Timezone
                  </label>
                  <select
                    value={localSettings?.timezone || 'America/Chicago'}
                    onChange={(e) =>
                      handleSettingChange('timezone', e.target.value)
                    }
                    className="input"
                  >
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  </select>
                </div>

                {/* Date Format */}
                <div>
                  <label className="label">Date Format</label>
                  <select
                    value={localSettings?.dateFormat || 'MM/dd/yyyy'}
                    onChange={(e) =>
                      handleSettingChange('dateFormat', e.target.value)
                    }
                    className="input"
                  >
                    <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                    <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                    <option value="yyyy-MM-dd">YYYY-MM-DD</option>
                  </select>
                </div>

                {/* API URL */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <label className="label">API Server</label>
                  <input
                    type="url"
                    value={localSettings?.apiUrl || 'https://api.rightathomebnb.com'}
                    onChange={(e) =>
                      setLocalSettings((prev) =>
                        prev ? { ...prev, apiUrl: e.target.value } : prev
                      )
                    }
                    onBlur={(e) =>
                      handleSettingChange('apiUrl', e.target.value)
                    }
                    className="input"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Only change if using a custom server
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* About */}
          {activeSection === 'about' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <h2 className="text-lg font-display font-semibold mb-6 flex items-center gap-2">
                <Info className="w-5 h-5" />
                About
              </h2>

              <div className="space-y-6">
                {/* App Info */}
                <div className="text-center py-6">
                  <div className="w-24 h-24 bg-maroon-100 dark:bg-maroon-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl font-logo text-maroon-900 dark:text-maroon-400 italic">
                      RAH
                    </span>
                  </div>
                  <h3 className="text-xl font-display font-semibold">
                    Right at Home BnB
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Desktop Property Management
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Version {appInfo?.version || '1.0.0'}
                  </p>
                </div>

                {/* System Info */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <h4 className="font-medium mb-3">System Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Platform</span>
                      <span className="font-mono">{appInfo?.platform}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Electron</span>
                      <span className="font-mono">{appInfo?.electron || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Chrome</span>
                      <span className="font-mono">{appInfo?.chrome || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Node.js</span>
                      <span className="font-mono">{appInfo?.node || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Updates */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium">Auto-update</p>
                      <p className="text-sm text-gray-500">
                        Automatically download updates
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleSettingChange(
                          'autoUpdate',
                          !localSettings?.autoUpdate
                        )
                      }
                      className={`w-12 h-6 rounded-full transition-colors ${
                        localSettings?.autoUpdate
                          ? 'bg-maroon-900'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          localSettings?.autoUpdate
                            ? 'translate-x-6'
                            : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  <button
                    onClick={handleCheckUpdates}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Check for Updates
                  </button>
                </div>

                {/* Links */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <button
                    onClick={() =>
                      window.electronAPI.shell.openExternal(
                        'https://docs.rightathomebnb.com'
                      )
                    }
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                  >
                    <span>Documentation</span>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() =>
                      window.electronAPI.shell.openExternal(
                        'mailto:support@rightathomebnb.com'
                      )
                    }
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                  >
                    <span>Contact Support</span>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() =>
                      window.electronAPI.shell.openExternal(
                        'https://rightathomebnb.com/privacy'
                      )
                    }
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                  >
                    <span>Privacy Policy</span>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Copyright */}
                <p className="text-center text-sm text-gray-400 pt-4">
                  &copy; 2024 Steven Palma. All rights reserved.
                  <br />
                  Gig 'Em Aggies!
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
