'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  CalendarDays,
  Home,
  Users,
  BookOpen,
  DollarSign,
  FileText,
  ClipboardList,
  Package,
  Wifi,
  PieChart,
  Calculator,
  Star,
  Calendar,
  Bot,
  Plug,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  Bell,
  LogOut,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Bookings', href: '/bookings', icon: CalendarDays },
  { label: 'Properties', href: '/properties', icon: Home },
  { label: 'Workers', href: '/admin/workers', icon: Users },
  { label: 'Guests / CRM', href: '/admin/crm', icon: Users },
  { label: 'Accounting', href: '/admin/accounting', icon: BookOpen },
  { label: 'Payroll', href: '/admin/payroll', icon: DollarSign },
  { label: 'Invoices', href: '/admin/accounting/ar', icon: FileText },
  { label: 'Dispatch', href: '/admin/dispatch', icon: ClipboardList },
  { label: 'Inventory', href: '/admin/inventory', icon: Package },
  { label: 'Smart Home', href: '/admin/smart-home', icon: Wifi },
  { label: 'Costs', href: '/admin/costs', icon: PieChart },
  { label: 'Taxes', href: '/admin/taxes', icon: Calculator },
  { label: 'Reviews', href: '/admin/reviews', icon: Star },
  { label: 'Planner', href: '/admin/planner', icon: Calendar },
  { label: 'Steven AI', href: '/steven', icon: Bot },
  { label: 'PayPal', href: '/admin/paypal', icon: CreditCard },
  { label: 'Integrations', href: '/admin/integrations', icon: Plug },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser, loading, isOwner } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auth guard — only owner/admin can access admin pages
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#500000] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!appUser || (appUser.role !== 'owner' && appUser.role !== 'admin')) {
    router.replace('/dashboard');
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          flex flex-col bg-[#500000] text-white
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[68px]' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand */}
        <div className="flex items-center h-16 px-4 border-b border-white/10 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <Home className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate leading-tight">Right at Home</p>
                <p className="text-[10px] text-white/60 leading-tight">BnB Admin</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center mx-auto">
              <Home className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                  transition-colors duration-150
                  ${active
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }
                  ${collapsed ? 'justify-center px-2' : ''}
                `}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-white/10 p-2 shrink-0 hidden lg:block">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full gap-2 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Right at Home BnB</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Midland, TX &middot; Property Management</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="hidden sm:block h-8 w-px bg-gray-200 mx-1" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#500000] flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                  {appUser?.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900 leading-tight">
                  {appUser?.displayName || 'User'}
                </p>
                <p className="text-xs text-gray-500 leading-tight capitalize">
                  {appUser?.role || 'Admin'}
                </p>
              </div>
            </div>
            <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
