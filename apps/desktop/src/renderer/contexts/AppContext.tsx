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

// Mock data for demonstration - 22 properties as per Right At Home BnB portfolio
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
  {
    id: '4',
    name: 'Downtown Loft',
    address: '101 Main Street',
    city: 'Midland',
    state: 'TX',
    zipCode: '79701',
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    basePrice: 95,
    cleaningFee: 45,
    status: 'active',
    amenities: ['WiFi', 'Kitchen', 'Smart TV', 'Workspace'],
    description: 'Modern loft in the heart of downtown',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Executive Suite',
    address: '2200 Andrews Hwy',
    city: 'Midland',
    state: 'TX',
    zipCode: '79701',
    bedrooms: 2,
    bathrooms: 2,
    maxGuests: 4,
    basePrice: 175,
    cleaningFee: 85,
    status: 'active',
    amenities: ['WiFi', 'Gym', 'Pool', 'Parking', 'Workspace'],
    description: 'Luxury suite for discerning executives',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '6',
    name: 'Oil Patch Hideaway',
    address: '555 Petroleum Dr',
    city: 'Midland',
    state: 'TX',
    zipCode: '79705',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    basePrice: 165,
    cleaningFee: 80,
    status: 'active',
    amenities: ['WiFi', 'BBQ', 'Parking', 'Washer/Dryer'],
    description: 'Home away from home for oilfield workers',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '7',
    name: 'Ranch House Retreat',
    address: '8800 County Road 60',
    city: 'Midland',
    state: 'TX',
    zipCode: '79706',
    bedrooms: 5,
    bathrooms: 3,
    maxGuests: 10,
    basePrice: 275,
    cleaningFee: 125,
    status: 'active',
    amenities: ['WiFi', 'Pool', 'Hot Tub', 'BBQ', 'Fire Pit', 'Parking'],
    description: 'Sprawling ranch property with all the amenities',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '8',
    name: 'Crew Quarters A',
    address: '1100 Industrial Blvd Unit A',
    city: 'Odessa',
    state: 'TX',
    zipCode: '79761',
    bedrooms: 4,
    bathrooms: 2,
    maxGuests: 8,
    basePrice: 185,
    cleaningFee: 90,
    status: 'active',
    amenities: ['WiFi', 'Kitchen', 'Washer/Dryer', 'Parking'],
    description: 'Perfect for work crews, sleeps 8 comfortably',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '9',
    name: 'Crew Quarters B',
    address: '1100 Industrial Blvd Unit B',
    city: 'Odessa',
    state: 'TX',
    zipCode: '79761',
    bedrooms: 4,
    bathrooms: 2,
    maxGuests: 8,
    basePrice: 185,
    cleaningFee: 90,
    status: 'active',
    amenities: ['WiFi', 'Kitchen', 'Washer/Dryer', 'Parking'],
    description: 'Perfect for work crews, sleeps 8 comfortably',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '10',
    name: 'West Side Cottage',
    address: '3300 W Illinois Ave',
    city: 'Midland',
    state: 'TX',
    zipCode: '79701',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    basePrice: 110,
    cleaningFee: 55,
    status: 'active',
    amenities: ['WiFi', 'Kitchen', 'Parking', 'Patio'],
    description: 'Charming cottage on the west side',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '11',
    name: 'Garden District Home',
    address: '2500 Harvard Ave',
    city: 'Midland',
    state: 'TX',
    zipCode: '79701',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    basePrice: 155,
    cleaningFee: 75,
    status: 'active',
    amenities: ['WiFi', 'Pool', 'Garden', 'Parking'],
    description: 'Beautiful home in prestigious Garden District',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '12',
    name: 'Petroleum Club Tower Suite',
    address: '501 W Texas Ave #1200',
    city: 'Midland',
    state: 'TX',
    zipCode: '79701',
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    basePrice: 225,
    cleaningFee: 95,
    status: 'active',
    amenities: ['WiFi', 'Gym', 'Concierge', 'Parking', 'City Views'],
    description: 'Premium high-rise living with stunning views',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '13',
    name: 'Family Fun House',
    address: '4400 Mockingbird Ln',
    city: 'Midland',
    state: 'TX',
    zipCode: '79707',
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 10,
    basePrice: 195,
    cleaningFee: 100,
    status: 'active',
    amenities: ['WiFi', 'Pool', 'Game Room', 'BBQ', 'Trampoline'],
    description: 'Perfect for families with kids',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '14',
    name: 'Cozy Studio',
    address: '900 N Big Spring St #15',
    city: 'Midland',
    state: 'TX',
    zipCode: '79701',
    bedrooms: 0,
    bathrooms: 1,
    maxGuests: 2,
    basePrice: 75,
    cleaningFee: 35,
    status: 'active',
    amenities: ['WiFi', 'Kitchenette', 'Parking'],
    description: 'Budget-friendly studio, perfect for solo travelers',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '15',
    name: 'Basin Bungalow',
    address: '1750 E 8th St',
    city: 'Odessa',
    state: 'TX',
    zipCode: '79761',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    basePrice: 105,
    cleaningFee: 50,
    status: 'active',
    amenities: ['WiFi', 'Kitchen', 'Yard', 'Parking'],
    description: 'Classic bungalow with modern updates',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '16',
    name: 'The Ambassador',
    address: '2100 W Loop 250 N #400',
    city: 'Midland',
    state: 'TX',
    zipCode: '79705',
    bedrooms: 2,
    bathrooms: 2,
    maxGuests: 4,
    basePrice: 165,
    cleaningFee: 80,
    status: 'active',
    amenities: ['WiFi', 'Pool', 'Gym', 'Business Center', 'Parking'],
    description: 'Corporate housing at its finest',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '17',
    name: 'Sunrise Villa',
    address: '6700 E County Road 110',
    city: 'Midland',
    state: 'TX',
    zipCode: '79706',
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 8,
    basePrice: 245,
    cleaningFee: 110,
    status: 'active',
    amenities: ['WiFi', 'Pool', 'Hot Tub', 'Fire Pit', 'Views', 'Parking'],
    description: 'Stunning sunrise views over the Permian Basin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '18',
    name: 'Historic Downtown Unit',
    address: '115 N Main St #3',
    city: 'Midland',
    state: 'TX',
    zipCode: '79701',
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    basePrice: 115,
    cleaningFee: 55,
    status: 'maintenance',
    amenities: ['WiFi', 'Kitchen', 'Historic Charm'],
    description: 'Renovated historic building with character',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '19',
    name: 'North Park Place',
    address: '5500 N Midkiff Rd',
    city: 'Midland',
    state: 'TX',
    zipCode: '79705',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    basePrice: 145,
    cleaningFee: 70,
    status: 'active',
    amenities: ['WiFi', 'Kitchen', 'Washer/Dryer', 'Parking'],
    description: 'Comfortable family home in North Park',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '20',
    name: 'Contractor Special',
    address: '2800 Commercial Ave',
    city: 'Odessa',
    state: 'TX',
    zipCode: '79761',
    bedrooms: 6,
    bathrooms: 3,
    maxGuests: 12,
    basePrice: 295,
    cleaningFee: 140,
    status: 'active',
    amenities: ['WiFi', 'Kitchen', 'Washer/Dryer', 'Parking', 'Tool Storage'],
    description: 'Large property perfect for contractor crews',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '21',
    name: 'Greenwood Gem',
    address: '3100 Greenwood Dr',
    city: 'Midland',
    state: 'TX',
    zipCode: '79705',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    basePrice: 160,
    cleaningFee: 75,
    status: 'active',
    amenities: ['WiFi', 'Pool', 'Kitchen', 'Parking'],
    description: 'Beautiful home in Greenwood neighborhood',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '22',
    name: 'Stadium View',
    address: '1800 E Neely Ave',
    city: 'Midland',
    state: 'TX',
    zipCode: '79701',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    basePrice: 125,
    cleaningFee: 60,
    status: 'active',
    amenities: ['WiFi', 'Kitchen', 'Parking', 'Stadium Views'],
    description: 'Perfect for game day with stadium views',
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
    totalBookings: 12,
    totalSpent: 4850,
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
    totalBookings: 8,
    totalSpent: 3200,
    rating: 4,
    tags: ['Business', 'Repeat Guest'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    firstName: 'Mike',
    lastName: 'Williams',
    email: 'mike.w@oilfield.com',
    phone: '(432) 555-0303',
    totalBookings: 24,
    totalSpent: 12500,
    rating: 5,
    tags: ['VIP', 'Oilfield Crew', 'Repeat Guest'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    firstName: 'Emily',
    lastName: 'Davis',
    email: 'emily.davis@gmail.com',
    phone: '(713) 555-0404',
    totalBookings: 3,
    totalSpent: 890,
    rating: 5,
    tags: ['Family'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    firstName: 'Robert',
    lastName: 'Martinez',
    email: 'rmartinez@contractor.com',
    phone: '(432) 555-0505',
    totalBookings: 18,
    totalSpent: 8900,
    rating: 4,
    tags: ['Contractor', 'Repeat Guest'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '6',
    firstName: 'Jennifer',
    lastName: 'Brown',
    email: 'jen.brown@yahoo.com',
    phone: '(214) 555-0606',
    totalBookings: 2,
    totalSpent: 650,
    rating: 5,
    tags: ['Family'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '7',
    firstName: 'David',
    lastName: 'Taylor',
    email: 'dtaylor@energy.com',
    phone: '(432) 555-0707',
    totalBookings: 15,
    totalSpent: 7200,
    rating: 5,
    tags: ['VIP', 'Business', 'Repeat Guest'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '8',
    firstName: 'Lisa',
    lastName: 'Anderson',
    email: 'lisa.a@hotmail.com',
    phone: '(806) 555-0808',
    totalBookings: 1,
    totalSpent: 375,
    rating: 4,
    tags: ['First Time'],
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
  totalProperties: 22,
  activeBookings: 18,
  todayCheckIns: 4,
  todayCheckOuts: 3,
  pendingCleanings: 5,
  monthlyRevenue: 87500,
  monthlyExpenses: 18200,
  occupancyRate: 82,
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
