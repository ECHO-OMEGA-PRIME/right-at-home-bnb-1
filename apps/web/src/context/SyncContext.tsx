'use client';

/**
 * Right at Home BnB - Web Sync Context
 * Provides real-time sync across Web, Mobile, Desktop platforms
 *
 * @author ECHO OMEGA PRIME
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  useCrossPlatformSync,
  useSyncedProperties,
  useSyncedBookings,
  useSyncedCleaningJobs,
  useSyncedMessages,
  useSyncedDevices,
} from '@/lib/shared/sync/hooks';
import { getFirestoreInstance, initializeFirebase } from '@/lib/shared/firebase';
import type { Property, Booking, CleaningJob } from '@/lib/shared/types';
import { createLogger } from '@/lib/debug';

const logger = createLogger('SyncProvider');

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

  // Actions
  updateProperty: (propertyId: string, changes: Record<string, unknown>) => Promise<void>;
  createBooking: (bookingData: Record<string, unknown>) => Promise<string | undefined>;
  completeCleaningJob: (jobId: string, report: Record<string, unknown>) => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
  userId: string;
  initialProperties?: Property[];
  initialBookings?: Booking[];
  initialCleaningJobs?: CleaningJob[];
}

export function SyncProvider({
  children,
  userId,
  initialProperties = [],
  initialBookings = [],
  initialCleaningJobs = [],
}: SyncProviderProps) {
  const [db, setDb] = useState<any>(null);

  // Initialize Firebase
  useEffect(() => {
    try {
      logger.info('Initializing Firebase...');
      initializeFirebase();
      const firestore = getFirestoreInstance();
      setDb(firestore);
      logger.info('Firebase initialized successfully');
    } catch (error) {
      logger.error('Firebase initialization failed', error, {
        hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  }, []);

  // Cross-platform sync hook
  const { sync, isConnected, onlineDevices, platform } = useCrossPlatformSync(db, userId);

  // Synced data hooks
  const { properties, updateProperty } = useSyncedProperties(sync, initialProperties);
  const { bookings, createBooking } = useSyncedBookings(sync, initialBookings);
  const { jobs: cleaningJobs, completeJob } = useSyncedCleaningJobs(sync, initialCleaningJobs);

  // Log connection status changes
  useEffect(() => {
    logger.info('Connection status changed', {
      isConnected,
      platform,
      onlineDevices: onlineDevices.length,
      hasDb: !!db,
    });
  }, [isConnected, platform, onlineDevices, db]);

  const value: SyncContextType = {
    isConnected,
    onlineDevices,
    platform,
    properties,
    bookings,
    cleaningJobs,
    updateProperty,
    createBooking,
    completeCleaningJob: completeJob,
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
