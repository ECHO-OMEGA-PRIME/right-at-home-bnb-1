'use client';

/**
 * Right at Home BnB - Dashboard Layout
 * Sidebar navigation and main content area
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Building2, Users, Sparkles, Key, MessageSquare,
  DollarSign, Settings, LogOut, Menu, X, ChevronLeft,
  Bell, Search, User, ClipboardCheck, Bot, Calendar
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Properties', href: '/properties', icon: Building2 },
  { name: 'Bookings', href: '/bookings', icon: Calendar },
  { name: 'Guests', href: '/guests', icon: Users },
  { name: 'Steven AI', href: '/steven', icon: Bot },
  { name: 'Cleaning Jobs', href: '/cleaning', icon: ClipboardCheck },
  { name: 'Cleaners', href: '/cleaners', icon: Sparkles },
  { name: 'Smart Locks', href: '/locks', icon: Key },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Finance', href: '/finance', icon: DollarSign },
];

const secondaryNav = [
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 80 }}
        className={`fixed top-0 left-0 h-full bg-white border-r border-[#2D2D2D]/10 z-50 hidden lg:block`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-[#2D2D2D]/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#500000] flex items-center justify-center flex-shrink-0">
                <Home className="w-5 h-5 text-[#C4A777]" />
              </div>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden"
                  >
                    <h1 className="text-lg font-['Playfair_Display'] font-semibold text-[#500000] whitespace-nowrap">
                      Right at Home
                    </h1>
                    <p className="text-xs text-[#C4A777]">Midland, TX</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href));

                return (
                  <Link key={item.name} href={item.href}>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-[#500000] text-white'
                          : 'text-[#2D2D2D]/70 hover:bg-[#500000]/10 hover:text-[#500000]'
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <AnimatePresence>
                        {sidebarOpen && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            className="font-medium whitespace-nowrap overflow-hidden"
                          >
                            {item.name}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 pt-4 border-t border-[#2D2D2D]/10">
              {secondaryNav.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link key={item.name} href={item.href}>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-[#500000] text-white'
                          : 'text-[#2D2D2D]/70 hover:bg-[#500000]/10 hover:text-[#500000]'
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <AnimatePresence>
                        {sidebarOpen && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            className="font-medium whitespace-nowrap overflow-hidden"
                          >
                            {item.name}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-[#2D2D2D]/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center text-white font-semibold flex-shrink-0">
                SP
              </div>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 overflow-hidden"
                  >
                    <div className="font-medium text-[#2D2D2D] whitespace-nowrap">Steven Palma</div>
                    <div className="text-xs text-[#2D2D2D]/60 whitespace-nowrap">Administrator</div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-2 text-[#2D2D2D]/40 hover:text-red-500 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute -right-3 top-8 w-6 h-6 bg-white border border-[#2D2D2D]/10 rounded-full flex items-center justify-center shadow-sm hover:bg-[#F5F5F0] transition-colors"
          >
            <ChevronLeft className={`w-4 h-4 text-[#2D2D2D]/60 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed top-0 left-0 w-72 h-full bg-white z-50 lg:hidden"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#2D2D2D]/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#500000] flex items-center justify-center">
                    <Home className="w-5 h-5 text-[#C4A777]" />
                  </div>
                  <div>
                    <h1 className="text-lg font-['Playfair_Display'] font-semibold text-[#500000]">
                      Right at Home
                    </h1>
                    <p className="text-xs text-[#C4A777]">Midland, TX</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-[#2D2D2D]/60 hover:text-[#500000]"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-3 py-4 overflow-y-auto">
                {navigation.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/dashboard' && pathname?.startsWith(item.href));

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl mb-1 ${
                          isActive
                            ? 'bg-[#500000] text-white'
                            : 'text-[#2D2D2D]/70 hover:bg-[#500000]/10'
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* User */}
              <div className="p-4 border-t border-[#2D2D2D]/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center text-white font-semibold">
                    SP
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-[#2D2D2D]">Steven Palma</div>
                    <div className="text-xs text-[#2D2D2D]/60">Administrator</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <motion.main
        initial={false}
        animate={{ marginLeft: sidebarOpen ? 280 : 80 }}
        className="min-h-screen transition-all hidden lg:block"
      >
        {children}
      </motion.main>

      {/* Mobile Main Content */}
      <main className="lg:hidden">
        {/* Mobile Header */}
        <header className="sticky top-0 bg-white border-b border-[#2D2D2D]/10 z-30">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-[#500000]"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#500000] flex items-center justify-center">
                <Home className="w-4 h-4 text-[#C4A777]" />
              </div>
              <span className="font-['Playfair_Display'] font-semibold text-[#500000]">
                Right at Home
              </span>
            </div>

            <button className="p-2 text-[#500000]">
              <Bell className="w-6 h-6" />
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
