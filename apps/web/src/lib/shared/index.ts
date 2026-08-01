/**
 * Right at Home BNB - Shared Package
 * Central exports for all platforms
 */

// Types
export * from './types';

// The Firebase and cross-platform-sync exports are gone.
//
// `./firebase` and `./sync` were a Firestore realtime layer driven by
// SyncProvider, which wrapped every page, opened an onSnapshot listener and
// wrote presence heartbeats -- for a context value nothing in the application
// read. The provider was unmounted first, then the code removed once nothing
// referenced it. If cross-device presence is ever genuinely needed, it belongs
// on our own transport rather than Firestore; git history has the original.

// API Client
export { api, RightAtHomeAPI } from './api';

// Constants
export const APP_NAME = 'Right at Home BNB';
export const APP_VERSION = '1.0.0';
export const OWNER_NAME = 'Steven Palma';
export const LOCATION = 'Midland, TX';
export const PROPERTY_COUNT = 22;

// Branding
export const BRANDING = {
  colors: {
    primary: '#500000',      // Aggie Maroon
    secondary: '#F5F5F0',    // Cream
    accent: '#C4A777',       // Gold
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6'
  },
  fonts: {
    heading: 'Playfair Display',
    body: 'Inter',
    mono: 'JetBrains Mono'
  }
} as const;

// Platform detection
export const detectPlatform = (): 'web' | 'mobile' | 'desktop' => {
  if (typeof window !== 'undefined') {
    if ((window as any).electron || navigator.userAgent.includes('Electron')) {
      return 'desktop';
    }
    if ((window as any).ReactNativeWebView || navigator.product === 'ReactNative') {
      return 'mobile';
    }
  }
  return 'web';
};

// Utilities
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

export const formatDate = (date: Date | string, format: 'short' | 'long' | 'time' = 'short'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;

  switch (format) {
    case 'long':
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'time':
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    default:
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
  }
};

export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Validation
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  return /^\+?[\d\s()-]{10,}$/.test(phone);
};

// Distance calculation (for GPS check-in)
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const isWithinRadius = (
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  radiusMiles: number = 0.1
): boolean => {
  return calculateDistance(userLat, userLng, targetLat, targetLng) <= radiusMiles;
};
