/**
 * CloudSync Service for RightAtHomeBnB
 *
 * Main sync service that synchronizes local SQLite data with Firebase Firestore.
 * Features:
 * - Real-time bidirectional sync
 * - Offline support with automatic queue processing
 * - Conflict resolution (last-write-wins by default)
 * - Sync status tracking
 */

import { v4 as uuidv4 } from 'uuid';
import EventEmitter from 'eventemitter3';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  Timestamp,
  Unsubscribe,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';

import { getFirestoreDb, isFirebaseInitialized, COLLECTIONS } from './firebase-config.js';
import { OfflineQueue, getOfflineQueue, initializeOfflineQueue } from './offline-queue.js';
import type {
  SyncableEntity,
  SyncOperation,
  SyncStatus,
  SyncResult,
  BulkSyncResult,
  SyncEvent,
  SyncEventListener,
  CloudSyncOptions,
  SyncMetadata,
  CloudDocument,
  SyncableRecord,
  CloudProperty,
  CloudPhoto,
  CloudBooking,
  CloudGuest,
  OfflineQueueItem,
  ConflictResolution,
  ENTITY_COLLECTION_MAP
} from './types.js';

// Re-export types
export * from './types.js';

// Default sync options
const DEFAULT_OPTIONS: Required<CloudSyncOptions> = {
  autoSync: true,
  syncInterval: 60000, // 1 minute
  batchSize: 50,
  maxRetries: 3,
  conflictResolution: 'last-write-wins',
  enableOfflineQueue: true,
  deviceId: typeof crypto !== 'undefined' ? crypto.randomUUID() : uuidv4()
};

// Entity to collection mapping
const ENTITY_TO_COLLECTION: Record<SyncableEntity, string> = {
  property: COLLECTIONS.PROPERTIES,
  photo: COLLECTIONS.PHOTOS,
  booking: COLLECTIONS.BOOKINGS,
  guest: COLLECTIONS.GUESTS,
  cleaningJob: COLLECTIONS.CLEANING_JOBS,
  smartLock: COLLECTIONS.SMART_LOCKS,
  message: COLLECTIONS.MESSAGES,
  expense: COLLECTIONS.EXPENSES,
  user: COLLECTIONS.USERS
};

