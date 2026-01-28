/**
 * Sync Service
 * Handles offline-first data synchronization with backend
 * @author ECHO OMEGA PRIME
 */

import { database } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://rightathome-api.run.app';
const SYNC_INTERVAL = 60000; // 1 minute
const MAX_RETRY_COUNT = 5;

interface SyncState {
  lastSync: number;
  inProgress: boolean;
  pendingCount: number;
  errors: string[];
}

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private state: SyncState = {
    lastSync: 0,
    inProgress: false,
    pendingCount: 0,
    errors: [],
  };
  private listeners: Set<(state: SyncState) => void> = new Set();

  async initialize(): Promise<void> {
    // Load last sync time
    const lastSyncStr = await AsyncStorage.getItem('@rightathome_last_sync');
    if (lastSyncStr) {
      this.state.lastSync = parseInt(lastSyncStr, 10);
    }

    // Start periodic sync
    this.startPeriodicSync();

    // Listen for network changes
    NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        this.syncPendingChanges();
      }
    });
  }

  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener({ ...this.state }));
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.syncAll();
    }, SYNC_INTERVAL);
  }

  async syncAll(): Promise<void> {
    if (this.state.inProgress) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('No network connection, skipping sync');
      return;
    }

    this.state.inProgress = true;
    this.state.errors = [];
    this.notify();

    try {
      // First, push pending local changes
      await this.syncPendingChanges();

      // Then pull latest from server
      await this.pullProperties();
      await this.pullBookings();
      await this.pullCleaningJobs();

      this.state.lastSync = Date.now();
      await AsyncStorage.setItem('@rightathome_last_sync', this.state.lastSync.toString());
    } catch (error: any) {
      console.error('Sync error:', error);
      this.state.errors.push(error.message);
    } finally {
      this.state.inProgress = false;
      this.notify();
    }
  }

  private async syncPendingChanges(): Promise<void> {
    const queue = await database.getSyncQueue();
    this.state.pendingCount = queue.length;
    this.notify();

    for (const item of queue) {
      if (item.retryCount >= MAX_RETRY_COUNT) {
        console.error('Max retries exceeded for sync item:', item.id);
        await database.removeSyncQueueItem(item.id);
        continue;
      }

      try {
        const data = JSON.parse(item.data);
        await this.pushChange(item.tableName, item.operation, data);
        await database.removeSyncQueueItem(item.id);
        this.state.pendingCount--;
        this.notify();
      } catch (error) {
        console.error('Failed to sync item:', item.id, error);
        await database.incrementSyncRetry(item.id);
      }
    }
  }

  private async pushChange(table: string, operation: string, data: any): Promise<void> {
    const token = await AsyncStorage.getItem('@rightathome_auth_token');
    if (!token) return;

    const endpoint = `${API_BASE_URL}/api/${table}`;
    const method = operation === 'delete' ? 'DELETE' : 'PUT';

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
  }

  private async pullProperties(): Promise<void> {
    const token = await AsyncStorage.getItem('@rightathome_auth_token');
    if (!token) return;

    const lastSync = await database.getLastSyncTime('properties');

    const response = await fetch(
      `${API_BASE_URL}/api/properties?since=${lastSync}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) return;

    const { data } = await response.json();
    const now = Date.now();

    for (const property of data) {
      await database.saveProperty({
        ...property,
        amenities: JSON.stringify(property.amenities || []),
        photos: JSON.stringify(property.photos || []),
        lastSynced: now,
        locallyModified: 0,
      });
    }
  }

  private async pullBookings(): Promise<void> {
    const token = await AsyncStorage.getItem('@rightathome_auth_token');
    if (!token) return;

    const lastSync = await database.getLastSyncTime('bookings');

    const response = await fetch(
      `${API_BASE_URL}/api/bookings?since=${lastSync}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) return;

    const { data } = await response.json();
    const now = Date.now();

    for (const booking of data) {
      await database.saveBooking({
        ...booking,
        checkIn: new Date(booking.checkIn).getTime(),
        checkOut: new Date(booking.checkOut).getTime(),
        lastSynced: now,
        locallyModified: 0,
      });
    }
  }

  private async pullCleaningJobs(): Promise<void> {
    const token = await AsyncStorage.getItem('@rightathome_auth_token');
    if (!token) return;

    const lastSync = await database.getLastSyncTime('cleaning_jobs');

    const response = await fetch(
      `${API_BASE_URL}/api/cleaning-jobs?since=${lastSync}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) return;

    const { data } = await response.json();
    const now = Date.now();

    for (const job of data) {
      await database.saveCleaningJob({
        ...job,
        scheduledDate: new Date(job.scheduledDate).getTime(),
        lastSynced: now,
        locallyModified: 0,
      });
    }
  }

  getState(): SyncState {
    return { ...this.state };
  }

  async forceSync(): Promise<void> {
    await this.syncAll();
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const syncService = new SyncService();
export default syncService;
