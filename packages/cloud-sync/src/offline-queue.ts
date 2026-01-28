/**
 * Offline Queue Manager for RightAtHomeBnB CloudSync
 *
 * Queues changes when offline and processes them when connectivity is restored.
 * Uses IndexedDB for persistence with automatic retry logic.
 */

import { v4 as uuidv4 } from 'uuid';
import EventEmitter from 'eventemitter3';
import type {
  OfflineQueueItem,
  SyncableEntity,
  SyncOperation,
  SyncEvent,
  SyncEventListener
} from './types.js';

// IndexedDB database name and version
const DB_NAME = 'rightathome_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

export interface OfflineQueueOptions {
  maxRetries?: number;
  retryDelay?: number; // ms
  batchSize?: number;
  enablePersistence?: boolean;
}

export class OfflineQueue extends EventEmitter<{
  'queue:added': [OfflineQueueItem];
  'queue:processed': [OfflineQueueItem];
  'queue:error': [OfflineQueueItem, Error];
  'queue:cleared': [];
  'connectivity:changed': [boolean];
}> {
  private db: IDBDatabase | null = null;
  private memoryQueue: OfflineQueueItem[] = [];
  private isOnline: boolean = true;
  private isProcessing: boolean = false;
  private options: Required<OfflineQueueOptions>;
  private connectivityCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: OfflineQueueOptions = {}) {
    super();
    this.options = {
      maxRetries: options.maxRetries ?? 5,
      retryDelay: options.retryDelay ?? 5000,
      batchSize: options.batchSize ?? 10,
      enablePersistence: options.enablePersistence ?? true
    };

    // Initialize connectivity listeners
    this.setupConnectivityListeners();
  }

  /**
   * Initialize the offline queue (opens IndexedDB)
   */
  async initialize(): Promise<void> {
    if (!this.options.enablePersistence || typeof indexedDB === 'undefined') {
      console.log('[OfflineQueue] Using memory-only queue (IndexedDB not available)');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineQueue] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OfflineQueue] IndexedDB initialized successfully');
        this.loadQueueFromDb().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('entityType', 'entityType', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
          console.log('[OfflineQueue] Created IndexedDB object store');
        }
      };
    });
  }

  /**
   * Set up browser connectivity listeners
   */
  private setupConnectivityListeners(): void {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.emit('connectivity:changed', true);
        console.log('[OfflineQueue] Back online - processing queued items');
        this.processQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.emit('connectivity:changed', false);
        console.log('[OfflineQueue] Gone offline - queueing changes');
      });
    }

    // Periodic connectivity check
    this.connectivityCheckInterval = setInterval(() => {
      this.checkConnectivity();
    }, 30000);
  }

  /**
   * Check actual connectivity by pinging Firestore
   */
  private async checkConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch('https://firestore.googleapis.com/', {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!this.isOnline) {
        this.isOnline = true;
        this.emit('connectivity:changed', true);
      }
      return true;
    } catch {
      if (this.isOnline) {
        this.isOnline = false;
        this.emit('connectivity:changed', false);
      }
      return false;
    }
  }

  /**
   * Load existing queue items from IndexedDB
   */
  private async loadQueueFromDb(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        this.memoryQueue = request.result || [];
        console.log(`[OfflineQueue] Loaded ${this.memoryQueue.length} items from IndexedDB`);
        resolve();
      };

      request.onerror = () => {
        console.error('[OfflineQueue] Failed to load queue from IndexedDB');
        reject(request.error);
      };
    });
  }

  /**
   * Add an item to the offline queue
   */
  async enqueue(
    entityType: SyncableEntity,
    operation: SyncOperation,
    recordId: string,
    data: unknown,
    priority: number = 5
  ): Promise<OfflineQueueItem> {
    const item: OfflineQueueItem = {
      id: uuidv4(),
      entityType,
      operation,
      recordId,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      priority
    };

    // Add to memory queue
    this.memoryQueue.push(item);
    this.sortQueue();

    // Persist to IndexedDB
    if (this.db) {
      await this.persistItem(item);
    }

    this.emit('queue:added', item);
    console.log(`[OfflineQueue] Enqueued ${operation} for ${entityType}:${recordId}`);

    // If online, try to process immediately
    if (this.isOnline && !this.isProcessing) {
      this.processQueue();
    }

    return item;
  }

  /**
   * Persist item to IndexedDB
   */
  private async persistItem(item: OfflineQueueItem): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove item from IndexedDB
   */
  private async removeItem(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sort queue by priority (higher first) and timestamp (older first)
   */
  private sortQueue(): void {
    this.memoryQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  /**
   * Process the queue (called when online)
   */
  async processQueue(
    processor?: (item: OfflineQueueItem) => Promise<boolean>
  ): Promise<{ processed: number; failed: number }> {
    if (this.isProcessing || !this.isOnline) {
      return { processed: 0, failed: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let failed = 0;

    try {
      const batch = this.memoryQueue.slice(0, this.options.batchSize);

      for (const item of batch) {
        try {
          let success = false;

          if (processor) {
            success = await processor(item);
          } else {
            // Default: just mark as processed (actual sync should provide processor)
            success = true;
          }

          if (success) {
            // Remove from queue
            this.memoryQueue = this.memoryQueue.filter(i => i.id !== item.id);
            await this.removeItem(item.id);
            this.emit('queue:processed', item);
            processed++;
          } else {
            throw new Error('Processor returned false');
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          item.retryCount++;
          item.lastError = err.message;

          if (item.retryCount >= this.options.maxRetries) {
            // Move to dead letter (keep in memory but mark as failed)
            this.emit('queue:error', item, err);
            failed++;
          } else {
            // Update item with retry info
            await this.persistItem(item);
          }
        }
      }

      // Continue processing if there are more items
      if (this.memoryQueue.length > processed + failed && this.isOnline) {
        setTimeout(() => this.processQueue(processor), this.options.retryDelay);
      }
    } finally {
      this.isProcessing = false;
    }

    return { processed, failed };
  }

  /**
   * Get all pending items in the queue
   */
  getPendingItems(): OfflineQueueItem[] {
    return [...this.memoryQueue];
  }

  /**
   * Get items by entity type
   */
  getItemsByEntityType(entityType: SyncableEntity): OfflineQueueItem[] {
    return this.memoryQueue.filter(item => item.entityType === entityType);
  }

  /**
   * Get items by record ID
   */
  getItemsByRecordId(recordId: string): OfflineQueueItem[] {
    return this.memoryQueue.filter(item => item.recordId === recordId);
  }

  /**
   * Get queue size
   */
  get size(): number {
    return this.memoryQueue.length;
  }

  /**
   * Check if queue has pending items
   */
  get hasPending(): boolean {
    return this.memoryQueue.length > 0;
  }

  /**
   * Check current online status
   */
  get online(): boolean {
    return this.isOnline;
  }

  /**
   * Clear the entire queue
   */
  async clear(): Promise<void> {
    this.memoryQueue = [];

    if (this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          this.emit('queue:cleared');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }

    this.emit('queue:cleared');
  }

  /**
   * Remove a specific item from queue
   */
  async remove(id: string): Promise<boolean> {
    const index = this.memoryQueue.findIndex(item => item.id === id);
    if (index === -1) return false;

    this.memoryQueue.splice(index, 1);
    await this.removeItem(id);
    return true;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.connectivityCheckInterval) {
      clearInterval(this.connectivityCheckInterval);
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.removeAllListeners();
    console.log('[OfflineQueue] Destroyed');
  }
}

// Singleton instance
let queueInstance: OfflineQueue | null = null;

/**
 * Get or create the singleton offline queue instance
 */
export function getOfflineQueue(options?: OfflineQueueOptions): OfflineQueue {
  if (!queueInstance) {
    queueInstance = new OfflineQueue(options);
  }
  return queueInstance;
}

/**
 * Initialize the singleton queue
 */
export async function initializeOfflineQueue(
  options?: OfflineQueueOptions
): Promise<OfflineQueue> {
  const queue = getOfflineQueue(options);
  await queue.initialize();
  return queue;
}
