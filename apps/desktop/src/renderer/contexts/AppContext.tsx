import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Property, Booking, Guest, CleaningJob, DashboardStats, UserSettings } from '@shared/types';

interface AppState {
  properties: Property[];
  bookings: Booking[];
  guests: Guest[];
  cleaningJobs: CleaningJob[];
  stats: DashboardStats | null;
  settings: UserSettings | null;
  isLoading: boolean;
  isOffline: boolean;
  appInfo: AppInfo | null;
}

interface AppInfo {
  version: string;
  name: string;
  platform: string;
}

interface AppContextType extends AppState {
  refreshData: () => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  setOfflineMode: (offline: boolean) => void;
}

const defaultSettings: UserSettings = {
  theme: 'light',
  notifications: true,
  minimizeToTray: true,
  startWithSystem: false,
  startMinimized: false,
  autoUpdate: true,
  offlineMode: false,
  backupPath: '',
  currency: 'USD',
  timezone: 'America/Chicago',
  dateFormat: 'MM/dd/yyyy',
  apiUrl: 'https://api.rightathomebnb.com',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

// Mock data for demonstration
const mockProperties: Property[] = [
  {
    id: '1',
    name: 'Aggie Getaway',
    address: '123 University Dr',
    city: 'College Station',
    state: 'TX',
    zipCode: '77840',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    basePrice: 150,
    cleaningFee: 75,
    status: 'active',
    amenities: ['WiFi', 'Pool', 'Hot Tub', 'Parking'],
    description: 'Beautiful home near Texas A&M campus',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Midland Oasis',
    address: '456 Basin St',
    city: 'Midland',
    state: 'TX',
    zipCode: '79701',
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 8,
    basePrice: 200,
    cleaningFee: 100,
    status: 'active',
    amenities: ['WiFi', 'Gym', 'Workspace', 'Parking'],
    description: 'Spacious home perfect for business travelers',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Permian Paradise',
    address: '789 Oil Field Rd',
    city: 'Odessa',
    state: 'TX',
    zipCode: '79761',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    basePrice: 120,
    cleaningFee: 50,
    status: 'active',
    amenities: ['WiFi', 'Kitchen', 'Washer/Dryer'],
    description: 'Cozy retreat in West Texas',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockGuests: Guest[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@email.com',
    phone: '(432) 555-0101',
    totalBookings: 3,
    totalSpent: 1250,
    rating: 5,
    tags: ['VIP', 'Repeat Guest'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.j@email.com',
    phone: '(512) 555-0202',
    totalBookings: 1,
    totalSpent: 450,
    rating: 4,
    tags: ['Business'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockBookings: Booking[] = [
  {
    id: '1',
    propertyId: '1',
    guestId: '1',
    checkIn: new Date().toISOString(),
    checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    guests: 4,
    totalPrice: 525,
    cleaningFee: 75,
    serviceFee: 50,
    status: 'confirmed',
    source: 'airbnb',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    propertyId: '2',
    guestId: '2',
    checkIn: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    checkOut: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    guests: 2,
    totalPrice: 750,
    cleaningFee: 100,
    serviceFee: 75,
    status: 'pending',
    source: 'vrbo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockCleaningJobs: CleaningJob[] = [
  {
    id: '1',
    propertyId: '1',
    bookingId: '1',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '14:00',
    duration: 120,
    status: 'scheduled',
    type: 'turnover',
    checklist: [
      { id: '1', task: 'Strip beds and start laundry', completed: false },
      { id: '2', task: 'Clean bathrooms', completed: false },
      { id: '3', task: 'Vacuum and mop floors', completed: false },
      { id: '4', task: 'Restock supplies', completed: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockStats: DashboardStats = {
  totalProperties: 3,
  activeBookings: 2,
  todayCheckIns: 1,
  todayCheckOuts: 0,
  pendingCleanings: 1,
  monthlyRevenue: 4250,
  monthlyExpenses: 850,
  occupancyRate: 78,
  upcomingBookings: mockBookings,
  recentTransactions: [],
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    properties: [],
    bookings: [],
    guests: [],
    cleaningJobs: [],
    stats: null,
    settings: null,
    isLoading: true,
    isOffline: false,
    appInfo: null,
  });

  useEffect(() => {
    const initialize = async () => {
      try {
        // Load app info
        const appInfo = await window.electronAPI.app.getInfo();

        // Load settings from store
        const storedSettings = await window.electronAPI.store.getAll();

        // Update tray stats
        await window.electronAPI.tray.updateStats({
          todayJobs: mockStats.pendingCleanings,
          checkInsToday: mockStats.todayCheckIns,
          checkOutsToday: mockStats.todayCheckOuts,
          pendingCleanings: mockStats.pendingCleanings,
          revenue: mockStats.monthlyRevenue,
        });

        setState((prev) => ({
          ...prev,
          properties: mockProperties,
          bookings: mockBookings,
          guests: mockGuests,
          cleaningJobs: mockCleaningJobs,
          stats: mockStats,
          settings: { ...defaultSettings, ...storedSettings },
          isLoading: false,
          appInfo: {
            version: appInfo.version,
            name: appInfo.name,
            platform: appInfo.platform,
          },
        }));
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setState((prev) => ({
          ...prev,
          properties: mockProperties,
          bookings: mockBookings,
          guests: mockGuests,
          cleaningJobs: mockCleaningJobs,
          stats: mockStats,
          settings: defaultSettings,
          isLoading: false,
        }));
      }
    };

    initialize();

    // Listen for navigation events from main process
    const cleanup = window.electronAPI.on('navigate', (route) => {
      window.location.hash = route as string;
    });

    return cleanup;
  }, []);

  const refreshData = async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // In real app, fetch from API here
      await new Promise((resolve) => setTimeout(resolve, 500));

      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to refresh data:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const updated = { ...state.settings, ...newSettings } as UserSettings;

      // Save each setting to store
      for (const [key, value] of Object.entries(newSettings)) {
        await window.electronAPI.store.set(key, value);
      }

      setState((prev) => ({
        ...prev,
        settings: updated,
      }));
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const setOfflineMode = (offline: boolean) => {
    setState((prev) => ({ ...prev, isOffline: offline }));
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        refreshData,
        updateSettings,
        setOfflineMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
