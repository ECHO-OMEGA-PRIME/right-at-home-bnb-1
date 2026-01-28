/**
 * Type definitions for RightAtHomeBnB CloudSync
 */

import type { CollectionName } from './firebase-config.js';

// Sync status for individual records
export type SyncStatus = 'synced' | 'pending' | 'error' | 'conflict';

// Sync operation types
export type SyncOperation = 'create' | 'update' | 'delete';

// Entity types that can be synced
export type SyncableEntity =
  | 'property'
  | 'photo'
  | 'booking'
  | 'guest'
  | 'cleaningJob'
  | 'smartLock'
  | 'message'
  | 'expense'
  | 'user';

// Mapping of entity types to collection names
export const ENTITY_COLLECTION_MAP: Record<SyncableEntity, CollectionName> = {
  property: 'rightathome_properties',
  photo: 'rightathome_photos',
  booking: 'rightathome_bookings',
  guest: 'rightathome_guests',
  cleaningJob: 'rightathome_cleaning_jobs',
  smartLock: 'rightathome_smart_locks',
  message: 'rightathome_messages',
  expense: 'rightathome_expenses',
  user: 'rightathome_users'
};

// Base interface for all syncable records
export interface SyncableRecord {
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Sync metadata stored with each cloud document
export interface SyncMetadata {
  localId: string;
  cloudId: string;
  lastSyncedAt: Date | string;
  syncVersion: number;
  deviceId: string;
  checksum: string;
}

// Full sync record (document in Firestore)
export interface CloudDocument<T extends SyncableRecord> {
  data: T;
  syncMeta: SyncMetadata;
  _serverTimestamp?: unknown; // Firestore server timestamp
}

// Sync metadata collection document
export interface SyncMetadataDoc {
  entityType: SyncableEntity;
  lastFullSync: Date | string;
  lastIncrementalSync: Date | string;
  recordCount: number;
  syncErrors: SyncError[];
  deviceId: string;
}

// Sync error details
export interface SyncError {
  recordId: string;
  entityType: SyncableEntity;
  operation: SyncOperation;
  error: string;
  timestamp: Date | string;
  retryCount: number;
  resolved: boolean;
}

// Offline queue item
export interface OfflineQueueItem {
  id: string;
  entityType: SyncableEntity;
  operation: SyncOperation;
  recordId: string;
  data: unknown;
  timestamp: Date | string;
  retryCount: number;
  lastError?: string;
  priority: number;
}

// Conflict resolution result
export interface ConflictResolution {
  winner: 'local' | 'remote';
  mergedData?: unknown;
  timestamp: Date | string;
}

// Sync result for a single operation
export interface SyncResult {
  success: boolean;
  recordId: string;
  entityType: SyncableEntity;
  operation: SyncOperation;
  status: SyncStatus;
  error?: string;
  conflictResolution?: ConflictResolution;
}

// Bulk sync result
export interface BulkSyncResult {
  totalRecords: number;
  successCount: number;
  errorCount: number;
  conflictCount: number;
  results: SyncResult[];
  duration: number;
}

// Sync event types for listeners
export type SyncEventType =
  | 'sync:started'
  | 'sync:completed'
  | 'sync:error'
  | 'sync:progress'
  | 'sync:conflict'
  | 'sync:offline'
  | 'sync:online'
  | 'record:created'
  | 'record:updated'
  | 'record:deleted';

// Sync event payload
export interface SyncEvent {
  type: SyncEventType;
  entityType?: SyncableEntity;
  recordId?: string;
  data?: unknown;
  error?: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  timestamp: Date;
}

// Sync listener callback
export type SyncEventListener = (event: SyncEvent) => void;

// Cloud sync options
export interface CloudSyncOptions {
  autoSync?: boolean;
  syncInterval?: number; // ms
  batchSize?: number;
  maxRetries?: number;
  conflictResolution?: 'local-wins' | 'remote-wins' | 'last-write-wins' | 'manual';
  enableOfflineQueue?: boolean;
  deviceId?: string;
}

// Property-specific types for Firestore
export interface CloudProperty extends SyncableRecord {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  squareFeet?: number;
  propertyType: string;
  amenities?: string;
  wifiNetwork?: string;
  wifiPassword?: string;
  parkingInfo?: string;
  checkInInstr?: string;
  checkOutInstr?: string;
  houseRules?: string;
  cleaningChecklist?: string;
  nightlyRate: number;
  cleaningFee?: number;
  securityDeposit?: number;
  airbnbId?: string;
  vrboId?: string;
  status: string;
}

// Photo-specific types
export interface CloudPhoto extends SyncableRecord {
  propertyId: string;
  url: string;
  caption?: string;
  isPrimary: boolean;
  sortOrder: number;
}

// Booking-specific types
export interface CloudBooking extends SyncableRecord {
  propertyId: string;
  guestId: string;
  checkIn: Date | string;
  checkOut: Date | string;
  guestCount: number;
  platform: string;
  confirmCode?: string;
  nightlyRate: number;
  totalNights: number;
  subtotal: number;
  cleaningFee?: number;
  serviceFee?: number;
  taxes?: number;
  totalPrice: number;
  accessCode?: string;
  codeExpiresAt?: Date | string;
  status: string;
  specialReqs?: string;
  internalNotes?: string;
}

// Guest-specific types
export interface CloudGuest extends SyncableRecord {
  email: string;
  name: string;
  phone?: string;
  platform: string;
  platformId?: string;
  firstStay?: Date | string;
  lastStay?: Date | string;
  totalStays: number;
  totalSpent: number;
  avgRating?: number;
  tags?: string;
  notes?: string;
  preferences?: string;
  isVip: boolean;
  vipTier?: string;
  birthday?: Date | string;
  anniversary?: Date | string;
}

// Type guard helpers
export function isCloudProperty(data: unknown): data is CloudProperty {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    'address' in data &&
    'bedrooms' in data
  );
}

export function isCloudBooking(data: unknown): data is CloudBooking {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'propertyId' in data &&
    'guestId' in data &&
    'checkIn' in data
  );
}

export function isCloudGuest(data: unknown): data is CloudGuest {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'email' in data &&
    'name' in data
  );
}
