/**
 * Role-Based Navigation Configuration
 * Different menus for: guest, worker, admin, owner
 */

import {
  Home, Building2, Users, Sparkles, Key, MessageSquare,
  DollarSign, Settings, Calendar, Bot, ClipboardCheck,
  Bell, BarChart3, Wrench, Package, Smartphone, Globe,
  UserCircle, LogOut, Shield, Phone
} from 'lucide-react';
import { UserRole, Permission, ROLE_PERMISSIONS } from './auth';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  badge?: string;
  description?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

// ============ OWNER/ADMIN NAVIGATION ============
// Full access to all features
export const ownerNavigation: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home, description: 'Business overview' },
      { name: 'Calendar', href: '/calendar', icon: Calendar, permission: 'canViewCalendar', description: 'Bookings calendar' },
      { name: 'Properties', href: '/properties', icon: Building2, permission: 'canViewProperties', description: 'All properties' },
    ]
  },
  {
    title: 'Bookings & Guests',
    items: [
      { name: 'Bookings', href: '/bookings', icon: Calendar, permission: 'canViewBookings', description: 'Manage reservations' },
      { name: 'Guests', href: '/guests', icon: Users, permission: 'canViewGuests', description: 'Guest management' },
      { name: 'Messages', href: '/messages', icon: MessageSquare, permission: 'canViewBookings', description: 'Guest communications' },
    ]
  },
  {
    title: 'Operations',
    items: [
      { name: 'Cleaning Jobs', href: '/cleaning', icon: ClipboardCheck, permission: 'canViewCleaningTasks', description: 'Cleaning schedules' },
      { name: 'Cleaners', href: '/cleaners', icon: Sparkles, permission: 'canViewWorkers', description: 'Cleaner management' },
      { name: 'Lawn Service', href: '/lawn-service', icon: Wrench, permission: 'canViewWorkers', description: 'Lawn care crews' },
      { name: 'Maintenance', href: '/maintenance', icon: Package, permission: 'canViewWorkers', description: 'Handymen & repairs' },
      { name: 'Smart Locks', href: '/locks', icon: Key, permission: 'canViewSmartHome', description: 'Lock codes & access' },
      { name: 'Smart Home', href: '/smart-home', icon: Smartphone, permission: 'canViewSmartHome', description: 'IoT devices' },
    ]
  },
  {
    title: 'AI & Channels',
    items: [
      { name: 'Steven AI', href: '/steven', icon: Bot, permission: 'canViewAIChat', description: 'AI assistant' },
      { name: 'VRBO Sync', href: '/vrbo', icon: Globe, permission: 'canViewVRBO', description: 'Channel management' },
      { name: 'Concierge', href: '/concierge', icon: Phone, permission: 'canViewAIChat', description: 'AI concierge' },
    ]
  },
  {
    title: 'Finance & Reports',
    items: [
      { name: 'Finance', href: '/finance', icon: DollarSign, permission: 'canViewFinancials', description: 'Revenue & expenses' },
      { name: 'Analytics', href: '/analytics', icon: BarChart3, permission: 'canViewReports', description: 'Performance metrics' },
    ]
  },
];

export const ownerSecondaryNav: NavItem[] = [
  { name: 'Notifications', href: '/notifications', icon: Bell, description: 'Alerts & updates' },
  { name: 'Settings', href: '/settings', icon: Settings, permission: 'canAccessSettings', description: 'System settings' },
];

// ============ WORKER NAVIGATION ============
// Limited access - cleaning tasks, maintenance, schedule
export const workerNavigation: NavSection[] = [
  {
    title: 'My Work',
    items: [
      { name: 'My Schedule', href: '/dashboard', icon: Home, description: 'Your daily tasks' },
      { name: 'Cleaning Jobs', href: '/cleaning', icon: ClipboardCheck, permission: 'canViewCleaningTasks', description: 'Your cleaning tasks' },
      { name: 'Calendar', href: '/calendar', icon: Calendar, permission: 'canViewCalendar', description: 'Work schedule' },
    ]
  },
  {
    title: 'Properties',
    items: [
      { name: 'Properties', href: '/properties', icon: Building2, permission: 'canViewProperties', description: 'Assigned properties' },
      { name: 'Inventory', href: '/inventory', icon: Package, permission: 'canViewInventory', description: 'Supplies checklist' },
    ]
  },
];

export const workerSecondaryNav: NavItem[] = [
  { name: 'My Profile', href: '/profile', icon: UserCircle, description: 'Your profile' },
];

// ============ GUEST NAVIGATION ============
// Minimal access - properties, their bookings, AI concierge
export const guestNavigation: NavSection[] = [
  {
    title: 'Browse',
    items: [
      { name: 'Properties', href: '/properties', icon: Building2, description: 'Find a property' },
    ]
  },
  {
    title: 'My Stay',
    items: [
      { name: 'My Bookings', href: '/bookings', icon: Calendar, permission: 'canViewBookings', description: 'Your reservations' },
      { name: 'AI Concierge', href: '/concierge', icon: Bot, permission: 'canViewAIChat', description: 'Ask Steven anything' },
    ]
  },
];

export const guestSecondaryNav: NavItem[] = [
  { name: 'My Profile', href: '/profile', icon: UserCircle, description: 'Your profile' },
];

// ============ HELPER FUNCTIONS ============

/**
 * Get navigation for a specific role
 */
export function getNavigationForRole(role: UserRole): {
  main: NavSection[];
  secondary: NavItem[];
} {
  switch (role) {
    case 'owner':
    case 'admin':
      return { main: ownerNavigation, secondary: ownerSecondaryNav };
    case 'worker':
      return { main: workerNavigation, secondary: workerSecondaryNav };
    case 'guest':
    default:
      return { main: guestNavigation, secondary: guestSecondaryNav };
  }
}

/**
 * Filter navigation items based on user permissions
 */
export function filterNavByPermissions(
  sections: NavSection[],
  role: UserRole
): NavSection[] {
  const permissions = ROLE_PERMISSIONS[role];

  return sections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (!item.permission) return true;
      return permissions[item.permission];
    })
  })).filter(section => section.items.length > 0);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case 'owner': return 'Property Owner';
    case 'admin': return 'Administrator';
    case 'worker': return 'Team Member';
    case 'guest': return 'Guest';
    default: return 'User';
  }
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: UserRole): string {
  switch (role) {
    case 'owner': return 'bg-[#500000] text-white';
    case 'admin': return 'bg-purple-600 text-white';
    case 'worker': return 'bg-blue-600 text-white';
    case 'guest': return 'bg-gray-500 text-white';
    default: return 'bg-gray-400 text-white';
  }
}

export default {
  getNavigationForRole,
  filterNavByPermissions,
  getRoleDisplayName,
  getRoleBadgeColor,
  ownerNavigation,
  workerNavigation,
  guestNavigation,
};