export class CloudSync extends EventEmitter<{
  'sync:started': [SyncEvent];
  'sync:completed': [SyncEvent];
  'sync:error': [SyncEvent];
  'sync:progress': [SyncEvent];
  'sync:conflict': [SyncEvent];
  'sync:offline': [SyncEvent];
  'sync:online': [SyncEvent];
  'record:created': [SyncEvent];
  'record:updated': [SyncEvent];
  'record:deleted': [SyncEvent];
}> {
  private options: Required<CloudSyncOptions>;
  private offlineQueue: OfflineQueue | null = null;
  private listeners: Map<string, Unsubscribe> = new Map();
  private syncTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private isInitialized: boolean = false;
  private syncInProgress: Set<string> = new Set();
  private syncMetadata: Map<string, SyncMetadata> = new Map();

  constructor(options: CloudSyncOptions = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Initialize the CloudSync service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[CloudSync] Already initialized');
      return;
    }

    try {
      // Ensure Firebase is initialized
      await getFirestoreDb();

      // Initialize offline queue
      if (this.options.enableOfflineQueue) {
        this.offlineQueue = await initializeOfflineQueue({
          maxRetries: this.options.maxRetries,
          batchSize: this.options.batchSize
        });

        // Listen for connectivity changes
        this.offlineQueue.on('connectivity:changed', (online) => {
          const event: SyncEvent = {
            type: online ? 'sync:online' : 'sync:offline',
            timestamp: new Date()
          };
          this.emit(online ? 'sync:online' : 'sync:offline', event);

          if (online) {
            this.processOfflineQueue();
          }
        });
      }

      this.isInitialized = true;
      console.log('[CloudSync] Service initialized successfully');
    } catch (error) {
      console.error('[CloudSync] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Generate a checksum for conflict detection
   */
  private generateChecksum(data: unknown): string {
    const str = JSON.stringify(data, Object.keys(data as object).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Create sync metadata for a record
   */
  private createSyncMetadata(localId: string, cloudId?: string): SyncMetadata {
    return {
      localId,
      cloudId: cloudId || localId,
      lastSyncedAt: new Date().toISOString(),
      syncVersion: 1,
      deviceId: this.options.deviceId,
      checksum: ''
    };
  }

  /**
   * Convert local date fields to Firestore-compatible format
   */
  private prepareDataForFirestore(data: SyncableRecord): Record<string, unknown> {
    const prepared: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Date) {
        prepared[key] = Timestamp.fromDate(value);
      } else if (typeof value === 'string' && this.isISODateString(value)) {
        prepared[key] = Timestamp.fromDate(new Date(value));
      } else {
        prepared[key] = value;
      }
    }

    return prepared;
  }

  /**
   * Check if string is ISO date format
   */
  private isISODateString(str: string): boolean {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    return isoDateRegex.test(str);
  }

  /**
   * Convert Firestore document to local format
   */
  private convertFromFirestore<T extends SyncableRecord>(
    docData: DocumentData
  ): T {
    const converted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(docData)) {
      if (value instanceof Timestamp) {
        converted[key] = value.toDate().toISOString();
      } else if (value && typeof value === 'object' && '_seconds' in value) {
        // Handle serialized Timestamp
        converted[key] = new Date((value as { _seconds: number })._seconds * 1000).toISOString();
      } else {
        converted[key] = value;
      }
    }

    return converted as T;
  }

  /**
   * Sync a single property to Firestore
   */
  async syncProperty(property: CloudProperty): Promise<SyncResult> {
    return this.syncRecord('property', property);
  }

  /**
   * Sync all properties to Firestore
   */
  async syncAllProperties(properties: CloudProperty[]): Promise<BulkSyncResult> {
    return this.syncAllRecords('property', properties);
  }

  /**
   * Sync a single record to Firestore
   */
  async syncRecord<T extends SyncableRecord>(
    entityType: SyncableEntity,
    record: T
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const collectionName = ENTITY_TO_COLLECTION[entityType];
    const syncKey = `${entityType}:${record.id}`;

    // Check if sync is already in progress for this record
    if (this.syncInProgress.has(syncKey)) {
      return {
        success: false,
        recordId: record.id,
        entityType,
        operation: 'update',
        status: 'pending',
        error: 'Sync already in progress'
      };
    }

    // Check offline status
    if (this.offlineQueue && !this.offlineQueue.online) {
      await this.offlineQueue.enqueue(entityType, 'update', record.id, record);
      return {
        success: true,
        recordId: record.id,
        entityType,
        operation: 'update',
        status: 'pending'
      };
    }

    this.syncInProgress.add(syncKey);

    try {
      const db = await getFirestoreDb();
      const docRef = doc(db, collectionName, record.id);

      // Check for existing document
      const existingDoc = await getDoc(docRef);
      let operation: SyncOperation = existingDoc.exists() ? 'update' : 'create';
      let conflictResolution: ConflictResolution | undefined;

      // Handle conflicts if document exists
      if (existingDoc.exists()) {
        const remoteData = existingDoc.data() as CloudDocument<T>;
        const resolution = await this.resolveConflict(record, remoteData, entityType);

        if (resolution.winner === 'remote') {
          // Remote wins - return the remote data
          return {
            success: true,
            recordId: record.id,
            entityType,
            operation,
            status: 'synced',
            conflictResolution: resolution
          };
        }

        conflictResolution = resolution;
      }

      // Prepare document
      const syncMeta = this.createSyncMetadata(record.id);
      syncMeta.checksum = this.generateChecksum(record);

      const cloudDoc: CloudDocument<T> = {
        data: record,
        syncMeta,
        _serverTimestamp: serverTimestamp()
      };

      // Write to Firestore
      await setDoc(docRef, {
        ...this.prepareDataForFirestore(record),
        _syncMeta: syncMeta,
        _serverTimestamp: serverTimestamp()
      });

      // Store sync metadata locally
      this.syncMetadata.set(syncKey, syncMeta);

      // Emit event
      const event: SyncEvent = {
        type: operation === 'create' ? 'record:created' : 'record:updated',
        entityType,
        recordId: record.id,
        data: record,
        timestamp: new Date()
      };
      this.emit(event.type as 'record:created' | 'record:updated', event);

      return {
        success: true,
        recordId: record.id,
        entityType,
        operation,
        status: 'synced',
        conflictResolution
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Queue for retry if offline queue is enabled
      if (this.offlineQueue) {
        await this.offlineQueue.enqueue(entityType, 'update', record.id, record);
      }

      const event: SyncEvent = {
        type: 'sync:error',
        entityType,
        recordId: record.id,
        error: errorMsg,
        timestamp: new Date()
      };
      this.emit('sync:error', event);

      return {
        success: false,
        recordId: record.id,
        entityType,
        operation: 'update',
        status: 'error',
        error: errorMsg
      };
    } finally {
      this.syncInProgress.delete(syncKey);
    }
  }

  /**
   * Sync multiple records in batch
   */
  async syncAllRecords<T extends SyncableRecord>(
    entityType: SyncableEntity,
    records: T[]
  ): Promise<BulkSyncResult> {
    const startTime = Date.now();
    const results: SyncResult[] = [];
    let successCount = 0;
    let errorCount = 0;
    let conflictCount = 0;

    // Emit start event
    const startEvent: SyncEvent = {
      type: 'sync:started',
      entityType,
      timestamp: new Date(),
      progress: { current: 0, total: records.length, percentage: 0 }
    };
    this.emit('sync:started', startEvent);

    // Process in batches
    for (let i = 0; i < records.length; i += this.options.batchSize) {
      const batch = records.slice(i, i + this.options.batchSize);

      // Process batch concurrently
      const batchResults = await Promise.all(
        batch.map(record => this.syncRecord(entityType, record))
      );

      for (const result of batchResults) {
        results.push(result);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
        if (result.conflictResolution) {
          conflictCount++;
        }
      }

      // Emit progress
      const progressEvent: SyncEvent = {
        type: 'sync:progress',
        entityType,
        timestamp: new Date(),
        progress: {
          current: Math.min(i + this.options.batchSize, records.length),
          total: records.length,
          percentage: Math.round(((i + this.options.batchSize) / records.length) * 100)
        }
      };
      this.emit('sync:progress', progressEvent);
    }

    // Emit completion event
    const completedEvent: SyncEvent = {
      type: 'sync:completed',
      entityType,
      timestamp: new Date(),
      progress: { current: records.length, total: records.length, percentage: 100 }
    };
    this.emit('sync:completed', completedEvent);

    return {
      totalRecords: records.length,
      successCount,
      errorCount,
      conflictCount,
      results,
      duration: Date.now() - startTime
    };
  }

  /**
   * Delete a record from Firestore
   */
  async deleteRecord(entityType: SyncableEntity, recordId: string): Promise<SyncResult> {
    const collectionName = ENTITY_TO_COLLECTION[entityType];

    // Check offline status
    if (this.offlineQueue && !this.offlineQueue.online) {
      await this.offlineQueue.enqueue(entityType, 'delete', recordId, null);
      return {
        success: true,
        recordId,
        entityType,
        operation: 'delete',
        status: 'pending'
      };
    }

    try {
      const db = await getFirestoreDb();
      const docRef = doc(db, collectionName, recordId);

      await deleteDoc(docRef);

      // Remove from sync metadata
      this.syncMetadata.delete(`${entityType}:${recordId}`);

      const event: SyncEvent = {
        type: 'record:deleted',
        entityType,
        recordId,
        timestamp: new Date()
      };
      this.emit('record:deleted', event);

      return {
        success: true,
        recordId,
        entityType,
        operation: 'delete',
        status: 'synced'
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (this.offlineQueue) {
        await this.offlineQueue.enqueue(entityType, 'delete', recordId, null);
      }

      return {
        success: false,
        recordId,
        entityType,
        operation: 'delete',
        status: 'error',
        error: errorMsg
      };
    }
  }

  /**
   * Listen for real-time changes from Firestore
   */
  listenForChanges<T extends SyncableRecord>(
    entityType: SyncableEntity,
    callback: (changes: Array<{ type: 'added' | 'modified' | 'removed'; data: T }>) => void
  ): () => void {
    const collectionName = ENTITY_TO_COLLECTION[entityType];
    const listenerKey = `listener:${entityType}`;

    // Remove existing listener if any
    this.stopListening(entityType);

    const db = getFirestoreDb();

    // Create listener
    const unsubscribe = db.then(firestore => {
      const collRef = collection(firestore, collectionName);
      const q = query(collRef, orderBy('_serverTimestamp', 'desc'), limit(100));

      return onSnapshot(q, (snapshot) => {
        const changes: Array<{ type: 'added' | 'modified' | 'removed'; data: T }> = [];

        snapshot.docChanges().forEach((change) => {
          const docData = change.doc.data();
          const convertedData = this.convertFromFirestore<T>(docData);

          changes.push({
            type: change.type,
            data: convertedData
          });
        });

        if (changes.length > 0) {
          callback(changes);
        }
      }, (error) => {
        console.error(`[CloudSync] Listener error for ${entityType}:`, error);
        const event: SyncEvent = {
          type: 'sync:error',
          entityType,
          error: error.message,
          timestamp: new Date()
        };
        this.emit('sync:error', event);
      });
    });

    unsubscribe.then(unsub => {
      this.listeners.set(listenerKey, unsub);
    });

    console.log(`[CloudSync] Started listening for ${entityType} changes`);

    // Return cleanup function
    return () => this.stopListening(entityType);
  }

  /**
   * Stop listening for changes on an entity type
   */
  stopListening(entityType: SyncableEntity): void {
    const listenerKey = `listener:${entityType}`;
    const unsubscribe = this.listeners.get(listenerKey);

    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(listenerKey);
      console.log(`[CloudSync] Stopped listening for ${entityType} changes`);
    }
  }

  /**
   * Resolve conflicts between local and remote data
   */
  async resolveConflict<T extends SyncableRecord>(
    localData: T,
    remoteDoc: CloudDocument<T>,
    entityType: SyncableEntity
  ): Promise<ConflictResolution> {
    const localUpdatedAt = new Date(localData.updatedAt).getTime();
    const remoteUpdatedAt = new Date(remoteDoc.data.updatedAt).getTime();

    switch (this.options.conflictResolution) {
      case 'local-wins':
        return {
          winner: 'local',
          timestamp: new Date().toISOString()
        };

      case 'remote-wins':
        return {
          winner: 'remote',
          timestamp: new Date().toISOString()
        };

      case 'last-write-wins':
      default:
        // Compare timestamps - most recent wins
        if (localUpdatedAt >= remoteUpdatedAt) {
          return {
            winner: 'local',
            timestamp: new Date().toISOString()
          };
        } else {
          // Emit conflict event for visibility
          const event: SyncEvent = {
            type: 'sync:conflict',
            entityType,
            recordId: localData.id,
            data: { local: localData, remote: remoteDoc.data },
            timestamp: new Date()
          };
          this.emit('sync:conflict', event);

          return {
            winner: 'remote',
            timestamp: new Date().toISOString()
          };
        }
    }
  }

  /**
   * Process the offline queue
   */
  private async processOfflineQueue(): Promise<void> {
    if (!this.offlineQueue) return;

    const results = await this.offlineQueue.processQueue(async (item) => {
      const result = await this.processQueueItem(item);
      return result.success;
    });

    console.log(`[CloudSync] Processed offline queue: ${results.processed} success, ${results.failed} failed`);
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(item: OfflineQueueItem): Promise<SyncResult> {
    switch (item.operation) {
      case 'create':
      case 'update':
        return this.syncRecord(item.entityType, item.data as SyncableRecord);

      case 'delete':
        return this.deleteRecord(item.entityType, item.recordId);

      default:
        return {
          success: false,
          recordId: item.recordId,
          entityType: item.entityType,
          operation: item.operation,
          status: 'error',
          error: `Unknown operation: ${item.operation}`
        };
    }
  }

  /**
   * Fetch all records from Firestore for an entity type
   */
  async fetchAll<T extends SyncableRecord>(entityType: SyncableEntity): Promise<T[]> {
    const collectionName = ENTITY_TO_COLLECTION[entityType];

    try {
      const db = await getFirestoreDb();
      const collRef = collection(db, collectionName);
      const snapshot = await getDocs(collRef);

      const records: T[] = [];
      snapshot.forEach((doc) => {
        records.push(this.convertFromFirestore<T>(doc.data()));
      });

      return records;
    } catch (error) {
      console.error(`[CloudSync] Failed to fetch ${entityType} records:`, error);
      throw error;
    }
  }

  /**
   * Fetch a single record from Firestore
   */
  async fetchOne<T extends SyncableRecord>(
    entityType: SyncableEntity,
    recordId: string
  ): Promise<T | null> {
    const collectionName = ENTITY_TO_COLLECTION[entityType];

    try {
      const db = await getFirestoreDb();
      const docRef = doc(db, collectionName, recordId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return this.convertFromFirestore<T>(docSnap.data());
    } catch (error) {
      console.error(`[CloudSync] Failed to fetch ${entityType}:${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Get sync status for a record
   */
  getSyncStatus(entityType: SyncableEntity, recordId: string): SyncStatus {
    const syncKey = `${entityType}:${recordId}`;

    // Check if in offline queue
    if (this.offlineQueue) {
      const queueItems = this.offlineQueue.getItemsByRecordId(recordId);
      if (queueItems.length > 0) {
        const hasError = queueItems.some(item => item.lastError);
        return hasError ? 'error' : 'pending';
      }
    }

    // Check if currently syncing
    if (this.syncInProgress.has(syncKey)) {
      return 'pending';
    }

    // Check if has sync metadata (has been synced before)
    if (this.syncMetadata.has(syncKey)) {
      return 'synced';
    }

    return 'pending';
  }

  /**
   * Get offline queue instance
   */
  getOfflineQueue(): OfflineQueue | null {
    return this.offlineQueue;
  }

  /**
   * Check if currently online
   */
  get isOnline(): boolean {
    return this.offlineQueue ? this.offlineQueue.online : true;
  }

  /**
   * Check if service is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Stop all listeners
    for (const [key, unsubscribe] of this.listeners) {
      unsubscribe();
    }
    this.listeners.clear();

    // Clear sync timers
    for (const timer of this.syncTimers.values()) {
      clearInterval(timer);
    }
    this.syncTimers.clear();

    // Destroy offline queue
    if (this.offlineQueue) {
      this.offlineQueue.destroy();
    }

    // Clear event listeners
    this.removeAllListeners();

    this.isInitialized = false;
    console.log('[CloudSync] Service destroyed');
  }
}

// Singleton instance
let cloudSyncInstance: CloudSync | null = null;

/**
 * Get or create the singleton CloudSync instance
 */
export function getCloudSync(options?: CloudSyncOptions): CloudSync {
  if (!cloudSyncInstance) {
    cloudSyncInstance = new CloudSync(options);
  }
  return cloudSyncInstance;
}

/**
 * Initialize the CloudSync service
 */
export async function initializeCloudSync(options?: CloudSyncOptions): Promise<CloudSync> {
  const sync = getCloudSync(options);
  await sync.initialize();
  return sync;
}
