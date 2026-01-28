/**
 * React Hooks for RightAtHomeBnB CloudSync
 *
 * Custom hooks for integrating CloudSync with React applications.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CloudSync, getCloudSync, initializeCloudSync } from './cloud-sync.js';
import { SyncStatusTracker, getSyncStatusTracker } from './sync-status-tracker.js';
import { OfflineQueue, getOfflineQueue } from './offline-queue.js';
import type {
  SyncableEntity,
  SyncStatus,
  SyncEvent,
  SyncStatusSummary,
  CloudSyncOptions,
  SyncableRecord,
  BulkSyncResult,
  TrackedRecord
} from './types.js';

export interface UseCloudSyncReturn {
  isInitialized: boolean;
  isOnline: boolean;
  syncProperty: (property: SyncableRecord) => Promise<void>;
  syncAllRecords: <T extends SyncableRecord>(entityType: SyncableEntity, records: T[]) => Promise<BulkSyncResult>;
  listenForChanges: <T extends SyncableRecord>(
    entityType: SyncableEntity,
    callback: (changes: Array<{ type: 'added' | 'modified' | 'removed'; data: T }>) => void
  ) => () => void;
  getSyncStatus: (entityType: SyncableEntity, recordId: string) => SyncStatus;
  summary: SyncStatusSummary;
  pendingCount: number;
  errorCount: number;
  error: Error | null;
}

/**
 * Main CloudSync hook
 */
export function useCloudSync(options?: CloudSyncOptions): UseCloudSyncReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [summary, setSummary] = useState<SyncStatusSummary>({
    total: 0,
    synced: 0,
    pending: 0,
    error: 0,
    conflict: 0,
    byEntityType: {} as Record<SyncableEntity, { total: number; synced: number; pending: number; error: number }>
  });
  const [error, setError] = useState<Error | null>(null);

  const cloudSyncRef = useRef<CloudSync | null>(null);
  const statusTrackerRef = useRef<SyncStatusTracker | null>(null);

  // Initialize
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const cloudSync = await initializeCloudSync(options);
        const tracker = getSyncStatusTracker();

        if (!mounted) return;

        cloudSyncRef.current = cloudSync;
        statusTrackerRef.current = tracker;

        // Connect sync events to tracker
        cloudSync.on('record:created', (event) => tracker.processSyncEvent(event));
        cloudSync.on('record:updated', (event) => tracker.processSyncEvent(event));
        cloudSync.on('record:deleted', (event) => tracker.processSyncEvent(event));
        cloudSync.on('sync:error', (event) => {
          tracker.processSyncEvent(event);
          if (event.error) {
            setError(new Error(event.error));
          }
        });
        cloudSync.on('sync:conflict', (event) => tracker.processSyncEvent(event));

        // Listen for online/offline
        cloudSync.on('sync:online', () => setIsOnline(true));
        cloudSync.on('sync:offline', () => setIsOnline(false));

        // Listen for summary updates
        tracker.on('summary:updated', (newSummary) => setSummary(newSummary));

        setIsOnline(cloudSync.isOnline);
        setSummary(tracker.getSummary());
        setIsInitialized(true);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [options]);

  // Sync property
  const syncProperty = useCallback(async (property: SyncableRecord) => {
    if (!cloudSyncRef.current) throw new Error('CloudSync not initialized');
    await cloudSyncRef.current.syncProperty(property as any);
  }, []);

  // Sync all records
  const syncAllRecords = useCallback(async <T extends SyncableRecord>(
    entityType: SyncableEntity,
    records: T[]
  ): Promise<BulkSyncResult> => {
    if (!cloudSyncRef.current) throw new Error('CloudSync not initialized');
    return cloudSyncRef.current.syncAllRecords(entityType, records);
  }, []);

  // Listen for changes
  const listenForChanges = useCallback(<T extends SyncableRecord>(
    entityType: SyncableEntity,
    callback: (changes: Array<{ type: 'added' | 'modified' | 'removed'; data: T }>) => void
  ): () => void => {
    if (!cloudSyncRef.current) {
      console.warn('[useCloudSync] Not initialized, cannot listen for changes');
      return () => {};
    }
    return cloudSyncRef.current.listenForChanges(entityType, callback);
  }, []);

  // Get sync status
  const getSyncStatus = useCallback((entityType: SyncableEntity, recordId: string): SyncStatus => {
    if (!statusTrackerRef.current) return 'pending';
    return statusTrackerRef.current.getStatusValue(entityType, recordId);
  }, []);

  return {
    isInitialized,
    isOnline,
    syncProperty,
    syncAllRecords,
    listenForChanges,
    getSyncStatus,
    summary,
    pendingCount: summary.pending,
    errorCount: summary.error,
    error
  };
}

