/**
 * RightAtHomeBnB CloudSync Module
 *
 * Synchronizes local SQLite data with Firebase Firestore in real-time.
 *
 * Features:
 * - Real-time bidirectional sync
 * - Offline support with automatic queue processing
 * - Conflict resolution (configurable strategies)
 * - Sync status tracking
 * - React hooks for UI integration
 *
 * @package @rightathome/cloud-sync
 * @version 1.0.0
 */

// Firebase configuration
export {
  initializeFirebase,
  getFirestoreDb,
  getFirestoreSync,
  isFirebaseInitialized,
  getFirebaseApp,
  cleanupFirebase,
  firebaseConfig,
  COLLECTIONS,
  type CollectionName,
  type FirebaseInitOptions
} from './firebase-config.js';

// Main CloudSync service
export {
  CloudSync,
  getCloudSync,
  initializeCloudSync
} from './cloud-sync.js';

// Offline queue
export {
  OfflineQueue,
  getOfflineQueue,
  initializeOfflineQueue,
  type OfflineQueueOptions
} from './offline-queue.js';

// Sync status tracker
export {
  SyncStatusTracker,
  getSyncStatusTracker,
  type TrackedRecord,
  type SyncStatusSummary
} from './sync-status-tracker.js';

// Prisma adapter
export {
  PrismaCloudSyncAdapter,
  createPrismaAdapter,
  propertyToCloud,
  photoToCloud,
  bookingToCloud,
  guestToCloud
} from './prisma-adapter.js';

// React hooks
export {
  useCloudSync,
  useSyncStatus,
  useOnlineStatus,
  useOfflineQueue,
  useFirestoreListener,
  type UseCloudSyncReturn
} from './hooks.js';

// Types
export type {
  SyncStatus,
  SyncOperation,
  SyncableEntity,
  SyncableRecord,
  SyncMetadata,
  CloudDocument,
  SyncMetadataDoc,
  SyncError,
  OfflineQueueItem,
  ConflictResolution,
  SyncResult,
  BulkSyncResult,
  SyncEventType,
  SyncEvent,
  SyncEventListener,
  CloudSyncOptions,
  CloudProperty,
  CloudPhoto,
  CloudBooking,
  CloudGuest
} from './types.js';

// Type guards
export {
  isCloudProperty,
  isCloudBooking,
  isCloudGuest,
  ENTITY_COLLECTION_MAP
} from './types.js';
