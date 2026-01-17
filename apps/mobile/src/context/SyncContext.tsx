/**
 * Right at Home BnB - Mobile Sync Context
 * Provides real-time sync across Web, Mobile, Desktop platforms
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useCrossPlatformSync,
  useSyncedCleaningJobs,
  getFirestoreInstance,
  initializeFirebase,
  SyncHelpers,
} from '@rightathome/shared';
import type { CleaningJob, GeoLocation } from '@rightathome/shared';

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
  cleaningJobs: CleaningJob[];

  // Actions
  completeJob: (jobId: string, report: Record<string, unknown>) => Promise<void>;
  checkIn: (jobId: string, location: GeoLocation) => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
  initialJobs?: CleaningJob[];
}

export function SyncProvider({ children, initialJobs = [] }: SyncProviderProps) {
  const [db, setDb] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Initialize Firebase and get user ID
  useEffect(() => {
    const initializeSync = async () => {
      try {
        initializeFirebase();
        const firestore = getFirestoreInstance();
        setDb(firestore);

        // Get user ID from storage
        const storedUserId = await AsyncStorage.getItem('@rightathome_user_id');
        setUserId(storedUserId || 'cleaner_default');
      } catch (error) {
        console.error('[SyncProvider] Initialization error:', error);
      }
    };

    initializeSync();
  }, []);

  // Cross-platform sync hook
  const { sync, isConnected, onlineDevices, platform } = useCrossPlatformSync(db, userId || '');

  // Synced cleaning jobs hook
  const { jobs: cleaningJobs, completeJob } = useSyncedCleaningJobs(sync, initialJobs);

  // Check-in function with GPS
  const checkIn = async (jobId: string, location: GeoLocation) => {
    if (!sync) return;
    await SyncHelpers.syncCleanerCheckin(sync, userId || '', jobId, location);
  };

  // Log connection status changes
  useEffect(() => {
    if (userId) {
      console.log(`[Mobile Sync] Connection: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
      console.log(`[Mobile Sync] Online devices: ${onlineDevices.length}`);
    }
  }, [isConnected, onlineDevices, userId]);

  const value: SyncContextType = {
    isConnected,
    onlineDevices,
    platform: platform as 'web' | 'mobile' | 'desktop',
    cleaningJobs,
    completeJob,
    checkIn,
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
