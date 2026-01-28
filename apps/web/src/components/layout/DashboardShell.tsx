'use client';

/**
 * Right at Home BnB - Dashboard Shell Component
 * Reusable sidebar navigation layout for all authenticated pages
 * Supports role-based navigation (guest, worker, admin, owner)
 */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Building2, Users, Sparkles, Key, MessageSquare,
  DollarSign, Settings, LogOut, Menu, X, ChevronLeft,
  Bell, Calendar, Bot, ClipboardCheck, BarChart3, Globe,
  Smartphone, Phone, UserCircle, Shield, Package, Wrench
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getNavigationForRole,
  filterNavByPermissions,
  getRoleDisplayName,
  getRoleBadgeColor,
  NavSection,
  NavItem
} from '@/lib/navigation';

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const { user, appUser, signOut, isOwner, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get role-based navigation
  const userRole = appUser?.role || 'guest';
  const { main: mainNav, secondary: secondaryNav } = getNavigationForRole(userRole);
  const filteredNav = filterNavByPermissions(mainNav, userRole);

  // Get user initials
  const getUserInitials = () => {
    if (appUser?.displayName) {
      return appUser.displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

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

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 80 }}
        className="fixed top-0 left-0 h-full bg-white border-r border-[#2D2D2D]/10 z-50 hidden lg:block"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-[#2D2D2D]/10">
            <Link href="/dashboard">
              <AnimatePresence mode="wait">
                {sidebarOpen ? (
                  <motion.div
                    key="full-logo"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-center"
                  >
                    <Image
                      src="/images/logo-dark.png"
                      alt="Right at Home Midland"
                      width={200}
                      height={85}
                      className="w-full max-w-[200px] h-auto"
                      priority
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="mini-logo"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#500000] flex items-center justify-center">
                      <Home className="w-5 h-5 text-[#C4A777]" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {filteredNav.map((section, sectionIndex) => (
              <div key={section.title || sectionIndex} className="mb-6">
                {section.title && sidebarOpen && (
                  <h3 className="px-3 mb-2 text-xs font-semibold text-[#2D2D2D]/40 uppercase tracking-wider">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href ||
                      (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                    const Icon = item.icon;

                    return (
                      <Link key={item.name} href={item.href}>
                        <motion.div
                          whileHover={{ x: 4 }}
                          className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                            isActive
                              ? 'bg-[#500000] text-white'
                              : 'text-[#2D2D2D]/70 hover:bg-[#500000]/10 hover:text-[#500000]'
                          }`}
                          title={!sidebarOpen ? item.name : undefined}
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
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
                          {item.badge && sidebarOpen && (
                            <span className="ml-auto px-2 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </motion.div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Secondary Navigation */}
            <div className="pt-4 border-t border-[#2D2D2D]/10">
              {secondaryNav.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

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
                      <Icon className="w-5 h-5 flex-shrink-0" />
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
                {getUserInitials()}
              </div>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 overflow-hidden"
                  >
                    <div className="font-medium text-[#2D2D2D] whitespace-nowrap truncate">
                      {appUser?.displayName || user?.email || 'User'}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(userRole)}`}>
                        {getRoleDisplayName(userRole)}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleSignOut}
                    className="p-2 text-[#2D2D2D]/40 hover:text-red-500 transition-colors"
                    title="Sign Out"
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
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Image
                    src="/images/logo-dark.png"
                    alt="Right at Home Midland"
                    width={160}
                    height={68}
                    className="h-auto"
                    priority
                  />
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-[#2D2D2D]/60 hover:text-[#500000]"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Mobile Navigation */}
              <nav className="flex-1 px-3 py-4 overflow-y-auto">
                {filteredNav.map((section, sectionIndex) => (
                  <div key={section.title || sectionIndex} className="mb-6">
                    {section.title && (
                      <h3 className="px-3 mb-2 text-xs font-semibold text-[#2D2D2D]/40 uppercase tracking-wider">
                        {section.title}
                      </h3>
                    )}
                    {section.items.map((item) => {
                      const isActive = pathname === item.href ||
                        (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                      const Icon = item.icon;

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
                            <Icon className="w-5 h-5" />
                            <span className="font-medium">{item.name}</span>
                            {item.badge && (
                              <span className="ml-auto px-2 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              {/* Mobile User Section */}
              <div className="p-4 border-t border-[#2D2D2D]/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#500000] to-[#722F37] flex items-center justify-center text-white font-semibold">
                    {getUserInitials()}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-[#2D2D2D]">
                      {appUser?.displayName || user?.email || 'User'}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(userRole)}`}>
                      {getRoleDisplayName(userRole)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
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

            <Link href="/dashboard">
              <Image
                src="/images/logo-dark.png"
                alt="Right at Home Midland"
                width={120}
                height={50}
                className="h-10 w-auto"
                priority
              />
            </Link>

            <Link href="/notifications">
              <button className="p-2 text-[#500000]">
                <Bell className="w-6 h-6" />
              </button>
            </Link>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
