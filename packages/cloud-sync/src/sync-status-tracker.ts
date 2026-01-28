/**
 * Sync Status Tracker for RightAtHomeBnB CloudSync
 *
 * Tracks sync status for all records with visual indicators
 * and provides hooks for UI integration.
 */

import EventEmitter from 'eventemitter3';
import type {
  SyncableEntity,
  SyncStatus,
  SyncEvent,
  SyncEventListener
} from './types.js';

export interface TrackedRecord {
  entityType: SyncableEntity;
  recordId: string;
  status: SyncStatus;
  lastSyncAttempt?: Date;
  lastSuccessfulSync?: Date;
  errorMessage?: string;
  retryCount: number;
  pendingSince?: Date;
}

export interface SyncStatusSummary {
  total: number;
  synced: number;
  pending: number;
  error: number;
  conflict: number;
  byEntityType: Record<SyncableEntity, {
    total: number;
    synced: number;
    pending: number;
    error: number;
  }>;
}

export class SyncStatusTracker extends EventEmitter<{
  'status:changed': [TrackedRecord];
  'summary:updated': [SyncStatusSummary];
}> {
  private records: Map<string, TrackedRecord> = new Map();
  private entityTypes: Set<SyncableEntity> = new Set();

  /**
   * Generate unique key for a record
   */
  private getKey(entityType: SyncableEntity, recordId: string): string {
    return `${entityType}:${recordId}`;
  }

  /**
   * Track a record's sync status
   */
  track(entityType: SyncableEntity, recordId: string, status: SyncStatus): TrackedRecord {
    const key = this.getKey(entityType, recordId);
    const existing = this.records.get(key);

    const record: TrackedRecord = {
      entityType,
      recordId,
      status,
      lastSyncAttempt: new Date(),
      lastSuccessfulSync: status === 'synced' ? new Date() : existing?.lastSuccessfulSync,
      retryCount: existing?.retryCount ?? 0,
      pendingSince: status === 'pending' && !existing?.pendingSince
        ? new Date()
        : existing?.pendingSince
    };

    if (status === 'synced') {
      record.errorMessage = undefined;
      record.pendingSince = undefined;
      record.retryCount = 0;
    }

    this.records.set(key, record);
    this.entityTypes.add(entityType);

    this.emit('status:changed', record);
    this.emitSummaryUpdate();

    return record;
  }

  /**
   * Update a record's status with error information
   */
  trackError(
    entityType: SyncableEntity,
    recordId: string,
    errorMessage: string
  ): TrackedRecord {
    const key = this.getKey(entityType, recordId);
    const existing = this.records.get(key);

    const record: TrackedRecord = {
      entityType,
      recordId,
      status: 'error',
      lastSyncAttempt: new Date(),
      lastSuccessfulSync: existing?.lastSuccessfulSync,
      errorMessage,
      retryCount: (existing?.retryCount ?? 0) + 1,
      pendingSince: existing?.pendingSince
    };

    this.records.set(key, record);
    this.entityTypes.add(entityType);

    this.emit('status:changed', record);
    this.emitSummaryUpdate();

    return record;
  }

  /**
   * Mark a record as having a conflict
   */
  trackConflict(entityType: SyncableEntity, recordId: string): TrackedRecord {
    const key = this.getKey(entityType, recordId);
    const existing = this.records.get(key);

    const record: TrackedRecord = {
      entityType,
      recordId,
      status: 'conflict',
      lastSyncAttempt: new Date(),
      lastSuccessfulSync: existing?.lastSuccessfulSync,
      retryCount: existing?.retryCount ?? 0,
      pendingSince: existing?.pendingSince
    };

    this.records.set(key, record);
    this.entityTypes.add(entityType);

    this.emit('status:changed', record);
    this.emitSummaryUpdate();

    return record;
  }

  /**
   * Get status for a specific record
   */
  getStatus(entityType: SyncableEntity, recordId: string): TrackedRecord | undefined {
    return this.records.get(this.getKey(entityType, recordId));
  }

  /**
   * Get sync status value for a record (for quick checks)
   */
  getStatusValue(entityType: SyncableEntity, recordId: string): SyncStatus {
    const record = this.getStatus(entityType, recordId);
    return record?.status ?? 'pending';
  }

  /**
   * Get all records with a specific status
   */
  getByStatus(status: SyncStatus): TrackedRecord[] {
    return Array.from(this.records.values()).filter(r => r.status === status);
  }

  /**
   * Get all records for an entity type
   */
  getByEntityType(entityType: SyncableEntity): TrackedRecord[] {
    return Array.from(this.records.values()).filter(r => r.entityType === entityType);
  }

  /**
   * Get all pending records (for retry processing)
   */
  getPending(): TrackedRecord[] {
    return this.getByStatus('pending');
  }

  /**
   * Get all error records (for error handling/display)
   */
  getErrors(): TrackedRecord[] {
    return this.getByStatus('error');
  }

  /**
   * Get all conflict records
   */
  getConflicts(): TrackedRecord[] {
    return this.getByStatus('conflict');
  }

  /**
   * Remove tracking for a record
   */
  untrack(entityType: SyncableEntity, recordId: string): boolean {
    const key = this.getKey(entityType, recordId);
    const existed = this.records.delete(key);

    if (existed) {
      this.emitSummaryUpdate();
    }

    return existed;
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.records.clear();
    this.emitSummaryUpdate();
  }

  /**
   * Clear tracking for a specific entity type
   */
  clearEntityType(entityType: SyncableEntity): void {
    for (const [key, record] of this.records) {
      if (record.entityType === entityType) {
        this.records.delete(key);
      }
    }
    this.emitSummaryUpdate();
  }

  /**
   * Get summary of all sync statuses
   */
  getSummary(): SyncStatusSummary {
    const summary: SyncStatusSummary = {
      total: this.records.size,
      synced: 0,
      pending: 0,
      error: 0,
      conflict: 0,
      byEntityType: {} as Record<SyncableEntity, {
        total: number;
        synced: number;
        pending: number;
        error: number;
      }>
    };

    // Initialize entity type summaries
    for (const entityType of this.entityTypes) {
      summary.byEntityType[entityType] = {
        total: 0,
        synced: 0,
        pending: 0,
        error: 0
      };
    }

    // Calculate counts
    for (const record of this.records.values()) {
      switch (record.status) {
        case 'synced':
          summary.synced++;
          summary.byEntityType[record.entityType].synced++;
          break;
        case 'pending':
          summary.pending++;
          summary.byEntityType[record.entityType].pending++;
          break;
        case 'error':
          summary.error++;
          summary.byEntityType[record.entityType].error++;
          break;
        case 'conflict':
          summary.conflict++;
          break;
      }

      summary.byEntityType[record.entityType].total++;
    }

    return summary;
  }

  /**
   * Check if all records are synced
   */
  get isFullySynced(): boolean {
    return this.getByStatus('pending').length === 0 &&
           this.getByStatus('error').length === 0 &&
           this.getByStatus('conflict').length === 0;
  }

  /**
   * Check if there are any errors
   */
  get hasErrors(): boolean {
    return this.getByStatus('error').length > 0;
  }

  /**
   * Check if there are pending syncs
   */
  get hasPending(): boolean {
    return this.getByStatus('pending').length > 0;
  }

  /**
   * Get total tracked record count
   */
  get count(): number {
    return this.records.size;
  }

  /**
   * Emit summary update event
   */
  private emitSummaryUpdate(): void {
    this.emit('summary:updated', this.getSummary());
  }

  /**
   * Process sync event from CloudSync
   */
  processSyncEvent(event: SyncEvent): void {
    if (!event.entityType || !event.recordId) return;

    switch (event.type) {
      case 'record:created':
      case 'record:updated':
        this.track(event.entityType, event.recordId, 'synced');
        break;

      case 'record:deleted':
        this.untrack(event.entityType, event.recordId);
        break;

      case 'sync:error':
        this.trackError(event.entityType, event.recordId, event.error || 'Unknown error');
        break;

      case 'sync:conflict':
        this.trackConflict(event.entityType, event.recordId);
        break;
    }
  }

  /**
   * Export all tracking data (for debugging/persistence)
   */
  export(): TrackedRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * Import tracking data
   */
  import(records: TrackedRecord[]): void {
    for (const record of records) {
      const key = this.getKey(record.entityType, record.recordId);
      this.records.set(key, record);
      this.entityTypes.add(record.entityType);
    }
    this.emitSummaryUpdate();
  }
}

// Singleton instance
let trackerInstance: SyncStatusTracker | null = null;

/**
 * Get or create the singleton tracker instance
 */
export function getSyncStatusTracker(): SyncStatusTracker {
  if (!trackerInstance) {
    trackerInstance = new SyncStatusTracker();
  }
  return trackerInstance;
}
