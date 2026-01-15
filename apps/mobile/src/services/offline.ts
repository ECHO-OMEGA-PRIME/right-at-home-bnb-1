/**
 * Right at Home BnB - Offline Sync Service
 * Queue operations when offline, sync when back online
 * @author ECHO OMEGA PRIME
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { EventEmitter } from 'events';

// Storage keys
const OFFLINE_QUEUE_KEY = '@rightathome_offline_queue';
const CACHED_DATA_KEY = '@rightathome_cached_data';
const LAST_SYNC_KEY = '@rightathome_last_sync';

export interface QueuedOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'UPLOAD';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: any;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'normal' | 'low';
}

export interface CachedData {
  key: string;
  data: any;
  timestamp: number;
  expiresAt: number | null;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: number;
  lastSyncTime: number | null;
  lastError: string | null;
}

class OfflineSyncService extends EventEmitter {
  private queue: QueuedOperation[] = [];
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private netInfoSubscription: NetInfoSubscription | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: number | null = null;
  private lastError: string | null = null;

  constructor() {
    super();
    this.initialize();
  }

  /**
   * Initialize the offline sync service
   */
  private async initialize(): Promise<void> {
    // Load queued operations from storage
    await this.loadQueue();

    // Check initial network state
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;

    // Subscribe to network changes
    this.netInfoSubscription = NetInfo.addEventListener(this.handleNetworkChange);

    // Load last sync time
    const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
    this.lastSyncTime = lastSync ? parseInt(lastSync) : null;

    // Start sync interval (every 30 seconds when online)
    this.startSyncInterval();
  }

  /**
   * Handle network state changes
   */
  private handleNetworkChange = async (state: NetInfoState): Promise<void> => {
    const wasOffline = !this.isOnline;
    this.isOnline = state.isConnected ?? false;

    this.emit('networkChange', this.isOnline);

    // If we just came online, sync
    if (wasOffline && this.isOnline) {
      console.log('Network restored, starting sync...');
      await this.sync();
    }
  };

  /**
   * Start periodic sync interval
   */
  private startSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.isOnline && this.queue.length > 0 && !this.isSyncing) {
        await this.sync();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Load queue from AsyncStorage
   */
  private async loadQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      this.queue = data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to AsyncStorage
   */
  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  /**
   * Add operation to offline queue
   */
  public async queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const queuedOp: QueuedOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: operation.maxRetries || 3,
    };

    // Add to queue based on priority
    if (operation.priority === 'high') {
      this.queue.unshift(queuedOp);
    } else {
      this.queue.push(queuedOp);
    }

    await this.saveQueue();
    this.emit('queueUpdated', this.queue.length);

    // If online, try to sync immediately
    if (this.isOnline && !this.isSyncing) {
      this.sync();
    }

    return id;
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: QueuedOperation): Promise<boolean> {
    try {
      const response = await fetch(operation.endpoint, {
        method: operation.method,
        headers: {
          'Content-Type': 'application/json',
          ...operation.headers,
        },
        body: operation.data ? JSON.stringify(operation.data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error(`Operation ${operation.id} failed:`, error);
      return false;
    }
  }

  /**
   * Sync all queued operations
   */
  public async sync(): Promise<{
    success: number;
    failed: number;
    remaining: number;
  }> {
    if (!this.isOnline || this.isSyncing || this.queue.length === 0) {
      return { success: 0, failed: 0, remaining: this.queue.length };
    }

    this.isSyncing = true;
    this.emit('syncStarted');

    let success = 0;
    let failed = 0;
    const failedOperations: QueuedOperation[] = [];

    for (const operation of [...this.queue]) {
      const result = await this.processOperation(operation);

      if (result) {
        success++;
        // Remove from queue
        this.queue = this.queue.filter((op) => op.id !== operation.id);
      } else {
        operation.retryCount++;

        if (operation.retryCount >= operation.maxRetries) {
          // Max retries reached, remove from queue
          this.queue = this.queue.filter((op) => op.id !== operation.id);
          failed++;
          this.lastError = `Operation ${operation.id} failed after ${operation.maxRetries} retries`;
        } else {
          failedOperations.push(operation);
        }
      }

      this.emit('syncProgress', {
        processed: success + failed,
        total: this.queue.length + success + failed,
      });
    }

    await this.saveQueue();

    this.lastSyncTime = Date.now();
    await AsyncStorage.setItem(LAST_SYNC_KEY, this.lastSyncTime.toString());

    this.isSyncing = false;
    this.emit('syncCompleted', { success, failed, remaining: this.queue.length });

    return { success, failed, remaining: this.queue.length };
  }

  /**
   * Cache data locally
   */
  public async cacheData(key: string, data: any, expiresInMs?: number): Promise<void> {
    try {
      const cachedData: CachedData = {
        key,
        data,
        timestamp: Date.now(),
        expiresAt: expiresInMs ? Date.now() + expiresInMs : null,
      };

      const allCached = await this.getAllCachedData();
      allCached[key] = cachedData;

      await AsyncStorage.setItem(CACHED_DATA_KEY, JSON.stringify(allCached));
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  /**
   * Get cached data
   */
  public async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const allCached = await this.getAllCachedData();
      const cached = allCached[key];

      if (!cached) return null;

      // Check expiration
      if (cached.expiresAt && Date.now() > cached.expiresAt) {
        // Expired, remove it
        delete allCached[key];
        await AsyncStorage.setItem(CACHED_DATA_KEY, JSON.stringify(allCached));
        return null;
      }

      return cached.data as T;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  /**
   * Get all cached data
   */
  private async getAllCachedData(): Promise<Record<string, CachedData>> {
    try {
      const data = await AsyncStorage.getItem(CACHED_DATA_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Clear expired cache
   */
  public async clearExpiredCache(): Promise<void> {
    try {
      const allCached = await this.getAllCachedData();
      const now = Date.now();
      let hasChanges = false;

      for (const key of Object.keys(allCached)) {
        if (allCached[key].expiresAt && now > allCached[key].expiresAt) {
          delete allCached[key];
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await AsyncStorage.setItem(CACHED_DATA_KEY, JSON.stringify(allCached));
      }
    } catch (error) {
      console.error('Error clearing expired cache:', error);
    }
  }

  /**
   * Clear all cached data
   */
  public async clearAllCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHED_DATA_KEY);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Clear offline queue
   */
  public async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
    this.emit('queueUpdated', 0);
  }

  /**
   * Get sync status
   */
  public getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingOperations: this.queue.length,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    };
  }

  /**
   * Get pending operations
   */
  public getPendingOperations(): QueuedOperation[] {
    return [...this.queue];
  }

  /**
   * Clean up subscriptions
   */
  public destroy(): void {
    if (this.netInfoSubscription) {
      this.netInfoSubscription();
      this.netInfoSubscription = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.removeAllListeners();
  }
}

// Singleton instance
export const offlineSync = new OfflineSyncService();

// Helper function for offline-aware fetch
export async function offlineFetch(
  url: string,
  options?: RequestInit & {
    offlineQueue?: boolean;
    cacheDuration?: number;
    cacheKey?: string;
  }
): Promise<Response | null> {
  const { offlineQueue = true, cacheDuration, cacheKey, ...fetchOptions } = options || {};
  const status = offlineSync.getStatus();

  // If online, try to fetch
  if (status.isOnline) {
    try {
      const response = await fetch(url, fetchOptions);

      // Cache successful GET responses
      if (response.ok && fetchOptions?.method !== 'POST' && cacheKey) {
        const data = await response.clone().json();
        await offlineSync.cacheData(cacheKey, data, cacheDuration);
      }

      return response;
    } catch (error) {
      // Network error, fall through to offline handling
    }
  }

  // Offline handling
  if (offlineQueue && fetchOptions?.method && fetchOptions.method !== 'GET') {
    // Queue the operation for later
    await offlineSync.queueOperation({
      type: 'CREATE',
      endpoint: url,
      method: fetchOptions.method as any,
      data: fetchOptions.body ? JSON.parse(fetchOptions.body as string) : undefined,
      headers: fetchOptions.headers as Record<string, string>,
      priority: 'normal',
      maxRetries: 3,
    });

    // Return a fake success response
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      statusText: 'Accepted - Queued for sync',
    });
  }

  // For GET requests, try to return cached data
  if (cacheKey) {
    const cached = await offlineSync.getCachedData(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        statusText: 'OK - From cache',
      });
    }
  }

  return null;
}
