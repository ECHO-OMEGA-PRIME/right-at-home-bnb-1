import React, { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Home,
  Users,
  Calendar,
  DollarSign,
  Lock,
  Settings,
  Bell,
  Moon,
  Sun,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../contexts/AppContext';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/properties', icon: Home, label: 'Properties' },
  { path: '/guests', icon: Users, label: 'Guests' },
  { path: '/cleaning', icon: Calendar, label: 'Cleaning Schedule' },
  { path: '/finance', icon: DollarSign, label: 'Finance' },
  { path: '/locks', icon: Lock, label: 'Smart Locks' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { stats, refreshData, isOffline, appInfo } = useApp();

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-maroon-900 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-white/10">
          <h1 className="text-2xl font-logo text-white italic tracking-wider">
            RAH
          </h1>
          <span className="ml-2 text-xs text-white/60 uppercase tracking-widest">
            BnB
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="ml-auto"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </motion.div>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Quick Stats */}
        {stats && (
          <div className="p-4 border-t border-white/10">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-xs uppercase tracking-wider mb-2">
                Today
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-white/80">
                  <span>Check-ins</span>
                  <span className="font-semibold text-white">
                    {stats.todayCheckIns}
                  </span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Check-outs</span>
                  <span className="font-semibold text-white">
                    {stats.todayCheckOuts}
                  </span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Cleanings</span>
                  <span className="font-semibold text-white">
                    {stats.pendingCleanings}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Version */}
        <div className="p-4 border-t border-white/10">
          <p className="text-white/40 text-xs text-center">
            v{appInfo?.version || '1.0.0'}
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
          {/* Page Title */}
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-display font-semibold text-gray-900 dark:text-white">
              {navItems.find((item) => item.path === location.pathname)?.label ||
                'Dashboard'}
            </h2>
            {isOffline && (
              <span className="badge badge-warning">Offline Mode</span>
            )}
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              className="btn-ghost p-2 rounded-lg"
              title="Refresh data"
            >
              <RefreshCw className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>

            <button
              onClick={() =>
                window.electronAPI.notification.show(
                  'Test Notification',
                  'This is a test notification from Right at Home BnB'
                )
              }
              className="btn-ghost p-2 rounded-lg relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-maroon-900 rounded-full" />
            </button>

            <button
              onClick={toggleTheme}
              className="btn-ghost p-2 rounded-lg"
              title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-500" />
              )}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
