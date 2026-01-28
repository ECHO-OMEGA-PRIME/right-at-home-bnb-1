// Right at Home BnB - Utility Functions

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';

// Tailwind class merging utility
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Date formatting utilities
export function formatDate(date: Date | string | null | undefined, formatStr: string = 'MMM d, yyyy'): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid date';
  return format(d, formatStr);
}

export function formatDateRange(start: Date | string, end: Date | string): string {
  const startDate = typeof start === 'string' ? parseISO(start) : start;
  const endDate = typeof end === 'string' ? parseISO(end) : end;

  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${format(startDate, 'MMM d')} - ${format(endDate, 'd, yyyy')}`;
  }
  return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
}

export function getNightCount(checkIn: Date | string, checkOut: Date | string): number {
  const start = typeof checkIn === 'string' ? parseISO(checkIn) : checkIn;
  const end = typeof checkOut === 'string' ? parseISO(checkOut) : checkOut;
  return differenceInDays(end, start);
}

// Currency formatting
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyDetailed(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Percentage formatting
export function formatPercentage(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(decimals)}%`;
}

// Phone formatting
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return 'N/A';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

// Status utilities
export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    // Booking statuses
    CONFIRMED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
    COMPLETED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    CHECKED_IN: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    CHECKED_OUT: 'bg-gray-500/20 text-gray-400 border-gray-500/30',

    // Property statuses
    ACTIVE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    INACTIVE: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    MAINTENANCE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',

    // Cleaning job statuses
    SCHEDULED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',

    // Message statuses
    DRAFT: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    SENT: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return statusColors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

export function getPlatformColor(platform: string): string {
  const platformColors: Record<string, string> = {
    AIRBNB: 'bg-[#FF5A5F]/20 text-[#FF5A5F] border-[#FF5A5F]/30',
    VRBO: 'bg-[#3B5998]/20 text-[#6B9FFF] border-[#3B5998]/30',
    DIRECT: 'bg-maroon-800/20 text-maroon-400 border-maroon-800/30',
    BOOKING: 'bg-[#003580]/20 text-[#6B9FFF] border-[#003580]/30',
  };
  return platformColors[platform] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

// Platform icons (returns emoji for simplicity)
export function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    AIRBNB: 'A',
    VRBO: 'V',
    DIRECT: 'D',
    BOOKING: 'B',
  };
  return icons[platform] || '?';
}

// JSON parsing utilities
export function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Amenities parsing
export function parseAmenities(amenities: string | null): string[] {
  return parseJsonField<string[]>(amenities, []);
}

// Truncate text
export function truncate(text: string | null | undefined, length: number): string {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

// Generate initials from name
export function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Sleep utility for loading states
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Debounce utility
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// Calculate occupancy rate
export function calculateOccupancyRate(
  bookedDays: number,
  totalDays: number
): number {
  if (totalDays === 0) return 0;
  return Math.round((bookedDays / totalDays) * 100);
}

// Generate access code
export function generateAccessCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Property type display name
export function getPropertyTypeDisplay(type: string): string {
  const types: Record<string, string> = {
    HOUSE: 'House',
    APARTMENT: 'Apartment',
    CONDO: 'Condo',
    TOWNHOUSE: 'Townhouse',
    CABIN: 'Cabin',
    STUDIO: 'Studio',
  };
  return types[type] || type;
}
