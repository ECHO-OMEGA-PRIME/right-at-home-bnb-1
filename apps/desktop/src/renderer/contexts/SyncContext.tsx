/**
 * Right at Home BnB - Desktop Sync Context
 * Provides real-time sync across Web, Mobile, Desktop platforms
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  useCrossPlatformSync,
  useSyncedProperties,
  useSyncedBookings,
  useSyncedCleaningJobs,
  useSyncedDevices,
  getFirestoreInstance,
  initializeFirebase,
  type Property,
  type Booking,
  type CleaningJob,
  type SmartLock,
  type Thermostat,
} from '@rightathome/shared';

interface OnlineDevice {
  platform: string;
  deviceId: string;
  lastSeen?: Date;
}

interface SyncContextType {
  // Connection status
  isConnected: boolean;
  onlineDevices: OnlineDevice[];
  platform: 'web' | 'mobile' | 'desktop';

  // Synced data
  properties: Property[];
  bookings: Booking[];
  cleaningJobs: CleaningJob[];
  smartDevices: (SmartLock | Thermostat)[];

  // Actions
  updateProperty: (propertyId: string, changes: Record<string, unknown>) => Promise<void>;
  createBooking: (bookingData: Record<string, unknown>) => Promise<string | undefined>;
  updateDeviceStatus: (deviceId: string, status: Record<string, unknown>) => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
  userId: string;
  initialProperties?: Property[];
  initialBookings?: Booking[];
  initialCleaningJobs?: CleaningJob[];
  initialDevices?: (SmartLock | Thermostat)[];
}

export function SyncProvider({
  children,
  userId,
  initialProperties = [],
  initialBookings = [],
  initialCleaningJobs = [],
  initialDevices = [],
}: SyncProviderProps) {
  const [db, setDb] = useState<any>(null);

  // Initialize Firebase
  useEffect(() => {
    try {
      initializeFirebase();
      const firestore = getFirestoreInstance();
      setDb(firestore);
      console.log('[Desktop Sync] Firebase initialized');
    } catch (error) {
      console.error('[Desktop Sync] Firebase initialization error:', error);
    }
  }, []);

  // Cross-platform sync hook
  const { sync, isConnected, onlineDevices, platform } = useCrossPlatformSync(db, userId);

  // Synced data hooks
  const { properties, updateProperty } = useSyncedProperties(sync, initialProperties);
  const { bookings, createBooking } = useSyncedBookings(sync, initialBookings);
  const { jobs: cleaningJobs } = useSyncedCleaningJobs(sync, initialCleaningJobs);
  const { devices: smartDevices, updateDeviceStatus } = useSyncedDevices(sync, initialDevices);

  // Log connection status changes
  useEffect(() => {
    if (userId) {
      console.log(`[Desktop Sync] Connection: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
      console.log(`[Desktop Sync] Platform: ${platform}`);
      console.log(`[Desktop Sync] Online devices: ${onlineDevices.length}`);

      // Update system tray with sync status
      if (window.electronAPI?.tray) {
        window.electronAPI.tray.updateStats({
          syncStatus: isConnected ? 'connected' : 'offline',
          onlineDevices: onlineDevices.length,
        });
      }
    }
  }, [isConnected, platform, onlineDevices, userId]);

  const value: SyncContextType = {
    isConnected,
    onlineDevices,
    platform: platform as 'web' | 'mobile' | 'desktop',
    properties,
    bookings,
    cleaningJobs,
    smartDevices,
    updateProperty,
    createBooking,
    updateDeviceStatus,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

export function useSyncStatus() {
  const { isConnected, onlineDevices, platform } = useSync();
  return { isConnected, onlineDevices, platform };
}

// Component to display sync status in header/footer
export function SyncStatusIndicator() {
  const { isConnected, onlineDevices } = useSyncStatus();

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`}
      />
      <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
        {isConnected ? 'Synced' : 'Offline'}
      </span>
      {onlineDevices.length > 0 && (
        <span className="text-gray-500">
          ({onlineDevices.length} device{onlineDevices.length !== 1 ? 's' : ''})
        </span>
      )}
    </div>
  );
}
