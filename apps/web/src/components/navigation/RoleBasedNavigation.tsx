'use client';

/**
 * Right at Home BnB - Role-Based Navigation
 * Different menus for Admin, Worker, and Guest roles
 * @author ECHO OMEGA PRIME
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Building2, Calendar, Users, ClipboardList,
  DollarSign, Settings, LogOut, Menu, X, Wrench,
  Package, BarChart3, MessageSquare, Smartphone,
  Globe, Star, CreditCard, Shield, ChevronDown,
  Sparkles, HardHat, Brush
} from 'lucide-react';
import { AppUser, hasPermission, UserRole, signOut } from '@/lib/auth';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
  children?: NavItem[];
}

// Navigation items for each role
const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <Home className="w-5 h-5" /> },
  { label: 'Properties', href: '/properties', icon: <Building2 className="w-5 h-5" /> },
  { label: 'Bookings', href: '/bookings', icon: <Calendar className="w-5 h-5" /> },
  {
    label: 'Financials',
    href: '/financials',
    icon: <DollarSign className="w-5 h-5" />,
    children: [
      { label: 'Overview', href: '/financials', icon: <BarChart3 className="w-4 h-4" /> },
      { label: 'Homeowner Payments', href: '/financials/homeowner', icon: <CreditCard className="w-4 h-4" /> },
      { label: 'Utilities', href: '/financials/utilities', icon: <Sparkles className="w-4 h-4" /> },
      { label: 'Cleaning Costs', href: '/financials/cleaning', icon: <Brush className="w-4 h-4" /> },
      { label: 'Maintenance', href: '/financials/maintenance', icon: <Wrench className="w-4 h-4" /> },
      { label: 'Yard Care', href: '/financials/yard', icon: <Home className="w-4 h-4" /> },
      { label: 'Inventory', href: '/financials/inventory', icon: <Package className="w-4 h-4" /> },
      { label: 'Reports', href: '/financials/reports', icon: <BarChart3 className="w-4 h-4" /> },
    ]
  },
  { label: 'Workers', href: '/workers', icon: <HardHat className="w-5 h-5" /> },
  { label: 'Cleaning', href: '/cleaning', icon: <Brush className="w-5 h-5" /> },
  { label: 'Guests', href: '/guests', icon: <Users className="w-5 h-5" /> },
  { label: 'Inventory', href: '/inventory', icon: <Package className="w-5 h-5" /> },
  { label: 'Smart Home', href: '/smart-home', icon: <Smartphone className="w-5 h-5" /> },
  { label: 'VRBO/Airbnb', href: '/channels', icon: <Globe className="w-5 h-5" /> },
  { label: 'AI Concierge', href: '/concierge', icon: <MessageSquare className="w-5 h-5" /> },
  { label: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" /> },
];

const WORKER_NAV: NavItem[] = [
  { label: 'My Tasks', href: '/worker/tasks', icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Schedule', href: '/worker/schedule', icon: <Calendar className="w-5 h-5" /> },
  { label: 'Cleaning', href: '/worker/cleaning', icon: <Brush className="w-5 h-5" /> },
  { label: 'Inventory', href: '/worker/inventory', icon: <Package className="w-5 h-5" /> },
  { label: 'Properties', href: '/worker/properties', icon: <Building2 className="w-5 h-5" /> },
];

const GUEST_NAV: NavItem[] = [
  { label: 'Properties', href: '/properties', icon: <Building2 className="w-5 h-5" /> },
  { label: 'My Bookings', href: '/my-bookings', icon: <Calendar className="w-5 h-5" /> },
  { label: 'Reviews', href: '/reviews', icon: <Star className="w-5 h-5" /> },
  { label: 'AI Concierge', href: '/concierge', icon: <MessageSquare className="w-5 h-5" /> },
];

function getNavForRole(role: UserRole): NavItem[] {
  switch (role) {
    case 'admin':
      return ADMIN_NAV;
    case 'worker':
      return WORKER_NAV;
    case 'guest':
    default:
      return GUEST_NAV;
  }
}

interface RoleBasedNavigationProps {
  user: AppUser | null;
  onSignOut?: () => void;
}

export function RoleBasedNavigation({ user, onSignOut }: RoleBasedNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const pathname = usePathname();

  const navItems = getNavForRole(user?.role || 'guest');

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onSignOut?.();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  const renderNavItem = (item: NavItem, mobile = false) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.label);
    const active = isActive(item.href);

    if (hasChildren) {
      return (
        <div key={item.label} className="space-y-1">
          <button
            onClick={() => toggleExpanded(item.label)}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all ${
              active
                ? 'bg-[#500000] text-white'
                : 'text-[#2D2D2D]/70 hover:bg-[#500000]/10 hover:text-[#500000]'
            }`}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="ml-4 pl-4 border-l-2 border-[#500000]/20 space-y-1"
              >
                {item.children!.map(child => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => mobile && setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                      isActive(child.href)
                        ? 'bg-[#500000]/20 text-[#500000] font-medium'
                        : 'text-[#2D2D2D]/60 hover:bg-[#500000]/10 hover:text-[#500000]'
                    }`}
                  >
                    {child.icon}
                    <span className="text-sm">{child.label}</span>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => mobile && setMobileMenuOpen(false)}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
          active
            ? 'bg-[#500000] text-white shadow-md'
            : 'text-[#2D2D2D]/70 hover:bg-[#500000]/10 hover:text-[#500000]'
        }`}
      >
        {item.icon}
        <span className="font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-[#2D2D2D]/10 min-h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-[#2D2D2D]/10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#500000] to-[#722F37] rounded-xl flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-['Playfair_Display'] font-bold text-[#500000]">Right at Home</h1>
              <p className="text-xs text-[#2D2D2D]/60">BnB Management</p>
            </div>
          </Link>
        </div>

        {/* User Info */}
        {user && (
          <div className="px-6 py-4 border-b border-[#2D2D2D]/10">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-[#C4A777]/20 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#C4A777]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#2D2D2D] truncate">
                  {user.displayName || 'User'}
                </p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  user.role === 'admin'
                    ? 'bg-[#500000]/10 text-[#500000]'
                    : user.role === 'worker'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-[#C4A777]/20 text-[#C4A777]'
                }`}>
                  <Shield className="w-3 h-3" />
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map(item => renderNavItem(item))}
        </nav>

        {/* Sign Out */}
        {user && (
          <div className="p-4 border-t border-[#2D2D2D]/10">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#2D2D2D]/10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#500000] to-[#722F37] rounded-lg flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="font-['Playfair_Display'] font-bold text-[#500000]">Right at Home</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-[#500000]/10 transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-[#500000]" />
            ) : (
              <Menu className="w-6 h-6 text-[#500000]" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '-100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '-100%' }}
            className="lg:hidden fixed inset-0 z-40 bg-white pt-16"
          >
            <div className="h-full overflow-y-auto">
              {/* User Info */}
              {user && (
                <div className="px-6 py-4 border-b border-[#2D2D2D]/10">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-[#C4A777]/20 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-[#C4A777]" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-[#2D2D2D]">
                        {user.displayName || 'User'}
                      </p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-[#500000]/10 text-[#500000]'
                          : user.role === 'worker'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-[#C4A777]/20 text-[#C4A777]'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <nav className="px-4 py-6 space-y-2">
                {navItems.map(item => renderNavItem(item, true))}
              </nav>

              {/* Sign Out */}
              {user && (
                <div className="px-4 pb-6">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default RoleBasedNavigation;