/**
 * Hook for tracking sync status of a specific record
 */
export function useSyncStatus(entityType: SyncableEntity, recordId: string): {
  status: SyncStatus;
  tracked: TrackedRecord | undefined;
  isPending: boolean;
  isError: boolean;
  isSynced: boolean;
  errorMessage?: string;
} {
  const [tracked, setTracked] = useState<TrackedRecord | undefined>();
  const trackerRef = useRef<SyncStatusTracker | null>(null);

  useEffect(() => {
    const tracker = getSyncStatusTracker();
    trackerRef.current = tracker;

    // Initial value
    setTracked(tracker.getStatus(entityType, recordId));

    // Listen for changes
    const handler = (record: TrackedRecord) => {
      if (record.entityType === entityType && record.recordId === recordId) {
        setTracked(record);
      }
    };

    tracker.on('status:changed', handler);

    return () => {
      tracker.off('status:changed', handler);
    };
  }, [entityType, recordId]);

  return {
    status: tracked?.status ?? 'pending',
    tracked,
    isPending: tracked?.status === 'pending',
    isError: tracked?.status === 'error',
    isSynced: tracked?.status === 'synced',
    errorMessage: tracked?.errorMessage
  };
}

/**
 * Hook for online/offline status
 */
export function useOnlineStatus(): {
  isOnline: boolean;
  wasOffline: boolean;
  offlineDuration: number | null;
} {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [offlineStart, setOfflineStart] = useState<number | null>(null);
  const [offlineDuration, setOfflineDuration] = useState<number | null>(null);

  useEffect(() => {
    const queue = getOfflineQueue();

    setIsOnline(queue.online);

    const handler = (online: boolean) => {
      setIsOnline(online);

      if (!online) {
        setOfflineStart(Date.now());
        setWasOffline(true);
      } else if (offlineStart) {
        setOfflineDuration(Date.now() - offlineStart);
        setOfflineStart(null);
      }
    };

    queue.on('connectivity:changed', handler);

    return () => {
      queue.off('connectivity:changed', handler);
    };
  }, [offlineStart]);

  return { isOnline, wasOffline, offlineDuration };
}

/**
 * Hook for offline queue status
 */
export function useOfflineQueue(): {
  queueSize: number;
  hasPending: boolean;
  isOnline: boolean;
  items: Array<{ id: string; entityType: SyncableEntity; operation: string; recordId: string }>;
} {
  const [queueSize, setQueueSize] = useState(0);
  const [items, setItems] = useState<Array<{ id: string; entityType: SyncableEntity; operation: string; recordId: string }>>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const queue = getOfflineQueue();

    const updateState = () => {
      setQueueSize(queue.size);
      setItems(queue.getPendingItems().map(item => ({
        id: item.id,
        entityType: item.entityType,
        operation: item.operation,
        recordId: item.recordId
      })));
      setIsOnline(queue.online);
    };

    updateState();

    queue.on('queue:added', updateState);
    queue.on('queue:processed', updateState);
    queue.on('queue:cleared', updateState);
    queue.on('connectivity:changed', (online) => setIsOnline(online));

    return () => {
      queue.off('queue:added', updateState);
      queue.off('queue:processed', updateState);
      queue.off('queue:cleared', updateState);
    };
  }, []);

  return {
    queueSize,
    hasPending: queueSize > 0,
    isOnline,
    items
  };
}

/**
 * Hook for real-time listener subscription
 */
export function useFirestoreListener<T extends SyncableRecord>(
  entityType: SyncableEntity,
  onData: (data: T[]) => void
): {
  isListening: boolean;
  error: Error | null;
  stopListening: () => void;
} {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const cloudSync = getCloudSync();

    if (!cloudSync.initialized) {
      return;
    }

    const dataMap = new Map<string, T>();

    try {
      unsubscribeRef.current = cloudSync.listenForChanges<T>(entityType, (changes) => {
        for (const change of changes) {
          if (change.type === 'removed') {
            dataMap.delete(change.data.id);
          } else {
            dataMap.set(change.data.id, change.data);
          }
        }
        onData(Array.from(dataMap.values()));
      });

      setIsListening(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setIsListening(false);
    };
  }, [entityType, onData]);

  const stopListening = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      setIsListening(false);
    }
  }, []);

  return { isListening, error, stopListening };
}
